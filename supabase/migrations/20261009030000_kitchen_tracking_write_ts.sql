alter table public.kitchen_tracking
  add column if not exists client_write_ts bigint;
