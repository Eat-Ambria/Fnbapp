-- Store Requisition sync to Ops — tracks which store_issues rows have
-- already been pushed to Ops as a Store Requisition, so "Sync to Ops" only
-- ever sends the delta (newly issued since the last sync) instead of
-- resending a station's whole history and double-recording it on Ops' side.
alter table public.store_issues
  add column if not exists synced_to_ops boolean not null default false,
  add column if not exists ops_sync_ref uuid;
