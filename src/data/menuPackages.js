// Ambria FnB — Menu Packages
// ALL MENU PACKAGE DATA NOW LIVES IN SUPABASE — this file provides empty shell + hydration
import { supabase } from '../lib/supabase.js';

// ─── AMBRIA MENU PACKAGES ─────────────────────────────────────────
// Hydrated from Supabase `menu_packages` table on boot via hydrateMenuPackages()
let MENU_PACKAGES = {};

let MENU_PACKAGE_NAMES = [];
let DISH_GROUPS = {};

// V74 — Section overlay is the primary source of section structure for
// package editing (id, name, sop_category, ordered dishes). Hydrated on boot
// via hydrateMenuPackageSections from menu_packages.sections JSONB column, and
// kept fresh mid-session by setPackageSections after per-package saves and by
// refreshMenuPackages after any package write. Before V74 this map was empty
// on boot, so getSectionsForPackage silently fell back to synthesizing sections
// from the flat dishes[] — which erased empty sections and any custom naming
// or ordering on refresh.
let MENU_PACKAGE_SECTIONS = {};

// V70: side-channel for package metadata beyond dishes[]
// Shape: { [pkgName]: { tier: 'luxury'|'magnum'|null, id: string|null } }
let MENU_PACKAGE_META = {};

function hydrateMenuPackages(pkgMap, groups, meta) {
  if (pkgMap && typeof pkgMap === 'object' && Object.keys(pkgMap).length > 0) {
    Object.keys(MENU_PACKAGES).forEach(k => delete MENU_PACKAGES[k]);
    Object.assign(MENU_PACKAGES, pkgMap);
    MENU_PACKAGE_NAMES = Object.keys(MENU_PACKAGES);
  }
  if (groups && typeof groups === 'object') {
    Object.keys(DISH_GROUPS).forEach(k => delete DISH_GROUPS[k]);
    Object.assign(DISH_GROUPS, groups);
  }
  if (meta && typeof meta === 'object') {
    Object.keys(MENU_PACKAGE_META).forEach(k => delete MENU_PACKAGE_META[k]);
    Object.assign(MENU_PACKAGE_META, meta);
  }
}

// V74 — Populate MENU_PACKAGE_SECTIONS from a { [pkgName]: sectionsArray } map.
// Overwrites the entire map (last write wins).
function hydrateMenuPackageSections(sectionsMap) {
  if (!sectionsMap || typeof sectionsMap !== 'object') return;
  Object.keys(MENU_PACKAGE_SECTIONS).forEach(k => delete MENU_PACKAGE_SECTIONS[k]);
  Object.assign(MENU_PACKAGE_SECTIONS, sectionsMap);
}

// V74 — Re-fetch menu_packages from Supabase and re-hydrate the in-memory maps
// including the sections overlay. Fires 'ambria:menu-packages-refreshed' on
// window so React consumers can re-render. Safe to call after any menu_packages
// write (save/create/duplicate/delete/CSV import).
async function refreshMenuPackages() {
  try {
    const res = await supabase.from('menu_packages').select('*');
    if (res.error) { console.warn('[menuPackages] refresh failed:', res.error); return false; }
    const rows = (res.data || []).filter(r => r.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const pkgMap = {};
    const groups = {};
    const meta   = {};
    const sections = {};
    rows.forEach(r => {
      pkgMap[r.name] = typeof r.dishes === 'string' ? JSON.parse(r.dishes || '[]') : (r.dishes || []);
      groups[r.name] = typeof r.dish_groups === 'string' ? JSON.parse(r.dish_groups || '{}') : (r.dish_groups || {});
      meta[r.name]   = { tier: r.tier || null, id: r.id || null };
      if (r.sections != null) {
        try {
          sections[r.name] = typeof r.sections === 'string' ? JSON.parse(r.sections) : r.sections;
        } catch(e) { console.warn('[menuPackages] sections parse failed for', r.name, e); }
      }
    });
    hydrateMenuPackages(pkgMap, groups, meta);
    hydrateMenuPackageSections(sections);
    try { window.dispatchEvent(new Event('ambria:menu-packages-refreshed')); } catch(e) {}
    return true;
  } catch (e) {
    console.warn('[menuPackages] refresh err:', e);
    return false;
  }
}

export {
  MENU_PACKAGES,
  MENU_PACKAGE_NAMES,
  DISH_GROUPS,
  MENU_PACKAGE_SECTIONS,
  MENU_PACKAGE_META,
  hydrateMenuPackages,
  hydrateMenuPackageSections,
  refreshMenuPackages
};