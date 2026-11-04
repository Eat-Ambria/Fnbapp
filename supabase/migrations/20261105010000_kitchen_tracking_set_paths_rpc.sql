-- kitchen_tracking writes used to always upsert the WHOLE dish-state object
-- for (ev_id, dish_key), built client-side from this tablet's own local
-- state. That caused two related problems:
--   1. An offline-queued write replays as an absolute whole-object upsert
--      with no comparison against what another device may have written to
--      the SAME row in the meantime — whichever write lands last wins
--      entirely, even for keys it never meant to touch.
--   2. Tapping step 3 Done re-sent this tablet's ENTIRE local manual/starts
--      maps, including a stale `false` left over from an earlier LOCAL undo
--      of step 2 — with a brand-new timestamp, silently reverting a genuine
--      redo another tablet had made to step 2 in between.
--
-- kt_set_paths writes only the exact JSON path(s) a single action actually
-- changed, guarded PER PATH (not per row) by key_ts: a write only applies if
-- its timestamp is >= the last timestamp recorded for that EXACT path. A
-- row-level timestamp (like the existing client_write_ts column) can't do
-- this safely once two different paths on the same row can each be written
-- independently — a fresh write to step_3 would bump a row-level timestamp
-- past an in-flight, perfectly valid write to step_2, causing step_2's own
-- update to look "stale" by comparison even though nothing actually raced it.
-- Per-path timestamps mean a write can only ever be rejected by a GENUINELY
-- newer write to that same exact path — never collateral damage from an
-- unrelated path's activity. This same mechanism also closes the offline
-- queue's missing replay guard "for free": a queued call replays with its
-- ORIGINAL tap timestamp, so a stale replay landing after something newer
-- already touched that path is correctly rejected, no special-casing needed.
alter table public.kitchen_tracking add column if not exists key_ts jsonb not null default '{}'::jsonb;

create or replace function public.kt_set_paths(
  p_ev_id text, p_dish_key text, p_patch jsonb, p_client_id text, p_ts bigint
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  cur jsonb;
  k text; v jsonb; subk text; subv jsonb;
  path_key text; cur_ts numeric;
  step_maps text[] := array['manual','manualAt','starts','doneElapsed','stepTm','items_done'];
begin
  insert into public.kitchen_tracking (ev_id, dish_key, data, key_ts, client_id, client_write_ts)
    values (p_ev_id, p_dish_key, '{}'::jsonb, '{}'::jsonb, p_client_id, p_ts)
    on conflict (ev_id, dish_key) do nothing;
  perform 1 from public.kitchen_tracking where ev_id = p_ev_id and dish_key = p_dish_key for update; -- serialize concurrent calls on this row so each key_ts check below sees the latest committed value (no TOCTOU)

  -- client_id/client_write_ts are stamped on EVERY actual data-changing
  -- UPDATE below, not as one trailing blanket update after the loop. A
  -- single kt_set_paths call can run several UPDATE statements (one per
  -- changed path) and Postgres realtime emits one event PER statement —
  -- a trailing update that only touched client_id/client_write_ts would
  -- still broadcast an extra (data-unchanged) event, and worse, a REJECTED
  -- path (one whose key_ts guard failed) previously still got re-stamped
  -- with the rejecting caller's own client_id via that trailing update,
  -- so its own later "own echo" skip meant it never found out its write
  -- had been rejected. Each path's update now stands alone: if it's
  -- rejected, no update and no broadcast happen for it at all, and the
  -- caller is expected to reconcile from this function's own return value
  -- (see App.jsx's sync effect) rather than wait on a broadcast that may
  -- never come.
  if p_patch ? '__whole' then
    -- Meta rows (__dispatch_ready, __dispatch_time, ...) hold a plain
    -- boolean/string as `data`, not an object with sub-paths to set.
    path_key := '__whole';
    select (key_ts ->> path_key)::numeric into cur_ts
      from public.kitchen_tracking where ev_id = p_ev_id and dish_key = p_dish_key;
    if cur_ts is null or p_ts >= cur_ts then
      update public.kitchen_tracking
        set data = p_patch->'__whole',
            key_ts = jsonb_set(coalesce(key_ts, '{}'::jsonb), array[path_key], to_jsonb(p_ts)),
            client_id = p_client_id, client_write_ts = p_ts
        where ev_id = p_ev_id and dish_key = p_dish_key;
    end if;
  else
    for k, v in select * from jsonb_each(p_patch) loop
      if k = any(step_maps) and jsonb_typeof(v) = 'object' then
        for subk, subv in select * from jsonb_each(v) loop
          path_key := k || '.' || subk;
          select (key_ts ->> path_key)::numeric into cur_ts
            from public.kitchen_tracking where ev_id = p_ev_id and dish_key = p_dish_key;
          if cur_ts is null or p_ts >= cur_ts then
            -- jsonb_set's create_missing only creates the FINAL path element
            -- — it will not also create an absent PARENT container. data's
            -- step-map keys (manual, starts, ...) don't exist yet on a
            -- dish's first-ever write, so a plain jsonb_set(data,
            -- array[k,subk], subv, true) silently no-ops: data stays `{}`
            -- and the tick is lost (key_ts still gets stamped, so a later,
            -- correct write to this same path would then be wrongly
            -- rejected as "not newer"). Ensuring the parent object exists
            -- first, then setting just the top-level key k, avoids relying
            -- on jsonb_set to create more than one level at once.
            update public.kitchen_tracking
              set data = jsonb_set(
                    coalesce(data, '{}'::jsonb),
                    array[k],
                    (case when jsonb_typeof(data->k) = 'object' then data->k else '{}'::jsonb end) || jsonb_build_object(subk, subv),
                    true
                  ),
                  key_ts = jsonb_set(coalesce(key_ts, '{}'::jsonb), array[path_key], to_jsonb(p_ts)),
                  client_id = p_client_id, client_write_ts = p_ts
              where ev_id = p_ev_id and dish_key = p_dish_key;
          end if;
        end loop;
      else
        path_key := k;
        select (key_ts ->> path_key)::numeric into cur_ts
          from public.kitchen_tracking where ev_id = p_ev_id and dish_key = p_dish_key;
        if cur_ts is null or p_ts >= cur_ts then
          update public.kitchen_tracking
            set data = jsonb_set(coalesce(data, '{}'::jsonb), array[k], v, true),
                key_ts = jsonb_set(coalesce(key_ts, '{}'::jsonb), array[path_key], to_jsonb(p_ts)),
                client_id = p_client_id, client_write_ts = p_ts
            where ev_id = p_ev_id and dish_key = p_dish_key;
        end if;
      end if;
    end loop;
  end if;

  -- Returns both data AND key_ts (not just data): the caller needs key_ts to
  -- know the authoritative per-path timestamps for whatever it just read —
  -- see App.jsx's sync effect (reconciling its own write) and the
  -- kitchen_tracking realtime handler (comparing an incoming echo's key_ts
  -- against what it has already applied, to reject an out-of-order delivery
  -- without rejecting a genuinely newer one).
  select jsonb_build_object('data', data, 'key_ts', key_ts) into cur
    from public.kitchen_tracking where ev_id = p_ev_id and dish_key = p_dish_key;
  return cur;
end;
$$;

grant execute on function public.kt_set_paths(text, text, jsonb, text, bigint) to anon, authenticated;
