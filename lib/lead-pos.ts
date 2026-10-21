// SERVER-ONLY: passos depois do registro do lead, comuns às rotas que criam cards
// (/api/lead para a LP e o formulário, /api/agente para a secretária digital).
import { after } from 'next/server';
import { negocioDaSessao, registrarCpf, type Attribution } from '@/lib/bitrix';
import { enriquecerCard } from '@/lib/enriquecimento';
import { aiChatLeadEventId, enviarAIChatLead, isMetaCapiConfigured } from '@/lib/meta-capi';
import { SITE_URL } from '@/lib/site';

/**
 * AIChatLead só nasce com o Negócio criado no Bitrix: o servidor envia pela CAPI (após a
 * resposta) e devolve o id (aichatlead_<dealId>) para o navegador empurrar o `ai_chat_lead`
 * no dataLayer; o GTM dispara o Pixel com esse mesmo id como event_id.
 */
export function agendarAIChatLead(p: {
  request: Request;
  ip: string;
  sessionId: string;
  dealId: number;
  nome: string;
  celular: string;
  estado?: string;
  attribution: Attribution;
}): { id: string } {
  const id = aiChatLeadEventId(p.dealId);
  if (isMetaCapiConfigured()) {
    const eventSourceUrl = p.request.headers.get('referer')?.slice(0, 1000) || p.attribution.landing_page || SITE_URL;
    const userAgent = p.request.headers.get('user-agent');
    after(() =>
      enviarAIChatLead({
        sessionId: p.sessionId,
        dealId: p.dealId,
        nome: p.nome,
        celular: p.celular,
        estado: p.estado,
        attribution: p.attribution,
        clientIp: p.ip,
        userAgent,
        eventSourceUrl,
      })
    );
  }
  return { id };
}

/** Grava o CPF informado e enriquece o card (Lemit + Infosimples), após a resposta. */
export function agendarCpfEEnriquecimento(p: { sessionId: string; cpf: string; nome?: string; celular?: string }) {
  after(async () => {
    try {
      const { dealId } = await registrarCpf({ sessionId: p.sessionId, cpf: p.cpf });
      const id = dealId ?? (await negocioDaSessao(p.sessionId));
      if (id) await enriquecerCard({ sessionId: p.sessionId, cpf: p.cpf, dealId: id, nomeDeclarado: p.nome, celularDeclarado: p.celular });
    } catch (error) {
      console.error('[lead] falha ao gravar o CPF/enriquecer o card:', (error as Error).message);
    }
  });
}
