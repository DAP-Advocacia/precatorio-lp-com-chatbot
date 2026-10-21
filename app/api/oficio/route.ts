import { NextResponse, after } from 'next/server';
import { describeError, getClientIp, isValidClientSessionId, rateLimit } from '@/lib/server';
import { registrarOficio } from '@/lib/bitrix';
import { enriquecerCard } from '@/lib/enriquecimento';
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
export const maxDuration = 120;

const MAX_FILE_BYTES = 4 * 1024 * 1024;
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

  // Nada é guardado antes da validação: só ofícios confirmados seguem para o Bitrix.
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

  if (!result.ok) {
    console.error('[api/oficio] extração falhou:', { model: OFICIO_MODEL, http: result.httpStatus, detail: result.detail });
    return fail('extract_failed', `Não conseguimos ler os dados do arquivo agora. Tente de novo. ${WA_HINT}`);
  }

  const f: OficioFields = result.fields;
  const cpfDigits = f.cpf ? f.cpf.replace(/\D/g, '') : '';
  const cpfValido = isValidCpf(cpfDigits);

  const found = (['credor', 'cpf', 'processo', 'tribunal', 'ente_devedor', 'natureza', 'valor', 'data_base'] as const).filter(
    (k) => (k === 'cpf' ? cpfValido : f[k] !== null)
  );

  console.info('[api/oficio] extração concluída:', {
    model: OFICIO_MODEL,
    mime,
    size_kb: Math.round(file.size / 1024),
    latency_ms: result.latencyMs,
    total_tokens: result.usage.total_tokens,
    cost_usd: estimateCostUsd(result.usage.input_tokens, result.usage.output_tokens),
    is_oficio: f.is_oficio,
    fields_found: found,
  });

  if (!f.is_oficio) {
    return fail(
      'not_oficio',
      `Esse arquivo não parece ser um ofício requisitório. Confira se enviou o documento certo. ${WA_HINT}`
    );
  }

  // Só depois de confirmado como ofício o original e os dados vão para o Negócio da
  // sessão no Bitrix (o consultor precisa do documento). O CPF completo fica só no
  // servidor. Roda após a resposta e uma falha aqui não bloqueia o retorno ao usuário.
  const upload = { name: sanitizeName(file.name || 'oficio', mime), base64: buffer.toString('base64') };
  after(async () => {
    try {
      const { registrado, dealId } = await registrarOficio({
        sessionId: clientSessionId,
        cpf: cpfValido ? cpfDigits : null,
        fields: f,
        file: upload,
      });
      if (!registrado) console.warn('[api/oficio] ofício não anexado: nenhum Negócio para a sessão no Bitrix.');
      // Lemit (cadastro) + Infosimples (andamento e precatórios) com o CPF do ofício, postados
      // no card. Uma vez por sessão (cada chamada gasta crédito).
      else if (cpfValido && dealId) await enriquecerCard({ sessionId: clientSessionId, cpf: cpfDigits, dealId });
    } catch (error) {
      console.error('[api/oficio] falha ao enviar o ofício ao Bitrix:', describeError(error));
    }
  });

  return NextResponse.json({
    ok: true,
    extracted: {
      tipo: f.tipo,
      esfera: f.esfera,
      tribunalSigla: f.tribunal_sigla,
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
