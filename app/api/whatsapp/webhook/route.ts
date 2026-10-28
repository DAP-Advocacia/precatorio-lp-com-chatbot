// SERVER-ONLY: Webhook de recepção de mensagens do WhatsApp
// Recebe as mensagens enviadas pelos clientes no WhatsApp, identifica o Deal no Bitrix24
// e atualiza a timeline e os campos do card automaticamente.

import { NextResponse } from 'next/server';
import { atualizarCardAposWhatsApp } from '@/lib/bitrix';
import { describeError } from '@/lib/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Validação de Webhook (Meta Cloud API hub.challenge ou verificação de status)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'premium_office_wa_token';

  if (mode === 'subscribe' && token === verifyToken) {
    return new Response(challenge || 'OK', { status: 200 });
  }

  return NextResponse.json({ status: 'online', service: 'premium-office-whatsapp-webhook' });
}

/**
 * Recepção de mensagens do cliente pelo WhatsApp
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 });

    // Extração flexível compatível com múltiplos gateways (Evolution API, Z-API, Meta Cloud API)
    let celular = '';
    let mensagemRecebida = '';
    let remetenteNome = '';

    // 1. Padrão Evolution API
    if (body.data?.key?.remoteJid || body.sender || body.data?.message) {
      const rawJid = body.data?.key?.remoteJid || body.sender || '';
      celular = rawJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      mensagemRecebida =
        body.data?.message?.conversation ||
        body.data?.message?.extendedTextMessage?.text ||
        body.text ||
        body.message ||
        '';
      remetenteNome = body.data?.pushName || '';
    }
    // 2. Padrão Z-API
    else if (body.phone || body.text?.message) {
      celular = String(body.phone || '').replace(/\D/g, '');
      mensagemRecebida = body.text?.message || body.message || '';
      remetenteNome = body.senderName || '';
    }
    // 3. Padrão Meta Cloud API
    else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msgObj = body.entry[0].changes[0].value.messages[0];
      celular = String(msgObj.from || '').replace(/\D/g, '');
      mensagemRecebida = msgObj.text?.body || msgObj.type || '';
      remetenteNome = body.entry[0].changes[0].value.contacts?.[0]?.profile?.name || '';
    }
    // 4. Payload genérico/customizado
    else {
      celular = String(body.celular || body.phone || body.from || '').replace(/\D/g, '');
      mensagemRecebida = String(body.mensagem || body.text || body.message || '');
      remetenteNome = String(body.nome || body.name || '');
    }

    if (!celular || !mensagemRecebida) {
      // Ignora status updates ou acks silenciosamente
      return NextResponse.json({ status: 'ignored', reason: 'sem_texto_ou_remetente' }, { status: 200 });
    }

    console.info('[whatsapp/webhook] Mensagem recebida:', {
      celular,
      remetenteNome,
      preview: mensagemRecebida.slice(0, 80),
    });

    const resultado = await atualizarCardAposWhatsApp({
      celular,
      mensagemRecebida: remetenteNome ? `[${remetenteNome}]: ${mensagemRecebida}` : mensagemRecebida,
    });

    return NextResponse.json({
      success: true,
      cardAtualizado: resultado.atualizado,
      dealId: resultado.dealId ?? null,
    });
  } catch (error) {
    console.error('[whatsapp/webhook] Erro ao processar webhook:', describeError(error));
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
}
