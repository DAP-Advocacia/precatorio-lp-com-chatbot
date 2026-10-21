import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// A variante B (/antecipar) fica fora: é noindex e duplica o conteúdo da home.
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
