-- Ambria FnB — master data table for staff "Home Venue" (transport routing)
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
-- Home Venue was a hardcoded list (Pushpanjali/Exotica/Manaktala/Restro) in
-- src/data/staffData.js. This table lets Access Manager add/rename/delete
-- venues from the app instead of a code change. Seeded with the existing
-- values so no staff.venue value is orphaned.

create table if not exists home_venues (
  id text primary key,
  name text not null,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table home_venues enable row level security;
create policy "public_all" on home_venues for all using (true) with check (true);

insert into home_venues (id, name, sort_order) values
  ('pushpanjali', 'Pushpanjali', 10),
  ('exotica',     'Exotica',     20),
  ('manaktala',   'Manaktala',   30),
  ('restro',      'Restro',      40)
on conflict (id) do nothing;
