// Teste A/B: cada rota de entrada identifica a variante, que vai para o card do Bitrix
// (título, origem e comentário) e para o dataLayer, para medir e segregar os leads.
//   chat        /           Variante A: secretária digital (agente conversacional)
//   formulario  /antecipar  Variante B: formulário em etapas (stepper)
//   lp          (sem rota)  LP original com o chat roteirizado (ChatSection), fora do teste
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
