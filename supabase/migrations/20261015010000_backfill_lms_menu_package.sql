-- One-time backfill closing the bootstrapping gap in the lms_menu_package
-- protection added in 20261015000000_lms_menu_package_tracking.sql: any row
-- that hadn't yet been through a sync since that column was added had
-- lms_menu_package = NULL, so the "did the admin change this since the LMS
-- last reported it" check had no baseline and let that one sync run
-- unprotected -- exactly the revert reported right after the fix went live.
-- Stamping today's menu_package as the baseline for every still-NULL row
-- means only rows already customized before this fix existed mis-baseline
-- (no way to recover their true original LMS value retroactively) --
-- strictly better than every row being unprotected, and every edit from here
-- on is protected correctly regardless.
update public.events
set lms_menu_package = menu_package
where lms_menu_package is null
  and lms_source is not null;
