-- Ambria FnB — event_function_plans table (Function Plan / FP)
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
-- One row per event: food preference counts, spice tolerance, allergies, service
-- style notes, and general notes — captured by sales in the Booked Functions
-- editor's new "FP" tab, and printable as a kitchen/service briefing sheet.

create table if not exists public.event_function_plans (
  event_id         text primary key references public.events(id) on delete cascade,
  veg_count        integer,
  nonveg_count     integer,
  jain_count       integer,
  egg_count        integer,
  spice_tolerance  text,          -- 'mild' | 'medium' | 'spicy' | 'extra_spicy'
  allergies        text,          -- free text: nuts, gluten, dairy, halal, kosher, etc.
  service_notes    text,          -- plated vs buffet, live counters, course sequencing, timing
  general_notes    text,          -- open notes box
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
alter table public.event_function_plans disable row level security;

-- Enable Realtime so open editors see concurrent edits.
alter publication supabase_realtime add table public.event_function_plans;
