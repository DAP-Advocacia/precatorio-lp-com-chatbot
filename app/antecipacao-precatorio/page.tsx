import type { Metadata } from 'next';
import ArticleLayout, { H2, Lista, P } from '@/components/ArticleLayout';
import { BrutoLiquidoProposta, EsperarVsAntecipar } from '@/components/graficos';
import { ARTIGOS } from '@/lib/artigos';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const a = ARTIGOS.antecipacao;

export const metadata: Metadata = {
  title: { absolute: a.seoTitle },
  description: a.description,
  alternates: { canonical: a.path },
  openGraph: {
    type: 'article',
    locale: 'pt_BR',
    siteName: SITE_NAME,
    url: `${SITE_URL}${a.path}`,
    title: a.seoTitle,
    description: a.description,
    publishedTime: a.publicado,
  },
  twitter: { card: 'summary_large_image', title: a.seoTitle, description: a.description },
};

export default function AntecipacaoPrecatorio() {
  return (
    <ArticleLayout artigo={a} origem="artigo-antecipacao">
      <P>
        Precatório é a forma como o poder público paga dívidas reconhecidas pela Justiça: depois da decisão
        definitiva, o tribunal expede o ofício requisitório e o pagamento segue a ordem cronológica, conforme o
        orçamento do ente devedor. A antecipação de precatório existe para quem não quer ou não pode esperar
        essa fila.
      </P>

      <H2>Esperar na fila ou antecipar?</H2>
      <P>
        Quem espera recebe o valor integral do crédito, mas só quando o ente pagar, e o prazo varia conforme o
        tribunal e o devedor. Quem antecipa recebe antes, por um valor menor, e transfere o crédito a quem passa
        a aguardar o pagamento. Essa transferência se chama cessão de crédito.
      </P>

      <EsperarVsAntecipar />

      <H2>A cessão de crédito é legal?</H2>
      <P>
        Sim. A cessão de créditos de precatórios é prevista na Constituição Federal (art. 100, §13). A operação
        é formalizada por contrato ou escritura pública de cessão, e a transferência é comunicada ao tribunal
        responsável pelo pagamento.
      </P>

      <H2>Valor bruto, líquido cedível e proposta</H2>
      <P>
        O valor que consta no ofício é o bruto. Dele saem os descontos legais, como honorários contratuais,
        previdência (PSS), Imposto de Renda ou RRA e outros descontos. O que sobra é o líquido cedível, e é sobre
        ele que a proposta é calculada, nunca sobre o bruto.
      </P>

      <BrutoLiquidoProposta />

      <H2>Por que a proposta é menor que o crédito?</H2>
      <P>
        Porque você recebe antes do pagamento pelo ente devedor. A diferença entre o crédito e a proposta
        corresponde ao tempo de espera que passa a ser de quem adquire o precatório. O valor final depende do
        líquido cedível, do ente devedor, do regime (federal ou estadual) e da previsão de pagamento, e é
        calculado pelo especialista com base no seu documento.
      </P>

      <H2>Federal ou estadual: o que muda</H2>
      <Lista>
        <li>
          <strong>Federal:</strong> o precatório é classificado pela natureza do crédito (alimentar, comum ou
          comum tributário).
        </li>
        <li>
          <strong>Estadual:</strong> a análise considera o tribunal, o estado e o ano do orçamento em que o
          precatório foi incluído.
        </li>
      </Lista>
      <P>
        Por isso a leitura correta do ofício é o primeiro passo: é ele que indica o tribunal, o ente devedor e o
        valor do seu crédito.
      </P>

      <H2>Como saber quanto o seu precatório pode valer</H2>
      <P>
        O caminho é enviar o ofício para análise. Nossa inteligência artificial lê os dados principais e um
        especialista da Premium Office calcula a proposta e a envia pelo WhatsApp. A análise é gratuita e sem
        compromisso, e você só decide depois de conhecer o valor.
      </P>
    </ArticleLayout>
  );
}
