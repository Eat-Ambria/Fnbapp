-- commitIssueQty used to read qty_issued from the client's local snapshot,
-- add the new amount, and write the result as an absolute value. Two devices
-- issuing the same ingredient around the same moment could both read the
-- same stale qty_issued, each add their own amount, and whichever write
-- landed last silently overwrote the other's contribution — a genuine
-- lost-update race, made worse by the offline queue replaying an absolute
-- value on reconnect over whatever another device wrote in the meantime.
-- This RPC makes the increment atomic at the database level instead.
--
-- store_issue_ops gives each call an idempotency key: if the exact same
-- op_id is ever sent twice (an offline-queued write replayed after it had
-- already gone through, or an ambiguous client-side timeout retry), the
-- second call is a no-op read instead of double-incrementing.
create table if not exists public.store_issue_ops (
  op_id      uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.store_issue_ops disable row level security;

create or replace function public.increment_store_issues(p_op_id uuid, p_rows jsonb)
returns setof public.store_issues
language plpgsql
security invoker
as $$
declare
  already_applied boolean;
begin
  insert into public.store_issue_ops(op_id) values (p_op_id)
    on conflict (op_id) do nothing;
  already_applied := not found;

  if already_applied then
    return query
      select s.* from public.store_issues s
      join jsonb_to_recordset(p_rows) as r(event_id text, section_name text, ingredient_name text)
        on s.event_id = r.event_id and s.section_name = r.section_name and s.ingredient_name = r.ingredient_name;
    return;
  end if;

  return query
    insert into public.store_issues as s
      (event_id, section_name, ingredient_name, ingredient_hindi, unit, qty_required, qty_issued, issued, issued_by, issued_at)
    select
      r.event_id, r.section_name, r.ingredient_name, r.ingredient_hindi, r.unit, r.qty_required,
      r.delta, r.delta >= r.qty_required - 1e-6, r.issued_by, now()
    from jsonb_to_recordset(p_rows) as r(
      event_id text, section_name text, ingredient_name text, ingredient_hindi text,
      unit text, qty_required numeric, delta numeric, issued_by text
    )
    on conflict (event_id, section_name, ingredient_name) do update set
      qty_issued       = coalesce(s.qty_issued, 0) + excluded.qty_issued,
      issued           = coalesce(s.qty_issued, 0) + excluded.qty_issued >= excluded.qty_required - 1e-6,
      qty_required     = excluded.qty_required,
      unit             = excluded.unit,
      ingredient_hindi = excluded.ingredient_hindi,
      issued_by        = excluded.issued_by,
      issued_at        = now()
    returning s.*;
end;
$$;

grant execute on function public.increment_store_issues(uuid, jsonb) to anon, authenticated;
