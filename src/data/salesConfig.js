// Ambria FnB — Sales module configuration
// V70 Phase 3-5A: dept meta + Phase 5A DEPT_CONFIGS (Beverage + Service placeholders).
// Ambria will edit option lists directly in this file — treat placeholders as starting points.
// Place in: src/data/salesConfig.js

// ── 7 F&B sub-departments (order = sidebar order) ──
export const SALES_DEPTS = [
  { id: 'kit', name: 'Kitchen',    icon: '👨‍🍳', color: '#D4A843', bg: '#F5EBD7' },
  { id: 'bev', name: 'Beverage',   icon: '🥤',   color: '#50B0A0', bg: '#DEF0EC' },
  { id: 'bak', name: 'Bakery',     icon: '🧁',   color: '#C87A97', bg: '#F5E1EA' },
  { id: 'frt', name: 'Fruits',     icon: '🍎',   color: '#4CAF50', bg: '#DFF0DE' },
  { id: 'svc', name: 'Service',    icon: '🍽️',   color: '#5B8FD0', bg: '#DEEAF6' },
  { id: 'crk', name: 'Crockery',   icon: '🍶',   color: '#8A70C8', bg: '#EADFF5' },
  { id: 'trn', name: 'Transport',  icon: '🚛',   color: '#8B5E28', bg: '#EFE3D3' },
];

export const SALES_DEPT_MAP = SALES_DEPTS.reduce(function(m, d){ m[d.id] = d; return m; }, {});

export const ITEM_HAVING_DEPTS = ['kit', 'bev', 'bak', 'frt'];

export const DIET_TAGS = [
  { id: 'veg',    label: 'Veg',      icon: '🟢', color: '#2A7A48' },
  { id: 'nonveg', label: 'Non-veg',  icon: '🔴', color: '#A52828' },
  { id: 'egg',    label: 'Egg',      icon: '🟡', color: '#B8860B' },
  { id: 'jain',   label: 'Jain',     icon: '🟠', color: '#D97706' },
];

export const DIET_TAG_MAP = DIET_TAGS.reduce(function(m, d){ m[d.id] = d; return m; }, {});

export const DEFAULT_DIET = 'veg';
export const DEFAULT_DEPT = 'kit';

// ═══════════════════════════════════════════════════════════════
// V70 Phase 5: dept-level config schema
// ═══════════════════════════════════════════════════════════════
// Panel types available:
//   'options'      → single-select card grid. Uses `options: [{id,name,desc,icon?}]`.
//                    config_value shape: { selected_id: '<id>' }
//   'ratio'        → 3-card ratio picker + optional extras spinner. Uses `ratios: [{id,num,den,label}]`
//                    and `allowExtras: bool`.
//                    config_value shape: { ratio_id: '<id>', extras: <int> }
//   'count'        → number stepper. Uses `min, max, step`.
//                    config_value shape: { count: <int> }
//   'multi_count'  → rows of {checkbox + count}. Uses `options: [{id,name,desc?}]`.
//                    config_value shape: { items: [{ id, count }] }
//   'radio'        → radio-styled cards. Uses `options: [{id,name,desc}]`.
//                    config_value shape: { selected_id: '<id>' }
//   'tags'         → multi-select pill toggles. Uses `options: [{id,name,icon?}]`.
//                    config_value shape: { selected_ids: ['<id>', ...] }
//
// Phase 5A ships bev + svc. Phase 5B fills the remaining 5 depts.
// ═══════════════════════════════════════════════════════════════
// V70 Phase 5B follow-up: DEPT_CONFIGS is now populated from Supabase on boot via
// hydrateSalesConfigs() (called from App.jsx after loadAllConfig). This keeps the
// binding stable — consumers importing DEPT_CONFIGS get the hydrated data on read.
// Edit the config catalogue by editing rows in sales_config_defs + sales_config_options
// tables in Supabase; changes reflect on next page load.
export const DEPT_CONFIGS = {};

export function hydrateSalesConfigs(deptConfigs) {
  if (!deptConfigs || typeof deptConfigs !== 'object') return;
  Object.keys(DEPT_CONFIGS).forEach(function(k){ delete DEPT_CONFIGS[k]; });
  Object.assign(DEPT_CONFIGS, deptConfigs);
}