// Ambria FnB — Menu Editor Component (Option C: Two-column transfer list)
// Available dishes left, selected menu right, grouped by SOP category
// Place in: src/components/MenuEditor.jsx
import React, { useState, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { RECIPE_DB, getCatIdForDish } from '../data/recipeData.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';

function MenuEditor({ selected = [], onChange, lang = "en" }) {
  var T2 = function(s) { return T(s, lang); };
  var [search, setSearch] = useState("");
  var [customDish, setCustomDish] = useState("");
  var [openCats, setOpenCats] = useState({});
  var [openSelCats, setOpenSelCats] = useState({});

  // Build flat list of all dishes from RECIPE_DB
  var allDishes = useMemo(function() {
    var dishes = [];
    (RECIPE_DB.cats || []).forEach(function(cat) {
      (RECIPE_DB.recipes[cat.id] || []).forEach(function(r) {
        var name = r.n || r.dish_name || "";
        if (name) dishes.push({ name: name, catId: cat.id });
      });
    });
    var seen = {};
    return dishes.filter(function(d) {
      var k = d.name.toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }, []);

  var selectedSet = new Set(selected.map(function(s) { return s.toLowerCase(); }));
  var q = search.toLowerCase().trim();

  // Available = all dishes NOT in selected, filtered by search
  var available = allDishes.filter(function(d) {
    if (selectedSet.has(d.name.toLowerCase())) return false;
    if (d.catId === "beverages") return false;
    if (q && !d.name.toLowerCase().includes(q)) return false;
    return true;
  });

  // Group available by category
  var availByCat = {};
  available.forEach(function(d) {
    if (!availByCat[d.catId]) availByCat[d.catId] = [];
    availByCat[d.catId].push(d);
  });

  // Group selected by category
  var selByCat = {};
  selected.forEach(function(name) {
    var catId = getCatIdForDish(name) || "other";
    if (!selByCat[catId]) selByCat[catId] = [];
    selByCat[catId].push(name);
  });

  function addDish(name) {
    if (!selectedSet.has(name.toLowerCase())) {
      onChange([...selected, name]);
    }
  }

  function removeDish(name) {
    onChange(selected.filter(function(s) { return s.toLowerCase() !== name.toLowerCase(); }));
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
    onChange([...(MENU_PACKAGES[pkgName] || [])]);
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
            </div>
            <input value={search} onChange={function(e) { setSearch(e.target.value); }}
              placeholder={"🔍 " + T2("Search…")}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 12, color: C.text, background: C.surface, boxSizing: "border-box", marginTop: 8 }} />
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
                    return (
                      <div key={d.name} onClick={function() { addDish(d.name); }}
                        style={{ ...ROW, color: C.muted }}>
                        <span style={{ color: C.text }}>{d.name}</span>
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
                  onKeyDown={function(e) { if (e.key === "Enter") addCustom(); }}
                  placeholder={T2("Not in list…")}
                  style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 12, color: C.text, background: C.bg, boxSizing: "border-box" }} />
                <button onClick={addCustom} disabled={!customDish.trim()}
                  style={{ padding: "6px 12px", borderRadius: 8, background: customDish.trim() ? C.green : C.border, color: customDish.trim() ? "#fff" : C.faint, border: "none", fontSize: 11, fontWeight: 700, cursor: customDish.trim() ? "pointer" : "not-allowed" }}>+</button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Selected menu */}
        <div style={{ ...COL, flex: 1, borderColor: C.green }}>
          <div style={{ ...COLHEAD, background: C.greenBg, color: C.green }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>✅ {T2("Selected menu")} ({selected.length})</span>
              {selected.length > 0 && (
                <button onClick={function() { onChange([]); }}
                  style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, background: C.redBg, border: "1px solid " + C.redBorder, color: C.red, cursor: "pointer", fontWeight: 600 }}>{T2("Clear all")}</button>
              )}
            </div>
          </div>
          <div style={COLBODY}>
            {selected.length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: C.muted, fontSize: 12 }}>{T2("No dishes selected")}<br /><span style={{ fontSize: 11 }}>{T2("Click + on the left to add")}</span></div>
            )}
            {Object.entries(selByCat).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
              var catId = entry[0]; var names = entry[1];
              var isOpen2 = openSelCats[catId] !== false;
              return (
                <div key={catId}>
                  <div onClick={function() { setOpenSelCats(function(p) { return { ...p, [catId]: p[catId] === false ? true : false }; }); }}
                    style={{ ...SECHEAD, color: C.green, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid " + C.borderLight, userSelect: "none" }}>
                    <span>{catIcon(catId)} {catName(catId)} ({names.length})</span>
                    <span style={{ fontSize: 12, color: C.green, transform: isOpen2 ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                  </div>
                  {isOpen2 && names.map(function(name) {
                    return (
                      <div key={name} onClick={function() { removeDish(name); }}
                        style={{ ...ROW, color: C.green }}>
                        <span>{name}</span>
                        <span style={{ fontSize: 14, color: C.red, fontWeight: 700, flexShrink: 0, marginLeft: 8, cursor: "pointer" }}>×</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Category summary strip */}
          {selected.length > 0 && (
            <div style={{ padding: "8px 14px", borderTop: "1px solid " + C.greenBorder, background: C.greenBg, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(selByCat).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
                var catId = entry[0]; var names = entry[1];
                return <span key={catId} style={{ fontSize: 10, color: C.green }}>{catIcon(catId)} {catName(catId)}: {names.length}</span>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { MenuEditor };