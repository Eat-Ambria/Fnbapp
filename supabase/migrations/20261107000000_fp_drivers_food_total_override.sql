-- Drivers Food total was always a read-only rate*pax figure (floored at
-- ₹30,000). Sales sometimes agrees a different total with the client, so
-- it needs to be editable — still never saved below the ₹30,000 floor,
-- enforced client-side in FunctionPlanTab.jsx's commitDriversFoodTotal().
-- Null means "no override, use the computed rate*pax total".
alter table public.event_function_plans
  add column if not exists drivers_food_total_override numeric;
