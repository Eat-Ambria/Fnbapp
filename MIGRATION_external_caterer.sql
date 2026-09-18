-- Ambria FnB — External caterer flag on events
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
-- Marks a function where a THIRD-PARTY caterer is working at an Ambria venue
-- (the reverse of ODC, where Ambria caters at someone else's venue) — so
-- Kitchen Hub can flag it and staff know to be present to observe, not cook.

alter table public.events
  add column if not exists external_caterer boolean not null default false,
  add column if not exists external_caterer_name text;
