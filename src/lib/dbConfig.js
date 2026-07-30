/**
 * AMBRIA FnB — Config Data Loader
 * 
 * Loads all previously-hardcoded data from Supabase tables.
 * Uses localStorage cache as offline fallback.
 * 
 * Place in: src/lib/dbConfig.js
 * 
 * Usage in App.jsx:
 *   import { loadAllConfig } from './lib/dbConfig.js';
 *   
 *   // Inside boot useEffect:
 *   const config = await loadAllConfig();
 *   setVehicles(config.vehicles);
 *   setColdItems(config.coldItems);
 *   setMenuPackages(config.menuPackages);
 *   setVendorList(config.vendors);
 *   setRecipeCategories(config.recipeCategories);
 *   setRecipes(config.recipes);
 *   setRecipeIngredients(config.recipeIngredients);
 *   setChecklists(config.checklists);
 *   setAllocRules(config.allocRules);
 *   setVendorCategories(config.vendorCategories);
 */

import { supabase } from './supabase.js';

// ── Generic loader with localStorage fallback ──
async function loadTable(table, fallback = [], transform = null) {
  const cacheKey = 'ambria_cfg_' + table;

  if (!supabase) {
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : fallback;
    } catch { return fallback; }
  }

  try {
    const { data, error } = await supabase.from(table).select('*');
    if (error || !data || data.length === 0) throw new Error(error?.message || 'empty');
    const result = transform ? transform(data) : data;
    try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch {}
    return result;
  } catch {
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : fallback;
    } catch { return fallback; }
  }
}

// ── Transform Supabase rows back to the shape components expect ──

function transformVehicles(rows) {
  // Components expect: {id, name, icon, type, note}
  return rows.filter(r => r.is_active !== false);
}

function transformColdItems(rows) {
  // Components expect: string[] of item names
  return rows.map(r => r.item_name);
}

function transformMenuPackages(rows) {
  // Components expect: { "Multi-Cuisine Veg": ["dish1","dish2",...], ... }
  const pkg = {};
  rows.filter(r => r.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .forEach(r => {
        pkg[r.name] = typeof r.dishes === 'string' ? JSON.parse(r.dishes) : r.dishes;
      });
  return pkg;
}

function transformVendors(rows) {
  // Components expect same shape — rows already match
  return rows.filter(r => r.is_active !== false);
}

function transformRecipeCategories(rows) {
  // Components expect: [{id, name, icon, count}]
  return rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function transformRecipes(rows) {
  // Components expect RECIPE_DB shape:
  //   { cats: [...], recipes: { halwai: [{n, sub, steps}], ... } }
  // We rebuild this from flat rows + recipe_categories
  const byCat = {};
  rows.forEach(r => {
    if (!byCat[r.category_id]) byCat[r.category_id] = [];
    byCat[r.category_id].push({
      id: r.id,
      n: r.dish_name,
      n_hi: r.dish_name_hi || '',
      sub: r.sub || '',
      steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
      ingredients: r.ingredients && typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : (r.ingredients || null),
      yield: r.yield && typeof r.yield === 'string' ? JSON.parse(r.yield) : (r.yield || null),
    });
  });
  return byCat;
}

function transformRecipeIngredients(rows) {
  // Components expect: { "Paneer Tikka": [{n, h, q, u}], ... }
  const byDish = {};
  rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .forEach(r => {
        if (!byDish[r.dish_name]) byDish[r.dish_name] = [];
        byDish[r.dish_name].push({
          n: r.name,
          h: r.hindi_name || '',
          q: parseFloat(r.qty) || 0,
          u: r.unit || '',
        });
      });
  return byDish;
}

function transformChecklists(rows) {
  // Group by type: { service: [...], grooming: [...], repair_category: [...], ... }
  const grouped = {};
  rows.filter(r => r.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .forEach(r => {
        if (!grouped[r.type]) grouped[r.type] = [];
        grouped[r.type].push(r);
      });
  return grouped;
}

function transformAllocRules(rows) {
  // Components expect: { "Magnum Veg": {ref:[...], per100, per50}, ... }
  const rules = {};
  rows.forEach(r => {
    const refData = typeof r.ref_data === 'string' ? JSON.parse(r.ref_data) : r.ref_data;
    rules[r.menu_package] = {
      ref: refData,
      per100: r.per_100,
      per50: r.per_50,
    };
  });
  return rules;
}

function transformVendorCategories(rows) {
  // Components expect: string[]
  return rows.filter(r => r.is_active !== false)
             .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
             .map(r => r.name);
}

// ── Master loader — call once on boot ──
export async function loadAllConfig() {
  const [
    vehicles,
    coldItems,
    menuPackagesRaw,
    vendors,
    recipeCategories,
    recipesRaw,
    recipeIngredientsRaw,
    checklistsRaw,
    allocRulesRaw,
    vendorCategoriesRaw,
    dishCategoriesRaw,
    dishNameMapRaw,
    dishHindiMapRaw,
    teamDeptsRaw,
    teamSectionsRaw,
  ] = await Promise.all([
    loadTable('vehicles',              [], transformVehicles),
    loadTable('cold_chain_items',      [], transformColdItems),
    loadTable('menu_packages',         [], null),
    loadTable('vendors',               [], transformVendors),
    loadTable('recipe_categories',     [], transformRecipeCategories),
    loadTable('recipes',               [], null),
    loadTable('recipe_ingredients',    [], null),
    loadTable('checklists',            [], null),
    loadTable('staff_allocation_rules',[], null),
    loadTable('vendor_categories',     [], null),
    loadTable('dish_categories',       [], null),
    loadTable('dish_name_map',         [], null),
    loadTable('dish_hindi_map',        [], null),
    loadTable('team_departments',      [], null),
    loadTable('team_sections',         [], null),
  ]);

  // Join team_departments + team_sections into [{id,label,icon,sections:[names]}]
  const teamDepts = (teamDeptsRaw || [])
    .filter(d => d.is_active !== false)
    .sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
    .map(d => ({
      id: d.id, label: d.label, icon: d.icon,
      sections: (teamSectionsRaw || [])
        .filter(s => s.dept_id === d.id && s.is_active !== false)
        .sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
        .map(s => s.name)
    }));


  // Build dish→category lookup from dish_categories table
  const dishCatMap = {};
  (dishCategoriesRaw || []).forEach(r => { dishCatMap[r.dish_name] = r.category_id; });

  // Build LMS name → SOP recipe name lookup
  const dishNameMap = {};
  (dishNameMapRaw || []).forEach(r => { dishNameMap[r.lms_name] = r.recipe_dish_name; });

  // Build dish → Hindi override lookup (Menu Packages)
  const dishHindiMap = {};
  (dishHindiMapRaw || []).forEach(r => { if (r.dish_name && r.hi) dishHindiMap[r.dish_name] = r.hi; });

  return {
    vehicles,
    coldItems,
    menuPackages:       transformMenuPackages(menuPackagesRaw),
    menuPackageNames:   Object.keys(transformMenuPackages(menuPackagesRaw)),
    dishGroups:         (function() { var g = {}; (menuPackagesRaw||[]).filter(function(r){return r.is_active!==false;}).forEach(function(r){ g[r.name] = typeof r.dish_groups === 'string' ? JSON.parse(r.dish_groups||'{}') : (r.dish_groups||{}); }); return g; })(),
    vendors,
    recipeCategories,
    recipes:            transformRecipes(recipesRaw),
    recipeIngredients:  transformRecipeIngredients(recipeIngredientsRaw),
    checklists:         transformChecklists(checklistsRaw),
    allocRules:         transformAllocRules(allocRulesRaw),
    vendorCategories:   transformVendorCategories(vendorCategoriesRaw),
    dishCategories:     dishCatMap,
    dishNameMap,
    dishHindiMap,
    teamDepts,
  };
}
