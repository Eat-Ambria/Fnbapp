-- Ambria FnB — Function Plan: drivers food
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).

alter table public.event_function_plans
  add column if not exists drivers_food_required boolean not null default false,
  add column if not exists drivers_food_count    integer,
  add column if not exists drivers_food_coupon   boolean;
