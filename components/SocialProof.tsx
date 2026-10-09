'use client';

import React, { useState } from 'react';

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

const STATS_DATA = [
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
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <polyline points="17 11 19 13 23 9" />
      </svg>
    ),
    value: '100 %',
    label: 'SATISFAÇÃO DOS CLIENTES',
  },
];

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
  'https://player.mediadelivery.net/play/774224/72230f2e-9972-4cd3-b7dd-a1d20f1aae38';
const TESTIMONIAL_VIDEO_THUMBNAIL =
  'https://vz-b05a0ec7-146.b-cdn.net/72230f2e-9972-4cd3-b7dd-a1d20f1aae38/thumbnail.jpg';

export default function SocialProof() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  return (
    <section className="mx-auto mt-12 max-w-[1480px]">
      {/* Header with Title and Google Review Badge */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[clamp(20px,2.2vw,28px)] font-extrabold tracking-[-0.01em] text-navy">
            Quem já recebeu seu precatório com a Premium Office Precatórios
          </h2>
          <p className="mt-0.5 text-sm text-[#5B6478]">
            Avaliações reais de clientes no Google
          </p>
        </div>

        <a
          href={GOOGLE_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver avaliações da Premium Office Precatórios no Google"
          className="inline-flex items-center gap-2 self-start rounded-2xl border border-[#8FB4EA] bg-white px-3.5 py-2 text-inherit no-underline shadow-sm transition-all hover:border-navy hover:shadow-md sm:self-auto"
        >
          <GoogleLogo className="h-4.5 w-4.5 flex-shrink-0" />
          <span className="text-sm font-extrabold text-navy">[4,9]</span>
          <RatingStars count={5} />
          <span className="text-xs font-medium text-[#7C879C]">[N] avaliações</span>
        </a>
      </div>

      {/* Metrics Row (4 Cards) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATS_DATA.map((stat, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center rounded-[18px] border-[1.5px] border-[#8FB4EA] bg-[#EEF0F3] px-3.5 py-4 text-center shadow-[0_3px_12px_rgba(11,27,51,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:px-4 sm:py-5"
          >
            <div className="mb-2 flex items-center justify-center">
              {stat.icon}
            </div>
            <div className="text-[clamp(19px,2vw,24px)] font-extrabold tracking-tight text-navy">
              {stat.value}
            </div>
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-[#5B6478] sm:text-xs">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Two-Column Section: Video Testimonial (Left) + Google Reviews (Right) */}
      <div className="mt-5 grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN: Featured Video Card */}
        <div className="flex flex-col overflow-hidden rounded-[18px] border-[1.5px] border-[#8FB4EA] bg-white shadow-sm lg:col-span-6 xl:col-span-7">
          {/* Video Player Area */}
          <div
            onClick={() => setIsVideoModalOpen(true)}
            className="group relative flex aspect-[16/9] w-full cursor-pointer items-center justify-center overflow-hidden bg-[#0D1F38] transition-colors"
          >
            {/* Video thumbnail */}
            <img
              src={TESTIMONIAL_VIDEO_THUMBNAIL}
              alt="Depoimento em vídeo de Marlene Vieira, cliente Premium Office Precatórios"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            {/* Darkening overlay for contrast with play button/badge */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(13,31,56,0.25)_0%,rgba(13,31,56,0.75)_100%)]" />

            {/* Play Button */}
            <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(255,255,255,0.4)]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="#0B1B33"
                className="ml-0.5"
                aria-hidden="true"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            </div>

            {/* Bottom-left Pill Badge */}
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-md border border-white/15 bg-black/60 px-2.5 py-1 text-[10.5px] font-semibold text-white backdrop-blur-md">
              <span>Depoimento em vídeo</span>
            </div>
          </div>

          {/* Video Card Details */}
          <div className="flex flex-col justify-between p-4 sm:p-5">
            <blockquote className="text-sm font-bold leading-snug text-navy sm:text-base">
              &ldquo;[Frase de destaque do cliente no vídeo]&rdquo;
            </blockquote>

            <div className="mt-3.5 border-t border-[#EAEDF2] pt-3">
              <div className="text-[13px] font-extrabold text-navy">Marlene Vieira</div>
              <div className="text-[11px] text-[#7C879C]">Aposentada</div>
            </div>
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
              className="group block rounded-[18px] border-[1.5px] border-[#8FB4EA] bg-white p-3.5 text-inherit no-underline shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-navy hover:shadow-md sm:p-4"
            >
              {/* Header: Name + Tag + Google Logo */}
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-extrabold text-navy group-hover:text-navy-panel sm:text-sm">
                      {review.name}
                    </span>
                    {review.badge && (
                      <span className="text-[10.5px] font-normal text-[#8A96AC]">
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
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
              </div>

              {/* Review Text */}
              <p className="mt-2.5 text-[12.5px] leading-[1.55] text-[#3B4457] sm:text-[13px]">
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

      {/* Interactive Video Modal Preview */}
      {isVideoModalOpen && (
        <div
          onClick={() => setIsVideoModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#8FB4EA]/40 bg-navy-card p-6 shadow-2xl"
          >
            <button
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white hover:bg-navy-accent"
              aria-label="Fechar"
            >
              ✕
            </button>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-navy-deep">
              <iframe
                src={`${TESTIMONIAL_VIDEO_URL}?autoplay=true`}
                title="Depoimento em vídeo — cliente Premium Office Precatórios"
                loading="lazy"
                className="h-full w-full border-0"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
              />
            </div>
            <p className="mt-3 text-center text-xs text-[#8A96AC]">
              Depoimento gravado com autorização do cliente.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
