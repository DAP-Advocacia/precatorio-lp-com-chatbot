// SERVER-ONLY: consulta de pessoa física por CPF na Lemit (mesmo cliente do Precatório
// Ferramentas). O resultado nunca volta ao navegador: vai só para o card do Bitrix (LGPD).
//   LEMIT_API_URL     endpoint; "{cpf}" é trocado pelos 11 dígitos (sem "{cpf}", vai no corpo do POST)
//   LEMIT_API_TOKEN   token da conta
//   LEMIT_AUTH_HEADER cabeçalho do token (padrão "Authorization", enviado como "Bearer <token>")
import { maskCpf } from '@/lib/oficio-extract';

const TIMEOUT_MS = 30_000;

export type Endereco = { logradouro: string; cidade: string | null; uf: string | null; cep: string | null };
export type PessoaLemit = {
  nome: string | null;
  nascimento: string | null; // AAAA-MM-DD
  idade: number | null;
  mae: string | null;
  situacaoCadastral: string | null;
  obito: boolean | null;
  telefones: string[];
  emails: string[];
  enderecos: Endereco[];
};

export const isLemitConfigured = () => Boolean(process.env.LEMIT_API_URL && process.env.LEMIT_API_TOKEN);

type Obj = Record<string, unknown>;
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const chave = (k: string) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Primeiro valor encontrado (busca em largura) para qualquer um dos nomes de campo.
function achar(raiz: unknown, nomes: string[]): unknown {
  const alvos = new Set(nomes.map(chave));
  const fila: unknown[] = [raiz];
  while (fila.length) {
    const atual = fila.shift();
    if (Array.isArray(atual)) {
      fila.push(...atual);
      continue;
    }
    if (!ehObj(atual)) continue;
    for (const [k, v] of Object.entries(atual)) if (alvos.has(chave(k)) && v != null && v !== '') return v;
    fila.push(...Object.values(atual));
  }
  return undefined;
}

const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

function dataIso(v: unknown): string | null {
  const s = texto(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

function idadeEm(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.split('-').map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

function telefones(raiz: unknown): string[] {
  const nums = lista(achar(raiz, ['telefones', 'phones', 'celulares', 'telefone', 'celular'])).map((t) => {
    if (ehObj(t)) {
      const ddd = texto(achar(t, ['ddd'])) ?? '';
      const num = texto(achar(t, ['numero', 'number', 'telefone', 'fone', 'celular'])) ?? '';
      return `${ddd}${num}`.replace(/\D/g, '');
    }
    return (texto(t) ?? '').replace(/\D/g, '');
  });
  return [...new Set(nums.filter((t) => t.length >= 8))];
}

function emails(raiz: unknown): string[] {
  const vals = lista(achar(raiz, ['emails', 'email'])).map((e) => (ehObj(e) ? texto(achar(e, ['email', 'endereco'])) : texto(e)));
  return [...new Set(vals.filter((e): e is string => !!e && e.includes('@')))];
}

function enderecos(raiz: unknown): Endereco[] {
  return lista(achar(raiz, ['enderecos', 'addresses', 'endereco', 'address'])).flatMap((e) => {
    if (!ehObj(e)) {
      const s = texto(e);
      return s ? [{ logradouro: s, cidade: null, uf: null, cep: null }] : [];
    }
    const partes = [
      texto(achar(e, ['tipo_logradouro', 'tipologradouro'])),
      texto(achar(e, ['logradouro', 'rua', 'street'])),
      texto(achar(e, ['numero', 'number'])),
      texto(achar(e, ['complemento'])),
      texto(achar(e, ['bairro', 'neighborhood'])),
    ].filter(Boolean);
    if (!partes.length) return [];
    return [
      {
        logradouro: partes.join(', '),
        cidade: texto(achar(e, ['cidade', 'municipio', 'city'])),
        uf: texto(achar(e, ['uf', 'estado', 'state'])),
        cep: texto(achar(e, ['cep', 'zipcode', 'zip'])),
      },
    ];
  });
}

function obito(raiz: unknown): boolean | null {
  const v = achar(raiz, ['obito', 'falecido', 'flag_obito', 'indicador_obito', 'death']);
  if (typeof v === 'boolean') return v;
  const s = texto(v)?.toLowerCase();
  if (!s) return null;
  if (['s', 'sim', 'true', '1', 'y'].includes(s)) return true;
  return ['n', 'nao', 'não', 'false', '0'].includes(s) ? false : null;
}

function normalizar(bruto: unknown): PessoaLemit {
  const nascimento = dataIso(
    achar(bruto, ['data_nascimento', 'datanascimento', 'nascimento', 'dt_nascimento', 'birth_date', 'birthdate', 'data_de_nascimento'])
  );
  return {
    nome: texto(achar(bruto, ['nome', 'nome_completo', 'name', 'full_name'])),
    nascimento,
    idade: idadeEm(nascimento) ?? (Number(achar(bruto, ['idade', 'age'])) || null),
    mae: texto(achar(bruto, ['nome_mae', 'mae', 'nomemae', 'mother_name', 'nome_da_mae'])),
    situacaoCadastral: texto(achar(bruto, ['situacao_cadastral', 'situacao_receita', 'situacao', 'status_receita'])),
    obito: obito(bruto),
    telefones: telefones(bruto),
    emails: emails(bruto),
    enderecos: enderecos(bruto),
  };
}

/** Consulta o CPF (11 dígitos, já validado). Falhas viram `null` com log sem o CPF completo. */
export async function consultarCpfLemit(cpf: string): Promise<PessoaLemit | null> {
  const url = process.env.LEMIT_API_URL;
  const token = process.env.LEMIT_API_TOKEN;
  if (!url || !token) return null;
  const cabecalho = process.env.LEMIT_AUTH_HEADER || 'Authorization';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    [cabecalho]: cabecalho.toLowerCase() === 'authorization' ? `Bearer ${token}` : token,
  };
  const comCpfNaUrl = url.includes('{cpf}');
  try {
    const res = await fetch(comCpfNaUrl ? url.replace('{cpf}', cpf) : url, {
      method: comCpfNaUrl ? 'GET' : 'POST',
      headers: comCpfNaUrl ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: comCpfNaUrl ? undefined : JSON.stringify({ cpf }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body == null) {
      console.error(`[lemit] HTTP ${res.status} para CPF ${maskCpf(cpf)}`);
      return null;
    }
    return normalizar(body);
  } catch (error) {
    console.error(`[lemit] falha na consulta do CPF ${maskCpf(cpf)}:`, (error as Error).message);
    return null;
  }
}
