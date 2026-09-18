-- Ambria FnB — Function Plan: timings, room info, equipment add-ons
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
-- Adds three new sections to event_function_plans, same one-row-per-event table
-- the existing FP fields (veg_count, spice_tolerance, allergies...) live on.

alter table public.event_function_plans
  -- Timings
  add column if not exists snacks_time    text,
  add column if not exists baarat_time    text,
  add column if not exists assembly_time  text,
  add column if not exists phera_time     text,
  add column if not exists chaat_time     text,
  add column if not exists windup_time    text,
  -- Room info
  add column if not exists room_check_in  text,
  add column if not exists room_check_out text,
  add column if not exists room_count     integer,
  -- Equipment add-ons (count + price per item) and corkage
  add column if not exists fan_count      integer,
  add column if not exists fan_price      numeric,
  add column if not exists cooler_count   integer,
  add column if not exists cooler_price   numeric,
  add column if not exists heater_count   integer,
  add column if not exists heater_price   numeric,
  add column if not exists corkage_price  numeric;
