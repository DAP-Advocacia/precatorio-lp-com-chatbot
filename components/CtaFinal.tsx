'use client';

import { openChat } from '@/lib/chat-events';
import { track } from '@/lib/track';
import { whatsappLink } from '@/lib/whatsapp';
import type { Tema } from '@/components/Hero';

const WA_HREF = whatsappLink({ motivo: 'Vim pelo site e quero falar com um especialista.' });

export default function CtaFinal({ tema = 'escuro' }: { tema?: Tema }) {
  const claro = tema === 'claro';
  return (
    <section
      data-screen-label="CTA Final"
      aria-labelledby="cta-final-titulo"
      className={`relative overflow-hidden px-5 pt-14 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-16 md:px-16 md:py-20 ${claro ? 'bg-white' : 'bg-navy'}`}
    >
      {!claro && (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(11,27,51,0.72)_0%,rgba(16,35,63,0.55)_55%,rgba(11,27,51,0.85)_100%)]" />
      )}

      <div className="relative mx-auto flex max-w-[720px] flex-col items-center text-center">
        <h2
          id="cta-final-titulo"
          className={`m-0 text-[clamp(26px,3.4vw,38px)] font-extrabold leading-[1.2] tracking-[-0.02em] text-wrap-pretty ${claro ? 'text-navy' : 'text-white'}`}
        >
          Descubra se vale a pena antecipar seu precatório
        </h2>
        <p className={`mt-4 max-w-[560px] text-[17px] leading-[1.6] text-wrap-pretty sm:text-lg ${claro ? 'text-[#4B5563]' : 'text-[#C7CFDE]'}`}>
          Envie seu ofício e receba a análise de um especialista pelo WhatsApp.
        </p>

        <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
          <button
            type="button"
            onClick={() => {
              track('cta_click', { origem: 'cta-final' });
              openChat('cta-final');
            }}
            className={`inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-full border px-7 py-3.5 text-base font-extrabold transition-all duration-250 ease-out hover:-translate-y-px ${
              claro
                ? 'border-navy bg-navy text-white shadow-[0_12px_32px_rgba(13,31,56,0.22)] hover:border-transparent hover:bg-transparent hover:text-navy'
                : 'border-[rgba(143,180,234,0.45)] bg-[#F5F2EB] text-navy-accent hover:border-transparent hover:bg-navy hover:text-porcelain shadow-[0_12px_32px_rgba(13,31,56,0.35)]'
            }`}
          >
            Começar minha análise gratuita
          </button>
          <a
            href={WA_HREF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { origem: 'cta-final' })}
            className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-base font-bold no-underline transition-colors ${
              claro ? 'border-navy/30 text-navy hover:border-navy hover:bg-navy hover:text-white' : 'border-sky/50 text-sky hover:border-sky hover:bg-sky hover:text-navy-deep'
            }`}
          >
            Falar no WhatsApp
          </a>
        </div>

        <p className={`mt-4 text-sm font-medium ${claro ? 'text-[#6B7280]' : 'text-[#C7CFDE]'}`}>Sem custo · Sem compromisso</p>
      </div>
    </section>
  );
}
