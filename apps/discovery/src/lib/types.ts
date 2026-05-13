export type SessionState = "asking" | "finalizing" | "done" | "error";

export type QuestionType = "open" | "multiple_choice";

export interface SessionRow {
  id: string;
  preset: string;
  business_name: string | null;
  state: SessionState;
  outputs: ReportOutputs | null;
  created_at: string;
  updated_at: string;
}

export interface TurnRow {
  id: string;
  session_id: string;
  idx: number;
  question: string;
  question_type: QuestionType;
  options: string[] | null;
  allow_text_too: boolean;
  reasoning: string | null;
  ready_to_finalize: boolean;
  answer: string | null;
  answer_options: string[] | null;
  asked_at: string;
  answered_at: string | null;
}

export interface NextQuestion {
  reasoning: string;
  question: string;
  question_type: QuestionType;
  options?: string[];
  allow_text_too?: boolean;
  ready_to_finalize: boolean;
  finalize_reason?: string;
}

export type Impact = "alto" | "medio" | "baixo";
export type Effort = "baixo" | "medio" | "alto";

export interface ReportOutputs {
  summary: string;
  process_map: {
    areas: {
      name: string;
      processes: {
        name: string;
        description: string;
        pain_points: string[];
      }[];
    }[];
  };
  opportunities: {
    title: string;
    problem: string;
    proposed_solution: string;
    impact: Impact;
    effort: Effort;
    priority_score: number;
    suggested_tools: string[];
  }[];
  mini_prds: {
    opportunity_title: string;
    problem: string;
    proposal: string;
    flow: string[];
    integrations: string[];
    success_kpi: string;
    risks: string[];
  }[];
}
