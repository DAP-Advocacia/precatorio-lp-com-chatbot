import Hero from '@/components/Hero';
import SecretariaDigital from '@/components/ab/SecretariaDigital';
import VarianteTracker from '@/components/ab/VarianteTracker';
import ComoFunciona from '@/components/ComoFunciona';
import BotaoChatMobile from '@/components/ab/BotaoChatMobile';
import SocialProof from '@/components/SocialProof';
import Faq from '@/components/Faq';
import CtaFinal from '@/components/CtaFinal';
import Footer from '@/components/Footer';
import { FAQ_DATA } from '@/lib/data';

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_DATA.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
};

// Home = variante A do teste A/B (secretária digital). A variante B (stepper) fica em /antecipar.
export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-mist text-ink font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <VarianteTracker variante="chat" />
      <Hero />
      {/* Secretária digital + Como funciona: 2 colunas no desktop (lg), empilhados no mobile. */}
      <div className="bg-porcelain">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-2">
          <SecretariaDigital />
          <ComoFunciona layout="coluna" />
        </div>
      </div>
      <SocialProof />
      <Faq />
      <CtaFinal />
      <Footer />
      <BotaoChatMobile />
    </div>
  );
}
