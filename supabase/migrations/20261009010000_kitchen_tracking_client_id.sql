alter table public.kitchen_tracking
  add column if not exists client_id text;
