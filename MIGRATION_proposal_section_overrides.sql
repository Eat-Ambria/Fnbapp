-- Ambria FnB — per-proposal menu-section tags for custom dishes added in the
-- Proposal Menu Builder (mirrors events.menu_section_overrides, already used
-- by Build Menu for the same purpose).
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).

alter table public.proposals add column if not exists menu_section_overrides jsonb not null default '{}'::jsonb;
