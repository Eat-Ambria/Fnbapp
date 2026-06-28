// Ambria FnB — Kitchen Hub (Overview, Prep Tracking, Prep Plan, Recipe SOPs)
import React, { useState, useRef, useEffect } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, TODAY_LABEL, safeArr, safeNum, safePct, localDateStr } from '../utils/helpers.js';
import { MENU_PACKAGES, MENU_PACKAGE_NAMES } from '../data/menuPackages.js';
import { getSectionForDish, getCatIdForDish, getCatForDish, GENERIC_STEPS, RECIPE_INGREDIENTS, RECIPE_DB, DISH_NAME_MAP, findRecipeForDish, getStepsForDish, fmtT, BEV_RE, getFullSteps, getDishImageUrl, getIngrForDish, interpolatePax, hasIngredients } from '../data/recipeData.js';
import { Avatar, Card, Btn, Chip, STag, SelfieCapture, SectionHeader } from './SharedUI.jsx';
import { EventDayTab } from './EventDayTab.jsx';
import { hasPermission } from '../data/permissions.js';
import { logActivity } from './ActivityLog.jsx';


function KitchenHub({ events, kitchenTracking, setKitchenTracking, lang="en", odcOnly=false, currentUser=null, transportQueue=[], setTransportQueue }) {
  const T2 = s => T(s, lang);

  // Safe menu array — handles JSONB array or stringified JSON from Supabase
  function menuArr(ev) {
    const m = ev.menu;
    if (Array.isArray(m)) return m;
    if (typeof m === 'string' && m) { try { return JSON.parse(m); } catch(e) { return []; } }
    return [];
  }

  // ── Strip hardcoded quantities from SOP step text ──
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

  // ── Ingredient Matrix Editor ──
  function openIngEditor(recipe, catId) {
    const ex = recipe.ingredients;
    if (ex && ex.pax_sizes && Array.isArray(ex.items)) {
      setIngForm({pax_sizes:[...ex.pax_sizes], items:ex.items.map(it=>({...it,qty:[...it.qty],nv_qty:it.nv_qty?[...it.nv_qty]:null}))});
    } else {
      setIngForm({pax_sizes:[200,500,1000],items:[]});
    }
    setIngModal({recipeName:recipe.n, catId});
    setIngDirty(false);
  }
  function ingAddItem() {
    setIngForm(f=>({...f,items:[...f.items,{name:"",hindi:"",unit:"kg",qty:f.pax_sizes.map(()=>0),nv_qty:null,notes:""}]}));
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
  function ingUpdateQty(idx, pi, val) {
    setIngForm(f=>{const items=[...f.items];const qty=[...items[idx].qty];qty[pi]=parseFloat(val)||0;items[idx]={...items[idx],qty};return{...f,items};});
    setIngDirty(true);
  }
  function ingUpdateNvQty(idx, pi, val) {
    setIngForm(f=>{const items=[...f.items];const nv=items[idx].nv_qty?[...items[idx].nv_qty]:f.pax_sizes.map(()=>0);nv[pi]=parseFloat(val)||0;items[idx]={...items[idx],nv_qty:nv};return{...f,items};});
    setIngDirty(true);
  }
  function ingToggleNv(idx) {
    setIngForm(f=>{const items=[...f.items];items[idx]={...items[idx],nv_qty:items[idx].nv_qty?null:f.pax_sizes.map(()=>0)};return{...f,items};});
    setIngDirty(true);
  }
  function ingMoveItem(idx, dir) {
    setIngForm(f=>{const items=[...f.items];const t2=idx+dir;if(t2<0||t2>=items.length)return f;[items[idx],items[t2]]=[items[t2],items[idx]];return{...f,items};});
    setIngDirty(true);
  }
  // ── Bridge: resolve ingredients for any dish (new JSONB → old format fallback) ──
  
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
    const payload={pax_sizes:ingForm.pax_sizes,items:ingForm.items.filter(it=>it.name.trim())};
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
        else console.log('✅ Ingredients saved for',ingModal.recipeName);
      }
    }catch(e){console.error('Ingredient save failed:',e);}
    setIngDirty(false);
    if(sopRecipe&&sopRecipe.n===ingModal.recipeName) setSopRecipe(p=>({...p,ingredients:payload}));
    setIngModal(null);
  }
  const [scaleDishSearch, setScaleDishSearch] = useState("");
  const [scaleMode, setScaleMode] = useState("dish");
  const [scalePkg, setScalePkg] = useState("");
  const [scaleMultiSel, setScaleMultiSel] = useState({});
  const [scalePercent, setScalePercent] = useState(100); // % multiplier
  const [scaleEventId, setScaleEventId] = useState(null); // null | "manual" | eventId
  const [showNV, setShowNV] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const [ingModal, setIngModal] = useState(null);
  const [ingForm, setIngForm] = useState({pax_sizes:[200,500,1000],items:[]});
  const [ingDirty, setIngDirty] = useState(false);
  const [appliedScales, setAppliedScales] = useState({}); // {evId: {percent, appliedAt, dishes[]}}
  const [d1View, setD1View] = useState("all"); // "all" | "cont" | "new"
  const [d1FnFilter, setD1FnFilter] = useState("combined"); // "combined" | eventId
  const [tick, setTick] = useState(0);
  const [dishSignoff, setDishSignoff] = useState(null); // {evId,idx,mode:"completed"|"ready_for_transport",chefName,selfie}

  // ── Dish Name Mapping ──
  const [showDishMap, setShowDishMap] = useState(false);
  const [dishMapSel, setDishMapSel] = useState({}); // {lmsName: recipeDishName}
  const [dishMapSaving, setDishMapSaving] = useState(false);
  const [dishMapSearch, setDishMapSearch] = useState("");
  const [dishMapDrop, setDishMapDrop] = useState(null); // lms_name of open dropdown row
  const [dishMapDropQ, setDishMapDropQ] = useState("");

  // ── Yield editing ──
  const YIELD_UNITS = ["kg","gm","ltr","ml","piece","chafing dish"];
  const [editingYield, setEditingYield] = useState(false);
  const [yieldForm, setYieldForm] = useState([]);

  // ── Ingredient Usage Modal (captures actual vs scaled) ──
  const [usageModal, setUsageModal] = useState(null);
  const [usageActuals, setUsageActuals] = useState({});
  function openUsageModal(dish, pax, isPrepDay, onConfirm) {
    const ingr = getIngrForDish(dish.name, pax);
    if (ingr && ingr.length > 0) {
      setUsageModal({evId:dish.fEvId, idx:dish.fIdx, dishName:dish.name, pax:pax, isPrepDay:isPrepDay, ingredients:ingr, onConfirm:onConfirm});
      setUsageActuals({});
    } else { onConfirm(); }
  }
  async function saveUsageAndDone() {
    if (!usageModal) return;
    const rows = usageModal.ingredients.map(ing => {
      const actual = usageActuals[ing.n];
      return { name: ing.n, hindi: ing.h||"", scaled_qty: Math.round(ing.q*100)/100, unit: ing.u, actual_qty: actual !== undefined && actual !== "" ? parseFloat(actual) : null };
    });
    try {
      const mod = await import('../lib/supabase.js');
      await mod.supabase.from('ingredient_usage_log').insert({ event_id: usageModal.evId, dish_name: usageModal.dishName, pax: usageModal.pax, ingredients: rows, is_prep_day: usageModal.isPrepDay, recorded_by: currentUser?.name||"Unknown" });
    } catch(e) { console.error('Usage log save error:', e); }
    usageModal.onConfirm();
    setUsageModal(null);
  }

  // ── Analytics ──
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
  useEffect(()=>{if(tab!=="analytics"||!analyticsEvId)return;const aEvs=safeArr(events);const evIds=analyticsEvId==="__combined"?aEvs.map(e=>e.id):[analyticsEvId];if(evIds.length>0)fetchUsageLogs(evIds);},[tab,analyticsEvId]);

  // ── SOP Add/Edit Modal ──
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
    import('../lib/supabase.js').then(mod=>{
      const sb=mod.supabase;if(!sb)return;
      if(sopModal.mode==="edit"&&sopModal.origName){
        const nameUnchanged=sopModal.origName===recObj.n&&sopModal.catId===f.catId;
        if(nameUnchanged){
          // Same name+category → UPDATE in place, ingredients untouched
          sb.from('recipes').update({sub:recObj.sub,steps:recObj.steps}).eq('dish_name',recObj.n).eq('category_id',f.catId).then(r=>{if(r.error)console.error('SOP save err:',r.error);else console.log('✅ SOP updated (in-place)');});
        }else{
          // Name or category changed → fetch ingredients, then delete+insert with them
          sb.from('recipes').select('ingredients').eq('dish_name',sopModal.origName).single().then(({data})=>{
            sb.from('recipes').delete().eq('dish_name',sopModal.origName).then(()=>{
              sb.from('recipes').insert({dish_name:recObj.n,category_id:f.catId,sub:recObj.sub,steps:recObj.steps,ingredients:data?.ingredients||null}).then(r=>{if(r.error)console.error('SOP save err:',r.error);else console.log('✅ SOP updated (renamed)');});
            });
          });
        }
      }else{
        sb.from('recipes').insert({dish_name:recObj.n,category_id:f.catId,sub:recObj.sub,steps:recObj.steps}).then(r=>{if(r.error)console.error('SOP save err:',r.error);else console.log('✅ SOP saved');});
      }
    }).catch(e=>console.error('SOP supabase err:',e));
    logActivity('kitchen', (sopModal.mode==='edit'?'SOP updated: ':'SOP created: ')+recObj.n, sopModal.mode==='edit'?'sop_update':'sop_create', {dish:recObj.n, catId:f.catId}, currentUser?.id);
    setSopModal(null);setSopRecipe(recObj);
  }
  function deleteSop(recipe,catId){
    if(!window.confirm('Delete "'+recipe.n+'"? This cannot be undone.'))return;
    const cid=catId||sopCat||"";
    const arr=RECIPE_DB.recipes[cid]||[];
    const idx=arr.findIndex(r=>r.n===recipe.n);
    if(idx>=0)arr.splice(idx,1);
    import('../lib/supabase.js').then(mod=>{
      const sb=mod.supabase;if(!sb)return;
      sb.from('recipes').delete().eq('dish_name',recipe.n).then(r=>{if(r.error)console.error('SOP delete err:',r.error);else console.log('✅ SOP deleted');});
    }).catch(e=>console.error('SOP delete err:',e));
    logActivity('kitchen', 'SOP deleted: '+recipe.n, 'sop_delete', {dish:recipe.n, catId:cid}, currentUser?.id);
    setSopRecipe(null);
  }

  // ── Camera for chef selfie ──
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

  // ── Chef Photo on Mark as Complete ──
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

  // ── State helpers (auto-save to kitchenTracking — combined cooking keys) ──
  function dk(evId,idx){return evId+"|"+idx;}
  function ck(dishName){return "dish|"+dishName;}
  function ds(evId,idx,dishName){
    if(d1FnFilter==="combined" && dishName) return kt["__combined"]?.[ck(dishName)]||{};
    return kt[evId]?.[dk(evId,idx)]||{};
  }
  function setDs(evId,idx,upd,dishInfo){
    setKitchenTracking(p=>{
      const o=p&&typeof p==="object"?{...p}:{};
      if(d1FnFilter==="combined" && dishInfo?.name){
        const cKey=ck(dishInfo.name);
        o["__combined"]={...(o["__combined"]||{}),[cKey]:{...(o["__combined"]?.[cKey]||{}),...upd}};
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

  // ── Auto-scaling: compute effective scale per event ──
  // BASE_PAX = 400 (all SOP recipes calibrated for this)
  const BASE_PAX = 400;
  function getEffectiveScale(evId, evPax) {
    // If chef applied an override via Scaling tab, use that
    const override = appliedScales[evId] || appliedScales["manual"];
    if (override?.percent) return override.percent;
    // Otherwise auto-scale based on pax
    if (evPax && evPax > 0) return Math.round((evPax / BASE_PAX) * 100);
    return 100;
  }

  // Build a combined scales object that includes auto-computed ones
  const effectiveScales = {};
  evList.forEach(ev => {
    effectiveScales[ev.id] = {
      percent: getEffectiveScale(ev.id, +ev.pax || 0),
      isOverride: !!(appliedScales[ev.id]?.percent || appliedScales["manual"]?.percent),
      eventName: ev.guest || "Function",
      pax: +ev.pax || 0,
    };
  });

  // Prep day context: which events are being prepped for
  const prepEvLabel = tomorrowEvs.map(e=>`${e.guest||"Function"} (${e.pax} pax)`).join(", ");
  const prepContextParts = [];
  if(prepEvLabel) prepContextParts.push(`${tomorrowLabel}: ${prepEvLabel}`);

  const TABS=[
    {v:"today",   l:T2("Event day")},
    {v:"d1",      l:T2("Prep day")},
    {v:"scaling", l:T2("Scaling")},
    {v:"sops",    l:T2("SOPs")},
    {v:"analytics",l:"📊 "+T2("Analytics")},
  ];
  const TABS_FILTERED = isSectionUser
    ? TABS.filter(t => ['today','d1','sops'].includes(t.v))
    : TABS;

  // ── Inline dish card (shows live progress) ──

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
            <span style={{fontSize:24}}>{bannerCat?.icon||'🍽'}</span>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:bannerColor}}>{sectionDisplayName}</div>
              <div style={{fontSize:11,color:C.muted}}>Showing only your assigned categories</div>
            </div>
          </div>
        );
      })()}

      {/* ── Chef Photo Modal ── */}
      {readyModal&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:12,overflowY:"auto"}}>
          <div style={{background:C.surface,borderRadius:20,padding:"22px 20px",maxWidth:420,width:"100%",border:`2px solid ${C.greenBorder}`,boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
            <div style={{textAlign:"center",marginBottom:14}}>
              <div style={{fontSize:28,marginBottom:6}}>📸</div>
              <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>{T2("Dish Ready!")}</div>
              <div style={{fontSize:13,color:C.gold,marginTop:3,fontWeight:600}}>{readyModal.dishName}</div>
            </div>
            {/* Selfie section */}
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>📸 {T2("Dish Photo")} <span style={{color:C.red}}>*</span></div>
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
              <span style={{fontSize:11,color:C.muted}}>{readySig?"✅ Signed":"Draw signature above"}</span>
              <button onClick={sigClear} style={{padding:"4px 12px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer"}}>Clear</button>
            </div>
            {/* Submit */}
            <div style={{display:"flex",gap:10}}>
              <button disabled={!readyPhoto} onClick={()=>{
                const {evId,idx}=readyModal;
                const now=new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
                setDs(evId,idx,{ready:true,readyAt:now,readyPhoto:readyPhoto||null,selfie:readyPhoto||null,signature:readySig||null,completedBy:currentUser?.name||"Chef",completedAt:now},readyModal);
                logActivity('kitchen', 'Dish ready: '+readyModal.dishName, 'dish_complete', {evId:evId, dish:readyModal.dishName, chef:currentUser?.name||'Chef'}, currentUser?.id);
                stopReadyCam();setReadyModal(null);setReadyPhoto(null);setReadySig(null);sigClear();
              }} style={{flex:1,padding:"14px",borderRadius:12,background:readyPhoto?`linear-gradient(135deg,${C.green},#147A54)`:`${C.border}`,color:readyPhoto?"#fff":C.faint,border:"none",fontSize:14,fontWeight:700,cursor:readyPhoto?"pointer":"not-allowed",minHeight:50,fontFamily:"var(--font-display)",letterSpacing:.5}}>
                ✅ {T2("Confirm Ready")}
              </button>
              <button onClick={()=>{stopReadyCam();setReadyModal(null);setReadyPhoto(null);setReadySig(null);sigClear();}} style={{padding:"14px 16px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer",minHeight:50}}>✕</button>
            </div>
          </div>
        </div>
      )}


      {/* ── SOP Add/Edit Modal ── */}
      {sopModal&&!editingSteps&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 12px",overflowY:"auto"}}>
          <div style={{background:C.surface,borderRadius:18,padding:"22px 20px",maxWidth:540,width:"100%",border:`2px solid ${C.goldBorder}`,boxShadow:"0 24px 60px rgba(0,0,0,.5)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:17,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{sopModal.mode==="edit"?"✏️ Edit Recipe SOP":"➕ Add Recipe SOP"}</div>
              <button onClick={()=>setSopModal(null)} style={{padding:"6px 12px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer"}}>✕</button>
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
                    <button onClick={()=>sopMoveStep(si,-1)} disabled={si===0} style={{padding:"4px 8px",borderRadius:6,background:C.darkCard,border:`1px solid ${C.border}`,color:si===0?C.faint:C.text,fontSize:12,cursor:si===0?"default":"pointer"}}>↑</button>
                    <button onClick={()=>sopMoveStep(si,1)} disabled={si===sopForm.steps.length-1} style={{padding:"4px 8px",borderRadius:6,background:C.darkCard,border:`1px solid ${C.border}`,color:si===sopForm.steps.length-1?C.faint:C.text,fontSize:12,cursor:si===sopForm.steps.length-1?"default":"pointer"}}>↓</button>
                    <button onClick={()=>sopRemoveStep(si)} style={{padding:"4px 8px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,cursor:"pointer"}}>✕</button>
                  </div>
                  <textarea value={step.i} onChange={e=>sopFormStep(si,"i",e.target.value)} placeholder="Instructions (Hindi)" rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box",resize:"vertical",minHeight:44}}/>
                  <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
                    {!(step.subs&&step.subs.length>0)&&<div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:11,color:C.muted}}>⏱</span>
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
                            <button onClick={()=>sopRemoveSub(si,sbi)} style={{width:24,height:24,borderRadius:5,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,cursor:"pointer",padding:0,flexShrink:0}}>✕</button>
                          </div>
                          <textarea value={sb.i} onChange={e=>sopEditSub(si,sbi,"i",e.target.value)} placeholder="Instructions (Hindi)" rows={1} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg,boxSizing:"border-box",resize:"vertical",minHeight:32,marginBottom:4}}/>
                          <div style={{display:"flex",alignItems:"center",gap:6,background:C.bg,borderRadius:6,padding:"5px 10px",border:`1px solid ${C.borderLight}`}}>
                            <span style={{fontSize:11,color:C.amber,fontWeight:600}}>⏱ Timer</span>
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
                {sopModal.mode==="edit"?"💾 Update Recipe":"➕ Save Recipe"}
              </button>
              <button onClick={()=>setSopModal(null)} style={{padding:"14px 20px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer",minHeight:48}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ODC MENU NOT CONFIRMED WARNING ── */}
      {(()=>{
        const odcUnconfirmed = [...todayEvs,...tomorrowEvs].filter(ev=>ev.venue==="Outdoor Catering (ODC)"&&!ev.odc_menu_confirmed);
        if(odcUnconfirmed.length===0) return null;
        return odcUnconfirmed.map(ev=>(
          <div key={"odc-warn-"+ev.id} style={{marginBottom:10,padding:"10px 14px",borderRadius:10,background:C.amberBg,border:`1.5px solid ${C.amberBorder}`,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18,flexShrink:0}}>🏕</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:C.amber}}>ODC menu not confirmed — {ev.guest}</div>
              <div style={{fontSize:11,color:C.muted}}>{ev.odc_location||ev.venue} · {ev.date} · {ev.pax} pax — {T2("Dish list may be inaccurate. Ask admin to confirm menu in Dashboard before prepping.")}</div>
            </div>
          </div>
        ));
      })()}

      {/* TABS — underline style */}
      <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.border}`,marginBottom:20,gap:0}}>
        {TABS_FILTERED.map(t=>(
          <button key={t.v} onClick={()=>setTab(s=>{if(s!==t.v&&(t.v==="d1"||s==="d1")){setD1View("all");setD1FnFilter("combined");}return t.v;})} style={{padding:"10px 18px",fontSize:13,fontWeight:tab===t.v?500:400,cursor:"pointer",background:"none",color:tab===t.v?C.gold:C.muted,border:"none",borderBottom:`2px solid ${tab===t.v?C.gold:"transparent"}`,whiteSpace:"nowrap"}}>{t.l}</button>
        ))}
        {currentUser&&currentUser.role==='admin'&&(
          <button onClick={function(){
            if(!window.confirm('Reset ALL dish progress? This clears store sourcing, step timers, selfies, completion status for ALL dishes. Cannot undo.'))return;
            setKitchenTracking({});
            try{localStorage.removeItem('ambria_kt');}catch(e){}
            try{localStorage.removeItem('ambria_kitchen_tracking');}catch(e){}
            // Also clear from Supabase
            import('../lib/supabase.js').then(function(mod){
              mod.supabase.from('kitchen_tracking').delete().neq('ev_id','__never__').then(function(r){
                if(r.error)console.error('KT clear error:',r.error);
                else console.log('✅ Supabase kitchen_tracking cleared');
              });
            }).catch(function(e){console.error('KT clear import error:',e);});
            alert('✅ All dishes reset to fresh state');
          }} style={{padding:'5px 10px',borderRadius:8,background:"none",border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,fontWeight:500,cursor:'pointer',marginLeft:'auto',marginBottom:6,whiteSpace:"nowrap"}}>
            ↺ {T2("Reset all")}
          </button>
        )}
        {currentUser&&currentUser.role==='admin'&&(
          <button onClick={()=>setShowDishMap(true)} style={{padding:'5px 10px',borderRadius:8,background:"none",border:`1px solid ${C.goldBorder}`,color:C.gold,fontSize:11,fontWeight:500,cursor:'pointer',marginLeft:currentUser.role==='admin'?0:'auto',marginBottom:6,whiteSpace:"nowrap"}}>
            🔗 {T2("Dish Map")}
          </button>
        )}
      </div>

      {/* ═══ EVENT DAY — only cooking/dispatch for today's functions ═══ */}
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
            appliedScales={appliedScales}
            effectiveScales={effectiveScales}
            tick={tick}
            setTab={setTab}
            onBeforeDishDone={openUsageModal}
          />
        ):(
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:48,marginBottom:16}}>👨‍🍳</div>
            <div style={{fontSize:18,fontWeight:500,color:C.text,marginBottom:8}}>{T2("No event today")}</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>{T2("Event day cooking tasks will appear here when there's a function scheduled for today.")}</div>
            {tomorrowEvs.length>0&&(
              <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:10,background:C.goldBg,border:`1px solid ${C.border}`,fontSize:13,color:C.gold}}>
                <span>📅</span>
                <span>{T2("Next up")}: {tomorrowLabel} — {tomorrowEvs.map(e=>`${e.guest||"Function"} (${e.pax} pax)`).join(", ")}</span>
              </div>
            )}
            <div style={{marginTop:16}}>
              <button onClick={()=>setTab("d1")} style={{padding:"10px 20px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:13,fontWeight:500,cursor:"pointer"}}>{T2("Go to Prep day")} →</button>
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

        // Build dishes — filtered by selected function or combined
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
        Object.keys(byDishD1).forEach(name=>{
          const sopSteps = getStepsForDish(name);
          if(sopSteps.length>0 && !sopSteps.some(s=>s.d1)) delete byDishD1[name];
        });
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
            {/* ── Function selector tabs ── */}
            {d1Evs.length>1&&(
              <div style={{display:"flex",gap:0,borderRadius:12,overflow:"hidden",border:`1.5px solid ${C.border}`,marginBottom:16}}>
                <button onClick={()=>setD1FnFilter("combined")}
                  style={{flex:1,padding:"12px 10px",border:"none",cursor:"pointer",background:isCombined?C.gold:"transparent",textAlign:"center",minHeight:52}}>
                  <div style={{fontSize:13,fontWeight:isCombined?700:500,color:isCombined?"#fff":C.text}}>🍳 Combined</div>
                  <div style={{fontSize:11,color:isCombined?"rgba(255,255,255,.8)":C.muted,marginTop:2}}>{combinedPax} pax · {d1Evs.length} functions</div>
                </button>
                {d1Evs.map(ev=>{
                  const isSel=d1FnFilter===ev.id;
                  const odcWarn=ev.venue==="Outdoor Catering (ODC)"&&!ev.odc_menu_confirmed;
                  return(
                    <button key={ev.id} onClick={()=>setD1FnFilter(ev.id)}
                      style={{flex:1,padding:"12px 10px",border:"none",borderLeft:`1px solid ${C.border}`,cursor:"pointer",background:isSel?C.gold:odcWarn?C.amberBg:"transparent",textAlign:"center",minHeight:52}}>
                      <div style={{fontSize:13,fontWeight:isSel?700:500,color:isSel?"#fff":C.text}}>{ev.guest||"Function"}{odcWarn&&<span style={{marginLeft:4,fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:4,background:isSel?"rgba(255,255,255,.3)":C.amber,color:isSel?"#fff":"#fff"}}>⚠ menu</span>}</div>
                      <div style={{fontSize:11,color:isSel?"rgba(255,255,255,.8)":C.muted,marginTop:2}}>{ev.pax} pax · {ev.odc_location||ev.venue||""} · {ev.time||"TBD"}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Summary card ── */}
            {(()=>{
              const pct=totalD1>0?Math.round(totalD1Done/totalD1*100):0;
              const headerLabel = isCombined
                ? `${d1Label} ${T2("prep")} — ${T2("Combined")}`
                : `${d1Label} — ${activeEv?.guest||"Function"}`;
              return(
                <div style={{background:C.surface,borderLeft:`3px solid ${isCombined?C.gold:C.green}`,border:`1.5px solid ${C.border}`,borderLeftWidth:3,borderRadius:10,padding:"14px 16px",marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:500,color:isCombined?C.gold:C.green,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{headerLabel}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                    <div style={{fontSize:22,fontWeight:500,color:isCombined?C.gold:C.green,lineHeight:1.1}}>{totalD1Pax||"—"} <span style={{fontSize:12,fontWeight:400,color:C.muted}}>pax</span></div>
                    <div style={{fontSize:11,color:C.muted}}>{totalD1Done} / {totalD1} {T2("done")}</div>
                  </div>
                  <div style={{height:3,background:C.border,borderRadius:2,marginTop:8,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:isCombined?C.gold:C.green,borderRadius:2,transition:"width .3s"}}/></div>
                  {isCombined?(
                    <div style={{fontSize:11,color:C.muted,marginTop:6}}>{d1Evs.map(e=>`${e.guest||"Function"} (${e.pax} pax · ${e.time||"TBD"})`).join(" · ")}</div>
                  ):(
                    <div style={{fontSize:11,color:C.muted,marginTop:6}}>{activeEv?.guest} · {activeEv?.venue||""} · {activeEv?.pax} pax · {activeEv?.time||"TBD"}{activeEv?.menu_package?" · "+activeEv.menu_package:""}</div>
                  )}
                  {!isCombined&&(
                    <div style={{marginTop:8,padding:"6px 10px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,fontSize:10,color:C.amber}}>
                      💡 {T2("Viewing single function. Prep is done collectively — switch to Combined for cooking, use this view for dispatch sign-off.")}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Section-wise view ── */}
            {isSectionUser ? (
            /* ═══ TABLET VIEW — large, chef-friendly ═══ */
            allSecs.length===0
              ? <div style={{padding:"40px 20px",textAlign:"center",borderRadius:14,border:`1.5px solid ${C.border}`,background:C.surface}}><div style={{fontSize:18,color:C.muted}}>🍳 {T2("No dishes to prep")}</div></div>
              : allSecs.map(sec=>{
                const secItems = bySecD1[sec]||[];
                const catObj2 = RECIPE_DB.cats.find(c=>c.id===sec);
                const m2 = {color:catObj2?.color||C.muted,icon:catObj2?.icon||"🍽"};
                const secOpen = isSecOpen("d1sec_"+sec);
                if(secItems.length===0) return null;
                const doneCount = secItems.filter(d=>ds(d.fEvId,d.fIdx,d.name).mesaDone).length;
                const totalCount = secItems.length;
                const secPct = totalCount>0?Math.round(doneCount/totalCount*100):0;
                return(
                  <div key={sec} style={{marginBottom:14,borderRadius:14,border:`1.5px solid ${C.border}`,background:C.surface}}>
                    <div onClick={()=>toggleSec("d1sec_"+sec)} style={{padding:"18px 22px",cursor:"pointer",borderBottom:secOpen?`1.5px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:70}}>
                      <div style={{display:"flex",alignItems:"center",gap:14}}>
                        <div style={{width:46,height:46,borderRadius:12,background:m2.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{m2.icon}</div>
                        <div><div style={{fontSize:20,fontWeight:700,color:m2.color}}>{T2(catObj2?.name||sec)}</div><div style={{fontSize:14,color:C.muted}}>{totalCount} {T2("dishes")}</div></div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:14}}>
                        <div style={{padding:"6px 14px",borderRadius:10,background:m2.color+"18",fontSize:16,fontWeight:700,color:m2.color}}>{doneCount} / {totalCount}</div>
                        <div style={{width:80,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:secPct+"%",background:m2.color,borderRadius:3,transition:"width .3s"}}/></div>
                        <span style={{fontSize:20,color:C.faint,transform:secOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}>▾</span>
                      </div>
                    </div>
                    {secOpen&&<div style={{padding:"10px 14px 14px"}}>
                      {secItems.map((dish,di)=>{
                        const isDone = !!ds(dish.fEvId,dish.fIdx,dish.name).mesaDone;
                        const cKey = `d1dish_${dish.name.replace(/\s/g,"_")}`;
                        const isExp = expandedDishes.has(cKey);
                        const sp = dish.specials&&dish.specials.length>0 ? dish.specials.map(s=>s.instruction).join(", ") : "";
                        return(
                          <div key={dish.name} style={{marginBottom:10,borderRadius:12,border:`1.5px solid ${isDone?C.greenBorder:isExp?m2.color:C.border}`,background:C.surface}}>
                            <div onClick={()=>toggleDish(cKey)} style={{padding:"16px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:16,minHeight:64,background:isDone?C.greenBg+"60":"transparent"}}>
                              <div style={{width:36,height:36,borderRadius:10,background:isDone?C.green:C.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16,fontWeight:700,color:isDone?"#fff":C.muted}}>{isDone?"✓":di+1}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:18,fontWeight:600,color:isDone?C.green:C.text,textDecoration:isDone?"line-through":"none"}}>{dish.name}</div>
                                <div style={{fontSize:14,color:C.muted,marginTop:2}}>{dish.fns.length} {T2("event")}{dish.fns.length>1?"s":""}{sp?<span style={{marginLeft:8,padding:"2px 8px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,fontSize:12,color:C.red}}>⚠ {sp}</span>:null}</div>
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:20,fontWeight:700,color:isDone?C.green:m2.color}}>{dish.totalPax}</div><div style={{fontSize:12,color:C.muted}}>pax</div></div>
                              <span style={{fontSize:18,color:C.faint,flexShrink:0}}>{isExp?"▼":"▶"}</span>
                            </div>
                            {isExp&&(()=>{
                              const d2s=ds(dish.fEvId,dish.fIdx,dish.name);
                              const allStepsFn = getStepsForDish(dish.name);
                              const d1Only = allStepsFn.filter(s=>s.d1);
                              const steps = d1Only.length>0?d1Only:[{t:"Mesa",i:"Wash, cut, measure all ingredients",tm:600,d1:true},{t:"Primary prep",i:"Prepare base masala / paste",tm:480,d1:true}];
                              const ssStarted=!!d2s.storeStart;const ssDone=!!d2s.storeEnd;
                              const ssEl=ssStarted&&!ssDone?Math.floor((Date.now()-(d2s.storeStart||0))/1000):0;
                              const ssRem=Math.max(0,1800-ssEl);const ssPct=ssStarted?Math.min(100,Math.round(ssEl/1800*100)):0;
                              return(
                                <div style={{padding:"12px 20px 20px",borderTop:`1.5px solid ${C.border}`}}>
                                  <div style={{padding:16,marginBottom:14,borderRadius:12,border:`2px solid ${ssDone?C.greenBorder:ssStarted?C.amberBorder:C.border}`,background:ssDone?C.greenBg:ssStarted?C.amberBg:C.bg}}>
                                    <div style={{display:"flex",gap:14,alignItems:"center"}}>
                                      <div style={{width:40,height:40,borderRadius:10,background:ssDone?C.green:ssStarted?C.amber:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#fff",flexShrink:0}}>{ssDone?"✓":"0"}</div>
                                      <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:ssDone?C.green:ssStarted?C.amber:C.text}}>🏪 {T2("Collect from store")}</div><div style={{fontSize:13,color:C.muted}}>30 min — {T2("collect all ingredients")}</div></div>
                                    </div>
                                    {ssStarted&&!ssDone&&<div style={{marginTop:10}}><div style={{height:8,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:ssPct+"%",background:C.amber,borderRadius:4,transition:"width 1s"}}/></div><div style={{fontSize:14,color:C.amber,fontWeight:700,marginTop:4}}>⏱ {Math.floor(ssEl/60)}m {ssEl%60}s / 30m — {Math.floor(ssRem/60)}m left</div></div>}
                                    {!ssStarted&&!ssDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeStart:Date.now()},dish)} style={{padding:"14px 20px",borderRadius:12,width:"100%",background:C.gold,color:"#fff",border:"none",fontSize:16,fontWeight:700,cursor:"pointer",minHeight:54,marginTop:10}}>🏃 {T2("Go Collect")} — 30 min</button>}
                                    {ssStarted&&!ssDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeEnd:Date.now()},dish)} style={{padding:"14px 20px",borderRadius:12,width:"100%",background:C.green,color:"#fff",border:"none",fontSize:16,fontWeight:700,cursor:"pointer",minHeight:54,marginTop:10}}>⏹ {T2("Done")} — {T2("Items collected")}</button>}
                                    {ssDone&&<div style={{fontSize:14,color:C.green,fontWeight:700,marginTop:8}}>✅ {T2("Store sourcing complete")}</div>}
                                  </div>
                                  {(()=>{const pax=dish.totalPax||0;const ing=getIngrForDish(dish.name,pax);if(!ing||ing.length===0)return null;const isNew=ing[0]?._newFmt;return(
                                    <div style={{background:C.bg,borderRadius:10,padding:"12px 16px",marginBottom:14,border:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:5}}>
                                      <div style={{fontSize:14,fontWeight:700,color:ssDone?C.green:C.gold,marginBottom:8}}>{ssDone?"📊":"🧺"} {ssDone?T2("Ingredients"):T2("Items to collect")} — {pax} pax</div>
                                      <div style={{display:"flex",flexWrap:"wrap",gap:"6px 16px"}}>{ing.filter(i=>i.q>0).map((i,ii)=>{const raw=isNew?i.q:(()=>{const eff=effectiveScales[dish.fEvId];const pct=eff?.percent||(pax>0?Math.round(pax/BASE_PAX*100):100);return i.q*pax*(pct/100);})();const qty=i.u==="g"||i.u==="gm"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g"):i.u==="ml"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml"):i.u==="pcs"?Math.ceil(raw)+" pcs":i.u==="kg"?(raw.toFixed(1).replace(/\.0$/,""))+" kg":i.u==="L"?(raw.toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" "+i.u;return <span key={ii} style={{fontSize:14,color:C.text}}>{i.n}: <b style={{color:C.gold}}>{qty}</b></span>;})}</div>
                                    </div>);})()}
                                  <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>{T2("Steps")} — {steps.length}</div>
                                  {steps.map((step,si)=>{const d2d=ds(dish.fEvId,dish.fIdx,dish.name);const sk="step_"+si;const hasSubs=Array.isArray(step.subs)&&step.subs.length>0;
                                    const subsDone=hasSubs?step.subs.every((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])):false;
                                    const stS=!!(d2d.starts&&d2d.starts[sk]);const stM=hasSubs?subsDone:!!(d2d.manual&&d2d.manual[sk]);const stDone=stM;
                                    const stEl=stS?Math.floor((Date.now()-(d2d.starts[sk]||Date.now()))/1000):0;const stOverdue=stS&&step.tm&&stEl>=step.tm&&!stDone;const stRem=step.tm?Math.max(0,step.tm-stEl):0;const stPct2=step.tm>0?Math.min(100,Math.round(stEl/step.tm*100)):0;const pk="step_"+(si-1);
                                    const prevStepHasSubs=si>0&&Array.isArray(steps[si-1].subs)&&steps[si-1].subs.length>0;
                                    const prevD=si===0?(!!d2d.storeEnd):(prevStepHasSubs?steps[si-1].subs.every((_,sbi)=>!!(d2d.manual&&d2d.manual[pk+"_sub_"+sbi])):!!(d2d.manual&&d2d.manual[pk]));
                                    return(
                                    <div key={si} style={{padding:"14px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",...(step.ccp&&!stDone?{background:C.redBg,borderLeft:`3px solid ${C.red}`,marginLeft:-12,paddingLeft:12,borderRadius:6}:{})}}>
                                      <div style={{display:"flex",gap:14,alignItems:"center"}}>
                                      <div style={{width:38,height:38,borderRadius:10,background:stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.darkCard,border:`2px solid ${stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:stDone||stS?"#fff":step.ccp?"#fff":C.muted,flexShrink:0}}>{stDone?"✓":si+1}</div>
                                      <div style={{flex:1}}>
                                        <div style={{fontSize:16,fontWeight:600,color:stDone?C.green:stS?C.amber:C.text,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(step.t)}{hasSubs&&!stDone&&<span style={{fontSize:12,color:C.muted,marginLeft:8}}>({step.subs.filter((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])).length}/{step.subs.length})</span>}</div>
                                        {(()=>{const d2=cleanStepText(step.i||step.desc||"");const t2=cleanStepText(step.t);if(!d2||t2.includes(d2)||d2.includes(t2))return null;return <div style={{fontSize:13,color:C.muted,marginTop:2}}>{d2}</div>;})()}
                                        {step.ccp&&<div style={{fontSize:13,color:C.red,marginTop:3}}>🔴 {cleanStepText(step.ccp)}</div>}
                                        {!hasSubs&&stS&&!stDone&&step.tm>0&&<div style={{marginTop:6}}><div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,stPct2)+"%",background:stOverdue?C.red:C.amber,borderRadius:3,transition:"width 1s"}}/></div>{stOverdue?<div style={{fontSize:13,color:C.red,fontWeight:700,marginTop:3}}>⏱ {T2("Overdue")} — {T2("tap Done")}</div>:<div style={{fontSize:13,color:C.amber,marginTop:3}}>⏱ {Math.floor(stEl/60)}m {stEl%60}s — {Math.floor(stRem/60)}m left</div>}</div>}
                                        {!hasSubs&&stDone&&(()=>{const de=d2d.doneElapsed?.[sk];if(de==null||!step.tm){return <div style={{fontSize:13,color:C.green,marginTop:3}}>✅ done</div>;}const ov=de>step.tm;const un=de<step.tm;const df=Math.abs(de-step.tm);const dm=Math.floor(df/60);const dss=df%60;return <div style={{fontSize:13,color:ov?C.red:C.green,marginTop:3}}>✅ {Math.floor(de/60)}m{de%60>0?` ${de%60}s`:""} done{ov?<span style={{color:C.red,fontWeight:600}}> 🔴 +{dm>0?dm+"m ":""}{dss}s over</span>:un&&df>0?<span style={{color:C.green,fontWeight:600}}> 🟢 {dm>0?dm+"m ":""}{dss}s under</span>:""}</div>;})()}
                                        {hasSubs&&stDone&&<div style={{fontSize:13,color:C.green,marginTop:3}}>✅ all sub-steps done</div>}
                                        {!hasSubs&&!stS&&!stDone&&step.tm>0&&<div style={{fontSize:13,color:C.faint,marginTop:3}}>⏱ {fmtT(step.tm)}</div>}
                                      </div>
                                      <div style={{flexShrink:0}}>
                                        {!hasSubs&&stS&&!stDone&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})},doneElapsed:{...(d2d.doneElapsed||{}),[sk]:el}},dish);}} style={{padding:"12px 18px",borderRadius:10,background:stOverdue?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48}}>{stOverdue?"⚠":"✓"} {T2("Done")}</button>}
                                        {!hasSubs&&!stS&&!stDone&&step.tm>0&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={starts:{...(d2d.starts||{}),[sk]:Date.now()}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"12px 18px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48}}>▶ {Math.floor(step.tm/60)}m</button>}
                                        {!hasSubs&&!stS&&!stDone&&!step.tm&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})},doneElapsed:{...(d2d.doneElapsed||{}),[sk]:0}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"12px 18px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48}}>✓</button>}
                                        {hasSubs&&!stDone&&<span style={{fontSize:12,color:C.muted}}>↓</span>}
                                        {!hasSubs&&!stS&&!stDone&&!prevD&&<div style={{padding:"12px 14px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,fontSize:15,color:C.faint,minHeight:48,display:"flex",alignItems:"center"}}>🔒</div>}
                                        {stDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:false},starts:{...(d2d.starts||{}),[sk]:null}},dish);}} style={{padding:"6px 10px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:11,cursor:"pointer"}}>↩ Undo</button>}
                                      </div>
                                      </div>
                                      {hasSubs&&(
                                        <div style={{borderLeft:`2.5px solid ${stDone?C.green:stS?C.amber:C.gold}`,marginLeft:19,marginTop:10,paddingLeft:16,opacity:(stS||prevD||stDone)?1:0.5}}>
                                          {step.subs.map((sb,sbi)=>{
                                            const sbk=sk+"_sub_"+sbi;const sbDone=!!(d2d.manual&&d2d.manual[sbk]);
                                            const sbPrevD=sbi===0?prevD:!!(d2d.manual&&d2d.manual[sk+"_sub_"+(sbi-1)]);
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
                                                  <div style={{width:28,height:28,borderRadius:8,background:sbDone?C.green+"20":sbStarted?(sbOver?C.red+"20":C.amber+"20"):C.darkCard,border:`1.5px solid ${sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.muted,flexShrink:0,marginTop:1}}>{sbDone?"✓":(si+1)+String.fromCharCode(97+sbi)}</div>
                                                  <div style={{flex:1,minWidth:0}}>
                                                    <div style={{fontSize:13,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.text,lineHeight:1.5,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.t)}</div>
                                                    {sb.i&&<div style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.i)}</div>}
                                                    {sbStarted&&!sbDone&&sb.tm>0&&<div style={{marginTop:4}}><div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,sbPct)+"%",background:sbOver?C.red:C.amber,borderRadius:3,transition:"width 1s"}}/></div>{sbOver?<div style={{fontSize:12,color:C.red,fontWeight:700,marginTop:3}}>⏱ {T2("Overdue")} — {T2("tap Done")}</div>:<div style={{fontSize:12,color:C.amber,marginTop:3}}>⏱ {Math.floor(sbEl/60)}m {sbEl%60}s — {Math.floor(sbRem/60)}m left</div>}</div>}
                                                    {sbDone&&sbHasDoneEl&&<div style={{fontSize:12,marginTop:3,color:sbWasOver?C.red:C.green}}>✅ {Math.floor(sbDE/60)}m{sbDE%60>0?` ${sbDE%60}s`:""}{sbWasOver?<span style={{fontWeight:600}}> 🔴 +{Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s over</span>:<span style={{fontWeight:600}}> 🟢 {Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s under</span>}</div>}
                                                    {sbDone&&!sbHasDoneEl&&d2d.manualAt?.[sbk]&&<div style={{fontSize:12,color:C.green,marginTop:3}}>✅ {d2d.manualAt[sbk]}</div>}
                                                    {!sbDone&&!sbStarted&&sb.tm>0&&<div style={{fontSize:12,color:C.faint,marginTop:3}}>⏱ {sb.tm>=60?Math.floor(sb.tm/60)+"m":sb.tm+"s"}</div>}
                                                  </div>
                                                  <div style={{flexShrink:0}}>
                                                    {!sbDone&&sbPrevD&&!sbStarted&&sb.tm>0&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{starts:{...(d2d.starts||{}),[sbk]:Date.now()}},dish);}} style={{padding:"8px 16px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>▶ {Math.floor(sb.tm/60)}m</button>}
                                                    {!sbDone&&sbPrevD&&!sbStarted&&!sb.tm&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}};if(sbi===step.subs.length-1){upd.doneElapsed={...(d2d.doneElapsed||{}),[sk]:d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0};}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>✓ {T2("Done")}</button>}
                                                    {!sbDone&&sbStarted&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sbk]?Math.floor((Date.now()-d2d.starts[sbk])/1000):0;const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})},doneElapsed:{...(d2d.doneElapsed||{}),[sbk]:el}};if(sbi===step.subs.length-1){upd.doneElapsed[sk]=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"8px 16px",borderRadius:10,background:sbOver?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>{sbOver?"⚠":"✓"} {T2("Done")}</button>}
                                                    {!sbDone&&!sbPrevD&&<div style={{padding:"8px 12px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,fontSize:13,color:C.faint}}>🔒</div>}
                                                    {sbDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sbk]:false},starts:{...(d2d.starts||{}),[sbk]:null}},dish);}} style={{padding:"4px 8px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:10,cursor:"pointer"}}>↩</button>}
                                                  </div>
                                                </div>
                                              </div>);
                                          })}
                                        </div>
                                      )}
                                    </div>);})}
                                  {(()=>{if(isDone)return(<div style={{padding:"12px 0",textAlign:"center"}}><div style={{fontSize:14,color:C.green,fontWeight:700}}>✅ {T2("Prep complete")}{d2s.dishCompletedAt?" — "+new Date(d2s.dishCompletedAt).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):""}</div></div>);const allSD=ssDone&&steps.every((step,si)=>{const sk="step_"+si;const hs=Array.isArray(step.subs)&&step.subs.length>0;if(hs)return step.subs.every((_,sbi)=>!!(d2s.manual&&d2s.manual[sk+"_sub_"+sbi]));return !!(d2s.manual&&d2s.manual[sk]);});if(!allSD)return(<div style={{padding:"12px 0",textAlign:"center"}}><div style={{padding:"14px",borderRadius:12,background:C.faint+"30",border:"1.5px dashed "+C.border,color:C.muted,fontSize:14}}>🔒 {T2("Complete all steps to mark prep done")}</div></div>);const elapsed=d2s.dishStartedAt?Math.floor((Date.now()-d2s.dishStartedAt)/60000):0;return(<div>{elapsed>0&&<div style={{fontSize:13,color:C.muted,textAlign:"center",marginBottom:6}}>⏱ {T2("Total time")}: {elapsed} min</div>}<button onClick={e=>{e.stopPropagation();openUsageModal(dish,dish.totalPax,true,()=>{setDs(dish.fEvId,dish.fIdx,{mesaDone:true,dishCompletedAt:Date.now()},dish);});}} style={{width:"100%",padding:"16px",borderRadius:12,background:C.green,color:"#fff",border:"none",fontSize:18,fontWeight:700,cursor:"pointer",minHeight:56}}>✅ {T2("Mark prep done")} — {dish.totalPax} pax</button></div>);})()}
                                </div>);})()}
                            
                          </div>);
                      })}
                    </div>}
                  </div>);})
            ) : (
            /* ═══ ADMIN VIEW — compact ═══ */
            allSecs.map(sec=>{
              const secItems = bySecD1[sec]||[];
              const catObj = RECIPE_DB.cats.find(c=>c.id===sec);
              const secDisplayName = catObj ? catObj.name : sec;
              const m2 = {color:catObj?.color||C.muted,icon:catObj?.icon||"🍽"};
              const displayIcon = catObj?.icon || "🍽";
              const secOpen = isSecOpen("d1sec_"+sec);
              if(secItems.length===0) return null;
              const doneCount = secItems.filter(d=>ds(d.fEvId,d.fIdx,d.name).mesaDone).length;
              const totalCount = secItems.length;
              const secPct = totalCount>0?Math.round(doneCount/totalCount*100):0;
              return(
                <div key={sec} style={{marginBottom:8,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface}}>
                  <div onClick={()=>toggleSec("d1sec_"+sec)} style={{padding:"12px 16px",cursor:"pointer",borderBottom:secOpen?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16}}>{displayIcon}</span>
                      <span style={{fontSize:14,fontWeight:500,color:m2.color}}>{T2(secDisplayName)}</span>
                      <span style={{fontSize:12,color:C.muted}}>{totalCount} {T2("dishes")}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:12,fontWeight:500,color:m2.color}}>{doneCount} / {totalCount}</span>
                      <div style={{width:60,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:secPct+"%",background:m2.color,borderRadius:2,transition:"width .3s"}}/></div>
                      <span style={{fontSize:14,color:C.faint,transform:secOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                    </div>
                  </div>
                  {secOpen&&<div style={{padding:"8px 12px"}}>
                    {secItems.map(dish=>{
                      const dishName = dish.name;
                      const cKey = `d1dish_${dishName.replace(/\s/g,"_")}`;
                      const isExp = expandedDishes.has(cKey);
                      const allStepsFn = getStepsForDish(dishName);
                      const d1Only = allStepsFn.filter(s=>s.d1);
                      const steps = d1Only.length>0?d1Only:[{t:"Mesa",i:"Wash, cut, measure all ingredients",tm:600,d1:true},{t:"Primary prep",i:"Prepare base masala / paste",tm:480,d1:true}];
                      const isDone = !!ds(dish.fEvId,dish.fIdx,dish.name).mesaDone;
                      return(
                        <div key={dishName} style={{marginBottom:6}}>
                          <div onClick={()=>toggleDish(cKey)} style={{cursor:"pointer",borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                            <div style={{padding:"10px 14px",background:isDone?C.greenBg:C.darkCard,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <div style={{width:18,height:18,borderRadius:5,background:isDone?C.green:C.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isDone&&<span style={{fontSize:9,fontWeight:700,color:"#fff"}}>✓</span>}</div>
                                <div><div style={{fontSize:12,fontWeight:700,color:isDone?C.green:C.text,textDecoration:isDone?"line-through":"none"}}>{dishName}</div><div style={{fontSize:10,color:C.faint}}>{dish.totalPax} pax · {d1Label}</div></div>
                              </div>
                              <span style={{fontSize:12,color:C.muted}}>{isExp?"▼":"▶"}</span>
                            </div>
                          </div>

                          {isExp&&(()=>{
                            const d2s=ds(dish.fEvId,dish.fIdx,dish.name);
                            const ssStarted=!!d2s.storeStart;const ssDone=!!d2s.storeEnd;
                            const ssEl=ssStarted&&!ssDone?Math.floor((Date.now()-(d2s.storeStart||0))/1000):0;
                            const ssRem=Math.max(0,1800-ssEl);const ssPct=ssStarted?Math.min(100,Math.round(ssEl/1800*100)):0;
                            return(
                              <div style={{padding:"8px 12px",borderRadius:"0 0 10px 10px",background:C.surface,border:`1px solid ${C.border}`,borderTop:"none"}}>
                                <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>📋 {T2("Steps")} — {steps.length}</div>
                                <div style={{padding:12,marginBottom:10,borderRadius:10,border:`2px solid ${ssDone?C.greenBorder:ssStarted?C.amberBorder:C.border}`,background:ssDone?C.greenBg:ssStarted?C.amberBg:C.surface}}>
                                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                                    <div style={{width:32,height:32,borderRadius:8,background:ssDone?C.green:ssStarted?C.amber:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>{ssDone?"✓":"0"}</div>
                                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:ssDone?C.green:ssStarted?C.amber:C.text}}>🏪 Collect Items from Store</div><div style={{fontSize:11,color:C.muted}}>30 min stoppable timer — collect all ingredients</div></div>
                                  </div>
                                  {ssStarted&&!ssDone&&<div style={{marginTop:8}}><div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:ssPct+"%",background:C.amber,borderRadius:3,transition:"width 1s"}}/></div><div style={{fontSize:11,color:C.amber,fontWeight:700,marginTop:3}}>⏱ {Math.floor(ssEl/60)}m {ssEl%60}s / 30m — {Math.floor(ssRem/60)}m left</div></div>}
                                  {!ssStarted&&!ssDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeStart:Date.now()},dish)} style={{padding:"10px 16px",borderRadius:8,width:"100%",background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40,marginTop:8}}>🏃 Go Collect Items — Start 30 min Timer</button>}
                                  {ssStarted&&!ssDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeEnd:Date.now()},dish)} style={{padding:"10px 16px",borderRadius:8,width:"100%",background:`linear-gradient(135deg,${C.green},#147A54)`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40,marginTop:6}}>⏹ Done — Items Collected</button>}
                                  {ssDone&&<div style={{fontSize:12,color:C.green,fontWeight:700,marginTop:6}}>✅ Store sourcing complete — ready to cook</div>}
                                </div>
                                {(()=>{const pax=dish.totalPax||0;const ing=getIngrForDish(dishName,pax);if(!ing||ing.length===0)return null;const isNew=ing[0]?._newFmt;return(
                                  <div style={{background:C.bg,borderRadius:8,padding:"8px 12px",marginBottom:8,border:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:5}}>
                                    <div style={{fontSize:11,fontWeight:700,color:ssDone?C.green:C.gold,marginBottom:5}}>{ssDone?"📊":"🧺"} {ssDone?T2("Ingredients"):T2("Items to collect")} — {pax} pax</div>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:"3px 10px"}}>{ing.filter(i=>i.q>0).map((i,ii)=>{const raw=isNew?i.q:(()=>{const eff=effectiveScales[dish.fEvId];const pct=eff?.percent||(pax>0?Math.round(pax/BASE_PAX*100):100);return i.q*pax*(pct/100);})();const qty=i.u==="g"||i.u==="gm"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g"):i.u==="ml"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml"):i.u==="pcs"?Math.ceil(raw)+" pcs":i.u==="kg"?(raw.toFixed(1).replace(/\.0$/,""))+" kg":i.u==="L"?(raw.toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" "+i.u;return <span key={ii} style={{fontSize:11,color:C.text}}>{i.n}: <b style={{color:C.gold}}>{qty}</b></span>;})}</div>
                                  </div>);})()}
                                {steps.map((step,si)=>{const d2d=ds(dish.fEvId,dish.fIdx,dish.name);const sk="step_"+si;const hasSubs=Array.isArray(step.subs)&&step.subs.length>0;
                                    const subsDone=hasSubs?step.subs.every((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])):false;
                                    const stS=!!(d2d.starts&&d2d.starts[sk]);const stM=hasSubs?subsDone:!!(d2d.manual&&d2d.manual[sk]);const stDone=stM;
                                    const stEl=stS?Math.floor((Date.now()-(d2d.starts[sk]||Date.now()))/1000):0;const stOverdue=stS&&step.tm&&stEl>=step.tm&&!stDone;const stRem=step.tm?Math.max(0,step.tm-stEl):0;const stPct2=step.tm>0?Math.min(100,Math.round(stEl/step.tm*100)):0;const pk="step_"+(si-1);
                                    const prevStepHasSubs=si>0&&Array.isArray(steps[si-1].subs)&&steps[si-1].subs.length>0;
                                    const prevD=si===0?(!!d2d.storeEnd):(prevStepHasSubs?steps[si-1].subs.every((_,sbi)=>!!(d2d.manual&&d2d.manual[pk+"_sub_"+sbi])):!!(d2d.manual&&d2d.manual[pk]));
                                    return(
                                  <div key={si} style={{padding:"8px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",...(step.ccp&&!stDone?{background:C.redBg,borderLeft:`3px solid ${C.red}`,marginLeft:-8,paddingLeft:8,borderRadius:4}:{})}}>
                                    <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                                    <div style={{width:26,height:26,borderRadius:7,background:stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.darkCard,border:`2px solid ${stDone?C.green:stS?(stOverdue?C.red:C.amber):step.ccp?C.red:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:stDone||stS?"#fff":step.ccp?"#fff":C.muted,flexShrink:0,marginTop:2}}>{stDone?"✓":si+1}</div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,fontWeight:600,color:stDone?C.green:stS?C.amber:C.text,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(step.t)}{hasSubs&&!stDone&&<span style={{fontSize:10,color:C.muted,marginLeft:6}}>({step.subs.filter((_,sbi)=>!!(d2d.manual&&d2d.manual[sk+"_sub_"+sbi])).length}/{step.subs.length})</span>}</div>
                                      {(()=>{const d2=cleanStepText(step.i||step.desc||"");const t2=cleanStepText(step.t);if(!d2||t2.includes(d2)||d2.includes(t2))return null;return <div style={{fontSize:11,color:C.muted,marginTop:1}}>{d2}</div>;})()}
                                      {step.ccp&&<div style={{fontSize:10,color:C.red,marginTop:2}}>🔴 {cleanStepText(step.ccp)}</div>}
                                      {!hasSubs&&stS&&!stDone&&step.tm>0&&<div style={{marginTop:4}}><div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,stPct2)+"%",background:stOverdue?C.red:C.amber,borderRadius:2,transition:"width 1s"}}/></div>{stOverdue?<div style={{fontSize:10,color:C.red,fontWeight:700,marginTop:2}}>⏱ Overdue — tap Done</div>:<div style={{fontSize:10,color:C.amber,marginTop:2}}>⏱ {Math.floor(stEl/60)}m {stEl%60}s — {Math.floor(stRem/60)}m left</div>}</div>}
                                      {!hasSubs&&stDone&&(()=>{const de=d2d.doneElapsed?.[sk];if(de==null||!step.tm){return <div style={{fontSize:10,color:C.green,marginTop:2}}>✅ done</div>;}const ov=de>step.tm;const un=de<step.tm;const df=Math.abs(de-step.tm);const dm=Math.floor(df/60);const dss=df%60;return <div style={{fontSize:10,color:ov?C.red:C.green,marginTop:2}}>✅ {Math.floor(de/60)}m{de%60>0?` ${de%60}s`:""} done{ov?<span style={{color:C.red,fontWeight:600}}> 🔴 +{dm>0?dm+"m ":""}{dss}s over</span>:un&&df>0?<span style={{color:C.green,fontWeight:600}}> 🟢 {dm>0?dm+"m ":""}{dss}s under</span>:""}</div>;})()}
                                      {hasSubs&&stDone&&<div style={{fontSize:10,color:C.green,marginTop:2}}>✅ all sub-steps done</div>}
                                      {!hasSubs&&!stS&&!stDone&&step.tm>0&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>⏱ {fmtT(step.tm)}</div>}
                                    </div>
                                    <div style={{flexShrink:0}}>
                                      {!hasSubs&&stS&&!stDone&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})},doneElapsed:{...(d2d.doneElapsed||{}),[sk]:el}},dish);}} style={{padding:"6px 10px",borderRadius:8,background:stOverdue?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",minHeight:32}}>{stOverdue?"⚠":"✓"} Done</button>}
                                      {!hasSubs&&!stS&&!stDone&&step.tm>0&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={starts:{...(d2d.starts||{}),[sk]:Date.now()}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 10px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",minHeight:32}}>▶ {Math.floor(step.tm/60)}m</button>}
                                      {!hasSubs&&!stS&&!stDone&&!step.tm&&prevD&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sk]:true},manualAt:{...(d2d.manualAt||{}),[sk]:new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}};if(si===0&&!d2d.dishStartedAt)upd.dishStartedAt=Date.now();setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 10px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:10,fontWeight:600,cursor:"pointer",minHeight:32}}>✓</button>}
                                      {hasSubs&&!stDone&&<span style={{fontSize:10,color:C.muted}}>↓</span>}
                                      {!hasSubs&&!stS&&!stDone&&!prevD&&<div style={{padding:"6px 8px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,fontSize:11,color:C.faint,minHeight:32,display:"flex",alignItems:"center"}}>🔒</div>}
                                      {stDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sk]:false},starts:{...(d2d.starts||{}),[sk]:null}},dish);}} style={{padding:"4px 8px",borderRadius:6,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:10,cursor:"pointer"}}>↩</button>}
                                    </div>
                                    </div>
                                    {hasSubs&&(
                                      <div style={{borderLeft:`2.5px solid ${stDone?C.green:stS?C.amber:C.gold}`,marginLeft:13,marginTop:6,paddingLeft:12,opacity:(stS||prevD||stDone)?1:0.5}}>
                                        {step.subs.map((sb,sbi)=>{
                                          const sbk=sk+"_sub_"+sbi;const sbDone=!!(d2d.manual&&d2d.manual[sbk]);
                                          const sbPrevD=sbi===0?prevD:!!(d2d.manual&&d2d.manual[sk+"_sub_"+(sbi-1)]);
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
                                                <div style={{width:24,height:24,borderRadius:6,background:sbDone?C.green+"20":sbStarted?(sbOver?C.red+"20":C.amber+"20"):C.darkCard,border:`1.5px solid ${sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.muted,flexShrink:0,marginTop:1}}>{sbDone?"✓":(si+1)+String.fromCharCode(97+sbi)}</div>
                                                <div style={{flex:1,minWidth:0}}>
                                                  <div style={{fontSize:12,fontWeight:600,color:sbDone?C.green:sbStarted?(sbOver?C.red:C.amber):C.text,lineHeight:1.5,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.t)}</div>
                                                  {sb.i&&<div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{cleanStepText(sb.i)}</div>}
                                                  {sbStarted&&!sbDone&&sb.tm>0&&<div style={{marginTop:3}}><div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,sbPct)+"%",background:sbOver?C.red:C.amber,borderRadius:2,transition:"width 1s"}}/></div>{sbOver?<div style={{fontSize:10,color:C.red,fontWeight:700,marginTop:2}}>⏱ Overdue — tap Done</div>:<div style={{fontSize:10,color:C.amber,marginTop:2}}>⏱ {Math.floor(sbEl/60)}m {sbEl%60}s — {Math.floor(sbRem/60)}m left</div>}</div>}
                                                  {sbDone&&sbHasDoneEl&&<div style={{fontSize:10,marginTop:2,color:sbWasOver?C.red:C.green}}>✅ {Math.floor(sbDE/60)}m{sbDE%60>0?` ${sbDE%60}s`:""}{sbWasOver?<span style={{fontWeight:600}}> 🔴 +{Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s over</span>:<span style={{fontWeight:600}}> 🟢 {Math.floor(sbDiffSec/60)>0?Math.floor(sbDiffSec/60)+"m ":""}{sbDiffSec%60}s under</span>}</div>}
                                                  {sbDone&&!sbHasDoneEl&&d2d.manualAt?.[sbk]&&<div style={{fontSize:10,color:C.green,marginTop:2}}>✅ {d2d.manualAt[sbk]}</div>}
                                                  {!sbDone&&!sbStarted&&sb.tm>0&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>⏱ {sb.tm>=60?Math.floor(sb.tm/60)+"m":sb.tm+"s"}</div>}
                                                </div>
                                                <div style={{flexShrink:0}}>
                                                  {!sbDone&&sbPrevD&&!sbStarted&&sb.tm>0&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{starts:{...(d2d.starts||{}),[sbk]:Date.now()}},dish);}} style={{padding:"6px 12px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>▶ {Math.floor(sb.tm/60)}m</button>}
                                                  {!sbDone&&sbPrevD&&!sbStarted&&!sb.tm&&<button onClick={e=>{e.stopPropagation();const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}};if(sbi===step.subs.length-1){upd.doneElapsed={...(d2d.doneElapsed||{}),[sk]:d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0};}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 12px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>✓ {T2("Done")}</button>}
                                                  {!sbDone&&sbStarted&&<button onClick={e=>{e.stopPropagation();const el=d2d.starts?.[sbk]?Math.floor((Date.now()-d2d.starts[sbk])/1000):0;const upd={manual:{...(d2d.manual||{}),[sbk]:true},manualAt:{...(d2d.manualAt||{}),[sbk]:new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})},doneElapsed:{...(d2d.doneElapsed||{}),[sbk]:el}};if(sbi===step.subs.length-1){upd.doneElapsed[sk]=d2d.starts?.[sk]?Math.floor((Date.now()-d2d.starts[sk])/1000):0;}setDs(dish.fEvId,dish.fIdx,upd,dish);}} style={{padding:"6px 12px",borderRadius:8,background:sbOver?`linear-gradient(135deg,${C.red},#801818)`:C.green,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>{sbOver?"⚠":"✓"} {T2("Done")}</button>}
                                                  {!sbDone&&!sbPrevD&&<div style={{padding:"6px 8px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,fontSize:11,color:C.faint}}>🔒</div>}
                                                  {sbDone&&!isDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2d.manual||{}),[sbk]:false},starts:{...(d2d.starts||{}),[sbk]:null}},dish);}} style={{padding:"3px 6px",borderRadius:5,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:9,cursor:"pointer"}}>↩</button>}
                                                </div>
                                              </div>
                                            </div>);
                                        })}
                                      </div>
                                    )}
                                  </div>);})}
                                {(()=>{const d2f=ds(dish.fEvId,dish.fIdx,dish.name);const elapsed=d2f.dishStartedAt?Math.floor((Date.now()-d2f.dishStartedAt)/60000):0;return(<div>{elapsed>0&&<div style={{fontSize:10,color:C.muted,textAlign:"center",marginBottom:4}}>⏱ {T2("Total time")}: {elapsed} min</div>}<button onClick={e=>{e.stopPropagation();openUsageModal(dish,dish.totalPax,true,()=>{setDs(dish.fEvId,dish.fIdx,{mesaDone:true,dishCompletedAt:Date.now()},dish);});}} style={{width:"100%",padding:"10px",borderRadius:8,background:C.green,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>✅ {T2("Mark prep done")} — {dish.totalPax} pax</button></div>);})()}
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

      {/* ═══ PAX SCALING LOGIC PANEL ═══ */}
      {tab==="scaling"&&(()=>{
        const MENU_APPLICABILITY={
          "Magnum Veg":           {code:"MVM",  ranges:[{min:50,max:250}],label:"50–250 pax",  color:"#3EAA68",type:"Veg"},
          "Magnum Non-Veg":       {code:"MNVM", ranges:[{min:50,max:250}],label:"50–250 pax",  color:"#3EAA68",type:"Non-Veg"},
          "Double Magnum Veg":    {code:"DMVM", ranges:[{min:100,max:250}],label:"100–250 pax", color:"#5B8FD0",type:"Veg"},
          "Double Magnum Non-Veg":{code:"DMNVM",ranges:[{min:100,max:250}],label:"100–250 pax", color:"#5B8FD0",type:"Non-Veg"},
          "Multi-Cuisine Veg":    {code:"MCVM", ranges:[{min:250,max:9999}],label:"250+ pax",  color:"#D4B44A",type:"Veg"},
          "Multi-Cuisine Non-Veg":{code:"MCNVM",ranges:[{min:250,max:9999}],label:"250+ pax",  color:"#D4B44A",type:"Non-Veg"},
          "Luxury Veg":           {code:"LVM",  ranges:[{min:300,max:9999}],label:"300+ pax",  color:"#C084FC",type:"Veg"},
          "Luxury Non-Veg":       {code:"LNVM", ranges:[{min:300,max:9999}],label:"300+ pax",  color:"#C084FC",type:"Non-Veg"},
        };
        const PAX_BANDS=[{v:100},{v:200},{v:250},{v:300},{v:400},{v:500},{v:600},{v:700},{v:800},{v:900},{v:1000},{v:1100}];
        const PAX_COLS=[100,200,300,400,500,600,700,800,900,1000,1100];
        const BASE_PAX=400;
        function isApplicable(pkg,pax){const m=MENU_APPLICABILITY[pkg];return m?m.ranges.some(r=>pax>=r.min&&pax<=r.max):false;}
        function fmtScaled(q,u,pax,pct,isAbsolute){
          if(!q||q===0) return "—";
          const raw=isAbsolute?q:q*pax*((pct||100)/100);
          if(u==="g"||u==="gm") return raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g";
          if(u==="ml") return raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml";
          if(u==="pcs") return Math.ceil(raw)+" pcs";
          if(u==="kg") return raw>=0.01?(raw.toFixed(1).replace(/\.0$/,""))+" kg":"—";
          if(u==="L") return raw>=0.01?(raw.toFixed(1).replace(/\.0$/,""))+" L":"—";
          return Math.round(raw)+" "+u;
        }

        // Effective % from selected event or manual
        const allEvs=[...todayEvs,...tomorrowEvs,...evList.filter(e=>e.date===DAY_AFTER)];
        const linkedEv = scaleEventId ? allEvs.find(e=>e.id===scaleEventId) : null;
        const autoPercent = linkedEv ? Math.round((+linkedEv.pax/BASE_PAX)*100) : null;
        const effectivePct = scaleEventId===null ? 100 : (scalePercent||100);
        const pctLabel = `${effectivePct}%${linkedEv?" ("+linkedEv.guest+" · "+linkedEv.pax+" pax)":""}`;

        const mode=scaleMode||"dish";
        const pkgNames=Object.keys(MENU_PACKAGES);
        const selPkg=scalePkg||pkgNames[0];
        const pkgDishes=(MENU_PACKAGES[selPkg]||[]).filter(d=>hasIngredients(d));
        const multiSel=scaleMultiSel||{};
        const selectedDishes=Object.keys(multiSel).filter(d=>multiSel[d]);
        const activeDishes=mode==="bulk"?pkgDishes:selectedDishes;

        // step chip helper
        const StepChip=(n,label)=>(
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,marginTop:n>1?20:0}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:C.gold,color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</div>
            <div style={{fontSize:13,fontWeight:700,color:C.text,textTransform:"uppercase",letterSpacing:.6}}>{label}</div>
          </div>
        );
        // before/after diff formatter
        function fmtDiff(q,u,pct){
          if(!q||q===0) return "—";
          const diff=(q*BASE_PAX*((pct||100)/100))-(q*BASE_PAX);
          if(Math.abs(diff)<0.01) return "=";
          const sign=diff>0?"+":"";
          if(u==="g"){const d=Math.round(diff);return Math.abs(d)>=1000?sign+(d/1000).toFixed(1)+" kg":sign+d+" g";}
          if(u==="ml"){const d=Math.round(diff);return Math.abs(d)>=1000?sign+(d/1000).toFixed(1)+" L":sign+d+" ml";}
          if(u==="pcs") return sign+Math.ceil(diff)+" pcs";
          return sign+Math.round(diff)+" "+(u||"");
        }
        function diffColor(q,pct){
          if(!q||q===0) return C.faint;
          const diff=(q*BASE_PAX*(pct/100))-(q*BASE_PAX);
          return diff>0.01?C.green:diff<-0.01?C.red:C.faint;
        }
        // Ingredient table (handles both old per-serving and new absolute formats)
        const reqPax = linkedEv?.pax||Math.round(BASE_PAX*(effectivePct/100));
        const hasAnyNV = (arr) => arr.some(i=>i.nv!==null&&i.nv!==undefined);
        function IngTable({ingr,dishName}){
          const isNew = ingr.length>0 && ingr[0]._newFmt;
          const showNVCol = showNV && hasAnyNV(ingr);
          return(
            <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
              <table style={{borderCollapse:"collapse",fontSize:11,minWidth:"100%"}}>
                <thead>
                  <tr style={{background:C.darkCard}}>
                    <th style={{padding:"8px 10px",textAlign:"left",color:C.muted,position:"sticky",left:0,background:C.darkCard,borderRight:`1px solid ${C.border}`,minWidth:130}}>Ingredient</th>
                    <th style={{padding:"8px 6px",textAlign:"center",color:C.muted,borderLeft:`1px solid ${C.border}`,minWidth:40}}>Unit</th>
                    <th style={{padding:"8px 8px",textAlign:"right",color:effectivePct<100?C.amber:effectivePct>100?C.green:C.gold,borderLeft:`1px solid ${C.border}`,minWidth:90}}>Veg ({reqPax} pax)</th>
                    {showNVCol&&<th style={{padding:"8px 8px",textAlign:"right",color:C.red,borderLeft:`1px solid ${C.border}`,minWidth:90}}>NV ({reqPax} pax)</th>}
                  </tr>
                </thead>
                <tbody>
                  {ingr.map((ing,ii)=>{
                    const isAcc=!ing.q||ing.q===0;
                    const scaledFmt=isAcc?"acc. to taste":isNew?fmtScaled(ing.q,ing.u,0,0,true):fmtScaled(ing.q,ing.u,BASE_PAX,effectivePct);
                    const nvFmt=showNVCol&&ing.nv!=null?(isAcc?"—":isNew?fmtScaled(ing.nv,ing.u,0,0,true):fmtScaled(ing.nv,ing.u,BASE_PAX,effectivePct)):"";
                    return(
                      <tr key={ii} style={{borderTop:`1px solid ${C.borderLight}`,background:ii%2===0?C.surface:C.darkCard}}>
                        <td style={{padding:"7px 10px",position:"sticky",left:0,background:ii%2===0?C.surface:C.darkCard,borderRight:`1px solid ${C.border}`}}>
                          <div style={{fontWeight:600,color:C.text,fontSize:11}}>{ing.n}</div>
                          {ing.h&&<div style={{fontSize:9,color:C.faint}}>{ing.h}</div>}
                          {isAcc&&<div style={{fontSize:9,color:C.amber}}>acc. to taste</div>}
                        </td>
                        <td style={{padding:"7px 6px",textAlign:"center",color:C.faint,fontSize:10,borderLeft:`1px solid ${C.borderLight}`}}>{isAcc?"—":ing.u}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontWeight:700,color:isAcc?C.faint:effectivePct<100?C.amber:effectivePct>100?C.green:C.gold,fontSize:11,borderLeft:`1px solid ${C.borderLight}`}}>{scaledFmt}</td>
                        {showNVCol&&<td style={{padding:"7px 8px",textAlign:"right",fontWeight:700,color:ing.nv!=null?C.red:C.faint,fontSize:11,borderLeft:`1px solid ${C.borderLight}`}}>{nvFmt||"—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }

        return(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
              <div>
                <div style={{fontSize:18,fontWeight:500,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>⚖️ {T2("Pax Scaling")}</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:6}}>{T2("Scale ingredient quantities to any function's pax count.")}</div>
              </div>
              <button onClick={()=>setShowNV(p=>!p)}
                style={{padding:"6px 14px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0,minHeight:32,
                  background:showNV?C.redBg:"transparent",color:showNV?C.red:C.muted,border:`1px solid ${showNV?C.red:C.border}`}}>
                {showNV?"🟥 NV ON":"⬜ NV"}
              </button>
            </div>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,fontSize:11,color:C.amber,marginBottom:16}}>
              <span style={{fontWeight:600}}>{T2("Base SOP")}: 400 pax</span>
              <span style={{color:C.muted}}>— {T2("all recipe quantities are calibrated for this base")}</span>
            </div>

            {/* ══ STEP 1: SELECT FUNCTION ══ */}
            {StepChip(1,T2("Select Function"))}
            <Card style={{marginBottom:0,padding:"14px 16px",border:`1px solid ${C.goldBorder}`,background:C.goldBg}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>
                {allEvs.length>0?T2("Tap an upcoming event to begin scaling"):T2("No upcoming events found")}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {allEvs.length===0&&<div style={{fontSize:12,color:C.faint,padding:"4px 0"}}>{T2("Add events in the Dashboard to enable scaling")}</div>}
                {allEvs.map(ev=>{
                  const autoPct=Math.round((+ev.pax/BASE_PAX)*100);
                  const isSel=scaleEventId===ev.id;
                  const evPkg=ev.menu_package||ev.package||"";
                  return(
                    <button key={ev.id} onClick={()=>{setScaleEventId(ev.id);setScalePercent(autoPct);}}
                      style={{padding:"10px 16px",borderRadius:10,fontSize:12,fontWeight:isSel?700:400,cursor:"pointer",background:isSel?C.gold:C.surface,color:isSel?"#fff":C.muted,border:`1.5px solid ${isSel?C.gold:C.border}`,minHeight:44,textAlign:"left"}}>
                      <div style={{fontWeight:isSel?800:600}}>{ev.guest}</div>
                      <div style={{fontSize:10,opacity:.8}}>📅 {ev.date} · {ev.pax} pax{evPkg?" · "+evPkg:""}</div>
                    </button>
                  );
                })}
              </div>
              {scaleEventId!==null&&linkedEv&&(
                <div style={{marginTop:14}}>
                  <div style={{background:C.bg,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                    <div style={{fontSize:11,color:C.muted}}>Auto-calculated</div>
                    <div style={{fontSize:20,fontWeight:800,color:C.gold}}>{autoPercent}%</div>
                    <div style={{fontSize:11,color:C.muted}}>({linkedEv.pax} pax ÷ 400)</div>
                    {effectivePct!==autoPercent&&(
                      <div style={{marginLeft:"auto",fontSize:11,color:C.amber,fontWeight:600}}>
                        ⚙️ {T2("Overridden")} → {effectivePct}%
                      </div>
                    )}
                    {effectivePct===autoPercent&&<div style={{marginLeft:"auto",fontSize:10,color:C.faint}}>{T2("Using auto")}</div>}
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>⚙️ {T2("Override %")} <span style={{fontWeight:400,fontSize:10,textTransform:"none"}}>({T2("optional")})</span></div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
                    <button onClick={()=>setScalePercent(autoPercent)}
                      style={{padding:"6px 12px",borderRadius:10,fontSize:11,fontWeight:scalePercent===autoPercent?700:400,cursor:"pointer",background:scalePercent===autoPercent?C.goldBg:"transparent",color:scalePercent===autoPercent?C.gold:C.muted,border:`1.5px solid ${scalePercent===autoPercent?C.gold:C.border}`,minHeight:34}}>
                      Auto ({autoPercent}%)
                    </button>
                    {[25,50,75,80,100,110,120,125,150].filter(p=>p!==autoPercent).map(p=>(
                      <button key={p} onClick={()=>setScalePercent(p)}
                        style={{padding:"6px 11px",borderRadius:10,fontSize:12,fontWeight:scalePercent===p?800:400,cursor:"pointer",background:scalePercent===p?(p<100?C.amberBg:p>100?C.greenBg:C.goldBg):"transparent",color:scalePercent===p?(p<100?C.amber:p>100?C.green:C.gold):C.muted,border:`1.5px solid ${scalePercent===p?(p<100?C.amber:p>100?C.green:C.gold):C.border}`,minHeight:34}}>
                        {p}%
                      </button>
                    ))}
                    <input type="number" value={scalePercent} onChange={e=>setScalePercent(Math.max(1,Math.min(500,+e.target.value||100)))} min={1} max={500}
                      style={{width:64,padding:"6px 8px",borderRadius:10,border:`1px solid ${C.gold}`,fontSize:13,fontWeight:700,color:C.gold,background:C.bg,textAlign:"center",minHeight:34}}/>
                    <span style={{fontSize:12,color:C.muted}}>%</span>
                  </div>
                  <div style={{position:"relative",marginBottom:10}}>
                    <input type="range" min={10} max={200} step={5} value={Math.min(200,scalePercent)}
                      onChange={e=>setScalePercent(+e.target.value)}
                      style={{width:"100%",accentColor:effectivePct<100?C.amber:effectivePct>100?C.green:C.gold,height:6,cursor:"pointer"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:2,fontSize:9,color:C.faint}}>
                      <span>10%</span><span style={{color:C.gold,fontWeight:700}}>100%</span><span>200%</span>
                    </div>
                    <div style={{position:"absolute",left:"47.4%",top:0,width:2,height:14,background:C.gold+"60",borderRadius:1,pointerEvents:"none"}}/>
                  </div>
                  <div style={{background:C.bg,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontSize:11,color:C.muted}}>{T2("Active scaling")}</div>
                    <div style={{fontSize:18,fontWeight:800,color:effectivePct<100?C.amber:effectivePct>100?C.green:C.gold}}>{effectivePct}%</div>
                    <div style={{fontSize:11,color:C.muted}}>← {linkedEv.guest} · {linkedEv.pax} pax</div>
                  </div>
                </div>
              )}
            </Card>

            {scaleEventId===null&&(
              <Card style={{marginTop:16,padding:"20px",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:8}}>👆</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:4}}>← {T2("Select an event above to enable ingredient scaling")}</div>
              </Card>
            )}

            {scaleEventId!==null&&(
              <div>
                {/* ══ STEP 2: SELECT DISHES ══ */}
                {StepChip(2,T2("Select Dishes"))}
                <div style={{display:"flex",gap:0,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:12}}>
                  {[{v:"dish",l:T2("Search dishes")},{v:"bulk",l:T2("Full menu")}].map(m=>(
                    <button key={m.v} onClick={()=>{setScaleMode(m.v);setScaleDishSearch("");if(m.v==="dish")setScaleMultiSel({});}}
                      style={{flex:1,padding:"10px 8px",border:"none",cursor:"pointer",borderLeft:m.v!=="dish"?`1px solid ${C.border}`:"none",background:mode===m.v?C.goldBg:"transparent"}}>
                      <div style={{fontSize:12,fontWeight:mode===m.v?500:400,color:mode===m.v?C.gold:C.muted}}>{m.l}</div>
                    </button>
                  ))}
                </div>
                {mode==="dish"&&(
                  <div style={{marginBottom:4}}>
                    <div style={{position:"relative"}}>
                      <input
                        value={scaleDishSearch}
                        onChange={e=>setScaleDishSearch(e.target.value)}
                        placeholder={T2("Search dishes… e.g. Paneer, Dal, Biryani")}
                        style={{width:"100%",padding:"12px 14px",borderRadius:scaleDishSearch?"12px 12px 0 0":"12px",border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,minHeight:46,boxSizing:"border-box"}}
                      />
                      {scaleDishSearch&&(()=>{
                        const q=scaleDishSearch.toLowerCase();
                        const matches=[];
                        pkgNames.forEach(pkg=>{
                          (MENU_PACKAGES[pkg]||[]).filter(d=>hasIngredients(d)&&d.toLowerCase().includes(q)&&!multiSel[d]).forEach(d=>{
                            if(!matches.find(m=>m.name===d))matches.push({name:d,pkg,code:MENU_APPLICABILITY[pkg]?.code||""});
                          });
                        });
                        if(matches.length===0) return <div style={{padding:"10px 14px",fontSize:12,color:C.muted,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 12px 12px",background:C.surface}}>{T2("No dishes found for")} "{scaleDishSearch}"</div>;
                        return(
                          <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 12px 12px",background:C.surface,maxHeight:200,overflowY:"auto"}}>
                            {matches.slice(0,15).map(m=>(
                              <div key={m.name} onClick={()=>{setScaleMultiSel(p=>({...p,[m.name]:true}));setScaleDishSearch("");}}
                                style={{padding:"9px 14px",fontSize:13,color:C.text,cursor:"pointer",borderBottom:`1px solid ${C.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <span>{m.name}</span>
                                <span style={{fontSize:10,color:C.faint,padding:"2px 8px",borderRadius:6,background:C.bg}}>{m.code}</span>
                              </div>
                            ))}
                            {matches.length>15&&<div style={{padding:"6px 14px",fontSize:11,color:C.faint,textAlign:"center"}}>{matches.length-15} {T2("more — keep typing")}</div>}
                          </div>
                        );
                      })()}
                    </div>
                    {selectedDishes.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
                        {selectedDishes.map(d=>(
                          <div key={d} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:8,background:C.greenBg,border:`1px solid ${C.greenBorder}`,fontSize:12,color:C.green}}>
                            <span>{d}</span>
                            <span onClick={()=>setScaleMultiSel(p=>{const n={...p};delete n[d];return n;})} style={{cursor:"pointer",fontWeight:600,fontSize:14,lineHeight:1,marginLeft:2,color:C.green}}>×</span>
                          </div>
                        ))}
                        {selectedDishes.length>1&&(
                          <button onClick={()=>setScaleMultiSel({})} style={{padding:"5px 10px",borderRadius:8,fontSize:11,color:C.red,background:C.redBg,border:`1px solid ${C.redBorder}`,cursor:"pointer"}}>{T2("Clear all")}</button>
                        )}
                      </div>
                    )}
                    {selectedDishes.length===0&&<div style={{fontSize:11,color:C.faint,marginTop:6}}>{T2("Search and tap dishes to add them")}</div>}
                  </div>
                )}
                {mode==="bulk"&&(
                  <div style={{marginBottom:4}}>
                    <select value={scalePkg||pkgNames[0]} onChange={e=>{setScalePkg(e.target.value);setOpenSections({});}} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:46}}>
                      {pkgNames.map(p=><option key={p} value={p}>{MENU_APPLICABILITY[p]?.code||p} — {p} · {MENU_APPLICABILITY[p]?.label} · {(MENU_PACKAGES[p]||[]).filter(d=>hasIngredients(d)).length} {T2("dishes")}</option>)}
                    </select>
                  </div>
                )}

                {/* ══ STEP 3: REVIEW & CUSTOMIZE ══ */}
                {StepChip(3,T2("Review & Customize Scaling"))}
                {mode==="bulk"?(()=>{
                  if(pkgDishes.length===0) return <Card style={{padding:"20px",textAlign:"center"}}><div style={{fontSize:13,color:C.muted}}>{T2("Select a menu package in Step 2")}</div></Card>;
                  const bySec={};
                  pkgDishes.forEach(d=>{
                    const cat=getCatForDish(d);
                    const sec=cat.id;
                    if(!bySec[sec])bySec[sec]={dishes:[],cat};
                    bySec[sec].dishes.push(d);
                  });
                  return Object.entries(bySec).map(([sec,group])=>{
                    const dishes=group.dishes;
                    const smeta={color:group.cat.color||C.muted,icon:group.cat.icon||"🍽"};
                    const isOpen=openSections[sec];
                    const aggMap={};
                    dishes.forEach(dish=>{
                      const ingArr=getIngrForDish(dish,reqPax)||[];
                      ingArr.forEach(ing=>{
                        const k=ing.n+"|"+(ing.u||"");
                        if(!aggMap[k])aggMap[k]={n:ing.n,h:ing.h||"",u:ing.u||"",q:0,isAcc:!ing.q||ing.q===0,_newFmt:!!ing._newFmt};
                        if(ing.q)aggMap[k].q+=ing.q;
                        if(!ing.q)aggMap[k].isAcc=true;
                      });
                    });
                    const aggIngr=Object.values(aggMap);
                    return(
                      <div key={sec} style={{marginBottom:8}}>
                        <button onClick={()=>setOpenSections(p=>({...p,[sec]:!p[sec]}))}
                          style={{width:"100%",padding:"12px 14px",borderRadius:isOpen?"12px 12px 0 0":12,border:`1px solid ${isOpen?smeta.color:C.border}`,background:isOpen?smeta.color+"18":C.darkCard,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{fontSize:18}}>{smeta.icon}</span>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:isOpen?smeta.color:C.text}}>{group.cat.name||sec}</div>
                              <div style={{fontSize:10,color:C.muted}}>{dishes.length} {T2("dishes")} · {aggIngr.length} {T2("ingredients")}</div>
                            </div>
                          </div>
                          <span style={{fontSize:14,color:isOpen?smeta.color:C.muted}}>{isOpen?"▲":"▼"}</span>
                        </button>
                        {isOpen&&(
                          <div style={{border:`1px solid ${smeta.color}`,borderTop:"none",borderRadius:"0 0 12px 12px",overflow:"hidden"}}>
                            <div style={{padding:"6px 12px",background:smeta.color+"10",fontSize:10,color:smeta.color,fontWeight:600}}>
                              {dishes.join(" · ")}
                            </div>
                            <IngTable ingr={aggIngr}/>
                          </div>
                        )}
                      </div>
                    );
                  });
                })():(
                  <>
                    {activeDishes.map(dish=>{
                      const ingr=getIngrForDish(dish,reqPax)||[];
                      const rc=findRecipeAndCat(dish);
                      return(
                        <div key={dish} style={{marginBottom:18}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <div style={{fontSize:13,fontWeight:700,color:C.gold,fontFamily:"var(--font-display)"}}>{dish}</div>
                            {currentUser?.role==='admin'&&rc&&(
                              <button onClick={()=>openIngEditor(rc.recipe,rc.catId)} style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,cursor:"pointer",minHeight:24}}>✏️ Edit</button>
                            )}
                          </div>
                          {ingr.length>0?<IngTable ingr={ingr} dishName={dish}/>:<div style={{padding:"12px 14px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,fontSize:11,color:C.faint,textAlign:"center"}}>{currentUser?.role==='admin'&&rc?"No ingredients — tap ✏️ Edit to add":"No ingredient data available"}</div>}
                        </div>
                      );
                    })}
                    {activeDishes.length===0&&<Card style={{padding:"24px",textAlign:"center",marginBottom:4}}><div style={{fontSize:28,marginBottom:8}}>⚖️</div><div style={{fontSize:13,color:C.muted}}>{T2("Search and select dishes in Step 2 above")}</div></Card>}
                  </>
                )}

                {/* ══ STEP 4: APPLY ══ */}
                {StepChip(4,T2("Apply"))}
                <Card style={{padding:"14px 16px",marginBottom:4,border:`1px solid ${effectivePct!==100&&activeDishes.length>0?C.greenBorder:C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>
                        {effectivePct===100?T2("Quantities at 100% — no adjustment needed"):T2("Apply scaled quantities to D-1 & Event Day steps")}
                      </div>
                      <div style={{fontSize:11,color:C.muted}}>
                        {activeDishes.length>0?`${activeDishes.length} ${T2("dish"+(activeDishes.length===1?"":"es"))} · ${effectivePct}% scaling`:T2("Select dishes in Step 2 first")}
                        {linkedEv?` · ${linkedEv.guest} (${linkedEv.pax} pax)`:""}
                      </div>
                    </div>
                    {effectivePct!==100&&activeDishes.length>0&&hasPermission(currentUser,"kitchen.scaling_apply")&&(
                      <button onClick={()=>{
                        const evId=scaleEventId==="manual"?null:scaleEventId;
                        const entry={percent:effectivePct,appliedAt:new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}),dishes:activeDishes,eventId:evId,eventName:linkedEv?.guest||"Manual"};
                        setAppliedScales(p=>({...p,[evId||"manual"]:entry}));
                        if(evId&&setKitchenTracking){
                          setKitchenTracking(p=>{const o=p&&typeof p==="object"?{...p}:{};o[evId]={...(o[evId]||{}),__scaling:{percent:effectivePct,dishes:activeDishes,appliedAt:entry.appliedAt}};return o;});
                        }
                      }} style={{padding:"12px 22px",borderRadius:10,background:`linear-gradient(135deg,${C.green},#147A54)`,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44,whiteSpace:"nowrap"}}>
                        ✅ {T2("Apply to D-1 & Event Day")}
                      </button>
                    )}
                    {effectivePct===100&&<div style={{fontSize:11,color:C.faint}}>100% = SOP quantities</div>}
                    {activeDishes.length===0&&effectivePct!==100&&<div style={{fontSize:11,color:C.faint}}>{T2("Select dishes first")}</div>}
                  </div>
                  {Object.values(appliedScales).length>0&&(
                    <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
                      {Object.values(appliedScales).map((s,i)=>(
                        <div key={i} style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:s.percent<100?C.amberBg:C.greenBg,border:`1px solid ${s.percent<100?C.amberBorder:C.greenBorder}`,color:s.percent<100?C.amber:C.green}}>
                          ✅ {s.eventName} — {s.percent}% · {s.dishes.length} {T2("dishes")} · {s.appliedAt}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ══ MENU APPLICABILITY MATRIX ══ */}
            <Card style={{marginTop:24,marginBottom:16,padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>📊 {T2("Menu Applicability by Pax")}</div>
                <div style={{fontSize:10,color:C.muted}}>✅ {T2("Applicable")} · — {T2("Not recommended")}</div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",fontSize:11,minWidth:"100%"}}>
                  <thead>
                    <tr style={{background:C.darkCard}}>
                      <th style={{padding:"9px 12px",textAlign:"left",color:C.muted,fontWeight:700,position:"sticky",left:0,background:C.darkCard,borderRight:`1px solid ${C.border}`,minWidth:150}}>{T2("Menu")}</th>
                      <th style={{padding:"9px 8px",textAlign:"center",color:C.muted,fontWeight:600,borderLeft:`1px solid ${C.border}`,minWidth:48}}>Code</th>
                      <th style={{padding:"9px 8px",textAlign:"center",color:C.muted,fontWeight:600,borderLeft:`1px solid ${C.border}`,minWidth:42}}>V/NV</th>
                      {PAX_BANDS.map(b=><th key={b.v} style={{padding:"9px 6px",textAlign:"center",color:C.muted,fontWeight:600,borderLeft:`1px solid ${C.border}`,minWidth:46}}>{b.v}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(MENU_APPLICABILITY).map(([pkg,meta],ri)=>(
                      <tr key={pkg} style={{borderTop:`1px solid ${C.borderLight}`,background:ri%2===0?C.surface:C.darkCard}}>
                        <td style={{padding:"9px 12px",position:"sticky",left:0,background:ri%2===0?C.surface:C.darkCard,borderRight:`1px solid ${C.border}`,fontWeight:600,color:meta.color,fontSize:11}}>{pkg}</td>
                        <td style={{padding:"8px 6px",textAlign:"center",borderLeft:`1px solid ${C.borderLight}`}}>
                          <span style={{fontSize:10,fontWeight:700,color:meta.color,background:meta.color+"15",padding:"2px 7px",borderRadius:6}}>{meta.code}</span>
                        </td>
                        <td style={{padding:"8px 6px",textAlign:"center",borderLeft:`1px solid ${C.borderLight}`}}>
                          <span style={{fontSize:11,color:meta.type==="Veg"?C.green:C.amber}}>{meta.type==="Veg"?"🌿":"🍗"}</span>
                        </td>
                        {PAX_BANDS.map(b=>{
                          const ok=isApplicable(pkg,b.v);
                          return(
                            <td key={b.v} onClick={ok?()=>{setScalePkg(pkg);setScaleMode("bulk");}:undefined}
                              style={{padding:"8px 4px",textAlign:"center",borderLeft:`1px solid ${C.borderLight}`,cursor:ok?"pointer":"default",background:ok?meta.color+"12":"transparent"}}>
                              {ok?<span style={{fontSize:14,color:meta.color}}>✅</span>:<span style={{color:C.faint}}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{padding:"7px 14px",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.muted}}>💡 {T2("Tap any ✅ to load that menu's scaling in Step 2")}</div>
            </Card>
          </div>
        );
      })()}

      {/* ═══ RECIPE SOPs TAB ═══ */}
      {tab==="sops"&&(()=>{
        // Map section filter to relevant SOP category IDs
        const allowedCats = allowedCatIds;
        const filteredCats = allowedCats ? safeArr(RECIPE_DB.cats).filter(c=>allowedCats.includes(c.id)) : safeArr(RECIPE_DB.cats);
        const totalRecipes = filteredCats.reduce((s,c)=>s+safeArr(RECIPE_DB.recipes[c.id]).length,0);

        return(
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:6}}>📖 {T2("Recipe SOPs")}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{totalRecipes} {T2("recipes")} · {filteredCats.length} {T2("categories")} · {T2("Procedures in Hindi")}</div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input value={sopSearch} onChange={e=>setSopSearch(e.target.value)} placeholder={T2("Search recipes…")} style={{flex:1,padding:"12px 16px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:48}}/>
            {currentUser?.role==='admin'&&<button onClick={()=>openSopAdd(sopCat)} style={{padding:"10px 16px",borderRadius:12,background:C.gold,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",minHeight:48}}>+ {T2("Add Recipe")}</button>}
          </div>
          {!sopRecipe?(
            !sopCat?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                {filteredCats.map(cat=>{const recipes=safeArr(RECIPE_DB.recipes[cat.id]);const f2=sopSearch?recipes.filter(r=>r.n.toLowerCase().includes(sopSearch.toLowerCase())):recipes;if(sopSearch&&f2.length===0)return null;return(
                  <button key={cat.id} onClick={()=>setSopCat(cat.id)} style={{background:C.darkCard,border:`1px solid ${C.border}`,borderRadius:14,padding:"20px 14px",cursor:"pointer",textAlign:"center",minHeight:100}}>
                    <div style={{fontSize:28,marginBottom:6}}>{cat.icon}</div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{T2(cat.name)}</div><div style={{fontSize:11,color:C.muted,marginTop:4}}>{sopSearch?f2.length:recipes.length} {T2("recipes")}</div>
                  </button>);})}
              </div>
            ):(
              <div>
                <button onClick={()=>{setSopCat(null);setSopSearch("");}} style={{padding:"8px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",marginBottom:14,minHeight:40}}>← {T2("All Categories")}</button>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {safeArr(RECIPE_DB.recipes[sopCat]).filter(r=>!sopSearch||r.n.toLowerCase().includes(sopSearch.toLowerCase())).map((recipe,ri)=>(
                    <button key={ri} onClick={()=>setSopRecipe(recipe)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",textAlign:"left",minHeight:60}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{recipe.n}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{recipe.sub} · {safeArr(recipe.steps).length} {T2("steps")}</div>
                    </button>))}
                </div>
              </div>
            )
          ):(
            <div>
              <button onClick={()=>{setSopRecipe(null);setEditingSteps(false);setSopModal(null);setIngModal(null);}} style={{padding:"8px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",marginBottom:14,minHeight:40}}>← {T2("Back")}</button>
              <Card style={{padding:"20px 24px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div style={{flex:1,minWidth:0}}>
                    {editingSteps?(
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <input value={sopForm.name} onChange={e=>setSopForm(p=>({...p,name:e.target.value}))} placeholder="Recipe name" style={{flex:1,minWidth:140,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.gold}`,fontSize:15,fontWeight:700,color:C.text,background:"transparent",fontFamily:"var(--font-display)"}}/>
                        <input value={sopForm.sub} onChange={e=>setSopForm(p=>({...p,sub:e.target.value}))} placeholder="Sub (Hot/Cold)" style={{width:100,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:"transparent"}}/>
                        <select value={sopForm.catId} onChange={e=>setSopForm(p=>({...p,catId:e.target.value}))} style={{padding:"6px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,minHeight:30}}>
                          {safeArr(RECIPE_DB.cats).map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                      </div>
                    ):(
                      <>
                        <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{sopRecipe.n}</div>
                        <div style={{fontSize:12,color:C.gold,marginTop:4}}>{sopRecipe.sub} · {safeArr(sopRecipe.steps).length} {T2("steps")}</div>
                      </>
                    )}
                  </div>
                  {currentUser?.role==='admin'&&(
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      {!editingSteps?(
                        <>
                          <button onClick={()=>{setSopForm({name:sopRecipe.n,sub:sopRecipe.sub||"",catId:sopCat||"",steps:safeArr(sopRecipe.steps).map(s=>({t:s.t||"",i:s.i||s.desc||"",tm:s.tm||0,ccp:s.ccp||"",d1:!!s.d1,subs:Array.isArray(s.subs)?s.subs.map(sb=>({t:sb.t||"",i:sb.i||"",tm:sb.tm||0})):[]}))});setSopModal({mode:"edit",catId:sopCat||"",origName:sopRecipe.n});setEditingSteps(true);}} style={{padding:"6px 12px",borderRadius:8,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:32}}>✏️ Edit</button>
                          <button onClick={()=>deleteSop(sopRecipe,sopCat)} style={{padding:"6px 12px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:32}}>🗑 Delete</button>
                        </>
                      ):(
                        <>
                          <button onClick={()=>{saveSop();setEditingSteps(false);}} style={{padding:"6px 14px",borderRadius:8,background:C.green,border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:32}}>💾 Save</button>
                          <button onClick={()=>{setEditingSteps(false);setSopModal(null);}} style={{padding:"6px 12px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:32}}>✕ Cancel</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {/* ── Yield table ── */}
                {(()=>{
                  const PAX_SIZES = sopRecipe.ingredients?.pax_sizes || [200,500,1000];
                  const yData = sopRecipe.yield || [];
                  const hasYield = yData.length > 0;
                  if (editingYield) {
                    return (
                      <div style={{margin:"10px 0",padding:"12px 14px",borderRadius:10,background:C.amberBg,border:`1px solid ${C.amberBorder}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <span style={{fontSize:12,fontWeight:700,color:C.amber}}>📦 Yield per pax</span>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>setEditingYield(false)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,color:C.muted,cursor:"pointer"}}>Cancel</button>
                            <button onClick={()=>{
                              const cleaned = yieldForm.filter(y => y.qty > 0);
                              import('../lib/supabase.js').then(mod => {
                                const sb = mod.supabase; if (!sb) return;
                                sb.from('recipes').update({ yield: cleaned }).eq('dish_name', sopRecipe.n).eq('category_id', sopCat).then(r => {
                                  if (r.error) console.error('Yield save err:', r.error);
                                  else { setSopRecipe(p => ({...p, yield: cleaned})); console.log('✅ Yield saved'); }
                                });
                              });
                              setEditingYield(false);
                            }} style={{fontSize:11,padding:"4px 12px",borderRadius:6,border:"none",background:C.green,color:"#fff",cursor:"pointer",fontWeight:600}}>Save</button>
                          </div>
                        </div>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr style={{borderBottom:`1.5px solid ${C.border}`}}>
                            <th style={{textAlign:"left",padding:"4px 8px",color:C.muted,fontWeight:600}}>Pax</th>
                            <th style={{textAlign:"left",padding:"4px 8px",color:C.muted,fontWeight:600}}>Quantity</th>
                            <th style={{textAlign:"left",padding:"4px 8px",color:C.muted,fontWeight:600}}>Unit</th>
                          </tr></thead>
                          <tbody>{yieldForm.map((y,i) => (
                            <tr key={y.pax} style={{borderBottom:`1px solid ${C.borderLight}`}}>
                              <td style={{padding:"6px 8px",fontWeight:600,color:C.text}}>{y.pax}</td>
                              <td style={{padding:"4px 8px"}}><input type="number" value={y.qty||""} onChange={e=>setYieldForm(p=>p.map((r,j)=>j===i?{...r,qty:parseFloat(e.target.value)||0}:r))} style={{width:80,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/></td>
                              <td style={{padding:"4px 8px"}}><select value={y.unit||"kg"} onChange={e=>setYieldForm(p=>p.map((r,j)=>j===i?{...r,unit:e.target.value}:r))} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
                                {YIELD_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                              </select></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    );
                  }
                  return (
                    <div style={{display:"flex",alignItems:"center",gap:8,margin:"6px 0"}}>
                      {hasYield ? (
                        <span style={{fontSize:11,color:C.muted}}>📦 Yield: {yData.map(y => y.pax+"pax → "+y.qty+" "+y.unit).join(" · ")}</span>
                      ) : (
                        <span style={{fontSize:11,color:C.faint}}>📦 No yield data</span>
                      )}
                      {currentUser?.role==='admin' && !editingSteps && (
                        <button onClick={()=>{
                          const PAX = sopRecipe.ingredients?.pax_sizes || [200,500,1000];
                          setYieldForm(PAX.map(p => {const existing = yData.find(y=>y.pax===p); return existing ? {...existing} : {pax:p,qty:0,unit:"kg"};}));
                          setEditingYield(true);
                        }} style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,cursor:"pointer"}}>{hasYield?"✏️ Edit":"+ Add"}</button>
                      )}
                    </div>
                  );
                })()}
                {/* Ingredient count + Edit button */}
                {(()=>{const fallbackIng=!sopRecipe.ingredients?.items?.length&&getIngrForDish?getIngrForDish(sopRecipe.n,500):null;return(<>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:11,color:C.muted}}>
                    {sopRecipe.ingredients?.items?.length>0
                      ?"🧂 "+sopRecipe.ingredients.items.length+" ingredients"
                      :fallbackIng?"🧂 "+fallbackIng.length+" ingredients (legacy)"
                      :"🧂 No ingredients added"}
                  </span>
                  {currentUser?.role==='admin'&&!ingModal&&(
                    <button onClick={()=>{openIngEditor(sopRecipe,sopCat);}} style={{padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:ingModal?.recipeName===sopRecipe.n?C.green:C.goldBg,border:`1px solid ${ingModal?.recipeName===sopRecipe.n?C.greenBorder:C.goldBorder}`,color:ingModal?.recipeName===sopRecipe.n?"#fff":C.gold,cursor:"pointer",minHeight:28}}>
                      {sopRecipe.ingredients?.items?.length>0?"✏️ Edit":"+ Add Ingredients"}
                    </button>
                  )}
                  {currentUser?.role==='admin'&&ingModal?.recipeName===sopRecipe.n&&(
                    <div style={{display:"flex",gap:6}}>
                      {ingDirty&&<button onClick={saveIngredients} style={{padding:"4px 12px",borderRadius:8,fontSize:11,fontWeight:700,background:C.green,color:"#fff",border:"none",cursor:"pointer",minHeight:28}}>💾 Save</button>}
                      <button onClick={()=>{if(ingDirty&&!confirm("Discard changes?"))return;setIngModal(null);setIngDirty(false);}} style={{padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",minHeight:28}}>✕ Cancel</button>
                    </div>
                  )}
                </div>
                {/* Inline ingredient table (read-only) */}
                {(ingModal?.recipeName===sopRecipe.n)?(
                  <div style={{marginBottom:16,borderRadius:10,border:`2px solid ${C.gold}`,overflow:"hidden"}}>
                    <div style={{padding:"8px 12px",background:C.goldBg,fontSize:11,fontWeight:700,color:C.gold,borderBottom:`1px solid ${C.goldBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>✏️ Editing — {ingForm.pax_sizes?.map(p=>p+" pax").join(" / ")}</span>
                      <span style={{fontSize:10,color:ingDirty?C.amber:C.faint}}>{ingForm.items.length} items{ingDirty?" · unsaved":""}</span>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{borderCollapse:"collapse",fontSize:11,width:"100%"}}>
                        <thead><tr style={{background:C.surface}}>
                          <th style={{padding:"6px 8px",textAlign:"left",color:C.muted,minWidth:110}}>Name</th>
                          <th style={{padding:"6px 4px",textAlign:"left",color:C.muted,minWidth:60}}>Hindi</th>
                          <th style={{padding:"6px 4px",textAlign:"center",color:C.muted,minWidth:42}}>Unit</th>
                          {ingForm.pax_sizes.map((p,pi)=>(
                            <th key={pi} style={{padding:"6px 6px",textAlign:"center",color:C.gold,borderLeft:`1px solid ${C.borderLight}`,minWidth:52}}>{p}</th>
                          ))}
                          <th style={{padding:"6px 4px",textAlign:"center",color:C.muted,minWidth:30}}></th>
                        </tr></thead>
                        <tbody>
                          {ingForm.items.map((item,idx)=>(
                            <tr key={idx} style={{borderTop:`1px solid ${C.borderLight}`,background:idx%2===0?C.surface:C.darkCard}}>
                              <td style={{padding:"3px 4px"}}><input value={item.name} onChange={e=>ingUpdateItem(idx,"name",e.target.value)} placeholder="Name" style={{width:"100%",padding:"4px 6px",borderRadius:6,border:`1px solid ${C.borderLight}`,fontSize:11,color:C.text,background:"transparent",boxSizing:"border-box",minHeight:28}}/></td>
                              <td style={{padding:"3px 4px"}}><input value={item.hindi||""} onChange={e=>ingUpdateItem(idx,"hindi",e.target.value)} placeholder="हिंदी" style={{width:"100%",padding:"4px 6px",borderRadius:6,border:`1px solid ${C.borderLight}`,fontSize:11,color:C.text,background:"transparent",boxSizing:"border-box",minHeight:28}}/></td>
                              <td style={{padding:"3px 2px"}}><select value={item.unit} onChange={e=>ingUpdateItem(idx,"unit",e.target.value)} style={{width:"100%",padding:"3px 2px",borderRadius:6,border:`1px solid ${C.borderLight}`,fontSize:10,color:C.text,background:C.surface,minHeight:28}}>{["kg","gm","L","ml","pcs","Bot","tin","bunch","dozen"].map(u=><option key={u} value={u}>{u}</option>)}</select></td>
                              {ingForm.pax_sizes.map((p,pi)=>(
                                <td key={pi} style={{padding:"3px 3px",borderLeft:`1px solid ${C.borderLight}`}}><input type="number" step="0.1" value={item.qty[pi]||""} onChange={e=>ingUpdateQty(idx,pi,e.target.value)} style={{width:"100%",padding:"4px 4px",borderRadius:6,border:`1px solid ${C.borderLight}`,fontSize:11,textAlign:"right",color:C.text,background:"transparent",boxSizing:"border-box",minHeight:28}}/></td>
                              ))}
                              <td style={{padding:"3px 2px",textAlign:"center"}}><button onClick={()=>ingRemoveItem(idx)} style={{width:22,height:22,borderRadius:5,border:`1px solid ${C.redBorder}`,background:C.redBg,cursor:"pointer",fontSize:10,color:C.red,lineHeight:"20px",padding:0}}>✕</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={ingAddItem} style={{width:"100%",padding:"8px",borderTop:`1px dashed ${C.goldBorder}`,background:C.goldBg,color:C.gold,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",borderRadius:"0 0 8px 8px",minHeight:34}}>+ Add Ingredient</button>
                    {ingDirty&&<div style={{padding:"8px 12px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:8}}>
                      <button onClick={()=>{if(!confirm("Discard changes?"))return;setIngModal(null);setIngDirty(false);}} style={{padding:"6px 14px",borderRadius:8,fontSize:11,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",minHeight:30}}>Cancel</button>
                      <button onClick={saveIngredients} style={{padding:"6px 16px",borderRadius:8,fontSize:11,fontWeight:700,background:C.green,color:"#fff",border:"none",cursor:"pointer",minHeight:30}}>💾 Save</button>
                    </div>}
                  </div>
                ):sopRecipe.ingredients?.items?.length>0?(
                  <div style={{marginBottom:16,borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                    <div style={{padding:"8px 12px",background:C.goldBg,fontSize:11,fontWeight:700,color:C.gold,borderBottom:`1px solid ${C.goldBorder}`}}>
                      Ingredients — {sopRecipe.ingredients.pax_sizes?.map(p=>p+" pax").join(" / ")}
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{borderCollapse:"collapse",fontSize:11,width:"100%"}}>
                        <thead><tr style={{background:C.surface}}>
                          <th style={{padding:"6px 10px",textAlign:"left",color:C.muted,borderRight:`1px solid ${C.borderLight}`,minWidth:120}}>Item</th>
                          <th style={{padding:"6px 6px",textAlign:"center",color:C.muted,minWidth:36}}>Unit</th>
                          {sopRecipe.ingredients.pax_sizes?.map((p,pi)=>(
                            <th key={pi} style={{padding:"6px 8px",textAlign:"right",color:C.gold,borderLeft:`1px solid ${C.borderLight}`,minWidth:55}}>{p}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {sopRecipe.ingredients.items.map((ing,ii)=>(
                            <tr key={ii} style={{borderTop:`1px solid ${C.borderLight}`,background:ii%2===0?C.surface:C.darkCard}}>
                              <td style={{padding:"5px 10px",borderRight:`1px solid ${C.borderLight}`}}>
                                <div style={{fontWeight:600,color:C.text}}>{ing.name}</div>
                                {ing.hindi&&<div style={{fontSize:9,color:C.faint}}>{ing.hindi}</div>}
                              </td>
                              <td style={{padding:"5px 6px",textAlign:"center",color:C.faint,fontSize:10}}>{ing.unit}</td>
                              {ing.qty?.map((q,qi)=>(
                                <td key={qi} style={{padding:"5px 8px",textAlign:"right",color:C.text,fontWeight:600,borderLeft:`1px solid ${C.borderLight}`}}>{q||"—"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ):fallbackIng?(
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
                            const fmt=ing.u==="g"||ing.u==="gm"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g"):ing.u==="ml"?(raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml"):ing.u==="pcs"?Math.ceil(raw)+" pcs":Math.round(raw)+" "+ing.u;
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
                {editingSteps?(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>Steps ({sopForm.steps.length})</div>
                    {sopForm.steps.map((step,si)=>(
                      <div key={si} style={{display:"flex",gap:8,padding:"10px 0",borderBottom:si<sopForm.steps.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start"}}>
                        <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"center",flexShrink:0,paddingTop:6}}>
                          <span style={{fontSize:12,fontWeight:700,color:C.gold}}>{si+1}</span>
                          <button onClick={()=>sopMoveStep(si,-1)} disabled={si===0} style={{width:22,height:22,borderRadius:5,border:`1px solid ${C.border}`,background:C.surface,fontSize:10,color:si>0?C.muted:C.faint,cursor:si>0?"pointer":"default",padding:0}}>↑</button>
                          <button onClick={()=>sopMoveStep(si,1)} disabled={si===sopForm.steps.length-1} style={{width:22,height:22,borderRadius:5,border:`1px solid ${C.border}`,background:C.surface,fontSize:10,color:si<sopForm.steps.length-1?C.muted:C.faint,cursor:si<sopForm.steps.length-1?"pointer":"default",padding:0}}>↓</button>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <input value={step.t} onChange={e=>sopFormStep(si,"t",e.target.value)} placeholder="Step title" style={{width:"100%",padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,fontWeight:600,color:C.text,background:"transparent",boxSizing:"border-box",marginBottom:4,minHeight:32}}/>
                          <textarea value={step.i} onChange={e=>sopFormStep(si,"i",e.target.value)} placeholder="Instructions (Hindi)" rows={2} style={{width:"100%",padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.muted,background:"transparent",boxSizing:"border-box",resize:"vertical",minHeight:40,marginBottom:4}}/>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                            {!(step.subs&&step.subs.length>0)&&<div style={{display:"flex",alignItems:"center",gap:3}}>
                              <span style={{fontSize:10,color:C.muted}}>⏱</span>
                              <input type="number" step="0.5" value={step.tm?Math.round(step.tm/60*10)/10:""} onChange={e=>sopFormStep(si,"tm",Math.round((parseFloat(e.target.value)||0)*60))} placeholder="min" style={{width:60,padding:"4px 6px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:"transparent",minHeight:26}}/>
                              <span style={{fontSize:9,color:C.faint}}>min</span>
                            </div>}
                            <div style={{display:"flex",alignItems:"center",gap:3}}>
                              <span style={{fontSize:10,color:C.muted}}>CCP</span>
                              <input value={step.ccp} onChange={e=>sopFormStep(si,"ccp",e.target.value)} placeholder="Critical control" style={{width:110,padding:"4px 6px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:"transparent",minHeight:26}}/>
                            </div>
                            <label style={{display:"flex",alignItems:"center",gap:3,cursor:"pointer",fontSize:10,color:step.d1?C.green:C.muted,fontWeight:step.d1?700:400}}>
                              <input type="checkbox" checked={step.d1} onChange={e=>sopFormStep(si,"d1",e.target.checked)} style={{accentColor:C.green}}/>
                              D-1   
                            </label>
                          </div>
                          {(step.subs&&step.subs.length>0)&&(
                            <div style={{borderLeft:`2.5px solid ${C.gold}`,marginLeft:2,marginTop:8,paddingLeft:12}}>
                              <div style={{fontSize:10,fontWeight:700,color:C.gold,marginBottom:6,textTransform:"uppercase",letterSpacing:.5,display:"flex",alignItems:"center",gap:6}}>Sub-steps ({step.subs.length}){step.d1&&<span style={{fontSize:9,color:C.green,fontWeight:600,background:C.greenBg,padding:"1px 6px",borderRadius:4,border:`1px solid ${C.greenBorder}`}}>D-1 inherited</span>}</div>
                              {step.subs.map((sb,sbi)=>(
                                <div key={sbi} style={{background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                                    <span style={{fontSize:10,fontWeight:700,color:C.gold,minWidth:22}}>{si+1}{String.fromCharCode(97+sbi)}.</span>
                                    <input value={sb.t} onChange={e=>sopEditSub(si,sbi,"t",e.target.value)} placeholder="Sub-step title" style={{flex:1,padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:"transparent",minHeight:28}}/>
                                    <button onClick={()=>sopRemoveSub(si,sbi)} style={{width:22,height:22,borderRadius:5,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:10,cursor:"pointer",padding:0,flexShrink:0}}>✕</button>
                                  </div>
                                  <textarea value={sb.i} onChange={e=>sopEditSub(si,sbi,"i",e.target.value)} placeholder="Instructions (Hindi)" rows={1} style={{width:"100%",padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,color:C.muted,background:"transparent",boxSizing:"border-box",resize:"vertical",minHeight:28,marginBottom:4}}/>
                                  <div style={{display:"flex",alignItems:"center",gap:6,background:C.bg,borderRadius:6,padding:"4px 8px",border:`1px solid ${C.borderLight}`}}>
                                    <span style={{fontSize:10,color:C.amber,fontWeight:600}}>⏱ Timer</span>
                                    <input type="number" step="0.5" value={sb.tm?Math.round(sb.tm/60*10)/10:""} onChange={e=>sopEditSub(si,sbi,"tm",String(Math.round((parseFloat(e.target.value)||0)*60)))} placeholder="0" style={{width:50,padding:"4px 6px",borderRadius:5,border:`1px solid ${C.amberBorder}`,fontSize:12,fontWeight:600,textAlign:"center",color:C.amber,background:"transparent",minHeight:26}}/>
                                    <span style={{fontSize:10,color:C.faint}}>min</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <button onClick={()=>sopAddSub(si)} style={{marginTop:6,padding:"5px 12px",borderRadius:6,background:C.goldBg,border:`1px dashed ${C.goldBorder}`,color:C.gold,fontSize:10,fontWeight:600,cursor:"pointer"}}>+ Add Sub-step</button>
                        </div>
                        <button onClick={()=>sopRemoveStep(si)} style={{width:24,height:24,borderRadius:6,border:`1px solid ${C.redBorder}`,background:C.redBg,cursor:"pointer",fontSize:11,color:C.red,flexShrink:0,marginTop:6,padding:0}}>✕</button>
                      </div>
                    ))}
                    <button onClick={sopAddStep} style={{width:"100%",padding:"10px",borderRadius:10,background:C.darkCard,border:`1px dashed ${C.goldBorder}`,color:C.gold,fontSize:12,fontWeight:600,cursor:"pointer",marginTop:8,minHeight:36}}>+ Add Step</button>
                    <div style={{display:"flex",gap:8,marginTop:12}}>
                      <button onClick={()=>{saveSop();setEditingSteps(false);}} style={{flex:1,padding:"12px",borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:42}}>💾 Save Recipe</button>
                      <button onClick={()=>{setEditingSteps(false);setSopModal(null);}} style={{padding:"12px 18px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:42}}>Cancel</button>
                    </div>
                  </div>
                ):(
                  safeArr(sopRecipe.steps).map((step,si)=>(
                    <div key={si} style={{padding:"14px 0",borderBottom:si<sopRecipe.steps.length-1?`1px solid ${C.borderLight}`:"none",...(step.ccp?{background:C.redBg,borderLeft:`3px solid ${C.red}`,marginLeft:-12,paddingLeft:12,borderRadius:6}:{})}}>
                      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                        <div style={{width:32,height:32,borderRadius:8,background:step.ccp?C.red:C.gold+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:step.ccp?"#fff":C.gold,flexShrink:0}}>{si+1}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>{cleanStepText(step.t)}{Array.isArray(step.subs)&&step.subs.length>0&&<span style={{fontSize:11,color:C.muted,fontWeight:400,marginLeft:8}}>({step.subs.length} sub-steps)</span>}</div>
                          <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{cleanStepText(step.i||step.desc||"")}</div>
                          {step.tm&&<span style={{fontSize:12,color:C.amber,background:C.amberBg,padding:"5px 10px",borderRadius:8,display:"inline-block",marginTop:6}}>⏱ {fmtT(step.tm)}</span>}
                          {step.ccp&&<span style={{fontSize:12,color:C.red,background:C.redBg,padding:"5px 10px",borderRadius:8,display:"inline-block",marginTop:6,marginLeft:6}}>🔴 CCP: {step.ccp}</span>}
                        </div>
                      </div>
                      {Array.isArray(step.subs)&&step.subs.length>0&&(
                        <div style={{borderLeft:`2px solid ${C.gold}`,marginLeft:16,marginTop:8,paddingLeft:12}}>
                          {step.subs.map((sb,sbi)=>(
                            <div key={sbi} style={{padding:"6px 0",borderBottom:sbi<step.subs.length-1?`1px solid ${C.borderLight}`:"none"}}>
                              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                                <span style={{fontSize:11,fontWeight:700,color:C.gold,minWidth:22}}>{si+1}{String.fromCharCode(97+sbi)}.</span>
                                <div>
                                  <div style={{fontSize:12,fontWeight:600,color:C.text}}>{sb.t}</div>
                                  {sb.i&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{sb.i}</div>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
                {/* ═══ CCP Summary Table ═══ */}
                {(()=>{const ccpSteps=safeArr(sopRecipe.steps).map((s,i)=>({...s,_si:i})).filter(s=>s.ccp);if(!ccpSteps.length)return null;return(
                  <div style={{marginTop:16,padding:"14px 16px",background:C.redBg,borderRadius:12,border:`1px solid ${C.redBorder}`}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>🔴 Critical Control Points ({ccpSteps.length})</div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{borderBottom:`1px solid ${C.redBorder}`}}>
                          <th style={{textAlign:"left",padding:"6px 8px",fontWeight:700,color:C.red,width:40}}>Step</th>
                          <th style={{textAlign:"left",padding:"6px 8px",fontWeight:700,color:C.red}}>Process</th>
                          <th style={{textAlign:"left",padding:"6px 8px",fontWeight:700,color:C.red}}>CCP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ccpSteps.map(s=>(
                          <tr key={s._si} style={{borderBottom:`1px solid ${C.redBorder}22`}}>
                            <td style={{padding:"6px 8px",fontWeight:700,color:C.text}}>{s._si+1}</td>
                            <td style={{padding:"6px 8px",color:C.text,lineHeight:1.4}}>{cleanStepText(s.t)}</td>
                            <td style={{padding:"6px 8px",color:C.red,fontWeight:600,lineHeight:1.4}}>{s.ccp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );})()}
              </Card>
            </div>
          )}
        </div>
        );
      })()}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab==="analytics"&&(()=>{
        const allEvs=[...todayEvs,...tomorrowEvs,...evList.filter(e=>e.date!==TODAY&&e.date!==TOMORROW)];
        const hasCombined=kt["__combined"]&&Object.keys(kt["__combined"]).length>0;
        const uniqueDates=[...new Set(allEvs.map(e=>e.date))].sort().reverse();
        const selDate=analyticsDate||uniqueDates[0]||TODAY;
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
          Object.entries(kt["__combined"]||{}).forEach(([k,d2s])=>{if(k.startsWith("dish|")){const n=k.slice(5);perfs.push(buildPerf(n,d2s));seen.add(n);}});
          allEvs.forEach(ev=>{menuArr(ev).forEach(name=>{if(!seen.has(name)){perfs.push(buildPerf(name,{}));seen.add(name);}});});
        } else if(selId){
          const ev=allEvs.find(e=>e.id===selId);
          if(ev)menuArr(ev).forEach((name,idx)=>{if(!seen.has(name)){const d2s=kt[selId]?.[selId+"|"+idx]||{};perfs.push(buildPerf(name,d2s));seen.add(name);}});
        }
        const done=perfs.filter(p=>p.isDone);const started=perfs.filter(p=>!p.isDone&&p.actT>0);
        const byS={};perfs.forEach(p=>{if(!byS[p.catId])byS[p.catId]={n:p.catName,ic:p.catIcon,co:p.catColor,ds:[]};byS[p.catId].ds.push(p);});
        const avgDelta=done.length?Math.round(done.reduce((s,p)=>s+p.delta,0)/done.length):0;
        const avgStoreArr=done.filter(p=>p.storeT!=null);const avgStoreT=avgStoreArr.length?Math.round(avgStoreArr.reduce((s,p)=>s+p.storeT,0)/avgStoreArr.length):null;
        const totalOver=done.reduce((s,p)=>s+p.overC,0);const totalUnder=done.reduce((s,p)=>s+p.underC,0);
        const fS=s=>{if(s==null)return"—";const m=Math.floor(Math.abs(s)/60);const sc=Math.abs(s)%60;return m+"m"+(sc>0?" "+sc+"s":"");};
        const dC=d=>d==null?C.faint:d>5?C.red:d<-5?C.green:C.muted;
        const dBadge=d=>d==null?"—":d>0?"+"+fS(d):d<0?fS(Math.abs(d))+" under":"on time";
        // Ingredient deltas
        const deltas=[];(usageLogs||[]).forEach(log=>{(log.ingredients||[]).forEach(ing=>{
          if(ing.actual_qty!=null&&Math.abs(ing.actual_qty-ing.scaled_qty)>0.01)
            deltas.push({dish:log.dish_name,n:ing.name,scaled:ing.scaled_qty,actual:ing.actual_qty,u:ing.unit,d:ing.actual_qty-ing.scaled_qty,pct:ing.scaled_qty>0?Math.round((ing.actual_qty-ing.scaled_qty)/ing.scaled_qty*100):0});
        });});
        const selEv=selId&&selId!=="__combined"?allEvs.find(e=>e.id===selId):null;
        return(
          <div>
            <div style={{fontSize:18,fontWeight:500,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>📊 {T2("Kitchen Analytics")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Performance analysis — timing, efficiency, ingredient variance")}</div>
            {/* ── Calendar Date Picker ── */}
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
                          <div style={{fontSize:12,fontWeight:isT||isS?600:400,color:isS?C.gold:isT?"#BA7517":hasTracked?C.green:C.text}}>{cell.d}{hasTracked&&<span style={{fontSize:8,marginLeft:1,verticalAlign:"super"}}>✓</span>}</div>
                          {vCols.length>0&&<div style={{display:"flex",gap:2,marginTop:2}}>{vCols.slice(0,4).map((col,ci)=><div key={ci} style={{width:6,height:6,borderRadius:"50%",background:col}}/>)}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:10,padding:"6px 14px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                    {Object.entries(ANA_VP).map(([v,p])=><div key={v} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:6,height:6,borderRadius:"50%",background:p.c}}/><span style={{fontSize:10,color:C.muted}}>{p.code}</span></div>)}
                    <div style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:14,height:14,borderRadius:3,background:"rgba(29,158,117,0.08)",border:"1px solid rgba(29,158,117,0.18)"}}><span style={{fontSize:7,color:C.green,display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>✓</span></div><span style={{fontSize:10,color:C.muted}}>Tracked</span></div>
                  </div>
                </div>);
              })()}
              {/* ── Event cards for selected date ── */}
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{fmtDate(selDate)} · {dateEvs.length} event{dateEvs.length!==1?"s":""}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                {hasCombined&&<button onClick={()=>{setAnalyticsEvId("__combined");setAnalyticsExp(new Set());}} style={{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:selId==="__combined"?700:400,cursor:"pointer",background:selId==="__combined"?C.gold+"20":"transparent",color:selId==="__combined"?C.gold:C.muted,border:`1.5px solid ${selId==="__combined"?C.gold:C.border}`,minHeight:40}}>🍳 Combined</button>}
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
            {/* ── Summary Cards ── */}
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
            {/* ── Section Breakdown ── */}
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
                      <span style={{fontSize:11,color:C.green,fontWeight:600}}>⬇{un}</span>
                      <span style={{fontSize:11,color:C.red,fontWeight:600}}>⬆{ov}</span>
                      <span style={{fontSize:14,color:C.faint}}>{secOpen?"▼":"▶"}</span>
                    </div>
                  </div>
                  {secOpen&&<div style={{padding:"0 12px 12px",borderTop:`1px solid ${C.borderLight}`}}>
                    {sec.ds.sort((a,b)=>{const o={done:0,in_progress:1,not_started:2};return o[a.status]-o[b.status];}).map(p=>{const isOpen=analyticsExp.has(p.name);const usageLog=(usageLogs||[]).find(l=>l.dish_name===p.name);const stColor=p.status==="done"?C.green:p.status==="in_progress"?C.amber:C.faint;const stLabel=p.status==="done"?"✅":p.status==="in_progress"?"⏳":"⬜";return(
                      <div key={p.name} style={{marginTop:6,borderRadius:8,border:`1px solid ${p.status==="not_started"?C.borderLight:C.border}`,background:p.status==="not_started"?C.bg:C.surface,opacity:p.status==="not_started"?.6:1}}>
                        <div onClick={()=>{if(p.hasData)toggleAnalyticsDish(p.name);}} style={{padding:"10px 12px",cursor:p.hasData?"pointer":"default",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontSize:12,fontWeight:600,color:p.status==="not_started"?C.faint:C.text}}>{stLabel} {p.name}</div>
                            <div style={{fontSize:10,color:C.muted}}>{p.isDone&&p.totalT!=null?"Total: "+fS(p.totalT)+" · ":""}Expected: {fS(p.expT)||"—"}</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {p.isDone&&p.hasData&&<div style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:700,background:p.delta>5?C.redBg:p.delta<-5?C.greenBg:C.surface,border:`1px solid ${p.delta>5?C.redBorder:p.delta<-5?C.greenBorder:C.border}`,color:p.delta>5?C.red:p.delta<-5?C.green:C.muted}}>{p.delta>0?"+":""}{fS(p.delta)}</div>}
                            {p.hasData&&<span style={{fontSize:12,color:C.faint}}>{isOpen?"▼":"▶"}</span>}
                          </div>
                        </div>
                        {isOpen&&<div style={{padding:"0 12px 10px",borderTop:`1px solid ${C.borderLight}`}}>
                          {p.storeT!=null&&<div style={{padding:"6px 0",fontSize:11,color:C.muted}}>🏪 Store: <b style={{color:C.gold}}>{fS(p.storeT)}</b></div>}
                          {p.sPerfs.map((sp,si)=>{
                            if(sp.hs){return(
                              <div key={si} style={{padding:"4px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                                <div style={{fontSize:11,fontWeight:600,color:sp.done?C.green:C.text,marginBottom:3}}>{si+1}. {sp.l} {sp.done&&"✅"}</div>
                                <div style={{marginLeft:14}}>
                                  {sp.subs.map((sub,sbi)=>{const dc=sub.delta!=null?(sub.delta>0?C.red:sub.delta<0?C.green:C.muted):C.faint;return(
                                    <div key={sbi} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",fontSize:10}}>
                                      <span style={{color:sub.done?C.green:C.text}}>{si+1}{String.fromCharCode(97+sbi)}. {sub.l}</span>
                                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                                        <span style={{color:C.faint}}>SOP {sub.exp?fS(sub.exp):"—"}</span>
                                        <span style={{fontWeight:600,color:sub.done?dc:C.faint}}>{sub.act!=null?fS(sub.act):"—"}</span>
                                        {sub.delta!=null&&<span style={{fontWeight:700,color:dc,fontSize:9}}>{sub.delta>0?"🔴+":"🟢"}{fS(Math.abs(sub.delta))}</span>}
                                      </div>
                                    </div>
                                  );})}
                                </div>
                              </div>
                            );}
                            const dc=sp.delta!=null?(sp.delta>0?C.red:sp.delta<0?C.green:C.muted):C.faint;
                            return(
                              <div key={si} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.borderLight}`,fontSize:11}}>
                                <span style={{color:sp.done?C.green:C.text}}>{si+1}. {sp.l} {sp.done&&"✅"}</span>
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
                              <div style={{fontSize:10,fontWeight:700,color:C.gold,marginBottom:4}}>📊 Ingredients</div>
                              {dts.map((ing,ii)=>{const diff=ing.actual_qty-ing.scaled_qty;const pct=ing.scaled_qty>0?Math.round(diff/ing.scaled_qty*100):0;return(
                                <div key={ii} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",fontSize:10,borderBottom:ii<dts.length-1?`1px solid ${C.borderLight}`:"none"}}>
                                  <span style={{color:C.text}}>{ing.name}</span>
                                  <span><span style={{color:C.faint}}>{ing.scaled_qty}{ing.unit}</span> → <b style={{color:C.text}}>{ing.actual_qty}{ing.unit}</b> <span style={{fontWeight:700,color:diff>0?C.red:C.green}}>{diff>0?"+":""}{pct}%</span></span>
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
            {/* ── Dish Performance ── */}
            
            {false&&perfs.sort((a,b)=>{if(a.status!==b.status){const o={done:0,in_progress:1,not_started:2};return o[a.status]-o[b.status];}if(a.isDone&&b.isDone)return b.delta-a.delta;return 0;}).map(p=>{const isOpen=analyticsExp.has(p.name);const usageLog=(usageLogs||[]).find(l=>l.dish_name===p.name);const stColor=p.status==="done"?C.green:p.status==="in_progress"?C.amber:C.faint;const stLabel=p.status==="done"?"✅ Done":p.status==="in_progress"?"⏳ In progress":"⬜ Not started";return(
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
                    {p.hasData&&<span style={{fontSize:14,color:C.faint}}>{isOpen?"▼":"▶"}</span>}
                  </div>
                </div>
                {isOpen&&<div style={{padding:"0 16px 14px",borderTop:`1px solid ${C.borderLight}`}}>
                  {p.storeT!=null&&<div style={{padding:"8px 0",fontSize:12,color:C.muted}}>🏪 Store collection: <b style={{color:C.gold}}>{fS(p.storeT)}</b></div>}
                  {p.sPerfs.map((sp,si)=>{
                    if(sp.hs){return(
                      <div key={si} style={{padding:"6px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                        <div style={{fontSize:12,fontWeight:600,color:sp.done?C.green:C.text,marginBottom:4}}>{si+1}. {sp.l} {sp.done&&"✅"}</div>
                        <div style={{marginLeft:16}}>
                          {sp.subs.map((sub,sbi)=>{const dc=sub.delta!=null?(sub.delta>0?C.red:sub.delta<0?C.green:C.muted):C.faint;return(
                            <div key={sbi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",fontSize:11}}>
                              <span style={{color:sub.done?C.green:C.text}}>{si+1}{String.fromCharCode(97+sbi)}. {sub.l}</span>
                              <div style={{display:"flex",gap:8,flexShrink:0}}>
                                <span style={{color:C.faint}}>{sub.exp?fS(sub.exp):"—"}</span>
                                <span style={{fontWeight:600,color:sub.done?dc:C.faint}}>{sub.act!=null?fS(sub.act):"—"}</span>
                                {sub.delta!=null&&<span style={{fontSize:10,fontWeight:700,color:dc,minWidth:50,textAlign:"right"}}>{sub.delta>0?"🔴 +":"🟢 "}{fS(Math.abs(sub.delta))}</span>}
                              </div>
                            </div>
                          );})}
                        </div>
                      </div>
                    );}
                    const dc=sp.delta!=null?(sp.delta>0?C.red:sp.delta<0?C.green:C.muted):C.faint;
                    return(
                      <div key={si} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.borderLight}`,fontSize:12}}>
                        <span style={{color:sp.done?C.green:C.text,fontWeight:500}}>{si+1}. {sp.l} {sp.done&&"✅"}</span>
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
                            <span style={{color:C.text,fontWeight:600}}>→ {ing.actual_qty} {ing.unit}</span>
                            {(isOver||isUnder)&&<span style={{fontSize:10,fontWeight:700,color:isOver?C.red:C.green,padding:"1px 6px",borderRadius:4,background:isOver?C.redBg:C.greenBg}}>{isOver?"+":""}{pct}%</span>}
                            {!isOver&&!isUnder&&<span style={{fontSize:10,color:C.green}}>✓</span>}
                          </div>
                        </div>
                      );})}
                    </div>
                  );})()}
                </div>}
              </div>
            );})}
            {/* ── Ingredient Variance Summary ── */}
            {deltas.length===0&&usageLogs.length>0&&<div style={{marginTop:20,padding:"16px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,textAlign:"center"}}><div style={{fontSize:11,color:C.muted}}>📊 All ingredients used at scaled quantities — no variances recorded</div></div>}
            {deltas.length===0&&usageLogs.length===0&&perfs.length>0&&<div style={{marginTop:20,padding:"16px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,textAlign:"center"}}><div style={{fontSize:11,color:C.faint}}>📊 No ingredient usage data yet — data appears when chefs log actual quantities on "Mark prep done"</div></div>}
            {deltas.length>0&&(<>
              <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:8,marginTop:20,textTransform:"uppercase",letterSpacing:.5}}>Ingredient Variance</div>
              <div style={{borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                <table style={{borderCollapse:"collapse",fontSize:11,width:"100%"}}>
                  <thead><tr style={{background:C.darkCard}}>
                    <th style={{padding:"8px 10px",textAlign:"left",color:C.muted}}>Dish</th>
                    <th style={{padding:"8px 10px",textAlign:"left",color:C.muted}}>Ingredient</th>
                    <th style={{padding:"8px 8px",textAlign:"right",color:C.muted}}>Scaled</th>
                    <th style={{padding:"8px 8px",textAlign:"right",color:C.muted}}>Actual</th>
                    <th style={{padding:"8px 8px",textAlign:"right",color:C.muted}}>Δ</th>
                  </tr></thead>
                  <tbody>{deltas.sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).map((d,i)=>(
                    <tr key={i} style={{borderTop:`1px solid ${C.borderLight}`,background:i%2===0?C.surface:C.darkCard}}>
                      <td style={{padding:"6px 10px",fontSize:11,color:C.text}}>{d.dish}</td>
                      <td style={{padding:"6px 10px",fontSize:11,color:C.text,fontWeight:500}}>{d.n}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:C.faint}}>{d.scaled} {d.u}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:C.text,fontWeight:600}}>{d.actual} {d.u}</td>
                      <td style={{padding:"6px 8px",textAlign:"right"}}><span style={{fontWeight:700,color:d.d>0?C.red:C.green,padding:"2px 6px",borderRadius:4,background:d.d>0?C.redBg:C.greenBg}}>{d.d>0?"+":""}{d.pct}%</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>)}
            </>)}
          </div>
        );
      })()}

      {/* ═══ DISH NAME MAPPING MODAL ═══ */}
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
            alert('✅ '+entries.length+' mapping(s) saved');
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
                  <div style={{fontSize:16,fontWeight:700,color:C.text}}>🔗 Dish Name Mapping</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:3}}>Link LMS menu items → SOP recipes · {lmsNames.length} dishes</div>
                </div>
                <button onClick={()=>setShowDishMap(false)} style={{width:32,height:32,borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
              {/* Stats */}
              <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
                <span style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red}}>⚠ {unlinked.length} unlinked</span>
                <span style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold}}>🔗 {mapped.length} mapped</span>
                <span style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green}}>✓ {auto.length} auto-matched</span>
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
                    {row.status==="auto"&&!sel&&<div style={{fontSize:10,color:C.green,marginTop:2}}>auto → {row.sopName}</div>}
                    {row.status==="mapped"&&!sel&&<div style={{fontSize:10,color:C.gold,marginTop:2}}>mapped → {row.sopName}</div>}
                    {sel&&<div style={{fontSize:10,color:C.amber,marginTop:2}}>→ {sel.split("/")[0].trim()} (unsaved)</div>}
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
                        {(row.status==="mapped"&&!sel)&&<button onClick={()=>removeMapping(row.lms)} style={{padding:"3px 8px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:10,cursor:"pointer",flexShrink:0}}>✕</button>}
                        {sel&&<button onClick={()=>setDishMapSel(p=>({...p,[row.lms]:null}))} style={{padding:"3px 8px",borderRadius:6,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:10,cursor:"pointer",flexShrink:0}}>✕</button>}
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
                <button onClick={saveMappings} disabled={dishMapSaving} style={{padding:"10px 24px",borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",opacity:dishMapSaving?.6:1,minHeight:40}}>{dishMapSaving?"Saving...":"💾 Save Mappings"}</button>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* ═══ MENU TAB ═══ */}
      

      {/* ═══ INGREDIENT MATRIX EDITOR MODAL ═══ */}
      {ingModal&&tab!=="sops"&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 0",overflowY:"auto"}}>
          <div style={{background:C.surface,borderRadius:16,width:"min(96vw,600px)",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>
            {/* Header */}
            <div style={{position:"sticky",top:0,zIndex:2,background:C.surface,padding:"18px 20px 12px",borderBottom:`1px solid ${C.border}`,borderRadius:"16px 16px 0 0"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:C.text}}>🧂 Ingredient Matrix</div>
                  <div style={{fontSize:12,color:C.gold,marginTop:2}}>{ingModal.recipeName}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {ingDirty&&<button onClick={saveIngredients} style={{padding:"8px 18px",borderRadius:10,fontSize:12,fontWeight:700,background:C.green,color:"#fff",border:"none",cursor:"pointer",minHeight:36}}>💾 Save</button>}
                  <button onClick={()=>{if(ingDirty&&!confirm("Discard unsaved changes?"))return;setIngModal(null);}} style={{padding:"8px 14px",borderRadius:10,fontSize:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",minHeight:36}}>✕</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:12,fontSize:11,color:C.muted}}>
                <span style={{flexShrink:0}}>Batch sizes:</span>
                {ingForm.pax_sizes.map((p,pi)=>(
                  <span key={pi} style={{padding:"3px 10px",borderRadius:6,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,fontWeight:700,fontSize:12}}>{p} pax</span>
                ))}
              </div>
            </div>
            {/* Ingredient rows */}
            <div style={{padding:"12px 16px"}}>
              {ingForm.items.length===0&&(
                <div style={{textAlign:"center",padding:"30px 20px",color:C.faint,fontSize:13}}>No ingredients yet. Tap "+ Add Ingredient" below.</div>
              )}
              {ingForm.items.map((item,idx)=>(
                <div key={idx} style={{marginBottom:10,borderRadius:12,border:`1px solid ${C.border}`,background:idx%2===0?C.surface:C.darkCard,overflow:"hidden"}}>
                  {/* Row header */}
                  <div style={{padding:"10px 12px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",borderBottom:`1px solid ${C.borderLight}`}}>
                    <input value={item.name} onChange={e=>ingUpdateItem(idx,"name",e.target.value)} placeholder="Ingredient name" style={{flex:1,minWidth:90,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:"transparent"}}/>
                    <input value={item.hindi||""} onChange={e=>ingUpdateItem(idx,"hindi",e.target.value)} placeholder="हिंदी" style={{width:75,padding:"6px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:"transparent"}}/>
                    <select value={item.unit} onChange={e=>ingUpdateItem(idx,"unit",e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,minHeight:32}}>
                      {["kg","gm","L","ml","pcs","Bot","tin","bunch","dozen"].map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                    <div style={{display:"flex",gap:2}}>
                      <button onClick={()=>ingMoveItem(idx,-1)} disabled={idx===0} style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,cursor:idx>0?"pointer":"default",opacity:idx>0?1:.3,fontSize:11,color:C.muted}}>↑</button>
                      <button onClick={()=>ingMoveItem(idx,1)} disabled={idx===ingForm.items.length-1} style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,cursor:idx<ingForm.items.length-1?"pointer":"default",opacity:idx<ingForm.items.length-1?1:.3,fontSize:11,color:C.muted}}>↓</button>
                    </div>
                    <button onClick={()=>ingRemoveItem(idx)} style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.redBorder}`,background:C.redBg,cursor:"pointer",fontSize:12,color:C.red}}>✕</button>
                  </div>
                  {/* Quantity inputs */}
                  <div style={{padding:"8px 12px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {ingForm.pax_sizes.map((p,pi)=>(
                      <div key={pi} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        <span style={{fontSize:9,color:C.faint}}>{p}</span>
                        <input type="number" step="0.1" value={item.qty[pi]||""} onChange={e=>ingUpdateQty(idx,pi,e.target.value)} style={{width:60,padding:"5px 6px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,textAlign:"center",color:C.text,background:"transparent"}}/>
                      </div>
                    ))}
                    <span style={{fontSize:10,color:C.faint,marginLeft:4}}>{item.unit}</span>
                    <button onClick={()=>ingToggleNv(idx)} style={{marginLeft:"auto",padding:"4px 8px",borderRadius:6,fontSize:10,fontWeight:600,border:`1px solid ${item.nv_qty?C.amberBorder:C.border}`,background:item.nv_qty?C.amberBg:C.surface,color:item.nv_qty?C.amber:C.faint,cursor:"pointer"}}>
                      {item.nv_qty?"NV ✓":"+ NV"}
                    </button>
                  </div>
                  {/* NV row */}
                  {item.nv_qty&&(
                    <div style={{padding:"6px 12px 10px",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",borderTop:`1px dashed ${C.amberBorder}`,background:C.amberBg+"40"}}>
                      <span style={{fontSize:10,color:C.amber,fontWeight:600,width:50}}>NV:</span>
                      {ingForm.pax_sizes.map((p,pi)=>(
                        <div key={pi} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                          <span style={{fontSize:9,color:C.amber}}>{p}</span>
                          <input type="number" step="0.1" value={item.nv_qty[pi]||""} onChange={e=>ingUpdateNvQty(idx,pi,e.target.value)} style={{width:60,padding:"5px 6px",borderRadius:6,border:`1px solid ${C.amberBorder}`,fontSize:12,textAlign:"center",color:C.amber,background:"transparent"}}/>
                        </div>
                      ))}
                      <span style={{fontSize:10,color:C.amber,marginLeft:4}}>{item.unit}</span>
                    </div>
                  )}
                  {/* Notes */}
                  <div style={{padding:"4px 12px 8px"}}>
                    <input value={item.notes||""} onChange={e=>ingUpdateItem(idx,"notes",e.target.value)} placeholder="Notes (optional)" style={{width:"100%",padding:"4px 8px",borderRadius:6,border:`1px solid ${C.borderLight}`,fontSize:11,color:C.muted,background:"transparent",boxSizing:"border-box"}}/>
                  </div>
                </div>
              ))}
              <button onClick={ingAddItem} style={{width:"100%",padding:"12px",borderRadius:10,border:`2px dashed ${C.goldBorder}`,background:C.goldBg,color:C.gold,fontSize:13,fontWeight:700,cursor:"pointer",marginTop:8,minHeight:44}}>+ Add Ingredient</button>
            </div>
            {/* Footer */}
            <div style={{position:"sticky",bottom:0,padding:"12px 16px",borderTop:`1px solid ${C.border}`,background:C.surface,borderRadius:"0 0 16px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:ingDirty?C.amber:C.faint}}>{ingForm.items.length} ingredient{ingForm.items.length!==1?"s":""}{ingDirty?" · unsaved":""}</span>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{if(ingDirty&&!confirm("Discard changes?"))return;setIngModal(null);}} style={{padding:"8px 16px",borderRadius:10,fontSize:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",minHeight:36}}>Cancel</button>
                <button onClick={saveIngredients} disabled={!ingDirty} style={{padding:"8px 20px",borderRadius:10,fontSize:12,fontWeight:700,background:ingDirty?C.green:C.faint,color:"#fff",border:"none",cursor:ingDirty?"pointer":"default",opacity:ingDirty?1:.5,minHeight:36}}>💾 Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Ingredient Usage Modal ═══ */}
      {usageModal && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>{usageModal.onConfirm();setUsageModal(null);}}>
          <div style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:520,maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 8px 32px rgba(0,0,0,.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid "+C.border}}>
              <div style={{fontSize:15,fontWeight:700,color:C.text}}>📊 Ingredient Usage</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{usageModal.dishName} — {usageModal.pax} pax {usageModal.isPrepDay?"(Prep Day)":"(Event Day)"}</div>
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
              <button onClick={saveUsageAndDone} style={{flex:2,padding:"12px",borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>Save & Done ✅</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export { KitchenHub };
