// Ambria FnB — shared dish-grouping/visibility layer for the menu-builder UI
// (ItemsTab, in MenuBuilderView.jsx), used by both Proposals (MenuBuilderView.jsx)
// and Booked Functions' Items editor (EventMenuBuilderView.jsx).
//
// This used to be ~20 near-identical useMemo chains duplicated in full between
// those two files — which is why the groupedByPkgSection search bug (dishes not
// matching a search still showing up, synthesized back in by the package-dish
// fallback) had to be fixed twice, once per copy, and why EventMenuBuilderView's
// copy silently drifted from MenuBuilderView's in two other ways that nobody
// decided on purpose:
//   - its groupedByPkgSection/groupedBySection output never carried catSectionId,
//     so catalogueTree (below) could never resolve a top-level pill for it —
//     EventMenuBuilderView never computed catalogueTree at all and never passed
//     it to <ItemsTab>, so sibling catalogue sections never merged into one pill
//     there the way they already do on the Proposals screen.
//   - its deptDishes omitted sectionOverrideDept from the dept-resolution
//     precedence (MenuBuilderView's only gained that fix later, for the mirror-
//     sync correctness reasons documented in EventMenuBuilderView.jsx's own "V91"
//     comment) — a dish tagged to a specific dept section via "Add section from
//     library" could show under the wrong department tab on Proposals.
// Both are fixed here by unifying on the more-complete version, instead of
// patched twice again.
//
// outsourcedSet is deliberately NOT part of this hook — Proposals derives it
// from a per-item `.outsourced` flag on proposal_items; Events keeps a wholly
// separate events.outsourced_dishes array with no equivalent event_items column
// at all. Each caller keeps its own few-line derivation and passes the result
// straight to <ItemsTab>, exactly as both already do today.

import { useMemo } from 'react';
import { RECIPE_DB, getAllDishes, getCatIdForDish, resolveDishHindi } from '../data/recipeData.js';
import { MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';
import { DEFAULT_DEPT, DEFAULT_DIET, pinnedDeptForDish } from '../data/salesConfig.js';

// A dish's diet tag: explicit sales_items_meta.diet_tag wins; otherwise fall
// back to the dish library's veg/non-veg classification (dishes_master.is_veg)
// so an unclassified sales tag doesn't silently default every non-veg dish to
// "Veg". Only truly unclassified-everywhere dishes fall through to DEFAULT_DIET.
export function dietForDish(d, meta) {
  if (meta && meta.diet_tag) return meta.diet_tag;
  if (d && d.is_veg != null) return d.is_veg ? 'veg' : 'nonveg';
  return DEFAULT_DIET;
}

export function useMenuItemGrouping(params) {
  var dishItems = params.dishItems || [];
  var templateInfo = params.templateInfo || { name: null, dishes: [], diet: null };
  var sections = params.sections || [];
  var sectionOverrides = params.sectionOverrides || {};
  var activeDept = params.activeDept;
  var dietFilter = params.dietFilter || 'all';
  var searchQ = params.searchQ || '';
  var showAddons = !!params.showAddons;
  var salesMeta = params.salesMeta || {};
  var dishLibBump = params.dishLibBump;
  var pax = Number(params.pax) || 0;
  var noPackage = !!params.noPackage;
  var T2 = params.T2 || function(s){ return s; };

  var templateSet = useMemo(function(){
    var s = {}; templateInfo.dishes.forEach(function(d){ s[d] = true; }); return s;
  }, [templateInfo.dishes]);

  // dishLibBump forces a re-read after addDishItem's custom-dish path adds a
  // brand-new dish — getAllDishes() reads DISH_MASTER, a plain in-memory
  // object the library-creation helper mutates directly (not React state), so
  // without this the empty dep array would keep serving the mount-time
  // snapshot forever: the new dish would get selected but never appear in any
  // section group, since the grouped-by-section views look it up by name here.
  var allDishes = useMemo(function(){
    var raw = getAllDishes ? getAllDishes({ includeInactive: false }) : [];
    return raw.map(function(d){
      var catId = getCatIdForDish(d.dish_name) || 'other';
      var catObj = (RECIPE_DB.cats || []).find(function(c){ return c.id === catId; });
      return {
        name:            d.dish_name,
        hindi:           resolveDishHindi ? resolveDishHindi(d.dish_name) : '',
        catId:           catId,
        catName:         catObj ? catObj.name : 'Other',
        catIcon:         catObj ? (catObj.icon || '🍽') : '🍽',
        image:           d.image_url || '',
        notes:           d.notes || '',
        section_id:      d.section_id || null,
        sort_in_section: (d.sort_in_section == null ? null : d.sort_in_section),
        is_veg:          d.is_veg,
      };
    });
  // eslint-disable-next-line
  }, [dishLibBump]);
  var allDishesByName = useMemo(function(){
    var m = {}; allDishes.forEach(function(d){ m[d.name] = d; }); return m;
  }, [allDishes]);

  // section_id -> its add-on price/pax (set in Menu > Pricing).
  var sectionAddonPriceMap = useMemo(function(){
    var m = {};
    sections.forEach(function(s){ m[s.id] = Number(s.addon_price_per_pax) || 0; });
    return m;
  }, [sections]);

  // sectionId -> effective sales_dept (override or 'kit' default)
  var sectionSalesDeptMap = useMemo(function(){
    var m = {};
    sections.forEach(function(s){ m[s.id] = s.sales_dept || 'kit'; });
    return m;
  }, [sections]);

  // Catalogue sections can have one level of subsections (Dish Library →
  // Sections). parentId → its subsection rows, for groupedByPkgSection to pool
  // a linked section's FULL catalogue (parent + subsections), not just
  // whatever's directly on the parent row itself.
  var catSubsByParent = useMemo(function(){
    var m = {};
    sections.forEach(function(s){
      if (s.parent_section_id) { (m[s.parent_section_id] = m[s.parent_section_id] || []).push(s); }
    });
    return m;
  }, [sections]);

  // "Add section from library" picker: every top-level catalogue section
  // routed to the active dept tab, with its subsections listed right after
  // (indented). Dish counts come from allDishes (already loaded).
  var catalogueSectionOptions = useMemo(function(){
    var countFor = function(id){ return allDishes.filter(function(d){ return d.section_id === id; }).length; };
    var deptTop = sections.filter(function(s){ return !s.parent_section_id && (s.sales_dept || 'kit') === activeDept; });
    var out = [];
    deptTop.forEach(function(s){
      out.push({ id: s.id, label: s.name, count: countFor(s.id) });
      (catSubsByParent[s.id] || []).forEach(function(sub){ out.push({ id: sub.id, label: '— ' + sub.name, count: countFor(sub.id) }); });
    });
    return out;
  }, [sections, activeDept, catSubsByParent, allDishes]);

  // Template dishes NOT present in dishes_master. Render in Extras with ⚠ so
  // sales/kitchen can see catalogue mismatches without losing the pre-seeded item.
  var phantomDishes = useMemo(function(){
    if (!templateInfo.dishes || templateInfo.dishes.length === 0) return [];
    var nameSet = {};
    allDishes.forEach(function(d){ nameSet[d.name] = true; });
    return templateInfo.dishes
      .filter(function(name){ return !nameSet[name]; })
      .map(function(name){
        return {
          name: name, hindi: '', catId: 'other', catName: 'Extras', catIcon: '⚠',
          image: '', notes: '', section_id: null, sort_in_section: null, isPhantom: true,
        };
      });
  }, [allDishes, templateInfo.dishes]);

  var selectedSet = useMemo(function(){
    var s = {}; dishItems.forEach(function(x){ s[x.dish_name] = true; }); return s;
  }, [dishItems]);

  var focSet = useMemo(function(){
    var s = {}; dishItems.forEach(function(x){ if (x.foc) s[x.dish_name] = true; }); return s;
  }, [dishItems]);

  // dish name → its PACKAGE section's own sales_dept, for the currently
  // selected package. groupedByPkgSection already treats a package section's
  // sales_dept as the authoritative dept for its dishes (not the shared
  // catalogue section, which is just a quick-fill convenience) — counting has
  // to agree with that or the sidebar/live-total numbers won't match what's
  // actually shown under each dept tab.
  var dishNameToPkgDept = useMemo(function(){
    var pkgSecs = templateInfo.name ? MENU_PACKAGE_SECTIONS[templateInfo.name] : null;
    var m = {};
    if (pkgSecs) {
      pkgSecs.forEach(function(sec){
        var dept = sec.sales_dept || 'kit';
        (sec.dishes || []).forEach(function(name){ if (name) m[name] = dept; });
      });
    }
    return m;
  }, [templateInfo.name]);

  // A dish tagged via sectionOverrides to a section (e.g. a custom dish placed
  // under a Fruits-dept pill) isn't in dishNameToPkgDept at all — that map
  // only knows the package's OWN static dish list, not per-item ad-hoc tags.
  // Without this, the sidebar/live-total counts (and, for Events, the kitchen
  // mirror sync) silently attribute such a dish to its native/default dept
  // even though groupedByPkgSection already renders it correctly under its
  // tagged dept.
  var sectionOverrideDept = useMemo(function(){
    var pkgSecs = templateInfo.name ? (MENU_PACKAGE_SECTIONS[templateInfo.name] || []) : [];
    function deptForTargetId(rawId) {
      var id = rawId.indexOf('__unplaced') >= 0 ? rawId.slice(0, rawId.indexOf('__unplaced')) : rawId;
      var ps = pkgSecs.find(function(s){ return s.id === id; });
      if (ps) return ps.sales_dept || 'kit';
      var cs = sections.find(function(s){ return s.id === id; });
      if (cs) {
        if (cs.sales_dept) return cs.sales_dept;
        var parent = cs.parent_section_id ? sections.find(function(s){ return s.id === cs.parent_section_id; }) : null;
        return (parent && parent.sales_dept) || 'kit';
      }
      return null;
    }
    var m = {};
    Object.keys(sectionOverrides || {}).forEach(function(name){
      var targetId = sectionOverrides[name];
      if (!targetId) return;
      var dept = deptForTargetId(targetId);
      if (dept) m[name] = dept;
    });
    return m;
  }, [sectionOverrides, templateInfo.name, sections]);

  var deptCounts = useMemo(function(){
    var counts = {};
    var counted = {};
    allDishes.forEach(function(d){
      var meta = salesMeta[d.name];
      var dept = pinnedDeptForDish(d.name) || sectionOverrideDept[d.name] || dishNameToPkgDept[d.name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      if (!counts[dept]) counts[dept] = { sel: 0, total: 0 };
      counts[dept].total += 1;
      if (selectedSet[d.name]) counts[dept].sel += 1;
      counted[d.name] = true;
    });
    // Phantoms: selected dishes not present in the catalogue (retired, renamed,
    // or template-only names never added to dishes_master). Attribute them to
    // their package section's dept, saved dept, or DEFAULT_DEPT so the sidebar
    // sel badge is honest.
    Object.keys(selectedSet).forEach(function(name){
      if (counted[name]) return;
      var meta = salesMeta[name];
      var dept = pinnedDeptForDish(name) || sectionOverrideDept[name] || dishNameToPkgDept[name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      if (!counts[dept]) counts[dept] = { sel: 0, total: 0 };
      counts[dept].sel += 1;
    });
    return counts;
  }, [allDishes, salesMeta, selectedSet, dishNameToPkgDept, sectionOverrideDept]);

  // Per-dept add-on ₹ total: only dishes picked beyond the package (is_addon)
  // and not marked FOC, priced via their catalogue section's add-on price/pax
  // (set in Menu > Pricing) × this proposal/event's pax.
  var deptAddonTotal = useMemo(function(){
    var totals = {};
    dishItems.forEach(function(row){
      if (!row.is_addon || row.foc) return;
      var d = allDishesByName[row.dish_name];
      var price = d && d.section_id ? (sectionAddonPriceMap[d.section_id] || 0) : 0;
      if (price <= 0) return;
      var meta = salesMeta[row.dish_name];
      var dept = pinnedDeptForDish(row.dish_name) || sectionOverrideDept[row.dish_name] || dishNameToPkgDept[row.dish_name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      totals[dept] = (totals[dept] || 0) + price * pax;
    });
    return totals;
  }, [dishItems, allDishesByName, sectionAddonPriceMap, salesMeta, sectionOverrideDept, dishNameToPkgDept, pax]);

  // Resolves any catalogue section to the top-level ancestor the Dish Library
  // actually files it under, so sibling sections (e.g. "Chatori Chaat" and
  // "Awadh-E-Khaas", both really Chaat Station) merge into one pill instead of
  // each getting its own. Read the link id-first and name-second, then walk it
  // up — every section resolves the same way, rather than the grouping only
  // working for whichever names happen to agree between package and catalogue.
  var catalogueTree = useMemo(function(){
    var byId = {}, byName = {};
    sections.forEach(function(s){
      byId[s.id] = s;
      var n = (s.name || '').toLowerCase().trim();
      if (n && !byName[n]) byName[n] = s;
    });
    // The depth guard is not paranoia — parent_section_id is a plain
    // self-referencing column with nothing stopping a row from being dragged
    // under its own descendant, and a cycle here would hang the render.
    function topOf(row) {
      var cur = row, hops = 0;
      while (cur && cur.parent_section_id && hops++ < 12) {
        var next = byId[cur.parent_section_id];
        if (!next || next.id === cur.id) break;
        cur = next;
      }
      return cur || null;
    }
    return {
      resolveTop: function(catSectionId, name) {
        var row = (catSectionId && byId[catSectionId]) || byName[(name || '').toLowerCase().trim()];
        return row ? topOf(row) : null;
      },
    };
  }, [sections]);

  var grandTotal = useMemo(function(){
    var sum = 0;
    Object.keys(deptCounts).forEach(function(id){ sum += (deptCounts[id] || {}).sel || 0; });
    return sum;
  }, [deptCounts]);

  // Effective dept = section's sales_dept override (if the dish is in a
  // routed section) else the package section's own dept else a per-item
  // section-override tag else the dish's own sales-meta dept else DEFAULT_DEPT.
  // This precedence must match whatever a caller's own kitchen-mirror sync (if
  // any) uses — EventMenuBuilderView's mirrorKitchenMenu consults
  // sectionOverrideDept first for exactly this reason: a dish tagged via a
  // per-event section pill to e.g. a Fruits-dept section must resolve the same
  // way here (so it's checkable under the right tab) as it does there (so it
  // actually reaches the right department's production list).
  var deptDishes = useMemo(function(){
    var base = allDishes.filter(function(d){
      var override = d.section_id ? sectionSalesDeptMap[d.section_id] : null;
      var meta = salesMeta[d.name];
      var dept = pinnedDeptForDish(d.name) || sectionOverrideDept[d.name] || dishNameToPkgDept[d.name] || override || (meta && meta.sales_dept) || DEFAULT_DEPT;
      return dept === activeDept;
    });
    var phantomsForDept = phantomDishes.filter(function(p){ return (pinnedDeptForDish(p.name) || sectionOverrideDept[p.name] || dishNameToPkgDept[p.name] || DEFAULT_DEPT) === activeDept; });
    if (phantomsForDept.length > 0) return base.concat(phantomsForDept);
    return base;
  }, [allDishes, salesMeta, activeDept, phantomDishes, sectionSalesDeptMap, dishNameToPkgDept, sectionOverrideDept]);

  var templateDishesInDept = useMemo(function(){
    return templateInfo.dishes.filter(function(name){
      var meta = salesMeta[name];
      var dept = pinnedDeptForDish(name) || dishNameToPkgDept[name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      return dept === activeDept;
    });
  }, [templateInfo.dishes, salesMeta, activeDept, dishNameToPkgDept]);

  // Diet-annotated + filtered + searched, scoped to the active dept.
  var visibleDishes = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return deptDishes.filter(function(d){
      var inT = !!templateSet[d.name];
      var isSel = !!selectedSet[d.name];
      // "Add section from library" tags a whole section's dishes as
      // browsable-but-unselected — keep them visible regardless of showAddons.
      var hasOverride = !!(sectionOverrides && sectionOverrides[d.name]);
      // Already-selected/overridden dishes bypass the diet filter — a
      // brand-new custom dish has no sales_meta yet, so dietForDish falls back
      // to the app default; on a non-veg menu that would otherwise silently
      // hide it from this exact list, which the section-grouping lookup
      // reads, vanishing the dish from every section even though it saved.
      var meta = salesMeta[d.name];
      var diet = dietForDish(d, meta);
      if (dietFilter !== 'all' && diet !== dietFilter && !isSel && !hasOverride) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      // noPackage: an LMS/custom event with no package at all has nothing to
      // distinguish "template" from "add-on" — show the full catalogue by
      // default instead of hiding everything behind showAddons.
      if (!noPackage && !inT && !isSel && !showAddons && !hasOverride) return false;
      return true;
    });
  }, [deptDishes, salesMeta, dietFilter, searchQ, templateSet, selectedSet, showAddons, noPackage, sectionOverrides]);

  var groupedByCat = useMemo(function(){
    var groups = {};
    visibleDishes.forEach(function(d){
      if (!groups[d.catId]) groups[d.catId] = { name: d.catName, icon: d.catIcon, dishes: [] };
      groups[d.catId].dishes.push(d);
    });
    var order = (RECIPE_DB.cats || []).map(function(c){ return c.id; });
    var sorted = order.filter(function(id){ return !!groups[id]; }).map(function(id){ return { id: id, ...groups[id] }; });
    Object.keys(groups).forEach(function(id){ if (order.indexOf(id) < 0) sorted.push({ id: id, ...groups[id] }); });
    return sorted;
  }, [visibleDishes]);

  // Group visible dishes by dish_catalogue_sections directly (no package).
  // Returns null when not applicable — caller falls back to groupedByCat.
  // Within each section: pinned block (template dishes in package order)
  // first, then rest sorted by sort_in_section (nullish last), then alpha.
  // Unassigned + phantom + orphaned dishes fall into an Extras bucket at the
  // bottom. Only top-level sections get their own pill; subsections pool into
  // it as subGroups (a parent's sort_order routinely lands numerically before
  // its own children's, so listing every row flat interleaved them wrongly).
  var groupedBySection = useMemo(function(){
    if (!sections || sections.length === 0) return null;
    var topSections = sections.filter(function(s){ return !s.parent_section_id && (s.sales_dept || 'kit') === activeDept; });
    if (topSections.length === 0) return null;

    var pkgOrder = {};
    (templateInfo.dishes || []).forEach(function(d, i){ pkgOrder[d] = i; });

    // A subsection counts here purely via its PARENT's dept, not its own
    // (usually unset) sales_dept.
    var validSectionIds = {};
    topSections.forEach(function(s){
      validSectionIds[s.id] = true;
      (catSubsByParent[s.id] || []).forEach(function(sub){ validSectionIds[sub.id] = true; });
    });

    var bySection = {};
    var extras = [];
    visibleDishes.forEach(function(d){
      if (d.section_id && validSectionIds[d.section_id]) {
        if (!bySection[d.section_id]) bySection[d.section_id] = [];
        bySection[d.section_id].push(d);
      } else {
        extras.push(d);
      }
    });

    function sortWithin(list) {
      var pinned = [];
      var rest = [];
      list.forEach(function(d){
        if (d.name in pkgOrder) pinned.push(d);
        else rest.push(d);
      });
      pinned.sort(function(a, b){ return pkgOrder[a.name] - pkgOrder[b.name]; });
      rest.sort(function(a, b){
        var sa = a.sort_in_section == null ? 999999 : a.sort_in_section;
        var sb = b.sort_in_section == null ? 999999 : b.sort_in_section;
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      });
      return pinned.concat(rest);
    }

    function iconFor(s) {
      if (!s.sop_category_hint) return '🍽';
      var cat = (RECIPE_DB.cats || []).find(function(c){
        return c.name === s.sop_category_hint || c.id === s.sop_category_hint;
      });
      return (cat && cat.icon) ? cat.icon : '🍽';
    }

    var out = [];
    topSections.forEach(function(s){
      var subs = catSubsByParent[s.id] || [];
      var direct = bySection[s.id] || [];
      var pooled = direct.slice();
      var subGroups = null;
      if (subs.length > 0) {
        subGroups = [];
        if (direct.length > 0) subGroups.push({ id: s.id, name: s.name, dishes: sortWithin(direct) });
        subs.forEach(function(sub){
          var subList = bySection[sub.id] || [];
          if (subList.length === 0) return;
          pooled = pooled.concat(subList);
          subGroups.push({ id: sub.id, name: sub.name, dishes: sortWithin(subList) });
        });
        if (subGroups.length === 0) subGroups = null;
      }
      if (pooled.length === 0) return; // skip empty sections
      out.push({ id: s.id, name: s.name, icon: iconFor(s), catSectionId: s.id, dishes: sortWithin(pooled), subGroups: subGroups });
    });
    if (extras.length > 0) {
      out.push({ id: '__extras__', name: 'Extras', icon: '✨', dishes: sortWithin(extras) });
    }
    return out;
  }, [activeDept, sections, visibleDishes, templateInfo.dishes, catSubsByParent]);

  // Same visibility rules as visibleDishes (diet filter, search, template/
  // selected/add-on visibility) but WITHOUT the per-dept restriction — needed
  // so a package section can be matched against its dishes regardless of
  // which dept TAB those dishes' own catalogue rows happen to route to. Which
  // dept tab a package section shows up under is a single explicit choice
  // (sec.sales_dept, set in the Packages tab) — not re-derived from the
  // catalogue here.
  var visibleDishesAnyDept = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return allDishes.concat(phantomDishes).filter(function(d){
      var inT = !!templateSet[d.name];
      var isSel = !!selectedSet[d.name];
      var hasOverride = !!(sectionOverrides && sectionOverrides[d.name]);
      var meta = salesMeta[d.name];
      var diet = dietForDish(d, meta);
      if (dietFilter !== 'all' && diet !== dietFilter && !isSel && !hasOverride) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      if (!inT && !isSel && !showAddons && !hasOverride) return false;
      return true;
    });
  }, [allDishes, phantomDishes, salesMeta, dietFilter, searchQ, templateSet, selectedSet, showAddons, sectionOverrides]);

  // Every catalogue dish (diet filter + search still apply, since those are
  // explicit choices) with NO template/selected/showAddons gate — a package-
  // linked section's browse list must show every alternative in that
  // catalogue section regardless of "Show add-ons", since browsing IS the
  // point of linking a section to the catalogue. "Show add-ons" still gates
  // truly unrelated catalogue dishes (the Extras bucket, via visibleDishes/
  // visibleDishesAnyDept above).
  var catalogueBrowsePool = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return allDishes.filter(function(d){
      var meta = salesMeta[d.name];
      var diet = dietForDish(d, meta);
      if (dietFilter !== 'all' && diet !== dietFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allDishes, salesMeta, dietFilter, searchQ]);

  // Group by the SELECTED PACKAGE's own sections (as configured in the
  // Packages tab) instead of the shared catalogue taxonomy directly — so
  // section NAMES, ORDER and dept routing (sec.sales_dept) always follow the
  // package, not the shared catalogue. But membership is browse-friendly:
  // when a section was built "From catalogue" (sec.catalogue_section_id set),
  // this shows the FULL catalogue section with the package's own subset
  // pinned first and already selected — so a package dish can be swapped for
  // any catalogue alternative without leaving the section. A section with no
  // catalogue link just shows its own dish list, same as before.
  // Returns null when the package has no sections overlay yet (legacy
  // packages), so the caller falls back to groupedBySection / groupedByCat.
  var groupedByPkgSection = useMemo(function(){
    var pkgSecs = templateInfo.name ? MENU_PACKAGE_SECTIONS[templateInfo.name] : null;
    if (!pkgSecs || pkgSecs.length === 0) return null;
    var qLower = (searchQ || '').trim().toLowerCase();

    var byExact = {};
    var byLoose = {};
    visibleDishesAnyDept.forEach(function(d){
      byExact[d.name] = d;
      var k = (d.name || '').toLowerCase().trim();
      if (!byLoose[k]) byLoose[k] = d;
    });
    var byCatSectionId = {};
    catalogueBrowsePool.forEach(function(d){
      if (d.section_id) { if (!byCatSectionId[d.section_id]) byCatSectionId[d.section_id] = []; byCatSectionId[d.section_id].push(d); }
    });
    var consumed = {};

    function iconFor(sopCat) {
      if (!sopCat) return '🍽';
      var cat = (RECIPE_DB.cats || []).find(function(c){ return c.name === sopCat || c.id === sopCat; });
      return (cat && cat.icon) ? cat.icon : '🍽';
    }
    function resolveOrSynth(name, sec) {
      var match = byExact[name] || byLoose[(name || '').toLowerCase().trim()];
      if (match) {
        // Clear any stale phantom flag from the old catalogue-diff check —
        // this dish's identity is the package's own name, shown normally here.
        return match.isPhantom ? { ...match, catName: sec.name, catIcon: iconFor(sec.sop_category), isPhantom: false } : match;
      }
      return { name: name, hindi: '', catId: 'other', catName: sec.name, catIcon: iconFor(sec.sop_category),
        image: '', notes: '', section_id: null, sort_in_section: null };
    }

    function pinnedRest(dishList, pkgDishNames) {
      var pinned = [], rest = [];
      dishList.forEach(function(d){ (pkgDishNames.indexOf(d.name) >= 0 ? pinned : rest).push(d); });
      pinned.sort(function(a, b){ return pkgDishNames.indexOf(a.name) - pkgDishNames.indexOf(b.name); });
      rest.sort(function(a, b){
        var sa = a.sort_in_section == null ? 999999 : a.sort_in_section;
        var sb = b.sort_in_section == null ? 999999 : b.sort_in_section;
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      });
      return pinned.concat(rest);
    }

    var out = [];
    pkgSecs.forEach(function(sec){
      if ((sec.sales_dept || 'kit') !== activeDept) return; // this section is assigned to a different dept tab
      var pkgDishNames = (sec.dishes || []).filter(Boolean);
      var directCatDishes = sec.catalogue_section_id ? byCatSectionId[sec.catalogue_section_id] : null;
      // The linked catalogue section may itself have subsections (Dish
      // Library → Sections), each holding its own slice of the full catalogue
      // list. Pool ALL of them, grouped by subsection, instead of only
      // whatever's directly on the parent row — otherwise a fully-
      // subsectioned catalogue section (0 dishes of its own) resolves to
      // nothing to browse at all.
      var catSubs = sec.catalogue_section_id ? (catSubsByParent[sec.catalogue_section_id] || []) : [];

      var list;
      var subGroups = null;
      if (catSubs.length > 0) {
        subGroups = [];
        var allCatDishes = (directCatDishes || []).slice();
        if (directCatDishes && directCatDishes.length > 0) {
          subGroups.push({ id: sec.catalogue_section_id, name: sec.name, dishes: pinnedRest(directCatDishes, pkgDishNames) });
        }
        catSubs.forEach(function(sub){
          var subDishes = byCatSectionId[sub.id] || [];
          if (subDishes.length === 0) return;
          allCatDishes = allCatDishes.concat(subDishes);
          subGroups.push({ id: sub.id, name: sub.name, dishes: pinnedRest(subDishes, pkgDishNames) });
        });
        var foundInSubs = {};
        allCatDishes.forEach(function(d){ foundInSubs[d.name] = true; });
        var missingFromSubs = pkgDishNames.filter(function(n){ return !foundInSubs[n]; }).map(function(n){ return resolveOrSynth(n, sec); });
        if (missingFromSubs.length > 0) subGroups.unshift({ id: sec.id + '__unplaced', name: T2('Other'), dishes: missingFromSubs });
        if (subGroups.length === 0) subGroups = null;
        list = missingFromSubs.concat(allCatDishes);
      } else if (directCatDishes && directCatDishes.length > 0) {
        // Package dish names that don't exist among this catalogue section's
        // own dishes (name mismatch, or added to the package from elsewhere)
        // — resolve or synthesize them too, so the package's own count is
        // never short.
        var foundNames = {};
        directCatDishes.forEach(function(d){ foundNames[d.name] = true; });
        var missing = pkgDishNames.filter(function(n){ return !foundNames[n]; }).map(function(n){ return resolveOrSynth(n, sec); });
        list = missing.concat(pinnedRest(directCatDishes, pkgDishNames));
      } else {
        list = pkgDishNames.map(function(name){ return resolveOrSynth(name, sec); });
      }

      // resolveOrSynth fills in any package dish name missing from the
      // (already search-filtered) catalogue pool by SYNTHESIZING a phantom
      // entry for it — right for a genuinely uncatalogued dish, wrong when
      // the real reason it's missing is that the search query filtered it
      // out. Without this, searching narrowed nothing within a section: none
      // of its OTHER dishes matched the catalogue pool either, and all got
      // synthesized back in regardless of the query.
      if (qLower) {
        var matchesQ = function(d){ return d.name.toLowerCase().includes(qLower) || (d.hindi || '').toLowerCase().includes(qLower); };
        list = list.filter(matchesQ);
        if (subGroups) {
          subGroups = subGroups.map(function(sg){ return { ...sg, dishes: sg.dishes.filter(matchesQ) }; }).filter(function(sg){ return sg.dishes.length > 0; });
          if (subGroups.length === 0) subGroups = null;
        }
      }

      if (list.length === 0) return;
      list.forEach(function(d){ consumed[d.name] = true; });
      // The package section's own id is meaningless to the catalogue; this is
      // the link the pill grouping (catalogueTree) reads.
      out.push({ id: sec.id, name: sec.name, icon: iconFor(sec.sop_category), catSectionId: sec.catalogue_section_id || null, dishes: list, subGroups: subGroups });
    });
    if (out.length === 0) return null;

    // "Extras" is itself a selectable placement pill (so a custom dish can be
    // explicitly tagged there instead of a real section), but it used to only
    // get built at the very end from whatever's left unconsumed. An override
    // tagged to '__extras__' ran BEFORE that existed, so it fell through to
    // newGroups and spawned a SECOND, colliding "Extras" pill (duplicate id —
    // one hid the other). Build it once, up front, so the override pass below
    // places straight into the same bucket leftovers use.
    var extrasGroup = { id: '__extras__', name: 'Extras', icon: '✨', dishes: [] };
    out.push(extrasGroup);

    // A custom dish (or a whole library section added ad hoc), tagged
    // per-proposal/per-event via sectionOverrides, points at a group/subGroup
    // id that may already exist above — place it there instead of leaving it
    // for Extras. A tag pointing at neither (a whole catalogue section added
    // ad hoc that isn't part of this package) gets its OWN new pill named
    // after that catalogue section, rather than silently falling into Extras.
    // A tag's target can be a package-section id, a catalogue section id, or
    // a catalogue subsection id — all three carry (or inherit) a sales_dept,
    // and a tag whose dept doesn't match the tab being viewed must be fully
    // skipped here (not just left unplaced), or it leaks into every OTHER
    // dept tab too as a stray pill labelled with its raw id.
    function deptForTargetId(rawId) {
      var id = rawId.indexOf('__unplaced') >= 0 ? rawId.slice(0, rawId.indexOf('__unplaced')) : rawId;
      var ps = pkgSecs.find(function(s){ return s.id === id; });
      if (ps) return ps.sales_dept || 'kit';
      var cs = sections.find(function(s){ return s.id === id; });
      if (cs) {
        if (cs.sales_dept) return cs.sales_dept;
        var parent = cs.parent_section_id ? sections.find(function(s){ return s.id === cs.parent_section_id; }) : null;
        return (parent && parent.sales_dept) || 'kit';
      }
      return null;
    }

    // '__extras__' (an explicit "place in Extras" choice) and any other
    // target with no dept of its own carry no department info at all — fall
    // back to the dish's OWN native dept (visibleDishes is already scoped to
    // activeDept) so it only ever shows under the one tab it actually
    // belongs to, not every tab.
    var visibleDeptSet = {};
    visibleDishes.forEach(function(d){ visibleDeptSet[d.name] = true; });

    var newGroups = {}; // targetId -> group, built once, appended after
    Object.keys(sectionOverrides || {}).forEach(function(name){
      if (consumed[name]) return;
      var targetId = sectionOverrides[name];
      if (!targetId) return;
      var targetDept = deptForTargetId(targetId);
      if (targetDept) {
        if (targetDept !== activeDept) return; // belongs to a different department tab entirely
      } else if (!visibleDeptSet[name]) {
        return; // no dept info from the target itself — dish isn't native to this tab
      }
      var d = byExact[name] || byLoose[(name || '').toLowerCase().trim()];
      if (!d) return; // not currently visible (filtered by search/diet/showAddons)
      var placed = out.some(function(g){
        if (g.subGroups) {
          var sg = g.subGroups.find(function(x){ return x.id === targetId; });
          if (sg) { sg.dishes = sg.dishes.concat([d]); return true; }
          if (g.id === targetId) {
            // Target IS this group, but it renders via subGroups only (a flat
            // g.dishes push would be invisible) — give it a shared "Other"
            // bucket, same id convention the pooling above already uses.
            var other = g.subGroups.find(function(x){ return x.id === g.id + '__unplaced'; });
            if (!other) { other = { id: g.id + '__unplaced', name: T2('Other'), dishes: [] }; g.subGroups.push(other); }
            other.dishes = other.dishes.concat([d]);
            return true;
          }
          return false;
        }
        if (g.id === targetId) { g.dishes = g.dishes.concat([d]); return true; }
        return false;
      });
      if (placed) { consumed[name] = true; return; }
      if (!newGroups[targetId]) {
        var opt = (catalogueSectionOptions || []).find(function(o){ return o.id === targetId; });
        // A whole catalogue section added ad hoc can itself have subsections;
        // pool the same subGroups shape the main package-section loop above
        // builds, bucketing each tagged dish by its own catalogue section_id,
        // instead of one flat unlabeled list.
        var subs = catSubsByParent[targetId] || [];
        var subGroupsNew = subs.length > 0
          ? subs.map(function(sub){ return { id: sub.id, name: sub.name, dishes: [] }; }).concat([{ id: targetId + '__unplaced', name: T2('Other'), dishes: [] }])
          : null;
        // targetId IS a catalogue section id here, so an ad-hoc section nests
        // under its library parent like any other.
        newGroups[targetId] = { id: targetId, name: opt ? opt.label.replace(/^—\s*/, '') : targetId, icon: '📚', catSectionId: targetId, dishes: [], subGroups: subGroupsNew, isAdHoc: true };
      }
      var ng = newGroups[targetId];
      ng.dishes.push(d);
      if (ng.subGroups) {
        var destSg = ng.subGroups.find(function(sg2){ return sg2.id === d.section_id; }) || ng.subGroups[ng.subGroups.length - 1];
        destSg.dishes.push(d);
      }
      consumed[name] = true;
    });
    Object.keys(newGroups).forEach(function(id){
      var g = newGroups[id];
      if (g.subGroups) { g.subGroups = g.subGroups.filter(function(sg){ return sg.dishes.length > 0; }); if (g.subGroups.length === 0) g.subGroups = null; }
      out.push(g);
    });

    // A dish tagged to a section in a DIFFERENT department (e.g. an
    // unclassified custom dish, natively visible here by default, but tagged
    // to a Fruits-dept section) already renders correctly under its tag's own
    // dept tab — it must not also leak into THIS dept's Extras just because
    // its fallback native dept happens to be the one showing.
    var leftover = visibleDishes.filter(function(d){
      if (consumed[d.name]) return false;
      var ov = sectionOverrides && sectionOverrides[d.name];
      if (ov) {
        var ovDept = deptForTargetId(ov);
        if (ovDept && ovDept !== activeDept) return false;
      }
      return true;
    });
    extrasGroup.dishes = extrasGroup.dishes.concat(leftover);
    if (extrasGroup.dishes.length === 0) out.splice(out.indexOf(extrasGroup), 1);
    return out;
  }, [templateInfo.name, visibleDishesAnyDept, catalogueBrowsePool, visibleDishes, activeDept, catSubsByParent, T2, sectionOverrides, catalogueSectionOptions, sections, searchQ]);

  var resolvedGrouping = groupedByPkgSection || groupedBySection || groupedByCat;

  return {
    allDishes: allDishes,
    allDishesByName: allDishesByName,
    templateSet: templateSet,
    selectedSet: selectedSet,
    focSet: focSet,
    phantomDishes: phantomDishes,
    sectionSalesDeptMap: sectionSalesDeptMap,
    sectionAddonPriceMap: sectionAddonPriceMap,
    catSubsByParent: catSubsByParent,
    catalogueSectionOptions: catalogueSectionOptions,
    dishNameToPkgDept: dishNameToPkgDept,
    sectionOverrideDept: sectionOverrideDept,
    deptCounts: deptCounts,
    deptAddonTotal: deptAddonTotal,
    grandTotal: grandTotal,
    deptDishes: deptDishes,
    templateDishesInDept: templateDishesInDept,
    visibleDishes: visibleDishes,
    visibleDishesAnyDept: visibleDishesAnyDept,
    catalogueBrowsePool: catalogueBrowsePool,
    groupedByCat: groupedByCat,
    groupedBySection: groupedBySection,
    groupedByPkgSection: groupedByPkgSection,
    catalogueTree: catalogueTree,
    resolvedGrouping: resolvedGrouping,
  };
}
