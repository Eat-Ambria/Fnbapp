alter table public.event_function_plans
  add column if not exists sweetness_tolerance text;
alter table public.event_function_plans
  add column if not exists oil_preference text;
alter table public.event_function_plans
  add column if not exists guest_community text;
alter table public.event_function_plans
  add column if not exists corkage_liquor boolean not null default false;
