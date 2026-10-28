'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRightIcon, CircleDollarSignIcon, ClockIcon, LockIcon, MessageCircleIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import { getAttribution } from '@/lib/attribution';
import { OPEN_CHAT_EVENT } from '@/lib/chat-events';
import { enviarLead, enviarOficio, getClientSessionId, trackAIChatLead, type OficioExtraido } from '@/lib/lead-client';
import { formatBRL } from '@/lib/format';
import { apiPath, asset } from '@/lib/site';
import { track } from '@/lib/track';
import { protocoloFromSession, whatsappLink, WA_DISPLAY } from '@/lib/whatsapp';

// Variante A do teste A/B (home, /): modal de apresentação da secretária digital e
// chat com o agente (/api/agente), que conduz a conversa e registra o lead no Bitrix.

// Foto do avatar com zoom no rosto em public/karen-avatar.jpg. Sem o arquivo, o avatar mostra as iniciais.
const FOTO = asset('/karen-avatar.jpg');
const SAUDACAO = 'Olá! Sou a Karen, secretária digital da Premium Office. Para iniciarmos sua análise gratuita com segurança jurídica, por favor me informe seu nome completo, CPF e WhatsApp com DDD.';
// Prova social do rodapé do modal. O registro na OAB entra aqui quando o número oficial for informado.
const PROVA_SOCIAL = '+1.200 precatórios analisados';

type Msg = { role: 'user' | 'assistant'; content: string; local?: boolean };

function Foto({ className, alt = 'Karen - Secretária Digital' }: { className?: string; alt?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) {
    return (
      <div aria-hidden="true" className={`flex items-center justify-center bg-porcelain text-[13px] font-extrabold text-navy ${className ?? ''}`}>
        K
      </div>
    );
  }
  return (
    <div className={`relative inline-flex items-center justify-center overflow-hidden rounded-full flex-shrink-0 ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={FOTO}
        alt={alt}
        onError={() => setFalhou(true)}
        className="h-full w-full object-cover object-center"
      />
    </div>
  );
}

// Prévia ilustrativa de como a conversa funciona (lado direito do modal); não é uma conversa real.
// Cada fala da Karen é precedida do indicador "digitando"; o roteiro recomeça ao terminar.
const PREVIA: Msg[] = [
  { role: 'assistant', content: 'Olá! Sou a Karen. Para iniciarmos sua análise gratuita, por favor me informe seu nome completo, CPF e WhatsApp com DDD.' },
  { role: 'user', content: 'Carlos Silva, CPF 123.456.789-00, WhatsApp (11) 98765-4321' },
  { role: 'assistant', content: 'Obrigada, Carlos! Seu precatório é federal, estadual ou municipal? E você é o próprio titular ou advogado/broker?' },
  { role: 'user', content: 'Estadual de São Paulo, sou o titular e o precatório já foi expedido' },
  { role: 'assistant', content: 'Excelente! Caso prioritário 🔥 Já registrei seus dados e enviei uma mensagem no seu WhatsApp para o especialista dar sequência!' },
];

function PreviaConversa() {
  const [visiveis, setVisiveis] = useState(0);
  const [digitando, setDigitando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisiveis(PREVIA.length);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let passo = 0;
    const agendar = (fn: () => void, ms: number) => {
      timer = setTimeout(fn, ms);
    };
    const proximo = () => {
      if (passo >= PREVIA.length) {
        agendar(() => {
          passo = 0;
          setVisiveis(0);
          agendar(proximo, 700);
        }, 4200);
        return;
      }
      const msg = PREVIA[passo];
      if (msg.role === 'assistant') {
        // Tempo de digitação proporcional ao tamanho da fala.
        setDigitando(true);
        agendar(() => {
          setDigitando(false);
          passo += 1;
          setVisiveis(passo);
          agendar(proximo, 1300);
        }, 700 + msg.content.length * 22);
      } else {
        passo += 1;
        setVisiveis(passo);
        agendar(proximo, 600);
      }
    };
    agendar(proximo, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Rola só a lista da prévia (scrollIntoView rolaria também a página atrás do modal).
    const lista = listaRef.current;
    lista?.scrollTo({ top: lista.scrollHeight, behavior: 'smooth' });
  }, [visiveis, digitando]);

  return (
    <div aria-hidden="true" className="flex h-[230px] flex-col bg-black/25 overflow-hidden rounded-t-3xl sm:rounded-t-none sm:rounded-r-3xl sm:h-full sm:max-h-[460px]">
      <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.04] py-3 pl-4 pr-14 sm:py-4 sm:pl-5 sm:pr-16 rounded-t-3xl sm:rounded-t-none sm:rounded-tr-3xl">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-white sm:text-[17px]">Karen</div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#C7CFDE] sm:text-[12px]">
            Secretária digital
          </div>
        </div>
        <div className="relative flex-shrink-0">
          <Foto className="h-12 w-12 rounded-full border-2 avatar-online sm:h-14 sm:w-14" />
        </div>
      </div>
      <div ref={listaRef} className="flex flex-1 flex-col gap-2.5 overflow-hidden px-4 py-3 sm:gap-3 sm:px-5 sm:py-4">
        {PREVIA.slice(0, visiveis).map((m, i) => (
          <div
            key={i}
            className={`max-w-[92%] flex-shrink-0 animate-aiIn rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug sm:max-w-[90%] sm:text-[14px] ${
              m.role === 'user'
                ? 'self-end rounded-br-sm bg-gradient-to-r from-porcelain-deep to-porcelain font-semibold text-[#0B1B33] shadow-[0_4px_16px_rgba(245,242,235,0.25)]'
                : 'self-start rounded-bl-sm border border-white/15 bg-white/[0.09] text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md flex items-start gap-2.5'
            }`}
          >
            {m.role === 'assistant' && (
              <Foto className="h-6 w-6 rounded-full border-2 avatar-online object-cover flex-shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{m.content}</span>
          </div>
        ))}
        {digitando && (
          <div className="flex flex-shrink-0 animate-aiIn items-center gap-2.5 self-start rounded-2xl rounded-bl-sm border border-white/15 bg-white/[0.09] px-3.5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md">
            <Foto className="h-5 w-5 rounded-full border-2 avatar-online object-cover flex-shrink-0" />
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-blink rounded-full bg-porcelain" style={{ animationDelay: `${d * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalApresentacao({ onComecar }: { onComecar: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onComecar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onComecar]);

  const selos = [
    { Icone: ClockIcon, texto: '2 minutos' },
    { Icone: CircleDollarSignIcon, texto: 'Sem custo' },
    { Icone: LockIcon, texto: 'LGPD' },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(3,8,18,0.78)] p-0 backdrop-blur-md sm:items-center sm:p-6 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sd-titulo"
        className="relative flex max-h-[92dvh] sm:max-h-none w-full max-w-[680px] animate-fadeUp flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl shadow-[0_32px_100px_rgba(0,0,0,0.65)]"
      >
        {/* Fundo de vidro com blur isolado em camada própria para garantir bordas arredondadas sem artefatos */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-t-3xl sm:rounded-3xl bg-[rgba(10,23,45,0.88)] backdrop-blur-2xl" />

        {/* Orbs de refração e luz para o efeito de vidro */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 -z-10 h-60 w-60 rounded-full bg-porcelain/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -bottom-16 -z-10 h-64 w-64 rounded-full bg-sky/20 blur-3xl" />

        <button
          type="button"
          onClick={onComecar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 p-0 text-white transition-colors duration-200 hover:border-transparent hover:bg-porcelain hover:text-navy sm:right-4 sm:top-4"
        >
          <XIcon size={18} aria-hidden="true" />
        </button>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-12 rounded-t-3xl sm:rounded-3xl">
          {/* Prévia da conversa com a IA: no mobile fica no topo compacto, no desktop na coluna da direita */}
          <div className="order-1 sm:order-2 sm:col-span-5 border-b border-white/10 sm:border-b-0 sm:border-l rounded-t-3xl sm:rounded-t-none sm:rounded-r-3xl">
            <PreviaConversa />
          </div>
          <div className="order-2 p-5 sm:order-1 sm:col-span-7 sm:p-7 bg-white/[0.03] flex flex-col justify-between rounded-b-3xl sm:rounded-b-none sm:rounded-l-3xl">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-[12px] font-semibold text-emerald-300 shadow-sm sm:mb-4">
                <Foto className="h-5 w-5 rounded-full border-2 avatar-online object-cover" />
                Karen · Online agora
              </div>
              <h2 id="sd-titulo" className="m-0 mb-2.5 text-[clamp(21px,4.5vw,27px)] font-bold leading-tight tracking-tight text-white sm:mb-3 sm:text-[clamp(23px,3vw,28px)]">
                Descubra quanto vale o seu precatório
              </h2>
              <p className="m-0 mb-4 text-[14px] leading-[1.55] text-[#C7CFDE] sm:mb-5 sm:text-[15px]">
                Responda 4 perguntas rápidas. Um especialista envia sua análise gratuita pelo WhatsApp.
              </p>
              <ul className="m-0 mb-6 flex list-none flex-wrap gap-2 p-0 text-[13px] text-white">
                {selos.map(({ Icone, texto }) => (
                  <li key={texto} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1 text-[12px] font-medium text-[#E0E7F5] shadow-sm sm:text-[13px]">
                    <Icone size={14} className="text-porcelain" aria-hidden="true" />
                    {texto}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={onComecar}
                  className="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent bg-gradient-to-r from-porcelain-deep via-porcelain to-white px-6 font-sans text-[14px] font-extrabold text-[#0B1B33] shadow-[0_8px_25px_rgba(245,242,235,0.35)] transition-all duration-200 hover:scale-[1.02] hover:border-transparent hover:bg-none hover:bg-navy hover:text-porcelain hover:shadow-[0_12px_35px_rgba(245,242,235,0.25)] active:scale-[0.98] outline-none focus:outline-none focus:ring-0 focus-visible:outline-none sm:min-h-[48px] sm:text-[15px]"
                >
                  Começar análise
                  <ArrowRightIcon size={16} aria-hidden="true" />
                </button>
                <a
                  href={whatsappLink({ motivo: 'Vim pela Karen, a secretária digital do site.' })}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('whatsapp_click', { origem: 'modal_secretaria', variante: 'chat' })}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 font-mono text-[13px] font-semibold text-white no-underline shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-white hover:bg-white hover:text-navy sm:min-h-[48px] sm:text-[14px]"
                >
                  <MessageCircleIcon size={16} className="text-emerald-400" aria-hidden="true" />
                  {WA_DISPLAY}
                </a>
              </div>
              <p className="m-0 mt-4 flex items-center gap-1.5 text-[12px] text-[#8E9EB5] sm:mt-5 sm:text-[13px]">
                <ShieldCheckIcon size={14} className="text-porcelain" aria-hidden="true" />
                {PROVA_SOCIAL}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function resumoOficio(x: OficioExtraido): string {
  const partes = [
    x.tipo === 'rpv' ? 'RPV' : x.tipo === 'precatorio' ? 'precatório' : null,
    x.esfera !== 'desconhecida' ? x.esfera : null,
    x.tribunal,
    typeof x.valor === 'number' ? `valor bruto de ${formatBRL(x.valor)}` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(', ') : 'documento recebido';
}

export default function SecretariaDigital() {
  const [modalAberto, setModalAberto] = useState(true);
  // A sessão vem do sessionStorage: só existe no navegador, então é lida após a hidratação.
  const [protocolo, setProtocolo] = useState('');
  useEffect(() => setProtocolo(protocoloFromSession(getClientSessionId())), []);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: SAUDACAO, local: true }]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [leadRegistrado, setLeadRegistrado] = useState(false);
  const [oficioEnviado, setOficioEnviado] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const secaoRef = useRef<HTMLElement>(null);

  const focarChat = useCallback(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    secaoRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
  }, []);

  const comecar = useCallback(() => {
    setModalAberto(false);
    track('chat_start', { origem: 'modal_secretaria', variante: 'chat' });
    focarChat();
  }, [focarChat]);

  useEffect(() => {
    const onOpen = () => (modalAberto ? comecar() : focarChat());
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, [modalAberto, comecar, focarChat]);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, enviando]);

  const conversaParaTriagem = (lista: Msg[]) => lista.map((m) => ({ role: m.role, text: m.content }));

  async function perguntar(historico: Msg[]) {
    setEnviando(true);
    try {
      const res = await fetch(apiPath('/api/agente'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSessionId: getClientSessionId(),
          attribution: getAttribution(),
          leadRegistrado,
          messages: historico.filter((m) => !m.local || m.role === 'assistant').map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json().catch(() => null);
      const resposta = res.ok && typeof data?.text === 'string' ? data.text : data?.error || `Não consegui responder agora. Fale no WhatsApp ${WA_DISPLAY}.`;
      if (data?.leadRegistrado) setLeadRegistrado(true);
      trackAIChatLead(data, 'chat');
      setMsgs((atual) => [...atual, { role: 'assistant', content: resposta }]);
    } catch {
      setMsgs((atual) => [...atual, { role: 'assistant', content: `Sem conexão. Tente de novo ou fale no WhatsApp ${WA_DISPLAY}.`, local: true }]);
    } finally {
      setEnviando(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    const historico: Msg[] = [...msgs, { role: 'user', content: conteudo }];
    setMsgs(historico);
    setTexto('');
    track('agente_mensagem', { variante: 'chat', n: historico.filter((m) => m.role === 'user').length });
    void perguntar(historico);
  }

  async function anexar(file: File | undefined) {
    if (!file) return;
    setEnviando(true);
    setMsgs((atual) => [...atual, { role: 'user', content: `Enviei o arquivo ${file.name}.`, local: true }]);
    const r = await enviarOficio(file);
    if (!r.ok) {
      setMsgs((atual) => [...atual, { role: 'assistant', content: r.message, local: true }]);
      setEnviando(false);
      return;
    }
    setOficioEnviado(true);
    const confirmacao = `Recebi seu ofício (${resumoOficio(r.extracted)}). Ele já foi encaminhado ao especialista, que vai conferir os dados e retornar pelo WhatsApp com a análise.`;
    const historico: Msg[] = [...msgs, { role: 'user', content: 'Enviei o ofício requisitório.' }, { role: 'assistant', content: confirmacao }];
    setMsgs((atual) => [...atual, { role: 'assistant', content: confirmacao }]);
    setEnviando(false);
    // Resultado final: dispara a triagem por IA que completa o card (conversa x leitura do ofício).
    void enviarLead({ variante: 'chat', stage: 'oficio_agente', resultado: 'documentos_enviados', conversa: conversaParaTriagem(historico), oficio: r.extracted });
  }

  function cliqueWhatsapp() {
    track('whatsapp_click', { origem: 'chat_secretaria', variante: 'chat' });
    if (leadRegistrado) void enviarLead({ variante: 'chat', stage: 'whatsapp_agente', resultado: 'falou_consultor', conversa: conversaParaTriagem(msgs) });
  }

  return (
    <>
      {modalAberto && <ModalApresentacao onComecar={comecar} />}
      <section
        id="ia"
        ref={secaoRef}
        data-screen-label="Secretária digital"
        className="relative scroll-mt-4 overflow-hidden px-4 py-10 sm:px-8 sm:py-16 lg:flex lg:flex-col lg:justify-center lg:px-10"
      >

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-[760px]"
        >
          {/* Card principal em Glassmorphism */}
          <div className="relative isolate overflow-hidden rounded-3xl shadow-[0_16px_40px_rgba(11,27,51,0.16)]">
            {/* Fundo de vidro com blur isolado */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-[#12264A] to-[#0A172D]" />

            {/* Cabeçalho translúcido com efeito de vidro */}
            <header className="flex items-center gap-3.5 border-b border-white/12 bg-white/[0.04] px-5 py-4 rounded-t-3xl">
              <div className="relative flex-shrink-0">
                <Foto className="h-12 w-12 rounded-full border-2 avatar-online object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-bold text-white">Karen</span>
                  <span className="rounded-full border border-porcelain/40 bg-porcelain/20 px-2.5 py-0.5 text-[10px] font-semibold text-porcelain shadow-sm">
                    Secretária digital
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-[#C7CFDE]">
                  Online agora · Premium Office Precatórios
                </div>
              </div>
              <motion.a
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                href={whatsappLink({ protocolo })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={cliqueWhatsapp}
                className="hidden items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[13px] font-semibold text-white no-underline shadow-sm transition-all hover:border-white hover:bg-white hover:text-navy sm:inline-flex"
              >
                Falar com atendente
              </motion.a>
            </header>

            {/* Área de mensagens com Glassmorphism e Framer Motion */}
            <div
              ref={listaRef}
              className="h-[min(62vh,540px)] space-y-3.5 overflow-y-auto bg-[#071226]/60 px-4 py-5 sm:px-6"
              aria-live="polite"
            >
              <AnimatePresence initial={false}>
                {msgs.map((m, i) => (
                  <motion.div
                    key={i}
                    // Usuário: o texto "sai" do campo de digitação (largo, embaixo), sobe e encolhe até o balão.
                    // Karen: o balão nasce pequeno junto ao indicador de digitação, sobe e estica até o tamanho final.
                    initial={
                      m.role === 'user'
                        ? { opacity: 0.4, y: 96, scaleX: 1.35, scaleY: 0.7 }
                        : { opacity: 0, y: 28, scaleX: 0.4, scaleY: 0.55 }
                    }
                    animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.9, opacity: { duration: 0.2 } }}
                    style={{ transformOrigin: m.role === 'user' ? 'right bottom' : 'left bottom' }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start items-start gap-2.5'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="relative mt-0.5 flex-shrink-0">
                        <Foto className="h-8 w-8 rounded-full border-2 avatar-online object-cover shadow-sm" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[14px] leading-[1.55] sm:text-[15px] ${
                        m.role === 'user'
                          ? 'rounded-br-sm bg-gradient-to-r from-porcelain-deep to-porcelain font-semibold text-[#0B1B33] shadow-[0_4px_20px_rgba(245,242,235,0.3)]'
                          : 'rounded-bl-sm border border-white/15 bg-white/[0.09] text-white shadow-[0_4px_18px_rgba(0,0,0,0.18)] backdrop-blur-md'
                      }`}
                    >
                      {m.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Indicador fluido de digitação */}
              <AnimatePresence>
                {enviando && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="flex justify-start items-start gap-2.5"
                    aria-label="Digitando"
                  >
                    <div className="relative mt-0.5 flex-shrink-0">
                      <Foto className="h-8 w-8 rounded-full border-2 avatar-online object-cover shadow-sm" />
                    </div>
                    <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-sm border border-white/15 bg-white/[0.09] px-4 py-3 shadow-[0_4px_18px_rgba(0,0,0,0.18)] backdrop-blur-md">
                      <span className="text-[12px] font-medium text-[#C7CFDE]">Karen está digitando</span>
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map((d) => (
                          <motion.span
                            key={d}
                            animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.75,
                              delay: d * 0.16,
                              ease: 'easeInOut',
                            }}
                            className="h-1.5 w-1.5 rounded-full bg-porcelain"
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Formulário de envio em vidro */}
            <form onSubmit={enviar} className="flex items-end gap-2 border-t border-white/10 bg-white/[0.03] p-3 sm:p-4 rounded-b-3xl">
              {leadRegistrado && !oficioEnviado && (
                <>
                  <input
                    ref={arquivoRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => anexar(e.target.files?.[0])}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => arquivoRef.current?.click()}
                    disabled={enviando}
                    title="Anexar ofício (PDF ou foto)"
                    aria-label="Anexar ofício"
                    className="flex h-12 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-2xl border-0 bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40 outline-none focus:outline-none focus:ring-0"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </motion.button>
                </>
              )}
              <textarea
                ref={inputRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    enviar(e);
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Escreva sua resposta..."
                aria-label="Sua mensagem"
                className="min-h-[48px] flex-1 resize-none rounded-2xl border-0 bg-white/[0.08] px-4 py-3 font-sans text-base text-white placeholder:text-[#9AA6BC] outline-none transition-all focus:bg-white/[0.12] focus:outline-none focus:ring-0 shadow-inner"
              />
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={enviando || !texto.trim()}
                className="h-12 flex-shrink-0 cursor-pointer rounded-2xl border border-transparent bg-gradient-to-r from-porcelain-deep to-porcelain px-5 text-[15px] font-extrabold text-[#0B1B33] shadow-[0_4px_20px_rgba(245,242,235,0.35)] transition-all hover:border-transparent hover:bg-none hover:bg-navy hover:text-porcelain disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none outline-none focus:outline-none focus:ring-0"
              >
                Enviar
              </motion.button>
            </form>
          </div>

          <p className="m-0 mt-3.5 flex items-center justify-center gap-1.5 text-center text-[12px] text-[#5B6472] sm:text-[13px]">
            <LockIcon size={13} className="text-navy" aria-hidden="true" />
            Conexão segura · telefone e CPF não são compartilhados com terceiros (LGPD)
          </p>
        </motion.div>
      </section>
    </>
  );
}
