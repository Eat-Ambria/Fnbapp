// Ambria FnB — Event Day Tab (redesigned)
// Place in: src/components/EventDayTab.jsx
import React, { useState } from "react";
import { C, SECTION_META } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, safeArr, safePct, localDateStr } from '../utils/helpers.js';
import { guessSectionForDish, RECIPE_INGREDIENTS, getFullSteps, getStepsForDish, fmtT } from '../data/recipeData.js';
import { Card } from './SharedUI.jsx';

// ── Timer helpers (never auto-complete, show overrun) ──
function elapsed(d, si) { return d.starts?.[si] ? Math.floor((Date.now() - d.starts[si]) / 1000) : 0; }
function stepDone(d, si) {
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
  lang = "en", currentUser = null, sectionFilter = null,
  transportQueue = [], setTransportQueue,
  dishSignoff, setDishSignoff,
  openCam, capturePhoto, stopCam, camOn, camRef, capRef, camStreamRef,
  appliedScales = {}, effectiveScales = {}, tick, setTab,
}) {
  const T2 = s => T(s, lang);
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const evList = safeArr(events);
  const todayEvs = evList.filter(e => e.date === TODAY).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  // ── State helpers ──
  function dk(evId, idx) { return evId + "|" + idx; }
  function ds(evId, idx) { return kt[evId]?.[dk(evId, idx)] || {}; }
  function setDs(evId, idx, upd) {
    setKitchenTracking(p => {
      const o = p && typeof p === "object" ? { ...p } : {};
      const k2 = dk(evId, idx);
      o[evId] = { ...(o[evId] || {}), [k2]: { ...(o[evId]?.[k2] || {}), ...upd } };
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
  function markManual(evId, idx, si) {
    const d = ds(evId, idx);
    setDs(evId, idx, { manual: { ...(d.manual || {}), [si]: true } });
  }
  function startStep(evId, idx, si, tm) {
    const d = ds(evId, idx);
    setDs(evId, idx, { starts: { ...(d.starts || {}), [si]: Date.now() }, stepTm: { ...(d.stepTm || {}), [si]: tm } });
  }
  function menuArr(ev) {
    const m = ev.menu;
    if (Array.isArray(m)) return m;
    if (typeof m === 'string' && m) { try { return JSON.parse(m); } catch { return []; } }
    return [];
  }

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

  // ── Build dish list ──
  const byDish = {};
  todayEvs.forEach(ev => {
    const sp = ev.special || "";
    const isSpecial = /no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
    menuArr(ev).forEach((name, idx) => {
      if (guessSectionForDish(name) === "Beverages") return;
      if (sectionFilter && guessSectionForDish(name) !== sectionFilter) return;
      if (!byDish[name]) byDish[name] = { sec: guessSectionForDish(name), totalPax: 0, fns: [], fEvId: ev.id, fIdx: idx, specials: [] };
      byDish[name].totalPax += ev.pax || 0;
      byDish[name].fns.push({ evId: ev.id, g: ev.guest, v: ev.venue, p: ev.pax, idx, special: sp, isSpecial });
      if (isSpecial) byDish[name].specials.push({ guest: ev.guest, pax: ev.pax, instruction: sp });
    });
  });
  const bySec = {};
  Object.entries(byDish).forEach(([n, info]) => { if (!bySec[info.sec]) bySec[info.sec] = []; bySec[info.sec].push({ name: n, ...info }); });
  const secKeys = Object.keys(bySec).sort();
  const totalDishes = Object.keys(byDish).length;

  // Stats
  const readyDishes = Object.values(byDish).filter(d => ds(d.fEvId, d.fIdx).ready).length;
  const inProgressDishes = Object.values(byDish).filter(d => {
    const dd = ds(d.fEvId, d.fIdx);
    if (dd.ready) return false;
    return dd.storeStart || Object.keys(dd.starts || {}).length > 0;
  }).length;
  const d1PrepDone = Object.values(byDish).filter(d => ds(d.fEvId, d.fIdx).mesaDone).length;
  const pendingDishes = totalDishes - readyDishes - inProgressDishes;
  const totalPax = todayEvs.reduce((s, e) => s + (+e.pax || 0), 0);
  const allDishesReady = readyDishes === totalDishes && totalDishes > 0;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>🔥 {T2("Event Day")} — {TODAY_LABEL}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          {todayEvs.map(e => `${e.guest} (${e.pax} pax · ${e.time || "TBD"})`).join(" · ")}
        </div>
      </div>

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

      {/* ── Section list ── */}
      {secKeys.map(sec => {
        const items = bySec[sec];
        const m = SECTION_META[sec] || { color: C.muted, icon: "🍽" };
        const secReady = items.filter(d => ds(d.fEvId, d.fIdx).ready).length;
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
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: secAllDone ? C.green : m.color }}>{T2(sec)}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{items.length} {T2("dishes")}</span>
                  {secSpecials.length > 0 && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontWeight: 700 }}>🚫 {secSpecials.length}</span>}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{secReady} {T2("ready")} of {items.length}</div>
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
                  const dKey = dk(dish.fEvId, dish.fIdx);
                  const d = ds(dish.fEvId, dish.fIdx);
                  const isReady = !!d.ready;
                  const steps = getFullSteps(dish.name);
                  const nonStore = steps.filter(s => !s.store).map((s, i) => ({ step: s, origIdx: i }));
                  const storeStarted = !!d.storeStart;
                  const storeDone = !!d.storeEnd;
                  const storeEl = storeStarted && !storeDone ? Math.floor((Date.now() - d.storeStart) / 1000) : 0;
                  const storeOverdue = storeStarted && !storeDone && storeEl >= 1800;
                  const doneCount = nonStore.filter(x => stepDone(d, x.origIdx)).length + (storeDone ? 1 : 0);
                  const totalSteps = nonStore.length + 1;
                  const runIdx = nonStore.findIndex(x => d.starts?.[x.origIdx] && !stepDone(d, x.origIdx));
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
                          <div style={{ fontSize: 13, fontWeight: 700, color: isReady ? C.green : C.text }}>{dish.name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>
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
                            <span style={{ fontSize: 12, fontWeight: 700, color: d.mesaDone ? C.green : C.amber }}>
                              {d.mesaDone ? `✅ D-1 ${T2("prep done")}` : `⏳ ${T2("No D-1 prep — start from mesa")}`}
                            </span>
                          </div>

                          {/* Step 0: Store */}
                          <StepRow
                            num={0} title={`🏪 ${T2("Collect from store")}`}
                            desc={T2("Source all ingredients") + " · 30m"}
                            done={storeDone} running={storeStarted && !storeDone} overdue={storeOverdue}
                            elapsedSec={storeEl} timerSec={1800} locked={false}
                            onStart={() => setDs(dish.fEvId, dish.fIdx, { storeStart: Date.now() })}
                            onDone={() => setDs(dish.fEvId, dish.fIdx, { storeEnd: Date.now() })}
                          />

                          {/* Ingredient list (before & during store collection) */}
                          {!storeDone && (() => {
                            const ing = RECIPE_INGREDIENTS[dish.name];
                            const evObj = todayEvs.find(e => e.id === dish.fEvId);
                            const pax = evObj ? +evObj.pax : 0;
                            const eff = effectiveScales[dish.fEvId];
                            const pct = eff?.percent || (pax > 0 ? Math.round(pax / 1100 * 100) : 100);
                            const isOverridden = eff?.isOverride || false;
                            if (!ing || pax <= 0) return null;
                            return (
                              <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", marginBottom: 8, border: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 5 }}>
                                  🧺 {T2("Items to collect")} — {pax} pax @ {pct}%
                                  {isOverridden
                                    ? <span style={{ fontSize: 10, color: C.amber, marginLeft: 6 }}>⚙️ {T2("override")}</span>
                                    : <span style={{ fontSize: 10, color: C.faint, marginLeft: 6 }}>{T2("auto-scaled")}</span>
                                  }
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px" }}>
                                  {ing.filter(i => i.q > 0).map((i, ii) => {
                                    const raw = i.q * pax * (pct / 100);
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
                                  <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, marginTop: 8, marginBottom: 4, padding: "4px 10px", background: C.amberBg + "40", borderRadius: 6, border: `1px solid ${C.amberBorder}30` }}>
                                    🔶 {T2("Pre-prep")} — {prePrep.length} {T2("steps")}
                                  </div>
                                )}
                                {prePrep.map((item, gi) => {
                                  const si = item.origIdx; const step = item.step;
                                  const done = stepDone(d, si); const started = !!d.starts?.[si]; const overdue = isOverdue(d, si);
                                  const el = elapsed(d, si); const tm = d.stepTm?.[si] || step.tm || 0;
                                  const d1Done = isD1Step(d, si);
                                  const gIdx = gi; // global index for lock check
                                  const prevDone = gIdx === 0 ? storeDone : stepDone(d, nonStore[nonStore.indexOf(prePrep[gi - 1]) >= 0 ? prePrep[gi - 1].origIdx : 0].origIdx || 0);
                                  return <StepRow key={si} num={gIdx + 1} title={step.t + (step.live ? " 🔴" : "")} desc={step.i || ""} ccp={step.ccp}
                                    done={done || d1Done} running={started && !done && !d1Done} overdue={overdue}
                                    elapsedSec={el} timerSec={tm} locked={!prevDone && !done && !started && !d1Done}
                                    d1Badge={d1Done}
                                    onStart={() => startStep(dish.fEvId, dish.fIdx, si, tm)}
                                    onDone={() => markManual(dish.fEvId, dish.fIdx, si)}
                                  />;
                                })}

                                {cooking.length > 0 && (
                                  <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginTop: 12, marginBottom: 4, padding: "4px 10px", background: C.redBg + "40", borderRadius: 6, border: `1px solid ${C.redBorder}30` }}>
                                    🔴 {T2("Cooking")} — {cooking.length} {T2("steps")}
                                  </div>
                                )}
                                {cooking.map((item, ci) => {
                                  const si = item.origIdx; const step = item.step;
                                  const done = stepDone(d, si); const started = !!d.starts?.[si]; const overdue = isOverdue(d, si);
                                  const el = elapsed(d, si); const tm = d.stepTm?.[si] || step.tm || 0;
                                  const allPrev = nonStore.slice(0, nonStore.indexOf(item));
                                  const prevDone = allPrev.length === 0 ? storeDone : stepDone(d, allPrev[allPrev.length - 1].origIdx);
                                  return <StepRow key={si} num={prePrep.length + ci + 1} title={step.t + (step.live ? " 🔴" : "")} desc={step.i || ""} ccp={step.ccp}
                                    done={done} running={started && !done} overdue={overdue}
                                    elapsedSec={el} timerSec={tm} locked={!prevDone && !done && !started}
                                    onStart={() => startStep(dish.fEvId, dish.fIdx, si, tm)}
                                    onDone={() => markManual(dish.fEvId, dish.fIdx, si)}
                                  />;
                                })}
                              </div>
                            );
                          })()}

                          {/* All done → sign off */}
                          {storeDone && nonStore.every(x => stepDone(d, x.origIdx) || isD1Step(d, x.origIdx)) && !isReady && (
                            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, textAlign: "center", marginBottom: 10 }}>
                                ✅ {T2("All steps complete — sign off")}
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => {
                                  const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                                  setDs(dish.fEvId, dish.fIdx, { ready: true, completed: true, completedBy: currentUser?.name || "Chef", completedAt: now, readyAt: now });
                                }} style={{ flex: 1, padding: "14px", borderRadius: 12, background: C.green, color: "#0A0A0F", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                  ✅ {T2("Mark Ready")}
                                </button>
                                <button onClick={() => {
                                  const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                                  const tev = todayEvs.find(e => e.id === dish.fEvId);
                                  setDs(dish.fEvId, dish.fIdx, { ready: true, completed: true, transportLinked: true, completedBy: currentUser?.name || "Chef", completedAt: now, readyAt: now });
                                  if (setTransportQueue) {
                                    setTransportQueue(prev => [...(prev || []), {
                                      id: localDateStr(new Date()) + "_" + dish.fEvId + "_" + dish.fIdx,
                                      dishName: dish.name, event: tev?.guest || "Unknown",
                                      pax: tev?.pax || 0, venue: tev?.venue || "",
                                      eventDate: tev?.date || TODAY,
                                      preparedBy: currentUser?.name || "Chef",
                                      markedAt: now, status: "Pending Pickup",
                                    }]);
                                  }
                                }} style={{ flex: 1, padding: "14px", borderRadius: 12, background: "#6B1818", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                  🚛 {T2("Transport")}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Already done */}
                          {isReady && (
                            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: C.greenBg, border: `1px solid ${C.greenBorder}` }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>✅ {T2("Ready")}</span>
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
      {allDishesReady && (
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
                  : <button onClick={() => { setEvMeta(ev.id, "__dispatch_ready", true); setEvMeta(ev.id, "__dispatch_time", new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })); }} style={{ padding: "8px 16px", borderRadius: 10, background: C.gold, color: "#0A0A0F", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
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

// ── StepRow (shared with D1PrepTab) ──
function StepRow({ num, title, desc, ccp, done, running, overdue, elapsedSec, timerSec, locked, d1Badge, onStart, onDone }) {
  const remaining = timerSec - elapsedSec;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.border}20` }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0, marginTop: 1,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
        background: done ? C.green : running ? (overdue ? C.red : C.amber) : C.darkCard,
        border: `2px solid ${done ? C.green : running ? (overdue ? C.red : C.amber) : C.border}`,
        color: done || running ? "#0A0A0F" : C.muted,
      }}>
        {done ? "✓" : num}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: done ? C.green : running ? (overdue ? C.red : C.amber) : C.text }}>{title}</span>
          {d1Badge && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green }}>D-1 ✅</span>}
        </div>
        {desc && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{desc}</div>}
        {ccp && <div style={{ fontSize: 11, color: C.red, marginTop: 3 }}>🔴 CCP: {ccp}</div>}
        {running && timerSec > 0 && (
          <div style={{ marginTop: 6 }}>
            <ProgressBar pct={Math.min(100, Math.round(elapsedSec / timerSec * 100))} color={overdue ? C.red : C.amber} h={3} />
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3, color: overdue ? C.red : C.amber }}>
              ⏱ {Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s elapsed
              {overdue
                ? <span style={{ marginLeft: 6, color: C.red }}>+{Math.floor((elapsedSec - timerSec) / 60)}m {(elapsedSec - timerSec) % 60}s over</span>
                : <span style={{ marginLeft: 6 }}>{Math.floor(remaining / 60)}m {remaining % 60}s left</span>
              }
            </div>
          </div>
        )}
        {!done && !running && !locked && timerSec > 0 && <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>⏱ {Math.floor(timerSec / 60)}m</div>}
      </div>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        {locked && !done && <div style={{ padding: "6px 10px", borderRadius: 8, background: C.darkCard, border: `1px solid ${C.border}`, color: C.faint, fontSize: 12 }}>🔒</div>}
        {!locked && !done && !running && timerSec > 0 && <button onClick={e => { e.stopPropagation(); onStart(); }} style={{ padding: "7px 14px", borderRadius: 10, background: `linear-gradient(135deg,${C.gold},#A8891E)`, color: "#0A0908", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>▶ {Math.floor(timerSec / 60)}m</button>}
        {!locked && !done && !running && !timerSec && <button onClick={e => { e.stopPropagation(); onDone(); }} style={{ padding: "7px 14px", borderRadius: 10, background: C.gold, color: "#0A0908", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ Done</button>}
        {running && !done && <button onClick={e => { e.stopPropagation(); onDone(); }} style={{ padding: "7px 14px", borderRadius: 10, background: overdue ? `linear-gradient(135deg,${C.red},#801818)` : `linear-gradient(135deg,${C.green},#1A5030)`, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{overdue ? "⚠ Done" : "✓ Done"}</button>}
      </div>
    </div>
  );
}

export { EventDayTab };
