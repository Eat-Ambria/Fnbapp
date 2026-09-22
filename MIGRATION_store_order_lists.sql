-- Ambria FnB — Store & Inventory "Order Lists" (Dairy / Grocery / Vegetable)
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
--
-- Backs the redesigned Requirements tab (day-wise ordering sheet). Each row
-- there gets two actions: "Issue from Store" (existing store_issues table,
-- unchanged) and "Add to Order list" — which writes here. One ingredient can
-- sit on at most one list per day; re-adding it (to the same or a different
-- list) upserts on (order_date, ingredient_name) rather than creating a
-- duplicate. The Order Lists tab reads every not-yet-ordered row across all
-- days (a buyer's running shopping list), grouped by list_key.

create table if not exists store_order_lists (
  id bigint generated always as identity primary key,
  order_date date not null,
  ingredient_name text not null,
  ingredient_hindi text,
  unit text,
  qty numeric,
  list_key text not null check (list_key in ('dairy','grocery','vegetable')),
  source text,
  ordered boolean not null default false,
  added_by text,
  added_at timestamptz default now(),
  ordered_by text,
  ordered_at timestamptz,
  unique (order_date, ingredient_name)
);

alter table store_order_lists enable row level security;
create policy "public_all" on store_order_lists for all using (true) with check (true);

-- Verify:
select * from store_order_lists limit 20;
