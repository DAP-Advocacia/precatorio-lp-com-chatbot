// SERVER-ONLY: utilitários compartilhados pelas rotas públicas da LP.
// Não importar em componentes client.
import { WA_NUMBER } from '@/lib/whatsapp';

const CLIENT_SESSION_ID_RE = /^lp_[A-Za-z0-9_]{6,80}$/;

export function isValidClientSessionId(value: unknown): value is string {
  return typeof value === 'string' && CLIENT_SESSION_ID_RE.test(value);
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

// Remove CPF/telefone digitados por engano antes de enviar ao LLM ou gravar em qualquer lugar.
// Aceita espaços, pontos e hífens entre os grupos (comum em quem digita no celular).
// O WhatsApp da própria empresa nunca é omitido: é o principal CTA das respostas.
export const PII_OMITIDO = '[dado omitido]';
// Limites: não pode estar colado a outro dígito (nem a "dígito + separador"), para não
// cortar pedaços de números de processo (ex.: 0001234-56.2020.4.01.3400).
const CPF_RE = /(?<!\d|\d[.\-\/])\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.\-]?\d{2}(?!\d|[.\-\/]\d)/g;
const PHONE_RE =
  /(?<!\d|\d[.\-\/])(?:\+?55[\s.\-]?)?(?:\(?\d{2}\)?[\s.\-]?9?\d{4}|9\d{4})[\s.\-]?\d{4}(?!\d|[.\-\/]\d)/g;

function isCompanyNumber(match: string) {
  const digits = match.replace(/\D/g, '');
  return digits.length >= 9 && WA_NUMBER.endsWith(digits);
}

export function redactPii(text: string) {
  const replacer = (m: string) => (isCompanyNumber(m) ? m : PII_OMITIDO);
  return text.replace(CPF_RE, replacer).replace(PHONE_RE, replacer);
}

// Rate limit em memória (janela deslizante). Vale por instância da função: é uma
// barreira contra abuso casual, não substitui o Vercel Firewall/WAF.
const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, hits] of buckets) {
      if (!hits.length || now - hits[hits.length - 1] > 15 * 60_000) buckets.delete(k);
    }
  }
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function describeError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  return [e?.code, e?.message].filter(Boolean).join(' ').slice(0, 300) || 'erro desconhecido';
}
