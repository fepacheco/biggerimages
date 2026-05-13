# Discovery — descoberta de automações guiada por IA

Mini-app que conduz uma entrevista adaptativa com o dono de um negócio (perguntas abertas + múltipla escolha geradas a cada turno pelo Claude), e ao final entrega:

- Mapa de processos do negócio com pontos de dor
- Lista priorizada de oportunidades de automação
- Mini-PRDs para as 3-5 oportunidades de maior prioridade

Stack: Next.js 15 (App Router) + TypeScript + Tailwind v4, Anthropic SDK (Claude Opus 4.7 com tool use), Supabase (schema `fe_lab`).

## Setup

```bash
cd apps/discovery
npm install
cp .env.local.example .env.local
# edite .env.local com suas chaves
npm run dev
# http://localhost:3000
```

### Variáveis de ambiente

| Variável | Pra que serve |
|---|---|
| `ANTHROPIC_API_KEY` | Chamadas pra API da Anthropic (Claude). |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — usada só no servidor (API routes). |
| `DISCOVERY_DB_SCHEMA` | Schema no Postgres. Default: `fe_lab`. |

### Banco

Aplique a migração `supabase/migrations/0001_init.sql` no seu projeto Supabase. Dois jeitos:

**SQL editor (rápido):** cola o conteúdo do arquivo e executa.

**Supabase CLI:**
```bash
supabase db push
```

Depois, no painel do Supabase em **Settings → API → Data API → Exposed schemas**, adicione `fe_lab` à lista. Sem isso o PostgREST não enxerga as tabelas e o app retorna 404 em tudo.

A migração cria:
- `fe_lab.discovery_sessions` — uma linha por entrevista (preset, nome do negócio, estado, outputs JSON quando finalizado)
- `fe_lab.discovery_turns` — uma linha por pergunta+resposta, com `idx` sequencial, `reasoning` privado da IA, e a flag `ready_to_finalize` que sinaliza quando o app oferece o botão de finalizar

## Fluxo

1. `/` — landing, link pra `/new`
2. `/new` — escolhe preset (restaurante, outro) e nome do negócio opcional. Cria sessão e redireciona pra `/s/[id]`.
3. `/s/[id]` — entrevista. A cada turno o cliente:
   1. Carrega histórico via `GET /api/sessions/[id]`
   2. Se a última pergunta não foi respondida, exibe ela; caso contrário pede uma nova via `POST /api/sessions/[id]/turn`
   3. Usuário responde → `POST /api/sessions/[id]/turn` salva a resposta E gera a próxima pergunta numa só chamada
4. Quando o Claude sinaliza `ready_to_finalize`, aparece um botão extra. O usuário pode continuar respondendo ou finalizar.
5. `POST /api/sessions/[id]/finalize` chama o Claude novamente com o transcript completo e a tool `report` (estruturada), salva os outputs em `discovery_sessions.outputs`.
6. `/s/[id]/report` — lê do banco e renderiza os 3 entregáveis.

## Como o Claude é chamado

Dois caminhos, ambos forçando saída estruturada via `tool_choice: { type: "tool", name: ... }`:

- **`generateNextQuestion`** — tool `next_question` com campos `reasoning`, `question`, `question_type`, `options?`, `allow_text_too?`, `ready_to_finalize`, `finalize_reason?`. Sem extended thinking (cada turno é leve).
- **`generateReport`** — tool `report` com `summary`, `process_map`, `opportunities`, `mini_prds`. Adaptive thinking + `effort: "high"` (tarefa de síntese).

O system prompt da fase de perguntas usa o `briefing` do preset (`src/lib/presets.ts`) — pra adicionar um novo preset, é só adicionar uma entrada no `PRESETS`.

## Adicionar voz (próxima iteração)

A UI atual é só texto. Pra adicionar voz, dois caminhos:

- **Web Speech API** (grátis, varia por browser): adiciona um botão de microfone no `<textarea>` que dispara `webkitSpeechRecognition` e preenche o campo.
- **Whisper via API:** grava com `MediaRecorder`, manda o blob pra um novo route `/api/transcribe` que repassa pra OpenAI / Whisper / Anthropic.

Nenhum dos dois encosta na lógica do Claude — só preenche o input.

## Deploy

Local hoje, fácil deployar depois. Funciona em qualquer host que rode Node + Next 15:

- **Vercel:** setar as 3 env vars no dashboard, dar `vercel --prod`. As API routes têm `maxDuration` de 60s (`/turn`) e 300s (`/finalize`).
- **Railway / Fly / outros:** `npm run build && npm start`.
