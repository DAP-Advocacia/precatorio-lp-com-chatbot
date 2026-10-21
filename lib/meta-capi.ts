// SERVER-ONLY: Conversions API (CAPI) da Meta. Envia o AIChatLead quando o Negócio da sessão
// acaba de ser criado no Bitrix. O navegador dispara o mesmo evento (dataLayer -> GTM -> Pixel)
// com o mesmo event_id, e a Meta deduplica as duas pontas.
// Dados pessoais só saem com hash SHA-256; nunca logar o payload (LGPD).
import { createHash } from 'node:crypto';
import type { Attribution } from '@/lib/bitrix';

export const AI_CHAT_LEAD_EVENT = 'AIChatLead';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || 'v24.0';

export function isMetaCapiConfigured(): boolean {
  return Boolean(process.env.META_PIXEL_ID?.trim() && process.env.META_CAPI_ACCESS_TOKEN?.trim());
}

// Id do lead = ID do Negócio no Bitrix (ex.: aichatlead_5605444). É o ai_chat_lead_id do
// dataLayer (variável já existente no GTM) e o event_id da CAPI: a Meta deduplica as duas
// pontas e o evento é auditável direto no card.
export function aiChatLeadEventId(dealId: number): string {
  return `aichatlead_${dealId}`;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// Normalização da Meta para nome: minúsculas, sem pontuação, UTF-8.
const normalizarNome = (s: string) => s.toLowerCase().replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();

export type AIChatLeadInput = {
  sessionId: string;
  dealId: number;
  nome: string;
  celular: string; // só dígitos, com DDD
  estado?: string; // UF
  attribution: Attribution;
  clientIp: string;
  userAgent: string | null;
  eventSourceUrl: string;
};

export async function enviarAIChatLead(input: AIChatLeadInput): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixelId || !token) return;

  const [primeiro, ...resto] = normalizarNome(input.nome).split(' ');
  const attr = input.attribution;
  const userData: Record<string, unknown> = {
    ph: [sha256(`55${input.celular}`)],
    country: [sha256('br')],
    external_id: [sha256(input.sessionId)],
  };
  if (primeiro) userData.fn = [sha256(primeiro)];
  if (resto.length) userData.ln = [sha256(resto.join(' '))];
  if (input.estado) userData.st = [sha256(input.estado.toLowerCase())];
  if (input.clientIp && input.clientIp !== 'unknown') userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent.slice(0, 500);
  // fbc/fbp vêm dos cookies do Pixel (ou o fbc montado do fbclid em lib/attribution.ts).
  if (attr.fbc && /^fb\.\d\.\d+\./.test(attr.fbc)) userData.fbc = attr.fbc;
  if (attr.fbp && /^fb\.\d\.\d+\./.test(attr.fbp)) userData.fbp = attr.fbp;

  const customData: Record<string, string> = { lead_origem: 'LP-IA' };
  if (attr.utm_source) customData.utm_source = attr.utm_source;
  if (attr.utm_campaign) customData.utm_campaign = attr.utm_campaign;
  if (attr.campaign_id) customData.campaign_id = attr.campaign_id;
  if (attr.adset_id) customData.adset_id = attr.adset_id;
  if (attr.ad_id) customData.ad_id = attr.ad_id;

  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  const body = {
    data: [
      {
        event_name: AI_CHAT_LEAD_EVENT,
        event_time: Math.floor(Date.now() / 1000),
        event_id: aiChatLeadEventId(input.dealId),
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: customData,
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const data: any = await res.json().catch(() => null);
      console.error('[meta-capi] AIChatLead recusado:', res.status, data?.error?.message ?? '', data?.error?.fbtrace_id ?? '');
    }
  } catch (error) {
    console.error('[meta-capi] falha ao enviar AIChatLead:', (error as Error).message);
  }
}
