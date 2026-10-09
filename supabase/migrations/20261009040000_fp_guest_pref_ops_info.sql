alter table public.event_function_plans
  add column if not exists guest_preference text,
  add column if not exists ops_manager_name text,
  add column if not exists ops_manager_contact text;
