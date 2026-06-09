// Ambria FnB — RBAC permissions system
// Extracted from App.jsx

const SCREEN_PERMISSIONS = {
  dashboard: {
    label:"Dashboard", icon:"📊",
    perms:[
      {id:"dashboard.view",           label:"View dashboard KPIs",          type:"view"},
      {id:"dashboard.closure_report", label:"Generate closure report",      type:"action"},
      {id:"dashboard.export",         label:"Export reports",               type:"action"},
    ]
  },
  kitchen: {
    label:"Kitchen Hub", icon:"👨‍🍳",
    perms:[
      {id:"kitchen.view",             label:"View today's tasks",           type:"view"},
      {id:"kitchen.d1_view",          label:"View D-1 prep",               type:"view"},
      {id:"kitchen.d1_mark_done",     label:"Mark mesa/prep as done",      type:"action"},
      {id:"kitchen.mark_ready",       label:"Mark dish as ready + photo",  type:"action"},
      {id:"kitchen.start_timer",      label:"Start/stop cooking timers",   type:"action"},
      {id:"kitchen.store_collect",    label:"Collect items from store",    type:"action"},
      {id:"kitchen.quality_rate",     label:"Rate ingredient quality",     type:"action"},
      {id:"kitchen.scaling_view",     label:"View pax scaling",            type:"view"},
      {id:"kitchen.scaling_apply",    label:"Apply scaling to events",     type:"action"},
      {id:"kitchen.sops_view",        label:"View recipe SOPs",            type:"view"},
      {id:"kitchen.menu_view",        label:"View menu packages",          type:"view"},
    ]
  },
  store: {
    label:"Store & Inventory", icon:"📦",
    perms:[
      {id:"store.view",               label:"View inventory",               type:"view"},
      {id:"store.issue",              label:"Issue items (stock out)",      type:"action"},
      {id:"store.receive",            label:"Receive items (stock in)",     type:"action"},
      {id:"store.barcode_scan",       label:"Scan barcodes",               type:"action"},
      {id:"store.smart_issue",        label:"Use smart issue (auto-calc)",  type:"action"},
      {id:"store.edit_stock",         label:"Edit stock levels",           type:"action"},
    ]
  },
  transport: {
    label:"Transport", icon:"🚛",
    perms:[
      {id:"transport.view",           label:"View dispatch plan",           type:"view"},
      {id:"transport.dispatch",       label:"Mark dispatch done",           type:"action"},
      {id:"transport.temp_log",       label:"Log fridge temperature",      type:"action"},
      {id:"transport.loading_check",  label:"Complete loading checklist",   type:"action"},
    ]
  },
  repair: {
    label:"Repair & Maintenance", icon:"🔧",
    perms:[
      {id:"repair.view",              label:"View all tickets",             type:"view"},
      {id:"repair.create",            label:"Raise new ticket",             type:"action"},
      {id:"repair.update",            label:"Post updates on tickets",     type:"action"},
      {id:"repair.reassign",          label:"Reassign tickets",            type:"action"},
      {id:"repair.change_status",     label:"Change ticket status",        type:"action"},
      {id:"repair.complete_photo",    label:"Mark complete with photo",    type:"action"},
      {id:"repair.delete",            label:"Delete tickets",              type:"action"},
    ]
  },
  team: {
    label:"Team & Attendance", icon:"👥",
    perms:[
      {id:"team.view",                label:"View staff list",              type:"view"},
      {id:"team.attendance_mark",     label:"Mark attendance",             type:"action"},
      {id:"team.leave_request",       label:"Submit leave request",        type:"request"},
      {id:"team.leave_approve",       label:"Approve/reject leaves",       type:"approval"},
      {id:"team.daily_wages",         label:"Add daily wages staff",       type:"action"},
      {id:"team.export_attendance",   label:"Export attendance Excel",     type:"action"},
    ]
  },
  menus: {
    label:"Menu Packages", icon:"📜",
    perms:[
      {id:"menus.view",               label:"View menu packages",           type:"view"},
    ]
  },
  vendors: {
    label:"Vendor Directory", icon:"📇",
    perms:[
      {id:"vendors.view",             label:"View vendors",                 type:"view"},
      {id:"vendors.add",              label:"Add new vendor",              type:"action"},
      {id:"vendors.edit",             label:"Edit vendor details",         type:"action"},
    ]
  },
  dept_service: {
    label:"Service Ops", icon:"🍽",
    perms:[
      {id:"dept_service.view",        label:"View service checklist",       type:"view"},
      {id:"dept_service.check",       label:"Complete checklist items",    type:"action"},
    ]
  },
  dept_crockery: {
    label:"Crockery Ops", icon:"🍶",
    perms:[
      {id:"dept_crockery.view",       label:"View crockery requirements",   type:"view"},
      {id:"dept_crockery.check",      label:"Complete checklist items",    type:"action"},
    ]
  },
  dept_beverages: {
    label:"Beverages Ops", icon:"🥤",
    perms:[
      {id:"dept_beverages.view",      label:"View beverage prep",           type:"view"},
      {id:"dept_beverages.check",     label:"Complete checklist items",    type:"action"},
    ]
  },
  dept_odc: {
    label:"ODC Operations", icon:"🏕",
    perms:[
      {id:"dept_odc.view",            label:"View ODC bookings",            type:"view"},
      {id:"dept_odc.check",           label:"Complete site checklist",     type:"action"},
    ]
  },
  access: {
    label:"Access Manager", icon:"🔐",
    perms:[
      {id:"access.view",              label:"View staff list",              type:"view"},
      {id:"access.add",               label:"Add new staff",               type:"action"},
      {id:"access.edit",              label:"Edit staff details & PIN",    type:"action"},
      {id:"access.delete",            label:"Delete staff",                type:"action"},
      {id:"access.perms",             label:"Change permissions",          type:"action"},
      {id:"access.bulk_ops",          label:"Bulk operations",             type:"action"},
    ]
  },
};

// Role → allowed screen IDs map (single source of truth)
const PRESET_ROLES = {
  admin:            {label:"Admin",              screens:["dashboard","kitchen","store","team","transport","repair","vendors","menus","access","dept_service","dept_crockery","dept_beverages","dept_odc"]},
  head_chef:        {label:"Head Chef",          screens:["dashboard","kitchen","menus","store","team","transport","repair"]},
  service:          {label:"Service",            screens:["dashboard","dept_service","team","vendors","repair"]},
  crockery:         {label:"Crockery",           screens:["dashboard","dept_crockery","team","store","repair"]},
  beverages:        {label:"Beverages",          screens:["dashboard","dept_beverages","menus","team","store","repair"]},
  transport:        {label:"Transport",          screens:["dashboard","transport","repair"]},
  kiosk_gate:       {label:"Gate Kiosk",         screens:["team"]},
  section_indian:   {label:"Indian Section",     screens:["kitchen","repair"]},
  section_chinese:  {label:"Chinese Section",    screens:["kitchen","repair"]},
  section_tandoor:  {label:"Tandoor Section",    screens:["kitchen","repair"]},
  section_chaat:    {label:"Chaat Section",      screens:["kitchen","repair"]},
  section_sweets:   {label:"Sweets Section",     screens:["kitchen","repair"]},
  section_continental:{label:"Continental Section",screens:["kitchen","repair"]},
  section_bakery:   {label:"Bakery Section",     screens:["kitchen","repair"]},
  staff:            {label:"Staff",              screens:["dashboard","kitchen","repair"]},
};

function getEffectivePerms(staff) {
  if (!staff) return [];
  if (staff.permissions && staff.permissions.length > 0) return staff.permissions;
  // custom_screens: derive perms from the allowed screen list
  if (staff.custom_screens && staff.custom_screens.length > 0) {
    const perms = [];
    staff.custom_screens.forEach(sid => {
      const sp = SCREEN_PERMISSIONS[sid];
      if (sp) sp.perms.forEach(p => perms.push(p.id));
    });
    return perms.length > 0 ? perms : staff.custom_screens;
  }
  const role = (staff.role || "staff");
  if (role === "admin") return Object.values(SCREEN_PERMISSIONS).flatMap(s => s.perms.map(p => p.id));
  const pr = PRESET_ROLES[role] || PRESET_ROLES.staff;
  const perms = [];
  pr.screens.forEach(sid => { const sp = SCREEN_PERMISSIONS[sid]; if (sp) sp.perms.forEach(p => perms.push(p.id)); });
  return perms;
}

function hasPermission(staff, permId) {
  if (!staff) return true;
  if (staff.role === "admin") return true;
  return getEffectivePerms(staff).includes(permId);
}

const hasPerm = hasPermission;

function canAccessScreen(user, screenId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  // Fine-grained permission override
  if (user.permissions && user.permissions.length > 0) {
    const sp = SCREEN_PERMISSIONS[screenId];
    if (!sp) return true;
    return sp.perms.some(p => user.permissions.includes(p.id));
  }
  // Custom screen whitelist
  if (user.custom_screens && user.custom_screens.length > 0) {
    return user.custom_screens.includes(screenId);
  }
  // Role-based default
  const pr = PRESET_ROLES[user.role || "staff"] || PRESET_ROLES.staff;
  return pr.screens.includes(screenId);
}



export { SCREEN_PERMISSIONS, PRESET_ROLES, getEffectivePerms, hasPermission, hasPerm, canAccessScreen };
