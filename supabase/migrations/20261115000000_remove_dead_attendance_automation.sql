-- Attendance/leave tracking was removed from the app on 2026-10-16 (see
-- CLAUDE.md), but two automated cron jobs kept running against it anyway --
-- an orphaned weekly photo cleanup and an orphaned hourly "auto-close
-- stale attendance" job, neither one called from anywhere in this codebase
-- any more. Flagged during a 2026-11-15 audit (prompted by the same day's
-- lms-sync incident, which was about a DIFFERENT kind of unattended
-- automation, but surfaced this one too while looking for the pattern).
--
-- This removes the automation only, not the underlying data: the
-- `attendance` table and its `attendance-photos` storage bucket are left
-- untouched -- whether to actually purge that historical data is a
-- separate, deliberate decision for later, not something to fold into a
-- "remove dead code" cleanup.

-- cron.unschedule('name') errors out (aborting the rest of this script) if
-- no job has that exact name -- confirmed live right now, but not something
-- to assume stays true forever (re-runs, other environments). Unscheduling
-- by jobid from a SELECT instead is a no-op when nothing matches.
do $$
declare
  j record;
begin
  for j in select jobid from cron.job where jobname in ('cleanup-attendance-photos', 'auto-close-stale-attendance') loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

drop function if exists public.auto_close_stale_attendance();
drop function if exists public.auto_close_stale_attendance(double precision);
