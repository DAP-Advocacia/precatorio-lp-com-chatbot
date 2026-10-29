// SERVER-ONLY: pesquisa do ofício/precatório direto na Infosimples (token INFOSIMPLES_TOKEN), sem
// worker nem API externa. Só roda quando o lead é Federal ou Estadual e a UF é conhecida: Federal
// consulta o TRF da UF, Estadual consulta o TJ da UF. O resultado vira comentário no card do Bitrix24.
// Cada tribunal consultado gasta crédito: há trava por sessão e nenhum retry. Nunca logar o CPF (LGPD).
import { comentarNoNegocio } from '@/lib/bitrix';

const BASE_URL = 'https://api.infosimples.com/api/v2/consultas/';
// Abaixo do maxDuration das rotas (60 s); o `timeout` do payload é o prazo do robô da Infosimples.
const TIMEOUT_MS = 40_000;
const TIMEOUT_ROBO_S = 35;
const MAX_PROCESSOS_POR_TRIBUNAL = 8;

type Servico = { rotulo: string; service: string; params?: Record<string, string | number> };

// Serviços confirmados na Infosimples (sondados sem parâmetros: 606 = existe; 602 = inexistente).
// Não há serviço de CPF para o TRF4 nem para os TJs de AL, AM, CE, DF, ES, GO, MA, MS, MT, PA, PB, PE,
// PI, RN, RO, RR, RS, SE e TO: nesses casos o card recebe o aviso de tribunal não integrado.
const TRF: Record<number, Servico> = {
  1: { rotulo: 'TRF-1', service: 'tribunal/trf1/processo' },
  2: { rotulo: 'TRF-2', service: 'tribunal/trf2/processo' },
  3: { rotulo: 'TRF-3', service: 'tribunal/trf3/processo' },
  5: { rotulo: 'TRF-5', service: 'tribunal/trf5/processo' },
  6: { rotulo: 'TRF-6', service: 'tribunal/trf6/processo' },
};

const TJ: Record<string, Servico[]> = {
  BA: [{ rotulo: 'TJBA', service: 'tribunal/tjba/primeiro-grau' }],
  MG: [{ rotulo: 'TJMG', service: 'tribunal/tjmg/processo' }],
  PR: [{ rotulo: 'TJPR', service: 'tribunal/tjpr/processo' }],
  RJ: [{ rotulo: 'TJRJ', service: 'tribunal/tjrj/processo', params: { origem: '2' } }],
  SC: [{ rotulo: 'TJSC', service: 'tribunal/tjsc/processo' }],
  SP: [
    { rotulo: 'TJSP (e-SAJ)', service: 'tribunal/tjsp/primeiro-grau', params: { pagina: 1 } },
    { rotulo: 'TJSP (eproc)', service: 'tribunal/tjsp/eproc-lista' },
  ],
};

// Região da Justiça Federal por UF (TRF6 = Minas Gerais).
const TRF_POR_UF: Record<string, number> = {
  AC: 1, AM: 1, AP: 1, BA: 1, DF: 1, GO: 1, MA: 1, MT: 1, PA: 1, PI: 1, RO: 1, RR: 1, TO: 1,
  ES: 2, RJ: 2,
  MS: 3, SP: 3,
  PR: 4, RS: 4, SC: 4,
  AL: 5, CE: 5, PB: 5, PE: 5, RN: 5, SE: 5,
  MG: 6,
};

const sessoesConsultadas = new Set<string>();

export function isInfosimplesConfigured(): boolean {
  return Boolean(process.env.INFOSIMPLES_TOKEN);
}

type Alvo = { servicos: Servico[]; escopo: string; motivo?: string };

/** Define onde consultar: Federal -> TRF da UF; Estadual -> TJ da UF. Sem UF nem sigla do tribunal, não consulta. */
function alvosDaConsulta(esfera: 'federal' | 'estadual', uf: string | null, sigla: string | null): Alvo | null {
  if (esfera === 'federal') {
    const n = Number(/^TRF([1-6])$/.exec(sigla ?? '')?.[1]) || (uf ? TRF_POR_UF[uf] : undefined);
    if (!n) return null;
    const servico = TRF[n];
    return servico
      ? { servicos: [servico], escopo: `Federal, ${servico.rotulo}` }
      : { servicos: [], escopo: `Federal, TRF-${n}`, motivo: `A Infosimples não oferece consulta por CPF no TRF-${n}.` };
  }
  const ufTj = /^TJ([A-Z]{2})$/.exec(sigla ?? '')?.[1] ?? uf;
  if (!ufTj) return null;
  const servicos = TJ[ufTj];
  return servicos
    ? { servicos, escopo: `Estadual, ${servicos.map((s) => s.rotulo).join(' + ')}` }
    : { servicos: [], escopo: `Estadual, TJ${ufTj}`, motivo: `A Infosimples não oferece consulta por CPF no TJ${ufTj}.` };
}

type Processo = { numero: string; classe?: string; assunto?: string; orgao?: string; valor?: string; ultimaMov?: string; relevante: boolean };
type ResultadoTribunal =
  | { rotulo: string; status: 'ok'; processos: Processo[]; total: number }
  | { rotulo: string; status: 'nada' | 'restrito' | 'erro'; detalhe?: string };

const str = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  return undefined;
};
const primeiro = (o: Record<string, any>, chaves: string[]) => {
  for (const k of chaves) {
    const v = str(o[k]);
    if (v) return v;
  }
  return undefined;
};
const soDigitos = (s: string) => s.replace(/\D/g, '');

// Número CNJ (20 dígitos) ou formato antigo (>= 10 dígitos): descarta CPF/telefone soltos.
const pareceProcesso = (s: string) => soDigitos(s).length >= 10;

/**
 * A resposta varia por tribunal: o registro pode vir na raiz de data[], dentro de uma lista
 * (processos, lista_processos...) ou como texto solto. Considera todos os candidatos.
 */
function extrairProcessos(data: unknown[]): Processo[] {
  const candidatos: Record<string, any>[] = [];
  const empilhar = (item: unknown) => {
    if (typeof item === 'string') candidatos.push({ processo: item });
    else if (item && typeof item === 'object') candidatos.push(item as Record<string, any>);
  };
  for (const d of data) {
    empilhar(d);
    if (d && typeof d === 'object') {
      for (const chave of ['processos', 'lista_processos', 'processos_encontrados', 'lista']) {
        const lista = (d as Record<string, unknown>)[chave];
        if (Array.isArray(lista)) lista.forEach(empilhar);
      }
    }
  }

  const vistos = new Set<string>();
  const processos: Processo[] = [];
  for (const c of candidatos) {
    const numero =
      primeiro(c, ['processo', 'numero', 'numero_processo', 'numero_cnj', 'cnj', 'numero_unico']) ??
      (Array.isArray(c.outros_numeros) ? str(c.outros_numeros[0]) : undefined);
    if (!numero || !pareceProcesso(numero)) continue;
    const chave = soDigitos(numero);
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const classe = primeiro(c, ['classe', 'classe_judicial', 'tipo', 'tipo_processo']);
    const assunto = primeiro(c, ['assunto', 'natureza', 'assunto_principal']);
    const vara = primeiro(c, ['vara', 'orgao_julgador', 'orgao', 'juizo']);
    const foro = primeiro(c, ['foro', 'comarca']);
    const movs = Array.isArray(c.ultimas_movimentacoes) ? c.ultimas_movimentacoes : Array.isArray(c.movimentacoes) ? c.movimentacoes : [];
    const mov = movs[0] && typeof movs[0] === 'object' ? movs[0] : undefined;
    const ultimaMov = mov ? [str(mov.data), primeiro(mov, ['movimento', 'descricao', 'texto'])].filter(Boolean).join(' - ') : undefined;
    const textoBusca = `${classe ?? ''} ${assunto ?? ''} ${vara ?? ''} ${movs.map((m: any) => str(m?.movimento) ?? '').join(' ')}`;

    processos.push({
      numero,
      classe,
      assunto,
      orgao: vara ? (foro ? `${vara} - ${foro}` : vara) : foro,
      valor: primeiro(c, ['valor_acao', 'valor_causa', 'valor', 'valor_execucao']),
      ultimaMov: ultimaMov || undefined,
      relevante: /precat|fazenda|requisi|rpv|inss|uni[aã]o|cumprimento de senten/i.test(textoBusca),
    });
  }
  return processos;
}

async function consultarTribunal(token: string, cpf: string, s: Servico): Promise<ResultadoTribunal> {
  try {
    const res = await fetch(`${BASE_URL}${s.service}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, timeout: TIMEOUT_ROBO_S, cpf, ...s.params }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json: any = await res.json().catch(() => null);
    const code: number = json?.code ?? res.status;
    const dados: unknown[] = Array.isArray(json?.data) ? json.data : [];

    if (code === 200) {
      const processos = extrairProcessos(dados);
      if (!processos.length) {
        // Sucesso com itens que nada casou: loga só as chaves (sem dados pessoais) para diagnosticar o formato.
        if (dados.length || json?.data_count > 0) {
          console.warn('[infosimples] resposta com dados mas sem processo reconhecido:', {
            tribunal: s.rotulo,
            data_count: json?.data_count,
            chaves: dados.map((d) => (d && typeof d === 'object' ? Object.keys(d as object) : typeof d)).slice(0, 3),
          });
        }
        return { rotulo: s.rotulo, status: 'nada' };
      }
      return { rotulo: s.rotulo, status: 'ok', processos, total: processos.length };
    }
    if (code === 612) return { rotulo: s.rotulo, status: 'nada' };
    if (code === 620 || (json?.errors ?? []).some((e: unknown) => /restrit|segredo|sigil/i.test(String(e)))) {
      return { rotulo: s.rotulo, status: 'restrito', detalhe: str(json?.errors?.[0]) };
    }
    console.error('[infosimples] tribunal respondeu com erro:', { tribunal: s.rotulo, code, msg: json?.code_message, erros: json?.errors });
    return { rotulo: s.rotulo, status: 'erro', detalhe: `código ${code}${json?.code_message ? `: ${json.code_message}` : ''}` };
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('[infosimples] falha na consulta:', { tribunal: s.rotulo, erro: (error as Error).message });
    return { rotulo: s.rotulo, status: 'erro', detalhe: timeout ? 'tempo limite esgotado' : 'falha de conexão' };
  }
}

function textoComentario(escopo: string, resultados: ResultadoTribunal[]): string {
  const achou = resultados.some((r) => r.status === 'ok');
  const linhas = [`[LP] Pesquisa Infosimples por CPF do titular (${escopo}): ${achou ? 'PROCESSO LOCALIZADO' : 'nada localizado'}`];
  for (const r of resultados) {
    if (r.status === 'ok') {
      linhas.push(`● ${r.rotulo}: ${r.total} processo(s) localizado(s)`);
      for (const p of r.processos.slice(0, MAX_PROCESSOS_POR_TRIBUNAL)) {
        const detalhe = [p.relevante ? 'possível precatório/RPV' : null, p.classe, p.assunto, p.orgao, p.valor && `Valor: ${p.valor}`, p.ultimaMov && `Última mov.: ${p.ultimaMov}`]
          .filter(Boolean)
          .join(' | ');
        linhas.push(`   ↳ ${p.numero}${detalhe ? ` | ${detalhe}` : ''}`);
      }
      if (r.total > MAX_PROCESSOS_POR_TRIBUNAL) linhas.push(`   ↳ e mais ${r.total - MAX_PROCESSOS_POR_TRIBUNAL} processo(s)`);
    } else if (r.status === 'nada') {
      linhas.push(`● ${r.rotulo}: nada localizado na base aberta`);
    } else if (r.status === 'restrito') {
      linhas.push(`▲ ${r.rotulo}: acesso restrito ou segredo de justiça${r.detalhe ? ` (${r.detalhe})` : ''}`);
    } else {
      linhas.push(`▲ ${r.rotulo}: consulta não concluída${r.detalhe ? ` (${r.detalhe})` : ''}`);
    }
  }
  if (!achou) linhas.push('→ Pode haver segredo de justiça, expedição recente ou outro tribunal: peça ao cliente o número do processo ou o ofício.');
  return linhas.join('\n');
}

/**
 * Pesquisa o processo do titular nos tribunais da UF e comenta o resultado no Negócio. Só para
 * leads Federais ou Estaduais com UF (ou sigla do tribunal, vinda do ofício). Uma vez por sessão e
 * instância. Falhas são logadas e não propagadas: a consulta é complementar e não pode quebrar o fluxo.
 */
export async function pesquisarProcessoNoCard(input: {
  sessionId: string;
  dealId: number;
  cpf: string;
  esfera?: string | null;
  uf?: string | null;
  tribunalSigla?: string | null;
}): Promise<void> {
  if (input.esfera !== 'federal' && input.esfera !== 'estadual') return;
  const alvo = alvosDaConsulta(input.esfera, input.uf?.trim().toUpperCase() || null, input.tribunalSigla ?? null);
  if (!alvo) {
    console.info('[infosimples] pesquisa não disparada: UF/tribunal desconhecido');
    return;
  }
  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) {
    console.warn('[infosimples] INFOSIMPLES_TOKEN ausente: pesquisa do ofício não executada');
    return;
  }
  if (sessoesConsultadas.has(input.sessionId)) return;
  sessoesConsultadas.add(input.sessionId);

  try {
    if (!alvo.servicos.length) {
      await comentarNoNegocio(input.dealId, `[LP] Pesquisa Infosimples não realizada (${alvo.escopo}). ${alvo.motivo ?? ''} Peça o número do processo ou o ofício ao cliente.`);
      return;
    }
    const resultados = await Promise.all(alvo.servicos.map((s) => consultarTribunal(token, input.cpf, s)));
    console.info('[infosimples] pesquisa concluída:', {
      escopo: alvo.escopo,
      resultados: resultados.map((r) => ({ tribunal: r.rotulo, status: r.status, total: r.status === 'ok' ? r.total : undefined })),
    });
    await comentarNoNegocio(input.dealId, textoComentario(alvo.escopo, resultados));
  } catch (error) {
    console.error('[infosimples] falha ao registrar a pesquisa no card:', (error as Error).message);
  }
}
