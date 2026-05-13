"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionRow, TurnRow } from "@/lib/types";

interface Props {
  sessionId: string;
}

interface SessionPayload {
  session: SessionRow;
  turns: TurnRow[];
}

export default function InterviewChat({ sessionId }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [pendingTurn, setPendingTurn] = useState<TurnRow | null>(null);
  const [readyToFinalize, setReadyToFinalize] = useState(false);
  const [answer, setAnswer] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = (await res.json()) as SessionPayload | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Falha ao carregar sessão");
        }
        if (cancelled) return;
        setSession(data.session);
        setTurns(data.turns);

        if (data.session.state === "done") {
          router.push(`/s/${sessionId}/report`);
          return;
        }

        const last = data.turns[data.turns.length - 1];
        if (last && last.answered_at === null) {
          setPendingTurn(last);
          setReadyToFinalize(last.ready_to_finalize);
        } else {
          await fetchNext(data.turns);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro inesperado");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pendingTurn]);

  async function fetchNext(currentTurns: TurnRow[], answeredPayload?: {
    answer?: string | null;
    answerOptions?: string[] | null;
  }) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answeredPayload ?? {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar pergunta");

      const newTurn = data.turn as TurnRow;
      setTurns((prev) => {
        const base = [...currentTurns];
        if (answeredPayload) {
          const lastIdx = base.length - 1;
          if (lastIdx >= 0) {
            base[lastIdx] = {
              ...base[lastIdx],
              answer: answeredPayload.answer ?? null,
              answer_options: answeredPayload.answerOptions ?? null,
              answered_at: new Date().toISOString(),
            };
          }
        }
        return base;
      });
      setPendingTurn(newTurn);
      setReadyToFinalize(Boolean(data.readyToFinalize));
      setAnswer("");
      setSelectedOptions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAnswer() {
    if (!pendingTurn) return;
    const trimmed = answer.trim();
    if (pendingTurn.question_type === "open" && trimmed.length === 0) {
      return;
    }
    if (
      pendingTurn.question_type === "multiple_choice" &&
      selectedOptions.length === 0 &&
      !(pendingTurn.allow_text_too && trimmed.length > 0)
    ) {
      return;
    }
    const updatedTurns = [...turns, pendingTurn];
    setTurns(updatedTurns);
    setPendingTurn(null);
    await fetchNext(updatedTurns, {
      answer: trimmed.length > 0 ? trimmed : null,
      answerOptions: selectedOptions.length > 0 ? selectedOptions : null,
    });
  }

  async function finalize() {
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/finalize`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao finalizar");
      router.push(`/s/${sessionId}/report`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setFinalizing(false);
    }
  }

  const answeredCount = useMemo(
    () => turns.filter((t) => t.answered_at !== null).length,
    [turns],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-[var(--color-muted)]">Carregando entrevista...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
            Discovery
          </p>
          <h1 className="font-display text-2xl mt-1">
            {session?.business_name ?? "Sua entrevista"}
          </h1>
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          {answeredCount} resposta{answeredCount === 1 ? "" : "s"}
        </p>
      </header>

      <div className="space-y-6">
        {turns
          .filter((t) => t.answered_at !== null)
          .map((t) => (
            <div key={t.id} className="space-y-2">
              <div className="rounded-2xl rounded-bl-sm bg-[var(--color-bg-2)] px-4 py-3">
                <p className="text-sm text-[var(--color-muted)] mb-1">
                  Pergunta {t.idx + 1}
                </p>
                <p className="text-[var(--color-ink)]">{t.question}</p>
              </div>
              <div className="rounded-2xl rounded-br-sm bg-white border border-[var(--color-border)] px-4 py-3 ml-8">
                {t.answer_options && t.answer_options.length > 0 && (
                  <p className="text-sm text-[var(--color-muted)] mb-1">
                    {t.answer_options.join(" · ")}
                  </p>
                )}
                {t.answer && (
                  <p className="text-[var(--color-ink-2)] whitespace-pre-wrap">
                    {t.answer}
                  </p>
                )}
              </div>
            </div>
          ))}

        {pendingTurn && (
          <div className="rounded-2xl rounded-bl-sm bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 px-4 py-3">
            <p className="text-sm text-[var(--color-muted)] mb-1">
              Pergunta {pendingTurn.idx + 1}
            </p>
            <p className="text-[var(--color-ink)] font-medium">
              {pendingTurn.question}
            </p>

            <div className="mt-4 space-y-3">
              {pendingTurn.question_type === "multiple_choice" &&
                pendingTurn.options?.map((opt) => {
                  const checked = selectedOptions.includes(opt);
                  return (
                    <label
                      key={opt}
                      className={`block rounded-lg border px-3 py-2 cursor-pointer transition ${
                        checked
                          ? "border-[var(--color-accent)] bg-white"
                          : "border-[var(--color-border)] bg-white/60 hover:bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedOptions((prev) =>
                            checked
                              ? prev.filter((o) => o !== opt)
                              : [...prev, opt],
                          )
                        }
                        className="mr-2"
                      />
                      {opt}
                    </label>
                  );
                })}

              {(pendingTurn.question_type === "open" ||
                pendingTurn.allow_text_too) && (
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={pendingTurn.question_type === "open" ? 4 : 2}
                  placeholder={
                    pendingTurn.allow_text_too
                      ? "Quer complementar? (opcional)"
                      : "Sua resposta..."
                  }
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 focus:outline-none focus:border-[var(--color-accent)]"
                />
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={submitAnswer}
                  disabled={submitting}
                  className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-white font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {submitting ? "Pensando..." : "Responder →"}
                </button>
                <button
                  onClick={() =>
                    fetchNext([...turns, pendingTurn], { answer: null })
                  }
                  disabled={submitting}
                  className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink-2)]"
                >
                  Pular pergunta
                </button>
              </div>
            </div>
          </div>
        )}

        {readyToFinalize && !finalizing && (
          <div className="rounded-2xl bg-white border border-[var(--color-accent)] px-4 py-4">
            <p className="font-medium">
              Já dá pra gerar um bom relatório com o que você me contou.
            </p>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Você pode continuar respondendo se quiser refinar, ou gerar agora.
            </p>
            <button
              onClick={finalize}
              className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2 text-white font-medium hover:opacity-90 transition"
            >
              Gerar relatório agora →
            </button>
          </div>
        )}

        {finalizing && (
          <div className="rounded-2xl bg-[var(--color-bg-2)] px-4 py-4">
            <p className="font-medium">Gerando relatório...</p>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Isso costuma levar 30-90 segundos. Não feche a aba.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </main>
  );
}
