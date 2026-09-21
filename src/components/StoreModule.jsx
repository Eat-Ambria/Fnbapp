// Ambria FnB — Store & Inventory (reads live data from Ambria Ops Supabase)
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { C, OPS_IMG_BASE } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr, safeNum, TOMORROW } from '../utils/helpers.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { Card, Btn, Chip, SectionHeader } from './SharedUI.jsx';
import { dbLoad, dbUpsert, dbDelete } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import { opsSupabase } from '../lib/opsSupabase.js';
import { getCatForDish, isFruitSelectionDish, RECIPE_DB, getIngrForDish, resolveDishStore } from '../data/recipeData.js';
import { hasPerm } from '../data/permissions.js';

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
    if (error) { console.error("Ops fetch error:", error); break; }
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
    if (error) { console.error("Ops equipment fetch error:", error); break; }
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
const ING_UNIT_CHOICES = ["kg","gm","L","ml","tsp","tbsp","pcs","slice","Bot","tin","bunch","dozen"];

// Requirements tab's "Add to Order list" destinations — keys match store_order_lists.list_key.
const ORDER_LIST_META = {
  dairy:     { label: "Dairy",     icon: "🥛", bg: "#E4F5FE", color: "#0EA5E9", border: "#B6E5FB" },
  grocery:   { label: "Grocery",   icon: "🛒", bg: "#FDF3E2", color: "#C4790C", border: "#F5DBA6" },
  vegetable: { label: "Vegetable", icon: "🥕", bg: "#E6F7F0", color: "#129A6C", border: "#B4E8D3" },
};

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
    clusters.push({ reason: 'Same Hindi (' + byHi[h][0].hindi + ')', confidence: 'high', items: byHi[h].slice() });
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
  const [reqPicker, setReqPicker] = useState(null); // ingredient name currently showing its inline Dairy/Grocery/Veg picker
  const [orderListItems, setOrderListItems] = useState([]); // rows from store_order_lists
  const [orderListLoading, setOrderListLoading] = useState(false);
  const [issueAssignments, setIssueAssignments] = useState({}); // {[event_id+"::"+section_name]: venue_code}
  const [issueRecords, setIssueRecords] = useState({}); // {[event_id+"::"+section+"::"+ingredient]: {issued,qty_issued,...}}
  const [issueLoading, setIssueLoading] = useState(false);
  const [ingredientMap, setIngredientMap] = useState({}); // {ingredient_name: {ops_item_id, ops_inventory_id, ops_item_name, ops_item_unit, unit_conversion}}
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
  const [ingDedupOpen, setIngDedupOpen] = useState(false);
  const [ingDedupClusters, setIngDedupClusters] = useState([]);
  const [ingDedupTargets, setIngDedupTargets] = useState({});   // {idx: name}
  const [ingDedupUnits, setIngDedupUnits] = useState({});       // {idx: unit}
  const [ingDedupSkipped, setIngDedupSkipped] = useState({});   // {idx: true}
  const [ingDedupResolved, setIngDedupResolved] = useState({}); // {idx: 'merged'}
  const [ingDedupSavingIdx, setIngDedupSavingIdx] = useState(null);
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
        const [aData, iData, mData, fData] = await Promise.all([
          fetchAllRows(() => supabase.from('store_issue_assignments').select('*')),
          fetchAllRows(() => supabase.from('store_issues').select('*')),
          fetchAllRows(() => supabase.from('ingredient_item_map').select('*')),
          fetchAllRows(() => supabase.from('event_fruit_selections').select('*')),
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
    subs = [ch1, ch2, ch3];

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
  const allRecipeIngredients = useMemo(() => {
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
  }, [ingRefreshTick]);

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
      const touched = [];
      allNames.forEach(n => {
        const entry = allRecipeIngredients.find(i => i.name === n);
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
  function openIngDedup() {
    const clusters = findIngredientDuplicateClusters(allRecipeIngredients);
    const targets = {}, units = {};
    clusters.forEach((c, i) => {
      const t = pickDefaultIngTarget(c);
      targets[i] = t;
      units[i] = (c.items.find(x => x.name === t) || {}).unit || '';
    });
    setIngDedupClusters(clusters);
    setIngDedupTargets(targets);
    setIngDedupUnits(units);
    setIngDedupSkipped({});
    setIngDedupResolved({});
    setIngDedupOpen(true);
  }
  function closeIngDedup() {
    if (ingDedupSavingIdx != null) return;
    setIngDedupOpen(false);
  }
  function pickIngDedupTarget(idx, name) {
    setIngDedupTargets(prev => ({ ...prev, [idx]: name }));
    const cluster = ingDedupClusters[idx];
    const found = cluster && cluster.items.find(x => x.name === name);
    if (found) setIngDedupUnits(prev => ({ ...prev, [idx]: found.unit || '' }));
  }
  function skipIngDedupCluster(idx) {
    setIngDedupSkipped(prev => ({ ...prev, [idx]: true }));
  }
  function resetIngDedupSkipped() {
    setIngDedupSkipped({});
  }
  async function mergeIngDedupCluster(idx) {
    const cluster = ingDedupClusters[idx];
    if (!cluster) return;
    const target = (ingDedupTargets[idx] || '').trim();
    const unit = (ingDedupUnits[idx] || '').trim();
    if (!target || !unit) { alert(T2('Pick a target and unit for this group.')); return; }
    const sources = cluster.items.map(d => d.name).filter(n => n !== target);
    if (sources.length === 0) { alert(T2('Nothing to merge — target is the only ingredient.')); return; }
    setIngDedupSavingIdx(idx);
    try {
      await performIngredientMerge(sources, target, unit);
      setIngDedupResolved(prev => ({ ...prev, [idx]: 'merged' }));
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

  function buildEventBags(evList) {
    const evBags = {};
    evList.forEach(ev => {
      const pax = +ev.pax || 0;
      if (!evBags[ev.id]) evBags[ev.id] = { ev, sections: {} };
      safeArr(ev.menu).forEach(dishName => {
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
        }
        if (!ingr || ingr.length === 0) return;
        const isNew = ingr[0]?._newFmt;
        if (!evBags[ev.id].sections[sec]) evBags[ev.id].sections[sec] = { items: {}, meta };
        ingr.forEach(ing => {
          const k = ing.n;
          const rawQty = isNew ? ing.q : ing.q * pax;
          if (!evBags[ev.id].sections[sec].items[k]) {
            const norm = normalizeToBaseUnit(rawQty, ing.u);
            evBags[ev.id].sections[sec].items[k] = {
              name: ing.n,
              hindi: ing.h || "",
              unit: norm.unit,
              totalQty: norm.qty,
              // 9D — preserve inv metadata so shortage build can use ops_inventory_id directly
              _type: ing._type || null,
              ops_inventory_id: ing.ops_inventory_id || null,
            };
          } else {
            const merged = addQtyWithUnitNorm(evBags[ev.id].sections[sec].items[k], rawQty, ing.u);
            evBags[ev.id].sections[sec].items[k].totalQty = merged.totalQty;
            evBags[ev.id].sections[sec].items[k].unit = merged.unit;
            // 9D — if this contributing row is inv, promote the bucket to inv
            if (!evBags[ev.id].sections[sec].items[k]._type && ing._type === 'inv') {
              evBags[ev.id].sections[sec].items[k]._type = 'inv';
              evBags[ev.id].sections[sec].items[k].ops_inventory_id = ing.ops_inventory_id || null;
            }
          }
        });
      });
    });
    return evBags;
  }

  /* ── Derived: unique categories & venues from live data ── */
  const itemCategories = useMemo(() => [...new Set(items.map(i => i.cat))].filter(Boolean).sort(), [items]);
  const itemVenues = useMemo(() => [...new Set(items.flatMap(i => (i.venues||[]).map(v => v.venueName)))].filter(Boolean).sort(), [items]);
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
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>📦 {T2("Store & Inventory")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:3}}>
            {loading ? "Loading from inventory system…" : items.length + " " + T2("items")}
            {lastSync && <span> · Synced {lastSync.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span>}
            {loadError && <span style={{color:C.amber}}> · {loadError}</span>}
          </div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)} color={showAdd?C.muted:C.gold} style={{fontSize:12,padding:"10px 18px",borderRadius:12}}>{showAdd?"✕ Cancel":"+ "+T2("Add Item")}</Btn>
      </div>

      {/* Add form */}
      {showAdd&&(
        <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:10}}>📦 Add New Inventory Item</div>
          {/* Fields */}
          <div style={{marginBottom:7}}>
            <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>Item Name *</div>
            <input value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))} placeholder="e.g. Dinner Plates (10 inch)" style={{...fld,fontSize:12}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:7}}>
            {[{l:"Barcode",k:"barcode",ph:"Manual entry"},{l:"Brand",k:"brand",ph:"Brand name"},{l:"Supplier",k:"supplier",ph:"Supplier name"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>{f.l}</div>
                <input value={newItem[f.k]||""} onChange={e=>setNewItem(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 80px 110px",gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>Category</div>
              <select value={newItem.cat} onChange={e=>setNewItem(p=>({...p,cat:e.target.value}))} style={fld}>
                {storeItemCategories.map(ct=><option key={ct}>{ct}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>Unit</div>
              <select value={newItem.unit||"pcs"} onChange={e=>setNewItem(p=>({...p,unit:e.target.value}))} style={fld}>
                {ING_UNIT_CHOICES.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {[{l:"In Stock",k:"inStock",t:"number"},{l:"Min Stock",k:"minStock",t:"number"},{l:"Location",k:"location",ph:"Store A"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>{f.l}</div>
                <input type={f.t||"text"} value={newItem[f.k]||""} onChange={e=>setNewItem(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph||"0"} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>{if(!addingItem)setShowAdd(false);}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12,opacity:addingItem?0.6:1}}>Cancel</Btn>
            {hasPerm(currentUser,"store.edit_stock")&&<Btn onClick={addItem} color={C.gold} style={{fontSize:12,padding:"8px 20px",opacity:addingItem?0.6:1,cursor:addingItem?"not-allowed":"pointer"}}>{addingItem?"Adding...":"✓ Add to Inventory"}</Btn>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:16,paddingBottom:10,borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
        {[{v:"inventory",l:T2("📦 Inventory")},{v:"requirements",l:T2("🧮 Requirements")},{v:"orderlists",l:T2("🧺 Order Lists")},hasPerm(currentUser,"store.edit_stock")&&{v:"ingmap",l:T2("🔗 Ingredient Map")}].filter(Boolean).map(t=>(
          <button key={t.v} onClick={()=>setTab(t.v)} style={{padding:"10px 18px",borderRadius:12,fontSize:12,fontWeight:tab===t.v?600:400,cursor:"pointer",whiteSpace:"nowrap",minHeight:40,
            background:tab===t.v?C.gold+"15":"transparent",color:tab===t.v?C.gold:C.muted,border:`1.5px solid ${tab===t.v?C.gold+"40":C.border}`,
            boxShadow:tab===t.v?`0 2px 8px ${C.gold}10`:"none"}}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
        ))}
      </div>

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

          {/* Source toggle */}
          <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:11,color:C.muted,marginRight:2}}>Type:</span>
            {[
              {k:"all",   l:"All",        v:items.length},
              {k:"store", l:"Consumables", v:items.filter(i=>i.source==="store").length},
              {k:"equipment", l:"Equipment", v:items.filter(i=>i.source==="equipment").length},
            ].map(s=>(
              <button key={s.k} onClick={()=>setSourceFil(f=>f===s.k?"all":s.k)}
                style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:sourceFil===s.k?600:400,cursor:"pointer",
                  background:sourceFil===s.k?C.wine+"15":"transparent",color:sourceFil===s.k?C.wine:C.muted,
                  border:sourceFil===s.k?`1.5px solid ${C.wine}`:`1px solid ${C.border}`,transition:"all .15s"}}>
                {s.l} <span style={{fontSize:10,opacity:.7}}>{s.v}</span>
              </button>
            ))}
          </div>

          {/* Stock status pills */}
          <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:11,color:C.muted,marginRight:2}}>Stock:</span>
            {[
              {k:"all",   l:T2("All"),          v:items.length, c:C.text},
              {k:"instock",l:T2("In stock"),     v:items.filter(i=>i.available>0 && (i.reorderQty<=0 || i.available>i.reorderQty)).length, c:C.green},
              {k:"low",   l:T2("Low"),           v:items.filter(i=>i.available>0 && i.reorderQty>0 && i.available<=i.reorderQty).length, c:C.amber},
              {k:"out",   l:T2("Out"),           v:items.filter(i=>i.available<=0).length, c:C.red},
            ].map(s=>(
              <button key={s.k} onClick={()=>setStockFil(f=>f===s.k?"all":s.k)}
                style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:stockFil===s.k?600:400,cursor:"pointer",
                  background:stockFil===s.k?s.c+"15":"transparent",color:stockFil===s.k?s.c:C.muted,
                  border:stockFil===s.k?`1.5px solid ${s.c}`:`1px solid ${C.border}`,transition:"all .15s"}}>
                {s.k!=="all"&&<span style={{width:7,height:7,borderRadius:"50%",background:s.c}}/>}
                {s.l} <span style={{fontSize:10,opacity:.7}}>{s.v}</span>
              </button>
            ))}
          </div>

          {/* Category pills */}
          <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:11,color:C.muted,marginRight:2}}>Category:</span>
            <button onClick={()=>setCatFil("All")}
              style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:catFil==="All"?600:400,cursor:"pointer",
                background:catFil==="All"?C.surface:"transparent",color:catFil==="All"?C.text:C.muted,
                border:catFil==="All"?`1.5px solid ${C.border}`:`1px solid ${C.borderLight}`}}>
              All
            </button>
            {itemCategories.map(ct=>{
              const code = items.find(i=>i.cat===ct)?.catCode||"";
              const dot = catDotColor(code);
              return (
                <button key={ct} onClick={()=>setCatFil(f=>f===ct?"All":ct)}
                  style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:catFil===ct?600:400,cursor:"pointer",
                    background:catFil===ct?dot+"15":"transparent",color:catFil===ct?dot:C.muted,
                    border:catFil===ct?`1.5px solid ${dot}`:`1px solid ${C.borderLight}`}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:dot}}/>
                  {ct}
                </button>
              );
            })}
            {itemVenues.length > 1 && <>
              <span style={{width:1,height:16,background:C.borderLight,margin:"0 4px"}}/>
              <span style={{fontSize:11,color:C.muted,marginRight:2}}>Venue:</span>
              <select value={venueFil} onChange={e=>setVenueFil(e.target.value)}
                style={{padding:"4px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,appearance:"auto"}}>
                <option value="All">All</option>
                {itemVenues.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </>}
          </div>

          {/* ── Table ── */}
          <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed",fontSize:13}}>
              <colgroup>
                <col style={{width:"36%"}}/>
                <col style={{width:"13%"}}/>
                <col style={{width:"27%"}}/>
                <col style={{width:"10%"}}/>
                <col style={{width:"14%"}}/>
              </colgroup>
              <thead>
                <tr style={{background:C.bg}}>
                  {[{l:"Item",a:"left"},{l:"Category",a:"left"},{l:"Venue stock",a:"left"},{l:"Total",a:"right"},{l:"Status",a:"center"}].map(h=>(
                    <th key={h.l} style={{textAlign:h.a,padding:"9px 14px",fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:.5,borderBottom:`1px solid ${C.border}`}}>{T2(h.l)}</th>
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
                    <tr key={item.id} style={{borderBottom:`1px solid ${C.borderLight}`,background:out?C.redBg+"60":"transparent"}}>
                      {/* Item */}
                      <td style={{padding:"10px 14px",verticalAlign:"top"}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                        {item.h&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{item.h}</div>}
                        <div style={{fontSize:10,color:C.faint,marginTop:2}}>
                          {item.brand?item.brand:""}
                          {item.packSize?(item.brand?" · ":"")+item.packSize:""}
                          {item.inventoryId&&<span style={{marginLeft:4,fontFamily:"monospace",fontSize:10,color:C.muted,background:C.bg,padding:"1px 5px",borderRadius:4}}>{item.inventoryId}</span>}
                        </div>
                      </td>
                      {/* Category */}
                      <td style={{padding:"10px 14px",verticalAlign:"top"}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:C.muted}}>
                          <span style={{width:6,height:6,borderRadius:"50%",background:catDotColor(item.catCode),flexShrink:0}}/>
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
                        <div style={{fontSize:15,fontWeight:500,color:sc}}>{item.available}</div>
                        <div style={{fontSize:10,color:C.muted}}>{item.unit}</div>
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
              {lastSync && <span>🔄 Synced {lastSync.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span>}
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

        function isIssued(evId, sec, ingName) { const r=issueRecords[evId+"::"+sec+"::"+ingName]; return r&&r.issued; }

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
              row.evBreak.push({evId:ev.id, evName:ev.guest, sec, qty:ing.totalQty, unit:ing.unit});
              if(!row._type && ing._type==='inv'){ row._type='inv'; row.ops_inventory_id = ing.ops_inventory_id||null; }
            });
          });
        });
        const stations = RECIPE_DB.cats.filter(c=>catSeen.has(c.name));
        const rows = Object.values(rowMap).sort((a,b)=>a.name.localeCompare(b.name));

        /* Stock resolution — same 3-tier unit-conversion chain the old
           Shortages table used (grams, then ml, then a configured conversion
           factor for anything else), so "short" here means the same thing it
           always has. */
        function resolveStock(row){
          const isDirectInv = row._type==='inv' && !!row.ops_inventory_id;
          const stock = isDirectInv ? getStockByInventoryId(row.ops_inventory_id) : getStockForIngredient(row.name);
          const isMapped = isDirectInv || !!ingredientMap[row.name];
          if(!isMapped || !stock) return {isMapped, stock:null, requiredSU:null};
          let requiredSU;
          const recG=toGrams(row.total,row.unit), stoG=toGrams(1,stock.unit);
          if(recG!=null && stoG!=null){ requiredSU = recG/stoG; }
          else{
            const recM=toMl(row.total,row.unit), stoM=toMl(1,stock.unit);
            if(recM!=null && stoM!=null){ requiredSU = recM/stoM; }
            else{
              const oF=getUnitFamily(row.unit), aF=getUnitFamily(stock.unit);
              const adj=(oF&&aF&&oF.family===aF.family)?(aF.toBase/oF.toBase):1;
              requiredSU = row.total*adj*(stock.conversion||1);
            }
          }
          return {isMapped:true, stock, requiredSU};
        }

        function rowIssued(row){ return row.evBreak.every(b=>isIssued(b.evId,b.sec,row.name)); }
        async function toggleRowIssue(row){
          const done = rowIssued(row);
          for(const b of row.evBreak){
            await toggleIssueItem(b.evId, b.sec, {name:row.name, hindi:row.hindi, unit:b.unit, totalQty:b.qty}, done);
          }
        }

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

        return(
          <div>
            {/* Header + day picker */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🧮 {T2("Requirements — Day Sheet")}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{T2("One ordering sheet per day — every function on that day, combined.")}</div>
              </div>
              <div style={{display:"flex",borderRadius:20,overflow:"hidden",border:`1px solid ${C.border}`,background:C.bg}}>
                <button onClick={()=>setReqDay(TODAY)} style={{padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",border:"none",background:reqDay===TODAY?C.gold:"transparent",color:reqDay===TODAY?C.goldBg:C.muted}}>{T2("Today")} ({todayFnCount})</button>
                <button onClick={()=>setReqDay(TOMORROW)} style={{padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",border:"none",background:reqDay===TOMORROW?C.gold:"transparent",color:reqDay===TOMORROW?C.goldBg:C.muted}}>{T2("Tomorrow")} ({tmrwFnCount})</button>
              </div>
            </div>

            {issueLoading&&<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>{T2("Loading issue state…")}</div>}

            {/* Functions-combined strip */}
            {dayEvs.length>0 ? (
              <div style={{margin:"14px 0",padding:"12px 16px",borderRadius:14,background:C.surface,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <div style={{fontSize:12,fontWeight:700,color:C.gold,background:C.goldBg,padding:"5px 12px",borderRadius:20}}>🔗 {dayEvs.length} {T2("function")}{dayEvs.length===1?"":"s"} {T2("combined")}</div>
                {dayEvs.map(ev=>(
                  <div key={ev.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:20,background:C.bg,border:`1px solid ${C.border}`}}>
                    <span style={{fontSize:12,fontWeight:700,color:C.text}}>{ev.guest}</span>
                    <span style={{fontSize:11,color:C.faint}}>{ev.pax} {T2("pax")} · {ev.time||"TBD"}</span>
                  </div>
                ))}
                <div style={{marginLeft:"auto",fontSize:11,color:C.muted}}>{dayEvs.reduce((s,e)=>s+(+e.pax||0),0)} {T2("pax total")}</div>
              </div>
            ) : (
              <div style={{margin:"14px 0",padding:"36px 20px",borderRadius:14,background:C.surface,border:`1px dashed ${C.border}`,textAlign:"center",color:C.muted,fontSize:13}}>
                {T2("No functions scheduled — nothing to prep or order yet.")}
              </div>
            )}

            {dayEvs.length>0 && rows.length===0 && (
              <div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,color:C.muted,fontSize:13}}>{T2("No ingredient data for this day's dishes.")}</div>
            )}

            {dayEvs.length>0 && rows.length>0 && (
              <>
                {/* Summary chips */}
                <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                  <div style={{fontSize:11,fontWeight:700,padding:"6px 12px",borderRadius:20,background:C.goldBg,color:C.gold}}>{rows.length} {T2("ingredient lines")}</div>
                  <div style={{fontSize:11,fontWeight:700,padding:"6px 12px",borderRadius:20,background:C.redBg,color:C.red}}>⚠ {shortCount} {T2("short of stock")}</div>
                  <div style={{fontSize:11,fontWeight:700,padding:"6px 12px",borderRadius:20,background:C.greenBg,color:C.green}}>{issuedCount} {T2("issued")}</div>
                  <div style={{fontSize:11,fontWeight:700,padding:"6px 12px",borderRadius:20,background:C.purpleBg,color:C.purple}}>{orderedRowCount} {T2("on order lists")}</div>
                  <button onClick={()=>setTab("orderlists")} style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:C.gold,background:"transparent",border:"none",cursor:"pointer"}}>{T2("View Order Lists")} →</button>
                </div>

                {/* Table */}
                <div style={{border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",background:C.surface}}>
                  <div style={{overflowX:"auto"}}>
                    <table style={{borderCollapse:"collapse",fontSize:11,width:"100%"}}>
                      <thead>
                        <tr style={{background:C.bg}}>
                          <th style={{position:"sticky",left:0,background:C.bg,zIndex:2,textAlign:"left",padding:"6px 10px",fontSize:9.5,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.4,borderBottom:`2px solid ${C.border}`,minWidth:150,maxWidth:150}}>{T2("Item")}</th>
                          <th style={{textAlign:"center",padding:"6px 6px",fontSize:9.5,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`2px solid ${C.border}`}}>{T2("UM")}</th>
                          {stations.map(st=><th key={st.id} style={{textAlign:"right",padding:"6px 6px",fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.2,borderBottom:`2px solid ${C.border}`,minWidth:56,whiteSpace:"normal",lineHeight:1.15}} title={st.name}>{st.icon} {st.name}</th>)}
                          <th style={{textAlign:"right",padding:"6px 8px",fontSize:9.5,fontWeight:700,color:C.text,textTransform:"uppercase",borderBottom:`2px solid ${C.border}`}}>{T2("Total")}</th>
                          <th style={{textAlign:"right",padding:"6px 8px",fontSize:9.5,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`2px solid ${C.border}`}}>{T2("Stock")}</th>
                          <th style={{textAlign:"left",padding:"6px 10px",fontSize:9.5,fontWeight:700,color:C.muted,textTransform:"uppercase",borderBottom:`2px solid ${C.border}`,minWidth:210}}>{T2("Actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row=>{
                          const {isMapped, stock, requiredSU} = resolveStock(row);
                          const short = isMapped && stock && requiredSU!=null && requiredSU>stock.available;
                          const done = rowIssued(row);
                          const list = orderListFor(row.name);
                          const pickerOpen = reqPicker===row.name;
                          return (
                            <tr key={row.name} style={{borderBottom:`1px solid ${C.borderLight}`}}>
                              <td style={{position:"sticky",left:0,background:C.surface,padding:"4px 10px",fontWeight:600,color:C.text,verticalAlign:"middle",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={row.name+(row.hindi?" ("+row.hindi+")":"")}>{row.name}{row.hindi?<span style={{fontSize:9.5,color:C.muted,marginLeft:4}}>({row.hindi})</span>:""}</td>
                              <td style={{textAlign:"center",padding:"4px 6px",color:C.faint,verticalAlign:"middle"}}>{row.unit}</td>
                              {stations.map(st=>{
                                const cell = row.byCat[st.name];
                                return <td key={st.id} style={{textAlign:"right",padding:"4px 6px",color:C.muted,verticalAlign:"middle"}}>{cell?fmtIssueQty(cell.totalQty,cell.unit):"—"}</td>;
                              })}
                              <td style={{textAlign:"right",padding:"4px 8px",fontWeight:700,color:C.text,verticalAlign:"middle"}}>{fmtIssueQty(row.total,row.unit)}</td>
                              <td style={{textAlign:"right",padding:"4px 8px",fontWeight:700,color:!isMapped?C.faint:short?C.red:C.text,verticalAlign:"middle"}}>
                                {!isMapped
                                  ? <span onClick={()=>setMapModalIng({name:row.name,hindi:row.hindi||"",unit:row.unit})} style={{cursor:"pointer",fontSize:9.5,color:C.amber,textDecoration:"underline"}}>{T2("link to store")}</span>
                                  : stock ? fmtIssueQty(stock.available,stock.unit) : "—"}
                              </td>
                              <td style={{padding:"4px 10px",verticalAlign:"middle"}}>
                                <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                                  {done ? (
                                    <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:7,background:C.greenBg,color:C.green,whiteSpace:"nowrap"}}>✓ {T2("Issued")}</span>
                                  ) : (
                                    hasPerm(currentUser,"store.smart_issue") && <button onClick={()=>toggleRowIssue(row)} style={{padding:"3px 8px",borderRadius:7,fontSize:10,fontWeight:700,cursor:"pointer",background:C.surface,color:C.green,border:`1.5px solid ${C.greenBorder}`,whiteSpace:"nowrap"}}>{T2("Issue from Store")}</button>
                                  )}
                                  {list ? (
                                    <span style={{display:"flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:7,background:ORDER_LIST_META[list.list_key].bg,color:ORDER_LIST_META[list.list_key].color,whiteSpace:"nowrap"}}>
                                      {ORDER_LIST_META[list.list_key].icon} {ORDER_LIST_META[list.list_key].label}
                                      <button onClick={()=>removeFromOrderList(row)} aria-label={T2("Remove from order list")} style={{border:"none",background:"transparent",color:"inherit",cursor:"pointer",fontSize:11,padding:0,lineHeight:1}}>×</button>
                                    </span>
                                  ) : pickerOpen ? (
                                    <div style={{display:"flex",alignItems:"center",gap:3}}>
                                      {Object.entries(ORDER_LIST_META).map(([key,meta])=>(
                                        <button key={key} onClick={()=>addToOrderList(row,key)} style={{padding:"3px 6px",borderRadius:6,fontSize:9.5,fontWeight:700,cursor:"pointer",background:meta.bg,color:meta.color,border:`1px solid ${meta.border}`,whiteSpace:"nowrap"}}>{meta.icon} {meta.label}</button>
                                      ))}
                                      <button onClick={()=>setReqPicker(null)} aria-label={T2("Cancel")} style={{border:"none",background:"transparent",color:C.faint,cursor:"pointer",fontSize:12,padding:"0 2px"}}>×</button>
                                    </div>
                                  ) : (
                                    <button onClick={()=>setReqPicker(row.name)} style={{padding:"3px 8px",borderRadius:7,fontSize:10,fontWeight:700,cursor:"pointer",background:C.surface,color:C.gold,border:`1.5px solid ${C.goldBorder}`,whiteSpace:"nowrap"}}>+ {T2("Add to Order list")}</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── ORDER LISTS (Dairy / Grocery / Vegetable) ── */}
      {tab==="orderlists"&&(()=>{
        const grouped = {dairy:[],grocery:[],vegetable:[]};
        orderListItems.slice().sort((a,b)=>(a.order_date+a.ingredient_name).localeCompare(b.order_date+b.ingredient_name)).forEach(r=>{
          if(grouped[r.list_key]) grouped[r.list_key].push(r);
        });
        return(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>🧺 {T2("Order Lists")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Items sent here from the Requirements sheet — split by what the buyer actually orders from.")}</div>

            {orderListLoading&&<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>{T2("Loading…")}</div>}

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,alignItems:"start"}}>
              {Object.entries(ORDER_LIST_META).map(([key,meta])=>{
                const list = grouped[key];
                return (
                  <Card key={key} style={{padding:0,overflow:"hidden"}}>
                    <div style={{padding:"14px 16px",background:meta.bg,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:14,fontWeight:700,color:meta.color}}>
                        <span>{meta.icon}</span><span>{T2(meta.label)}</span>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:12,background:C.surface,color:meta.color}}>{list.length} {T2("items")}</span>
                    </div>
                    {list.length===0 && <div style={{padding:"30px 16px",textAlign:"center",color:C.muted,fontSize:12}}>{T2("Nothing added to this list yet.")}</div>}
                    {list.map(item=>(
                      <div key={item.order_date+item.ingredient_name} style={{padding:"12px 16px",borderTop:`1px solid ${C.borderLight}`,display:"flex",alignItems:"flex-start",gap:10}}>
                        <button onClick={()=>toggleOrdered(item)} aria-label={T2("Mark ordered")} style={{width:20,height:20,flexShrink:0,marginTop:1,borderRadius:6,border:`1.5px solid ${item.ordered?meta.color:C.border}`,background:item.ordered?meta.color:"transparent",color:"#fff",fontSize:12,lineHeight:"17px",textAlign:"center",cursor:"pointer",padding:0}}>{item.ordered?"✓":""}</button>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:item.ordered?C.faint:C.text,textDecoration:item.ordered?"line-through":"none"}}>{item.ingredient_name} · {fmtIssueQty(item.qty,item.unit)}</div>
                          <div style={{fontSize:11,color:C.faint,marginTop:2}}>{T2("for")} {item.source||"—"} · {item.order_date}</div>
                        </div>
                      </div>
                    ))}
                  </Card>
                );
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
          <div>
            {/* Header */}
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>🔗 {T2("Ingredient Map")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:14}}>{T2("Link recipe ingredients to store inventory items for stock tracking")}</div>

            {/* Progress bar */}
            <div style={{background:C.bg,borderRadius:12,padding:"14px 16px",border:`1px solid ${C.border}`,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600,color:C.text}}>{mappedCount} / {total} {T2("linked")}</span>
                <span style={{fontSize:12,color:unmappedCount>0?C.amber:C.green,fontWeight:600}}>{unmappedCount>0?unmappedCount+" "+T2("remaining"):"✓ "+T2("All linked")}</span>
              </div>
              <div style={{height:6,borderRadius:3,background:C.borderLight,overflow:"hidden"}}>
                <div style={{height:6,borderRadius:3,background:total>0&&mappedCount===total?C.green:C.gold,width:(total>0?Math.round(mappedCount/total*100):0)+"%",transition:"width .3s"}}/>
              </div>
            </div>

            {/* Filter pills + search */}
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
              {[{v:"all",l:T2("All")+" ("+total+")"},{v:"unmapped",l:"⚠ "+T2("Unmapped")+" ("+unmappedCount+")"},{v:"mapped",l:"✓ "+T2("Mapped")+" ("+mappedCount+")"}].map(f=>(
                <button key={f.v} onClick={()=>{setMapTabFilter(f.v);setMapTabPage(0);}} style={{padding:"7px 14px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:32,
                  background:mapTabFilter===f.v?C.gold:C.bg,color:mapTabFilter===f.v?C.goldBg:C.muted,border:`1px solid ${mapTabFilter===f.v?C.gold:C.border}`}}>{f.l}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <input value={mapTabSearch} onChange={e=>{setMapTabSearch(e.target.value);setMapTabPage(0);}} placeholder={T2("Search ingredients...")}
                style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.bg,boxSizing:"border-box"}}/>
              <button onClick={openIngDedup} title={T2("Scan for similar/duplicate ingredient names to merge")}
                style={{padding:"10px 14px",borderRadius:10,background:C.surface,color:C.text,border:`1px solid ${C.border}`,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                🔍 {T2("Find duplicates")}
              </button>
            </div>

            {/* Merge selection bar — pick 2+ cards' checkboxes to merge duplicate/similar ingredient names into one, same idea as the dish-merge feature */}
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

            {/* Auto-link all suggestions button */}
            {mapTabFilter==="unmapped"&&unmappedCount>0&&unmappedCount<=500&&(()=>{
              const suggestions = allRecipeIngredients.filter(i=>!i.hasInv && !ingredientMap[i.name]).map(i=>({ing:i,match:fuzzyMatchStoreItem(i.name)})).filter(s=>s.match&&s.match.score>=70);
              if(suggestions.length===0) return null;
              return(
                <button onClick={async()=>{
                  for(const s of suggestions){
                    var autoC = calcAutoConversion(s.ing.unit, s.match.item.unit);
                    await saveIngredientMapping(s.ing.name, s.ing.hindi, s.match.item, autoC !== null ? autoC : 1);
                  }
                }} style={{width:"100%",padding:"12px",borderRadius:10,background:C.gold,color:C.goldBg,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",marginBottom:14,minHeight:40}}>
                  ✨ {T2("Auto-link")} {suggestions.length} {T2("suggested matches")}
                </button>
              );
            })()}

            

            {/* Ingredient list */}
            {filtered.length===0&&<div style={{textAlign:"center",padding:28,background:C.bg,borderRadius:12,color:C.muted,fontSize:12}}>{T2("No ingredients match your filter.")}</div>}

            {/* Pagination info */}
            {filtered.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:11,color:C.muted}}>{T2("Showing")} {mapTabPage*30+1}–{Math.min((mapTabPage+1)*30,filtered.length)} {T2("of")} {filtered.length}</span>
              <div style={{display:"flex",gap:6}}>
                {mapTabPage>0&&<button onClick={()=>setMapTabPage(p=>p-1)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",background:C.bg,color:C.text,border:`1px solid ${C.border}`}}>← {T2("Prev")}</button>}
                {(mapTabPage+1)*30<filtered.length&&<button onClick={()=>setMapTabPage(p=>p+1)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",background:C.gold,color:C.goldBg,border:"none"}}>→ {T2("Next")}</button>}
              </div>
            </div>}

            {filtered.slice(mapTabPage*30,(mapTabPage+1)*30).map(ing=>{
              const mapping = ingredientMap[ing.name];
              const isMapped = !!mapping;
              const suggestion = !isMapped ? fuzzyMatchStoreItem(ing.name) : null;

              return(
                <Card key={ing.name} style={{marginBottom:8,padding:"12px 16px",border:isMapped?`1px solid ${C.greenBorder}`:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:C.text}}>{ing.name}</div>
                      {ing.hindi&&<div style={{fontSize:11,color:C.muted}}>{ing.hindi}</div>}
                      <div style={{fontSize:10,color:C.faint,marginTop:2,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                        <span onClick={e=>{e.stopPropagation();setRecipesModalIng(ing);}}
                          style={{cursor:"pointer",color:C.gold,textDecoration:"underline",fontWeight:600}}
                          title={T2("Click to see which recipes use this ingredient")}>
                          {T2("Used in")} {ing.dishes.length} {T2("recipes")}
                        </span> · {T2("unit")}: {ing.unit}
                        <button onClick={()=>setIngMergeModal({sources:[ing.name],target:ing.name,unit:ing.unit})}
                          title={T2("Edit unit — updates every recipe using this ingredient")}
                          style={{fontSize:9,padding:"1px 5px",borderRadius:4,background:"transparent",color:C.faint,border:`1px solid ${C.border}`,cursor:"pointer"}}>✏️</button>
                      </div>

                      {/* Mapped — show linked item */}
                      {isMapped&&(
                        <div style={{marginTop:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            <div style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:C.greenBg,color:C.green,fontWeight:600}}>
                              ✓ {mapping.ops_item_name} ({mapping.ops_item_unit})
                            </div>
                            <button onClick={()=>removeIngredientMapping(ing.name)}
                              style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.redBg,color:C.red,border:"none",cursor:"pointer",fontWeight:600}}>✕</button>
                          </div>
                          {(mapping.unit_conversion||1)!==1&&(
                            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                              <span style={{fontSize:10,color:C.muted}}>1 {mapping.ops_item_unit} = {Math.round(1/(mapping.unit_conversion||1)*10000)/10000} {ing.unit}</span>
                              <button onClick={()=>setConvModal({ingName:ing.name,ingHindi:ing.hindi||"",opsItem:{_opsId:mapping.ops_item_id,name:mapping.ops_item_name,unit:mapping.ops_item_unit},recipeUnit:ing.unit,storeUnit:mapping.ops_item_unit,convValue:String(Math.round(1/(mapping.unit_conversion||1)*10000)/10000),editMode:true})}
                                style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:C.bg,color:C.muted,border:`1px solid ${C.border}`,cursor:"pointer"}}>✏️</button>
                            </div>
                          )}
                          {(mapping.unit_conversion||1)===1&&ing.unit!==(mapping.ops_item_unit||"").toLowerCase()&&(
                            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                              <span style={{fontSize:10,color:C.amber}}>⚠ {T2("Units differ")} ({ing.unit} → {mapping.ops_item_unit})</span>
                              <button onClick={()=>setConvModal({ingName:ing.name,ingHindi:ing.hindi||"",opsItem:{_opsId:mapping.ops_item_id,name:mapping.ops_item_name,unit:mapping.ops_item_unit},recipeUnit:ing.unit,storeUnit:mapping.ops_item_unit,convValue:"",editMode:true})}
                                style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:C.amberBg,color:"#854F0B",border:`1px solid ${C.amberBorder}`,cursor:"pointer"}}>{T2("Set conversion")}</button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Unmapped with suggestion */}
                      {!isMapped&&suggestion&&(
                        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,color:C.muted}}>💡 {T2("Suggested")}:</span>
                          <button onClick={()=>handleStoreItemSelect(ing.name, ing.hindi, ing.unit, suggestion.item)}
                            style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:C.amberBg,color:"#854F0B",border:`1px solid ${C.amberBorder}`,cursor:"pointer",fontWeight:600}}>
                            {suggestion.item.name} ({suggestion.score}%)
                          </button>
                          <button onClick={()=>setMapModalIng({name:ing.name,hindi:ing.hindi,unit:ing.unit})}
                            style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.bg,color:C.muted,border:`1px solid ${C.border}`,cursor:"pointer"}}>{T2("Other")}</button>
                        </div>
                      )}

                      {/* Unmapped, no suggestion */}
                      {!isMapped&&!suggestion&&(
                        <div style={{marginTop:8}}>
                          <button onClick={()=>setMapModalIng({name:ing.name,hindi:ing.hindi,unit:ing.unit})}
                            style={{fontSize:11,padding:"4px 12px",borderRadius:8,background:C.amberBg,color:"#854F0B",border:`1px solid ${C.amberBorder}`,cursor:"pointer",fontWeight:600}}>
                            🔗 {T2("Link to store item")}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right side — merge checkbox + status indicator */}
                    <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                      <input type="checkbox" checked={!!ingSelected[ing.name]}
                        onChange={()=>setIngSelected(p=>{const n={...p};if(n[ing.name])delete n[ing.name];else n[ing.name]=true;return n;})}
                        title={T2("Select to merge with other ingredients")}
                        style={{width:16,height:16,cursor:"pointer",accentColor:C.gold}}/>
                      <div style={{width:32,height:32,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
                        background:isMapped?C.greenBg:C.amberBg}}>
                        <span style={{fontSize:14}}>{isMapped?"✓":"⚠"}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Bottom pagination */}
            {filtered.length>30&&<div style={{display:"flex",justifyContent:"center",gap:8,marginTop:14,paddingTop:14,borderTop:`1px solid ${C.borderLight}`}}>
              {mapTabPage>0&&<button onClick={()=>{setMapTabPage(p=>p-1);window.scrollTo({top:0,behavior:"smooth"});}} style={{padding:"8px 18px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",background:C.bg,color:C.text,border:`1px solid ${C.border}`}}>← {T2("Previous")}</button>}
              <span style={{padding:"8px 14px",fontSize:12,color:C.muted}}>{T2("Page")} {mapTabPage+1} / {Math.ceil(filtered.length/30)}</span>
              {(mapTabPage+1)*30<filtered.length&&<button onClick={()=>{setMapTabPage(p=>p+1);window.scrollTo({top:0,behavior:"smooth"});}} style={{padding:"8px 18px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",background:C.gold,color:C.goldBg,border:"none"}}>→ {T2("Next")}</button>}
            </div>}
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
        const resolvedCount = Object.keys(ingDedupResolved).length;
        const skippedCount = Object.keys(ingDedupSkipped).length;
        const remainingIdx = ingDedupClusters.map((_,i)=>i).filter(i=>!ingDedupResolved[i]&&!ingDedupSkipped[i]);
        const highIdx = remainingIdx.filter(i=>ingDedupClusters[i].confidence==='high');
        const medIdx  = remainingIdx.filter(i=>ingDedupClusters[i].confidence==='medium');
        const allDone = totalGroups>0 && remainingIdx.length===0;
        const nothingFound = totalGroups===0;

        function renderIngCard(idx){
          const c = ingDedupClusters[idx];
          const target = ingDedupTargets[idx]||'';
          const unit = ingDedupUnits[idx]||'';
          const clusterUnits = c.items.map(d=>(d.unit||'').trim()).filter(Boolean);
          const unitOptions = Array.from(new Set(clusterUnits.concat(ING_UNIT_CHOICES).concat(unit?[unit]:[])));
          const saving = ingDedupSavingIdx===idx;
          const disabled = ingDedupSavingIdx!=null && !saving;
          return (
            <div key={idx} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:12,marginBottom:10,background:C.bg}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>{T2(c.reason)}</div>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
                {c.items.slice().sort((a,b)=>(b.dishes||[]).length-(a.dishes||[]).length).map(d=>{
                  const isT = d.name===target;
                  const uses = (d.dishes||[]).length;
                  const isMapped = d.hasInv || !!ingredientMap[d.name];
                  return (
                    <label key={d.name} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:5,background:isT?C.greenBg:C.surface,border:`1px solid ${isT?C.greenBorder:C.border}`,cursor:disabled?"not-allowed":"pointer"}}>
                      <input type="radio" name={"ingdedup-target-"+idx} checked={isT} disabled={disabled||saving}
                        onChange={()=>pickIngDedupTarget(idx,d.name)} style={{margin:0,cursor:disabled?"not-allowed":"pointer"}}/>
                      <span style={{fontSize:13,fontWeight:isT?700:500,color:C.text,flex:1}}>{d.name}</span>
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:3,background:isMapped?C.greenBg:C.amberBg,color:isMapped?C.green:"#854F0B"}}>{isMapped?T2("MAPPED"):T2("UNMAPPED")}</span>
                      {d.hindi&&<span style={{fontSize:11,color:C.muted}}>{d.hindi}</span>}
                      <span style={{fontSize:11,color:uses===0?C.muted:C.text,minWidth:70,textAlign:"right"}}>{uses} {T2("recipe")}{uses===1?"":"s"} · {d.unit}</span>
                    </label>
                  );
                })}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
                <span style={{fontSize:10,color:C.muted}}>{T2("Unit")}:</span>
                <select value={unit} disabled={disabled||saving} onChange={e=>setIngDedupUnits(prev=>({...prev,[idx]:e.target.value}))}
                  style={{width:80,padding:"5px 6px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                  {!unitOptions.includes(unit)&&<option value={unit}>{unit||"—"}</option>}
                  {unitOptions.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
                <div style={{flex:1}}/>
                <button onClick={()=>skipIngDedupCluster(idx)} disabled={saving||disabled}
                  style={{padding:"5px 12px",borderRadius:5,background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,fontWeight:600,cursor:(saving||disabled)?"not-allowed":"pointer"}}>{T2("Skip")}</button>
                <button onClick={()=>mergeIngDedupCluster(idx)} disabled={saving||disabled||!target||!unit}
                  style={{padding:"5px 12px",borderRadius:5,background:C.gold,border:"none",color:C.goldBg,fontSize:11,fontWeight:600,cursor:(saving||disabled||!target||!unit)?"not-allowed":"pointer",opacity:(saving||disabled||!target||!unit)?0.5:1}}>
                  {saving?T2("Merging…"):T2('Merge into "')+target+'"'}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div onClick={closeIngDedup} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:12,padding:20,maxWidth:720,width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 40px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14,gap:10}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.text}}>🔍 {T2("Find duplicates")}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>{totalGroups} {T2("groups found")} · {resolvedCount} {T2("resolved")} · {skippedCount} {T2("skipped")} · {remainingIdx.length} {T2("remaining")}</div>
                </div>
                <button onClick={closeIngDedup} disabled={ingDedupSavingIdx!=null} style={{background:"transparent",border:"none",color:C.muted,fontSize:20,cursor:ingDedupSavingIdx!=null?"not-allowed":"pointer",padding:4}}>×</button>
              </div>
              <div style={{flex:1,overflowY:"auto",marginBottom:14}}>
                {nothingFound&&<div style={{textAlign:"center",padding:"40px 20px",color:C.muted,fontSize:13}}>{T2("No duplicate candidates found in the current ingredient list.")}</div>}
                {allDone&&(
                  <div style={{textAlign:"center",padding:"30px 20px"}}>
                    <div style={{fontSize:40,marginBottom:8}}>✓</div>
                    <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4}}>{T2("All done")}</div>
                    <div style={{fontSize:12,color:C.muted}}>{resolvedCount} {T2("merged")} · {skippedCount} {T2("skipped")}</div>
                    {skippedCount>0&&<button onClick={resetIngDedupSkipped} style={{marginTop:12,padding:"5px 12px",borderRadius:5,background:"transparent",border:`1px solid ${C.border}`,color:C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{T2("Review skipped")}</button>}
                  </div>
                )}
                {!allDone&&highIdx.length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>▶ {T2("High confidence")} ({highIdx.length})</div>
                    {highIdx.map(renderIngCard)}
                  </div>
                )}
                {!allDone&&medIdx.length>0&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>▶ {T2("Medium confidence")} ({medIdx.length})</div>
                    {medIdx.map(renderIngCard)}
                  </div>
                )}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:11,color:C.muted}}>
                  {skippedCount>0&&!allDone&&<button onClick={resetIngDedupSkipped} style={{padding:"4px 10px",borderRadius:5,background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,fontWeight:600,cursor:"pointer"}}>{T2("Reset skipped")} ({skippedCount})</button>}
                </div>
                <button onClick={closeIngDedup} disabled={ingDedupSavingIdx!=null} style={{padding:"6px 14px",borderRadius:6,background:C.gold,border:"none",color:C.goldBg,fontSize:12,fontWeight:600,cursor:ingDedupSavingIdx!=null?"not-allowed":"pointer"}}>{T2("Close")}</button>
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

    </div>
  );
}



export { StoreModule };