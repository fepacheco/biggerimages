import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import type { SessionRow, TurnRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await ctx.params;
  const supabase = db();

  const sessionRes = await supabase
    .from("discovery_sessions")
    .select("*")
    .eq("id", sessionId)
    .single<SessionRow>();

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  const turnsRes = await supabase
    .from("discovery_turns")
    .select("*")
    .eq("session_id", sessionId)
    .order("idx", { ascending: true })
    .returns<TurnRow[]>();

  if (turnsRes.error) {
    return NextResponse.json({ error: turnsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    session: sessionRes.data,
    turns: turnsRes.data ?? [],
  });
}
