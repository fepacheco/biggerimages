create schema if not exists fe_lab;

create table if not exists fe_lab.discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  preset text not null,
  business_name text,
  state text not null default 'asking' check (state in ('asking', 'finalizing', 'done', 'error')),
  outputs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fe_lab.discovery_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references fe_lab.discovery_sessions(id) on delete cascade,
  idx int not null,
  question text not null,
  question_type text not null check (question_type in ('open', 'multiple_choice')),
  options jsonb,
  allow_text_too boolean not null default false,
  reasoning text,
  ready_to_finalize boolean not null default false,
  answer text,
  answer_options jsonb,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (session_id, idx)
);

create index if not exists discovery_turns_session_idx
  on fe_lab.discovery_turns (session_id, idx);

create or replace function fe_lab.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists discovery_sessions_touch on fe_lab.discovery_sessions;
create trigger discovery_sessions_touch
  before update on fe_lab.discovery_sessions
  for each row execute function fe_lab.touch_updated_at();
