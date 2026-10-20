import { NextResponse } from 'next/server';
import { describeError, getClientIp, isValidClientSessionId, rateLimit } from '@/lib/server';
import { isBitrixConfigured, registrarLead, sanitizeAttribution } from '@/lib/bitrix';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BODY_BYTES = 10 * 1024;

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

const RESULTADOS_PERMITIDOS = new Set([
  'em_andamento',
  'lead_qualificado',
  'documentos_enviados',
  'falou_consultor',
  'revisao_solicitada',
]);

type Field = 'nome' | 'celular' | 'estado' | 'clientSessionId' | 'stage' | 'resultado';

function bad(error: string, field?: Field, status = 400) {
  return NextResponse.json({ ok: false, error, ...(field ? { field } : {}) }, { status });
}

function isPresent(v: unknown) {
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
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
  let nome: string | undefined;
  let celular: string | undefined;
  let estado: string | undefined;

  if (isPresent(lead.nome)) {
    const n = typeof lead.nome === 'string' ? lead.nome.trim().replace(/\s+/g, ' ') : '';
    if (n.length < 2 || n.length > 120 || !/^[\p{L}][\p{L}\s'.-]*$/u.test(n)) {
      return bad('Informe um nome válido (somente letras).', 'nome');
    }
    nome = n;
  }

  if (isPresent(lead.celular)) {
    const cel = String(lead.celular).replace(/\D/g, '');
    const ddd = Number(cel.slice(0, 2));
    if (!/^\d{10,11}$/.test(cel) || ddd < 11 || ddd > 99 || (cel.length === 11 && cel[2] !== '9')) {
      return bad('Informe um celular válido com DDD.', 'celular');
    }
    celular = cel;
  }

  if (isPresent(lead.estado)) {
    const uf = typeof lead.estado === 'string' ? lead.estado.trim().toUpperCase() : '';
    if (!UFS.has(uf)) return bad('Selecione um estado (UF) válido.', 'estado');
    estado = uf;
  }

  let etapa: string | undefined;
  if (isPresent(stage)) {
    if (typeof stage !== 'string' || !/^[A-Za-z0-9_.:-]{1,60}$/.test(stage)) return bad('Etapa inválida.', 'stage');
    etapa = stage;
  }

  let novoResultado: string | undefined;
  if (isPresent(resultado)) {
    if (typeof resultado !== 'string' || !RESULTADOS_PERMITIDOS.has(resultado)) {
      return bad('Resultado inválido.', 'resultado');
    }
    novoResultado = resultado;
  }

  if (!isBitrixConfigured()) {
    console.error('[api/lead] BITRIX_WEBHOOK_URL ausente: lead não registrado');
    return bad('Não foi possível registrar seus dados agora. Tente novamente.', undefined, 503);
  }

  const attributionClean = sanitizeAttribution(attribution);

  try {
    await registrarLead({
      sessionId: clientSessionId,
      nome,
      celular,
      estado,
      stage: etapa,
      resultado: novoResultado,
      attribution: attributionClean,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/lead] erro:', describeError(error));
    return bad('Falha ao registrar seus dados. Tente novamente.', undefined, 502);
  }
}
