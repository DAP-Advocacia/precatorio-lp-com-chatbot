// SERVER-ONLY: Motor de regras de curadoria do lead pela IA da Karen (LangChain).
// Avalia a elegibilidade de cessão do precatório/RPV, calcula o score/rank do lead,
// identifica o perfil de titularidade, intenção e pontos de atenção antes do envio ao Bitrix.

export type RankLead = 'A+' | 'A' | 'B' | 'C' | 'D' | 'E';
export type StatusCuradoria = 'qualificado' | 'em_qualificacao' | 'nao_elegivel';
export type RelacaoTitular = 'proprio_titular' | 'herdeiro_espolio' | 'advogado' | 'terceiro' | 'nao_sabe';
export type FaseProcesso =
  | 'precatorio_expedido'
  | 'rpv_expedida'
  | 'aguardando_expedicao'
  | 'em_andamento_sem_sentenca'
  | 'nao_sabe';
export type IntencaoVenda = 'quer_vender_agora' | 'avaliando_propostas' | 'apenas_duvidas' | 'sem_interesse';

export interface CuradoriaInput {
  nome?: string | null;
  uf?: string | null;
  tipo?: 'federal' | 'estadual' | 'municipal' | 'inss' | 'outro' | 'nao_sabe' | null;
  natureza?: 'alimentar' | 'comum' | 'nao_sabe' | null;
  valorAproximado?: string | null;
  relacaoTitular?: RelacaoTitular | null;
  faseProcesso?: FaseProcesso | null;
  intencao?: IntencaoVenda | null;
  temOficio?: boolean | null;
  temProcesso?: boolean | null;
  detalhesCaso?: string | null;
}

export interface CuradoriaResult {
  status: StatusCuradoria;
  rank: RankLead;
  elegivel: boolean;
  relacaoTitular: RelacaoTitular;
  faseProcesso: FaseProcesso;
  intencao: IntencaoVenda;
  valorNumerico: number | null;
  pontosFortes: string[];
  pontosAtencao: string[];
  parecerCuradoria: string;
  orientacaoParaKaren: string;
  orientacoesComercial: string;
}

export const ROTULO_RANK: Record<RankLead, string> = {
  'A+': 'A+ (Lead Prioritário - Alto Valor e Prontidão)',
  A: 'A (Lead Quente - Precatório Confirmado)',
  B: 'B (Lead Qualificado - Avaliando Cessão)',
  C: 'C (Lead em Qualificação - Herdeiro ou Dados Parciais)',
  D: 'D (Lead Básico - Apenas Contato e Dúvidas)',
  E: 'E (Fora de Escopo - Não Elegível para Cessão)',
};

export const ROTULO_STATUS: Record<StatusCuradoria, string> = {
  qualificado: 'Qualificado',
  em_qualificacao: 'Em Qualificação',
  nao_elegivel: 'Não Elegível / Fora de Escopo',
};

export const ROTULO_TITULAR: Record<RelacaoTitular, string> = {
  proprio_titular: 'Próprio Titular Originário',
  herdeiro_espolio: 'Herdeiro / Espólio / Pensionista',
  advogado: 'Advogado (Honorários ou Representante)',
  terceiro: 'Terceiro / Familiar',
  nao_sabe: 'Não Especificado',
};

export const ROTULO_FASE: Record<FaseProcesso, string> = {
  precatorio_expedido: 'Precatório já expedido',
  rpv_expedida: 'RPV já expedida',
  aguardando_expedicao: 'Trânsito em julgado (aguardando expedição)',
  em_andamento_sem_sentenca: 'Processo em andamento (sem sentença definitiva)',
  nao_sabe: 'Não sabe / Em apuração',
};

export const ROTULO_INTENCAO: Record<IntencaoVenda, string> = {
  quer_vender_agora: 'Quer receber à vista / Vender agora',
  avaliando_propostas: 'Avaliando condições e propostas',
  apenas_duvidas: 'Apenas tirando dúvidas',
  sem_interesse: 'Sem interesse no momento',
};

/**
 * Converte textos comuns de valores como "150 mil", "R$ 150.000,00", "150k" em número puro.
 */
export function parseValorNumerico(texto?: string | null): number | null {
  if (!texto) return null;
  const limpo = texto.trim().toLowerCase();

  // Exemplo: 150 mil, 150mil, 1.5 milhao, 2 milhoes
  const matchMil = limpo.match(/^r?\$?\s*([\d.,]+)\s*(mil|k)\b/i);
  if (matchMil) {
    const base = parseFloat(matchMil[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(base)) return Math.round(base * 1000);
  }

  const matchMilhao = limpo.match(/^r?\$?\s*([\d.,]+)\s*(milh[aã]o|milh[oõ]es|m)\b/i);
  if (matchMilhao) {
    const base = parseFloat(matchMilhao[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(base)) return Math.round(base * 1_000_000);
  }

  // Padrão numérico monetário brasileiro: R$ 150.000,00 ou 150000
  const apenasDigitos = limpo.replace(/[^\d,.]/g, '');
  if (!apenasDigitos) return null;

  if (apenasDigitos.includes(',') && apenasDigitos.includes('.')) {
    const semPontos = apenasDigitos.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(semPontos);
    return !isNaN(n) && n > 0 ? Math.round(n) : null;
  }

  if (apenasDigitos.includes(',')) {
    const n = parseFloat(apenasDigitos.replace(',', '.'));
    return !isNaN(n) && n > 0 ? Math.round(n) : null;
  }

  const n = parseFloat(apenasDigitos);
  return !isNaN(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Motor central de curadoria: avalia elegibilidade, determina rank, identifica pontos fortes e de atenção.
 */
export function executarCuradoria(dados: CuradoriaInput): CuradoriaResult {
  const fase: FaseProcesso = dados.faseProcesso ?? 'nao_sabe';
  const titular: RelacaoTitular = dados.relacaoTitular ?? 'proprio_titular';
  const intencao: IntencaoVenda = dados.intencao ?? 'avaliando_propostas';
  const valorNum = parseValorNumerico(dados.valorAproximado);
  const temOficio = dados.temOficio === true;
  const temProcesso = dados.temProcesso === true || Boolean(dados.uf);

  const pontosFortes: string[] = [];
  const pontosAtencao: string[] = [];

  // 1. Elegibilidade jurídica para antecipação / cessão
  // Se o processo ainda está em andamento sem sentença transitada em julgado, não existe crédito cedível.
  let elegivel = true;
  let status: StatusCuradoria = 'qualificado';

  if (fase === 'em_andamento_sem_sentenca') {
    elegivel = false;
    status = 'nao_elegivel';
    pontosAtencao.push('Processo ainda em fase de conhecimento/recurso sem sentença definitiva. Crédito não elegível para cessão imediata.');
  }

  if (dados.tipo === 'outro') {
    pontosAtencao.push('Tipo de crédito não classificado como precatório ou RPV. Requer triagem técnica.');
  }

  // 2. Análise de Titularidade
  if (titular === 'proprio_titular') {
    pontosFortes.push('Titular originário do crédito: processo de cessão mais ágil e sem partilha.');
  } else if (titular === 'herdeiro_espolio') {
    if (status !== 'nao_elegivel') status = 'em_qualificacao';
    pontosAtencao.push('Herdeiro/Espólio: necessário conferir inventário/formal de partilha e habilitação nos autos.');
  } else if (titular === 'advogado') {
    pontosFortes.push('Advogado da causa: potencial para antecipação de honorários ou parceria.');
  } else if (titular === 'terceiro') {
    pontosAtencao.push('Terceiro sem procuração declarada: validar titularidade com o credor principal.');
  }

  // 3. Documentação e dados
  if (temOficio) {
    pontosFortes.push('Possui ofício requisitório em mãos: agiliza cálculo e minuta da proposta.');
  }
  if (dados.tipo === 'federal') {
    pontosFortes.push('Precatório/RPV Federal: alta liquidez e previsibilidade orçamentária.');
  }
  if (valorNum && valorNum >= 100_000) {
    pontosFortes.push(`Valor expressivo declarado (~R$ ${valorNum.toLocaleString('pt-BR')}): lead prioritário.`);
  }

  // 4. Cálculo de Rank de Lead (A+ a E)
  let rank: RankLead = 'C';

  if (!elegivel) {
    rank = 'E';
  } else if (
    (valorNum && valorNum >= 120_000 && (temOficio || dados.tipo === 'federal') && intencao === 'quer_vender_agora') ||
    (temOficio && valorNum && valorNum >= 150_000)
  ) {
    rank = 'A+';
    status = 'qualificado';
  } else if (
    (dados.tipo === 'federal' || dados.tipo === 'estadual') &&
    (temOficio || (valorNum && valorNum >= 50_000)) &&
    intencao !== 'sem_interesse'
  ) {
    rank = 'A';
    status = 'qualificado';
  } else if (dados.tipo && dados.uf && intencao !== 'sem_interesse') {
    rank = 'B';
    if (status !== 'nao_elegivel') status = 'qualificado';
  } else if (titular === 'herdeiro_espolio' || fase === 'aguardando_expedicao' || fase === 'nao_sabe') {
    rank = 'C';
    if (status !== 'nao_elegivel') status = 'em_qualificacao';
  } else {
    rank = 'D';
  }

  // 5. Pareceres e orientações
  let orientacaoParaKaren = '';
  let orientacoesComercial = '';

  if (!elegivel) {
    orientacaoParaKaren =
      'Explique educadamente que a antecipação só ocorre após o término do processo e a expedição do precatório pela Justiça. Não dê falsas esperanças, mas ofereça o WhatsApp da equipe caso queira acompanhar.';
    orientacoesComercial =
      'Lead informou processo em andamento sem sentença. Esclarecer ao cliente que ele ainda deve aguardar o trânsito em julgado antes de poder negociar.';
  } else if (rank === 'A+' || rank === 'A') {
    orientacaoParaKaren =
      'Lead altamente qualificado. Valide o interesse em receber proposta sem compromisso, peça nome e WhatsApp com DDD (se ainda não tiver), e convide para enviar o ofício pelo anexo.';
    orientacoesComercial =
      'Lead prioritário quente. Abordagem rápida via WhatsApp com saudação personalizada e oferta de análise do ofício.';
  } else if (titular === 'herdeiro_espolio') {
    orientacaoParaKaren =
      'Acolha com sensibilidade. Explique que a Premium Office atende herdeiros com segurança e que a análise gratuita ajudará a verificar a cota-parte com a documentação do inventário.';
    orientacoesComercial =
      'Herdeiro de precatório. Solicitar certidão de óbito do titular, termo de inventariante ou formal de partilha para verificar a cota cedível.';
  } else {
    orientacaoParaKaren =
      'Lead com potencial em qualificação. Colete a UF, valor aproximado e WhatsApp para o especialista fazer a busca do processo no tribunal correspondente.';
    orientacoesComercial =
      'Lead em qualificação. Solicitar CPF ou número do processo para o especialista consultar a situação no tribunal.';
  }

  const parecerCuradoria = [
    `Status: ${ROTULO_STATUS[status]} | Rank: ${rank}`,
    `Titularidade: ${ROTULO_TITULAR[titular]} | Fase: ${ROTULO_FASE[fase]}`,
    dados.tipo ? `Tipo: ${dados.tipo.toUpperCase()}${dados.uf ? ` (${dados.uf})` : ''}` : null,
    dados.valorAproximado ? `Valor citado: ${dados.valorAproximado}` : null,
    `Intenção: ${ROTULO_INTENCAO[intencao]}`,
    pontosFortes.length ? `Destaques: ${pontosFortes.join('; ')}` : null,
    pontosAtencao.length ? `Atenção: ${pontosAtencao.join('; ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    status,
    rank,
    elegivel,
    relacaoTitular: titular,
    faseProcesso: fase,
    intencao,
    valorNumerico: valorNum,
    pontosFortes,
    pontosAtencao,
    parecerCuradoria,
    orientacaoParaKaren,
    orientacoesComercial,
  };
}

/**
 * Formata um comentário estruturado para o timeline do Deal no Bitrix24.
 */
export function formatarFichaCuradoria(
  curadoria: CuradoriaResult,
  extra?: { nome?: string; celular?: string; uf?: string; tipo?: string; resumo?: string }
): string {
  const linhas: string[] = [
    '🎯 CURADORIA DO LEAD — KAREN (SECRETÁRIA DIGITAL):',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `• Classificação: ${ROTULO_STATUS[curadoria.status]}`,
    `• Rank do Lead: ${ROTULO_RANK[curadoria.rank]}`,
    `• Relação com o Crédito: ${ROTULO_TITULAR[curadoria.relacaoTitular]}`,
    `• Fase do Processo: ${ROTULO_FASE[curadoria.faseProcesso]}`,
    `• Intenção declarada: ${ROTULO_INTENCAO[curadoria.intencao]}`,
  ];

  if (extra?.tipo) linhas.push(`• Esfera / Tipo: ${extra.tipo.toUpperCase()}`);
  if (extra?.uf) linhas.push(`• Estado do Processo (UF): ${extra.uf}`);
  if (curadoria.valorNumerico) {
    linhas.push(`• Valor Estimado: R$ ${curadoria.valorNumerico.toLocaleString('pt-BR')}`);
  }

  if (curadoria.pontosFortes.length) {
    linhas.push('\nPontos Fortes identificados:');
    curadoria.pontosFortes.forEach((p) => linhas.push(`  ✓ ${p}`));
  }

  if (curadoria.pontosAtencao.length) {
    linhas.push('\nPontos de Atenção / Verificações necessárias:');
    curadoria.pontosAtencao.forEach((p) => linhas.push(`  ⚠ ${p}`));
  }

  if (curadoria.orientacoesComercial) {
    linhas.push(`\nOrientação para abordagem comercial:\n👉 ${curadoria.orientacoesComercial}`);
  }

  if (extra?.resumo) {
    linhas.push(`\nResumo da conversa:\n"${extra.resumo}"`);
  }

  linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return linhas.join('\n');
}
