-- Ambria FnB — Function Plan redesign: per-section on/off flags + corkage details
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).

alter table public.event_function_plans
  add column if not exists room_info_enabled boolean not null default false,
  add column if not exists fan_enabled       boolean not null default false,
  add column if not exists cooler_enabled    boolean not null default false,
  add column if not exists heater_enabled    boolean not null default false,
  add column if not exists corkage_details   text;
