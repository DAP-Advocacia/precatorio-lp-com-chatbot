// Captura de atribuição de mídia (UTMs, click IDs, referrer) na primeira página
// vista da sessão. Persistida em sessionStorage para sobreviver a navegação interna
// e enviada junto com o lead para as colunas utm_* / referrer de chat_sessions.

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  landing_path?: string;
};

const STORAGE_KEY = 'po_attribution';
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'] as const;

export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) return JSON.parse(existing) as Attribution;
  } catch {}

  const data: Attribution = {};
  try {
    const qs = new URLSearchParams(window.location.search);
    for (const key of PARAMS) {
      const value = qs.get(key);
      if (value) data[key] = value.slice(0, 200);
    }
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
      data.referrer = document.referrer.slice(0, 500);
    }
    data.landing_path = (window.location.pathname + window.location.search).slice(0, 500);
  } catch {}

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
  return data;
}

export function getAttribution(): Attribution {
  return captureAttribution();
}
