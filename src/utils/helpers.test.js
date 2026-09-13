// Tests for the dish-tracking merge.
//
// This exists because of a specific field bug: a chef would tap "Done" on a
// step and watch it undo itself. Nothing undid it — the write was overwritten
// by a stale copy. Every case below is one of the ways that happened.

import { describe, it, expect } from 'vitest';
import { mergeDishState, storeItemKey, markAllCollected } from './helpers.js';

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
