'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { OPEN_CHAT_EVENT } from '@/lib/chat-events';
import { enviarLead, enviarOficio, getClientSessionId, type OficioExtraido } from '@/lib/lead-client';
import { formatBRL } from '@/lib/format';
import { track } from '@/lib/track';
import { protocoloFromSession, whatsappLink, WA_DISPLAY } from '@/lib/whatsapp';
import Stepper from '@/components/ab/Stepper';

// Variante B do teste A/B (/antecipe): modal de abertura e formulário em etapas,
// em vidro (glassmorphism). A etapa 1 cria o card (nome, telefone e CPF); o CPF dispara o
// enriquecimento Lemit/Infosimples no servidor, e as respostas seguintes vão para o card
// para o consultor cruzar com o ofício e o enriquecimento.

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
const TITULOS = ['Seus dados', 'Precatório', 'Processo', 'Ofício'];
const TIPOS = ['Federal', 'Estadual', 'Municipal', 'INSS'] as const;
const NATUREZAS = ['Alimentar', 'Comum'] as const;
const NAO_SEI = 'Não sei';

const GLASS = 'border border-white/20 bg-white/[0.08] shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl';
const INPUT =
  'min-h-[50px] w-full rounded-xl border border-white/20 bg-white/[0.07] px-4 font-sans text-base text-white placeholder:text-[#9AA6BC] outline-none transition-colors focus:border-[#DAA520] focus:bg-white/[0.12]';

const digitos = (s: string) => s.replace(/\D/g, '');

function mascaraCelular(raw: string) {
  const d = digitos(raw).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function mascaraCpf(raw: string) {
  const d = digitos(raw).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

function cpfValido(raw: string) {
  const d = digitos(raw);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function celularValido(raw: string) {
  const d = digitos(raw);
  const ddd = Number(d.slice(0, 2));
  return /^\d{10,11}$/.test(d) && ddd >= 11 && ddd <= 99 && (d.length === 10 || d[2] === '9');
}

const nomeValido = (n: string) => n.trim().length >= 2 && /^[\p{L}][\p{L}\s'.-]*$/u.test(n.trim());

type Dados = {
  nome: string;
  celular: string;
  cpf: string;
  tipo: string;
  natureza: string;
  expedicao: string;
  uf: string;
  processo: string;
  valor: string;
};
const VAZIO: Dados = { nome: '', celular: '', cpf: '', tipo: '', natureza: '', expedicao: '', uf: '', processo: '', valor: '' };

function Campo({ id, rotulo, ajuda, erro, acao, children }: { id: string; rotulo: string; ajuda?: string; erro?: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-bold text-white">
          {rotulo}
        </label>
        {acao}
      </div>
      {ajuda && <p className="m-0 mb-2 text-[13px] leading-snug text-[#C7CFDE]">{ajuda}</p>}
      {children}
      {erro && (
        <p role="alert" className="m-0 mt-1.5 text-[13px] font-semibold text-[#FCA5A5]">
          {erro}
        </p>
      )}
    </div>
  );
}

function Opcoes({ id, opcoes, valor, onChange, colunas }: { id: string; opcoes: readonly string[]; valor: string; onChange: (v: string) => void; colunas: string }) {
  return (
    <div id={id} role="radiogroup" className={`grid gap-2 ${colunas}`}>
      {opcoes.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={valor === o}
          onClick={() => onChange(o)}
          className={`min-h-[48px] cursor-pointer rounded-xl border font-sans text-[15px] font-semibold transition-all duration-250 ${
            valor === o
              ? 'border-[#DAA520] bg-[#DAA520]/20 text-[#F5DD90] shadow-[0_0_0_3px_rgba(218,165,32,0.18)]'
              : 'border-white/20 bg-white/[0.06] text-white hover:bg-white/[0.12]'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function NaoSei({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-semibold text-[#F5DD90] hover:underline">
      Não sei →
    </button>
  );
}

function ModalAbertura({ onComecar }: { onComecar: () => void }) {
  const botaoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    botaoRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onComecar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onComecar]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(5,11,22,0.55)] backdrop-blur-md sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="fe-modal-titulo" className={`w-full max-w-[560px] animate-fadeUp rounded-t-3xl p-7 text-white sm:rounded-3xl sm:p-9 ${GLASS} bg-[rgba(16,30,56,0.55)]`}>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#DAA520]/40 bg-[#DAA520]/10 px-3 py-1 text-[13px] font-semibold text-[#F5DD90]">
          ✦ Análise gratuita em 4 passos
        </div>
        <h2 id="fe-modal-titulo" className="m-0 mb-3 text-[clamp(22px,3vw,28px)] font-extrabold leading-tight">
          Atualize o valor do seu precatório
        </h2>
        <p className="m-0 mb-6 text-[16px] leading-[1.6] text-[#C7CFDE]">
          Responda a algumas perguntas rápidas sobre o seu precatório. Um especialista cruza as informações com os dados do
          processo e retorna pelo WhatsApp com a análise, sem compromisso.
        </p>
        <ul className="m-0 mb-7 list-none space-y-2 p-0 text-[15px]">
          {['Cerca de 2 minutos', 'Dados criptografados (LGPD)', 'Sem custo e sem compromisso'].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="font-bold text-[#DAA520]" aria-hidden="true">
                ✓
              </span>
              {t}
            </li>
          ))}
        </ul>
        <button
          ref={botaoRef}
          type="button"
          onClick={onComecar}
          className="min-h-[52px] w-full cursor-pointer rounded-full border-0 bg-[#F7F5F1] font-sans text-base font-extrabold text-navy-accent shadow-[0_12px_32px_rgba(0,0,0,0.3)] transition-colors duration-250 hover:bg-[#DAA520] sm:w-auto sm:px-8"
        >
          Começar agora →
        </button>
      </div>
    </div>
  );
}

export default function FormularioEtapas() {
  const [modalAberto, setModalAberto] = useState(true);
  // A sessão vem do sessionStorage: só existe no navegador, então é lida após a hidratação.
  const [protocolo, setProtocolo] = useState('');
  useEffect(() => setProtocolo(protocoloFromSession(getClientSessionId())), []);
  const [etapa, setEtapa] = useState(0);
  const [direcao, setDirecao] = useState<1 | -1>(1);
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [erros, setErros] = useState<Partial<Record<keyof Dados | 'geral', string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState<{ oficio: OficioExtraido | null } | null>(null);
  const [erroOficio, setErroOficio] = useState('');
  const secaoRef = useRef<HTMLElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof Dados) => (v: string) => {
    setDados((d) => ({ ...d, [k]: v }));
    setErros((e) => ({ ...e, [k]: undefined, geral: undefined }));
  };

  const focarFormulario = useCallback(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    secaoRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const comecar = useCallback(() => {
    setModalAberto(false);
    track('chat_start', { origem: 'modal_formulario', variante: 'formulario' });
    focarFormulario();
  }, [focarFormulario]);

  useEffect(() => {
    const onOpen = () => (modalAberto ? comecar() : focarFormulario());
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, [modalAberto, comecar, focarFormulario]);

  const declaracoes = (): [string, string][] =>
    (
      [
        ['Tipo de precatório', dados.tipo],
        ['Natureza', dados.natureza],
        ['Data de expedição', dados.expedicao && dados.expedicao !== NAO_SEI ? dados.expedicao.split('-').reverse().join('/') : dados.expedicao],
        ['UF do processo', dados.uf],
        ['Nº do processo (cliente)', dados.processo],
        ['Valor aproximado (cliente)', dados.valor],
      ] as [string, string][]
    ).filter(([, v]) => v);

  const conversa = () => declaracoes().map(([k, v]) => ({ role: 'user' as const, text: `${k}: ${v}` }));

  function avancar() {
    setDirecao(1);
    setEtapa((e) => e + 1);
    track('form_etapa', { variante: 'formulario', etapa: etapa + 2 });
  }

  function voltar() {
    setDirecao(-1);
    setEtapa((e) => Math.max(0, e - 1));
  }

  async function continuar() {
    if (etapa === 0) {
      const e: typeof erros = {};
      if (!nomeValido(dados.nome)) e.nome = 'Informe seu nome (somente letras).';
      if (!celularValido(dados.celular)) e.celular = 'Informe um celular válido com DDD.';
      if (!cpfValido(dados.cpf)) e.cpf = 'Confira o CPF: os números não formam um CPF válido.';
      setErros(e);
      if (Object.keys(e).length) return;
      setEnviando(true);
      const r = await enviarLead({
        variante: 'formulario',
        stage: 'form_contato',
        lead: { nome: dados.nome.trim(), celular: digitos(dados.celular), cpf: digitos(dados.cpf) },
      });
      setEnviando(false);
      if (!r.ok) {
        setErros(r.field && r.field in VAZIO ? { [r.field]: r.error } : { geral: r.error });
        return;
      }
      track('lead_celular', { variante: 'formulario' });
      avancar();
      return;
    }
    if (etapa === 1) {
      const e: typeof erros = {};
      if (!dados.tipo) e.tipo = 'Escolha uma opção ou toque em "Não sei".';
      if (!dados.natureza) e.natureza = 'Escolha uma opção ou toque em "Não sei".';
      setErros(e);
      if (!Object.keys(e).length) avancar();
      return;
    }
    if (etapa === 2) {
      if (!dados.uf) {
        setErros({ uf: 'Selecione o estado do processo.' });
        return;
      }
      setEnviando(true);
      const r = await enviarLead({
        variante: 'formulario',
        stage: 'form_processo',
        resultado: 'lead_qualificado',
        lead: { nome: dados.nome.trim(), celular: digitos(dados.celular), estado: dados.uf },
        declaracoes: declaracoes(),
      });
      setEnviando(false);
      if (!r.ok) {
        setErros({ geral: r.error });
        return;
      }
      track('lead_estado', { uf: dados.uf, variante: 'formulario' });
      avancar();
    }
  }

  async function anexar(file: File | undefined) {
    if (!file) return;
    setErroOficio('');
    setEnviando(true);
    const r = await enviarOficio(file);
    setEnviando(false);
    if (!r.ok) {
      setErroOficio(r.message);
      return;
    }
    // Resultado final: dispara a triagem por IA (respostas do formulário x leitura do ofício).
    void enviarLead({ variante: 'formulario', stage: 'form_oficio', resultado: 'documentos_enviados', conversa: conversa(), oficio: r.extracted });
    track('form_concluido', { variante: 'formulario', com_oficio: true });
    setConcluido({ oficio: r.extracted });
  }

  function pularOficio() {
    track('form_concluido', { variante: 'formulario', com_oficio: false });
    setConcluido({ oficio: null });
  }

  const linkWa = whatsappLink({ nome: dados.nome, protocolo, motivo: 'Preenchi o formulário do site.' });

  return (
    <>
      {modalAberto && <ModalAbertura onComecar={comecar} />}
      <section
        id="ia"
        ref={secaoRef}
        data-screen-label="Formulário em etapas"
        className="relative scroll-mt-4 overflow-hidden bg-navy-deep px-4 py-12 sm:px-8 sm:py-16"
      >
        {/* Fundo para o efeito de vidro: brilhos suaves nas cores da marca. */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#DAA520]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-sky/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-[#003C68]/50 blur-3xl" />

        <div className={`relative mx-auto max-w-[640px] rounded-3xl p-5 text-white sm:p-8 ${GLASS}`}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-[clamp(20px,3vw,26px)] font-extrabold leading-tight">Atualize o valor do seu precatório</h2>
              <p className="m-0 mt-1 text-[13px] text-[#C7CFDE]">
                {concluido ? 'Concluído' : `Passo ${etapa + 1} de ${TITULOS.length} · cerca de 2 minutos`}
              </p>
            </div>
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-[13px] font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              Online
            </span>
          </div>

          {concluido ? (
            <div className="animate-fadeUp text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#DAA520] text-2xl font-bold text-navy" aria-hidden="true">
                ✓
              </div>
              <h3 className="m-0 mb-2 text-xl font-extrabold">Recebemos suas informações, {dados.nome.trim().split(/\s+/)[0]}!</h3>
              <p className="m-0 mb-2 text-[15px] leading-[1.6] text-[#C7CFDE]">
                {concluido.oficio
                  ? `Seu ofício foi recebido${typeof concluido.oficio.valor === 'number' ? ` (valor bruto de ${formatBRL(concluido.oficio.valor)})` : ''}.`
                  : 'Você pode enviar o ofício depois, pelo WhatsApp.'}{' '}
                Um especialista vai cruzar os dados com o processo e retornar pelo WhatsApp com a análise.
              </p>
              <p className="m-0 mb-6 text-[13px] text-[#9AA6BC]">
                Protocolo: <span className="font-mono text-[#F5DD90]">{protocolo}</span>
              </p>
              <a
                href={linkWa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  track('whatsapp_click', { origem: 'formulario_concluido', variante: 'formulario' });
                  void enviarLead({ variante: 'formulario', stage: 'form_whatsapp', resultado: 'falou_consultor', conversa: conversa(), oficio: concluido.oficio });
                }}
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#F7F5F1] px-7 font-extrabold text-navy-accent no-underline hover:bg-[#DAA520]"
              >
                Falar agora no WhatsApp
              </a>
            </div>
          ) : (
            <>
              <Stepper etapa={etapa} titulos={TITULOS} direcao={direcao}>
                {etapa === 0 && (
                  <div>
                    <p className="m-0 mb-5 text-[14px] leading-snug text-[#C7CFDE]">
                      Seus dados ficam com nosso consultor para retornar com a análise do processo. Não compartilhamos com terceiros.
                    </p>
                    <Campo id="fe-nome" rotulo="Nome" erro={erros.nome}>
                      <input id="fe-nome" className={INPUT} autoComplete="name" value={dados.nome} onChange={(e) => set('nome')(e.target.value)} maxLength={120} />
                    </Campo>
                    <Campo id="fe-celular" rotulo="Telefone / WhatsApp" erro={erros.celular}>
                      <input
                        id="fe-celular"
                        className={`${INPUT} font-mono`}
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="(21) 90000-0000"
                        value={dados.celular}
                        onChange={(e) => set('celular')(mascaraCelular(e.target.value))}
                      />
                    </Campo>
                    <Campo id="fe-cpf" rotulo="CPF" ajuda="Usado para localizar o processo e montar a proposta formal. Dados criptografados, conforme a LGPD." erro={erros.cpf}>
                      <input
                        id="fe-cpf"
                        className={`${INPUT} font-mono`}
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={dados.cpf}
                        onChange={(e) => set('cpf')(mascaraCpf(e.target.value))}
                      />
                    </Campo>
                    <p className="m-0 text-[13px] text-[#9AA6BC]">■ Conexão segura · dados criptografados · LGPD</p>
                  </div>
                )}
                {etapa === 1 && (
                  <div>
                    <Campo id="fe-tipo" rotulo="Tipo de precatório" ajuda="Qual a esfera do ente devedor." erro={erros.tipo} acao={<NaoSei onClick={() => set('tipo')(NAO_SEI)} />}>
                      <Opcoes id="fe-tipo" opcoes={[...TIPOS, ...(dados.tipo === NAO_SEI ? [NAO_SEI] : [])]} valor={dados.tipo} onChange={set('tipo')} colunas="grid-cols-2 sm:grid-cols-4" />
                    </Campo>
                    <Campo
                      id="fe-natureza"
                      rotulo="Natureza"
                      ajuda="Alimentar: salários, aposentadoria, honorários, indenizações por morte ou invalidez. Comum: o restante (desapropriação, tributário, contratual)."
                      erro={erros.natureza}
                      acao={<NaoSei onClick={() => set('natureza')(NAO_SEI)} />}
                    >
                      <Opcoes id="fe-natureza" opcoes={[...NATUREZAS, ...(dados.natureza === NAO_SEI ? [NAO_SEI] : [])]} valor={dados.natureza} onChange={set('natureza')} colunas="grid-cols-2" />
                    </Campo>
                    <Campo
                      id="fe-expedicao"
                      rotulo="Data de expedição"
                      ajuda="Data em que o juiz expediu o precatório; consta no processo ou no ofício requisitório."
                      acao={<NaoSei onClick={() => set('expedicao')(NAO_SEI)} />}
                    >
                      {dados.expedicao === NAO_SEI ? (
                        <button type="button" onClick={() => set('expedicao')('')} className={`${INPUT} cursor-pointer text-left text-[#C7CFDE]`}>
                          Não sei a data · toque para informar
                        </button>
                      ) : (
                        <input id="fe-expedicao" type="date" className={`${INPUT} font-mono [color-scheme:dark]`} value={dados.expedicao} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('expedicao')(e.target.value)} />
                      )}
                    </Campo>
                  </div>
                )}
                {etapa === 2 && (
                  <div>
                    <Campo id="fe-uf" rotulo="Estado do processo" ajuda="UF do tribunal onde corre o processo (não necessariamente onde você mora)." erro={erros.uf}>
                      <select id="fe-uf" className={`${INPUT} [color-scheme:dark]`} value={dados.uf} onChange={(e) => set('uf')(e.target.value)}>
                        <option value="">Selecione</option>
                        {UFS.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo id="fe-processo" rotulo="Número do processo (opcional)">
                      <input id="fe-processo" className={`${INPUT} font-mono`} placeholder="0000000-00.0000.0.00.0000" value={dados.processo} maxLength={40} onChange={(e) => set('processo')(e.target.value)} />
                    </Campo>
                    <Campo id="fe-valor" rotulo="Valor aproximado (opcional)" ajuda="Se souber, o valor que consta no ofício.">
                      <input id="fe-valor" className={`${INPUT} font-mono`} inputMode="decimal" placeholder="R$ 0,00" value={dados.valor} maxLength={30} onChange={(e) => set('valor')(e.target.value)} />
                    </Campo>
                  </div>
                )}
                {etapa === 3 && (
                  <div>
                    <p className="m-0 mb-5 text-[15px] leading-[1.6] text-[#C7CFDE]">
                      Com o ofício requisitório, o especialista confere os dados e a proposta sai mais rápido. Envie em PDF ou foto (até 4 MB).
                    </p>
                    <input ref={arquivoRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => anexar(e.target.files?.[0])} />
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => arquivoRef.current?.click()}
                      className="flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/30 bg-white/[0.05] font-sans text-white transition-colors hover:border-[#DAA520] hover:bg-white/[0.1] disabled:opacity-60"
                    >
                      <span className="text-2xl text-[#DAA520]" aria-hidden="true">
                        ▲
                      </span>
                      <span className="text-[15px] font-bold">{enviando ? 'Lendo o ofício...' : 'Enviar ofício'}</span>
                      <span className="text-[13px] text-[#9AA6BC]">PDF, JPG, PNG ou WEBP</span>
                    </button>
                    {erroOficio && (
                      <p role="alert" className="m-0 mt-2 text-[13px] font-semibold text-[#FCA5A5]">
                        {erroOficio}
                      </p>
                    )}
                  </div>
                )}
              </Stepper>

              {erros.geral && (
                <p role="alert" className="m-0 mt-4 text-[13px] font-semibold text-[#FCA5A5]">
                  {erros.geral}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/15 pt-5">
                <a
                  href={linkWa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('whatsapp_click', { origem: 'formulario_etapa', variante: 'formulario', etapa: etapa + 1 })}
                  className="text-[14px] font-semibold text-white no-underline hover:underline"
                >
                  Falar com atendente
                </a>
                <div className="flex gap-2">
                  {etapa > 0 && (
                    <button type="button" onClick={voltar} disabled={enviando} className="min-h-[48px] cursor-pointer rounded-full border border-white/30 bg-transparent px-5 font-sans text-[15px] font-semibold text-white hover:bg-white/10">
                      Voltar
                    </button>
                  )}
                  {etapa < 3 ? (
                    <button
                      type="button"
                      onClick={continuar}
                      disabled={enviando}
                      className="min-h-[48px] cursor-pointer rounded-full border-0 bg-[#F7F5F1] px-6 font-sans text-[15px] font-extrabold text-navy-accent hover:bg-[#DAA520] disabled:opacity-60"
                    >
                      {enviando ? 'Enviando...' : 'Continuar'}
                    </button>
                  ) : (
                    <button type="button" onClick={pularOficio} disabled={enviando} className="min-h-[48px] cursor-pointer rounded-full border-0 bg-[#F7F5F1] px-6 font-sans text-[15px] font-extrabold text-navy-accent hover:bg-[#DAA520]">
                      Enviar depois
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <p className="relative m-0 mt-4 text-center text-[13px] text-[#9AA6BC]">Prefere falar direto? WhatsApp {WA_DISPLAY}</p>
      </section>
    </>
  );
}
