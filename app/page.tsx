import Hero from '@/components/Hero';
import ChatSection from '@/components/ChatSection';
import SocialProof from '@/components/SocialProof';

import Faq from '@/components/Faq';
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

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-mist text-ink font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Hero />
      <ChatSection />
      <SocialProof />
      <Faq />
      <Footer />
    </div>
  );
}
