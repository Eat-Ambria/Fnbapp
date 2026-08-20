// Ambria FnB — Menu Packages
// ALL MENU PACKAGE DATA NOW LIVES IN SUPABASE — this file provides empty shell + hydration

// ─── AMBRIA MENU PACKAGES ─────────────────────────────────────────
// Hydrated from Supabase `menu_packages` table on boot via hydrateMenuPackages()
let MENU_PACKAGES = {};

let MENU_PACKAGE_NAMES = [];
let DISH_GROUPS = {};

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

export { MENU_PACKAGES, MENU_PACKAGE_NAMES, DISH_GROUPS, MENU_PACKAGE_META, hydrateMenuPackages };