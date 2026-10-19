import Image from 'next/image';
import { FAQ_DATA } from '@/lib/data';

export default function Faq() {
  return (
    <section data-screen-label="FAQ" className="bg-white px-5 pt-12 pb-12 sm:px-8 sm:pt-16 sm:pb-16 md:px-16 md:pt-20 md:pb-20">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="m-0 text-[clamp(24px,3vw,34px)] font-extrabold tracking-[-0.01em] text-navy">
            Perguntas frequentes
          </h2>
        </div>

        <div className="flex flex-col items-stretch gap-10 lg:flex-row lg:gap-16">
          {/* <details> nativo: acessível por teclado e sem JavaScript no cliente. */}
          <div className="flex flex-[1_1_50%] flex-col gap-4">
            {FAQ_DATA.map((f) => (
              <details
                key={f.question}
                className="group rounded-[10px] bg-[#F4F6F9] px-4 py-1"
                style={{ borderBottom: '1px solid #EAEDF2' }}
              >
                <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-1 py-4 text-[16px] font-bold leading-[1.4] text-navy [&::-webkit-details-marker]:hidden">
                  <span>{f.question}</span>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    aria-hidden="true"
                    className="flex-shrink-0 text-navy-accent transition-transform duration-200 group-open:rotate-180"
                  >
                    <path d="M3.135 6.158a.5.5 0 0 1 .707-.023L7.5 9.565l3.658-3.43a.5.5 0 0 1 .684.73l-4 3.75a.5.5 0 0 1-.684 0l-4-3.75a.5.5 0 0 1-.023-.707Z" fill="currentColor" />
                  </svg>
                </summary>
                <p className="m-0 px-1 pb-4 text-[15px] leading-[1.65] text-[#4A5366]">{f.answer}</p>
              </details>
            ))}
          </div>

          {/* Imagem só aparece no desktop. Com loading lazy dentro de display:none (abaixo de lg)
              o navegador não baixa o arquivo; sizes 0px garante a menor variante se baixar. */}
          <div className="hidden flex-[1_1_50%] lg:block">
            <Image
              src="/criativo-premium-office-celular.png"
              alt="Premium Office Precatórios"
              width={1080}
              height={1350}
              sizes="(min-width: 1024px) 50vw, 0px"
              loading="lazy"
              className="h-full w-full rounded-2xl object-cover shadow-lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
