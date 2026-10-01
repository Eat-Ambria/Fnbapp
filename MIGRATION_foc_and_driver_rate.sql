-- FOC (free of cost) toggle on add-on dishes — excludes that dish from the
-- add-on ₹ total shown in Menu Builder / Event Menu Builder's Live Total.
alter table event_items add column if not exists foc boolean default false;
alter table proposal_items add column if not exists foc boolean default false;

-- Drivers Food rate-per-plate on the Function Plan form.
alter table event_function_plans add column if not exists drivers_food_rate numeric;
