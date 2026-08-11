// Ambria FnB — Store & Inventory (reads live data from Ambria Ops Supabase)
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { C, OPS_IMG_BASE } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr, safeNum, TOMORROW } from '../utils/helpers.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { Card, Btn, Chip, SectionHeader } from './SharedUI.jsx';
import { dbLoad, dbUpsert, dbDelete } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { opsSupabase } from '../lib/opsSupabase.js';
import { getCatForDish, RECIPE_DB, getIngrForDish } from '../data/recipeData.js';
import { hasPerm } from '../data/permissions.js';

const OPS_CACHE_KEY = "ambria_ops_catering_v1";

/* Venue → color mapping for stock bars */
const VENUE_COLORS = {
  AP: { bar: "#BA7517", bg: "#FAEEDA", text: "#854F0B", label: "AP" },
  AE: { bar: "#378ADD", bg: "#E6F1FB", text: "#0C447C", label: "AE" },
  AM: { bar: "#7F77DD", bg: "#EEEDFE", text: "#3C3489", label: "AM" },
};
function venueColor(code) { return VENUE_COLORS[code] || { bar: "#8E8678", bg: "#F1EFE8", text: "#5F5E5A", label: code || "?" }; }

/* Category → dot color (stable per catCode) */
const CAT_DOT_COLORS = {
  GRO: "#BA7517", BEV: "#378ADD", SPI: "#D85A30", BAK: "#7F77DD",
  DAI: "#1D9E75", DRY: "#8E8678", FRV: "#1D9E75", FRF: "#D4537E",
  EXO: "#D85A30", PMF: "#D64040", IMP: "#BA7517",
};
function catDotColor(catCode) { return CAT_DOT_COLORS[catCode] || "#8E8678"; }

/* Transform raw Ops row into the shape our UI needs */
function transformOpsItem(it) {
  return {
    _opsId: it.id,
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
  const [scanning, setScanning] = useState(false);
  const [scanResult,setScanResult]=useState("");
  const [scanError,setScanError]=useState("");
  const scanVideoRef  = useRef(null);
  const scanStreamRef = useRef(null);
  const scanAnimRef   = useRef(null);
  const [editStock,setEditStock]=useState(null);
  const [editVal,  setEditVal]  =useState("");
  const [issueDate, setIssueDate] = useState("all");
  const [issueMode, setIssueMode] = useState("event"); // "event" | "collective"
  const [issueExpEv, setIssueExpEv] = useState(null); // expanded event id
  const [issueExpSec, setIssueExpSec] = useState(null); // expanded section key "evId::secName"
  const [issueAssignments, setIssueAssignments] = useState({}); // {[event_id+"::"+section_name]: venue_code}
  const [issueRecords, setIssueRecords] = useState({}); // {[event_id+"::"+section+"::"+ingredient]: {issued,qty_issued,...}}
  const [issueLoading, setIssueLoading] = useState(false);
  const [ingredientMap, setIngredientMap] = useState({}); // {ingredient_name: {ops_item_id, ops_item_name, ops_item_unit, unit_conversion}}
  const [mapModalIng, setMapModalIng] = useState(null); // {name,hindi,unit} — currently mapping this ingredient
  const [recipesModalIng, setRecipesModalIng] = useState(null); // {name,hindi,unit,dishes:[]} — showing which recipes use this ingredient
  const [mapSearch, setMapSearch] = useState("");
  const [mapTabFilter, setMapTabFilter] = useState("unmapped"); // "all" | "mapped" | "unmapped"
  const [mapTabSearch, setMapTabSearch] = useState("");
  const [mapTabPage, setMapTabPage] = useState(0); // pagination offset
  const [purchaseOrders, setPurchaseOrders] = useState([]); // from store_purchase_orders + store_po_items
  const [poLoading, setPoLoading] = useState(false);
  const [convModal, setConvModal] = useState(null); // {ingName, ingHindi, opsItem, recipeUnit, storeUnit, convValue, editMode}
  const [expandedShortage, setExpandedShortage] = useState(null);
  const [newItem,  setNewItem]  =useState({name:"",barcode:"",brand:"",supplier:"",cat:"Dry Goods",unit:"pcs",inStock:0,minStock:10,perPax:0,location:"Store A"});

  /* ── V65: Ops-side requisitions state (catering_requisitions + catering_requisition_items) ── */
  const [opsReqs, setOpsReqs] = useState([]);
  const [opsReqLoading, setOpsReqLoading] = useState(false);
  const [opsReqCancelId, setOpsReqCancelId] = useState(null);

  /* Venue id → code + display name (locked in V65). Ops venue names are placeholders — never display. */
  const VENUE_ID_TO_CODE = {9:"AP", 11:"AE", 10:"AM", 12:"AR"};
  const VENUE_ID_TO_NAME = {9:"Ambria Pushpanjali", 11:"Ambria Exotica", 10:"Ambria Manaktala", 12:"Ambria Restro"};

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
        const [aRes, iRes, mRes] = await Promise.all([
          supabase.from('store_issue_assignments').select('*'),
          supabase.from('store_issues').select('*'),
          supabase.from('ingredient_item_map').select('*'),
        ]);
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

    // Load POs (legacy — deprecated in V65 but preserved for audit)
    async function loadPOs() {
      try {
        const {data:pos} = await supabase.from('store_purchase_orders').select('*').order('created_at',{ascending:false});
        const {data:poItems} = await supabase.from('store_po_items').select('*');
        if(pos&&poItems){
          setPurchaseOrders(pos.map(po=>({...po,items:(poItems||[]).filter(i=>i.po_id===po.id)})));
        }
      } catch(e){ console.error("PO load failed:",e); }
    }
    loadPOs();

    // V65: Load Ops requisitions + realtime subs
    async function loadOpsReqs() {
      if (!opsSupabase) return;
      setOpsReqLoading(true);
      try {
        const {data:reqs, error:rErr} = await opsSupabase
          .from('catering_requisitions')
          .select('id, requested_by, requested_by_name, requested_at, venue_id, event_ids, event_summary, needed_by, notes, status, approved_at, received_at, created_at, updated_at')
          .order('created_at',{ascending:false})
          .limit(200);
        if (rErr) { console.error('Ops req load:',rErr); setOpsReqLoading(false); return; }
        const reqIds = (reqs||[]).map(r=>r.id);
        let itemsData = [];
        if (reqIds.length) {
          const {data:its} = await opsSupabase
            .from('catering_requisition_items')
            .select('id, requisition_id, ops_inventory_id, item_name, item_name_hindi, category_name, qty_requested, qty_received, unit, notes, status, created_at')
            .in('requisition_id', reqIds);
          itemsData = its || [];
        }
        const combined = (reqs||[]).map(r=>({...r, items: itemsData.filter(i=>i.requisition_id===r.id)}));
        setOpsReqs(combined);
      } catch(e){ console.error('Ops req load ex:',e); }
      setOpsReqLoading(false);
    }
    loadOpsReqs();

    let opsCh1=null, opsCh2=null;
    if (opsSupabase) {
      opsCh1 = opsSupabase.channel('ops-req-rt').on('postgres_changes',{event:'*',schema:'public',table:'catering_requisitions'},()=>loadOpsReqs()).subscribe();
      opsCh2 = opsSupabase.channel('ops-req-items-rt').on('postgres_changes',{event:'*',schema:'public',table:'catering_requisition_items'},()=>loadOpsReqs()).subscribe();
    }

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
    const ch4 = supabase.channel('spo-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'store_purchase_orders' }, () => {
      supabase.from('store_purchase_orders').select('*').order('created_at',{ascending:false}).then(({data:pos})=>{
        supabase.from('store_po_items').select('*').then(({data:poItems})=>{
          if(pos&&poItems) setPurchaseOrders(pos.map(po=>({...po,items:(poItems||[]).filter(i=>i.po_id===po.id)})));
        });
      });
    }).subscribe();
    subs = [ch1, ch2, ch3, ch4];

    return () => {
      subs.forEach(ch => supabase.removeChannel(ch));
      if (opsCh1 && opsSupabase) opsSupabase.removeChannel(opsCh1);
      if (opsCh2 && opsSupabase) opsSupabase.removeChannel(opsCh2);
    };
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

  /* ── Extract all unique ingredient names from recipe DB ── */
  const allRecipeIngredients = useMemo(() => {
    const seen = {};
    for (const catId of Object.keys(RECIPE_DB.recipes || {})) {
      for (const recipe of (RECIPE_DB.recipes[catId] || [])) {
        if (recipe.ingredients?.items?.length > 0) {
          recipe.ingredients.items.forEach(it => {
            const n = it.name;
            if (!seen[n]) seen[n] = { name: n, hindi: it.hindi || "", unit: it.unit || "", dishes: [] };
            seen[n].dishes.push(recipe.n);
          });
        }
      }
    }
    return Object.values(seen).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

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

  async function generatePO(shortages, filtEvs) {
    if(!shortages.length) return;
    setPoLoading(true);
    try {
      const poNum = "PO-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + Date.now().toString(36).slice(-4).toUpperCase();
      const staffId = currentUser?.staff_id || currentUser?.staffListId || currentUser?.name || "system";
      const {data:poRow, error:poErr} = await supabase.from('store_purchase_orders').insert({
        po_number: poNum, status: 'draft', created_by: staffId,
        notes: filtEvs.map(e=>e.guest+" ("+e.date+")").join(", ")
      }).select().single();
      if(poErr||!poRow){ console.error("PO create err:",poErr); setPoLoading(false); return; }
      const lineItems = shortages.map(s=>({
        po_id: poRow.id, ingredient_name: s.name, ops_item_id: s.opsItemId||null,
        ops_item_name: s.opsItemName||null, qty_required: s.required,
        qty_ordered: s.shortfall, qty_received: 0, unit: s.unit,
        event_ids: s.eventIds, event_names: s.eventNames,
      }));
      const {error:liErr} = await supabase.from('store_po_items').insert(lineItems);
      if(liErr) console.error("PO items err:",liErr);
      else { setTab("requisitions"); }
    } catch(e){ console.error("PO gen failed:",e); }
    setPoLoading(false);
  }

  async function cancelOpsReq(reqId, reason) {
    const empId = currentUser?.staff_id || currentUser?.staffListId || currentUser?.id;
    if (!empId) { alert("Login required to cancel"); return; }
    setOpsReqCancelId(reqId);
    try {
      const {data, error} = await supabase.functions.invoke('ops-req-router', {
        body: {action:'cancel', payload:{req_id:reqId, cancelled_by:empId, cancelled_reason:reason||'cancelled via app'}}
      });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      // Realtime sub refreshes list; no manual refetch needed
    } catch(e) {
      alert("Cancel failed: " + (e.message||String(e)));
    }
    setOpsReqCancelId(null);
  }

  async function saveIngredientMapping(ingName, ingHindi, opsItem, conversion) {
    var conv = (typeof conversion === "number" && conversion > 0) ? conversion : 1;
    const staffId = currentUser?.staff_id || currentUser?.staffListId || "";
    const rec = {
      ingredient_name: ingName,
      ingredient_hindi: ingHindi || null,
      ops_item_id: opsItem._opsId,
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
        const cat = getCatForDish(dishName);
        if (cat.id === "beverages") return;
        const sec = cat.name;
        const meta = { color: cat.color || C.muted, icon: cat.icon || "🍽" };
        const ingr = getIngrForDish(dishName, pax);
        if (!ingr || ingr.length === 0) return;
        const isNew = ingr[0]?._newFmt;
        if (!evBags[ev.id].sections[sec]) evBags[ev.id].sections[sec] = { items: {}, meta };
        ingr.forEach(ing => {
          const k = ing.n;
          const rawQty = isNew ? ing.q : ing.q * pax;
          if (!evBags[ev.id].sections[sec].items[k]) {
            const norm = normalizeToBaseUnit(rawQty, ing.u);
            evBags[ev.id].sections[sec].items[k] = { name: ing.n, hindi: ing.h || "", unit: norm.unit, totalQty: norm.qty };
          } else {
            const merged = addQtyWithUnitNorm(evBags[ev.id].sections[sec].items[k], rawQty, ing.u);
            evBags[ev.id].sections[sec].items[k].totalQty = merged.totalQty;
            evBags[ev.id].sections[sec].items[k].unit = merged.unit;
          }
        });
      });
    });
    return evBags;
  }

  /* ── Derived: unique categories & venues from live data ── */
  const itemCategories = useMemo(() => [...new Set(items.map(i => i.cat))].filter(Boolean).sort(), [items]);
  const itemVenues = useMemo(() => [...new Set(items.flatMap(i => (i.venues||[]).map(v => v.venueName)))].filter(Boolean).sort(), [items]);

  function stopScan(){
    if(scanAnimRef.current) cancelAnimationFrame(scanAnimRef.current);
    scanStreamRef.current?.getTracks().forEach(t=>t.stop());
    scanStreamRef.current=null; setScanning(false);
  }
  async function startScan(){
    setScanError(""); setScanResult("");
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
      scanStreamRef.current=stream; setScanning(true);
      setTimeout(()=>{
        if(scanVideoRef.current){scanVideoRef.current.srcObject=stream;scanVideoRef.current.play();}
        if(window.BarcodeDetector){
          const det=new window.BarcodeDetector({formats:["ean_13","ean_8","qr_code","code_128","upc_a","upc_e","itf","code_39"]});
          function detect(){
            if(!scanVideoRef.current||!scanStreamRef.current) return;
            det.detect(scanVideoRef.current).then(codes=>{
              if(codes.length>0){
                const bc=codes[0].rawValue;
                setScanResult(bc);
                setNewItem(p=>({...p,barcode:bc}));
                stopScan();

                // 1. Check master data first
                const found=items.find(i=>(i.barcode||"")===bc);
                if(found){setScanItem(found);setScanError("✅ Found in your inventory: "+found.name);return;}

                // 2. Try multiple product databases in cascade
                setScanError("🔍 Looking up in product databases…");

                async function lookupProduct(barcode){
                  // A. Open Food Facts (global food database — 3M+ products)
                  try{
                    const r1=await fetch("https://world.openfoodfacts.org/api/v2/product/"+barcode+".json",{signal:AbortSignal.timeout(5000)});
                    const d1=await r1.json();
                    if(d1.status===1&&d1.product){
                      const p=d1.product;
                      const nm=p.product_name||p.product_name_en||p.generic_name||"";
                      if(nm){
                        const br=p.brands||"";
                        const wt=p.quantity||p.net_weight||"";
                        const cat=p.categories_tags?.[0]?.replace("en:","").replace(/-/g," ")||"";
                        const nutr=p.nutriments||{};
                        return {
                          name:nm,brand:br,barcode,
                          unit:wt.toLowerCase().includes("ml")||wt.toLowerCase().includes("litre")?"ml":wt.toLowerCase().includes("kg")?"kg":wt.toLowerCase().includes("g")?"g":"pcs",
                          cat:guessCategory(nm,cat),
                          weight:wt,
                          image:p.image_thumb_url||p.image_url||"",
                          source:"Open Food Facts",
                          energy:nutr["energy-kcal_100g"]?""+Math.round(nutr["energy-kcal_100g"])+" kcal/100g":"",
                        };
                      }
                    }
                  }catch(e){}

                  // B. UPC Item DB (US/Global barcode database)
                  try{
                    const r2=await fetch("https://api.upcitemdb.com/prod/trial/lookup?upc="+barcode,{signal:AbortSignal.timeout(5000)});
                    const d2=await r2.json();
                    if(d2.code==="OK"&&d2.items?.length>0){
                      const item=d2.items[0];
                      return {
                        name:item.title||"",brand:item.brand||"",barcode,
                        unit:guessUnit(item.title||""),
                        cat:guessCategory(item.title||"",item.category||""),
                        weight:item.size||"",
                        image:item.images?.[0]||"",
                        source:"UPC Item DB",
                        energy:"",
                      };
                    }
                  }catch(e){}

                  return null;
                }

                function guessUnit(name){
                  const n=name.toLowerCase();
                  if(n.includes(" ml")||n.includes("litre")||n.includes("liter")) return "ml";
                  if(n.includes(" kg")||n.includes("kilogram")) return "kg";
                  if(n.includes(" gm")||n.includes(" g ")||n.includes("gram")) return "g";
                  if(n.includes(" l ")||n.includes(" ltr")) return "L";
                  if(n.includes("dozen")||n.includes("pack of")) return "pcs";
                  return "pcs";
                }

                function guessCategory(name,cat){
                  const n=(name+" "+cat).toLowerCase();
                  if(n.includes("chicken")||n.includes("mutton")||n.includes("fish")||n.includes("meat")||n.includes("prawn")) return "Meat & Poultry";
                  if(n.includes("milk")||n.includes("paneer")||n.includes("cream")||n.includes("butter")||n.includes("cheese")||n.includes("curd")||n.includes("yogurt")||n.includes("ghee")||n.includes("khoya")) return "Dairy";
                  if(n.includes("oil")||n.includes("atta")||n.includes("flour")||n.includes("rice")||n.includes("dal")||n.includes("lentil")||n.includes("sugar")||n.includes("salt")||n.includes("spice")||n.includes("masala")) return "Dry Goods";
                  if(n.includes("onion")||n.includes("tomato")||n.includes("potato")||n.includes("carrot")||n.includes("vegetable")||n.includes("sabzi")) return "Fresh Vegetables";
                  if(n.includes("apple")||n.includes("mango")||n.includes("banana")||n.includes("fruit")) return "Fruits";
                  if(n.includes("juice")||n.includes("drink")||n.includes("water")||n.includes("soda")||n.includes("cold drink")) return "Beverages";
                  if(n.includes("soap")||n.includes("detergent")||n.includes("cleaner")||n.includes("sanitizer")) return "Cleaning & Hygiene";
                  if(n.includes("foil")||n.includes("plastic")||n.includes("wrap")||n.includes("bag")||n.includes("box")||n.includes("pack")) return "Packaging";
                  if(n.includes("gas")||n.includes("cylinder")||n.includes("fuel")) return "Gas & Fuel";
                  return "Dry Goods";
                }

                lookupProduct(bc).then(result=>{
                  if(result&&result.name){
                    setNewItem(prev=>({...prev,name:result.name,brand:result.brand,barcode:bc,unit:result.unit,cat:result.cat}));
                    setScanLookup(result);
                    setScanError("✅ "+result.source+": "+result.name+(result.brand?" · "+result.brand:"")+(result.weight?" · "+result.weight:""));
                  } else {
                    setScanError("❌ Product not found. Fill details manually.");
                    setScanLookup(null);
                  }
                });
              }
              else scanAnimRef.current=requestAnimationFrame(detect);
            }).catch(()=>{scanAnimRef.current=requestAnimationFrame(detect);});
          }
          scanAnimRef.current=requestAnimationFrame(detect);
        } else { setScanError("Barcode scanning not supported on this browser. Enter barcode manually."); }
      },300);
    } catch(e){ setScanError("Camera access denied. Enter barcode manually."); setScanning(false); }
  }
  function addItem(){
    if(!newItem.name.trim()) return;
    setItems(p=>[...p,{...newItem,id:"it-"+Date.now(),inStock:+newItem.inStock||0,minStock:+newItem.minStock||0,perPax:+newItem.perPax||0}]);
    setNewItem({name:"",barcode:"",brand:"",supplier:"",cat:"Dry Goods",unit:"pcs",inStock:0,minStock:10,perPax:0,location:"Store A"});
    setScanResult(""); setScanError(""); stopScan(); setShowAdd(false);
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
          {/* Scanner */}
          <div style={{background:"rgba(107,24,24,.06)",borderRadius:9,padding:"9px 12px",marginBottom:10,border:`1px dashed ${C.wineBorder}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:scanning?8:0}}>
              <div><div style={{fontSize:12,fontWeight:600,color:C.gold}}>📷 Scan Barcode</div><div style={{fontSize:12,color:C.muted}}>Point camera at barcode · or enter manually below</div></div>
              {!scanning?<button onClick={startScan} style={{padding:"5px 12px",borderRadius:7,background:C.gold,color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>📷 Scan</button>
                        :<button onClick={stopScan}  style={{padding:"5px 10px",borderRadius:7,background:C.red, color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>✕</button>}
            </div>
            {scanning&&<video ref={scanVideoRef} autoPlay playsInline muted style={{width:"100%",maxHeight:160,borderRadius:7,objectFit:"cover",background:"#000",display:"block"}}/>}
            {scanResult&&<div style={{marginTop:5,fontSize:12,fontWeight:600,color:C.green}}>✓ Scanned: {scanResult}</div>}
            {scanError&&<div style={{marginTop:4,fontSize:12,color:C.amber}}>{scanError}</div>}
          </div>
          {/* Fields */}
          <div style={{marginBottom:7}}>
            <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>Item Name *</div>
            <input value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))} placeholder="e.g. Dinner Plates (10 inch)" style={{...fld,fontSize:12}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:7}}>
            {[{l:"Barcode",k:"barcode",ph:"Auto or manual"},{l:"Brand",k:"brand",ph:"Brand name"},{l:"Supplier",k:"supplier",ph:"Supplier name"}].map(f=>(
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
                {itemCategories.map(ct=><option key={ct}>{ct}</option>)}
              </select>
            </div>
            {[{l:"Unit",k:"unit",ph:"pcs"},{l:"In Stock",k:"inStock",t:"number"},{l:"Min Stock",k:"minStock",t:"number"},{l:"Location",k:"location",ph:"Store A"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:11,color:C.gold,marginBottom:2,textTransform:"uppercase",fontWeight:600}}>{f.l}</div>
                <input type={f.t||"text"} value={newItem[f.k]||""} onChange={e=>setNewItem(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph||"0"} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>{setShowAdd(false);stopScan();setScanResult("");setScanError("");}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
            {hasPerm(currentUser,"store.edit_stock")&&<Btn onClick={addItem} color={C.gold} style={{fontSize:12,padding:"8px 20px"}}>✓ Add to Inventory</Btn>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:16,paddingBottom:10,borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
        {[{v:"inventory",l:T2("📦 Inventory")},{v:"requirements",l:T2("🧮 Requirements")},{v:"requisitions",l:T2("📋 Requisitions")},hasPerm(currentUser,"store.edit_stock")&&{v:"ingmap",l:T2("🔗 Ingredient Map")}].filter(Boolean).map(t=>(
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
      {false&&(
        <div style={{display:"none"}}>{/* scan tab content stripped from render — safe to fully delete in Batch 3 */}
          {/* Mode toggle */}
          <div style={{display:"flex",gap:0,marginBottom:14,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
            {hasPerm(currentUser,"store.receive")&&<button onClick={()=>setScanMode("in")} style={{flex:1,padding:"12px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",
              background:scanMode==="in"?"#1A3A1A":"transparent",color:scanMode==="in"?C.green:C.muted}}>📥 {T2("Stock In")}</button>}
            {hasPerm(currentUser,"store.issue")&&<button onClick={()=>setScanMode("out")} style={{flex:1,padding:"12px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",
              background:scanMode==="out"?"#3A1A1A":"transparent",color:scanMode==="out"?C.red:C.muted}}>📤 {T2("Stock Out")}</button>}
          </div>

          {/* Scanner */}
          <Card style={{marginBottom:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:scanning?10:0}}>
              <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>📷 {T2("Scan Barcode")}</div><div style={{fontSize:12,color:C.muted}}>{T2("Point camera at barcode")}</div></div>
              {!scanning?<button onClick={()=>{setScanItem(null);setScanResult("");setScanError("");startScan();}} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>📷 {T2("Scan")}</button>
                        :<button onClick={stopScan} style={{padding:"8px 14px",borderRadius:10,background:C.red,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>✕ {T2("Stop")}</button>}
            </div>
            {scanning&&<video ref={scanVideoRef} autoPlay playsInline muted style={{width:"100%",maxHeight:200,borderRadius:10,objectFit:"cover",background:"#000",display:"block",marginBottom:8}}/>}
            {scanning&&<div style={{fontSize:12,color:C.amber,textAlign:"center"}}>📡 {T2("Scanning…")}</div>}
          </Card>

          {/* Manual search fallback */}
          <div style={{marginBottom:12}}>
            <input value={search} onChange={e=>{setSearch(e.target.value);setScanItem(null);}} placeholder={T2("Search items…")+" / "+T2("Barcode")}
              style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:44}}/>
            {search.trim()&&!scanItem&&(
              <div style={{maxHeight:200,overflowY:"auto",background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,marginTop:6}}>
                {items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase())||(i.h||"").includes(search)||(i.barcode||"").includes(search)).slice(0,10).map(i=>(
                  <div key={i.id} onClick={()=>{setScanItem(i);setSearch("");}} style={{padding:"10px 14px",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer",display:"flex",justifyContent:"space-between"}}>
                    <div><div style={{fontSize:12,fontWeight:600,color:C.text}}>{i.name}{i.h?<span style={{fontSize:10,color:C.muted,marginLeft:4}}>({i.h})</span>:""}</div>
                    <div style={{fontSize:11,color:C.muted}}>{i.cat} · {i.barcode||"No barcode"}</div></div>
                    <div style={{fontSize:12,fontWeight:700,color:i.inStock>0?C.green:C.red}}>{i.inStock} {i.unit}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scanned / Selected item */}
          {scanItem&&(
            <Card style={{marginBottom:12,padding:"16px",border:`2px solid ${scanMode==="in"?C.green:C.red}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.text}}>{scanItem.name}</div>
                  <div style={{fontSize:12,color:C.muted}}>{scanItem.h||""} · {scanItem.cat} · {scanItem.barcode||"No barcode"}</div>
                </div>
                <div style={{textAlign:"center",padding:"8px 14px",borderRadius:10,background:scanItem.inStock>0?C.greenBg:C.redBg}}>
                  <div style={{fontSize:20,fontWeight:700,color:scanItem.inStock>0?C.green:C.red}}>{scanItem.inStock}</div>
                  <div style={{fontSize:10,color:C.muted}}>{scanItem.unit} {T2("Current Stock")}</div>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{T2("Qty")} *</div>
                  <input type="number" value={scanQty} onChange={e=>setScanQty(e.target.value)} placeholder="0"
                    style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:16,fontWeight:700,color:C.text,background:C.surface,boxSizing:"border-box",textAlign:"center",minHeight:44}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{T2("Reason")}</div>
                  <select value={scanReason} onChange={e=>setScanReason(e.target.value)}
                    style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,appearance:"auto",minHeight:44}}>
                    {scanMode==="in"
                      ?["Purchase","Return","Transfer In","Opening Stock","Correction"].map(r=><option key={r} value={r}>{T2(r)}</option>)
                      :["Event Use","Damage","Expired","Transfer Out","Correction"].map(r=><option key={r} value={r}>{T2(r)}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={()=>{
                const qty=+scanQty;if(!qty||qty<=0) return;
                const newStock=scanMode==="in"?scanItem.inStock+qty:Math.max(0,scanItem.inStock-qty);
                setItems(p=>p.map(i=>i.id!==scanItem.id?i:{...i,inStock:newStock}));
                setTransactions(p=>[{id:"tx-"+Date.now(),itemId:scanItem.id,itemName:scanItem.name,type:scanMode,qty,reason:scanReason,time:new Date().toLocaleString("en-IN"),newStock},...p]);
                setScanItem({...scanItem,inStock:newStock});setScanQty("");
              }} disabled={!scanQty||+scanQty<=0}
                style={{width:"100%",padding:"14px",borderRadius:12,border:"none",fontSize:14,fontWeight:700,cursor:scanQty&&+scanQty>0?"pointer":"not-allowed",minHeight:48,
                  background:scanMode==="in"?`linear-gradient(135deg,${C.green},#1A5A30)`:`linear-gradient(135deg,${C.red},#5A1A1A)`,
                  color:"#fff",opacity:scanQty&&+scanQty>0?1:.4}}>
                {scanMode==="in"?`📥 ${T2("Stock In")} +${scanQty||0} ${scanItem.unit}`:`📤 ${T2("Stock Out")} −${scanQty||0} ${scanItem.unit}`}
              </button>
            </Card>
          )}

          {/* Scan result for new items */}
          {scanResult&&!scanItem&&(
            <Card style={{marginBottom:12,padding:0,overflow:"hidden",border:`1px solid ${scanLookup?C.greenBorder:C.amberBorder}`}}>
              {/* Product image + details from API */}
              {scanLookup&&(
                <div style={{display:"flex",gap:0}}>
                  {scanLookup.image&&<img src={scanLookup.image} alt={scanLookup.name} style={{width:90,height:90,objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
                  <div style={{flex:1,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.text}}>{scanLookup.name}</div>
                        {scanLookup.brand&&<div style={{fontSize:12,color:C.gold,marginTop:2}}>{scanLookup.brand}</div>}
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                          {scanLookup.weight&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.muted}}>📦 {scanLookup.weight}</span>}
                          {scanLookup.energy&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.muted}}>🔥 {scanLookup.energy}</span>}
                          <span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green}}>✅ {scanLookup.source}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!scanLookup&&<div style={{padding:"12px 14px",background:C.amberBg}}>
                <div style={{fontSize:12,fontWeight:700,color:C.amber}}>🔍 {T2("Barcode")}: {scanResult}</div>
                <div style={{fontSize:11,color:C.amber,marginTop:3}}>{scanError}</div>
              </div>}
              {scanLookup&&<div style={{fontSize:11,color:C.green,padding:"0 14px 6px",fontStyle:"italic"}}>{scanError}</div>}
              <div style={{padding:"10px 14px",borderTop:scanLookup?`1px solid ${C.border}`:"none",display:"flex",gap:8}}>
                <button onClick={()=>{setShowAdd(true);}} style={{flex:1,padding:"10px 14px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>+ {T2("Save to Inventory")}</button>
                <button onClick={()=>{setScanResult("");setScanLookup(null);setScanItem(null);setScanError("");}} style={{padding:"10px 14px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:40}}>✕</button>
              </div>
            </Card>
          )}

          {/* Recent transactions */}
          <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase"}}>{T2("Transaction History")} ({transactions.length})</div>
          {transactions.length===0&&<div style={{textAlign:"center",padding:20,background:C.bg,borderRadius:12,color:C.muted,fontSize:12}}>{T2("No transactions yet. Scan an item to begin.")}</div>}
          {transactions.slice(0,20).map(tx=>(
            <div key={tx.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 14px",background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,marginBottom:4}}>
              <div style={{width:32,height:32,borderRadius:8,background:tx.type==="in"?C.greenBg:C.redBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                {tx.type==="in"?"📥":"📤"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:C.text}}>{tx.itemName}</div>
                <div style={{fontSize:11,color:C.muted}}>{tx.reason} · {tx.time}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:700,color:tx.type==="in"?C.green:C.red}}>{tx.type==="in"?"+":"-"}{tx.qty}</div>
                <div style={{fontSize:10,color:C.muted}}>→ {tx.newStock}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── REQUIREMENTS — event-first with collective toggle ── */}
      {tab==="requirements"&&(()=>{
        const issueEvs = safeEvs.filter(e=>e.date===TODAY||e.date===TOMORROW).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
        const filtEvs = issueDate==="all"?issueEvs:issueEvs.filter(e=>e.date===issueDate);
        const evBags = buildEventBags(filtEvs);

        /* helpers for counting */
        function secIngList(secObj) { return Object.values(secObj.items).sort((a,b)=>b.totalQty-a.totalQty); }
        function isIssued(evId, sec, ingName) { const r=issueRecords[evId+"::"+sec+"::"+ingName]; return r&&r.issued; }
        function secIssuedCount(evId, sec, list) { return list.filter(ing=>isIssued(evId,sec,ing.name)).length; }

        /* collective bags — merge across events */
        const collBags = {};
        Object.values(evBags).forEach(({ev, sections})=>{
          Object.entries(sections).forEach(([sec, secObj])=>{
            if(!collBags[sec]) collBags[sec]={items:{},events:[],meta:secObj.meta};
            if(!collBags[sec].events.find(e=>e.id===ev.id)) collBags[sec].events.push(ev);
            Object.values(secObj.items).forEach(ing=>{
              if(!collBags[sec].items[ing.name]) collBags[sec].items[ing.name]={name:ing.name,hindi:ing.hindi,unit:ing.unit,totalQty:0,evBreak:[]};
              var collMerged=addQtyWithUnitNorm(collBags[sec].items[ing.name],ing.totalQty,ing.unit);
              collBags[sec].items[ing.name].totalQty=collMerged.totalQty;
              collBags[sec].items[ing.name].unit=collMerged.unit;
              collBags[sec].items[ing.name].evBreak.push({evId:ev.id,evName:ev.guest,qty:ing.totalQty});
            });
          });
        });
        function collIssuedCount(sec, list) {
          return list.filter(ing=>{
            const bag=collBags[sec];
            return bag.events.every(ev=>isIssued(ev.id,sec,ing.name));
          }).length;
        }

        /* venue color helper */
        const vcMap={"AP":{bg:C.goldBg,color:C.gold},"AE":{bg:C.amberBg,color:"#854F0B"},"AM":{bg:"#EEF4FD",color:"#185FA5"},"AR":{bg:C.greenBg,color:"#0F6E56"}};
        function venueStyle(code){return vcMap[code]||{bg:C.bg,color:C.muted};}

        /* shared ingredient row renderer */
        function IngRow({ing, evId, sec, idx, total}){
          const done = isIssued(evId,sec,ing.name);
          const stock = getStockForIngredient(ing.name);
          const isMapped = !!ingredientMap[ing.name];
          var reqSU = stock ? ing.totalQty * (stock.conversion || 1) : 0;
          return(
            <div style={{display:"grid",gridTemplateColumns:"1fr 72px 32px",gap:4,padding:"10px 0",borderBottom:idx<total-1?`1px solid ${C.borderLight}`:"none",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,fontWeight:done?400:600,color:done?C.green:C.text,textDecoration:done?"line-through":"none"}}>{ing.name}{ing.hindi?<span style={{fontSize:10,color:C.muted,marginLeft:4}}>({ing.hindi})</span>:""}</div>
                {isMapped&&stock&&<div style={{fontSize:10,color:stock.available>=reqSU?C.green:stock.available>0?C.amber:C.red,marginTop:1}}>
                  {T2("Stock")}: {stock.available} {stock.unit}{reqSU>stock.available?" — "+T2("short")+" "+fmtIssueQty(reqSU-stock.available,stock.unit):""}
                  {stock.conversion!==1&&<span style={{fontSize:9,color:C.faint,marginLeft:4}}>(×{stock.conversion})</span>}
                </div>}
                {!isMapped&&<div onClick={(e)=>{e.stopPropagation();setMapModalIng({name:ing.name,hindi:ing.hindi||"",unit:ing.unit});}} style={{fontSize:10,color:C.amber,cursor:"pointer",marginTop:1}}>⚠ {T2("Unlinked")} — <span style={{textDecoration:"underline"}}>{T2("link to store")}</span></div>}
              </div>
              <div style={{textAlign:"right",fontSize:12,fontWeight:600,color:done?C.green:C.text}}>{fmtIssueQty(ing.totalQty,ing.unit)}</div>
              <div onClick={()=>toggleIssueItem(evId,sec,ing,done)}
                style={{width:26,height:26,borderRadius:8,border:`1.5px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",margin:"0 auto"}}>
                {done&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}
              </div>
            </div>
          );
        }

        /* venue assignment dropdown */
        function VenueTag({evId, sec}){
          const code=issueAssignments[evId+"::"+sec];
          if(!code) return(
            <select value="" onClick={e=>e.stopPropagation()} onChange={e=>{if(e.target.value)setVenueAssignment(evId,sec,e.target.value);}}
              style={{fontSize:10,padding:"2px 6px",borderRadius:10,background:C.amberBg,color:"#854F0B",border:`1px solid ${C.amberBorder}`,cursor:"pointer",fontWeight:600}}>
              <option value="" disabled>⚠ assign</option>
              {VENUE_CODES.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          );
          const vs=venueStyle(code);
          return(
            <select value={code} onClick={e=>e.stopPropagation()} onChange={e=>setVenueAssignment(evId,sec,e.target.value)}
              style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:vs.bg,color:vs.color,border:"1px solid transparent",cursor:"pointer",fontWeight:600}}>
              {VENUE_CODES.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          );
        }

        const todayCount = issueEvs.filter(e=>e.date===TODAY).length;
        const tmrwCount = issueEvs.filter(e=>e.date===TOMORROW).length;

        return(
          <div>
            {/* Header + mode toggle */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🧮 {T2("Smart Issue")}</div>
              <div style={{display:"flex",borderRadius:20,overflow:"hidden",border:`1px solid ${C.border}`,background:C.bg}}>
                <button onClick={()=>setIssueMode("event")} style={{padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:issueMode==="event"?C.gold:"transparent",color:issueMode==="event"?C.goldBg:C.muted}}>📅 {T2("By Event")}</button>
                <button onClick={()=>setIssueMode("collective")} style={{padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:issueMode==="collective"?C.gold:"transparent",color:issueMode==="collective"?C.goldBg:C.muted}}>📦 {T2("Collective")}</button>
              </div>
            </div>
            <div style={{fontSize:12,color:C.muted,marginBottom:14}}>{issueMode==="event"?T2("Issue ingredients per event"):T2("Merged quantities across events")}</div>

            {/* Date filter */}
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              {[{v:"all",l:T2("All")},{v:TODAY,l:T2("Today")+" ("+todayCount+")"},{v:TOMORROW,l:T2("Tomorrow")+" ("+tmrwCount+")"}].map(d=>(
                <button key={d.v} onClick={()=>setIssueDate(d.v)} style={{padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:36,
                  background:issueDate===d.v?C.gold:C.bg,color:issueDate===d.v?C.goldBg:C.muted,border:`1px solid ${issueDate===d.v?C.gold:C.border}`}}>{d.l}</button>
              ))}
            </div>

            {issueLoading&&<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>{T2("Loading issue state…")}</div>}

            {filtEvs.length===0&&!issueLoading&&<div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,color:C.muted,fontSize:13}}>{T2("No events with recipe data for this period.")}</div>}

            {/* ── EVENT VIEW ── */}
            {issueMode==="event"&&Object.entries(evBags).map(([evId,{ev,sections}])=>{
              const secEntries=Object.entries(sections).sort((a,b)=>a[0].localeCompare(b[0]));
              const totalSec=secEntries.length;
              const doneSec=secEntries.filter(([sec,sObj])=>{const l=secIngList(sObj);return l.length>0&&secIssuedCount(evId,sec,l)===l.length;}).length;
              const isExpanded=issueExpEv===evId;
              const evVs=venueStyle((ev.venue||"").replace(/ambria\s*/i,"").replace(/pushpanjali/i,"AP").replace(/exotica/i,"AE").replace(/manaktala|farm/i,"AM").replace(/restro/i,"AR").trim().split(" ")[0]||"");
              const evCode=(ev.venue||"").replace(/ambria\s*/i,"").replace(/pushpanjali/i,"AP").replace(/exotica/i,"AE").replace(/manaktala|farm/i,"AM").replace(/restro/i,"AR").trim().split(" ")[0]||ev.venue||"";
              const pct=totalSec>0?Math.round(doneSec/totalSec*100):0;

              return(
                <Card key={evId} style={{marginBottom:10,padding:0,overflow:"hidden",border:doneSec===totalSec&&totalSec>0?`2px solid ${C.green}`:`1px solid ${C.border}`}}>
                  {/* Event header */}
                  <div onClick={()=>setIssueExpEv(isExpanded?null:evId)} style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:3,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span>{ev.pax} pax</span>
                        <span style={{color:C.borderLight}}>|</span>
                        <span>{ev.time||"TBD"}</span>
                        {evCode&&<span style={{fontSize:10,padding:"1px 8px",borderRadius:10,background:evVs.bg,color:evVs.color,fontWeight:600}}>{evCode}</span>}
                      </div>
                    </div>
                    <div style={{textAlign:"center",flexShrink:0,marginLeft:12}}>
                      <div style={{fontSize:15,fontWeight:700,color:doneSec===totalSec&&totalSec>0?C.green:C.amber}}>{doneSec}<span style={{fontSize:11,color:C.muted,fontWeight:400}}> / {totalSec}</span></div>
                      <div style={{fontSize:10,color:C.muted}}>{T2("sections")}</div>
                      <div style={{height:3,borderRadius:2,background:C.borderLight,marginTop:4,width:48}}>
                        <div style={{height:3,borderRadius:2,background:doneSec===totalSec&&totalSec>0?C.green:C.amber,width:pct+"%",transition:"width .3s"}}/>
                      </div>
                    </div>
                  </div>

                  {/* Sections inside event */}
                  {isExpanded&&secEntries.map(([sec,secObj])=>{
                    const m=secObj.meta;
                    const list=secIngList(secObj);
                    const cnt=secIssuedCount(evId,sec,list);
                    const allDone=cnt===list.length&&list.length>0;
                    const secKey=evId+"::"+sec;
                    const secExpanded=issueExpSec===secKey;

                    return(
                      <div key={sec} style={{borderTop:`1px solid ${C.borderLight}`}}>
                        {/* Section header */}
                        <div onClick={()=>setIssueExpSec(secExpanded?null:secKey)} style={{padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",background:allDone?C.greenBg+"40":"transparent"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                            <div style={{width:8,height:8,borderRadius:4,background:m.color,flexShrink:0}}/>
                            <span style={{fontSize:13,fontWeight:600,color:m.color}}>{T2(sec)}</span>
                            <VenueTag evId={evId} sec={sec}/>
                            {allDone&&<span style={{fontSize:10,padding:"1px 8px",borderRadius:10,background:C.greenBg,color:C.green,fontWeight:600}}>✓ {T2("done")}</span>}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                            <span style={{fontSize:12,fontWeight:600,color:allDone?C.green:C.muted}}>{cnt}/{list.length}</span>
                            <span style={{fontSize:12,color:C.faint,transition:"transform .2s",transform:secExpanded?"rotate(90deg)":"rotate(0)"}}>▸</span>
                          </div>
                        </div>

                        {/* Ingredient rows */}
                        {secExpanded&&<div style={{padding:"0 16px"}}>
                          {list.map((ing,ii)=><IngRow key={ing.name} ing={ing} evId={evId} sec={sec} idx={ii} total={list.length}/>)}
                          {!allDone&&hasPerm(currentUser,"store.smart_issue")&&(
                            <div style={{padding:"6px 0 10px"}}>
                              <button onClick={()=>issueAllForSection(evId,sec,list)}
                                style={{width:"100%",padding:"10px",borderRadius:10,background:m.color,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>
                                ✓ {T2("Issue All")} — {T2(sec)} ({list.length-cnt} {T2("remaining")})
                              </button>
                            </div>
                          )}
                        </div>}
                      </div>
                    );
                  })}
                </Card>
              );
            })}

            {/* ── COLLECTIVE VIEW ── */}
            {issueMode==="collective"&&(()=>{
              const collKeys=Object.keys(collBags).sort();
              if(collKeys.length===0) return null;
              return(
                <div>
                  <div style={{padding:"10px 14px",background:C.goldBg,borderRadius:10,border:`1px solid ${C.goldBorder}`,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,color:C.gold}}>ℹ {T2("Quantities merged across events. Issue marks apply to all contributing events.")}</span>
                  </div>
                  {collKeys.map(sec=>{
                    const bag=collBags[sec];
                    const m=bag.meta;
                    const list=Object.values(bag.items).sort((a,b)=>b.totalQty-a.totalQty);
                    const cnt=collIssuedCount(sec,list);
                    const allDone=cnt===list.length&&list.length>0;
                    const secKey="coll::"+sec;
                    const secExpanded=issueExpSec===secKey;

                    return(
                      <Card key={sec} style={{marginBottom:10,padding:0,overflow:"hidden",border:allDone?`2px solid ${C.green}`:`1px solid ${C.border}`}}>
                        <div onClick={()=>setIssueExpSec(secExpanded?null:secKey)} style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",background:allDone?C.greenBg+"40":"transparent"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <div style={{width:8,height:8,borderRadius:4,background:m.color,flexShrink:0}}/>
                              <span style={{fontSize:13,fontWeight:700,color:m.color}}>{T2(sec)}</span>
                              <span style={{fontSize:11,color:C.muted}}>{list.length} {T2("items")}</span>
                              {(()=>{
                                const codes=[...new Set(bag.events.map(ev=>issueAssignments[ev.id+"::"+sec]).filter(Boolean))];
                                if(codes.length>0) return codes.map(c=>{const vs=venueStyle(c);return <span key={c} style={{fontSize:10,padding:"1px 8px",borderRadius:10,background:vs.bg,color:vs.color,fontWeight:600}}>{c}</span>;});
                                return <span style={{fontSize:10,padding:"1px 8px",borderRadius:10,background:C.amberBg,color:"#854F0B",fontWeight:600}}>⚠ {T2("assign")}</span>;
                              })()}
                              {allDone&&<span style={{fontSize:10,padding:"1px 8px",borderRadius:10,background:C.greenBg,color:C.green,fontWeight:600}}>✓ {T2("done")}</span>}
                            </div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
                              {bag.events.map(e=><span key={e.id} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:C.bg,color:C.muted,border:`1px solid ${C.borderLight}`}}>{e.guest} ({e.pax}p)</span>)}
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
                            <span style={{fontSize:12,fontWeight:600,color:allDone?C.green:C.muted}}>{cnt}/{list.length}</span>
                            <span style={{fontSize:12,color:C.faint,transition:"transform .2s",transform:secExpanded?"rotate(90deg)":"rotate(0)"}}>▸</span>
                          </div>
                        </div>

                        {secExpanded&&<div style={{padding:"0 16px",borderTop:`1px solid ${C.borderLight}`}}>
                          {list.map((ing,ii)=>{
                            /* In collective, issue across all events at once */
                            const allEvIssued=bag.events.every(ev=>isIssued(ev.id,sec,ing.name));
                            return(
                              <div key={ing.name} style={{display:"grid",gridTemplateColumns:"1fr 72px 32px",gap:4,padding:"10px 0",borderBottom:ii<list.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"center"}}>
                                <div>
                                  <div style={{fontSize:12,fontWeight:allEvIssued?400:600,color:allEvIssued?C.green:C.text,textDecoration:allEvIssued?"line-through":"none"}}>{ing.name}{ing.hindi?<span style={{fontSize:10,color:C.muted,marginLeft:4}}>({ing.hindi})</span>:""}</div>
                                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{ing.evBreak.map(b=>b.evName+"("+fmtIssueQty(b.qty,ing.unit)+")").join(" + ")}</div>
                                  {(()=>{
                                    const stock=getStockForIngredient(ing.name);
                                    const isMapped=!!ingredientMap[ing.name];
                                    if(isMapped&&stock){var rSU=ing.totalQty*(stock.conversion||1);return <div style={{fontSize:10,color:stock.available>=rSU?C.green:stock.available>0?C.amber:C.red,marginTop:1}}>{T2("Stock")}: {stock.available} {stock.unit}{rSU>stock.available?" — "+T2("short")+" "+fmtIssueQty(rSU-stock.available,stock.unit):""}{stock.conversion!==1&&<span style={{fontSize:9,color:C.faint,marginLeft:4}}>(×{stock.conversion})</span>}</div>;}
                                    if(!isMapped) return <div onClick={(e)=>{e.stopPropagation();setMapModalIng({name:ing.name,hindi:ing.hindi||"",unit:ing.unit});}} style={{fontSize:10,color:C.amber,cursor:"pointer",marginTop:1}}>⚠ {T2("Unlinked")} — <span style={{textDecoration:"underline"}}>{T2("link to store")}</span></div>;
                                    return null;
                                  })()}
                                </div>
                                <div style={{textAlign:"right",fontSize:12,fontWeight:600,color:allEvIssued?C.green:C.text}}>{fmtIssueQty(ing.totalQty,ing.unit)}</div>
                                <div onClick={async()=>{
                                  for(const ev of bag.events){
                                    await toggleIssueItem(ev.id,sec,{name:ing.name,hindi:ing.hindi,unit:ing.unit,totalQty:ing.evBreak.find(b=>b.evId===ev.id)?.qty||ing.totalQty},allEvIssued);
                                  }
                                }}
                                  style={{width:26,height:26,borderRadius:8,border:`1.5px solid ${allEvIssued?C.green:C.border}`,background:allEvIssued?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",margin:"0 auto"}}>
                                  {allEvIssued&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}
                                </div>
                              </div>
                            );
                          })}
                          {!allDone&&hasPerm(currentUser,"store.smart_issue")&&(
                            <div style={{padding:"6px 0 10px"}}>
                              <button onClick={async()=>{for(const ev of bag.events){await issueAllForSection(ev.id,sec,Object.values(bag.items).map(i=>({...i,totalQty:i.evBreak.find(b=>b.evId===ev.id)?.qty||i.totalQty})));}}}
                                style={{width:"100%",padding:"10px",borderRadius:10,background:m.color,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>
                                ✓ {T2("Issue All")} — {T2(sec)} ({list.length-cnt} {T2("remaining")})
                              </button>
                            </div>
                          )}
                        </div>}
                      </Card>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── SHORTAGE SUMMARY ── */}
            {(()=>{
              const shortages = [];
              const seenIng = {};
              Object.values(evBags).forEach(({ev, sections})=>{
                Object.entries(sections).forEach(([sec, secObj])=>{
                  Object.values(secObj.items).forEach(ing=>{
                    const mapping = ingredientMap[ing.name];
                    if(!mapping) return;
                    const stock = getStockForIngredient(ing.name);
                    if(!stock) return;
                    if(!seenIng[ing.name]){var _oi=allRecipeIngredients.find(function(a){return a.name===ing.name;});seenIng[ing.name]={name:ing.name,unit:ing.unit,origUnit:_oi?_oi.unit:ing.unit,storeUnit:stock.unit,opsItemId:mapping.ops_item_id,opsItemName:mapping.ops_item_name,required:0,available:stock.available,conversion:stock.conversion||1,eventIds:[],eventNames:[]};}
                    var sMerged=addQtyWithUnitNorm({totalQty:seenIng[ing.name].required,unit:seenIng[ing.name].unit},ing.totalQty,ing.unit);
                    seenIng[ing.name].required=sMerged.totalQty;
                    seenIng[ing.name].unit=sMerged.unit;
                    if(!seenIng[ing.name].eventIds.includes(ev.id)){seenIng[ing.name].eventIds.push(ev.id);seenIng[ing.name].eventNames.push(ev.guest);}
                  });
                });
              });
              Object.values(seenIng).forEach(s=>{
                var recG=toGrams(s.required,s.unit);var stoG=toGrams(1,s.storeUnit);
                if(recG!==null&&stoG!==null){s.required=recG/stoG;s.unit=s.storeUnit;}
                else{var recM=toMl(s.required,s.unit);var stoM=toMl(1,s.storeUnit);
                if(recM!==null&&stoM!==null){s.required=recM/stoM;s.unit=s.storeUnit;}
                else{var oF=getUnitFamily(s.origUnit),aF=getUnitFamily(s.unit),adj=(oF&&aF&&oF.family===aF.family)?(aF.toBase/oF.toBase):1;s.required=s.required*adj*(s.conversion||1);s.unit=s.storeUnit;}}
                s.shortfall=Math.ceil(Math.max(0,s.required-s.available));
                if(s.shortfall > 0) shortages.push(s);
              });
              shortages.sort((a,b)=>b.shortfall-a.shortfall);
              if(!shortages.length) return null;
              return(
                <Card style={{padding:"14px 16px",marginTop:16,border:`1.5px solid ${C.redBorder}`,background:C.redBg}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.red}}>⚠ {T2("Shortages")} — {shortages.length} {T2("items")}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>{T2("Stock below required for")} {filtEvs.length} {T2("events")}</div>
                    </div>
                    {hasPerm(currentUser,"store.edit_stock")&&<button disabled={poLoading} onClick={()=>generatePO(shortages,filtEvs)}
                      style={{padding:"8px 16px",borderRadius:10,background:poLoading?C.muted:C.red,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:poLoading?"default":"pointer",minHeight:36,opacity:poLoading?.6:1}}>
                      {poLoading?"⏳ ...":"📋 "+T2("Generate PO")}
                    </button>}
                  </div>
                  <div style={{border:`1px solid ${C.redBorder}`,borderRadius:10,overflow:"hidden"}}>
                    <div style={{display:"grid",gridTemplateColumns:"2fr 70px 70px 70px",padding:"6px 12px",background:C.red+"15",borderBottom:`1px solid ${C.redBorder}`}}>
                      {[T2("Ingredient"),T2("Required"),T2("Stock"),T2("Short")].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:C.red,textTransform:"uppercase"}}>{h}</div>)}
                    </div>
                    {shortages.slice(0,20).map((s,idx)=>{
                      const isExp=expandedShortage===s.name;
                      const sopMatch=allRecipeIngredients.find(i=>i.name===s.name);
                      const recipes=sopMatch?sopMatch.dishes:[];
                      return(
                      <div key={s.name}>
                      <div onClick={()=>setExpandedShortage(isExp?null:s.name)} style={{display:"grid",gridTemplateColumns:"2fr 70px 70px 70px",padding:"6px 12px",borderBottom:(!isExp&&idx<Math.min(shortages.length,20)-1)?`1px solid ${C.redBorder}22`:"none",alignItems:"center",cursor:"pointer",background:isExp?C.red+"08":"transparent"}}>
                        <div><div style={{fontSize:12,fontWeight:500,color:C.text}}>{isExp?"▾":"▸"} {s.name}</div><div style={{fontSize:10,color:C.muted}}>{s.eventNames.join(", ")}</div></div>
                        <div style={{fontSize:12,fontWeight:600,color:C.text}}>{fmtIssueQty(s.required,s.unit)}</div>
                        <div style={{fontSize:12,fontWeight:600,color:C.amber}}>{fmtIssueQty(s.available,s.unit)}</div>
                        <div style={{fontSize:12,fontWeight:700,color:C.red}}>−{fmtIssueQty(s.shortfall,s.unit)}</div>
                      </div>
                      {isExp&&<div style={{padding:"6px 12px 10px",background:C.red+"06",borderBottom:`1px solid ${C.redBorder}22`}}>
                        <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>Used in {recipes.length} SOP recipe{recipes.length!==1?"s":""}</div>
                        {recipes.length?<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{recipes.map(r=><span key={r} style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.text}}>{r}</span>)}</div>
                        :<div style={{fontSize:11,color:C.muted}}>No SOP recipe match found</div>}
                      </div>}
                      </div>);
                    })}
                    {shortages.length>20&&<div style={{padding:"6px 12px",fontSize:11,color:C.muted,textAlign:"center"}}>+{shortages.length-20} {T2("more")}</div>}
                  </div>
                </Card>
              );
            })()}

            </div>
        );
      })()}

      {/* ── REQUISITIONS (V65 — live from Ops catering_requisitions) ── */}
      {tab==="requisitions"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:11,color:C.muted}}>{opsReqLoading?"Loading requisitions…":`${opsReqs.length} ${T2("requisitions")}`}</div>
          </div>
          {!opsReqLoading&&opsReqs.length===0&&<div style={{textAlign:"center",padding:36,background:C.bg,borderRadius:12,fontSize:12,color:C.muted}}>{T2("No requisitions raised yet.")}</div>}
          {opsReqs.map(req=>{
            const stColors={pending:{c:C.muted,bg:C.bg},approved:{c:"#378ADD",bg:"#E6F1FB"},purchasing:{c:C.amber,bg:C.amberBg},partially_received:{c:C.amber,bg:C.amberBg},received:{c:C.green,bg:C.greenBg},cancelled:{c:C.red,bg:C.redBg}};
            const sc=stColors[req.status]||stColors.pending;
            const venueCode=VENUE_ID_TO_CODE[req.venue_id]||"?";
            const venueName=VENUE_ID_TO_NAME[req.venue_id]||`Venue ${req.venue_id}`;
            const vc=venueColor(venueCode);
            const canCancel=(req.status==='pending'||req.status==='approved')&&hasPerm(currentUser,"store.edit_stock");
            return (
              <Card key={req.id} style={{padding:"14px 16px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,background:vc.bg,color:vc.text}}>{venueName}</span>
                      <div style={{fontSize:11,fontWeight:600,color:C.muted,fontFamily:"monospace"}}>{req.id.slice(0,8)}</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,marginTop:2}}>{req.event_summary||"—"}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                      {req.items.length} {T2("items")} · {T2("by")} {req.requested_by_name||req.requested_by} · {new Date(req.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
                      {req.needed_by&&<span> · {T2("needed by")} {new Date(req.needed_by).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</span>}
                    </div>
                    {req.notes&&<div style={{fontSize:10,color:C.muted,marginTop:2,fontStyle:"italic"}}>{req.notes}</div>}
                  </div>
                  <span style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:20,background:sc.bg,color:sc.c,textTransform:"capitalize",whiteSpace:"nowrap"}}>{req.status.replace(/_/g," ")}</span>
                </div>
                {req.items.length>0&&(
                  <div style={{border:`1px solid ${C.borderLight}`,borderRadius:8,overflow:"hidden",marginBottom:canCancel?8:0}}>
                    <div style={{display:"grid",gridTemplateColumns:"2fr 60px 60px 60px",padding:"5px 10px",background:C.bg,borderBottom:`1px solid ${C.borderLight}`}}>
                      {[T2("Item"),T2("Reqd"),T2("Recv"),T2("Unit")].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{h}</div>)}
                    </div>
                    {req.items.map(li=>(
                      <div key={li.id} style={{display:"grid",gridTemplateColumns:"2fr 60px 60px 60px",padding:"5px 10px",borderBottom:`1px solid ${C.borderLight}22`,alignItems:"center"}}>
                        <div style={{fontSize:12,fontWeight:500,color:C.text}}>
                          {li.item_name}
                          {li.item_name_hindi&&<span style={{fontSize:10,color:C.muted,marginLeft:4}}>({li.item_name_hindi})</span>}
                          {!li.ops_inventory_id&&<span style={{fontSize:9,color:C.amber,marginLeft:6,padding:"1px 6px",borderRadius:5,background:C.amberBg}}>ad-hoc</span>}
                        </div>
                        <div style={{fontSize:12,fontWeight:600,color:C.text}}>{li.qty_requested}</div>
                        <div style={{fontSize:12,fontWeight:600,color:(+li.qty_received)>=(+li.qty_requested)?C.green:C.amber}}>{li.qty_received||0}</div>
                        <div style={{fontSize:11,color:C.muted}}>{li.unit||"-"}</div>
                      </div>
                    ))}
                  </div>
                )}
                {canCancel&&(
                  <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                    <Btn onClick={async()=>{
                      const reason=prompt("Reason for cancellation:","");
                      if(reason===null) return;
                      await cancelOpsReq(req.id,reason);
                    }} color={C.red} style={{fontSize:11,padding:"6px 14px"}} disabled={opsReqCancelId===req.id}>
                      {opsReqCancelId===req.id?"Cancelling…":`✕ ${T2("Cancel")}`}
                    </Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── LEGACY PO VIEW (deprecated in V65 — kept for audit, not reachable from tabs) ── */}
      {false&&(
        <div>
          {purchaseOrders.length===0&&<div style={{textAlign:"center",padding:36,background:C.bg,borderRadius:12,fontSize:12,color:C.muted}}>{T2("No purchase orders yet. Generate from Requirements shortages.")}</div>}
          {purchaseOrders.map(po=>{
            const stColors={draft:{c:C.muted,bg:C.bg},ordered:{c:C.amber,bg:C.amberBg},partial:{c:C.amber,bg:C.amberBg},received:{c:C.green,bg:C.greenBg},cancelled:{c:C.red,bg:C.redBg}};
            const sc=stColors[po.status]||stColors.draft;
            const lineItems=po.items||[];
            const totalOrdered=lineItems.reduce((s,i)=>s+(+i.qty_ordered||0),0);
            const totalReceived=lineItems.reduce((s,i)=>s+(+i.qty_received||0),0);
            return (
              <Card key={po.id} style={{padding:"14px 16px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{po.po_number}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{lineItems.length} items · {new Date(po.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>
                    {po.notes&&<div style={{fontSize:10,color:C.muted,marginTop:2,maxWidth:300,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{po.notes}</div>}
                  </div>
                  <span style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:20,background:sc.bg,color:sc.c,textTransform:"capitalize"}}>{po.status}</span>
                </div>
                {lineItems.length>0&&(
                  <div style={{border:`1px solid ${C.borderLight}`,borderRadius:8,overflow:"hidden",marginBottom:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"2fr 60px 60px 60px",padding:"5px 10px",background:C.bg,borderBottom:`1px solid ${C.borderLight}`}}>
                      {[T2("Item"),T2("Ordered"),T2("Recv"),T2("Unit")].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{h}</div>)}
                    </div>
                    {lineItems.map(li=>(
                      <div key={li.id} style={{display:"grid",gridTemplateColumns:"2fr 60px 60px 60px",padding:"5px 10px",borderBottom:`1px solid ${C.borderLight}22`,alignItems:"center"}}>
                        <div style={{fontSize:12,fontWeight:500,color:C.text}}>{li.ops_item_name||li.ingredient_name}</div>
                        <div style={{fontSize:12,fontWeight:600,color:C.text}}>{li.qty_ordered}</div>
                        <div style={{fontSize:12,fontWeight:600,color:(+li.qty_received)>=(+li.qty_ordered)?C.green:C.amber}}>{li.qty_received}</div>
                        <div style={{fontSize:11,color:C.muted}}>{li.unit||"-"}</div>
                      </div>
                    ))}
                  </div>
                )}
                {(po.status==="draft"||po.status==="ordered"||po.status==="partial")&&hasPerm(currentUser,"store.edit_stock")&&(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {po.status==="draft"&&<Btn onClick={async()=>{
                      await supabase.from('store_purchase_orders').update({status:'ordered',ordered_at:new Date().toISOString()}).eq('id',po.id);
                    }} color={C.amber} style={{fontSize:11,padding:"6px 14px"}}>📦 {T2("Mark Ordered")}</Btn>}
                    {(po.status==="ordered"||po.status==="partial")&&<Btn onClick={async()=>{
                      for(const li of lineItems){
                        if((+li.qty_received)<(+li.qty_ordered)){
                          await supabase.from('store_po_items').update({qty_received:li.qty_ordered}).eq('id',li.id);
                        }
                      }
                      await supabase.from('store_purchase_orders').update({status:'received',received_at:new Date().toISOString()}).eq('id',po.id);
                    }} color={C.green} style={{fontSize:11,padding:"6px 14px"}}>✅ {T2("Mark All Received")}</Btn>}
                    {po.status==="draft"&&<Btn onClick={async()=>{
                      if(!confirm("Cancel this PO?")) return;
                      await supabase.from('store_purchase_orders').update({status:'cancelled'}).eq('id',po.id);
                    }} color={C.red} style={{fontSize:11,padding:"6px 14px"}}>✕ {T2("Cancel")}</Btn>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── EVENT REQUIREMENTS ── */}
      

      {/* ── INGREDIENT MAP (admin) ── */}
      {tab==="ingmap"&&(()=>{
        const total = allRecipeIngredients.length;
        const mappedCount = allRecipeIngredients.filter(i => ingredientMap[i.name]).length;
        const unmappedCount = total - mappedCount;

        // Filter + search
        let filtered = allRecipeIngredients;
        if (mapTabFilter === "mapped") filtered = filtered.filter(i => ingredientMap[i.name]);
        if (mapTabFilter === "unmapped") filtered = filtered.filter(i => !ingredientMap[i.name]);
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
            <input value={mapTabSearch} onChange={e=>{setMapTabSearch(e.target.value);setMapTabPage(0);}} placeholder={T2("Search ingredients...")}
              style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.bg,marginBottom:14,boxSizing:"border-box"}}/>

            {/* Auto-link all suggestions button */}
            {mapTabFilter==="unmapped"&&unmappedCount>0&&unmappedCount<=500&&(()=>{
              const suggestions = allRecipeIngredients.filter(i=>!ingredientMap[i.name]).map(i=>({ing:i,match:fuzzyMatchStoreItem(i.name)})).filter(s=>s.match&&s.match.score>=70);
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
                      <div style={{fontSize:10,color:C.faint,marginTop:2}}>
                        <span onClick={e=>{e.stopPropagation();setRecipesModalIng(ing);}}
                          style={{cursor:"pointer",color:C.gold,textDecoration:"underline",fontWeight:600}}
                          title={T2("Click to see which recipes use this ingredient")}>
                          {T2("Used in")} {ing.dishes.length} {T2("recipes")}
                        </span> · {T2("unit")}: {ing.unit}
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

                    {/* Right side — status indicator */}
                    <div style={{flexShrink:0,width:32,height:32,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
                      background:isMapped?C.greenBg:C.amberBg}}>
                      <span style={{fontSize:14}}>{isMapped?"✓":"⚠"}</span>
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
