// Ambria FnB — Menu & Packages View
// Two tabs: Build Menu (assign menus to functions) + Packages (view/edit standard packages)
// Place in: src/components/MenuPackagesView.jsx
import React, { useState } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES, MENU_PACKAGE_NAMES, DISH_GROUPS } from '../data/menuPackages.js';
import { getSectionForDish, getCatIdForDish, RECIPE_DB, findRecipeForDish, DISH_NAME_MAP, DISH_HINDI_MAP, resolveDishHindi, upsertDishCat, getAllDishes, upsertDishMaster, deactivateDish } from '../data/recipeData.js';
import { TODAY, TOMORROW, safeArr } from '../utils/helpers.js';
import { Card } from './SharedUI.jsx';
import { supabase } from '../lib/supabase.js';
import { MenuEditor } from './MenuEditor.jsx';
import DishLibrary from './DishLibrary.jsx';

function MenuPackagesView({ lang = "en", currentUser = null, events = [], setEvents }) {
  var T2 = function(s) { return T(s, lang); };
  var isAdmin = currentUser?.role === "admin" || currentUser?.role === "headchef";
  var [mainTab, setMainTab] = useState("events"); // "events" | "packages"

  // ════════════════════════════════════════════════════════════
  // BUILD MENU TAB STATE
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
  // PACKAGES TAB STATE (original MenuPackagesView)
  // ════════════════════════════════════════════════════════════
  var pkgNames = Object.keys(MENU_PACKAGES);
  var [selPkg, setSelPkg] = useState(null);
  var [openSections, setOpenSections] = useState({});
  var [editMode, setEditMode] = useState(false);
  var [selected, setSelected] = useState({});
  var [targetSec, setTargetSec] = useState("");
  var [saving, setSaving] = useState(false);
  var [showNewCat, setShowNewCat] = useState(false);
  var [newCatName, setNewCatName] = useState("");
  var [newCatIcon, setNewCatIcon] = useState("🍽");
  var [customCats, setCustomCats] = useState([]);
  var [dishEditMode, setDishEditMode] = useState(false);
  var [editSections, setEditSections] = useState({});
  var [editGroups, setEditGroups] = useState({});
  var [dishSaving, setDishSaving] = useState(false);
  var [addSecVal, setAddSecVal] = useState("");
  var [addGrpSec, setAddGrpSec] = useState("");
  var [addGrpName, setAddGrpName] = useState("");
  var [mapDropOpen, setMapDropOpen] = useState(null);
  var [mapSearch, setMapSearch] = useState("");
  var [quickAddSec, setQuickAddSec] = useState(null);
  var [quickAddVal, setQuickAddVal] = useState("");
  var [quickAddSaving, setQuickAddSaving] = useState(false);
  var [refreshTick, setRefreshTick] = useState(0);

  var allSections = (RECIPE_DB.cats || []).map(function(c) { return c.name; }).sort();

  function toggleSection(sec) { setOpenSections(function(p) { return { ...p, [sec]: !p[sec] }; }); }
  function toggleDish(d) { setSelected(function(p) { return { ...p, [d]: !p[d] }; }); }
  function selectAllInSec(dishes) {
    var all = dishes.every(function(d) { return selected[d]; });
    var upd = { ...selected };
    dishes.forEach(function(d) { upd[d] = !all; });
    setSelected(upd);
  }
  var selCount = Object.values(selected).filter(Boolean).length;

  function secToCatId(secName) {
    var dbCat = (RECIPE_DB.cats || []).find(function(c) { return c.name === secName; });
    if (dbCat) return dbCat.id;
    return secName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
  }

  async function createCategory() {
    if (!newCatName.trim()) return;
    var catId = newCatName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
    setSaving(true);
    try {
      var res = await supabase.from('recipe_categories').insert({
        id: catId, name: newCatName.trim(), icon: newCatIcon || '🍽',
        sort_order: (RECIPE_DB.cats || []).length + 1
      });
      if (res.error && res.error.code !== '23505') throw res.error;
      setCustomCats(function(prev) { return [...prev, newCatName.trim()]; });
      setTargetSec(newCatName.trim());
      setShowNewCat(false);
      setNewCatName("");
      setNewCatIcon("🍽");
    } catch (e) {
      alert('Error creating category: ' + e.message);
    }
    setSaving(false);
  }

  async function moveSelected() {
    if (!targetSec || selCount === 0) return;
    setSaving(true);
    var catId = secToCatId(targetSec);
    var dishNames = Object.keys(selected).filter(function(k) { return selected[k]; });
    try {
      for (var i = 0; i < dishNames.length; i++) {
        await supabase.from('dish_categories').upsert(
          { dish_name: dishNames[i], category_id: catId },
          { onConflict: 'dish_name' }
        );
      }
      alert('Moved ' + dishNames.length + ' dish' + (dishNames.length > 1 ? 'es' : '') + ' to ' + targetSec);
      setSelected({});
      setEditMode(false);
      try {
        localStorage.removeItem('ambria_cfg_recipes');
        localStorage.removeItem('ambria_cfg_recipe_categories');
        localStorage.removeItem('ambria_cfg_menu_packages');
        localStorage.removeItem('ambria_cfg_dish_categories');
      } catch (e) { }
      window.location.reload();
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setSaving(false);
  }

  // ─── Dish editing + SOP mapping helpers ───
  var allRecipes = (RECIPE_DB.cats || []).flatMap(function(cat) {
    return (RECIPE_DB.recipes[cat.id] || []).map(function(r) {
      var dn = r.n.indexOf('/') > -1 ? r.n.split('/')[0].trim() : r.n;
      return { name: r.n, display: dn, catName: cat.name, catIcon: cat.icon };
    });
  });
  function isSplittable(dish) {
    if (!dish) return false;
    var pm = dish.match(/^(.+?)\s*\((.+)\)\s*$/);
    if (pm && pm[2].includes('/')) return true;
    return (dish.match(/\//g) || []).length >= 1;
  }
  function normDishItem(it) {
    if (typeof it === 'string') return { en: it, hi: '' };
    return { en: (it && it.en) || '', hi: (it && it.hi) || '' };
  }
  function cloneES(obj) {
    var out = {}; Object.keys(obj).forEach(function(k) { out[k] = (obj[k]||[]).map(normDishItem); }); return out;
  }
  function cloneEG(obj) {
    var out = {}; Object.keys(obj).forEach(function(k) { out[k] = { section: obj[k].section, items: (obj[k].items||[]).map(normDishItem) }; }); return out;
  }
  function enterDishEdit() {
    var pkgGroups = DISH_GROUPS[selPkg] || {};
    var groupedSet = {};
    Object.values(pkgGroups).forEach(function(items) { (items||[]).forEach(function(d) { groupedSet[d] = true; }); });
    var wrap = function(d) { return { en: d, hi: resolveDishHindi(d) || '' }; };
    var bySec = {}; var missing = [];
    (MENU_PACKAGES[selPkg] || []).forEach(function(d) {
      if (groupedSet[d]) return;
      var sec = getSectionForDish(d);
      if (!bySec[sec]) bySec[sec] = [];
      var w = wrap(d); if (!w.hi) missing.push(d);
      bySec[sec].push(w);
    });
    setEditSections(bySec);
    var eg = {};
    Object.entries(pkgGroups).forEach(function(entry) {
      var items = entry[1] || [];
      var sec = items.length > 0 ? getSectionForDish(items[0]) : "Other";
      eg[entry[0]] = { section: sec, items: items.map(function(d) { var w = wrap(d); if (!w.hi) missing.push(d); return w; }) };
    });
    setEditGroups(eg);
    if (missing.length) console.log('[dishHindi] no auto-fill for:', missing);
    setDishEditMode(true); setEditMode(false); setSelected({}); setAddSecVal(""); setAddGrpSec(""); setAddGrpName("");
    setSectionRenames({}); setSecOrder([]); setSecMenuOpen(null);
    var firstSec = Object.keys(bySec).filter(function(s) { return s !== 'Beverages'; }).sort()[0] || '';
    setActiveLibrarySection(firstSec);
  }
  function cancelDishEdit() { setDishEditMode(false); setEditSections({}); setEditGroups({}); setSectionRenames({}); setSecOrder([]); setSecMenuOpen(null); }
  function renameDishInSec(sec, idx, field, val) {
    var upd = cloneES(editSections); upd[sec][idx] = { ...upd[sec][idx], [field]: val }; setEditSections(upd);
  }
  function autofillDishHiInSec(sec, idx) {
    var cur = (editSections[sec] || [])[idx]; if (!cur || !cur.en || cur.hi) return;
    var hi = resolveDishHindi(cur.en); if (!hi) return;
    var upd = cloneES(editSections); upd[sec][idx] = { ...upd[sec][idx], hi: hi }; setEditSections(upd);
  }
  function deleteDishInSec(sec, idx) {
    var upd = cloneES(editSections);
    upd[sec] = upd[sec].filter(function(_, i) { return i !== idx; });
    if (upd[sec].length === 0) delete upd[sec];
    setEditSections(upd);
  }
  function addDishInSec(sec) {
    var upd = cloneES(editSections); if (!upd[sec]) upd[sec] = []; upd[sec].push({ en: "", hi: "" }); setEditSections(upd);
  }
  function addNamedDishInSec(name, sec) {
    if (!name || !sec) return;
    var upd = cloneES(editSections); if (!upd[sec]) upd[sec] = [];
    var hi = ''; try { hi = resolveDishHindi(name) || ''; } catch(e) {}
    upd[sec].push({ en: name, hi: hi }); setEditSections(upd);
  }
  var [activeLibrarySection, setActiveLibrarySection] = useState('');
  var [libRefreshKey, setLibRefreshKey]               = useState(0);
  var [secMenuOpen, setSecMenuOpen]                   = useState(null);
  var [sectionRenames, setSectionRenames]             = useState({});
  var [secOrder, setSecOrder]                         = useState([]);
  var [duplicating, setDuplicating]                   = useState(false);
  function splitDishInSec(sec, idx) {
    var dishObj = editSections[sec][idx]; var dish = (dishObj && dishObj.en) || '';
    var parts = []; var label = '';
    var pm = dish.match(/^(.+?)\s*\((.+)\)\s*$/);
    if (pm) { label = pm[1].trim(); parts = pm[2].split('/').map(function(s) { return s.trim(); }).filter(Boolean); }
    else if (dish.includes('/')) { parts = dish.split('/').map(function(s) { return s.trim(); }).filter(Boolean); }
    if (parts.length < 2) return;
    var partsObj = parts.map(function(p) { return { en: p, hi: resolveDishHindi(p) || '' }; });
    var updSec = cloneES(editSections); updSec[sec].splice(idx, 1);
    if (label) {
      var updGrp = cloneEG(editGroups);
      updGrp[label] = { section: sec, items: partsObj };
      setEditGroups(updGrp);
    } else {
      for (var i = partsObj.length - 1; i >= 0; i--) updSec[sec].splice(idx, 0, partsObj[i]);
    }
    setEditSections(updSec);
  }
  function renameDishInGrp(grp, idx, field, val) {
    var upd = cloneEG(editGroups); upd[grp].items[idx] = { ...upd[grp].items[idx], [field]: val }; setEditGroups(upd);
  }
  function autofillDishHiInGrp(grp, idx) {
    var cur = (editGroups[grp] && editGroups[grp].items || [])[idx]; if (!cur || !cur.en || cur.hi) return;
    var hi = resolveDishHindi(cur.en); if (!hi) return;
    var upd = cloneEG(editGroups); upd[grp].items[idx] = { ...upd[grp].items[idx], hi: hi }; setEditGroups(upd);
  }
  function deleteDishInGrp(grp, idx) {
    var upd = cloneEG(editGroups); upd[grp].items = upd[grp].items.filter(function(_, i) { return i !== idx; });
    if (upd[grp].items.length === 0) delete upd[grp];
    setEditGroups(upd);
  }
  function addDishToGrp(grp) {
    var upd = cloneEG(editGroups); upd[grp].items.push({ en: "", hi: "" }); setEditGroups(upd);
  }
  function deleteGroup(grp) {
    var g = editGroups[grp]; if (!g) return;
    var updSec = cloneES(editSections);
    if (!updSec[g.section]) updSec[g.section] = [];
    g.items.forEach(function(d) { var en = (d && d.en) ? d.en.trim() : ''; if (en) updSec[g.section].push({ en: en, hi: (d && d.hi) || '' }); });
    setEditSections(updSec);
    var updGrp = cloneEG(editGroups); delete updGrp[grp]; setEditGroups(updGrp);
  }
  function createGroup(sec) {
    if (!addGrpName.trim()) return;
    var upd = cloneEG(editGroups);
    upd[addGrpName.trim()] = { section: sec, items: [{ en: "", hi: "" }] };
    setEditGroups(upd); setAddGrpName(""); setAddGrpSec("");
  }
  var editDishTotal = Object.values(editSections).reduce(function(s, a) { return s + a.length; }, 0)
    + Object.values(editGroups).reduce(function(s, g) { return s + (g.items||[]).length; }, 0);
  var editSecNames = Object.keys(editSections).concat(
    Object.values(editGroups).map(function(g) { return g.section; })
  ).filter(function(v, i, a) { return a.indexOf(v) === i; });
  if (secOrder && secOrder.length) {
    editSecNames.sort(function(a, b) {
      var ai = secOrder.indexOf(a); if (ai < 0) ai = 999;
      var bi = secOrder.indexOf(b); if (bi < 0) bi = 999;
      return ai !== bi ? ai - bi : a.localeCompare(b);
    });
  } else {
    editSecNames.sort();
  }
  async function saveDishes() {
    setDishSaving(true);
    try {
      var origSet = {};
      (MENU_PACKAGES[selPkg] || []).forEach(function(d) { origSet[d] = true; });
      var filtered = [];
      var hindiRows = [];
      var pushDish = function(obj) {
        var en = (obj && obj.en) ? obj.en.trim() : '';
        var hi = (obj && obj.hi) ? obj.hi.trim() : '';
        if (!en) return;
        filtered.push(en);
        if (hi) hindiRows.push({ dish_name: en, hi: hi });
      };
      editSecNames.forEach(function(sec) {
        (editSections[sec] || []).forEach(pushDish);
        Object.entries(editGroups).forEach(function(ge) {
          if (ge[1].section === sec) (ge[1].items||[]).forEach(pushDish);
        });
      });
      var dg = {};
      Object.entries(editGroups).forEach(function(ge) {
        var items = (ge[1].items||[]).map(function(d) { return (d && d.en) ? d.en.trim() : ''; }).filter(Boolean);
        if (items.length > 0) dg[ge[0]] = items;
      });
      var res = await supabase.from('menu_packages').update({ dishes: filtered, dish_groups: dg }).eq('name', selPkg);
      if (res.error) throw res.error;
      MENU_PACKAGES[selPkg] = filtered;
      DISH_GROUPS[selPkg] = dg;
      // Upsert Hindi overrides in one batch
      if (hindiRows.length > 0) {
        var resHi = await supabase.from('dish_hindi_map').upsert(hindiRows, { onConflict: 'dish_name' });
        if (resHi.error) throw resHi.error;
        hindiRows.forEach(function(r) { DISH_HINDI_MAP[r.dish_name] = r.hi; });
      }
      for (var si = 0; si < editSecNames.length; si++) {
        var sec = editSecNames[si]; var catId = secToCatId(sec);
        var allInSec = [].concat(editSections[sec] || []);
        Object.entries(editGroups).forEach(function(ge) { if (ge[1].section === sec) allInSec = allInSec.concat(ge[1].items||[]); });
        for (var di = 0; di < allInSec.length; di++) {
          var d = (allInSec[di] && allInSec[di].en) ? allInSec[di].en.trim() : '';
          if (!d) continue;
          // Fire whenever placed section differs from currently-resolved category —
          // not just for new dishes — so cross-section moves stick.
          var currentCat = getCatIdForDish(d);
          if (!origSet[d] || currentCat !== catId) {
            await supabase.from('dish_categories').upsert({ dish_name: d, category_id: catId }, { onConflict: 'dish_name' });
            upsertDishCat(d, catId);
          }
        }
      }
      // Apply section renames (recipe_categories.name update — cascade via id, no dish_categories update needed)
      var renamePairs = Object.keys(sectionRenames).filter(function(oldN) { var v = (sectionRenames[oldN]||'').trim(); return v && v !== oldN; });
      for (var ri = 0; ri < renamePairs.length; ri++) {
        var oldN = renamePairs[ri]; var newN = sectionRenames[oldN].trim();
        var cat = (RECIPE_DB.cats || []).find(function(c) { return c.name === oldN; });
        if (cat) {
          var resR = await supabase.from('recipe_categories').update({ name: newN }).eq('id', cat.id);
          if (resR.error) throw resR.error;
          cat.name = newN;
        }
      }
      if (renamePairs.length) { try { localStorage.removeItem('ambria_cfg_recipe_categories'); } catch(e3) {} }
      try { localStorage.removeItem('ambria_cfg_menu_packages'); localStorage.removeItem('ambria_cfg_dish_categories'); localStorage.removeItem('ambria_cfg_dish_hindi_map'); } catch(e2) {}
      setDishEditMode(false); setEditSections({}); setEditGroups({});
      setSectionRenames({}); setSecOrder([]); setSecMenuOpen(null);
    } catch(e) { alert('Error saving dishes: ' + e.message); }
    setDishSaving(false);
  }
  function getMappingStatus(dish) {
    if (!dish) return { status: 'unmapped', recipe: null };
    var dn = dish.toLowerCase().trim();
    var mapKey = Object.keys(DISH_NAME_MAP).find(function(k) { return k.toLowerCase().trim() === dn; });
    if (mapKey && DISH_NAME_MAP[mapKey] === '__none__') return { status: 'unmapped', recipe: null };
    if (mapKey) return { status: 'mapped', recipe: DISH_NAME_MAP[mapKey] };
    var recipe = findRecipeForDish(dish);
    if (recipe) return { status: 'auto', recipe: recipe.n };
    return { status: 'unmapped', recipe: null };
  }
  async function quickAddDish(sec) {
    var name = quickAddVal.trim();
    if (!name) return;
    var current = (MENU_PACKAGES[selPkg] || []).slice();
    if (current.some(function(d) { return d.toLowerCase() === name.toLowerCase(); })) {
      alert('"' + name + '" already exists in this package.');
      return;
    }
    setQuickAddSaving(true);
    try {
      var next = current.concat([name]);
      var res = await supabase.from('menu_packages').update({ dishes: next }).eq('name', selPkg);
      if (res.error) throw res.error;
      var catId = secToCatId(sec);
      if (catId) {
        await supabase.from('dish_categories').upsert({ dish_name: name, category_id: catId }, { onConflict: 'dish_name' });
        upsertDishCat(name, catId);
      }
      MENU_PACKAGES[selPkg] = next;
      try { localStorage.removeItem('ambria_cfg_menu_packages'); localStorage.removeItem('ambria_cfg_dish_categories'); } catch(e2) {}
      setQuickAddVal("");
      setQuickAddSec(null);
      setRefreshTick(function(t) { return t + 1; });
    } catch(e) {
      alert('Error adding dish: ' + e.message);
    }
    setQuickAddSaving(false);
  }
  async function saveOneMapping(lmsName, recipeName) {
    try {
      var res = await supabase.from('dish_name_map').upsert({ lms_name: lmsName, recipe_dish_name: recipeName }, { onConflict: 'lms_name' });
      if (res.error) throw res.error;
      DISH_NAME_MAP[lmsName] = recipeName;
    } catch(e) { alert('Error saving mapping: ' + e.message); }
    setMapDropOpen(null); setMapSearch("");
  }
  async function removeMapping(lmsName) {
    try {
      var ms = getMappingStatus(lmsName);
      if (ms.status === 'auto') {
        await supabase.from('dish_name_map').upsert({ lms_name: lmsName, recipe_dish_name: '__none__' }, { onConflict: 'lms_name' });
        DISH_NAME_MAP[lmsName] = '__none__';
      } else {
        await supabase.from('dish_name_map').delete().eq('lms_name', lmsName); delete DISH_NAME_MAP[lmsName];
      }
    } catch(e) { alert('Error removing: ' + e.message); }
  }

  function deleteSectionInEdit(sec) {
    var count = (editSections[sec] || []).length + Object.values(editGroups).filter(function(g) { return g.section === sec; }).reduce(function(s, g) { return s + (g.items||[]).length; }, 0);
    if (count > 0 && !window.confirm('Delete section "' + sec + '" and its ' + count + ' dishes?')) return;
    var upd = cloneES(editSections); delete upd[sec]; setEditSections(upd);
    var updG = cloneEG(editGroups); Object.keys(updG).forEach(function(k) { if (updG[k].section === sec) delete updG[k]; }); setEditGroups(updG);
    if (activeLibrarySection === sec) {
      var next = Object.keys(upd).filter(function(s) { return s !== 'Beverages'; }).sort()[0] || '';
      setActiveLibrarySection(next);
    }
    setSecMenuOpen(null);
  }
  function moveSectionInEdit(sec, dir) {
    // Compute current ordered list (respecting secOrder)
    var base = Object.keys(editSections).concat(
      Object.values(editGroups).map(function(g) { return g.section; })
    ).filter(function(v, i, a) { return a.indexOf(v) === i; });
    if (secOrder.length) base.sort(function(a, b) {
      var ai = secOrder.indexOf(a); if (ai < 0) ai = 999;
      var bi = secOrder.indexOf(b); if (bi < 0) bi = 999;
      return ai !== bi ? ai - bi : a.localeCompare(b);
    }); else base.sort();
    var idx = base.indexOf(sec); var swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= base.length) return;
    var tmp = base[idx]; base[idx] = base[swap]; base[swap] = tmp;
    setSecOrder(base); setSecMenuOpen(null);
  }
  async function duplicatePackage() {
    var proposed = window.prompt('Name for the copy of "' + selPkg + '":', selPkg + ' (Copy)');
    if (!proposed || !proposed.trim()) return;
    var newName = proposed.trim();
    if (MENU_PACKAGES[newName]) { alert('A package with that name already exists.'); return; }
    setDuplicating(true);
    try {
      var dishes = (MENU_PACKAGES[selPkg] || []).slice();
      var dg = DISH_GROUPS[selPkg] || {};
      var res = await supabase.from('menu_packages').insert({ name: newName, dishes: dishes, dish_groups: dg, is_active: true });
      if (res.error) throw res.error;
      MENU_PACKAGES[newName] = dishes;
      DISH_GROUPS[newName] = dg;
      try { localStorage.removeItem('ambria_cfg_menu_packages'); } catch(e) {}
      alert('Duplicated as "' + newName + '". Reload to see it in the package list.');
    } catch(e) { alert('Duplicate failed: ' + e.message); }
    setDuplicating(false);
  }

  var PKG_META = {
    "Multi-Cuisine Veg": { icon: "🌱", c: "#4DAA6A", bg: C.greenBg },
    "Multi-Cuisine Non-Veg": { icon: "🍗", c: "#D06040", bg: C.redBg },
    "Magnum Veg": { icon: "⭐", c: "#D4A843", bg: C.goldBg },
    "Magnum Non-Veg": { icon: "🌟", c: "#D06040", bg: C.redBg },
    "Double Magnum Veg": { icon: "🏆", c: "#50B0A0", bg: C.tealBg },
    "Double Magnum Non-Veg": { icon: "🏅", c: "#5B8FD0", bg: C.blueBg },
    "Luxury Veg": { icon: "👑", c: "#8A70C8", bg: C.purpleBg },
    "Luxury Non-Veg": { icon: "💎", c: "#5B8FD0", bg: C.blueBg },
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  var TABS = [
    { v: "events", l: "📋 " + T2("Build Menu") },
    { v: "packages", l: "📦 " + T2("Packages") },
  ];

  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>🍽 {T2("Menu")}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{allEvs.length} {T2("upcoming functions")}</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid " + C.border, paddingBottom: 8, marginTop: 12 }}>
        {TABS.map(function(t) {
          return <button key={t.v} onClick={function() { setMainTab(t.v); setSelPkg(null); setSelEvId(null); setEditMode(false); setSelected({}); }}
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
      {/* PACKAGES TAB (original MenuPackagesView)                */}
      {/* ════════════════════════════════════════════════════════ */}
      {mainTab === "packages" && !selPkg && (
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{pkgNames.length} {T2("packages")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
            {pkgNames.map(function(pkg) {
              var m = PKG_META[pkg] || { icon: "📋", c: C.gold, bg: C.goldBg };
              var items = MENU_PACKAGES[pkg] || [];
              return (
                <button key={pkg} onClick={function() { setSelPkg(pkg); setEditMode(false); setSelected({}); }}
                  style={{ background: C.surface, border: "2px solid " + m.c + "30", borderRadius: 16, padding: "20px 18px", cursor: "pointer", textAlign: "left", display: "flex", gap: 14, alignItems: "center", minHeight: 80 }}>
                  <div style={{ fontSize: 32, flexShrink: 0 }}>{m.icon}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{pkg}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{items.length} {T2("dishes")}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mainTab === "packages" && selPkg && (function() {
        var allDishes = MENU_PACKAGES[selPkg] || [];
        var bySection = {};
        allDishes.forEach(function(d) {
          var sec = getSectionForDish(d);
          if (!bySection[sec]) bySection[sec] = [];
          bySection[sec].push(d);
        });
        var pm = PKG_META[selPkg] || { icon: "📋", c: C.gold, bg: C.goldBg };
        var nonBevDishes = allDishes.filter(function(d) { return getSectionForDish(d) !== "Beverages"; });

        return (
          <div>
            {/* Header */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={function() { setSelPkg(null); setEditMode(false); setDishEditMode(false); setEditSections({}); setEditGroups({}); setSelected({}); setMapDropOpen(null); }} style={{ padding: "10px 18px", borderRadius: 10, background: C.bg, border: "1px solid " + C.border, color: C.muted, fontSize: 12, cursor: "pointer", minHeight: 44 }}>← {T2("All Packages")}</button>
              {isAdmin && !editMode && !dishEditMode && (
                <React.Fragment>
                  <button onClick={function() { setEditMode(true); }} style={{ padding: "10px 18px", borderRadius: 10, background: C.amberBg, border: "1px solid " + C.amberBorder, color: C.amber, fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>✏️ Edit Categories</button>
                  <button onClick={enterDishEdit} style={{ padding: "10px 18px", borderRadius: 10, background: C.blueBg, border: "1px solid " + C.blueBorder, color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>✏️ Edit Dishes</button>
                </React.Fragment>
              )}
              {editMode && (
                <button onClick={function() { setEditMode(false); setSelected({}); }} style={{ padding: "10px 18px", borderRadius: 10, background: C.redBg, border: "1px solid " + C.redBorder, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>✕ Cancel</button>
              )}
              
            </div>

            {!dishEditMode && (
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: editMode ? 12 : 20 }}>
                <div style={{ fontSize: 40 }}>{pm.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>{selPkg}</div>
                  <div style={{ fontSize: 13, color: pm.c, marginTop: 3 }}>{nonBevDishes.length} {T2("dishes")} · {Object.keys(bySection).filter(function(s) { return s !== "Beverages"; }).length} {T2("sections")}</div>
                </div>
              </div>
            )}

            {/* Bulk Move Bar */}
            {editMode && (
              <div style={{ position: "sticky", top: 0, zIndex: 20, background: C.amberBg, border: "1.5px solid " + C.amberBorder, borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.amber }}>{selCount} selected</span>
                  <select value={targetSec} onChange={function(e) {
                    if (e.target.value === "__new__") { setShowNewCat(true); setTargetSec(""); }
                    else { setTargetSec(e.target.value); setShowNewCat(false); }
                  }}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 12, background: C.surface, minWidth: 140 }}>
                    <option value="">Move to…</option>
                    {allSections.map(function(s) {
                      var cat = (RECIPE_DB.cats || []).find(function(c) { return c.name === s; });
                      return <option key={s} value={s}>{cat ? cat.icon : "🍽"} {s}</option>;
                    })}
                    <option value="__new__">＋ New Section…</option>
                  </select>
                  <button onClick={moveSelected} disabled={!targetSec || selCount === 0 || saving}
                    style={{ padding: "8px 16px", borderRadius: 8, background: selCount > 0 && targetSec ? C.green : C.faint, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: selCount > 0 && targetSec ? "pointer" : "not-allowed", opacity: saving ? 0.5 : 1 }}>
                    {saving ? "Saving…" : "Move " + selCount + " →"}
                  </button>
                </div>
                {showNewCat && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                    <input value={newCatIcon} onChange={function(e) { setNewCatIcon(e.target.value); }} placeholder="🍽"
                      style={{ width: 40, padding: "6px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 16, textAlign: "center", background: C.surface }} maxLength={2} />
                    <input value={newCatName} onChange={function(e) { setNewCatName(e.target.value); }} placeholder="Section name e.g. Continental"
                      style={{ flex: 1, minWidth: 160, padding: "6px 10px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 12, background: C.surface }}
                      onKeyDown={function(e) { if (e.key === 'Enter') createCategory(); }} />
                    <button onClick={createCategory} disabled={!newCatName.trim() || saving}
                      style={{ padding: "6px 14px", borderRadius: 8, background: newCatName.trim() ? C.green : C.faint, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: newCatName.trim() ? "pointer" : "not-allowed" }}>
                      {saving ? "…" : "Create"}
                    </button>
                    <button onClick={function() { setShowNewCat(false); setNewCatName(""); }}
                      style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                  </div>
                )}
              </div>
            )}

            {/* ── Dish Edit Mode — section-grouped with groups ── */}
            {dishEditMode && (function() {
              var secGroupsFor = function(sec) {
                return Object.entries(editGroups).filter(function(e) { return e[1].section === sec; });
              };
              var secTotal = function(sec) {
                var n = (editSections[sec]||[]).length;
                secGroupsFor(sec).forEach(function(e) { n += (e[1].items||[]).length; });
                return n;
              };
              var libSectionOptions = editSecNames.filter(function(s) { return s !== "Beverages"; });
              var existingInActive  = new Set(((editSections[activeLibrarySection] || []).map(function(d) { return (d && d.en) || ''; }).filter(Boolean)));
              var visibleSecNames   = editSecNames.filter(function(s) { return s !== "Beverages"; });
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  {/* Package header card */}
                  <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 30, flexShrink: 0 }}>{pm.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{selPkg}</div>
                      <div style={{ fontSize: 11, color: pm.c, marginTop: 2 }}>{editDishTotal} {T2("dishes")} · {visibleSecNames.length} {T2("sections")}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                      <button onClick={duplicatePackage} disabled={duplicating || dishSaving} style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 11, cursor: duplicating ? "wait" : "pointer" }}>{duplicating ? "…" : "⧉ Duplicate"}</button>
                      <button onClick={cancelDishEdit} disabled={dishSaving} style={{ padding: "6px 10px", borderRadius: 8, background: C.redBg, border: "1px solid " + C.redBorder, color: C.red, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✕ Cancel</button>
                      <button onClick={saveDishes} disabled={dishSaving} style={{ padding: "6px 14px", borderRadius: 8, background: C.green, border: "none", color: "#fff", fontSize: 11, fontWeight: 600, cursor: dishSaving ? "not-allowed" : "pointer", opacity: dishSaving ? 0.6 : 1 }}>{dishSaving ? "Saving…" : "💾 Save"}</button>
                    </div>
                  </div>

                  {visibleSecNames.map(function(sec) {
                    var secDishes = editSections[sec] || [];
                    var secGrps = secGroupsFor(sec);
                    var cat = (RECIPE_DB.cats || []).find(function(c) { return c.name === sec; });
                    var em = { color: cat?.color || C.muted, icon: cat?.icon || "🍽" };
                    var isActive = activeLibrarySection === sec;
                    var displayName = sectionRenames[sec] !== undefined ? sectionRenames[sec] : sec;
                    var menuIdx = visibleSecNames.indexOf(sec);
                    return (
                      <div key={sec} style={{ marginBottom: 8, border: (isActive ? "2px" : "1px") + " solid " + (isActive ? C.green : C.border), borderRadius: 12, overflow: "visible", background: C.surface, boxShadow: isActive ? "0 0 0 3px " + C.greenBg : "none", position: "relative" }}>
                        <div onClick={function() { if (!isActive) setActiveLibrarySection(sec); }}
                          style={{ padding: "10px 14px", background: em.color + "15", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: isActive ? "default" : "pointer", borderRadius: "10px 10px 0 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 14, flexShrink: 0 }}>{em.icon}</span>
                            <input value={displayName}
                              onChange={function(e) { setSectionRenames({...sectionRenames, [sec]: e.target.value}); }}
                              onClick={function(e) { e.stopPropagation(); }}
                              style={{ fontSize: 13, fontWeight: 500, color: em.color, border: "1px solid transparent", background: "transparent", padding: "2px 4px", borderRadius: 4, minWidth: 0, flex: 1, outline: "none" }}
                              onFocus={function(e) { e.target.style.border = "1px solid " + C.border; e.target.style.background = C.surface; }}
                              onBlur={function(e) { e.target.style.border = "1px solid transparent"; e.target.style.background = "transparent"; }} />
                            <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>({secTotal(sec)})</span>
                            {isActive && <span style={{ fontSize: 9, color: C.green, background: C.greenBg, padding: "2px 6px", borderRadius: 4, fontWeight: 600, letterSpacing: 0.4, flexShrink: 0 }}>ACTIVE</span>}
                          </div>
                          <button onClick={function(e) { e.stopPropagation(); setSecMenuOpen(secMenuOpen === sec ? null : sec); }}
                            style={{ width: 24, height: 24, border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>⋯</button>
                          {secMenuOpen === sec && (
                            <div style={{ position: "absolute", right: 8, top: 40, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", zIndex: 10, minWidth: 140 }}>
                              <div onClick={function(e) { e.stopPropagation(); moveSectionInEdit(sec, -1); }} style={{ padding: "8px 12px", fontSize: 12, cursor: menuIdx > 0 ? "pointer" : "not-allowed", color: menuIdx > 0 ? C.text : C.faint, borderBottom: "1px solid " + C.borderLight }}>↑ Move up</div>
                              <div onClick={function(e) { e.stopPropagation(); moveSectionInEdit(sec, 1); }} style={{ padding: "8px 12px", fontSize: 12, cursor: menuIdx < visibleSecNames.length - 1 ? "pointer" : "not-allowed", color: menuIdx < visibleSecNames.length - 1 ? C.text : C.faint, borderBottom: "1px solid " + C.borderLight }}>↓ Move down</div>
                              <div onClick={function(e) { e.stopPropagation(); deleteSectionInEdit(sec); }} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", color: C.red }}>🗑 Delete section</div>
                            </div>
                          )}
                        </div>
                        {!isActive && (secDishes.length > 0 || secGrps.length > 0) && (
                          <div onClick={function() { setActiveLibrarySection(sec); }} style={{ padding: "6px 14px 10px", cursor: "pointer" }}>
                            <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {secDishes.map(function(d) { return (d && d.en) || ''; }).filter(Boolean).concat(secGrps.flatMap(function(g) { return (g[1].items||[]).map(function(gi) { return (gi && gi.en) || ''; }); }).filter(Boolean)).join(" · ")}
                            </div>
                          </div>
                        )}
                        {isActive && (
                        <div style={{ padding: "6px 12px 10px" }}>
                          {secDishes.map(function(d, i) {
                            var enVal = (d && d.en) || ''; var hiVal = (d && d.hi) || '';
                            return (
                              <div key={'d-'+i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: "1px solid " + C.borderLight }}>
                                <input value={enVal} onChange={function(e) { renameDishInSec(sec, i, 'en', e.target.value); }}
                                  onBlur={function() { autofillDishHiInSec(sec, i); }}
                                  style={{ flex: 1.3, minWidth: 0, padding: "5px 8px", borderRadius: 6, border: "1px solid " + C.border, fontSize: 12, background: C.surface, color: C.text }} placeholder="Dish name" />
                                <input value={hiVal} onChange={function(e) { renameDishInSec(sec, i, 'hi', e.target.value); }}
                                  lang="hi"
                                  style={{ flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: 6, border: "1px solid " + (hiVal ? C.border : C.borderLight), fontSize: 12, background: hiVal ? C.surface : C.bg, color: C.text }} placeholder="हिन्दी नाम" />
                                {isSplittable(enVal) && (
                                  <button onClick={function() { splitDishInSec(sec, i); }} style={{ padding: "3px 8px", borderRadius: 6, background: C.purpleBg, border: "1px solid " + C.purpleBorder, color: C.purple, fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>✂ Split</button>
                                )}
                                <button onClick={function() { deleteDishInSec(sec, i); }} onMouseEnter={function(e) { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = C.redBg; e.currentTarget.style.borderColor = C.redBorder; }} onMouseLeave={function(e) { e.currentTarget.style.opacity = 0.35; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }} style={{ width: 22, height: 22, borderRadius: 6, background: "transparent", border: "1px solid transparent", color: C.red, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, opacity: 0.35, transition: "opacity 120ms" }}>✕</button>
                              </div>
                            );
                          })}
                          {secGrps.map(function(ge) {
                            var grpName = ge[0]; var grpItems = ge[1].items || [];
                            return (
                              <div key={'g-'+grpName} style={{ margin: "6px 0", border: "1.5px solid " + C.amberBorder, borderRadius: 8, background: C.amberBg + "40", overflow: "hidden" }}>
                                <div style={{ padding: "6px 10px", background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>▸ {grpName} <span style={{ fontWeight: 400, fontSize: 11, color: C.muted }}>({grpItems.length})</span></span>
                                  <button onClick={function() { deleteGroup(grpName); }} style={{ padding: "2px 8px", borderRadius: 6, background: C.redBg, border: "1px solid " + C.redBorder, color: C.red, fontSize: 9, cursor: "pointer" }}>Ungroup</button>
                                </div>
                                <div style={{ padding: "4px 10px 8px" }}>
                                  {grpItems.map(function(gd, gi) {
                                    var gEn = (gd && gd.en) || ''; var gHi = (gd && gd.hi) || '';
                                    return (
                                      <div key={gi} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: gi < grpItems.length - 1 ? "1px solid " + C.borderLight : "none" }}>
                                        <input value={gEn} onChange={function(e) { renameDishInGrp(grpName, gi, 'en', e.target.value); }}
                                          onBlur={function() { autofillDishHiInGrp(grpName, gi); }}
                                          style={{ flex: 1.3, minWidth: 0, padding: "4px 8px", borderRadius: 6, border: "1px solid " + C.border, fontSize: 12, background: C.surface, color: C.text }} placeholder="Dish in group" />
                                        <input value={gHi} onChange={function(e) { renameDishInGrp(grpName, gi, 'hi', e.target.value); }}
                                          lang="hi"
                                          style={{ flex: 1, minWidth: 0, padding: "4px 8px", borderRadius: 6, border: "1px solid " + (gHi ? C.border : C.borderLight), fontSize: 12, background: gHi ? C.surface : C.bg, color: C.text }} placeholder="हिन्दी" />
                                        <button onClick={function() { deleteDishInGrp(grpName, gi); }} style={{ width: 22, height: 22, borderRadius: 6, background: C.redBg, border: "1px solid " + C.redBorder, color: C.red, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>✕</button>
                                      </div>
                                    );
                                  })}
                                  <button onClick={function() { addDishToGrp(grpName); }}
                                    style={{ display: "block", width: "100%", padding: "4px 0", marginTop: 3, background: "transparent", border: "1px dashed " + C.amberBorder, borderRadius: 4, color: C.amber, fontSize: 10, cursor: "pointer", textAlign: "center" }}>+ Add to {grpName}</button>
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ display: "flex", gap: 6, marginTop: 6, paddingTop: 6, borderTop: "1px dashed " + C.borderLight }}>
                            <button onClick={function() { addDishInSec(sec); }}
                              style={{ flex: 1, padding: "6px 0", background: "transparent", border: "1px dashed " + C.greenBorder, borderRadius: 6, color: C.green, fontSize: 11, cursor: "pointer", textAlign: "center" }}>+ Add blank row</button>
                            <button onClick={function() { /* library is already visible on right; this is a nudge */ }} title={T2("Use the library on the right to add dishes")}
                              style={{ flex: 1, padding: "6px 0", background: C.greenBg, border: "1px solid " + C.greenBorder, borderRadius: 6, color: C.green, fontSize: 11, cursor: "default", textAlign: "center", fontWeight: 500 }}>→ Browse library</button>
                            {addGrpSec === sec ? (
                              <React.Fragment>
                                <input autoFocus value={addGrpName} onChange={function(e) { setAddGrpName(e.target.value); }} placeholder="e.g. Dim-sum Station"
                                  onKeyDown={function(e) { if (e.key === 'Enter') createGroup(sec); }}
                                  style={{ flex: 2, padding: "4px 8px", borderRadius: 6, border: "1px solid " + C.amberBorder, fontSize: 11, background: C.surface, color: C.text }} />
                                <button onClick={function() { createGroup(sec); }} disabled={!addGrpName.trim()}
                                  style={{ padding: "4px 10px", borderRadius: 6, background: addGrpName.trim() ? C.amber : C.faint, color: "#fff", border: "none", fontSize: 10, fontWeight: 600, cursor: addGrpName.trim() ? "pointer" : "not-allowed" }}>Create</button>
                                <button onClick={function() { setAddGrpSec(""); setAddGrpName(""); }}
                                  style={{ padding: "4px 8px", borderRadius: 6, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 10, cursor: "pointer" }}>✕</button>
                              </React.Fragment>
                            ) : (
                              <button onClick={function() { setAddGrpSec(sec); setAddGrpName(""); }}
                                style={{ flex: 1, padding: "6px 0", background: "transparent", border: "1px dashed " + C.amberBorder, borderRadius: 6, color: C.amber, fontSize: 11, cursor: "pointer", textAlign: "center" }}>+ Add group</button>
                            )}
                          </div>
                        </div>
                        )}
                      </div>
                    );
                  })}
                  <button onClick={function() { setAddSecVal("__pick__"); }}
                    style={{ width: "100%", padding: 10, marginTop: 6, background: "transparent", border: "1px dashed " + C.border, borderRadius: 10, color: C.muted, fontSize: 12, cursor: "pointer" }}>+ New section…</button>
                  {addSecVal === "__pick__" && (
                    <div style={{ marginTop: 6, padding: 10, background: C.bg, border: "1px solid " + C.border, borderRadius: 10, display: "flex", gap: 6, alignItems: "center" }}>
                      <select value="" onChange={function(e) { if (e.target.value) { addDishInSec(e.target.value); setActiveLibrarySection(e.target.value); setAddSecVal(""); } }}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 12, background: C.surface }}>
                        <option value="">Pick a section to add…</option>
                        {allSections.filter(function(s) { return editSecNames.indexOf(s) === -1 && s !== "Beverages"; }).map(function(s) {
                          var cat2 = (RECIPE_DB.cats || []).find(function(c) { return c.name === s; });
                          return <option key={s} value={s}>{cat2 ? cat2.icon : "🍽"} {s}</option>;
                        })}
                      </select>
                      <button onClick={function() { setAddSecVal(""); }}
                        style={{ padding: "6px 10px", borderRadius: 8, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                  )}
                </div>
                <DishLibrary
                  activeSection={activeLibrarySection}
                  setActiveSection={setActiveLibrarySection}
                  sectionOptions={libSectionOptions}
                  existingInSection={existingInActive}
                  onAdd={function(name, sec) { addNamedDishInSec(name, sec); }}
                  onMapSop={async function(name, recipeName) { await saveOneMapping(name, recipeName); setLibRefreshKey(function(k){ return k+1; }); }}
                  onClearSop={async function(name) { await removeMapping(name); setLibRefreshKey(function(k){ return k+1; }); }}
                  refreshKey={libRefreshKey}
                  T2={T2}
                />
                </div>
              );
            })()}

            {/* Section groups */}
            {!dishEditMode && Object.entries(bySection).filter(function(e) { return e[0] !== "Beverages"; }).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
              var sec = entry[0]; var dishes = entry[1];
              var cat = (RECIPE_DB.cats || []).find(function(c) { return c.name === sec; });
              var m2 = { color: cat?.color || C.muted, icon: cat?.icon || "🍽" };
              var isOpen = !!openSections[sec];
              var allSelected = dishes.every(function(d) { return selected[d]; });

              return (
                <div key={sec} style={{ marginBottom: 8, border: "1px solid " + C.border, borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={function() { toggleSection(sec); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: isOpen ? m2.color + "15" : C.bg, border: "none", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: m2.color }}>
                      {m2.icon} {T2(sec)} <span style={{ fontWeight: 400, fontSize: 12, color: C.muted }}>({dishes.length} items)</span>
                    </span>
                    <span style={{ fontSize: 14, color: m2.color, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "8px 14px 12px" }}>
                      {isAdmin && !editMode && !dishEditMode && (
                        quickAddSec === sec ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 0 10px", borderBottom: "1px dashed " + C.borderLight, marginBottom: 6 }}>
                            <input autoFocus value={quickAddVal} onChange={function(e) { setQuickAddVal(e.target.value); }}
                              onKeyDown={function(e) { if (e.key === 'Enter') quickAddDish(sec); if (e.key === 'Escape') { setQuickAddSec(null); setQuickAddVal(""); } }}
                              placeholder={"Add dish to " + sec + "…"} disabled={quickAddSaving}
                              style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1.5px solid " + m2.color, fontSize: 12, background: C.surface, color: C.text, outline: "none" }} />
                            <button onClick={function() { quickAddDish(sec); }} disabled={!quickAddVal.trim() || quickAddSaving}
                              style={{ padding: "6px 14px", borderRadius: 6, background: quickAddVal.trim() && !quickAddSaving ? C.green : C.faint, color: "#fff", border: "none", fontSize: 11, fontWeight: 700, cursor: quickAddVal.trim() && !quickAddSaving ? "pointer" : "not-allowed", flexShrink: 0 }}>{quickAddSaving ? "..." : "Add"}</button>
                            <button onClick={function() { setQuickAddSec(null); setQuickAddVal(""); }} disabled={quickAddSaving}
                              style={{ padding: "6px 10px", borderRadius: 6, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={function() { setQuickAddSec(sec); setQuickAddVal(""); }}
                            style={{ width: "100%", padding: "6px 0", marginBottom: 6, background: "transparent", border: "1px dashed " + m2.color, borderRadius: 6, color: m2.color, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ Add dish to {sec}</button>
                        )
                      )}
                      {editMode && (
                        <div onClick={function() { selectAllInSec(dishes); }} style={{ padding: "6px 0 8px", borderBottom: "1px solid " + C.borderLight, fontSize: 11, color: C.amber, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (allSelected ? C.green : C.border), background: allSelected ? C.green : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>{allSelected ? "✓" : ""}</span>
                          {allSelected ? "Deselect all" : "Select all"} ({dishes.length})
                        </div>
                      )}
                      {(function() {
                        var vGrps = DISH_GROUPS[selPkg] || {};
                        var d2g = {};
                        Object.entries(vGrps).forEach(function(ge) { (ge[1]||[]).forEach(function(dd) { d2g[dd] = ge[0]; }); });
                        var shown = {}; var viewItems = [];
                        dishes.forEach(function(d) {
                          var grp = d2g[d];
                          if (grp && !shown[grp]) { viewItems.push({ type: 'hdr', label: grp }); shown[grp] = true; }
                          viewItems.push({ type: 'dish', name: d, indent: !!grp });
                        });
                        return viewItems;
                      })().map(function(item, i) {
                        if (item.type === 'hdr') return (
                          <div key={'gh-'+item.label} style={{ padding: "5px 0 2px", fontSize: 11, fontWeight: 700, color: C.amber, display: "flex", alignItems: "center", gap: 4 }}>▸ {item.label}</div>
                        );
                        var d = item.name;
                        var ms = !editMode ? getMappingStatus(d) : null;
                        var dotColor = ms ? (ms.status === 'mapped' ? C.gold : ms.status === 'auto' ? C.green : C.red) : m2.color;
                        return (
                          <div key={i}>
                            <div onClick={editMode ? function() { toggleDish(d); } : undefined}
                              style={{ padding: "6px 0", borderBottom: "1px solid " + C.borderLight, fontSize: 12, color: C.text, display: "flex", alignItems: "center", gap: 6, cursor: editMode ? "pointer" : "default", background: selected[d] ? C.amberBg + "80" : "transparent", borderRadius: selected[d] ? 6 : 0, paddingLeft: item.indent ? 16 : (selected[d] ? 6 : 0) }}>
                              {editMode && (
                                <span style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (selected[d] ? C.green : C.border), background: selected[d] ? C.green : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>{selected[d] ? "✓" : ""}</span>
                              )}
                              {!editMode && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }}></span>}
                              {editMode && <span style={{ color: m2.color, fontSize: 10 }}>•</span>}
                              <span style={{ flex: 1 }}>{d}</span>
                              {ms && ms.status !== 'unmapped' && (
                                <span style={{ fontSize: 10, color: ms.status === 'mapped' ? C.gold : C.green, flexShrink: 0 }}>→ {ms.recipe && ms.recipe.length > 28 ? ms.recipe.slice(0, 26) + '…' : ms.recipe}</span>
                              )}
                              {isAdmin && !editMode && ms && ms.status === 'unmapped' && (
                                <button onClick={function(e) { e.stopPropagation(); setMapDropOpen(mapDropOpen === d ? null : d); setMapSearch(""); }}
                                  style={{ padding: "2px 8px", borderRadius: 6, background: C.redBg, border: "1px solid " + C.redBorder, color: C.red, fontSize: 10, cursor: "pointer", flexShrink: 0 }}>Link SOP</button>
                              )}
                              {isAdmin && !editMode && ms && ms.status !== 'unmapped' && (
                                <button onClick={function(e) { e.stopPropagation(); setMapDropOpen(mapDropOpen === d ? null : d); setMapSearch(""); }}
                                  style={{ padding: "2px 6px", borderRadius: 6, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 9, cursor: "pointer", flexShrink: 0 }}>✎</button>
                              )}
                            </div>
                            {mapDropOpen === d && (
                              <div style={{ position: "relative", zIndex: 30, margin: "2px 0 6px 20px" }}>
                                <div onClick={function() { setMapDropOpen(null); }} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 15 }}></div>
                                <div style={{ position: "relative", zIndex: 20, background: C.surface, border: "1.5px solid " + C.border, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,.12)", maxHeight: 260, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                  <input autoFocus value={mapSearch} onChange={function(e) { setMapSearch(e.target.value); }} placeholder="Search recipes…"
                                    style={{ padding: "8px 10px", border: "none", borderBottom: "1px solid " + C.borderLight, fontSize: 12, outline: "none", background: "transparent", color: C.text }} />
                                  <div style={{ overflowY: "auto", maxHeight: 200 }}>
                                    {(function() {
                                      var filtered = allRecipes.filter(function(r) { var q = mapSearch.toLowerCase(); return !mapSearch || r.display.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.catName.toLowerCase().includes(q); });
                                      var byCat = {};
                                      filtered.forEach(function(r) { if (!byCat[r.catName]) byCat[r.catName] = { icon: r.catIcon, items: [] }; byCat[r.catName].items.push(r); });
                                      return Object.entries(byCat).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
                                        var catName = entry[0]; var grp = entry[1];
                                        return (
                                          <div key={catName}>
                                            <div style={{ position: "sticky", top: 0, padding: "5px 10px", fontSize: 10, fontWeight: 700, color: C.muted, background: C.bg, borderBottom: "1px solid " + C.borderLight, zIndex: 2 }}>{grp.icon} {catName}</div>
                                            {grp.items.map(function(r) {
                                              return (
                                                <div key={r.name} onClick={function() { saveOneMapping(d, r.name); }}
                                                  style={{ padding: "6px 10px 6px 22px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid " + C.borderLight, color: C.text }}
                                                  onMouseEnter={function(ev) { ev.currentTarget.style.background = C.bg; }}
                                                  onMouseLeave={function(ev) { ev.currentTarget.style.background = "transparent"; }}>
                                                  {r.display}{r.display !== r.name ? <span style={{ fontSize: 10, color: C.muted, marginLeft: 6 }}>{r.name.split('/').slice(1).join('/').trim()}</span> : null}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                  {ms && (ms.status === 'mapped' || ms.status === 'auto') && (
                                    <button onClick={function(e) { e.stopPropagation(); removeMapping(d); setMapDropOpen(null); }}
                                      style={{ padding: "6px 10px", borderTop: "1px solid " + C.borderLight, background: C.redBg, color: C.red, fontSize: 10, cursor: "pointer", textAlign: "center", width: "100%", border: "none", borderTop: "1px solid " + C.borderLight }}>Remove mapping</button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {!dishEditMode && null}
          </div>
        );
      })()}
    </div>
  );
}

export { MenuPackagesView };