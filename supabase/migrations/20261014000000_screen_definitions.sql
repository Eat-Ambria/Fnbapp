-- Manage Screens — makes SCREEN_PERMISSIONS's label/icon/group/order
-- (src/data/permissions.js) editable from Access Manager instead of
-- hardcoded-only, same pattern as role_definitions (V93). The fine-grained
-- perms list under each screen stays code-defined (it's tied to real
-- actions implemented in that screen's component), but which group a
-- screen's nav entry falls under, its label/icon, its position, and
-- whether it's hidden app-wide are now DB-backed.
--
-- is_hidden lets an admin disable a screen for EVERYONE without touching
-- code — there's no true delete here, since a screen_key always corresponds
-- to a real component (renderScreen()'s switch in App.jsx); removing the
-- row entirely would just mean the next hydrate falls back to its seeded
-- default instead of actually removing anything.
create table if not exists public.screen_definitions (
  screen_key text primary key,
  label      text not null,
  icon       text,
  group_name text,
  sort_order int not null default 0,
  is_builtin boolean not null default false,
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.screen_definitions disable row level security;

insert into public.screen_definitions (screen_key, label, icon, group_name, sort_order, is_builtin) values
  ('dashboard',        'Dashboard',          '📊', null,          0, true),
  ('kitchen',          'Kitchen Hub',        '👨‍🍳', null,          1, true),
  ('menus',            'Menu Packages',      '📜', null,          2, true),
  ('transport',        'Transport',          '🚛', 'OPERATIONS',  3, true),
  ('store',            'Store & Inventory',  '📦', 'OPERATIONS',  4, true),
  ('vendors',          'Vendor Directory',   '📇', 'OPERATIONS',  5, true),
  ('dept_service',     'Service Ops',        '🍽', 'OPERATIONS',  6, true),
  ('dept_crockery',    'Crockery Ops',       '🍶', 'OPERATIONS',  7, true),
  ('dept_beverages',   'Beverages Ops',      '🥤', 'OPERATIONS',  8, true),
  ('dept_fruits',      'Fruits Ops',         '🍓', 'OPERATIONS',  9, true),
  ('dept_odc',         'ODC Operations',     '🏕', 'OPERATIONS', 10, true),
  ('proposals',        'Proposals',          '📝', 'SALES',      11, true),
  ('sales_catalogue',  'Sales Catalogue',    '🏷️', 'SALES',      12, true),
  ('booked_functions', 'Booked Functions',   '📅', 'SALES',      13, true),
  ('team',             'Team',               '👥', 'MANAGEMENT', 14, true),
  ('access',           'Access Manager',     '🔐', 'MANAGEMENT', 15, true),
  ('logs',             'Activity Log',       '📋', 'MANAGEMENT', 16, true)
on conflict (screen_key) do nothing;
