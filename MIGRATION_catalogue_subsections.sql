-- Ambria FnB — one level of subsections for Dish Library catalogue sections
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
-- A subsection is just another dish_catalogue_sections row with a parent —
-- dishes still assign via the existing dishes_master.section_id FK, to
-- either a top-level section or one of its subsections. ON DELETE SET NULL
-- means deleting a parent section un-nests its subsections (they become
-- top-level) rather than deleting them.

alter table public.dish_catalogue_sections
  add column if not exists parent_section_id uuid references public.dish_catalogue_sections(id) on delete set null;
