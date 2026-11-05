-- Run this ONLY after:
--   1. 20261110000000_auth_rls_foundation.sql has been applied
--   2. supabase/functions/backfill-staff-auth has been deployed and run
--      successfully (every active staff row has a non-null auth_user_id —
--      confirm with: select count(*) from staff where is_active and
--      auth_user_id is null; it should return 0)
--   3. At least a couple of real staff members have successfully logged in
--      with their existing PIN on the new code
--
-- Once applied, this is irreversible — the plaintext PIN is gone from this
-- table for good (which is the point: it now lives only as the hashed
-- password on the matching auth.users row, never exposed by any API).
-- Do not run this if step 2 hasn't fully succeeded for every active staff
-- member, or anyone still missing an auth_user_id loses access to their PIN
-- entirely with no way to recover it short of an admin resetting them a new
-- one via admin-staff-auth.

alter table public.staff drop column if exists pin;
alter table public.staff drop column if exists pin_changed_at;
