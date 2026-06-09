// Ambria FnB — Kitchen Hub (Overview, Prep Tracking, Prep Plan, Recipe SOPs)
import React, { useState, useRef, useEffect } from "react";
import { C, SECTIONS, SECTION_META } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, TODAY_LABEL, safeArr, safeNum } from '../utils/helpers.js';
import { MENU_PACKAGES, MENU_PACKAGE_NAMES } from '../data/menuPackages.js';
import { guessSectionForDish, GENERIC_STEPS, RECIPE_INGREDIENTS, RECIPE_DB, findRecipeForDish, getStepsForDish, fmtT, BEV_RE, getFullSteps, getDishImageUrl } from '../data/recipeData.js';
import { Avatar, Card, Btn, Chip, STag, SelfieCapture, SectionHeader } from './SharedUI.jsx';

function KitchenHub({ events, kitchenTracking, setKitchenTracking, lang="en", odcOnly=false, currentUser=null, transportQueue=[], setTransportQueue }) {
  const T2 = s => T(s, lang);

  // Safe menu array — handles JSONB array or stringified JSON from Supabase
  function menuArr(ev) {
    const m = ev.menu;
    if (Array.isArray(m)) return m;
    if (typeof m === 'string' && m) { try { return JSON.parse(m); } catch(e) { return []; } }
    return [];
  }

  // Section tablet filtering
  const isSectionUser = currentUser?.role?.startsWith('section_');
  const SECTION_ROLE_MAP = {
    section_indian: 'Indian Curries',
    section_chinese: 'Chinese',
    section_tandoor: 'Tandoor',
    section_chaat: 'Chaat',
    section_sweets: 'Sweets',
    section_continental: 'Continental',
    section_bakery: 'Bakery',
  };
  const sectionFilter = isSectionUser
    ? (SECTION_ROLE_MAP[currentUser.role] || currentUser.section || null)
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
  const [specialOpen, setSpecialOpen] = useState(null); // "today_Indian Curries" etc
  const toggleSec = (sec)=>setExpandedSecs(p=>({...p,[sec]:p[sec]===false?true:(p[sec]===undefined?false:!p[sec])}));
  const isSecOpen = (sec)=>expandedSecs[sec]!==false; // default open
  const [sopCat, setSopCat] = useState(null);
  const [sopRecipe, setSopRecipe] = useState(null);
  const [sopSearch, setSopSearch] = useState("");
  const [scaleDish, setScaleDish] = useState("");
  const [scaleMode, setScaleMode] = useState("single");
  const [scalePkg, setScalePkg] = useState("");
  const [scaleMultiSel, setScaleMultiSel] = useState({});
  const [scaleOverrides, setScaleOverrides] = useState({});
  const [scaleEditing, setScaleEditing] = useState(null);
  const [scalePercent, setScalePercent] = useState(100); // % multiplier
  const [scaleEventId, setScaleEventId] = useState(null); // null | "manual" | eventId
  const [openSections, setOpenSections] = useState({});
  const [appliedScales, setAppliedScales] = useState({}); // {evId: {percent, appliedAt, dishes[]}}
  const [d1View, setD1View] = useState("all"); // "all" | "cont" | "new"
  // Helper: get effective scaling % for an event
  function getEventScale(evId){return appliedScales[evId]?.percent||100;}
  // Apply scaling to a raw per-pax quantity
  function applyScale(q, evId){return q*(getEventScale(evId)/100);}
  const [tick, setTick] = useState(0);
  const [dishSignoff, setDishSignoff] = useState(null); // {evId,idx,mode:"completed"|"ready_for_transport",chefName,selfie}

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

  // ── Store Step: stoppable timer + quality remarks ──
  const [storeRemarks, setStoreRemarks] = useState({}); // {"evId_idx_si": {rating:"",text:""}}
  function stopStoreStep(evId,idx,si){
    const d=ds(evId,idx);
    setDs(evId,idx,{manual:{...(d.manual||{}),[si]:true},storeEndAt:{...(d.storeEndAt||{}),[si]:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}});
  }
  function saveStoreRemark(key,field,val){setStoreRemarks(p=>({...p,[key]:{...(p[key]||{rating:"",text:""}),[field]:val}}))}

  // Global 1-second tick drives all running timers
  useEffect(()=>{const t=setInterval(()=>setTick(k=>k+1),1000);return()=>clearInterval(t);},[]);

  // ── State helpers (auto-save to kitchenTracking) ──
  function dk(evId,idx){return evId+"|"+idx;}
  function ds(evId,idx){return kt[evId]?.[dk(evId,idx)]||{};}
  function setDs(evId,idx,upd){
    setKitchenTracking(p=>{const o=p&&typeof p==="object"?{...p}:{};const k2=dk(evId,idx);o[evId]={...(o[evId]||{}),[k2]:{...(o[evId]?.[k2]||{}),...upd}};return o;});
  }
  function setEvMeta(evId,key,val){
    setKitchenTracking(p=>{const o=p&&typeof p==="object"?{...p}:{};o[evId]={...(o[evId]||{}),[key]:val};return o;});
  }

  // ── Timer logic ──
  function startStep(evId,idx,si,tm){
    const d=ds(evId,idx);
    const starts={...(d.starts||{})};
    starts[si]=Date.now();
    setDs(evId,idx,{starts,stepTm:{...(d.stepTm||{}),[si]:tm}});
  }
  function elapsed(d,si){return d.starts?.[si]?Math.floor((Date.now()-d.starts[si])/1000):0;}
  function stepDone(d,si){
    if(d.manual?.[si]) return true;
    // If Mesa was completed on D-1, first 2 steps (Store + Mesa) are auto-done
    if(d.mesaDone && si <= 1) return true;
    if(!d.starts?.[si]) return false;
    const el=elapsed(d,si);const tm=d.stepTm?.[si]||0;
    return tm>0&&el>=tm;
  }
  function isD1Step(d,si){ return d.mesaDone && si <= 1; }
  function markManual(evId,idx,si){
    const d=ds(evId,idx);
    setDs(evId,idx,{manual:{...(d.manual||{}),[si]:true}});
  }
  function markComplete(evId,idx){setDs(evId,idx,{complete:true,completeAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})});}
  function markReady(evId,idx,dishName){setReadyModal({evId,idx,dishName});setReadyPhoto(null);setTimeout(startReadyCam,100);}
  function markDishDispatch(evId,idx){setDs(evId,idx,{dispatchReady:true,dispatchAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})});}
  function markDispatch(evId){setEvMeta(evId,"__dispatch_ready",true);setEvMeta(evId,"__dispatch_time",new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));}
  // Venues that need dispatch (not base kitchen)
  const DISPATCH_VENUES=["Manaktala Farm","Ambria Restro","Ambria Cuisine","Outdoor Catering (ODC)"];
  function evStats(ev){
    const menu=safeArr(ev.menu);
    const kitchenMenu=menu.filter(n=>guessSectionForDish(n)!=="Beverages");
    let rdy=0;
    kitchenMenu.forEach((n,i)=>{const realIdx=menu.indexOf(n);if(ds(ev.id,realIdx).ready)rdy++;});
    return{rdy,total:kitchenMenu.length,allRdy:rdy===kitchenMenu.length&&kitchenMenu.length>0,dispatched:!!(kt[ev.id]?.__dispatch_ready)};
  }

  const tomorrowLabel = new Date(TOMORROW+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
  const todayLabel2   = new Date(TODAY+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
  const dayAfterLabel = new Date(DAY_AFTER+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{day:"numeric",month:"short"});
  const hasTodayEvs   = todayEvs.length > 0;
  const hasTomorrowEvs = tomorrowEvs.length > 0;
  const hasDayAfterEvs = evList.filter(e=>e.date===DAY_AFTER).length > 0;

  const tomorrowEv0 = tomorrowEvs[0];
  const dayAfterEv0 = evList.find(e=>e.date===DAY_AFTER);

  // Tab 1:
  // No event today  → "🔥 31 May — D-1 for 1 Jun"
  // Event today     → "🔥 1 Jun  — Final Cooking"
  const todayTabL = hasTodayEvs
    ? `🔥 ${todayLabel2} — ${T2("Final Cooking")} (${todayEvs.reduce((s,e)=>s+(+e.pax||0),0)} pax)`
    : `🔥 ${todayLabel2} — D-1 ${T2("for")} ${tomorrowLabel} (${tomorrowEvs.reduce((s,e)=>s+(+e.pax||0),0)} pax)`;

  // Tab 2:
  // No event today  → "Continue of 31 May D-1 & D-1 for 2 Jun"  (Jun 1 event day = continuation + new D-1 for Jun 2)
  // Event today     → "Continue of [today] D-1 & D-1 for [dayAfter]"
  const contDate    = hasTodayEvs ? todayLabel2 : todayLabel2;
  const nextD1Date  = hasTodayEvs ? dayAfterLabel : dayAfterLabel;
  const nextD1Ev    = hasTodayEvs ? dayAfterEv0 : dayAfterEv0;
  const d1ForDate   = hasTodayEvs ? DAY_AFTER : TOMORROW;
  const d1ForLabel  = hasTodayEvs ? dayAfterLabel : tomorrowLabel;
  const d1Ev        = hasTodayEvs ? dayAfterEv0 : tomorrowEv0;

  const contPax  = hasTodayEvs ? todayEvs.reduce((s,e)=>s+(+e.pax||0),0) : tomorrowEvs.reduce((s,e)=>s+(+e.pax||0),0);
  const newD1Pax = evList.filter(e=>e.date===DAY_AFTER).reduce((s,e)=>s+(+e.pax||0),0);
  const d1TabL = `📋 ${T2("Continue")} ${todayLabel2} D-1 (${contPax} pax) & D-1 ${T2("for")} ${dayAfterLabel}${newD1Pax?` (${newD1Pax} pax)`:""}`;

  const TABS=[
    {v:"today",   l:todayTabL},
    {v:"d1",      l:d1TabL},
    {v:"scaling", l:`⚖️ ${T2("Pax Scaling")}`},
    {v:"sops",    l:`📖 ${T2("Recipe SOPs")}`},
    {v:"menus",   l:`📜 ${T2("Menu")}`},
  ];
  const TABS_FILTERED = isSectionUser
    ? TABS.filter(t => ['today','d1','sops'].includes(t.v))
    : TABS;

  // ── Inline dish card (shows live progress) ──

  return(
    <div style={{position:"relative"}}>

      {/* Section tablet banner */}
      {sectionFilter && (
        <div style={{background:C.goldBg,border:'1px solid '+C.goldBorder,
          borderRadius:12,padding:'12px 16px',marginBottom:14,
          display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:24}}>
            {sectionFilter==='Chinese'?'🥢':sectionFilter==='Tandoor'?'🔥':
             sectionFilter==='Indian Curries'?'🍛':sectionFilter==='Chaat'?'🥗':
             sectionFilter==='Sweets'?'🍮':sectionFilter==='Continental'?'🍝':'🍽'}
          </span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.gold}}>{sectionFilter} Section</div>
            <div style={{fontSize:11,color:C.muted}}>Showing only your section dishes</div>
          </div>
        </div>
      )}

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
                ?<button onClick={()=>{const s=snapReady();if(s){setReadyPhoto(s);stopReadyCam();}}} style={{flex:1,padding:"10px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:42}}>📸 {T2("Capture Photo")}</button>
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
                const now=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
                setDs(evId,idx,{ready:true,readyAt:now,readyPhoto:readyPhoto||null,selfie:readyPhoto||null,signature:readySig||null,completedBy:currentUser?.name||"Chef",completedAt:now});
                stopReadyCam();setReadyModal(null);setReadyPhoto(null);setReadySig(null);sigClear();
              }} style={{flex:1,padding:"14px",borderRadius:12,background:readyPhoto?`linear-gradient(135deg,${C.green},#1E6634)`:"#333",color:readyPhoto?"#fff":C.faint,border:"none",fontSize:14,fontWeight:700,cursor:readyPhoto?"pointer":"not-allowed",minHeight:50,fontFamily:"var(--font-display)",letterSpacing:.5}}>
                ✅ {T2("Confirm Ready")}
              </button>
              <button onClick={()=>{stopReadyCam();setReadyModal(null);setReadyPhoto(null);setReadySig(null);sigClear();}} style={{padding:"14px 16px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer",minHeight:50}}>✕</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SCALING TAB — rendered below in tab content ═══ */}
      {false&&(()=>{
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
        const BASE_PAX=1100;
        function isApplicable(pkg,pax){const m=MENU_APPLICABILITY[pkg];return m?m.ranges.some(r=>pax>=r.min&&pax<=r.max):false;}
        function fmtScaled(q,u,pax,pct){
          if(!q||q===0) return "—";
          const raw=q*pax*((pct||100)/100);
          if(u==="g") return raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g";
          if(u==="ml") return raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml";
          if(u==="pcs") return Math.ceil(raw)+" pcs";
          return Math.round(raw)+" "+u;
        }
        const allEvs=[...todayEvs,...tomorrowEvs,...evList.filter(e=>e.date===DAY_AFTER)];
        const linkedEv = scaleEventId ? allEvs.find(e=>e.id===scaleEventId) : null;
        const autoPercent = linkedEv ? Math.round((+linkedEv.pax/BASE_PAX)*100) : null;
        const effectivePct = scaleEventId===null ? 100 : (scalePercent||100);
        const pctLabel = `${effectivePct}%${linkedEv?" ("+linkedEv.guest+" · "+linkedEv.pax+" pax)":""}`;
        const mode=scaleMode||"single";
        const pkgNames=Object.keys(MENU_PACKAGES);
        const selPkg=scalePkg||pkgNames[0];
        const pkgDishes=(MENU_PACKAGES[selPkg]||[]).filter(d=>RECIPE_INGREDIENTS[d]);
        const multiSel=scaleMultiSel||{};
        const activeDishes=mode==="single"?(scaleDish&&RECIPE_INGREDIENTS[scaleDish]?[scaleDish]:[]):mode==="multi"?Object.keys(multiSel).filter(d=>multiSel[d]):pkgDishes;
        return(
          <div style={{marginBottom:24}}>
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>⚖️ {T2("Pax Scaling")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:14}}>{T2("Menu applicability matrix + ingredient quantities. Base: 1100 pax")} <span style={{color:"#FF6B35"}}>★</span></div>
            <Card style={{marginBottom:16,padding:"16px 18px",border:`1px solid ${C.goldBorder}`,background:C.goldBg}}>
              <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:10}}>📐 {T2("Scaling Control")}</div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>{T2("Scale based on")}</div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                <button onClick={()=>setScaleEventId("manual")} style={{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:scaleEventId==="manual"?700:400,cursor:"pointer",background:scaleEventId==="manual"?C.gold:C.surface,color:scaleEventId==="manual"?"#0A0908":C.muted,border:`1.5px solid ${scaleEventId==="manual"?C.gold:C.border}`,minHeight:38}}>✏️ {T2("Manual %")}</button>
                {allEvs.map(ev=>{
                  const autoPct=Math.round((+ev.pax/BASE_PAX)*100);
                  const isSel=scaleEventId===ev.id;
                  return(
                    <button key={ev.id} onClick={()=>{setScaleEventId(ev.id);setScalePercent(autoPct);}}
                      style={{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:isSel?700:400,cursor:"pointer",background:isSel?C.gold:C.surface,color:isSel?"#0A0908":C.muted,border:`1.5px solid ${isSel?C.gold:C.border}`,minHeight:38}}>
                      📅 {ev.guest.split(" ")[0]} · {ev.pax} pax → {autoPct}%
                    </button>
                  );
                })}
              </div>
              {scaleEventId==="manual"&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>{T2("Scaling %")}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
                    {[25,50,75,80,100,110,120,125,150].map(p=>(
                      <button key={p} onClick={()=>setScalePercent(p)}
                        style={{padding:"7px 14px",borderRadius:10,fontSize:13,fontWeight:scalePercent===p?800:400,cursor:"pointer",background:scalePercent===p?(p<100?C.amberBg:p>100?C.greenBg:C.goldBg):"transparent",color:scalePercent===p?(p<100?C.amber:p>100?C.green:C.gold):C.muted,border:`1.5px solid ${scalePercent===p?(p<100?C.amber:p>100?C.green:C.gold):C.border}`,minHeight:38}}>
                        {p}%
                      </button>
                    ))}
                    <input type="number" value={scalePercent} onChange={e=>setScalePercent(Math.max(1,Math.min(500,+e.target.value||100)))} min={1} max={500}
                      style={{width:72,padding:"8px 10px",borderRadius:10,border:`1px solid ${C.gold}`,fontSize:14,fontWeight:700,color:C.gold,background:C.bg,textAlign:"center",minHeight:38}}/>
                    <span style={{fontSize:12,color:C.muted}}>%</span>
                  </div>
                  <div style={{position:"relative",marginTop:4}}>
                    <input type="range" min={10} max={200} step={5} value={Math.min(200,scalePercent)}
                      onChange={e=>setScalePercent(+e.target.value)}
                      style={{width:"100%",accentColor:scalePercent<100?C.amber:scalePercent>100?C.green:C.gold,height:6,cursor:"pointer"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:2,fontSize:9,color:C.faint}}>
                      <span>10%</span><span style={{color:C.gold,fontWeight:700}}>100%</span><span>200%</span>
                    </div>
                    <div style={{position:"absolute",left:"47.4%",top:0,width:2,height:14,background:C.gold+"60",borderRadius:1,pointerEvents:"none"}}/>
                  </div>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bg,borderRadius:10,padding:"10px 14px"}}>
                <div>
                  <div style={{fontSize:11,color:C.muted}}>{T2("Active scaling")}</div>
                  <div style={{fontSize:16,fontWeight:800,color:effectivePct<100?C.amber:effectivePct>100?C.green:C.gold}}>{effectivePct}%</div>
                  {linkedEv&&<div style={{fontSize:11,color:C.muted}}>auto from {linkedEv.guest} · {linkedEv.pax} pax ÷ 1100</div>}
                </div>
                {effectivePct!==100&&activeDishes.length>0&&hasPermission(currentUser,"kitchen.scaling_apply")&&(
                  <button onClick={()=>{
                    const evId=scaleEventId==="manual"?null:scaleEventId;
                    const entry={percent:effectivePct,appliedAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),dishes:activeDishes,eventId:evId,eventName:linkedEv?.guest||"Manual"};
                    setAppliedScales(p=>({...p,[evId||"manual"]:entry}));
                    if(evId&&setKitchenTracking){
                      setKitchenTracking(p=>{const o=p&&typeof p==="object"?{...p}:{};o[evId]={...(o[evId]||{}),__scaling:{percent:effectivePct,dishes:activeDishes,appliedAt:entry.appliedAt}};return o;});
                    }
                  }} style={{padding:"10px 18px",borderRadius:10,background:`linear-gradient(135deg,${C.green},#1A5030)`,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>
                    ✅ {T2("Apply to D-1 & Event Day")}
                  </button>
                )}
                {effectivePct===100&&<div style={{fontSize:11,color:C.faint}}>{T2("100% = SOP quantities (no change)")}</div>}
              </div>
              {Object.values(appliedScales).length>0&&(
                <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
                  {Object.values(appliedScales).map((s,i)=>(
                    <div key={i} style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:s.percent<100?C.amberBg:C.greenBg,border:`1px solid ${s.percent<100?C.amberBorder:C.greenBorder}`,color:s.percent<100?C.amber:C.green}}>
                      ✅ {s.eventName} — {s.percent}% · {s.dishes.length} dishes · {s.appliedAt}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card style={{marginBottom:16,padding:0,overflow:"hidden"}}>
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
              <div style={{padding:"7px 14px",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.muted}}>💡 {T2("Tap any ✅ to load that menu's scaling below")}</div>
            </Card>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>⚖️ {T2("Ingredient Scaling")}</div>
            <div style={{display:"flex",gap:0,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:14}}>
              {[{v:"single",l:"🍽 Single"},{v:"multi",l:"📋 Multiple"},{v:"bulk",l:"📦 Full Menu"}].map(m=>(
                <button key={m.v} onClick={()=>{setScaleMode(m.v);if(m.v==="single")setScaleDish("");if(m.v!=="single")setScaleMultiSel({});}}
                  style={{flex:1,padding:"11px 8px",border:"none",cursor:"pointer",borderLeft:m.v!=="single"?`1px solid ${C.border}`:"none",background:mode===m.v?C.goldBg:"transparent"}}>
                  <div style={{fontSize:12,fontWeight:mode===m.v?700:400,color:mode===m.v?C.gold:C.muted}}>{m.l}</div>
                </button>
              ))}
            </div>
            {mode==="single"&&(
              <select value={scaleDish||""} onChange={e=>setScaleDish(e.target.value)} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:46,marginBottom:14}}>
                <option value="">— {T2("Select a dish")} —</option>
                {pkgNames.map(pkg=>(
                  <optgroup key={pkg} label={"📦 "+pkg+" ("+MENU_APPLICABILITY[pkg]?.code+")"}>
                    {(MENU_PACKAGES[pkg]||[]).filter(d=>RECIPE_INGREDIENTS[d]).map(d=><option key={d} value={d}>{d}</option>)}
                  </optgroup>
                ))}
              </select>
            )}
            {(mode==="multi"||mode==="bulk")&&(
              <div style={{marginBottom:14}}>
                <select value={scalePkg||pkgNames[0]} onChange={e=>{setScalePkg(e.target.value);setScaleMultiSel({});}} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:46,marginBottom:mode==="multi"?8:0}}>
                  {pkgNames.map(p=><option key={p} value={p}>{MENU_APPLICABILITY[p]?.code||p} — {p} · {MENU_APPLICABILITY[p]?.label} · {(MENU_PACKAGES[p]||[]).filter(d=>RECIPE_INGREDIENTS[d]).length} dishes</option>)}
                </select>
                {mode==="multi"&&(
                  <div style={{background:C.darkCard,borderRadius:12,padding:"12px",border:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{fontSize:11,color:C.muted}}>{Object.values(multiSel).filter(Boolean).length} {T2("selected")}</div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setScaleMultiSel(Object.fromEntries(pkgDishes.map(d=>[d,true])))} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,cursor:"pointer"}}>{T2("All")}</button>
                        <button onClick={()=>setScaleMultiSel({})} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer"}}>{T2("Clear")}</button>
                      </div>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {pkgDishes.map(d=><button key={d} onClick={()=>setScaleMultiSel(p=>({...p,[d]:!p[d]}))} style={{padding:"5px 10px",borderRadius:8,fontSize:10,cursor:"pointer",background:multiSel[d]?C.goldBg:C.surface,border:`1.5px solid ${multiSel[d]?C.gold:C.border}`,color:multiSel[d]?C.gold:C.muted,fontWeight:multiSel[d]?700:400}}>{multiSel[d]?"✓ ":""}{d}</button>)}
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeDishes.map(dish=>{
              const ingr=RECIPE_INGREDIENTS[dish]||[];
              return(
                <div key={dish} style={{marginBottom:18}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:6,fontFamily:"var(--font-display)",display:"flex",gap:8,alignItems:"center"}}>
                    {dish}
                    {Object.keys(scaleOverrides).some(k=>k.startsWith(dish+"|"))&&<button onClick={()=>setScaleOverrides(p=>{const n={...p};Object.keys(n).filter(k=>k.startsWith(dish+"|")).forEach(k=>delete n[k]);return n;})} style={{fontSize:9,padding:"2px 7px",borderRadius:5,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,cursor:"pointer"}}>↺</button>}
                  </div>
                  <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
                    <table style={{borderCollapse:"collapse",fontSize:10,minWidth:"100%"}}>
                      <thead>
                        <tr style={{background:C.darkCard}}>
                          <th style={{padding:"8px 10px",textAlign:"left",color:C.muted,position:"sticky",left:0,background:C.darkCard,borderRight:`1px solid ${C.border}`,minWidth:120}}>Ingredient</th>
                          {PAX_COLS.map(p=><th key={p} style={{padding:"8px 6px",textAlign:"center",fontWeight:p===BASE_PAX?800:500,color:p===BASE_PAX?"#FF6B35":C.muted,background:p===BASE_PAX?"#2A0D00":C.darkCard,borderLeft:`1px solid ${C.border}`,minWidth:58,whiteSpace:"nowrap"}}>{p===BASE_PAX?`★${p}`:p}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ingr.map((ing,ii)=>{
                          const isAcc=!ing.q||ing.q===0;
                          return(
                            <tr key={ii} style={{borderTop:`1px solid ${C.borderLight}`,background:ii%2===0?C.surface:C.darkCard}}>
                              <td style={{padding:"8px 10px",position:"sticky",left:0,background:ii%2===0?C.surface:C.darkCard,borderRight:`1px solid ${C.border}`}}>
                                <div style={{fontWeight:600,color:C.text}}>{ing.n}</div>
                                {ing.h&&<div style={{fontSize:9,color:C.faint}}>{ing.h}</div>}
                                {isAcc&&<div style={{fontSize:9,color:C.amber}}>acc. to taste</div>}
                              </td>
                              {PAX_COLS.map(p=>{
                                const ovKey=`${dish}|${ing.n}|${p}`;
                                const isBase=p===BASE_PAX;
                                const hasOv=scaleOverrides[ovKey]!==undefined;
                                const dv=isAcc?"—":(hasOv?scaleOverrides[ovKey]:fmtScaled(ing.q,ing.u,p,effectivePct));
                                return(
                                  <td key={p} style={{padding:"5px 3px",textAlign:"center",background:isBase?"#2A0D0080":undefined,borderLeft:`1px solid ${C.borderLight}`}}>
                                    {isAcc?<span style={{color:C.faint}}>—</span>:scaleEditing===ovKey
                                      ?<input autoFocus type="text" defaultValue={dv} onBlur={e=>{setScaleOverrides(p2=>({...p2,[ovKey]:e.target.value}));setScaleEditing(null);}} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape"){setScaleOverrides(p2=>({...p2,[ovKey]:e.target.value}));setScaleEditing(null);}}} style={{width:52,padding:"2px 3px",borderRadius:4,border:`1px solid ${C.gold}`,fontSize:10,color:C.text,background:C.bg,textAlign:"center"}}/>
                                      :<span onClick={()=>setScaleEditing(ovKey)} style={{display:"block",padding:"3px 2px",cursor:"pointer",color:isBase?"#FF6B35":hasOv?C.amber:C.text,fontWeight:isBase?700:hasOv?600:400,minWidth:50,borderRadius:3}}>{dv}</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {activeDishes.length===0&&<Card style={{padding:"24px",textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>⚖️</div><div style={{fontSize:13,color:C.muted}}>{mode==="single"?T2("Select a dish above"):mode==="multi"?T2("Select dishes from the package"):T2("Select a menu package")}</div></Card>}
          </div>
        );
      })()}

      {/* TABS */}
      <div style={{display:"flex",gap:8,marginBottom:18,alignItems:"center"}}>
        {TABS_FILTERED.map(t=>(
          <button key={t.v} onClick={()=>setTab(s=>{if(s!==t.v&&(t.v==="d1"||s==="d1"))setD1View("all");return t.v;})} style={{padding:"14px 24px",borderRadius:24,fontSize:15,fontWeight:600,cursor:"pointer",minHeight:48,background:tab===t.v?C.gold:"transparent",color:tab===t.v?"#0A0A0F":C.muted,border:`2px solid ${tab===t.v?C.gold:C.border}`}}>{t.l}</button>
        ))}
        {currentUser&&currentUser.role==='admin'&&(
          <button onClick={function(){
            if(!window.confirm('Reset ALL dish progress? This clears store sourcing, step timers, selfies, completion status for ALL dishes. Cannot undo.'))return;
            setKitchenTracking({});
            try{localStorage.removeItem('ambria_kt');}catch(e){}
            try{localStorage.removeItem('ambria_kitchen_tracking');}catch(e){}
            alert('✅ All dishes reset to fresh state');
          }} style={{padding:'6px 14px',borderRadius:8,background:'#200810',border:'1px solid #401828',color:'#D04040',fontSize:11,fontWeight:700,cursor:'pointer',marginLeft:'auto'}}>
            ↺ Reset All Dishes
          </button>
        )}
      </div>

      {/* ═══ D-1 PREP ═══ */}
      {/* ═══ D-1 PREP — CONSOLIDATED ═══ */}
      {tab==="today"&&(()=>{
        // If no event today → this tab IS the D-1 prep for tomorrow's function
        if(!hasTodayEvs) {
          const evs=tomorrowEvs;
          if(evs.length===0) return <Card style={{padding:"32px 24px",textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontSize:14,color:C.muted}}>{T2("No upcoming functions to prep for")}</div></Card>;
          const byDish={};
          evs.forEach(ev=>{
            const sp=ev.special||"";
            const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
            menuArr(ev).forEach((name,idx)=>{
              if(guessSectionForDish(name)==="Beverages") return;
              if(sectionFilter && guessSectionForDish(name) !== sectionFilter) return;
              if(!byDish[name])byDish[name]={sec:guessSectionForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
              byDish[name].totalPax+=ev.pax||0;
              byDish[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
              if(isSpecial) byDish[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
            });
          });
          const bySec={};Object.entries(byDish).forEach(([n,info])=>{if(!bySec[info.sec])bySec[info.sec]=[];bySec[info.sec].push({name:n,...info});});
          const secKeys=Object.keys(bySec).sort();const totalU=Object.keys(byDish).length;
          return(
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>
                📋 D-1 {T2("for")} {tomorrowLabel} — {evs.map(e=>e.guest).join(" · ")}
              </div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>{evs.map(e=>`${e.pax} pax`).join(" + ")} · {T2("Advance prep today")}</div>
              <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:18}}>💡</span>
                <div style={{fontSize:12,color:C.gold}}>{T2("These are advance prep steps — Mesa, marination, grinding, cutting, dough. Actual cooking will happen on the event day")} ({tomorrowLabel}).</div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.gold}}>{totalU}</div><div style={{fontSize:11,color:C.muted}}>{T2("unique dishes")}</div></div>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.text}}>{evs.reduce((s,e)=>s+(e.pax||0),0)}</div><div style={{fontSize:11,color:C.muted}}>{T2("total pax")}</div></div>
              </div>
              {secKeys.map(sec=>{
                const items=bySec[sec];const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                const mesaDone2=items.filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;
                const d1Pct=Math.round(mesaDone2/items.length*100);
                const d1Open=isSecOpen("d1t_"+sec);
                const d1Specials=[...new Map(items.flatMap(d=>d.specials||[]).map(sp=>[sp.guest+"|"+sp.instruction,sp])).values()];
                return(<Card key={sec} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
                  <div onClick={()=>toggleSec("d1t_"+sec)} style={{padding:"14px 16px",background:m2.color+"10",borderBottom:d1Open?`1px solid ${C.border}`:"none",cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:14,fontWeight:700,color:m2.color}}>{m2.icon} {T2(sec)}</span>
                        <span style={{fontSize:11,color:C.muted}}>{items.length} {T2("dishes")}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:48,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:d1Pct+"%",background:mesaDone2===items.length?C.green:C.amber,borderRadius:3}}/></div>
                        <span style={{fontSize:13,fontWeight:700,color:mesaDone2===items.length?C.green:d1Pct>0?C.amber:C.muted,minWidth:40,textAlign:"right"}}>{d1Pct}%</span>
                        {d1Specials.length>0&&<span onClick={e=>{e.stopPropagation();setSpecialOpen(specialOpen==="d1t_"+sec?null:"d1t_"+sec);}} style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,cursor:"pointer",fontWeight:700}}>🚫 {d1Specials.length}</span>}
                        <span style={{fontSize:14,color:C.muted,transform:d1Open?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                      </div>
                    </div>
                  </div>
                  {specialOpen==="d1t_"+sec&&d1Specials.length>0&&<div style={{padding:"10px 16px",background:C.redBg+"80",borderBottom:`1px solid ${C.redBorder}`}} onClick={e=>e.stopPropagation()}>
                    {d1Specials.map((sp,si)=><div key={si} style={{fontSize:12,color:C.red,padding:"6px 0",borderBottom:si<d1Specials.length-1?`1px solid ${C.redBorder}40`:"none"}}>🚫 <b>{sp.pax} {T2("pax")}</b> — {sp.guest}: {sp.instruction}</div>)}
                  </div>}
                  {d1Open&&<div style={{padding:"10px 16px"}}>{items.map((dish,di)=>{
                    const cKey=`d1t_${dish.fEvId}_${dish.fIdx}`;const isExp2=expandedDishes.has(cKey);const d2=ds(dish.fEvId,dish.fIdx);
                    const allStepsTmp=getStepsForDish(dish.name);
                    const steps2=allStepsTmp.length>0?allStepsTmp:[{t:"Mesa",i:"Wash, cut, measure all ingredients as per recipe",tm:600},{t:"Primary prep",i:"Prepare base masala / paste / marinade",tm:480}];
                    const allDone2=!!d2.mesaDone;
                    return(<div key={di} style={{marginBottom:6}}>
                      <div onClick={()=>toggleDish(cKey)} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 8px",borderRadius:10,cursor:"pointer",background:allDone2?C.greenBg:C.surface,border:`1px solid ${allDone2?C.greenBorder:C.border}`}}>
                        <div style={{width:28,height:28,borderRadius:8,border:`2px solid ${allDone2?C.green:C.border}`,background:allDone2?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{allDone2&&<span style={{color:"#0A0A0F",fontSize:10,fontWeight:700}}>✓</span>}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:allDone2?C.green:C.text}}>{dish.name}</div>
                          <div style={{fontSize:12,color:C.gold}}>{dish.totalPax} {T2("pax")} · {steps2.length} {T2("mesa steps")}</div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{dish.fns.map(f=>`${f.g} (${f.p})`).join(" · ")}</div>
                        </div>
                        <span style={{fontSize:12,color:C.muted,transition:"transform .2s"}}>{isExp2?'▼':'▶'}</span>
                      </div>
                      {isExp2&&(<div style={{padding:"8px 8px 8px 44px"}}>
                        {/* ── Step 0: Store Sourcing ── */}
                        {(()=>{
                          const storeStarted=!!d2.storeStart;
                          const storeDone=!!d2.storeEnd;
                          const storeEl=storeStarted&&!storeDone?Math.floor((Date.now()-d2.storeStart)/1000):0;
                          const storeTimerDone=storeStarted&&storeEl>=1800;
                          const storeComplete=storeDone||storeTimerDone;
                          const storeRem=Math.max(0,1800-storeEl);
                          const storePct=storeStarted?Math.min(100,Math.round(storeEl/1800*100)):0;
                          return(
                            <div style={{padding:14,marginBottom:10,borderRadius:12,
                              border:'2px solid '+(storeComplete?'#1A4828':storeStarted?'#4A2810':'#2A2520'),
                              background:storeComplete?'#0A2010':storeStarted?'#28150840':'#1A1714'}}>
                              <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:10}}>
                                <div style={{width:36,height:36,borderRadius:10,
                                  background:storeComplete?'#3EAA68':storeStarted?'#D4914A':'#2A2520',
                                  display:'flex',alignItems:'center',justifyContent:'center',
                                  fontSize:16,fontWeight:700,color:'#0A0A0F',flexShrink:0}}>
                                  {storeComplete?'✓':'0'}
                                </div>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:14,fontWeight:700,
                                    color:storeComplete?'#3EAA68':storeStarted?'#D4914A':'#F5F0E8'}}>
                                    🏪 Collect Items from Store
                                  </div>
                                  <div style={{fontSize:11,color:'#7A6F62'}}>
                                    Source all ingredients before cooking · 30 min timer (stoppable)
                                  </div>
                                </div>
                              </div>
                              {storeStarted&&!storeComplete&&(
                                <div style={{marginBottom:10}}>
                                  <div style={{height:6,background:'#2A2520',borderRadius:3,overflow:'hidden'}}>
                                    <div style={{height:'100%',width:storePct+'%',background:'#D4914A',borderRadius:3,transition:'width 1s'}}/>
                                  </div>
                                  <div style={{fontSize:12,color:'#D4914A',fontWeight:700,marginTop:4}}>
                                    ⏱ {Math.floor(storeEl/60)}m {storeEl%60}s elapsed — {Math.floor(storeRem/60)}m {storeRem%60}s remaining
                                  </div>
                                </div>
                              )}
                              {!storeStarted&&!storeComplete&&(
                                <button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeStart:Date.now()})}
                                  style={{padding:'12px 20px',borderRadius:10,width:'100%',
                                    background:'linear-gradient(135deg,#D4B44A,#A8891E)',
                                    color:'#0A0908',border:'none',fontSize:13,fontWeight:700,
                                    cursor:'pointer',minHeight:44}}>
                                  🏃 Go Collect Items — Start 30 min Timer
                                </button>
                              )}
                              {storeStarted&&!storeComplete&&(
                                <button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeEnd:Date.now()})}
                                  style={{padding:'12px 20px',borderRadius:10,width:'100%',
                                    background:'linear-gradient(135deg,#3EAA68,#1A5030)',
                                    color:'#fff',border:'none',fontSize:13,fontWeight:700,
                                    cursor:'pointer',minHeight:44}}>
                                  ⏹ Done — Items Collected
                                </button>
                              )}
                              {storeComplete&&(
                                <div style={{fontSize:12,color:'#3EAA68',fontWeight:700}}>
                                  ✅ Store sourcing complete — ready to cook
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {steps2.map((step,si)=>{
                          var stepKey='step_'+si;
                          var stStarted=!!(d2.starts&&d2.starts[stepKey]);
                          var stManual=!!(d2.manual&&d2.manual[stepKey]);
                          var stElapsed=stStarted?Math.floor((Date.now()-(d2.starts[stepKey]||Date.now()))/1000):0;
                          var stTimerDone=stStarted&&step.tm&&stElapsed>=step.tm;
                          var stDone=stManual||stTimerDone;
                          var stRemain=step.tm?Math.max(0,step.tm-stElapsed):0;
                          var stPct=step.tm>0?Math.min(100,Math.round(stElapsed/step.tm*100)):0;
                          var storeDoneCheck=!!(d2.storeEnd)||(d2.storeStart&&Math.floor((Date.now()-(d2.storeStart||0))/1000)>=1800);
                          var prevKey='step_'+(si-1);
                          var prevDone=si===0?!!storeDoneCheck:(!!(d2.manual&&d2.manual[prevKey])||(d2.starts&&d2.starts[prevKey]&&steps2[si-1]&&steps2[si-1].tm&&Math.floor((Date.now()-(d2.starts[prevKey]||0))/1000)>=steps2[si-1].tm));
                          return(<div key={si} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:si<steps2.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start"}}>
                            <div style={{width:28,height:28,borderRadius:8,background:stDone?C.green:stStarted?C.amber:C.darkCard,border:`2px solid ${stDone?C.green:stStarted?C.amber:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:stDone||stStarted?"#0A0A0F":C.muted,flexShrink:0,marginTop:2}}>{stDone?"✓":si+1}</div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,fontWeight:700,color:stDone?C.green:stStarted?C.amber:C.text}}>{step.t}</div>
                              {(step.i||step.desc)&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{step.i||step.desc}</div>}
                              {step.ccp&&<div style={{fontSize:11,color:C.red,marginTop:2}}>🔴 CCP: {step.ccp}</div>}
                              {stStarted&&!stDone&&step.tm>0&&<div style={{marginTop:5}}>
                                <div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden"}}>
                                  <div style={{height:"100%",width:stPct+"%",background:C.amber,borderRadius:3,transition:"width 1s"}}/>
                                </div>
                                <div style={{fontSize:11,color:C.amber,fontWeight:700,marginTop:3}}>⏱ {Math.floor(stElapsed/60)}m {stElapsed%60}s / {Math.floor(step.tm/60)}m — {Math.floor(stRemain/60)}m {stRemain%60}s left</div>
                              </div>}
                              {stDone&&step.tm>0&&<div style={{fontSize:11,color:C.green,marginTop:3}}>✅ {Math.floor(step.tm/60)}m done</div>}
                              {!stStarted&&!stDone&&step.tm>0&&<div style={{fontSize:11,color:C.faint,marginTop:3}}>⏱ {Math.floor(step.tm/60)}m{step.tm%60>0?" "+step.tm%60+"s":""}</div>}
                            </div>
                            <div style={{flexShrink:0}}>
                              {!stStarted&&!stDone&&step.tm>0&&prevDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{starts:{...(d2.starts||{}),[stepKey]:Date.now()}});}} style={{padding:"8px 14px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>▶ {Math.floor(step.tm/60)}m</button>}
                              {!stStarted&&!stDone&&!step.tm&&prevDone&&<button onClick={e=>{e.stopPropagation();setDs(dish.fEvId,dish.fIdx,{manual:{...(d2.manual||{}),[stepKey]:true}});}} style={{padding:"8px 14px",borderRadius:10,background:C.gold,color:"#0A0908",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>✓</button>}
                              {!stStarted&&!stDone&&!prevDone&&<div style={{padding:"8px 12px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,fontSize:13,color:C.faint,minHeight:36,display:"flex",alignItems:"center"}}>🔒</div>}
                            </div>
                          </div>);
                        })}
                        {(function(){
                          var allDoneD1=steps2.length>0&&steps2.every(function(_,si){
                            var sk='step_'+si;
                            return !!(d2.manual&&d2.manual[sk])||(d2.starts&&d2.starts[sk]&&steps2[si]?.tm&&Math.floor((Date.now()-(d2.starts[sk]||0))/1000)>=steps2[si].tm);
                          });
                          if(!allDoneD1) return null;
                          var isTransD1=d2.status==='ready_for_transport';
                          var isCompD1=d2.status==='completed'||d2.completedAt;
                          var isDoneD1=isCompD1||isTransD1;
                          var soD1=dishSignoff&&dishSignoff.evId===dish.fEvId&&dishSignoff.idx===dish.fIdx?dishSignoff:null;
                          if(isDoneD1){
                            return(
                              <div style={{marginTop:12,padding:14,borderRadius:12,background:isTransD1?'rgba(107,24,24,0.4)':'rgba(43,138,80,0.3)',border:`1px solid ${isTransD1?'#8B2222':'#2B8A50'}`}}>
                                <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{isTransD1?'🚛 Queued for Transport':'✅ Completed'}</div>
                                <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:4}}>{d2.completedBy||''}{d2.completedAt?' · '+d2.completedAt:''}</div>
                                {d2.selfie&&<img src={d2.selfie} alt="" style={{width:52,height:52,objectFit:'cover',borderRadius:8,marginTop:8,border:'2px solid rgba(255,255,255,0.3)'}}/>}
                                {isTransD1&&<div style={{fontSize:10,color:'#90EE90',marginTop:4}}>Linked to Dispatch ✓</div>}
                              </div>
                            );
                          }
                          if(soD1){
                            var modeBgD1=soD1.mode==='ready_for_transport'?'#6B1818':'#2B8A50';
                            var chefNameD1=currentUser?currentUser.name:'Chef';
                            return(
                              <div style={{marginTop:12,padding:16,borderRadius:12,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)'}}>
                                <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:12}}>{soD1.mode==='ready_for_transport'?'🚛 Mark for Transport — Chef Sign-off':'✅ Mark Completed — Chef Sign-off'}</div>
                                <input type="file" accept="image/*" capture="user" id={'d1s-'+dish.fEvId+'-'+dish.fIdx} style={{display:'none'}} onChange={function(e){var f=e.target.files&&e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev2){setDishSignoff(function(p){return p?{...p,selfie:ev2.target.result}:p;});};r.readAsDataURL(f);}}/>
                                <canvas ref={capRef} style={{display:'none'}}/>
                                {camOn?(
                                  <div style={{marginBottom:10}}>
                                    <video ref={function(el){camRef.current=el;if(el&&camStreamRef.current){el.srcObject=camStreamRef.current;el.play().catch(function(){});}}} autoPlay playsInline muted style={{width:'100%',maxHeight:200,borderRadius:10,objectFit:'cover',background:'#000',display:'block'}}/>
                                    <div style={{display:'flex',gap:8,marginTop:8}}>
                                      <button onClick={capturePhoto} style={{flex:1,padding:'10px',borderRadius:8,background:'#2B8A50',border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>📸 Capture Photo</button>
                                      <button onClick={stopCam} style={{padding:'10px 14px',borderRadius:8,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.7)',fontSize:12,cursor:'pointer'}}>✕</button>
                                    </div>
                                  </div>
                                ):soD1.selfie?(
                                  <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:10}}>
                                    <img src={soD1.selfie} alt="" style={{width:64,height:64,objectFit:'cover',borderRadius:8,border:'2px solid #D4B44A'}}/>
                                    <button onClick={function(){setDishSignoff(function(p){return p?{...p,selfie:null}:p;});}} style={{padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.7)',fontSize:11,cursor:'pointer'}}>🔄 Retake</button>
                                  </div>
                                ):(
                                  <button onClick={function(){openCam('d1s-'+dish.fEvId+'-'+dish.fIdx);}} style={{width:'100%',padding:'12px',borderRadius:8,background:'rgba(255,255,255,0.08)',border:'1px dashed rgba(255,255,255,0.25)',color:'rgba(255,255,255,0.8)',fontSize:12,cursor:'pointer',marginBottom:6}}>📷 Open Camera</button>
                                )}
                                <div style={{fontSize:11,color:'#D4914A',marginBottom:12}}>📸 Selfie required to submit</div>
                                <div style={{display:'flex',gap:8}}>
                                  <button onClick={function(e){e.stopPropagation();stopCam();setDishSignoff(null);}} style={{flex:1,padding:'12px',borderRadius:8,background:'transparent',border:'1px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.7)',fontSize:13,cursor:'pointer'}}>← Back</button>
                                  <button
                                    disabled={!soD1.selfie}
                                    onClick={function(e){
                                      e.stopPropagation();
                                      if(!soD1.selfie)return;
                                      var now2=new Date();
                                      var nowTime=now2.getHours().toString().padStart(2,'0')+':'+now2.getMinutes().toString().padStart(2,'0');
                                      var updates={status:soD1.mode,completed:true,mesaDone:true,completedBy:chefNameD1,completedAt:nowTime,selfie:soD1.selfie};
                                      if(soD1.mode==='ready_for_transport'){
                                        updates.transportLinked=true;
                                        var tev=evList.find(function(e2){return e2.id===dish.fEvId;});
                                        if(setTransportQueue){setTransportQueue(function(prev){return[...(prev||[]),{id:localDateStr(now2)+'_'+dish.fEvId+'_'+dish.fIdx,dishName:dish.name||'Dish',event:tev?tev.guest:'Unknown',pax:tev?tev.pax:0,venue:tev?tev.venue:'',eventDate:tev?tev.date:localDateStr(now2),preparedBy:chefNameD1,markedAt:nowTime,status:'Pending Pickup'}];});}
                                      }
                                      setDs(dish.fEvId,dish.fIdx,updates);
                                      setDishSignoff(null);
                                    }}
                                    style={{flex:2,padding:'12px',borderRadius:8,background:!soD1.selfie?'rgba(43,138,80,0.3)':modeBgD1,border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:!soD1.selfie?'not-allowed':'pointer'}}>
                                    Confirm &amp; Submit ✓
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return(
                            <div style={{margin:'20px 0 8px',display:'flex',flexDirection:'column',gap:10}}>
                              <div style={{fontSize:11,color:'#90EE90',fontWeight:600,textAlign:'center',marginBottom:4}}>✅ All {steps2.length} steps complete — sign off to finish</div>
                              <button onClick={function(e){e.stopPropagation();setDishSignoff({evId:dish.fEvId,idx:dish.fIdx,mode:'completed',chefName:currentUser?currentUser.name:'',selfie:null});}} style={{width:'100%',padding:'16px',borderRadius:12,background:'#2B8A50',border:'none',color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer',letterSpacing:0.3}}>✅ Mark Completed</button>
                              <button onClick={function(e){e.stopPropagation();setDishSignoff({evId:dish.fEvId,idx:dish.fIdx,mode:'ready_for_transport',chefName:currentUser?currentUser.name:'',selfie:null});}} style={{width:'100%',padding:'16px',borderRadius:12,background:'#6B1818',border:'none',color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer',letterSpacing:0.3}}>🚛 Mark for Transport</button>
                            </div>
                          );
                        })()}
                      </div>)}
                    </div>);
                  })}</div>}
                </Card>);
              })}
            </div>
          );
        }

        // Event today → show full cooking tasks
        const evs=todayEvs;
        const byDish={};
        evs.forEach(ev=>{
          const sp=ev.special||"";
          const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
          menuArr(ev).forEach((name,idx)=>{
            if(guessSectionForDish(name)==="Beverages") return;
            if(sectionFilter && guessSectionForDish(name) !== sectionFilter) return;
            if(!byDish[name])byDish[name]={sec:guessSectionForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
            byDish[name].totalPax+=ev.pax||0;
            byDish[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
            if(isSpecial) byDish[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
          });
        });
        const bySec={};Object.entries(byDish).forEach(([n,info])=>{if(!bySec[info.sec])bySec[info.sec]=[];bySec[info.sec].push({name:n,...info});});
        const secKeys=Object.keys(bySec).sort();const totalU=Object.keys(byDish).length;
        const totalReady=Object.values(byDish).filter(d=>ds(d.fEvId,d.fIdx).ready).length;
        const allDishesReady=totalReady===totalU&&totalU>0;
        return(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>🔥 {T2("Today's Tasks")} — {TODAY_LABEL}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:6}}>
              {evs.length>0?`${T2("Event day cooking for")} ${evs.map(e=>e.guest).join(" · ")} (${evs.reduce((s,e)=>s+(+e.pax||0),0)} ${T2("pax")})`:T2("No events today — focus on D-1 prep below")}
            </div>
            {(()=>{const d1Count=Object.values(byDish).filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;const d1Total=totalU;return d1Count>0?(
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:18}}>✅</span>
                <div><div style={{fontSize:12,fontWeight:700,color:C.green}}>{d1Count}/{d1Total} {T2("dishes had D-1 Mesa prep done yesterday")}</div>
                <div style={{fontSize:11,color:C.green}}>{T2("Those steps are marked D-1 ✅ below — team can skip to cooking")}</div></div>
              </div>
            ):(
              <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:18}}>⚠</span>
                <div><div style={{fontSize:12,fontWeight:700,color:C.amber}}>{T2("No D-1 prep was done yesterday")}</div>
                <div style={{fontSize:11,color:C.amber}}>{T2("All steps including Mesa must be completed today")}</div></div>
              </div>
            );})()}
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.gold}}>{totalReady}/{totalU}</div><div style={{fontSize:11,color:C.muted}}>{T2("dishes ready")}</div></div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.text}}>{evs.length}</div><div style={{fontSize:11,color:C.muted}}>{T2("functions")}</div></div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px"}}><div style={{fontSize:18,fontWeight:700,color:C.text}}>{evs.reduce((s,e)=>s+(e.pax||0),0)}</div><div style={{fontSize:11,color:C.muted}}>{T2("total pax")}</div></div>
            </div>
            {secKeys.length===0&&(
              <Card style={{padding:"32px 24px",textAlign:"center",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:36,marginBottom:12}}>📋</div>
                <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:6}}>{T2("No events today")}</div>
                <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{T2("Today is a D-1 prep day.")}<br/>{T2("Switch to the D-1 tab to see all advance prep tasks for tomorrow's function.")}</div>
                <button onClick={()=>setTab("d1")} style={{marginTop:16,padding:"12px 24px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>
                  📋 {T2("Go to D-1 Prep")} →
                </button>
              </Card>
            )}
            {secKeys.map(sec=>{const items=bySec[sec];const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
              const secReady=items.filter(d=>ds(d.fEvId,d.fIdx).ready).length;
              const secPct=Math.round(secReady/items.length*100);
              const secOpen=isSecOpen("today_"+sec);
              const secSpecials=[...new Map(items.flatMap(d=>d.specials||[]).map(sp=>[sp.guest+"|"+sp.instruction,sp])).values()];
              return(<Card key={sec} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
                <div onClick={()=>toggleSec("today_"+sec)} style={{padding:"14px 16px",background:m2.color+"10",borderBottom:secOpen?`1px solid ${C.border}`:"none",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:14,fontWeight:700,color:m2.color}}>{m2.icon} {T2(sec)}</span>
                      <span style={{fontSize:11,color:C.muted}}>{items.length} {T2("dishes")}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:48,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:secPct+"%",background:secReady===items.length?C.green:C.amber,borderRadius:3}}/></div>
                      <span style={{fontSize:13,fontWeight:700,color:secReady===items.length?C.green:secPct>0?C.amber:C.muted,minWidth:40,textAlign:"right"}}>{secPct}%</span>
                      {secSpecials.length>0&&<span onClick={(e)=>{e.stopPropagation();setSpecialOpen(specialOpen==="today_"+sec?null:"today_"+sec);}} style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,cursor:"pointer",fontWeight:700}}>🚫 {secSpecials.length}</span>}
                      <span style={{fontSize:14,color:C.muted,transform:secOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                    </div>
                  </div>
                </div>
                {specialOpen==="today_"+sec&&secSpecials.length>0&&<div style={{padding:"10px 16px",background:C.redBg+"80",borderBottom:`1px solid ${C.redBorder}`}} onClick={e=>e.stopPropagation()}>
                  {secSpecials.map((sp,si)=><div key={si} style={{fontSize:12,color:C.red,padding:"6px 0",borderBottom:si<secSpecials.length-1?`1px solid ${C.redBorder}40`:"none"}}>🚫 <b>{sp.pax} {T2("pax")}</b> — {sp.guest}: {sp.instruction}</div>)}
                </div>}
                {secOpen&&<div style={{padding:"8px 12px"}}>{items.map((dish,di)=>{
                  const d3=ds(dish.fEvId,dish.fIdx);const steps3=getFullSteps(dish.name);
                  const runSi=steps3.findIndex((_,si)=>d3.starts?.[si]&&!stepDone(d3,si));
                  const doneSi=steps3.filter((_,si)=>stepDone(d3,si)).length;const pctA=safePct(doneSi,steps3.length);
                  const isExp3=expandedDishes.has(dk(dish.fEvId,dish.fIdx));
                  const imgUrl=getDishImageUrl(dish.name);
                  return(<div key={di} style={{marginBottom:8,border:`1.5px solid ${d3.ready?C.greenBorder:runSi>=0?C.amberBorder:C.border}`,borderRadius:14,overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,.4)"}}>
                    <div onClick={()=>toggleDish(dk(dish.fEvId,dish.fIdx))} style={{cursor:"pointer",position:"relative",minHeight:72}}>
                      {/* Dish image background */}
                      <div style={{position:"absolute",inset:0,backgroundImage:`url(${imgUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.35) saturate(.8)"}}/>
                      <div style={{position:"absolute",inset:0,background:`linear-gradient(90deg, rgba(10,9,8,.92) 45%, rgba(10,9,8,.4) 100%)`}}/>
                      {/* Content over image */}
                      <div style={{position:"relative",padding:"12px 16px",display:"flex",gap:12,alignItems:"center"}}>
                        <div style={{width:36,height:36,borderRadius:10,background:d3.ready?C.green:runSi>=0?C.amber:C.darkCard+"CC",border:`2px solid ${d3.ready?C.green:runSi>=0?C.amber:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:d3.ready||runSi>=0?"#0A0A0F":C.muted,flexShrink:0,backdropFilter:"blur(4px)"}}>{d3.ready?"✓":runSi>=0?"⏱":di+1}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700,color:d3.ready?C.green:C.cream,letterSpacing:.2,textShadow:"0 1px 4px rgba(0,0,0,.5)"}}>{dish.name}</div>
                          <div style={{fontSize:11,color:C.gold,marginTop:2,textShadow:"0 1px 3px rgba(0,0,0,.4)"}}>{dish.totalPax} {T2("pax")} · {dish.fns.map(f=>f.g+" ("+f.p+")").join(" · ")}</div>
                          <div style={{fontSize:11,color:d3.readyAt?C.green:C.muted,marginTop:1}}>{doneSi}/{steps3.length} {T2("steps")} {d3.readyAt?"· ✅ "+d3.readyAt:""}</div>
                          {!d3.ready&&<div style={{height:3,background:"rgba(255,255,255,.1)",borderRadius:2,marginTop:5,overflow:"hidden"}}><div style={{height:"100%",width:pctA+"%",background:runSi>=0?C.amber:C.muted,borderRadius:2,transition:"width .5s"}}/></div>}
                        </div>
                        {runSi>=0&&(()=>{const el4=elapsed(d3,runSi);const tm4=d3.stepTm?.[runSi]||0;return <div style={{fontSize:16,fontWeight:700,color:C.amber,flexShrink:0,textShadow:"0 1px 4px rgba(0,0,0,.5)"}}>{fmtT(Math.max(0,tm4-el4))}</div>;})()}
                        <span style={{fontSize:12,color:"rgba(255,255,255,.5)",flexShrink:0}}>{isExp3?'▼':'▶'}</span>
                      </div>
                    </div>
                    {isExp3&&(<div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`}}>
                      {/* D-1 Mesa Status */}
                      {(()=>{
                        const mesaAllSteps=getStepsForDish(dish.name);
                        const mesaDone2=!!d3.mesaDone;
                        const mesaCount=mesaAllSteps.length||1;
                        return (
                          <div style={{background:mesaDone2?C.greenBg:C.amberBg,border:`1px solid ${mesaDone2?C.greenBorder:C.amberBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:10}}>
                            <div style={{fontSize:12,fontWeight:700,color:mesaDone2?C.green:C.amber}}>{mesaDone2?"✅":"⏳"} D-1 Mesa: {mesaDone2?T2("Completed"):T2("Pending")}</div>
                            <div style={{fontSize:11,color:C.muted,marginTop:3}}>{mesaDone2?T2("All advance prep was done yesterday. Continue with cooking steps below."):T2("Mesa prep not done on D-1. Start from Mesa steps first.")}</div>
                            {mesaDone2&&mesaAllSteps.length>0&&<div style={{fontSize:11,color:C.green,marginTop:4}}>{mesaAllSteps.filter(s=>/mesa|prep|marin|grind|dough|cut/i.test(s.t||"")).map(s=>s.t).join(" → ")} ✓</div>}
                          </div>
                        );
                      })()}

                      {/* ── Step 0: Store Sourcing (always first, gates all SOP steps) ── */}
                      {(()=>{
                        const storeStarted=!!d3.storeStart;
                        const storeDone=!!d3.storeEnd;
                        const storeEl=storeStarted&&!storeDone?Math.floor((Date.now()-d3.storeStart)/1000):0;
                        const storeRem=Math.max(0,1800-storeEl);
                        const storePct=storeStarted?Math.min(100,Math.round(storeEl/1800*100)):0;
                        const evScale=appliedScales[dish.fEvId]||appliedScales["manual"];
                        const evPct=evScale?.percent||100;
                        const evObj=evList.find(e=>e.id===dish.fEvId);
                        const pax=evObj?+evObj.pax:0;
                        const ing=RECIPE_INGREDIENTS[dish.name];
                        return(
                          <div style={{padding:"12px",marginBottom:10,borderRadius:12,
                            border:`1.5px solid ${storeDone?C.greenBorder:storeStarted?C.amberBorder:C.border}`,
                            background:storeDone?C.greenBg:storeStarted?C.amberBg+"40":C.darkCard}}>
                            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
                              <div style={{width:32,height:32,borderRadius:8,
                                background:storeDone?C.green:storeStarted?C.amber:C.border,
                                display:"flex",alignItems:"center",justifyContent:"center",
                                fontSize:14,fontWeight:700,color:"#0A0A0F",flexShrink:0}}>
                                {storeDone?"✓":"0"}
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:700,color:storeDone?C.green:storeStarted?C.amber:C.text}}>🏪 Collect Items from Store</div>
                                <div style={{fontSize:11,color:C.muted}}>Sourcing ingredients before cooking · 30 min timer</div>
                              </div>
                            </div>
                            {/* Ingredient list */}
                            {ing&&pax>0&&<div style={{background:C.bg,borderRadius:8,padding:"8px 12px",marginBottom:8,border:`1px solid ${C.border}`}}>
                              <div style={{fontSize:11,fontWeight:700,color:C.gold,marginBottom:5}}>🧺 Items to collect — {pax} pax{evPct!==100?` @ ${evPct}%`:""}</div>
                              <div style={{display:"flex",flexWrap:"wrap",gap:"3px 10px"}}>
                                {ing.filter(i=>i.q>0).map((i,ii)=>{
                                  const raw=i.q*pax*(evPct/100);
                                  const qty=i.u==="g"?raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g":i.u==="ml"?raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml":i.u==="pcs"?Math.ceil(raw)+" pcs":Math.round(raw)+" "+i.u;
                                  return <span key={ii} style={{fontSize:11,color:C.text}}>{i.n}: <b style={{color:C.gold}}>{qty}</b></span>;
                                })}
                              </div>
                            </div>}
                            {/* Running timer */}
                            {storeStarted&&!storeDone&&<div style={{marginBottom:8}}>
                              <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:4}}>
                                <div style={{height:"100%",width:storePct+"%",background:storeEl>1500?C.red:C.amber,borderRadius:3,transition:"width 1s"}}/>
                              </div>
                              <div style={{fontSize:12,color:C.amber,fontWeight:700}}>
                                ⏱ {Math.floor(storeEl/60)}m {storeEl%60}s elapsed — {Math.floor(storeRem/60)}m {storeRem%60}s left
                              </div>
                            </div>}
                            {/* Buttons */}
                            {!storeStarted&&!storeDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeStart:Date.now()})}
                              style={{padding:"10px 20px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,
                                color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44,width:"100%"}}>
                              🏃 Go Collect Items — Start 30 min Timer
                            </button>}
                            {storeStarted&&!storeDone&&<button onClick={()=>setDs(dish.fEvId,dish.fIdx,{storeEnd:Date.now()})}
                              style={{padding:"10px 20px",borderRadius:10,background:`linear-gradient(135deg,${C.green},#2A7A4A)`,
                                color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44,width:"100%",marginTop:6}}>
                              ⏹ Done — Items Collected
                            </button>}
                            {storeDone&&<div style={{fontSize:12,color:C.green,fontWeight:700}}>✅ Items collected · {new Date(d3.storeEnd).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>}
                          </div>
                        );
                      })()}

                      {/* ── SOP Steps — split into Pre-Preparation (D-1) and Cooking ── */}
                      {(function(){
                        var nonStoreSI=steps3.map(function(s,i){return {step:s,origIdx:i};}).filter(function(x){return !x.step.store;});
                        var prePrep=nonStoreSI.filter(function(x){return !!x.step.d1;});
                        var cooking=nonStoreSI.filter(function(x){return !x.step.d1;});
                        var steps=nonStoreSI.map(function(x){return x.step;});
                        var allStepsDone=nonStoreSI.length>0&&nonStoreSI.every(function(item){
                          var oi=item.origIdx;
                          var isManual=d3.manual&&(d3.manual[oi]||d3.manual['step_'+oi]||d3.manual[String(oi)]);
                          var startVal=d3.starts&&(d3.starts[oi]||d3.starts['step_'+oi]||d3.starts[String(oi)]);
                          var tm=item.step.tm;
                          return isManual||(startVal&&tm&&Math.floor((Date.now()-startVal)/1000)>=tm);
                        });
                        var isCompleted=d3.completed||d3.ready;
                        var isDispatched=d3.readyForDispatch;
                        function renderStep(item,globalIdx,groupIdx,groupLen){
                          var step=item.step; var realSi=item.origIdx;
                          var running3=!!(d3.starts?.[realSi])&&!stepDone(d3,realSi);
                          var done3=stepDone(d3,realSi);
                          var d1Done=isD1Step(d3,realSi);
                          var el5=running3?elapsed(d3,realSi):0;
                          var tm5=step.tm||0; var rem3=Math.max(0,tm5-el5);
                          var pct4=tm5>0?Math.min(100,Math.round(el5/tm5*100)):(done3?100:0);
                          var prevOk=globalIdx===0?!!d3.storeEnd:stepDone(d3,nonStoreSI[globalIdx-1].origIdx);
                          return (
                            <div key={realSi} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:groupIdx<groupLen-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start",opacity:d1Done?.6:1}}>
                              <div style={{width:32,height:32,borderRadius:8,background:done3?C.green:running3?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:done3||running3?"#0A0A0F":C.muted,flexShrink:0}}>{done3?"✓":globalIdx+1}</div>
                              <div style={{flex:1}}>
                                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                                  <span style={{fontSize:12,fontWeight:700,color:done3?C.green:C.text}}>{step.t}{step.live?" 🔴":""}</span>
                                  <span style={{fontSize:9,color:step.d1?C.blue:C.amber,fontWeight:600}}>{step.d1?"PRE-PREP":"COOKING"}</span>
                                  {d1Done&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green}}>D-1 ✅</span>}
                                </div>
                                {step.i&&<div style={{fontSize:12,color:C.muted,marginTop:2,lineHeight:1.4}}>{step.i}</div>}
                                {step.ccp&&<div style={{fontSize:11,color:C.red,background:C.redBg,padding:"6px 10px",borderRadius:4,display:"inline-block",marginTop:3}}>🔴 CCP: {step.ccp}</div>}
                                <div style={{marginTop:6}}>
                                  {running3&&tm5>0&&<div><div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:3}}><div style={{height:"100%",width:pct4+"%",background:C.amber,borderRadius:3,transition:"width 1s"}}/></div><div style={{fontSize:11,color:C.amber,fontWeight:700}}>⏱ {Math.floor(el5/60)}m {el5%60}s / {Math.floor(tm5/60)}m — {Math.floor(rem3/60)}m {rem3%60}s left</div></div>}
                                  {done3&&tm5>0&&<div style={{fontSize:11,color:C.green}}>✅ {Math.floor(tm5/60)}m — done</div>}
                                  {!running3&&!done3&&tm5>0&&<div style={{fontSize:11,color:C.faint}}>⏱ {Math.floor(tm5/60)}m{tm5%60>0?" "+tm5%60+"s":""}</div>}
                                </div>
                              </div>
                              <div style={{flexShrink:0}}>
                                {!running3&&!done3&&tm5>0&&prevOk&&<button onClick={e=>{e.stopPropagation();startStep(dish.fEvId,dish.fIdx,realSi,tm5);}} style={{padding:"8px 14px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:38}}>▶ {Math.floor(tm5/60)}m</button>}
                                {running3&&<button onClick={e=>{e.stopPropagation();markManual(dish.fEvId,dish.fIdx,realSi);}} style={{padding:"8px 14px",borderRadius:10,background:`linear-gradient(135deg,${C.green},#2A7A4A)`,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:38}}>⏹ Done</button>}
                                {!running3&&!done3&&!tm5&&prevOk&&!step.live&&<button onClick={e=>{e.stopPropagation();markManual(dish.fEvId,dish.fIdx,realSi);}} style={{padding:"8px 14px",borderRadius:10,background:C.gold,color:"#0A0908",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:38}}>✓</button>}
                                {!running3&&!done3&&!prevOk&&<div style={{padding:"8px 12px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,fontSize:13,color:C.faint,minHeight:38,display:"flex",alignItems:"center"}}>🔒</div>}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div>
                            {nonStoreSI.length>0&&<div style={{fontSize:12,fontWeight:700,color:'#D4914A',marginTop:12,marginBottom:8,textTransform:'uppercase',letterSpacing:1,padding:'6px 12px',background:'#28150820',borderRadius:8,border:'1px solid #4A281040'}}>🔶 Pre-Preparation (D-1) — {prePrep.length} steps</div>}
                            {prePrep.map(function(item,i){return renderStep(item,i,i,prePrep.length);})}
                            {nonStoreSI.length>0&&<div style={{fontSize:12,fontWeight:700,color:'#D04040',marginTop:16,marginBottom:8,textTransform:'uppercase',letterSpacing:1,padding:'6px 12px',background:'#20081020',borderRadius:8,border:'1px solid #40182840'}}>🔴 Cooking (Event Day) — {cooking.length} steps</div>}
                            {cooking.map(function(item,i){return renderStep(item,prePrep.length+i,i,cooking.length);})}

                            {/* ── COMPLETION SECTION ── */}
                            {(function(){
                              var d2c=ds(dish.fEvId,dish.fIdx);
                              var isTransport=d2c.status==='ready_for_transport';
                              var isComp=d2c.status==='completed'||d2c.completed||d2c.ready;
                              var isDone=isComp||isTransport;
                              // Always show badge if already confirmed (don't gate behind allStepsDone)
                              if(isDone){
                                return (
                                  <div style={{marginTop:16,padding:14,background:isTransport?'#150A10':'#0A1520',borderRadius:14,border:`2px solid ${isTransport?C.wine:'#1A4828'}`,display:'flex',gap:12,alignItems:'center'}}>
                                    {d2c.selfie&&<img src={d2c.selfie} style={{width:50,height:50,borderRadius:12,objectFit:'cover',border:`2px solid ${isTransport?C.wine:C.green}`}}/>}
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:14,fontWeight:700,color:isTransport?C.wine:C.green}}>{isTransport?'🚛 Marked for Transport':'✅ Completed'}</div>
                                      <div style={{fontSize:12,color:C.muted,marginTop:2}}>By {d2c.completedBy||'Chef'} at {d2c.completedAt||''}</div>
                                      {isTransport&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>Pending pickup by transport team</div>}
                                    </div>
                                  </div>
                                );
                              }
                              var allStepsDone=(nonStoreSI.length===0)||(nonStoreSI.every(function(item){
                                var oi=item.origIdx;
                                return stepDone(d2c,oi);
                              }));
                              if(!allStepsDone) return null;
                              var so=dishSignoff&&dishSignoff.evId===dish.fEvId&&dishSignoff.idx===dish.fIdx?dishSignoff:null;
                              // Sign-off panel
                              if(so){
                                var modeBg=so.mode==='ready_for_transport'?C.wine:'#2B8A50';
                                var chefNameED=currentUser?currentUser.name:'Chef';
                                return (
                                  <div style={{marginTop:16,padding:16,background:'#0A0F18',borderRadius:14,border:`2px solid ${modeBg}40`}}>
                                    <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>👨‍🍳 Chef Sign-off Required</div>
                                    <div style={{marginBottom:14}}>
                                      <input type="file" accept="image/*" capture="user" id={'so-selfie-'+dish.fEvId+'-'+dish.fIdx} style={{display:'none'}} onChange={function(e){var f=e.target.files&&e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev2){setDishSignoff(function(p){return p?{...p,selfie:ev2.target.result}:p;});};r.readAsDataURL(f);}}/>
                                      <canvas ref={capRef} style={{display:'none'}}/>
                                      {camOn?(
                                        <div>
                                          <video ref={function(el){camRef.current=el;if(el&&camStreamRef.current){el.srcObject=camStreamRef.current;el.play().catch(function(){});}}} autoPlay playsInline muted style={{width:'100%',maxHeight:200,borderRadius:10,objectFit:'cover',background:'#000',display:'block'}}/>
                                          <div style={{display:'flex',gap:8,marginTop:8}}>
                                            <button onClick={capturePhoto} style={{flex:1,padding:'10px',borderRadius:8,background:'#2B8A50',border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>📸 Capture Photo</button>
                                            <button onClick={stopCam} style={{padding:'10px 14px',borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:'pointer'}}>✕</button>
                                          </div>
                                        </div>
                                      ):so.selfie?(
                                        <div style={{display:'flex',gap:10,alignItems:'center'}}>
                                          <img src={so.selfie} style={{width:60,height:60,borderRadius:10,objectFit:'cover',border:`2px solid ${C.gold}`}}/>
                                          <button onClick={function(){setDishSignoff(function(p){return p?{...p,selfie:null}:p;});}} style={{padding:'6px 12px',borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:'pointer'}}>🔄 Retake</button>
                                        </div>
                                      ):(
                                        <button onClick={function(){openCam('so-selfie-'+dish.fEvId+'-'+dish.fIdx);}} style={{padding:'10px 20px',borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.gold,fontSize:12,fontWeight:600,cursor:'pointer'}}>📷 Open Camera</button>
                                      )}
                                      <div style={{fontSize:11,color:C.amber,marginTop:6}}>📸 Selfie required to submit</div>
                                    </div>
                                    <div style={{display:'flex',gap:10}}>
                                      <button
                                        disabled={!so.selfie}
                                        onClick={function(){
                                          if(!so.selfie)return;
                                          var now2=new Date();
                                          var nowTime=now2.getHours().toString().padStart(2,'0')+':'+now2.getMinutes().toString().padStart(2,'0');
                                          var updates={status:so.mode,completed:true,ready:true,completedBy:chefNameED,completedAt:nowTime,selfie:so.selfie};
                                          if(so.mode==='ready_for_transport'){
                                            updates.transportLinked=true;
                                            var tev=evList.find(function(e){return e.id===dish.fEvId;});
                                            if(setTransportQueue){
                                              setTransportQueue(function(prev){
                                                return [...(prev||[]),{
                                                  id:localDateStr(now2)+'_'+dish.fEvId+'_'+dish.fIdx,
                                                  dishName:dish.name||'Dish',
                                                  event:tev?tev.guest:'Unknown',
                                                  pax:tev?tev.pax:0,
                                                  venue:tev?tev.venue:'',
                                                  eventDate:tev?tev.date:localDateStr(now2),
                                                  preparedBy:chefNameED,
                                                  markedAt:nowTime,
                                                  status:'Pending Pickup',
                                                }];
                                              });
                                            }
                                          }
                                          setDs(dish.fEvId,dish.fIdx,updates);
                                          setDishSignoff(null);
                                        }}
                                        style={{flex:1,padding:14,borderRadius:12,background:!so.selfie?'#1A1510':modeBg,color:!so.selfie?C.muted:'#fff',border:`1px solid ${!so.selfie?C.border:modeBg}`,fontSize:13,fontWeight:700,cursor:!so.selfie?'not-allowed':'pointer',minHeight:48}}>
                                        Confirm &amp; Submit
                                      </button>
                                      <button onClick={function(){stopCam();setDishSignoff(null);}} style={{padding:14,borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,fontWeight:600,cursor:'pointer',minHeight:48}}>Cancel</button>
                                    </div>
                                  </div>
                                );
                              }
                              // Two action buttons
                              return (
                                <div style={{marginTop:16,padding:16,background:'#0A1018',borderRadius:14,border:`1px solid ${C.border}`}}>
                                  <div style={{fontSize:13,fontWeight:700,color:C.green,textAlign:'center',marginBottom:12}}>✅ All {steps.length} steps complete</div>
                                  <div style={{display:'flex',gap:10}}>
                                    <button onClick={function(){setDishSignoff({evId:dish.fEvId,idx:dish.fIdx,mode:'completed',chefName:currentUser?currentUser.name:'',selfie:null});}} style={{flex:1,padding:14,borderRadius:12,background:'#2B8A50',color:'#fff',border:'none',fontSize:13,fontWeight:700,cursor:'pointer',minHeight:50}}>✅ Mark Completed</button>
                                    <button onClick={function(){setDishSignoff({evId:dish.fEvId,idx:dish.fIdx,mode:'ready_for_transport',chefName:currentUser?currentUser.name:'',selfie:null});}} style={{flex:1,padding:14,borderRadius:12,background:C.wine,color:'#fff',border:'none',fontSize:13,fontWeight:700,cursor:'pointer',minHeight:50}}>🚛 Mark for Transport</button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>)}
                  </div>);})}</div>}
              </Card>);
            })}
            {/* Dispatch per event */}
            {allDishesReady&&(<div style={{marginTop:12}}>
              <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:8}}>🚛 {T2("Dispatch by function")}</div>
              {evs.map(ev=>{const dispatched=!!(kt[ev.id]?.__dispatch_ready);return(
                <div key={ev.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:dispatched?C.greenBg:C.surface,border:`1px solid ${dispatched?C.greenBorder:C.border}`,borderRadius:10,marginBottom:6}}>
                  <div><div style={{fontSize:13,fontWeight:600,color:C.text}}>{ev.guest}</div><div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")}</div></div>
                  {dispatched?<span style={{fontSize:11,color:C.green,fontWeight:700}}>🚛 {kt[ev.id]?.__dispatch_time}</span>:<button onClick={()=>markDispatch(ev.id)} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>🚛 {T2("Dispatch")}</button>}
                </div>);
              })}
            </div>)}
          </div>
        );
      })()}
      {tab==="d1"&&(()=>{
        // D-1 logic: if today has an event, prep for DAY_AFTER. If no event today, prep for TOMORROW.
        // Section 1: Continuation of today's D-1 = tomorrowEvs (event day cooking)
        // Section 2: New D-1 prep = dayAfterEvs (advance prep for day-after)
        const continuationEvs = hasTodayEvs ? todayEvs : tomorrowEvs;
        const newD1Evs = hasTodayEvs
          ? evList.filter(e=>e.date===DAY_AFTER)
          : evList.filter(e=>e.date===DAY_AFTER);
        const d1ForLabel = hasTodayEvs ? dayAfterLabel : dayAfterLabel;
        const contLabel = hasTodayEvs ? todayLabel2 : tomorrowLabel;
        const newD1Label = dayAfterLabel;

        // Build dishes for Section 1 (continuation - final cooking)
        const byDishCont={};
        continuationEvs.forEach(ev=>{
          const sp=ev.special||"";
          const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
          menuArr(ev).forEach((name,idx)=>{
            if(guessSectionForDish(name)==="Beverages") return;
            if(sectionFilter && guessSectionForDish(name) !== sectionFilter) return;
            if(!byDishCont[name])byDishCont[name]={sec:guessSectionForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
            byDishCont[name].totalPax+=ev.pax||0;
            byDishCont[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
            if(isSpecial)byDishCont[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
          });
        });

        // Build dishes for Section 2 (new D-1 prep)
        const byDishNew={};
        newD1Evs.forEach(ev=>{
          const sp=ev.special||"";
          const isSpecial=/no onion|no garlic|jain|no egg|no root|nut.free|halal|kosher|lactose|gluten/i.test(sp);
          menuArr(ev).forEach((name,idx)=>{
            if(guessSectionForDish(name)==="Beverages") return;
            if(sectionFilter && guessSectionForDish(name) !== sectionFilter) return;
            if(!byDishNew[name])byDishNew[name]={sec:guessSectionForDish(name),totalPax:0,fns:[],fEvId:ev.id,fIdx:idx,specials:[]};
            byDishNew[name].totalPax+=ev.pax||0;
            byDishNew[name].fns.push({evId:ev.id,g:ev.guest,v:ev.venue,p:ev.pax,idx,special:sp,isSpecial});
            if(isSpecial) byDishNew[name].specials.push({guest:ev.guest,pax:ev.pax,instruction:sp});
          });
        });
        const bySecCont={};Object.entries(byDishCont).forEach(([n,info])=>{if(!bySecCont[info.sec])bySecCont[info.sec]=[];bySecCont[info.sec].push({name:n,...info});});
        const bySecNew={};Object.entries(byDishNew).forEach(([n,info])=>{if(!bySecNew[info.sec])bySecNew[info.sec]=[];bySecNew[info.sec].push({name:n,...info});});
        const secKeysCont=Object.keys(bySecCont).sort();
        const secKeysNew=Object.keys(bySecNew).sort();
        // ── Merge dishes from both sources by section ──
        const allSecs = [...new Set([
          ...Object.keys(bySecCont),
          ...Object.keys(bySecNew)
        ])].sort();

        const totalContDone = Object.values(byDishCont).filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;
        const totalNewDone  = Object.values(byDishNew).filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;
        const totalCont = Object.keys(byDishCont).length;
        const totalNew  = Object.keys(byDishNew).length;

        return(
          <div>
            {/* ── Header strip ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>🔥 {T2("Continue")} {todayLabel2} D-1</div>
                <div style={{fontSize:20,fontWeight:800,color:C.amber,lineHeight:1}}>{contPax} <span style={{fontSize:11,fontWeight:400}}>pax</span></div>
                <div style={{fontSize:11,color:C.muted,marginTop:3}}>{totalContDone}/{totalCont} {T2("dishes done")}</div>
                <div style={{height:4,background:C.border,borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:totalCont>0?Math.round(totalContDone/totalCont*100)+"%":"0%",background:C.amber,borderRadius:2}}/></div>
              </div>
              <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.gold,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>📋 D-1 {T2("for")} {dayAfterLabel}</div>
                <div style={{fontSize:20,fontWeight:800,color:C.gold,lineHeight:1}}>{newD1Pax||"—"} <span style={{fontSize:11,fontWeight:400}}>pax</span></div>
                <div style={{fontSize:11,color:C.muted,marginTop:3}}>{totalNewDone}/{totalNew} {T2("dishes done")}</div>
                <div style={{height:4,background:C.border,borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:totalNew>0?Math.round(totalNewDone/totalNew*100)+"%":"0%",background:C.gold,borderRadius:2}}/></div>
              </div>
            </div>

            {/* ── 3-column header: Cont D-1 | D-1 New | Collective ── */}
            {(()=>{
              const totalCollectivePax=(contPax||0)+(newD1Pax||0);
              const totalCollDone=totalContDone+totalNewDone;
              const totalColl=totalCont+totalNew;
              return(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
                  {[
                    {label:`🔥 ${T2("Continue")} ${todayLabel2} D-1`,pax:contPax,done:totalContDone,total:totalCont,c:C.amber,bg:C.amberBg,bdr:C.amberBorder,view:"cont"},
                    {label:`📋 D-1 ${T2("for")} ${dayAfterLabel}`,pax:newD1Pax,done:totalNewDone,total:totalNew,c:C.gold,bg:C.goldBg,bdr:C.goldBorder,view:"new"},
                    {label:`📦 ${T2("Collective")}`,pax:totalCollectivePax,done:totalCollDone,total:totalColl,c:C.blue,bg:C.blueBg,bdr:C.blueBorder,view:"all"},
                  ].map(h=>{
                    const pct=h.total>0?Math.round(h.done/h.total*100):0;
                    const isSel=d1View===h.view;
                    return(
                      <div key={h.view} onClick={()=>setD1View(h.view)}
                        style={{background:isSel?h.bg:"transparent",border:`2px solid ${isSel?h.c:C.border}`,borderRadius:12,padding:"12px 10px",cursor:"pointer",transition:"all .2s"}}>
                        <div style={{fontSize:9,fontWeight:700,color:isSel?h.c:C.faint,textTransform:"uppercase",letterSpacing:.8,marginBottom:4,lineHeight:1.3}}>{h.label}</div>
                        <div style={{fontSize:20,fontWeight:800,color:isSel?h.c:C.muted,lineHeight:1}}>{h.pax||"—"} <span style={{fontSize:10,fontWeight:400}}>pax</span></div>
                        <div style={{fontSize:10,color:isSel?h.c:C.faint,marginTop:3}}>{h.done}/{h.total} done</div>
                        <div style={{height:3,background:C.border,borderRadius:2,marginTop:5,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:isSel?h.c:C.border,borderRadius:2,transition:"width .3s"}}/></div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── Filter info ── */}
            {d1View!=="all"&&<div style={{fontSize:11,color:C.muted,marginBottom:10,padding:"6px 12px",background:C.darkCard,borderRadius:8,border:`1px solid ${C.border}`}}>
              {d1View==="cont"?`🔥 ${T2("Showing")} ${tomorrowLabel} ${T2("function dishes only")}`:
                               `📋 ${T2("Showing")} ${dayAfterLabel} ${T2("function dishes only")}`}
              &nbsp;<span style={{color:C.gold,cursor:"pointer",fontWeight:700}} onClick={()=>setD1View("all")}>→ {T2("Show all")}</span>
            </div>}

            {/* ── Section-wise view ── */}
            {allSecs.map(sec=>{
              const contItems = bySecCont[sec]||[];
              const newItems  = bySecNew[sec]||[];
              const m2 = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
              const secOpen = isSecOpen("d1sec_"+sec);

              // Filter dish names based on selected view
              const activeDishNames = d1View==="cont" ? contItems.map(d=>d.name)
                                    : d1View==="new"  ? newItems.map(d=>d.name)
                                    : [...new Set([...contItems.map(d=>d.name),...newItems.map(d=>d.name)])];
              const allDishNames = [...new Set(activeDishNames)];

              if(allDishNames.length===0) return null;

              // Progress counts for header — based on active view only
              const activeContItems = d1View!=="new" ? contItems : [];
              const activeNewItems  = d1View!=="cont" ? newItems  : [];
              const doneCount = [...activeContItems,...activeNewItems].filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length;
              const totalCount = allDishNames.length;

              return(
                <Card key={sec} style={{marginBottom:10,padding:0,overflow:"hidden"}}>
                  {/* Section header */}
                  <div onClick={()=>toggleSec("d1sec_"+sec)} style={{padding:"12px 16px",background:m2.color+"12",cursor:"pointer",borderBottom:secOpen?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:14,fontWeight:700,color:m2.color}}>{m2.icon} {T2(sec)}</span>
                      <span style={{fontSize:11,color:C.muted}}>{allDishNames.length} {T2("dishes")}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {d1View!=="new"&&<span style={{fontSize:11,color:C.amber}}>{contItems.filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length}/{contItems.length}</span>}
                      {d1View==="all"&&<span style={{fontSize:11,color:C.faint}}>|</span>}
                      {d1View!=="cont"&&<span style={{fontSize:11,color:C.gold}}>{newItems.filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length}/{newItems.length}</span>}
                      <span style={{fontSize:11,color:C.gold}}>{newItems.filter(d=>ds(d.fEvId,d.fIdx).mesaDone).length}/{newItems.length}</span>
                      <span style={{fontSize:13,color:C.muted,transform:secOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                    </div>
                  </div>

                  {secOpen&&<div style={{padding:"8px 12px"}}>
                    {allDishNames.map(dishName=>{
                      const cDish = contItems.find(d=>d.name===dishName);
                      const nDish = newItems.find(d=>d.name===dishName);
                      const inBoth = cDish && nDish;
                      const cKey = `d1dish_${dishName.replace(/\s/g,"_")}`;
                      const isExp = expandedDishes.has(cKey);

                      // Get steps for this dish
                      const allStepsFn = getStepsForDish(dishName);
                      const steps = allStepsFn.length>0?allStepsFn:[{t:"Mesa",i:"Wash, cut, measure all ingredients",tm:600},{t:"Primary prep",i:"Prepare base masala / paste",tm:480}];

                      const cDone = cDish ? !!ds(cDish.fEvId,cDish.fIdx).mesaDone : null;
                      const nDone = nDish ? !!ds(nDish.fEvId,nDish.fIdx).mesaDone : null;

                      return(
                        <div key={dishName} style={{marginBottom:6}}>
                          {/* Dish row — side by side pax */}
                          <div onClick={()=>toggleDish(cKey)} style={{cursor:"pointer",borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                            {/* Top: dish name */}
                            <div style={{padding:"9px 14px",background:C.darkCard,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div style={{fontSize:12,fontWeight:700,color:C.text}}>{dishName}</div>
                              <span style={{fontSize:12,color:C.muted}}>{isExp?'▼':'▶'}</span>
                            </div>
                            {/* Side-by-side pax columns — only show relevant columns */}
                            <div style={{display:"grid",gridTemplateColumns:d1View==="all"?"1fr 1fr":d1View==="cont"?"1fr":"1fr",gap:0}}>
                              {/* Left: Continue D-1 — only if view is cont or all */}
                              {d1View!=="new"&&(
                              <div style={{padding:"8px 12px",background:cDish?C.amberBg+"40":"transparent",borderRight:d1View==="all"?`1px solid ${C.border}`:"none"}}>
                                {cDish?(
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <div style={{width:18,height:18,borderRadius:5,background:cDone?C.green:C.amber,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                      {cDone&&<span style={{fontSize:9,fontWeight:700,color:"#0A0A0F"}}>✓</span>}
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,fontWeight:700,color:cDone?C.green:C.amber}}>{cDish.totalPax} pax</div>
                                      <div style={{fontSize:9,color:C.faint}}>{tomorrowLabel}</div>
                                    </div>
                                  </div>
                                ):<div style={{fontSize:10,color:C.faint}}>—</div>}
                              </div>
                              )}
                              {/* Right: New D-1 — only if view is new or all */}
                              {d1View!=="cont"&&(
                              <div style={{padding:"8px 12px",background:nDish?C.goldBg+"40":"transparent"}}>
                                {nDish?(
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <div style={{width:18,height:18,borderRadius:5,background:nDone?C.green:C.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                      {nDone&&<span style={{fontSize:9,fontWeight:700,color:"#0A0A0F"}}>✓</span>}
                                    </div>
                                    <div>
                                      <div style={{fontSize:11,fontWeight:700,color:nDone?C.green:C.gold}}>{nDish.totalPax} pax</div>
                                      <div style={{fontSize:9,color:C.faint}}>{dayAfterLabel}</div>
                                    </div>
                                  </div>
                                ):<div style={{fontSize:10,color:C.faint}}>—</div>}
                              </div>
                              )}
                            </div>
                            {/* Collective row if in both */}
                            {inBoth&&<div style={{padding:"6px 12px",background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span style={{fontSize:10,color:C.muted}}>📦 {T2("Collective")}</span>
                              <span style={{fontSize:11,fontWeight:700,color:C.text}}>{(cDish.totalPax||0)+(nDish.totalPax||0)} pax {T2("total")}</span>
                            </div>}
                          </div>

                          {/* Expanded steps */}
                          {isExp&&(
                            <div style={{padding:"8px 12px",borderRadius:"0 0 10px 10px",background:C.surface,border:`1px solid ${C.border}`,borderTop:"none"}}>
                              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>📋 {T2("Steps")} — {steps.length}</div>
                              {/* ── Step 0: Store Sourcing (D-1 tab) ── */}
                              {(()=>{
                                const tdish=cDish||nDish;if(!tdish)return null;
                                const d2s=ds(tdish.fEvId,tdish.fIdx);
                                const ssStarted=!!d2s.storeStart;
                                const ssDone=!!d2s.storeEnd||(ssStarted&&Math.floor((Date.now()-(d2s.storeStart||0))/1000)>=1800);
                                const ssEl=ssStarted&&!ssDone?Math.floor((Date.now()-(d2s.storeStart||0))/1000):0;
                                const ssRem=Math.max(0,1800-ssEl);
                                const ssPct=ssStarted?Math.min(100,Math.round(ssEl/1800*100)):0;
                                return(
                                  <div style={{padding:12,marginBottom:10,borderRadius:10,
                                    border:'2px solid '+(ssDone?'#1A4828':ssStarted?'#4A2810':'#2A2520'),
                                    background:ssDone?'#0A2010':ssStarted?'#281508':'#1A1714'}}>
                                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                                      <div style={{width:32,height:32,borderRadius:8,background:ssDone?'#3EAA68':ssStarted?'#D4914A':'#2A2520',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#0A0A0F',flexShrink:0}}>{ssDone?'✓':'0'}</div>
                                      <div style={{flex:1}}>
                                        <div style={{fontSize:13,fontWeight:700,color:ssDone?'#3EAA68':ssStarted?'#D4914A':'#F5F0E8'}}>🏪 Collect Items from Store</div>
                                        <div style={{fontSize:11,color:'#7A6F62'}}>30 min stoppable timer — collect all ingredients</div>
                                      </div>
                                    </div>
                                    {ssStarted&&!ssDone&&<div style={{marginTop:8}}>
                                      <div style={{height:5,background:'#2A2520',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:ssPct+'%',background:'#D4914A',borderRadius:3,transition:'width 1s'}}/></div>
                                      <div style={{fontSize:11,color:'#D4914A',fontWeight:700,marginTop:3}}>⏱ {Math.floor(ssEl/60)}m {ssEl%60}s / 30m — {Math.floor(ssRem/60)}m {ssRem%60}s left</div>
                                    </div>}
                                    {!ssStarted&&!ssDone&&<button onClick={()=>setDs(tdish.fEvId,tdish.fIdx,{storeStart:Date.now()})} style={{padding:'10px 16px',borderRadius:8,width:'100%',background:'linear-gradient(135deg,#D4B44A,#A8891E)',color:'#0A0908',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',minHeight:40,marginTop:8}}>🏃 Go Collect Items — Start 30 min Timer</button>}
                                    {ssStarted&&!ssDone&&<button onClick={()=>setDs(tdish.fEvId,tdish.fIdx,{storeEnd:Date.now()})} style={{padding:'10px 16px',borderRadius:8,width:'100%',background:'linear-gradient(135deg,#3EAA68,#1A5030)',color:'#fff',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',minHeight:40,marginTop:6}}>⏹ Done — Items Collected</button>}
                                    {ssDone&&<div style={{fontSize:12,color:'#3EAA68',fontWeight:700,marginTop:6}}>✅ Store sourcing complete — ready to cook</div>}
                                  </div>
                                );
                              })()}
                              {steps.map((step,si)=>{
                                const trackDish=cDish||nDish;
                                const d2d=trackDish?ds(trackDish.fEvId,trackDish.fIdx):{};
                                const sk='step_'+si;
                                const stS=!!(d2d.starts&&d2d.starts[sk]);
                                const stM=!!(d2d.manual&&d2d.manual[sk]);
                                const stEl=stS?Math.floor((Date.now()-(d2d.starts[sk]||Date.now()))/1000):0;
                                const stTD=stS&&step.tm&&stEl>=step.tm;
                                const stDone=stM||stTD;
                                const stRem=step.tm?Math.max(0,step.tm-stEl):0;
                                const stPct2=step.tm>0?Math.min(100,Math.round(stEl/step.tm*100)):0;
                                const pk='step_'+(si-1);
                                const prevD=si===0?(!!d2d.storeEnd||(d2d.storeStart&&Math.floor((Date.now()-(d2d.storeStart||0))/1000)>=1800)):(!!(d2d.manual&&d2d.manual[pk])||(d2d.starts&&d2d.starts[pk]&&steps[si-1]&&steps[si-1].tm&&Math.floor((Date.now()-(d2d.starts[pk]||0))/1000)>=steps[si-1].tm));
                                return(
                                  <div key={si} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start"}}>
                                    <div style={{width:26,height:26,borderRadius:7,background:stDone?C.green:stS?C.amber:C.darkCard,border:`2px solid ${stDone?C.green:stS?C.amber:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:stDone||stS?"#0A0A0F":C.muted,flexShrink:0,marginTop:2}}>{stDone?"✓":si+1}</div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,fontWeight:600,color:stDone?C.green:stS?C.amber:C.text}}>{step.t}</div>
                                      {(step.i||step.desc)&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{step.i||step.desc}</div>}
                                      {step.ccp&&<div style={{fontSize:10,color:C.red,marginTop:2}}>🔴 {step.ccp}</div>}
                                      {stS&&!stDone&&step.tm>0&&<div style={{marginTop:4}}>
                                        <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:stPct2+"%",background:C.amber,borderRadius:2,transition:"width 1s"}}/></div>
                                        <div style={{fontSize:10,color:C.amber,marginTop:2}}>⏱ {Math.floor(stEl/60)}m {stEl%60}s — {Math.floor(stRem/60)}m {stRem%60}s left</div>
                                      </div>}
                                      {stDone&&step.tm>0&&<div style={{fontSize:10,color:C.green,marginTop:2}}>✅ {Math.floor(step.tm/60)}m done</div>}
                                      {!stS&&!stDone&&step.tm>0&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>⏱ {fmtT(step.tm)}</div>}
                                    </div>
                                    <div style={{flexShrink:0}}>
                                      {!stS&&!stDone&&step.tm>0&&prevD&&trackDish&&<button onClick={e=>{e.stopPropagation();setDs(trackDish.fEvId,trackDish.fIdx,{starts:{...(d2d.starts||{}),[sk]:Date.now()}});}} style={{padding:"6px 10px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",minHeight:32}}>▶ {Math.floor(step.tm/60)}m</button>}
                                      {!stS&&!stDone&&!step.tm&&prevD&&trackDish&&<button onClick={e=>{e.stopPropagation();setDs(trackDish.fEvId,trackDish.fIdx,{manual:{...(d2d.manual||{}),[sk]:true}});}} style={{padding:"6px 10px",borderRadius:8,background:C.gold,color:"#0A0908",border:"none",fontSize:10,fontWeight:600,cursor:"pointer",minHeight:32}}>✓</button>}
                                      {!stS&&!stDone&&!prevD&&<div style={{padding:"6px 8px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,fontSize:11,color:C.faint,minHeight:32,display:"flex",alignItems:"center"}}>🔒</div>}
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Mark all done buttons — only for active view */}
                              <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                                {d1View!=="new"&&cDish&&!cDone&&<button onClick={e=>{e.stopPropagation();setDs(cDish.fEvId,cDish.fIdx,{mesaDone:true});}} style={{flex:1,padding:"8px",borderRadius:8,background:`linear-gradient(135deg,${C.amber},#A05010)`,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>✅ {tomorrowLabel} — {cDish.totalPax} pax</button>}
                                {d1View!=="cont"&&nDish&&!nDone&&<button onClick={e=>{e.stopPropagation();setDs(nDish.fEvId,nDish.fIdx,{mesaDone:true});}} style={{flex:1,padding:"8px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>✅ {dayAfterLabel} — {nDish.totalPax} pax</button>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>}
                </Card>
              );
            })}

            {allSecs.length===0&&<Card style={{padding:"24px",textAlign:"center"}}><div style={{fontSize:12,color:C.muted}}>{T2("No dishes to prep")}</div></Card>}
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
        const BASE_PAX=1100;
        function isApplicable(pkg,pax){const m=MENU_APPLICABILITY[pkg];return m?m.ranges.some(r=>pax>=r.min&&pax<=r.max):false;}
        function fmtScaled(q,u,pax,pct){
          if(!q||q===0) return "—";
          const raw=q*pax*(( pct||100)/100);
          if(u==="g") return raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" kg":Math.round(raw)+" g";
          if(u==="ml") return raw>=1000?((raw/1000).toFixed(1).replace(/\.0$/,""))+" L":Math.round(raw)+" ml";
          if(u==="pcs") return Math.ceil(raw)+" pcs";
          return Math.round(raw)+" "+u;
        }

        // Effective % from selected event or manual
        const allEvs=[...todayEvs,...tomorrowEvs,...evList.filter(e=>e.date===DAY_AFTER)];
        const linkedEv = scaleEventId ? allEvs.find(e=>e.id===scaleEventId) : null;
        const autoPercent = linkedEv ? Math.round((+linkedEv.pax/BASE_PAX)*100) : null;
        const effectivePct = scaleEventId===null ? 100 : (scalePercent||100);
        const pctLabel = `${effectivePct}%${linkedEv?" ("+linkedEv.guest+" · "+linkedEv.pax+" pax)":""}`;

        const mode=scaleMode||"single";
        const pkgNames=Object.keys(MENU_PACKAGES);
        const selPkg=scalePkg||pkgNames[0];
        const pkgDishes=(MENU_PACKAGES[selPkg]||[]).filter(d=>RECIPE_INGREDIENTS[d]);
        const multiSel=scaleMultiSel||{};
        const activeDishes=mode==="single"?(scaleDish&&RECIPE_INGREDIENTS[scaleDish]?[scaleDish]:[]):mode==="multi"?Object.keys(multiSel).filter(d=>multiSel[d]):pkgDishes;

        // step chip helper
        const StepChip=(n,label)=>(
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,marginTop:n>1?20:0}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:C.gold,color:"#0A0908",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</div>
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
        // Ingredient table (before/after format)
        function IngTable({ingr}){
          return(
            <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
              <table style={{borderCollapse:"collapse",fontSize:11,minWidth:"100%"}}>
                <thead>
                  <tr style={{background:C.darkCard}}>
                    <th style={{padding:"8px 10px",textAlign:"left",color:C.muted,position:"sticky",left:0,background:C.darkCard,borderRight:`1px solid ${C.border}`,minWidth:130}}>Ingredient</th>
                    <th style={{padding:"8px 6px",textAlign:"center",color:C.muted,borderLeft:`1px solid ${C.border}`,minWidth:40}}>Unit</th>
                    <th style={{padding:"8px 8px",textAlign:"right",color:"#FF6B35",borderLeft:`1px solid ${C.border}`,minWidth:90}}>Base (SOP)</th>
                    <th style={{padding:"8px 8px",textAlign:"right",color:effectivePct<100?C.amber:effectivePct>100?C.green:C.gold,borderLeft:`1px solid ${C.border}`,minWidth:90}}>Required ({linkedEv?.pax||Math.round(BASE_PAX*(effectivePct/100))}pax)</th>
                    <th style={{padding:"8px 8px",textAlign:"right",color:C.muted,borderLeft:`1px solid ${C.border}`,minWidth:64}}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ingr.map((ing,ii)=>{
                    const isAcc=!ing.q||ing.q===0;
                    const sopFmt=isAcc?"acc. to taste":fmtScaled(ing.q,ing.u,BASE_PAX,100);
                    const scaledFmt=isAcc?"acc. to taste":fmtScaled(ing.q,ing.u,BASE_PAX,effectivePct);
                    const diffFmt=isAcc?"—":fmtDiff(ing.q,ing.u,effectivePct);
                    const dc=isAcc?C.faint:diffColor(ing.q,effectivePct);
                    return(
                      <tr key={ii} style={{borderTop:`1px solid ${C.borderLight}`,background:ii%2===0?C.surface:C.darkCard}}>
                        <td style={{padding:"7px 10px",position:"sticky",left:0,background:ii%2===0?C.surface:C.darkCard,borderRight:`1px solid ${C.border}`}}>
                          <div style={{fontWeight:600,color:C.text,fontSize:11}}>{ing.n}</div>
                          {ing.h&&<div style={{fontSize:9,color:C.faint}}>{ing.h}</div>}
                          {isAcc&&<div style={{fontSize:9,color:C.amber}}>acc. to taste</div>}
                        </td>
                        <td style={{padding:"7px 6px",textAlign:"center",color:C.faint,fontSize:10,borderLeft:`1px solid ${C.borderLight}`}}>{isAcc?"—":ing.u}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:"#FF6B35",fontSize:11,borderLeft:`1px solid ${C.borderLight}`}}>{sopFmt}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontWeight:700,color:dc,fontSize:11,borderLeft:`1px solid ${C.borderLight}`}}>{scaledFmt}</td>
                        <td style={{padding:"7px 8px",textAlign:"right",color:isAcc?C.amber:dc,fontSize:10,borderLeft:`1px solid ${C.borderLight}`}}>{isAcc?"Acc to taste":diffFmt}</td>
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
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>⚖️ {T2("Pax Scaling")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Scale ingredient quantities to any function's pax. Base: 1100 pax")} <span style={{color:"#FF6B35"}}>★</span></div>

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
                      style={{padding:"10px 16px",borderRadius:10,fontSize:12,fontWeight:isSel?700:400,cursor:"pointer",background:isSel?C.gold:C.surface,color:isSel?"#0A0908":C.muted,border:`1.5px solid ${isSel?C.gold:C.border}`,minHeight:44,textAlign:"left"}}>
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
                    <div style={{fontSize:11,color:C.muted}}>({linkedEv.pax} pax ÷ 1100)</div>
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
                <div style={{display:"flex",gap:0,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:12}}>
                  {[{v:"single",l:"🍽 Single"},{v:"multi",l:"📋 Multiple"},{v:"bulk",l:"📦 Full Menu"}].map(m=>(
                    <button key={m.v} onClick={()=>{setScaleMode(m.v);if(m.v==="single")setScaleDish("");if(m.v!=="single")setScaleMultiSel({});}}
                      style={{flex:1,padding:"11px 8px",border:"none",cursor:"pointer",borderLeft:m.v!=="single"?`1px solid ${C.border}`:"none",background:mode===m.v?C.goldBg:"transparent"}}>
                      <div style={{fontSize:12,fontWeight:mode===m.v?700:400,color:mode===m.v?C.gold:C.muted}}>{m.l}</div>
                    </button>
                  ))}
                </div>
                {mode==="single"&&(
                  <select value={scaleDish||""} onChange={e=>setScaleDish(e.target.value)} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:46,marginBottom:4}}>
                    <option value="">— {T2("Select a dish")} —</option>
                    {pkgNames.map(pkg=>(
                      <optgroup key={pkg} label={"📦 "+pkg+" ("+MENU_APPLICABILITY[pkg]?.code+")"}>
                        {(MENU_PACKAGES[pkg]||[]).filter(d=>RECIPE_INGREDIENTS[d]).map(d=><option key={d} value={d}>{d}</option>)}
                      </optgroup>
                    ))}
                  </select>
                )}
                {mode==="multi"&&(
                  <div style={{marginBottom:4}}>
                    <select value={scalePkg||pkgNames[0]} onChange={e=>{setScalePkg(e.target.value);setScaleMultiSel({});}} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:46,marginBottom:8}}>
                      {pkgNames.map(p=><option key={p} value={p}>{MENU_APPLICABILITY[p]?.code||p} — {p} · {MENU_APPLICABILITY[p]?.label} · {(MENU_PACKAGES[p]||[]).filter(d=>RECIPE_INGREDIENTS[d]).length} dishes</option>)}
                    </select>
                    <div style={{background:C.darkCard,borderRadius:12,padding:"12px",border:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{fontSize:11,color:C.muted}}>{Object.values(multiSel).filter(Boolean).length} {T2("selected")}</div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>setScaleMultiSel(Object.fromEntries(pkgDishes.map(d=>[d,true])))} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,cursor:"pointer"}}>{T2("All")}</button>
                          <button onClick={()=>setScaleMultiSel({})} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer"}}>{T2("Clear")}</button>
                        </div>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {pkgDishes.map(d=><button key={d} onClick={()=>setScaleMultiSel(p=>({...p,[d]:!p[d]}))} style={{padding:"5px 10px",borderRadius:8,fontSize:10,cursor:"pointer",background:multiSel[d]?C.goldBg:C.surface,border:`1.5px solid ${multiSel[d]?C.gold:C.border}`,color:multiSel[d]?C.gold:C.muted,fontWeight:multiSel[d]?700:400}}>{multiSel[d]?"✓ ":""}{d}</button>)}
                      </div>
                    </div>
                  </div>
                )}
                {mode==="bulk"&&(
                  <div style={{marginBottom:4}}>
                    <select value={scalePkg||pkgNames[0]} onChange={e=>{setScalePkg(e.target.value);setOpenSections({});}} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:46}}>
                      {pkgNames.map(p=><option key={p} value={p}>{MENU_APPLICABILITY[p]?.code||p} — {p} · {MENU_APPLICABILITY[p]?.label} · {(MENU_PACKAGES[p]||[]).filter(d=>RECIPE_INGREDIENTS[d]).length} dishes</option>)}
                    </select>
                  </div>
                )}

                {/* ══ STEP 3: REVIEW & CUSTOMIZE ══ */}
                {StepChip(3,T2("Review & Customize Scaling"))}
                {mode==="bulk"?(()=>{
                  if(pkgDishes.length===0) return <Card style={{padding:"20px",textAlign:"center"}}><div style={{fontSize:13,color:C.muted}}>{T2("Select a menu package in Step 2")}</div></Card>;
                  const bySec={};
                  pkgDishes.forEach(d=>{
                    const sec=guessSectionForDish(d)||"Other";
                    if(!bySec[sec])bySec[sec]=[];
                    bySec[sec].push(d);
                  });
                  return Object.entries(bySec).map(([sec,dishes])=>{
                    const smeta=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                    const isOpen=openSections[sec];
                    const aggMap={};
                    dishes.forEach(dish=>{
                      (RECIPE_INGREDIENTS[dish]||[]).forEach(ing=>{
                        const k=ing.n+"|"+(ing.u||"");
                        if(!aggMap[k])aggMap[k]={n:ing.n,h:ing.h||"",u:ing.u||"",q:0,isAcc:!ing.q||ing.q===0};
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
                              <div style={{fontSize:13,fontWeight:700,color:isOpen?smeta.color:C.text}}>{sec}</div>
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
                      const ingr=RECIPE_INGREDIENTS[dish]||[];
                      return(
                        <div key={dish} style={{marginBottom:18}}>
                          <div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:6,fontFamily:"var(--font-display)"}}>{dish}</div>
                          <IngTable ingr={ingr}/>
                        </div>
                      );
                    })}
                    {activeDishes.length===0&&<Card style={{padding:"24px",textAlign:"center",marginBottom:4}}><div style={{fontSize:28,marginBottom:8}}>⚖️</div><div style={{fontSize:13,color:C.muted}}>{mode==="single"?T2("Select a dish in Step 2 above"):T2("Select dishes from the package")}</div></Card>}
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
                        const entry={percent:effectivePct,appliedAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),dishes:activeDishes,eventId:evId,eventName:linkedEv?.guest||"Manual"};
                        setAppliedScales(p=>({...p,[evId||"manual"]:entry}));
                        if(evId&&setKitchenTracking){
                          setKitchenTracking(p=>{const o=p&&typeof p==="object"?{...p}:{};o[evId]={...(o[evId]||{}),__scaling:{percent:effectivePct,dishes:activeDishes,appliedAt:entry.appliedAt}};return o;});
                        }
                      }} style={{padding:"12px 22px",borderRadius:10,background:`linear-gradient(135deg,${C.green},#1A5030)`,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44,whiteSpace:"nowrap"}}>
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
      {tab==="sops"&&(
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:6}}>📖 {T2("Recipe SOPs")}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>97 {T2("recipes")} · 6 {T2("categories")} · {T2("Procedures in Hindi")}</div>
          <input value={sopSearch} onChange={e=>setSopSearch(e.target.value)} placeholder={T2("Search recipes…")} style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box",marginBottom:16,minHeight:48}}/>
          {!sopRecipe?(
            !sopCat?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                {safeArr(RECIPE_DB.cats).map(cat=>{const recipes=safeArr(RECIPE_DB.recipes[cat.id]);const f2=sopSearch?recipes.filter(r=>r.n.toLowerCase().includes(sopSearch.toLowerCase())):recipes;if(sopSearch&&f2.length===0)return null;return(
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
              <button onClick={()=>setSopRecipe(null)} style={{padding:"8px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",marginBottom:14,minHeight:40}}>← {T2("Back")}</button>
              <Card style={{padding:"20px 24px"}}>
                <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>{sopRecipe.n}</div>
                <div style={{fontSize:12,color:C.gold,marginBottom:16}}>{sopRecipe.sub} · {safeArr(sopRecipe.steps).length} {T2("steps")}</div>
                {safeArr(sopRecipe.steps).map((step,si)=>(
                  <div key={si} style={{display:"flex",gap:14,padding:"14px 0",borderBottom:si<sopRecipe.steps.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start"}}>
                    <div style={{width:32,height:32,borderRadius:8,background:C.gold+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.gold,flexShrink:0}}>{si+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>{step.t}</div>
                      <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{step.i||step.desc||""}</div>
                      {step.tm&&<span style={{fontSize:12,color:C.amber,background:C.amberBg,padding:"5px 10px",borderRadius:8,display:"inline-block",marginTop:6}}>⏱ {fmtT(step.tm)}</span>}
                      {step.ccp&&<span style={{fontSize:12,color:C.red,background:C.redBg,padding:"5px 10px",borderRadius:8,display:"inline-block",marginTop:6,marginLeft:6}}>🔴 CCP: {step.ccp}</span>}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ═══ MENU TAB ═══ */}
      {tab==="menus"&&<MenuPackagesView lang={lang}/>}

    </div>
  );
}

export { KitchenHub };
