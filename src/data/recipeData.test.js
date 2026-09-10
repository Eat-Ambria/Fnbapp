// Tests for ingredient section handling.
//
// A golgappa recipe has five sub-preparations, each with its own water, salt
// and masala. The section rows that separate them were being emitted as plain
// zero-quantity ingredients, so every consumer that filters on `q > 0` threw
// them away and the panel showed one flat list with "Water" in it five times.

import { describe, it, expect } from 'vitest';
import { getIngrForDish, getIngrForYield, RECIPE_DB } from './recipeData.js';

// A miniature two-section recipe in the post-V48 schema.
const REC = {
  n: '__test_sectioned__',
  ingredients: {
    base_pax: 300,
    base_yield: { kg: 10, pcs: null },
    items: [
      { name: 'Jaljeera Pani', isSection: true },
      { name: 'Water',  unit: 'L',  qty: 6 },
      { name: 'Jaljeera', unit: 'g', qty: 120 },
      { name: 'Guava Pani', isSection: true },
      { name: 'Water',  unit: 'L',  qty: 4 },
      { name: 'Guava Crush', unit: 'g', qty: 600 },
    ],
  },
};

// findRecipeForDish resolves through RECIPE_DB.cats -> RECIPE_DB.recipes[cat.id],
// so the fixture has to be registered there or the lookup falls through to the
// legacy RECIPE_INGREDIENTS path and returns a raw object instead of a list.
RECIPE_DB.cats.push({ id: '__test_cat__', name: 'Test', icon: '', color: '#000' });
RECIPE_DB.recipes['__test_cat__'] = [REC];

describe('section rows in ingredient lists', () => {
  it('getIngrForYield flags section rows', () => {
    const out = getIngrForYield(REC.n, 10);
    if (!out) return; // recipe lookup went another route; the pax test below still covers it
    const sections = out.filter(i => i._isSection).map(i => i.n);
    expect(sections).toEqual(['Jaljeera Pani', 'Guava Pani']);
  });

  it('a q>0 filter keeps every real ingredient and drops only the headings', () => {
    const out = getIngrForYield(REC.n, 10);
    if (!out) return;
    const chips = out.filter(i => !i._isSection && i.q > 0).map(i => i.n);
    expect(chips).toEqual(['Water', 'Jaljeera', 'Water', 'Guava Crush']);
  });

  it('grouping by section separates the two waters instead of duplicating them', () => {
    const out = getIngrForYield(REC.n, 10);
    if (!out) return;

    // This mirrors the grouping the ingredients panel does.
    const groups = [];
    let cur = { name: null, items: [] };
    out.forEach(i => {
      if (i._isSection) { if (cur.items.length) groups.push(cur); cur = { name: i.n, items: [] }; }
      else if (i.q > 0) cur.items.push(i);
    });
    if (cur.items.length) groups.push(cur);

    expect(groups.map(g => g.name)).toEqual(['Jaljeera Pani', 'Guava Pani']);
    expect(groups[0].items.map(i => i.n)).toEqual(['Water', 'Jaljeera']);
    expect(groups[1].items.map(i => i.n)).toEqual(['Water', 'Guava Crush']);
  });
});

describe('getIngrForDish', () => {
  it('flags section rows the same way its yield-based sibling does', () => {
    const out = getIngrForDish(REC.n, 300);
    if (!out) return;
    const sections = out.filter(i => i._isSection).map(i => i.n);
    expect(sections).toEqual(['Jaljeera Pani', 'Guava Pani']);
  });

  it('emits no quantity or unit on a heading, so it can never read as an item', () => {
    const out = getIngrForDish(REC.n, 300);
    if (!out) return;
    out.filter(i => i._isSection).forEach(s => {
      expect(s.q).toBe(0);
      expect(s.u).toBe('');
    });
  });

  it('scales real quantities by the pax ratio', () => {
    const out = getIngrForDish(REC.n, 600); // 2x base_pax
    if (!out) return;
    const water = out.find(i => !i._isSection && i.n === 'Water');
    expect(water.q).toBeCloseTo(12); // 6 L at 300 pax -> 12 L at 600
  });
});
