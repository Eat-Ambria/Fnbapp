// Tests for kitchenDishKey/kitchenDishState/isKitchenDishReady — see the file
// header in kitchenDishKey.js for why this exists (three broken readers
// across Dashboard.jsx/DeptView.jsx, each using a different wrong key shape).

import { describe, it, expect } from 'vitest';
import { kitchenDishKey, kitchenDishState, isKitchenDishReady, kitchenTrackableDishes } from './kitchenDishKey.js';
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
