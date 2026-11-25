// Tests for kitchenDishKey/kitchenDishState/isKitchenDishReady — see the file
// header in kitchenDishKey.js for why this exists (three broken readers
// across Dashboard.jsx/DeptView.jsx, each using a different wrong key shape).

import { describe, it, expect, vi } from 'vitest';
import { kitchenDishKey, kitchenDishState, isKitchenDishReady, kitchenTrackableDishes, isExcludedFromKitchenTracking, kitchenMenuArr, dishesTrackedByEvents, combinedBucketAfterPartialReset, clearDishEntryForRemoval, clearKitchenTrackingForRemovedDishes } from './kitchenDishKey.js';
import { RECIPE_DB } from '../data/recipeData.js';
import { MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';

// getCatIdForDish falls back to matching a dish name against RECIPE_DB's own
// recipes — register one fixture into the (already-present-by-default,
// empty) 'beverages' category so kitchenTrackableDishes' Beverages-category
// exclusion has something real to match against, same pattern recipeData.test.js
// itself uses. The name deliberately contains no drink/fruit/dessert word at
// all, so it can't ALSO be caught by pinnedDeptForDish or by
// guessSectionForDish's own word-based guessing (which getCatIdForDish falls
// back to) — isolating this exclusion path from the other two.
const BEV_DISH = 'Test Fixture Zzyx Special __kt_bev';
// "Ice cream" is in pinnedDeptForDish's own regex, but guessSectionForDish
// (which getCatIdForDish falls back to) classifies it as Sweets, not
// Beverages — isolating the pinnedDeptForDish exclusion path (handled in
// kitchenMenuArr, upstream of isExcludedFromKitchenTracking) from the
// Beverages-SOP-category one.
const PINNED_DISH = 'Vanilla Ice Cream';
const FRUIT_DISH = '5 Imported Fruits'; // isFruitSelectionDish is pure regex parsing, no fixture needed
const NORMAL_DISH = 'Paneer Tikka';
RECIPE_DB.recipes.beverages.push({ n: BEV_DISH, sub: '', steps: [] });

// A test-only package, registered into the real MENU_PACKAGE_SECTIONS object
// (same pattern as the RECIPE_DB fixture above) — exercises
// isExcludedFromKitchenTracking's SYNCHRONOUS real-department check
// (realDeptExcludesDish), the thing that keeps a genuinely bev/frt-dept
// dish excluded EVEN ON AN "INITIALIZED" EVENT WHOSE MENU HASN'T ACTUALLY
// BEEN RE-MIRRORED YET — caught by adversarial review: blindly trusting
// event_items_initialized alone was a real regression risk (a package
// quick-start, a package switch, or an event whose real kit menu is empty
// can all leave events.menu holding the raw, every-department package list
// for a while, with event_items_initialized already true).
const PKG_NAME = '__kt_test_pkg__';
const PKG_BEV_DISH = 'Test Fixture Package-Section Bev Dish';
const PKG_FRT_SUBSECTION_DISH = 'Test Fixture Package-Subsection Frt Dish';
const PKG_KIT_DISH = 'Test Fixture Package-Section Kit Dish';
const PKG_ADHOC_DISH = 'Test Fixture Ad-hoc Override Dish'; // not in any section's own dish list — only reachable via an override tag
// A subsection with NO own sales_dept, under a bev-dept PARENT section —
// exercises the `sub.sales_dept || secDept` inheritance fallback itself
// (the existing PKG_FRT_SUBSECTION_DISH fixture has its own explicit
// sales_dept, so that branch was never actually exercised before).
const PKG_BEV_INHERIT_SUBSECTION_DISH = 'Test Fixture Package-Subsection Inherited Bev Dish';
MENU_PACKAGE_SECTIONS[PKG_NAME] = [
  { id: 'sec_kt_test_kit', name: 'Rice Factory', sales_dept: 'kit', dishes: [PKG_KIT_DISH] },
  { id: 'sec_kt_test_bev', name: 'Beverages', sales_dept: 'bev', dishes: [PKG_BEV_DISH], subsections: [
    { id: 'sub_kt_test_bev_inherit', name: 'Mocktail Counter', dishes: [PKG_BEV_INHERIT_SUBSECTION_DISH] },
  ] },
  { id: 'sec_kt_test_main', name: 'Main Course', sales_dept: 'kit', dishes: [], subsections: [
    { id: 'sub_kt_test_frt', name: 'Fruit Counter', sales_dept: 'frt', dishes: [PKG_FRT_SUBSECTION_DISH] },
  ] },
];

// A dish placed in the kit section (definitive "keep") whose RECIPE_DB SOP
// category is ALSO "beverages" — exercises the THIRD adversarial review's
// finding: a tri-state realDeptExcludesDish result ('kit' = definitely keep)
// must short-circuit isExcludedFromKitchenTracking's own fallback chain,
// not get silently discarded and overridden by the legacy SOP-category
// heuristic on an UNINITIALIZED event (where that heuristic still runs).
const PKG_KIT_DISH_WITH_BEV_SOP = 'Test Fixture Package-Section Kit Dish With Bev SOP Category';
RECIPE_DB.recipes.beverages.push({ n: PKG_KIT_DISH_WITH_BEV_SOP, sub: '', steps: [] });
MENU_PACKAGE_SECTIONS[PKG_NAME][0].dishes.push(PKG_KIT_DISH_WITH_BEV_SOP); // sec_kt_test_kit

// A dish name listed in BOTH the kit section and the bev section (array
// order: kit first, bev second) with NO override at all — the literal
// same-dish-in-two-sections case last-match-wins exists for, not just
// inferred from the override-vs-package tests.
const PKG_DISH_IN_TWO_SECTIONS = 'Test Fixture Package Dish Listed In Two Sections';
MENU_PACKAGE_SECTIONS[PKG_NAME][0].dishes.push(PKG_DISH_IN_TWO_SECTIONS); // sec_kt_test_kit (kit, first)
MENU_PACKAGE_SECTIONS[PKG_NAME][1].dishes.push(PKG_DISH_IN_TWO_SECTIONS); // sec_kt_test_bev (bev, last — should win)

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

  it('on an INITIALIZED event, a dish whose SOP category is Beverages is KEPT — the mirror sync (syncAllKitchenMenuMirrors) already excluded real bev-dept dishes by department, so this is Kitchen\'s own dish, just filed under a Beverages SOP recipe category', () => {
    // Caught by adversarial review (Fable audit finding): checking the SOP
    // category here, unconditionally, double-filtered an initialized
    // event's already department-correct menu — silently dropping a
    // kit-department dish from every screen with nothing to explain why.
    const ev = { id: 'EVT-1', menu: [NORMAL_DISH, BEV_DISH, PINNED_DISH, FRUIT_DISH], event_items_initialized: true };
    expect(kitchenTrackableDishes(ev)).toEqual([NORMAL_DISH, BEV_DISH]);
  });
});

describe('kitchenMenuArr index stability', () => {
  it('returns Beverages-SOP-category and fruit-selection dishes UNFILTERED, in their original order — isExcludedFromKitchenTracking is what filters them, downstream, not this array itself (EventDayTab.jsx\'s byDish loop depends on that ordering staying intact — see kitchenMenuArr\'s own header comment)', () => {
    const ev = { id: 'EVT-1', menu: [NORMAL_DISH, BEV_DISH, PINNED_DISH, FRUIT_DISH] };
    expect(kitchenMenuArr(ev)).toEqual([NORMAL_DISH, BEV_DISH, FRUIT_DISH]); // PINNED_DISH alone is dropped here (pinnedDeptForDish), not BEV_DISH/FRUIT_DISH
  });
});

describe('isExcludedFromKitchenTracking', () => {
  it('a fruit-selection dish is excluded regardless of event_items_initialized', () => {
    expect(isExcludedFromKitchenTracking(FRUIT_DISH, { event_items_initialized: false })).toBe(true);
    expect(isExcludedFromKitchenTracking(FRUIT_DISH, { event_items_initialized: true })).toBe(true);
  });

  it('a Beverages-SOP-category dish is excluded on an UNINITIALIZED event (no department-filtered mirror to trust yet)', () => {
    expect(isExcludedFromKitchenTracking(BEV_DISH, { event_items_initialized: false })).toBe(true);
  });

  it('a Beverages-SOP-category dish is KEPT on an INITIALIZED event (events.menu is already department-filtered)', () => {
    expect(isExcludedFromKitchenTracking(BEV_DISH, { event_items_initialized: true })).toBe(false);
  });

  it('a normal dish is never excluded, initialized or not', () => {
    expect(isExcludedFromKitchenTracking(NORMAL_DISH, { event_items_initialized: false })).toBe(false);
    expect(isExcludedFromKitchenTracking(NORMAL_DISH, { event_items_initialized: true })).toBe(false);
  });

  it('a missing/null/undefined event is treated as uninitialized — falls back to the SOP-category heuristic', () => {
    expect(isExcludedFromKitchenTracking(BEV_DISH, null)).toBe(true);
    expect(isExcludedFromKitchenTracking(BEV_DISH, undefined)).toBe(true);
    expect(isExcludedFromKitchenTracking(NORMAL_DISH, null)).toBe(false);
  });

  // --- Caught by adversarial review: event_items_initialized alone is NOT
  // a reliable signal that events.menu has actually been re-mirrored yet.
  // These exercise the synchronous real-department check that now runs
  // FIRST, regardless of event_items_initialized, so a genuinely bev/frt
  // dish can never leak into Kitchen tracking even while the mirror is
  // stale or still catching up. ---

  it('a package-SECTION bev-dept dish is excluded even on an "initialized" event whose menu has NOT actually been re-mirrored yet', () => {
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME };
    expect(isExcludedFromKitchenTracking(PKG_BEV_DISH, ev)).toBe(true);
  });

  it('a package-SUBSECTION frt-dept dish is excluded the same way, inheriting from its own sales_dept (not its kit-dept parent)', () => {
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME };
    expect(isExcludedFromKitchenTracking(PKG_FRT_SUBSECTION_DISH, ev)).toBe(true);
  });

  it('a package-section KIT-dept dish is correctly NOT excluded by the real-department check', () => {
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME };
    expect(isExcludedFromKitchenTracking(PKG_KIT_DISH, ev)).toBe(false);
  });

  it('an ad-hoc dish tagged via a per-event override to a bev-dept package section is excluded, even though it is in no section\'s own static dish list', () => {
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME, menu_section_overrides: { [PKG_ADHOC_DISH]: 'sec_kt_test_bev' } };
    expect(isExcludedFromKitchenTracking(PKG_ADHOC_DISH, ev)).toBe(true);
  });

  it('a dish with NO package/override signal at all (BEV_DISH, SOP-category-only) still falls through to trusting an initialized event\'s mirror', () => {
    // Re-confirms the ORIGINAL fix still holds once the real-department
    // check is added in front of it: a dish the package itself says
    // nothing about is not something the synchronous check can catch
    // either way, so it correctly falls through to the next signal.
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME };
    expect(isExcludedFromKitchenTracking(BEV_DISH, ev)).toBe(false);
  });

  it('pinnedDeptForDish wins over a package placement that would otherwise say kit — a pinned dish is always non-kit', () => {
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME, menu_section_overrides: { [PINNED_DISH]: 'sec_kt_test_kit' } };
    expect(isExcludedFromKitchenTracking(PINNED_DISH, ev)).toBe(true);
  });

  // --- Caught by the SECOND adversarial review round: the first version of
  // realDeptExcludesDish checked the package-section loop BEFORE the
  // per-event override, and used first-match-wins — both wrong relative to
  // resolveDeptForDish's real precedence. These exercise the corrected
  // order directly: an override must win over the package's own placement
  // in BOTH directions, not just the one direction the first 6 tests above
  // happened to cover. ---

  it('an override moving a dish OUT of its bev package section into kit is KEPT, not excluded — the override wins over the section it sits in', () => {
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME, menu_section_overrides: { [PKG_BEV_DISH]: 'sec_kt_test_kit' } };
    expect(isExcludedFromKitchenTracking(PKG_BEV_DISH, ev)).toBe(false);
  });

  it('an override moving a dish INTO bev from its kit package section is EXCLUDED, not kept — the override wins even though the kit section would be reached first in a first-match scan', () => {
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME, menu_section_overrides: { [PKG_KIT_DISH]: 'sec_kt_test_bev' } };
    expect(isExcludedFromKitchenTracking(PKG_KIT_DISH, ev)).toBe(true);
  });

  it('a subsection with NO own sales_dept inherits its bev-dept PARENT section\'s dept (not just the kit-dept-parent case already covered by PKG_FRT_SUBSECTION_DISH)', () => {
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME };
    expect(isExcludedFromKitchenTracking(PKG_BEV_INHERIT_SUBSECTION_DISH, ev)).toBe(true);
  });

  it('an override that resolves to null (points at an id this synchronous check cannot resolve, e.g. a catalogue section) is treated as "no signal", not as an exclusion by itself, for a dish with no package placement either', () => {
    // PKG_ADHOC_DISH sits in no section's own dish list, so once the
    // unresolvable override is correctly skipped (never substituted for a
    // real department, and never mistaken for a package-section id), the
    // package scan that follows also finds nothing for it — this only comes
    // out `false` if the null override result was genuinely treated as no
    // signal, not used as a department either way.
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME, menu_section_overrides: { [PKG_ADHOC_DISH]: 'cat_section_unresolvable_id' } };
    expect(isExcludedFromKitchenTracking(PKG_ADHOC_DISH, ev)).toBe(false);
  });

  // --- Caught by a THIRD adversarial review round: a boolean-returning
  // realDeptExcludesDish conflated "definitively resolved to kit" with "no
  // signal at all" (both `false`), so a definitive kit answer could still
  // be discarded and overridden by the legacy SOP-category fallback. ---

  it('a dish definitively placed in a KIT package section is kept even on an UNINITIALIZED event, even though its own SOP/recipe category is "beverages" — a definitive real-department answer must short-circuit the SOP-category fallback, not get silently overridden by it', () => {
    const ev = { event_items_initialized: false, menuPackage: PKG_NAME };
    expect(isExcludedFromKitchenTracking(PKG_KIT_DISH_WITH_BEV_SOP, ev)).toBe(false);
  });

  it('the same dish listed in both a kit section and a bev section (array order: kit first, bev last), with no override at all, resolves via the LAST match — the literal same-dish-in-two-sections case, not just inferred from override-vs-package precedence', () => {
    const ev = { event_items_initialized: true, menuPackage: PKG_NAME };
    expect(isExcludedFromKitchenTracking(PKG_DISH_IN_TWO_SECTIONS, ev)).toBe(true);
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

describe('clearDishEntryForRemoval', () => {
  it('nulls every top-level field the old entry had', () => {
    const old = { ready: true, readyAt: '10:00am' };
    expect(clearDishEntryForRemoval(old)).toEqual({ ready: null, readyAt: null });
  });

  it('nulls every sub-key inside a DISH_STEP_MAPS field (e.g. manual), not the whole map at once', () => {
    const old = { manual: { 0: true, 1: false } };
    expect(clearDishEntryForRemoval(old)).toEqual({ manual: { 0: null, 1: null } });
  });

  it('also nulls mesaDone — unlike tombstoneAgainst\'s own caller (a day reset), a dish leaving the menu entirely has nothing else sharing this row', () => {
    const old = { ready: true, mesaDone: true };
    expect(clearDishEntryForRemoval(old)).toEqual({ ready: null, mesaDone: null });
  });

  it('a null/undefined/empty old entry returns an empty object, never throws', () => {
    expect(clearDishEntryForRemoval(null)).toEqual({});
    expect(clearDishEntryForRemoval(undefined)).toEqual({});
    expect(clearDishEntryForRemoval({})).toEqual({});
  });
});

// Pulled out of EventMenuBuilderView.jsx (its own former private copy) so a
// second caller (Dashboard.jsx's package-switch reseed) doesn't duplicate it
// — now directly testable as a pure function of its three arguments, with no
// component/React-effect harness needed.
describe('clearKitchenTrackingForRemovedDishes', () => {
  it('clears a removed dish\'s tracked entry via clearDishEntryForRemoval, leaving other dishes/events untouched', () => {
    const prev = {
      'EVT-1': {
        'EVT-1|Paneer Tikka': { ready: true, readyAt: '10:00am' },
        'EVT-1|Dal Makhani': { ready: true },
      },
      'EVT-2': { 'EVT-2|Paneer Tikka': { ready: true } },
    };
    let next;
    clearKitchenTrackingForRemovedDishes((updater) => { next = updater(prev); }, 'EVT-1', ['Paneer Tikka']);
    expect(next['EVT-1']['EVT-1|Paneer Tikka']).toEqual({ ready: null, readyAt: null });
    expect(next['EVT-1']['EVT-1|Dal Makhani']).toEqual({ ready: true }); // untouched
    expect(next['EVT-2']).toBe(prev['EVT-2']); // a different event's row is a completely untouched reference
  });

  it('clears multiple removed dishes in one call', () => {
    const prev = { 'EVT-1': { 'EVT-1|A': { ready: true }, 'EVT-1|B': { ready: true }, 'EVT-1|C': { ready: true } } };
    let result;
    clearKitchenTrackingForRemovedDishes((updater) => { result = updater(prev); }, 'EVT-1', ['A', 'B']);
    expect(result['EVT-1']['EVT-1|A']).toEqual({ ready: null });
    expect(result['EVT-1']['EVT-1|B']).toEqual({ ready: null });
    expect(result['EVT-1']['EVT-1|C']).toEqual({ ready: true }); // not in the removed list — untouched
  });

  it('returns the EXACT SAME prev reference (no re-render) when none of the named dishes were ever tracked for this event', () => {
    const prev = { 'EVT-1': { 'EVT-1|Paneer Tikka': { ready: true } } };
    let result;
    clearKitchenTrackingForRemovedDishes((updater) => { result = updater(prev); }, 'EVT-1', ['Some Other Dish']);
    expect(result).toBe(prev);
  });

  it('is a no-op (never calls setKitchenTracking) when setKitchenTracking is missing, names is empty/null, or eventId is missing', () => {
    const setKitchenTracking = vi.fn();
    clearKitchenTrackingForRemovedDishes(null, 'EVT-1', ['Paneer Tikka']); // no setter at all — must not throw
    clearKitchenTrackingForRemovedDishes(setKitchenTracking, 'EVT-1', []);
    clearKitchenTrackingForRemovedDishes(setKitchenTracking, 'EVT-1', null);
    clearKitchenTrackingForRemovedDishes(setKitchenTracking, null, ['Paneer Tikka']);
    expect(setKitchenTracking).not.toHaveBeenCalled();
  });

  it('handles an event with no existing tracking row at all without throwing', () => {
    const prev = {};
    let result;
    clearKitchenTrackingForRemovedDishes((updater) => { result = updater(prev); }, 'EVT-1', ['Paneer Tikka']);
    expect(result).toBe(prev);
  });
});
