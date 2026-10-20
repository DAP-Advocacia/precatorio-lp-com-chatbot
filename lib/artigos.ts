// Artigos informativos da LP (SEO + conteúdo de apoio). Alimentam as páginas, a seção da home,
// o sitemap e o JSON-LD. Regras de conteúdo (as mesmas do FAQ em lib/data.ts): refletir o fluxo
// real da operação, nunca prometer valores ou prazos. Revisar com o jurídico antes de alterar.
import { SITE_NAME, SITE_URL } from '@/lib/site';

export type Artigo = {
  path: string;
  seoTitle: string; // até 60 caracteres (title absoluto, sem o template do layout)
  titulo: string; // H1
  description: string; // até ~155 caracteres
  kicker: string;
  resumo: string;
  publicado: string; // ISO (YYYY-MM-DD)
};

export const ARTIGOS = {
  comoAntecipar: {
    path: '/como-antecipar-precatorio',
    seoTitle: 'Como Antecipar seu Precatório em 5 Passos | Premium Office',
    titulo: 'Como antecipar seu precatório em 5 passos',
    description:
      'Como antecipar seu precatório: do ofício à cessão de crédito e ao pagamento. Veja o fluxo em gráfico, os documentos e o que observar antes de decidir.',
    kicker: 'Passo a passo',
    resumo:
      'Do ofício requisitório à formalização da cessão: o caminho completo da antecipação, em um fluxo visual.',
    publicado: '2026-10-20',
  },
  antecipacao: {
    path: '/antecipacao-precatorio',
    seoTitle: 'Antecipação de Precatório: Como Funciona | Premium Office',
    titulo: 'Antecipação de precatório: como funciona a cessão de crédito',
    description:
      'Antecipação de precatório: entenda a cessão de crédito, a diferença entre valor bruto e líquido cedível e por que a proposta é menor que o crédito.',
    kicker: 'Entenda a cessão',
    resumo:
      'Esperar na fila ou antecipar? Veja em gráficos como a cessão funciona e como a proposta é calculada sobre o valor líquido.',
    publicado: '2026-10-20',
  },
} satisfies Record<string, Artigo>;

export const LISTA_ARTIGOS: Artigo[] = [ARTIGOS.comoAntecipar, ARTIGOS.antecipacao];

export function artigoJsonLd(a: Artigo) {
  const url = `${SITE_URL}${a.path}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#artigo`,
        headline: a.titulo,
        description: a.description,
        inLanguage: 'pt-BR',
        datePublished: a.publicado,
        dateModified: a.publicado,
        mainEntityOfPage: url,
        image: `${url}/opengraph-image`,
        author: { '@id': `${SITE_URL}/#organization` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: a.titulo, item: url },
        ],
      },
    ],
  };
}
