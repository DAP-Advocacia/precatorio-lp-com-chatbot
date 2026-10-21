// Teste A/B: cada rota de entrada identifica a variante, que vai para o card do Bitrix
// (título, origem e comentário) e para o dataLayer, para medir e segregar os leads.
//   lp          /          LP original (chat roteirizado)
//   chat        /chat      Variante A: secretária digital (agente conversacional)
//   formulario  /antecipe  Variante B: formulário em etapas (stepper)
export const VARIANTES = ['lp', 'chat', 'formulario'] as const;
export type Variante = (typeof VARIANTES)[number];

export const VARIANTE_ROTULO: Record<Variante, string> = {
  lp: 'LP original',
  chat: 'Teste A - Secretária digital (chat)',
  formulario: 'Teste B - Formulário em etapas',
};

export function isVariante(v: unknown): v is Variante {
  return typeof v === 'string' && (VARIANTES as readonly string[]).includes(v);
}
