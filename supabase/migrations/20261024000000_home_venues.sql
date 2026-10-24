-- Access Manager's "Home Venue" picker (staff.venue, used for transport
-- cross-venue routing in EventDayTab.jsx's venueMatches()) reads and writes
-- public.home_venues, but the table was missing from the database (PostgREST:
-- PGRST205) — every add/rename/delete in Access Manager failed, and
-- dbConfig.js's boot-time loadTable('home_venues', ...) silently fell back to
-- an empty list on every load. No row survived a reload.

create table if not exists public.home_venues (
  id         text        primary key,
  name       text        not null,
  sort_order integer     not null default 0,
  is_active  boolean     not null default true
);
alter table public.home_venues disable row level security;
