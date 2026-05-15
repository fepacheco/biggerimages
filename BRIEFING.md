# Briefing — App de descoberta de automações guiada por IA

## O problema que esse app resolve

Quando se vai pensar em automação ou IA pra um cliente, ele quase nunca consegue articular onde dá pra automatizar. Não sabe quais processos repete, onde perde tempo, o que dói. O app é um **questionário adaptativo guiado por IA** que entrevista o dono do negócio (perguntas abertas + múltipla escolha, geradas dinamicamente pelo Claude a cada turno) e ao final entrega três artefatos:

1. **Mapa de processos do negócio** — agrupado por área (operação, atendimento, cozinha, marketing, financeiro, equipe), com pontos de dor identificados.
2. **Lista priorizada de oportunidades de automação** — 5-10 oportunidades com impacto, esforço, score de prioridade e ferramentas sugeridas (n8n, Zapier, agente de IA, Apps Script, software custom, etc.).
3. **Mini-PRDs** das 3-5 oportunidades de maior prioridade — problema, proposta, fluxo passo-a-passo, integrações necessárias, KPI de sucesso, riscos.

O caso de uso imediato é entrevistar um amigo dono de restaurante/bar de vinho. Mas a arquitetura é genérica e tem um preset de restaurante pré-carregado.

## Decisões já tomadas (não pergunte de novo)

- **Fluxo adaptativo**: a IA gera cada próxima pergunta com base nas respostas anteriores. Sem roteiro fixo. Em ~12-20 turnos a IA marca que tem material suficiente.
- **Entrada**: só texto na v1. Voz fica pra iteração futura (Web Speech API ou Whisper).
- **Outputs**: os três artefatos acima — mapa, lista priorizada, mini-PRDs.
- **Escopo**: app genérico, mas com **preset de restaurante** pré-carregado (briefing rico sobre áreas típicas: reservas, cardápio, salão, cozinha, estoque, fornecedores, delivery, marketing, financeiro, equipe, eventos). Adicionar novos presets deve ser uma entrada num arquivo só.
- **Stack**: Next.js 15 (App Router) + TypeScript + Tailwind v4. Sem SPA separada.
- **Persistência**: Supabase, schema **`fe_lab`** (configurável via env var). Escrever **migrações SQL** — eu plugo as credenciais depois via `.env.local`.
- **Acesso**: link público com session id na URL (`/s/[id]`). Sem login, sem auth. Sem painel admin. Quem tem o link continua a entrevista; quem não tem não acessa.
- **Idioma**: tudo em português brasileiro — UI, system prompts, perguntas geradas, relatório.
- **Modelo**: Claude Opus 4.7. Saída estruturada via **tool use forçada** (`tool_choice: { type: "tool", name: ... }`).
- **Local only**: rode com `npm run dev` na minha máquina. Sem deploy nesse primeiro corte.

## Stack e dependências

```
next ^15.1.6
react ^19
typescript ^5.7
tailwindcss ^4 (CSS-first config via @theme)
@tailwindcss/postcss ^4
@anthropic-ai/sdk ^0.65 (precisa suportar Opus 4.7 + thinking adaptive + output_config.effort)
@supabase/supabase-js ^2.45
```

## Estrutura de pastas

```
.
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── .gitignore
├── .env.local.example
├── README.md
├── supabase/
│   └── migrations/
│       └── 0001_init.sql
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx                       # landing
    │   ├── new/page.tsx                   # form: escolhe preset + nome
    │   ├── s/[id]/page.tsx                # entrevista (chat-like)
    │   ├── s/[id]/report/page.tsx         # relatório final
    │   └── api/
    │       └── sessions/
    │           ├── route.ts               # POST: cria sessão
    │           └── [id]/
    │               ├── route.ts           # GET: estado da sessão + turns
    │               ├── turn/route.ts      # POST: salva resposta + gera próxima Q
    │               └── finalize/route.ts  # POST: gera relatório
    ├── components/
    │   ├── InterviewChat.tsx              # client component, gerencia o loop
    │   └── Report.tsx                     # render do relatório
    └── lib/
        ├── anthropic.ts                   # generateNextQuestion + generateReport
        ├── supabase.ts                    # client server-side com schema
        ├── presets.ts                     # restaurante + outro
        └── types.ts                       # SessionRow, TurnRow, NextQuestion, ReportOutputs
```

## Modelo de dados (Supabase, schema `fe_lab`)

```sql
create schema if not exists fe_lab;

create table fe_lab.discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  preset text not null,
  business_name text,
  state text not null default 'asking'
    check (state in ('asking', 'finalizing', 'done', 'error')),
  outputs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fe_lab.discovery_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references fe_lab.discovery_sessions(id) on delete cascade,
  idx int not null,
  question text not null,
  question_type text not null check (question_type in ('open', 'multiple_choice')),
  options jsonb,
  allow_text_too boolean not null default false,
  reasoning text,                  -- privado da IA, nunca mostrado ao usuário
  ready_to_finalize boolean not null default false,
  answer text,
  answer_options jsonb,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (session_id, idx)
);

create index on fe_lab.discovery_turns (session_id, idx);
```

Mais um trigger `touch_updated_at()` no `discovery_sessions`.

**Importante avisar no README:** o schema `fe_lab` precisa ser adicionado em **Supabase → Settings → API → Data API → Exposed schemas**, senão o PostgREST retorna 404 em tudo.

## Integração Claude

Duas funções em `lib/anthropic.ts`, ambas usam `tool_choice: { type: "tool", name: ... }` pra forçar saída estruturada:

### 1. `generateNextQuestion({ presetId, businessName, priorTurns })`

- Model: `claude-opus-4-7`
- `max_tokens: 2048`
- Sem thinking (turno leve, latência importa)
- Tool `next_question` com schema:

```ts
{
  reasoning: string,           // privado, raciocínio da IA
  question: string,
  question_type: "open" | "multiple_choice",
  options?: string[],          // 3-5 quando multiple_choice
  allow_text_too?: boolean,    // permite texto livre além das opções
  ready_to_finalize: boolean,
  finalize_reason?: string,
}
```

System prompt diz pra ser um consultor brasileiro experiente, conversacional, **uma pergunta por turno**, alternar aberta/múltipla escolha, cobrir visão geral → fluxo do dia → tarefas repetitivas → ferramentas atuais → comunicação com cliente → dados/relatórios → conforto com tech → sonhos/wishlist. Ao longo da conversa marca `ready_to_finalize=true` quando tem 12-20 respostas ricas.

O histórico vai como `Anthropic.MessageParam[]` — cada turn vira um par `{role:"assistant", content: question}` + `{role:"user", content: answer}`. Se a resposta veio com `answer_options`, prefixa com `[selecionou: A, B]` antes do texto livre.

### 2. `generateReport({ presetId, businessName, turns })`

- Model: `claude-opus-4-7`
- `max_tokens: 16000`
- `thinking: { type: "adaptive" }`
- `output_config: { effort: "high" }`
- Tool `report` com schema (resumido):

```ts
{
  summary: string,             // 2-3 frases
  process_map: { areas: [{ name, processes: [{ name, description, pain_points: [] }] }] },
  opportunities: [{
    title, problem, proposed_solution,
    impact: "alto"|"medio"|"baixo",
    effort: "baixo"|"medio"|"alto",
    priority_score: number,    // 1-10
    suggested_tools: string[],
  }],
  mini_prds: [{
    opportunity_title, problem, proposal,
    flow: string[], integrations: string[],
    success_kpi: string, risks: string[],
  }],
}
```

System prompt diz pra ser sênior em produto/automação, **não inventar fatos**, ser concreto (não "automatizar comunicação" — quer "Bot no WhatsApp Business confirmando reserva 4h antes via Z-API + Google Calendar"), usar o vocabulário do entrevistado.

**Detalhe técnico**: o tipo do SDK pode ainda não conhecer `thinking.adaptive` e `output_config.effort` dependendo da versão. Use `as unknown as Anthropic.MessageCreateParamsNonStreaming` no objeto de params pra não brigar com TS.

## API routes

| Rota | Método | Body | Retorno |
|---|---|---|---|
| `/api/sessions` | POST | `{ preset, businessName? }` | `{ sessionId }` |
| `/api/sessions/[id]` | GET | — | `{ session, turns }` |
| `/api/sessions/[id]/turn` | POST | `{ answer?, answerOptions? }` | `{ turn, readyToFinalize, finalizeReason? }` |
| `/api/sessions/[id]/finalize` | POST | — | `{ outputs }` |

**Chave do `/turn`**: cada POST faz duas coisas numa só ida — salva a resposta na última pergunta não-respondida (se houver) E gera+salva a próxima pergunta. O primeiro POST (body vazio) gera a pergunta de abertura. Isso simplifica o cliente: ele só faz POST com a resposta e recebe a próxima Q.

`maxDuration` nas API routes: 60s no `/turn`, 300s no `/finalize`. Runtime `nodejs` em ambas.

## UI/UX

- **Tipografia**: Fraunces (display, serif) + Inter (sans). Carregar via Google Fonts no `layout.tsx`.
- **Paleta**: fundo cream (`#faf7f2`), acento terracotta (`#c2410c`), tudo via `@theme` no `globals.css` (Tailwind v4).
- **Landing (`/`)**: headline grande em serif + 3 bullets do que sai + CTA "Começar uma entrevista →".
- **`/new`**: radio cards pra escolher preset (restaurante/outro), input opcional pro nome do negócio. Cria sessão e redireciona pra `/s/[id]`.
- **`/s/[id]`**: chat-like.
  - Histórico de Q&A em bubbles (pergunta à esquerda em cream, resposta à direita em branco).
  - Pergunta atual em destaque com acento de cor.
  - Se `question_type === "multiple_choice"`: checkboxes (multi-select). Se `allow_text_too`, também mostra textarea pra complementar.
  - Se `question_type === "open"`: textarea.
  - Botão "Responder →" e link "Pular pergunta".
  - Quando `readyToFinalize=true`, aparece card extra com "Gerar relatório agora →" mas a entrevista continua aberta. O usuário decide.
  - Loading state durante `/finalize` ("Gerando relatório... 30-90s, não feche a aba").
  - No mount: GET `/api/sessions/[id]`. Se `state === 'done'`, redireciona pra `/report`. Se a última turn não foi respondida, exibe ela direto sem chamar API.
- **`/s/[id]/report`**: server component que lê do Supabase. Renderiza:
  - Header com summary
  - Mapa de processos por área
  - Oportunidades ordenadas por `priority_score` desc, com chips de impacto/esforço/ferramentas
  - Cards de mini-PRD com `<dl>` estruturado

## Preset de restaurante (briefing pro system prompt)

```
Áreas típicas para investigar (não precisa cobrir todas, escolha pelo que o cliente disser):
- Reservas e fila de espera
- Cardápio, mudanças e digitalização (QR menu, app de pedido)
- Atendimento no salão (anotação, lançamento no PDV, divisão de conta)
- Cozinha (KDS, fichas técnicas, mise en place, controle de tempo)
- Estoque e CMV (entrada de notas, contagem, perdas)
- Fornecedores (cotação, pedidos recorrentes, recebimento)
- Delivery e iFood/Rappi (gestão de pedidos, tempo, avaliações)
- Marketing (Instagram, lista de transmissão, programa de fidelidade, e-mail)
- Financeiro (conciliação de maquininhas, fluxo de caixa, fechamento de mês)
- Equipe (escala, ponto, treinamento, comunicação interna)
- Experiência do cliente (NPS, reviews no Google, recorrência)
- Eventos (privatização, jantares harmonizados, wine club)
```

Opening hint pro restaurante: "Comece pedindo um panorama curto: nome, conceito, tamanho (mesas/cobertura/equipe), há quanto tempo opera."

Preset `outro`: sem áreas pré-definidas, começa perguntando o tipo de negócio.

## Env vars (`.env.local.example`)

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DISCOVERY_DB_SCHEMA=fe_lab
```

O cliente Supabase no servidor usa service role key — não tem RLS nesse primeiro corte (não precisa, é tudo server-side).

## O que NÃO fazer

- Não criar painel admin, auth, login.
- Não adicionar voz (fica pra v2).
- Não usar SDK do Anthropic em versão antiga que não conheça `thinking.adaptive` — bumpe pra `^0.65` ou superior.
- Não usar streaming nas chamadas Claude. Não-streaming com tool use é mais simples; `max_tokens: 16000` no finalize fica dentro do limite de timeout do Next.
- Não usar RLS no Supabase nessa versão.
- Não inserir dependências extras (zod, react-hook-form, swr, etc.). Use `fetch` direto e `useState`.

## Próximas iterações (mencione no README mas não implemente)

- **Voz**: dois caminhos. Web Speech API (grátis, varia por browser) ou MediaRecorder + Whisper API. Nenhum mexe na lógica do Claude, só preenche o input.
- **Compartilhar relatório**: PDF export, link público read-only.
- **Histórico do consultor**: dashboard com todas as sessões.

## Pedido final

Faça tudo no diretório atual. Não pergunte sobre branch, GitHub, deploy — é só código local. Quando terminar, me mostre como rodar (`npm install`, aplicar a migração, env vars, `npm run dev`).
