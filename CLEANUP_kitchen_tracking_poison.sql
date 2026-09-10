-- Ambria FnB — remove poisoned kitchen_tracking rows
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
--
-- Some pre-existing rows in kitchen_tracking have dish_key set to one of the
-- table's OWN column names ("ev_id", "dish_key", "data", "updated_at" — seen
-- so far; also guarding "id"/"created_at" in case), with that column's own
-- value stored as "data". The app was loading these as if they were real
-- per-dish tracking state; since "updated_at" drifts every time the row is
-- touched, the app's sync effect saw it as "changed" on every cycle and kept
-- re-uploading it forever — thousands of pointless requests per session,
-- which is what was slowing down (and occasionally hanging) unrelated
-- screens like the Dish Library merge. The app now ignores these keys
-- outright (see KT_RESERVED_KEYS in src/App.jsx), so this is just data
-- cleanup — safe to run any time, does not touch real dish tracking rows.

-- 1) Preview what will be deleted — sanity-check the count first.
select dish_key, count(*) as n
from kitchen_tracking
where dish_key in ('id', 'ev_id', 'dish_key', 'data', 'created_at', 'updated_at')
group by dish_key
order by n desc;

-- 2) Delete them.
delete from kitchen_tracking
where dish_key in ('id', 'ev_id', 'dish_key', 'data', 'created_at', 'updated_at');
