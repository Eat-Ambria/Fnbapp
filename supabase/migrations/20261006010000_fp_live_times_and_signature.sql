-- Four new timing fields on the FP's Timings panel (Chaat end, Snacks end,
-- Live start, Live end), plus a guest signature (drawn on a canvas, stored as
-- a PNG data URL — same approach KitchenHub already uses for the chef's
-- completion signature) and the name of whoever signed.
alter table event_function_plans
  add column if not exists chaat_end_time text,
  add column if not exists snacks_end_time text,
  add column if not exists live_start_time text,
  add column if not exists live_end_time text,
  add column if not exists guest_signature text,
  add column if not exists guest_signature_name text;
