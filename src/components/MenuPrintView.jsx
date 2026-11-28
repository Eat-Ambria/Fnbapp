// Ambria FnB — Menu Print View ("Kitchen Quantity Sheet")
// A plain print of an event's SELECTED dishes, grouped by their SOP/recipe
// category (RECIPE_DB.cats via getCatForDish — "the SOP section mapping",
// the same taxonomy Dish Library's own "Maps to"/"SOP" badge uses), ONE
// PRINTED PAGE PER SOP SECTION so a kitchen head can hand each page to
// whichever station is actually cooking those dishes. Built for
// back-of-house use during/after service: each dish gets three blank boxes
// (Made / Actual Used / Left) the kitchen fills in by hand, not the
// client-facing Preview Menu (that one's the branded, paginated, photo-led
// version — a different artifact for a different reader).
//
// Deliberately grouped by SOP/recipe category, NOT by the catalogue/menu
// section (dish_catalogue_sections) the printed Function Plan and the
// client-facing menu use — this was changed by request: the menu's own
// section (e.g. "Fresh Juice", "Chaat Station") is how a dish is PRESENTED
// to a client, which routinely differs from which kitchen STATION actually
// cooks it (that's what the recipe category/SOP mapping encodes). Assigning
// kitchen staff a sheet makes sense per station, not per menu section.
// Place in: src/components/MenuPrintView.jsx

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { resolveDishHindi, getCatForDish, RECIPE_DB } from '../data/recipeData.js';

export function MenuPrintView({ event, dishItems, onClose }) {
  // The sheet's own language is asked explicitly every time it's opened,
  // independent of the app's own UI-language toggle — a kitchen print is
  // read by whoever's at the pass that day, not necessarily the staff
  // member who tapped the button, so defaulting silently to the current
  // app language was the wrong call here.
  var [printLang, setPrintLang] = useState(null);

  // Hooks must run unconditionally on every render (Rules of Hooks) — the
  // language-chooser screen below is an early RETURN after all hooks have
  // already run, never a return before them. Putting it before headerMeta/
  // groups's useMemo calls made the first render (no printLang yet) call
  // fewer hooks than the second (after picking a language), which is
  // exactly React error #310 ("rendered more hooks than previous render").
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
    // Same declared order Dish Library's own recipe categories are kept in
    // (RECIPE_DB.cats is sorted by sort_order at hydrate — see dbConfig.js's
    // transformRecipeCategories) — a category not in that list (shouldn't
    // happen, but getCatForDish's own fallback can synthesize one) sorts
    // after every real one instead of arbitrarily.
    var order = (RECIPE_DB.cats || []).map(function(c){ return c.id; });
    var byCat = {}; // catId -> { name, order, dishes: [] }
    (dishItems || []).forEach(function(row){
      var name = row.dish_name;
      if (!name) return;
      var cat = getCatForDish(name);
      var key = cat.id;
      if (!byCat[key]) {
        var idx = order.indexOf(key);
        byCat[key] = { key: key, name: T2(cat.name), order: idx === -1 ? Infinity : idx, dishes: [] };
      }
      byCat[key].dishes.push({
        name: name,
        hindi: resolveDishHindi ? resolveDishHindi(name) : '',
      });
    });

    var out = Object.values(byCat);
    out.forEach(function(g){
      g.dishes.sort(function(a, b){ return a.name.localeCompare(b.name); });
    });
    out.sort(function(a, b){ return a.order - b.order; });
    return out;
  }, [dishItems, printLang]);

  var totalDishes = groups.reduce(function(n, g){ return n + g.dishes.length; }, 0);

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
          </div>
          {/* Date/pax/venue/sub-venue/session/package — the things a kitchen
              or service team actually needs to find at a glance before even
              reading a single dish, so this is the one part of the sheet
              that intentionally breaks the "plain list" rule with real
              visual weight. Date/pax used to be small plain text off to the
              side, easy to miss next to these bold badges — now its own
              badge in the same row, in the brand amber accent (C.amber/
              amberBg) specifically so it reads as distinct from, not lower-
              priority than, venue/session/package. */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
            {(event && (event.date || event.pax != null)) && (
              <div style={{ background: C.amberBg, color: C.amber, border: "2px solid " + C.amber, borderRadius: 4, padding: "5px 12px", display: "flex", alignItems: "center", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                {[event.date, (event.pax != null) ? (event.pax + ' ' + T2('pax')) : null].filter(Boolean).join(' · ')}
              </div>
            )}
            {(event && (event.venue || headerMeta.subVenue)) && (
              // background-color alone is NOT reliable here -- most browsers
              // print with "background graphics" off by default, which drops
              // the black fill but keeps the white text, printing invisible
              // white-on-white. WebkitPrintColorAdjust/printColorAdjust:exact
              // (same fix already used in FunctionPlanPrintView.jsx/
              // MenuBuilderPreview.jsx) makes Chrome/Firefox keep it anyway;
              // the border is a backstop for whatever doesn't.
              <div style={{ background: "#000", color: "#fff", border: "2px solid #000", borderRadius: 4, padding: "5px 12px", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3 }}>{T2(event.venue || headerMeta.subVenue)}</div>
                {event.venue && headerMeta.subVenue && <div style={{ fontSize: 9, opacity: 0.85 }}>{T2(headerMeta.subVenue)}</div>}
              </div>
            )}
            {headerMeta.session && (
              <div style={{ border: "1.5px solid #000", borderRadius: 4, padding: "5px 12px", display: "flex", alignItems: "center", fontSize: 11, fontWeight: 700 }}>
                {T2(headerMeta.session)}
              </div>
            )}
            {(event && event.menu_package) && (
              <div style={{ border: "1.5px solid #000", borderRadius: 4, padding: "5px 12px", display: "flex", alignItems: "center", fontSize: 11, fontWeight: 700 }}>
                {T2(event.menu_package)}
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
        {/* One page per SOP section (by request, so a kitchen head can hand
            each page to whichever station is cooking it) — each group is
            its own 2-column box rather than the whole sheet sharing one
            multicol flow, and breakBefore:"page" forces every section but
            the first onto a fresh page regardless of how much room was left
            on the previous one (a shared flow would otherwise let the next
            section start filling whatever column space the last one left
            over, same page). */}
        {groups.map(function(g, gi){
          return (
            <div key={g.key} style={{ breakBefore: gi === 0 ? "auto" : "page", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "2px solid #000", paddingBottom: 4, marginBottom: 8, breakAfter: "avoid" }}>
                {g.name} <span style={{ fontWeight: 500, fontSize: 10, color: "#555", textTransform: "none" }}>· {g.dishes.length} {T2("dishes")}</span>
              </div>
              <div style={{ columnCount: 2, columnGap: 44, columnRule: "1px dashed #bbb" }}>
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
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
