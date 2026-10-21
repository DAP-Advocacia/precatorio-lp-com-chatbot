'use client';

// Chamadas do navegador usadas pelas variantes do teste A/B (secretária digital e formulário).
// A LP original mantém a própria lógica em ChatSection.
import { getAttribution } from '@/lib/attribution';
import { apiPath } from '@/lib/site';
import { track } from '@/lib/track';
import type { Variante } from '@/lib/variante';

// Mesma chave do ChatSection: a sessão (e o card no Bitrix) é uma só por aba.
const SESSION_KEY = 'po_chat_session_id';

export function getClientSessionId(): string {
  const novo = () => `lp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = novo();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return novo();
  }
}

// Negócio recém-criado: o servidor já enviou o AIChatLead pela CAPI; o GTM dispara o Pixel com
// o ai_chat_lead_id como event_id (deduplicação).
export function trackAIChatLead(data: any, variante: Variante) {
  const id = data?.aiChatLead?.id;
  if (typeof id === 'string') track('ai_chat_lead', { ai_chat_lead_id: id, variante });
}

export type LeadPayload = {
  variante: Variante;
  lead?: { nome?: string; celular?: string; estado?: string; cpf?: string };
  stage?: string;
  resultado?: 'em_andamento' | 'lead_qualificado' | 'documentos_enviados' | 'falou_consultor' | 'revisao_solicitada';
  declaracoes?: [string, string][];
  conversa?: { role: 'user' | 'assistant'; text: string }[];
  oficio?: OficioExtraido | null;
};

export async function enviarLead(p: LeadPayload): Promise<{ ok: boolean; error?: string; field?: string }> {
  try {
    const res = await fetch(apiPath('/api/lead'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSessionId: getClientSessionId(), attribution: getAttribution(), ...p }),
      keepalive: true,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.error || 'Não foi possível enviar agora. Tente novamente.', field: data?.field };
    trackAIChatLead(data, p.variante);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sem conexão. Verifique a internet e tente novamente.' };
  }
}

export type OficioExtraido = {
  tipo: 'precatorio' | 'rpv' | 'desconhecido';
  esfera: 'federal' | 'estadual' | 'municipal' | 'desconhecida';
  tribunalSigla: string | null;
  credor: string | null;
  cpf: string | null; // mascarado
  processo: string | null;
  tribunal: string | null;
  enteDevedor: string | null;
  natureza: string | null;
  valor: number | null;
  dataBase: string | null;
};

const MAX_OFICIO_BYTES = 4 * 1024 * 1024;

export async function enviarOficio(file: File): Promise<{ ok: true; extracted: OficioExtraido } | { ok: false; message: string }> {
  if (file.size > MAX_OFICIO_BYTES) return { ok: false, message: 'O arquivo passa de 4 MB. Envie uma foto ou PDF menor.' };
  track('oficio_upload', { tipo_arquivo: file.type || 'desconhecido', tamanho_kb: Math.round(file.size / 1024) });
  const form = new FormData();
  form.append('file', file);
  form.append('clientSessionId', getClientSessionId());
  try {
    const res = await fetch(apiPath('/api/oficio'), { method: 'POST', body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      track('oficio_falha', { reason: data?.reason || `http_${res.status}` });
      return { ok: false, message: data?.message || 'Não conseguimos ler o arquivo agora. Tente novamente.' };
    }
    track('oficio_extraido', { tipo: data.extracted?.tipo || 'desconhecido' });
    return { ok: true, extracted: data.extracted as OficioExtraido };
  } catch {
    track('oficio_falha', { reason: 'network' });
    return { ok: false, message: 'Sem conexão. Verifique a internet e tente novamente.' };
  }
}
