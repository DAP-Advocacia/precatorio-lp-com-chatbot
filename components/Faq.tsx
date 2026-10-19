'use client';

import Image from 'next/image';
import { Accordion } from '@mantine/core';
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
          <div className="flex-[1_1_50%]">
            <Accordion
              variant="separated"
              chevronPosition="right"
              styles={{
                item: { backgroundColor: '#F4F6F9', border: 'none', borderBottom: '1px solid #EAEDF2', borderRadius: '10px', padding: '4px 16px' },
                control: { padding: '16px 4px', minHeight: 48 },
                label: { fontSize: 16, fontWeight: 700, color: '#0B1B33', lineHeight: 1.4 },
                content: { padding: '0 4px 16px', fontSize: 15, color: '#4A5366', lineHeight: 1.65 },
                chevron: { color: '#0D1F38' },
              }}
            >
              {FAQ_DATA.map((f, i) => (
                <Accordion.Item key={i} value={String(i)}>
                  <Accordion.Control>{f.question}</Accordion.Control>
                  <Accordion.Panel>{f.answer}</Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
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
