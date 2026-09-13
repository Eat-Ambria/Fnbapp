// Ambria FnB — Event Day Tab (redesigned)
// Place in: src/components/EventDayTab.jsx
import React, { useState, useEffect, useRef } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr, safePct, localDateStr, fmtStamp, fmtQty, categorizeIngredient, INGR_CATEGORY_ORDER, mergeDishState, storeItemKey, markAllCollected } from '../utils/helpers.js';
import { getCatIdForDish, getCatForDish, isFruitSelectionDish, RECIPE_DB, getFullSteps, getStepsForDish, fmtT, getIngrForDish, getIngrForYield, getBgDemandForDish, getBgDemandForYield, findRecipeForDish, dishLabel, getDishImageUrl } from '../data/recipeData.js';
import { K, type, tone } from '../utils/theme.js';
import { ripple } from '../utils/ripple.js';
import { catMeta, ingredientEmoji } from '../data/ingredientIcons.js';
import { Icon, KPanel, KStat, KPill, KProgress, KBanner, KColHead, KButton, KModal, KToast } from './KitchenUI.jsx';

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

// ── Overtime alarm — one shared siren loop so concurrent overdue steps never overlap ──
let _alarmCtx = null, _alarmOsc = null, _alarmGain = null, _alarmTimerId = null, _alarmPlaying = false;
function _sirenSweep() {
  if (!_alarmOsc || !_alarmCtx) return;
  const t = _alarmCtx.currentTime;
  _alarmOsc.frequency.cancelScheduledValues(t);
  _alarmOsc.frequency.setValueAtTime(420, t);
  _alarmOsc.frequency.linearRampToValueAtTime(1250, t + 0.8);
  _alarmOsc.frequency.linearRampToValueAtTime(420, t + 1.6);
}
function startAlarm() {
  if (_alarmPlaying) return;
  _alarmPlaying = true;
  try {
    if (!_alarmCtx) _alarmCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_alarmCtx.state === "suspended") _alarmCtx.resume();
    _alarmOsc = _alarmCtx.createOscillator();
    _alarmGain = _alarmCtx.createGain();
    _alarmOsc.type = "sawtooth";
    _alarmGain.gain.setValueAtTime(0.16, _alarmCtx.currentTime);
    _alarmOsc.connect(_alarmGain); _alarmGain.connect(_alarmCtx.destination);
    _alarmOsc.start();
    _sirenSweep();
    _alarmTimerId = setInterval(_sirenSweep, 1600);
  } catch (e) {}
}
function stopAlarm() {
  _alarmPlaying = false;
  if (_alarmTimerId) { clearInterval(_alarmTimerId); _alarmTimerId = null; }
  if (_alarmOsc) { try { _alarmOsc.stop(); } catch (e) {} try { _alarmOsc.disconnect(); } catch (e) {} _alarmOsc = null; }
  if (_alarmGain) { try { _alarmGain.disconnect(); } catch (e) {} _alarmGain = null; }
}

// ── Sub-components ──
function ProgressBar({ pct, color, h = 4 }) {
  return <div style={{ height: h, background: C.border, borderRadius: h / 2, overflow: "hidden" }}>
    <div style={{ height: "100%", width: Math.min(100, pct) + "%", background: color, borderRadius: h / 2, transition: "width .4s" }} />
  </div>;
}
// StatCard removed — the stat row now uses <KStat> from KitchenUI.jsx.

function EventDayTab({
  events, kitchenTracking, setKitchenTracking,
  lang = "en", currentUser = null, sectionFilter = null, allowedCatIds = null,
  transportQueue = [], setTransportQueue,
  dishSignoff, setDishSignoff,
  openCam, capturePhoto, stopCam, camOn, camRef, capRef, camStreamRef,
  evPlanRows = {}, tick, setTab, onBeforeDishDone,
}) {
  const T2 = s => T(s, lang);
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const evList = safeArr(events);
  const todayEvs = evList.filter(e => e.date === TODAY).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  // ── State helpers (combined cooking keys) ──
  function dk(evId, idx) { return evId + "|" + idx; }
  function ck(dishName) { return "dish|" + dishName; }
  // Fresh TODAY re-derived on every call — module-load TODAY goes stale on tabs open across midnight
  function _freshToday(){ return localDateStr(new Date()); }
  function ds(evId, idx, dishName) {
    const _TOD = _freshToday();
    if (isCombined && dishName) return kt["__combined_"+_TOD]?.[ck(dishName)] || {};
    var perEv = kt[evId]?.[dk(evId, idx)] || {};
    if (dishName && !Object.keys(perEv).length) {
      var cb = kt["__combined_"+_TOD]?.[ck(dishName)] || {};
      if (Object.keys(cb).length) { var r = Object.assign({}, cb); delete r.mesaDone; return r; }
    }
    return perEv;
  } 
  function setDs(evId, idx, upd, dishInfo) {
    const _TOD = _freshToday();
    setKitchenTracking(p => {
      const o = p && typeof p === "object" ? { ...p } : {};
      // mergeDishState, not a spread: see its comment in utils/helpers.js —
      // a shallow merge lets a stale step map erase a just-recorded Done.
      if (isCombined && dishInfo?.name) {
        const cKey = ck(dishInfo.name);
        var _ck = "__combined_" + _TOD; o[_ck] = { ...(o[_ck] || {}), [cKey]: mergeDishState(o[_ck]?.[cKey], upd) };
        // Propagate cooking progress to per-function keys (except mesaDone — transport is per-event)
        var propUpd = Object.assign({}, upd); delete propUpd.mesaDone;
        if (Object.keys(propUpd).length > 0) {
          (dishInfo.fns || []).forEach(fn => {
            const k2 = dk(fn.evId, fn.idx);
            o[fn.evId] = { ...(o[fn.evId] || {}), [k2]: mergeDishState(o[fn.evId]?.[k2], propUpd) };
          });
        }
      } else {
        const k2 = dk(evId, idx);
        o[evId] = { ...(o[evId] || {}), [k2]: mergeDishState(o[evId]?.[k2], upd) };
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
  // Send-to-transport picker. { sec, label, fns:[…], dishes:[…] } while open.
  // Quantities are held per cell, keyed "<evId>|<dishName>" — a shared dish is
  // one cooked batch that the chef splits between functions, so the amount is a
  // property of the pairing, not of the dish.
  const [transportPick, setTransportPick] = useState(null);
  const [transportQty,  setTransportQty]  = useState({});   // { cellKey: "2.5" }
  const [transportToast, setTransportToast] = useState(null);

  // Every cell the chef has actually put a number in. Derived, so the Send count,
  // the disabled state and the rows that get queued can never disagree.
  const transportCells = React.useMemo(() => {
    if (!transportPick) return [];
    const out = [];
    transportPick.dishes.forEach(d => {
      if (!d.ready) return;                       // raw food does not go on the van
      transportPick.fns.forEach(f => {
        if (!d.cells[f.evId]) return;             // dish not part of this function
        const qty = parseFloat(transportQty[`${f.evId}|${d.n}`]);
        if (!(qty > 0)) return;
        out.push({ evId: f.evId, guest: f.guest, venue: f.venue, pax: f.pax, date: f.date,
          n: d.n, qty, unit: d.unit });
      });
    });
    return out;
  }, [transportPick, transportQty]);

  // V74 — per-section ingredient panel UI state (session-local, not synced across tablets)
  const [secIngrOpen, setSecIngrOpen] = useState({});   // { [sec]: bool }
  const [secSearch,   setSecSearch]   = useState({});   // { [sec]: string }
  const [secSort,     setSecSort]     = useState({});   // { [sec]: 'qty'|'name' }
  // Ingredient accordion: explicit open/closed per category, keyed "<sec>|<cat>".
  // Absent = fall back to the default (first not-yet-finished aisle is open).
  const [secCatOpen,  setSecCatOpen]  = useState({});   // { [sec|cat]: bool }

  // D-1 status banner dismissal. Stored against the date (read fresh, not the
  // module-frozen TODAY) so it stays hidden for the rest of the day but comes
  // back on the next one — it is a per-day status, not a permanent setting.
  const D1_DISMISS_KEY = "ambria_d1_banner_dismissed";
  const [d1Dismissed, setD1Dismissed] = useState(() => {
    try { return localStorage.getItem(D1_DISMISS_KEY) === localDateStr(new Date()); } catch { return false; }
  });
  function dismissD1() {
    setD1Dismissed(true);
    try { localStorage.setItem(D1_DISMISS_KEY, localDateStr(new Date())); } catch { /* private mode */ }
  }

  // ── Overtime alarm bookkeeping — StepRow pushes its own key into this ref while overdue+unmuted;
  // an effect after every render turns the single shared alarm on/off based on whether the ref is non-empty ──
  const overdueRef = useRef([]);
  overdueRef.current = [];
  const [alarmMuted, setAlarmMuted] = useState({});
  function muteAlarm(key) { setAlarmMuted(p => p[key] ? p : { ...p, [key]: true }); }
  function clearMuteAlarm(key) { setAlarmMuted(p => { if (!p[key]) return p; const n = { ...p }; delete n[key]; return n; }); }
  useEffect(() => { if (overdueRef.current.length > 0) startAlarm(); else stopAlarm(); });
  useEffect(() => () => stopAlarm(), []);

  // ── Section-level "Collect from store" (scope: combined vs per-function) ──
  function ssKey(catId) { return "__sec_" + catId; }
  function ssRead(catId) {
    const _TOD = _freshToday();
    if (isCombined) return kt["__combined_"+_TOD]?.[ssKey(catId)] || {};
    return activeEv ? (kt[activeEv.id]?.[ssKey(catId)] || {}) : {};
  }
  function ssWrite(catId, upd) {
    const _TOD = _freshToday();
    setKitchenTracking(p => {
      const o = p && typeof p === "object" ? { ...p } : {};
      const scope = isCombined ? ("__combined_" + _TOD) : (activeEv ? activeEv.id : null);
      if (!scope) return o;
      const sK = ssKey(catId);
      // mergeDishState, not a spread: it merges items_done against the LATEST
      // state inside the updater. A plain spread replaced the whole map with
      // whatever the caller had captured at render time, so a second tick a
      // moment later undid the first.
      o[scope] = { ...(o[scope] || {}), [sK]: mergeDishState(o[scope]?.[sK], upd) };
      return o;
    });
  }
  // Aggregate ingredients across all dishes in a section (same yield scaling as per-dish card)
  function aggSecIngredients(dishes) {
    const bucket = {}; let totalKg = 0;
    // Unit families to merge kg↔gm and L↔ml on the same ingredient.
    const WEIGHT_G  = { g: 1, gm: 1, kg: 1000 };
    const VOLUME_ML = { ml: 1, l: 1000, L: 1000 };
    const familyOf = (u) => WEIGHT_G[u] != null ? 'w' : VOLUME_ML[u] != null ? 'v' : (u || '');
    const toBase   = (q, u) => (Number(q) || 0) * (WEIGHT_G[u] != null ? WEIGHT_G[u] : VOLUME_ML[u] != null ? VOLUME_ML[u] : 1);
    dishes.forEach(dish => {
      const evObj = todayEvs.find(e => e.id === dish.fEvId);
      if (!evObj) return;
      const pax = +evObj.pax || 0;
      const rec = findRecipeForDish(dish.name);
      const baseKg = rec?.ingredients?.base_yield?.kg || null;
      const basePax = rec?.ingredients?.base_pax || 300;
      const mult = Number(evObj.yield_multiplier) || 1.0;
      let ing = null, effKg = null;
      if (baseKg) {
        const plannedKg = Number(evPlanRows?.[evObj.id]?.[dish.name]?.target_yield_kg) || null;
        const defaultYield = pax > 0 ? (baseKg * pax / basePax) : baseKg;
        // Pin (plannedKg) is authoritative — slider only scales the auto-computed default
        effKg = plannedKg ? plannedKg : defaultYield * mult;
        ing = getIngrForYield(dish.name, effKg);
      }
      if (!ing || ing.length === 0) {
        const adjPax = Math.round(pax * mult);
        ing = getIngrForDish(dish.name, adjPax || pax);
        effKg = null;
      }
      if (effKg) totalKg += effKg;
      if (!ing) return;
      ing.filter(i => i.q > 0).forEach(i => {
        const fam = familyOf(i.u);
        // Bucket key = name|family so kg + gm collapse to one row, ml + L collapse, pcs stays separate
        const k = (i.n || "").toLowerCase().trim() + "|" + fam;
        if (!bucket[k]) bucket[k] = { n: i.n, fam: fam, _base: 0, u: i.u, q: 0 };
        bucket[k]._base += toBase(i.q, i.u);
      });
    });
    // Emit each bucket in the smartest unit for its magnitude
    Object.values(bucket).forEach(b => {
      if (b.fam === 'w') {
        if (b._base >= 1000) { b.q = b._base / 1000; b.u = 'kg'; }
        else                 { b.q = b._base;        b.u = 'gm'; }
      } else if (b.fam === 'v') {
        if (b._base >= 1000) { b.q = b._base / 1000; b.u = 'L'; }
        else                 { b.q = b._base;        b.u = 'ml'; }
      } else {
        b.q = b._base; // pcs and other non-convertible units — no change
      }
    });
    return { items: Object.values(bucket).sort((a,b) => (a.n || "").localeCompare(b.n || "")), totalKg: totalKg };
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
  // The inverse of markManual, and it has to clear the SAME key. stepDone reads
  // three shapes for one step — manual[si], manual["step_"+si], manual[String(si)]
  // — because different versions have written different ones. Undo used to send
  // only the "step_N" form while markManual writes the numeric one, so the
  // numeric key stayed true and the step re-marked itself the moment it
  // re-rendered. Clear all three.
  function clearManual(evId, idx, si, dishInfo) {
    const keys = [si, "step_" + si, String(si)];
    const off = {}, nulled = {};
    keys.forEach(k => { off[k] = false; nulled[k] = null; });
    setDs(evId, idx, {
      manual: off,
      manualAt: nulled,
      doneElapsed: nulled,
      starts: nulled,
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
      <div style={{ background: K.surface, border: `1px solid ${K.line}`, borderRadius: K.rLg, boxShadow: K.shadowCard, padding: "44px 24px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: K.rLg, background: K.accentSoft, color: K.accent, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Icon name="clipboard" size={24} strokeWidth={1.8} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: K.text, marginBottom: 6 }}>{T2("No events today")}</div>
        <div style={{ fontSize: 13, color: K.textMuted, lineHeight: 1.6 }}>{T2("Today is a D-1 prep day. Switch to the D-1 tab to see advance prep tasks.")}</div>
        {setTab && <div style={{ marginTop: 18 }}><KButton variant="accent" icon="clipboard" onClick={() => setTab("today")}>{T2("Go to D-1 Prep")}</KButton></div>}
      </div>
    );
  }

  // ── Build dish list (filtered by selected function) ──
  const byDish = {};
  filteredEvs.forEach(ev => {
    const sp = ev.special || "";
    const isSpecial = /no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
    menuArr(ev).forEach((name, idx) => {
      const dishCatId = getCatIdForDish(name);
      if (dishCatId === "beverages" || isFruitSelectionDish(name)) return;
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
  // A bg-type ingredient row can be entered in gm or ml (V72 allowed any unit),
  // but this accumulator never converted — it added the raw number straight
  // into a variable literally called totalKg, so a row entered as "650 gm"
  // contributed 650 as if it were 650 KG, a 1000x inflation. Fixing the unit on
  // a row (e.g. kg -> gm for a value that was always meant to be small) changed
  // nothing here, since the numeric qty was identical either way and the unit
  // was simply ignored. KitchenHub.jsx's own bg-demand aggregator already
  // carries the correct V72 unit-aware conversion (kg/L 1:1, gm/ml /1000,
  // non-mass/volume units skipped with a warning) — this just never got
  // ported over here. Mirrored verbatim for consistency.
  function toKgEquiv(qty, unit, bgName) {
    const u = String(unit || 'kg').toLowerCase();
    if (u === 'kg' || u === 'l') return qty;
    if (u === 'gm' || u === 'ml') return qty / 1000;
    if (!toKgEquiv._warned) toKgEquiv._warned = new Set();
    if (!toKgEquiv._warned.has(bgName)) {
      console.warn(`[bg-demand] BG '${bgName}' uses non-mass/volume unit '${unit}' — skipped from totalKg`);
      toKgEquiv._warned.add(bgName);
    }
    return 0;
  }
  // 9C — Demand-driven bg injection: sum kg per bg recipe from dishes' type='bg' rows,
  // inject each summed bg as ONE pseudo-dish with totalKg. Skip bgs with zero demand.
  Object.keys(bySec).forEach(catId => {
    const secDishes = bySec[catId];
    if (!secDishes || secDishes.length === 0) return;
    const bgDemand = {}; // {bgName: {totalKg, fns:[]}}
    secDishes.forEach(d => {
      const rec = findRecipeForDish(d.name);
      if (!rec?.ingredients?.items?.length) return;
      const evObj = todayEvs.find(e => e.id === d.fEvId);
      if (!evObj) return;
      const pax = +evObj.pax || 0;
      const baseKg = rec.ingredients.base_yield?.kg || null;
      const basePax = rec.ingredients.base_pax || 300;
      const mult = Number(evObj.yield_multiplier) || 1.0;
      let bgs = [];
      if (baseKg) {
        const plannedKg = Number(evPlanRows?.[evObj.id]?.[d.name]?.target_yield_kg) || null;
        const defaultYield = pax > 0 ? (baseKg * pax / basePax) : baseKg;
        const effKg = plannedKg ? plannedKg : defaultYield * mult;
        bgs = getBgDemandForYield(d.name, effKg);
      } else {
        const adjPax = Math.round(pax * mult);
        bgs = getBgDemandForDish(d.name, adjPax || pax);
      }
      bgs.forEach(b => {
        if (!b.bgName || b.qty <= 0) return;
        if (!bgDemand[b.bgName]) bgDemand[b.bgName] = { totalKg: 0, fns: [] };
        bgDemand[b.bgName].totalKg += toKgEquiv(Number(b.qty) || 0, b.unit, b.bgName);
        (d.fns || []).forEach(fn => {
          if (!bgDemand[b.bgName].fns.some(x => x.evId === fn.evId)) bgDemand[b.bgName].fns.push(fn);
        });
      });
    });
    const bgEntries = [];
    let fIdx = 9000;
    const anchor = secDishes[0];
    Object.keys(bgDemand).forEach(bgName => {
      const dem = bgDemand[bgName];
      if (dem.totalKg <= 0) return;
      const bgRec = findRecipeForDish(bgName);
      if (!bgRec || !bgRec.bg) { console.warn('[EventDay bg-inject] not a bg recipe:', bgName); return; }
      bgEntries.push({
        name: bgName,
        catId,
        totalPax: 0,
        totalKg: dem.totalKg,
        fns: dem.fns.length > 0 ? dem.fns : (anchor.fns || []),
        fEvId: anchor.fEvId,
        fIdx: fIdx++,
        specials: [],
        isBaseGravy: true,
      });
    });
    if (bgEntries.length > 0) {
      bySec[catId] = [...bgEntries, ...secDishes];
    }
  });
  const secKeys = Object.keys(bySec).sort();
  const totalDishes = Object.keys(byDish).length;

  // Stats
  const readyDishes = Object.values(byDish).filter(d => ds(d.fEvId, d.fIdx, d.name).ready).length;
  const inProgressDishes = Object.values(byDish).filter(d => {
    const dd = ds(d.fEvId, d.fIdx, d.name);
    if (dd.ready) return false;
    return Object.keys(dd.starts || {}).length > 0;
  }).length;
  const d1PrepDone = Object.values(byDish).filter(d => ds(d.fEvId, d.fIdx, d.name).mesaDone).length;
  const pendingDishes = totalDishes - readyDishes - inProgressDishes;
  const totalPax = filteredEvs.reduce((s, e) => s + (+e.pax || 0), 0);
  const overallPct = totalDishes > 0 ? Math.round(readyDishes / totalDishes * 100) : 0;

  return (
    <div>
      {/* ── D-1 prep status ──
          The "Event Day — <date> / <guest> (<pax> · <time>)" bar used to sit
          here, but the page header already carries exactly that, so it was the
          same line twice. Header owns it now. */}
      {!d1Dismissed && (d1PrepDone > 0 ? (
        <KBanner
          toneName="ok"
          icon="check"
          compact
          onDismiss={dismissD1}
          title={`${d1PrepDone}/${totalDishes} ${T2("dishes had D-1 prep done yesterday")}`}
          sub={T2("Those steps are marked D-1 ✅ — skip to cooking")}
          style={{ marginBottom: 12 }}
        />
      ) : (
        <KBanner
          toneName="warn"
          icon="alert"
          compact
          onDismiss={dismissD1}
          title={T2("No D-1 prep was done yesterday")}
          sub={T2("All steps including Mesa must be completed today")}
          style={{ marginBottom: 12 }}
        />
      ))}

      {/* ── Function selector — icon chip + name + meta per segment ── */}
      {todayEvs.length>1&&(()=>{
        // One shared renderer so Combined and the per-function segments can never
        // drift apart in padding, divider or selected treatment.
        // Colour sweeps up from the bottom edge. Plain DOM rather than state:
        // this is pure feedback and should not re-render the dish list under it.
        const fillUp = (e) => {
          const el = e.currentTarget;
          const s = document.createElement("span");
          s.className = "kh-fillup";
          el.appendChild(s);
          s.addEventListener("animationend", () => s.remove());
        };
        const Seg = ({ segKey, sel, icon, title, meta, first }) => (
          <button key={segKey} className={"kh-btn kh-seg"+(sel?" is-active":"")}
            onClick={(e)=>{ fillUp(e); setEvFnFilter(segKey); }}
            style={{
              flex:"1 1 230px", minWidth:0, display:"flex", alignItems:"center", gap:14,
              padding:"16px 20px", border:"none", borderLeft:first?"none":`1px solid ${K.lineSoft}`,
              cursor:"pointer", textAlign:"left",
              background:sel?K.segSelBg:"transparent",
              boxShadow:sel?`inset 0 -3px 0 ${K.segSelBar}`:"none",
            }}>
            {/* z-index keeps the label above the fill sweep */}
            <span className="kh-seg-chip" style={{position:"relative",zIndex:1,width:44,height:44,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
              background:sel?K.segChipSelBg:K.segChipBg, color:sel?K.segSelBar:K.hdrMeta}}>
              <Icon name={icon} size={20} strokeWidth={1.8}/>
            </span>
            <span style={{position:"relative",zIndex:1,minWidth:0}}>
              <span style={{display:"block",fontSize:16,fontWeight:700,color:K.hdrTitle,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</span>
              <span style={{display:"block",fontSize:13,color:K.hdrMeta,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{meta}</span>
            </span>
          </button>
        );
        return (
          <div style={{display:"flex",flexWrap:"wrap",borderRadius:14,overflow:"hidden",border:`1px solid ${K.line}`,marginBottom:14,background:K.surface,boxShadow:K.shadowCard}}>
            <Seg segKey="combined" sel={isCombined} first icon="layers"
              title={T2("Combined")}
              meta={`${combinedPax} pax · ${todayEvs.length} ${T2("functions")}`} />
            {todayEvs.map(ev=>(
              <Seg key={ev.id} segKey={ev.id} sel={evFnFilter===ev.id} icon="users"
                title={ev.guest||T2("Function")}
                meta={[`${ev.pax} pax`, ev.venue, ev.time||"TBD"].filter(Boolean).join(" · ")} />
            ))}
          </div>
        );
      })()}

      {/* No per-function hint banner: it only restated the guest, pax, venue
          and time that the function selector directly above already shows. */}

      {/* ── Stats ── */}
      <div className="kh-stats" style={{ marginBottom: 16 }}>
        <KStat large={isTablet} icon="check"    toneName="ok"     value={readyDishes} label={T2("Ready")} />
        <KStat large={isTablet} icon="flame"    toneName="warn"   value={inProgressDishes} label={T2("Cooking")} />
        <KStat large={isTablet} icon="clock"    toneName="idle"   value={pendingDishes} label={T2("Pending")} />
        <KStat large={isTablet} icon="utensils" toneName="teal"   value={totalDishes} label={T2("Dishes")} />
        <KStat large={isTablet} icon="users"    toneName="info"   value={totalPax.toLocaleString()} label={T2("Pax")} />
      </div>

      {/* ── Kitchen Stations ── */}
      <KPanel
        icon="layers"
        title={T2("Kitchen Stations")}
        bodyPad={0}
        right={
          // The headline number for the whole screen — it was set smaller and
          // fainter than the row labels underneath it.
          // NOTE: this is a JS expression slot, so a JSX {/* */} comment here is
          // an object literal and breaks the parse.
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 250 }}>
            <span style={{ ...type.label, fontSize: 11, color: K.hdrMeta, whiteSpace: "nowrap" }}>{T2("Overall Progress")}</span>
            <div style={{ width: 150 }}>
              <KProgress pct={overallPct} toneName={overallPct === 100 ? "ok" : overallPct > 0 ? "warn" : "idle"} h={9} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: overallPct === 100 ? K.ok : K.hdrTitle, minWidth: 46,
              textAlign: "right", fontVariantNumeric: "tabular-nums", letterSpacing: -.3 }}>{overallPct}%</span>
          </div>
        }
      >
      {/* Column heads — grid template lives in .kh-strow (utils/theme.js) */}
      <div className="kh-strow" style={{ padding: "10px 18px 10px 21px", background: K.surfaceAlt, borderBottom: `1px solid ${K.lineSoft}` }}>
        <KColHead>#</KColHead>
        <KColHead>{T2("Kitchen Station")}</KColHead>
        <KColHead align="center" className="kh-col-dishes">{T2("Dishes")}</KColHead>
        <KColHead align="center" className="kh-col-ready">{T2("Ready")}</KColHead>
        {/* Named for what it measures. "Progress" was ambiguous next to a
            store-collection panel that has progress of its own. */}
        <KColHead className="kh-col-progress">{T2("Cooked")}</KColHead>
        <KColHead>{T2("Status")}</KColHead>
        <KColHead />
      </div>

      {secKeys.map((sec, secIdx) => {
        const items = [...(bySec[sec]||[])].sort((a,b)=>{const ab=findRecipeForDish(a.name)?.bg?1:0;const bb=findRecipeForDish(b.name)?.bg?1:0;return bb-ab;});
        const catObj = RECIPE_DB.cats.find(c => c.id === sec);
        const secDisplayName = catObj ? catObj.name : sec;
        const m = { color: catObj?.color || C.muted, icon: catObj?.icon || "🍽" };
        const displayIcon = catObj?.icon || "🍽";
        const secReady = items.filter(d => ds(d.fEvId, d.fIdx, d.name).ready).length;
        // NOTE: this bar tracks DISHES COOKED, not ingredients collected. They
        // are separate stages — you can have every ingredient on the bench and
        // still be at 0% cooked. secStorePct below is the collection stage, and
        // the row now shows it too, because a full "All collected" card sitting
        // under a 0% bar reads like the bar is broken.
        const secPct = Math.round(secReady / items.length * 100);
        const _ssRow = ssRead(sec);
        const _ssAgg = aggSecIngredients(items);
        const _ssDoneMap = _ssRow.items_done || {};
        const secStoreTotal = _ssAgg.items.length;
        const secStoreDoneN = _ssAgg.items.filter(i => _ssDoneMap[storeItemKey(i)]).length;
        const secStoreAll = secStoreTotal > 0 && secStoreDoneN === secStoreTotal;
        const secOpen = isSecOpen(sec);
        const secAllDone = secReady === items.length;
        const secSpecials = [...new Map(items.flatMap(d => d.specials || []).map(sp => [sp.guest + "|" + sp.instruction, sp])).values()];
        const secTone = secAllDone ? "ok" : secReady > 0 ? "warn" : "idle";
        const secStatusLabel = secAllDone ? T2("Complete") : secReady > 0 ? T2("In Progress") : T2("Pending");
        const isLastSec = secIdx === secKeys.length - 1;

        return (
          <div key={sec} style={{ borderBottom: (isLastSec && !secOpen) ? "none" : `1px solid ${K.lineSoft}` }}>
            {/* Station row */}
            <div className="kh-row kh-strow kh-rip" onPointerDown={ripple} onClick={() => toggleSec(sec)} style={{
              padding: isTablet ? "16px 18px 16px 15px" : "13px 18px 13px 15px",
              borderLeft: `3px solid ${secAllDone ? K.ok : secReady > 0 ? K.warn : "transparent"}`,
              background: secOpen ? K.surfaceAlt : K.surface,
              cursor: "pointer",
            }}>
              <div style={{ fontSize: 15, color: K.hdrMeta, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{secIdx + 1}</div>

              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <span style={{ width: isTablet ? 38 : 32, height: isTablet ? 38 : 32, borderRadius: K.rSm, background: (catObj?.color || K.accent) + "16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isTablet ? 19 : 16, flexShrink: 0 }}>{displayIcon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ fontSize: isTablet ? 16 : 13.5, fontWeight: 600, color: K.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{T2(secDisplayName)}</span>
                    {secSpecials.length > 0 && <KPill toneName="danger" size="sm">🚫 {secSpecials.length}</KPill>}
                  </div>
                  {/* Two stages, stated separately. "0 ready of 4" alone made
                      the 0% bar look wrong once the store lot was collected. */}
                  <div style={{ fontSize: isTablet ? 12.5 : 11.5, color: K.textMuted, marginTop: 2, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span>{secReady} {T2("of")} {items.length} {T2("dishes cooked")}</span>
                    {secStoreTotal > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: secStoreAll ? K.ok : K.textFaint }}>
                        <span style={{ color: K.textFaint }}>·</span>
                        <Icon name={secStoreAll ? "check" : "store"} size={12} strokeWidth={2}/>
                        {secStoreAll ? T2("store collected") : `${secStoreDoneN}/${secStoreTotal} ${T2("collected")}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="kh-col-dishes" style={{ fontSize: 13.5, fontWeight: 600, color: K.textBody, textAlign: "center" }}>{items.length}</div>
              <div className="kh-col-ready" style={{ fontSize: 13.5, fontWeight: 600, color: secReady > 0 ? K.ok : K.textFaint, textAlign: "center" }}>{secReady}</div>

              <div className="kh-col-progress" style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <div style={{ flex: 1, minWidth: 40 }}><KProgress pct={secPct} toneName={secTone} h={6} /></div>
                <span style={{ fontSize: 12, fontWeight: 600, color: K.textMuted, minWidth: 32, textAlign: "right" }}>{secPct}%</span>
              </div>

              <div><KPill toneName={secTone}>{secStatusLabel}</KPill></div>

              <div style={{ color: K.textFaint, display: "flex", justifyContent: "flex-end", transform: secOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>
                <Icon name="chevronR" size={16} />
              </div>
            </div>

            {/* Special alerts */}
            {secOpen && secSpecials.length > 0 && (
              <div style={{ padding: "10px 18px", background: K.dangerBg, borderTop: `1px solid ${K.lineSoft}` }}>
                {secSpecials.map((sp, si) => (
                  <div key={si} style={{ fontSize: 12, color: K.danger, padding: "4px 0", borderBottom: si < secSpecials.length - 1 ? `1px solid ${K.dangerBorder}` : "none" }}>
                    🚫 <b>{sp.pax} {T2("pax")}</b> — {sp.guest}: {sp.instruction}
                  </div>
                ))}
              </div>
            )}

            {/* Section-level Collect from store + aggregated ingredients */}
            {secOpen && (() => {
              const secStore2 = ssRead(sec);
              const ssStarted = !!secStore2.start; const ssDone = !!secStore2.end;
              const ssEl = ssStarted && !ssDone ? Math.floor((Date.now() - secStore2.start) / 1000) : 0;
              const ssOverdue = ssStarted && !ssDone && ssEl >= 1800;
              const agg = aggSecIngredients(items);
              const yieldLbl = agg.totalKg > 0 ? `${T2("target")} ${agg.totalKg.toFixed(1).replace(/\.0$/,"")} kg` : `${items.length} ${T2("dishes")}`;
              return (
                <div style={{ background: K.surfaceAlt, borderTop: `1px solid ${K.lineSoft}`, padding: "14px 18px 6px" }}>
                  <div style={{ padding: 14, borderRadius: K.rLg, border: `1px solid ${ssDone?K.okBorder:ssStarted?K.warnBorder:K.line}`, background: K.surface, boxShadow: K.shadowCard, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 13, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ width: 42, height: 42, borderRadius: K.rMd, background: ssDone?K.okBg:ssStarted?K.warnBg:K.accentSoft, color: ssDone?K.ok:ssStarted?K.warn:K.accent, border: `1px solid ${ssDone?K.okBorder:ssStarted?K.warnBorder:K.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon name={ssDone?"check":"store"} size={20} strokeWidth={ssDone?2.4:1.9}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: isTablet?16:14.5, fontWeight: 700, color: K.hdrTitle }}>{T2("Collect from store")} — {T2(m.color ? (RECIPE_DB.cats.find(c=>c.id===sec)?.name || sec) : sec)}</div>
                        <div style={{ fontSize: isTablet?13:12, color: K.hdrMeta, marginTop: 3, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <span>{T2("One lot for all")} {items.length} {T2("dishes")}</span>
                          <span style={{ color: K.textFaint }}>·</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={12} strokeWidth={2}/>30m</span>
                        </div>
                      </div>
                      {/* Only once the WHOLE station is cooked. Two earlier
                          gates were wrong: `secStoreAll` fired when the store
                          lot was ticked off, which offered to load raw material
                          onto the van (collecting is the stage before cooking),
                          and `secReady > 0` fired on the first ready dish, which
                          invited half-empty loads. A station travels as one lot. */}
                      {secAllDone && (
                        <KButton variant="brand" icon="truck" onClick={() => {
                          // The station's DISHES, not its raw ingredients — what
                          // goes on the van is cooked food. Grouped BY FUNCTION:
                          // a transport row carries a guest, venue and pax, so
                          // sending a Combined batch as one nameless lot lost the
                          // very thing the driver needs to know.
                          const fnList = [];
                          const byFn = new Map();
                          const dishes = [];
                          const seed = {};
                          const round1 = v => Math.round(v * 10) / 10;

                          items.forEach(dd => {
                            const st = ds(dd.fEvId, dd.fIdx, dd.name);
                            const fns = (dd.fns && dd.fns.length)
                              ? (isCombined ? dd.fns : dd.fns.filter(f => f.evId === activeEv?.id))
                              : [{ evId: dd.fEvId, g: activeEv?.guest, v: activeEv?.venue, p: dd.totalPax }];
                            if (!fns.length) return;

                            fns.forEach(f => {
                              if (byFn.has(f.evId)) return;
                              const evo = todayEvs.find(e => e.id === f.evId);
                              const g = { evId: f.evId, guest: f.g || evo?.guest || T2("Function"),
                                venue: f.v || evo?.venue || "", pax: +f.p || evo?.pax || 0,
                                date: evo?.date || TODAY };
                              byFn.set(f.evId, g); fnList.push(g);
                            });

                            const unit = st.madeUnit || "kg";
                            const paxSum = fns.reduce((s, f) => s + (+f.p || 0), 0);
                            const rec = findRecipeForDish(dd.name);
                            const baseKg = rec?.ingredients?.base_yield?.kg;
                            const basePax = rec?.ingredients?.base_pax || 300;

                            const cells = {};
                            fns.forEach(f => {
                              const pax = +f.p || 0;
                              let suggested = null;
                              // A measured yield is the whole batch. Split it by
                              // pax as a starting point — the chef then adjusts
                              // per function, which is the whole point of this
                              // grid. With no measured figure, fall back to the
                              // recipe's per-function estimate.
                              if (st.madeQty && paxSum > 0) suggested = round1(st.madeQty * pax / paxSum);
                              else if (st.madeQty && fns.length === 1) suggested = st.madeQty;
                              else if (baseKg && pax > 0) suggested = round1(baseKg * pax / basePax);
                              cells[f.evId] = { pax, suggested, est: !st.madeQty };
                              if (st.ready && suggested != null) seed[`${f.evId}|${dd.name}`] = String(suggested);
                            });
                            // What was cooked in total — the number the chef is
                            // dividing up. Measured where it exists, otherwise
                            // the recipe's estimate for the combined pax.
                            let made = null, madeEst = false;
                            if (st.madeQty) made = st.madeQty;
                            else if (dd.totalKg > 0) made = round1(dd.totalKg);
                            else if (baseKg && paxSum > 0) { made = round1(baseKg * paxSum / basePax); madeEst = true; }
                            dishes.push({ n: dd.name, ready: !!st.ready, unit, cells, made, madeEst, shared: fns.length > 1 });
                          });

                          setTransportQty(seed);
                          setTransportPick({
                            sec,
                            label: T2(m.color ? (RECIPE_DB.cats.find(c=>c.id===sec)?.name || sec) : sec),
                            fns: fnList, dishes,
                          });
                        }} style={{ padding: "12px 20px", borderRadius: 14 }}>
                          {T2("Send to transport")}
                        </KButton>
                      )}
                      {!ssStarted && !ssDone && <KButton variant="accent" onClick={() => ssWrite(sec, { start: Date.now() })} style={{ padding: "12px 20px", minHeight: 44 }}>▶ {T2("Go Collect")}</KButton>}
                      {/* Done closes the run AND ticks every row. Before this it
                          only stamped `end`, so a finished collection could sit
                          at "0 of 26 collected — 0%", which then made the dish
                          progress below it look stalled too. */}
                      {ssStarted && !ssDone && <KButton variant="accent" icon="check" onClick={() => ssWrite(sec, { end: Date.now(), items_done: markAllCollected(agg.items) })} style={{ padding: "12px 20px", minHeight: 44, background: K.ok, boxShadow: "0 4px 14px rgba(18,154,108,.3)" }}>{T2("Done")}</KButton>}
                    </div>
                    {ssStarted && !ssDone && (
                      <div style={{ marginTop: 10 }}>
                        <KProgress pct={Math.min(100, Math.round(ssEl/1800*100))} toneName={ssOverdue?"danger":"warn"} h={6}/>
                        <div style={{ fontSize: 11.5, color: ssOverdue?K.danger:K.warn, fontWeight: 700, marginTop: 5 }}>⏱ {Math.floor(ssEl/60)}m {ssEl%60}s / 30m{ssOverdue?` — ${T2("Overdue")}`:""}</div>
                      </div>
                    )}
                    {agg.items.length > 0 && (() => {
                      const itemsDone = secStore2.items_done || {};
                      // Key by (name, family) so kg↔gm flips don't lose collected
                      // state. Shared with Prep Day and with markAllCollected —
                      // two copies of this rule would mean ticks that disagree.
                      const itemKey = storeItemKey;
                      const collected = agg.items.filter(i => itemsDone[itemKey(i)]).length;
                      const total = agg.items.length;
                      const pct = total > 0 ? Math.round(collected / total * 100) : 0;
                      const catKey = (cat) => sec + "|" + cat;
                      // Ticking the last item of an aisle folds it away, so the next
                      // aisle is what you see. `catItems` is that aisle's full list.
                      // Send only the keys that actually changed. Rebuilding the
                      // whole map from a render-time snapshot is what let one
                      // tick overwrite another.
                      const toggle = (i, cat, catItems) => {
                        const k = itemKey(i);
                        const cur = ssRead(sec).items_done || {};
                        const nowDone = !cur[k];
                        ssWrite(sec, { items_done: { [k]: nowDone } });
                        if (cat && catItems && catItems.every(it => (itemKey(it) === k ? nowDone : cur[itemKey(it)]))) {
                          setSecCatOpen(p => ({ ...p, [catKey(cat)]: false }));
                        }
                      };
                      const markAll = (cat, catItems, value) => {
                        const delta = {};
                        catItems.forEach(it => { delta[itemKey(it)] = value; });
                        ssWrite(sec, { items_done: delta });
                        setSecCatOpen(p => ({ ...p, [catKey(cat)]: !value }));
                      };
                      // V74 — collapsible + searchable + categorized
                      const listOpen = !!secIngrOpen[sec];
                      const searchQ  = (secSearch[sec] || '').toLowerCase().trim();
                      const sortMode = secSort[sec] || 'qty';
                      const filtered = searchQ ? agg.items.filter(i => (i.n || '').toLowerCase().includes(searchQ)) : agg.items;
                      const byCat = {};
                      filtered.forEach(i => { const c = categorizeIngredient(i.n); (byCat[c] = byCat[c] || []).push(i); });
                      Object.keys(byCat).forEach(c => {
                        byCat[c].sort((a, b) => sortMode === 'qty' ? (b._base || 0) - (a._base || 0) : (a.n || '').localeCompare(b.n || ''));
                      });
                      const orderedCats = INGR_CATEGORY_ORDER.filter(c => byCat[c] && byCat[c].length > 0);
                      return (
                        <div style={{ marginTop: 12 }}>
                          {/* Progress strip — click to expand the ingredient list */}
                          {/* Done is its own state, not a full-width green bar.
                              A bar pinned at 100% across a whole screen says
                              nothing that the word "collected" doesn't say
                              better, and the track is capped so it never
                              stretches into a metre of colour. */}
                          <div className="kh-listrow kh-rip" onPointerDown={ripple} onClick={() => setSecIngrOpen(p => ({ ...p, [sec]: !listOpen }))}
                               style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 13, padding: pct === 100 ? "12px 16px 12px 19px" : "12px 16px",
                                 background: pct === 100 ? `linear-gradient(100deg, ${K.brandBg} 0%, rgba(231,241,234,.4) 44%, ${K.surface} 78%)` : K.surfaceAlt,
                                 border: `1px solid ${pct === 100 ? K.brandBorder : K.line}`, borderRadius: K.rMd, cursor: "pointer" }}>
                            {pct === 100 && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: K.brand }}/>}
                            <span style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                              background: pct === 100 ? K.brand : K.surface, color: pct === 100 ? "#fff" : K.accent, border: `1px solid ${pct === 100 ? K.brand : K.line}` }}>
                              <Icon name={pct === 100 ? "check" : "store"} size={15} strokeWidth={pct === 100 ? 2.6 : 2}/>
                            </span>
                            <div style={{ fontSize: isTablet?14:13, fontWeight: 700, color: pct === 100 ? K.brand : K.hdrTitle, whiteSpace: "nowrap", flexShrink: 0 }}>
                              {pct === 100
                                ? <>{T2("All collected")} <span style={{ color: K.textMuted, fontWeight: 500 }}>· {total}</span></>
                                : <>{collected} {T2("of")} {total} {T2("collected")}</>}
                            </div>
                            {pct < 100 && (
                              <>
                                <div style={{ flex: 1, minWidth: 60, maxWidth: 320 }}>
                                  <KProgress pct={pct} toneName={pct > 0 ? "warn" : "idle"} h={8}/>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: K.hdrMeta, minWidth: 38, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
                              </>
                            )}
                            <div style={{ flex: 1, minWidth: 8 }}/>
                            <div style={{ ...type.label, fontSize: 10.5, color: K.textMuted, whiteSpace: "nowrap", flexShrink: 0 }}>{yieldLbl}</div>
                            <span style={{ color: K.textFaint, flexShrink: 0, display: "flex", transition: "transform .2s", transform: listOpen ? "rotate(180deg)" : "rotate(0deg)" }}><Icon name="chevronD" size={16}/></span>
                          </div>
                          {listOpen && (
                            <div style={{ marginTop: 12 }}>
                              {/* Search + sort + hide-collected */}
                              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                                <div className="ash-search" style={{ flex: "0 1 300px", minWidth: 200, display: "flex", alignItems: "center", gap: 9, padding: "0 13px", height: 40, borderRadius: K.rMd, background: K.surface, border: `1px solid ${K.line}` }}>
                                  <Icon name="search" size={15} color={K.textFaint}/>
                                  <input placeholder={T2("Search ingredient…")} value={secSearch[sec] || ''}
                                         onChange={e => setSecSearch(p => ({ ...p, [sec]: e.target.value }))}
                                         style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13, color: K.text, padding: 0 }} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 11px", height: 40, borderRadius: K.rMd, background: K.surface, border: `1px solid ${K.line}`, flexShrink: 0 }}>
                                  <span style={{ color: K.textFaint, display: "flex", flexShrink: 0 }}><Icon name="listCheck" size={14} strokeWidth={2}/></span>
                                  <select value={sortMode} onChange={e => setSecSort(p => ({ ...p, [sec]: e.target.value }))}
                                          style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: K.text, cursor: "pointer", fontWeight: 500, fontFamily: K.fontBody }}>
                                    <option value="qty">{T2("Qty (high → low)")}</option>
                                    <option value="name">{T2("Name (A → Z)")}</option>
                                  </select>
                                </div>
                              </div>

                              {/* Category cards — each collapses on its own, so one huge aisle
                                  can't stretch the grid. Order is store-walking order. */}
                              {orderedCats.length === 0 ? (
                                <div style={{ textAlign: "center", padding: 24, color: K.textMuted, fontSize: 13 }}>{T2("No matches")}</div>
                              ) : (() => {
                                // Default open card = the first aisle still incomplete.
                                const firstIncomplete = orderedCats.find(c => !byCat[c].every(it => itemsDone[itemKey(it)]));
                                // Cards are equal height per row, so a collapsed small aisle just
                                // leaves a hollow box. Anything that fits comfortably opens by
                                // default; only genuinely long aisles start folded so they can't
                                // blow up the row height.
                                const SMALL_AISLE = 10;
                                return (
                                  <div className="kh-catgrid">
                                    {orderedCats.map(cat => {
                                      const cm = catMeta(cat);
                                      const ct = tone(cm.toneName);
                                      const catItems = byCat[cat];
                                      const catDone  = catItems.filter(it => itemsDone[itemKey(it)]).length;
                                      const catTotal = catItems.length;
                                      const allDone  = catDone === catTotal;
                                      const catPct   = catTotal > 0 ? Math.round(catDone / catTotal * 100) : 0;
                                      const explicit = secCatOpen[catKey(cat)];
                                      const open     = explicit !== undefined
                                        ? explicit
                                        : (catItems.length <= SMALL_AISLE || cat === firstIncomplete);
                                      const rows     = catItems;
                                      return (
                                        <div key={cat} className="kh-catcard" style={{ border: `1px solid ${allDone ? K.okBorder : K.line}`, borderRadius: K.rMd, overflow: "hidden", background: K.surface }}>
                                          {/* Card header — two rows so it fits a ~360px card
                                              instead of spilling into a ragged wrap. */}
                                          <div className="kh-listrow kh-rip" onPointerDown={ripple} onClick={() => setSecCatOpen(p => ({ ...p, [catKey(cat)]: !open }))}
                                               style={{ padding: "11px 14px", background: allDone ? K.okBg : ct.bg, cursor: "pointer" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                              <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                                background: allDone ? K.ok : K.surface, color: allDone ? "#fff" : ct.fg, border: `1px solid ${allDone ? K.ok : K.line}` }}>
                                                <Icon name={allDone ? "check" : "box"} size={13} strokeWidth={allDone ? 2.6 : 1.9}/>
                                              </span>
                                              <span style={{ fontSize: isTablet?15:14, fontWeight: 700, color: allDone ? K.ok : ct.fg, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{T2(cat)}</span>
                                              <span style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, background: K.surface, border: `1px solid ${K.line}`, borderRadius: K.rPill, padding: "3px 9px", flexShrink: 0 }}>
                                                {catTotal} {catTotal === 1 ? T2("item") : T2("items")}
                                              </span>
                                              <span style={{ marginLeft: "auto", color: K.textFaint, flexShrink: 0, display: "flex", transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}><Icon name="chevronD" size={16}/></span>
                                            </div>
                                            {/* A finished aisle drops the bar. Six cards each showing a
                                                full green track say the same thing six times; the word
                                                "Collected" says it once and leaves the card calm. */}
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
                                              {allDone ? (
                                                <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: K.ok }}>
                                                  <Icon name="check" size={13} strokeWidth={2.4}/>{T2("Collected")} · {catTotal}
                                                </span>
                                              ) : (
                                                <>
                                                  <div style={{ flex: 1, minWidth: 40 }}>
                                                    <KProgress pct={catPct} toneName={catDone > 0 ? "warn" : "idle"} h={6}/>
                                                  </div>
                                                  <span style={{ fontSize: 12, fontWeight: 700, color: K.hdrMeta, whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{catDone}/{catTotal}</span>
                                                </>
                                              )}
                                              <button type="button" className="kh-ingcheck"
                                                      onClick={e => { e.stopPropagation(); markAll(cat, catItems, !allDone); }}
                                                      title={allDone ? T2("Unmark all in this aisle") : T2("Mark all in this aisle")}
                                                      style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: allDone ? K.textMuted : ct.fg, background: K.surface, border: `1px solid ${K.line}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>
                                                {allDone ? T2("Unmark all") : T2("Mark all")}
                                              </button>
                                            </div>
                                          </div>

                                          {/* Aisle rows — .kh-catbody absorbs the height difference
                                              between cards in a row and scrolls if very long. */}
                                          {open && <div className="kh-catbody">
                                          {rows.length === 0 ? (
                                            <div style={{ padding: "14px", textAlign: "center", fontSize: 12.5, color: K.textMuted, borderTop: `1px solid ${K.lineSoft}` }}>
                                              {T2("All collected in this aisle")}
                                            </div>
                                          ) : rows.map((i, ii) => {
                                            const done = !!itemsDone[itemKey(i)];
                                            // fmtQty normalises units (0.5 kg → "500 g"), so read the unit
                                            // back off the formatted string — showing raw i.u here would
                                            // print "500 g" next to "kg".
                                            const qtyStr = fmtQty(i);
                                            const qtyUnit = qtyStr.split(" ").slice(-1)[0] || "";
                                            return (
                                              // Row itself is NOT clickable — only the checkbox control at the
                                              // end toggles collected, so selecting text on a row is safe.
                                              <div key={ii} className="kh-ingrow"
                                                   style={{
                                                     padding: "10px 14px",
                                                     borderTop: `1px solid ${K.lineSoft}`,
                                                     background: done ? K.okBg : K.surface,
                                                   }}>
                                                <span style={{ fontSize: 16, textAlign: "center" }}>{ingredientEmoji(i.n, cat)}</span>
                                                {/* Names wrap rather than truncate — a chef needs to read the
                                                    whole ingredient, not "Fanta Coca…". */}
                                                <span style={{ fontSize: isTablet?14:13.5, color: done ? K.ok : K.textBody, textDecoration: done ? "line-through" : "none", lineHeight: 1.4, wordBreak: "break-word", overflowWrap: "anywhere" }}>{i.n}</span>
                                                <span style={{ fontSize: isTablet?14.5:13.5, fontWeight: 700, color: done ? K.ok : K.text, whiteSpace: "nowrap" }}>{qtyStr}</span>
                                                <span className="kh-ing-unit" style={{ fontSize: 12, color: K.textFaint, whiteSpace: "nowrap" }}>{qtyUnit}</span>
                                                <button type="button" className="kh-ingcheck" onClick={() => toggle(i, cat, catItems)}
                                                        role="checkbox" aria-checked={done}
                                                        aria-label={`${i.n} — ${qtyStr}`}
                                                        title={done ? T2("Collected") : T2("Mark collected")}
                                                        style={{ display: "flex", alignItems: "center", gap: 8, justifySelf: "end", whiteSpace: "nowrap", cursor: "pointer", background: "transparent", border: `1px solid transparent`, borderRadius: 8, padding: "5px 8px", margin: "-5px -8px -5px 0" }}>
                                                  <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${done ? K.ok : K.lineStrong}`, background: done ? K.ok : K.surface, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                                                    {done && <Icon name="check" size={12} strokeWidth={2.6}/>}
                                                  </span>
                                                  <span className="kh-ing-marklabel" style={{ fontSize: 12.5, color: done ? K.ok : K.textMuted, fontWeight: done ? 600 : 500 }}>{done ? T2("Collected") : T2("Mark collected")}</span>
                                                </button>
                                              </div>
                                            );
                                          })}
                                          </div>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

            {/* Dish rows */}
            {secOpen && (
              // Two elements on purpose: the outer one is the query container,
              // the inner one is the grid. A container cannot query its own
              // width, so the grid has to sit inside the thing being measured.
              <div className="kh-dishwrap" style={{ background: K.surfaceAlt, borderTop: `1px solid ${K.lineSoft}`, padding: "10px 14px 14px" }}>
               <div className="kh-dishgrid">
                {items.map((dish, di) => {
                  const dKey = isCombined ? ck(dish.name) : dk(dish.fEvId, dish.fIdx);
                  const d = ds(dish.fEvId, dish.fIdx, dish.name);
                  const isReady = !!d.ready;
                  const steps = getFullSteps(dish.name);
                  const nonStore = steps.filter(s => !s.store).map((s, i) => ({ step: s, origIdx: i }));
                  // Store is now section-level; individual dish store flags are legacy/vestigial
                  const secStore = ssRead(sec);
                  const secStoreStarted = !!secStore.start;
                  // Ticking every ingredient IS collecting — it should not also
                  // need the "Go Collect" timer to be stopped. That gate meant a
                  // chef could finish every item and every step and still be
                  // given no way to sign the dish off, with nothing on screen
                  // explaining why. A station with no ingredient list at all
                  // never blocks either.
                  const secStoreDone = !!secStore.end || secStoreAll || secStoreTotal === 0;
                  const doneCount = nonStore.filter(x => stepDone(d, x.origIdx, x.step)).length;
                  const totalSteps = nonStore.length;
                  const runIdx = nonStore.findIndex(x => d.starts?.[x.origIdx] && !stepDone(d, x.origIdx, x.step));
                  const anyRunning = runIdx >= 0;

                  // Timer for dish row
                  let timerDisplay = null;
                  if (!isReady && runIdx >= 0) {
                    const el = elapsed(d, nonStore[runIdx].origIdx);
                    const tm = d.stepTm?.[nonStore[runIdx].origIdx] || nonStore[runIdx].step.tm || 0;
                    if (tm > 0) timerDisplay = <span style={{ fontSize: 12, fontWeight: 700, color: el >= tm ? C.red : C.amber }}>{fmtTimer(tm - el)}</span>;
                  }

                  // strict: a real photo only where the dish is actually mapped.
                  // Guessed images put the same generic picture on every papad,
                  // yogurt and raita, which is worse than no photo.
                  const dishImg = getDishImageUrl(dish.name, true);
                  const dishEmoji = (RECIPE_DB.cats.find(c => c.id === dish.catId)?.icon) || "🍽";
                  return (
                    // Each dish is its own card so a long list reads as separate
                    // items rather than one undifferentiated wall of rows.
                    // An open dish spans the whole row: the step list, timers and
                    // sub-steps need the full width, and squeezing them into a
                    // third of it is what made the old layout unusable.
                    // A ready dish keeps a WHITE body and states itself with a
                    // solid green rail plus a tint that fades out. Flooding the
                    // whole card with pale mint washed the text out and made a
                    // column of finished dishes read as one flat slab.
                    <div key={di} className={"kh-dishcard kh-cardart-sm" + (isDishOpen(dKey) ? " is-open" : "")} style={{
                      position: "relative",
                      backgroundColor: K.surface, borderRadius: K.rLg,
                      border: `1px solid ${isReady ? K.brandBorder : K.line}`,
                      boxShadow: isReady ? "0 1px 3px rgba(28,61,43,.10), 0 8px 22px rgba(28,61,43,.10)" : K.shadowCard,
                      overflow: "hidden",
                      display: "flex", flexDirection: "column",
                    }}>
                      {isReady && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: K.brand, zIndex: 2 }}/>}
                      {/* Dish header */}
                      {/* Two stacked rows rather than one long one. At a third of
                          the panel width the old single row could not fit name,
                          both pills and the chevron, and the name was the part
                          that got squeezed. */}
                      <div className="kh-listrow kh-rip" onPointerDown={ripple} onClick={() => toggleDish(dKey)} style={{
                        display: "flex", flexDirection: "column", gap: 10, padding: "13px 15px 13px 18px",
                        cursor: "pointer",
                        background: isReady ? `linear-gradient(100deg, ${K.brandBg} 0%, rgba(231,241,234,.45) 46%, ${K.surface} 82%)` : "transparent",
                      }}>
                        {/* No checkbox here. It looked like a control but was
                            display-only — ready state is already carried by the
                            green card, the green title and the Ready pill. */}
                        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                          {/* Photo where the dish map has one, otherwise its category emoji */}
                          <div style={{
                            width: isTablet?64:56, height: isTablet?64:56, borderRadius: 13, flexShrink: 0,
                            overflow: "hidden", background: K.segChipBg, border: `1px solid ${K.line}`,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: isTablet?27:24,
                          }}>
                            {dishImg
                              ? <img src={dishImg} alt="" aria-hidden="true" loading="lazy"
                                  onError={e=>{ e.currentTarget.style.display="none"; }}
                                  style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                              : dishEmoji}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Wraps to a second line instead of being clipped — a
                                narrow card cannot hold "Mixed Vegetable Raita" on one. */}
                            <div style={{ fontSize: isTablet?17:15.5, fontWeight: 700, lineHeight: 1.25, color: isReady ? K.brand : K.hdrTitle, overflowWrap: "anywhere" }}>{dishLabel(dish.name, lang)}{dish.isBaseGravy && <span style={{marginLeft:6,padding:"1px 6px",borderRadius:5,background:C.goldBg,border:`1px solid ${C.goldBorder}`,fontSize:isTablet?11:9,color:C.gold,fontWeight:700}}>🥘 Base</span>}{isCombined && dish.fns.some(fn => { const tv=(fn.v||"").toLowerCase().trim(); const uv=(currentUser?.venue||"").toLowerCase().trim(); return uv && tv && !tv.includes(uv) && !uv.includes(tv); }) && <span style={{fontSize:10,color:C.amber,marginLeft:4}}>🚛</span>}</div>
                            <div style={{ fontSize: isTablet?13:12.5, color: K.textMuted, marginTop: 3 }}>
                              {dish.totalPax} {T2("pax")} · {doneCount}/{totalSteps} {T2("steps")}
                              {d.mesaDone && <span style={{ color: K.ok, fontWeight: 600 }}> · D-1 {String.fromCharCode(10003)}</span>}
                            </div>
                          </div>
                          <span style={{ color: K.textFaint, display: "flex", flexShrink: 0, alignSelf: "flex-start", marginTop: 4, transition: "transform .2s", transform: isDishOpen(dKey) ? "rotate(90deg)" : "none" }}><Icon name="chevronR" size={15}/></span>
                        </div>
                        {/* Status strip. D-1 state on the left, cook state on the
                            right — both readable without opening the dish. */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <KPill toneName={d.mesaDone ? "ok" : "warn"} icon={d.mesaDone ? "check" : "clock"} size="sm">
                            {d.mesaDone ? `D-1 ${T2("prep done")}` : T2("No D-1 prep")}
                          </KPill>
                          {/* Ready is a SOLID pill. As an outline chip it carried
                              no more weight than "Pending" and the finished state
                              disappeared into the row. */}
                          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
                            {timerDisplay || (isReady
                              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: K.rPill,
                                  background: K.brand, color: "#fff", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                                  <Icon name="check" size={12} strokeWidth={2.6}/>{T2("Ready")}
                                </span>
                              : <KPill toneName={anyRunning ? "warn" : "idle"} size="sm">{anyRunning ? T2("Cooking") : T2("Pending")}</KPill>)}
                          </span>
                        </div>
                      </div>

                      {/* Expanded view */}
                      {isDishOpen(dKey) && (
                        // Blocks sit inside the dish card with its own padding — no
                        // indent rail needed now that each dish is visually separate.
                        <div style={{ padding: "0 16px 16px" }}>

                          {/* Per-dish ingredient list — READ-ONLY reference (section-level collect now gates the flow) */}
                          {(() => {
                            let ing = null, effKg = null, warn = null, planned = false;
                            // 9C — bg pseudo-dishes: totalKg is authoritative
                            if (dish.isBaseGravy && dish.totalKg > 0) {
                              effKg = dish.totalKg;
                              ing = getIngrForYield(dish.name, dish.totalKg);
                              planned = true;
                              if (!ing || ing.length === 0) return null;
                              const yieldLbl = `${T2("target")} ${effKg.toFixed(1).replace(/\.0$/,"")} kg`;
                              return (
                                <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", marginBottom: 8, border: `1px solid ${C.goldBorder}`, opacity: 0.85 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 5 }}>
                                    🥘 {T2("Base gravy — summed demand")} — {yieldLbl}
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px" }}>
                                    {ing.filter(i => i.q > 0).map((i, ii) => (
                                      <span key={ii} style={{ fontSize: 11, color: C.text }}>{i.n} <span style={{ color: C.muted }}>{fmtQty(i)}</span></span>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            const evObj = todayEvs.find(e => e.id === dish.fEvId);
                            if (!evObj) return null;
                            const pax = +evObj.pax || 0;
                            const rec = findRecipeForDish(dish.name);
                            const baseKg = rec?.ingredients?.base_yield?.kg || null;
                            const basePax = rec?.ingredients?.base_pax || 300;
                            const mult = Number(evObj.yield_multiplier) || 1.0;

                            if (baseKg) {
                              const plannedKg = Number(evPlanRows?.[evObj.id]?.[dish.name]?.target_yield_kg) || null;
                              const defaultYield = pax > 0 ? (baseKg * pax / basePax) : baseKg;
                              // Pin (plannedKg) is authoritative — slider only scales the auto-computed default
                              effKg = plannedKg ? plannedKg : defaultYield * mult;
                              ing = getIngrForYield(dish.name, effKg);
                              planned = !!plannedKg;
                            }
                            if (!ing || ing.length === 0) {
                              const adjPax = Math.round(pax * mult);
                              ing = getIngrForDish(dish.name, adjPax || pax);
                              if (!baseKg) warn = 'no_base_yield';
                              effKg = null;
                            }
                            if (!ing || ing.length === 0) return null;

                            const yieldLbl = effKg ? `${T2("target")} ${effKg.toFixed(1).replace(/\.0$/,"")} kg` : `${pax} pax`;
                            return (
                              // backgroundColor, not the background shorthand:
                              // the shorthand resets background-image and would
                              // erase the .kh-cardart artwork.
                              <div className="kh-cardart" style={{ backgroundColor: K.surfaceAlt, borderRadius: K.rLg, padding: "14px 16px", marginBottom: 12, border: `1px solid ${warn?K.dangerBorder:K.line}`, position: "relative", overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                                  <span style={{ display: "flex", color: K.hdrTitle, flexShrink: 0 }}><Icon name="listCheck" size={15} strokeWidth={2}/></span>
                                  <span style={{ ...type.label, color: K.hdrTitle, fontWeight: 700 }}>{T2("Ingredients for this dish")}</span>
                                  <span style={{ width: 1, height: 16, background: K.line }}/>
                                  <KPill toneName="idle" size="sm">{yieldLbl}</KPill>
                                  {planned ? <KPill toneName="accent" size="sm">{T2("planned")}</KPill> : effKg ? <KPill toneName="idle" size="sm">{T2("auto")}</KPill> : null}
                                  {warn === 'no_base_yield' && <KPill toneName="danger" size="sm" icon="alert">{T2("Missing base_yield in SOP")}</KPill>}
                                </div>
                                {/* Chips grouped by the recipe's own sections. A
                                    golgappa has five sub-preparations, each with
                                    its own water, salt and masala — flattened into
                                    one list those read as duplicated rows, which
                                    is exactly what this list used to look like. */}
                                {(() => {
                                  const groups = [];
                                  let cur = { name: null, items: [] };
                                  ing.forEach(i => {
                                    if (i._isSection) {
                                      if (cur.items.length) groups.push(cur);
                                      cur = { name: i.n, items: [] };
                                    } else if (i.q > 0) {
                                      cur.items.push(i);
                                    }
                                  });
                                  if (cur.items.length) groups.push(cur);
                                  if (!groups.length) return null;

                                  const chip = (i, ii) => (
                                    <span key={ii} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: K.hdrMetaStrong, background: K.surface, border: `1px solid ${K.line}`, borderRadius: K.rPill, padding: "7px 14px" }}>
                                      {i.n}<b style={{ color: K.segSelBar, fontVariantNumeric: "tabular-nums" }}>{fmtQty(i)}</b>
                                    </span>
                                  );

                                  // An unsectioned recipe keeps the plain chip wall —
                                  // a lone heading over one group is just noise.
                                  if (groups.length === 1 && !groups[0].name) {
                                    return <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{groups[0].items.map(chip)}</div>;
                                  }
                                  return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                      {groups.map((g, gi) => (
                                        <div key={gi}>
                                          {g.name && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                                              <span style={{ ...type.label, fontSize: 11, color: K.hdrTitle }}>{g.name}</span>
                                              <span style={{ fontSize: 10.5, color: K.textFaint, flexShrink: 0 }}>{g.items.length}</span>
                                              <span style={{ flex: 1, height: 1, background: K.lineSoft }}/>
                                            </div>
                                          )}
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{g.items.map(chip)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
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
                                  // Eyebrow label + hairline rule reads as a group heading;
                                  // the old tinted full-width strip looked like a warning.
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 10 }}>
                                    <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: K.warnBg, color: K.warn, border: `1px solid ${K.warnBorder}` }}>
                                      <Icon name="clipboard" size={13} strokeWidth={2}/>
                                    </span>
                                    <span style={{ ...type.label, fontSize: isTablet?12:11, fontWeight: 700, color: K.hdrTitle }}>{T2("Pre-prep")}</span>
                                    <KPill toneName="warn" size="sm">{prePrep.length} {prePrep.length===1?T2("step"):T2("steps")}</KPill>
                                    <div style={{ flex: 1, height: 1, background: K.lineSoft }}/>
                                  </div>
                                )}
                                {prePrep.map((item, gi) => {
                                  const si = item.origIdx; const step = item.step;
                                  const done = stepDone(d, si, step); const started = !!d.starts?.[si]; const overdue = isOverdue(d, si);
                                  const el = elapsed(d, si); const tm = d.stepTm?.[si] || step.tm || 0;
                                  const d1Done = isD1Step(d, si);
                                  const gIdx = gi;
                                  const prevItem = gi > 0 ? prePrep[gi - 1] : null;
                                  const prevDone = gIdx === 0 ? secStoreDone : (prevItem ? stepDone(d, prevItem.origIdx, prevItem.step) : false);
                                  const cTitle=cleanStepText(step.t)+(step.live?" 🔴":"");const cDesc=cleanStepText(step.i||"");const cDescShow=cDesc&&!cTitle.includes(cDesc)&&!cDesc.includes(cTitle)?cDesc:"";
                                  return <StepRow key={si} num={gIdx + 1} title={cTitle} desc={cDescShow} ccp={step.ccp?cleanStepText(step.ccp):null}
                                    subs={step.subs||null} stepKey={"step_"+si} d2d={d} setDsFn={(upd)=>setDs(dish.fEvId,dish.fIdx,upd,dish)}
                                    done={done || d1Done} running={started && !done && !d1Done} overdue={overdue}
                                    elapsedSec={el} timerSec={tm} locked={false}
                                    d1Badge={d1Done}
                                    onStart={() => startStep(dish.fEvId, dish.fIdx, si, tm, dish)}
                                    onDone={() => markManual(dish.fEvId, dish.fIdx, si, dish)}
                                    onUndo={() => clearManual(dish.fEvId, dish.fIdx, si, dish)}
                                    doneTime={d.manualAt?.[si] || null}
                                    doneElapsed={d.doneElapsed?.[si] ?? null}
                                    large={isSectionUser} lang={lang}
                                    parentKey={dKey} alarmMuted={alarmMuted} muteAlarm={muteAlarm} clearMuteAlarm={clearMuteAlarm} overdueCollector={overdueRef}
                                  />;
                                })}

                                {cooking.length > 0 && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 10 }}>
                                    <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: K.okBg, color: K.ok, border: `1px solid ${K.okBorder}` }}>
                                      <Icon name="flame" size={13} strokeWidth={2}/>
                                    </span>
                                    <span style={{ ...type.label, fontSize: isTablet?12:11, fontWeight: 700, color: K.hdrTitle }}>{T2("Cooking")}</span>
                                    <KPill toneName="ok" size="sm">{cooking.length} {cooking.length===1?T2("step"):T2("steps")}</KPill>
                                    <div style={{ flex: 1, height: 1, background: K.lineSoft }}/>
                                  </div>
                                )}
                                {cooking.map((item, ci) => {
                                  const si = item.origIdx; const step = item.step;
                                  const done = stepDone(d, si, step); const started = !!d.starts?.[si]; const overdue = isOverdue(d, si);
                                  const el = elapsed(d, si); const tm = d.stepTm?.[si] || step.tm || 0;
                                  const allPrev = nonStore.slice(0, nonStore.indexOf(item));
                                  const prevItem = allPrev.length > 0 ? allPrev[allPrev.length - 1] : null;
                                  const prevDone = allPrev.length === 0 ? secStoreDone : (prevItem ? stepDone(d, prevItem.origIdx, prevItem.step) : false);
                                  const cTitle=cleanStepText(step.t)+(step.live?" 🔴":"");const cDesc=cleanStepText(step.i||"");const cDescShow=cDesc&&!cTitle.includes(cDesc)&&!cDesc.includes(cTitle)?cDesc:"";
                                  return <StepRow key={si} num={prePrep.length + ci + 1} title={cTitle} desc={cDescShow} ccp={step.ccp?cleanStepText(step.ccp):null}
                                    subs={step.subs||null} stepKey={"step_"+si} d2d={d} setDsFn={(upd)=>setDs(dish.fEvId,dish.fIdx,upd,dish)}
                                    done={done} running={started && !done} overdue={overdue}
                                    elapsedSec={el} timerSec={tm} locked={false}
                                    onStart={() => startStep(dish.fEvId, dish.fIdx, si, tm, dish)}
                                    onDone={() => markManual(dish.fEvId, dish.fIdx, si, dish)}
                                    onUndo={() => clearManual(dish.fEvId, dish.fIdx, si, dish)}
                                    doneTime={d.manualAt?.[si] || null}
                                    doneElapsed={d.doneElapsed?.[si] ?? null}
                                    large={isSectionUser} lang={lang}
                                    parentKey={dKey} alarmMuted={alarmMuted} muteAlarm={muteAlarm} clearMuteAlarm={clearMuteAlarm} overdueCollector={overdueRef}
                                  />;
                                })}
                              </div>
                            );
                          })()}

                          {/* Every step done but the store lot is not — say so.
                              Previously the sign-off panel just never appeared
                              and there was nothing on screen to explain it. */}
                          {!secStoreDone && !isReady && nonStore.every(x => stepDone(d, x.origIdx, x.step) || isD1Step(d, x.origIdx)) && (
                            <div style={{ marginTop: 14, padding: "13px 16px", borderRadius: K.rLg,
                              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                              backgroundColor: K.warnBg, border: `1px solid ${K.warnBorder}` }}>
                              <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                background: K.surface, color: K.warn, border: `1px solid ${K.warnBorder}` }}>
                                <Icon name="store" size={16} strokeWidth={2}/>
                              </span>
                              <div style={{ flex: 1, minWidth: 150 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: K.hdrTitle }}>{T2("All steps done — waiting on store")}</div>
                                <div style={{ fontSize: 12, color: K.hdrMeta, marginTop: 1 }}>
                                  {secStoreDoneN}/{secStoreTotal} {T2("ingredients collected. Finish the collect-from-store list to sign this dish off.")}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* All done → sign off (venue-aware) */}
                          {secStoreDone && nonStore.every(x => stepDone(d, x.origIdx, x.step) || isD1Step(d, x.origIdx)) && !isReady && (()=>{
                            const tev = todayEvs.find(e => e.id === dish.fEvId);
                            const tabVenue = (currentUser?.venue||"").toLowerCase().trim();
                            const evVenue = (tev?.venue||"").toLowerCase().trim();
                            const sameVenue = tabVenue && evVenue && (evVenue.includes(tabVenue)||tabVenue.includes(evVenue));
                            const needsTransport = tabVenue && evVenue && !sameVenue;
                            return(
                            // The sign-off is the one irreversible action on this
                            // screen, so it reads as its own panel with a tinted
                            // ground rather than a bare white strip.
                            // One row: what happened on the left, the action on
                            // the right. Full-width the button was a green slab
                            // the width of the screen for a single tap target.
                            <div style={{ marginTop: 14, padding: "13px 16px", borderRadius: K.rLg,
                              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                              // Brand green, not the mint "ok" status tone — this
                              // panel belongs to the brand plate, same family as
                              // the sidebar pill and the header badge.
                              backgroundColor: needsTransport ? K.warnBg : K.brandBg,
                              border: `1px solid ${needsTransport ? K.warnBorder : K.brandBorder}` }}>
                              <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                background: K.surface, color: needsTransport ? K.warn : K.brand, border: `1px solid ${needsTransport ? K.warnBorder : K.brandBorder}` }}>
                                <Icon name={needsTransport ? "truck" : "check"} size={16} strokeWidth={2}/>
                              </span>
                              <div style={{ flex: 1, minWidth: 150 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: K.hdrTitle }}>{T2("All steps complete")}</div>
                                <div style={{ fontSize: 12, color: K.hdrMeta, marginTop: 1 }}>
                                  {needsTransport
                                    ? <>{T2("This dish needs transport to")} <b style={{color:K.warn}}>{tev?.venue||"venue"}</b></>
                                    : T2("Sign off to mark this dish ready.")}
                                </div>
                              </div>
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
                                // The yield captured at sign-off used to go only
                                // to Supabase, so nothing on this screen could
                                // read it back. Persist it on the dish too —
                                // that is what the dispatch list quotes.
                                const doFinish = (extra) => setDs(dish.fEvId, dish.fIdx, { ...updates, ...(extra || {}) }, dish);
                                if (onBeforeDishDone) { const evObj = todayEvs.find(e => e.id === dish.fEvId); onBeforeDishDone(dish, evObj?.pax||0, false, doFinish); } else { doFinish(); }
                              }} onPointerDown={ripple} className="kh-rip kh-signoff" style={{ flexShrink:0, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8,
                                padding: "11px 20px", borderRadius: 14, border: "none", cursor: "pointer",
                                background: needsTransport ? K.warn : K.brand, color: "#fff",
                                fontSize: 13.5, fontWeight: 700, fontFamily: K.fontBody, minHeight: 44, whiteSpace: "nowrap",
                                boxShadow: needsTransport ? "0 4px 14px rgba(196,121,12,.26)" : "0 4px 14px rgba(28,61,43,.26)" }}>
                                <Icon name={needsTransport ? "truck" : "check"} size={16} strokeWidth={2.2}/>
                                {needsTransport ? T2("Ready for Transport") : T2("Mark Complete")}
                              </button>
                            </div>);
                          })()}

                          {/* Already done */}
                          {/* Same treatment as the ready dish card: white body,
                              a solid rail, and the tint fading out — not a flat
                              pale slab with the words floating in it. */}
                          {isReady && (()=>{
                            const tk = d.transportLinked;
                            const rail = tk ? K.warn : K.brand;
                            return (
                            <div style={{ position: "relative", overflow: "hidden", marginTop: 10,
                              padding: "12px 16px 12px 19px", borderRadius: K.rLg,
                              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                              background: tk
                                ? `linear-gradient(100deg, ${K.warnBg} 0%, rgba(253,243,226,.45) 46%, ${K.surface} 82%)`
                                : `linear-gradient(100deg, ${K.brandBg} 0%, rgba(231,241,234,.45) 46%, ${K.surface} 82%)`,
                              border: `1px solid ${tk ? K.warnBorder : K.brandBorder}` }}>
                              <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: rail }}/>
                              <span style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                background: rail, color: "#fff" }}>
                                <Icon name={tk ? "truck" : "check"} size={15} strokeWidth={2.6}/>
                              </span>
                              <div style={{ flex: 1, minWidth: 140 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: rail }}>
                                  {tk ? T2("Ready for Transport") : T2("Complete")}
                                </div>
                                {d.completedBy && (
                                  <div style={{ fontSize: 12, color: K.hdrMeta, marginTop: 1 }}>
                                    {T2("Signed off by")} <b style={{color:K.hdrMetaStrong,fontWeight:600}}>{d.completedBy}</b>
                                    {d.completedAt ? ` · ${d.completedAt}` : ""}
                                  </div>
                                )}
                              </div>
                            </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
               </div>
              </div>
            )}
          </div>
        );
      })}
      {secKeys.length === 0 && (
        <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13, color: K.textMuted }}>{T2("No dishes to cook for this selection.")}</div>
      )}
      </KPanel>

      {/* Send-to-transport picker. The quantity IS the selection — a blank or
          zero cell simply is not sent, so there is no separate tick to keep in
          step with the number beside it. */}
      <KModal
        open={!!transportPick}
        toneName="brand"
        iconTone="brand"
        icon="truck"
        title={T2("Send to transport")}
        confirmLabel={`${T2("Send")} (${transportCells.length})`}
        confirmIcon="truck"
        cancelLabel={T2("Cancel")}
        confirmDisabled={transportCells.length===0}
        width={transportPick && transportPick.fns.length>1 ? 820 : 560}
        onClose={()=>setTransportPick(null)}
        subhead={transportPick && (
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{...type.label,color:K.sbLabel}}>
              {transportCells.length} {transportCells.length===1?T2("line"):T2("lines")}
              {transportPick.fns.length>1 && ` · ${transportPick.fns.length} ${T2("functions")}`}
            </span>
            <span style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:6,
              padding:"5px 12px",borderRadius:K.rPill,background:K.brandBg,
              border:`1px solid ${K.brandBorder}`,color:K.brandText,fontSize:12.5,fontWeight:600}}>
              <Icon name="layers" size={13} strokeWidth={2}/>{transportPick.label}
            </span>
          </div>
        )}
        onConfirm={()=>{
          const now = fmtStamp();
          const stamp = localDateStr(new Date());
          // One queue row per filled cell, in the shape TransportDispatch already
          // renders. Each row carries ITS OWN function's guest, venue, pax and
          // date, and the quantity the chef typed for that function.
          const rows = transportCells.map((c, ix) => ({
            id: `${stamp}_${transportPick.sec}_${c.evId}_${ix}_${Date.now()}`,
            dishName: `${c.n} — ${c.qty} ${c.unit}`,
            event: c.guest,
            pax: c.pax,
            venue: c.venue,
            eventDate: c.date,
            preparedBy: currentUser?.name || "Kitchen",
            markedAt: now,
            status: "Ready",
            fromVenue: currentUser?.venue || "",
            station: transportPick.label,
          }));
          if(!setTransportQueue || rows.length===0){ setTransportPick(null); return; }
          setTransportQueue(prev=>[...(prev||[]), ...rows]);
          setTransportPick(null);
          setTransportToast({ n: rows.length, station: transportPick.label, fns: transportPick.fns.length });
        }}
        body={transportPick && (()=>{
          const fns = transportPick.fns;
          const multi = fns.length > 1;
          // Guests across the top, dishes down the side. A shared dish is one
          // cooked batch, so the chef types how much of it goes to each guest —
          // a single tick could never express that. With one guest there is
          // nothing to split, so it collapses to a plain list.
          const grid = multi
            ? `minmax(150px, 1fr) 96px repeat(${fns.length}, 132px)`
            : "minmax(150px, 1fr) 96px 132px";
          // Typing into one cell rebalances the rest so the row still adds up to
          // what was cooked. With two functions that is simply "the remainder";
          // with more it is split by pax, and the last cell absorbs the rounding
          // so the total lands exactly on `made`. Left alone when the batch size
          // is unknown, or when the field is cleared — clearing is how you take
          // a function out, not a cue to reshuffle everything.
          const setCell = (d, evId, raw) => {
            setTransportQty(p => {
              const next = { ...p, [`${evId}|${d.n}`]: raw };
              const others = fns.filter(f => d.cells[f.evId] && f.evId !== evId);
              const typed = parseFloat(raw);
              if (d.made == null || others.length === 0 || !(typed >= 0)) return next;
              const rem = Math.max(0, Math.round((d.made - typed) * 10) / 10);
              const paxSum = others.reduce((s, f) => s + (d.cells[f.evId].pax || 0), 0);
              let given = 0;
              others.forEach((f, i) => {
                let v;
                if (i === others.length - 1) v = Math.round((rem - given) * 10) / 10;
                else {
                  const share = paxSum > 0 ? (d.cells[f.evId].pax || 0) / paxSum : 1 / others.length;
                  v = Math.round(rem * share * 10) / 10;
                  given += v;
                }
                next[`${f.evId}|${d.n}`] = String(Math.max(0, v));
              });
              return next;
            });
          };
          const cell = (d, f) => {
            const c = d.cells[f.evId];
            if (!c) return <span key={f.evId} style={{textAlign:"center",color:K.lineStrong,fontSize:14}}>—</span>;
            const ck = `${f.evId}|${d.n}`;
            const val = transportQty[ck] ?? "";
            return (
              <span key={f.evId} style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                <input type="number" step="any" min="0" inputMode="decimal"
                  disabled={!d.ready}
                  value={val}
                  placeholder={c.suggested != null ? String(c.suggested) : "0"}
                  onChange={e=>setCell(d, f.evId, e.target.value)}
                  className="kh-yieldinput"
                  style={{width:74,padding:"8px 9px",borderRadius:K.rSm,fontSize:13.5,fontWeight:700,textAlign:"right",
                    border:`1.5px solid ${val?K.brandBorder:K.line}`,
                    background:!d.ready?K.surfaceAlt:val?K.brandBg:K.surface,
                    color:K.text,boxSizing:"border-box",fontFamily:K.fontBody,fontVariantNumeric:"tabular-nums",
                    outline:"none",cursor:d.ready?"text":"not-allowed",opacity:d.ready?1:.5}}/>
                <span style={{fontSize:11.5,color:K.textFaint,width:24,flexShrink:0}}>{d.unit}</span>
              </span>
            );
          };
          return (
          <div>
            <div style={{overflowX:"auto",overscrollBehavior:"contain"}}>
              <div style={{minWidth:multi?fns.length*132+276:0}}>
                {/* Guest headers */}
                <div style={{display:"grid",gridTemplateColumns:grid,gap:10,alignItems:"end",
                  paddingBottom:9,borderBottom:`1px solid ${K.lineStrong}`,marginBottom:4}}>
                  <span style={{...type.label,fontSize:10,color:K.textMuted}}>{T2("Dish")}</span>
                  <span style={{...type.label,fontSize:10,color:K.textMuted,textAlign:"center"}}>{T2("Made")}</span>
                  {fns.map(f=>(
                    <span key={f.evId} style={{textAlign:"center",minWidth:0}}>
                      <span style={{display:"block",fontSize:13.5,fontWeight:700,color:K.hdrTitle,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.guest}</span>
                      <span style={{display:"block",fontSize:11,color:K.hdrMeta,marginTop:1,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.pax} pax</span>
                    </span>
                  ))}
                </div>

                <div style={{maxHeight:376,overflowY:"auto",overscrollBehavior:"contain"}}>
                  {transportPick.dishes.map((d,di)=>{
                    // How much of the batch is still unallocated. This is the
                    // number the chef is actually working against when splitting
                    // one pot between two functions.
                    const used = fns.reduce((s,f)=>{
                      if(!d.cells[f.evId]) return s;
                      const v = parseFloat(transportQty[`${f.evId}|${d.n}`]);
                      return s + (v>0?v:0);
                    },0);
                    const left = d.made != null ? Math.round((d.made - used)*10)/10 : null;
                    return (
                    <div key={di} style={{display:"grid",gridTemplateColumns:grid,gap:10,alignItems:"center",
                      padding:"7px 0",borderBottom:di<transportPick.dishes.length-1?`1px solid ${K.lineSoft}`:"none",
                      opacity:d.ready?1:.55}}>
                      <span style={{minWidth:0}}>
                        <span style={{display:"block",fontSize:13.5,fontWeight:600,color:K.hdrTitle,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dishLabel(d.n, lang)}</span>
                        {!d.ready
                          ? <span style={{display:"block",fontSize:11,color:K.warn,marginTop:1}}>{T2("not cooked yet")}</span>
                          : d.shared && <span style={{display:"block",fontSize:11,color:K.textFaint,marginTop:1}}>{T2("shared batch")}</span>}
                      </span>
                      {/* Made, and what is left of it. A tilde marks a figure
                          derived from the recipe rather than weighed. */}
                      <span style={{textAlign:"center",minWidth:0}}>
                        <span style={{display:"block",fontSize:13.5,fontWeight:700,fontVariantNumeric:"tabular-nums",
                          color:d.made==null?K.lineStrong:d.madeEst?K.hdrMeta:K.hdrTitle}}>
                          {d.made==null?"—":`${d.madeEst?"~":""}${d.made} ${d.unit}`}
                        </span>
                        {d.ready && left!=null && used>0 && (
                          <span style={{display:"block",fontSize:10.5,marginTop:1,fontWeight:600,
                            fontVariantNumeric:"tabular-nums",
                            color:left<0?K.danger:left===0?K.ok:K.textFaint}}>
                            {left<0?`${Math.abs(left)} ${T2("over")}`:`${left} ${T2("left")}`}
                          </span>
                        )}
                      </span>
                      {fns.map(f=>cell(d,f))}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{display:"flex",alignItems:"center",gap:9,padding:"11px 13px",borderRadius:K.rMd,marginTop:14,
              background:K.brandBg,border:`1px solid ${K.brandBorder}`}}>
              <span style={{color:K.brand,flexShrink:0,lineHeight:0}}><Icon name="truck" size={16} strokeWidth={1.9}/></span>
              <span style={{fontSize:12.5,color:K.brandText,lineHeight:1.5}}>
                {multi
                  ? T2("Quantities are pre-split by pax — adjust any of them. Blank means nothing goes to that function.")
                  : T2("These appear under Transport & Dispatch for pickup.")}
              </span>
            </div>
          </div>
          );
        })()}
      />

      <KToast
        open={!!transportToast}
        toneName="ok"
        icon="truck"
        title={T2("Sent to transport")}
        body={transportToast ? `${transportToast.n} ${transportToast.n===1?T2("dish"):T2("dishes")} ${T2("from")} ${transportToast.station}${transportToast.fns>1?` · ${transportToast.fns} ${T2("functions")}`:""}.` : ""}
        onClose={()=>setTransportToast(null)}
      />

      {/* ── Dispatch per event ──
          Combined used to require EVERY dish of the day to be ready before this
          panel appeared at all, while the single-function view showed it at the
          first one. So on a 103-dish board it stayed hidden even though whole
          functions were finished and waiting to go out. The panel now appears on
          the same terms in both views, and readiness is judged per function —
          which is what "dispatch by function" means — by the button inside each
          card rather than by hiding the whole panel. */}
      {readyDishes>0 && (
        <KPanel icon="store" title={T2("Dispatch by function")} bodyPad="12px 16px 16px" style={{ marginTop: 12 }}>
          {/* Two across. As full-width rows each function was a strip with the
              button stranded a screen-width away from the name it belongs to. */}
          <div className="kh-dispatchwrap">
           <div className="kh-dispatchgrid">
            {/* Follow the function selector. This mapped over every function of
                the day regardless of it, so picking one function still listed
                all of them — and the panel's whole purpose is per-function
                dispatch sign-off. Combined still shows the lot. */}
            {(isCombined ? todayEvs : todayEvs.filter(e => e.id === activeEv?.id)).map(ev => {
              const dispatched = !!(kt[ev.id]?.__dispatch_ready);
              // This function's own dishes. In Combined a dish is shared across
              // functions, so it counts for a function when that function is in
              // its fns list.
              const evDishes = Object.values(byDish).filter(dd =>
                (dd.fns && dd.fns.length) ? dd.fns.some(f => f.evId === ev.id) : dd.fEvId === ev.id
              );
              // What is actually going out, and how much of each. Quantity comes
              // from the yield the chef entered at sign-off; where that was
              // skipped, fall back to the recipe's pax-scaled target so the line
              // is never blank.
              // NOTE: byDish is keyed BY dish name and the entries carry no
              // `name` field, so read the key. Using dd.name gave every line a
              // blank label.
              const evReadyDishes = Object.entries(byDish)
                .filter(([, dd]) => (dd.fns && dd.fns.length) ? dd.fns.some(f => f.evId === ev.id) : dd.fEvId === ev.id)
                .filter(([n, dd]) => ds(dd.fEvId, dd.fIdx, n).ready);
              const evReady = evReadyDishes.length;
              const evAllReady = evDishes.length > 0 && evReady === evDishes.length;

              const dispatchLines = evReadyDishes.map(([n, dd]) => {
                const st = ds(dd.fEvId, dd.fIdx, n);
                // Weighed at sign-off — the only figure that is actually measured.
                if (st.madeQty) return { n, q: `${st.madeQty} ${st.madeUnit || 'kg'}` };
                if (dd.totalKg > 0) return { n, q: `${dd.totalKg.toFixed(1).replace(/\.0$/, '')} kg` };
                // Derived from the recipe's yield anchor, scaled to THIS
                // function's pax — not dd.totalPax, which in Combined is the sum
                // across every function and would overstate a single card.
                const evPax = (dd.fns || []).filter(f => f.evId === ev.id).reduce((s, f) => s + (+f.p || 0), 0) || (+ev.pax || 0);
                const rec = findRecipeForDish(n);
                const baseKg = rec?.ingredients?.base_yield?.kg;
                const basePax = rec?.ingredients?.base_pax || 300;
                if (baseKg && evPax > 0) {
                  const kg = baseKg * evPax / basePax;
                  return { n, q: `~${kg.toFixed(1).replace(/\.0$/, '')} kg`, est: true };
                }
                // No measured yield and no yield anchor on the recipe. Printing
                // the pax count here just repeated the same number down the whole
                // list and said nothing about how much to load.
                return { n, q: null };
              });
              // Quantified dishes first. Two thirds of a list can be unweighed,
              // and interleaved they turned the column into a run of dashes with
              // the actual figures scattered through it.
              dispatchLines.sort((a, b) => (a.q ? 0 : 1) - (b.q ? 0 : 1));
              const noQtyCount = dispatchLines.filter(l => !l.q).length;
              return (
                // Three zones: who it is for, what goes on the van, and the
                // action. Previously all three ran together in one soft block
                // and the card read as an undifferentiated list.
                <div key={ev.id} className="kh-cardart-sm" style={{ position: "relative", overflow: "hidden",
                  display: "flex", flexDirection: "column", borderRadius: K.rLg,
                  backgroundColor: K.surface,
                  boxShadow: dispatched ? "0 1px 3px rgba(28,61,43,.10), 0 8px 22px rgba(28,61,43,.10)" : K.shadowCard,
                  border: `1px solid ${dispatched ? K.brandBorder : K.line}` }}>
                  <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, zIndex: 2,
                    background: dispatched ? K.brand : K.sbGoldSoft }}/>

                  {/* Header */}
                  <div style={{ position: "relative", padding: "15px 16px 13px 19px", minWidth: 0,
                    background: dispatched
                      ? `linear-gradient(100deg, ${K.brandBg} 0%, rgba(231,241,234,.4) 52%, ${K.surface} 88%)`
                      : "transparent" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, marginTop: 1,
                        background: dispatched ? K.brand : K.hdrBadge, color: K.hdrBadgeIcon,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name={dispatched ? "check" : "users"} size={18} strokeWidth={dispatched ? 2.4 : 1.85}/>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600,
                            letterSpacing: -.2, lineHeight: 1.2, color: dispatched ? K.brand : K.hdrTitle, overflowWrap: "anywhere" }}>{ev.guest}</div>
                          {/* A count is data, so it gets a chip and real weight.
                              As 10.5px faint uppercase it read as a watermark. */}
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                            padding: "4px 10px", borderRadius: K.rPill,
                            background: evAllReady ? K.brandBg : K.surfaceAlt,
                            border: `1px solid ${evAllReady ? K.brandBorder : K.line}`,
                            color: evAllReady ? K.brand : K.hdrMeta,
                            fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                            {evReady}/{evDishes.length} {T2("cooked")}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 12.5, color: K.hdrMeta, marginTop: 4 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="building" size={12} strokeWidth={2}/>{ev.venue}</span>
                          <span style={{ color: K.textFaint }}>·</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="clock" size={12} strokeWidth={2}/>{ev.time}</span>
                          <span style={{ color: K.textFaint }}>·</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="users" size={12} strokeWidth={2}/>{ev.pax} {T2("pax")}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* The load list, on its own inset ground so it reads as a
                      packing list rather than more of the header. */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {dispatchLines.length > 0 && (
                      <div style={{ backgroundColor: K.surfaceAlt, borderTop: `1px solid ${K.lineSoft}`, padding: "10px 16px 12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ color: K.brand, display: "flex", flexShrink: 0 }}><Icon name="truck" size={13} strokeWidth={2}/></span>
                          <span style={{ ...type.label, fontSize: 11, color: K.hdrTitle }}>{T2("To dispatch")}</span>
                          <span style={{ flex: 1, height: 1, background: K.line }}/>
                          <span style={{ fontSize: 13, fontWeight: 700, color: K.hdrMeta, fontVariantNumeric: "tabular-nums" }}>{dispatchLines.length}</span>
                        </div>
                        {/* Tight rows, larger type. The hairline between every
                            line pushed the list to almost twice the height while
                            making each entry harder to read, not easier. */}
                        <div style={{ display: "flex", flexDirection: "column", maxHeight: 210, overflowY: "auto", overscrollBehavior: "contain" }}>
                          {dispatchLines.map((l, li) => (
                            // Unquantified rows sit back. They are still on the
                            // van, but a column of identical dashes competing at
                            // full weight is what made this list unreadable.
                            // The hairline marks where the weighed items end —
                            // that boundary is real information, not decoration.
                            <div key={li} style={{ display: "flex", alignItems: "baseline", gap: 12, fontSize: 14,
                              lineHeight: 1.55, padding: "1px 0",
                              marginTop: (!l.q && li > 0 && dispatchLines[li - 1].q) ? 7 : 0,
                              paddingTop: (!l.q && li > 0 && dispatchLines[li - 1].q) ? 7 : 1,
                              borderTop: (!l.q && li > 0 && dispatchLines[li - 1].q) ? `1px dashed ${K.line}` : "none" }}>
                              <span style={{ flex: 1, minWidth: 0, fontWeight: l.q ? 500 : 400,
                                color: l.q ? K.hdrTitle : K.textMuted,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dishLabel(l.n, lang)}</span>
                              {/* A tilde marks a figure derived from the recipe
                                  rather than weighed — do not pass an estimate
                                  off as a measurement. */}
                              <span style={{ flexShrink: 0, fontWeight: l.q ? 700 : 400, fontVariantNumeric: "tabular-nums", fontSize: 14,
                                color: !l.q ? K.lineStrong : l.est ? K.hdrMeta : K.brand }}>{l.q || "—"}</span>
                            </div>
                          ))}
                        </div>
                        {noQtyCount > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, fontSize: 12, color: K.textMuted }}>
                            <Icon name="alert" size={12} strokeWidth={2}/>
                            {noQtyCount} {noQtyCount === 1 ? T2("dish has no yield recorded") : T2("dishes have no yield recorded")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Action bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", flexWrap: "wrap",
                    padding: "11px 16px 12px 18px", borderTop: `1px solid ${K.lineSoft}` }}>
                    {dispatched ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: K.rPill,
                        background: K.brand, color: "#fff", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                        <Icon name="check" size={13} strokeWidth={2.6}/>{T2("Dispatched")} · {kt[ev.id]?.__dispatch_time}
                      </span>
                    ) : evAllReady ? (
                      <KButton variant="brand" icon="store" onClick={() => { setEvMeta(ev.id, "__dispatch_ready", true); setEvMeta(ev.id, "__dispatch_time", fmtStamp()); }}
                        style={{ padding: "10px 20px", borderRadius: 14 }}>
                        {T2("Dispatch")}
                      </KButton>
                    ) : (
                      // Say what is left rather than showing a button that would
                      // send out a half-cooked function.
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: K.textMuted, whiteSpace: "nowrap" }}>
                        <Icon name="clock" size={13} strokeWidth={2}/>
                        {evDishes.length - evReady} {T2("still cooking")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
           </div>
          </div>
        </KPanel>
      )}
    </div>
  );
}

// ── StepRow ──
function StepRow({ num, title, desc, ccp, done, running, overdue, elapsedSec, timerSec, locked, d1Badge, onStart, onDone, onUndo, doneTime, doneElapsed, subs, stepKey, d2d, setDsFn, large, lang = "en", parentKey, alarmMuted, muteAlarm, clearMuteAlarm, overdueCollector }) {
  const remaining = timerSec - elapsedSec;
  const mainAlarmKey = (parentKey || "") + "|" + stepKey;
  const mainMuted = !!(alarmMuted && alarmMuted[mainAlarmKey]);
  if (!subs && overdue && !done && overdueCollector && !mainMuted) overdueCollector.current.push(mainAlarmKey);
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
        color: done || running ? "#fff" : C.muted,
      }}>
        {done ? "✓" : num}
      </div>
      <div style={{ flex: 1 }}>
        <div>
          <span style={{ fontSize: SZ.title, fontWeight: 700, color: done ? C.green : running ? (overdue ? C.red : C.amber) : C.text }}>{title}</span>
          {subs && !done && d2d && <span style={{fontSize:11,color:C.muted,marginLeft:6}}>({subs.filter((_,sbi)=>!!(d2d.manual&&d2d.manual[stepKey+"_sub_"+sbi])).length}/{subs.length})</span>}
          {d1Badge && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: K.okBg, border: `1px solid ${K.okBorder}`, color: K.ok, marginLeft: 6 }}>D-1</span>}
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
            <span style={{ color: K.ok, display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="check" size={12} strokeWidth={2.4}/>{doneM}m{doneS > 0 ? ` ${doneS}s` : ""} done</span>{doneTime&&<span style={{color:K.textMuted,fontWeight:400,fontSize:SZ.done}}> · {doneTime}</span>}
            {wasUnder && diffSec > 0 && <span style={{ color: K.ok, fontWeight: 600 }}>{diffM > 0 ? `${diffM}m ` : ""}{diffS}s under</span>}
            {wasOver && <span style={{ color: K.danger, fontWeight: 600 }}>+{diffM > 0 ? `${diffM}m ` : ""}{diffS}s over</span>}
          </div>
        )}
        {!subs && done && !hasDoneElapsed && <div style={{ fontSize: 11, color: K.ok, marginTop: 3, display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="check" size={12} strokeWidth={2.4}/>{doneTime || "done"}</div>}
        {subs && done && <div style={{ fontSize: 11, color: K.ok, marginTop: 3, display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="check" size={12} strokeWidth={2.4}/>all sub-steps done</div>}
        {!subs && !done && !running && !locked && timerSec > 0 && <div style={{ fontSize: 11, color: K.textFaint, marginTop: 3, display:"inline-flex", alignItems:"center", gap:4 }}><Icon name="clock" size={12} strokeWidth={2}/>{Math.floor(timerSec / 60)}m</div>}
      </div>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        {!subs && locked && !done && <div style={{ padding: SZ.btn, borderRadius: SZ.btnR, background: K.surfaceAlt, border: `1px solid ${K.line}`, color: K.textFaint, display:"flex", alignItems:"center" }}><Icon name="lock" size={14} strokeWidth={2}/></div>}
        {!subs && !locked && !done && !running && timerSec > 0 && <button onClick={e => { e.stopPropagation(); clearMuteAlarm && clearMuteAlarm(mainAlarmKey); onStart(); }} onPointerDown={ripple} className="kh-rip" style={{ display:"inline-flex", alignItems:"center", gap:6, padding: SZ.btn, borderRadius: SZ.btnR, background: K.brand, color: "#fff", border: "none", fontSize: SZ.btnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.btnH, fontFamily: K.fontBody }}><Icon name="clock" size={14} strokeWidth={2.2}/>{Math.floor(timerSec / 60)}m</button>}
        {!subs && !locked && !done && !running && !timerSec && <button onClick={e => { e.stopPropagation(); onDone(); }} onPointerDown={ripple} className="kh-rip" style={{ display:"inline-flex", alignItems:"center", gap:6, padding: SZ.btn, borderRadius: SZ.btnR, background: K.brand, color: "#fff", border: "none", fontSize: SZ.btnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.btnH, fontFamily: K.fontBody }}><Icon name="check" size={14} strokeWidth={2.4}/>{T("Done", lang)}</button>}
        {!subs && running && !done && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={e => { e.stopPropagation(); onDone(); }} onPointerDown={ripple} className="kh-rip" style={{ display:"inline-flex", alignItems:"center", gap:6, padding: SZ.btn, borderRadius: SZ.btnR, background: overdue ? K.danger : K.ok, color: "#fff", border: "none", fontSize: SZ.btnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.btnH, fontFamily: K.fontBody }}><Icon name={overdue ? "alert" : "check"} size={14} strokeWidth={2.4}/>{T("Done", lang)}</button>
            {/* Silence the overtime alarm for this step (from origin/main). */}
            {overdue && <button onClick={e => { e.stopPropagation(); mainMuted ? clearMuteAlarm(mainAlarmKey) : muteAlarm(mainAlarmKey); }} onPointerDown={ripple} className="kh-rip" title={mainMuted ? T("Alarm silenced", lang) : T("Silence alarm", lang)} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", padding: SZ.btn, borderRadius: SZ.btnR, minHeight: SZ.btnH, cursor:"pointer", background: mainMuted ? K.surfaceAlt : K.warnBg, border: `1px solid ${mainMuted ? K.line : K.warnBorder}`, color: mainMuted ? K.textFaint : K.warn }}><Icon name="bell" size={15} strokeWidth={2}/></button>}
          </div>
        )}
        {subs && locked && !done && <div style={{ padding: SZ.btn, borderRadius: SZ.btnR, background: K.surfaceAlt, border: `1px solid ${K.line}`, color: K.textFaint, display:"flex", alignItems:"center" }}><Icon name="lock" size={14} strokeWidth={2}/></div>}
        {subs && !locked && !done && <span style={{ color: K.textMuted, display:"flex" }}><Icon name="chevronD" size={large?15:13} strokeWidth={2}/></span>}
        {/* Ghost until hovered — the amber fill made every completed step look
            like it still needed attention. */}
        {/* Prefer onUndo: the parent knows the step index and clears every key
            shape markManual could have written. The setDsFn fallback only ever
            cleared the "step_N" form, which is not the one Done writes. */}
        {done && !subs && (onUndo || (d2d && setDsFn)) && <button onClick={e=>{e.stopPropagation(); if(onUndo){onUndo();} else {setDsFn({manual:{...(d2d.manual||{}),[stepKey]:false},starts:{...(d2d.starts||{}),[stepKey]:null}});}}} className="kh-undobtn" title={T("Undo", lang)} style={{display:"inline-flex",alignItems:"center",gap:5,padding:large?"6px 11px":"5px 9px",borderRadius:large?9:7,background:"transparent",border:`1px solid ${K.line}`,color:K.textMuted,fontSize:large?11:10,fontWeight:600,cursor:"pointer",fontFamily:K.fontBody}}><Icon name="undo" size={12} strokeWidth={2}/>{T("Undo", lang)}</button>}
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
            const subAlarmKey = (parentKey || "") + "|" + sbk;
            const sbMuted = !!(alarmMuted && alarmMuted[subAlarmKey]);
            if (sbOver && overdueCollector && !sbMuted) overdueCollector.current.push(subAlarmKey);
            return (
              <div key={sbi} style={{ padding: "8px 0", borderBottom: sbi < subs.length - 1 ? `1px solid ${C.border}20` : "none" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: SZ.sub, height: SZ.sub, borderRadius: SZ.subR, background: sbDone ? C.green + "20" : sbStarted ? (sbOver ? C.red+"20" : C.amber+"20") : C.darkCard, border: `1.5px solid ${sbDone ? C.green : sbStarted ? (sbOver ? C.red : C.amber) : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: SZ.subFt, fontWeight: 600, color: sbDone ? C.green : sbStarted ? (sbOver ? C.red : C.amber) : C.muted, flexShrink: 0, marginTop: 1 }}>{sbDone ? "✓" : num + String.fromCharCode(97 + sbi)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: SZ.subTitle, fontWeight: 600, color: sbDone ? C.green : sbStarted ? (sbOver ? C.red : C.amber) : C.text, lineHeight: 1.5, wordBreak: "break-word", overflowWrap: "anywhere" }}>{sb.t}</div>
                    {sb.i && <div style={{ fontSize: SZ.subDesc, color: C.muted, marginTop: 2, lineHeight: 1.4, wordBreak: "break-word", overflowWrap: "anywhere" }}>{sb.i}</div>}
                    {sbStarted && !sbDone && sb.tm > 0 && <div style={{marginTop:4}}><ProgressBar pct={sbPct} color={sbOver ? C.red : C.amber} h={large?4:3}/><div style={{fontSize:SZ.subTimer,fontWeight:700,marginTop:2,color:sbOver?C.red:C.amber}}>⏱ {Math.floor(sbEl/60)}m {sbEl%60}s{sbOver?<span style={{color:C.red}}> +{Math.floor((sbEl-sb.tm)/60)}m {(sbEl-sb.tm)%60}s over</span>:<span> — {Math.floor(sbRem/60)}m left</span>}</div></div>}
                    {sbDone && sbHasDoneEl && <div style={{fontSize:SZ.subHint,marginTop:2,color:sbWasOver?K.danger:K.ok,display:"inline-flex",alignItems:"center",gap:4}}><Icon name="check" size={11} strokeWidth={2.4}/>{Math.floor(sbDE/60)}m{sbDE%60>0?` ${sbDE%60}s`:""}{sbWasOver?<span style={{fontWeight:600}}> +{Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":"" }{sbDiffSec%60}s over</span>:<span style={{fontWeight:600}}> {Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":"" }{sbDiffSec%60}s under</span>}{d2d.manualAt?.[sbk]&&<span style={{color:C.muted,fontWeight:400}}> · {d2d.manualAt[sbk]}</span>}</div>}
                    {sbDone && !sbHasDoneEl && d2d.manualAt?.[sbk] && <div style={{fontSize:SZ.subHint,color:K.ok,marginTop:2,display:"inline-flex",alignItems:"center",gap:4}}><Icon name="check" size={11} strokeWidth={2.4}/>{d2d.manualAt[sbk]}</div>}
                    {!sbDone && !sbStarted && sb.tm > 0 && <div style={{fontSize:SZ.subHint,color:C.faint,marginTop:2}}>⏱ {sb.tm>=60?Math.floor(sb.tm/60)+"m":sb.tm+"s"}</div>}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {!sbDone && sbPrevD && !sbStarted && sb.tm > 0 && <button onClick={e => { e.stopPropagation(); clearMuteAlarm && clearMuteAlarm(subAlarmKey); setDsFn({ starts: { ...(d2d.starts || {}), [sbk]: Date.now() } }); }} style={{ padding: SZ.subBtn, borderRadius: SZ.subBtnR, background: `linear-gradient(135deg,#25543C,#1C3D2B)`, color: "#fff", border: "none", fontSize: SZ.subBtnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.subBtnH }}>▶ {Math.floor(sb.tm/60)}m</button>}
                    {!sbDone && sbPrevD && !sbStarted && !sb.tm && <button onClick={e => { e.stopPropagation(); const upd = { manual: { ...(d2d.manual || {}), [sbk]: true }, manualAt: { ...(d2d.manualAt || {}), [sbk]: fmtStamp() } }; if (sbi === subs.length - 1) { upd.doneElapsed = { ...(d2d.doneElapsed || {}), [stepKey]: d2d.starts?.[stepKey] ? Math.floor((Date.now() - d2d.starts[stepKey]) / 1000) : 0 }; } setDsFn(upd); }} style={{ padding: SZ.subBtn, borderRadius: SZ.subBtnR, background: "#1C3D2B", color: "#fff", border: "none", fontSize: SZ.subBtnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.subBtnH }}>✓ Done</button>}
                    {!sbDone && sbStarted && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); const el = d2d.starts?.[sbk] ? Math.floor((Date.now() - d2d.starts[sbk]) / 1000) : 0; const upd = { manual: { ...(d2d.manual || {}), [sbk]: true }, manualAt: { ...(d2d.manualAt || {}), [sbk]: fmtStamp() }, doneElapsed: { ...(d2d.doneElapsed || {}), [sbk]: el } }; if (sbi === subs.length - 1) { upd.doneElapsed[stepKey] = d2d.starts?.[stepKey] ? Math.floor((Date.now() - d2d.starts[stepKey]) / 1000) : 0; } setDsFn(upd); }} style={{ padding: SZ.subBtn, borderRadius: SZ.subBtnR, background: sbOver ? `linear-gradient(135deg,${C.red},#801818)` : C.green, color: "#fff", border: "none", fontSize: SZ.subBtnFt, fontWeight: 700, cursor: "pointer", minHeight: SZ.subBtnH }}>{sbOver ? "⚠" : "✓"} Done</button>
                        {/* Silence this sub-step’s overtime alarm (from origin/main). */}
                        {sbOver && <button onClick={e => { e.stopPropagation(); sbMuted ? clearMuteAlarm(subAlarmKey) : muteAlarm(subAlarmKey); }} onPointerDown={ripple} className="kh-rip" title={sbMuted ? T("Alarm silenced", lang) : T("Silence alarm", lang)} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", padding: SZ.subBtn, borderRadius: SZ.subBtnR, minHeight: SZ.subBtnH, cursor:"pointer", background: sbMuted ? K.surfaceAlt : K.warnBg, border: `1px solid ${sbMuted ? K.line : K.warnBorder}`, color: sbMuted ? K.textFaint : K.warn }}><Icon name="bell" size={13} strokeWidth={2}/></button>}
                      </div>
                    )}
                    
                    {sbDone && <button onClick={e=>{e.stopPropagation();setDsFn({manual:{...(d2d.manual||{}),[sbk]:false},starts:{...(d2d.starts||{}),[sbk]:null}});}} className="kh-undobtn" title={T("Undo", lang)} aria-label={T("Undo", lang)} style={{display:"flex",alignItems:"center",justifyContent:"center",width:large?28:24,height:large?28:24,padding:0,borderRadius:large?8:7,background:"transparent",border:`1px solid ${K.line}`,color:K.textFaint,cursor:"pointer"}}><Icon name="undo" size={large?13:12} strokeWidth={2}/></button>}
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

// StepRow is exported so Prep Day can render its steps with the same component
// rather than keeping a parallel copy that drifts out of step on styling, on
// the Undo key-shape fix, and on the overtime alarm.
export { EventDayTab, StepRow };
