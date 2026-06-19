// Ambria FnB — Menu Editor Component
// Visual dish picker by SOP category with search + custom dish entry
// Place in: src/components/MenuEditor.jsx
import React, { useState, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { RECIPE_DB, getCatIdForDish } from '../data/recipeData.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';

function MenuEditor({ selected = [], onChange, lang = "en", onClose }) {
  const T2 = s => T(s, lang);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [customDish, setCustomDish] = useState("");

  // Build a flat list of all dishes from RECIPE_DB, grouped by category
  const allDishes = useMemo(() => {
    var dishes = [];
    (RECIPE_DB.cats || []).forEach(function(cat) {
      (RECIPE_DB.recipes[cat.id] || []).forEach(function(r) {
        dishes.push({ name: r.n || r.dish_name || "", catId: cat.id, catName: cat.name, catIcon: cat.icon || "🍽" });
      });
    });
    // Deduplicate by name (some dishes may appear in multiple categories)
    var seen = {};
    return dishes.filter(function(d) {
      if (!d.name || seen[d.name.toLowerCase()]) return false;
      seen[d.name.toLowerCase()] = true;
      return true;
    });
  }, []);

  // Filter by search + category
  var q = search.toLowerCase().trim();
  var filtered = allDishes.filter(function(d) {
    if (activeCat !== "all" && d.catId !== activeCat) return false;
    if (q && !d.name.toLowerCase().includes(q)) return false;
    return true;
  });

  // Group filtered dishes by category for display
  var grouped = {};
  filtered.forEach(function(d) {
    if (!grouped[d.catId]) grouped[d.catId] = { cat: RECIPE_DB.cats.find(c => c.id === d.catId) || { id: d.catId, name: d.catName, icon: d.catIcon }, dishes: [] };
    grouped[d.catId].dishes.push(d);
  });

  var selectedSet = new Set(selected.map(function(s) { return s.toLowerCase(); }));

  function toggle(dishName) {
    if (selectedSet.has(dishName.toLowerCase())) {
      onChange(selected.filter(function(s) { return s.toLowerCase() !== dishName.toLowerCase(); }));
    } else {
      onChange([...selected, dishName]);
    }
  }

  function addCustom() {
    var name = customDish.trim();
    if (!name) return;
    if (!selectedSet.has(name.toLowerCase())) {
      onChange([...selected, name]);
    }
    setCustomDish("");
  }

  function selectPackage(pkgName) {
    var dishes = MENU_PACKAGES[pkgName] || [];
    onChange([...dishes]);
  }

  // Category counts
  var catCounts = {};
  allDishes.forEach(function(d) {
    if (!catCounts[d.catId]) catCounts[d.catId] = 0;
    catCounts[d.catId]++;
  });

  var selectedByCat = {};
  selected.forEach(function(name) {
    var catId = getCatIdForDish(name) || "other";
    if (!selectedByCat[catId]) selectedByCat[catId] = [];
    selectedByCat[catId].push(name);
  });

  return (
    <div style={{ background: C.surface, borderRadius: 14, border: "1px solid " + C.border, overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid " + C.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>🍽 {T2("Build Menu")}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{selected.length} {T2("dishes selected")}</div>
        </div>
        {onClose && <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.muted }}>✕</button>}
      </div>

      {/* ── Quick package selector ── */}
      <div style={{ padding: "10px 18px", borderBottom: "1px solid " + C.border, background: C.bg }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>{T2("Quick start from package")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.keys(MENU_PACKAGES).map(function(pkg) {
            var count = (MENU_PACKAGES[pkg] || []).length;
            return (
              <button key={pkg} onClick={function() { selectPackage(pkg); }}
                style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: "pointer", background: "transparent", border: "1px solid " + C.border, color: C.text, whiteSpace: "nowrap" }}>
                {pkg} <span style={{ color: C.muted }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", minHeight: 400 }}>

        {/* ── Left: Category sidebar ── */}
        <div style={{ width: 180, borderRight: "1px solid " + C.border, background: C.bg, flexShrink: 0, overflowY: "auto", maxHeight: 500 }}>
          <button onClick={function() { setActiveCat("all"); }}
            style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid " + C.border, background: activeCat === "all" ? C.surface : "transparent", color: activeCat === "all" ? C.gold : C.text, fontSize: 12, fontWeight: activeCat === "all" ? 700 : 400, cursor: "pointer", textAlign: "left" }}>
            🍽 {T2("All categories")} <span style={{ color: C.muted, fontSize: 11 }}>({allDishes.length})</span>
          </button>
          {(RECIPE_DB.cats || []).filter(function(c) { return c.id !== "beverages"; }).map(function(cat) {
            var count = catCounts[cat.id] || 0;
            var selCount = (selectedByCat[cat.id] || []).length;
            if (count === 0) return null;
            return (
              <button key={cat.id} onClick={function() { setActiveCat(cat.id); }}
                style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid " + C.border, background: activeCat === cat.id ? C.surface : "transparent", color: activeCat === cat.id ? C.gold : C.text, fontSize: 12, fontWeight: activeCat === cat.id ? 700 : 400, cursor: "pointer", textAlign: "left" }}>
                {cat.icon} {cat.name} <span style={{ color: C.muted, fontSize: 11 }}>({count})</span>
                {selCount > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: C.green }}>✓{selCount}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Right: Dish grid ── */}
        <div style={{ flex: 1, overflowY: "auto", maxHeight: 500 }}>

          {/* Search bar */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid " + C.border, position: "sticky", top: 0, background: C.surface, zIndex: 1 }}>
            <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder={"🔍 " + T2("Search dishes…")}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 12, color: C.text, background: C.bg, boxSizing: "border-box" }} />
          </div>

          {/* Dish list grouped by category */}
          <div style={{ padding: "8px 14px" }}>
            {Object.keys(grouped).length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 13 }}>{T2("No dishes found")}</div>
            )}
            {Object.entries(grouped).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
              var catId = entry[0];
              var group = entry[1];
              var cat = group.cat;
              return (
                <div key={catId} style={{ marginBottom: 12 }}>
                  {activeCat === "all" && <div style={{ fontSize: 11, fontWeight: 700, color: cat.color || C.gold, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{cat.icon} {cat.name}</div>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {group.dishes.map(function(d) {
                      var isSel = selectedSet.has(d.name.toLowerCase());
                      return (
                        <button key={d.name} onClick={function() { toggle(d.name); }}
                          style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: isSel ? "1.5px solid " + C.green : "1px solid " + C.border, background: isSel ? C.greenBg : "transparent", color: isSel ? C.green : C.text, fontWeight: isSel ? 600 : 400, whiteSpace: "nowrap" }}>
                          {isSel && "✓ "}{d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Custom dish entry */}
            <div style={{ marginTop: 16, padding: "12px", background: C.bg, borderRadius: 10, border: "1px solid " + C.border }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>✏ {T2("Add custom dish")}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={customDish} onChange={function(e) { setCustomDish(e.target.value); }}
                  onKeyDown={function(e) { if (e.key === "Enter") addCustom(); }}
                  placeholder={T2("Dish name not in list…")}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 12, color: C.text, background: C.surface, boxSizing: "border-box" }} />
                <button onClick={addCustom} disabled={!customDish.trim()}
                  style={{ padding: "8px 14px", borderRadius: 8, background: customDish.trim() ? C.gold : C.border, color: customDish.trim() ? "#0A0A0F" : C.faint, border: "none", fontSize: 12, fontWeight: 700, cursor: customDish.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>+ {T2("Add")}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer: selected dishes summary ── */}
      <div style={{ borderTop: "1px solid " + C.border, padding: "12px 18px", background: C.bg }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>{T2("Selected")} ({selected.length})</div>
        {selected.length === 0 && <div style={{ fontSize: 12, color: C.faint, padding: "4px 0" }}>{T2("No dishes selected — pick from above or start from a package")}</div>}
        {selected.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 120, overflowY: "auto" }}>
            {selected.map(function(name) {
              var catId = getCatIdForDish(name);
              var cat = RECIPE_DB.cats.find(function(c) { return c.id === catId; });
              return (
                <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 16, background: C.greenBg, border: "1px solid " + C.greenBorder, fontSize: 11, color: C.green, fontWeight: 500 }}>
                  {cat ? cat.icon + " " : ""}{name}
                  <button onClick={function() { toggle(name); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                </span>
              );
            })}
          </div>
        )}
        {selected.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {Object.entries(selectedByCat).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
              var catId = entry[0];
              var items = entry[1];
              var cat = RECIPE_DB.cats.find(function(c) { return c.id === catId; });
              return <span key={catId} style={{ fontSize: 10, color: C.muted }}>{cat ? cat.icon : "🍽"} {cat ? cat.name : catId}: {items.length}</span>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export { MenuEditor };