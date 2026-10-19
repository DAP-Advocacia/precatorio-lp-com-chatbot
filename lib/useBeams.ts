import { useEffect, type RefObject } from 'react';

const BEAM_COLORS = {
  lightColor: '#0D1F38',
  backgroundColor: '#0B1B33',
  diffuseColor: '#050B16',
};

// mountBeams só monta no desktop/aparelho capaz e sem reduced-motion; no resto fica o
// gradiente estático da seção e o three nem é baixado.
export function useBeams(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import('@/lib/beams')
      .then(({ mountBeams }) => {
        if (cancelled || !canvasRef.current) return;
        cleanup = mountBeams(canvasRef.current, BEAM_COLORS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [canvasRef]);
}
