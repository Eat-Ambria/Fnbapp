// Ambria FnB — Sales module configuration
// V70 Phase 3: dept meta only. Phase 5 will add config option constants (glassware, ratios, etc).
// Place in: src/data/salesConfig.js

// ── 7 F&B sub-departments (order = sidebar order) ──
// id must match sales_items_meta.sales_dept CHECK constraint values.
export const SALES_DEPTS = [
  { id: 'kit', name: 'Kitchen',    icon: '👨‍🍳', color: '#D4A843', bg: '#F5EBD7' },
  { id: 'bev', name: 'Beverage',   icon: '🥤',   color: '#50B0A0', bg: '#DEF0EC' },
  { id: 'bak', name: 'Bakery',     icon: '🧁',   color: '#C87A97', bg: '#F5E1EA' },
  { id: 'frt', name: 'Fruits',     icon: '🍎',   color: '#4CAF50', bg: '#DFF0DE' },
  { id: 'svc', name: 'Service',    icon: '🍽️',   color: '#5B8FD0', bg: '#DEEAF6' },
  { id: 'crk', name: 'Crockery',   icon: '🍶',   color: '#8A70C8', bg: '#EADFF5' },
  { id: 'trn', name: 'Transport',  icon: '🚛',   color: '#8B5E28', bg: '#EFE3D3' },
];

// Quick lookup: id → dept meta
export const SALES_DEPT_MAP = SALES_DEPTS.reduce(function(m, d){ m[d.id] = d; return m; }, {});

// Depts that have an Items sub-tab (dish picker) in the menu builder.
// Others get only config sub-tabs (Phase 5).
export const ITEM_HAVING_DEPTS = ['kit', 'bev', 'bak', 'frt'];

// Diet tag options (must match sales_items_meta.diet_tag CHECK constraint values).
export const DIET_TAGS = [
  { id: 'veg',    label: 'Veg',      icon: '🟢', color: '#2A7A48' },
  { id: 'nonveg', label: 'Non-veg',  icon: '🔴', color: '#A52828' },
  { id: 'egg',    label: 'Egg',      icon: '🟡', color: '#B8860B' },
  { id: 'jain',   label: 'Jain',     icon: '🟠', color: '#D97706' },
];

export const DIET_TAG_MAP = DIET_TAGS.reduce(function(m, d){ m[d.id] = d; return m; }, {});

// Default fallback for dishes with no sales_items_meta row.
export const DEFAULT_DIET = 'veg';
export const DEFAULT_DEPT = 'kit';