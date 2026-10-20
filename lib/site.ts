// URL canônica pública da LP (subdomínio). Usada em canonical, Open Graph, sitemap, robots e JSON-LD.
// Defina NEXT_PUBLIC_SITE_URL no Vercel com o subdomínio final (ex.: https://lp.seudominio.com.br).
// Nunca apontar para o domínio pai: ele é outro site, e o canonical faria o Google desindexar a LP.
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = explicit || (vercelProd ? `https://${vercelProd}` : 'http://localhost:3000');
  return raw.replace(/\/+$/, '');
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = 'Premium Office Precatórios';

export const SEO_TITLE = 'Antecipação de Precatório: Análise Gratuita | Premium Office';
export const SEO_DESCRIPTION =
  'Descubra quanto vale seu precatório. Envie o ofício e receba análise gratuita por IA, revisada por especialistas, sem compromisso. Federal e estadual.';
