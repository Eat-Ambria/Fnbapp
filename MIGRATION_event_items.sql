-- Ambria FnB — event_items table (Booked Functions menu editor)
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
-- Mirrors proposal_items' shape so the sales-facing Booked Functions editor can
-- reuse the same multi-dept item-picking UI as the Proposal builder.

create table if not exists public.event_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null references public.events(id) on delete cascade,
  dish_name   text not null,
  is_addon    boolean not null default false,
  ordering    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (event_id, dish_name)
);
alter table public.event_items disable row level security;

create index if not exists event_items_event_id_idx on public.event_items(event_id);

-- One-time seed flag: whether this event's existing flat `menu` array has already
-- been migrated into event_items (mirrors proposals.menu_initialized).
alter table public.events add column if not exists event_items_initialized boolean not null default false;

-- Enable Realtime so open editors see concurrent edits (e.g. two sales reps).
alter publication supabase_realtime add table public.event_items;
