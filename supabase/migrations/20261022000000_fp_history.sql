alter table public.event_function_plans
  add column if not exists fp_history jsonb not null default '[]'::jsonb;
