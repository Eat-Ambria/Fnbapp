-- Ambria FnB — Function Plan: add Jaimala + Main course timing fields
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).

alter table public.event_function_plans
  add column if not exists jaimala_time     text,
  add column if not exists main_course_time text;
