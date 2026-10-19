'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { openChat } from '@/lib/chat-events';
import { track } from '@/lib/track';

// Google G logo component
function GoogleLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.07-1.47-.22-2.12H12v3.84h6.6c-.13 1.1-.86 2.76-2.47 3.88l-.02.15 3.58 2.77.25.03c2.28-2.1 3.58-5.2 3.58-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.79-2.95c-1.02.71-2.4 1.21-4.16 1.21-3.18 0-5.88-2.1-6.84-5.02l-.14.01-3.73 2.9-.05.14C3.26 21.3 7.3 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.16 14.34a7.7 7.7 0 0 1-.4-2.34c0-.81.14-1.6.39-2.34l-.01-.16-3.78-2.94-.12.06A11.98 11.98 0 0 0 0 12c0 1.93.47 3.76 1.24 5.38l3.92-3.04Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c2.26 0 3.78.97 4.65 1.79l3.4-3.32C17.95 1.19 15.24 0 12 0 7.3 0 3.26 2.7 1.24 6.62l3.91 3.04C6.12 6.85 8.82 4.75 12 4.75Z"
      />
    </svg>
  );
}

// Gold star rating component
function RatingStars({ count = 5 }: { count?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count} de 5 estrelas`}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="h-3.5 w-3.5 fill-[#F5A623] text-[#F5A623]" viewBox="0 0 24 24">
          <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L5.8 21l1.6-7L2 9.2l7.1-.6L12 2z" />
        </svg>
      ))}
    </div>
  );
}

const GOOGLE_REVIEWS_URL =
  'https://www.google.com/search?q=Premium+Office+Precat%C3%B3rios+avaliacoes';

// Só vão ao ar números com `verified: true`. '+ 8 anos', '+ 7 mil' e '+ 700M' ficam ocultos até a
// empresa comprovar (o CNPJ do rodapé tem início de atividade em 2022; '+ 700M' não tem unidade
// clara). Para publicar um número, revise o texto e marque `verified: true`.
type Stat = { icon: React.ReactNode; value: string; label: string; verified: boolean };

const STATS_DATA: Stat[] = [
  {
    icon: (
      <svg
        className="h-6 w-6 text-navy"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    value: '+ 8 anos',
    label: 'TEMPO DE MERCADO',
    verified: false,
  },
  {
    icon: (
      <svg
        className="h-6 w-6 text-navy"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    value: '+ 7 mil',
    label: 'CLIENTES SATISFEITOS',
    verified: false,
  },
  {
    icon: (
      <svg
        className="h-6 w-6 text-navy"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    value: '+ 700M',
    label: 'EM PRECATÓRIOS',
    verified: false,
  },
  {
    icon: (
      <svg
        className="h-6 w-6 text-navy"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    // Nota pública verificável no Perfil da Empresa no Google (mesma do selo acima).
    value: '4,9 ★',
    label: 'NOTA NO GOOGLE',
    verified: true,
  },
];

const VISIBLE_STATS = STATS_DATA.filter((s) => s.verified);
// Classes estáticas (Tailwind JIT) por quantidade de cards visíveis.
const STATS_GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
};
// Com um único card (a nota do Google), a faixa repetiria o selo do cabeçalho: não renderiza.
const SHOW_STATS = VISIBLE_STATS.length >= 2;

const REVIEWS_DATA = [
  {
    name: 'Yuri Assunção',
    badge: 'Local Guide',
    url: 'https://www.google.com/search?q=Premium+Office+Precat%C3%B3rios+avaliacoes+Yuri+Assuncao',
    textParts: [
      'Empresa que atua de forma ',
      { highlight: 'séria e ética' },
      ' com a antecipação dos valores a tanto aguardado.',
    ],
  },
  {
    name: 'Paulo Vitor De Souza Pereira',
    badge: null,
    url: 'https://www.google.com/search?q=Premium+Office+Precat%C3%B3rios+avaliacoes+Paulo+Vitor+De+Souza+Pereira',
    textParts: [
      'Excelentes profissionais e uma ',
      { highlight: 'resolução rápida e eficaz' },
      '.',
    ],
  },
  {
    name: 'Marcelo Annis',
    badge: null,
    url: 'https://www.google.com/search?q=Premium+Office+Precat%C3%B3rios+avaliacoes+Marcelo+Annis',
    textParts: [
      'Gerente Franklin ',
      { highlight: 'muito atencioso e prestativo' },
      ', recomendo para todos.',
    ],
  },
];

const TESTIMONIAL_VIDEO_URL =
  'https://wbrpaisohembzudugdif.supabase.co/storage/v1/object/public/lp-media/depoimento-marlene.mp4';
const TESTIMONIAL_VIDEO_THUMBNAIL =
  'https://wbrpaisohembzudugdif.supabase.co/storage/v1/object/public/lp-media/depoimento-marlene-capa.jpg';

export default function SocialProof() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Trava de scroll do body: guarda o valor anterior e libera de forma idempotente, para que
  // o CTA possa liberar antes de abrir o chat (que pode aplicar a própria trava).
  const prevOverflowRef = useRef<string | null>(null);

  const unlockBody = useCallback(() => {
    if (prevOverflowRef.current === null) return;
    document.body.style.overflow = prevOverflowRef.current;
    prevOverflowRef.current = null;
  }, []);

  const openVideo = () => {
    track('video_play', { origem: 'depoimento' });
    setIsVideoModalOpen(true);
  };

  const closeVideo = useCallback(() => {
    unlockBody();
    setIsVideoModalOpen(false);
    triggerRef.current?.focus();
  }, [unlockBody]);

  const startAnalysis = (origemCta: string) => {
    track('cta_click', { origem: origemCta });
    unlockBody();
    setIsVideoModalOpen(false);
    openChat('depoimento');
  };

  useEffect(() => {
    if (!isVideoModalOpen) return;
    prevOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeVideo();
        return;
      }
      // Prende o foco dentro do diálogo (Tab / Shift+Tab circulam entre fechar, vídeo e CTA).
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], video[controls], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && dialogRef.current.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockBody();
    };
  }, [isVideoModalOpen, closeVideo, unlockBody]);

  return (
    <section data-screen-label="Prova Social" className="px-5 pt-0 pb-12 sm:px-8 sm:pt-0 sm:pb-16 md:px-16 md:pt-20 md:pb-20">
      <div className="mx-auto max-w-[1480px]">
        {/* Header with Title and Google Review Badge */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="m-0 text-[clamp(21px,2.2vw,28px)] font-extrabold leading-[1.25] tracking-[-0.01em] text-navy">
            Quem já recebeu seu precatório com a Premium Office Precatórios
          </h2>
          <p className="mt-1 text-sm text-[#5B6478]">
            Avaliações reais de clientes no Google
          </p>
        </div>

        <a
          href={GOOGLE_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver avaliações da Premium Office Precatórios no Google"
          className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-2xl border border-[#8FB4EA] bg-white px-3.5 py-2 text-inherit no-underline shadow-sm transition-all hover:border-navy hover:shadow-md sm:self-auto"
        >
          <GoogleLogo className="h-4.5 w-4.5 flex-shrink-0" />
          <span className="text-sm font-extrabold text-navy">4,9</span>
          <RatingStars count={5} />
          <span className="text-[13px] font-medium text-[#5B6478]">+100 avaliações</span>
        </a>
      </div>

      {/* Metrics Row: só números verificados */}
      {SHOW_STATS && (
      <div className={`grid gap-3 sm:gap-4 ${STATS_GRID_COLS[VISIBLE_STATS.length] ?? STATS_GRID_COLS[4]}`}>
        {VISIBLE_STATS.map((stat, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center rounded-[18px] border-[1.5px] border-[#8FB4EA] bg-[#EEF0F3] px-3 py-4 text-center shadow-[0_3px_12px_rgba(11,27,51,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:px-4 sm:py-5"
          >
            <div className="mb-2 flex items-center justify-center" aria-hidden="true">
              {stat.icon}
            </div>
            <div className="text-[clamp(20px,2vw,24px)] font-extrabold tracking-tight text-navy">
              {stat.value}
            </div>
            <div className="mt-1 text-[13px] font-bold uppercase leading-[1.3] tracking-wide text-[#4A5366]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Bottom Two-Column Section: Video Testimonial (Left) + Google Reviews (Right) */}
      <div className="mt-5 grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN: Featured Video Card */}
        <div className="flex flex-col overflow-hidden rounded-[18px] border-[1.5px] border-[#8FB4EA] bg-white shadow-sm lg:col-span-6 xl:col-span-7">
          {/* Video Player Area */}
          <button
            ref={triggerRef}
            type="button"
            onClick={openVideo}
            aria-label="Assistir ao depoimento em vídeo de Marlene Vieira"
            className="group relative m-0 flex aspect-[16/9] w-full cursor-pointer appearance-none items-center justify-center overflow-hidden border-0 bg-[#0D1F38] p-0 transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-sky"
          >
            {/* Video thumbnail */}
            <img
              src={TESTIMONIAL_VIDEO_THUMBNAIL}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {/* Darkening overlay for contrast with play button/badge */}
            <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(13,31,56,0.25)_0%,rgba(13,31,56,0.75)_100%)]" />

            {/* Play Button */}
            <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(255,255,255,0.4)]">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="#0B1B33"
                className="ml-0.5"
                aria-hidden="true"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            </span>

            {/* Bottom-left Pill Badge */}
            <span className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-md border border-white/15 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
              Depoimento em vídeo
            </span>
          </button>

          {/* Video Card Details */}
          <div className="flex flex-col justify-between p-4 sm:p-5">
            {/* Texto neutro, sem aspas: só publicar citação se for transcrição literal do vídeo
                aprovada pela empresa (e sem prometer prazo, que varia por caso). */}
            <p className="m-0 text-[15px] font-bold leading-[1.5] text-navy sm:text-base">
              Assista ao depoimento de Marlene Vieira, aposentada, contando como foi a experiência
              dela com a Premium Office Precatórios.
            </p>

            <button
              type="button"
              onClick={() => startAnalysis('depoimento-card')}
              className="mt-4 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-full border-0 bg-navy px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_8px_20px_rgba(11,27,51,0.2)] transition-colors hover:bg-navy-accent sm:w-auto sm:self-start"
            >
              Quero analisar meu precatório
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: 3 Google Review Cards with Direct Anchors */}
        <div className="flex flex-col gap-3 lg:col-span-6 xl:col-span-5">
          {REVIEWS_DATA.map((review, idx) => (
            <a
              key={idx}
              href={review.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Ver avaliação de ${review.name} no Google`}
              className="group block rounded-[18px] border-[1.5px] border-[#8FB4EA] bg-white p-4 text-inherit no-underline shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-navy hover:shadow-md"
            >
              {/* Header: Name + Tag + Google Logo */}
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-extrabold text-navy group-hover:text-navy-panel">
                      {review.name}
                    </span>
                    {review.badge && (
                      <span className="text-[13px] font-normal text-[#5B6478]">
                        {review.badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center">
                    <RatingStars count={5} />
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[#8A96AC] transition-transform duration-200 group-hover:scale-110">
                  <GoogleLogo className="h-4 w-4 flex-shrink-0" />
                  <svg
                    className="h-3 w-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
              </div>

              {/* Review Text */}
              <p className="mt-2.5 text-[15px] leading-[1.6] text-[#3B4457]">
                &ldquo;
                {review.textParts.map((part, pIdx) => {
                  if (typeof part === 'string') {
                    return <span key={pIdx}>{part}</span>;
                  }
                  return (
                    <strong key={pIdx} className="font-extrabold text-navy">
                      {part.highlight}
                    </strong>
                  );
                })}
                &rdquo;
              </p>
            </a>
          ))}
        </div>
      </div>

      {/* Video Modal: rola em paisagem, vídeo em largura total no celular, fecha com Esc. */}
      {isVideoModalOpen && (
        <div
          onClick={closeVideo}
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-navy/90 backdrop-blur-sm sm:p-4"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Depoimento em vídeo de Marlene Vieira"
              onClick={(e) => e.stopPropagation()}
              className="relative mx-auto w-full min-w-[280px] max-w-[min(42rem,calc((100vh-180px)*16/9))] overflow-hidden bg-navy-card shadow-2xl sm:rounded-2xl sm:border sm:border-[#8FB4EA]/40"
            >
              {/* Barra superior com o botão fechar, fora da área do vídeo (controles nativos) */}
              <div className="flex items-center justify-between gap-3 py-1 pl-4 pr-1 sm:pl-5 sm:pr-2 sm:pt-2">
                <span className="text-sm font-bold text-white">Marlene Vieira · Aposentada</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeVideo}
                  className="flex h-12 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-xl text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky"
                  aria-label="Fechar vídeo"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <div className="aspect-video w-full overflow-hidden bg-navy-deep sm:mx-auto sm:w-[calc(100%-2.5rem)] sm:rounded-xl">
                <video
                  src={TESTIMONIAL_VIDEO_URL}
                  poster={TESTIMONIAL_VIDEO_THUMBNAIL}
                  title="Depoimento em vídeo — cliente Premium Office Precatórios"
                  className="block h-full w-full"
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                />
              </div>
              <div className="flex flex-col items-center gap-3 px-4 pb-5 pt-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => startAnalysis('depoimento-modal')}
                  className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-full border-0 bg-[#F7F5F1] px-6 py-3 text-[15px] font-extrabold text-navy-accent transition-colors hover:bg-white sm:w-auto"
                >
                  Quero analisar meu precatório
                </button>
                <p className="text-center text-[13px] text-[#9AA6BC]">
                  Depoimento gravado com autorização do cliente.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
