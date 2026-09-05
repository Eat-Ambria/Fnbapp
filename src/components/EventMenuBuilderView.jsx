// Ambria FnB — Event Menu Builder View (Sales, Booked Functions)
// V78: same multi-dept item-picking UI as the Proposal builder (MenuBuilderView.jsx),
// pointed at an already-booked event instead of a draft proposal. Items live in
// event_items (mirrors proposal_items); kitchen-dept selections are also mirrored
// into events.menu so Kitchen Hub's existing production planning keeps working
// unchanged. Place in: src/components/EventMenuBuilderView.jsx

import React, { useState, useEffect, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES, MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';
import { detectPackageDiet } from '../utils/helpers.js';
import { getAllDishes, getCatIdForDish, RECIPE_DB, resolveDishHindi } from '../data/recipeData.js';
import { SALES_DEPTS, SALES_DEPT_MAP, ITEM_HAVING_DEPTS, DIET_TAGS, DEFAULT_DIET, DEFAULT_DEPT, DEPT_CONFIGS } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import { ItemsTab, DietChip, ComingSoonPlaceholder } from './MenuBuilderView.jsx';
import { FunctionPlanTab } from './FunctionPlanTab.jsx';
import { FunctionPlanPrintView } from './FunctionPlanPrintView.jsx';

export function EventMenuBuilderView({ event, onClose, lang = "en", currentUser = null }) {
  var T2 = function(s) { return T(s, lang); };

  var [activeDept, setActiveDept]   = useState('kit');
  var [activeSubTab, setActiveSubTab] = useState('items'); // 'items' | 'fp'
  var [dishItems, setDishItems]     = useState([]);        // event_items rows
  var [salesMeta, setSalesMeta]     = useState({});
  var [loading, setLoading]         = useState(true);
  var [seeding, setSeeding]         = useState(false);
  var [searchQ, setSearchQ]         = useState('');
  var [dietFilter, setDietFilter]   = useState('all');
  var [showAddons, setShowAddons]   = useState(false);
  // V78 — Function Plan (food preference, spice tolerance, allergies, notes)
  var [fp, setFp]                   = useState(null);
  var [showFPPrint, setShowFPPrint] = useState(false);

  var hasItems = ITEM_HAVING_DEPTS.indexOf(activeDept) >= 0;

  // ── Template dishes: resolved directly from event.menu_package (a name, not an
  // id — events store the package name straight on the row). No stale-catalogue
  // race like proposals had (that only existed because of the id→name lookup). ──
  var [pkgVer, setPkgVer] = useState(0);
  useEffect(function(){
    var h = function(){ setPkgVer(function(v){ return v + 1; }); };
    window.addEventListener('ambria:menu-packages-refreshed', h);
    return function(){ window.removeEventListener('ambria:menu-packages-refreshed', h); };
  }, []);
  var templateInfo = useMemo(function(){
    var raw = event && (event.menu_package || event.menuPackage) || null;
    var name = raw && MENU_PACKAGES[raw] ? raw : null;
    if (!name) return { name: null, dishes: [], diet: null };
    return { name: name, dishes: MENU_PACKAGES[name] || [], diet: detectPackageDiet(name) };
  // eslint-disable-next-line
  }, [event, pkgVer]);

  var templateSet = useMemo(function(){
    var s = {}; templateInfo.dishes.forEach(function(d){ s[d] = true; }); return s;
  }, [templateInfo.dishes]);

  // ── All dishes (from dishes_master via getAllDishes) ──
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
      };
    });
  }, []);
  var allDishesByName = useMemo(function(){
    var m = {}; allDishes.forEach(function(d){ m[d.name] = d; }); return m;
  }, [allDishes]);

  // ── dish_catalogue_sections (all depts) ──
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
        console.warn('[EventMenuBuilder] sections load failed, falling back to cat grouping:', e);
      }
    })();
    return function(){ cancelled = true; };
  }, []);

  var sectionSalesDeptMap = useMemo(function(){
    var m = {};
    sections.forEach(function(s){ m[s.id] = s.sales_dept || 'kit'; });
    return m;
  }, [sections]);

  // ── Phantom dishes: template dishes not present in dishes_master ──
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
      console.error('[EventMenuBuilder] loadSalesMeta failed:', e);
      setSalesMeta({});
    }
  }

  // ── Load event_items ──
  async function loadItems() {
    if (!event || !event.id) return [];
    try {
      var res = await supabase.from('event_items').select('*').eq('event_id', event.id);
      if (res.error) throw res.error;
      return res.data || [];
    } catch (e) {
      console.error('[EventMenuBuilder] loadItems failed:', e);
      return [];
    }
  }

  // ── First-open seeder: migrate the event's existing flat `menu` array (kitchen
  // dishes only, same as it's always been) into event_items, once. ──
  async function seedFromLegacyMenuIfNeeded() {
    if (!event || !event.id) return [];
    var evRes = await supabase.from('events').select('event_items_initialized, menu').eq('id', event.id).single();
    if (evRes.error) throw evRes.error;
    if (evRes.data.event_items_initialized) return await loadItems();

    var existing = await loadItems();
    if (existing.length > 0) {
      await supabase.from('events').update({ event_items_initialized: true }).eq('id', event.id);
      return existing;
    }

    var legacyMenu = Array.isArray(evRes.data.menu) ? evRes.data.menu.filter(Boolean) : [];
    if (legacyMenu.length === 0) {
      await supabase.from('events').update({ event_items_initialized: true }).eq('id', event.id);
      return [];
    }

    setSeeding(true);
    try {
      var rows = legacyMenu.map(function(d, i){ return { event_id: event.id, dish_name: d, is_addon: false, ordering: i }; });
      var ins = await supabase.from('event_items').insert(rows).select();
      if (ins.error) throw ins.error;
      await supabase.from('events').update({ event_items_initialized: true }).eq('id', event.id);
      return ins.data || [];
    } finally {
      setSeeding(false);
    }
  }

  useEffect(function(){
    var cancelled = false;
    async function boot(){
      setLoading(true);
      try {
        await loadSalesMeta();
        var items = await seedFromLegacyMenuIfNeeded();
        if (!cancelled) setDishItems(items || []);
      } catch (e) {
        console.error('[EventMenuBuilder] boot failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    boot();
    return function(){ cancelled = true; };
  // eslint-disable-next-line
  }, [event && event.id]);

  // ── Realtime for event_items on this event ──
  useEffect(function(){
    if (!event || !event.id) return;
    var chan = supabase.channel('eitems_rt_' + event.id)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_items', filter: 'event_id=eq.' + event.id },
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
  }, [event && event.id]);

  var selectedSet = useMemo(function(){
    var s = {}; dishItems.forEach(function(x){ s[x.dish_name] = true; }); return s;
  }, [dishItems]);

  // dish name → its PACKAGE section's own sales_dept (authoritative — see MenuBuilderView.jsx)
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

  function effectiveDeptForDish(name) {
    var d = allDishesByName[name];
    var override = d && d.section_id ? sectionSalesDeptMap[d.section_id] : null;
    var meta = salesMeta[name];
    return dishNameToPkgDept[name] || override || (meta && meta.sales_dept) || DEFAULT_DEPT;
  }

  // Kitchen Hub's entire production pipeline reads events.menu as a flat kitchen
  // dish list — keep it in perfect sync so nothing there needs to change.
  async function mirrorKitchenMenu(items) {
    var kitchenNames = items.filter(function(x){ return effectiveDeptForDish(x.dish_name) === 'kit'; }).map(function(x){ return x.dish_name; });
    try {
      await supabase.from('events').update({ menu: kitchenNames }).eq('id', event.id);
    } catch (e) {
      console.error('[EventMenuBuilder] mirrorKitchenMenu failed:', e);
    }
  }

  // ── V78: Function Plan (event_function_plans, one row per event) ──
  useEffect(function(){
    if (!event || !event.id) return;
    var cancelled = false;
    (async function(){
      try {
        var res = await supabase.from('event_function_plans').select('*').eq('event_id', event.id).maybeSingle();
        if (res.error) throw res.error;
        if (!cancelled) setFp(res.data || { event_id: event.id });
      } catch (e) {
        console.error('[EventMenuBuilder] load FP failed:', e);
        if (!cancelled) setFp({ event_id: event.id });
      }
    })();
    return function(){ cancelled = true; };
  }, [event && event.id]);

  // Kitchen Hub's D-1 planning already scans events.special for dietary keywords
  // (jain, no onion, nut-free, gluten...) — mirror the FP's text fields into it so
  // that existing detection picks up whatever sales captures here, unchanged.
  async function mirrorFPToEvent(fpRow) {
    var parts = [];
    if (fpRow.spice_tolerance) parts.push('Spice: ' + fpRow.spice_tolerance);
    if (fpRow.allergies) parts.push('Allergies: ' + fpRow.allergies);
    if (fpRow.service_notes) parts.push('Service: ' + fpRow.service_notes);
    if (fpRow.general_notes) parts.push('Notes: ' + fpRow.general_notes);
    var payload = { special: parts.length ? parts.join(' | ') : null };
    if (fpRow.veg_count != null) payload.veg = fpRow.veg_count;
    if (fpRow.nonveg_count != null) payload.nonveg = fpRow.nonveg_count;
    try {
      await supabase.from('events').update(payload).eq('id', event.id);
    } catch (e) {
      console.error('[EventMenuBuilder] mirrorFPToEvent failed:', e);
    }
  }

  async function saveFPField(field, value) {
    var next = { ...(fp || { event_id: event.id }), [field]: value };
    setFp(next);
    try {
      var res = await supabase.from('event_function_plans').upsert(next, { onConflict: 'event_id' }).select().single();
      if (res.error) throw res.error;
      setFp(res.data);
      await mirrorFPToEvent(res.data);
    } catch (e) {
      console.error('[EventMenuBuilder] saveFPField failed:', e);
      alert(T2('Failed to save:') + ' ' + (e.message || e));
    }
  }

  // ── All selected dish names grouped by effective dept, for the printable FP ──
  var itemsByDept = useMemo(function(){
    var out = {};
    SALES_DEPTS.forEach(function(d){ out[d.id] = []; });
    dishItems.forEach(function(x){
      var dept = effectiveDeptForDish(x.dish_name);
      if (!out[dept]) out[dept] = [];
      out[dept].push(x.dish_name);
    });
    return out;
  // eslint-disable-next-line
  }, [dishItems, dishNameToPkgDept, allDishesByName, sectionSalesDeptMap, salesMeta]);

  // ── Toggle dish: insert or delete in event_items, mirror kitchen dept to events.menu ──
  async function toggleDish(dishName) {
    var isSelected = !!selectedSet[dishName];
    var inTemplate = !!templateSet[dishName];
    var dept = effectiveDeptForDish(dishName);
    if (isSelected) {
      var nextItems = dishItems.filter(function(x){ return x.dish_name !== dishName; });
      setDishItems(nextItems);
      try {
        var res = await supabase.from('event_items').delete().eq('event_id', event.id).eq('dish_name', dishName);
        if (res.error) throw res.error;
        if (dept === 'kit') await mirrorKitchenMenu(nextItems);
      } catch (e) {
        console.error('[EventMenuBuilder] toggle-off failed:', e);
        await loadItems().then(setDishItems);
        alert(T2('Failed to remove dish:') + ' ' + (e.message || e));
      }
    } else {
      var row = { event_id: event.id, dish_name: dishName, is_addon: !inTemplate, ordering: dishItems.length };
      var nextItems2 = dishItems.concat([row]);
      setDishItems(nextItems2);
      try {
        var res2 = await supabase.from('event_items').insert(row).select().single();
        if (res2.error) throw res2.error;
        var finalItems = nextItems2.map(function(x){ return x.dish_name === dishName ? res2.data : x; });
        setDishItems(finalItems);
        if (dept === 'kit') await mirrorKitchenMenu(finalItems);
      } catch (e) {
        console.error('[EventMenuBuilder] toggle-on failed:', e);
        await loadItems().then(setDishItems);
        alert(T2('Failed to add dish:') + ' ' + (e.message || e));
      }
    }
  }

  // Only ever ADDS missing package dishes — never removes or duplicates existing selections.
  async function loadPackageDefaults() {
    if (!event || !event.id || templateInfo.dishes.length === 0 || seeding) return;
    var have = {};
    dishItems.forEach(function(x){ have[x.dish_name] = true; });
    var toAdd = templateInfo.dishes.filter(function(d){ return !have[d]; });
    if (toAdd.length === 0) { alert(T2('All package dishes are already selected.')); return; }
    setSeeding(true);
    try {
      var rows = toAdd.map(function(d, i){ return { event_id: event.id, dish_name: d, is_addon: false, ordering: dishItems.length + i }; });
      var ins = await supabase.from('event_items').insert(rows).select();
      if (ins.error) throw ins.error;
      var nextItems = dishItems.concat(ins.data || []);
      setDishItems(nextItems);
      await supabase.from('events').update({ event_items_initialized: true }).eq('id', event.id);
      await mirrorKitchenMenu(nextItems);
    } catch (e) {
      console.error('[EventMenuBuilder] loadPackageDefaults failed:', e);
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
      var dept = dishNameToPkgDept[d.name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      if (!counts[dept]) counts[dept] = { sel: 0, total: 0 };
      counts[dept].total += 1;
      if (selectedSet[d.name]) counts[dept].sel += 1;
      counted[d.name] = true;
    });
    Object.keys(selectedSet).forEach(function(name){
      if (counted[name]) return;
      var meta = salesMeta[name];
      var dept = dishNameToPkgDept[name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      if (!counts[dept]) counts[dept] = { sel: 0, total: 0 };
      counts[dept].sel += 1;
    });
    return counts;
  }, [allDishes, salesMeta, selectedSet, dishNameToPkgDept]);

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

  var templateDishesInDept = useMemo(function(){
    return templateInfo.dishes.filter(function(name){
      var meta = salesMeta[name];
      var dept = dishNameToPkgDept[name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      return dept === activeDept;
    });
  }, [templateInfo.dishes, salesMeta, activeDept, dishNameToPkgDept]);

  var visibleDishes = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return deptDishes.filter(function(d){
      var meta = salesMeta[d.name];
      var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
      if (dietFilter !== 'all' && diet !== dietFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      var inT = !!templateSet[d.name];
      var isSel = !!selectedSet[d.name];
      if (!inT && !isSel && !showAddons) return false;
      return true;
    });
  }, [deptDishes, salesMeta, dietFilter, searchQ, templateSet, selectedSet, showAddons]);

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

  var groupedBySection = useMemo(function(){
    if (!sections || sections.length === 0) return null;
    var deptSections = sections.filter(function(s){ return (s.sales_dept || 'kit') === activeDept; });
    if (deptSections.length === 0) return null;

    var pkgOrder = {};
    (templateInfo.dishes || []).forEach(function(d, i){ pkgOrder[d] = i; });

    var validSectionIds = {};
    deptSections.forEach(function(s){ validSectionIds[s.id] = true; });

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
    deptSections.forEach(function(s){
      var list = bySection[s.id] || [];
      if (list.length === 0) return;
      out.push({ id: s.id, name: s.name, icon: iconFor(s), dishes: sortWithin(list) });
    });
    if (extras.length > 0) {
      out.push({ id: '__extras__', name: 'Extras', icon: '✨', dishes: sortWithin(extras) });
    }
    return out;
  }, [activeDept, sections, visibleDishes, templateInfo.dishes]);

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
        return match.isPhantom ? { ...match, catName: sec.name, catIcon: iconFor(sec.sop_category), isPhantom: false } : match;
      }
      return { name: name, hindi: '', catId: 'other', catName: sec.name, catIcon: iconFor(sec.sop_category),
        image: '', notes: '', section_id: null, sort_in_section: null };
    }

    var out = [];
    pkgSecs.forEach(function(sec){
      if ((sec.sales_dept || 'kit') !== activeDept) return;
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

  var dietMeta = templateInfo.diet
    ? {
        color: templateInfo.diet === 'nonveg' ? '#A52828' : '#2A7A48',
        bg:    templateInfo.diet === 'nonveg' ? '#FAE5E5' : '#E5F5EA',
        label: templateInfo.diet === 'nonveg' ? '🍗 Non-Veg' : '🥬 Veg',
      }
    : null;

  if (showFPPrint) {
    return (
      <FunctionPlanPrintView
        event={event}
        fp={fp}
        itemsByDept={itemsByDept}
        onClose={function(){ setShowFPPrint(false); }}
        T2={T2}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      {/* ── Top bar ── */}
      <div style={{ flexShrink: 0, background: C.surface, borderBottom: "1px solid " + C.border, padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", boxShadow: "0 1px 3px " + C.shadow }}>
        <button onClick={onClose}
          style={{ padding: "8px 14px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ← {T2("Back to Booked Functions")}
        </button>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>
            🍽 {T2("Menu for")} <span style={{ color: C.gold || "#D4A843" }}>{event.guest || T2("Function")}</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {(event.type || T2("Event")) + " · " + (event.venue || '—') + (event.date ? ' · ' + event.date : '') + (event.pax ? ' · ' + event.pax + ' pax' : '')}
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
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={function(){ setActiveSubTab('items'); }}
            style={{ padding: "8px 14px", borderRadius: 8, background: activeSubTab === 'items' ? C.wine : C.surface, border: "1px solid " + (activeSubTab === 'items' ? C.wine : C.border), color: activeSubTab === 'items' ? "#fff" : C.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            🍛 {T2("Items")}
          </button>
          <button onClick={function(){ setActiveSubTab('fp'); }}
            style={{ padding: "8px 14px", borderRadius: 8, background: activeSubTab === 'fp' ? C.wine : C.surface, border: "1px solid " + (activeSubTab === 'fp' ? C.wine : C.border), color: activeSubTab === 'fp' ? "#fff" : C.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            📋 {T2("FP")}
          </button>
        </div>
      </div>

      {activeSubTab === 'fp' && (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {loading ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 13 }}>{T2("Loading…")}</div>
            </div>
          ) : (
            <FunctionPlanTab T2={T2} fp={fp} onSaveField={saveFPField} onOpenPrint={function(){ setShowFPPrint(true); }} />
          )}
        </div>
      )}

      {/* ── Body: sidebar + main ── */}
      {activeSubTab === 'items' && (
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Dept sidebar ── */}
        <div style={{ flexShrink: 0, width: 200, background: C.surface, borderRight: "1px solid " + C.border, padding: "12px 8px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, padding: "6px 10px", marginBottom: 4 }}>
            {T2("Departments")}
          </div>
          {SALES_DEPTS.map(function(d){
            var isActive = activeDept === d.id;
            var counts = deptCounts[d.id] || { sel: 0, total: 0 };
            var deptHasItems = ITEM_HAVING_DEPTS.indexOf(d.id) >= 0;
            var isFunctional = deptHasItems;
            return (
              <button key={d.id} onClick={function(){ setActiveDept(d.id); }}
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
              <div style={{ fontSize: 13 }}>{seeding ? T2("Loading existing menu…") : T2("Loading menu builder…")}</div>
            </div>
          )}

          {!loading && hasItems && (
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

          {!loading && !hasItems && (
            <ComingSoonPlaceholder T2={T2} dept={SALES_DEPT_MAP[activeDept]} />
          )}
        </div>

        {/* ── Live totals — mirrors the left sidebar's badges ── */}
        <div style={{ flexShrink: 0, width: 190, background: C.surface, borderLeft: "1px solid " + C.border, padding: "12px 10px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, padding: "6px 4px", marginBottom: 4 }}>
            🧾 {T2("Live total")}
          </div>
          {SALES_DEPTS.map(function(d){
            var counts = deptCounts[d.id] || { sel: 0, total: 0 };
            var deptHasItems = ITEM_HAVING_DEPTS.indexOf(d.id) >= 0;
            if (!deptHasItems) return null;
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }}></span>
                <span style={{ flex: 1, fontSize: 12, color: C.text }}>{d.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: counts.sel > 0 ? d.color : C.faint }}>{counts.sel}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px 6px", marginTop: 6, borderTop: "1px solid " + C.border }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text }}>{T2("Total items")}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
              {SALES_DEPTS.reduce(function(sum, d){ return sum + ((deptCounts[d.id] || {}).sel || 0); }, 0)}
            </span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

export default EventMenuBuilderView;
