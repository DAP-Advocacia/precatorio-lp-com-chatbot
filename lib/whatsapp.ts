export const WA_NUMBER = '5521986450262';
export const WA_DISPLAY = '(21) 98645-0262';

type WaContext = {
  nome?: string;
  protocolo?: string;
  motivo?: string;
};

// Link do WhatsApp com mensagem pré-preenchida carregando contexto suficiente para o
// consultor casar o contato com a sessão (protocolo = client_session_id encurtado).
export function whatsappLink(ctx: WaContext = {}) {
  const partes = ['Olá! Vim pelo site da Premium Office e quero analisar meu precatório.'];
  if (ctx.nome) partes[0] = `Olá! Sou ${ctx.nome.trim().split(/\s+/)[0]}, vim pelo site da Premium Office e quero analisar meu precatório.`;
  if (ctx.motivo) partes.push(ctx.motivo);
  if (ctx.protocolo) partes.push(`Protocolo: ${ctx.protocolo}`);
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(partes.join(' '))}`;
}

export function protocoloFromSession(clientSessionId: string) {
  return clientSessionId ? clientSessionId.slice(-8).toUpperCase() : '';
}
