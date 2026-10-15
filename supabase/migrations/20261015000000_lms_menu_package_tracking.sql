-- Tracks the menu package name as LAST REPORTED BY THE LMS, separate from
-- events.menu_package (the live, admin-editable value). lms-sync compares
-- the two to tell "LMS changed the booking's package" (safe to re-sync)
-- apart from "the admin picked a different package in the app after the
-- last sync" (must be preserved) -- previously it could only detect the
-- admin going fully custom/blank, so re-picking a different NAMED package
-- (e.g. Non Veg -> Veg) was silently reverted on the next LMS auto-sync.
alter table public.events add column if not exists lms_menu_package text;
