import type { MetadataRoute } from 'next';

// TODO: trocar pelo domínio real de produção assim que estiver definido.
const SITE_URL = 'https://www.premiumoffice.com.br';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
