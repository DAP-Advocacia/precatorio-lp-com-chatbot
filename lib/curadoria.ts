// SERVER-ONLY: Motor de regras de curadoria do lead pela IA da Karen (LangChain).
// Avalia a elegibilidade de cessão do precatório/RPV, calcula o score/rank do lead,
// identifica o perfil de titularidade, intenção e pontos de atenção antes do envio ao Bitrix.

export type RankLead = 'A+' | 'A' | 'B' | 'C' | 'D' | 'E';
export type StatusCuradoria = 'qualificado' | 'em_qualificacao' | 'nao_elegivel';
export type RelacaoTitular = 'proprio_titular' | 'herdeiro_espolio' | 'advogado' | 'broker' | 'terceiro' | 'nao_sabe';
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
  municipio?: string | null;
  tipo?: 'federal' | 'estadual' | 'municipal' | 'inss' | 'outro' | 'nao_sabe' | null;
  natureza?: 'alimentar' | 'comum' | 'nao_sabe' | null;
  valorAproximado?: string | null;
  relacaoTitular?: RelacaoTitular | null;
  faseProcesso?: FaseProcesso | null;
  intencao?: IntencaoVenda | null;
  temOficio?: boolean | null;
  temProcesso?: boolean | null;
  numeroProcesso?: string | null;
  nomeTitular?: string | null;
  cpfTitular?: string | null;
  celularTitular?: string | null;
  vinculoTitular?: string | null;
  melhorHorarioContato?: string | null;
  melhorDiaContato?: string | null;
  situacaoExpedicao?: 'expedido' | 'em_andamento' | 'nao_sabe' | null;
  detalhesCaso?: string | null;
}

export interface CuradoriaResult {
  status: StatusCuradoria;
  rank: RankLead;
  elegivel: boolean;
  relacaoTitular: RelacaoTitular;
  vinculoTitular: string | null;
  faseProcesso: FaseProcesso;
  situacaoExpedicao: 'expedido' | 'em_andamento' | 'nao_sabe' | null;
  melhorHorarioContato: string | null;
  melhorDiaContato: string | null;
  intencao: IntencaoVenda;
  valorNumerico: number | null;
  temProcesso: boolean;
  municipio: string | null;
  nomeTitular: string | null;
  cpfTitular: string | null;
  celularTitular: string | null;
  numeroProcesso: string | null;
  pontosFortes: string[];
  pontosAtencao: string[];
  parecerCuradoria: string;
  orientacaoParaKaren: string;
  orientacoesComercial: string;
}

export const ROTULO_RANK: Record<RankLead, string> = {
  'A+': 'A+ (Lead Prioritário - Alto Valor e Prontidão 🔥)',
  A: 'A (Lead Quente - Precatório Confirmado 🔥)',
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
  broker: 'Broker / Intermediário de Precatórios',
  terceiro: 'Terceiro / Familiar',
  nao_sabe: 'Não Especificado',
};

export const ROTULO_FASE: Record<FaseProcesso, string> = {
  precatorio_expedido: 'Precatório já expedido (Processo Concluído)',
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
  
  // Considera que tem processo ativo se explicitamente afirmado, se informou número de processo,
  // ou se o precatório/RPV já está expedido ou aguardando expedição.
  const temProcesso =
    dados.temProcesso === true ||
    Boolean(dados.numeroProcesso) ||
    fase === 'precatorio_expedido' ||
    fase === 'rpv_expedida' ||
    fase === 'aguardando_expedicao';

  const pontosFortes: string[] = [];
  const pontosAtencao: string[] = [];

  // 1. Elegibilidade jurídica para antecipação / cessão
  let elegivel = true;
  let status: StatusCuradoria = 'qualificado';

  if (fase === 'em_andamento_sem_sentenca') {
    elegivel = false;
    status = 'nao_elegivel';
    pontosAtencao.push('Processo ainda em fase inicial/sem sentença definitiva transitada em julgado.');
  }

  if (dados.tipo === 'outro') {
    pontosAtencao.push('Tipo de crédito judicial não especificado. Requer triagem técnica.');
  }

  // 2. Análise de Titularidade (próprio titular vs advogado vs broker vs herdeiro)
  if (titular === 'proprio_titular') {
    pontosFortes.push('Titular originário direto: negociação direta, processo de cessão mais ágil.');
  } else if (titular === 'advogado') {
    pontosFortes.push('Advogado(a) do processo: potencial para antecipação de honorários contratuais/sucumbenciais ou parceria.');
  } else if (titular === 'broker') {
    pontosFortes.push('Broker / Intermediário: parceiro comercial com potencial de volume de carteira.');
  } else if (titular === 'herdeiro_espolio') {
    if (status !== 'nao_elegivel') status = 'em_qualificacao';
    pontosAtencao.push('Herdeiro/Espólio: necessário conferir inventário/formal de partilha e habilitação nos autos.');
  } else if (titular === 'terceiro') {
    pontosAtencao.push('Terceiro/Familiar: validar procuração e titularidade do credor.');
  }

  // Se for advogado ou broker e informou os dados do titular originário:
  if (titular !== 'proprio_titular') {
    if (dados.nomeTitular || dados.cpfTitular) {
      pontosFortes.push(`Dados do titular originário fornecidos (${dados.nomeTitular || 'Nome informado'}${dados.cpfTitular ? ' / CPF informado' : ''}).`);
    } else {
      pontosAtencao.push('Dados do titular originário ainda não fornecidos (solicitar nome, CPF e telefone do titular).');
    }
  }

  // 3. Documentação e Processo
  if (temProcesso) {
    pontosFortes.push('🔥 Processo com precatório/RPV confirmado ou expedido (Caso prioritário).');
  }
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
    (temProcesso && valorNum && valorNum >= 100_000 && (temOficio || dados.tipo === 'federal')) ||
    (temOficio && valorNum && valorNum >= 150_000)
  ) {
    rank = 'A+';
    status = 'qualificado';
  } else if (
    temProcesso &&
    (dados.tipo === 'federal' || dados.tipo === 'estadual' || dados.tipo === 'municipal') &&
    (temOficio || (valorNum && valorNum >= 40_000) || titular === 'proprio_titular') &&
    intencao !== 'sem_interesse'
  ) {
    rank = 'A';
    status = 'qualificado';
  } else if ((temProcesso || dados.uf) && intencao !== 'sem_interesse') {
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
      'Explique educadamente que a antecipação só ocorre após o término do processo e a expedição do precatório pela Justiça. Não dê falsas esperanças, mas ofereça o WhatsApp da equipe para dúvidas futuras.';
    orientacoesComercial =
      'Lead informou processo em andamento sem sentença. Esclarecer ao cliente que ele ainda deve aguardar o trânsito em julgado antes de poder negociar.';
  } else if (rank === 'A+' || rank === 'A') {
    orientacaoParaKaren =
      'Lead altamente qualificado 🔥. Valide os dados de contato, confirme o WhatsApp e informe que um especialista já está preparando a análise gratuita com contato pelo WhatsApp.';
    orientacoesComercial =
      'Lead prioritário quente com processo ativo 🔥. Abordagem rápida via WhatsApp com saudação personalizada e oferta de análise do ofício.';
  } else if (titular === 'advogado' || titular === 'broker') {
    orientacaoParaKaren =
      'Acolha com profissionalismo e respeito. Solicite o nome completo e CPF do titular para facilitar a consulta ao tribunal, e garanta que o especialista entrará em contato para alinhar os termos de cessão.';
    orientacoesComercial =
      `Contato com ${titular === 'advogado' ? 'Advogado(a)' : 'Broker'}. Alinhar comissão/honorários e solicitar documentos do titular originário.`;
  } else if (titular === 'herdeiro_espolio') {
    orientacaoParaKaren =
      'Acolha com sensibilidade. Explique que a Premium Office atende herdeiros com segurança jurídica e que a análise gratuita ajudará a verificar a cota-parte com a documentação do inventário.';
    orientacoesComercial =
      'Herdeiro de precatório. Solicitar certidão de óbito do titular, termo de inventariante ou formal de partilha para verificar a cota cedível.';
  } else {
    orientacaoParaKaren =
      'Lead com potencial em qualificação. Colete a UF, município e WhatsApp para o especialista fazer a busca do processo no tribunal correspondente.';
    orientacoesComercial =
      'Lead em qualificação. Solicitar CPF ou número do processo para o especialista consultar a situação no tribunal.';
  }

  const parecerCuradoria = [
    `Status: ${ROTULO_STATUS[status]} | Rank: ${rank}`,
    `Titularidade: ${ROTULO_TITULAR[titular]} | Fase: ${ROTULO_FASE[fase]}`,
    temProcesso ? '🔥 Processo Ativo' : null,
    dados.tipo ? `Esfera: ${dados.tipo.toUpperCase()}` : null,
    dados.uf ? `UF: ${dados.uf}` : null,
    dados.municipio ? `Município: ${dados.municipio}` : null,
    dados.valorAproximado ? `Valor citado: ${dados.valorAproximado}` : null,
    dados.melhorHorarioContato ? `Melhor horário: ${dados.melhorHorarioContato}${dados.melhorDiaContato ? ` (${dados.melhorDiaContato})` : ''}` : null,
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
    vinculoTitular: dados.vinculoTitular ?? null,
    faseProcesso: fase,
    situacaoExpedicao: dados.situacaoExpedicao ?? (fase === 'precatorio_expedido' ? 'expedido' : fase === 'em_andamento_sem_sentenca' ? 'em_andamento' : null),
    melhorHorarioContato: dados.melhorHorarioContato ?? null,
    melhorDiaContato: dados.melhorDiaContato ?? null,
    intencao,
    valorNumerico: valorNum,
    temProcesso,
    municipio: dados.municipio ?? null,
    nomeTitular: dados.nomeTitular ?? null,
    cpfTitular: dados.cpfTitular ?? null,
    celularTitular: dados.celularTitular ?? null,
    numeroProcesso: dados.numeroProcesso ?? null,
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
  extra?: { nome?: string; celular?: string; uf?: string; municipio?: string; tipo?: string; resumo?: string }
): string {
  const linhas: string[] = [
    '🎯 CURADORIA DO LEAD — KAREN (SECRETÁRIA DIGITAL):',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `• Classificação: ${ROTULO_STATUS[curadoria.status]}`,
    `• Rank do Lead: ${ROTULO_RANK[curadoria.rank]}`,
    `• Relação com o Crédito: ${ROTULO_TITULAR[curadoria.relacaoTitular]}${curadoria.vinculoTitular ? ` (${curadoria.vinculoTitular})` : ''}`,
    `• Processo Ativo / Expedido: ${curadoria.temProcesso ? '🔥 SIM (Foguinho ativado no Bitrix)' : 'NÃO / EM APURAÇÃO'}`,
    `• Fase do Processo: ${ROTULO_FASE[curadoria.faseProcesso]}`,
    curadoria.melhorHorarioContato ? `• Melhor Horário para Contato: ${curadoria.melhorHorarioContato}${curadoria.melhorDiaContato ? ` (${curadoria.melhorDiaContato})` : ''}` : null,
    `• Intenção declarada: ${ROTULO_INTENCAO[curadoria.intencao]}`,
  ].filter((l): l is string => Boolean(l));

  if (extra?.tipo) linhas.push(`• Esfera / Tipo: ${extra.tipo.toUpperCase()}`);
  if (extra?.uf) linhas.push(`• Estado do Processo (UF): ${extra.uf}`);
  if (extra?.municipio || curadoria.municipio) linhas.push(`• Município: ${extra?.municipio || curadoria.municipio}`);
  if (curadoria.numeroProcesso) linhas.push(`• Número do Processo: ${curadoria.numeroProcesso}`);

  if (curadoria.relacaoTitular !== 'proprio_titular') {
    linhas.push(
      `• Titular Originário: ${curadoria.nomeTitular || 'Não informado'} | CPF: ${curadoria.cpfTitular ? 'Informado' : 'Não informado'} | Celular: ${curadoria.celularTitular || 'Não informado'} | Vínculo: ${curadoria.vinculoTitular || 'Não especificado'}`
    );
  }

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
