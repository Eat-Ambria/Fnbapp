-- DeptView.jsx's Service/Crockery/Beverages/Fruits/Transport-loading/ODC
-- checklists lived only in useState and were lost on refresh or logout, with
-- no other tablet ever seeing them. One row per checked item so a toggle is
-- always a single-row upsert -- never a whole-event JSON blob to reconstruct,
-- which is the exact bug class (silently dropping a field on every write)
-- this app has been bitten by repeatedly elsewhere.
create table if not exists public.dept_checks (
  event_id   text        not null,
  dept       text        not null, -- service|crockery|beverages|fruits|transport_load|odc
  item_key   text        not null,
  value      jsonb       not null,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (event_id, dept, item_key)
);
alter table public.dept_checks disable row level security;
