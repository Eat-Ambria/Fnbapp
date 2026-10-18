-- Soup Station lists every soup a package offers (8-10 options), but a
-- function only ever actually serves 2-3 of them -- it's a "pick any 2-3"
-- choice, not a default inclusion. The menu builder's initial seed and its
-- "Load defaults" button used to add EVERY package dish as selected,
-- including every soup, leaving the sales rep to manually deselect most of
-- them on every single function. This column lets a catalogue section opt
-- out of that auto-add behavior; app code (menuItemOps.js's
-- filterAutoSeedable, and EventMenuBuilderView.jsx's menuDiffByDept) checks
-- it before bulk-adding or diffing against a package's dish list.
alter table public.dish_catalogue_sections
  add column if not exists no_auto_select boolean not null default false;

update public.dish_catalogue_sections
  set no_auto_select = true
  where name = 'Soup Station';
