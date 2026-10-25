-- One real venue master instead of three independently-drifting copies: the
-- Edit Function event-venue dropdown (Dashboard.jsx) had its own hardcoded
-- list that was missing "Ambria Restro" entirely (its color map knew about
-- Restro, the dropdown options never did), while home_venues already existed
-- as a DB-backed, Access-Manager-editable list — just for a different,
-- narrower purpose (staff "Home Venue", short names, used for transport
-- fuzzy-matching). Extending that same table to also carry each venue's full
-- display name and venue code, and a flag for which lists it belongs in,
-- makes it the one place both the event-venue dropdown and the home-venue
-- picker read from — add/rename/remove in Access Manager, not in code.
--
-- The live table was empty (no venue has ever actually been added through
-- Access Manager's "+ Add Venue" — every screen has been running on each
-- file's own hardcoded fallback), so this seeds the 4 real venues + Outdoor
-- Catering fresh, matching the venue names already live on 863 real events
-- (confirmed by a direct query: "Manaktala Farm", not "Ambria Manaktala" —
-- data/constants.js's AMBRIA_VENUES spells it differently but that's used
-- only for the Sales Catalogue's venue-info cards, not event-venue matching).

alter table public.home_venues
  add column if not exists full_name text,
  add column if not exists code text,
  add column if not exists is_event_venue boolean not null default true,
  add column if not exists is_staff_home  boolean not null default true;

insert into public.home_venues (id, name, full_name, code, sort_order, is_active, is_event_venue, is_staff_home)
values
  ('pushpanjali', 'Pushpanjali',        'Ambria Pushpanjali',      'AP',  10, true, true, true),
  ('exotica',     'Exotica',            'Ambria Exotica',          'AE',  20, true, true, true),
  ('manaktala',   'Manaktala',          'Manaktala Farm',          'AM',  30, true, true, true),
  ('restro',      'Restro',             'Ambria Restro',           'AR',  40, true, true, true),
  ('odc',         'Outdoor Catering',   'Outdoor Catering (ODC)',  'ODC', 50, true, true, false)
on conflict (id) do update set
  full_name = excluded.full_name,
  code      = excluded.code;
