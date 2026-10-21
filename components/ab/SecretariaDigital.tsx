'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRightIcon, CircleDollarSignIcon, ClockIcon, LockIcon, MessageCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { getAttribution } from '@/lib/attribution';
import { OPEN_CHAT_EVENT } from '@/lib/chat-events';
import { enviarLead, enviarOficio, getClientSessionId, trackAIChatLead, type OficioExtraido } from '@/lib/lead-client';
import { formatBRL } from '@/lib/format';
import { apiPath, asset } from '@/lib/site';
import { track } from '@/lib/track';
import { protocoloFromSession, whatsappLink, WA_DISPLAY } from '@/lib/whatsapp';

// Variante A do teste A/B (/chat): modal de apresentação da secretária digital e
// chat com o agente (/api/agente), que conduz a conversa e registra o lead no Bitrix.

// Foto do avatar enviada pela equipe em public/. Sem o arquivo, o avatar mostra as iniciais.
const FOTO = asset('/secretaria-digital.jpg');
const SAUDACAO = 'Olá! Sou a secretária digital da Premium Office. Seu precatório é federal, estadual ou municipal?';
// Prova social do rodapé do modal. O registro na OAB entra aqui quando o número oficial for informado.
const PROVA_SOCIAL = '+1.200 precatórios analisados';

type Msg = { role: 'user' | 'assistant'; content: string; local?: boolean };

function Foto({ className }: { className?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) {
    return (
      <div aria-hidden="true" className={`flex items-center justify-center bg-[#F5DD90] text-[13px] font-extrabold text-navy ${className ?? ''}`}>
        SD
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={FOTO} alt="" onError={() => setFalhou(true)} className={`object-cover ${className ?? ''}`} />
  );
}

// Prévia ilustrativa de como a conversa funciona (lado direito do modal); não é uma conversa real.
const PREVIA: Msg[] = [
  { role: 'assistant', content: 'Olá! Seu precatório é federal, estadual ou municipal?' },
  { role: 'user', content: 'Estadual' },
  { role: 'assistant', content: 'Perfeito. Qual o valor aproximado?' },
];

function PreviaConversa() {
  const [visiveis, setVisiveis] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisiveis(PREVIA.length);
      return;
    }
    const timers = PREVIA.map((_, i) => setTimeout(() => setVisiveis(i + 1), 500 + i * 1100));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div aria-hidden="true" className="flex h-full flex-col bg-navy-deep px-5 py-6 sm:px-6">
      <div className="mb-5 flex items-center gap-2.5">
        <Foto className="h-9 w-9 flex-shrink-0 rounded-full" />
        <span className="text-[15px] font-bold text-white">Secretária digital</span>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {PREVIA.slice(0, visiveis).map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] animate-aiIn rounded-xl px-3.5 py-2.5 text-[14px] font-semibold leading-snug ${
              m.role === 'user' ? 'self-end bg-[#E8C26A] text-navy' : 'self-start bg-navy-card text-white'
            }`}
          >
            {m.content}
          </div>
        ))}
        <span className="mt-1 text-[13px] text-sky">digitando...</span>
      </div>
    </div>
  );
}

function ModalApresentacao({ onComecar }: { onComecar: () => void }) {
  const botaoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    botaoRef.current?.focus();
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(5,11,22,0.72)] p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sd-titulo"
        className="w-full max-w-[640px] animate-fadeUp overflow-hidden rounded-t-3xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:rounded-3xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-12">
          <div className="p-6 sm:col-span-7 sm:p-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#EEF0F3] px-3 py-1 text-[13px] font-semibold text-ink">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Online agora
            </div>
            <h2 id="sd-titulo" className="m-0 mb-2.5 text-[clamp(22px,3vw,26px)] font-semibold leading-tight text-navy">
              Descubra quanto vale o seu precatório
            </h2>
            <p className="m-0 mb-4 text-[15px] leading-[1.5] text-[#4B5563]">
              Responda 4 perguntas rápidas. Um especialista envia sua análise gratuita pelo WhatsApp.
            </p>
            <ul className="m-0 mb-6 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-[14px] text-ink">
              {selos.map(({ Icone, texto }) => (
                <li key={texto} className="flex items-center gap-1.5">
                  <Icone size={15} className="text-[#DAA520]" aria-hidden="true" />
                  {texto}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <button
                ref={botaoRef}
                type="button"
                onClick={onComecar}
                className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-1.5 rounded-full border-0 bg-navy px-6 font-sans text-[15px] font-bold text-white shadow-[0_10px_26px_rgba(13,31,56,0.28)] transition-colors duration-250 hover:bg-navy-accent"
              >
                Começar análise
                <ArrowRightIcon size={16} aria-hidden="true" />
              </button>
              <a
                href={whatsappLink({ motivo: 'Vim pela secretária digital do site.' })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('whatsapp_click', { origem: 'modal_secretaria', variante: 'chat' })}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#D8DCE3] bg-white px-5 font-mono text-[14px] font-semibold text-navy no-underline transition-colors duration-250 hover:bg-[#F7F8FA]"
              >
                <MessageCircleIcon size={16} className="text-emerald-600" aria-hidden="true" />
                {WA_DISPLAY}
              </a>
            </div>
            <p className="m-0 mt-5 flex items-center gap-1.5 text-[13px] text-[#6B7280]">
              <ShieldCheckIcon size={14} aria-hidden="true" />
              {PROVA_SOCIAL}
            </p>
          </div>
          <div className="hidden sm:col-span-5 sm:block">
            <PreviaConversa />
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
      <section id="ia" ref={secaoRef} data-screen-label="Secretária digital" className="scroll-mt-4 bg-mist px-4 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-[760px]">
          <div className="overflow-hidden rounded-3xl border border-[#D8DCE3] bg-white shadow-[0_18px_50px_rgba(11,27,51,0.12)]">
            <header className="flex items-center gap-3 border-b border-[#E5E7EB] bg-navy px-5 py-4 text-white">
              <Foto className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-[#DAA520]" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">Secretária digital</div>
                <div className="flex items-center gap-1.5 text-[13px] text-[#C7CFDE]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  Online · Premium Office Precatórios
                </div>
              </div>
              <a
                href={whatsappLink({ protocolo })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={cliqueWhatsapp}
                className="hidden rounded-full border border-white/30 px-3.5 py-1.5 text-[13px] font-semibold text-white no-underline hover:bg-white/10 sm:inline-block"
              >
                Falar com atendente
              </a>
            </header>

            <div ref={listaRef} className="h-[min(60vh,520px)] space-y-3 overflow-y-auto bg-[#F7F8FA] px-4 py-5 sm:px-6" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] animate-aiIn whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-[1.55] ${
                      m.role === 'user' ? 'rounded-br-md bg-navy text-white' : 'rounded-bl-md border border-[#E5E7EB] bg-white text-ink'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {enviando && (
                <div className="flex justify-start" aria-label="Digitando">
                  <div className="flex gap-1 rounded-2xl rounded-bl-md border border-[#E5E7EB] bg-white px-4 py-3.5">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-2 w-2 animate-blink rounded-full bg-[#9AA6BC]" style={{ animationDelay: `${d * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={enviar} className="flex items-end gap-2 border-t border-[#E5E7EB] bg-white p-3 sm:p-4">
              {leadRegistrado && !oficioEnviado && (
                <>
                  <input ref={arquivoRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => anexar(e.target.files?.[0])} />
                  <button
                    type="button"
                    onClick={() => arquivoRef.current?.click()}
                    disabled={enviando}
                    title="Anexar ofício (PDF ou foto)"
                    aria-label="Anexar ofício"
                    className="flex h-12 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#D8DCE3] bg-white text-navy hover:bg-[#EEF0F3] disabled:opacity-50"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
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
                className="min-h-[48px] flex-1 resize-none rounded-2xl border border-[#D8DCE3] bg-[#F7F8FA] px-4 py-3 font-sans text-base text-ink outline-none focus:border-navy"
              />
              <button
                type="submit"
                disabled={enviando || !texto.trim()}
                className="h-12 flex-shrink-0 cursor-pointer rounded-full border-0 bg-navy px-5 text-[15px] font-bold text-white hover:bg-navy-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar
              </button>
            </form>
          </div>
          <p className="m-0 mt-3 text-center text-[13px] text-[#6B7280]">
            ■ Conexão segura · telefone e CPF não são compartilhados com terceiros (LGPD)
          </p>
        </div>
      </section>
    </>
  );
}
