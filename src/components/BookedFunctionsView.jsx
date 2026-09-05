// Ambria FnB — Booked Functions View (Sales)
// V78: list of already-booked events, so sales can open the Event Menu Builder to
// correct/update menu + service items post-booking (separate from Proposals, which
// are pre-booking drafts). Place in: src/components/BookedFunctionsView.jsx

import React, { useState, useEffect, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import EventMenuBuilderView from './EventMenuBuilderView.jsx';

export function BookedFunctionsView({ lang = "en", currentUser = null }) {
  var T2 = function(s) { return T(s, lang); };

  var [events, setEvents]       = useState([]);
  var [loading, setLoading]     = useState(true);
  var [searchQ, setSearchQ]     = useState('');
  var [menuBuilderEvent, setMenuBuilderEvent] = useState(null);
  var [menuBuilderTab, setMenuBuilderTab]     = useState('items');

  async function loadEvents() {
    setLoading(true);
    try {
      var rows = await fetchAllRows(function(){
        return supabase.from('events').select('*')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('date', { ascending: true });
      });
      setEvents(rows || []);
    } catch (e) {
      console.error('[BookedFunctions] loadEvents failed:', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(function(){ loadEvents(); }, []);

  function openMenuBuilder(ev, tab) {
    setMenuBuilderTab(tab || 'items');
    setMenuBuilderEvent(ev);
  }
  function closeMenuBuilder() {
    loadEvents();
    setMenuBuilderEvent(null);
    setMenuBuilderTab('items');
  }

  var filteredList = useMemo(function(){
    var q = searchQ.trim().toLowerCase();
    if (!q) return events;
    return events.filter(function(e){
      return (e.guest || '').toLowerCase().includes(q) || (e.venue || '').toLowerCase().includes(q);
    });
  }, [events, searchQ]);

  if (menuBuilderEvent) {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: C.bg }}>
        <EventMenuBuilderView event={menuBuilderEvent} onClose={closeMenuBuilder} lang={lang} currentUser={currentUser} initialTab={menuBuilderTab} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", letterSpacing: 0.3 }}>
          📅 {T2("Booked Functions")}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          {T2("Already-booked events — open one to correct or update its menu and service items.")}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input value={searchQ} onChange={function(e){ setSearchQ(e.target.value); }}
          placeholder={T2("Search guest name or venue…")}
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>
          {filteredList.length} {filteredList.length === 1 ? T2("function") : T2("functions")}
        </span>
      </div>

      {loading && (
        <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 13 }}>{T2("Loading booked functions…")}</div>
        </div>
      )}

      {!loading && filteredList.length === 0 && (
        <div style={{ background: C.surface, borderRadius: 14, border: "1px dashed " + C.border, padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🗂️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", marginBottom: 6 }}>
            {events.length === 0 ? T2("No booked functions yet") : T2("No matches")}
          </div>
          <div style={{ fontSize: 13, color: C.muted, maxWidth: 420, margin: "0 auto", lineHeight: 1.5 }}>
            {events.length === 0
              ? T2("Booked functions appear here once an event is confirmed.")
              : T2("Try clearing search.")}
          </div>
        </div>
      )}

      {!loading && filteredList.length > 0 && (
        <div style={{ background: C.surface, borderRadius: 12, border: "1px solid " + C.border, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr 1fr 0.5fr 1fr 1.4fr", gap: 8, padding: "10px 14px", background: C.bg, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid " + C.border }}>
            <div>{T2("Guest / Event")}</div>
            <div>{T2("Venue")}</div>
            <div>{T2("Date")}</div>
            <div style={{ textAlign: "right" }}>{T2("Pax")}</div>
            <div>{T2("Menu Package")}</div>
            <div style={{ textAlign: "right" }}>{T2("Actions")}</div>
          </div>

          {filteredList.map(function(ev){
            return (
              <div key={ev.id}
                style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr 1fr 0.5fr 1fr 1.4fr", gap: 8, padding: "12px 14px", fontSize: 13, color: C.text, borderBottom: "1px solid " + C.border, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{ev.guest || T2("Function")}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{ev.type || '—'}</div>
                </div>
                <div style={{ fontSize: 12 }}>{ev.venue || '—'}</div>
                <div style={{ fontSize: 12 }}>{ev.date || <span style={{color:C.muted}}>—</span>}</div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ev.pax != null ? ev.pax : '—'}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{ev.menu_package || ev.menuPackage || <span>—</span>}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <button onClick={function(){ openMenuBuilder(ev, 'items'); }} title={T2("Open Menu Builder")}
                    style={{ padding: "5px 10px", borderRadius: 6, background: "#8A70C8", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    🍽 {T2("Menu")}
                  </button>
                  <button onClick={function(){ openMenuBuilder(ev, 'fp'); }} title={T2("Open Function Plan")}
                    style={{ padding: "5px 10px", borderRadius: 6, background: C.wine, border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    📋 {T2("FP")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: C.muted }}>
        {T2("Signed in as")} <b style={{ color: C.text }}>{(currentUser && currentUser.name) || '—'}</b> · {T2("role")}: <b style={{ color: C.text }}>{(currentUser && currentUser.role) || '—'}</b>
      </div>
    </div>
  );
}

export default BookedFunctionsView;
