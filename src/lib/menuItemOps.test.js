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
      };
    },
  },
}));

const { filterAutoSeedable } = await import('./menuItemOps.js');

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
