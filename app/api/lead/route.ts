import { NextResponse } from 'next/server';
import {
  describeDbError,
  findLpSession,
  getClientIp,
  getSupabaseAdmin,
  hashIp,
  isValidClientSessionId,
  rateLimit,
} from '@/lib/supabase';
import { isValidCpf } from '@/lib/oficio-extract';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 10 * 1024;

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

// Ordem de avanço do funil. 'abandonado' fica abaixo de tudo para que um retorno do
// usuário reabra a sessão; 'reuniao_agendada' (gravado por outros sistemas) fica acima.
const RESULTADO_RANK: Record<string, number> = {
  abandonado: -1,
  em_andamento: 0,
  lead_qualificado: 1,
  documentos_enviados: 2,
  falou_consultor: 2,
  revisao_solicitada: 2,
  reuniao_agendada: 3,
};
const RESULTADOS_PERMITIDOS = new Set([
  'em_andamento',
  'lead_qualificado',
  'documentos_enviados',
  'falou_consultor',
  'revisao_solicitada',
]);

type Field = 'nome' | 'celular' | 'estado' | 'cpf' | 'clientSessionId' | 'stage' | 'resultado';

function bad(error: string, field?: Field, status = 400) {
  return NextResponse.json({ ok: false, error, ...(field ? { field } : {}) }, { status });
}

function isPresent(v: unknown) {
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
}

function cleanAttr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s || null;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`lead:${ip}`, 30, 5 * 60_000)) {
    return bad('Muitas tentativas. Aguarde alguns minutos e tente de novo.', undefined, 429);
  }

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return bad('Requisição muito grande.', undefined, 413);

  let body: any;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return bad('Requisição muito grande.', undefined, 413);
    body = JSON.parse(raw);
  } catch {
    return bad('JSON inválido.');
  }
  if (!body || typeof body !== 'object') return bad('JSON inválido.');

  const { clientSessionId, stage, resultado, attribution } = body;
  const lead = body.lead && typeof body.lead === 'object' ? body.lead : {};

  if (!isValidClientSessionId(clientSessionId)) return bad('Sessão inválida.', 'clientSessionId');

  // ---- Validação dos campos do lead (só os enviados) ----
  const updates: Record<string, unknown> = {};
  let estado: string | null = null;

  if (isPresent(lead.nome)) {
    const nome = typeof lead.nome === 'string' ? lead.nome.trim().replace(/\s+/g, ' ') : '';
    if (nome.length < 2 || nome.length > 120 || !/^[\p{L}][\p{L}\s'.-]*$/u.test(nome)) {
      return bad('Informe um nome válido (somente letras).', 'nome');
    }
    updates.lead_nome = nome;
  }

  if (isPresent(lead.celular)) {
    const cel = String(lead.celular).replace(/\D/g, '');
    const ddd = Number(cel.slice(0, 2));
    if (!/^\d{10,11}$/.test(cel) || ddd < 11 || ddd > 99 || (cel.length === 11 && cel[2] !== '9')) {
      return bad('Informe um celular válido com DDD.', 'celular');
    }
    updates.lead_telefone = cel;
  }

  if (isPresent(lead.estado)) {
    const uf = typeof lead.estado === 'string' ? lead.estado.trim().toUpperCase() : '';
    if (!UFS.has(uf)) return bad('Selecione um estado (UF) válido.', 'estado');
    estado = uf;
  }

  if (isPresent(lead.cpf)) {
    const cpf = String(lead.cpf).replace(/\D/g, '');
    if (!isValidCpf(cpf)) return bad('CPF inválido. Confira os números.', 'cpf');
    updates.lead_cpf = cpf;
  }

  if (isPresent(stage)) {
    if (typeof stage !== 'string' || !/^[A-Za-z0-9_.:-]{1,60}$/.test(stage)) return bad('Etapa inválida.', 'stage');
    updates.stage_final = stage;
  }

  let novoResultado: string | null = null;
  if (isPresent(resultado)) {
    if (typeof resultado !== 'string' || !RESULTADOS_PERMITIDOS.has(resultado)) {
      return bad('Resultado inválido.', 'resultado');
    }
    novoResultado = resultado;
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;
  const now = new Date().toISOString();

  try {
    const supabase = getSupabaseAdmin();

    const attr = attribution && typeof attribution === 'object' ? attribution : {};
    const attrCols: Record<string, string | null> = {
      utm_source: cleanAttr(attr.utm_source, 200),
      utm_medium: cleanAttr(attr.utm_medium, 200),
      utm_campaign: cleanAttr(attr.utm_campaign, 200),
      utm_content: cleanAttr(attr.utm_content, 200),
      utm_term: cleanAttr(attr.utm_term, 200),
      referrer: cleanAttr(attr.referrer, 500),
    };

    let sessionId: string | null = null;
    let existing = await findLpSession(supabase, clientSessionId);

    if (!existing) {
      const insertRow: Record<string, unknown> = {
        client_session_id: clientSessionId,
        source: 'home',
        resultado: novoResultado ?? 'em_andamento',
        user_agent: userAgent,
        ip_hash: hashIp(ip),
        last_activity_at: now,
        ...updates,
      };
      for (const [k, v] of Object.entries(attrCols)) if (v) insertRow[k] = v;

      const { data, error } = await supabase.from('chat_sessions').insert(insertRow).select('id').single();
      if (!error) {
        sessionId = data.id as string;
      } else if ((error as { code?: string }).code === '23505') {
        // Corrida com outra requisição que criou a sessão: segue como update.
        existing = await findLpSession(supabase, clientSessionId);
        if (!existing) throw error;
      } else {
        throw error;
      }
    }

    if (!sessionId && existing) {
      if (existing.source !== 'home') {
        // Nunca altera sessões de outros sistemas (ex.: widget 'embed') na tabela compartilhada.
        return bad('Sessão inválida.', 'clientSessionId');
      }
      const patch: Record<string, unknown> = {
        ...updates,
        user_agent: userAgent,
        last_activity_at: now,
      };
      const ipHash = hashIp(ip);
      if (ipHash) patch.ip_hash = ipHash;
      // Atribuição é first-touch: só preenche colunas ainda vazias.
      for (const [k, v] of Object.entries(attrCols)) {
        if (v && !existing[k as keyof typeof existing]) patch[k] = v;
      }
      if (novoResultado) {
        // Nunca rebaixa o funil (ex.: documentos_enviados -> em_andamento).
        const rankAtual = existing.resultado ? RESULTADO_RANK[existing.resultado] ?? 0 : -2;
        if (RESULTADO_RANK[novoResultado] >= rankAtual) patch.resultado = novoResultado;
      } else if (!existing.resultado) {
        patch.resultado = 'em_andamento';
      }

      const { error } = await supabase.from('chat_sessions').update(patch).eq('id', existing.id);
      if (error) throw error;
      sessionId = existing.id;
    }

    // Estado (UF) do processo não tem coluna dedicada em chat_sessions. Fica registrado
    // como mensagem de sistema (kind 'card') no histórico da sessão, e NÃO em
    // integration_events: nenhuma integração externa acontece aqui e o painel de
    // integrações não pode mostrar chamadas que não existiram.
    if (estado && sessionId) {
      const { data: ultimo, error: readError } = await supabase
        .from('chat_messages')
        .select('metadata')
        .eq('session_id', sessionId)
        .eq('role', 'system')
        .eq('kind', 'card')
        .eq('metadata->>tipo', 'lead_estado')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (readError) console.error('[api/lead] falha ao ler estado anterior:', describeDbError(readError));
      const estadoAnterior = (ultimo?.metadata as { estado?: string } | null)?.estado ?? null;
      if (!readError && estadoAnterior !== estado) {
        const { error: msgError } = await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'system',
          kind: 'card',
          content: `Estado do processo informado: ${estado}`,
          metadata: { tipo: 'lead_estado', estado },
        });
        if (msgError) console.error('[api/lead] falha ao registrar estado:', describeDbError(msgError));
      }
    }

    // PENDÊNCIA: enriquecimento via API própria (CPF/Nome/Estado) ainda não integrado.
    // Quando os detalhes da API (URL, auth, formato) forem definidos, chamar aqui e
    // registrar em integration_events SOMENTE as chamadas externas que de fato ocorrerem.

    // Bitrix: este protótipo NÃO grava em bitrix_retry_queue. O projeto irmão
    // (Premium Office/precatorio-lp) já possui o processador real dessa fila
    // (lib/bitrixLead.ts) consumindo o mesmo Supabase — gravar aqui duplicaria
    // criação de card/lead em produção a partir de um ambiente de protótipo.
    // (Não logar o payload: contém nome, CPF e telefone — LGPD.)

    return NextResponse.json({ ok: true, sessionId });
  } catch (error) {
    console.error('[api/lead] erro:', describeDbError(error));
    return NextResponse.json({ ok: false, error: 'Falha ao registrar seus dados. Tente novamente.' }, { status: 500 });
  }
}
