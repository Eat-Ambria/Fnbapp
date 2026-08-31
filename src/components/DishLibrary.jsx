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
import DishSectionsEditor from './DishSectionsEditor.jsx';
import {
  getAllDishes, upsertDishMaster, deactivateDish,
  RECIPE_DB,
  resolveDishHindi, upsertDishHindi, DISH_HINDI_MAP,
  resolveDishStore, upsertDishStoreMap, DISH_STORE_MAP,
  DISH_NAME_MAP, packagesContainingDish, findRecipeForDish,
  getSectionsForPackage, setPackageSections, getCatIdForDish
} from '../data/recipeData.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { supabase } from '../lib/supabase.js';
import { getCateringStoreItemsCached, opsSupabase } from '../lib/opsSupabase.js';
import { transliterateName } from '../utils/helpers.js';
import DishMappingModal from './DishMappingModal.jsx';

function DishLibrary(props) {
  var lang           = props.lang || 'en';
  var currentUser    = props.currentUser || null;
  var onJumpToPackage= props.onJumpToPackage || function() {};
  var T2             = function(s) { return T(s, lang); };
  var isAdmin        = currentUser && (currentUser.role === 'admin' || currentUser.role === 'headchef');

  // ── State ────────────────────────────────────────────────────────
  var [view, setView]         = useState('library'); // 'library' | 'sections'
  var [q, setQ]               = useState('');
  var [filter, setFilter]     = useState('all'); // all | sop | inv | unmapped | unused
  var [showRetired, setShowRetired] = useState(false);
  var [localBump, setLocalBump]     = useState(0);
  var [selected, setSelected]       = useState({}); // { [dishName]: true }
  var [bulkSaving, setBulkSaving]   = useState(false);

  // Detail modal — most state now lives in DishMappingModal (V66)
  var [detailFor, setDetailFor] = useState('');

  // Add new dish
  var [creating, setCreating] = useState(false);

  // Merge / Rename modal state
  var [mergeOpen, setMergeOpen]       = useState(false);
  var [mergeTarget, setMergeTarget]   = useState('');
  var [mergeSaving, setMergeSaving]   = useState(false);

  // ── Data ─────────────────────────────────────────────────────────
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

  // ── Menu-packages cascade helper ─────────────────────────────────
  // renameMap: { sourceName: targetName-or-null }. null = strip source, string = replace.
  // Rewrites menu_packages.dishes[] and menu_packages.sections[].dishes[] and syncs in-memory.
  async function applyRenameToPackages(renameMap) {
    var sources = Object.keys(renameMap);
    if (sources.length === 0) return { affected: 0 };
    // Find affected package names from live MENU_PACKAGES (any package containing any source)
    var affected = [];
    Object.keys(MENU_PACKAGES).forEach(function(pkg) {
      var list = MENU_PACKAGES[pkg] || [];
      for (var i = 0; i < sources.length; i++) {
        if (list.indexOf(sources[i]) !== -1) { affected.push(pkg); return; }
      }
    });
    if (affected.length === 0) return { affected: 0 };
    // Fetch fresh sections JSONB from Supabase for each affected package
    var fetchRes = await supabase.from('menu_packages').select('name, dishes, sections').in('name', affected);
    if (fetchRes.error) throw fetchRes.error;
    var pkgRows = fetchRes.data || [];
    // Rewrite each package
    for (var pi = 0; pi < pkgRows.length; pi++) {
      var row = pkgRows[pi];
      var rewriteList = function(arr) {
        var out = [];
        var seen = {};
        (arr || []).forEach(function(name) {
          var nm = name in renameMap ? renameMap[name] : name;
          if (nm == null) return; // stripped
          if (seen[nm]) return;   // dedupe
          seen[nm] = true;
          out.push(nm);
        });
        return out;
      };
      var newDishes = rewriteList(row.dishes || []);
      var newSections = (row.sections || []).map(function(sec) {
        return { id: sec.id, name: sec.name, sop_category: sec.sop_category, dishes: rewriteList(sec.dishes || []) };
      });
      var uRes = await supabase.from('menu_packages').update({ dishes: newDishes, sections: newSections }).eq('name', row.name);
      if (uRes.error) throw uRes.error;
      // Sync in-memory
      MENU_PACKAGES[row.name] = newDishes;
      try { setPackageSections(row.name, newSections, newDishes); } catch(e) {}
    }
    // Clear localStorage caches so next hydration is fresh
    try {
      localStorage.removeItem('ambria_menu_packages');
      localStorage.removeItem('ambria_cfg_menu_packages');
    } catch(e) {}
    return { affected: pkgRows.length };
  }

  // ── Rename / Merge ───────────────────────────────────────────────
  function openMerge() {
    if (selectedCount === 0) return;
    // Default target = first selected (alphabetical)
    var sorted = selectedNames.slice().sort();
    setMergeTarget(sorted[0]);
    setMergeOpen(true);
  }
  function closeMerge() {
    if (mergeSaving) return;
    setMergeOpen(false);
    setMergeTarget('');
  }
  async function confirmMerge() {
    if (!isAdmin) return;
    var target = (mergeTarget || '').trim();
    if (!target) { alert(T2('Enter a target dish name.')); return; }
    var sources = selectedNames.filter(function(n) { return n !== target; });
    if (sources.length === 0 && selectedCount === 1 && selectedNames[0] === target) {
      alert(T2('Target is the same as the selected dish. Nothing to rename.'));
      return;
    }
    var isRename = selectedCount === 1 && sources.length === 1;
    var verb = isRename ? T2('Rename "') + sources[0] + T2('" to "') + target + T2('"?')
                        : T2('Merge ') + sources.length + T2(' dish(es) into "') + target + T2('"?');
    var warn = '\n\n' + T2('This will:') +
      '\n• ' + T2('Replace the merged name(s) in every menu package that references them') +
      '\n• ' + T2('Delete the merged dish(es) from the library and drop their Hindi / SOP / Inventory mappings') +
      '\n• ' + T2('Keep the target\'s own mappings unchanged');
    if (!window.confirm(verb + warn)) return;
    setMergeSaving(true);
    try {
      // 1. Ensure target row exists in dishes_master
      var insRes = await supabase.from('dishes_master').upsert({ dish_name: target, is_active: true }, { onConflict: 'dish_name', ignoreDuplicates: true });
      if (insRes.error && insRes.error.code !== '23505') throw insRes.error;
      upsertDishMaster(target, { is_active: true });
      // 2. Delete source rows from side tables
      if (sources.length > 0) {
        var delCat  = await supabase.from('dish_categories').delete().in('dish_name', sources);
        if (delCat.error) throw delCat.error;
        var delHi   = await supabase.from('dish_hindi_map').delete().in('dish_name', sources);
        if (delHi.error) throw delHi.error;
        var delStr  = await supabase.from('dish_store_map').delete().in('dish_name', sources);
        if (delStr.error) throw delStr.error;
        var delNm   = await supabase.from('dish_name_map').delete().in('lms_name', sources);
        if (delNm.error) throw delNm.error;
        // In-memory cleanup
        sources.forEach(function(s) {
          upsertDishHindi(s, '');
          upsertDishStoreMap(s, null);
          if (DISH_NAME_MAP[s]) delete DISH_NAME_MAP[s];
        });
      }
      // 3. Rewrite menu_packages
      var renameMap = {};
      sources.forEach(function(s) { renameMap[s] = target; });
      var { affected } = await applyRenameToPackages(renameMap);
      // 4. Delete source rows from dishes_master (last, so packages already rewritten)
      if (sources.length > 0) {
        var delMst = await supabase.from('dishes_master').delete().in('dish_name', sources);
        if (delMst.error) throw delMst.error;
        // In-memory: mark inactive so getAllDishes drops them (deactivateDish flips is_active=false)
        sources.forEach(function(s) { deactivateDish(s); });
      }
      setSelected({});
      setMergeOpen(false);
      setMergeTarget('');
      setLocalBump(function(n) { return n + 1; });
      alert(isRename ? T2('Renamed. ') + affected + T2(' package(s) updated.') 
                     : T2('Merged ') + sources.length + T2(' dish(es) into "') + target + T2('". ') + affected + T2(' package(s) updated.'));
    } catch (e) {
      alert('Merge failed: ' + (e.message || e));
    } finally {
      setMergeSaving(false);
    }
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
    } catch (e) { alert('Save failed: ' + e.message); }
    finally { setCreating(false); }
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
  

  return (
    <div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid ' + C.border, marginBottom: 16 }}>
        {[
          { id: 'library',  label: T2('All dishes') },
          { id: 'sections', label: T2('Sections') },
        ].map(function(t){
          var active = view === t.id;
          return (
            <button key={t.id} onClick={function(){ setView(t.id); }}
              style={{
                padding: '10px 18px', background: 'transparent', border: 0,
                borderBottom: '2px solid ' + (active ? C.gold : 'transparent'),
                color: active ? C.text : C.muted,
                fontSize: 13, fontWeight: active ? 500 : 400, cursor: 'pointer',
                marginBottom: -1,
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {view === 'sections' && (
        <DishSectionsEditor lang={lang} currentUser={currentUser} />
      )}

      {view === 'library' && <>

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
              <button onClick={openMerge} disabled={bulkSaving}
                title={selectedCount === 1 ? T2('Rename this dish (updates every package that uses it)') : T2('Merge selected dishes into one canonical name (updates every package)')}
                style={{ padding: '4px 10px', borderRadius: 6, background: C.surface, border: '1px solid ' + C.wine, fontSize: 11, color: C.wine, cursor: bulkSaving ? 'wait' : 'pointer', fontWeight: 600 }}>
                🔀 {selectedCount === 1 ? T2('Rename') : T2('Merge')}
              </button>
            )}
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
                setDetailFor(d.dish_name);
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

      {/* MERGE / RENAME MODAL */}
      {mergeOpen && (
        <div onClick={closeMerge}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 480, width: '100%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  🔀 {selectedCount === 1 ? T2('Rename dish') : T2('Merge ') + selectedCount + T2(' dishes')}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {T2('The target name replaces the others in every menu package.')}
                </div>
              </div>
              <button onClick={closeMerge} disabled={mergeSaving}
                style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: mergeSaving ? 'not-allowed' : 'pointer', padding: 4 }}>×</button>
            </div>

            {/* Selected dishes list — click to make target */}
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{T2('Selected — click one to make it the target')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, maxHeight: 140, overflowY: 'auto' }}>
              {selectedNames.slice().sort().map(function(n) {
                var isT = n === mergeTarget;
                return (
                  <button key={n} onClick={function() { setMergeTarget(n); }} disabled={mergeSaving}
                    style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: mergeSaving ? 'not-allowed' : 'pointer',
                      background: isT ? C.wine : C.bg, color: isT ? '#fff' : C.text,
                      border: '1px solid ' + (isT ? C.wine : C.border), fontWeight: isT ? 600 : 400 }}>
                    {isT ? '✓ ' : ''}{n}
                  </button>
                );
              })}
            </div>

            {/* Custom target name */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{T2('Or type a new target name')}</div>
              <input value={mergeTarget} onChange={function(e) { setMergeTarget(e.target.value); }} disabled={mergeSaving}
                placeholder={T2('Target dish name…')}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid ' + C.border, background: C.bg, fontSize: 13, color: C.text, boxSizing: 'border-box' }} />
            </div>

            {/* Warning */}
            <div style={{ padding: '10px 12px', background: C.amberBg, border: '1px solid ' + C.amberBorder, borderRadius: 6, fontSize: 11, color: C.text, marginBottom: 14, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: C.amber, marginBottom: 4 }}>⚠ {T2('What this does')}</div>
              • {T2('Replaces the merged name(s) in every menu package that uses them')}<br/>
              • {T2('Deletes the merged dish(es) from the library')}<br/>
              • {T2('Drops the merged dishes\' own Hindi / SOP / Inventory mappings — the target\'s are kept')}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid ' + C.border }}>
              <button onClick={closeMerge} disabled={mergeSaving}
                style={{ padding: '6px 14px', borderRadius: 6, background: 'transparent', border: '1px solid ' + C.border, color: C.muted, fontSize: 12, fontWeight: 600, cursor: mergeSaving ? 'not-allowed' : 'pointer' }}>
                {T2('Cancel')}
              </button>
              <button onClick={confirmMerge} disabled={mergeSaving || !mergeTarget.trim()}
                style={{ padding: '6px 14px', borderRadius: 6, background: C.wine, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: (mergeSaving || !mergeTarget.trim()) ? 'not-allowed' : 'pointer', opacity: (mergeSaving || !mergeTarget.trim()) ? 0.5 : 1 }}>
                {mergeSaving ? T2('Working…') : (selectedCount === 1 ? T2('Rename') : T2('Merge'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL — extracted to shared DishMappingModal (V66) */}
      <DishMappingModal
        dishName={detailFor}
        lang={lang}
        currentUser={currentUser}
        onClose={function() { setDetailFor(''); }}
        onChange={function() { setLocalBump(function(n) { return n + 1; }); }}
        onJumpToPackage={onJumpToPackage}
        allowDeactivate={true}
      />

      </>}
    </div>
  );
}

export default DishLibrary;
export { DishLibrary };