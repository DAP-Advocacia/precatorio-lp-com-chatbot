'use client';

import { useEffect } from 'react';
import { captureAttribution } from '@/lib/attribution';

// Captura UTMs/click IDs em qualquer rota de entrada (home ou artigo). Sem isto, quem chega
// por um anúncio direto num artigo perderia a origem ao navegar para o chat na home.
export default function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
