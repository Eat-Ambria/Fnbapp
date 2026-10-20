// Ambria FnB — Simplified RBAC permissions
// Role hierarchy: Chef → Head Chef → Manager → Admin
// Each role auto-gets tab access + action permissions
// Custom overrides: toggle individual screens on/off per user

// ── SCREEN DEFINITIONS — the ONE registry of every tab in the app ──
// What a screen is CALLED, drawn and grouped (label/icon/group/order) is now
// DB-backed — editable from Access Manager's "Manage Screens", same pattern
// as role_definitions/PRESET_ROLES below. SCREEN_PERMISSIONS_DEFAULT is only
// the fallback (used before Supabase answers, or if it's unreachable); the
// live SCREEN_PERMISSIONS + NAV_ITEMS are rebuilt from it by
// hydrateScreenDefinitions() every time the screen_definitions table
// changes. What CANNOT move to the DB is each screen's `perms` list — those
// are fine-grained actions wired into that screen's actual component code,
// not something a generic admin screen can safely invent — so `perms`
// always comes from this fallback object, label/icon/group/order/hidden
// never do once hydration has run.
const SCREEN_PERMISSIONS_DEFAULT = {
  dashboard:      {label:"Dashboard",           icon:"📊", perms:[{id:"dashboard.view",type:"view",label:"View dashboard KPIs"},{id:"dashboard.closure_report",type:"action",label:"Generate closure report"},{id:"dashboard.export",type:"action",label:"Export reports"}]},
  kitchen:        {label:"Kitchen Hub",         icon:"👨‍🍳", perms:[{id:"kitchen.view",type:"view",label:"View today's tasks"},{id:"kitchen.d1_view",type:"view",label:"View D-1 prep"},{id:"kitchen.d1_mark_done",type:"action",label:"Mark prep done"},{id:"kitchen.mark_ready",type:"action",label:"Mark dish ready"},{id:"kitchen.start_timer",type:"action",label:"Start/stop timers"},{id:"kitchen.store_collect",type:"action",label:"Collect from store"},{id:"kitchen.quality_rate",type:"action",label:"Rate ingredient quality"},{id:"kitchen.scaling_view",type:"view",label:"View pax scaling"},{id:"kitchen.scaling_apply",type:"action",label:"Apply scaling"},{id:"kitchen.sops_view",type:"view",label:"View recipe SOPs"},{id:"kitchen.menu_view",type:"view",label:"View menu packages"},{id:"kitchen.planning_view",type:"view",label:"View Planning tab"},{id:"kitchen.analytics_view",type:"view",label:"View Analytics tab"}],
                  // Sub-tabs inside Kitchen Hub a section tablet doesn't get by
                  // default (see isSectionUser in KitchenHub.jsx) but can be
                  // granted individually — exposed as their own toggles in
                  // Access Manager instead of bundled into the one Kitchen Hub
                  // on/off switch above.
                  subTabs:["kitchen.planning_view","kitchen.analytics_view"]},
  menus:          {label:"Menu Packages",       icon:"📜", perms:[{id:"menus.view",type:"view",label:"View menus"}]},
  transport:      {label:"Transport",           icon:"🚛", group:"OPERATIONS", perms:[{id:"transport.view",type:"view",label:"View dispatch"},{id:"transport.dispatch",type:"action",label:"Mark dispatch"},{id:"transport.temp_log",type:"action",label:"Log fridge temp"},{id:"transport.loading_check",type:"action",label:"Loading checklist"}]},
  store:          {label:"Store & Inventory",   icon:"📦", group:"OPERATIONS", perms:[{id:"store.view",type:"view",label:"View inventory"},{id:"store.issue",type:"action",label:"Issue items"},{id:"store.receive",type:"action",label:"Receive items"},{id:"store.barcode_scan",type:"action",label:"Scan barcodes"},{id:"store.smart_issue",type:"action",label:"Smart issue"},{id:"store.edit_stock",type:"action",label:"Edit stock levels"}]},
  dept_service:   {label:"Service Ops",         icon:"🍽", group:"OPERATIONS", perms:[{id:"dept_service.view",type:"view",label:"View service"},{id:"dept_service.check",type:"action",label:"Complete checklist"}]},
  dept_crockery:  {label:"Crockery Ops",        icon:"🍶", group:"OPERATIONS", perms:[{id:"dept_crockery.view",type:"view",label:"View crockery"},{id:"dept_crockery.check",type:"action",label:"Complete checklist"}]},
  dept_beverages: {label:"Beverages Ops",       icon:"🥤", group:"OPERATIONS", perms:[{id:"dept_beverages.view",type:"view",label:"View beverages"},{id:"dept_beverages.check",type:"action",label:"Complete checklist"}]},
  dept_fruits:    {label:"Fruits Ops",          icon:"🍓", group:"OPERATIONS", perms:[{id:"dept_fruits.view",type:"view",label:"View fruits"},{id:"dept_fruits.check",type:"action",label:"Complete checklist"}]},
  dept_odc:       {label:"ODC Operations",      icon:"🏕", group:"OPERATIONS", perms:[{id:"dept_odc.view",type:"view",label:"View ODC"},{id:"dept_odc.check",type:"action",label:"Complete checklist"}]},
  proposals:        {label:"Proposals",           icon:"📝", group:"SALES", perms:[{id:"proposals.view",type:"view",label:"View proposals"},{id:"proposals.create",type:"action",label:"Create proposal"},{id:"proposals.edit",type:"action",label:"Edit own proposals"},{id:"proposals.delete",type:"action",label:"Delete own proposals"},{id:"proposals.view_all",type:"action",label:"View all reps' proposals"},{id:"proposals.convert",type:"action",label:"Convert won to booking"}]},
  sales_catalogue:  {label:"Sales Catalogue",     icon:"🏷️", group:"SALES", perms:[{id:"sales_catalogue.view",type:"view",label:"View sales catalogue"},{id:"sales_catalogue.edit",type:"action",label:"Edit item meta/images"}]},
  booked_functions: {label:"Booked Functions",    icon:"📅", group:"SALES", perms:[{id:"booked_functions.view",type:"view",label:"View booked functions"},{id:"booked_functions.edit_menu",type:"action",label:"Edit menu/service items"}]},
  team:           {label:"Team",                icon:"👥", group:"MANAGEMENT", perms:[{id:"team.view",type:"view",label:"View staff list"}]},
  access:         {label:"Access Manager",      icon:"🔐", group:"MANAGEMENT", perms:[{id:"access.view",type:"view",label:"View staff list"},{id:"access.add",type:"action",label:"Add staff"},{id:"access.edit",type:"action",label:"Edit staff"},{id:"access.delete",type:"action",label:"Delete staff"},{id:"access.perms",type:"action",label:"Change permissions"},{id:"access.bulk_ops",type:"action",label:"Bulk operations"}]},
  logs:           {label:"Activity Log",        icon:"📋", group:"MANAGEMENT", perms:[{id:"logs.view",type:"view",label:"View activity log"}]},
};

// Live, mutated in place (same reasoning as PRESET_ROLES below) so every
// `import { SCREEN_PERMISSIONS }` binding keeps seeing hydrateScreenDefinitions()'s edits.
const SCREEN_PERMISSIONS = { ...SCREEN_PERMISSIONS_DEFAULT };

// The sidebar's flat nav array (real screens + divider markers). A `let`,
// not a `const` — hydrateScreenDefinitions() reassigns it whenever
// screen_definitions changes, and every importer reads the live binding.
let NAV_ITEMS = [];

function buildNavItems() {
  const out = [];
  let lastGroup;
  Object.keys(SCREEN_PERMISSIONS).forEach(id => {
    const sp = SCREEN_PERMISSIONS[id];
    if (sp.hidden) return;
    if (sp.group !== lastGroup) { if (sp.group) out.push({ id: "_div_" + sp.group, label: sp.group, divider: true }); lastGroup = sp.group; }
    out.push({ id, label: sp.label });
  });
  return out;
}

// Rebuilds SCREEN_PERMISSIONS (label/icon/group/order/hidden only — `perms`
// always comes from the fallback, see the comment above) from
// SCREEN_PERMISSIONS_DEFAULT + whatever's in the `screen_definitions` table,
// then rebuilds NAV_ITEMS from the result. DB rows always win on order too:
// hydrated screens are walked in the table's own sort_order, with any
// fallback-only key (a screen added in code but never seeded to the table
// yet) appended after, in its default position, so a new screen never goes
// missing just because nobody has saved Manage Screens since it shipped.
function hydrateScreenDefinitions(screenDefRows) {
  Object.keys(SCREEN_PERMISSIONS).forEach(k => delete SCREEN_PERMISSIONS[k]);
  Object.keys(SCREEN_PERMISSIONS_DEFAULT).forEach(k => { SCREEN_PERMISSIONS[k] = { ...SCREEN_PERMISSIONS_DEFAULT[k] }; });
  const rows = Array.isArray(screenDefRows) ? screenDefRows : [];
  const known = rows.filter(r => r && r.screen_key && SCREEN_PERMISSIONS_DEFAULT[r.screen_key])
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const seen = new Set();
  known.forEach(r => {
    const k = r.screen_key;
    seen.add(k);
    SCREEN_PERMISSIONS[k] = {
      ...SCREEN_PERMISSIONS[k],
      label: r.label || SCREEN_PERMISSIONS[k].label,
      icon: r.icon || SCREEN_PERMISSIONS[k].icon,
      group: r.group_name || undefined,
      hidden: !!r.is_hidden,
    };
  });
  // Reorder SCREEN_PERMISSIONS's own key order to match (object key order is
  // what buildNavItems() walks) — known keys first in their saved order,
  // then any default-only key never seeded to the table yet.
  const ordered = {};
  known.forEach(r => { ordered[r.screen_key] = SCREEN_PERMISSIONS[r.screen_key]; });
  Object.keys(SCREEN_PERMISSIONS_DEFAULT).forEach(k => { if (!seen.has(k)) ordered[k] = SCREEN_PERMISSIONS[k]; });
  Object.keys(SCREEN_PERMISSIONS).forEach(k => delete SCREEN_PERMISSIONS[k]);
  Object.assign(SCREEN_PERMISSIONS, ordered);
  NAV_ITEMS = buildNavItems();
}
hydrateScreenDefinitions([]); // seed NAV_ITEMS from the fallback before the first real hydrate call lands

// Optimistic in-memory update right after a successful Supabase write, so
// Access Manager doesn't need a full reload to see its own change reflected
// everywhere (nav, canAccessScreen, etc.) in the same session — mirrors
// setRoleDefinition/deleteRoleDefinition below, just re-running the full
// hydrate since order/grouping can shift from a single row's edit.
function setScreenDefinitions(rows) { hydrateScreenDefinitions(rows); }

// ── ROLE HIERARCHY ──
// Defines: which screens each role can see, and which elevated actions they get
// Tab access = auto-gets ALL permissions for that screen
// Elevated actions = specific action-level perms that only certain roles have (across any screen they access)
//
// V93 — this used to be the only source of truth; it's now just the FALLBACK
// (used before Supabase answers, or if it's unreachable), same pattern as
// EMPLOYEE_DB_INIT/TEAM_DEPTS elsewhere. The live source of truth is the
// `role_definitions` table, seeded from exactly this object — Access
// Manager's "Manage Roles" screen reads/writes that table and calls
// hydratePermissions()/setRoleDefinition()/deleteRoleDefinition() below to
// keep this in-memory object in sync without a reload.
const PRESET_ROLES_DEFAULT = {
  admin: {
    label: "Admin — Full Access",
    icon: "👑",
    tier: 4,
    screens: ["dashboard","kitchen","store","team","transport","menus","access","dept_service","dept_crockery","dept_beverages","dept_fruits","dept_odc","proposals","sales_catalogue","booked_functions"],
    elevated: [],
  },
  head_chef: {
    label: "Head Chef",
    icon: "👨‍🍳",
    tier: 3,
    screens: ["dashboard","kitchen","menus","store","team","transport"],
    elevated: ["kitchen.scaling_apply"],
  },
  service: {
    label: "Service Dept",
    icon: "🍽",
    tier: 2,
    screens: ["dashboard","dept_service","team"],
    elevated: [],
  },
  crockery: {
    label: "Crockery Dept",
    icon: "🍶",
    tier: 2,
    screens: ["dashboard","dept_crockery","team","store"],
    elevated: [],
  },
  beverages: {
    label: "Beverages Dept",
    icon: "🥤",
    tier: 2,
    screens: ["dashboard","dept_beverages","menus","team","store"],
    elevated: [],
  },
  fruits: {
    label: "Fruits Dept",
    icon: "🍓",
    tier: 2,
    screens: ["dashboard","dept_fruits","menus","team","store"],
    elevated: [],
  },
  transport: {
    label: "Transport",
    icon: "🚛",
    tier: 2,
    screens: ["dashboard","transport"],
    elevated: [],
  },
  section_tablet:      {label:"Section Tablet",       icon:"📱", tier:1, screens:["kitchen"], elevated:[]},
  section_indian:      {label:"Indian Section",       icon:"📱", tier:1, screens:["kitchen"], elevated:[]},
  section_chinese:     {label:"Chinese Section",      icon:"📱", tier:1, screens:["kitchen"], elevated:[]},
  section_tandoor:     {label:"Tandoor Section",      icon:"📱", tier:1, screens:["kitchen"], elevated:[]},
  section_chaat:       {label:"Chaat Section",        icon:"📱", tier:1, screens:["kitchen"], elevated:[]},
  section_sweets:      {label:"Sweets Section",       icon:"📱", tier:1, screens:["kitchen"], elevated:[]},
  section_continental: {label:"Continental Section",  icon:"📱", tier:1, screens:["kitchen"], elevated:[]},
  section_bakery:      {label:"Bakery Section",       icon:"📱", tier:1, screens:["kitchen"], elevated:[]},
  staff:               {label:"Staff",                icon:"👤", tier:1, screens:["dashboard","kitchen"], elevated:[]},
  sales:               {label:"Sales Rep",            icon:"📈", tier:2, screens:["dashboard","proposals","booked_functions"], elevated:["proposals.create","proposals.edit","proposals.delete","booked_functions.edit_menu"]},
  sales_manager:       {label:"Sales Manager",        icon:"📊", tier:3, screens:["dashboard","proposals","booked_functions","sales_catalogue","menus"], elevated:["proposals.create","proposals.edit","proposals.delete","proposals.view_all","proposals.convert","sales_catalogue.edit","booked_functions.edit_menu"]},
};

// Mutated in place (push/delete-style, like ALL_DEPARTMENTS/VENUE_OPTIONS in
// constants.js) rather than reassigned, so every other module's
// `import { PRESET_ROLES }` binding keeps seeing live edits.
const PRESET_ROLES = { ...PRESET_ROLES_DEFAULT };

// Rebuilds PRESET_ROLES from the hardcoded fallback + whatever's in the
// `role_definitions` table (DB rows always win over the fallback — a role
// edited or deleted in Access Manager must not reappear in its old shape
// just because the fallback still has it).
function hydratePermissions(roleDefRows) {
  Object.keys(PRESET_ROLES).forEach(k => delete PRESET_ROLES[k]);
  Object.assign(PRESET_ROLES, PRESET_ROLES_DEFAULT);
  if (!Array.isArray(roleDefRows)) return;
  roleDefRows.forEach(r => {
    if (!r || !r.role_key) return;
    PRESET_ROLES[r.role_key] = {
      label: r.label || r.role_key,
      icon: r.icon || null,
      tier: r.tier != null ? r.tier : 2,
      screens: Array.isArray(r.screens) ? r.screens : [],
      elevated: Array.isArray(r.elevated) ? r.elevated : [],
      isBuiltin: !!r.is_builtin,
    };
  });
}

// Optimistic in-memory update right after a successful Supabase write, so
// Access Manager doesn't need a full reload to see its own change reflected
// everywhere (dropdowns, canAccessScreen, etc.) in the same session.
function setRoleDefinition(roleKey, def) { PRESET_ROLES[roleKey] = def; }
function deleteRoleDefinition(roleKey) { delete PRESET_ROLES[roleKey]; }

// ── CORE FUNCTIONS ──

// Get the flat list of permission IDs a staff member effectively has
function getEffectivePerms(staff) {
  if (!staff) return [];

  // 1. Explicit permission array overrides everything (set via Access Manager)
  if (staff.permissions && staff.permissions.length > 0) return staff.permissions;

  // 2. Custom screen list (legacy — derive all perms for those screens)
  if (staff.custom_screens && staff.custom_screens.length > 0) {
    const perms = [];
    staff.custom_screens.forEach(sid => {
      const sp = SCREEN_PERMISSIONS[sid];
      if (sp) sp.perms.forEach(p => perms.push(p.id));
    });
    return perms.length > 0 ? perms : staff.custom_screens;
  }

  // 3. Role-based: all perms for allowed screens + elevated actions
  const role = staff.role || "staff";
  if (role === "admin") return Object.values(SCREEN_PERMISSIONS).flatMap(s => s.perms.map(p => p.id));

  const pr = PRESET_ROLES[role] || PRESET_ROLES.staff;
  const perms = [];
  pr.screens.forEach(sid => {
    const sp = SCREEN_PERMISSIONS[sid];
    if (sp) sp.perms.forEach(p => perms.push(p.id));
  });
  // Add elevated actions (these might be for screens not in the base list, or specific overrides)
  if (pr.elevated) pr.elevated.forEach(pid => { if (!perms.includes(pid)) perms.push(pid); });
  return perms;
}

// Check a single permission
function hasPermission(staff, permId) {
  if (!staff) return true; // no auth = allow (pre-login state)
  if (staff.role === "admin") return true;
  return getEffectivePerms(staff).includes(permId);
}

const hasPerm = hasPermission;

// Check if user can see a screen/tab
function canAccessScreen(user, screenId) {
  if (!user) return false;
  if (user.role === "admin") return true;

  // A screen an admin has hidden via Manage Screens is off for everyone else,
  // no matter what's otherwise granted — checked AFTER the admin bypass above,
  // so hiding a screen (even "access" itself) can never lock an admin out of
  // undoing it.
  const hiddenSp = SCREEN_PERMISSIONS[screenId];
  if (hiddenSp && hiddenSp.hidden) return false;

  // 1. Explicit permission array — check if ANY perm for that screen is enabled
  if (user.permissions && user.permissions.length > 0) {
    const sp = SCREEN_PERMISSIONS[screenId];
    if (!sp) return true; // unknown screen = allow
    return sp.perms.some(p => user.permissions.includes(p.id));
  }

  // 2. Custom screen whitelist (legacy)
  if (user.custom_screens && user.custom_screens.length > 0) {
    return user.custom_screens.includes(screenId);
  }

  // 3. Role-based
  const pr = PRESET_ROLES[user.role || "staff"] || PRESET_ROLES.staff;
  return pr.screens.includes(screenId);
}

// ── HELPER: Get screens list for a role (used by Access Manager UI) ──
function getScreensForRole(roleKey) {
  if (roleKey === "admin") return Object.keys(SCREEN_PERMISSIONS);
  const pr = PRESET_ROLES[roleKey] || PRESET_ROLES.staff;
  return pr.screens || [];
}

// ── HELPER: Build permissions array from a screen list (for saving) ──
// Excludes a screen's subTabs perm ids — those are deliberately opt-in
// extras (see SCREEN_PERMISSIONS_DEFAULT.kitchen.subTabs), never bundled in
// by a role preset, "All On", or "Copy from" another staff. They can only be
// turned on by their own individual Access Manager toggle.
function permsFromScreens(screenIds) {
  const perms = [];
  screenIds.forEach(sid => {
    const sp = SCREEN_PERMISSIONS[sid];
    if (!sp) return;
    const subTabIds = sp.subTabs || [];
    sp.perms.forEach(p => { if (!subTabIds.includes(p.id) && !perms.includes(p.id)) perms.push(p.id); });
  });
  return perms;
}

export { SCREEN_PERMISSIONS, SCREEN_PERMISSIONS_DEFAULT, NAV_ITEMS, PRESET_ROLES, PRESET_ROLES_DEFAULT, hydratePermissions, hydrateScreenDefinitions, setScreenDefinitions, setRoleDefinition, deleteRoleDefinition, getEffectivePerms, hasPermission, hasPerm, canAccessScreen, getScreensForRole, permsFromScreens };

