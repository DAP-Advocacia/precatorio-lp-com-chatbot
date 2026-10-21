// SERVER-ONLY: integração direta com o Bitrix24 via webhook de entrada. É o único
// destino dos dados captados na LP: não há banco próprio. O vínculo sessão -> negócio
// fica no próprio Bitrix (ORIGINATOR_ID + ORIGIN_ID do Deal).
// Nunca logar payloads: contêm nome, CPF e telefone (LGPD).
import { protocoloFromSession } from '@/lib/whatsapp';
import type { OficioFields } from '@/lib/oficio-extract';
import { VARIANTE_ROTULO, type Variante } from '@/lib/variante';
import { triarLead, type ConversaMsg, type OficioSnapshot, type Triagem } from '@/lib/triagem';

// Pipeline "[LP] PREMIUM OFFICE v2", etapa "LP — Novo Lead" (etapa de sistema; não é a
// primeira por ordenação, por isso precisa ser explícita). Sobrescrevíveis por env.
const DEAL_CATEGORY_ID = Number(process.env.BITRIX_DEAL_CATEGORY_ID) || 534;
const DEAL_STAGE_ID = process.env.BITRIX_DEAL_STAGE_ID || 'C534:NEW';
// Uma automação do pipeline descarta deals sem responsável: precisa de ASSIGNED_BY_ID.
const DEAL_ASSIGNED_BY_ID = Number(process.env.BITRIX_ASSIGNED_BY_ID) || 178968;

const ORIGINATOR_ID = 'lp-chatbot';

// Campos customizados do CRM (IDs confirmados via bitrix24_list_fields; não inferir).
const CONTACT_UF_CPF = 'UF_CRM_CPF';
const CONTACT_UF_CPF_CNPJ = 'UF_CRM_1703187558515';
const CONTACT_UF_CPF_ALT = 'UF_CRM_1731681995';
const DEAL_UF_CPF = 'UF_CRM_CONSULT_CPF';
const DEAL_UF_CPF_CLIENTE = 'UF_CRM_1703254224613';
const DEAL_UF_CPF_BOT = 'UF_CRM_1728573121';
const DEAL_UF_NUMERO_PROCESSO = 'UF_CRM_1705005770426';
const DEAL_UF_NOME_CLIENTE = 'UF_CRM_1703254259078';
const DEAL_UF_ESTADO = 'UF_CRM_1702986393274'; // [+] Estado (enum)
const DEAL_UF_MKT_ESTADO = 'UF_CRM_1767120845991'; // [MKT] Estado (string)
const DEAL_UF_TIPO_PRECATORIO = 'UF_CRM_1756758368';
const DEAL_UF_TRIBUNAL_FEDERAL = 'UF_CRM_1767021573716';
const DEAL_UF_TRIBUNAL_ESTADUAL = 'UF_CRM_1767037264990';
const DEAL_UF_LP_PRECATORIOS = 'UF_CRM_1772054165226'; // enum múltiplo
const DEAL_UF_OFICIO_ARQUIVO = 'UF_CRM_1763026532088'; // [P] Ofício Precatório (arquivo, múltiplo)
const DEAL_UF_TIPO_PROCESSO = 'UF_CRM_1746816651'; // [S] Tipo de processo
const DEAL_TIPO_PROCESSO_TRABALHISTA_ID = '3812';
const DEAL_UF_MKT_ORIGEM_LEAD = 'UF_CRM_1787687488497';
const DEAL_ORIGEM_LEAD_LPIA_ID = '9387'; // LP-IA
const DEAL_UF_MKT_FUNIL_ORIGEM = 'UF_CRM_1779394786511';
const DEAL_FUNIL_PREMIUM_OFFICE_ID = '8812'; // LP PREMIUM OFFICE
const DEAL_UF_TELEFONE = 'UF_CRM_1703003118139'; // [+] Telefone
const DEAL_UF_AUTORIZA_WA = 'UF_CRM_AUTORIZA_WA'; // listado como ufCrmAutorizaWa; o REST clássico usa UPPER_SNAKE
const DEAL_AUTORIZA_WA_SIM_ID = '9207';
const DEAL_AUTORIZA_WA_NAO_ID = '9208';
const DEAL_UF_DE_ONDE_VEIO = 'UF_CRM_1767974630587'; // [S] De onde veio o Lead?
const DEAL_DE_ONDE_VEIO_IDS = { ia: '6212', facebook: '6214', instagram: '6216', outros: '6218' } as const;
const DEAL_UF_TIPO_TRAFEGO = 'UF_CRM_1761655904'; // [MKT] Tipo de Tráfego
const DEAL_TRAFEGO_PAGO_ID = '5428';
const DEAL_TRAFEGO_ORGANICO_ID = '5430';
const DEAL_UF_TEM_DOCUMENTOS = 'UF_CRM_1772737471562'; // [LP] TEM DOCUMENTOS?
const DEAL_UF_TEM_PROCESSO = 'UF_CRM_1772737103535'; // [LP] TEM PROCESSO OU NOTIFICAÇÃO?
const SIM_NAO_IDS = { documentos: { sim: '7548', nao: '7550' }, processo: { sim: '7544', nao: '7546' } } as const;
const DEAL_UF_MELHOR_CONTATO = 'UF_CRM_1771854052492'; // [LP] Melhor forma de contato
const DEAL_UF_VALOR_DESEJADO = 'UF_CRM_1736172629'; // [P] VALOR DESEJADO PELO CLIENTE
const DEAL_UF_PF_OU_EMPRESA = 'UF_CRM_1750089776'; // [+] PESSOA FISICA OU EMPRESA?
const DEAL_PESSOA_FISICA_ID = '4206';
const DEAL_UF_RANK_LEAD = 'UF_CRM_1767020776832'; // [MKT] RANK LEAD
const RANK_LEAD_IDS: Record<string, string> = { 'A+': '8798', A: '8800', B: '8802', C: '8804', D: '8806', E: '8808' };

const ESTADO_ENUM_IDS: Record<string, string> = {
  AC: '105', AL: '107', AM: '109', AP: '111', BA: '113', CE: '115', DF: '117',
  ES: '119', GO: '121', MA: '123', MG: '125', MS: '127', MT: '129', PA: '131',
  PB: '133', PE: '135', PI: '137', PR: '139', RJ: '141', RN: '143', RO: '145',
  RR: '147', RS: '149', SC: '151', SE: '153', SP: '155', TO: '157',
};

// Sigla do tribunal (normalizada pela IA) -> IDs de enumeração do Bitrix.
const TIPO_PRECATORIO_IDS = { federal: '4648', municipal: '4650', estadual: '4652' } as const;
const TRIBUNAL_FEDERAL_IDS: Record<string, string> = {
  TRF1: '5960', TRF2: '5954', TRF3: '5956', TRF4: '5962', TRF5: '5958', TRF6: '5966',
};
const TRIBUNAL_FEDERAL_OUTROS_ID = '5964';
const TRIBUNAL_ESTADUAL_IDS: Record<string, string> = {
  TJAC: '6022', TJAL: '6024', TJAP: '6026', TJAM: '6028', TJBA: '6030', TJCE: '6032',
  TJES: '6034', TJGO: '6036', TJMA: '6038', TJMT: '6040', TJMS: '6042', TJMG: '6044',
  TJPA: '6046', TJPB: '6048', TJPR: '6050', TJPE: '6052', TJPI: '6054', TJRJ: '6056',
  TJRN: '6058', TJRS: '6060', TJRO: '6062', TJRR: '6064', TJSC: '6066', TJSP: '6068',
  TJSE: '6070', TJTO: '6072', TJDFT: '6074',
};
const TRIBUNAL_ESTADUAL_OUTRO_ID = '6076';
// [LP] PRECATÓRIOS só tem opções para estes tribunais.
const LP_PRECATORIOS_IDS: Record<string, string> = {
  TRF1: '7496', TRF2: '7498', TRF3: '7500', TRF4: '7502', TRF5: '7504', TRF6: '7506',
  TJRJ: '7508', TJSP: '7510', TJAL: '7512', TJPE: '7514', TJPA: '7516', TJMT: '7518',
  TJMS: '7520', TJES: '7522',
};

function tribunalToFields(f: Pick<OficioFields, 'esfera' | 'tribunal_sigla'>): Record<string, unknown> {
  const sigla = f.tribunal_sigla;
  // Esfera pela leitura da IA; na dúvida, deduz do tribunal (TRF = federal, TJ = estadual).
  let esfera = f.esfera;
  if (esfera === 'desconhecida' && sigla) {
    if (sigla.startsWith('TRF')) esfera = 'federal';
    else if (sigla.startsWith('TJ')) esfera = 'estadual';
  }
  if (esfera === 'desconhecida') return {};

  const out: Record<string, unknown> = { [DEAL_UF_TIPO_PRECATORIO]: TIPO_PRECATORIO_IDS[esfera] };
  if (esfera === 'federal') {
    out[DEAL_UF_TRIBUNAL_FEDERAL] = (sigla && TRIBUNAL_FEDERAL_IDS[sigla]) || (sigla ? TRIBUNAL_FEDERAL_OUTROS_ID : undefined);
  } else if (esfera === 'estadual') {
    out[DEAL_UF_TRIBUNAL_ESTADUAL] = (sigla && TRIBUNAL_ESTADUAL_IDS[sigla]) || (sigla ? TRIBUNAL_ESTADUAL_OUTRO_ID : undefined);
  }
  if (sigla && LP_PRECATORIOS_IDS[sigla]) out[DEAL_UF_LP_PRECATORIOS] = [LP_PRECATORIOS_IDS[sigla]];
  if (sigla?.startsWith('TRT')) out[DEAL_UF_TIPO_PROCESSO] = DEAL_TIPO_PROCESSO_TRABALHISTA_ID;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

const ATTRIBUTION_KEYS = [
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
  'campaign_id',
  'adset_id',
  'ad_id',
  'gclid',
  'fbclid',
  'fbp',
  'fbc',
  'landing_page',
  'landing_path',
  'referrer',
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string | null>>;

const ATTRIBUTION_MAX: Partial<Record<(typeof ATTRIBUTION_KEYS)[number], number>> = {
  landing_page: 1000,
  landing_path: 500,
  referrer: 500,
};
const ATTRIBUTION_ID_KEYS = new Set(['campaign_id', 'adset_id', 'ad_id']);

// Valida o objeto vindo do navegador: só chaves conhecidas, texto sem controle/HTML, IDs numéricos.
export function sanitizeAttribution(raw: unknown): Attribution {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const v = src[key];
    if (typeof v !== 'string') continue;
    const s = sanitizeText(v, ATTRIBUTION_MAX[key] ?? 300);
    if (!s) continue;
    if (ATTRIBUTION_ID_KEYS.has(key) && !/^\d{1,30}$/.test(s)) continue;
    out[key] = s;
  }
  return out;
}

type DealRef = { dealId: number; contactId: number | null };

export function isBitrixConfigured(): boolean {
  return Boolean(process.env.BITRIX_WEBHOOK_URL);
}

async function bitrixCall<T = any>(method: string, payload: object): Promise<T> {
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('BITRIX_WEBHOOK_URL não configurada');
  const res = await fetch(`${webhookUrl.replace(/\/$/, '')}/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok || !data || data.error) {
    throw new Error(data?.error_description || data?.error || `Falha ao chamar ${method} no Bitrix (HTTP ${res.status})`);
  }
  return data.result as T;
}

function sanitizeText(value: string, max = 200): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max);
}

// Serializa as operações da mesma sessão dentro da instância, para que persistências
// disparadas em sequência rápida (nome -> celular -> estado) não criem deals em
// duplicidade. Não protege entre instâncias diferentes da função.
const sessionQueues = new Map<string, Promise<unknown>>();
function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const prev = sessionQueues.get(sessionId) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  sessionQueues.set(sessionId, tail);
  void tail.then(() => {
    if (sessionQueues.get(sessionId) === tail) sessionQueues.delete(sessionId);
  });
  return run;
}

const dealCache = new Map<string, DealRef>();

async function findDeal(sessionId: string): Promise<DealRef | null> {
  const cached = dealCache.get(sessionId);
  if (cached) return cached;
  const deals = await bitrixCall<{ ID: string; CONTACT_ID: string | null }[]>('crm.deal.list', {
    filter: { ORIGINATOR_ID, ORIGIN_ID: sessionId, CATEGORY_ID: DEAL_CATEGORY_ID },
    select: ['ID', 'CONTACT_ID'],
    order: { ID: 'DESC' },
  });
  if (!Array.isArray(deals) || deals.length === 0) return null;
  const ref = { dealId: Number(deals[0].ID), contactId: deals[0].CONTACT_ID ? Number(deals[0].CONTACT_ID) : null };
  dealCache.set(sessionId, ref);
  return ref;
}

// Campos UTM padrão do Bitrix: valem para Contato e Negócio.
function attributionFields(attr: Attribution): Record<string, string> {
  const out: Record<string, string> = {};
  if (attr.utm_source) out.UTM_SOURCE = attr.utm_source;
  if (attr.utm_medium) out.UTM_MEDIUM = attr.utm_medium;
  if (attr.utm_campaign) out.UTM_CAMPAIGN = attr.utm_campaign;
  if (attr.utm_content) out.UTM_CONTENT = attr.utm_content;
  if (attr.utm_term) out.UTM_TERM = attr.utm_term;
  return out;
}

// Campos customizados [MKT] do Negócio (IDs confirmados via bitrix24_list_fields).
// Landing page, referrer, placement e site_source não têm campo próprio: vão no COMMENTS.
function attributionDealFields(attr: Attribution): Record<string, string> {
  const map: [keyof Attribution, string][] = [
    ['utm_source', 'UF_CRM_1757529266'],
    ['utm_medium', 'UF_CRM_1757529375'],
    ['utm_campaign', 'UF_CRM_1757529487'],
    ['utm_content', 'UF_CRM_1757529541'],
    ['utm_term', 'UF_CRM_1757529604'],
    ['utm_network', 'UF_CRM_1773700496276'],
    ['utm_device', 'UF_CRM_1773700190202'],
    ['utm_matchtype', 'UF_CRM_1773699392897'],
    ['campaign_id', 'UF_CRM_1766855908'],
    ['adset_id', 'UF_CRM_1766856604852'],
    ['adset_id', 'UF_CRM_1773749927195'], // utm_adgroup_id (conjunto = grupo de anúncios)
    ['ad_id', 'UF_CRM_1766857251673'],
    ['gclid', 'UF_CRM_1773701073731'],
    ['fbclid', 'UF_CRM_1757529694'],
    ['fbp', 'UF_CRM_1757529829'],
    ['fbc', 'UF_CRM_1757529778'],
  ];
  const out: Record<string, string> = {};
  for (const [key, field] of map) {
    const value = attr[key];
    if (value) out[field] = value;
  }
  return out;
}

function attributionText(attr: Attribution): string {
  const lines: string[] = [];
  if (attr.utm_source) lines.push(`Origem (source): ${attr.utm_source}`);
  if (attr.utm_medium) lines.push(`Mídia (medium): ${attr.utm_medium}`);
  if (attr.utm_campaign) lines.push(`Campanha: ${attr.utm_campaign}`);
  if (attr.utm_content) lines.push(`Conteúdo: ${attr.utm_content}`);
  if (attr.utm_term) lines.push(`Termo: ${attr.utm_term}`);
  if (attr.campaign_id) lines.push(`ID da campanha: ${attr.campaign_id}`);
  if (attr.adset_id) lines.push(`ID do conjunto: ${attr.adset_id}`);
  if (attr.ad_id) lines.push(`ID do anúncio: ${attr.ad_id}`);
  if (attr.utm_network) lines.push(`Network: ${attr.utm_network}`);
  if (attr.utm_placement) lines.push(`Placement: ${attr.utm_placement}`);
  if (attr.utm_site_source) lines.push(`Site source: ${attr.utm_site_source}`);
  if (attr.utm_device) lines.push(`Dispositivo: ${attr.utm_device}`);
  if (attr.utm_matchtype) lines.push(`Tipo de correspondência: ${attr.utm_matchtype}`);
  if (attr.landing_page) lines.push(`Landing page: ${attr.landing_page}`);
  if (attr.referrer) lines.push(`Referrer: ${attr.referrer}`);
  return lines.length ? `\n\nOrigem do tráfego:\n${lines.map((l) => `- ${l}`).join('\n')}` : '';
}

export type LeadInput = {
  sessionId: string;
  nome?: string;
  celular?: string; // só dígitos, com DDD
  estado?: string; // UF
  stage?: string;
  resultado?: string;
  attribution?: Attribution;
  // Rota do teste A/B por onde o lead entrou (vai para título, origem e comentário do card).
  variante?: Variante;
  // Só nos resultados finais: alimentam a triagem por IA que completa o card.
  conversa?: ConversaMsg[];
  oficio?: OficioSnapshot | null;
};

const RESULTADOS_COM_AVISO: Record<string, string> = {
  documentos_enviados: 'Cliente enviou o ofício e confirmou os dados.',
  falou_consultor: 'Cliente clicou para falar com um consultor no WhatsApp.',
  revisao_solicitada: 'Cliente pediu revisão da análise.',
};
const resultadosAvisados = new Set<string>();
const estadosEnviados = new Map<string, string>();

/**
 * Cria (ou atualiza) Contato + Negócio no Bitrix para a sessão. O Negócio só é criado
 * quando nome e celular já são conhecidos; antes disso nada é gravado (o frontend
 * reenvia o lead acumulado a cada etapa, então nenhum dado se perde).
 */
// `criado` só é true na chamada que efetivamente criou o Negócio: é o gatilho do AIChatLead (Meta),
// cujo id (ai_chat_lead_id / event_id) vem do `dealId`.
export function registrarLead(input: LeadInput): Promise<{ registrado: boolean; criado: boolean; dealId?: number }> {
  return withSessionLock(input.sessionId, async () => {
    // Sem Negócio em cache e sem nome+celular nem resultado a avisar, não há o que criar
    // nem atualizar: evita uma consulta ao Bitrix à toa (ex.: etapa 'lead_nome').
    const temContato = Boolean(input.nome && input.celular);
    const temAviso = Boolean(input.resultado && RESULTADOS_COM_AVISO[input.resultado]);
    if (!dealCache.has(input.sessionId) && !temContato && !temAviso) return { registrado: false, criado: false };

    let deal = await findDeal(input.sessionId);
    let criado = false;

    if (!deal) {
      if (!input.nome || !input.celular) return { registrado: false, criado: false };
      deal = await criarNegocio({ ...input, nome: input.nome, celular: input.celular });
      criado = true;
      if (input.estado) estadosEnviados.set(input.sessionId, input.estado);
    } else {
      await atualizarNegocio(deal, input);
    }

    const aviso = input.resultado ? RESULTADOS_COM_AVISO[input.resultado] : undefined;
    const chave = `${input.sessionId}:${input.resultado}`;
    if (aviso && !resultadosAvisados.has(chave)) {
      resultadosAvisados.add(chave);
      await bitrixCall('crm.timeline.comment.add', {
        fields: {
          ENTITY_ID: deal.dealId,
          ENTITY_TYPE: 'deal',
          COMMENT: `[LP] ${aviso}${input.stage ? ` (etapa: ${input.stage})` : ''}`,
        },
      }).catch((error) => {
        resultadosAvisados.delete(chave);
        console.error('[bitrix] falha ao registrar aviso de resultado:', (error as Error).message);
      });
    }
    return { registrado: true, criado, dealId: deal.dealId };
  });
}

const RANK_LEAD_ROTULO: Record<string, string> = {
  'A+': 'A+ (lead prioritário)',
  A: 'A (lead quente)',
  B: 'B (lead qualificado)',
  C: 'C (lead em qualificação)',
  D: 'D (lead básico)',
  E: 'E (lead frio)',
};
const INTENCAO_ROTULO: Record<string, string> = {
  quer_vender_agora: 'quer vender agora',
  avaliando: 'avaliando a cessão',
  so_duvidas: 'só tirando dúvidas',
  sem_oficio: 'ainda sem o ofício',
  indefinida: 'não identificada',
};

const triagensFeitas = new Set<string>();

const campoVazio = (deal: Record<string, unknown> | null, campo: string) => {
  const v = deal?.[campo];
  return v == null || v === '' || v === '0' || (Array.isArray(v) && v.length === 0);
};

function textoTriagem(t: Triagem): string {
  const lista = (titulo: string, itens: string[]) => (itens.length ? `\n${titulo}:\n${itens.map((i) => `- ${i}`).join('\n')}` : '');
  return [
    '\n\nTriagem por IA (conversa do cliente x leitura do ofício; conferir no documento):',
    `Resumo: ${t.resumo || 'sem resumo'}`,
    `Rank: ${RANK_LEAD_ROTULO[t.rank_lead]} | Intenção: ${INTENCAO_ROTULO[t.intencao]} | Urgência: ${t.urgencia} | Confiança da triagem: ${t.confianca}`,
    `Valor desejado pelo cliente: ${t.valor_desejado_cliente}`,
    lista('Dúvidas do cliente', t.duvidas_cliente),
    lista('Objeções', t.objecoes),
    lista(
      'Divergências (cliente x ofício)',
      t.divergencias.map((d) => `${d.campo}: cliente disse "${d.cliente_disse}"; ofício "${d.ia_capturou}"; adotado "${d.valor_adotado}" (${d.motivo})`)
    ),
    lista('Campos sem informação', t.campos_sem_informacao.map((c) => `${c.campo}: ${c.motivo}`)),
    t.observacoes_consultor ? `\nOrientação ao consultor: ${t.observacoes_consultor}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Triagem por IA do que o cliente disse no chat e do que a leitura do ofício capturou, e
 * preenchimento dos campos restantes do card. Roda em resultados finais (ofício confirmado,
 * clique no WhatsApp, pedido de revisão), uma vez por sessão e resultado. A chamada à IA fica
 * fora do lock da sessão para não segurar outras gravações; só as escritas no Bitrix entram nele.
 */
export async function triarEPreencherCard(input: LeadInput & { resultado: string }): Promise<void> {
  const chave = `${input.sessionId}:${input.resultado}`;
  if (triagensFeitas.has(chave)) return;
  triagensFeitas.add(chave);
  try {
    const deal = await findDeal(input.sessionId);
    if (!deal) return;
    const atual = await bitrixCall<Record<string, any>>('crm.deal.get', { id: deal.dealId });
    const attr = input.attribution ?? {};
    const nome = String(atual?.[DEAL_UF_NOME_CLIENTE] || input.nome || '').trim();
    const celular = String(atual?.[DEAL_UF_TELEFONE] || input.celular || '').replace(/\D/g, '');
    const estado = String(atual?.[DEAL_UF_MKT_ESTADO] || input.estado || '').trim() || null;
    if (!nome) return;

    const triagem = await triarLead({
      nome,
      estadoInformado: estado,
      resultado: input.resultado,
      conversa: input.conversa ?? [],
      oficio: input.oficio ?? null,
      origem: { source: attr.utm_source, medium: attr.utm_medium, campaign: attr.utm_campaign, landing: attr.landing_path },
    });
    if (!triagem) {
      triagensFeitas.delete(chave); // permite nova tentativa no próximo resultado final
      return;
    }

    await withSessionLock(input.sessionId, async () => {
      const campos: Record<string, unknown> = {
        [DEAL_UF_NOME_CLIENTE]: triagem.nome_completo,
        [DEAL_UF_VALOR_DESEJADO]: triagem.valor_desejado_cliente,
        [DEAL_UF_MELHOR_CONTATO]: triagem.melhor_contato,
        [DEAL_UF_AUTORIZA_WA]: triagem.autoriza_whatsapp ? DEAL_AUTORIZA_WA_SIM_ID : DEAL_AUTORIZA_WA_NAO_ID,
        [DEAL_UF_TEM_DOCUMENTOS]: triagem.tem_oficio ? SIM_NAO_IDS.documentos.sim : SIM_NAO_IDS.documentos.nao,
        [DEAL_UF_TEM_PROCESSO]: triagem.tem_numero_processo ? SIM_NAO_IDS.processo.sim : SIM_NAO_IDS.processo.nao,
        [DEAL_UF_RANK_LEAD]: RANK_LEAD_IDS[triagem.rank_lead],
        COMMENTS: `${comentarioBase({ sessionId: input.sessionId, celular: celular ? formatCelularBr(celular) : '', estado: triagem.uf_processo ?? estado ?? undefined, attr, variante: input.variante })}${textoTriagem(triagem)}`,
      };
      if (triagem.pessoa === 'pessoa_fisica') campos[DEAL_UF_PF_OU_EMPRESA] = DEAL_PESSOA_FISICA_ID;
      if (triagem.valor_bruto_oficio) {
        campos.OPPORTUNITY = triagem.valor_bruto_oficio;
        campos.CURRENCY_ID = 'BRL';
      }
      Object.assign(campos, estadoToFields(triagem.uf_processo ?? undefined));
      // Dados do processo gravados a partir do ofício (servidor) não são sobrescritos pela triagem.
      for (const [k, v] of Object.entries(tribunalToFields({ esfera: triagem.esfera, tribunal_sigla: triagem.tribunal_sigla as any }))) {
        if (campoVazio(atual, k)) campos[k] = v;
      }
      if (campoVazio(atual, DEAL_UF_NUMERO_PROCESSO) && input.oficio?.processo) {
        campos[DEAL_UF_NUMERO_PROCESSO] = sanitizeText(input.oficio.processo, 80);
      }
      await bitrixCall('crm.deal.update', { id: deal.dealId, fields: campos });

      if (deal.contactId) {
        await bitrixCall('crm.contact.update', { id: deal.contactId, fields: splitNome(triagem.nome_completo) }).catch((error) =>
          console.error('[bitrix] falha ao atualizar nome do contato:', (error as Error).message)
        );
      }

      const resumo = [
        `[LP] Card completado pela triagem de IA (resultado: ${input.resultado}).`,
        `Rank: ${RANK_LEAD_ROTULO[triagem.rank_lead]} | Intenção: ${INTENCAO_ROTULO[triagem.intencao]}.`,
        triagem.divergencias.length ? `${triagem.divergencias.length} divergência(s) entre o cliente e o ofício: veja o campo Comentário do negócio.` : 'Sem divergências entre o cliente e o ofício.',
        triagem.campos_sem_informacao.length ? `${triagem.campos_sem_informacao.length} campo(s) sem informação, listados no Comentário.` : 'Todos os campos disponíveis foram preenchidos.',
      ].join('\n');
      await bitrixCall('crm.timeline.comment.add', {
        fields: { ENTITY_ID: deal.dealId, ENTITY_TYPE: 'deal', COMMENT: resumo },
      }).catch((error) => console.error('[bitrix] falha ao registrar a triagem na timeline:', (error as Error).message));
    });
  } catch (error) {
    triagensFeitas.delete(chave);
    console.error('[bitrix] falha na triagem do card:', (error as Error).message);
  }
}

// Nome completo -> NAME (primeiro nome) + LAST_NAME (restante), como o CRM espera.
function splitNome(nome: string): { NAME: string; LAST_NAME?: string } {
  const partes = nome.trim().split(/\s+/);
  const primeiro = partes.shift() || nome;
  return partes.length ? { NAME: primeiro, LAST_NAME: partes.join(' ') } : { NAME: primeiro };
}

function formatCelularBr(digits: string): string {
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

// Origem do lead pelo rastreio de mídia: Meta (Facebook/Instagram) quando há sinal dele; sem
// campanha, o lead veio direto pela IA do site.
function origemLeadId(attr: Attribution): string {
  const sinais = [attr.utm_source, attr.utm_site_source, attr.utm_network, attr.referrer].join(' ').toLowerCase();
  if (/instagram|\big\b|ig_/.test(sinais)) return DEAL_DE_ONDE_VEIO_IDS.instagram;
  if (/facebook|\bfb\b|meta/.test(sinais) || attr.fbclid) return DEAL_DE_ONDE_VEIO_IDS.facebook;
  if (attr.gclid || attr.utm_source) return DEAL_DE_ONDE_VEIO_IDS.outros;
  return DEAL_DE_ONDE_VEIO_IDS.ia;
}

function trafegoPagoId(attr: Attribution): string {
  const pago =
    Boolean(attr.gclid || attr.fbclid || attr.campaign_id || attr.adset_id || attr.ad_id) ||
    /cpc|ppc|paid|display|social/i.test(attr.utm_medium ?? '');
  return pago ? DEAL_TRAFEGO_PAGO_ID : DEAL_TRAFEGO_ORGANICO_ID;
}

// Campos que já são conhecidos assim que o card nasce (contato + origem), sem depender de IA.
function camposDoContato(celular: string, attr: Attribution): Record<string, unknown> {
  return {
    CURRENCY_ID: 'BRL',
    [DEAL_UF_TELEFONE]: formatCelularBr(celular),
    [DEAL_UF_AUTORIZA_WA]: DEAL_AUTORIZA_WA_SIM_ID,
    [DEAL_UF_MELHOR_CONTATO]: 'WhatsApp',
    [DEAL_UF_DE_ONDE_VEIO]: origemLeadId(attr),
    [DEAL_UF_TIPO_TRAFEGO]: trafegoPagoId(attr),
    [DEAL_UF_TEM_DOCUMENTOS]: SIM_NAO_IDS.documentos.nao,
    [DEAL_UF_TEM_PROCESSO]: SIM_NAO_IDS.processo.nao,
  };
}

function comentarioBase(p: { sessionId: string; celular: string; estado?: string; attr: Attribution; variante?: Variante }): string {
  return `Lead captado pela LP com chatbot.${p.variante ? `\nVariante do teste A/B: ${VARIANTE_ROTULO[p.variante]}` : ''}\nProtocolo: ${protocoloFromSession(p.sessionId)}\nTelefone / WhatsApp: ${p.celular}${
    p.estado ? `\nEstado do processo: ${p.estado}` : ''
  }${attributionText(p.attr)}`;
}

function origemDescricao(variante?: Variante): string {
  return variante && variante !== 'lp' ? `LP Precatórios (${VARIANTE_ROTULO[variante]})` : 'LP Precatórios (chatbot)';
}

async function criarNegocio(input: LeadInput & { nome: string; celular: string }): Promise<DealRef> {
  const nome = sanitizeText(input.nome, 200);
  const attr = input.attribution ?? {};

  const contactId = Number(
    await bitrixCall('crm.contact.add', {
      fields: {
        ...splitNome(nome),
        PHONE: [{ VALUE: input.celular, VALUE_TYPE: 'WORK' }],
        SOURCE_ID: 'WEB',
        SOURCE_DESCRIPTION: origemDescricao(input.variante),
        ...attributionFields(attr),
      },
    })
  );

  const fields: Record<string, unknown> = {
    // O sufixo da variante permite filtrar o teste A/B pelo título no Bitrix.
    TITLE: `LP da Marlene - ${nome}${input.variante && input.variante !== 'lp' ? ` [${input.variante.toUpperCase()}]` : ''}`,
    CONTACT_ID: contactId,
    CATEGORY_ID: DEAL_CATEGORY_ID,
    STAGE_ID: DEAL_STAGE_ID,
    ASSIGNED_BY_ID: DEAL_ASSIGNED_BY_ID,
    SOURCE_ID: 'WEB',
    SOURCE_DESCRIPTION: origemDescricao(input.variante),
    ORIGINATOR_ID,
    ORIGIN_ID: input.sessionId,
    COMMENTS: comentarioBase({ sessionId: input.sessionId, celular: input.celular, estado: input.estado, attr, variante: input.variante }),
    [DEAL_UF_NOME_CLIENTE]: nome,
    [DEAL_UF_MKT_ORIGEM_LEAD]: DEAL_ORIGEM_LEAD_LPIA_ID,
    [DEAL_UF_MKT_FUNIL_ORIGEM]: DEAL_FUNIL_PREMIUM_OFFICE_ID,
    ...camposDoContato(input.celular, attr),
    ...attributionFields(attr),
    ...attributionDealFields(attr),
  };
  const estadoFields = estadoToFields(input.estado);
  Object.assign(fields, estadoFields);

  const dealId = Number(
    await bitrixCall('crm.deal.add', { fields, params: { REGISTER_SONET_EVENT: 'Y' } })
  );
  const ref = { dealId, contactId };
  dealCache.set(input.sessionId, ref);
  return ref;
}

function estadoToFields(estado?: string): Record<string, string> {
  const uf = (estado || '').toUpperCase();
  const out: Record<string, string> = {};
  if (ESTADO_ENUM_IDS[uf]) {
    out[DEAL_UF_ESTADO] = ESTADO_ENUM_IDS[uf];
    out[DEAL_UF_MKT_ESTADO] = uf;
  }
  return out;
}

async function atualizarNegocio(deal: DealRef, input: LeadInput) {
  // Estado: só regrava quando muda (o frontend reenvia o lead acumulado a cada etapa).
  if (input.estado && estadosEnviados.get(input.sessionId) !== input.estado) {
    const fields = estadoToFields(input.estado);
    if (Object.keys(fields).length) {
      await bitrixCall('crm.deal.update', { id: deal.dealId, fields });
      estadosEnviados.set(input.sessionId, input.estado);
    }
  }

  // Celular corrigido pelo usuário: substitui o(s) telefone(s) do contato.
  if (input.stage === 'celular_corrigido' && input.celular && deal.contactId) {
    const contact = await bitrixCall<{ PHONE?: { ID: string; VALUE: string }[] }>('crm.contact.get', {
      id: deal.contactId,
    });
    const atuais = contact?.PHONE ?? [];
    await bitrixCall('crm.deal.update', { id: deal.dealId, fields: { [DEAL_UF_TELEFONE]: formatCelularBr(input.celular) } });
    if (!atuais.some((p) => p.VALUE.replace(/\D/g, '') === input.celular)) {
      await bitrixCall('crm.contact.update', {
        id: deal.contactId,
        fields: {
          PHONE: [
            ...atuais.map((p) => ({ ID: p.ID, DELETE: 'Y' })),
            { VALUE: input.celular, VALUE_TYPE: 'WORK' },
          ],
        },
      });
    }
  }
}

export type OficioInput = {
  sessionId: string;
  cpf: string | null; // só dígitos, já validado
  fields: OficioFields;
  file: { name: string; base64: string };
};

/**
 * Anexa o ofício e os dados extraídos ao Negócio da sessão (timeline + campos de CPF,
 * processo e tribunal). Sem Negócio criado ainda (lead sem nome/celular), não grava.
 */
export function registrarOficio(input: OficioInput): Promise<{ registrado: boolean; dealId?: number }> {
  return withSessionLock(input.sessionId, async () => {
    const deal = await findDeal(input.sessionId);
    if (!deal) return { registrado: false };

    const f = input.fields;

    const dealFields: Record<string, unknown> = {};
    if (input.cpf) {
      dealFields[DEAL_UF_CPF] = input.cpf;
      dealFields[DEAL_UF_CPF_CLIENTE] = input.cpf;
      dealFields[DEAL_UF_CPF_BOT] = input.cpf;
    }
    if (f.processo) dealFields[DEAL_UF_NUMERO_PROCESSO] = sanitizeText(f.processo, 80);
    dealFields[DEAL_UF_TEM_DOCUMENTOS] = SIM_NAO_IDS.documentos.sim;
    if (f.processo) dealFields[DEAL_UF_TEM_PROCESSO] = SIM_NAO_IDS.processo.sim;
    // Valor do negócio = valor bruto requisitado no ofício (a proposta é sobre o líquido; ver Comentário).
    if (typeof f.valor === 'number') {
      dealFields.OPPORTUNITY = f.valor;
      dealFields.CURRENCY_ID = 'BRL';
    }
    Object.assign(dealFields, tribunalToFields(f));
    if (Object.keys(dealFields).length) {
      await bitrixCall('crm.deal.update', { id: deal.dealId, fields: dealFields });
    }

    if (input.cpf && deal.contactId) {
      await bitrixCall('crm.contact.update', {
        id: deal.contactId,
        fields: {
          [CONTACT_UF_CPF]: [input.cpf],
          [CONTACT_UF_CPF_CNPJ]: input.cpf,
          [CONTACT_UF_CPF_ALT]: input.cpf,
        },
      });
    }

    const linhas = [
      '[LP] Ofício requisitório enviado pelo cliente (dados lidos automaticamente por IA; conferir no documento anexo).',
      `Tipo: ${f.tipo}`,
      f.esfera !== 'desconhecida' && `Esfera: ${f.esfera}`,
      f.credor && `Credor: ${sanitizeText(f.credor)}`,
      f.processo && `Nº do processo: ${sanitizeText(f.processo, 80)}`,
      f.tribunal && `Tribunal: ${sanitizeText(f.tribunal)}`,
      f.ente_devedor && `Ente devedor: ${sanitizeText(f.ente_devedor)}`,
      f.natureza && `Natureza: ${sanitizeText(f.natureza)}`,
      typeof f.valor === 'number' && `Valor no ofício (bruto): R$ ${f.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      f.data_base && `Data-base: ${sanitizeText(f.data_base)}`,
    ].filter(Boolean);

    // O original vai para o campo de arquivo do Negócio; se o Bitrix recusar, cai para o
    // anexo do comentário para o consultor não ficar sem o documento.
    let arquivoNoCampo = true;
    try {
      await bitrixCall('crm.deal.update', {
        id: deal.dealId,
        fields: { [DEAL_UF_OFICIO_ARQUIVO]: [[input.file.name, input.file.base64]] },
      });
    } catch (error) {
      arquivoNoCampo = false;
      console.error('[bitrix] falha ao gravar o ofício no campo de arquivo:', (error as Error).message);
    }

    await bitrixCall('crm.timeline.comment.add', {
      fields: {
        ENTITY_ID: deal.dealId,
        ENTITY_TYPE: 'deal',
        COMMENT: linhas.join('\n'),
        ...(arquivoNoCampo ? {} : { FILES: [[input.file.name, input.file.base64]] }),
      },
    });
    return { registrado: true, dealId: deal.dealId };
  });
}

/** Negócio da sessão, se já criado. */
export async function negocioDaSessao(sessionId: string): Promise<number | null> {
  return (await findDeal(sessionId))?.dealId ?? null;
}

export async function comentarNoNegocio(dealId: number, comment: string): Promise<void> {
  await bitrixCall('crm.timeline.comment.add', { fields: { ENTITY_ID: dealId, ENTITY_TYPE: 'deal', COMMENT: comment } });
}

/**
 * Grava o CPF informado pelo cliente (formulário ou chat) no Negócio e no Contato da sessão,
 * sem sobrescrever um CPF já lido do ofício. Sem Negócio criado ainda, não grava.
 */
export function registrarCpf(input: { sessionId: string; cpf: string }): Promise<{ dealId: number | null }> {
  return withSessionLock(input.sessionId, async () => {
    const deal = await findDeal(input.sessionId);
    if (!deal) return { dealId: null };
    const atual = await bitrixCall<Record<string, any>>('crm.deal.get', { id: deal.dealId });
    if (campoVazio(atual, DEAL_UF_CPF)) {
      await bitrixCall('crm.deal.update', {
        id: deal.dealId,
        fields: { [DEAL_UF_CPF]: input.cpf, [DEAL_UF_CPF_CLIENTE]: input.cpf, [DEAL_UF_CPF_BOT]: input.cpf },
      });
      if (deal.contactId) {
        await bitrixCall('crm.contact.update', {
          id: deal.contactId,
          fields: { [CONTACT_UF_CPF]: [input.cpf], [CONTACT_UF_CPF_CNPJ]: input.cpf, [CONTACT_UF_CPF_ALT]: input.cpf },
        }).catch((error) => console.error('[bitrix] falha ao gravar CPF no contato:', (error as Error).message));
      }
    }
    return { dealId: deal.dealId };
  });
}

/** Respostas declaradas pelo cliente (formulário ou secretária digital) como comentário do card. */
export async function registrarDeclaracoes(input: {
  sessionId: string;
  titulo: string;
  itens: [string, string | null | undefined][];
}): Promise<void> {
  const dealId = await negocioDaSessao(input.sessionId);
  if (!dealId) return;
  const linhas = input.itens
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${sanitizeText(String(v), 300)}`);
  if (!linhas.length) return;
  await comentarNoNegocio(dealId, `[LP] ${input.titulo}\n${linhas.join('\n')}`);
}
