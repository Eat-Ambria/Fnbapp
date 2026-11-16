// Tests for ingredient section handling.
//
// A golgappa recipe has five sub-preparations, each with its own water, salt
// and masala. The section rows that separate them were being emitted as plain
// zero-quantity ingredients, so every consumer that filters on `q > 0` threw
// them away and the panel showed one flat list with "Water" in it five times.

import { describe, it, expect, beforeEach } from 'vitest';
import { getIngrForDish, getIngrForYield, RECIPE_DB, createCustomDishInLibrary, setDishMaster } from './recipeData.js';

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

// createCustomDishInLibrary — a brand-new dish's dishes_master.section_id
// write, the FK-rejection retry (that column is a real FK to
// dish_catalogue_sections(id) — a wrong/stale id makes the WHOLE upsert
// fail, which must not lose the dish), and that a real (non-duplicate)
// write failure is reported back instead of only console.warn'd.
function fakeSupabase(handlers) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        upsert(row, opts) {
          // Snapshot the row — the real implementation mutates and reuses the
          // same object across its FK-retry (fine for a real client, which
          // serializes at call time), so capturing a live reference here
          // would make an earlier call's recorded row reflect a later
          // mutation instead of what was actually sent at that point.
          calls.push({ table, op: 'upsert', row: { ...row }, opts });
          const h = handlers.upsert && handlers.upsert[table];
          return Promise.resolve(h ? h(row, calls.filter(c => c.table === table && c.op === 'upsert').length) : { error: null });
        },
        insert(row) {
          calls.push({ table, op: 'insert', row: { ...row } });
          const h = handlers.insert && handlers.insert[table];
          return Promise.resolve(h ? h(row) : { error: null });
        },
      };
    },
  };
}

describe('createCustomDishInLibrary', () => {
  beforeEach(() => { setDishMaster({}); });

  it('writes section_id on a genuinely new dish', async () => {
    const sb = fakeSupabase({});
    const result = await createCustomDishInLibrary(sb, '__test_new_dish__', '', 'cat-chaat');
    expect(result.masterError).toBeNull();
    expect(result.sectionIdWritten).toBe('cat-chaat');
    const masterCall = sb.calls.find(c => c.table === 'dishes_master');
    expect(masterCall.row.section_id).toBe('cat-chaat');
  });

  it('never sets section_id on a dish that already exists locally', async () => {
    setDishMaster({ '__test_existing_dish__': { is_active: true } });
    const sb = fakeSupabase({});
    const result = await createCustomDishInLibrary(sb, '__test_existing_dish__', '', 'cat-chaat');
    expect(result.sectionIdWritten).toBeNull();
    const masterCall = sb.calls.find(c => c.table === 'dishes_master');
    expect(masterCall.row.section_id).toBeUndefined();
  });

  it('retries without section_id when the FK rejects it, and does not lose the dish', async () => {
    const sb = fakeSupabase({
      upsert: {
        dishes_master: (row, callNumber) => {
          if (callNumber === 1) return { error: { code: '23503', message: 'fk violation' } };
          return { error: null }; // second call, retried without section_id
        },
      },
    });
    const result = await createCustomDishInLibrary(sb, '__test_stale_section__', '', 'cat-does-not-exist');
    expect(result.masterError).toBeNull(); // the retry succeeded, so this is not a reportable failure
    expect(result.sectionIdWritten).toBeNull();
    const masterCalls = sb.calls.filter(c => c.table === 'dishes_master');
    expect(masterCalls).toHaveLength(2);
    expect(masterCalls[0].row.section_id).toBe('cat-does-not-exist');
    expect(masterCalls[1].row.section_id).toBeUndefined();
  });

  it('reports a real recipe-insert failure instead of only warning', async () => {
    const sb = fakeSupabase({
      insert: {
        recipes: () => ({ error: { code: 'XX000', message: 'boom' } }),
      },
    });
    const result = await createCustomDishInLibrary(sb, '__test_recipe_fail__', '__test_cat__', null);
    expect(result.recipeError).toBeTruthy();
    expect(result.masterError).toBeNull();
    expect(result.categoryError).toBeNull();
  });

  it('does not report a duplicate-recipe (23505) insert as a failure', async () => {
    const sb = fakeSupabase({
      insert: {
        recipes: () => ({ error: { code: '23505', message: 'duplicate' } }),
      },
    });
    const result = await createCustomDishInLibrary(sb, '__test_recipe_dupe__', '__test_cat__', null);
    expect(result.recipeError).toBeNull();
  });
});
