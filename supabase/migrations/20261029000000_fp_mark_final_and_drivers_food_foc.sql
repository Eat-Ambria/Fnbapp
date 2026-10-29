-- Split "locked" (freezes editing) from "sent to Kitchen" (notifies Kitchen)
-- so a team can Lock an FP while still drafting it without pinging Kitchen,
-- then use Mark Final once to actually release it.
alter table public.event_function_plans
  add column if not exists sent_to_kitchen boolean not null default false;
alter table public.event_function_plans
  add column if not exists sent_to_kitchen_at timestamptz;
alter table public.event_function_plans
  add column if not exists sent_to_kitchen_by text;

-- Any FP already locked under the old single-button flow was, by definition,
-- already sent to Kitchen at that point.
update public.event_function_plans
  set sent_to_kitchen = true, sent_to_kitchen_at = locked_at, sent_to_kitchen_by = locked_by
  where locked = true;

-- Drivers Food's "Coupon" toggle is repurposed into a "FOC" toggle (waives
-- the charge entirely) — a new column so any event that already had a
-- coupon flagged keeps that signal instead of silently being reinterpreted.
alter table public.event_function_plans
  add column if not exists drivers_food_foc boolean not null default false;
update public.event_function_plans
  set drivers_food_foc = true
  where drivers_food_coupon = true;
