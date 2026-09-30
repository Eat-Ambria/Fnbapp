-- Add-on pricing: per-pax price for extras beyond the base package/config.
-- Nothing reads these yet (no quotation/billing feature exists in the app
-- today) — this is the data-entry backend for whichever pricing feature
-- consumes it next. See src/components/PricingConfigView.jsx.

-- Kitchen: price charged per pax when a dish from this catalogue section is
-- added as an "extra" beyond the package (dish_catalogue_sections.dept = 'kitchen').
alter table dish_catalogue_sections add column if not exists addon_price_per_pax numeric default 0;

-- Other depts (Beverage/Bakery/Fruits/Service/Crockery/Transport): price
-- charged per pax for picking this specific option within a config (e.g.
-- "Premium Crystal" glassware, "Premium" bartender ratio).
alter table sales_config_options add column if not exists price_per_pax numeric default 0;

-- 'count' type configs have no options list — a single per-unit-per-pax rate
-- lives on the def itself (e.g. each extra staff member costs X per pax).
alter table sales_config_defs add column if not exists price_per_pax numeric default 0;
