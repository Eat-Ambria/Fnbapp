// Ambria FnB â€” Kitchen Hub (Overview, Prep Tracking, Prep Plan, Recipe SOPs)
import React, { useState, useRef, useEffect } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, TODAY_LABEL, safeArr, safeNum, safePct, localDateStr, fmtStamp, recipeNameOf } from '../utils/helpers.js';
import { MENU_PACKAGES, MENU_PACKAGE_NAMES } from '../data/menuPackages.js';
import { getSectionForDish, getCatIdForDish, getCatForDish, GENERIC_STEPS, RECIPE_INGREDIENTS, RECIPE_DB, DISH_NAME_MAP, findRecipeForDish, getStepsForDish, fmtT, BEV_RE, getFullSteps, getDishImageUrl, getIngrForDish, getIngrForYield, interpolatePax, hasIngredients } from '../data/recipeData.js';
import { Avatar, Card, Btn, Chip, STag, SelfieCapture, SectionHeader } from './SharedUI.jsx';
import { EventDayTab } from './EventDayTab.jsx';
import { hasPermission } from '../data/permissions.js';
import { logActivity } from './ActivityLog.jsx';


function KitchenHub({ events, kitchenTracking, setKitchenTracking, lang="en", odcOnly=false, currentUser=null, transportQueue=[], setTransportQueue }) {
  const T2 = s => T(s, lang);

  // Safe menu array â€” handles JSONB array or stringified JSON from Supabase
  function menuArr(ev) {
    const m = ev.menu;
    if (Array.isArray(m)) return m;
    if (typeof m === 'string' && m) { try { return JSON.parse(m); } catch(e) { return []; } }
    return [];
  }

  // â”€â”€ Date+time stamp helper â”€â”€
  function fmtStamp(ts) {
    var d = ts ? new Date(ts) : new Date();
    return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}) + ' ' +
           d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
  }

  // â”€â”€ Strip hardcoded quantities from SOP step text â”€â”€
  // SOPs have "à¤ªà¤¨à¥€à¤° (15 kg / 200 PAX)" baked in â€” we show scaled ingredients separately
  function cleanStepText(text) {
    if (!text) return "";
    return text.trim();
  }

  // Section tablet filtering â€” always uses sop_categories (set in Access Manager)
  const isSectionUser = currentUser?.role?.startsWith('section_');
  const userCats = currentUser?.sop_categories;
  const hasCats = Array.isArray(userCats) && userCats.length > 0;
  const allowedCatIds = isSectionUser ? (hasCats ? userCats : null) : null;
  const sectionFilter = isSectionUser ? (hasCats ? userCats[0] : null) : null;
  const sectionDisplayName = isSectionUser && hasCats
    ? [...new Set(userCats.map(c => { const cat = RECIPE_DB.cats.find(cc=>cc.id===c); return cat ? cat.name : c; }).filter(Boolean))].join(' + ')
    : null;

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
  const [sopRecipe, setSopRecipe] = useState(null);
  const [sopSearch, setSopSearch] = useState("");
  const [editingSteps, setEditingSteps] = useState(false);

  // â”€â”€ Ingredient Matrix Editor â”€â”€
  // New schema: {base_pax:300, base_yield:{kg,pcs}, items:[{name, hi, unit, qty:number, qty_nv?:number}]}
  // Reads legacy field names (hindi, nv_qty, qty[]) for backward-compat.
  function openIngEditor(recipe, catId) {
    const ex = recipe.ingredients;
    if (ex && Array.isArray(ex.items) && ex.items.length > 0) {
      const items = ex.items.map(it => {
        if (it.isSection) {
          return { isSection: true, name: it.name || "", hi: it.hi ?? "" };
        }
        // qty: scalar (new) or array (legacy â€” pick 500-pax value if present, else 0)
        let qty = 0;
        if (typeof it.qty === 'number') qty = it.qty;
        else if (Array.isArray(it.qty)) {
          const sizes = ex.pax_sizes || [200,500,1000];
          const i500 = sizes.indexOf(500);
          qty = i500 >= 0 ? (it.qty[i500] || 0) : (it.qty[0] || 0);
        }
        return { name: it.name || "", hi: it.hi ?? it.hindi ?? "", unit: it.unit || "kg", qty, notes: it.notes || "" };
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
  }
  function ingAddItem() {
    setIngForm(f=>({...f,items:[...f.items,{name:"",hi:"",unit:"kg",qty:0,notes:""}]}));
    setIngDirty(true);
  }
  function ingAddSection() {
    setIngForm(f=>({...f,items:[...f.items,{isSection:true,name:"",hi:""}]}));
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
  // â”€â”€ Bridge: resolve ingredients for any dish (new JSONB â†’ old format fallback) â”€â”€
  
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
        return row;
      }
      const row = {
        name: it.name.trim(),
        hi: (it.hi||"").trim(),
        unit: it.unit || "kg",
        qty: typeof it.qty === 'number' ? it.qty : parseFloat(it.qty) || 0,
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
      const mod = await import('../lib/supabase.js');
      if(mod.supabase){
        const {error}=await mod.supabase.from('recipes').update({ingredients:payload}).eq('dish_name',ingModal.recipeName).eq('category_id',ingModal.catId);
        if(error) console.error('Ingredient save error:',error);
        else console.log('âœ… Ingredients saved for',ingModal.recipeName,'â€”',items.length,'items');
      }
    }catch(e){console.error('Ingredient save failed:',e);}
    setIngDirty(false);
    if(sopRecipe&&sopRecipe.n===ingModal.recipeName) setSopRecipe(p=>({...p,ingredients:payload}));
    setIngModal(null);
  }

  // â”€â”€ CSV Import/Export for Ingredients â”€â”€
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
      const mod=await import('../lib/supabase.js');
      if(mod.supabase){
        const {error}=await mod.supabase.from('recipes').update({ingredients:payload}).eq('dish_name',recipe.n).eq('category_id',catId);
        if(error){ console.error('CSV import save error:',error); alert('Save failed: '+error.message); return; }
        console.log('âœ… CSV imported for',recipe.n,'â€”',parsedItems.length,'items');
      }
    }catch(e){ console.error('CSV import save failed:',e); alert('Save failed: '+e.message); return; }
    if(sopRecipe&&sopRecipe.n===recipe.n) setSopRecipe(p=>({...p,ingredients:payload}));
    setCsvImport(null);
  }

  // scaleEventId — REMOVED in Phase 4
  const [yieldAdjustPct, setYieldAdjustPct] = useState(100); // global multiplier applied to planned yields (100 = exactly as planned)
  const [closeEventId, setCloseEventId] = useState(null); // eventId whose closing is being edited
  const [closeRows, setCloseRows] = useState({}); // {dishName: production_closings row} for closeEventId
  const [closeSaving, setCloseSaving] = useState(new Set()); // dish names currently saving
  const [closeCalYr, setCloseCalYr] = useState(()=>new Date().getFullYear()); // Closing calendar cursor year
  const [closeCalMo, setCloseCalMo] = useState(()=>new Date().getMonth()); // Closing calendar cursor month (0-based)
  const [closeSelDate, setCloseSelDate] = useState(null); // selected date on the calendar ("YYYY-MM-DD")
  const [closeSectionOpen, setCloseSectionOpen] = useState({}); // {catId: bool} â€” collapsible section state, default collapsed
  const [closeExcludeUI, setCloseExcludeUI] = useState(false); // event-level "don't affect ordering" toggle (derived from any row on load)
  const [ingModal, setIngModal] = useState(null);
  const [ingForm, setIngForm] = useState({base_pax:300, base_yield:{kg:null, pcs:null}, items:[]});
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
  // appliedScales — REMOVED in Phase 4 (superseded by events.yield_multiplier)
  // scalePlanRows — REMOVED in Phase 4 (superseded by evPlanRows for all events)
  const [evPlanRows, setEvPlanRows] = useState({}); // {[evId]: {[dishName]: production_plans row}} â€” loaded for all events currently in evList, drives yield-based ingredient scaling
  const [d1View, setD1View] = useState("all"); // "all" | "cont" | "new"
  const [d1FnFilter, setD1FnFilter] = useState("combined"); // "combined" | eventId
  const [tick, setTick] = useState(0);
  const [dishSignoff, setDishSignoff] = useState(null); // {evId,idx,mode:"completed"|"ready_for_transport",chefName,selfie}

  // â”€â”€ Dish Name Mapping â”€â”€
  const [showDishMap, setShowDishMap] = useState(false);
  const [dishMapSel, setDishMapSel] = useState({}); // {lmsName: recipeDishName}
  const [dishMapSaving, setDishMapSaving] = useState(false);
  const [dishMapSearch, setDishMapSearch] = useState("");
  const [dishMapDrop, setDishMapDrop] = useState(null); // lms_name of open dropdown row
  const [dishMapDropQ, setDishMapDropQ] = useState("");

  // â”€â”€ Yield editing â”€â”€
  const YIELD_UNITS = ["kg","gm","ltr","ml","piece","chafing dish"];
  const [editingYield, setEditingYield] = useState(false);
  const [yieldForm, setYieldForm] = useState({kg:"", pcs:""});

  // â”€â”€ Yield Capture + Ingredient Usage Modal â”€â”€
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
    if (ingr && ingr.length > 0) {
      setUsageModal({evId:ym.dish.fEvId, idx:ym.dish.fIdx, dishName:ym.dish.name, pax:ym.pax, isPrepDay:ym.isPrepDay, ingredients:ingr, onConfirm:ym.onConfirm, yieldQty:parseFloat(yieldQty)||null, yieldUnit:yieldUnit});
      setUsageActuals({});
    } else { ym.onConfirm(); }
  }
  async function saveUsageAndDone() {
    if (!usageModal) return;
    const rows = usageModal.ingredients.map(ing => {
      const actual = usageActuals[ing.n];
      return { name: ing.n, hindi: ing.h||"", scaled_qty: Math.round(ing.q*100)/100, unit: ing.u, actual_qty: actual !== undefined && actual !== "" ? parseFloat(actual) : null };
    });
    try {
      const mod = await import('../lib/supabase.js');
      await mod.supabase.from('ingredient_usage_log').insert({ event_id: usageModal.evId, dish_name: usageModal.dishName, pax: usageModal.pax, ingredients: rows, is_prep_day: usageModal.isPrepDay, recorded_by: currentUser?.name||"Unknown", yield_qty: usageModal.yieldQty||null, yield_unit: usageModal.yieldQty?usageModal.yieldUnit:null });
    } catch(e) { console.error('Usage log save error:', e); }
    usageModal.onConfirm();
    setUsageModal(null);
  }

  // â”€â”€ Analytics â”€â”€
  const [analyticsEvId, setAnalyticsEvId] = useState(null);
  const [analyticsDate, setAnalyticsDate] = useState(null);
  const [calMo, setCalMo] = useState(()=>new Date().getMonth());
  const [calYr, setCalYr] = useState(()=>new Date().getFullYear());
  const ANA_VP={"Ambria Pushpanjali":{code:"AP",c:"#D85A30"},"Ambria Exotica":{code:"AE",c:"#BA7517"},"Manaktala Farm":{code:"MKT",c:"#8B5E2F"},"Ambria Restro":{code:"AR",c:"#1D9E75"},"Outdoor Catering (ODC)":{code:"ODC",c:"#7F77DD"},"Ambria Manaktala":{code:"AM",c:"#BA7517"}};
  const anaGp=v=>ANA_VP[v]||{code:"EV",c:"#8B5E2F"};
  const [usageLogs, setUsageLogs] = useState([]);
  const [analyticsExp, setAnalyticsExp] = useState(new Set());
  function toggleAnalyticsDish(n){setAnalyticsExp(p=>{const s=new Set(p);s.has(n)?s.delete(n):s.add(n);return s;});}
  function fetchUsageLogs(evIds){import('../lib/supabase.js').then(mod=>{mod.supabase.from('ingredient_usage_log').select('*').in('event_id',evIds).then(({data})=>{setUsageLogs(data||[]);});}).catch(()=>setUsageLogs([]));}
  useEffect(()=>{
    if(tab!=="analytics"||!analyticsEvId) return;
    const aEvs=safeArr(events);
    const evIds=analyticsEvId==="__combined"?aEvs.map(e=>e.id):[analyticsEvId];
    if(evIds.length===0) return;
    fetchUsageLogs(evIds);
    // Live subscribe: refetch on any insert/update/delete for these event_ids
    let channel=null, mounted=true;
    import('../lib/supabase.js').then(mod=>{
      if(!mounted||!mod.supabase) return;
      channel=mod.supabase
        .channel('ing_usage_'+analyticsEvId)
        .on('postgres_changes',{event:'*',schema:'public',table:'ingredient_usage_log'},(payload)=>{
          const evId=payload.new?.event_id||payload.old?.event_id;
          if(evIds.includes(evId)) fetchUsageLogs(evIds);
        })
        .subscribe();
    });
    return ()=>{
      mounted=false;
      if(channel) import('../lib/supabase.js').then(mod=>{ if(mod.supabase) mod.supabase.removeChannel(channel); });
    };
  },[tab,analyticsEvId]);

  // â”€â”€ Planning (Phase 4) â”€â”€
  const [planEvId, setPlanEvId] = useState(null);
  const [planSelDate, setPlanSelDate] = useState(null);
  const [planCalMo, setPlanCalMo] = useState(()=>new Date().getMonth());
  const [planCalYr, setPlanCalYr] = useState(()=>new Date().getFullYear());
  const [planRows, setPlanRows] = useState({});          // {dishName: row}
  const [planDrafts, setPlanDrafts] = useState({});      // {dishName: string being edited}
  const [planSaving, setPlanSaving] = useState(new Set());// dishNames currently saving
  const [planLoading, setPlanLoading] = useState(false);

  // Load production_plans whenever the selected event changes
  useEffect(()=>{
    if(!planEvId){ setPlanRows({}); setPlanDrafts({}); return; }
    let cancelled = false;
    setPlanLoading(true);
    import('../lib/supabase.js').then(mod=>{
      return mod.supabase.from('production_plans').select('*').eq('event_id', planEvId);
    }).then(({data,error})=>{
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

  // â”€â”€ Sync yieldAdjustPct UI from event.yield_multiplier when a Planning event is selected (Phase 3) â”€â”€
  useEffect(()=>{
    if(!planEvId) return;
    const ev = evList.find(e=>e.id===planEvId);
    if(!ev) return;
    const pct = Math.round((Number(ev.yield_multiplier)||1.0) * 100);
    setYieldAdjustPct(pct);
    // Deliberately NOT depending on evList â€” realtime updates from other tabs shouldn't clobber a slider mid-drag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[planEvId]);

  // â”€â”€ Debounced save of yield_multiplier to events table when slider changes (Phase 3) â”€â”€
  useEffect(()=>{
    if(!planEvId) return;
    const ev = evList.find(e=>e.id===planEvId);
    if(!ev) return;
    const curMult = Number(ev.yield_multiplier)||1.0;
    const uiMult = yieldAdjustPct/100;
    if(Math.abs(curMult - uiMult) < 0.001) return; // no change vs DB â€” skip save
    const t = setTimeout(()=>{
      import('../lib/supabase.js').then(mod=>{
        mod.supabase.from('events').update({yield_multiplier: uiMult}).eq('id', planEvId).then(({error})=>{
          if(error) console.error('[yield_multiplier save]', error);
        });
      });
    }, 500);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[yieldAdjustPct, planEvId]);

  // scaleEventId useEffect — REMOVED in Phase 4

  // â”€â”€ Load production_plans for ALL events in evList (Path B: drives yield-based ingredient scaling on Event Day + Prep Day tabs) â”€â”€
  const evListIds = useMemo(()=>Array.from(new Set((evList||[]).map(e=>e.id))).sort().join(","),[evList]);
  useEffect(()=>{
    const ids = evListIds ? evListIds.split(",").filter(Boolean) : [];
    if(!ids.length){ setEvPlanRows({}); return; }
    let cancelled=false;
    import('../lib/supabase.js').then(mod=>{
      return mod.supabase.from('production_plans').select('*').in('event_id', ids);
    }).then(({data,error})=>{
      if(cancelled) return;
      if(error){ console.error('[evPlanRows load]', error); return; }
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
    import('../lib/supabase.js').then(mod=>{
      return mod.supabase.from('production_closings').select('*').eq('event_id', closeEventId);
    }).then(({data,error})=>{
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
      const mod = await import('../lib/supabase.js');
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
        // exclude flag is event-level now â€” new rows inherit closeExcludeUI, existing rows keep their value
        exclude_from_ordering: existing?.exclude_from_ordering ?? closeExcludeUI ?? false,
        closed_by: currentUser?.name || currentUser?.id || 'Unknown'
      };
      if(existing?.id) merged.id = existing.id;
      if(merged.leftover_kg==null) merged.leftover_kg = 0;
      const {data, error} = await mod.supabase
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
  // If no rows exist yet, only local state is updated â€” new rows created via saveClosing will inherit it.
  async function toggleEventExclude(newVal, ctx){
    if(!ctx) return;
    setCloseExcludeUI(newVal);
    const dishesWithRows = Object.keys(closeRows);
    if(dishesWithRows.length === 0) return;
    try {
      const mod = await import('../lib/supabase.js');
      const {error} = await mod.supabase
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
  async function savePlanYield(dish, rawVal, ctx){
    const trimmed = (rawVal==null?"":String(rawVal)).trim();
    const num = trimmed==="" ? null : parseFloat(trimmed);
    setPlanSaving(p=>{const s=new Set(p);s.add(dish);return s;});
    try{
      const mod = await import('../lib/supabase.js');
      if(num===null || isNaN(num) || num<=0){
        if(planRows[dish]){
          const {error} = await mod.supabase.from('production_plans').delete().eq('event_id',ctx.evId).eq('dish_name',dish);
          if(error) throw error;
          setPlanRows(p=>{const c={...p};delete c[dish];return c;});
        }
      } else {
        const payload = {
          event_id: ctx.evId,
          event_date: ctx.evDate,
          venue: ctx.venue,
          dish_name: dish,
          recipe_id: ctx.recipe?.id || null,
          target_yield_kg: num,
          planned_by: currentUser?.name || currentUser?.id || 'Unknown',
          status: 'draft'
        };
        const {data, error} = await mod.supabase
          .from('production_plans')
          .upsert(payload, {onConflict:'event_id,dish_name'})
          .select();
        if(error) throw error;
        if(data && data[0]) setPlanRows(p=>({...p,[dish]:data[0]}));
      }
      setPlanDrafts(p=>{const c={...p};delete c[dish];return c;});
    } catch(e){
      console.error('[savePlanYield]', dish, e);
      alert('Failed to save yield for '+dish+': '+(e.message||e));
    } finally {
      setPlanSaving(p=>{const s=new Set(p);s.delete(dish);return s;});
    }
  }

  // â”€â”€ SOP Add/Edit Modal â”€â”€
  const [sopModal, setSopModal] = useState(null); // null | {mode:'add'|'edit', catId, origName}
  const emptySopStep = ()=>({t:"",i:"",tm:0,ccp:"",d1:false,subs:[]});
  const [sopForm, setSopForm] = useState({name:"",sub:"",catId:"",steps:[emptySopStep()]});
  function openSopAdd(catId){
    setSopForm({name:"",sub:"",catId:catId||safeArr(RECIPE_DB.cats)[0]?.id||"",steps:[emptySopStep()]});
    setSopModal({mode:"add",catId:catId||""});
  }
  function openSopEdit(recipe,catId){
    setSopForm({name:recipe.n,sub:recipe.sub||"",catId:catId||sopCat||"",steps:safeArr(recipe.steps).map(s=>({t:s.t||"",i:s.i||s.desc||"",tm:s.tm||0,ccp:s.ccp||"",d1:!!s.d1,subs:Array.isArray(s.subs)?s.subs.map(sb=>({t:sb.t||"",i:sb.i||"",tm:sb.tm||0})):[]}))});
    setSopModal({mode:"edit",catId:catId||sopCat||"",origName:recipe.n});
  }
  function sopFormStep(si,field,val){setSopForm(p=>({...p,steps:p.steps.map((s,i)=>i!==si?s:{...s,[field]:val})}));}
  function sopAddStep(){setSopForm(p=>({...p,steps:[...p.steps,emptySopStep()]}));}
  function sopRemoveStep(si){setSopForm(p=>({...p,steps:p.steps.filter((_,i)=>i!==si)}));}
  function sopMoveStep(si,dir){setSopForm(p=>{const s=[...p.steps];const ni=si+dir;if(ni<0||ni>=s.length)return p;[s[si],s[ni]]=[s[ni],s[si]];return{...p,steps:s};});}
  function sopAddSub(si){setSopForm(p=>({...p,steps:p.steps.map((s,i)=>i!==si?s:{...s,subs:[...(s.subs||[]),{t:"",i:"",tm:0}]})}));}
  function sopRemoveSub(si,sbi){setSopForm(p=>({...p,steps:p.steps.map((s,i)=>i!==si?s:{...s,subs:(s.subs||[]).filter((_,j)=>j!==sbi)})}));}
  function sopEditSub(si,sbi,field,val){setSopForm(p=>({...p,steps:p.steps.map((s,i)=>i!==si?s:{...s,subs:(s.subs||[]).map((sb,j)=>j!==sbi?sb:{...sb,[field]:val})})}));}
  function saveSop(){
    const f=sopForm;
    if(!f.name.trim()||!f.catId||f.steps.length===0)return alert("Name, category and at least 1 step required");
    const recObj={n:f.name.trim(),sub:f.sub.trim(),steps:f.steps.map(s=>{const hasSubs=s.subs&&s.subs.filter(sb=>sb.t.trim()).length>0;return{t:s.t,i:s.i,tm:hasSubs?0:(+s.tm||0),ccp:s.ccp||null,d1:!!s.d1,...(hasSubs?{subs:s.subs.filter(sb=>sb.t.trim()).map(sb=>({t:sb.t,i:sb.i||"",tm:+sb.tm||0}))}:{})};})};
    // Update local RECIPE_DB â€” preserve ingredients from old recipe
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
    // Save to Supabase â€” preserve ingredients column
    import('../lib/supabase.js').then(mod=>{
      const sb=mod.supabase;if(!sb)return;
      if(sopModal.mode==="edit"&&sopModal.origName){
        const nameUnchanged=sopModal.origName===recObj.n&&sopModal.catId===f.catId;
        if(nameUnchanged){
          // Same name+category â†’ UPDATE in place, ingredients untouched
          sb.from('recipes').update({sub:recObj.sub,steps:recObj.steps}).eq('dish_name',recObj.n).eq('category_id',f.catId).then(r=>{if(r.error)console.error('SOP save err:',r.error);else console.log('âœ… SOP updated (in-place)');});
        }else{
          // Name or category changed â†’ fetch ingredients, then delete+insert with them
          sb.from('recipes').select('ingredients').eq('dish_name',sopModal.origName).single().then(({data})=>{
            sb.from('recipes').delete().eq('dish_name',sopModal.origName).then(()=>{
              sb.from('recipes').insert({dish_name:recObj.n,category_id:f.catId,sub:recObj.sub,steps:recObj.steps,ingredients:data?.ingredients||null}).then(r=>{if(r.error)console.error('SOP save err:',r.error);else console.log('âœ… SOP updated (renamed)');});
            });
          });
        }
      }else{
        sb.from('recipes').insert({dish_name:recObj.n,category_id:f.catId,sub:recObj.sub,steps:recObj.steps}).then(r=>{if(r.error)console.error('SOP save err:',r.error);else console.log('âœ… SOP saved');});
      }
    }).catch(e=>console.error('SOP supabase err:',e));
    logActivity('kitchen', (sopModal.mode==='edit'?'SOP updated: ':'SOP created: ')+recObj.n, sopModal.mode==='edit'?'sop_update':'sop_create', {dish:recObj.n, catId:f.catId}, currentUser?.id);
    setSopModal(null);setSopRecipe(recObj);
  }
  function deleteCategory(catId){
    if(!window.confirm('Delete this SOP section? This cannot be undone.')) return;
    var arr=safeArr(RECIPE_DB.recipes[catId]);
    if(arr.length>0){window.alert('Cannot delete â€” section still has '+arr.length+' recipes. Move or delete them first.');return;}
    RECIPE_DB.cats=RECIPE_DB.cats.filter(c=>c.id!==catId);
    delete RECIPE_DB.recipes[catId];
    import('../lib/supabase.js').then(mod=>{
      mod.supabase.from('recipe_categories').delete().eq('id',catId).then(r=>{if(r.error)console.error('Cat delete err:',r.error);else console.log('âœ… Category deleted:',catId);});
    });
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
    import('../lib/supabase.js').then(mod=>{
      mod.supabase.from('recipes').update({category_id:toCatId}).eq('dish_name',recipe.n).eq('category_id',fromCatId).then(r=>{if(r.error)console.error('Move err:',r.error);else console.log('âœ… Recipe moved:',recipe.n,'â†’',toCatId);});
    });
    logActivity('kitchen','SOP moved: '+recipe.n+' â†’ '+toCatId,'sop_move',{dish:recipe.n,from:fromCatId,to:toCatId},currentUser?.id);
    setSopRecipe(null);setSopCat(toCatId);
  }
  function deleteSop(recipe,catId){
    if(!window.confirm('Delete "'+recipe.n+'"? This cannot be undone.'))return;
    const cid=catId||sopCat||"";
    const arr=RECIPE_DB.recipes[cid]||[];
    const idx=arr.findIndex(r=>r.n===recipe.n);
    if(idx>=0)arr.splice(idx,1);
    import('../lib/supabase.js').then(mod=>{
      const sb=mod.supabase;if(!sb)return;
      sb.from('recipes').delete().eq('dish_name',recipe.n).then(r=>{if(r.error)console.error('SOP delete err:',r.error);else console.log('âœ… SOP deleted');});
    }).catch(e=>console.error('SOP delete err:',e));
    logActivity('kitchen', 'SOP deleted: '+recipe.n, 'sop_delete', {dish:recipe.n, catId:cid}, currentUser?.id);
    setSopRecipe(null);
  }

  // â”€â”€ Camera for chef selfie â”€â”€
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

  // â”€â”€ Chef Photo on Mark as Complete â”€â”€
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
    const ctx=c.getContext('2d');ctx.strokeStyle='#D4B44A';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
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

  // â”€â”€ State helpers (auto-save to kitchenTracking â€” combined cooking keys) â”€â”€
  function dk(evId,idx){return evId+"|"+idx;}
  function ck(dishName){return "dish|"+dishName;}
  // Fresh TOMORROW re-derived on every call â€” module-load TOMORROW goes stale on tabs open across midnight
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
      if(d1FnFilter==="combined" && dishInfo?.name){
        const cKey=ck(dishInfo.name);
        var _ck="__combined_"+_TOM;o[_ck]={...(o[_ck]||{}),[cKey]:{...(o[_ck]?.[cKey]||{}),...upd}};
        var propUpd=Object.assign({},upd); delete propUpd.mesaDone;
        if(Object.keys(propUpd).length>0){
          (dishInfo.fns||[]).forEach(fn=>{
            const k2=dk(fn.evId,fn.idx);
            o[fn.evId]={...(o[fn.evId]||{}),[k2]:{...(o[fn.evId]?.[k2]||{}),...propUpd}};
          });
        }
      } else {
        const k2=dk(evId,idx);
        o[evId]={...(o[evId]||{}),[k2]:{...(o[evId]?.[k2]||{}),...upd}};
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

  // â”€â”€ Auto-scaling: compute effective scale per event â”€â”€
  // BASE_PAX = 400 (all SOP recipes calibrated for this)
  // Percent-based scaling (BASE_PAX / getEffectiveScale / effectiveScales) — REMOVED in Phase 4.
  // Replaced by getScaledIngredients + events.yield_multiplier + evPlanRows (Path B).

  // Prep day context: which events are being prepped for
  const prepEvLabel = tomorrowEvs.map(e=>`${e.guest||"Function"} (${e.pax} pax)`).join(", ");
  const prepContextParts = [];
  if(prepEvLabel) prepContextParts.push(`${tomorrowLabel}: ${prepEvLabel}`);

  // â”€â”€ Path B: yield-based ingredient scaling helper â”€â”€
  // Returns {ing, effKg, warn, planned}
  //   ing: [{n,h,q,u}] scaled ingredient list (or null)
  //   effKg: target finished yield in kg (null if legacy fallback)
  //   warn: 'no_base_yield' | null â€” recipe missing base_yield.kg (needs SOP fix)
  //   planned: true if chef set an explicit plan; false if auto-defaulted from base_yield Ã— pax
  const evById = useMemo(()=>Object.fromEntries((evList||[]).map(e=>[e.id,e])),[evList]);
  function getScaledIngredients(dishName, evOrId){
    const ev = typeof evOrId === "string" ? evById[evOrId] : evOrId;
    const rec = findRecipeForDish(dishName);
    const baseKg = rec?.ingredients?.base_yield?.kg || null;
    const basePax = rec?.ingredients?.base_pax || 300;
    const mult = Number(ev?.yield_multiplier) || 1.0;
    const evPax = Number(ev?.pax) || 0;
    // Yield-based path (preferred): base_yield.kg is set on the recipe
    if(baseKg){
      const planned = Number(evPlanRows?.[ev?.id]?.[dishName]?.target_yield_kg) || null;
      // Default when chef hasn't planned: base_yield Ã— pax ratio (preserves prior auto-pax behavior)
      const defaultYield = evPax > 0 ? (baseKg * evPax / basePax) : baseKg;
      const effKg = (planned || defaultYield) * mult;
      const ing = getIngrForYield(dishName, effKg);
      if(ing && ing.length) return {ing, effKg, warn:null, planned:!!planned};
    }
    // Fallback: no base_yield configured â€” legacy pax-based scaling, multiplier applied as pax bump
    const adjPax = Math.round(evPax * mult);
    const ing = getIngrForDish(dishName, adjPax || evPax);
    if(ing && ing.length) return {ing, effKg:null, warn: baseKg ? null : 'no_base_yield', planned:false};
    return {ing:null, effKg:null, warn:null, planned:false};
  }

  const TABS=[
    {v:"today",   l:T2("Event day")},
    {v:"d1",      l:T2("Prep day")},
    // {v:"scaling", ...} â€” REMOVED in Phase 3: merged into Planning tab (multiplier slider now lives there)
    {v:"sops",    l:T2("SOPs")},
    {v:"planning",l:"ðŸ“‹ "+T2("Planning")},
    {v:"analytics",l:"ðŸ“Š "+T2("Analytics")},
    {v:"closing", l:"ðŸ² "+T2("Closing")},
  ];
  const TABS_FILTERED = isSectionUser
    ? TABS.filter(t => ['today','d1','sops','closing'].includes(t.v))
    : TABS;

  // â”€â”€ Inline dish card (shows live progress) â”€â”€

  return(
    <div style={{position:"relative"}}>

      {/* Section tablet banner */}
      {sectionFilter && hasCats && (()=>{
        const bannerCat = RECIPE_DB.cats.find(c=>c.id===userCats[0]);
        const bannerColor = bannerCat?.color || C.gold;
        return (
          <div style={{background:bannerColor+'15',border:'1px solid '+bannerColor+'40',
            borderRadius:12,padding:'12px 16px',marginBottom:14,
            display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:24}}>{bannerCat?.icon||'ðŸ½'}</span>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:bannerColor}}>{sectionDisplayName}</div>
              <div style={{fontSize:11,color:C.muted}}>Showing only your assigned categories</div>
            </div>
          </div>
        );
      })()}

      {/* â”€â”€ Chef Photo Modal â”€â”€ */}
      {readyModal&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:12,overflowY:"auto"}}>
          <div style={{background:C.surface,borderRadius:20,padding:"22px 20px",maxWidth:420,width:"100%",border:`2px solid ${C.greenBorder}`,boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
            <div style={{textAlign:"center",marginBottom:14}}>
              <div style={{fontSize:28,marginBottom:6}}>ðŸ“¸</div>
              <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>{T2("Dish Ready!")}</div>
              <div style={{fontSize:13,color:C.gold,marginTop:3,fontWeight:600}}>{readyModal.dishName}</div>
            </div>
            {/* Selfie section */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>ðŸ“¸ {T2("Dish Photo")} <span style={{color:C.red}}>*</span></div>
            <div style={{borderRadius:12,overflow:"hidden",background:"#000",marginBottom:10,minHeight:160,position:"relative"}}>
              {!readyPhoto?<video ref={readyVidRef} autoPlay playsInline muted style={{width:"100%",height:160,objectFit:"cover",display:"block"}}/>
                          :<img src={readyPhoto} alt="dish" style={{width:"100%",height:160,objectFit:"cover",display:"block"}}/>}
              {!readyCamOn&&!readyPhoto&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:13}}>ðŸ“· {T2("Starting cameraâ€¦")}</div>}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {!readyPhoto
                ?<button onClick={()=>{const s=snapReady();if(s){setReadyPhoto(s);stopReadyCam();}}} style={{flex:1,padding:"10px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:42}}>ðŸ“¸ {T2("Capture Photo")}</button>
                :<button onClick={()=>{setReadyPhoto(null);sigClear();startReadyCam();}} style={{flex:1,padding:"10px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:42}}>ðŸ”„ {T2("Retake")}</button>
              }
            </div>
            {/* Signature section */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>âœï¸ {T2("Chef Signature")} <span style={{color:C.muted,fontWeight:400}}>(optional)</span></div>
            <div style={{border:`2px solid ${readySig?C.goldBorder:C.border}`,borderRadius:10,overflow:"hidden",background:"#fff",marginBottom:6,touchAction:"none"}}>
              <canvas ref={sigCanvasRef} width={380} height={120}
                style={{display:"block",width:"100%",height:120,cursor:"crosshair",touchAction:"none"}}
                onMouseDown={sigStart} onMouseMove={sigMove} onMouseUp={sigEnd} onMouseLeave={sigEnd}
                onTouchStart={sigStart} onTouchMove={sigMove} onTouchEnd={sigEnd}
              />
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontSize:11,color:C.muted}}>{readySig?"âœ… Signed":"Draw signature above"}</span>
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
                âœ… {T2("Confirm Ready")}
              </button>
              <button onClick={()=>{stopReadyCam();setReadyModal(null);setReadyPhoto(null);setReadySig(null);sigClear();}} style={{padding:"14px 16px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer",minHeight:50}}>âœ•</button>
            </div>
          </div>
        </div>
      )}


      {/* â”€â”€ SOP Add/Edit Modal â”€â”€ */}
      {sopModal&&!editingSteps&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 12px",overflowY:"auto"}}>
          <div style={{background:C.surface,borderRadius:18,padding:"22px 20px",maxWidth:540,width:"100%",border:`2px solid ${C.goldBorder}`,boxShadow:"0 24px 60px rgba(0,0,0,.5)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:17,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{sopModal.mode==="edit"?"âœï¸ Edit Recipe SOP":"âž• Add Recipe SOP"}</div>
              <button onClick={()=>setSopModal(null)} style={{padding:"6px 12px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer"}}>âœ•</button>
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
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Steps ({sopForm.steps.length})</div>
            <div style={{maxHeight:340,overflowY:"auto",marginBottom:12,border:`1px solid ${C.border}`,borderRadius:12,padding:8,background:C.bg}}>
              {sopForm.steps.map((step,si)=>(
                <div key={si} style={{padding:"10px 8px",borderBottom:si<sopForm.steps.length-1?`1px solid ${C.borderLight}`:"none",position:"relative"}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:C.gold,minWidth:20}}>{si+1}.</span>
                    <input value={step.t} onChange={e=>sopFormStep(si,"t",e.target.value)} placeholder="Step title" style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:36}}/>
                    <button onClick={()=>sopMoveStep(si,-1)} disabled={si===0} style={{padding:"4px 8px",borderRadius:6,background:C.darkCard,border:`1px solid ${C.border}`,color:si===0?C.faint:C.text,fontSize:12,cursor:si===0?"default":"pointer"}}>â†‘</button>
                    <button onClick={()=>sopMoveStep(si,1)} disabled={si===sopForm.steps.length-1} style={{padding:"4px 8px",borderRadius:6,background:C.darkCard,border:`1px solid ${C.border}`,color:si===sopForm.steps.length-1?C.faint:C.text,fontSize:12,cursor:si===sopForm.steps.length-1?"default":"pointer"}}>â†“</button>
                    <button onClick={()=>sopRemoveStep(si)} style={{padding:"4px 8px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,cursor:"pointer"}}>âœ•</button>
                  </div>
                  <textarea value={step.i} onChange={e=>sopFormStep(si,"i",e.target.value)} placeholder="Instructions (Hindi)" rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box",resize:"vertical",minHeight:44}}/>
                  <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
                    {!(step.subs&&step.subs.length>0)&&<div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:11,color:C.muted}}>â±</span>
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
                            <button onClick={()=>sopRemoveSub(si,sbi)} style={{width:24,height:24,borderRadius:5,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,cursor:"pointer",padding:0,flexShrink:0}}>âœ•</button>
                          </div>
                          <textarea value={sb.i} onChange={e=>sopEditSub(si,sbi,"i",e.target.value)} placeholder="Instructions (Hindi)" rows={1} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg,boxSizing:"border-box",resize:"vertical",minHeight:32,marginBottom:4}}/>
                          <div style={{display:"flex",alignItems:"center",gap:6,background:C.bg,borderRadius:6,padding:"5px 10px",border:`1px solid ${C.borderLight}`}}>
                            <span style={{fontSize:11,color:C.amber,fontWeight:600}}>â± Timer</span>
                            <input type="number" step="0.5" value={sb.tm?Math.round(sb.tm/60*10)/10:""} onChange={e=>sopEditSub(si,sbi,"tm",String(Math.round((parseFloat(e.target.value)||0)*60)))} placeholder="0" style={{width:56,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.amberBorder}`,fontSize:13,fontWeight:600,textAlign:"center",color:C.amber,background:"transparent",minHeight:28}}/>
                            <span style={{fontSize:11,color:C.faint}}>min</span>
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
                {sopModal.mode==="edit"?"ðŸ’¾ Update Recipe":"âž• Save Recipe"}
              </button>
              <button onClick={()=>setSopModal(null)} style={{padding:"14px 20px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer",minHeight:48}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ CSV IMPORT MODAL â”€â”€ */}
      {csvImport&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
          <div style={{background:C.surface,borderRadius:14,maxWidth:560,width:"100%",maxHeight:"90vh",overflowY:"auto",border:`2px solid ${C.gold}`,boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>ðŸ“¥ Import Ingredients CSV</div>
              <button onClick={()=>setCsvImport(null)} style={{padding:"4px 10px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer"}}>âœ•</button>
            </div>
            <div style={{padding:16}}>
              <div style={{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.5}}>
                <b style={{color:C.text}}>{csvImport.recipeName}</b> Â· currently {csvImport.currentCount} items<br/>
                Download the current ingredients, edit in Excel or Sheets, then upload to <b>replace all ingredients</b> for this recipe.
                <br/><span style={{color:C.faint,fontSize:11}}>Quantities are at {csvImport.basePax} pax anchor.</span>
              </div>
              <button onClick={()=>csvDownloadFromRecipe(csvImport.recipe)} style={{width:"100%",padding:"10px",borderRadius:10,border:`1.5px solid ${C.goldBorder}`,background:C.goldBg,color:C.gold,fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:12,minHeight:40}}>â¬‡ Download current CSV</button>
              <div style={{padding:"10px 12px",borderRadius:10,background:C.darkCard,border:`1px dashed ${C.border}`,marginBottom:10}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:600}}>Upload edited CSV:</div>
                <input type="file" accept=".csv,text/csv" onChange={e=>{
                  const f=e.target.files?.[0]; if(!f) return;
                  const rd=new FileReader();
                  rd.onload=()=>{ const {items,warnings}=csvImportParse(rd.result); setCsvImport(p=>({...p,parsedItems:items,warnings})); };
                  rd.readAsText(f,'utf-8');
                }} style={{fontSize:12,color:C.text,width:"100%"}}/>
              </div>
              {csvImport.parsedItems&&(
                <div style={{padding:"10px 12px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,marginBottom:10}}>
                  <div style={{fontSize:12,color:C.text,fontWeight:700,marginBottom:6}}>
                    Found {csvImport.parsedItems.length} rows: {csvImport.parsedItems.filter(i=>!i.isSection).length} ingredients + {csvImport.parsedItems.filter(i=>i.isSection).length} sections
                  </div>
                  {csvImport.warnings?.length>0&&(
                    <div style={{marginTop:8,padding:"6px 10px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,fontSize:10,color:C.amber,maxHeight:120,overflowY:"auto"}}>
                      <div style={{fontWeight:700,marginBottom:4}}>âš  Warnings ({csvImport.warnings.length}):</div>
                      {csvImport.warnings.map((w,i)=>(<div key={i}>â€¢ {w}</div>))}
                    </div>
                  )}
                  <div style={{fontSize:11,color:C.muted,marginTop:8}}>
                    Replace current <b>{csvImport.currentCount}</b> items with these <b>{csvImport.parsedItems.length}</b>?
                  </div>
                </div>
              )}
              <div style={{display:"flex",gap:8,marginTop:14}}>
                {csvImport.parsedItems&&csvImport.parsedItems.length>0&&(
                  <button onClick={csvImportSave} style={{flex:1,padding:"12px",borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>
                    âœ“ Replace with {csvImport.parsedItems.length} items
                  </button>
                )}
                <button onClick={()=>setCsvImport(null)} style={{padding:"12px 20px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:44}}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ MENU NOT BUILT WARNING (empty menu OR custom package unconfirmed) â”€â”€ */}
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
          const heading = menuLen===0 ? T2("No menu set â€” chef has nothing to prep") : T2("Custom menu â€” verify it's complete");
          const body = menuLen===0
            ? T2("Admin must build the menu in Menu Editor before any prep or cooking can start.")
            : T2("LMS marked this as a Custom menu with")+" "+menuLen+" "+T2("dish(es) â€” verify with admin that all dishes are correctly listed before cooking.");
          const pkgNote = (isCustom||!pkg) ? "" : " Â· "+T2("Package")+": "+pkg;
          return (
            <div key={"menu-warn-"+ev.id} style={{marginBottom:12,padding:"14px 18px",borderRadius:12,background:C.redBg,border:`2px solid ${C.red}`,display:"flex",alignItems:"flex-start",gap:12}}>
              <span style={{fontSize:24,flexShrink:0,lineHeight:1}}>ðŸš¨</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:4}}>{heading} â€” {ev.guest||T2("Function")} ({isToday?T2("today"):T2("tomorrow")})</div>
                <div style={{fontSize:12,color:C.red,lineHeight:1.5}}>{ev.venue||""} Â· {ev.date} Â· {ev.pax} {T2("pax")} Â· {ev.time||"TBD"}{pkgNote} â€” {body}</div>
              </div>
              {currentUser&&currentUser.role==='admin'&&(
                <button onClick={function(){
                  if(!window.confirm("Mark menu as built for '"+(ev.guest||"function")+"'?\n\nThis clears the warning banner. Only do this after confirming all dishes are correctly set in Menu Editor.")) return;
                  import('../lib/supabase.js').then(function(mod){
                    mod.supabase.from('events').update({custom_menu_confirmed:true}).eq('id',ev.id).then(function(r){
                      if(r.error){alert('Failed to save: '+r.error.message);console.error(r.error);}
                    });
                  });
                }} style={{padding:'8px 14px',borderRadius:8,background:C.surface,border:`1.5px solid ${C.red}`,color:C.red,fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>âœ“ {T2("Menu built")}</button>
              )}
            </div>
          );
        });
      })()}
      <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.border}`,marginBottom:20,gap:0}}>
        {TABS_FILTERED.map(t=>(
          <button key={t.v} onClick={()=>setTab(s=>{if(s!==t.v&&(t.v==="d1"||s==="d1")){setD1View("all");setD1FnFilter("combined");}return t.v;})} style={{padding:"10px 18px",fontSize:13,fontWeight:tab===t.v?500:400,cursor:"pointer",background:"none",color:tab===t.v?C.gold:C.muted,border:"none",borderBottom:`2px solid ${tab===t.v?C.gold:"transparent"}`,whiteSpace:"nowrap"}}>{t.l}</button>
        ))}
        {currentUser&&currentUser.role==='admin'&&(
          <button onClick={function(){
            // Recompute TODAY/TOMORROW FRESH at click time.
            // The module-load constants become stale if this tab has been open across midnight â€”
            // that is how July 15/16 kitchen_tracking data got nuked in one accidental Reset click.
            const _nowD = new Date();
            const TODAY_NOW = localDateStr(_nowD);
            const _tomD = new Date(_nowD); _tomD.setDate(_tomD.getDate()+1);
            const TOMORROW_NOW = localDateStr(_tomD);

            // Hard block: if module-load TODAY differs from real today, the whole session is
            // stale. Force reload rather than delete data belonging to yesterday.
            if(TODAY_NOW !== TODAY){
              alert(
                "âš  This tab was opened on "+TODAY+" but today is "+TODAY_NOW+".\n\n"+
                "The app's date has drifted across midnight. Reloading now to prevent "+
                "accidental deletion of past data. Try Reset again after reload."
              );
              window.location.reload();
              return;
            }

            // Refilter events using fresh dates (defensive against any state drift)
            const _all = safeArr(events);
            const todayEvs2 = _all.filter(e=>e.date===TODAY_NOW);
            const tomorrowEvs2 = _all.filter(e=>e.date===TOMORROW_NOW);
            const todayIds = todayEvs2.map(e=>e.id);
            const tomorrowIds = tomorrowEvs2.map(e=>e.id);
            const evIds = [...todayIds, ...tomorrowIds];
            const combKeys = ["__combined_"+TODAY_NOW, "__combined_"+TOMORROW_NOW];
            const targetIds = [...evIds, ...combKeys];
            if(evIds.length === 0){
              alert("No events on "+TODAY_NOW+" or "+TOMORROW_NOW+" â€” nothing to reset.");
              return;
            }
            const totalDishes = evIds.reduce((n, id)=>{
              const evObj = _all.find(e=>e.id===id);
              return n + (evObj ? menuArr(evObj).length : 0);
            }, 0);

            // Confirmation shows the ACTUAL DATES so admin can spot a stale session before wiping
            if(!window.confirm(
              "âš  DELETE kitchen tracking rows from database?\n\n"+
              "Today ("+TODAY_NOW+"): "+todayEvs2.length+" event"+(todayEvs2.length!==1?"s":"")+"\n"+
              "Tomorrow ("+TOMORROW_NOW+"): "+tomorrowEvs2.length+" event"+(tomorrowEvs2.length!==1?"s":"")+"\n"+
              "Total: ~"+totalDishes+" dishes across "+targetIds.length+" ev_id(s).\n\n"+
              "PERMANENTLY deletes step timers, selfies, completion status for these dates.\n"+
              "Other dates are NOT touched. Cannot undo."
            )) return;
            setKitchenTracking(p=>{
              const o = (p&&typeof p==="object") ? {...p} : {};
              targetIds.forEach(id => { delete o[id]; });
              return o;
            });
            try{localStorage.removeItem('ambria_kitchen_tracking');}catch(e){}
            try{localStorage.removeItem('ambria_kt');}catch(e){}
            import('../lib/supabase.js').then(function(mod){
              mod.supabase.from('kitchen_tracking').delete().in('ev_id', targetIds).then(function(r){
                if(r.error) console.error('KT scoped clear error:', r.error);
                else console.log('âœ… Supabase kitchen_tracking cleared for', targetIds.length, 'ev_ids ('+TODAY_NOW+' + '+TOMORROW_NOW+')');
              });
            }).catch(function(e){console.error('KT clear import error:', e);});
            alert("âœ… Reset complete. Deleted "+targetIds.length+" ev_id row(s) for "+TODAY_NOW+" + "+TOMORROW_NOW+".");
          }} style={{padding:'5px 10px',borderRadius:8,background:"none",border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,fontWeight:500,cursor:'pointer',marginLeft:'auto',marginBottom:6,whiteSpace:"nowrap"}}>
            â†º {T2("Reset current")}
          </button>
        )}
        {currentUser&&currentUser.role==='admin'&&(
          <button onClick={()=>setShowDishMap(true)} style={{padding:'5px 10px',borderRadius:8,background:"none",border:`1px solid ${C.goldBorder}`,color:C.gold,fontSize:11,fontWeight:500,cursor:'pointer',marginLeft:currentUser.role==='admin'?0:'auto',marginBottom:6,whiteSpace:"nowrap"}}>
            ðŸ”— {T2("Dish Map")}
          </button>
        )}
      </div>

      {/* â•â•â• EVENT DAY â€” only cooking/dispatch for today's functions â•â•â• */}
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
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:48,marginBottom:16}}>ðŸ‘¨â€ðŸ³</div>
            <div style={{fontSize:18,fontWeight:500,color:C.text,marginBottom:8}}>{T2("No event today")}</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>{T2("Event day cooking tasks will appear here when there's a function scheduled for today.")}</div>
            {tomorrowEvs.length>0&&(
              <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:10,background:C.goldBg,border:`1px solid ${C.border}`,fontSize:13,color:C.gold}}>
                <span>ðŸ“…</span>
                <span>{T2("Next up")}: {tomorrowLabel} â€” {tomorrowEvs.map(e=>`${e.guest||"Function"} (${e.pax} pax)`).join(", ")}</span>
              </div>
            )}
            <div style={{marginTop:16}}>
              <button onClick={()=>setTab("d1")} style={{padding:"10px 20px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:13,fontWeight:500,cursor:"pointer"}}>{T2("Go to Prep day")} â†’</button>
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

        // Build dishes â€” filtered by selected function or combined
        const byDishD1={};
        filteredEvs.forEach(ev=>{
          const sp=ev.special||"";
          const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
          menuArr(ev).forEach((name,idx)=>{
            if(getSectionForDish(name)==="Beverages") return;
            if(allowedCatIds && !allowedCatIds.includes(getCatIdForDish(name))) return;
            if(!byDishD1[name])byDishD1[name]={sec:getSectionForDish(name),catId:getCatIdForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
            byDishD1[name].totalPax+=ev.pax||0;
            byDishD1[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
            if(isSpecial)byDishD1[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
          });
        });
        // TEMP: d1-based filtering disabled â€” all dishes flow through, all SOP steps shown regardless of day tagging.
        // Always group by SOP category
        const bySecD1={};
        Object.entries(byDishD1).forEach(([n,info])=>{
          const groupKey = info.catId || 'maincourse';
          if(!bySecD1[groupKey])bySecD1[groupKey]=[];
          bySecD1[groupKey].push({name:n,...info});
        });
        const allSecs = Object.keys(bySecD1).sort();

        const totalD1Done = Object.values(byDishD1).filter(d=>ds(d.fEvId,d.fIdx,d.name).mesaDone).length;
        const totalD1 = Object.keys(byDishD1).length;
        const totalD1Pax = filteredEvs.reduce((s,e)=>s+(+e.pax||0),0);
        const combinedPax = d1Evs.reduce((s,e)=>s+(+e.pax||0),0);

        return(
          <div>
            {/* â”€â”€ Function selector tabs â”€â”€ */}
            {d1Evs.length>1&&(
              <div style={{display:"flex",gap:0,borderRadius:12,overflow:"hidden",border:`1.5px solid ${C.border}`,marginBottom:16}}>
                <button onClick={()=>setD1FnFilter("combined")}
                  style={{flex:1,padding:"12px 10px",border:"none",cursor:"pointer",background:isCombined?C.gold:"transparent",textAlign:"center",minHeight:52}}>
                  <div style={{fontSize:13,fontWeight:isCombined?700:500,color:isCombined?"#fff":C.text}}>ðŸ³ Combined</div>
                  <div style={{fontSize:11,color:isCombined?"rgba(255,255,255,.8)":C.muted,marginTop:2}}>{combinedPax} pax Â· {d1Evs.length} functions</div>
                </button>
                {d1Evs.map(ev=>{
                  const isSel=d1FnFilter===ev.id;
                  const odcWarn=ev.venue==="Outdoor Catering (ODC)"&&!ev.odc_menu_confirmed;
                  return(
                    <button key={ev.id} onClick={()=>setD1FnFilter(ev.id)}
                      style={{flex:1,padding:"12px 10px",border:"none",borderLeft:`1px solid ${C.border}`,cursor:"pointer",background:isSel?C.gold:odcWarn?C.amberBg:"transparent",textAlign:"center",minHeight:52}}>
                      <div style={{fontSize:13,fontWeight:isSel?700:500,color:isSel?"#fff":C.text}}>{ev.guest||"Function"}{odcWarn&&<span style={{marginLeft:4,fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:4,background:isSel?"rgba(255,255,255,.3)":C.amber,color:isSel?"#fff":"#fff"}}>âš  menu</span>}</div>
                      <div style={{fontSize:11,color:isSel?"rgba(255,255,255,.8)":C.muted,marginTop:2}}>{ev.pax} pax Â· {ev.odc_location||ev.venue||""} Â· {ev.time||"TBD"}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* â”€â”€ Summary card â”€â”€ */}
            {(()=>{
              const pct=totalD1>0?Math.round(totalD1Done/totalD1*100):0;
              const headerLabel = isCombined
                ? `${d1Label} ${T2("prep")} â€” ${T2("Combined")}`
                : `${d1Label} â€” ${activeEv?.guest||"Function"}`;
              return(
                <div style={{background:C.surface,borderLeft:`3px solid ${isCombined?C.gold:C.green}`,border:`1.5px solid ${C.border}`,borderLeftWidth:3,borderRadius:10,padding:"14px 16px",marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:500,color:isCombined?C.gold:C.green,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{headerLabel}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                    <div style={{fontSize:22,fontWeight:500,color:isCombined?C.gold:C.green,lineHeight:1.1}}>{totalD1Pax||"â€”"} <span style={{fontSize:12,fontWeight:400,color:C.muted}}>pax</span></div>
                    <div style={{fontSize:11,color:C.muted}}>{totalD1Done} / {totalD1} {T2("done")}</div>
                  </div>
                  <div style={{height:3,background:C.border,borderRadius:2,marginTop:8,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:isCombined?C.gold:C.green,borderRadius:2,transition:"width .3s"}}/></div>
                  {isCombined?(
                    <div style={{fontSize:11,color:C.muted,marginTop:6}}>{d1Evs.map(e=>`${e.guest||"Function"} (${e.pax} pax Â· ${e.time||"TBD"})`).join(" Â· ")}</div>
                  ):(
                    <div style={{fontSize:11,color:C.muted,marginTop:6}}>{activeEv?.guest} Â· {activeEv?.venue||""} Â· {activeEv?.pax} pax Â· {activeEv?.time||"TBD"}{activeEv?.menu_package?" Â· "+activeEv.menu_package:""}</div>
                  )}
                  {!isCombined&&(
                    <div style={{marginTop:8,padding:"6px 10px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,fontSize:10,color:C.amber}}>
                      ðŸ’¡ {T2("Viewing single function. Prep is done collectively â€” switch to Combined for cooking, use this view for dispatch sign-off.")}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* â”€â”€ Section-wise view â”€â”€ */}
            {isSectionUser ? (
            /* â•â•â• TABLET VIEW â€” large, chef-friendly â•â•â• */
            allSecs.length===0
              ? <div style={{padding:"40px 20px",textAlign:"center",borderRadius:14,border:`1.5px solid ${C.border}`,background:C.surface}}><div style={{fontSize:18,color:C.muted}}>ðŸ³ {T2("No dishes to prep")}</div></div>
              : allSecs.map(sec=>{
                const secItems = bySecD1[sec]||[];
                const catObj2 = RECIPE_DB.cats.find(c=>c.id===sec);
                const m2 = {color:catObj2?.color||C.muted,icon:catObj2?.icon||"ðŸ½"};
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
                        <div><div style={{fontSize:20,fontWeight:700,color:m2.color}}>{T2(catObj2?.name||sec)}</div><div style={{fontSize:14,color:C.muted}}>{totalCount} {T2("dishes")}{eventOnlyCount>0?` Â· ${eventOnlyCount} ${T2("event-day only")}`:""}</div></div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:14}}>
                        <div style={{padding:"6px 14px",borderRadius:10,background:m2.color+"18",fontSize:16,fontWeight:700,color:m2.color}}>{doneCount} / {prepTotal}</div>
                        <div style={{width:80,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:secPct+"%",background:m2.color,borderRadius:3,transition:"width .3s"}}/></div>
                        <span style={{fontSize:20,color:C.faint,transform:secOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}>â–¾</span>
                      </div>
                    </div>
                    {secOpen&&<div style={{padding:"10px 14px 14px"}}>
                      {secItems.map((dish,di)=>{
                        const isDone = !!ds(dish.fEvId,dish.fIdx,dish.name).mesaDone;
                        const cKey = `d1dish_${dish.name.replace(/\s/g,"_")}`;
                        const isExp = expandedDishes.has(cKey);
                        const sp = dish.specials&&dish.specials.length>0 ? dish.specials.map(s=>s.instruction).join(", ") : "";
                        const evOnly = !!dish.eventDayOnly;
                        return(
                          <div key={dish.name} style={{marginBottom:10,borderRadius:12,border:`1.5px solid ${evOnly?C.amberBorder:isDone?C.greenBorder:isExp?m2.color:C.border}`,background:C.surface,opacity:evOnly?0.85:1}}>
                            <div onClick={()=>toggleDish(cKey)} style={{padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:16,minHeight:64,background:evOnly?C.amberBg+"40":isDone?C.greenBg+"60":"transparent"}}>
                              <div style={{width:36,height:36,borderRadius:10,background:evOnly?C.amberBg:isDone?C.green:C.border,border:evOnly?`1px solid ${C.amberBorder}`:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16,fontWeight:700,color:evOnly?C.amber:isDone?"#fff":C.muted}}>{evOnly?"â­":isDone?"âœ“":di+1}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:18,fontWeight:600,color:isDone?C.green:C.text,textDecoration:isDone?"line-through":"none"}}>{dish.name}</div>
                                <div style={{fontSize:14,color:C.muted,marginTop:2}}>{dish.fns.length} {T2("event")}{dish.fns.length>1?"s":""}{evOnly&&<span style={{marginLeft:8,padding:"2px 8px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,fontSize:12,color:C.amber,fontWeight:600}}>â­ {T2("Event day only")}</span>}{sp?<span style={{marginLeft:8,padding:"2px 8px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,fontSize:12,color:C.red}}>âš  {sp}</span>:null}</div>
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:20,fontWeight:700,color:isDone?C.green:m2.color}}>{dish.totalPax}</div><div style={{fontSize:12,color:C.muted}}>pax</div></div>
                              <span style={{fontSize:18,color:C.faint,flexShrink:0}}>{isExp?"â–¼":"â–¶"}</span>
                            </div>
                            {isExp&&evOnly&&(
                              <div style={{padding:"20px 24px",borderTop:`1.5px solid ${C.border}`,background:C.bg,textAlign:"center"}}>
                                <div style={{fontSize:14,color:C.muted,padding:"12px 0"}}>â­ {T2("This dish has no D-1 prep steps.")}</div>
                                <div style={{fontSize:12,color:C.faint}}>{T2("All preparation happens on event day â€” see Event Day tab.")}</div>
                              </div>
                            )}
                            {isExp&&!evOnly&&(()=>{
                              const d2s=ds(dish.fEvId,dish.fIdx,dish.name);
                              const allStepsFn = getStepsForDish(dish.name);
                              const d1Only = allStepsFn; // TEMP: showing all steps regardless of d1 tag
                              const steps = d1Only.length>0?d1Only:[{t:"Mesa",i:"Wash, cut, measure all ingredients",tm:600,d1:true},{t:"Primary prep",i:"Prepare base masala / paste",tm:480,d1:true}];
                              const ssStarted=!!d2s.storeStart;const ssDone=!!d2s.storeEnd;
                              const ssEl=ssStarted&&!ssDone?Math.floor((Date.now()-(d2s.storeStart||0))/1000):0;
                              const ssRem=Math.max(0,1800-ssEl);const ssPct=ssStarted?Math.min(100,Math.round(ssEl/1800*100)):0;
                              return(
                                <div style={{padding:"12px 20px 20px",borderTop:`1.5px solid ${C.border}`}}>
                                  <div style={{padding:16,marginBottom:14,borderRadius:12,border:`2px solid ${ssDone?C.greenBorder:ssStarted?C.amberBorder:C.border}`,background:ssDone?C.greenBg:ssStarted?C.amberBg:C.bg}}>
                                    <div style={{display:"flex",gap:14,alignItems:"center"}}>
                                      <div style={{width:40,height:40,borderRadius:10,background:ssDone?C.green:ssStarted?C.amber:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#fff",flexShrink:0}}>{ssDone?"âœ“":"0"}</div>
                                      <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:ssDone?C.green:ssStarted?C.amber:C.text}}>ðŸª {T2("Collect from store")}</div><div style={{fontSize:13,color:C.muted}}>30 min â€” {T2("collect all ingredients")}</div></div>
                                    </div>
                                    {ssStarted&&!ssDone&&<div style={{marginTop:10}}><div style={{height:8,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:ssPct+"%",background:C.amber,borderRadius:4,transition:"width 1s"}}/></div><div style={{fontSize:14,color:C.amber,fontWeight:700,marginTop:4}}>â± {Math.floor(ssEl/60)}m {ssEl%60}s / 30m â€” {Math.floor(ssRem/60)}m left</div></div>}
                                    {!ssStarted&&!ssDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeStart:Date.now()},dish)} style={{padding:"14px 20px",borderRadius:12,width:"100%",background:C.gold,color:"#fff",border:"none",fontSize:16,fontWeight:700,cursor:"pointer",minHeight:54,marginTop:10}}>ðŸƒ {T2("Go Collect")} â€” 30 min</button>}
                                    {ssStarted&&!ssDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeEnd:Date.now()},dish)} style={{padding:"14px 20px",borderRadius:12,width:"100%",background:C.green,color:"#fff",border:"none",fontSize:16,fontWeight:700,cursor:"pointer",minHeight:54,marginTop:10}}>â¹ {T2("Done")} â€” {T2("Items collected")}</button>}
                                    {ssDone&&<div style={{fontSize:14,color:C.green,fontWeight:700,marginTop:8}}>âœ… {T2("Store sourcing complete")}</div>}
                                  </div>
                                  {(()=>{const pax=dish.totalPax||0;const {ing,effKg,warn,planned}=getScaledIngredients(dish.name,dish.fEvId);if(!ing||ing.length===0)return null;const yieldLbl=effKg?`${T2("target")} ${effKg.toFixed(1).replace(/\.0$/,"")} kg`:`${pax} pax`;return(
                                    <div style={{background:C.bg,borderRadius:10,padding:"12px 16px",marginBottom:14,border:`1px solid ${warn?C.redBorder:C.border}`,position:"sticky",top:0,zIndex:5}}>
                                      {warn==='no_base_yield'&&<div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:8,padding:"6px 10px",background:C.redBg,borderRadius:8,border:`1px solid ${C.redBorder}`}}>âš  {T2("Recipe missing base_yield â€” using legacy pax scaling. Chef must set base_yield in SOP.")}</div>}
                                      <div style={{fontSize:14,fontWeight:700,color:ssDone?C.green:C.gold,marginBottom:8}}>{ssDone?"ðŸ“Š":"ðŸ§º"} {ssDone?T2("Ingredients"):T2("Items to collect")} â€” {yieldLbl}{planned?` Â· ${T2("planned")}`:effKg?` Â· ${T2("auto")}`:""}</div>
                                      <div style={{display:"flex",flexWrap:"wrap",gap:"6px 16px"}}>{ing.filter(i=>i.q>0).map((i,ii)=>{const raw=i.q;const qty=i.u==="g"||i.u==="gm"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g"):i.u==="ml"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml"):i.u==="pcs"?Math.ceil(raw)+" pcs":i.u==="kg"?(raw.toFixed(1).replace(/\.0$/,""))+" kg":i.u==="L"?(raw.toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" "+i.u;return <span key={ii} style={{fontSize:14,color:C.text}}>{i.n}: <b style={{color:C.gold}}>{qty}</b></span>;})}</div>
                                    </div>);})()}
                                  <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>{T2("Steps")} â€” {steps.length}</div>
                                  {steps.map((step,si)=>{const d2d=ds(dish.fEvId,dish.fIdx,dish.name);const sk="step_"+si;const hasSubs=Array.isArray(step.subs)&&step.subs.length>0;
                                    const subsDone=hasSubs?step.subs.every((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])):false;
                                    const stS=!!(d2d.starts&&d2d.starts[sk]);const stM=hasSubs?subsDone:!!(d2d.manual&&d2d.manual[sk]);const stDone=stM;
                                    const stEl=stS?Math.floor((Date.now()-(d2d.starts[sk]||Date.now()))/1000):0;const stOverdue=stS&&step.tm&&stEl>=step.tm&&!stDone;const stRem=step.tm?Math.max(0,step.tm-stEl):0;const stPct2=step.tm>0?Math.min(100,Math.round(stEl/step.tm*100)):0;const pk="step_"+(si-1);
                                    const prevStepHasSubs=si>0&&Array.isArray(steps[si-1].subs)&&steps[si-1].subs.length>0;
                                    const prevD=true;
                                    return(
                                    <div key={si} style={{padding:"14px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",...(step.ccp&&!stDone?{background:C.redBg,borderLeft:`3px solid ${C.red}`,marginLeft:-12,paddingLeft:12,borderRadius:6}:{})}}>
                                      <div style={{display:"flex",gap:14,alignItems:"center"}}>
                                      <div style={{width:38,height:38,borderRadius:10,background:stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.darkCard,border:`2px solid ${stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:stDone||stS?"#fff":step.ccp?"#fff":C.muted,flexShrink:0}}>{stDone?"âœ“":si+1}</div>
                                      <div style={{flex:1}}>
                                        <div style={{fontSize:16,fontWeight:600,color:stDone?C.green:stS?C.amber:C.text,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(step.t)}{hasSubs&&!stDone&&<span style={{fontSize:12,color:C.muted,marginLeft:8}}>({step.subs.filter((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])).length}/{step.subs.length})</span>}</div>
                                        {(()=>{const d2=cleanStepText(step.i||step.desc||"");const t2=cleanStepText(step.t);if(!d2||t2.includes(d2)||d2.includes(t2))return null;return <div style={{fontSize:13,color:C.muted,marginTop:2}}>{d2}</div>;})()}
                                        {step.ccp&&<div style={{fontSize:13,color:C.red,marginTop:3}}>ðŸ”´ {cleanStepText(step.ccp)}</div>}
                                        {!hasSubs&&stS&&!stDone&&step.tm>0&&<div style={{marginTop:6}}><div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,stPct2)+"%",background:stOverdue?C.red:C.amber,borderRadius:3,transition:"width 1s"}}/></div>{stOverdue?<div style={{fontSize:13,color:C.red,fontWeight:700,marginTop:3}}>â± {T2("Overdue")} â€” {T2("tap Done")}</div>:<div style={{fontSize:13,color:C.amber,marginTop:3}}>â± {Math.floor(stEl/60)}m {stEl%60}s â€” {Math.floor(stRem/60)}m left</div>}</div>}
                                        {!hasSubs&&stDone&&(()=>{const de=d2d.doneElapsed?.[sk];if(de==null||!step.tm){return <div style={{fontSize:13,color:C.green,marginTop:3}}>âœ… done</div>;}const ov=de>step.tm;const un=de<step.tm;const df=Math.abs(de-step.tm);const dm=Math.floor(df/60);const dss=df%60;return <div style={{fontSize:13,color:ov?C.red:C.green,marginTop:3}}>âœ… {Math.floor(de/60)}m{de%60>0?` ${de%60}s`:""} done{ov?<span style={{color:C.red,fontWeight:600}}> ðŸ”´ +{dm>0?dm+"m ":""}{dss}s over</span>:un&&df>0?<span style={{color:C.green,fontWeight:600}}> ðŸŸ¢ {dm>0?dm+"m ":""}{dss}s under</span>:""}</div>;})()}
                                        {hasSubs&&stDone&&<div style={{fontSize:13,color:C.green,marginTop:3}}>âœ… all sub-steps done</div>}
                                        {!hasSubs&&!stS&&!stDone&&step.tm>0&&<div style={{fontSize:13,color:C.faint,marginTop:3}}>â± {fmtT(step.tm)}</div>}
                                      </div>
                                      <div style={{flexShrink:0}}>
                                        {!hasSubs&&stS&&!stDone&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sk]:el}},dish);}} style={{padding:"12px 18px",borderRadius:10,background:stOverdue?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48}}>{stOverdue?"âš ":"âœ“"} {T2("Done")}</button>}
                                        {!hasSubs&&!stS&&!stDone&&step.tm>0&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={starts:{...(d2d.starts||{}),[sk]:Date.now()}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"12px 18px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48}}>â–¶ {Math.floor(step.tm/60)}m</button>}
                                        {!hasSubs&&!stS&&!stDone&&!step.tm&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sk]:0}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"12px 18px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48}}>âœ“</button>}
                                        {hasSubs&&!stDone&&<span style={{fontSize:12,color:C.muted}}>â†“</span>}
                                        
                                        {stDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:false},starts:{...(d2d.starts||{}),[sk]:null}},dish);}} style={{padding:"6px 10px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:11,cursor:"pointer"}}>â†© Undo</button>}
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
                                                  <div style={{width:28,height:28,borderRadius:8,background:sbDone?C.green+"20":sbStarted?(sbOver?C.red+"20":C.amber+"20"):C.darkCard,border:`1.5px solid ${sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.muted,flexShrink:0,marginTop:1}}>{sbDone?"âœ“":(si+1)+String.fromCharCode(97+sbi)}</div>
                                                  <div style={{flex:1,minWidth:0}}>
                                                    <div style={{fontSize:13,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.text,lineHeight:1.5,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.t)}</div>
                                                    {sb.i&&<div style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.i)}</div>}
                                                    {sbStarted&&!sbDone&&sb.tm>0&&<div style={{marginTop:4}}><div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,sbPct)+"%",background:sbOver?C.red:C.amber,borderRadius:3,transition:"width 1s"}}/></div>{sbOver?<div style={{fontSize:12,color:C.red,fontWeight:700,marginTop:3}}>â± {T2("Overdue")} â€” {T2("tap Done")}</div>:<div style={{fontSize:12,color:C.amber,marginTop:3}}>â± {Math.floor(sbEl/60)}m {sbEl%60}s â€” {Math.floor(sbRem/60)}m left</div>}</div>}
                                                    {sbDone&&sbHasDoneEl&&<div style={{fontSize:12,marginTop:3,color:sbWasOver?C.red:C.green}}>âœ… {Math.floor(sbDE/60)}m{sbDE%60>0?` ${sbDE%60}s`:""}{sbWasOver?<span style={{fontWeight:600}}> ðŸ”´ +{Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s over</span>:<span style={{fontWeight:600}}> ðŸŸ¢ {Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s under</span>}{d2d.manualAt?.[sbk]&&<span style={{color:C.muted,fontWeight:400}}> Â· {d2d.manualAt[sbk]}</span>}</div>}
                                                    {sbDone&&!sbHasDoneEl&&d2d.manualAt?.[sbk]&&<div style={{fontSize:12,color:C.green,marginTop:3}}>âœ… {d2d.manualAt[sbk]}</div>}
                                                    {!sbDone&&!sbStarted&&sb.tm>0&&<div style={{fontSize:12,color:C.faint,marginTop:3}}>â± {sb.tm>=60?Math.floor(sb.tm/60)+"m":sb.tm+"s"}</div>}
                                                  </div>
                                                  <div style={{flexShrink:0}}>
                                                    {!sbDone&&sbPrevD&&!sbStarted&&sb.tm>0&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{starts:{...(d2d.starts||{}),[sbk]:Date.now()}},dish);}} style={{padding:"8px 16px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>â–¶ {Math.floor(sb.tm/60)}m</button>}
                                                    {!sbDone&&sbPrevD&&!sbStarted&&!sb.tm&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:fmtStamp()}};if(sbi===step.subs.length-1){upd.doneElapsed={...(d2d.doneElapsed||{}),[sk]:d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0};}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>âœ“ {T2("Done")}</button>}
                                                    {!sbDone&&sbStarted&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sbk]?Math.floor((Date.now()-d2d.starts[sbk])/1000):0;const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sbk]:el}};if(sbi===step.subs.length-1){upd.doneElapsed[sk]=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"8px 16px",borderRadius:10,background:sbOver?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>{sbOver?"âš ":"âœ“"} {T2("Done")}</button>}
                                                    
                                                    {sbDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sbk]:false},starts:{...(d2d.starts||{}),[sbk]:null}},dish);}} style={{padding:"4px 8px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:10,cursor:"pointer"}}>â†©</button>}
                                                  </div>
                                                </div>
                                              </div>);
                                          })}
                                        </div>
                                      )}
                                    </div>);})}
                                  {(()=>{if(isDone)return(<div style={{padding:"12px 0",textAlign:"center"}}><div style={{fontSize:14,color:C.green,fontWeight:700}}>âœ… {T2("Prep complete")}{d2s.dishCompletedAt?" â€” "+fmtStamp(d2s.dishCompletedAt):""}</div></div>);const allSD=ssDone&&steps.every((step,si)=>{const sk="step_"+si;const hs=Array.isArray(step.subs)&&step.subs.length>0;if(hs)return step.subs.every((_,sbi)=>!!(d2s.manual&&d2s.manual[sk+"_sub_"+sbi]));return !!(d2s.manual&&d2s.manual[sk]);});if(!allSD)return(<div style={{padding:"12px 0",textAlign:"center"}}><div style={{padding:"14px",borderRadius:12,background:C.faint+"30",border:"1.5px dashed "+C.border,color:C.muted,fontSize:14}}>ðŸ”’ {T2("Complete all steps to mark prep done")}</div></div>);const elapsed=d2s.dishStartedAt?Math.floor((Date.now()-d2s.dishStartedAt)/60000):0;return(<div>{elapsed>0&&<div style={{fontSize:13,color:C.muted,textAlign:"center",marginBottom:6}}>â± {T2("Total time")}: {elapsed} min</div>}<button onClick={e=>{e.stopPropagation();openUsageModal(dish,dish.totalPax,true,()=>{setDs(dish.fEvId,dish.fIdx,{mesaDone:true,dishCompletedAt:Date.now()},dish);});}} style={{width:"100%",padding:"16px",borderRadius:12,background:C.green,color:"#fff",border:"none",fontSize:18,fontWeight:700,cursor:"pointer",minHeight:56}}>âœ… {T2("Mark prep done")} â€” {dish.totalPax} pax</button></div>);})()}
                                </div>);})()}
                            
                          </div>);
                      })}
                    </div>}
                  </div>);})
            ) : (
            /* â•â•â• ADMIN VIEW â€” compact â•â•â• */
            allSecs.map(sec=>{
              const secItems = bySecD1[sec]||[];
              const catObj = RECIPE_DB.cats.find(c=>c.id===sec);
              const secDisplayName = catObj ? catObj.name : sec;
              const m2 = {color:catObj?.color||C.muted,icon:catObj?.icon||"ðŸ½"};
              const displayIcon = catObj?.icon || "ðŸ½";
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
                      <span style={{fontSize:14,color:C.faint,transform:secOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>â–¾</span>
                    </div>
                  </div>
                  {secOpen&&<div style={{padding:"8px 12px"}}>
                    {secItems.map(dish=>{
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
                                <div style={{width:18,height:18,borderRadius:5,background:isDone?C.green:C.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isDone&&<span style={{fontSize:9,fontWeight:700,color:"#fff"}}>âœ“</span>}</div>
                                <div><div style={{fontSize:12,fontWeight:700,color:isDone?C.green:C.text,textDecoration:isDone?"line-through":"none"}}>{dishName}</div><div style={{fontSize:10,color:C.faint}}>{dish.totalPax} pax Â· {d1Label}</div></div>
                              </div>
                              <span style={{fontSize:12,color:C.muted}}>{isExp?"â–¼":"â–¶"}</span>
                            </div>
                          </div>

                          {isExp&&(()=>{
                            const d2s=ds(dish.fEvId,dish.fIdx,dish.name);
                            const ssStarted=!!d2s.storeStart;const ssDone=!!d2s.storeEnd;
                            const ssEl=ssStarted&&!ssDone?Math.floor((Date.now()-(d2s.storeStart||0))/1000):0;
                            const ssRem=Math.max(0,1800-ssEl);const ssPct=ssStarted?Math.min(100,Math.round(ssEl/1800*100)):0;
                            return(
                              <div style={{padding:"8px 12px",borderRadius:"0 0 10px 10px",background:C.surface,border:`1px solid ${C.border}`,borderTop:"none"}}>
                                <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>ðŸ“‹ {T2("Steps")} â€” {steps.length}</div>
                                <div style={{padding:12,marginBottom:10,borderRadius:10,border:`2px solid ${ssDone?C.greenBorder:ssStarted?C.amberBorder:C.border}`,background:ssDone?C.greenBg:ssStarted?C.amberBg:C.surface}}>
                                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                                    <div style={{width:32,height:32,borderRadius:8,background:ssDone?C.green:ssStarted?C.amber:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>{ssDone?"âœ“":"0"}</div>
                                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:ssDone?C.green:ssStarted?C.amber:C.text}}>ðŸª Collect Items from Store</div><div style={{fontSize:11,color:C.muted}}>30 min stoppable timer â€” collect all ingredients</div></div>
                                  </div>
                                  {ssStarted&&!ssDone&&<div style={{marginTop:8}}><div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:ssPct+"%",background:C.amber,borderRadius:3,transition:"width 1s"}}/></div><div style={{fontSize:11,color:C.amber,fontWeight:700,marginTop:3}}>â± {Math.floor(ssEl/60)}m {ssEl%60}s / 30m â€” {Math.floor(ssRem/60)}m left</div></div>}
                                  {!ssStarted&&!ssDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeStart:Date.now()},dish)} style={{padding:"10px 16px",borderRadius:8,width:"100%",background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40,marginTop:8}}>ðŸƒ Go Collect Items â€” Start 30 min Timer</button>}
                                  {ssStarted&&!ssDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeEnd:Date.now()},dish)} style={{padding:"10px 16px",borderRadius:8,width:"100%",background:`linear-gradient(135deg,${C.green},#147A54)`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40,marginTop:6}}>â¹ Done â€” Items Collected</button>}
                                  {ssDone&&<div style={{fontSize:12,color:C.green,fontWeight:700,marginTop:6}}>âœ… Store sourcing complete â€” ready to cook</div>}
                                </div>
                                {(()=>{const pax=dish.totalPax||0;const {ing,effKg,warn,planned}=getScaledIngredients(dishName,dish.fEvId);if(!ing||ing.length===0)return null;const yieldLbl=effKg?`${T2("target")} ${effKg.toFixed(1).replace(/\.0$/,"")} kg`:`${pax} pax`;return(
                                  <div style={{background:C.bg,borderRadius:8,padding:"8px 12px",marginBottom:8,border:`1px solid ${warn?C.redBorder:C.border}`,position:"sticky",top:0,zIndex:5}}>
                                    {warn==='no_base_yield'&&<div style={{fontSize:9,fontWeight:700,color:C.red,marginBottom:5,padding:"3px 6px",background:C.redBg,borderRadius:5,border:`1px solid ${C.redBorder}`}}>âš  {T2("Missing base_yield in SOP")}</div>}
                                    <div style={{fontSize:11,fontWeight:700,color:ssDone?C.green:C.gold,marginBottom:5}}>{ssDone?"ðŸ“Š":"ðŸ§º"} {ssDone?T2("Ingredients"):T2("Items to collect")} â€” {yieldLbl}{planned?` Â· ${T2("planned")}`:effKg?` Â· ${T2("auto")}`:""}</div>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:"3px 10px"}}>{ing.filter(i=>i.q>0).map((i,ii)=>{const raw=i.q;const qty=i.u==="g"||i.u==="gm"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g"):i.u==="ml"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml"):i.u==="pcs"?Math.ceil(raw)+" pcs":i.u==="kg"?(raw.toFixed(1).replace(/\.0$/,""))+" kg":i.u==="L"?(raw.toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" "+i.u;return <span key={ii} style={{fontSize:11,color:C.text}}>{i.n}: <b style={{color:C.gold}}>{qty}</b></span>;})}</div>
                                  </div>);})()}
                                {steps.map((step,si)=>{const d2d=ds(dish.fEvId,dish.fIdx,dish.name);const sk="step_"+si;const hasSubs=Array.isArray(step.subs)&&step.subs.length>0;
                                    const subsDone=hasSubs?step.subs.every((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])):false;
                                    const stS=!!(d2d.starts&&d2d.starts[sk]);const stM=hasSubs?subsDone:!!(d2d.manual&&d2d.manual[sk]);const stDone=stM;
                                    const stEl=stS?Math.floor((Date.now()-(d2d.starts[sk]||Date.now()))/1000):0;const stOverdue=stS&&step.tm&&stEl>=step.tm&&!stDone;const stRem=step.tm?Math.max(0,step.tm-stEl):0;const stPct2=step.tm>0?Math.min(100,Math.round(stEl/step.tm*100)):0;const pk="step_"+(si-1);
                                    const prevStepHasSubs=si>0&&Array.isArray(steps[si-1].subs)&&steps[si-1].subs.length>0;
                                    const prevD=true;
                                    return(
                                  <div key={si} style={{padding:"8px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",...(step.ccp&&!stDone?{background:C.redBg,borderLeft:`3px solid ${C.red}`,marginLeft:-8,paddingLeft:8,borderRadius:4}:{})}}>
                                    <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                                    <div style={{width:26,height:26,borderRadius:7,background:stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.darkCard,border:`2px solid ${stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:stDone||stS?"#fff":step.ccp?"#fff":C.muted,flexShrink:0,marginTop:2}}>{stDone?"âœ“":si+1}</div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,fontWeight:600,color:stDone?C.green:stS?C.amber:C.text,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(step.t)}{hasSubs&&!stDone&&<span style={{fontSize:10,color:C.muted,marginLeft:6}}>({step.subs.filter((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])).length}/{step.subs.length})</span>}</div>
                                      {(()=>{const d2=cleanStepText(step.i||step.desc||"");const t2=cleanStepText(step.t);if(!d2||t2.includes(d2)||d2.includes(t2))return null;return <div style={{fontSize:11,color:C.muted,marginTop:1}}>{d2}</div>;})()}
                                      {step.ccp&&<div style={{fontSize:10,color:C.red,marginTop:2}}>ðŸ”´ {cleanStepText(step.ccp)}</div>}
                                      {!hasSubs&&stS&&!stDone&&step.tm>0&&<div style={{marginTop:4}}><div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,stPct2)+"%",background:stOverdue?C.red:C.amber,borderRadius:2,transition:"width 1s"}}/></div>{stOverdue?<div style={{fontSize:10,color:C.red,fontWeight:700,marginTop:2}}>â± Overdue â€” tap Done</div>:<div style={{fontSize:10,color:C.amber,marginTop:2}}>â± {Math.floor(stEl/60)}m {stEl%60}s â€” {Math.floor(stRem/60)}m left</div>}</div>}
                                      {!hasSubs&&stDone&&(()=>{const de=d2d.doneElapsed?.[sk];if(de==null||!step.tm){return <div style={{fontSize:10,color:C.green,marginTop:2}}>âœ… done</div>;}const ov=de>step.tm;const un=de<step.tm;const df=Math.abs(de-step.tm);const dm=Math.floor(df/60);const dss=df%60;return <div style={{fontSize:10,color:ov?C.red:C.green,marginTop:2}}>âœ… {Math.floor(de/60)}m{de%60>0?` ${de%60}s`:""} done{ov?<span style={{color:C.red,fontWeight:600}}> ðŸ”´ +{dm>0?dm+"m ":""}{dss}s over</span>:un&&df>0?<span style={{color:C.green,fontWeight:600}}> ðŸŸ¢ {dm>0?dm+"m ":""}{dss}s under</span>:""}</div>;})()}
                                      {hasSubs&&stDone&&<div style={{fontSize:10,color:C.green,marginTop:2}}>âœ… all sub-steps done</div>}
                                      {!hasSubs&&!stS&&!stDone&&step.tm>0&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>â± {fmtT(step.tm)}</div>}
                                    </div>
                                    <div style={{flexShrink:0}}>
                                      {!hasSubs&&stS&&!stDone&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sk]:el}},dish);}} style={{padding:"6px 10px",borderRadius:8,background:stOverdue?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",minHeight:32}}>{stOverdue?"âš ":"âœ“"} Done</button>}
                                      {!hasSubs&&!stS&&!stDone&&step.tm>0&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={starts:{...(d2d.starts||{}),[sk]:Date.now()}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 10px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",minHeight:32}}>â–¶ {Math.floor(step.tm/60)}m</button>}
                                      {!hasSubs&&!stS&&!stDone&&!step.tm&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:fmtStamp()}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 10px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:10,fontWeight:600,cursor:"pointer",minHeight:32}}>âœ“</button>}
                                      {hasSubs&&!stDone&&<span style={{fontSize:10,color:C.muted}}>â†“</span>}
                                      
                                      {stDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:false},starts:{...(d2d.starts||{}),[sk]:null}},dish);}} style={{padding:"4px 8px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:10,cursor:"pointer"}}>â†©</button>}
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
                                                <div style={{width:24,height:24,borderRadius:6,background:sbDone?C.green+"20":sbStarted?(sbOver?C.red+"20":C.amber+"20"):C.darkCard,border:`1.5px solid ${sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.muted,flexShrink:0,marginTop:1}}>{sbDone?"âœ“":(si+1)+String.fromCharCode(97+sbi)}</div>
                                                <div style={{flex:1,minWidth:0}}>
                                                  <div style={{fontSize:12,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.text,lineHeight:1.5,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.t)}</div>
                                                  {sb.i&&<div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.i)}</div>}
                                                  {sbStarted&&!sbDone&&sb.tm>0&&<div style={{marginTop:3}}><div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,sbPct)+"%",background:sbOver?C.red:C.amber,borderRadius:2,transition:"width 1s"}}/></div>{sbOver?<div style={{fontSize:10,color:C.red,fontWeight:700,marginTop:2}}>â± Overdue â€” tap Done</div>:<div style={{fontSize:10,color:C.amber,marginTop:2}}>â± {Math.floor(sbEl/60)}m {sbEl%60}s â€” {Math.floor(sbRem/60)}m left</div>}</div>}
                                                  {sbDone&&sbHasDoneEl&&<div style={{fontSize:10,marginTop:2,color:sbWasOver?C.red:C.green}}>âœ… {Math.floor(sbDE/60)}m{sbDE%60>0?` ${sbDE%60}s`:""}{sbWasOver?<span style={{fontWeight:600}}> ðŸ”´ +{Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s over</span>:<span style={{fontWeight:600}}> ðŸŸ¢ {Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s under</span>}{d2d.manualAt?.[sbk]&&<span style={{color:C.muted,fontWeight:400}}> Â· {d2d.manualAt[sbk]}</span>}</div>}
                                                  {sbDone&&!sbHasDoneEl&&d2d.manualAt?.[sbk]&&<div style={{fontSize:10,color:C.green,marginTop:2}}>âœ… {d2d.manualAt[sbk]}</div>}
                                                  {!sbDone&&!sbStarted&&sb.tm>0&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>â± {sb.tm>=60?Math.floor(sb.tm/60)+"m":sb.tm+"s"}</div>}
                                                </div>
                                                <div style={{flexShrink:0}}>
                                                  {!sbDone&&sbPrevD&&!sbStarted&&sb.tm>0&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{starts:{...(d2d.starts||{}),[sbk]:Date.now()}},dish);}} style={{padding:"6px 12px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>â–¶ {Math.floor(sb.tm/60)}m</button>}
                                                  {!sbDone&&sbPrevD&&!sbStarted&&!sb.tm&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:fmtStamp()}};if(sbi===step.subs.length-1){upd.doneElapsed={...(d2d.doneElapsed||{}),[sk]:d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0};}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 12px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>âœ“ {T2("Done")}</button>}
                                                  {!sbDone&&sbStarted&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sbk]?Math.floor((Date.now()-d2d.starts[sbk])/1000):0;const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:fmtStamp()},doneElapsed:{...(d2d.doneElapsed||{}),[sbk]:el}};if(sbi===step.subs.length-1){upd.doneElapsed[sk]=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 12px",borderRadius:8,background:sbOver?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>{sbOver?"âš ":"âœ“"} {T2("Done")}</button>}
                                                  
                                                  {sbDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sbk]:false},starts:{...(d2d.starts||{}),[sbk]:null}},dish);}} style={{padding:"3px 6px",borderRadius:5,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:9,cursor:"pointer"}}>â†©</button>}
                                                </div>
                                              </div>
                                            </div>);
                                        })}
                                      </div>
                                    )}
                                  </div>);})}
                                {(()=>{const d2f=ds(dish.fEvId,dish.fIdx,dish.name);const elapsed=d2f.dishStartedAt?Math.floor((Date.now()-d2f.dishStartedAt)/60000):0;return(<div>{elapsed>0&&<div style={{fontSize:10,color:C.muted,textAlign:"center",marginBottom:4}}>â± {T2("Total time")}: {elapsed} min</div>}<button onClick={e=>{e.stopPropagation();openUsageModal(dish,dish.totalPax,true,()=>{setDs(dish.fEvId,dish.fIdx,{mesaDone:true,dishCompletedAt:Date.now()},dish);});}} style={{width:"100%",padding:"10px",borderRadius:8,background:C.green,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>âœ… {T2("Mark prep done")} â€” {dish.totalPax} pax</button></div>);})()}
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

      {/* â•â•â• CLOSING TAB â€” production_closings â•â•â• */}
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
            const cat = RECIPE_DB.cats.find(c=>c.id===cid) || {id:cid, name:cid==='__unmapped'?'Unmapped':cid, icon:'ðŸ½'};
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
            {/* Header */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:18,fontWeight:500,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>ðŸ² {T2("Event Closing")}</div>
              <div style={{fontSize:12,color:C.muted}}>{T2("Record leftover quantities per dish after the event. Toggle â›” to keep this event's leftovers out of future order suggestions.")}</div>
            </div>

            {/* Calendar picker */}
            <div style={{borderRadius:12,border:`1px solid ${C.border}`,background:C.surface,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={prevMo} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:14,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>â€¹</button>
                  <div style={{fontSize:15,fontWeight:600,color:C.text,minWidth:140,textAlign:"center"}}>{MO_N[closeCalMo]} {closeCalYr}</div>
                  <button onClick={nextMo} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:14,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>â€º</button>
                </div>
                <button onClick={()=>{setCloseCalYr(new Date().getFullYear());setCloseCalMo(new Date().getMonth());setCloseSelDate(todayS);setCloseEventId(null);}} style={{padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:11,fontWeight:500,cursor:"pointer"}}>Today</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                {DY.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:600,color:C.muted,padding:"6px 0",background:C.bg}}>{d}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                {cells.map((cell,i)=>{
                  const dt = cDate(cell);
                  const evs = dt?eod(dt):[];
                  const isT = dt===todayS;
                  const isS = dt===selDate;
                  const isFuture = dt && dt > todayS;
                  const clickable = dt && !isFuture;
                  return(
                    <div key={i} onClick={()=>{if(!clickable)return;setCloseSelDate(dt);setCloseEventId(null);}}
                      style={{height:52,padding:"5px 6px",cursor:clickable?"pointer":"default",
                        borderBottom:`1px solid ${C.borderLight}`,borderRight:(i%7)<6?`1px solid ${C.borderLight}`:"none",
                        background:isS?C.goldBg:isT?"#FAEEDA":"transparent",opacity:cell.c&&!isFuture?1:.35}}>
                      <div style={{fontSize:12,fontWeight:isT||isS?600:400,color:isS?C.gold:isT?"#BA7517":C.text}}>{cell.d}</div>
                      {evs.length>0 && !isFuture && <div style={{display:"flex",gap:2,marginTop:2}}>{evs.slice(0,4).map((ev,ci)=><div key={ci} style={{width:6,height:6,borderRadius:"50%",background:anaGp(ev.venue).c||C.muted}}/>)}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:10,padding:"6px 14px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                {Object.entries(ANA_VP).map(([v,p])=><div key={v} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:6,height:6,borderRadius:"50%",background:p.c}}/><span style={{fontSize:10,color:C.muted}}>{p.code}</span></div>)}
              </div>
            </div>

            {/* Events on selected date */}
            {selDate && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{fmtDate(selDate)} Â· {dateEvs.length} event{dateEvs.length!==1?"s":""}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {dateEvs.map(ev=>{
                    const isSel = closeEventId===ev.id;
                    const mc = menuArr(ev).length;
                    const vc = anaGp(ev.venue);
                    return (
                      <button key={ev.id} onClick={()=>setCloseEventId(ev.id)} style={{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:isSel?700:400,cursor:"pointer",background:isSel?vc.c:"transparent",color:isSel?"#fff":C.muted,border:`1.5px solid ${isSel?vc.c:C.border}`,minHeight:40,textAlign:"left",borderLeft:`3px solid ${vc.c}`}}>
                        <div style={{fontWeight:600}}>{ev.guest||"Function"}</div>
                        <div style={{fontSize:10,opacity:.8}}>{ev.pax} pax Â· {mc} dishes{ev.venue?" Â· "+ev.venue:""}</div>
                      </button>
                    );
                  })}
                  {dateEvs.length===0 && <div style={{padding:"12px",fontSize:12,color:C.faint}}>No events on this date</div>}
                </div>
              </div>
            )}

            {!selEv && (
              <Card style={{padding:"24px 20px",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:8}}>ðŸ‘†</div>
                <div style={{fontSize:12,color:C.muted}}>{T2("Select an event above to record its closing")}</div>
              </Card>
            )}

            {selEv && (<>
              {/* Event summary + event-level exclude toggle */}
              <Card style={{marginBottom:12,padding:"12px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:C.text}}>{selEv.guest||"Function"}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtDate(selEv.date)}{selEv.time?" Â· "+fmtTime(selEv.time):""}{selEv.venue?" Â· "+selEv.venue:""} Â· {selEv.pax} pax Â· {filteredDishes.length}{allowedCats?"/"+evDishes.length:""} {T2("dishes")}</div>
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:11,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{color:closedCount===filteredDishes.length&&filteredDishes.length>0?C.green:C.gold,fontWeight:700}}>âœ“ {closedCount}/{filteredDishes.length} {T2("closed")}</span>
                    {totalLeftoverKg>0 && <span style={{color:C.amber,fontWeight:600}}>ðŸ“¦ {fmtKg(totalLeftoverKg)} kg {T2("leftover")}</span>}
                  </div>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:closeExcludeUI?C.amberBg:C.bg,border:`1.5px solid ${closeExcludeUI?C.amberBorder:C.border}`,cursor:"pointer"}}>
                  <input type="checkbox" checked={closeExcludeUI} onChange={e=>toggleEventExclude(e.target.checked, ctx)} style={{width:18,height:18,accentColor:C.amber,cursor:"pointer"}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:closeExcludeUI?C.amber:C.text}}>â›” {T2("Don't affect future ordering")}</div>
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
                    <button onClick={()=>setCloseSectionOpen(p=>({...p,[group.cat.id]:!p[group.cat.id]}))}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:8,background:(group.cat.color||C.muted)+"14",borderLeft:`3px solid ${group.cat.color||C.muted}`,borderTop:"none",borderRight:"none",borderBottom:"none",cursor:"pointer",textAlign:"left"}}>
                      <span style={{fontSize:12,color:group.cat.color||C.muted,transition:"transform 0.15s",transform:isOpen?"rotate(90deg)":"rotate(0)",display:"inline-block"}}>â–¸</span>
                      <span style={{fontSize:18}}>{group.cat.icon||"ðŸ½"}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:group.cat.color||C.text}}>{group.cat.name||group.cat.id}</div>
                        <div style={{fontSize:10,color:C.muted}}>{group.items.length} {T2("dishes")}{secClosed>0?` Â· ${secClosed} ${T2("closed")}`:""}</div>
                      </div>
                    </button>
                    {isOpen && group.items.map(dish=>{
                      const row = closeRows[dish];
                      const planKg = evPlanRows[closeEventId]?.[dish]?.target_yield_kg || null;
                      const lkg = row?.leftover_kg;
                      const lpcs = row?.leftover_pcs;
                      const notes = row?.notes || "";
                      const isSaving = closeSaving.has(dish);
                      const isClosed = !!row;
                      return(
                        <div key={dish} style={{marginTop:6,marginLeft:8,borderRadius:10,border:`1px solid ${isClosed?C.greenBorder:C.border}`,background:isClosed?C.greenBg:C.surface,overflow:"hidden"}}>
                          <div style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            <div style={{flex:1,minWidth:180}}>
                              <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{dish}</div>
                              {planKg && <div style={{fontSize:10,color:C.purple,marginTop:2,fontWeight:600}}>ðŸ“‹ {T2("Planned")}: {planKg} kg</div>}
                            </div>
                            <div style={{fontSize:10,color:isSaving?C.amber:isClosed?C.green:C.faint,fontWeight:600}}>{isSaving?"ðŸ’¾ "+T2("Saving..."):isClosed?"âœ“ "+T2("Closed"):""}</div>
                          </div>
                          <div style={{padding:"0 14px 12px",display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                            <div>
                              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{T2("Leftover kg")}</div>
                              <input type="number" step="0.1" inputMode="decimal"
                                defaultValue={lkg??""}
                                key={"lkg-"+dish+"-"+(row?.id||"new")}
                                onBlur={e=>saveClosing(dish, {leftover_kg:e.target.value}, ctx)}
                                placeholder="0"
                                style={{width:100,padding:"8px 10px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontWeight:700,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:38}}/>
                            </div>
                            <div>
                              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{T2("Pcs (opt.)")}</div>
                              <input type="number" step="1" inputMode="numeric"
                                defaultValue={lpcs??""}
                                key={"lpcs-"+dish+"-"+(row?.id||"new")}
                                onBlur={e=>saveClosing(dish, {leftover_pcs:e.target.value}, ctx)}
                                placeholder="0"
                                style={{width:80,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:38}}/>
                            </div>
                            <div style={{flex:1,minWidth:180}}>
                              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{T2("Notes")}</div>
                              <input type="text"
                                defaultValue={notes}
                                key={"nts-"+dish+"-"+(row?.id||"new")}
                                onBlur={e=>saveClosing(dish, {notes:e.target.value}, ctx)}
                                placeholder={T2("optional")}
                                style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:38}}/>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div style={{marginTop:20,padding:"10px 14px",borderRadius:8,background:C.bg,fontSize:10,color:C.faint,textAlign:"center"}}>
                {T2("Auto-saves on blur. The â›” flag will be honored once order-suggestion is wired to this data.")}
              </div>
            </>)}
          </div>
        );
      })()}

      {/* â•â•â• PLANNING TAB â€” production_plans (Phase 4) â•â•â• */}
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
        // â€” same resolver Menu Packages uses, so mappings shown there apply here too.
        function dishStatus(lmsName) {
          const found = findRecipeForDish(lmsName);
          if(!found) return { state:"missing", color:C.red, catId:null, baseYield:null };
          const catId = found.cat?.id || null;
          const y = found.ingredients?.base_yield?.kg;
          const baseYield = (typeof y==="number" && y>0) ? y : null;
          return { state:baseYield?"ready":"noyield", color:baseYield?C.green:C.amber, recipe:found, catId, baseYield };
        }

        // On-blur handler: save only if changed.
        function onYieldBlur(dish, rowCtx){
          const draft = planDrafts[dish];
          if(draft===undefined) return;
          const draftStr = String(draft).trim();
          const savedStr = String(planRows[dish]?.target_yield_kg ?? "");
          if(draftStr === savedStr) return;
          savePlanYield(dish, draft, rowCtx);
        }

        // Group dishes by section (RECIPE_DB.cats order), unmapped last
        const grouped = new Map();
        const unmapped = [];
        dishes.forEach((dish,idx)=>{
          const st = dishStatus(dish);
          if(!st.catId){ unmapped.push({dish,st,idx}); return; }
          if(!grouped.has(st.catId)){
            const cat = RECIPE_DB.cats.find(c=>c.id===st.catId) || {id:st.catId,name:st.catId,icon:"ðŸ½"};
            grouped.set(st.catId,{cat,items:[]});
          }
          grouped.get(st.catId).items.push({dish,st,idx});
        });
        const orderedGroups = RECIPE_DB.cats
          .filter(c=>grouped.has(c.id))
          .map(c=>grouped.get(c.id));

        // Plan-based stats (recomputed on planRows change)
        const stats = dishes.reduce((acc,d)=>{
          const st = dishStatus(d);
          if(!st.catId) acc.missing++;
          else if(planRows[d]) acc.planned++;
          else acc.pending++;
          return acc;
        },{planned:0,pending:0,missing:0});

        return(
          <div>
            {/* Header */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:600,color:C.text}}>ðŸ“‹ {T2("Production Planning")}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{T2("Pick a date, then an event. Enter target yield (kg) per dish. Auto-saves as draft on blur.")}</div>
            </div>

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
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <button onClick={prevMo} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:14,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>â€¹</button>
                      <div style={{fontSize:15,fontWeight:600,color:C.text,minWidth:160,textAlign:"center"}}>{MO_FULL[planCalMo]} {planCalYr}</div>
                      <button onClick={nextMo} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:14,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>â€º</button>
                    </div>
                    <button onClick={()=>{const t=new Date();setPlanCalYr(t.getFullYear());setPlanCalMo(t.getMonth());setPlanSelDate(TODAY);setPlanEvId(null);}} style={{padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:11,fontWeight:500,cursor:"pointer"}}>{T2("Today")}</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                    {DY_NAMES.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:600,color:C.muted,padding:"6px 0",background:C.bg}}>{d}</div>)}
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
                          style={{height:56,padding:"5px 6px",cursor:dt?"pointer":"default",
                            borderBottom:`1px solid ${C.borderLight}`,borderRight:(i%7)<6?`1px solid ${C.borderLight}`:"none",
                            background:isSel?C.goldBg:isToday?"#FAEEDA":"transparent",opacity:cell.c?1:.2}}>
                          <div style={{fontSize:12,fontWeight:isToday||isSel?600:400,color:isSel?C.gold:isToday?"#BA7517":C.text}}>{cell.d}</div>
                          {vCols.length>0&&<div style={{display:"flex",gap:2,marginTop:3}}>{vCols.slice(0,4).map((col,ci)=><div key={ci} style={{width:6,height:6,borderRadius:"50%",background:col}}/>)}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:12,padding:"8px 16px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                    {Object.entries(ANA_VP).map(([v,p])=><div key={v} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:6,height:6,borderRadius:"50%",background:p.c}}/><span style={{fontSize:10,color:C.muted}}>{p.code}</span></div>)}
                  </div>
                </div>
              );
            })()}

            {/* Selected date â†’ event cards */}
            {planSelDate && (()=>{
              const dateEvs = upcomingEvs.filter(e=>e.date===planSelDate);
              if(dateEvs.length===0) return(
                <div style={{padding:"14px 16px",borderRadius:10,border:`1px dashed ${C.border}`,background:C.bg,fontSize:12,color:C.faint,marginBottom:16,textAlign:"center"}}>
                  {T2("No upcoming events on")} {fmtDate(planSelDate)}
                </div>
              );
              return(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>
                    {fmtDate(planSelDate)} Â· {dateEvs.length} {T2("event")}{dateEvs.length!==1?"s":""}
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {dateEvs.map(ev=>{
                      const isSel = planEvId===ev.id;
                      const vc = anaGp(ev.venue);
                      const mc = menuArr(ev).length;
                      return(
                        <button key={ev.id} onClick={()=>setPlanEvId(isSel?null:ev.id)}
                          style={{padding:"10px 14px",borderRadius:10,fontSize:12,fontWeight:isSel?600:400,cursor:"pointer",
                            background:isSel?vc.c:"transparent",color:isSel?"#fff":C.text,
                            border:`1.5px solid ${isSel?vc.c:C.border}`,minHeight:44,textAlign:"left",borderLeft:`3px solid ${vc.c}`}}>
                          <div style={{fontWeight:600}}>{ev.guest||"Function"}</div>
                          <div style={{fontSize:10,opacity:.85,marginTop:2}}>{fmtTime(ev.time)||"â€”"} Â· {ev.pax} pax Â· {mc} dishes Â· {ev.venue||""}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Selected event summary + grouped dish list */}
            {selEv && (()=>{
              const vc = anaGp(selEv.venue);
              return(
              <div>
                {/* Event summary card */}
                <div style={{padding:"12px 14px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,borderLeft:`4px solid ${vc.c}`,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:C.text}}>{selEv.guest||"Function"}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtDate(selEv.date)}{selEv.time?" Â· "+fmtTime(selEv.time):""} Â· {selEv.venue||""} Â· {selEv.pax} pax Â· {dishes.length} dishes</div>
                  </div>
                  <div style={{display:"flex",gap:10,fontSize:11,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{color:C.green,fontWeight:600}}>ðŸ“‹ {stats.planned} {T2("planned")}</span>
                    <span style={{color:C.amber,fontWeight:600}}>â³ {stats.pending} {T2("pending")}</span>
                    <span style={{color:C.red,fontWeight:600}}>âŒ {stats.missing} {T2("unmapped")}</span>
                    {planLoading && <span style={{color:C.muted,fontStyle:"italic",fontSize:10}}>{T2("Loading...")}</span>}
                  </div>
                </div>

                {/* Global yield adjustment slider (Phase 3: merged from Scaling tab; saves to events.yield_multiplier per event) */}
                {dishes.length>0 && (()=>{
                  const plannedKgTotal = dishes.reduce((s,d)=>s+(Number(planRows[d]?.target_yield_kg)||0),0);
                  const adjustedTotal = Math.round(plannedKgTotal * yieldAdjustPct/100 * 10)/10;
                  return(
                  <Card style={{marginBottom:12,padding:"14px 16px",border:`1px solid ${C.purpleBorder}`,background:C.purpleBg}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:.6}}>âš–ï¸ {T2("Yield adjustment")}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:2}}>{T2("Uniform multiplier over every planned yield for this event. 100% = exactly as planned.")}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                        <div style={{fontSize:28,fontWeight:800,color:C.purple,lineHeight:1}}>{yieldAdjustPct}</div>
                        <div style={{fontSize:14,fontWeight:700,color:C.purple}}>%</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                      {[50,75,90,100,110,125,150].map(p=>(
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
                      style={{width:"100%",accentColor:C.purple,height:6,cursor:"pointer"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.faint,marginTop:2}}>
                      <span>50%</span><span style={{color:C.purple,fontWeight:700}}>100%</span><span>200%</span>
                    </div>
                    {plannedKgTotal>0 && (
                      <div style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:C.bg,fontSize:11,color:C.muted,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span>{T2("Total planned:")}</span>
                        <b style={{color:C.text}}>{fmtKg(plannedKgTotal)} kg</b>
                        {yieldAdjustPct!==100 && (<>
                          <span style={{color:C.faint}}>â†’</span>
                          <b style={{color:C.purple}}>{fmtKg(adjustedTotal)} kg</b>
                          <span style={{fontSize:10,color:C.faint}}>({yieldAdjustPct}%)</span>
                        </>)}
                      </div>
                    )}
                    <div style={{marginTop:8,fontSize:10,color:C.faint,textAlign:"center"}}>{T2("Auto-saves to event on change. Applies to Event Day and Prep Day ingredient calculations.")}</div>
                  </Card>);
                })()}

                {dishes.length===0 && (
                  <div style={{padding:"24px",textAlign:"center",fontSize:12,color:C.faint,borderRadius:10,border:`1px dashed ${C.border}`}}>{T2("No menu confirmed for this event")}</div>
                )}

                {/* Grouped sections */}
                {orderedGroups.map(g=>{
                  const plannedInGroup = g.items.filter(it=>planRows[it.dish]).length;
                  return(
                    <div key={g.cat.id} style={{marginBottom:10,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,overflow:"hidden"}}>
                      <div style={{padding:"8px 12px",background:C.bg,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{fontSize:12,fontWeight:600,color:C.text,display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>{g.cat.icon}</span>
                          <span>{g.cat.name}</span>
                          <span style={{fontSize:10,color:C.muted,fontWeight:400}}>({g.items.length})</span>
                        </div>
                        <div style={{fontSize:10,color:plannedInGroup===g.items.length?C.green:C.muted,fontWeight:500}}>
                          {plannedInGroup}/{g.items.length} {T2("planned")}
                        </div>
                      </div>
                      <div>
                        {g.items.map((it,i)=>{
                          const st = it.st;
                          const mappedName = st.recipe && st.recipe.n && st.recipe.n.toLowerCase()!==(it.dish||"").toLowerCase().trim() ? st.recipe.n : null;
                          const suggested = st.baseYield ? Math.round(selEv.pax/300 * st.baseYield * 10)/10 : null;
                          const currentVal = planDrafts[it.dish] ?? (planRows[it.dish]?.target_yield_kg ?? "");
                          const isSaving = planSaving.has(it.dish);
                          const isSaved = !!planRows[it.dish];
                          const rowCtx = {...ctx, recipe:st.recipe};
                          return(
                            <div key={i} style={{padding:"10px 12px",borderBottom:i<g.items.length-1?`1px solid ${C.borderLight}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                              <div style={{flex:"1 1 200px",minWidth:0}}>
                                <div style={{fontSize:12,color:C.text,fontWeight:500}}>{it.dish}</div>
                                {(mappedName||suggested) && (
                                  <div style={{fontSize:10,color:C.muted,marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                                    {mappedName && <span>â†’ {mappedName}</span>}
                                    {suggested && <span style={{color:C.gold}}>ðŸ’¡ {T2("suggest")} {suggested} kg</span>}
                                  </div>
                                )}
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                                {suggested && String(currentVal)==="" && (
                                  <button onClick={()=>{setPlanDrafts(p=>({...p,[it.dish]:String(suggested)}));savePlanYield(it.dish, suggested, rowCtx);}}
                                    style={{fontSize:10,padding:"5px 8px",border:`1px dashed ${C.gold}`,color:C.gold,borderRadius:6,background:"transparent",cursor:"pointer",whiteSpace:"nowrap"}}>
                                    {T2("Use")} {suggested}
                                  </button>
                                )}
                                <input type="number" step="any" inputMode="decimal" min="0"
                                  value={currentVal}
                                  onChange={e=>setPlanDrafts(p=>({...p,[it.dish]:e.target.value}))}
                                  onBlur={()=>onYieldBlur(it.dish, rowCtx)}
                                  onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}
                                  placeholder={suggested?String(suggested):"â€”"}
                                  disabled={isSaving}
                                  style={{width:72,padding:"6px 8px",borderRadius:6,border:`1px solid ${isSaved?C.green+"60":C.border}`,fontSize:12,textAlign:"right",background:isSaved?C.green+"08":C.bg,color:C.text,opacity:isSaving?0.6:1}} />
                                <span style={{fontSize:10,color:C.muted}}>kg</span>
                                {isSaving ? (
                                  <span style={{fontSize:10,color:C.muted,fontStyle:"italic",width:52}}>{T2("Saving")}...</span>
                                ) : isSaved ? (
                                  <div style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,color:C.amber,background:C.amber+"15",border:`1px solid ${C.amber}30`,whiteSpace:"nowrap"}}>{T2("Draft")}</div>
                                ) : (
                                  <div style={{width:52}}></div>
                                )}
                              </div>
                            </div>
                          );
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
                        <span style={{fontSize:14}}>â“</span>
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

      {/* â•â•â• DISH NAME MAPPING MODAL â•â•â• */}
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
        const filteredRows = dishMapSearch ? rows.filter(r=>r.lms.toLowerCase().includes(dishMapSearch.toLowerCase())||(r.sopName||"").toLowerCase().includes(dishMapSearch.toLowerCase())) : rows;

        async function saveMappings(){
          const entries = Object.entries(dishMapSel).filter(([k,v])=>v);
          if(entries.length===0) return;
          setDishMapSaving(true);
          try{
            const mod = await import('../lib/supabase.js');
            const sb = mod.supabase; if(!sb){setDishMapSaving(false);return;}
            for(const [lmsName, recipeName] of entries){
              const {error} = await sb.from('dish_name_map').upsert({lms_name:lmsName, recipe_dish_name:recipeName},{onConflict:'lms_name'});
              if(error) console.error('Map save error:', lmsName, error);
              else DISH_NAME_MAP[lmsName] = recipeName;
            }
            setDishMapSel({});
            alert('âœ… '+entries.length+' mapping(s) saved');
          }catch(e){console.error('Map save error:',e);alert('Error saving');}
          setDishMapSaving(false);
        }

        async function removeMapping(lmsName){
          if(!confirm('Remove mapping for "'+lmsName+'"?')) return;
          try{
            const mod = await import('../lib/supabase.js');
            const sb = mod.supabase; if(!sb)return;
            await sb.from('dish_name_map').delete().eq('lms_name',lmsName);
            delete DISH_NAME_MAP[lmsName];
            setDishMapSel(p=>{const n={...p};delete n[lmsName];return n;});
          }catch(e){console.error(e);}
        }

        const pendingCount = Object.values(dishMapSel).filter(Boolean).length;

        return(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 0",overflowY:"auto"}} onClick={e=>{if(e.target===e.currentTarget)setShowDishMap(false);}}>
          <div style={{background:C.surface,borderRadius:16,width:"min(96vw,700px)",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
            {/* Header */}
            <div style={{padding:"18px 20px 14px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.text}}>ðŸ”— Dish Name Mapping</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:3}}>Link LMS menu items â†’ SOP recipes Â· {lmsNames.length} dishes</div>
                </div>
                <button onClick={()=>setShowDishMap(false)} style={{width:32,height:32,borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>âœ•</button>
              </div>
              {/* Stats */}
              <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
                <span style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red}}>âš  {unlinked.length} unlinked</span>
                <span style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold}}>ðŸ”— {mapped.length} mapped</span>
                <span style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green}}>âœ“ {auto.length} auto-matched</span>
              </div>
              {/* Search */}
              <input value={dishMapSearch} onChange={e=>setDishMapSearch(e.target.value)} placeholder="Search dishes..." style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.darkCard,marginTop:10,boxSizing:"border-box"}}/>
            </div>
            {/* Body */}
            <div style={{overflowY:"auto",flex:1,padding:"8px 12px"}}>
              {dishMapDrop&&<div style={{position:"fixed",inset:0,zIndex:15}} onClick={()=>setDishMapDrop(null)}/>}
              {filteredRows.map((row,ri)=>{
                const sel = dishMapSel[row.lms];
                const isUnlinked = row.status==="unlinked"&&!sel;
                return(
                <div key={ri} style={{padding:"10px 8px",borderBottom:`1px solid ${C.borderLight}`,display:"flex",gap:10,alignItems:"center",background:isUnlinked?C.redBg+"60":"transparent",borderRadius:6,marginBottom:2}}>
                  {/* Status dot */}
                  <div style={{width:8,height:8,borderRadius:4,flexShrink:0,background:row.status==="unlinked"?(sel?C.amber:C.red):row.status==="mapped"?C.gold:C.green}}/>
                  {/* LMS name */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.lms}</div>
                    {row.status==="auto"&&!sel&&<div style={{fontSize:10,color:C.green,marginTop:2}}>auto â†’ {row.sopName}</div>}
                    {row.status==="mapped"&&!sel&&<div style={{fontSize:10,color:C.gold,marginTop:2}}>mapped â†’ {row.sopName}</div>}
                    {sel&&<div style={{fontSize:10,color:C.amber,marginTop:2}}>â†’ {sel.split("/")[0].trim()} (unsaved)</div>}
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
                    <div style={{position:"relative",flexShrink:0,maxWidth:240,minWidth:160}}>
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        <button onClick={()=>{if(isOpen){setDishMapDrop(null);}else{setDishMapDrop(row.lms);setDishMapDropQ("");}}} style={{flex:1,padding:"6px 10px",borderRadius:8,border:`1px solid ${isUnlinked&&!display?C.red:display?C.greenBorder:C.border}`,fontSize:11,fontWeight:display?600:400,color:display?C.text:C.faint,background:display?C.greenBg+"40":C.surface,cursor:"pointer",textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minHeight:30}}>
                          {display||"Select SOP..."}
                        </button>
                        {(row.status==="mapped"&&!sel)&&<button onClick={()=>removeMapping(row.lms)} style={{padding:"3px 8px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:10,cursor:"pointer",flexShrink:0}}>âœ•</button>}
                        {sel&&<button onClick={()=>setDishMapSel(p=>({...p,[row.lms]:null}))} style={{padding:"3px 8px",borderRadius:6,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:10,cursor:"pointer",flexShrink:0}}>âœ•</button>}
                      </div>
                      {isOpen&&(
                        <div style={{position:"absolute",top:"100%",right:0,zIndex:20,width:280,maxHeight:260,background:C.surface,border:`1.5px solid ${C.gold}`,borderRadius:10,boxShadow:"0 8px 30px rgba(0,0,0,.25)",marginTop:4,display:"flex",flexDirection:"column"}}>
                          <div style={{padding:"8px 8px 6px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
                            <input autoFocus value={dishMapDropQ} onChange={e=>setDishMapDropQ(e.target.value)} placeholder="Type to search recipes..." style={{width:"100%",padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.darkCard,boxSizing:"border-box"}}/>
                          </div>
                          <div style={{overflowY:"auto",flex:1}}>
                            {Object.keys(grouped).length===0&&<div style={{padding:16,textAlign:"center",fontSize:11,color:C.faint}}>No recipes match</div>}
                            {Object.entries(grouped).map(([catName,recs])=>(
                              <div key={catName}>
                                <div style={{padding:"6px 10px 3px",fontSize:10,fontWeight:700,color:C.gold,textTransform:"uppercase",letterSpacing:.4,background:C.goldBg+"40",position:"sticky",top:0}}>{catName}</div>
                                {recs.map((r,i)=>(
                                  <div key={i} onMouseDown={e=>{e.preventDefault();setDishMapSel(p=>({...p,[row.lms]:r.n}));setDishMapDrop(null);}} style={{padding:"6px 12px",fontSize:12,color:C.text,cursor:"pointer",borderBottom:`1px solid ${C.borderLight}`,background:(display===r.n)?C.greenBg:"transparent"}} onMouseEnter={e=>e.currentTarget.style.background=C.goldBg} onMouseLeave={e=>e.currentTarget.style.background=(display===r.n)?C.greenBg:"transparent"}>
                                    {(()=>{if(!q)return r.n;const idx=r.n.toLowerCase().indexOf(q);if(idx<0)return r.n;return <>{r.n.slice(0,idx)}<b style={{color:C.gold}}>{r.n.slice(idx,idx+q.length)}</b>{r.n.slice(idx+q.length)}</>;})()}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })()}
                </div>
              );})}
              {filteredRows.length===0&&<div style={{textAlign:"center",padding:30,color:C.faint,fontSize:13}}>No dishes match search</div>}
            </div>
            {/* Footer */}
            {pendingCount>0&&(
              <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
                <span style={{fontSize:12,color:C.amber,fontWeight:600}}>{pendingCount} unsaved mapping{pendingCount>1?"s":""}</span>
                <button onClick={saveMappings} disabled={dishMapSaving} style={{padding:"10px 24px",borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",opacity:dishMapSaving?.6:1,minHeight:40}}>{dishMapSaving?"Saving...":"ðŸ’¾ Save Mappings"}</button>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* â•â•â• MENU TAB â•â•â• */}
      

      {/* â•â•â• INGREDIENT MATRIX EDITOR MODAL â•â•â• */}
      {ingModal&&tab!=="sops"&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 0",overflowY:"auto"}}>
          <div style={{background:C.surface,borderRadius:16,width:"min(96vw,600px)",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>
            {/* Header */}
            <div style={{position:"sticky",top:0,zIndex:2,background:C.surface,padding:"18px 20px 12px",borderBottom:`1px solid ${C.border}`,borderRadius:"16px 16px 0 0"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.text}}>ðŸ§‚ Ingredient Matrix</div>
                  <div style={{fontSize:12,color:C.gold,marginTop:2}}>{ingModal.recipeName}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {ingDirty&&<button onClick={saveIngredients} style={{padding:"8px 18px",borderRadius:10,fontSize:12,fontWeight:700,background:C.green,color:"#fff",border:"none",cursor:"pointer",minHeight:36}}>ðŸ’¾ Save</button>}
                  <button onClick={()=>{if(ingDirty&&!confirm("Discard unsaved changes?"))return;setIngModal(null);}} style={{padding:"8px 14px",borderRadius:10,fontSize:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",minHeight:36}}>âœ•</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:12,fontSize:11,color:C.muted,flexWrap:"wrap"}}>
                <span style={{flexShrink:0}}>Anchor:</span>
                <span style={{padding:"3px 10px",borderRadius:6,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,fontWeight:700,fontSize:12}}>{ingForm.base_pax||300} pax</span>
                {ingForm.base_yield?.kg
                  ?<span style={{padding:"3px 10px",borderRadius:6,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green,fontWeight:700,fontSize:12}}>Yield: {ingForm.base_yield.kg} kg{ingForm.base_yield.pcs?` (${ingForm.base_yield.pcs} pcs)`:''}</span>
                  :<span style={{fontSize:10,color:C.amber}}>âš  Yield not set â€” edit from SOP view</span>}
              </div>
            </div>
            {/* Ingredient rows */}
            <div style={{padding:"12px 16px"}}>
              {ingForm.items.length===0&&(
                <div style={{textAlign:"center",padding:"30px 20px",color:C.faint,fontSize:13}}>No ingredients yet. Tap "+ Add Ingredient" below.</div>
              )}
              {ingForm.items.map((item,idx)=>item.isSection?(
                <div key={idx} onDragOver={e=>e.preventDefault()} onDrop={()=>ingReorderTo(idx)} style={{marginBottom:10,borderRadius:12,border:`2px solid ${C.goldBorder}`,background:C.goldBg,overflow:"hidden",padding:"10px 12px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",opacity:ingDragIdx===idx?0.4:1}}>
                  <span draggable onDragStart={()=>setIngDragIdx(idx)} onDragEnd={()=>setIngDragIdx(null)} title="Drag to reorder" style={{cursor:"grab",fontSize:16,color:C.gold,fontWeight:700,flexShrink:0,userSelect:"none",padding:"0 4px"}}>â‹®â‹®</span>
                  <input value={item.name} onChange={e=>ingUpdateItem(idx,"name",e.target.value)} placeholder="Section heading" style={{flex:1,minWidth:120,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.goldBorder}`,fontSize:13,fontWeight:700,color:C.gold,background:"transparent",textAlign:"center"}}/>
                  <input value={item.hi||""} onChange={e=>ingUpdateItem(idx,"hi",e.target.value)} placeholder="à¤¹à¤¿à¤‚à¤¦à¥€" style={{width:90,padding:"6px 8px",borderRadius:8,border:`1px solid ${C.goldBorder}`,fontSize:12,fontWeight:700,color:C.gold,background:"transparent",textAlign:"center"}}/>
                  <button onClick={()=>ingRemoveItem(idx)} style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.redBorder}`,background:C.redBg,cursor:"pointer",fontSize:12,color:C.red}}>âœ•</button>
                </div>
              ):(
                <div key={idx} onDragOver={e=>e.preventDefault()} onDrop={()=>ingReorderTo(idx)} style={{marginBottom:10,borderRadius:12,border:`1px solid ${C.border}`,background:idx%2===0?C.surface:C.darkCard,overflow:"hidden",opacity:ingDragIdx===idx?0.4:1}}>
                  {/* Row header */}
                  <div style={{padding:"10px 12px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",borderBottom:`1px solid ${C.borderLight}`}}>
                    <span draggable onDragStart={()=>setIngDragIdx(idx)} onDragEnd={()=>setIngDragIdx(null)} title="Drag to reorder" style={{cursor:"grab",fontSize:16,color:C.muted,flexShrink:0,userSelect:"none",padding:"0 4px"}}>â‹®â‹®</span>
                    <input value={item.name} onChange={e=>ingUpdateItem(idx,"name",e.target.value)} placeholder="Ingredient name" style={{flex:1,minWidth:90,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:"transparent"}}/>
                    <input value={item.hi||""} onChange={e=>ingUpdateItem(idx,"hi",e.target.value)} placeholder="à¤¹à¤¿à¤‚à¤¦à¥€" style={{width:75,padding:"6px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:"transparent"}}/>
                    <select value={item.unit} onChange={e=>ingUpdateItem(idx,"unit",e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,minHeight:32}}>
                      {["kg","gm","L","ml","tsp","tbsp","pcs","slice","Bot","tin","bunch","dozen"].map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                    <button onClick={()=>ingRemoveItem(idx)} style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.redBorder}`,background:C.redBg,cursor:"pointer",fontSize:12,color:C.red}}>âœ•</button>
                  </div>
                  {/* Quantity input */}
                  <div style={{padding:"8px 12px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:2}}>
                      <span style={{fontSize:9,color:C.faint}}>Qty @ {ingForm.base_pax||300} pax</span>
                      <input type="number" step="0.01" value={item.qty||""} onChange={e=>ingUpdateQty(idx,e.target.value)} style={{width:100,padding:"6px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:13,fontWeight:600,textAlign:"center",color:C.text,background:"transparent"}}/>
                    </div>
                    <span style={{fontSize:11,color:C.faint,marginTop:14}}>{item.unit}</span>
                  </div>
                  {/* Notes */}
                  <div style={{padding:"4px 12px 8px"}}>
                    <input value={item.notes||""} onChange={e=>ingUpdateItem(idx,"notes",e.target.value)} placeholder="Notes (optional)" style={{width:"100%",padding:"4px 8px",borderRadius:6,border:`1px solid ${C.borderLight}`,fontSize:11,color:C.muted,background:"transparent",boxSizing:"border-box"}}/>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button onClick={ingAddItem} style={{flex:1,padding:"12px",borderRadius:10,border:`2px dashed ${C.goldBorder}`,background:C.goldBg,color:C.gold,fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>+ Add Ingredient</button>
                <button onClick={ingAddSection} style={{flex:"0 0 40%",padding:"12px",borderRadius:10,border:`2px dashed ${C.goldBorder}`,background:C.goldBg,color:C.gold,fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>+ Section</button>
              </div>
            </div>
            {/* Footer */}
            <div style={{position:"sticky",bottom:0,padding:"12px 16px",borderTop:`1px solid ${C.border}`,background:C.surface,borderRadius:"0 0 16px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:ingDirty?C.amber:C.faint}}>{ingForm.items.length} ingredient{ingForm.items.length!==1?"s":""}{ingDirty?" Â· unsaved":""}</span>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{if(ingDirty&&!confirm("Discard changes?"))return;setIngModal(null);}} style={{padding:"8px 16px",borderRadius:10,fontSize:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",minHeight:36}}>Cancel</button>
                <button onClick={saveIngredients} disabled={!ingDirty} style={{padding:"8px 20px",borderRadius:10,fontSize:12,fontWeight:700,background:ingDirty?C.green:C.faint,color:"#fff",border:"none",cursor:ingDirty?"pointer":"default",opacity:ingDirty?1:.5,minHeight:36}}>ðŸ’¾ Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â•â•â• Ingredient Usage Modal â•â•â• */}
      {yieldModal && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>{setYieldModal(null);yieldModal.onConfirm();}}>
          <div style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:400,boxShadow:"0 8px 32px rgba(0,0,0,.2)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"20px 24px",borderBottom:"1px solid "+C.border}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text}}>âš–ï¸ Yield / à¤‰à¤ªà¤œ</div>
              <div style={{fontSize:12,color:C.muted,marginTop:4}}>{yieldModal.dish.name} â€” {yieldModal.pax} pax</div>
            </div>
            <div style={{padding:"24px"}}>
              <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>How much quantity was made?</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:16}}>à¤•à¤¿à¤¤à¤¨à¥€ à¤®à¤¾à¤¤à¥à¤°à¤¾ à¤¬à¤¨à¥€?</div>
              <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                <div style={{flex:2}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",marginBottom:4}}>Quantity / à¤®à¤¾à¤¤à¥à¤°à¤¾</div>
                  <input type="number" step="any" inputMode="decimal" autoFocus
                    value={yieldQty}
                    onChange={e=>setYieldQty(e.target.value)}
                    placeholder="0"
                    style={{width:"100%",padding:"14px 16px",borderRadius:10,border:"2px solid "+C.goldBorder,fontSize:22,fontWeight:700,textAlign:"center",color:C.text,background:C.bg,boxSizing:"border-box"}} />
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",marginBottom:4}}>Unit / à¤‡à¤•à¤¾à¤ˆ</div>
                  <select value={yieldUnit} onChange={e=>setYieldUnit(e.target.value)}
                    style={{width:"100%",padding:"14px 8px",borderRadius:10,border:"2px solid "+C.border,fontSize:15,fontWeight:600,color:C.text,background:C.bg,cursor:"pointer",boxSizing:"border-box"}}>
                    <option value="kg">kg</option>
                    <option value="L">L (litre)</option>
                    <option value="gm">gm</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs / à¤ªà¥€à¤¸</option>
                    <option value="plates">plates</option>
                    <option value="bowls">bowls</option>
                    <option value="trays">trays</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{padding:"12px 24px 20px",display:"flex",gap:10}}>
              <button onClick={()=>{setYieldQty("");proceedToIngredientUsage();}} style={{flex:1,padding:"12px",borderRadius:10,background:"transparent",border:"1px solid "+C.border,color:C.muted,fontSize:12,cursor:"pointer"}}>Skip</button>
              <button onClick={proceedToIngredientUsage} disabled={!yieldQty} style={{flex:2,padding:"12px",borderRadius:10,background:yieldQty?C.gold:"#ccc",color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:yieldQty?"pointer":"default",opacity:yieldQty?1:0.6}}>Next â†’ à¤†à¤—à¥‡</button>
            </div>
          </div>
        </div>
      )}

      {usageModal && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>{usageModal.onConfirm();setUsageModal(null);}}>
          <div style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:520,maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 8px 32px rgba(0,0,0,.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid "+C.border}}>
              <div style={{fontSize:15,fontWeight:700,color:C.text}}>ðŸ“Š Ingredient Usage</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{usageModal.dishName} â€” {usageModal.pax} pax {usageModal.isPrepDay?"(Prep Day)":"(Event Day)"}</div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"0 20px"}}>
              <div style={{display:"flex",padding:"10px 0 6px",borderBottom:"2px solid "+C.border,fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5}}>
                <div style={{flex:2}}>Ingredient</div>
                <div style={{flex:1,textAlign:"right"}}>Scaled</div>
                <div style={{flex:1,textAlign:"right"}}>Actual</div>
              </div>
              {usageModal.ingredients.map((ing,i) => (
                <div key={i} style={{display:"flex",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+C.borderLight,fontSize:12}}>
                  <div style={{flex:2}}>
                    <div style={{color:C.text,fontWeight:500}}>{ing.n}</div>
                    {ing.h && <div style={{fontSize:10,color:C.muted}}>{ing.h}</div>}
                  </div>
                  <div style={{flex:1,textAlign:"right",color:C.muted,fontSize:11}}>{Math.round(ing.q*100)/100} {ing.u}</div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
                    <input type="number" step="any" inputMode="decimal"
                      placeholder={String(Math.round(ing.q*100)/100)}
                      value={usageActuals[ing.n]||""}
                      onChange={e=>{const v=e.target.value;setUsageActuals(p=>({...p,[ing.n]:v}));}}
                      style={{width:64,padding:"5px 6px",borderRadius:6,border:"1px solid "+C.border,fontSize:12,textAlign:"right",background:C.bg,color:C.text}} />
                    <div style={{fontSize:9,color:C.faint,marginTop:1}}>{ing.u}</div>
                  </div>
                </div>
              ))}
              <div style={{padding:"8px 0",fontSize:10,color:C.muted,fontStyle:"italic"}}>Leave blank if scaled quantity was correct</div>
            </div>
            <div style={{padding:"12px 20px",borderTop:"1px solid "+C.border,display:"flex",gap:10}}>
              <button onClick={()=>{usageModal.onConfirm();setUsageModal(null);}} style={{flex:1,padding:"12px",borderRadius:10,background:"transparent",border:"1px solid "+C.border,color:C.muted,fontSize:12,cursor:"pointer"}}>Skip</button>
              <button onClick={saveUsageAndDone} style={{flex:2,padding:"12px",borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>Save & Done âœ…</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export { KitchenHub };
