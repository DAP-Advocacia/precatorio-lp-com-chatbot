import type { MetadataRoute } from 'next';

// TODO: trocar pelo domínio real de produção assim que estiver definido.
const SITE_URL = 'https://www.premiumoffice.com.br';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
