# Premium Office Precatório — Next.js + Tailwind

This is a recreation of the "Premium Office Precatório" landing page (hero, AI chat
widget flow, quick calculator, testimonials, FAQ, footer) as a real **Next.js 16
(App Router)** project on **React 19**, styled with **Tailwind CSS** for layout/utility
classes (sem biblioteca de componentes: FAQ em <details> nativo, botões do chat em CSS próprio).

## Requirements

- Node.js 20.9+ (Next.js 16 requirement)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Project structure

```
app/
  layout.tsx        Font + metadata + GTM (GTM-TXLRT64T)
  globals.css        Tailwind directives + reset enxuto + botão do chat (.po-btn)
  page.tsx           Assembles the page from the components below
components/
  Hero.tsx           Top hero section with headline + CTA + example card
  ChatSection.tsx     Testimonials carousel + full AI chat flow + quick calculator
  ComoFunciona.tsx    "Como funciona" persuasive copy block
  Faq.tsx             FAQ (<details> nativo, server component)
  Footer.tsx
lib/
  data.ts             FAQ (também alimenta o JSON-LD)
  beams.js            Guard + montagem sob demanda do fundo animado
  beams-gl.js         Efeito WebGL (three, imports nomeados); só baixado em desktop capaz
public/
  logo-white.png      Brand logo (white version, for dark backgrounds)
```

## Tailwind

O `preflight` do Tailwind está desligado em `tailwind.config.ts`; o reset enxuto (box-sizing,
fonte herdada nos controles, tipografia base do body) fica em `app/globals.css`.

## Behavior notes vs. the original HTML prototype

The whole prototype is ported 1:1 — layout, flow, animations and math:

- **Hero background beams**: the animated WebGL beam field (`lib/beams.js`,
  built on `three`) is mounted onto a `<canvas>` in `Hero.tsx` via a client-side
  dynamic import, exactly as the prototype (`lightColor #0D1F38`,
  `backgroundColor #0B1B33`, `diffuseColor #050B16`).
- **Flying message bubble**: each user choice literally "flies" from the clicked
  button into the chat log before landing as a bubble — the same
  pixel-measured transition (`flyBubble`) as the prototype.
- **AI text "typewriter" reveal**: each AI message reveals character-by-character
  via `requestAnimationFrame` (~14 chars/ms), with the blur/translate settle.
- **"Digitando…" indicator**: AI typing dots (`blink` keyframe) show while the
  analysis / calculation timers run.
- **Chat flow**: qualify → upload → extract card → confirm → calc card →
  decision (accept / consultant / revision / other) → documents → schedule →
  done, plus the correct WhatsApp hand-offs. Uses `MOCK_DOC` +
  `calcularAntecipacao`.
- **"Análise Rápida" tab**: upload/example → spinner → auto result with extracted
  data, plain-language summary, credit-composition bar, and the indicative
  proposal card with an animated fill bar. Runs the full IR/RRA + net-available
  math (`analisarOficio(DEMO_OFICIO)` in `lib/data.ts`).
- **Testimonials carousel**: autoplays every 5s and resets its timer on manual
  navigation.
- **File upload**: the file input reads the filename only; no file is actually
  uploaded/parsed. Hook up real document parsing/OCR here.
- **WhatsApp links**: hardcoded to the prototype's number — update `waNumber`
  in `ChatSection.tsx` and `Footer.tsx`.

## Design tokens

Custom Tailwind colors (see `tailwind.config.ts`) mirror the source palette:

- `navy` `#0B1B33` — primary dark background
- `navy-panel` `#101E38`, `navy-card` `#16233F`, `navy-accent` `#0D1F38`,
  `navy-border` `#223255` — dark-surface variants
- `ink` `#1C2331` — default body text
- `mist` `#E9EBEF`, `cloud` `#EEF0F3` — light section backgrounds
- `sky` `#8FB4EA` — accent blue used on dark backgrounds

Font: Inter (400/500/600/700/800), loaded via `next/font/google`.

## Next steps

- Replace the mock document extraction / calculation with real backend calls.
- Add analytics + form validation before going to production.
- Consider `next/image` instead of `<img>` for the logo once final hosting is set.
# precatorio-lp-com-chatbot

## Integrações e variáveis de ambiente

O projeto é autônomo: não usa banco de dados próprio nem compartilha recursos com outros
sistemas. Os dados captados no chat vão direto para o Bitrix24 (Contato + Negócio, ofício
anexado na timeline), por rotas de servidor. O vínculo sessão -> Negócio fica no próprio
Bitrix (`ORIGINATOR_ID=lp-chatbot`, `ORIGIN_ID=<id da sessão>`).

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `OPENAI_API_KEY` | sim | Chat e leitura do ofício |
| `BITRIX_WEBHOOK_URL` | sim | Webhook de entrada do Bitrix24 (`https://<portal>/rest/<user>/<token>`). Sem ela `/api/lead` responde 503 |
| `BITRIX_DEAL_CATEGORY_ID` | não | Funil do Negócio (padrão `534`) |
| `BITRIX_DEAL_STAGE_ID` | não | Etapa inicial (padrão `C534:NEW`) |
| `BITRIX_ASSIGNED_BY_ID` | não | Responsável do Negócio (padrão `178968`) |
| `NEXT_PUBLIC_GTM_ID` | não | Google Tag Manager |
| `LEMIT_API_URL` | não | Consulta Lemit por CPF (`https://api.lemit.com.br/api/v1/consulta/pessoa/{cpf}`). Sem ela, o enriquecimento Lemit fica desligado |
| `LEMIT_API_TOKEN` | não | Token da conta Lemit (somente servidor) |
| `LEMIT_AUTH_HEADER` | não | Cabeçalho do token (padrão `Authorization`, enviado como `Bearer`) |
| `AGENTE_MODEL` | não | Modelo da secretária digital em `/chat` (padrão `gpt-4o-mini`) |

Limitações conhecidas: sem fila de retry (falha no Bitrix é devolvida ao frontend, que tenta
mais uma vez, mas o envio do ofício em segundo plano não é reprocessado) e a proteção contra
Negócio duplicado vale por instância da função.
