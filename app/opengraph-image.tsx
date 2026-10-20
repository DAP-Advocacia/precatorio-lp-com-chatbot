import { OG_SIZE, renderOg } from '@/lib/og';

export const alt = 'Premium Office Precatórios';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpengraphImage() {
  return renderOg(
    'Tem um precatório para receber? Descubra quanto ele pode valer hoje.',
    'Análise gratuita, feita por especialistas e sem compromisso.'
  );
}
