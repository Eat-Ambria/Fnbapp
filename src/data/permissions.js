// Ambria FnB — Simplified RBAC permissions
// Role hierarchy: Chef → Head Chef → Manager → Admin
// Each role auto-gets tab access + action permissions
// Custom overrides: toggle individual screens on/off per user

// ── SCREEN DEFINITIONS (for UI display in Access Manager) ──
const SCREEN_PERMISSIONS = {
  dashboard:      {label:"Dashboard",           icon:"📊", perms:[{id:"dashboard.view",type:"view",label:"View dashboard KPIs"},{id:"dashboard.closure_report",type:"action",label:"Generate closure report"},{id:"dashboard.export",type:"action",label:"Export reports"}]},
  kitchen:        {label:"Kitchen Hub",         icon:"👨‍🍳", perms:[{id:"kitchen.view",type:"view",label:"View today's tasks"},{id:"kitchen.d1_view",type:"view",label:"View D-1 prep"},{id:"kitchen.d1_mark_done",type:"action",label:"Mark prep done"},{id:"kitchen.mark_ready",type:"action",label:"Mark dish ready"},{id:"kitchen.start_timer",type:"action",label:"Start/stop timers"},{id:"kitchen.store_collect",type:"action",label:"Collect from store"},{id:"kitchen.quality_rate",type:"action",label:"Rate ingredient quality"},{id:"kitchen.scaling_view",type:"view",label:"View pax scaling"},{id:"kitchen.scaling_apply",type:"action",label:"Apply scaling"},{id:"kitchen.sops_view",type:"view",label:"View recipe SOPs"},{id:"kitchen.menu_view",type:"view",label:"View menu packages"}]},
  store:          {label:"Store & Inventory",   icon:"📦", perms:[{id:"store.view",type:"view",label:"View inventory"},{id:"store.issue",type:"action",label:"Issue items"},{id:"store.receive",type:"action",label:"Receive items"},{id:"store.barcode_scan",type:"action",label:"Scan barcodes"},{id:"store.smart_issue",type:"action",label:"Smart issue"},{id:"store.edit_stock",type:"action",label:"Edit stock levels"}]},
  transport:      {label:"Transport",           icon:"🚛", perms:[{id:"transport.view",type:"view",label:"View dispatch"},{id:"transport.dispatch",type:"action",label:"Mark dispatch"},{id:"transport.temp_log",type:"action",label:"Log fridge temp"},{id:"transport.loading_check",type:"action",label:"Loading checklist"}]},

  team:           {label:"Team & Attendance",   icon:"👥", perms:[{id:"team.view",type:"view",label:"View staff list"},{id:"team.attendance_mark",type:"action",label:"Mark attendance"},{id:"team.leave_request",type:"request",label:"Submit leave request"},{id:"team.leave_approve",type:"approval",label:"Approve/reject leaves"},{id:"team.daily_wages",type:"action",label:"Add daily wages staff"},{id:"team.export_attendance",type:"action",label:"Export attendance"}]},
  menus:          {label:"Menu Packages",       icon:"📜", perms:[{id:"menus.view",type:"view",label:"View menus"}]},
  vendors:        {label:"Vendor Directory",    icon:"📇", perms:[{id:"vendors.view",type:"view",label:"View vendors"},{id:"vendors.add",type:"action",label:"Add vendor"},{id:"vendors.edit",type:"action",label:"Edit vendor"}]},
  dept_service:   {label:"Service Ops",         icon:"🍽", perms:[{id:"dept_service.view",type:"view",label:"View service"},{id:"dept_service.check",type:"action",label:"Complete checklist"}]},
  dept_crockery:  {label:"Crockery Ops",        icon:"🍶", perms:[{id:"dept_crockery.view",type:"view",label:"View crockery"},{id:"dept_crockery.check",type:"action",label:"Complete checklist"}]},
  dept_beverages: {label:"Beverages Ops",       icon:"🥤", perms:[{id:"dept_beverages.view",type:"view",label:"View beverages"},{id:"dept_beverages.check",type:"action",label:"Complete checklist"}]},
  dept_odc:       {label:"ODC Operations",      icon:"🏕", perms:[{id:"dept_odc.view",type:"view",label:"View ODC"},{id:"dept_odc.check",type:"action",label:"Complete checklist"}]},
  access:         {label:"Access Manager",      icon:"🔐", perms:[{id:"access.view",type:"view",label:"View staff list"},{id:"access.add",type:"action",label:"Add staff"},{id:"access.edit",type:"action",label:"Edit staff"},{id:"access.delete",type:"action",label:"Delete staff"},{id:"access.perms",type:"action",label:"Change permissions"},{id:"access.bulk_ops",type:"action",label:"Bulk operations"}]},
  proposals:        {label:"Proposals",           icon:"📝", perms:[{id:"proposals.view",type:"view",label:"View proposals"},{id:"proposals.create",type:"action",label:"Create proposal"},{id:"proposals.edit",type:"action",label:"Edit own proposals"},{id:"proposals.delete",type:"action",label:"Delete own proposals"},{id:"proposals.view_all",type:"action",label:"View all reps' proposals"},{id:"proposals.convert",type:"action",label:"Convert won to booking"}]},
  sales_catalogue:  {label:"Sales Catalogue",     icon:"🏷️", perms:[{id:"sales_catalogue.view",type:"view",label:"View sales catalogue"},{id:"sales_catalogue.edit",type:"action",label:"Edit item meta/images"}]},
};

// ── ROLE HIERARCHY ──
// Defines: which screens each role can see, and which elevated actions they get
// Tab access = auto-gets ALL permissions for that screen
// Elevated actions = specific action-level perms that only certain roles have (across any screen they access)
const PRESET_ROLES = {
  admin: {
    label: "Admin — Full Access",
    tier: 4,
    screens: ["dashboard","kitchen","store","team","transport","vendors","menus","access","dept_service","dept_crockery","dept_beverages","dept_odc","proposals","sales_catalogue"],
    // Admin gets everything — no need to list elevated actions
  },
  head_chef: {
    label: "Head Chef",
    tier: 3,
    screens: ["dashboard","kitchen","menus","store","team","transport"],
    elevated: ["kitchen.scaling_apply","team.leave_approve"],
  },
  service: {
    label: "Service Dept",
    tier: 2,
    screens: ["dashboard","dept_service","team","vendors"],
    elevated: [],
  },
  crockery: {
    label: "Crockery Dept",
    tier: 2,
    screens: ["dashboard","dept_crockery","team","store"],
    elevated: [],
  },
  beverages: {
    label: "Beverages Dept",
    tier: 2,
    screens: ["dashboard","dept_beverages","menus","team","store"],
    elevated: [],
  },
  transport: {
    label: "Transport",
    tier: 2,
    screens: ["dashboard","transport"],
    elevated: [],
  },
  kiosk_gate: {
    label: "Gate Kiosk",
    tier: 1,
    screens: ["team"],
    elevated: ["team.attendance_mark"],
  },
  section_tablet:      {label:"Section Tablet",       tier:1, screens:["kitchen"], elevated:[]},
  section_indian:      {label:"Indian Section",       tier:1, screens:["kitchen"], elevated:[]},
  section_chinese:     {label:"Chinese Section",      tier:1, screens:["kitchen"], elevated:[]},
  section_tandoor:     {label:"Tandoor Section",      tier:1, screens:["kitchen"], elevated:[]},
  section_chaat:       {label:"Chaat Section",        tier:1, screens:["kitchen"], elevated:[]},
  section_sweets:      {label:"Sweets Section",       tier:1, screens:["kitchen"], elevated:[]},
  section_continental: {label:"Continental Section",  tier:1, screens:["kitchen"], elevated:[]},
  section_bakery:      {label:"Bakery Section",       tier:1, screens:["kitchen"], elevated:[]},
  staff:               {label:"Staff",                tier:1, screens:["dashboard","kitchen"], elevated:[]},
  sales:               {label:"Sales Rep",            tier:2, screens:["dashboard","proposals"], elevated:["proposals.create","proposals.edit","proposals.delete"]},
  sales_manager:       {label:"Sales Manager",        tier:3, screens:["dashboard","proposals","sales_catalogue","menus"], elevated:["proposals.create","proposals.edit","proposals.delete","proposals.view_all","proposals.convert","sales_catalogue.edit"]},
};

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
function permsFromScreens(screenIds) {
  const perms = [];
  screenIds.forEach(sid => {
    const sp = SCREEN_PERMISSIONS[sid];
    if (sp) sp.perms.forEach(p => { if (!perms.includes(p.id)) perms.push(p.id); });
  });
  return perms;
}

export { SCREEN_PERMISSIONS, PRESET_ROLES, getEffectivePerms, hasPermission, hasPerm, canAccessScreen, getScreensForRole, permsFromScreens };

