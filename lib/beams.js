// Guard + montagem sob demanda do efeito de feixes. O código WebGL (e o three) fica em
// beams-gl.js e só é baixado quando canMountBeams() permite.

const MIN_WIDTH = 768;

// Decide se vale a pena montar o WebGL. Em celular, aparelho fraco ou com
// prefers-reduced-motion, fica só o gradiente estático da seção (three nem é baixado).
export function canMountBeams() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.innerWidth < MIN_WIDTH) return false;
    if (window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches) return false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const nav = window.navigator || {};
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return false;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return false;
    if (nav.connection && nav.connection.saveData) return false;
    return true;
  } catch {
    return false;
  }
}

// Monta o efeito de forma assíncrona (three é importado só aqui, depois do guard)
// e devolve na hora uma função de cleanup segura, mesmo antes do three carregar.
export function mountBeams(canvas, opts = {}) {
  if (!canvas || !canMountBeams()) return function noop() {};

  let disposed = false;
  let teardown = null;

  import('./beams-gl')
    .then((mod) => {
      if (disposed) return;
      try {
        teardown = mod.startBeams(canvas, opts);
      } catch {
        teardown = null;
      }
    })
    .catch(() => {});

  return function cleanup() {
    disposed = true;
    if (teardown) {
      teardown();
      teardown = null;
    }
  };
}
