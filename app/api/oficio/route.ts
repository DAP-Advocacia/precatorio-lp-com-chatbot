import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  describeDbError,
  ensureLpSession,
  getClientIp,
  getSupabaseAdmin,
  hashIp,
  isValidClientSessionId,
  rateLimit,
} from '@/lib/supabase';
import {
  detectMime,
  estimateCostUsd,
  extractOficio,
  isValidCpf,
  maskCpf,
  OFICIO_MODEL,
  type OficioFields,
} from '@/lib/oficio-extract';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const BUCKET = 'lp-oficios';
const WA_HINT = 'Se preferir, envie pelo WhatsApp (21) 98645-0262.';

type Reason = 'too_large' | 'unsupported_type' | 'not_oficio' | 'extract_failed' | 'rate_limited' | 'bad_request';

const STATUS: Record<Reason, number> = {
  too_large: 413,
  unsupported_type: 415,
  not_oficio: 422,
  extract_failed: 502,
  rate_limited: 429,
  bad_request: 400,
};

function fail(reason: Reason, message: string, status = STATUS[reason]) {
  return NextResponse.json({ ok: false, reason, message }, { status });
}

const EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

function sanitizeName(name: string, mime: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `${base || 'oficio'}.${EXT[mime] ?? 'bin'}`;
}

// Bucket privado provisionado sob demanda (service role): se ainda não existir no
// projeto Supabase, é criado na primeira gravação, privado e restrito a 4 MB/tipos aceitos.
let bucketReady = false;
async function ensureBucket(supabase: SupabaseClient) {
  if (bucketReady) return;
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (data && !error) {
    bucketReady = true;
    return;
  }
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_BYTES,
    allowedMimeTypes: Object.keys(EXT),
  });
  // Corrida com outra instância que criou o bucket ao mesmo tempo: segue normalmente.
  if (createError && !/already exists|duplicate/i.test(createError.message || '')) throw createError;
  bucketReady = true;
}

async function storeOficio(supabase: SupabaseClient, path: string, buffer: Buffer, mime: string): Promise<string | null> {
  try {
    await ensureBucket(supabase);
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: false });
    if (error) throw error;
    return path;
  } catch (error) {
    bucketReady = false;
    console.error('[api/oficio] falha ao guardar o arquivo:', describeDbError(error));
    return null;
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`oficio:ip:${ip}`, 8, 10 * 60_000)) {
    return fail('rate_limited', `Muitos envios em pouco tempo. Aguarde alguns minutos. ${WA_HINT}`);
  }

  // Corpo multipart: 4 MB do arquivo + folga para os campos.
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_FILE_BYTES + 256 * 1024) {
    return fail('too_large', `O arquivo passa de 4 MB. Envie uma foto ou PDF menor. ${WA_HINT}`);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('bad_request', 'Não foi possível ler o envio. Tente novamente.');
  }

  const file = form.get('file');
  const clientSessionId = form.get('clientSessionId');
  if (!isValidClientSessionId(clientSessionId)) return fail('bad_request', 'Sessão inválida. Recarregue a página.');
  if (!file || typeof file === 'string') return fail('bad_request', 'Nenhum arquivo recebido.');
  if (file.size === 0) return fail('bad_request', 'O arquivo está vazio.');
  if (file.size > MAX_FILE_BYTES) {
    return fail('too_large', `O arquivo passa de 4 MB. Envie uma foto ou PDF menor. ${WA_HINT}`);
  }

  if (!rateLimit(`oficio:sess:${clientSessionId}`, 5, 10 * 60_000)) {
    return fail('rate_limited', `Você já enviou vários arquivos agora. Aguarde alguns minutos. ${WA_HINT}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectMime(buffer);
  if (!mime) {
    return fail('unsupported_type', `Formato não aceito. Envie PDF, JPG, PNG ou WEBP. ${WA_HINT}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  let supabase: SupabaseClient;
  let sessionId: string;
  let sessionCpf: string | null;
  try {
    supabase = getSupabaseAdmin();
    const session = await ensureLpSession(supabase, clientSessionId, {
      user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
      ip_hash: hashIp(ip),
    });
    if (session.source !== 'home') return fail('bad_request', 'Sessão inválida. Recarregue a página.');
    sessionId = session.id;
    sessionCpf = session.lead_cpf;
  } catch (error) {
    console.error('[api/oficio] falha ao preparar sessão:', describeDbError(error));
    return fail('extract_failed', `Não conseguimos receber o arquivo agora. Tente de novo. ${WA_HINT}`, 500);
  }

  // Nada é guardado antes da validação: só ofícios confirmados vão para o bucket.
  // Documentos rejeitados (RG, CNH, extratos, HEIC ilegível, falhas de leitura) não
  // ficam armazenados (LGPD).
  if (mime === 'image/heic') {
    return fail(
      'unsupported_type',
      `Não conseguimos ler fotos no formato HEIC (padrão do iPhone). Envie em JPG ou PDF, ou mande pelo WhatsApp (21) 98645-0262.`
    );
  }

  if (!apiKey) {
    console.error('[api/oficio] OPENAI_API_KEY ausente');
    return fail('extract_failed', `A leitura automática está indisponível agora. ${WA_HINT}`, 500);
  }

  const result = await extractOficio({ apiKey, buffer, mime, filename: file.name || 'oficio.pdf' });
  const baseSummary = { model: OFICIO_MODEL, mime, size_kb: Math.round(file.size / 1024) };

  const logEvent = async (row: Record<string, unknown>) => {
    const { error } = await supabase.from('integration_events').insert({
      session_id: sessionId,
      service: 'openai',
      operation: 'oficio.extract',
      latency_ms: result.latencyMs,
      request_summary: baseSummary,
      ...row,
    });
    if (error) console.error('[api/oficio] falha ao registrar evento:', describeDbError(error));
  };

  if (!result.ok) {
    await logEvent({
      status: 'error',
      http_status: result.httpStatus,
      error_message: result.detail,
    });
    return fail('extract_failed', `Não conseguimos ler os dados do arquivo agora. Tente de novo. ${WA_HINT}`);
  }

  const f: OficioFields = result.fields;
  const cpfDigits = f.cpf ? f.cpf.replace(/\D/g, '') : '';
  const cpfValido = isValidCpf(cpfDigits);

  const found = (['credor', 'cpf', 'processo', 'tribunal', 'ente_devedor', 'natureza', 'valor', 'data_base'] as const).filter(
    (k) => (k === 'cpf' ? cpfValido : f[k] !== null)
  );

  // Guarda o original (bucket privado) só depois de confirmado como ofício: o consultor
  // precisa do documento. Falha de storage não bloqueia o retorno dos dados extraídos.
  const storagePath = f.is_oficio
    ? await storeOficio(supabase, `${clientSessionId}/${Date.now()}-${sanitizeName(file.name || 'oficio', mime)}`, buffer, mime)
    : null;

  await logEvent({
    status: 'success',
    http_status: 200,
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
    total_tokens: result.usage.total_tokens,
    cost_usd: estimateCostUsd(result.usage.input_tokens, result.usage.output_tokens),
    request_summary: { ...baseSummary, storage_path: storagePath },
    response_summary: { is_oficio: f.is_oficio, tipo: f.tipo, fields_found: found, stored: Boolean(storagePath) },
  });

  if (!f.is_oficio) {
    return fail(
      'not_oficio',
      `Esse arquivo não parece ser um ofício requisitório. Confira se enviou o documento certo. ${WA_HINT}`
    );
  }

  // CPF completo fica só no servidor; preenche lead_cpf apenas se ainda vazio.
  if (cpfValido && !sessionCpf) {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ lead_cpf: cpfDigits })
      .eq('id', sessionId)
      .is('lead_cpf', null);
    if (error) console.error('[api/oficio] falha ao salvar CPF:', describeDbError(error));
  }

  return NextResponse.json({
    ok: true,
    extracted: {
      tipo: f.tipo,
      credor: f.credor,
      cpf: cpfValido ? maskCpf(cpfDigits) : null,
      processo: f.processo,
      tribunal: f.tribunal,
      enteDevedor: f.ente_devedor,
      natureza: f.natureza,
      valor: f.valor,
      dataBase: f.data_base,
    },
  });
}
