-- A snapshot of everything the Function Plan print was showing at the
-- moment a head chef acknowledged it -- {fp: {key: diffVal}, dishNames:
-- [...]}, built by FunctionPlanPrintView.jsx. A later print diffs the
-- current content against this to highlight anything that's changed since
-- (a menu dish, an F&B/banquet info line, a timing -- anything printed),
-- and clears/refreshes on a re-acknowledge.
alter table public.event_function_plans
  add column if not exists chef_ack_snapshot jsonb;
