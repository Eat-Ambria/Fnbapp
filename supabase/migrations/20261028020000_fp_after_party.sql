alter table public.event_function_plans
  add column if not exists after_party_enabled boolean not null default false;
alter table public.event_function_plans
  add column if not exists after_party_pax integer;
alter table public.event_function_plans
  add column if not exists after_party_start_time text;
alter table public.event_function_plans
  add column if not exists after_party_windup_time text;
