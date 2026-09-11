-- Ambria FnB — per-function fruit-counter selections
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
--
-- "3+3 Fruits" / "4 Indian Fruits" / "5 Indian & 5 Imported Fruits" style
-- dishes have no fixed recipe or inventory item — the specific fruits vary
-- per function (whatever's in season / available that day). Instead of
-- tagging them to a fixed SOP category, Fruits Ops picks the ACTUAL fruits
-- for that specific function from the real Ops inventory catalog (the same
-- catalog Dish Library's Inventory tab already searches), and this table is
-- what those picks land in. Store & Inventory reads it back (see
-- StoreModule.jsx buildEventBags) and folds each pick into the normal
-- smart-issue pipeline via ops_inventory_id, same as any other inventory-
-- mapped dish.
--
-- Detection of which dishes these are is name-pattern based (see
-- parseFruitSpec/isFruitSelectionDish in src/data/recipeData.js) — no
-- dish_categories tag needed or used.

create table if not exists event_fruit_selections (
  id bigint generated always as identity primary key,
  event_id text not null,
  dish_name text not null,
  side text not null check (side in ('indian','imported')),
  ops_item_id text not null,
  ops_item_name text not null,
  ops_item_hindi text,
  ops_item_unit text default 'Pieces',
  ops_inventory_id text,
  qty_per_cover numeric not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (event_id, dish_name, ops_item_id)
);

alter table event_fruit_selections enable row level security;
create policy "public_all" on event_fruit_selections for all using (true) with check (true);

-- Verify:
select * from event_fruit_selections limit 20;
