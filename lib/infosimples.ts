// SERVER-ONLY: dispara o worker-infosimples, que consulta a Infosimples (andamento e
// precatórios) pelo CPF e posta o resultado como comentário no card do Bitrix24.
// Cada chamada gasta crédito e o worker não deduplica: por isso há trava por sessão
// e nenhum retry automático. Nunca logar o CPF (LGPD).

const DEFAULT_URL = 'https://backend.bmdholding.com.br/infosimples/api/enriquecimento';
// O worker leva até 18 s por fonte; folga abaixo do maxDuration da rota.
const TIMEOUT_MS = 100_000;

const sessoesEnriquecidas = new Set<string>();

export function isInfosimplesConfigured(): boolean {
  return Boolean(process.env.INTERNAL_API_TOKEN);
}

/**
 * Enriquece o Negócio da sessão uma única vez por instância. Falhas são logadas e
 * não propagadas: a consulta é complementar e não pode quebrar o fluxo do ofício.
 */
export async function enriquecerNegocio(input: { sessionId: string; cpf: string; dealId: number }): Promise<void> {
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token) return;
  if (sessoesEnriquecidas.has(input.sessionId)) return;
  sessoesEnriquecidas.add(input.sessionId);

  try {
    const res = await fetch(process.env.INFOSIMPLES_WORKER_URL || DEFAULT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
      body: JSON.stringify({ cpf: input.cpf, entityType: 'deal', entityId: input.dealId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('[infosimples] worker recusou a consulta:', { http: res.status, erro: data?.erro ?? data?.error });
      return;
    }
    if (data?.comentarioPostado === false) {
      console.warn('[infosimples] consulta feita, mas o comentário não foi postado:', data?.avisoBitrix);
    }
  } catch (error) {
    console.error('[infosimples] falha ao chamar o worker:', (error as Error).message);
  }
}
