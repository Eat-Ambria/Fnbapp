-- Lets Planning distinguish "nobody has ever touched this event's yield
-- slider" from "a chef explicitly applied a value" — events.yield_multiplier
-- alone can't do that: it already carries a value (1.0) for every event that
-- has never been touched, same as one a chef deliberately pinned back to
-- exactly 100%. New pax-tier auto-defaults (see KitchenHub.jsx) only kick in
-- while yield_multiplier_auto is true; clicking Apply flips it to false,
-- pinning whatever value was applied regardless of what the tier would
-- otherwise suggest.
alter table events
  add column if not exists yield_multiplier_auto boolean not null default true;

-- One-time backfill: the only existing row that isn't exactly the default
-- 1.0 is a real historical pin (everything else has never actually been
-- touched via the slider) — mark it as such so it keeps its own value
-- instead of being recomputed from the new pax-tier default.
update events
  set yield_multiplier_auto = false
  where yield_multiplier is not null and yield_multiplier <> 1.0;
