-- The fp-layout-photos Storage bucket (created manually in the dashboard,
-- "Public" toggle on) only covers READS -- a public bucket serves GET
-- /storage/v1/object/public/<bucket>/<path> with no auth check at all,
-- which is why uploadFPLayoutPhoto's getPublicUrl() already worked. Writing
-- a new object goes through the authenticated storage API instead, which
-- DOES check storage.objects' own RLS -- Postgres RLS on the Storage
-- subsystem's own table, a separate mechanism entirely from every policy
-- this app's own `public` schema migrations have touched tonight. No INSERT/
-- UPDATE policy for this bucket ever existed (it's a brand-new bucket), so
-- every upload attempt hit the default-deny and failed with "new row
-- violates row-level security policy".
--
-- Scoped to `to authenticated` only, not `is_active_staff()` -- that
-- function is defined in the Stage 2 RLS migration, which has not been
-- applied yet (Stage 1 is still soaking). Revisit this alongside Stage 2 if
-- tighter scoping (active staff only, not just any authenticated session)
-- is wanted then.
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects') then
    -- Drop first in case of a partial/retry run -- same "don't assume a
    -- clean slate" reasoning as every other RLS migration tonight, just
    -- scoped to policies this migration itself would have created.
    drop policy if exists fp_layout_photos_insert on storage.objects;
    drop policy if exists fp_layout_photos_update on storage.objects;

    execute 'create policy fp_layout_photos_insert on storage.objects for insert to authenticated with check (bucket_id = ''fp-layout-photos'')';
    execute 'create policy fp_layout_photos_update on storage.objects for update to authenticated using (bucket_id = ''fp-layout-photos'') with check (bucket_id = ''fp-layout-photos'')';
  end if;
end $$;
