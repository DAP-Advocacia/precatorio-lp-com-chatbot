import SpotlightCard from '@/components/SpotlightCard';

const MOTIVOS = [
  {
    title: 'Entenda suas opções',
    description: 'Veja uma estimativa antes de decidir entre esperar ou negociar seu crédito.',
  },
  {
    title: 'Tenha clareza sobre valores',
    description: 'Saiba qual faixa pode ser considerada para o seu precatório antes de avançar.',
  },
  {
    title: 'Decida sem compromisso',
    description: 'A análise não obriga você a realizar a cessão.',
  },
];

export default function PorQueAnalisar() {
  return (
    <section
      data-screen-label="Por que analisar"
      className="relative bg-mist px-5 py-14 sm:px-8 sm:py-20 md:px-16"
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-10 text-center">
          <h2 className="mb-2.5 text-[clamp(24px,3vw,34px)] font-extrabold tracking-[-0.01em] text-ink">
            Por que analisar seu precatório agora?
          </h2>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
          {MOTIVOS.map((m) => (
            <SpotlightCard
              key={m.title}
              className="rounded-[20px] border border-[#E5E7EB] bg-white p-7 shadow-[0_4px_16px_rgba(13,31,56,0.05)] hover:border-[#8FB4EA] hover:shadow-[0_12px_32px_rgba(13,31,56,0.12)]"
            >
              <h4 className="mb-2 text-[17px] font-extrabold text-ink">{m.title} »</h4>
              <p className="text-sm leading-[1.55] text-[#5B6472]">{m.description}</p>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}
