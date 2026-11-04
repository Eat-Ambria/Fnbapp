-- Sync to Ops: synced_to_ops was a boolean, so once a row was synced once it
-- was permanently excluded from every future sync plan -- anything issued
-- against that ingredient AFTER its first sync never reached Ops at all.
-- synced_qty tracks exactly how much of qty_issued has actually been sent,
-- so the sync plan can always compute the un-synced delta (qty_issued -
-- synced_qty) instead of an all-or-nothing flag. synced_to_ops is kept (not
-- dropped) so an already-open tab running the old code can still write it
-- without a column-not-found error; new code never reads it.
alter table public.store_issues
  add column if not exists synced_qty numeric not null default 0;

update public.store_issues
  set synced_qty = coalesce(qty_issued, 0)
  where synced_to_ops = true;
