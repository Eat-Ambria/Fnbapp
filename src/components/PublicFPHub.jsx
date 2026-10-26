// Ambria FnB — Public Function Plan hub
// An unauthenticated, link-shareable page listing upcoming functions, for
// people with no app login (venue/vendor partners) who just need to see a
// function's printed FP once it exists. Reached via ?fp=1 on the live URL —
// App.jsx checks for that before the login gate and renders this instead of
// LoginScreen, after the normal boot load (events, MENU_PACKAGES, sales
// configs) has already finished, so everything this needs is already hydrated.
// Clicking a ready function mounts the existing EventMenuBuilderView in its
// FP-print mode (autoOpenPrint) — the printed sheet itself is NOT redesigned
// here, this file only adds the list in front of it.
// Place in: src/components/PublicFPHub.jsx

import React, { useState, useEffect, useMemo } from "react";
import { T } from '../data/translations.js';
import { K, type } from '../utils/theme.js';
import { Icon } from './Icons.jsx';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import { safeArr, TODAY, TOMORROW, localDateStr } from '../utils/helpers.js';
import { EventMenuBuilderView } from './EventMenuBuilderView.jsx';

export function PublicFPHub({ events, lang = "en" }) {
  var T2 = function(s) { return T(s, lang); };

  var [selEvId, setSelEvId] = useState(function(){
    try { return new URLSearchParams(window.location.search).get('event') || null; } catch (e) { return null; }
  });

  // ── Calendar: pick a date first, then the day's functions show below it. ──
  var now = new Date();
  var [calYr, setCalYr] = useState(now.getFullYear());
  var [calMo, setCalMo] = useState(now.getMonth());
  var [selDate, setSelDate] = useState(null);
  function prevMo(){ setCalMo(function(m){ if (m === 0) { setCalYr(function(y){ return y - 1; }); return 11; } return m - 1; }); }
  function nextMo(){ setCalMo(function(m){ if (m === 11) { setCalYr(function(y){ return y + 1; }); return 0; } return m + 1; }); }

  // Same read MenuPackagesView's list uses to show FP status without opening
  // each function — not made / made / locked.
  var [fpMap, setFpMap] = useState({});
  useEffect(function(){
    fetchAllRows(function(){ return supabase.from('event_function_plans').select('event_id, locked'); })
      .then(function(rows){
        var map = {};
        (rows || []).forEach(function(r){ map[r.event_id] = { locked: !!r.locked }; });
        setFpMap(map);
      })
      .catch(function(e){ console.error('[PublicFPHub] loadFpStatuses failed:', e); });
  }, []);

  function fpStatusFor(ev) {
    var row = fpMap[ev.id];
    if (!row) return { key: 'none', label: T2('Not ready yet') };
    if (row.locked) return { key: 'locked', label: T2('FP Ready') };
    return { key: 'made', label: T2('FP Draft') };
  }

  var selEv = useMemo(function(){
    return safeArr(events).find(function(e){ return e.id === selEvId; }) || null;
  }, [events, selEvId]);

  function openEvent(ev) {
    setSelEvId(ev.id);
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('event', ev.id);
      window.history.pushState({}, '', url);
    } catch (e) {}
  }
  function backToList() {
    setSelEvId(null);
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete('event');
      window.history.pushState({}, '', url);
    } catch (e) {}
  }

  // "upcoming" still means strictly today-or-later — only used for the
  // header's "N upcoming functions" badge.
  var upcoming = useMemo(function(){
    return safeArr(events).filter(function(e){ return e.date && e.date >= TODAY; });
  }, [events]);

  // The calendar itself shows every function, past or future, so picking an
  // older date still lists (and links to) its Function Plan — the badge
  // above stays "upcoming"-only, this just feeds the day cells/dots/list.
  var eventsByDate = useMemo(function(){
    var m = {};
    safeArr(events).forEach(function(e){ if (e.date) (m[e.date] = m[e.date] || []).push(e); });
    Object.keys(m).forEach(function(date){
      m[date].sort(function(a, b){ return (a.time || '').localeCompare(b.time || ''); });
    });
    return m;
  }, [events]);

  var cells = useMemo(function(){
    var first = new Date(calYr, calMo, 1);
    var startWeekday = first.getDay();
    var daysInMonth = new Date(calYr, calMo + 1, 0).getDate();
    var arr = [];
    for (var i = 0; i < startWeekday; i++) arr.push(null);
    for (var d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [calYr, calMo]);

  var dayEvs = selDate ? (eventsByDate[selDate] || []) : [];
  var MO_N = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Every hook above runs on every render regardless of selEv — this branch
  // has to come after all of them, never before, or clicking a card changes
  // how many hooks ran and React throws (minified error #300/#310).
  if (selEv) {
    return (
      <EventMenuBuilderView
        event={selEv}
        onClose={backToList}
        lang={lang}
        currentUser={null}
        initialTab="fp"
        autoOpenPrint={true}
      />
    );
  }

  return (
    <div className="kh-scope" style={{ minHeight: "100vh", background: K.canvas, padding: "32px 16px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Header plate ── */}
        <div style={{ background: K.hdrBg, border: "1px solid " + K.hdrLine, borderRadius: K.rXl, padding: "26px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", boxShadow: K.shadowCard }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: K.hdrBadge, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(28,61,43,.25)" }}>
              <Icon name="chefHat" size={24} strokeWidth={1.8} color={K.hdrBadgeIcon} />
            </div>
            <div>
              <div style={{ ...type.pageTitle, fontSize: 26, color: K.hdrTitle }}>{T2("Ambria FnB Operations")}</div>
              <div style={{ fontSize: 12, fontStyle: "italic", fontWeight: 600, color: K.gold, marginTop: 2 }}>{T2("Function Plans — Shared View")}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: K.brandBg, border: "1px solid " + K.brandBorder, color: K.brandText, padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: K.ok }} />
            {upcoming.length} {upcoming.length === 1 ? T2("upcoming function") : T2("upcoming functions")}
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: K.hdrMeta, padding: "0 4px" }}>
          {T2("Shared link — no login needed. Pick a date below, then tap a function once its Function Plan is ready to view it.")}
        </div>

        {/* ── Calendar ── */}
        <div style={{ backgroundColor: K.cardWarm, border: "1px solid " + K.cardWarmLine, borderRadius: 20, overflow: "hidden", boxShadow: K.shadowCard }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", flexWrap: "wrap" }}>
            <span style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: "#F0EEE7", color: K.hdrMeta, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 4 }}>
              <Icon name="calendarDays" size={19} strokeWidth={1.8} />
            </span>
            <div style={{ ...type.sectionHead, fontSize: 24, fontWeight: 700, color: K.hdrTitle, letterSpacing: "-0.4px", marginRight: 6 }}>
              {T2(MO_N[calMo])} {calYr}
            </div>
            <button onClick={prevMo} aria-label={T2("Previous month")}
              style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid " + K.cardWarmLine, background: "#FFFFFF", cursor: "pointer", color: K.textBody, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="chevronL" size={15} strokeWidth={2.1} />
            </button>
            <button onClick={nextMo} aria-label={T2("Next month")}
              style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid " + K.cardWarmLine, background: "#FFFFFF", cursor: "pointer", color: K.textBody, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="chevronR" size={15} strokeWidth={2.1} />
            </button>
            <button onClick={function(){ setCalYr(now.getFullYear()); setCalMo(now.getMonth()); setSelDate(TODAY); }}
              style={{ marginLeft: 6, padding: "8px 20px", borderRadius: 999, background: "#FFFFFF", border: "1px solid " + K.cardWarmLine, color: K.textBody, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {T2("Today")}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", background: "#F4F2EC", borderTop: "1px solid " + K.cardWarmLine, borderBottom: "1px solid " + K.cardWarmLine }}>
            {DY.map(function(d){ return <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: K.hdrMeta, padding: "9px 0" }}>{T2(d)}</div>; })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))" }}>
            {cells.map(function(dNum, i){
              var dt = dNum ? localDateStr(new Date(calYr, calMo, dNum)) : null;
              var evs = dt ? (eventsByDate[dt] || []) : [];
              var isToday = dt === TODAY;
              var isSel = dt === selDate;
              var isPast = dt && dt < TODAY;
              // Past dates stay visually dimmed (still useful to tell "this
              // already happened" at a glance) but are pickable too, so an
              // older function's FP can still be pulled up from this link.
              var clickable = !!dt;
              return (
                <div key={i} onClick={function(){ if (clickable) setSelDate(dt); }}
                  className={clickable ? "kh-calcell" : undefined}
                  style={{ minHeight: 60, padding: 3, cursor: clickable ? "pointer" : "default", minWidth: 0,
                    borderBottom: "1px solid " + K.lineSoft, borderRight: (i % 7) < 6 ? "1px solid " + K.lineSoft : "none",
                    opacity: dNum ? (isPast ? 0.42 : 1) : 0.32 }}>
                  <div style={{ height: "100%", borderRadius: 10, padding: "4px 5px", display: "flex", flexDirection: "column", alignItems: "center",
                    background: isSel ? K.sageSel : isToday ? "#F6EFDD" : "transparent",
                    border: "1px solid " + (isToday ? K.goldSoft : "transparent") }}>
                    {dNum && (<>
                      <span style={{ minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, boxSizing: "border-box",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontVariantNumeric: "tabular-nums",
                        fontWeight: isToday || isSel ? 700 : 500,
                        background: isToday ? "#F2D9C8" : "transparent",
                        color: isSel ? K.sageText : isToday ? K.gold : K.textBody }}>{dNum}</span>
                      {evs.length > 0 && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", marginTop: 3, background: isPast ? K.textFaint : K.brand }} />
                      )}
                    </>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Functions on the picked date ── */}
        {selDate && (function(){
          var isToday = selDate === TODAY;
          var isTmrw = selDate === TOMORROW;
          var d = new Date(selDate + "T00:00");
          var label = isToday ? T2("Today") : isTmrw ? T2("Tomorrow") : d.toLocaleDateString("en", { weekday: 'long', day: 'numeric', month: 'long' });
          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ ...type.sectionHead, fontSize: 18, color: K.hdrTitle }}>{label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: dayEvs.length ? K.brandText : K.textFaint,
                  background: dayEvs.length ? K.brandBg : K.surfaceAlt, border: "1px solid " + (dayEvs.length ? K.brandBorder : K.line),
                  padding: "4px 11px", borderRadius: 999 }}>
                  {dayEvs.length} {dayEvs.length === 1 ? T2("function") : T2("functions")}
                </span>
              </div>

              {dayEvs.length === 0 && (
                <div style={{ textAlign: "center", padding: 32, color: K.textFaint, fontSize: 13, backgroundColor: K.cardWarm, border: "1px solid " + K.cardWarmLine, borderRadius: 16 }}>
                  {T2("No functions on this date")}
                </div>
              )}

              {dayEvs.map(function(ev){
                var fpSt = fpStatusFor(ev);
                var clickable = fpSt.key === 'made' || fpSt.key === 'locked';
                var badgeTone = fpSt.key === 'locked' ? { bg: K.okBg, fg: K.ok, border: K.okBorder }
                  : fpSt.key === 'made' ? { bg: K.warnBg, fg: K.warn, border: K.warnBorder }
                  : { bg: "#FFFFFF", fg: K.textFaint, border: K.cardWarmLine };
                return (
                  <div key={ev.id} style={{ position: "relative", marginBottom: 12 }}>
                    <button onClick={function(){ if (clickable) openEvent(ev); }}
                      disabled={!clickable}
                      className={clickable ? "kh-evcard kh-cardart-sm" : ""}
                      style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", textAlign: "left",
                        position: "relative", backgroundColor: K.cardWarm, border: "1px solid " + K.cardWarmLine,
                        borderRadius: 18, padding: "16px 20px", cursor: clickable ? "pointer" : "default",
                        overflow: "hidden", boxShadow: K.shadowCard, opacity: clickable ? 1 : 0.62 }}>
                      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: isToday ? K.brand : isTmrw ? K.warn : "transparent" }} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: K.hdrTitle }}>{ev.guest || T2("Function")}</span>
                          <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
                            background: badgeTone.bg, color: badgeTone.fg, border: "1px solid " + badgeTone.border, whiteSpace: "nowrap" }}>
                            {fpSt.label}
                          </span>
                        </span>
                        <span style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 7, fontSize: 12.5, color: K.hdrMeta }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="building" size={13} strokeWidth={1.9} />{ev.venue || "—"}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="clock" size={13} strokeWidth={1.9} />{ev.time || T2("TBD")}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="users" size={13} strokeWidth={1.9} />{ev.pax || "?"} {T2("pax")}</span>
                        </span>
                      </span>
                      <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        color: clickable ? K.brand : K.textFaint, background: clickable ? K.brandBg : "transparent" }}>
                        <Icon name={clickable ? "chevronR" : "lock"} size={clickable ? 15 : 14} strokeWidth={2.2} />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div style={{ textAlign: "center", fontSize: 11.5, color: K.textFaint, padding: "18px 0 6px" }}>
          {T2("Ambria FnB Operations · Get Your Venue Events Pvt Ltd")}
        </div>
      </div>
    </div>
  );
}
