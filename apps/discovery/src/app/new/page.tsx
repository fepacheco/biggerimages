"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRESETS } from "@/lib/presets";

export default function NewSessionPage() {
  const router = useRouter();
  const [preset, setPreset] = useState<string>("restaurante");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset, businessName: businessName || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Falha ao criar sessão");
      }
      router.push(`/s/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-display text-3xl">Vamos começar.</h1>
      <p className="mt-3 text-[var(--color-ink-2)]">
        Duas coisas pra calibrar a conversa.
      </p>

      <div className="mt-10 space-y-8">
        <div>
          <label className="block text-sm font-medium mb-3">
            Tipo de negócio
          </label>
          <div className="space-y-2">
            {Object.values(PRESETS).map((p) => (
              <label
                key={p.id}
                className={`block rounded-lg border px-4 py-3 cursor-pointer transition ${
                  preset === p.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-ink-2)]"
                }`}
              >
                <input
                  type="radio"
                  name="preset"
                  value={p.id}
                  checked={preset === p.id}
                  onChange={(e) => setPreset(e.target.value)}
                  className="sr-only"
                />
                <div className="font-medium">{p.label}</div>
                <div className="text-sm text-[var(--color-muted)] mt-1">
                  {p.description}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="bn" className="block text-sm font-medium mb-2">
            Nome do negócio{" "}
            <span className="text-[var(--color-muted)] font-normal">
              (opcional)
            </span>
          </label>
          <input
            id="bn"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Ex: Trattoria del Vino"
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          onClick={start}
          disabled={loading}
          className="w-full rounded-full bg-[var(--color-accent)] py-3 text-white font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Criando sessão..." : "Começar a entrevista →"}
        </button>
      </div>
    </main>
  );
}
