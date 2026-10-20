import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Montserrat } from 'next/font/google';
import { SEO_DESCRIPTION, SEO_TITLE, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
});

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
    // Até 60 caracteres: acima disso o Google trunca o título no resultado de busca.
    default: SEO_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SEO_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'precatório',
    'antecipação de precatório',
    'venda de precatório',
    'vender precatório',
    'cessão de crédito precatório',
    'precatório federal',
    'precatório estadual',
    'quanto vale meu precatório',
    'antecipar precatório',
    'ofício requisitório',
  ],
  authors: [{ name: 'Premium Office' }],
  creator: 'Premium Office',
  publisher: 'Premium Office',
  category: 'finance',
  // Evita que o iOS transforme o número de WhatsApp/processo em link de telefone fora do nosso controle.
  formatDetection: { telephone: false, email: false, address: false },
  alternates: { canonical: '/', languages: { 'pt-BR': '/' } },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    // A imagem 1200x630 vem de app/opengraph-image.tsx (convenção de arquivo do Next).
  },
  twitter: {
    card: 'summary_large_image',
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  // Verificação opcional do Search Console; só é emitida quando a env existir.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo-white.png`,
  description: 'Antecipação de precatórios com análise por IA e revisão jurídica especializada.',
  areaServed: { '@type': 'Country', name: 'BR' },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
  inLanguage: 'pt-BR',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
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
