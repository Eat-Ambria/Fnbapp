-- Per-package override for "Don't auto-select by default".
--
-- dishes_master.no_auto_select (and dish_catalogue_sections.no_auto_select)
-- are catalogue-wide: a dish that's "pick 1 of a few" in one package can
-- genuinely be a straightforward auto-add in another. This column lets a
-- package override the catalogue default for specific dishes without
-- changing it everywhere else.
--
-- Shape: { "<dish name>": true | false }
--   true  -> never auto-select this dish in this package, regardless of
--            the catalogue default.
--   false -> always auto-select this dish in this package, regardless of
--            the catalogue default.
--   absent -> fall back to the catalogue default (unchanged behavior).
alter table menu_packages
  add column if not exists no_auto_select_overrides jsonb not null default '{}'::jsonb;
