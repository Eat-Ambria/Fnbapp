// Ambria FnB — Dish Library (V63 standalone tab)
// Unified list of every dish across every package.
// - Summary strip (total / SOP / Inventory / Unmapped)
// - Filter chips + search
// - Row selection with bulk actions (auto-Hindi, delete unused)
// - Click row → detail modal (Hindi edit, SOP/Inventory mapping, deactivate)
// Props: lang, currentUser, onJumpToPackage?, refreshKey?
import React, { useState, useMemo, useEffect } from 'react';
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import {
  getAllDishes, upsertDishMaster, deactivateDish,
  RECIPE_DB,
  resolveDishHindi, upsertDishHindi, DISH_HINDI_MAP,
  resolveDishStore, upsertDishStoreMap, DISH_STORE_MAP,
  DISH_NAME_MAP, packagesContainingDish, findRecipeForDish
} from '../data/recipeData.js';
import { supabase } from '../lib/supabase.js';
import { getCateringStoreItemsCached } from '../lib/opsSupabase.js';
import { transliterateName } from '../utils/helpers.js';

function DishLibrary(props) {
  var lang           = props.lang || 'en';
  var currentUser    = props.currentUser || null;
  var onJumpToPackage= props.onJumpToPackage || function() {};
  var T2             = function(s) { return T(s, lang); };
  var isAdmin        = currentUser && (currentUser.role === 'admin' || currentUser.role === 'headchef');

  // ── State ────────────────────────────────────────────────────────
  var [q, setQ]               = useState('');
  var [filter, setFilter]     = useState('all'); // all | sop | inv | unmapped | unused
  var [showRetired, setShowRetired] = useState(false);
  var [localBump, setLocalBump]     = useState(0);
  var [selected, setSelected]       = useState({}); // { [dishName]: true }
  var [bulkSaving, setBulkSaving]   = useState(false);

  // Detail modal state
  var [detailFor, setDetailFor]             = useState('');
  var [detailHindiBuf, setDetailHindiBuf]   = useState('');
  var [detailSaving, setDetailSaving]       = useState(''); // '' | 'hindi' | 'sop' | 'store' | 'deact'
  var [detailType, setDetailType]           = useState('sop'); // 'sop' | 'store'
  var [sopSearch, setSopSearch]             = useState('');
  var [storeItems, setStoreItems]           = useState([]);
  var [storeItemsLoading, setStoreItemsLoading] = useState(false);
  var [storeSearch, setStoreSearch]         = useState('');
  var [storeItemPick, setStoreItemPick]     = useState('');
  var [storeQtyBuf, setStoreQtyBuf]         = useState('1');

  // Add new dish
  var [creating, setCreating] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────
  var allRecipes = useMemo(function() {
    var out = [];
    (RECIPE_DB.cats || []).forEach(function(c) {
      (RECIPE_DB.recipes[c.id] || []).forEach(function(r) {
        if (r && r.n) out.push({ n: r.n, cat: c.name });
      });
    });
    return out.sort(function(a, b) { return a.n.localeCompare(b.n); });
  }, [props.refreshKey]);

  var enriched = useMemo(function() {
    var raw = getAllDishes({ includeInactive: showRetired });
    return raw.map(function(d) {
      var name = d.dish_name;
      var packages = packagesContainingDish(name);
      var store = resolveDishStore(name);
      var type = store ? 'inv'
               : (d.hasRecipe ? 'sop'
               : (d.explicitNone ? 'nosop' : 'unmapped'));
      return {
        dish_name: name,
        is_active: d.is_active !== false,
        hindi: resolveDishHindi(name) || '',
        packages: packages,
        isUnused: packages.length === 0,
        type: type,
        store: store,
        mappedTo: d.mappedTo || '',
        catName: d.catName || '',
        catId: d.catId || '',
      };
    });
  }, [props.refreshKey, showRetired, localBump]);

  var totals = useMemo(function() {
    var t = { total: enriched.length, sop: 0, inv: 0, unmapped: 0, unused: 0 };
    enriched.forEach(function(d) {
      if (d.type === 'sop') t.sop++;
      else if (d.type === 'inv') t.inv++;
      else if (d.type === 'unmapped') t.unmapped++;
      if (d.isUnused) t.unused++;
    });
    return t;
  }, [enriched]);

  var filtered = useMemo(function() {
    var qL = q.trim().toLowerCase();
    return enriched.filter(function(d) {
      if (filter === 'sop' && d.type !== 'sop') return false;
      if (filter === 'inv' && d.type !== 'inv') return false;
      if (filter === 'unmapped' && d.type !== 'unmapped') return false;
      if (filter === 'unused' && !d.isUnused) return false;
      if (qL) {
        var nameHit = d.dish_name.toLowerCase().indexOf(qL) !== -1;
        var hindiHit = d.hindi && d.hindi.toLowerCase().indexOf(qL) !== -1;
        if (!nameHit && !hindiHit) return false;
      }
      return true;
    }).sort(function(a, b) { return a.dish_name.localeCompare(b.dish_name); });
  }, [enriched, q, filter]);

  var selectedNames = Object.keys(selected).filter(function(k) { return selected[k]; });
  var selectedCount = selectedNames.length;
  var allFilteredSelected = filtered.length > 0 && filtered.every(function(d) { return selected[d.dish_name]; });

  // ── Bulk actions ─────────────────────────────────────────────────
  function toggleSelect(name) {
    setSelected(function(p) {
      var next = { ...p };
      if (next[name]) delete next[name]; else next[name] = true;
      return next;
    });
  }
  function selectAllFiltered() {
    setSelected(function(p) {
      var next = { ...p };
      if (allFilteredSelected) filtered.forEach(function(d) { delete next[d.dish_name]; });
      else filtered.forEach(function(d) { next[d.dish_name] = true; });
      return next;
    });
  }
  function clearSelection() { setSelected({}); }

  async function bulkDeleteUnused() {
    if (!isAdmin) return;
    var toDelete = selectedNames.filter(function(name) {
      var d = enriched.find(function(e) { return e.dish_name === name; });
      return d && d.isUnused && d.is_active;
    });
    var inUseCount = selectedNames.length - toDelete.length;
    if (toDelete.length === 0) { alert(T2('None of the selected dishes are unused (or all are already retired). Only unused dishes can be bulk-retired.')); return; }
    var msg = T2('Retire ') + toDelete.length + T2(' unused dish(es)?');
    if (inUseCount > 0) msg += '\n\n' + inUseCount + T2(' selected dish(es) are still used in packages and will be skipped.');
    if (!window.confirm(msg)) return;
    setBulkSaving(true);
    try {
      var res = await supabase.from('dishes_master').update({ is_active: false }).in('dish_name', toDelete);
      if (res.error) throw res.error;
      toDelete.forEach(function(name) { deactivateDish(name); });
      setSelected({});
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Bulk retire failed: ' + e.message); }
    finally { setBulkSaving(false); }
  }

  async function bulkAutoHindi() {
    if (!isAdmin) return;
    var candidates = selectedNames.map(function(name) {
      var existing = DISH_HINDI_MAP[name];
      if (existing) return null;
      var hi = transliterateName(name);
      if (!hi || hi === name) return null;
      return { dish_name: name, hi: hi };
    }).filter(Boolean);
    if (candidates.length === 0) { alert(T2('Selected dishes already have Hindi, or transliteration produced no output.')); return; }
    if (!window.confirm(T2('Auto-generate Hindi (Sanscript ITRANS) for ') + candidates.length + T2(' dish(es)?\n\nExisting Hindi mappings are preserved.'))) return;
    setBulkSaving(true);
    try {
      var res = await supabase.from('dish_hindi_map').upsert(candidates, { onConflict: 'dish_name' });
      if (res.error) throw res.error;
      candidates.forEach(function(r) { upsertDishHindi(r.dish_name, r.hi); });
      setSelected({});
      setLocalBump(function(n) { return n + 1; });
      alert(T2('Auto-Hindi complete: ') + candidates.length + T2(' dish(es) updated.'));
    } catch (e) { alert('Auto-Hindi failed: ' + e.message); }
    finally { setBulkSaving(false); }
  }

  // ── Add new dish ─────────────────────────────────────────────────
  async function handleCreate() {
    if (!isAdmin) return;
    var name = (window.prompt(T2('New dish name:')) || '').trim();
    if (!name) return;
    setCreating(true);
    try {
      var res = await supabase.from('dishes_master').insert({ dish_name: name }).select();
      if (res.error && res.error.code !== '23505') { alert('Save failed: ' + res.error.message); return; }
      upsertDishMaster(name, { is_active: true });
      setLocalBump(function(n) { return n + 1; });
      setDetailFor(name);
      openDetail(name);
    } catch (e) { alert('Save failed: ' + e.message); }
    finally { setCreating(false); }
  }

  // ── Detail modal ─────────────────────────────────────────────────
  useEffect(function() {
    if (!detailFor) return;
    function onKey(e) { if (e.key === 'Escape') closeDetail(); }
    document.addEventListener('keydown', onKey);
    return function() { document.removeEventListener('keydown', onKey); };
  }, [detailFor]);

  async function loadStoreItems() {
    if (storeItems.length > 0) return;
    setStoreItemsLoading(true);
    try { var items = await getCateringStoreItemsCached(); setStoreItems(items || []); }
    catch (e) { console.warn('Ops items load failed:', e); }
    finally { setStoreItemsLoading(false); }
  }

  function openDetail(name) {
    setDetailFor(name);
    setDetailHindiBuf(DISH_HINDI_MAP[name] || '');
    var store = resolveDishStore(name);
    if (store) {
      setDetailType('store');
      setStoreItemPick(store.ops_item_id);
      setStoreQtyBuf(String(store.qty_per_cover || 1));
      loadStoreItems();
    } else {
      setDetailType('sop');
      setStoreItemPick('');
      setStoreQtyBuf('1');
    }
    setSopSearch(''); setStoreSearch('');
  }
  function closeDetail() {
    if (detailSaving) return;
    setDetailFor(''); setDetailHindiBuf(''); setDetailType('sop');
    setSopSearch(''); setStoreSearch(''); setStoreItemPick(''); setStoreQtyBuf('1');
  }

  async function saveDetailHindi() {
    if (!detailFor) return;
    var current = DISH_HINDI_MAP[detailFor] || '';
    var next = (detailHindiBuf || '').trim();
    if (current === next) return;
    setDetailSaving('hindi');
    try {
      if (next) {
        var resU = await supabase.from('dish_hindi_map').upsert([{ dish_name: detailFor, hi: next }], { onConflict: 'dish_name' });
        if (resU.error) throw resU.error;
      } else {
        var resD = await supabase.from('dish_hindi_map').delete().eq('dish_name', detailFor);
        if (resD.error) throw resD.error;
      }
      upsertDishHindi(detailFor, next);
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Hindi save failed: ' + e.message); }
    finally { setDetailSaving(''); }
  }

  async function saveDetailSop(recipeName) {
    if (!detailFor) return;
    setDetailSaving('sop');
    try {
      var res = await supabase.from('dish_name_map').upsert({ lms_name: detailFor, recipe_dish_name: recipeName }, { onConflict: 'lms_name' });
      if (res.error) throw res.error;
      DISH_NAME_MAP[detailFor] = recipeName;
      // Mutual exclusion: clear any store mapping
      if (resolveDishStore(detailFor)) {
        var resD = await supabase.from('dish_store_map').delete().eq('dish_name', detailFor);
        if (!resD.error) upsertDishStoreMap(detailFor, null);
      }
      setDetailType('sop');
      setStoreItemPick(''); setStoreQtyBuf('1');
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('SOP link failed: ' + e.message); }
    finally { setDetailSaving(''); setSopSearch(''); }
  }

  async function clearDetailSop() {
    if (!detailFor) return;
    if (!window.confirm(T2('Mark "') + detailFor + T2('" as intentionally having no SOP?'))) return;
    setDetailSaving('sop');
    try {
      var res = await supabase.from('dish_name_map').upsert({ lms_name: detailFor, recipe_dish_name: '__none__' }, { onConflict: 'lms_name' });
      if (res.error) throw res.error;
      DISH_NAME_MAP[detailFor] = '__none__';
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Clear SOP failed: ' + e.message); }
    finally { setDetailSaving(''); }
  }

  async function saveDetailStore() {
    if (!detailFor) return;
    if (!storeItemPick) { alert(T2('Pick an Ops item first.')); return; }
    var item = storeItems.find(function(x) { return x.id === storeItemPick; });
    if (!item) { alert(T2('Ops item not found.')); return; }
    var qty = parseFloat(storeQtyBuf);
    if (!qty || qty <= 0) { alert(T2('Enter a valid qty per cover.')); return; }
    setDetailSaving('store');
    try {
      var row = {
        dish_name:      detailFor,
        ops_item_id:    item.id,
        ops_item_name:  item.name || '',
        ops_item_hindi: item.name_hindi || null,
        ops_item_unit:  item.unit || 'Pieces',
        qty_per_cover:  qty,
        updated_at:     new Date().toISOString(),
      };
      var res = await supabase.from('dish_store_map').upsert(row, { onConflict: 'dish_name' });
      if (res.error) throw res.error;
      upsertDishStoreMap(detailFor, {
        ops_item_id: item.id, ops_item_name: item.name || '',
        ops_item_hindi: item.name_hindi || '', ops_item_unit: item.unit || 'Pieces',
        qty_per_cover: qty,
      });
      // Mutual exclusion: clear any dish_name_map row
      var mk = Object.keys(DISH_NAME_MAP).find(function(k) { return k.toLowerCase().trim() === detailFor.toLowerCase().trim(); });
      if (mk) {
        await supabase.from('dish_name_map').delete().eq('lms_name', mk);
        delete DISH_NAME_MAP[mk];
      }
      setDetailType('store');
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Inventory link failed: ' + e.message); }
    finally { setDetailSaving(''); }
  }

  async function clearDetailStore() {
    if (!detailFor) return;
    if (!window.confirm(T2('Remove inventory mapping for "') + detailFor + '"?')) return;
    setDetailSaving('store');
    try {
      var res = await supabase.from('dish_store_map').delete().eq('dish_name', detailFor);
      if (res.error) throw res.error;
      upsertDishStoreMap(detailFor, null);
      setStoreItemPick(''); setStoreQtyBuf('1'); setDetailType('sop');
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Remove inventory failed: ' + e.message); }
    finally { setDetailSaving(''); }
  }

  async function handleDeactivate() {
    if (!detailFor) return;
    var pkgs = packagesContainingDish(detailFor);
    var warn = T2('Retire "') + detailFor + T2('"?');
    if (pkgs.length > 0) warn += '\n\n⚠ ' + T2('Still used in ') + pkgs.length + T2(' package(s): ') + pkgs.slice(0, 3).join(', ') + (pkgs.length > 3 ? '…' : '') + T2('. Retiring hides it from the library but keeps it in those packages.');
    if (!window.confirm(warn)) return;
    setDetailSaving('deact');
    try {
      var res = await supabase.from('dishes_master').update({ is_active: false }).eq('dish_name', detailFor);
      if (res.error) throw res.error;
      deactivateDish(detailFor);
      setLocalBump(function(n) { return n + 1; });
      closeDetail();
    } catch (e) { alert('Retire failed: ' + e.message); }
    finally { setDetailSaving(''); }
  }

  async function handleRestore(name) {
    if (!isAdmin) return;
    try {
      var res = await supabase.from('dishes_master').update({ is_active: true }).eq('dish_name', name);
      if (res.error) throw res.error;
      upsertDishMaster(name, { is_active: true });
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Restore failed: ' + e.message); }
  }

  // ── Render helpers ───────────────────────────────────────────────
  function chip(v, label, count, colorFg, colorBg) {
    var active = filter === v;
    return (
      <button key={v} onClick={function() { setFilter(v); }}
        style={{
          padding: '5px 12px', borderRadius: 14, fontSize: 12, fontWeight: active ? 600 : 500,
          cursor: 'pointer',
          background: active ? (colorBg || C.text) : (colorBg || 'transparent'),
          color: active ? (colorFg === C.text ? '#fff' : (colorFg || '#fff')) : (colorFg || C.muted),
          border: '1px solid ' + (active ? (colorFg || C.text) : (colorBg ? 'transparent' : C.border)),
        }}>
        {label}{count != null ? ' ' + count : ''}
      </button>
    );
  }

  function typeBadge(type) {
    var bg = type === 'inv' ? '#E1F5EE' : type === 'sop' ? '#EAF3DE' : type === 'nosop' ? C.bg : C.redBg;
    var fg = type === 'inv' ? '#0F6E56' : type === 'sop' ? '#3B6D11' : type === 'nosop' ? C.muted : C.red;
    var label = type === 'inv' ? 'Inventory' : type === 'sop' ? 'SOP' : type === 'nosop' ? T2('No SOP') : T2('Unmapped');
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: bg, color: fg }}>{label}</span>;
  }

  // ── RENDER ───────────────────────────────────────────────────────
  var recipesFiltered = allRecipes.filter(function(r) { return !sopSearch || r.n.toLowerCase().indexOf(sopSearch.toLowerCase()) !== -1; }).slice(0, 30);
  var storeItemsFiltered = storeItems.filter(function(x) { return !storeSearch || (x.name || '').toLowerCase().indexOf(storeSearch.toLowerCase()) !== -1; }).slice(0, 30);
  var detailStore = detailFor ? resolveDishStore(detailFor) : null;
  var detailSop = detailFor ? findRecipeForDish(detailFor) : null;
  var detailPkgs = detailFor ? packagesContainingDish(detailFor) : [];

  return (
    <div>

      {/* SUMMARY STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{T2('Total dishes')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 2 }}>{totals.total}</div>
        </div>
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>SOP {T2('mapped')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3B6D11', marginTop: 2 }}>{totals.sop} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{totals.total ? Math.round(totals.sop / totals.total * 100) + '%' : ''}</span></div>
        </div>
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{T2('Inventory')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F6E56', marginTop: 2 }}>{totals.inv} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{totals.total ? Math.round(totals.inv / totals.total * 100) + '%' : ''}</span></div>
        </div>
        <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{T2('Unmapped')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.red, marginTop: 2 }}>{totals.unmapped} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{totals.total ? Math.round(totals.unmapped / totals.total * 100) + '%' : ''}</span></div>
        </div>
      </div>

      {/* FILTER + SEARCH */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {chip('all',      T2('All'),        totals.total,    '#fff',      C.text)}
        {chip('sop',      T2('SOP'),        totals.sop,      '#3B6D11', '#EAF3DE')}
        {chip('inv',      T2('Inventory'),  totals.inv,      '#0F6E56', '#E1F5EE')}
        {chip('unmapped', T2('Unmapped'),   totals.unmapped, C.red,     C.redBg)}
        {chip('unused',   T2('Unused'),     totals.unused,   C.muted,   C.bg)}
        <button onClick={function() { setShowRetired(!showRetired); }}
          title={T2('Toggle retired dishes')}
          style={{ marginLeft: 4, fontSize: 11, padding: '4px 10px', borderRadius: 14, background: showRetired ? C.faint : 'transparent', color: showRetired ? C.text : C.muted, border: '1px dashed ' + C.border, cursor: 'pointer', fontWeight: showRetired ? 600 : 500 }}>
          {showRetired ? '👁 ' + T2('Retired on') : T2('Show retired')}
        </button>
        <div style={{ flex: 1, minWidth: 140, position: 'relative' }}>
          <input value={q} onChange={function(e) { setQ(e.target.value); }}
            placeholder={T2('Search dish name or Hindi…')}
            style={{ width: '100%', padding: '6px 10px 6px 28px', borderRadius: 6, border: '1px solid ' + C.border, background: C.surface, fontSize: 12, color: C.text, boxSizing: 'border-box' }} />
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.muted }}>🔍</span>
        </div>
        {isAdmin && (
          <button onClick={handleCreate} disabled={creating}
            style={{ padding: '6px 12px', borderRadius: 6, background: C.wine, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: creating ? 'wait' : 'pointer' }}>+ {T2('New dish')}</button>
        )}
      </div>

      {/* BULK ACTION BAR */}
      {selectedCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: C.blueBg, border: '1px solid ' + C.blueBorder, borderRadius: 8, marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, color: C.blue, fontWeight: 600 }}>{selectedCount} {T2('dish(es) selected')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {isAdmin && (
              <button onClick={bulkAutoHindi} disabled={bulkSaving}
                style={{ padding: '4px 10px', borderRadius: 6, background: C.surface, border: '1px solid ' + C.border, fontSize: 11, color: C.text, cursor: bulkSaving ? 'wait' : 'pointer', fontWeight: 600 }}>
                🅷 {T2('Auto-Hindi')}
              </button>
            )}
            {isAdmin && (
              <button onClick={bulkDeleteUnused} disabled={bulkSaving}
                style={{ padding: '4px 10px', borderRadius: 6, background: C.surface, border: '1px solid ' + C.redBorder, fontSize: 11, color: C.red, cursor: bulkSaving ? 'wait' : 'pointer', fontWeight: 600 }}>
                🗑 {T2('Retire unused')}
              </button>
            )}
            <button onClick={clearSelection} disabled={bulkSaving}
              style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px solid ' + C.border, fontSize: 11, color: C.muted, cursor: 'pointer' }}>
              {T2('Clear')}
            </button>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div style={{ border: '1px solid ' + C.border, borderRadius: 10, overflow: 'hidden', background: C.surface, fontSize: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1.6fr 1.1fr 0.7fr 1.4fr 1.2fr 0.4fr', gap: 8, padding: '9px 12px', background: C.bg, color: C.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: '1px solid ' + C.border }}>
          <div>
            <input type="checkbox" checked={allFilteredSelected} onChange={selectAllFiltered}
              style={{ cursor: 'pointer', margin: 0 }} />
          </div>
          <div>{T2('Dish')}</div>
          <div>{T2('Hindi')}</div>
          <div>{T2('Type')}</div>
          <div>{T2('Maps to')}</div>
          <div>{T2('Used in')}</div>
          <div></div>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '30px 12px', textAlign: 'center', color: C.muted, fontSize: 12 }}>
            {q ? T2('No matches.') : T2('No dishes match the current filter.')}
          </div>
        )}

        {filtered.slice(0, 500).map(function(d) {
          var isSel = !!selected[d.dish_name];
          var mapText = d.type === 'inv' && d.store
            ? (d.store.ops_item_name + ' · ' + (d.store.qty_per_cover || 1) + ' ' + (d.store.ops_item_unit || '') + '/pax')
            : d.type === 'sop'
              ? (d.mappedTo || d.catName || 'SOP')
              : d.type === 'nosop'
                ? T2('(no SOP set)')
                : T2('unmapped');
          var mapColor = d.type === 'inv' ? '#0F6E56' : d.type === 'unmapped' ? C.red : C.muted;
          return (
            <div key={d.dish_name}
              style={{
                display: 'grid', gridTemplateColumns: '28px 1.6fr 1.1fr 0.7fr 1.4fr 1.2fr 0.4fr', gap: 8, padding: '9px 12px',
                borderTop: '1px solid ' + C.borderLight,
                alignItems: 'center',
                background: isSel ? C.blueBg : (d.is_active ? 'transparent' : C.bg),
                opacity: d.is_active ? 1 : 0.6,
                cursor: 'pointer',
              }}
              onClick={function(e) {
                if (e.target.tagName === 'INPUT' || e.target.closest('.dish-pill') || e.target.closest('button')) return;
                openDetail(d.dish_name);
              }}
            >
              <div onClick={function(e) { e.stopPropagation(); toggleSelect(d.dish_name); }}>
                <input type="checkbox" checked={isSel} readOnly style={{ cursor: 'pointer', margin: 0 }} />
              </div>
              <div style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.dish_name}
                {!d.is_active && <span style={{ marginLeft: 6, fontSize: 10, color: C.muted, fontStyle: 'italic' }}>({T2('retired')})</span>}
              </div>
              <div style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.hindi || '—'}</div>
              <div>{typeBadge(d.type)}</div>
              <div style={{ color: mapColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mapText}</div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {d.packages.length === 0 && <span style={{ fontSize: 10, color: C.faint, fontStyle: 'italic' }}>{T2('unused')}</span>}
                {d.packages.slice(0, 2).map(function(p) {
                  return <span key={p} className="dish-pill" onClick={function(e) { e.stopPropagation(); onJumpToPackage(p); }}
                    style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: C.bg, color: C.text, cursor: 'pointer', border: '1px solid ' + C.borderLight }}>{p}</span>;
                })}
                {d.packages.length > 2 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: C.bg, color: C.muted }}>+{d.packages.length - 2}</span>}
              </div>
              <div style={{ textAlign: 'right', color: C.muted }}>
                {!d.is_active && isAdmin && (
                  <button onClick={function(e) { e.stopPropagation(); handleRestore(d.dish_name); }}
                    title={T2('Restore')}
                    style={{ background: 'transparent', border: 'none', color: C.green, cursor: 'pointer', fontSize: 14, padding: 2 }}>↺</button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length > 500 && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid ' + C.borderLight, textAlign: 'center', color: C.faint, fontSize: 11 }}>
            {T2('Showing 500 of ')}{filtered.length}{T2('. Refine the filter or search to see more.')}
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {detailFor && (
        <div onClick={closeDetail}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 560, width: '100%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{detailFor}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {detailPkgs.length > 0 ? T2('Used in ') + detailPkgs.length + T2(' package(s)') : T2('Not used in any package')}
                </div>
              </div>
              <button onClick={closeDetail} disabled={!!detailSaving}
                style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: detailSaving ? 'not-allowed' : 'pointer', padding: 4 }}>×</button>
            </div>

            {/* Hindi */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{T2('Hindi')}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={detailHindiBuf} onChange={function(e) { setDetailHindiBuf(e.target.value); }}
                  placeholder={T2('Hindi name…')} disabled={!isAdmin}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid ' + C.border, background: C.bg, fontSize: 13, color: C.text }} />
                {isAdmin && (
                  <button onClick={function() { setDetailHindiBuf(transliterateName(detailFor)); }}
                    title={T2('Auto-transliterate (Sanscript ITRANS)')}
                    disabled={!!detailSaving}
                    style={{ padding: '6px 10px', borderRadius: 6, background: C.bg, border: '1px solid ' + C.border, fontSize: 11, color: C.text, cursor: 'pointer', fontWeight: 600 }}>🅷</button>
                )}
                {isAdmin && (
                  <button onClick={saveDetailHindi} disabled={!!detailSaving || (detailHindiBuf || '') === (DISH_HINDI_MAP[detailFor] || '')}
                    style={{ padding: '6px 14px', borderRadius: 6, background: C.green, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: detailSaving === 'hindi' ? 'wait' : 'pointer', opacity: (detailSaving || (detailHindiBuf || '') === (DISH_HINDI_MAP[detailFor] || '')) ? 0.5 : 1 }}>
                    {detailSaving === 'hindi' ? T2('Saving…') : T2('Save')}
                  </button>
                )}
              </div>
            </div>

            {/* Type toggle */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{T2('Mapping type')}</div>
              <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 6, padding: 3, width: 'fit-content' }}>
                <button onClick={function() { setDetailType('sop'); }}
                  style={{ padding: '5px 14px', borderRadius: 4, background: detailType === 'sop' ? '#3B6D11' : 'transparent', color: detailType === 'sop' ? '#fff' : C.muted, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>SOP {T2('recipe')}</button>
                <button onClick={function() { setDetailType('store'); loadStoreItems(); }}
                  style={{ padding: '5px 14px', borderRadius: 4, background: detailType === 'store' ? '#0F6E56' : 'transparent', color: detailType === 'store' ? '#fff' : C.muted, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{T2('Inventory')}</button>
              </div>
              <div style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>{T2('Mutually exclusive — picking one clears the other.')}</div>
            </div>

            {/* SOP picker */}
            {detailType === 'sop' && (
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
                      <div key={r.n} onClick={function() { if (isAdmin && !detailSaving) saveDetailSop(r.n); }}
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
                    <button onClick={clearDetailSop} disabled={!!detailSaving}
                      style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px dashed ' + C.border, color: C.muted, fontSize: 11, cursor: 'pointer' }}>
                      {T2('Mark as no SOP')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Inventory picker */}
            {detailType === 'store' && (
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
                        <button onClick={saveDetailStore} disabled={!!detailSaving || !storeItemPick}
                          style={{ padding: '5px 14px', borderRadius: 6, background: '#0F6E56', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: (detailSaving || !storeItemPick) ? 'not-allowed' : 'pointer', opacity: (detailSaving || !storeItemPick) ? 0.5 : 1, marginLeft: 'auto' }}>
                          {detailSaving === 'store' ? T2('Saving…') : T2('Link')}
                        </button>
                      )}
                    </div>
                    {detailStore && isAdmin && (
                      <div style={{ textAlign: 'right' }}>
                        <button onClick={clearDetailStore} disabled={!!detailSaving}
                          style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px dashed ' + C.border, color: C.muted, fontSize: 11, cursor: 'pointer' }}>
                          {T2('Remove inventory mapping')}
                        </button>
                      </div>
                    )}
                  </React.Fragment>
                )}
              </div>
            )}

            {/* Packages usage */}
            {detailPkgs.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{T2('Used in packages')}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {detailPkgs.map(function(p) {
                    return <button key={p} onClick={function() { closeDetail(); onJumpToPackage(p); }}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: C.bg, color: C.text, border: '1px solid ' + C.borderLight, cursor: 'pointer' }}>{p} →</button>;
                  })}
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 12, borderTop: '1px solid ' + C.border }}>
              {isAdmin ? (
                <button onClick={handleDeactivate} disabled={!!detailSaving}
                  style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid ' + C.redBorder, color: C.red, fontSize: 12, fontWeight: 600, cursor: detailSaving === 'deact' ? 'wait' : 'pointer' }}>
                  🗑 {T2('Retire dish')}
                </button>
              ) : <span />}
              <button onClick={closeDetail} disabled={!!detailSaving}
                style={{ padding: '6px 14px', borderRadius: 6, background: C.text, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: detailSaving ? 'not-allowed' : 'pointer' }}>
                {T2('Done')}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default DishLibrary;
export { DishLibrary };