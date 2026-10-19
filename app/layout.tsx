import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
});

// TODO: trocar pelo domínio real de produção assim que estiver definido.
const SITE_URL = 'https://www.premiumoffice.com.br';

// GTM opcional: só carrega quando NEXT_PUBLIC_GTM_ID estiver definido no ambiente.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() || '';
const GTM_ID_SAFE = /^GTM-[A-Z0-9]+$/i.test(GTM_ID) ? GTM_ID : '';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 'cover' faz env(safe-area-inset-*) funcionar no iOS (barra fixa e chat em tela cheia).
  // Sem maximumScale/userScalable: o público precisa poder dar zoom.
  viewportFit: 'cover',
  themeColor: '#0B1B33',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Premium Office Precatórios | Antecipação de Precatórios com Segurança Jurídica',
    template: '%s | Premium Office Precatórios',
  },
  description:
    'Descubra se vale a pena antecipar seu precatório. Análise gratuita por IA com revisão de especialistas, antecipação segura e transparente, sem compromisso.',
  keywords: [
    'precatório',
    'antecipação de precatório',
    'venda de precatório',
    'cessão de crédito precatório',
    'precatório federal',
    'precatório estadual',
    'quanto vale meu precatório',
    'antecipar precatório',
  ],
  authors: [{ name: 'Premium Office' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Premium Office Precatórios',
    title: 'Premium Office Precatórios | Antecipação de Precatórios com Segurança Jurídica',
    description:
      'Descubra se vale a pena antecipar seu precatório. Análise gratuita por IA com revisão de especialistas, antecipação segura e transparente, sem compromisso.',
    // TODO(asset): criar uma imagem 1200x630 dedicada para o preview de links (WhatsApp/Facebook).
    // Até lá, declarar as dimensões reais do banner (retrato, 563x756) para não distorcer.
    images: [{ url: '/side_banner.png', width: 563, height: 756, alt: 'Premium Office Precatórios' }],
  },
  twitter: {
    // 'summary' até existir uma imagem 1200x630 (o banner atual é retrato).
    card: 'summary',
    title: 'Premium Office Precatórios | Antecipação de Precatórios com Segurança Jurídica',
    description: 'Descubra se vale a pena antecipar seu precatório. Análise gratuita por IA, com revisão de especialistas.',
    images: ['/side_banner.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Premium Office Precatórios',
  url: SITE_URL,
  logo: `${SITE_URL}/logo-white.png`,
  description: 'Antecipação de precatórios com análise por IA e revisão jurídica especializada.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="font-sans bg-mist text-ink">
        {GTM_ID_SAFE && (
          <>
            <Script id="gtm" strategy="afterInteractive">
              {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID_SAFE}');`}
            </Script>
            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID_SAFE}`}
                height="0"
                width="0"
                style={{ display: 'none', visibility: 'hidden' }}
                title="Google Tag Manager"
              />
            </noscript>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
