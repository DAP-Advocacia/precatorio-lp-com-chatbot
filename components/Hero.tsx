'use client';

import Image from 'next/image';
import { useRef, type MouseEvent } from 'react';
import { openChat } from '@/lib/chat-events';
import { useBeams } from '@/lib/useBeams';
import { track } from '@/lib/track';
import { asset } from '@/lib/site';

// `claro`: fundo branco (variante B do teste A/B, /antecipar). O padrão é o fundo navy.
export type Tema = 'escuro' | 'claro';

const TRUST_MARKERS = ['Site seguro', 'Seus dados protegidos', 'Segurança jurídica em cada etapa'];

export default function Hero({ tema = 'escuro' }: { tema?: Tema }) {
  const claro = tema === 'claro';
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useBeams(canvasRef);

  function handleCta(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    track('cta_click', { origem: 'hero' });
    openChat('hero');
    // Fallback independente do listener do ChatSection: sempre leva o usuário até o chat.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('ia')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <section
      data-screen-label="Hero"
      className={`relative overflow-hidden px-5 pt-6 pb-10 sm:px-8 sm:py-14 md:px-16 md:py-16 ${
        claro
          ? 'bg-white'
          : 'bg-navy bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(143,180,234,0.22)_0%,rgba(11,27,51,0)_70%),linear-gradient(180deg,#0B1B33_0%,#10233F_60%,#0B1B33_100%)]'
      }`}
    >
      {!claro && (
        <>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 block h-full w-full opacity-0"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(11,27,51,0.72)_0%,rgba(16,35,63,0.55)_55%,rgba(11,27,51,0.85)_100%)]" />
        </>
      )}

      <div className="relative mx-auto flex max-w-[1280px] flex-col items-center justify-center pt-0 sm:pt-8">
        <div className="mx-auto flex w-full max-w-[800px] flex-col items-center text-center">
          <Image
            src={asset('/logo-white.png')}
            alt="Premium Office Precatórios"
            width={711}
            height={351}
            sizes="164px"
            priority
            className={`mb-4 block h-[52px] w-auto sm:mb-7 sm:h-[81px] ${claro ? 'brightness-0' : ''}`}
          />

          <div className={`mb-6 hidden items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold sm:inline-flex ${claro ? 'border-navy/15 bg-[#EEF0F3] text-navy' : 'border-sky/30 bg-white/5 text-sky'}`}>
            Antecipação de precatório · Titulares, herdeiros e advogados
          </div>

          <h1 className={`m-0 mb-4 max-w-[720px] text-[clamp(26px,7vw,46px)] font-extrabold leading-[1.2] tracking-[-0.02em] text-wrap-pretty sm:mb-5 sm:text-[clamp(30px,4vw,46px)] ${claro ? 'text-navy' : 'text-white'}`}>
            Tem um precatório para receber? Descubra quanto ele pode valer hoje.
          </h1>

          <p className={`m-0 mb-6 max-w-[560px] text-[16px] leading-[1.5] text-wrap-pretty sm:mb-8 sm:text-[clamp(17px,2vw,20px)] sm:leading-[1.65] ${claro ? 'text-[#4B5563]' : 'text-[#C7CFDE]'}`}>
            Em vez de esperar anos na fila de pagamento, você pode receber à vista. Análise
            gratuita, feita por especialistas e sem compromisso.
          </p>

          <a
            href="#ia"
            onClick={handleCta}
            className={`inline-flex min-h-[52px] w-full items-center justify-center rounded-full border px-7 py-3.5 text-base font-extrabold no-underline transition-all duration-250 ease-out hover:-translate-y-px hover:bg-navy-accent hover:text-white sm:w-auto sm:py-4 ${
              claro
                ? 'border-navy bg-navy text-white shadow-[0_12px_32px_rgba(13,31,56,0.22)]'
                : 'border-[rgba(143,180,234,0.45)] bg-[#F7F5F1] text-navy-accent shadow-[0_12px_32px_rgba(13,31,56,0.35)] hover:border-[rgba(143,180,234,0.45)] hover:shadow-[0_16px_38px_rgba(13,31,56,0.45)]'
            }`}
          >
            Analisar meu precatório
          </a>

          <p className={`m-0 mt-3 text-sm font-semibold ${claro ? 'text-[#4B5563]' : 'text-[#C7CFDE]'}`}>
            <span className="text-[#DAA520]" aria-hidden="true">
              ★
            </span>{' '}
            4,9 no Google · +100 avaliações
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 sm:mt-8">
            {TRUST_MARKERS.map((label) => (
              <div key={label} className="flex items-center gap-2">
                <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#DAA520]" />
                <span className={`text-[13px] font-medium sm:text-sm ${claro ? 'text-[#4B5563]' : 'text-[#C7CFDE]'}`}>{label}</span>
              </div>
            ))}
          </div>

          <p className={`m-0 mt-4 text-[13px] font-semibold sm:hidden ${claro ? 'text-navy' : 'text-sky'}`}>
            Para titulares, herdeiros e advogados
          </p>
        </div>
      </div>
    </section>
  );
}
