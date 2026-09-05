// Ambria FnB — Menu Builder View (Sales)
// V70 Phase 3: Kitchen dept Items tab fully functional; other 6 depts placeholders.
// Place in: src/components/MenuBuilderView.jsx

import React, { useState, useEffect, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES, MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';
import { detectPackageDiet } from '../utils/helpers.js';
import { getAllDishes, getCatIdForDish, RECIPE_DB, resolveDishHindi } from '../data/recipeData.js';
import { SALES_DEPTS, SALES_DEPT_MAP, ITEM_HAVING_DEPTS, DIET_TAGS, DEFAULT_DIET, DEFAULT_DEPT, DEPT_CONFIGS } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import ConfigsPanel from './ConfigsPanel.jsx';
import TotalPanel from './TotalPanel.jsx';
import MenuBuilderPreview from './MenuBuilderPreview.jsx';

export function MenuBuilderView({ proposal, onClose, lang = "en", currentUser = null }) {
  var T2 = function(s) { return T(s, lang); };

  var [activeDept, setActiveDept]   = useState('kit');
  var [activeSubTab, setActiveSubTab] = useState('items'); // 'items' | 'configs' | 'total'
  var [showPreview, setShowPreview] = useState(false);
  var [dishItems, setDishItems]     = useState([]);        // proposal_items rows
  var [salesMeta, setSalesMeta]     = useState({});        // { [dish_name]: {diet_tag, sales_dept, sales_description, hero_image_url} }
  var [loading, setLoading]         = useState(true);
  var [seeding, setSeeding]         = useState(false);
  var [searchQ, setSearchQ]         = useState('');
  var [dietFilter, setDietFilter]   = useState('all');
  var [showAddons, setShowAddons]   = useState(false);

  // ── Per-active-dept capability flags ──
  var hasItems   = ITEM_HAVING_DEPTS.indexOf(activeDept) >= 0;
  var hasConfigs = !!(DEPT_CONFIGS[activeDept] && DEPT_CONFIGS[activeDept].length > 0);

  // ── Template dishes: resolved from proposal.tier_package_id via live pkg id→name map ──
  // V71 — tier concept removed; diet is auto-detected from package name.
  // V74 — pkgVer bump forces re-fetch of id→name map and re-eval of templateInfo
  // whenever the Packages tab writes (fires 'ambria:menu-packages-refreshed').
  var [pkgIdToName, setPkgIdToName] = useState({});
  var [pkgVer, setPkgVer] = useState(0);
  // V76: whether the id→name map has resolved at least once. The seed-on-open
  // effect below MUST wait for this — otherwise it reads templateInfo.dishes on
  // the very first render (before this fetch resolves), sees an empty list, and
  // permanently marks the proposal as "initialized" with zero items seeded.
  var [pkgMapLoaded, setPkgMapLoaded] = useState(false);
  useEffect(function(){
    var h = function(){ setPkgVer(function(v){ return v + 1; }); };
    window.addEventListener('ambria:menu-packages-refreshed', h);
    return function(){ window.removeEventListener('ambria:menu-packages-refreshed', h); };
  }, []);
  useEffect(function(){
    (async function(){
      try {
        var res = await supabase.from('menu_packages').select('id,name').eq('is_active', true);
        if (res.error) { console.warn('[MenuBuilder] pkg id map load failed:', res.error); return; }
        var m = {};
        (res.data || []).forEach(function(r){ m[r.id] = r.name; });
        setPkgIdToName(m);
      } catch(e){ console.warn('[MenuBuilder] pkg id map err:', e); }
      finally { setPkgMapLoaded(true); }
    })();
  }, [pkgVer]);
  var templateInfo = useMemo(function(){
    if (!proposal || !proposal.tier_package_id) return { name: null, dishes: [], diet: null };
    var name = pkgIdToName[proposal.tier_package_id] || null;
    if (!name) return { name: null, dishes: [], diet: null };
    return { name: name, dishes: MENU_PACKAGES[name] || [], diet: detectPackageDiet(name) };
  }, [proposal, pkgIdToName, pkgVer]);

  var templateSet = useMemo(function(){
    var s = {}; templateInfo.dishes.forEach(function(d){ s[d] = true; }); return s;
  }, [templateInfo.dishes]);

  // ── All dishes (from dishes_master via getAllDishes) ──
  var allDishes = useMemo(function(){
    var raw = getAllDishes ? getAllDishes({ includeInactive: false }) : [];
    // Enrich each dish with resolved category + hindi + section metadata
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
      };
    });
  }, []);

  // ── V72/V73: dish_catalogue_sections (all depts) ──
  // Fetched once on mount. Each section may carry a sales_dept override that routes
  // its dishes to a specific Menu Builder sidebar tab. Null override defaults to 'kit'.
  var [sections, setSections] = useState([]);
  useEffect(function(){
    var cancelled = false;
    (async function(){
      try {
        var rows = await fetchAllRows(function(){
          return supabase.from('dish_catalogue_sections')
            .select('id, name, sort_order, sop_category_hint, sales_dept, dept')
            .order('sort_order', { ascending: true });
        });
        if (!cancelled) setSections(rows || []);
      } catch (e) {
        console.warn('[MenuBuilder] sections load failed, falling back to cat grouping:', e);
      }
    })();
    return function(){ cancelled = true; };
  }, []);

  // V73: sectionId → effective sales_dept (override or 'kit' default)
  var sectionSalesDeptMap = useMemo(function(){
    var m = {};
    sections.forEach(function(s){ m[s.id] = s.sales_dept || 'kit'; });
    return m;
  }, [sections]);

  // ── V72 Phase 2: phantom dishes ──
  // Template dishes NOT present in dishes_master. Render in Extras with ⚠ so
  // sales can see catalogue mismatches without losing the pre-seeded proposal item.
  // V75 — dept-agnostic now (also feeds visibleDishesAnyDept for package-section
  // grouping); the kit-only restriction moved to deptDishes, its only other consumer.
  var phantomDishes = useMemo(function(){
    if (!templateInfo.dishes || templateInfo.dishes.length === 0) return [];
    var nameSet = {};
    allDishes.forEach(function(d){ nameSet[d.name] = true; });
    return templateInfo.dishes
      .filter(function(name){ return !nameSet[name]; })
      .map(function(name){
        return {
          name:            name,
          hindi:           '',
          catId:           'other',
          catName:         'Extras',
          catIcon:         '⚠',
          image:           '',
          notes:           '',
          section_id:      null,
          sort_in_section: null,
          isPhantom:       true,
        };
      });
  }, [allDishes, templateInfo.dishes]);

  // ── Load sales_items_meta ──
  async function loadSalesMeta() {
    try {
      var res = await supabase.from('sales_items_meta').select('*');
      if (res.error) throw res.error;
      var m = {};
      (res.data || []).forEach(function(r){
        m[r.dish_name] = {
          diet_tag:          r.diet_tag || DEFAULT_DIET,
          sales_dept:        r.sales_dept || DEFAULT_DEPT,
          sales_description: r.sales_description || '',
          hero_image_url:    r.hero_image_url || '',
        };
      });
      setSalesMeta(m);
    } catch (e) {
      console.error('[MenuBuilder] loadSalesMeta failed:', e);
      setSalesMeta({});
    }
  }

  // ── Load proposal_items ──
  async function loadItems() {
    if (!proposal || !proposal.id) return;
    try {
      var res = await supabase.from('proposal_items').select('*').eq('proposal_id', proposal.id);
      if (res.error) throw res.error;
      return res.data || [];
    } catch (e) {
      console.error('[MenuBuilder] loadItems failed:', e);
      return [];
    }
  }

  // ── First-open template seeder ──
  async function seedTemplateIfNeeded() {
    if (!proposal || !proposal.id) return [];
    // Refetch to make sure we have the current flag (proposals state can be stale)
    var propRes = await supabase.from('proposals').select('menu_initialized').eq('id', proposal.id).single();
    if (propRes.error) throw propRes.error;
    if (propRes.data.menu_initialized) return await loadItems(); // already seeded, just load

    // Load existing items to be safe
    var existing = await loadItems();
    if (existing.length > 0) {
      // Items already present — mark initialized and bail
      await supabase.from('proposals').update({ menu_initialized: true }).eq('id', proposal.id);
      return existing;
    }

    // No items yet + not initialized + template has dishes → seed
    if (templateInfo.dishes.length === 0) {
      // Nothing to seed (no template picked), still mark initialized so we don't retry
      await supabase.from('proposals').update({ menu_initialized: true }).eq('id', proposal.id);
      return [];
    }

    setSeeding(true);
    try {
      var rows = templateInfo.dishes.map(function(d, i){
        return { proposal_id: proposal.id, dish_name: d, is_addon: false, ordering: i };
      });
      var ins = await supabase.from('proposal_items').insert(rows).select();
      if (ins.error) throw ins.error;
      await supabase.from('proposals').update({ menu_initialized: true }).eq('id', proposal.id);
      return ins.data || [];
    } finally {
      setSeeding(false);
    }
  }

  useEffect(function(){
    if (!pkgMapLoaded) return; // wait for templateInfo to reflect the real package before seeding decides there's nothing to seed
    var cancelled = false;
    async function boot(){
      setLoading(true);
      try {
        await loadSalesMeta();
        var items = await seedTemplateIfNeeded();
        if (!cancelled) setDishItems(items || []);
      } catch (e) {
        console.error('[MenuBuilder] boot failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    boot();
    return function(){ cancelled = true; };
  // eslint-disable-next-line
  }, [proposal && proposal.id, pkgMapLoaded]);

  // ── Realtime for proposal_items on this proposal ──
  useEffect(function(){
    if (!proposal || !proposal.id) return;
    var chan = supabase.channel('pitems_rt_' + proposal.id)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'proposal_items', filter: 'proposal_id=eq.' + proposal.id },
        function(payload){
          if (payload.eventType === 'INSERT' && payload.new) {
            setDishItems(function(prev){ if (prev.some(function(x){return x.dish_name===payload.new.dish_name;})) return prev; return prev.concat([payload.new]); });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setDishItems(function(prev){ return prev.filter(function(x){ return x.dish_name !== payload.old.dish_name; }); });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setDishItems(function(prev){ return prev.map(function(x){ return x.dish_name === payload.new.dish_name ? payload.new : x; }); });
          }
        })
      .subscribe();
    return function(){ supabase.removeChannel(chan); };
  }, [proposal && proposal.id]);

  // ── Selection lookups ──
  var selectedSet = useMemo(function(){
    var s = {}; dishItems.forEach(function(x){ s[x.dish_name] = true; }); return s;
  }, [dishItems]);

  // ── Toggle dish: insert or delete ──
  async function toggleDish(dishName) {
    var isSelected = !!selectedSet[dishName];
    var inTemplate = !!templateSet[dishName];
    if (isSelected) {
      // Optimistic remove
      setDishItems(function(prev){ return prev.filter(function(x){ return x.dish_name !== dishName; }); });
      try {
        var res = await supabase.from('proposal_items').delete().eq('proposal_id', proposal.id).eq('dish_name', dishName);
        if (res.error) throw res.error;
      } catch (e) {
        console.error('[MenuBuilder] toggle-off failed:', e);
        // Rollback
        await loadItems().then(setDishItems);
        alert(T2('Failed to remove dish:') + ' ' + (e.message || e));
      }
    } else {
      var row = { proposal_id: proposal.id, dish_name: dishName, is_addon: !inTemplate, ordering: dishItems.length };
      // Optimistic add
      setDishItems(function(prev){ return prev.concat([row]); });
      try {
        var res2 = await supabase.from('proposal_items').insert(row).select().single();
        if (res2.error) throw res2.error;
        setDishItems(function(prev){ return prev.map(function(x){ return x.dish_name === dishName ? res2.data : x; }); });
      } catch (e) {
        console.error('[MenuBuilder] toggle-on failed:', e);
        await loadItems().then(setDishItems);
        alert(T2('Failed to add dish:') + ' ' + (e.message || e));
      }
    }
  }

  // V76: manual re-seed — recovers proposals stuck with 0 selected because
  // seedTemplateIfNeeded's one-shot auto-seed fired before pkgMapLoaded resolved
  // (a pre-existing race, now fixed above, but already-affected proposals were
  // permanently marked menu_initialized with nothing seeded). Also just generally
  // useful as a "bring back anything from the package I removed" action — only
  // ever ADDS missing template dishes, never touches existing selections.
  async function loadPackageDefaults() {
    if (!proposal || !proposal.id || templateInfo.dishes.length === 0 || seeding) return;
    var have = {};
    dishItems.forEach(function(x){ have[x.dish_name] = true; });
    var toAdd = templateInfo.dishes.filter(function(d){ return !have[d]; });
    if (toAdd.length === 0) { alert(T2('All package dishes are already selected.')); return; }
    setSeeding(true);
    try {
      var rows = toAdd.map(function(d, i){ return { proposal_id: proposal.id, dish_name: d, is_addon: false, ordering: dishItems.length + i }; });
      var ins = await supabase.from('proposal_items').insert(rows).select();
      if (ins.error) throw ins.error;
      setDishItems(function(prev){ return prev.concat(ins.data || []); });
      await supabase.from('proposals').update({ menu_initialized: true }).eq('id', proposal.id);
    } catch (e) {
      console.error('[MenuBuilder] loadPackageDefaults failed:', e);
      alert(T2('Failed to load package defaults:') + ' ' + (e.message || e));
    } finally {
      setSeeding(false);
    }
  }

  // ── Selected counts per dept ──
  var deptCounts = useMemo(function(){
    var counts = {};
    SALES_DEPTS.forEach(function(d){ counts[d.id] = { sel: 0, total: 0 }; });
    var counted = {};
    allDishes.forEach(function(d){
      var meta = salesMeta[d.name];
      var dept = (meta && meta.sales_dept) || DEFAULT_DEPT;
      if (!counts[dept]) counts[dept] = { sel: 0, total: 0 };
      counts[dept].total += 1;
      if (selectedSet[d.name]) counts[dept].sel += 1;
      counted[d.name] = true;
    });
    // V74 — Phantoms: selected dishes not present in the catalogue (retired,
    // renamed, or template-only names never added to dishes_master). Attribute
    // them to their saved dept or DEFAULT_DEPT so the sidebar sel badge is honest.
    Object.keys(selectedSet).forEach(function(name){
      if (counted[name]) return;
      var meta = salesMeta[name];
      var dept = (meta && meta.sales_dept) || DEFAULT_DEPT;
      if (!counts[dept]) counts[dept] = { sel: 0, total: 0 };
      counts[dept].sel += 1;
    });
    return counts;
  }, [allDishes, salesMeta, selectedSet]);

  // ── Dishes for active dept ──
  // V73: effective dept = section's sales_dept override (if dish is in a routed section)
  // else dish's own meta.sales_dept else DEFAULT_DEPT ('kit').
  var deptDishes = useMemo(function(){
    var base = allDishes.filter(function(d){
      var override = d.section_id ? sectionSalesDeptMap[d.section_id] : null;
      var meta = salesMeta[d.name];
      var dept = override || (meta && meta.sales_dept) || DEFAULT_DEPT;
      return dept === activeDept;
    });
    if (activeDept === 'kit' && phantomDishes.length > 0) {
      return base.concat(phantomDishes);
    }
    return base;
  }, [allDishes, salesMeta, activeDept, phantomDishes, sectionSalesDeptMap]);

  // ── Template dishes scoped to active dept ──
  var templateDishesInDept = useMemo(function(){
    return templateInfo.dishes.filter(function(name){
      var meta = salesMeta[name];
      var dept = (meta && meta.sales_dept) || DEFAULT_DEPT;
      return dept === activeDept;
    });
  }, [templateInfo.dishes, salesMeta, activeDept]);

  // ── Diet-annotated + filtered + searched ──
  var visibleDishes = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return deptDishes.filter(function(d){
      var meta = salesMeta[d.name];
      var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
      if (dietFilter !== 'all' && diet !== dietFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      // Hide dishes that aren't in template AND aren't selected, unless showAddons is true
      var inT = !!templateSet[d.name];
      var isSel = !!selectedSet[d.name];
      if (!inT && !isSel && !showAddons) return false;
      return true;
    });
  }, [deptDishes, salesMeta, dietFilter, searchQ, templateSet, selectedSet, showAddons]);

  // ── Group visible dishes by category ──
  var groupedByCat = useMemo(function(){
    var groups = {};
    visibleDishes.forEach(function(d){
      if (!groups[d.catId]) groups[d.catId] = { name: d.catName, icon: d.catIcon, dishes: [] };
      groups[d.catId].dishes.push(d);
    });
    // Sort by RECIPE_DB.cats order
    var order = (RECIPE_DB.cats || []).map(function(c){ return c.id; });
    var sorted = order.filter(function(id){ return !!groups[id]; }).map(function(id){ return { id: id, ...groups[id] }; });
    // Append any groups not in the cats order (e.g., 'other')
    Object.keys(groups).forEach(function(id){ if (order.indexOf(id) < 0) sorted.push({ id: id, ...groups[id] }); });
    return sorted;
  }, [visibleDishes]);

  // ── V72 Phase 2: group visible dishes by dish_catalogue_sections (kitchen only) ──
  // Returns null when not applicable — caller falls back to groupedByCat.
  // Within each section: pinned block (template dishes in package order) first, then rest.
  // Rest sorted by sort_in_section (nullish last), then alphabetical.
  // Unassigned + phantom + orphaned dishes fall into an Extras bucket at the bottom.
  var groupedBySection = useMemo(function(){
    if (!sections || sections.length === 0) return null;
    // V73: only include sections whose effective sales_dept matches activeDept.
    var deptSections = sections.filter(function(s){ return (s.sales_dept || 'kit') === activeDept; });
    if (deptSections.length === 0) return null;

    // Package dish → order index (for pinned block ordering)
    var pkgOrder = {};
    (templateInfo.dishes || []).forEach(function(d, i){ pkgOrder[d] = i; });

    // Valid section id set (dishes with section_id not in this set fall to Extras)
    var validSectionIds = {};
    deptSections.forEach(function(s){ validSectionIds[s.id] = true; });

    // Bucket
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

    // Resolve section icon from sop_category_hint (via RECIPE_DB.cats lookup)
    function iconFor(s) {
      if (!s.sop_category_hint) return '🍽';
      var cat = (RECIPE_DB.cats || []).find(function(c){
        return c.name === s.sop_category_hint || c.id === s.sop_category_hint;
      });
      return (cat && cat.icon) ? cat.icon : '🍽';
    }

    var out = [];
    deptSections.forEach(function(s){
      var list = bySection[s.id] || [];
      if (list.length === 0) return; // skip empty sections
      out.push({ id: s.id, name: s.name, icon: iconFor(s), dishes: sortWithin(list) });
    });
    if (extras.length > 0) {
      out.push({ id: '__extras__', name: 'Extras', icon: '✨', dishes: sortWithin(extras) });
    }
    return out;
  }, [activeDept, sections, visibleDishes, templateInfo.dishes]);

  // ── V75: same visibility rules as visibleDishes (diet filter, search, template/
  // selected/add-on visibility) but WITHOUT the per-dept restriction — needed so a
  // package section can be matched against its dishes regardless of which dept tab
  // those dishes' own catalogue rows happen to route to. Which dept TAB a package
  // section shows up under is now a single explicit choice (sec.sales_dept, set in
  // the Packages tab) — not re-derived from the catalogue.
  var visibleDishesAnyDept = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return allDishes.concat(phantomDishes).filter(function(d){
      var meta = salesMeta[d.name];
      var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
      if (dietFilter !== 'all' && diet !== dietFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      var inT = !!templateSet[d.name];
      var isSel = !!selectedSet[d.name];
      if (!inT && !isSel && !showAddons) return false;
      return true;
    });
  }, [allDishes, phantomDishes, salesMeta, dietFilter, searchQ, templateSet, selectedSet, showAddons]);

  // ── V76: every catalogue dish (diet filter + search still apply, since those are
  // explicit choices) with NO template/selected/showAddons gate — a package-linked
  // section's browse list must show every alternative in that catalogue section
  // regardless of "Show add-ons", since browsing IS the point of linking a section
  // to the catalogue. "Show add-ons" still gates truly unrelated catalogue dishes
  // (the Extras bucket, via visibleDishes/visibleDishesAnyDept above).
  var catalogueBrowsePool = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return allDishes.filter(function(d){
      var meta = salesMeta[d.name];
      var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
      if (dietFilter !== 'all' && diet !== dietFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allDishes, salesMeta, dietFilter, searchQ]);

  // ── V76: group by the SELECTED PACKAGE's own sections (as configured in the
  // Packages tab) instead of the shared catalogue taxonomy directly — so section
  // NAMES, ORDER and dept routing (sec.sales_dept) always follow the package, not
  // the shared catalogue. But membership is browse-friendly: when a section was
  // built "From catalogue" (sec.catalogue_section_id set), sales sees the FULL
  // catalogue section (e.g. all 6 Refreshing Station dishes) with the package's own
  // subset (e.g. 2) pinned first and already selected (seedTemplateIfNeeded handles
  // the actual pre-selection) — so they can swap in any catalogue alternative
  // without leaving the section. A section with no catalogue link (hand-built, or
  // a dish typed in with no catalogue row) just shows its own dish list, same as
  // before — there's no broader set to browse from.
  // Returns null when the package has no sections overlay yet (legacy packages),
  // so the caller falls back to groupedBySection / groupedByCat.
  var groupedByPkgSection = useMemo(function(){
    var pkgSecs = templateInfo.name ? MENU_PACKAGE_SECTIONS[templateInfo.name] : null;
    if (!pkgSecs || pkgSecs.length === 0) return null;

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
        // Clear any stale phantom flag from the old catalogue-diff check — this
        // dish's identity is the package's own name, shown normally here.
        return match.isPhantom ? { ...match, catName: sec.name, catIcon: iconFor(sec.sop_category), isPhantom: false } : match;
      }
      return { name: name, hindi: '', catId: 'other', catName: sec.name, catIcon: iconFor(sec.sop_category),
        image: '', notes: '', section_id: null, sort_in_section: null };
    }

    var out = [];
    pkgSecs.forEach(function(sec){
      if ((sec.sales_dept || 'kit') !== activeDept) return; // this section is assigned to a different dept tab
      var pkgDishNames = (sec.dishes || []).filter(Boolean);
      var catDishes = sec.catalogue_section_id ? byCatSectionId[sec.catalogue_section_id] : null;

      var list;
      if (catDishes && catDishes.length > 0) {
        var pkgNameSet = {};
        pkgDishNames.forEach(function(n){ pkgNameSet[n] = true; });
        var pinned = [], rest = [];
        catDishes.forEach(function(d){ (pkgNameSet[d.name] ? pinned : rest).push(d); });
        pinned.sort(function(a, b){ return pkgDishNames.indexOf(a.name) - pkgDishNames.indexOf(b.name); });
        rest.sort(function(a, b){
          var sa = a.sort_in_section == null ? 999999 : a.sort_in_section;
          var sb = b.sort_in_section == null ? 999999 : b.sort_in_section;
          if (sa !== sb) return sa - sb;
          return a.name.localeCompare(b.name);
        });
        // Package dish names that don't exist among this catalogue section's own
        // dishes (name mismatch, or added to the package from elsewhere) — resolve
        // or synthesize them too, so the package's own count is never short.
        var foundNames = {};
        catDishes.forEach(function(d){ foundNames[d.name] = true; });
        var missing = pkgDishNames.filter(function(n){ return !foundNames[n]; }).map(function(n){ return resolveOrSynth(n, sec); });
        list = missing.concat(pinned).concat(rest);
      } else {
        list = pkgDishNames.map(function(name){ return resolveOrSynth(name, sec); });
      }

      if (list.length === 0) return;
      list.forEach(function(d){ consumed[d.name] = true; });
      out.push({ id: sec.id, name: sec.name, icon: iconFor(sec.sop_category), dishes: list });
    });
    if (out.length === 0) return null;

    var leftover = visibleDishes.filter(function(d){ return !consumed[d.name]; });
    if (leftover.length > 0) {
      out.push({ id: '__extras__', name: 'Extras', icon: '✨', dishes: leftover });
    }
    return out;
  }, [templateInfo.name, visibleDishesAnyDept, catalogueBrowsePool, visibleDishes, activeDept]);

  // ── RENDER ──
  // V71 — diet chip replaces tier badge
  var dietMeta = templateInfo.diet
    ? {
        color: templateInfo.diet === 'nonveg' ? '#A52828' : '#2A7A48',
        bg:    templateInfo.diet === 'nonveg' ? '#FAE5E5' : '#E5F5EA',
        label: templateInfo.diet === 'nonveg' ? '🍗 Non-Veg' : '🥬 Veg',
      }
    : null;

  // Preview takes over the viewport when open
  if (showPreview) {
    return (
      <MenuBuilderPreview
        proposal={proposal}
        dishItems={dishItems}
        salesMeta={salesMeta}
        templateInfo={templateInfo}
        onClose={function(){ setShowPreview(false); }}
        lang={lang}
        currentUser={currentUser}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      {/* ── Top bar ── */}
      <div style={{ flexShrink: 0, background: C.surface, borderBottom: "1px solid " + C.border, padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", boxShadow: "0 1px 3px " + C.shadow }}>
        <button onClick={onClose}
          style={{ padding: "8px 14px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ← {T2("Back to proposals")}
        </button>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>
            🍽 {T2("Menu for")} <span style={{ color: C.gold || "#D4A843" }}>{proposal.guest_name}</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {(proposal.event_type || T2("Event")) + " · " + (proposal.venue || '—') + (proposal.event_date ? ' · ' + proposal.event_date : '') + (proposal.pax ? ' · ' + proposal.pax + ' pax' : '')}
            {templateInfo.name && (
              <>
                {' · '}
                {dietMeta && (
                  <span style={{ padding: "1px 6px", borderRadius: 3, background: dietMeta.bg, color: dietMeta.color, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", marginRight: 4 }}>{dietMeta.label}</span>
                )}
                {templateInfo.name}
              </>
            )}
          </div>
        </div>
        <button onClick={function(){ setShowPreview(true); }}
          disabled={dishItems.length === 0}
          title={dishItems.length === 0 ? T2("Add items first before previewing") : T2("Open client preview")}
          style={{ padding: "8px 16px", borderRadius: 8, background: "#8A70C8", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: dishItems.length === 0 ? "not-allowed" : "pointer", opacity: dishItems.length === 0 ? 0.55 : 1, boxShadow: "0 1px 3px " + C.shadow }}>
          👁 {T2("Preview")}
        </button>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Dept sidebar ── */}
        <div style={{ flexShrink: 0, width: 200, background: C.surface, borderRight: "1px solid " + C.border, padding: "12px 8px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, padding: "6px 10px", marginBottom: 4 }}>
            {T2("Departments")}
          </div>
          {SALES_DEPTS.map(function(d){
            var isActive = activeDept === d.id;
            var counts = deptCounts[d.id] || { sel: 0, total: 0 };
            var deptHasItems   = ITEM_HAVING_DEPTS.indexOf(d.id) >= 0;
            var deptHasConfigs = !!(DEPT_CONFIGS[d.id] && DEPT_CONFIGS[d.id].length > 0);
            var isFunctional   = deptHasItems || deptHasConfigs; // Phase 5A: kit/bev/bak/frt (items) + bev/svc (configs so far)
            return (
              <button key={d.id} onClick={function(){
                  setActiveDept(d.id);
                  // Default to Items sub-tab if this dept has items, otherwise Configs
                  setActiveSubTab(deptHasItems ? 'items' : 'configs');
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "10px 12px", marginBottom: 3, borderRadius: 8,
                  background: isActive ? d.bg : "transparent",
                  border: "1px solid " + (isActive ? d.color : "transparent"),
                  color: C.text, fontSize: 13, fontWeight: isActive ? 700 : 500,
                  cursor: "pointer", textAlign: "left",
                  opacity: isFunctional ? 1 : 0.75,
                }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }}></span>
                <span style={{ flex: 1 }}>{d.icon} {d.name}</span>
                {isFunctional && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: counts.sel > 0 ? d.color : C.muted, background: isActive ? "#fff" : C.bg, padding: "2px 6px", borderRadius: 10 }}>
                    {counts.sel}
                  </span>
                )}
                {!isFunctional && (
                  <span style={{ fontSize: 9, color: C.muted, fontStyle: "italic" }}>{T2("soon")}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Main area ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading && (
            <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{seeding ? '🌱' : '⏳'}</div>
              <div style={{ fontSize: 13 }}>{seeding ? T2("Seeding template dishes…") : T2("Loading menu builder…")}</div>
            </div>
          )}

          {!loading && (hasItems || hasConfigs) && (
            <div>
              <SubTabStrip
                T2={T2}
                activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab}
                hasItems={hasItems} hasConfigs={hasConfigs}
                totalSel={(deptCounts[activeDept] || {}).sel || 0}
              />

              {hasItems && activeSubTab === 'items' && (
                <ItemsTab
                  T2={T2}
                  activeDept={activeDept}
                  searchQ={searchQ} setSearchQ={setSearchQ}
                  dietFilter={dietFilter} setDietFilter={setDietFilter}
                  showAddons={showAddons} setShowAddons={setShowAddons}
                  deptDishes={deptDishes}
                  groupedByCat={groupedByPkgSection || groupedBySection || groupedByCat}
                  templateSet={templateSet}
                  selectedSet={selectedSet}
                  salesMeta={salesMeta}
                  onToggle={toggleDish}
                  templateInfo={templateInfo}
                  templateDishesInDept={templateDishesInDept}
                  deptCounts={deptCounts[activeDept]}
                  onLoadDefaults={loadPackageDefaults}
                  seeding={seeding}
                />
              )}

              {hasConfigs && activeSubTab === 'configs' && (
                <ConfigsPanel
                  proposal={proposal}
                  activeDept={activeDept}
                  lang={lang}
                />
              )}

              {activeSubTab === 'total' && (
                <TotalPanel
                  proposal={proposal}
                  activeDept={activeDept}
                  dishItems={dishItems}
                  salesMeta={salesMeta}
                  templateInfo={templateInfo}
                  lang={lang}
                />
              )}
            </div>
          )}

          {!loading && !hasItems && !hasConfigs && (
            <ComingSoonPlaceholder T2={T2} dept={SALES_DEPT_MAP[activeDept]} />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ITEMS TAB — works for any item-having dept (kit/bev/bak/frt)
// ═══════════════════════════════════════════════════════════════
function ItemsTab({ T2, activeDept, setActiveDept, searchQ, setSearchQ, dietFilter, setDietFilter, showAddons, setShowAddons, deptDishes, groupedByCat, templateSet, selectedSet, salesMeta, onToggle, templateInfo, templateDishesInDept, deptCounts, allDeptCounts, onLoadDefaults, seeding }) {
  var totalSel = deptCounts ? deptCounts.sel : 0;
  var templateCountInDept = templateDishesInDept ? templateDishesInDept.length : 0;
  var deptTotal = deptCounts ? deptCounts.total : 0;
  var addonsAvailable = Math.max(0, deptTotal - templateCountInDept);

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input value={searchQ} onChange={function(e){ setSearchQ(e.target.value); }}
          placeholder={T2("Search dish…")}
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />

        {/* Diet chips */}
        <div style={{ display: "flex", gap: 4 }}>
          <DietChip active={dietFilter === 'all'} onClick={function(){ setDietFilter('all'); }} color={C.muted} label={T2("All")} />
          {DIET_TAGS.map(function(dt){
            return <DietChip key={dt.id} active={dietFilter === dt.id} onClick={function(){ setDietFilter(dt.id); }} color={dt.color} label={dt.icon + ' ' + dt.label} />;
          })}
        </div>

        {/* Show add-ons toggle */}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, background: showAddons ? "#EADFF5" : C.surface, border: "1px solid " + (showAddons ? "#8A70C8" : C.border), fontSize: 12, fontWeight: 600, color: showAddons ? "#5A3EA0" : C.text, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={showAddons} onChange={function(e){ setShowAddons(e.target.checked); }}
            style={{ margin: 0, cursor: "pointer" }} />
          {T2("Show add-ons")}
        </label>
      </div>

      {/* Template summary bar (per-dept scoped counts) */}
      {templateInfo.name && (
        <div style={{ padding: "10px 14px", marginBottom: 14, borderRadius: 10, background: C.bg, border: "1px solid " + C.border, fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>📋 <b style={{ color: C.text }}>{templateInfo.name}</b> · {templateCountInDept} {T2("template dishes in this dept")} <span style={{ opacity: 0.7 }}>({templateInfo.dishes.length} {T2("total")})</span></span>
          {onLoadDefaults && (
            <button onClick={onLoadDefaults} disabled={!!seeding}
              title={T2("Add any package dish not already selected — never removes or duplicates existing selections")}
              style={{ padding: "4px 10px", borderRadius: 7, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontWeight: 600, cursor: seeding ? "wait" : "pointer" }}>
              {seeding ? T2("Loading…") : "↺ " + T2("Load package defaults")}
            </button>
          )}
          <span style={{ marginLeft: "auto" }}>
            ✓ {totalSel} {T2("selected")} · ✨ {addonsAvailable} {T2("add-ons available")}
          </span>
        </div>
      )}

      {/* Category groups */}
      {groupedByCat.length === 0 && (function(){
        // V74 — If empty on this dept but the user has selections elsewhere,
        // send them to the busiest dept so they don't feel lost. Otherwise
        // fall back to the standard filter / add-on hint.
        var elsewhere = (allDeptCounts ? SALES_DEPTS : []).filter(function(d){
          return d.id !== activeDept && ITEM_HAVING_DEPTS.indexOf(d.id) >= 0 && (allDeptCounts[d.id] || {}).sel > 0;
        }).sort(function(a, b){ return (allDeptCounts[b.id].sel || 0) - (allDeptCounts[a.id].sel || 0); });
        var top = elsewhere[0];
        var elsewhereTotal = elsewhere.reduce(function(n, d){ return n + (allDeptCounts[d.id].sel || 0); }, 0);
        return (
          <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted, background: C.surface, borderRadius: 12, border: "1px dashed " + C.border }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{top ? '📌' : '🔍'}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {top ? T2("Nothing selected in this department") : T2("No dishes match")}
            </div>
            <div style={{ fontSize: 12 }}>
              {top
                ? (elsewhereTotal + ' ' + T2("selected in") + ' ' + top.label + (elsewhere.length > 1 ? ' ' + T2("and others") : ''))
                : (!showAddons && templateInfo.name
                    ? T2("Enable Show add-ons to browse the full catalogue.")
                    : T2("Try clearing filters or search."))}
            </div>
            {top && setActiveDept && (
              <button onClick={function(){ setActiveDept(top.id); }}
                style={{ marginTop: 12, padding: "6px 14px", borderRadius: 6, background: C.surface, border: "1px solid " + C.wine, color: C.wine, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {T2("Go to")} {top.label} →
              </button>
            )}
          </div>
        );
      })()}

      {groupedByCat.map(function(grp){
        return (
          <div key={grp.id} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, padding: "0 2px" }}>
              {grp.icon} {grp.name} <span style={{ color: C.muted, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· {grp.dishes.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {grp.dishes.map(function(d){
                var inT = !!templateSet[d.name];
                var isSel = !!selectedSet[d.name];
                var meta = salesMeta[d.name];
                var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
                var dietMeta = DIET_TAGS.find(function(x){ return x.id === diet; });
                var desc = (meta && meta.sales_description) || '';
                var img = (meta && meta.hero_image_url) || d.image || '';

                var borderStyle;
                var bg;
                if (inT && isSel)      { borderStyle = "1.5px solid #2A7A48"; bg = "#F0F9F3"; }
                else if (inT && !isSel){ borderStyle = "1px solid " + C.border; bg = C.surface; }
                else if (!inT && isSel){ borderStyle = "1.5px dashed #8A70C8"; bg = "#F8F4FC"; }
                else                    { borderStyle = "1px dashed " + C.border; bg = C.surface; }

                return (
                  <button key={d.name} onClick={function(){ onToggle(d.name); }}
                    style={{
                      position: "relative", padding: 0, borderRadius: 10,
                      background: bg, border: borderStyle,
                      cursor: "pointer", textAlign: "left", overflow: "hidden",
                      transition: "transform 0.08s ease",
                    }}>
                    {/* ADD-ON badge */}
                    {!inT && isSel && !d.isPhantom && (
                      <span style={{ position: "absolute", top: 6, left: 6, zIndex: 2, padding: "1px 6px", borderRadius: 4, background: "#8A70C8", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
                        ADD-ON
                      </span>
                    )}
                    {/* PHANTOM badge — dish in package but not in catalogue */}
                    {d.isPhantom && (
                      <span title="Not in dish catalogue — edit in Dish Library"
                        style={{ position: "absolute", top: 6, left: 6, zIndex: 2, padding: "1px 6px", borderRadius: 4, background: "#D4A843", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
                        ⚠ NO CAT
                      </span>
                    )}
                    {/* Checkbox */}
                    <span style={{
                      position: "absolute", top: 6, right: 6, zIndex: 2,
                      width: 22, height: 22, borderRadius: 5,
                      background: isSel ? (inT ? "#2A7A48" : "#8A70C8") : "rgba(255,255,255,0.9)",
                      border: "1.5px solid " + (isSel ? (inT ? "#2A7A48" : "#8A70C8") : "#BBB"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                    }}>
                      {isSel ? "✓" : ""}
                    </span>

                    {/* Image area */}
                    <div style={{ height: 90, background: img ? "transparent" : "#EEE", backgroundImage: img ? "url(" + img + ")" : "none", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {!img && <span style={{ fontSize: 32, opacity: 0.4 }}>{d.catIcon}</span>}
                    </div>

                    {/* Text area */}
                    <div style={{ padding: "8px 10px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        {dietMeta && (
                          <span style={{ fontSize: 10, color: dietMeta.color }} title={dietMeta.label}>{dietMeta.icon}</span>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, lineHeight: 1.25, wordBreak: "break-word" }}>{d.name}</span>
                      </div>
                      {desc && <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.3, marginTop: 2 }}>{desc.length > 60 ? desc.slice(0, 58) + '…' : desc}</div>}
                      {!desc && d.hindi && <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>{d.hindi}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMING SOON PLACEHOLDER (non-Kitchen depts)
// ═══════════════════════════════════════════════════════════════
function ComingSoonPlaceholder({ T2, dept }) {
  if (!dept) return null;
  return (
    <div style={{ padding: "60px 20px", textAlign: "center", background: C.surface, borderRadius: 14, border: "1px dashed " + C.border }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{dept.icon}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", marginBottom: 6 }}>
        {dept.name} — {T2("Phase 5")}
      </div>
      <div style={{ fontSize: 13, color: C.muted, maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>
        {T2("Service, Crockery, and Transport are configuration-only departments (no items to pick). Their config tabs — glassware, ratios, vehicles, uniforms — ship in Phase 5.")}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Small UI bits
// ═══════════════════════════════════════════════════════════════
function SubTab({ label, active, disabled, title, onClick }) {
  var style = {
    padding: "10px 14px", background: "transparent", border: "none",
    borderBottom: "2.5px solid " + (active ? (C.gold || "#D4A843") : "transparent"),
    color: active ? C.text : (disabled ? C.muted : C.text),
    fontSize: 13, fontWeight: active ? 700 : 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    marginBottom: -1,
  };
  return <button style={style} disabled={disabled} title={title || ''} onClick={onClick}>{label}</button>;
}

function SubTabStrip({ T2, activeSubTab, setActiveSubTab, hasItems, hasConfigs, totalSel }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid " + C.border }}>
      {hasItems && (
        <SubTab
          label={"🍛 " + T2("Items") + (totalSel > 0 ? " · " + totalSel : '')}
          active={activeSubTab === 'items'}
          onClick={function(){ setActiveSubTab('items'); }}
        />
      )}
      {hasConfigs && (
        <SubTab
          label={"⚙ " + T2("Configs")}
          active={activeSubTab === 'configs'}
          onClick={function(){ setActiveSubTab('configs'); }}
        />
      )}
      <SubTab
        label={"📊 " + T2("Total")}
        active={activeSubTab === 'total'}
        onClick={function(){ setActiveSubTab('total'); }}
      />
    </div>
  );
}

function DietChip({ active, onClick, color, label }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "6px 10px", borderRadius: 16,
        background: active ? color : "transparent",
        border: "1px solid " + (active ? color : "#DDD"),
        color: active ? "#fff" : color,
        fontSize: 11, fontWeight: 700, cursor: "pointer",
      }}>{label}</button>
  );
}

export default MenuBuilderView;