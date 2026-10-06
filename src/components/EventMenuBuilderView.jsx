// Ambria FnB — Event Menu Builder View (Sales, Booked Functions)
// V78: same multi-dept item-picking UI as the Proposal builder (MenuBuilderView.jsx),
// pointed at an already-booked event instead of a draft proposal. Items live in
// event_items (mirrors proposal_items); kitchen-dept selections are also mirrored
// into events.menu so Kitchen Hub's existing production planning keeps working
// unchanged. Place in: src/components/EventMenuBuilderView.jsx

import React, { useState, useEffect, useMemo, useRef } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { detectPackageDiet } from '../utils/helpers.js';
import { RECIPE_DB, createCustomDishInLibrary } from '../data/recipeData.js';
import { SALES_DEPTS, SALES_DEPT_MAP, ITEM_HAVING_DEPTS, DIET_TAGS, DEFAULT_DIET, DEFAULT_DEPT, DEPT_CONFIGS } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import * as menuItemOps from '../lib/menuItemOps.js';
import { useMenuItemGrouping } from '../utils/useMenuItemGrouping.js';
import { ItemsTab, DietChip, ComingSoonPlaceholder, SubTabStrip, LiveTotalRows } from './MenuBuilderView.jsx';
import { ConfigsPanel } from './ConfigsPanel.jsx';
import { FunctionPlanTab } from './FunctionPlanTab.jsx';
import { FunctionPlanPrintView } from './FunctionPlanPrintView.jsx';
import { KModal } from './KitchenUI.jsx';
import { getFpUnlockCode } from '../data/appSettings.js';
import { K, type } from '../utils/theme.js';
import { ripple } from '../utils/ripple.js';
import { Icon } from './Icons.jsx';
import { useIsMobile } from '../utils/useIsMobile.js';

// V79 — events.menu_package is free text (LMS sync, manual entry...) and often
// doesn't match a MENU_PACKAGES key byte-for-byte (e.g. "Multi-Cuisine Veg" vs
// the canonical "Multi Cuisine Veg") even though it's clearly the same package.
// Normalize punctuation/case before comparing so this still resolves.
function normalizePkgName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function EventMenuBuilderView({ event, onClose, lang = "en", currentUser = null, initialTab = 'items', autoOpenPrint = false }) {
  var T2 = function(s) { return T(s, lang); };
  var isMobile = useIsMobile();

  var [activeDept, setActiveDept]   = useState('kit');
  // The live-total rail starts closed on every visit, same as the Proposal
  // builder — it's a reference reached for now and then, not something read
  // while picking dishes, and open by default it takes 232px permanently.
  var [railOpen, setRailOpen] = useState(false);
  var [activeSubTab, setActiveSubTab] = useState(initialTab); // 'items' | 'fp'
  // V88 — dept-scoped choice between the item-picker and the Configs panel
  // (Service/Crockery/Transport), same pattern as MenuBuilderView.jsx's proposal
  // builder. Independent of activeSubTab, which switches the whole page between
  // the item builder and the Function Plan.
  var [activeDeptTab, setActiveDeptTab] = useState('items'); // 'items' | 'configs'
  var [dishItems, setDishItems]     = useState([]);        // event_items rows
  var [salesMeta, setSalesMeta]     = useState({});
  var [loading, setLoading]         = useState(true);
  var [seeding, setSeeding]         = useState(false);
  var [searchQ, setSearchQ]         = useState('');
  var [dietFilter, setDietFilter]   = useState('all');
  var [showAddons, setShowAddons]   = useState(false);
  // V87 — reuses events.menu_section_overrides (the same column Build Menu's
  // MenuEditor.jsx already writes) so a custom dish tagged here shows in the
  // same place if the event is later opened in Build Menu, and vice versa.
  var [sectionOverrides, setSectionOverrides] = useState(event && event.menu_section_overrides || {});
  // V78 — Function Plan (food preference, spice tolerance, allergies, notes)
  var [fp, setFp]                   = useState(null);
  var [showFPPrint, setShowFPPrint] = useState(false);
  // V89 — Service/Crockery/Transport configs, fetched fresh right before print
  // so the "1 doc for kitchen + service" always reflects the latest saves,
  // rather than being kept in sync with ConfigsPanel's own internal state.
  var [printConfigs, setPrintConfigs] = useState({});
  async function openFPPrint() {
    try {
      var res = await supabase.from('event_configs').select('*').eq('event_id', event.id);
      if (res.error) throw res.error;
      var next = {};
      (res.data || []).forEach(function(r){
        if (!next[r.dept_id]) next[r.dept_id] = {};
        next[r.dept_id][r.config_key] = r.config_value;
      });
      setPrintConfigs(next);
    } catch (e) {
      console.error('[EventMenuBuilder] load configs for print failed:', e);
      setPrintConfigs({});
    }
    setShowFPPrint(true);
  }
  // Jumping here straight from the Build Menu list (its own "View FP" button)
  // skips the normal flow of opening the event then clicking into Function
  // Plan — but the print view needs fp and dishItems/salesMeta (for
  // itemsByDept/menuDiffByDept below) loaded first, so it waits for both
  // loads to finish rather than firing on mount with empty data.
  var autoOpenedRef = useRef(false);
  useEffect(function(){
    if (!autoOpenPrint || autoOpenedRef.current) return;
    if (loading || fp == null) return;
    autoOpenedRef.current = true;
    openFPPrint();
  // eslint-disable-next-line
  }, [autoOpenPrint, loading, fp]);

  var hasItems   = ITEM_HAVING_DEPTS.indexOf(activeDept) >= 0;
  var hasConfigs = activeDept !== 'kit' && !!(DEPT_CONFIGS[activeDept] && DEPT_CONFIGS[activeDept].length > 0);

  // ── Template dishes: resolved directly from event.menu_package (a name, not an
  // id — events store the package name straight on the row). No stale-catalogue
  // race like proposals had (that only existed because of the id→name lookup). ──
  var [pkgVer, setPkgVer] = useState(0);
  useEffect(function(){
    var h = function(){ setPkgVer(function(v){ return v + 1; }); };
    window.addEventListener('ambria:menu-packages-refreshed', h);
    return function(){ window.removeEventListener('ambria:menu-packages-refreshed', h); };
  }, []);
  // MENU_PACKAGES is hydrated once at app boot (no per-component fetch/race like
  // proposals' id→name lookup needed) — pkgVer just forces a re-eval after edits.
  var pkgNameIndex = useMemo(function(){
    var m = {};
    Object.keys(MENU_PACKAGES).forEach(function(name){ m[normalizePkgName(name)] = name; });
    return m;
  // eslint-disable-next-line
  }, [pkgVer]);
  function resolvePkgName(raw) {
    if (!raw) return null;
    if (MENU_PACKAGES[raw]) return raw;
    return pkgNameIndex[normalizePkgName(raw)] || null;
  }
  var templateInfo = useMemo(function(){
    var raw = event && (event.menu_package || event.menuPackage) || null;
    var name = resolvePkgName(raw);
    if (!name) return { name: null, dishes: [], diet: null };
    return { name: name, dishes: MENU_PACKAGES[name] || [], diet: detectPackageDiet(name) };
  // eslint-disable-next-line
  }, [event, pkgVer, pkgNameIndex]);

  // A veg-base event has no business surfacing non-veg add-ons by default —
  // default the diet filter to the function's own diet (still overridable via
  // the filter chips, e.g. to add a paid non-veg live counter to a veg wedding).
  useEffect(function(){
    if (templateInfo.diet === 'veg' || templateInfo.diet === 'nonveg') {
      setDietFilter(templateInfo.diet);
    }
  // eslint-disable-next-line
  }, [templateInfo.name]);

  // ── All dishes (from dishes_master via getAllDishes) ──
  // dishLibBump forces a re-read after addCustomDish adds a brand-new dish —
  // getAllDishes() reads DISH_MASTER, a plain in-memory object createCustomDish
  // mutates directly (not React state), so without this the empty dep array
  // below would keep serving the mount-time snapshot forever: the new dish
  // would get selected (event_items) but never appear in ANY section group,
  // since groupedByPkgSection/groupedBySection look it up by name in here.
  var [dishLibBump, setDishLibBump] = useState(0);
  // ── dish_catalogue_sections (all depts) ──
  var [sections, setSections] = useState([]);
  useEffect(function(){
    var cancelled = false;
    (async function(){
      try {
        var rows = await fetchAllRows(function(){
          return supabase.from('dish_catalogue_sections')
            .select('id, name, sort_order, sop_category_hint, sales_dept, dept, parent_section_id, addon_price_per_pax')
            .order('sort_order', { ascending: true });
        });
        if (!cancelled) setSections(rows || []);
      } catch (e) {
        console.warn('[EventMenuBuilder] sections load failed, falling back to cat grouping:', e);
      }
    })();
    return function(){ cancelled = true; };
  }, []);

  var itemsOpsConfig = {
    itemsTable: 'event_items', itemsFk: 'event_id', itemsFkValue: event.id,
    parentTable: 'events', parentIdValue: event.id, initializedColumn: 'event_items_initialized',
  };

  // Placed early (right after `sections` is declared) rather than down near
  // deptCounts where MenuBuilderView.jsx keeps its own copy — several
  // existing useMemos below (itemsByDept, menuDiffByDept) already call
  // effectiveDeptForDish/read dishNameToPkgDept etc. inline at THEIR own
  // position in render order, not just inside a later event handler; a
  // useMemo factory runs immediately when its statement executes, so those
  // would have read this hook's outputs as still-undefined var-hoisted
  // placeholders had this call stayed any later in the file.
  var grouping = useMenuItemGrouping({
    dishItems: dishItems, templateInfo: templateInfo, sections: sections, sectionOverrides: sectionOverrides,
    activeDept: activeDept, dietFilter: dietFilter, searchQ: searchQ, showAddons: showAddons,
    salesMeta: salesMeta, dishLibBump: dishLibBump, pax: event && event.pax, noPackage: !templateInfo.name, T2: T2,
  });
  var allDishes = grouping.allDishes;
  var allDishesByName = grouping.allDishesByName;
  var sectionSalesDeptMap = grouping.sectionSalesDeptMap;
  var catSubsByParent = grouping.catSubsByParent;
  var catalogueSectionOptions = grouping.catalogueSectionOptions;
  var templateSet = grouping.templateSet;
  var selectedSet = grouping.selectedSet;
  var focSet = grouping.focSet;
  var dishNameToPkgDept = grouping.dishNameToPkgDept;
  var sectionOverrideDept = grouping.sectionOverrideDept;
  var deptCounts = grouping.deptCounts;
  var deptAddonTotal = grouping.deptAddonTotal;
  var grandTotal = grouping.grandTotal;
  var deptDishes = grouping.deptDishes;
  var templateDishesInDept = grouping.templateDishesInDept;
  var catalogueTree = grouping.catalogueTree;
  var groupedByCat = grouping.groupedByCat;
  var groupedBySection = grouping.groupedBySection;
  var groupedByPkgSection = grouping.groupedByPkgSection;

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
    var evRes = await supabase.from('events').select('event_items_initialized, menu, menu_package').eq('id', event.id).single();
    if (evRes.error) throw evRes.error;
    if (evRes.data.event_items_initialized) return await loadItems();

    var existing = await loadItems();
    if (existing.length > 0) {
      await supabase.from('events').update({ event_items_initialized: true }).eq('id', event.id);
      return existing;
    }

    var legacyMenu = Array.isArray(evRes.data.menu) ? evRes.data.menu.filter(Boolean) : [];
    var seedNames = legacyMenu;
    if (seedNames.length === 0) {
      // Raw events.menu can be legitimately empty for LMS-synced events that were
      // never manually customized — the real menu only exists as the resolved
      // package's dish list (same as App.jsx resolves it for display elsewhere).
      var pkgName = resolvePkgName(evRes.data.menu_package);
      if (pkgName) seedNames = MENU_PACKAGES[pkgName] || [];
    }
    if (seedNames.length === 0) {
      await supabase.from('events').update({ event_items_initialized: true }).eq('id', event.id);
      return [];
    }

    setSeeding(true);
    try {
      var rows = seedNames.map(function(d, i){ return { event_id: event.id, dish_name: d, is_addon: false, ordering: i }; });
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

  // V90 — FOC (free of cost): an add-on dish a sales person waives the
  // charge on for this guest. Only meaningful on add-ons — template dishes
  // are already covered by the package's own per-head budget.
  function toggleFoc(dishName) {
    if (blockIfMenuLocked()) return;
    return menuItemOps.toggleFocItem(itemsOpsConfig, dishItems, dishName, setDishItems);
  }

  // Outsourced (vendor-supplied) dishes — same events.outsourced_dishes array
  // Kitchen Hub, Transport & Dispatch and Store already read to keep a vendor
  // item out of production tracking/ordering (see TransportDispatch.jsx's
  // menuArr / KitchenHub.jsx), so toggling it here takes effect everywhere,
  // not just in this builder.
  var [outsourcedDishes, setOutsourcedDishes] = useState(function(){
    return (event && Array.isArray(event.outsourced_dishes)) ? event.outsourced_dishes : [];
  });
  var outsourcedSet = useMemo(function(){
    var s = {}; outsourcedDishes.forEach(function(n){ s[n] = true; }); return s;
  }, [outsourcedDishes]);
  async function toggleOutsourced(dishName) {
    if (blockIfMenuLocked()) return;
    var isOut = !!outsourcedSet[dishName];
    var next = isOut ? outsourcedDishes.filter(function(n){ return n !== dishName; }) : outsourcedDishes.concat([dishName]);
    var prev = outsourcedDishes;
    setOutsourcedDishes(next);
    try {
      var res = await supabase.from('events').update({ outsourced_dishes: next }).eq('id', event.id);
      if (res.error) throw res.error;
    } catch (e) {
      console.error('[EventMenuBuilder] toggleOutsourced failed:', e);
      setOutsourcedDishes(prev);
    }
  }

  function effectiveDeptForDish(name) {
    var d = allDishesByName[name];
    var override = d && d.section_id ? sectionSalesDeptMap[d.section_id] : null;
    var meta = salesMeta[name];
    return sectionOverrideDept[name] || dishNameToPkgDept[name] || override || (meta && meta.sales_dept) || DEFAULT_DEPT;
  }

  // Kitchen Hub's entire production pipeline reads events.menu as a flat kitchen
  // dish list — keep it in perfect sync so nothing there needs to change.
  async function mirrorKitchenMenu(items) {
    var kitchenNames = items.filter(function(x){ return effectiveDeptForDish(x.dish_name) === 'kit'; }).map(function(x){ return x.dish_name; });
    try {
      var res = await supabase.from('events').update({ menu: kitchenNames }).eq('id', event.id);
      if (res.error) throw res.error;
    } catch (e) {
      console.error('[EventMenuBuilder] mirrorKitchenMenu failed:', e);
      alert(T2('Kitchen Hub menu sync failed — this dish list may not reach Kitchen Hub:') + ' ' + (e.message || e));
    }
  }

  // V79 — self-heal once right after the initial load finishes (using the fresh,
  // post-render salesMeta/dishNameToPkgDept — not the stale closures still in
  // scope inside boot() itself). Covers events whose items arrived by some path
  // other than a toggle in this editor (e.g. converted from a won proposal), so
  // Kitchen Hub sees the right menu the moment anyone opens this event, not only
  // after the next manual toggle.
  useEffect(function(){
    if (loading || !event || !event.id) return;
    mirrorKitchenMenu(dishItems);
  // eslint-disable-next-line
  }, [loading]);

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
    if (!next.created_by && currentUser && currentUser.name) next.created_by = currentUser.name;
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

  // ── Lock / unlock (V92) — "Mark as Final" freezes the FP once it's been
  // reviewed and is ready for Kitchen; re-opening it for a late change always
  // asks for a reason so there's a record of why a locked plan moved. Both
  // transitions append to lock_history rather than overwrite it, and also
  // fire a kitchen notification (in-app bell + web push — notifyKitchen
  // below) so chefs actually see the release/late-change, not just an audit
  // trail nobody opens.
  var [fpLockModal, setFpLockModal] = useState(null); // null | 'lock' | 'unlock'
  var [unlockReason, setUnlockReason] = useState('');
  // Admin-set in Access Manager (Security card) — a shared code staff must
  // enter to re-open a locked FP, so it takes more than just typing any
  // reason into the prompt below. Empty = admin hasn't set one, so unlocking
  // falls back to reason-only, same as before this existed.
  var [unlockCode, setUnlockCode] = useState('');
  // The person who marked it final can always re-open their own FP with just
  // a reason, same as before the code existed — the code is only a gate
  // against someone OTHER than the locker re-opening it.
  var isOwnLock = !!(fp && fp.locked_by && currentUser && currentUser.name && fp.locked_by === currentUser.name);
  var requiredUnlockCode = isOwnLock ? '' : getFpUnlockCode();

  // A locked FP has to freeze the menu too — otherwise "locking" only
  // protects the text fields while dishes keep changing underneath it,
  // which is no protection at all. Unlocking (via the existing flow above —
  // free for whoever locked it, code-gated for anyone else) is the one gate
  // for both; there's no separate bypass for menu edits specifically.
  function blockIfMenuLocked() {
    if (!(fp && fp.locked)) return false;
    alert(T2('This Function Plan is locked. Unlock it first to change the menu.'));
    return true;
  }

  async function writeFpLockState(patch, histEntry) {
    var next = { ...(fp || { event_id: event.id }), ...patch,
      lock_history: [ ...((fp && fp.lock_history) || []), histEntry ] };
    if (!next.created_by && currentUser && currentUser.name) next.created_by = currentUser.name;
    setFp(next);
    try {
      var res = await supabase.from('event_function_plans').upsert(next, { onConflict: 'event_id' }).select().single();
      if (res.error) throw res.error;
      setFp(res.data);
    } catch (e) {
      console.error('[EventMenuBuilder] FP lock state save failed:', e);
      alert(T2('Failed to save:') + ' ' + (e.message || e));
    }
  }

  // Best-effort: a notification failing to send should never block the lock/
  // unlock itself, so this never throws into its caller.
  async function notifyKitchen(kind, title, body) {
    try {
      var ins = await supabase.from('notifications').insert({
        target_role: 'kitchen', event_id: event.id, kind: kind, title: title, body: body,
      }).select().single();
      if (ins.error) throw ins.error;
      // Push is background delivery only (closed/backgrounded tabs) — an open
      // tab already got this via the realtime insert above, so a failure here
      // (no VAPID secrets configured yet, no subscribed devices...) is fine to
      // swallow rather than surface to whoever just locked the FP.
      supabase.functions.invoke('send-push', { body: { notification_id: ins.data.id } }).catch(function (e) {
        console.error('[EventMenuBuilder] send-push invoke failed:', e);
      });
    } catch (e) {
      console.error('[EventMenuBuilder] notifyKitchen failed:', e);
    }
  }

  async function confirmMarkFinal() {
    var who = (currentUser && currentUser.name) || null;
    await writeFpLockState(
      { locked: true, locked_at: new Date().toISOString(), locked_by: who },
      { action: 'locked', by: who, at: new Date().toISOString() }
    );
    setFpLockModal(null);
    notifyKitchen('fp_locked', T2('FP released') + ': ' + (event.guest || T2('Function')),
      (event.date ? event.date + ' · ' : '') + (who ? T2('by') + ' ' + who : ''));
  }

  async function confirmUnlock() {
    var who = (currentUser && currentUser.name) || null;
    var reason = unlockReason.trim();
    if (!reason) return;
    if (requiredUnlockCode && unlockCode.trim() !== requiredUnlockCode) return;
    await writeFpLockState(
      { locked: false },
      { action: 'unlocked', by: who, at: new Date().toISOString(), reason: reason }
    );
    setFpLockModal(null);
    setUnlockReason('');
    setUnlockCode('');
    notifyKitchen('fp_unlocked', T2('FP changed — last-minute update') + ': ' + (event.guest || T2('Function')),
      reason + (who ? ' (' + who + ')' : ''));
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

  // ── Package vs. actual-selection diff, per dept, for the printable FP ──
  // Replaces a full dish-by-dish listing with just the package name plus
  // whatever changed against it: a dept with only additions is an "Add-on"
  // (green), only removals is a "Deduction" (red), and both together is a
  // "Swap" (blue) — kitchen/service only need to see what differs from the
  // base package, not re-read the whole menu every time.
  var menuDiffByDept = useMemo(function(){
    if (!templateInfo.name || !templateInfo.dishes || templateInfo.dishes.length === 0) return {};
    var pkgSet = new Set(templateInfo.dishes);
    var selSet = new Set(dishItems.map(function(x){ return x.dish_name; }));
    var addedByDept = {}, removedByDept = {};
    dishItems.forEach(function(x){
      if (!pkgSet.has(x.dish_name)) {
        var dept = effectiveDeptForDish(x.dish_name);
        (addedByDept[dept] = addedByDept[dept] || []).push(x.dish_name);
      }
    });
    templateInfo.dishes.forEach(function(name){
      if (!selSet.has(name)) {
        var dept = dishNameToPkgDept[name] || DEFAULT_DEPT;
        (removedByDept[dept] = removedByDept[dept] || []).push(name);
      }
    });
    var out = {};
    SALES_DEPTS.forEach(function(d){
      var added = addedByDept[d.id] || [];
      var removed = removedByDept[d.id] || [];
      if (added.length === 0 && removed.length === 0) return;
      var kind = (added.length > 0 && removed.length > 0) ? 'swap' : (added.length > 0 ? 'addon' : 'deduction');
      out[d.id] = { added: added, removed: removed, kind: kind };
    });
    return out;
  // eslint-disable-next-line
  }, [dishItems, templateInfo.name, templateInfo.dishes, dishNameToPkgDept, allDishesByName, sectionSalesDeptMap, salesMeta]);

  // ── Toggle dish: insert or delete in event_items, mirror kitchen dept to events.menu ──
  async function toggleDish(dishName) {
    if (blockIfMenuLocked()) return;
    var dept = effectiveDeptForDish(dishName);
    try {
      var result = await menuItemOps.toggleDishItem(itemsOpsConfig, dishItems, dishName, !!templateSet[dishName], setDishItems);
      if (dept === 'kit') await mirrorKitchenMenu(result.nextItems);
    } catch (e) {
      console.error('[EventMenuBuilder] toggle failed:', e);
      await loadItems().then(setDishItems);
      alert(T2('Failed to update dish:') + ' ' + (e.message || e));
    }
  }

  // V87 — persist a dish's section/subsection tag on the SAME events.menu_section_overrides
  // column Build Menu's MenuEditor.jsx writes, so tagging here and tagging there agree.
  function saveSectionOverride(dishName, sectionId) {
    return menuItemOps.saveSectionOverride(itemsOpsConfig, sectionOverrides, dishName, sectionId, setSectionOverrides);
  }

  // V87 — add a brand-new dish: library entry + SOP stub (shared helper),
  // select it for this event, and tag which section/subsection pill it shows
  // under (this event only — never touches the shared package).
  async function addCustomDish(name, catId, sectionId) {
    if (blockIfMenuLocked()) return;
    await createCustomDishInLibrary(supabase, name, catId);
    setDishLibBump(function(n){ return n + 1; });
    var result = await menuItemOps.addDishItem(itemsOpsConfig, dishItems, name, setDishItems);
    if (effectiveDeptForDish(name) === 'kit') await mirrorKitchenMenu(result.nextItems);
    if (sectionId) await saveSectionOverride(name, sectionId);
  }

  // Same as addCustomDish, minus the library-creation step — for a dish the
  // chef picked from the existing library search instead of typing a new one.
  async function addExistingDish(name, sectionId) {
    if (blockIfMenuLocked()) return;
    var result = await menuItemOps.addDishItem(itemsOpsConfig, dishItems, name, setDishItems);
    if (effectiveDeptForDish(name) === 'kit') await mirrorKitchenMenu(result.nextItems);
    if (sectionId) await saveSectionOverride(name, sectionId);
  }

  // V87 — add every dish in a chosen catalogue section (its own dishes plus,
  // if it's a parent, all of its subsections') as selected add-ons, tagged to
  // whichever section/subsection pill the user picked to place them.
  // V88 — bring in a chosen catalogue section as browsable, UNselected cards
  // under the chosen pill — no event_items insert, so nothing is auto-picked;
  // the user selects individual dishes from there via the normal onToggle.
  function addSectionFromLibrary(catSectionId, targetId) {
    if (blockIfMenuLocked()) return;
    var subIds = (catSubsByParent[catSectionId] || []).map(function(s){ return s.id; });
    return menuItemOps.addSectionFromLibrary(itemsOpsConfig, sectionOverrides, catSectionId, targetId, subIds, setSectionOverrides);
  }

  // V88 — remove an ad-hoc pill (one created by "Add section from library",
  // not a real package section) from THIS event's menu builder: clears every
  // dish's tag pointing at it (and its subsection buckets) — metadata-only,
  // mirrors MenuBuilderView.jsx's removeAdHocSection.
  function removeAdHocSection(grp) {
    if (blockIfMenuLocked()) return;
    return menuItemOps.removeAdHocSection(itemsOpsConfig, sectionOverrides, grp, setSectionOverrides);
  }

  // Only ever ADDS missing package dishes — never removes or duplicates existing selections.
  async function loadPackageDefaults() {
    if (blockIfMenuLocked()) return;
    if (!event || !event.id || templateInfo.dishes.length === 0 || seeding) return;
    setSeeding(true);
    try {
      var result = await menuItemOps.loadPackageDefaultItems(itemsOpsConfig, dishItems, templateInfo.dishes, setDishItems);
      if (result.added.length === 0) { alert(T2('All package dishes are already selected.')); return; }
      await mirrorKitchenMenu(result.nextItems);
    } catch (e) {
      console.error('[EventMenuBuilder] loadPackageDefaults failed:', e);
      alert(T2('Failed to load package defaults:') + ' ' + (e.message || e));
    } finally {
      setSeeding(false);
    }
  }

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
        packageName={templateInfo.name}
        menuDiffByDept={menuDiffByDept}
        configsByDept={printConfigs}
        onClose={function(){
          // Jumped straight here from the Build Menu list (autoOpenPrint) —
          // closing should return to that list, not fall back to the full
          // item-builder underneath, which the user never asked to see.
          if (autoOpenPrint && onClose) onClose(); else setShowFPPrint(false);
        }}
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
            <FunctionPlanTab T2={T2} fp={fp} event={event} onSaveField={saveFPField} onOpenPrint={openFPPrint}
              locked={!!(fp && fp.locked)}
              onRequestLock={function(){ setFpLockModal('lock'); }}
              onRequestUnlock={function(){ setFpLockModal('unlock'); }} />
          )}
        </div>
      )}

      {activeSubTab === 'items' && fp && fp.locked && (
        <div style={{ margin: "0 16px", padding: "10px 16px", borderRadius: 10, background: C.warnBg || '#FFF3E0', border: "1px solid " + (C.warnBorder || '#FFD9A8'), color: C.warn || '#A15C00', fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          🔒 {T2("This Function Plan is locked — the menu can't be changed until it's unlocked.")}
          <button onClick={function(){ setActiveSubTab('fp'); }} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontSize: 12.5 }}>
            {T2("Go to Function Plan")}
          </button>
        </div>
      )}

      {/* ── Body: sidebar + main ── */}
      {activeSubTab === 'items' && (
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden", gap: isMobile ? 8 : 16, padding: isMobile ? "8px 8px 8px" : "14px 16px 16px", minHeight: 0 }}>
        {/* ── Dept picker — a vertical sidebar on desktop, a horizontally-
            scrollable chip row on mobile (switching department is a constant
            action while building a menu, so it stays a single tap away). ── */}
        {isMobile ? (
          <div style={{ flexShrink: 0, display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
            {SALES_DEPTS.map(function(d){
              var isActive = activeDept === d.id;
              var counts = deptCounts[d.id] || { sel: 0, total: 0 };
              var deptHasItems   = ITEM_HAVING_DEPTS.indexOf(d.id) >= 0;
              var deptHasConfigs = !!(DEPT_CONFIGS[d.id] && DEPT_CONFIGS[d.id].length > 0);
              var isFunctional   = deptHasItems || deptHasConfigs;
              return (
                <button key={d.id} className={"kh-btn kh-deptbtn kh-rip" + (isActive ? " is-on" : "")} onPointerDown={ripple}
                  onClick={function(){ setActiveDept(d.id); setActiveDeptTab(deptHasItems ? 'items' : 'configs'); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                    padding: "8px 12px", borderRadius: 999,
                    background: isActive ? K.sageSel : K.cardWarm,
                    border: "1px solid " + (isActive ? K.sage : K.cardWarmLine),
                    color: isActive ? K.sageText : K.textBody,
                    fontSize: 12.5, fontWeight: isActive ? 700 : 600,
                    cursor: "pointer", whiteSpace: "nowrap", fontFamily: K.fontBody,
                    opacity: isFunctional ? 1 : 0.6,
                  }}>
                  <Icon name={d.glyph || "utensils"} size={14} strokeWidth={1.9} color={d.color || K.brand} />
                  {d.name}
                  {isFunctional && counts.sel > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: K.brandText }}>{counts.sel}</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
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
            var isFunctional   = deptHasItems || deptHasConfigs;
            return (
              <button key={d.id} className={"kh-btn kh-deptbtn kh-rip" + (isActive ? " is-on" : "")} onPointerDown={ripple}
                onClick={function(){
                  setActiveDept(d.id);
                  setActiveDeptTab(deptHasItems ? 'items' : 'configs');
                }}
                style={{
                  position: "relative", zIndex: 1,
                  display: "flex", alignItems: "center", gap: 11, width: "100%",
                  padding: "10px 12px", marginBottom: 5, borderRadius: 13,
                  background: isActive ? K.sageSel : "transparent",
                  border: "1px solid " + (isActive ? K.sage : "transparent"),
                  color: isActive ? K.sageText : K.textBody,
                  ...type.rowTitle, fontWeight: isActive ? 700 : 600,
                  cursor: "pointer", textAlign: "left", fontFamily: K.fontBody,
                  opacity: isFunctional ? 1 : 0.6,
                }}>
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
        )}

        {/* ── Main area ── */}
        <div className="kh-thinscroll" style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingRight: 2 }}>
          {loading && (
            <div className="kh-cardart-sm" style={{ padding: "60px 20px", textAlign: "center", color: K.hdrMeta,
              borderRadius: 20, backgroundColor: K.cardWarm, border: "1px solid " + K.cardWarmLine, boxShadow: K.shadowCard }}>
              <div style={{ color: K.textFaint, display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <Icon name={seeding ? "layers" : "refresh"} size={28} strokeWidth={1.7} />
              </div>
              <div style={{ fontSize: 14 }}>{seeding ? T2("Loading existing menu…") : T2("Loading menu builder…")}</div>
            </div>
          )}

          {!loading && (hasItems || hasConfigs) && (
            <div>
              <SubTabStrip
                T2={T2}
                activeSubTab={activeDeptTab} setActiveSubTab={setActiveDeptTab}
                hasItems={hasItems} hasConfigs={hasConfigs}
                totalSel={(deptCounts[activeDept] || {}).sel || 0}
              />

              {hasItems && activeDeptTab === 'items' && (
                <ItemsTab
                  T2={T2}
                  activeDept={activeDept}
                  searchQ={searchQ} setSearchQ={setSearchQ}
                  dietFilter={dietFilter} setDietFilter={setDietFilter}
                  showAddons={showAddons} setShowAddons={setShowAddons}
                  deptDishes={deptDishes}
                  groupedByCat={groupedByPkgSection || groupedBySection || groupedByCat}
                  catalogueTree={catalogueTree}
                  templateSet={templateSet}
                  selectedSet={selectedSet}
                  outsourcedSet={outsourcedSet}
                  onToggleOutsourced={toggleOutsourced}
                  salesMeta={salesMeta}
                  onToggle={toggleDish}
                  focSet={focSet}
                  onToggleFoc={toggleFoc}
                  templateInfo={templateInfo}
                  templateDishesInDept={templateDishesInDept}
                  deptCounts={deptCounts[activeDept]}
                  onLoadDefaults={loadPackageDefaults}
                  seeding={seeding}
                  onAddCustomDish={addCustomDish}
                  onAddExistingDish={addExistingDish}
                  allDishes={allDishes}
                  catalogueSectionOptions={catalogueSectionOptions}
                  onAddSectionFromLibrary={addSectionFromLibrary}
                  onRemoveSection={removeAdHocSection}
                />
              )}

              {hasConfigs && activeDeptTab === 'configs' && (
                <ConfigsPanel
                  proposal={event}
                  activeDept={activeDept}
                  lang={lang}
                  configTable="event_configs"
                  idField="event_id"
                />
              )}
            </div>
          )}

          {!loading && !hasItems && !hasConfigs && (
            <ComingSoonPlaceholder T2={T2} dept={SALES_DEPT_MAP[activeDept]} />
          )}
        </div>

        {/* ── Live totals — collapsible: a slim edge tab until opened, same as
            the Proposal builder, so it doesn't take permanent width away from
            the dish grid. ── */}
        {!isMobile && !railOpen && (
          <button onClick={function(){ setRailOpen(true); }} className="kh-btn kh-rip" onPointerDown={ripple}
            title={T2("Show live total")}
            style={{ flexShrink: 0, alignSelf: "flex-start", width: 42, padding: "14px 0 16px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              borderRadius: 16, backgroundColor: K.cardWarm, border: "1px solid " + K.cardWarmLine,
              boxShadow: K.shadowCard, cursor: "pointer", fontFamily: K.fontBody }}>
            <Icon name="chevronL" size={15} strokeWidth={2.2} />
            <span style={{ writingMode: "vertical-rl", flexShrink: 0, whiteSpace: "nowrap",
              ...type.label, fontSize: 10, color: K.hdrMeta }}>
              {T2("Live total")}
            </span>
          </button>
        )}
        {!isMobile && railOpen && (
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
            <LiveTotalRows T2={T2} deptCounts={deptCounts} deptAddonTotal={deptAddonTotal} grandTotal={grandTotal} />
          </div>
        </div>
        )}
      </div>
      )}

      {/* ── Mobile live-total: floating pill + bottom sheet ── */}
      {activeSubTab === 'items' && isMobile && !railOpen && (
        <button onClick={function(){ setRailOpen(true); }} className="kh-rip" onPointerDown={ripple}
          style={{ position: "fixed", right: 14, bottom: 14, zIndex: 40, display: "flex", alignItems: "center", gap: 8,
            padding: "11px 16px", borderRadius: 999, backgroundColor: K.brand, color: "#FFFFFF",
            border: "none", boxShadow: K.shadowLift, cursor: "pointer", fontFamily: K.fontBody }}>
          <Icon name="chart" size={16} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{grandTotal} {T2("items")}</span>
        </button>
      )}
      {activeSubTab === 'items' && isMobile && railOpen && (
        <div onClick={function(){ setRailOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,16,12,.45)", display: "flex", alignItems: "flex-end" }}>
          <div onClick={function(e){ e.stopPropagation(); }} style={{ width: "100%", maxHeight: "75vh", overflowY: "auto",
            backgroundColor: K.cardWarm, borderRadius: "20px 20px 0 0", border: "1px solid " + K.cardWarmLine,
            boxShadow: K.shadowLift, padding: "16px 16px 20px" }} className="kh-thinscroll">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ color: K.sbGold, display: "flex" }}><Icon name="chart" size={18} strokeWidth={2} /></span>
              <span style={{ ...type.sectionHead, fontSize: 19, color: K.hdrTitle, flex: 1, minWidth: 0 }}>{T2("Live total")}</span>
              <button onClick={function(){ setRailOpen(false); }} className="kh-btn kh-iconbtn kh-rip" onPointerDown={ripple}
                title={T2("Close")}
                style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, padding: 0, cursor: "pointer",
                  background: "transparent", border: "1px solid " + K.cardWarmLine, color: K.textMuted,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={16} strokeWidth={2.2} />
              </button>
            </div>
            <LiveTotalRows T2={T2} deptCounts={deptCounts} deptAddonTotal={deptAddonTotal} grandTotal={grandTotal} />
          </div>
        </div>
      )}

      <KModal open={fpLockModal === 'lock'} toneName="brand" icon="lock"
        title={T2("Mark Function Plan as Final?")}
        body={T2("This locks the FP so it can't be changed by mistake, and signals to Kitchen that it's ready. You'll need a reason to re-open it later if something changes last-minute.")}
        confirmLabel={T2("Lock & send to Kitchen")} confirmIcon="lock"
        onConfirm={confirmMarkFinal}
        onClose={function(){ setFpLockModal(null); }} />

      <KModal open={fpLockModal === 'unlock'} toneName="warn" icon="alert"
        title={T2("Re-open this Function Plan?")}
        body={<>
          <div style={{ marginBottom: 10 }}>{T2("This FP was marked final. Say why it needs to change — this is kept against the FP so there's a record of the late change.")}</div>
          <textarea autoFocus value={unlockReason} onChange={function(e){ setUnlockReason(e.target.value); }}
            placeholder={T2("Reason for re-opening…")} rows={3}
            style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid " + C.border, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
          {requiredUnlockCode && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>{T2("Enter the FP re-open code (set by admin)")}</div>
              <input value={unlockCode} onChange={function(e){ setUnlockCode(e.target.value); }} type="password"
                placeholder={T2("Code")}
                style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid " + C.border, fontSize: 13, boxSizing: "border-box" }} />
            </div>
          )}
        </>}
        confirmLabel={T2("Unlock for editing")} confirmIcon="lock"
        confirmDisabled={!unlockReason.trim() || (!!requiredUnlockCode && unlockCode.trim() !== requiredUnlockCode)}
        onConfirm={confirmUnlock}
        onClose={function(){ setFpLockModal(null); setUnlockReason(''); setUnlockCode(''); }} />
    </div>
  );
}

export default EventMenuBuilderView;
