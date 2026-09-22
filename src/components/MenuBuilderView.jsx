// Ambria FnB — Menu Builder View (Sales)
// V70 Phase 3: Kitchen dept Items tab fully functional; other 6 depts placeholders.
// Place in: src/components/MenuBuilderView.jsx

import React, { useState, useEffect, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES, MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';
import { detectPackageDiet } from '../utils/helpers.js';
import { getAllDishes, getCatIdForDish, RECIPE_DB, resolveDishHindi, createCustomDishInLibrary } from '../data/recipeData.js';
import { SALES_DEPTS, SALES_DEPT_MAP, ITEM_HAVING_DEPTS, DIET_TAGS, DEFAULT_DIET, DEFAULT_DEPT, DEPT_CONFIGS } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import ConfigsPanel from './ConfigsPanel.jsx';
import MenuBuilderPreview from './MenuBuilderPreview.jsx';
import { K, type } from '../utils/theme.js';
import { ripple } from '../utils/ripple.js';
import { Icon } from './Icons.jsx';
import { KButton, KToast } from './KitchenUI.jsx';

export function MenuBuilderView({ proposal, onClose, lang = "en", currentUser = null }) {
  var T2 = function(s) { return T(s, lang); };

  var [activeDept, setActiveDept]   = useState('kit');
  var [activeSubTab, setActiveSubTab] = useState('items'); // 'items' | 'configs' | 'total'
  var [showPreview, setShowPreview] = useState(false);
  // The live-total rail starts closed on every visit. It is a reference the
  // user reaches for now and then, not something they read while picking
  // dishes, and open by default it takes 232px off the grid permanently.
  var [railOpen, setRailOpen] = useState(false);
  var [dishItems, setDishItems]     = useState([]);        // proposal_items rows
  var [salesMeta, setSalesMeta]     = useState({});        // { [dish_name]: {diet_tag, sales_dept, sales_description, hero_image_url} }
  var [loading, setLoading]         = useState(true);
  var [seeding, setSeeding]         = useState(false);
  var [searchQ, setSearchQ]         = useState('');
  var [dietFilter, setDietFilter]   = useState('all');
  var [showAddons, setShowAddons]   = useState(false);
  // V87 — per-proposal { dish_name: sectionOrSubsectionId } tag, for a custom
  // dish added here to show up under a specific section/subsection pill
  // instead of just landing in Extras. Mirrors events.menu_section_overrides
  // (Build Menu) — carried over to the new event's own copy on conversion
  // (see ProposalsView.jsx convertToBooking).
  var [sectionOverrides, setSectionOverrides] = useState(proposal && proposal.menu_section_overrides || {});

  // ── Per-active-dept capability flags ──
  var hasItems   = ITEM_HAVING_DEPTS.indexOf(activeDept) >= 0;
  // V77 — Kitchen never shows a Configs sub-tab, whatever sales_config_defs has for 'kit'.
  var hasConfigs = activeDept !== 'kit' && !!(DEPT_CONFIGS[activeDept] && DEPT_CONFIGS[activeDept].length > 0);

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
            .select('id, name, sort_order, sop_category_hint, sales_dept, dept, parent_section_id')
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

  // V86 — catalogue sections can now have one level of subsections (Dish
  // Library → Sections). parentId → its subsection rows, for groupedByPkgSection
  // to pool a linked section's FULL catalogue (parent + subsections), not just
  // whatever's directly on the parent row itself.
  var catSubsByParent = useMemo(function(){
    var m = {};
    sections.forEach(function(s){
      if (s.parent_section_id) { (m[s.parent_section_id] = m[s.parent_section_id] || []).push(s); }
    });
    return m;
  }, [sections]);

  // V87 — "Add section from library" picker: every top-level catalogue
  // section routed to the active dept tab, with its subsections listed right
  // after (indented) — same ordering convention as MenuPackagesView's own
  // catalogue picker. Dish counts come from allDishes (already loaded), no
  // extra query needed.
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

  // V88 — bring in a chosen catalogue section (its own direct dishes plus, if
  // it's a parent, all of its subsections') as browsable, UNselected cards
  // under the chosen pill — the user picks which ones to actually add from
  // there, same as any other card (onToggle). Tagging alone (no proposal_items/
  // event_items insert) is what makes them show without being pre-checked —
  // see the sectionOverrides carve-out in visibleDishes/visibleDishesAnyDept.
  async function addSectionFromLibrary(catSectionId, targetId) {
    if (!targetId) return; // nothing to browse under without a target pill
    var subIds = (catSubsByParent[catSectionId] || []).map(function(s){ return s.id; });
    var ids = [catSectionId].concat(subIds);
    var res = await supabase.from('dishes_master').select('dish_name').in('section_id', ids).eq('is_active', true);
    if (res.error) throw res.error;
    var names = (res.data || []).map(function(r){ return r.dish_name; });
    if (names.length === 0) return;
    var next = { ...sectionOverrides };
    names.forEach(function(n){ next[n] = targetId; });
    setSectionOverrides(next);
    var updRes = await supabase.from('proposals').update({ menu_section_overrides: next }).eq('id', proposal.id);
    if (updRes.error) console.error('[MenuBuilder] saveSectionOverride (bulk) failed:', updRes.error);
  }

  // V88 — remove an ad-hoc pill (one created by "Add section from library",
  // not a real package section) from THIS proposal's menu builder: clears
  // every dish's tag pointing at it (and its subsection buckets), same
  // metadata-only operation as adding it. Nothing is deselected/deleted —
  // any dish also individually chosen keeps its proposal_items row, it just
  // falls back to wherever it naturally resolves once untagged.
  async function removeAdHocSection(grp) {
    var ids = [grp.id].concat((grp.subGroups || []).map(function(sg){ return sg.id; }));
    var next = { ...sectionOverrides };
    var changed = false;
    Object.keys(next).forEach(function(name){ if (ids.indexOf(next[name]) >= 0) { delete next[name]; changed = true; } });
    if (!changed) return;
    setSectionOverrides(next);
    var res = await supabase.from('proposals').update({ menu_section_overrides: next }).eq('id', proposal.id);
    if (res.error) console.error('[MenuBuilder] removeAdHocSection failed:', res.error);
  }

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

  // In-app notice instead of window.alert. The browser one is unstyled OS
  // chrome, it blocks the page until dismissed, and on a kiosk tablet it can be
  // suppressed entirely - so a failed save would vanish without a word.
  var [toast, setToast] = useState(null);
  function say(tone, title, body){ setToast({ tone: tone, title: title, body: body || '' }); }
  function sayFail(title, err){ say('danger', title, String((err && err.message) || err || '')); }

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
        sayFail(T2('Could not remove that dish'), e);
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
        sayFail(T2('Could not add that dish'), e);
      }
    }
  }

  // V87 — persist a dish's section/subsection tag for this proposal only.
  async function saveSectionOverride(dishName, sectionId) {
    var next = { ...sectionOverrides };
    if (sectionId) next[dishName] = sectionId; else delete next[dishName];
    setSectionOverrides(next);
    try {
      var res = await supabase.from('proposals').update({ menu_section_overrides: next }).eq('id', proposal.id);
      if (res.error) throw res.error;
    } catch (e) {
      console.error('[MenuBuilder] saveSectionOverride failed:', e);
    }
  }

  // V87 — add a brand-new dish: library entry + SOP stub (shared helper),
  // select it for this proposal, and tag which section/subsection pill it
  // shows under (this proposal only — never touches the shared package).
  async function addCustomDish(name, catId, sectionId) {
    await createCustomDishInLibrary(supabase, name, catId);
    var row = { proposal_id: proposal.id, dish_name: name, is_addon: true, ordering: dishItems.length };
    var res = await supabase.from('proposal_items').insert(row).select().single();
    if (res.error) throw res.error;
    setDishItems(function(prev){ return prev.concat([res.data]); });
    if (sectionId) await saveSectionOverride(name, sectionId);
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
    if (toAdd.length === 0) { say('ok', T2('Nothing to load'), T2('Every dish in this package is already selected.')); return; }
    setSeeding(true);
    try {
      var rows = toAdd.map(function(d, i){ return { proposal_id: proposal.id, dish_name: d, is_addon: false, ordering: dishItems.length + i }; });
      var ins = await supabase.from('proposal_items').insert(rows).select();
      if (ins.error) throw ins.error;
      setDishItems(function(prev){ return prev.concat(ins.data || []); });
      await supabase.from('proposals').update({ menu_initialized: true }).eq('id', proposal.id);
    } catch (e) {
      console.error('[MenuBuilder] loadPackageDefaults failed:', e);
      sayFail(T2('Could not load the package defaults'), e);
    } finally {
      setSeeding(false);
    }
  }

  // V77 — dish name → its PACKAGE section's own sales_dept, for the currently
  // selected package. groupedByPkgSection already treats a package section's
  // sales_dept as the authoritative dept for its dishes (not the shared catalogue
  // section, which is just a quick-fill convenience) — counting has to agree with
  // that or the sidebar/live-total numbers won't match what's actually shown under
  // each dept tab.
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

  // V88 — a dish tagged via sectionOverrides to a section (e.g. a custom
  // dish placed under a Fruits-dept pill) isn't in dishNameToPkgDept at all —
  // that map only knows the package's OWN static dish list, not per-proposal
  // ad-hoc tags. Without this, the sidebar/live-total counts silently
  // attribute such a dish to Kitchen (DEFAULT_DEPT) even though
  // groupedByPkgSection already renders it correctly under its tagged dept.
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

  // ── Selected counts per dept ──
  var deptCounts = useMemo(function(){
    var counts = {};
    SALES_DEPTS.forEach(function(d){ counts[d.id] = { sel: 0, total: 0 }; });
    var counted = {};
    allDishes.forEach(function(d){
      var meta = salesMeta[d.name];
      var dept = sectionOverrideDept[d.name] || dishNameToPkgDept[d.name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      if (!counts[dept]) counts[dept] = { sel: 0, total: 0 };
      counts[dept].total += 1;
      if (selectedSet[d.name]) counts[dept].sel += 1;
      counted[d.name] = true;
    });
    // V74 — Phantoms: selected dishes not present in the catalogue (retired,
    // renamed, or template-only names never added to dishes_master). Attribute
    // them to their package section's dept, saved dept, or DEFAULT_DEPT so the
    // sidebar sel badge is honest.
    Object.keys(selectedSet).forEach(function(name){
      if (counted[name]) return;
      var meta = salesMeta[name];
      var dept = sectionOverrideDept[name] || dishNameToPkgDept[name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      if (!counts[dept]) counts[dept] = { sel: 0, total: 0 };
      counts[dept].sel += 1;
    });
    return counts;
  }, [allDishes, salesMeta, selectedSet, dishNameToPkgDept, sectionOverrideDept]);

  // Section name → its parent's name, from the Dish Library's own nesting.
  //
  // The pills are built from the PACKAGE's section list, which is flat: a
  // package that includes "Tandoori Snacks" lists it at the top level even
  // though the library files it under "Pass Around Snacks". That is why the
  // strip ran to thirty-odd pills — twenty-five of the fifty catalogue sections
  // are subsections, and every one of them was getting its own pill.
  //
  // Matched on name rather than id: a package section is its own row with its
  // own id, so the id never lines up with the catalogue's.
  var sectionParentMap = useMemo(function(){
    var byId = {};
    sections.forEach(function(s){ byId[s.id] = s; });
    var m = {};
    sections.forEach(function(s){
      if (!s.parent_section_id) return;
      var parent = byId[s.parent_section_id];
      if (parent) m[(s.name || '').toLowerCase().trim()] = parent.name;
    });
    return m;
  }, [sections]);

  // Shown both inside the rail and on the closed tab, so it is summed once
  // rather than the same reduce being written in two places.
  var grandTotal = useMemo(function(){
    return SALES_DEPTS.reduce(function(sum, d){ return sum + ((deptCounts[d.id] || {}).sel || 0); }, 0);
  }, [deptCounts]);

  // ── Dishes for active dept ──
  // V73: effective dept = section's sales_dept override (if dish is in a routed section)
  // else dish's own meta.sales_dept else DEFAULT_DEPT ('kit').
  var deptDishes = useMemo(function(){
    var base = allDishes.filter(function(d){
      // Bug fix — a dish belonging to the currently selected package (e.g.
      // Virgin Mojito under a Beverage section) but with no catalogue
      // section_id and no sales_meta override used to fall all the way to
      // DEFAULT_DEPT ('kit') here, even though dishNameToPkgDept already
      // knows its real, correct department (deptCounts/templateDishesInDept
      // already prioritize it the same way) — it showed correctly under its
      // real dept AND bled into Kitchen's Extras as an unclaimed leftover.
      var override = d.section_id ? sectionSalesDeptMap[d.section_id] : null;
      var meta = salesMeta[d.name];
      var dept = dishNameToPkgDept[d.name] || override || (meta && meta.sales_dept) || DEFAULT_DEPT;
      return dept === activeDept;
    });
    // Phantom (catalogue-missing) dishes used to always surface in Kitchen
    // regardless of which dept they actually belong to — now routed by the
    // same dishNameToPkgDept priority as everything else, so e.g. a missing
    // Beverage dish's ⚠ warning shows under Beverage, not Kitchen.
    var phantomsForDept = phantomDishes.filter(function(p){ return (dishNameToPkgDept[p.name] || DEFAULT_DEPT) === activeDept; });
    if (phantomsForDept.length > 0) return base.concat(phantomsForDept);
    return base;
  }, [allDishes, salesMeta, activeDept, phantomDishes, sectionSalesDeptMap, dishNameToPkgDept]);

  // ── Template dishes scoped to active dept ──
  var templateDishesInDept = useMemo(function(){
    return templateInfo.dishes.filter(function(name){
      var meta = salesMeta[name];
      var dept = dishNameToPkgDept[name] || (meta && meta.sales_dept) || DEFAULT_DEPT;
      return dept === activeDept;
    });
  }, [templateInfo.dishes, salesMeta, activeDept, dishNameToPkgDept]);

  // ── Diet-annotated + filtered + searched ──
  var visibleDishes = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return deptDishes.filter(function(d){
      var meta = salesMeta[d.name];
      var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
      if (dietFilter !== 'all' && diet !== dietFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      // Hide dishes that aren't in template AND aren't selected, unless showAddons is
      // true — or the dish was explicitly placed here via "Add section from
      // library" (V87): that adds the whole section as browsable, unselected
      // cards, not auto-picked, so it must stay visible regardless of showAddons.
      var inT = !!templateSet[d.name];
      var isSel = !!selectedSet[d.name];
      var hasOverride = !!(sectionOverrides && sectionOverrides[d.name]);
      if (!inT && !isSel && !showAddons && !hasOverride) return false;
      return true;
    });
  }, [deptDishes, salesMeta, dietFilter, searchQ, templateSet, selectedSet, showAddons, sectionOverrides]);

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
    // Bug fix — this used to filter+list EVERY catalogue row (parents AND
    // subsections alike) as its own flat top-level pill, ordered by sort_order.
    // But sort_order is only ever comparable among SIBLINGS (a subsection's
    // own reorder-drag resets it relative to its sisters, same for a parent
    // among other parents) — a parent's sort_order routinely lands numerically
    // BEFORE its own children's, so subsections of different parents ended up
    // interleaved ahead of any parent pill at all. Only top-level sections
    // become their own pill now; subsections are pooled into it (dishes) and
    // rendered as subGroups, same shape groupedByPkgSection already uses.
    var topSections = sections.filter(function(s){ return !s.parent_section_id && (s.sales_dept || 'kit') === activeDept; });
    if (topSections.length === 0) return null;

    // Package dish → order index (for pinned block ordering)
    var pkgOrder = {};
    (templateInfo.dishes || []).forEach(function(d, i){ pkgOrder[d] = i; });

    // Valid section id set (dishes with section_id not in this set fall to
    // Extras) — a subsection counts here purely via its PARENT's dept, not
    // its own (usually unset) sales_dept.
    var validSectionIds = {};
    topSections.forEach(function(s){
      validSectionIds[s.id] = true;
      (catSubsByParent[s.id] || []).forEach(function(sub){ validSectionIds[sub.id] = true; });
    });

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
      out.push({ id: s.id, name: s.name, icon: iconFor(s), dishes: sortWithin(pooled), subGroups: subGroups });
    });
    if (extras.length > 0) {
      out.push({ id: '__extras__', name: 'Extras', icon: '✨', dishes: sortWithin(extras) });
    }
    return out;
  }, [activeDept, sections, visibleDishes, templateInfo.dishes, catSubsByParent]);

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
      var hasOverride = !!(sectionOverrides && sectionOverrides[d.name]);
      if (!inT && !isSel && !showAddons && !hasOverride) return false;
      return true;
    });
  }, [allDishes, phantomDishes, salesMeta, dietFilter, searchQ, templateSet, selectedSet, showAddons, sectionOverrides]);

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
      // V86 — the linked catalogue section may itself have subsections (Dish
      // Library → Sections), each holding its own slice of the full catalogue
      // list (e.g. Pass Around Snacks > Tandoori/Pan Asian/Continental). Pool
      // ALL of them, grouped by subsection, instead of only whatever's
      // directly on the parent row — otherwise a fully-subsectioned catalogue
      // section (0 dishes of its own) resolves to nothing to browse at all.
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
        // Package dish names that don't exist among this catalogue section's own
        // dishes (name mismatch, or added to the package from elsewhere) — resolve
        // or synthesize them too, so the package's own count is never short.
        var foundNames = {};
        directCatDishes.forEach(function(d){ foundNames[d.name] = true; });
        var missing = pkgDishNames.filter(function(n){ return !foundNames[n]; }).map(function(n){ return resolveOrSynth(n, sec); });
        list = missing.concat(pinnedRest(directCatDishes, pkgDishNames));
      } else {
        list = pkgDishNames.map(function(name){ return resolveOrSynth(name, sec); });
      }

      if (list.length === 0) return;
      list.forEach(function(d){ consumed[d.name] = true; });
      out.push({ id: sec.id, name: sec.name, icon: iconFor(sec.sop_category), dishes: list, subGroups: subGroups });
    });
    if (out.length === 0) return null;

    // Bug fix — "Extras" is itself a selectable placement pill (so a custom
    // dish can be explicitly tagged there instead of a real section), but it
    // used to only get built at the very end from whatever's left unconsumed.
    // An override tagged to '__extras__' ran BEFORE that existed, so it fell
    // through to newGroups and spawned a SECOND, colliding "Extras" pill
    // (duplicate id — one hid the other). Build it once, up front, so the
    // override pass below places straight into the same bucket leftovers use.
    var extrasGroup = { id: '__extras__', name: 'Extras', icon: '✨', dishes: [] };
    out.push(extrasGroup);

    // V87 — a custom dish (or a whole library section added ad hoc) is tagged
    // per-proposal via sectionOverrides, pointing at a group/subGroup id that
    // may already exist above — place it there instead of leaving it for
    // Extras. A tag pointing at neither (a whole catalogue section added ad
    // hoc that isn't part of this package, e.g. "Pre Dining Live") gets its
    // OWN new pill named after that catalogue section, rather than silently
    // falling into Extras.
    // A tag's target can be a package-section id, a catalogue section id, or
    // a catalogue subsection id — all three carry (or inherit) a sales_dept,
    // and a tag whose dept doesn't match the tab being viewed must be fully
    // skipped here (not just left unplaced), or it leaks into every OTHER
    // dept tab too as a stray pill labelled with its raw id (since it won't
    // resolve a real name outside its own dept's catalogueSectionOptions).
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
        // V87 fix — a whole catalogue section added ad hoc can itself have
        // subsections (e.g. "Pre Dining Live" > Lebanese/Galouti/Kebab/...);
        // pool the same subGroups shape the main package-section loop above
        // builds, bucketing each tagged dish by its OWN catalogue section_id,
        // instead of one flat unlabeled list.
        var subs = catSubsByParent[targetId] || [];
        var subGroupsNew = subs.length > 0
          ? subs.map(function(sub){ return { id: sub.id, name: sub.name, dishes: [] }; }).concat([{ id: targetId + '__unplaced', name: T2('Other'), dishes: [] }])
          : null;
        newGroups[targetId] = { id: targetId, name: opt ? opt.label.replace(/^—\s*/, '') : targetId, icon: '📚', dishes: [], subGroups: subGroupsNew, isAdHoc: true };
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
    // unclassified custom dish, natively visible here in Kitchen by default,
    // but tagged to a Fruits-dept section) already renders correctly under
    // its tag's own dept tab — it must not also leak into THIS dept's Extras
    // just because its fallback native dept happens to be the one showing.
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
  }, [templateInfo.name, visibleDishesAnyDept, catalogueBrowsePool, visibleDishes, activeDept, catSubsByParent, T2, sectionOverrides, catalogueSectionOptions, sections]);

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
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", background: K.shellBg, overflow: "hidden" }}>
      {/* This view takes over the whole window, so it sits outside the shell and
         gets none of its chrome - including the page artwork. Its own image, not
         the shell's: this screen is a full-bleed workspace and carries a warmer,
         larger-scale backdrop. Falls back to the shell artwork if it is missing,
         so the view never lands on a flat colour. BASE_URL, not a bare "/",
         because vite sets base:'/Fnbapp/'. */}
      <img src={`${import.meta.env.BASE_URL}menu-bg.webp`} alt="" aria-hidden="true" draggable="false"
        onError={function(e){
          var el = e.currentTarget;
          if (!el.dataset.step) { el.dataset.step = "png"; el.src = el.src.replace(/menu-bg.webp.*$/, "menu-bg.png"); return; }
          if (el.dataset.step === "png") { el.dataset.step = "shell"; el.src = el.src.replace(/menu-bg.png.*$/, "page-bg.webp"); return; }
          el.style.display = "none";
        }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
          objectPosition: "center", opacity: K.pageBgOpacity, pointerEvents: "none", userSelect: "none", zIndex: 0 }} />
      {/* ── Top bar ──
          A plate, not a flat strip: this view takes over the whole window, so it
          has to carry its own identity the way the shell's header does. */}
      <div className="kh-plateart kh-rise" style={{ position: "relative", zIndex: 1, flexShrink: 0, margin: "12px 16px 0", padding: "13px 18px",
        borderRadius: 20, backgroundColor: K.cardWarm, border: "1px solid " + K.cardWarmLine,
        boxShadow: K.shadowCard, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 260 }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: K.brandBg,
            border: "1px solid " + K.brandBorder, color: K.brand,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="utensils" size={21} strokeWidth={1.8} />
          </span>
          <div style={{ minWidth: 0 }}>
            <button onClick={onClose} className="kh-btn kh-backbtn kh-rip" onPointerDown={ripple}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: K.rPill,
                background: "#FFFFFF", border: "1px solid " + K.cardWarmLine, color: K.textBody,
                fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: K.fontBody, whiteSpace: "nowrap" }}>
              <Icon name="chevronL" size={13} strokeWidth={2.1} />{T2("Back to proposals")}
            </button>
            {/* The "Menu for" eyebrow is gone. It worked when it sat on its own
                line directly above the name, labelling it; squeezed onto the
                back button's row to save height it stopped pointing at anything
                and just crowded the button. The name carries the plate on its
                own — the utensils tile and the meta row below already say what
                this screen is. type.pageTitle, because this IS the page title.
                700 rather than the scale value of 600: Cormorant is a light
                face, and at 600 on a plate this wide the name did not hold. */}
            <div style={{ ...type.pageTitle, fontSize: 28, fontWeight: 700, color: K.hdrTitle,
              marginTop: 8, overflowWrap: "anywhere" }}>
              {proposal.guest_name || T2("Untitled proposal")}
            </div>
            {/* Each fact is its own chip. The old line ran them together with
                dots, so the template name and the venue read as one string. */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 7, flexWrap: "wrap", ...type.meta, color: K.hdrMeta }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="calendar" size={14} strokeWidth={1.9} />{proposal.event_type || T2("Event")}
              </span>
              <span style={{ color: K.textFaint }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="building" size={14} strokeWidth={1.9} />{proposal.venue || T2("Venue not set")}
              </span>
              {proposal.pax != null && (<>
                <span style={{ color: K.textFaint }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: K.hdrMetaStrong }}>
                  <Icon name="users" size={14} strokeWidth={1.9} />{proposal.pax} pax
                </span>
              </>)}
              {dietMeta && (<>
                <span style={{ color: K.textFaint }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700,
                  color: dietMeta.color || K.hdrMeta }}>
                  <Icon name="apple" size={14} strokeWidth={1.9} />{dietMeta.label}
                </span>
              </>)}
              {templateInfo.name && (<>
                <span style={{ color: K.textFaint }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="layers" size={14} strokeWidth={1.9} />{templateInfo.name}
                </span>
              </>)}
            </div>
          </div>
        </div>
        <KButton variant="brand" icon="eye" onClick={function(){ setShowPreview(true); }}
          disabled={dishItems.length === 0}
          title={dishItems.length === 0 ? T2("Add items first before previewing") : T2("Open client preview")}
          style={{ padding: "11px 20px", borderRadius: K.rPill, fontSize: 14, flexShrink: 0 }}>
          {T2("Preview Menu")}
        </KButton>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", overflow: "hidden", gap: 16, padding: "14px 16px 16px", minHeight: 0 }}>
        {/* ── Dept sidebar ── */}
        {/* The artwork is a real image layer here, not the 20% wash the cards
            use. This panel is tall and narrow - the same shape the image was
            drawn for - so its leaves land in the corners where they belong
            instead of being cropped to a meaningless patch. overflow:hidden so
            the picture is clipped by the card's radius rather than squaring it. */}
        <div className="kh-thinscroll" style={{ position: "relative", flexShrink: 0, width: 232, borderRadius: 20,
          backgroundColor: K.cardWarm, border: "1px solid " + K.cardWarmLine, boxShadow: K.shadowCard,
          padding: "16px 14px", overflowY: "auto", overflowX: "hidden" }}>
          <img src={`${import.meta.env.BASE_URL}leaf-bg.webp`} alt="" aria-hidden="true" draggable="false"
            onError={function(e){ e.currentTarget.style.display = "none"; }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
              objectPosition: "center top", opacity: .5, pointerEvents: "none", userSelect: "none", zIndex: 0 }} />
          <div style={{ position: "relative", zIndex: 1, ...type.label, fontSize: 10.5, color: K.hdrMeta, padding: "0 6px", marginBottom: 12 }}>
            {T2("Departments")}
          </div>
          {SALES_DEPTS.map(function(d){
            var isActive = activeDept === d.id;
            var counts = deptCounts[d.id] || { sel: 0, total: 0 };
            var deptHasItems   = ITEM_HAVING_DEPTS.indexOf(d.id) >= 0;
            var deptHasConfigs = !!(DEPT_CONFIGS[d.id] && DEPT_CONFIGS[d.id].length > 0);
            var isFunctional   = deptHasItems || deptHasConfigs; // Phase 5A: kit/bev/bak/frt (items) + bev/svc (configs)
            return (
              <button key={d.id} className={"kh-btn kh-deptbtn kh-rip" + (isActive ? " is-on" : "")} onPointerDown={ripple}
                onClick={function(){
                  setActiveDept(d.id);
                  // Default to Items sub-tab if this dept has items, otherwise Configs
                  setActiveSubTab(deptHasItems ? 'items' : 'configs');
                }}
                style={{
                  position: "relative", zIndex: 1,
                  display: "flex", alignItems: "center", gap: 11, width: "100%",
                  padding: "10px 12px", marginBottom: 5, borderRadius: 13,
                  // Sage for the picked department, the same as a picked config
                  // row. The brand green is this app's chrome colour; used as a
                  // selection it reads almost black and puts a hard edge around
                  // something the user merely navigated to.
                  background: isActive ? K.sageSel : "transparent",
                  border: "1px solid " + (isActive ? K.sage : "transparent"),
                  color: isActive ? K.sageText : K.textBody,
                  ...type.rowTitle, fontWeight: isActive ? 700 : 600,
                  cursor: "pointer", textAlign: "left", fontFamily: K.fontBody,
                  opacity: isFunctional ? 1 : 0.6,
                }}>
                {/* The department's own colour stays on the tile, where it reads
                    as a marker, rather than on the label, where it competes with
                    the text it is meant to identify. An icon, not an emoji: an
                    emoji renders differently on every OS, sits on its own
                    baseline, and cannot take the department colour. */}
                <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: (d.color || K.brand) + "1A", color: d.color || K.brand,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={d.glyph || "utensils"} size={17} strokeWidth={1.9} />
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                {isFunctional && (
                  <span style={{ fontSize: 12.5, fontWeight: 700, flexShrink: 0,
                    color: counts.sel > 0 ? K.brandText : K.textFaint,
                    fontVariantNumeric: "tabular-nums" }}>{counts.sel}</span>
                )}
                {!isFunctional && (
                  <span style={{ fontSize: 11, color: K.textFaint, flexShrink: 0 }}>{T2("soon")}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Main area ── */}
        <div className="kh-thinscroll" style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingRight: 2 }}>
          {loading && (
            <div className="kh-cardart-sm" style={{ padding: "60px 20px", textAlign: "center", color: K.hdrMeta,
              borderRadius: 20, backgroundColor: K.cardWarm, border: "1px solid " + K.cardWarmLine, boxShadow: K.shadowCard }}>
              <div style={{ color: K.textFaint, display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <Icon name={seeding ? "layers" : "refresh"} size={28} strokeWidth={1.7} />
              </div>
              <div style={{ fontSize: 14 }}>{seeding ? T2("Seeding template dishes…") : T2("Loading menu builder…")}</div>
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
                  sectionParentMap={sectionParentMap}
                  templateSet={templateSet}
                  selectedSet={selectedSet}
                  salesMeta={salesMeta}
                  onToggle={toggleDish}
                  templateInfo={templateInfo}
                  templateDishesInDept={templateDishesInDept}
                  deptCounts={deptCounts[activeDept]}
                  onLoadDefaults={loadPackageDefaults}
                  seeding={seeding}
                  onAddCustomDish={addCustomDish}
                  catalogueSectionOptions={catalogueSectionOptions}
                  onAddSectionFromLibrary={addSectionFromLibrary}
                  onRemoveSection={removeAdHocSection}
                />
              )}

              {hasConfigs && activeSubTab === 'configs' && (
                <ConfigsPanel
                  proposal={proposal}
                  activeDept={activeDept}
                  lang={lang}
                />
              )}
            </div>
          )}

          {!loading && !hasItems && !hasConfigs && (
            <ComingSoonPlaceholder T2={T2} dept={SALES_DEPT_MAP[activeDept]} />
          )}
        </div>

        {/* ── V77: live totals — one always-visible per-dept count list (mirrors the
            left sidebar's badges), replacing the old per-tab "Total" sub-tab so
            sales don't have to click into every dept just to see what's picked. ── */}
        {!railOpen && (
          // Closed: a slim tab on the right edge, label only.
          <button onClick={function(){ setRailOpen(true); }} className="kh-btn kh-rip" onPointerDown={ripple}
            title={T2("Show live total")}
            style={{ flexShrink: 0, alignSelf: "flex-start", width: 42, padding: "14px 0 16px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              borderRadius: 16, backgroundColor: K.cardWarm, border: "1px solid " + K.cardWarmLine,
              boxShadow: K.shadowCard, cursor: "pointer", fontFamily: K.fontBody }}>
            <Icon name="chevronL" size={15} strokeWidth={2.2} />
            {/* Upright text in a 42px column would wrap to one letter a line.
                flexShrink 0 is load-bearing: turned on its side, the automatic
                minimum size of a flex item applies to its block axis, which is
                now horizontal — so its length is free to be squeezed, and the
                label was being clipped to "LIVE TOT". */}
            <span style={{ writingMode: "vertical-rl", flexShrink: 0, whiteSpace: "nowrap",
              ...type.label, fontSize: 10, color: K.hdrMeta }}>
              {T2("Live total")}
            </span>
          </button>
        )}
        {railOpen && (
        <div style={{ flexShrink: 0, width: 232, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }} className="kh-thinscroll">
          <div className="kh-leafwash" style={{ borderRadius: 20, backgroundColor: K.cardWarm,
            border: "1px solid " + K.cardWarmLine, boxShadow: K.shadowCard, padding: "16px 16px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ color: K.sbGold, display: "flex" }}><Icon name="chart" size={18} strokeWidth={2} /></span>
              <span style={{ ...type.sectionHead, fontSize: 19, color: K.hdrTitle, flex: 1, minWidth: 0 }}>{T2("Live total")}</span>
              <button onClick={function(){ setRailOpen(false); }} className="kh-btn kh-iconbtn kh-rip" onPointerDown={ripple}
                title={T2("Hide")}
                style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, padding: 0, cursor: "pointer",
                  background: "transparent", border: "1px solid " + K.cardWarmLine, color: K.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="chevronR" size={14} strokeWidth={2.2} />
              </button>
            </div>
            {SALES_DEPTS.map(function(d){
              var counts = deptCounts[d.id] || { sel: 0, total: 0 };
              var deptHasItems   = ITEM_HAVING_DEPTS.indexOf(d.id) >= 0;
              var deptHasConfigs = d.id !== 'kit' && !!(DEPT_CONFIGS[d.id] && DEPT_CONFIGS[d.id].length > 0);
              if (!deptHasItems && !deptHasConfigs) return null;
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 2px" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: K.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  {/* A zero is deliberately faint: the eye should land on the
                      departments that actually have something in them. */}
                  <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                    color: counts.sel > 0 ? K.hdrTitle : K.textFaint }}>{counts.sel}</span>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 2px 4px", marginTop: 8,
              borderTop: "1px solid " + K.cardWarmLine }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: K.hdrTitle }}>{T2("Total items")}</span>
              <span style={{ fontSize: 19, fontWeight: 800, color: K.hdrTitle, fontVariantNumeric: "tabular-nums" }}>
                {grandTotal}
              </span>
            </div>
          </div>
        </div>
        )}
      </div>
      <KToast open={!!toast} toneName={toast && toast.tone} title={toast && toast.title}
        body={toast && toast.body} onClose={function(){ setToast(null); }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ITEMS TAB — works for any item-having dept (kit/bev/bak/frt)
// ═══════════════════════════════════════════════════════════════
function ItemsTab({ T2, activeDept, setActiveDept, searchQ, setSearchQ, showAddons, setShowAddons, deptDishes, groupedByCat, sectionParentMap, templateSet, selectedSet, salesMeta, onToggle, templateInfo, deptCounts, allDeptCounts, onLoadDefaults, seeding, onAddCustomDish, catalogueSectionOptions, onAddSectionFromLibrary, onRemoveSection }) {
  var deptTotal = deptCounts ? deptCounts.total : 0;
  // Read only by the template summary bar, which is commented out further down.
  // Kept here rather than deleted so uncommenting that block is a single edit:
  //   var totalSel = deptCounts ? deptCounts.sel : 0;
  //   var templateCountInDept = templateDishesInDept ? templateDishesInDept.length : 0;   // also re-add the templateDishesInDept prop
  //   var addonsAvailable = Math.max(0, deptTotal - templateCountInDept);

  // V77 — section pills instead of one long stacked scroll: pick one section,
  // see only its dishes. A search query bypasses the pill filter (shows every
  // matching section) since the whole point of searching is to find something
  // regardless of where it lives.
  var [activeSectionId, setActiveSectionId] = useState(null);
  var isSearching = !!(searchQ || '').trim();

  // ── Drop a section whose dishes are all in a bigger one ──────────────
  // A package can carry both a parent section and one of its children as
  // separate rows — "Luxury Veg" lists "Pre Dining Live" AND "Labenese
  // Section", while the catalogue files Lebanses under Pre Dining Live. The
  // parent pill then pulls in the child's dishes as a subgroup and the child
  // renders its own pill beside it, showing the same six dishes twice.
  //
  // The test is "this section is already on the page as somebody's SUBSECTION",
  // not "its dishes happen to appear elsewhere". Plain set containment looked
  // right and was not: a one-dish section like Mineral Water is swallowed by
  // any larger section that happens to carry that dish, and it would have
  // vanished even though nothing lists it as a child.
  var dedupedGroups = useMemo(function(){
    var all = groupedByCat || [];
    var namesOf = function(list){
      var s = {};
      (list || []).forEach(function(d){ s[d.name] = true; });
      return s;
    };
    return all.filter(function(g, i){
      var mine = namesOf(g.dishes);
      var count = Object.keys(mine).length;
      if (count === 0) return true;
      for (var j = 0; j < all.length; j++) {
        if (j === i) continue;
        var subs = all[j].subGroups || [];
        for (var k = 0; k < subs.length; k++) {
          var sub = namesOf(subs[k].dishes);
          // Covered by that subsection, so it is already reachable there.
          var covered = Object.keys(mine).every(function(n){ return !!sub[n]; });
          if (covered) return false;
        }
      }
      return true;
    });
  }, [groupedByCat]);
  useEffect(function(){
    var stillExists = dedupedGroups.some(function(g){ return g.id === activeSectionId; });
    if (!stillExists) setActiveSectionId(dedupedGroups.length > 0 ? dedupedGroups[0].id : null);
  // eslint-disable-next-line
  }, [activeDept, dedupedGroups.map(function(g){ return g.id; }).join(',')]);
  var visibleGroups = isSearching ? dedupedGroups : dedupedGroups.filter(function(g){ return g.id === activeSectionId; });

  // ── Two-level pills ───────────────────────────────────────────────────
  // Groups that the library files under a parent get pooled into one pill for
  // that parent; everything else stays its own. Order is taken from
  // groupedByCat rather than re-sorted, so a parent appears where its first
  // child did and the strip does not reshuffle itself.
  var pillTree = useMemo(function(){
    var out = [], byParent = {};
    dedupedGroups.forEach(function(g){
      var parentName = (sectionParentMap || {})[(g.name || '').toLowerCase().trim()];
      if (!parentName) { out.push({ key: g.id, name: g.name, icon: g.icon, children: [g], self: g }); return; }
      var bucket = byParent[parentName];
      if (!bucket) {
        // The parent takes the icon of the first child that lands in it — the
        // parent itself is usually not one of the package's own sections, so
        // there is no row of its own to read one from.
        bucket = byParent[parentName] = { key: 'p:' + parentName, name: parentName, icon: g.icon, children: [], self: null };
        out.push(bucket);
      }
      bucket.children.push(g);
    });
    return out;
  }, [dedupedGroups, sectionParentMap]);

  var activeParent = useMemo(function(){
    return pillTree.find(function(p){
      return p.children.some(function(g){ return g.id === activeSectionId; });
    }) || null;
  }, [pillTree, activeSectionId]);

  // V87 — custom dish add, mirrors Build Menu's MenuEditor.jsx flow: pick an
  // SOP/recipe category (so it's classified from the start, not fuzzy-guessed
  // later) plus which section/subsection pill to place it in for THIS
  // proposal/event — flattened from whatever's currently grouped, so a
  // package-linked section's own subsections show up as pickable targets too.
  var [tabToast, setTabToast] = useState(null);
  function sayFail(title, err){ setTabToast({ tone: 'danger', title: title, body: String((err && err.message) || err || '') }); }
  var [pendingCustom, setPendingCustom] = useState(null); // { name, catId, sectionId } | null
  var [customSaving, setCustomSaving] = useState(false);
  var placementOptions = useMemo(function(){
    var out = [];
    groupedByCat.forEach(function(g){
      out.push({ id: g.id, label: g.name });
      (g.subGroups || []).forEach(function(sg){ out.push({ id: sg.id, label: g.name + ' › ' + sg.name }); });
    });
    return out;
  }, [groupedByCat]);
  function openCustomModal(){
    setPendingCustom({ name: '', catId: '', sectionId: activeSectionId || '' });
  }
  async function confirmCustom(){
    if (!pendingCustom || !pendingCustom.name.trim() || customSaving) return;
    setCustomSaving(true);
    try {
      await onAddCustomDish(pendingCustom.name.trim(), pendingCustom.catId || null, pendingCustom.sectionId || null);
      setPendingCustom(null);
    } catch (e) {
      sayFail(T2('Could not add that dish'), e);
    } finally {
      setCustomSaving(false);
    }
  }

  // V87 — add a whole catalogue section (with its subsections) at once,
  // placed under whichever pill the user picks.
  var [pendingSection, setPendingSection] = useState(null); // { catSectionId, targetId } | null
  var [sectionSaving, setSectionSaving] = useState(false);
  function openSectionModal(){
    setPendingSection({ catSectionId: '', targetId: '' });
  }
  async function confirmAddSection(){
    if (!pendingSection || !pendingSection.catSectionId || !pendingSection.targetId || sectionSaving) return;
    setSectionSaving(true);
    try {
      await onAddSectionFromLibrary(pendingSection.catSectionId, pendingSection.targetId || null);
      setPendingSection(null);
    } catch (e) {
      sayFail(T2('Could not add that section'), e);
    } finally {
      setSectionSaving(false);
    }
  }

  var deptMeta = SALES_DEPT_MAP[activeDept] || {};
  return (
    <div className="kh-leafwash" style={{ borderRadius: 20, backgroundColor: K.cardWarm,
      border: "1px solid " + K.cardWarmLine, boxShadow: K.shadowCard, padding: "18px 20px 20px" }}>
      {/* Department header — says which department you are in and how much of it
          is picked, so the left rail is not the only place that answers it. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ color: K.sbGold, display: "flex", flexShrink: 0 }}>
          <Icon name="chefHat" size={26} strokeWidth={1.7} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...type.sectionHead, fontSize: 21, color: K.hdrTitle }}>{deptMeta.name || T2("Department")}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, padding: "4px 11px", borderRadius: K.rPill,
              background: K.brandBg, border: "1px solid " + K.brandBorder, color: K.brandText, whiteSpace: "nowrap" }}>
              {deptTotal} {T2("items")}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 13.5, color: K.hdrMeta, marginTop: 2 }}>
            {T2("Explore and select dishes for this department")}
          </span>
        </span>
        {/* Carries the marginLeft:auto that used to sit on the search field, so
            this whole group still pushes right as one block. Guarded on the
            template as well as the handler — without a package there are no
            defaults to load, and it used to live inside the package strip where
            that check was implicit. */}
        {templateInfo.name && onLoadDefaults && (
          <KButton size="sm" icon="refresh" onClick={onLoadDefaults} disabled={!!seeding}
            title={T2("Add any package dish not already selected — never removes or duplicates existing selections")}
            style={{ padding: "10px 15px", borderRadius: K.rPill, fontSize: 13, flexShrink: 0, marginLeft: "auto",
              background: "#FFFFFF", borderColor: K.sageBorder, color: K.sageText }}>
            {seeding ? T2("Loading…") : T2("Load defaults")}
          </KButton>
        )}
        {/* Sized to what a dish name needs, not to whatever is left over: at
            flex 1 it stretched across half the page for a field that takes a
            word or two. */}
        <div style={{ position: "relative", flex: "0 1 320px", minWidth: 190 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            color: K.textFaint, display: "flex", pointerEvents: "none" }}>
            <Icon name="search" size={16} strokeWidth={1.9} />
          </span>
          <input value={searchQ} onChange={function(e){ setSearchQ(e.target.value); }}
            placeholder={T2("Search dishes…")}
            style={{ width: "100%", padding: "10px 14px 10px 40px", borderRadius: K.rPill,
              border: "1px solid " + K.cardWarmLine, fontSize: 13.5, color: K.text, background: "#FFFFFF",
              boxSizing: "border-box", fontFamily: K.fontBody, outline: "none" }} />
        </div>
        {/* Moved up onto the search row. On a row of their own they cost the
            page a full button's height for two controls used once a session. */}
        {onAddCustomDish && (
          <KButton size="sm" icon="plus" onClick={openCustomModal}
            style={{ padding: "10px 15px", borderRadius: K.rPill, fontSize: 13, flexShrink: 0, background: "#FFFFFF", borderColor: K.cardWarmLine }}>
            {T2("Add dish")}
          </KButton>
        )}
        {onAddSectionFromLibrary && (
          <KButton size="sm" icon="layers" onClick={openSectionModal}
            style={{ padding: "10px 15px", borderRadius: K.rPill, fontSize: 13, flexShrink: 0, background: "#FFFFFF", borderColor: K.cardWarmLine }}>
            {T2("Add section")}
          </KButton>
        )}

        {/* A switch, not a checkbox: it turns a view mode on and off, and the
            old bare checkbox read as one more filter to tick.
            It sits on this row now too — the filter bar it used to live on had
            nothing else left in it once the diet chips were hidden, so keeping
            it was a whole row of page height for one toggle. */}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 9, cursor: "pointer", flexShrink: 0,
          fontSize: 13, fontWeight: 600, color: K.textBody }}>
          <input type="checkbox" checked={showAddons} onChange={function(e){ setShowAddons(e.target.checked); }}
            style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
          <span style={{ width: 38, height: 22, borderRadius: K.rPill, flexShrink: 0, position: "relative",
            background: showAddons ? K.brand : K.lineStrong, transition: "background .16s ease" }}>
            <span style={{ position: "absolute", top: 3, left: showAddons ? 19 : 3, width: 16, height: 16,
              borderRadius: "50%", background: "#FFFFFF", transition: "left .16s ease",
              boxShadow: "0 1px 3px rgba(17,28,51,.28)" }} />
          </span>
          {T2("Show add-ons only")}
        </label>
      </div>

      {/* Diet chips — hidden, not deleted. The parent still owns dietFilter and
          it stays at 'all', so every dish keeps showing and the filtering code
          there is untouched. To bring these back, uncomment this block, wrap it
          in a row of its own, AND put `dietFilter, setDietFilter` back in the
          props above — they came out of the signature only because nothing
          reads them while the chips are hidden.
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <DietChip active={dietFilter === 'all'} onClick={function(){ setDietFilter('all'); }} color={K.brand} label={T2("All")} />
        {DIET_TAGS.map(function(dt){
          return <DietChip key={dt.id} active={dietFilter === dt.id} onClick={function(){ setDietFilter(dietFilter === dt.id ? 'all' : dt.id); }} color={dt.color} label={dt.label} />;
        })}
      </div>
      */}

      {/* Template summary bar (per-dept scoped counts) — hidden, not deleted.
          Three of the five things it showed are on the page already: the
          package name is in the header plate's meta row, the dept total is in
          the heading pill beside "Kitchen", and the selected count is in both
          the left rail and the Live total rail. Only "N template dishes" and
          "N add-ons available" were unique to it, and they did not justify the
          80px. Uncomment to bring it back — the three vars it reads are kept
          below for exactly that.
      {templateInfo.name && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", marginBottom: 16,
          borderRadius: 16, background: K.sageBg, border: "1px solid " + K.sageBorder, flexWrap: "wrap" }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: "#FFFFFF",
            border: "1px solid " + K.sageBorder, color: K.sage,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="layers" size={23} strokeWidth={1.8} />
          </span>
          <span style={{ minWidth: 0, flex: "1 1 220px" }}>
            <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.2px", color: K.sageText }}>
              {templateInfo.name}
            </span>
            <span style={{ display: "block", fontSize: 13, color: K.sage, marginTop: 2 }}>
              {templateCountInDept} {T2("template dishes in this dept")} ({deptTotal} {T2("total")})
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginLeft: "auto" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: K.ok }}>
              <Icon name="check" size={15} strokeWidth={2.2} />{totalSel} {T2("selected")}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: K.sage }}>
              <Icon name="layers" size={15} strokeWidth={2} />{addonsAvailable} {T2("add-ons available")}
            </span>
          </span>
        </div>
      )}
      */}

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
          // The old panel was built from the C palette - cool grey on a wine
          // accent - which is why an empty result looked like it belonged to a
          // different application than the cards it replaces.
          <div className="kh-cardart-sm" style={{ padding: "56px 24px", textAlign: "center",
            background: K.cardWarm, borderRadius: 20, border: "1px dashed " + K.cardWarmLine, boxShadow: K.shadowCard }}>
            <span style={{ width: 56, height: 56, borderRadius: 18, margin: "0 auto 14px",
              background: K.brandBg, border: "1px solid " + K.brandBorder, color: K.brand,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={top ? "layers" : "search"} size={24} strokeWidth={1.7} />
            </span>
            <div style={{ ...type.cardTitle, fontSize: 16, color: K.hdrTitle, marginBottom: 5 }}>
              {top ? T2("Nothing selected in this department") : T2("No dishes match")}
            </div>
            <div style={{ ...type.meta, color: K.hdrMeta }}>
              {top
                ? (elsewhereTotal + ' ' + T2("selected in") + ' ' + top.label + (elsewhere.length > 1 ? ' ' + T2("and others") : ''))
                : (!showAddons && templateInfo.name
                    ? T2("Enable Show add-ons to browse the full catalogue.")
                    : T2("Try clearing filters or search."))}
            </div>
            {top && setActiveDept && (
              <button onClick={function(){ setActiveDept(top.id); }} className="kh-btn kh-backbtn kh-rip" onPointerDown={ripple}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 16, padding: "10px 18px",
                  borderRadius: K.rPill, background: "#FFFFFF", border: "1px solid " + K.cardWarmLine,
                  color: K.brandText, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: K.fontBody }}>
                {T2("Go to")} {top.label}<Icon name="chevronR" size={14} strokeWidth={2.2} />
              </button>
            )}
          </div>
        );
      })()}

      {/* Section pills — pick one section instead of scrolling through all of them.
          Hidden while searching, since search already spans every section. */}
      {!isSearching && pillTree.length > 1 && (
        <div className="kh-thinscroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
          {pillTree.map(function(p){
            var isActive = activeParent === p;
            var dishCount = p.children.reduce(function(n, g){ return n + g.dishes.length; }, 0);
            var selCount = p.children.reduce(function(n, g){
              return n + g.dishes.filter(function(d){ return !!selectedSet[d.name]; }).length;
            }, 0);
            return (
              <button key={p.key} onClick={function(){ setActiveSectionId(p.children[0].id); }}
                className={"kh-secpill" + (isActive ? " is-on" : "")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0, fontFamily: K.fontBody,
                  padding: "11px 18px", borderRadius: 999, fontSize: 13, fontWeight: isActive ? 700 : 600,
                  background: isActive ? K.brand : "#FFFFFF", color: isActive ? "#FFFFFF" : K.textBody,
                  border: "1px solid " + (isActive ? K.brand : K.cardWarmLine), cursor: "pointer",
                }}>
                <span style={{ fontSize: 15, lineHeight: 1 }}>{p.icon}</span>{p.name}
                <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: isActive ? "rgba(255,255,255,.85)" : K.textFaint }}>
                  {selCount > 0 ? selCount + "/" : ""}{dishCount}
                </span>
                {/* Says the pill opens into more without spelling out how many
                    — the second row answers that the moment it is clicked. */}
                {p.children.length > 1 && (
                  <span style={{ fontSize: 11, opacity: .75 }}>▾</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Second row: the active parent's subsections. Only when there is more
          than one — a parent with a single child is already the pill above. */}
      {!isSearching && activeParent && activeParent.children.length > 1 && (
        <div className="kh-thinscroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16, paddingLeft: 14 }}>
          {activeParent.children.map(function(g){
            var isActive = g.id === activeSectionId;
            var selInSec = g.dishes.filter(function(d){ return !!selectedSet[d.name]; }).length;
            return (
              <span key={g.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                <button onClick={function(){ setActiveSectionId(g.id); }}
                  className={"kh-secpill" + (isActive ? " is-on" : "")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0, fontFamily: K.fontBody,
                    padding: "11px 18px", borderRadius: g.isAdHoc && onRemoveSection ? "999px 0 0 999px" : 999, fontSize: 13, fontWeight: isActive ? 700 : 600,
                    background: isActive ? K.brand : "#FFFFFF", color: isActive ? "#FFFFFF" : K.textBody,
                    border: "1px solid " + (isActive ? K.brand : K.cardWarmLine), borderRight: (g.isAdHoc && onRemoveSection) ? "none" : undefined, cursor: "pointer",
                  }}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>{g.icon}</span>{g.name} <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: isActive ? "rgba(255,255,255,.85)" : K.textFaint }}>{selInSec > 0 ? selInSec + "/" : ""}{g.dishes.length}</span>
                </button>
                {g.isAdHoc && onRemoveSection && (
                  <button onClick={function(){ onRemoveSection(g); if (activeSectionId === g.id) setActiveSectionId(null); }}
                    className="kh-secx"
                    title={T2("Remove this ad-hoc section from this menu")}
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      padding: "11px 12px", borderRadius: "0 999px 999px 0", fontSize: 12, fontWeight: 700, lineHeight: 1,
                      background: isActive ? K.brand : "#FFFFFF", color: isActive ? "rgba(255,255,255,.8)" : K.textFaint,
                      border: "1px solid " + (isActive ? K.brand : K.cardWarmLine), borderLeft: "1px solid " + (isActive ? "rgba(255,255,255,0.4)" : C.border), cursor: "pointer",
                    }}>
                    ✕
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
      {isSearching && groupedByCat.length > 1 && (
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontStyle: "italic" }}>{T2("Showing matches across all sections")}</div>
      )}

      {visibleGroups.map(function(grp){
        // V86 — a package section linked to a catalogue section that itself has
        // subsections (e.g. Pass Around Snacks > Tandoori/Pan Asian/Continental)
        // renders each subsection as its own labeled cluster instead of one
        // flat grid, so sales can still tell what's what while browsing the
        // full pooled catalogue.
        if (grp.subGroups) {
          return (
            <div key={grp.id} style={{ marginBottom: 24 }}>
              <div style={{ ...type.label, fontSize: 11, color: K.hdrMeta, letterSpacing: 0.6, marginBottom: 10, padding: "0 2px" }}>
                {grp.icon} {grp.name} <span style={{ color: C.muted, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· {grp.dishes.length}</span>
              </div>
              {grp.subGroups.map(function(sub){
                var selInSub = sub.dishes.filter(function(d){ return !!selectedSet[d.name]; }).length;
                return (
                  <div key={sub.id} style={{ marginBottom: 16, marginLeft: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 8, padding: "0 2px" }}>
                      ↳ {sub.name} <span style={{ color: C.muted, fontWeight: 500 }}>· {selInSub > 0 ? selInSub + "/" : ""}{sub.dishes.length}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
                      {sub.dishes.map(function(d){
                        return <DishCard key={d.name} d={d} templateSet={templateSet} selectedSet={selectedSet} salesMeta={salesMeta} onToggle={onToggle} />;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }
        return (
          <div key={grp.id} style={{ marginBottom: 24 }}>
            <div style={{ ...type.label, fontSize: 11, color: K.hdrMeta, letterSpacing: 0.6, marginBottom: 10, padding: "0 2px" }}>
              {grp.icon} {grp.name} <span style={{ color: C.muted, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· {grp.dishes.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
              {grp.dishes.map(function(d){
                return <DishCard key={d.name} d={d} templateSet={templateSet} selectedSet={selectedSet} salesMeta={salesMeta} onToggle={onToggle} />;
              })}
            </div>
          </div>
        );
      })}

      {/* V87 — custom dish: confirm its SOP/recipe category + which section/
          subsection pill to place it in, before adding it (mirrors Build
          Menu's MenuEditor.jsx custom-dish modal). */}
      {pendingCustom && (
        <div onClick={function(){ if (!customSaving) setPendingCustom(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={function(e){ e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 460, width: "100%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 14 }}>{T2("Add a dish")}</div>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{T2("Dish name")}</div>
            <input value={pendingCustom.name} autoFocus
              onChange={function(e){ setPendingCustom(function(p){ return { ...p, name: e.target.value }; }); }}
              placeholder={T2("Not in list…")}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.bg, fontSize: 13, color: C.text, boxSizing: "border-box", marginBottom: 16 }} />

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{T2("SOP / recipe section")} <span style={{ textTransform: "none", fontWeight: 500, letterSpacing: 0 }}>({T2("optional")})</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              {(RECIPE_DB.cats || []).map(function(c){
                var active = pendingCustom.catId === c.id;
                return (
                  <button key={c.id} onClick={function(){ setPendingCustom(function(p){ return { ...p, catId: active ? "" : c.id }; }); }}
                    style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                      background: active ? C.green : "transparent", color: active ? "#fff" : C.text,
                      border: "1px solid " + (active ? C.green : C.border) }}>
                    {c.icon} {c.name}
                  </button>
                );
              })}
            </div>

            {placementOptions.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{T2("Menu section")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                  {placementOptions.map(function(o){
                    var active = pendingCustom.sectionId === o.id;
                    return (
                      <button key={o.id} onClick={function(){ setPendingCustom(function(p){ return { ...p, sectionId: active ? "" : o.id }; }); }}
                        style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                          background: active ? C.wine : "transparent", color: active ? "#fff" : C.text,
                          border: "1px solid " + (active ? C.wine : C.border) }}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={function(){ setPendingCustom(null); }} disabled={customSaving}
                style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {T2("Cancel")}
              </button>
              <button onClick={confirmCustom} disabled={!pendingCustom.name.trim() || customSaving}
                style={{ padding: "7px 16px", borderRadius: 8, background: C.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: customSaving ? "wait" : "pointer", opacity: customSaving ? 0.6 : 1 }}>
                {customSaving ? T2("Adding…") : T2("Add dish")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* V87 — add a whole Dish Library catalogue section (its own dishes plus
          any subsections') at once, placed under a chosen pill. */}
      {pendingSection && (
        <div onClick={function(){ if (!sectionSaving) setPendingSection(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={function(e){ e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 460, width: "100%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>📚 {T2("Add section from library")}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>{T2("Gets its own pill named after the catalogue section, tagged as add-ons — nothing is auto-selected. Pick a Menu section below only if you'd rather merge it into an existing pill instead.")}</div>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{T2("Catalogue section")}</div>
            {(!catalogueSectionOptions || catalogueSectionOptions.length === 0) && (
              <div style={{ padding: "10px 12px", borderRadius: 8, background: C.bg, fontSize: 12, color: C.muted, marginBottom: 16 }}>{T2("No catalogue sections routed to this department.")}</div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              {(catalogueSectionOptions || []).map(function(o){
                var active = pendingSection.catSectionId === o.id;
                return (
                  <button key={o.id} onClick={function(){ setPendingSection(function(p){
                      // Defaults the placement to a brand-new pill matching this
                      // catalogue section — NOT whatever tab happens to be active
                      // — so picking "Pre Dining Live" doesn't silently dump its
                      // dishes into an unrelated already-open pill. Re-picking a
                      // "Menu section" pill below still overrides this.
                      return { ...p, catSectionId: o.id, targetId: o.id };
                    }); }}
                    style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                      background: active ? C.wine : "transparent", color: active ? "#fff" : C.text,
                      border: "1px solid " + (active ? C.wine : C.border) }}>
                    {o.label} <span style={{ opacity: 0.7 }}>({o.count})</span>
                  </button>
                );
              })}
            </div>

            {placementOptions.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{T2("Merge into existing menu section")} <span style={{ fontWeight: 400, textTransform: "none", color: C.faint }}>({T2("optional — this event only")})</span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                  {placementOptions.map(function(o){
                    var active = pendingSection.targetId === o.id;
                    return (
                      <button key={o.id} onClick={function(){ setPendingSection(function(p){ return { ...p, targetId: active ? "" : o.id }; }); }}
                        style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                          background: active ? C.wine : "transparent", color: active ? "#fff" : C.text,
                          border: "1px solid " + (active ? C.wine : C.border) }}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={function(){ setPendingSection(null); }} disabled={sectionSaving}
                style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {T2("Cancel")}
              </button>
              <button onClick={confirmAddSection} disabled={!pendingSection.catSectionId || !pendingSection.targetId || sectionSaving}
                style={{ padding: "7px 16px", borderRadius: 8, background: C.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: sectionSaving ? "wait" : "pointer", opacity: sectionSaving ? 0.6 : 1 }}>
                {sectionSaving ? T2("Adding…") : T2("Add section")}
              </button>
            </div>
          </div>
        </div>
      )}
      <KToast open={!!tabToast} toneName={tabToast && tabToast.tone} title={tabToast && tabToast.title}
        body={tabToast && tabToast.body} onClose={function(){ setTabToast(null); }} />
    </div>
  );
}

// V86 — dish card, extracted so it can render inside a subGroups cluster
// (grouped by catalogue subsection) as well as a plain flat grid.
function DishCard({ d, templateSet, selectedSet, salesMeta, onToggle }) {
  var inT = !!templateSet[d.name];
  var isSel = !!selectedSet[d.name];
  var meta = salesMeta[d.name];
  var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
  var dietMeta = DIET_TAGS.find(function(x){ return x.id === diet; });
  var desc = (meta && meta.sales_description) || '';
  var img = (meta && meta.hero_image_url) || d.image || '';

  // Four states, and each one has to be legible at a glance in a grid of forty:
  //   in template + picked  → included, brand green
  //   in template, not picked → available, plain
  //   off template + picked → an add-on, sage, so it is visibly a deliberate extra
  //   off template, not picked → available add-on, dashed
  var dashed = !inT && !isSel;
  // An available add-on wears the same sage as a taken one; outline versus fill
  // is what separates them. It used to be drawn in cardWarmLine — the same
  // near-white as an unpicked template dish — so the dash was the only thing
  // telling the two states apart, at a colour too pale for the dash to read.
  var accent = isSel ? (inT ? K.brand : K.sage) : (dashed ? K.sage : K.cardWarmLine);
  var face   = isSel ? (inT ? K.brandBg : K.sageBg) : "#FFFFFF";

  return (
    <button onClick={function(){ onToggle(d.name); }} className="kh-dishcard kh-rip" onPointerDown={ripple}
      style={{
        position: "relative", padding: 0, borderRadius: 16,
        background: face, border: (isSel ? "1.5px solid " : (dashed ? "1.5px dashed " : "1px solid ")) + accent,
        cursor: "pointer", textAlign: "left", overflow: "hidden", fontFamily: K.fontBody,
        boxShadow: K.shadowCard,
      }}>
      {/* ADD-ON badge */}
      {!inT && isSel && !d.isPhantom && (
        <span style={{ position: "absolute", top: 10, left: 10, zIndex: 2, padding: "3px 9px", borderRadius: K.rPill,
          background: K.sage, color: "#FFFFFF", fontSize: 10, fontWeight: 700, letterSpacing: ".5px" }}>
          {"ADD-ON"}
        </span>
      )}
      {/* PHANTOM badge — dish in package but not in catalogue */}
      {d.isPhantom && (
        <span title="Not in dish catalogue — edit in Dish Library"
          style={{ position: "absolute", top: 10, left: 10, zIndex: 2, display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: K.rPill, background: K.warnBg, border: "1px solid " + K.warnBorder,
            color: K.warn, fontSize: 10, fontWeight: 700, letterSpacing: ".4px" }}>
          <Icon name="alert" size={10} strokeWidth={2.4} />{"NO CAT"}
        </span>
      )}
      {/* Checkbox */}
      <span style={{
        position: "absolute", top: 10, right: 10, zIndex: 2,
        width: 26, height: 26, borderRadius: 8,
        background: isSel ? (inT ? K.brand : K.sage) : "rgba(255,255,255,.92)",
        border: "1.5px solid " + (isSel ? (inT ? K.brand : K.sage) : K.lineStrong),
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#FFFFFF", boxShadow: "0 1px 4px rgba(17,28,51,.16)",
      }}>
        {isSel && <Icon name="check" size={15} strokeWidth={2.6} />}
      </span>

      {/* Image area — a tinted panel with the category glyph when a dish has no
          photograph of its own, rather than a grey box that reads as broken. */}
      <div style={{ height: 116, display: "flex", alignItems: "center", justifyContent: "center",
        background: img ? "transparent" : ((dietMeta && dietMeta.color ? dietMeta.color : K.brand) + "14"),
        backgroundImage: img ? "url(" + img + ")" : "none", backgroundSize: "cover", backgroundPosition: "center" }}>
        {!img && <span style={{ fontSize: 34, opacity: 0.55 }}>{d.catIcon}</span>}
      </div>

      {/* Text area */}
      <div style={{ padding: "12px 13px 13px" }}>
        <div style={{ ...type.cardTitle, color: K.hdrTitle, wordBreak: "break-word" }}>{d.name}</div>
        {desc && <div style={{ ...type.meta, color: K.hdrMeta, marginTop: 4 }}>{desc.length > 60 ? desc.slice(0, 58) + '…' : desc}</div>}
        {!desc && d.hindi && <div style={{ ...type.meta, color: K.textMuted, marginTop: 4 }}>{d.hindi}</div>}
        {/* The state in words. A coloured border alone is not a label, and this
            row is what tells you whether a dish is actually on the menu. */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
          {/* The words follow the border. An available add-on says so in sage,
              so the card reads the same whether you look at its edge or its
              caption; an unpicked template dish stays neutral. */}
          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: isSel ? (inT ? K.ok : K.sage) : (dashed ? K.sage : K.lineStrong) }} />
          <span style={{ fontSize: 12.5, fontWeight: 600,
            color: isSel ? (inT ? K.ok : K.sageText) : (dashed ? K.sageText : K.textFaint) }}>
            {isSel ? (inT ? "Included" : "Add-on") : (dashed ? "Add as extra" : "Select to add")}
          </span>
          {dietMeta && (
            <span title={dietMeta.label} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: K.rPill,
              background: (dietMeta.color || K.brand) + "18", color: dietMeta.color || K.brand }}>
              {dietMeta.label}
            </span>
          )}
        </div>
      </div>
    </button>
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
  // Same shape as the app's main tab strip: a solid deep-green pill for the
  // active tab rather than a thin underline, which is hard to spot at a glance.
  var style = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "9px 16px", borderRadius: 10, border: "none",
    background: active ? K.tabActiveBg : "transparent",
    color: active ? K.tabActiveText : (disabled ? K.textFaint : K.tabIdleText),
    fontSize: 14, fontWeight: active ? 700 : 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap", fontFamily: K.fontBody,
  };
  return <button className={"kh-btn kh-subtab kh-rip" + (active ? " is-on" : "")} onPointerDown={ripple} style={style} disabled={disabled} title={title || ''} onClick={onClick}>{label}</button>;
}

function SubTabStrip({ T2, activeSubTab, setActiveSubTab, hasItems, hasConfigs, totalSel }) {
  // Nothing to switch between means this is not a control, it is a label - and
  // one that was taking a whole row above the panel. The count it carried is
  // already on the department heading and in the Live total rail.
  if (!(hasItems && hasConfigs)) return null;
  return (
    // A tray, not a bare underlined row. Sitting transparent on the page
    // artwork it read as a stray rule with text floating above it - the same
    // failure the station rows had in the Closing tab.
    <div style={{ display: "inline-flex", gap: 4, marginBottom: 12, padding: 4, borderRadius: 13,
      background: K.tabBarBg, border: "1px solid " + K.tabBarLine }}>
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
    </div>
  );
}

function DietChip({ active, onClick, color, label }) {
  return (
    // White when off rather than transparent: these sit on a warm card, and a
    // transparent chip let the card texture through and read as disabled.
    <button onClick={onClick} className={"kh-btn kh-dietchip kh-rip" + (active ? " is-on" : "")} onPointerDown={ripple}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "11px 18px", borderRadius: K.rPill,
        background: active ? color : "#FFFFFF",
        border: "1px solid " + (active ? color : K.cardWarmLine),
        // Off-state text stays the normal dark body colour; the colour only
        // appears once the chip is on, as the fill. Tinting the label too made
        // four unselected chips look like four different states.
        color: active ? "#FFFFFF" : K.textBody,
        fontSize: 13.5, fontWeight: 700, cursor: "pointer",
        fontFamily: K.fontBody, whiteSpace: "nowrap",
      }}>{label}</button>
  );
}

// V78 — ItemsTab/DietChip/ComingSoonPlaceholder/SubTabStrip are pure, prop-driven
// (no proposal-specific coupling) and shared with EventMenuBuilderView.jsx (Booked
// Functions editor) so the item-picking UI stays a single source of truth.
export { ItemsTab, DietChip, ComingSoonPlaceholder, SubTabStrip };
export default MenuBuilderView;