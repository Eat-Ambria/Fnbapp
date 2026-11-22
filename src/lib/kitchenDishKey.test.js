// Tests for kitchenDishKey/kitchenDishState/isKitchenDishReady — see the file
// header in kitchenDishKey.js for why this exists (three broken readers
// across Dashboard.jsx/DeptView.jsx, each using a different wrong key shape).

import { describe, it, expect } from 'vitest';
import { kitchenDishKey, kitchenDishState, isKitchenDishReady, kitchenTrackableDishes, dishesTrackedByEvents, combinedBucketAfterPartialReset } from './kitchenDishKey.js';
import { RECIPE_DB } from '../data/recipeData.js';

// getCatIdForDish falls back to matching a dish name against RECIPE_DB's own
// recipes — register one fixture into the (already-present-by-default,
// empty) 'beverages' category so kitchenTrackableDishes' Beverages-category
// exclusion has something real to match against, same pattern recipeData.test.js
// itself uses. The name deliberately contains no drink/fruit/dessert word at
// all, so it can't ALSO be caught by pinnedDeptForDish or by
// guessSectionForDish's own word-based guessing (which getCatIdForDish falls
// back to) — isolating this exclusion path from the other two.
RECIPE_DB.recipes.beverages.push({ n: 'Test Fixture Zzyx Special __kt_bev', sub: '', steps: [] });

describe('kitchenDishKey', () => {
  it('builds "<evId>|<dishName>", matching dk() in EventDayTab.jsx/KitchenHub.jsx', () => {
    expect(kitchenDishKey('EVT-1', 'Paneer Tikka')).toBe('EVT-1|Paneer Tikka');
  });
});

describe('kitchenDishState / isKitchenDishReady', () => {
  const KT = {
    'EVT-1': {
      'EVT-1|Paneer Tikka': { ready: true, readyAt: '10:00am' },
      'EVT-1|Dal Makhani': { ready: false, manual: { 0: true } },
    },
  };

  it('finds a name-keyed row and reads its ready flag', () => {
    expect(kitchenDishState(KT, 'EVT-1', 'Paneer Tikka')).toEqual({ ready: true, readyAt: '10:00am' });
    expect(isKitchenDishReady(KT, 'EVT-1', 'Paneer Tikka')).toBe(true);
  });

  it('a dish with ready:false is not ready', () => {
    expect(isKitchenDishReady(KT, 'EVT-1', 'Dal Makhani')).toBe(false);
  });

  it('an index-based legacy key ("evId|0") is NOT found by dish name — the bug this replaces', () => {
    const ktLegacyOnly = { 'EVT-1': { 'EVT-1|0': { ready: true } } };
    expect(isKitchenDishReady(ktLegacyOnly, 'EVT-1', 'Paneer Tikka')).toBe(false);
  });

  it('the invented "d_<idx>" shape is NOT found either — the other bug this replaces', () => {
    const ktDShapeOnly = { 'EVT-1': { 'd_0': { ready: true } } };
    expect(isKitchenDishReady(ktDShapeOnly, 'EVT-1', 'Paneer Tikka')).toBe(false);
  });

  it('a dish name that only exists in a FILTERED menu (e.g. Beverages dropped) still resolves correctly, since the key never depended on array position', () => {
    const ktFiltered = { 'EVT-1': { 'EVT-1|Gulab Jamun': { ready: true } } };
    // "Gulab Jamun" might be index 0 in the filtered array and index 3 in the
    // real menu — name-keying means neither index ever mattered.
    expect(isKitchenDishReady(ktFiltered, 'EVT-1', 'Gulab Jamun')).toBe(true);
  });

  it('a missing event, missing dish, or null/undefined kt never throws, and reads as not-ready', () => {
    expect(kitchenDishState(null, 'EVT-1', 'Paneer Tikka')).toEqual({});
    expect(kitchenDishState(undefined, 'EVT-1', 'Paneer Tikka')).toEqual({});
    expect(kitchenDishState(KT, 'EVT-NOPE', 'Paneer Tikka')).toEqual({});
    expect(kitchenDishState(KT, 'EVT-1', 'Nope')).toEqual({});
    expect(isKitchenDishReady(null, 'EVT-1', 'Paneer Tikka')).toBe(false);
  });

});

describe('kitchenTrackableDishes', () => {
  // A name with no drink/dessert/fruit word of any kind — so this is excluded
  // ONLY by matching the RECIPE_DB.recipes.beverages fixture above, never by
  // pinnedDeptForDish or guessSectionForDish's own word-based guessing (which
  // getCatIdForDish also falls back to) — isolating the Beverages-CATEGORY
  // exclusion path from the other two.
  const BEV_DISH = 'Test Fixture Zzyx Special __kt_bev';
  // "Ice cream" is in pinnedDeptForDish's own regex, but guessSectionForDish
  // (which getCatIdForDish falls back to) classifies it as Sweets, not
  // Beverages — isolating the pinnedDeptForDish exclusion path from the
  // Beverages-category one (an earlier "Iced Tea" fixture here matched BOTH
  // paths at once, so neither was actually being tested on its own).
  const PINNED_DISH = 'Vanilla Ice Cream';
  const FRUIT_DISH = '5 Imported Fruits'; // isFruitSelectionDish is pure regex parsing, no fixture needed
  const NORMAL_DISH = 'Paneer Tikka';

  it('returns the real menu array, excluding Beverages-category, pinned-dept, and fruit-selection dishes', () => {
    const ev = { id: 'EVT-1', menu: [NORMAL_DISH, BEV_DISH, PINNED_DISH, FRUIT_DISH] };
    expect(kitchenTrackableDishes(ev)).toEqual([NORMAL_DISH]);
  });

  it('each exclusion path is independently necessary — removing any one filter would let its own dish through', () => {
    expect(kitchenTrackableDishes({ id: 'EVT-1', menu: [BEV_DISH] })).toEqual([]);
    expect(kitchenTrackableDishes({ id: 'EVT-1', menu: [PINNED_DISH] })).toEqual([]);
    expect(kitchenTrackableDishes({ id: 'EVT-1', menu: [FRUIT_DISH] })).toEqual([]);
  });

  it('an external caterer excludes the WHOLE menu, even otherwise-trackable dishes', () => {
    const ev = { id: 'EVT-1', menu: [NORMAL_DISH], external_caterer: true };
    expect(kitchenTrackableDishes(ev)).toEqual([]);
  });

  it('outsourced_dishes are excluded by name, leaving the rest', () => {
    const ev = { id: 'EVT-1', menu: [NORMAL_DISH, 'Dal Makhani'], outsourced_dishes: ['Dal Makhani'] };
    expect(kitchenTrackableDishes(ev)).toEqual([NORMAL_DISH]);
  });

  it('a JSON-string menu (not yet an array) is parsed the same way', () => {
    const ev = { id: 'EVT-1', menu: JSON.stringify([NORMAL_DISH, BEV_DISH]) };
    expect(kitchenTrackableDishes(ev)).toEqual([NORMAL_DISH]);
  });

  it('malformed menu JSON, a missing menu, and a null/undefined event never throw', () => {
    expect(kitchenTrackableDishes({ id: 'EVT-1', menu: '{not json' })).toEqual([]);
    expect(kitchenTrackableDishes({ id: 'EVT-1' })).toEqual([]);
    expect(kitchenTrackableDishes(null)).toEqual([]);
    expect(kitchenTrackableDishes(undefined)).toEqual([]);
  });
});

describe('dishesTrackedByEvents', () => {
  it('extracts dish names from a reset event\'s own existing row', () => {
    const kt = { 'A': { 'A|Paneer Tikka': { ready: true }, 'A|Dal Makhani': { ready: false } } };
    expect(dishesTrackedByEvents(kt, ['A']).sort()).toEqual(['Dal Makhani', 'Paneer Tikka']);
  });

  it('a legacy index-keyed row ("evId|<n>") is skipped, not guessed at', () => {
    const kt = { 'A': { 'A|0': { ready: true } } };
    expect(dishesTrackedByEvents(kt, ['A'])).toEqual([]);
  });

  it('combines names across multiple reset events, de-duplicated', () => {
    const kt = { 'A': { 'A|Paneer Tikka': { ready: true } }, 'B': { 'B|Paneer Tikka': { ready: true }, 'B|Dal Makhani': { ready: true } } };
    expect(dishesTrackedByEvents(kt, ['A', 'B']).sort()).toEqual(['Dal Makhani', 'Paneer Tikka']);
  });

  it('a missing event, empty evIds, or null/undefined kt never throws', () => {
    expect(dishesTrackedByEvents({ 'A': {} }, ['NOPE'])).toEqual([]);
    expect(dishesTrackedByEvents({}, [])).toEqual([]);
    expect(dishesTrackedByEvents(null, ['A'])).toEqual([]);
  });
});

describe('combinedBucketAfterPartialReset', () => {
  // Real callers always derive touchedNames via dishesTrackedByEvents first
  // (see runReset in KitchenHub.jsx) — most tests below pass it directly as
  // a literal since the dish names are already known, except the one test
  // that specifically exercises the two-step sequence end to end.
  it('a dish only the reset function tracked is dropped entirely and reported as orphaned', () => {
    const kt = {
      'A': { 'A|Paneer Tikka': { ready: true } },
      '__combined_2026-11-22': { 'dish|Paneer Tikka': { ready: true, readyAt: '10am' } },
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Paneer Tikka'], ['B']);
    expect(r.row['dish|Paneer Tikka']).toBeUndefined();
    expect(r.orphanKeys).toEqual(['dish|Paneer Tikka']);
  });

  it('a dish shared with a surviving function is replaced with that function\'s current row, stale fields nulled', () => {
    const kt = {
      'A': { 'A|Paneer Tikka': { ready: true, manual: { 0: true, 1: true } } },
      'B': { 'B|Paneer Tikka': { manual: { 0: true } } }, // B only has step 0 done, never reached ready
      '__combined_2026-11-22': { 'dish|Paneer Tikka': { ready: true, manual: { 0: true, 1: true } } },
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Paneer Tikka'], ['B']);
    // ready came only from A (the reset function) — must be explicitly nulled, not just absent
    expect(r.row['dish|Paneer Tikka'].ready).toBeNull();
    // manual.1 came only from A — nulled; manual.0 survives from B
    expect(r.row['dish|Paneer Tikka'].manual).toEqual({ 0: true, 1: null });
    expect(r.orphanKeys).toEqual([]);
  });

  it('two surviving functions sharing a dish are folded together', () => {
    const kt = {
      'A': { 'A|Dal Makhani': { ready: true } },
      'B': { 'B|Dal Makhani': { manual: { 0: true } } },
      'C': { 'C|Dal Makhani': { manual: { 1: true } } },
      '__combined_2026-11-22': { 'dish|Dal Makhani': { ready: true } },
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Dal Makhani'], ['B', 'C']);
    expect(r.row['dish|Dal Makhani'].manual).toEqual({ 0: true, 1: true });
    expect(r.row['dish|Dal Makhani'].ready).toBeNull();
  });

  it('mesaDone alone does NOT keep an otherwise-orphaned dish alive — it has no per-event echo, so nobody is left to still mean it', () => {
    // Caught by adversarial review: mesaDone is a whole-day bulk sign-off
    // with no per-event row anywhere (see setDs's own comments) — if no
    // surviving function has ANY real data for this dish, there is no way
    // to tell "a survivor still legitimately has this dish" from "nobody
    // does any more" except by that absence itself, so the whole entry
    // (mesaDone included) is orphaned rather than kept alive forever by a
    // stale marker alone.
    const kt = {
      'A': { 'A|Gulab Jamun': { ready: true } },
      '__combined_2026-11-22': { 'dish|Gulab Jamun': { ready: true, mesaDone: true } },
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Gulab Jamun'], ['B']); // B shares nothing
    expect(r.row['dish|Gulab Jamun']).toBeUndefined();
    expect(r.orphanKeys).toEqual(['dish|Gulab Jamun']);
  });

  it('mesaDone IS preserved on a dish a surviving function still has real data for', () => {
    const kt = {
      'A': { 'A|Gulab Jamun': { ready: true } },
      'B': { 'B|Gulab Jamun': { manual: { 0: true } } },
      '__combined_2026-11-22': { 'dish|Gulab Jamun': { ready: true, mesaDone: true } },
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Gulab Jamun'], ['B']);
    expect(r.row['dish|Gulab Jamun'].mesaDone).toBe(true);
    expect(r.row['dish|Gulab Jamun'].manual).toEqual({ 0: true });
    expect(r.row['dish|Gulab Jamun'].ready).toBeNull();
    expect(r.orphanKeys).toEqual([]);
  });

  it('a dish the combined bucket never had an entry for at all is left untouched, even if both a reset and a surviving function have real data for it', () => {
    // Caught by adversarial review: manufacturing a brand-new combined entry
    // here (purely from a survivor's data) would be worse than leaving it
    // absent — a reset function's OWN per-event view falls back to the
    // combined entry whenever its own row is empty, so creating one out of
    // thin air would show the just-reset function a DIFFERENT function's
    // progress, which it never did before this existed.
    const kt = {
      'A': { 'A|Rogan Josh': { ready: true } },
      'B': { 'B|Rogan Josh': { manual: { 0: true } } },
      '__combined_2026-11-22': {}, // no entry for Rogan Josh at all
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Rogan Josh'], ['B']);
    expect(r.row['dish|Rogan Josh']).toBeUndefined();
    expect(r.orphanKeys).toEqual([]);
  });

  it('a surviving function\'s own mesaDone never leaks into the recomputed entry — mesaDone is combined-only', () => {
    const kt = {
      'A': { 'A|Gulab Jamun': { ready: true } },
      'B': { 'B|Gulab Jamun': { ready: true, mesaDone: true } }, // shouldn't happen in practice, but defend anyway
      '__combined_2026-11-22': { 'dish|Gulab Jamun': { ready: true } },
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Gulab Jamun'], ['B']);
    expect(r.row['dish|Gulab Jamun'].mesaDone).toBeUndefined();
  });

  it('a dish the reset function never touched is carried over completely unchanged', () => {
    const kt = {
      'A': { 'A|Paneer Tikka': { ready: true } },
      'B': { 'B|Dal Makhani': { ready: true } },
      '__combined_2026-11-22': { 'dish|Paneer Tikka': { ready: true }, 'dish|Dal Makhani': { ready: true } },
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Paneer Tikka'], ['B']);
    expect(r.row['dish|Dal Makhani']).toEqual({ ready: true }); // untouched by A, left exactly as-is
  });

  it('non-dish keys on the combined row (section/meta state) are always carried over unchanged', () => {
    const kt = {
      'A': { 'A|Paneer Tikka': { ready: true } },
      '__combined_2026-11-22': { 'dish|Paneer Tikka': { ready: true }, '__dispatch_ready': true, '__dispatch_time': '9pm' },
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Paneer Tikka'], ['B']);
    expect(r.row['__dispatch_ready']).toBe(true);
    expect(r.row['__dispatch_time']).toBe('9pm');
  });

  it('never mutates the input kt', () => {
    const kt = {
      'A': { 'A|Paneer Tikka': { ready: true } },
      'B': { 'B|Paneer Tikka': { manual: { 0: true } } },
      '__combined_2026-11-22': { 'dish|Paneer Tikka': { ready: true, manual: { 0: true } } },
    };
    const before = JSON.stringify(kt);
    combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Paneer Tikka'], ['B']);
    expect(JSON.stringify(kt)).toBe(before);
  });

  it('no surviving functions at all orphans every dish the reset function touched', () => {
    const kt = {
      'A': { 'A|Paneer Tikka': { ready: true } },
      '__combined_2026-11-22': { 'dish|Paneer Tikka': { ready: true } },
    };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Paneer Tikka'], []);
    expect(r.row['dish|Paneer Tikka']).toBeUndefined();
    expect(r.orphanKeys).toEqual(['dish|Paneer Tikka']);
  });

  it('touchedNames naming a dish nobody has any row for at all is a no-op', () => {
    const kt = { '__combined_2026-11-22': { 'dish|Paneer Tikka': { ready: true } } };
    const r = combinedBucketAfterPartialReset(kt, '__combined_2026-11-22', ['Some Other Dish'], ['B']);
    expect(r.row['dish|Paneer Tikka']).toEqual({ ready: true });
    expect(r.orphanKeys).toEqual([]);
  });

  it('called against a LATER kt than touchedNames was derived from, an UNTOUCHED dish\'s concurrent update survives — the exact race an earlier version of this fix got wrong', () => {
    // Simulates runReset's real two-step sequence: dishesTrackedByEvents is
    // called early (before A's row is deleted) to get touchedNames, but
    // combinedBucketAfterPartialReset itself is called LATER against
    // whatever kt looks like by then — which can include a change to a
    // dish NEITHER the reset nor any currently-known surviving function
    // explicitly shares, arriving via a realtime echo from another tablet
    // in the meantime (e.g. an Undo on Dal Makhani, a dish A never had).
    const earlyKt = {
      'A': { 'A|Paneer Tikka': { ready: true } },
      '__combined_2026-11-22': { 'dish|Paneer Tikka': { ready: true }, 'dish|Dal Makhani': { mesaDone: true } },
    };
    const touchedNames = dishesTrackedByEvents(earlyKt, ['A']);
    expect(touchedNames).toEqual(['Paneer Tikka']);
    // Later, after A's row is actually deleted, Dal Makhani's combined entry
    // changes via a realtime echo — an earlier version of this fix would
    // have reverted this, since it reused a row snapshotted BEFORE this
    // change existed.
    const laterKt = {
      '__combined_2026-11-22': { 'dish|Paneer Tikka': { ready: true }, 'dish|Dal Makhani': { mesaDone: false } },
    };
    const r = combinedBucketAfterPartialReset(laterKt, '__combined_2026-11-22', touchedNames, []);
    expect(r.row['dish|Dal Makhani']).toEqual({ mesaDone: false }); // the LATER value, not the earlier one
    expect(r.row['dish|Paneer Tikka']).toBeUndefined(); // the actually-touched dish, still correctly orphaned
    expect(r.orphanKeys).toEqual(['dish|Paneer Tikka']);
  });
});
