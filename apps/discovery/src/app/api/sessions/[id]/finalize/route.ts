import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { generateReport } from "@/lib/anthropic";
import type { SessionRow, TurnRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await ctx.params;
  const supabase = db();

  const sessionRes = await supabase
    .from("discovery_sessions")
    .select("id, preset, business_name, state, outputs")
    .eq("id", sessionId)
    .single<Pick<SessionRow, "id" | "preset" | "business_name" | "state" | "outputs">>();

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }
  if (sessionRes.data.state === "done" && sessionRes.data.outputs) {
    return NextResponse.json({ outputs: sessionRes.data.outputs });
  }

  await supabase
    .from("discovery_sessions")
    .update({ state: "finalizing" })
    .eq("id", sessionId);

  const turnsRes = await supabase
    .from("discovery_turns")
    .select("*")
    .eq("session_id", sessionId)
    .order("idx", { ascending: true })
    .returns<TurnRow[]>();

  if (turnsRes.error) {
    await supabase
      .from("discovery_sessions")
      .update({ state: "error" })
      .eq("id", sessionId);
    return NextResponse.json({ error: turnsRes.error.message }, { status: 500 });
  }

  const answeredTurns = (turnsRes.data ?? []).filter((t) => t.answered_at !== null);
  if (answeredTurns.length < 2) {
    await supabase
      .from("discovery_sessions")
      .update({ state: "asking" })
      .eq("id", sessionId);
    return NextResponse.json(
      { error: "Faltam respostas suficientes pra gerar o relatório (mínimo 2)." },
      { status: 400 },
    );
  }

  let outputs;
  try {
    outputs = await generateReport({
      presetId: sessionRes.data.preset,
      businessName: sessionRes.data.business_name,
      turns: answeredTurns,
    });
  } catch (err) {
    await supabase
      .from("discovery_sessions")
      .update({ state: "error" })
      .eq("id", sessionId);
    const msg = err instanceof Error ? err.message : "Falha ao gerar relatório";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const save = await supabase
    .from("discovery_sessions")
    .update({ outputs, state: "done" })
    .eq("id", sessionId);

  if (save.error) {
    return NextResponse.json({ error: save.error.message }, { status: 500 });
  }

  return NextResponse.json({ outputs });
}
