-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.agents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  persona text NOT NULL,
  goal text NOT NULL,
  knowledge jsonb NOT NULL DEFAULT '[]'::jsonb,
  guidelines jsonb NOT NULL DEFAULT '[]'::jsonb,
  rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  hard_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  pass_threshold numeric NOT NULL DEFAULT 4.0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  scoring_notes text,
  CONSTRAINT agents_pkey PRIMARY KEY (id),
  CONSTRAINT agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'manual'::text CHECK (source = ANY (ARRAY['manual'::text, 'upload'::text, 'live'::text, 'vapi'::text])),
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'completed'::text, 'evaluated'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id),
  CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.evaluations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  hard_rule_violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  average_score numeric,
  pass_fail text NOT NULL CHECK (pass_fail = ANY (ARRAY['PASS'::text, 'FAIL'::text, 'PENDING'::text])),
  model text,
  raw_response jsonb,
  summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  improvement_suggestions jsonb DEFAULT '[]'::jsonb,
  prompt_version text DEFAULT 'evaluation-v1'::text,
  temperature numeric DEFAULT 0.2,
  benchmark_run_id uuid,
  CONSTRAINT evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT evaluations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT evaluations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT evaluations_benchmark_run_id_fkey FOREIGN KEY (benchmark_run_id) REFERENCES public.benchmark_runs(id)
);
CREATE TABLE public.human_evaluations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  evaluator_name text NOT NULL,
  scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  pass_fail text NOT NULL CHECK (pass_fail = ANY (ARRAY['PASS'::text, 'FAIL'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT human_evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT human_evaluations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT human_evaluations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.evaluation_runs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  run_number integer NOT NULL,
  evaluation_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evaluation_runs_pkey PRIMARY KEY (id),
  CONSTRAINT evaluation_runs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT evaluation_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT evaluation_runs_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES public.evaluations(id)
);
CREATE TABLE public.benchmark_runs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  dataset_version text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  model text NOT NULL,
  prompt_version text NOT NULL,
  temperature numeric NOT NULL DEFAULT 0.2,
  total_calls integer NOT NULL DEFAULT 0,
  labelled_calls integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])),
  results jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT benchmark_runs_pkey PRIMARY KEY (id),
  CONSTRAINT benchmark_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);