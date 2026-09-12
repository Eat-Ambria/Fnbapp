-- Ambria FnB — add "Fruits" as a real staff department + section
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
--
-- The app-side code for the new Fruits Ops screen (D-1 Store Req / Live Prep /
-- Menu tabs, mirroring Beverages) and its SOP recipe category (used to tag
-- dishes like "3+3 Fruits" so they route here instead of Kitchen/Beverages)
-- are already deployed. This is the one remaining piece: the anon key used by
-- the app is blocked by row-level security from inserting into
-- team_departments/team_sections directly (recipe_categories allowed it, these
-- two did not), so these two rows need to be added from here instead.
--
-- Safe to run any time — idempotent (upsert on id / name).

insert into team_departments (id, label, icon, sort_order, is_active, label_hi)
values ('fruits', 'Fruits', '🍓', 135, true, 'फल')
on conflict (id) do update set
  label = excluded.label,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  label_hi = excluded.label_hi;

insert into team_sections (name, dept_id, sort_order, is_active, label_hi)
values ('Fruits', 'fruits', 10, true, 'फल')
on conflict (name) do update set
  dept_id = excluded.dept_id,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  label_hi = excluded.label_hi;

-- Verify:
select * from team_departments where id = 'fruits';
select * from team_sections where dept_id = 'fruits';
