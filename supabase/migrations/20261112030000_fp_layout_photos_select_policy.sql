-- Follow-up to 20261112020000: INSERT/UPDATE policies alone still left the
-- same "new row violates row-level security policy" error on upload.
-- supabase-js's .storage.upload(..., { upsert: true }) checks for an
-- existing object at that path before deciding whether to insert or
-- overwrite it -- that existence check is itself a SELECT against
-- storage.objects, which had no policy for `authenticated` at all (the
-- bucket's "Public" toggle only wires up the separate, RLS-bypassing
-- /storage/v1/object/public/... read endpoint, not this one). With no
-- SELECT policy, that pre-check silently resolves as "nothing exists" is
-- indistinguishable from "blocked from seeing it", and the write that
-- follows fails under the same umbrella error.
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects') then
    drop policy if exists fp_layout_photos_select on storage.objects;
    execute 'create policy fp_layout_photos_select on storage.objects for select to authenticated using (bucket_id = ''fp-layout-photos'')';
  end if;
end $$;
