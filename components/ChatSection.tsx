'use client';

import React, { CSSProperties } from 'react';
import { Button, Paper } from '@mantine/core';
import { formatBRL } from '@/lib/data';
import { captureAttribution, getAttribution } from '@/lib/attribution';
import { track } from '@/lib/track';
import { whatsappLink, protocoloFromSession } from '@/lib/whatsapp';
import { OPEN_CHAT_EVENT } from '@/lib/chat-events';

// ---------------------------------------------------------------------------
// Message model
// ---------------------------------------------------------------------------
type Stage =
  | 'intro'
  | 'lead-nome'
  | 'lead-celular'
  | 'lead-estado'
  | 'upload'
  | 'analyzing'
  | 'confirm'
  | 'upload-error'
  | 'no-oficio'
  | 'saving'
  | 'confirmed'
  | 'confirm-failed'
  | 'revision'
  | 'free-chat';

type Resultado = 'em_andamento' | 'lead_qualificado' | 'documentos_enviados' | 'falou_consultor' | 'revisao_solicitada';

type OficioFailReason = 'too_large' | 'unsupported_type' | 'not_oficio' | 'extract_failed' | 'rate_limited' | 'bad_request' | 'network';

interface LeadData {
  nome: string;
  celular: string; // formatado com máscara "(00) 00000-0000"
  estado: string; // UF
}

interface Extracted {
  tipo: 'precatorio' | 'rpv' | 'desconhecido';
  credor: string | null;
  cpf: string | null;
  processo: string | null;
  tribunal: string | null;
  enteDevedor: string | null;
  natureza: string | null;
  valor: number | null;
  dataBase: string | null;
}

const MAX_OFICIO_BYTES = 4 * 1024 * 1024;
const OFICIO_INPUT_ID = 'po-oficio-input';
// Fotos acima disso (ou em HEIC) são reduzidas no navegador antes do envio.
const IMAGE_COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
const IMAGE_MAX_SIDE = 2200;

const isHeic = (file: File) => /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {}
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

// Reduz fotos grandes (comuns em celulares de 12 a 50 MP) para JPEG de até ~2200 px no lado maior.
// PDFs passam intactos. Se o navegador não conseguir decodificar, devolve o arquivo original.
async function prepareOficioFile(file: File): Promise<File> {
  const isImage = /^image\//i.test(file.type) || isHeic(file);
  if (!isImage || typeof document === 'undefined') return file;
  if (!isHeic(file) && file.size <= IMAGE_COMPRESS_THRESHOLD) return file;
  try {
    const img = await decodeImage(file);
    try {
      if (!img.width || !img.height) return file;
      const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.fillStyle = '#fff'; // PNG com transparência vira fundo branco no JPEG
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img.source, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob || (!isHeic(file) && blob.size >= file.size)) return file;
      const base = file.name.replace(/\.[^.]+$/, '') || 'oficio';
      return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    } finally {
      img.close();
    }
  } catch {
    return file;
  }
}
const LEAD_ERROR_ID = 'po-lead-error';
const UF_SELECT_ID = 'po-uf-select';
const UF_TOOLTIP_ID = 'po-uf-tooltip';

const ESTADOS_BR_LIST = [
  { uf: 'AC', nome: 'Acre (AC)' },
  { uf: 'AL', nome: 'Alagoas (AL)' },
  { uf: 'AP', nome: 'Amapá (AP)' },
  { uf: 'AM', nome: 'Amazonas (AM)' },
  { uf: 'BA', nome: 'Bahia (BA)' },
  { uf: 'CE', nome: 'Ceará (CE)' },
  { uf: 'DF', nome: 'Distrito Federal (DF)' },
  { uf: 'ES', nome: 'Espírito Santo (ES)' },
  { uf: 'GO', nome: 'Goiás (GO)' },
  { uf: 'MA', nome: 'Maranhão (MA)' },
  { uf: 'MT', nome: 'Mato Grosso (MT)' },
  { uf: 'MS', nome: 'Mato Grosso do Sul (MS)' },
  { uf: 'MG', nome: 'Minas Gerais (MG)' },
  { uf: 'PA', nome: 'Pará (PA)' },
  { uf: 'PB', nome: 'Paraíba (PB)' },
  { uf: 'PR', nome: 'Paraná (PR)' },
  { uf: 'PE', nome: 'Pernambuco (PE)' },
  { uf: 'PI', nome: 'Piauí (PI)' },
  { uf: 'RJ', nome: 'Rio de Janeiro (RJ)' },
  { uf: 'RN', nome: 'Rio Grande do Norte (RN)' },
  { uf: 'RS', nome: 'Rio Grande do Sul (RS)' },
  { uf: 'RO', nome: 'Rondônia (RO)' },
  { uf: 'RR', nome: 'Roraima (RR)' },
  { uf: 'SC', nome: 'Santa Catarina (SC)' },
  { uf: 'SP', nome: 'São Paulo (SP)' },
  { uf: 'SE', nome: 'Sergipe (SE)' },
  { uf: 'TO', nome: 'Tocantins (TO)' },
];

function renderInlineTokens(text: string) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|___([^_]+)___)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-extrabold text-[#0B1B33]">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <em key={match.index} className="italic text-[#2B3346]">
          {match[3]}
        </em>
      );
    } else if (match[4]) {
      parts.push(
        <strong key={match.index} className="font-extrabold text-[#0B1B33]">
          {match[4]}
        </strong>
      );
    } else if (match[5]) {
      parts.push(
        <em key={match.index} className="italic text-[#2B3346]">
          {match[5]}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderFormattedContent(rawText: string) {
  if (!rawText) return null;

  // Normaliza quebras de linha e padroniza itens numerados colados (ex: "negociação.2. **Passo**")
  const normalized = rawText
    .replace(/([.!?])\s*(\d+\.)\s+(\*\*)/g, '$1\n\n$2 $3')
    .replace(/([.!?])\s*(\d+\.)\s+([A-ZÀ-Ú])/g, '$1\n\n$2 $3');

  const paragraphs = normalized.split(/\n\s*\n/);

  return (
    <div className="flex flex-col gap-2.5">
      {paragraphs.map((p, pIdx) => {
        const trimmed = p.trim();
        if (!trimmed) return null;

        const lines = trimmed.split('\n');

        return (
          <div key={pIdx} className="flex flex-col gap-1.5">
            {lines.map((line, lIdx) => {
              const lineTrimmed = line.trim();
              if (!lineTrimmed) return null;

              const numberedMatch = lineTrimmed.match(/^(\d+)\.\s+(.*)$/);
              if (numberedMatch) {
                const [, num, rest] = numberedMatch;
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 text-[15px] leading-[1.6]">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#0D1F38] text-[11px] font-extrabold text-white">
                      {num}
                    </span>
                    <div className="flex-1 text-[#2B3346]">
                      {renderInlineTokens(rest)}
                    </div>
                  </div>
                );
              }

              const bulletMatch = lineTrimmed.match(/^[-*•]\s+(.*)$/);
              if (bulletMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 text-[15px] leading-[1.6]">
                    <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0D1F38]" />
                    <div className="flex-1 text-[#2B3346]">
                      {renderInlineTokens(bulletMatch[1])}
                    </div>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="m-0 text-[15px] leading-[1.6] text-[#2B3346]">
                  {renderInlineTokens(lineTrimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lead helpers (validação espelha app/api/lead/route.ts)
// ---------------------------------------------------------------------------
function normalizeNome(raw: string) {
  // iOS troca o apóstrofo por ’ (pontuação inteligente): normaliza para o ASCII aceito na validação.
  return raw.replace(/[‘’ʼ`´]/g, "'").trim().replace(/\s+/g, ' ').slice(0, 120);
}

function nomeError(nome: string): string | null {
  const letters = (nome.match(/\p{L}/gu) || []).length;
  if (/\d/.test(nome)) return 'Digite só o seu nome, sem números.';
  if (letters < 2 || !/^[\p{L}][\p{L}\s'.-]*$/u.test(nome)) return 'Digite seu nome para continuarmos (somente letras).';
  return null;
}

// Remove o código do país (+55) e o 0 de operadora/discagem, comuns em números colados ou preenchidos automaticamente.
function celularDigits(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length >= 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 11);
}

function formatCelular(raw: string) {
  const d = celularDigits(raw);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function celularError(masked: string): string | null {
  const d = masked.replace(/\D/g, '');
  const ddd = Number(d.slice(0, 2));
  if (d.length < 10 || d.length > 11) return 'Confira o número: informe o DDD e o celular, por exemplo (21) 98765-4321.';
  if (ddd < 11 || ddd > 99) return 'O DDD parece incorreto. Confira os dois primeiros números.';
  if (d.length === 11 && d[2] !== '9') return 'Celulares com 11 dígitos começam com 9 depois do DDD. Confira o número.';
  return null;
}

function firstName(nome: string) {
  return nome.trim().split(/\s+/)[0] || '';
}

// Padrões de CPF e telefone: mensagens com esses dados nunca vão para a /api/chat.
const CPF_RE = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;
const PHONE_RE = /\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/;
const containsPii = (text: string) => CPF_RE.test(text) || PHONE_RE.test(text);
const redactPii = (text: string) =>
  text.replace(new RegExp(CPF_RE.source, 'g'), '[dado removido]').replace(new RegExp(PHONE_RE.source, 'g'), '[dado removido]');

const TIPO_LABEL: Record<string, string> = { precatorio: 'Precatório', rpv: 'RPV (Requisição de Pequeno Valor)' };

const FAIL_MESSAGES: Record<OficioFailReason, string> = {
  too_large:
    'Esse arquivo passou de **4 MB**, o limite para envio por aqui. Tente enviar uma **foto** do documento (o site ajusta o tamanho sozinho) ou, se preferir, envie pelo WhatsApp que um especialista recebe para você.',
  unsupported_type:
    'Não consegui abrir esse tipo de arquivo. Envie o ofício em **PDF** ou como **foto** (JPG ou PNG). Fotos no formato HEIC (padrão do iPhone) não são aceitas: tire um print da foto e envie o print, ou mande pelo WhatsApp.',
  not_oficio:
    'Esse documento não parece ser um ofício requisitório de precatório ou RPV. Ele costuma trazer o nome do credor, o número do processo e o valor requisitado. Confira se é o documento certo e tente de novo.',
  extract_failed:
    'Não consegui ler os dados desse arquivo com segurança. Isso acontece com fotos escuras, tremidas ou cortadas. Tente outra foto, com o documento inteiro e bem iluminado, ou envie pelo WhatsApp que um especialista confere para você.',
  rate_limited:
    'Recebemos muitos envios em pouco tempo. Aguarde um minuto e tente de novo, ou envie pelo WhatsApp.',
  bad_request:
    'Não foi possível enviar o arquivo agora. Tente de novo ou, se preferir, envie pelo WhatsApp.',
  network:
    'Não foi possível enviar o arquivo agora. Verifique sua conexão e tente de novo, ou envie pelo WhatsApp.',
};

let msgId = 0;
type MsgOpts = { noAnim?: boolean; private?: boolean; status?: boolean };
const aiText = (text: string, opts: MsgOpts = {}): any => ({
  id: ++msgId,
  from: 'ai',
  kind: 'text',
  text,
  private: !!opts.private,
  status: !!opts.status,
});
// `noAnim` skips the fadeUp entrance — used when the message is committed by a
// flying bubble that already landed exactly where the bubble will render.
// `private` marca respostas com dados pessoais: nunca entram no histórico enviado à /api/chat.
const userText = (text: string, opts: MsgOpts = {}): any => ({
  id: ++msgId,
  from: 'user',
  kind: 'text',
  text,
  noAnim: !!opts.noAnim,
  private: !!opts.private,
});
// Mensagem inicial com id fixo (0): o contador `msgId` vive no módulo e no servidor
// continua entre requisições, o que geraria ids diferentes no SSR e na hidratação.
const introMessage = (): any => ({ ...aiText(INTRO_TEXT), id: 0 });
const aiTyping = (): any => ({ id: ++msgId, from: 'ai', kind: 'typing' });
const aiCard = (kind: string, extra: any): any => ({ id: ++msgId, from: 'ai', kind, ...extra });

const INTRO_TEXT =
  'Olá! Sou a assistente da Premium Office Precatórios. Funciona assim: você envia o seu **ofício**, a IA lê os dados principais e um **especialista da Premium Office** prepara a sua proposta. Tudo **sem custo e sem compromisso**.';

const LEAD_TOOLTIP = 'É o estado (UF) relacionado ao seu processo/precatório, não necessariamente onde você mora hoje.';

const ASK_OFICIO_TEXT =
  'Obrigado! Agora envie o seu **ofício requisitório** (PDF ou foto). A IA lê o documento e mostra os dados principais para você conferir. Seus dados são tratados com sigilo, conforme a LGPD.';

const ANALYSIS_STEPS = [
  {
    title: 'Seus dados',
    desc: 'Nome e WhatsApp, para o especialista saber com quem falar. Leva menos de um minuto.',
  },
  {
    title: 'Envio do ofício',
    desc: 'Envie o ofício requisitório em PDF ou foto, em ambiente seguro e protegido pela LGPD.',
  },
  {
    title: 'Leitura pela IA',
    desc: 'A IA lê o documento e extrai credor, tribunal, natureza e valor para você conferir.',
  },
  {
    title: 'Proposta do especialista',
    desc: 'Um especialista da Premium Office analisa os dados e apresenta a sua proposta, sem custo e sem compromisso.',
  },
];

const STAGE_STEP: Record<Stage, number> = {
  intro: 0,
  'lead-nome': 0,
  'lead-celular': 0,
  'lead-estado': 0,
  upload: 1,
  'upload-error': 1,
  'no-oficio': 1,
  analyzing: 2,
  confirm: 2,
  revision: 2,
  saving: 2,
  confirmed: 3,
  'confirm-failed': 3,
  'free-chat': 0, // calculado dinamicamente em render()
};

// Estágios em que o composer de texto livre fica disponível.
const COMPOSER_STAGES: Stage[] = ['upload', 'upload-error', 'no-oficio', 'revision', 'confirm-failed', 'free-chat'];


// Bubble styles ------------------------------------------------------------------
// Tipografia do chat em 15px (público mais velho, leitura no celular).
const BUBBLE_FONT_PX = 15;
const USER_BUBBLE_PAD = '12px 16px';
const AI_BUBBLE: CSSProperties = {
  maxWidth: '100%',
  background: '#fff',
  border: '1px solid #EAEDF2',
  color: '#2B3346',
  padding: '12px 15px',
  borderRadius: '16px',
  borderTopLeftRadius: '3px',
  fontSize: `${BUBBLE_FONT_PX}px`,
  lineHeight: 1.6,
  boxShadow: '0 8px 20px -6px rgba(11,27,51,0.12), 0 2px 6px rgba(11,27,51,0.04)',
};
const USER_BUBBLE: CSSProperties = {
  maxWidth: '100%',
  background: '#0B1B33',
  color: '#fff',
  padding: USER_BUBBLE_PAD,
  borderRadius: '16px',
  borderTopRightRadius: '3px',
  fontSize: `${BUBBLE_FONT_PX}px`,
  lineHeight: 1.55,
  fontWeight: 600,
  overflowWrap: 'anywhere',
  boxShadow: '0 8px 20px -6px rgba(11,27,51,0.22), 0 2px 6px rgba(11,27,51,0.08)',
};
const CARD_BUBBLE: CSSProperties = { ...AI_BUBBLE, maxWidth: '96%', padding: '16px' };
const AI_WRAP: CSSProperties = { display: 'flex', justifyContent: 'flex-start', position: 'relative', zIndex: 1, animation: 'aiIn 0.35s cubic-bezier(0.4,0,0.2,1)' };
const USER_WRAP: CSSProperties = { display: 'flex', justifyContent: 'flex-end', position: 'relative', zIndex: 1, animation: 'fadeUp 0.35s cubic-bezier(0.4,0,0.2,1)' };
const USER_WRAP_NO_ANIM: CSSProperties = { ...USER_WRAP, animation: 'none' };
// Texto só para leitores de tela.
const SR_ONLY: CSSProperties = { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 };
const TYPING_DOT: CSSProperties = { display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#5B6478', animation: 'blink 1.2s infinite' };

// Button styles -----------------------------------------------------------------
// O label do Mantine Button usa nowrap + overflow hidden: liberamos a quebra de linha
// para rótulos longos em telas de 320–360px.
const WRAP_BTN_STYLES: { inner: CSSProperties; label: CSSProperties } = {
  inner: { height: 'auto' },
  label: { whiteSpace: 'normal', overflow: 'visible', height: 'auto', textAlign: 'center' },
};
const PRIMARY_BTN: CSSProperties = { height: 'auto', minHeight: '48px', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #0D1F38', background: '#0D1F38', color: '#F7F5F1', fontWeight: 800, fontSize: '15px', textAlign: 'center', lineHeight: 1.35, textDecoration: 'none' };
const SECONDARY_BTN: CSSProperties = { height: 'auto', minHeight: '48px', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #C9D0DC', background: '#fff', color: '#3B4457', fontWeight: 700, fontSize: '15px', textAlign: 'center', lineHeight: 1.35, textDecoration: 'none' };
const PRIMARY_HOVER = 'transition-colors duration-250 hover:!bg-[#F7F5F1] hover:!text-navy-accent';
const SECONDARY_HOVER = 'transition-colors duration-250 hover:!bg-[#5B6478] hover:!text-white';
// <label> estilizado como botão (abre o seletor de arquivo sem JS, inclusive no iOS).
const LABEL_BTN_BASE: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', cursor: 'pointer', width: '100%' };
const COMPACT_BTN: CSSProperties = { flex: '1 1 0%', minWidth: 0, minHeight: '44px', padding: '9px 12px', borderRadius: '999px', border: '1.5px solid #0D1F38', background: '#fff', color: '#0D1F38', fontWeight: 700, fontSize: '14px', lineHeight: 1.3, textAlign: 'center', textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: 'inherit' };

function getOrCreateClientSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const key = 'po_chat_session_id';
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const id = `lp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, id);
    return id;
  } catch {
    return `lp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

const EMPTY_LEAD: LeadData = { nome: '', celular: '', estado: '' };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isPhoneWidth = () => typeof window !== 'undefined' && window.innerWidth < 640;

// GIF transparente 1x1: fallback de <picture> para que imagens só de desktop não sejam baixadas no celular.
const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// ---------------------------------------------------------------------------
// Mensagens (memoizadas: digitar no composer não re-renderiza o histórico)
// ---------------------------------------------------------------------------
const MessageItem = React.memo(function MessageItem({ m }: { m: any }) {
  if (m.kind === 'typing') {
    return (
      <div data-msg-id={m.id} style={AI_WRAP}>
        <Paper style={AI_BUBBLE}>
          <span style={SR_ONLY}>A assistente está digitando…</span>
          <span aria-hidden="true" style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', height: '20px' }}>
            <span style={TYPING_DOT} />
            <span style={{ ...TYPING_DOT, animationDelay: '0.2s' }} />
            <span style={{ ...TYPING_DOT, animationDelay: '0.4s' }} />
          </span>
        </Paper>
      </div>
    );
  }

  if (m.kind === 'text' && m.from === 'user') {
    return (
      <div data-msg-id={m.id} style={m.noAnim ? USER_WRAP_NO_ANIM : USER_WRAP} className="max-w-[90%] self-end sm:max-w-[80%]">
        <Paper style={USER_BUBBLE}>{m.text}</Paper>
      </div>
    );
  }

  if (m.kind === 'text') {
    return (
      <div data-msg-id={m.id} style={AI_WRAP} className="max-w-[94%] sm:max-w-[85%]">
        <Paper style={AI_BUBBLE}>{renderFormattedContent(m.text)}</Paper>
      </div>
    );
  }

  if (m.kind === 'extract-card') {
    return (
      <div data-msg-id={m.id} style={AI_WRAP}>
        <Paper style={CARD_BUBBLE}>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#0B1B33', marginBottom: '10px' }}>Dados extraídos do documento</div>
          <dl style={{ margin: 0 }}>
            {m.items.map((item: any) => (
              <div key={item.label} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: '12px', rowGap: '2px', padding: '7px 0', fontSize: '14px', lineHeight: 1.45, borderBottom: '1px solid #EEF1F5' }}>
                <dt style={{ color: '#5B6478', flexShrink: 0 }}>{item.label}</dt>
                <dd style={{ margin: 0, color: '#1C2331', fontWeight: 700, textAlign: 'right', marginLeft: 'auto', overflowWrap: 'anywhere', fontFamily: item.mono ? 'var(--font-roboto-mono, ui-monospace, monospace)' : undefined }}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <p style={{ fontSize: '13px', color: '#5B6478', margin: '10px 0 0', lineHeight: 1.5 }}>
            Leitura automática. A proposta é feita por um especialista, sobre o valor líquido (após descontos legais), e não sobre o valor bruto.
          </p>
        </Paper>
      </div>
    );
  }

  return null;
});

const MessageList = React.memo(function MessageList({ messages }: { messages: any[] }) {
  return (
    <>
      {messages.map((m) => (
        <MessageItem key={m.id} m={m} />
      ))}
    </>
  );
});

interface State {
  stage: Stage;
  messages: any[];
  flyingBubble: any | null;
  composerText: string;
  composerSending: boolean;
  leadData: LeadData;
  leadFieldValue: string;
  leadError: string;
  leadTooltipOpen: boolean;
  fullscreenMobile: boolean;
  clientSessionId: string;
  oficioConfirmado: boolean;
  iaVisible: boolean;
}

interface ScrollSnapshot {
  nearBottom: boolean;
  lastId: number;
}

export default class ChatSection extends React.Component<{}, State> {
  sectionRef = React.createRef<HTMLElement>();
  shellRef = React.createRef<HTMLDivElement>();
  chatRef = React.createRef<HTMLDivElement>();
  dropzoneRef = React.createRef<HTMLLabelElement>();
  composerRef = React.createRef<HTMLTextAreaElement>();
  tooltipWrapRef = React.createRef<HTMLDivElement>();
  flying = false;
  unmounted = false;
  leadPersisted = false;
  // true quando nome + celular foram gravados com sucesso na /api/lead.
  leadSaved = false;
  // Correção do celular depois da confirmação: volta só para essa etapa.
  fixingCelular = false;
  preparingFile = false;
  uploadSeq = 0;
  // resetSeq sobe só no Recomeçar; chatSeq sobe a cada envio do composer.
  resetSeq = 0;
  chatSeq = 0;
  uploadAbort: AbortController | null = null;
  // Rolagem: se o usuário estava na base antes de o teclado/viewport mudar.
  stickToBottom = true;
  // Tela cheia mobile: trava de scroll do body e teclado do iOS (visualViewport).
  bodyLock: { y: number; style: Partial<CSSStyleDeclaration> } | null = null;
  vvRAF: number | null = null;
  desktopMQ: MediaQueryList | null = null;
  iaObserver: IntersectionObserver | null = null;

  state: State = {
    stage: 'intro',
    messages: [introMessage()],
    flyingBubble: null,
    composerText: '',
    composerSending: false,
    leadData: { ...EMPTY_LEAD },
    leadFieldValue: '',
    leadError: '',
    leadTooltipOpen: false,
    fullscreenMobile: false,
    clientSessionId: '',
    oficioConfirmado: false,
    iaVisible: false,
  };

  // O id da sessão vem do sessionStorage: só existe no cliente (evita divergência de hidratação no href do WhatsApp).
  sid = () => this.state.clientSessionId || getOrCreateClientSessionId();

  isNearBottom = () => {
    const el = this.chatRef.current;
    if (!el) return true;
    const threshold = 140;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = this.chatRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  onChatScroll = () => {
    this.stickToBottom = this.isNearBottom();
  };

  componentDidMount() {
    captureAttribution();
    this.setState({ clientSessionId: getOrCreateClientSessionId() });
    window.addEventListener(OPEN_CHAT_EVENT, this.onOpenChatEvent as EventListener);
    this.scrollToBottom('instant');

    // Barra fixa do mobile: some enquanto a seção do chat estiver na tela.
    const section = this.sectionRef.current;
    if (section && typeof IntersectionObserver !== 'undefined') {
      this.iaObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((en) => en.isIntersecting);
          if (visible !== this.state.iaVisible) this.setState({ iaVisible: visible });
        },
        { threshold: 0.15 }
      );
      this.iaObserver.observe(section);
    }
  }

  // Mede, ANTES do DOM mudar, se o usuário estava na base do chat (ou subiu para ler).
  getSnapshotBeforeUpdate(_prevProps: {}, prevState: State): ScrollSnapshot | null {
    if (prevState.messages === this.state.messages || !this.chatRef.current) return null;
    const prev = prevState.messages;
    return { nearBottom: this.isNearBottom(), lastId: prev.length ? prev[prev.length - 1].id : 0 };
  }

  componentDidUpdate(_prevProps: {}, prevState: State, snapshot: ScrollSnapshot | null) {
    if (snapshot && snapshot.nearBottom) this.scrollToNewContent(snapshot.lastId);

    if (prevState.fullscreenMobile !== this.state.fullscreenMobile) {
      if (this.state.fullscreenMobile) this.enterFullscreenEffects();
      else this.exitFullscreenEffects();
    }

    if (prevState.leadTooltipOpen !== this.state.leadTooltipOpen) {
      if (this.state.leadTooltipOpen) {
        document.addEventListener('pointerdown', this.onDocPointerDown, true);
        document.addEventListener('keydown', this.onTooltipKeyDown);
      } else {
        this.removeTooltipListeners();
      }
    }
  }

  componentWillUnmount() {
    this.unmounted = true;
    window.removeEventListener(OPEN_CHAT_EVENT, this.onOpenChatEvent as EventListener);
    this.uploadAbort?.abort();
    this.iaObserver?.disconnect();
    this.iaObserver = null;
    this.removeTooltipListeners();
    this.exitFullscreenEffects();
  }

  // Rola até o conteúdo novo: até a base, mas sem passar do topo do primeiro item novo
  // (um card alto ou uma resposta longa ficam visíveis desde o começo).
  scrollToNewContent = (lastId: number) => {
    const el = this.chatRef.current;
    if (!el) return;
    const maxTop = el.scrollHeight - el.clientHeight;
    let anchor: HTMLElement | null = null;
    const nodes = el.querySelectorAll<HTMLElement>('[data-msg-id]');
    for (let i = 0; i < nodes.length; i++) {
      if (Number(nodes[i].dataset.msgId) > lastId) {
        anchor = nodes[i];
        break;
      }
    }
    const target = anchor ? Math.min(maxTop, anchor.offsetTop - 12) : maxTop;
    if (target <= el.scrollTop) return;
    el.scrollTo({ top: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  // -------------------------------------------------------------------------
  // Tela cheia (mobile)
  // -------------------------------------------------------------------------
  openFullscreen = () => this.setState({ fullscreenMobile: true });
  closeFullscreen = () => this.setState({ fullscreenMobile: false });

  enterFullscreenEffects = () => {
    if (typeof window === 'undefined') return;
    // Trava o scroll da página por trás (position: fixed é o que funciona no iOS Safari).
    if (!this.bodyLock) {
      const b = document.body.style;
      const y = window.scrollY;
      this.bodyLock = { y, style: { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow } };
      b.position = 'fixed';
      b.top = `-${y}px`;
      b.left = '0';
      b.right = '0';
      b.width = '100%';
      b.overflow = 'hidden';
    }
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', this.onVisualViewportChange);
      vv.addEventListener('scroll', this.onVisualViewportChange);
      this.onVisualViewportChange();
    }
    window.addEventListener('keydown', this.onFullscreenKeyDown);
    // Girou para paisagem / tela larga: o layout sm: assume, então sai da tela cheia.
    if (window.matchMedia) {
      this.desktopMQ = window.matchMedia('(min-width: 640px)');
      this.desktopMQ.addEventListener('change', this.onDesktopMQChange);
    }
  };

  exitFullscreenEffects = () => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (vv) {
      vv.removeEventListener('resize', this.onVisualViewportChange);
      vv.removeEventListener('scroll', this.onVisualViewportChange);
    }
    if (this.vvRAF !== null) {
      cancelAnimationFrame(this.vvRAF);
      this.vvRAF = null;
    }
    const shell = this.shellRef.current;
    if (shell) {
      shell.style.height = '';
      shell.style.top = '';
    }
    window.removeEventListener('keydown', this.onFullscreenKeyDown);
    this.desktopMQ?.removeEventListener('change', this.onDesktopMQChange);
    this.desktopMQ = null;
    if (this.bodyLock) {
      const { y, style } = this.bodyLock;
      Object.assign(document.body.style, style);
      this.bodyLock = null;
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    }
  };

  // iOS: o teclado não redimensiona o layout viewport nem o 100dvh. Ajustamos a tela cheia
  // ao visual viewport para o campo de digitação ficar sempre acima do teclado.
  onVisualViewportChange = () => {
    if (this.vvRAF !== null) return;
    this.vvRAF = requestAnimationFrame(() => {
      this.vvRAF = null;
      const vv = window.visualViewport;
      const shell = this.shellRef.current;
      if (!vv || !shell || !this.state.fullscreenMobile) return;
      shell.style.height = `${Math.round(vv.height)}px`;
      shell.style.top = `${Math.round(vv.offsetTop)}px`;
      if (this.stickToBottom) this.scrollToBottom('auto');
    });
  };

  onFullscreenKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !this.state.leadTooltipOpen) this.closeFullscreen();
  };

  onDesktopMQChange = (e: MediaQueryListEvent) => {
    if (e.matches) this.closeFullscreen();
  };

  // -------------------------------------------------------------------------
  // Tooltip "Estado do processo": abre/fecha só no toque; fecha ao tocar fora ou com Esc
  // -------------------------------------------------------------------------
  onDocPointerDown = (e: PointerEvent) => {
    const wrap = this.tooltipWrapRef.current;
    if (wrap && e.target instanceof Node && wrap.contains(e.target)) return;
    // Toques dentro do formulário do estado (select, Continuar) não fecham: o tooltip está no fluxo
    // e sumir com ele no pointerdown deslocaria o botão antes do clique.
    const form = wrap?.closest('form');
    if (form && e.target instanceof Node && form.contains(e.target)) return;
    this.setState({ leadTooltipOpen: false });
  };

  onTooltipKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.setState({ leadTooltipOpen: false });
  };

  removeTooltipListeners = () => {
    if (typeof document === 'undefined') return;
    document.removeEventListener('pointerdown', this.onDocPointerDown, true);
    document.removeEventListener('keydown', this.onTooltipKeyDown);
  };

  // -------------------------------------------------------------------------
  // Abertura do chat a partir de qualquer CTA da página (lib/chat-events.ts)
  // -------------------------------------------------------------------------
  onOpenChatEvent = (e: Event) => {
    const detail = (e as CustomEvent<{ origem?: string }>).detail;
    this.openChat(detail?.origem || 'desconhecida');
  };

  openChat = (origem: string) => {
    // Os CTAs já registram cta_click; chat_start só conta quando a conversa realmente começa.
    if (this.state.stage === 'intro' && !this.flying) track('chat_start', { origem });
    if (isPhoneWidth()) {
      this.openFullscreen();
    } else {
      this.sectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
    if (this.state.stage === 'intro' && !this.flying) {
      this.startLeadCapture(null);
    }
  };

  pushMessages = (...msgs: any[]) => {
    this.setState((s) => ({ messages: [...s.messages, ...msgs] }));
  };

  flyBubble = (label: string, targetEl: HTMLElement | null, commitFn: () => void) => {
    // Trava contra toque duplo durante o voo (evita perguntas e bolhas duplicadas).
    if (this.flying) return;
    const container = this.chatRef.current;
    // Sem animação (movimento reduzido, sem origem ou sem container): confirma direto.
    if (!targetEl || !container || prefersReducedMotion()) {
      commitFn();
      return;
    }
    this.flying = true;
    const containerRect = container.getBoundingClientRect();
    const btnRect = targetEl.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const startLeft = btnRect.left - containerRect.left;
    const startTop = btnRect.top - containerRect.top + scrollTop;
    // Mede a caixa exata que a bolha confirmada vai ocupar (mesmas métricas de USER_BUBBLE
    // e do wrapper max-w-[90%] / sm:max-w-[80%]) para o voo pousar sem re-quebrar o texto.
    const pad = parseFloat(getComputedStyle(container).paddingLeft) || 14;
    const contentWidth = container.clientWidth - pad * 2;
    const probe = document.createElement('div');
    Object.assign(probe.style, {
      position: 'absolute',
      visibility: 'hidden',
      left: '-9999px',
      top: '0',
      width: 'max-content',
      maxWidth: contentWidth * (window.innerWidth < 640 ? 0.9 : 0.8) + 'px',
      boxSizing: 'border-box',
      padding: USER_BUBBLE_PAD,
      fontSize: `${BUBBLE_FONT_PX}px`,
      lineHeight: '1.55',
      fontWeight: '600',
      overflowWrap: 'anywhere',
    });
    probe.textContent = label;
    container.appendChild(probe);
    const probeRect = probe.getBoundingClientRect();
    const endWidth = probeRect.width;
    const endHeight = probeRect.height;
    container.removeChild(probe);
    const endLeft = container.clientWidth - endWidth - pad;
    const msgNodes = container.querySelectorAll('[data-msg-id]');
    const lastMsg = msgNodes[msgNodes.length - 1];
    const lastRect = lastMsg ? lastMsg.getBoundingClientRect() : null;
    const endTopFinal = lastRect ? lastRect.bottom - containerRect.top + scrollTop + 14 : startTop;

    this.setState({
      flyingBubble: {
        label,
        left: startLeft,
        top: startTop,
        width: btnRect.width,
        height: btnRect.height,
        endLeft,
        endTop: endTopFinal,
        endWidth,
        endHeight,
        phase: 'start',
      },
    });

    requestAnimationFrame(() => {
      this.setState((s) => (s.flyingBubble ? ({ flyingBubble: { ...s.flyingBubble, phase: 'end' } } as any) : null));
    });

    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });

    // A rolagem até a mensagem nova fica com componentDidUpdate (scrollToNewContent).
    setTimeout(() => {
      this.flying = false;
      if (this.unmounted) return;
      commitFn();
      this.setState({ flyingBubble: null });
    }, 700);
  };

  // -------------------------------------------------------------------------
  // Persistência progressiva do lead (1 retentativa). Resolve true quando a gravação deu certo.
  // -------------------------------------------------------------------------
  persistLead = (stage: string, resultado?: Resultado, lead: Partial<LeadData> = {}): Promise<boolean> => {
    const payloadLead: Record<string, string> = {};
    if (lead.nome) payloadLead.nome = lead.nome;
    if (lead.celular) payloadLead.celular = lead.celular.replace(/\D/g, '');
    if (lead.estado) payloadLead.estado = lead.estado;
    if (payloadLead.nome || payloadLead.celular) this.leadPersisted = true;
    const hasContact = !!(payloadLead.nome && payloadLead.celular);

    const clientSessionId = this.sid();
    if (!clientSessionId) return Promise.resolve(false);
    const body = JSON.stringify({ clientSessionId, lead: payloadLead, stage, resultado, attribution: getAttribution() });
    const resetSeq = this.resetSeq;

    const attempt = async (n: number): Promise<boolean> => {
      try {
        const res = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        });
        if (res.ok) {
          if (hasContact && resetSeq === this.resetSeq) this.leadSaved = true;
          return true;
        }
        let info: any = null;
        try {
          info = await res.json();
        } catch {}
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          console.warn('[lead] registro recusado', { stage, status: res.status, error: info?.error, field: info?.field });
          return false;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (error) {
        if (n === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          return attempt(1);
        }
        console.error('[lead] falha ao registrar lead', { stage, error });
        return false;
      }
    };
    return attempt(0);
  };

  hasLead = () => this.leadPersisted || !!(this.state.leadData.nome || this.state.leadData.celular);

  // -------------------------------------------------------------------------
  // WhatsApp
  // -------------------------------------------------------------------------
  waHref = (motivo?: string) =>
    whatsappLink({
      nome: this.state.leadData.nome || undefined,
      protocolo: protocoloFromSession(this.state.clientSessionId),
      motivo,
    });

  onWhatsappClick = (origem: string) => {
    track('whatsapp_click', { origem });
    // O servidor nunca rebaixa o funil, então 'falou_consultor' não sobrescreve 'documentos_enviados'.
    if (this.hasLead()) this.persistLead(`whatsapp_${origem}`, 'falou_consultor');
  };

  renderWhatsappButton(label: string, motivo: string, origem: string, variant: 'primary' | 'secondary' = 'primary') {
    return (
      <Button
        styles={WRAP_BTN_STYLES}
        component="a"
        href={this.waHref(motivo)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => this.onWhatsappClick(origem)}
        className={variant === 'primary' ? PRIMARY_HOVER : SECONDARY_HOVER}
        style={variant === 'primary' ? PRIMARY_BTN : SECONDARY_BTN}
      >
        {label}
      </Button>
    );
  }

  // -------------------------------------------------------------------------
  // Fluxo: intro -> nome -> celular -> estado -> ofício
  // -------------------------------------------------------------------------
  nextLeadStage = (lead: LeadData): Stage => {
    if (!lead.nome) return 'lead-nome';
    if (!lead.celular) return 'lead-celular';
    if (!lead.estado) return 'lead-estado';
    return 'upload';
  };

  leadQuestion = (stage: Stage, lead: LeadData) => {
    if (stage === 'lead-nome') return aiText('Para começar, qual é o seu **nome completo**?');
    if (stage === 'lead-celular') {
      const nome = firstName(lead.nome);
      return aiText(
        `${nome ? `Prazer, ${nome}! ` : ''}Qual é o seu **WhatsApp com DDD**? É por ele que o especialista vai falar com você.`,
        { private: true }
      );
    }
    if (stage === 'lead-estado') return aiText('Em qual **estado (UF)** está o processo do seu precatório?');
    return aiText(ASK_OFICIO_TEXT);
  };

  startLeadCapture = (originEl: HTMLElement | null) => {
    const label = 'Começar análise gratuita';
    this.flyBubble(label, originEl, () => {
      const next = this.nextLeadStage(this.state.leadData);
      this.pushMessages(userText(label, { noAnim: !!originEl }), this.leadQuestion(next, this.state.leadData));
      this.setState({ stage: next, leadFieldValue: '', leadError: '' });
    });
  };

  onStartClick = (e: React.MouseEvent) => {
    if (this.flying) return;
    track('chat_start', { origem: 'chat_intro' });
    // No celular a conversa segue em tela cheia (teclado e respostas sem disputar espaço com a página).
    // O layout muda na hora, então não há voo da bolha nesse caso.
    if (isPhoneWidth() && !this.state.fullscreenMobile) {
      this.openFullscreen();
      this.startLeadCapture(null);
      return;
    }
    this.startLeadCapture(e.currentTarget as HTMLElement);
  };

  onLeadFieldChange = (value: string) => {
    const next = this.state.stage === 'lead-celular' ? formatCelular(value) : value.slice(0, 120);
    this.setState({ leadFieldValue: next, leadError: '' });
  };

  onLeadFieldSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (this.flying) return;
    const { stage, leadFieldValue } = this.state;

    if (stage === 'lead-nome') {
      const nome = normalizeNome(leadFieldValue);
      const err = nomeError(nome);
      if (err) return this.setState({ leadError: err });
      this.commitLeadStep({ nome }, nome, 'lead_nome');
      return;
    }
    if (stage === 'lead-celular') {
      const celular = formatCelular(leadFieldValue);
      const err = celularError(celular);
      if (err) return this.setState({ leadError: err });
      this.commitLeadStep({ celular }, celular, 'lead_celular');
    }
  };

  onSelectEstado = (uf: string) => {
    if (this.flying) return;
    const est = ESTADOS_BR_LIST.find((x) => x.uf === uf);
    if (!est) return this.setState({ leadError: 'Selecione o estado do processo na lista.' });
    this.commitLeadStep({ estado: uf }, est.nome, 'lead_estado');
  };

  commitLeadStep = (patch: Partial<LeadData>, bubbleText: string, stageName: 'lead_nome' | 'lead_celular' | 'lead_estado') => {
    const lead: LeadData = { ...this.state.leadData, ...patch };
    if (this.fixingCelular && stageName === 'lead_celular') {
      this.fixingCelular = false;
      this.pushMessages(userText(bubbleText, { private: true }));
      this.setState({ leadData: lead, leadFieldValue: '', leadError: '' });
      void this.confirmLeadContact(lead, 'celular_corrigido');
      return;
    }
    const resultado: Resultado = lead.nome && lead.celular ? 'lead_qualificado' : 'em_andamento';
    void this.persistLead(stageName, resultado, lead);
    if (stageName === 'lead_estado') track('lead_estado', { uf: lead.estado });
    else track(stageName);

    const next = this.nextLeadStage(lead);
    // Nome e celular são marcados como privados: nunca vão para a /api/chat.
    this.pushMessages(userText(bubbleText, { private: stageName !== 'lead_estado' }), this.leadQuestion(next, lead));
    this.setState({ leadData: lead, stage: next, leadFieldValue: '', leadError: '', leadTooltipOpen: false });
  };

  // -------------------------------------------------------------------------
  // Ofício
  // -------------------------------------------------------------------------
  goToOficio = (label: string, e?: React.MouseEvent) => {
    const el = (e?.currentTarget as HTMLElement) || null;
    this.flyBubble(label, el, () => {
      const lead = this.state.leadData;
      const next = this.nextLeadStage(lead);
      const question =
        next === 'upload'
          ? aiText('Certo! Envie o ofício requisitório (PDF ou foto). A IA lê o documento e mostra os dados para você conferir.')
          : this.leadQuestion(next, lead);
      this.pushMessages(userText(label, { noAnim: !!el }), question);
      this.setState({ stage: next, leadFieldValue: '', leadError: '' });
    });
  };

  onNoOficio = (e: React.MouseEvent) => {
    const label = 'Não tenho o ofício agora';
    this.flyBubble(label, e.currentTarget as HTMLElement, () => {
      this.pushMessages(
        userText(label, { noAnim: true }),
        aiText(
          'Sem problema! Muita gente não tem o ofício em mãos. Um especialista da Premium Office pode te ajudar a localizar o documento a partir do número do processo, sem custo. É só chamar no WhatsApp. Se tiver alguma dúvida, pode escrever aqui também.'
        )
      );
      this.setState({ stage: 'no-oficio' });
    });
  };

  failOficio = (reason: OficioFailReason, seq: number) => {
    if (this.unmounted || seq !== this.uploadSeq) return;
    track('oficio_falha', { reason });
    this.setState((s) => ({
      messages: [...s.messages.filter((m) => m.kind !== 'typing' && !m.status), aiText(FAIL_MESSAGES[reason])],
      stage: 'upload-error',
    }));
  };

  isBusyStage = () => this.state.stage === 'analyzing' || this.state.stage === 'saving';

  onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const original = input.files && input.files[0];
    // Limpa o input para permitir escolher o mesmo arquivo de novo.
    input.value = '';
    if (!original || this.flying || this.preparingFile || this.isBusyStage()) return;

    // Fotos grandes do celular (e HEIC, quando o navegador decodifica) viram JPEG menor antes do envio.
    const resetSeq = this.resetSeq;
    this.preparingFile = true;
    let file: File;
    try {
      file = await prepareOficioFile(original);
    } finally {
      this.preparingFile = false;
    }
    // Releitura do estado depois do await (o TS mantém o estreitamento anterior).
    if (this.unmounted || resetSeq !== this.resetSeq || this.flying || this.isBusyStage()) return;

    if (file.size > MAX_OFICIO_BYTES) {
      const seq = ++this.uploadSeq;
      this.pushMessages(userText(`Arquivo: ${original.name}`, { private: true }));
      this.failOficio('too_large', seq);
      return;
    }

    const label = `Documento enviado: ${original.name}`;
    const origin = this.state.stage === 'upload' ? this.dropzoneRef.current : null;
    this.flyBubble(label, origin, () => this.uploadOficio(file, label, !!origin));
  };

  uploadOficio = async (file: File, label: string, noAnim: boolean) => {
    const seq = ++this.uploadSeq;
    this.uploadAbort?.abort();
    const controller = new AbortController();
    this.uploadAbort = controller;
    const timeout = setTimeout(() => controller.abort(), 90_000);

    track('oficio_upload', { tipo_arquivo: file.type || 'desconhecido', tamanho_kb: Math.round(file.size / 1024) });
    this.pushMessages(
      userText(label, { noAnim, private: true }),
      aiText('Lendo seu ofício… isso leva alguns segundos.', { status: true }),
      aiTyping()
    );
    this.setState({ stage: 'analyzing' });

    let data: any = null;
    let status = 0;
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('clientSessionId', this.sid());
      const res = await fetch('/api/oficio', { method: 'POST', body: form, signal: controller.signal });
      status = res.status;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } catch (error) {
      clearTimeout(timeout);
      if (seq !== this.uploadSeq) return; // reiniciado ou substituído
      console.error('[oficio] falha no envio', error);
      this.failOficio(controller.signal.aborted ? 'extract_failed' : 'network', seq);
      return;
    }
    clearTimeout(timeout);
    if (this.unmounted || seq !== this.uploadSeq) return;

    if (!data || data.ok !== true || !data.extracted) {
      const known: OficioFailReason[] = ['too_large', 'unsupported_type', 'not_oficio', 'extract_failed', 'rate_limited', 'bad_request'];
      const reason: OficioFailReason =
        data && known.includes(data.reason) ? data.reason : status === 413 ? 'too_large' : status === 429 ? 'rate_limited' : 'extract_failed';
      this.failOficio(reason, seq);
      return;
    }

    const x = data.extracted as Extracted;
    const items: { label: string; value: string; mono?: boolean }[] = [];
    if (x.tipo && TIPO_LABEL[x.tipo]) items.push({ label: 'Tipo', value: TIPO_LABEL[x.tipo] });
    if (x.credor) items.push({ label: 'Credor', value: x.credor });
    if (x.cpf) items.push({ label: 'CPF', value: x.cpf, mono: true });
    if (x.processo) items.push({ label: 'Nº do processo', value: x.processo, mono: true });
    if (x.tribunal) items.push({ label: 'Tribunal', value: x.tribunal });
    if (x.enteDevedor) items.push({ label: 'Ente devedor', value: x.enteDevedor });
    if (x.natureza) items.push({ label: 'Natureza', value: x.natureza });
    if (typeof x.valor === 'number' && Number.isFinite(x.valor) && x.valor > 0) items.push({ label: 'Valor no ofício', value: formatBRL(x.valor), mono: true });
    if (x.dataBase) items.push({ label: 'Data-base', value: x.dataBase, mono: true });

    // Sem nenhum campo identificado não há o que conferir: trata como leitura falha.
    if (items.filter((i) => i.label !== 'Tipo').length === 0) {
      this.failOficio('extract_failed', seq);
      return;
    }

    track('oficio_extraido', { tipo: x.tipo || 'desconhecido', campos: items.length });
    this.setState((s) => ({
      messages: [
        ...s.messages.filter((m) => m.kind !== 'typing' && !m.status),
        aiCard('extract-card', { items }),
        aiText('Esses dados conferem com o seu documento?'),
      ],
      stage: 'confirm',
    }));
  };

  // Regrava nome + celular junto com o resultado e só promete o contato se a gravação deu certo.
  confirmLeadContact = async (lead: LeadData, stageName: string) => {
    const resetSeq = this.resetSeq;
    const typing = aiTyping();
    this.pushMessages(typing);
    this.setState({ stage: 'saving' });
    const ok = await this.persistLead(stageName, 'documentos_enviados', { nome: lead.nome, celular: lead.celular });
    if (this.unmounted || resetSeq !== this.resetSeq) return;
    const n = firstName(lead.nome);
    const text = ok
      ? `${n ? `Obrigado, ${n}! ` : 'Obrigado! '}Um especialista da Premium Office vai calcular a sua proposta com base nesses dados e entrar em contato pelo WhatsApp${
          lead.celular ? ` no número **${lead.celular}**` : ''
        }, em horário comercial. É sem custo e sem compromisso.\n\nSe quiser adiantar, você pode chamar agora no WhatsApp. Número errado? Toque em **Corrigir meu número** logo abaixo.`
      : `${n ? `${n}, não` : 'Não'} conseguimos registrar o seu contato agora. Para garantir o atendimento, chame um especialista no **WhatsApp** pelo botão abaixo. Os dados do ofício que você conferiu ajudam na conversa.`;
    this.setState((s) => ({
      messages: [...s.messages.filter((m) => m.id !== typing.id), aiText(text, { private: true })],
      stage: ok ? 'confirmed' : 'confirm-failed',
      oficioConfirmado: true,
    }));
  };

  onConfirmarDados = (e: React.MouseEvent) => {
    const label = 'Sim, conferem';
    this.flyBubble(label, e.currentTarget as HTMLElement, () => {
      track('dados_confirmados');
      this.pushMessages(userText(label, { noAnim: true }));
      void this.confirmLeadContact(this.state.leadData, 'dados_confirmados');
    });
  };

  onRetryConfirm = (e: React.MouseEvent) => {
    const label = 'Tentar registrar de novo';
    this.flyBubble(label, e.currentTarget as HTMLElement, () => {
      this.pushMessages(userText(label, { noAnim: true }));
      void this.confirmLeadContact(this.state.leadData, 'dados_confirmados');
    });
  };

  onCorrigirNumero = (e: React.MouseEvent) => {
    const label = 'Corrigir meu número';
    this.flyBubble(label, e.currentTarget as HTMLElement, () => {
      this.fixingCelular = true;
      this.pushMessages(userText(label, { noAnim: true }), aiText('Sem problema. Qual é o seu **WhatsApp com DDD** correto?', { private: true }));
      this.setState({ stage: 'lead-celular', leadFieldValue: '', leadError: '' });
    });
  };

  onCorrigirDados = (e: React.MouseEvent) => {
    const label = 'Corrigir dados';
    this.flyBubble(label, e.currentTarget as HTMLElement, () => {
      this.persistLead('revisao_solicitada', 'revisao_solicitada');
      this.pushMessages(
        userText(label, { noAnim: true }),
        aiText(
          'Sem problema. Um especialista vai revisar o seu documento manualmente e falar com você pelo WhatsApp informado. Se preferir, envie outro arquivo (uma foto mais nítida costuma ajudar) ou chame agora no WhatsApp.'
        )
      );
      this.setState({ stage: 'revision' });
    });
  };

  onTenhoDuvida = (e: React.MouseEvent) => {
    const label = 'Tenho uma dúvida';
    this.flyBubble(label, e.currentTarget as HTMLElement, () => {
      this.pushMessages(userText(label, { noAnim: true }), aiText('Claro! Pode escrever a sua dúvida aqui embaixo.'));
      this.setState({ stage: 'free-chat' }, () => this.composerRef.current?.focus());
    });
  };

  onRestartFull = () => {
    if (this.flying) return;
    this.uploadSeq++;
    this.resetSeq++;
    this.leadSaved = false;
    this.fixingCelular = false;
    this.uploadAbort?.abort();
    this.uploadAbort = null;
    this.setState({
      stage: 'intro',
      messages: [introMessage()],
      flyingBubble: null,
      composerText: '',
      composerSending: false,
      leadData: { ...EMPTY_LEAD },
      leadFieldValue: '',
      leadError: '',
      leadTooltipOpen: false,
      oficioConfirmado: false,
    });
  };

  // -------------------------------------------------------------------------
  // Composer (texto livre com a IA)
  // -------------------------------------------------------------------------
  onComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    this.setState({ composerText: e.target.value });
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.max(56, Math.min(el.scrollHeight, 120)) + 'px';
  };

  onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.onComposerSend();
    }
  };

  buildChatHistory = (current: string) => {
    // Nunca envia dados pessoais: exclui mensagens privadas, de status e qualquer texto com padrão de CPF/telefone.
    const history = this.state.messages
      .filter((m) => m.kind === 'text' && !m.private && !m.status && typeof m.text === 'string' && !containsPii(m.text))
      .map((m) => ({ role: (m.from === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text as string }))
      .slice(-15) // a /api/chat usa só as 16 últimas e recusa corpos acima de 40 KB
      .map((m) => ({ ...m, content: m.content.slice(0, 2000) }));
    history.push({ role: 'user', content: redactPii(current).slice(0, 2000) });
    return history;
  };

  onComposerSend = async () => {
    const text = this.state.composerText.trim();
    if (!text || this.state.composerSending) return;
    this.setState({ composerText: '', composerSending: true });
    if (this.composerRef.current) {
      this.composerRef.current.style.height = 'auto';
    }

    // Prepara o histórico ANTES de adicionar o indicador de typing
    const historyForApi = this.buildChatHistory(text);
    const resetSeq = this.resetSeq;
    const mySend = ++this.chatSeq;
    const typing = aiTyping();

    // Mensagem com CPF/telefone fica visível para o usuário, mas é marcada como privada.
    this.pushMessages(userText(text, { private: containsPii(text) }), typing);

    let reply = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi, clientSessionId: this.sid() }),
      });
      if (!res.ok) throw new Error('Falha na resposta da API');
      const data = await res.json();
      reply = data.text || 'Não consegui responder agora. Se preferir, fale com um especialista pelo WhatsApp.';
    } catch (error) {
      console.error(error);
      reply = 'Desculpe, não consegui responder agora. Tente de novo em instantes ou fale com um especialista pelo WhatsApp.';
    }
    if (this.unmounted) return;
    // Se o chat foi reiniciado enquanto a resposta chegava, descarta (sem liberar um envio mais novo).
    if (resetSeq !== this.resetSeq) {
      if (mySend === this.chatSeq) this.setState({ composerSending: false });
      return;
    }
    this.setState((s) => ({
      messages: [...s.messages.filter((m) => m.id !== typing.id), aiText(reply)],
      composerSending: false,
    }));
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  renderFlyingBubble() {
    const fb = this.state.flyingBubble;
    if (!fb) return null;
    const isEnd = fb.phase === 'end';
    const style: CSSProperties = {
      position: 'absolute',
      zIndex: 20,
      boxSizing: 'border-box',
      overflow: 'hidden',
      left: (isEnd ? fb.endLeft : fb.left) + 'px',
      top: (isEnd ? fb.endTop : fb.top) + 'px',
      width: (isEnd ? fb.endWidth : fb.width) + 'px',
      height: (isEnd ? fb.endHeight : fb.height) + 'px',
      display: isEnd ? 'block' : 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: isEnd ? 'left' : 'center',
      padding: isEnd ? USER_BUBBLE_PAD : '0 14px',
      background: isEnd ? '#0B1B33' : '#0D1F38',
      color: isEnd ? '#fff' : '#F7F5F1',
      fontWeight: isEnd ? 600 : 700,
      fontSize: `${BUBBLE_FONT_PX}px`,
      lineHeight: 1.55,
      overflowWrap: 'anywhere',
      borderRadius: isEnd ? '16px' : '999px',
      borderTopRightRadius: isEnd ? '3px' : '999px',
      transition:
        'left 0.6s cubic-bezier(0.4,0,0.2,1), top 0.6s cubic-bezier(0.4,0,0.2,1), width 0.6s ease, height 0.6s ease, border-radius 0.5s ease, background 0.5s ease, padding 0.5s ease, color 0.3s ease',
    };
    // Decorativa: a mensagem real entra no log logo depois (evita leitura dupla).
    return (
      <div aria-hidden="true" style={style}>
        {fb.label}
      </div>
    );
  }

  renderComposer() {
    const canSend = this.state.composerText.trim().length > 0 && !this.state.composerSending;
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '10px', width: '100%' }}>
        <textarea
          ref={this.composerRef}
          value={this.state.composerText}
          onChange={this.onComposerChange}
          onKeyDown={this.onComposerKeyDown}
          placeholder="Escreva sua dúvida para a IA…"
          aria-label="Mensagem para a assistente"
          enterKeyHint="send"
          rows={1}
          style={{
            flex: '1 1 0%',
            minWidth: 0,
            width: '100%',
            resize: 'none',
            border: '1.5px solid #DDE2EA',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '16px', // 16px no mobile impede auto-zoom involuntário no iOS Safari
            lineHeight: 1.4,
            fontFamily: 'inherit',
            color: '#1C2331',
            background: '#fff',
            outline: 'none',
            minHeight: '52px',
            maxHeight: '120px',
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={this.onComposerSend}
          aria-label={this.state.composerSending ? 'Aguardando a resposta da assistente' : 'Enviar mensagem'}
          disabled={!canSend}
          className="transition-colors duration-250 hover:bg-[#1A2947]"
          style={{
            width: '48px',
            height: '48px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
            border: 'none',
            background: canSend ? '#0D1F38' : '#B9C1D0',
            cursor: canSend ? 'pointer' : 'default',
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    );
  }

  renderLeadError() {
    if (!this.state.leadError) return null;
    return (
      <div
        id={LEAD_ERROR_ID}
        role="alert"
        style={{ width: '100%', maxWidth: '340px', boxSizing: 'border-box', background: '#FFF6E5', border: '1px solid #F0D49A', color: '#6B4A00', fontSize: '14px', lineHeight: 1.5, padding: '10px 12px', borderRadius: '10px', textAlign: 'center' }}
      >
        {this.state.leadError}
      </div>
    );
  }

  // As labels que abrem o seletor de arquivo também funcionam pelo teclado (Enter/Espaço).
  onFileLabelKeyDown = (e: React.KeyboardEvent<HTMLLabelElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.getElementById(OFICIO_INPUT_ID)?.click();
    }
  };

  renderFileLabel(text: string, variant: 'primary' | 'secondary') {
    return (
      <label
        htmlFor={OFICIO_INPUT_ID}
        role="button"
        tabIndex={0}
        onKeyDown={this.onFileLabelKeyDown}
        className={variant === 'primary' ? PRIMARY_HOVER : SECONDARY_HOVER}
        style={{ ...(variant === 'primary' ? PRIMARY_BTN : SECONDARY_BTN), ...LABEL_BTN_BASE }}
      >
        {text}
      </label>
    );
  }

  // Ações compactas acima do composer: o chat livre nunca vira beco sem saída.
  renderFreeChatActions() {
    return (
      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
        <button type="button" onClick={(e) => this.goToOficio('Enviar meu ofício', e)} className="transition-colors duration-250 hover:!bg-[#0D1F38] hover:!text-white" style={COMPACT_BTN}>
          {this.state.leadData.nome && this.state.leadData.celular ? 'Enviar meu ofício' : 'Começar análise'}
        </button>
        <a
          href={this.waHref('Tenho uma dúvida sobre o meu precatório.')}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => this.onWhatsappClick('chat_livre')}
          className="transition-colors duration-250 hover:!bg-[#0D1F38] hover:!text-white"
          style={COMPACT_BTN}
        >
          Falar no WhatsApp
        </a>
      </div>
    );
  }

  renderChatInput() {
    const { stage } = this.state;
    const column: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '10px' };

    if (stage === 'intro') {
      return (
        <div style={column}>
          <Button styles={WRAP_BTN_STYLES} onClick={this.onStartClick} className={PRIMARY_HOVER} style={PRIMARY_BTN}>
            Começar análise gratuita
          </Button>
          {this.renderWhatsappButton('Prefiro falar no WhatsApp', 'Prefiro falar direto com um especialista.', 'intro', 'secondary')}
        </div>
      );
    }

    if (stage === 'lead-nome' || stage === 'lead-celular') {
      const isCel = stage === 'lead-celular';
      const value = this.state.leadFieldValue;
      const hasValue = value.trim().length > 0;
      return (
        <form onSubmit={this.onLeadFieldSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
          <input
            key={stage}
            autoFocus
            type={isCel ? 'tel' : 'text'}
            name={isCel ? 'tel-national' : 'name'}
            inputMode={isCel ? 'tel' : 'text'}
            autoComplete={isCel ? 'tel-national' : 'name'}
            autoCapitalize={isCel ? 'off' : 'words'}
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={isCel ? 20 : 120}
            aria-label={isCel ? 'Seu WhatsApp com DDD' : 'Seu nome completo'}
            aria-invalid={!!this.state.leadError}
            aria-describedby={this.state.leadError ? LEAD_ERROR_ID : undefined}
            value={value}
            onChange={(e) => this.onLeadFieldChange(e.target.value)}
            placeholder={isCel ? '(00) 00000-0000' : 'Digite seu nome'}
            style={{
              width: '100%',
              maxWidth: '340px',
              minHeight: '48px',
              boxSizing: 'border-box',
              textAlign: 'center',
              border: `1.5px solid ${this.state.leadError ? '#B7791F' : '#C9D0DC'}`,
              borderRadius: '999px',
              padding: '12px 18px',
              fontSize: '16px', // >= 16px impede o zoom automático do iOS Safari
              fontWeight: 600,
              color: '#1C2331',
              background: '#fff',
              outline: 'none',
              fontFamily: isCel ? 'var(--font-roboto-mono, inherit)' : 'inherit',
            }}
          />
          {this.renderLeadError()}
          <Button
            styles={WRAP_BTN_STYLES}
            type="submit"
            disabled={!hasValue}
            className={PRIMARY_HOVER}
            style={{ ...PRIMARY_BTN, width: '100%', maxWidth: '340px', borderRadius: '999px', background: hasValue ? '#0D1F38' : '#B9C1D0', borderColor: hasValue ? '#0D1F38' : '#B9C1D0', color: '#fff' }}
          >
            Continuar
          </Button>
        </form>
      );
    }

    if (stage === 'lead-estado') {
      const selectedUf = this.state.leadFieldValue;
      const tooltipOpen = this.state.leadTooltipOpen;
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedUf) this.onSelectEstado(selectedUf);
          }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}
        >
          {/* Explicação em fluxo (não flutuante): nunca vaza da tela em 320px. Abre/fecha só no toque. */}
          <div ref={this.tooltipWrapRef} style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
              <label htmlFor={UF_SELECT_ID} style={{ fontSize: '14px', color: '#3B4457', fontWeight: 700 }}>
                Estado do processo
              </label>
              <button
                type="button"
                onClick={() => this.setState((s) => ({ leadTooltipOpen: !s.leadTooltipOpen }))}
                aria-label="O que é o estado do processo?"
                aria-expanded={tooltipOpen}
                aria-controls={UF_TOOLTIP_ID}
                style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }}
              >
                <span
                  aria-hidden="true"
                  style={{ display: 'block', width: '22px', height: '22px', boxSizing: 'border-box', borderRadius: '50%', border: '1.5px solid #5B6478', color: '#3B4457', fontSize: '13px', fontWeight: 800, lineHeight: '19px', textAlign: 'center', background: tooltipOpen ? '#E3E7EE' : 'transparent' }}
                >
                  ?
                </span>
              </button>
            </div>
            {tooltipOpen && (
              <div
                id={UF_TOOLTIP_ID}
                role="note"
                style={{ width: '100%', boxSizing: 'border-box', background: '#0B1B33', color: '#F7F5F1', fontSize: '14px', lineHeight: 1.5, padding: '10px 14px', borderRadius: '12px', marginBottom: '4px', textAlign: 'center', overflowWrap: 'anywhere' }}
              >
                {LEAD_TOOLTIP}
              </div>
            )}
          </div>

          <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
            <select
              id={UF_SELECT_ID}
              name="estado"
              value={selectedUf}
              aria-invalid={!!this.state.leadError}
              aria-describedby={this.state.leadError ? LEAD_ERROR_ID : undefined}
              onChange={(e) => this.setState({ leadFieldValue: e.target.value, leadError: '' })}
              style={{
                width: '100%',
                minHeight: '48px',
                boxSizing: 'border-box',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                border: '1.5px solid #C9D0DC',
                borderRadius: '999px',
                padding: '12px 44px 12px 20px',
                fontSize: '16px', // >= 16px impede o zoom automático do iOS Safari
                fontWeight: 600,
                fontFamily: 'inherit',
                color: selectedUf ? '#1C2331' : '#5B6478',
                background: '#fff',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="" disabled>
                Toque para escolher o estado
              </option>
              {ESTADOS_BR_LIST.map((est) => (
                <option key={est.uf} value={est.uf} style={{ color: '#1C2331' }}>
                  {est.nome}
                </option>
              ))}
            </select>
            <div aria-hidden="true" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#3B4457' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          {this.renderLeadError()}

          <Button
            styles={WRAP_BTN_STYLES}
            type="submit"
            disabled={!selectedUf}
            className={PRIMARY_HOVER}
            style={{
              ...PRIMARY_BTN,
              width: '100%',
              maxWidth: '340px',
              marginTop: '2px',
              borderRadius: '999px',
              background: selectedUf ? '#0D1F38' : '#B9C1D0',
              borderColor: selectedUf ? '#0D1F38' : '#B9C1D0',
              color: '#fff',
              cursor: selectedUf ? 'pointer' : 'default',
            }}
          >
            Continuar
          </Button>
        </form>
      );
    }

    if (stage === 'upload') {
      return (
        <div style={column}>
          <label
            ref={this.dropzoneRef}
            htmlFor={OFICIO_INPUT_ID}
            role="button"
            tabIndex={0}
            onKeyDown={this.onFileLabelKeyDown}
            style={{ display: 'block', minHeight: '48px', border: '1.5px dashed #5FA97F', borderRadius: '14px', padding: '14px 16px', textAlign: 'center', cursor: 'pointer', background: '#E9F6EF' }}
          >
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#1C2331' }}>Enviar ofício (PDF ou foto)</div>
            <div style={{ fontSize: '13.5px', color: '#3B4457', marginTop: '3px', lineHeight: 1.45 }}>Toque para escolher o arquivo ou tirar a foto do documento · PDF até 4 MB</div>
          </label>
          <Button styles={WRAP_BTN_STYLES} onClick={this.onNoOficio} className={SECONDARY_HOVER} style={SECONDARY_BTN}>
            Não tenho o ofício agora
          </Button>
        </div>
      );
    }

    if (stage === 'analyzing') {
      return (
        <div role="status" style={{ textAlign: 'center', fontSize: '14px', fontWeight: 700, color: '#3B4457', padding: '12px 0' }}>
          Lendo seu ofício… aguarde alguns segundos.
        </div>
      );
    }

    if (stage === 'confirm') {
      return (
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button styles={WRAP_BTN_STYLES} onClick={this.onCorrigirDados} className={SECONDARY_HOVER} style={{ ...SECONDARY_BTN, flex: 1, padding: '12px' }}>
            Corrigir dados
          </Button>
          <Button styles={WRAP_BTN_STYLES} onClick={this.onConfirmarDados} className={PRIMARY_HOVER} style={{ ...PRIMARY_BTN, flex: 1, padding: '12px' }}>
            Sim, conferem
          </Button>
        </div>
      );
    }

    if (stage === 'upload-error') {
      return (
        <div style={column}>
          {this.renderFileLabel('Tentar outro arquivo', 'primary')}
          {this.renderWhatsappButton('Enviar pelo WhatsApp', 'Quero enviar meu ofício por aqui.', 'oficio_falha', 'secondary')}
        </div>
      );
    }

    if (stage === 'no-oficio') {
      return (
        <div style={column}>
          {this.renderWhatsappButton('Falar com um especialista no WhatsApp', 'Não tenho o ofício em mãos e preciso de ajuda para localizá-lo.', 'sem_oficio')}
          {this.renderFileLabel('Encontrei, enviar o ofício', 'secondary')}
        </div>
      );
    }

    if (stage === 'confirmed') {
      return (
        <div style={column}>
          {this.renderWhatsappButton('Adiantar pelo WhatsApp', 'Já enviei meu ofício pelo site.', 'dados_confirmados')}
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button styles={WRAP_BTN_STYLES} onClick={this.onCorrigirNumero} className={SECONDARY_HOVER} style={{ ...SECONDARY_BTN, flex: 1, padding: '12px' }}>
              Corrigir meu número
            </Button>
            <Button styles={WRAP_BTN_STYLES} onClick={this.onTenhoDuvida} className={SECONDARY_HOVER} style={{ ...SECONDARY_BTN, flex: 1, padding: '12px' }}>
              Tenho uma dúvida
            </Button>
          </div>
        </div>
      );
    }

    if (stage === 'saving') {
      return (
        <div role="status" style={{ textAlign: 'center', fontSize: '14px', fontWeight: 700, color: '#3B4457', padding: '12px 0' }}>
          Registrando seus dados…
        </div>
      );
    }

    if (stage === 'confirm-failed') {
      return (
        <div style={column}>
          {this.renderWhatsappButton('Falar com um especialista no WhatsApp', 'Já enviei meu ofício pelo site, mas o registro do contato falhou.', 'registro_falhou')}
          <Button styles={WRAP_BTN_STYLES} onClick={(e) => this.onRetryConfirm(e)} className={SECONDARY_HOVER} style={SECONDARY_BTN}>
            Tentar registrar de novo
          </Button>
        </div>
      );
    }

    if (stage === 'revision') {
      return (
        <div style={column}>
          {this.renderFileLabel('Enviar outro arquivo', 'primary')}
          {this.renderWhatsappButton('Falar no WhatsApp', 'Pedi revisão dos dados do meu ofício.', 'revisao', 'secondary')}
        </div>
      );
    }

    if (stage === 'free-chat') {
      return this.renderFreeChatActions();
    }

    return null;
  }


  // Barra fixa do celular: some com o chat na tela ou em tela cheia (não cobre o campo de digitação).
  renderMobileBar() {
    const hidden = this.state.iaVisible || this.state.fullscreenMobile;
    return (
      <div
        aria-hidden={hidden || undefined}
        className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-[#16233F] bg-navy px-3 pt-2.5 shadow-[0_-8px_24px_rgba(11,27,51,0.25)] transition-[transform,visibility] duration-250 sm:hidden"
        style={{
          paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))',
          transform: hidden ? 'translateY(110%)' : 'translateY(0)',
          visibility: hidden ? 'hidden' : 'visible',
        }}
      >
        <button
          type="button"
          onClick={() => this.openChat('barra_mobile')}
          className="flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-xl border-0 bg-white px-3 py-2 text-center text-[15px] font-extrabold leading-tight text-navy"
        >
          Analisar meu precatório
        </button>
        <a
          href={this.waHref('Vim pela barra do site.')}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => this.onWhatsappClick('barra_mobile')}
          aria-label="Falar no WhatsApp"
          className="flex min-h-[48px] flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border-0 bg-[#0E7A3E] px-3.5 py-2 text-[15px] font-bold text-white no-underline"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          WhatsApp
        </a>
      </div>
    );
  }

  render() {
    const { stage, leadData, fullscreenMobile } = this.state;
    const currentStepIdx =
      stage === 'free-chat'
        ? this.state.oficioConfirmado
          ? 3
          : leadData.nome && leadData.celular && leadData.estado
            ? 1
            : 0
        : STAGE_STEP[stage] ?? 0;

    // Sem 'relative z-10' na section: o contexto de empilhamento prendia a barra fixa e a
    // tela cheia abaixo do botão de play e do selo do SocialProof.
    return (
      <section ref={this.sectionRef} id="ia" data-screen-label="Chatbox IA" className="bg-mist px-3.5 pt-8 pb-14 sm:px-8 sm:pt-16 sm:pb-20 md:px-16 md:pt-20 md:pb-24">
        {this.renderMobileBar()}
        {/* Input de arquivo único, acionado por <label htmlFor> (dropzone e botões de reenvio). */}
        <input
          id={OFICIO_INPUT_ID}
          type="file"
          accept="application/pdf,image/*"
          onChange={this.onFileSelected}
          style={{ display: 'none' }}
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-start justify-center gap-6 lg:gap-10 lg:justify-start">
          {/* LEFT: progress */}
          <div className="hidden w-full min-w-[260px] max-w-[320px] flex-[1_1_260px] flex-col self-stretch sm:flex">
            <div className="flex h-full flex-col rounded-[20px] border border-[#EAEDF2] bg-[#EEF0F3] p-6 shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]">
              <div className="mb-4.5 text-center text-[13px] font-extrabold uppercase tracking-[0.05em] text-[#5B6478]">Progresso da análise</div>
              <ol className="m-0 flex flex-1 list-none flex-col p-0 py-1">
                {ANALYSIS_STEPS.map((step, i) => {
                  const isLast = i === ANALYSIS_STEPS.length - 1;
                  const isDone = i <= currentStepIdx;
                  return (
                    <li key={step.title} aria-current={i === currentStepIdx ? 'step' : undefined} className={`relative ${isLast ? '' : 'flex-1 pb-5'}`}>
                      {!isLast && <div className="pointer-events-none absolute bottom-0 left-[13px] top-[32px] w-[2px] bg-[#DDE2EA]" />}
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold" style={{ background: isDone ? '#0D1F38' : '#EEF0F3', color: isDone ? '#fff' : '#0B1B33', border: isDone ? 'none' : '1.5px solid #0B1B33' }}>
                          {i + 1}
                        </div>
                        <span className="text-[14px] font-bold text-navy">{step.title}</span>
                      </div>
                      <p className="mb-0 mt-2 pl-10 text-[13px] leading-[1.6]" style={{ color: isDone ? '#2B3346' : '#5B6478' }}>
                        {step.desc}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* CENTER: chat */}
          <div className="w-full min-w-0 max-w-[760px] flex-[2_1_400px]">
            <div
              ref={this.shellRef}
              role={fullscreenMobile ? 'dialog' : undefined}
              aria-modal={fullscreenMobile || undefined}
              aria-label={fullscreenMobile ? 'Conversa com a assistente Premium Office' : undefined}
              className={
                fullscreenMobile
                  ? 'fixed inset-0 z-40 flex flex-col overflow-hidden rounded-none border-0 bg-white sm:static sm:z-auto sm:flex-none sm:rounded-3xl sm:border sm:border-[#EAEDF2] sm:shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]'
                  : 'overflow-hidden rounded-3xl border border-[#EAEDF2] bg-white shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]'
              }
              style={fullscreenMobile ? { height: '100dvh' } : undefined}
            >
              <div
                className="flex flex-shrink-0 items-center gap-2 border-b border-[#16233F] bg-navy py-2.5 pl-4 pr-2.5 sm:px-5 sm:py-4"
                style={fullscreenMobile ? { paddingTop: 'calc(0.625rem + env(safe-area-inset-top))' } : undefined}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-navy-accent text-xs font-extrabold text-white" aria-hidden="true">
                  IA
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-extrabold text-white">Assistente Premium Office</div>
                  <div className="truncate text-[13px] text-[#AEB8CB]">Análise de precatórios · online</div>
                </div>
                {stage !== 'intro' && (
                  <button
                    type="button"
                    onClick={this.onRestartFull}
                    aria-label="Recomeçar a conversa"
                    className="flex h-11 min-w-[44px] flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-[13px] font-bold text-[#C7CFDE] transition-colors duration-200 hover:bg-[#16233F] hover:text-white"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    <span>Recomeçar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={fullscreenMobile ? this.closeFullscreen : this.openFullscreen}
                  aria-label={fullscreenMobile ? 'Fechar a tela cheia do chat' : 'Abrir o chat em tela cheia'}
                  className="flex h-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/30 bg-transparent px-3 text-[14px] font-bold text-white transition-colors duration-200 hover:bg-[#16233F] sm:hidden"
                >
                  {fullscreenMobile ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m11-5v3a2 2 0 0 1-2 2h-3" />
                    </svg>
                  )}
                  {fullscreenMobile ? 'Fechar' : 'Tela cheia'}
                </button>
              </div>

              <div
                ref={this.chatRef}
                onScroll={this.onChatScroll}
                data-chat-scroll
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                aria-label="Mensagens da conversa"
                className={
                  fullscreenMobile
                    ? 'relative flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-[#EEF0F3] p-3.5 sm:p-6'
                    : 'relative flex h-[calc(100svh-240px)] max-h-[560px] min-h-[320px] flex-col gap-3.5 overflow-y-auto bg-[#EEF0F3] p-3.5 sm:h-[600px] sm:max-h-none sm:min-h-0 sm:p-6'
                }
                style={fullscreenMobile ? { scrollbarWidth: 'none', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } : { scrollbarWidth: 'none' }}
              >
                {/* Marca d'água só a partir de 640px: no celular o arquivo nem é baixado. */}
                <picture className="contents">
                  <source media="(min-width: 640px)" srcSet="/chat-watermark.png" />
                  <img
                    src={BLANK_GIF}
                    alt=""
                    aria-hidden="true"
                    width={500}
                    height={500}
                    loading="lazy"
                    decoding="async"
                    className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden h-auto w-[65%] max-w-[260px] -translate-x-1/2 -translate-y-1/2 opacity-50 sm:block"
                  />
                </picture>
                {this.renderFlyingBubble()}
                <MessageList messages={this.state.messages} />
              </div>

              <div
                className="flex-shrink-0 border-t border-[#EAEDF2] bg-[#EEF0F3] px-3.5 py-3 sm:px-5 sm:py-4.5"
                style={fullscreenMobile ? { paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' } : undefined}
              >
                {this.renderChatInput()}
                {COMPOSER_STAGES.includes(stage) && this.renderComposer()}
              </div>
            </div>
          </div>

          {/* RIGHT: promotional banner & how-it-works panel (sem valores de exemplo) — só desktop (lg) */}
          <div className="hidden min-w-[280px] max-w-[360px] flex-[1.2_1_280px] self-stretch lg:flex flex-col items-center justify-start gap-6">
            <picture className="block w-full">
              <source media="(min-width: 1024px)" srcSet="/side_banner.png" />
              <img
                src={BLANK_GIF}
                alt="Antecipe hoje seu precatório — receba sua proposta 100% online e segura"
                width={563}
                height={756}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full rounded-[20px] object-cover shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]"
              />
            </picture>

            <div className="w-full rounded-[20px] border border-navy-border bg-navy-panel p-5 shadow-[0_32px_70px_-12px_rgba(11,27,51,0.35),0_12px_24px_rgba(11,27,51,0.12)]">
              <div className="mb-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#AEB8CB]">
                O que a IA lê no seu ofício
              </div>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {['Credor e número do processo', 'Tribunal e ente devedor', 'Natureza do crédito', 'Valor requisitado e data-base'].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-[1.5] text-[#C7CFDE]">
                    <span className="mt-[1px] text-sky" aria-hidden="true">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mb-0 mt-4 text-[13px] leading-[1.55] text-[#AEB8CB]">
                Você confere os dados e um especialista da Premium Office prepara a proposta sobre o valor líquido, após os descontos legais. Sem custo e sem compromisso.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }
}
