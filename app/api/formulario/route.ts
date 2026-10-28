import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { describeError, getClientIp, isValidClientSessionId, rateLimit } from '@/lib/server';
import { isBitrixConfigured, registrarCuradoriaComment, registrarDeclaracoes, registrarLead, sanitizeAttribution } from '@/lib/bitrix';
import { executarCuradoria, formatarFichaCuradoria, ROTULO_FASE, ROTULO_STATUS, ROTULO_TITULAR } from '@/lib/curadoria';
import { enviarPrimeiroContatoWhatsApp } from '@/lib/whatsapp-api';
import { agendarAIChatLead } from '@/lib/lead-pos';
import { isValidCpf } from '@/lib/oficio-extract';

// Variante B (/antecipar): fim do formulário em etapas. Faz a triagem e o ranqueamento (curadoria),
// completa o card no Bitrix (foguinho quando há processo) e dispara o primeiro contato pelo
// WhatsApp, marcando o card como contatado.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BODY_BYTES = 16 * 1024;
const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

const digitos = (s: string) => s.replace(/\D/g, '');
const texto = (max: number) => z.string().trim().max(max);
const nomeRe = /^[\p{L}][\p{L}\s'.-]*$/u;

const schema = z.object({
  clientSessionId: z.string(),
  attribution: z.unknown().optional(),
  nome: texto(120).min(2).regex(nomeRe),
  celular: z.string().transform(digitos).pipe(z.string().regex(/^\d{10,11}$/)),
  cpf: z.string().transform(digitos).refine(isValidCpf).optional(),
  titularidadeOpcao: z.enum(['meu', 'outra_pessoa']).optional(),
  vinculoTitular: texto(120).optional(),
  tipo: z.enum(['federal', 'estadual', 'municipal', 'inss', 'nao_sabe']),
  natureza: z.enum(['alimentar', 'comum', 'nao_sabe']).optional().default('nao_sabe'),
  uf: z.enum(UFS),
  municipio: texto(80).optional(),
  papel: z.enum(['proprio_titular', 'advogado', 'broker', 'herdeiro_espolio', 'terceiro']).optional(),
  titular: z
    .object({
      nome: texto(120).min(2).regex(nomeRe),
      cpf: z.string().transform(digitos).refine(isValidCpf),
      celular: z.string().transform(digitos).pipe(z.string().regex(/^(\d{10,11})?$/)).optional(),
    })
    .optional(),
  fase: z.enum(['precatorio_expedido', 'aguardando_expedicao', 'em_andamento_sem_sentenca', 'nao_sabe']).optional(),
  situacaoExpedicao: z.enum(['expedido', 'em_andamento', 'nao_sabe']).optional(),
  melhorHorarioContato: texto(100).optional(),
  melhorDiaContato: texto(60).optional(),
  processo: texto(40).optional(),
  expedicao: texto(20).optional(),
  valor: texto(30).optional(),
});

const ROTULO_TIPO: Record<string, string> = { federal: 'Federal', estadual: 'Estadual', municipal: 'Municipal', inss: 'INSS', nao_sabe: 'Não sabe informar' };
const ROTULO_NATUREZA: Record<string, string> = { alimentar: 'Alimentar', comum: 'Comum', nao_sabe: 'Não sabe' };

const fmtCelular = (d: string) =>
  d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
const fmtCpf = (d: string) => d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

// O primeiro contato sai uma vez por sessão (o cliente pode voltar e reenviar a etapa).
const contatoEnviado = new Set<string>();

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`formulario:${ip}`, 10, 5 * 60_000)) return bad('Muitas tentativas. Aguarde alguns minutos e tente de novo.', 429);

  let raw: unknown;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return bad('Requisição muito grande.', 413);
    raw = JSON.parse(body);
  } catch {
    return bad('JSON inválido.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return bad('Confira os dados informados e tente novamente.');
  const d = parsed.data;
  if (!isValidClientSessionId(d.clientSessionId)) return bad('Sessão inválida.');
  const titularOpcao = d.titularidadeOpcao || (d.papel === 'proprio_titular' ? 'meu' : 'outra_pessoa');
  const isMeu = titularOpcao === 'meu';
  if (!isMeu && !d.titular) return bad('Informe os dados do titular do precatório.');
  if (d.tipo === 'municipal' && !d.municipio) return bad('Informe o município.');

  if (!isBitrixConfigured()) {
    console.error('[api/formulario] BITRIX_WEBHOOK_URL ausente: lead não registrado');
    return bad('Não foi possível registrar seus dados agora. Tente novamente.', 503);
  }

  const attribution = sanitizeAttribution(d.attribution);
  const processo = d.processo || null;
  const titular = isMeu ? undefined : d.titular;
  const celularTitular = titular?.celular ? fmtCelular(titular.celular) : null;
  const relacaoTitular = isMeu ? 'proprio_titular' : (d.papel || 'terceiro');
  const situacao = d.situacaoExpedicao || (d.fase === 'precatorio_expedido' ? 'expedido' : d.fase === 'em_andamento_sem_sentenca' ? 'em_andamento' : 'nao_sabe');
  const faseProcesso = situacao === 'expedido' ? 'precatorio_expedido' : situacao === 'em_andamento' ? 'em_andamento_sem_sentenca' : (d.fase || 'nao_sabe');
  const temProcesso = situacao === 'expedido' || Boolean(processo) || undefined;

  // Triagem e ranqueamento (2.5): processo/precatório expedido acende o foguinho no card.
  const curadoria = executarCuradoria({
    nome: d.nome,
    uf: d.uf,
    municipio: d.municipio || null,
    tipo: d.tipo,
    natureza: d.natureza,
    valorAproximado: d.valor || null,
    relacaoTitular,
    vinculoTitular: d.vinculoTitular,
    faseProcesso,
    situacaoExpedicao: situacao,
    temProcesso,
    numeroProcesso: processo,
    nomeTitular: titular?.nome ?? null,
    cpfTitular: titular?.cpf ?? null,
    celularTitular,
    melhorHorarioContato: d.melhorHorarioContato,
    melhorDiaContato: d.melhorDiaContato,
  });

  try {
    const { registrado, criado, dealId } = await registrarLead({
      sessionId: d.clientSessionId,
      nome: d.nome,
      celular: d.celular,
      cpf: d.cpf,
      estado: d.uf,
      stage: 'form_processo',
      resultado: 'lead_qualificado',
      attribution,
      variante: 'formulario',
      melhorHorarioContato: d.melhorHorarioContato,
      melhorDiaContato: d.melhorDiaContato,
      vinculoTitular: d.vinculoTitular,
      curadoria: {
        rank: curadoria.rank,
        status: curadoria.status,
        tipo: d.tipo,
        natureza: d.natureza,
        relacaoTitular: curadoria.relacaoTitular,
        vinculoTitular: d.vinculoTitular,
        faseProcesso: curadoria.faseProcesso,
        situacaoExpedicao: situacao,
        intencao: curadoria.intencao,
        temProcesso: curadoria.temProcesso,
        numeroProcesso: processo,
        municipio: d.municipio || null,
        nomeTitular: titular?.nome ?? null,
        cpfTitular: titular?.cpf ?? null,
        celularTitular,
        valorAproximado: d.valor || null,
        melhorHorarioContato: d.melhorHorarioContato,
        melhorDiaContato: d.melhorDiaContato,
        parecer: curadoria.parecerCuradoria,
        orientacoesComercial: curadoria.orientacoesComercial,
      },
    });
    if (!registrado) return bad('Não foi possível registrar seus dados agora. Tente novamente.', 502);

    const aiChatLead =
      criado && dealId
        ? agendarAIChatLead({ request, ip, sessionId: d.clientSessionId, dealId, nome: d.nome, celular: d.celular, estado: d.uf, attribution })
        : undefined;

    after(async () => {
      try {
        // Ficha de curadoria e respostas declaradas na timeline do card.
        await registrarCuradoriaComment({
          sessionId: d.clientSessionId,
          comment: formatarFichaCuradoria(curadoria, { nome: d.nome, celular: fmtCelular(d.celular), uf: d.uf, municipio: d.municipio, tipo: d.tipo }),
        });
        await registrarDeclaracoes({
          sessionId: d.clientSessionId,
          titulo: 'Respostas do formulário em etapas (Roteiro Validado):',
          itens: [
            ['Nome do Interessado', d.nome],
            ['Telefone / WhatsApp', fmtCelular(d.celular)],
            ['CPF do Interessado', d.cpf ? fmtCpf(d.cpf) : 'Não informado'],
            ['Titularidade do Precatório', isMeu ? 'É meu (titular direto)' : 'É de outra pessoa'],
            ['Titular - nome completo', titular?.nome],
            ['Titular - CPF', titular ? fmtCpf(titular.cpf) : null],
            ['Titular - celular', celularTitular],
            ['Vínculo com o Titular', d.vinculoTitular],
            ['Esfera do Precatório', ROTULO_TIPO[d.tipo]],
            ['UF do processo', d.uf],
            ['Município', d.municipio],
            ['Situação / Expedição', situacao === 'expedido' ? 'Já foi expedido' : situacao === 'em_andamento' ? 'Em andamento' : 'Não sabe informar'],
            ['Número do Processo', processo],
            ['Valor aproximado', d.valor],
            ['Melhor Horário para Contato', d.melhorHorarioContato],
            ['Melhor Dia para Contato', d.melhorDiaContato],
            ['Rank do Lead', curadoria.rank],
            ['Processo Ativo / Foguinho', curadoria.temProcesso ? '🔥 SIM' : 'NÃO'],
          ],
        });
      } catch (error) {
        console.error('[api/formulario] falha ao registrar a curadoria no card:', describeError(error));
      }

      // 3. Primeiro contato pelo WhatsApp API (marca "Contato realizado" no card).
      if (!curadoria.elegivel || contatoEnviado.has(d.clientSessionId)) return;
      contatoEnviado.add(d.clientSessionId);
      try {
        await enviarPrimeiroContatoWhatsApp({
          sessionId: d.clientSessionId,
          dealId,
          nome: d.nome,
          celular: d.celular,
          esfera: d.tipo,
          uf: d.uf,
          municipio: d.municipio || null,
          papel: relacaoTitular,
          nomeTitular: titular?.nome ?? null,
        });
      } catch (error) {
        contatoEnviado.delete(d.clientSessionId);
        console.error('[api/formulario] falha no primeiro contato por WhatsApp:', describeError(error));
      }
    });

    return NextResponse.json({ ok: true, rank: curadoria.rank, ...(aiChatLead ? { aiChatLead } : {}) });
  } catch (error) {
    console.error('[api/formulario] erro:', describeError(error));
    return bad('Falha ao registrar seus dados. Tente novamente.', 502);
  }
}
