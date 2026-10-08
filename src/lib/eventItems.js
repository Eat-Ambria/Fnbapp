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
import { fetchAllRows } from './db.js';
import { MENU_PACKAGES, MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';
import { getAllDishes } from '../data/recipeData.js';
import { DEFAULT_DEPT, pinnedDeptForDish } from '../data/salesConfig.js';

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

// Per-event maps that feed resolveDeptForDish — computed once per event from
// shared (cross-event) lookups plus this one event's own package/overrides.
function buildEventDeptContext(event, sectionsArr) {
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
  return { dishNameToPkgDept, sectionOverrideDept };
}

function resolveDeptForDish(name, ctx) {
  const { allDishesByName, sectionSalesDeptMap, metaDeptByName, dishNameToPkgDept, sectionOverrideDept } = ctx;
  const d = allDishesByName[name];
  const catalogueDept = d && d.section_id ? sectionSalesDeptMap[d.section_id] : null;
  return pinnedDeptForDish(name) || sectionOverrideDept[name] || dishNameToPkgDept[name] || catalogueDept || metaDeptByName[name] || DEFAULT_DEPT;
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
  if (items.length === 0) {
    // event_items is only authoritative once the event has been opened in the
    // Items tab; until then events.menu is all there is. The Kitchen readers
    // now drop ice cream / tea / coffee, so those must land in Beverages here
    // or an untouched event would show them nowhere.
    let m = event.menu;
    if (typeof m === 'string' && m) { try { m = JSON.parse(m); } catch (e) { m = []; } }
    (Array.isArray(m) ? m : []).forEach(n => { if (pinnedDeptForDish(n)) out.bev.push(n); });
    return out;
  }

  const sectionsArr = sectionsRes.data || [];
  const sectionSalesDeptMap = {};
  sectionsArr.forEach(s => { sectionSalesDeptMap[s.id] = s.sales_dept || 'kit'; });

  const metaDeptByName = {};
  (metaRes.data || []).forEach(r => { metaDeptByName[r.dish_name] = r.sales_dept || DEFAULT_DEPT; });

  const allDishesByName = {};
  (getAllDishes({ includeInactive: true }) || []).forEach(d => { allDishesByName[d.dish_name] = d; });

  const { dishNameToPkgDept, sectionOverrideDept } = buildEventDeptContext(event, sectionsArr);
  const ctx = { allDishesByName, sectionSalesDeptMap, metaDeptByName, dishNameToPkgDept, sectionOverrideDept };

  items.forEach(it => {
    const dept = resolveDeptForDish(it.dish_name, ctx);
    if (!out[dept]) out[dept] = [];
    out[dept].push(it.dish_name);
  });
  return out;
}

// Re-derive events.menu (the Kitchen-only mirror) from the CURRENT event_items
// and write it back if it's drifted — the same repair EventMenuBuilderView.jsx
// already does for itself right after it loads an event (see its "self-heal"
// effect calling mirrorKitchenMenu). That only ever ran when someone happened
// to open THAT specific screen for the event, so Kitchen Hub's Planning tab
// and Build Menu could sit showing a stale mirror indefinitely unless someone
// separately opened the Items/FP tab first. Call this wherever an event is
// selected for viewing in either of those screens so they self-heal on their
// own, the same way.
//
// Returns the corrected `menu` array when a write happened, or null when
// nothing needed fixing — this ONLY writes the database. Callers hold the
// `events` React state this came from, not this module, so each one is
// responsible for merging the returned menu into its own local state; a
// caller that skips that merge keeps rendering the pre-heal menu until a
// full reload re-fetches the now-corrected row (the DB is right immediately,
// the open screen isn't, until someone refreshes).
export async function syncKitchenMenuMirror(event) {
  if (!event || !event.id) return null;
  // event_items only becomes the authoritative source once this event has
  // actually been opened in the Items tab at least once (event_items_initialized
  // — same flag EventMenuBuilderView.jsx sets). Before that, event_items is
  // legitimately empty and events.menu (or the package-default fallback) is
  // all there is — healing from an empty event_items here would silently wipe
  // a perfectly fine, simply-not-yet-touched menu.
  if (!event.event_items_initialized) return null;
  try {
    const byDept = await getEventItemsByDept(event);
    const kitNames = byDept.kit || [];
    const current = Array.isArray(event.menu) ? event.menu : [];
    const same = kitNames.length === current.length && kitNames.every((n, i) => n === current[i]);
    if (same) return null;
    const { error } = await supabase.from('events').update({ menu: kitNames }).eq('id', event.id);
    if (error) { console.error('[eventItems] syncKitchenMenuMirror failed:', error); return null; }
    return kitNames;
  } catch (e) {
    console.error('[eventItems] syncKitchenMenuMirror err:', e);
    return null;
  }
}

// Batch version of syncKitchenMenuMirror — one shared set of queries for every
// event instead of N round trips, so this is cheap enough to run proactively
// on every app boot (see App.jsx) rather than only when a screen happens to
// open one specific event. A menu changed in the Items tab, Build Menu, or
// anywhere else then shows up correctly everywhere (Planning, Event Day, Prep
// Day, Analytics...) the moment the app loads, with no extra click required.
//
// Returns the list of {id, menu} rows it actually corrected (or [] when
// nothing drifted) — this only writes the database; App.jsx's own local
// `events` state has to be merged by the caller or the running session keeps
// showing the pre-heal menu until a refresh re-fetches the now-fixed rows.
export async function syncAllKitchenMenuMirrors(events) {
  const initialized = (events || []).filter(e => e && e.id && e.event_items_initialized);
  if (initialized.length === 0) return [];
  const ids = initialized.map(e => e.id);

  try {
    const [itemRows, sectionsRes, metaRes] = await Promise.all([
      fetchAllRows(() => supabase.from('event_items').select('event_id, dish_name').in('event_id', ids)),
      supabase.from('dish_catalogue_sections').select('id, sales_dept, parent_section_id'),
      supabase.from('sales_items_meta').select('dish_name, sales_dept'),
    ]);

    const itemsByEvent = {};
    (itemRows || []).forEach(r => { (itemsByEvent[r.event_id] = itemsByEvent[r.event_id] || []).push(r.dish_name); });

    const sectionsArr = sectionsRes.data || [];
    const sectionSalesDeptMap = {};
    sectionsArr.forEach(s => { sectionSalesDeptMap[s.id] = s.sales_dept || 'kit'; });

    const metaDeptByName = {};
    (metaRes.data || []).forEach(r => { metaDeptByName[r.dish_name] = r.sales_dept || DEFAULT_DEPT; });

    const allDishesByName = {};
    (getAllDishes({ includeInactive: true }) || []).forEach(d => { allDishesByName[d.dish_name] = d; });

    const updates = [];
    initialized.forEach(event => {
      const items = itemsByEvent[event.id] || [];
      const { dishNameToPkgDept, sectionOverrideDept } = buildEventDeptContext(event, sectionsArr);
      const ctx = { allDishesByName, sectionSalesDeptMap, metaDeptByName, dishNameToPkgDept, sectionOverrideDept };
      const kitNames = items.filter(name => resolveDeptForDish(name, ctx) === 'kit');
      const current = Array.isArray(event.menu) ? event.menu : [];
      const same = kitNames.length === current.length && kitNames.every((n, i) => n === current[i]);
      if (!same) updates.push({ id: event.id, menu: kitNames });
    });
    if (updates.length === 0) return [];
    // Partial-column upsert — only id/menu are touched on each row, every
    // other column is left exactly as it is.
    const { error } = await supabase.from('events').upsert(updates, { onConflict: 'id' });
    if (error) { console.error('[eventItems] syncAllKitchenMenuMirrors upsert failed:', error); return []; }
    return updates;
  } catch (e) {
    console.error('[eventItems] syncAllKitchenMenuMirrors err:', e);
    return [];
  }
}
