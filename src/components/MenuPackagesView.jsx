// Ambria FnB — Menu Builder (standalone screen)
// Replaces MenuPackagesView — full menu editing for any function
// Place in: src/components/MenuPackagesView.jsx (same filename, full rewrite)
import React, { useState } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { getCatIdForDish, RECIPE_DB } from '../data/recipeData.js';
import { TODAY, TOMORROW, safeArr } from '../utils/helpers.js';
import { Card } from './SharedUI.jsx';
import { MenuEditor } from './MenuEditor.jsx';

function MenuPackagesView({ lang = "en", currentUser = null, events = [], setEvents }) {
  const T2 = s => T(s, lang);
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "headchef";
  const [selEvId, setSelEvId] = useState(null);
  const [tab, setTab] = useState("events"); // "events" | "packages"

  // Sort events: today first, then tomorrow, then upcoming
  var allEvs = safeArr(events).filter(function(e) { return e.date >= TODAY; }).sort(function(a, b) {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
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

  // Group events by date
  var byDate = {};
  allEvs.forEach(function(e) {
    var d = e.date || "Unknown";
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(e);
  });

  // Menu stats for an event
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

  var TABS = [
    { v: "events", l: "📋 " + T2("Build Menu") },
    { v: "packages", l: "📦 " + T2("Packages") },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>🍽 {T2("Menu")}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{allEvs.length} {T2("upcoming functions")}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid " + C.border, paddingBottom: 8, marginTop: 12 }}>
        {TABS.map(function(t) {
          return <button key={t.v} onClick={function() { setTab(t.v); }}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", background: tab === t.v ? C.wine : "transparent", color: tab === t.v ? "#fff" : C.muted, border: "1.5px solid " + (tab === t.v ? C.wine : C.border) }}>{t.l}</button>;
        })}
      </div>

      {/* ── BUILD MENU TAB ── */}
      {tab === "events" && !selEv && (
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
                            {ev.venue} · {ev.time || "TBD"} · {ev.pax || "?"} pax
                            {ev.menuPackage ? " · " + ev.menuPackage : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {hasMenu ? (
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{stats.total}</div>
                              <div style={{ fontSize: 10, color: C.green }}>dishes</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>No menu</div>
                              <div style={{ fontSize: 10, color: C.amber }}>tap to build</div>
                            </div>
                          )}
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

      {/* ── EDITING AN EVENT'S MENU ── */}
      {tab === "events" && selEv && (
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

      {/* ── PACKAGES REFERENCE TAB ── */}
      {tab === "packages" && (
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{T2("Standard menu packages for reference. Use Build Menu tab to assign menus to functions.")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
            {Object.keys(MENU_PACKAGES).map(function(pkg) {
              var dishes = MENU_PACKAGES[pkg] || [];
              var byCat = {};
              dishes.forEach(function(name) {
                var catId = getCatIdForDish(name) || "other";
                var cat = RECIPE_DB.cats.find(function(c) { return c.id === catId; });
                var catName = cat ? cat.name : catId;
                if (!byCat[catName]) byCat[catName] = [];
                byCat[catName].push(name);
              });
              var isVeg = /veg$/i.test(pkg) && !/non/i.test(pkg);
              return (
                <Card key={pkg} style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{isVeg ? "🌱" : "🍗"} {pkg}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{dishes.length} dishes</div>
                    </div>
                  </div>
                  {Object.entries(byCat).sort(function(a, b) { return a[0].localeCompare(b[0]); }).map(function(entry) {
                    var catName = entry[0]; var items = entry[1];
                    return (
                      <div key={catName} style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 3 }}>{catName} ({items.length})</div>
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{items.join(", ")}</div>
                      </div>
                    );
                  })}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { MenuPackagesView };