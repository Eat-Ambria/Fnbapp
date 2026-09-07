-- Ambria FnB — per-event menu-section tags for Build Menu
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
-- Lets Build Menu tag a dish (usually a custom/extra one not already listed in
-- the package's own section) with which of that package's sections it should
-- display under, WITHOUT touching the shared menu_packages/section definition.
-- Scoped to the one event only — { [dish_name]: section_id }.

alter table public.events add column if not exists menu_section_overrides jsonb not null default '{}'::jsonb;
