-- ============================================
-- LEAP10XAI — Complete Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. agents
-- ============================================
create table if not exists public.agents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  persona text not null,
  goal text not null,
  knowledge jsonb not null default '[]'::jsonb,
  guidelines jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '[]'::jsonb,
  hard_rules jsonb not null default '[]'::jsonb,
  pass_threshold numeric not null default 4.0,
  scoring_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 2. conversations
-- ============================================
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references public.agents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  transcript jsonb not null default '[]'::jsonb,
  source text not null default 'manual' check (source in ('manual','upload','live','vapi')),
  status text not null default 'draft' check (status in ('draft','completed','evaluated')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================
-- 3. benchmark_runs (before evaluations — FK)
-- ============================================
create table if not exists public.benchmark_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  dataset_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  model text not null,
  prompt_version text not null,
  temperature numeric not null default 0.2,
  total_calls int not null default 0,
  labelled_calls int not null default 0,
  status text not null default 'running' check (status in ('running','completed','failed')),
  results jsonb,
  created_at timestamptz not null default now()
);

-- ============================================
-- 4. evaluations
-- ============================================
create table if not exists public.evaluations (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  scores jsonb not null default '[]'::jsonb,
  hard_rule_violations jsonb not null default '[]'::jsonb,
  average_score numeric,
  pass_fail text not null check (pass_fail in ('PASS','FAIL','PENDING')),
  model text,
  raw_response jsonb,
  summary text,
  improvement_suggestions jsonb default '[]'::jsonb,
  prompt_version text default 'evaluation-v1',
  temperature numeric default 0.2,
  benchmark_run_id uuid references public.benchmark_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================
-- 5. human_evaluations
-- ============================================
create table if not exists public.human_evaluations (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  evaluator_name text not null,
  scores jsonb not null default '[]'::jsonb,
  pass_fail text not null check (pass_fail in ('PASS','FAIL')),
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================
-- 6. evaluation_runs
-- ============================================
create table if not exists public.evaluation_runs (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  run_number int not null,
  evaluation_id uuid references public.evaluations(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_agents_user on public.agents(user_id);
create index if not exists idx_conversations_agent on public.conversations(agent_id);
create index if not exists idx_conversations_user on public.conversations(user_id);
create index if not exists idx_evaluations_conversation on public.evaluations(conversation_id);
create index if not exists idx_evaluations_user on public.evaluations(user_id);
create index if not exists idx_evaluations_benchmark_run on public.evaluations(benchmark_run_id);
create index if not exists idx_human_eval_conversation on public.human_evaluations(conversation_id);
create index if not exists idx_evaluation_runs_conversation on public.evaluation_runs(conversation_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.agents enable row level security;
alter table public.conversations enable row level security;
alter table public.evaluations enable row level security;
alter table public.human_evaluations enable row level security;
alter table public.evaluation_runs enable row level security;
alter table public.benchmark_runs enable row level security;

-- Agents
create policy "Users can CRUD own agents"
  on public.agents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Conversations
create policy "Users can CRUD own conversations"
  on public.conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Evaluations
create policy "Users can CRUD own evaluations"
  on public.evaluations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Human evaluations
create policy "Users can CRUD own human_evaluations"
  on public.human_evaluations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Evaluation runs
create policy "Users can CRUD own evaluation_runs"
  on public.evaluation_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Benchmark runs
create policy "Users can CRUD own benchmark_runs"
  on public.benchmark_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$ begin
  new.updated_at = now();
  return new;
end;
 $$;

drop trigger if exists agents_updated_at on public.agents;
create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.handle_updated_at();

-- ============================================
-- DONE
-- ============================================
select 'LEAP10XAI schema created successfully' as status;