// Ambria FnB — Dish Library (right pane of Menu Package Builder)
// Read-only browse + click-to-add + create-new. Standalone; owns its own filter state.
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { C } from '../data/constants.js';
import { getAllDishes, upsertDishMaster, RECIPE_DB, resolveDishHindi, packagesContainingDish, upsertDishHindi, upsertDishCat, deactivateDish, DISH_HINDI_MAP } from '../data/recipeData.js';
import { supabase } from '../lib/supabase.js';

function DishLibrary(props) {
  var activeSection      = props.activeSection || '';
  var setActiveSection   = props.setActiveSection || function() {};
  var sectionOptions     = props.sectionOptions || [];  // array of section names
  var existingInSection  = props.existingInSection || new Set();
  var onAdd              = props.onAdd || function() {};
  var T2                 = props.T2 || function(s) { return s; };

  var [q, setQ]                 = useState('');
  var [filter, setFilter]       = useState('all');   // all | mapped | unmapped
  var [catFilter, setCatFilter] = useState('');       // '' or catId
  var [catMenuOpen, setCatMenuOpen] = useState(false);
  var [flash, setFlash]         = useState('');
  var [creating, setCreating]   = useState(false);
  var [mapOpenFor, setMapOpenFor] = useState('');
  var [mapSearch, setMapSearch]   = useState('');
  var [mapSaving, setMapSaving]   = useState(false);
  var [showRetired, setShowRetired] = useState(false);
  var [localBump, setLocalBump]     = useState(0);
  var [restoring, setRestoring]     = useState('');
  var [detailFor, setDetailFor]             = useState('');
  var [detailHindiBuf, setDetailHindiBuf]   = useState('');
  var [detailCatBuf, setDetailCatBuf]       = useState('');
  var [detailSaving, setDetailSaving]       = useState('');   // '' | 'hindi' | 'cat' | 'sop' | 'deact'
  var [detailMapOpen, setDetailMapOpen]     = useState(false);
  var [detailMapSearch, setDetailMapSearch] = useState('');
  var [detailUsageOpen, setDetailUsageOpen] = useState(false);
  var flashTimer = useRef(null);

  var allRecipes = useMemo(function() {
    var out = [];
    (RECIPE_DB.cats || []).forEach(function(c) {
      (RECIPE_DB.recipes[c.id] || []).forEach(function(r) {
        if (r && r.n) out.push({ n: r.n, cat: c.name });
      });
    });
    return out.sort(function(a, b) { return a.n.localeCompare(b.n); });
  }, [props.refreshKey]);

  useEffect(function() { return function() { if (flashTimer.current) clearTimeout(flashTimer.current); }; }, []);
  useEffect(function() {
    if (!detailFor) return;
    function onKey(e) { if (e.key === 'Escape') { setDetailFor(''); setDetailMapOpen(false); setDetailMapSearch(''); setDetailUsageOpen(false); } }
    document.addEventListener('keydown', onKey);
    return function() { document.removeEventListener('keydown', onKey); };
  }, [detailFor]);

  var allDishes = useMemo(function() { return getAllDishes({ includeInactive: showRetired }); }, [props.refreshKey, showRetired, localBump]);

  var cats = (RECIPE_DB.cats || []);
  var catNameById = {}; cats.forEach(function(c) { catNameById[c.id] = c.name; });

  var filtered = useMemo(function() {
    var qL = q.trim().toLowerCase();
    return allDishes.filter(function(d) {
      if (qL && d.dish_name.toLowerCase().indexOf(qL) === -1) return false;
      if (filter === 'mapped'   && !d.hasRecipe) return false;
      if (filter === 'unmapped' &&  d.hasRecipe) return false;
      if (catFilter && d.catId !== catFilter) return false;
      return true;
    });
  }, [allDishes, q, filter, catFilter]);

  var exactMatch = q.trim() && allDishes.some(function(d) { return d.dish_name.toLowerCase() === q.trim().toLowerCase(); });
  var showCreate = q.trim() && !exactMatch && !creating;

  function handleAdd(dishName) {
    if (!activeSection) { alert(T2('Pick a section first')); return; }
    if (existingInSection.has(dishName)) {
      setFlash(dishName);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(function() { setFlash(''); }, 700);
      return;
    }
    onAdd(dishName, activeSection);
  }

  async function handleCreate() {
    var name = q.trim(); if (!name) return;
    if (!activeSection) { alert(T2('Pick a section first')); return; }
    setCreating(true);
    try {
      var res = await supabase.from('dishes_master').insert({ dish_name: name }).select();
      if (res.error && res.error.code !== '23505') { alert('Save failed: ' + res.error.message); return; }
      upsertDishMaster(name, { is_active: true });
      onAdd(name, activeSection);
      setQ('');
    } catch (e) { alert('Save failed: ' + e.message); }
    finally { setCreating(false); }
  }

  function openMapFor(dishName) {
    if (mapOpenFor === dishName) { setMapOpenFor(''); setMapSearch(''); return; }
    setMapOpenFor(dishName); setMapSearch('');
  }
  async function pickSop(dishName, recipeName) {
    setMapSaving(true);
    try { await (props.onMapSop || function() {})(dishName, recipeName); }
    finally { setMapSaving(false); setMapOpenFor(''); setMapSearch(''); }
  }
  async function clearSop(dishName) {
    if (!window.confirm(T2('Mark as no SOP for this dish?'))) return;
    setMapSaving(true);
    try { await (props.onClearSop || function() {})(dishName); }
    finally { setMapSaving(false); setMapOpenFor(''); setMapSearch(''); }
  }

  async function handleRestore(dishName) {
    setRestoring(dishName);
    try {
      var res = await supabase.from('dishes_master').update({ is_active: true }).eq('dish_name', dishName);
      if (res.error) { alert('Restore failed: ' + res.error.message); return; }
      upsertDishMaster(dishName, { is_active: true });
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Restore failed: ' + e.message); }
    finally { setRestoring(''); }
  }

  function openDetail(dishName) {
    var row = allDishes.find(function(x) { return x.dish_name === dishName; });
    setDetailFor(dishName);
    setDetailHindiBuf((row && row.hindi) || DISH_HINDI_MAP[dishName] || '');
    setDetailCatBuf((row && row.catId) || '');
    setDetailMapOpen(false); setDetailMapSearch(''); setDetailUsageOpen(false);
  }
  function closeDetail() {
    setDetailFor(''); setDetailMapOpen(false); setDetailMapSearch(''); setDetailUsageOpen(false);
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
  async function saveDetailCat(catId) {
    if (!detailFor || !catId) return;
    setDetailSaving('cat');
    setDetailCatBuf(catId);
    try {
      var res = await supabase.from('dish_categories').upsert({ dish_name: detailFor, category_id: catId }, { onConflict: 'dish_name' });
      if (res.error) throw res.error;
      upsertDishCat(detailFor, catId);
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Category save failed: ' + e.message); }
    finally { setDetailSaving(''); }
  }
  async function saveDetailSop(recipeName) {
    if (!detailFor) return;
    setDetailSaving('sop');
    try { await (props.onMapSop || function() {})(detailFor, recipeName); }
    finally { setDetailSaving(''); setDetailMapOpen(false); setDetailMapSearch(''); }
  }
  async function clearDetailSop() {
    if (!detailFor) return;
    if (!window.confirm(T2('Mark as no SOP for this dish?'))) return;
    setDetailSaving('sop');
    try { await (props.onClearSop || function() {})(detailFor); }
    finally { setDetailSaving(''); setDetailMapOpen(false); setDetailMapSearch(''); }
  }
  async function handleDeactivate() {
    if (!detailFor) return;
    if (!window.confirm(T2('Retire "') + detailFor + T2('"? It will be hidden from the library unless "Show retired" is on.'))) return;
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

  var chip = function(v, label) {
    var on = filter === v;
    return React.createElement('button', {
      key: v, onClick: function() { setFilter(v); },
      style: { fontSize: 10, padding: '3px 10px', borderRadius: 12, background: on ? C.wine : 'transparent', color: on ? '#fff' : C.muted, border: '1px solid ' + (on ? C.wine : C.border), cursor: 'pointer', fontWeight: on ? 600 : 500 }
    }, label);
  };

  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', minHeight: 460, maxHeight: 720, position: 'sticky', top: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{T2('Dish library')}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{filtered.length} / {allDishes.length}</div>
      </div>

      {/* Adding-to selector */}
      <div style={{ fontSize: 11, color: activeSection ? C.green : C.amber, background: activeSection ? C.greenBg : C.amberBg, borderRadius: 6, padding: '6px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{T2('Adding to')}:</span>
        <select value={activeSection} onChange={function(e) { setActiveSection(e.target.value); }}
          style={{ flex: 1, padding: '2px 4px', border: 'none', background: 'transparent', fontSize: 11, fontWeight: 600, color: activeSection ? C.green : C.amber, cursor: 'pointer' }}>
          <option value="">{T2('— pick a section —')}</option>
          {sectionOptions.map(function(s) { return <option key={s} value={s}>{s}</option>; })}
        </select>
      </div>

      {/* Search */}
      <input type="text" value={q} onChange={function(e) { setQ(e.target.value); }} placeholder={T2('Search dishes…')}
        style={{ width: '100%', padding: '6px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, background: C.bg, color: C.text, boxSizing: 'border-box', marginBottom: 8 }} />

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {chip('all', T2('All'))}
        {chip('mapped', T2('Has SOP'))}
        {chip('unmapped', T2('Unmapped'))}
        <div style={{ position: 'relative' }}>
          <button onClick={function() { setCatMenuOpen(!catMenuOpen); }}
            style={{ fontSize: 10, padding: '3px 10px', borderRadius: 12, background: catFilter ? C.wine : 'transparent', color: catFilter ? '#fff' : C.muted, border: '1px solid ' + (catFilter ? C.wine : C.border), cursor: 'pointer' }}>
            {catFilter ? (catNameById[catFilter] || catFilter) : T2('Cat')} ▾
          </button>
          {catMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 5, minWidth: 160, maxHeight: 220, overflowY: 'auto' }}>
              <div onClick={function() { setCatFilter(''); setCatMenuOpen(false); }}
                style={{ padding: '6px 10px', fontSize: 11, cursor: 'pointer', color: !catFilter ? C.wine : C.text, borderBottom: '1px solid ' + C.borderLight, fontWeight: !catFilter ? 600 : 400 }}>
                {T2('All categories')}
              </div>
              {cats.map(function(c) {
                return <div key={c.id} onClick={function() { setCatFilter(c.id); setCatMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 11, cursor: 'pointer', color: catFilter === c.id ? C.wine : C.text, fontWeight: catFilter === c.id ? 600 : 400 }}>
                  {c.icon} {c.name}
                </div>;
              })}
            </div>
          )}
        </div>
        <button onClick={function() { setShowRetired(!showRetired); }} title={T2('Toggle retired dishes')}
          style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 10px', borderRadius: 12, background: showRetired ? C.faint : 'transparent', color: showRetired ? C.text : C.muted, border: '1px dashed ' + C.border, cursor: 'pointer', fontWeight: showRetired ? 600 : 500 }}>
          {showRetired ? '👁 ' + T2('Retired on') : T2('Show retired')}
        </button>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid ' + C.borderLight, marginBottom: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: '16px 4px', fontSize: 11, color: C.muted, textAlign: 'center' }}>
            {q ? T2('No matches. Try Create new below.') : T2('No dishes match your filters.')}
          </div>
        )}
        {filtered.slice(0, 300).map(function(d) {
          var isDup        = existingInSection.has(d.dish_name);
          var isFlashing   = flash === d.dish_name;
          var isMapOpen    = mapOpenFor === d.dish_name;
          var isRetired    = d.is_active === false;
          var isRestoring  = restoring === d.dish_name;
          var mapMatches  = mapSearch.trim()
            ? allRecipes.filter(function(r) { return r.n.toLowerCase().indexOf(mapSearch.trim().toLowerCase()) !== -1; }).slice(0, 8)
            : allRecipes.slice(0, 8);
          var subline = d.hasRecipe
            ? (d.mappedTo ? ('→ ' + d.mappedTo) : (d.catName || T2('SOP')))
            : (d.explicitNone ? T2('No SOP') : T2('Unmapped'));
          var sublineColor = d.hasRecipe ? C.muted : (d.explicitNone ? C.faint : C.amber);
          return (
            <div key={d.dish_name} style={{ borderBottom: '1px solid ' + C.borderLight }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '7px 4px', background: isFlashing ? C.amberBg : (isDup ? C.bg : 'transparent'), transition: 'background 200ms', opacity: isRetired ? 0.5 : (isDup ? 0.55 : 1), filter: isRetired ? 'grayscale(0.6)' : 'none' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div onClick={function() { openDetail(d.dish_name); }} title={T2('View details')}
                    style={{ fontSize: 12, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isRetired ? 'line-through' : 'none', cursor: 'pointer' }}>{d.dish_name}</div>
                  <div style={{ fontSize: 10, color: sublineColor, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isRetired && <span style={{ fontSize: 8, fontWeight: 700, color: C.muted, background: C.faint, padding: '1px 5px', borderRadius: 3, letterSpacing: 0.4, flexShrink: 0 }}>{T2('RETIRED')}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{subline}</span>
                  </div>
                </div>
                {!isRetired && (
                  <button onClick={function() { openMapFor(d.dish_name); }} title={d.hasRecipe ? T2('Change SOP mapping') : T2('Map to SOP')}
                    style={{ width: 24, height: 24, borderRadius: 6, background: isMapOpen ? C.blue : (d.hasRecipe ? 'transparent' : C.amberBg), color: isMapOpen ? '#fff' : (d.hasRecipe ? C.muted : C.amber), border: '1px solid ' + (isMapOpen ? C.blue : (d.hasRecipe ? C.border : C.amberBorder)), fontSize: 12, lineHeight: 1, cursor: 'pointer', flexShrink: 0, padding: 0 }}>🔗</button>
                )}
                {isRetired ? (
                  <button onClick={function() { handleRestore(d.dish_name); }} disabled={isRestoring} title={T2('Restore dish')}
                    style={{ padding: '3px 8px', borderRadius: 6, background: C.greenBg, color: C.green, border: '1px solid ' + C.greenBorder, fontSize: 10, fontWeight: 600, cursor: isRestoring ? 'wait' : 'pointer', flexShrink: 0, filter: 'grayscale(0)' }}>
                    {isRestoring ? '…' : T2('Restore')}
                  </button>
                ) : (
                  <button onClick={function() { handleAdd(d.dish_name); }} disabled={isDup} title={isDup ? T2('Already in section') : T2('Add to section')}
                    style={{ width: 24, height: 24, borderRadius: 6, background: isDup ? C.faint : C.wine, color: '#fff', border: 'none', fontSize: 15, lineHeight: 1, cursor: isDup ? 'not-allowed' : 'pointer', flexShrink: 0, padding: 0 }}>+</button>
                )}
              </div>
              {isMapOpen && (
                <div style={{ padding: '8px 4px 10px', background: C.blueBg, borderTop: '1px solid ' + C.blueBorder }}>
                  <input autoFocus type="text" value={mapSearch} onChange={function(e) { setMapSearch(e.target.value); }} placeholder={T2('Search SOP recipes…')}
                    onKeyDown={function(e) { if (e.key === 'Escape') { setMapOpenFor(''); setMapSearch(''); } }}
                    style={{ width: '100%', padding: '5px 8px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 11, background: C.surface, color: C.text, boxSizing: 'border-box', marginBottom: 6 }} />
                  <div style={{ maxHeight: 180, overflowY: 'auto', background: C.surface, border: '1px solid ' + C.borderLight, borderRadius: 6 }}>
                    {mapMatches.length === 0 && <div style={{ padding: '8px', fontSize: 10, color: C.muted, textAlign: 'center' }}>{T2('No SOP recipes match')}</div>}
                    {mapMatches.map(function(r) {
                      var isCurrent = d.mappedTo === r.n || (d.hasRecipe && !d.mappedTo && r.n === d.dish_name);
                      return (
                        <div key={r.n} onClick={mapSaving ? null : function() { pickSop(d.dish_name, r.n); }}
                          style={{ padding: '5px 8px', fontSize: 11, cursor: mapSaving ? 'wait' : 'pointer', borderBottom: '1px solid ' + C.borderLight, background: isCurrent ? C.greenBg : 'transparent', color: isCurrent ? C.green : C.text, fontWeight: isCurrent ? 600 : 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n}</span>
                          <span style={{ fontSize: 9, color: isCurrent ? C.green : C.muted, marginLeft: 8, flexShrink: 0 }}>{r.cat}{isCurrent ? ' · current' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'space-between' }}>
                    <button onClick={function() { setMapOpenFor(''); setMapSearch(''); }} disabled={mapSaving}
                      style={{ padding: '4px 10px', fontSize: 10, background: 'transparent', border: '1px solid ' + C.border, borderRadius: 6, color: C.muted, cursor: 'pointer' }}>{T2('Cancel')}</button>
                    <button onClick={function() { clearSop(d.dish_name); }} disabled={mapSaving}
                      style={{ padding: '4px 10px', fontSize: 10, background: 'transparent', border: '1px solid ' + C.border, borderRadius: 6, color: C.amber, cursor: 'pointer' }}>{T2('Mark as no SOP')}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length > 300 && (
          <div style={{ padding: '8px 4px', fontSize: 10, color: C.muted, textAlign: 'center' }}>{T2('… narrow search to see more')}</div>
        )}
      </div>

      {/* Create-new footer */}
      {showCreate && (
        <button onClick={handleCreate} disabled={creating}
          style={{ width: '100%', padding: 8, fontSize: 12, color: C.green, background: C.greenBg, border: '1px dashed ' + C.greenBorder, borderRadius: 8, cursor: creating ? 'not-allowed' : 'pointer', textAlign: 'left' }}>
          {creating ? T2('Creating…') : ('+ ' + T2('Create new dish') + ' “' + q.trim() + '” ' + T2('and add'))}
        </button>
      )}

      {/* ── Dish detail popover ── */}
      {detailFor && (function() {
        var row = allDishes.find(function(x) { return x.dish_name === detailFor; }) || { dish_name: detailFor, is_active: true };
        var usage = packagesContainingDish(detailFor);
        var currentSop = row.hasRecipe ? (row.mappedTo || row.dish_name) : null;
        var detailMapMatches = detailMapSearch.trim()
          ? allRecipes.filter(function(r) { return r.n.toLowerCase().indexOf(detailMapSearch.trim().toLowerCase()) !== -1; }).slice(0, 8)
          : allRecipes.slice(0, 8);
        return (
          <div onClick={closeDetail}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={function(e) { e.stopPropagation(); }}
              style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto', padding: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3, flex: 1 }}>{detailFor}</div>
                <button onClick={closeDetail} title={T2('Close')}
                  style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', color: C.muted, border: '1px solid ' + C.border, fontSize: 14, lineHeight: 1, cursor: 'pointer', padding: 0, flexShrink: 0 }}>✕</button>
              </div>

              {/* Hindi */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{T2('Hindi name')}</label>
                <input type="text" value={detailHindiBuf} onChange={function(e) { setDetailHindiBuf(e.target.value); }} onBlur={saveDetailHindi}
                  onKeyDown={function(e) { if (e.key === 'Enter') { e.target.blur(); } }}
                  placeholder={T2('हिंदी नाम')}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 13, background: C.bg, color: C.text, boxSizing: 'border-box', marginTop: 4 }} />
                {detailSaving === 'hindi' && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{T2('Saving…')}</div>}
              </div>

              {/* Category */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{T2('Category')}</label>
                <select value={detailCatBuf} onChange={function(e) { saveDetailCat(e.target.value); }} disabled={detailSaving === 'cat'}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, background: C.bg, color: C.text, boxSizing: 'border-box', marginTop: 4, cursor: 'pointer' }}>
                  <option value="">{T2('— pick a category —')}</option>
                  {cats.map(function(c) { return <option key={c.id} value={c.id}>{c.icon} {c.name}</option>; })}
                </select>
                {detailSaving === 'cat' && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{T2('Saving…')}</div>}
              </div>

              {/* SOP mapping */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{T2('SOP recipe')}</label>
                {!detailMapOpen ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, padding: '6px 10px', background: currentSop ? C.greenBg : C.amberBg, border: '1px solid ' + (currentSop ? C.greenBorder : C.amberBorder), borderRadius: 6 }}>
                    <span style={{ flex: 1, fontSize: 12, color: currentSop ? C.green : C.amber, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentSop || (row.explicitNone ? T2('No SOP') : T2('Not mapped'))}
                    </span>
                    <button onClick={function() { setDetailMapOpen(true); setDetailMapSearch(''); }}
                      style={{ padding: '3px 10px', fontSize: 10, background: C.surface, color: C.text, border: '1px solid ' + C.border, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                      {currentSop ? T2('Change') : T2('Map')}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 4, padding: 8, background: C.blueBg, border: '1px solid ' + C.blueBorder, borderRadius: 6 }}>
                    <input autoFocus type="text" value={detailMapSearch} onChange={function(e) { setDetailMapSearch(e.target.value); }} placeholder={T2('Search SOP recipes…')}
                      onKeyDown={function(e) { if (e.key === 'Escape') { setDetailMapOpen(false); setDetailMapSearch(''); } }}
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 11, background: C.surface, color: C.text, boxSizing: 'border-box', marginBottom: 6 }} />
                    <div style={{ maxHeight: 160, overflowY: 'auto', background: C.surface, border: '1px solid ' + C.borderLight, borderRadius: 6 }}>
                      {detailMapMatches.length === 0 && <div style={{ padding: 8, fontSize: 10, color: C.muted, textAlign: 'center' }}>{T2('No SOP recipes match')}</div>}
                      {detailMapMatches.map(function(r) {
                        var isCurrent = currentSop === r.n;
                        return (
                          <div key={r.n} onClick={detailSaving === 'sop' ? null : function() { saveDetailSop(r.n); }}
                            style={{ padding: '5px 8px', fontSize: 11, cursor: detailSaving === 'sop' ? 'wait' : 'pointer', borderBottom: '1px solid ' + C.borderLight, background: isCurrent ? C.greenBg : 'transparent', color: isCurrent ? C.green : C.text, fontWeight: isCurrent ? 600 : 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n}</span>
                            <span style={{ fontSize: 9, color: isCurrent ? C.green : C.muted, marginLeft: 8, flexShrink: 0 }}>{r.cat}{isCurrent ? ' · current' : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'space-between' }}>
                      <button onClick={function() { setDetailMapOpen(false); setDetailMapSearch(''); }} disabled={detailSaving === 'sop'}
                        style={{ padding: '4px 10px', fontSize: 10, background: 'transparent', border: '1px solid ' + C.border, borderRadius: 6, color: C.muted, cursor: 'pointer' }}>{T2('Cancel')}</button>
                      <button onClick={clearDetailSop} disabled={detailSaving === 'sop'}
                        style={{ padding: '4px 10px', fontSize: 10, background: 'transparent', border: '1px solid ' + C.border, borderRadius: 6, color: C.amber, cursor: 'pointer' }}>{T2('Mark as no SOP')}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Used in packages */}
              <div style={{ marginBottom: 14 }}>
                <div onClick={function() { if (usage.length) setDetailUsageOpen(!detailUsageOpen); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: usage.length > 0 ? 'pointer' : 'default' }}>
                  <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'inherit' }}>{T2('Used in')}</label>
                  <span style={{ fontSize: 11, color: usage.length ? C.text : C.faint, fontWeight: 600 }}>{usage.length} {usage.length === 1 ? T2('package') : T2('packages')}</span>
                  {usage.length > 0 && <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>{detailUsageOpen ? '▾' : '▸'}</span>}
                </div>
                {detailUsageOpen && usage.length > 0 && (
                  <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', fontSize: 11, color: C.text, lineHeight: 1.6 }}>
                    {usage.map(function(p) { return <li key={p}>{p}</li>; })}
                  </ul>
                )}
              </div>

              {/* Retire */}
              <div style={{ borderTop: '1px solid ' + C.borderLight, paddingTop: 10 }}>
                {row.is_active === false ? (
                  <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', textAlign: 'center' }}>{T2('This dish is retired. Use "Restore" on the library row.')}</div>
                ) : (
                  <button onClick={handleDeactivate} disabled={detailSaving === 'deact'}
                    style={{ width: '100%', padding: '7px 10px', fontSize: 12, background: 'transparent', color: C.amber, border: '1px solid ' + C.amberBorder, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                    {detailSaving === 'deact' ? T2('Retiring…') : T2('Retire dish')}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default DishLibrary;