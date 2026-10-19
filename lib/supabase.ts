// SERVER-ONLY: este módulo usa SUPABASE_SECRET_KEY (service role) e nunca pode ser
// importado por componentes client. O pacote 'server-only' não está instalado neste
// projeto; se for adicionado, incluir `import 'server-only';` no topo deste arquivo.
import { createHmac } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdmin() só pode ser usado no servidor.');
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecretKey) {
    const missing = [!supabaseUrl && 'SUPABASE_URL', !supabaseSecretKey && 'SUPABASE_SECRET_KEY']
      .filter(Boolean)
      .join(', ');
    throw new Error(`Supabase não configurado: variável(is) de ambiente ausente(s): ${missing}.`);
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

// ---------------------------------------------------------------------------
// Utilitários de servidor compartilhados pelas rotas públicas da LP.
// ---------------------------------------------------------------------------

export const CLIENT_SESSION_ID_RE = /^lp_[A-Za-z0-9_]{6,80}$/;

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

// HMAC do IP (LGPD): só serve para agrupar abusos/duplicidades. A chave vem de
// IP_HASH_SECRET (env de servidor); sem ela não gravamos nada, porque um hash com
// sal fixo no código seria reversível por força bruta (o espaço IPv4 é pequeno).
let warnedNoIpSecret = false;
export function hashIp(ip: string): string | null {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret) {
    if (!warnedNoIpSecret) {
      warnedNoIpSecret = true;
      console.warn('[supabase] IP_HASH_SECRET ausente: ip_hash não será gravado.');
    }
    return null;
  }
  if (!ip || ip === 'unknown') return null;
  return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
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

// ---------------------------------------------------------------------------
// Sessão da LP em chat_sessions (tabela compartilhada com produção).
// ---------------------------------------------------------------------------

export type LpSessionRow = {
  id: string;
  source: string | null;
  resultado: string | null;
  lead_cpf: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
};

const SESSION_COLUMNS =
  'id, source, resultado, lead_cpf, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer';

export async function findLpSession(supabase: SupabaseClient, clientSessionId: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select(SESSION_COLUMNS)
    .eq('client_session_id', clientSessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as LpSessionRow | null) ?? null;
}

// Garante que exista a linha da sessão. Na criação usa source 'home' e
// resultado 'em_andamento'; em sessão existente só preenche resultado se nulo.
export async function ensureLpSession(
  supabase: SupabaseClient,
  clientSessionId: string,
  insertExtras: Record<string, unknown> = {}
): Promise<LpSessionRow> {
  const existing = await findLpSession(supabase, clientSessionId);
  if (existing) {
    if (!existing.resultado) {
      await supabase.from('chat_sessions').update({ resultado: 'em_andamento' }).eq('id', existing.id);
      existing.resultado = 'em_andamento';
    }
    return existing;
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      ...insertExtras,
      client_session_id: clientSessionId,
      source: 'home',
      resultado: 'em_andamento',
      last_activity_at: new Date().toISOString(),
    })
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    // Corrida entre duas requisições criando a mesma sessão: relê a vencedora.
    if ((error as { code?: string }).code === '23505') {
      const again = await findLpSession(supabase, clientSessionId);
      if (again) return again;
    }
    throw error;
  }
  return data as LpSessionRow;
}

export function describeDbError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  return [e?.code, e?.message].filter(Boolean).join(' ').slice(0, 300) || 'erro desconhecido';
}
