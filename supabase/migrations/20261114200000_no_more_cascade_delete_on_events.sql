-- Prevent any future bug, in any code path, from silently wiping a
-- Function Plan / menu selections / dept configs by deleting an events row.
--
-- 2026-11-14 incident: event_function_plans, event_items and event_configs
-- were all `ON DELETE CASCADE` against events(id). A buggy LMS sync pass
-- treated "this contract wasn't in one fetch" as "cancelled in LMS" and hard-
-- deleted the events row -- Postgres then silently cascaded that into
-- wiping the row's entire Function Plan (including an already-finalized,
-- sent-to-kitchen one), every selected menu item, and its dept configs, in
-- the same transaction, with no tombstone, no snapshot, and no way to
-- recover any of it afterward. It happened three times in one day before
-- being caught. The sync's own auto-delete has since been disabled
-- entirely (see supabase/functions/lms-sync/index.ts), but that only closes
-- THIS specific caller -- the schema itself should not allow a plain
-- `delete from events where id = ...` to ever take real work down with it,
-- regardless of which code (or which future code nobody's written yet)
-- issues that delete.
--
-- RESTRICT instead of CASCADE: deleting an events row that still has real
-- children now fails loudly (a foreign-key-violation error) instead of
-- silently destroying them. The app's own "Delete" action (App.jsx) already
-- only ever soft-deletes (`update({is_deleted:true})`) and never issues a
-- real DELETE, so this changes nothing about normal use. The one genuine
-- hard-delete path left in the codebase -- lms-sync's migrateEventId, used
-- to carry work across a same-contract id rename -- already re-points every
-- child row via UPDATE onto the new id before touching the old events row,
-- so this is a no-op for that path either way. (That old row no longer even
-- gets a real DELETE as of the same incident's follow-up fix -- it's
-- tombstoned via is_deleted:true instead, same as every other delete path
-- in this app -- but the RESTRICT above would have been satisfied by it
-- regardless, since it only ever ran on an already-drained row.)
--
-- If an events row genuinely needs deleting along with real children on
-- purpose (a true admin cleanup, not an automated guess), delete the
-- children first, explicitly, then the events row -- never the other way
-- around.

alter table event_items
  drop constraint event_items_event_id_fkey,
  add constraint event_items_event_id_fkey
    foreign key (event_id) references events(id) on delete restrict;

alter table event_function_plans
  drop constraint event_function_plans_event_id_fkey,
  add constraint event_function_plans_event_id_fkey
    foreign key (event_id) references events(id) on delete restrict;

alter table event_configs
  drop constraint event_configs_event_id_fkey,
  add constraint event_configs_event_id_fkey
    foreign key (event_id) references events(id) on delete restrict;
