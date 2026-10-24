-- Store Requirements → "Add to order list" (+ / + All in the Day Sheet).
-- StoreModule.jsx reads and writes public.store_order_lists, but the table was
-- missing from the database (PostgREST: PGRST205), so every "+" silently failed
-- and nothing survived a reload. One row per ingredient per day.

create table if not exists public.store_order_lists (
  order_date       date        not null,
  ingredient_name  text        not null,
  ingredient_hindi text,
  unit             text,
  qty              numeric,
  list_key         text,
  source           text,
  ordered          boolean     not null default false,
  added_by         text,
  added_at         timestamptz not null default now(),
  ordered_by       text,
  ordered_at       timestamptz,
  primary key (order_date, ingredient_name)
);
alter table public.store_order_lists disable row level security;

-- Realtime: the Order Lists tab subscribes to this table.
do $$
begin
  alter publication supabase_realtime add table public.store_order_lists;
exception when duplicate_object then null;
end $$;
