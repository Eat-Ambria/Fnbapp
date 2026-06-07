-- ── STAFF ──
create table if not exists staff (
  staff_id text primary key,
  name text not null,
  section text,
  dept text,
  role text default 'staff',
  pin text default '0000',
  is_admin boolean default false,
  is_active boolean default true,
  joining text,
  phone text,
  custom_screens jsonb default null,
  permissions jsonb default null,
  created_at timestamptz default now()
);

-- ── EVENTS ──
create table if not exists events (
  id text primary key,
  guest text not null,
  venue text not null,
  date text not null,
  time text,
  type text,
  pax int default 0,
  veg int default 0,
  nonveg int default 0,
  menu_package text,
  menu jsonb default '[]',
  special text,
  extras jsonb default '[]',
  created_at timestamptz default now()
);

-- ── KITCHEN TRACKING ──
create table if not exists kitchen_tracking (
  ev_id text,
  dish_key text,
  data jsonb default '{}',
  updated_at timestamptz default now(),
  primary key (ev_id, dish_key)
);

-- ── ATTENDANCE ──
create table if not exists attendance (
  id uuid default gen_random_uuid() primary key,
  staff_id text not null,
  staff_name text,
  section text,
  dept text,
  date text not null,
  status text default 'Present',
  in_time text,
  out_time text,
  is_daily_wages boolean default false,
  wages_amount numeric default 0,
  created_at timestamptz default now(),
  unique(staff_id, date)
);

-- ── LEAVES ──
create table if not exists leaves (
  id uuid default gen_random_uuid() primary key,
  staff_id text not null,
  staff_name text,
  from_date text not null,
  to_date text not null,
  reason text,
  status text default 'Pending',
  approved_by text,
  created_at timestamptz default now()
);

-- ── INVENTORY ──
create table if not exists inventory (
  id text primary key,
  name text not null,
  brand text,
  barcode text,
  cat text,
  unit text default 'g',
  in_stock numeric default 0,
  min_stock numeric default 0,
  location text default 'AP',
  created_at timestamptz default now()
);

-- ── STORE TRANSACTIONS ──
create table if not exists store_transactions (
  id uuid default gen_random_uuid() primary key,
  item_id text,
  item_name text,
  type text,
  qty numeric,
  reason text,
  quality text,
  remarks text,
  done_by text,
  date text,
  created_at timestamptz default now()
);

-- ── REPAIR TICKETS ──
create table if not exists repair_tickets (
  id text primary key,
  title text not null,
  cat text,
  venue text,
  priority text default 'Medium',
  assign_to text,
  status text default 'Open',
  dept text,
  created_by text,
  date text,
  notes text,
  updates jsonb default '[]',
  created_at timestamptz default now()
);

-- ── SCALING OVERRIDES ──
create table if not exists scaling_overrides (
  key text primary key,
  value text,
  updated_by text,
  updated_at timestamptz default now()
);

-- ── APPLIED SCALES ──
create table if not exists applied_scales (
  ev_id text,
  source text default 'manual',
  percent int,
  dishes jsonb default '[]',
  event_name text,
  applied_at text,
  applied_by text,
  created_at timestamptz default now(),
  primary key (ev_id, source)
);

-- ── ENABLE ROW LEVEL SECURITY ──
alter table staff enable row level security;
alter table events enable row level security;
alter table kitchen_tracking enable row level security;
alter table attendance enable row level security;
alter table leaves enable row level security;
alter table inventory enable row level security;
alter table store_transactions enable row level security;
alter table repair_tickets enable row level security;
alter table scaling_overrides enable row level security;
alter table applied_scales enable row level security;

-- ── PUBLIC ACCESS POLICIES (for tablet kiosk + PIN login) ──
create policy "public_all" on staff for all using (true) with check (true);
create policy "public_all" on events for all using (true) with check (true);
create policy "public_all" on kitchen_tracking for all using (true) with check (true);
create policy "public_all" on attendance for all using (true) with check (true);
create policy "public_all" on leaves for all using (true) with check (true);
create policy "public_all" on inventory for all using (true) with check (true);
create policy "public_all" on store_transactions for all using (true) with check (true);
create policy "public_all" on repair_tickets for all using (true) with check (true);
create policy "public_all" on scaling_overrides for all using (true) with check (true);
create policy "public_all" on applied_scales for all using (true) with check (true);

-- ── ENABLE REALTIME ──
alter publication supabase_realtime add table staff;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table kitchen_tracking;
alter publication supabase_realtime add table attendance;
alter publication supabase_realtime add table repair_tickets;
alter publication supabase_realtime add table inventory;

-- ── SEED: 1 admin + 4 gate kiosks + 42 kitchen staff = 47 total ──
insert into staff (staff_id, name, section, dept, role, pin, is_admin, is_active, joining)
values
  ('AM001',    'Abhi',                        'Management',    'management', 'admin',      '0000', true,  true, '2025-01-01'),
  ('GATE-AP',  'Gate — Ambria Pushpanjali',   'Gate',          'gate',       'kiosk_gate', '9999', false, true, '2025-01-01'),
  ('GATE-AE',  'Gate — Ambria Exotica',       'Gate',          'gate',       'kiosk_gate', '9999', false, true, '2025-01-01'),
  ('GATE-MKT', 'Gate — Manaktala Farm',       'Gate',          'gate',       'kiosk_gate', '9999', false, true, '2025-01-01'),
  ('GATE-RST', 'Gate — Ambria Restro',        'Gate',          'gate',       'kiosk_gate', '9999', false, true, '2025-01-01'),
  ('SW001',    'Rajinder Singh Halwai',        'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('SW002',    'Ramu Halwai',                  'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('SW003',    'Yogesh Halwai',                'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('SW004',    'Anil Kumar Halwai',            'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('SW005',    'Bacchan Singh',                'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('SW006',    'Radheyshayam',                 'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('SW007',    'Abhishek',                     'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('SW008',    'Saurabh',                      'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('SW009',    'Deepu Hawai New',              'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('SW010',    'Vrindavan',                    'Sweets',        'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CT001',    'Raghvendra Singh',             'Chaat',         'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CT002',    'Satendra Chaat',               'Chaat',         'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CT003',    'Purshottam',                   'Chaat',         'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CT004',    'Anurag Chaat',                 'Chaat',         'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CT005',    'Ajay',                         'Chaat',         'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CT006',    'Sahdev',                       'Chaat',         'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CT007',    'Balram',                       'Chaat',         'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CT008',    'Golu',                         'Chaat',         'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CT009',    'Kuldeep',                      'Chaat',         'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CH001',    'Kishore Chef',                 'Chinese',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CH002',    'Lokesh',                       'Chinese',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CH003',    'Sandeep Chef Helper',          'Chinese',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CH004',    'Vishesh',                      'Chinese',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('TD001',    'Yatinder',                     'Tandoor',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('TD002',    'Gopal',                        'Tandoor',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('TD003',    'Vipin Kumar Tandoor',          'Tandoor',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('TD004',    'Yatinder Rawat',               'Tandoor',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('TD005',    'Noor Alam Tandoor',            'Tandoor',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('TD006',    'Kushal Pal',                   'Tandoor',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('TD007',    'Surendra',                     'Tandoor',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('TD008',    'Prabhat',                      'Tandoor',       'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CN001',    'Rahul',                        'Continental',   'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('CN002',    'Kareen',                       'Continental',   'kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('IN001',    'Devendra',                     'Indian Curries','kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('IN002',    'Bhupal',                       'Indian Curries','kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('IN003',    'Jeetu Indian',                 'Indian Curries','kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('IN004',    'Roshan',                       'Indian Curries','kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('IN005',    'Hina',                         'Indian Curries','kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('IN006',    'Anas Khan',                    'Indian Curries','kitchen',    'staff',      '1111', false, true, '2025-01-01'),
  ('BK001',    'Shobhan Singh',                'Bakery',        'kitchen',    'staff',              '1111', false, true, '2025-01-01'),
  ('BK002',    'Disha',                        'Bakery',        'kitchen',    'staff',              '1111', false, true, '2025-01-01'),
  -- kitchen section tablets
  ('TAB-IN',   'Indian Section Tablet',        'Indian Curries','kitchen',    'section_indian',     '1111', false, true, '2025-01-01'),
  ('TAB-CH',   'Chinese Section Tablet',       'Chinese',       'kitchen',    'section_chinese',    '2222', false, true, '2025-01-01'),
  ('TAB-TD',   'Tandoor Section Tablet',       'Tandoor',       'kitchen',    'section_tandoor',    '3333', false, true, '2025-01-01'),
  ('TAB-CT',   'Chaat Section Tablet',         'Chaat',         'kitchen',    'section_chaat',      '4444', false, true, '2025-01-01'),
  ('TAB-SW',   'Sweets Section Tablet',        'Sweets',        'kitchen',    'section_sweets',     '5555', false, true, '2025-01-01'),
  ('TAB-CN',   'Continental Section Tablet',   'Continental',   'kitchen',    'section_continental','6666', false, true, '2025-01-01'),
  -- head chef shared login
  ('HC001',    'Yatender / Gopal',             'Management',    'kitchen',    'head_chef',          '7777', false, true, '2025-01-01')
on conflict (staff_id) do nothing;
