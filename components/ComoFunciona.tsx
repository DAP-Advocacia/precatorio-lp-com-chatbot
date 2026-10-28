'use client';

import { useRef, type MouseEvent } from 'react';
import { openChat } from '@/lib/chat-events';
import { useBeams } from '@/lib/useBeams';
import { track } from '@/lib/track';
import type { Tema } from '@/components/Hero';

type TagType = 'user' | 'ai' | 'consultant';

const STEPS: { step: number; tagType: TagType; title: string; desc: string }[] = [
  {
    step: 1,
    tagType: 'user',
    title: 'Informe nome e WhatsApp',
    desc: 'Só o básico para o especialista conseguir falar com você.',
  },
  {
    step: 2,
    tagType: 'user',
    title: 'Envie o ofício',
    desc: 'Em PDF ou foto, direto do celular, em ambiente seguro.',
  },
  {
    step: 3,
    tagType: 'ai',
    title: 'A IA lê o documento',
    desc: 'Identifica credor, tribunal, natureza e valor do seu crédito.',
  },
  {
    step: 4,
    tagType: 'consultant',
    title: 'Um especialista prepara sua proposta',
    desc: 'Ele revisa a análise e apresenta a proposta, sem custo e sem compromisso.',
  },
];

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function TagPill({ type, claro }: { type: TagType; claro: boolean }) {
  if (type === 'user') {
    return (
      <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ${claro ? 'bg-[#DBEAFE] text-[#1D4ED8]' : 'bg-[#0F2850] text-[#60A5FA]'}`}>
        Você
      </span>
    );
  }
  if (type === 'ai') {
    return (
      <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold ${claro ? 'bg-[#E2E8F0] text-[#334155]' : 'bg-[#1C273C] text-[#CBD5E1]'}`}>
        IA
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${claro ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#09351C] text-[#22C55E]'}`}>
      <PersonIcon className="h-3.5 w-3.5" />
      Consultor
    </span>
  );
}

// `coluna`: versão para dividir a linha com a secretária digital (home, fundo porcelain): lista vertical
// em todas as larguras, sem fundo próprio (o wrapper da página fornece o porcelain).
export default function ComoFunciona({ tema = 'escuro', layout = 'linha' }: { tema?: Tema; layout?: 'linha' | 'coluna' }) {
  const coluna = layout === 'coluna';
  const claro = tema === 'claro' || coluna;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useBeams(canvasRef);

  function handleCta(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    track('cta_click', { origem: 'como-funciona' });
    openChat('como-funciona');
    // Fallback independente do listener do ChatSection: sempre leva o usuário até o chat.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('ia')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <section
      data-screen-label="Como Funciona"
      className={`relative overflow-hidden ${
        coluna
          ? 'px-4 pb-12 pt-2 sm:px-8 sm:pb-16 lg:flex lg:flex-col lg:justify-center lg:px-10 lg:py-16'
          : 'px-5 py-12 sm:px-8 sm:py-20 md:px-16 md:py-24'
      } ${
        coluna
          ? ''
          : claro
          ? 'bg-white'
          : 'bg-navy bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(143,180,234,0.16)_0%,rgba(11,27,51,0)_70%),linear-gradient(180deg,#0B1B33_0%,#10233F_55%,#0B1B33_100%)]'
      }`}
    >
      {!claro && (
        <>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 block h-full w-full opacity-0"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(11,27,51,0.85)_0%,rgba(16,35,63,0.72)_55%,rgba(11,27,51,0.92)_100%)]" />
        </>
      )}

      <div className={`relative mx-auto w-full ${coluna ? 'max-w-[560px] lg:max-w-[520px]' : 'max-w-[1140px]'}`}>
        {/* Section Header */}
        <div className={`mb-6 sm:mb-8 ${coluna ? 'text-left' : 'text-center sm:mb-12'}`}>
          <h2 className={`m-0 mb-2.5 text-[clamp(24px,3vw,34px)] font-extrabold tracking-[-0.01em] ${claro ? 'text-navy' : 'text-white'}`}>
            Como funciona
          </h2>
          <p className={`m-0 text-base ${claro ? 'text-[#6B7280]' : 'text-[#9AA6BC]'}`}>
            Do envio do ofício à proposta de um especialista.
          </p>
        </div>

        {/* Mobile: lista vertical compacta */}
        <ol className={`m-0 flex list-none flex-col gap-3 p-0 ${coluna ? '' : 'sm:hidden'}`}>
          {STEPS.map((s) => (
            <li
              key={s.step}
              className={`flex items-start gap-3.5 rounded-xl p-4 ${coluna ? 'bg-white shadow-[0_6px_18px_rgba(11,27,51,0.06)]' : claro ? 'bg-[#F5F2EB]' : 'bg-[#0E182A]/90'} ${
                s.tagType === 'consultant' ? 'border border-[#16A34A]/55' : coluna ? 'border border-[#E0DACE]' : claro ? 'border border-[#E5E7EB]' : 'border border-[#1E2D4A]'
              }`}
            >
              <span
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${
                  s.tagType === 'consultant' ? 'bg-[#16A34A]' : 'bg-[#1677FF]'
                }`}
              >
                {s.step}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className={`m-0 text-base font-extrabold leading-snug ${claro ? 'text-navy' : 'text-white'}`}>{s.title}</h3>
                  <TagPill type={s.tagType} claro={claro} />
                </div>
                <p className={`m-0 text-[15px] leading-[1.5] ${claro ? 'text-[#4B5563]' : 'text-[#9AA6BC]'}`}>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Timeline Row (Step Numbers + Connecting Line) - Desktop (lg) */}
        <div className={`relative mb-6 hidden ${coluna ? '!hidden' : 'lg:block'}`}>
          <div className={`absolute top-1/2 left-[12.5%] right-[12.5%] h-[2px] -translate-y-1/2 ${claro ? 'bg-[#E5E7EB]' : 'bg-[#28354A]'}`} />
          <div className="grid grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.step} className="flex justify-center">
                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#1677FF] text-base font-extrabold text-white shadow-[0_0_16px_rgba(22,119,255,0.45)]">
                  {s.step}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cards Grid - tablet (2 col) e desktop (4 col) */}
        <div className={`hidden gap-4 ${coluna ? '!hidden' : 'sm:grid sm:grid-cols-2 lg:grid-cols-4 lg:gap-5'}`}>
          {STEPS.map((s) => (
            <div
              key={s.step}
              className={`flex min-h-[200px] flex-col rounded-2xl p-6 backdrop-blur-md transition-all duration-200 ${claro ? 'bg-[#F5F2EB]' : 'bg-[#0E182A]/90'} ${
                s.tagType === 'consultant'
                  ? 'border border-[#16A34A]/55 shadow-[0_0_24px_rgba(22,163,74,0.12)]'
                  : claro
                    ? 'border border-[#E5E7EB] shadow-[0_8px_20px_rgba(11,27,51,0.06)]'
                    : 'border border-[#1E2D4A] shadow-[0_8px_20px_rgba(5,11,22,0.35)]'
              }`}
            >
              {/* Número do passo (tablet; no desktop vem da timeline) */}
              <div className="mb-3 flex lg:hidden">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1677FF] text-xs font-extrabold text-white">
                  {s.step}
                </div>
              </div>

              <div className="mb-3">
                <TagPill type={s.tagType} claro={claro} />
              </div>

              <h3 className={`m-0 mb-2 text-[17px] font-extrabold leading-snug ${claro ? 'text-navy' : 'text-white'}`}>{s.title}</h3>
              <p className={`m-0 text-sm leading-[1.55] ${claro ? 'text-[#4B5563]' : 'text-[#9AA6BC]'}`}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Rodapés de grupo - Desktop */}
        <div className={`mt-5 hidden ${coluna ? '!hidden' : 'lg:grid lg:grid-cols-4 lg:gap-5'}`}>
          {/* Sua ação: passos 1 e 2 */}
          <div className="col-span-2 flex flex-col items-center">
            <div className="h-[2px] w-full rounded-full bg-[#1D4ED8]" />
            <span className="mt-2.5 text-[13px] font-bold text-[#3B82F6]">Sua ação</span>
          </div>

          {/* IA: passo 3 */}
          <div className="flex flex-col items-center">
            <div className={`h-[1.5px] w-full rounded-full ${claro ? 'bg-[#CBD5E1]' : 'bg-[#2A3952]'}`} />
            <span className={`mt-2.5 text-[13px] font-bold ${claro ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>IA</span>
          </div>

          {/* Pessoa real: passo 4 */}
          <div className="flex flex-col items-center">
            <div className="h-[2px] w-full rounded-full bg-[#16A34A]" />
            <span className="mt-2.5 text-[13px] font-bold text-[#22C55E]">Pessoa real</span>
          </div>
        </div>

        {/* CTA */}
        <div className={`mt-6 flex sm:mt-8 ${coluna ? 'justify-center' : 'justify-center sm:mt-12'}`}>
          <a
            href="#ia"
            onClick={handleCta}
            className={`inline-flex min-h-[52px] w-full items-center justify-center rounded-full border px-7 py-3.5 text-base font-extrabold no-underline transition-all duration-250 ease-out hover:-translate-y-px sm:w-auto sm:py-4 ${
              claro
                ? 'border-navy bg-navy text-white shadow-[0_12px_32px_rgba(13,31,56,0.22)] hover:border-transparent hover:bg-transparent hover:text-navy'
                : 'border-[rgba(143,180,234,0.45)] bg-[#F5F2EB] text-navy-accent hover:border-transparent hover:bg-navy hover:text-porcelain shadow-[0_12px_32px_rgba(5,11,22,0.45)]'
            }`}
          >
            Começar minha análise gratuita
          </a>
        </div>
      </div>
    </section>
  );
}
