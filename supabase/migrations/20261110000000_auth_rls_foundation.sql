-- Stage 0 of the auth+RLS rollout (see the "Real auth + RLS policies"
-- plan — Supabase Auth version). Adds the link from a staff row to its
-- real Supabase Auth account, the helper functions RLS policies will build
-- on, and the two session-revocation RPCs admin-staff-auth/App.jsx need
-- (deleting a user's auth.sessions/auth.refresh_tokens rows directly is the
-- correct way to force-revoke by user id -- supabase.auth.admin.signOut()
-- takes an ACCESS TOKEN, not a user id, so it cannot be used for this at
-- all). Does NOT enable RLS on anything yet, and does NOT drop staff.pin
-- yet either -- see the ordering note below. That's stages 1/2 and a
-- separate later migration, applied once this stage is live and confirmed
-- working (PIN login, realtime, self-service reset).
--
-- Run supabase/functions/backfill-staff-auth once, AFTER this migration and
-- AFTER deploying both new edge functions, to create the matching
-- auth.users row + populate auth_user_id for every existing staff member —
-- see that function's own header for details. Nothing in the app can log
-- anyone in until that backfill has run at least once.
--
-- IMPORTANT ORDERING NOTE: this migration deliberately does NOT drop
-- staff.pin yet, even though the whole point of this change is to stop
-- storing it there — the backfill function above still needs to READ each
-- row's existing pin to create the matching auth.users password. Dropping
-- the column here would destroy every staff member's PIN before anything
-- had a chance to carry it over, locking out the entire staff list
-- permanently. The column drop is a SEPARATE, LATER migration
-- (20261110010000_drop_staff_pin_column.sql) — only run that one after
-- confirming the backfill succeeded and a few real logins work.

-- on delete set null: if an auth.users row is ever deleted while a staff
-- row still points at it (a delete-order race between the staff-row delete
-- and admin-staff-auth's own `delete` action, which the client fires
-- without waiting on each other), the default FK action (no action) would
-- reject the auth.users delete outright, leaving the account orphaned and
-- blocking a future re-add under the same staff_id. Letting the link null
-- out instead means the delete always succeeds regardless of ordering.
alter table public.staff add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- current_staff_id(): resolves the calling session's real Supabase Auth
-- user (auth.uid(), native once signed in via supabase.auth.signInWithPassword)
-- to this app's own staff_id. SECURITY DEFINER so it keeps working no
-- matter what RLS policy ends up protecting `staff` in later stages — it's
-- also called FROM INSIDE other tables' policies (is_active_admin() below,
-- and the stage-2 staff policies), and running as the invoking role would
-- make it subject to staff's own RLS, which would need to call this
-- function to evaluate — a circular trap. search_path is pinned
-- explicitly, the standard hardening for SECURITY DEFINER functions
-- against a search-path hijack.
create or replace function public.current_staff_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select staff_id from public.staff where auth_user_id = auth.uid()
$$;

-- is_active_admin(): "is the CURRENT caller an active admin?", re-read
-- fresh from the live staff table on every call -- a role change in Access
-- Manager (already propagated to every open session in real time) takes
-- effect in RLS immediately, not just on next login.
create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.staff
    where staff_id = public.current_staff_id()
      and role = 'admin'
      and coalesce(is_active, true)
  )
$$;

grant execute on function public.current_staff_id() to anon, authenticated;
grant execute on function public.is_active_admin() to anon, authenticated;

-- admin_revoke_user_sessions(): force-revokes an ARBITRARY user's sessions
-- by id. Deleting auth.refresh_tokens first, then auth.sessions, avoids any
-- FK-ordering issue regardless of whether refresh_tokens.session_id cascades
-- (refresh_tokens.user_id is text in GoTrue's schema, hence the cast).
-- Revoking only invalidates future refresh attempts -- an already-issued
-- access token keeps working until it naturally expires (same reasoning as
-- this project's earlier custom-JWT design). service_role only: this can
-- target ANY user, so it must never be callable by an ordinary authenticated
-- session -- only admin-staff-auth (service-role edge function) calls it.
create or replace function public.admin_revoke_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  delete from auth.sessions where user_id = p_user_id;
end;
$$;
-- `revoke ... from public` alone does NOT lock this down -- Supabase's base
-- setup runs `alter default privileges in schema public grant execute on
-- functions to anon, authenticated` project-wide, so a newly created
-- function gets its own EXECUTE grants for those two roles independently of
-- whatever PUBLIC holds. Revoking from public is a no-op against that.
-- Without the explicit revokes below, ANYONE holding the public anon key
-- (shipped in the deployed JS bundle, no login required) could call this
-- directly and force-logout any staff member on demand.
revoke all on function public.admin_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_user_sessions(uuid) to service_role;

-- revoke_my_other_sessions(): the self-service equivalent, callable directly
-- by an ordinary logged-in staff member after changing their own PIN
-- (App.jsx's savePinReset) -- safe to grant broadly because it always
-- targets auth.uid() (the caller's own verified identity, never an
-- argument), so it can never be used to revoke anyone else's sessions.
--
-- Despite the name, a version that deleted ALL of auth.uid()'s sessions
-- would also kill the CALLER's own just-created session (savePinReset's
-- confirm-current-PIN step signs in again right before this runs) -- not
-- immediately (the current access token keeps working until it naturally
-- expires), but about an hour later the person who just changed their PIN
-- would be confusingly signed out with "Your PIN was reset" for a reset
-- THEY made. GoTrue's JWT carries a session_id claim identifying the
-- session the current request is authenticated under; excluding it is what
-- makes this genuinely "other" sessions. If a token predates that claim
-- existing, auth.jwt()->>'session_id' is null and the comparisons below are
-- null too, so Postgres's three-valued logic makes the whole WHERE clause
-- evaluate to unknown/false for every row -- the delete safely matches
-- nothing rather than deleting everything (including the current session)
-- by accident.
create or replace function public.revoke_my_other_sessions()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from auth.refresh_tokens
    where user_id = auth.uid()::text
      and session_id <> (auth.jwt()->>'session_id')::uuid;
  delete from auth.sessions
    where user_id = auth.uid()
      and id <> (auth.jwt()->>'session_id')::uuid;
end;
$$;
-- Calling this as anon is harmless by construction (auth.uid() is null for
-- an unauthenticated caller, so every WHERE clause above matches nothing),
-- but revoking anon's default-privilege execute grant explicitly keeps this
-- consistent with admin_revoke_user_sessions' treatment above rather than
-- relying on that safety margin implicitly.
revoke all on function public.revoke_my_other_sessions() from public, anon;
grant execute on function public.revoke_my_other_sessions() to authenticated;
