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
      bg: !!r.bg,
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
    dishMasterRaw,
    dishStoreMapRaw,
    teamDeptsRaw,
    teamSectionsRaw,
    salesConfigDefsRaw,
    salesConfigOptionsRaw,
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
    loadTable('dishes_master',         [], null),
    loadTable('dish_store_map',        [], null),
    loadTable('team_departments',      [], null),
    loadTable('team_sections',         [], null),
    loadTable('sales_config_defs',     [], null),
    loadTable('sales_config_options',  [], null),
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

  // Build dish master catalogue lookup
  const dishMaster = {};
  (dishMasterRaw || []).forEach(r => {
    if (r && r.dish_name) {
      dishMaster[r.dish_name] = {
        is_active:       r.is_active !== false,
        notes:           r.notes || '',
        image_url:       r.image_url || '',
        section_id:      r.section_id || null,
        sort_in_section: (r.sort_in_section == null ? null : r.sort_in_section),
        is_veg:          r.is_veg == null ? null : !!r.is_veg
      };
    }
  });

  // V62: Build dish → Ops store item lookup
  // V64: added ops_inventory_id (stable prefix key — CS-/FLO-/PRBR-) that survives Ops inventory rebuilds; ops_item_id kept for back-compat
  const dishStoreMap = {};
  (dishStoreMapRaw || []).forEach(r => {
    if (r && r.dish_name && r.ops_item_id) {
      dishStoreMap[r.dish_name] = {
        ops_item_id:      r.ops_item_id,
        ops_inventory_id: r.ops_inventory_id || null,
        ops_item_name:    r.ops_item_name || '',
        ops_item_hindi:   r.ops_item_hindi || '',
        ops_item_unit:    r.ops_item_unit || '',
        qty_per_cover:    Number(r.qty_per_cover) || 1
      };
    }
  });

  // V70 Phase 5B follow-up: nest sales_config_options under their defs, shape into DEPT_CONFIGS
  const salesConfigs = (function() {
    const byDept = {};
    (salesConfigDefsRaw || [])
      .filter(function(d){ return d.is_active !== false; })
      .sort(function(a,b){ return (a.ordering||0) - (b.ordering||0); })
      .forEach(function(def){
        if (!byDept[def.dept_id]) byDept[def.dept_id] = [];
        const cfg = { key: def.config_key, label: def.label, icon: def.icon || '', type: def.type };
        const opts = (salesConfigOptionsRaw || [])
          .filter(function(o){ return o.dept_id === def.dept_id && o.config_key === def.config_key && o.is_active !== false; })
          .sort(function(a,b){ return (a.ordering||0) - (b.ordering||0); });
        if (def.type === 'ratio') {
          cfg.allowExtras = !!def.allow_extras;
          cfg.ratios = opts.map(function(o){
            return { id: o.option_id, num: o.ratio_num, den: o.ratio_den, label: o.ratio_label || o.name };
          });
        } else if (def.type === 'count') {
          cfg.min  = def.min_val != null ? def.min_val : 0;
          cfg.max  = def.max_val != null ? def.max_val : 999;
          cfg.step = def.step_val || 1;
        } else {
          // options, radio, multi_count, tags
          cfg.options = opts.map(function(o){
            return { id: o.option_id, name: o.name, desc: o.description || '', icon: o.icon || '' };
          });
        }
        byDept[def.dept_id].push(cfg);
      });
    return byDept;
  })();

  return {
    vehicles,
    coldItems,
    salesConfigs,
    menuPackages:       transformMenuPackages(menuPackagesRaw),
    menuPackageNames:   Object.keys(transformMenuPackages(menuPackagesRaw)),
    dishGroups:         (function() { var g = {}; (menuPackagesRaw||[]).filter(function(r){return r.is_active!==false;}).forEach(function(r){ g[r.name] = typeof r.dish_groups === 'string' ? JSON.parse(r.dish_groups||'{}') : (r.dish_groups||{}); }); return g; })(),
    menuSections:       (function() { var s = {}; (menuPackagesRaw||[]).filter(function(r){return r.is_active!==false;}).forEach(function(r){ var raw = r.sections; if (raw == null) return; try { s[r.name] = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) { console.warn('[menu_packages] sections parse failed for', r.name, e); } }); return s; })(),
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
    dishMaster,
    dishStoreMap,
    teamDepts,
  };
}
