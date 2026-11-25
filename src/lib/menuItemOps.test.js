// Tests for filterAutoSeedable — see its own header comment in menuItemOps.js
// for why it exists (Soup-Station-style "pick 2-3 of 8-10" sections/dishes
// must never be bulk-added as a package's auto-selected defaults).
//
// supabase.js's `supabase` singleton is mocked so these never make a real
// network call — the dish-level (dishes_master.no_auto_select) and
// PACKAGE-OVERRIDE-level (MENU_PACKAGE_NO_AUTO_OVERRIDES) filtering both run
// entirely off in-memory state (getAllDishes/DISH_MASTER, same fixture
// mechanism recipeData.test.js already uses); only the whole-CATALOGUE-
// SECTION-level exclusion needs the mocked `dish_catalogue_sections` query.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setDishMaster } from '../data/recipeData.js';
import { MENU_PACKAGE_NO_AUTO_OVERRIDES } from '../data/menuPackages.js';

var noAutoSectionIds = [];
var dbCalls = [];
vi.mock('./supabase.js', () => ({
  supabase: {
    from(table) {
      return {
        select() {
          return {
            eq() {
              if (table !== 'dish_catalogue_sections') return Promise.resolve({ data: [], error: null });
              return Promise.resolve({ data: noAutoSectionIds.map(function (id) { return { id: id }; }), error: null });
            },
          };
        },
        delete() {
          return {
            eq(fk, fkValue) {
              return {
                in(col, values) {
                  dbCalls.push({ table: table, op: 'delete', fk: fk, fkValue: fkValue, col: col, values: values.slice() });
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
        insert(rows) {
          return {
            select() {
              dbCalls.push({ table: table, op: 'insert', rows: rows.map(function (r) { return { ...r }; }) });
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
        update(fields) {
          return {
            eq(col, value) {
              dbCalls.push({ table: table, op: 'update', fields: { ...fields }, col: col, value: value });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  },
}));

const { filterAutoSeedable, loadPackageDefaultItems, computePackageSwitchDiff } = await import('./menuItemOps.js');

const ITEMS_CONFIG = {
  itemsTable: 'event_items', itemsFk: 'event_id', itemsFkValue: 'EVT-1',
  parentTable: 'events', parentIdValue: 'EVT-1', initializedColumn: 'event_items_initialized',
};

const PKG_NAME = '__menuitemops_test_pkg__';

describe('filterAutoSeedable', () => {
  beforeEach(() => {
    setDishMaster({});
    delete MENU_PACKAGE_NO_AUTO_OVERRIDES[PKG_NAME];
    noAutoSectionIds = [];
  });

  it('keeps a plain dish with no no_auto_select flag anywhere', async () => {
    setDishMaster({ 'Paneer Tikka': { is_active: true } });
    const out = await filterAutoSeedable(['Paneer Tikka'], PKG_NAME);
    expect(out).toEqual(['Paneer Tikka']);
  });

  it('drops a dish flagged no_auto_select on dishes_master itself', async () => {
    setDishMaster({ 'Sweet Corn Soup': { is_active: true, no_auto_select: true } });
    const out = await filterAutoSeedable(['Sweet Corn Soup', 'Paneer Tikka'], PKG_NAME);
    expect(out).toEqual(['Paneer Tikka']);
  });

  it('drops every dish in a WHOLE catalogue section flagged no_auto_select (Soup Station: pick 2-3 of 8-10)', async () => {
    noAutoSectionIds = ['sec_soup_station'];
    setDishMaster({
      'Sweet Corn Soup': { is_active: true, section_id: 'sec_soup_station' },
      'Tamatar Dhaniya Ka Shorba': { is_active: true, section_id: 'sec_soup_station' },
      'Paneer Tikka': { is_active: true, section_id: 'sec_starters' },
    });
    const out = await filterAutoSeedable(['Sweet Corn Soup', 'Tamatar Dhaniya Ka Shorba', 'Paneer Tikka'], PKG_NAME);
    expect(out).toEqual(['Paneer Tikka']);
  });

  it('a package override of true (never auto-select here) drops a dish even with no catalogue-level flag', async () => {
    setDishMaster({ 'Khao Suey': { is_active: true } });
    MENU_PACKAGE_NO_AUTO_OVERRIDES[PKG_NAME] = { 'Khao Suey': true };
    const out = await filterAutoSeedable(['Khao Suey'], PKG_NAME);
    expect(out).toEqual([]);
  });

  it('a package override of false (always auto-select here) WINS OUTRIGHT over a catalogue-level no_auto_select flag', async () => {
    setDishMaster({ 'Khao Suey': { is_active: true, no_auto_select: true } });
    MENU_PACKAGE_NO_AUTO_OVERRIDES[PKG_NAME] = { 'Khao Suey': false };
    const out = await filterAutoSeedable(['Khao Suey'], PKG_NAME);
    expect(out).toEqual(['Khao Suey']);
  });

  it('a package override of false ALSO wins outright over a whole no_auto_select SECTION, not just a dish-level flag', async () => {
    noAutoSectionIds = ['sec_soup_station'];
    setDishMaster({ 'Khao Suey': { is_active: true, section_id: 'sec_soup_station' } });
    MENU_PACKAGE_NO_AUTO_OVERRIDES[PKG_NAME] = { 'Khao Suey': false };
    const out = await filterAutoSeedable(['Khao Suey'], PKG_NAME);
    expect(out).toEqual(['Khao Suey']);
  });

  it('a dish with no override falls back to the dishes_master flag, independent of OTHER dishes in the same package having overrides', async () => {
    setDishMaster({
      'Sweet Corn Soup': { is_active: true, no_auto_select: true }, // no override for this one
      'Khao Suey': { is_active: true, no_auto_select: true }, // overridden to always-select
    });
    MENU_PACKAGE_NO_AUTO_OVERRIDES[PKG_NAME] = { 'Khao Suey': false };
    const out = await filterAutoSeedable(['Sweet Corn Soup', 'Khao Suey'], PKG_NAME);
    expect(out).toEqual(['Khao Suey']);
  });

  it('a falsy/missing pkgName never throws and just applies the catalogue-level defaults', async () => {
    setDishMaster({ 'Paneer Tikka': { is_active: true } });
    const out = await filterAutoSeedable(['Paneer Tikka'], null);
    expect(out).toEqual(['Paneer Tikka']);
  });

  it('an empty/null/undefined dishNames list never throws and resolves to an empty array', async () => {
    expect(await filterAutoSeedable([], PKG_NAME)).toEqual([]);
    expect(await filterAutoSeedable(null, PKG_NAME)).toEqual([]);
    expect(await filterAutoSeedable(undefined, PKG_NAME)).toEqual([]);
  });
});

describe('loadPackageDefaultItems', () => {
  beforeEach(() => { dbCalls = []; });

  function row(name, extra) { return Object.assign({ dish_name: name, is_addon: false, ordering: 0 }, extra || {}); }

  it('is purely additive when every current selection is already in the default set (no removal, no DB delete call at all)', async () => {
    const dishItems = [row('Paneer Tikka')];
    const onOptimistic = vi.fn();
    const result = await loadPackageDefaultItems(ITEMS_CONFIG, dishItems, ['Paneer Tikka', 'Dal Makhani'], onOptimistic);
    expect(result.removed).toEqual([]);
    expect(result.added.map(a => a.dish_name)).toEqual(['Dal Makhani']);
    expect(dbCalls.some(c => c.op === 'delete')).toBe(false);
    const next = onOptimistic.mock.calls[0][0].map(x => x.dish_name);
    expect(next.sort()).toEqual(['Dal Makhani', 'Paneer Tikka']);
  });

  it('REMOVES a selected dish that is NOT in the new default set — a custom add-on', async () => {
    const dishItems = [row('Paneer Tikka'), row('Custom Add-on Dish', { is_addon: true })];
    const onOptimistic = vi.fn();
    const result = await loadPackageDefaultItems(ITEMS_CONFIG, dishItems, ['Paneer Tikka'], onOptimistic);
    expect(result.removed).toEqual(['Custom Add-on Dish']);
    expect(result.added).toEqual([]);
    const delCall = dbCalls.find(c => c.op === 'delete');
    expect(delCall.values).toEqual(['Custom Add-on Dish']);
    const next = onOptimistic.mock.calls[0][0].map(x => x.dish_name);
    expect(next).toEqual(['Paneer Tikka']);
  });

  it('REMOVES a package dish that was individually picked from a no-auto-select section, if it is no longer in the filtered default set', async () => {
    // Sweet Corn Soup is a real package dish (is_addon: false) but not part
    // of the auto-seedable default set passed in here — the whole point of
    // this reset: a manually-picked no-auto-select soup gets cleared too.
    const dishItems = [row('Paneer Tikka'), row('Sweet Corn Soup')];
    const result = await loadPackageDefaultItems(ITEMS_CONFIG, dishItems, ['Paneer Tikka'], vi.fn());
    expect(result.removed).toEqual(['Sweet Corn Soup']);
  });

  it('does both an add AND a remove in one call, and never touches a dish present in both the old selection and the new defaults', async () => {
    const dishItems = [row('Paneer Tikka'), row('Old Addon', { is_addon: true, ordering: 7 })];
    const onOptimistic = vi.fn();
    const result = await loadPackageDefaultItems(ITEMS_CONFIG, dishItems, ['Paneer Tikka', 'Dal Makhani'], onOptimistic);
    expect(result.removed).toEqual(['Old Addon']);
    expect(result.added.map(a => a.dish_name)).toEqual(['Dal Makhani']);
    const next = onOptimistic.mock.calls[0][0];
    const paneer = next.find(x => x.dish_name === 'Paneer Tikka');
    expect(paneer.ordering).toBe(0); // the ORIGINAL row object, untouched — not re-inserted
  });

  it('a menu that already exactly matches the default set does nothing at all — no delete, no insert, no onOptimistic call', async () => {
    const dishItems = [row('Paneer Tikka'), row('Dal Makhani')];
    const onOptimistic = vi.fn();
    const result = await loadPackageDefaultItems(ITEMS_CONFIG, dishItems, ['Paneer Tikka', 'Dal Makhani'], onOptimistic);
    expect(result).toEqual({ added: [], removed: [] });
    expect(dbCalls).toEqual([]);
    expect(onOptimistic).not.toHaveBeenCalled();
  });

  it('marks the parent row initialized after a change, via config.parentTable/initializedColumn', async () => {
    await loadPackageDefaultItems(ITEMS_CONFIG, [], ['Paneer Tikka'], vi.fn());
    const updateCall = dbCalls.find(c => c.op === 'update');
    expect(updateCall.table).toBe('events');
    expect(updateCall.fields).toEqual({ event_items_initialized: true });
    expect(updateCall.col).toBe('id');
    expect(updateCall.value).toBe('EVT-1');
  });
});

// Tests for the Dashboard.jsx package-switch reseed decision logic itself —
// see computePackageSwitchDiff's own header comment for the "old package
// stuff bleeding into the new package" bug this exists to close. A gap an
// adversarial review flagged: this logic previously lived inline inside
// Dashboard.jsx's syncEventItemsOnPackageChange with no test at all.
describe('computePackageSwitchDiff', () => {
  beforeEach(() => {
    setDishMaster({});
    delete MENU_PACKAGE_NO_AUTO_OVERRIDES[PKG_NAME];
    noAutoSectionIds = [];
  });

  function item(name, isAddon) { return { dish_name: name, is_addon: !!isAddon }; }

  it('THE BLEED BUG ITSELF: a dish common to the OLD and NEW package raw dish lists, but no-auto-select in the new package, is removed — not kept just because it shares a name with something the new package also lists', async () => {
    // Exercises the real filterAutoSeedable too, not just reasoned about —
    // "Sweet Corn Soup" is in both packages' raw lists (simulated by the
    // caller already knowing that; filterAutoSeedable only sees the NEW
    // package's own dish list + its own no_auto_select_overrides), but the
    // NEW package has it flagged "never auto-select here".
    setDishMaster({ 'Sweet Corn Soup': { is_active: true }, 'Paneer Tikka': { is_active: true } });
    MENU_PACKAGE_NO_AUTO_OVERRIDES[PKG_NAME] = { 'Sweet Corn Soup': true };
    const seedDishes = await filterAutoSeedable(['Sweet Corn Soup', 'Paneer Tikka'], PKG_NAME);
    expect(seedDishes).toEqual(['Paneer Tikka']); // confirms the premise: the new package's own filtered defaults exclude it

    const existing = [item('Sweet Corn Soup'), item('Paneer Tikka')]; // both package-sourced, both already selected from the OLD package
    const { toRemove, toAdd } = computePackageSwitchDiff(existing, seedDishes);
    expect(toRemove).toEqual(['Sweet Corn Soup']); // the bleed: removed, not kept
    expect(toAdd).toEqual([]); // Paneer Tikka already present, not re-added
  });

  it('a genuine custom add-on survives a package switch even though it is not in the new package default set at all', () => {
    const existing = [item('Paneer Tikka'), item('Chef Special Platter', true)];
    const { toRemove } = computePackageSwitchDiff(existing, ['Paneer Tikka']);
    expect(toRemove).toEqual([]); // the add-on is NOT removed
  });

  it('an add-on with is_addon null/undefined (a pre-column legacy row) is treated as package-sourced, NOT as a protected add-on', () => {
    const existing = [{ dish_name: 'Old Legacy Dish' }]; // is_addon entirely absent
    const { toRemove } = computePackageSwitchDiff(existing, ['Paneer Tikka']);
    expect(toRemove).toEqual(['Old Legacy Dish']);
  });

  it('adds a new package dish not yet present, and never re-adds (or duplicates) one already present as an add-on under the same name', () => {
    const existing = [item('Chef Special Platter', true)];
    const { toAdd } = computePackageSwitchDiff(existing, ['Chef Special Platter', 'Dal Makhani']);
    expect(toAdd).toEqual(['Dal Makhani']);
  });

  it('a menu that already exactly matches the new seed set does nothing', () => {
    const existing = [item('Paneer Tikka'), item('Dal Makhani')];
    const { toRemove, toAdd } = computePackageSwitchDiff(existing, ['Paneer Tikka', 'Dal Makhani']);
    expect(toRemove).toEqual([]);
    expect(toAdd).toEqual([]);
  });

  it('empty/null existingItems or seedDishes never throws', () => {
    expect(computePackageSwitchDiff([], [])).toEqual({ toRemove: [], toAdd: [] });
    expect(computePackageSwitchDiff(null, null)).toEqual({ toRemove: [], toAdd: [] });
    expect(computePackageSwitchDiff(undefined, undefined)).toEqual({ toRemove: [], toAdd: [] });
  });
});
