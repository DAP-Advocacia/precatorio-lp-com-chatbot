import { OG_SIZE, renderOg } from '@/lib/og';
import { ARTIGOS } from '@/lib/artigos';

export const alt = 'Antecipação de precatório: como funciona a cessão de crédito';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpengraphImage() {
  return renderOg(ARTIGOS.antecipacao.titulo, 'Premium Office Precatórios', ARTIGOS.antecipacao.kicker);
}
