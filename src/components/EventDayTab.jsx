// Ambria FnB — Event Day Tab (redesigned)
// Place in: src/components/EventDayTab.jsx
import React, { useState } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, safeArr, safePct, localDateStr, fmtStamp } from '../utils/helpers.js';
import { getCatIdForDish, getCatForDish, RECIPE_DB, getFullSteps, getStepsForDish, fmtT, getIngrForDish } from '../data/recipeData.js';
import { Card } from './SharedUI.jsx';

// ── Strip hardcoded quantities from SOP step text ──
function cleanStepText(text) {
  if (!text) return "";
  return text
    .replace(/\(\s*[\d.,]+\s*(?:kg|gm?|ml|li?t(?:re|er)?s?|pcs?|pieces?)\s*(?:\/\s*[\d.,]+\s*(?:PAX|pax))?\s*\)/gi, "")
    .replace(/\b([\d.,]+)\s*(kg|gm?|ml|li?t(?:re|er)?s?)\b/gi, "")
    .replace(/\/?\s*[\d.,]+\s*PAX/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/\s*—\s*—\s*/g, " — ")
    .replace(/^\s*[—,]\s*/, "")
    .trim();
}

// ── Timer helpers (never auto-complete, show overrun) ──
function elapsed(d, si) { return d.starts?.[si] ? Math.floor((Date.now() - d.starts[si]) / 1000) : 0; }
function stepDone(d, si, stepObj) {
  if (stepObj && Array.isArray(stepObj.subs) && stepObj.subs.length > 0) {
    return stepObj.subs.every((_, sbi) => !!(d.manual && d.manual['step_' + si + '_sub_' + sbi]));
  }
  if (d.manual?.[si] || d.manual?.['step_' + si] || d.manual?.[String(si)]) return true;
  if (d.mesaDone && si <= 1) return true;
  return false;
}
function isD1Step(d, si) { return d.mesaDone && si <= 1; }
function isOverdue(d, si) {
  if (stepDone(d, si)) return false;
  if (!d.starts?.[si]) return false;
  const el = elapsed(d, si); const tm = d.stepTm?.[si] || 0;
  return tm > 0 && el >= tm;
}
function fmtTimer(sec) {
  const abs = Math.abs(sec); const m = Math.floor(abs / 60); const s = abs % 60;
  return (sec < 0 ? "+" : "") + m + "m " + (s < 10 ? "0" : "") + s + "s" + (sec < 0 ? " over" : "");
}

// ── Sub-components ──
function ProgressBar({ pct, color, h = 4 }) {
  return <div style={{ height: h, background: C.border, borderRadius: h / 2, overflow: "hidden" }}>
    <div style={{ height: "100%", width: Math.min(100, pct) + "%", background: color, borderRadius: h / 2, transition: "width .4s" }} />
  </div>;
}
function StatCard({ value, label, color }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", textAlign: "center", flex: "1 1 80px", minWidth: 80 }}>
    <div style={{ fontSize: 20, fontWeight: 700, color: color || C.text }}>{value}</div>
    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
  </div>;
}

function EventDayTab({
  events, kitchenTracking, setKitchenTracking,
  lang = "en", currentUser = null, sectionFilter = null, allowedCatIds = null,
  transportQueue = [], setTransportQueue,
  dishSignoff, setDishSignoff,
  openCam, capturePhoto, stopCam, camOn, camRef, capRef, camStreamRef,
  appliedScales = {}, effectiveScales = {}, tick, setTab, onBeforeDishDone,
}) {
  const T2 = s => T(s, lang);
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const evList = safeArr(events);
  const todayEvs = evList.filter(e => e.date === TODAY).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  // ── State helpers (combined cooking keys) ──
  function dk(evId, idx) { return evId + "|" + idx; }
  function ck(dishName) { return "dish|" + dishName; }
  function ds(evId, idx, dishName) {
    if (isCombined && dishName) return kt["__combined_"+TODAY]?.[ck(dishName)] || {};
    var perEv = kt[evId]?.[dk(evId, idx)] || {};
    if (dishName && !Object.keys(perEv).length) {
      var cb = kt["__combined_"+TODAY]?.[ck(dishName)] || {};
      if (Object.keys(cb).length) { var r = Object.assign({}, cb); delete r.mesaDone; return r; }
    }
    return perEv;
  } 
  function setDs(evId, idx, upd, dishInfo) {
    setKitchenTracking(p => {
      const o = p && typeof p === "object" ? { ...p } : {};
      if (isCombined && dishInfo?.name) {
        const cKey = ck(dishInfo.name);
        var _ck = "__combined_" + TODAY; o[_ck] = { ...(o[_ck] || {}), [cKey]: { ...(o[_ck]?.[cKey] || {}), ...upd } };
        // Propagate cooking progress to per-function keys (except mesaDone — transport is per-event)
        var propUpd = Object.assign({}, upd); delete propUpd.mesaDone;
        if (Object.keys(propUpd).length > 0) {
          (dishInfo.fns || []).forEach(fn => {
            const k2 = dk(fn.evId, fn.idx);
            o[fn.evId] = { ...(o[fn.evId] || {}), [k2]: { ...(o[fn.evId]?.[k2] || {}), ...propUpd } };
          });
        }
      } else {
        const k2 = dk(evId, idx);
        o[evId] = { ...(o[evId] || {}), [k2]: { ...(o[evId]?.[k2] || {}), ...upd } };
      }
      return o;
    });
  }
  function setEvMeta(evId, key, val) {
    setKitchenTracking(p => {
      const o = p && typeof p === "object" ? { ...p } : {};
      o[evId] = { ...(o[evId] || {}), [key]: val };
      return o;
    });
  }
  function markManual(evId, idx, si, dishInfo) {
    const d = ds(evId, idx, dishInfo?.name);
    const now = fmtStamp();
    const el = d.starts?.[si] ? Math.floor((Date.now() - d.starts[si]) / 1000) : 0;
    setDs(evId, idx, {
      manual: { ...(d.manual || {}), [si]: true },
      manualAt: { ...(d.manualAt || {}), [si]: now },
      doneElapsed: { ...(d.doneElapsed || {}), [si]: el },
    }, dishInfo);
  }
  function startStep(evId, idx, si, tm, dishInfo) {
    const d = ds(evId, idx, dishInfo?.name);
    setDs(evId, idx, { starts: { ...(d.starts || {}), [si]: Date.now() }, stepTm: { ...(d.stepTm || {}), [si]: tm } }, dishInfo);
  }
  function menuArr(ev) {
    const m = ev.menu;
    if (Array.isArray(m)) return m;
    if (typeof m === 'string' && m) { try { return JSON.parse(m); } catch { return []; } }
    return [];
  }

  // ── Function filter ──
  const [evFnFilter, setEvFnFilter] = useState("combined"); // "combined" | eventId
  const isCombined = evFnFilter==="combined";
  const filteredEvs = isCombined ? todayEvs : todayEvs.filter(e=>e.id===evFnFilter);
  const activeEv = !isCombined ? todayEvs.find(e=>e.id===evFnFilter) : null;
  const combinedPax = todayEvs.reduce((s,e)=>s+(+e.pax||0),0);

  // ── Expand state ──
  const [openSecs, setOpenSecs] = useState({});
  const [openDishes, setOpenDishes] = useState({});
  const toggleSec = sec => setOpenSecs(p => ({ ...p, [sec]: p[sec] === true ? false : true }));
  const isSecOpen = sec => openSecs[sec] === true; // default collapsed
  const toggleDish = key => setOpenDishes(p => ({ ...p, [key]: !p[key] }));
  const isDishOpen = key => !!openDishes[key];

  // ── No events today ──
  if (todayEvs.length === 0) {
    return (
      <Card style={{ padding: "32px 24px", textAlign: "center", border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{T2("No events today")}</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{T2("Today is a D-1 prep day. Switch to the D-1 tab to see advance prep tasks.")}</div>
        {setTab && <button onClick={() => setTab("today")} style={{ marginTop: 16, padding: "12px 24px", borderRadius: 12, background: `linear-gradient(135deg,${C.gold},#A8891E)`, color: "#0A0908", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📋 {T2("Go to D-1 Prep")} →</button>}
      </Card>
    );
  }

  // ── Build dish list (filtered by selected function) ──
  const byDish = {};
  filteredEvs.forEach(ev => {
    const sp = ev.special || "";
    const isSpecial = /no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
    menuArr(ev).forEach((name, idx) => {
      const dishCatId = getCatIdForDish(name);
      if (dishCatId === "beverages") return;
      if (allowedCatIds && !allowedCatIds.includes(dishCatId)) return;
      if (!byDish[name]) byDish[name] = { catId: dishCatId, totalPax: 0, fns: [], fEvId: ev.id, fIdx: idx, specials: [] };
      byDish[name].totalPax += ev.pax || 0;
      byDish[name].fns.push({ evId: ev.id, g: ev.guest, v: ev.venue, p: ev.pax, idx, special: sp, isSpecial });
      if (isSpecial) byDish[name].specials.push({ guest: ev.guest, pax: ev.pax, instruction: sp });
    });
  });
  const isSectionUser = currentUser?.role?.startsWith('section_');
  const isTablet = isSectionUser;
  const bySec = {};
  Object.entries(byDish).forEach(([n, info]) => {
    const groupKey = info.catId || 'maincourse';
    if (!bySec[groupKey]) bySec[groupKey] = [];
    bySec[groupKey].push({ name: n, ...info });
  });
  const secKeys = Object.keys(bySec).sort();
  const totalDishes = Object.keys(byDish).length;

  // Stats
  const readyDishes = Object.values(byDish).filter(d => ds(d.fEvId, d.fIdx, d.name).ready).length;
  const inProgressDishes = Object.values(byDish).filter(d => {
    const dd = ds(d.fEvId, d.fIdx, d.name);
    if (dd.ready) return false;
    return dd.storeStart || Object.keys(dd.starts || {}).length > 0;
  }).length;
  const d1PrepDone = Object.values(byDish).filter(d => ds(d.fEvId, d.fIdx, d.name).mesaDone).length;
  const pendingDishes = totalDishes - readyDishes - inProgressDishes;
  const totalPax = filteredEvs.reduce((s, e) => s + (+e.pax || 0), 0);
  const allDishesReady = readyDishes === totalDishes && totalDishes > 0;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: isTablet?20:16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>🔥 {T2("Event Day")} — {TODAY_LABEL}</div>
        <div style={{ fontSize: isTablet?14:12, color: C.muted, marginTop: 2 }}>
          {todayEvs.map(e => `${e.guest} (${e.pax} pax · ${e.time || "TBD"})`).join(" · ")}
        </div>
      </div>

      {/* ── Function selector tabs ── */}
      {todayEvs.length>1&&(
        <div style={{display:"flex",gap:0,borderRadius:12,overflow:"hidden",border:`1.5px solid ${C.border}`,marginBottom:14}}>
          <button onClick={()=>setEvFnFilter("combined")}
            style={{flex:1,padding:"12px 10px",border:"none",cursor:"pointer",background:isCombined?C.gold:"transparent",textAlign:"center",minHeight:52}}>
            <div style={{fontSize:13,fontWeight:isCombined?700:500,color:isCombined?"#fff":C.text}}>🍳 Combined</div>
            <div style={{fontSize:11,color:isCombined?"rgba(255,255,255,.8)":C.muted,marginTop:2}}>{combinedPax} pax · {todayEvs.length} functions</div>
          </button>
          {todayEvs.map(ev=>{
            const isSel=evFnFilter===ev.id;
            return(
              <button key={ev.id} onClick={()=>setEvFnFilter(ev.id)}
                style={{flex:1,padding:"12px 10px",border:"none",borderLeft:`1px solid ${C.border}`,cursor:"pointer",background:isSel?C.gold:"transparent",textAlign:"center",minHeight:52}}>
                <div style={{fontSize:13,fontWeight:isSel?700:500,color:isSel?"#fff":C.text}}>{ev.guest||"Function"}</div>
                <div style={{fontSize:11,color:isSel?"rgba(255,255,255,.8)":C.muted,marginTop:2}}>{ev.pax} pax · {ev.venue||""} · {ev.time||"TBD"}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Per-function hint ── */}
      {!isCombined&&(
        <div style={{padding:"8px 12px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,marginBottom:12,fontSize:11,color:C.amber}}>
          💡 Viewing <b>{activeEv?.guest}</b> only — {activeEv?.pax} pax · {activeEv?.venue||""} · {activeEv?.time||"TBD"}. Use this view for dispatch sign-off.
        </div>
      )}

      {/* ── D-1 prep status banner ── */}
      {d1PrepDone > 0 ? (
        <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{d1PrepDone}/{totalDishes} {T2("dishes had D-1 prep done yesterday")}</div>
            <div style={{ fontSize: 11, color: C.green }}>{T2("Those steps are marked D-1 ✅ — skip to cooking")}</div>
          </div>
        </div>
      ) : (
        <div style={{ background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>{T2("No D-1 prep was done yesterday")}</div>
            <div style={{ fontSize: 11, color: C.amber }}>{T2("All steps including Mesa must be completed today")}</div>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard value={readyDishes} label={T2("Ready")} color={C.green} />
        <StatCard value={inProgressDishes} label={T2("Cooking")} color={C.amber} />
        <StatCard value={pendingDishes} label={T2("Pending")} color={C.muted} />
        <StatCard value={totalDishes} label={T2("Dishes")} />
        <StatCard value={totalPax.toLocaleString()} label={T2("Pax")} />
      </div>

      {/* ── Category list ── */}
      {secKeys.map(sec => {
        const items = bySec[sec];
        const catObj = RECIPE_DB.cats.find(c => c.id === sec);
        const secDisplayName = catObj ? catObj.name : sec;
        const m = { color: catObj?.color || C.muted, icon: catObj?.icon || "🍽" };
        const displayIcon = catObj?.icon || "🍽";
        const secReady = items.filter(d => ds(d.fEvId, d.fIdx, d.name).ready).length;
        const secPct = Math.round(secReady / items.length * 100);
        const secOpen = isSecOpen(sec);
        const secAllDone = secReady === items.length;
        const secSpecials = [...new Map(items.flatMap(d => d.specials || []).map(sp => [sp.guest + "|" + sp.instruction, sp])).values()];

        return (
          <div key={sec} style={{ marginBottom: 8 }}>
            {/* Section bar */}
            <div onClick={() => toggleSec(sec)} style={{
              display: "flex", gap: 10, alignItems: "center", padding: "12px 14px",
              borderRadius: secOpen ? "12px 12px 0 0" : 12,
              border: `1px solid ${secAllDone ? C.greenBorder : C.border}`,
              borderBottom: secOpen ? `1px solid ${C.border}` : undefined,
              background: secAllDone ? C.greenBg : C.surface, cursor: "pointer",
            }}>
              <span style={{ fontSize: isTablet?24:18 }}>{displayIcon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: isTablet?20:14, fontWeight: 700, color: secAllDone ? C.green : m.color }}>{T2(secDisplayName)}</span>
                  <span style={{ fontSize: isTablet?14:11, color: C.muted }}>{items.length} {T2("dishes")}</span>
                  {secSpecials.length > 0 && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontWeight: 700 }}>🚫 {secSpecials.length}</span>}
                </div>
                <div style={{ fontSize: isTablet?14:11, color: C.muted, marginTop: 2 }}>{secReady} {T2("ready")} of {items.length}</div>
                <ProgressBar pct={secPct} color={secAllDone ? C.green : secReady > 0 ? C.amber : C.border} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: secAllDone ? C.green : secPct > 0 ? C.amber : C.muted, minWidth: 36, textAlign: "right" }}>{secPct}%</span>
              <span style={{ fontSize: 14, color: C.muted, transform: secOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
            </div>

            {/* Special alerts */}
            {secOpen && secSpecials.length > 0 && (
              <div style={{ padding: "8px 14px", background: C.redBg + "80", borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                {secSpecials.map((sp, si) => (
                  <div key={si} style={{ fontSize: 12, color: C.red, padding: "4px 0", borderBottom: si < secSpecials.length - 1 ? `1px solid ${C.redBorder}40` : "none" }}>
                    🚫 <b>{sp.pax} {T2("pax")}</b> — {sp.guest}: {sp.instruction}
                  </div>
                ))}
              </div>
            )}

            {/* Dish rows */}
            {secOpen && (
              <div style={{ border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "6px 10px 10px" }}>
                {items.map((dish, di) => {
                  const dKey = isCombined ? ck(dish.name) : dk(dish.fEvId, dish.fIdx);
                  const d = ds(dish.fEvId, dish.fIdx, dish.name);
                  const isReady = !!d.ready;
                  const steps = getFullSteps(dish.name);
                  const nonStore = steps.filter(s => !s.store).map((s, i) => ({ step: s, origIdx: i }));
                  const storeStarted = !!d.storeStart;
                  const storeDone = !!d.storeEnd;
                  const storeEl = storeStarted && !storeDone ? Math.floor((Date.now() - d.storeStart) / 1000) : 0;
                  const storeOverdue = storeStarted && !storeDone && storeEl >= 1800;
                  const doneCount = nonStore.filter(x => stepDone(d, x.origIdx, x.step)).length + (storeDone ? 1 : 0);
                  const totalSteps = nonStore.length + 1;
                  const runIdx = nonStore.findIndex(x => d.starts?.[x.origIdx] && !stepDone(d, x.origIdx, x.step));
                  const anyRunning = runIdx >= 0 || (storeStarted && !storeDone);

                  // Timer for dish row
                  let timerDisplay = null;
                  if (!isReady && runIdx >= 0) {
                    const el = elapsed(d, nonStore[runIdx].origIdx);
                    const tm = d.stepTm?.[nonStore[runIdx].origIdx] || nonStore[runIdx].step.tm || 0;
                    if (tm > 0) timerDisplay = <span style={{ fontSize: 12, fontWeight: 700, color: el >= tm ? C.red : C.amber }}>{fmtTimer(tm - el)}</span>;
                  } else if (!isReady && storeStarted && !storeDone) {
                    timerDisplay = <span style={{ fontSize: 12, fontWeight: 700, color: storeOverdue ? C.red : C.amber }}>{fmtTimer(1800 - storeEl)}</span>;
                  }

                  return (
                    <div key={di} style={{ marginBottom: 4 }}>
                      {/* Dish row */}
                      <div onClick={() => toggleDish(dKey)} style={{
                        display: "flex", gap: 10, alignItems: "center", padding: "10px 8px",
                        borderRadius: 10, cursor: "pointer",
                        background: isReady ? C.greenBg : anyRunning ? C.surface : "transparent",
                        border: `1px solid ${isReady ? C.greenBorder : anyRunning ? C.amberBorder + "60" : "transparent"}`,
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 7,
                          border: `2px solid ${isReady ? C.green : anyRunning ? C.amber : C.border}`,
                          background: isReady ? C.green : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {isReady && <span style={{ color: "#0A0A0F", fontSize: 10, fontWeight: 700 }}>✓</span>}
                          {!isReady && anyRunning && <span style={{ color: C.amber, fontSize: 8 }}>▶</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: isTablet?18:13, fontWeight: 700, color: isReady ? C.green : C.text }}>{dish.name}{isCombined && dish.fns.some(fn => { const tv=(fn.v||"").toLowerCase().trim(); const uv=(currentUser?.venue||"").toLowerCase().trim(); return uv && tv && !tv.includes(uv) && !uv.includes(tv); }) && <span style={{fontSize:10,color:C.amber,marginLeft:4}}>🚛</span>}</div>
                          <div style={{ fontSize: isTablet?14:11, color: C.muted }}>
                            {dish.totalPax} {T2("pax")} · {doneCount}/{totalSteps} {T2("steps")}
                            {d.mesaDone && <span style={{ color: C.green }}> · D-1 ✅</span>}
                          </div>
                        </div>
                        {timerDisplay || <span style={{ fontSize: 11, fontWeight: 600, color: isReady ? C.green : C.muted }}>{isReady ? T2("Ready") : T2("Pending")}</span>}
                        <span style={{ fontSize: 12, color: C.muted }}>{isDishOpen(dKey) ? "▼" : "▶"}</span>
                      </div>

                      {/* Expanded view */}
                      {isDishOpen(dKey) && (
                        <div style={{ padding: "8px 4px 8px 38px" }}>

                          {/* D-1 mesa badge */}
                          <div style={{ background: d.mesaDone ? C.greenBg : C.amberBg, border: `1px solid ${d.mesaDone ? C.greenBorder : C.amberBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                            <span style={{ fontSize: isTablet?14:12, fontWeight: 700, color: d.mesaDone ? C.green : C.amber }}>
                              {d.mesaDone ? `✅ D-1 ${T2("prep done")}` : `⏳ ${T2("No D-1 prep — start from mesa")}`}
                            </span>
                          </div>

                          {/* Step 0: Store */}
                          <StepRow
                            num={0} title={`🏪 ${T2("Collect from store")}`}
                            desc={T2("Source all ingredients") + " · 30m"}
                            done={storeDone} running={storeStarted && !storeDone} overdue={storeOverdue}
                            elapsedSec={storeEl} timerSec={1800} locked={false}
                            onStart={() => setDs(dish.fEvId, dish.fIdx, { storeStart: Date.now() }, dish)}
                            onDone={() => setDs(dish.fEvId, dish.fIdx, { storeEnd: Date.now() }, dish)}
                            large={isSectionUser}
                          />

                          {/* Ingredient list */}
                          {(() => {
                            const evObj = todayEvs.find(e => e.id === dish.fEvId);
                            const pax = evObj ? +evObj.pax : 0;
                            if (pax <= 0) return null;
                            const ing = getIngrForDish(dish.name, pax);
                            if (!ing || ing.length === 0) return null;
                            const isNew = ing[0]?._newFmt;
                            const eff = effectiveScales[dish.fEvId];
                            const isOverridden = eff?.isOverride || false;
                            return (
                              <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", marginBottom: 8, border: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 5 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: storeDone ? C.green : C.gold, marginBottom: 5 }}>
                                  {storeDone ? "📊" : "🧺"} {storeDone ? T2("Ingredients") : T2("Items to collect")} — {pax} pax
                                  {isNew
                                    ? <span style={{ fontSize: 10, color: C.green, marginLeft: 6 }}>📊 {T2("scaled from DB")}</span>
                                    : isOverridden
                                      ? <span style={{ fontSize: 10, color: C.amber, marginLeft: 6 }}>⚙️ {T2("override")}</span>
                                      : <span style={{ fontSize: 10, color: C.faint, marginLeft: 6 }}>{T2("auto-scaled")}</span>
                                  }
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px" }}>
                                  {ing.filter(i => i.q > 0).map((i, ii) => {
                                    const raw = isNew ? i.q : i.q * pax;
                                    const qty = i.u === "g" ? (raw >= 1000 ? ((raw / 1000).toFixed(1).replace(/\.0$/, "")) + " kg" : Math.round(raw) + " g") :
                                      i.u === "ml" ? (raw >= 1000 ? ((raw / 1000).toFixed(1).replace(/\.0$/, "")) + " L" : Math.round(raw) + " ml") :
                                        i.u === "pcs" ? Math.ceil(raw) + " pcs" : Math.round(raw) + " " + i.u;
                                    return <span key={ii} style={{ fontSize: 11, color: C.text }}>{i.n}: <b style={{ color: C.gold }}>{qty}</b></span>;
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* SOP steps — grouped by Pre-Prep and Cooking */}
                          {(() => {
                            const prePrep = nonStore.filter(x => !!x.step.d1);
                            const cooking = nonStore.filter(x => !x.step.d1);

                            return (
                              <div>
                                {prePrep.length > 0 && (
                                  <div style={{ fontSize: isTablet?13:11, fontWeight: 700, color: C.amber, marginTop: 8, marginBottom: 4, padding: isTablet?"6px 12px":"4px 10px", background: C.amberBg + "40", borderRadius: 6, border: `1px solid ${C.amberBorder}30` }}>
                                    🔶 {T2("Pre-prep")} — {prePrep.length} {T2("steps")}
                                  </div>
                                )}
                                {prePrep.map((item, gi) => {
                                  const si = item.origIdx; const step = item.step;
                                  const done = stepDone(d, si, step); const started = !!d.starts?.[si]; const overdue = isOverdue(d, si);
                                  const el = elapsed(d, si); const tm = d.stepTm?.[si] || step.tm || 0;
                                  const d1Done = isD1Step(d, si);
                                  const gIdx = gi;
                                  const prevItem = gi > 0 ? prePrep[gi - 1] : null;
                                  const prevDone = gIdx === 0 ? storeDone : (prevItem ? stepDone(d, prevItem.origIdx, prevItem.step) : false);
                                  const cTitle=cleanStepText(step.t)+(step.live?" 🔴":"");const cDesc=cleanStepText(step.i||"");const cDescShow=cDesc&&!cTitle.includes(cDesc)&&!cDesc.includes(cTitle)?cDesc:"";
                                  return <StepRow key={si} num={gIdx + 1} title={cTitle} desc={cDescShow} ccp={step.ccp?cleanStepText(step.ccp):null}
                                    subs={step.subs||null} stepKey={"step_"+si} d2d={d} setDsFn={(upd)=>setDs(dish.fEvId,dish.fIdx,upd,dish)}
                                    done={done || d1Done} running={started && !done && !d1Done} overdue={overdue}
                                    elapsedSec={el} timerSec={tm} locked={false}
                                    d1Badge={d1Done}
                                    onStart={() => startStep(dish.fEvId, dish.fIdx, si, tm, dish)}
                                    onDone={() => markManual(dish.fEvId, dish.fIdx, si, dish)}
                                    doneTime={d.manualAt?.[si] || null}
                                    doneElapsed={d.doneElapsed?.[si] ?? null}
                                    large={isSectionUser}
                                  />;
                                })}

                                {cooking.length > 0 && (
                                  <div style={{ fontSize: isTablet?13:11, fontWeight: 700, color: C.red, marginTop: 12, marginBottom: 4, padding: isTablet?"6px 12px":"4px 10px", background: C.redBg + "40", borderRadius: 6, border: `1px solid ${C.redBorder}30` }}>
                                    🔴 {T2("Cooking")} — {cooking.length} {T2("steps")}
                                  </div>
                                )}
                                {cooking.map((item, ci) => {
                                  const si = item.origIdx; const step = item.step;
                                  const done = stepDone(d, si, step); const started = !!d.starts?.[si]; const overdue = isOverdue(d, si);
                                  const el = elapsed(d, si); const tm = d.stepTm?.[si] || step.tm || 0;
                                  const allPrev = nonStore.slice(0, nonStore.indexOf(item));
                                  const prevItem = allPrev.length > 0 ? allPrev[allPrev.length - 1] : null;
                                  const prevDone = allPrev.length === 0 ? storeDone : (prevItem ? stepDone(d, prevItem.origIdx, prevItem.step) : false);
                                  const cTitle=cleanStepText(step.t)+(step.live?" 🔴":"");const cDesc=cleanStepText(step.i||"");const cDescShow=cDesc&&!cTitle.includes(cDesc)&&!cDesc.includes(cTitle)?cDesc:"";
                                  return <StepRow key={si} num={prePrep.length + ci + 1} title={cTitle} desc={cDescShow} ccp={step.ccp?cleanStepText(step.ccp):null}
                                    subs={step.subs||null} stepKey={"step_"+si} d2d={d} setDsFn={(upd)=>setDs(dish.fEvId,dish.fIdx,upd,dish)}
                                    done={done} running={started && !done} overdue={overdue}
                                    elapsedSec={el} timerSec={tm} locked={false}
                                    onStart={() => startStep(dish.fEvId, dish.fIdx, si, tm, dish)}
                                    onDone={() => markManual(dish.fEvId, dish.fIdx, si, dish)}
                                    doneTime={d.manualAt?.[si] || null}
                                    doneElapsed={d.doneElapsed?.[si] ?? null}
                                    large={isSectionUser}
                                  />;
                                })}
                              </div>
                            );
                          })()}

                          {/* All done → sign off (venue-aware) */}
                          {storeDone && nonStore.every(x => stepDone(d, x.origIdx, x.step) || isD1Step(d, x.origIdx)) && !isReady && (()=>{
                            const tev = todayEvs.find(e => e.id === dish.fEvId);
                            const tabVenue = (currentUser?.venue||"").toLowerCase().trim();
                            const evVenue = (tev?.venue||"").toLowerCase().trim();
                            const sameVenue = tabVenue && evVenue && (evVenue.includes(tabVenue)||tabVenue.includes(evVenue));
                            const needsTransport = tabVenue && evVenue && !sameVenue;
                            return(
                            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: C.surface, border: `1px solid ${needsTransport?C.amberBorder:C.border}` }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, textAlign: "center", marginBottom: 6 }}>
                                ✅ {T2("All steps complete — sign off")}
                              </div>
                              {needsTransport&&<div style={{fontSize:11,color:C.amber,textAlign:"center",marginBottom:8}}>🚛 {T2("This dish needs transport to")} <b>{tev?.venue||"venue"}</b></div>}
                              <button onClick={() => {
                                const now = fmtStamp();
                                const updates = { ready: true, completed: true, completedBy: currentUser?.name || "Chef", completedAt: now, readyAt: now };
                                if(needsTransport) {
                                  updates.transportLinked = true;
                                  if (setTransportQueue) {
                                    setTransportQueue(prev => [...(prev || []), {
                                      id: localDateStr(new Date()) + "_" + dish.fEvId + "_" + dish.fIdx,
                                      dishName: dish.name, event: tev?.guest || "Unknown",
                                      pax: tev?.pax || 0, venue: tev?.venue || "",
                                      eventDate: tev?.date || TODAY,
                                      preparedBy: currentUser?.name || "Chef",
                                      markedAt: now, status: "Ready",
                                      fromVenue: currentUser?.venue || "",
                                    }]);
                                  }
                                }
                                const doFinish = () => setDs(dish.fEvId, dish.fIdx, updates, dish);
                                if (onBeforeDishDone) { const evObj = todayEvs.find(e => e.id === dish.fEvId); onBeforeDishDone(dish, evObj?.pax||0, false, doFinish); } else { doFinish(); }
                              }} style={{ width:"100%", padding: "14px", borderRadius: 12, background: needsTransport?`linear-gradient(135deg,${C.amber},#B07A10)`:C.green, color: needsTransport?"#fff":"#0A0A0F", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                                {needsTransport?`🚛 ${T2("Ready for Transport")}`:`✅ ${T2("Mark Complete")}`}
                              </button>
                            </div>);
                          })()}

                          {/* Already done */}
                          {isReady && (
                            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: d.transportLinked?C.amberBg:C.greenBg, border: `1px solid ${d.transportLinked?C.amberBorder:C.greenBorder}` }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: d.transportLinked?C.amber:C.green }}>{d.transportLinked?"🚛 "+T2("Ready for Transport"):"✅ "+T2("Complete")}</span>
                              {d.completedBy && <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{d.completedBy} · {d.completedAt}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Dispatch per event ── */}
      {(allDishesReady || !isCombined) && readyDishes>0 && (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 10 }}>🚛 {T2("Dispatch by function")}</div>
          {todayEvs.map(ev => {
            const dispatched = !!(kt[ev.id]?.__dispatch_ready);
            return (
              <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: dispatched ? C.greenBg : C.bg, border: `1px solid ${dispatched ? C.greenBorder : C.border}`, borderRadius: 10, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ev.guest}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")}</div>
                </div>
                {dispatched
                  ? <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>🚛 {kt[ev.id]?.__dispatch_time}</span>
                  : <button onClick={() => { setEvMeta(ev.id, "__dispatch_ready", true); setEvMeta(ev.id, "__dispatch_time", fmtStamp()); }} style={{ padding: "8px 16px", borderRadius: 10, background: C.gold, color: "#0A0A0F", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    🚛 {T2("Dispatch")}
                  </button>
                }
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── StepRow ──
function StepRow({ num, title, desc, ccp, done, running, overdue, elapsedSec, timerSec, locked, d1Badge, onStart, onDone, doneTime, doneElapsed, subs, stepKey, d2d, setDsFn, large }) {
  const remaining = timerSec - elapsedSec;
  const SZ = large ? { badge:36, badgeR:10, badgeFt:14, title:16, desc:13, ccp:13, timer:14, done:13, hint:13, btn:"10px 18px", btnR:12, btnFt:14, btnH:48, sub:28, subR:8, subFt:11, subTitle:14, subDesc:12, subTimer:12, subHint:12, subBtn:"8px 16px", subBtnR:10, subBtnFt:13, subBtnH:42, border:2.5, pad:"14px 0" } : { badge:26, badgeR:7, badgeFt:11, title:13, desc:11, ccp:11, timer:12, done:11, hint:11, btn:"7px 14px", btnR:10, btnFt:12, btnH:32, sub:24, subR:6, subFt:10, subTitle:12, subDesc:11, subTimer:10, subHint:10, subBtn:"6px 12px", subBtnR:8, subBtnFt:11, subBtnH:32, border:2.5, pad:"10px 0" };
  // Under/over calculation for completed steps
  const hasDoneElapsed = done && doneElapsed != null && doneElapsed > 0 && timerSec > 0;
  const wasOver = hasDoneElapsed && doneElapsed > timerSec;
  const wasUnder = hasDoneElapsed && doneElapsed <= timerSec;
  const diffSec = hasDoneElapsed ? Math.abs(doneElapsed - timerSec) : 0;
  const diffM = Math.floor(diffSec / 60);
  const diffS = diffSec % 60;
  const doneM = doneElapsed != null ? Math.floor(doneElapsed / 60) : 0;
  const doneS = doneElapsed != null ? doneElapsed % 60 : 0;
  return (
    <div style={{ padding: SZ.pad, borderBottom: `1px solid ${C.border}20` }}>
      <div style={{ display: "flex", gap: large?14:10, alignItems: "flex-start" }}>
      <div style={{
        width: SZ.badge, height: SZ.badge, borderRadius: SZ.badgeR, flexShrink: 0, marginTop: 1,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: SZ.badgeFt, fontWeight: 700,
        background: done ? C.green : running ? (overdue ? C.red : C.amber) : C.darkCard,
        border: `2px solid ${done ? C.green : running ? (overdue ? C.red : C.amber) : C.border}`,
        color: done || running ? "#0A0A0F" : C.muted,
      }}>
        {done ? "✓" : num}
      </div>
      <div style={{ flex: 1 }}>
        <div>
          <span style={{ fontSize: SZ.title, fontWeight: 700, color: done ? C.green : running ? (overdue ? C.red : C.amber) : C.text }}>{title}</span>
          {subs && !done && d2d && <span style={{fontSize:11,color:C.muted,marginLeft:6}}>({subs.filter((_,sbi)=>!!(d2d.manual&&d2d.manual[stepKey+"_sub_"+sbi])).length}/{subs.length})</span>}
          {d1Badge && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green, marginLeft: 6 }}>D-1 ✅</span>}
        </div>
        {desc && <div style={{ fontSize: SZ.desc, color: C.muted, marginTop: large?2:1 }}>{desc}</div>}
        {ccp && <div style={{ fontSize: SZ.ccp, color: C.red, marginTop: 3 }}>🔴 CCP: {ccp}</div>}
        {!subs && running && timerSec > 0 && (
          <div style={{ marginTop: 6 }}>
            <ProgressBar pct={Math.min(100, Math.round(elapsedSec / timerSec * 100))} color={overdue ? C.red : C.amber} h={3} />
            <div style={{ fontSize: SZ.timer, fontWeight: 700, marginTop: 3, color: overdue ? C.red : C.amber }}>
              ⏱ {Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s elapsed
              {overdue
                ? <span style={{ marginLeft: 6, color: C.red }}>+{Math.floor((elapsedSec - timerSec) / 60)}m {(elapsedSec - timerSec) % 60}s over</span>
                : <span style={{ marginLeft: 6 }}>{Math.floor(remaining / 60)}m {remaining % 60}s left</span>
              }
            </div>
          </div>
        )}
        {/* Done: show time taken + under/over */}
        {!subs && done && hasDoneElapsed && (
          <div style={{ fontSize: SZ.done, marginTop: 3, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: C.green }}>✅ {doneM}m{doneS > 0 ? ` ${doneS}s` : ""} done</span>{doneTime&&<span style={{color:C.muted,fontWeight:400,fontSize:SZ.done}}> · {doneTime}</span>}
            {wasUnder && diffSec > 0 && <span style={{ color: C.green, fontWeight: 600 }}>🟢 {diffM > 0 ? `${diffM}m ` : ""}{diffS}s under</span>}
            {wasOver && <span style={{ color: C.red, fontWeight: 600 }}>🔴 +{diffM > 0 ? `${diffM}m ` : ""}{diffS}s over</span>}
          </div>
        )}
        {!subs && done && !hasDoneElapsed && <div style={{ fontSize: 11, color: C.green, marginTop: 3 }}>✅{doneTime ? " "+doneTime : " done"}</div>}
        {subs && done && <div style={{ fontSize: 11, color: C.green, marginTop: 3 }}>✅ all sub-steps done</div>}
        {!subs && !done && !running && !locked && timerSec > 0 && <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>⏱ {Math.floor(timerSec / 60)}m</div>}
      </div>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        {!subs && locked && !done && <div style={{ padding: SZ.btn, borderRadius: SZ.btnR, background: C.darkCard, border: `1px solid ${C.border}`, color: C.faint, fontSize: SZ.btnFt }}>🔒</div>}
        {!subs && !locked && !done && !running && timerSec > 0 && <button onClick={e => { e.stopPropagation(); onStart(); }} style={{ padding: SZ.btn, borderRadius: SZ.btnR, background: `linear-gradient(135deg,${C.gold},#A8891E)`, color: "#0A0908", border: "none", fontSize: SZ.btnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.btnH }}>▶ {Math.floor(timerSec / 60)}m</button>}
        {!subs && !locked && !done && !running && !timerSec && <button onClick={e => { e.stopPropagation(); onDone(); }} style={{ padding: SZ.btn, borderRadius: SZ.btnR, background: C.gold, color: "#0A0908", border: "none", fontSize: SZ.btnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.btnH }}>✓ Done</button>}
        {!subs && running && !done && <button onClick={e => { e.stopPropagation(); onDone(); }} style={{ padding: SZ.btn, borderRadius: SZ.btnR, background: overdue ? `linear-gradient(135deg,${C.red},#801818)` : C.green, color: "#fff", border: "none", fontSize: SZ.btnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.btnH }}>{overdue ? "⚠" : "✓"} Done</button>}
        {subs && locked && !done && <div style={{ padding: SZ.btn, borderRadius: SZ.btnR, background: C.darkCard, border: `1px solid ${C.border}`, color: C.faint, fontSize: SZ.btnFt }}>🔒</div>}
        {subs && !locked && !done && <span style={{ fontSize: large?12:10, color: C.muted }}>↓</span>}
        {done && !subs && d2d && setDsFn && <button onClick={e=>{e.stopPropagation();setDsFn({manual:{...(d2d.manual||{}),[stepKey]:false},starts:{...(d2d.starts||{}),[stepKey]:null}});}} style={{padding:large?"6px 10px":"4px 8px",borderRadius:large?8:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:large?11:10,cursor:"pointer"}}>↩ Undo</button>}
      </div>
      </div>
      {subs && d2d && setDsFn && (
        <div style={{ borderLeft: `${SZ.border}px solid ${done ? C.green : C.gold}`, marginLeft: large?19:13, marginTop: large?10:6, paddingLeft: large?16:12 }}>
          {subs.map((sb, sbi) => {
            const sbk = stepKey + "_sub_" + sbi;
            const sbDone = !!(d2d.manual && d2d.manual[sbk]);
            const sbPrevD = true;
            const sbStarted = !!(d2d.starts && d2d.starts[sbk]);
            const sbEl = sbStarted ? Math.floor((Date.now() - d2d.starts[sbk]) / 1000) : 0;
            const sbOver = sbStarted && sb.tm > 0 && sbEl >= sb.tm && !sbDone;
            const sbRem = sb.tm > 0 ? Math.max(0, sb.tm - sbEl) : 0;
            const sbPct = sb.tm > 0 ? Math.min(100, Math.round(sbEl / sb.tm * 100)) : 0;
            const sbHasDoneEl = sbDone && d2d.doneElapsed?.[sbk] != null && d2d.doneElapsed[sbk] > 0 && sb.tm > 0;
            const sbDE = d2d.doneElapsed?.[sbk] || 0;
            const sbWasOver = sbHasDoneEl && sbDE > sb.tm;
            const sbDiffSec = sbHasDoneEl ? Math.abs(sbDE - sb.tm) : 0;
            return (
              <div key={sbi} style={{ padding: "8px 0", borderBottom: sbi < subs.length - 1 ? `1px solid ${C.border}20` : "none" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: SZ.sub, height: SZ.sub, borderRadius: SZ.subR, background: sbDone ? C.green + "20" : sbStarted ? (sbOver ? C.red+"20" : C.amber+"20") : C.darkCard, border: `1.5px solid ${sbDone ? C.green : sbStarted ? (sbOver ? C.red : C.amber) : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: SZ.subFt, fontWeight: 600, color: sbDone ? C.green : sbStarted ? (sbOver ? C.red : C.amber) : C.muted, flexShrink: 0, marginTop: 1 }}>{sbDone ? "✓" : num + String.fromCharCode(97 + sbi)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: SZ.subTitle, fontWeight: 600, color: sbDone ? C.green : sbStarted ? (sbOver ? C.red : C.amber) : C.text, lineHeight: 1.5, wordBreak: "break-word", overflowWrap: "anywhere" }}>{sb.t}</div>
                    {sb.i && <div style={{ fontSize: SZ.subDesc, color: C.muted, marginTop: 2, lineHeight: 1.4, wordBreak: "break-word", overflowWrap: "anywhere" }}>{sb.i}</div>}
                    {sbStarted && !sbDone && sb.tm > 0 && <div style={{marginTop:4}}><ProgressBar pct={sbPct} color={sbOver ? C.red : C.amber} h={large?4:3}/><div style={{fontSize:SZ.subTimer,fontWeight:700,marginTop:2,color:sbOver?C.red:C.amber}}>⏱ {Math.floor(sbEl/60)}m {sbEl%60}s{sbOver?<span style={{color:C.red}}> +{Math.floor((sbEl-sb.tm)/60)}m {(sbEl-sb.tm)%60}s over</span>:<span> — {Math.floor(sbRem/60)}m left</span>}</div></div>}
                    {sbDone && sbHasDoneEl && <div style={{fontSize:SZ.subHint,marginTop:2,color:sbWasOver?C.red:C.green}}>✅ {Math.floor(sbDE/60)}m{sbDE%60>0?` ${sbDE%60}s`:""}{sbWasOver?<span style={{fontWeight:600}}> 🔴 +{Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":"" }{sbDiffSec%60}s over</span>:<span style={{fontWeight:600}}> 🟢 {Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":"" }{sbDiffSec%60}s under</span>}{d2d.manualAt?.[sbk]&&<span style={{color:C.muted,fontWeight:400}}> · {d2d.manualAt[sbk]}</span>}</div>}
                    {sbDone && !sbHasDoneEl && d2d.manualAt?.[sbk] && <div style={{fontSize:SZ.subHint,color:C.green,marginTop:2}}>✅ {d2d.manualAt[sbk]}</div>}
                    {!sbDone && !sbStarted && sb.tm > 0 && <div style={{fontSize:SZ.subHint,color:C.faint,marginTop:2}}>⏱ {sb.tm>=60?Math.floor(sb.tm/60)+"m":sb.tm+"s"}</div>}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {!sbDone && sbPrevD && !sbStarted && sb.tm > 0 && <button onClick={e => { e.stopPropagation(); setDsFn({ starts: { ...(d2d.starts || {}), [sbk]: Date.now() } }); }} style={{ padding: SZ.subBtn, borderRadius: SZ.subBtnR, background: `linear-gradient(135deg,${C.gold},#A8891E)`, color: "#0A0908", border: "none", fontSize: SZ.subBtnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.subBtnH }}>▶ {Math.floor(sb.tm/60)}m</button>}
                    {!sbDone && sbPrevD && !sbStarted && !sb.tm && <button onClick={e => { e.stopPropagation(); const upd = { manual: { ...(d2d.manual || {}), [sbk]: true }, manualAt: { ...(d2d.manualAt || {}), [sbk]: fmtStamp() } }; if (sbi === subs.length - 1) { upd.doneElapsed = { ...(d2d.doneElapsed || {}), [stepKey]: d2d.starts?.[stepKey] ? Math.floor((Date.now() - d2d.starts[stepKey]) / 1000) : 0 }; } setDsFn(upd); }} style={{ padding: SZ.subBtn, borderRadius: SZ.subBtnR, background: C.gold, color: "#fff", border: "none", fontSize: SZ.subBtnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.subBtnH }}>✓ Done</button>}
                    {!sbDone && sbStarted && <button onClick={e => { e.stopPropagation(); const el = d2d.starts?.[sbk] ? Math.floor((Date.now() - d2d.starts[sbk]) / 1000) : 0; const upd = { manual: { ...(d2d.manual || {}), [sbk]: true }, manualAt: { ...(d2d.manualAt || {}), [sbk]: fmtStamp() }, doneElapsed: { ...(d2d.doneElapsed || {}), [sbk]: el } }; if (sbi === subs.length - 1) { upd.doneElapsed[stepKey] = d2d.starts?.[stepKey] ? Math.floor((Date.now() - d2d.starts[stepKey]) / 1000) : 0; } setDsFn(upd); }} style={{ padding: SZ.subBtn, borderRadius: SZ.subBtnR, background: sbOver ? `linear-gradient(135deg,${C.red},#801818)` : C.green, color: "#fff", border: "none", fontSize: SZ.subBtnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.subBtnH }}>{sbOver ? "⚠" : "✓"} Done</button>}
                    
                    {sbDone && <button onClick={e=>{e.stopPropagation();setDsFn({manual:{...(d2d.manual||{}),[sbk]:false},starts:{...(d2d.starts||{}),[sbk]:null}});}} style={{padding:large?"4px 8px":"3px 6px",borderRadius:large?6:5,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:large?10:9,cursor:"pointer"}}>↩</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { EventDayTab };
