// Ambria FnB — Menu Print View ("Kitchen Quantity Sheet")
// A plain two-column print of an event's SELECTED dishes, grouped and
// ordered by their real Dish Library (dish_catalogue_sections) section —
// not the package's own section layout, not a dept split. Built for
// back-of-house use during/after service: each dish gets three blank boxes
// (Made / Actual Used / Left) the kitchen fills in by hand, not the
// client-facing Preview Menu (that one's the branded, paginated, photo-led
// version — a different artifact for a different reader). Originally a
// dense single-page masonry list with no write-in room at all — switched
// to a fixed 2-column layout with a wide gutter specifically to make room
// for those boxes per dish; it now reliably runs to 2+ printed pages for a
// large menu, which is an intentional trade against the old "fit one page"
// goal, not a bug.
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

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { resolveDishHindi } from '../data/recipeData.js';

export function MenuPrintView({ event, dishItems, dishSectionOrder, dishSectionName, onClose }) {
  // The sheet's own language is asked explicitly every time it's opened,
  // independent of the app's own UI-language toggle — a kitchen print is
  // read by whoever's at the pass that day, not necessarily the staff
  // member who tapped the button, so defaulting silently to the current
  // app language was the wrong call here.
  var [printLang, setPrintLang] = useState(null);

  if (!printLang) {
    return createPortal(
      <div className="menu-no-print" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: C.surface, borderRadius: 12, padding: 28, width: 300, maxWidth: "90vw", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 18 }}>
            Print menu in / मेनू प्रिंट करें
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={function(){ setPrintLang("en"); }}
              style={{ padding: "12px 16px", borderRadius: 8, background: "#8A70C8", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              English
            </button>
            <button onClick={function(){ setPrintLang("hi"); }}
              style={{ padding: "12px 16px", borderRadius: 8, background: "#8A70C8", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              हिंदी (Hindi)
            </button>
          </div>
          <button onClick={onClose}
            style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, background: "none", border: "1px solid " + C.border, color: C.muted, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>,
      document.body
    );
  }

  var T2 = function(s) { return T(s, printLang); };

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
  }, [dishItems, dishSectionOrder, dishSectionName, printLang]);

  var totalDishes = groups.reduce(function(n, g){ return n + g.dishes.length; }, 0);

  return createPortal(
    <div className="menu-print-root" style={{ position: "fixed", inset: 0, zIndex: 200, background: "#fff", overflowY: "auto" }}>
      {/* Was visibility:hidden on everything else + position:absolute on this
          root — on a one-page sheet (FunctionPlanPrintView.jsx's own print
          CSS, unchanged) an absolutely positioned box never has to split
          across pages, so that pattern never caught this: this sheet now
          routinely runs 2+ pages, and an absolutely positioned box being
          paginated is inconsistent across browsers (Firefox has a long-
          standing bug cutting it off after page 1). display:none on every
          OTHER body child + position:static on this one makes it ordinary
          flowing page content instead, which every browser paginates the
          same, normal way. */}
      <style>{"@media print { body > *:not(.menu-print-root) { display: none !important; } .menu-print-root { position: static !important; inset: auto !important; overflow: visible !important; background: #fff !important; } .menu-no-print { display: none !important; } }"}</style>

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

        {/* Fixed at 2 columns (not the old column-WIDTH masonry, which packed
            as many narrow columns as fit) — each dish now needs room for
            three Made/Actual Used/Left write-in boxes the kitchen fills in
            by hand after service, which a narrow column has no space for.
            columnRule draws the same dashed divider a manual grid would,
            for free. */}
        <div style={{ columnCount: 2, columnGap: 44, columnRule: "1px dashed #bbb" }}>
          {groups.map(function(g){
            return (
              <div key={g.key} style={{ breakInside: "avoid", marginBottom: 12 }}>
                {/* breakInside:avoid above is only a request — a section
                    taller than a whole column/page gets split anyway, and
                    without breakAfter:avoid here the split can land right
                    after the title or the column labels, stranding either
                    one alone with no dishes under it. */}
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1.5px solid #000", paddingBottom: 2, marginBottom: 4, breakAfter: "avoid" }}>
                  {g.name}
                </div>
                {/* 3 write-in columns now (Made / Actual Used / Left) instead
                    of 2 — narrower boxes (44px, was 54px) and a tighter gap
                    (6px, was 8px) to fit all three without shrinking the
                    dish-name column into illegibility; overflowWrap:anywhere
                    on the name below absorbs the rest of the squeeze. */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 3, fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.2, color: "#555", lineHeight: 1.15, breakAfter: "avoid" }}>
                  <span style={{ flex: 1, minWidth: 0 }} />
                  <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>{T2("Made")}</span>
                  <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>{T2("Left")}</span>
                  <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>{T2("Actual Used")}</span>
                </div>
                {g.dishes.map(function(d){
                  return (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: "1px dotted #999", breakInside: "avoid" }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 10, lineHeight: 1.3, overflowWrap: "anywhere" }}>
                        {printLang === "hi" && d.hindi
                          ? <>{d.hindi}<span style={{ color: "#666" }}> ({d.name})</span></>
                          : <>{d.name}{d.hindi ? <span style={{ color: "#666" }}> ({d.hindi})</span> : null}</>}
                      </span>
                      <span style={{ width: 44, height: 20, border: "1px solid #000", borderRadius: 3, flexShrink: 0 }} />
                      <span style={{ width: 44, height: 20, border: "1px solid #000", borderRadius: 3, flexShrink: 0 }} />
                      <span style={{ width: 44, height: 20, border: "1px solid #000", borderRadius: 3, flexShrink: 0 }} />
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
