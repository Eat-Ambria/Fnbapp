alter table public.event_function_plans
  add column if not exists created_by text;
