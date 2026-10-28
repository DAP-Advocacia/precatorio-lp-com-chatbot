// SERVER-ONLY: Módulo de integração com a WhatsApp API para primeiro contato
// e atualização automática do status no Bitrix24.
// Suporta provedores compatíveis (Evolution API, Z-API, Meta Cloud API, webhooks personalizados).

import { marcarContatoRealizado, type BitrixContatoWhatsAppResult } from '@/lib/bitrix';
import { redactPii } from '@/lib/server';

export interface PrimeiroContatoInput {
  sessionId: string;
  dealId?: number;
  nome: string;
  celular: string; // Dígitos com DDD
  esfera?: 'federal' | 'estadual' | 'municipal' | 'inss' | 'outro' | 'nao_sabe' | null;
  uf?: string | null;
  municipio?: string | null;
  papel?: 'proprio_titular' | 'herdeiro_espolio' | 'advogado' | 'broker' | 'terceiro' | 'nao_sabe' | null;
  nomeTitular?: string | null;
  mensagemCustomizada?: string;
}

export interface PrimeiroContatoResult {
  sucesso: boolean;
  simulado: boolean;
  mensagem: string;
  destinatario: string;
  provider?: string;
  detalhes?: string;
}

function formatarCelularE164(celular: string): string {
  let limpo = celular.replace(/\D/g, '');
  if (limpo.startsWith('55') && limpo.length >= 12) return limpo;
  return `55${limpo}`;
}

function formatarCelularBr(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

/**
 * Gera o texto acolhedor, profissional e persuasivo da secretária Karen para o WhatsApp.
 */
export function gerarMensagemPrimeiroContato(input: Pick<PrimeiroContatoInput, 'nome' | 'esfera' | 'uf' | 'municipio' | 'papel' | 'nomeTitular'>): string {
  const primeiroNome = input.nome.trim().split(/\s+/)[0] || 'Cliente';
  const esferaStr =
    input.esfera === 'federal'
      ? 'federal'
      : input.esfera === 'estadual'
      ? 'estadual'
      : input.esfera === 'municipal'
      ? 'municipal'
      : input.esfera === 'inss'
      ? 'do INSS'
      : 'judicial';

  const localidade = [input.municipio, input.uf].filter(Boolean).join(' - ');
  const localStr = localidade ? ` (${localidade})` : '';

  if (input.papel === 'advogado' || input.papel === 'broker') {
    const titularRef = input.nomeTitular ? ` do titular ${input.nomeTitular}` : '';
    return [
      `Olá, Dr(a). ${primeiroNome}! Aqui é a Karen da Premium Office Precatórios. ⚖️`,
      `Recebi seu contato no site referente ao precatório ${esferaStr}${localStr}${titularRef}.`,
      `Nosso time especializado em parcerias e honorários já está com os dados para calcular a proposta de antecipação à vista com a melhor taxa do mercado.`,
      `Se puder nos enviar por aqui o número do processo ou cópia do ofício requisitório, agilizamos a minuta para você e seu cliente! Como podemos te ajudar?`,
    ].join('\n\n');
  }

  return [
    `Olá, ${primeiroNome}! Aqui é a Karen da Premium Office Precatórios. ⚖️`,
    `Recebi suas informações no nosso site referente ao seu precatório ${esferaStr}${localStr}.`,
    `Nosso especialista já foi notificado e está avaliando o caso para preparar a sua análise gratuita de antecipação à vista, sem que você precise esperar na fila do tribunal.`,
    `Caso você já tenha em mãos o número do processo ou o PDF/foto do ofício requisitório, pode me enviar aqui por esta conversa para agilizarmos o valor disponível!`,
  ].join('\n\n');
}

/**
 * Dispara o primeiro contato pelo WhatsApp via API (ou simulação segura se env não configurada)
 * e marca no card do Bitrix24 que o contato foi realizado.
 */
export async function enviarPrimeiroContatoWhatsApp(input: PrimeiroContatoInput): Promise<PrimeiroContatoResult> {
  const celularE164 = formatarCelularE164(input.celular);
  const mensagem = input.mensagemCustomizada || gerarMensagemPrimeiroContato(input);
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_API_KEY;

  let sucesso = false;
  let simulado = false;
  let detalhes = '';

  if (!apiUrl) {
    simulado = true;
    sucesso = true;
    detalhes = 'WhatsApp API não configurada em WHATSAPP_API_URL. Mensagem registrada e disparo simulado com sucesso.';
    console.info('[whatsapp-api] Envio simulado:', {
      to: celularE164,
      mensagemPreview: mensagem.slice(0, 100),
    });
  } else {
    try {
      // Suporte unificado para Z-API, Evolution API e Webhooks
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
        headers['Client-Token'] = apiToken;
        headers['apikey'] = apiToken;
      }

      const payload = {
        phone: celularE164,
        number: celularE164,
        to: celularE164,
        message: mensagem,
        text: mensagem,
        body: mensagem,
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        sucesso = true;
        detalhes = `Mensagem enviada com sucesso pela API externa (HTTP ${res.status}).`;
      } else {
        const errorText = await res.text().catch(() => '');
        sucesso = false;
        detalhes = `Falha na WhatsApp API (HTTP ${res.status}): ${errorText.slice(0, 200)}`;
        console.error('[whatsapp-api] Erro ao enviar mensagem:', detalhes);
      }
    } catch (error) {
      sucesso = false;
      detalhes = `Exceção na WhatsApp API: ${(error as Error).message}`;
      console.error('[whatsapp-api] Falha de conexão:', detalhes);
    }
  }

  // Registra no Bitrix24 que o contato foi realizado (comentário, campo Contato Realizado e data/hora)
  try {
    await marcarContatoRealizado({
      sessionId: input.sessionId,
      dealId: input.dealId,
      celular: formatarCelularBr(input.celular),
      mensagem: redactPii(mensagem),
      sucesso,
      detalhes,
    });
  } catch (error) {
    console.error('[whatsapp-api] Erro ao marcar contato no Bitrix:', (error as Error).message);
  }

  return {
    sucesso,
    simulado,
    mensagem,
    destinatario: celularE164,
    provider: apiUrl ? 'api_externa' : 'simulado',
    detalhes,
  };
}
