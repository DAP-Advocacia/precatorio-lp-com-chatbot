// Eventos de conversão. Empurra para window.dataLayer (GTM) e, se existir, gtag.
// O Pixel da Meta é disparado pelo GTM a partir do dataLayer (ex.: ai_chat_lead com ai_chat_lead_id).
// Sem GTM configurado, as chamadas são inofensivas. Nunca enviar PII (nome, CPF, celular).

export type TrackEvent =
  | 'cta_click'
  | 'chat_start'
  | 'lead_nome'
  | 'lead_celular'
  | 'lead_estado'
  | 'oficio_upload'
  | 'oficio_extraido'
  | 'oficio_falha'
  | 'dados_confirmados'
  | 'whatsapp_click'
  | 'video_play'
  // Teste A/B: variante vista, mensagens da secretária digital e etapas do formulário.
  | 'ab_variante'
  | 'agente_mensagem'
  | 'form_etapa'
  | 'form_concluido'
  // Lead criado no Bitrix (trigger já existente no GTM). O ai_chat_lead_id (aichatlead_<dealId>)
  // é o event_id do AIChatLead que o servidor envia pela CAPI.
  | 'ai_chat_lead';

type Params = Record<string, string | number | boolean | undefined>;

export function track(event: TrackEvent, params: Params = {}) {
  if (typeof window === 'undefined') return;
  try {
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...params });
    if (typeof w.gtag === 'function') w.gtag('event', event, params);
  } catch {}
}
