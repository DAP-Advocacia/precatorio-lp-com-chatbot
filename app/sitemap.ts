import type { MetadataRoute } from 'next';
import { LISTA_ARTIGOS } from '@/lib/artigos';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...LISTA_ARTIGOS.map((a) => ({
      url: `${SITE_URL}${a.path}`,
      lastModified: new Date(`${a.publicado}T12:00:00`),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
