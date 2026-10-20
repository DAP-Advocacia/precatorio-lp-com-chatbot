import type { Metadata } from 'next';
import ArticleLayout, { H2, Lista, P } from '@/components/ArticleLayout';
import { FluxoPassos } from '@/components/graficos';
import { ARTIGOS } from '@/lib/artigos';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const a = ARTIGOS.comoAntecipar;

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

export default function ComoAnteciparPrecatorio() {
  return (
    <ArticleLayout artigo={a} origem="artigo-como-antecipar">
      <P>
        Antecipar um precatório significa ceder (vender) o direito de receber a um terceiro, que paga um valor
        agora e passa a aguardar o pagamento do ente público. Em vez de esperar na fila, você transforma um
        crédito de data incerta em dinheiro disponível. Veja como funciona, passo a passo.
      </P>

      <FluxoPassos />

      <H2>1. Reúna o ofício requisitório</H2>
      <P>
        O ofício requisitório (ou o próprio precatório) é o documento que traz o credor, o número do processo, o
        tribunal, o ente devedor e o valor. É a base de toda a análise. Se você não tem o documento em mãos, um
        especialista pode ajudar a localizá-lo a partir do número do processo, sem custo.
      </P>

      <H2>2. Envie para análise</H2>
      <P>
        Um PDF ou uma foto legível já bastam para começar, e não é preciso enviar o documento original. Nossa
        inteligência artificial lê os dados principais (credor, processo, tribunal, ente devedor e valor) e um
        especialista confere o resultado.
      </P>

      <H2>3. Receba a proposta, calculada sobre o líquido</H2>
      <P>
        A proposta não é calculada sobre o valor bruto do ofício. O ponto de partida é o valor líquido, depois
        dos descontos legais, como honorários contratuais, previdência, Imposto de Renda e outros. O
        especialista calcula a proposta com base no seu documento, e você só decide depois de conhecê-la.
      </P>

      <H2>4. Decida com calma</H2>
      <P>
        A análise e a proposta são gratuitas e sem compromisso. Você segue adiante apenas se fizer sentido para
        você. Outros documentos só são solicitados se você decidir seguir com a proposta.
      </P>

      <H2>5. Formalização e pagamento</H2>
      <P>
        Aceita a proposta, vem a validação documental e jurídica. A operação é formalizada por contrato ou
        escritura pública de cessão, e a transferência é comunicada ao tribunal responsável pelo pagamento. O
        pagamento acontece depois dessas etapas, e o especialista informa a previsão do seu caso antes de você
        decidir.
      </P>

      <H2>Quem pode antecipar</H2>
      <Lista>
        <li>
          <strong>Titulares</strong> do precatório, com o ofício ou o número do processo em mãos.
        </li>
        <li>
          <strong>Herdeiros</strong>, apresentando a documentação do inventário ou da habilitação no processo.
        </li>
        <li>
          <strong>Advogados</strong>, que podem negociar honorários contratuais ou sucumbenciais destacados no
          precatório.
        </li>
      </Lista>

      <H2>O que observar antes de antecipar</H2>
      <Lista>
        <li>Peça a proposta por escrito e confira em qual valor ela foi calculada: bruto ou líquido.</li>
        <li>Entenda quais descontos legais incidem no seu crédito e quanto representam.</li>
        <li>Desconfie de qualquer promessa de valor feita sem a análise do seu documento.</li>
        <li>Leia o contrato ou a escritura de cessão antes de assinar e tire todas as dúvidas.</li>
        <li>A análise e a proposta não devem ter custo para você.</li>
      </Lista>
    </ArticleLayout>
  );
}
