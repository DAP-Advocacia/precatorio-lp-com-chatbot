// Gráficos explicativos dos artigos. Server components: markup + Tailwind, sem JS no cliente.
// Cada gráfico é um <figure> com resumo textual (sr-only) para leitores de tela.

function Figure({
  titulo,
  legenda,
  resumoSr,
  children,
}: {
  titulo: string;
  legenda: string;
  resumoSr: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-8 overflow-hidden rounded-2xl border border-navy-border bg-navy-accent p-5 shadow-[0_8px_20px_rgba(5,11,22,0.25)] sm:p-7">
      <figcaption className="mb-5">
        <div className="text-[15px] font-extrabold leading-snug text-white sm:text-base">{titulo}</div>
        <div className="mt-1 text-[13px] leading-[1.5] text-[#9AA6BC]">{legenda}</div>
      </figcaption>
      <p className="sr-only">{resumoSr}</p>
      <div aria-hidden="true">{children}</div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* 1) Fluxo em 5 passos                                                */
/* ------------------------------------------------------------------ */

const PASSOS = [
  {
    n: 1,
    ator: 'Você',
    titulo: 'Reúna o ofício',
    desc: 'O ofício requisitório traz credor, processo, tribunal e valor.',
  },
  {
    n: 2,
    ator: 'IA',
    titulo: 'Envie para análise',
    desc: 'PDF ou foto legível. A IA lê os dados principais.',
  },
  {
    n: 3,
    ator: 'Especialista',
    titulo: 'Receba a proposta',
    desc: 'Calculada sobre o valor líquido, depois dos descontos legais.',
  },
  {
    n: 4,
    ator: 'Você decide',
    titulo: 'Aceite ou não',
    desc: 'Análise e proposta gratuitas e sem compromisso.',
  },
  {
    n: 5,
    ator: 'Formalização',
    titulo: 'Contrato e pagamento',
    desc: 'Validação documental e jurídica, cessão e comunicação ao tribunal.',
  },
];

export function FluxoPassos() {
  return (
    <Figure
      titulo="Fluxo da antecipação, do ofício à formalização"
      legenda="Os 5 passos de quem antecipa um precatório pela cessão de crédito."
      resumoSr={`Fluxo em 5 passos: ${PASSOS.map((p) => `${p.n}. ${p.titulo}`).join('; ')}.`}
    >
      <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-5 md:gap-2.5">
        {PASSOS.map((p, i) => {
          const ultimo = i === PASSOS.length - 1;
          return (
            <li
              key={p.n}
              className={`relative flex gap-3.5 rounded-xl p-4 md:flex-col md:gap-0 ${
                ultimo
                  ? 'border border-[#DAA520]/60 bg-[#DAA520]/10'
                  : 'border border-navy-border bg-[#0E182A]/90'
              }`}
            >
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold md:mb-3 ${
                  ultimo ? 'bg-[#DAA520] text-navy' : 'bg-[#1677FF] text-white'
                }`}
              >
                {p.n}
              </span>
              <div className="min-w-0">
                <div className={`mb-1 text-[11px] font-bold uppercase tracking-[0.06em] ${ultimo ? 'text-[#F5DD90]' : 'text-sky'}`}>
                  {p.ator}
                </div>
                <div className="mb-1 text-[15px] font-extrabold leading-snug text-white">{p.titulo}</div>
                <div className="text-[13px] leading-[1.5] text-[#9AA6BC]">{p.desc}</div>
              </div>
              {!ultimo && (
                <span
                  className="absolute -right-[11px] top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-sky md:flex"
                  aria-hidden="true"
                >
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Figure>
  );
}

/* ------------------------------------------------------------------ */
/* 2) Esperar na fila x antecipar                                      */
/* ------------------------------------------------------------------ */

function Raia({
  titulo,
  destaque,
  nos,
  nota,
}: {
  titulo: string;
  destaque?: boolean;
  nos: string[];
  nota: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${destaque ? 'border-[#DAA520]/60 bg-[#DAA520]/10' : 'border-navy-border bg-[#0E182A]/90'}`}>
      <div className={`mb-3 text-[13px] font-extrabold uppercase tracking-[0.06em] ${destaque ? 'text-[#F5DD90]' : 'text-sky'}`}>
        {titulo}
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0 md:flex-row md:items-stretch md:gap-1.5">
        {nos.map((no, i) => (
          <li key={no} className="flex items-center gap-1.5 md:flex-1">
            <div
              className={`flex min-h-[56px] flex-1 items-center rounded-lg px-3 py-2 text-[13px] font-semibold leading-snug text-white ${
                i === nos.length - 1
                  ? destaque
                    ? 'border border-[#DAA520] bg-[#DAA520]/20'
                    : 'border border-dashed border-sky/60 bg-white/5'
                  : 'bg-white/5'
              }`}
            >
              {no}
            </div>
            {i < nos.length - 1 && (
              <span className="flex-shrink-0 text-sm font-bold text-sky md:inline" aria-hidden="true">
                <span className="md:hidden">↓</span>
                <span className="hidden md:inline">→</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="m-0 mt-3 text-[12.5px] leading-[1.5] text-[#9AA6BC]">{nota}</p>
    </div>
  );
}

export function EsperarVsAntecipar() {
  return (
    <Figure
      titulo="Esperar na fila ou antecipar"
      legenda="Comparação conceitual dos dois caminhos. Os prazos variam por tribunal e ente devedor."
      resumoSr="Esperar na fila: ofício expedido, inclusão no orçamento do ente devedor, fila de pagamento por ordem cronológica e pagamento pelo ente, em prazo que varia. Antecipar pela cessão: ofício expedido, análise e proposta, cessão formalizada e recebimento do valor da cessão."
    >
      <div className="flex flex-col gap-4">
        <Raia
          titulo="Esperar na fila de pagamento"
          nos={[
            'Ofício expedido pelo tribunal',
            'Inclusão no orçamento do ente devedor',
            'Fila por ordem cronológica',
            'Pagamento pelo ente (prazo varia)',
          ]}
          nota="Você recebe o valor integral do crédito, mas só quando o ente devedor pagar."
        />
        <Raia
          destaque
          titulo="Antecipar pela cessão de crédito"
          nos={[
            'Ofício expedido pelo tribunal',
            'Análise e proposta',
            'Cessão formalizada e comunicada ao tribunal',
            'Você recebe o valor da cessão',
          ]}
          nota="Você recebe antes, por um valor menor que o do crédito. Quem adquire passa a aguardar o pagamento do ente."
        />
      </div>
    </Figure>
  );
}

/* ------------------------------------------------------------------ */
/* 3) Valor bruto -> líquido cedível -> proposta                       */
/* ------------------------------------------------------------------ */

// Proporções ilustrativas (não são valores reais).
const DESCONTOS = [
  { nome: 'Honorários contratuais', w: 18, cor: '#3B4A66' },
  { nome: 'Previdência (PSS)', w: 7, cor: '#4C5F82' },
  { nome: 'IR / RRA', w: 10, cor: '#62779E' },
  { nome: 'Outros descontos', w: 5, cor: '#7C90B6' },
];
const LIQUIDO_W = 100 - DESCONTOS.reduce((s, d) => s + d.w, 0);
const PROPOSTA_W = 46;

export function BrutoLiquidoProposta() {
  const inicioLiquido = 100 - LIQUIDO_W;
  return (
    <Figure
      titulo="Do valor bruto à proposta"
      legenda="Ilustração conceitual: as proporções não representam valores reais nem uma proposta."
      resumoSr="O valor bruto do ofício é reduzido pelos descontos legais (honorários contratuais, previdência, Imposto de Renda ou RRA e outros), o que resulta no líquido cedível. A proposta é calculada sobre o líquido cedível e é menor que ele, porque o pagamento é antecipado."
    >
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 text-[13px] font-bold text-white">1. Valor bruto do ofício</div>
          <div className="flex h-11 w-full overflow-hidden rounded-lg">
            {DESCONTOS.map((d) => (
              <div key={d.nome} style={{ width: `${d.w}%`, background: d.cor }} />
            ))}
            <div className="flex items-center justify-center bg-[#1677FF] px-1 text-[12px] font-extrabold text-white" style={{ width: `${LIQUIDO_W}%` }}>
              Líquido cedível
            </div>
          </div>
          <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0">
            {DESCONTOS.map((d) => (
              <li key={d.nome} className="flex items-center gap-1.5 text-[12.5px] text-[#C7CFDE]">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.cor }} />
                {d.nome}
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-[12.5px] font-bold text-white">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#1677FF]" />
              Líquido cedível
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-bold text-white">2. A proposta é calculada sobre o líquido</div>
          <div className="relative h-11 w-full">
            <div className="absolute inset-y-0 rounded-lg border border-dashed border-sky/50" style={{ left: `${inicioLiquido}%`, width: `${LIQUIDO_W}%` }} />
            <div
              className="absolute inset-y-0 flex items-center justify-center rounded-lg bg-[#DAA520] px-2 text-[12px] font-extrabold text-navy"
              style={{ left: `${inicioLiquido}%`, width: `${PROPOSTA_W}%` }}
            >
              Proposta
            </div>
          </div>
          <p className="m-0 mt-2.5 text-[12.5px] leading-[1.55] text-[#9AA6BC]">
            A faixa tracejada é o líquido cedível. A proposta fica abaixo dele porque você recebe antes do
            pagamento pelo ente devedor.
          </p>
        </div>
      </div>
    </Figure>
  );
}
