// Ambria FnB — Menu Packages
// ALL MENU PACKAGE DATA NOW LIVES IN SUPABASE — this file provides empty shell + hydration

// ─── AMBRIA MENU PACKAGES ─────────────────────────────────────────
// Hydrated from Supabase `menu_packages` table on boot via hydrateMenuPackages()
let MENU_PACKAGES = {};

let MENU_PACKAGE_NAMES = [];
let DISH_GROUPS = {};

// Legacy section overlay — kept for backward compatibility with recipeData.js and
// MenuPackagesView.jsx delete operations. Not actively populated in the current
// data pipeline; the sections JSONB lives on menu_packages rows and is loaded via
// getSectionsForPackage() in recipeData.js. Do NOT remove this export without
// first grepping the codebase for MENU_PACKAGE_SECTIONS references.
let MENU_PACKAGE_SECTIONS = {};

function hydrateMenuPackages(pkgMap, groups) {
  if (pkgMap && typeof pkgMap === 'object' && Object.keys(pkgMap).length > 0) {
    Object.keys(MENU_PACKAGES).forEach(k => delete MENU_PACKAGES[k]);
    Object.assign(MENU_PACKAGES, pkgMap);
    MENU_PACKAGE_NAMES = Object.keys(MENU_PACKAGES);
  }
  if (groups && typeof groups === 'object') {
    Object.keys(DISH_GROUPS).forEach(k => delete DISH_GROUPS[k]);
    Object.assign(DISH_GROUPS, groups);
  }
}

export { MENU_PACKAGES, MENU_PACKAGE_NAMES, DISH_GROUPS, MENU_PACKAGE_SECTIONS, hydrateMenuPackages };