import type { Metadata } from 'next';
import Hero from '@/components/Hero';
import FormularioEtapas from '@/components/ab/FormularioEtapas';
import VarianteTracker from '@/components/ab/VarianteTracker';
import ComoFunciona from '@/components/ComoFunciona';
import SocialProof from '@/components/SocialProof';
import Faq from '@/components/Faq';
import CtaFinal from '@/components/CtaFinal';
import Footer from '@/components/Footer';

// Variante B do teste A/B: formulário em etapas (stepper) com glassmorphism. Fora do índice.
export const metadata: Metadata = {
  title: 'Atualize o valor do seu precatório',
  robots: { index: false, follow: true },
};

export default function AnteciparPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-ink font-sans">
      <VarianteTracker variante="formulario" />
      <Hero tema="claro" />
      <FormularioEtapas />
      <ComoFunciona tema="claro" />
      <SocialProof />
      <Faq />
      <CtaFinal tema="claro" />
      <Footer />
    </div>
  );
}
