// SERVER-ONLY: enriquecimento de todo card criado por esta LP (qualquer rota do teste A/B)
// assim que o CPF é conhecido, venha do ofício, do formulário ou da secretária digital.
//   Lemit       dados cadastrais (nome, nascimento, óbito, contatos) cruzados com o declarado
//   Infosimples andamento e precatórios do CPF (o worker posta direto no card)
// Uma vez por sessão e instância: cada consulta gasta crédito. Nunca logar o CPF (LGPD).
import { comentarNoNegocio } from '@/lib/bitrix';
import { enriquecerNegocio as enriquecerInfosimples } from '@/lib/infosimples';
import { consultarCpfLemit, type PessoaLemit } from '@/lib/lemit';

const sessoesLemit = new Set<string>();

const normalizarNome = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();

// Confere o primeiro e o último nome: o cliente costuma omitir os do meio.
function nomeConfere(declarado: string, oficial: string): boolean {
  const a = normalizarNome(declarado).split(' ');
  const b = normalizarNome(oficial).split(' ');
  return a[0] === b[0] && (a.length === 1 || a[a.length - 1] === b[b.length - 1]);
}

const formatData = (iso: string) => iso.split('-').reverse().join('/');
const formatFone = (d: string) =>
  d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;

function textoLemit(p: PessoaLemit, declarado: { nome?: string | null; celular?: string | null }): string {
  const alertas: string[] = [];
  if (p.obito) alertas.push('▲ Indicação de ÓBITO do titular: tratar como caso de herdeiros/espólio.');
  if (p.idade != null && p.idade >= 60) alertas.push(`● Titular com ${p.idade} anos: possível prioridade de pagamento por idade.`);
  if (p.nome && declarado.nome && !nomeConfere(declarado.nome, p.nome)) {
    alertas.push(`▲ Nome declarado ("${declarado.nome}") difere do nome na base ("${p.nome}"): confirmar se é o titular ou herdeiro/advogado.`);
  }
  const cel = declarado.celular?.replace(/\D/g, '');
  if (cel && p.telefones.length && !p.telefones.some((t) => t.endsWith(cel.slice(-8)))) {
    alertas.push('● O telefone informado não consta na base da Lemit (pode ser de familiar ou número novo).');
  }
  const linhas = [
    '[LP] Enriquecimento Lemit (dados cadastrais do CPF, cruzados com o que o cliente informou):',
    ...alertas,
    p.nome && `Nome na base: ${p.nome}`,
    p.nascimento && `Nascimento: ${formatData(p.nascimento)}${p.idade != null ? ` (${p.idade} anos)` : ''}`,
    p.mae && `Mãe: ${p.mae}`,
    p.situacaoCadastral && `Situação cadastral: ${p.situacaoCadastral}`,
    p.obito === false && 'Óbito: não consta',
    p.telefones.length && `Telefones: ${p.telefones.slice(0, 5).map(formatFone).join(', ')}`,
    p.emails.length && `E-mails: ${p.emails.slice(0, 3).join(', ')}`,
    ...p.enderecos
      .slice(0, 2)
      .map((e, i) => `Endereço ${i + 1}: ${[e.logradouro, e.cidade, e.uf, e.cep].filter(Boolean).join(' - ')}`),
  ];
  return linhas.filter(Boolean).join('\n');
}

/**
 * Enriquece o Negócio com Lemit e Infosimples. Falhas são logadas e não propagadas: o
 * enriquecimento é complementar e não pode quebrar o fluxo do lead.
 */
export async function enriquecerCard(input: {
  sessionId: string;
  cpf: string;
  dealId: number;
  nomeDeclarado?: string | null;
  celularDeclarado?: string | null;
}): Promise<void> {
  const lemit = (async () => {
    if (sessoesLemit.has(input.sessionId)) return;
    sessoesLemit.add(input.sessionId);
    const pessoa = await consultarCpfLemit(input.cpf);
    if (!pessoa) return;
    await comentarNoNegocio(input.dealId, textoLemit(pessoa, { nome: input.nomeDeclarado, celular: input.celularDeclarado })).catch(
      (error) => console.error('[enriquecimento] falha ao postar a Lemit no card:', (error as Error).message)
    );
  })();
  const infosimples = enriquecerInfosimples({ sessionId: input.sessionId, cpf: input.cpf, dealId: input.dealId });
  await Promise.allSettled([lemit, infosimples]);
}
