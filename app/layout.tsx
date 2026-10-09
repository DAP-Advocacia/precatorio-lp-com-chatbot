import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import '@mantine/core/styles.css';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
});

// TODO: trocar pelo domínio real de produção assim que estiver definido.
const SITE_URL = 'https://www.premiumoffice.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Premium Office Precatórios | Antecipação de Precatórios com Segurança Jurídica',
    template: '%s | Premium Office Precatórios',
  },
  description:
    'Descubra quanto vale seu precatório hoje. Análise gratuita por IA com revisão de especialistas, antecipação segura e transparente, sem compromisso.',
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
      'Descubra quanto vale seu precatório hoje. Análise gratuita por IA com revisão de especialistas, antecipação segura e transparente, sem compromisso.',
    images: [{ url: '/side_banner.png', width: 1200, height: 630, alt: 'Premium Office Precatórios' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Premium Office Precatórios | Antecipação de Precatórios com Segurança Jurídica',
    description: 'Descubra quanto vale seu precatório hoje. Análise gratuita por IA, com revisão de especialistas.',
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
    <html lang="pt-BR" className={montserrat.variable} suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="font-sans bg-mist text-ink">
        <MantineProvider defaultColorScheme="light">{children}</MantineProvider>
      </body>
    </html>
  );
}
