// Evento global para qualquer CTA da página abrir o chat (#ia).
// No celular o ChatSection abre em tela cheia; no desktop rola até a seção e foca o chat.
export const OPEN_CHAT_EVENT = 'po:open-chat';

export function openChat(origem: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { origem } }));
}
