-- Per-dish (not whole-section) "don't auto-select by default" flag, for a
-- choice that lives inside an otherwise normal auto-select section (e.g.
-- Main Course has 5 standard dishes plus a 2-way choice between Dish X and
-- Dish Y) — dish_catalogue_sections.no_auto_select already covers a WHOLE
-- section (Soup Station: pick 2-3 of 8-10), this covers a couple of dishes
-- inside a section that otherwise auto-selects everything else.
--
-- alt_group tags dishes that are alternatives of each other (e.g. Dish X and
-- Dish Y both get alt_group = 'mc-paneer-choice') so a client-facing preview
-- can still show them joined as "Dish X / Dish Y" even after the event's
-- actual Function Plan has resolved to just one of them.
alter table public.dishes_master
  add column if not exists no_auto_select boolean not null default false;

alter table public.dishes_master
  add column if not exists alt_group text;

create index if not exists dishes_master_alt_group_idx
  on public.dishes_master (alt_group)
  where alt_group is not null;
