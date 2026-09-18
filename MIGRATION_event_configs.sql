-- Ambria FnB — event_configs table (Booked Functions menu editor)
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
-- Mirrors proposal_configs' shape so the sales-facing Booked Functions editor can
-- reuse the same Service/Crockery/Transport Configs UI as the Proposal builder
-- (waiters ratio, hostesses, uniforms, manager on duty, etc.) instead of dead-
-- ending on a "Phase 5" placeholder.

create table if not exists public.event_configs (
  id            uuid primary key default gen_random_uuid(),
  event_id      text not null references public.events(id) on delete cascade,
  dept_id       text not null,
  config_key    text not null,
  config_value  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (event_id, dept_id, config_key)
);
alter table public.event_configs disable row level security;

create index if not exists event_configs_event_id_idx on public.event_configs(event_id);

-- Enable Realtime so open editors see concurrent edits (e.g. two sales reps).
alter publication supabase_realtime add table public.event_configs;
