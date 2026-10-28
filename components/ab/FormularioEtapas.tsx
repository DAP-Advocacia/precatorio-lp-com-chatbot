'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { XIcon } from 'lucide-react';
import { OPEN_CHAT_EVENT } from '@/lib/chat-events';
import { enviarFormulario, enviarLead, enviarOficio, getClientSessionId, type FormularioPayload, type OficioExtraido } from '@/lib/lead-client';
import { formatBRL } from '@/lib/format';
import { track } from '@/lib/track';
import { protocoloFromSession, whatsappLink, WA_DISPLAY } from '@/lib/whatsapp';
import Stepper from '@/components/ab/Stepper';

// Variante B do teste A/B (/antecipar): Stepper em etapas seguindo o roteiro validado:
//   1. Identificação do interessado (nome completo, CPF validado, celular com DDD);
//   2. Titularidade do precatório ("É meu" vs "É de outra pessoa" com nome, CPF e vínculo);
//   3. Dados do precatório (esfera: federal/estadual/municipal, UF/município, expedição);
//   4. Melhor horário para contato (manhã, tarde, noite, horário comercial + melhor dia);
//   5. Encerramento institucional e encaminhamento ao comercial com ofício opcional.

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const TITULOS = ['Identificação', 'Titularidade', 'Precatório', 'Horário', 'Encerramento'];
const ETAPA_FINAL = TITULOS.length - 1;

// Opções de Esfera
const ESFERAS = ['Federal', 'Estadual', 'Municipal', 'Não sei informar'] as const;

// Opções de Titularidade
const OPCOES_TITULARIDADE = ['É meu.', 'É de outra pessoa.'] as const;

// Sugestões de Vínculo com o Titular
const VINCULOS_SUGERIDOS = ['Familiar', 'Representante legal', 'Advogado(a)', 'Broker / Intermediário', 'Outro'] as const;

// Opções de Situação / Expedição
const OPCOES_EXPEDICAO = [
  'Já foi expedido.',
  'O processo ainda está em andamento.',
  'Não sei informar.',
] as const;

// Opções de Horário de Contato
const HORARIOS_CONTATO = [
  'Manhã',
  'Tarde',
  'Noite',
  'Qualquer horário comercial',
] as const;

// Card escuro sobre a seção porcelain com vidro (glassmorphism)
const GLASS = 'border border-white/20 bg-[rgba(11,27,51,0.88)] shadow-[0_16px_40px_rgba(11,27,51,0.16)] backdrop-blur-xl';
const INPUT =
  'min-h-[50px] w-full rounded-xl border border-white/20 bg-white/[0.07] px-4 font-sans text-base text-white placeholder:text-[#9AA6BC] outline-none transition-colors focus:border-porcelain focus:bg-white/[0.12]';

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
  // Bloco 1: Identificação do interessado
  nome: string;
  cpf: string;
  celular: string;

  // Bloco 2: Titularidade do precatório
  titularidade: string; // 'É meu.' | 'É de outra pessoa.'
  nomeTitular: string;
  cpfTitular: string;
  vinculoTitular: string;

  // Bloco 3: Dados do precatório
  esfera: string; // 'Federal' | 'Estadual' | 'Municipal' | 'Não sei informar'
  uf: string;
  municipio: string;
  situacaoExpedicao: string; // 'Já foi expedido.' | 'O processo ainda está em andamento.' | 'Não sei informar.'
  processo: string;
  valor: string;

  // Bloco 4: Melhor horário para contato
  melhorHorarioContato: string;
  melhorDiaContato: string;
};

const VAZIO: Dados = {
  nome: '',
  cpf: '',
  celular: '',
  titularidade: '',
  nomeTitular: '',
  cpfTitular: '',
  vinculoTitular: '',
  esfera: '',
  uf: '',
  municipio: '',
  situacaoExpedicao: '',
  processo: '',
  valor: '',
  melhorHorarioContato: '',
  melhorDiaContato: '',
};

function Campo({
  id,
  rotulo,
  ajuda,
  erro,
  acao,
  children,
}: {
  id: string;
  rotulo: string;
  ajuda?: string;
  erro?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
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

function Opcoes({
  id,
  opcoes,
  valor,
  onChange,
  colunas = 'grid-cols-1 sm:grid-cols-2',
}: {
  id: string;
  opcoes: readonly string[];
  valor: string;
  onChange: (v: string) => void;
  colunas?: string;
}) {
  return (
    <div id={id} role="radiogroup" className={`grid gap-2.5 ${colunas}`}>
      {opcoes.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={valor === o}
          onClick={() => onChange(o)}
          className={`min-h-[50px] cursor-pointer rounded-xl border px-3 py-2.5 font-sans text-[15px] font-semibold transition-all duration-200 text-left sm:text-center ${
            valor === o
              ? 'border-porcelain bg-porcelain/20 text-porcelain shadow-[0_0_0_3px_rgba(245,242,235,0.18)]'
              : 'border-white/20 bg-white/[0.06] text-white hover:border-transparent hover:bg-porcelain hover:text-navy'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// Modal de abertura
const GLASS_SEM_BORDA = GLASS.replace('border border-white/20 ', '');

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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fe-modal-titulo"
        className={`relative w-full max-w-[560px] animate-fadeUp rounded-t-3xl p-7 text-white sm:rounded-3xl sm:p-9 ${GLASS_SEM_BORDA} bg-[rgba(16,30,56,0.65)]`}
      >
        <button
          type="button"
          onClick={onComecar}
          aria-label="Fechar"
          className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 p-0 text-white transition-colors duration-200 hover:border-transparent hover:bg-porcelain hover:text-navy sm:right-4 sm:top-4"
        >
          <XIcon size={18} aria-hidden="true" />
        </button>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-porcelain/40 bg-porcelain/10 px-3 py-1 text-[13px] font-semibold text-porcelain">
          ✦ Análise e Triagem em 5 passos
        </div>
        <h2 id="fe-modal-titulo" className="m-0 mb-3 text-[clamp(22px,3vw,28px)] font-extrabold leading-tight">
          Consulta & Curadoria de Precatório
        </h2>
        <p className="m-0 mb-6 text-[16px] leading-[1.6] text-[#C7CFDE]">
          Preencha as informações básicas do seu crédito judicial. Nossa equipe especializada cruza os dados com o tribunal e retorna no horário de sua preferência.
        </p>
        <ul className="m-0 mb-7 list-none space-y-2 p-0 text-[15px]">
          {['Menos de 2 minutos', 'Proteção e sigilo LGPD', 'Sem custo e sem compromisso'].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="font-bold text-porcelain" aria-hidden="true">
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
          className="min-h-[52px] w-full cursor-pointer rounded-full border border-transparent bg-[#F5F2EB] font-sans text-base font-extrabold text-navy-accent shadow-[0_12px_32px_rgba(0,0,0,0.3)] transition-colors duration-250 hover:border-transparent hover:bg-navy hover:text-porcelain sm:w-auto sm:px-8"
        >
          Iniciar triagem →
        </button>
      </div>
    </div>
  );
}

export default function FormularioEtapas() {
  const [modalAberto, setModalAberto] = useState(true);
  const [protocolo, setProtocolo] = useState('');
  useEffect(() => setProtocolo(protocoloFromSession(getClientSessionId())), []);
  const [etapa, setEtapa] = useState(0);
  const [direcao, setDirecao] = useState<1 | -1>(1);
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [erros, setErros] = useState<Partial<Record<keyof Dados | 'geral', string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [oficioRecebido, setOficioRecebido] = useState<OficioExtraido | null>(null);
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

  function avancar() {
    setDirecao(1);
    setEtapa((e) => Math.min(ETAPA_FINAL, e + 1));
    track('form_etapa', { variante: 'formulario', etapa: etapa + 2 });
  }

  function voltar() {
    setDirecao(-1);
    setEtapa((e) => Math.max(0, e - 1));
  }

  // Avanço e validação dos 5 passos do roteiro
  async function continuar() {
    // ------------------------------------------------------------- ETAPA 0: Identificação do interessado
    if (etapa === 0) {
      const e: typeof erros = {};
      if (!nomeValido(dados.nome)) e.nome = '1. Por favor, informe seu nome completo.';
      if (!cpfValido(dados.cpf)) e.cpf = '2. Por favor, confira e informe um CPF válido.';
      if (!celularValido(dados.celular)) e.celular = '3. Informe seu telefone celular com DDD para contato.';
      setErros(e);
      if (Object.keys(e).length) return;

      setEnviando(true);
      // Registra dados básicos para contato
      const r = await enviarLead({
        variante: 'formulario',
        stage: 'identificacao_interessado',
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

    // ------------------------------------------------------------- ETAPA 1: Titularidade do precatório
    if (etapa === 1) {
      const e: typeof erros = {};
      if (!dados.titularidade) {
        e.titularidade = 'Pergunta 4: Selecione se o precatório é seu ou de outra pessoa.';
      } else if (dados.titularidade === 'É de outra pessoa.') {
        if (!nomeValido(dados.nomeTitular) || dados.nomeTitular.trim().split(/\s+/).length < 2) {
          e.nomeTitular = '5. Informe o nome completo do titular do precatório.';
        }
        if (!cpfValido(dados.cpfTitular)) {
          e.cpfTitular = '6. Informe um CPF válido do titular do precatório.';
        }
        if (!dados.vinculoTitular.trim()) {
          e.vinculoTitular = '7. Informe o seu vínculo com o titular (ex.: familiar, representante legal, advogado, broker...).';
        }
      }
      setErros(e);
      if (!Object.keys(e).length) avancar();
      return;
    }

    // ------------------------------------------------------------- ETAPA 2: Dados do precatório
    if (etapa === 2) {
      const e: typeof erros = {};
      if (!dados.esfera) {
        e.esfera = 'Pergunta 8: Selecione a esfera do seu precatório.';
      }
      if (dados.esfera === 'Estadual' && !dados.uf) {
        e.uf = 'Pergunta 9: Para precatórios estaduais, informe de qual estado (UF) ele é.';
      }
      if (dados.esfera === 'Municipal') {
        if (!dados.uf) e.uf = 'Pergunta 9: Selecione o estado (UF) do município devedor.';
        if (!dados.municipio.trim() || dados.municipio.trim().length < 2) {
          e.municipio = 'Pergunta 9: Informe o município devedor.';
        }
      }
      if (!dados.situacaoExpedicao) {
        e.situacaoExpedicao = 'Pergunta 10: Informe se o precatório já foi expedido ou está em andamento.';
      }
      setErros(e);
      if (!Object.keys(e).length) avancar();
      return;
    }

    // ------------------------------------------------------------- ETAPA 3: Melhor horário para contato
    if (etapa === 3) {
      const e: typeof erros = {};
      if (!dados.melhorHorarioContato) {
        e.melhorHorarioContato = 'Pergunta 11: Selecione o melhor horário para entrarmos em contato.';
      }
      setErros(e);
      if (Object.keys(e).length) return;

      // Dispara envio final da triagem completa para o Bitrix e WhatsApp API
      const isMeu = dados.titularidade === 'É meu.';
      const tipoMapeado: 'federal' | 'estadual' | 'municipal' | 'nao_sabe' =
        dados.esfera === 'Federal'
          ? 'federal'
          : dados.esfera === 'Estadual'
          ? 'estadual'
          : dados.esfera === 'Municipal'
          ? 'municipal'
          : 'nao_sabe';

      const expedicaoMapeada: 'expedido' | 'em_andamento' | 'nao_sabe' =
        dados.situacaoExpedicao === 'Já foi expedido.'
          ? 'expedido'
          : dados.situacaoExpedicao === 'O processo ainda está em andamento.'
          ? 'em_andamento'
          : 'nao_sabe';

      const payload: FormularioPayload = {
        nome: dados.nome.trim(),
        celular: digitos(dados.celular),
        cpf: digitos(dados.cpf),
        titularidadeOpcao: isMeu ? 'meu' : 'outra_pessoa',
        vinculoTitular: isMeu ? undefined : dados.vinculoTitular.trim(),
        tipo: tipoMapeado,
        uf: dados.uf || 'RJ',
        municipio: dados.municipio.trim() || undefined,
        papel: isMeu ? 'proprio_titular' : 'terceiro',
        titular: isMeu
          ? undefined
          : {
              nome: dados.nomeTitular.trim(),
              cpf: digitos(dados.cpfTitular),
            },
        situacaoExpedicao: expedicaoMapeada,
        fase: expedicaoMapeada === 'expedido' ? 'precatorio_expedido' : expedicaoMapeada === 'em_andamento' ? 'em_andamento_sem_sentenca' : 'nao_sabe',
        melhorHorarioContato: dados.melhorHorarioContato,
        melhorDiaContato: dados.melhorDiaContato.trim() || undefined,
        processo: dados.processo.trim() || undefined,
        valor: dados.valor.trim() || undefined,
      };

      setEnviando(true);
      const r = await enviarFormulario(payload);
      setEnviando(false);
      if (!r.ok) {
        setErros({ geral: r.error });
        return;
      }
      track('form_concluido', { variante: 'formulario', rank_triagem: 'concluida' });
      avancar();
      return;
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
    setOficioRecebido(r.extracted);
    track('oficio_extraido', { variante: 'formulario' });
  }

  const linkWa = whatsappLink({
    nome: dados.nome,
    protocolo,
    motivo: `Preenchi a triagem do precatório no site (Disponibilidade: ${dados.melhorHorarioContato || 'Comercial'}).`,
  });

  return (
    <>
      {modalAberto && <ModalAbertura onComecar={comecar} />}
      <section
        id="ia"
        ref={secaoRef}
        data-screen-label="Formulário em etapas"
        className="relative scroll-mt-4 overflow-hidden bg-white px-4 py-12 sm:px-8 sm:py-16"
      >
        <div className={`relative mx-auto max-w-[660px] rounded-3xl p-6 text-white sm:p-9 ${GLASS}`}>
          {/* Header do Card */}
          <div className="mb-6 flex items-start justify-between gap-3 border-b border-white/10 pb-5">
            <div>
              <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-porcelain/15 px-3 py-0.5 text-[12px] font-bold text-porcelain">
                ⭐ Premium Office · Curadoria de Precatórios
              </div>
              <h2 className="m-0 text-[clamp(20px,3vw,26px)] font-extrabold leading-tight">
                Triagem e Qualificação de Precatório
              </h2>
              <p className="m-0 mt-1 text-[13px] text-[#C7CFDE]">
                {etapa === ETAPA_FINAL ? 'Atendimento concluído com sucesso' : `Etapa ${etapa + 1} de ${TITULOS.length} · Roteiro Validado`}
              </p>
            </div>
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[12px] font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              IA Online
            </span>
          </div>

          <Stepper etapa={etapa} titulos={TITULOS} direcao={direcao}>
            {/* ============================================================== BLOCO 1: Identificação do interessado */}
            {etapa === 0 && (
              <div>
                <div className="mb-4 rounded-xl bg-white/[0.05] p-4 text-[14px] leading-relaxed text-[#C7CFDE]">
                  <strong className="text-white">Identificação do interessado:</strong> Registramos seus dados básicos para viabilizar o primeiro contato e a consulta jurídica segura.
                </div>

                <Campo id="fe-nome" rotulo="1. Qual é o seu nome completo?" erro={erros.nome}>
                  <input
                    id="fe-nome"
                    className={INPUT}
                    autoComplete="name"
                    placeholder="Seu nome completo"
                    value={dados.nome}
                    onChange={(e) => set('nome')(e.target.value)}
                    maxLength={120}
                  />
                </Campo>

                <Campo
                  id="fe-cpf"
                  rotulo="2. Por favor, informe seu CPF."
                  ajuda="Validamos seu CPF em conformidade com a LGPD para localizar o processo com precisão."
                  erro={erros.cpf}
                >
                  <input
                    id="fe-cpf"
                    className={`${INPUT} font-mono`}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={dados.cpf}
                    onChange={(e) => set('cpf')(mascaraCpf(e.target.value))}
                  />
                </Campo>

                <Campo
                  id="fe-celular"
                  rotulo="3. Qual é o seu telefone com DDD para contato?"
                  ajuda="Número com WhatsApp para envio da proposta e confirmação de disponibilidade."
                  erro={erros.celular}
                >
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

                <p className="m-0 mt-3 text-[12px] text-[#9AA6BC]">
                  🔒 Seus dados estão protegidos com criptografia de ponta a ponta conforme as diretrizes da LGPD.
                </p>
              </div>
            )}

            {/* ============================================================== BLOCO 2: Titularidade do precatório */}
            {etapa === 1 && (
              <div>
                <div className="mb-4 rounded-xl bg-white/[0.05] p-4 text-[14px] leading-relaxed text-[#C7CFDE]">
                  <strong className="text-white">Titularidade do precatório:</strong> Precisamos identificar quem é o titular do crédito para direcionar o atendimento correto.
                </div>

                <Campo
                  id="fe-titularidade"
                  rotulo="Pergunta 4: O precatório está em seu nome ou pertence a outra pessoa?"
                  erro={erros.titularidade}
                >
                  <Opcoes
                    id="fe-titularidade"
                    opcoes={OPCOES_TITULARIDADE}
                    valor={dados.titularidade}
                    onChange={set('titularidade')}
                    colunas="grid-cols-1 sm:grid-cols-2"
                  />
                </Campo>

                {dados.titularidade === 'É de outra pessoa.' && (
                  <div className="mt-5 space-y-4 rounded-2xl border border-white/15 bg-white/[0.04] p-5 animate-fadeUp">
                    <p className="m-0 text-[14px] font-bold text-porcelain">
                      👤 Dados do titular originário do crédito:
                    </p>

                    <Campo id="fe-titular-nome" rotulo="5. Qual é o nome completo do titular do precatório?" erro={erros.nomeTitular}>
                      <input
                        id="fe-titular-nome"
                        className={INPUT}
                        placeholder="Nome completo do titular"
                        value={dados.nomeTitular}
                        maxLength={120}
                        onChange={(e) => set('nomeTitular')(e.target.value)}
                      />
                    </Campo>

                    <Campo id="fe-titular-cpf" rotulo="6. Qual é o CPF do titular?" erro={erros.cpfTitular}>
                      <input
                        id="fe-titular-cpf"
                        className={`${INPUT} font-mono`}
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={dados.cpfTitular}
                        onChange={(e) => set('cpfTitular')(mascaraCpf(e.target.value))}
                      />
                    </Campo>

                    <Campo
                      id="fe-vinculo"
                      rotulo="7. Qual é o seu vínculo com o titular?"
                      ajuda="Selecione uma opção ou digite seu vínculo (familiar, representante legal, advogado, broker...)"
                      erro={erros.vinculoTitular}
                    >
                      <div className="mb-2 flex flex-wrap gap-2">
                        {VINCULOS_SUGERIDOS.map((vinc) => (
                          <button
                            key={vinc}
                            type="button"
                            onClick={() => set('vinculoTitular')(vinc)}
                            className={`rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-all ${
                              dados.vinculoTitular === vinc
                                ? 'bg-porcelain text-navy'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                          >
                            {vinc}
                          </button>
                        ))}
                      </div>
                      <input
                        id="fe-vinculo"
                        className={INPUT}
                        placeholder="Ex.: familiar, representante legal, advogado ou outro"
                        value={dados.vinculoTitular}
                        maxLength={120}
                        onChange={(e) => set('vinculoTitular')(e.target.value)}
                      />
                    </Campo>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== BLOCO 3: Dados do precatório */}
            {etapa === 2 && (
              <div>
                <div className="mb-4 rounded-xl bg-white/[0.05] p-4 text-[14px] leading-relaxed text-[#C7CFDE]">
                  <strong className="text-white">Dados do precatório:</strong> Entendemos a origem e a situação jurídica do seu crédito para calcular o melhor valor à vista.
                </div>

                <Campo id="fe-esfera" rotulo="Pergunta 8: O seu precatório é de qual esfera?" erro={erros.esfera}>
                  <Opcoes
                    id="fe-esfera"
                    opcoes={ESFERAS}
                    valor={dados.esfera}
                    onChange={set('esfera')}
                    colunas="grid-cols-2 sm:grid-cols-4"
                  />
                </Campo>

                {/* Pergunta 9 Condicional */}
                {dados.esfera === 'Estadual' && (
                  <Campo id="fe-uf" rotulo="Pergunta 9: De qual estado (UF) é o precatório?" erro={erros.uf}>
                    <select
                      id="fe-uf"
                      className={`${INPUT} [color-scheme:dark]`}
                      value={dados.uf}
                      onChange={(e) => set('uf')(e.target.value)}
                    >
                      <option value="">Selecione o Estado</option>
                      {UFS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </Campo>
                )}

                {dados.esfera === 'Municipal' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <Campo id="fe-uf" rotulo="Estado (UF)" erro={erros.uf}>
                        <select
                          id="fe-uf"
                          className={`${INPUT} [color-scheme:dark]`}
                          value={dados.uf}
                          onChange={(e) => set('uf')(e.target.value)}
                        >
                          <option value="">UF</option>
                          {UFS.map((uf) => (
                            <option key={uf} value={uf}>
                              {uf}
                            </option>
                          ))}
                        </select>
                      </Campo>
                    </div>
                    <div className="sm:col-span-2">
                      <Campo
                        id="fe-municipio"
                        rotulo="Pergunta 9: De qual município é o precatório?"
                        ajuda="Prefeitura ou autarquia municipal devedora."
                        erro={erros.municipio}
                      >
                        <input
                          id="fe-municipio"
                          className={INPUT}
                          placeholder="Ex.: Rio de Janeiro, São Paulo, Niterói..."
                          value={dados.municipio}
                          maxLength={80}
                          onChange={(e) => set('municipio')(e.target.value)}
                        />
                      </Campo>
                    </div>
                  </div>
                )}

                {(dados.esfera === 'Federal' || dados.esfera === 'Não sei informar') && (
                  <Campo id="fe-uf-opcional" rotulo="Estado onde corre o processo (opcional)" ajuda="Se souber a UF ou tribunal onde corre a ação.">
                    <select
                      id="fe-uf-opcional"
                      className={`${INPUT} [color-scheme:dark]`}
                      value={dados.uf}
                      onChange={(e) => set('uf')(e.target.value)}
                    >
                      <option value="">Selecione a UF (opcional)</option>
                      {UFS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </Campo>
                )}

                {/* Pergunta 10: Situação da Expedição */}
                <Campo
                  id="fe-expedicao-situacao"
                  rotulo="Pergunta 10: O precatório já foi expedido ou o processo ainda está em andamento?"
                  ajuda="Precatórios já expedidos recebem prioridade máxima 🔥 em nossa mesa de negociação."
                  erro={erros.situacaoExpedicao}
                >
                  <Opcoes
                    id="fe-expedicao-situacao"
                    opcoes={OPCOES_EXPEDICAO}
                    valor={dados.situacaoExpedicao}
                    onChange={set('situacaoExpedicao')}
                    colunas="grid-cols-1"
                  />
                </Campo>

                {/* Campos opcionais de apoio */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo id="fe-processo" rotulo="Nº do processo (opcional)">
                    <input
                      id="fe-processo"
                      className={`${INPUT} font-mono`}
                      placeholder="0000000-00.0000.0.00.0000"
                      value={dados.processo}
                      maxLength={40}
                      onChange={(e) => set('processo')(e.target.value)}
                    />
                  </Campo>
                  <Campo id="fe-valor" rotulo="Valor aproximado (opcional)">
                    <input
                      id="fe-valor"
                      className={`${INPUT} font-mono`}
                      placeholder="R$ 0,00"
                      value={dados.valor}
                      maxLength={30}
                      onChange={(e) => set('valor')(e.target.value)}
                    />
                  </Campo>
                </div>
              </div>
            )}

            {/* ============================================================== BLOCO 4: Melhor horário para contato */}
            {etapa === 3 && (
              <div>
                <div className="mb-4 rounded-xl bg-white/[0.05] p-4 text-[14px] leading-relaxed text-[#C7CFDE]">
                  <strong className="text-white">Melhor horário para contato:</strong> Facilitamos o contato de nossa equipe comercial para conversarmos melhor no momento mais conveniente para você.
                </div>

                <Campo
                  id="fe-horario-contato"
                  rotulo="Pergunta 11: Qual é o melhor horário para nossa equipe entrar em contato com você e conversar melhor sobre o seu precatório?"
                  erro={erros.melhorHorarioContato}
                >
                  <Opcoes
                    id="fe-horario-contato"
                    opcoes={HORARIOS_CONTATO}
                    valor={dados.melhorHorarioContato}
                    onChange={set('melhorHorarioContato')}
                    colunas="grid-cols-1 sm:grid-cols-2"
                  />
                </Campo>

                <Campo
                  id="fe-dia-contato"
                  rotulo="Melhor dia para contato (opcional)"
                  ajuda="Informe se prefere ser contatado hoje, em dias úteis ou em um dia específico da semana."
                >
                  <div className="mb-2 flex flex-wrap gap-2">
                    {['Qualquer dia útil', 'Hoje mesmo', 'Segunda a sexta'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => set('melhorDiaContato')(d)}
                        className={`rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-all ${
                          dados.melhorDiaContato === d
                            ? 'bg-porcelain text-navy'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <input
                    id="fe-dia-contato"
                    className={INPUT}
                    placeholder="Ex.: Segunda-feira à tarde, hoje mesmo, dias úteis..."
                    value={dados.melhorDiaContato}
                    maxLength={60}
                    onChange={(e) => set('melhorDiaContato')(e.target.value)}
                  />
                </Campo>
              </div>
            )}

            {/* ============================================================== BLOCO 5: Encerramento e encaminhamento */}
            {etapa === ETAPA_FINAL && (
              <div className="animate-fadeUp text-center py-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-porcelain text-3xl font-bold text-navy shadow-lg" aria-hidden="true">
                  ✓
                </div>

                <h3 className="m-0 mb-3 text-2xl font-extrabold text-white">
                  Obrigado pelas informações!
                </h3>

                <p className="m-0 mx-auto mb-4 max-w-[540px] text-[16px] leading-[1.6] text-[#E2E8F0]">
                  Registramos os dados para que nossa equipe possa entender melhor o seu caso e dar continuidade ao atendimento.
                </p>

                <div className="mx-auto mb-6 max-w-[500px] rounded-2xl border border-white/20 bg-white/[0.06] p-4 text-center">
                  <p className="m-0 text-[14px] text-porcelain font-semibold">
                    Em breve, nossa equipe entrará em contato conforme a disponibilidade informada:
                  </p>
                  <p className="m-0 mt-1 font-bold text-white text-[15px]">
                    ⏰ Horário: {dados.melhorHorarioContato || 'Horário Comercial'} {dados.melhorDiaContato ? `(${dados.melhorDiaContato})` : ''}
                  </p>
                  <p className="m-0 mt-2 text-[12px] text-[#9AA6BC]">
                    Protocolo de Atendimento: <span className="font-mono text-porcelain font-bold">{protocolo}</span>
                  </p>
                </div>

                <p className="m-0 mb-6 text-[15px] font-bold text-porcelain">
                  A Premium Office agradece o seu contato!
                </p>

                {/* Anexo de ofício opcional para adiantar o cálculo */}
                <div className="mx-auto mb-6 max-w-[500px] text-left">
                  <div className="rounded-2xl border border-dashed border-white/25 bg-white/[0.04] p-4">
                    <p className="m-0 mb-2 text-[13px] font-semibold text-white">
                      Deseja adiantar sua análise? Envie foto ou PDF do seu ofício requisitório (opcional):
                    </p>
                    <input
                      ref={arquivoRef}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => anexar(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => arquivoRef.current?.click()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-2.5 text-[14px] font-bold text-white hover:bg-white/20 disabled:opacity-60 cursor-pointer"
                    >
                      {enviando ? 'Lendo ofício...' : '📎 Anexar ofício (PDF ou Foto)'}
                    </button>
                    {oficioRecebido && (
                      <p className="m-0 mt-2 text-[12px] font-semibold text-emerald-300">
                        ✓ Ofício anexado com sucesso{oficioRecebido.valor ? ` (R$ ${formatBRL(oficioRecebido.valor)})` : ''}!
                      </p>
                    )}
                    {erroOficio && (
                      <p role="alert" className="m-0 mt-2 text-[12px] font-semibold text-[#FCA5A5]">
                        {erroOficio}
                      </p>
                    )}
                  </div>
                </div>

                <a
                  href={linkWa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    track('whatsapp_click', { origem: 'formulario_concluido', variante: 'formulario' });
                  }}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-transparent bg-[#F5F2EB] px-8 font-sans text-base font-extrabold text-navy-accent no-underline shadow-lg transition-colors duration-200 hover:border-transparent hover:bg-navy hover:text-porcelain"
                >
                  Conversar agora no WhatsApp →
                </a>
              </div>
            )}
          </Stepper>

          {erros.geral && (
            <p role="alert" className="m-0 mt-4 rounded-xl bg-red-500/10 p-3 text-center text-[13px] font-semibold text-[#FCA5A5] border border-red-500/20">
              {erros.geral}
            </p>
          )}

          {/* Rodapé com Navegação */}
          {etapa < ETAPA_FINAL && (
            <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/15 pt-5">
              <a
                href={linkWa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('whatsapp_click', { origem: 'formulario_etapa', variante: 'formulario', etapa: etapa + 1 })}
                className="text-[14px] font-semibold text-white no-underline hover:underline"
              >
                Falar com consultor
              </a>
              <div className="flex gap-2">
                {etapa > 0 && (
                  <button
                    type="button"
                    onClick={voltar}
                    disabled={enviando}
                    className="min-h-[48px] cursor-pointer rounded-full border border-white/30 bg-transparent px-5 font-sans text-[15px] font-semibold text-white transition-colors duration-200 hover:border-white hover:bg-white hover:text-navy disabled:opacity-60"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="button"
                  onClick={continuar}
                  disabled={enviando}
                  className="min-h-[48px] cursor-pointer rounded-full border border-transparent bg-[#F5F2EB] px-7 font-sans text-[15px] font-extrabold text-navy-accent transition-colors duration-200 hover:border-transparent hover:bg-navy hover:text-porcelain disabled:opacity-60 shadow-md"
                >
                  {enviando
                    ? 'Validando...'
                    : etapa === 3
                    ? 'Concluir triagem →'
                    : 'Continuar →'}
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="relative m-0 mt-4 text-center text-[13px] text-[#6B7280]">
          Prefere atendimento imediato por telefone ou mensagem? WhatsApp {WA_DISPLAY}
        </p>
      </section>
    </>
  );
}
