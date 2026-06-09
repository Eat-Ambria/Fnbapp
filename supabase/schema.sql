-- Ambria FnB Operations — Supabase reference schema
-- Run this in Supabase SQL editor to create all required tables.
-- RLS is disabled — the app uses the anon key with no user auth.
-- Enable Realtime on each table via: Supabase Dashboard → Database → Replication

-- ── staff ──────────────────────────────────────────────────────────────
create table if not exists public.staff (
  staff_id       text primary key,
  name           text not null,
  section        text,
  dept           text,
  role           text default 'staff',
  pin            text default '0000',
  is_admin       boolean default false,
  is_active      boolean default true,
  joining        text,
  phone          text,
  custom_screens jsonb,
  permissions    jsonb,
  created_at     timestamptz default now()
);
alter table public.staff disable row level security;

-- ── events ─────────────────────────────────────────────────────────────
create table if not exists public.events (
  id           text primary key,
  guest        text,
  venue        text,
  date         text,
  time         text,
  type         text,
  pax          integer default 0,
  veg          integer default 0,
  nonveg       integer default 0,
  menu_package text,
  menu         jsonb default '[]',
  special      text,
  extras       jsonb default '[]',
  created_at   timestamptz default now()
);
alter table public.events disable row level security;

-- ── attendance ─────────────────────────────────────────────────────────
create table if not exists public.attendance (
  staff_id   text not null,
  date       text not null,
  staff_name text,
  section    text,
  status     text default 'Present',
  in_time    text,
  out_time   text,
  created_at timestamptz default now(),
  primary key (staff_id, date)
);
alter table public.attendance disable row level security;

-- ── leaves ─────────────────────────────────────────────────────────────
create table if not exists public.leaves (
  id         text primary key,
  staff_id   text,
  staff_name text,
  section    text,
  from_date  text,
  to_date    text,
  reason     text,
  status     text default 'Pending',
  created_at timestamptz default now()
);
alter table public.leaves disable row level security;

-- ── kitchen_tracking ───────────────────────────────────────────────────
create table if not exists public.kitchen_tracking (
  ev_id      text not null,
  dish_key   text not null,
  data       jsonb default '{}',
  updated_at timestamptz default now(),
  primary key (ev_id, dish_key)
);
alter table public.kitchen_tracking disable row level security;

-- ── transport_queue ────────────────────────────────────────────────────
create table if not exists public.transport_queue (
  id           text primary key,
  dish_name    text,
  event_guest  text,
  pax          integer default 0,
  venue        text,
  event_date   text,
  prepared_by  text,
  marked_at    text,
  status       text default 'Pending Pickup',
  picked_up_at text,
  created_at   timestamptz default now()
);
alter table public.transport_queue disable row level security;

-- ── repair_tickets ─────────────────────────────────────────────────────
create table if not exists public.repair_tickets (
  id          text primary key,
  title       text,
  description text,
  priority    text,
  status      text default 'Open',
  assign_to   text,
  created_by  text,
  updates     jsonb default '[]',
  photos      jsonb default '[]',
  created_at  timestamptz default now()
);
alter table public.repair_tickets disable row level security;

-- ── Enable Realtime (run once per table) ──────────────────────────────
-- Supabase Dashboard → Database → Replication → enable for each table, OR:
-- begin; select supabase_realtime.subscription_check_filters(); end;
-- alter publication supabase_realtime add table public.staff;
-- alter publication supabase_realtime add table public.events;
-- alter publication supabase_realtime add table public.attendance;
-- alter publication supabase_realtime add table public.leaves;
-- alter publication supabase_realtime add table public.kitchen_tracking;
-- alter publication supabase_realtime add table public.transport_queue;
-- alter publication supabase_realtime add table public.repair_tickets;
