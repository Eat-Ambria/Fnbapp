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
  var [search, setSearch]       = useState('');
  var [dateFilter, setDateFilter] = useState('all'); // all | today | tomorrow | week

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

  var weekAhead = localDateStr(new Date(Date.now() + 7 * 86400000));

  var upcoming = useMemo(function(){
    return safeArr(events)
      .filter(function(e){ return e.date && e.date >= TODAY; })
      .filter(function(e){
        if (dateFilter === 'today') return e.date === TODAY;
        if (dateFilter === 'tomorrow') return e.date === TOMORROW;
        if (dateFilter === 'week') return e.date <= weekAhead;
        return true;
      })
      .filter(function(e){
        if (!search.trim()) return true;
        var q = search.trim().toLowerCase();
        return (e.guest || '').toLowerCase().indexOf(q) >= 0 || (e.venue || '').toLowerCase().indexOf(q) >= 0;
      })
      .sort(function(a, b){
        if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
        return (a.time || '').localeCompare(b.time || '');
      });
  // eslint-disable-next-line
  }, [events, search, dateFilter]);

  var byDate = useMemo(function(){
    var m = {};
    upcoming.forEach(function(e){ (m[e.date] = m[e.date] || []).push(e); });
    return m;
  }, [upcoming]);

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
          {T2("Shared link — no login needed. Tap a function once its Function Plan is ready to view it.")}
        </div>

        {/* ── Controls ── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid " + K.line, borderRadius: 999, padding: "10px 16px" }}>
            <Icon name="search" size={15} strokeWidth={2} color={K.textFaint} />
            <input value={search} onChange={function(e){ setSearch(e.target.value); }}
              placeholder={T2("Search by client or venue…")}
              style={{ border: "none", outline: "none", flex: 1, fontSize: 13, background: "transparent", color: K.text }} />
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {[
              { id: 'all',      label: T2('All') },
              { id: 'today',    label: T2('Today') },
              { id: 'tomorrow', label: T2('Tomorrow') },
              { id: 'week',     label: T2('This week') },
            ].map(function(f){
              var on = dateFilter === f.id;
              return (
                <button key={f.id} onClick={function(){ setDateFilter(f.id); }}
                  style={{ padding: "8px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                    border: "1px solid " + (on ? K.brand : K.line), background: on ? K.brand : "#fff", color: on ? "#fff" : K.textBody }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── List ── */}
        {Object.keys(byDate).length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: K.textFaint, fontSize: 13 }}>{T2("No upcoming functions")}</div>
        )}

        {Object.entries(byDate).map(function(entry){
          var date = entry[0]; var evs = entry[1];
          var isToday = date === TODAY;
          var isTmrw = date === TOMORROW;
          var d = new Date(date + "T00:00");
          var tone = isToday ? { bg: K.brand, fg: "#FFFFFF" } : isTmrw ? { bg: K.warnBg, fg: K.warn } : { bg: "#FFFFFF", fg: K.hdrMeta };
          var eyebrow = isToday ? T2("Today") : isTmrw ? T2("Tomorrow") : d.toLocaleDateString("en", { weekday: 'short', day: 'numeric', month: 'short' });
          return (
            <div key={date}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: K.textFaint, marginBottom: 10, paddingLeft: 2 }}>{eyebrow}</div>
              {evs.map(function(ev){
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
                      <span style={{ width: 62, height: 62, borderRadius: 16, flexShrink: 0, background: tone.bg,
                        border: "1px solid " + (isToday ? K.brand : K.cardWarmLine),
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: tone.fg }}>{d.getDate()}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.6, color: tone.fg }}>{d.toLocaleString("en", { month: "short" })}</span>
                      </span>
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
        })}

        <div style={{ textAlign: "center", fontSize: 11.5, color: K.textFaint, padding: "18px 0 6px" }}>
          {T2("Ambria FnB Operations · Get Your Venue Events Pvt Ltd")}
        </div>
      </div>
    </div>
  );
}
