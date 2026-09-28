-- Transport & Dispatch redesign: transport_queue rows need to carry the real
-- event id, station id, and a structured qty+unit (instead of everything
-- baked into one "Dish — Qty unit" string) so the new chip-based Today's
-- Plan can group by event and station, and cross-reference a dish shared
-- across multiple functions. See TransportDispatch.jsx / EventDayTab.jsx.

alter table transport_queue add column if not exists ev_id text;
alter table transport_queue add column if not exists sec text;
alter table transport_queue add column if not exists station text;
alter table transport_queue add column if not exists qty numeric;
alter table transport_queue add column if not exists unit text;
alter table transport_queue add column if not exists from_venue text;
