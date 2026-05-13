import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { PRESETS } from "@/lib/presets";

export const runtime = "nodejs";

interface CreateBody {
  preset?: string;
  businessName?: string | null;
}

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const preset = body.preset && PRESETS[body.preset] ? body.preset : "outro";
  const businessName =
    body.businessName && body.businessName.trim().length > 0
      ? body.businessName.trim().slice(0, 200)
      : null;

  const { data, error } = await db()
    .from("discovery_sessions")
    .insert({ preset, business_name: businessName, state: "asking" })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Falha ao criar sessão" },
      { status: 500 },
    );
  }
  return NextResponse.json({ sessionId: data.id });
}
