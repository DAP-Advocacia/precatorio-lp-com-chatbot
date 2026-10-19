export type Esfera = 'Federal' | 'Estadual' | 'Municipal';

const TABELAS_RISCO: Record<string, any> = {
  Federal: { prazoAnos: 1.5, taxaDescontoAnual: 0.15 },
  Estadual: {
    SP: { prazoAnos: 4.0, taxaDescontoAnual: 0.22 },
    RJ: { prazoAnos: 8.0, taxaDescontoAnual: 0.25 },
    default: { prazoAnos: 5.0, taxaDescontoAnual: 0.23 },
  },
  Municipal: { prazoAnos: 6.0, taxaDescontoAnual: 0.24 },
};

export function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function calcularAntecipacao(
  valorFace: number,
  esfera: Esfera,
  uf: string,
  possuiPrioridade: boolean
) {
  let config = TABELAS_RISCO[esfera];
  if (esfera === 'Estadual') {
    config = TABELAS_RISCO.Estadual[uf] || TABELAS_RISCO.Estadual.default;
  }
  if (!config) return { valorMinimo: 0, valorMaximo: 0 };
  let anosEspera = config.prazoAnos;
  if (possuiPrioridade) anosEspera = Math.max(1, anosEspera * 0.5);
  const valorPropostoBase = valorFace / Math.pow(1 + config.taxaDescontoAnual, anosEspera);
  return {
    valorMinimo: valorPropostoBase * 0.93,
    valorMaximo: valorPropostoBase * 1.05,
  };
}

export const MOCK_DOC = {
  credor: 'João Batista Ferreira',
  cpf: '***.456.789-**',
  processo: '0001234-56.2015.8.26.0053',
  tribunal: 'TJSP',
  devedor: 'Estado de São Paulo',
  esfera: 'Estadual' as Esfera,
  uf: 'SP',
  natureza: 'Alimentar',
  valorPrincipal: 480000,
  dataBase: '03/2024',
};

export const DOCS_NECESSARIOS = [
  'Cópia do RG/CNPJ do credor ou representante',
  'Procuração ou contrato social atualizado',
  'Certidão do processo atualizada',
  'Comprovante de residência ou sede',
];

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

// ─── Motor de cálculo (conforme lógica anexada) ───────────────────────────
// Tabela progressiva mensal do IR/RRA (Rendimentos Recebidos Acumuladamente)
const TABELA_RRA = [
  { limite: 2428.8, aliquota: 0, deducao: 0 },
  { limite: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { limite: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { limite: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { limite: Infinity, aliquota: 0.275, deducao: 908.73 },
];

export function calcIrRra(principalTributavel: number, meses: number) {
  if (!principalTributavel || !meses) return 0;
  const base = principalTributavel / meses;
  const faixa = TABELA_RRA.find((f) => base <= f.limite)!;
  const irMensal = Math.max(0, base * faixa.aliquota - faixa.deducao);
  return irMensal * meses;
}

// Ofício de demonstração (Federal Alimentar, LOA 2027)
export const DEMO_OFICIO = {
  credor: 'João Batista Ferreira',
  cpf: '***.456.789-**',
  processo: '5001234-56.2021.4.03.6100',
  tribunal: 'TRF3',
  ente: 'União Federal',
  natureza: 'Federal Alimentar',
  loa: 2027,
  bruto: 480000,
  honorarios: 72000, // contratuais (15%)
  pss: 18000,
  principalTributavel: 300000,
  mesesRra: 36,
};

export type Analise = typeof DEMO_OFICIO & {
  irRra: number;
  liquido: number;
  percentual: number;
  margemAbertura: number;
  limiteInterno: number;
  propostaInicial: number;
  faixaMin: number;
  faixaMax: number;
};

// Regra de ouro: primeiro apura o líquido disponível para cessão, só depois aplica a tabela comercial.
export function analisarOficio(doc: typeof DEMO_OFICIO): Analise {
  const irRra = calcIrRra(doc.principalTributavel, doc.mesesRra);
  const liquido = doc.bruto - doc.honorarios - irRra - doc.pss;
  const percentual = 0.72; // Federal Alimentar 2027
  const margemAbertura = 0.05; // padrão
  const limiteInterno = liquido * percentual;
  const propostaInicial = limiteInterno * (1 - margemAbertura);
  return {
    ...doc,
    irRra,
    liquido,
    percentual,
    margemAbertura,
    limiteInterno,
    propostaInicial,
    faixaMin: propostaInicial,
    faixaMax: limiteInterno,
  };
}

export const REVIEWS = [
  {
    name: 'Yuri Assunção',
    meta: 'Local Guide · 11 reviews',
    rating: 5,
    quote: 'Empresa que atua de forma séria e ética com a antecipação dos valores a tanto aguardado, pelas pessoas que tem precatórios a receber.',
  },
  {
    name: 'Jean Fabrício',
    meta: '2 reviews',
    rating: 5,
    quote: 'Escritório incrível, fui atendido muito bem pela especialista Milena! Só tenho a agradecer!!!',
  },
  {
    name: 'Paulo Vitor De Souza Pereira',
    meta: '6 reviews',
    rating: 5,
    quote: 'Excelentes profissionais e uma resolução rápida e eficaz.',
  },
  {
    name: 'Marcelo Annis',
    meta: '6 reviews',
    rating: 5,
    quote: 'Gerente Franklin muito atencioso e prestativo, recomendo para todos.',
  },
];
