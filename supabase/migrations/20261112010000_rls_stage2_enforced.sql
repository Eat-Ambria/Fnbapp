-- Stage 2 of the RLS rollout -- DO NOT apply this until Stage 1
-- (20261112000000_rls_stage1_permissive.sql) has been live for a while
-- through normal shift use with nothing unexpected turning up (realtime
-- still delivering, no screen silently failing to load).
--
-- ALSO DO NOT APPLY until src/App.jsx has been updated to re-load live data
-- (events, kitchen_tracking, transport_queue, staff, config) once a real
-- session exists, not only once at boot before anyone has logged in -- a
-- fresh login happening AFTER the initial anon-context boot load would
-- otherwise see an empty app (no events, no menus, nothing) until a manual
-- reload, since nothing currently re-triggers that load on sign-in. This
-- was invisible under Stage 1 (anon could still read everything, so the
-- boot-time load already had real data regardless of login state) and would
-- only surface once anon access is actually removed here.
--
-- ALSO: the no-login public Function Plan hub (src/App.jsx's `?fp=1` route,
-- src/components/PublicFPHub.jsx) reads `events` (via the app's own anon-
-- context boot load) and queries `event_function_plans` (event_id, locked)
-- directly, with no session at all -- that is its whole point, a link
-- shareable with people who have no app account. Once anon loses all table
-- access here, that page goes permanently blank for everyone, not just until
-- a reload. This migration does not add anything back for it -- doing so
-- needs an explicit decision about what a stranger with the link may see
-- (a narrow anon-readable view of just event_id/locked, a signed-token
-- scheme, or moving this page behind a service-role edge function instead of
-- direct table access) -- not something to default silently one way or the
-- other. Resolve this (or confirm the page can go away / go behind a login)
-- before applying.
--
-- ALSO confirm, before applying, that "Allow new users to sign up" is
-- turned OFF in the Supabase dashboard (Authentication -> Providers ->
-- Email, or Authentication -> Settings depending on dashboard version).
-- Every staff login is provisioned through backfill-staff-auth/
-- admin-staff-auth (service role, admin-gated) -- there is no legitimate
-- reason for public self-signup to be enabled at all, and leaving it on
-- would mean anyone holding the public anon key could call
-- supabase.auth.signUp() themselves and obtain a real `authenticated`
-- session with no linked staff row. The is_active_staff() gate below is a
-- second, independent layer against exactly that (defense in depth, not a
-- substitute for turning signup off) -- it also closes a narrower but real
-- gap: today a *deactivated* staff member's existing session stays valid
-- Auth-side (only the client/UI currently checks is_active) and would
-- otherwise still satisfy a bare `to authenticated` policy until that
-- session's refresh token happens to be revoked some other way.
--
-- This is the migration that actually changes who can get into the
-- database: `anon` loses access to every table entirely from this point on,
-- AND merely holding a valid Supabase Auth session (`authenticated`) is no
-- longer sufficient on its own -- only a session linked to an ACTIVE staff
-- row (is_active_staff()) can read or write anything. This is the actual
-- fix for the original problem this whole effort started from: the anon key
-- is public (shipped in the deployed JS bundle), so before this, anyone who
-- pulled it out of the network tab could read or write the entire database
-- directly, no login required.
--
-- Three buckets, matching the plan:
--   (a) global/shared operational tables -- any active staff member can
--       read/write, same as today's UI already allows in practice (this
--       phase does not attempt dept/role row-level scoping -- see the
--       plan's Context section for why that's deliberately out of scope).
--   (b) admin-sensitive tables -- any active staff member can READ (the UI
--       needs this: staff directory, role/screen hydration, etc), but only
--       an active admin (is_active_admin(), defined in the auth+RLS
--       foundation migration) can write. `app_settings` additionally
--       restricts SELECT to admins too, since it holds the fp_unlock_code
--       bypass secret.
--   (c) append-only tables -- active staff can insert and read, nothing can
--       ever update or delete a row (no policy for those commands at all =
--       default-deny, regardless of role).
-- `staff` deliberately has NO self-update policy (see below) -- the PIN
-- itself is a Supabase Auth password now, changed via
-- supabase.auth.updateUser(), never through a row update at all, and there
-- is no other legitimate self-service write to this table (role/profile
-- edits are an admin-only action in both AccessManager.jsx and TeamHub.jsx).
-- RLS is row-level, not column-level: a policy that let a row update
-- "itself" would let a non-admin PATCH their own role/is_admin/permissions/
-- is_active columns directly via the API, bypassing the UI entirely and
-- self-granting admin -- there is no `with check` that can prevent this
-- (it has no way to compare against the row's OLD values), so the only
-- robust fix is not having a self-update policy at all.
-- Server-only tables (store_issue_ops, fnb_ops_request_log, app_config,
-- lms_masters, lms_sync_log, attendance) already have zero policies since
-- stage 1 -- nothing to change here.

-- is_active_staff(): "is the CURRENT caller linked to an active staff row at
-- all" -- the broader counterpart to is_active_admin(). Every bucket-(a)/(b)
-- read policy below needs this, not a bare `to authenticated using (true)`,
-- precisely because `authenticated` only means "GoTrue issued this session
-- a valid JWT" -- it does NOT mean "this is one of our staff." Without this
-- gate, an account created via public self-signup (if ever enabled) or any
-- other non-staff authenticated identity would pass every one of these
-- policies trivially.
create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.staff
    where auth_user_id = auth.uid()
      and coalesce(is_active, true)
  )
$$;
revoke all on function public.is_active_staff() from public, anon;
grant execute on function public.is_active_staff() to authenticated;

-- app_settings becoming admin-only-SELECT (below) breaks a feature that
-- depends on every active staff member being able to see one row of it:
-- EventMenuBuilderView.jsx's Function Plan re-open code (an admin-set
-- shared PIN staff must enter to unlock an FP someone else marked final).
-- Today that code is read directly off the boot-hydrated app_settings
-- table and compared client-side -- once a non-admin can no longer read
-- that row at all, the code would silently read as "not set", and the
-- whole gate would stop applying for everyone but admins (the unlock flow
-- already treats an empty code as "no code required"). These two functions
-- replace the direct table read: one answers "is a code configured" (safe
-- to expose broadly, reveals nothing but yes/no), the other verifies a
-- guess server-side (also safe -- it only ever returns true/false, same
-- threat model as any password check, never the actual value).
create or replace function public.fp_unlock_code_required()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_staff() and exists (
    select 1 from public.app_settings
    where key = 'fp_unlock_code' and coalesce(value, '') <> ''
  )
$$;

create or replace function public.verify_fp_unlock_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_staff() and exists (
    select 1 from public.app_settings
    where key = 'fp_unlock_code' and value = p_code and coalesce(value, '') <> ''
  )
$$;

revoke all on function public.fp_unlock_code_required() from public, anon;
revoke all on function public.verify_fp_unlock_code(text) from public, anon;
grant execute on function public.fp_unlock_code_required() to authenticated;
grant execute on function public.verify_fp_unlock_code(text) to authenticated;

-- Shared cleanup: drop EVERY existing policy on a table (from any source --
-- this migration's own earlier runs, stage 1, or anything hand-added in the
-- dashboard), not just the names this migration happens to know about. Same
-- reasoning as stage 1's identical block -- a leftover permissive policy
-- from anywhere would OR together with the new restrictive one and silently
-- undo it.
do $$
declare
  t text;
  p record;
  all_tables text[] := array[
    'events', 'kitchen_tracking', 'transport_queue', 'vehicles',
    'transport_dispatch_assignments', 'notifications', 'push_subscriptions',
    'home_venues',
    'store_issues', 'store_issue_assignments', 'store_order_lists',
    'store_transfer_requests', 'ingredient_item_map',
    'menu_packages', 'recipes', 'recipe_categories', 'recipe_ingredients',
    'dishes_master', 'dish_catalogue_sections', 'dish_categories',
    'dish_name_map', 'dish_hindi_map', 'dish_store_map', 'cold_chain_items',
    'checklists', 'menu_package_budgets', 'sales_config_defs',
    'sales_config_options', 'sales_items_meta',
    'event_items', 'event_configs', 'event_function_plans',
    'event_fruit_selections', 'proposals', 'proposal_items',
    'proposal_configs', 'production_plans', 'production_closings',
    'dept_checks', 'odc_checklists',
    'team_departments', 'team_sections', 'vendors', 'vendor_categories',
    'staff_allocation_rules', 'role_definitions', 'screen_definitions',
    'staff', 'app_settings',
    'activity_log', 'ingredient_usage_log'
  ];
begin
  foreach t in array all_tables loop
    if to_regclass('public.' || t) is not null then
      -- Idempotent even if a table somehow reached this stage with RLS still
      -- off (e.g. stage 1 skipped it because to_regclass didn't find it at
      -- the time, and it was created since) -- a stage-2 policy on a table
      -- that never had RLS enabled would be created but entirely inert.
      execute format('alter table public.%I enable row level security', t);
      for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
    else
      raise notice 'rls_stage2: table % not found, skipped', t;
    end if;
  end loop;
end $$;

-- ── (a) global/shared: active staff only, full access ──
do $$
declare
  t text;
  tables text[] := array[
    'events', 'kitchen_tracking', 'transport_queue', 'vehicles',
    'transport_dispatch_assignments', 'notifications', 'push_subscriptions',
    'home_venues',
    'store_issues', 'store_issue_assignments', 'store_order_lists',
    'store_transfer_requests', 'ingredient_item_map',
    'menu_packages', 'recipes', 'recipe_categories', 'recipe_ingredients',
    'dishes_master', 'dish_catalogue_sections', 'dish_categories',
    'dish_name_map', 'dish_hindi_map', 'dish_store_map', 'cold_chain_items',
    'checklists', 'menu_package_budgets', 'sales_config_defs',
    'sales_config_options', 'sales_items_meta',
    'event_items', 'event_configs', 'event_function_plans',
    'event_fruit_selections', 'proposals', 'proposal_items',
    'proposal_configs', 'production_plans', 'production_closings',
    'dept_checks', 'odc_checklists'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      -- Wrapped as a scalar subquery: Postgres then evaluates
      -- is_active_staff() once per query (an initPlan) instead of once per
      -- row -- kitchen_tracking alone runs 6,000+ rows. auth_user_id is
      -- unique/indexed so the per-call cost is already small, but this is a
      -- free win recommended by Supabase's own RLS performance guidance.
      execute format(
        'create policy %I on public.%I for all to authenticated using ((select public.is_active_staff())) with check ((select public.is_active_staff()))',
        t || '_active_staff_all', t
      );
    end if;
  end loop;
end $$;

-- ── (b) admin-sensitive: active staff read, admin-only write ──
do $$
declare
  t text;
  tables text[] := array[
    'team_departments', 'team_sections', 'vendors', 'vendor_categories',
    'staff_allocation_rules', 'role_definitions', 'screen_definitions'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'create policy %I on public.%I for select to authenticated using ((select public.is_active_staff()))',
        t || '_select_active_staff', t
      );
      execute format(
        'create policy %I on public.%I for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()))',
        t || '_write_admin', t
      );
    end if;
  end loop;
end $$;

-- staff: active staff can read the directory; only admin can write. No
-- self-update policy at all -- see the header comment for why.
do $$
begin
  if to_regclass('public.staff') is not null then
    execute 'create policy staff_select_active_staff on public.staff for select to authenticated using ((select public.is_active_staff()))';
    execute 'create policy staff_write_admin on public.staff for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()))';
  end if;
end $$;

-- app_settings: write is admin-only (is_active_admin() already implies
-- active staff, no separate gate needed); SELECT is ALSO admin-only here,
-- not just active-staff, since this table holds fp_unlock_code.
do $$
begin
  if to_regclass('public.app_settings') is not null then
    execute 'create policy app_settings_select_admin on public.app_settings for select to authenticated using ((select public.is_active_admin()))';
    execute 'create policy app_settings_write_admin on public.app_settings for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()))';
  end if;
end $$;

-- ── (c) append-only: active staff insert + select, no update/delete ever ──
do $$
declare
  t text;
  tables text[] := array['activity_log', 'ingredient_usage_log'];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check ((select public.is_active_staff()))',
        t || '_insert_active_staff', t
      );
      execute format(
        'create policy %I on public.%I for select to authenticated using ((select public.is_active_staff()))',
        t || '_select_active_staff', t
      );
    end if;
  end loop;
end $$;
