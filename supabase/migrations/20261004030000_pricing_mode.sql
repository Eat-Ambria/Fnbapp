-- Pricing Config (V95) — lets an admin mark a priced item as "flat" (a fixed
-- charge regardless of guest count — Vehicles, Special Pieces, staffing
-- ratios...) instead of always being "per pax". Every row defaults to
-- per_pax, matching how every price on this screen has always been labelled
-- and entered so far — this is additive, no existing number's meaning changes
-- until someone flips it.

alter table public.dish_catalogue_sections
  add column if not exists pricing_mode text not null default 'per_pax'
  check (pricing_mode in ('per_pax', 'flat'));

alter table public.sales_config_defs
  add column if not exists pricing_mode text not null default 'per_pax'
  check (pricing_mode in ('per_pax', 'flat'));

alter table public.sales_config_options
  add column if not exists pricing_mode text not null default 'per_pax'
  check (pricing_mode in ('per_pax', 'flat'));
