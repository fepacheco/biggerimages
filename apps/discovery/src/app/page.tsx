import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm uppercase tracking-widest text-[var(--color-muted)]">
        fe-lab · discovery
      </p>
      <h1 className="mt-4 font-display text-5xl leading-tight">
        Onde dá pra automatizar no seu negócio?
      </h1>
      <p className="mt-6 text-lg text-[var(--color-ink-2)]">
        Uma conversa guiada por IA. A gente faz perguntas (algumas abertas, outras
        de múltipla escolha), você responde no seu tempo, e no final entrega:
      </p>
      <ul className="mt-4 space-y-2 text-[var(--color-ink-2)]">
        <li>— um mapa dos processos do seu negócio com pontos de dor;</li>
        <li>— uma lista priorizada de oportunidades de automação;</li>
        <li>— mini-PRDs prontos pras 3-5 oportunidades de maior impacto.</li>
      </ul>
      <div className="mt-10">
        <Link
          href="/new"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-white font-medium hover:opacity-90 transition"
        >
          Começar uma entrevista →
        </Link>
      </div>
      <p className="mt-12 text-sm text-[var(--color-muted)]">
        Leva uns 15-25 minutos. Você pode fechar a aba e voltar pelo mesmo link
        depois.
      </p>
    </main>
  );
}
