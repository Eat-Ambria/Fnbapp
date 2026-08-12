// Ambria FnB — Shared Dish Mapping Modal (V66)
// Extracted from DishLibrary.jsx to be reusable from Menu Packages tab.
// Handles: Hindi edit, SOP link, Inventory link (with V65 dual-write of ops_inventory_id),
//          package assignment/removal, dish retirement (gated by allowDeactivate).
//
// Props:
//   dishName        — string; when truthy, modal is open. Falsy = closed.
//   lang            — 'en' | 'hi'
//   currentUser     — user object; drives isAdmin
//   onClose()       — required; fires when user closes modal or after successful retire
//   onChange()      — optional; fires after any successful mutation so outer list can refresh
//   onJumpToPackage(pkgName) — optional; fires when user clicks a package chip
//   allowDeactivate — bool, default true. Set false on Menu Packages tab (retire lives in Dish Library only).

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import {
  RECIPE_DB,
  upsertDishHindi, DISH_HINDI_MAP,
  resolveDishStore, upsertDishStoreMap,
  DISH_NAME_MAP, packagesContainingDish, findRecipeForDish,
  setPackageSections, getCatIdForDish, deactivateDish,
} from '../data/recipeData.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { supabase } from '../lib/supabase.js';
import { getCateringStoreItemsCached, opsSupabase } from '../lib/opsSupabase.js';
import { transliterateName } from '../utils/helpers.js';

function DishMappingModal(props) {
  var dishName        = props.dishName || '';
  var lang            = props.lang || 'en';
  var currentUser     = props.currentUser || null;
  var onClose         = props.onClose || function() {};
  var onChange        = props.onChange || function() {};
  var onJumpToPackage = props.onJumpToPackage || function() {};
  var allowDeactivate = props.allowDeactivate !== false; // default true
  var T2              = function(s) { return T(s, lang); };
  var isAdmin         = currentUser && (currentUser.role === 'admin' || currentUser.role === 'headchef');

  // ── State (all modal-scoped) ───────────────────────────────────────
  var [hindiBuf, setHindiBuf]           = useState('');
  var [saving, setSaving]               = useState(''); // '' | 'hindi' | 'sop' | 'store' | 'deact'
  var [type, setType]                   = useState('sop'); // 'sop' | 'store'
  var [sopSearch, setSopSearch]         = useState('');
  var [storeItems, setStoreItems]       = useState([]);
  var [storeItemsLoading, setStoreItemsLoading] = useState(false);
  var [storeSearch, setStoreSearch]     = useState('');
  var [storeItemPick, setStoreItemPick] = useState('');
  var [storeQtyBuf, setStoreQtyBuf]     = useState('1');

  var [pkgAddOpen, setPkgAddOpen]       = useState(false);
  var [pkgSearch, setPkgSearch]         = useState('');
  var [pkgSaving, setPkgSaving]         = useState('');   // '' | pkgName being mutated

  var [bump, setBump]                   = useState(0); // internal re-render trigger

  // ── Derived ───────────────────────────────────────────────────────
  var allRecipes = useMemo(function() {
    var out = [];
    (RECIPE_DB.cats || []).forEach(function(c) {
      (RECIPE_DB.recipes[c.id] || []).forEach(function(r) {
        if (r && r.n) out.push({ n: r.n, cat: c.name });
      });
    });
    return out.sort(function(a, b) { return a.n.localeCompare(b.n); });
  }, []);

  var recipesFiltered = allRecipes.filter(function(r) {
    return !sopSearch || r.n.toLowerCase().indexOf(sopSearch.toLowerCase()) !== -1;
  }).slice(0, 30);

  var storeItemsFiltered = storeItems.filter(function(x) {
    return !storeSearch || (x.name || '').toLowerCase().indexOf(storeSearch.toLowerCase()) !== -1;
  }).slice(0, 30);

  var detailStore = dishName ? resolveDishStore(dishName) : null;
  var detailSop   = dishName ? findRecipeForDish(dishName) : null;
  var detailPkgs  = dishName ? packagesContainingDish(dishName) : [];

  // ── Effects ───────────────────────────────────────────────────────
  // Reset modal state whenever dishName changes (i.e. opens for a new dish).
  useEffect(function() {
    if (!dishName) return;
    setHindiBuf(DISH_HINDI_MAP[dishName] || '');
    var store = resolveDishStore(dishName);
    if (store) {
      setType('store');
      setStoreItemPick(store.ops_item_id);
      setStoreQtyBuf(String(store.qty_per_cover || 1));
      loadStoreItems();
    } else {
      setType('sop');
      setStoreItemPick('');
      setStoreQtyBuf('1');
    }
    setSopSearch(''); setStoreSearch('');
    setPkgAddOpen(false); setPkgSearch(''); setPkgSaving('');
    // eslint-disable-next-line
  }, [dishName]);

  // Escape key to close
  useEffect(function() {
    if (!dishName) return;
    function onKey(e) { if (e.key === 'Escape') safeClose(); }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line
  }, [dishName, saving]);

  // Realtime sync for Ops catering items (only when picker used at least once)
  // V66 fix: unique channel per instance — DishMappingModal is mounted twice
  // (DishLibrary + MenuPackagesView), a shared channel name collides on subscribe.
  var channelRef = useRef('dmm-cs-items-rt-' + Math.random().toString(36).slice(2));
  useEffect(function() {
    if (!opsSupabase) return;
    var sub = opsSupabase
      .channel(channelRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catering_store_items' }, function() {
        try { localStorage.removeItem('ambria_ops_catering_items'); } catch(e) {}
        setStoreItems(function(prev) {
          if (prev.length === 0) return prev;
          getCateringStoreItemsCached().then(function(items) { setStoreItems(items || []); }).catch(function(){});
          return prev;
        });
      })
      .subscribe();
    return function() {
      try { opsSupabase.removeChannel(sub); } catch(e) {}
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────
  function safeClose() {
    if (saving) return;
    onClose();
  }

  function notify() {
    setBump(function(n) { return n + 1; });
    try { onChange(); } catch(e) {}
  }

  async function loadStoreItems() {
    if (storeItems.length > 0) return;
    setStoreItemsLoading(true);
    try { var items = await getCateringStoreItemsCached(); setStoreItems(items || []); }
    catch (e) { console.warn('Ops items load failed:', e); }
    finally { setStoreItemsLoading(false); }
  }

  async function mutatePackage(pkgName, mutatorFn) {
    var fetchRes = await supabase.from('menu_packages').select('name, dishes, sections').eq('name', pkgName).limit(1);
    if (fetchRes.error) throw fetchRes.error;
    var row = (fetchRes.data && fetchRes.data[0]) || null;
    if (!row) throw new Error('Package not found: ' + pkgName);
    var next = mutatorFn({ dishes: row.dishes || [], sections: row.sections || [] });
    var uRes = await supabase.from('menu_packages').update({ dishes: next.dishes, sections: next.sections }).eq('name', pkgName);
    if (uRes.error) throw uRes.error;
    MENU_PACKAGES[pkgName] = next.dishes;
    try { setPackageSections(pkgName, next.sections, next.dishes); } catch(e) {}
    try {
      localStorage.removeItem('ambria_menu_packages');
      localStorage.removeItem('ambria_cfg_menu_packages');
    } catch(e) {}
  }

  // ── Handlers ──────────────────────────────────────────────────────
  async function saveHindi() {
    if (!dishName) return;
    var current = DISH_HINDI_MAP[dishName] || '';
    var next = (hindiBuf || '').trim();
    if (current === next) return;
    setSaving('hindi');
    try {
      if (next) {
        var resU = await supabase.from('dish_hindi_map').upsert([{ dish_name: dishName, hi: next }], { onConflict: 'dish_name' });
        if (resU.error) throw resU.error;
      } else {
        var resD = await supabase.from('dish_hindi_map').delete().eq('dish_name', dishName);
        if (resD.error) throw resD.error;
      }
      upsertDishHindi(dishName, next);
      notify();
    } catch (e) { alert('Hindi save failed: ' + e.message); }
    finally { setSaving(''); }
  }

  async function saveSop(recipeName) {
    if (!dishName) return;
    setSaving('sop');
    try {
      var res = await supabase.from('dish_name_map').upsert({ lms_name: dishName, recipe_dish_name: recipeName }, { onConflict: 'lms_name' });
      if (res.error) throw res.error;
      DISH_NAME_MAP[dishName] = recipeName;
      // Mutual exclusion: clear any store mapping
      if (resolveDishStore(dishName)) {
        var resD = await supabase.from('dish_store_map').delete().eq('dish_name', dishName);
        if (!resD.error) upsertDishStoreMap(dishName, null);
      }
      setType('sop');
      setStoreItemPick(''); setStoreQtyBuf('1');
      notify();
    } catch (e) { alert('SOP link failed: ' + e.message); }
    finally { setSaving(''); setSopSearch(''); }
  }

  async function clearSop() {
    if (!dishName) return;
    if (!window.confirm(T2('Mark "') + dishName + T2('" as intentionally having no SOP?'))) return;
    setSaving('sop');
    try {
      var res = await supabase.from('dish_name_map').upsert({ lms_name: dishName, recipe_dish_name: '__none__' }, { onConflict: 'lms_name' });
      if (res.error) throw res.error;
      DISH_NAME_MAP[dishName] = '__none__';
      notify();
    } catch (e) { alert('Clear SOP failed: ' + e.message); }
    finally { setSaving(''); }
  }

  async function saveStore() {
    if (!dishName) return;
    if (!storeItemPick) { alert(T2('Pick an Ops item first.')); return; }
    var item = storeItems.find(function(x) { return x.id === storeItemPick; });
    if (!item) { alert(T2('Ops item not found.')); return; }
    var qty = parseFloat(storeQtyBuf);
    if (!qty || qty <= 0) { alert(T2('Enter a valid qty per cover.')); return; }
    setSaving('store');
    try {
      var row = {
        dish_name:        dishName,
        ops_item_id:      item.id,
        ops_inventory_id: item.inventory_id || null,   // V65 dual-write (stable prefix id)
        ops_item_name:    item.name || '',
        ops_item_hindi:   item.name_hindi || null,
        ops_item_unit:    item.unit || 'Pieces',
        qty_per_cover:    qty,
        updated_at:       new Date().toISOString(),
      };
      var res = await supabase.from('dish_store_map').upsert(row, { onConflict: 'dish_name' });
      if (res.error) throw res.error;
      upsertDishStoreMap(dishName, {
        ops_item_id: item.id,
        ops_inventory_id: item.inventory_id || '',
        ops_item_name: item.name || '',
        ops_item_hindi: item.name_hindi || '',
        ops_item_unit: item.unit || 'Pieces',
        qty_per_cover: qty,
      });
      // Mutual exclusion: clear any dish_name_map row
      var mk = Object.keys(DISH_NAME_MAP).find(function(k) { return k.toLowerCase().trim() === dishName.toLowerCase().trim(); });
      if (mk) {
        await supabase.from('dish_name_map').delete().eq('lms_name', mk);
        delete DISH_NAME_MAP[mk];
      }
      setType('store');
      notify();
    } catch (e) { alert('Inventory link failed: ' + e.message); }
    finally { setSaving(''); }
  }

  async function clearStore() {
    if (!dishName) return;
    if (!window.confirm(T2('Remove inventory mapping for "') + dishName + '"?')) return;
    setSaving('store');
    try {
      var res = await supabase.from('dish_store_map').delete().eq('dish_name', dishName);
      if (res.error) throw res.error;
      upsertDishStoreMap(dishName, null);
      setStoreItemPick(''); setStoreQtyBuf('1'); setType('sop');
      notify();
    } catch (e) { alert('Remove inventory failed: ' + e.message); }
    finally { setSaving(''); }
  }

  async function handleAddToPackage(pkgName) {
    if (!isAdmin || !dishName || !pkgName) return;
    setPkgSaving(pkgName);
    try {
      await mutatePackage(pkgName, function(cur) {
        var dishes = cur.dishes.slice();
        if (dishes.indexOf(dishName) === -1) dishes.push(dishName);
        var sections = (cur.sections || []).map(function(s) {
          return { id: s.id, name: s.name, sop_category: s.sop_category, dishes: (s.dishes || []).slice() };
        });
        var alreadyIn = sections.some(function(s) { return (s.dishes || []).indexOf(dishName) !== -1; });
        if (!alreadyIn) {
          var catId = getCatIdForDish(dishName);
          var catName = catId ? ((RECIPE_DB.cats || []).find(function(c) { return c.id === catId; }) || {}).name || '' : '';
          var target = null;
          if (catName) target = sections.find(function(s) { return s.sop_category === catName || s.name === catName; });
          if (!target && sections.length > 0) target = sections[0];
          if (!target) {
            var newSec = { id: 'sec_' + Date.now() + '_other', name: 'Other', sop_category: '', dishes: [dishName] };
            sections.push(newSec);
          } else {
            target.dishes.push(dishName);
          }
        }
        return { dishes: dishes, sections: sections };
      });
      setPkgAddOpen(false); setPkgSearch('');
      notify();
    } catch (e) { alert('Add to package failed: ' + (e.message || e)); }
    finally { setPkgSaving(''); }
  }

  async function handleRemoveFromPackage(pkgName) {
    if (!isAdmin || !dishName || !pkgName) return;
    if (!window.confirm(T2('Remove "') + dishName + T2('" from package "') + pkgName + '"?')) return;
    setPkgSaving(pkgName);
    try {
      await mutatePackage(pkgName, function(cur) {
        var dishes = (cur.dishes || []).filter(function(n) { return n !== dishName; });
        var sections = (cur.sections || []).map(function(s) {
          return { id: s.id, name: s.name, sop_category: s.sop_category, dishes: (s.dishes || []).filter(function(n) { return n !== dishName; }) };
        });
        return { dishes: dishes, sections: sections };
      });
      notify();
    } catch (e) { alert('Remove from package failed: ' + (e.message || e)); }
    finally { setPkgSaving(''); }
  }

  async function handleDeactivate() {
    if (!dishName) return;
    var pkgs = packagesContainingDish(dishName);
    var warn = T2('Retire "') + dishName + T2('"?');
    if (pkgs.length > 0) warn += '\n\n⚠ ' + T2('Still used in ') + pkgs.length + T2(' package(s): ') + pkgs.slice(0, 3).join(', ') + (pkgs.length > 3 ? '…' : '') + T2('. Retiring hides it from the library but keeps it in those packages.');
    if (!window.confirm(warn)) return;
    setSaving('deact');
    try {
      var res = await supabase.from('dishes_master').update({ is_active: false }).eq('dish_name', dishName);
      if (res.error) throw res.error;
      deactivateDish(dishName);
      notify();
      onClose();
    } catch (e) { alert('Retire failed: ' + e.message); }
    finally { setSaving(''); }
  }

  // ── Render ────────────────────────────────────────────────────────
  if (!dishName) return null;

  var allPkgs = Object.keys(MENU_PACKAGES).sort();
  var inSet = {}; detailPkgs.forEach(function(p) { inSet[p] = true; });
  var available = allPkgs.filter(function(p) { return !inSet[p]; });
  var qL = pkgSearch.trim().toLowerCase();
  var availFiltered = qL ? available.filter(function(p) { return p.toLowerCase().indexOf(qL) !== -1; }) : available;

  return (
    <div onClick={safeClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={function(e) { e.stopPropagation(); }}
        style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 560, width: '100%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{dishName}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {detailPkgs.length > 0 ? T2('Used in ') + detailPkgs.length + T2(' package(s)') : T2('Not used in any package')}
            </div>
          </div>
          <button onClick={safeClose} disabled={!!saving}
            style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: saving ? 'not-allowed' : 'pointer', padding: 4 }}>×</button>
        </div>

        {/* Hindi */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{T2('Hindi')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={hindiBuf} onChange={function(e) { setHindiBuf(e.target.value); }}
              placeholder={T2('Hindi name…')} disabled={!isAdmin}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid ' + C.border, background: C.bg, fontSize: 13, color: C.text }} />
            {isAdmin && (
              <button onClick={function() { setHindiBuf(transliterateName(dishName)); }}
                title={T2('Auto-transliterate (Sanscript ITRANS)')}
                disabled={!!saving}
                style={{ padding: '6px 10px', borderRadius: 6, background: C.bg, border: '1px solid ' + C.border, fontSize: 11, color: C.text, cursor: 'pointer', fontWeight: 600 }}>🅷</button>
            )}
            {isAdmin && (
              <button onClick={saveHindi} disabled={!!saving || (hindiBuf || '') === (DISH_HINDI_MAP[dishName] || '')}
                style={{ padding: '6px 14px', borderRadius: 6, background: C.green, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving === 'hindi' ? 'wait' : 'pointer', opacity: (saving || (hindiBuf || '') === (DISH_HINDI_MAP[dishName] || '')) ? 0.5 : 1 }}>
                {saving === 'hindi' ? T2('Saving…') : T2('Save')}
              </button>
            )}
          </div>
        </div>

        {/* Type toggle */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{T2('Mapping type')}</div>
          <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 6, padding: 3, width: 'fit-content' }}>
            <button onClick={function() { setType('sop'); }}
              style={{ padding: '5px 14px', borderRadius: 4, background: type === 'sop' ? '#3B6D11' : 'transparent', color: type === 'sop' ? '#fff' : C.muted, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>SOP {T2('recipe')}</button>
            <button onClick={function() { setType('store'); loadStoreItems(); }}
              style={{ padding: '5px 14px', borderRadius: 4, background: type === 'store' ? '#0F6E56' : 'transparent', color: type === 'store' ? '#fff' : C.muted, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{T2('Inventory')}</button>
          </div>
          <div style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>{T2('Mutually exclusive — picking one clears the other.')}</div>
        </div>

        {/* SOP picker */}
        {type === 'sop' && (
          <div style={{ marginBottom: 14, padding: 10, background: '#F5FAF0', border: '1px solid ' + C.borderLight, borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: '#3B6D11', marginBottom: 6, fontWeight: 600 }}>
              {detailSop ? T2('Currently linked to: ') + detailSop.n : T2('No SOP recipe linked yet.')}
            </div>
            <input value={sopSearch} onChange={function(e) { setSopSearch(e.target.value); }}
              placeholder={T2('Search recipes to link…')} disabled={!isAdmin}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid ' + C.border, background: C.surface, fontSize: 12, color: C.text, boxSizing: 'border-box', marginBottom: 6 }} />
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid ' + C.borderLight, borderRadius: 6, background: C.surface }}>
              {recipesFiltered.map(function(r) {
                var linked = detailSop && detailSop.n === r.n;
                return (
                  <div key={r.n} onClick={function() { if (isAdmin && !saving) saveSop(r.n); }}
                    style={{ padding: '5px 10px', fontSize: 11, cursor: isAdmin ? 'pointer' : 'default', borderBottom: '1px solid ' + C.borderLight, background: linked ? '#EAF3DE' : 'transparent', color: linked ? '#3B6D11' : C.text, fontWeight: linked ? 600 : 400, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{r.n}</span>
                    <span style={{ color: C.faint, fontSize: 10 }}>{r.cat}</span>
                  </div>
                );
              })}
              {recipesFiltered.length === 0 && (
                <div style={{ padding: '8px 10px', fontSize: 11, color: C.muted, textAlign: 'center' }}>{T2('No matching recipes.')}</div>
              )}
            </div>
            {isAdmin && (
              <div style={{ marginTop: 6, textAlign: 'right' }}>
                <button onClick={clearSop} disabled={!!saving}
                  style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px dashed ' + C.border, color: C.muted, fontSize: 11, cursor: 'pointer' }}>
                  {T2('Mark as no SOP')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inventory picker */}
        {type === 'store' && (
          <div style={{ marginBottom: 14, padding: 10, background: '#F0FAF5', border: '1px solid ' + C.borderLight, borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: '#0F6E56', marginBottom: 6, fontWeight: 600 }}>
              {detailStore ? T2('Currently linked to: ') + detailStore.ops_item_name + ' · ' + (detailStore.qty_per_cover || 1) + ' ' + (detailStore.ops_item_unit || '') + '/pax' : T2('No inventory item linked yet.')}
            </div>
            {storeItemsLoading && <div style={{ fontSize: 11, color: C.muted, padding: '8px' }}>{T2('Loading Ops items…')}</div>}
            {!storeItemsLoading && (
              <React.Fragment>
                <input value={storeSearch} onChange={function(e) { setStoreSearch(e.target.value); }}
                  placeholder={T2('Search Ops inventory…')} disabled={!isAdmin}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid ' + C.border, background: C.surface, fontSize: 12, color: C.text, boxSizing: 'border-box', marginBottom: 6 }} />
                <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid ' + C.borderLight, borderRadius: 6, background: C.surface, marginBottom: 6 }}>
                  {storeItemsFiltered.map(function(it) {
                    var picked = storeItemPick === it.id;
                    return (
                      <div key={it.id} onClick={function() { if (isAdmin) setStoreItemPick(it.id); }}
                        style={{ padding: '5px 10px', fontSize: 11, cursor: isAdmin ? 'pointer' : 'default', borderBottom: '1px solid ' + C.borderLight, background: picked ? '#E1F5EE' : 'transparent', color: picked ? '#0F6E56' : C.text, fontWeight: picked ? 600 : 400, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{it.name}</span>
                        <span style={{ color: C.faint, fontSize: 10 }}>{it.unit}</span>
                      </div>
                    );
                  })}
                  {storeItemsFiltered.length === 0 && (
                    <div style={{ padding: '8px 10px', fontSize: 11, color: C.muted, textAlign: 'center' }}>{T2('No matching items.')}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{T2('Qty per cover')}:</span>
                  <input value={storeQtyBuf} onChange={function(e) { setStoreQtyBuf(e.target.value); }}
                    type="number" step="0.1" min="0" disabled={!isAdmin}
                    style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid ' + C.border, background: C.surface, fontSize: 12, color: C.text }} />
                  {isAdmin && (
                    <button onClick={saveStore} disabled={!!saving || !storeItemPick}
                      style={{ padding: '5px 14px', borderRadius: 6, background: '#0F6E56', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: (saving || !storeItemPick) ? 'not-allowed' : 'pointer', opacity: (saving || !storeItemPick) ? 0.5 : 1, marginLeft: 'auto' }}>
                      {saving === 'store' ? T2('Saving…') : T2('Link')}
                    </button>
                  )}
                </div>
                {detailStore && isAdmin && (
                  <div style={{ textAlign: 'right' }}>
                    <button onClick={clearStore} disabled={!!saving}
                      style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px dashed ' + C.border, color: C.muted, fontSize: 11, cursor: 'pointer' }}>
                      {T2('Remove inventory mapping')}
                    </button>
                  </div>
                )}
              </React.Fragment>
            )}
          </div>
        )}

        {/* Packages usage — assign / remove */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{T2('Assign to packages')} <span style={{ color: C.faint, fontWeight: 400 }}>({detailPkgs.length})</span></span>
            {isAdmin && available.length > 0 && (
              <button onClick={function() { setPkgAddOpen(!pkgAddOpen); setPkgSearch(''); }} disabled={!!pkgSaving}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: pkgAddOpen ? C.wine : 'transparent', color: pkgAddOpen ? '#fff' : C.wine, border: '1px solid ' + C.wine, cursor: pkgSaving ? 'wait' : 'pointer', fontWeight: 600 }}>
                {pkgAddOpen ? '× ' + T2('Close') : '+ ' + T2('Add to package')}
              </button>
            )}
          </div>

          {detailPkgs.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: pkgAddOpen ? 8 : 0 }}>
              {detailPkgs.map(function(p) {
                var isSaving = pkgSaving === p;
                return (
                  <div key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, padding: '2px 4px 2px 8px', borderRadius: 10, background: C.bg, color: C.text, border: '1px solid ' + C.borderLight, opacity: isSaving ? 0.5 : 1 }}>
                    <span onClick={function() { onClose(); onJumpToPackage(p); }} style={{ cursor: 'pointer' }}>{p} →</span>
                    {isAdmin && (
                      <button onClick={function() { handleRemoveFromPackage(p); }} disabled={!!pkgSaving}
                        title={T2('Remove from ') + p}
                        style={{ background: 'transparent', border: 'none', color: C.red, fontSize: 13, cursor: pkgSaving ? 'not-allowed' : 'pointer', padding: '0 4px', lineHeight: 1, fontWeight: 700 }}>×</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {detailPkgs.length === 0 && !pkgAddOpen && (
            <div style={{ fontSize: 11, color: C.faint, fontStyle: 'italic' }}>{T2('Not used in any package.')}</div>
          )}

          {pkgAddOpen && (
            <div style={{ marginTop: 4, padding: 8, background: C.bg, border: '1px solid ' + C.borderLight, borderRadius: 6 }}>
              <input value={pkgSearch} onChange={function(e) { setPkgSearch(e.target.value); }}
                placeholder={T2('Search packages…')} autoFocus disabled={!!pkgSaving}
                style={{ width: '100%', padding: '5px 10px', borderRadius: 4, border: '1px solid ' + C.border, background: C.surface, fontSize: 12, color: C.text, boxSizing: 'border-box', marginBottom: 6 }} />
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid ' + C.borderLight, borderRadius: 4, background: C.surface }}>
                {availFiltered.length === 0 && (
                  <div style={{ padding: '8px 10px', fontSize: 11, color: C.muted, textAlign: 'center' }}>
                    {available.length === 0 ? T2('Already in every package.') : T2('No matches.')}
                  </div>
                )}
                {availFiltered.map(function(p) {
                  var isSaving = pkgSaving === p;
                  return (
                    <div key={p} onClick={function() { if (!pkgSaving) handleAddToPackage(p); }}
                      style={{ padding: '5px 10px', fontSize: 12, cursor: pkgSaving ? 'wait' : 'pointer', borderBottom: '1px solid ' + C.borderLight, color: C.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isSaving ? 0.5 : 1 }}>
                      <span>{p}</span>
                      {isSaving ? <span style={{ fontSize: 10, color: C.muted }}>{T2('Adding…')}</span> : <span style={{ fontSize: 12, color: C.wine, fontWeight: 700 }}>+</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 12, borderTop: '1px solid ' + C.border }}>
          {isAdmin && allowDeactivate ? (
            <button onClick={handleDeactivate} disabled={!!saving}
              style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid ' + C.redBorder, color: C.red, fontSize: 12, fontWeight: 600, cursor: saving === 'deact' ? 'wait' : 'pointer' }}>
              🗑 {T2('Retire dish')}
            </button>
          ) : <span />}
          <button onClick={safeClose} disabled={!!saving}
            style={{ padding: '6px 14px', borderRadius: 6, background: C.text, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {T2('Done')}
          </button>
        </div>

      </div>
    </div>
  );
}

export default DishMappingModal;