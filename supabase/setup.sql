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

-- ── SEED ADMIN ONLY ──
insert into staff (staff_id, name, section, dept, role, pin, is_admin, is_active, joining)
values ('AM001', 'Abhi', 'Management', 'management', 'admin', '0000', true, true, '2025-01-01')
on conflict (staff_id) do nothing;
