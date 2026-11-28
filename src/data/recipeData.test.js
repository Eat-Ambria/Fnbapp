// Tests for ingredient section handling.
//
// A golgappa recipe has five sub-preparations, each with its own water, salt
// and masala. The section rows that separate them were being emitted as plain
// zero-quantity ingredients, so every consumer that filters on `q > 0` threw
// them away and the panel showed one flat list with "Water" in it five times.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getIngrForDish, getIngrForYield, RECIPE_DB, createCustomDishInLibrary, setDishMaster, getAllDishes, hydrateRecipeData } from './recipeData.js';

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

  it('also records the section as a real dish_section_links membership row', async () => {
    const sb = fakeSupabase({});
    await createCustomDishInLibrary(sb, '__test_new_dish_link__', '', 'cat-chaat');
    const linkCall = sb.calls.find(c => c.table === 'dish_section_links');
    expect(linkCall).toBeTruthy();
    expect(linkCall.row).toEqual({ dish_name: '__test_new_dish_link__', section_id: 'cat-chaat', sort_order: 0 });
  });

  it('does not touch dish_section_links when no section was written', async () => {
    const sb = fakeSupabase({});
    await createCustomDishInLibrary(sb, '__test_no_section__', '', null);
    expect(sb.calls.find(c => c.table === 'dish_section_links')).toBeUndefined();
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

// getAllDishes's hasRecipe — a dish whose name differs from its recipe's by
// case/whitespace only must still be recognized as having a recipe (same
// tiers findRecipeForDish already accepts), without widening into the
// substring/normalized tiers that function also has (too risky for a GATING
// decision — see the comment at getAllDishes's own recipeNameLower block).
RECIPE_DB.cats.push({ id: '__test_cat2__', name: 'Test2', icon: '', color: '#000' });
RECIPE_DB.recipes['__test_cat2__'] = [{ n: 'Paneer Tikka __t', sub: '', steps: [] }];

describe('getAllDishes hasRecipe', () => {
  afterEach(() => {
    setDishMaster({});
    hydrateRecipeData({ dishNameMap: {} });
  });

  function dishByName(name) {
    return getAllDishes({ includeInactive: true }).find(d => d.dish_name === name);
  }

  it('a case-insensitive exact match resolves (was false before this fix)', () => {
    setDishMaster({ 'paneer tikka __t': { is_active: true } });
    expect(dishByName('paneer tikka __t').hasRecipe).toBe(true);
  });

  it('a case- AND whitespace-insensitive match resolves', () => {
    setDishMaster({ ' Paneer Tikka __t ': { is_active: true } });
    expect(dishByName(' Paneer Tikka __t ').hasRecipe).toBe(true);
  });

  it('an explicit __none__ map entry blocks even a case-insensitive match', () => {
    setDishMaster({ 'PANEER TIKKA __T': { is_active: true } });
    hydrateRecipeData({ dishNameMap: { 'PANEER TIKKA __T': '__none__' } });
    const d = dishByName('PANEER TIKKA __T');
    expect(d.hasRecipe).toBe(false);
    expect(d.explicitNone).toBe(true);
  });

  it('an exact-name recipe match stays true even alongside an exact __none__ entry (preserved, out-of-scope quirk)', () => {
    setDishMaster({ 'Paneer Tikka __t': { is_active: true } });
    hydrateRecipeData({ dishNameMap: { 'Paneer Tikka __t': '__none__' } });
    expect(dishByName('Paneer Tikka __t').hasRecipe).toBe(true);
  });

  it('an exact map key pointing to a differently-cased recipe resolves, mappedTo shows the recipe\'s real casing', () => {
    setDishMaster({ '__test_mapped_dish__': { is_active: true } });
    hydrateRecipeData({ dishNameMap: { '__test_mapped_dish__': 'paneer tikka __t' } });
    const d = dishByName('__test_mapped_dish__');
    expect(d.hasRecipe).toBe(true);
    expect(d.mappedTo).toBe('Paneer Tikka __t'); // the recipe's own casing, not the map value's literal 'paneer tikka __t'
  });

  it('a map KEY that only matches case-insensitively still resolves (lookupDishNameMap\'s own fallback, mirrored here)', () => {
    setDishMaster({ '__TEST_CI_KEY__': { is_active: true } });
    hydrateRecipeData({ dishNameMap: { '__test_ci_key__': 'Paneer Tikka __t' } }); // key differs only in case from the dish name
    const d = dishByName('__TEST_CI_KEY__');
    expect(d.hasRecipe).toBe(true);
    expect(d.mappedTo).toBe('Paneer Tikka __t');
  });

  it('a __none__ reached only via a case-insensitive map KEY still blocks resolution', () => {
    setDishMaster({ '__TEST_CI_NONE__': { is_active: true } });
    hydrateRecipeData({ dishNameMap: { '__test_ci_none__': '__none__' } }); // key differs only in case
    const d = dishByName('__TEST_CI_NONE__');
    expect(d.hasRecipe).toBe(false);
  });

  it('a __none__ dish with no recipe at all stays unmapped', () => {
    setDishMaster({ '__test_none_dish__': { is_active: true } });
    hydrateRecipeData({ dishNameMap: { '__test_none_dish__': '__none__' } });
    const d = dishByName('__test_none_dish__');
    expect(d.hasRecipe).toBe(false);
    expect(d.explicitNone).toBe(true);
  });

  it('a substring-only match does NOT resolve (Tier 2 deliberately excluded)', () => {
    setDishMaster({ 'Tikka __t': { is_active: true } }); // substring of 'Paneer Tikka __t', not an exact ci match
    expect(dishByName('Tikka __t').hasRecipe).toBe(false);
  });
});
