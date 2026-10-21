import type { Metadata } from 'next';
import Hero from '@/components/Hero';
import SecretariaDigital from '@/components/ab/SecretariaDigital';
import VarianteTracker from '@/components/ab/VarianteTracker';
import ComoFunciona from '@/components/ComoFunciona';
import SocialProof from '@/components/SocialProof';
import Faq from '@/components/Faq';
import CtaFinal from '@/components/CtaFinal';
import Footer from '@/components/Footer';

// Variante A do teste A/B: secretária digital. Fora do índice: o conteúdo duplica a home.
export const metadata: Metadata = {
  title: 'Fale com a secretária digital',
  robots: { index: false, follow: true },
};

export default function ChatPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-mist text-ink font-sans">
      <VarianteTracker variante="chat" />
      <Hero />
      <SecretariaDigital />
      <ComoFunciona />
      <SocialProof />
      <Faq />
      <CtaFinal />
      <Footer />
    </div>
  );
}
