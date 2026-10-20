import { OG_SIZE, renderOg } from '@/lib/og';
import { ARTIGOS } from '@/lib/artigos';

export const alt = 'Como antecipar seu precatório em 5 passos';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpengraphImage() {
  return renderOg(ARTIGOS.comoAntecipar.titulo, 'Premium Office Precatórios', ARTIGOS.comoAntecipar.kicker);
}
