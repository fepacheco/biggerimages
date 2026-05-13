import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { generateNextQuestion } from "@/lib/anthropic";
import type { SessionRow, TurnRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TurnBody {
  answer?: string | null;
  answerOptions?: string[] | null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await ctx.params;

  let body: TurnBody = {};
  try {
    body = (await req.json()) as TurnBody;
  } catch {
    // Body opcional
  }

  const supabase = db();

  const sessionRes = await supabase
    .from("discovery_sessions")
    .select("id, preset, business_name, state")
    .eq("id", sessionId)
    .single<Pick<SessionRow, "id" | "preset" | "business_name" | "state">>();

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  if (sessionRes.data.state === "done") {
    return NextResponse.json(
      { error: "Sessão já finalizada. Veja o relatório." },
      { status: 409 },
    );
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
  const turns = turnsRes.data ?? [];

  const lastUnanswered = [...turns].reverse().find((t) => t.answered_at === null);
  if (lastUnanswered) {
    const answer = body.answer?.trim() ?? null;
    const options = body.answerOptions ?? null;
    const update = await supabase
      .from("discovery_turns")
      .update({
        answer,
        answer_options: options,
        answered_at: new Date().toISOString(),
      })
      .eq("id", lastUnanswered.id)
      .select("*")
      .single<TurnRow>();
    if (update.error || !update.data) {
      return NextResponse.json(
        { error: update.error?.message ?? "Falha ao salvar resposta" },
        { status: 500 },
      );
    }
    lastUnanswered.answer = update.data.answer;
    lastUnanswered.answer_options = update.data.answer_options;
    lastUnanswered.answered_at = update.data.answered_at;
  }

  let nextQuestion;
  try {
    nextQuestion = await generateNextQuestion({
      presetId: sessionRes.data.preset,
      businessName: sessionRes.data.business_name,
      priorTurns: turns,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao chamar Claude";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const nextIdx = turns.length;
  const insert = await supabase
    .from("discovery_turns")
    .insert({
      session_id: sessionId,
      idx: nextIdx,
      question: nextQuestion.question,
      question_type: nextQuestion.question_type,
      options: nextQuestion.options ?? null,
      allow_text_too: nextQuestion.allow_text_too ?? false,
      reasoning: nextQuestion.reasoning,
      ready_to_finalize: nextQuestion.ready_to_finalize,
    })
    .select("*")
    .single<TurnRow>();

  if (insert.error || !insert.data) {
    return NextResponse.json(
      { error: insert.error?.message ?? "Falha ao salvar pergunta" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    turn: insert.data,
    readyToFinalize: nextQuestion.ready_to_finalize,
    finalizeReason: nextQuestion.finalize_reason ?? null,
  });
}
