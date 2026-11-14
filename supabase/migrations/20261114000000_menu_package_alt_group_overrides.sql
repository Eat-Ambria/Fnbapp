-- Per-package override of dishes_master.alt_group (catalogue-wide). Lets one
-- package tag a dish into a choice-group (or explicitly remove it from one)
-- without affecting any other package using the same dish.
-- Shape: { [dishName]: altGroupTag } — "" (empty string) means "no group in
-- this package" explicitly, overriding a non-empty catalogue default.
alter table menu_packages
  add column if not exists alt_group_overrides jsonb not null default '{}'::jsonb;
