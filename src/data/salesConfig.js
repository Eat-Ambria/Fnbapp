// Ambria FnB — Sales module configuration
// V70 Phase 3-5A: dept meta + Phase 5A DEPT_CONFIGS (Beverage + Service placeholders).
// Ambria will edit option lists directly in this file — treat placeholders as starting points.
// Place in: src/data/salesConfig.js

// ── 7 F&B sub-departments (order = sidebar order) ──
// `icon` stays for anywhere still rendering an emoji; `glyph` names an entry in
// the app icon set, which is what the chrome uses. One line of SVG beats an
// emoji here: emoji render differently on every OS, sit on their own baseline,
// and cannot take the department colour.
export const SALES_DEPTS = [
  { id: 'kit', name: 'Kitchen',    icon: '👨‍🍳', glyph: 'chefHat',  color: '#D4A843', bg: '#F5EBD7' },
  { id: 'bev', name: 'Beverage',   icon: '🥤',   glyph: 'cup',      color: '#50B0A0', bg: '#DEF0EC' },
  { id: 'bak', name: 'Bakery',     icon: '🧁',   glyph: 'cake',     color: '#C87A97', bg: '#F5E1EA' },
  { id: 'frt', name: 'Fruits',     icon: '🍎',   glyph: 'apple',    color: '#4CAF50', bg: '#DFF0DE' },
  { id: 'svc', name: 'Service',    icon: '🍽️',   glyph: 'bell',     color: '#5B8FD0', bg: '#DEEAF6' },
  { id: 'crk', name: 'Crockery',   icon: '🍶',   glyph: 'plate',    color: '#8A70C8', bg: '#EADFF5' },
  { id: 'trn', name: 'Transport',  icon: '🚛',   glyph: 'truck',    color: '#8B5E28', bg: '#EFE3D3' },
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

// Ice cream, tea and coffee are always Beverages' to prepare — whatever package
// section, catalogue section or saved dept says otherwise. One rule, no
// exceptions, and every place that resolves a dish's department asks this first
// (eventItems.js, the menu builders, proposals) so they cannot disagree.
//
// Each word is matched with surrounding word-boundary markers rather than as a
// bare substring. A bare "tea" previously matched inside ordinary words like
// "Steam" (the letters t-e-a sit right inside "S[tea]m"), silently routing
// Kitchen dishes like "Steam Rice / Jeera Rice" into Beverages. Boundary
// markers also let "ice" and "cream" match across a space, which they never
// did before (dish names spell it "Ice Cream", not "Icecream").
function pinnedDeptForDish(name) {
  if (!name) return null;
  var s = String(name);
  var hasWord = function(word) {
    var re = new RegExp('(^|[^a-z0-9])' + word + '([^a-z0-9]|$)', 'i');
    return re.test(s);
  };
  if (hasWord('ice\\s*cream') || hasWord('tea') || hasWord('coffee')) return 'bev';
  return null;
}
export { pinnedDeptForDish };

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

// The "base tier" for a single-choice config — picked by name where one is
// obviously the baseline ("Standard", "Standard Kit", "Standard Chafers"...),
// falling back to whichever option sorts first (every one of these catalogues
// is authored low-tier-to-high-tier, e.g. "Buffet"/"Round Tables"/"No Carving"
// as position one) for the few configs with no option actually named Standard.
// Shared by ConfigsPanel (auto-fills this as the value the first time a
// config is seen with nothing picked) and FunctionPlanPrintView (so the FP
// print only calls out a dept config when it's actually been moved off this
// baseline, instead of printing every event's standard tier as if it were
// something sales chose).
export function defaultOptForCfg(cfg) {
  var list = cfg.type === 'ratio' ? (cfg.ratios || []) : (cfg.options || []);
  if (list.length === 0) return null;
  var nameOf = function(o){ return cfg.type === 'ratio' ? o.label : o.name; };
  var std = list.find(function(o){ return /^standard/i.test(String(nameOf(o) || '').trim()); });
  return std || list[0];
}
export function defaultValueForCfg(cfg) {
  var opt = defaultOptForCfg(cfg);
  if (!opt) return null;
  return cfg.type === 'ratio' ? { ratio_id: opt.id, extras: 0 } : { selected_id: opt.id };
}
// True when `value` is exactly this config's standard/baseline tier (or
// unset) — only meaningful for the single-choice types ConfigsPanel
// auto-defaults (options/radio/ratio); count/multi_count/tags are never
// auto-filled, so any saved value there was an actual sales choice.
export function isDefaultConfigValue(cfg, value) {
  if (cfg.type !== 'options' && cfg.type !== 'radio' && cfg.type !== 'ratio') return false;
  if (value == null) return true;
  var def = defaultValueForCfg(cfg);
  if (!def) return false;
  if (cfg.type === 'ratio') return value.ratio_id === def.ratio_id && (value.extras || 0) === 0;
  return value.selected_id === def.selected_id;
}
