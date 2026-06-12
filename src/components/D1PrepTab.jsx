// Ambria FnB — D-1 Prep Tab (redesigned)
// Place in: src/components/D1PrepTab.jsx
import React, { useState } from "react";
import { C, SECTIONS, SECTION_META } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, safeArr } from '../utils/helpers.js';
import { guessSectionForDish, RECIPE_INGREDIENTS, getStepsForDish } from '../data/recipeData.js';
import { Card } from './SharedUI.jsx';

// ── Timer helpers (never auto-complete, show overrun) ──
function elapsed(d, si) { return d.starts?.[si] ? Math.floor((Date.now() - d.starts[si]) / 1000) : 0; }
function stepDone(d, si) {
  if (d.manual?.[si]) return true;
  if (d.mesaDone && si <= 1) return true;
  return false;
}
function isOverdue(d, si) {
  if (stepDone(d, si)) return false;
  if (!d.starts?.[si]) return false;
  const el = elapsed(d, si); const tm = d.stepTm?.[si] || 0;
  return tm > 0 && el >= tm;
}
function fmtTimer(seconds) {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60); const s = abs % 60;
  const str = m + "m " + (s < 10 ? "0" : "") + s + "s";
  return seconds < 0 ? "+" + str + " over" : str;
}
function storeElapsed(d) { return d.storeStart && !d.storeEnd ? Math.floor((Date.now() - d.storeStart) / 1000) : 0; }

// ── Status pill ──
function StatusPill({ label, color, bg, border }) {
  return <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, fontWeight: 600, color, background: bg, border: `1px solid ${border}` }}>{label}</span>;
}

// ── Progress bar ──
function ProgressBar({ pct, color, height = 4 }) {
  const capped = Math.min(100, pct);
  return (
    <div style={{ height, background: C.border, borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: capped + "%", background: color, borderRadius: height / 2, transition: "width .4s" }} />
    </div>
  );
}

// ── Stat card ──
function StatCard({ value, label, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", textAlign: "center", flex: "1 1 80px", minWidth: 80 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || C.text }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function D1PrepTab({
  events, kitchenTracking, setKitchenTracking,
  lang = "en", currentUser = null, sectionFilter = null,
  transportQueue = [], setTransportQueue,
  dishSignoff, setDishSignoff,
  openCam, capturePhoto, stopCam, camOn, camRef, capRef, camStreamRef,
  tick,
}) {
  const T2 = s => T(s, lang);
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};

  // ── State helpers (read/write kitchenTracking) ──
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

  function menuArr(ev) {
    const m = ev.menu;
    if (Array.isArray(m)) return m;
    if (typeof m === 'string' && m) { try { return JSON.parse(m); } catch { return []; } }
    return [];
  }

  // ── Build dish list ──
  const evList = safeArr(events);
  const tomorrowEvs = evList.filter(e => e.date === TOMORROW).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const todayEvs = evList.filter(e => e.date === TODAY).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const hasTodayEvs = todayEvs.length > 0;

  // D-1: if no event today, prep for tomorrow. If event today, this tab shows event-day cooking.
  const d1Evs = hasTodayEvs ? todayEvs : tomorrowEvs;
  const d1Label = hasTodayEvs
    ? new Date(TODAY + "T00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })
    : new Date(TOMORROW + "T00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });

  if (d1Evs.length === 0) {
    return (
      <Card style={{ padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
        <div style={{ fontSize: 14, color: C.muted }}>{T2("No upcoming functions to prep for")}</div>
      </Card>
    );
  }

  // Aggregate dishes across events
  const byDish = {};
  d1Evs.forEach(ev => {
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

  // Group by section
  const bySec = {};
  Object.entries(byDish).forEach(([n, info]) => {
    if (!bySec[info.sec]) bySec[info.sec] = [];
    bySec[info.sec].push({ name: n, ...info });
  });
  const secKeys = Object.keys(bySec).sort();
  const totalDishes = Object.keys(byDish).length;

  // Stats
  const doneDishes = Object.values(byDish).filter(d => ds(d.fEvId, d.fIdx).mesaDone || ds(d.fEvId, d.fIdx).ready).length;
  const inProgressDishes = Object.values(byDish).filter(d => {
    const dd = ds(d.fEvId, d.fIdx);
    if (dd.mesaDone || dd.ready) return false;
    return dd.storeStart || Object.keys(dd.starts || {}).length > 0;
  }).length;
  const pendingDishes = totalDishes - doneDishes - inProgressDishes;
  const totalPax = d1Evs.reduce((s, e) => s + (+e.pax || 0), 0);

  // ── Section + dish expand state ──
  const [openSecs, setOpenSecs] = useState({});
  const [openDishes, setOpenDishes] = useState({});
  const toggleSec = (sec) => setOpenSecs(p => ({ ...p, [sec]: !p[sec] }));
  const isSecOpen = (sec) => openSecs[sec] === true; // default collapsed
  const toggleDish = (key) => setOpenDishes(p => ({ ...p, [key]: !p[key] }));
  const isDishOpen = (key) => !!openDishes[key];

  // ── Render ──
  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>
          {hasTodayEvs ? `🔥 ${T2("Event Day")} — ${d1Label}` : `📋 D-1 ${T2("for")} ${d1Label}`}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          {d1Evs.map(e => e.guest).join(" · ")} — {d1Evs.map(e => `${e.pax} pax`).join(" + ")}
        </div>
      </div>

      {/* ── Info bar ── */}
      {!hasTodayEvs && (
        <div style={{ background: C.goldBg, border: `1px solid ${C.goldBorder}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <div style={{ fontSize: 12, color: C.gold }}>{T2("Advance prep only — mesa, marination, grinding, cutting. Cooking happens on")} {d1Label}.</div>
        </div>
      )}

      {/* ── Stats dashboard ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard value={doneDishes} label={T2("Done")} color={C.green} />
        <StatCard value={inProgressDishes} label={T2("In progress")} color={C.amber} />
        <StatCard value={pendingDishes} label={T2("Pending")} color={C.muted} />
        <StatCard value={totalDishes} label={T2("Total dishes")} />
        <StatCard value={totalPax.toLocaleString()} label={T2("Total pax")} />
      </div>

      {/* ── Section list ── */}
      {secKeys.map(sec => {
        const items = bySec[sec];
        const m = SECTION_META[sec] || { color: C.muted, icon: "🍽" };
        const secDone = items.filter(d => ds(d.fEvId, d.fIdx).mesaDone || ds(d.fEvId, d.fIdx).ready).length;
        const secInProg = items.filter(d => {
          const dd = ds(d.fEvId, d.fIdx);
          if (dd.mesaDone || dd.ready) return false;
          return dd.storeStart || Object.keys(dd.starts || {}).length > 0;
        }).length;
        const secPct = Math.round(secDone / items.length * 100);
        const secOpen = isSecOpen(sec);
        const secAllDone = secDone === items.length;
        const secSpecials = [...new Map(items.flatMap(d => d.specials || []).map(sp => [sp.guest + "|" + sp.instruction, sp])).values()];

        return (
          <div key={sec} style={{ marginBottom: 8 }}>
            {/* Section header bar */}
            <div
              onClick={() => toggleSec(sec)}
              style={{
                display: "flex", gap: 10, alignItems: "center", padding: "12px 14px",
                borderRadius: secOpen ? "12px 12px 0 0" : 12,
                border: `1px solid ${secAllDone ? C.greenBorder : C.border}`,
                borderBottom: secOpen ? `1px solid ${C.border}` : undefined,
                background: secAllDone ? C.greenBg : C.surface,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: secAllDone ? C.green : m.color }}>{T2(sec)}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{items.length} {T2("dishes")}</span>
                  {secSpecials.length > 0 && (
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, fontWeight: 700 }}>🚫 {secSpecials.length}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {secDone} {T2("done")}{secInProg > 0 ? ` · ${secInProg} ${T2("in progress")}` : ""}
                </div>
                <ProgressBar pct={secPct} color={secAllDone ? C.green : secDone > 0 ? C.amber : C.border} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: secAllDone ? C.green : secPct > 0 ? C.amber : C.muted, minWidth: 36, textAlign: "right" }}>
                {secPct}%
              </span>
              <span style={{ fontSize: 14, color: C.muted, transform: secOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
            </div>

            {/* Special dietary alerts */}
            {secOpen && secSpecials.length > 0 && (
              <div style={{ padding: "8px 14px", background: C.redBg + "80", borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                {secSpecials.map((sp, si) => (
                  <div key={si} style={{ fontSize: 12, color: C.red, padding: "4px 0", borderBottom: si < secSpecials.length - 1 ? `1px solid ${C.redBorder}40` : "none" }}>
                    🚫 <b>{sp.pax} {T2("pax")}</b> — {sp.guest}: {sp.instruction}
                  </div>
                ))}
              </div>
            )}

            {/* Dish list */}
            {secOpen && (
              <div style={{ border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "6px 10px 10px" }}>
                {items.map((dish, di) => {
                  const dKey = `${dish.fEvId}_${dish.fIdx}`;
                  const d = ds(dish.fEvId, dish.fIdx);
                  const isDone = !!d.mesaDone || !!d.ready;
                  const steps = getStepsForDish(dish.name);
                  const stepList = steps.length > 0 ? steps : [
                    { t: "Mesa", i: "Wash, cut, measure all ingredients as per recipe", tm: 600 },
                    { t: "Primary prep", i: "Prepare base masala / paste / marinade", tm: 480 },
                  ];

                  // Step progress
                  const storeStarted = !!d.storeStart;
                  const storeDone = !!d.storeEnd;
                  const storeEl = storeStarted && !storeDone ? Math.floor((Date.now() - d.storeStart) / 1000) : 0;
                  const storeOverdue = storeStarted && !storeDone && storeEl >= 1800;

                  const doneSteps = stepList.filter((_, si) => stepDone(d, si)).length;
                  const runningStep = stepList.findIndex((_, si) => d.starts?.[si] && !stepDone(d, si));
                  const anyRunning = runningStep >= 0 || (storeStarted && !storeDone);
                  const totalSteps = stepList.length + 1; // +1 for store
                  const completedTotal = (storeDone ? 1 : 0) + doneSteps;

                  // Status
                  let statusLabel, statusColor;
                  if (isDone) { statusLabel = "Done"; statusColor = C.green; }
                  else if (anyRunning) {
                    if (storeOverdue || (runningStep >= 0 && isOverdue(d, runningStep))) {
                      statusLabel = "Overdue"; statusColor = C.red;
                    } else {
                      statusLabel = "In progress"; statusColor = C.amber;
                    }
                  } else { statusLabel = "Pending"; statusColor = C.muted; }

                  // Running timer display
                  let timerDisplay = null;
                  if (!isDone && runningStep >= 0) {
                    const el = elapsed(d, runningStep);
                    const tm = d.stepTm?.[runningStep] || 0;
                    const remaining = tm - el; // negative = overdue
                    timerDisplay = (
                      <span style={{ fontSize: 12, fontWeight: 700, color: remaining < 0 ? C.red : C.amber }}>
                        {fmtTimer(remaining)}
                      </span>
                    );
                  } else if (!isDone && storeStarted && !storeDone) {
                    const remaining = 1800 - storeEl;
                    timerDisplay = (
                      <span style={{ fontSize: 12, fontWeight: 700, color: remaining < 0 ? C.red : C.amber }}>
                        {fmtTimer(remaining)}
                      </span>
                    );
                  }

                  return (
                    <div key={di} style={{ marginBottom: 4 }}>
                      {/* Dish row */}
                      <div
                        onClick={() => toggleDish(dKey)}
                        style={{
                          display: "flex", gap: 10, alignItems: "center", padding: "10px 8px",
                          borderRadius: 10, cursor: "pointer",
                          background: isDone ? C.greenBg : anyRunning ? C.surface : "transparent",
                          border: `1px solid ${isDone ? C.greenBorder : anyRunning ? C.amberBorder + "60" : "transparent"}`,
                        }}
                      >
                        {/* Check circle */}
                        <div style={{
                          width: 24, height: 24, borderRadius: 7,
                          border: `2px solid ${isDone ? C.green : anyRunning ? C.amber : C.border}`,
                          background: isDone ? C.green : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {isDone && <span style={{ color: "#0A0A0F", fontSize: 10, fontWeight: 700 }}>✓</span>}
                          {!isDone && anyRunning && <span style={{ color: C.amber, fontSize: 8 }}>▶</span>}
                        </div>

                        {/* Dish info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isDone ? C.green : C.text }}>{dish.name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>
                            {dish.totalPax} {T2("pax")} · {completedTotal}/{totalSteps} {T2("steps")}
                            {dish.fns.length > 1 && ` · ${dish.fns.map(f => f.g.split(" ")[0]).join(" + ")}`}
                          </div>
                        </div>

                        {/* Timer or status */}
                        <div style={{ flexShrink: 0, textAlign: "right" }}>
                          {timerDisplay || (
                            <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{T2(statusLabel)}</span>
                          )}
                        </div>

                        <span style={{ fontSize: 12, color: C.muted }}>{isDishOpen(dKey) ? "▼" : "▶"}</span>
                      </div>

                      {/* Expanded: step list */}
                      {isDishOpen(dKey) && (
                        <div style={{ padding: "8px 4px 8px 38px" }}>

                          {/* Step 0: Store sourcing */}
                          <StepRow
                            num={0} title={`🏪 ${T2("Collect from store")}`}
                            desc={T2("Source all ingredients before cooking") + " · 30m"}
                            done={storeDone}
                            running={storeStarted && !storeDone}
                            overdue={storeOverdue}
                            elapsedSec={storeEl}
                            timerSec={1800}
                            locked={false}
                            onStart={() => setDs(dish.fEvId, dish.fIdx, { storeStart: Date.now() })}
                            onDone={() => setDs(dish.fEvId, dish.fIdx, { storeEnd: Date.now() })}
                            doneTime={d.storeEndAt || null}
                          />

                          {/* SOP steps */}
                          {stepList.map((step, si) => {
                            const done = stepDone(d, si);
                            const started = !!d.starts?.[si];
                            const overdue = isOverdue(d, si);
                            const el = elapsed(d, si);
                            const tm = d.stepTm?.[si] || step.tm || 0;

                            // Locked: previous step not done
                            const prevDone = si === 0
                              ? storeDone
                              : stepDone(d, si - 1);

                            return (
                              <StepRow
                                key={si}
                                num={si + 1}
                                title={step.t}
                                desc={step.i || step.desc || ""}
                                ccp={step.ccp}
                                done={done}
                                running={started && !done}
                                overdue={overdue}
                                elapsedSec={el}
                                timerSec={tm}
                                locked={!prevDone && !done && !started}
                                onStart={() => {
                                  const starts = { ...(d.starts || {}) };
                                  starts[si] = Date.now();
                                  setDs(dish.fEvId, dish.fIdx, { starts, stepTm: { ...(d.stepTm || {}), [si]: tm } });
                                }}
                                onDone={() => setDs(dish.fEvId, dish.fIdx, { manual: { ...(d.manual || {}), [si]: true } })}
                                doneTime={d.manualAt?.[si] || null}
                              />
                            );
                          })}

                          {/* All steps done → sign-off buttons */}
                          {storeDone && stepList.every((_, si) => stepDone(d, si)) && !isDone && (
                            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, textAlign: "center", marginBottom: 10 }}>
                                ✅ {T2("All steps complete — sign off to finish")}
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={() => {
                                    const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                                    setDs(dish.fEvId, dish.fIdx, { mesaDone: true, completedBy: currentUser?.name || "Chef", completedAt: now });
                                  }}
                                  style={{ flex: 1, padding: "14px", borderRadius: 12, background: C.green, color: "#0A0A0F", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 48 }}
                                >
                                  ✅ {T2("Mark Done")}
                                </button>
                                <button
                                  onClick={() => {
                                    const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                                    setDs(dish.fEvId, dish.fIdx, { mesaDone: true, transportLinked: true, completedBy: currentUser?.name || "Chef", completedAt: now });
                                    const tev = d1Evs.find(e => e.id === dish.fEvId);
                                    if (setTransportQueue) {
                                      setTransportQueue(prev => [...(prev || []), {
                                        id: Date.now() + "_" + dish.fEvId + "_" + dish.fIdx,
                                        dishName: dish.name, event: tev?.guest || "Unknown",
                                        pax: tev?.pax || 0, venue: tev?.venue || "",
                                        eventDate: tev?.date || TODAY,
                                        preparedBy: currentUser?.name || "Chef",
                                        markedAt: now, status: "Pending Pickup",
                                      }]);
                                    }
                                  }}
                                  style={{ flex: 1, padding: "14px", borderRadius: 12, background: "#6B1818", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 48 }}
                                >
                                  🚛 {T2("Mark for Transport")}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Already done banner */}
                          {isDone && (
                            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: C.greenBg, border: `1px solid ${C.greenBorder}` }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>✅ {T2("Completed")}</span>
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
    </div>
  );
}

// ── Individual step row ──
function StepRow({ num, title, desc, ccp, done, running, overdue, elapsedSec, timerSec, locked, onStart, onDone, doneTime }) {
  const remaining = timerSec - elapsedSec;
  const pct = timerSec > 0 ? Math.round(elapsedSec / timerSec * 100) : 0;

  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      padding: "10px 0",
      borderBottom: `1px solid ${C.border}20`,
    }}>
      {/* Number circle */}
      <div style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0, marginTop: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700,
        background: done ? C.green : running ? (overdue ? C.red : C.amber) : C.darkCard,
        border: `2px solid ${done ? C.green : running ? (overdue ? C.red : C.amber) : C.border}`,
        color: done || running ? "#0A0A0F" : C.muted,
      }}>
        {done ? "✓" : num}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: done ? C.green : running ? (overdue ? C.red : C.amber) : C.text }}>{title}</div>
        {desc && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{desc}</div>}
        {ccp && <div style={{ fontSize: 11, color: C.red, marginTop: 3 }}>🔴 CCP: {ccp}</div>}

        {/* Timer bar (running) */}
        {running && timerSec > 0 && (
          <div style={{ marginTop: 6 }}>
            <ProgressBar pct={Math.min(pct, 100)} color={overdue ? C.red : C.amber} height={3} />
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3, color: overdue ? C.red : C.amber }}>
              ⏱ {Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s elapsed
              {timerSec > 0 && (
                <span style={{ marginLeft: 6 }}>
                  — {overdue
                    ? <span style={{ color: C.red }}>+{Math.floor((elapsedSec - timerSec) / 60)}m {(elapsedSec - timerSec) % 60}s over</span>
                    : `${Math.floor(remaining / 60)}m ${remaining % 60}s left`
                  }
                </span>
              )}
            </div>
          </div>
        )}

        {/* Done time */}
        {done && doneTime && <div style={{ fontSize: 11, color: C.green, marginTop: 3 }}>✅ {doneTime}</div>}

        {/* Not started, show expected time */}
        {!done && !running && !locked && timerSec > 0 && (
          <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>⏱ {Math.floor(timerSec / 60)}m{timerSec % 60 > 0 ? " " + (timerSec % 60) + "s" : ""}</div>
        )}
      </div>

      {/* Action button */}
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        {locked && !done && (
          <div style={{ padding: "6px 10px", borderRadius: 8, background: C.darkCard, border: `1px solid ${C.border}`, color: C.faint, fontSize: 12 }}>🔒</div>
        )}
        {!locked && !done && !running && timerSec > 0 && (
          <button onClick={e => { e.stopPropagation(); onStart(); }} style={{ padding: "7px 14px", borderRadius: 10, background: `linear-gradient(135deg,${C.gold},#A8891E)`, color: "#0A0908", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 36 }}>
            ▶ {Math.floor(timerSec / 60)}m
          </button>
        )}
        {!locked && !done && !running && !timerSec && (
          <button onClick={e => { e.stopPropagation(); onDone(); }} style={{ padding: "7px 14px", borderRadius: 10, background: C.gold, color: "#0A0908", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 36 }}>
            ✓ Done
          </button>
        )}
        {running && !done && (
          <button onClick={e => { e.stopPropagation(); onDone(); }} style={{ padding: "7px 14px", borderRadius: 10, background: overdue ? `linear-gradient(135deg,${C.red},#801818)` : `linear-gradient(135deg,${C.green},#1A5030)`, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 36 }}>
            {overdue ? "⚠ Done" : "✓ Done"}
          </button>
        )}
      </div>
    </div>
  );
}

export { D1PrepTab };
