-- Transport & Dispatch's vehicle-assignment status (Planning -> Loaded ->
-- Dispatched -> At Venue -> Unloaded, plus driver/departure-time) used to
-- live in plain component state only -- never written to Supabase at all.
-- A refresh, or a second tablet opening Transport & Dispatch, silently
-- regenerated every assignment back to "Planning", so two people could
-- genuinely disagree about whether a truck had actually left.
create table if not exists public.transport_dispatch_assignments (
  id             text primary key,  -- `${event_id}::${vehicle_id}`
  event_id       text not null,
  vehicle_id     text not null,
  driver         text not null default '',
  dispatch_time  text not null default '',
  status         text not null default 'Planning',
  dispatched_at  text,
  arrived_at     text,
  unloaded_at    text,
  updated_at     timestamptz not null default now()
);
create index if not exists transport_dispatch_assignments_event_id_idx
  on public.transport_dispatch_assignments (event_id);
alter table public.transport_dispatch_assignments disable row level security;

do $$
begin
  alter publication supabase_realtime add table public.transport_dispatch_assignments;
exception when duplicate_object then null;
end $$;
