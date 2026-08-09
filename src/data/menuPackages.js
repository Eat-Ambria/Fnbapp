// Ambria FnB — Menu Packages
// ALL MENU PACKAGE DATA NOW LIVES IN SUPABASE — this file provides empty shell + hydration

// ─── AMBRIA MENU PACKAGES ─────────────────────────────────────────
// Hydrated from Supabase `menu_packages` table on boot via hydrateMenuPackages()
let MENU_PACKAGES = {};

let MENU_PACKAGE_NAMES = [];
let DISH_GROUPS = {};

// V63: structured sections per package, hydrated from menu_packages.sections column
// Shape: { "Pearl Veg": [{ id, name, sop_category, dishes: ["Dish A", ...] }, ...] }
// null / missing → package uses legacy flat dishes[]; sections auto-derive from getSectionForDish at render time
let MENU_PACKAGE_SECTIONS = {};

function hydrateMenuPackages(pkgMap, groups, sections) {
  if (pkgMap && typeof pkgMap === 'object' && Object.keys(pkgMap).length > 0) {
    Object.keys(MENU_PACKAGES).forEach(k => delete MENU_PACKAGES[k]);
    Object.assign(MENU_PACKAGES, pkgMap);
    MENU_PACKAGE_NAMES = Object.keys(MENU_PACKAGES);
  }
  if (groups && typeof groups === 'object') {
    Object.keys(DISH_GROUPS).forEach(k => delete DISH_GROUPS[k]);
    Object.assign(DISH_GROUPS, groups);
  }
  if (sections && typeof sections === 'object') {
    Object.keys(MENU_PACKAGE_SECTIONS).forEach(k => delete MENU_PACKAGE_SECTIONS[k]);
    Object.assign(MENU_PACKAGE_SECTIONS, sections);
  }
}

export { MENU_PACKAGES, MENU_PACKAGE_NAMES, DISH_GROUPS, MENU_PACKAGE_SECTIONS, hydrateMenuPackages };
