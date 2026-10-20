'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';
import { openChat } from '@/lib/chat-events';
import { track } from '@/lib/track';

type Props = {
  origem: string;
  label?: string;
  // 'onDark': botão claro para fundo navy; 'onLight': botão navy para fundo claro.
  tone?: 'onDark' | 'onLight';
  className?: string;
};

const TONES = {
  onDark:
    'border border-[rgba(143,180,234,0.45)] bg-[#F7F5F1] text-navy-accent shadow-[0_12px_32px_rgba(13,31,56,0.35)] hover:bg-navy-accent hover:text-white',
  onLight:
    'border border-navy bg-navy text-white shadow-[0_12px_32px_rgba(13,31,56,0.25)] hover:bg-navy-accent hover:border-navy-accent',
};

// Na home abre o chat (#ia) como os demais CTAs; nas páginas de artigo, navega até a home no chat.
export default function AnteciparAgoraCta({
  origem,
  label = 'Antecipar agora meu precatório',
  tone = 'onDark',
  className = '',
}: Props) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    track('cta_click', { origem });
    const chat = document.getElementById('ia');
    if (!chat) return;
    e.preventDefault();
    openChat(origem);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    chat.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <Link
      href="/#ia"
      onClick={handleClick}
      className={`inline-flex min-h-[52px] items-center justify-center rounded-full px-7 py-3.5 text-center text-base font-extrabold no-underline transition-all duration-250 ease-out hover:-translate-y-px ${TONES[tone]} ${className}`}
    >
      {label}
    </Link>
  );
}
