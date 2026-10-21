// Captura de atribuição de mídia (UTMs, IDs de campanha/conjunto/anúncio, click IDs, referrer,
// página de entrada) na primeira página vista da sessão. Persistida em sessionStorage para
// sobreviver à navegação interna e enviada junto com o lead para o Bitrix.
//
// Template de URL da Meta esperado (parâmetros dinâmicos):
//   utm_source=meta&utm_medium=paid_social
//   &utm_campaign={{campaign.name}}__cid_{{campaign.id}}
//   &utm_content={{adset.name}}__asid_{{adset.id}}
//   &utm_term={{ad.name}}__aid_{{ad.id}}
//   &utm_campaign_id=..&utm_adgroup_id=..&utm_ad_id=..
//   &utm_network={{site_source_name}}__{{placement}}&utm_placement=..&utm_site_source=..

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_network?: string;
  utm_placement?: string;
  utm_site_source?: string;
  utm_device?: string;
  utm_matchtype?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  gclid?: string;
  fbclid?: string;
  fbp?: string;
  fbc?: string;
  landing_page?: string;
  landing_path?: string;
  referrer?: string;
};

const STORAGE_KEY = 'po_attribution';
const MAX_VALUE = 300;

const TEXT_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_network',
  'utm_placement',
  'utm_site_source',
  'utm_device',
  'utm_matchtype',
  'gclid',
  'fbclid',
] as const;

// Parâmetros (e o sufixo embutido no nome pelo template) de onde sai cada ID numérico.
const ID_SOURCES = [
  { field: 'campaign_id', params: ['campaign_id', 'utm_campaign_id'], suffix: ['utm_campaign', /__cid_(\d+)/] },
  { field: 'adset_id', params: ['adset_id', 'utm_adgroup_id'], suffix: ['utm_content', /__asid_(\d+)/] },
  { field: 'ad_id', params: ['ad_id', 'utm_ad_id'], suffix: ['utm_term', /__aid_(\d+)/] },
] as const;

function readCookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return m ? decodeURIComponent(m[1]).slice(0, MAX_VALUE) : undefined;
  } catch {
    return undefined;
  }
}

function hasCampaignParams(a: Attribution): boolean {
  return Boolean(
    a.utm_source || a.utm_medium || a.utm_campaign || a.gclid || a.fbclid || a.campaign_id || a.adset_id || a.ad_id
  );
}

function parseCurrentUrl(): Attribution {
  const data: Attribution = {};
  const qs = new URLSearchParams(window.location.search);

  for (const key of TEXT_PARAMS) {
    const value = qs.get(key);
    if (value) data[key] = value.trim().slice(0, MAX_VALUE);
  }

  // IDs: parâmetro explícito primeiro; senão o sufixo do nome (lido antes de qualquer truncamento).
  for (const { field, params, suffix } of ID_SOURCES) {
    let id = params.map((p) => qs.get(p)).find((v) => v && /^\d{1,30}$/.test(v.trim()));
    if (!id) id = qs.get(suffix[0])?.match(suffix[1])?.[1];
    if (id) data[field] = id.trim();
  }

  if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
    data.referrer = document.referrer.slice(0, 500);
  }
  data.landing_page = window.location.href.slice(0, 1000);
  data.landing_path = (window.location.pathname + window.location.search).slice(0, 500);

  // Sem cookie _fbc (Pixel ainda não carregou), monta o valor no formato da Meta a partir do fbclid.
  if (data.fbclid && !readCookie('_fbc')) data.fbc = `fb.1.${Date.now()}.${data.fbclid}`;
  return data;
}

function readStored(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  const stored = readStored();

  let current: Attribution = {};
  try {
    current = parseCurrentUrl();
  } catch {}

  // A URL atual traz campanha: ela vale (último clique pago da sessão). Sem campanha na URL,
  // mantém o que já foi capturado, para a navegação interna não apagar a origem.
  const data = hasCampaignParams(current) || !stored ? current : stored;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
  return data;
}

export function getAttribution(): Attribution {
  const data = { ...(readStored() ?? captureAttribution()) };
  // _fbp/_fbc só existem depois que o Pixel carrega: lidos na hora do envio, não na captura.
  if (typeof window !== 'undefined') {
    const fbp = readCookie('_fbp');
    const fbc = readCookie('_fbc');
    if (fbp) data.fbp = fbp;
    if (fbc) data.fbc = fbc;
  }
  return data;
}
