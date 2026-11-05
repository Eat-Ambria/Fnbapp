-- Stage 1 of the RLS rollout (see the "Real auth + RLS policies" plan).
-- Enables RLS on every table the app touches, but with a BLANKET permissive
-- policy -- `using (true) with check (true)` for BOTH anon and authenticated
-- -- so behavior is functionally IDENTICAL to today (anon can still do
-- everything it already could). The entire point of this stage is to prove
-- the RLS + Realtime plumbing actually works end-to-end (every table was
-- actually found and enabled, Realtime still delivers postgres_changes
-- payloads once RLS is on -- a known gotcha category) BEFORE anyone's
-- actual access changes at all. Stage 2 (a separate, later migration) drops
-- anon from these policies and layers in the real admin-gating; apply it
-- only once this stage has been live through normal shift use with nothing
-- unexpected turning up.
--
-- Table names are enumerated here from this session's audit of what the
-- client code actually touches (grepping every dbLoad/dbUpsert/dbSubscribe/
-- supabase.from() call site across src/) -- most of these tables were
-- created directly in the Supabase dashboard and have no tracked migration
-- of their own, so there's no CREATE TABLE to anchor this against. Each one
-- is checked with to_regclass before touching it, so a name that's wrong or
-- a table that's since been renamed/dropped is silently skipped rather than
-- aborting the whole migration -- which would otherwise block every other
-- table in the same transaction. If a new table is added to the app later,
-- add it to the LATEST-stage migration's table list (write a new migration
-- that enables RLS + the stage-2-shape policy directly) -- do NOT re-run
-- this stage-1 file after stage 2 has been applied, since it would put a
-- `using (true)` policy for anon back onto every table and silently undo
-- stage 2's actual access boundary.
--
-- Every table's policies are dropped and recreated from a live lookup
-- (pg_policies), not just the names this migration itself would have
-- created -- this project had a pre-existing, never-cleaned-up "public_all"
-- policy on staff/events/kitchen_tracking from before RLS was even a
-- consideration (supabase/setup.sql), left dormant (but NOT dropped) when
-- those tables later had RLS explicitly disabled (supabase/schema.sql).
-- Policies for the same command are OR'd together in Postgres, so a
-- leftover permissive policy from any source -- this one, a hand-added
-- dashboard policy, anything -- would silently make stage 2's tightening a
-- no-op on that table. Dropping everything found and replacing it with
-- exactly the policy this migration intends is the only way to be sure.
--
-- Excludes a set of server-only tables, touched only by edge functions using
-- the service role: these get RLS enabled with ZERO policies in this same
-- migration (a default-deny for anon/authenticated starting now, not
-- staged), since there's no legitimate client access to gate in the first
-- place and zero functional impact either way (service role bypasses RLS
-- regardless).

do $$
declare
  t text;
  p record;
  tables text[] := array[
    -- core / operational
    'events', 'kitchen_tracking', 'transport_queue', 'vehicles',
    'transport_dispatch_assignments', 'notifications', 'push_subscriptions',
    'home_venues',
    -- store / inventory
    'store_issues', 'store_issue_assignments', 'store_order_lists',
    'store_transfer_requests', 'ingredient_item_map', 'ingredient_usage_log',
    -- kitchen / recipes / menu config
    'menu_packages', 'recipes', 'recipe_categories', 'recipe_ingredients',
    'dishes_master', 'dish_catalogue_sections', 'dish_categories',
    'dish_name_map', 'dish_hindi_map', 'dish_store_map', 'cold_chain_items',
    'checklists', 'menu_package_budgets', 'sales_config_defs',
    'sales_config_options', 'sales_items_meta',
    -- events / sales detail
    'event_items', 'event_configs', 'event_function_plans',
    'event_fruit_selections', 'proposals', 'proposal_items',
    'proposal_configs', 'production_plans', 'production_closings',
    -- dept / checklists
    'dept_checks', 'odc_checklists',
    -- team (non-admin-sensitive master data; staff itself is handled below)
    'team_departments', 'team_sections', 'vendors', 'vendor_categories',
    'staff_allocation_rules',
    -- admin-sensitive (permissive in this stage too -- tightened in stage 2)
    'staff', 'role_definitions', 'screen_definitions', 'app_settings',
    -- append-only / audit (permissive in this stage too -- tightened in stage 2)
    'activity_log'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      -- Drop EVERY existing policy on this table, from any source, not just
      -- the one this migration itself would have created -- see the header
      -- comment on why a leftover policy from elsewhere is a real risk.
      for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
      execute format(
        'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
        t || '_stage1_permissive', t
      );
    else
      raise notice 'rls_stage1: table % not found, skipped', t;
    end if;
  end loop;
end $$;

-- Server-only tables: RLS on, zero policies, from this stage onward -- not a
-- "stage 1 then stage 2" progression, there's nothing to stage, since client
-- code never touches these at all (lms-sync/store-requisition-sync/
-- ops-req-router/cleanup-attendance-photos/send-push all use the service
-- role, which bypasses RLS regardless).
do $$
declare
  t text;
  p record;
  tables text[] := array[
    'store_issue_ops', 'fnb_ops_request_log',
    'app_config', 'lms_masters', 'lms_sync_log', 'attendance'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
    else
      raise notice 'rls_stage1: server-only table % not found, skipped', t;
    end if;
  end loop;
end $$;
