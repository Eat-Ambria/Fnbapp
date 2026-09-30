-- Per-package budget allocation: a per-head (per-pax) total for a menu
-- package, split across the 7 F&B sub-departments. Nothing reads this yet
-- (no billing/costing feature exists) — pure data-entry backend, same as
-- MIGRATION_addon_pricing.sql. See src/components/PackageBudgetView.jsx.

create table if not exists menu_package_budgets (
  package_id      text primary key,
  per_head_total  numeric not null default 0,
  dept_allocation jsonb   not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);
