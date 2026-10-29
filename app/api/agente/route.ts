import { NextResponse, after } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { describeError, getClientIp, isValidClientSessionId, rateLimit, redactPii } from '@/lib/server';
import {
  formatarDossieCardBitrix,
  isBitrixConfigured,
  registrarCuradoriaComment,
  registrarDeclaracoes,
  registrarLead,
  sanitizeAttribution,
} from '@/lib/bitrix';
import { agendarAIChatLead, agendarCpfEEnriquecimento } from '@/lib/lead-pos';
import { isValidCpf } from '@/lib/oficio-extract';
import {
  executarCuradoria,
  formatarFichaCuradoria,
  ROTULO_FASE,
  ROTULO_STATUS,
  ROTULO_TITULAR,
  type CuradoriaInput,
} from '@/lib/curadoria';
import { enviarPrimeiroContatoWhatsApp } from '@/lib/whatsapp-api';

// Secretária digital Karen (LangChain Agent):
// Qualificação e curadoria ativa de precatórios e RPVs.
// Roteiro estruturado em linguagem natural:
// 1. CPF, nome completo e número de celular (WhatsApp).
// 2. Esfera (federal, estadual, municipal), município ou estado (UF), e se é titular ou advogado/broker.
//    - Caso seja advogado, broker ou terceiro: solicita nome completo, CPF e telefone do titular.
// 2.5. Triagem e ranqueamento com ativação de foguinho 🔥 no Bitrix caso tenha processo ativo.
// 3. Primeiro contato via WhatsApp API e marcação no card de contato realizado.
// PII é tratada e protegida no servidor com conformidade LGPD.

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.AGENTE_MODEL || 'gpt-4o-mini';
const MAX_BODY_BYTES = 48 * 1024;
const MAX_HISTORY = 30;
const MAX_CONTENT = 2000;
const MAX_TOOL_ROUNDS = 4;
const WA = '(21) 98645-0262';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

const SYSTEM_PROMPT = `Você é a Karen, secretária digital e curadora da Premium Office Precatórios, empresa especializada em cessão e antecipação de créditos judiciais (precatórios e RPVs).

Seu objetivo é conduzir uma conversa acolhedora, educada, direta e validada, seguindo estritamente este roteiro de 5 blocos para triar os dados e entregar o lead qualificado ao card do Bitrix:

═══════════════════════════════════════════════════════════
BLOCO 1: IDENTIFICAÇÃO DO INTERESSADO
Objetivo: registrar os dados básicos para contato.
Perguntas da assistente (faça de forma objetiva e acolhedora):
1. Qual é o seu nome completo?
2. Por favor, informe seu CPF.
3. Qual é o seu telefone com DDD para contato?
Orientação interna: validar o preenchimento dos dados antes de avançar. Você só pode avançar para a pergunta 4 após o usuário ter fornecido nome, CPF e telefone com DDD válidos. (Nota de privacidade LGPD: o sistema valida o CPF e telefone em tempo real. Veja o campo STATUS abaixo para saber o que já foi recebido).

═══════════════════════════════════════════════════════════
BLOCO 2: TITULARIDADE DO PRECATÓRIO
Objetivo: identificar quem é o titular do crédito.
Pergunta 4: O precatório está em seu nome ou pertence a outra pessoa?
Opções:
- É meu.
- É de outra pessoa.

Condicional:
- Se for do próprio interessado ("É meu"): siga diretamente para o Bloco 3.
- Se for de outra pessoa ("É de outra pessoa"), pergunte com respeito:
  5. Qual é o nome completo do titular do precatório?
  6. Qual é o CPF do titular?
  7. Qual é o seu vínculo com o titular? (Ex.: familiar, representante legal, advogado, broker ou outro).

═══════════════════════════════════════════════════════════
BLOCO 3: DADOS DO PRECATÓRIO
Objetivo: entender a origem e a situação do crédito.
Pergunta 8: O seu precatório é de qual esfera?
Opções:
- Federal
- Estadual
- Municipal
- Não sei informar

Pergunta 9 — Condicional:
- Se for estadual: de qual estado (UF) é o precatório?
- Se for municipal: de qual município e estado ele é?
- Se for federal ou não souber informar: pergunte apenas o estado (UF) onde o processo corre.

Pergunta 10: O precatório já foi expedido ou o processo ainda está em andamento?
Opções:
- Já foi expedido.
- O processo ainda está em andamento.
- Não sei informar.
Orientação: Sempre que o usuário responder este bloco, você pode acionar a ferramenta triar_dados_lead para diagnosticar o caso e acender o foguinho 🔥 de processo ativo no Bitrix.

═══════════════════════════════════════════════════════════
BLOCO 4: MELHOR HORÁRIO PARA CONTATO
Objetivo: facilitar o contato da equipe comercial.
Pergunta 11: Qual é o melhor horário para nossa equipe entrar em contato com você e conversar melhor sobre o seu precatório?
Opções sugeridas:
- Manhã
- Tarde
- Noite
- Qualquer horário comercial
Se possível, solicite também se há algum melhor dia para contato (ex.: hoje, dias úteis, etc.).

═══════════════════════════════════════════════════════════
BLOCO 5: ENCERRAMENTO E ENCAMINHAMENTO
Assim que o usuário responder a pergunta 11, você DEVE IMEDIATAMENTE invocar a ferramenta registrar_lead_e_contatar.
Esta ferramenta salva todos os dados triados no Bitrix24 (com foguinho 🔥 no card caso o precatório já tenha sido expedido), grava o melhor horário e dispara o primeiro contato via WhatsApp API.

Após a ferramenta registrar com sucesso, sua resposta final deve conter obrigatoriamente a mensagem institucional de encerramento:
"Obrigado pelas informações!
Registramos os dados para que nossa equipe possa entender melhor o seu caso e dar continuidade ao atendimento.

Em breve, nossa equipe entrará em contato conforme a disponibilidade informada.

A Premium Office agradece o seu contato!"

Regras de Condução:
- Tom de voz: educado, empático, direto e resumido. Máximo de 2 a 3 frases por mensagem.
- Uma etapa/pergunta por vez: jamais faça perguntas de blocos futuros antes de validar a etapa atual.
- Nunca prometa valores líquidos fechados ou taxas de deságio sem análise do ofício pelo especialista.
- Se o usuário pedir atendimento humano imediato, forneça o WhatsApp ${WA}.`;

type ChatMsg = { role: 'user' | 'assistant'; content: string };

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function formatarCelularBr(digits: string): string {
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

// ---------------------------------------------------------------- PII extraída no servidor
const CPF_FORMATADO_RE = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const DIGITOS_RE = /(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}|\b\d{11}\b/g;

function celularValido(d: string) {
  const ddd = Number(d.slice(0, 2));
  return /^\d{10,11}$/.test(d) && ddd >= 11 && ddd <= 99 && (d.length === 10 || d[2] === '9');
}

function extrairPii(mensagensDoUsuario: string[]): {
  celular?: string;
  cpf?: string;
  celularTitular?: string;
  cpfTitular?: string;
} {
  const celulares: string[] = [];
  const cpfs: string[] = [];

  for (const texto of mensagensDoUsuario) {
    for (const m of texto.match(CPF_FORMATADO_RE) ?? []) {
      const d = m.replace(/\D/g, '');
      if (isValidCpf(d) && !cpfs.includes(d)) cpfs.push(d);
    }
    for (const m of texto.replace(CPF_FORMATADO_RE, ' ').match(DIGITOS_RE) ?? []) {
      let d = m.replace(/\D/g, '');
      if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
      if (celularValido(d) && !celulares.includes(d)) celulares.push(d);
      else if (d.length === 11 && isValidCpf(d) && !cpfs.includes(d)) cpfs.push(d);
    }
  }

  return {
    celular: celulares[0],
    cpf: cpfs[0],
    celularTitular: celulares[1],
    cpfTitular: cpfs[1],
  };
}

// ---------------------------------------------------------------- Schemas das ferramentas do agente
const triarDadosLeadSchema = z.object({
  esfera: z.enum(['federal', 'estadual', 'municipal', 'inss', 'outro', 'nao_sabe']).nullable().optional().describe('Pergunta 8: Esfera do precatório'),
  uf: z.enum(UFS).nullable().optional().describe('Pergunta 9: Estado (UF) do precatório, se estadual/municipal ou informado'),
  municipio: z.string().max(80).nullable().optional().describe('Pergunta 9: Município e estado se for municipal'),
  titularidade_opcao: z.enum(['meu', 'outra_pessoa']).nullable().optional().describe('Pergunta 4: É meu ou É de outra pessoa'),
  relacao_titular: z.enum(['proprio_titular', 'herdeiro_espolio', 'advogado', 'broker', 'terceiro', 'nao_sabe']).nullable().optional().describe('Classificação técnica da relação'),
  nome_titular: z.string().max(120).nullable().optional().describe('Pergunta 5: Nome do titular se for de outra pessoa'),
  cpf_titular: z.string().max(20).nullable().optional().describe('Pergunta 6: CPF do titular se for de outra pessoa'),
  vinculo_titular: z.string().max(120).nullable().optional().describe('Pergunta 7: Vínculo com o titular (familiar, representante legal, advogado, etc.)'),
  situacao_expedicao: z.enum(['expedido', 'em_andamento', 'nao_sabe']).nullable().optional().describe('Pergunta 10: Já foi expedido, Em andamento ou Não sei informar'),
  numero_processo: z.string().max(80).nullable().optional().describe('Número do processo se informado'),
  valor_aproximado: z.string().max(80).nullable().optional().describe('Valor aproximado citado pelo cliente'),
  melhor_horario_contato: z.string().max(100).nullable().optional().describe('Pergunta 11: Manhã, Tarde, Noite ou Qualquer horário comercial'),
  melhor_dia_contato: z.string().max(60).nullable().optional().describe('Melhor dia para contato se informado'),
  detalhes_caso: z.string().max(300).nullable().optional().describe('Resumo curto do caso relatado'),
});

type TriarDadosLeadArgs = z.infer<typeof triarDadosLeadSchema>;

const registrarLeadSchema = z.object({
  nome: z.string().min(2).max(120).describe('Pergunta 1: Nome completo do interessado'),
  esfera: z.enum(['federal', 'estadual', 'municipal', 'inss', 'outro', 'nao_sabe']).nullable().optional().describe('Pergunta 8: Esfera do precatório'),
  uf: z.enum(UFS).nullable().optional().describe('Pergunta 9: Estado (UF) do precatório'),
  municipio: z.string().max(80).nullable().optional().describe('Pergunta 9: Município do precatório se municipal'),
  titularidade_opcao: z.enum(['meu', 'outra_pessoa']).nullable().optional().describe('Pergunta 4: É meu ou É de outra pessoa'),
  relacao_titular: z.enum(['proprio_titular', 'herdeiro_espolio', 'advogado', 'broker', 'terceiro', 'nao_sabe']).nullable().optional().describe('Relação técnica'),
  nome_titular: z.string().max(120).nullable().optional().describe('Pergunta 5: Nome completo do titular se de outra pessoa'),
  cpf_titular: z.string().max(20).nullable().optional().describe('Pergunta 6: CPF do titular se de outra pessoa'),
  vinculo_titular: z.string().max(120).nullable().optional().describe('Pergunta 7: Vínculo com o titular (familiar, representante, advogado, etc.)'),
  situacao_expedicao: z.enum(['expedido', 'em_andamento', 'nao_sabe']).nullable().optional().describe('Pergunta 10: Já foi expedido, Em andamento ou Não sei'),
  numero_processo: z.string().max(80).nullable().optional().describe('Número do processo judicial, se informado'),
  valor_aproximado: z.string().max(80).nullable().optional().describe('Valor aproximado citado'),
  melhor_horario_contato: z.string().max(100).nullable().optional().describe('Pergunta 11: Melhor horário para contato: Manhã, Tarde, Noite ou Qualquer horário comercial'),
  melhor_dia_contato: z.string().max(60).nullable().optional().describe('Melhor dia da semana para contato, se informado'),
  resumo: z.string().max(400).nullable().optional().describe('Resumo do caso em 1 ou 2 frases'),
});

type RegistrarLeadArgs = z.infer<typeof registrarLeadSchema>;

const ROTULO_TIPO: Record<string, string> = {
  federal: 'Federal',
  estadual: 'Estadual',
  municipal: 'Municipal',
  inss: 'INSS',
  outro: 'Outro',
  nao_sabe: 'Não sabe informar',
};
const ROTULO_NATUREZA: Record<string, string> = { alimentar: 'Alimentar', comum: 'Comum', nao_sabe: 'Não sabe' };

export async function POST(request: Request) {
  const startedAt = Date.now();
  const ip = getClientIp(request);
  if (!rateLimit(`agente:ip:${ip}`, 40, 5 * 60_000)) {
    return bad(`Muitas mensagens em pouco tempo. Aguarde um instante ou fale no WhatsApp ${WA}.`, 429);
  }

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return bad('Conversa muito longa.', 413);
  let body: any;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return bad('Conversa muito longa.', 413);
    body = JSON.parse(raw);
  } catch {
    return bad('Requisição inválida.');
  }

  const { messages, clientSessionId, attribution } = body ?? {};
  if (!isValidClientSessionId(clientSessionId)) return bad('Sessão inválida.');
  if (!Array.isArray(messages) || messages.length === 0) return bad('Mensagens inválidas.');
  if (!rateLimit(`agente:sess:${clientSessionId}`, 30, 5 * 60_000)) {
    return bad(`Muitas mensagens em pouco tempo. Aguarde um instante ou fale no WhatsApp ${WA}.`, 429);
  }

  const history: ChatMsg[] = [];
  for (const m of messages.slice(-MAX_HISTORY)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return bad('Mensagens inválidas.');
    const content = m.content.slice(0, MAX_CONTENT).trim();
    if (content) history.push({ role: m.role, content });
  }
  if (!history.some((m) => m.role === 'user')) return bad('Mensagens inválidas.');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[api/agente] OPENAI_API_KEY ausente');
    return bad('Assistente indisponível no momento.', 503);
  }

  const { celular, cpf, celularTitular, cpfTitular } = extrairPii(
    history.filter((m) => m.role === 'user').map((m) => m.content)
  );
  const attributionClean = sanitizeAttribution(attribution);

  let leadCriado: { id: string } | null = null;
  let leadRegistrado = body?.leadRegistrado === true;

  // Tool 1: Triagem e Ranqueamento dos Dados do Lead
  const triarDadosLeadTool = tool(
    async (args: TriarDadosLeadArgs) => {
      const relacao = args.relacao_titular || (args.titularidade_opcao === 'meu' ? 'proprio_titular' : args.titularidade_opcao === 'outra_pessoa' ? 'terceiro' : undefined);
      const fase = args.situacao_expedicao === 'expedido' ? 'precatorio_expedido' : args.situacao_expedicao === 'em_andamento' ? 'em_andamento_sem_sentenca' : 'nao_sabe';
      const temProc = args.situacao_expedicao === 'expedido' || Boolean(args.numero_processo) || undefined;

      const curadoria = executarCuradoria({
        tipo: args.esfera,
        uf: args.uf,
        municipio: args.municipio,
        valorAproximado: args.valor_aproximado,
        relacaoTitular: relacao,
        vinculoTitular: args.vinculo_titular,
        nomeTitular: args.nome_titular,
        cpfTitular: args.cpf_titular || cpfTitular,
        celularTitular,
        faseProcesso: fase,
        situacaoExpedicao: args.situacao_expedicao,
        temProcesso: temProc,
        numeroProcesso: args.numero_processo,
        melhorHorarioContato: args.melhor_horario_contato,
        melhorDiaContato: args.melhor_dia_contato,
        detalhesCaso: args.detalhes_caso,
      });

      return JSON.stringify({
        status: ROTULO_STATUS[curadoria.status],
        rank: curadoria.rank,
        elegivel: curadoria.elegivel,
        tem_processo: curadoria.temProcesso,
        foguinho_bitrix: curadoria.temProcesso ? '🔥 Ativado no Bitrix' : 'Não',
        titularidade: ROTULO_TITULAR[curadoria.relacaoTitular],
        vinculo: curadoria.vinculoTitular,
        fase: ROTULO_FASE[curadoria.faseProcesso],
        melhor_horario: curadoria.melhorHorarioContato,
        pontos_fortes: curadoria.pontosFortes,
        pontos_atencao: curadoria.pontosAtencao,
        parecer_curadoria: curadoria.parecerCuradoria,
        orientacao_para_karen: curadoria.orientacaoParaKaren,
        orientacoes_comercial: curadoria.orientacoesComercial,
      });
    },
    {
      name: 'triar_dados_lead',
      description:
        'Executa a triagem e ranqueamento completo do precatório (A+ a E), identifica se tem processo ativo (com foguinho 🔥), verifica a titularidade (titular vs advogado vs broker) e fornece orientações de abordagem para a Karen.',
      schema: triarDadosLeadSchema,
    }
  );

  // Tool 2: Registro no Bitrix24 + Primeiro Contato via WhatsApp API
  const registrarLeadTool = tool(
    async (args: RegistrarLeadArgs) => {
      if (!celular) return 'Ainda não há telefone celular válido com DDD. Peça o WhatsApp com DDD antes de registrar.';
      if (!isBitrixConfigured()) return 'Sistema de cadastro indisponível. Ofereça o WhatsApp.';
      const nome = args.nome.trim().replace(/\s+/g, ' ');
      if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(nome)) return 'Nome inválido: confirme o nome completo (somente letras).';

      const relacao = args.relacao_titular || (args.titularidade_opcao === 'meu' ? 'proprio_titular' : args.titularidade_opcao === 'outra_pessoa' ? 'terceiro' : undefined);
      const fase = args.situacao_expedicao === 'expedido' ? 'precatorio_expedido' : args.situacao_expedicao === 'em_andamento' ? 'em_andamento_sem_sentenca' : 'nao_sabe';
      const temProc = args.situacao_expedicao === 'expedido' || Boolean(args.numero_processo) || undefined;
      // CPF do titular: o informado ao LLM só vale se for um CPF válido (somente dígitos); senão, o extraído das mensagens.
      const cpfArgDigitos = (args.cpf_titular || '').replace(/\D/g, '');
      const cpfAlvoTitular = (isValidCpf(cpfArgDigitos) ? cpfArgDigitos : undefined) || cpfTitular;

      // Executa triagem e curadoria completa para preenchimento no Bitrix
      const curadoria = executarCuradoria({
        nome,
        uf: args.uf,
        municipio: args.municipio,
        tipo: args.esfera,
        valorAproximado: args.valor_aproximado,
        relacaoTitular: relacao,
        vinculoTitular: args.vinculo_titular,
        nomeTitular: args.nome_titular,
        cpfTitular: cpfAlvoTitular,
        celularTitular,
        faseProcesso: fase,
        situacaoExpedicao: args.situacao_expedicao,
        temProcesso: temProc,
        numeroProcesso: args.numero_processo,
        melhorHorarioContato: args.melhor_horario_contato,
        melhorDiaContato: args.melhor_dia_contato,
        detalhesCaso: args.resumo,
      });

      try {
        const { registrado, criado, dealId } = await registrarLead({
          sessionId: clientSessionId,
          nome,
          celular,
          cpf,
          estado: args.uf ?? undefined,
          stage: 'agente',
          attribution: attributionClean,
          melhorHorarioContato: args.melhor_horario_contato ?? undefined,
          melhorDiaContato: args.melhor_dia_contato ?? undefined,
          vinculoTitular: args.vinculo_titular ?? undefined,
          curadoria: {
            rank: curadoria.rank,
            status: curadoria.status,
            tipo: args.esfera,
            relacaoTitular: relacao,
            vinculoTitular: args.vinculo_titular,
            nomeTitular: args.nome_titular,
            cpfTitular: cpfAlvoTitular,
            celularTitular,
            faseProcesso: curadoria.faseProcesso,
            situacaoExpedicao: args.situacao_expedicao,
            temProcesso: curadoria.temProcesso,
            numeroProcesso: args.numero_processo,
            municipio: args.municipio,
            valorAproximado: args.valor_aproximado,
            melhorHorarioContato: args.melhor_horario_contato,
            melhorDiaContato: args.melhor_dia_contato,
            parecer: curadoria.parecerCuradoria,
            orientacoesComercial: curadoria.orientacoesComercial,
          },
        });

        if (!registrado) return 'Não foi possível registrar o lead agora. Ofereça o WhatsApp.';
        leadRegistrado = true;

        if (criado && dealId) {
          leadCriado = agendarAIChatLead({
            request,
            ip,
            sessionId: clientSessionId,
            dealId,
            nome,
            celular,
            estado: args.uf ?? undefined,
            attribution: attributionClean,
          });
        }

        // Pesquisa do ofício (Infosimples, só Federal/Estadual com UF) é sempre pelo CPF do TITULAR do crédito: o do
        // próprio contato só quando ele é o titular. Se o contato é advogado/herdeiro/terceiro e o
        // CPF do titular ainda não veio, não consulta o CPF do contato (gastaria crédito com a pessoa errada).
        const contatoEhOutraPessoa = relacao != null && relacao !== 'proprio_titular';
        const cpfParaEnriquecer = contatoEhOutraPessoa ? cpfAlvoTitular : cpfAlvoTitular || cpf;
        if (cpfParaEnriquecer) {
          agendarCpfEEnriquecimento({ sessionId: clientSessionId, cpf: cpfParaEnriquecer, dealId, esfera: args.esfera, uf: args.uf });
        } else if (contatoEhOutraPessoa) {
          console.warn('[api/agente] pesquisa do ofício não disparada: contato não é o titular e o CPF do titular não foi informado');
        }

        // DISPARO DO PRIMEIRO CONTATO VIA WHATSAPP API
        const waResult = await enviarPrimeiroContatoWhatsApp({
          sessionId: clientSessionId,
          dealId: dealId ?? undefined,
          nome,
          celular,
          esfera: args.esfera,
          uf: args.uf,
          municipio: args.municipio,
          papel: relacao,
          nomeTitular: args.nome_titular,
        });

        after(async () => {
          try {
            // 1. Dossiê executivo completo com banners e qualificação na timeline do Bitrix
            const dossie = formatarDossieCardBitrix({
              nome,
              celular,
              cpf,
              sessionId: clientSessionId,
              curadoria: {
                rank: curadoria.rank,
                status: curadoria.status,
                tipo: args.esfera,
                relacaoTitular: relacao,
                vinculoTitular: args.vinculo_titular,
                nomeTitular: args.nome_titular,
                cpfTitular: cpfAlvoTitular,
                celularTitular,
                faseProcesso: curadoria.faseProcesso,
                situacaoExpedicao: args.situacao_expedicao,
                temProcesso: curadoria.temProcesso,
                numeroProcesso: args.numero_processo,
                municipio: args.municipio,
                valorAproximado: args.valor_aproximado,
                melhorHorarioContato: args.melhor_horario_contato,
                melhorDiaContato: args.melhor_dia_contato,
                parecer: curadoria.parecerCuradoria,
                orientacoesComercial: curadoria.orientacoesComercial,
              },
              attr: attributionClean,
              variante: 'chat',
              contatoRealizado: waResult.sucesso,
            });
            await registrarCuradoriaComment({ sessionId: clientSessionId, comment: dossie });

            // 2. Registro das respostas declaradas
            await registrarDeclaracoes({
              sessionId: clientSessionId,
              titulo: 'Informações coletadas pela secretária digital Karen (Roteiro Validado):',
              itens: [
                ['Nome do Interessado', nome],
                ['Telefone / WhatsApp', celular ? formatarCelularBr(celular) : null],
                ['CPF do Interessado', cpf ? 'Sim (gravado)' : 'Não informado'],
                ['Titularidade do Precatório', args.titularidade_opcao === 'meu' ? 'É meu (titular direto)' : 'É de outra pessoa'],
                ['Nome do Titular Originário', args.nome_titular],
                ['CPF do Titular', cpfAlvoTitular ? 'Sim (gravado)' : null],
                ['Vínculo com o Titular', args.vinculo_titular],
                ['Esfera do Precatório', args.esfera ? (ROTULO_TIPO[args.esfera] ?? args.esfera) : null],
                ['UF do processo', args.uf],
                ['Município', args.municipio],
                ['Situação / Expedição', args.situacao_expedicao === 'expedido' ? 'Já foi expedido' : args.situacao_expedicao === 'em_andamento' ? 'Em andamento' : 'Não sabe informar'],
                ['Número do Processo', args.numero_processo],
                ['Valor aproximado', args.valor_aproximado],
                ['Melhor Horário para Contato', args.melhor_horario_contato],
                ['Melhor Dia para Contato', args.melhor_dia_contato],
                ['Rank do Lead', curadoria.rank],
                ['Processo Ativo / Foguinho', curadoria.temProcesso ? '🔥 SIM' : 'NÃO'],
                ['Primeiro contato WhatsApp disparado', waResult.sucesso ? 'Sim (marcado no card)' : 'Simulado / Falha'],
                ['Resumo', redactPii(args.resumo || 'Lead qualificado via Karen')],
              ],
            });
          } catch (error) {
            console.error('[api/agente] falha ao registrar curadoria/declarações no Bitrix:', describeError(error));
          }
        });

        const fogoMsg = curadoria.temProcesso ? ' com foguinho 🔥 de processo ativo' : '';
        return `Lead registrado com sucesso no Bitrix24 (Rank: ${curadoria.rank}${fogoMsg}). Primeiro contato via WhatsApp disparado com sucesso! Responda ao cliente com o texto exato de encerramento institucional:
"Obrigado pelas informações!
Registramos os dados para que nossa equipe possa entender melhor o seu caso e dar continuidade ao atendimento.

Em breve, nossa equipe entrará em contato conforme a disponibilidade informada.

A Premium Office agradece o seu contato!"`;
      } catch (error) {
        console.error('[api/agente] falha ao registrar o lead:', describeError(error));
        return 'Falha ao registrar no CRM. Peça desculpas e ofereça o WhatsApp.';
      }
    },
    {
      name: 'registrar_lead_e_contatar',
      description:
        'Registra o lead curado no Bitrix24 (incluindo foguinho 🔥 caso tenha processo), salva dados de titular/advogado, dispara o primeiro contato via WhatsApp API e marca no card que a pessoa foi contatada.',
      schema: registrarLeadSchema,
    }
  );

  const status = `STATUS: Contato: telefone ${celular ? 'RECEBIDO' : 'não informado'}, CPF ${cpf ? 'RECEBIDO' : 'não informado'}; Titular originário: ${cpfTitular ? 'CPF informado' : 'não informado'}; Lead ${leadRegistrado ? 'JÁ REGISTRADO NO BITRIX E CONTATADO NO WHATSAPP' : 'ainda não registrado'}.`;
  const conversa: BaseMessage[] = [
    new SystemMessage(`${SYSTEM_PROMPT}\n\n${status}`),
    ...history.map((m) => (m.role === 'user' ? new HumanMessage(redactPii(m.content)) : new AIMessage(m.content))),
  ];

  const model = new ChatOpenAI({
    apiKey,
    model: MODEL,
    temperature: 0.4,
    maxTokens: 400,
    timeout: 25_000,
    maxRetries: 1,
  }).bindTools([triarDadosLeadTool, registrarLeadTool]);

  try {
    let resposta = await model.invoke(conversa);
    for (let rodada = 0; rodada < MAX_TOOL_ROUNDS && resposta.tool_calls?.length; rodada++) {
      conversa.push(resposta);
      for (const call of resposta.tool_calls) {
        let resultado = 'Ferramenta desconhecida.';
        try {
          if (call.name === 'triar_dados_lead' || call.name === 'curar_lead') {
            resultado = await triarDadosLeadTool.invoke(call.args as TriarDadosLeadArgs);
          } else if (call.name === 'registrar_lead_e_contatar' || call.name === 'registrar_lead') {
            resultado = await registrarLeadTool.invoke(call.args as RegistrarLeadArgs);
          }
        } catch (toolErr) {
          console.error(`[api/agente] erro ao executar tool ${call.name}:`, describeError(toolErr));
          resultado = `Resultado da ferramenta ${call.name}: ${describeError(toolErr)}`;
        }
        conversa.push(new ToolMessage({ content: String(resultado), tool_call_id: call.id ?? call.name }));
      }
      resposta = await model.invoke(conversa);
    }
    const text = typeof resposta.content === 'string' ? resposta.content.trim() : '';
    if (!text) throw new Error('resposta vazia do agente');

    console.info('[api/agente] resposta:', { model: MODEL, latency_ms: Date.now() - startedAt, lead_registrado: leadRegistrado });
    return NextResponse.json({ text, leadRegistrado, aiChatLead: leadCriado });
  } catch (error) {
    console.error('[api/agente] erro do agente:', { message: describeError(error), latency_ms: Date.now() - startedAt });
    return bad(`Não consegui responder agora. Tente de novo ou fale no WhatsApp ${WA}.`, 502);
  }
}
