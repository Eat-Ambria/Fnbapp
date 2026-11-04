-- odc_checklists does not exist in production (confirmed live against the
-- linked project's pg_class/pg_namespace catalogs — only dept_checks,
-- checklists, and vehicles exist under public; odc_checklists is absent).
-- ODCModule.jsx has unconditionally queried/upserted it since long before
-- this Tier B pass, so every one of its reads has been failing with
-- undefined_table (42P01) in production THE WHOLE TIME — the per-event ODC
-- checklist feature (Site Recce/Equipment/Dispatch/On-site/Teardown tabs)
-- has never actually persisted anything; every load silently (or now,
-- post-Tier-B, visibly via the new error banner) fails and every tick was
-- discarded. This is not a renamed/relocated table — `checklists` is an
-- unrelated, pre-existing TEMPLATE table (grouped by `type`, loaded via
-- dbConfig.js's loadTable('checklists',...)) that ODCModule.jsx's own
-- `resolveTemplate` already reads separately for the checklist item
-- DEFINITIONS; odc_checklists holds the separate PER-EVENT CHECKED STATE
-- and was simply never created.
--
-- Columns/PK match exactly what ODCModule.jsx already sends (onConflict:
-- "ev_id,phase", .select("items,notes")/.select("*") keyed by ev_id+phase).
create table if not exists public.odc_checklists (
  ev_id      text        not null,
  phase      text        not null,
  items      jsonb       not null default '[]'::jsonb,
  notes      text,
  updated_at timestamptz not null default now(),
  primary key (ev_id, phase)
);
alter table public.odc_checklists disable row level security;

-- Three tables this push adds a realtime subscriber for (DeptView.jsx's
-- dept_checks ODC/Service/Crockery tabs, ODCModule.jsx's odc_checklists
-- above, TransportDispatch.jsx's live fleetList) may or may not already be
-- in the supabase_realtime publication — dept_checks' own migration
-- (20261104000000_dept_checks.sql) never added it, odc_checklists is brand
-- new as of this file, and vehicles predates migrations entirely (created
-- directly in the dashboard, confirmed to exist live). Each ADD is wrapped
-- to no-op if it's already a member, the same pattern
-- 20261016000000_transport_dispatch_assignments.sql uses.
do $$
begin
  alter publication supabase_realtime add table public.dept_checks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.odc_checklists;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.vehicles;
exception when duplicate_object then null;
end $$;
