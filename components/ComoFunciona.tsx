'use client';

import { useEffect, useRef } from 'react';

const PASSOS = [
  { title: 'Envie o ofício', desc: 'Suba o PDF do seu ofício ou precatório em ambiente seguro, sem filas e sem formulários.' },
  { title: 'A IA analisa', desc: 'Em segundos, identificamos credor, ente devedor, tribunal e valores do seu crédito.' },
  { title: 'Você recebe a faixa de valor', desc: 'Veja uma estimativa indicativa de quanto seu precatório pode valer hoje.' },
  { title: 'Converse com um consultor', desc: 'Um especialista confirma a análise e apresenta a proposta oficial, sem compromisso.' },
];

export default function ComoFunciona() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@/lib/beams')
      .then(({ mountBeams }) => {
        if (canvasRef.current) {
          cleanup = mountBeams(canvasRef.current, {
            lightColor: '#0D1F38',
            backgroundColor: '#0B1B33',
            diffuseColor: '#050B16',
          });
        }
      })
      .catch(() => {});
    return () => cleanup?.();
  }, []);

  return (
    <section
      data-screen-label="Como Funciona"
      className="relative overflow-hidden bg-navy px-5 py-14 sm:px-8 sm:py-20 md:px-16 md:py-26"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(11,27,51,0.72)_0%,rgba(16,35,63,0.55)_55%,rgba(11,27,51,0.85)_100%)]" />

      <div className="relative mx-auto max-w-[1100px]">
        <div className="mb-10 text-center">
          <h2 className="mb-2.5 text-[clamp(24px,3vw,34px)] font-extrabold tracking-[-0.01em] text-white">
            Como funciona
          </h2>
          <p className="text-base text-[#9AA6BC]">Do envio do ofício à reunião com consultor.</p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-5">
          {PASSOS.map((p, i) => (
            <div key={p.title} className="rounded-[20px] border border-navy-border bg-navy-panel p-6">
              <div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(143,180,234,0.14)] text-sm font-extrabold text-sky">
                {i + 1}
              </div>
              <h4 className="mb-1.5 text-[15px] font-extrabold text-white">{p.title}</h4>
              <p className="text-sm leading-[1.55] text-[#9AA6BC]">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
