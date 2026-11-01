// Ambria FnB — Function Plans Hub
// A standalone, logged-in screen listing current/upcoming/past functions so
// any staff member with access can look up a function's FP without going
// through Booked Functions or a Kitchen Hub sub-tab. Clicking a function
// opens the same print view Booked Functions/Build Menu use
// (EventMenuBuilderView with autoOpenPrint) — this file only adds the list
// in front of it, same pattern as PublicFPHub.jsx's unauthenticated cousin.
import React, { useState, useEffect } from "react";
import { T } from '../data/translations.js';
import { K, type } from '../utils/theme.js';
import { Icon } from './Icons.jsx';
import { ripple } from '../utils/ripple.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import { safeArr, TODAY, localDateStr } from '../utils/helpers.js';
import { EventMenuBuilderView } from './EventMenuBuilderView.jsx';

// Venue tint for the left accent bar + meta text — same small lookup
// KitchenHub.jsx keeps for its own event cards; no shared export exists for
// it since it's cosmetic and only used in a couple of list views.
const ANA_VP = {"Ambria Pushpanjali":{code:"AP",c:"#D85A30"},"Ambria Exotica":{code:"AE",c:"#BA7517"},"Manaktala Farm":{code:"MKT",c:"#2563EB"},"Ambria Restro":{code:"AR",c:"#1D9E75"},"Outdoor Catering (ODC)":{code:"ODC",c:"#7F77DD"},"Ambria Manaktala":{code:"AM",c:"#BA7517"}};
const anaGp = v => ANA_VP[v] || {code:"EV",c:"#2563EB"};

function FunctionPlansHub({ events, lang, currentUser }) {
  const T2 = s => T(s, lang);
  const evList = safeArr(events);

  const [fpViewEvId, setFpViewEvId] = useState(null);
  const [fpStatusMap, setFpStatusMap] = useState({});
  function loadFpStatusMap() {
    fetchAllRows(() => supabase.from('event_function_plans').select('event_id, locked, sent_to_kitchen, locked_by, created_by'))
      .then(rows => {
        const map = {};
        (rows || []).forEach(r => { map[r.event_id] = { locked: !!r.locked, sentToKitchen: !!r.sent_to_kitchen, lockedBy: r.locked_by || '', createdBy: r.created_by || '' }; });
        setFpStatusMap(map);
      })
      .catch(e => console.error('[FunctionPlansHub] loadFpStatusMap failed:', e));
  }
  useEffect(() => { loadFpStatusMap(); }, []);

  function fpStatusFor(ev) {
    const row = fpStatusMap[ev.id];
    if (!row) return { label: T2("Not made"), bg: K.surfaceAlt, border: K.line, color: K.textFaint };
    if (row.sentToKitchen) return { label: T2("Sent to Kitchen"), bg: K.okBg, border: K.okBorder, color: K.ok };
    if (row.locked) return { label: T2("Locked"), bg: K.brandBg, border: K.brandBorder, color: K.brandText };
    return { label: T2("Made"), bg: K.warnBg, border: K.warnBorder, color: K.warn };
  }

  const todayEvs = evList.filter(e => e.date === TODAY).sort((a,b) => (a.time||"").localeCompare(b.time||""));
  // "T00:00" (no "Z") parses in local time — avoids the UTC-string-parse
  // shift CLAUDE.md flags elsewhere in this app.
  const past30Cutoff = (() => { const d = new Date(TODAY+"T00:00"); d.setDate(d.getDate()-30); return localDateStr(d); })();
  const pastEvs = evList.filter(e => e.date < TODAY && e.date >= past30Cutoff).sort((a,b) => b.date.localeCompare(a.date) || (b.time||"").localeCompare(a.time||""));
  const upcomingEvs = evList.filter(e => e.date > TODAY).sort((a,b) => a.date.localeCompare(b.date) || (a.time||"").localeCompare(b.time||""));
  const fmtDate = d => { try { return new Date(d+"T00:00").toLocaleDateString("en-IN", {day:"numeric", month:"short", weekday:"short"}); } catch(e) { return d; } };

  function evCard(ev) {
    const st = fpStatusFor(ev);
    const vc = anaGp(ev.venue);
    return (
      <button key={ev.id} onClick={() => setFpViewEvId(ev.id)} className="kh-sopcard kh-cardart-sm kh-rip" onPointerDown={ripple}
        style={{display:"block", width:"100%", textAlign:"left", padding:"14px 16px", borderRadius:16, cursor:"pointer",
          backgroundColor:K.cardWarm, border:`1px solid ${K.cardWarmLine}`, borderLeft:`4px solid ${vc.c}`,
          boxShadow:K.shadowCard, fontFamily:K.fontBody}}>
        <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10}}>
          <span style={{display:"block", fontSize:15, fontWeight:700, letterSpacing:"-0.2px", color:K.hdrTitle,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{ev.guest || T2("Function")}</span>
          <span style={{flexShrink:0, padding:"3px 10px", borderRadius:K.rPill, fontSize:11, fontWeight:700,
            background:st.bg, border:`1px solid ${st.border}`, color:st.color}}>{st.label}</span>
        </div>
        <span style={{display:"flex", alignItems:"center", gap:7, marginTop:5, fontSize:12.5, color:K.hdrMeta, flexWrap:"wrap"}}>
          <Icon name="calendar" size={13} strokeWidth={1.9}/>{fmtDate(ev.date)}
          {ev.time && <><span style={{color:K.textFaint}}>·</span>{ev.time.slice(0,5)}</>}
          <span style={{color:K.textFaint}}>·</span>
          <Icon name="users" size={13} strokeWidth={1.9}/>{ev.pax} pax
          {ev.venue && <><span style={{color:K.textFaint}}>·</span><span style={{color:vc.c, fontWeight:600}}>{ev.venue}</span></>}
        </span>
      </button>
    );
  }

  function evGroup(title, evs, emptyMsg) {
    return (
      <div style={{marginBottom:22}}>
        <div style={{...type.label, fontSize:11, color:K.textMuted, marginBottom:8, letterSpacing:.4}}>{title} · {evs.length}</div>
        {evs.length === 0 ? (
          <div style={{padding:"16px 18px", textAlign:"center", backgroundColor:K.cardWarm, border:`1px solid ${K.cardWarmLine}`,
            borderRadius:16, fontSize:12.5, color:K.hdrMeta}}>{emptyMsg}</div>
        ) : (
          <div className="kh-soprows">{evs.map(evCard)}</div>
        )}
      </div>
    );
  }

  const fpEv = fpViewEvId ? evList.find(e => e.id === fpViewEvId) : null;

  return (
    <div className="kh-scope" style={{position:"relative", display:"flex", flexDirection:"column", height:"100%", minHeight:0}}>
      <div style={{padding:"20px 24px 40px", overflowY:"auto"}}>
        <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:18}}>
          <Icon name="fileText" size={20} strokeWidth={1.9} style={{color:K.brandText}}/>
          <span style={{fontSize:19, fontWeight:700, letterSpacing:"-0.3px", color:K.hdrTitle}}>{T2("Function Plans")}</span>
        </div>
        {evGroup(T2("Today"), todayEvs, T2("No functions today"))}
        {evGroup(T2("Upcoming"), upcomingEvs, T2("No upcoming functions"))}
        {evGroup(T2("Past (last 30 days)"), pastEvs, T2("No functions in the last 30 days"))}
      </div>

      {fpEv && (
        <div style={{position:"fixed", inset:0, zIndex:2000, background:K.surface, overflow:"auto"}}>
          <EventMenuBuilderView event={fpEv} onClose={() => { setFpViewEvId(null); loadFpStatusMap(); }}
            lang={lang} currentUser={currentUser} autoOpenPrint={true} />
        </div>
      )}
    </div>
  );
}

export { FunctionPlansHub };
