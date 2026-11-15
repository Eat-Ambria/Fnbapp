// Ambria FnB — Menu Print View
// A plain, dense, single-page-oriented print of an event's SELECTED dishes,
// grouped and ordered by their real Dish Library (dish_catalogue_sections)
// section — not the package's own section layout, not a dept split. Built
// for back-of-house use (what's actually on the menu, section by section),
// not the client-facing Preview Menu (that one's the branded, paginated,
// photo-led version — a different artifact for a different reader).
//
// dishSectionOrder/dishSectionName are passed in rather than re-derived here
// on purpose — EventMenuBuilderView already computes these as the ONE
// authoritative dish->section resolution (effectiveSectionIdByDish), which
// accounts for per-event sectionOverrides ("Add section from library", the
// add-dish modal's section tag) and package-section catalogue links, not
// just dishes_master.section_id directly. A second, independent resolution
// here would silently disagree with the FP print for exactly those cases
// (an ad-hoc dish tagged to a section) — the same drift this file's own
// EventMenuBuilderView already has a comment warning about for its own
// menuDiffByDept/dishSectionOrder split.
// Place in: src/components/MenuPrintView.jsx

import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { resolveDishHindi } from '../data/recipeData.js';

export function MenuPrintView({ event, dishItems, dishSectionOrder, dishSectionName, lang = "en", onClose }) {
  var T2 = function(s) { return T(s, lang); };

  // Sub-venue (which hall/lawn at that venue) and session (Lunch/Dinner/
  // Sundowner) aren't their own columns on events — they only ever arrive
  // as part of the raw LMS contract snapshot, under different field names
  // depending on whether it synced in as a venue or a catering contract.
  // odc_location is the one real column equivalent, for outdoor events that
  // have no "hall" at all, just the client's own site. chcd_address1 was
  // tried here too, but it's a raw catering-side address/id reference (e.g.
  // "36"), not a hall name — confirmed against live data, dropped.
  var headerMeta = useMemo(function(){
    var raw = (event && event.lms_raw) || {};
    function clean(v) { return (v && String(v).trim()) || ''; }
    return {
      subVenue: clean(raw.address1) || clean(event && event.odc_location),
      session: clean(raw.fiscd_session) || clean(raw.chcd_session),
    };
  }, [event]);

  var groups = useMemo(function(){
    var bySection = {}; // sectionName -> { name, order, dishes: [] }
    (dishItems || []).forEach(function(row){
      var name = row.dish_name;
      if (!name) return;
      // dishSectionName's own fallback for "no real section" is the literal
      // string 'Extras' (see EventMenuBuilderView) — relabeled to "Other"
      // here to match what was actually asked for, without forking the
      // underlying resolution itself.
      var rawName = (dishSectionName && dishSectionName[name]) || 'Extras';
      var sectionName = rawName === 'Extras' ? T2('Other') : rawName;
      var order = (dishSectionOrder && dishSectionOrder[name] != null) ? dishSectionOrder[name] : Infinity;
      var key = sectionName;
      if (!bySection[key]) bySection[key] = { key: key, name: sectionName, order: order, dishes: [] };
      bySection[key].dishes.push({
        name: name,
        hindi: resolveDishHindi ? resolveDishHindi(name) : '',
      });
    });

    var out = Object.values(bySection);
    out.forEach(function(g){
      g.dishes.sort(function(a, b){ return a.name.localeCompare(b.name); });
    });
    out.sort(function(a, b){ return a.order - b.order; });
    return out;
  }, [dishItems, dishSectionOrder, dishSectionName, lang]);

  var totalDishes = groups.reduce(function(n, g){ return n + g.dishes.length; }, 0);

  return createPortal(
    <div className="menu-print-root" style={{ position: "fixed", inset: 0, zIndex: 200, background: "#fff", overflowY: "auto" }}>
      <style>{"@media print { body * { visibility: hidden !important; } .menu-print-root, .menu-print-root * { visibility: visible !important; } .menu-print-root { position: absolute !important; inset: auto !important; left: 0 !important; top: 0 !important; width: 100% !important; height: auto !important; overflow: visible !important; } .menu-no-print { display: none !important; } }"}</style>

      <div className="menu-no-print" style={{ position: "sticky", top: 0, zIndex: 1, background: C.surface, borderBottom: "1px solid " + C.border, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
        <span style={{ marginRight: "auto", fontSize: 11.5, color: C.muted }}>
          {totalDishes} {T2("dishes")} · {groups.length} {T2("sections")}
        </span>
        <button onClick={onClose}
          style={{ padding: "8px 16px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          {T2("Close")}
        </button>
        <button onClick={function(){ window.print(); }}
          style={{ padding: "8px 16px", borderRadius: 8, background: "#8A70C8", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          🖨 {T2("Print")}
        </button>
      </div>

      <div style={{ padding: "14px 18px", fontFamily: "Arial, Helvetica, sans-serif", color: "#000" }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1.5px solid #000", paddingBottom: 6, marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{(event && event.guest) || T2("Function")}</div>
            <div style={{ fontSize: 10.5, color: "#333" }}>
              {[event && event.date, (event && event.pax != null) ? (event.pax + ' ' + T2('pax')) : null].filter(Boolean).join(' · ')}
            </div>
          </div>
          {/* Venue/sub-venue/session/package — the things a kitchen or
              service team actually needs to find at a glance before even
              reading a single dish, so this is the one part of the sheet
              that intentionally breaks the "plain list" rule with real
              visual weight. */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
            {(event && (event.venue || headerMeta.subVenue)) && (
              // background-color alone is NOT reliable here -- most browsers
              // print with "background graphics" off by default, which drops
              // the black fill but keeps the white text, printing invisible
              // white-on-white. WebkitPrintColorAdjust/printColorAdjust:exact
              // (same fix already used in FunctionPlanPrintView.jsx/
              // MenuBuilderPreview.jsx) makes Chrome/Firefox keep it anyway;
              // the border is a backstop for whatever doesn't.
              <div style={{ background: "#000", color: "#fff", border: "2px solid #000", borderRadius: 4, padding: "5px 12px", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3 }}>{event.venue || headerMeta.subVenue}</div>
                {event.venue && headerMeta.subVenue && <div style={{ fontSize: 9, opacity: 0.85 }}>{headerMeta.subVenue}</div>}
              </div>
            )}
            {headerMeta.session && (
              <div style={{ border: "1.5px solid #000", borderRadius: 4, padding: "5px 12px", display: "flex", alignItems: "center", fontSize: 11, fontWeight: 700 }}>
                {headerMeta.session}
              </div>
            )}
            {(event && event.menu_package) && (
              <div style={{ border: "1.5px solid #000", borderRadius: 4, padding: "5px 12px", display: "flex", alignItems: "center", fontSize: 11, fontWeight: 700 }}>
                {event.menu_package}
              </div>
            )}
          </div>
        </div>

        <div style={{ columnWidth: 210, columnGap: 20 }}>
          {groups.map(function(g){
            return (
              <div key={g.key} style={{ breakInside: "avoid", marginBottom: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1px solid #888", paddingBottom: 1, marginBottom: 2 }}>
                  {g.name}
                </div>
                {g.dishes.map(function(d){
                  return (
                    <div key={d.name} style={{ fontSize: 9, lineHeight: 1.35 }}>
                      {d.name}{d.hindi ? <span style={{ color: "#555" }}> ({d.hindi})</span> : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
