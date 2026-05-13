import Anthropic from "@anthropic-ai/sdk";
import type { NextQuestion, ReportOutputs, TurnRow } from "./types";
import { getPreset, type Preset } from "./presets";

const MODEL = "claude-opus-4-7";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não definida em .env.local.");
  }
  if (!client) client = new Anthropic();
  return client;
}

const QUESTIONER_SYSTEM = (preset: Preset, businessName: string | null) => `Você é um consultor brasileiro experiente em automação e IA aplicada a pequenos negócios. Você está conduzindo uma entrevista de descoberta com ${
  businessName ? `o(a) dono(a) do "${businessName}"` : "o(a) dono(a) de um negócio"
}, com o objetivo de mapear os processos da operação e identificar oportunidades de automação.

Contexto do segmento (preset: ${preset.label}):
${preset.briefing}

Sugestão pra primeira pergunta: ${preset.opening_hint}

Como você se comporta:
- Conversa em português brasileiro, tom acolhedor, direto, sem floreio corporativo.
- Faz UMA pergunta por turno. Nunca duas.
- Alterna perguntas abertas e de múltipla escolha. Quando a pergunta tem opções típicas conhecidas, use múltipla escolha com 3-5 opções e permita texto livre adicional (allow_text_too=true).
- Cada pergunta é informada pelas respostas anteriores. Se o entrevistado mencionou algo que merece aprofundamento, aprofunde antes de mudar de tema.
- Cobre, ao longo da conversa: visão geral do negócio, fluxo do dia/semana, tarefas repetitivas que dão preguiça, ferramentas atuais, comunicação com cliente, dados/relatórios que ele precisa olhar, sonhos/wishlist, conforto com tecnologia.
- Evita perguntas óbvias ou redundantes. Se já dá pra inferir, não pergunte de novo.
- Em geral 12 a 20 perguntas é suficiente. Pode encerrar antes se já tem material rico. Quando achar que tem o bastante pra gerar um bom relatório (mapa de processos + oportunidades + PRDs), marque ready_to_finalize=true.
- IMPORTANTE: o campo "reasoning" é privado, só pra você raciocinar — explique o que essa pergunta busca descobrir. O entrevistado nunca vê isso.

Você SEMPRE responde chamando a tool "next_question". Nunca responda em texto livre.`;

const FINALIZER_SYSTEM = (preset: Preset, businessName: string | null) => `Você é um consultor sênior de produto e automação. Recebeu o transcript completo de uma entrevista de descoberta com ${
  businessName ? `o(a) dono(a) do "${businessName}"` : "um negócio"
} (segmento: ${preset.label}).

Sua tarefa é gerar três entregáveis estruturados, todos em português brasileiro:

1) Mapa de processos do negócio — agrupado por área (operação, atendimento, cozinha, marketing, financeiro, equipe, etc., conforme couber). Para cada processo, descreva brevemente o fluxo atual e marque pontos de dor objetivos que vieram do transcript.

2) Lista priorizada de oportunidades de automação — 5 a 10 oportunidades. Para cada uma: título curto, problema, solução proposta, impacto (alto/medio/baixo), esforço (baixo/medio/alto), score de prioridade 1-10 (impacto/esforço), e 1-3 ferramentas sugeridas — seja realista: n8n, Make/Zapier, Google Sheets + Apps Script, planilha + ChatGPT, software custom, agente de IA dedicado, plugin do PDV existente, etc.

3) Mini-PRD para as 3-5 oportunidades de maior prioridade — problema, proposta, fluxo passo-a-passo, integrações necessárias, KPI de sucesso, riscos.

Regras:
- Não invente fatos. Se o entrevistado não falou de algo, não suponha que existe.
- Seja concreto, não genérico. "Automatizar comunicação" é ruim; "Bot no WhatsApp Business que confirma reserva 4h antes via Z-API + Google Calendar" é bom.
- Use o vocabulário do entrevistado quando possível.
- Resumo executivo em 2-3 frases no início.

Você SEMPRE responde chamando a tool "report". Nunca texto livre.`;

const NEXT_QUESTION_TOOL: Anthropic.Tool = {
  name: "next_question",
  description:
    "Emite a próxima pergunta da entrevista, ou sinaliza que já tem material suficiente para gerar o relatório.",
  input_schema: {
    type: "object",
    properties: {
      reasoning: {
        type: "string",
        description:
          "Raciocínio privado: por que essa pergunta agora, o que ela busca descobrir. Não é mostrado ao entrevistado.",
      },
      question: {
        type: "string",
        description: "A pergunta em si, em português, conversacional.",
      },
      question_type: {
        type: "string",
        enum: ["open", "multiple_choice"],
        description: "open para resposta livre, multiple_choice quando há 3-5 opções típicas.",
      },
      options: {
        type: "array",
        items: { type: "string" },
        description:
          "Lista de 3-5 opções quando question_type=multiple_choice. Omita ou deixe vazio para open.",
      },
      allow_text_too: {
        type: "boolean",
        description:
          "Se true e question_type=multiple_choice, o entrevistado também pode digitar uma resposta livre além das opções.",
      },
      ready_to_finalize: {
        type: "boolean",
        description:
          "true quando você já tem material suficiente pra gerar o relatório com qualidade. Você ainda pode fazer essa pergunta E marcar como true — o app oferecerá a opção de finalizar.",
      },
      finalize_reason: {
        type: "string",
        description:
          "Opcional: por que você acha que já é hora de finalizar (ex: 'cobri operação, marketing e financeiro').",
      },
    },
    required: ["reasoning", "question", "question_type", "ready_to_finalize"],
  },
};

const REPORT_TOOL: Anthropic.Tool = {
  name: "report",
  description:
    "Entrega o relatório final estruturado: resumo, mapa de processos, oportunidades priorizadas e mini-PRDs.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Resumo executivo em 2-3 frases.",
      },
      process_map: {
        type: "object",
        properties: {
          areas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                processes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      pain_points: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["name", "description", "pain_points"],
                  },
                },
              },
              required: ["name", "processes"],
            },
          },
        },
        required: ["areas"],
      },
      opportunities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            problem: { type: "string" },
            proposed_solution: { type: "string" },
            impact: { type: "string", enum: ["alto", "medio", "baixo"] },
            effort: { type: "string", enum: ["baixo", "medio", "alto"] },
            priority_score: { type: "number" },
            suggested_tools: { type: "array", items: { type: "string" } },
          },
          required: [
            "title",
            "problem",
            "proposed_solution",
            "impact",
            "effort",
            "priority_score",
            "suggested_tools",
          ],
        },
      },
      mini_prds: {
        type: "array",
        items: {
          type: "object",
          properties: {
            opportunity_title: { type: "string" },
            problem: { type: "string" },
            proposal: { type: "string" },
            flow: { type: "array", items: { type: "string" } },
            integrations: { type: "array", items: { type: "string" } },
            success_kpi: { type: "string" },
            risks: { type: "array", items: { type: "string" } },
          },
          required: [
            "opportunity_title",
            "problem",
            "proposal",
            "flow",
            "integrations",
            "success_kpi",
            "risks",
          ],
        },
      },
    },
    required: ["summary", "process_map", "opportunities", "mini_prds"],
  },
};

function turnsToTranscript(turns: TurnRow[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  for (const t of turns) {
    if (t.answer === null && t.answered_at === null) continue;
    let answerText = t.answer ?? "";
    if (t.answer_options && t.answer_options.length > 0) {
      const prefix = `[selecionou: ${t.answer_options.join(", ")}]`;
      answerText = answerText ? `${prefix} ${answerText}` : prefix;
    }
    messages.push({
      role: "assistant",
      content: t.question,
    });
    messages.push({
      role: "user",
      content: answerText || "(sem resposta)",
    });
  }
  return messages;
}

export async function generateNextQuestion(args: {
  presetId: string;
  businessName: string | null;
  priorTurns: TurnRow[];
}): Promise<NextQuestion> {
  const preset = getPreset(args.presetId);
  const history = turnsToTranscript(args.priorTurns);

  const messages: Anthropic.MessageParam[] =
    history.length === 0
      ? [
          {
            role: "user",
            content:
              "Estou começando a entrevista agora. Faça a primeira pergunta seguindo o opening_hint do preset.",
          },
        ]
      : [
          ...history,
          {
            role: "user",
            content: "Continue. Faça a próxima pergunta.",
          },
        ];

  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: QUESTIONER_SYSTEM(preset, args.businessName),
    tools: [NEXT_QUESTION_TOOL],
    tool_choice: { type: "tool", name: "next_question" },
    messages,
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude não retornou uma chamada de tool. stop_reason=" + response.stop_reason);
  }
  return toolUse.input as NextQuestion;
}

export async function generateReport(args: {
  presetId: string;
  businessName: string | null;
  turns: TurnRow[];
}): Promise<ReportOutputs> {
  const preset = getPreset(args.presetId);
  const history = turnsToTranscript(args.turns);

  if (history.length === 0) {
    throw new Error("Não há transcript pra gerar relatório.");
  }

  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: FINALIZER_SYSTEM(preset, args.businessName),
    tools: [REPORT_TOOL],
    tool_choice: { type: "tool", name: "report" },
    messages: [
      ...history,
      {
        role: "user",
        content:
          "Entrevista concluída. Gere o relatório final agora chamando a tool 'report'.",
      },
    ],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(
      "Claude não retornou o relatório. stop_reason=" + response.stop_reason,
    );
  }
  return toolUse.input as ReportOutputs;
}
