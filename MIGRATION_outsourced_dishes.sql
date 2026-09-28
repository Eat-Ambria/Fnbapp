-- Outsourced (vendor-supplied) dish tagging.
-- A dish marked outsourced is still shown on the menu, but is excluded from:
--   - Kitchen Hub tracking/prep/planning (see menuArr() in KitchenHub.jsx / EventDayTab.jsx)
--   - Store & Inventory's ingredient demand + ordering (see buildEventBags() in StoreModule.jsx)
-- Toggled from Build Menu (MenuEditor.jsx, via events.outsourced_dishes) and from
-- Menu Builder (MenuBuilderView.jsx, via proposal_items.outsourced), and carried
-- from proposal_items.outsourced into events.outsourced_dishes when a won
-- proposal is converted to a booking (ProposalsView.jsx).

alter table events add column if not exists outsourced_dishes jsonb default '[]'::jsonb;

alter table proposal_items add column if not exists outsourced boolean default false;
