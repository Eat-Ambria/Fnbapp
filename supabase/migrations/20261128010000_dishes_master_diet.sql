-- Egg dietary classification for the Dish Library's veg/non-veg toggle.
-- dishes_master.is_veg (boolean) can only encode veg/non-veg/unclassified --
-- adds a `diet` text column alongside it (left in place, unused, as a
-- migration safety net, same pattern as dish_section_links/section_id) using
-- the SAME vocabulary the separate Sales Catalogue screen's own DIET_TAGS
-- already defines (src/data/salesConfig.js): 'veg' | 'nonveg' | 'egg' |
-- 'jain' | null (unclassified). The Dish Library's veg/non-veg/egg cycle
-- (DishSectionsEditor.jsx, DishLibrary.jsx, MenuPackagesView.jsx) only ever
-- writes 'veg'/'nonveg'/'egg'/null -- 'jain' is allowed here purely for
-- forward compatibility with that same vocabulary; nothing writes it into
-- THIS column today (the Sales Catalogue screen's own 'jain' option writes
-- to the separate sales_items_meta.diet_tag, not here). Every reader of
-- this column still renders a real color/label for an unexpected value
-- rather than assuming only the 3 states this screen's own cycle produces.
alter table public.dishes_master add column if not exists diet text;
alter table public.dishes_master drop constraint if exists dishes_master_diet_check;
alter table public.dishes_master add constraint dishes_master_diet_check
  check (diet is null or diet in ('veg', 'nonveg', 'egg', 'jain'));

-- One-time backfill from the legacy boolean. Safe to re-run (only touches
-- rows where diet is still unset).
update public.dishes_master
set diet = case when is_veg = true then 'veg' when is_veg = false then 'nonveg' else null end
where diet is null and is_veg is not null;
