'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';

// Stepper adaptado do React Bits (reactbits.dev, "Stepper"): indicadores com check animado,
// conectores que preenchem e transição deslizante entre etapas. Aqui é controlado pelo pai,
// que valida cada etapa antes de avançar, e usa a paleta da LP em vidro (glassmorphism).

type Props = {
  etapa: number; // 0-based
  titulos: string[];
  direcao: 1 | -1;
  children: ReactNode; // conteúdo da etapa atual
};

function Indicador({ indice, etapa, titulo }: { indice: number; etapa: number; titulo: string }) {
  const status = etapa === indice ? 'ativa' : etapa > indice ? 'feita' : 'pendente';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        initial={false}
        animate={status}
        variants={{
          pendente: { scale: 1, backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.25)', color: '#C7CFDE' },
          ativa: { scale: 1.08, backgroundColor: 'rgba(245,242,235,0.18)', borderColor: '#F5F2EB', color: '#F5F2EB' },
          feita: { scale: 1, backgroundColor: '#F5F2EB', borderColor: '#F5F2EB', color: '#0B1B33' },
        }}
        transition={{ duration: 0.3 }}
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold"
        aria-current={status === 'ativa' ? 'step' : undefined}
      >
        {status === 'feita' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
            <motion.path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.1, type: 'tween', ease: 'easeOut', duration: 0.3 }}
            />
          </svg>
        ) : (
          <span>{indice + 1}</span>
        )}
      </motion.div>
      <span className={`hidden text-[12px] font-semibold sm:block ${status === 'pendente' ? 'text-[#9AA6BC]' : 'text-white'}`}>{titulo}</span>
    </div>
  );
}

function Conector({ completo }: { completo: boolean }) {
  return (
    <div className="relative mx-1.5 mt-[17px] h-0.5 flex-1 overflow-hidden rounded bg-white/15 sm:mx-2.5">
      <motion.div
        className="absolute left-0 top-0 h-full bg-porcelain"
        initial={false}
        animate={{ width: completo ? '100%' : '0%' }}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}

export default function Stepper({ etapa, titulos, direcao, children }: Props) {
  return (
    <div>
      <div className="mb-6 flex items-start" aria-label={`Passo ${etapa + 1} de ${titulos.length}`}>
        {titulos.map((t, i) => (
          <div key={t} className={`flex items-start ${i < titulos.length - 1 ? 'flex-1' : ''}`}>
            <Indicador indice={i} etapa={etapa} titulo={t} />
            {i < titulos.length - 1 && <Conector completo={etapa > i} />}
          </div>
        ))}
      </div>
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} mode="wait" custom={direcao}>
          <motion.div
            key={etapa}
            custom={direcao}
            // Avançando, a etapa entra pela direita e sai pela esquerda; voltando, o inverso.
            variants={{
              centro: { x: '0%', opacity: 1 },
              sai: (d: number) => ({ x: d >= 0 ? '-12%' : '12%', opacity: 0 }),
            }}
            initial={{ x: direcao >= 0 ? '12%' : '-12%', opacity: 0 }}
            animate="centro"
            exit="sai"
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
