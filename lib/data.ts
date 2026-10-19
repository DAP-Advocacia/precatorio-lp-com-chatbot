// FAQ da landing page. Também alimenta o JSON-LD FAQPage em app/page.tsx.
// Regras: refletir o fluxo real (IA lê o ofício -> especialista analisa -> proposta pelo
// WhatsApp), nunca prometer valores ou prazos e não afirmar nada que a operação não cumpra.
// Revisar com o jurídico antes de alterar respostas sobre legalidade, herdeiros e dados.
export const FAQ_DATA: { question: string; answer: string }[] = [
  {
    question: 'O que acontece depois que eu envio o ofício?',
    answer:
      'Nossa inteligência artificial lê os dados principais do documento (credor, processo, tribunal, ente devedor e valor). Em seguida, um especialista da Premium Office analisa o seu caso e envia a proposta pelo WhatsApp. A análise e a proposta são sem custo e sem compromisso.',
  },
  {
    question: 'A venda (cessão) do precatório é legal?',
    answer:
      'Sim. A cessão de créditos de precatórios é prevista na Constituição Federal (art. 100, §13). A operação é formalizada por contrato ou escritura pública de cessão, e a transferência é comunicada ao tribunal responsável pelo pagamento.',
  },
  {
    question: 'Quanto vou receber?',
    answer:
      'Depende do valor líquido do seu crédito, depois dos descontos legais (como honorários contratuais, previdência e Imposto de Renda), do ente devedor e da previsão de pagamento. O valor da proposta é calculado pelo especialista com base no seu documento, e você só decide depois de conhecê-lo.',
  },
  {
    question: 'Quanto tempo leva para receber o dinheiro?',
    answer:
      'O pagamento acontece depois que você aceita a proposta e a validação documental e jurídica é concluída. O prazo varia conforme o caso, e o especialista informa a previsão do seu crédito antes de você decidir.',
  },
  {
    question: 'Herdeiros e advogados podem vender?',
    answer:
      'Sim. Herdeiros podem negociar o crédito apresentando a documentação do inventário ou da habilitação no processo. Advogados podem negociar os honorários contratuais ou sucumbenciais destacados no precatório. O especialista orienta quais documentos são necessários em cada situação.',
  },
  {
    question: 'Preciso enviar o documento original?',
    answer:
      'Não. Um PDF ou uma foto legível do ofício requisitório ou do precatório basta para começar a análise. Outros documentos só são solicitados se você decidir seguir com a proposta.',
  },
  {
    question: 'Existe algum custo?',
    answer:
      'Não. A análise e a proposta são gratuitas e sem compromisso. Você só segue adiante se fizer sentido para você.',
  },
  {
    question: 'Meus dados estão protegidos?',
    answer:
      'Sim. Seus dados são usados apenas para analisar o seu crédito e entrar em contato com você, tratados conforme a LGPD e armazenados em ambiente seguro. Para a análise, eles são processados por fornecedores de tecnologia (como serviços de nuvem e de inteligência artificial). Nunca vendemos seus dados, e você pode pedir a exclusão a qualquer momento pelo WhatsApp.',
  },
];
