'use client';

import { useEffect } from 'react';
import { track } from '@/lib/track';
import type { Variante } from '@/lib/variante';

// Registra no dataLayer qual variante do teste A/B a pessoa viu (segmentação no GTM/GA/Meta).
export default function VarianteTracker({ variante }: { variante: Variante }) {
  useEffect(() => {
    track('ab_variante', { variante });
  }, [variante]);
  return null;
}
