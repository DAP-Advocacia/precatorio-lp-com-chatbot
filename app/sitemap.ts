import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// As variantes do teste A/B (/chat e /antecipe) ficam fora: são noindex e canônicas para a home.
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
