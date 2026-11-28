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
  getSectionsForPackage, setPackageSections, getCatIdForDish,
  onDishDataChange
} from '../data/recipeData.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import { getCateringStoreItemsCached, opsSupabase } from '../lib/opsSupabase.js';
import { transliterateName } from '../utils/helpers.js';
import DishMappingModal from './DishMappingModal.jsx';
import { renameOverrideKeys, renameOutsourced, ktKeyFor, classifyKtMove, formatMergeWarnings } from '../lib/dishRenameOps.js';

// One grid template shared by the "All dishes" table's header and every
// row, so a column added to one can never silently drift out of alignment
// with the other: checkbox / dish (veg dot inline) / hindi / status (type +
// maps-to merged) / sections / used-in / kebab.
const DISH_TABLE_GRID_COLS = '28px 1.7fr 1.1fr 1.3fr 1.2fr 1.2fr 36px';

// ═══ V74 duplicate-finder helpers ══════════════════════════════════
// Normalize: lowercase, strip punctuation, collapse whitespace. Keeps
// Devanagari range so Hindi names normalize sensibly too.
function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Token-set key — same words in any order collapse to the same key
function tokenSetKey(s) {
  var n = normalizeName(s);
  if (!n) return '';
  return n.split(' ').filter(Boolean).sort().join(' ');
}

// Bounded Levenshtein (cheap enough for ~500 dishes bucketed by first letter)
function levenshtein(a, b) {
  if (a === b) return 0;
  var m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  var prev = new Array(n + 1);
  var curr = new Array(n + 1);
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    curr[0] = i;
    for (var jj = 1; jj <= n; jj++) {
      var cost = a.charCodeAt(i - 1) === b.charCodeAt(jj - 1) ? 0 : 1;
      curr[jj] = Math.min(curr[jj - 1] + 1, prev[jj] + 1, prev[jj - 1] + cost);
    }
    var tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n];
}

// Cluster candidates by four signals, highest confidence first.
// Each dish appears in AT MOST one cluster (first-hit wins).
// Input: enriched array with { dish_name, hindi, packages, type }
function findDuplicateClusters(dishes) {
  var clusters = [];
  var assigned = {}; // dish_name -> true

  // Signal 1 — exact after normalization (highest)
  var byNorm = {};
  dishes.forEach(function(d) {
    var k = normalizeName(d.dish_name);
    if (!k) return;
    (byNorm[k] = byNorm[k] || []).push(d);
  });
  Object.keys(byNorm).forEach(function(k) {
    if (byNorm[k].length < 2) return;
    clusters.push({ reason: 'Same after normalization', confidence: 'high', dishes: byNorm[k].slice() });
    byNorm[k].forEach(function(d) { assigned[d.dish_name] = true; });
  });

  // Signal 2 — same tokens, different order
  var byTok = {};
  dishes.forEach(function(d) {
    if (assigned[d.dish_name]) return;
    var k = tokenSetKey(d.dish_name);
    if (!k) return;
    (byTok[k] = byTok[k] || []).push(d);
  });
  Object.keys(byTok).forEach(function(k) {
    if (byTok[k].length < 2) return;
    clusters.push({ reason: 'Same words, reordered', confidence: 'high', dishes: byTok[k].slice() });
    byTok[k].forEach(function(d) { assigned[d.dish_name] = true; });
  });

  // Signal 3 — same Hindi (non-empty, case-insensitive)
  var byHi = {};
  dishes.forEach(function(d) {
    if (assigned[d.dish_name]) return;
    var h = String(d.hindi || '').trim().toLowerCase();
    if (!h) return;
    (byHi[h] = byHi[h] || []).push(d);
  });
  Object.keys(byHi).forEach(function(h) {
    if (byHi[h].length < 2) return;
    clusters.push({ reason: 'Same Hindi (' + byHi[h][0].hindi + ')', confidence: 'high', dishes: byHi[h].slice() });
    byHi[h].forEach(function(d) { assigned[d.dish_name] = true; });
  });

  // Signal 4 — edit distance ≤ 2, bucketed by first letter (medium)
  var byFirst = {};
  dishes.forEach(function(d) {
    if (assigned[d.dish_name]) return;
    var n = normalizeName(d.dish_name);
    if (!n) return;
    var f = n[0];
    (byFirst[f] = byFirst[f] || []).push({ orig: d, norm: n });
  });
  Object.keys(byFirst).forEach(function(f) {
    var bucket = byFirst[f];
    for (var i = 0; i < bucket.length; i++) {
      if (assigned[bucket[i].orig.dish_name]) continue;
      var group = [bucket[i].orig];
      for (var j = i + 1; j < bucket.length; j++) {
        if (assigned[bucket[j].orig.dish_name]) continue;
        if (Math.abs(bucket[i].norm.length - bucket[j].norm.length) > 2) continue;
        var dist = levenshtein(bucket[i].norm, bucket[j].norm);
        if (dist > 0 && dist <= 2) group.push(bucket[j].orig);
      }
      if (group.length >= 2) {
        clusters.push({ reason: '1–2 letters apart', confidence: 'medium', dishes: group });
        group.forEach(function(d) { assigned[d.dish_name] = true; });
      }
    }
  });

  return clusters;
}

// Default target = highest usage count, tie-broken alphabetically
function pickDefaultTarget(cluster) {
  var sorted = cluster.dishes.slice().sort(function(a, b) {
    var au = (a.packages || []).length;
    var bu = (b.packages || []).length;
    if (au !== bu) return bu - au;
    return a.dish_name.localeCompare(b.dish_name);
  });
  return sorted[0].dish_name;
}

// A merge that never resolved left the modal stuck on "Working…" forever with
// nothing in the console to explain why. Every merge step now logs when it
// starts/finishes and is capped at 15s — a step that's still pending past that
// throws a clear "which step, how long" error instead of hanging the UI.
function withStepTimeout(promise, label, ms) {
  var t = ms || 15000;
  var timer;
  console.log('[merge] ' + label + ' — starting');
  var t0 = Date.now();
  var timeoutP = new Promise(function(_, reject) {
    timer = setTimeout(function() { reject(new Error('Timed out after ' + t + 'ms: ' + label)); }, t);
  });
  return Promise.race([promise, timeoutP]).then(
    function(v) { clearTimeout(timer); console.log('[merge] ' + label + ' — done in ' + (Date.now() - t0) + 'ms'); return v; },
    function(e) { clearTimeout(timer); console.error('[merge] ' + label + ' — FAILED after ' + (Date.now() - t0) + 'ms:', e); throw e; }
  );
}
// ═══════════════════════════════════════════════════════════════════

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
  // Which row's "⋯" quick-actions menu is open (dish name, or '') — the
  // table's merged-Status redesign (V98) replaces the old always-empty
  // trailing column with this.
  var [rowMenuFor, setRowMenuFor] = useState('');

  // Add new dish
  var [creating, setCreating] = useState(false);

  // Merge / Rename modal state
  var [mergeOpen, setMergeOpen]       = useState(false);
  var [mergeTarget, setMergeTarget]   = useState('');
  var [mergeSaving, setMergeSaving]   = useState(false);

  // V74 duplicate-finder modal state
  // dedupTargets/dedupSkipped/dedupResolved are keyed by a stable cluster
  // identity (clusterKey — the sorted dish names in it), not by array index.
  // findDuplicateClusters() re-runs from scratch every time the modal opens,
  // and a cluster resolved or skipped earlier can land at a different index
  // on the next run (a merge removes entries, shifting everything after it) —
  // index-keyed skip/resolved state would then silently apply to whatever
  // cluster happened to land on that same index instead. A content-based key
  // stays correct regardless of reordering, and (just as importantly) survives
  // the modal being closed and reopened instead of being wiped on every open.
  //
  // Reopening the SAME still-mounted modal isn't the only way this resets,
  // though: MenuPackagesView only mounts <DishLibrary> while its own "library"
  // tab is active (`mainTab === "library" && <DishLibrary .../>`), so simply
  // switching to another tab and back already unmounts/remounts this whole
  // component, and a page reload (including the PWA's own "Update Now",
  // which calls location.reload()) does too — a plain useState does not
  // survive either. dedupSkipped/dedupResolved are persisted to localStorage
  // so a skip decision actually stays skipped across both.
  var DEDUP_LS_KEY = 'ambria_dedup_decisions';
  function loadDedupDecisions() {
    try {
      var raw = JSON.parse(localStorage.getItem(DEDUP_LS_KEY) || '{}');
      return { skipped: raw.skipped || {}, resolved: raw.resolved || {} };
    } catch (e) { return { skipped: {}, resolved: {} }; }
  }
  function saveDedupDecisions(skipped, resolved) {
    try { localStorage.setItem(DEDUP_LS_KEY, JSON.stringify({ skipped: skipped, resolved: resolved })); } catch (e) {}
  }
  var [dedupOpen, setDedupOpen]         = useState(false);
  var [dedupClusters, setDedupClusters] = useState([]);
  var [dedupTargets, setDedupTargets]   = useState({});   // { [clusterKey]: dish_name }
  var [dedupSkipped, setDedupSkipped]   = useState(function(){ return loadDedupDecisions().skipped; });     // { [clusterKey]: true }
  var [dedupResolved, setDedupResolved] = useState(function(){ return loadDedupDecisions().resolved; });    // { [clusterKey]: 'merged' }
  var [dedupSavingIdx, setDedupSavingIdx] = useState(null); // idx currently merging
  function clusterKey(c) { return (c.dishes || []).map(function(d){ return d.dish_name; }).slice().sort().join('|'); }
  useEffect(function(){ saveDedupDecisions(dedupSkipped, dedupResolved); }, [dedupSkipped, dedupResolved]);

  // Live-refresh the library whenever DISH_MASTER / RECIPE_DB / DISH_HINDI_MAP /
  // DISH_NAME_MAP / DISH_CAT_MAP / DISH_STORE_MAP change from anywhere — a
  // DishMappingModal save elsewhere in the app, a Supabase realtime row, or a
  // write that only called upsertDishMaster without bumping localBump itself.
  // recipeData.js fires onDishDataChange AFTER it has already patched its maps
  // in-place, so by the time this bump re-runs the enriched useMemo, getAllDishes
  // returns the fresh snapshot.
  useEffect(function() {
    return onDishDataChange(function() {
      setLocalBump(function(n) { return n + 1; });
    });
  }, []);

  // Section id -> name, for the "Sections" column below — this table only
  // needs the name, not the full catalogue-section row shape DishSectionsEditor
  // loads for itself (a separate subscription on the same table is the
  // established pattern here, same as every other screen-level channel).
  var [sectionNameById, setSectionNameById] = useState({});
  useEffect(function(){
    var cancelled = false;
    function load() {
      fetchAllRows(function(){ return supabase.from('dish_catalogue_sections').select('id, name'); }).then(function(rows){
        if (cancelled) return;
        var m = {};
        (rows || []).forEach(function(s){ m[s.id] = s.name; });
        setSectionNameById(m);
      });
    }
    load();
    if (!supabase) return function(){ cancelled = true; };
    var ch = supabase.channel('dish_library_section_names_' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_catalogue_sections' }, load)
      .subscribe();
    return function(){ cancelled = true; supabase.removeChannel(ch); };
  }, []);

  // ── Data ─────────────────────────────────────────────────────────
  var enriched = useMemo(function() {
    // Sections tab doesn't use any of this — skip the per-dish package/Hindi/store
    // lookups entirely while it's the active view instead of paying for the flat
    // list's data on every keystroke over there too.
    if (view !== 'library') return [];
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
        diet: d.diet || null,
        sections: (d.section_ids || []).map(function(id){ return sectionNameById[id]; }).filter(Boolean),
      };
    });
  }, [props.refreshKey, showRetired, localBump, view, sectionNameById]);

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
    var fetchRes = await withStepTimeout(
      supabase.from('menu_packages').select('name, dishes, sections').in('name', affected),
      'fetch ' + affected.length + ' affected package(s)'
    );
    if (fetchRes.error) throw fetchRes.error;
    var pkgRows = fetchRes.data || [];
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
    // Rewrite each affected package — independent rows, so fire all updates together
    // instead of one sequential round trip per package (a dish used across most of the
    // menu could mean 8-10+ packages, each paying its own network latency in turn).
    await withStepTimeout(Promise.all(pkgRows.map(function(row) {
      var newDishes = rewriteList(row.dishes || []);
      // Keep every other field a section (or subsection) carries — sales_dept,
      // catalogue_section_id, subsections itself — this used to rebuild each
      // section as only {id, name, sop_category, dishes}, silently dropping
      // everything else a package had configured (confirmed to have wiped
      // subsections and dept/catalogue links on 3 live packages on 2026-10-30).
      // Subsections get the same dish-name rewrite as the top-level list so a
      // renamed dish living only inside one doesn't get missed.
      var newSections = (row.sections || []).map(function(sec) {
        return {
          ...sec,
          dishes: rewriteList(sec.dishes || []),
          subsections: (sec.subsections || []).map(function(sub) {
            return { ...sub, dishes: rewriteList(sub.dishes || []) };
          }),
        };
      });
      return supabase.from('menu_packages').update({ dishes: newDishes, sections: newSections }).eq('name', row.name)
        .then(function(uRes) {
          if (uRes.error) throw uRes.error;
          // Sync in-memory
          MENU_PACKAGES[row.name] = newDishes;
          try { setPackageSections(row.name, newSections, newDishes); } catch(e) {}
        });
    })), 'rewrite ' + pkgRows.length + ' package(s)');
    // Clear localStorage caches so next hydration is fresh
    try {
      localStorage.removeItem('ambria_menu_packages');
      localStorage.removeItem('ambria_cfg_menu_packages');
    } catch(e) {}
    return { affected: pkgRows.length };
  }

  // ── Bookings cascade helper ───────────────────────────────────────
  // A merge used to only rewrite the shared catalogue (dishes_master,
  // menu_packages) — every ALREADY-BOOKED function's own selected dishes
  // (event_items/proposal_items) kept the old, typo'd name forever, since
  // those rows are a per-event snapshot, not a live read of the catalogue.
  // The Function Plan print view reads event_items directly (not the
  // catalogue), so a merged-away dish name kept showing up there — on a
  // LOCKED FP too, since locking only gates the menu-builder's own write
  // handlers, never this table-level rename, which is a deliberate separate
  // correction path (fixing what a dish IS named, not changing the menu).
  // renameMap: { sourceName: targetName }. Returns { renamed, merged } counts.
  async function applyRenameToBookings(renameMap) {
    var sources = Object.keys(renameMap);
    if (sources.length === 0) return { renamed: 0, merged: 0 };
    var target = renameMap[sources[0]]; // performMergeCore only ever maps every source to the one same target
    var renamed = 0, merged = 0;
    var srcs = sources.filter(function(s){ return s !== target; }); // defensive; every caller already excludes the target
    var warnings = [];
    var overridesMoved = 0, outsourcedMoved = 0, ktMoved = 0;
    // Which events already had the TARGET dish selected before this merge —
    // needed below to decide whether the target's in-house/outsourced status
    // should win over a source's outsourced tag, same precedent as event_items'
    // own hasTarget. Must be taken before the loop below renames any source
    // rows to the target, or this snapshot would already see the merged state.
    var preTargetEvents = {};
    var preTargetRows = await withStepTimeout(
      fetchAllRows(function(){ return supabase.from('event_items').select('event_id').eq('dish_name', target).order('event_id'); }),
      'snapshot events already selecting "' + target + '"'
    );
    (preTargetRows || []).forEach(function(r){ preTargetEvents[r.event_id] = true; });

    // Matched by (fk, dish_name) rather than a surrogate id — proposal_items
    // has no `id` column at all (its primary key is proposal_id+dish_name),
    // which made every rename/merge throw here with "column proposal_items.id
    // does not exist" AFTER applyRenameToPackages had already written (confirmed
    // 2026-10-30: the thrown error aborted the merge, but the packages rewrite
    // a few lines above had already committed — see its own fix note above).
    var tables = [
      { name: 'event_items', fk: 'event_id' },
      { name: 'proposal_items', fk: 'proposal_id' },
    ];
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i].name, fk = tables[i].fk;
      var rowsRes = await withStepTimeout(
        supabase.from(table).select(fk + ', dish_name').in('dish_name', sources),
        'find ' + table + ' rows naming ' + sources.join(', ')
      );
      if (rowsRes.error) throw rowsRes.error;
      var rows = rowsRes.data || [];
      if (rows.length === 0) continue;
      var parentIds = Array.from(new Set(rows.map(function(r) { return r[fk]; })));
      // A parent (event/proposal) that ALREADY has the target dish selected
      // can't also get a renamed row — event_id/proposal_id + dish_name is
      // unique — so that source row is dropped instead of renamed; it was a
      // redundant duplicate selection of the same dish under two names.
      var existingRes = await withStepTimeout(
        supabase.from(table).select(fk).eq('dish_name', target).in(fk, parentIds),
        'check existing "' + target + '" rows in ' + table
      );
      if (existingRes.error) throw existingRes.error;
      var hasTarget = {};
      (existingRes.data || []).forEach(function(r) { hasTarget[r[fk]] = true; });
      // Grouped by source dish_name so each delete/update can be one batched
      // `.in(fk, [...])` call instead of a round trip per row.
      var toDeleteByName = {}, toRenameByName = {};
      rows.forEach(function(r) {
        var bucket = hasTarget[r[fk]] ? toDeleteByName : toRenameByName;
        (bucket[r.dish_name] = bucket[r.dish_name] || []).push(r[fk]);
      });
      var names;
      names = Object.keys(toDeleteByName);
      for (var j = 0; j < names.length; j++) {
        var delR = await withStepTimeout(
          supabase.from(table).delete().eq('dish_name', names[j]).in(fk, toDeleteByName[names[j]]),
          'drop ' + toDeleteByName[names[j]].length + ' duplicate ' + table + ' row(s)'
        );
        if (delR.error) throw delR.error;
        merged += toDeleteByName[names[j]].length;
      }
      names = Object.keys(toRenameByName);
      for (var k = 0; k < names.length; k++) {
        var renR = await withStepTimeout(
          supabase.from(table).update({ dish_name: target }).eq('dish_name', names[k]).in(fk, toRenameByName[names[k]]),
          'rename ' + toRenameByName[names[k]].length + ' ' + table + ' row(s)'
        );
        if (renR.error) throw renR.error;
        renamed += toRenameByName[names[k]].length;
      }
    }

    // events.menu — the Kitchen-only mirror array. Events with event_items
    // already initialized self-heal this from event_items on next app load
    // (see src/lib/eventItems.js), but an event not yet migrated to
    // event_items stores its kitchen list as this plain array directly, so
    // it needs its own rename pass too.
    var sourceSet = {};
    sources.forEach(function(s) { sourceSet[s] = true; });
    var evRows = await fetchAllRows(function() {
      return supabase.from('events').select('id, menu').not('menu', 'is', null);
    });
    var evUpdates = [];
    (evRows || []).forEach(function(ev) {
      // Captured here too (not just from event_items above) since an event
      // not yet migrated to event_items stores its kitchen dish list ONLY
      // as this array — evRows is read before this block rewrites anything.
      if (Array.isArray(ev.menu) && ev.menu.indexOf(target) !== -1) preTargetEvents[ev.id] = true;
      if (!Array.isArray(ev.menu) || ev.menu.length === 0) return;
      if (!ev.menu.some(function(n) { return sourceSet[n]; })) return;
      var seen = {};
      var nextMenu = [];
      ev.menu.forEach(function(n) {
        var nm = sourceSet[n] ? target : n;
        if (seen[nm]) return;
        seen[nm] = true;
        nextMenu.push(nm);
      });
      evUpdates.push({ id: ev.id, menu: nextMenu });
    });
    if (evUpdates.length > 0) {
      var evRes = await withStepTimeout(
        Promise.all(evUpdates.map(function(u) { return supabase.from('events').update({ menu: u.menu }).eq('id', u.id); })),
        'rename in ' + evUpdates.length + ' events.menu array(s)'
      );
      evRes.forEach(function(r) { if (r.error) throw r.error; });
    }

    // ── Step C: kitchen_tracking — runs right after events.menu, BEFORE
    // Steps A/B below. See MEMORY.md for the full reasoning: a chef's tap
    // landing in the short window between "menu now shows the target name"
    // and "progress moved" is safer to happen AFTER this step (it just gets
    // reported as a conflict, nothing lost) than before it (it would
    // silently recreate a source row that nothing else will ever look at
    // again) — so this must run as soon as possible after events.menu
    // actually changes what Kitchen shows, not after Steps A/B's unrelated
    // (and potentially slow, on a large catalogue) events/proposals scans,
    // which only widen that window for no benefit (an adversarial review
    // caught this — Steps A/B don't affect what Kitchen displays at all).
    for (var si = 0; si < srcs.length; si++) {
      var src = srcs[si];
      // Guard against a name that would collide with this table's own
      // special key shapes (a legacy position-based dish_key is just
      // "<evId>|<digits>", with no way to tell it apart from a real dish
      // named entirely in digits; a literal backslash would break the LIKE
      // escaping below). Flag for manual review rather than risk either.
      if (/^\d+$/.test(src) || /^\d+$/.test(target) || src.indexOf('\\') !== -1) {
        warnings.push({ kind: 'kt-skipped-name', name: src });
        continue;
      }
      var perEventRows = (await withStepTimeout(
        fetchAllRows(function(){ return supabase.from('kitchen_tracking').select('ev_id, dish_key, data, key_ts, client_write_ts').like('dish_key', '%|' + src).order('ev_id'); }),
        'find per-event kitchen_tracking rows for "' + src + '"'
      )).filter(function(r){ return r.dish_key === r.ev_id + '|' + src && r.ev_id.indexOf('__combined_') !== 0; });
      var combinedRows = (await withStepTimeout(
        fetchAllRows(function(){ return supabase.from('kitchen_tracking').select('ev_id, dish_key, data, key_ts, client_write_ts').eq('dish_key', 'dish|' + src); }),
        'find combined-bucket kitchen_tracking rows for "' + src + '"'
      )).filter(function(r){ return r.ev_id.indexOf('__combined_') === 0; });
      var srcRows = perEventRows.concat(combinedRows);
      if (srcRows.length === 0) continue;
      // Fetch any rows already at the target key, chunked so the .in() url
      // stays a sane length on a large merge. The .in().in() below filters
      // the cross product of these two lists, which CAN return extra rows
      // beyond the exact (ev_id, dish_key) pairs intended — but every
      // lookup below is keyed by a row's own real (ev_id, dish_key), never
      // by an assumed pairing from this chunk, so an extra row just goes
      // unused rather than ever causing a wrong match (verified by
      // adversarial review — do not "optimize" this into per-pair queries
      // without re-confirming that reasoning still holds).
      var toKeys = srcRows.map(function(r){ return ktKeyFor(r.ev_id, target); });
      var tgtByKey = {};
      for (var ci = 0; ci < toKeys.length; ci += 50) {
        var chunkEvIds = srcRows.slice(ci, ci + 50).map(function(r){ return r.ev_id; });
        var chunkKeys = toKeys.slice(ci, ci + 50);
        var tRes = await withStepTimeout(
          supabase.from('kitchen_tracking').select('ev_id, dish_key, data, key_ts').in('ev_id', chunkEvIds).in('dish_key', chunkKeys),
          'fetch existing target kitchen_tracking rows (chunk ' + (ci / 50 + 1) + ')'
        );
        if (tRes.error) throw tRes.error;
        (tRes.data || []).forEach(function(r){ tgtByKey[r.ev_id + '\u0000' + r.dish_key] = r; });
      }
      for (var ri = 0; ri < srcRows.length; ri++) {
        var srcRow = srcRows[ri];
        var toKey = ktKeyFor(srcRow.ev_id, target);
        var tgtRow = tgtByKey[srcRow.ev_id + '\u0000' + toKey] || null;
        var verdict = classifyKtMove(srcRow, tgtRow);
        if (verdict === 'conflict') {
          warnings.push({ kind: 'kt-conflict', ev_id: srcRow.ev_id, fromKey: srcRow.dish_key, toKey: toKey });
          continue;
        }
        await withStepTimeout((async function(){
          if (verdict === 'move') {
            // Never copy client_id from the source — the tablet that wrote
            // it would treat a copy bearing its own id as its own echo and
            // ignore the realtime INSERT, so it would never see its own
            // dish's progress show up under the new name.
            var ins = await supabase.from('kitchen_tracking').insert({
              ev_id: srcRow.ev_id, dish_key: toKey, data: srcRow.data || {},
              key_ts: srcRow.key_ts || {}, client_id: 'dish-merge', client_write_ts: srcRow.client_write_ts,
            });
            if (ins.error) {
              if (ins.error.code === '23505') { warnings.push({ kind: 'kt-conflict-race', ev_id: srcRow.ev_id, fromKey: srcRow.dish_key, toKey: toKey }); return; }
              throw ins.error;
            }
          }
          // Guarded delete — if a chef's tap changed this exact row between
          // our read and now, client_write_ts won't match and nothing is
          // deleted; both copies are then kept rather than risking the loss
          // of a tap that landed in that window.
          var delQ = supabase.from('kitchen_tracking').delete().eq('ev_id', srcRow.ev_id).eq('dish_key', srcRow.dish_key);
          delQ = srcRow.client_write_ts == null ? delQ.is('client_write_ts', null) : delQ.eq('client_write_ts', srcRow.client_write_ts);
          var del = await delQ.select('ev_id');
          if (del.error) throw del.error;
          if ((del.data || []).length === 0) { warnings.push({ kind: 'kt-source-changed', ev_id: srcRow.ev_id, fromKey: srcRow.dish_key }); return; }
          ktMoved++;
        })(), 'move kitchen_tracking ' + srcRow.ev_id + ' ' + src + '→' + target);
      }
    }

    // ── Step A: events.menu_section_overrides + events.outsourced_dishes ──
    // Neither is touched by anything above — a renamed dish's per-event
    // section tag and outsourced flag were being silently orphaned under the
    // old name forever. Scanned unfiltered (same as the events.menu scan
    // above) since both are JSONB and can't be queried by key/element via
    // .in(). events.menu is deliberately NOT re-selected or re-written here
    // (it's a TOAST-risk column for realtime — see MEMORY.md).
    var evMeta = await withStepTimeout(
      fetchAllRows(function(){ return supabase.from('events').select('id, menu_section_overrides, outsourced_dishes').order('id'); }),
      'scan events for section tags / outsourced flags'
    );
    var evCand = (evMeta || []).filter(function(e){
      var o = e.menu_section_overrides || {};
      var a = Array.isArray(e.outsourced_dishes) ? e.outsourced_dishes : [];
      return srcs.some(function(s){ return Object.prototype.hasOwnProperty.call(o, s) || a.indexOf(s) !== -1; });
    });
    if (evCand.length > 0) {
      var evTagRes = await withStepTimeout(
        Promise.all(evCand.map(async function(cand){
          // Re-read immediately before writing — same read-modify-write
          // discipline as menuItemOps.js's mergeOverridesForWrite, so this
          // doesn't clobber a concurrent edit to either column.
          var fresh = await supabase.from('events').select('id, menu_section_overrides, outsourced_dishes').eq('id', cand.id).single();
          if (fresh.error) throw fresh.error;
          var ov = renameOverrideKeys(fresh.data.menu_section_overrides || {}, srcs, target);
          var os = renameOutsourced(fresh.data.outsourced_dishes, srcs, target, !!preTargetEvents[cand.id]);
          if (ov.warning) warnings.push(Object.assign({ table: 'events', id: cand.id }, ov.warning));
          if (os.warning) warnings.push(Object.assign({ id: cand.id }, os.warning));
          if (!ov.changed && !os.changed) return null;
          var patch = {};
          if (ov.changed) { patch.menu_section_overrides = ov.next; overridesMoved++; }
          if (os.changed) { patch.outsourced_dishes = os.next; outsourcedMoved++; }
          var w = await supabase.from('events').update(patch).eq('id', cand.id);
          if (w.error) throw w.error;
          return null;
        })),
        'rewrite tags/outsourced on ' + evCand.length + ' event(s)',
        30000
      );
      void evTagRes;
    }

    // ── Step B: proposals.menu_section_overrides ── same idea, no outsourced column on proposals.
    var propMeta = await withStepTimeout(
      fetchAllRows(function(){ return supabase.from('proposals').select('id, menu_section_overrides').order('id'); }),
      'scan proposals for section tags'
    );
    var propCand = (propMeta || []).filter(function(p){
      var o = p.menu_section_overrides || {};
      return srcs.some(function(s){ return Object.prototype.hasOwnProperty.call(o, s); });
    });
    if (propCand.length > 0) {
      await withStepTimeout(
        Promise.all(propCand.map(async function(cand){
          var fresh = await supabase.from('proposals').select('id, menu_section_overrides').eq('id', cand.id).single();
          if (fresh.error) throw fresh.error;
          var ov = renameOverrideKeys(fresh.data.menu_section_overrides || {}, srcs, target);
          if (ov.warning) warnings.push(Object.assign({ table: 'proposals', id: cand.id }, ov.warning));
          if (!ov.changed) return null;
          overridesMoved++;
          var w = await supabase.from('proposals').update({ menu_section_overrides: ov.next }).eq('id', cand.id);
          if (w.error) throw w.error;
          return null;
        })),
        'rewrite tags on ' + propCand.length + ' proposal(s)',
        30000
      );
    }

    return { renamed: renamed, merged: merged, overridesMoved: overridesMoved, outsourcedMoved: outsourcedMoved, ktMoved: ktMoved, warnings: warnings };
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
  // Core merge — reused by both confirmMerge (bulk-toolbar path) and the V74
  // dedup modal path. Does NOT prompt or alert — callers handle UX.
  // Returns { affected } (# of packages updated).
  async function performMergeCore(sources, target) {
    // 1. Ensure target row exists in dishes_master
    var insRes = await withStepTimeout(
      supabase.from('dishes_master').upsert({ dish_name: target, is_active: true }, { onConflict: 'dish_name', ignoreDuplicates: true }),
      'upsert target "' + target + '" in dishes_master'
    );
    if (insRes.error && insRes.error.code !== '23505') throw insRes.error;
    upsertDishMaster(target, { is_active: true });
    // 2. Delete source rows from side tables — 4 independent tables, fire together
    // instead of paying 4 sequential round trips for one merge.
    if (sources.length > 0) {
      var delResults = await withStepTimeout(
        Promise.all([
          supabase.from('dish_categories').delete().in('dish_name', sources),
          supabase.from('dish_hindi_map').delete().in('dish_name', sources),
          supabase.from('dish_store_map').delete().in('dish_name', sources),
          supabase.from('dish_name_map').delete().in('lms_name', sources),
        ]),
        'delete ' + sources.length + ' source dish(es) from side tables'
      );
      delResults.forEach(function(r) { if (r.error) throw r.error; });
      sources.forEach(function(s) {
        upsertDishHindi(s, '');
        upsertDishStoreMap(s, null);
        if (DISH_NAME_MAP[s]) delete DISH_NAME_MAP[s];
      });
      // 2b. Carry over every source dish's catalogue section membership(s)
      // to the target name (additive — ignoreDuplicates skips a section the
      // target is already in), then drop the sources' own rows. Without
      // this, a merged-away dish's dish_section_links rows would just sit
      // there pointing at a dish_name that no longer exists in
      // dishes_master, and the target would silently lose whatever
      // sections only the SOURCE had been tagged to.
      var sourceLinks = await withStepTimeout(
        supabase.from('dish_section_links').select('dish_name, section_id, sort_order').in('dish_name', sources),
        'load ' + sources.length + ' source dish(es)\' section memberships'
      );
      if (sourceLinks.error) throw sourceLinks.error;
      if (sourceLinks.data && sourceLinks.data.length > 0) {
        var carryResults = await withStepTimeout(
          Promise.all(sourceLinks.data.map(function(r) {
            return supabase.from('dish_section_links')
              .upsert({ dish_name: target, section_id: r.section_id, sort_order: r.sort_order }, { onConflict: 'dish_name,section_id', ignoreDuplicates: true });
          })),
          'carry over section memberships to "' + target + '"'
        );
        carryResults.forEach(function(r) { if (r.error) throw r.error; });
      }
      var delLinks = await withStepTimeout(
        supabase.from('dish_section_links').delete().in('dish_name', sources),
        'delete source dish(es)\' own section memberships'
      );
      if (delLinks.error) throw delLinks.error;
    }
    // 3. Rewrite menu_packages
    var renameMap = {};
    sources.forEach(function(s) { renameMap[s] = target; });
    var applyRes = await applyRenameToPackages(renameMap);
    var affected = applyRes.affected;
    // 3b. Rewrite already-booked functions/proposals that selected a source
    // name — otherwise the catalogue is fixed but every existing booking
    // (and its FP) keeps showing the typo forever.
    var bookingsRes = await applyRenameToBookings(renameMap);
    // 4. Delete source rows from dishes_master (last, so packages already rewritten)
    if (sources.length > 0) {
      var delMst = await withStepTimeout(
        supabase.from('dishes_master').delete().in('dish_name', sources),
        'delete ' + sources.length + ' source dish(es) from dishes_master'
      );
      if (delMst.error) throw delMst.error;
      sources.forEach(function(s) { deactivateDish(s); });
    }
    if (bookingsRes.warnings && bookingsRes.warnings.length > 0) {
      bookingsRes.warnings.forEach(function(w){ console.warn('[merge] REVIEW ' + w.kind, w); });
    }
    return {
      affected: affected, bookingsRenamed: bookingsRes.renamed, bookingsMerged: bookingsRes.merged,
      overridesMoved: bookingsRes.overridesMoved || 0, outsourcedMoved: bookingsRes.outsourcedMoved || 0,
      ktMoved: bookingsRes.ktMoved || 0, bookingsWarnings: bookingsRes.warnings || [],
    };
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
      '\n• ' + T2('Rename the merged name(s) on every already-booked function/proposal that selected them (even locked ones) — this is what the Function Plan actually prints') +
      '\n• ' + T2('Also move each one\'s section tag, outsourced flag, and kitchen tracking progress on every event/proposal — a genuinely conflicting case (both names had their own) is left alone and reported, never guessed') +
      '\n• ' + T2('Delete the merged dish(es) from the library and drop their Hindi / SOP / Inventory mappings') +
      '\n• ' + T2('Keep the target\'s own mappings unchanged');
    if (!window.confirm(verb + warn)) return;
    setMergeSaving(true);
    try {
      var result = await performMergeCore(sources, target);
      setSelected({});
      setMergeOpen(false);
      setMergeTarget('');
      setLocalBump(function(n) { return n + 1; });
      var bookingsNote = (result.bookingsRenamed || result.bookingsMerged)
        ? ' ' + result.bookingsRenamed + T2(' booked item(s) renamed') + (result.bookingsMerged ? ', ' + result.bookingsMerged + T2(' duplicate(s) dropped') : '') + '.'
        : '';
      var ktNote = result.ktMoved ? ' ' + result.ktMoved + T2(' kitchen tracking row(s) moved.') : '';
      var warnNote = (result.bookingsWarnings && result.bookingsWarnings.length > 0)
        ? '\n\n' + T2('⚠ Needs manual review:') + '\n' + formatMergeWarnings(result.bookingsWarnings)
        : '';
      alert((isRename ? T2('Renamed. ') + result.affected + T2(' package(s) updated.')
                     : T2('Merged ') + sources.length + T2(' dish(es) into "') + target + T2('". ') + result.affected + T2(' package(s) updated.')) + bookingsNote + ktNote + warnNote);
    } catch (e) {
      alert('Merge failed: ' + (e.message || e));
    } finally {
      setMergeSaving(false);
    }
  }

  // ── V74 Duplicate finder handlers ──────────────────────────────
  function openDedup() {
    if (!isAdmin) return;
    var clusters = findDuplicateClusters(enriched);
    setDedupTargets(function(prev) {
      var next = { ...prev };
      clusters.forEach(function(c) { var k = clusterKey(c); if (next[k] === undefined) next[k] = pickDefaultTarget(c); });
      return next;
    });
    setDedupClusters(clusters);
    // Skipped/resolved decisions are deliberately NOT reset here — they're
    // keyed by cluster content and should keep holding across reopens of
    // this same modal. resetDedupSkipped() is the one explicit way to bring
    // skipped groups back.
    setDedupOpen(true);
  }
  function closeDedup() {
    if (dedupSavingIdx != null) return;
    setDedupOpen(false);
  }
  function pickDedupTarget(key, name) {
    setDedupTargets(function(prev) { var next = { ...prev }; next[key] = name; return next; });
  }
  function skipDedupCluster(key) {
    setDedupSkipped(function(prev) { var next = { ...prev }; next[key] = true; return next; });
  }
  function resetDedupSkipped() {
    setDedupSkipped({});
  }
  async function mergeDedupCluster(idx) {
    if (!isAdmin) return;
    var cluster = dedupClusters[idx];
    if (!cluster) return;
    var key = clusterKey(cluster);
    var target = (dedupTargets[key] || '').trim();
    if (!target) { alert(T2('Pick a target for this group.')); return; }
    var sources = cluster.dishes.map(function(d) { return d.dish_name; }).filter(function(n) { return n !== target; });
    if (sources.length === 0) { alert(T2('Nothing to merge — target is the only dish.')); return; }
    setDedupSavingIdx(idx);
    try {
      var result = await performMergeCore(sources, target);
      setDedupResolved(function(prev) { var next = { ...prev }; next[key] = 'merged'; return next; });
      setLocalBump(function(n) { return n + 1; });
      if (result.bookingsWarnings && result.bookingsWarnings.length > 0) {
        alert(T2('Merged, but needs manual review:') + '\n' + formatMergeWarnings(result.bookingsWarnings));
      }
    } catch (e) {
      alert('Merge failed: ' + (e.message || e));
    } finally {
      setDedupSavingIdx(null);
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

  // Single-dish counterpart to bulkDeleteUnused's write, for the row kebab's
  // quick "Deactivate" — the detail modal has its own, separate deactivate
  // control; this is a shortcut, not a replacement for it.
  async function handleDeactivate(name) {
    if (!isAdmin) return;
    if (!window.confirm(T2('Retire "') + name + T2('"?'))) return;
    try {
      var res = await supabase.from('dishes_master').update({ is_active: false }).eq('dish_name', name);
      if (res.error) throw res.error;
      deactivateDish(name);
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Retire failed: ' + e.message); }
  }

  // V74/V90/V97: veg/non-veg/egg classification — null (unclassified) → veg
  // → non-veg → egg → back to null. Same 4-state cycle as DishSectionsEditor's
  // toggle, exposed here too since this "All dishes" table is where most
  // dishes actually get looked at.
  async function cycleDishVeg(name, current) {
    if (!isAdmin) return;
    var next = current == null ? 'veg' : current === 'veg' ? 'nonveg' : current === 'nonveg' ? 'egg' : null;
    try {
      var res = await supabase.from('dishes_master').update({ diet: next }).eq('dish_name', name);
      if (res.error) throw res.error;
      upsertDishMaster(name, { diet: next });
      setLocalBump(function(n) { return n + 1; });
    } catch (e) { alert('Could not update veg/non-veg: ' + e.message); }
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
        <DishSectionsEditor lang={lang} currentUser={currentUser} onMergeDishes={performMergeCore} />
      )}

      {view === 'library' && <>

      {/* Toolbar area — stays in normal flow. The TABLE below is the only piece that scrolls, so the summary tiles, filter chips, search bar and bulk-action bar always stay reachable without any sticky trickery. */}
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
          <button onClick={openDedup}
            title={T2('Auto-cluster likely duplicate dishes so you can merge them one group at a time')}
            style={{ padding: '6px 12px', borderRadius: 6, background: C.surface, border: '1px solid ' + C.wine, color: C.wine, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🔍 {T2('Find duplicates')}
          </button>
        )}
        {isAdmin && (
          <button onClick={handleCreate} disabled={creating}
            style={{ padding: '6px 12px', borderRadius: 6, background: C.wine, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: creating ? 'wait' : 'pointer' }}>+ {T2('New dish')}</button>
        )}
      </div>

      {/* BULK ACTION BAR — rides along with the sticky toolbar wrapper above */}
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

      </div>
      {/* /sticky toolbar wrapper */}

      {/* TABLE — outer bounds the table's height to whatever viewport space is left below the toolbar, then the inner rows list does its own vertical scroll. The column header and the "Showing 500 of …" footer stay pinned around it. 320px ≈ toolbar + tabs + shellscroll padding on a standard desktop; using maxHeight (not height) means the table still shrinks naturally when there are only a handful of rows, so nothing looks oddly tall on a filtered list. */}
      {/* DISH_TABLE_GRID_COLS — kept as one constant, not retyped per row, so the header and every row can never drift out of column alignment. */}
      <div style={{ border: '1px solid ' + C.border, borderRadius: 10, overflow: 'hidden', background: C.surface, fontSize: 12, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 320px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: DISH_TABLE_GRID_COLS, gap: 8, padding: '9px 12px', background: C.bg, color: C.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: '1px solid ' + C.border, flexShrink: 0 }}>
          <div>
            <input type="checkbox" checked={allFilteredSelected} onChange={selectAllFiltered}
              style={{ cursor: 'pointer', margin: 0 }} />
          </div>
          <div>{T2('Dish')}</div>
          <div>{T2('Hindi')}</div>
          <div>{T2('Status')}</div>
          <div>{T2('Sections')}</div>
          <div>{T2('Used in')}</div>
          <div></div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>

        {filtered.length === 0 && (
          <div style={{ padding: '30px 12px', textAlign: 'center', color: C.muted, fontSize: 12 }}>
            {q ? T2('No matches.') : T2('No dishes match the current filter.')}
          </div>
        )}

        {filtered.slice(0, 500).map(function(d) {
          var isSel = !!selected[d.dish_name];
          // The SOP SECTION this dish is mapped to (its recipe category,
          // e.g. "Pan Asian Snacks", "Beverages" — the same taxonomy the
          // Print Menu now groups by) — not the exact recipe name it
          // happened to resolve against, which used to show here instead
          // and read as a confusing near-duplicate of the dish's own name.
          var mapText = d.type === 'inv' && d.store
            ? (d.store.ops_item_name + ' · ' + (d.store.qty_per_cover || 1) + ' ' + (d.store.ops_item_unit || '') + '/pax')
            : d.type === 'sop'
              ? (d.catName || 'SOP')
              : d.type === 'nosop'
                ? T2('(no SOP set)')
                : T2('unmapped');
          var mapColor = d.type === 'inv' ? '#0F6E56' : d.type === 'unmapped' ? C.red : C.muted;
          // dishes_master.diet's check constraint also allows 'jain' (set
          // only from the separate Sales Catalogue screen, never from this
          // veg/non-veg/egg cycle) — give it a real color/label instead of
          // rendering as an invisible dot that reads "Unclassified".
          var dietColor = d.diet === 'veg' ? C.green : d.diet === 'nonveg' ? C.red : d.diet === 'egg' ? C.egg : (d.diet ? C.muted : null);
          var dietLabel = d.diet === 'veg' ? T2('Veg') : d.diet === 'nonveg' ? T2('Non-veg') : d.diet === 'egg' ? T2('Egg') : (d.diet || T2('Unclassified'));
          var dietNext = d.diet === 'veg' ? T2('non-veg') : d.diet === 'nonveg' ? T2('egg') : d.diet ? T2('clear') : T2('veg');
          return (
            <div key={d.dish_name}
              style={{
                display: 'grid', gridTemplateColumns: DISH_TABLE_GRID_COLS, gap: 8, padding: '9px 12px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span onClick={function(e) { e.stopPropagation(); cycleDishVeg(d.dish_name, d.diet); }}
                  title={!isAdmin ? dietLabel : (dietLabel + ' — click to mark ' + dietNext)}
                  style={{ cursor: isAdmin ? 'pointer' : 'default', flexShrink: 0, display: 'inline-flex' }}>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                    background: dietColor || 'transparent',
                    border: d.diet == null ? '1.5px solid ' + C.border : 'none',
                  }} />
                </span>
                <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.dish_name}
                  {!d.is_active && <span style={{ marginLeft: 6, fontSize: 10, color: C.muted, fontStyle: 'italic' }}>({T2('retired')})</span>}
                </span>
              </div>
              <div style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.hindi || '—'}</div>
              <div>
                <div>{typeBadge(d.type)}</div>
                {(d.type === 'sop' || d.type === 'inv') && (
                  <div style={{ color: mapColor, fontSize: 10.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mapText}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {d.sections.length === 0 && <span style={{ fontSize: 10, color: C.faint, fontStyle: 'italic' }}>{T2('unassigned')}</span>}
                {d.sections.slice(0, 2).map(function(s) {
                  return <span key={s} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: C.wineBg, color: C.wine, border: '1px solid ' + C.wineBorder, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110, whiteSpace: 'nowrap' }}>{s}</span>;
                })}
                {d.sections.length > 2 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: C.wineBg, color: C.wine }}>+{d.sections.length - 2}</span>}
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {d.packages.length === 0 && <span style={{ fontSize: 10, color: C.faint, fontStyle: 'italic' }}>{T2('unused')}</span>}
                {d.packages.slice(0, 2).map(function(p) {
                  return <span key={p} className="dish-pill" onClick={function(e) { e.stopPropagation(); onJumpToPackage(p); }}
                    style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: C.bg, color: C.text, cursor: 'pointer', border: '1px solid ' + C.borderLight }}>{p}</span>;
                })}
                {d.packages.length > 2 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: C.bg, color: C.muted }}>+{d.packages.length - 2}</span>}
              </div>
              {isAdmin ? (function(){
                var menuItemStyle = { display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'left', background: 'transparent', border: 0, borderTop: '0.5px solid ' + C.borderLight, cursor: 'pointer', padding: '8px 12px', fontSize: 12, color: C.text };
                var open = rowMenuFor === d.dish_name;
                return (
                  <div style={{ position: 'relative' }}>
                    <button onClick={function(e) { e.stopPropagation(); setRowMenuFor(open ? '' : d.dish_name); }}
                      title={T2('More actions')}
                      style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: '3px 6px', fontSize: 15, color: C.muted, borderRadius: 5, lineHeight: 1 }}>⋯</button>
                    {open && (
                      <>
                        <div onClick={function(e) { e.stopPropagation(); setRowMenuFor(''); }} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                        <div onClick={function(e) { e.stopPropagation(); }}
                          style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 999, background: C.surface, border: '1px solid ' + C.border, borderRadius: 9, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', minWidth: 170, overflow: 'hidden' }}>
                          <button onClick={function() { setRowMenuFor(''); setDetailFor(d.dish_name); }} style={{ ...menuItemStyle, borderTop: 0 }}>✎ {T2('Edit mapping')}</button>
                          {d.is_active
                            ? <button onClick={function() { setRowMenuFor(''); handleDeactivate(d.dish_name); }} style={{ ...menuItemStyle, color: C.red }}>🗑 {T2('Deactivate')}</button>
                            : <button onClick={function() { setRowMenuFor(''); handleRestore(d.dish_name); }} style={{ ...menuItemStyle, color: C.green }}>↺ {T2('Restore')}</button>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })() : <div></div>}
            </div>
          );
        })}
        </div>
        {/* /scrollable rows */}

        {filtered.length > 500 && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid ' + C.borderLight, textAlign: 'center', color: C.faint, fontSize: 11, flexShrink: 0 }}>
            {T2('Showing 500 of ')}{filtered.length}{T2('. Refine the filter or search to see more.')}
          </div>
        )}
      </div>

      {/* MERGE / RENAME MODAL */}
      {/* V74 — Duplicate finder modal */}
      {dedupOpen && (function(){
        var totalGroups = dedupClusters.length;
        // Scoped to the clusters THIS run actually found — dedupResolved/
        // dedupSkipped persist across reopens by design, so a stale entry
        // for a cluster that no longer exists (its dishes got merged away,
        // or the underlying data changed) must not inflate these counts.
        var resolvedCount = dedupClusters.filter(function(c){ return !!dedupResolved[clusterKey(c)]; }).length;
        var skippedCount = dedupClusters.filter(function(c){ return !!dedupSkipped[clusterKey(c)]; }).length;
        var remainingIdx = dedupClusters.map(function(_, i){ return i; })
          .filter(function(i){ var k = clusterKey(dedupClusters[i]); return !dedupResolved[k] && !dedupSkipped[k]; });
        var highIdx = remainingIdx.filter(function(i){ return dedupClusters[i].confidence === 'high'; });
        var medIdx  = remainingIdx.filter(function(i){ return dedupClusters[i].confidence === 'medium'; });
        var allDone = totalGroups > 0 && remainingIdx.length === 0;
        var nothingFound = totalGroups === 0;

        function renderCard(idx){
          var c = dedupClusters[idx];
          var key = clusterKey(c);
          var target = dedupTargets[key] || '';
          var saving = dedupSavingIdx === idx;
          var disabled = dedupSavingIdx != null && !saving;
          return (
            <div key={idx} style={{ border: '1px solid ' + C.border, borderRadius: 8, padding: 12, marginBottom: 10, background: C.bg }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                {c.reason}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {c.dishes.slice().sort(function(a,b){ return (b.packages||[]).length - (a.packages||[]).length; }).map(function(d){
                  var isT = d.dish_name === target;
                  var uses = (d.packages || []).length;
                  var typeBadgeBg = d.type === 'inv' ? '#E1F5EE' : d.type === 'sop' ? '#EAF3DE' : d.type === 'nosop' ? C.bg : C.redBg;
                  var typeBadgeFg = d.type === 'inv' ? '#0F6E56' : d.type === 'sop' ? '#3B6D11' : d.type === 'nosop' ? C.muted : C.red;
                  var typeLbl = d.type === 'inv' ? 'INV' : d.type === 'sop' ? 'SOP' : d.type === 'nosop' ? 'NONE' : 'UNMAPPED';
                  return (
                    <label key={d.dish_name}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 5, background: isT ? '#EAF3DE' : C.surface, border: '1px solid ' + (isT ? '#3B6D11' : C.border), cursor: disabled ? 'not-allowed' : 'pointer' }}>
                      <input type="radio" name={'dedup-target-' + idx} checked={isT}
                        disabled={disabled || saving}
                        onChange={function(){ pickDedupTarget(key, d.dish_name); }}
                        style={{ margin: 0, cursor: disabled ? 'not-allowed' : 'pointer' }} />
                      <span style={{ fontSize: 13, fontWeight: isT ? 700 : 500, color: C.text, flex: 1 }}>{d.dish_name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: typeBadgeBg, color: typeBadgeFg }}>{typeLbl}</span>
                      {d.hindi && <span style={{ fontSize: 11, color: C.muted }}>{d.hindi}</span>}
                      <span style={{ fontSize: 11, color: uses === 0 ? C.muted : C.text, minWidth: 50, textAlign: 'right' }}>
                        {uses === 0 ? T2('unused') : uses + ' ' + T2('pkg' + (uses === 1 ? '' : 's'))}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button onClick={function(){ skipDedupCluster(key); }} disabled={saving || disabled}
                  style={{ padding: '5px 12px', borderRadius: 5, background: 'transparent', border: '1px solid ' + C.border, color: C.muted, fontSize: 11, fontWeight: 600, cursor: (saving || disabled) ? 'not-allowed' : 'pointer' }}>
                  {T2('Skip')}
                </button>
                <button onClick={function(){ mergeDedupCluster(idx); }} disabled={saving || disabled || !target}
                  style={{ padding: '5px 12px', borderRadius: 5, background: C.wine, border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: (saving || disabled || !target) ? 'not-allowed' : 'pointer', opacity: (saving || disabled || !target) ? 0.5 : 1 }}>
                  {saving ? T2('Merging…') : T2('Merge into "') + target + '"'}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div onClick={closeDedup}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={function(e){ e.stopPropagation(); }}
              style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 720, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                    🔍 {T2('Find duplicates')}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                    {totalGroups} {T2('groups found')} · {resolvedCount} {T2('resolved')} · {skippedCount} {T2('skipped')} · {remainingIdx.length} {T2('remaining')}
                  </div>
                </div>
                <button onClick={closeDedup} disabled={dedupSavingIdx != null}
                  style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: dedupSavingIdx != null ? 'not-allowed' : 'pointer', padding: 4 }}>×</button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 14 }}>
                {nothingFound && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted, fontSize: 13 }}>
                    {T2('No duplicate candidates found in the current dish list.')}
                  </div>
                )}
                {allDone && (
                  <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{T2('All done')}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {resolvedCount} {T2('merged')} · {skippedCount} {T2('skipped')}
                    </div>
                    {skippedCount > 0 && (
                      <button onClick={resetDedupSkipped}
                        style={{ marginTop: 12, padding: '5px 12px', borderRadius: 5, background: 'transparent', border: '1px solid ' + C.border, color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        {T2('Review skipped')}
                      </button>
                    )}
                  </div>
                )}
                {!allDone && highIdx.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#3B6D11', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      ▶ {T2('High confidence')} ({highIdx.length})
                    </div>
                    {highIdx.map(renderCard)}
                  </div>
                )}
                {!allDone && medIdx.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      ▶ {T2('Medium confidence')} ({medIdx.length})
                    </div>
                    {medIdx.map(renderCard)}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid ' + C.border }}>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {skippedCount > 0 && !allDone && (
                    <button onClick={resetDedupSkipped}
                      style={{ padding: '4px 10px', borderRadius: 5, background: 'transparent', border: '1px solid ' + C.border, color: C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {T2('Reset skipped')} ({skippedCount})
                    </button>
                  )}
                </div>
                <button onClick={closeDedup} disabled={dedupSavingIdx != null}
                  style={{ padding: '6px 14px', borderRadius: 6, background: C.wine, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: dedupSavingIdx != null ? 'not-allowed' : 'pointer' }}>
                  {T2('Close')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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