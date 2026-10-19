// SERVER-ONLY: integração direta com o Bitrix24 via webhook de entrada. É o único
// destino dos dados captados na LP: não há banco próprio. O vínculo sessão -> negócio
// fica no próprio Bitrix (ORIGINATOR_ID + ORIGIN_ID do Deal).
// Nunca logar payloads: contêm nome, CPF e telefone (LGPD).
import { protocoloFromSession } from '@/lib/whatsapp';
import type { OficioFields } from '@/lib/oficio-extract';

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

function tribunalToFields(f: OficioFields): Record<string, unknown> {
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

export type Attribution = Partial<
  Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term' | 'referrer', string | null>
>;

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

function attributionFields(attr: Attribution): Record<string, string> {
  const out: Record<string, string> = {};
  if (attr.utm_source) out.UTM_SOURCE = attr.utm_source;
  if (attr.utm_medium) out.UTM_MEDIUM = attr.utm_medium;
  if (attr.utm_campaign) out.UTM_CAMPAIGN = attr.utm_campaign;
  if (attr.utm_content) out.UTM_CONTENT = attr.utm_content;
  if (attr.utm_term) out.UTM_TERM = attr.utm_term;
  return out;
}

function attributionText(attr: Attribution): string {
  const lines: string[] = [];
  if (attr.utm_source) lines.push(`Origem (source): ${attr.utm_source}`);
  if (attr.utm_medium) lines.push(`Mídia (medium): ${attr.utm_medium}`);
  if (attr.utm_campaign) lines.push(`Campanha: ${attr.utm_campaign}`);
  if (attr.utm_content) lines.push(`Conteúdo: ${attr.utm_content}`);
  if (attr.utm_term) lines.push(`Termo: ${attr.utm_term}`);
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
export function registrarLead(input: LeadInput): Promise<{ registrado: boolean }> {
  return withSessionLock(input.sessionId, async () => {
    // Sem Negócio em cache e sem nome+celular nem resultado a avisar, não há o que criar
    // nem atualizar: evita uma consulta ao Bitrix à toa (ex.: etapa 'lead_nome').
    const temContato = Boolean(input.nome && input.celular);
    const temAviso = Boolean(input.resultado && RESULTADOS_COM_AVISO[input.resultado]);
    if (!dealCache.has(input.sessionId) && !temContato && !temAviso) return { registrado: false };

    let deal = await findDeal(input.sessionId);

    if (!deal) {
      if (!input.nome || !input.celular) return { registrado: false };
      deal = await criarNegocio({ ...input, nome: input.nome, celular: input.celular });
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
    return { registrado: true };
  });
}

async function criarNegocio(input: LeadInput & { nome: string; celular: string }): Promise<DealRef> {
  const nome = sanitizeText(input.nome, 200);
  const attr = input.attribution ?? {};
  const protocolo = protocoloFromSession(input.sessionId);

  const contactId = Number(
    await bitrixCall('crm.contact.add', {
      fields: {
        NAME: nome,
        PHONE: [{ VALUE: input.celular, VALUE_TYPE: 'WORK' }],
        SOURCE_ID: 'WEB',
        ...attributionFields(attr),
      },
    })
  );

  const fields: Record<string, unknown> = {
    TITLE: `LP da Marlene - ${nome}`,
    CONTACT_ID: contactId,
    CATEGORY_ID: DEAL_CATEGORY_ID,
    STAGE_ID: DEAL_STAGE_ID,
    ASSIGNED_BY_ID: DEAL_ASSIGNED_BY_ID,
    SOURCE_ID: 'WEB',
    SOURCE_DESCRIPTION: 'LP Precatórios (chatbot)',
    ORIGINATOR_ID,
    ORIGIN_ID: input.sessionId,
    COMMENTS: `Lead captado pela LP com chatbot.\nProtocolo: ${protocolo}\nTelefone / WhatsApp: ${input.celular}${
      input.estado ? `\nEstado do processo: ${input.estado}` : ''
    }${attributionText(attr)}`,
    [DEAL_UF_NOME_CLIENTE]: nome,
    [DEAL_UF_MKT_ORIGEM_LEAD]: DEAL_ORIGEM_LEAD_LPIA_ID,
    [DEAL_UF_MKT_FUNIL_ORIGEM]: DEAL_FUNIL_PREMIUM_OFFICE_ID,
    ...attributionFields(attr),
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
