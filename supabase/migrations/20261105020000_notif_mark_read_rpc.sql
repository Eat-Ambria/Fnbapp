-- NotificationCenter.jsx's markRead/markAllRead used to read read_by
-- client-side, concat the current user's id, and write the whole jsonb
-- array back — a classic read-modify-write race: two admins marking the
-- SAME notification read within the realtime-echo window of each other
-- can have one's read-marker silently overwritten by the other's last
-- write, so a notification falsely shows "unread" for someone who did
-- see it. A single UPDATE statement is atomic per row against whatever
-- the CURRENT value is at the moment it runs (no client round-trip in
-- between), so doing the append and the "already marked?" check inside
-- one UPDATE closes that window entirely — unlike the old client-side
-- read-then-write, which always had a gap between the read and the write.
--
-- jsonb containment (@>) needs the right-hand side wrapped as an array to
-- test "does this array contain this scalar" — jsonb_build_array(p_staff_id)
-- is that wrapper; concatenation (||) appends it the same way.
create or replace function public.notif_mark_read(p_ids uuid[], p_staff_id text)
returns void
language plpgsql
as $$
begin
  update public.notifications
  set read_by = read_by || jsonb_build_array(p_staff_id)
  where id = any(p_ids)
    and not (read_by @> jsonb_build_array(p_staff_id));
end;
$$;

-- This app has no Supabase Auth session -- every call runs as Postgres role
-- `anon` (src/lib/supabase.js only ever uses the anon key). Without this
-- grant, PostgREST rejects every call with permission-denied and the "mark
-- read" fix this migration exists for never actually marks anything read
-- server-side -- the two sibling RPC migrations in this same batch
-- (20261105000000_store_issues_increment_rpc.sql,
-- 20261105010000_kitchen_tracking_set_paths_rpc.sql) both already do this.
grant execute on function public.notif_mark_read(uuid[], text) to anon, authenticated;
