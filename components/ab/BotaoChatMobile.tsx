'use client';

import { useEffect, useState } from 'react';
import { MessageCircleIcon } from 'lucide-react';
import { openChat } from '@/lib/chat-events';
import { track } from '@/lib/track';

// Barra fixa só no mobile/tablet (empilhado): leva ao chat (#ia) enquanto ele não está na tela.
// No desktop (2 colunas) o chat já aparece ao lado do "Como funciona", então a barra não existe.
export default function BotaoChatMobile() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const chat = document.getElementById('ia');
    if (!chat) return;
    const io = new IntersectionObserver(([entry]) => setVisivel(!entry.isIntersecting), { threshold: 0.15 });
    io.observe(chat);
    return () => io.disconnect();
  }, []);

  function ir() {
    track('cta_click', { origem: 'barra-mobile' });
    openChat('barra-mobile');
    // Fallback independente do listener da SecretariaDigital: sempre leva o usuário até o chat.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('ia')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-6 transition-all duration-300 lg:hidden ${
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
      style={{ background: 'linear-gradient(180deg, rgba(245,242,235,0) 0%, rgba(245,242,235,0.92) 55%)' }}
      aria-hidden={!visivel}
    >
      <button
        type="button"
        onClick={ir}
        tabIndex={visivel ? 0 : -1}
        className="pointer-events-auto mx-auto flex min-h-[52px] w-full max-w-[420px] cursor-pointer items-center justify-center gap-2.5 rounded-full border border-navy bg-navy px-6 font-sans text-base font-extrabold text-porcelain shadow-[0_12px_32px_rgba(11,27,51,0.3)] transition-colors duration-200 hover:border-transparent hover:bg-transparent hover:text-navy"
      >
        <MessageCircleIcon size={18} aria-hidden="true" />
        Falar com a Karen
      </button>
    </div>
  );
}
