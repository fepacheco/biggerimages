import type { Effort, Impact, ReportOutputs } from "@/lib/types";

const IMPACT_LABEL: Record<Impact, string> = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
};
const EFFORT_LABEL: Record<Effort, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

export default function Report({
  outputs,
  businessName,
}: {
  outputs: ReportOutputs;
  businessName: string | null;
}) {
  const ordered = [...outputs.opportunities].sort(
    (a, b) => b.priority_score - a.priority_score,
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-16">
      <header>
        <p className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
          Relatório
        </p>
        <h1 className="font-display text-4xl mt-2">
          {businessName ?? "Mapa de automações"}
        </h1>
        <p className="mt-4 text-lg text-[var(--color-ink-2)] leading-relaxed">
          {outputs.summary}
        </p>
      </header>

      <section>
        <h2 className="font-display text-2xl mb-6">Mapa de processos</h2>
        <div className="space-y-8">
          {outputs.process_map.areas.map((area) => (
            <div key={area.name}>
              <h3 className="text-sm uppercase tracking-wider text-[var(--color-accent)] mb-3">
                {area.name}
              </h3>
              <div className="space-y-4">
                {area.processes.map((proc) => (
                  <div
                    key={proc.name}
                    className="rounded-xl bg-white border border-[var(--color-border)] px-5 py-4"
                  >
                    <p className="font-medium">{proc.name}</p>
                    <p className="text-sm text-[var(--color-ink-2)] mt-1">
                      {proc.description}
                    </p>
                    {proc.pain_points.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {proc.pain_points.map((pp, i) => (
                          <li
                            key={i}
                            className="text-sm text-[var(--color-ink-2)] before:content-['—'] before:mr-2 before:text-[var(--color-accent)]"
                          >
                            {pp}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-6">
          Oportunidades priorizadas
        </h2>
        <div className="space-y-4">
          {ordered.map((opp, i) => (
            <div
              key={opp.title}
              className="rounded-xl bg-white border border-[var(--color-border)] px-5 py-4"
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-medium">
                  <span className="text-[var(--color-muted)] mr-2">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {opp.title}
                </p>
                <span className="text-sm text-[var(--color-accent)] font-medium">
                  {opp.priority_score.toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-[var(--color-ink-2)] mt-2">
                <strong className="font-medium">Problema: </strong>
                {opp.problem}
              </p>
              <p className="text-sm text-[var(--color-ink-2)] mt-1">
                <strong className="font-medium">Solução: </strong>
                {opp.proposed_solution}
              </p>
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5">
                  Impacto: {IMPACT_LABEL[opp.impact]}
                </span>
                <span className="rounded-full bg-[var(--color-bg-2)] px-2 py-0.5">
                  Esforço: {EFFORT_LABEL[opp.effort]}
                </span>
                {opp.suggested_tools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-full border border-[var(--color-border)] px-2 py-0.5"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-6">
          Mini-PRDs ({outputs.mini_prds.length})
        </h2>
        <div className="space-y-8">
          {outputs.mini_prds.map((prd) => (
            <article
              key={prd.opportunity_title}
              className="rounded-xl bg-white border border-[var(--color-border)] px-6 py-5"
            >
              <h3 className="font-display text-xl">{prd.opportunity_title}</h3>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-[var(--color-ink)]">
                    Problema
                  </dt>
                  <dd className="text-[var(--color-ink-2)] mt-1">
                    {prd.problem}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--color-ink)]">
                    Proposta
                  </dt>
                  <dd className="text-[var(--color-ink-2)] mt-1">
                    {prd.proposal}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--color-ink)]">Fluxo</dt>
                  <dd className="mt-1">
                    <ol className="list-decimal list-inside space-y-1 text-[var(--color-ink-2)]">
                      {prd.flow.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--color-ink)]">
                    Integrações
                  </dt>
                  <dd className="text-[var(--color-ink-2)] mt-1">
                    {prd.integrations.join(" · ")}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--color-ink)]">
                    KPI de sucesso
                  </dt>
                  <dd className="text-[var(--color-ink-2)] mt-1">
                    {prd.success_kpi}
                  </dd>
                </div>
                {prd.risks.length > 0 && (
                  <div>
                    <dt className="font-medium text-[var(--color-ink)]">
                      Riscos
                    </dt>
                    <dd className="mt-1">
                      <ul className="space-y-1 text-[var(--color-ink-2)]">
                        {prd.risks.map((r, i) => (
                          <li
                            key={i}
                            className="before:content-['⚠'] before:mr-2 before:text-amber-600"
                          >
                            {r}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
