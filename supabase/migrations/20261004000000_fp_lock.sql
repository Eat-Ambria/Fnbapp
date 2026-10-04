alter table public.event_function_plans
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists lock_history jsonb not null default '[]'::jsonb;
