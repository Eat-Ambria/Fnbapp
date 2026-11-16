// Tests for the offline write queue's session gate and retry classifier.
//
// replayQueue's own "permanently-failing entry" handling deletes an entry
// the moment its replay fails with an error carrying a `.code` — which is
// exactly what a kitchen_tracking (or any RLS-protected) write gets back
// when replayed as an anonymous session (42501, insufficient privilege).
// Without the session gate, a tablet that reloads into a logged-out state
// would have its ENTIRE queue destroyed on the very first automatic replay
// attempt (the 2-minute ping, or an `online` event), with no way to recover
// it even after logging back in.
//
// Vitest runs this file in a plain Node environment (no jsdom) — there is
// no real `localStorage`/`indexedDB`/`window`. replayQueue's own try/catch
// blocks around both of its queue implementations silently swallow the
// resulting ReferenceError either way, so an EARLIER version of these tests
// that only checked the return value (0) and that `rpc` was never called
// passed identically whether or not the session gate existed at all — they
// were only proving "this environment has no storage", not that the gate
// works. A minimal `localStorage` stub (the fallback queue replayQueue
// already falls back to when IndexedDB is unavailable, which it always is
// here) lets these tests actually drive a real replay attempt through the
// gate, so a regression that deletes the gate makes the blocking tests fail
// for the right reason — entries would get touched/replayed — not just
// "no storage available".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { replayQueue, isOfflineError } from './offlineQueue.js';

const OFFQ_KEY = 'ambria_offq';

function makeLocalStorageStub() {
  let store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _dump: () => ({ ...store }),
  };
}

describe('replayQueue session gate', () => {
  let originalLocalStorage;
  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = makeLocalStorageStub();
  });
  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  it('returns 0 and leaves a queued entry untouched when there is no session', async () => {
    const queued = [{ action: 'rpc', fn: 'kt_set_paths', args: { p_ev_id: 'EVT-1', p_dish_key: 'EVT-1|Paneer', p_ts: 123 }, ts: 123 }];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const rpc = vi.fn();
    const from = vi.fn();
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } });
    const fakeSupabase = { auth: { getSession }, rpc, from };

    const result = await replayQueue(fakeSupabase);

    expect(result).toEqual({ replayed: 0, results: [], pending: [] });
    expect(getSession).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    // The entry must still be there, byte-for-byte — this is the actual
    // regression the gate exists to prevent (destroying it on the first
    // attempt while logged out).
    expect(JSON.parse(globalThis.localStorage.getItem(OFFQ_KEY))).toEqual(queued);
  });

  it('returns 0 when getSession itself throws, and still leaves the queue untouched', async () => {
    const queued = [{ action: 'rpc', fn: 'kt_set_paths', args: { p_ts: 1 }, ts: 1 }];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const rpc = vi.fn();
    const fakeSupabase = { auth: { getSession: vi.fn().mockRejectedValue(new Error('network down')) }, rpc };
    const result = await replayQueue(fakeSupabase);
    expect(result).toEqual({ replayed: 0, results: [], pending: [] });
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.parse(globalThis.localStorage.getItem(OFFQ_KEY))).toEqual(queued);
  });

  it('returns 0 when getSession resolves with no data at all', async () => {
    const fakeSupabase = { auth: { getSession: vi.fn().mockResolvedValue({ data: null }) }, rpc: vi.fn() };
    expect(await replayQueue(fakeSupabase)).toEqual({ replayed: 0, results: [], pending: [] });
  });

  it('returns 0 immediately when supabase itself is falsy', async () => {
    expect(await replayQueue(null)).toEqual({ replayed: 0, results: [], pending: [] });
    expect(await replayQueue(undefined)).toEqual({ replayed: 0, results: [], pending: [] });
  });

  it('a session DOES exist — the queued entry actually replays and is removed', async () => {
    const queued = [{ action: 'rpc', fn: 'kt_set_paths', args: { p_ev_id: 'EVT-1', p_dish_key: 'EVT-1|Paneer', p_ts: 123 }, ts: 123 }];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    const fakeSupabase = { auth: { getSession }, rpc };

    const result = await replayQueue(fakeSupabase);

    expect(getSession).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('kt_set_paths', queued[0].args);
    expect(result.replayed).toBe(1);
    expect(JSON.parse(globalThis.localStorage.getItem(OFFQ_KEY))).toEqual([]);
  });

  it('a session exists, but the replay fails permanently (a real .code error) — the entry is dropped, not retried forever', async () => {
    const queued = [{ action: 'rpc', fn: 'kt_set_paths', args: { p_ts: 1 }, ts: 1 }];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } });
    const fakeSupabase = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: {} } }) }, rpc };

    const result = await replayQueue(fakeSupabase);

    expect(result.replayed).toBe(0); // dropped, not counted as replayed
    expect(result.results).toEqual([]);
    expect(result.pending).toEqual([]);
    expect(JSON.parse(globalThis.localStorage.getItem(OFFQ_KEY))).toEqual([]); // removed from the queue, not left to retry forever
  });
});

describe('replayQueue result surfacing', () => {
  let originalLocalStorage;
  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = makeLocalStorageStub();
  });
  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  function withSession(rpc, from) {
    return { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: {} } }) }, rpc, from };
  }

  it('a successful rpc replay surfaces its own returned data', async () => {
    const queued = [{ action: 'rpc', fn: 'kt_set_paths', args: { p_ev_id: 'EVT-1', p_dish_key: 'EVT-1|Paneer', p_patch: { manual: { s1: false } }, p_ts: 100 }, ts: 100 }];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const returned = { data: { manual: { s1: false } }, key_ts: { 'manual.s1': 200 } };
    const rpc = vi.fn().mockResolvedValue({ data: returned, error: null });

    const result = await replayQueue(withSession(rpc));

    expect(result.results).toEqual([{ entry: queued[0], data: returned }]);
    expect(result.pending).toEqual([]);
  });

  it('a permanently-failed entry (a real .code error) appears in neither results nor pending', async () => {
    const queued = [{ action: 'rpc', fn: 'kt_set_paths', args: { p_ts: 1 }, ts: 1 }];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } });

    const result = await replayQueue(withSession(rpc));

    expect(result.results).toEqual([]);
    expect(result.pending).toEqual([]);
  });

  it('a retryable failure (no .code — a genuine network error) is surfaced in pending, not results, and stays queued', async () => {
    const queued = [{ action: 'rpc', fn: 'kt_set_paths', args: { p_ts: 1 }, ts: 1 }];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });

    const result = await replayQueue(withSession(rpc));

    expect(result.results).toEqual([]);
    expect(result.pending).toEqual([queued[0]]);
    expect(JSON.parse(globalThis.localStorage.getItem(OFFQ_KEY))).toEqual([queued[0]]);
  });

  it('a mixed queue [ok, retryable, ok] replays the two ok entries and keeps the middle one pending', async () => {
    const queued = [
      { action: 'rpc', fn: 'kt_set_paths', args: { p_ev_id: 'A', p_ts: 1 }, ts: 1 },
      { action: 'rpc', fn: 'kt_set_paths', args: { p_ev_id: 'B', p_ts: 2 }, ts: 2 },
      { action: 'rpc', fn: 'kt_set_paths', args: { p_ev_id: 'C', p_ts: 3 }, ts: 3 },
    ];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { ok: 'A' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
      .mockResolvedValueOnce({ data: { ok: 'C' }, error: null });

    const result = await replayQueue(withSession(rpc));

    expect(result.replayed).toBe(2);
    expect(result.results.map(r => r.entry.args.p_ev_id)).toEqual(['A', 'C']);
    expect(result.pending).toEqual([queued[1]]);
    expect(JSON.parse(globalThis.localStorage.getItem(OFFQ_KEY))).toEqual([queued[1]]);
  });

  it('a non-rpc (upsert) success appears in results with data: null', async () => {
    const queued = [{ action: 'upsert', table: 'some_table', record: { id: 1 }, ts: 1 }];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });

    const result = await replayQueue(withSession(undefined, from));

    expect(result.results).toEqual([{ entry: queued[0], data: null }]);
  });

  it('an rpc resolving with no data gives data: null, not undefined', async () => {
    const queued = [{ action: 'rpc', fn: 'kt_set_paths', args: { p_ts: 1 }, ts: 1 }];
    globalThis.localStorage.setItem(OFFQ_KEY, JSON.stringify(queued));
    const rpc = vi.fn().mockResolvedValue({ error: null }); // data undefined

    const result = await replayQueue(withSession(rpc));

    expect(result.results).toEqual([{ entry: queued[0], data: null }]);
  });
});

describe('isOfflineError (replay-time classification)', () => {
  it('treats PostgREST JWT-expired/invalid codes as retryable', () => {
    expect(isOfflineError({ code: 'PGRST301' })).toBe(true);
    expect(isOfflineError({ code: 'PGRST302' })).toBe(true);
    expect(isOfflineError({ code: 'PGRST303' })).toBe(true);
  });

  it('does NOT treat insufficient-privilege (42501) as retryable — a real RLS denial with a valid session is permanent', () => {
    expect(isOfflineError({ code: '42501' })).toBe(false);
  });

  it('does not treat an ordinary constraint error as retryable', () => {
    expect(isOfflineError({ code: '23505' })).toBe(false);
  });

  it('treats an error with no code as retryable (a genuine network failure never gets a server response to carry one)', () => {
    expect(isOfflineError({})).toBe(true);
    expect(isOfflineError(new TypeError('Failed to fetch'))).toBe(true);
  });
});
