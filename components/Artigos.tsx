import Link from 'next/link';
import AnteciparAgoraCta from '@/components/AnteciparAgoraCta';
import { LISTA_ARTIGOS } from '@/lib/artigos';

export default function Artigos() {
  return (
    <section
      data-screen-label="Artigos"
      aria-labelledby="artigos-titulo"
      className="bg-mist px-5 py-12 sm:px-8 sm:py-16 md:px-16 md:py-20"
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-8 text-center sm:mb-10">
          <h2
            id="artigos-titulo"
            className="m-0 mb-2.5 text-[clamp(24px,3vw,34px)] font-extrabold tracking-[-0.01em] text-navy text-wrap-pretty"
          >
            Antecipação de precatório: entenda antes de decidir
          </h2>
          <p className="m-0 text-base text-[#4A5366]">
            Como antecipar seu precatório, passo a passo, e como funciona a cessão de crédito.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          {LISTA_ARTIGOS.map((a) => (
            <Link
              key={a.path}
              href={a.path}
              className="group flex flex-col rounded-2xl border border-[#D9DEE7] bg-white p-6 no-underline shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-7"
            >
              <span className="mb-3 inline-flex w-fit items-center rounded-md bg-navy px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-sky">
                Artigo · {a.kicker}
              </span>
              <h3 className="m-0 mb-2 text-[19px] font-extrabold leading-[1.3] text-navy sm:text-[21px]">{a.titulo}</h3>
              <p className="m-0 mb-5 flex-1 text-[15px] leading-[1.6] text-[#4A5366]">{a.resumo}</p>
              <span className="text-[15px] font-bold text-navy-accent group-hover:underline group-hover:underline-offset-2">
                Ler artigo →
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex justify-center sm:mt-10">
          <AnteciparAgoraCta origem="artigos-home" tone="onLight" className="w-full sm:w-auto" />
        </div>
      </div>
    </section>
  );
}
