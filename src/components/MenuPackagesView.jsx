// Ambria FnB — Menu & Packages View
// Two tabs: Build Menu (assign menus to functions) + Packages (view/edit standard packages)
// Place in: src/components/MenuPackagesView.jsx
import React, { useState } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES, MENU_PACKAGE_NAMES } from '../data/menuPackages.js';
import { getSectionForDish, getCatIdForDish, RECIPE_DB } from '../data/recipeData.js';
import { TODAY, TOMORROW, safeArr } from '../utils/helpers.js';
import { Card } from './SharedUI.jsx';
import { supabase } from '../lib/supabase.js';
import { MenuEditor } from './MenuEditor.jsx';

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
            selected={selEv.menu || (selEv.menuPackage && MENU_PACKAGES[selEv.menuPackage] ? MENU_PACKAGES[selEv.menuPackage] : [])}
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
              <button onClick={function() { setSelPkg(null); setEditMode(false); setSelected({}); }} style={{ padding: "10px 18px", borderRadius: 10, background: C.bg, border: "1px solid " + C.border, color: C.muted, fontSize: 12, cursor: "pointer", minHeight: 44 }}>← {T2("All Packages")}</button>
              {isAdmin && !editMode && (
                <button onClick={function() { setEditMode(true); }} style={{ padding: "10px 18px", borderRadius: 10, background: C.amberBg, border: "1px solid " + C.amberBorder, color: C.amber, fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>✏️ Edit Categories</button>
              )}
              {editMode && (
                <button onClick={function() { setEditMode(false); setSelected({}); }} style={{ padding: "10px 18px", borderRadius: 10, background: C.redBg, border: "1px solid " + C.redBorder, color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44 }}>✕ Cancel</button>
              )}
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: editMode ? 12 : 20 }}>
              <div style={{ fontSize: 40 }}>{pm.icon}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>{selPkg}</div>
                <div style={{ fontSize: 13, color: pm.c, marginTop: 3 }}>{nonBevDishes.length} {T2("dishes")} · {Object.keys(bySection).filter(function(s) { return s !== "Beverages"; }).length} {T2("sections")}</div>
              </div>
            </div>

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

            {/* Section groups */}
            {Object.entries(bySection).filter(function(e) { return e[0] !== "Beverages"; }).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
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
                      {editMode && (
                        <div onClick={function() { selectAllInSec(dishes); }} style={{ padding: "6px 0 8px", borderBottom: "1px solid " + C.borderLight, fontSize: 11, color: C.amber, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (allSelected ? C.green : C.border), background: allSelected ? C.green : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>{allSelected ? "✓" : ""}</span>
                          {allSelected ? "Deselect all" : "Select all"} ({dishes.length})
                        </div>
                      )}
                      {dishes.map(function(d, i) {
                        return (
                          <div key={i} onClick={editMode ? function() { toggleDish(d); } : undefined}
                            style={{ padding: "6px 0", borderBottom: i < dishes.length - 1 ? "1px solid " + C.borderLight : "none", fontSize: 12, color: C.text, display: "flex", alignItems: "center", gap: 6, cursor: editMode ? "pointer" : "default", background: selected[d] ? C.amberBg + "80" : "transparent", borderRadius: selected[d] ? 6 : 0, paddingLeft: selected[d] ? 6 : 0 }}>
                            {editMode && (
                              <span style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (selected[d] ? C.green : C.border), background: selected[d] ? C.green : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>{selected[d] ? "✓" : ""}</span>
                            )}
                            <span style={{ color: m2.color, fontSize: 10 }}>•</span>{d}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

export { MenuPackagesView };