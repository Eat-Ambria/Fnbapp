// Ambria FnB — Menu & Packages View  (V63 rebuild — 5b left rail)
// Three tabs: Build menu · Packages · Dish library
// Place in: src/components/MenuPackagesView.jsx
import React, { useState, useEffect } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES, MENU_PACKAGE_SECTIONS, refreshMenuPackages } from '../data/menuPackages.js';
import { getCatIdForDish, RECIPE_DB, getSectionsForPackage, setPackageSections, flattenSectionsToDishes, getAllDishes, resolveDishHindi, resolveDishStore, findRecipeForDish, upsertDishHindi, upsertDishStoreMap, upsertDishMaster } from '../data/recipeData.js';
import { TODAY, TOMORROW, safeArr } from '../utils/helpers.js';
import { supabase } from '../lib/supabase.js';
import { getCateringStoreItemsCached } from '../lib/opsSupabase.js';
import { MenuEditor } from './MenuEditor.jsx';
import DishLibrary from './DishLibrary.jsx';
import DishMappingModal from './DishMappingModal.jsx';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── CSV utilities (V63 5e) ─────────────────────────────────────────
// Handles quoted fields, escaped double-quotes, commas inside quotes, CRLF/LF.
function parseCSV(text) {
  var rows = []; var cur = []; var field = ''; var i = 0; var inQ = false;
  var s = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (i < s.length) {
    var c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i+1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { cur.push(field); field = ''; i++; continue; }
    if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter(function(r) { return r.length > 0 && r.some(function(v) { return (v || '').trim() !== ''; }); });
}
function csvEscape(v) { var s = (v == null ? '' : String(v)); return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function csvRow(arr) { return arr.map(csvEscape).join(','); }
function downloadCSV(filename, text) {
  var blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Module-level render-prop wrapper — keeps sortable identity stable across
// parent re-renders (same pattern as DishSectionsEditor V73).
function SortableSection({ id, disabled, children }) {
  var s = useSortable({ id: id, disabled: !!disabled });
  var style = {
    transform: CSS.Transform.toString(s.transform),
    transition: s.transition,
    opacity: s.isDragging ? 0.5 : 1,
    zIndex: s.isDragging ? 10 : 'auto',
    position: 'relative',
  };
  return children({
    setNodeRef: s.setNodeRef,
    style: style,
    attributes: s.attributes,
    listeners: s.listeners,
    isDragging: s.isDragging,
  });
}

function MenuPackagesView({ lang = "en", currentUser = null, events = [], setEvents }) {
  var T2 = function(s) { return T(s, lang); };
  var isAdmin = currentUser?.role === "admin" || currentUser?.role === "headchef";
  var [mainTab, setMainTab] = useState("events"); // "events" | "packages" | "library"
  var [mappingDish, setMappingDish] = useState(''); // V66: opens shared DishMappingModal from Packages tab
  var [selectedDishes, setSelectedDishes] = useState({}); // V66: { [dishName]: true } — bulk-move selection

  // ════════════════════════════════════════════════════════════
  // BUILD MENU TAB — preserved verbatim from V62
  // ════════════════════════════════════════════════════════════
  var [selEvId, setSelEvId] = useState(null);

  var allEvs = safeArr(events).filter(function(e) { return e.date && e.date >= TODAY; }).sort(function(a, b) {
    if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
    return (a.time || "").localeCompare(b.time || "");
  });
  var selEv = allEvs.find(function(e) { return e.id === selEvId; }) || null;

  function saveMenu(dishes) {
    if (!selEv || !setEvents) return;
    setEvents(function(prev) {
      return (prev || []).map(function(e) {
        if (e.id !== selEv.id) return e;
        return { ...e, menu: dishes, menuPackage: "" };
      });
    });
  }

  function dayLabel(date) {
    if (date === TODAY) return "Today";
    if (date === TOMORROW) return "Tomorrow";
    return date;
  }

  var byDate = {};
  allEvs.forEach(function(e) {
    var d = e.date || "Unknown";
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  });

  function menuStats(ev) {
    var menu = ev.menu || [];
    if (menu.length === 0 && ev.menuPackage && MENU_PACKAGES[ev.menuPackage]) {
      menu = MENU_PACKAGES[ev.menuPackage];
    }
    var byCat = {};
    menu.forEach(function(name) {
      var catId = getCatIdForDish(name) || "other";
      if (!byCat[catId]) byCat[catId] = 0;
      byCat[catId]++;
    });
    return { total: menu.length, byCat: byCat, menu: menu };
  }

  // ════════════════════════════════════════════════════════════
  // PACKAGES TAB STATE (5b)
  // ════════════════════════════════════════════════════════════
  var [selPkg, setSelPkg] = useState(null);

  var pkgNames = Object.keys(MENU_PACKAGES).sort();

  function pkgSummary(pkg) {
    var dishes = MENU_PACKAGES[pkg] || [];
    var sections = getSectionsForPackage(pkg);
    return { dishCount: dishes.length, sectionCount: sections.length };
  }

  function pkgUsageCount(pkg) {
    return safeArr(events).filter(function(e) { return e.menuPackage === pkg && e.date >= TODAY; }).length;
  }

  // ── Local editor state (5c — no writes yet, wires up in 5d) ────────
  var [editorSections, setEditorSections] = useState([]);
  var [dirty, setDirty]                   = useState(false);
  var [addDishInput, setAddDishInput]     = useState({}); // { [secId]: "text" }
  // V73: catalogue section picker — bring dish_catalogue_sections into a package
  var [catalogueSections, setCatalogueSections] = useState([]); // { id, name, dept, sales_dept, sop_category_hint, dishes:[names] }
  var [catPickerOpen, setCatPickerOpen]         = useState(false);
  var [catPickerLoading, setCatPickerLoading]   = useState(false);


  useEffect(function() {
    if (selPkg) {
      var loaded = getSectionsForPackage(selPkg) || [];
      // V66 reconcile: if flat dishes[] contains dishes missing from sections
      // (legacy pre-sections data), park them in an "Other" section so the
      // user sees the full package. Save will re-flatten and make both consistent.
      var flat = MENU_PACKAGES[selPkg] || [];
      var inSections = {};
      loaded.forEach(function(s) { (s.dishes || []).forEach(function(d) { inSections[d] = true; }); });
      var orphans = flat.filter(function(d) { return !inSections[d]; });
      if (orphans.length > 0) {
        var existingOther = loaded.find(function(s) { return (s.name || '').toLowerCase() === 'other' || s.sop_category === ''; });
        if (existingOther) {
          existingOther.dishes = (existingOther.dishes || []).concat(orphans);
        } else {
          loaded = loaded.concat([{ id: 'sec_recon_' + Date.now(), name: 'Other', sop_category: '', dishes: orphans }]);
        }
        console.warn('[MenuPackages] Reconciled ' + orphans.length + ' orphan dish(es) into "Other" section for package "' + selPkg + '". Save to persist.');
      }
      setEditorSections(loaded);
      setDirty(orphans.length > 0);  // mark dirty so user sees the save prompt and can confirm
      setAddDishInput({});
      setSelectedDishes({});
    } else {
      setEditorSections([]);
      setDirty(false);
      setAddDishInput({});
      setSelectedDishes({});
    }

  }, [selPkg]);

  function genSecId() { return 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

  // V66: bulk-move selection helpers
  function toggleDishSelect(dishName) {
    setSelectedDishes(function(prev) {
      var next = {};
      Object.keys(prev).forEach(function(k) { next[k] = prev[k]; });
      if (next[dishName]) delete next[dishName]; else next[dishName] = true;
      return next;
    });
  }
  function clearDishSelect() { setSelectedDishes({}); }
  function bulkMoveToSection(targetSecId) {
    if (!targetSecId) return;
    var names = Object.keys(selectedDishes);
    if (names.length === 0) return;
    var picked = {}; names.forEach(function(n) { picked[n] = true; });
    setEditorSections(function(prev) {
      // Strip picked dishes from every section
      var stripped = prev.map(function(s) {
        return { id: s.id, name: s.name, sop_category: s.sop_category, dishes: (s.dishes || []).filter(function(n) { return !picked[n]; }) };
      });
      // Append picked (in original picked order) to target, skipping duplicates
      return stripped.map(function(s) {
        if (s.id !== targetSecId) return s;
        var have = {}; (s.dishes || []).forEach(function(n) { have[n] = true; });
        var toAdd = names.filter(function(n) { return !have[n]; });
        return { id: s.id, name: s.name, sop_category: s.sop_category, dishes: (s.dishes || []).concat(toAdd) };
      });
    });
    setSelectedDishes({});
    setDirty(true);
  }

  function addSection() {
    setEditorSections(function(prev) {
      return [...prev, { id: genSecId(), name: 'New section', sop_category: '', dishes: [] }];
    });
    setDirty(true);
  }

  // V73: fetch catalogue sections + their dishes once, cached for the session.
  async function loadCatalogueForPicker() {
    if (catalogueSections.length > 0 || catPickerLoading) return;
    setCatPickerLoading(true);
    try {
      var results = await Promise.all([
        supabase.from('dish_catalogue_sections')
          .select('id, name, dept, sales_dept, sop_category_hint, sort_order')
          .order('sort_order', { ascending: true }),
        supabase.from('dishes_master')
          .select('dish_name, section_id, sort_in_section')
          .eq('is_active', true)
          .not('section_id', 'is', null),
      ]);
      if (results[0].error) throw results[0].error;
      if (results[1].error) throw results[1].error;
      var bySection = {};
      (results[1].data || []).forEach(function(d) {
        if (!bySection[d.section_id]) bySection[d.section_id] = [];
        bySection[d.section_id].push({ name: d.dish_name, sort: d.sort_in_section || 0 });
      });
      Object.keys(bySection).forEach(function(k) {
        bySection[k].sort(function(a, b) { return (a.sort - b.sort) || a.name.localeCompare(b.name); });
      });
      var enriched = (results[0].data || []).map(function(s) {
        return { ...s, dishes: (bySection[s.id] || []).map(function(d) { return d.name; }) };
      });
      setCatalogueSections(enriched);
    } catch (e) {
      alert('Failed to load catalogue sections: ' + e.message);
    } finally { setCatPickerLoading(false); }
  }

  // V73: append a package section pre-populated from a catalogue section.
  // Stores catalogue_section_id linkback for future features (badge, resync, etc.).
  function addSectionFromCatalogue(catSec) {
    setEditorSections(function(prev) {
      return [...prev, {
        id: genSecId(),
        name: catSec.name,
        sop_category: catSec.sop_category_hint || '',
        dishes: catSec.dishes.slice(),
        catalogue_section_id: catSec.id,
      }];
    });
    setDirty(true);
    setCatPickerOpen(false);
  }
  function renameSection(secId, newName) {
    setEditorSections(function(prev) { return prev.map(function(s) { return s.id === secId ? { ...s, name: newName } : s; }); });
    setDirty(true);
  }
  function setSectionCategory(secId, catName) {
    setEditorSections(function(prev) { return prev.map(function(s) { return s.id === secId ? { ...s, sop_category: catName } : s; }); });
    setDirty(true);
  }
  function deleteSection(secId) {
    var sec = editorSections.find(function(s) { return s.id === secId; });
    if (!sec) return;
    if (sec.dishes.length > 0 && !window.confirm('Delete section "' + (sec.name||'') + '" with ' + sec.dishes.length + ' dishes? Dishes will be removed from this package (but stay in the Dish Library).')) return;
    setEditorSections(function(prev) { return prev.filter(function(s) { return s.id !== secId; }); });
    setDirty(true);
  }

  // ── Section drag-and-drop reorder (V74) ──────────────────────────
  // Sections live inside the sections JSONB on menu_packages, so reorder is
  // purely a local array move; existing savePackage() persists on Save click.
  var dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  function handleSectionDragEnd(event) {
    var active = event.active;
    var over = event.over;
    if (!over || active.id === over.id) return;
    setEditorSections(function(prev) {
      var oldIdx = prev.findIndex(function(s){ return s.id === active.id; });
      var newIdx = prev.findIndex(function(s){ return s.id === over.id; });
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
    setDirty(true);
  }
  function addDishToSection(secId, name) {
    var trimmed = (name || '').trim();
    if (!trimmed) return;
    setEditorSections(function(prev) {
      return prev.map(function(s) {
        if (s.id !== secId) return s;
        if (s.dishes.indexOf(trimmed) !== -1) return s;
        return { ...s, dishes: [...s.dishes, trimmed] };
      });
    });
    setAddDishInput(function(p) { return { ...p, [secId]: '' }; });
    setDirty(true);
  }
  function removeDishFromSection(secId, name) {
    setEditorSections(function(prev) {
      return prev.map(function(s) {
        if (s.id !== secId) return s;
        return { ...s, dishes: s.dishes.filter(function(d) { return d !== name; }) };
      });
    });
    setDirty(true);
  }
  function discardChanges() {
    if (!selPkg) return;
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setEditorSections(getSectionsForPackage(selPkg));
    setDirty(false);
    setAddDishInput({});
  }
  function getDishType(name) {
    if (!name) return 'unmapped';
    if (resolveDishStore(name)) return 'inventory';
    if (findRecipeForDish(name)) return 'sop';
    return 'unmapped';
  }

  // ── Save / lifecycle (5d) ─────────────────────────────────────────
  var [saving, setSaving] = useState(false);

  // Strip client-only cruft before persisting. Keeps id (stable ref).
  function serializeSections(secs) {
    return (secs || []).map(function(s) {
      return {
        id: s.id || genSecId(),
        name: (s.name || '').trim() || 'Untitled',
        sop_category: s.sop_category || '',
        dishes: (s.dishes || []).map(function(d) { return (d || '').trim(); }).filter(Boolean)
      };
    });
  }

  function clearMenuPackageCaches() {
    try {
      localStorage.removeItem('ambria_menu_packages');
      localStorage.removeItem('ambria_cfg_menu_packages');
    } catch(e) {}
  }

  async function savePackage() {
    if (!selPkg || saving) return;
    var serialized = serializeSections(editorSections);
    var flatDishes = flattenSectionsToDishes(serialized);
    setSaving(true);
    try {
      var res = await supabase.from('menu_packages')
        .update({ dishes: flatDishes, sections: serialized })
        .eq('name', selPkg);
      if (res.error) throw res.error;
      setPackageSections(selPkg, serialized, flatDishes);

      clearMenuPackageCaches();
      await refreshMenuPackages();
      setEditorSections(serialized);
      setDirty(false);
    } catch (e) {
      console.error('savePackage failed:', e);
      alert('Save failed: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function createPackage() {
    if (dirty) { alert('Save or discard current changes first.'); return; }
    var name = (window.prompt('New package name:') || '').trim();
    if (!name) return;
    if (MENU_PACKAGES[name]) { alert('A package named "' + name + '" already exists.'); return; }
    setSaving(true);
    try {
      var newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      var res = await supabase.from('menu_packages')
        .upsert({ id: newId, name: name, dishes: [], sections: [], is_active: true }, { onConflict: 'name' });
      if (res.error) throw res.error;
      setPackageSections(name, [], []);
      clearMenuPackageCaches();
      await refreshMenuPackages();
      setSelPkg(name);
    } catch (e) {
      console.error('createPackage failed:', e);
      alert('Create failed: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function duplicatePackage() {
    if (!selPkg) return;
    if (dirty) { alert('Save or discard current changes first.'); return; }
    var suggested = selPkg + ' (copy)';
    var name = (window.prompt('Duplicate as:', suggested) || '').trim();
    if (!name) return;
    if (MENU_PACKAGES[name]) { alert('A package named "' + name + '" already exists.'); return; }
    var srcSections = getSectionsForPackage(selPkg);
    // Regenerate ids so the copy has independent stable refs
    var copySections = srcSections.map(function(s) { return { ...s, id: genSecId(), dishes: s.dishes.slice() }; });
    var serialized = serializeSections(copySections);
    var flatDishes = flattenSectionsToDishes(serialized);
    setSaving(true);
    try {
      var newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      var res = await supabase.from('menu_packages')
        .upsert({ id: newId, name: name, dishes: flatDishes, sections: serialized, is_active: true }, { onConflict: 'name' });
      if (res.error) throw res.error;
      setPackageSections(name, serialized, flatDishes);
      clearMenuPackageCaches();
      await refreshMenuPackages();
      setSelPkg(name);
    } catch (e) {
      console.error('duplicatePackage failed:', e);
      alert('Duplicate failed: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function deletePackage() {
    if (!selPkg) return;
    if (dirty) { alert('Save or discard current changes first.'); return; }
    var usage = pkgUsageCount(selPkg);
    var warn = 'Permanently delete package "' + selPkg + '"?';
    if (usage > 0) warn += '\n\n⚠ ' + usage + ' upcoming function(s) still reference this package. Their existing menus stay intact, but they will lose the package link.';
    warn += '\n\nThis is a HARD delete — the row is removed from Supabase and cannot be restored.';
    if (!window.confirm(warn)) return;
    setSaving(true);
    try {
      var res = await supabase.from('menu_packages')
        .delete()
        .eq('name', selPkg);
      if (res.error) throw res.error;
      delete MENU_PACKAGES[selPkg];
      delete MENU_PACKAGE_SECTIONS[selPkg];
      clearMenuPackageCaches();
      await refreshMenuPackages();
      setSelPkg(null);
    } catch (e) {
      console.error('deletePackage failed:', e);
      alert('Delete failed: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  // ── CSV import / export (5e) ──────────────────────────────────────
  var [csvOpen, setCsvOpen]         = useState(false);
  var [csvRows, setCsvRows]         = useState([]);
  var [csvOpsItems, setCsvOpsItems] = useState([]);
  var [csvFile, setCsvFile]         = useState('');
  var [csvErrors, setCsvErrors]     = useState([]);
  var [csvLoading, setCsvLoading]   = useState(false);
  var [csvSaving, setCsvSaving]     = useState(false);

  function exportCurrentPackage() {
    if (!selPkg) return;
    var sections = getSectionsForPackage(selPkg);
    var lines = ['package,section,dish,type,sop_category,ops_item,qty_per_cover,hindi'];
    sections.forEach(function(sec) {
      sec.dishes.forEach(function(d) {
        var store = resolveDishStore(d);
        var hi = resolveDishHindi(d) || '';
        var type = store ? 'inventory' : (findRecipeForDish(d) ? 'sop' : '');
        lines.push(csvRow([
          selPkg, sec.name, d, type,
          sec.sop_category || '',
          store ? (store.ops_item_name || '') : '',
          store ? (store.qty_per_cover || '') : '',
          hi
        ]));
      });
    });
    downloadCSV(selPkg.replace(/[^\w]+/g, '_') + '.csv', lines.join('\n'));
  }

  async function openCsvImport() {
    setCsvOpen(true); setCsvRows([]); setCsvFile(''); setCsvErrors([]);
    setCsvLoading(true);
    try {
      var items = await getCateringStoreItemsCached();
      setCsvOpsItems(items || []);
    } catch (e) {
      console.warn('Ops items fetch failed — inventory rows will import as unmatched:', e);
      setCsvOpsItems([]);
    } finally {
      setCsvLoading(false);
    }
  }
  function closeCsvImport() { if (!csvSaving) setCsvOpen(false); }

  function resolveCsvRow(row, opsItems) {
    var status = 'ok'; var note = ''; var opsMatch = null;
    if (row.type === 'inventory' && row.ops_item) {
      var target = row.ops_item.toLowerCase().trim();
      opsMatch = opsItems.find(function(it) { return (it.name || '').toLowerCase().trim() === target; });
      if (!opsMatch) {
        var loose = opsItems.filter(function(it) {
          var n = (it.name || '').toLowerCase();
          return n.indexOf(target) !== -1 || target.indexOf(n) !== -1;
        });
        if (loose.length === 1) { opsMatch = loose[0]; status = 'fuzzy'; note = 'Loose match — verify.'; }
        else if (loose.length > 1) { status = 'ambiguous'; note = loose.length + ' possible ops matches.'; }
        else { status = 'unmatched'; note = 'Ops item not found. Imports without inventory mapping.'; }
      }
    } else if (row.type === 'sop' && !findRecipeForDish(row.dish)) {
      status = 'pending'; note = 'No SOP recipe — imports, map later in Dish library.';
    }
    return { ...row, status: status, note: note, opsMatch: opsMatch };
  }

  function handleCsvFile(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    setCsvFile(f.name); setCsvErrors([]);
    var reader = new FileReader();
    reader.onload = function() {
      var rows = parseCSV(reader.result);
      if (rows.length < 2) { setCsvErrors(['CSV empty or has no data rows.']); setCsvRows([]); return; }
      var headers = rows[0].map(function(h) { return (h || '').toString().trim().toLowerCase().replace(/\s+/g, '_'); });
      var missing = ['package', 'section', 'dish'].filter(function(r) { return headers.indexOf(r) === -1; });
      if (missing.length) { setCsvErrors(['Missing required column(s): ' + missing.join(', ')]); setCsvRows([]); return; }
      var idx = {}; headers.forEach(function(h, i) { idx[h] = i; });
      var errs = [];
      var parsed = rows.slice(1).map(function(r, rowIdx) {
        function get(col) { return idx[col] != null ? (r[idx[col]] || '').trim() : ''; }
        var t = get('type').toLowerCase();
        var type = (t === 'inventory' || t === 'inv') ? 'inventory' : (t === 'sop') ? 'sop' : '';
        var qty = get('qty_per_cover');
        var qtyNum = qty ? parseFloat(qty) : null;
        if (qty && (isNaN(qtyNum) || qtyNum <= 0)) errs.push('Row ' + (rowIdx + 2) + ': invalid qty_per_cover "' + qty + '"');
        return {
          rowIdx: rowIdx + 2,
          package: get('package'), section: get('section'), dish: get('dish'),
          type: type, sop_category: get('sop_category'),
          ops_item: get('ops_item'), qty: qtyNum, hindi: get('hindi'),
        };
      }).filter(function(r) { return r.package && r.section && r.dish; });
      setCsvRows(parsed.map(function(r) { return resolveCsvRow(r, csvOpsItems); }));
      setCsvErrors(errs);
    };
    reader.onerror = function() { setCsvErrors(['Could not read file.']); };
    reader.readAsText(f);
  }

  function downloadCsvTemplate() {
    var text = 'package,section,dish,type,sop_category,ops_item,qty_per_cover,hindi\n' +
      'Pearl Veg,Beverages,Fresh Lime Soda,sop,Beverages,,,फ्रेश लाइम सोडा\n' +
      'Pearl Veg,Beverages,Bisleri 500ml,inventory,,Bisleri 500ml,1,\n' +
      'Pearl Veg,Salads,Kachumber Salad,sop,Salads,,,कचूमर सलाद\n';
    downloadCSV('menu_package_template.csv', text);
  }

  function csvPackagesAffected() {
    var m = {}; csvRows.forEach(function(r) { m[r.package] = (m[r.package] || 0) + 1; });
    return Object.keys(m).map(function(p) { return { name: p, rowCount: m[p], existing: !!MENU_PACKAGES[p] }; });
  }

  async function commitCsvImport() {
    if (csvSaving || csvRows.length === 0) return;
    var pkgs = csvPackagesAffected();
    var existing = pkgs.filter(function(p) { return p.existing; }).map(function(p) { return p.name; });
    var warn = 'Import ' + csvRows.length + ' rows into ' + pkgs.length + ' package(s)?';
    if (existing.length > 0) warn += '\n\n⚠ REPLACES existing packages: ' + existing.join(', ') + '. Sections/dishes not in the CSV will be removed from these packages.';
    warn += '\n\nInventory mappings and Hindi are written for resolved rows. Ops items not found → dish imports without inventory mapping (can map later in Dish library).';
    if (!window.confirm(warn)) return;

    setCsvSaving(true);
    try {
      // 1. Group CSV rows into per-package section structures (preserves order)
      var byPkg = {};
      csvRows.forEach(function(r) {
        if (!byPkg[r.package]) byPkg[r.package] = { sections: [], secIdx: {} };
        var bag = byPkg[r.package];
        if (bag.secIdx[r.section] == null) {
          bag.secIdx[r.section] = bag.sections.length;
          bag.sections.push({
            id: 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '_' + bag.sections.length,
            name: r.section, sop_category: r.sop_category || '', dishes: []
          });
        }
        var sec = bag.sections[bag.secIdx[r.section]];
        if (r.sop_category && !sec.sop_category) sec.sop_category = r.sop_category;
        if (sec.dishes.indexOf(r.dish) === -1) sec.dishes.push(r.dish);
      });

      // 2. Ensure every dish exists in dishes_master (ignore 23505 unique conflict)
      var allDishNames = {}; csvRows.forEach(function(r) { allDishNames[r.dish] = true; });
      for (var name in allDishNames) {
        var ins = await supabase.from('dishes_master').insert({ dish_name: name }).select();
        if (ins.error && ins.error.code !== '23505') console.warn('dishes_master insert', name, ins.error);
        upsertDishMaster(name, { is_active: true });
      }

      // 3. Hindi mappings (batch upsert)
      var hindiRows = csvRows.filter(function(r) { return r.hindi; });
      if (hindiRows.length > 0) {
        var seen = {}; var hindiUpsert = [];
        hindiRows.forEach(function(r) { if (!seen[r.dish]) { seen[r.dish] = true; hindiUpsert.push({ dish_name: r.dish, hi: r.hindi }); } });
        var hRes = await supabase.from('dish_hindi_map').upsert(hindiUpsert, { onConflict: 'dish_name' });
        if (hRes.error) console.warn('dish_hindi_map upsert', hRes.error);
        else hindiUpsert.forEach(function(r) { upsertDishHindi(r.dish_name, r.hi); });
      }

      // 4. Inventory store mappings (only rows resolved to an Ops item)
      var invRows = csvRows.filter(function(r) { return r.type === 'inventory' && r.opsMatch; });
      if (invRows.length > 0) {
        var seenInv = {}; var storeUpsert = [];
        invRows.forEach(function(r) {
          if (seenInv[r.dish]) return; seenInv[r.dish] = true;
          storeUpsert.push({
            dish_name: r.dish,
            ops_item_id: r.opsMatch.id,
            ops_inventory_id: r.opsMatch.inventory_id || null,  // V64: stable prefix key — survives Ops rebuilds
            ops_item_name: r.opsMatch.name || '',
            ops_item_hindi: r.opsMatch.name_hindi || null,
            ops_item_unit: r.opsMatch.unit || 'Pieces',
            qty_per_cover: r.qty || 1,
            updated_at: new Date().toISOString(),
          });
        });
        var sRes = await supabase.from('dish_store_map').upsert(storeUpsert, { onConflict: 'dish_name' });
        if (sRes.error) console.warn('dish_store_map upsert', sRes.error);
        else storeUpsert.forEach(function(r) {
          upsertDishStoreMap(r.dish_name, {
            ops_item_id: r.ops_item_id, ops_inventory_id: r.ops_inventory_id,
            ops_item_name: r.ops_item_name, ops_item_hindi: r.ops_item_hindi || '',
            ops_item_unit: r.ops_item_unit, qty_per_cover: r.qty_per_cover,
          });
        });
      }

      // 5. Upsert each package (menu_packages) — dishes[] + sections
      for (var pkgName in byPkg) {
        var pkg = byPkg[pkgName];
        var flatDishes = flattenSectionsToDishes(pkg.sections);
        if (MENU_PACKAGES[pkgName]) {
          var uRes = await supabase.from('menu_packages')
            .update({ dishes: flatDishes, sections: pkg.sections, is_active: true })
            .eq('name', pkgName);
          if (uRes.error) throw uRes.error;
        } else {
          var iRes = await supabase.from('menu_packages')
            .upsert({ name: pkgName, dishes: flatDishes, sections: pkg.sections, is_active: true }, { onConflict: 'name' });
          if (iRes.error) throw iRes.error;
        }
        setPackageSections(pkgName, pkg.sections, flatDishes);
      }

      clearMenuPackageCaches();
      await refreshMenuPackages();
      alert('Import complete: ' + csvRows.length + ' rows into ' + Object.keys(byPkg).length + ' package(s).');
      setCsvOpen(false);
      if (byPkg[selPkg]) { setEditorSections(getSectionsForPackage(selPkg)); setDirty(false); }
    } catch (e) {
      console.error('CSV import failed:', e);
      alert('Import failed: ' + (e.message || e));
    } finally {
      setCsvSaving(false);
    }
  }

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  var TABS = [
    { v: "events",   l: "📋 " + T2("Build menu") },
    { v: "packages", l: "📦 " + T2("Packages") },
    { v: "library",  l: "📚 " + T2("Dish library") },
  ];

  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>🍽 {T2("Menu")}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{allEvs.length} {T2("upcoming functions")}</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid " + C.border, paddingBottom: 8, marginTop: 12 }}>
        {TABS.map(function(t) {
          return <button key={t.v} onClick={function() { setMainTab(t.v); setSelEvId(null); }}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", background: mainTab === t.v ? C.wine : "transparent", color: mainTab === t.v ? "#fff" : C.muted, border: "1.5px solid " + (mainTab === t.v ? C.wine : C.border) }}>{t.l}</button>;
        })}
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* BUILD MENU TAB                                          */}
      {/* ════════════════════════════════════════════════════════ */}
      {mainTab === "events" && !selEv && (
        <div>
          {Object.keys(byDate).length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: C.muted, fontSize: 13 }}>{T2("No upcoming functions")}</div>
          )}
          {Object.entries(byDate).map(function(entry) {
            var date = entry[0]; var evs = entry[1];
            var isToday = date === TODAY;
            var isTmrw = date === TOMORROW;
            return (
              <div key={date} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? C.green : isTmrw ? C.amber : C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                  {isToday ? "🔴 " : isTmrw ? "🟡 " : "📅 "}{dayLabel(date)}
                </div>
                {evs.map(function(ev) {
                  var stats = menuStats(ev);
                  var hasMenu = stats.total > 0;
                  var isLms = !!ev.lms_source;
                  return (
                    <button key={ev.id} onClick={function() { setSelEvId(ev.id); }}
                      style={{ display: "block", width: "100%", textAlign: "left", background: C.surface, border: "1.5px solid " + (hasMenu ? C.greenBorder : C.amberBorder), borderRadius: 12, padding: "14px 18px", marginBottom: 8, cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{ev.guest || "Function"}</span>
                            {isLms && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: C.blueBg, color: C.blue, fontWeight: 600 }}>LMS</span>}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                            {ev.venue} · {ev.time || "TBD"} · {ev.pax || "?"} pax{ev.menuPackage ? " · " + ev.menuPackage : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {hasMenu
                            ? <div><div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{stats.total}</div><div style={{ fontSize: 10, color: C.green }}>dishes</div></div>
                            : <div><div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>No menu</div><div style={{ fontSize: 10, color: C.amber }}>tap to build</div></div>}
                        </div>
                      </div>
                      {hasMenu && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          {Object.entries(stats.byCat).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(e2) {
                            var catId = e2[0]; var count = e2[1];
                            var cat = RECIPE_DB.cats.find(function(c) { return c.id === catId; });
                            return <span key={catId} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: C.bg, border: "1px solid " + C.border, color: C.muted }}>
                              {cat ? cat.icon + " " : ""}{cat ? cat.name : catId} ({count})
                            </span>;
                          })}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {mainTab === "events" && selEv && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <button onClick={function() { setSelEvId(null); }}
              style={{ padding: "8px 16px", borderRadius: 10, background: C.bg, border: "1px solid " + C.border, color: C.muted, fontSize: 12, cursor: "pointer", minHeight: 36 }}>← {T2("Back")}</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selEv.guest}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{selEv.venue} · {selEv.date} · {selEv.time || "TBD"} · {selEv.pax || "?"} pax</div>
            </div>
          </div>
          <MenuEditor
            selected={selEv.menu && selEv.menu.length > 0 ? selEv.menu : (selEv.menuPackage && MENU_PACKAGES[selEv.menuPackage] ? MENU_PACKAGES[selEv.menuPackage] : [])}
            onChange={function(dishes) { saveMenu(dishes); }}
            lang={lang}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* PACKAGES TAB — 5b left rail                              */}
      {/* ════════════════════════════════════════════════════════ */}
      {mainTab === "packages" && (
        <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 14, alignItems: "flex-start" }}>

          {/* TOOLBAR — spans both columns */}
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: C.faint }}>{T2("Bulk-manage packages via CSV")}</div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={openCsvImport} disabled={saving || csvSaving}
                  style={{ padding: "6px 12px", borderRadius: 6, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 12, fontWeight: 600, cursor: (saving || csvSaving) ? "not-allowed" : "pointer" }}>⬆ {T2("Import CSV")}</button>
                <button onClick={exportCurrentPackage} disabled={!selPkg || saving}
                  title={!selPkg ? T2("Select a package first") : T2("Export current package as CSV")}
                  style={{ padding: "6px 12px", borderRadius: 6, background: C.surface, border: "1px solid " + C.border, color: selPkg ? C.text : C.faint, fontSize: 12, fontWeight: 600, cursor: (!selPkg || saving) ? "not-allowed" : "pointer", opacity: (!selPkg || saving) ? 0.6 : 1 }}>⬇ {T2("Export CSV")}</button>
              </div>
            )}
          </div>

          {/* LEFT RAIL — package list */}
          <div style={{ background: C.bg, borderRadius: 12, padding: 10, border: "1px solid " + C.border }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 8px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{T2("Packages")} ({pkgNames.length})</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {pkgNames.length === 0 && (
                <div style={{ padding: "12px 8px", fontSize: 12, color: C.muted, textAlign: "center" }}>{T2("No packages yet")}</div>
              )}
              {pkgNames.map(function(pkg) {
                var s = pkgSummary(pkg);
                var usage = pkgUsageCount(pkg);
                var isSel = selPkg === pkg;
                return (
                  <button key={pkg} onClick={function() { setSelPkg(pkg); }}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: isSel ? C.surface : "transparent",
                      border: "1px solid " + (isSel ? C.border : "transparent"),
                      cursor: "pointer",
                      color: C.text,
                    }}>
                    <div style={{ fontSize: 13, fontWeight: isSel ? 700 : 500, lineHeight: 1.3 }}>{pkg}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {s.sectionCount} {T2("sections")} · {s.dishCount} {T2("dishes")}
                      {usage > 0 && <span style={{ marginLeft: 6, color: C.green }}>· {usage} {T2("upcoming")}</span>}
                    </div>
                  </button>
                );
              })}

              {isAdmin && (
                <button onClick={createPackage} disabled={saving}
                  style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, border: "1px dashed " + C.border, background: "transparent", textAlign: "center", fontSize: 12, color: C.text, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1 }}>
                  + {T2("New package")}
                </button>
              )}
            </div>
          </div>

          {/* RIGHT PANE — editor placeholder */}
          <div style={{ background: C.surface, borderRadius: 12, border: "1px solid " + C.border, padding: "16px 18px", minHeight: 300 }}>
            {!selPkg && (
              <div style={{ padding: "60px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{T2("Select a package to view")}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{T2("Full editor arrives in 5c")}</div>
              </div>
            )}

            {selPkg && (function() {
              var totalDishes = editorSections.reduce(function(n, sec) { return n + sec.dishes.length; }, 0);
              var usage = pkgUsageCount(selPkg);
              var catOptions = (RECIPE_DB.cats || []).map(function(c) { return c.name; }).sort();
              var allDishNames = getAllDishes ? getAllDishes({ includeInactive: false }).map(function(d) { return d.dish_name; }) : [];
              return (
                <div>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>{selPkg}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {editorSections.length} {T2("sections")} · {totalDishes} {T2("dishes")}{usage > 0 && " · " + T2("used by") + " " + usage + " " + T2("upcoming")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {dirty && (
                        <span style={{ fontSize: 11, color: C.amber, padding: "3px 8px", borderRadius: 10, background: C.amberBg, border: "1px solid " + C.amberBorder, fontWeight: 600 }}>● {T2("unsaved")}</span>
                      )}

                      {isAdmin && (
                        <button onClick={addSection}
                          style={{ padding: "6px 12px", borderRadius: 6, background: C.wine, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ {T2("Section")}</button>
                      )}
                      {isAdmin && (
                        <button onClick={function(){ setCatPickerOpen(true); loadCatalogueForPicker(); }}
                          title={T2("Pull a section (and its dishes) in from the master catalogue")}
                          style={{ padding: "6px 12px", borderRadius: 6, background: C.surface, border: "1px solid " + C.wine, color: C.wine, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          📚 {T2("From catalogue")}
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={duplicatePackage} disabled={saving || dirty}
                          title={dirty ? T2("Save changes first") : T2("Duplicate package")}
                          style={{ padding: "6px 10px", borderRadius: 6, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 12, fontWeight: 600, cursor: (saving || dirty) ? "not-allowed" : "pointer", opacity: (saving || dirty) ? 0.5 : 1 }}>⧉ {T2("Duplicate")}</button>
                      )}
                      {isAdmin && (
                        <button onClick={deletePackage} disabled={saving || dirty}
                          title={dirty ? T2("Save changes first") : T2("Delete package")}
                          style={{ padding: "6px 10px", borderRadius: 6, background: C.surface, border: "1px solid " + C.redBorder, color: C.red, fontSize: 12, fontWeight: 600, cursor: (saving || dirty) ? "not-allowed" : "pointer", opacity: (saving || dirty) ? 0.5 : 1 }}>🗑 {T2("Delete")}</button>
                      )}
                    </div>
                  </div>

                  {/* V66: Bulk-move toolbar */}
                  {(function() {
                    var pickedNames = Object.keys(selectedDishes);
                    if (pickedNames.length === 0) return null;
                    return (
                      <div style={{ position: 'sticky', top: 0, zIndex: 5, marginBottom: 10, padding: '10px 14px', background: C.blueBg, border: '1.5px solid ' + C.blueBorder, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>{pickedNames.length} {T2('selected')}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>· {T2('Move to')}:</span>
                        <select value=""
                          onChange={function(e) { var v = e.target.value; if (v) bulkMoveToSection(v); e.target.value = ''; }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid ' + C.blueBorder, background: C.surface, fontSize: 12, color: C.text, cursor: 'pointer', fontWeight: 600 }}>
                          <option value="">— {T2('pick section')} —</option>
                          {editorSections.map(function(s) {
                            return <option key={s.id} value={s.id}>{s.name || T2('(unnamed)')}</option>;
                          })}
                        </select>
                        <button onClick={clearDishSelect}
                          style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, background: 'transparent', border: '1px solid ' + C.border, color: C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          {T2('Clear')}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Sections */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {editorSections.length === 0 && (
                      <div style={{ padding: "40px 20px", textAlign: "center", background: C.bg, border: "1.5px dashed " + C.border, borderRadius: 10 }}>
                        <div style={{ fontSize: 12, color: C.muted }}>{T2("No sections. Click + Section to add one.")}</div>
                      </div>
                    )}

                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                    <SortableContext items={editorSections.map(function(s){ return s.id; })} strategy={verticalListSortingStrategy}>
                    {editorSections.map(function(sec) {
                      return (
                        <SortableSection key={sec.id} id={sec.id} disabled={!isAdmin}>
                        {function(dnd) { return (
                        <div ref={dnd.setNodeRef} style={{ ...dnd.style, border: "1px solid " + C.border, borderRadius: 10, background: C.surface, marginBottom: 10 }}>
                          {/* Section header */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: C.bg, borderRadius: "10px 10px 0 0", borderBottom: "1px solid " + C.border, flexWrap: "wrap" }}>
                            {isAdmin && (
                              <span {...dnd.attributes} {...dnd.listeners}
                                title={T2("Drag to reorder")}
                                style={{ cursor: dnd.isDragging ? 'grabbing' : 'grab', color: C.muted, fontSize: 14, padding: '0 4px', userSelect: 'none', touchAction: 'none' }}>⋮⋮</span>
                            )}
                            <input
                              value={sec.name}
                              onChange={function(e) { renameSection(sec.id, e.target.value); }}
                              placeholder={T2("Section name")}
                              disabled={!isAdmin}
                              style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid " + C.border, background: C.surface, fontSize: 13, fontWeight: 600, color: C.text, minWidth: 140, flex: "0 1 auto" }}
                            />
                            <span style={{ fontSize: 11, color: C.muted }}>{T2("default")}:</span>
                            <select
                              value={sec.sop_category || ''}
                              onChange={function(e) { setSectionCategory(sec.id, e.target.value); }}
                              disabled={!isAdmin}
                              style={{ padding: "3px 6px", borderRadius: 10, border: "1px solid " + C.blueBorder, background: C.blueBg, fontSize: 11, color: C.blue, fontWeight: 600, cursor: isAdmin ? "pointer" : "default" }}>
                              <option value="">— {T2("pick default")} —</option>
                              {catOptions.map(function(c) { return <option key={c} value={c}>SOP · {c}</option>; })}
                              <option value="__inventory__">{T2("Inventory (Stores)")}</option>
                            </select>
                            <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>{sec.dishes.length} {T2("dishes")}</span>
                            {isAdmin && (
                              <button onClick={function() { deleteSection(sec.id); }}
                                title={T2("Delete section")}
                                style={{ padding: "2px 8px", background: "transparent", border: "none", color: C.red, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                            )}
                          </div>

                          {/* Dishes */}
                          <div>
                            {sec.dishes.length === 0 && (
                              <div style={{ padding: "10px 14px", fontSize: 11, color: C.faint, fontStyle: "italic" }}>{T2("No dishes in this section")}</div>
                            )}
                            {sec.dishes.map(function(d) {
                              var type = getDishType(d);
                              var hi = resolveDishHindi(d);
                              var store = type === 'inventory' ? resolveDishStore(d) : null;
                              var badgeBg = type === 'inventory' ? '#E1F5EE' : type === 'sop' ? '#EAF3DE' : '#FCEBEB';
                              var badgeC  = type === 'inventory' ? '#0F6E56' : type === 'sop' ? '#3B6D11' : '#A32D2D';
                              var badgeLbl = type === 'inventory' ? T2('Inventory') : type === 'sop' ? 'SOP' : T2('Unmapped');
                              var dot = type === 'inventory' ? '#1D9E75' : type === 'sop' ? '#639922' : '#E24B4A';
                              var isPicked = !!selectedDishes[d];
                              return (
                                <div key={d}
                                  onClick={function(e) { if (e.target.closest('[data-nomap]')) return; setMappingDish(d); }}
                                  title={T2('Click to edit Hindi / SOP / Inventory mapping')}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderTop: "1px solid " + C.borderLight, gap: 8, cursor: 'pointer', background: isPicked ? C.blueBg : 'transparent' }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0, flex: 1 }}>
                                    {isAdmin && (
                                      <input data-nomap type="checkbox" checked={isPicked}
                                        onChange={function() { toggleDishSelect(d); }}
                                        onClick={function(e) { e.stopPropagation(); }}
                                        style={{ margin: 0, cursor: 'pointer', flexShrink: 0 }} />
                                    )}
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }}></span>
                                    <span style={{ fontSize: 13, color: C.text }}>{d}</span>
                                    {hi && <span style={{ fontSize: 11, color: C.muted }}>{hi}</span>}
                                    {store && <span style={{ fontSize: 11, color: '#0F6E56' }}>→ {store.qty_per_cover} {store.ops_item_unit}/pax</span>}
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: badgeBg, color: badgeC }}>{badgeLbl}</span>
                                  </div>
                                  {isAdmin && (
                                    <button data-nomap onClick={function() { removeDishFromSection(sec.id, d); }}
                                      title={T2("Remove")}
                                      style={{ padding: "2px 8px", background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                                  )}
                                </div>
                              );
                            })}

                            {/* Add dish row */}
                            {isAdmin && (
                              <div style={{ padding: "8px 12px", borderTop: "1px solid " + C.borderLight, background: C.bg, borderRadius: "0 0 10px 10px" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <input
                                    list={"dishopts_" + sec.id}
                                    value={addDishInput[sec.id] || ''}
                                    onChange={function(e) { setAddDishInput(function(p) { return { ...p, [sec.id]: e.target.value }; }); }}
                                    onKeyDown={function(e) { if (e.key === 'Enter') { addDishToSection(sec.id, addDishInput[sec.id] || ''); } }}
                                    placeholder={T2("+ Add dish (type or pick)…")}
                                    style={{ flex: 1, padding: "5px 8px", borderRadius: 5, border: "1px solid " + C.border, background: C.surface, fontSize: 12, color: C.text, minWidth: 0 }}
                                  />
                                  <datalist id={"dishopts_" + sec.id}>
                                    {allDishNames.map(function(n) { return <option key={n} value={n} />; })}
                                  </datalist>
                                  <button onClick={function() { addDishToSection(sec.id, addDishInput[sec.id] || ''); }}
                                    style={{ padding: "5px 12px", borderRadius: 5, background: C.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{T2("Add")}</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        ); }}
                        </SortableSection>
                      );
                    })}
                    </SortableContext>
                    </DndContext>
                  </div>

                  {/* Save bar (5d wires up) */}
                  {dirty && (
                    <div style={{ position: "sticky", bottom: 0, marginTop: 16, padding: "12px 14px", background: C.amberBg, border: "1.5px solid " + C.amberBorder, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>{T2("Unsaved changes — Save wires up in 5d")}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={discardChanges}
                          style={{ padding: "6px 14px", borderRadius: 6, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{T2("Discard")}</button>
                        <button onClick={savePackage} disabled={saving}
                          style={{ padding: "6px 14px", borderRadius: 6, background: C.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? T2("Saving…") : T2("Save")}</button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* DISH LIBRARY TAB — 5a placeholder (built in step 6)     */}
      {/* ════════════════════════════════════════════════════════ */}
      {mainTab === "library" && (
        <DishLibrary
          lang={lang}
          currentUser={currentUser}
          onJumpToPackage={function(pkgName) { setMainTab("packages"); setSelPkg(pkgName); }}
        />
      )}

      {/* V73: Catalogue section picker modal */}
      {catPickerOpen && (
        <div onClick={function(){ setCatPickerOpen(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={function(e){ e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 640, width: '100%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{T2('Pick a catalogue section')}</span>
              <span style={{ flex: 1 }} />
              <button onClick={function(){ setCatPickerOpen(false); }}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 20, color: C.muted, padding: '2px 8px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
              {T2('All dishes in the picked section will be added to this package. You can remove any afterwards.')}
            </div>
            {catPickerLoading && <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>{T2('Loading…')}</div>}
            {!catPickerLoading && catalogueSections.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>
                {T2('No catalogue sections found. Set them up in Dish Library → Sections first.')}
              </div>
            )}
            {!catPickerLoading && catalogueSections.map(function(s){
              var alreadyLinked = editorSections.some(function(ex){ return ex.catalogue_section_id === s.id; });
              var effDept = s.sales_dept || 'kit';
              return (
                <div key={s.id}
                  onClick={function(){ if (!alreadyLinked) addSectionFromCatalogue(s); }}
                  style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 8, border: '1px solid ' + C.border, background: alreadyLinked ? C.bg : C.surface, cursor: alreadyLinked ? 'not-allowed' : 'pointer', opacity: alreadyLinked ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {s.dishes.length} {T2('dishes')}
                      {effDept !== 'kit' && <> · <span style={{ color: '#7A5B12', fontWeight: 600 }}>→ {effDept.toUpperCase()} tab</span></>}
                      {s.sop_category_hint && <> · SOP: {s.sop_category_hint}</>}
                    </div>
                  </div>
                  {alreadyLinked && <span style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>{T2('already added')}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* V66: Shared dish mapping modal — opens on dish row click from Packages tab */}
      <DishMappingModal
        dishName={mappingDish}
        lang={lang}
        currentUser={currentUser}
        onClose={function() { setMappingDish(''); }}
        onChange={function() {
          // Refresh section view so pill/badge reflects new mapping
          if (selPkg) setEditorSections(getSectionsForPackage(selPkg));
        }}
        onJumpToPackage={function(pkgName) { setMappingDish(''); setMainTab("packages"); setSelPkg(pkgName); }}
        allowDeactivate={false}
      />

      {/* ════════════════════════════════════════════════════════ */}
      {/* CSV IMPORT MODAL                                        */}
      {/* ════════════════════════════════════════════════════════ */}
      {csvOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={closeCsvImport}>
          <div onClick={function(e) { e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 820, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{T2("Import menu packages from CSV")}</div>
              <button onClick={closeCsvImport} disabled={csvSaving}
                style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: csvSaving ? "not-allowed" : "pointer", padding: 4 }}>×</button>
            </div>

            <div style={{ border: "1.5px dashed " + C.border, borderRadius: 10, padding: 20, textAlign: "center", background: C.bg, marginBottom: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <label style={{ display: "inline-block", padding: "8px 16px", borderRadius: 6, background: C.wine, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {csvFile ? T2("Choose different file") : T2("Choose CSV file")}
                <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} style={{ display: "none" }} />
              </label>
              {csvFile && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{csvFile}</div>}
              <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>{T2("Required")}: package, section, dish</div>
              <div style={{ fontSize: 11, color: C.faint }}>{T2("Optional")}: type (sop/inventory), sop_category, ops_item, qty_per_cover, hindi</div>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={downloadCsvTemplate}
                style={{ padding: "5px 10px", borderRadius: 6, background: C.bg, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>⬇ {T2("Download template")}</button>
              {csvLoading && <span style={{ fontSize: 11, color: C.muted }}>{T2("Loading Ops items…")}</span>}
              {!csvLoading && csvOpsItems.length > 0 && <span style={{ fontSize: 11, color: C.faint }}>{csvOpsItems.length} {T2("Ops items available for matching")}</span>}
            </div>

            {csvErrors.length > 0 && (
              <div style={{ padding: "8px 12px", borderRadius: 6, background: C.redBg, border: "1px solid " + C.redBorder, color: C.red, fontSize: 12, marginBottom: 12 }}>
                {csvErrors.map(function(er, i) { return <div key={i}>⚠ {er}</div>; })}
              </div>
            )}

            {csvRows.length > 0 && (function() {
              var pkgs = csvPackagesAffected();
              var okCount       = csvRows.filter(function(r) { return r.status === 'ok'; }).length;
              var fuzzyCount    = csvRows.filter(function(r) { return r.status === 'fuzzy'; }).length;
              var badCount      = csvRows.filter(function(r) { return r.status === 'unmatched' || r.status === 'ambiguous'; }).length;
              var pendingCount  = csvRows.filter(function(r) { return r.status === 'pending'; }).length;
              return (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                    {T2("Preview")} · {csvRows.length} {T2("rows")} · {pkgs.length} {T2("package(s)")}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, fontSize: 11 }}>
                    {okCount > 0       && <span style={{ padding: "2px 8px", borderRadius: 10, background: C.greenBg, color: C.green, fontWeight: 600 }}>✓ {okCount} ok</span>}
                    {fuzzyCount > 0    && <span style={{ padding: "2px 8px", borderRadius: 10, background: C.amberBg, color: C.amber, fontWeight: 600 }}>~ {fuzzyCount} fuzzy</span>}
                    {badCount > 0      && <span style={{ padding: "2px 8px", borderRadius: 10, background: C.redBg, color: C.red, fontWeight: 600 }}>⚠ {badCount} unmatched</span>}
                    {pendingCount > 0  && <span style={{ padding: "2px 8px", borderRadius: 10, background: C.bg, color: C.muted, fontWeight: 600 }}>⏳ {pendingCount} SOP pending</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {pkgs.map(function(p) {
                      return <span key={p.name} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: p.existing ? C.amberBg : C.greenBg, color: p.existing ? C.amber : C.green, fontWeight: 600 }}>
                        {p.name} · {p.rowCount} {T2("rows")} · {p.existing ? T2("REPLACES existing") : T2("new")}
                      </span>;
                    })}
                  </div>
                  <div style={{ border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden", fontSize: 11, maxHeight: 300, overflowY: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr 0.6fr 1fr 0.8fr", padding: "6px 8px", background: C.bg, color: C.muted, fontWeight: 700, position: "sticky", top: 0 }}>
                      <div>{T2("Package")}</div><div>{T2("Section")}</div><div>{T2("Dish")}</div><div>{T2("Type")}</div><div>{T2("Ops match")}</div><div>{T2("Status")}</div>
                    </div>
                    {csvRows.slice(0, 100).map(function(r, i) {
                      var statusColor = r.status === 'ok' ? C.green : r.status === 'fuzzy' ? C.amber : r.status === 'pending' ? C.muted : C.red;
                      return (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr 0.6fr 1fr 0.8fr", padding: "6px 8px", borderTop: "1px solid " + C.borderLight, color: C.text }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.package}</div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.section}</div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.dish}{r.hindi && <span style={{ color: C.faint, marginLeft: 4 }}>· {r.hindi}</span>}</div>
                          <div>{r.type || <span style={{ color: C.faint }}>—</span>}</div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: r.opsMatch ? C.green : C.faint }}>
                            {r.opsMatch ? r.opsMatch.name : (r.ops_item || '—')}{r.qty ? ' · ' + r.qty : ''}
                          </div>
                          <div style={{ color: statusColor, fontWeight: 600 }} title={r.note}>{r.status}</div>
                        </div>
                      );
                    })}
                    {csvRows.length > 100 && (
                      <div style={{ padding: "6px 8px", borderTop: "1px solid " + C.borderLight, textAlign: "center", color: C.faint, fontSize: 10 }}>+ {csvRows.length - 100} {T2("more rows (not shown)")}</div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid " + C.border }}>
              <button onClick={closeCsvImport} disabled={csvSaving}
                style={{ padding: "8px 16px", borderRadius: 6, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 12, fontWeight: 600, cursor: csvSaving ? "not-allowed" : "pointer" }}>{T2("Cancel")}</button>
              <button onClick={commitCsvImport} disabled={csvSaving || csvRows.length === 0}
                style={{ padding: "8px 16px", borderRadius: 6, background: C.wine, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: (csvSaving || csvRows.length === 0) ? "not-allowed" : "pointer", opacity: (csvSaving || csvRows.length === 0) ? 0.5 : 1 }}>
                {csvSaving ? T2("Importing…") : T2("Import ") + csvRows.length + T2(" rows")}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export { MenuPackagesView };