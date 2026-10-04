-- Pricing Config (V95 follow-up) — some configs (standard crockery, service,
-- display setups...) are included in every package by default, so picking
-- them should never add to the price. This is a config-level flag only
-- (sales_config_defs/options) — deliberately NOT on dish_catalogue_sections,
-- since food/dish sections are never "included for free" the same way.

alter table public.sales_config_defs
  add column if not exists is_included boolean not null default false;

alter table public.sales_config_options
  add column if not exists is_included boolean not null default false;
