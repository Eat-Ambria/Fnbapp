// Ambria FnB — resolve an event's event_items into per-department dish-name
// lists. `event_items` is the single source of truth for every sales
// department (Kitchen, Beverage, Bakery, Fruits, Service, Crockery,
// Transport) — Kitchen Hub's `events.menu` flat array is only ever a
// Kitchen-dept MIRROR of it (see EventMenuBuilderView.jsx's
// mirrorKitchenMenu). Any non-Kitchen Ops screen (Beverages Ops, Fruits Ops,
// Bakery...) needs to read event_items directly, filtered to its own dept,
// the same way Kitchen Hub reads events.menu — not `events.menu` itself,
// which never carried those dishes to begin with.
//
// This mirrors EventMenuBuilderView.jsx's dept-resolution logic
// (allDishesByName / sectionSalesDeptMap / dishNameToPkgDept /
// sectionOverrideDept / effectiveDeptForDish) as a standalone async helper,
// since that logic otherwise only exists wired into that one component's
// React state.
import { supabase } from './supabase.js';
import { MENU_PACKAGES, MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';
import { getAllDishes } from '../data/recipeData.js';
import { DEFAULT_DEPT } from '../data/salesConfig.js';

function normalizePkgName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function resolvePkgName(raw) {
  if (!raw) return null;
  if (MENU_PACKAGES[raw]) return raw;
  const idx = {};
  Object.keys(MENU_PACKAGES).forEach(name => { idx[normalizePkgName(name)] = name; });
  return idx[normalizePkgName(raw)] || null;
}

// Same precedence as EventMenuBuilderView's deptForTargetId: a per-event
// section-override target may point at a package section OR a catalogue
// section (which may itself defer to its parent section's dept).
function deptForOverrideTarget(rawId, pkgSecs, sectionsArr) {
  const id = rawId.indexOf('__unplaced') >= 0 ? rawId.slice(0, rawId.indexOf('__unplaced')) : rawId;
  const ps = pkgSecs && pkgSecs.find(s => s.id === id);
  if (ps) return ps.sales_dept || 'kit';
  const cs = sectionsArr.find(s => s.id === id);
  if (cs) {
    if (cs.sales_dept) return cs.sales_dept;
    const parent = cs.parent_section_id ? sectionsArr.find(s => s.id === cs.parent_section_id) : null;
    return (parent && parent.sales_dept) || 'kit';
  }
  return null;
}

// Returns { kit:[names], bev:[names], bak:[names], frt:[names], svc:[names], crk:[names], trn:[names] }
export async function getEventItemsByDept(event) {
  const out = { kit: [], bev: [], bak: [], frt: [], svc: [], crk: [], trn: [] };
  if (!event || !event.id) return out;

  const [itemsRes, sectionsRes, metaRes] = await Promise.all([
    supabase.from('event_items').select('dish_name').eq('event_id', event.id),
    supabase.from('dish_catalogue_sections').select('id, sales_dept, parent_section_id'),
    supabase.from('sales_items_meta').select('dish_name, sales_dept'),
  ]);
  const items = itemsRes.data || [];
  if (items.length === 0) return out;

  const sectionsArr = sectionsRes.data || [];
  const sectionSalesDeptMap = {};
  sectionsArr.forEach(s => { sectionSalesDeptMap[s.id] = s.sales_dept || 'kit'; });

  const metaDeptByName = {};
  (metaRes.data || []).forEach(r => { metaDeptByName[r.dish_name] = r.sales_dept || DEFAULT_DEPT; });

  const allDishesByName = {};
  (getAllDishes({ includeInactive: true }) || []).forEach(d => { allDishesByName[d.dish_name] = d; });

  const pkgName = resolvePkgName(event.menu_package || event.menuPackage);
  const pkgSecs = pkgName ? MENU_PACKAGE_SECTIONS[pkgName] : null;
  const dishNameToPkgDept = {};
  if (pkgSecs) {
    pkgSecs.forEach(sec => {
      const dept = sec.sales_dept || 'kit';
      (sec.dishes || []).forEach(name => { if (name) dishNameToPkgDept[name] = dept; });
    });
  }

  const sectionOverrides = event.menu_section_overrides || {};
  const sectionOverrideDept = {};
  Object.keys(sectionOverrides).forEach(name => {
    const targetId = sectionOverrides[name];
    if (!targetId) return;
    const dept = deptForOverrideTarget(targetId, pkgSecs, sectionsArr);
    if (dept) sectionOverrideDept[name] = dept;
  });

  items.forEach(it => {
    const name = it.dish_name;
    const d = allDishesByName[name];
    const catalogueDept = d && d.section_id ? sectionSalesDeptMap[d.section_id] : null;
    const dept = sectionOverrideDept[name] || dishNameToPkgDept[name] || catalogueDept || metaDeptByName[name] || DEFAULT_DEPT;
    if (!out[dept]) out[dept] = [];
    out[dept].push(name);
  });
  return out;
}
