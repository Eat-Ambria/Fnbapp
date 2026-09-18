// Ambria FnB — Kitchen Hub (Overview, Prep Tracking, Prep Plan, Recipe SOPs)
import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, TODAY_LABEL, safeArr, safeNum, safePct, localDateStr, fmtStamp, recipeNameOf, fmtQty, categorizeIngredient, INGR_CATEGORY_ORDER, mergeDishState, storeItemKey, markAllCollected } from '../utils/helpers.js';
import { fetchAllRows } from '../lib/db.js';
// V81: was a dynamic import('../lib/supabase.js') at ~20 call sites — Rollup
// already merges it into the main chunk (it's statically imported everywhere
// else too), so the dynamic form bought no real code-splitting, only extra
// risk: a stale tab whose chunk layout shifted across a deploy could 404
// fetching a chunk that no longer existed ("Failed to fetch dynamically
// imported module"). Static import removes that risk entirely for this module.
import { supabase } from '../lib/supabase.js';
import { opsSupabase } from '../lib/opsSupabase.js';
import { MENU_PACKAGES, MENU_PACKAGE_NAMES } from '../data/menuPackages.js';
import { getSectionForDish, getCatIdForDish, getCatForDish, isFruitSelectionDish, GENERIC_STEPS, RECIPE_INGREDIENTS, RECIPE_DB, DISH_NAME_MAP, findRecipeForDish, getStepsForDish, fmtT, BEV_RE, getFullSteps, getDishImageUrl, getIngrForDish, getIngrForYield, getBgDemandForDish, getBgDemandForYield, interpolatePax, hasIngredients, dishLabel, resolveDishStore } from '../data/recipeData.js';
import { Avatar, Card, Btn, Chip, STag, SelfieCapture, SectionHeader } from './SharedUI.jsx';
import { K, type, tone } from '../utils/theme.js';
import { ripple } from '../utils/ripple.js';
import { Icon, KTabs, KButton, KPill, KStat, KPanel, KColHead, KProgress, KBanner, KModal, KToast, ModalWatermark } from './KitchenUI.jsx';
import { EventDayTab } from './EventDayTab.jsx';
import { hasPermission } from '../data/permissions.js';
import { logActivity } from './ActivityLog.jsx';

// Tints for the SOP library's tiles — category circles and recipe monograms.
// Rotated by position, because neither a category nor a recipe carries a colour
// of its own in RECIPE_DB. Pitched a shade deeper than they would be on white:
// the card face is warm ivory and anything paler disappears into it.
const SOP_TINTS = ["#F3DEE3","#EFE3CF","#DDEADF","#F8E2CB","#DEE7F4","#ECDFF1","#EBE6D5"];

function KitchenHub({ events, kitchenTracking, setKitchenTracking, lang="en", odcOnly=false, currentUser=null, transportQueue=[], setTransportQueue }) {
  const T2 = s => T(s, lang);

  // Safe menu array — handles JSONB array or stringified JSON from Supabase
  function menuArr(ev) {
    const m = ev.menu;
    if (Array.isArray(m)) return m;
    if (typeof m === 'string' && m) { try { return JSON.parse(m); } catch(e) { return []; } }
    return [];
  }

  

  // -- Strip hardcoded quantities from SOP step text --
  // SOPs have "पनीर (15 kg / 200 PAX)" baked in — we show scaled ingredients separately
  function cleanStepText(text) {
    if (!text) return "";
    return text.trim();
  }

  // Section tablet filtering — always uses sop_categories (set in Access Manager)
  const isSectionUser = currentUser?.role?.startsWith('section_');
  const userCats = currentUser?.sop_categories;
  const hasCats = Array.isArray(userCats) && userCats.length > 0;
  const allowedCatIds = isSectionUser ? (hasCats ? userCats : null) : null;
  const sectionFilter = isSectionUser ? (hasCats ? userCats[0] : null) : null;
  // Kept as a list, not a pre-joined string. Eleven station names glued with
  // " + " ran the width of the screen and could not be read; the banner renders
  // them as chips instead.
  const sectionCatNames = isSectionUser && hasCats
    ? [...new Set(userCats.map(c => { const cat = RECIPE_DB.cats.find(cc=>cc.id===c); return cat ? cat.name : c; }).filter(Boolean))]
    : [];
  const sectionDisplayName = sectionCatNames.length ? sectionCatNames.join(' + ') : null;

  const evList0 = safeArr(events);
  const evList = odcOnly ? evList0.filter(e=>/outdoor|odc/i.test(e.venue)) : evList0;
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const todayEvs = evList.filter(e=>e.date===TODAY).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  const tomorrowEvs = evList.filter(e=>e.date===TOMORROW).sort((a,b)=>(a.time||"").localeCompare(b.time||""));

  const [tab, setTab] = useState(()=>todayEvs.length>0?"today":"d1");
  const [expandedDishes, setExpandedDishes] = useState(()=>new Set());
  function toggleDish(key){setExpandedDishes(p=>{const n=new Set(p);n.has(key)?n.delete(key):n.add(key);return n;});}
  const [expandedSecs, setExpandedSecs] = useState({});
  const toggleSec = (sec)=>setExpandedSecs(p=>({...p,[sec]:!p[sec]}));
  const isSecOpen = (sec)=>expandedSecs[sec]===true; // default collapsed
  const [sopCat, setSopCat] = useState(null);
  const [renamingCatId, setRenamingCatId] = useState(null);
  const [renameCatBuf, setRenameCatBuf] = useState("");
  const [renameCatIconBuf, setRenameCatIconBuf] = useState("");
  const [sopRecipe, setSopRecipe] = useState(null);
  const [sopSearch, setSopSearch] = useState("");
  const [editingSteps, setEditingSteps] = useState(false);
  const [sopBulkMode, setSopBulkMode] = useState(false);
  const [sopSelected, setSopSelected] = useState(()=>new Set());
  const [sopBulkTarget, setSopBulkTarget] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatBuf, setNewCatBuf] = useState("");
  // SOP overview controls. catMenuId is the card whose "..." menu is open —
  // one id, not a per-card flag, so opening one closes any other.
  const [sopCatSort, setSopCatSort] = useState("name");
  const [sopSortOpen, setSopSortOpen] = useState(false);
  const [catMenuId, setCatMenuId] = useState(null);
  const [recipeMenu, setRecipeMenu] = useState(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);

  // -- Ingredient Matrix Editor --
  // New schema: {base_pax:300, base_yield:{kg,pcs}, items:[{name, hi, unit, qty:number, qty_nv?:number}]}
  // Reads legacy field names (hindi, nv_qty, qty[]) for backward-compat.
  function openIngEditor(recipe, catId) {
    const ex = recipe.ingredients;
    if (ex && Array.isArray(ex.items) && ex.items.length > 0) {
      const items = ex.items.map(it => {
        if (it.isSection) {
          return { isSection: true, name: it.name || "", hi: it.hi ?? "", yield: {kg: it.yield?.kg ?? null, pcs: it.yield?.pcs ?? null} };
        }
        // qty: scalar (new) or array (legacy — pick 500-pax value if present, else 0)
        let qty = 0;
        if (typeof it.qty === 'number') qty = it.qty;
        else if (Array.isArray(it.qty)) {
          const sizes = ex.pax_sizes || [200,500,1000];
          const i500 = sizes.indexOf(500);
          qty = i500 >= 0 ? (it.qty[i500] || 0) : (it.qty[0] || 0);
        }
        // 9A round-trip fix — preserve type + ops_inventory_id so inv/bg rows survive re-open
        const base = { name: it.name || "", hi: it.hi ?? it.hindi ?? "", unit: it.unit || "kg", qty, notes: it.notes || "" };
        if (it.type) base.type = it.type;
        if (it.ops_inventory_id) base.ops_inventory_id = it.ops_inventory_id;
        return base;
      });
      setIngForm({
        base_pax: ex.base_pax || 300,
        base_yield: {kg: ex.base_yield?.kg ?? null, pcs: ex.base_yield?.pcs ?? null},
        items
      });
    } else {
      setIngForm({base_pax: 300, base_yield: {kg:null, pcs:null}, items: []});
    }
    setIngModal({recipeName:recipe.n, catId});
    setIngDirty(false);
    loadIimMapOnce();   // 9E — kick off IIM load so migration chips can appear on eligible raw rows
  }
  function ingAddItem() {
    setIngForm(f=>({...f,items:[...f.items,{name:"",hi:"",unit:"kg",qty:0,notes:""}]}));
    setIngDirty(true);
  }
  function ingAddSection() {
    setIngForm(f=>({...f,items:[...f.items,{isSection:true,name:"",hi:"",yield:{kg:null,pcs:null}}]}));
    setIngDirty(true);
  }
  function ingRemoveItem(idx) {
    setIngForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
    setIngDirty(true);
  }
  function ingUpdateItem(idx, field, val) {
    setIngForm(f=>{const items=[...f.items];items[idx]={...items[idx],[field]:val};return{...f,items};});
    setIngDirty(true);
  }
  function ingUpdateQty(idx, val) {
    setIngForm(f=>{const items=[...f.items];items[idx]={...items[idx],qty:parseFloat(val)||0};return{...f,items};});
    setIngDirty(true);
  }
  
  function ingMoveItem(idx, dir) {
    setIngForm(f=>{const items=[...f.items];const t2=idx+dir;if(t2<0||t2>=items.length)return f;[items[idx],items[t2]]=[items[t2],items[idx]];return{...f,items};});
    setIngDirty(true);
  }
  // 9A — Change ingredient row type (raw / inv / bg). Resets type-specific fields.
  function ingChangeType(idx, newType) {
    setIngForm(f => {
      const items = [...f.items];
      const cur = items[idx];
      if (!cur || cur.isSection) return f;
      const base = { qty: cur.qty || 0 };
      if (cur.notes) base.notes = cur.notes;
      if (newType === 'raw') {
        items[idx] = { name: cur.name || "", hi: cur.hi || "", unit: cur.unit || "kg", ...base };
      } else if (newType === 'inv') {
        items[idx] = { type:'inv', name: cur.name || "", hi: cur.hi || "", unit: cur.unit || "kg", ops_inventory_id: cur.ops_inventory_id || null, ...base };
      } else if (newType === 'bg') {
        // V72: preserve cur.unit — user can pick any unit, aggregation converts kg/gm and L/ml
        items[idx] = { type:'bg', name: cur.name || "", unit: cur.unit || "kg", ...base };
      }
      return { ...f, items };
    });
    setIngDirty(true);
    setTypePickerIdx(null);
    setTypePickerPos(null);
    if (newType === 'inv') { setOpsPickerIdx(idx); setOpsPickerSearch(""); loadOpsPickerItems(); }
    else if (newType === 'bg') { setBgPickerIdx(idx); setBgPickerSearch(""); }
  }
  // 9A — Lazy-load Ops items on first modal open, cached for session
  async function loadOpsPickerItems() {
    if (opsPickerItems.length > 0 || opsPickerLoading) return;
    setOpsPickerLoading(true);
    try {
      if (!opsSupabase) { setOpsPickerLoading(false); return; }
      const { data, error } = await opsSupabase
        .from('catering_store_items')
        .select('id, inventory_id, name, name_hindi, unit, categories(name)')
        .eq('status', 'approved')
        .order('name', { ascending: true });
      if (error) console.error('Ops picker load err:', error);
      else setOpsPickerItems((data||[]).map(it => ({
        invId: it.inventory_id || "",
        name: it.name || "",
        hi: it.name_hindi || "",
        unit: it.unit || "kg",
        cat: it.categories?.name || "",
      })));
    } catch(e){ console.error('Ops picker load failed:', e); }
    setOpsPickerLoading(false);
  }
  // 9A — Commit Ops item selection into the row
  function selectOpsItem(item) {
    if (opsPickerIdx == null) return;
    const idx = opsPickerIdx;
    setIngForm(f => {
      const items = [...f.items];
      const cur = items[idx] || {};
      items[idx] = {
        type: 'inv',
        name: item.name,
        hi: item.hi,
        unit: item.unit || cur.unit || "kg",
        qty: cur.qty || 0,
        ops_inventory_id: item.invId || null,
        ...(cur.notes ? { notes: cur.notes } : {}),
      };
      return { ...f, items };
    });
    setIngDirty(true);
    setOpsPickerIdx(null);
    setOpsPickerSearch("");
  }
  // 9A — Commit BG recipe selection into the row
  function selectBgRecipe(recipe) {
    if (bgPickerIdx == null) return;
    const idx = bgPickerIdx;
    setIngForm(f => {
      const items = [...f.items];
      const cur = items[idx] || {};
      items[idx] = {
        type: 'bg',
        name: recipe.n,
        // V72: preserve cur.unit — was locked to kg/L; now full list allowed
        unit: cur.unit || "kg",
        qty: cur.qty || 0,
        ...(cur.notes ? { notes: cur.notes } : {}),
      };
      return { ...f, items };
    });
    setIngDirty(true);
    setBgPickerIdx(null);
    setBgPickerSearch("");
  }
  // 9E — lazy-load ingredient_item_map once per session for migration-nudge chips
  async function loadIimMapOnce() {
    if (iimLoaded) return;
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('ingredient_item_map')
        .select('ingredient_name, ops_inventory_id, ops_item_name');
      if (error) { console.warn('[9E] IIM load err:', error); return; }
      const m = {};
      (data || []).forEach(r => {
        if (r.ingredient_name && r.ops_inventory_id) {
          m[r.ingredient_name.toLowerCase().trim()] = {
            ops_inventory_id: r.ops_inventory_id,
            ops_item_name: r.ops_item_name || null,
          };
        }
      });
      setIimMap(m);
      setIimLoaded(true);
    } catch(e){ console.warn('[9E] IIM load failed:', e); }
  }
  // 9E — one-click upgrade a raw row to type='inv' using an ingredient_item_map hit
  function convertRowToInvFromIim(idx, iimHit) {
    if (!iimHit || !iimHit.ops_inventory_id) return;
    setIngForm(f => {
      const items = [...f.items];
      const cur = items[idx] || {};
      if (cur.isSection) return f;
      items[idx] = {
        type: 'inv',
        name: iimHit.ops_item_name || cur.name || "",
        hi: cur.hi || "",
        unit: cur.unit || "kg",
        qty: cur.qty || 0,
        ops_inventory_id: iimHit.ops_inventory_id,
        ...(cur.notes ? { notes: cur.notes } : {}),
      };
      return { ...f, items };
    });
    setIngDirty(true);
  }
  // 9A — All bg=true recipes across categories, for the BG picker list
  function getAllBgRecipes() {
    const out = [];
    for (const cat of safeArr(RECIPE_DB.cats)) {
      for (const r of safeArr(RECIPE_DB.recipes[cat.id])) {
        if (r.bg) out.push({ n: r.n, catId: cat.id, catName: cat.name || cat.id });
      }
    }
    return out;
  }
  // -- Bridge: resolve ingredients for any dish (new JSONB ? old format fallback) --
  
  function findRecipeAndCat(dishName) {
    if (!dishName) return null;
    for (const cat of safeArr(RECIPE_DB.cats)) {
      const recipes = safeArr(RECIPE_DB.recipes[cat.id]);
      const r = recipes.find(rx => rx.n.toLowerCase() === dishName.toLowerCase().trim());
      if (r) return { recipe: r, catId: cat.id };
    }
    return null;
  }

  async function saveIngredients() {
    if(!ingModal)return;
    // Build new-schema payload. Field names locked to `hi` and `qty_nv`.
    const items = ingForm.items.filter(it=>(it.name||"").trim()).map(it => {
      if (it.isSection) {
        const row = { isSection: true, name: it.name.trim() };
        if (it.hi) row.hi = (it.hi||"").trim();
        const yKg = it.yield?.kg==null||it.yield?.kg===""?null:Number(it.yield.kg);
        const yPcs = it.yield?.pcs==null||it.yield?.pcs===""?null:Number(it.yield.pcs);
        if((yKg&&yKg>0)||(yPcs&&yPcs>0)) row.yield = {kg:yKg||null, pcs:yPcs||null};
        return row;
      }
      const t = it.type;
      const qtyN = typeof it.qty === 'number' ? it.qty : parseFloat(it.qty) || 0;
      // 9A — type='inv': carries ops_inventory_id, still keeps name/hi/unit for display + fallback
      if (t === 'inv') {
        const row = {
          type: 'inv',
          name: it.name.trim(),
          hi: (it.hi||"").trim(),
          unit: it.unit || "kg",
          qty: qtyN,
        };
        if (it.ops_inventory_id) row.ops_inventory_id = it.ops_inventory_id;
        if (it.notes) row.notes = it.notes;
        return row;
      }
      // 9A — type='bg': name = bg recipe name.
      // V72: unit was formerly locked to kg/L; now any unit allowed. Demand
      // aggregation is unit-aware (kg↔gm, L↔ml). Non-mass/volume units
      // (pcs/slice/tsp/tbsp/Bot/tin/bunch/dozen) won't aggregate in the
      // demand scanner (see chef signal at bg demand pass).
      if (t === 'bg') {
        const row = {
          type: 'bg',
          name: it.name.trim(),
          unit: it.unit || "kg",
          qty: qtyN,
        };
        if (it.notes) row.notes = it.notes;
        return row;
      }
      // Default: raw (no type key, back-compat)
      const row = {
        name: it.name.trim(),
        hi: (it.hi||"").trim(),
        unit: it.unit || "kg",
        qty: qtyN,
      };
      if (it.notes) row.notes = it.notes;
      return row;
    });
    const payload = {
      base_pax: ingForm.base_pax || 300,
      base_yield: ingForm.base_yield || {kg:null, pcs:null},
      items,
    };
    // Update local RECIPE_DB
    const catRecipes=safeArr(RECIPE_DB.recipes[ingModal.catId]);
    const ri=catRecipes.findIndex(r=>r.n===ingModal.recipeName);
    if(ri>=0) catRecipes[ri].ingredients=payload;
    // Persist to Supabase
    try {
      if(supabase){
        const {error}=await supabase.from('recipes').update({ingredients:payload}).eq('dish_name',ingModal.recipeName).eq('category_id',ingModal.catId);
        if(error) console.error('Ingredient save error:',error);
        else console.log('✅ Ingredients saved for',ingModal.recipeName,'—',items.length,'items');
      }
    }catch(e){console.error('Ingredient save failed:',e);}
    setIngDirty(false);
    if(sopRecipe&&sopRecipe.n===ingModal.recipeName) setSopRecipe(p=>({...p,ingredients:payload}));
    setIngModal(null);
  }

  // -- CSV Import/Export for Ingredients --
  function csvEscape(v){const s=v==null?"":String(v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function csvBuildFromRecipe(rec){
    const items=rec.ingredients?.items||[];
    const lines=["name,hi,unit,qty,isSection,notes"];
    for(const it of items){
      if(it.isSection) lines.push([csvEscape(it.name),csvEscape(it.hi||""),"","","true",""].join(","));
      else lines.push([csvEscape(it.name),csvEscape(it.hi||""),csvEscape(it.unit||"kg"),csvEscape(it.qty??""),"",csvEscape(it.notes||"")].join(","));
    }
    return "\uFEFF"+lines.join("\r\n");
  }
  function csvDownloadFromRecipe(rec){
    const text=csvBuildFromRecipe(rec);
    const pax=rec.ingredients?.base_pax||300;
    const fn=(rec.n||"recipe").replace(/[^\w\-]+/g,"_")+"_"+pax+"pax_ingredients.csv";
    const blob=new Blob([text],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=fn;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function csvParseText(text){
    if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
    const rows=[]; let cur=[],field="",inQ=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(inQ){
        if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else inQ=false; }
        else field+=c;
      } else {
        if(c==='"') inQ=true;
        else if(c===',') { cur.push(field); field=""; }
        else if(c==='\r') { /* skip */ }
        else if(c==='\n') { cur.push(field); rows.push(cur); cur=[]; field=""; }
        else field+=c;
      }
    }
    if(field!==""||cur.length){ cur.push(field); rows.push(cur); }
    return rows;
  }
  function csvImportParse(text){
    const rows=csvParseText(text);
    if(rows.length===0) return {items:[],warnings:["Empty file"]};
    const header=rows[0].map(h=>(h||"").trim().toLowerCase());
    const ix={name:header.indexOf("name"),hi:header.indexOf("hi"),unit:header.indexOf("unit"),qty:header.indexOf("qty"),isSection:header.indexOf("issection"),notes:header.indexOf("notes")};
    if(ix.name<0) return {items:[],warnings:["CSV must have a 'name' column in row 1"]};
    const validUnits=["kg","gm","L","ml","tsp","tbsp","pcs","slice","Bot","tin","bunch","dozen"];
    const items=[],warnings=[];
    for(let r=1;r<rows.length;r++){
      const row=rows[r];
      if(!row||row.every(c=>(c||"").trim()==="")) continue;
      const name=(row[ix.name]||"").trim();
      if(!name){warnings.push(`Row ${r+1}: no name, skipped`);continue;}
      const hi=ix.hi>=0?(row[ix.hi]||"").trim():"";
      const isSec=ix.isSection>=0&&/^(true|1|yes|y)$/i.test((row[ix.isSection]||"").trim());
      if(isSec){ const it={isSection:true,name}; if(hi) it.hi=hi; items.push(it); continue; }
      let unit=ix.unit>=0?(row[ix.unit]||"").trim():"kg";
      if(!unit) unit="kg";
      if(!validUnits.includes(unit)) warnings.push(`Row ${r+1}: unknown unit '${unit}', kept as-is`);
      const qtyRaw=ix.qty>=0?(row[ix.qty]||"").trim():"";
      let qty=0;
      if(qtyRaw!==""){ const p=parseFloat(qtyRaw); if(isNaN(p)) warnings.push(`Row ${r+1}: qty '${qtyRaw}' not numeric, defaulted to 0`); else qty=p; }
      const notes=ix.notes>=0?(row[ix.notes]||"").trim():"";
      const it={name,hi,unit,qty};
      if(notes) it.notes=notes;
      items.push(it);
    }
    return {items,warnings};
  }
  async function csvImportSave(){
    if(!csvImport?.parsedItems) return;
    const {recipe,catId,parsedItems}=csvImport;
    const payload={
      base_pax: recipe.ingredients?.base_pax||300,
      base_yield: recipe.ingredients?.base_yield||{kg:null,pcs:null},
      items: parsedItems,
    };
    const catRecipes=safeArr(RECIPE_DB.recipes[catId]);
    const ri=catRecipes.findIndex(r=>r.n===recipe.n);
    if(ri>=0) catRecipes[ri].ingredients=payload;
    try{
      if(supabase){
        const {error}=await supabase.from('recipes').update({ingredients:payload}).eq('dish_name',recipe.n).eq('category_id',catId);
        if(error){ console.error('CSV import save error:',error); alert('Save failed: '+error.message); return; }
        console.log('✅ CSV imported for',recipe.n,'—',parsedItems.length,'items');
      }
    }catch(e){ console.error('CSV import save failed:',e); alert('Save failed: '+e.message); return; }
    if(sopRecipe&&sopRecipe.n===recipe.n) setSopRecipe(p=>({...p,ingredients:payload}));
    setCsvImport(null);
  }

  // scaleEventId ? REMOVED in Phase 4
  const [yieldAdjustPct, setYieldAdjustPct] = useState(100); // global multiplier applied to planned yields (100 = exactly as planned)
  const [yieldSavedPct,  setYieldSavedPct]  = useState(100); // last successfully persisted yield pct (drives Apply dirty state)
  const [yieldSaving,    setYieldSaving]    = useState(false);
  const [closeEventId, setCloseEventId] = useState(null); // eventId whose closing is being edited
  const [closeRows, setCloseRows] = useState({}); // {dishName: production_closings row} for closeEventId
  const [closeSaving, setCloseSaving] = useState(new Set()); // dish names currently saving
  const [closeCalYr, setCloseCalYr] = useState(()=>new Date().getFullYear()); // Closing calendar cursor year
  const [closeCalMo, setCloseCalMo] = useState(()=>new Date().getMonth()); // Closing calendar cursor month (0-based)
  const [closeSelDate, setCloseSelDate] = useState(null); // selected date on the calendar ("YYYY-MM-DD")
  const [closeSectionOpen, setCloseSectionOpen] = useState({}); // {catId: bool} — collapsible section state, default collapsed
  const [closeExcludeUI, setCloseExcludeUI] = useState(false); // event-level "don't affect ordering" toggle (derived from any row on load)
  const [ingModal, setIngModal] = useState(null);
  const [ingForm, setIngForm] = useState({base_pax:300, base_yield:{kg:null, pcs:null}, items:[]});
  // 9A — type picker + Ops/BG picker state
  const [typePickerIdx, setTypePickerIdx] = useState(null);   // row idx showing type dropdown
  const [typePickerPos, setTypePickerPos] = useState(null);   // {top,left} of the open dropdown's trigger button, viewport coords
  const [opsPickerIdx, setOpsPickerIdx]   = useState(null);   // row idx picking Ops item
  const [bgPickerIdx, setBgPickerIdx]     = useState(null);   // row idx picking BG recipe
  const [opsPickerItems, setOpsPickerItems] = useState([]);   // lazy cache
  const [opsPickerLoading, setOpsPickerLoading] = useState(false);
  const [opsPickerSearch, setOpsPickerSearch] = useState("");
  const [bgPickerSearch, setBgPickerSearch] = useState("");
  // 9E — ingredient_item_map cache for migration nudges (lazy loaded on ing editor open)
  const [iimMap, setIimMap] = useState({});                    // {ingredient_name_lowercase: {ops_inventory_id, ops_item_name}}
  const [iimLoaded, setIimLoaded] = useState(false);
  const [ingDirty, setIngDirty] = useState(false);
  const [csvImport, setCsvImport] = useState(null); // {recipe, catId, recipeName, basePax, currentCount, parsedItems, warnings} | null
  const [ingDragIdx, setIngDragIdx] = useState(null);
  function ingReorderTo(target) {
    if (ingDragIdx===null || ingDragIdx===target) return;
    setIngForm(f => {
      const items=[...f.items];
      const [moved]=items.splice(ingDragIdx,1);
      items.splice(target,0,moved);
      return {...f, items};
    });
    setIngDirty(true);
    setIngDragIdx(null);
  }
  // appliedScales ? REMOVED in Phase 4 (superseded by events.yield_multiplier)
  // scalePlanRows ? REMOVED in Phase 4 (superseded by evPlanRows for all events)
  const [evPlanRows, setEvPlanRows] = useState({}); // {[evId]: {[dishName]: production_plans row}} — loaded for all events currently in evList, drives yield-based ingredient scaling
  const [d1View, setD1View] = useState("all"); // "all" | "cont" | "new"
  const [d1FnFilter, setD1FnFilter] = useState("combined"); // "combined" | eventId
  const [tick, setTick] = useState(0);
  const [dishSignoff, setDishSignoff] = useState(null); // {evId,idx,mode:"completed"|"ready_for_transport",chefName,selfie}

  // -- Dish Name Mapping --
  const [showDishMap, setShowDishMap] = useState(false);
  // Reset-current flow: one modal drives the confirm, the stale-tab block and the
  // result, replacing the browser confirm()/alert() chain.
  const [resetModal, setResetModal] = useState(null);
  // Function picker for Reset. Present = the picker modal is open.
  const [resetPick, setResetPick] = useState(null);  // { evs:[…], dates:[today,tomorrow] }
  const [resetSel,  setResetSel]  = useState([]);    // selected event ids

  // Shared by both paths (single function goes straight to confirm, multiple
  // goes through the picker) so the delete behaves identically either way.
  function runReset(targetIds, doneLabel){
    setResetModal(null);
    setResetPick(null);
    setKitchenTracking(p=>{
      const o = (p&&typeof p==="object") ? {...p} : {};
      targetIds.forEach(id => { delete o[id]; });
      return o;
    });
    try{localStorage.removeItem('ambria_kitchen_tracking');}catch(e){}
    try{localStorage.removeItem('ambria_kt');}catch(e){}
    import('../lib/supabase.js').then(function(mod){
      mod.supabase.from('kitchen_tracking').delete().in('ev_id', targetIds).then(function(r){
        if(r.error){
          console.error('KT scoped clear error:', r.error);
          setResetModal({ tone:"danger", icon:"alert", title:T2("Reset failed"), body:r.error.message });
          return;
        }
        setResetModal({ tone:"ok", icon:"check", title:T2("Reset complete"), body:doneLabel });
      });
    }).catch(function(e){
      console.error('KT clear import error:', e);
      setResetModal({ tone:"danger", icon:"alert", title:T2("Reset failed"), body:String(e&&e.message||e) });
    });
  }
  const [dishMapSel, setDishMapSel] = useState({}); // {lmsName: recipeDishName}
  const [dishMapSaving, setDishMapSaving] = useState(false);
  const [dishMapSearch, setDishMapSearch] = useState("");
  const [dishMapDrop, setDishMapDrop] = useState(null); // lms_name of open dropdown row
  const [dishMapDropQ, setDishMapDropQ] = useState("");
  // "all" | "unlinked" | "mapped" | "auto" — the header chips double as filters.
  // With 163 dishes, the ~30 unlinked ones are the only actionable set, and
  // hunting for them by scrolling was the whole problem with this screen.
  const [dishMapFilter, setDishMapFilter] = useState("all");

  // -- Yield editing --
  const YIELD_UNITS = ["kg","gm","ltr","ml","piece","chafing dish"];
  const [editingYield, setEditingYield] = useState(false);
  const [yieldForm, setYieldForm] = useState({kg:"", pcs:""});

  // -- Yield Capture + Ingredient Usage Modal --
  const [yieldModal, setYieldModal] = useState(null);
  const [yieldQty, setYieldQty] = useState("");
  const [yieldUnit, setYieldUnit] = useState("kg");
  const [usageModal, setUsageModal] = useState(null);
  const [usageActuals, setUsageActuals] = useState({});
  function openUsageModal(dish, pax, isPrepDay, onConfirm) {
    setYieldModal({dish:dish, pax:pax, isPrepDay:isPrepDay, onConfirm:onConfirm});
    setYieldQty(""); setYieldUnit("kg");
  }
  function proceedToIngredientUsage() {
    if (!yieldModal) return;
    var ym = yieldModal;
    setYieldModal(null);
    var ingr = getIngrForDish(ym.dish.name, ym.pax);
    // What was actually made. Handed back to the caller so it lands on the dish
    // and the dispatch list can say how much is going out, not just how many.
    var qty = parseFloat(yieldQty) || null;
    var made = qty ? { madeQty: qty, madeUnit: yieldUnit } : null;
    if (ingr && ingr.length > 0) {
      setUsageModal({evId:ym.dish.fEvId, idx:ym.dish.fIdx, dishName:ym.dish.name, pax:ym.pax, isPrepDay:ym.isPrepDay, ingredients:ingr, onConfirm:ym.onConfirm, yieldQty:qty, yieldUnit:yieldUnit, made:made});
      setUsageActuals({});
    } else { ym.onConfirm(made); }
  }
  async function saveUsageAndDone() {
    if (!usageModal) return;
    const rows = usageModal.ingredients.map(ing => {
      const actual = usageActuals[ing.n];
      return { name: ing.n, hindi: ing.h||"", scaled_qty: Math.round(ing.q*100)/100, unit: ing.u, actual_qty: actual !== undefined && actual !== "" ? parseFloat(actual) : null };
    });
    try {
      await supabase.from('ingredient_usage_log').insert({ event_id: usageModal.evId, dish_name: usageModal.dishName, pax: usageModal.pax, ingredients: rows, is_prep_day: usageModal.isPrepDay, recorded_by: currentUser?.name||"Unknown", yield_qty: usageModal.yieldQty||null, yield_unit: usageModal.yieldQty?usageModal.yieldUnit:null });
    } catch(e) { console.error('Usage log save error:', e); }
    usageModal.onConfirm(usageModal.made);
    setUsageModal(null);
  }

  // -- Analytics --
  const [analyticsEvId, setAnalyticsEvId] = useState(null);
  const [analyticsDate, setAnalyticsDate] = useState(null);
  const [calMo, setCalMo] = useState(()=>new Date().getMonth());
  const [calYr, setCalYr] = useState(()=>new Date().getFullYear());
  const ANA_VP={"Ambria Pushpanjali":{code:"AP",c:"#D85A30"},"Ambria Exotica":{code:"AE",c:"#BA7517"},"Manaktala Farm":{code:"MKT",c:"#2563EB"},"Ambria Restro":{code:"AR",c:"#1D9E75"},"Outdoor Catering (ODC)":{code:"ODC",c:"#7F77DD"},"Ambria Manaktala":{code:"AM",c:"#BA7517"}};
  const anaGp=v=>ANA_VP[v]||{code:"EV",c:"#2563EB"};
  const [usageLogs, setUsageLogs] = useState([]);
  const [analyticsExp, setAnalyticsExp] = useState(new Set());
  function toggleAnalyticsDish(n){setAnalyticsExp(p=>{const s=new Set(p);s.has(n)?s.delete(n):s.add(n);return s;});}
  function fetchUsageLogs(evIds){fetchAllRows(()=>supabase.from('ingredient_usage_log').select('*').in('event_id',evIds)).then(data=>setUsageLogs(data||[])).catch(()=>setUsageLogs([]));}
  useEffect(()=>{
    if(tab!=="analytics"||!analyticsEvId) return;
    const aEvs=safeArr(events);
    const evIds=analyticsEvId==="__combined"?aEvs.map(e=>e.id):[analyticsEvId];
    if(evIds.length===0) return;
    fetchUsageLogs(evIds);
    // Live subscribe: refetch on any insert/update/delete for these event_ids
    let channel=null, mounted=true;
    if(mounted&&supabase){
      channel=supabase
        .channel('ing_usage_'+analyticsEvId)
        .on('postgres_changes',{event:'*',schema:'public',table:'ingredient_usage_log'},(payload)=>{
          const evId=payload.new?.event_id||payload.old?.event_id;
          if(evIds.includes(evId)) fetchUsageLogs(evIds);
        })
        .subscribe();
    }
    return ()=>{
      mounted=false;
      if(channel&&supabase) supabase.removeChannel(channel);
    };
  },[tab,analyticsEvId]);

  // -- Planning (Phase 4) --
  const [planEvId, setPlanEvId] = useState(null);
  const [planSelDate, setPlanSelDate] = useState(null);
  const [planCalMo, setPlanCalMo] = useState(()=>new Date().getMonth());
  const [planCalYr, setPlanCalYr] = useState(()=>new Date().getFullYear());
  const [planRows, setPlanRows] = useState({});          // {dishName: row}
  const [planDrafts, setPlanDrafts] = useState({});      // {dishName: string being edited}
  const [planSaving, setPlanSaving] = useState(new Set());// dishNames currently saving
  const [planLoading, setPlanLoading] = useState(false);
  const [planIngrModal, setPlanIngrModal] = useState(null); // V74: {dish, effKg, mult, isOverride, yieldAdjustPct, pax}
  const [showOrderingSheet, setShowOrderingSheet] = useState(false); // section-wise ingredient ordering sheet modal
  // V74 — per-section ingredient panel UI state for Prep Day Collect from store view (session-local)
  const [d1SecIngrOpen, setD1SecIngrOpen] = useState({});   // { [catId]: bool }
  const [d1SecSearch,   setD1SecSearch]   = useState({});   // { [catId]: string }
  const [d1SecSort,     setD1SecSort]     = useState({});   // { [catId]: 'qty'|'name' }

  // Load production_plans whenever the selected event changes
  useEffect(()=>{
    if(!planEvId){ setPlanRows({}); setPlanDrafts({}); return; }
    let cancelled = false;
    setPlanLoading(true);
    supabase.from('production_plans').select('*').eq('event_id', planEvId).then(({data,error})=>{
      if(cancelled) return;
      if(error){ console.error('[production_plans load]', error); setPlanRows({}); }
      else {
        const map = {};
        (data||[]).forEach(row => { map[row.dish_name] = row; });
        setPlanRows(map);
      }
      setPlanDrafts({});
      setPlanLoading(false);
    }).catch(e=>{ if(!cancelled){ console.error('[production_plans load]', e); setPlanLoading(false);}});
    return ()=>{ cancelled=true; };
  },[planEvId]);

  // -- Sync yieldAdjustPct + yieldSavedPct UI from event.yield_multiplier when a Planning event is selected (Phase 3) --
  useEffect(()=>{
    if(!planEvId) return;
    const ev = evList.find(e=>e.id===planEvId);
    if(!ev) return;
    const pct = Math.round((Number(ev.yield_multiplier)||1.0) * 100);
    setYieldAdjustPct(pct);
    setYieldSavedPct(pct);
    // Deliberately NOT depending on evList — realtime updates from other tabs shouldn't clobber a slider mid-drag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[planEvId]);

  // -- Yield multiplier is now saved on explicit Apply click (see Yield Adjustment card in Planning tab render).
  //    Debounced auto-save removed — was too easy to trigger unintended cascades on Event Day / Prep Day scaling.

  // scaleEventId useEffect ? REMOVED in Phase 4

  // -- Load production_plans for ALL events in evList (Path B: drives yield-based ingredient scaling on Event Day + Prep Day tabs) --
  const evListIds = useMemo(()=>Array.from(new Set((evList||[]).map(e=>e.id))).sort().join(","),[evList]);
  useEffect(()=>{
    const ids = evListIds ? evListIds.split(",").filter(Boolean) : [];
    if(!ids.length){ setEvPlanRows({}); return; }
    let cancelled=false;
    fetchAllRows(()=>supabase.from('production_plans').select('*').in('event_id', ids)).then((data)=>{
      if(cancelled) return;
      const map={};
      (data||[]).forEach(row=>{
        if(!map[row.event_id]) map[row.event_id]={};
        map[row.event_id][row.dish_name]=row;
      });
      setEvPlanRows(map);
    }).catch(e=>{ if(!cancelled) console.error('[evPlanRows load]', e); });
    return ()=>{ cancelled=true; };
  },[evListIds]);

  // Load production_closings for the Closing tab's selected event.
  // Also initializes the event-level exclude toggle from any row's value.
  useEffect(()=>{
    if(!closeEventId){ setCloseRows({}); setCloseExcludeUI(false); return; }
    if(tab!=='closing'){ return; }
    let cancelled=false;
    supabase.from('production_closings').select('*').eq('event_id', closeEventId).then(({data,error})=>{
      if(cancelled) return;
      if(error){ console.error('[production_closings load]', error); setCloseRows({}); setCloseExcludeUI(false); return; }
      const map={};
      (data||[]).forEach(row=>{ map[row.dish_name]=row; });
      setCloseRows(map);
      setCloseExcludeUI((data||[]).some(r => r.exclude_from_ordering));
    }).catch(e=>{ if(!cancelled) console.error('[production_closings load]', e); });
    return ()=>{ cancelled=true; };
  },[closeEventId, tab]);

  // Save (upsert) a single field patch for a dish's closing row.
  // `patch` = one of {leftover_kg, leftover_pcs, notes, exclude_from_ordering}.
  // Bails out on empty writes when no row exists to avoid creating noise rows on tab-through.
  async function saveClosing(dish, patch, ctx){
    if(!ctx) return;
    const existing = closeRows[dish];
    if(!existing){
      const val = patch[Object.keys(patch)[0]];
      if(val==='' || val==null || val===false) return;
    }
    setCloseSaving(p=>{const s=new Set(p);s.add(dish);return s;});
    try{
      const normNum = v => (v===''||v==null) ? null : (parseFloat(v)||0);
      const merged = {
        event_id: ctx.evId,
        event_date: ctx.evDate,
        venue: ctx.venue,
        dish_name: dish,
        planned_kg: evPlanRows[ctx.evId]?.[dish]?.target_yield_kg || existing?.planned_kg || null,
        leftover_kg: 'leftover_kg' in patch ? (normNum(patch.leftover_kg) ?? 0) : (existing?.leftover_kg ?? 0),
        leftover_pcs: 'leftover_pcs' in patch ? normNum(patch.leftover_pcs) : (existing?.leftover_pcs ?? null),
        notes: 'notes' in patch ? (String(patch.notes||'').trim() || null) : (existing?.notes ?? null),
        // exclude flag is event-level now — new rows inherit closeExcludeUI, existing rows keep their value
        exclude_from_ordering: existing?.exclude_from_ordering ?? closeExcludeUI ?? false,
        closed_by: currentUser?.name || currentUser?.id || 'Unknown'
      };
      if(existing?.id) merged.id = existing.id;
      if(merged.leftover_kg==null) merged.leftover_kg = 0;
      const {data, error} = await supabase
        .from('production_closings')
        .upsert(merged, {onConflict:'event_id,dish_name'})
        .select();
      if(error) throw error;
      if(data && data[0]) setCloseRows(p=>({...p,[dish]:data[0]}));
    } catch(e){
      console.error('[saveClosing]', dish, e);
      alert('Failed to save closing for '+dish+': '+(e.message||e));
    } finally {
      setCloseSaving(p=>{const s=new Set(p);s.delete(dish);return s;});
    }
  }

  // Toggle the event-level "don't affect ordering" flag.
  // Bulk-updates every existing closing row for the event so schema stays per-dish while UI is event-level.
  // If no rows exist yet, only local state is updated — new rows created via saveClosing will inherit it.
  async function toggleEventExclude(newVal, ctx){
    if(!ctx) return;
    setCloseExcludeUI(newVal);
    const dishesWithRows = Object.keys(closeRows);
    if(dishesWithRows.length === 0) return;
    try {
      const {error} = await supabase
        .from('production_closings')
        .update({ exclude_from_ordering: newVal })
        .eq('event_id', ctx.evId);
      if(error) throw error;
      setCloseRows(p => {
        const next = {};
        Object.entries(p).forEach(([k,v]) => { next[k] = {...v, exclude_from_ordering: newVal}; });
        return next;
      });
    } catch(e){
      console.error('[toggleEventExclude]', e);
      alert('Failed to update event flag: '+(e.message||e));
      setCloseExcludeUI(!newVal);
    }
  }

  // Save (upsert or delete) a single dish yield for the current event.
  // `ctx` = { evId, evDate, venue, recipe }.
  async function savePlanYield(dish, rawVal, ctx, section){
    // If section given → merge into section_yields blob and recompute target_yield_kg = sum
    // If section null → treat rawVal as whole-dish target_yield_kg (legacy path)
    const trimmed = (rawVal==null?"":String(rawVal)).trim();
    const num = trimmed==="" ? null : parseFloat(trimmed);
    const draftKey = section ? (dish+"|"+section) : dish;
    const savingKey = draftKey;
    setPlanSaving(p=>{const s=new Set(p);s.add(savingKey);return s;});
    try{
      if(section){
        // Section update: merge into existing section_yields; delete key if empty
        const existing = planRows[dish] || {};
        const existSY = existing.section_yields || {};
        const nextSY = {...existSY};
        if(num===null || isNaN(num) || num<=0) delete nextSY[section];
        else nextSY[section] = num;
        const anyLeft = Object.keys(nextSY).length>0;
        if(!anyLeft && !existing.id){
          setPlanDrafts(p=>{const c={...p};delete c[draftKey];return c;});
          return;
        }
        const sumKg = Object.values(nextSY).reduce((s,v)=>s+(Number(v)||0),0);
        const payload = {
          event_id: ctx.evId, event_date: ctx.evDate, venue: ctx.venue,
          dish_name: dish, recipe_id: ctx.recipe?.id || null,
          target_yield_kg: sumKg>0?sumKg:null,
          section_yields: anyLeft?nextSY:null,
          planned_by: currentUser?.name || currentUser?.id || 'Unknown',
          status: 'draft'
        };
        const {data, error} = await supabase.from('production_plans').upsert(payload, {onConflict:'event_id,dish_name'}).select();
        if(error) throw error;
        if(data && data[0]) setPlanRows(p=>({...p,[dish]:data[0]}));
      } else if(num===null || isNaN(num) || num<=0){
        if(planRows[dish]){
          const {error} = await supabase.from('production_plans').delete().eq('event_id',ctx.evId).eq('dish_name',dish);
          if(error) throw error;
          setPlanRows(p=>{const c={...p};delete c[dish];return c;});
        }
      } else {
        const payload = {
          event_id: ctx.evId, event_date: ctx.evDate, venue: ctx.venue,
          dish_name: dish, recipe_id: ctx.recipe?.id || null,
          target_yield_kg: num, section_yields: null,
          planned_by: currentUser?.name || currentUser?.id || 'Unknown',
          status: 'draft'
        };
        const {data, error} = await supabase.from('production_plans').upsert(payload, {onConflict:'event_id,dish_name'}).select();
        if(error) throw error;
        if(data && data[0]) setPlanRows(p=>({...p,[dish]:data[0]}));
      }
      setPlanDrafts(p=>{const c={...p};delete c[draftKey];return c;});
    } catch(e){
      console.error('[savePlanYield]', dish, section, e);
      alert('Failed to save yield for '+dish+(section?` (${section})`:'')+': '+(e.message||e));
    } finally {
      setPlanSaving(p=>{const s=new Set(p);s.delete(savingKey);return s;});
    }
  }

  // -- SOP Add/Edit Modal --
  const [sopModal, setSopModal] = useState(null); // null | {mode:'add'|'edit', catId, origName}
  const emptySopStep = ()=>({t:"",i:"",tm:0,ccp:"",d1:false,subs:[]});
  const [sopForm, setSopForm] = useState({name:"",sub:"",catId:"",bg:false,steps:[emptySopStep()]});
  function openSopAdd(catId){
    setSopForm({name:"",sub:"",catId:catId||safeArr(RECIPE_DB.cats)[0]?.id||"",bg:false,steps:[emptySopStep()]});
    setSopModal({mode:"add",catId:catId||""});
  }
  function openSopEdit(recipe,catId){
    setSopForm({name:recipe.n,sub:recipe.sub||"",catId:catId||sopCat||"",bg:!!recipe.bg,steps:safeArr(recipe.steps).map(s=>({t:s.t||"",i:s.i||s.desc||"",tm:s.tm||0,ccp:s.ccp||"",d1:!!s.d1,subs:Array.isArray(s.subs)?s.subs.map(sb=>({t:sb.t||"",i:sb.i||"",tm:sb.tm||0,ccp:sb.ccp||""})):[]}))});
    setSopModal({mode:"edit",catId:catId||sopCat||"",origName:recipe.n});
  }
  function sopFormStep(si,field,val){setSopForm(p=>({...p,steps:p.steps.map((s,i)=>i!==si?s:{...s,[field]:val})}));}
  function sopAddStep(){setSopForm(p=>({...p,steps:[...p.steps,emptySopStep()]}));}
  function sopRemoveStep(si){setSopForm(p=>({...p,steps:p.steps.filter((_,i)=>i!==si)}));}
  function sopMoveStep(si,dir){setSopForm(p=>{const s=[...p.steps];const ni=si+dir;if(ni<0||ni>=s.length)return p;[s[si],s[ni]]=[s[ni],s[si]];return{...p,steps:s};});}
  function sopAddSub(si){setSopForm(p=>({...p,steps:p.steps.map((s,i)=>i!==si?s:{...s,subs:[...(s.subs||[]),{t:"",i:"",tm:0,ccp:""}]})}));}
  function sopRemoveSub(si,sbi){setSopForm(p=>({...p,steps:p.steps.map((s,i)=>i!==si?s:{...s,subs:(s.subs||[]).filter((_,j)=>j!==sbi)})}));}
  function sopEditSub(si,sbi,field,val){setSopForm(p=>({...p,steps:p.steps.map((s,i)=>i!==si?s:{...s,subs:(s.subs||[]).map((sb,j)=>j!==sbi?sb:{...sb,[field]:val})})}));}
  function saveSop(){
    const f=sopForm;
    if(!f.name.trim()||!f.catId||f.steps.length===0)return alert("Name, category and at least 1 step required");
    const recObj={n:f.name.trim(),sub:f.sub.trim(),bg:!!f.bg,steps:f.steps.map(s=>{const hasSubs=s.subs&&s.subs.filter(sb=>sb.t.trim()).length>0;return{t:s.t,i:s.i,tm:hasSubs?0:(+s.tm||0),ccp:s.ccp||null,d1:!!s.d1,...(hasSubs?{subs:s.subs.filter(sb=>sb.t.trim()).map(sb=>({t:sb.t,i:sb.i||"",tm:+sb.tm||0,ccp:sb.ccp||""}))}:{})};})};
    // Update local RECIPE_DB — preserve ingredients from old recipe
    if(!RECIPE_DB.recipes[f.catId])RECIPE_DB.recipes[f.catId]=[];
    if(sopModal.mode==="edit"&&sopModal.origName){
      const arr=RECIPE_DB.recipes[sopModal.catId]||[];
      const idx=arr.findIndex(r=>r.n===sopModal.origName);
      let oldIngredients=null;
      if(idx>=0){oldIngredients=arr[idx].ingredients||null;arr.splice(idx,1);} // remove from old category
      if(oldIngredients)recObj.ingredients=oldIngredients;
      RECIPE_DB.recipes[f.catId].push(recObj);
    }else{
      RECIPE_DB.recipes[f.catId].push(recObj);
    }
    // Save to Supabase — preserve ingredients column
    (async()=>{
      const sb=supabase;if(!sb)return;
      if(sopModal.mode==="edit"&&sopModal.origName){
        const nameUnchanged=sopModal.origName===recObj.n&&sopModal.catId===f.catId;
        if(nameUnchanged){
          // Same name+category ? UPDATE in place, ingredients untouched
          sb.from('recipes').update({sub:recObj.sub,steps:recObj.steps,bg:!!recObj.bg}).eq('dish_name',recObj.n).eq('category_id',f.catId).then(r=>{if(r.error)console.error('SOP save err:',r.error);else console.log('? SOP updated (in-place)');});
        }else{
          // Name or category changed ? fetch ingredients, then delete+insert with them
          sb.from('recipes').select('ingredients').eq('dish_name',sopModal.origName).single().then(({data})=>{
            sb.from('recipes').delete().eq('dish_name',sopModal.origName).then(()=>{
              sb.from('recipes').insert({dish_name:recObj.n,category_id:f.catId,sub:recObj.sub,steps:recObj.steps,ingredients:data?.ingredients||null,bg:!!recObj.bg}).then(r=>{if(r.error)console.error('SOP save err:',r.error);else console.log('? SOP updated (renamed)');});
            });
          });
        }
      }else{
        sb.from('recipes').insert({dish_name:recObj.n,category_id:f.catId,sub:recObj.sub,steps:recObj.steps,bg:!!recObj.bg}).then(r=>{if(r.error)console.error('SOP save err:',r.error);else console.log('? SOP saved');});
      }
    })().catch(e=>console.error('SOP supabase err:',e));
    logActivity('kitchen', (sopModal.mode==='edit'?'SOP updated: ':'SOP created: ')+recObj.n, sopModal.mode==='edit'?'sop_update':'sop_create', {dish:recObj.n, catId:f.catId}, currentUser?.id);
    setSopModal(null);setSopRecipe(recObj);
  }
  function renameCategory(catId,newName){
    var trimmed=(newName||'').trim();
    if(!trimmed) return;
    var cat=RECIPE_DB.cats.find(c=>c.id===catId);
    if(!cat||cat.name===trimmed) return;
    var oldName=cat.name;
    cat.name=trimmed;
    supabase.from('recipe_categories').update({name:trimmed}).eq('id',catId).then(r=>{if(r.error)console.error('Cat rename err:',r.error);});
    logActivity('kitchen','SOP section renamed: '+oldName+' → '+trimmed,'sop_category_rename',{catId:catId,from:oldName,to:trimmed},currentUser?.id);
  }
  function updateCategoryIcon(catId,newIcon){
    var trimmed=(newIcon||'').trim();
    if(!trimmed) return;
    var cat=RECIPE_DB.cats.find(c=>c.id===catId);
    if(!cat||cat.icon===trimmed) return;
    var oldIcon=cat.icon;
    cat.icon=trimmed;
    supabase.from('recipe_categories').update({icon:trimmed}).eq('id',catId).then(r=>{if(r.error)console.error('Cat icon update err:',r.error);});
    logActivity('kitchen','SOP section icon changed: '+cat.name+' ('+oldIcon+' → '+trimmed+')','sop_category_icon',{catId:catId,from:oldIcon,to:trimmed},currentUser?.id);
  }
  function saveCategoryEdit(catId,newName,newIcon){
    renameCategory(catId,newName);
    updateCategoryIcon(catId,newIcon);
  }
  async function addCategory(name){
    var trimmed=(name||'').trim();
    if(!trimmed) return;
    var slug=trimmed.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'category';
    var existing={}; RECIPE_DB.cats.forEach(c=>{existing[c.id]=true;});
    var id=slug;
    if(existing[id]) id=slug+'_'+Date.now().toString(36);
    var row={id:id,name:trimmed,icon:'📋',sort_order:RECIPE_DB.cats.length};
    var res=await supabase.from('recipe_categories').insert(row);
    if(res.error){window.alert('Failed to add category: '+res.error.message);return;}
    RECIPE_DB.cats.push({id:id,name:trimmed,icon:'📋',color:'#8E8678',count:0});
    RECIPE_DB.recipes[id]=[];
    logActivity('kitchen','SOP category added: '+trimmed,'sop_category_add',{catId:id,name:trimmed},currentUser?.id);
    setAddingCategory(false);setNewCatBuf("");setSopCat(id);
  }
  // Destructive confirms go through the in-app dialog, not window.confirm: the
  // browser one is unstyled OS chrome, it cannot say WHAT is being deleted in
  // the app's own voice, and on a kiosk tablet it can be suppressed entirely —
  // which would make a delete silent.
  function deleteCategory(catId){
    var cat=safeArr(RECIPE_DB.cats).find(c=>c.id===catId);
    var n=safeArr(RECIPE_DB.recipes[catId]).length;
    if(n>0){
      setResetModal({tone:"warn",icon:"alert",
        title:T2("This category still has recipes"),
        body:`${T2("It holds")} ${n} ${n===1?T2("recipe"):T2("recipes")}. ${T2("Move or delete them first, then the category can go.")}`});
      return;
    }
    setResetModal({tone:"danger",icon:"trash",
      title:`${T2("Delete")} "${cat?cat.name:catId}"?`,
      body:T2("The category is removed for everyone. This cannot be undone."),
      confirmLabel:T2("Delete category"),
      onConfirm:function(){setResetModal(null);doDeleteCategory(catId);}});
  }
  function doDeleteCategory(catId){
    var arr=safeArr(RECIPE_DB.recipes[catId]);
    if(arr.length>0)return; // re-checked at commit time, not just at click time
    RECIPE_DB.cats=RECIPE_DB.cats.filter(c=>c.id!==catId);
    delete RECIPE_DB.recipes[catId];
    supabase.from('recipe_categories').delete().eq('id',catId).then(r=>{if(r.error)console.error('Cat delete err:',r.error);else console.log('? Category deleted:',catId);});
    logActivity('kitchen','SOP category deleted: '+catId,'sop_category_delete',{catId:catId},currentUser?.id);
    setSopCat(null);
  }
  function moveRecipe(recipe,fromCatId,toCatId){
    if(!toCatId||toCatId===fromCatId) return;
    var fromArr=RECIPE_DB.recipes[fromCatId]||[];
    var idx=fromArr.findIndex(r=>r.n===recipe.n);
    if(idx>=0) fromArr.splice(idx,1);
    if(!RECIPE_DB.recipes[toCatId]) RECIPE_DB.recipes[toCatId]=[];
    RECIPE_DB.recipes[toCatId].push(recipe);
    RECIPE_DB.cats.forEach(c=>{c.count=(RECIPE_DB.recipes[c.id]||[]).length;});
    supabase.from('recipes').update({category_id:toCatId}).eq('dish_name',recipe.n).eq('category_id',fromCatId).then(r=>{if(r.error)console.error('Move err:',r.error);else console.log('? Recipe moved:',recipe.n,'?',toCatId);});
    logActivity('kitchen','SOP moved: '+recipe.n+' ? '+toCatId,'sop_move',{dish:recipe.n,from:fromCatId,to:toCatId},currentUser?.id);
    setSopRecipe(null);setSopCat(toCatId);
  }
  function moveRecipesBulk(recipes,fromCatId,toCatId){
    if(!toCatId||toCatId===fromCatId||!recipes.length) return;
    var names=recipes.map(r=>r.n);
    var fromArr=RECIPE_DB.recipes[fromCatId]||[];
    RECIPE_DB.recipes[fromCatId]=fromArr.filter(r=>names.indexOf(r.n)<0);
    if(!RECIPE_DB.recipes[toCatId]) RECIPE_DB.recipes[toCatId]=[];
    RECIPE_DB.recipes[toCatId]=RECIPE_DB.recipes[toCatId].concat(recipes);
    RECIPE_DB.cats.forEach(c=>{c.count=(RECIPE_DB.recipes[c.id]||[]).length;});
    supabase.from('recipes').update({category_id:toCatId}).in('dish_name',names).eq('category_id',fromCatId).then(r=>{if(r.error)console.error('Bulk move err:',r.error);else console.log('? Bulk moved',names.length,'recipes ->',toCatId);});
    logActivity('kitchen','SOP bulk moved: '+names.length+' recipes → '+toCatId,'sop_bulk_move',{dishes:names,from:fromCatId,to:toCatId},currentUser?.id);
    setSopSelected(new Set());setSopBulkMode(false);setSopBulkTarget("");
  }
  // Leaving the ingredient editor with unsaved rows is a real loss, so it
  // asks in the app's own dialog rather than a browser confirm.
  function askDiscardIng(){
    setResetModal({tone:"warn",icon:"alert",
      title:T2("Discard your changes?"),
      body:T2("The rows you edited since the last save will be lost."),
      confirmLabel:T2("Discard changes"),
      onConfirm:function(){setResetModal(null);setIngModal(null);setIngDirty(false);}});
  }
  function deleteSop(recipe,catId){
    const nSteps=safeArr(recipe.steps).length;
    const nIng=safeArr(recipe.ingredients?.items).filter(i=>!i.isSection).length;
    const detail=[nSteps?`${nSteps} ${nSteps===1?T2("step"):T2("steps")}`:null,
                  nIng?`${nIng} ${T2("ingredients")}`:null].filter(Boolean).join(" · ");
    // The recipe name goes in the subhead, not the title. Titles that quote a
    // long dish name wrap to two lines and bury the question being asked.
    setResetModal({tone:"danger",icon:"trash",
      title:T2("Delete this recipe?"),
      subhead:(
        <div>
          <div style={{fontSize:15,fontWeight:700,color:K.hdrTitle,overflowWrap:"anywhere"}}>{recipe.n}</div>
          {detail&&<div style={{fontSize:13,color:K.hdrMeta,marginTop:2}}>{detail}</div>}
        </div>
      ),
      body:T2("It is removed for everyone. This cannot be undone."),
      confirmLabel:T2("Delete recipe"),
      onConfirm:function(){setResetModal(null);doDeleteSop(recipe,catId);}});
  }
  function doDeleteSop(recipe,catId){
    const cid=catId||sopCat||"";
    const arr=RECIPE_DB.recipes[cid]||[];
    const idx=arr.findIndex(r=>r.n===recipe.n);
    if(idx>=0)arr.splice(idx,1);
    (async()=>{
      const sb=supabase;if(!sb)return;
      sb.from('recipes').delete().eq('dish_name',recipe.n).then(r=>{if(r.error)console.error('SOP delete err:',r.error);else console.log('? SOP deleted');});
    })().catch(e=>console.error('SOP delete err:',e));
    logActivity('kitchen', 'SOP deleted: '+recipe.n, 'sop_delete', {dish:recipe.n, catId:cid}, currentUser?.id);
    setSopRecipe(null);
  }

  // -- Camera for chef selfie --
  const camRef = useRef(null);
  const capRef = useRef(null);
  const camStreamRef = useRef(null);
  const [camOn, setCamOn] = useState(false);
  function openCam(fbId){
    if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
      navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false})
        .then(function(stream){camStreamRef.current=stream;setCamOn(true);})
        .catch(function(){var el=document.getElementById(fbId);if(el)el.click();});
    }else{var el=document.getElementById(fbId);if(el)el.click();}
  }
  function capturePhoto(){
    var v=camRef.current;var c=capRef.current;if(!v||!c)return;
    c.width=v.videoWidth||320;c.height=v.videoHeight||240;
    c.getContext('2d').drawImage(v,0,0);
    var url=c.toDataURL('image/jpeg',0.7);
    setDishSignoff(function(p){return p?{...p,selfie:url}:p;});
    stopCam();
  }
  function stopCam(){
    if(camStreamRef.current){camStreamRef.current.getTracks().forEach(function(t){t.stop();});camStreamRef.current=null;}
    setCamOn(false);
  }
  useEffect(function(){return function(){stopCam();};},[]);

  // -- Chef Photo on Mark as Complete --
  const [readyModal, setReadyModal] = useState(null); // {evId,idx,dishName}
  const [readyPhoto, setReadyPhoto] = useState(null);
  const [readyCamOn, setReadyCamOn] = useState(false);
  const readyVidRef = useRef(null);
  const readyStreamRef = useRef(null);
  const [readySig, setReadySig] = useState(null);
  const sigCanvasRef = useRef(null);
  const sigDrawing = useRef(false);

  function sigCtx(){
    const c=sigCanvasRef.current;if(!c)return null;
    const ctx=c.getContext('2d');ctx.strokeStyle='#2563EB';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
    return ctx;
  }
  function sigPos(e,c){
    const r=c.getBoundingClientRect();
    const t=e.touches?e.touches[0]:e;
    return {x:(t.clientX-r.left)*(c.width/r.width),y:(t.clientY-r.top)*(c.height/r.height)};
  }
  function sigStart(e){
    e.preventDefault();const c=sigCanvasRef.current;if(!c)return;
    sigDrawing.current=true;const ctx=sigCtx();if(!ctx)return;
    const p=sigPos(e,c);ctx.beginPath();ctx.moveTo(p.x,p.y);
  }
  function sigMove(e){
    e.preventDefault();if(!sigDrawing.current)return;
    const c=sigCanvasRef.current;if(!c)return;
    const ctx=sigCtx();if(!ctx)return;
    const p=sigPos(e,c);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);
  }
  function sigEnd(e){
    if(!sigDrawing.current)return;
    sigDrawing.current=false;
    if(sigCanvasRef.current) setReadySig(sigCanvasRef.current.toDataURL('image/png'));
  }
  function sigClear(){
    const c=sigCanvasRef.current;
    if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);}
    setReadySig(null);
  }
  function startReadyCam(){
    setReadyCamOn(true);
    setTimeout(()=>{
      navigator.mediaDevices?.getUserMedia({video:{facingMode:"user",width:480,height:360}})
        .then(s=>{readyStreamRef.current=s;if(readyVidRef.current){readyVidRef.current.srcObject=s;readyVidRef.current.play();}})
        .catch(()=>{setReadyCamOn(false);});
    },200);
  }
  function stopReadyCam(){if(readyStreamRef.current){readyStreamRef.current.getTracks().forEach(t=>t.stop());readyStreamRef.current=null;}setReadyCamOn(false);}
  function snapReady(){
    if(!readyVidRef.current||!readyCamOn) return null;
    const c=document.createElement("canvas");c.width=320;c.height=240;
    c.getContext("2d").drawImage(readyVidRef.current,0,0,320,240);
    return c.toDataURL("image/jpeg",0.7);
  }

  // Global 1-second tick drives all running timers
  useEffect(()=>{const t=setInterval(()=>setTick(k=>k+1),1000);return()=>clearInterval(t);},[]);

  // -- State helpers (auto-save to kitchenTracking — combined cooking keys) --
  function dk(evId,idx){return evId+"|"+idx;}
  function ck(dishName){return "dish|"+dishName;}
  // Fresh TOMORROW re-derived on every call — module-load TOMORROW goes stale on tabs open across midnight
  function _freshTomorrow(){ const _d=new Date();_d.setDate(_d.getDate()+1);return localDateStr(_d); }
  function ds(evId,idx,dishName){
    const _TOM=_freshTomorrow();
    if(d1FnFilter==="combined" && dishName) return kt["__combined_"+_TOM]?.[ck(dishName)]||{};
    var perEv=kt[evId]?.[dk(evId,idx)]||{};
    if(dishName && !Object.keys(perEv).length){
      var cb=kt["__combined_"+_TOM]?.[ck(dishName)]||{};
      if(Object.keys(cb).length){var r=Object.assign({},cb);delete r.mesaDone;return r;}
    }
    return perEv;
  }
  function setDs(evId,idx,upd,dishInfo){
    const _TOM=_freshTomorrow();
    setKitchenTracking(p=>{
      const o=p&&typeof p==="object"?{...p}:{};
      // mergeDishState, not a spread: see its comment in utils/helpers.js —
      // a shallow merge lets a stale step map erase a just-recorded Done.
      if(d1FnFilter==="combined" && dishInfo?.name){
        const cKey=ck(dishInfo.name);
        var _ck="__combined_"+_TOM;o[_ck]={...(o[_ck]||{}),[cKey]:mergeDishState(o[_ck]?.[cKey],upd)};
        var propUpd=Object.assign({},upd); delete propUpd.mesaDone;
        if(Object.keys(propUpd).length>0){
          (dishInfo.fns||[]).forEach(fn=>{
            const k2=dk(fn.evId,fn.idx);
            o[fn.evId]={...(o[fn.evId]||{}),[k2]:mergeDishState(o[fn.evId]?.[k2],propUpd)};
          });
        }
      } else {
        const k2=dk(evId,idx);
        o[evId]={...(o[evId]||{}),[k2]:mergeDishState(o[evId]?.[k2],upd)};
      }
      return o;
    });
  }
  function setEvMeta(evId,key,val){
    setKitchenTracking(p=>{const o=p&&typeof p==="object"?{...p}:{};o[evId]={...(o[evId]||{}),[key]:val};return o;});
  }
  function markReady(evId,idx,dishName){setReadyModal({evId,idx,dishName});setReadyPhoto(null);setTimeout(startReadyCam,100);}

  const tomorrowLabel = new Date(TOMORROW+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
  const todayLabel2   = new Date(TODAY+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
  const dayAfterLabel = new Date(DAY_AFTER+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
  const hasTodayEvs   = todayEvs.length > 0;
  const hasTomorrowEvs = tomorrowEvs.length > 0;
  const hasDayAfterEvs = evList.filter(e=>e.date===DAY_AFTER).length > 0;

  const tomorrowEv0 = tomorrowEvs[0];
  const dayAfterEv0 = evList.find(e=>e.date===DAY_AFTER);

  const contPax  = hasTodayEvs ? todayEvs.reduce((s,e)=>s+(+e.pax||0),0) : tomorrowEvs.reduce((s,e)=>s+(+e.pax||0),0);
  const newD1Pax = evList.filter(e=>e.date===DAY_AFTER).reduce((s,e)=>s+(+e.pax||0),0);

  // -- Auto-scaling: compute effective scale per event --
  // BASE_PAX = 400 (all SOP recipes calibrated for this)
  // Percent-based scaling (BASE_PAX / getEffectiveScale / effectiveScales) ? REMOVED in Phase 4.
  // Replaced by getScaledIngredients + events.yield_multiplier + evPlanRows (Path B).

  // Prep day context: which events are being prepped for
  const prepEvLabel = tomorrowEvs.map(e=>`${e.guest||"Function"} (${e.pax} pax)`).join(", ");
  const prepContextParts = [];
  if(prepEvLabel) prepContextParts.push(`${tomorrowLabel}: ${prepEvLabel}`);

  // -- Path B: yield-based ingredient scaling helper --
  // Returns {ing, effKg, warn, planned}
  //   ing: [{n,h,q,u}] scaled ingredient list (or null)
  //   effKg: target finished yield in kg (null if legacy fallback)
  //   warn: 'no_base_yield' | null — recipe missing base_yield.kg (needs SOP fix)
  //   planned: true if chef set an explicit plan; false if auto-defaulted from base_yield — pax
  const evById = useMemo(()=>Object.fromEntries((evList||[]).map(e=>[e.id,e])),[evList]);
  function getScaledIngredients(dishName, evOrId, opts){
    opts = opts || {};
    // 9C — bg pseudo-dishes bypass pax scaling; totalKg is authoritative
    if (opts.overrideKg && opts.overrideKg > 0) {
      const ing = getIngrForYield(dishName, opts.overrideKg);
      if (ing && ing.length) return { ing, effKg: opts.overrideKg, warn: null, planned: true };
      // Fallback if bg recipe missing base_yield: still return the pax-scaled version
      // as a last-ditch; will be less accurate but non-empty.
      const fbIng = getIngrForDish(dishName, 300);
      return { ing: fbIng, effKg: null, warn: 'bg_no_yield', planned: false };
    }
    const ev = typeof evOrId === "string" ? evById[evOrId] : evOrId;
    const rec = findRecipeForDish(dishName);
    const baseKg = rec?.ingredients?.base_yield?.kg || null;
    const basePax = rec?.ingredients?.base_pax || 300;
    const mult = Number(ev?.yield_multiplier) || 1.0;
    const evPax = Number(ev?.pax) || 0;
    // Yield-based path (preferred): base_yield.kg is set on the recipe
    if(baseKg){
      const planRow = evPlanRows?.[ev?.id]?.[dishName] || null;
      const planned = Number(planRow?.target_yield_kg) || null;
      const sectionYieldsPlan = planRow?.section_yields || null;
      // Default when chef hasn't planned: base_yield — pax ratio (preserves prior auto-pax behavior)
      const defaultYield = evPax > 0 ? (baseKg * evPax / basePax) : baseKg;
      // Pin (planned) is authoritative — slider only scales auto-computed defaults
      const effKg = planned ? planned : (defaultYield!=null ? defaultYield * mult : null);
      // Build per-section factors when both SOP and plan define section yields
      let sectionFactors = null;
      if(sectionYieldsPlan){
        const recSections = (rec.ingredients.items||[]).filter(i=>i.isSection && i.yield?.kg>0);
        const acc = {};
        recSections.forEach(sec=>{
          const planKg = Number(sectionYieldsPlan[sec.name]);
          if(planKg>0 && sec.yield.kg>0) acc[sec.name] = (planKg * mult) / sec.yield.kg;
        });
        if(Object.keys(acc).length>0) sectionFactors = acc;
      }
      const ing = getIngrForYield(dishName, effKg, sectionFactors);
      if(ing && ing.length) return {ing, effKg, warn:null, planned:!!planned};
    }
    // Fallback: no base_yield configured — legacy pax-based scaling, multiplier applied as pax bump
    const adjPax = Math.round(evPax * mult);
    const ing = getIngrForDish(dishName, adjPax || evPax);
    if(ing && ing.length) return {ing, effKg:null, warn: baseKg ? null : 'no_base_yield', planned:false};
    return {ing:null, effKg:null, warn:null, planned:false};
  }

  // `icon` names map to the inline-SVG set in KitchenUI.jsx — see PATHS there.
  const TABS=[
    // "Event Day" (capital D) is the key that exists in the Hindi dict —
    // the old "Event day" fell through untranslated.
    {v:"today",   l:T2("Event Day"),  icon:"calendar"},
    {v:"d1",      l:T2("Prep Day"),   icon:"clipboard"},
    // {v:"scaling", ...} — REMOVED in Phase 3: merged into Planning tab (multiplier slider now lives there)
    {v:"sops",    l:T2("SOPs"),       icon:"book"},
    {v:"planning",l:T2("Planning"),   icon:"layers"},
    {v:"analytics",l:T2("Analytics"), icon:"chart"},
    {v:"closing", l:T2("Closing"),    icon:"check"},
  ];
  const TABS_FILTERED = isSectionUser
    ? TABS.filter(t => ['today','d1','sops','closing'].includes(t.v))
    : TABS;

  // -- Inline dish card (shows live progress) --

  return(
    // .kh-scope activates the Kitchen Hub design system (hover states, focus
    // ring, responsive grids) defined in utils/theme.js. Scoped so no other
    // screen is affected.
    //
    // The hub fills the shell's content box and scrolls INSIDE itself: banners
    // and the tab strip sit in the fixed top block, only the panel below moves.
    // height:100% resolves because the shell's content box is a flex item with
    // a definite height; where it is not (DeptView's ODC embed) it falls back
    // to auto and the page simply scrolls as one, which is the old behaviour.
    <div className="kh-scope" style={{position:"relative",display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>

      {/* Which functions to reset. Body is built at render time, not stored in
          state, so the checkboxes reflect the current selection. */}
      <KModal
        open={!!resetPick}
        toneName="danger"
        iconTone="brand"
        icon="layers"
        title={T2("Which functions do you want to reset?")}
        confirmLabel={`${T2("Delete")} (${resetSel.length})`}
        confirmIcon="trash"
        cancelLabel={T2("Cancel")}
        subhead={resetPick && (
          // The day is the same for every row (the picker is scoped to the
          // active tab's date), so it is stated once here rather than repeated
          // on each line.
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{...type.label,color:K.sbLabel}}>
              {resetSel.length} {resetSel.length!==1?T2("functions"):T2("function")} {T2("selected")}
            </span>
            <span style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:6,
              padding:"5px 12px",borderRadius:K.rPill,background:K.brandBg,
              border:`1px solid ${K.brandBorder}`,color:K.brandText,fontSize:12.5,fontWeight:600}}>
              <Icon name="calendar" size={13} strokeWidth={2}/>{resetPick.evs[0]?._label} · {resetPick.day}
            </span>
          </div>
        )}
        onClose={()=>setResetPick(null)}
        confirmDisabled={resetSel.length===0}
        onConfirm={()=>{
          const evs = resetPick.evs;
          const ids = evs.filter(e=>resetSel.includes(e.id)).map(e=>e.id);
          // __combined_<date> holds the combined-view tracking for the whole day,
          // so only clear it when every function that day is selected — otherwise
          // resetting one function would wipe the others' combined data too.
          const allSelected = evs.every(e=>resetSel.includes(e.id));
          const targets = allSelected ? [...ids, "__combined_"+resetPick.day] : ids;
          runReset(targets, `${T2("Cleared")} ${ids.length} ${ids.length!==1?T2("functions"):T2("function")} — ${resetPick.day}.`);
        }}
        body={resetPick && (
          <div>
            {/* Caps the modal height on a day with many functions — the buttons
                must stay reachable without scrolling the whole dialog. */}
            <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:16,
              maxHeight:260,overflowY:"auto",paddingRight:2}}>
              {resetPick.evs.map(ev=>{
                const on = resetSel.includes(ev.id);
                return (
                  <button key={ev.id} type="button" className={"kh-pickrow kh-rip"+(on?" is-on":"")}
                    onPointerDown={ripple}
                    onClick={()=>setResetSel(p=>on?p.filter(x=>x!==ev.id):[...p,ev.id])}
                    style={{display:"flex",alignItems:"center",gap:14,padding:"13px 15px",borderRadius:K.rLg,cursor:"pointer",textAlign:"left",
                      transition:"background .16s ease, border-color .16s ease",
                      background:on?K.brandBg:K.surface,border:`1px solid ${on?K.brandBorder:K.modalLine}`}}>
                    <span style={{width:26,height:26,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                      transition:"background .16s ease, border-color .16s ease",
                      border:`1.5px solid ${on?K.brand:K.lineStrong}`,background:on?K.brand:K.surface,color:"#fff"}}>
                      {on && <Icon name="check" size={15} strokeWidth={2.6}/>}
                    </span>
                    <span style={{minWidth:0,flex:1}}>
                      <span style={{display:"block",fontSize:15,fontWeight:700,color:K.hdrTitle,letterSpacing:"-.1px"}}>{ev.guest||T2("Function")}</span>
                      <span style={{display:"block",fontSize:13,color:K.hdrMeta,marginTop:2}}>
                        {ev.pax} pax{ev.time?` · ${ev.time}`:""}
                      </span>
                    </span>
                    {/* Service time, repeated as a glyph — reads as "this is a
                        timed function" at a glance without another text column. */}
                    <span style={{width:34,height:34,borderRadius:K.rPill,flexShrink:0,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      background:on?K.surface:K.brandSoft,border:`1px solid ${on?K.brandBorder:K.modalLine}`,color:K.brand}}>
                      <Icon name="clock" size={17} strokeWidth={1.9}/>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Only the consequence is red — the picker itself stays on-theme. */}
            <div style={{display:"flex",alignItems:"center",gap:13,padding:"14px 16px",borderRadius:K.rLg,
              background:K.dangerBg,border:`1px solid ${K.dangerBorder}`}}>
              <span style={{width:40,height:40,borderRadius:K.rPill,flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                background:"rgba(217,70,63,.13)",color:K.danger}}>
                <Icon name="alert" size={20} strokeWidth={1.9}/>
              </span>
              <span style={{fontSize:13.5,color:"#B0322C",lineHeight:1.5}}>
                {T2("This permanently deletes step timers, selfies and completion status for the selected functions. This cannot be undone.")}
              </span>
            </div>
          </div>
        )}
      />

      {/* One state, two presentations. A notice — no onConfirm, so its only
          button was "Done" — is a RESULT, and a result does not deserve a modal
          that blocks the screen until you dismiss it. Those become toasts.
          Anything that asks a question keeps the dialog. Splitting on
          `onConfirm` means every existing call site is routed correctly without
          being touched. */}
      <KToast
        open={!!resetModal && !resetModal.onConfirm}
        toneName={resetModal?.tone}
        icon={resetModal?.icon}
        title={resetModal?.title}
        subhead={resetModal?.subhead}
        body={resetModal?.body}
        onClose={()=>setResetModal(null)}
      />

      <KModal
        open={!!resetModal && !!resetModal.onConfirm}
        toneName={resetModal?.tone}
        icon={resetModal?.icon}
        title={resetModal?.title}
        subhead={resetModal?.subhead}
        body={resetModal?.body}
        confirmLabel={resetModal?.confirmLabel}
        cancelLabel={T2("Cancel")}
        onConfirm={resetModal?.onConfirm}
        onClose={()=>setResetModal(null)}
      />

      {/* Section tablet banner */}
      {sectionFilter && hasCats && (
        // Brand plate, not a per-category accent — this is chrome, and it was
        // the last thing on the tablet still picking its colour from whichever
        // station the device happens to be assigned to.
        <div className="kh-cardart" style={{backgroundColor:K.surface,border:`1px solid ${K.hdrLine}`,borderLeft:`4px solid ${K.brand}`,
          borderRadius:K.rLg,padding:'15px 18px',marginBottom:14,boxShadow:K.shadowCard}}>
          {/* A real heading, not a micro-label. At 10.5px uppercase this was the
              quietest thing on a screen whose whole point is telling the tablet
              which stations it is responsible for. */}
          <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:12}}>
            <span style={{width:52,height:52,borderRadius:16,flexShrink:0,background:K.hdrBadge,color:K.hdrBadgeIcon,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon name="layers" size={26} strokeWidth={1.8}/>
            </span>
            <div style={{minWidth:0,flex:1}}>
              <div style={{...type.pageTitle,fontSize:28,color:K.hdrTitle}}>{T2("Your stations")}</div>
              <div style={{fontSize:14,color:K.hdrMeta,marginTop:3}}>{T2("Showing only your assigned categories")}</div>
            </div>
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,
              minWidth:34,height:34,padding:'0 11px',borderRadius:K.rPill,
              background:K.brandBg,border:`1px solid ${K.brandBorder}`,color:K.brand,
              fontSize:15,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{sectionCatNames.length}</span>
          </div>
          {/* One chip per station. A single joined line of eleven names was a
              wall of text nobody could pick their own station out of. */}
          <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
            {sectionCatNames.map((n,i)=>(
              <span key={i} style={{display:'inline-flex',alignItems:'center',padding:'5px 12px',borderRadius:K.rPill,
                background:K.brandBg,border:`1px solid ${K.brandBorder}`,color:K.brandText,
                fontSize:12.5,fontWeight:600,whiteSpace:'nowrap'}}>{n}</span>
            ))}
          </div>
        </div>
      )}

      {/* -- Chef Photo Modal -- */}
      {readyModal&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(12,20,16,.62)",display:"flex",alignItems:"center",justifyContent:"center",padding:12,overflowY:"auto"}}>
          <div style={{background:C.surface,borderRadius:20,padding:"22px 20px",maxWidth:420,width:"100%",border:`2px solid ${C.greenBorder}`,boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
            <div style={{textAlign:"center",marginBottom:14}}>
              <div style={{fontSize:28,marginBottom:6}}>🎉</div>
              <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>{T2("Dish Ready!")}</div>
              <div style={{fontSize:13,color:C.gold,marginTop:3,fontWeight:600}}>{dishLabel(readyModal.dishName, lang)}</div>
            </div>
            {/* Selfie section */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>📷 {T2("Dish Photo")} <span style={{color:C.red}}>*</span></div>
            <div style={{borderRadius:12,overflow:"hidden",background:"#000",marginBottom:10,minHeight:160,position:"relative"}}>
              {!readyPhoto?<video ref={readyVidRef} autoPlay playsInline muted style={{width:"100%",height:160,objectFit:"cover",display:"block"}}/>
                          :<img src={readyPhoto} alt="dish" style={{width:"100%",height:160,objectFit:"cover",display:"block"}}/>}
              {!readyCamOn&&!readyPhoto&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:13}}>📷 {T2("Starting camera…")}</div>}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {!readyPhoto
                ?<button onClick={()=>{const s=snapReady();if(s){setReadyPhoto(s);stopReadyCam();}}} style={{flex:1,padding:"10px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:42}}>📸 {T2("Capture Photo")}</button>
                :<button onClick={()=>{setReadyPhoto(null);sigClear();startReadyCam();}} style={{flex:1,padding:"10px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:42}}>🔄 {T2("Retake")}</button>
              }
            </div>
            {/* Signature section */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>✍️ {T2("Chef Signature")} <span style={{color:C.muted,fontWeight:400}}>(optional)</span></div>
            <div style={{border:`2px solid ${readySig?C.goldBorder:C.border}`,borderRadius:10,overflow:"hidden",background:"#fff",marginBottom:6,touchAction:"none"}}>
              <canvas ref={sigCanvasRef} width={380} height={120}
                style={{display:"block",width:"100%",height:120,cursor:"crosshair",touchAction:"none"}}
                onMouseDown={sigStart} onMouseMove={sigMove} onMouseUp={sigEnd} onMouseLeave={sigEnd}
                onTouchStart={sigStart} onTouchMove={sigMove} onTouchEnd={sigEnd}
              />
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontSize:11,color:C.muted}}>{readySig?"? Signed":"Draw signature above"}</span>
              <button onClick={sigClear} style={{padding:"4px 12px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer"}}>Clear</button>
            </div>
            {/* Submit */}
            <div style={{display:"flex",gap:10}}>
              <button disabled={!readyPhoto} onClick={()=>{
                const {evId,idx}=readyModal;
                const now=fmtStamp();
                setDs(evId,idx,{ready:true,readyAt:now,readyPhoto:readyPhoto||null,selfie:readyPhoto||null,signature:readySig||null,completedBy:currentUser?.name||"Chef",completedAt:now},readyModal);
                logActivity('kitchen', 'Dish ready: '+readyModal.dishName, 'dish_complete', {evId:evId, dish:readyModal.dishName, chef:currentUser?.name||'Chef'}, currentUser?.id);
                stopReadyCam();setReadyModal(null);setReadyPhoto(null);setReadySig(null);sigClear();
              }} style={{flex:1,padding:"14px",borderRadius:12,background:readyPhoto?`linear-gradient(135deg,${C.green},#147A54)`:`${C.border}`,color:readyPhoto?"#fff":C.faint,border:"none",fontSize:14,fontWeight:700,cursor:readyPhoto?"pointer":"not-allowed",minHeight:50,fontFamily:"var(--font-display)",letterSpacing:.5}}>
                ? {T2("Confirm Ready")}
              </button>
              <button onClick={()=>{stopReadyCam();setReadyModal(null);setReadyPhoto(null);setReadySig(null);sigClear();}} style={{padding:"14px 16px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer",minHeight:50}}>?</button>
            </div>
          </div>
        </div>
      )}


      {/* -- SOP Add/Edit Modal -- */}
      {sopModal&&!editingSteps&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(12,20,16,.55)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 12px",overflowY:"auto"}}>
          <div style={{background:C.surface,borderRadius:18,padding:"22px 20px",maxWidth:540,width:"100%",border:`2px solid ${C.goldBorder}`,boxShadow:"0 24px 60px rgba(0,0,0,.5)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:17,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{sopModal.mode==="edit"?"✏️ Edit Recipe SOP":"➕ Add Recipe SOP"}</div>
              <button onClick={()=>setSopModal(null)} style={{padding:"6px 12px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer"}}>?</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.muted,display:"block",marginBottom:4}}>Recipe Name *</label>
                <input value={sopForm.name} onChange={e=>setSopForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Paneer Tikka" style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,boxSizing:"border-box",minHeight:42}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.muted,display:"block",marginBottom:4}}>Sub-label</label>
                <input value={sopForm.sub} onChange={e=>setSopForm(p=>({...p,sub:e.target.value}))} placeholder="Hot / Cold / Dry" style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,boxSizing:"border-box",minHeight:42}}/>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:700,color:C.muted,display:"block",marginBottom:4}}>Category *</label>
              <select value={sopForm.catId} onChange={e=>setSopForm(p=>({...p,catId:e.target.value}))} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,minHeight:42}}>
                {safeArr(RECIPE_DB.cats).map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:10,background:sopForm.bg?C.goldBg:C.bg,border:`1.5px solid ${sopForm.bg?C.goldBorder:C.border}`,cursor:"pointer",marginBottom:14}}>
              <input type="checkbox" checked={!!sopForm.bg} onChange={e=>setSopForm(p=>({...p,bg:e.target.checked}))} style={{width:18,height:18,accentColor:C.gold,cursor:"pointer"}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:sopForm.bg?C.gold:C.text}}>🥘 Base Gravy</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>Mark this recipe as a base gravy — it will be listed first in each section on Event Day and D-1 prep, right after ingredient collection.</div>
              </div>
            </label>
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Steps ({sopForm.steps.length})</div>
            <div style={{maxHeight:340,overflowY:"auto",marginBottom:12,border:`1px solid ${C.border}`,borderRadius:12,padding:8,background:C.bg}}>
              {sopForm.steps.map((step,si)=>(
                <div key={si} style={{padding:"10px 8px",borderBottom:si<sopForm.steps.length-1?`1px solid ${C.borderLight}`:"none",position:"relative"}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:C.gold,minWidth:20}}>{si+1}.</span>
                    <input value={step.t} onChange={e=>sopFormStep(si,"t",e.target.value)} placeholder="Step title" style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:36}}/>
                    <button onClick={()=>sopMoveStep(si,-1)} disabled={si===0} style={{padding:"4px 8px",borderRadius:6,background:C.darkCard,border:`1px solid ${C.border}`,color:si===0?C.faint:C.text,fontSize:12,cursor:si===0?"default":"pointer"}}>?</button>
                    <button onClick={()=>sopMoveStep(si,1)} disabled={si===sopForm.steps.length-1} style={{padding:"4px 8px",borderRadius:6,background:C.darkCard,border:`1px solid ${C.border}`,color:si===sopForm.steps.length-1?C.faint:C.text,fontSize:12,cursor:si===sopForm.steps.length-1?"default":"pointer"}}>?</button>
                    <button onClick={()=>sopRemoveStep(si)} style={{padding:"4px 8px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,cursor:"pointer"}}>?</button>
                  </div>
                  <textarea value={step.i} onChange={e=>sopFormStep(si,"i",e.target.value)} placeholder="Instructions (Hindi)" rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box",resize:"vertical",minHeight:44}}/>
                  <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
                    {!(step.subs&&step.subs.length>0)&&<div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:11,color:C.muted}}>?</span>
                      <input type="number" step="0.5" value={step.tm?Math.round(step.tm/60*10)/10:""} onChange={e=>sopFormStep(si,"tm",Math.round((parseFloat(e.target.value)||0)*60))} placeholder="min" style={{width:70,padding:"6px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:32}}/>
                      <span style={{fontSize:10,color:C.faint}}>min</span>
                    </div>}
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:11,color:C.muted}}>CCP</span>
                      <input value={step.ccp} onChange={e=>sopFormStep(si,"ccp",e.target.value)} placeholder="Critical control" style={{width:130,padding:"6px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:32}}/>
                    </div>
                    <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:11,color:step.d1?C.green:C.muted,fontWeight:step.d1?700:400}}>
                      <input type="checkbox" checked={step.d1} onChange={e=>sopFormStep(si,"d1",e.target.checked)} style={{accentColor:C.green}}/>
                      D-1 Prep
                    </label>
                  </div>
                  {(step.subs&&step.subs.length>0)&&(
                    <div style={{borderLeft:`2.5px solid ${C.gold}`,marginLeft:10,marginTop:8,paddingLeft:12}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.gold,marginBottom:6,textTransform:"uppercase",letterSpacing:.5,display:"flex",alignItems:"center",gap:6}}>Sub-steps ({step.subs.length}){step.d1&&<span style={{fontSize:9,color:C.green,fontWeight:600,background:C.greenBg,padding:"1px 6px",borderRadius:4,border:`1px solid ${C.greenBorder}`}}>D-1 inherited</span>}</div>
                      {step.subs.map((sb,sbi)=>(
                        <div key={sbi} style={{background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                            <span style={{fontSize:11,fontWeight:700,color:C.gold,minWidth:24}}>{si+1}{String.fromCharCode(97+sbi)}.</span>
                            <input value={sb.t} onChange={e=>sopEditSub(si,sbi,"t",e.target.value)} placeholder="Sub-step title" style={{flex:1,padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.bg,minHeight:32}}/>
                            <button onClick={()=>sopRemoveSub(si,sbi)} style={{width:24,height:24,borderRadius:5,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,cursor:"pointer",padding:0,flexShrink:0}}>?</button>
                          </div>
                          <textarea value={sb.i} onChange={e=>sopEditSub(si,sbi,"i",e.target.value)} placeholder="Instructions (Hindi)" rows={1} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg,boxSizing:"border-box",resize:"vertical",minHeight:32,marginBottom:4}}/>
                          <div style={{display:"flex",alignItems:"center",gap:6,background:C.bg,borderRadius:6,padding:"5px 10px",border:`1px solid ${C.borderLight}`,marginBottom:4}}>
                            <span style={{fontSize:11,color:C.amber,fontWeight:600}}>? Timer</span>
                            <input type="number" step="0.5" value={sb.tm?Math.round(sb.tm/60*10)/10:""} onChange={e=>sopEditSub(si,sbi,"tm",String(Math.round((parseFloat(e.target.value)||0)*60)))} placeholder="0" style={{width:56,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.amberBorder}`,fontSize:13,fontWeight:600,textAlign:"center",color:C.amber,background:"transparent",minHeight:28}}/>
                            <span style={{fontSize:11,color:C.faint}}>min</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:6,background:sb.ccp?C.redBg:C.bg,borderRadius:6,padding:"5px 10px",border:`1px solid ${sb.ccp?C.redBorder:C.borderLight}`}}>
                            <span style={{fontSize:11,color:C.red,fontWeight:700}}>🔴 CCP</span>
                            <input value={sb.ccp||""} onChange={e=>sopEditSub(si,sbi,"ccp",e.target.value)} placeholder="Critical control (optional)" style={{flex:1,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,minHeight:28}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={()=>sopAddSub(si)} style={{marginTop:6,padding:"5px 12px",borderRadius:6,background:C.goldBg,border:`1px dashed ${C.goldBorder}`,color:C.gold,fontSize:11,fontWeight:600,cursor:"pointer"}}>+ Add Sub-step</button>
                </div>
              ))}
            </div>
            <button onClick={sopAddStep} style={{width:"100%",padding:"10px",borderRadius:10,background:C.darkCard,border:`1px dashed ${C.border}`,color:C.gold,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:14,minHeight:40}}>+ Add Step</button>
            <div style={{display:"flex",gap:10}}>
              <button onClick={saveSop} style={{flex:1,padding:"14px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",minHeight:48}}>
                {sopModal.mode==="edit"?"💾 Update Recipe":"➕ Save Recipe"}
              </button>
              <button onClick={()=>setSopModal(null)} style={{padding:"14px 20px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer",minHeight:48}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* -- CSV IMPORT MODAL -- */}
      {csvImport&&(
        // Not KModal: that one takes a title, a body and one confirm. This has
        // two alternative actions, a file picker and a parse result, so it keeps
        // its own shell - built from the same tokens so it reads as the same
        // family of dialog.
        <div onClick={()=>setCsvImport(null)} style={{position:"fixed",inset:0,zIndex:9999,background:K.modalScrim,
          display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true"
            style={{position:"relative",background:K.modalBg,border:`1px solid ${K.modalLine}`,borderRadius:K.modalRadius,
              boxShadow:K.shadowLift,maxWidth:620,width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <ModalWatermark/>

            <div style={{position:"relative",zIndex:1,padding:"22px 24px",borderBottom:`1px solid ${K.brandBorder}`,
              background:K.brandSoft,display:"flex",alignItems:"center",gap:16}}>
              <span style={{width:52,height:52,borderRadius:16,flexShrink:0,background:K.brand,color:"#FFFFFF",
                border:"1px solid transparent",boxShadow:"0 4px 14px rgba(28,61,43,.26)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon name="note" size={24} strokeWidth={1.8}/>
              </span>
              <span style={{minWidth:0,flex:1,paddingRight:34}}>
                <span style={{display:"block",...type.sectionHead,fontSize:23,color:K.hdrTitle}}>{T2("Import Ingredients CSV")}</span>
                <span style={{display:"block",fontSize:13.5,color:K.hdrMeta,marginTop:2}}>{T2("Update ingredients for this recipe")}</span>
              </span>
              <button onClick={()=>setCsvImport(null)} aria-label={T2("Cancel")} className="kh-modal-x kh-rip" onPointerDown={ripple}
                style={{position:"absolute",top:18,right:18,width:34,height:34,borderRadius:K.rPill,background:K.surface,
                  border:`1px solid ${K.modalLine}`,color:K.textMuted,cursor:"pointer",padding:0,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon name="close" size={16} strokeWidth={2.1}/>
              </button>
            </div>

            <div style={{position:"relative",zIndex:1,padding:"20px 24px",overflowY:"auto",flex:1,minHeight:0}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                <span style={{fontSize:17,fontWeight:700,color:K.hdrTitle,letterSpacing:"-0.2px"}}>{csvImport.recipeName}</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 11px",borderRadius:K.rPill,
                  background:K.brandBg,border:`1px solid ${K.brandBorder}`,fontSize:12.5,fontWeight:700,color:K.brandText}}>
                  <Icon name="listCheck" size={13} strokeWidth={2}/>{csvImport.currentCount} {T2("items")}
                </span>
              </div>
              <div style={{fontSize:14.5,color:K.textBody,lineHeight:1.55}}>
                {T2("Download the current ingredients, edit in Excel or Sheets, then upload to replace all ingredients for this recipe.")}
              </div>
              <div style={{display:"inline-flex",alignItems:"center",gap:7,marginTop:10,padding:"5px 12px",borderRadius:K.rPill,
                background:K.warnBg,border:`1px solid ${K.warnBorder}`,fontSize:12.5,fontWeight:600,color:K.warn}}>
                <Icon name="users" size={13} strokeWidth={2}/>{T2("Quantities are at")} {csvImport.basePax} {T2("pax anchor")}
              </div>

              {/* Step one, and the whole row is the button — a single small link
                  inside a panel invites a miss. */}
              <button onClick={()=>csvDownloadFromRecipe(csvImport.recipe)} className="kh-btn kh-rip kh-pressrow is-sage" onPointerDown={ripple}
                style={{display:"flex",alignItems:"center",gap:16,width:"100%",textAlign:"left",marginTop:18,
                  padding:"16px 18px",borderRadius:16,background:K.sageBg,border:`1px solid ${K.sageBorder}`,
                  cursor:"pointer",fontFamily:K.fontBody,color:K.sage}}>
                <span style={{width:48,height:48,borderRadius:14,flexShrink:0,background:"#FFFFFF",color:K.sage,
                  border:`1px solid ${K.sageBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon name="note" size={22} strokeWidth={1.8}/>
                </span>
                <span style={{flex:1,minWidth:0}}>
                  <span style={{display:"block",fontSize:16,fontWeight:700,letterSpacing:"-0.2px",color:K.sageText}}>{T2("Download current CSV")}</span>
                  <span style={{display:"block",fontSize:13.5,color:K.sage,marginTop:2}}>{T2("Get the latest ingredients for this recipe")}</span>
                </span>
                {/* No trailing glyph here. The icon set has no download mark,
                    and a chevron in that position reads as a dropdown - it
                    suggested the row opens a menu rather than saving a file. */}
              </button>

              <div style={{display:"flex",alignItems:"center",gap:14,margin:"18px 0"}}>
                <span style={{flex:1,height:1,background:K.sageBorder}}/>
                <span style={{...type.label,fontSize:10.5,color:K.sageText,padding:"4px 12px",borderRadius:K.rPill,
                  background:K.sageBg,border:`1px solid ${K.sageBorder}`}}>{T2("or")}</span>
                <span style={{flex:1,height:1,background:K.sageBorder}}/>
              </div>

              {/* Dashed, because nothing has been picked yet. The native file
                  input is hidden behind its own label so the control can be
                  styled - the browser's default button cannot be. */}
              <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 18px",borderRadius:16,
                background:K.warnBg,border:`1.5px dashed ${K.warnBorder}`,flexWrap:"wrap"}}>
                <span style={{width:56,height:56,borderRadius:"50%",flexShrink:0,background:"#FFFFFF",color:K.warn,
                  border:`1px solid ${K.warnBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon name="box" size={24} strokeWidth={1.8}/>
                </span>
                <span style={{flex:"1 1 200px",minWidth:0}}>
                  <span style={{display:"block",fontSize:16,fontWeight:700,letterSpacing:"-0.2px",color:K.warn}}>{T2("Upload edited CSV")}</span>
                  <span style={{display:"block",fontSize:13.5,color:K.hdrMeta,marginTop:2}}>{T2("Choose a CSV file from your device to replace all ingredients.")}</span>
                  <span style={{display:"block",fontSize:12.5,color:K.warn,opacity:.85,marginTop:3}}>{T2("Only .csv files are supported.")}</span>
                </span>
                <span style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0}}>
                  <label className="kh-btn kh-rip kh-pressrow is-warn" onPointerDown={ripple}
                    style={{display:"inline-flex",alignItems:"center",gap:9,padding:"13px 20px",borderRadius:K.rPill,
                      background:"#FFFFFF",border:`1px solid ${K.warnBorder}`,boxShadow:K.shadowCard,
                      color:K.warn,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:K.fontBody}}>
                    <Icon name="store" size={16} strokeWidth={1.9}/>{T2("Choose file")}
                    <input type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={e=>{
                      const f=e.target.files?.[0]; if(!f) return;
                      const rd=new FileReader();
                      rd.onload=()=>{ const {items,warnings}=csvImportParse(rd.result); setCsvImport(p=>({...p,fileName:f.name,parsedItems:items,warnings})); };
                      rd.readAsText(f,'utf-8');
                    }}/>
                  </label>
                  <span style={{fontSize:12.5,color:csvImport.fileName?K.hdrMeta:K.textFaint,maxWidth:180,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {csvImport.fileName||T2("No file chosen")}
                  </span>
                </span>
              </div>

              {csvImport.parsedItems&&(
                <div style={{marginTop:16,padding:"14px 16px",borderRadius:14,background:"#FFFFFF",
                  border:`1px solid ${K.line}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,fontSize:14,fontWeight:700,color:K.hdrTitle}}>
                    <Icon name="check" size={15} strokeWidth={2.2} style={{color:K.ok}}/>
                    {T2("Found")} {csvImport.parsedItems.length} {T2("rows")}
                    <span style={{fontWeight:500,color:K.hdrMeta}}>
                      · {csvImport.parsedItems.filter(i=>!i.isSection).length} {T2("ingredients")}
                      {" + "}{csvImport.parsedItems.filter(i=>i.isSection).length} {T2("sections")}
                    </span>
                  </div>
                  {csvImport.warnings?.length>0&&(
                    <div style={{marginTop:11,padding:"11px 13px",borderRadius:11,background:K.warnBg,
                      border:`1px solid ${K.warnBorder}`,fontSize:13,color:K.warn,lineHeight:1.5}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,fontWeight:700,marginBottom:5}}>
                        <Icon name="alert" size={14} strokeWidth={2.1}/>{T2("Warnings")} ({csvImport.warnings.length})
                      </div>
                      {csvImport.warnings.map((w,i)=>(<div key={i}>· {w}</div>))}
                    </div>
                  )}
                  {/* Said plainly, because the import is destructive: the rows in
                      the file become the whole list. */}
                  <div style={{marginTop:11,fontSize:13,color:K.hdrMeta,lineHeight:1.5}}>
                    {T2("Replacing")} <b style={{color:K.hdrTitle}}>{csvImport.currentCount}</b> {T2("items with these")}
                    {" "}<b style={{color:K.hdrTitle}}>{csvImport.parsedItems.length}</b>. {T2("The current list is overwritten.")}
                  </div>
                </div>
              )}
            </div>

            <div style={{position:"relative",zIndex:1,padding:"18px 24px",borderTop:`1px solid ${K.modalLine}`,
              display:"flex",justifyContent:"flex-end",gap:12,flexWrap:"wrap"}}>
              <KButton icon="close" onClick={()=>setCsvImport(null)}
                style={{padding:"13px 24px",borderRadius:K.rPill,fontSize:14,background:K.surface,borderColor:K.modalLine}}>{T2("Cancel")}</KButton>
              <KButton variant="brand" icon="check" onClick={csvImportSave}
                disabled={!csvImport.parsedItems||csvImport.parsedItems.length===0}
                style={{padding:"13px 26px",borderRadius:K.rPill,fontSize:14}}>
                {csvImport.parsedItems&&csvImport.parsedItems.length>0
                  ? `${T2("Replace with")} ${csvImport.parsedItems.length} ${T2("items")}`
                  : T2("Upload & replace")}
              </KButton>
            </div>
          </div>
        </div>
      )}

      {/* -- MENU NOT BUILT WARNING (empty menu OR custom package unconfirmed) -- */}
      {(()=>{
        const menuIssues = [...todayEvs,...tomorrowEvs].filter(ev=>{
          if(ev.custom_menu_confirmed) return false;
          const pkg = (ev.menuPackage||ev.menu_package||"");
          const menuLen = Array.isArray(ev.menu) ? ev.menu.length : 0;
          return menuLen === 0 || /custom/i.test(pkg);
        });
        if(menuIssues.length===0) return null;
        return menuIssues.map(ev=>{
          const isToday = ev.date===TODAY;
          const menuLen = Array.isArray(ev.menu) ? ev.menu.length : 0;
          const pkg = (ev.menuPackage||ev.menu_package||"");
          const isCustom = /custom/i.test(pkg);
          const heading = menuLen===0 ? T2("No menu set — chef has nothing to prep") : T2("Custom menu — verify it's complete");
          const body = menuLen===0
            ? T2("Admin must build the menu in Menu Editor before any prep or cooking can start.")
            : T2("LMS marked this as a Custom menu with")+" "+menuLen+" "+T2("dish(es) — verify with admin that all dishes are correctly listed before cooking.");
          const pkgNote = (isCustom||!pkg) ? "" : " — "+T2("Package")+": "+pkg;
          return (
            <KBanner
              key={"menu-warn-"+ev.id}
              toneName="danger"
              icon="alert"
              style={{marginBottom:12}}
              title={`${heading} — ${ev.guest||T2("Function")} (${isToday?T2("today"):T2("tomorrow")})`}
              sub={`${ev.venue||""} — ${ev.date} — ${ev.pax} ${T2("pax")} — ${ev.time||"TBD"}${pkgNote} — ${body}`}
              right={
              currentUser&&currentUser.role==='admin'&&(
                <KButton variant="danger" size="sm" icon="check" onClick={function(){
                  // In-app dialog rather than window.confirm — and the result is
                  // reported too, which the browser confirm never did: a failed
                  // Supabase write used to be a silent alert behind the banner.
                  setResetModal({
                    tone:"warn", icon:"alert",
                    title:`${T2("Mark menu as built for")} "${ev.guest||T2("function")}"?`,
                    body:T2("This clears the warning banner. Only do this after confirming all dishes are correctly set in Menu Editor."),
                    confirmLabel:T2("Mark as built"),
                    onConfirm:function(){
                      setResetModal(null);
                      import('../lib/supabase.js').then(function(mod){
                        if(!mod.supabase){
                          setResetModal({tone:"danger",icon:"alert",title:T2("Not connected"),
                            body:T2("No database connection — try again once you are back online."),
                            confirmLabel:T2("Close")});
                          return;
                        }
                        mod.supabase.from('events').update({custom_menu_confirmed:true}).eq('id',ev.id).then(function(r){
                          if(r.error){
                            console.error(r.error);
                            setResetModal({tone:"danger",icon:"alert",title:T2("Could not save"),
                              body:String(r.error.message||r.error),confirmLabel:T2("Close")});
                          }else{
                            setResetModal({tone:"ok",icon:"check",title:T2("Menu marked as built"),
                              body:`${ev.guest||T2("Function")} — ${T2("the warning banner will clear on the next sync.")}`,
                              confirmLabel:T2("Done")});
                          }
                        });
                      });
                    },
                  });
                }}>{T2("Menu built")}</KButton>
              )}
            />
          );
        });
      })()}
      <KTabs
        items={TABS_FILTERED}
        value={tab}
        onChange={v=>setTab(s=>{if(s!==v&&(v==="d1"||s==="d1")){setD1View("all");setD1FnFilter("combined");}return v;})}
        right={<>
        {currentUser&&currentUser.role==='admin'&&(
          // Quiet by default. It is a rarely used destructive admin action, so
          // it sits as a small neutral chip and only turns red on hover — the
          // red outline made it compete with the tab strip it sits beside.
          <KButton variant="ghost" size="sm" icon="undo" title={T2("Reset current")}
            className="kh-btn-quietdanger"
            style={{borderRadius:K.rPill,color:K.textMuted,padding:"6px 13px"}}
            onClick={function(){
            // Recompute TODAY/TOMORROW FRESH at click time.
            // The module-load constants become stale if this tab has been open across midnight —
            // that is how July 15/16 kitchen_tracking data got nuked in one accidental Reset click.
            const _nowD = new Date();
            const TODAY_NOW = localDateStr(_nowD);
            const _tomD = new Date(_nowD); _tomD.setDate(_tomD.getDate()+1);
            const TOMORROW_NOW = localDateStr(_tomD);

            // Hard block: if module-load TODAY differs from real today, the whole session is
            // stale. Force reload rather than delete data belonging to yesterday.
            if(TODAY_NOW !== TODAY){
              setResetModal({
                tone:"warn", icon:"alert",
                title:T2("This tab is out of date"),
                body:`${T2("Opened on")} ${TODAY}, ${T2("but today is")} ${TODAY_NOW}.\n\n`+
                  T2("The date drifted across midnight. Reload before resetting, so data from the wrong day is never deleted."),
                confirmLabel:T2("Reload now"),
                onConfirm:()=>window.location.reload(),
              });
              return;
            }

            // "Reset current" resets the day you are actually looking at: Prep Day
            // works on tomorrow, every other tab on today. It used to wipe BOTH
            // days at once, which is why functions from another date showed up.
            const _all = safeArr(events);
            const isPrepTab = tab === "d1";
            const scopeDay  = isPrepTab ? TOMORROW_NOW : TODAY_NOW;
            const dayLabel  = isPrepTab ? T2("Tomorrow") : T2("Today");
            const scopeEvs  = _all.filter(e=>e.date===scopeDay);
            const evIds     = scopeEvs.map(e=>e.id);
            const targetIds = [...evIds, "__combined_"+scopeDay];
            if(evIds.length === 0){
              setResetModal({
                tone:"idle", icon:"calendar",
                title:T2("Nothing to reset"),
                body:`${T2("No functions on")} ${scopeDay}.`,
              });
              return;
            }
            const totalDishes = evIds.reduce((n, id)=>{
              const evObj = _all.find(e=>e.id===id);
              return n + (evObj ? menuArr(evObj).length : 0);
            }, 0);

            // More than one function that day: let the admin pick which, rather
            // than wiping all of them in one click.
            const pickEvs = scopeEvs.map(e=>({...e, _day:scopeDay, _label:dayLabel}));
            if(pickEvs.length > 1){
              setResetSel(pickEvs.map(e=>e.id));   // default: everything selected
              setResetPick({ evs:pickEvs, day:scopeDay });
              return;
            }

            // Single function — no point asking which one.
            setResetModal({
              tone:"danger", icon:"alert",
              title:T2("Delete kitchen tracking for this function?"),
              body:
                `${pickEvs[0]?.guest||T2("Function")} — ${pickEvs[0]?._day}\n`+
                `~${totalDishes} ${T2("dishes")}\n\n`+
                T2("This permanently deletes step timers, selfies and completion status. Other dates are not touched. This cannot be undone."),
              confirmLabel:T2("Delete"),
              onConfirm:()=>runReset(
                targetIds,
                `${T2("Cleared")} ${targetIds.length} ev_id ${T2("row(s) for")} ${TODAY_NOW} + ${TOMORROW_NOW}.`
              ),
            });
          }}>
            {T2("Reset current")}
          </KButton>
        )}
        </>}
      />

      {/* Everything below the tab strip is the only thing that scrolls.
          No mask/filter on this box: either would make it the containing block
          for the position:fixed modals nested inside it and trap them.
          The radius matters — cards scrolling out at the top edge are clipped by
          this box, and a square clip reads as a hard white bar across the page.
          Radius alone is safe; unlike mask/filter it traps nothing. */}
      <div className="kh-hubscroll" style={{flex:1,minHeight:0,overflow:"auto",scrollBehavior:"smooth",borderRadius:K.rXl}}>

      {/* --- EVENT DAY — only cooking/dispatch for today's functions --- */}
      {tab==="today"&&(
        hasTodayEvs?(
          <EventDayTab
            events={events}
            kitchenTracking={kitchenTracking}
            setKitchenTracking={setKitchenTracking}
            lang={lang}
            currentUser={currentUser}
            sectionFilter={sectionFilter}
            allowedCatIds={allowedCatIds}
            transportQueue={transportQueue}
            setTransportQueue={setTransportQueue}
            dishSignoff={dishSignoff}
            setDishSignoff={setDishSignoff}
            openCam={openCam}
            capturePhoto={capturePhoto}
            stopCam={stopCam}
            camOn={camOn}
            camRef={camRef}
            capRef={capRef}
            camStreamRef={camStreamRef}
            evPlanRows={evPlanRows}
            tick={tick}
            setTab={setTab}
            onBeforeDishDone={openUsageModal}
          />
        ):(
          <div style={{background:K.surface,border:`1px solid ${K.line}`,borderRadius:K.rLg,boxShadow:K.shadowCard,textAlign:"center",padding:"56px 20px"}}>
            <div style={{width:56,height:56,borderRadius:K.rLg,background:K.accentSoft,color:K.accent,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
              <span style={{fontSize:26}}>🍽️</span>
            </div>
            <div style={{fontSize:17,fontWeight:700,color:K.text,marginBottom:8}}>{T2("No event today")}</div>
            <div style={{fontSize:13,color:K.textMuted,marginBottom:20,lineHeight:1.6}}>{T2("Event day cooking tasks will appear here when there's a function scheduled for today.")}</div>
            {tomorrowEvs.length>0&&(
              <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:K.rMd,background:K.infoBg,border:`1px solid ${K.infoBorder}`,fontSize:12.5,color:K.info,fontWeight:600}}>
                <span>📅</span>
                <span>{T2("Next up")}: {tomorrowLabel} — {tomorrowEvs.map(e=>`${e.guest||"Function"} (${e.pax} pax)`).join(", ")}</span>
              </div>
            )}
            <div style={{marginTop:18,display:"flex",justifyContent:"center"}}>
              <KButton variant="accent" icon="clipboard" onClick={()=>setTab("d1")}>{T2("Go to Prep day")}</KButton>
            </div>
          </div>
        )
      )}
      {tab==="d1"&&(()=>{
        // D-1 logic: prep only for TOMORROW's events
        const d1Evs = tomorrowEvs;
        const d1Label = tomorrowLabel;
        const isCombined = d1FnFilter==="combined";
        const filteredEvs = isCombined ? d1Evs : d1Evs.filter(e=>e.id===d1FnFilter);
        const activeEv = !isCombined ? d1Evs.find(e=>e.id===d1FnFilter) : null;

        // ── Section-level "Collect from store" (D-1, scope: combined vs per-function) ──
        function ssReadD1(catId) {
          const _TOM = _freshTomorrow();
          const sK = "__sec_" + catId;
          if (isCombined) return kt["__combined_"+_TOM]?.[sK] || {};
          return activeEv ? (kt[activeEv.id]?.[sK] || {}) : {};
        }
        function ssWriteD1(catId, upd) {
          const _TOM = _freshTomorrow();
          const sK = "__sec_" + catId;
          setKitchenTracking(p => {
            const o = p && typeof p === "object" ? { ...p } : {};
            const scope = isCombined ? ("__combined_"+_TOM) : (activeEv ? activeEv.id : null);
            if (!scope) return o;
            // Same fix as EventDayTab's ssWrite: merge items_done against the
            // LATEST state rather than replacing it with a render-time snapshot,
            // or a second tick moments later undoes the first.
            o[scope] = { ...(o[scope] || {}), [sK]: mergeDishState(o[scope]?.[sK], upd) };
            return o;
          });
        }
        function aggSecIngredientsD1(dishes) {
          const bucket = {}; let totalKg = 0;
          // Unit families for merging kg↔gm and L↔ml on the same ingredient.
          // WEIGHT_G / VOLUME_ML = multiplier to normalize into grams / millilitres.
          const WEIGHT_G  = { g: 1, gm: 1, kg: 1000 };
          const VOLUME_ML = { ml: 1, l: 1000, L: 1000 };
          const familyOf = (u) => WEIGHT_G[u] != null ? 'w' : VOLUME_ML[u] != null ? 'v' : (u || '');
          const toBase   = (q, u) => (Number(q) || 0) * (WEIGHT_G[u] != null ? WEIGHT_G[u] : VOLUME_ML[u] != null ? VOLUME_ML[u] : 1);
          dishes.forEach(dish => {
            if (dish.eventDayOnly) return;
            const {ing, effKg} = getScaledIngredients(dish.name, dish.fEvId);
            if (effKg) totalKg += effKg;
            if (!ing) return;
            ing.filter(i => i.q > 0).forEach(i => {
              const fam = familyOf(i.u);
              // Bucket key is name|family so kg + gm collapse to one row, ml + L collapse, pcs stays separate
              const k = (i.n || "").toLowerCase().trim() + "|" + fam;
              if (!bucket[k]) bucket[k] = { n: i.n, h: i.h || "", fam: fam, _base: 0, u: i.u, q: 0 };
              else if (!bucket[k].h && i.h) bucket[k].h = i.h;
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
          return { items: Object.values(bucket).sort((a,b) => (a.n || "").localeCompare(b.n || "")), totalKg };
        }
        function renderSecStoreCardD1(catId, itemsList, secName, large) {
          const secStore = ssReadD1(catId);
          const ssStarted = !!secStore.start, ssDone = !!secStore.end;
          const ssEl = ssStarted && !ssDone ? Math.floor((Date.now() - secStore.start) / 1000) : 0;
          const ssOverdue = ssStarted && !ssDone && ssEl >= 1800;
          const agg = aggSecIngredientsD1(itemsList);
          const yieldLbl = agg.totalKg > 0 ? `${T2("target")} ${agg.totalKg.toFixed(1).replace(/\.0$/,"")} kg` : `${itemsList.length} ${T2("dishes")}`;
          return (
            <div style={{ padding: large?14:10, marginBottom: 10, borderRadius: 10, border: `2px solid ${ssDone?C.greenBorder:ssStarted?C.amberBorder:C.gold+"60"}`, background: ssDone?C.greenBg:ssStarted?C.amberBg:C.bg }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: large?36:30, height: large?36:30, borderRadius: 8, background: ssDone?C.green:ssStarted?C.amber:C.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: large?16:14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{ssDone?"✓":"🏪"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: large?16:13, fontWeight: 700, color: ssDone?C.green:ssStarted?C.amber:C.text }}>{T2("Collect from store")} — {T2(secName)}</div>
                  <div style={{ fontSize: large?13:11, color: C.muted }}>{T2("One lot for all")} {itemsList.length} {T2("dishes")} · 30m</div>
                </div>
                {!ssStarted && !ssDone && <button onClick={()=>ssWriteD1(catId, { start: Date.now() })} style={{padding:large?"12px 18px":"10px 14px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:large?14:12,fontWeight:700,cursor:"pointer",minHeight:large?46:40,flexShrink:0}}>▶️ {T2("Go Collect")}</button>}
                {/* Same rule as Event Day: Done closes the run and ticks every
                    row, so the list never reads 0% after it is finished. */}
                {ssStarted && !ssDone && <button onClick={()=>ssWriteD1(catId, { end: Date.now(), items_done: markAllCollected(agg.items) })} style={{padding:large?"12px 18px":"10px 14px",borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:large?14:12,fontWeight:700,cursor:"pointer",minHeight:large?46:40,flexShrink:0}}>✓ {T2("Done")}</button>}
              </div>
              {ssStarted && !ssDone && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: Math.min(100, Math.round(ssEl/1800*100)) + "%", background: ssOverdue?C.red:C.amber, borderRadius: 3, transition: "width 1s" }}/></div>
                  <div style={{ fontSize: 11, color: ssOverdue?C.red:C.amber, fontWeight: 700, marginTop: 3 }}>⏱ {Math.floor(ssEl/60)}m {ssEl%60}s / 30m{ssOverdue?` — ${T2("Overdue")}`:""}</div>
                </div>
              )}
              {agg.items.length > 0 && (() => {
                const itemsDone = secStore.items_done || {};
                // Key by (name, family) so kg↔gm flips don't lose collected
                // state. Shared with Event Day and with markAllCollected.
                const itemKey = storeItemKey;
                const collected = agg.items.filter(i => itemsDone[itemKey(i)]).length;
                const total = agg.items.length;
                const pct = total > 0 ? Math.round(collected / total * 100) : 0;
                // Send only the key that changed — rebuilding the whole map from
                // a render-time snapshot is what let one tick overwrite another.
                const toggle = (i) => {
                  const k = itemKey(i);
                  const cur = ssReadD1(catId).items_done || {};
                  ssWriteD1(catId, { items_done: { [k]: !cur[k] } });
                };
                // V74 — collapsible + searchable + categorized
                const listOpen = !!d1SecIngrOpen[catId];
                const searchQ  = (d1SecSearch[catId] || '').toLowerCase().trim();
                const sortMode = d1SecSort[catId] || 'qty';
                const filtered = searchQ ? agg.items.filter(i => (i.n || '').toLowerCase().includes(searchQ) || (i.h || '').toLowerCase().includes(searchQ)) : agg.items;
                const byCat = {};
                filtered.forEach(i => { const c = categorizeIngredient(i.n); (byCat[c] = byCat[c] || []).push(i); });
                Object.keys(byCat).forEach(c => {
                  byCat[c].sort((a, b) => sortMode === 'qty' ? (b._base || 0) - (a._base || 0) : (a.n || '').localeCompare(b.n || ''));
                });
                const orderedCats = INGR_CATEGORY_ORDER.filter(c => byCat[c] && byCat[c].length > 0);
                return (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.borderLight}` }}>
                    {/* Collapse toggle strip */}
                    <div onClick={() => setD1SecIngrOpen(p => ({ ...p, [catId]: !listOpen }))}
                         style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer" }}>
                      <span style={{ fontSize: 14 }}>{ssDone?"📊":"🧺"}</span>
                      <div style={{ fontSize: large?13:12, fontWeight: 700, color: ssDone?C.green:C.gold, whiteSpace: "nowrap" }}>
                        {collected} / {total} {T2("collected")}
                      </div>
                      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: pct + "%", background: pct === 100 ? C.green : C.gold, borderRadius: 3, transition: "width .3s" }}/>
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .5, whiteSpace: "nowrap" }}>{yieldLbl}</div>
                      <span style={{ fontSize: 12, color: C.muted, transition: "transform .15s", transform: listOpen ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}>▾</span>
                    </div>
                    {listOpen && (
                      <div style={{ marginTop: 10 }}>
                        {/* Search + sort */}
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                          <div style={{ flex: 1, position: "relative" }}>
                            <input placeholder={T2("Search ingredient…")} value={d1SecSearch[catId] || ''}
                                   onChange={e => setD1SecSearch(p => ({ ...p, [catId]: e.target.value }))}
                                   style={{ width: "100%", padding: "6px 10px 6px 28px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, color: C.text, boxSizing: "border-box" }} />
                            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.muted }}>🔍</span>
                          </div>
                          <select value={sortMode} onChange={e => setD1SecSort(p => ({ ...p, [catId]: e.target.value }))}
                                  style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, color: C.text, cursor: "pointer" }}>
                            <option value="qty">{T2("Qty (high → low)")}</option>
                            <option value="name">{T2("Name (A → Z)")}</option>
                          </select>
                        </div>
                        {/* Grouped list */}
                        {orderedCats.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 16, color: C.muted, fontSize: 12, fontStyle: "italic" }}>{T2("No matches")}</div>
                        ) : orderedCats.map(cat => (
                          <div key={cat} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 2px 4px", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: .5 }}>{T2(cat)}</span>
                              <span style={{ fontSize: 10, color: C.faint, fontWeight: 500 }}>{byCat[cat].length}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${large?200:160}px, 1fr))`, gap: 2 }}>
                              {byCat[cat].map((i, ii) => {
                                const done = !!itemsDone[itemKey(i)];
                                return (
                                  <div key={ii} onClick={() => toggle(i)} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                                    background: done ? C.greenBg : "transparent",
                                    transition: "background .15s"
                                  }}>
                                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                                      <div style={{ fontSize: large?13:12, color: done ? C.green : C.text, textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.n}</div>
                                      {i.h && <div style={{ fontSize: large?11:10, color: done ? C.faint : C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.h}</div>}
                                    </div>
                                    <div style={{ fontSize: large?13:12, fontWeight: 700, color: done ? C.green : C.text, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4, marginLeft: 6 }}>
                                      {done && <span style={{ color: C.green }}>✓</span>}
                                      {fmtQty(i)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        }

        // Build dishes — filtered by selected function or combined
        const byDishD1={};
        filteredEvs.forEach(ev=>{
          const sp=ev.special||"";
          const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
          menuArr(ev).forEach((name,idx)=>{
            if(getSectionForDish(name)==="Beverages"||isFruitSelectionDish(name)) return;
            if(allowedCatIds && !allowedCatIds.includes(getCatIdForDish(name))) return;
            if(!byDishD1[name])byDishD1[name]={sec:getSectionForDish(name),catId:getCatIdForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
            byDishD1[name].totalPax+=ev.pax||0;
            byDishD1[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
            if(isSpecial)byDishD1[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
          });
        });
        // TEMP: d1-based filtering disabled — all dishes flow through, all SOP steps shown regardless of day tagging.
        // Always group by SOP category
        const bySecD1={};
        Object.entries(byDishD1).forEach(([n,info])=>{
          const groupKey = info.catId || 'maincourse';
          if(!bySecD1[groupKey])bySecD1[groupKey]=[];
          bySecD1[groupKey].push({name:n,...info});
        });
        // 9C — Demand-driven bg injection: scan dishes for type='bg' rows,
        // sum kg per bg recipe, inject each summed bg as ONE pseudo-dish with totalKg.
        Object.keys(bySecD1).forEach(catId=>{
          const secDishes = bySecD1[catId];
          if (!secDishes || secDishes.length === 0) return;
          // {bgName: {totalKg, unit, refFns:Set<{evId,fn}>}}
          const bgDemand = {};
          secDishes.forEach(d=>{
            const rec = findRecipeForDish(d.name);
            if (!rec?.ingredients?.items?.length) return;
            const baseKg = rec.ingredients.base_yield?.kg || null;
            const ev = evById[d.fEvId];
            const mult = Number(ev?.yield_multiplier) || 1.0;
            const evPax = Number(ev?.pax) || 0;
            let bgs = [];
            if (baseKg) {
              const planRow = evPlanRows?.[ev?.id]?.[d.name] || null;
              const planned = Number(planRow?.target_yield_kg) || null;
              const defaultYield = evPax > 0 ? (baseKg * evPax / (rec.ingredients.base_pax||300)) : baseKg;
              const effKg = (planned || defaultYield) * mult;
              const sectionYieldsPlan = planRow?.section_yields || null;
              let sectionFactors = null;
              if (sectionYieldsPlan) {
                const recSections = (rec.ingredients.items||[]).filter(i=>i.isSection && i.yield?.kg>0);
                const acc = {};
                recSections.forEach(sec=>{
                  const planKg = Number(sectionYieldsPlan[sec.name]);
                  if(planKg>0 && sec.yield.kg>0) acc[sec.name] = (planKg * mult) / sec.yield.kg;
                });
                if (Object.keys(acc).length>0) sectionFactors = acc;
              }
              bgs = getBgDemandForYield(d.name, effKg, sectionFactors);
            } else {
              const adjPax = Math.round(evPax * mult);
              bgs = getBgDemandForDish(d.name, adjPax || evPax);
            }
            bgs.forEach(b=>{
              if (!b.bgName || b.qty <= 0) return;
              const key = b.bgName;
              if (!bgDemand[key]) bgDemand[key] = { totalKg: 0, unit: b.unit || 'kg', fns: [] };
              // V72: unit-aware conversion. kg/L → 1:1 (density assumption for chef
              // signal); gm → /1000; ml → /1000. Non-mass/volume units (pcs, slice,
              // tsp, tbsp, Bot, tin, bunch, dozen) are skipped from totalKg with
              // a one-time console warning per key.
              const bu = String(b.unit || 'kg').toLowerCase();
              const bq = Number(b.qty) || 0;
              let deltaKg = 0;
              if (bu === 'kg' || bu === 'l')       deltaKg = bq;
              else if (bu === 'gm' || bu === 'ml') deltaKg = bq / 1000;
              else {
                if (!bgDemand[key]._warned) {
                  console.warn(`[bg-demand] BG '${key}' uses non-mass/volume unit '${b.unit}' — skipped from totalKg`);
                  bgDemand[key]._warned = true;
                }
              }
              bgDemand[key].totalKg += deltaKg;
              (d.fns||[]).forEach(fn=>{
                if (!bgDemand[key].fns.some(x=>x.evId===fn.evId)) bgDemand[key].fns.push(fn);
              });
            });
          });
          const bgEntries = [];
          let fIdx = 9000;
          const anchor = secDishes[0];
          Object.keys(bgDemand).forEach(bgName=>{
            const dem = bgDemand[bgName];
            if (dem.totalKg <= 0) return;
            const bgRec = findRecipeForDish(bgName);
            if (!bgRec || !bgRec.bg) { console.warn('[bg-inject] not a bg recipe:', bgName); return; }
            bgEntries.push({
              name: bgName,
              sec: anchor.sec,
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
            bySecD1[catId] = [...bgEntries, ...secDishes];
          }
        });
        const allSecs = Object.keys(bySecD1).sort();

        const totalD1Done = Object.values(byDishD1).filter(d=>ds(d.fEvId,d.fIdx,d.name).mesaDone).length;
        const totalD1 = Object.keys(byDishD1).length;
        const totalD1Pax = filteredEvs.reduce((s,e)=>s+(+e.pax||0),0);
        const combinedPax = d1Evs.reduce((s,e)=>s+(+e.pax||0),0);

        return(
          <div>
            {/* Function selector — the same segmented strip Event Day uses: an
                ivory tray, a deep-green underline on the selected segment, and
                the fill-up animation on click. */}
            {d1Evs.length>1&&(()=>{
              const fillUp = (e) => {
                const el = e.currentTarget;
                const s = document.createElement("span");
                s.className = "kh-fillup";
                el.appendChild(s);
                s.addEventListener("animationend", () => s.remove());
              };
              const Seg = ({ segKey, sel, icon, title, meta, first, warn }) => (
                <button className={"kh-btn kh-seg"+(sel?" is-active":"")}
                  onClick={(e)=>{ fillUp(e); setD1FnFilter(segKey); }}
                  style={{
                    flex:"1 1 230px", minWidth:0, display:"flex", alignItems:"center", gap:14,
                    padding:"16px 20px", border:"none", borderLeft:first?"none":`1px solid ${K.lineSoft}`,
                    cursor:"pointer", textAlign:"left",
                    background:sel?K.segSelBg:"transparent",
                    boxShadow:sel?`inset 0 -3px 0 ${K.segSelBar}`:"none",
                  }}>
                  <span className="kh-seg-chip" style={{position:"relative",zIndex:1,width:44,height:44,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                    background:sel?K.segChipSelBg:K.segChipBg, color:sel?K.segSelBar:K.hdrMeta}}>
                    <Icon name={icon} size={20} strokeWidth={1.8}/>
                  </span>
                  <span style={{position:"relative",zIndex:1,minWidth:0}}>
                    <span style={{display:"flex",alignItems:"center",gap:6,fontSize:16,fontWeight:700,color:K.hdrTitle,minWidth:0}}>
                      <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</span>
                      {warn&&<span style={{color:K.warn,display:"flex",flexShrink:0}} title={T2("Menu not confirmed")}><Icon name="alert" size={14} strokeWidth={2.2}/></span>}
                    </span>
                    <span style={{display:"block",fontSize:13,color:K.hdrMeta,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{meta}</span>
                  </span>
                </button>
              );
              return (
                <div style={{display:"flex",flexWrap:"wrap",borderRadius:14,overflow:"hidden",border:`1px solid ${K.line}`,marginBottom:14,background:K.surface,boxShadow:K.shadowCard}}>
                  <Seg segKey="combined" sel={isCombined} first icon="layers"
                    title={T2("Combined")}
                    meta={`${combinedPax} pax · ${d1Evs.length} ${T2("functions")}`}/>
                  {d1Evs.map(ev=>(
                    <Seg key={ev.id} segKey={ev.id} sel={d1FnFilter===ev.id} icon="users"
                      warn={ev.venue==="Outdoor Catering (ODC)"&&!ev.odc_menu_confirmed}
                      title={ev.guest||T2("Function")}
                      meta={`${ev.pax} pax · ${ev.odc_location||ev.venue||""} · ${ev.time||"TBD"}`}/>
                  ))}
                </div>
              );
            })()}

            {/* Stats — the same tiles Event Day leads with, so the two tabs read
                as one screen rather than two different products. */}
            {(()=>{
              const pct=totalD1>0?Math.round(totalD1Done/totalD1*100):0;
              return(
                <div className="kh-stats" style={{marginBottom:14}}>
                  <KStat large={isSectionUser} icon="check"    toneName="ok"   value={totalD1Done}            label={T2("Prepped")} />
                  <KStat large={isSectionUser} icon="clock"    toneName="warn" value={Math.max(0,totalD1-totalD1Done)} label={T2("Pending")} />
                  <KStat large={isSectionUser} icon="utensils" toneName="idle" value={totalD1}                label={T2("Dishes")} />
                  <KStat large={isSectionUser} icon="users"    toneName="teal" value={(totalD1Pax||0).toLocaleString()} label={T2("Pax")} />
                  <KStat large={isSectionUser} icon="chart"    toneName={pct===100?"ok":pct>0?"warn":"idle"} value={pct+"%"} label={T2("Progress")} />
                </div>
              );
            })()}

            {/* Context line — who this prep is for */}
            {(()=>{
              const pct=totalD1>0?Math.round(totalD1Done/totalD1*100):0;
              const headerLabel = isCombined
                ? `${d1Label} ${T2("prep")} — ${T2("Combined")}`
                : `${d1Label} — ${activeEv?.guest||"Function"}`;
              return(
                // Progress and pax now live in the stat tiles above, so this is
                // just the context line: which functions this prep covers.
                <div className="kh-cardart" style={{backgroundColor:K.surface,border:`1px solid ${K.hdrLine}`,borderLeft:`4px solid ${K.brand}`,
                  borderRadius:K.rLg,padding:"14px 18px",marginBottom:14,boxShadow:K.shadowCard,
                  display:"flex",alignItems:"center",gap:13,flexWrap:"wrap"}}>
                  <span style={{width:38,height:38,borderRadius:12,flexShrink:0,background:K.hdrBadge,color:K.hdrBadgeIcon,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon name={isCombined?"layers":"users"} size={19} strokeWidth={1.85}/>
                  </span>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{...type.label,fontSize:10,color:K.sbLabel}}>{headerLabel}</div>
                    <div style={{fontSize:13,color:K.hdrMeta,marginTop:2,overflowWrap:"anywhere"}}>
                      {isCombined
                        ? d1Evs.map(e=>`${e.guest||T2("Function")} (${e.pax} pax · ${e.time||"TBD"})`).join("  ·  ")
                        : `${activeEv?.guest||""} · ${activeEv?.venue||""} · ${activeEv?.pax} pax · ${activeEv?.time||"TBD"}`}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* -- Section-wise view -- */}
            {isSectionUser ? (
            /* --- TABLET VIEW — large, chef-friendly --- */
            allSecs.length===0
              ? <div style={{padding:"40px 20px",textAlign:"center",borderRadius:14,border:`1.5px solid ${C.border}`,background:C.surface}}><div style={{fontSize:18,color:C.muted}}>🍳 {T2("No dishes to prep")}</div></div>
              : allSecs.map(sec=>{
                const secItems = bySecD1[sec]||[];
                const catObj2 = RECIPE_DB.cats.find(c=>c.id===sec);
                const m2 = {color:catObj2?.color||C.muted,icon:catObj2?.icon||"??"};
                const secOpen = isSecOpen("d1sec_"+sec);
                if(secItems.length===0) return null;
                const prepItems = secItems.filter(d=>!d.eventDayOnly);
                const eventOnlyCount = secItems.length - prepItems.length;
                const doneCount = prepItems.filter(d=>ds(d.fEvId,d.fIdx,d.name).mesaDone).length;
                const totalCount = secItems.length;
                const prepTotal = prepItems.length;
                const secPct = prepTotal>0?Math.round(doneCount/prepTotal*100):100;
                return(
                  <div key={sec} style={{marginBottom:14,borderRadius:14,border:`1.5px solid ${C.border}`,background:C.surface}}>
                    <div onClick={()=>toggleSec("d1sec_"+sec)} style={{padding:"18px 22px",cursor:"pointer",borderBottom:secOpen?`1.5px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:70}}>
                      <div style={{display:"flex",alignItems:"center",gap:14}}>
                        <div style={{width:46,height:46,borderRadius:12,background:m2.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{m2.icon}</div>
                        <div><div style={{fontSize:20,fontWeight:700,color:m2.color}}>{T2(catObj2?.name||sec)}</div><div style={{fontSize:14,color:C.muted}}>{totalCount} {T2("dishes")}{eventOnlyCount>0?` — ${eventOnlyCount} ${T2("event-day only")}`:""}</div></div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:14}}>
                        <div style={{padding:"6px 14px",borderRadius:10,background:m2.color+"18",fontSize:16,fontWeight:700,color:m2.color}}>{doneCount} / {prepTotal}</div>
                        <div style={{width:80,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:secPct+"%",background:m2.color,borderRadius:3,transition:"width .3s"}}/></div>
                        <span style={{fontSize:20,color:C.faint,transform:secOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}>?</span>
                      </div>
                    </div>
                    {secOpen&&<div style={{padding:"10px 14px 14px"}}>
                      {renderSecStoreCardD1(sec, secItems, catObj2?.name || sec, true)}
                      {[...secItems].sort((a,b)=>{const ab=findRecipeForDish(a.name)?.bg?1:0;const bb=findRecipeForDish(b.name)?.bg?1:0;return bb-ab;}).map((dish,di)=>{
                        const isDone = !!ds(dish.fEvId,dish.fIdx,dish.name).mesaDone;
                        // Dish tracking state + section-store completion, used by the
                        // "Mark prep done" gate further down. Both were referenced there
                        // but never declared in this scope (ReferenceError on expand).
                        const d2s = ds(dish.fEvId,dish.fIdx,dish.name);
                        const ssDone = !!ssReadD1(sec).end;
                        const cKey = `d1dish_${dish.name.replace(/\s/g,"_")}`;
                        const isExp = expandedDishes.has(cKey);
                        const sp = dish.specials&&dish.specials.length>0 ? dish.specials.map(s=>s.instruction).join(", ") : "";
                        const evOnly = !!dish.eventDayOnly;
                        return(
                          <div key={dish.name} style={{marginBottom:10,borderRadius:12,border:`1.5px solid ${evOnly?C.amberBorder:isDone?C.greenBorder:isExp?m2.color:C.border}`,background:C.surface,opacity:evOnly?0.85:1}}>
                            <div onClick={()=>toggleDish(cKey)} style={{padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:16,minHeight:64,background:evOnly?C.amberBg+"40":isDone?C.greenBg+"60":"transparent"}}>
                              <div style={{width:36,height:36,borderRadius:10,background:evOnly?C.amberBg:isDone?C.green:C.border,border:evOnly?`1px solid ${C.amberBorder}`:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16,fontWeight:700,color:evOnly?C.amber:isDone?"#fff":C.muted}}>{evOnly?"?":isDone?"?":di+1}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:18,fontWeight:600,color:isDone?C.green:C.text,textDecoration:isDone?"line-through":"none"}}>{dishLabel(dish.name, lang)}{dish.isBaseGravy&&<span style={{marginLeft:8,padding:"2px 8px",borderRadius:6,background:C.goldBg,border:`1px solid ${C.goldBorder}`,fontSize:12,color:C.gold,fontWeight:700}}>🥘 Base Gravy</span>}</div>
                                <div style={{fontSize:14,color:C.muted,marginTop:2}}>{dish.fns.length} {T2("event")}{dish.fns.length>1?"s":""}{evOnly&&<span style={{marginLeft:8,padding:"2px 8px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,fontSize:12,color:C.amber,fontWeight:600}}>? {T2("Event day only")}</span>}{sp?<span style={{marginLeft:8,padding:"2px 8px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,fontSize:12,color:C.red}}>? {sp}</span>:null}</div>
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:20,fontWeight:700,color:isDone?C.green:m2.color}}>{dish.totalPax}</div><div style={{fontSize:12,color:C.muted}}>pax</div></div>
                              <span style={{fontSize:18,color:C.faint,flexShrink:0}}>{isExp?"?":"?"}</span>
                            </div>
                            {isExp&&evOnly&&(
                              <div style={{padding:"20px 24px",borderTop:`1.5px solid ${C.border}`,background:C.bg,textAlign:"center"}}>
                                <div style={{fontSize:14,color:C.muted,padding:"12px 0"}}>? {T2("This dish has no D-1 prep steps.")}</div>
                                <div style={{fontSize:12,color:C.faint}}>{T2("All preparation happens on event day — see Event Day tab.")}</div>
                              </div>
                            )}
                            {isExp&&!evOnly&&(()=>{
                              const allStepsFn = getStepsForDish(dish.name);
                              const d1Only = allStepsFn; // TEMP: showing all steps regardless of d1 tag
                              const steps = d1Only.length>0?d1Only:[{t:"Mesa",i:"Wash, cut, measure all ingredients",tm:600,d1:true},{t:"Primary prep",i:"Prepare base masala / paste",tm:480,d1:true}];
                              return(
                                <div style={{padding:"12px 20px 20px",borderTop:`1.5px solid ${C.border}`}}>
                                  {(()=>{const pax=dish.totalPax||0;const {ing,effKg,warn,planned}=getScaledIngredients(dish.name,dish.fEvId);if(!ing||ing.length===0)return null;const yieldLbl=effKg?`${T2("target")} ${effKg.toFixed(1).replace(/\.0$/,"")} kg`:`${pax} pax`;return(
                                    <div style={{background:C.bg,borderRadius:10,padding:"12px 16px",marginBottom:14,border:`1px solid ${warn?C.redBorder:C.borderLight}`,opacity:0.85}}>
                                      {warn==='no_base_yield'&&<div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:8,padding:"6px 10px",background:C.redBg,borderRadius:8,border:`1px solid ${C.redBorder}`}}>⚠ {T2("Recipe missing base_yield — using legacy pax scaling. Chef must set base_yield in SOP.")}</div>}
                                      <div style={{fontSize:14,fontWeight:700,color:C.muted,marginBottom:8}}>📋 {T2("Ingredients for this dish")} — {yieldLbl}{planned?` — ${T2("planned")}`:effKg?` — ${T2("auto")}`:""}</div>
                                      <div style={{display:"flex",flexWrap:"wrap",gap:"6px 16px"}}>{ing.filter(i=>i.q>0).map((i,ii)=>(<span key={ii} style={{fontSize:14,color:C.text}}>{i.n}: <b style={{color:C.gold+"cc"}}>{fmtQty(i)}</b></span>))}</div>
                                    </div>);})()}
                                  <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>{T2("Steps")} — {steps.length}</div>
                                  {steps.map((step,si)=>{const d2d=ds(dish.fEvId,dish.fIdx,dish.name);const sk="step_"+si;const hasSubs=Array.isArray(step.subs)&&step.subs.length>0;
                                    const subsDone=hasSubs?step.subs.every((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])):false;
                                    const stS=!!(d2d.starts&&d2d.starts[sk]);const stM=hasSubs?subsDone:!!(d2d.manual&&d2d.manual[sk]);const stDone=stM;
                                    const stEl=stS?Math.floor((Date.now()-(d2d.starts[sk]||Date.now()))/1000):0;const stOverdue=stS&&step.tm&&stEl>=step.tm&&!stDone;const stRem=step.tm?Math.max(0,step.tm-stEl):0;const stPct2=step.tm>0?Math.min(100,Math.round(stEl/step.tm*100)):0;const pk="step_"+(si-1);
                                    const prevStepHasSubs=si>0&&Array.isArray(steps[si-1].subs)&&steps[si-1].subs.length>0;
                                    const prevD=true;
                                    return(
                                    <div key={si} style={{padding:"14px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",...(step.ccp&&!stDone?{background:C.redBg,borderLeft:`3px solid ${C.red}`,marginLeft:-12,paddingLeft:12,borderRadius:6}:{})}}>
                                      <div style={{display:"flex",gap:14,alignItems:"center"}}>
                                      <div style={{width:38,height:38,borderRadius:10,background:stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.darkCard,border:`2px solid ${stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:stDone||stS?"#fff":step.ccp?"#fff":C.muted,flexShrink:0}}>{stDone?"?":si+1}</div>
                                      <div style={{flex:1}}>
                                        <div style={{fontSize:16,fontWeight:600,color:stDone?C.green:stS?C.amber:C.text,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(step.t)}{hasSubs&&!stDone&&<span style={{fontSize:12,color:C.muted,marginLeft:8}}>({step.subs.filter((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])).length}/{step.subs.length})</span>}</div>
                                        {(()=>{const d2=cleanStepText(step.i||step.desc||"");const t2=cleanStepText(step.t);if(!d2||t2.includes(d2)||d2.includes(t2))return null;return <div style={{fontSize:13,color:C.muted,marginTop:2}}>{d2}</div>;})()}
                                        {step.ccp&&<div style={{fontSize:13,color:C.red,marginTop:3}}>🔴 {cleanStepText(step.ccp)}</div>}
                                        {!hasSubs&&stS&&!stDone&&step.tm>0&&<div style={{marginTop:6}}><div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,stPct2)+"%",background:stOverdue?C.red:C.amber,borderRadius:3,transition:"width 1s"}}/></div>{stOverdue?<div style={{fontSize:13,color:C.red,fontWeight:700,marginTop:3}}>? {T2("Overdue")} — {T2("tap Done")}</div>:<div style={{fontSize:13,color:C.amber,marginTop:3}}>? {Math.floor(stEl/60)}m {stEl%60}s — {Math.floor(stRem/60)}m left</div>}</div>}
                                        {!hasSubs&&stDone&&(()=>{const de=d2d.doneElapsed?.[sk];if(de==null||!step.tm){return <div style={{fontSize:13,color:C.green,marginTop:3}}>? done</div>;}const ov=de>step.tm;const un=de<step.tm;const df=Math.abs(de-step.tm);const dm=Math.floor(df/60);const dss=df%60;return <div style={{fontSize:13,color:ov?C.red:C.green,marginTop:3}}>? {Math.floor(de/60)}m{de%60>0?` ${de%60}s`:""} done{ov?<span style={{color:C.red,fontWeight:600}}> ⚠ +{dm>0?dm+"m ":""}{dss}s over</span>:un&&df>0?<span style={{color:C.green,fontWeight:600}}> ✓ {dm>0?dm+"m ":""}{dss}s under</span>:""}</div>;})()}
                                        {hasSubs&&stDone&&<div style={{fontSize:13,color:C.green,marginTop:3}}>? all sub-steps done</div>}
                                        {!hasSubs&&!stS&&!stDone&&step.tm>0&&<div style={{fontSize:13,color:C.faint,marginTop:3}}>? {fmtT(step.tm)}</div>}
                                      </div>
                                      <div style={{flexShrink:0}}>
                                        {!hasSubs&&stS&&!stDone&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sk]:el}},dish);}} style={{padding:"12px 18px",borderRadius:10,background:stOverdue?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48}}>{stOverdue?"?":"?"} {T2("Done")}</button>}
                                        {!hasSubs&&!stS&&!stDone&&step.tm>0&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={starts:{...(d2d.starts||{}),[sk]:Date.now()}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"12px 18px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48}}>? {Math.floor(step.tm/60)}m</button>}
                                        {!hasSubs&&!stS&&!stDone&&!step.tm&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sk]:0}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"12px 18px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48}}>?</button>}
                                        {hasSubs&&!stDone&&<span style={{fontSize:12,color:C.muted}}>?</span>}
                                        
                                        {stDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:false},starts:{...(d2d.starts||{}),[sk]:null}},dish);}} style={{padding:"6px 10px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:11,cursor:"pointer"}}>? Undo</button>}
                                      </div>
                                      </div>
                                      {hasSubs&&(
                                        <div style={{borderLeft:`2.5px solid ${stDone?C.green:stS?C.amber:C.gold}`,marginLeft:19,marginTop:10,paddingLeft:16,opacity:(stS||prevD||stDone)?1:0.5}}>
                                          {step.subs.map((sb,sbi)=>{
                                            const sbk=sk+"_sub_"+sbi;const sbDone=!!(d2d.manual&&d2d.manual[sbk]);
                                            const sbPrevD=true;
                                            const sbStarted=!!(d2d.starts&&d2d.starts[sbk]);
                                            const sbEl=sbStarted?Math.floor((Date.now()-d2d.starts[sbk])/1000):0;
                                            const sbOver=sbStarted&&sb.tm>0&&sbEl>=sb.tm&&!sbDone;
                                            const sbRem=sb.tm>0?Math.max(0,sb.tm-sbEl):0;
                                            const sbPct=sb.tm>0?Math.min(100,Math.round(sbEl/sb.tm*100)):0;
                                            const sbHasDoneEl=sbDone&&d2d.doneElapsed?.[sbk]!=null&&d2d.doneElapsed[sbk]>0&&sb.tm>0;
                                            const sbDE=d2d.doneElapsed?.[sbk]||0;const sbWasOver=sbHasDoneEl&&sbDE>sb.tm;const sbDiffSec=sbHasDoneEl?Math.abs(sbDE-sb.tm):0;
                                            return(
                                              <div key={sbi} style={{padding:"10px 0",borderBottom:sbi<step.subs.length-1?`1px solid ${C.borderLight}`:"none"}}>
                                                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                                                  <div style={{width:28,height:28,borderRadius:8,background:sbDone?C.green+"20":sbStarted?(sbOver?C.red+"20":C.amber+"20"):C.darkCard,border:`1.5px solid ${sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.muted,flexShrink:0,marginTop:1}}>{sbDone?"?":(si+1)+String.fromCharCode(97+sbi)}</div>
                                                  <div style={{flex:1,minWidth:0}}>
                                                    <div style={{fontSize:13,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.text,lineHeight:1.5,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.t)}</div>
                                                    {sb.i&&<div style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.i)}</div>}
                                                    {sbStarted&&!sbDone&&sb.tm>0&&<div style={{marginTop:4}}><div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,sbPct)+"%",background:sbOver?C.red:C.amber,borderRadius:3,transition:"width 1s"}}/></div>{sbOver?<div style={{fontSize:12,color:C.red,fontWeight:700,marginTop:3}}>? {T2("Overdue")} — {T2("tap Done")}</div>:<div style={{fontSize:12,color:C.amber,marginTop:3}}>? {Math.floor(sbEl/60)}m {sbEl%60}s — {Math.floor(sbRem/60)}m left</div>}</div>}
                                                    {sbDone&&sbHasDoneEl&&<div style={{fontSize:12,marginTop:3,color:sbWasOver?C.red:C.green}}>✓ {Math.floor(sbDE/60)}m{sbDE%60>0?` ${sbDE%60}s`:""}{sbWasOver?<span style={{fontWeight:600}}> ⚠ +{Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s over</span>:<span style={{fontWeight:600}}> ✓ {Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s under</span>}{d2d.manualAt?.[sbk]&&<span style={{color:C.muted,fontWeight:400}}> — {d2d.manualAt[sbk]}</span>}</div>}
                                                    {sbDone&&!sbHasDoneEl&&d2d.manualAt?.[sbk]&&<div style={{fontSize:12,color:C.green,marginTop:3}}>? {d2d.manualAt[sbk]}</div>}
                                                    {!sbDone&&!sbStarted&&sb.tm>0&&<div style={{fontSize:12,color:C.faint,marginTop:3}}>? {sb.tm>=60?Math.floor(sb.tm/60)+"m":sb.tm+"s"}</div>}
                                                  </div>
                                                  <div style={{flexShrink:0}}>
                                                    {!sbDone&&sbPrevD&&!sbStarted&&sb.tm>0&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{starts:{...(d2d.starts||{}),[sbk]:Date.now()}},dish);}} style={{padding:"8px 16px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#1A46C4)`,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>? {Math.floor(sb.tm/60)}m</button>}
                                                    {!sbDone&&sbPrevD&&!sbStarted&&!sb.tm&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:fmtStamp()}};if(sbi===step.subs.length-1){upd.doneElapsed={...(d2d.doneElapsed||{}),[sk]:d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0};}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>? {T2("Done")}</button>}
                                                    {!sbDone&&sbStarted&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sbk]?Math.floor((Date.now()-d2d.starts[sbk])/1000):0;const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sbk]:el}};if(sbi===step.subs.length-1){upd.doneElapsed[sk]=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"8px 16px",borderRadius:10,background:sbOver?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>{sbOver?"?":"?"} {T2("Done")}</button>}
                                                    
                                                    {sbDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sbk]:false},starts:{...(d2d.starts||{}),[sbk]:null}},dish);}} style={{padding:"4px 8px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:10,cursor:"pointer"}}>?</button>}
                                                  </div>
                                                </div>
                                              </div>);
                                          })}
                                        </div>
                                      )}
                                    </div>);})}
                                  {(()=>{if(isDone)return(<div style={{padding:"12px 0",textAlign:"center"}}><div style={{fontSize:14,color:C.green,fontWeight:700}}>✅ {T2("Prep complete")}{d2s.dishCompletedAt?" — "+fmtStamp(d2s.dishCompletedAt):""}</div></div>);const allSD=ssDone&&steps.every((step,si)=>{const sk="step_"+si;const hs=Array.isArray(step.subs)&&step.subs.length>0;if(hs)return step.subs.every((_,sbi)=>!!(d2s.manual&&d2s.manual[sk+"_sub_"+sbi]));return !!(d2s.manual&&d2s.manual[sk]);});if(!allSD)return(<div style={{padding:"12px 0",textAlign:"center"}}><div style={{padding:"14px",borderRadius:12,background:C.faint+"30",border:"1.5px dashed "+C.border,color:C.muted,fontSize:14}}>👉 {T2("Complete all steps to mark prep done")}</div></div>);const elapsed=d2s.dishStartedAt?Math.floor((Date.now()-d2s.dishStartedAt)/60000):0;return(<div>{elapsed>0&&<div style={{fontSize:13,color:C.muted,textAlign:"center",marginBottom:6}}>? {T2("Total time")}: {elapsed} min</div>}<button onClick={e=>{e.stopPropagation();openUsageModal(dish,dish.totalPax,true,()=>{setDs(dish.fEvId,dish.fIdx,{mesaDone:true,dishCompletedAt:Date.now()},dish);});}} style={{width:"100%",padding:"16px",borderRadius:12,background:C.green,color:"#fff",border:"none",fontSize:18,fontWeight:700,cursor:"pointer",minHeight:56}}>? {T2("Mark prep done")} — {dish.totalPax} pax</button></div>);})()}
                                </div>);})()}
                            
                          </div>);
                      })}
                    </div>}
                  </div>);})
            ) : (
            /* --- ADMIN VIEW — compact --- */
            allSecs.map(sec=>{
              const secItems = bySecD1[sec]||[];
              const catObj = RECIPE_DB.cats.find(c=>c.id===sec);
              const secDisplayName = catObj ? catObj.name : sec;
              const m2 = {color:catObj?.color||C.muted,icon:catObj?.icon||"??"};
              const displayIcon = catObj?.icon || "??";
              const secOpen = isSecOpen("d1sec_"+sec);
              if(secItems.length===0) return null;
              const prepItemsA = secItems.filter(d=>!d.eventDayOnly);
              const doneCount = prepItemsA.filter(d=>ds(d.fEvId,d.fIdx,d.name).mesaDone).length;
              const totalCount = secItems.length;
              const prepTotal = prepItemsA.length;
              const secPct = prepTotal>0?Math.round(doneCount/prepTotal*100):100;
              return(
                <div key={sec} style={{marginBottom:8,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface}}>
                  <div onClick={()=>toggleSec("d1sec_"+sec)} style={{padding:"12px 16px",cursor:"pointer",borderBottom:secOpen?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16}}>{displayIcon}</span>
                      <span style={{fontSize:14,fontWeight:500,color:m2.color}}>{T2(secDisplayName)}</span>
                      <span style={{fontSize:12,color:C.muted}}>{totalCount} {T2("dishes")}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:12,fontWeight:500,color:m2.color}}>{doneCount} / {prepTotal}</span>
                      <div style={{width:60,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:secPct+"%",background:m2.color,borderRadius:2,transition:"width .3s"}}/></div>
                      <span style={{fontSize:14,color:C.faint,transform:secOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>?</span>
                    </div>
                  </div>
                  {secOpen&&<div style={{padding:"8px 12px"}}>
                    {renderSecStoreCardD1(sec, secItems, catObj?.name || sec, false)}
                    {[...secItems].sort((a,b)=>{const ab=findRecipeForDish(a.name)?.bg?1:0;const bb=findRecipeForDish(b.name)?.bg?1:0;return bb-ab;}).map(dish=>{
                      const dishName = dish.name;
                      const cKey = `d1dish_${dishName.replace(/\s/g,"_")}`;
                      const isExp = expandedDishes.has(cKey);
                      const allStepsFn = getStepsForDish(dishName);
                      const d1Only = allStepsFn; // TEMP: showing all steps regardless of d1 tag
                      const steps = d1Only.length>0?d1Only:[{t:"Mesa",i:"Wash, cut, measure all ingredients",tm:600,d1:true},{t:"Primary prep",i:"Prepare base masala / paste",tm:480,d1:true}];
                      const isDone = !!ds(dish.fEvId,dish.fIdx,dish.name).mesaDone;
                      return(
                        <div key={dishName} style={{marginBottom:6}}>
                          <div onClick={()=>toggleDish(cKey)} style={{cursor:"pointer",borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                            <div style={{padding:"10px 14px",background:isDone?C.greenBg:C.darkCard,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <div style={{width:18,height:18,borderRadius:5,background:isDone?C.green:C.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isDone&&<span style={{fontSize:9,fontWeight:700,color:"#fff"}}>?</span>}</div>
                                <div><div style={{fontSize:12,fontWeight:700,color:isDone?C.green:C.text,textDecoration:isDone?"line-through":"none"}}>{dishLabel(dishName, lang)}{dish.isBaseGravy&&<span style={{marginLeft:6,padding:"1px 6px",borderRadius:5,background:C.goldBg,border:`1px solid ${C.goldBorder}`,fontSize:9,color:C.gold,fontWeight:700}}>🥘 Base</span>}</div><div style={{fontSize:10,color:C.faint}}>{dish.totalPax} pax — {d1Label}</div></div>
                              </div>
                              <span style={{fontSize:12,color:C.muted}}>{isExp?"?":"?"}</span>
                            </div>
                          </div>

                          {isExp&&(()=>{
                            return(
                              <div style={{padding:"8px 12px",borderRadius:"0 0 10px 10px",background:C.surface,border:`1px solid ${C.border}`,borderTop:"none"}}>
                                {(()=>{const pax=dish.totalPax||0;const {ing,effKg,warn,planned}=getScaledIngredients(dishName,dish.fEvId);if(!ing||ing.length===0)return null;const yieldLbl=effKg?`${T2("target")} ${effKg.toFixed(1).replace(/\.0$/,"")} kg`:`${pax} pax`;return(
                                  <div style={{background:C.bg,borderRadius:8,padding:"8px 12px",marginBottom:8,border:`1px solid ${warn?C.redBorder:C.borderLight}`,opacity:0.85}}>
                                    {warn==='no_base_yield'&&<div style={{fontSize:9,fontWeight:700,color:C.red,marginBottom:5,padding:"3px 6px",background:C.redBg,borderRadius:5,border:`1px solid ${C.redBorder}`}}>? {T2("Missing base_yield in SOP")}</div>}
                                    <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5}}>📋 {T2("Ingredients for this dish")} — {yieldLbl}{planned?` — ${T2("planned")}`:effKg?` — ${T2("auto")}`:""}</div>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:"3px 10px"}}>{ing.filter(i=>i.q>0).map((i,ii)=>(<span key={ii} style={{fontSize:11,color:C.text}}>{i.n}: <b style={{color:C.gold+"cc"}}>{fmtQty(i)}</b></span>))}</div>
                                  </div>);})()}
                                <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>📋 {T2("Steps")} — {steps.length}</div>
                                {steps.map((step,si)=>{const d2d=ds(dish.fEvId,dish.fIdx,dish.name);const sk="step_"+si;const hasSubs=Array.isArray(step.subs)&&step.subs.length>0;
                                    const subsDone=hasSubs?step.subs.every((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])):false;
                                    const stS=!!(d2d.starts&&d2d.starts[sk]);const stM=hasSubs?subsDone:!!(d2d.manual&&d2d.manual[sk]);const stDone=stM;
                                    const stEl=stS?Math.floor((Date.now()-(d2d.starts[sk]||Date.now()))/1000):0;const stOverdue=stS&&step.tm&&stEl>=step.tm&&!stDone;const stRem=step.tm?Math.max(0,step.tm-stEl):0;const stPct2=step.tm>0?Math.min(100,Math.round(stEl/step.tm*100)):0;const pk="step_"+(si-1);
                                    const prevStepHasSubs=si>0&&Array.isArray(steps[si-1].subs)&&steps[si-1].subs.length>0;
                                    const prevD=true;
                                    return(
                                  <div key={si} style={{padding:"8px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",...(step.ccp&&!stDone?{background:C.redBg,borderLeft:`3px solid ${C.red}`,marginLeft:-8,paddingLeft:8,borderRadius:4}:{})}}>
                                    <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                                    <div style={{width:26,height:26,borderRadius:7,background:stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.darkCard,border:`2px solid ${stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:stDone||stS?"#fff":step.ccp?"#fff":C.muted,flexShrink:0,marginTop:2}}>{stDone?"?":si+1}</div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,fontWeight:600,color:stDone?C.green:stS?C.amber:C.text,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(step.t)}{hasSubs&&!stDone&&<span style={{fontSize:10,color:C.muted,marginLeft:6}}>({step.subs.filter((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])).length}/{step.subs.length})</span>}</div>
                                      {(()=>{const d2=cleanStepText(step.i||step.desc||"");const t2=cleanStepText(step.t);if(!d2||t2.includes(d2)||d2.includes(t2))return null;return <div style={{fontSize:11,color:C.muted,marginTop:1}}>{d2}</div>;})()}
                                      {step.ccp&&<div style={{fontSize:10,color:C.red,marginTop:2}}>🔴 {cleanStepText(step.ccp)}</div>}
                                      {!hasSubs&&stS&&!stDone&&step.tm>0&&<div style={{marginTop:4}}><div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,stPct2)+"%",background:stOverdue?C.red:C.amber,borderRadius:2,transition:"width 1s"}}/></div>{stOverdue?<div style={{fontSize:10,color:C.red,fontWeight:700,marginTop:2}}>? Overdue — tap Done</div>:<div style={{fontSize:10,color:C.amber,marginTop:2}}>? {Math.floor(stEl/60)}m {stEl%60}s — {Math.floor(stRem/60)}m left</div>}</div>}
                                      {!hasSubs&&stDone&&(()=>{const de=d2d.doneElapsed?.[sk];if(de==null||!step.tm){return <div style={{fontSize:10,color:C.green,marginTop:2}}>? done</div>;}const ov=de>step.tm;const un=de<step.tm;const df=Math.abs(de-step.tm);const dm=Math.floor(df/60);const dss=df%60;return <div style={{fontSize:10,color:ov?C.red:C.green,marginTop:2}}>? {Math.floor(de/60)}m{de%60>0?` ${de%60}s`:""} done{ov?<span style={{color:C.red,fontWeight:600}}> ⚠ +{dm>0?dm+"m ":""}{dss}s over</span>:un&&df>0?<span style={{color:C.green,fontWeight:600}}> ✓ {dm>0?dm+"m ":""}{dss}s under</span>:""}</div>;})()}
                                      {hasSubs&&stDone&&<div style={{fontSize:10,color:C.green,marginTop:2}}>? all sub-steps done</div>}
                                      {!hasSubs&&!stS&&!stDone&&step.tm>0&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>? {fmtT(step.tm)}</div>}
                                    </div>
                                    <div style={{flexShrink:0}}>
                                      {!hasSubs&&stS&&!stDone&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sk]:el}},dish);}} style={{padding:"6px 10px",borderRadius:8,background:stOverdue?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",minHeight:32}}>{stOverdue?"?":"?"} Done</button>}
                                      {!hasSubs&&!stS&&!stDone&&step.tm>0&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={starts:{...(d2d.starts||{}),[sk]:Date.now()}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 10px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",minHeight:32}}>? {Math.floor(step.tm/60)}m</button>}
                                      {!hasSubs&&!stS&&!stDone&&!step.tm&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:fmtStamp()}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 10px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:10,fontWeight:600,cursor:"pointer",minHeight:32}}>?</button>}
                                      {hasSubs&&!stDone&&<span style={{fontSize:10,color:C.muted}}>?</span>}
                                      
                                      {stDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:false},starts:{...(d2d.starts||{}),[sk]:null}},dish);}} style={{padding:"4px 8px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:10,cursor:"pointer"}}>?</button>}
                                    </div>
                                    </div>
                                    {hasSubs&&(
                                      <div style={{borderLeft:`2.5px solid ${stDone?C.green:stS?C.amber:C.gold}`,marginLeft:13,marginTop:6,paddingLeft:12,opacity:(stS||prevD||stDone)?1:0.5}}>
                                        {step.subs.map((sb,sbi)=>{
                                          const sbk=sk+"_sub_"+sbi;const sbDone=!!(d2d.manual&&d2d.manual[sbk]);
                                          const sbPrevD=true;
                                          const sbStarted=!!(d2d.starts&&d2d.starts[sbk]);
                                          const sbEl=sbStarted?Math.floor((Date.now()-d2d.starts[sbk])/1000):0;
                                          const sbOver=sbStarted&&sb.tm>0&&sbEl>=sb.tm&&!sbDone;
                                          const sbRem=sb.tm>0?Math.max(0,sb.tm-sbEl):0;
                                          const sbPct=sb.tm>0?Math.min(100,Math.round(sbEl/sb.tm*100)):0;
                                          const sbHasDoneEl=sbDone&&d2d.doneElapsed?.[sbk]!=null&&d2d.doneElapsed[sbk]>0&&sb.tm>0;
                                          const sbDE=d2d.doneElapsed?.[sbk]||0;const sbWasOver=sbHasDoneEl&&sbDE>sb.tm;const sbDiffSec=sbHasDoneEl?Math.abs(sbDE-sb.tm):0;
                                          return(
                                            <div key={sbi} style={{padding:"8px 0",borderBottom:sbi<step.subs.length-1?`1px solid ${C.borderLight}`:"none"}}>
                                              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                                                <div style={{width:24,height:24,borderRadius:6,background:sbDone?C.green+"20":sbStarted?(sbOver?C.red+"20":C.amber+"20"):C.darkCard,border:`1.5px solid ${sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.muted,flexShrink:0,marginTop:1}}>{sbDone?"?":(si+1)+String.fromCharCode(97+sbi)}</div>
                                                <div style={{flex:1,minWidth:0}}>
                                                  <div style={{fontSize:12,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.text,lineHeight:1.5,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.t)}</div>
                                                  {sb.i&&<div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.i)}</div>}
                                                  {sbStarted&&!sbDone&&sb.tm>0&&<div style={{marginTop:3}}><div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,sbPct)+"%",background:sbOver?C.red:C.amber,borderRadius:2,transition:"width 1s"}}/></div>{sbOver?<div style={{fontSize:10,color:C.red,fontWeight:700,marginTop:2}}>? Overdue — tap Done</div>:<div style={{fontSize:10,color:C.amber,marginTop:2}}>? {Math.floor(sbEl/60)}m {sbEl%60}s — {Math.floor(sbRem/60)}m left</div>}</div>}
                                                  {sbDone&&sbHasDoneEl&&<div style={{fontSize:10,marginTop:2,color:sbWasOver?C.red:C.green}}>✓ {Math.floor(sbDE/60)}m{sbDE%60>0?` ${sbDE%60}s`:""}{sbWasOver?<span style={{fontWeight:600}}> ⚠ +{Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s over</span>:<span style={{fontWeight:600}}> ✓ {Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s under</span>}{d2d.manualAt?.[sbk]&&<span style={{color:C.muted,fontWeight:400}}> — {d2d.manualAt[sbk]}</span>}</div>}
                                                  {sbDone&&!sbHasDoneEl&&d2d.manualAt?.[sbk]&&<div style={{fontSize:10,color:C.green,marginTop:2}}>? {d2d.manualAt[sbk]}</div>}
                                                  {!sbDone&&!sbStarted&&sb.tm>0&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>? {sb.tm>=60?Math.floor(sb.tm/60)+"m":sb.tm+"s"}</div>}
                                                </div>
                                                <div style={{flexShrink:0}}>
                                                  {!sbDone&&sbPrevD&&!sbStarted&&sb.tm>0&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{starts:{...(d2d.starts||{}),[sbk]:Date.now()}},dish);}} style={{padding:"6px 12px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>? {Math.floor(sb.tm/60)}m</button>}
                                                  {!sbDone&&sbPrevD&&!sbStarted&&!sb.tm&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:fmtStamp()}};if(sbi===step.subs.length-1){upd.doneElapsed={...(d2d.doneElapsed||{}),[sk]:d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0};}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 12px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>? {T2("Done")}</button>}
                                                  {!sbDone&&sbStarted&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sbk]?Math.floor((Date.now()-d2d.starts[sbk])/1000):0;const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sbk]:el}};if(sbi===step.subs.length-1){upd.doneElapsed[sk]=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 12px",borderRadius:8,background:sbOver?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>{sbOver?"?":"?"} {T2("Done")}</button>}
                                                  
                                                  {sbDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sbk]:false},starts:{...(d2d.starts||{}),[sbk]:null}},dish);}} style={{padding:"3px 6px",borderRadius:5,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:9,cursor:"pointer"}}>?</button>}
                                                </div>
                                              </div>
                                            </div>);
                                        })}
                                      </div>
                                    )}
                                  </div>);})}
                                {(()=>{const d2f=ds(dish.fEvId,dish.fIdx,dish.name);const elapsed=d2f.dishStartedAt?Math.floor((Date.now()-d2f.dishStartedAt)/60000):0;return(<div>{elapsed>0&&<div style={{fontSize:10,color:C.muted,textAlign:"center",marginBottom:4}}>? {T2("Total time")}: {elapsed} min</div>}<button onClick={e=>{e.stopPropagation();openUsageModal(dish,dish.totalPax,true,()=>{setDs(dish.fEvId,dish.fIdx,{mesaDone:true,dishCompletedAt:Date.now()},dish);});}} style={{width:"100%",padding:"10px",borderRadius:8,background:C.green,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>? {T2("Mark prep done")} — {dish.totalPax} pax</button></div>);})()}
                              </div>);})()}
                        </div>
                      
                      );
                    })}
                  </div>}
                </div>
              );
            })
            )}
            {allSecs.length===0&&!isSectionUser&&<div style={{padding:"24px",textAlign:"center",borderRadius:10,border:`1px solid ${C.border}`,background:C.surface}}><div style={{fontSize:12,color:C.muted}}>{T2("No dishes to prep")}</div></div>}
          </div>
        );
      })()}

      {tab==="sops"&&(()=>{
        // Map section filter to relevant SOP category IDs
        const allowedCats = allowedCatIds;
        const filteredCats = allowedCats ? safeArr(RECIPE_DB.cats).filter(c=>allowedCats.includes(c.id)) : safeArr(RECIPE_DB.cats);

        // One Sort control, two places: beside the search on the category
        // overview, and in the toolbar once a category is open. Its three orders
        // mean different things in each, so the labels follow the view.
        // A plain function, not a component — a component declared inside render
        // is a new type every pass and would remount on every keystroke.
        const SORT_OPTS = sopCat
          ? [["name",T2("Name (A → Z)")],["most",T2("Most steps")],["least",T2("Fewest steps")]]
          : [["name",T2("Name (A → Z)")],["most",T2("Most recipes")],["least",T2("Fewest recipes")]];
        const sortMenu = () => (
          <div style={{position:"relative",flexShrink:0}}>
            <button className="kh-btn kh-rip" onPointerDown={ripple} onClick={()=>setSopSortOpen(o=>!o)}
              style={{display:"inline-flex",alignItems:"center",gap:9,padding:"12px 18px",borderRadius:K.rPill,
                background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,
                color:K.textBody,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:K.fontBody,whiteSpace:"nowrap"}}>
              <Icon name="sliders" size={17} strokeWidth={1.9}/>{T2("Sort")}
              <Icon name="chevronD" size={15} strokeWidth={2} style={{transform:sopSortOpen?"rotate(180deg)":"none",transition:"transform .18s"}}/>
            </button>
            {sopSortOpen&&(<>
              {/* Full-screen catcher so a click anywhere closes the menu without
                  wiring a document listener for one small menu. */}
              <div onClick={()=>setSopSortOpen(false)} style={{position:"fixed",inset:0,zIndex:20}}/>
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:21,minWidth:210,
                background:K.surface,border:`1px solid ${K.line}`,borderRadius:14,boxShadow:K.shadowLift,padding:5}}>
                {SORT_OPTS.map(([v,l])=>(
                  <button key={v} className="ash-menu-item kh-rip" onPointerDown={ripple}
                    onClick={()=>{setSopCatSort(v);setSopSortOpen(false);}}
                    style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"10px 12px",borderRadius:9,
                      border:"none",background:sopCatSort===v?K.brandBg:"transparent",
                      color:sopCatSort===v?K.brandText:K.textBody,fontSize:13,fontWeight:sopCatSort===v?700:500,
                      cursor:"pointer",textAlign:"left",fontFamily:K.fontBody}}>
                    <span style={{width:15,display:"flex",flexShrink:0,color:K.brand}}>
                      {sopCatSort===v&&<Icon name="check" size={15} strokeWidth={2.2}/>}
                    </span>
                    {l}
                  </button>
                ))}
              </div>
            </>)}
          </div>
        );

        return(
        <div>
          {/* The header band belongs to the category overview only. Inside a
              category the page already announces itself - the toolbar carries
              Back, the controls and the recipe count - and a second title bar
              above it just pushed the list down. */}
          {!sopCat&&(<>
          {/* Controls only — no badge, title or meta line. The tab strip above
              already says which screen this is, and the counts it carried are
              visible in the grid itself. */}
          <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap",marginBottom:18}}>

            {/* Left-aligned now that nothing sits to its left — pushed right it
                would hang off the edge of an empty row. */}
            <div style={{display:"flex",alignItems:"center",gap:12,flex:"1 1 380px",minWidth:0,justifyContent:"flex-start"}}>
              <div style={{position:"relative",flex:"0 1 340px",minWidth:0}}>
                <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:K.textFaint,display:"flex",pointerEvents:"none"}}>
                  <Icon name="search" size={16} strokeWidth={1.9}/>
                </span>
                <input value={sopSearch} onChange={e=>setSopSearch(e.target.value)}
                  placeholder={T2("Search recipes, categories…")}
                  // White, not the warm ivory the pills use. This field sits
                  // directly on the page artwork with no card behind it, and in
                  // ivory-on-ivory it read as background rather than as an input.
                  style={{width:"100%",padding:"11px 16px 11px 42px",borderRadius:K.rPill,border:`1px solid ${K.cardWarmLine}`,
                    fontSize:13.5,color:K.text,background:"#FFFFFF",boxSizing:"border-box",minWidth:190,
                    boxShadow:K.shadowCard,fontFamily:K.fontBody,outline:"none"}}/>
              </div>

              {sortMenu()}

            </div>
          </div>
          </>)}
          {!sopRecipe?(
            !sopCat?(
              (()=>{
                // Count once, then sort on it. The card shows the filtered count
                // while a search is running, so "most recipes" has to order by
                // what is actually on screen or the order contradicts the labels.
                // The box searches categories as well as recipes, as its
                // placeholder says. A category kept only because its NAME
                // matched still shows its full count, and opening it clears the
                // query — the detail view filters by recipe name, so the query
                // that found the category would otherwise land you on an empty
                // list of its own recipes.
                const q = sopSearch.trim().toLowerCase();
                const cards = filteredCats.map(cat=>{
                  const recipes = safeArr(RECIPE_DB.recipes[cat.id]);
                  const hits = q ? recipes.filter(r=>(r.n||"").toLowerCase().includes(q)) : recipes;
                  const nameHit = !!q && (cat.name||"").toLowerCase().includes(q);
                  const nameOnly = nameHit && hits.length===0;
                  return { cat, total: recipes.length, count: nameOnly?recipes.length:hits.length, nameOnly, keep: !q||nameHit||hits.length>0 };
                }).filter(c=>c.keep);
                cards.sort((a,b)=>
                  sopCatSort==="most"  ? b.count-a.count || (a.cat.name||"").localeCompare(b.cat.name||"") :
                  sopCatSort==="least" ? a.count-b.count || (a.cat.name||"").localeCompare(b.cat.name||"") :
                  (a.cat.name||"").localeCompare(b.cat.name||""));
                // Tints rotate by position so neighbouring circles differ.
                // Categories carry no colour of their own in RECIPE_DB. Pitched
                // a shade deeper than they would be on white — the card face is
                // warm ivory, and paler tints than this disappear into it.
                const TINTS = SOP_TINTS;
                return (
                <div className="kh-sopgrid">
                  {cards.map(({cat,total,count,nameOnly},ci)=>{
                    const isRenaming = renamingCatId===cat.id;
                    if (isRenaming) return (
                      <div key={cat.id} style={{backgroundColor:K.cardWarm,border:`1.5px solid ${K.brand}`,borderRadius:18,
                        padding:16,boxShadow:K.shadowCard,boxSizing:"border-box",display:"flex",flexDirection:"column",gap:9}}>
                        <input value={renameCatIconBuf} onChange={e=>setRenameCatIconBuf(e.target.value)}
                          onKeyDown={e=>{if(e.key==='Enter'){saveCategoryEdit(cat.id,renameCatBuf,renameCatIconBuf);setRenamingCatId(null);}else if(e.key==='Escape'){setRenamingCatId(null);}}}
                          title={T2("Icon (emoji)")}
                          style={{width:56,height:56,borderRadius:"50%",border:`1px solid ${K.line}`,fontSize:26,color:K.text,
                            background:K.surfaceAlt,textAlign:"center",boxSizing:"border-box",outline:"none"}}/>
                        <input value={renameCatBuf} onChange={e=>setRenameCatBuf(e.target.value)}
                          onKeyDown={e=>{if(e.key==='Enter'){saveCategoryEdit(cat.id,renameCatBuf,renameCatIconBuf);setRenamingCatId(null);}else if(e.key==='Escape'){setRenamingCatId(null);}}}
                          autoFocus
                          style={{width:"100%",padding:"9px 11px",borderRadius:K.rSm,border:`1px solid ${K.line}`,fontSize:14,
                            fontWeight:700,color:K.text,background:K.surfaceAlt,boxSizing:"border-box",outline:"none",fontFamily:K.fontBody}}/>
                        <div style={{display:"flex",gap:8,marginTop:"auto"}}>
                          <KButton variant="brand" size="sm" icon="check" style={{flex:1,justifyContent:"center"}}
                            onClick={()=>{saveCategoryEdit(cat.id,renameCatBuf,renameCatIconBuf);setRenamingCatId(null);}}>{T2("Save")}</KButton>
                          <KButton variant="ghost" size="sm" onClick={()=>setRenamingCatId(null)}>{T2("Cancel")}</KButton>
                        </div>
                      </div>
                    );
                    const menuOpen = catMenuId===cat.id;
                    // cardart-SM, not the full motif: the full pair drops a
                    // 150px chef hat and a 165px leaf onto a card barely wider
                    // than that, and they collide with the title.
                    return (
                    <div key={cat.id} className="kh-sopcard kh-cardart-sm" style={{position:"relative",backgroundColor:K.cardWarm,
                      border:`1px solid ${K.cardWarmLine}`,borderRadius:18,boxShadow:K.shadowCard,boxSizing:"border-box"}}>
                      {/* The whole card is the button. The "..." menu sits above
                          it rather than inside, so its clicks never open the
                          category as well. */}
                      <button onClick={()=>{if(nameOnly)setSopSearch("");setSopCat(cat.id);}} className="kh-rip" onPointerDown={ripple}
                        style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:0,width:"100%",height:"100%",
                          padding:"18px 16px 15px",background:"transparent",border:"none",borderRadius:18,
                          cursor:"pointer",textAlign:"left",fontFamily:K.fontBody}}>
                        <span style={{width:86,height:86,borderRadius:"50%",flexShrink:0,marginBottom:14,
                          background:TINTS[ci%TINTS.length],boxShadow:"inset 0 0 0 1px rgba(255,255,255,.65)",
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,lineHeight:1}}>{cat.icon}</span>
                        <span style={{fontFamily:K.fontBody,fontSize:15.5,fontWeight:700,letterSpacing:"-0.25px",
                          lineHeight:1.28,color:K.hdrTitle,overflowWrap:"anywhere"}}>{T2(cat.name)}</span>
                        {/* Hairline separates the name from the count, which is
                            what keeps the card from reading as one grey blur. */}
                        <span style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,width:"100%",
                          marginTop:"auto",paddingTop:13,borderTop:`1px solid ${K.cardWarmLine}`}}>
                          <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:K.hdrMeta}}>
                            {count} {T2("recipes")}
                          </span>
                          <span className="kh-sopgo" style={{width:32,height:32,borderRadius:"50%",flexShrink:0,
                            background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.brand,
                            display:"flex",alignItems:"center",justifyContent:"center",transition:"background .16s, color .16s"}}>
                            <Icon name="chevronR" size={15} strokeWidth={2.3}/>
                          </span>
                        </span>
                      </button>

                      {currentUser?.role==='admin'&&(
                        <div style={{position:"absolute",top:10,right:10,zIndex:menuOpen?22:2}}>
                          <button className={"kh-sopmenu"+(menuOpen?" is-open":"")} title={T2("Options")}
                            onClick={e=>{e.stopPropagation();setCatMenuId(menuOpen?null:cat.id);}}
                            style={{width:28,height:28,borderRadius:"50%",background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,
                              color:K.textMuted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                            <Icon name="more" size={15}/>
                          </button>
                          {menuOpen&&(<>
                            <div onClick={e=>{e.stopPropagation();setCatMenuId(null);}} style={{position:"fixed",inset:0,zIndex:-1}}/>
                            <div style={{position:"absolute",top:34,right:0,minWidth:184,background:K.surface,
                              border:`1px solid ${K.line}`,borderRadius:13,boxShadow:K.shadowLift,padding:5}}>
                              <button className="ash-menu-item kh-rip" onPointerDown={ripple}
                                onClick={e=>{e.stopPropagation();setCatMenuId(null);setRenamingCatId(cat.id);setRenameCatBuf(cat.name);setRenameCatIconBuf(cat.icon);}}
                                style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 11px",borderRadius:8,
                                  border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left",fontFamily:K.fontBody}}>
                                <Icon name="note" size={15}/>{T2("Rename")}
                              </button>
                              {/* Deleting a category with recipes in it would
                                  orphan every one of them, so it is only offered
                                  once the category is empty — and says why. */}
                              <button disabled={total>0} className={total>0?undefined:"ash-menu-item is-danger kh-rip"}
                                onPointerDown={total>0?undefined:ripple}
                                onClick={e=>{e.stopPropagation();if(total>0)return;setCatMenuId(null);deleteCategory(cat.id);}}
                                title={total>0?T2("Move or delete its recipes first"):undefined}
                                style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 11px",borderRadius:8,
                                  border:"none",background:"transparent",color:total>0?K.textFaint:K.textBody,fontSize:13,
                                  cursor:total>0?"not-allowed":"pointer",textAlign:"left",fontFamily:K.fontBody}}>
                                <Icon name="trash" size={15}/>{T2("Delete")}
                              </button>
                            </div>
                          </>)}
                        </div>
                      )}
                    </div>);
                  })}

                  {currentUser?.role==='admin'&&(addingCategory?(
                    <div style={{backgroundColor:K.cardWarm,border:`1.5px solid ${K.brand}`,borderRadius:18,padding:16,
                      boxShadow:K.shadowCard,boxSizing:"border-box",display:"flex",flexDirection:"column",gap:10}}>
                      <span style={{width:56,height:56,borderRadius:"50%",background:K.brandBg,color:K.brand,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <Icon name="clipboard" size={25} strokeWidth={1.8}/>
                      </span>
                      <input value={newCatBuf} onChange={e=>setNewCatBuf(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')addCategory(newCatBuf);else if(e.key==='Escape'){setAddingCategory(false);setNewCatBuf("");}}}
                        autoFocus placeholder={T2("Category name…")}
                        style={{width:"100%",padding:"9px 11px",borderRadius:K.rSm,border:`1px solid ${K.line}`,fontSize:14,
                          fontWeight:700,color:K.text,background:K.surfaceAlt,boxSizing:"border-box",outline:"none",fontFamily:K.fontBody}}/>
                      <div style={{display:"flex",gap:8,marginTop:"auto"}}>
                        <KButton variant="brand" size="sm" icon="check" style={{flex:1,justifyContent:"center"}}
                          onClick={()=>addCategory(newCatBuf)}>{T2("Create")}</KButton>
                        <KButton variant="ghost" size="sm" onClick={()=>{setAddingCategory(false);setNewCatBuf("");}}>{T2("Cancel")}</KButton>
                      </div>
                    </div>
                  ):(
                    <button onClick={()=>setAddingCategory(true)} className="kh-sopadd kh-rip" onPointerDown={ripple}
                      style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,
                        width:"100%",height:"100%",minHeight:212,padding:"18px 16px",background:K.brandSoft,
                        border:`1.5px dashed ${K.brandBorder}`,borderRadius:18,cursor:"pointer",
                        textAlign:"center",fontFamily:K.fontBody,transition:"background .16s, border-color .16s"}}>
                      <span style={{width:56,height:56,borderRadius:"50%",border:`1.5px solid ${K.brandBorder}`,color:K.brand,
                        background:"rgba(255,255,255,.55)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <Icon name="plus" size={25} strokeWidth={2}/>
                      </span>
                      <span style={{fontFamily:K.fontBody,fontSize:15.5,fontWeight:700,letterSpacing:"-0.25px",color:K.brandText}}>{T2("Add Category")}</span>
                      <span style={{fontSize:12.5,color:K.hdrMeta,marginTop:-5}}>{T2("Create new category")}</span>
                    </button>
                  ))}

                  {cards.length===0&&!!sopSearch&&(
                    <div className="kh-cardart-sm" style={{gridColumn:"1 / -1",padding:"34px 18px",textAlign:"center",backgroundColor:K.cardWarm,
                      border:`1px solid ${K.cardWarmLine}`,borderRadius:18,boxShadow:K.shadowCard}}>
                      <div style={{color:K.textFaint,display:"flex",justifyContent:"center",marginBottom:10}}><Icon name="search" size={26} strokeWidth={1.6}/></div>
                      <div style={{...type.cardTitle,color:K.hdrTitle}}>{T2("No matches")}</div>
                      <div style={{fontSize:13,color:K.hdrMeta,marginTop:4}}>{T2("No recipe or category matches")} “{sopSearch}”</div>
                    </div>
                  )}
                </div>
                );
              })()
            ):(()=>{
              const stepsOf=(r)=>safeArr(r.steps).length;
              const allR=safeArr(RECIPE_DB.recipes[sopCat]).filter(r=>!sopSearch||r.n.toLowerCase().includes(sopSearch.toLowerCase()))
                .sort((a,b)=>
                  sopCatSort==="most"  ? stepsOf(b)-stepsOf(a) || (a.n||"").localeCompare(b.n||"") :
                  sopCatSort==="least" ? stepsOf(a)-stepsOf(b) || (a.n||"").localeCompare(b.n||"") :
                  (a.n||"").localeCompare(b.n||""));
              const bgR=allR.filter(r=>!!r.bg);
              const nrmR=allR.filter(r=>!r.bg);
              const yieldStatus=(recipe)=>{
                const items=recipe.ingredients?.items;
                if(!items||!items.length) return null;
                const hasOverall=!!(recipe.ingredients?.base_yield?.kg||recipe.ingredients?.base_yield?.pcs);
                const sections=items.filter(i=>i.isSection);
                const secMissing=sections.filter(s=>!s.yield?.kg&&!s.yield?.pcs).length;
                return {hasOverall,secTotal:sections.length,secMissing};
              };
              const isSelected=(recipe)=>sopSelected.has(recipe.n);
              const toggleSelected=(recipe)=>setSopSelected(p=>{const n=new Set(p);n.has(recipe.n)?n.delete(recipe.n):n.add(recipe.n);return n;});
              const RecipeCard=({recipe,ri,isBg})=>{
                const ys=yieldStatus(recipe);
                const pills=[];
                if(ys){
                  if(!ys.hasOverall) pills.push({tone:"warn",icon:"⚠",text:"no yield"});
                  else if(ys.secMissing>0) pills.push({tone:"warnSoft",icon:"⚠",text:ys.secTotal===1?"section yield missing":`${ys.secMissing} of ${ys.secTotal} sections missing yield`});
                }
                const sel=sopBulkMode&&isSelected(recipe);
                const label=recipeNameOf(recipe, lang);
                // No photographs, by request. The tile carries the recipe's
                // initial in the display serif on a rotating tint — distinct per
                // row, and it needs no image asset per dish to exist.
                const mono=(label||"?").trim().charAt(0).toUpperCase();
                const tint=isBg?K.warnBg:SOP_TINTS[ri%SOP_TINTS.length];
                const steps=safeArr(recipe.steps).length;
                return(
                <div key={ri} className="kh-sopcard kh-cardart-sm" style={{position:"relative",
                  backgroundColor:sel?K.brandBg:K.cardWarm,
                  border:`1px solid ${sel?K.brand:(isBg?K.warnBorder:K.cardWarmLine)}`,
                  borderRadius:16,boxShadow:K.shadowCard,boxSizing:"border-box"}}>
                  <button onClick={()=>sopBulkMode?toggleSelected(recipe):setSopRecipe(recipe)}
                    className="kh-rip" onPointerDown={ripple}
                    style={{display:"flex",alignItems:"center",gap:14,width:"100%",
                      // Room for the two stacked controls at the right edge —
                      // not needed in bulk mode, where they are not rendered.
                      padding:sopBulkMode?"12px 14px 12px 12px":"12px 58px 12px 12px",
                      background:"transparent",border:"none",borderRadius:16,cursor:"pointer",textAlign:"left",fontFamily:K.fontBody}}>
                    <span style={{width:74,height:74,borderRadius:15,flexShrink:0,background:tint,
                      boxShadow:"inset 0 0 0 1px rgba(255,255,255,.7)",position:"relative",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sopBulkMode?(
                        <span style={{width:24,height:24,borderRadius:7,border:`2px solid ${sel?K.brand:K.cardWarmLine}`,
                          background:sel?K.brand:"rgba(255,255,255,.75)",color:"#FFFFFF",
                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {sel&&<Icon name="check" size={15} strokeWidth={2.6}/>}
                        </span>
                      ):(
                        <span style={{fontFamily:K.fontDisplay,fontSize:30,fontWeight:600,color:K.brand,opacity:.85,lineHeight:1}}>{mono}</span>
                      )}
                    </span>
                    <span style={{minWidth:0,flex:1}}>
                      <span style={{display:"block",fontSize:15,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
                      <span style={{display:"flex",alignItems:"center",gap:7,marginTop:4,fontSize:12.5,color:K.hdrMeta,flexWrap:"wrap"}}>
                        {recipe.sub&&<span>{recipe.sub}</span>}
                        {recipe.sub&&<span style={{color:K.textFaint}}>·</span>}
                        <span>{steps} {steps===1?T2("step"):T2("steps")}</span>
                        {isBg&&<span style={{fontSize:10.5,fontWeight:700,letterSpacing:".4px",textTransform:"uppercase",
                          padding:"2px 8px",borderRadius:K.rPill,background:K.warnBg,color:K.warn,border:`1px solid ${K.warnBorder}`}}>{T2("Base gravy")}</span>}
                      </span>
                      {pills.length>0&&<span style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:7}}>{pills.map((p,pi)=>(
                        <span key={pi} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,
                          padding:"3px 9px",borderRadius:K.rPill,
                          background:p.tone==="warn"?K.dangerBg:K.warnBg,color:p.tone==="warn"?K.danger:K.warn,
                          border:`1px solid ${p.tone==="warn"?K.dangerBorder:K.warnBorder}`}}>
                          <Icon name="alert" size={11} strokeWidth={2.2}/>{T2(p.text)}
                        </span>
                      ))}</span>}
                    </span>
                  </button>

                  {/* Stacked at the right edge, outside the button, so neither
                      one can also open the recipe. The row reserves 58px of
                      padding for them. */}
                  {!sopBulkMode&&(
                    <div style={{position:"absolute",top:10,right:10,bottom:10,display:"flex",flexDirection:"column",
                      alignItems:"flex-end",justifyContent:"space-between",gap:6,zIndex:recipeMenu===recipe.n?22:2}}>
                      {currentUser?.role==='admin'?(
                        <div style={{position:"relative"}}>
                          <button className={"kh-sopmenu"+(recipeMenu===recipe.n?" is-open":"")} title={T2("Options")}
                            onClick={e=>{e.stopPropagation();setRecipeMenu(recipeMenu===recipe.n?null:recipe.n);}}
                            style={{width:28,height:28,borderRadius:"50%",background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,
                              color:K.textMuted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                            <Icon name="more" size={15}/>
                          </button>
                          {recipeMenu===recipe.n&&(<>
                            <div onClick={e=>{e.stopPropagation();setRecipeMenu(null);}} style={{position:"fixed",inset:0,zIndex:-1}}/>
                            <div style={{position:"absolute",top:34,right:0,minWidth:176,background:K.surface,
                              border:`1px solid ${K.line}`,borderRadius:13,boxShadow:K.shadowLift,padding:5}}>
                              <button className="ash-menu-item kh-rip" onPointerDown={ripple}
                                onClick={e=>{e.stopPropagation();setRecipeMenu(null);openSopEdit(recipe,sopCat);}}
                                style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 11px",borderRadius:8,
                                  border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left",fontFamily:K.fontBody}}>
                                <Icon name="note" size={15}/>{T2("Edit")}
                              </button>
                              <button className="ash-menu-item is-danger kh-rip" onPointerDown={ripple}
                                onClick={e=>{e.stopPropagation();setRecipeMenu(null);deleteSop(recipe,sopCat);}}
                                style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 11px",borderRadius:8,
                                  border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left",fontFamily:K.fontBody}}>
                                <Icon name="trash" size={15}/>{T2("Delete")}
                              </button>
                            </div>
                          </>)}
                        </div>
                      ):<span/>}
                      {/* A real button, not decoration: it looks like the way in,
                          so it has to be one. */}
                      <button className="kh-sopgo kh-rip" onPointerDown={ripple} title={T2("Open")}
                        onClick={e=>{e.stopPropagation();setSopRecipe(recipe);}}
                        style={{width:32,height:32,borderRadius:"50%",flexShrink:0,padding:0,cursor:"pointer",
                          background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.brand,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          transition:"background .16s, color .16s"}}>
                        <Icon name="chevronR" size={15} strokeWidth={2.3}/>
                      </button>
                    </div>
                  )}
                </div>);
              };
              return(
              <div>
                {/* Toolbar — Back and Select on the left, Sort on the right. */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                  <button className="kh-btn kh-rip" onPointerDown={ripple}
                    onClick={()=>{setSopCat(null);setSopSearch("");setSopBulkMode(false);setSopSelected(new Set());}}
                    style={{display:"inline-flex",alignItems:"center",gap:9,padding:"12px 18px",borderRadius:K.rPill,
                      background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,
                      color:K.textBody,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:K.fontBody,whiteSpace:"nowrap"}}>
                    <Icon name="chevronL" size={16} strokeWidth={2.1}/>{T2("All Categories")}
                  </button>
                  {currentUser?.role==='admin'&&allR.length>0&&(
                    <button className="kh-btn kh-rip" onPointerDown={ripple}
                      onClick={()=>{setSopBulkMode(p=>!p);setSopSelected(new Set());}}
                      style={{display:"inline-flex",alignItems:"center",gap:9,padding:"12px 18px",borderRadius:K.rPill,
                        background:sopBulkMode?K.brand:K.cardWarm,border:`1px solid ${sopBulkMode?K.brand:K.cardWarmLine}`,
                        boxShadow:K.shadowCard,color:sopBulkMode?"#FFFFFF":K.textBody,fontSize:14,fontWeight:600,
                        cursor:"pointer",fontFamily:K.fontBody,whiteSpace:"nowrap"}}>
                      <Icon name={sopBulkMode?"close":"listCheck"} size={16} strokeWidth={2}/>
                      {sopBulkMode?T2("Cancel"):T2("Select")}
                    </button>
                  )}
                  {sopBulkMode&&(
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px 7px 16px",borderRadius:K.rPill,
                      background:K.brandBg,border:`1px solid ${K.brandBorder}`,boxSizing:"border-box",flexWrap:"wrap"}}>
                      <span style={{fontSize:13,color:K.brandText,fontWeight:700}}>{sopSelected.size} {T2("selected")}</span>
                      <select value={sopBulkTarget} onChange={e=>setSopBulkTarget(e.target.value)} disabled={sopSelected.size===0}
                        style={{padding:"7px 10px",borderRadius:K.rSm,border:`1px solid ${K.brandBorder}`,fontSize:12.5,
                          color:K.text,background:K.surface,cursor:sopSelected.size===0?"default":"pointer",fontFamily:K.fontBody}}>
                        <option value="">{T2("Move to…")}</option>
                        {safeArr(RECIPE_DB.cats).filter(c=>c.id!==sopCat).map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                      <KButton variant="brand" size="sm" icon="check" disabled={sopSelected.size===0||!sopBulkTarget}
                        onClick={()=>{const chosen=allR.filter(r=>sopSelected.has(r.n));moveRecipesBulk(chosen,sopCat,sopBulkTarget);}}
                        style={{borderRadius:K.rPill,padding:"9px 16px"}}>{T2("Move")}</KButton>
                    </div>
                  )}
                  {/* Search and Add Recipe moved down here with the header band
                      gone. Losing them entirely would have cost a 40-recipe
                      category its only filter and admins their only way to add
                      one. */}
                  <div style={{position:"relative",flex:"1 1 240px",minWidth:200,maxWidth:460}}>
                    <span style={{position:"absolute",left:18,top:"50%",transform:"translateY(-50%)",color:K.textFaint,display:"flex",pointerEvents:"none"}}>
                      <Icon name="search" size={17} strokeWidth={1.9}/>
                    </span>
                    <input value={sopSearch} onChange={e=>setSopSearch(e.target.value)}
                      placeholder={`${T2("Search in")} ${T2(safeArr(RECIPE_DB.cats).find(c=>c.id===sopCat)?.name||T2("this category"))}…`}
                      style={{width:"100%",padding:"12px 16px 12px 46px",borderRadius:K.rPill,border:`1px solid ${K.cardWarmLine}`,
                        fontSize:14,color:K.text,background:"#FFFFFF",boxSizing:"border-box",
                        boxShadow:K.shadowCard,fontFamily:K.fontBody,outline:"none"}}/>
                  </div>
                  <div style={{marginLeft:"auto",display:"flex",gap:10,flexShrink:0}}>
                    {sortMenu()}
                    {currentUser?.role==='admin'&&(
                      <KButton variant="brand" icon="plus" onClick={()=>openSopAdd(sopCat)}
                        style={{padding:"12px 18px",borderRadius:K.rPill,fontSize:14}}>{T2("Add Recipe")}</KButton>
                    )}
                  </div>
                </div>
                {bgR.length>0&&<>
                  <div style={{display:"flex",alignItems:"center",gap:9,margin:"2px 2px 10px"}}>
                    <span style={{...type.label,fontSize:11,color:K.warn}}>{T2("Base gravies")}</span>
                    <span style={{fontSize:12,fontWeight:700,color:K.textFaint}}>{bgR.length}</span>
                    <span style={{flex:1,height:1,background:K.cardWarmLine,minWidth:10}}/>
                  </div>
                  <div className="kh-soprows" style={{marginBottom:20}}>
                    {bgR.map((r,ri)=><RecipeCard key={"bg"+ri} recipe={r} ri={ri} isBg={true}/>)}
                  </div>
                </>}
                {nrmR.length>0&&<>
                  {bgR.length>0&&<div style={{display:"flex",alignItems:"center",gap:9,margin:"2px 2px 10px"}}>
                    <span style={{...type.label,fontSize:11,color:K.hdrMeta}}>{T2("Recipes")}</span>
                    <span style={{fontSize:12,fontWeight:700,color:K.textFaint}}>{nrmR.length}</span>
                    <span style={{flex:1,height:1,background:K.cardWarmLine,minWidth:10}}/>
                  </div>}
                  <div className="kh-soprows">
                    {nrmR.map((r,ri)=><RecipeCard key={"n"+ri} recipe={r} ri={ri} isBg={false}/>)}
                  </div>
                </>}
                {allR.length===0&&(
                  <div className="kh-cardart-sm" style={{padding:"38px 18px",textAlign:"center",backgroundColor:K.cardWarm,
                    border:`1px solid ${K.cardWarmLine}`,borderRadius:18,boxShadow:K.shadowCard}}>
                    <div style={{color:K.textFaint,display:"flex",justifyContent:"center",marginBottom:10}}><Icon name="book" size={26} strokeWidth={1.6}/></div>
                    <div style={{fontSize:15,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle}}>{sopSearch?T2("No matches"):T2("No recipes yet")}</div>
                    <div style={{fontSize:13,color:K.hdrMeta,marginTop:4}}>
                      {sopSearch?T2("Nothing in this category matches your search"):T2("Add the first recipe to this category")}
                    </div>
                  </div>
                )}
              </div>);
            })()
          ):(
            <div>
              <button className="kh-btn kh-rip" onPointerDown={ripple}
                onClick={()=>{setSopRecipe(null);setEditingSteps(false);setSopModal(null);setIngModal(null);}}
                style={{display:"inline-flex",alignItems:"center",gap:9,padding:"12px 18px",borderRadius:K.rPill,
                  background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,marginBottom:16,
                  color:K.textBody,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:K.fontBody,whiteSpace:"nowrap"}}>
                <Icon name="chevronL" size={16} strokeWidth={2.1}/>{T2("Back to Recipes")}
              </button>
              <div>
                {/* The header sits on its own plate, like the panels below it.
                    Without a photograph to give it weight it read as floating
                    text on the page artwork. */}
                <div className="kh-cardart-sm" style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  gap:18,marginBottom:editingSteps?0:16,flexWrap:"wrap",padding:"20px 22px",
                  // While editing, this plate and the step list below it are one
                  // sheet: the bottom corners square off and the card under it
                  // drops its top border so the seam disappears.
                  borderRadius:editingSteps?"20px 20px 0 0":20,
                  backgroundColor:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard}}>
                  <div style={{flex:"1 1 320px",minWidth:0,display:"flex",gap:18,alignItems:"center"}}>
                    {/* Monogram, not a photograph — same tile the recipe list
                        uses, so the two views agree and no dish needs an image
                        asset to look finished. The category's own emoji rides in
                        the corner, which is the one badge that carries meaning. */}
                    {(()=>{
                      const catObjSop=safeArr(RECIPE_DB.cats).find(c=>c.id===sopCat);
                      const tintSop=SOP_TINTS[Math.max(0,safeArr(RECIPE_DB.recipes[sopCat]).findIndex(r=>r.n===sopRecipe.n))%SOP_TINTS.length];
                      return (
                      <span style={{position:"relative",width:88,height:88,borderRadius:22,flexShrink:0,
                        background:`linear-gradient(145deg, ${tintSop} 0%, rgba(255,255,255,.75) 130%)`,
                        boxShadow:`inset 0 0 0 1px rgba(255,255,255,.75), 0 6px 16px rgba(28,61,43,.10)`,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontFamily:K.fontDisplay,fontSize:40,fontWeight:600,color:K.brand,opacity:.9,lineHeight:1}}>
                          {(recipeNameOf(sopRecipe, lang)||"?").trim().charAt(0).toUpperCase()}
                        </span>
                        {catObjSop?.icon&&(
                          <span style={{position:"absolute",right:-6,bottom:-6,width:30,height:30,borderRadius:"50%",
                            background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,
                            display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,lineHeight:1}}>{catObjSop.icon}</span>
                        )}
                      </span>);
                    })()}
                  <div style={{flex:1,minWidth:0}}>
                    {editingSteps?(
                      // Editing steps shows the recipe's identity as chips, not
                      // as four form fields. Name, sub-label, category and the
                      // base-gravy flag are edited in the recipe dialog; putting
                      // them here too meant two places to change one thing.
                      (()=>{
                        const catObjEd=safeArr(RECIPE_DB.cats).find(c=>c.id===(sopForm.catId||sopCat));
                        const nStepsEd=safeArr(sopForm.steps).length;
                        const chip={display:"inline-flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,
                          lineHeight:1.2,color:K.hdrMeta};
                        const dot=<span style={{color:K.textFaint}}>·</span>;
                        return(<>
                          <div style={{...type.pageTitle,fontSize:27,color:K.hdrTitle,overflowWrap:"anywhere"}}>
                            {sopForm.name||T2("Untitled recipe")}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginTop:7,flexWrap:"wrap"}}>
                            {catObjEd&&<span style={chip}><Icon name="utensils" size={14} strokeWidth={1.9}/>{T2(catObjEd.name)}</span>}
                            {catObjEd&&dot}
                            <span style={chip}><Icon name="listCheck" size={14} strokeWidth={1.9}/>{nStepsEd} {nStepsEd===1?T2("step"):T2("steps")}</span>
                            {!!sopForm.bg&&<>{dot}<span style={{...chip,color:K.warn}}><Icon name="layers" size={14} strokeWidth={1.9}/>{T2("Base gravy")}</span></>}
                            {sopForm.sub&&<>{dot}<span style={{...chip,color:K.danger}}><Icon name="flame" size={14} strokeWidth={1.9}/>{sopForm.sub}</span></>}
                          </div>
                        </>);
                      })()
                    ):(
                      (()=>{
                        const catObjSop=safeArr(RECIPE_DB.cats).find(c=>c.id===sopCat);
                        const nSteps=safeArr(sopRecipe.steps).length;
                        // Every fact gets the same chip treatment. The old line
                        // mixed plain dot-separated text with one loud pill, and
                        // the pill's larger box threw the baseline out.
                        const chip={display:"inline-flex",alignItems:"center",gap:6,padding:"5px 11px",borderRadius:K.rPill,
                          fontSize:12.5,fontWeight:600,lineHeight:1.2,background:"#FFFFFF",
                          border:`1px solid ${K.cardWarmLine}`,color:K.hdrMeta};
                        return(<>
                          {catObjSop&&<div style={{...type.label,fontSize:10.5,color:K.sbGold,marginBottom:3}}>{T2(catObjSop.name)}</div>}
                          <div style={{...type.pageTitle,fontSize:29,color:K.hdrTitle,overflowWrap:"anywhere"}}>{recipeNameOf(sopRecipe, lang)}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:9,flexWrap:"wrap"}}>
                            <span style={chip}><Icon name="listCheck" size={13} strokeWidth={2}/>{nSteps} {nSteps===1?T2("step"):T2("steps")}</span>
                            {sopRecipe.sub&&<span style={chip}>{sopRecipe.sub}</span>}
                            {!!sopRecipe.bg&&<span style={{...chip,background:K.warnBg,color:K.warn,border:`1px solid ${K.warnBorder}`,
                              fontSize:11,fontWeight:700,letterSpacing:".4px",textTransform:"uppercase"}}>
                              <Icon name="utensils" size={12} strokeWidth={2}/>{T2("Base gravy")}</span>}
                          </div>
                        </>);
                      })()
                    )}
                  </div>
                  </div>
                  {currentUser?.role==='admin'&&(
                    <div style={{display:"flex",gap:10,flexShrink:0,flexWrap:"wrap"}}>
                      {!editingSteps?(
                        <>
                          <KButton icon="note" onClick={()=>{openSopEdit(sopRecipe,sopCat);setEditingSteps(true);}}
                            style={{padding:"12px 18px",borderRadius:K.rPill,fontSize:14,background:K.cardWarm,borderColor:K.cardWarmLine}}>{T2("Edit")}</KButton>
                          <KButton variant="danger" icon="trash" onClick={()=>deleteSop(sopRecipe,sopCat)}
                            style={{padding:"12px 18px",borderRadius:K.rPill,fontSize:14,background:K.dangerBg}}>{T2("Delete")}</KButton>
                          {/* A themed menu, not a native select: the browser one
                              renders as OS chrome — system blue highlight, system
                              font — in the middle of the app's own palette. It is
                              height-capped and scrolls, so a growing category
                              list cannot run off the screen. */}
                          <div style={{position:"relative",flexShrink:0}}>
                            <button className="kh-btn kh-rip" onPointerDown={ripple} onClick={()=>setMoveMenuOpen(o=>!o)}
                              style={{display:"inline-flex",alignItems:"center",gap:9,padding:"12px 16px",borderRadius:K.rPill,
                                background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,
                                color:K.textBody,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:K.fontBody,whiteSpace:"nowrap"}}>
                              <Icon name="layers" size={16} strokeWidth={1.9}/>{T2("Move to…")}
                              <Icon name="chevronD" size={15} strokeWidth={2} style={{transform:moveMenuOpen?"rotate(180deg)":"none",transition:"transform .18s"}}/>
                            </button>
                            {moveMenuOpen&&(<>
                              <div onClick={()=>setMoveMenuOpen(false)} style={{position:"fixed",inset:0,zIndex:20}}/>
                              <div className="kh-thinscroll" style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:21,minWidth:250,maxHeight:330,
                                overflowY:"auto",background:K.surface,border:`1px solid ${K.line}`,borderRadius:16,
                                boxShadow:K.shadowLift,padding:6}}>
                                <div style={{...type.label,fontSize:10,color:K.textFaint,padding:"7px 12px 8px"}}>{T2("Move to…")}</div>
                                {safeArr(RECIPE_DB.cats).filter(c=>c.id!==sopCat).map(c=>(
                                  <button key={c.id} className="ash-menu-item kh-rip" onPointerDown={ripple}
                                    onClick={()=>{setMoveMenuOpen(false);moveRecipe(sopRecipe,sopCat,c.id);}}
                                    style={{display:"flex",alignItems:"center",gap:11,width:"100%",padding:"9px 12px",borderRadius:9,
                                      border:"none",background:"transparent",color:K.textBody,fontSize:13.5,fontWeight:500,
                                      cursor:"pointer",textAlign:"left",fontFamily:K.fontBody}}>
                                    <span style={{width:30,height:30,borderRadius:9,flexShrink:0,background:K.surfaceAlt,
                                      border:`1px solid ${K.line}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{c.icon}</span>
                                    <span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{T2(c.name)}</span>
                                    <span style={{marginLeft:"auto",fontSize:11.5,fontWeight:700,color:K.textFaint,flexShrink:0}}>
                                      {safeArr(RECIPE_DB.recipes[c.id]).length}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </>)}
                          </div>
                        </>
                      ):(
                        <>
                          {/* No "Preview": leaving the editor without saving
                              discards the edits, so a button that looked like a
                              harmless look-ahead would lose work. Cancel says
                              what it does. */}
                          <KButton icon="close" onClick={()=>{setEditingSteps(false);setSopModal(null);}}
                            style={{padding:"13px 20px",borderRadius:K.rPill,fontSize:14,background:"#FFFFFF",borderColor:K.cardWarmLine}}>{T2("Cancel")}</KButton>
                          <KButton variant="brand" icon="check" onClick={()=>{saveSop();setEditingSteps(false);}}
                            style={{padding:"13px 24px",borderRadius:K.rPill,fontSize:14}}>{T2("Save changes")}</KButton>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {/* Ingredient count + Edit button */}
                {!editingSteps&&(()=>{const fallbackIng=!sopRecipe.ingredients?.items?.length&&getIngrForDish?getIngrForDish(sopRecipe.n,500):null;return(<>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:K.rPill,
                    background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,
                    fontSize:13.5,fontWeight:600,color:K.textBody}}>
                    <Icon name="utensils" size={15} strokeWidth={1.9}/>
                    {sopRecipe.ingredients?.items?.length>0
                      ?`${sopRecipe.ingredients.items.filter(i=>!i.isSection).length} ${T2("ingredients")}`
                      :fallbackIng?`${fallbackIng.length} ${T2("ingredients")} (${T2("legacy")})`
                      :T2("No ingredients added")}
                  </span>
                  {currentUser?.role==='admin'&&!ingModal&&(<>
                    <KButton icon="note" onClick={()=>{openIngEditor(sopRecipe,sopCat);}}
                      style={{padding:"10px 16px",borderRadius:K.rPill,fontSize:13.5,background:K.cardWarm,borderColor:K.cardWarmLine}}>
                      {sopRecipe.ingredients?.items?.length>0?T2("Edit"):T2("Add Ingredients")}
                    </KButton>
                    <KButton icon="box" onClick={()=>setCsvImport({recipe:sopRecipe,catId:sopCat,recipeName:sopRecipe.n,basePax:sopRecipe.ingredients?.base_pax||300,currentCount:sopRecipe.ingredients?.items?.length||0,parsedItems:null,warnings:[]})}
                      style={{padding:"10px 16px",borderRadius:K.rPill,fontSize:13.5,background:K.cardWarm,borderColor:K.cardWarmLine}}>{T2("Import CSV")}</KButton>
                  </>)}
                  {currentUser?.role==='admin'&&ingModal?.recipeName===sopRecipe.n&&(
                    <div style={{display:"flex",gap:10}}>
                      {ingDirty&&<KButton variant="brand" icon="check" onClick={saveIngredients}
                        style={{padding:"10px 18px",borderRadius:K.rPill,fontSize:13.5}}>{T2("Save")}</KButton>}
                      <KButton icon="close" onClick={()=>{if(ingDirty){askDiscardIng();return;}setIngModal(null);setIngDirty(false);}}
                        style={{padding:"10px 16px",borderRadius:K.rPill,fontSize:13.5,background:K.cardWarm,borderColor:K.cardWarmLine}}>{T2("Cancel")}</KButton>
                    </div>
                  )}
                </div>
                {/* Inline ingredient table (read-only) */}
                {(ingModal?.recipeName===sopRecipe.n)?(
                  <div className="kh-cardart-sm" style={{marginBottom:16,borderRadius:22,backgroundColor:K.cardWarm,
                    border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,overflow:"hidden"}}>
                    <div style={{padding:"18px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      <span style={{display:"flex",alignItems:"center",gap:14,minWidth:0}}>
                        {/* Leaves the editor. Discarding is guarded below, so this
                            is only a way back when nothing has changed. */}
                        <button className="kh-btn kh-rip" onPointerDown={ripple} title={T2("Close editor")}
                          onClick={()=>{ if(ingDirty){askDiscardIng();return;} setIngModal(null); }}
                          style={{width:40,height:40,borderRadius:"50%",flexShrink:0,background:"#FFFFFF",
                            border:`1px solid ${K.cardWarmLine}`,color:K.textBody,cursor:"pointer",
                            display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                          <Icon name="chevronL" size={18} strokeWidth={2.1}/>
                        </button>
                        <span style={{width:46,height:46,borderRadius:14,flexShrink:0,background:K.brandBg,color:K.brand,
                          border:`1px solid ${K.brandBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <Icon name="box" size={23} strokeWidth={1.8}/>
                        </span>
                        <span style={{minWidth:0}}>
                          <span style={{display:"block",...type.pageTitle,fontSize:24,color:K.hdrTitle}}>
                            {T2("Editing")} <span style={{color:K.textFaint,fontWeight:400}}>·</span> {ingForm.base_pax||300} {T2("pax anchor")}
                          </span>
                          <span style={{display:"block",fontSize:13,color:K.hdrMeta,marginTop:2}}>{T2("Add, edit or update ingredients for this recipe")}</span>
                        </span>
                      </span>
                      <span style={{display:"inline-flex",alignItems:"center",gap:7,padding:"9px 16px",borderRadius:K.rPill,flexShrink:0,
                        background:ingDirty?K.warnBg:"#FFFFFF",border:`1px solid ${ingDirty?K.warnBorder:K.cardWarmLine}`,
                        fontSize:13,fontWeight:700,color:ingDirty?K.warn:K.hdrMeta}}>
                        {ingDirty&&<Icon name="alert" size={13} strokeWidth={2.2}/>}
                        {ingForm.items.length} {T2("items")}{ingDirty?" · "+T2("unsaved"):""}
                      </span>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{borderCollapse:"collapse",fontSize:13,width:"100%",background:"#FFFFFF"}}>
                        <thead><tr>
                          {(()=>{const th={padding:"12px 10px",fontSize:11.5,fontWeight:700,letterSpacing:".5px",
                            textTransform:"uppercase",color:K.hdrMeta,background:K.surfaceAlt,
                            borderTop:`1px solid ${K.cardWarmLine}`,borderBottom:`1px solid ${K.cardWarmLine}`,whiteSpace:"nowrap"};
                          return(<>
                            <th style={{...th,textAlign:"center",width:52}}>#</th>
                            <th style={{...th,textAlign:"left",minWidth:190}}>{T2("Ingredient")}</th>
                            <th style={{...th,textAlign:"left",minWidth:130}}>{T2("Hindi")}</th>
                            <th style={{...th,textAlign:"left",minWidth:96}}>{T2("Unit")}</th>
                            <th style={{...th,textAlign:"center",minWidth:110}}>{T2("Qty")} @ {ingForm.base_pax||300}</th>
                            <th style={{...th,textAlign:"center",width:96}}>{T2("Actions")}</th>
                          </>);})()}
                        </tr></thead>
                        <tbody>
                          {ingForm.items.map((item,idx)=>{
                            if (item.isSection) return (
                              // A section is a heading inside the list, so it
                              // gets a band rather than a row of fields wearing
                              // the same white as the ingredients under it.
                              <tr key={idx} onDragOver={e=>e.preventDefault()} onDrop={()=>ingReorderTo(idx)}
                                style={{background:K.brandBg,opacity:ingDragIdx===idx?0.4:1}}>
                                <td colSpan={5} style={{padding:"10px 10px 10px 13px",borderTop:`1px solid ${K.brandBorder}`,
                                  borderBottom:`1px solid ${K.brandBorder}`,borderLeft:`3px solid ${K.brand}`}}>
                                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                                    <span style={{...type.label,fontSize:10,color:K.brandText,flexShrink:0}}>{T2("Section")}</span>
                                    <input value={item.name} onChange={e=>ingUpdateItem(idx,"name",e.target.value)}
                                      placeholder={T2("Section name")}
                                      style={{width:200,padding:"9px 12px",borderRadius:10,border:`1px solid ${K.brandBorder}`,
                                        fontSize:13.5,fontWeight:700,color:K.hdrTitle,background:"#FFFFFF",boxSizing:"border-box",
                                        fontFamily:K.fontBody,outline:"none"}}/>
                                    <input value={item.hi||""} onChange={e=>ingUpdateItem(idx,"hi",e.target.value)}
                                      placeholder="हिन्दी"
                                      style={{width:150,padding:"9px 12px",borderRadius:10,border:`1px solid ${K.brandBorder}`,
                                        fontSize:14,fontWeight:600,color:K.text,background:"#FFFFFF",boxSizing:"border-box",
                                        fontFamily:K.fontBody,outline:"none"}}/>
                                    {/* Units sit inside their fields, the same way
                                        the recipe-level yield editor does it. */}
                                    <span style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}
                                      title={`${T2("Section yield at")} ${ingForm.base_pax||300} pax`}>
                                      <span style={{...type.label,fontSize:10,color:K.brandText}}>{T2("Yield")}</span>
                                      {[["kg","0.1",item.yield?.kg,"20"],["pcs","1",item.yield?.pcs,"400"]].map(([u,step,val,ph])=>(
                                        <span key={u} style={{display:"flex",alignItems:"center",background:"#FFFFFF",borderRadius:10,
                                          border:`1px solid ${K.brandBorder}`,overflow:"hidden",width:118}}>
                                          <input type="number" step={step} value={val??""}
                                            onChange={e=>{const v=e.target.value===""?null:Number(e.target.value);ingUpdateItem(idx,"yield",{...(item.yield||{}),[u]:v});}}
                                            placeholder={ph}
                                            style={{flex:1,minWidth:0,padding:"9px 0 9px 12px",border:"none",outline:"none",background:"transparent",
                                              fontSize:14,fontWeight:700,color:K.text,fontFamily:K.fontBody,fontVariantNumeric:"tabular-nums"}}/>
                                          <span style={{padding:"0 12px 0 6px",fontSize:12.5,fontWeight:700,color:K.textFaint}}>{u}</span>
                                        </span>
                                      ))}
                                    </span>
                                  </div>
                                </td>
                                <td style={{padding:"8px 10px",textAlign:"center",whiteSpace:"nowrap",background:K.brandBg,
                                  borderTop:`1px solid ${K.brandBorder}`,borderBottom:`1px solid ${K.brandBorder}`}}>
                                  <span draggable onDragStart={()=>setIngDragIdx(idx)} onDragEnd={()=>setIngDragIdx(null)} title={T2("Drag to reorder")}
                                    style={{cursor:"grab",display:"inline-flex",alignItems:"center",gap:2,justifyContent:"center",width:30,height:32,
                                      borderRadius:9,color:K.textFaint,userSelect:"none",marginRight:6,verticalAlign:"middle"}}>
                                    <Icon name="more" size={14} style={{transform:"rotate(90deg)",marginRight:-5}}/><Icon name="more" size={14} style={{transform:"rotate(90deg)"}}/>
                                  </span>
                                  <button className="kh-rip" onPointerDown={ripple} onClick={()=>ingRemoveItem(idx)} title={T2("Remove section")}
                                    style={{width:32,height:32,borderRadius:10,border:`1px solid ${K.dangerBorder}`,background:K.dangerBg,
                                      cursor:"pointer",color:K.danger,padding:0,display:"inline-flex",alignItems:"center",justifyContent:"center",verticalAlign:"middle"}}>
                                    <Icon name="trash" size={15}/>
                                  </button>
                                </td>
                              </tr>
                            );
                            // 9A — non-section row: raw / inv / bg with Option C tinting
                            const tRow = item.type || 'raw';
                            const isInv = tRow === 'inv';
                            const isBg  = tRow === 'bg';
                            // The row itself stays white. Tinting the whole row by
                            // type meant a recipe whose items are all
                            // inventory-mapped rendered as a wall of blue — it
                            // read as "everything is selected" rather than as a
                            // quiet fact about each item. The type now lives in
                            // the chip and in a 3px strip down the row's left
                            // edge, which says the same thing without shouting.
                            const rowFg  = isInv ? K.accent : isBg ? K.warn : K.text;
                            const rowTintBg = isInv ? K.accentSoft : isBg ? K.warnBg : K.surfaceAlt;
                            const rowTintBd = isInv ? K.accentBorder : isBg ? K.warnBorder : K.line;
                            const tIcon  = isInv ? "box" : isBg ? "utensils" : "note";
                            const nameLocked = isInv || isBg;
                            return (
                              <tr key={idx} onDragOver={e=>e.preventDefault()} onDrop={()=>ingReorderTo(idx)} style={{background:"#FFFFFF",opacity:ingDragIdx===idx?0.4:1}}>
                                <td style={{padding:"8px 10px",textAlign:"center",borderTop:`1px solid ${K.lineSoft}`,
                                  borderLeft:`3px solid ${nameLocked?rowFg:"transparent"}`}}>
                                  <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:"50%",background:K.surfaceAlt,border:`1px solid ${K.line}`,fontSize:12.5,fontWeight:700,color:K.textMuted}}>
                                    {ingForm.items.slice(0,idx).filter(i=>!i.isSection).length+1}
                                  </span>
                                </td>
                                <td style={{padding:"8px 10px",position:"relative",borderTop:`1px solid ${K.lineSoft}`}}>
                                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                                    <button onClick={(e)=>{ if(typePickerIdx===idx){setTypePickerIdx(null);setTypePickerPos(null);return;} const r=e.currentTarget.getBoundingClientRect(); setTypePickerPos({top:r.bottom+4,left:r.left}); setTypePickerIdx(idx); }} title={T2("Change row type")} className="kh-rip" onPointerDown={ripple} style={{width:32,height:32,padding:0,border:`1px solid ${rowTintBd}`,borderRadius:9,background:rowTintBg,cursor:"pointer",color:rowFg,flexShrink:0,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Icon name={tIcon} size={15} strokeWidth={1.9}/></button>
                                    {nameLocked
                                      ? <div onClick={()=>{ if(isInv){setOpsPickerIdx(idx);setOpsPickerSearch("");loadOpsPickerItems();} else {setBgPickerIdx(idx);setBgPickerSearch("");} }} title={T2("Click to re-pick")} style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:13.5,fontWeight:600,color:K.text,background:"#FFFFFF",cursor:"pointer",boxSizing:"border-box"}}><span style={{minWidth:0,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name||<span style={{color:K.textFaint,fontWeight:500}}>{T2("Pick")} {isInv?T2("an item"):T2("a gravy")}…</span>}</span><span style={{color:K.textFaint,display:"flex",flexShrink:0}}><Icon name="link" size={13} strokeWidth={2}/></span></div>
                                      : <input value={item.name} onChange={e=>ingUpdateItem(idx,"name",e.target.value)} placeholder="Name" style={{flex:1,minWidth:0,padding:"9px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:13.5,color:K.text,background:"#FFFFFF",boxSizing:"border-box",fontFamily:K.fontBody,outline:"none"}}/>
                                    }
                                    {(() => {
                                      // 9E — migration nudge: raw rows with a matching ingredient_item_map entry get a one-click upgrade chip
                                      if (nameLocked) return null;
                                      const nm = (item.name || "").toLowerCase().trim();
                                      if (!nm) return null;
                                      const hit = iimMap[nm];
                                      if (!hit) return null;
                                      return (
                                        <button onClick={()=>convertRowToInvFromIim(idx, hit)}
                                          title={"Link to inventory: " + (hit.ops_item_name || hit.ops_inventory_id)}
                                          style={{padding:"3px 8px",borderRadius:5,background:C.blueBg,border:`1px solid ${C.blueBorder}`,color:C.blue,fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,minHeight:24,lineHeight:"18px"}}>
                                          🔗 Link
                                        </button>
                                      );
                                    })()}
                                  </div>
                                  {typePickerIdx===idx && typePickerPos && createPortal((
                                    <>
                                      <div onClick={()=>{setTypePickerIdx(null);setTypePickerPos(null);}} style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:998,background:"transparent"}}/>
                                      <div style={{position:"fixed",top:typePickerPos.top,left:typePickerPos.left,zIndex:999,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",padding:4,minWidth:130}}>
                                        {[{k:'raw',label:'📝 Raw'},{k:'inv',label:'📦 Inv'},{k:'bg',label:'🥘 BG'}].map(o=>(
                                          <button key={o.k} onClick={()=>ingChangeType(idx,o.k)} style={{display:"block",width:"100%",padding:"6px 10px",textAlign:"left",background:tRow===o.k?C.goldBg:"transparent",border:"none",borderRadius:6,cursor:"pointer",fontSize:11,color:C.text,fontWeight:tRow===o.k?700:500}}>{o.label}{tRow===o.k?" ✓":""}</button>
                                        ))}
                                      </div>
                                    </>
                                  ), document.body)}
                                </td>
                                <td style={{padding:"8px 10px",borderTop:`1px solid ${K.lineSoft}`}}>
                                  {isBg
                                    ? <div style={{padding:"9px 2px",fontSize:13.5,color:K.textMuted}}>{T2("from recipe")}</div>
                                    : nameLocked
                                      ? <div style={{padding:"9px 2px",fontSize:13.5,fontWeight:600,color:K.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.hi||<span style={{color:K.textFaint,fontWeight:500}}>{T2("auto")}</span>}</div>
                                      : <input value={item.hi||""} onChange={e=>ingUpdateItem(idx,"hi",e.target.value)} placeholder="हिन्दी नाम" style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:14,fontWeight:600,color:K.text,background:"#FFFFFF",boxSizing:"border-box",fontFamily:K.fontBody,outline:"none"}}/>
                                  }
                                </td>
                                <td style={{padding:"8px 10px",borderTop:`1px solid ${K.lineSoft}`}}>
                                  {isBg
                                    ? <select className="kh-select" value={item.unit||'kg'} onChange={e=>ingUpdateItem(idx,"unit",e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:10,border:`1px solid ${K.warnBorder}`,fontSize:13.5,color:K.warn,background:"#FFFFFF",fontWeight:700,fontFamily:K.fontBody,cursor:"pointer",outline:"none"}}>{["kg","gm","L","ml","tsp","tbsp","pcs","slice","Bot","tin","bunch","dozen"].map(u=><option key={u} value={u}>{u}</option>)}</select>
                                    : <select className="kh-select" value={item.unit} onChange={e=>ingUpdateItem(idx,"unit",e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:10,border:`1px solid ${isInv?K.accentBorder:K.line}`,fontSize:13.5,color:K.text,background:"#FFFFFF",fontWeight:600,fontFamily:K.fontBody,cursor:"pointer",outline:"none"}}>{["kg","gm","L","ml","tsp","tbsp","pcs","slice","Bot","tin","bunch","dozen"].map(u=><option key={u} value={u}>{u}</option>)}</select>
                                  }
                                </td>
                                <td style={{padding:"8px 10px",borderTop:`1px solid ${K.lineSoft}`}}><input type="number" step="0.01" value={item.qty||""} onChange={e=>ingUpdateQty(idx,e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:13.5,textAlign:"left",color:K.text,background:"#FFFFFF",boxSizing:"border-box",fontWeight:700,fontVariantNumeric:"tabular-nums",fontFamily:K.fontBody,outline:"none"}}/></td>
                                <td style={{padding:"8px 10px",textAlign:"center",whiteSpace:"nowrap",borderTop:`1px solid ${K.lineSoft}`}}>
                                  <span draggable onDragStart={()=>setIngDragIdx(idx)} onDragEnd={()=>setIngDragIdx(null)} title={T2("Drag to reorder")} style={{cursor:"grab",display:"inline-flex",alignItems:"center",gap:2,justifyContent:"center",width:30,height:32,borderRadius:9,color:K.textFaint,userSelect:"none",marginRight:6,verticalAlign:"middle"}}><Icon name="more" size={14} style={{transform:"rotate(90deg)",marginRight:-5}}/><Icon name="more" size={14} style={{transform:"rotate(90deg)"}}/></span>
                                  <button className="kh-rip" onPointerDown={ripple} onClick={()=>ingRemoveItem(idx)} title={T2("Remove row")} style={{width:32,height:32,borderRadius:10,border:`1px solid ${K.dangerBorder}`,background:K.dangerBg,cursor:"pointer",color:K.danger,padding:0,display:"inline-flex",alignItems:"center",justifyContent:"center",verticalAlign:"middle"}}><Icon name="trash" size={15}/></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{display:"flex",gap:12,justifyContent:"space-between",alignItems:"center",padding:"16px 18px",borderTop:`1px solid ${K.cardWarmLine}`,flexWrap:"wrap"}}>
                      <KButton icon="plus" onClick={ingAddItem} style={{padding:"12px 18px",borderRadius:K.rPill,fontSize:14,background:"#FFFFFF",borderColor:K.cardWarmLine}}>{T2("Add Ingredient")}</KButton>
                      <KButton icon="plus" onClick={ingAddSection} style={{padding:"12px 18px",borderRadius:K.rPill,fontSize:14,background:"#FFFFFF",borderColor:K.cardWarmLine}}>{T2("Add Section")}</KButton>
                    </div>
                    {ingDirty&&<div style={{padding:"14px 18px",borderTop:`1px solid ${K.cardWarmLine}`,background:K.warnBg,
                      display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600,color:K.warn}}>
                        <Icon name="alert" size={15} strokeWidth={2.1}/>{T2("Unsaved changes")}
                      </span>
                      <span style={{display:"flex",gap:10}}>
                        <KButton icon="close" onClick={askDiscardIng}
                          style={{padding:"11px 18px",borderRadius:K.rPill,fontSize:14,background:"#FFFFFF",borderColor:K.cardWarmLine}}>{T2("Discard")}</KButton>
                        <KButton variant="brand" icon="check" onClick={saveIngredients}
                          style={{padding:"11px 20px",borderRadius:K.rPill,fontSize:14}}>{T2("Save")}</KButton>
                      </span>
                    </div>}
                    {/* 9A — Ops picker modal (type='inv') — portal to body to escape ancestor containing block */}
                    {opsPickerIdx!==null&&createPortal((
                      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>{setOpsPickerIdx(null);setOpsPickerSearch("");}}>
                        <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:460,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden",border:`2px solid ${C.blueBorder}`}}>
                          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,background:C.blueBg}}>
                            <div style={{fontSize:14,fontWeight:700,color:C.blue,marginBottom:4}}>📦 Pick from Ops Inventory</div>
                            <input value={opsPickerSearch} onChange={e=>setOpsPickerSearch(e.target.value)} placeholder="Search Ops items..." autoFocus style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1px solid ${C.blueBorder}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                          </div>
                          <div style={{overflow:"auto",flex:1,padding:"6px 0"}}>
                            {opsPickerLoading?(<div style={{textAlign:"center",padding:24,color:C.muted,fontSize:12}}>Loading Ops items…</div>):
                              opsPickerItems.filter(it=>{
                                if(!opsPickerSearch)return true;
                                const s=opsPickerSearch.toLowerCase();
                                return (it.name||"").toLowerCase().includes(s)||(it.hi||"").includes(opsPickerSearch)||(it.cat||"").toLowerCase().includes(s)||(it.invId||"").toLowerCase().includes(s);
                              }).slice(0,80).map((it,i)=>(
                                <div key={i} onClick={()=>selectOpsItem(it)} style={{padding:"9px 16px",cursor:"pointer",borderBottom:`1px solid ${C.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}} onMouseOver={e=>e.currentTarget.style.background=C.blueBg} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <div style={{minWidth:0,flex:1}}>
                                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{it.name}{it.hi?<span style={{color:C.muted,fontWeight:400,marginLeft:6}}>({it.hi})</span>:null}</div>
                                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{it.cat} · {it.unit}{it.invId?<span style={{marginLeft:6,color:C.blue,fontWeight:600}}>{it.invId}</span>:null}</div>
                                  </div>
                                </div>
                              ))
                            }
                            {!opsPickerLoading&&opsPickerItems.length===0&&(<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>No Ops items loaded. Check Ops connection.</div>)}
                            {!opsPickerLoading&&opsPickerItems.length>0&&opsPickerItems.filter(it=>{if(!opsPickerSearch)return true;const s=opsPickerSearch.toLowerCase();return (it.name||"").toLowerCase().includes(s)||(it.hi||"").includes(opsPickerSearch)||(it.cat||"").toLowerCase().includes(s)||(it.invId||"").toLowerCase().includes(s);}).length===0&&(<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>No matches</div>)}
                          </div>
                          <div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`}}>
                            <button onClick={()=>{setOpsPickerIdx(null);setOpsPickerSearch("");}} style={{width:"100%",padding:"10px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ Cancel</button>
                          </div>
                        </div>
                      </div>
                    ),document.body)}
                    {/* 9A — BG recipe picker modal (type='bg') — portal to body */}
                    {bgPickerIdx!==null&&createPortal((
                      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>{setBgPickerIdx(null);setBgPickerSearch("");}}>
                        <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:420,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden",border:`2px solid ${C.amberBorder}`}}>
                          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,background:C.amberBg}}>
                            <div style={{fontSize:14,fontWeight:700,color:C.amber,marginBottom:4}}>🥘 Pick a Base Gravy</div>
                            <input value={bgPickerSearch} onChange={e=>setBgPickerSearch(e.target.value)} placeholder="Search base gravy recipes..." autoFocus style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1px solid ${C.amberBorder}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                          </div>
                          <div style={{overflow:"auto",flex:1,padding:"6px 0"}}>
                            {(() => {
                              const bgs = getAllBgRecipes().filter(r => !opsPickerIdx && (!bgPickerSearch || r.n.toLowerCase().includes(bgPickerSearch.toLowerCase()) || (r.catName||"").toLowerCase().includes(bgPickerSearch.toLowerCase())));
                              if (bgs.length === 0) return (<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>No base-gravy recipes found. Mark a recipe with 🥘 Base Gravy in its SOP first.</div>);
                              return bgs.map((r,i)=>(
                                <div key={i} onClick={()=>selectBgRecipe(r)} style={{padding:"10px 16px",cursor:"pointer",borderBottom:`1px solid ${C.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}} onMouseOver={e=>e.currentTarget.style.background=C.amberBg} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{r.n}</div>
                                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{r.catName}</div>
                                  </div>
                                  <div style={{fontSize:11,color:C.amber,fontWeight:700}}>🥘</div>
                                </div>
                              ));
                            })()}
                          </div>
                          <div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`}}>
                            <button onClick={()=>{setBgPickerIdx(null);setBgPickerSearch("");}} style={{width:"100%",padding:"10px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ Cancel</button>
                          </div>
                        </div>
                      </div>
                    ),document.body)}
                  </div>
                ):sopRecipe.ingredients?.items?.length>0?(()=>{
                  const ing2=sopRecipe.ingredients;
                  const firstIng=ing2.items.find(it=>!it.isSection);
                  const isNewSchema=firstIng?(typeof firstIng.qty==='number'||firstIng.qty===null):true;
                  const basePax=ing2.base_pax||300;
                  const yKg=ing2.base_yield?.kg;
                  const yPcs=ing2.base_yield?.pcs;
                  const yieldLabel=yKg?`${yKg} kg${yPcs?` (~${yPcs} pcs)`:''}`:null;
                  const th={padding:"12px 14px",fontSize:11.5,fontWeight:700,letterSpacing:".5px",textTransform:"uppercase",
                    color:K.hdrMeta,borderBottom:`1px solid ${K.cardWarmLine}`,whiteSpace:"nowrap"};
                  let rowNo=0;
                  return (
                  <div className="kh-cardart-sm" style={{marginBottom:16,borderRadius:18,backgroundColor:K.cardWarm,
                    border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,overflow:"hidden"}}>
                    <div style={{padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                      <span style={{display:"flex",alignItems:"center",gap:11,minWidth:0}}>
                        <span style={{color:K.sbGold,display:"flex",flexShrink:0}}><Icon name="listCheck" size={21} strokeWidth={1.8}/></span>
                        <span style={{fontSize:16,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle}}>
                          {T2("Ingredients")} <span style={{color:K.textFaint,fontWeight:500}}>·</span> {isNewSchema?`${basePax} ${T2("pax anchor")}`:(ing2.pax_sizes?.map(p=>p+" pax").join(" / ")||T2("legacy"))}
                        </span>
                      </span>
                      <span style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                        {isNewSchema&&(yieldLabel
                          ?<span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,color:K.ok}}><Icon name="check" size={14} strokeWidth={2.2}/>{T2("Yield")}: {yieldLabel}</span>
                          :<span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,color:K.warn}}><Icon name="alert" size={14} strokeWidth={2.2}/>{T2("Yield not set")}</span>)}
                        <span style={{width:1,height:18,background:K.cardWarmLine}}/>
                        <span style={{fontSize:13,fontWeight:700,color:K.hdrMeta}}>{basePax} pax</span>
                      </span>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{borderCollapse:"collapse",fontSize:13,width:"100%",background:"#FFFFFF"}}>
                        <thead><tr>
                          <th style={{...th,textAlign:"center",width:52}}>#</th>
                          <th style={{...th,textAlign:"left",minWidth:180}}>{T2("Item")}</th>
                          <th style={{...th,textAlign:"center",minWidth:70}}>{T2("Unit")}</th>
                          {isNewSchema
                            ?<th style={{...th,textAlign:"center",minWidth:150}}>{T2("Quantity")} ({T2("for")} {basePax} pax)</th>
                            :ing2.pax_sizes?.map((p,pi)=>(
                              <th key={pi} style={{...th,textAlign:"center",minWidth:70}}>{p}</th>
                            ))}
                          <th style={{...th,textAlign:"left",minWidth:110}}>{T2("Notes")}</th>
                          {currentUser?.role==='admin'&&<th style={{...th,textAlign:"center",width:96}}>{T2("Actions")}</th>}
                        </tr></thead>
                        <tbody>
                          {ing2.items.map((ing,ii)=>{
                            const nCols=(isNewSchema?4:3+(ing2.pax_sizes?.length||0))+1+(currentUser?.role==='admin'?1:0);
                            if(ing.isSection){
                              const secYk=ing.yield?.kg,secYp=ing.yield?.pcs;
                              const secYldLbl=secYk?`${secYk} kg${secYp?` (~${secYp} pcs)`:''}`:(secYp?`${secYp} pcs`:null);
                              return(
                              <tr key={ii} style={{background:K.brandBg}}>
                                <td colSpan={nCols} style={{padding:"9px 14px",fontWeight:700,color:K.brandText,fontSize:11.5,
                                  letterSpacing:".5px",textTransform:"uppercase",borderTop:`1px solid ${K.brandBorder}`,borderBottom:`1px solid ${K.brandBorder}`}}>
                                  {ing.name}{ing.hi?` / ${ing.hi}`:""}
                                  {secYldLbl&&<span style={{marginLeft:10,fontSize:11,fontWeight:600,color:K.ok,textTransform:"none",letterSpacing:0}}>{T2("Yield")}: {secYldLbl}</span>}
                                </td>
                              </tr>);
                            }
                            rowNo++;
                            const hi=ing.hi??ing.hindi;
                            const rowType=ing.type==='inv'?'inv':ing.type==='bg'?'bg':'raw';
                            const typeIcon=rowType==='inv'?'box':rowType==='bg'?'utensils':'note';
                            const typeTitle=rowType==='inv'?T2("Inventory-mapped item"):rowType==='bg'?T2("Base gravy"):T2("Raw ingredient");
                            const typeColor=rowType==='inv'?K.accent:rowType==='bg'?K.warn:K.textFaint;
                            const td={padding:"11px 14px",borderTop:`1px solid ${K.lineSoft}`,color:K.text};
                            return(
                            <tr key={ii}>
                              <td style={{...td,textAlign:"center"}}>
                                <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,
                                  borderRadius:"50%",background:K.surfaceAlt,border:`1px solid ${K.line}`,
                                  fontSize:12,fontWeight:700,color:K.textMuted}}>{rowNo}</span>
                              </td>
                              <td style={td}>
                                <span style={{display:"flex",alignItems:"flex-start",gap:9}}>
                                  <span title={typeTitle} style={{color:typeColor,flexShrink:0,paddingTop:1}}><Icon name={typeIcon} size={15} strokeWidth={1.9}/></span>
                                  <span style={{minWidth:0}}>
                                    <span style={{display:"block",fontWeight:600,color:K.text}}>{ing.name}</span>
                                    {/* Devanagari at the same size and weight as
                                        Latin reads noticeably lighter, so the
                                        Hindi line gets a darker tone than a
                                        secondary line would normally take. */}
                                    {hi&&<span style={{display:"block",fontSize:12.5,fontWeight:500,color:K.textMuted,marginTop:2}}>{hi}</span>}
                                  </span>
                                </span>
                              </td>
                              <td style={{...td,textAlign:"center",color:K.textMuted}}>{ing.unit}</td>
                              {isNewSchema
                                ?<td style={{...td,textAlign:"center",fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{ing.qty??"—"}</td>
                                :Array.isArray(ing.qty)?ing.qty.map((q,qi)=>(
                                  <td key={qi} style={{...td,textAlign:"center",fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{q||"—"}</td>
                                )):null}
                              <td style={{...td,color:K.textFaint}}>{ing.note||"—"}</td>
                              {/* Both actions open the ingredient editor, which is
                                  the one place that writes this table back to
                                  Supabase. A row-level delete here would need a
                                  second save path — deliberately not duplicated. */}
                              {currentUser?.role==='admin'&&(
                                <td style={{...td,textAlign:"center",whiteSpace:"nowrap"}}>
                                  <button className="kh-iconbtn kh-rip" onPointerDown={ripple} title={T2("Edit in ingredient editor")}
                                    onClick={()=>openIngEditor(sopRecipe,sopCat)}
                                    style={{width:30,height:30,borderRadius:8,background:"transparent",border:"none",
                                      color:K.textMuted,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0}}>
                                    <Icon name="note" size={15}/>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );})}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  );})()
                :fallbackIng?(
                  <div style={{marginBottom:16,borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                    <div style={{padding:"8px 12px",background:C.amberBg,fontSize:11,fontWeight:700,color:C.amber,borderBottom:`1px solid ${C.amberBorder}`}}>
                      Ingredients (legacy per-serving @ 500 pax)
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{borderCollapse:"collapse",fontSize:11,width:"100%"}}>
                        <thead><tr style={{background:C.surface}}>
                          <th style={{padding:"6px 10px",textAlign:"left",color:C.muted,borderRight:`1px solid ${C.borderLight}`,minWidth:120}}>Item</th>
                          <th style={{padding:"6px 6px",textAlign:"center",color:C.muted,minWidth:36}}>Unit</th>
                          <th style={{padding:"6px 8px",textAlign:"right",color:C.amber,borderLeft:`1px solid ${C.borderLight}`,minWidth:70}}>500 pax</th>
                        </tr></thead>
                        <tbody>
                          {fallbackIng.filter(ig=>ig.q>0).map((ing,ii)=>{
                            const raw=ing._newFmt?ing.q:ing.q*500;
                            const fmt=fmtQty(ing);
                            return(
                            <tr key={ii} style={{borderTop:`1px solid ${C.borderLight}`,background:ii%2===0?C.surface:C.darkCard}}>
                              <td style={{padding:"5px 10px",borderRight:`1px solid ${C.borderLight}`}}>
                                <div style={{fontWeight:600,color:C.text}}>{ing.n}</div>
                                {ing.h&&<div style={{fontSize:9,color:C.faint}}>{ing.h}</div>}
                              </td>
                              <td style={{padding:"5px 6px",textAlign:"center",color:C.faint,fontSize:10}}>{ing.u}</td>
                              <td style={{padding:"5px 8px",textAlign:"right",color:C.amber,fontWeight:600,borderLeft:`1px solid ${C.borderLight}`}}>{fmt}</td>
                            </tr>);
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ):<div style={{marginBottom:16}}/>}
                </>);})()}
                {/* —— Yield anchor (base_yield @ base_pax) — moved below ingredient table —— */}
                {!editingSteps&&(()=>{
                  const basePax = sopRecipe.ingredients?.base_pax || 300;
                  const by = sopRecipe.ingredients?.base_yield || {};
                  const kg = by.kg;
                  const pcs = by.pcs;
                  const hasYield = kg != null && kg !== "" && +kg > 0;
                  if (editingYield) {
                    return (
                      <div className="kh-cardart-sm" style={{margin:"0 0 20px",padding:"18px 20px",borderRadius:18,
                        background:K.brandSoft,border:`1px solid ${K.brandBorder}`,boxShadow:K.shadowCard}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:12}}>
                          <span style={{display:"flex",alignItems:"center",gap:14,minWidth:0}}>
                            <span style={{width:44,height:44,borderRadius:14,flexShrink:0,background:"#FFFFFF",
                              border:`1px solid ${K.brandBorder}`,color:K.brand,
                              display:"flex",alignItems:"center",justifyContent:"center"}}>
                              <Icon name="utensils" size={22} strokeWidth={1.8}/>
                            </span>
                            <span style={{minWidth:0}}>
                              <span style={{display:"block",fontSize:16,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle}}>
                                {T2("Base yield at")} {basePax} pax
                              </span>
                              <span style={{display:"block",fontSize:13,color:K.hdrMeta,marginTop:2}}>
                                {T2("Finished output in kg is what scales the ingredients. Pieces are informational.")}
                              </span>
                            </span>
                          </span>
                          <div style={{display:"flex",gap:10,flexShrink:0}}>
                            <KButton icon="close" onClick={()=>setEditingYield(false)}
                              style={{padding:"11px 18px",borderRadius:K.rPill,fontSize:14,background:"#FFFFFF",borderColor:K.cardWarmLine}}>{T2("Cancel")}</KButton>
                            <KButton variant="brand" icon="check" style={{padding:"11px 20px",borderRadius:K.rPill,fontSize:14}} onClick={()=>{
                              const newKg = yieldForm.kg==="" || yieldForm.kg==null ? null : parseFloat(yieldForm.kg) || null;
                              const newPcs = yieldForm.pcs==="" || yieldForm.pcs==null ? null : parseFloat(yieldForm.pcs) || null;
                              const newIng = {...(sopRecipe.ingredients||{}), base_pax: basePax, base_yield: {kg: newKg, pcs: newPcs}};
                              if (supabase) {
                                supabase.from('recipes').update({ ingredients: newIng }).eq('dish_name', sopRecipe.n).eq('category_id', sopCat).then(r => {
                                  if (r.error) console.error('Yield save err:', r.error);
                                  else {
                                    const arr = RECIPE_DB.recipes[sopCat]||[];
                                    const ri = arr.findIndex(x=>x.n===sopRecipe.n);
                                    if (ri>=0) arr[ri] = {...arr[ri], ingredients: newIng};
                                    setSopRecipe(p => ({...p, ingredients: newIng}));
                                    console.log('— Yield saved:', newKg, 'kg /', newPcs, 'pcs');
                                  }
                                });
                              }
                              setEditingYield(false);
                            }}>{T2("Save")}</KButton>
                          </div>
                        </div>
                        {/* Unit lives inside the field, not as a floating note
                            beside it — the old "@ 300 pax" text sat between the
                            two inputs and read as if it belonged to neither. */}
                        {(()=>{
                          const field={display:"flex",alignItems:"center",background:"#FFFFFF",borderRadius:12,
                            border:`1px solid ${K.line}`,overflow:"hidden",width:172};
                          const inp={flex:1,minWidth:0,padding:"12px 0 12px 14px",border:"none",outline:"none",
                            background:"transparent",fontSize:17,fontWeight:700,color:K.text,
                            fontFamily:K.fontBody,fontVariantNumeric:"tabular-nums"};
                          const unit={padding:"0 14px 0 8px",fontSize:13,fontWeight:700,color:K.textFaint,flexShrink:0};
                          return(
                          <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-end"}}>
                            <div>
                              <div style={{...type.label,fontSize:10.5,color:K.hdrMeta,marginBottom:6}}>
                                {T2("Finished weight")} <span style={{color:K.danger}}>*</span>
                              </div>
                              <div style={{...field,borderColor:K.brandBorder,boxShadow:`0 0 0 3px ${K.brandBg}`}}>
                                <input type="number" step="0.1" inputMode="decimal" autoFocus
                                  value={yieldForm.kg ?? ""}
                                  onChange={e=>setYieldForm(p=>({...p, kg: e.target.value}))}
                                  placeholder="20" style={inp}/>
                                <span style={unit}>kg</span>
                              </div>
                            </div>
                            <div>
                              <div style={{...type.label,fontSize:10.5,color:K.hdrMeta,marginBottom:6}}>
                                {T2("Pieces")} <span style={{fontWeight:500,letterSpacing:0,textTransform:"none",color:K.textFaint}}>({T2("optional")})</span>
                              </div>
                              <div style={field}>
                                <input type="number" step="1" inputMode="decimal"
                                  value={yieldForm.pcs ?? ""}
                                  onChange={e=>setYieldForm(p=>({...p, pcs: e.target.value}))}
                                  placeholder="400" style={inp}/>
                                <span style={unit}>pcs</span>
                              </div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:7,paddingBottom:13,fontSize:13,color:K.hdrMeta}}>
                              <Icon name="users" size={14} strokeWidth={1.9}/>{T2("at")} {basePax} pax
                            </div>
                          </div>);
                        })()}
                      </div>
                    );
                  }
                  return (
                    <div className="kh-cardart-sm" style={{margin:"0 0 20px",padding:"18px 20px",borderRadius:18,
                      background:hasYield?K.brandSoft:K.warnBg,border:`1px solid ${hasYield?K.brandBorder:K.warnBorder}`,
                      display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:16,minWidth:0}}>
                        <span style={{color:hasYield?K.brand:K.warn,display:"flex",flexShrink:0}}><Icon name="utensils" size={30} strokeWidth={1.6}/></span>
                        <div style={{minWidth:0}}>
                          {hasYield ? (
                            <>
                              <div style={{...type.label,fontSize:11,color:K.hdrMeta,marginBottom:3}}>{T2("Base yield")} @ {basePax} pax</div>
                              <div style={{fontSize:21,fontWeight:800,letterSpacing:"-0.4px",color:K.hdrTitle}}>{kg} kg{pcs?<span style={{fontSize:14,fontWeight:600,color:K.hdrMeta,marginLeft:9}}>~{pcs} pcs</span>:null}</div>
                            </>
                          ) : (
                            <>
                              <div style={{fontSize:16,fontWeight:700,letterSpacing:"-0.2px",color:K.warn,marginBottom:3}}>{T2("Yield not set")}</div>
                              <div style={{fontSize:13,color:K.hdrMeta}}>{T2("Required for kg-based scaling. Set the finished output at")} {basePax} pax.</div>
                            </>
                          )}
                        </div>
                      </div>
                      {currentUser?.role==='admin' && !editingSteps && (
                        <KButton variant={hasYield?"brand":"accent"} icon={hasYield?"note":"plus"}
                          onClick={()=>{ setYieldForm({kg: kg ?? "", pcs: pcs ?? ""}); setEditingYield(true); }}
                          style={{padding:"13px 22px",borderRadius:K.rPill,fontSize:14,
                            ...(hasYield?{}:{background:K.warn,boxShadow:"0 4px 14px rgba(196,121,12,.28)"})}}>
                          {hasYield?T2("Edit yield"):T2("Add yield")}
                        </KButton>
                      )}
                    </div>
                  );
                })()}

                {/* ── Procedure panel ── */}
                <div className="kh-cardart-sm" style={{borderRadius:editingSteps?"0 0 18px 18px":18,backgroundColor:K.cardWarm,
                  border:`1px solid ${K.cardWarmLine}`,borderTop:editingSteps?"none":`1px solid ${K.cardWarmLine}`,
                  boxShadow:K.shadowCard,padding:"18px 20px 20px",marginTop:editingSteps?-16:0}}>
                {!editingSteps&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
                  <span style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                    <span style={{color:K.sbGold,display:"flex",flexShrink:0}}><Icon name="chefHat" size={26} strokeWidth={1.7}/></span>
                    <span style={{minWidth:0}}>
                      <span style={{display:"block",fontSize:16,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle}}>{T2("Procedure")}</span>
                      <span style={{display:"block",fontSize:13,color:K.hdrMeta,marginTop:2}}>{T2("Step-by-step process to prepare this recipe")}</span>
                    </span>
                  </span>
                  {currentUser?.role==='admin'&&!editingSteps&&(
                    // Enters the step editor with one blank step already added.
                    // sopAddStep is a functional update, so it lands on the form
                    // openSopEdit just queued rather than on a stale one.
                    <KButton icon="plus" onClick={()=>{openSopEdit(sopRecipe,sopCat);setEditingSteps(true);sopAddStep();}}
                      style={{padding:"12px 18px",borderRadius:K.rPill,fontSize:14,background:K.cardWarm,borderColor:K.cardWarmLine}}>{T2("Add step")}</KButton>
                  )}
                </div>}
                {editingSteps?(
                  <div>
                    <div style={{...type.label,fontSize:10.5,color:K.hdrMeta,marginBottom:10}}>
                      {T2("Steps")} ({sopForm.steps.length})
                    </div>
                    {sopForm.steps.map((step,si)=>(
                      // Each step is its own card. Rows separated only by a
                      // hairline ran together once a step had sub-steps, and
                      // there was no way to see where one ended.
                      <div key={si} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10,
                        padding:"14px",borderRadius:14,backgroundColor:"#FFFFFF",
                        border:`1px solid ${step.ccp?K.dangerBorder:K.cardWarmLine}`,
                        borderLeft:`3px solid ${step.ccp?K.danger:K.brand}`,boxShadow:K.shadowCard}}>
                        <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"center",flexShrink:0}}>
                          <span style={{display:"flex",alignItems:"center",justifyContent:"center",width:30,height:30,
                            borderRadius:"50%",background:step.ccp?K.danger:K.brand,color:"#FFFFFF",
                            fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{si+1}</span>
                          {/* Both reorder buttons rendered as a literal "?" - a
                              mojibake glyph where an arrow used to be. */}
                          <button onClick={()=>sopMoveStep(si,-1)} disabled={si===0} title={T2("Move up")}
                            style={{width:28,height:24,borderRadius:8,border:`1px solid ${K.line}`,background:K.surfaceAlt,
                              color:si>0?K.textMuted:K.lineStrong,cursor:si>0?"pointer":"default",padding:0,
                              display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <Icon name="chevronD" size={13} strokeWidth={2.3} style={{transform:"rotate(180deg)"}}/>
                          </button>
                          <button onClick={()=>sopMoveStep(si,1)} disabled={si===sopForm.steps.length-1} title={T2("Move down")}
                            style={{width:28,height:24,borderRadius:8,border:`1px solid ${K.line}`,background:K.surfaceAlt,
                              color:si<sopForm.steps.length-1?K.textMuted:K.lineStrong,
                              cursor:si<sopForm.steps.length-1?"pointer":"default",padding:0,
                              display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <Icon name="chevronD" size={13} strokeWidth={2.3}/>
                          </button>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <input value={step.t} onChange={e=>sopFormStep(si,"t",e.target.value)} placeholder={T2("Step title")}
                            style={{width:"100%",padding:"10px 13px",borderRadius:10,border:`1px solid ${K.line}`,
                              fontSize:14.5,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle,background:"#FFFFFF",
                              boxSizing:"border-box",marginBottom:8,fontFamily:K.fontBody,outline:"none"}}/>
                          <textarea value={step.i} onChange={e=>sopFormStep(si,"i",e.target.value)} placeholder={T2("Instructions (Hindi)")} rows={2}
                            style={{width:"100%",padding:"10px 13px",borderRadius:10,border:`1px solid ${K.line}`,
                              fontSize:14,fontWeight:500,color:K.text,background:"#FFFFFF",boxSizing:"border-box",
                              resize:"vertical",minHeight:64,marginBottom:10,fontFamily:K.fontBody,outline:"none",lineHeight:1.5}}/>
                          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                            {/* A step with sub-steps takes its time from them, so
                                the timer is hidden rather than left to contradict. */}
                            {!(step.subs&&step.subs.length>0)&&(
                              <span style={{display:"flex",alignItems:"center",background:"#FFFFFF",borderRadius:10,
                                border:`1px solid ${K.line}`,overflow:"hidden",width:126}}>
                                <span style={{padding:"0 0 0 11px",color:K.textFaint,display:"flex"}}><Icon name="clock" size={14} strokeWidth={2}/></span>
                                <input type="number" step="0.5" value={step.tm?Math.round(step.tm/60*10)/10:""}
                                  onChange={e=>sopFormStep(si,"tm",Math.round((parseFloat(e.target.value)||0)*60))}
                                  placeholder="0"
                                  style={{flex:1,minWidth:0,padding:"9px 0 9px 8px",border:"none",outline:"none",background:"transparent",
                                    fontSize:14,fontWeight:700,color:K.text,fontFamily:K.fontBody,fontVariantNumeric:"tabular-nums"}}/>
                                <span style={{padding:"0 11px 0 4px",fontSize:12.5,fontWeight:700,color:K.textFaint}}>min</span>
                              </span>
                            )}
                            <span style={{display:"flex",alignItems:"center",background:"#FFFFFF",borderRadius:10,
                              border:`1px solid ${step.ccp?K.dangerBorder:K.line}`,overflow:"hidden",flex:"1 1 200px",minWidth:0}}>
                              <span style={{padding:"0 0 0 11px",fontSize:11,fontWeight:700,letterSpacing:".5px",
                                color:step.ccp?K.danger:K.textFaint}}>CCP</span>
                              <input value={step.ccp} onChange={e=>sopFormStep(si,"ccp",e.target.value)} list={"ccp-opts-"+si}
                                placeholder={T2("Critical control (optional)")}
                                style={{flex:1,minWidth:0,padding:"9px 11px 9px 9px",border:"none",outline:"none",background:"transparent",
                                  fontSize:13.5,color:K.text,fontFamily:K.fontBody}}/>
                            </span>
                            {/* D-1 is a state, so it reads as a chip that fills
                                when on, not a bare checkbox with a loose label. */}
                            <label style={{display:"inline-flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0,
                              padding:"9px 14px",borderRadius:10,fontSize:13,fontWeight:700,
                              background:step.d1?K.brandBg:"#FFFFFF",
                              border:`1px solid ${step.d1?K.brandBorder:K.line}`,
                              color:step.d1?K.brandText:K.textMuted}}>
                              <input type="checkbox" checked={step.d1} onChange={e=>sopFormStep(si,"d1",e.target.checked)}
                                style={{width:15,height:15,accentColor:K.brand,cursor:"pointer",margin:0}}/>
                              {T2("Prep a day ahead")}
                            </label>
                          </div>
                          {(step.subs&&step.subs.length>0)&&(
                            <div style={{marginTop:14}}>
                              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                                <span style={{...type.label,fontSize:10.5,color:K.hdrMeta}}>
                                  {T2("Sub-steps")} ({step.subs.length})
                                </span>
                                {step.d1&&<span style={{fontSize:11,fontWeight:700,color:K.brandText,background:K.brandBg,
                                  padding:"3px 9px",borderRadius:K.rPill,border:`1px solid ${K.brandBorder}`}}>{T2("Prepped a day ahead")}</span>}
                                <span style={{flex:1,height:1,background:K.cardWarmLine,minWidth:10}}/>
                              </div>
                              {step.subs.map((sb,sbi)=>(
                                <div key={sbi} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10,
                                  padding:"12px",borderRadius:13,background:K.surfaceAlt,
                                  border:`1px solid ${sb.ccp?K.dangerBorder:K.line}`}}>
                                  {/* 1a, 1b … rather than a bare letter: a chef
                                      reading the printed SOP calls it out that way. */}
                                  <span style={{display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                                    width:38,height:38,borderRadius:11,background:K.brandBg,border:`1px solid ${K.brandBorder}`,
                                    fontSize:13,fontWeight:700,color:K.brandText}}>{si+1}{String.fromCharCode(97+sbi)}</span>
                                  <div style={{flex:1,minWidth:0}}>
                                    <input value={sb.t} onChange={e=>sopEditSub(si,sbi,"t",e.target.value)}
                                      placeholder={T2("Sub-step title")}
                                      style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1px solid ${K.line}`,
                                        fontSize:13.5,fontWeight:700,color:K.hdrTitle,background:"#FFFFFF",boxSizing:"border-box",
                                        marginBottom:8,fontFamily:K.fontBody,outline:"none"}}/>
                                    <textarea value={sb.i} onChange={e=>sopEditSub(si,sbi,"i",e.target.value)}
                                      placeholder={T2("Instructions (Hindi)")} rows={2}
                                      style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1px solid ${K.line}`,
                                        fontSize:14,color:K.text,background:"#FFFFFF",boxSizing:"border-box",resize:"vertical",
                                        minHeight:56,marginBottom:8,fontFamily:K.fontBody,outline:"none",lineHeight:1.5}}/>
                                    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                                      <span style={{display:"flex",alignItems:"center",background:"#FFFFFF",borderRadius:10,
                                        border:`1px solid ${K.line}`,overflow:"hidden",width:150}}>
                                        <span style={{display:"flex",alignItems:"center",gap:6,padding:"0 0 0 11px",
                                          fontSize:12,fontWeight:700,color:K.warn}}>
                                          <Icon name="clock" size={14} strokeWidth={2}/>{T2("Timer")}
                                        </span>
                                        <input type="number" step="0.5" value={sb.tm?Math.round(sb.tm/60*10)/10:""}
                                          onChange={e=>sopEditSub(si,sbi,"tm",String(Math.round((parseFloat(e.target.value)||0)*60)))}
                                          placeholder="0"
                                          style={{flex:1,minWidth:0,padding:"9px 0 9px 8px",border:"none",outline:"none",
                                            background:"transparent",fontSize:14,fontWeight:700,color:K.text,
                                            fontFamily:K.fontBody,fontVariantNumeric:"tabular-nums"}}/>
                                        <span style={{padding:"0 11px 0 4px",fontSize:12.5,fontWeight:700,color:K.textFaint}}>min</span>
                                      </span>
                                      <span style={{display:"flex",alignItems:"center",background:"#FFFFFF",borderRadius:10,
                                        border:`1px solid ${sb.ccp?K.dangerBorder:K.line}`,overflow:"hidden",flex:"1 1 220px",minWidth:0}}>
                                        <span style={{display:"flex",alignItems:"center",gap:6,padding:"0 0 0 11px",
                                          fontSize:11,fontWeight:700,letterSpacing:".5px",color:sb.ccp?K.danger:K.textFaint}}>
                                          <span style={{width:7,height:7,borderRadius:"50%",background:sb.ccp?K.danger:K.lineStrong}}/>CCP
                                        </span>
                                        {/* A datalist, so one control both offers
                                            the wordings already used elsewhere in
                                            this recipe and accepts a new one. */}
                                        <input value={sb.ccp||""} onChange={e=>sopEditSub(si,sbi,"ccp",e.target.value)}
                                          list={"ccp-opts-"+si} placeholder={T2("Critical control (optional)")}
                                          style={{flex:1,minWidth:0,padding:"9px 11px 9px 9px",border:"none",outline:"none",
                                            background:"transparent",fontSize:13.5,color:K.text,fontFamily:K.fontBody}}/>
                                      </span>
                                    </div>
                                  </div>
                                  <button onClick={()=>sopRemoveSub(si,sbi)} className="kh-rip" onPointerDown={ripple}
                                    title={T2("Remove sub-step")}
                                    style={{width:34,height:34,borderRadius:10,flexShrink:0,border:`1px solid ${K.dangerBorder}`,
                                      background:K.dangerBg,color:K.danger,cursor:"pointer",padding:0,
                                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    <Icon name="trash" size={15}/>
                                  </button>
                                </div>
                              ))}
                              {/* One datalist per step, feeding every sub-step's
                                  CCP field with the values already in use. */}
                              <datalist id={"ccp-opts-"+si}>
                                {[...new Set(safeArr(sopForm.steps).flatMap(s=>[s.ccp,...safeArr(s.subs).map(x=>x.ccp)]).filter(Boolean))]
                                  .map(v=><option key={v} value={v}/>)}
                              </datalist>
                            </div>
                          )}
                          <button onClick={()=>sopAddSub(si)} className="kh-rip" onPointerDown={ripple} style={{display:"inline-flex",alignItems:"center",gap:7,marginTop:10,padding:"8px 14px",borderRadius:K.rPill,background:"#FFFFFF",border:`1px solid ${K.line}`,color:K.textBody,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:K.fontBody}}><Icon name="plus" size={14} strokeWidth={2.1}/>{T2("Add sub-step")}</button>
                        </div>
                        {/* Was a 24px square whose label was a literal em dash —
                            another mangled glyph — floating clear of the fields
                            it belongs to. Now a trash button sized and aligned
                            to the title input beside it. */}
                        <button onClick={()=>sopRemoveStep(si)} className="kh-rip" onPointerDown={ripple} title={T2("Remove step")}
                          style={{width:38,height:38,borderRadius:10,border:`1px solid ${K.dangerBorder}`,background:K.dangerBg,
                            cursor:"pointer",color:K.danger,flexShrink:0,padding:0,
                            display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <Icon name="trash" size={16}/>
                        </button>
                      </div>
                    ))}
                    {/* Dashed, because it adds a row that does not exist yet —
                        the same signal the Add Category tile uses. */}
                    <button onClick={sopAddStep} className="kh-sopadd kh-rip" onPointerDown={ripple}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",gap:9,width:"100%",
                        padding:"14px",borderRadius:14,background:K.brandSoft,border:`1.5px dashed ${K.brandBorder}`,
                        color:K.brandText,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4,
                        fontFamily:K.fontBody,transition:"background .16s, border-color .16s"}}>
                      <Icon name="plus" size={16} strokeWidth={2.1}/>{T2("Add step")}
                    </button>
                    <div style={{display:"flex",gap:10,marginTop:16,justifyContent:"flex-end",flexWrap:"wrap"}}>
                      <KButton icon="close" onClick={()=>{setEditingSteps(false);setSopModal(null);}}
                        style={{padding:"13px 20px",borderRadius:K.rPill,fontSize:14,background:"#FFFFFF",borderColor:K.cardWarmLine}}>{T2("Cancel")}</KButton>
                      <KButton variant="brand" icon="check" onClick={()=>{saveSop();setEditingSteps(false);}}
                        style={{padding:"13px 26px",borderRadius:K.rPill,fontSize:14}}>{T2("Save recipe")}</KButton>
                    </div>
                  </div>
                ):(
                  safeArr(sopRecipe.steps).map((step,si)=>(
                    <div key={si} className="kh-sopcard" style={{marginBottom:10,padding:"14px 16px",borderRadius:14,
                      background:step.ccp?K.dangerBg:"#FFFFFF",
                      border:`1px solid ${step.ccp?K.dangerBorder:K.cardWarmLine}`,
                      ...(step.ccp?{borderLeft:`3px solid ${K.danger}`}:{})}}>
                      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                        <div style={{width:34,height:34,borderRadius:"50%",background:step.ccp?K.danger:K.brand,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,
                          color:"#FFFFFF",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{si+1}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle,marginBottom:3}}>
                            {cleanStepText(step.t)}
                            {Array.isArray(step.subs)&&step.subs.length>0&&<span style={{fontSize:12,color:K.textFaint,fontWeight:500,marginLeft:9}}>({step.subs.length} {T2("sub-steps")})</span>}
                          </div>
                          <div style={{fontSize:13,color:K.hdrMeta,lineHeight:1.55}}>{cleanStepText(step.i||step.desc||"")}</div>
                          {step.tm&&<span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:K.warn,background:K.warnBg,border:`1px solid ${K.warnBorder}`,padding:"4px 10px",borderRadius:K.rPill,marginTop:8}}><Icon name="clock" size={12} strokeWidth={2.1}/>{fmtT(step.tm)}</span>}
                          {step.ccp&&<span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:K.danger,background:"#FFFFFF",border:`1px solid ${K.dangerBorder}`,padding:"4px 10px",borderRadius:K.rPill,marginTop:8,marginLeft:7}}><Icon name="alert" size={12} strokeWidth={2.1}/>CCP: {step.ccp}</span>}
                        </div>
                        {currentUser?.role==='admin'&&(
                          <button className="kh-sopmenu is-open kh-rip" onPointerDown={ripple} title={T2("Edit steps")}
                            onClick={()=>{openSopEdit(sopRecipe,sopCat);setEditingSteps(true);}}
                            style={{width:30,height:30,borderRadius:"50%",flexShrink:0,background:"#FFFFFF",
                              border:`1px solid ${K.cardWarmLine}`,color:K.textMuted,cursor:"pointer",
                              display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                            <Icon name="more" size={15}/>
                          </button>
                        )}
                      </div>
                      {Array.isArray(step.subs)&&step.subs.length>0&&(
                        <div style={{borderLeft:`2px solid ${C.gold}`,marginLeft:16,marginTop:8,paddingLeft:12}}>
                          {step.subs.map((sb,sbi)=>(
                            <div key={sbi} style={{padding:sb.ccp?"8px 10px":"6px 0",borderBottom:sbi<step.subs.length-1?`1px solid ${C.borderLight}`:"none",...(sb.ccp?{background:C.redBg,borderLeft:`3px solid ${C.red}`,marginLeft:-8,paddingLeft:8,borderRadius:6,marginBottom:2}:{})}}>
                              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                                <span style={{fontSize:11,fontWeight:700,color:sb.ccp?C.red:C.gold,minWidth:22}}>{si+1}{String.fromCharCode(97+sbi)}.</span>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:12,fontWeight:600,color:C.text}}>{sb.t}</div>
                                  {sb.i&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{sb.i}</div>}
                                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:sb.tm||sb.ccp?4:0}}>
                                    {sb.tm&&<span style={{fontSize:11,color:C.amber,background:C.amberBg,padding:"3px 8px",borderRadius:6,display:"inline-block"}}>⏱ {fmtT(sb.tm)}</span>}
                                    {sb.ccp&&<span style={{fontSize:11,color:C.red,background:"#fff",padding:"3px 8px",borderRadius:6,display:"inline-block",fontWeight:600,border:`1px solid ${C.redBorder}`}}>🔴 CCP: {sb.ccp}</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
                {/* ——— CCP Summary Table ——— */}
                {(()=>{
                  const rows=[];
                  safeArr(sopRecipe.steps).forEach((s,si)=>{
                    if(s.ccp) rows.push({label:`${si+1}`,process:cleanStepText(s.t),ccp:s.ccp});
                    (s.subs||[]).forEach((sb,sbi)=>{
                      if(sb.ccp) rows.push({label:`${si+1}${String.fromCharCode(97+sbi)}`,process:cleanStepText(sb.t),ccp:sb.ccp});
                    });
                  });
                  if(!rows.length) return null;
                  return(
                  <div style={{marginTop:16,padding:"14px 16px",background:C.redBg,borderRadius:12,border:`1px solid ${C.redBorder}`}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>🔴 Critical Control Points ({rows.length})</div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{borderBottom:`1px solid ${C.redBorder}`}}>
                          <th style={{textAlign:"left",padding:"6px 8px",fontWeight:700,color:C.red,width:50}}>Step</th>
                          <th style={{textAlign:"left",padding:"6px 8px",fontWeight:700,color:C.red}}>Process</th>
                          <th style={{textAlign:"left",padding:"6px 8px",fontWeight:700,color:C.red}}>CCP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r,i)=>(
                          <tr key={i} style={{borderBottom:`1px solid ${C.redBorder}22`}}>
                            <td style={{padding:"6px 8px",fontWeight:700,color:C.text}}>{r.label}</td>
                            <td style={{padding:"6px 8px",color:C.text,lineHeight:1.4}}>{r.process}</td>
                            <td style={{padding:"6px 8px",color:C.red,fontWeight:600,lineHeight:1.4}}>{r.ccp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );})()}
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* --- CLOSING TAB — production_closings --- */}
      {tab==="closing"&&(()=>{
        const closableEvs = evList
          .filter(e => e.date <= TODAY)
          .sort((a,b)=>{
            if(a.date!==b.date) return b.date.localeCompare(a.date);
            return (b.time||"").localeCompare(a.time||"");
          });
        const uniqueDates = [...new Set(closableEvs.map(e=>e.date))].sort().reverse();
        const selDate = closeSelDate || uniqueDates[0] || TODAY;
        const dateEvs = closableEvs.filter(e=>e.date===selDate);
        const selEv = closeEventId ? closableEvs.find(e=>e.id===closeEventId) : null;
        const evDishes = selEv ? menuArr(selEv) : [];
        const fmtDate = d => { try { return new Date(d+"T00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",weekday:"short"}); } catch(e){ return d; } };
        const fmtTime = t => (t||"").slice(0,5);
        const ctx = selEv ? {evId:selEv.id, evDate:selEv.date, venue:selEv.venue||""} : null;

        // Calendar cell math (mirrors Analytics)
        const pad2 = n => String(n).padStart(2,"0");
        const MO_N = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const DY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const first = new Date(closeCalYr,closeCalMo,1).getDay();
        const dim = new Date(closeCalYr,closeCalMo+1,0).getDate();
        const prevDim = new Date(closeCalYr,closeCalMo,0).getDate();
        const cells = [];
        for(let i=first-1;i>=0;i--) cells.push({d:prevDim-i,c:false});
        for(let i=1;i<=dim;i++) cells.push({d:i,c:true});
        while(cells.length<42) cells.push({d:cells.length-first-dim+1,c:false});
        const cDate = cell => cell.c?`${closeCalYr}-${pad2(closeCalMo+1)}-${pad2(cell.d)}`:null;
        const eod = d => closableEvs.filter(e=>e.date===d);
        const prevMo = ()=>{if(closeCalMo===0){setCloseCalMo(11);setCloseCalYr(y=>y-1);}else setCloseCalMo(m=>m-1);};
        const nextMo = ()=>{if(closeCalMo===11){setCloseCalMo(0);setCloseCalYr(y=>y+1);}else setCloseCalMo(m=>m+1);};
        const todayS = TODAY;

        // Section-scoped filter for chef users
        const allowedCats = allowedCatIds;
        const filteredDishes = allowedCats
          ? evDishes.filter(d => { const cid = getCatIdForDish(d); return cid && allowedCats.includes(cid); })
          : evDishes;

        // Group by SOP category
        const grouped = new Map();
        filteredDishes.forEach(dish => {
          const cid = getCatIdForDish(dish) || '__unmapped';
          if(!grouped.has(cid)){
            const cat = RECIPE_DB.cats.find(c=>c.id===cid) || {id:cid, name:cid==='__unmapped'?'Unmapped':cid, icon:'??'};
            grouped.set(cid, {cat, items:[]});
          }
          grouped.get(cid).items.push(dish);
        });
        const orderedGroups = [
          ...RECIPE_DB.cats.filter(c=>grouped.has(c.id)).map(c=>grouped.get(c.id)),
          ...(grouped.has('__unmapped') ? [grouped.get('__unmapped')] : [])
        ];

        // Stats
        const closedCount = filteredDishes.filter(d => closeRows[d]).length;
        const totalLeftoverKg = filteredDishes.reduce((n, d) => n + (parseFloat(closeRows[d]?.leftover_kg) || 0), 0);
        const fmtKg = v => (v>=0.01 ? v.toFixed(1).replace(/\.0$/,"") : "0");

        return (
          <div>
            {/* No header. The tab strip above already names this screen, and the
                line under it explained a toggle whose label had long since been
                mangled into a bare "?". */}

            {/* ── Calendar ── */}
            <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:16}}>
              <span style={{width:60,height:60,borderRadius:18,flexShrink:0,backgroundColor:K.cardWarm,
                border:`1px solid ${K.hdrLine}`,boxShadow:K.shadowCard,color:K.sbGold,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon name="calendarDays" size={28} strokeWidth={1.6}/>
              </span>
              <span style={{minWidth:0,flex:"1 1 220px"}}>
                <span style={{display:"block",...type.pageTitle,fontSize:27,color:K.hdrTitle}}>{MO_N[closeCalMo]} {closeCalYr}</span>
                <span style={{display:"block",fontSize:13,color:K.hdrMeta,marginTop:2}}>{T2("Pick a past date to record its closing")}</span>
              </span>
              <span style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <button className="kh-btn kh-rip" onPointerDown={ripple} onClick={prevMo} title={T2("Previous month")}
                  style={{width:44,height:44,borderRadius:14,background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,
                    boxShadow:K.shadowCard,color:K.textBody,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                  <Icon name="chevronL" size={18} strokeWidth={2.1}/>
                </button>
                <button className="kh-btn kh-rip" onPointerDown={ripple}
                  onClick={()=>{setCloseCalYr(new Date().getFullYear());setCloseCalMo(new Date().getMonth());setCloseSelDate(TODAY);setCloseEventId(null);}}
                  style={{padding:"13px 20px",borderRadius:14,background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,
                    boxShadow:K.shadowCard,color:K.textBody,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:K.fontBody}}>
                  {T2("Today")}
                </button>
                <button className="kh-btn kh-rip" onPointerDown={ripple} onClick={nextMo} title={T2("Next month")}
                  style={{width:44,height:44,borderRadius:14,background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,
                    boxShadow:K.shadowCard,color:K.textBody,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                  <Icon name="chevronR" size={18} strokeWidth={2.1}/>
                </button>
              </span>
            </div>

            <div className="kh-cardart-sm" style={{borderRadius:20,backgroundColor:K.cardWarm,
              border:`1px solid ${K.cardWarmLine}`,boxShadow:K.shadowCard,overflow:"hidden",marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:K.brandSoft,
                borderBottom:`1px solid ${K.cardWarmLine}`}}>
                {DY.map(d=>(
                  <div key={d} style={{textAlign:"center",...type.label,fontSize:11,color:K.hdrMeta,padding:"12px 0"}}>{d}</div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"#FFFFFF"}}>
                {cells.map((cell,i)=>{
                  const dt = cDate(cell);
                  const evs = dt?eod(dt):[];
                  const isT = dt===todayS;
                  const isS = dt===selDate;
                  // Closing is a record of what already happened, so a future
                  // date has nothing to open. It stays visible but inert.
                  const isFuture = dt && dt > todayS;
                  const clickable = dt && !isFuture;
                  const inMonth = !!cell.c;
                  return(
                    <div key={i} onClick={()=>{if(!clickable)return;setCloseSelDate(dt);setCloseEventId(null);}}
                      className={clickable?"kh-calcell":undefined}
                      style={{minHeight:64,padding:"9px 10px",cursor:clickable?"pointer":"default",
                        borderBottom:`1px solid ${K.lineSoft}`,borderRight:(i%7)<6?`1px solid ${K.lineSoft}`:"none",
                        background:isS?K.brandBg:"transparent",
                        opacity:inMonth?(isFuture?.45:1):.3}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",
                        width:26,height:26,borderRadius:"50%",fontSize:13,
                        fontWeight:isS||isT?700:500,fontVariantNumeric:"tabular-nums",
                        background:isS?K.brand:"transparent",
                        color:isS?"#FFFFFF":isT?K.brand:K.text,
                        boxShadow:!isS&&isT?`inset 0 0 0 1.5px ${K.brandBorder}`:"none"}}>{cell.d}</div>
                      {evs.length>0 && !isFuture && (
                        <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                          {evs.slice(0,5).map((ev,ci)=>(
                            <span key={ci} style={{width:7,height:7,borderRadius:"50%",background:anaGp(ev.venue).c}}/>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",borderTop:`1px solid ${K.cardWarmLine}`,flexWrap:"wrap"}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:7,...type.label,fontSize:10.5,color:K.hdrMeta}}>
                  <Icon name="tag" size={13} strokeWidth={1.9}/>{T2("Event types")}
                </span>
                {Object.entries(ANA_VP).map(([v,p])=>(
                  <span key={v} style={{display:"inline-flex",alignItems:"center",gap:6}} title={v}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:p.c}}/>
                    <span style={{fontSize:12,fontWeight:600,color:K.textMuted}}>{p.code}</span>
                  </span>
                ))}
                <span style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:7,fontSize:12.5,color:K.textFaint}}>
                  <Icon name="calendar" size={13} strokeWidth={1.9}/>{T2("Click a past date to see its events")}
                </span>
              </div>
            </div>

            {/* Events on selected date */}
            {selDate && (
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:11,flexWrap:"wrap"}}>
                  <span style={{...type.sectionHead,fontSize:19,color:K.hdrTitle}}>{fmtDate(selDate)}</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 12px",borderRadius:K.rPill,
                    background:dateEvs.length?K.brandBg:K.surfaceAlt,border:`1px solid ${dateEvs.length?K.brandBorder:K.line}`,
                    fontSize:12.5,fontWeight:700,color:dateEvs.length?K.brandText:K.textFaint}}>
                    {dateEvs.length} {dateEvs.length===1?T2("event"):T2("events")}
                  </span>
                </div>
                <div className="kh-soprows">
                  {dateEvs.map(ev=>{
                    const isSel = closeEventId===ev.id;
                    const mc = menuArr(ev).length;
                    const vc = anaGp(ev.venue);
                    return (
                      <button key={ev.id} onClick={()=>setCloseEventId(ev.id)} className="kh-sopcard kh-cardart-sm kh-rip" onPointerDown={ripple}
                        style={{display:"block",width:"100%",textAlign:"left",padding:"14px 16px",borderRadius:16,cursor:"pointer",
                          backgroundColor:isSel?K.brandBg:K.cardWarm,
                          border:`1px solid ${isSel?K.brand:K.cardWarmLine}`,borderLeft:`4px solid ${vc.c}`,
                          boxShadow:K.shadowCard,fontFamily:K.fontBody}}>
                        <span style={{display:"block",fontSize:15,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.guest||T2("Function")}</span>
                        <span style={{display:"flex",alignItems:"center",gap:7,marginTop:5,fontSize:12.5,color:K.hdrMeta,flexWrap:"wrap"}}>
                          <Icon name="users" size={13} strokeWidth={1.9}/>{ev.pax} pax
                          <span style={{color:K.textFaint}}>·</span>
                          <Icon name="utensils" size={13} strokeWidth={1.9}/>{mc} {T2("dishes")}
                          {ev.venue&&<><span style={{color:K.textFaint}}>·</span><span style={{color:vc.c,fontWeight:600}}>{ev.venue}</span></>}
                        </span>
                      </button>
                    );
                  })}
                  {dateEvs.length===0 && (
                    <div style={{gridColumn:"1 / -1",padding:"26px 18px",textAlign:"center",backgroundColor:K.cardWarm,
                      border:`1px solid ${K.cardWarmLine}`,borderRadius:16,fontSize:13,color:K.hdrMeta}}>
                      {T2("No events on this date")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!selEv && (
              <div className="kh-cardart-sm" style={{padding:"40px 20px",textAlign:"center",backgroundColor:K.brandSoft,
                border:`1px solid ${K.brandBorder}`,borderRadius:20,boxShadow:K.shadowCard}}>
                <div style={{color:K.brand,display:"flex",justifyContent:"center",marginBottom:12,opacity:.75}}>
                  <Icon name="chefHat" size={38} strokeWidth={1.5}/>
                </div>
                <div style={{fontSize:16,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle}}>{T2("No event selected")}</div>
                <div style={{fontSize:13,color:K.hdrMeta,marginTop:4}}>{T2("Pick a date above, then choose the event to record its closing.")}</div>
              </div>
            )}

            {selEv && (<>
              {/* Event summary + event-level exclude toggle */}
              <Card style={{marginBottom:12,padding:"12px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:C.text}}>{selEv.guest||"Function"}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtDate(selEv.date)}{selEv.time?" — "+fmtTime(selEv.time):""}{selEv.venue?" — "+selEv.venue:""} — {selEv.pax} pax — {filteredDishes.length}{allowedCats?"/"+evDishes.length:""} {T2("dishes")}</div>
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:11,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{color:closedCount===filteredDishes.length&&filteredDishes.length>0?C.green:C.gold,fontWeight:700}}>? {closedCount}/{filteredDishes.length} {T2("closed")}</span>
                    {totalLeftoverKg>0 && <span style={{color:C.amber,fontWeight:600}}>📦 {fmtKg(totalLeftoverKg)} kg {T2("leftover")}</span>}
                  </div>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:closeExcludeUI?C.amberBg:C.bg,border:`1.5px solid ${closeExcludeUI?C.amberBorder:C.border}`,cursor:"pointer"}}>
                  <input type="checkbox" checked={closeExcludeUI} onChange={e=>toggleEventExclude(e.target.checked, ctx)} style={{width:18,height:18,accentColor:C.amber,cursor:"pointer"}}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,fontSize:13.5,fontWeight:700,color:closeExcludeUI?K.warn:K.hdrTitle}}><Icon name="alert" size={14} strokeWidth={2.1}/>{T2("Don't affect future ordering")}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:1}}>{T2("Use for daily / repeat functions where a slight over-order is fine. Applies to every dish in this event.")}</div>
                  </div>
                </label>
              </Card>

              {filteredDishes.length===0 && (
                <Card style={{padding:"20px",textAlign:"center"}}>
                  <div style={{fontSize:12,color:C.muted}}>{allowedCats?T2("No dishes in your section for this event."):T2("This event has no dishes on its menu.")}</div>
                </Card>
              )}

              {/* Collapsible sections (default collapsed) */}
              {orderedGroups.map(group=>{
                const isOpen = !!closeSectionOpen[group.cat.id];
                const secClosed = group.items.filter(d=>closeRows[d]).length;
                return(
                  <div key={group.cat.id} style={{marginBottom:10}}>
                    {/* Opaque, not a 8%-alpha wash of the station colour: over
                        the page artwork that wash let the photograph through and
                        the whole row read as broken. The station's colour stays,
                        but only where colour means something — the left edge and
                        the icon tile. The name is text, so it is text-coloured. */}
                    <button onClick={()=>setCloseSectionOpen(p=>({...p,[group.cat.id]:!p[group.cat.id]}))}
                      className="kh-btn kh-rip" onPointerDown={ripple}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 16px",
                        borderRadius:14,backgroundColor:K.cardWarm,
                        border:`1px solid ${K.cardWarmLine}`,borderLeft:`4px solid ${group.cat.color||K.brand}`,
                        boxShadow:K.shadowCard,cursor:"pointer",textAlign:"left",fontFamily:K.fontBody}}>
                      <span style={{display:"flex",flexShrink:0,color:K.textFaint,transition:"transform .15s",
                        transform:isOpen?"rotate(90deg)":"rotate(0)"}}>
                        <Icon name="chevronR" size={16} strokeWidth={2.2}/>
                      </span>
                      <span style={{width:36,height:36,borderRadius:11,flexShrink:0,fontSize:18,lineHeight:1,
                        background:(group.cat.color||K.brand)+"18",
                        display:"flex",alignItems:"center",justifyContent:"center"}}>{group.cat.icon||"\u{1F37D}"}</span>
                      <span style={{flex:1,minWidth:0}}>
                        <span style={{display:"block",fontSize:14.5,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{group.cat.name||group.cat.id}</span>
                        <span style={{display:"block",fontSize:12.5,color:K.hdrMeta,marginTop:2}}>
                          {group.items.length} {T2("dishes")}
                        </span>
                      </span>
                      {/* Progress belongs on the right as a chip, not tacked onto
                          the dish count with a dash. */}
                      <span style={{display:"inline-flex",alignItems:"center",gap:6,flexShrink:0,padding:"5px 12px",
                        borderRadius:K.rPill,fontSize:12,fontWeight:700,
                        background:secClosed===group.items.length?K.okBg:secClosed>0?K.warnBg:K.surfaceAlt,
                        border:`1px solid ${secClosed===group.items.length?K.okBorder:secClosed>0?K.warnBorder:K.line}`,
                        color:secClosed===group.items.length?K.ok:secClosed>0?K.warn:K.textFaint}}>
                        {secClosed===group.items.length&&<Icon name="check" size={13} strokeWidth={2.3}/>}
                        {secClosed}/{group.items.length}
                      </span>
                    </button>
                    {isOpen && (<div className="kh-closegrid">{group.items.map(dish=>{
                      const row = closeRows[dish];
                      const planKg = evPlanRows[closeEventId]?.[dish]?.target_yield_kg || null;
                      const lkg = row?.leftover_kg;
                      const lpcs = row?.leftover_pcs;
                      const notes = row?.notes || "";
                      const isSaving = closeSaving.has(dish);
                      const isClosed = !!row;
                      return(
                        <div key={dish} style={{borderRadius:14,border:`1px solid ${isClosed?K.okBorder:K.cardWarmLine}`,backgroundColor:isClosed?K.okBg:"#FFFFFF",boxShadow:K.shadowCard,overflow:"hidden"}}>
                          <div style={{padding:"13px 14px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                            <div style={{flex:1,minWidth:180}}>
                              <div style={{fontSize:14.5,fontWeight:700,letterSpacing:"-0.2px",color:K.hdrTitle}}>{dishLabel(dish, lang)}</div>
                              {planKg && <div style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12,color:K.brandText,background:K.brandBg,border:`1px solid ${K.brandBorder}`,borderRadius:K.rPill,padding:"3px 10px",marginTop:5,fontWeight:600}}>🎯 {T2("Planned")}: {planKg} kg</div>}
                            </div>
                            <div style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,color:isSaving?K.warn:isClosed?K.ok:K.textFaint}}>{isSaving?<><Icon name="refresh" size={13} strokeWidth={2.1}/>{T2("Saving")}…</>:isClosed?<><Icon name="check" size={13} strokeWidth={2.3}/>{T2("Closed")}</>:null}</div>
                          </div>
                          <div style={{padding:"10px 14px 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,alignItems:"end"}}>
                            <div>
                              <div style={{...type.label,fontSize:10.5,color:K.hdrMeta,marginBottom:6}}>{T2("Leftover kg")}</div>
                              <input type="number" step="0.1" inputMode="decimal"
                                defaultValue={lkg??""}
                                key={"lkg-"+dish+"-"+(row?.id||"new")}
                                onBlur={e=>saveClosing(dish, {leftover_kg:e.target.value}, ctx)}
                                placeholder="0"
                                style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:15,fontWeight:700,color:K.text,fontVariantNumeric:"tabular-nums",fontFamily:K.fontBody,outline:"none",background:C.surface,boxSizing:"border-box",minHeight:38}}/>
                            </div>
                            <div>
                              <div style={{...type.label,fontSize:10.5,color:K.hdrMeta,marginBottom:6}}>{T2("Pcs (opt.)")}</div>
                              <input type="number" step="1" inputMode="numeric"
                                defaultValue={lpcs??""}
                                key={"lpcs-"+dish+"-"+(row?.id||"new")}
                                onBlur={e=>saveClosing(dish, {leftover_pcs:e.target.value}, ctx)}
                                placeholder="0"
                                style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:15,fontWeight:700,color:K.text,fontVariantNumeric:"tabular-nums",fontFamily:K.fontBody,outline:"none",background:"#FFFFFF",boxSizing:"border-box",minHeight:38}}/>
                            </div>
                            <div style={{gridColumn:"1 / -1"}}>
                              <div style={{...type.label,fontSize:10.5,color:K.hdrMeta,marginBottom:6}}>{T2("Notes")}</div>
                              <input type="text"
                                defaultValue={notes}
                                key={"nts-"+dish+"-"+(row?.id||"new")}
                                onBlur={e=>saveClosing(dish, {notes:e.target.value}, ctx)}
                                placeholder={T2("optional")}
                                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:13.5,color:K.text,background:"#FFFFFF",boxSizing:"border-box",fontFamily:K.fontBody,outline:"none"}}/>
                            </div>
                          </div>
                        </div>
                      );
                    })}</div>)}
                  </div>
                );
              })}

              {/* The old copy promised that "the ? flag will be honored once
                  order-suggestion is wired to this data" — a sentence about an
                  unbuilt feature, referring to a toggle whose label had been
                  mangled to a bare "?". Left is the one fact a user needs. */}
              <div style={{marginTop:20,padding:"12px 16px",borderRadius:12,backgroundColor:K.cardWarm,
                border:`1px solid ${K.cardWarmLine}`,display:"flex",alignItems:"center",justifyContent:"center",
                gap:8,fontSize:12.5,color:K.hdrMeta}}>
                <Icon name="check" size={14} strokeWidth={2}/>
                {T2("Each field saves on its own as soon as you leave it")}
              </div>
            </>)}
          </div>
        );
      })()}

      {/* --- PLANNING TAB — production_plans (Phase 4) --- */}
      {tab==="planning"&&(()=>{
        const upcomingEvs = evList
          .filter(e => e.date >= TODAY)
          .sort((a,b)=>{
            if(a.date!==b.date) return a.date.localeCompare(b.date);
            return (a.time||"").localeCompare(b.time||"");
          });
        const selEv = planEvId ? upcomingEvs.find(e=>e.id===planEvId) : null;
        const dishes = selEv ? menuArr(selEv) : [];
        const fmtDate = d => { try { return new Date(d+"T00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",weekday:"short"}); } catch(e){ return d; } };
        const fmtTime = t => (t||"").slice(0,5);
        const ctx = selEv ? {evId:selEv.id, evDate:selEv.date, venue:selEv.venue||""} : null;

        // Group upcoming events by date for the <select> optgroups
        const evsByDate = upcomingEvs.reduce((acc,ev)=>{
          if(!acc[ev.date]) acc[ev.date] = [];
          acc[ev.date].push(ev);
          return acc;
        },{});
        const evDates = Object.keys(evsByDate).sort();

        // Use the canonical resolver (Tier 0: DISH_NAME_MAP, Tier 1: exact, Tier 2: substring, Tier 3: normDish)
        // — same resolver Menu Packages uses, so mappings shown there apply here too.
        function dishStatus(lmsName) {
          const found = findRecipeForDish(lmsName);
          if(!found) return { state:"missing", color:C.red, catId:null, baseYield:null };
          const catId = found.cat?.id || null;
          const y = found.ingredients?.base_yield?.kg;
          const baseYield = (typeof y==="number" && y>0) ? y : null;
          return { state:baseYield?"ready":"noyield", color:baseYield?C.green:C.amber, recipe:found, catId, baseYield };
        }

        // On-blur handler: save only if changed. Also skip if typed value equals auto suggestion (would create a redundant override).
        function onYieldBlur(dish, rowCtx){
          const draft = planDrafts[dish];
          if(draft===undefined) return;
          const draftStr = String(draft).trim();
          const savedStr = String(planRows[dish]?.target_yield_kg ?? "");
          if(draftStr === savedStr) return;
          // If chef typed the exact auto suggestion and dish isn't already an override, don't create a redundant pin
          if(!planRows[dish] && draftStr !== ""){
            const st = dishStatus(dish);
            if(st.baseYield){
              const bp = st.recipe?.ingredients?.base_pax || 300;
              const autoKg = Math.round(selEv.pax/bp * st.baseYield * 10)/10;
              if(draftStr === String(autoKg)){
                setPlanDrafts(p=>{const c={...p};delete c[dish];return c;});
                return;
              }
            }
          }
          savePlanYield(dish, draft, rowCtx);
        }

        // Group dishes by section (RECIPE_DB.cats order). Store-mapped dishes are excluded (they're issued from store, not prepped).
        const grouped = new Map();
        const unmapped = [];
        dishes.forEach((dish,idx)=>{
          const st = dishStatus(dish);
          if(!st.catId){
            // No recipe. If it has a store mapping, it's issued from store — skip from planning entirely.
            if(resolveDishStore(dish)) return;
            unmapped.push({dish,st,idx});
            return;
          }
          if(!grouped.has(st.catId)){
            const cat = RECIPE_DB.cats.find(c=>c.id===st.catId) || {id:st.catId,name:st.catId,icon:"??"};
            grouped.set(st.catId,{cat,items:[]});
          }
          grouped.get(st.catId).items.push({dish,st,idx});
        });
        const orderedGroups = RECIPE_DB.cats
          .filter(c=>grouped.has(c.id))
          .map(c=>grouped.get(c.id));

        // V90 — Base Gravy demand: gravies aren't selected as menu dishes
        // themselves, they're consumed BY other dishes via ingredient-level
        // BG rows (Dish Library -> Ingredients -> type 'BG'). Sum how much of
        // each gravy this event's whole menu needs and show it as its own
        // pseudo-dish, same mechanism Event Day / Prep Day already use, so
        // chefs can see (and pin) a target kg for it here too.
        const bgDemand = {};
        dishes.forEach(dishName=>{
          const rec = findRecipeForDish(dishName);
          if (!rec?.ingredients?.items?.length) return;
          const baseKg = rec.ingredients.base_yield?.kg || null;
          let bgs = [];
          if (baseKg) {
            const planRow = planRows[dishName] || null;
            const planned = Number(planRow?.target_yield_kg) || null;
            const defaultYield = selEv.pax>0 ? (baseKg*selEv.pax/(rec.ingredients.base_pax||300)) : baseKg;
            const effKg = planned || defaultYield;
            const sectionYieldsPlan = planRow?.section_yields || null;
            let sectionFactors = null;
            if (sectionYieldsPlan) {
              const recSections = (rec.ingredients.items||[]).filter(i=>i.isSection && i.yield?.kg>0);
              const acc = {};
              recSections.forEach(sec=>{
                const planKg = Number(sectionYieldsPlan[sec.name]);
                if(planKg>0 && sec.yield.kg>0) acc[sec.name]=planKg/sec.yield.kg;
              });
              if (Object.keys(acc).length>0) sectionFactors=acc;
            }
            bgs = getBgDemandForYield(dishName, effKg, sectionFactors);
          } else {
            bgs = getBgDemandForDish(dishName, selEv.pax);
          }
          bgs.forEach(b=>{
            if (!b.bgName || b.qty<=0) return;
            const key = b.bgName;
            if (!bgDemand[key]) bgDemand[key] = { totalKg: 0, _warned:false };
            const bu = String(b.unit||'kg').toLowerCase();
            const bq = Number(b.qty)||0;
            let deltaKg = 0;
            if (bu==='kg'||bu==='l') deltaKg = bq;
            else if (bu==='gm'||bu==='ml') deltaKg = bq/1000;
            else if (!bgDemand[key]._warned) {
              console.warn(`[bg-demand] BG '${key}' uses non-mass/volume unit '${b.unit}' — skipped from totalKg`);
              bgDemand[key]._warned = true;
            }
            bgDemand[key].totalKg += deltaKg;
          });
        });
        const bgItems = [];
        let bgIdx = 9000;
        Object.keys(bgDemand).forEach(bgName=>{
          const dem = bgDemand[bgName];
          if (dem.totalKg<=0) return;
          const bgRec = findRecipeForDish(bgName);
          if (!bgRec || !bgRec.bg) { console.warn('[bg-inject] not a bg recipe:', bgName); return; }
          bgItems.push({ dish: bgName, st: dishStatus(bgName), idx: bgIdx++, isBaseGravy:true, demandKg: dem.totalKg });
        });
        if (bgItems.length > 0) {
          orderedGroups.unshift({ cat: {id:'__bg__', name:T2('Base Gravies'), icon:'🥘'}, items: bgItems });
        }

        // Plan-based stats: auto = using computed default; override = chef pinned; fromStore = issued from store (no prep); unmapped = no recipe AND no store link
        const stats = dishes.reduce((acc,d)=>{
          const st = dishStatus(d);
          if(!st.catId){
            if(resolveDishStore(d)) acc.fromStore++;
            else acc.unmapped++;
          }
          else if(planRows[d]) acc.override++;
          else acc.auto++;
          return acc;
        },{auto:0,override:0,unmapped:0,fromStore:0});

        return(
          <div>
            {/* Header */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:600,color:C.text}}>📋 {T2("Production Planning")}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{T2("Pick a date, then an event. Enter target yield (kg) per dish. Auto-saves as draft on blur.")}</div>
            </div>

            {/* Calendar + selected-date event list, side by side */}
            <div style={{display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap",marginBottom:16}}>

            {/* Calendar */}
            {(()=>{
              const MO_FULL=["January","February","March","April","May","June","July","August","September","October","November","December"];
              const DY_NAMES=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
              const pad = n => String(n).padStart(2,"0");
              const first = new Date(planCalYr,planCalMo,1).getDay();
              const dim = new Date(planCalYr,planCalMo+1,0).getDate();
              const prevDim = new Date(planCalYr,planCalMo,0).getDate();
              const cells = [];
              for(let i=first-1;i>=0;i--) cells.push({d:prevDim-i,c:false});
              for(let i=1;i<=dim;i++) cells.push({d:i,c:true});
              while(cells.length<42) cells.push({d:cells.length-first-dim+1,c:false});
              const cellDate = cell => cell.c?`${planCalYr}-${pad(planCalMo+1)}-${pad(cell.d)}`:null;
              const evsOnDate = d => upcomingEvs.filter(e=>e.date===d);
              const prevMo = ()=>{if(planCalMo===0){setPlanCalMo(11);setPlanCalYr(y=>y-1);}else setPlanCalMo(m=>m-1);};
              const nextMo = ()=>{if(planCalMo===11){setPlanCalMo(0);setPlanCalYr(y=>y+1);}else setPlanCalMo(m=>m+1);};
              return(
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",flex:"0 0 400px",maxWidth:400}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <button onClick={prevMo} style={{width:26,height:26,borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:13,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>—</button>
                      <div style={{fontSize:13,fontWeight:600,color:C.text,minWidth:120,textAlign:"center"}}>{MO_FULL[planCalMo]} {planCalYr}</div>
                      <button onClick={nextMo} style={{width:26,height:26,borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:13,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>—</button>
                    </div>
                    <button onClick={()=>{const t=new Date();setPlanCalYr(t.getFullYear());setPlanCalMo(t.getMonth());setPlanSelDate(TODAY);setPlanEvId(null);}} style={{padding:"4px 10px",borderRadius:7,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:10,fontWeight:500,cursor:"pointer"}}>{T2("Today")}</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                    {DY_NAMES.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:C.muted,padding:"4px 0",background:C.bg}}>{d}</div>)}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                    {cells.map((cell,i)=>{
                      const dt = cellDate(cell);
                      const evs2 = dt ? evsOnDate(dt) : [];
                      const isToday = dt === TODAY;
                      const isSel = dt === planSelDate;
                      const vCols = [...new Set(evs2.map(e=>anaGp(e.venue).c))];
                      return(
                        <div key={i} onClick={()=>{if(!dt)return;setPlanSelDate(isSel?null:dt);setPlanEvId(null);}}
                          style={{height:40,padding:"3px 4px",cursor:dt?"pointer":"default",
                            borderBottom:`1px solid ${C.borderLight}`,borderRight:(i%7)<6?`1px solid ${C.borderLight}`:"none",
                            background:isSel?C.goldBg:isToday?"#FAEEDA":"transparent",opacity:cell.c?1:.2}}>
                          <div style={{fontSize:11,fontWeight:isToday||isSel?600:400,color:isSel?C.gold:isToday?"#BA7517":C.text}}>{cell.d}</div>
                          {vCols.length>0&&<div style={{display:"flex",gap:2,marginTop:2}}>{vCols.slice(0,4).map((col,ci)=><div key={ci} style={{width:5,height:5,borderRadius:"50%",background:col}}/>)}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:10,padding:"6px 12px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                    {Object.entries(ANA_VP).map(([v,p])=><div key={v} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:6,height:6,borderRadius:"50%",background:p.c}}/><span style={{fontSize:9,color:C.muted}}>{p.code}</span></div>)}
                  </div>
                </div>
              );
            })()}

            {/* Selected date ? event cards — sits to the right of the calendar now that there's room */}
            {planSelDate && (()=>{
              const dateEvs = upcomingEvs.filter(e=>e.date===planSelDate);
              if(dateEvs.length===0) return(
                <div style={{flex:"1 1 320px",minWidth:280,padding:"14px 16px",borderRadius:10,border:`1px dashed ${C.border}`,background:C.bg,fontSize:12,color:C.faint,textAlign:"center"}}>
                  {T2("No upcoming events on")} {fmtDate(planSelDate)}
                </div>
              );
              return(
                <div style={{flex:"1 1 320px",minWidth:280}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>
                    {fmtDate(planSelDate)} — {dateEvs.length} {T2("event")}{dateEvs.length!==1?"s":""}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {dateEvs.map(ev=>{
                      const isSel = planEvId===ev.id;
                      const vc = anaGp(ev.venue);
                      const mc = menuArr(ev).length;
                      return(
                        <button key={ev.id} onClick={()=>setPlanEvId(isSel?null:ev.id)}
                          style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,padding:"14px 18px",borderRadius:12,cursor:"pointer",
                            background:isSel?vc.c:C.surface,color:isSel?"#fff":C.text,
                            border:`1.5px solid ${isSel?vc.c:C.border}`,minHeight:64,textAlign:"left",borderLeft:`4px solid ${vc.c}`}}>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontSize:15,fontWeight:700}}>{ev.guest||T2("Function")}</div>
                            <div style={{fontSize:12,opacity:.85,marginTop:4,display:"flex",gap:10,flexWrap:"wrap"}}>
                              <span>🕐 {fmtTime(ev.time)||"—"}</span>
                              <span>👥 {ev.pax} {T2("pax")}</span>
                              <span>🍽 {mc} {T2("dishes")}</span>
                            </div>
                            <div style={{fontSize:11,opacity:.75,marginTop:3}}>📍 {ev.venue||"—"}</div>
                          </div>
                          <div style={{flexShrink:0,padding:"3px 9px",borderRadius:8,fontSize:10,fontWeight:700,letterSpacing:.4,
                            background:isSel?"rgba(255,255,255,.25)":vc.c+"1A",color:isSel?"#fff":vc.c}}>{vc.code}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            </div>{/* end calendar + event list row */}

            {/* Selected event summary + grouped dish list */}
            {selEv && (()=>{
              const vc = anaGp(selEv.venue);
              return(
              <div>
                {/* Event summary card */}
                <div style={{padding:"12px 14px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,borderLeft:`4px solid ${vc.c}`,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:C.text}}>{selEv.guest||"Function"}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtDate(selEv.date)}{selEv.time?" — "+fmtTime(selEv.time):""} — {selEv.venue||""} — {selEv.pax} pax — {dishes.length} dishes</div>
                  </div>
                  <div style={{display:"flex",gap:10,fontSize:11,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{color:C.green,background:C.greenBg,padding:"3px 10px",borderRadius:12,fontWeight:600}}>✨ {stats.auto} {T2("auto-planned")}</span>
                    <span style={{color:C.purple,background:C.purpleBg,padding:"3px 10px",borderRadius:12,fontWeight:600}}>📌 {stats.override} {T2("override")}</span>
                    {stats.fromStore>0 && <span style={{color:C.muted,background:C.bg,padding:"3px 10px",borderRadius:12,fontWeight:600,border:`1px solid ${C.border}`}}>📦 {stats.fromStore} {T2("from store")}</span>}
                    {stats.unmapped>0 && <span style={{color:C.red,background:C.redBg,padding:"3px 10px",borderRadius:12,fontWeight:600}}>⚠ {stats.unmapped} {T2("unmapped")}</span>}
                    {planLoading && <span style={{color:C.muted,fontStyle:"italic",fontSize:10}}>{T2("Loading...")}</span>}
                  </div>
                </div>

                {/* Global yield adjustment slider (Phase 3: merged from Scaling tab; saves to events.yield_multiplier per event on Apply click) */}
                {dishes.length>0 && (()=>{
                  // Total = overrides + auto suggestions for every mapped dish (mirrors what ingredient calc uses)
                  const plannedKgTotal = dishes.reduce((s,d)=>{
                    const override = Number(planRows[d]?.target_yield_kg);
                    if(override>0) return s+override;
                    const st = dishStatus(d);
                    if(!st.baseYield) return s;
                    const bp = st.recipe?.ingredients?.base_pax || 300;
                    return s + (selEv.pax/bp * st.baseYield);
                  },0);
                  const adjustedTotal = Math.round(plannedKgTotal * yieldAdjustPct/100 * 10)/10;
                  const fmtKg = v => (v>=0.01 ? v.toFixed(1).replace(/\.0$/,"") : "0");
                  const isDirty = yieldAdjustPct !== yieldSavedPct;
                  const onApplyYield = ()=>{
                    if(!planEvId || yieldSaving || !isDirty) return;
                    setYieldSaving(true);
                    const uiMult = yieldAdjustPct/100;
                    supabase.from('events').update({yield_multiplier: uiMult}).eq('id', planEvId).then(({error})=>{
                      setYieldSaving(false);
                      if(error){ console.error('[yield_multiplier save]', error); alert((T2?T2("Failed to save yield: "):"Failed to save yield: ")+error.message); return; }
                      setYieldSavedPct(yieldAdjustPct);
                    });
                  };
                  return(
                  <Card style={{marginBottom:12,padding:"14px 16px",border:`1px solid ${isDirty?C.purple:C.purpleBorder}`,background:C.purpleBg,boxShadow:isDirty?`0 0 0 2px ${C.purple}22`:"none",position:"sticky",top:0,zIndex:5}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:.6}}>⚖️ {T2("Yield adjustment")}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:2}}>{T2("Scales every dish (auto + override). Overrides stay pinned at their custom values.")}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <button onClick={()=>setShowOrderingSheet(true)} style={{padding:"7px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",background:C.surface,color:C.purple,border:`1.5px solid ${C.purple}`,whiteSpace:"nowrap"}}>📋 {T2("Show Ingredients")}</button>
                        <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                          <div style={{fontSize:28,fontWeight:800,color:C.purple,lineHeight:1}}>{yieldAdjustPct}</div>
                          <div style={{fontSize:14,fontWeight:700,color:C.purple}}>%</div>
                        </div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                      {[90,100,110,120,130,150].map(p=>(
                        <button key={p} onClick={()=>setYieldAdjustPct(p)}
                          style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:yieldAdjustPct===p?800:500,cursor:"pointer",background:yieldAdjustPct===p?C.purple:"transparent",color:yieldAdjustPct===p?"#fff":C.purple,border:`1.5px solid ${C.purple}`,minHeight:34}}>
                          {p}%
                        </button>
                      ))}
                      <input type="number" value={yieldAdjustPct} onChange={e=>setYieldAdjustPct(Math.max(10,Math.min(300,+e.target.value||100)))} min={10} max={300}
                        style={{width:64,padding:"6px 8px",borderRadius:8,border:`1px solid ${C.purple}`,fontSize:13,fontWeight:700,color:C.purple,background:C.bg,textAlign:"center",minHeight:34}}/>
                      <button onClick={()=>setYieldAdjustPct(100)} style={{padding:"6px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",background:"transparent",color:C.muted,border:`1px solid ${C.border}`,minHeight:34}}>{T2("Reset")}</button>
                    </div>
                    <input type="range" min={50} max={200} step={5} value={Math.min(200,Math.max(50,yieldAdjustPct))}
                      onChange={e=>setYieldAdjustPct(+e.target.value)}
                      style={{width:"100%",accentColor:C.purple,height:6,cursor:"pointer",display:"block"}}/>
                    <div style={{position:"relative",height:6,marginTop:1}}>
                      {[50,100,150,200].map(v=>(
                        <div key={v} style={{position:"absolute",left:`${(v-50)/150*100}%`,top:0,width:1,height:5,background:C.border,transform:"translateX(-50%)"}}/>
                      ))}
                    </div>
                    <div style={{position:"relative",height:14,marginTop:2}}>
                      {[50,100,150,200].map(v=>{
                        const pos=(v-50)/150*100;
                        return (
                          <span key={v} style={{position:"absolute",left:`${pos}%`,transform:pos===0?"none":pos===100?"translateX(-100%)":"translateX(-50%)",fontSize:9,color:v===100?C.purple:C.faint,fontWeight:v===100?700:400,whiteSpace:"nowrap"}}>{v}%</span>
                        );
                      })}
                    </div>
                    {plannedKgTotal>0 && (
                      <div style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:C.bg,fontSize:11,color:C.muted,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span>{T2("Total planned:")}</span>
                        <b style={{color:C.text}}>{fmtKg(plannedKgTotal)} kg</b>
                        {yieldAdjustPct!==100 && (<>
                          <span style={{color:C.faint}}>?</span>
                          <b style={{color:C.purple}}>{fmtKg(adjustedTotal)} kg</b>
                          <span style={{fontSize:10,color:C.faint}}>({yieldAdjustPct}%)</span>
                        </>)}
                      </div>
                    )}
                    <div style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                      <div style={{fontSize:10,color:isDirty?C.purple:C.faint,fontWeight:isDirty?600:400,flex:"1 1 200px"}}>
                        {isDirty
                          ? T2("Unsaved — click Apply to scale ingredients for this event.")
                          : T2("Saved. Applies to Event Day and Prep Day ingredient calculations.")}
                      </div>
                      <button onClick={onApplyYield} disabled={!isDirty||yieldSaving}
                        style={{padding:"9px 20px",borderRadius:8,fontSize:12,fontWeight:700,cursor:(!isDirty||yieldSaving)?"not-allowed":"pointer",background:(!isDirty||yieldSaving)?C.bg:C.purple,color:(!isDirty||yieldSaving)?C.faint:"#fff",border:`1.5px solid ${(!isDirty||yieldSaving)?C.border:C.purple}`,minHeight:38,opacity:(!isDirty||yieldSaving)?0.65:1,whiteSpace:"nowrap"}}>
                        {yieldSaving ? T2("Saving…") : (isDirty ? T2("✓ Apply yield") : T2("✓ Applied"))}
                      </button>
                    </div>
                  </Card>);
                })()}

                {/* Section-wise ingredient ordering sheet — one spot to see per-section (cuisine) ingredient quantities for this event, with a live yield slider */}
                {showOrderingSheet && (()=>{
                  const mult = yieldAdjustPct/100;
                  const ingrMap = {}; // key: "name|unit" -> {n,u,bySection:{catId:qty},total}
                  orderedGroups.forEach(g=>{
                    g.items.forEach(it=>{
                      const st = it.st;
                      if(!st.recipe?.ingredients?.items?.length) return;
                      const basePax = st.recipe.ingredients.base_pax || 300;
                      const recSections = (st.recipe.ingredients.items||[]).filter(x=>x.isSection && x.yield?.kg>0);
                      const useSections = recSections.length>0;
                      let ingrList = null;
                      if(useSections){
                        const secFactors = {};
                        let sectionsTotalKg = 0;
                        recSections.forEach(sec=>{
                          const secAutoRaw = Math.round(selEv.pax/basePax*sec.yield.kg*10)/10;
                          const secAutoScaled = Math.round(secAutoRaw*mult*10)/10;
                          const savedVal = planRows[it.dish]?.section_yields?.[sec.name];
                          const isSecOverride = savedVal!=null && savedVal!=="";
                          const effKgSec = isSecOverride ? Number(savedVal) : secAutoScaled;
                          sectionsTotalKg += (effKgSec||0);
                          secFactors[sec.name] = sec.yield.kg>0 ? (effKgSec/sec.yield.kg) : 0;
                        });
                        ingrList = getIngrForYield(it.dish, Math.round(sectionsTotalKg*10)/10, secFactors);
                      } else {
                        const suggestedRaw = st.baseYield ? Math.round(selEv.pax/basePax*st.baseYield*10)/10 : null;
                        const isOverride = !!planRows[it.dish];
                        const overrideKgRaw = isOverride ? planRows[it.dish]?.target_yield_kg : null;
                        const effKg = isOverride
                          ? (overrideKgRaw!=null ? Math.round(overrideKgRaw*mult*10)/10 : null)
                          : (suggestedRaw!=null ? Math.round(suggestedRaw*mult*10)/10 : null);
                        if(effKg!=null) ingrList = getIngrForYield(it.dish, effKg);
                      }
                      (ingrList||[]).forEach(ing=>{
                        if(ing._isSection || !ing.q) return;
                        const key = ing.n+"|"+(ing.u||"");
                        if(!ingrMap[key]) ingrMap[key] = {n:ing.n, u:ing.u||"", bySection:{}, total:0};
                        ingrMap[key].bySection[g.cat.id] = (ingrMap[key].bySection[g.cat.id]||0) + ing.q;
                        ingrMap[key].total += ing.q;
                      });
                    });
                  });
                  const rows = Object.values(ingrMap).sort((a,b)=>a.n.localeCompare(b.n));
                  const roundQ = q => { if(!q) return "—"; if(q>=10) return String(Math.round(q*10)/10); if(q>=1) return String(Math.round(q*100)/100); return String(Math.round(q*1000)/1000); };
                  const thStyle = {padding:"6px 4px",textAlign:"right",fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.3,borderBottom:`2px solid ${C.border}`,whiteSpace:"nowrap"};
                  const secThStyle = {...thStyle,width:56,maxWidth:56,whiteSpace:"normal",wordBreak:"break-word",lineHeight:1.25,verticalAlign:"bottom"};
                  const tdStyle = {padding:"5px 4px",textAlign:"right",color:C.text,fontSize:11,whiteSpace:"nowrap"};
                  return(
                    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setShowOrderingSheet(false)}>
                      <div style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:960,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 8px 32px rgba(0,0,0,.2)"}} onClick={e=>e.stopPropagation()}>
                        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`}}>
                          <div style={{fontSize:15,fontWeight:700,color:C.text}}>📋 {T2("Ingredient Ordering Sheet")}</div>
                          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{selEv.guest||T2("Function")} · {fmtDate(selEv.date)} · {selEv.pax} {T2("pax")}</div>
                        </div>
                        <div style={{padding:"12px 20px",borderBottom:`1px solid ${C.border}`,background:C.purpleBg,flexShrink:0}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:8}}>
                            <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:.5}}>⚖️ {T2("Live yield adjust")}</div>
                            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                              <div style={{fontSize:20,fontWeight:800,color:C.purple,lineHeight:1}}>{yieldAdjustPct}</div>
                              <div style={{fontSize:12,fontWeight:700,color:C.purple}}>%</div>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                            {[90,100,110,120,130,150].map(p=>(
                              <button key={p} onClick={()=>setYieldAdjustPct(p)}
                                style={{padding:"5px 10px",borderRadius:7,fontSize:11,fontWeight:yieldAdjustPct===p?800:500,cursor:"pointer",background:yieldAdjustPct===p?C.purple:"transparent",color:yieldAdjustPct===p?"#fff":C.purple,border:`1.5px solid ${C.purple}`}}>
                                {p}%
                              </button>
                            ))}
                          </div>
                          <input type="range" min={50} max={200} step={5} value={Math.min(200,Math.max(50,yieldAdjustPct))}
                            onChange={e=>setYieldAdjustPct(+e.target.value)}
                            style={{width:"100%",accentColor:C.purple,height:6,cursor:"pointer",display:"block"}}/>
                          <div style={{position:"relative",height:6,marginTop:1}}>
                            {[50,100,150,200].map(v=>(
                              <div key={v} style={{position:"absolute",left:`${(v-50)/150*100}%`,top:0,width:1,height:5,background:C.border,transform:"translateX(-50%)"}}/>
                            ))}
                          </div>
                          <div style={{position:"relative",height:14,marginTop:2}}>
                            {[50,100,150,200].map(v=>{
                              const pos=(v-50)/150*100;
                              return (
                                <span key={v} style={{position:"absolute",left:`${pos}%`,transform:pos===0?"none":pos===100?"translateX(-100%)":"translateX(-50%)",fontSize:9,color:v===100?C.purple:C.faint,fontWeight:v===100?700:400,whiteSpace:"nowrap"}}>{v}%</span>
                              );
                            })}
                          </div>
                          <div style={{fontSize:9,color:C.faint,marginTop:4}}>{T2("Changes here apply to the Yield adjustment card too — click Apply there to save.")}</div>
                        </div>
                        <div style={{flex:1,overflow:"auto",padding:"0 20px"}}>
                          {rows.length===0 ? (
                            <div style={{padding:"30px 0",fontSize:12,color:C.muted,fontStyle:"italic",textAlign:"center"}}>{T2("No ingredient data for this event's dishes")}</div>
                          ) : (
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,tableLayout:"fixed"}}>
                              <colgroup>
                                <col style={{width:140}}/>
                                <col style={{width:44}}/>
                                {orderedGroups.map(g=><col key={g.cat.id} style={{width:56}}/>)}
                                <col style={{width:56}}/>
                              </colgroup>
                              <thead>
                                <tr>
                                  <th style={{...thStyle,textAlign:"left",position:"sticky",left:0,background:C.surface}}>{T2("Item")}</th>
                                  <th style={thStyle}>{T2("UM")}</th>
                                  {orderedGroups.map(g=><th key={g.cat.id} style={secThStyle} title={g.cat.name}>{g.cat.icon} {g.cat.name}</th>)}
                                  <th style={{...secThStyle,color:C.text}}>{T2("Total")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r,i)=>(
                                  <tr key={i} style={{borderBottom:`1px solid ${C.borderLight}`}}>
                                    <td style={{...tdStyle,textAlign:"left",fontWeight:500,color:C.text,position:"sticky",left:0,background:C.surface,whiteSpace:"normal",wordBreak:"break-word"}}>{r.n}</td>
                                    <td style={{...tdStyle,color:C.muted}}>{r.u}</td>
                                    {orderedGroups.map(g=><td key={g.cat.id} style={tdStyle}>{roundQ(r.bySection[g.cat.id])}</td>)}
                                    <td style={{...tdStyle,fontWeight:700,color:C.text}}>{roundQ(r.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                        <div style={{padding:"12px 20px",borderTop:`1px solid ${C.border}`}}>
                          <button onClick={()=>setShowOrderingSheet(false)} style={{width:"100%",padding:"12px",borderRadius:10,background:C.wine,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>{T2("Close")}</button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {dishes.length===0 && (
                  <div style={{padding:"24px",textAlign:"center",fontSize:12,color:C.faint,borderRadius:10,border:`1px dashed ${C.border}`}}>{T2("No menu confirmed for this event")}</div>
                )}

                {/* Bulk action bar */}
                {dishes.length>0 && (
                  <div style={{display:"flex",gap:8,alignItems:"center",padding:"8px 12px",background:C.bg,borderRadius:8,marginBottom:12,flexWrap:"wrap"}}>
                    <button onClick={async()=>{
                      const targets = dishes.filter(d=>{const st=dishStatus(d);return st.baseYield && !planRows[d];});
                      if(targets.length===0){ alert(T2("Nothing to accept — all mapped dishes are already pinned.")); return; }
                      if(!confirm(T2("Lock in auto values as explicit overrides for ")+targets.length+T2(" dish(es)?"))) return;
                      for(const d of targets){
                        const st = dishStatus(d);
                        const bp = st.recipe?.ingredients?.base_pax || 300;
                        const suggested = Math.round(selEv.pax/bp * st.baseYield * 10)/10;
                        await savePlanYield(d, suggested, {...ctx, recipe:st.recipe});
                      }
                    }} style={{padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:500,cursor:"pointer",background:C.surface,color:C.text,border:`1px solid ${C.border}`}}>✨ {T2("Accept all suggestions")}</button>
                    <button onClick={async()=>{
                      const targets = dishes.filter(d=>planRows[d]);
                      if(targets.length===0){ alert(T2("No overrides to clear.")); return; }
                      if(!confirm(T2("Clear all ")+targets.length+T2(" pinned override(s)? Dishes revert to auto values."))) return;
                      for(const d of targets){
                        const st = dishStatus(d);
                        await savePlanYield(d, "", {...ctx, recipe:st.recipe});
                      }
                    }} style={{padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:500,cursor:"pointer",background:"transparent",color:C.muted,border:`1px solid ${C.border}`}}>↺ {T2("Clear overrides")}</button>
                    <div style={{flex:1}}></div>
                    <span style={{fontSize:10,color:C.faint}}>{T2("Auto-saves on blur")}</span>
                  </div>
                )}

                {/* Grouped sections */}
                {orderedGroups.map(g=>{
                  const overrideInGroup = g.items.filter(it=>planRows[it.dish]).length;
                  const autoInGroup = g.items.length - overrideInGroup;
                  return(
                    <div key={g.cat.id} style={{marginBottom:10,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,overflow:"hidden"}}>
                      <div style={{padding:"8px 12px",background:C.bg,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{fontSize:12,fontWeight:600,color:C.text,display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>{g.cat.icon}</span>
                          <span>{g.cat.name}</span>
                          <span style={{fontSize:10,color:C.muted,fontWeight:400}}>({g.items.length})</span>
                        </div>
                        <div style={{fontSize:10,fontWeight:500,display:"flex",gap:6}}>
                          {autoInGroup>0 && <span style={{color:C.green}}>{autoInGroup} {T2("auto")}</span>}
                          {autoInGroup>0 && overrideInGroup>0 && <span style={{color:C.faint}}>·</span>}
                          {overrideInGroup>0 && <span style={{color:C.purple}}>{overrideInGroup} {T2("pinned")}</span>}
                        </div>
                      </div>
                      <div>
                        {g.items.flatMap((it,i)=>{
                          const st = it.st;
                          const mappedName = st.recipe && st.recipe.n && st.recipe.n.toLowerCase()!==(it.dish||"").toLowerCase().trim() ? st.recipe.n : null;
                          const rowCtx = {...ctx, recipe:st.recipe};
                          const basePax = st.recipe?.ingredients?.base_pax || 300;
                          const recSections = (st.recipe?.ingredients?.items||[]).filter(x=>x.isSection && x.yield?.kg>0);
                          const useSections = recSections.length>0;
                          const rowStyle = (isLast)=>({padding:"10px 12px",borderBottom:!isLast?`1px solid ${C.borderLight}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"});
                          const isLastGroupRow = i===g.items.length-1;
                          const secMult = yieldAdjustPct/100;
                          // V74: click dish name on any section row → one combined ingredient modal for all sections
                          let sectionFactors = null, sectionsTotalKg = 0, anySectionOverridden = false;
                          if(useSections){
                            sectionFactors = {};
                            recSections.forEach(sec=>{
                              const secAutoRaw = Math.round(selEv.pax/basePax * sec.yield.kg * 10)/10;
                              const secAutoScaled = Math.round(secAutoRaw * secMult * 10)/10;
                              const savedVal = planRows[it.dish]?.section_yields?.[sec.name];
                              const isSecOverride = savedVal!=null && savedVal!=="";
                              const effKgSec = isSecOverride ? Number(savedVal) : secAutoScaled;
                              sectionsTotalKg += (effKgSec || 0);
                              if(isSecOverride) anySectionOverridden = true;
                              sectionFactors[sec.name] = sec.yield.kg > 0 ? (effKgSec / sec.yield.kg) : 0;
                            });
                            sectionsTotalKg = Math.round(sectionsTotalKg * 10) / 10;
                          }
                          const canOpenSectioned = useSections && st.recipe && !!st.recipe?.ingredients?.items?.length;
                          const openIngrSectioned = () => { if(canOpenSectioned) setPlanIngrModal({dish: it.dish, effKg: sectionsTotalKg, mult: secMult, isOverride: anySectionOverridden, yieldAdjustPct: yieldAdjustPct, pax: selEv.pax, sectionFactors: sectionFactors}); };
                          if(useSections){
                            // Expand into N sub-rows, one per section. Same auto/pinned model as single-row.
                            return recSections.map((sec,si)=>{
                              const secAutoRaw = Math.round(selEv.pax/basePax * sec.yield.kg * 10)/10;
                              const secAutoScaled = Math.round(secAutoRaw * secMult * 10)/10;
                              const draftKey = it.dish+"|"+sec.name;
                              const savedVal = planRows[it.dish]?.section_yields?.[sec.name];
                              const isSecOverride = savedVal!=null && savedVal!=="";
                              const currentVal = planDrafts[draftKey] ?? (isSecOverride ? String(savedVal) : "");
                              const isSaving = planSaving.has(draftKey);
                              const isLast = isLastGroupRow && si===recSections.length-1;
                              const revertSecToAuto = ()=>{ setPlanDrafts(p=>{const c={...p};delete c[draftKey];return c;}); savePlanYield(it.dish, "", rowCtx, sec.name); };
                              return(
                                <div key={i+"-"+si} style={{...rowStyle(isLast),background:isSecOverride?C.purpleBg+"60":"transparent"}}>
                                  <div onClick={openIngrSectioned} title={canOpenSectioned ? T2("View scaled ingredients") : undefined} style={{flex:"1 1 200px",minWidth:0,cursor:canOpenSectioned?"pointer":"default"}}>
                                    <div style={{fontSize:12,color:C.text,fontWeight:500}}><span style={{textDecoration:canOpenSectioned?"underline":"none",textDecorationColor:canOpenSectioned?C.faint:"transparent",textDecorationStyle:"dotted",textUnderlineOffset:3}}>{it.dish}</span> <span style={{color:C.gold,fontWeight:600}}>→ {sec.name}</span></div>
                                    <div style={{fontSize:10,color:C.muted,marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                                      {mappedName && si===0 && <span>📖 {mappedName}</span>}
                                      {isSecOverride && <span style={{color:C.purple}}>{T2("pinned — slider ignored")} · {T2("auto was")} {secAutoScaled} kg</span>}
                                      {!isSecOverride && <span>{selEv.pax} pax{secMult!==1?` · ${yieldAdjustPct}%`:""}</span>}
                                    </div>
                                  </div>
                                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                                    <input type="number" step="any" inputMode="decimal" min="0"
                                      value={currentVal}
                                      onChange={e=>setPlanDrafts(p=>({...p,[draftKey]:e.target.value}))}
                                      onBlur={()=>{const d=planDrafts[draftKey];if(d===undefined)return;const ds=String(d).trim();const ss=String(savedVal??"");if(ds===ss)return;if(!isSecOverride && ds!=="" && ds===String(secAutoScaled)){setPlanDrafts(p=>{const c={...p};delete c[draftKey];return c;});return;}savePlanYield(it.dish, d, rowCtx, sec.name);}}
                                      onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}
                                      placeholder={String(secAutoScaled)}
                                      disabled={isSaving}
                                      style={{width:72,padding:"6px 8px",borderRadius:6,border:isSecOverride?`1.5px solid ${C.purple}`:`1px dashed ${C.border}`,fontSize:12,fontWeight:isSecOverride?600:400,textAlign:"right",background:isSecOverride?C.surface:"transparent",color:C.text,opacity:isSaving?0.6:1}} />
                                    <span style={{fontSize:10,color:C.muted}}>kg</span>
                                    {isSaving ? (
                                      <span style={{fontSize:10,color:C.muted,fontStyle:"italic",width:64}}>{T2("Saving")}...</span>
                                    ) : isSecOverride ? (
                                      <button onClick={revertSecToAuto} title={T2("Revert to auto")} style={{padding:"3px 6px",borderRadius:6,fontSize:10,fontWeight:600,color:C.purple,background:C.purpleBg,border:`1px solid ${C.purpleBorder}`,whiteSpace:"nowrap",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>📌 {T2("pinned")} <span style={{fontSize:12,marginLeft:1,lineHeight:1}}>×</span></button>
                                    ) : (
                                      <div style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:500,color:C.green,background:C.greenBg,border:`1px solid ${C.greenBorder}`,whiteSpace:"nowrap"}}>{T2("auto")}</div>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          }
                          // Single row: input is empty by default; placeholder shows auto suggestion (scaled by yield slider). Typing pins as override.
                          const mult = yieldAdjustPct/100;
                          const suggestedRaw = it.isBaseGravy ? Math.round(it.demandKg * 10)/10 : (st.baseYield ? Math.round(selEv.pax/basePax * st.baseYield * 10)/10 : null);
                          const suggested = suggestedRaw!=null ? Math.round(suggestedRaw * mult * 10)/10 : null;
                          const isOverride = !!planRows[it.dish];
                          const overrideKgRaw = isOverride ? planRows[it.dish]?.target_yield_kg : null;
                          const overrideEff = overrideKgRaw!=null ? Math.round(overrideKgRaw * mult * 10)/10 : null;
                          const currentVal = planDrafts[it.dish] ?? (isOverride ? String(overrideKgRaw ?? "") : "");
                          const isSaving = planSaving.has(it.dish);
                          const revertToAuto = ()=>{ setPlanDrafts(p=>{const c={...p};delete c[it.dish];return c;}); savePlanYield(it.dish, "", rowCtx); };
                          // V74: click dish name → open scaled ingredient modal
                          const effKg = isOverride ? overrideEff : suggested;
                          const canOpen = st.recipe && !!st.recipe?.ingredients?.items?.length && effKg != null;
                          const openIngr = () => { if (canOpen) setPlanIngrModal({dish: it.dish, effKg: effKg, mult: mult, isOverride: isOverride, yieldAdjustPct: yieldAdjustPct, pax: selEv.pax}); };
                          return [(
                            <div key={i} style={{...rowStyle(isLastGroupRow),background:isOverride?C.purpleBg+"60":"transparent"}}>
                              <div onClick={openIngr} title={canOpen ? T2("View scaled ingredients") : undefined} style={{flex:"1 1 200px",minWidth:0,cursor:canOpen?"pointer":"default"}}>
                                <div style={{fontSize:12,color:C.text,fontWeight:500,textDecoration:canOpen?"underline":"none",textDecorationColor:canOpen?C.faint:"transparent",textDecorationStyle:"dotted",textUnderlineOffset:3}}>{it.dish}</div>
                                <div style={{fontSize:10,color:C.muted,marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                                  {mappedName && <span>📖 {mappedName}</span>}
                                  {isOverride && suggested!=null && <span style={{color:C.purple}}>{T2("pinned — slider ignored")} · {T2("auto was")} {suggested} kg</span>}
                                  {!isOverride && suggested!=null && <span>{it.isBaseGravy ? T2("demand across this menu") : `${selEv.pax} ${T2("pax")}`}{mult!==1?` · ${yieldAdjustPct}%`:""}</span>}
                                  {!suggested && <span style={{color:C.amber}}>⚠ {T2("no base yield in recipe")}</span>}
                                </div>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                                <input type="number" step="any" inputMode="decimal" min="0"
                                  value={currentVal}
                                  onChange={e=>setPlanDrafts(p=>({...p,[it.dish]:e.target.value}))}
                                  onBlur={()=>onYieldBlur(it.dish, rowCtx)}
                                  onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}
                                  placeholder={suggested!=null?String(suggested):"—"}
                                  disabled={isSaving}
                                  style={{width:72,padding:"6px 8px",borderRadius:6,border:isOverride?`1.5px solid ${C.purple}`:`1px dashed ${C.border}`,fontSize:12,fontWeight:isOverride?600:400,textAlign:"right",background:isOverride?C.surface:"transparent",color:C.text,opacity:isSaving?0.6:1}} />
                                <span style={{fontSize:10,color:C.muted}}>kg</span>
                                {isSaving ? (
                                  <span style={{fontSize:10,color:C.muted,fontStyle:"italic",width:64}}>{T2("Saving")}...</span>
                                ) : isOverride ? (
                                  <button onClick={revertToAuto} title={T2("Revert to auto")} style={{padding:"3px 6px",borderRadius:6,fontSize:10,fontWeight:600,color:C.purple,background:C.purpleBg,border:`1px solid ${C.purpleBorder}`,whiteSpace:"nowrap",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>📌 {T2("pinned")} <span style={{fontSize:12,marginLeft:1,lineHeight:1}}>×</span></button>
                                ) : (
                                  <div style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:500,color:C.green,background:C.greenBg,border:`1px solid ${C.greenBorder}`,whiteSpace:"nowrap"}}>{T2("auto")}</div>
                                )}
                              </div>
                            </div>
                          )];
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Unmapped bucket */}
                {unmapped.length>0 && (
                  <div style={{marginBottom:10,borderRadius:10,border:`1px solid ${C.red}30`,background:C.surface,overflow:"hidden"}}>
                    <div style={{padding:"8px 12px",background:C.red+"08",borderBottom:`1px solid ${C.red}20`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.red,display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:14}}>?</span>
                        <span>{T2("Unmapped")}</span>
                        <span style={{fontSize:10,color:C.muted,fontWeight:400}}>({unmapped.length})</span>
                      </div>
                      <div style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>{T2("Fix via Dish Map")}</div>
                    </div>
                    <div>
                      {unmapped.map((it,i)=>(
                        <div key={i} style={{padding:"8px 12px",borderBottom:i<unmapped.length-1?`1px solid ${C.borderLight}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                          <div style={{flex:1,minWidth:0,fontSize:12,color:C.text}}>{it.dish}</div>
                          <div style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,color:C.red,background:C.red+"15",border:`1px solid ${C.red}30`,whiteSpace:"nowrap"}}>{T2("No recipe")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>);
            })()}
          </div>
        );
      })()}

      {tab==="analytics"&&(()=>{
        const allEvs=[...todayEvs,...tomorrowEvs,...evList.filter(e=>e.date!==TODAY&&e.date!==TOMORROW)];
        const uniqueDates=[...new Set(allEvs.map(e=>e.date))].sort().reverse();
        const selDate=analyticsDate||uniqueDates[0]||TODAY;
        const combKey="__combined_"+selDate;
        const hasCombined=kt[combKey]&&Object.keys(kt[combKey]).length>0;
        const dateEvs=allEvs.filter(e=>e.date===selDate);
        const fmtDate=d=>{try{return new Date(d+"T00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",weekday:"short"});}catch(e){return d;}};
        const selId=analyticsEvId||(dateEvs[0]?.id||null);
        function buildPerf(dishName,d2s){
          const allSt=getStepsForDish(dishName);const d1St=allSt.filter(s=>s.d1);
          const steps=d1St.length>0?d1St:allSt;
          const catId=getCatIdForDish(dishName);const cat=getCatForDish(dishName);
          const hasData=Object.keys(d2s).length>0;
          const storeT=d2s.storeEnd&&d2s.storeStart?Math.floor((d2s.storeEnd-d2s.storeStart)/1000):null;
          const totalT=d2s.dishCompletedAt&&d2s.dishStartedAt?Math.floor((d2s.dishCompletedAt-d2s.dishStartedAt)/1000):null;
          let expT=0,actT=0,overC=0,underC=0;
          const sPerfs=steps.map((step,si)=>{
            const sk="step_"+si;const hs=Array.isArray(step.subs)&&step.subs.length>0;
            if(hs){
              const subs=step.subs.map((sb,sbi)=>{
                const sbk=sk+"_sub_"+sbi;const exp=sb.tm||0;const act=d2s.doneElapsed?.[sbk];
                const done=!!(d2s.manual?.[sbk]);const delta=act!=null&&exp?act-exp:null;
                if(exp)expT+=exp;if(act!=null)actT+=act;
                if(delta!=null){if(delta>0)overC++;if(delta<0)underC++;}
                return{l:sb.t,exp,act,done,delta};
              });
              return{l:step.t,hs:true,subs,done:subs.every(s=>s.done)};
            }
            const exp=step.tm||0;const act=d2s.doneElapsed?.[sk];
            const done=!!(d2s.manual?.[sk]);const delta=act!=null&&exp?act-exp:null;
            if(exp)expT+=exp;if(act!=null)actT+=act;
            if(delta!=null){if(delta>0)overC++;if(delta<0)underC++;}
            return{l:step.t,hs:false,exp,act,done,delta};
          });
          const status=d2s.mesaDone?"done":hasData?"in_progress":"not_started";
          return{name:dishName,catId,catName:cat.name||"",catIcon:cat.icon||"🍽",catColor:cat.color||C.muted,isDone:status==="done",status,hasData,storeT,totalT,expT,actT,overC,underC,delta:hasData?actT-expT:0,sPerfs};
        }
        const perfs=[];const seen=new Set();
        if(selId==="__combined"){
          Object.entries(kt[combKey]||{}).forEach(([k,d2s])=>{if(k.startsWith("dish|")){const n=k.slice(5);perfs.push(buildPerf(n,d2s));seen.add(n);}});
          allEvs.forEach(ev=>{menuArr(ev).forEach(name=>{if(!seen.has(name)){perfs.push(buildPerf(name,{}));seen.add(name);}});});
        } else if(selId){
          const ev=allEvs.find(e=>e.id===selId);
          if(ev)menuArr(ev).forEach((name,idx)=>{if(!seen.has(name)){const d2s=kt[combKey]?.["dish|"+name]||kt[selId]?.[selId+"|"+idx]||{};perfs.push(buildPerf(name,d2s));seen.add(name);}});
        }
        const done=perfs.filter(p=>p.isDone);const started=perfs.filter(p=>!p.isDone&&p.actT>0);
        const byS={};perfs.forEach(p=>{if(!byS[p.catId])byS[p.catId]={n:p.catName,ic:p.catIcon,co:p.catColor,ds:[]};byS[p.catId].ds.push(p);});
        const avgDelta=done.length?Math.round(done.reduce((s,p)=>s+p.delta,0)/done.length):0;
        const avgStoreArr=done.filter(p=>p.storeT!=null);const avgStoreT=avgStoreArr.length?Math.round(avgStoreArr.reduce((s,p)=>s+p.storeT,0)/avgStoreArr.length):null;
        const totalOver=done.reduce((s,p)=>s+p.overC,0);const totalUnder=done.reduce((s,p)=>s+p.underC,0);
        const fS=s=>{if(s==null)return"—";const m=Math.floor(Math.abs(s)/60);const sc=Math.abs(s)%60;return m+"m"+(sc>0?" "+sc+"s":"");};
        const dC=d=>d==null?C.faint:d>5?C.red:d<-5?C.green:C.muted;
        const dBadge=d=>d==null?"—":d>0?"+"+fS(d):d<0?fS(Math.abs(d))+" under":"on time";
        
        const selEv=selId&&selId!=="__combined"?allEvs.find(e=>e.id===selId):null;
        return(
          <div>
            <div style={{fontSize:18,fontWeight:500,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>📊 {T2("Kitchen Analytics")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Performance analysis — timing, efficiency, ingredient variance")}</div>
            {/* —— Calendar Date Picker —— */}
            <div style={{marginBottom:16}}>
              {(()=>{
                const pad2=n=>String(n).padStart(2,"0");
                const MO_N=["January","February","March","April","May","June","July","August","September","October","November","December"];
                const DY=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                const first=new Date(calYr,calMo,1).getDay();
                const dim=new Date(calYr,calMo+1,0).getDate();
                const prevDim=new Date(calYr,calMo,0).getDate();
                const cells2=[];
                for(let i=first-1;i>=0;i--) cells2.push({d:prevDim-i,c:false});
                for(let i=1;i<=dim;i++) cells2.push({d:i,c:true});
                while(cells2.length<42) cells2.push({d:cells2.length-first-dim+1,c:false});
                const cDate=cell=>cell.c?`${calYr}-${pad2(calMo+1)}-${pad2(cell.d)}`:null;
                const eod2=d=>allEvs.filter(e=>e.date===d);
                const prevMo=()=>{if(calMo===0){setCalMo(11);setCalYr(y=>y-1);}else setCalMo(m=>m-1);};
                const nextMo=()=>{if(calMo===11){setCalMo(0);setCalYr(y=>y+1);}else setCalMo(m=>m+1);};
                const todayS=TODAY;
                return(
                <div style={{borderRadius:12,border:`1px solid ${C.border}`,background:C.surface,marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <button onClick={prevMo} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:14,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
                      <div style={{fontSize:15,fontWeight:600,color:C.text,minWidth:140,textAlign:"center"}}>{MO_N[calMo]} {calYr}</div>
                      <button onClick={nextMo} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:14,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
                    </div>
                    <button onClick={()=>{setCalYr(new Date().getFullYear());setCalMo(new Date().getMonth());setAnalyticsDate(todayS);setAnalyticsEvId(null);setAnalyticsExp(new Set());}} style={{padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:11,fontWeight:500,cursor:"pointer"}}>Today</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                    {DY.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:600,color:C.muted,padding:"6px 0",background:C.bg}}>{d}</div>)}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                    {cells2.map((cell,i)=>{const dt=cDate(cell);const evs2=dt?eod2(dt):[];const isT=dt===todayS;const isS=dt===selDate;
                      const vCols=[...new Set(evs2.map(e=>anaGp(e.venue).c))];
                      const hasTracked=evs2.some(e=>Object.keys(kt[e.id]||{}).filter(k=>!k.startsWith("__")).length>0);
                      return(
                        <div key={i} onClick={()=>{if(!dt)return;setAnalyticsDate(dt);setAnalyticsEvId(null);setAnalyticsExp(new Set());}}
                          style={{height:52,padding:"5px 6px",cursor:dt?"pointer":"default",
                            borderBottom:`1px solid ${C.borderLight}`,borderRight:(i%7)<6?`1px solid ${C.borderLight}`:"none",
                            background:isS?C.goldBg:isT?"#FAEEDA":hasTracked?"rgba(29,158,117,0.07)":"transparent",opacity:cell.c?1:.2}}>
                          <div style={{fontSize:12,fontWeight:isT||isS?600:400,color:isS?C.gold:isT?"#BA7517":hasTracked?C.green:C.text}}>{cell.d}{hasTracked&&<span style={{fontSize:8,marginLeft:1,verticalAlign:"super"}}>—</span>}</div>
                          {vCols.length>0&&<div style={{display:"flex",gap:2,marginTop:2}}>{vCols.slice(0,4).map((col,ci)=><div key={ci} style={{width:6,height:6,borderRadius:"50%",background:col}}/>)}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:10,padding:"6px 14px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                    {Object.entries(ANA_VP).map(([v,p])=><div key={v} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:6,height:6,borderRadius:"50%",background:p.c}}/><span style={{fontSize:10,color:C.muted}}>{p.code}</span></div>)}
                    <div style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:14,height:14,borderRadius:3,background:"rgba(29,158,117,0.08)",border:"1px solid rgba(29,158,117,0.18)"}}><span style={{fontSize:7,color:C.green,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>—</span></div><span style={{fontSize:10,color:C.muted}}>Tracked</span></div>
                  </div>
                </div>);
              })()}
              {/* —— Event cards for selected date —— */}
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{fmtDate(selDate)} · {dateEvs.length} event{dateEvs.length!==1?"s":""}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                {hasCombined&&<button onClick={()=>{setAnalyticsEvId("__combined");setAnalyticsExp(new Set());}} style={{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:selId==="__combined"?700:400,cursor:"pointer",background:selId==="__combined"?C.gold+"20":"transparent",color:selId==="__combined"?C.gold:C.muted,border:`1.5px solid ${selId==="__combined"?C.gold:C.border}`,minHeight:40}}>👥 Combined</button>}
                {dateEvs.map(ev=>{const isSel=selId===ev.id;const tracked=Object.keys(kt[ev.id]||{}).filter(k=>!k.startsWith("__")).length;const mc=menuArr(ev).length;const vc=anaGp(ev.venue);return(
                  <button key={ev.id} onClick={()=>{setAnalyticsEvId(ev.id);setAnalyticsExp(new Set());}} style={{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:isSel?700:400,cursor:"pointer",background:isSel?vc.c:"transparent",color:isSel?"#fff":C.muted,border:`1.5px solid ${isSel?vc.c:C.border}`,minHeight:40,textAlign:"left",borderLeft:`3px solid ${vc.c}`}}>
                    <div style={{fontWeight:600}}>{ev.guest||"Function"}</div>
                    <div style={{fontSize:10,opacity:.8}}>{ev.pax} pax · {mc} dishes{tracked>0?" · "+tracked+" tracked":""} · {ev.venue||""}</div>
                  </button>
                );})}
                {dateEvs.length===0&&<div style={{padding:"12px",fontSize:12,color:C.faint}}>No events on this date</div>}
              </div>
            </div>
            {perfs.length===0&&<div style={{padding:"40px 20px",textAlign:"center",borderRadius:14,border:`1.5px solid ${C.border}`,background:C.surface}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div style={{fontSize:14,color:C.muted}}>{T2("Select an event above. Complete dishes in Prep Day or Event Day to see full analytics.")}</div></div>}
            {perfs.length>0&&(<>
            {/* —— Summary Cards —— */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
              <div style={{padding:"14px 16px",borderRadius:12,background:C.surface,border:`1.5px solid ${C.border}`}}>
                <div style={{fontSize:24,fontWeight:700,color:C.text}}>{done.length}<span style={{fontSize:13,color:C.muted,fontWeight:400}}>/{perfs.length}</span></div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>Dishes done</div>
                {started.length>0&&<div style={{fontSize:10,color:C.amber,marginTop:2}}>{started.length} in progress</div>}
                {perfs.filter(p=>p.status==="not_started").length>0&&<div style={{fontSize:10,color:C.faint,marginTop:1}}>{perfs.filter(p=>p.status==="not_started").length} not started</div>}
              </div>
              {done.length>0&&<div style={{padding:"14px 16px",borderRadius:12,background:avgDelta>0?C.redBg:C.greenBg,border:`1.5px solid ${avgDelta>0?C.redBorder:C.greenBorder}`}}>
                <div style={{fontSize:24,fontWeight:700,color:avgDelta>0?C.red:C.green}}>{avgDelta>0?"+":""}{fS(avgDelta)}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>Avg step delta</div>
              </div>}
              {(totalOver>0||totalUnder>0)&&<div style={{padding:"14px 16px",borderRadius:12,background:C.surface,border:`1.5px solid ${C.border}`}}>
                <div style={{display:"flex",gap:8,alignItems:"baseline"}}><span style={{fontSize:20,fontWeight:700,color:C.green}}>{totalUnder}</span><span style={{fontSize:11,color:C.muted}}>under</span><span style={{fontSize:20,fontWeight:700,color:C.red}}>{totalOver}</span><span style={{fontSize:11,color:C.muted}}>over</span></div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>Step timing</div>
              </div>}
              {avgStoreT!=null&&<div style={{padding:"14px 16px",borderRadius:12,background:C.surface,border:`1.5px solid ${C.border}`}}>
                <div style={{fontSize:24,fontWeight:700,color:C.gold}}>{fS(avgStoreT)}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>Avg store collection</div>
              </div>}
            </div>
            {/* —— Section Breakdown —— */}
            <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Dishes by Section</div>
            <div style={{marginBottom:20}}>
              {Object.entries(byS).map(([cid,sec])=>{const dn=sec.ds.filter(d=>d.isDone).length;const ov=sec.ds.reduce((s,d)=>s+d.overC,0);const un=sec.ds.reduce((s,d)=>s+d.underC,0);const pct=sec.ds.length>0?Math.round(dn/sec.ds.length*100):0;const secOpen=analyticsExp.has("sec_"+cid);return(
                <div key={cid} style={{marginBottom:8,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface}}>
                  <div onClick={()=>{setAnalyticsExp(p=>{const s=new Set(p);s.has("sec_"+cid)?s.delete("sec_"+cid):s.add("sec_"+cid);return s;});}} style={{padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:20}}>{sec.ic}</span>
                      <div><div style={{fontSize:13,fontWeight:600,color:sec.co}}>{sec.n}</div><div style={{fontSize:11,color:C.muted}}>{dn}/{sec.ds.length} done</div></div>
                    </div>
                    <div style={{display:"flex",gap:12,alignItems:"center"}}>
                      <div style={{width:60,height:5,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:sec.co,borderRadius:3}}/></div>
                      <span style={{fontSize:11,color:C.green,fontWeight:600}}>—{un}</span>
                      <span style={{fontSize:11,color:C.red,fontWeight:600}}>—{ov}</span>
                      <span style={{fontSize:14,color:C.faint}}>{secOpen?"+":"—"}</span>
                    </div>
                  </div>
                  {secOpen&&<div style={{padding:"0 12px 12px",borderTop:`1px solid ${C.borderLight}`}}>
                    {sec.ds.sort((a,b)=>{const o={done:0,in_progress:1,not_started:2};return o[a.status]-o[b.status];}).map(p=>{const isOpen=analyticsExp.has(p.name);const usageLog=(usageLogs||[]).find(l=>l.dish_name===p.name);const stColor=p.status==="done"?C.green:p.status==="in_progress"?C.amber:C.faint;const stLabel=p.status==="done"?"✅":p.status==="in_progress"?"⏳":"⏸";return(
                      <div key={p.name} style={{marginTop:6,borderRadius:8,border:`1px solid ${p.status==="not_started"?C.borderLight:C.border}`,background:p.status==="not_started"?C.bg:C.surface,opacity:p.status==="not_started"?.6:1}}>
                        <div onClick={()=>{if(p.hasData)toggleAnalyticsDish(p.name);}} style={{padding:"10px 12px",cursor:p.hasData?"pointer":"default",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontSize:12,fontWeight:600,color:p.status==="not_started"?C.faint:C.text}}>{stLabel} {p.name}</div>
                            <div style={{fontSize:10,color:C.muted}}>{p.isDone&&p.totalT!=null?"Total: "+fS(p.totalT)+" · ":""}Expected: {fS(p.expT)||"—"}</div>
                            {usageLog&&(()=>{
                              const ings=usageLog.ingredients||[];
                              const varIngs=ings.filter(i=>i.actual_qty!=null&&i.scaled_qty!=null&&Math.abs(i.actual_qty-i.scaled_qty)>0.01);
                              const pcts=varIngs.map(i=>({name:i.name,pct:i.scaled_qty>0?Math.round((i.actual_qty-i.scaled_qty)/i.scaled_qty*100):0}));
                              const absPcts=pcts.map(x=>Math.abs(x.pct));
                              const avgAbs=absPcts.length?Math.round(absPcts.reduce((s,x)=>s+x,0)/absPcts.length):0;
                              const worst=pcts.reduce((w,x)=>Math.abs(x.pct)>Math.abs(w?.pct||0)?x:w,null);
                              const hasYield=usageLog.yield_qty!=null;
                              const hasVar=varIngs.length>0;
                              if(!hasVar&&!hasYield&&ings.length===0) return null;
                              return(
                                <div style={{fontSize:10,color:C.muted,marginTop:3,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                                  {hasVar?(<>
                                    <span>📊 <b style={{color:C.text}}>{varIngs.length}</b>/{ings.length} +—</span>
                                    <span>avg <b style={{color:avgAbs>10?C.amber:C.text}}>{avgAbs}%</b></span>
                                    {worst&&<span>worst <span style={{fontWeight:700,color:worst.pct>0?C.red:C.green,padding:"1px 5px",borderRadius:3,background:worst.pct>0?C.redBg:C.greenBg}}>{worst.pct>0?"+":""}{worst.pct}%</span> <span style={{color:C.faint}}>{worst.name}</span></span>}
                                  </>):ings.length>0?<span style={{color:C.faint}}>✅ all ingredients on target</span>:null}
                                  {hasYield&&<span>-+ yield <b style={{color:C.gold}}>{usageLog.yield_qty} {usageLog.yield_unit||""}</b></span>}
                                </div>
                              );
                            })()}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {p.isDone&&p.hasData&&<div style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:700,background:p.delta>5?C.redBg:p.delta<-5?C.greenBg:C.surface,border:`1px solid ${p.delta>5?C.redBorder:p.delta<-5?C.greenBorder:C.border}`,color:p.delta>5?C.red:p.delta<-5?C.green:C.muted}}>{p.delta>0?"+":""}{fS(p.delta)}</div>}
                            {p.hasData&&<span style={{fontSize:12,color:C.faint}}>{isOpen?"+":"—"}</span>}
                          </div>
                        </div>
                        {isOpen&&<div style={{padding:"0 12px 10px",borderTop:`1px solid ${C.borderLight}`}}>
                          {p.storeT!=null&&<div style={{padding:"6px 0",fontSize:11,color:C.muted}}>⏱ Store: <b style={{color:C.gold}}>{fS(p.storeT)}</b></div>}
                          {p.sPerfs.map((sp,si)=>{
                            if(sp.hs){return(
                              <div key={si} style={{padding:"4px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                                <div style={{fontSize:11,fontWeight:600,color:sp.done?C.green:C.text,marginBottom:3}}>{si+1}. {sp.l} {sp.done&&"—"}</div>
                                <div style={{marginLeft:14}}>
                                  {sp.subs.map((sub,sbi)=>{const dc=sub.delta!=null?(sub.delta>0?C.red:sub.delta<0?C.green:C.muted):C.faint;return(
                                    <div key={sbi} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",fontSize:10}}>
                                      <span style={{color:sub.done?C.green:C.text}}>{si+1}{String.fromCharCode(97+sbi)}. {sub.l}</span>
                                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                                        <span style={{color:C.faint}}>SOP {sub.exp?fS(sub.exp):"—"}</span>
                                        <span style={{fontWeight:600,color:sub.done?dc:C.faint}}>{sub.act!=null?fS(sub.act):"—"}</span>
                                        {sub.delta!=null&&<span style={{fontWeight:700,color:dc,fontSize:9}}>{sub.delta>0?"+":""}{fS(Math.abs(sub.delta))}</span>}
                                      </div>
                                    </div>
                                  );})}
                                </div>
                              </div>
                            );}
                            const dc=sp.delta!=null?(sp.delta>0?C.red:sp.delta<0?C.green:C.muted):C.faint;
                            return(
                              <div key={si} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.borderLight}`,fontSize:11}}>
                                <span style={{color:sp.done?C.green:C.text}}>{si+1}. {sp.l} {sp.done&&"—"}</span>
                                <div style={{display:"flex",gap:8,flexShrink:0}}>
                                  <span style={{color:C.faint,fontSize:10}}>SOP {sp.exp?fS(sp.exp):"—"}</span>
                                  <span style={{fontWeight:600,color:sp.done?dc:C.faint,fontSize:10}}>{sp.act!=null?fS(sp.act):"—"}</span>
                                  {sp.delta!=null&&<span style={{fontSize:9,fontWeight:700,color:dc,padding:"1px 4px",borderRadius:4,background:sp.delta>0?C.redBg:C.greenBg}}>{sp.delta>0?"+":""}{fS(sp.delta)}</span>}
                                </div>
                              </div>
                            );
                          })}
                          {usageLog&&(()=>{const dts=(usageLog.ingredients||[]).filter(i=>i.actual_qty!=null);if(dts.length===0)return null;return(
                            <div style={{marginTop:8,padding:"8px 10px",borderRadius:6,background:C.bg,border:`1px solid ${C.border}`}}>
                              <div style={{fontSize:10,fontWeight:700,color:C.gold,marginBottom:4}}>🥄 Ingredients</div>
                              {dts.map((ing,ii)=>{const diff=ing.actual_qty-ing.scaled_qty;const pct=ing.scaled_qty>0?Math.round(diff/ing.scaled_qty*100):0;return(
                                <div key={ii} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",fontSize:10,borderBottom:ii<dts.length-1?`1px solid ${C.borderLight}`:"none"}}>
                                  <span style={{color:C.text}}>{ing.name}</span>
                                  <span><span style={{color:C.faint}}>{ing.scaled_qty}{ing.unit}</span> — <b style={{color:C.text}}>{ing.actual_qty}{ing.unit}</b> <span style={{fontWeight:700,color:diff>0?C.red:C.green}}>{diff>0?"+":""}{pct}%</span></span>
                                </div>
                              );})}
                            </div>
                          );})()}
                        </div>}
                      </div>
                    );})}
                  </div>}
                </div>
              );})}
            </div>
            {/* —— Dish Performance —— */}
            
            {false&&perfs.sort((a,b)=>{if(a.status!==b.status){const o={done:0,in_progress:1,not_started:2};return o[a.status]-o[b.status];}if(a.isDone&&b.isDone)return b.delta-a.delta;return 0;}).map(p=>{const isOpen=analyticsExp.has(p.name);const usageLog=(usageLogs||[]).find(l=>l.dish_name===p.name);const stColor=p.status==="done"?C.green:p.status==="in_progress"?C.amber:C.faint;const stLabel=p.status==="done"?"— Done":p.status==="in_progress"?"⏳ In progress":"— Not started";return(
              <div key={p.name} style={{marginBottom:6,borderRadius:10,border:`1px solid ${p.status==="not_started"?C.borderLight:C.border}`,background:p.status==="not_started"?C.bg:C.surface,opacity:p.status==="not_started"?.7:1}}>
                <div onClick={()=>{if(p.hasData)toggleAnalyticsDish(p.name);}} style={{padding:"12px 16px",cursor:p.hasData?"pointer":"default",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:14}}>{p.catIcon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:p.status==="not_started"?C.faint:C.text}}>{p.name}<span style={{marginLeft:8,fontSize:10,color:stColor,fontWeight:500}}>{stLabel}</span></div>
                      <div style={{fontSize:11,color:C.muted}}>{p.isDone&&p.totalT!=null?"Total: "+fS(p.totalT)+" · ":""}Expected: {fS(p.expT)||"—"}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    {p.isDone&&p.hasData&&<div style={{padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:700,background:p.delta>5?C.redBg:p.delta<-5?C.greenBg:C.surface,border:`1px solid ${p.delta>5?C.redBorder:p.delta<-5?C.greenBorder:C.border}`,color:p.delta>5?C.red:p.delta<-5?C.green:C.muted}}>{p.delta>0?"+":""}{fS(p.delta)}</div>}
                    {p.hasData&&<span style={{fontSize:14,color:C.faint}}>{isOpen?"+":"—"}</span>}
                  </div>
                </div>
                {isOpen&&<div style={{padding:"0 16px 14px",borderTop:`1px solid ${C.borderLight}`}}>
                  {p.storeT!=null&&<div style={{padding:"8px 0",fontSize:12,color:C.muted}}>⏱ Store collection: <b style={{color:C.gold}}>{fS(p.storeT)}</b></div>}
                  {p.sPerfs.map((sp,si)=>{
                    if(sp.hs){return(
                      <div key={si} style={{padding:"6px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                        <div style={{fontSize:12,fontWeight:600,color:sp.done?C.green:C.text,marginBottom:4}}>{si+1}. {sp.l} {sp.done&&"—"}</div>
                        <div style={{marginLeft:16}}>
                          {sp.subs.map((sub,sbi)=>{const dc=sub.delta!=null?(sub.delta>0?C.red:sub.delta<0?C.green:C.muted):C.faint;return(
                            <div key={sbi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",fontSize:11}}>
                              <span style={{color:sub.done?C.green:C.text}}>{si+1}{String.fromCharCode(97+sbi)}. {sub.l}</span>
                              <div style={{display:"flex",gap:8,flexShrink:0}}>
                                <span style={{color:C.faint}}>{sub.exp?fS(sub.exp):"—"}</span>
                                <span style={{fontWeight:600,color:sub.done?dc:C.faint}}>{sub.act!=null?fS(sub.act):"—"}</span>
                                {sub.delta!=null&&<span style={{fontSize:10,fontWeight:700,color:dc,minWidth:50,textAlign:"right"}}>{sub.delta>0?"+":""}{fS(Math.abs(sub.delta))}</span>}
                              </div>
                            </div>
                          );})}
                        </div>
                      </div>
                    );}
                    const dc=sp.delta!=null?(sp.delta>0?C.red:sp.delta<0?C.green:C.muted):C.faint;
                    return(
                      <div key={si} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.borderLight}`,fontSize:12}}>
                        <span style={{color:sp.done?C.green:C.text,fontWeight:500}}>{si+1}. {sp.l} {sp.done&&"—"}</span>
                        <div style={{display:"flex",gap:10,flexShrink:0,alignItems:"center"}}>
                          <span style={{color:C.faint,fontSize:11}}>SOP: {sp.exp?fS(sp.exp):"—"}</span>
                          <span style={{fontWeight:600,color:sp.done?dc:C.faint,fontSize:11}}>Actual: {sp.act!=null?fS(sp.act):"—"}</span>
                          {sp.delta!=null&&<span style={{fontSize:10,fontWeight:700,color:dc,padding:"2px 6px",borderRadius:6,background:sp.delta>0?C.redBg:C.greenBg}}>{sp.delta>0?"+":" "}{fS(sp.delta)}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {/* Ingredient deltas for this dish */}
                  {usageLog&&(()=>{const dts=(usageLog.ingredients||[]).filter(i=>i.actual_qty!=null);if(dts.length===0)return null;return(
                    <div style={{marginTop:10,padding:"10px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.gold,marginBottom:6}}>📊 Ingredient Usage</div>
                      {dts.map((ing,ii)=>{const diff=ing.actual_qty-ing.scaled_qty;const pct=ing.scaled_qty>0?Math.round(diff/ing.scaled_qty*100):0;const isOver=diff>0.01;const isUnder=diff<-0.01;return(
                        <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",fontSize:11,borderBottom:ii<dts.length-1?`1px solid ${C.borderLight}`:"none"}}>
                          <span style={{color:C.text}}>{ing.name}</span>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{color:C.faint}}>{ing.scaled_qty} {ing.unit}</span>
                            <span style={{color:C.text,fontWeight:600}}>— {ing.actual_qty} {ing.unit}</span>
                            {(isOver||isUnder)&&<span style={{fontSize:10,fontWeight:700,color:isOver?C.red:C.green,padding:"1px 6px",borderRadius:4,background:isOver?C.redBg:C.greenBg}}>{isOver?"+":""}{pct}%</span>}
                            {!isOver&&!isUnder&&<span style={{fontSize:10,color:C.green}}>—</span>}
                          </div>
                        </div>
                      );})}
                    </div>
                  );})()}
                </div>}
              </div>
            );})}
            
            </>)}
          </div>
        );
      })()}

      {/* --- DISH NAME MAPPING MODAL --- */}
      {showDishMap&&currentUser?.role==='admin'&&(()=>{
        // Collect all unique LMS dish names from today + tomorrow events
        const allEvs = [...todayEvs, ...tomorrowEvs];
        const lmsNames = [...new Set(allEvs.flatMap(ev=>menuArr(ev)))].sort();
        const allRecipes = RECIPE_DB.cats.flatMap(cat=>(RECIPE_DB.recipes[cat.id]||[]).map(r=>({n:r.n,cat:cat.name,catId:cat.id})));
        // For each LMS name, determine status
        const rows = lmsNames.map(lms=>{
          const mapped = DISH_NAME_MAP[lms];
          if(mapped){
            const rec = allRecipes.find(r=>r.n===mapped||r.n.toLowerCase().trim()===mapped.toLowerCase().trim());
            return {lms, status:"mapped", sopName:mapped, cat:rec?.cat||""};
          }
          const auto = findRecipeForDish(lms);
          if(auto) return {lms, status:"auto", sopName:auto.n, cat:auto.cat?.name||""};
          return {lms, status:"unlinked", sopName:null, cat:""};
        });
        const unlinked = rows.filter(r=>r.status==="unlinked");
        const mapped = rows.filter(r=>r.status==="mapped");
        const auto = rows.filter(r=>r.status==="auto");
        const dq = dishMapSearch.trim().toLowerCase();
        const filteredRows = rows.filter(r=>{
          if(dishMapFilter!=="all" && r.status!==dishMapFilter) return false;
          if(!dq) return true;
          return r.lms.toLowerCase().includes(dq) || (r.sopName||"").toLowerCase().includes(dq);
        });
        // "__none__" is the sentinel for "deliberately has no SOP" — it is not a
        // real recipe name, so it must never be shown as if it were one.
        const isNoneSop = n => !n || String(n).trim().toLowerCase()==="__none__";

        async function saveMappings(){
          const entries = Object.entries(dishMapSel).filter(([k,v])=>v);
          if(entries.length===0) return;
          setDishMapSaving(true);
          try{
            const sb = supabase; if(!sb){setDishMapSaving(false);return;}
            for(const [lmsName, recipeName] of entries){
              const {error} = await sb.from('dish_name_map').upsert({lms_name:lmsName, recipe_dish_name:recipeName},{onConflict:'lms_name'});
              if(error) console.error('Map save error:', lmsName, error);
              else DISH_NAME_MAP[lmsName] = recipeName;
            }
            setDishMapSel({});
            // resetModal is this screen's generic notice dialog — reused here so
            // the mapping flow gets the app's own framing instead of window.alert.
            setResetModal({tone:"ok",icon:"check",title:T2("Mappings saved"),
              body:`${entries.length} ${entries.length===1?T2("mapping"):T2("mappings")} ${T2("saved")}.`,
              confirmLabel:T2("Done")});
          }catch(e){
            console.error('Map save error:',e);
            setResetModal({tone:"danger",icon:"alert",title:T2("Could not save"),
              body:String(e?.message||e),confirmLabel:T2("Close")});
          }
          setDishMapSaving(false);
        }

        function askRemoveMapping(lmsName){
          setResetModal({tone:"danger",icon:"trash",title:T2("Remove this mapping?"),
            body:`"${lmsName}" ${T2("will no longer be linked to a SOP recipe.")}`,
            confirmLabel:T2("Remove"),
            onConfirm:()=>{setResetModal(null);removeMapping(lmsName);}});
        }

        async function removeMapping(lmsName){
          try{
            const sb = supabase; if(!sb)return;
            await sb.from('dish_name_map').delete().eq('lms_name',lmsName);
            delete DISH_NAME_MAP[lmsName];
            setDishMapSel(p=>{const n={...p};delete n[lmsName];return n;});
          }catch(e){console.error(e);}
        }

        const pendingCount = Object.values(dishMapSel).filter(Boolean).length;

        return(
        // Only the row list scrolls. The overlay used to scroll too, so reaching
        // the end of the list chained the scroll outward and dragged the whole
        // dialog up until the title was clipped off the top of the window.
        <div style={{position:"fixed",inset:0,zIndex:9999,background:K.modalScrim,display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflow:"hidden"}} onClick={e=>{if(e.target===e.currentTarget)setShowDishMap(false);}}>
          <div className="kh-modal-card" style={{background:K.modalBg,border:`1px solid ${K.modalLine}`,borderRadius:K.modalRadius,width:"min(96vw,760px)",maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",boxShadow:K.shadowLift,overflow:"hidden"}}>
            {/* Header */}
            <div style={{position:"relative",padding:"22px 24px 16px",borderBottom:`1px solid ${K.modalLine}`,flexShrink:0}}>
              <button onClick={()=>setShowDishMap(false)} onPointerDown={ripple} aria-label={T2("Close")} className="kh-modal-x kh-rip"
                style={{position:"absolute",top:16,right:16,width:34,height:34,borderRadius:K.rPill,background:K.surface,border:`1px solid ${K.modalLine}`,color:K.textMuted,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0}}>
                <Icon name="close" size={16} strokeWidth={2.1}/>
              </button>
              <div style={{display:"flex",gap:14,alignItems:"center",paddingRight:44}}>
                <span style={{width:46,height:46,borderRadius:15,flexShrink:0,background:K.brandBg,color:K.brand,border:`1px solid ${K.brandBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon name="link" size={22} strokeWidth={1.85}/>
                </span>
                <div style={{minWidth:0}}>
                  <div style={{...type.sectionHead,fontSize:21,color:K.hdrTitle}}>{T2("Dish Name Mapping")}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12.5,color:K.hdrMeta,marginTop:2}}>
                    {T2("Link LMS menu items")}<Icon name="chevronR" size={13} strokeWidth={2.2}/>{T2("SOP recipes")}
                    <span style={{color:K.textFaint}}>· {lmsNames.length} {T2("dishes")}</span>
                  </div>
                </div>
              </div>
              {/* Status chips are filters, not just counters. Selected chip fills
                  in its own tone; the rest stay outline so the active one reads
                  at a glance. */}
              <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
                {[
                  {k:"all",      n:rows.length,      l:T2("all"),          ic:"layers", t:tone("brand")},
                  {k:"unlinked", n:unlinked.length,  l:T2("unlinked"),     ic:"alert",  t:tone("danger")},
                  {k:"mapped",   n:mapped.length,    l:T2("mapped"),       ic:"link",   t:tone("brand")},
                  {k:"auto",     n:auto.length,      l:T2("auto-matched"), ic:"check",  t:tone("ok")},
                ].map(c=>{
                  const on = dishMapFilter===c.k;
                  return (
                    <button key={c.k} type="button" className="kh-rip kh-chipfilter" onPointerDown={ripple}
                      onClick={()=>setDishMapFilter(on?"all":c.k)} aria-pressed={on}
                      style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:K.rPill,
                        cursor:"pointer",fontSize:12,fontWeight:600,lineHeight:1.4,whiteSpace:"nowrap",fontFamily:K.fontBody,
                        background:on?c.t.fg:c.t.bg, color:on?"#fff":c.t.fg,
                        border:`1px solid ${on?"transparent":c.t.border}`}}>
                      <Icon name={c.ic} size={12} strokeWidth={2}/>{c.n} {c.l}
                    </button>
                  );
                })}
              </div>
              {/* Search */}
              <div className="ash-search" style={{display:"flex",alignItems:"center",gap:9,marginTop:12,padding:"9px 13px",borderRadius:K.rMd,background:K.surface,border:`1px solid ${K.modalLine}`}}>
                <Icon name="search" size={15} color={K.textFaint}/>
                <input value={dishMapSearch} onChange={e=>setDishMapSearch(e.target.value)} placeholder={T2("Search dishes...")}
                  style={{flex:1,minWidth:0,border:"none",outline:"none",background:"transparent",fontSize:13,color:K.text,fontFamily:K.fontBody}}/>
                {dishMapSearch&&(
                  <button onClick={()=>setDishMapSearch("")} aria-label={T2("Clear")}
                    style={{border:"none",background:"transparent",color:K.textFaint,cursor:"pointer",display:"flex",padding:0}}>
                    <Icon name="close" size={14} strokeWidth={2.2}/>
                  </button>
                )}
              </div>
            </div>
            {/* Body — overscrollBehavior stops the scroll chaining that clipped the header */}
            <div className="kh-mapbody" style={{overflowY:"auto",overscrollBehavior:"contain",flex:1,padding:"10px 14px"}}>
              {dishMapDrop&&<div style={{position:"fixed",inset:0,zIndex:15}} onClick={()=>setDishMapDrop(null)}/>}
              {filteredRows.map((row,ri)=>{
                const sel = dishMapSel[row.lms];
                const isUnlinked = row.status==="unlinked"&&!sel;
                // One tone per row state drives the rail, the marker and the
                // sub-line, so the three never drift apart.
                const rt = sel ? tone("warn")
                         : row.status==="unlinked" ? tone("danger")
                         : row.status==="mapped"   ? tone("brand")
                         : tone("ok");
                const noneSop = !sel && row.status==="mapped" && isNoneSop(row.sopName);
                return(
                // A grid, not a flex row: the SOP controls have to sit in a true
                // column. As flex they took their width from each dish name, so
                // no two lined up and the list looked ragged.
                <div key={ri} className="kh-maprow" style={{position:"relative",padding:"11px 13px 11px 15px",
                  background:isUnlinked?"rgba(217,70,63,.05)":"transparent",
                  borderBottom:`1px solid ${K.lineSoft}`,borderRadius:K.rSm,marginBottom:1}}>
                  {/* Left rail — replaces the full red fill that used to swallow
                      whole rows and made the list unreadable. */}
                  <span style={{position:"absolute",left:0,top:7,bottom:7,width:3,borderRadius:"0 3px 3px 0",
                    background:isUnlinked||sel?rt.fg:"transparent"}}/>
                  {/* Status marker */}
                  <span style={{width:24,height:24,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                    background:rt.bg,color:rt.fg,border:`1px solid ${rt.border}`}}>
                    <Icon name={sel?"undo":row.status==="unlinked"?"alert":row.status==="mapped"?"link":"check"} size={13} strokeWidth={2}/>
                  </span>
                  {/* LMS name */}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:600,color:K.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.lms}</div>
                    {/* The arrow is an icon, not a glyph — the "→" that used to sit
                        here had been mangled into a literal "?" in the source. */}
                    {sel
                      ? <div style={{display:"flex",alignItems:"center",gap:3,fontSize:11,color:K.warn,marginTop:2,minWidth:0}}><Icon name="chevronR" size={11} strokeWidth={2.4}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sel.split("/")[0].trim()} · {T2("unsaved")}</span></div>
                      : noneSop
                        ? <div style={{fontSize:11,color:K.textFaint,marginTop:2,fontStyle:"italic"}}>{T2("marked as having no SOP")}</div>
                        : row.status==="unlinked"
                          ? <div style={{fontSize:11,color:K.danger,marginTop:2}}>{T2("no SOP recipe linked")}</div>
                          : <div style={{display:"flex",alignItems:"center",gap:3,fontSize:11,color:row.status==="auto"?K.ok:K.brandText,marginTop:2,minWidth:0}}>
                              <span>{row.status==="auto"?T2("auto"):T2("mapped")}</span>
                              <Icon name="chevronR" size={11} strokeWidth={2.4}/>
                              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.sopName}</span>
                              {row.cat&&<span style={{color:K.textFaint,flexShrink:0}}>· {row.cat}</span>}
                            </div>}
                  </div>
                  {/* Dropdown / status */}
                  {(()=>{
                    const isOpen = dishMapDrop===row.lms;
                    const display = sel || (row.status!=="unlinked"?row.sopName:null);
                    const q = dishMapDropQ.toLowerCase();
                    const filtered = isOpen ? allRecipes.filter(r=>!q||r.n.toLowerCase().includes(q)||r.cat.toLowerCase().includes(q)) : [];
                    const grouped = {};
                    filtered.forEach(r=>{if(!grouped[r.cat])grouped[r.cat]=[];grouped[r.cat].push(r);});
                    return(
                    <>
                      <div style={{position:"relative",minWidth:0}}>
                        {/* Chevron inside makes it read as a dropdown. Without it
                            a filled control looks like a static label and nobody
                            realises a mapping can be changed. */}
                        <button onClick={()=>{if(isOpen){setDishMapDrop(null);}else{setDishMapDrop(row.lms);setDishMapDropQ("");}}} onPointerDown={ripple} className="kh-rip kh-mapsel"
                          title={display||T2("Select SOP...")}
                          style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px 8px 12px",borderRadius:K.rSm,
                            border:isUnlinked&&!display?`1px dashed ${K.danger}`:`1px solid ${display?K.brandBorder:K.line}`,
                            fontSize:12,fontWeight:display?600:400,color:display?K.text:K.textFaint,
                            background:display?K.brandBg:K.surface,cursor:"pointer",textAlign:"left",minHeight:34,fontFamily:K.fontBody}}>
                          <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{display||T2("Select SOP...")}</span>
                          <Icon name="chevronD" size={13} strokeWidth={2} style={{flexShrink:0,opacity:.55,transform:isOpen?"rotate(180deg)":"none",transition:"transform .16s"}}/>
                        </button>
                      {isOpen&&(
                        <div style={{position:"absolute",top:"100%",right:0,zIndex:20,width:280,maxHeight:260,background:K.surface,border:`1px solid ${K.brandBorder}`,borderRadius:K.rMd,boxShadow:K.shadowLift,marginTop:4,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                          <div style={{padding:"8px",borderBottom:`1px solid ${K.lineSoft}`,flexShrink:0}}>
                            <input autoFocus value={dishMapDropQ} onChange={e=>setDishMapDropQ(e.target.value)} placeholder={T2("Type to search recipes...")} style={{width:"100%",padding:"7px 10px",borderRadius:K.rSm,border:`1px solid ${K.line}`,fontSize:12,color:K.text,background:K.surfaceAlt,boxSizing:"border-box",fontFamily:K.fontBody}}/>
                          </div>
                          <div style={{overflowY:"auto",overscrollBehavior:"contain",flex:1}}>
                            {Object.keys(grouped).length===0&&<div style={{padding:16,textAlign:"center",fontSize:11.5,color:K.textFaint}}>{T2("No recipes match")}</div>}
                            {Object.entries(grouped).map(([catName,recs])=>(
                              <div key={catName}>
                                <div style={{...type.label,fontSize:10,padding:"7px 11px 4px",color:K.brandText,background:K.brandBg,position:"sticky",top:0}}>{catName}</div>
                                {recs.map((r,i)=>(
                                  <div key={i} onMouseDown={e=>{e.preventDefault();setDishMapSel(p=>({...p,[row.lms]:r.n}));setDishMapDrop(null);}} style={{padding:"7px 12px",fontSize:12.5,color:K.text,cursor:"pointer",borderBottom:`1px solid ${K.lineSoft}`,background:(display===r.n)?K.brandBg:"transparent"}} onMouseEnter={e=>e.currentTarget.style.background=K.brandSoft} onMouseLeave={e=>e.currentTarget.style.background=(display===r.n)?K.brandBg:"transparent"}>
                                    {(()=>{if(!q)return r.n;const idx=r.n.toLowerCase().indexOf(q);if(idx<0)return r.n;return <>{r.n.slice(0,idx)}<b style={{color:K.brand}}>{r.n.slice(idx,idx+q.length)}</b>{r.n.slice(idx+q.length)}</>;})()}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>
                      {/* The action slot is ALWAYS rendered, empty when there is
                          nothing to do. Rendering it conditionally shifted the
                          SOP column by 30px between rows, which is what made the
                          whole list look misaligned. */}
                      <span style={{display:"flex",justifyContent:"center"}}>
                        {sel
                          ? <button onClick={()=>setDishMapSel(p=>({...p,[row.lms]:null}))} className="kh-maprow-del" title={T2("Undo")} aria-label={T2("Undo")} style={{width:30,height:30,borderRadius:K.rSm,background:"transparent",border:`1px solid ${K.line}`,color:K.textFaint,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}><Icon name="undo" size={14} strokeWidth={2}/></button>
                          : row.status==="mapped"
                            ? <button onClick={()=>askRemoveMapping(row.lms)} className="kh-maprow-del" title={T2("Remove mapping")} aria-label={T2("Remove mapping")} style={{width:30,height:30,borderRadius:K.rSm,background:"transparent",border:`1px solid ${K.line}`,color:K.textFaint,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}><Icon name="trash" size={14} strokeWidth={1.9}/></button>
                            : null}
                      </span>
                    </>
                    );
                  })()}
                </div>
              );})}
              {filteredRows.length===0&&(
                <div style={{textAlign:"center",padding:"44px 20px"}}>
                  <span style={{width:52,height:52,borderRadius:16,margin:"0 auto 12px",background:K.brandBg,color:K.brand,border:`1px solid ${K.brandBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon name="search" size={24} strokeWidth={1.7}/>
                  </span>
                  <div style={{fontSize:14,fontWeight:600,color:K.text}}>{T2("Nothing here")}</div>
                  <div style={{fontSize:12.5,color:K.textMuted,marginTop:3}}>
                    {dishMapFilter!=="all"&&dq ? T2("No dish matches this search in this filter.")
                      : dishMapFilter!=="all" ? T2("No dish has this status.")
                      : T2("No dishes match search")}
                  </div>
                  {(dishMapFilter!=="all"||dq)&&(
                    <div style={{marginTop:14,display:"flex",justifyContent:"center"}}>
                      <KButton variant="ghost" icon="undo" onClick={()=>{setDishMapFilter("all");setDishMapSearch("");}}>{T2("Clear filters")}</KButton>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Result count — with a filter on, you need to know how much of the
                163 you are actually looking at. */}
            {filteredRows.length>0&&(dishMapFilter!=="all"||dq)&&(
              <div style={{flexShrink:0,padding:"8px 24px",borderTop:`1px solid ${K.lineSoft}`,...type.label,fontSize:10.5,color:K.textFaint}}>
                {T2("Showing")} {filteredRows.length} {T2("of")} {rows.length}
              </div>
            )}
            {/* Footer */}
            {pendingCount>0&&(
              <div style={{padding:"14px 20px",borderTop:`1px solid ${K.modalLine}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexShrink:0,flexWrap:"wrap"}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:12.5,color:K.warn,fontWeight:600}}>
                  <Icon name="alert" size={14} strokeWidth={2}/>
                  {pendingCount} {pendingCount===1?T2("unsaved mapping"):T2("unsaved mappings")}
                </span>
                <KButton variant="brand" icon="check" disabled={dishMapSaving} onClick={saveMappings}
                  style={{padding:"11px 22px",borderRadius:14}}>
                  {dishMapSaving?T2("Saving..."):T2("Save Mappings")}
                </KButton>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* --- MENU TAB --- */}
      

      {/* --- Ingredient Usage Modal --- */}
      {yieldModal && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:K.modalScrim,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>{setYieldModal(null);yieldModal.onConfirm();}}>
          <div className="kh-modal-card kh-cardart" style={{backgroundColor:K.surface,border:`1px solid ${K.modalLine}`,borderRadius:K.modalRadius,width:"100%",maxWidth:430,boxShadow:K.shadowLift,overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{position:"relative",padding:"22px 24px 16px",borderBottom:`1px solid ${K.modalLine}`}}>
              <div style={{display:"flex",gap:13,alignItems:"center"}}>
                <span style={{width:44,height:44,borderRadius:14,flexShrink:0,background:K.brandBg,color:K.brand,border:`1px solid ${K.brandBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon name="box" size={21} strokeWidth={1.85}/>
                </span>
                <div style={{minWidth:0}}>
                  <div style={{...type.sectionHead,fontSize:20,color:K.hdrTitle}}>{T2("Yield / Weight")}</div>
                  <div style={{fontSize:12.5,color:K.hdrMeta,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{yieldModal.dish.name} · {yieldModal.pax} pax</div>
                </div>
              </div>
            </div>
            <div style={{padding:"20px 24px 4px"}}>
              <div style={{fontSize:15,fontWeight:700,color:K.hdrTitle}}>{T2("How much quantity was made?")}</div>
              <div style={{fontSize:13.5,color:K.hdrMeta,marginTop:2,marginBottom:16}}>कितनी मात्रा बनी?</div>
              <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                <div style={{flex:2,minWidth:0}}>
                  <div style={{...type.label,fontSize:10,color:K.textMuted,marginBottom:6}}>Quantity / मात्रा</div>
                  {/* Big, centred, tabular — this is punched in on a tablet with
                      wet hands, so the target is deliberately oversized. */}
                  <input type="number" step="any" inputMode="decimal" autoFocus
                    value={yieldQty}
                    onChange={e=>setYieldQty(e.target.value)}
                    placeholder="0"
                    className="kh-yieldinput"
                    style={{width:"100%",padding:"14px 16px",borderRadius:K.rMd,border:`1.5px solid ${yieldQty?K.brandBorder:K.line}`,fontSize:24,fontWeight:700,textAlign:"center",color:K.text,background:yieldQty?K.brandBg:K.surfaceAlt,boxSizing:"border-box",fontFamily:K.fontBody,fontVariantNumeric:"tabular-nums",outline:"none"}} />
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{...type.label,fontSize:10,color:K.textMuted,marginBottom:6}}>Unit / इकाई</div>
                  <select value={yieldUnit} onChange={e=>setYieldUnit(e.target.value)}
                    style={{width:"100%",padding:"16px 8px",borderRadius:K.rMd,border:`1.5px solid ${K.line}`,fontSize:15,fontWeight:600,color:K.text,background:K.surfaceAlt,cursor:"pointer",boxSizing:"border-box",fontFamily:K.fontBody}}>
                    <option value="kg">kg</option>
                    <option value="L">L (litre)</option>
                    <option value="gm">gm</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs / पीस</option>
                    <option value="plates">plates</option>
                    <option value="bowls">bowls</option>
                    <option value="trays">trays</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{padding:"18px 24px 22px",display:"flex",gap:10}}>
              <KButton variant="ghost" onClick={()=>{setYieldQty("");proceedToIngredientUsage();}} style={{flex:1,justifyContent:"center",padding:"12px",borderRadius:14}}>{T2("Skip")}</KButton>
              <KButton variant="brand" icon="chevronR" disabled={!yieldQty} onClick={yieldQty?proceedToIngredientUsage:undefined}
                style={{flex:2,justifyContent:"center",padding:"12px",borderRadius:14,flexDirection:"row-reverse"}}>{T2("Next")}</KButton>
            </div>
          </div>
        </div>
      )}

      {/* V74 — Planning tab: scaled-ingredient preview modal (read-only). Reuses usageModal styling. */}
      {planIngrModal && (function(){
        const ingr = getIngrForYield(planIngrModal.dish, planIngrModal.effKg, planIngrModal.sectionFactors);
        const roundQ = (q) => {
          if (q == null) return "";
          if (q >= 10) return Math.round(q * 10) / 10;
          if (q >= 1)  return Math.round(q * 100) / 100;
          return Math.round(q * 1000) / 1000;
        };
        return (
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setPlanIngrModal(null)}>
            <div style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:520,maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 8px 32px rgba(0,0,0,.2)"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"16px 20px",borderBottom:"1px solid "+C.border}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>📋 {T2("Ingredients")}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{color:C.text,fontWeight:600}}>{planIngrModal.dish}</span>
                  <span>·</span>
                  {planIngrModal.sectionFactors ? (
                    <span>{Object.keys(planIngrModal.sectionFactors).length} {T2("sections")} · <span style={{color:C.text,fontWeight:600}}>{planIngrModal.effKg} kg {T2("total")}</span></span>
                  ) : (
                    <span>{T2("scaled for")} <span style={{color:C.text,fontWeight:600}}>{planIngrModal.effKg} kg</span></span>
                  )}
                  {planIngrModal.isOverride && <span style={{color:C.purple,fontWeight:600}}>({T2("pinned")})</span>}
                  {!planIngrModal.isOverride && planIngrModal.mult !== 1 && <span>({planIngrModal.yieldAdjustPct}%)</span>}
                  <span>·</span>
                  <span>{planIngrModal.pax} pax</span>
                </div>
              </div>
              <div style={{flex:1,minHeight:0,overflowY:"auto",padding:"0 20px"}}>
                <div style={{display:"flex",padding:"10px 0 6px",borderBottom:"2px solid "+C.border,fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5}}>
                  <div style={{flex:2}}>{T2("Ingredient")}</div>
                  <div style={{flex:1,textAlign:"right"}}>{T2("Quantity")}</div>
                </div>
                {(!ingr || ingr.length === 0) ? (
                  <div style={{padding:"20px 0",fontSize:12,color:C.muted,fontStyle:"italic",textAlign:"center"}}>
                    {T2("No ingredient list on recipe")}
                  </div>
                ) : (
                  ingr.map((ing, i) => {
                    if (ing._isSection) {
                      return (
                        <div key={i} style={{padding:"12px 0 4px",fontSize:10,fontWeight:700,color:C.text,textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid "+C.border,marginTop:i>0?4:0}}>
                          {ing.n}
                        </div>
                      );
                    }
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+C.borderLight,fontSize:12}}>
                        <div style={{flex:2}}>
                          <div style={{color:C.text,fontWeight:500,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            <span>{ing.n}</span>
                            {ing._type === "inv" && <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"#E1F5EE",color:"#0F6E56",fontWeight:700,letterSpacing:0.3}}>INV</span>}
                          </div>
                          {ing.h && <div style={{fontSize:10,color:C.muted,marginTop:1}}>{ing.h}</div>}
                        </div>
                        <div style={{flex:1,textAlign:"right",color:C.text,fontSize:12,fontWeight:600}}>
                          {roundQ(ing.q)} <span style={{color:C.muted,fontWeight:400}}>{ing.u || ""}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{padding:"12px 20px",borderTop:"1px solid "+C.border}}>
                <button onClick={()=>setPlanIngrModal(null)} style={{width:"100%",padding:"12px",borderRadius:10,background:C.wine,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>{T2("Close")}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {usageModal && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:K.modalScrim,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>{usageModal.onConfirm();setUsageModal(null);}}>
          <div className="kh-modal-card kh-cardart" style={{backgroundColor:K.surface,border:`1px solid ${K.modalLine}`,borderRadius:K.modalRadius,width:"100%",maxWidth:560,maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:K.shadowLift}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"22px 24px 16px",borderBottom:`1px solid ${K.modalLine}`,flexShrink:0}}>
              <div style={{display:"flex",gap:13,alignItems:"center"}}>
                <span style={{width:44,height:44,borderRadius:14,flexShrink:0,background:K.brandBg,color:K.brand,border:`1px solid ${K.brandBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon name="chart" size={21} strokeWidth={1.85}/>
                </span>
                <div style={{minWidth:0}}>
                  <div style={{...type.sectionHead,fontSize:20,color:K.hdrTitle}}>{T2("Ingredient Usage")}</div>
                  <div style={{fontSize:12.5,color:K.hdrMeta,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {usageModal.dishName} · {usageModal.pax} pax · {usageModal.isPrepDay?T2("Prep Day"):T2("Event Day")}
                  </div>
                </div>
              </div>
            </div>
            {/* A grid, so the two number columns line up regardless of how long
                an ingredient name runs. */}
            <div style={{flex:1,minHeight:0,overflowY:"auto",overscrollBehavior:"contain",padding:"0 24px"}}>
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 92px 96px",gap:12,alignItems:"center",
                padding:"12px 0 8px",borderBottom:`1px solid ${K.lineStrong}`,position:"sticky",top:0,background:K.surface,zIndex:1}}>
                <div style={{...type.label,fontSize:10,color:K.textMuted}}>{T2("Ingredient")}</div>
                <div style={{...type.label,fontSize:10,color:K.textMuted,textAlign:"right"}}>{T2("Scaled")}</div>
                <div style={{...type.label,fontSize:10,color:K.textMuted,textAlign:"right"}}>{T2("Actual")}</div>
              </div>
              {usageModal.ingredients.map((ing,i) => {
                const scaled = Math.round(ing.q*100)/100;
                const edited = (usageActuals[ing.n]||"") !== "";
                return (
                <div key={i} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 92px 96px",gap:12,alignItems:"center",
                  padding:"10px 0",borderBottom:`1px solid ${K.lineSoft}`}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:600,color:K.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ing.n}</div>
                    {ing.h && <div style={{fontSize:11.5,color:K.textMuted,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ing.h}</div>}
                  </div>
                  <div style={{textAlign:"right",color:K.hdrMeta,fontSize:12.5,fontVariantNumeric:"tabular-nums"}}>{scaled} {ing.u}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
                    {/* Tints when a value is entered, so an overridden row is
                        obvious without reading the numbers. */}
                    <input type="number" step="any" inputMode="decimal"
                      placeholder={String(scaled)}
                      value={usageActuals[ing.n]||""}
                      onChange={e=>{const v=e.target.value;setUsageActuals(p=>({...p,[ing.n]:v}));}}
                      className="kh-yieldinput"
                      style={{width:62,padding:"7px 8px",borderRadius:K.rSm,border:`1.5px solid ${edited?K.brandBorder:K.line}`,fontSize:13,fontWeight:edited?700:400,textAlign:"right",background:edited?K.brandBg:K.surfaceAlt,color:K.text,boxSizing:"border-box",fontFamily:K.fontBody,fontVariantNumeric:"tabular-nums",outline:"none"}} />
                    <span style={{fontSize:11,color:K.textFaint,width:26,flexShrink:0}}>{ing.u}</span>
                  </div>
                </div>
                );
              })}
              <div style={{display:"flex",alignItems:"center",gap:7,padding:"12px 0 4px",fontSize:12,color:K.textMuted}}>
                <Icon name="note" size={13} strokeWidth={1.9}/>{T2("Leave blank if the scaled quantity was correct")}
              </div>
            </div>
            <div style={{padding:"16px 24px 20px",borderTop:`1px solid ${K.modalLine}`,display:"flex",gap:10,justifyContent:"flex-end",flexShrink:0}}>
              <KButton variant="ghost" onClick={()=>{usageModal.onConfirm();setUsageModal(null);}} style={{padding:"11px 22px",borderRadius:14}}>{T2("Skip")}</KButton>
              <KButton variant="brand" icon="check" onClick={saveUsageAndDone} style={{padding:"11px 22px",borderRadius:14}}>{T2("Save & Done")}</KButton>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

export { KitchenHub };
