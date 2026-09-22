-- Ambria FnB — per-section photographs for the client menu
-- Run this in the Supabase SQL editor for the FnB project (ozibklsaweqizzyfwqmm).
--
-- Until now the menu preview picked a section's photograph by matching words in
-- the section's NAME against a list of filenames shipped in public/menu/. That
-- works for the sections that exist today and silently gives nothing to any
-- section created later. This column lets the photograph be uploaded against
-- the section itself, from the Dish Library, and the name matching stays only
-- as the fallback for sections that have not had one uploaded yet.
--
-- dishes_master already carries image_url, so dish photographs need no schema
-- change — only the bucket below.

alter table public.dish_catalogue_sections
  add column if not exists image_url text;

comment on column public.dish_catalogue_sections.image_url is
  'Public URL of the section photograph shown on that section''s page in the client menu preview and its PDF. Uploaded from Dish Library → Sections.';


-- ── Storage ───────────────────────────────────────────────────────────────
-- One bucket for both, separated by prefix (sections/… and dishes/…), so there
-- is a single place menu artwork lives rather than one bucket per entity.
insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do update set public = true;

-- These policies deliberately do NOT require a Supabase Auth session. This app
-- does not create one: the PIN screen is application-level, and every request
-- the browser makes — including these uploads — carries the anon key. A policy
-- written as `to authenticated` would therefore reject every upload the app
-- ever makes. Who may upload is enforced in the UI (admin / head chef only),
-- the same way it already is for the rest of these tables.
drop policy if exists "menu photos are publicly readable" on storage.objects;
create policy "menu photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'menu-photos');

drop policy if exists "menu photos can be uploaded" on storage.objects;
create policy "menu photos can be uploaded"
  on storage.objects for insert
  with check (bucket_id = 'menu-photos');

-- upsert:true on re-upload is an UPDATE, so this one is what lets a photo be
-- replaced rather than piling up a second file.
drop policy if exists "menu photos can be replaced" on storage.objects;
create policy "menu photos can be replaced"
  on storage.objects for update
  using (bucket_id = 'menu-photos')
  with check (bucket_id = 'menu-photos');

drop policy if exists "menu photos can be removed" on storage.objects;
create policy "menu photos can be removed"
  on storage.objects for delete
  using (bucket_id = 'menu-photos');
