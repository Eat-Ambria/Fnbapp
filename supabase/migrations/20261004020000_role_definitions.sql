-- Role Manager (V93) — makes PRESET_ROLES (src/data/permissions.js) editable
-- from Access Manager instead of hardcoded-only. Seeded with the roles that
-- used to live only in code, flagged is_builtin so the UI can tell those
-- apart from roles created later (built-ins can have their tab bundle
-- edited but not their role_key deleted/renamed).

create table if not exists public.role_definitions (
  role_key   text primary key,
  label      text not null,
  icon       text,
  tier       int not null default 2,
  screens    jsonb not null default '[]'::jsonb,
  elevated   jsonb not null default '[]'::jsonb,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.role_definitions disable row level security;

insert into public.role_definitions (role_key, label, icon, tier, screens, elevated, is_builtin) values
  ('admin', 'Admin — Full Access', '👑', 4,
    '["dashboard","kitchen","store","team","transport","vendors","menus","access","dept_service","dept_crockery","dept_beverages","dept_fruits","dept_odc","proposals","sales_catalogue","booked_functions"]',
    '[]', true),
  ('head_chef', 'Head Chef', '👨‍🍳', 3,
    '["dashboard","kitchen","menus","store","team","transport"]',
    '["kitchen.scaling_apply","team.leave_approve"]', true),
  ('service', 'Service Dept', '🍽', 2, '["dashboard","dept_service","team","vendors"]', '[]', true),
  ('crockery', 'Crockery Dept', '🍶', 2, '["dashboard","dept_crockery","team","store"]', '[]', true),
  ('beverages', 'Beverages Dept', '🥤', 2, '["dashboard","dept_beverages","menus","team","store"]', '[]', true),
  ('fruits', 'Fruits Dept', '🍓', 2, '["dashboard","dept_fruits","menus","team","store"]', '[]', true),
  ('transport', 'Transport', '🚛', 2, '["dashboard","transport"]', '[]', true),
  ('kiosk_gate', 'Gate Kiosk', '🏛', 1, '["team"]', '["team.attendance_mark"]', true),
  ('section_tablet', 'Section Tablet', '📱', 1, '["kitchen"]', '[]', true),
  ('section_indian', 'Indian Section', '📱', 1, '["kitchen"]', '[]', true),
  ('section_chinese', 'Chinese Section', '📱', 1, '["kitchen"]', '[]', true),
  ('section_tandoor', 'Tandoor Section', '📱', 1, '["kitchen"]', '[]', true),
  ('section_chaat', 'Chaat Section', '📱', 1, '["kitchen"]', '[]', true),
  ('section_sweets', 'Sweets Section', '📱', 1, '["kitchen"]', '[]', true),
  ('section_continental', 'Continental Section', '📱', 1, '["kitchen"]', '[]', true),
  ('section_bakery', 'Bakery Section', '📱', 1, '["kitchen"]', '[]', true),
  ('staff', 'Staff', '👤', 1, '["dashboard","kitchen"]', '[]', true),
  ('sales', 'Sales Rep', '📈', 2,
    '["dashboard","proposals","booked_functions"]',
    '["proposals.create","proposals.edit","proposals.delete","booked_functions.edit_menu"]', true),
  ('sales_manager', 'Sales Manager', '📊', 3,
    '["dashboard","proposals","booked_functions","sales_catalogue","menus"]',
    '["proposals.create","proposals.edit","proposals.delete","proposals.view_all","proposals.convert","sales_catalogue.edit","booked_functions.edit_menu"]', true)
on conflict (role_key) do nothing;
