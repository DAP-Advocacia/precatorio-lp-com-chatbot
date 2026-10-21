'use client';

import Image from 'next/image';
import { asset } from '@/lib/site';
import { track } from '@/lib/track';
import { whatsappLink, WA_DISPLAY } from '@/lib/whatsapp';

const CONTACT_EMAIL = 'felipeandrade@premiumofficeprecatorio.com';

export default function Footer() {
  const footerWhatsappLink = whatsappLink({ motivo: 'Vim pelo rodapé do site e quero falar com um especialista.' });

  return (
    <footer className="bg-[#1F2331] px-5 pt-10 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 sm:pb-10 md:px-16">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-8">
        <div className="min-w-0 flex-[1_1_260px]">
          <Image src={asset('/logo-white.png')} alt="Premium Office Precatórios" width={711} height={351} sizes="101px" className="mb-3.5 block h-[50px] w-auto" />
          <p className="m-0 max-w-[320px] text-sm leading-[1.6] text-[#9AA6BC]">
            Antecipe seu precatório com segurança jurídica, transparência e estratégia.
          </p>
        </div>
        <div className="min-w-0 flex-[1_1_220px] text-sm leading-[1.9] text-[#9AA6BC]">
          <div>Premium Office Precatórios</div>
          <div>CNPJ 45.102.131/0001-18</div>
          <div>Av. das Américas, 3443 – Barra da Tijuca, RJ</div>
        </div>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col items-start gap-2 text-sm leading-[1.6] text-[#9AA6BC]">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="max-w-full break-all text-[#9AA6BC] underline-offset-2 [overflow-wrap:anywhere] hover:text-white hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          <a
            href={footerWhatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { origem: 'footer' })}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sky/40 px-4 text-[15px] font-bold text-sky no-underline transition-colors hover:border-white hover:text-white"
          >
            {WA_DISPLAY} · WhatsApp
          </a>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-[1280px] text-[13px] leading-[1.6] text-[#9AA6BC]">
        Aviso: a análise inicial é indicativa. A proposta oficial e vinculante depende de validação
        documental e jurídica por um especialista.
      </p>
      {/* Resumo de privacidade (LGPD art. 9). TODO(jurídico): substituir/complementar por uma
          página de Política de Privacidade completa revisada pelo jurídico e linkar aqui. */}
      <details
        id="privacidade"
        className="mx-auto mt-2 max-w-[1280px] text-[13px] leading-[1.6] text-[#9AA6BC]"
      >
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center underline underline-offset-2 hover:text-white">
          Seus dados são tratados conforme a LGPD. Ler resumo da Política de Privacidade
        </summary>
        <div className="mt-2 flex max-w-[760px] flex-col gap-2 [overflow-wrap:anywhere]">
          <p className="m-0">
            <strong className="text-white">Quais dados:</strong> nome, celular, estado (UF), CPF e o ofício
            ou documento que você enviar. As mensagens da conversa no site não são gravadas em nossos
            sistemas.
          </p>
          <p className="m-0">
            <strong className="text-white">Para quê:</strong> analisar o seu crédito, preparar a proposta
            e entrar em contato com você sobre ela.
          </p>
          <p className="m-0">
            <strong className="text-white">Com quem compartilhamos:</strong> os dados ficam armazenados
            no Bitrix24, o CRM que a Premium Office usa para atender você. As mensagens do chat e o
            documento enviado são processados pela OpenAI para gerar as respostas e ler o ofício
            automaticamente.
          </p>
          <p className="m-0">
            <strong className="text-white">Seus direitos:</strong> você pode pedir acesso, correção ou
            exclusão dos seus dados, ou revogar o consentimento, pelo WhatsApp {WA_DISPLAY} ou pelo
            e-mail {CONTACT_EMAIL}.
          </p>
        </div>
      </details>
    </footer>
  );
}
