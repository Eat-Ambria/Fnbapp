// Ambria FnB — Store & Inventory (reads live data from Ambria Ops Supabase)
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { C, OPS_IMG_BASE } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr, safeNum, TOMORROW, categorizeIngredientWithOverride, INGR_CATEGORY_ORDER, normIngName } from '../utils/helpers.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { Card, Btn, Chip, SectionHeader } from './SharedUI.jsx';
import { dbLoad, dbUpsert, dbDelete } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import { opsSupabase } from '../lib/opsSupabase.js';
import { getCatForDish, isFruitSelectionDish, RECIPE_DB, getIngrForDish, getIngrForYield, getBgDemandForDish, resolveDishStore } from '../data/recipeData.js';
import { hasPerm } from '../data/permissions.js';
import { K, type, tone } from '../utils/theme.js';
import { catMeta } from '../data/ingredientIcons.js';

const OPS_CACHE_KEY = "ambria_ops_catering_v1";

/* Venue → color mapping for stock bars */
const VENUE_COLORS = {
  AP: { bar: "#BA7517", bg: "#FAEEDA", text: "#854F0B", label: "AP" },
  AE: { bar: "#378ADD", bg: "#E6F1FB", text: "#0C447C", label: "AE" },
  AM: { bar: "#7F77DD", bg: "#EEEDFE", text: "#3C3489", label: "AM" },
};
function venueColor(code) { return VENUE_COLORS[code] || { bar: "#61708C", bg: "#F1EFE8", text: "#5F5E5A", label: code || "?" }; }

/* Category → dot color (stable per catCode) */
const CAT_DOT_COLORS = {
  GRO: "#BA7517", BEV: "#378ADD", SPI: "#D85A30", BAK: "#7F77DD",
  DAI: "#1D9E75", DRY: "#61708C", FRV: "#1D9E75", FRF: "#D4537E",
  EXO: "#D85A30", PMF: "#D64040", IMP: "#BA7517",
};
function catDotColor(catCode) { return CAT_DOT_COLORS[catCode] || "#61708C"; }

/* Transform raw Ops row into the shape our UI needs */
function transformOpsItem(it) {
  return {
    _opsId: it.id,
    _categoryId: it.category_id || null,
    id: "ops-" + it.id,
    inventoryId: it.inventory_id || "",
    name: it.name || "",
    h: it.name_hindi || "",
    cat: it.categories?.name || "Uncategorized",
    catCode: it.categories?.code || "",
    unit: it.unit || "Pieces",
    brand: it.brand || "",
    packSize: it.pack_size_qty ? (it.pack_size_qty + " " + (it.pack_size_unit || "")) : "",
    qty: +(it.qty || 0),
    blocked: 0,
    available: +(it.qty || 0),
    reorderQty: +(it.season_reorder_qty || it.off_season_reorder_qty || 0),
    imgPath: it.image_path || "",
    desc: it.description || "",
    venues: (it.cs_venue_allocations || []).map(va => ({
      qty: +(va.qty || 0),
      venueId: va.venue_id,
      venueCode: va.venues?.code || "",
      venueName: va.venues?.name || "",
    })).filter(v => v.qty > 0),
    rate: it.rate_paise != null ? +(it.rate_paise) / 100 : null,
    source: "store",
  };
}

/* Fetch all approved catering store items with joins */
async function fetchOpsCateringItems() {
  if (!opsSupabase) return [];
  const SELECT = "id,inventory_id,name,name_hindi,qty,unit,brand,pack_size_qty,pack_size_unit,category_id,rate_paise,season_reorder_qty,off_season_reorder_qty,image_path,description,status,categories(name,code),cs_venue_allocations(qty,venue_id,venues(code,name))";
  let all = [], from = 0, PAGE = 1000;
  while (true) {
    const { data, error } = await opsSupabase
      .from("catering_store_items")
      .select(SELECT)
      .eq("status", "approved")
      .order("name", { ascending: true })
      .range(from, from + PAGE - 1);
    // Throw, don't just log-and-break: a real query failure here (RLS
    // denial, a renamed/removed column or relationship, Ops project
    // unreachable...) used to silently resolve to whatever partial/empty
    // list had been gathered so far, which loadOps() then treated as a
    // CLEAN, successful sync — "0 items · Synced [time]" looked identical
    // whether Ops genuinely had 0 approved items or the query was failing
    // outright. Throwing lets loadOps()'s existing catch surface it.
    if (error) { console.error("Ops fetch error:", error); throw error; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all.map(transformOpsItem);
}

/* Transform raw Ops inventory_items row (equipment/crockery) into UI shape */
function transformOpsEquipment(it) {
  return {
    _opsId: it.id,
    id: "eq-" + it.id,
    inventoryId: it.inventory_id || "",
    name: it.name || "",
    h: it.name_hindi || "",
    cat: it.categories?.name || "Uncategorized",
    catCode: it.categories?.code || "",
    unit: it.unit || "Pieces",
    brand: "",
    packSize: "",
    qty: +(it.qty || 0),
    blocked: +(it.blocked || 0),
    available: Math.max(0, +(it.qty || 0) - +(it.blocked || 0)),
    reorderQty: +(it.reorder_qty || 0),
    imgPath: it.image_path || "",
    desc: it.description || "",
    venues: (it.venue_allocations || []).map(va => ({
      qty: +(va.qty || 0),
      venueId: va.venue_id,
      venueCode: va.venues?.code || "",
      venueName: va.venues?.name || "",
    })).filter(v => v.qty > 0),
    source: "equipment",
    assetType: it.type || "",
    isAsset: it.is_asset || "no",
  };
}

/* Fetch approved Catering equipment from inventory_items */
async function fetchOpsEquipmentItems() {
  if (!opsSupabase) return [];
  const SELECT = "id,inventory_id,name,name_hindi,qty,blocked,unit,category_id,type,is_asset,reorder_qty,image_path,description,status,categories(name,code),venue_allocations(qty,venue_id,venues(code,name))";
  let all = [], from = 0, PAGE = 1000;
  while (true) {
    const { data, error } = await opsSupabase
      .from("inventory_items")
      .select(SELECT)
      .eq("department", "Catering")
      .eq("status", "approved")
      .order("name", { ascending: true })
      .range(from, from + PAGE - 1);
    // See fetchOpsCateringItems' identical comment above — same fix.
    if (error) { console.error("Ops equipment fetch error:", error); throw error; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all.map(transformOpsEquipment);
}

// ═══ Ingredient duplicate-finder — same approach as DishLibrary.jsx's
// "Find duplicates", adapted to ingredient entries ({name, hindi, dishes}
// instead of {dish_name, hindi, packages}). Kept as a separate copy rather
// than importing DishLibrary's (unexported) helpers — small, pure, and this
// keeps StoreModule free of a cross-feature dependency for four functions. ══
// Same canonical unit list the SOP recipe editor (KitchenHub.jsx) offers,
// so "Edit unit" here can never write a unit the recipe editor wouldn't.
const ING_UNIT_CHOICES = ["kg","gm","L","ml","tsp","tbsp","pcs","slice","Bot","tin","bunch","dozen","Packets"];

function slugifyCat(name) {
  var s = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return s || "uncategorized";
}

function normalizeIngName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function tokenSetKeyIng(s) {
  var n = normalizeIngName(s);
  if (!n) return '';
  return n.split(' ').filter(Boolean).sort().join(' ');
}
function levenshteinIng(a, b) {
  if (a === b) return 0;
  var m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  var prev = new Array(n + 1);
  var curr = new Array(n + 1);
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    curr[0] = i;
    for (var jj = 1; jj <= n; jj++) {
      var cost = a.charCodeAt(i - 1) === b.charCodeAt(jj - 1) ? 0 : 1;
      curr[jj] = Math.min(curr[jj - 1] + 1, prev[jj] + 1, prev[jj - 1] + cost);
    }
    var tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n];
}
// Clusters ingredients by four signals, highest confidence first. Each
// ingredient appears in at most one cluster (first-hit wins).
function findIngredientDuplicateClusters(ingredients) {
  var clusters = [];
  var assigned = {}; // name -> true

  var byNorm = {};
  ingredients.forEach(function(d) {
    var k = normalizeIngName(d.name);
    if (!k) return;
    (byNorm[k] = byNorm[k] || []).push(d);
  });
  Object.keys(byNorm).forEach(function(k) {
    if (byNorm[k].length < 2) return;
    clusters.push({ reason: 'Same after normalization', confidence: 'high', items: byNorm[k].slice() });
    byNorm[k].forEach(function(d) { assigned[d.name] = true; });
  });

  var byTok = {};
  ingredients.forEach(function(d) {
    if (assigned[d.name]) return;
    var k = tokenSetKeyIng(d.name);
    if (!k) return;
    (byTok[k] = byTok[k] || []).push(d);
  });
  Object.keys(byTok).forEach(function(k) {
    if (byTok[k].length < 2) return;
    clusters.push({ reason: 'Same words, reordered', confidence: 'high', items: byTok[k].slice() });
    byTok[k].forEach(function(d) { assigned[d.name] = true; });
  });

  var byHi = {};
  ingredients.forEach(function(d) {
    if (assigned[d.name]) return;
    var h = String(d.hindi || '').trim().toLowerCase();
    if (!h) return;
    (byHi[h] = byHi[h] || []).push(d);
  });
  Object.keys(byHi).forEach(function(h) {
    if (byHi[h].length < 2) return;
    // Weak signal: different products often share a Hindi word (Amchur Powder /
    // Amchur Sabut, Garlic / Garlic Paste), so these go to Review, not High.
    clusters.push({ reason: 'Same Hindi (' + byHi[h][0].hindi + ')', confidence: 'medium', items: byHi[h].slice() });
    byHi[h].forEach(function(d) { assigned[d.name] = true; });
  });

  var byFirst = {};
  ingredients.forEach(function(d) {
    if (assigned[d.name]) return;
    var n = normalizeIngName(d.name);
    if (!n) return;
    var f = n[0];
    (byFirst[f] = byFirst[f] || []).push({ orig: d, norm: n });
  });
  Object.keys(byFirst).forEach(function(f) {
    var bucket = byFirst[f];
    for (var i = 0; i < bucket.length; i++) {
      if (assigned[bucket[i].orig.name]) continue;
      var group = [bucket[i].orig];
      for (var j = i + 1; j < bucket.length; j++) {
        if (assigned[bucket[j].orig.name]) continue;
        if (Math.abs(bucket[i].norm.length - bucket[j].norm.length) > 2) continue;
        var dist = levenshteinIng(bucket[i].norm, bucket[j].norm);
        if (dist > 0 && dist <= 2) group.push(bucket[j].orig);
      }
      if (group.length >= 2) {
        clusters.push({ reason: '1–2 letters apart', confidence: 'medium', items: group });
        group.forEach(function(d) { assigned[d.name] = true; });
      }
    }
  });

  return clusters;
}
// Default target = highest recipe-usage count, tie-broken alphabetically.
function pickDefaultIngTarget(cluster) {
  var sorted = cluster.items.slice().sort(function(a, b) {
    var au = (a.dishes || []).length;
    var bu = (b.dishes || []).length;
    if (au !== bu) return bu - au;
    return a.name.localeCompare(b.name);
  });
  return sorted[0].name;
}

// Unit picker — a themed pop-over in place of the browser's plain <select>.
// The units this group actually uses come first ("In this group"), the full
// list sits under them as a grid, so the likely choice is one tap away.
const UNIT_LABELS = { gm:"grams", kg:"kilograms", L:"litres", ml:"millilitres", pcs:"pieces", tsp:"teaspoon", tbsp:"tablespoon", slice:"slice", Bot:"bottle", tin:"tin", bunch:"bunch", dozen:"dozen", Packets:"packets" };
function UnitPicker({ value, onChange, suggested, options, disabled, T2 }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const sugg = Array.from(new Set((suggested || []).filter(Boolean)));
  const rest = (options || []).filter(u => !sugg.includes(u));
  const chip = (u, big) => {
    const on = u === value;
    return (
      <button key={u} type="button" onClick={() => { onChange(u); setOpen(false); }} title={T2(UNIT_LABELS[u] || u)}
        className={on ? undefined : "kh-calnav"}
        style={{ padding: big ? "8px 12px" : "6px 0", borderRadius: 10, fontSize: big ? 13 : 12.5, fontWeight: on ? 700 : 600, cursor: "pointer", fontFamily: K.fontBody,
          background: on ? K.brand : "#FFFFFF", color: on ? "#FFFFFF" : K.textBody, border: `1px solid ${on ? K.brand : K.cardWarmLine}`,
          display: "flex", flexDirection: big ? "column" : "row", alignItems: big ? "flex-start" : "center", justifyContent: "center", gap: 1, minWidth: big ? 74 : 0 }}>
        <span>{u}</span>
        {big && <span style={{ fontSize: 10.5, fontWeight: 500, opacity: on ? .85 : .7 }}>{T2(UNIT_LABELS[u] || "")}</span>}
      </button>
    );
  };
  return (
    <div ref={ref} style={{ position: "relative", fontFamily: K.fontBody }}>
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, minWidth: 92, justifyContent: "space-between",
          border: `1px solid ${open ? K.brand : K.cardWarmLine}`, background: "#FFFFFF", color: K.hdrTitle, fontSize: 13, fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .6 : 1 }}>
        {value || "—"}<span style={{ color: K.textFaint, fontSize: 10, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
      </button>
      {open && (
        <div role="listbox" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 60, width: 276, padding: 12, borderRadius: 16,
          background: K.cardWarm, border: `1px solid ${K.cardWarmLine}`, boxShadow: K.shadowLift }}>
          {sugg.length > 0 && (<>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: K.hdrMeta, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{T2("In this group")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{sugg.map(u => chip(u, true))}</div>
          </>)}
          <div style={{ fontSize: 10.5, fontWeight: 700, color: K.hdrMeta, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{T2("All units")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>{rest.map(u => chip(u, false))}</div>
        </div>
      )}
    </div>
  );
}

// Day picker for the Day Sheet header — replaces the browser's native date
// popup, which can't be styled and looked nothing like the rest of the app.
// Dates are built from local year/month/day (not a UTC ISO string — that shifts the day in IST).
// Days that have a function get a dot, so the next busy day is easy to find.
function DayPicker({ value, onChange, markDates, T2 }) {
  const pad = n => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const [open, setOpen] = useState(false);
  const base = value ? value.split("-").map(Number) : null;
  const [vy, setVy] = useState(base ? base[0] : new Date().getFullYear());
  const [vm, setVm] = useState(base ? base[1] - 1 : new Date().getMonth());
  const wrapRef = React.useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    if (base) { setVy(base[0]); setVm(base[1] - 1); }
    const onDoc = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const MO = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DY = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const first = new Date(vy, vm, 1).getDay();
  const dim = new Date(vy, vm + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const step = dir => { let m = vm + dir, y = vy; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setVm(m); setVy(y); };
  const label = value ? (() => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); })() : T2("Pick a date");
  const navBtn = { width: 30, height: 30, borderRadius: 999, border: `1px solid ${K.cardWarmLine}`, background: "#FFFFFF", color: K.textBody, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, lineHeight: 1, padding: 0 };
  return (
    <div ref={wrapRef} style={{ position: "relative", fontFamily: K.fontBody }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, border: `1px solid ${open ? K.brand : K.cardWarmLine}`, background: "#FFFFFF", color: K.hdrTitle, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
        <span style={{ fontSize: 14 }}>📅</span>{label}<span style={{ color: K.textFaint, fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div role="dialog" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 950, width: 296, padding: 14, borderRadius: 18,
          background: K.cardWarm, border: `1px solid ${K.cardWarmLine}`, boxShadow: K.shadowLift }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button type="button" onClick={() => step(-1)} aria-label={T2("Previous month")} style={navBtn}>‹</button>
            <div style={{ flex: 1, textAlign: "center", ...type.cardTitle, fontSize: 15, color: K.hdrTitle }}>{T2(MO[vm])} {vy}</div>
            <button type="button" onClick={() => step(1)} aria-label={T2("Next month")} style={navBtn}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
            {DY.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: K.hdrMeta, padding: "4px 0" }}>{T2(d)}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              if (d == null) return <div key={i} />;
              const ds = ymd(vy, vm, d);
              const isSel = ds === value, isToday = ds === TODAY, has = markDates && markDates.has(ds);
              return (
                <button key={i} type="button" onClick={() => { onChange(ds); setOpen(false); }}
                  className={isSel ? undefined : "kh-calnav"}
                  style={{ position: "relative", height: 36, borderRadius: 10, cursor: "pointer", fontSize: 13, fontVariantNumeric: "tabular-nums",
                    fontWeight: isSel || isToday ? 700 : 500, padding: 0,
                    background: isSel ? K.brand : isToday ? "#F6EFDD" : "transparent",
                    color: isSel ? "#FFFFFF" : isToday ? K.gold : K.textBody,
                    border: `1px solid ${isSel ? K.brand : isToday ? K.goldSoft : "transparent"}` }}>
                  {d}
                  {has && <span style={{ position: "absolute", left: "50%", bottom: 4, transform: "translateX(-50%)", width: 5, height: 5, borderRadius: "50%", background: isSel ? "#FFFFFF" : K.brand }} />}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${K.cardWarmLine}` }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: K.hdrMeta }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: K.brand }} />{T2("has functions")}
            </span>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => { onChange(TODAY); setOpen(false); }}
              style={{ padding: "6px 14px", borderRadius: 999, border: "none", background: K.brand, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{T2("Today")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreModule({events, lang="en", currentUser=null}) {
  const T2 = s => T(s, lang||"en");
  const safeEvs = (Array.isArray(events)?events:[]).filter(e=>e&&e.date);

  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [tab,      setTab]      = useState("inventory");
  const [catFil,   setCatFil]   = useState("All");
  const [venueFil, setVenueFil] = useState("All");
  const [stockFil, setStockFil] = useState("all");
  const [sourceFil, setSourceFil] = useState("all"); // "all" | "store" | "equipment"
  const [search,   setSearch]   = useState("");
  const [showAdd,  setShowAdd]  = useState(false);
  const [editStock,setEditStock]=useState(null);
  const [editVal,  setEditVal]  =useState("");
  const [reqDay, setReqDay] = useState(TODAY); // Requirements tab's day picker — TODAY | TOMORROW
  const [reqCatClosed, setReqCatClosed] = useState({}); // {[categoryKey]: true} — collapsed category groups in the Day Sheet table
  const [reqNote, setReqNote] = useState(null); // {tone:"ok"|"err", text} — result line in the station modal
  const [reqShowAll, setReqShowAll] = useState(false); // Day Sheet: the full ingredient table is folded under the station cards
  const [reqListAllAsk, setReqListAllAsk] = useState(false); // in-app confirm for "+ All" (order list)
  const [reqIssueAllAsk, setReqIssueAllAsk] = useState(false); // in-app confirm for "issue all" in the station modal
  const [reqStation, setReqStation] = useState(null); // station id whose ingredient list is open in the Day Sheet modal
  const [issueQtyModal, setIssueQtyModal] = useState(null); // {row,agg,stock,isDiscrete,value} — custom/partial issue-quantity dialog
  const [transferRequests, setTransferRequests] = useState([]); // rows from store_transfer_requests
  const [transferModal, setTransferModal] = useState(null); // {row,stock,toVenue,donors,value,fromVenueId}
  const [transferListOpen, setTransferListOpen] = useState(false); // list/manage modal for open requests
  const [printReq, setPrintReq] = useState(null); // null | {mode:"all"} | {mode:"one", key} — Order Lists print preview
  const [orderListItems, setOrderListItems] = useState([]); // rows from store_order_lists
  const [orderListLoading, setOrderListLoading] = useState(false);
  const [issueAssignments, setIssueAssignments] = useState({}); // {[event_id+"::"+section_name]: venue_code}
  const [issueRecords, setIssueRecords] = useState({}); // {[event_id+"::"+section+"::"+ingredient]: {issued,qty_issued,...}}
  const [issueLoading, setIssueLoading] = useState(false);
  const [ingredientMap, setIngredientMap] = useState({}); // {ingredient_name: {ops_item_id, ops_inventory_id, ops_item_name, ops_item_unit, unit_conversion, category_override}}
  // Same override map the Ordering Sheet reads (KitchenHub.jsx) — this one's
  // free, ingredientMap above already pulls category_override via select('*').
  // Keyed by normIngName since ingredient_name here often carries the Hindi
  // name appended ("Chaat Masala चाट मसाला") while categorizeIngredient()
  // is given the plain English name.
  const ingrCatOverrides = useMemo(() => {
    const m = {};
    Object.values(ingredientMap).forEach(row => { if (row.category_override) m[normIngName(row.ingredient_name)] = row.category_override; });
    return m;
  }, [ingredientMap]);
  async function saveIngredientCategory(ingName, category) {
    // Only ingredient_name + category_override in the write — ing.name here
    // is already the exact key an existing ops-mapped row uses (isMapped
    // above relies on that same exact match), so this never needs to touch
    // ingredient_hindi or any ops_* column on that row.
    setIngredientMap(prev => ({ ...prev, [ingName]: { ...(prev[ingName] || { ingredient_name: ingName }), category_override: category || null } }));
    const { error } = await supabase.from('ingredient_item_map').upsert(
      { ingredient_name: ingName, category_override: category || null },
      { onConflict: 'ingredient_name' }
    );
    if (error) console.error('[StoreModule] saveIngredientCategory failed:', error);
  }
  const [fruitSelections, setFruitSelections] = useState([]); // rows from event_fruit_selections — per-function fruit-counter picks made in Fruits Ops
  const [mapModalIng, setMapModalIng] = useState(null); // {name,hindi,unit} — currently mapping this ingredient
  const [recipesModalIng, setRecipesModalIng] = useState(null); // {name,hindi,unit,dishes:[]} — showing which recipes use this ingredient
  const [mapSearch, setMapSearch] = useState("");
  const [mapTabFilter, setMapTabFilter] = useState("unmapped"); // "all" | "mapped" | "unmapped"
  const [mapTabSearch, setMapTabSearch] = useState("");
  const [mapTabPage, setMapTabPage] = useState(0); // pagination offset
  
  const [convModal, setConvModal] = useState(null); // {ingName, ingHindi, opsItem, recipeUnit, storeUnit, convValue, editMode}
  const [ingSelected, setIngSelected] = useState({}); // {ingredientName: true} — Ingredient Map merge selection
  const [ingMergeModal, setIngMergeModal] = useState(null); // {sources:[name,...], target, unit} | null
  const [ingMerging, setIngMerging] = useState(false);
  const [ingRefreshTick, setIngRefreshTick] = useState(0); // bumped after a merge/unit edit to re-derive allRecipeIngredients from the now-mutated RECIPE_DB
  // ingDedupTargets/Units/Skipped/Resolved are keyed by a stable cluster
  // identity (ingClusterKey — the sorted ingredient names in it), not by
  // array index — findIngredientDuplicateClusters() re-runs from scratch on
  // every open, and a cluster skipped or merged earlier can land at a
  // different index next time (a merge removes entries, shifting everything
  // after it), which would silently apply old decisions to the wrong group.
  // Skipped/resolved are also persisted to localStorage (same fix as
  // DishLibrary.jsx's dedup modal) since this screen only mounts while its
  // own tab is open, and a tab switch or reload would otherwise wipe plain
  // useState clean and bring skipped groups right back.
  const ING_DEDUP_LS_KEY = 'ambria_ing_dedup_decisions';
  function loadIngDedupDecisions() {
    try {
      const raw = JSON.parse(localStorage.getItem(ING_DEDUP_LS_KEY) || '{}');
      return { skipped: raw.skipped || {}, resolved: raw.resolved || {} };
    } catch (e) { return { skipped: {}, resolved: {} }; }
  }
  function saveIngDedupDecisions(skipped, resolved) {
    try { localStorage.setItem(ING_DEDUP_LS_KEY, JSON.stringify({ skipped, resolved })); } catch (e) {}
  }
  function ingClusterKey(c) { return (c.items || []).map(d => d.name).slice().sort().join('|'); }
  const [ingDedupOpen, setIngDedupOpen] = useState(false);
  const [ingDedupClusters, setIngDedupClusters] = useState([]);
  const [ingDedupTargets, setIngDedupTargets] = useState({});   // {clusterKey: name}
  const [ingDedupUnits, setIngDedupUnits] = useState({});       // {clusterKey: unit}
  const [ingDedupSkipped, setIngDedupSkipped] = useState(() => loadIngDedupDecisions().skipped);   // {clusterKey: true}
  const [ingDedupResolved, setIngDedupResolved] = useState(() => loadIngDedupDecisions().resolved); // {clusterKey: 'merged'}
  useEffect(() => { saveIngDedupDecisions(ingDedupSkipped, ingDedupResolved); }, [ingDedupSkipped, ingDedupResolved]);
  const [ingDedupSavingIdx, setIngDedupSavingIdx] = useState(null);
  const [ingDedupTab, setIngDedupTab] = useState(null);       // 'high' | 'medium' — null = first non-empty
  const [ingDedupConfirm, setIngDedupConfirm] = useState(null); // idx whose merge is waiting for "Yes, merge"
  const [ingDedupHoverKey, setIngDedupHoverKey] = useState(null); // "idx::name" of the "N recipes" label currently hovered — shows which recipes use it
  const [newItem,  setNewItem]  =useState({name:"",barcode:"",brand:"",supplier:"",cat:"Dry Goods",unit:"pcs",inStock:0,minStock:10,perPax:0,location:"Store A"});
  const [addingItem, setAddingItem] = useState(false);

  

  /* ── Load from Ops Supabase + subscribe to realtime changes ── */
  useEffect(() => {
    let sub = null;
    let sub2 = null;

    async function loadOps() {
      setLoading(true); setLoadError("");
      // 1. Show cached data instantly
      try {
        const c = localStorage.getItem(OPS_CACHE_KEY);
        if (c) { const p = JSON.parse(c); if (p.data?.length) setItems(p.data); }
      } catch(e){}
      // fetchOpsCateringItems/fetchOpsEquipmentItems both silently return []
      // when opsSupabase is null — with no VITE_OPS_SUPABASE_URL/_ANON_KEY
      // configured at build time, that [] + a successful setLastSync() looks
      // EXACTLY like a real sync that genuinely found 0 items, with nothing
      // in the UI to tell the two apart. Surface it explicitly instead.
      if (!opsSupabase) {
        setLoadError("Inventory system not connected — VITE_OPS_SUPABASE_URL/VITE_OPS_SUPABASE_ANON_KEY missing from this build.");
        setLoading(false);
        return;
      }
      // 2. Fetch fresh from Ops (store consumables + equipment)
      try {
        const [storeItems, equipItems] = await Promise.all([
          fetchOpsCateringItems(),
          fetchOpsEquipmentItems(),
        ]);
        const fresh = [...storeItems, ...equipItems];
        setItems(fresh);
        setLastSync(new Date());
        try { localStorage.setItem(OPS_CACHE_KEY, JSON.stringify({ data: fresh, _ts: Date.now() })); } catch(e){}
      } catch(err) {
        console.error("Ops load failed:", err);
        setLoadError("Could not reach inventory system. Showing cached data.");
      } finally {
        setLoading(false);
      }
    }

    loadOps();

    // 3. Realtime subscription for live updates
    if (opsSupabase) {
      sub = opsSupabase
        .channel("cs-items-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "catering_store_items" }, (payload) => {
          if (payload.eventType === "DELETE") {
            setItems(prev => prev.filter(i => i._opsId !== payload.old.id));
          } else {
            // INSERT or UPDATE — re-fetch this single item with joins
            opsSupabase
              .from("catering_store_items")
              .select("id,inventory_id,name,name_hindi,qty,blocked,unit,brand,pack_size_qty,pack_size_unit,category_id,rate_paise,min_order_qty,reorder_qty,image_path,description,categories(name,code),cs_venue_allocations(qty,venue_id,venues(code,name))")
              .eq("id", payload.new.id)
              .single()
              .then(({ data }) => {
                if (!data) return;
                const item = transformOpsItem(data);
                setItems(prev => {
                  const idx = prev.findIndex(i => i._opsId === data.id);
                  if (idx >= 0) { const next = [...prev]; next[idx] = item; return next; }
                  return [...prev, item];
                });
              });
          }
        })
        .subscribe();

      // Also subscribe to inventory_items changes (equipment)
      sub2 = opsSupabase
        .channel("inv-items-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items", filter: "department=eq.Catering" }, (payload) => {
          if (payload.eventType === "DELETE") {
            setItems(prev => prev.filter(i => !(i.source === "equipment" && i._opsId === payload.old.id)));
          } else {
            opsSupabase
              .from("inventory_items")
              .select("id,inventory_id,name,name_hindi,qty,blocked,unit,category_id,type,is_asset,reorder_qty,image_path,description,status,categories(name,code),venue_allocations(qty,venue_id,venues(code,name))")
              .eq("id", payload.new.id)
              .single()
              .then(({ data }) => {
                if (!data || data.department !== "Catering") return;
                const item = transformOpsEquipment(data);
                setItems(prev => {
                  const idx = prev.findIndex(i => i.source === "equipment" && i._opsId === data.id);
                  if (idx >= 0) { const next = [...prev]; next[idx] = item; return next; }
                  return [...prev, item];
                });
              });
          }
        })
        .subscribe();
    }

    return () => {
      if (sub) opsSupabase.removeChannel(sub);
      if (sub2) opsSupabase.removeChannel(sub2);
    };
  }, []);

  /* ── Load Smart Issue state from FnB Supabase ── */
  useEffect(() => {
    if (!supabase) return;
    let subs = [];
    async function loadIssueState() {
      setIssueLoading(true);
      try {
        // Each table on its own: one failing fetch used to reject the whole
        // Promise.all, leaving ingredient_item_map empty — every Day Sheet
        // row then read "no stock" and fell into Uncategorized.
        const soft = (label, p) => p.catch(e => { console.error("Issue state: " + label + " failed:", e); return null; });
        const [aData, iData, mData, fData] = await Promise.all([
          soft('store_issue_assignments', fetchAllRows(() => supabase.from('store_issue_assignments').select('*'))),
          soft('store_issues', fetchAllRows(() => supabase.from('store_issues').select('*'))),
          soft('ingredient_item_map', fetchAllRows(() => supabase.from('ingredient_item_map').select('*'))),
          soft('event_fruit_selections', fetchAllRows(() => supabase.from('event_fruit_selections').select('*'))),
        ]);
        const aRes = { data: aData }, iRes = { data: iData }, mRes = { data: mData };
        setFruitSelections(fData || []);
        if (aRes.data) {
          const map = {};
          aRes.data.forEach(r => { map[r.event_id + "::" + r.section_name] = r.venue_code; });
          setIssueAssignments(map);
        }
        if (iRes.data) {
          const map = {};
          iRes.data.forEach(r => { map[r.event_id + "::" + r.section_name + "::" + r.ingredient_name] = r; });
          setIssueRecords(map);
        }
        if (mRes.data) {
          const map = {};
          mRes.data.forEach(r => { map[r.ingredient_name] = r; });
          setIngredientMap(map);
        }
      } catch (e) { console.error("Issue state load failed:", e); }
      setIssueLoading(false);
    }
    loadIssueState();


    // Realtime subscriptions
    const ch1 = supabase.channel('sia-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'store_issue_assignments' }, (p) => {
      if (p.eventType === 'DELETE') {
        setIssueAssignments(prev => { const n = { ...prev }; delete n[p.old.event_id + "::" + p.old.section_name]; return n; });
      } else {
        const r = p.new;
        setIssueAssignments(prev => ({ ...prev, [r.event_id + "::" + r.section_name]: r.venue_code }));
      }
    }).subscribe();
    const ch2 = supabase.channel('si-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'store_issues' }, (p) => {
      if (p.eventType === 'DELETE') {
        setIssueRecords(prev => { const n = { ...prev }; delete n[p.old.event_id + "::" + p.old.section_name + "::" + p.old.ingredient_name]; return n; });
      } else {
        const r = p.new;
        setIssueRecords(prev => ({ ...prev, [r.event_id + "::" + r.section_name + "::" + r.ingredient_name]: r }));
      }
    }).subscribe();
    const ch3 = supabase.channel('iim-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'ingredient_item_map' }, (p) => {
      if (p.eventType === 'DELETE') {
        setIngredientMap(prev => { const n = { ...prev }; delete n[p.old.ingredient_name]; return n; });
      } else {
        const r = p.new;
        setIngredientMap(prev => ({ ...prev, [r.ingredient_name]: r }));
      }
    }).subscribe();
    // RECIPE_DB is a plain mutable object, not React state — a recipe edited
    // anywhere (KitchenHub's SOP editor, another device/user) mutates it
    // in place with no re-render signal to this component, so "606/752
    // linked" and Find Duplicates would only ever pick it up after a full
    // reload. Patch RECIPE_DB from the live row here and bump ingRefreshTick
    // so this screen recomputes immediately, same-session or not.
    const ch4 = supabase.channel('recipes-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, (p) => {
      try {
        if (p.eventType === 'DELETE') {
          const oldId = p.old && p.old.id;
          Object.keys(RECIPE_DB.recipes || {}).forEach(catId => {
            RECIPE_DB.recipes[catId] = (RECIPE_DB.recipes[catId] || []).filter(r => r.id !== oldId);
          });
        } else {
          const r = p.new;
          if (!r) return;
          const row = {
            id: r.id,
            n: r.dish_name,
            n_hi: r.dish_name_hi || '',
            sub: r.sub || '',
            steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
            ingredients: r.ingredients && typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : (r.ingredients || null),
            yield: r.yield && typeof r.yield === 'string' ? JSON.parse(r.yield) : (r.yield || null),
            bg: !!r.bg,
          };
          const catId = String(r.category_id);
          // Drop from any other category first, in case this was a category move
          Object.keys(RECIPE_DB.recipes || {}).forEach(cid => {
            if (cid !== catId) RECIPE_DB.recipes[cid] = (RECIPE_DB.recipes[cid] || []).filter(x => x.id !== r.id);
          });
          if (!RECIPE_DB.recipes[catId]) RECIPE_DB.recipes[catId] = [];
          const list = RECIPE_DB.recipes[catId];
          const idx = list.findIndex(x => x.id === r.id);
          if (idx >= 0) list[idx] = row; else list.push(row);
        }
        setIngRefreshTick(t => t + 1);
      } catch (e) { console.error("Recipe realtime patch failed:", e); }
    }).subscribe();
    subs = [ch1, ch2, ch3, ch4];

    return () => {
      subs.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);

  /* ── Load Order Lists (Requirements tab "Add to Order list") + subscribe ── */
  useEffect(() => {
    if (!supabase) return;
    async function loadOrderLists() {
      setOrderListLoading(true);
      try {
        const rows = await fetchAllRows(() => supabase.from('store_order_lists').select('*'));
        setOrderListItems(rows || []);
      } catch (e) { console.error("Order lists load failed:", e); }
      setOrderListLoading(false);
    }
    loadOrderLists();
    const ch = supabase.channel('sol-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'store_order_lists' }, (p) => {
      if (p.eventType === 'DELETE') {
        setOrderListItems(prev => prev.filter(r => !(r.order_date === p.old.order_date && r.ingredient_name === p.old.ingredient_name)));
      } else {
        const r = p.new;
        setOrderListItems(prev => {
          const idx = prev.findIndex(x => x.order_date === r.order_date && x.ingredient_name === r.ingredient_name);
          if (idx >= 0) { const n = [...prev]; n[idx] = r; return n; }
          return [...prev, r];
        });
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* ── Load cross-venue transfer requests + subscribe ── */
  useEffect(() => {
    if (!supabase) return;
    async function loadTransferRequests() {
      try {
        const rows = await fetchAllRows(() => supabase.from('store_transfer_requests').select('*').order('requested_at', { ascending: false }));
        setTransferRequests(rows || []);
      } catch (e) { console.error("Transfer requests load failed:", e); }
    }
    loadTransferRequests();
    const ch = supabase.channel('str-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'store_transfer_requests' }, (p) => {
      if (p.eventType === 'DELETE') {
        setTransferRequests(prev => prev.filter(r => r.id !== p.old.id));
      } else {
        const r = p.new;
        setTransferRequests(prev => {
          const idx = prev.findIndex(x => x.id === r.id);
          if (idx >= 0) { const n = [...prev]; n[idx] = r; return n; }
          return [r, ...prev];
        });
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* ── Smart Issue helpers ── */
  const VENUE_CODES = ["AP", "AE", "AM", "AR"];

  function fmtIssueQty(q, u) {
    if (u === "g" && q >= 1000) return (q / 1000).toFixed(1) + " kg";
    if (u === "ml" && q >= 1000) return (q / 1000).toFixed(1) + " L";
    return Math.round(q) + " " + u;
  }

  async function toggleIssueItem(eventId, sec, ing, currentlyIssued) {
    const key = eventId + "::" + sec + "::" + ing.name;
    const now = new Date().toISOString();
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const rec = {
      event_id: eventId,
      section_name: sec,
      ingredient_name: ing.name,
      ingredient_hindi: ing.hindi || null,
      unit: ing.unit,
      qty_required: ing.totalQty,
      qty_issued: currentlyIssued ? 0 : ing.totalQty,
      issued: !currentlyIssued,
      issued_by: currentlyIssued ? null : staffId,
      issued_at: currentlyIssued ? null : now,
    };
    // Optimistic update
    setIssueRecords(prev => ({ ...prev, [key]: { ...prev[key], ...rec } }));
    // Persist
    const { error } = await supabase.from('store_issues').upsert(rec, { onConflict: 'event_id,section_name,ingredient_name' });
    if (error) console.error("Issue toggle failed:", error);
  }

  async function issueAllForSection(eventId, sec, ingList) {
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const now = new Date().toISOString();
    const rows = ingList.map(ing => ({
      event_id: eventId,
      section_name: sec,
      ingredient_name: ing.name,
      ingredient_hindi: ing.hindi || null,
      unit: ing.unit,
      qty_required: ing.totalQty,
      qty_issued: ing.totalQty,
      issued: true,
      issued_by: staffId,
      issued_at: now,
    }));
    // Optimistic
    const upd = {};
    rows.forEach(r => { upd[r.event_id + "::" + r.section_name + "::" + r.ingredient_name] = r; });
    setIssueRecords(prev => ({ ...prev, ...upd }));
    const { error } = await supabase.from('store_issues').upsert(rows, { onConflict: 'event_id,section_name,ingredient_name' });
    if (error) console.error("Issue all failed:", error);
  }

  async function setVenueAssignment(eventId, sec, venueCode) {
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    setIssueAssignments(prev => ({ ...prev, [eventId + "::" + sec]: venueCode }));
    const { error } = await supabase.from('store_issue_assignments').upsert(
      { event_id: eventId, section_name: sec, venue_code: venueCode, assigned_by: staffId },
      { onConflict: 'event_id,section_name' }
    );
    if (error) console.error("Assignment save failed:", error);
  }

  /* ── Partial/pack-aware issuing ──────────────────────────────────────────
     A Day Sheet row can be short of its OWN unit without being short of
     stock: Ajinomoto needed in grams but only stockable in whole 500g
     packets can't be issued down to the gram, and Beans needed in one go
     may genuinely be handed out across two separate visits (2kg on Prep
     Day, the remaining 3kg on Event Day). Both are the same underlying
     need — issuing a chosen quantity now, short of or over the full
     requirement, and remembering what's left — so one mechanism covers
     both instead of the old all-or-nothing toggle. store_issues' existing
     qty_required/qty_issued columns already support this; only how this
     file WRITES qty_issued changes (additive, not always-the-full-amount). */
  function stockForRow(row) {
    const isDirectInv = row._type === 'inv' && !!row.ops_inventory_id;
    return isDirectInv ? getStockByInventoryId(row.ops_inventory_id) : getStockForIngredient(row.name);
  }
  // Recipe qty (in `unit`) -> store units of `stock`. Mirrors the Day
  // Sheet's own 3-tier chain (grams, then ml, then a configured conversion
  // factor) so "required" and "how much to issue" never drift apart.
  function qtyToStoreUnits(qty, unit, stock) {
    const recG = toGrams(qty, unit), stoG = toGrams(1, stock.unit);
    if (recG != null && stoG != null) return recG / stoG;
    const recM = toMl(qty, unit), stoM = toMl(1, stock.unit);
    if (recM != null && stoM != null) return recM / stoM;
    const oF = getUnitFamily(unit), aF = getUnitFamily(stock.unit);
    const adj = (oF && aF && oF.family === aF.family) ? (aF.toBase / oF.toBase) : 1;
    return qty * adj * (stock.conversion || 1);
  }
  // Inverse of qtyToStoreUnits — store units back to `unit`.
  function storeUnitsToQty(suQty, stock, unit) {
    const stoG = toGrams(1, stock.unit), recGPerUnit = toGrams(1, unit);
    if (stoG != null && recGPerUnit != null) return (suQty * stoG) / recGPerUnit;
    const stoM = toMl(1, stock.unit), recMPerUnit = toMl(1, unit);
    if (stoM != null && recMPerUnit != null) return (suQty * stoM) / recMPerUnit;
    const oF = getUnitFamily(unit), aF = getUnitFamily(stock.unit);
    const adj = (oF && aF && oF.family === aF.family) ? (aF.toBase / oF.toBase) : 1;
    return suQty / ((adj || 1) * (stock.conversion || 1));
  }
  // A store unit is "discrete" (whole packets/bottles/tins — can't be
  // issued down to a fraction) whenever it isn't the same weight/volume
  // family as the recipe's own unit. kg stock for a kg requirement is
  // freely divisible; "Packets" stock for a gram requirement is not.
  function isDiscreteStockUnit(row, stock) {
    const rf = getUnitFamily(row.unit), sf = getUnitFamily(stock.unit);
    return !(rf && sf && rf.family === sf.family);
  }
  function convQty(qty, fromU, toU) {
    if (String(fromU || "").toLowerCase() === String(toU || "").toLowerCase()) return qty;
    const fg = toGrams(qty, fromU), tgu = toGrams(1, toU);
    if (fg != null && tgu != null) return fg / tgu;
    const fm = toMl(qty, fromU), tmu = toMl(1, toU);
    if (fm != null && tmu != null) return fm / tmu;
    return qty;
  }
  // Cumulative issued-vs-required for a row, summed across every event/
  // section that contributes to it (converted to the row's own unit —
  // each store_issues record keeps the unit it was issued in).
  function rowIssueAgg(row) {
    let issuedQty = 0;
    (row.evBreak || []).forEach(b => {
      const r = issueRecords[b.evId + "::" + b.sec + "::" + row.name];
      if (r && r.qty_issued) issuedQty += convQty(+r.qty_issued, r.unit || b.unit, row.unit);
    });
    const required = row.total;
    return { required, issuedQty, remaining: Math.max(0, required - issuedQty), surplus: Math.max(0, issuedQty - required) };
  }
  function roundSmart(n) { return Math.round((+n || 0) * 100) / 100; }
  // The one-click default: the exact remaining amount for a freely-divisible
  // unit, or the nearest whole pack (rounded UP, never short-changing the
  // kitchen) for a discrete one.
  function suggestedIssueQty(row) {
    const agg = rowIssueAgg(row);
    const stock = stockForRow(row);
    let suggested = agg.remaining, isDiscrete = false;
    if (stock) {
      isDiscrete = isDiscreteStockUnit(row, stock);
      if (isDiscrete && agg.remaining > 1e-9) {
        const remSU = qtyToStoreUnits(agg.remaining, row.unit, stock);
        const wholeSU = Math.max(1, Math.ceil(remSU - 1e-9));
        suggested = storeUnitsToQty(wholeSU, stock, row.unit);
      }
    }
    return { agg, stock, isDiscrete, suggested };
  }
  // Writes an issued amount (in row.unit) against a row, spread across its
  // contributing event/section records in proportion to each one's own
  // share of the requirement (the common case — one event — gets the
  // whole amount). Additive: repeatable for partial issuing over time.
  async function commitIssueQty(row, amountInRowUnit) {
    if (!(amountInRowUnit > 0) || !row.evBreak || row.evBreak.length === 0) return;
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const now = new Date().toISOString();
    const updates = row.evBreak.map(b => {
      const share = row.total > 0 ? (convQty(b.qty, b.unit, row.unit) / row.total) : (1 / row.evBreak.length);
      const addQty = amountInRowUnit * share;
      const addInBUnit = convQty(addQty, row.unit, b.unit);
      const existing = issueRecords[b.evId + "::" + b.sec + "::" + row.name];
      const prevIssued = existing ? (+existing.qty_issued || 0) : 0;
      const newIssued = prevIssued + addInBUnit;
      return {
        event_id: b.evId, section_name: b.sec, ingredient_name: row.name,
        ingredient_hindi: row.hindi || null, unit: b.unit,
        qty_required: b.qty, qty_issued: newIssued,
        issued: newIssued >= b.qty - 1e-6,
        issued_by: staffId, issued_at: now,
      };
    });
    setIssueRecords(prev => {
      const n = { ...prev };
      updates.forEach(u => { n[u.event_id + "::" + u.section_name + "::" + u.ingredient_name] = { ...n[u.event_id + "::" + u.section_name + "::" + u.ingredient_name], ...u }; });
      return n;
    });
    const { error } = await supabase.from('store_issues').upsert(updates, { onConflict: 'event_id,section_name,ingredient_name' });
    if (error) console.error("Partial issue failed:", error);
  }
  async function quickIssue(row) {
    const { agg, suggested } = suggestedIssueQty(row);
    if (agg.remaining <= 1e-9 || !(suggested > 0)) return;
    await commitIssueQty(row, suggested);
  }
  function openIssueQty(row) {
    const { agg, stock, isDiscrete, suggested } = suggestedIssueQty(row);
    setIssueQtyModal({ row, agg, stock, isDiscrete, value: agg.remaining > 1e-9 ? String(roundSmart(suggested)) : "" });
  }

  /* ── Cross-venue transfer requests ─────────────────────────────────────
     Ambria runs ONE pooled ops item per ingredient but a SEPARATE physical
     store per venue (cs_venue_allocations). The Day Sheet's "Stock" column
     already shows the pooled total, which can look fine even when the one
     venue a function is actually AT is short — the other venues' allocation
     is sitting at a different building. Break each row's requirement down
     by the event's own venue and flag that specific shortfall, with a quick
     way to log "please send some from venue X" for the other venue's store
     to see and action (this never moves stock itself — a person does). */
  // Venue names are spelled inconsistently app-wide ("Manaktala Farm" on the
  // event, "Ambria Manaktala" or just a code elsewhere) — the same fuzzy,
  // both-directions substring match EventDayTab.jsx's venueMatches() already
  // uses for Home Venue, applied here against Ops's own venue names.
  function venueFuzzyMatch(a, b) {
    const x = (a || "").toLowerCase().trim(), y = (b || "").toLowerCase().trim();
    return !!(x && y && (x.includes(y) || y.includes(x)));
  }
  // For a row, how much of it each actual event-venue needs, matched against
  // THIS item's own per-venue allocations — then which of those venues don't
  // have enough, and which other venue(s) of the same item have spare to ask.
  function rowVenueShortfalls(row, stock) {
    if (!stock || !stock.item || !stock.item.venues || !stock.item.venues.length) return [];
    const byVenueId = {};
    (row.evBreak || []).forEach(b => {
      if (!b.venue) return;
      const match = stock.item.venues.find(v => venueFuzzyMatch(b.venue, v.venueName));
      if (!match) return;
      const q = convQty(b.qty, b.unit, row.unit);
      if (!byVenueId[match.venueId]) byVenueId[match.venueId] = { venue: match, required: 0 };
      byVenueId[match.venueId].required += q;
    });
    const out = [];
    Object.values(byVenueId).forEach(({ venue, required }) => {
      const have = storeUnitsToQty(venue.qty, stock, row.unit);
      if (required > have + 1e-9) {
        const donors = stock.item.venues
          .filter(v => v.venueId !== venue.venueId)
          .map(v => ({ venue: v, spare: storeUnitsToQty(v.qty, stock, row.unit) }))
          .filter(d => d.spare > 1e-9)
          .sort((a, b) => b.spare - a.spare);
        out.push({ venue, required, have, shortfall: required - have, donors });
      }
    });
    return out;
  }
  function openTransferRequest(row, stock, sf) {
    setTransferModal({
      row, stock, toVenue: sf.venue, donors: sf.donors,
      fromVenueId: sf.donors[0] ? sf.donors[0].venue.venueId : "",
      value: String(roundSmart(sf.shortfall)),
    });
  }
  async function createTransferRequest() {
    const { row, stock, toVenue, donors, fromVenueId, value } = transferModal;
    const val = parseFloat(value);
    if (!(val > 0)) return;
    const from = donors.find(d => d.venue.venueId === fromVenueId) || donors[0];
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const rec = {
      ingredient_name: row.name, ingredient_hindi: row.hindi || null, unit: row.unit, qty: val,
      from_venue_code: from ? from.venue.venueCode : null, from_venue_name: from ? from.venue.venueName : null,
      to_venue_code: toVenue.venueCode, to_venue_name: toVenue.venueName,
      status: 'open', requested_by: staffId,
    };
    setTransferModal(null);
    const { error } = await supabase.from('store_transfer_requests').insert(rec);
    if (error) console.error("Transfer request failed:", error);
  }
  async function markTransferFulfilled(id) {
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const now = new Date().toISOString();
    setTransferRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'fulfilled', fulfilled_by: staffId, fulfilled_at: now } : r));
    const { error } = await supabase.from('store_transfer_requests').update({ status: 'fulfilled', fulfilled_by: staffId, fulfilled_at: now }).eq('id', id);
    if (error) console.error("Mark fulfilled failed:", error);
  }

  /* ── Order Lists (Requirements tab "Add to Order list") ── */
  async function addToOrderList(row, listKey) {
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const rec = {
      order_date: reqDay,
      ingredient_name: row.name,
      ingredient_hindi: row.hindi || null,
      unit: row.unit,
      qty: row.total,
      list_key: listKey,
      source: [...new Set(row.evBreak.map(b => b.evName))].join(', '),
      ordered: false,
      added_by: staffId,
      added_at: new Date().toISOString(),
    };
    setOrderListItems(prev => {
      const idx = prev.findIndex(r => r.order_date === reqDay && r.ingredient_name === row.name);
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], ...rec }; return n; }
      return [...prev, rec];
    });
    setReqPicker(null);
    const { error } = await supabase.from('store_order_lists').upsert(rec, { onConflict: 'order_date,ingredient_name' });
    if (error) console.error("Add to order list failed:", error);
  }
  // Many at once (station modal "+ All"): one state update and one bulk upsert,
  // not a network round-trip per ingredient. Reports a failed save in the UI.
  async function addManyToOrderList(list) {
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const now = new Date().toISOString();
    const recs = list.map(({row, listKey}) => ({
      order_date: reqDay,
      ingredient_name: row.name,
      ingredient_hindi: row.hindi || null,
      unit: row.unit,
      qty: row.total,
      list_key: listKey,
      source: [...new Set(row.evBreak.map(b => b.evName))].join(', '),
      ordered: false,
      added_by: staffId,
      added_at: now,
    }));
    if (recs.length === 0) return;
    setOrderListItems(prev => {
      const names = new Set(recs.map(r => r.ingredient_name));
      return [...prev.filter(r => !(r.order_date === reqDay && names.has(r.ingredient_name))), ...recs];
    });
    const { error } = await supabase.from('store_order_lists').upsert(recs, { onConflict: 'order_date,ingredient_name' });
    if (error) {
      console.error("Add all to order list failed:", error);
      setReqNote({ tone: "err", text: T2("Could not save the order list") + ": " + (error.message || error.code || "") });
    } else {
      setReqNote({ tone: "ok", text: recs.length + " " + T2("ingredients added to the order list") });
    }
    setTimeout(() => setReqNote(null), 5000);
  }
  async function removeFromOrderList(row) {
    setOrderListItems(prev => prev.filter(r => !(r.order_date === reqDay && r.ingredient_name === row.name)));
    const { error } = await supabase.from('store_order_lists').delete().eq('order_date', reqDay).eq('ingredient_name', row.name);
    if (error) console.error("Remove from order list failed:", error);
  }
  async function toggleOrdered(item) {
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const next = !item.ordered;
    const patch = { ordered: next, ordered_by: next ? staffId : null, ordered_at: next ? new Date().toISOString() : null };
    setOrderListItems(prev => prev.map(r => (r.order_date === item.order_date && r.ingredient_name === item.ingredient_name) ? { ...r, ...patch } : r));
    const { error } = await supabase.from('store_order_lists').update(patch).eq('order_date', item.order_date).eq('ingredient_name', item.ingredient_name);
    if (error) console.error("Toggle ordered failed:", error);
  }

  /* ── Extract all unique ingredient names from recipe DB ──
     ingRefreshTick is a dependency on purpose: after a merge/unit-edit
     mutates RECIPE_DB in place (see performIngredientMerge), nothing else
     would tell this memo to re-derive — RECIPE_DB itself isn't React state. */
  // Pure snapshot of RECIPE_DB's ingredient usages. RECIPE_DB mutates in place
  // (not React state) and is also edited from KitchenHub's SOP recipe editor,
  // so a memoized value can go stale the moment someone corrects a recipe
  // there without touching this component. Anything that needs the CURRENT
  // truth at the moment it runs (e.g. Find Duplicates, so a just-corrected
  // ingredient doesn't reappear as a duplicate) must call this directly
  // instead of reading the memoized allRecipeIngredients below.
  function buildRecipeIngredientList() {
    const seen = {};
    for (const catId of Object.keys(RECIPE_DB.recipes || {})) {
      for (const recipe of (RECIPE_DB.recipes[catId] || [])) {
        if (recipe.ingredients?.items?.length > 0) {
          recipe.ingredients.items.forEach(it => {
            if (it.isSection) return;
            if (it.type === 'bg') return;                          // 9D — bg refs aren't shopped for
            const n = it.name;
            if (!seen[n]) seen[n] = { name: n, hindi: it.hindi || it.hi || "", unit: it.unit || "", dishes: [], usages: [], hasInv: false, ops_inventory_id: null };
            // 9D — mark inv-mapped when any usage carries embedded ops_inventory_id
            if (it.type === 'inv') {
              seen[n].hasInv = true;
              if (!seen[n].ops_inventory_id && it.ops_inventory_id) seen[n].ops_inventory_id = it.ops_inventory_id;
            }
            seen[n].dishes.push(recipe.n);
            // catId+dishName pair, so a merge/unit-edit can find and rewrite
            // the exact recipes.ingredients row this usage came from.
            seen[n].usages.push({ dishName: recipe.n, catId });
          });
        }
      }
    }
    return Object.values(seen).sort((a, b) => a.name.localeCompare(b.name));
  }
  const allRecipeIngredients = useMemo(() => buildRecipeIngredientList(), [ingRefreshTick]);

  // Weight/volume unit conversion so a merge that changes an item's unit
  // rescales its qty instead of silently relabeling it (200 "gm" becoming
  // 200 "kg" would be a 1000x data error). Returns null when the two units
  // aren't a known convertible pair (e.g. "pcs" -> "kg") — callers must
  // then leave qty untouched and flag it for manual review.
  const ING_UNIT_RATE_TO_BASE = { kg: 1000, gm: 1, g: 1, l: 1000, ltr: 1000, ml: 1 };
  const ING_UNIT_FAMILY = { kg: 'wt', gm: 'wt', g: 'wt', l: 'vol', ltr: 'vol', ml: 'vol' };
  function convertIngQty(qty, fromUnit, toUnit) {
    const f = (fromUnit || '').trim().toLowerCase();
    const t = (toUnit || '').trim().toLowerCase();
    if (!f || !t || f === t) return qty;
    if (ING_UNIT_FAMILY[f] && ING_UNIT_FAMILY[f] === ING_UNIT_FAMILY[t]) {
      return qty * (ING_UNIT_RATE_TO_BASE[f] / ING_UNIT_RATE_TO_BASE[t]);
    }
    return null;
  }

  /* ── Merge/rename N ingredient names into one, with one shared unit ──
     Models the existing dish-merge feature (DishLibrary.jsx): pick a
     canonical name, rewrite every place the string is referenced (there:
     menu_packages; here: every recipes row's ingredients.items[]), drop the
     merged-away names' own side-table rows, keep the canonical's. A
     standalone "edit this ingredient's unit" is just this same function
     called with sources=[name], target=name — it still rewrites every
     recipe's ingredients.items[].unit for that name, which is the whole
     point (unit lives inline per recipe, not normalized anywhere).
     When a source row's unit differs from the target unit, qty is rescaled
     (kg<->gm, l<->ml) so the merge never silently relabels a quantity into
     the wrong magnitude; unconvertible pairs (e.g. "pcs" -> "kg") are left
     as-is and reported back for manual review. */
  async function performIngredientMerge(sourceNames, targetName, targetUnit) {
    const target = (targetName || "").trim();
    const unit = (targetUnit || "").trim();
    if (!target || !unit) { alert(T2("Name and unit are both required.")); return; }
    setIngMerging(true);
    try {
      const allNames = new Set(sourceNames);
      allNames.add(target);
      const freshIngredients = buildRecipeIngredientList(); // current RECIPE_DB state, not this component's possibly-stale memo
      const touched = [];
      allNames.forEach(n => {
        const entry = freshIngredients.find(i => i.name === n);
        if (entry) entry.usages.forEach(u => touched.push(u));
      });
      const seenKey = new Set();
      const uniqueTouched = touched.filter(u => {
        const k = u.catId + "|" + u.dishName;
        if (seenKey.has(k)) return false;
        seenKey.add(k); return true;
      });
      const unconvertible = []; // [{dishName, name, fromUnit}] — qty left as-is, needs manual review
      for (const { catId, dishName } of uniqueTouched) {
        const catRecipes = RECIPE_DB.recipes[catId] || [];
        const recipe = catRecipes.find(r => r.n === dishName);
        if (!recipe || !recipe.ingredients?.items) continue;
        let changed = false;
        const nextItems = recipe.ingredients.items.map(it => {
          if (!it.isSection && allNames.has(it.name) && (it.name !== target || it.unit !== unit)) {
            changed = true;
            if (it.unit === unit) return { ...it, name: target, unit };
            const convertedQty = convertIngQty(Number(it.qty) || 0, it.unit, unit);
            if (convertedQty == null) {
              unconvertible.push({ dishName, name: it.name, fromUnit: it.unit });
              return { ...it, name: target, unit };
            }
            return { ...it, name: target, unit, qty: convertedQty };
          }
          return it;
        });
        if (!changed) continue;
        const payload = { ...recipe.ingredients, items: nextItems };
        recipe.ingredients = payload; // local mutation — mirrors the pattern in KitchenHub.jsx's own ingredient saves
        const { error } = await supabase.from('recipes').update({ ingredients: payload }).eq('dish_name', dishName).eq('category_id', catId);
        if (error) { console.error('[ingredient merge] recipe update failed', dishName, error); throw error; }
      }

      // Carry the surviving mapping forward: keep target's own if it has
      // one, else adopt the first merged-away source's; drop the rest —
      // same "keep canonical's, drop duplicates'" rule dish-merge uses for
      // dish_store_map.
      const sourcesToDrop = [...allNames].filter(n => n !== target);
      if (!ingredientMap[target]) {
        const donorName = sourcesToDrop.find(n => ingredientMap[n]);
        if (donorName) {
          const donor = ingredientMap[donorName];
          await saveIngredientMapping(target, donor.ingredient_hindi, { _opsId: donor.ops_item_id, inventoryId: donor.ops_inventory_id, name: donor.ops_item_name, unit: donor.ops_item_unit }, donor.unit_conversion || 1);
        }
      }
      for (const n of sourcesToDrop) {
        if (ingredientMap[n]) await removeIngredientMapping(n);
      }

      setIngSelected({});
      setIngMergeModal(null);
      setIngRefreshTick(t => t + 1);
      if (unconvertible.length) {
        const lines = unconvertible.map(u => `• ${u.dishName}: ${u.name} (${u.fromUnit} → ${unit}, qty left unchanged)`);
        alert(T2('Merged, but these couldn\'t be auto-converted to ') + unit + T2(' — check the quantities manually:') + '\n\n' + lines.join('\n'));
      }
    } catch (e) {
      console.error('[performIngredientMerge]', e);
      alert(T2('Merge failed: ') + (e.message || e));
    } finally {
      setIngMerging(false);
    }
  }

  /* ── Ingredient duplicate finder — "🔍 Find duplicates", same flow as
     Dish Library's: scan once on open, review clusters, pick a target per
     group, merge or skip. ── */
  function openIngDedup() { setIngDedupConfirm(null); setIngDedupTab(null);
    // Fresh snapshot on every click — not the memoized allRecipeIngredients,
    // which only recomputes on this component's own merges and can miss a
    // recipe someone just fixed in the SOP editor.
    const clusters = findIngredientDuplicateClusters(buildRecipeIngredientList());
    setIngDedupTargets(prev => {
      const next = { ...prev };
      clusters.forEach(c => { const k = ingClusterKey(c); if (next[k] === undefined) next[k] = pickDefaultIngTarget(c); });
      return next;
    });
    setIngDedupUnits(prev => {
      const next = { ...prev };
      clusters.forEach(c => {
        const k = ingClusterKey(c);
        if (next[k] === undefined) { const t = pickDefaultIngTarget(c); next[k] = (c.items.find(x => x.name === t) || {}).unit || ''; }
      });
      return next;
    });
    setIngDedupClusters(clusters);
    // Skipped/resolved decisions are deliberately NOT reset here — see the
    // comment by their useState declarations. resetIngDedupSkipped() is the
    // one explicit way to bring skipped groups back.
    setIngDedupOpen(true);
  }
  function closeIngDedup() {
    if (ingDedupSavingIdx != null) return;
    setIngDedupOpen(false);
  }
  function pickIngDedupTarget(key, name) {
    setIngDedupTargets(prev => ({ ...prev, [key]: name }));
    const cluster = ingDedupClusters.find(c => ingClusterKey(c) === key);
    const found = cluster && cluster.items.find(x => x.name === name);
    if (found) setIngDedupUnits(prev => ({ ...prev, [key]: found.unit || '' }));
  }
  function skipIngDedupCluster(key) {
    setIngDedupSkipped(prev => ({ ...prev, [key]: true }));
  }
  function resetIngDedupSkipped() {
    setIngDedupSkipped({});
  }
  async function mergeIngDedupCluster(idx) {
    const cluster = ingDedupClusters[idx];
    if (!cluster) return;
    const key = ingClusterKey(cluster);
    const target = (ingDedupTargets[key] || '').trim();
    const unit = (ingDedupUnits[key] || '').trim();
    if (!target || !unit) { alert(T2('Pick a target and unit for this group.')); return; }
    const sources = cluster.items.map(d => d.name).filter(n => n !== target);
    if (sources.length === 0) { alert(T2('Nothing to merge — target is the only ingredient.')); return; }
    setIngDedupSavingIdx(idx);
    try {
      await performIngredientMerge(sources, target, unit);
      setIngDedupResolved(prev => ({ ...prev, [key]: 'merged' }));
    } catch (e) {
      alert(T2('Merge failed: ') + (e.message || e));
    } finally {
      setIngDedupSavingIdx(null);
    }
  }

  /* ── Fuzzy match: find best Ops store item for an ingredient name ── */
  function fuzzyMatchStoreItem(ingName) {
    if (!ingName || items.length === 0) return null;
    const consumables = items.filter(i => i.source === "ops" || i.source === "store");
    if (consumables.length === 0) return null;

    // Normalize: strip Hindi, brackets, slashes, lowercase
    function norm(s) {
      return (s || "").replace(/[\u0900-\u097F]+/g, "").replace(/\([^)]*\)/g, "").replace(/[/–—·]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    }
    const ingNorm = norm(ingName);
    if (!ingNorm) return null;

    // Extract the core English word(s) — first meaningful token(s)
    const ingTokens = ingNorm.split(" ").filter(t => t.length > 1 && !["for","the","and","with","fine","large","small","fresh","boiled","fried","chopped","grated","crushed","whole","dried","raw","mix","mixed","powder","paste","null"].includes(t));

    let bestMatch = null;
    let bestScore = 0;

    for (const si of consumables) {
      const siNorm = norm(si.name);
      const siHNorm = norm(si.h || "");

      // Exact match
      if (siNorm === ingNorm || siHNorm === ingNorm) return { item: si, score: 100, reason: "exact" };

      // Contains full ingredient name
      if (siNorm.includes(ingNorm) || ingNorm.includes(siNorm)) {
        const score = 90;
        if (score > bestScore) { bestScore = score; bestMatch = { item: si, score, reason: "contains" }; }
        continue;
      }

      // Token overlap scoring
      const siTokens = siNorm.split(" ").filter(t => t.length > 1);
      let matched = 0;
      for (const it of ingTokens) {
        if (siTokens.some(st => st.includes(it) || it.includes(st))) matched++;
      }
      if (matched > 0 && ingTokens.length > 0) {
        const score = Math.round((matched / ingTokens.length) * 80);
        if (score > bestScore) { bestScore = score; bestMatch = { item: si, score, reason: "tokens(" + matched + "/" + ingTokens.length + ")" }; }
      }

      // Also check Hindi name match
      if (siHNorm && ingName) {
        const ingHindi = (ingName || "").replace(/[a-zA-Z0-9\s()/.–—,]/g, "").trim();
        if (ingHindi && siHNorm.includes(ingHindi)) {
          const score = 75;
          if (score > bestScore) { bestScore = score; bestMatch = { item: si, score, reason: "hindi" }; }
        }
      }
    }

    return bestScore >= 40 ? bestMatch : null;
  }

  /* ── Unit family helpers for conversion ── */
  var UNIT_FAMILIES = {
    weight: { units: ["g","gm","gms","kg"], base: "g", factors: { g:1, gm:1, gms:1, kg:1000 } },
    volume: { units: ["ml","l","ltr","litre"], base: "ml", factors: { ml:1, l:1000, ltr:1000, litre:1000 } },
  };
  function getUnitFamily(u) {
    var ul = (u||"").toLowerCase().replace(/\s+/g,"").replace(/\./g,"");
    for (var fam in UNIT_FAMILIES) {
      if (UNIT_FAMILIES[fam].units.indexOf(ul) >= 0) return { family: fam, toBase: UNIT_FAMILIES[fam].factors[ul] || 1 };
    }
    return null;
  }
  function calcAutoConversion(recipeUnit, storeUnit) {
    var rf = getUnitFamily(recipeUnit);
    var sf = getUnitFamily(storeUnit);
    if (!rf || !sf || rf.family !== sf.family) return null;
    return rf.toBase / sf.toBase;
  }
  function handleStoreItemSelect(ingName, ingHindi, ingUnit, opsItem) {
    var recU = (ingUnit||"").toLowerCase().replace(/\s+/g,"");
    var stoU = (opsItem.unit||"").toLowerCase().replace(/\s+/g,"");
    if (recU === stoU) { saveIngredientMapping(ingName, ingHindi, opsItem, 1); return; }
    var auto = calcAutoConversion(ingUnit, opsItem.unit);
    if (auto !== null) { saveIngredientMapping(ingName, ingHindi, opsItem, auto); return; }
    setMapModalIng(null); setMapSearch("");
    setConvModal({ ingName: ingName, ingHindi: ingHindi||"", opsItem: opsItem, recipeUnit: ingUnit, storeUnit: opsItem.unit, convValue: "", editMode: false });
  }

  /* ── Ingredient → Store item mapping helpers ── */
  function getStockForIngredient(ingName) {
    const mapping = ingredientMap[ingName];
    if (!mapping) return null;
    const storeItem = items.find(i => i._opsId === mapping.ops_item_id);
    if (!storeItem) return null;
    const conversion = mapping.unit_conversion || 1;
    return { item: storeItem, available: storeItem.available, unit: storeItem.unit, conversion };
  }

  // 9D — direct stock lookup by inv-prefix id (for type='inv' rows, bypasses ingredient_item_map)
  function getStockByInventoryId(invId) {
    if (!invId) return null;
    const storeItem = items.find(i => i.inventoryId === invId);
    if (!storeItem) return null;
    return { item: storeItem, available: storeItem.available, unit: storeItem.unit, conversion: 1 };
  }

  

  async function saveIngredientMapping(ingName, ingHindi, opsItem, conversion) {
    var conv = (typeof conversion === "number" && conversion > 0) ? conversion : 1;
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const rec = {
      ingredient_name: ingName,
      ingredient_hindi: ingHindi || null,
      ops_item_id: opsItem._opsId,
      ops_inventory_id: opsItem.inventoryId || null,  // V67: stable prefix id — survives Ops rebuilds
      ops_item_name: opsItem.name,
      ops_item_unit: opsItem.unit,
      unit_conversion: conv,
      mapped_by: staffId,
    };
    setIngredientMap(prev => ({ ...prev, [ingName]: rec }));
    setMapModalIng(null);
    setMapSearch("");
    setConvModal(null);
    const { error } = await supabase.from('ingredient_item_map').upsert(rec, { onConflict: 'ingredient_name' });
    if (error) console.error("Mapping save failed:", error);
  }

  async function removeIngredientMapping(ingName) {
    setIngredientMap(prev => { const n = { ...prev }; delete n[ingName]; return n; });
    const { error } = await supabase.from('ingredient_item_map').delete().eq('ingredient_name', ingName);
    if (error) console.error("Mapping delete failed:", error);
  }

  /* build per-event section bags — used by both views */
  function normalizeToBaseUnit(qty, unit) {
    const u = (unit||"").toLowerCase().replace(/\s/g,"");
    if ((u==="g"||u==="gm"||u==="gms") && qty>=1000) return { qty: qty/1000, unit: "kg" };
    if ((u==="g"||u==="gm"||u==="gms")) return { qty, unit: "g" };
    if (u==="ml" && qty>=1000) return { qty: qty/1000, unit: "L" };
    if (u==="ml") return { qty, unit: "ml" };
    return { qty, unit: unit||"pcs" };
  }
  function toGrams(qty, unit) {
    const u = (unit||"").toLowerCase().replace(/\s/g,"");
    if (u==="kg") return qty * 1000;
    if (u==="g"||u==="gm"||u==="gms") return qty;
    return null;
  }
  function toMl(qty, unit) {
    const u = (unit||"").toLowerCase().replace(/\s/g,"");
    if (u==="l"||u==="ltr") return qty * 1000;
    if (u==="ml") return qty;
    return null;
  }
  function addQtyWithUnitNorm(existing, addQty, addUnit) {
    const eG = toGrams(existing.totalQty, existing.unit);
    const aG = toGrams(addQty, addUnit);
    if (eG !== null && aG !== null) {
      const totalG = eG + aG;
      if (totalG >= 1000) return { totalQty: totalG / 1000, unit: "kg" };
      return { totalQty: totalG, unit: "g" };
    }
    const eM = toMl(existing.totalQty, existing.unit);
    const aM = toMl(addQty, addUnit);
    if (eM !== null && aM !== null) {
      const totalM = eM + aM;
      if (totalM >= 1000) return { totalQty: totalM / 1000, unit: "L" };
      return { totalQty: totalM, unit: "ml" };
    }
    return { totalQty: existing.totalQty + addQty, unit: existing.unit };
  }

  // kg/L pass through 1:1 (density assumption, same as Kitchen Hub's bg-demand
  // unit handling); gm/ml convert /1000; anything else (pcs, tsp, bunch...)
  // can't drive a yield-based expansion.
  function bgQtyToKg(qty, unit) {
    const u = String(unit || 'kg').toLowerCase();
    if (u === 'kg' || u === 'l') return qty;
    if (u === 'gm' || u === 'ml') return qty / 1000;
    return null;
  }
  function buildEventBags(evList) {
    const evBags = {};
    function mergeIngredients(evId, sec, meta, ingList, isNew, pax) {
      if (!ingList || ingList.length === 0) return;
      if (!evBags[evId].sections[sec]) evBags[evId].sections[sec] = { items: {}, meta };
      ingList.forEach(ing => {
        const k = ing.n;
        const rawQty = isNew ? ing.q : ing.q * pax;
        if (!evBags[evId].sections[sec].items[k]) {
          const norm = normalizeToBaseUnit(rawQty, ing.u);
          evBags[evId].sections[sec].items[k] = {
            name: ing.n,
            hindi: ing.h || "",
            unit: norm.unit,
            totalQty: norm.qty,
            // 9D — preserve inv metadata so shortage build can use ops_inventory_id directly
            _type: ing._type || null,
            ops_inventory_id: ing.ops_inventory_id || null,
          };
        } else {
          const merged = addQtyWithUnitNorm(evBags[evId].sections[sec].items[k], rawQty, ing.u);
          evBags[evId].sections[sec].items[k].totalQty = merged.totalQty;
          evBags[evId].sections[sec].items[k].unit = merged.unit;
          // 9D — if this contributing row is inv, promote the bucket to inv
          if (!evBags[evId].sections[sec].items[k]._type && ing._type === 'inv') {
            evBags[evId].sections[sec].items[k]._type = 'inv';
            evBags[evId].sections[sec].items[k].ops_inventory_id = ing.ops_inventory_id || null;
          }
        }
      });
    }
    evList.forEach(ev => {
      // Kitchen Hub/Event Day scale every dish's cooking quantity by the chef's
      // yield-adjust slider (ev.yield_multiplier) before computing ingredients —
      // this used to stop at pax, so Store's auto-demand/shopping list quietly
      // ordered for a different quantity than the kitchen was actually told to
      // cook whenever that slider was used. Fold it into the effective pax here
      // (the same "no base_yield" fallback formula Kitchen Hub itself uses:
      // Math.round(evPax * mult)) so every per-pax multiplication below it —
      // regular dishes, fruit selections, the store-mapping fallback, and the
      // base-gravy expansion — scales the same way Kitchen will actually cook.
      const mult = Number(ev.yield_multiplier) || 1.0;
      const pax = Math.round((+ev.pax || 0) * mult);
      if (!evBags[ev.id]) evBags[ev.id] = { ev, sections: {} };
      // Outsourced dishes (Build Menu/Menu Builder toggle) are vendor-supplied —
      // their ingredients aren't shopped for or issued from Store. A whole
      // event flagged "third-party caterer on-site" is the same thing at the
      // event level: this kitchen cooks none of it, so none of its menu
      // should add to Store's shopping/issue demand either.
      const outsourcedSet = new Set(safeArr(ev.outsourced_dishes));
      const isExternalCaterer = !!ev.external_caterer;
      safeArr(ev.menu).filter(dishName => !isExternalCaterer && !outsourcedSet.has(dishName)).forEach(dishName => {
        const isFruitSel = isFruitSelectionDish(dishName);
        const cat = getCatForDish(dishName);
        const sec = isFruitSel ? "Fruits" : cat.name;
        const meta = isFruitSel ? { color: "#D97A3E", icon: "🍓" } : { color: cat.color || C.muted, icon: cat.icon || "🍽" };
        // Fruit-counter dishes have no recipe — the actual fruits are picked
        // per-function in Fruits Ops (event_fruit_selections) and already
        // carry a real ops_inventory_id, so they skip getIngrForDish/
        // ingredient_item_map entirely and go straight into the same
        // inv-typed item shape the shortage build already knows how to use.
        let ingr;
        if (isFruitSel) {
          ingr = fruitSelections
            .filter(r => r.event_id === ev.id && r.dish_name === dishName)
            .map(r => ({ n: r.ops_item_name, h: r.ops_item_hindi || "", q: (+r.qty_per_cover || 1) * pax, u: r.ops_item_unit || "Pieces", _newFmt: true, _type: 'inv', ops_inventory_id: r.ops_inventory_id || null }));
        } else {
          ingr = getIngrForDish(dishName, pax);
          // Beverages (and any other dish) with no recipe ingredients but a
          // direct 1:1 store mapping (dish_store_map) used to be entirely
          // invisible to Smart Issue — getIngrForDish only ever looks at
          // recipes, and beverage dishes were also unconditionally skipped
          // here regardless. Fall back to the store mapping itself as a
          // single-item "ingredient" so a mapped dish always shows up.
          if (!ingr || ingr.length === 0) {
            const store = resolveDishStore(dishName);
            if (store) {
              ingr = [{ n: store.ops_item_name, h: store.ops_item_hindi || "", q: (+store.qty_per_cover || 1) * pax, u: store.ops_item_unit || "Pieces", _newFmt: true, _type: 'inv', ops_inventory_id: store.ops_inventory_id || null }];
            }
          }
          // A dish can reference a shared base gravy ("200g Makhani Gravy per
          // cover") instead of listing its own raw ingredients — getIngrForDish
          // filters those type='bg' rows out (same as Kitchen Hub/Event Day's
          // resolvers), which left Store never shopping for the gravy's own
          // ingredients at all. Expand each bg reference into its real
          // ingredients, scaled to THIS dish's own share — the expansion is
          // linear in kg, so summing each dish's own share here equals
          // expanding the day's combined gravy demand once.
          getBgDemandForDish(dishName, pax).forEach(bgRef => {
            const kgEq = bgQtyToKg(bgRef.qty, bgRef.unit);
            if (kgEq == null || kgEq <= 0) return;
            const bgIngr = getIngrForYield(bgRef.bgName, kgEq);
            if (!bgIngr || !bgIngr.length) return;
            const bgCat = getCatForDish(bgRef.bgName);
            const bgSec = bgCat.name;
            const bgMeta = { color: bgCat.color || C.muted, icon: bgCat.icon || "🍽" };
            mergeIngredients(ev.id, bgSec, bgMeta, bgIngr.filter(i => !i._isSection && i.q > 0), true, pax);
          });
        }
        if (!ingr || ingr.length === 0) return;
        const isNew = ingr[0]?._newFmt;
        mergeIngredients(ev.id, sec, meta, ingr, isNew, pax);
      });
    });
    return evBags;
  }

  /* ── Derived: unique categories & venues from live data ── */
  const itemCategories = useMemo(() => [...new Set(items.map(i => i.cat))].filter(Boolean).sort(), [items]);
  const itemVenues = useMemo(() => [...new Set(items.flatMap(i => (i.venues||[]).map(v => v.venueName)))].filter(Boolean).sort(), [items]);

  // Requirements/Order Lists grouping — same 4 fixed buckets (Vegetable &
  // Fruit / Dairy / Butchery / Grocery) the Planning tab's Ordering Sheet
  // already groups by, not the live Ops inventory item's own category and
  // not a per-venue-varying guess. categorizeIngredientWithOverride always
  // resolves to one of these 4 (Grocery is the catch-all), so there's no
  // "Uncategorized" bucket left to fall into.
  const orderListCats = useMemo(() => {
    return INGR_CATEGORY_ORDER.map(name => {
      const meta = catMeta(name);
      const tn = tone(meta.toneName);
      return { key: slugifyCat(name), label: name, icon: meta.emoji, color: tn.fg, bg: tn.bg, border: tn.border };
    });
  }, []);
  // Single source of truth for "which of the 4 buckets does this ingredient
  // belong in" — reused by the Requirements table's grouping, the station
  // modal, and the order-list badge, so none of them can drift from another.
  function categoryMetaForName(name) {
    const cat = categorizeIngredientWithOverride(name, ingrCatOverrides);
    return orderListCatByKey[slugifyCat(cat)] || orderListCatByKey[slugifyCat(INGR_CATEGORY_ORDER[INGR_CATEGORY_ORDER.length - 1])];
  }
  const orderListCatByKey = useMemo(() => {
    const m = {};
    orderListCats.forEach(c => { m[c.key] = c; });
    return m;
  }, [orderListCats]);
  // Shared by the Order Lists tab's cards and the print view, so what you
  // print always matches what's on screen.
  function buildOrderListGroups() {
    const grouped = {};
    orderListItems.slice().sort((a,b)=>(a.order_date+a.ingredient_name).localeCompare(b.order_date+b.ingredient_name)).forEach(r=>{
      // Derived fresh from the name every time, not the list_key stored when
      // the row was added — that stamped-in value predates the 4-bucket
      // scheme (and even an old-scheme row would just drift from whatever
      // this classifier says today). One live source of truth beats a cached
      // snapshot going stale exactly the way it just did.
      const key = categoryMetaForName(r.ingredient_name).key;
      (grouped[key] = grouped[key] || []).push(r);
    });
    return orderListCats.map(c=>({meta:c, list:grouped[c.key]||[]})).filter(g=>g.list.length>0);
  }
  // Add-item form only writes to catering_store_items, so its category picker is
  // scoped to categories that already have a source:"store" item — that's the only
  // way we can resolve a valid category_id without a separate categories-table fetch.
  const storeItemCategories = useMemo(() => [...new Set(items.filter(i => i.source === "store" && i._categoryId).map(i => i.cat))].filter(Boolean).sort(), [items]);

  async function addItem(){
    if(addingItem) return; // Btn doesn't support a disabled prop — guard re-entrancy here instead
    if(!newItem.name.trim()) return;
    if(!opsSupabase){ alert(T2("Inventory system not connected.")); return; }
    const donor = items.find(i => i.source === "store" && i.cat === newItem.cat && i._categoryId);
    if(!donor){ alert(T2('Pick a different category — could not resolve a category id for "')+newItem.cat+'".'); return; }
    setAddingItem(true);
    try {
      const payload = {
        name: newItem.name.trim(),
        name_hindi: null,
        brand: newItem.brand || null,
        unit: newItem.unit || "pcs",
        category_id: donor._categoryId,
        qty: +newItem.inStock || 0,
        season_reorder_qty: +newItem.minStock || 0,
        off_season_reorder_qty: +newItem.minStock || 0,
        status: "approved",
      };
      const { error } = await opsSupabase.from("catering_store_items").insert(payload);
      if (error) throw error;
      setNewItem({name:"",barcode:"",brand:"",supplier:"",cat:"Dry Goods",unit:"pcs",inStock:0,minStock:10,perPax:0,location:"Store A"});
      setShowAdd(false);
    } catch (e) {
      console.error("[addItem] insert failed", e);
      alert(T2("Could not add item: ") + (e.message || e));
    } finally {
      setAddingItem(false);
    }
  }

  const upcoming  = safeEvs.filter(e=>e.date>=TODAY);
  const totalPax  = upcoming.reduce((s,e)=>s+(+e.pax||0),0);
  const fld = {width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"};

  const filteredItems = useMemo(() => items.filter(i => {
    const mc = catFil === "All" || i.cat === catFil;
    const ms = !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()) || (i.h || "").includes(search) || (i.inventoryId || "").toLowerCase().includes(search.toLowerCase()) || (i.brand || "").toLowerCase().includes(search.toLowerCase());
    const mv = venueFil === "All" || (i.venues || []).some(v => v.venueName === venueFil);
    const mst = stockFil === "all" ? true
      : stockFil === "instock" ? (i.available > 0 && (i.reorderQty <= 0 || i.available > i.reorderQty))
      : stockFil === "low" ? (i.available > 0 && i.reorderQty > 0 && i.available <= i.reorderQty)
      : stockFil === "out" ? i.available <= 0
      : true;
    const msrc = sourceFil === "all" ? true : i.source === sourceFil;
    return mc && ms && mv && mst && msrc;
  }), [items, catFil, search, venueFil, stockFil, sourceFil]);

  return (
    <div>
      {/* Header — title, sync status, Add Item and the tabs in one warm card.
          The title and "Synced" line used to sit on the page artwork. */}
      <div style={{background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,borderRadius:20,boxShadow:K.shadowCard,marginBottom:16,fontFamily:K.fontBody}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",padding:"14px 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
          <span style={{width:40,height:40,borderRadius:13,flexShrink:0,background:K.brand,color:K.hdrBadgeIcon,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>📦</span>
          <div style={{minWidth:0}}>
          <div style={{...type.cardTitle,fontSize:19,color:K.hdrTitle}}>{T2("Store & Inventory")}</div>
          <div style={{fontSize:12,color:K.hdrMeta,marginTop:2}}>
            {loading ? "Loading from inventory system…" : items.length + " " + T2("items")}
            {lastSync && <span> · Synced {lastSync.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"})}</span>}
            {loadError && <span style={{color:K.warn,fontWeight:600}}> · {loadError}</span>}
          </div>
          </div>
        </div>
        <button onClick={()=>setShowAdd(s=>!s)} className="kh-hovercard"
          style={{padding:"10px 22px",borderRadius:999,fontFamily:K.fontBody,fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",
            background:showAdd?"#FFFFFF":K.brand,color:showAdd?K.textBody:"#FFFFFF",border:`1px solid ${showAdd?K.cardWarmLine:K.brand}`,boxShadow:K.shadowCard}}>{showAdd?"✕ "+T2("Cancel"):"+ "+T2("Add Item")}</button>
      </div>
      {/* Tabs */}
      <div style={{display:"flex",gap:8,padding:"10px 18px 14px",borderTop:`1px solid ${K.cardWarmLine}`,overflowX:"auto"}}>
        {[{v:"inventory",l:T2("📦 Inventory")},{v:"requirements",l:T2("🧮 Requirements")},{v:"orderlists",l:T2("🧺 Order Lists")},hasPerm(currentUser,"store.edit_stock")&&{v:"ingmap",l:T2("🔗 Ingredient Map")}].filter(Boolean).map(t=>(
          <button key={t.v} onClick={()=>setTab(t.v)} className={tab===t.v?undefined:"kh-calnav"}
            style={{padding:"8px 18px",borderRadius:999,fontFamily:K.fontBody,fontSize:13,fontWeight:tab===t.v?700:600,cursor:"pointer",whiteSpace:"nowrap",minHeight:38,
              background:tab===t.v?K.brand:"#FFFFFF",color:tab===t.v?"#FFFFFF":K.textBody,border:`1px solid ${tab===t.v?K.brand:K.cardWarmLine}`,
              boxShadow:tab===t.v?K.shadowCard:"none"}}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
        ))}
      </div>
      </div>

      {/* Add form */}
      {showAdd&&(()=>{
        const lbl = {display:"block",fontFamily:K.fontBody,fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6,marginBottom:6};
        const inp = {width:"100%",boxSizing:"border-box",padding:"10px 14px",borderRadius:12,border:`1px solid ${K.cardWarmLine}`,fontSize:13,fontFamily:K.fontBody,color:K.hdrTitle,background:"#FFFFFF",outline:"none"};
        // A modal, not a block pushed in above the tabs.
        const close = ()=>{ if(!addingItem) setShowAdd(false); };
        return(
        <div onClick={close} role="presentation"
          style={{position:"fixed",inset:0,zIndex:900,background:"rgba(20,28,24,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}
          style={{position:"relative",width:"100%",maxWidth:760,maxHeight:"90vh",overflowY:"auto",background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,borderRadius:22,padding:"20px 22px",boxShadow:K.shadowLift}}>
          <button onClick={close} aria-label={T2("Close")}
            style={{position:"absolute",top:16,right:16,width:34,height:34,borderRadius:999,border:`1px solid ${K.cardWarmLine}`,background:"#FFFFFF",color:K.textMuted,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,paddingRight:44}}>
            <span style={{width:40,height:40,borderRadius:13,flexShrink:0,background:K.brand,color:K.hdrBadgeIcon,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>📦</span>
            <div>
              <div style={{...type.cardTitle,fontSize:17,color:K.hdrTitle}}>{T2("Add New Inventory Item")}</div>
              <div style={{fontFamily:K.fontBody,fontSize:12,color:K.hdrMeta,marginTop:2}}>{T2("Only the name is required.")}</div>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={lbl}>{T2("Item Name")} *</label>
            <input value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))} placeholder="e.g. Dinner Plates (10 inch)" style={inp}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:12}}>
            {[{l:"Barcode",k:"barcode",ph:"Manual entry"},{l:"Brand",k:"brand",ph:"Brand name"},{l:"Supplier",k:"supplier",ph:"Supplier name"}].map(f=>(
              <div key={f.k}>
                <label style={lbl}>{T2(f.l)}</label>
                <input value={newItem[f.k]||""} onChange={e=>setNewItem(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={inp}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:18}}>
            <div style={{gridColumn:"span 2"}}>
              <label style={lbl}>{T2("Category")}</label>
              <select value={newItem.cat} onChange={e=>setNewItem(p=>({...p,cat:e.target.value}))} style={inp}>
                {newItem.cat&&!storeItemCategories.includes(newItem.cat)&&<option value={newItem.cat}>{newItem.cat}</option>}
                {storeItemCategories.map(ct=><option key={ct}>{ct}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{T2("Unit")}</label>
              <select value={newItem.unit||"pcs"} onChange={e=>setNewItem(p=>({...p,unit:e.target.value}))} style={inp}>
                {ING_UNIT_CHOICES.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {[{l:"In Stock",k:"inStock",t:"number"},{l:"Min Stock",k:"minStock",t:"number"},{l:"Location",k:"location",ph:"Store A"}].map(f=>(
              <div key={f.k}>
                <label style={lbl}>{T2(f.l)}</label>
                <input type={f.t||"text"} value={newItem[f.k]||""} onChange={e=>setNewItem(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph||"0"} style={inp}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${K.cardWarmLine}`}}>
            <button onClick={()=>{if(!addingItem)setShowAdd(false);}}
              style={{padding:"10px 22px",borderRadius:999,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.textBody,fontFamily:K.fontBody,fontSize:13,fontWeight:600,cursor:"pointer",opacity:addingItem?0.6:1}}>{T2("Cancel")}</button>
            {hasPerm(currentUser,"store.edit_stock")&&<button onClick={addItem} disabled={addingItem}
              style={{padding:"10px 24px",borderRadius:999,background:K.brand,border:"none",color:"#FFFFFF",fontFamily:K.fontBody,fontSize:13,fontWeight:700,cursor:addingItem?"not-allowed":"pointer",opacity:addingItem?0.6:1}}>{addingItem?T2("Adding..."):"✓ "+T2("Add to Inventory")}</button>}
          </div>
        </div>
        </div>
        );
      })()}

      {/* ── INVENTORY (live from Ops Supabase) ── */}
      {tab==="inventory"&&(
        <div>
          {/* Loading state */}
          {loading && items.length === 0 && (
            <div style={{textAlign:"center",padding:48,color:C.muted}}>
              <div style={{fontSize:24,marginBottom:8}}>📦</div>
              <div style={{fontSize:13}}>Loading inventory from Ops system…</div>
            </div>
          )}

          {items.length > 0 && <>
          {/* Search */}
          <div style={{marginBottom:12}}>
            <div style={{position:"relative"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={T2("Search items, SKU, brand…")}
                style={{width:"100%",padding:"10px 16px 10px 38px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.muted,pointerEvents:"none"}}>🔍</span>
            </div>
          </div>

          {/* Filters — Type, Stock, Category and Venue in one bar: four
              dropdowns (each option carries its count) instead of three rows
              of pills, plus a Reset that only appears once something is set. */}
          {(()=>{
            const typeOpts = [
              {k:"all",l:T2("All types"),n:items.length},
              {k:"store",l:T2("Consumables"),n:items.filter(i=>i.source==="store").length},
              {k:"equipment",l:T2("Equipment"),n:items.filter(i=>i.source==="equipment").length},
            ];
            const stockOpts = [
              {k:"all",l:T2("All stock"),n:items.length},
              {k:"instock",l:T2("In stock"),n:items.filter(i=>i.available>0 && (i.reorderQty<=0 || i.available>i.reorderQty)).length},
              {k:"low",l:T2("Low"),n:items.filter(i=>i.available>0 && i.reorderQty>0 && i.available<=i.reorderQty).length},
              {k:"out",l:T2("Out"),n:items.filter(i=>i.available<=0).length},
            ];
            const stockTone = {instock:K.ok,low:K.warn,out:K.danger};
            const active = sourceFil!=="all"||stockFil!=="all"||catFil!=="All"||venueFil!=="All";
            const sel = (on, accent) => ({appearance:"auto",padding:"8px 12px",borderRadius:999,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:K.fontBody,
              border:`1px solid ${on?(accent||K.brand):K.cardWarmLine}`,background:on?K.brandSoft:"#FFFFFF",color:on?(accent||K.brandText):K.textBody,minWidth:0});
            const lbl = {fontSize:11,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.5};
            return(
            <div style={{display:"flex",alignItems:"center",gap:"10px 14px",flexWrap:"wrap",padding:"10px 14px",marginBottom:14,borderRadius:16,
              background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,fontFamily:K.fontBody}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:700,color:K.hdrTitle}}>⚙ {T2("Filters")}</span>
              <label style={{display:"inline-flex",alignItems:"center",gap:7}}>
                <span style={lbl}>{T2("Type")}</span>
                <select value={sourceFil} onChange={e=>setSourceFil(e.target.value)} style={sel(sourceFil!=="all")}>
                  {typeOpts.map(o=><option key={o.k} value={o.k}>{o.l} ({o.n})</option>)}
                </select>
              </label>
              <label style={{display:"inline-flex",alignItems:"center",gap:7}}>
                <span style={lbl}>{T2("Stock")}</span>
                <select value={stockFil} onChange={e=>setStockFil(e.target.value)} style={sel(stockFil!=="all",stockTone[stockFil])}>
                  {stockOpts.map(o=><option key={o.k} value={o.k}>{o.l} ({o.n})</option>)}
                </select>
              </label>
              <label style={{display:"inline-flex",alignItems:"center",gap:7}}>
                <span style={lbl}>{T2("Category")}</span>
                <select value={catFil} onChange={e=>setCatFil(e.target.value)} style={sel(catFil!=="All")}>
                  <option value="All">{T2("All categories")} ({items.length})</option>
                  {itemCategories.map(ct=><option key={ct} value={ct}>{ct} ({items.filter(i=>i.cat===ct).length})</option>)}
                </select>
              </label>
              {itemVenues.length > 1 && (
                <label style={{display:"inline-flex",alignItems:"center",gap:7}}>
                  <span style={lbl}>{T2("Venue")}</span>
                  <select value={venueFil} onChange={e=>setVenueFil(e.target.value)} style={sel(venueFil!=="All")}>
                    <option value="All">{T2("All venues")}</option>
                    {itemVenues.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              )}
              <div style={{flex:1}}/>
              <span style={{fontSize:12.5,color:K.hdrMeta,fontVariantNumeric:"tabular-nums"}}><b style={{color:K.hdrTitle}}>{filteredItems.length}</b> {T2("of")} {items.length} {T2("items")}</span>
              {active&&(
                <button onClick={()=>{setSourceFil("all");setStockFil("all");setCatFil("All");setVenueFil("All");}}
                  style={{padding:"7px 14px",borderRadius:999,border:`1px solid ${K.cardWarmLine}`,background:"#FFFFFF",color:K.textBody,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:K.fontBody}}>
                  ↺ {T2("Reset")}
                </button>
              )}
            </div>);
          })()}

          {/* ── Table ── */}
          <div style={{border:`1px solid ${K.cardWarmLine}`,borderRadius:18,overflow:"hidden",backgroundColor:K.cardWarm,boxShadow:K.shadowCard}}>
            <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed",fontSize:13}}>
              <colgroup>
                <col style={{width:"36%"}}/>
                <col style={{width:"13%"}}/>
                <col style={{width:"27%"}}/>
                <col style={{width:"10%"}}/>
                <col style={{width:"14%"}}/>
              </colgroup>
              <thead>
                <tr style={{background:"#F4F2EC"}}>
                  {[{l:"Item",a:"left"},{l:"Category",a:"left"},{l:"Venue stock",a:"left"},{l:"Total",a:"right"},{l:"Status",a:"center"}].map(h=>(
                    <th key={h.l} style={{textAlign:h.a,padding:"9px 14px",fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6,borderBottom:`1px solid ${K.cardWarmLine}`}}>{T2(h.l)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item,idx)=>{
                  const hasReorder = item.reorderQty > 0;
                  const low = item.available > 0 && hasReorder && item.available <= item.reorderQty;
                  const out = item.available <= 0;
                  const sc = out ? C.red : low ? C.amber : C.green;
                  return (
                    <tr key={item.id} style={{borderBottom:`1px solid ${K.lineSoft}`,background:out?K.dangerBg:"transparent"}}>
                      {/* Item */}
                      <td style={{padding:"10px 14px",verticalAlign:"top"}}>
                        <div style={{fontSize:13.5,fontWeight:600,color:K.hdrTitle,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                        {item.h&&<div style={{fontSize:12,color:K.hdrMeta,marginTop:1}}>{item.h}</div>}
                        <div style={{fontSize:11,color:K.textMuted,marginTop:2}}>
                          {item.brand?item.brand:""}
                          {item.packSize?(item.brand?" · ":"")+item.packSize:""}
                          {item.inventoryId&&<span style={{marginLeft:4,fontFamily:"monospace",fontSize:10,color:C.muted,background:C.bg,padding:"1px 5px",borderRadius:4}}>{item.inventoryId}</span>}
                        </div>
                      </td>
                      {/* Category */}
                      <td style={{padding:"10px 14px",verticalAlign:"top"}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12,color:K.textBody}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:catDotColor(item.catCode),flexShrink:0}}/>
                          {item.cat}
                        </span>
                      </td>
                      {/* Venue stock chips */}
                      <td style={{padding:"10px 14px",verticalAlign:"top"}}>
                        {item.venues.length > 0 ? (
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {item.venues.map(v=>{
                              const vc = venueColor(v.venueCode);
                              return <span key={v.venueId} style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:500,background:vc.bg,color:vc.text}}>{vc.label} {v.qty}</span>;
                            })}
                          </div>
                        ) : (
                          <span style={{fontSize:11,color:C.faint}}>—</span>
                        )}
                      </td>
                      {/* Total */}
                      <td style={{padding:"10px 14px",textAlign:"right",verticalAlign:"top"}}>
                        <div style={{fontSize:16,fontWeight:700,color:sc,fontVariantNumeric:"tabular-nums"}}>{item.available}</div>
                        <div style={{fontSize:11,color:K.hdrMeta}}>{item.unit}</div>
                      </td>
                      {/* Status */}
                      <td style={{padding:"10px 14px",textAlign:"center",verticalAlign:"top"}}>
                        <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,
                          background:out?C.redBg:low?C.amberBg:C.greenBg,color:sc}}>
                          {out?T2("Out"):low?T2("Low"):T2("OK")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredItems.length===0 && !loading && (
              <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:13}}>{T2("No items found.")}</div>
            )}
          </div>

          {/* Footer */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,padding:"0 4px",fontSize:11,color:C.faint}}>
            <span>{filteredItems.length} {T2("items")}</span>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{display:"flex",gap:6}}>
                {Object.entries(VENUE_COLORS).map(([code,vc])=>(
                  <span key={code} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:C.muted}}>
                    <span style={{width:8,height:8,borderRadius:2,background:vc.bar}}/> {vc.label}
                  </span>
                ))}
              </div>
              {lastSync && <span>🔄 Synced {lastSync.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"})}</span>}
            </div>
          </div>
          </>}
        </div>
      )}

      {/* ── SCAN & STOCK IN/OUT — REMOVED (V65) ── */}

      {/* ── REQUIREMENTS — event-first with collective toggle ── */}
      {tab==="requirements"&&(()=>{
        const dayEvs = safeEvs.filter(e=>e.date===reqDay).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        const evBags = buildEventBags(dayEvs);

        /* Reshape evBags (per-event, per-section) into ingredient rows with one
           column per category/station, mirroring Kitchen Hub's Ingredient
           Ordering Sheet — minus the yield-adjust slider, which is a Kitchen
           planning concept the Store team has no use for. */
        const catSeen = new Set();
        const rowMap = {};
        Object.values(evBags).forEach(({ev, sections})=>{
          Object.entries(sections).forEach(([sec, secObj])=>{
            catSeen.add(sec);
            Object.values(secObj.items).forEach(ing=>{
              if(!rowMap[ing.name]) rowMap[ing.name]={name:ing.name,hindi:ing.hindi,unit:ing.unit,total:0,byCat:{},evBreak:[],_type:null,ops_inventory_id:null};
              const row=rowMap[ing.name];
              const cellPrev = row.byCat[sec] || {totalQty:0,unit:ing.unit};
              row.byCat[sec] = addQtyWithUnitNorm(cellPrev, ing.totalQty, ing.unit);
              const totMerged = addQtyWithUnitNorm({totalQty:row.total,unit:row.unit}, ing.totalQty, ing.unit);
              row.total = totMerged.totalQty; row.unit = totMerged.unit;
              row.evBreak.push({evId:ev.id, evName:ev.guest, venue:ev.venue||"", sec, qty:ing.totalQty, unit:ing.unit});
              if(!row._type && ing._type==='inv'){ row._type='inv'; row.ops_inventory_id = ing.ops_inventory_id||null; }
            });
          });
        });
        const stations = RECIPE_DB.cats.filter(c=>catSeen.has(c.name));
        const rows = Object.values(rowMap).sort((a,b)=>a.name.localeCompare(b.name));

        /* Stock resolution — same 3-tier unit-conversion chain the old
           Shortages table used (grams, then ml, then a configured conversion
           factor for anything else), so "short" here means the same thing it
           always has. Shared with the issue-quantity helpers above (qtyToStoreUnits)
           so "short of stock" and "how much a pack issues" never drift apart. */
        function resolveStock(row){
          const stock = stockForRow(row);
          const isDirectInv = row._type==='inv' && !!row.ops_inventory_id;
          const isMapped = isDirectInv || !!ingredientMap[row.name];
          if(!isMapped || !stock) return {isMapped, stock:null, requiredSU:null};
          return {isMapped:true, stock, requiredSU: qtyToStoreUnits(row.total, row.unit, stock)};
        }

        function rowIssued(row){ return rowIssueAgg(row).remaining<=1e-9; }

        const orderListsForDay = orderListItems.filter(r=>r.order_date===reqDay);
        function orderListFor(name){ return orderListsForDay.find(r=>r.ingredient_name===name); }

        const todayFnCount = safeEvs.filter(e=>e.date===TODAY).length;
        const tmrwFnCount = safeEvs.filter(e=>e.date===TOMORROW).length;

        let shortCount=0, issuedCount=0, orderedRowCount=0;
        rows.forEach(row=>{
          const {isMapped, stock, requiredSU} = resolveStock(row);
          if(isMapped && stock && requiredSU!=null && requiredSU>stock.available) shortCount++;
          if(rowIssued(row)) issuedCount++;
          if(orderListFor(row.name)) orderedRowCount++;
        });

        // Group into the same 4 fixed buckets the Order Lists tab shows —
        // by the ingredient's own name, not whichever Ops inventory item (if
        // any) it happens to be linked to, so a dish's ingredients group the
        // same way whether or not "link to store" has been done for it yet.
        const rowGroups = (function(){
          const buckets = {};
          rows.forEach(row=>{
            const meta = categoryMetaForName(row.name);
            (buckets[meta.key] = buckets[meta.key] || {meta, rows:[]}).rows.push(row);
          });
          return orderListCats.map(c=>buckets[c.key]).filter(Boolean);
        })();
        // Stations are cards above the table now (click → modal), not columns.
        // +1 for the Balance column (issued-vs-required / surplus).
        const tableColSpan = 2 + 3 + 1;
        const openStation = stations.find(st=>st.id===reqStation) || null;
        const openStationRows = openStation ? rows.filter(r=>r.byCat[openStation.name]) : [];
        // Station modal actions: the same ✓ issue / + order-list buttons as the
        // table, per row, plus an "all" version of each for the whole station.
        const groupKeyByRow = {};
        rowGroups.forEach(g=>g.rows.forEach(r=>{ groupKeyByRow[r.name] = g.meta.key; }));
        // Same 4-bucket grouping as the "All ingredients" table, scoped to
        // just this station's rows — a station used to list its ingredients
        // flat, with no way to jump to (say) just its Dairy items.
        const stationRowGroups = (function(){
          const buckets = {};
          openStationRows.forEach(row=>{
            const meta = categoryMetaForName(row.name);
            (buckets[meta.key] = buckets[meta.key] || {meta, rows:[]}).rows.push(row);
          });
          return orderListCats.map(c=>buckets[c.key]).filter(Boolean);
        })();
        const stationTableColSpan = 3 + 1;
        const canIssueStock = hasPerm(currentUser,"store.smart_issue");
        const stPending = openStationRows.filter(r=>!rowIssued(r));
        const stUnlisted = openStationRows.filter(r=>!orderListFor(r.name));
        async function issueAllStation(){
          setReqIssueAllAsk(false);
          for(const r of stPending) await quickIssue(r);
        }
        async function listAllStation(){
          setReqListAllAsk(false);
          await addManyToOrderList(stUnlisted.map(r=>({row:r, listKey:groupKeyByRow[r.name]})));
        }

        return(
          <div>
            {/* Header — one warm card: title and the day picker on top, the
                day's functions under a hairline. The page artwork used to show
                straight through the title and the summary pills. */}
            <div style={{background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,borderRadius:20,boxShadow:K.shadowCard,marginBottom:14,position:"relative",zIndex:5,fontFamily:K.fontBody}}>
              <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",padding:"16px 20px"}}>
                <span style={{width:44,height:44,borderRadius:14,flexShrink:0,background:K.brand,color:K.hdrBadgeIcon,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>🧮</span>
                <div style={{flex:"1 1 240px",minWidth:0}}>
                  <div style={{...type.cardTitle,fontSize:18,color:K.hdrTitle}}>{T2("Requirements — Day Sheet")}</div>
                  <div style={{fontSize:12.5,color:K.hdrMeta,marginTop:2}}>{T2("One ordering sheet per day — every function on that day, combined.")}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",padding:3,borderRadius:999,background:"#F0EEE7",border:`1px solid ${K.cardWarmLine}`}}>
                    {[{d:TODAY,l:T2("Today"),n:todayFnCount},{d:TOMORROW,l:T2("Tomorrow"),n:tmrwFnCount}].map(o=>{const on=reqDay===o.d;return(
                      <button key={o.l} onClick={()=>setReqDay(o.d)}
                        style={{padding:"7px 16px",borderRadius:999,fontSize:12.5,fontWeight:700,cursor:"pointer",border:"none",
                          background:on?K.brand:"transparent",color:on?"#FFFFFF":K.textBody,boxShadow:on?K.shadowCard:"none"}}>
                        {o.l} <span style={{opacity:.75,fontVariantNumeric:"tabular-nums"}}>({o.n})</span>
                      </button>);})}
                  </div>
                  <DayPicker value={reqDay} onChange={setReqDay} markDates={new Set(safeEvs.map(e=>e.date))} T2={T2}/>
                </div>
              </div>
              {dayEvs.length>0 ? (
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"12px 20px",borderTop:`1px solid ${K.cardWarmLine}`,background:"#FFFFFF80",borderRadius:"0 0 20px 20px"}}>
                  <span style={{fontSize:11,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6}}>
                    {dayEvs.length} {T2("function")}{dayEvs.length===1?"":"s"} {T2("combined")}
                  </span>
                  {dayEvs.map(ev=>(
                    <span key={ev.id} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:999,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`}}>
                      <span style={{fontSize:13,fontWeight:700,color:K.hdrTitle}}>{ev.guest}</span>
                      <span style={{fontSize:12,color:K.hdrMeta,fontVariantNumeric:"tabular-nums"}}>{ev.pax} {T2("pax")} · {ev.time||"TBD"}</span>
                    </span>
                  ))}
                  <span style={{marginLeft:"auto",display:"inline-flex",alignItems:"baseline",gap:5}}>
                    <span style={{fontSize:20,fontWeight:700,color:K.hdrTitle,fontVariantNumeric:"tabular-nums"}}>{dayEvs.reduce((s,e)=>s+(+e.pax||0),0)}</span>
                    <span style={{fontSize:12,color:K.hdrMeta}}>{T2("pax total")}</span>
                  </span>
                </div>
              ) : (
                <div style={{padding:"28px 20px",borderTop:`1px solid ${K.cardWarmLine}`,textAlign:"center",color:K.hdrMeta,fontSize:13}}>
                  {T2("No functions scheduled — nothing to prep or order yet.")}
                </div>
              )}
            </div>

            {issueLoading&&<div style={{textAlign:"center",padding:20,color:K.hdrMeta,fontSize:12}}>{T2("Loading issue state…")}</div>}

            {dayEvs.length>0 && rows.length===0 && (
              <div style={{textAlign:"center",padding:40,background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,borderRadius:16,color:K.hdrMeta,fontSize:13}}>{T2("No ingredient data for this day's dishes.")}</div>
            )}

            {dayEvs.length>0 && rows.length>0 && (
              <>
                {/* Summary — plain counts, not cards: nothing here is clickable, so
                    nothing here should look like a button. A zero goes grey. */}
                <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center",fontFamily:K.fontBody}}>
                  {[{n:rows.length,l:T2("ingredient lines"),fg:K.brandText,bg:K.brandBg},
                    {n:shortCount,l:T2("short of stock"),fg:K.danger,bg:K.dangerBg},
                    {n:issuedCount,l:T2("issued"),fg:K.ok,bg:K.okBg},
                    {n:orderedRowCount,l:T2("on order lists"),fg:K.warn,bg:K.warnBg}].map((t,ti)=>(
                    <span key={t.l} style={{display:"inline-flex",alignItems:"baseline",gap:6,padding:"7px 14px",borderRadius:10,background:t.n>0?t.bg:"#F0EEE7"}}>
                                            <span style={{fontSize:18,fontWeight:700,color:t.n>0?t.fg:K.textMuted,fontVariantNumeric:"tabular-nums"}}>{t.n}</span>
                      <span style={{fontSize:12.5,fontWeight:600,color:t.n>0?t.fg:K.textMuted}}>{t.l}</span>
                    </span>))}
                  <div style={{flex:1}}/>
                  {transferRequests.filter(r=>r.status==='open').length>0 && (
                    <button onClick={()=>setTransferListOpen(true)} title={T2("Open cross-venue stock requests")}
                      style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,color:K.warn,background:K.warnBg,border:`1px solid ${K.warnBorder}`,borderRadius:999,padding:"10px 18px",cursor:"pointer",fontFamily:K.fontBody}}>
                      🚚 {transferRequests.filter(r=>r.status==='open').length} {T2("transfer requests")}
                    </button>
                  )}
                  <button onClick={openIngDedup} title={T2("Scan for similar/duplicate ingredient names to merge")}
                    style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,color:K.textBody,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,borderRadius:999,padding:"10px 18px",cursor:"pointer",boxShadow:K.shadowCard,fontFamily:K.fontBody}}>
                    🔍 {T2("Find duplicates")}
                  </button>
                </div>

                {/* Merge selection bar — same flow as Ingredient Map: tick 2+ rows' checkboxes to
                    merge duplicate/similar ingredient names into one, across every recipe that uses them. */}
                {Object.keys(ingSelected).length>0&&(
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:C.goldBg,border:`1px solid ${C.gold}`,marginBottom:12,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,fontWeight:600,color:"#854F0B"}}>{Object.keys(ingSelected).length} {T2("selected")}</span>
                    <div style={{flex:1}}/>
                    <button onClick={()=>setIngSelected({})} style={{fontSize:11,padding:"6px 12px",borderRadius:8,background:"transparent",color:"#854F0B",border:`1px solid ${C.gold}`,cursor:"pointer",fontWeight:600}}>{T2("Clear")}</button>
                    <button disabled={Object.keys(ingSelected).length<2}
                      onClick={()=>{
                        const names = Object.keys(ingSelected);
                        const first = allRecipeIngredients.find(i=>i.name===names[0]);
                        setIngMergeModal({ sources: names, target: names[0], unit: first?.unit||"" });
                      }}
                      style={{fontSize:11,padding:"6px 14px",borderRadius:8,background:Object.keys(ingSelected).length<2?C.border:C.gold,color:Object.keys(ingSelected).length<2?C.muted:C.goldBg,border:"none",cursor:Object.keys(ingSelected).length<2?"not-allowed":"pointer",fontWeight:700}}>
                      🔗 {T2("Merge into one")}
                    </button>
                  </div>
                )}

                {/* Stations as cards — one per kitchen section that needs ingredients
                    today. A card opens a modal with that section's own list. */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12,marginBottom:14}}>
                  {stations.map(st=>{
                    const n = rows.filter(r=>r.byCat[st.name]).length;
                    return(
                      <button key={st.id} onClick={()=>setReqStation(st.id)} className="kh-hovercard"
                        style={{display:"flex",alignItems:"center",gap:12,padding:"13px 15px",borderRadius:16,cursor:"pointer",textAlign:"left",
                          background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,fontFamily:K.fontBody}}>
                        <span style={{width:40,height:40,borderRadius:12,flexShrink:0,background:K.sageBg,border:`1px solid ${K.sageBorder}`,
                          fontSize:19,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>{st.icon}</span>
                        <span style={{flex:1,minWidth:0}}>
                          <span style={{display:"block",fontSize:13.5,fontWeight:700,color:K.hdrTitle,lineHeight:1.25}}>{st.name}</span>
                          <span style={{display:"block",fontSize:12,color:K.hdrMeta,marginTop:2,fontVariantNumeric:"tabular-nums"}}>{n} {T2("ingredients")}</span>
                        </span>
                        <span style={{color:K.textFaint,fontSize:16,flexShrink:0}}>›</span>
                      </button>
                    );
                  })}
                  {/* The full combined ingredient table (Total / Stock / issue /
                      order list / merge) as one more card in the same grid —
                      closed by default, opens the table below. */}
                  <button onClick={()=>setReqShowAll(v=>!v)} aria-expanded={reqShowAll} className="kh-hovercard"
                    style={{display:"flex",alignItems:"center",gap:12,padding:"13px 15px",borderRadius:16,cursor:"pointer",textAlign:"left",
                      background:reqShowAll?K.brandSoft:K.cardWarm,border:`1px solid ${reqShowAll?K.brand:K.cardWarmLine}`,boxShadow:K.shadowCard,fontFamily:K.fontBody}}>
                    <span style={{width:40,height:40,borderRadius:12,flexShrink:0,background:K.brand,color:K.hdrBadgeIcon,
                      fontSize:18,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>📋</span>
                    <span style={{flex:1,minWidth:0}}>
                      <span style={{display:"block",fontSize:13.5,fontWeight:700,color:K.hdrTitle,lineHeight:1.25}}>{T2("All ingredients")}</span>
                      <span style={{display:"block",fontSize:12,color:K.hdrMeta,marginTop:2,fontVariantNumeric:"tabular-nums"}}>{rows.length} {T2("ingredients")} · {reqShowAll?T2("tap to hide"):T2("tap to view")}</span>
                    </span>
                    <span style={{color:K.textFaint,fontSize:16,flexShrink:0,display:"inline-block",transition:"transform .15s",transform:reqShowAll?"rotate(90deg)":"none"}}>›</span>
                  </button>
                </div>

                {/* All ingredients — the full combined table, opened from its card
                    in a modal like the station lists. z-index sits under the
                    store's own pop-ups (link to store, merge: 999/1000) so those
                    still open on top of it. */}
                {reqShowAll && (
                <div onClick={()=>setReqShowAll(false)} role="presentation"
                  style={{position:"fixed",inset:0,zIndex:900,background:"rgba(20,28,24,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
                <div role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}
                  style={{position:"relative",background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,borderRadius:22,boxShadow:K.shadowLift,
                    width:"100%",maxWidth:1200,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:K.fontBody}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 22px",borderBottom:`1px solid ${K.cardWarmLine}`,flexWrap:"wrap"}}>
                    <span style={{width:42,height:42,borderRadius:13,flexShrink:0,background:K.brand,color:K.hdrBadgeIcon,fontSize:19,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>📋</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:18,fontWeight:700,color:K.hdrTitle}}>{T2("All ingredients")}</div>
                      <div style={{fontSize:12.5,color:K.hdrMeta,marginTop:2,fontVariantNumeric:"tabular-nums"}}>{rows.length} {T2("ingredients")} · {dayEvs.length} {T2("function")}{dayEvs.length===1?"":"s"} · {reqDay}</div>
                    </div>
                    {Object.keys(ingSelected).length>0&&(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:12.5,fontWeight:600,color:K.hdrMeta}}>{Object.keys(ingSelected).length} {T2("selected")}</span>
                        <button onClick={()=>setIngSelected({})} style={{padding:"7px 14px",borderRadius:999,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.textBody,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>{T2("Clear")}</button>
                        <button disabled={Object.keys(ingSelected).length<2}
                          onClick={()=>{const names=Object.keys(ingSelected);const first=allRecipeIngredients.find(i=>i.name===names[0]);setIngMergeModal({sources:names,target:names[0],unit:first?.unit||""});}}
                          style={{padding:"7px 16px",borderRadius:999,border:"none",fontSize:12.5,fontWeight:700,
                            background:Object.keys(ingSelected).length<2?K.cardWarmLine:K.brand,color:Object.keys(ingSelected).length<2?K.textFaint:"#FFFFFF",
                            cursor:Object.keys(ingSelected).length<2?"not-allowed":"pointer"}}>🔗 {T2("Merge into one")}</button>
                      </div>
                    )}
                    <button onClick={()=>setReqShowAll(false)} aria-label={T2("Close")}
                      style={{width:34,height:34,borderRadius:999,border:`1px solid ${K.cardWarmLine}`,background:"#FFFFFF",color:K.textMuted,cursor:"pointer",fontSize:16,lineHeight:1,flexShrink:0}}>×</button>
                  </div>
                <div style={{flex:1,minHeight:0,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                  {/* Scrolls inside the card so the column heads stay in view
                      over a few hundred ingredient rows. */}
                  <div style={{overflow:"auto",flex:1,minHeight:0}}>
                    <table style={{borderCollapse:"separate",borderSpacing:0,fontSize:12,width:"100%",fontFamily:K.fontBody}}>
                      <thead>
                        <tr>
                          <th style={{position:"sticky",top:0,left:0,background:"#F4F2EC",zIndex:7,textAlign:"left",padding:"11px 14px",fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6,borderBottom:`1px solid ${K.cardWarmLine}`,minWidth:190,maxWidth:190}}>{T2("Item")}</th>
                          <th style={{position:"sticky",top:0,zIndex:5,background:"#F4F2EC",textAlign:"center",padding:"11px 6px",fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6,borderBottom:`1px solid ${K.cardWarmLine}`}}>{T2("UM")}</th>
                          <th style={{position:"sticky",top:0,zIndex:5,background:K.brandSoft,textAlign:"right",padding:"11px 14px",fontSize:10.5,fontWeight:700,color:K.hdrTitle,textTransform:"uppercase",letterSpacing:.6,borderBottom:`1px solid ${K.cardWarmLine}`}}>{T2("Total")}</th>
                          <th style={{position:"sticky",top:0,zIndex:5,background:"#F4F2EC",textAlign:"right",padding:"11px 14px",fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6,borderBottom:`1px solid ${K.cardWarmLine}`}}>{T2("Stock")}</th>
                          <th style={{position:"sticky",top:0,zIndex:5,background:"#F4F2EC",textAlign:"right",padding:"11px 14px",fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6,borderBottom:`1px solid ${K.cardWarmLine}`}}>{T2("Balance")}</th>
                          <th style={{position:"sticky",top:0,zIndex:5,background:"#F4F2EC",textAlign:"center",padding:"11px 14px",fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6,borderBottom:`1px solid ${K.cardWarmLine}`,minWidth:110}}>{T2("Actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowGroups.map(group=>{
                          const closed = !!reqCatClosed[group.meta.key];
                          return (
                          <React.Fragment key={group.meta.key}>
                            <tr onClick={()=>setReqCatClosed(p=>({...p,[group.meta.key]:!closed}))} style={{cursor:"pointer"}}>
                              <td colSpan={tableColSpan} style={{padding:"10px 14px",fontWeight:700,fontSize:11.5,color:group.meta.color,background:group.meta.bg,textTransform:"uppercase",letterSpacing:.6,borderTop:`1px solid ${K.cardWarmLine}`,borderBottom:`1px solid ${K.cardWarmLine}`,borderLeft:`4px solid ${group.meta.color}`,userSelect:"none"}}>
                                <span style={{display:"inline-block",width:12,transition:"transform .15s",transform:closed?"rotate(-90deg)":"rotate(0deg)"}}>▾</span>{" "}
                                {group.meta.icon} {group.meta.label} <span style={{opacity:.75,fontWeight:600}}>({group.rows.length})</span>
                              </td>
                            </tr>
                            {!closed && group.rows.map((row,ri)=>{
                              const {isMapped, stock, requiredSU} = resolveStock(row);
                              const short = isMapped && stock && requiredSU!=null && requiredSU>stock.available;
                              const venueSf = isMapped && stock ? rowVenueShortfalls(row, stock) : [];
                              const agg = rowIssueAgg(row);
                              const done = agg.remaining<=1e-9;
                              const list = orderListFor(row.name);
                              const listMeta = list ? categoryMetaForName(row.name) : null;
                              const fullTitle = row.name+(row.hindi?" ("+row.hindi+")":"");
                              return (
                                <tr key={row.name} className="req-row" style={{background:ri%2?"rgba(0,0,0,.018)":"transparent"}}>
                                  <td style={{position:"sticky",left:0,background:ri%2?"#F9F8F3":K.cardWarm,padding:"9px 14px",fontWeight:600,fontSize:13,color:K.hdrTitle,verticalAlign:"middle",maxWidth:190,borderBottom:`1px solid ${K.lineSoft}`,zIndex:2}} title={fullTitle}>
                                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                                      <input type="checkbox" checked={!!ingSelected[row.name]}
                                        onChange={()=>setIngSelected(p=>{const n={...p};if(n[row.name])delete n[row.name];else n[row.name]=true;return n;})}
                                        title={T2("Select to merge with other ingredients")}
                                        style={{width:15,height:15,flexShrink:0,cursor:"pointer",accentColor:K.brand}}/>
                                      <span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.name}</span>
                                    </div>
                                  </td>
                                  <td style={{textAlign:"center",padding:"9px 6px",color:K.textFaint,fontSize:11.5,verticalAlign:"middle",borderBottom:`1px solid ${K.lineSoft}`}}>{row.unit}</td>
                                  <td style={{textAlign:"right",padding:"9px 14px",fontWeight:700,fontSize:13,color:K.hdrTitle,fontVariantNumeric:"tabular-nums",verticalAlign:"middle",background:K.brandSoft,borderBottom:`1px solid ${K.lineSoft}`}}>{fmtIssueQty(row.total,row.unit)}</td>
                                  <td style={{textAlign:"right",padding:"9px 14px",verticalAlign:"middle",borderBottom:`1px solid ${K.lineSoft}`}}>
                                    {!isMapped
                                      ? <span onClick={()=>setMapModalIng({name:row.name,hindi:row.hindi||"",unit:row.unit})} style={{cursor:"pointer",fontSize:11,color:C.amber,textDecoration:"underline"}}>{T2("link to store")}</span>
                                      : <span style={{display:"inline-block",padding:"3px 10px",borderRadius:999,fontSize:12,fontWeight:700,fontVariantNumeric:"tabular-nums",
                                          background:short?K.dangerBg:"transparent",color:short?K.danger:K.textBody,
                                          border:`1px solid ${short?K.dangerBorder:"transparent"}`}}>{stock ? fmtIssueQty(stock.available,stock.unit) : "—"}</span>}
                                    {venueSf.map(sf=>(
                                      <div key={sf.venue.venueId} style={{marginTop:3,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4}}>
                                        <span title={T2("Short at")+" "+sf.venue.venueName} style={{fontSize:10,fontWeight:700,color:K.warn,whiteSpace:"nowrap"}}>⚠ {sf.venue.venueCode||sf.venue.venueName} {T2("short")} {fmtIssueQty(sf.shortfall,row.unit)}</span>
                                        {sf.donors.length>0 && hasPerm(currentUser,"store.smart_issue") && (
                                          <button onClick={()=>openTransferRequest(row,stock,sf)} title={T2("Request from another venue")} style={{fontSize:9.5,fontWeight:700,padding:"2px 6px",borderRadius:7,background:"#FFFFFF",color:K.warn,border:`1px solid ${K.warnBorder}`,cursor:"pointer",whiteSpace:"nowrap"}}>{T2("Request")}</button>
                                        )}
                                      </div>
                                    ))}
                                  </td>
                                  <td style={{textAlign:"right",padding:"9px 14px",verticalAlign:"middle",borderBottom:`1px solid ${K.lineSoft}`}}>
                                    {agg.issuedQty<=1e-9
                                      ? <span style={{fontSize:11.5,color:K.textFaint}}>—</span>
                                      : agg.remaining>1e-9
                                      ? <span style={{fontSize:11.5,fontWeight:700,color:K.warn}}>{fmtIssueQty(agg.issuedQty,row.unit)}/{fmtIssueQty(agg.required,row.unit)}</span>
                                      : agg.surplus>1e-9
                                      ? <span title={T2("Issued more than needed")} style={{fontSize:11.5,fontWeight:700,color:K.ok}}>+{fmtIssueQty(agg.surplus,row.unit)}</span>
                                      : <span style={{fontSize:11.5,color:K.textFaint}}>—</span>}
                                  </td>
                                  <td style={{padding:"9px 14px",verticalAlign:"middle",borderBottom:`1px solid ${K.lineSoft}`}}>
                                    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,flexWrap:"nowrap"}}>
                                      {done ? (
                                        <button onClick={()=>openIssueQty(row)} title={T2("Issued — tap to issue more")} style={{width:30,height:30,borderRadius:9,cursor:"pointer",background:C.green,color:"#fff",border:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>✓</button>
                                      ) : (
                                        hasPerm(currentUser,"store.smart_issue") && <>
                                          <button onClick={()=>quickIssue(row)} title={T2("Issue from store")} style={{width:30,height:30,borderRadius:9,cursor:"pointer",background:C.surface,color:C.green,border:`1.5px solid ${C.greenBorder}`,flexShrink:0,fontSize:12,lineHeight:1}}>✓</button>
                                          <button onClick={()=>openIssueQty(row)} title={T2("Issue a custom or partial quantity")} style={{width:24,height:30,borderRadius:9,cursor:"pointer",background:C.surface,color:C.gold,border:`1.5px solid ${C.goldBorder}`,flexShrink:0,fontSize:11,lineHeight:1}}>±</button>
                                        </>
                                      )}
                                      {list ? (
                                        <span title={listMeta.label} style={{display:"flex",alignItems:"center",gap:2,fontSize:12,fontWeight:700,padding:"3px 5px",borderRadius:7,background:listMeta.bg,color:listMeta.color,whiteSpace:"nowrap",flexShrink:0}}>
                                          {listMeta.icon}
                                          <button onClick={()=>removeFromOrderList(row)} aria-label={T2("Remove from order list")} style={{border:"none",background:"transparent",color:"inherit",cursor:"pointer",fontSize:11,padding:0,lineHeight:1}}>×</button>
                                        </span>
                                      ) : (
                                        <button onClick={()=>addToOrderList(row,group.meta.key)} title={T2("Add to")+" "+group.meta.label+" "+T2("order list")} style={{width:30,height:30,borderRadius:9,cursor:"pointer",background:C.surface,color:C.gold,border:`1.5px solid ${C.goldBorder}`,flexShrink:0,fontSize:13,lineHeight:1}}>+</button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                </div>
                </div>
                )}

                {/* Station details modal */}
                {openStation && (
                  <div onClick={()=>{setReqStation(null);setReqIssueAllAsk(false);setReqListAllAsk(false);}} role="presentation"
                    style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(20,28,24,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
                    <div role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}
                      style={{position:"relative",background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,borderRadius:22,boxShadow:K.shadowLift,
                        width:"100%",maxWidth:760,maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:K.fontBody}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,padding:"18px 22px",borderBottom:`1px solid ${K.cardWarmLine}`}}>
                        <span style={{width:42,height:42,borderRadius:13,flexShrink:0,background:K.sageBg,border:`1px solid ${K.sageBorder}`,fontSize:20,lineHeight:1,
                          display:"flex",alignItems:"center",justifyContent:"center"}}>{openStation.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:18,fontWeight:700,color:K.hdrTitle}}>{openStation.name}</div>
                          <div style={{fontSize:12.5,color:K.hdrMeta,marginTop:2}}>{openStationRows.length} {T2("ingredients")} · {dayEvs.length} {T2("function")}{dayEvs.length===1?"":"s"} · {reqDay}</div>
                        </div>
                        <button onClick={()=>{setReqStation(null);setReqIssueAllAsk(false);setReqListAllAsk(false);}} aria-label={T2("Close")}
                          style={{width:34,height:34,borderRadius:999,border:`1px solid ${K.cardWarmLine}`,background:"#FFFFFF",color:K.textMuted,cursor:"pointer",fontSize:16,lineHeight:1,flexShrink:0}}>×</button>
                      </div>
                      {reqNote && (
                        <div style={{padding:"9px 22px",fontSize:12.5,fontWeight:600,
                          background:reqNote.tone==="err"?K.dangerBg:K.okBg,color:reqNote.tone==="err"?K.danger:K.ok,
                          borderBottom:`1px solid ${reqNote.tone==="err"?K.dangerBorder:K.okBorder}`}}>{reqNote.text}</div>
                      )}
                      <div style={{overflowY:"auto",minHeight:0}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                          <thead>
                            <tr>
                              {[{l:"Ingredient",a:"left"},{l:"Needed",a:"right"},{l:"Stock",a:"right"},{l:"Balance",a:"right"}].map(h=>(
                                <th key={h.l} style={{position:"sticky",top:0,background:"#F4F2EC",textAlign:h.a,padding:"10px 22px",fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6,borderBottom:`1px solid ${K.cardWarmLine}`}}>{T2(h.l)}</th>
                              ))}
                              <th style={{position:"sticky",top:0,background:"#F4F2EC",textAlign:"center",padding:"8px 16px",borderBottom:`1px solid ${K.cardWarmLine}`,borderLeft:`1px solid ${K.lineSoft}`,whiteSpace:"nowrap"}}>
                                <div style={{fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>{T2("Actions")}</div>
                                <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                                  {canIssueStock && <button onClick={()=>setReqIssueAllAsk(true)} disabled={stPending.length===0}
                                    title={T2("Issue all from store")}
                                    style={{padding:"3px 9px",borderRadius:8,fontSize:11,fontWeight:700,cursor:stPending.length?"pointer":"not-allowed",
                                      background:"#FFFFFF",color:stPending.length?C.green:K.textFaint,border:`1.5px solid ${stPending.length?C.greenBorder:K.cardWarmLine}`}}>✓ {T2("All")}</button>}
                                  <button onClick={()=>setReqListAllAsk(true)} disabled={stUnlisted.length===0}
                                    title={T2("Add all to order list")}
                                    style={{padding:"3px 9px",borderRadius:8,fontSize:11,fontWeight:700,cursor:stUnlisted.length?"pointer":"not-allowed",
                                      background:"#FFFFFF",color:stUnlisted.length?C.gold:K.textFaint,border:`1.5px solid ${stUnlisted.length?C.goldBorder:K.cardWarmLine}`}}>+ {T2("All")}</button>
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {stationRowGroups.map(group=>{
                              const closed = !!reqCatClosed[group.meta.key];
                              return (
                              <React.Fragment key={group.meta.key}>
                                <tr onClick={()=>setReqCatClosed(p=>({...p,[group.meta.key]:!closed}))} style={{cursor:"pointer"}}>
                                  <td colSpan={stationTableColSpan} style={{padding:"9px 22px",fontWeight:700,fontSize:11.5,color:group.meta.color,background:group.meta.bg,textTransform:"uppercase",letterSpacing:.6,borderTop:`1px solid ${K.cardWarmLine}`,borderBottom:`1px solid ${K.cardWarmLine}`,borderLeft:`4px solid ${group.meta.color}`,userSelect:"none"}}>
                                    <span style={{display:"inline-block",width:12,transition:"transform .15s",transform:closed?"rotate(-90deg)":"rotate(0deg)"}}>▾</span>{" "}
                                    {group.meta.icon} {group.meta.label} <span style={{opacity:.75,fontWeight:600}}>({group.rows.length})</span>
                                  </td>
                                </tr>
                                {!closed && group.rows.map(row=>{
                              const cell = row.byCat[openStation.name];
                              const {isMapped, stock, requiredSU} = resolveStock(row);
                              const short = isMapped && stock && requiredSU!=null && requiredSU>stock.available;
                              const venueSf = isMapped && stock ? rowVenueShortfalls(row, stock) : [];
                              const agg = rowIssueAgg(row);
                              const done = agg.remaining<=1e-9;
                              return(
                                <tr key={row.name}>
                                  <td style={{padding:"10px 22px",fontWeight:600,color:K.hdrTitle,borderBottom:`1px solid ${K.lineSoft}`}}>{row.name}{row.hindi&&<span style={{display:"block",fontSize:11.5,fontWeight:400,color:K.hdrMeta}}>{row.hindi}</span>}</td>
                                  <td style={{padding:"10px 22px",textAlign:"right",fontWeight:700,color:K.hdrTitle,fontVariantNumeric:"tabular-nums",borderBottom:`1px solid ${K.lineSoft}`}}>{fmtIssueQty(cell.totalQty,cell.unit)}</td>
                                  <td style={{padding:"10px 22px",textAlign:"right",borderBottom:`1px solid ${K.lineSoft}`}}>
                                    {!isMapped
                                      ? <span style={{fontSize:11.5,color:K.textFaint}}>—</span>
                                      : <span style={{display:"inline-block",padding:"3px 10px",borderRadius:999,fontSize:12,fontWeight:700,fontVariantNumeric:"tabular-nums",
                                          background:short?K.dangerBg:"transparent",color:short?K.danger:K.textBody,border:`1px solid ${short?K.dangerBorder:"transparent"}`}}>{stock?fmtIssueQty(stock.available,stock.unit):"—"}</span>}
                                    {venueSf.map(sf=>(
                                      <div key={sf.venue.venueId} style={{marginTop:3,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4}}>
                                        <span title={T2("Short at")+" "+sf.venue.venueName} style={{fontSize:10,fontWeight:700,color:K.warn,whiteSpace:"nowrap"}}>⚠ {sf.venue.venueCode||sf.venue.venueName} {T2("short")} {fmtIssueQty(sf.shortfall,row.unit)}</span>
                                        {sf.donors.length>0 && hasPerm(currentUser,"store.smart_issue") && (
                                          <button onClick={()=>openTransferRequest(row,stock,sf)} title={T2("Request from another venue")} style={{fontSize:9.5,fontWeight:700,padding:"2px 6px",borderRadius:7,background:"#FFFFFF",color:K.warn,border:`1px solid ${K.warnBorder}`,cursor:"pointer",whiteSpace:"nowrap"}}>{T2("Request")}</button>
                                        )}
                                      </div>
                                    ))}
                                  </td>
                                  <td style={{padding:"10px 22px",textAlign:"right",borderBottom:`1px solid ${K.lineSoft}`}}>
                                    {agg.issuedQty<=1e-9
                                      ? <span style={{fontSize:11.5,color:K.textFaint}}>—</span>
                                      : agg.remaining>1e-9
                                      ? <span style={{fontSize:11.5,fontWeight:700,color:K.warn}}>{fmtIssueQty(agg.issuedQty,row.unit)}/{fmtIssueQty(agg.required,row.unit)}</span>
                                      : agg.surplus>1e-9
                                      ? <span title={T2("Issued more than needed")} style={{fontSize:11.5,fontWeight:700,color:K.ok}}>+{fmtIssueQty(agg.surplus,row.unit)}</span>
                                      : <span style={{fontSize:11.5,color:K.textFaint}}>—</span>}
                                  </td>
                                  <td style={{padding:"8px 16px",borderBottom:`1px solid ${K.lineSoft}`,borderLeft:`1px solid ${K.lineSoft}`}}>
                                    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                                      {done ? (
                                        <button onClick={()=>openIssueQty(row)} title={T2("Issued — tap to issue more")} style={{width:30,height:30,borderRadius:9,cursor:"pointer",background:C.green,color:"#fff",border:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0}}>✓</button>
                                      ) : (
                                        canIssueStock && <>
                                          <button onClick={()=>quickIssue(row)} title={T2("Issue from store")} style={{width:30,height:30,borderRadius:9,cursor:"pointer",background:C.surface,color:C.green,border:`1.5px solid ${C.greenBorder}`,flexShrink:0,fontSize:13,lineHeight:1}}>✓</button>
                                          <button onClick={()=>openIssueQty(row)} title={T2("Issue a custom or partial quantity")} style={{width:24,height:30,borderRadius:9,cursor:"pointer",background:C.surface,color:C.gold,border:`1.5px solid ${C.goldBorder}`,flexShrink:0,fontSize:12,lineHeight:1}}>±</button>
                                        </>
                                      )}
                                      {orderListFor(row.name) ? (
                                        <span title={T2("On order list")} style={{display:"flex",alignItems:"center",gap:3,fontSize:12,fontWeight:700,padding:"4px 7px",borderRadius:9,background:C.goldBg,color:C.gold,flexShrink:0}}>
                                          ✓<button onClick={()=>removeFromOrderList(row)} aria-label={T2("Remove from order list")} style={{border:"none",background:"transparent",color:"inherit",cursor:"pointer",fontSize:12,padding:0,lineHeight:1}}>×</button>
                                        </span>
                                      ) : (
                                        <button onClick={()=>addToOrderList(row,groupKeyByRow[row.name])} title={T2("Add to order list")} style={{width:30,height:30,borderRadius:9,cursor:"pointer",background:C.surface,color:C.gold,border:`1.5px solid ${C.goldBorder}`,flexShrink:0,fontSize:14,lineHeight:1}}>+</button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                                })}
                              </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {(reqIssueAllAsk||reqListAllAsk) && (
                      <div onClick={e=>{e.stopPropagation();setReqIssueAllAsk(false);setReqListAllAsk(false);}} role="presentation"
                        style={{position:"fixed",inset:0,zIndex:9100,background:"rgba(20,28,24,.35)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
                        <div role="alertdialog" aria-modal="true" onClick={e=>e.stopPropagation()}
                          style={{background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,borderRadius:20,boxShadow:K.shadowLift,width:"100%",maxWidth:400,padding:"22px 24px",fontFamily:K.fontBody}}>
                          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                            <span style={{width:40,height:40,borderRadius:12,flexShrink:0,background:K.warnBg,border:`1px solid ${K.warnBorder}`,color:K.warn,fontSize:18,
                              display:"flex",alignItems:"center",justifyContent:"center"}}>{reqListAllAsk?"+":"✓"}</span>
                            <div style={{fontSize:17,fontWeight:700,color:K.hdrTitle}}>{reqListAllAsk?T2("Add all to order list?"):T2("Issue all from store?")}</div>
                          </div>
                          <div style={{fontSize:13.5,color:K.textBody,lineHeight:1.5,marginBottom:18}}>
                            {reqListAllAsk
                              ? <>{T2("This adds")} <b>{stUnlisted.length}</b> {T2("ingredients from")} <b>{openStation.name}</b> {T2("to the order list for")} <b>{reqDay}</b>.</>
                              : <>{T2("This marks")} <b>{stPending.length}</b> {T2("ingredients as issued for")} <b>{openStation.name}</b>.</>}
                          </div>
                          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                            <button onClick={()=>{setReqIssueAllAsk(false);setReqListAllAsk(false);}}
                              style={{padding:"9px 18px",borderRadius:999,border:`1px solid ${K.cardWarmLine}`,background:"#FFFFFF",color:K.textBody,fontSize:13,fontWeight:600,cursor:"pointer"}}>{T2("Cancel")}</button>
                            <button onClick={reqListAllAsk?listAllStation:issueAllStation}
                              style={{padding:"9px 20px",borderRadius:999,border:"none",background:K.brand,color:"#FFFFFF",fontSize:13,fontWeight:700,cursor:"pointer"}}>{reqListAllAsk?T2("Add all"):T2("Issue all")}</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── ORDER LISTS — one card per live Ops category ── */}
      {tab==="orderlists"&&(()=>{
        // Only show categories that actually have something on order — a
        // card per Ops category (9+) sitting empty is more clutter than help.
        const visibleGroups = buildOrderListGroups();
        return(
          <div style={{fontFamily:K.fontBody}}>
            {/* Header — one warm card, same anatomy as the Day Sheet header.
                The title used to sit straight on the page artwork. */}
            {(()=>{
              const totalItems = visibleGroups.reduce((n,g)=>n+g.list.length,0);
              const orderedItems = visibleGroups.reduce((n,g)=>n+g.list.filter(i=>i.ordered).length,0);
              // Nothing on order: the empty-state card below already says what this tab is.
              if(visibleGroups.length===0) return null;
              return(
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",padding:"10px 16px",marginBottom:12,borderRadius:16,
                background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard}}>
                <span style={{width:34,height:34,borderRadius:11,flexShrink:0,background:K.brand,color:K.hdrBadgeIcon,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>🧺</span>
                <div style={{flex:"1 1 200px",minWidth:0}}>
                  <div style={{...type.cardTitle,fontSize:15.5,color:K.hdrTitle}}>{T2("Order Lists")}</div>
                  <div style={{fontSize:12,color:K.hdrMeta,marginTop:1}}>{T2("Grouped by inventory category")}</div>
                </div>
                {visibleGroups.length>0&&(
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[{n:visibleGroups.length,l:T2("lists"),fg:K.brandText,bg:K.brandBg},
                      {n:totalItems,l:T2("items"),fg:K.warn,bg:K.warnBg},
                      {n:orderedItems,l:T2("ordered"),fg:K.ok,bg:K.okBg}].map(t=>(
                      <span key={t.l} style={{display:"inline-flex",alignItems:"baseline",gap:6,padding:"7px 14px",borderRadius:10,background:t.n>0?t.bg:"#F0EEE7"}}>
                        <span style={{fontSize:18,fontWeight:700,color:t.n>0?t.fg:K.textMuted,fontVariantNumeric:"tabular-nums"}}>{t.n}</span>
                        <span style={{fontSize:12.5,fontWeight:600,color:t.n>0?t.fg:K.textMuted}}>{t.l}</span>
                      </span>
                    ))}
                  </div>
                )}
                {visibleGroups.length>0&&(
                  <button onClick={()=>setPrintReq({mode:"all"})} className="kh-hovercard"
                    style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 18px",borderRadius:999,background:K.brand,color:"#FFFFFF",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",boxShadow:K.shadowCard}}>
                    🖨 {T2("Print all")} <span style={{opacity:.75}}>({visibleGroups.length} {T2("pages")})</span>
                  </button>
                )}
              </div>);
            })()}

            {orderListLoading&&<div style={{textAlign:"center",padding:20,color:K.hdrMeta,fontSize:12.5}}>{T2("Loading…")}</div>}

            {!orderListLoading&&visibleGroups.length===0&&(
              <div style={{textAlign:"center",padding:"36px 20px",borderRadius:20,background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard}}>
                <div style={{width:56,height:56,borderRadius:18,margin:"0 auto 12px",background:K.sageBg,border:`1px solid ${K.sageBorder}`,fontSize:26,display:"flex",alignItems:"center",justifyContent:"center"}}>🧺</div>
                <div style={{fontSize:16,fontWeight:700,color:K.hdrTitle}}>{T2("No order lists yet")}</div>
                <div style={{fontSize:13,color:K.hdrMeta,marginTop:4,maxWidth:420,marginLeft:"auto",marginRight:"auto",lineHeight:1.5}}>
                  {T2("Use + on an ingredient in the Requirements Day Sheet to send it here. Items are grouped by inventory category, ready to print for each vendor.")}
                </div>
                <button onClick={()=>setTab("requirements")} className="kh-hovercard"
                  style={{marginTop:16,display:"inline-flex",alignItems:"center",gap:7,padding:"10px 20px",borderRadius:999,background:K.brand,color:"#FFFFFF",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:K.shadowCard}}>
                  🧮 {T2("Go to Requirements")} →
                </button>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14,alignItems:"start"}}>
              {visibleGroups.map(({meta,list})=>{
                const done = list.filter(i=>i.ordered).length;
                const pct = list.length>0 ? Math.round(done/list.length*100) : 0;
                return(
                <div key={meta.key} style={{borderRadius:18,background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,overflow:"hidden"}}>
                  <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${K.cardWarmLine}`}}>
                    <span style={{width:40,height:40,borderRadius:12,flexShrink:0,background:meta.bg,border:`1px solid ${meta.color}33`,fontSize:19,display:"flex",alignItems:"center",justifyContent:"center"}}>{meta.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14.5,fontWeight:700,color:K.hdrTitle}}>{meta.label}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
                        <div style={{flex:1,height:5,borderRadius:99,background:K.lineSoft,overflow:"hidden"}}>
                          <div style={{width:pct+"%",height:"100%",borderRadius:99,background:meta.color,transition:"width .3s"}}/>
                        </div>
                        <span style={{fontSize:11.5,fontWeight:700,color:K.hdrMeta,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{done}/{list.length} {T2("ordered")}</span>
                      </div>
                    </div>
                    <button onClick={()=>setPrintReq({mode:"one",key:meta.key})} title={T2("Print this category's order list")} className="kh-calnav"
                      style={{width:34,height:34,borderRadius:999,flexShrink:0,cursor:"pointer",background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,fontSize:14,lineHeight:1}}>🖨</button>
                  </div>
                  {list.map((item,ii)=>(
                    <div key={item.order_date+item.ingredient_name} onClick={()=>toggleOrdered(item)} role="checkbox" aria-checked={!!item.ordered} tabIndex={0}
                      onKeyDown={e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();toggleOrdered(item);}}}
                      className="kh-secrow"
                      style={{padding:"11px 16px",borderTop:ii>0?`1px solid ${K.lineSoft}`:"none",display:"flex",alignItems:"center",gap:12,cursor:"pointer",
                        background:item.ordered?K.okBg+"80":"transparent"}}>
                      <span style={{width:22,height:22,flexShrink:0,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",
                        border:`1.5px solid ${item.ordered?K.ok:K.lineStrong||K.cardWarmLine}`,background:item.ordered?K.ok:"#FFFFFF",color:"#FFFFFF",fontSize:12,fontWeight:700}}>{item.ordered?"✓":""}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13.5,fontWeight:600,color:item.ordered?K.textFaint:K.hdrTitle,textDecoration:item.ordered?"line-through":"none"}}>{item.ingredient_name}</div>
                        <div style={{fontSize:11.5,color:K.hdrMeta,marginTop:2}}>{T2("for")} {item.source||"—"} · {item.order_date}</div>
                      </div>
                      <span style={{flexShrink:0,padding:"4px 10px",borderRadius:999,fontSize:12.5,fontWeight:700,fontVariantNumeric:"tabular-nums",
                        background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:item.ordered?K.textFaint:K.hdrTitle}}>{fmtIssueQty(item.qty,item.unit)}</span>
                    </div>
                  ))}
                </div>);
              })}
            </div>
          </div>
        );
      })()}

      {/* ── EVENT REQUIREMENTS ── */}


      {/* ── INGREDIENT MAP (admin) ── */}
      {tab==="ingmap"&&(()=>{
        const total = allRecipeIngredients.length;
        // 9D — inv-mapped counts as mapped (skips ingredient_item_map)
        const mappedCount = allRecipeIngredients.filter(i => i.hasInv || ingredientMap[i.name]).length;
        const unmappedCount = total - mappedCount;

        // Filter + search
        let filtered = allRecipeIngredients;
        if (mapTabFilter === "mapped") filtered = filtered.filter(i => i.hasInv || ingredientMap[i.name]);
        if (mapTabFilter === "unmapped") filtered = filtered.filter(i => !i.hasInv && !ingredientMap[i.name]);
        if (mapTabSearch) {
          const s = mapTabSearch.toLowerCase();
          filtered = filtered.filter(i => i.name.toLowerCase().includes(s) || (i.hindi||"").includes(s));
        }

        return (
          <div style={{fontFamily:K.fontBody}}>
            {/* Header — title and progress in one warm card (the title used to
                sit on the page artwork, the progress in a second box). */}
            {(()=>{
              const pct = total>0 ? Math.round(mappedCount/total*100) : 0;
              const allDone = total>0 && mappedCount===total;
              return(
              <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",padding:"12px 18px",marginBottom:12,borderRadius:16,
                background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard}}>
                <span style={{width:36,height:36,borderRadius:11,flexShrink:0,background:K.brand,color:K.hdrBadgeIcon,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>🔗</span>
                <div style={{flex:"0 1 auto",minWidth:0}}>
                  <div style={{...type.cardTitle,fontSize:15.5,color:K.hdrTitle}}>{T2("Ingredient Map")}</div>
                  <div style={{fontSize:12,color:K.hdrMeta,marginTop:1}}>{T2("Link recipe ingredients to store items for stock tracking")}</div>
                </div>
                <div style={{flex:"1 1 260px",display:"flex",alignItems:"center",gap:12,minWidth:220}}>
                  <div style={{flex:1,height:8,borderRadius:99,background:K.lineSoft,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:99,width:pct+"%",background:allDone?K.ok:K.brand,transition:"width .3s"}}/>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:K.hdrTitle,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{mappedCount} / {total} <span style={{fontWeight:500,color:K.hdrMeta}}>{T2("linked")}</span></span>
                  <span style={{padding:"4px 10px",borderRadius:999,fontSize:12,fontWeight:700,whiteSpace:"nowrap",
                    background:allDone?K.okBg:K.warnBg,color:allDone?K.ok:K.warn}}>{allDone?"✓ "+T2("All linked"):unmappedCount+" "+T2("remaining")}</span>
                </div>
              </div>);
            })()}

            {/* Toolbar — filter, search, duplicates, merge selection */}
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"10px 14px",marginBottom:12,borderRadius:16,
              background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard}}>
              <div style={{display:"flex",padding:3,borderRadius:999,background:"#F0EEE7",border:`1px solid ${K.cardWarmLine}`}}>
                {[{v:"all",l:T2("All"),n:total},{v:"unmapped",l:T2("Unmapped"),n:unmappedCount},{v:"mapped",l:T2("Mapped"),n:mappedCount}].map(f=>{const on=mapTabFilter===f.v;return(
                  <button key={f.v} onClick={()=>{setMapTabFilter(f.v);setMapTabPage(0);}}
                    style={{padding:"6px 14px",borderRadius:999,fontSize:12.5,fontWeight:700,cursor:"pointer",border:"none",
                      background:on?K.brand:"transparent",color:on?"#FFFFFF":K.textBody}}>
                    {f.l} <span style={{opacity:.75,fontVariantNumeric:"tabular-nums"}}>{f.n}</span>
                  </button>);})}
              </div>
              <input value={mapTabSearch} onChange={e=>{setMapTabSearch(e.target.value);setMapTabPage(0);}} placeholder={"🔍 "+T2("Search ingredients...")}
                style={{flex:"1 1 220px",minWidth:0,padding:"9px 14px",borderRadius:999,border:`1px solid ${K.cardWarmLine}`,fontSize:13,color:K.hdrTitle,background:"#FFFFFF",boxSizing:"border-box",fontFamily:K.fontBody,outline:"none"}}/>
              {Object.keys(ingSelected).length>0&&(
                <>
                  <span style={{fontSize:12.5,fontWeight:600,color:K.hdrMeta}}>{Object.keys(ingSelected).length} {T2("selected")}</span>
                  <button onClick={()=>setIngSelected({})} style={{padding:"8px 14px",borderRadius:999,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.textBody,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>{T2("Clear")}</button>
                  <button disabled={Object.keys(ingSelected).length<2}
                    onClick={()=>{
                      const names = Object.keys(ingSelected);
                      const first = allRecipeIngredients.find(i=>i.name===names[0]);
                      setIngMergeModal({ sources: names, target: names[0], unit: first?.unit||"" });
                    }}
                    style={{padding:"8px 16px",borderRadius:999,border:"none",fontSize:12.5,fontWeight:700,
                      background:Object.keys(ingSelected).length<2?K.cardWarmLine:K.brand,color:Object.keys(ingSelected).length<2?K.textFaint:"#FFFFFF",
                      cursor:Object.keys(ingSelected).length<2?"not-allowed":"pointer"}}>🔗 {T2("Merge into one")}</button>
                </>
              )}
              <button onClick={openIngDedup} title={T2("Scan for similar/duplicate ingredient names to merge")}
                style={{padding:"9px 16px",borderRadius:999,background:"#FFFFFF",color:K.textBody,border:`1px solid ${K.cardWarmLine}`,fontSize:12.5,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                🔍 {T2("Find duplicates")}
              </button>
            </div>

            {/* Auto-link all suggestions */}
            {mapTabFilter==="unmapped"&&unmappedCount>0&&unmappedCount<=500&&(()=>{
              const suggestions = allRecipeIngredients.filter(i=>!i.hasInv && !ingredientMap[i.name]).map(i=>({ing:i,match:fuzzyMatchStoreItem(i.name)})).filter(s=>s.match&&s.match.score>=70);
              if(suggestions.length===0) return null;
              return(
                <button onClick={async()=>{
                  for(const s of suggestions){
                    var autoC = calcAutoConversion(s.ing.unit, s.match.item.unit);
                    await saveIngredientMapping(s.ing.name, s.ing.hindi, s.match.item, autoC !== null ? autoC : 1);
                  }
                }} className="kh-hovercard"
                  style={{width:"100%",padding:"12px",borderRadius:14,background:K.brand,color:"#FFFFFF",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:12,boxShadow:K.shadowCard}}>
                  ✨ {T2("Auto-link")} {suggestions.length} {T2("suggested matches")}
                </button>
              );
            })()}

            {filtered.length===0&&(
              <div style={{textAlign:"center",padding:28,borderRadius:16,background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,color:K.hdrMeta,fontSize:13}}>{T2("No ingredients match your filter.")}</div>
            )}

            {/* The list — one card, compact rows (it used to be one tall card
                per ingredient, four to a screen). */}
            {filtered.length>0&&(
              <div style={{borderRadius:18,background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,overflow:"hidden"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 16px",background:"#F4F2EC",borderBottom:`1px solid ${K.cardWarmLine}`}}>
                  <span style={{fontSize:12,color:K.hdrMeta,fontVariantNumeric:"tabular-nums"}}>{T2("Showing")} <b style={{color:K.hdrTitle}}>{mapTabPage*30+1}–{Math.min((mapTabPage+1)*30,filtered.length)}</b> {T2("of")} {filtered.length}</span>
                  <div style={{display:"flex",gap:6}}>
                    {mapTabPage>0&&<button onClick={()=>setMapTabPage(p=>p-1)} style={{padding:"6px 14px",borderRadius:999,fontSize:12,fontWeight:600,cursor:"pointer",background:"#FFFFFF",color:K.textBody,border:`1px solid ${K.cardWarmLine}`}}>‹ {T2("Prev")}</button>}
                    {(mapTabPage+1)*30<filtered.length&&<button onClick={()=>setMapTabPage(p=>p+1)} style={{padding:"6px 14px",borderRadius:999,fontSize:12,fontWeight:700,cursor:"pointer",background:K.brand,color:"#FFFFFF",border:"none"}}>{T2("Next")} ›</button>}
                  </div>
                </div>
                {/* Column heads — recipe ingredient on the left, the store item it
                    draws stock from on the right, so each row reads as A → B. */}
                <div className="kh-ingmap-grid" style={{padding:"8px 16px",borderBottom:`1px solid ${K.cardWarmLine}`,fontSize:10.5,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.5}}>
                  <span/>
                  <span>{T2("Recipe ingredient")}</span>
                  <span/>
                  <span>{T2("Store item")}</span>
                  <span style={{textAlign:"right"}}>{T2("Actions")}</span>
                </div>
                {filtered.slice(mapTabPage*30,(mapTabPage+1)*30).map((ing,ri)=>{
                  const mapping = ingredientMap[ing.name];
                  const isMapped = !!mapping;
                  const suggestion = !isMapped ? fuzzyMatchStoreItem(ing.name) : null;
                  const conv = isMapped ? (mapping.unit_conversion||1) : 1;
                  // Compare units case-insensitively: "Packets" vs "packets" is the
                  // same unit and was being flagged as a mismatch.
                  const unitsDiffer = isMapped && conv===1 && String(ing.unit||"").trim().toLowerCase()!==String(mapping.ops_item_unit||"").trim().toLowerCase();
                  const openConv = (val)=>setConvModal({ingName:ing.name,ingHindi:ing.hindi||"",opsItem:{_opsId:mapping.ops_item_id,name:mapping.ops_item_name,unit:mapping.ops_item_unit},recipeUnit:ing.unit,storeUnit:mapping.ops_item_unit,convValue:val,editMode:true});
                  const smallBtn = {fontSize:11,padding:"2px 9px",borderRadius:999,background:"#FFFFFF",color:K.textMuted,border:`1px solid ${K.cardWarmLine}`,cursor:"pointer",fontFamily:K.fontBody};
                  return(
                    <div key={ing.name} className="kh-secrow kh-ingmap-grid" style={{padding:"10px 16px",borderTop:ri>0?`1px solid ${K.lineSoft}`:"none"}}>
                      <input type="checkbox" checked={!!ingSelected[ing.name]}
                        onChange={()=>setIngSelected(p=>{const n={...p};if(n[ing.name])delete n[ing.name];else n[ing.name]=true;return n;})}
                        title={T2("Select to merge with other ingredients")}
                        style={{width:16,height:16,cursor:"pointer",accentColor:K.brand}}/>

                      {/* Recipe ingredient */}
                      <div style={{minWidth:0}}>
                        <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:13.5,fontWeight:700,color:K.hdrTitle}}>{ing.name}</span>
                          {ing.hindi&&<span style={{fontSize:12,color:K.hdrMeta}}>{ing.hindi}</span>}
                        </div>
                        <div style={{fontSize:11.5,color:K.hdrMeta,marginTop:2,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <span onClick={e=>{e.stopPropagation();setRecipesModalIng(ing);}}
                            style={{cursor:"pointer",color:K.brandText,fontWeight:600,textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:2}}
                            title={T2("Click to see which recipes use this ingredient")}>
                            {ing.dishes.length} {ing.dishes.length===1?T2("recipe"):T2("recipes")}
                          </span>
                          <span>·</span>
                          <span style={{padding:"1px 8px",borderRadius:999,background:"#F0EEE7",color:K.textBody,fontWeight:600}}>{ing.unit}</span>
                          <button onClick={()=>setIngMergeModal({sources:[ing.name],target:ing.name,unit:ing.unit})}
                            title={T2("Edit unit — updates every recipe using this ingredient")} style={smallBtn}>✎</button>
                        </div>
                        <div style={{marginTop:4,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <span style={{fontSize:10.5,color:K.textFaint}}>{T2("Category")}:</span>
                          <select value={mapping&&mapping.category_override?mapping.category_override:""}
                            onChange={e=>saveIngredientCategory(ing.name,e.target.value)}
                            title={T2("Correct the auto-detected ordering-sheet category")}
                            style={{fontSize:10.5,border:`1px solid ${K.cardWarmLine}`,borderRadius:6,padding:"1px 4px",color:K.textBody,background:"#fff",cursor:"pointer"}}>
                            <option value="">{T2(categorizeIngredientWithOverride(ing.name,{}))} ({T2("auto")})</option>
                            {INGR_CATEGORY_ORDER.filter(c=>c!=="Other").map(c=><option key={c} value={c}>{T2(c)}</option>)}
                          </select>
                        </div>
                      </div>

                      <span style={{color:isMapped?K.ok:K.textFaint,fontSize:15,textAlign:"center"}}>→</span>

                      {/* Store item */}
                      <div style={{minWidth:0}}>
                        {isMapped&&(<>
                          <div style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:13,fontWeight:700,color:K.ok}}>✓ {mapping.ops_item_name}</span>
                            <span style={{padding:"1px 8px",borderRadius:999,background:K.okBg,color:K.ok,fontSize:11.5,fontWeight:600}}>{mapping.ops_item_unit}</span>
                          </div>
                          {conv!==1&&(
                            <div style={{fontSize:11.5,color:K.hdrMeta,marginTop:2,display:"flex",alignItems:"center",gap:6}}>
                              1 {mapping.ops_item_unit} = {Math.round(1/conv*10000)/10000} {ing.unit}
                              <button onClick={()=>openConv(String(Math.round(1/conv*10000)/10000))} title={T2("Edit conversion")} style={smallBtn}>✎</button>
                            </div>
                          )}
                          {unitsDiffer&&(
                            <div style={{fontSize:11.5,color:K.warn,marginTop:3,display:"flex",alignItems:"center",gap:6,fontWeight:600,flexWrap:"wrap"}}>
                              ⚠ {ing.unit} → {mapping.ops_item_unit}
                              <button onClick={()=>openConv("")}
                                style={{fontSize:11,padding:"2px 10px",borderRadius:999,background:K.warnBg,color:K.warn,border:`1px solid ${K.warnBorder}`,cursor:"pointer",fontWeight:700}}>{T2("Set conversion")}</button>
                            </div>
                          )}
                        </>)}
                        {!isMapped&&suggestion&&(
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:11.5,color:K.hdrMeta}}>💡</span>
                            <button onClick={()=>handleStoreItemSelect(ing.name, ing.hindi, ing.unit, suggestion.item)} title={T2("Link to this store item")}
                              style={{fontSize:12,padding:"5px 12px",borderRadius:999,background:K.brandSoft,color:K.brandText,border:`1px solid ${K.brandBorder}`,cursor:"pointer",fontWeight:700}}>
                              {suggestion.item.name} <span style={{opacity:.7,fontWeight:600}}>{suggestion.score}%</span>
                            </button>
                          </div>
                        )}
                        {!isMapped&&!suggestion&&<span style={{fontSize:12,color:K.textFaint,fontStyle:"italic"}}>{T2("Not linked")}</span>}
                      </div>

                      {/* Actions */}
                      <div style={{display:"flex",justifyContent:"flex-end",gap:6}}>
                        {isMapped?(
                          <button onClick={()=>removeIngredientMapping(ing.name)} title={T2("Unlink")}
                            style={{padding:"5px 12px",borderRadius:999,background:"#FFFFFF",color:K.danger,border:`1px solid ${K.dangerBorder}`,cursor:"pointer",fontSize:12,fontWeight:600}}>{T2("Unlink")}</button>
                        ):(
                          <button onClick={()=>setMapModalIng({name:ing.name,hindi:ing.hindi,unit:ing.unit})}
                            style={{padding:"5px 12px",borderRadius:999,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                              background:suggestion?"#FFFFFF":K.brand,color:suggestion?K.textBody:"#FFFFFF",boxShadow:suggestion?`inset 0 0 0 1px ${K.cardWarmLine}`:"none"}}>
                            {suggestion?T2("Other")+"…":"🔗 "+T2("Link")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filtered.length>30&&(
                  <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,padding:"12px 16px",borderTop:`1px solid ${K.cardWarmLine}`,background:"#F4F2EC"}}>
                    {mapTabPage>0&&<button onClick={()=>{setMapTabPage(p=>p-1);window.scrollTo({top:0,behavior:"smooth"});}} style={{padding:"7px 16px",borderRadius:999,fontSize:12.5,fontWeight:600,cursor:"pointer",background:"#FFFFFF",color:K.textBody,border:`1px solid ${K.cardWarmLine}`}}>‹ {T2("Previous")}</button>}
                    <span style={{padding:"0 10px",fontSize:12.5,color:K.hdrMeta,fontVariantNumeric:"tabular-nums"}}>{T2("Page")} {mapTabPage+1} / {Math.ceil(filtered.length/30)}</span>
                    {(mapTabPage+1)*30<filtered.length&&<button onClick={()=>{setMapTabPage(p=>p+1);window.scrollTo({top:0,behavior:"smooth"});}} style={{padding:"7px 16px",borderRadius:999,fontSize:12.5,fontWeight:700,cursor:"pointer",background:K.brand,color:"#FFFFFF",border:"none"}}>{T2("Next")} ›</button>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

    {/* ── Ingredient mapping modal (global — works on any tab) ── */}
      {mapModalIng&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>{setMapModalIng(null);setMapSearch("");}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:420,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{T2("Link to Store Item")}</div>
              <div style={{fontSize:12,color:C.muted}}>
                {mapModalIng.name}{mapModalIng.hindi?` (${mapModalIng.hindi})`:""} · {T2("recipe unit")}: {mapModalIng.unit}
              </div>
              <input value={mapSearch} onChange={e=>setMapSearch(e.target.value)} placeholder={T2("Search store items...")}
                autoFocus style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,marginTop:10,boxSizing:"border-box"}}/>
            </div>
            <div style={{overflow:"auto",flex:1,padding:"8px 0"}}>
              {items.filter(i=>i.source==="ops"||i.source==="store").filter(i=>{
                if(!mapSearch) return true;
                const s=mapSearch.toLowerCase();
                return (i.name||"").toLowerCase().includes(s)||(i.h||"").includes(s)||(i.cat||"").toLowerCase().includes(s);
              }).slice(0,50).map(si=>(
                <div key={si.id} onClick={()=>handleStoreItemSelect(mapModalIng.name,mapModalIng.hindi,mapModalIng.unit,si)}
                  style={{padding:"10px 18px",cursor:"pointer",borderBottom:`1px solid ${C.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}
                  onMouseOver={e=>e.currentTarget.style.background=C.bg} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{si.name}</div>
                    <div style={{fontSize:10,color:C.muted}}>{si.cat} · {si.unit}{si.h?" · "+si.h:""}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:si.available>0?C.green:C.red}}>{si.available}</div>
                    <div style={{fontSize:10,color:C.muted}}>{si.unit}</div>
                    {si.rate>0&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>₹{si.rate%1===0?si.rate:si.rate.toFixed(2)}/{si.unit}</div>}
                  </div>
                </div>
              ))}
              {items.filter(i=>(i.source==="ops"||i.source==="store")&&(!mapSearch||(i.name||"").toLowerCase().includes(mapSearch.toLowerCase())||(i.h||"").includes(mapSearch)||(i.cat||"").toLowerCase().includes(mapSearch.toLowerCase()))).length===0&&(
                <div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>{T2("No matching store items found")}</div>
              )}
            </div>
            <div style={{padding:"10px 18px",borderTop:`1px solid ${C.border}`}}>
              <button onClick={()=>{setMapModalIng(null);setMapSearch("");}} style={{width:"100%",padding:"10px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ {T2("Cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Merge ingredients modal — pick a canonical name + unit; rewrites every
           recipes row's ingredients.items[] that used any selected name, and
           carries the surviving store-item mapping forward. Also doubles as the
           single-ingredient "edit unit" flow when sources.length===1. ── */}
      {ingMergeModal&&(()=>{
        const isSingle = ingMergeModal.sources.length===1;
        const sourceUnits = Array.from(new Set(
          ingMergeModal.sources.map(n=>(allRecipeIngredients.find(i=>i.name===n)?.unit||"").trim()).filter(Boolean)
        ));
        const unitOptions = Array.from(new Set([
          ...(isSingle?ING_UNIT_CHOICES:sourceUnits),
          (ingMergeModal.unit||"").trim(),
        ].filter(Boolean)));
        return(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>{if(!ingMerging)setIngMergeModal(null);}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:420,overflow:"hidden"}}>
            <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{isSingle?T2("Edit Ingredient Unit"):T2("Merge Ingredients")}</div>
              <div style={{fontSize:12,color:C.muted}}>
                {isSingle
                  ? T2("Changes the unit everywhere this ingredient is used across every SOP recipe.")
                  : T2("Pick which name survives — every recipe using any of the others switches to it, with the unit below.")}
              </div>
            </div>
            <div style={{padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
              {!isSingle&&(
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>{T2("Merging")}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {ingMergeModal.sources.map(n=>(
                      <button key={n} onClick={()=>setIngMergeModal(m=>({...m,target:n,unit:(allRecipeIngredients.find(i=>i.name===n)?.unit)||m.unit}))}
                        style={{fontSize:11,padding:"6px 10px",borderRadius:20,cursor:"pointer",fontWeight:600,
                          background:ingMergeModal.target===n?C.gold:C.bg,color:ingMergeModal.target===n?C.goldBg:C.text,border:`1px solid ${ingMergeModal.target===n?C.gold:C.border}`}}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>{T2("Canonical name")}</div>
                <input value={ingMergeModal.target} onChange={e=>setIngMergeModal(m=>({...m,target:e.target.value}))}
                  style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>{T2("Unit")}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {unitOptions.map(u=>(
                    <button key={u} onClick={()=>setIngMergeModal(m=>({...m,unit:u}))}
                      style={{fontSize:11,padding:"6px 12px",borderRadius:20,cursor:"pointer",fontWeight:600,
                        background:ingMergeModal.unit===u?C.gold:C.bg,color:ingMergeModal.unit===u?C.goldBg:C.text,border:`1px solid ${ingMergeModal.unit===u?C.gold:C.border}`}}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              {!isSingle&&<div style={{fontSize:10,color:C.faint}}>{T2("The kept store-item link (if any) carries over; the others are dropped.")}</div>}
            </div>
            <div style={{padding:"10px 18px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8}}>
              <button onClick={()=>setIngMergeModal(null)} disabled={ingMerging}
                style={{flex:1,padding:"10px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:ingMerging?"not-allowed":"pointer"}}>{T2("Cancel")}</button>
              <button onClick={()=>performIngredientMerge(ingMergeModal.sources, ingMergeModal.target, ingMergeModal.unit)} disabled={ingMerging}
                style={{flex:1,padding:"10px",borderRadius:10,background:ingMerging?C.border:C.gold,border:"none",color:ingMerging?C.muted:C.goldBg,fontSize:12,fontWeight:700,cursor:ingMerging?"not-allowed":"pointer"}}>
                {ingMerging?T2("Saving..."):(isSingle?T2("Save unit"):T2("Merge"))}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── Ingredient duplicate finder — same UX as Dish Library's "Find duplicates":
           grouped by confidence, radio-pick a target per group, merge or skip. ── */}
      {ingDedupOpen && (()=>{
        const totalGroups = ingDedupClusters.length;
        // Scoped to the clusters THIS run actually found — ingDedupResolved/
        // ingDedupSkipped persist across reopens by design, so a stale entry
        // for a cluster that no longer exists must not inflate these counts.
        const resolvedCount = ingDedupClusters.filter(c=>!!ingDedupResolved[ingClusterKey(c)]).length;
        const skippedCount = ingDedupClusters.filter(c=>!!ingDedupSkipped[ingClusterKey(c)]).length;
        const remainingIdx = ingDedupClusters.map((_,i)=>i).filter(i=>{ const k=ingClusterKey(ingDedupClusters[i]); return !ingDedupResolved[k]&&!ingDedupSkipped[k]; });
        const highIdx = remainingIdx.filter(i=>ingDedupClusters[i].confidence==='high');
        const medIdx  = remainingIdx.filter(i=>ingDedupClusters[i].confidence==='medium');
        const allDone = totalGroups>0 && remainingIdx.length===0;
        const nothingFound = totalGroups===0;

        function renderIngCard(idx){
          const c = ingDedupClusters[idx];
          const key = ingClusterKey(c);
          const target = ingDedupTargets[key]||'';
          const unit = ingDedupUnits[key]||'';
          const clusterUnits = c.items.map(d=>(d.unit||'').trim()).filter(Boolean);
          const unitOptions = Array.from(new Set(clusterUnits.concat(ING_UNIT_CHOICES).concat(unit?[unit]:[])));
          const saving = ingDedupSavingIdx===idx;
          const disabled = ingDedupSavingIdx!=null && !saving;
          const cantMerge = saving||disabled||!target||!unit;
          // What the merge will actually do — every recipe using a non-target
          // name is rewritten to the target, and that can't be undone.
          const others = c.items.filter(d=>d.name!==target);
          const rewritten = others.reduce((n,d)=>n+(d.dishes||[]).length,0);
          const unitsDiffer = new Set(c.items.map(d=>(d.unit||'').trim().toLowerCase()).filter(Boolean)).size>1;
          const asking = ingDedupConfirm===idx;
          return (
            <div key={idx} style={{border:`1px solid ${K.cardWarmLine}`,borderRadius:16,padding:"14px 16px",marginBottom:12,background:K.cardWarm,boxShadow:K.shadowCard}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{padding:"3px 10px",borderRadius:999,fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,
                  background:c.confidence==='high'?K.okBg:K.warnBg,color:c.confidence==='high'?K.ok:K.warn,
                  border:`1px solid ${c.confidence==='high'?K.okBorder:K.warnBorder}`}}>{T2(c.reason)}</span>
                <span style={{marginLeft:"auto",fontSize:11.5,color:K.hdrMeta}}>{c.items.length} {T2("names")}</span>
              </div>
              <div style={{fontSize:11.5,color:K.hdrMeta,marginBottom:8}}>{T2("Pick the name to keep — the others are merged into it.")}</div>
              {c.confidence!=='high'&&<div style={{fontSize:11.5,color:K.warn,background:K.warnBg,border:`1px solid ${K.warnBorder}`,borderRadius:10,padding:"6px 10px",marginBottom:8}}>⚠ {T2("These may be different items — merge only if they are truly the same thing.")}</div>}
              {unitsDiffer&&<div style={{fontSize:11.5,color:K.warn,marginBottom:8,fontWeight:600}}>⚠ {T2("Units differ — check the unit below before merging.")}</div>}
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                {c.items.slice().sort((a,b)=>(b.dishes||[]).length-(a.dishes||[]).length).map(d=>{
                  const isT = d.name===target;
                  const uses = (d.dishes||[]).length;
                  const isMapped = d.hasInv || !!ingredientMap[d.name];
                  return (
                    <label key={d.name} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:12,
                      background:isT?K.brandSoft:"#FFFFFF",border:`1.5px solid ${isT?K.brand:K.cardWarmLine}`,cursor:disabled?"not-allowed":"pointer"}}>
                      <input type="radio" name={"ingdedup-target-"+idx} checked={isT} disabled={disabled||saving}
                        onChange={()=>pickIngDedupTarget(key,d.name)} style={{margin:0,width:16,height:16,accentColor:K.brand,cursor:disabled?"not-allowed":"pointer",flexShrink:0}}/>
                      <span style={{minWidth:0,flex:1}}>
                        <span style={{display:"block",fontSize:13.5,fontWeight:isT?700:600,color:K.hdrTitle}}>{d.name}</span>
                        {d.hindi&&<span style={{display:"block",fontSize:11.5,color:K.hdrMeta,marginTop:1}}>{d.hindi}</span>}
                      </span>
                      {isT&&<span style={{fontSize:10.5,fontWeight:700,color:K.brandText,textTransform:"uppercase",letterSpacing:.5}}>{T2("Keep")}</span>}
                      <span style={{fontSize:10.5,fontWeight:700,padding:"3px 9px",borderRadius:999,textTransform:"uppercase",letterSpacing:.4,
                        background:isMapped?K.okBg:K.warnBg,color:isMapped?K.ok:K.warn,border:`1px solid ${isMapped?K.okBorder:K.warnBorder}`}}>{isMapped?T2("MAPPED"):T2("UNMAPPED")}</span>
                      <span style={{position:"relative",display:"inline-block"}}
                        onMouseEnter={()=>uses>0&&setIngDedupHoverKey(idx+"::"+d.name)}
                        onMouseLeave={()=>setIngDedupHoverKey(null)}>
                        <span style={{display:"inline-block",padding:"3px 10px",borderRadius:999,fontSize:11.5,fontWeight:600,whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums",
                          background:K.surfaceAlt,border:`1px solid ${K.line}`,color:uses===0?K.textFaint:K.textBody,cursor:uses>0?"default":undefined}}>{uses} {T2("recipe")}{uses===1?"":"s"} · {d.unit}</span>
                        {ingDedupHoverKey===(idx+"::"+d.name)&&uses>0&&(
                          <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"100%",right:0,marginTop:6,zIndex:20,minWidth:200,maxWidth:280,maxHeight:190,overflowY:"auto",background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,borderRadius:12,boxShadow:K.shadowLift,padding:"10px 12px"}}>
                            <div style={{fontSize:10,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>{T2("Used in")}</div>
                            {(d.dishes||[]).map((dn,dni)=>(
                              <div key={dni} style={{fontSize:12.5,color:K.textBody,padding:"2px 0"}}>{dn}</div>
                            ))}
                          </div>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:12,fontWeight:600,color:K.hdrMeta}}>{T2("Unit")}</span>
                <UnitPicker value={unit} disabled={disabled||saving} onChange={u=>setIngDedupUnits(prev=>({...prev,[key]:u}))} suggested={clusterUnits} options={unitOptions} T2={T2}/>
                <div style={{flex:1}}/>
                {!asking&&<span style={{fontSize:11.5,color:K.hdrMeta}}>{rewritten} {T2("recipes will change")}</span>}
                <button onClick={()=>{setIngDedupConfirm(null);skipIngDedupCluster(key);}} disabled={saving||disabled}
                  style={{padding:"8px 16px",borderRadius:999,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.textBody,fontSize:12.5,fontWeight:600,cursor:(saving||disabled)?"not-allowed":"pointer"}}>{T2("Not now")}</button>
                {asking&&!saving&&<button onClick={()=>setIngDedupConfirm(null)}
                  style={{padding:"8px 16px",borderRadius:999,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.textBody,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>{T2("Cancel")}</button>}
                <button onClick={()=>{ if(!asking){ setIngDedupConfirm(idx); return; } setIngDedupConfirm(null); mergeIngDedupCluster(idx); }} disabled={cantMerge}
                  style={{padding:"8px 18px",borderRadius:999,background:K.brand,border:"none",color:"#FFFFFF",fontSize:12.5,fontWeight:700,cursor:cantMerge?"not-allowed":"pointer",opacity:cantMerge?0.5:1}}>
                  {saving?T2("Merging…"):asking?("✓ "+T2("Yes, merge")+" "+others.length+" → \""+target+"\""):(T2('Merge into "')+target+'"')}
                </button>
              </div>
              {asking&&!saving&&(
                <div style={{marginTop:10,padding:"9px 12px",borderRadius:10,background:K.dangerBg,border:`1px solid ${K.dangerBorder}`,fontSize:12,color:K.danger,lineHeight:1.5}}>
                  {others.map(d=>'"'+d.name+'"').join(", ")} → <b>"{target}"</b> {T2("in")} <b>{rewritten}</b> {T2("recipes, unit")} <b>{unit}</b>. {T2("This can't be undone.")}
                </div>
              )}
            </div>
          );
        }

        const doneCount = resolvedCount+skippedCount;
        const donePct = totalGroups>0 ? Math.round(doneCount/totalGroups*100) : 0;
        const secHead = (label, n, color) => (
          <div style={{display:"flex",alignItems:"center",gap:8,margin:"4px 0 10px"}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:color}}/>
            <span style={{fontSize:12,fontWeight:700,color:K.hdrTitle,textTransform:"uppercase",letterSpacing:.6}}>{label}</span>
            <span style={{padding:"1px 9px",borderRadius:999,fontSize:11,fontWeight:700,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.hdrMeta,fontVariantNumeric:"tabular-nums"}}>{n}</span>
          </div>
        );

        return (
          <div onClick={closeIngDedup} style={{position:"fixed",inset:0,background:"rgba(20,28,24,0.45)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div onClick={e=>e.stopPropagation()} style={{background:K.modalBg,border:`1px solid ${K.modalLine}`,borderRadius:22,maxWidth:760,width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:K.shadowLift,overflow:"hidden",fontFamily:K.fontBody}}>
              <div style={{display:"flex",alignItems:"center",gap:14,padding:"18px 22px",borderBottom:`1px solid ${K.cardWarmLine}`}}>
                <span style={{width:42,height:42,borderRadius:13,flexShrink:0,background:K.brand,color:K.hdrBadgeIcon,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>🔍</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:18,fontWeight:700,color:K.hdrTitle}}>{T2("Find duplicates")}</div>
                  <div style={{fontSize:12.5,color:K.hdrMeta,marginTop:2,fontVariantNumeric:"tabular-nums"}}>{totalGroups} {T2("groups found")} · {resolvedCount} {T2("resolved")} · {skippedCount} {T2("skipped")} · {remainingIdx.length} {T2("remaining")}</div>
                  {totalGroups>0&&(
                    <div style={{height:5,borderRadius:99,background:K.cardWarmLine,marginTop:8,overflow:"hidden"}}>
                      <div style={{width:donePct+"%",height:"100%",borderRadius:99,background:K.brand,transition:"width .3s ease"}}/>
                    </div>
                  )}
                </div>
                <button onClick={closeIngDedup} disabled={ingDedupSavingIdx!=null} aria-label={T2("Close")}
                  style={{width:34,height:34,borderRadius:999,border:`1px solid ${K.cardWarmLine}`,background:"#FFFFFF",color:K.textMuted,fontSize:16,lineHeight:1,flexShrink:0,cursor:ingDedupSavingIdx!=null?"not-allowed":"pointer"}}>×</button>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"16px 22px",minHeight:0}}>
                {nothingFound&&<div style={{textAlign:"center",padding:"40px 20px",color:K.hdrMeta,fontSize:13.5}}>{T2("No duplicate candidates found in the current ingredient list.")}</div>}
                {allDone&&(
                  <div style={{textAlign:"center",padding:"30px 20px"}}>
                    <div style={{width:54,height:54,borderRadius:"50%",margin:"0 auto 10px",background:K.okBg,border:`1px solid ${K.okBorder}`,color:K.ok,fontSize:24,display:"flex",alignItems:"center",justifyContent:"center"}}>✓</div>
                    <div style={{fontSize:16,fontWeight:700,color:K.hdrTitle,marginBottom:4}}>{T2("All done")}</div>
                    <div style={{fontSize:12.5,color:K.hdrMeta}}>{resolvedCount} {T2("merged")} · {skippedCount} {T2("skipped")}</div>
                    {skippedCount>0&&<button onClick={resetIngDedupSkipped} style={{marginTop:14,padding:"8px 18px",borderRadius:999,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.textBody,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>{T2("Review skipped")}</button>}
                  </div>
                )}
                {!allDone&&(()=>{
                  const tabNow = ingDedupTab==='medium'&&medIdx.length>0 ? 'medium' : ingDedupTab==='high'&&highIdx.length>0 ? 'high' : (highIdx.length>0?'high':'medium');
                  const list = tabNow==='high'?highIdx:medIdx;
                  return(<>
                    <div style={{display:"flex",padding:3,borderRadius:999,background:"#F0EEE7",border:`1px solid ${K.cardWarmLine}`,marginBottom:12,width:"fit-content"}}>
                      {[{k:'high',l:T2("Likely duplicates"),n:highIdx.length,c:K.ok},{k:'medium',l:T2("Review"),n:medIdx.length,c:K.warn}].map(t=>{const on=tabNow===t.k;return(
                        <button key={t.k} onClick={()=>{setIngDedupTab(t.k);setIngDedupConfirm(null);}} disabled={t.n===0}
                          style={{display:"inline-flex",alignItems:"center",gap:7,padding:"7px 16px",borderRadius:999,border:"none",fontSize:12.5,fontWeight:700,
                            cursor:t.n===0?"not-allowed":"pointer",opacity:t.n===0?.5:1,background:on?K.brand:"transparent",color:on?"#FFFFFF":K.textBody}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:on?"#FFFFFF":t.c}}/>{t.l}
                          <span style={{opacity:.8,fontVariantNumeric:"tabular-nums"}}>{t.n}</span>
                        </button>);})}
                    </div>
                    <div style={{fontSize:12,color:K.hdrMeta,marginBottom:12}}>
                      {tabNow==='high'?T2("Same name once spacing, case and word order are ignored — usually safe to merge."):T2("Similar spelling or the same Hindi name — often different items. Check each one.")}
                    </div>
                    {list.map(renderIngCard)}
                  </>);
                })()}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"14px 22px",borderTop:`1px solid ${K.cardWarmLine}`}}>
                <div>
                  {skippedCount>0&&!allDone&&<button onClick={resetIngDedupSkipped} style={{padding:"7px 14px",borderRadius:999,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.textBody,fontSize:12,fontWeight:600,cursor:"pointer"}}>{T2("Reset skipped")} ({skippedCount})</button>}
                </div>
                <button onClick={closeIngDedup} disabled={ingDedupSavingIdx!=null} style={{padding:"9px 22px",borderRadius:999,background:K.brand,border:"none",color:"#FFFFFF",fontSize:13,fontWeight:700,cursor:ingDedupSavingIdx!=null?"not-allowed":"pointer"}}>{T2("Close")}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Recipe list modal — shows which SOP recipes use this ingredient ── */}
      {recipesModalIng&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setRecipesModalIng(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:480,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>📖 {T2("Recipes using this ingredient")}</div>
              <div style={{fontSize:12,color:C.muted}}>
                {recipesModalIng.name}{recipesModalIng.hindi?` (${recipesModalIng.hindi})`:""} · {T2("unit")}: {recipesModalIng.unit}
              </div>
              <div style={{fontSize:11,color:C.faint,marginTop:4}}>
                {T2("Used in")} <b style={{color:C.gold}}>{recipesModalIng.dishes.length}</b> {T2("recipes")}
              </div>
            </div>
            <div style={{overflow:"auto",flex:1,padding:"10px 14px"}}>
              {recipesModalIng.dishes.length===0
                ?<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>{T2("No recipes found")}</div>
                :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {[...recipesModalIng.dishes].sort((a,b)=>a.localeCompare(b)).map((dishName,i)=>(
                    <div key={i} style={{padding:"8px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.borderLight}`,fontSize:12,color:C.text,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:C.faint,minWidth:22}}>{i+1}.</span>
                      <span>{dishName}</span>
                    </div>
                  ))}
                </div>
              }
            </div>
            <div style={{padding:"10px 18px",borderTop:`1px solid ${C.border}`}}>
              <button onClick={()=>setRecipesModalIng(null)} style={{width:"100%",padding:"10px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ {T2("Close")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unit conversion prompt modal ── */}
      {convModal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setConvModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:380,overflow:"hidden"}}>
            <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{convModal.editMode?T2("Edit Conversion"):T2("Unit Conversion Required")}</div>
              <div style={{fontSize:12,color:C.muted}}>
                {convModal.ingName}{convModal.ingHindi?" ("+convModal.ingHindi+")":""}
              </div>
              <div style={{fontSize:11,color:C.faint,marginTop:2}}>
                {T2("Recipe unit")}: <b>{convModal.recipeUnit}</b> → {T2("Store unit")}: <b>{convModal.storeUnit}</b>
              </div>
            </div>
            <div style={{padding:"18px"}}>
              <div style={{fontSize:12,color:C.text,marginBottom:10,fontWeight:600}}>{T2("How many")} {convModal.recipeUnit} {T2("in")} 1 {convModal.storeUnit}?</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,color:C.muted,whiteSpace:"nowrap"}}>1 {convModal.storeUnit} =</span>
                <input type="number" step="any" min="0" value={convModal.convValue} autoFocus
                  onChange={e=>setConvModal(function(prev){return Object.assign({},prev,{convValue:e.target.value});})}
                  style={{flex:1,padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,color:C.text,background:C.bg,textAlign:"center"}}/>
                <span style={{fontSize:13,color:C.muted,whiteSpace:"nowrap"}}>{convModal.recipeUnit}</span>
              </div>
              <div style={{fontSize:10,color:C.faint,marginTop:8}}>
                {T2("Example")}: 1 bottle Cooking Wine = 750 ml
              </div>
            </div>
            <div style={{display:"flex",gap:8,padding:"0 18px 16px"}}>
              <button onClick={()=>setConvModal(null)} style={{flex:1,padding:"10px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ {T2("Cancel")}</button>
              <button onClick={()=>{
                var val=parseFloat(convModal.convValue);
                if(!val||val<=0){alert(T2("Enter a valid conversion value"));return;}
                var conv=1/val;
                if(convModal.editMode){
                  var upd=Object.assign({},ingredientMap[convModal.ingName],{unit_conversion:conv});
                  setIngredientMap(function(prev){var n=Object.assign({},prev);n[convModal.ingName]=upd;return n;});
                  setConvModal(null);
                  supabase.from("ingredient_item_map").update({unit_conversion:conv}).eq("ingredient_name",convModal.ingName).then(function(r){if(r.error)console.error("Conv update failed:",r.error);});
                }else{
                  saveIngredientMapping(convModal.ingName,convModal.ingHindi,convModal.opsItem,conv);
                }
              }} disabled={!convModal.convValue||parseFloat(convModal.convValue)<=0}
                style={{flex:1,padding:"10px",borderRadius:10,background:(!convModal.convValue||parseFloat(convModal.convValue)<=0)?C.borderLight:C.gold,border:"none",color:(!convModal.convValue||parseFloat(convModal.convValue)<=0)?C.muted:C.goldBg,fontSize:12,fontWeight:700,cursor:(!convModal.convValue||parseFloat(convModal.convValue)<=0)?"not-allowed":"pointer"}}>✓ {T2("Save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom / partial issue-quantity modal — opened by the ± button
          next to Issue, or by tapping an already-issued ✓ to issue more. ── */}
      {issueQtyModal&&(()=>{
        const { row, agg, stock } = issueQtyModal;
        const val = parseFloat(issueQtyModal.value);
        const valid = !isNaN(val) && val>0;
        const newIssued = agg.issuedQty + (valid?val:0);
        const newRemaining = Math.max(0, agg.required-newIssued);
        const newSurplus = Math.max(0, newIssued-agg.required);
        return (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:9200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setIssueQtyModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:380,overflow:"hidden"}}>
            <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{T2("Issue")} {row.name}</div>
              <div style={{fontSize:11,color:C.faint,marginTop:2}}>
                {T2("Required")} <b>{fmtIssueQty(agg.required,row.unit)}</b> · {T2("Issued so far")} <b>{fmtIssueQty(agg.issuedQty,row.unit)}</b>
              </div>
            </div>
            <div style={{padding:"18px"}}>
              <div style={{fontSize:12,color:C.text,marginBottom:10,fontWeight:600}}>{T2("Issue now")} ({row.unit})</div>
              <input type="number" step="any" min="0" autoFocus value={issueQtyModal.value}
                onChange={e=>setIssueQtyModal(p=>({...p,value:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,color:C.text,background:C.bg,textAlign:"center",boxSizing:"border-box"}}/>
              {stock && valid && (
                <div style={{fontSize:11,color:C.faint,marginTop:8}}>
                  ≈ {Math.round(qtyToStoreUnits(val,row.unit,stock)*100)/100} {stock.unit} {T2("from store stock of")} {fmtIssueQty(stock.available,stock.unit)}
                </div>
              )}
              {valid && newSurplus>1e-9 && (
                <div style={{fontSize:11.5,fontWeight:600,color:C.green,marginTop:8,padding:"6px 10px",borderRadius:8,background:C.greenBg||"#EAF7F1"}}>
                  {T2("This issues")} {fmtIssueQty(newSurplus,row.unit)} {T2("more than needed — recorded as surplus.")}
                </div>
              )}
              {valid && newRemaining>1e-9 && (
                <div style={{fontSize:11.5,fontWeight:600,color:C.amber,marginTop:8,padding:"6px 10px",borderRadius:8,background:C.amberBg||"#FBF2DD"}}>
                  {T2("Remaining after this issue")}: {fmtIssueQty(newRemaining,row.unit)}
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:8,padding:"0 18px 16px"}}>
              <button onClick={()=>setIssueQtyModal(null)} style={{flex:1,padding:"10px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ {T2("Cancel")}</button>
              <button disabled={!valid} onClick={async()=>{ await commitIssueQty(row,val); setIssueQtyModal(null); }}
                style={{flex:1,padding:"10px",borderRadius:10,background:valid?C.gold:C.borderLight,border:"none",color:valid?C.goldBg:C.muted,fontSize:12,fontWeight:700,cursor:valid?"pointer":"not-allowed"}}>✓ {T2("Confirm issue")}</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── Cross-venue transfer-request modal — opened from a row's "Request"
          button when that specific venue is short even though the item's
          total across all venues looks fine. ── */}
      {transferModal&&(()=>{
        const { row, toVenue, donors, fromVenueId } = transferModal;
        const val = parseFloat(transferModal.value);
        const valid = !isNaN(val) && val>0;
        return (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:9200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setTransferModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:380,overflow:"hidden"}}>
            <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{T2("Request")} {row.name}</div>
              <div style={{fontSize:11,color:C.faint,marginTop:2}}>{T2("For")} <b>{toVenue.venueName}</b></div>
            </div>
            <div style={{padding:"18px"}}>
              {donors.length>1 && (
                <>
                  <div style={{fontSize:12,color:C.text,marginBottom:8,fontWeight:600}}>{T2("From")}</div>
                  <select value={fromVenueId} onChange={e=>setTransferModal(p=>({...p,fromVenueId:e.target.value}))}
                    style={{width:"100%",padding:"9px 10px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,marginBottom:14,boxSizing:"border-box"}}>
                    {donors.map(d=><option key={d.venue.venueId} value={d.venue.venueId}>{d.venue.venueName} ({fmtIssueQty(d.spare,row.unit)} {T2("available")})</option>)}
                  </select>
                </>
              )}
              {donors.length===1 && (
                <div style={{fontSize:12,color:C.text,marginBottom:14}}>{T2("From")} <b>{donors[0].venue.venueName}</b> ({fmtIssueQty(donors[0].spare,row.unit)} {T2("available")})</div>
              )}
              <div style={{fontSize:12,color:C.text,marginBottom:10,fontWeight:600}}>{T2("Quantity")} ({row.unit})</div>
              <input type="number" step="any" min="0" autoFocus value={transferModal.value}
                onChange={e=>setTransferModal(p=>({...p,value:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,color:C.text,background:C.bg,textAlign:"center",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:8,padding:"0 18px 16px"}}>
              <button onClick={()=>setTransferModal(null)} style={{flex:1,padding:"10px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ {T2("Cancel")}</button>
              <button disabled={!valid} onClick={createTransferRequest}
                style={{flex:1,padding:"10px",borderRadius:10,background:valid?C.gold:C.borderLight,border:"none",color:valid?C.goldBg:C.muted,fontSize:12,fontWeight:700,cursor:valid?"pointer":"not-allowed"}}>🚚 {T2("Send request")}</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── Transfer-requests list — open requests any venue's store can see
          and mark fulfilled once the item has actually been carried over. ── */}
      {transferListOpen&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:9200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={()=>setTransferListOpen(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:460,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text}}>🚚 {T2("Cross-venue stock requests")}</div>
              <button onClick={()=>setTransferListOpen(false)} style={{border:"none",background:"transparent",color:C.muted,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"10px 14px"}}>
              {transferRequests.filter(r=>r.status==='open').length===0 && (
                <div style={{textAlign:"center",padding:24,color:C.muted,fontSize:12.5}}>{T2("No open requests.")}</div>
              )}
              {transferRequests.filter(r=>r.status==='open').map(r=>(
                <div key={r.id} style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.ingredient_name}{r.ingredient_hindi?" ("+r.ingredient_hindi+")":""}</div>
                    <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>{fmtIssueQty(+r.qty,r.unit)} — <b>{r.from_venue_name||"?"}</b> → <b>{r.to_venue_name||"?"}</b></div>
                  </div>
                  {hasPerm(currentUser,"store.smart_issue") && (
                    <button onClick={()=>markTransferFulfilled(r.id)} style={{fontSize:11.5,fontWeight:700,padding:"6px 12px",borderRadius:8,background:C.green,color:"#fff",border:"none",cursor:"pointer",whiteSpace:"nowrap"}}>✓ {T2("Fulfilled")}</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Order Lists print view — one category per printed page, vendor-
          ready (S.No / Item / Qty / For / a blank Received column), same
          data the on-screen cards show so nothing drifts between the two. ── */}
      {printReq&&(()=>{
        const allGroups = buildOrderListGroups();
        const toPrint = printReq.mode==="all" ? allGroups : allGroups.filter(g=>g.meta.key===printReq.key);
        const today = new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"});
        return (
          <div style={{position:"fixed",inset:0,zIndex:9999,background:"#fff",overflow:"auto"}}>
            <style>{"@media print { .ol-print-toolbar{display:none !important;} .ol-print-page{page-break-after:always;} .ol-print-page:last-child{page-break-after:auto;} }"}</style>
            <div className="ol-print-toolbar" style={{position:"sticky",top:0,background:"#fff",borderBottom:"1px solid #ddd",padding:"10px 16px",display:"flex",justifyContent:"flex-end",gap:8,zIndex:1}}>
              <button onClick={()=>window.print()} style={{padding:"8px 16px",borderRadius:8,background:C.wine,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>🖨 {T2("Print")}</button>
              <button onClick={()=>setPrintReq(null)} style={{padding:"8px 16px",borderRadius:8,background:"#eee",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",color:"#333"}}>{T2("Close")}</button>
            </div>
            {toPrint.length===0&&<div style={{padding:40,textAlign:"center",color:"#888"}}>{T2("Nothing to print.")}</div>}
            {toPrint.map(group=>(
              <div key={group.meta.key} className="ol-print-page" style={{padding:"28px 32px",color:"#1a1a1a",maxWidth:800,margin:"0 auto"}}>
                <div style={{textAlign:"center",marginBottom:16,borderBottom:"2px solid #1a1a1a",paddingBottom:10}}>
                  <div style={{fontSize:18,fontWeight:700}}>Ambria Cuisines</div>
                  <div style={{fontSize:11,color:"#666"}}>Get Your Venue Events Pvt Ltd</div>
                  <div style={{fontSize:14,fontWeight:700,marginTop:8,letterSpacing:1}}>{T2("ORDERING SHEET")} — {group.meta.label.toUpperCase()}</div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:12}}>
                  <div><b>{T2("Date")}:</b> {today}</div>
                  <div><b>{T2("Items")}:</b> {group.list.length}</div>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:"1.5px solid #1a1a1a"}}>
                      <th style={{textAlign:"left",padding:"5px 4px",width:34}}>{T2("S.No")}</th>
                      <th style={{textAlign:"left",padding:"5px 4px"}}>{T2("Item")}</th>
                      <th style={{textAlign:"right",padding:"5px 4px",width:80}}>{T2("Qty")}</th>
                      <th style={{textAlign:"left",padding:"5px 4px",width:140}}>{T2("For")}</th>
                      <th style={{textAlign:"center",padding:"5px 4px",width:80}}>{T2("Received")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.list.map((item,i)=>(
                      <tr key={item.order_date+item.ingredient_name} style={{borderBottom:"1px solid #ccc"}}>
                        <td style={{padding:"7px 4px",color:"#888"}}>{i+1}</td>
                        <td style={{padding:"7px 4px",fontWeight:600}}>{item.ingredient_name}{item.ingredient_hindi?" ("+item.ingredient_hindi+")":""}</td>
                        <td style={{padding:"7px 4px",textAlign:"right"}}>{fmtIssueQty(item.qty,item.unit)}</td>
                        <td style={{padding:"7px 4px",fontSize:11,color:"#555"}}>{item.source||"—"}</td>
                        <td style={{padding:"7px 4px"}}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{display:"flex",justifyContent:"space-between",gap:20,marginTop:46,fontSize:11}}>
                  <div style={{flex:1,textAlign:"center"}}><div style={{borderTop:"1px solid #888",paddingTop:4}}>{T2("Ordered by")}</div></div>
                  <div style={{flex:1,textAlign:"center"}}><div style={{borderTop:"1px solid #888",paddingTop:4}}>{T2("Vendor signature")}</div></div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

    </div>
  );
}



export { StoreModule };