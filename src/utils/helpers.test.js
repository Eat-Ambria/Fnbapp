// Tests for the dish-tracking merge.
//
// This exists because of a specific field bug: a chef would tap "Done" on a
// step and watch it undo itself. Nothing undid it — the write was overwritten
// by a stale copy. Every case below is one of the ways that happened.

import { describe, it, expect } from 'vitest';
import { mergeDishState, storeItemKey, markAllCollected, isSessionAuthError, ktReplayReconcileJobs, ktCatchUpOnStatus, ktCatchUpWaitMs, KT_CATCHUP_INITIAL } from './helpers.js';

describe('mergeDishState', () => {
  it('records a first step', () => {
    const s = mergeDishState({}, { manual: { A: true }, manualAt: { A: '10:00' } });
    expect(s.manual).toEqual({ A: true });
    expect(s.manualAt).toEqual({ A: '10:00' });
  });

  // THE BUG. Handlers build their update by spreading the copy of `manual` they
  // captured at render time. Tap A, then tap B before the re-render lands, and
  // B's handler still holds the pre-A snapshot. A shallow merge replaces the
  // whole map with it and A is gone.
  it('keeps an earlier step when a later update carries a stale snapshot', () => {
    let s = mergeDishState({}, { manual: { A: true } });
    s = mergeDishState(s, { manual: { B: true } }); // built from the pre-A snapshot
    expect(s.manual).toEqual({ A: true, B: true });
  });

  it('still applies an explicit false, so Undo works', () => {
    let s = mergeDishState({}, { manual: { A: true, B: true } });
    s = mergeDishState(s, { manual: { A: false } });
    expect(s.manual).toEqual({ A: false, B: true });
  });

  it('merges every step map, not just manual', () => {
    let s = mergeDishState({}, {
      manual: { A: true }, manualAt: { A: '10:00' },
      starts: { A: 1000 }, doneElapsed: { A: 42 }, stepTm: { A: 300 },
    });
    s = mergeDishState(s, {
      manual: { B: true }, manualAt: { B: '10:01' },
      starts: { B: 2000 }, doneElapsed: { B: 7 }, stepTm: { B: 120 },
    });
    expect(s.manual).toEqual({ A: true, B: true });
    expect(s.manualAt).toEqual({ A: '10:00', B: '10:01' });
    expect(s.starts).toEqual({ A: 1000, B: 2000 });
    expect(s.doneElapsed).toEqual({ A: 42, B: 7 });
    expect(s.stepTm).toEqual({ A: 300, B: 120 });
  });

  it('replaces scalar fields outright and leaves the step maps alone', () => {
    let s = mergeDishState({ manual: { A: true }, ready: false }, { ready: true, completedBy: 'Abhi' });
    expect(s.ready).toBe(true);
    expect(s.completedBy).toBe('Abhi');
    expect(s.manual).toEqual({ A: true });
  });

  it('does not mutate the object it was given', () => {
    const prev = { manual: { A: true } };
    const out = mergeDishState(prev, { manual: { B: true } });
    expect(prev.manual).toEqual({ A: true });
    expect(out).not.toBe(prev);
  });

  // A realtime echo from Supabase arrives as a whole row. It used to replace
  // local state wholesale, which is how an echo carrying an older snapshot
  // erased a tap the chef had just made on this tablet.
  it('survives a realtime echo that is behind local state', () => {
    let local = mergeDishState({}, { manual: { A: true, B: true } });
    const staleEcho = { manual: { A: true } }; // server had not seen B yet
    local = mergeDishState(local, staleEcho);
    expect(local.manual).toEqual({ A: true, B: true });
  });

  // The collect-from-store list is written the same way and had the same bug:
  // tick one ingredient, tick the next, and the first came back unticked.
  it('keeps earlier ticks in the collect-from-store list', () => {
    let s = mergeDishState({}, { items_done: { 'mushroom|kg': true } });
    s = mergeDishState(s, { items_done: { 'tomato|kg': true } });
    expect(s.items_done).toEqual({ 'mushroom|kg': true, 'tomato|kg': true });
    // Unticking one must still work.
    s = mergeDishState(s, { items_done: { 'mushroom|kg': false } });
    expect(s.items_done).toEqual({ 'mushroom|kg': false, 'tomato|kg': true });
  });

  // The same store holds plain values under __dispatch_ready / __dispatch_time.
  // Spreading those turned a boolean into {}, which is truthy — a function that
  // had not gone out would have read as dispatched.
  it('passes non-object values straight through', () => {
    expect(mergeDishState(undefined, true)).toBe(true);
    expect(mergeDishState({ a: 1 }, '10:59 am')).toBe('10:59 am');
    expect(mergeDishState(true, { manual: { A: true } })).toEqual({ manual: { A: true } });
  });

  it('is null-safe on both sides', () => {
    expect(mergeDishState(null, { manual: { X: true } })).toEqual({ manual: { X: true } });
    expect(mergeDishState(undefined, {})).toEqual({});
    expect(mergeDishState({ manual: { Y: true } }, {})).toEqual({ manual: { Y: true } });
  });

  it('ignores a non-object where a step map is expected', () => {
    const s = mergeDishState({ manual: { A: true } }, { manual: null });
    expect(s.manual).toBe(null); // explicit null wins; it is not merged into
    const t = mergeDishState({ manual: { A: true } }, { manual: ['x'] });
    expect(Array.isArray(t.manual)).toBe(true);
  });
});

// The collect-from-store list. Its ticks live in the same `items_done` map that
// mergeDishState protects, and the key rule used to be copy-pasted in four
// places — one drifting copy would have silently orphaned every tick.
describe('storeItemKey', () => {
  it('ignores case and surrounding space in the name', () => {
    expect(storeItemKey({ n: '  Onion ', fam: 'w' })).toBe(storeItemKey({ n: 'onion', fam: 'w' }));
  });

  it('keys on the unit FAMILY, so a kg<->gm rescale keeps the tick', () => {
    // Same ingredient, same family, different display unit after rescaling.
    expect(storeItemKey({ n: 'Onion', fam: 'w', u: 'gm' })).toBe(storeItemKey({ n: 'Onion', fam: 'w', u: 'kg' }));
  });

  it('keeps different families apart', () => {
    expect(storeItemKey({ n: 'Milk', fam: 'v' })).not.toBe(storeItemKey({ n: 'Milk', fam: 'w' }));
  });

  it('falls back to the display unit when family is missing', () => {
    expect(storeItemKey({ n: 'Egg', u: 'pcs' })).toBe('egg|pcs');
  });
});

describe('markAllCollected', () => {
  it('ticks every row of the list', () => {
    const items = [{ n: 'Onion', fam: 'w' }, { n: 'Milk', fam: 'v' }, { n: 'Egg', u: 'pcs' }];
    const delta = markAllCollected(items);
    expect(Object.keys(delta)).toHaveLength(3);
    expect(items.every(i => delta[storeItemKey(i)] === true)).toBe(true);
  });

  it('merges onto existing ticks instead of replacing them', () => {
    // This is the whole point of the Done button: whatever was already ticked
    // stays ticked, and everything else joins it at 100%.
    const items = [{ n: 'Onion', fam: 'w' }, { n: 'Milk', fam: 'v' }];
    const prev = { items_done: { [storeItemKey(items[0])]: true } };
    const next = mergeDishState(prev, { end: 123, items_done: markAllCollected(items) });
    expect(items.every(i => next.items_done[storeItemKey(i)] === true)).toBe(true);
    expect(next.end).toBe(123);
  });

  it('survives an empty or missing list', () => {
    expect(markAllCollected([])).toEqual({});
    expect(markAllCollected(undefined)).toEqual({});
  });
});

// isSessionAuthError — the classifier that decides whether a failed
// kitchen_tracking write gets durably queued for replay (a session/auth
// problem, cured by logging in again) or just logged+alerted as a genuine,
// non-retryable failure (today's behavior, correct for everything else).
describe('isSessionAuthError', () => {
  it('recognizes PostgREST JWT error codes', () => {
    expect(isSessionAuthError({ code: 'PGRST301', message: 'JWT expired' })).toBe(true);
    expect(isSessionAuthError({ code: 'PGRST302' })).toBe(true);
    expect(isSessionAuthError({ code: 'PGRST303' })).toBe(true);
  });

  it('recognizes Postgres insufficient-privilege (a lapsed-to-anon session under RLS)', () => {
    expect(isSessionAuthError({ code: '42501' })).toBe(true);
  });

  it('recognizes a bare 401 status with no code', () => {
    expect(isSessionAuthError({ status: 401, message: 'Unauthorized' })).toBe(true);
  });

  it('recognizes "jwt" in the message even with no code', () => {
    expect(isSessionAuthError({ message: 'JWT expired' })).toBe(true);
  });

  it('does not flag an ordinary constraint/duplicate error', () => {
    expect(isSessionAuthError({ code: '23505', message: 'duplicate key' })).toBe(false);
  });

  it('does not flag a "no rows" PostgREST code', () => {
    expect(isSessionAuthError({ code: 'PGRST116' })).toBe(false);
  });

  it('does not flag a plain network failure (handled separately as offline, never reaches this classifier)', () => {
    expect(isSessionAuthError(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(isSessionAuthError(null)).toBe(false);
    expect(isSessionAuthError(undefined)).toBe(false);
  });
});

// ktReplayReconcileJobs — turns offlineQueue's { results, pending } into
// the kt_set_paths reconciliation jobs App.jsx should run after a replay.
describe('ktReplayReconcileJobs', () => {
  function ktEntry(evId, dishKey, patch, ts) {
    return { action: 'rpc', fn: 'kt_set_paths', args: { p_ev_id: evId, p_dish_key: dishKey, p_patch: patch, p_ts: ts } };
  }

  it('ignores non-kt results: a different rpc fn, a non-rpc action, and a null data result', () => {
    const other = { action: 'rpc', fn: 'some_other_rpc', args: { p_ev_id: 'E', p_dish_key: 'E|D', p_patch: { a: 1 }, p_ts: 1 } };
    const upsert = { action: 'upsert', table: 't', record: {} };
    const ktButNoData = ktEntry('E', 'E|D', { a: 1 }, 1);
    const results = [
      { entry: other, data: { data: {}, key_ts: {} } },
      { entry: upsert, data: null },
      { entry: ktButNoData, data: null }, // kt_set_paths but the replay itself returned no data
    ];
    expect(ktReplayReconcileJobs(results, [])).toEqual([]);
  });

  it('derives patchPaths via ktPatchPaths and passes evId/dishKey/result through', () => {
    const entry = ktEntry('EVT-1', 'EVT-1|Paneer', { manual: { s1: true }, starts: { s1: 5 } }, 100);
    const serverResult = { data: { manual: { s1: true } }, key_ts: { 'manual.s1': 100, 'starts.s1': 100 } };
    const jobs = ktReplayReconcileJobs([{ entry, data: serverResult }], []);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].evId).toBe('EVT-1');
    expect(jobs[0].dishKey).toBe('EVT-1|Paneer');
    expect(jobs[0].patchPaths.sort()).toEqual(['manual.s1', 'starts.s1']);
    expect(jobs[0].result).toBe(serverResult);
  });

  it('a pending entry for the same ev/dish/path excludes only that path, other paths survive', () => {
    const entry = ktEntry('EVT-1', 'EVT-1|Paneer', { manual: { s1: true }, starts: { s1: 5 } }, 100);
    const pending = [ktEntry('EVT-1', 'EVT-1|Paneer', { manual: { s1: false } }, 200)];
    const jobs = ktReplayReconcileJobs([{ entry, data: { data: {}, key_ts: {} } }], pending);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].patchPaths).toEqual(['starts.s1']);
  });

  it('if every path of a result is pending, no job is produced for it', () => {
    const entry = ktEntry('EVT-1', 'EVT-1|Paneer', { manual: { s1: true } }, 100);
    const pending = [ktEntry('EVT-1', 'EVT-1|Paneer', { manual: { s1: false } }, 200)];
    const jobs = ktReplayReconcileJobs([{ entry, data: { data: {}, key_ts: {} } }], pending);
    expect(jobs).toEqual([]);
  });

  it('a pending entry for a different dish or event does not exclude anything', () => {
    const entry = ktEntry('EVT-1', 'EVT-1|Paneer', { manual: { s1: true } }, 100);
    const pendingDiffDish = [ktEntry('EVT-1', 'EVT-1|OtherDish', { manual: { s1: false } }, 200)];
    const pendingDiffEvent = [ktEntry('EVT-2', 'EVT-1|Paneer', { manual: { s1: false } }, 200)];
    const jobs1 = ktReplayReconcileJobs([{ entry, data: { data: {}, key_ts: {} } }], pendingDiffDish);
    const jobs2 = ktReplayReconcileJobs([{ entry, data: { data: {}, key_ts: {} } }], pendingDiffEvent);
    expect(jobs1[0].patchPaths).toEqual(['manual.s1']);
    expect(jobs2[0].patchPaths).toEqual(['manual.s1']);
  });

  it('a __whole patch (a meta row) gives patchPaths ["__whole"]', () => {
    const entry = ktEntry('EVT-1', '__dispatch_ready', { __whole: false }, 100);
    const jobs = ktReplayReconcileJobs([{ entry, data: { data: false, key_ts: { __whole: 100 } } }], []);
    expect(jobs[0].patchPaths).toEqual(['__whole']);
  });

  it('pending non-kt entries are ignored (never throw, never exclude anything)', () => {
    const entry = ktEntry('EVT-1', 'EVT-1|Paneer', { manual: { s1: true } }, 100);
    const pending = [{ action: 'upsert', table: 't', record: {} }, { action: 'rpc', fn: 'some_other_rpc', args: {} }];
    const jobs = ktReplayReconcileJobs([{ entry, data: { data: {}, key_ts: {} } }], pending);
    expect(jobs[0].patchPaths).toEqual(['manual.s1']);
  });
});

describe('ktCatchUpOnStatus', () => {
  it('the very first SUBSCRIBED (initial state) never fires a catch-up — nothing could have been missed yet', () => {
    const r = ktCatchUpOnStatus(KT_CATCHUP_INITIAL, 'SUBSCRIBED');
    expect(r.fire).toBe(false);
    expect(r.markOwed).toBe(false);
    expect(r.next).toEqual({ everSubscribed: true, live: true, gapGen: 0 });
  });

  it('a null/undefined state is treated the same as KT_CATCHUP_INITIAL', () => {
    expect(ktCatchUpOnStatus(null, 'SUBSCRIBED')).toEqual(ktCatchUpOnStatus(KT_CATCHUP_INITIAL, 'SUBSCRIBED'));
    expect(ktCatchUpOnStatus(undefined, 'SUBSCRIBED')).toEqual(ktCatchUpOnStatus(KT_CATCHUP_INITIAL, 'SUBSCRIBED'));
  });

  it('a drop (CHANNEL_ERROR) from a live, ever-subscribed state marks owed and bumps gapGen, but does not fire', () => {
    const live = { everSubscribed: true, live: true, gapGen: 0 };
    const r = ktCatchUpOnStatus(live, 'CHANNEL_ERROR');
    expect(r.fire).toBe(false);
    expect(r.markOwed).toBe(true);
    expect(r.next).toEqual({ everSubscribed: true, live: false, gapGen: 1 });
  });

  it('TIMED_OUT and CLOSED are treated the same as any other non-SUBSCRIBED status', () => {
    const live = { everSubscribed: true, live: true, gapGen: 0 };
    expect(ktCatchUpOnStatus(live, 'TIMED_OUT')).toEqual(ktCatchUpOnStatus(live, 'CHANNEL_ERROR'));
    expect(ktCatchUpOnStatus(live, 'CLOSED')).toEqual(ktCatchUpOnStatus(live, 'CHANNEL_ERROR'));
  });

  it('a second drop while already down does not bump gapGen again, but still marks owed', () => {
    const alreadyDown = { everSubscribed: true, live: false, gapGen: 1 };
    const r = ktCatchUpOnStatus(alreadyDown, 'CHANNEL_ERROR');
    expect(r.markOwed).toBe(true);
    expect(r.next).toEqual({ everSubscribed: true, live: false, gapGen: 1 });
  });

  it('a reconnect SUBSCRIBED after a drop fires a catch-up, marks owed, and bumps gapGen', () => {
    const down = { everSubscribed: true, live: false, gapGen: 1 };
    const r = ktCatchUpOnStatus(down, 'SUBSCRIBED');
    expect(r.fire).toBe(true);
    expect(r.markOwed).toBe(true);
    expect(r.next).toEqual({ everSubscribed: true, live: true, gapGen: 2 });
  });
});

describe('ktCatchUpWaitMs', () => {
  it('no prior start (falsy lastStartAt) never waits', () => {
    expect(ktCatchUpWaitMs(Date.now(), 0, 15000)).toBe(0);
    expect(ktCatchUpWaitMs(Date.now(), null, 15000)).toBe(0);
  });

  it('within the throttle window, waits exactly the remaining time', () => {
    expect(ktCatchUpWaitMs(5000, 1000, 15000)).toBe(11000);
  });

  it('past the throttle window, waits zero instead of going negative', () => {
    expect(ktCatchUpWaitMs(20000, 1000, 15000)).toBe(0);
  });

  it('exactly at the boundary waits zero', () => {
    expect(ktCatchUpWaitMs(16000, 1000, 15000)).toBe(0);
  });
});
