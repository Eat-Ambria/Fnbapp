// Ambria FnB — Menu Editor Component (Option C: Two-column transfer list)
// Available dishes left, selected menu right, grouped by SOP category
// Place in: src/components/MenuEditor.jsx
import React, { useState, useMemo, useEffect } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { RECIPE_DB, getCatIdForDish, getExplicitCatIdForDish, getExtrasCatId, getAllDishes, resolveDishHindi, resolveDishStore, upsertDishMaster, upsertDishCat } from '../data/recipeData.js';
import { MENU_PACKAGES, MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';
import { supabase } from '../lib/supabase.js';

// pkgName/sectionOverrides/onSectionOverridesChange are optional — when the
// event this menu belongs to is tied to a package, "Selected menu" groups by
// that package's own sections (matching how the menu will actually be
// served/printed) instead of SOP category. sectionOverrides is a per-EVENT
// { [dishName]: sectionId } tag for dishes not natively listed in any of the
// package's sections (custom additions, or catalogue dishes outside it) — it
// never touches the shared package definition, only this one event's menu.
function MenuEditor({ selected = [], onChange, lang = "en", pkgName = "", sectionOverrides = {}, onSectionOverridesChange }) {
  var T2 = function(s) { return T(s, lang); };
  var [search, setSearch] = useState("");
  var [selSearch, setSelSearch] = useState("");
  var [customDish, setCustomDish] = useState("");
  var [customSaving, setCustomSaving] = useState(false);
  var [openCats, setOpenCats] = useState({});
  var [openSelCats, setOpenSelCats] = useState({});
  // Force re-render when Packages tab refreshes MENU_PACKAGES (see menuPackages.js)
  var [pkgVer, setPkgVer] = useState(0);
  useEffect(function(){
    var h = function(){ setPkgVer(function(v){ return v + 1; }); };
    window.addEventListener('ambria:menu-packages-refreshed', h);
    return function(){ window.removeEventListener('ambria:menu-packages-refreshed', h); };
  }, []);
  var [typeFilter, setTypeFilter] = useState("all");   // all | sop | inv | unmapped
  var [libBump, setLibBump] = useState(0);

  // Build flat list of all dishes from Dish Library (dishes_master, not just RECIPE_DB.recipes)
  // Includes SOP-mapped, Inventory-mapped, Unmapped, and "No SOP" dishes. Retired dishes excluded.
  var allDishes = useMemo(function() {
    var raw = getAllDishes({ includeInactive: false });
    return raw.map(function(d) {
      var name = d.dish_name;
      var store = resolveDishStore(name);
      var type = store ? 'inv'
               : (d.hasRecipe ? 'sop'
               : (d.explicitNone ? 'nosop' : 'unmapped'));
      return {
        name: name,
        catId: d.catId || 'other',
        hindi: resolveDishHindi(name) || '',
        type: type,
      };
    });
  }, [libBump]);

  var selectedSet = new Set(selected.map(function(s) { return s.toLowerCase().trim(); }));
  var q = search.toLowerCase().trim();

  // Available = all dishes NOT in selected, filtered by search + type filter
  var available = allDishes.filter(function(d) {
    if (selectedSet.has(d.name.toLowerCase().trim())) return false;
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    if (q) {
      var nameHit = d.name.toLowerCase().includes(q);
      var hindiHit = d.hindi && d.hindi.toLowerCase().includes(q);
      if (!nameHit && !hindiHit) return false;
    }
    return true;
  });

  // Group available by category
  var availByCat = {};
  available.forEach(function(d) {
    if (!availByCat[d.catId]) availByCat[d.catId] = [];
    availByCat[d.catId].push(d);
  });

  // Group selected by EXPLICIT category tag only (no fuzzy fallback) — a dish
  // with no real SOP mapping (e.g. an outdoor-station add-on like Candy Floss)
  // used to get fuzzy-guessed into some semi-random category (getCatIdForDish
  // always resolves to SOMETHING, down to a hardcoded default), silently
  // hiding it from whoever's actually planning that category. Ungrouped dishes
  // now land in one shared, clearly-labelled Extras bucket instead — same
  // "explicit tag or Extras" rule the package-linked branch below already uses.
  var selByCat = {};
  selected.forEach(function(name) {
    var catId = getExplicitCatIdForDish(name) || "__extras__";
    if (!selByCat[catId]) selByCat[catId] = [];
    selByCat[catId].push(name);
  });

  // Group selected by the package's OWN sections instead, when this event has
  // one — a dish lands under its native section if the package lists it
  // there, or under whichever section this event tagged it into via
  // sectionOverrides, or in "Extras" if neither.
  var pkgSections = pkgName ? (MENU_PACKAGE_SECTIONS[pkgName] || null) : null;
  // V85 — a subsection (e.g. Main Course > Hyderabadi Cuisine) is addressed
  // exactly like a section — same id space, just nested one level in the
  // package definition — so flatten sections+subsections into one list for
  // grouping/picking purposes. "Main Course" itself and each of its
  // subsections all become their own addressable group.
  var pkgGroups = null;
  if (pkgSections && pkgSections.length > 0) {
    pkgGroups = [];
    pkgSections.forEach(function(sec) {
      pkgGroups.push({ id: sec.id, name: sec.name, sop_category: sec.sop_category });
      (sec.subsections || []).forEach(function(sub) {
        pkgGroups.push({ id: sub.id, name: sec.name + ' › ' + sub.name, sop_category: sec.sop_category });
      });
    });
  }
  var selByPkgSection = null;
  if (pkgGroups && pkgGroups.length > 0) {
    var dishToNativeSection = {};
    pkgSections.forEach(function(sec) {
      (sec.dishes || []).forEach(function(d) { if (d) dishToNativeSection[d] = sec.id; });
      (sec.subsections || []).forEach(function(sub) {
        (sub.dishes || []).forEach(function(d) { if (d) dishToNativeSection[d] = sub.id; });
      });
    });
    var bySecId = {};
    var extras = [];
    selected.forEach(function(name) {
      var secId = dishToNativeSection[name] || sectionOverrides[name] || null;
      if (secId) { if (!bySecId[secId]) bySecId[secId] = []; bySecId[secId].push(name); }
      else extras.push(name);
    });
    selByPkgSection = pkgGroups
      .map(function(g) { return { id: g.id, name: g.name, sop_category: g.sop_category, dishes: bySecId[g.id] || [], isExtras: false }; })
      .filter(function(g) { return g.dishes.length > 0; });
    if (extras.length > 0) selByPkgSection.push({ id: '__extras__', name: T2('Extras'), sop_category: '', dishes: extras, isExtras: true });
  }

  function pkgSectionIcon(sopCatName) {
    if (!sopCatName) return '✨';
    var cat = (RECIPE_DB.cats || []).find(function(c) { return c.name === sopCatName || c.id === sopCatName; });
    return (cat && cat.icon) || '🍽';
  }

  // Unified render list for "Selected menu" — package sections when the event
  // has one, SOP category otherwise.
  var selGroups = selByPkgSection
    ? selByPkgSection.map(function(g) { return { id: g.id, label: g.name, icon: pkgSectionIcon(g.sop_category), names: g.dishes, isExtras: g.isExtras }; })
    : Object.entries(selByCat).sort(function(a, b) {
        if (a[0] === '__extras__') return 1;
        if (b[0] === '__extras__') return -1;
        return a[0].localeCompare(b[0]);
      }).map(function(entry) {
        var catId = entry[0];
        var isExtras = catId === '__extras__';
        return { id: catId, label: isExtras ? T2('Extras') : catName(catId), icon: isExtras ? '✨' : catIcon(catId), names: entry[1], isExtras: isExtras };
      });

  // V89 — reassign a dish's EXPLICIT SOP category right from the Selected
  // menu list, so a fuzzy-guess miss (or a dish with no tag at all, sitting
  // in Extras) can be corrected on the spot instead of a trip to Dish
  // Library. Empty catId clears the tag, dropping it back to Extras. Same
  // pill-picker modal as adding a custom dish, opened for an EXISTING one.
  var [recat, setRecat] = useState(null); // { name, catId } | null
  var [recatSaving, setRecatSaving] = useState(false);
  function openRecat(name) {
    setRecat({ name: name, catId: getExplicitCatIdForDish(name) || '' });
  }
  async function confirmRecat() {
    if (!recat) return;
    setRecatSaving(true);
    try {
      // Left blank, a dish falls back into the "Extras" SOP category (if
      // one's been set up) rather than truly uncategorized — same rule the
      // custom-dish-add modal uses.
      var catId = recat.catId || getExtrasCatId();
      var res = catId
        ? await supabase.from('dish_categories').upsert({ dish_name: recat.name, category_id: catId }, { onConflict: 'dish_name' })
        : await supabase.from('dish_categories').delete().eq('dish_name', recat.name);
      if (res.error) throw res.error;
      upsertDishCat(recat.name, catId || null);
      setLibBump(function(n) { return n + 1; });
      setRecat(null);
    } catch (e) { alert(T2('Failed to update category:') + ' ' + (e.message || e)); }
    finally { setRecatSaving(false); }
  }

  function addDish(name) {
    if (!selectedSet.has(name.toLowerCase())) {
      onChange([...selected, name]);
    }
  }

  function removeDish(name) {
    onChange(selected.filter(function(s) { return s.toLowerCase() !== name.toLowerCase(); }));
  }

  // V80: adding a custom dish used to immediately guess its SOP category via
  // getCatIdForDish's fuzzy substring matching (the same fragile logic behind
  // the "Chaat" vs "Chaat Station" split bug) — a brand-new dish with no recipe
  // match at all would fall through to a generic default. Now it opens a modal
  // requiring an explicit category pick before it's added to this menu, so the
  // dish is classified correctly from the start instead of guessed.
  var [pendingCustom, setPendingCustom] = useState(null); // { name, catId } | null

  function openCustomModal() {
    var name = customDish.trim();
    if (!name) return;
    if (selectedSet.has(name.toLowerCase())) { setCustomDish(""); return; }
    setPendingCustom({ name: name, catId: getCatIdForDish(name) || "", sectionId: "" });
  }

  async function confirmCustom() {
    if (!pendingCustom) return;
    var name = pendingCustom.name;
    // Left untagged, a dish falls into the "Extras" SOP category (if one's
    // been set up) so kitchen/store see it exists and can plan for it,
    // instead of having no classification anywhere.
    var catId = pendingCustom.catId || getExtrasCatId();
    setCustomSaving(true);
    try {
      // Upsert into dishes_master so this dish becomes part of the library (idempotent on 23505)
      var res = await supabase.from('dishes_master').upsert({ dish_name: name, is_active: true }, { onConflict: 'dish_name', ignoreDuplicates: true });
      if (res.error && res.error.code !== '23505') console.warn('dishes_master upsert warning:', res.error);
      upsertDishMaster(name, { is_active: true });
      if (catId) {
        var catRes = await supabase.from('dish_categories').upsert({ dish_name: name, category_id: catId }, { onConflict: 'dish_name' });
        if (catRes.error) console.warn('dish_categories upsert warning:', catRes.error);
        upsertDishCat(name, catId);
        // Give it an empty SOP recipe stub in that category, so it shows up in
        // Kitchen Hub's SOP list ready to fill in — instead of only existing as
        // a category tag with no recipe card to open at all.
        var already = (RECIPE_DB.recipes[catId] || []).some(function(r) { return r.n === name; });
        if (!already) {
          var recRes = await supabase.from('recipes').insert({ dish_name: name, category_id: catId, sub: '', steps: [] });
          if (recRes.error && recRes.error.code !== '23505') console.warn('recipes insert warning:', recRes.error);
          else {
            if (!RECIPE_DB.recipes[catId]) RECIPE_DB.recipes[catId] = [];
            RECIPE_DB.recipes[catId].push({ n: name, sub: '', steps: [] });
            var catObj = (RECIPE_DB.cats || []).find(function(c) { return c.id === catId; });
            if (catObj) catObj.count = (RECIPE_DB.recipes[catId] || []).length;
          }
        }
      }
    } catch (e) { console.warn('Custom dish library add failed:', e); }
    finally { setCustomSaving(false); }
    onChange([...selected, name]);
    // Tag which of the event's package sections it goes into — this event
    // only, never written to the shared package definition.
    if (pendingCustom.sectionId && onSectionOverridesChange) {
      onSectionOverridesChange({ ...sectionOverrides, [name]: pendingCustom.sectionId });
    }
    setCustomDish("");
    setPendingCustom(null);
    setLibBump(function(n) { return n + 1; });
  }

  // "Quick start from package" replaces the ENTIRE selected menu in one click,
  // saved immediately (Build Menu has no separate Save step) — sitting right
  // above the dish list this is one misclick away from silently wiping a
  // manually-built menu. V80: window.confirm() doesn't reliably show a real
  // dialog in this app's runtime (it can resolve without ever pausing for
  // input), so this is a proper in-app modal instead of window.confirm().
  var [pendingDestructive, setPendingDestructive] = useState(null); // { kind: 'package'|'clear', pkgName?, count } | null

  function selectPackage(pkgName) {
    if (selected.length > 0) {
      setPendingDestructive({ kind: 'package', pkgName: pkgName, count: (MENU_PACKAGES[pkgName] || []).length });
      return;
    }
    onChange([...(MENU_PACKAGES[pkgName] || [])]);
  }

  function confirmDestructive() {
    if (!pendingDestructive) return;
    if (pendingDestructive.kind === 'package') onChange([...(MENU_PACKAGES[pendingDestructive.pkgName] || [])]);
    else if (pendingDestructive.kind === 'clear') onChange([]);
    setPendingDestructive(null);
  }

  function catName(catId) {
    var cat = (RECIPE_DB.cats || []).find(function(c) { return c.id === catId; });
    return cat ? cat.name : catId;
  }
  function catIcon(catId) {
    var cat = (RECIPE_DB.cats || []).find(function(c) { return c.id === catId; });
    return cat ? cat.icon : "🍽";
  }

  var COL = { background: C.surface, borderRadius: 12, border: "1px solid " + C.border, overflow: "hidden", display: "flex", flexDirection: "column" };
  var COLHEAD = { padding: "10px 14px", borderBottom: "1px solid " + C.border, fontSize: 13, fontWeight: 700 };
  var COLBODY = { flex: 1, overflowY: "auto", maxHeight: 480, padding: "4px 0" };
  var SECHEAD = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 14px 4px", color: C.gold };
  var ROW = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 14px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid " + C.borderLight };

  return (
    <div>
      {/* Quick start from package */}
      <div style={{ marginBottom: 10, padding: "10px 14px", background: C.bg, borderRadius: 10, border: "1px solid " + C.border }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>{T2("Quick start from package")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.keys(MENU_PACKAGES).map(function(pkg) {
            var count = (MENU_PACKAGES[pkg] || []).length;
            return (
              <button key={pkg} onClick={function() { selectPackage(pkg); }}
                style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", background: "transparent", border: "1px solid " + C.border, color: C.text, whiteSpace: "nowrap" }}>
                {pkg} <span style={{ color: C.muted }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: 12, minHeight: 400 }}>

        {/* LEFT: Available dishes */}
        <div style={{ ...COL, flex: 1 }}>
          <div style={{ ...COLHEAD, color: C.text, background: C.bg }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📋 {T2("Available")} ({available.length})</span>
              <span style={{ fontSize: 10, color: C.faint, fontWeight: 400 }}>{T2("from Dish library")}</span>
            </div>
            <input value={search} onChange={function(e) { setSearch(e.target.value); }}
              placeholder={"🔍 " + T2("Search name or Hindi…")}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 12, color: C.text, background: C.surface, boxSizing: "border-box", marginTop: 8 }} />
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {[
                { v: "all", l: T2("All"), fg: "#fff", bg: C.text },
                { v: "sop", l: "SOP", fg: "#3B6D11", bg: "#EAF3DE" },
                { v: "inv", l: T2("Inventory"), fg: "#0F6E56", bg: "#E1F5EE" },
                { v: "unmapped", l: T2("Unmapped"), fg: C.red, bg: C.redBg },
              ].map(function(f) {
                var active = typeFilter === f.v;
                return (
                  <button key={f.v} onClick={function() { setTypeFilter(f.v); }}
                    style={{ padding: "2px 10px", borderRadius: 12, fontSize: 10, fontWeight: active ? 600 : 500, cursor: "pointer",
                      background: active ? f.bg : "transparent",
                      color: active ? (f.fg === C.text ? "#fff" : f.fg) : C.muted,
                      border: "1px solid " + (active ? f.fg : C.border) }}>{f.l}</button>
                );
              })}
            </div>
          </div>
          <div style={COLBODY}>
            {Object.keys(availByCat).length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 12 }}>{q ? T2("No matches") : T2("All dishes selected")}</div>
            )}
            {Object.entries(availByCat).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
              var catId = entry[0]; var dishes = entry[1];
              var isOpen = !!openCats[catId] || !!q;
              return (
                <div key={catId}>
                  <div onClick={function() { setOpenCats(function(p) { return { ...p, [catId]: !p[catId] }; }); }}
                    style={{ ...SECHEAD, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid " + C.borderLight, userSelect: "none" }}>
                    <span>{catIcon(catId)} {catName(catId)} ({dishes.length})</span>
                    <span style={{ fontSize: 12, color: C.muted, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                  </div>
                  {isOpen && dishes.map(function(d) {
                    var dotColor = d.type === 'sop' ? '#3B6D11' : d.type === 'inv' ? '#0F6E56' : d.type === 'nosop' ? C.faint : C.red;
                    var dotTitle = d.type === 'sop' ? 'SOP' : d.type === 'inv' ? T2('Inventory') : d.type === 'nosop' ? T2('No SOP') : T2('Unmapped');
                    return (
                      <div key={d.name} onClick={function() { addDish(d.name); }}
                        style={{ ...ROW, color: C.muted, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <span title={dotTitle} style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                            {d.hindi && <div style={{ fontSize: 10, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.hindi}</div>}
                          </div>
                        </div>
                        <span style={{ fontSize: 16, color: C.green, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>+</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Custom dish entry */}
            <div style={{ padding: "10px 14px", borderTop: "1px solid " + C.border, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>✏ {T2("Custom dish")}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={customDish} onChange={function(e) { setCustomDish(e.target.value); }}
                  onKeyDown={function(e) { if (e.key === "Enter" && !customSaving) openCustomModal(); }}
                  placeholder={T2("Not in list…")} disabled={customSaving}
                  style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 12, color: C.text, background: C.bg, boxSizing: "border-box" }} />
                <button onClick={openCustomModal} disabled={!customDish.trim() || customSaving}
                  style={{ padding: "6px 12px", borderRadius: 8, background: customDish.trim() && !customSaving ? C.green : C.border, color: customDish.trim() && !customSaving ? "#fff" : C.faint, border: "none", fontSize: 11, fontWeight: 700, cursor: customDish.trim() && !customSaving ? "pointer" : "not-allowed", minWidth: 40 }}>{customSaving ? "…" : "+"}</button>
              </div>
              <div style={{ fontSize: 9, color: C.faint, marginTop: 4, fontStyle: "italic" }}>{T2("Adds to Dish library too")}</div>
            </div>
          </div>
        </div>

        {/* RIGHT: Selected menu */}
        <div style={{ ...COL, flex: 1, borderColor: C.green }}>
          <div style={{ ...COLHEAD, background: C.greenBg, color: C.green }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>✅ {T2("Selected menu")} ({selected.length})</span>
              {selected.length > 0 && (
                <button onClick={function() { setPendingDestructive({ kind: 'clear', count: 0 }); }}
                  style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, background: C.redBg, border: "1px solid " + C.redBorder, color: C.red, cursor: "pointer", fontWeight: 600 }}>{T2("Clear all")}</button>
              )}
            </div>
            <input value={selSearch} onChange={function(e) { setSelSearch(e.target.value); }}
              placeholder={"🔍 " + T2("Search selected dishes…")}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.greenBorder, fontSize: 12, color: C.text, background: C.surface, boxSizing: "border-box", marginTop: 8 }} />
          </div>
          <div style={COLBODY}>
            {selected.length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 12 }}>{T2("No dishes selected")}<br /><span style={{ fontSize: 11 }}>{T2("Click + on the left to add")}</span></div>
            )}
            {(function() {
              var q2 = selSearch.trim().toLowerCase();
              var filteredGroups = q2
                ? selGroups.map(function(g) { return { ...g, names: g.names.filter(function(n) { return n.toLowerCase().includes(q2); }) }; }).filter(function(g) { return g.names.length > 0; })
                : selGroups;
              if (selected.length > 0 && q2 && filteredGroups.length === 0) {
                return <div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 12 }}>{T2("No matches")}</div>;
              }
              return filteredGroups.map(function(g) {
              var isOpen2 = q2 ? true : openSelCats[g.id] !== false;
              return (
                <div key={g.id}>
                  <div onClick={function() { setOpenSelCats(function(p) { return { ...p, [g.id]: p[g.id] === false ? true : false }; }); }}
                    style={{ ...SECHEAD, color: C.green, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid " + C.borderLight, userSelect: "none" }}>
                    <span>{g.icon} {g.label} ({g.names.length})</span>
                    <span style={{ fontSize: 12, color: C.green, transform: isOpen2 ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                  </div>
                  {isOpen2 && g.names.map(function(name) {
                    var explicitCat = getExplicitCatIdForDish(name) || '';
                    return (
                      <div key={name} style={{ ...ROW, color: C.green, cursor: "default" }}>
                        <span onClick={function() { removeDish(name); }} style={{ flex: 1, cursor: "pointer" }}>{name}</span>
                        <button onClick={function(e) { e.stopPropagation(); openRecat(name); }}
                          title={T2('Fix this dish\'s SOP category')}
                          style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid " + C.greenBorder, color: C.green, background: C.surface, marginRight: 8, cursor: "pointer", whiteSpace: "nowrap" }}>
                          🏷 {explicitCat ? catName(explicitCat) : T2('Uncategorized')}
                        </button>
                        {g.isExtras && pkgGroups && onSectionOverridesChange && (
                          <select value={sectionOverrides[name] || ''} onClick={function(e) { e.stopPropagation(); }}
                            onChange={function(e) { onSectionOverridesChange({ ...sectionOverrides, [name]: e.target.value || undefined }); }}
                            title={T2('Tag which package section this shows under (this event only)')}
                            style={{ fontSize: 10, padding: "2px 4px", borderRadius: 5, border: "1px solid " + C.greenBorder, color: C.green, background: C.surface, marginRight: 8, maxWidth: 110 }}>
                            <option value="">{T2('— section —')}</option>
                            {pkgGroups.map(function(g2) { return <option key={g2.id} value={g2.id}>{g2.name}</option>; })}
                          </select>
                        )}
                        <span onClick={function() { removeDish(name); }} style={{ fontSize: 14, color: C.red, fontWeight: 700, flexShrink: 0, cursor: "pointer" }}>×</span>
                      </div>
                    );
                  })}
                </div>
              );
              });
            })()}
          </div>

          {/* Section/category summary strip */}
          {selected.length > 0 && (
            <div style={{ padding: "8px 14px", borderTop: "1px solid " + C.greenBorder, background: C.greenBg, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selGroups.map(function(g) {
                return <span key={g.id} style={{ fontSize: 10, color: C.green }}>{g.icon} {g.label}: {g.names.length}</span>;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Custom dish: confirm its SOP/recipe category before adding it in */}
      {pendingCustom && (
        <div onClick={function() { if (!customSaving) setPendingCustom(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 420, width: "100%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 2 }}>{pendingCustom.name}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>{T2("New dish — pick where it belongs before adding it to the menu")}</div>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{T2("SOP / recipe section")} <span style={{ textTransform: "none", fontWeight: 500, letterSpacing: 0 }}>({T2("optional")})</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: pkgSections ? 18 : 0 }}>
              {(RECIPE_DB.cats || []).map(function(c) {
                var active = pendingCustom.catId === c.id;
                return (
                  <button key={c.id} onClick={function() { setPendingCustom(function(p) { return { ...p, catId: active ? "" : c.id }; }); }}
                    style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                      background: active ? C.green : "transparent", color: active ? "#fff" : C.text,
                      border: "1px solid " + (active ? C.green : C.border) }}>
                    {c.icon} {c.name}
                  </button>
                );
              })}
            </div>

            {pkgGroups && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{T2("Menu section")} <span style={{ fontWeight: 400, textTransform: "none", color: C.faint }}>({T2("this event only")})</span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                  {pkgGroups.map(function(g) {
                    var active = pendingCustom.sectionId === g.id;
                    return (
                      <button key={g.id} onClick={function() { setPendingCustom(function(p) { return { ...p, sectionId: active ? "" : g.id }; }); }}
                        style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                          background: active ? C.wine : "transparent", color: active ? "#fff" : C.text,
                          border: "1px solid " + (active ? C.wine : C.border) }}>
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={function() { setPendingCustom(null); }} disabled={customSaving}
                style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {T2("Cancel")}
              </button>
              <button onClick={confirmCustom} disabled={customSaving}
                style={{ padding: "7px 16px", borderRadius: 8, background: C.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: customSaving ? "wait" : "pointer", opacity: customSaving ? 0.6 : 1 }}>
                {customSaving ? T2("Adding…") : T2("Add to menu")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* V89 — fix an already-selected dish's SOP category, same pill picker
          as the custom-dish-add modal above, just for an existing dish. */}
      {recat && (
        <div onClick={function() { if (!recatSaving) setRecat(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 420, width: "100%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 2 }}>{recat.name}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>{T2("Fix which SOP / recipe section this dish belongs to")}</div>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{T2("SOP / recipe section")} <span style={{ textTransform: "none", fontWeight: 500, letterSpacing: 0 }}>({T2("optional")})</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              {(RECIPE_DB.cats || []).map(function(c) {
                var active = recat.catId === c.id;
                return (
                  <button key={c.id} onClick={function() { setRecat(function(p) { return { ...p, catId: active ? "" : c.id }; }); }}
                    style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                      background: active ? C.green : "transparent", color: active ? "#fff" : C.text,
                      border: "1px solid " + (active ? C.green : C.border) }}>
                    {c.icon} {c.name}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={function() { setRecat(null); }} disabled={recatSaving}
                style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {T2("Cancel")}
              </button>
              <button onClick={confirmRecat} disabled={recatSaving}
                style={{ padding: "7px 16px", borderRadius: 8, background: C.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: recatSaving ? "wait" : "pointer", opacity: recatSaving ? 0.6 : 1 }}>
                {recatSaving ? T2("Saving…") : T2("Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Destructive action confirm (package replace / clear all) — in-app
          modal, not window.confirm(), see note on pendingDestructive above. */}
      {pendingDestructive && (
        <div onClick={function() { setPendingDestructive(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 420, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.red, marginBottom: 8 }}>⚠ {T2("This can't be undone")}</div>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 18, lineHeight: 1.5 }}>
              {pendingDestructive.kind === 'package'
                ? T2('Replace the current') + ' ' + selected.length + ' ' + T2('dishes with') + ' "' + pendingDestructive.pkgName + '" (' + pendingDestructive.count + ' ' + T2('dishes') + ')? ' + T2('This saves immediately.')
                : T2('Remove all') + ' ' + selected.length + ' ' + T2('dishes from this menu? This saves immediately.')}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={function() { setPendingDestructive(null); }}
                style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", border: "1px solid " + C.border, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {T2("Cancel")}
              </button>
              <button onClick={confirmDestructive}
                style={{ padding: "7px 16px", borderRadius: 8, background: C.red, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {pendingDestructive.kind === 'package' ? T2('Replace menu') : T2('Clear menu')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { MenuEditor };