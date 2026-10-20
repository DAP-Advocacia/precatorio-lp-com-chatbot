import Image from 'next/image';
import Link from 'next/link';
import AnteciparAgoraCta from '@/components/AnteciparAgoraCta';
import Footer from '@/components/Footer';
import { artigoJsonLd, LISTA_ARTIGOS, type Artigo } from '@/lib/artigos';

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 mb-3 mt-10 text-[clamp(21px,2.6vw,27px)] font-extrabold leading-[1.25] tracking-[-0.01em] text-navy">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mb-4 text-[16.5px] leading-[1.75] text-[#2E3647]">{children}</p>;
}

export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="m-0 mb-5 flex list-disc flex-col gap-2 pl-5 text-[16.5px] leading-[1.7] text-[#2E3647]">{children}</ul>;
}

export default function ArticleLayout({
  artigo,
  origem,
  children,
}: {
  artigo: Artigo;
  origem: string;
  children: React.ReactNode;
}) {
  const outro = LISTA_ARTIGOS.find((a) => a.path !== artigo.path);

  return (
    <div className="min-h-screen overflow-x-hidden bg-mist text-ink font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(artigoJsonLd(artigo)) }} />

      <header className="bg-navy bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(143,180,234,0.22)_0%,rgba(11,27,51,0)_70%),linear-gradient(180deg,#0B1B33_0%,#10233F_60%,#0B1B33_100%)] px-5 pt-5 pb-10 sm:px-8 sm:pb-14 md:px-16">
        <div className="mx-auto max-w-[860px]">
          <div className="mb-8 flex items-center justify-between gap-4 sm:mb-10">
            <Link href="/" aria-label="Premium Office Precatórios, página inicial">
              <Image
                src="/logo-white.png"
                alt="Premium Office Precatórios"
                width={711}
                height={351}
                sizes="120px"
                priority
                className="block h-[44px] w-auto sm:h-[56px]"
              />
            </Link>
            <Link href="/" className="text-sm font-semibold text-sky no-underline hover:text-white">
              Página inicial
            </Link>
          </div>

          <nav aria-label="Você está em" className="mb-4 text-[13px] font-medium text-[#9AA6BC]">
            <Link href="/" className="text-[#9AA6BC] no-underline hover:text-white">
              Início
            </Link>
            <span aria-hidden="true"> › </span>
            <span className="text-[#C7CFDE]">{artigo.kicker}</span>
          </nav>

          <h1 className="m-0 text-[clamp(28px,5vw,44px)] font-extrabold leading-[1.18] tracking-[-0.02em] text-white text-wrap-pretty">
            {artigo.titulo}
          </h1>
          <p className="m-0 mt-4 max-w-[680px] text-[17px] leading-[1.6] text-[#C7CFDE] text-wrap-pretty sm:text-lg">
            {artigo.resumo}
          </p>
          <p className="m-0 mt-5 text-[13px] font-semibold text-[#9AA6BC]">
            Por Premium Office Precatórios ·{' '}
            <time dateTime={artigo.publicado}>
              {new Date(`${artigo.publicado}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </time>
          </p>
        </div>
      </header>

      <main className="px-5 py-10 sm:px-8 sm:py-14 md:px-16">
        <article className="mx-auto max-w-[760px] rounded-2xl bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-12">
          {children}

          <aside className="mt-12 rounded-2xl bg-navy p-6 text-center sm:p-8" aria-label="Antecipar agora">
            <div className="text-[clamp(21px,2.6vw,26px)] font-extrabold leading-[1.25] text-white text-wrap-pretty">
              Antecipar agora: descubra quanto seu precatório pode valer hoje
            </div>
            <p className="m-0 mx-auto mt-3 max-w-[480px] text-[15px] leading-[1.6] text-[#C7CFDE]">
              Envie o ofício e receba a análise de um especialista. Sem custo e sem compromisso.
            </p>
            <div className="mt-6 flex justify-center">
              <AnteciparAgoraCta origem={origem} className="w-full sm:w-auto" />
            </div>
          </aside>

          {outro && (
            <p className="m-0 mt-8 text-[15px] leading-[1.6] text-[#4A5366]">
              Leia também:{' '}
              <Link href={outro.path} className="font-bold text-navy-accent underline underline-offset-2">
                {outro.titulo}
              </Link>
            </p>
          )}

          <p className="m-0 mt-8 border-t border-[#E3E7EE] pt-5 text-[13px] leading-[1.6] text-[#6B7487]">
            Conteúdo informativo, sem caráter de aconselhamento jurídico. A proposta oficial e vinculante depende de
            validação documental e jurídica por um especialista.
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}
