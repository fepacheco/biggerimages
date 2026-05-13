import { notFound } from "next/navigation";
import Link from "next/link";
import Report from "@/components/Report";
import { db } from "@/lib/supabase";
import type { SessionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data } = await db()
    .from("discovery_sessions")
    .select("*")
    .eq("id", id)
    .single<SessionRow>();

  if (!data) notFound();

  if (!data.outputs) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-[var(--color-muted)]">
          Relatório ainda não foi gerado.
        </p>
        <Link
          href={`/s/${id}`}
          className="mt-4 inline-block text-[var(--color-accent)] underline"
        >
          ← Voltar pra entrevista
        </Link>
      </main>
    );
  }

  return <Report outputs={data.outputs} businessName={data.business_name} />;
}
