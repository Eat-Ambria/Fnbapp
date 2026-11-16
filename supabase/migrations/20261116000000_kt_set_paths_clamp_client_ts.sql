-- kt_set_paths (20261105010000) guards every per-path write with
-- `p_ts >= key_ts[path]`, where p_ts is the CLIENT's own Date.now(), never
-- corrected server-side. A tablet whose clock runs fast could therefore
-- stamp a path with a timestamp minutes/hours in the future and silently
-- out-rank every genuinely-later write from a correctly-clocked tablet to
-- that same path until real time caught up -- the losing tablet's RPC still
-- returns success, and App.jsx's sync-effect reconciliation just quietly
-- reverts its tap to the server's value.
--
-- Fix: the timestamp actually COMPARED and STORED per path (eff_ts) is
-- least(p_ts, server clock + clock_slack_ms). A fast clock can now bank at
-- most clock_slack_ms of unearned advantage, and since key_ts only ever
-- stores eff_ts, no stored key_ts can exceed its own commit-time server
-- clock + slack -- the skew cannot persist forward.
--
-- Deliberately NOT changed:
--   * A PAST p_ts (relative to the server, at the moment this call runs)
--     passes through least() untouched -- an offline-queued / session-
--     expired replay from a CORRECTLY-clocked device keeps its ORIGINAL tap
--     timestamp (see the original migration's comment and MEMORY.md 3.3b)
--     and is compared exactly as before, however long the replay was
--     delayed. The one case this does NOT fully cover: a replay queued by a
--     device whose clock was ALSO more than clock_slack_ms fast -- its
--     p_ts can still be in the future at replay time, so it gets clamped to
--     roughly replay-time + slack, which is later than the real tap and
--     could still beat a genuinely newer write made in between. That's no
--     worse than before this fix (the raw future p_ts already won then, by
--     an unbounded margin) and is now bounded by the same slack -- just not
--     the same "exactly as before" guarantee a correctly-clocked replay gets.
--   * client_write_ts keeps the raw p_ts: it plays no ordering role
--     (DishLibrary's rename guard only tests it for equality), and raw
--     vs key_ts lets a skewed device be spotted after the fact.
--   * A null p_ts keeps its old behaviour (least() would otherwise turn
--     NULL into "now + slack").
-- clock_timestamp() (real wall time), not now() (frozen at transaction
-- start), evaluated ONCE after the row lock is taken, so every path in one
-- call shares a single effective timestamp ordered at lock time.
-- 10s slack: client p_ts is taken BEFORE the request is sent, so network
-- latency only ever makes p_ts earlier than server time -- slack only has to
-- absorb an honestly-slightly-fast device clock (NTP-synced tablets are
-- normally within 1-2s). Below the slack, a device's own ordering is kept
-- exactly; above it, it is ordered by server time instead.
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
  clock_slack_ms constant bigint := 10000;
  eff_ts bigint;
begin
  insert into public.kitchen_tracking (ev_id, dish_key, data, key_ts, client_id, client_write_ts)
    values (p_ev_id, p_dish_key, '{}'::jsonb, '{}'::jsonb, p_client_id, p_ts)
    on conflict (ev_id, dish_key) do nothing;
  perform 1 from public.kitchen_tracking where ev_id = p_ev_id and dish_key = p_dish_key for update; -- serialize concurrent calls on this row so each key_ts check below sees the latest committed value (no TOCTOU)

  -- Effective per-path timestamp: the client's own p_ts, but never more than
  -- clock_slack_ms ahead of the server's real clock (see header comment).
  -- A past p_ts (offline replay) is returned by least() unchanged.
  eff_ts := case when p_ts is null then null
                 else least(p_ts, floor(extract(epoch from clock_timestamp()) * 1000)::bigint + clock_slack_ms)
            end;

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
    if cur_ts is null or eff_ts >= cur_ts then
      update public.kitchen_tracking
        set data = p_patch->'__whole',
            key_ts = jsonb_set(coalesce(key_ts, '{}'::jsonb), array[path_key], to_jsonb(eff_ts)),
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
          if cur_ts is null or eff_ts >= cur_ts then
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
                  key_ts = jsonb_set(coalesce(key_ts, '{}'::jsonb), array[path_key], to_jsonb(eff_ts)),
                  client_id = p_client_id, client_write_ts = p_ts
              where ev_id = p_ev_id and dish_key = p_dish_key;
          end if;
        end loop;
      else
        path_key := k;
        select (key_ts ->> path_key)::numeric into cur_ts
          from public.kitchen_tracking where ev_id = p_ev_id and dish_key = p_dish_key;
        if cur_ts is null or eff_ts >= cur_ts then
          update public.kitchen_tracking
            set data = jsonb_set(coalesce(data, '{}'::jsonb), array[k], v, true),
                key_ts = jsonb_set(coalesce(key_ts, '{}'::jsonb), array[path_key], to_jsonb(eff_ts)),
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
