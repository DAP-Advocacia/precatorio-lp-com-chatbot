// Eventos de conversão. Empurra para window.dataLayer (GTM) e, se existir, gtag/fbq.
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
  | 'video_play';

type Params = Record<string, string | number | boolean | undefined>;

export function track(event: TrackEvent, params: Params = {}) {
  if (typeof window === 'undefined') return;
  try {
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...params });
    if (typeof w.gtag === 'function') w.gtag('event', event, params);
    if (typeof w.fbq === 'function' && event === 'lead_celular') w.fbq('track', 'Lead');
  } catch {}
}
