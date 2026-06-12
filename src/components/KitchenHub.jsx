// Ambria FnB — Kitchen Hub (Overview, Prep Tracking, Prep Plan, Recipe SOPs)
import React, { useState, useRef, useEffect } from "react";
import { C, SECTIONS, SECTION_META } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, TODAY_LABEL, safeArr, safeNum, safePct, localDateStr } from '../utils/helpers.js';
import { MENU_PACKAGES, MENU_PACKAGE_NAMES } from '../data/menuPackages.js';
import { guessSectionForDish, GENERIC_STEPS, RECIPE_INGREDIENTS, RECIPE_DB, findRecipeForDish, getStepsForDish, fmtT, BEV_RE, getFullSteps, getDishImageUrl } from '../data/recipeData.js';
import { Avatar, Card, Btn, Chip, STag, SelfieCapture, SectionHeader } from './SharedUI.jsx';
import { D1PrepTab } from './D1PrepTab.jsx';
import { EventDayTab } from './EventDayTab.jsx';
import { hasPermission } from '../data/permissions.js';

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
  const toggleSec = (sec)=>setExpandedSecs(p=>({...p,[sec]:!p[sec]}));
  const isSecOpen = (sec)=>expandedSecs[sec]===true; // default collapsed
  const [sopCat, setSopCat] = useState(null);
  const [sopRecipe, setSopRecipe] = useState(null);
  const [sopSearch, setSopSearch] = useState("");
  const [scaleDish, setScaleDish] = useState("");
  const [scaleDishSearch, setScaleDishSearch] = useState("");
  const [scaleMode, setScaleMode] = useState("dish");
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
    // No auto-complete — timers are informational, manual "Done" required
    return false;
  }
  function isOverdue(d,si){
    if(stepDone(d,si)) return false;
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

  const contPax  = hasTodayEvs ? todayEvs.reduce((s,e)=>s+(+e.pax||0),0) : tomorrowEvs.reduce((s,e)=>s+(+e.pax||0),0);
  const newD1Pax = evList.filter(e=>e.date===DAY_AFTER).reduce((s,e)=>s+(+e.pax||0),0);

  // Prep day context: which events are being prepped for
  const contEvLabel = (hasTodayEvs ? todayEvs : tomorrowEvs).map(e=>`${e.guest||"Function"} (${e.pax} pax)`).join(", ");
  const newEvLabel = evList.filter(e=>e.date===DAY_AFTER).map(e=>`${e.guest||"Function"} (${e.pax} pax)`).join(", ");
  const prepContextParts = [];
  if(contEvLabel) prepContextParts.push(`${tomorrowLabel}: ${contEvLabel}`);
  if(newEvLabel) prepContextParts.push(`${dayAfterLabel}: ${newEvLabel}`);

  const TABS=[
    {v:"today",   l:T2("Event day")},
    {v:"d1",      l:T2("Prep day")},
    {v:"scaling", l:T2("Scaling")},
    {v:"sops",    l:T2("SOPs")},
    {v:"menus",   l:T2("Menu")},
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
                const now=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
                setDs(evId,idx,{ready:true,readyAt:now,readyPhoto:readyPhoto||null,selfie:readyPhoto||null,signature:readySig||null,completedBy:currentUser?.name||"Chef",completedAt:now});
                stopReadyCam();setReadyModal(null);setReadyPhoto(null);setReadySig(null);sigClear();
              }} style={{flex:1,padding:"14px",borderRadius:12,background:readyPhoto?`linear-gradient(135deg,${C.green},#147A54)`:`${C.border}`,color:readyPhoto?"#fff":C.faint,border:"none",fontSize:14,fontWeight:700,cursor:readyPhoto?"pointer":"not-allowed",minHeight:50,fontFamily:"var(--font-display)",letterSpacing:.5}}>
                ✅ {T2("Confirm Ready")}
              </button>
              <button onClick={()=>{stopReadyCam();setReadyModal(null);setReadyPhoto(null);setReadySig(null);sigClear();}} style={{padding:"14px 16px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:14,cursor:"pointer",minHeight:50}}>✕</button>
            </div>
          </div>
        </div>
      )}


      {/* TABS — underline style */}
      <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.border}`,marginBottom:20,gap:0}}>
        {TABS_FILTERED.map(t=>(
          <button key={t.v} onClick={()=>setTab(s=>{if(s!==t.v&&(t.v==="d1"||s==="d1"))setD1View("all");return t.v;})} style={{padding:"10px 18px",fontSize:13,fontWeight:tab===t.v?500:400,cursor:"pointer",background:"none",color:tab===t.v?C.gold:C.muted,border:"none",borderBottom:`2px solid ${tab===t.v?C.gold:"transparent"}`,whiteSpace:"nowrap"}}>{t.l}</button>
        ))}
        {currentUser&&currentUser.role==='admin'&&(
          <button onClick={function(){
            if(!window.confirm('Reset ALL dish progress? This clears store sourcing, step timers, selfies, completion status for ALL dishes. Cannot undo.'))return;
            setKitchenTracking({});
            try{localStorage.removeItem('ambria_kt');}catch(e){}
            try{localStorage.removeItem('ambria_kitchen_tracking');}catch(e){}
            alert('✅ All dishes reset to fresh state');
          }} style={{padding:'5px 10px',borderRadius:8,background:"none",border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,fontWeight:500,cursor:'pointer',marginLeft:'auto',marginBottom:6,whiteSpace:"nowrap"}}>
            ↺ {T2("Reset all")}
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
            tick={tick}
            setTab={setTab}
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

        const totalCollectivePax=(contPax||0)+(newD1Pax||0);
        const totalCollDone=totalContDone+totalNewDone;
        const totalColl=totalCont+totalNew;

        return(
          <div>
            {/* ── Context bar ── */}
            {prepContextParts.length>0&&(
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:8,background:C.goldBg,border:`1px solid ${C.border}`,marginBottom:16,fontSize:12,color:C.gold}}>
                <span style={{fontSize:14}}>📅</span>
                <span>{prepContextParts.join(" · ")}</span>
              </div>
            )}

            {/* ── Summary cards — single merged row with filter ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
              {[
                {label:`${tomorrowLabel} ${T2("prep")}`,pax:contPax,done:totalContDone,total:totalCont,c:C.amber,view:"cont"},
                {label:`${dayAfterLabel} ${T2("prep")}`,pax:newD1Pax,done:totalNewDone,total:totalNew,c:C.gold,view:"new"},
                {label:T2("All prep"),pax:totalCollectivePax,done:totalCollDone,total:totalColl,c:C.blue,view:"all"},
              ].map(h=>{
                const pct=h.total>0?Math.round(h.done/h.total*100):0;
                const isSel=d1View===h.view;
                return(
                  <div key={h.view} onClick={()=>setD1View(h.view)}
                    style={{background:isSel?h.c+"10":C.surface,borderLeft:`3px solid ${h.c}`,border:isSel?`1.5px solid ${h.c}`:`1.5px solid ${C.border}`,borderLeftWidth:3,borderRadius:10,padding:"14px 16px",cursor:"pointer",transition:"all .15s"}}>
                    <div style={{fontSize:10,fontWeight:500,color:h.c,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{h.label}</div>
                    <div style={{fontSize:22,fontWeight:500,color:h.c,lineHeight:1.1}}>{h.pax||"—"} <span style={{fontSize:12,fontWeight:400,color:C.muted}}>pax</span></div>
                    <div style={{fontSize:11,color:C.muted,marginTop:4}}>{h.done} / {h.total} {T2("done")}</div>
                    <div style={{height:3,background:C.border,borderRadius:2,marginTop:8,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:h.c,borderRadius:2,transition:"width .3s"}}/></div>
                  </div>
                );
              })}
            </div>

            {/* ── Filter info ── */}
            {d1View!=="all"&&<div style={{fontSize:11,color:C.muted,marginBottom:10,padding:"6px 12px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}>
              {d1View==="cont"?`${T2("Showing")} ${tomorrowLabel} ${T2("prep only")}`:
                               `${T2("Showing")} ${dayAfterLabel} ${T2("prep only")}`}
              &nbsp;<span style={{color:C.gold,cursor:"pointer",fontWeight:500}} onClick={()=>setD1View("all")}>→ {T2("Show all")}</span>
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

              const secPct = totalCount>0?Math.round(doneCount/totalCount*100):0;
              return(
                <div key={sec} style={{marginBottom:8,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,overflow:"hidden"}}>
                  {/* Section header */}
                  <div onClick={()=>toggleSec("d1sec_"+sec)} style={{padding:"12px 16px",cursor:"pointer",borderBottom:secOpen?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16}}>{m2.icon}</span>
                      <span style={{fontSize:14,fontWeight:500,color:m2.color}}>{T2(sec)}</span>
                      <span style={{fontSize:12,color:C.muted}}>{allDishNames.length} {T2("dishes")}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:12,fontWeight:500,color:m2.color}}>{doneCount} / {totalCount}</span>
                      <div style={{width:60,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:secPct+"%",background:m2.color,borderRadius:2,transition:"width .3s"}}/></div>
                      <span style={{fontSize:14,color:C.faint,transform:secOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
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
                                const ssDone=!!d2s.storeEnd;
                                const ssOverdue=ssStarted&&!ssDone&&Math.floor((Date.now()-(d2s.storeStart||0))/1000)>=1800;
                                const ssEl=ssStarted&&!ssDone?Math.floor((Date.now()-(d2s.storeStart||0))/1000):0;
                                const ssRem=Math.max(0,1800-ssEl);
                                const ssPct=ssStarted?Math.min(100,Math.round(ssEl/1800*100)):0;
                                return(
                                  <div style={{padding:12,marginBottom:10,borderRadius:10,
                                    border:`2px solid ${ssDone?C.greenBorder:ssStarted?C.amberBorder:C.border}`,
                                    background:ssDone?C.greenBg:ssStarted?C.amberBg:C.surface}}>
                                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                                      <div style={{width:32,height:32,borderRadius:8,background:ssDone?C.green:ssStarted?C.amber:C.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#fff',flexShrink:0}}>{ssDone?'✓':'0'}</div>
                                      <div style={{flex:1}}>
                                        <div style={{fontSize:13,fontWeight:700,color:ssDone?C.green:ssStarted?C.amber:C.text}}>🏪 Collect Items from Store</div>
                                        <div style={{fontSize:11,color:C.muted}}>30 min stoppable timer — collect all ingredients</div>
                                      </div>
                                    </div>
                                    {ssStarted&&!ssDone&&<div style={{marginTop:8}}>
                                      <div style={{height:5,background:C.border,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:ssPct+'%',background:C.amber,borderRadius:3,transition:'width 1s'}}/></div>
                                      <div style={{fontSize:11,color:C.amber,fontWeight:700,marginTop:3}}>⏱ {Math.floor(ssEl/60)}m {ssEl%60}s / 30m — {Math.floor(ssRem/60)}m {ssRem%60}s left</div>
                                    </div>}
                                    {!ssStarted&&!ssDone&&<button onClick={()=>setDs(tdish.fEvId,tdish.fIdx,{storeStart:Date.now()})} style={{padding:'10px 16px',borderRadius:8,width:'100%',background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:'#fff',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',minHeight:40,marginTop:8}}>🏃 Go Collect Items — Start 30 min Timer</button>}
                                    {ssStarted&&!ssDone&&<button onClick={()=>setDs(tdish.fEvId,tdish.fIdx,{storeEnd:Date.now()})} style={{padding:'10px 16px',borderRadius:8,width:'100%',background:`linear-gradient(135deg,${C.green},#147A54)`,color:'#fff',border:'none',fontSize:12,fontWeight:700,cursor:'pointer',minHeight:40,marginTop:6}}>⏹ Done — Items Collected</button>}
                                    {ssDone&&<div style={{fontSize:12,color:C.green,fontWeight:700,marginTop:6}}>✅ Store sourcing complete — ready to cook</div>}
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
                                const stDone=stM;
                                const stOverdue=stS&&step.tm&&stEl>=step.tm&&!stDone;
                                const stRem=step.tm?Math.max(0,step.tm-stEl):0;
                                const stPct2=step.tm>0?Math.min(100,Math.round(stEl/step.tm*100)):0;
                                const pk='step_'+(si-1);
                                const prevD=si===0?(!!d2d.storeEnd):(!!(d2d.manual&&d2d.manual[pk]));
                                return(
                                  <div key={si} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start"}}>
                                    <div style={{width:26,height:26,borderRadius:7,background:stDone?C.green:stS?(stOverdue?C.red:C.amber):C.darkCard,border:`2px solid ${stDone?C.green:stS?(stOverdue?C.red:C.amber):C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:stDone||stS?"#fff":C.muted,flexShrink:0,marginTop:2}}>{stDone?"✓":si+1}</div>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,fontWeight:600,color:stDone?C.green:stS?C.amber:C.text}}>{step.t}</div>
                                      {(step.i||step.desc)&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{step.i||step.desc}</div>}
                                      {step.ccp&&<div style={{fontSize:10,color:C.red,marginTop:2}}>🔴 {step.ccp}</div>}
                                      {stS&&!stDone&&step.tm>0&&<div style={{marginTop:4}}>
                                        <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:Math.min(100,stPct2)+"%",background:stOverdue?C.red:C.amber,borderRadius:2,transition:"width 1s"}}/></div>
                                        {stOverdue
                                          ?<div style={{fontSize:10,color:C.red,fontWeight:700,marginTop:2}}>⏱ +{Math.floor(Math.abs(stRem===0?(stEl-(step.tm||0)):0)/60)}m {Math.abs(stEl-(step.tm||0))%60}s over — tap Done ✓</div>
                                          :<div style={{fontSize:10,color:C.amber,marginTop:2}}>⏱ {Math.floor(stEl/60)}m {stEl%60}s — {Math.floor(stRem/60)}m {stRem%60}s left</div>}
                                      </div>}
                                      {stDone&&step.tm>0&&<div style={{fontSize:10,color:C.green,marginTop:2}}>✅ {Math.floor(stEl/60)}m {stEl%60}s done{step.tm&&stEl>step.tm?` (+${Math.floor((stEl-step.tm)/60)}m ${(stEl-step.tm)%60}s over)`:""}</div>}
                                      {!stS&&!stDone&&step.tm>0&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>⏱ {fmtT(step.tm)}</div>}
                                    </div>
                                    <div style={{flexShrink:0}}>
                                      {!stS&&!stDone&&step.tm>0&&prevD&&trackDish&&<button onClick={e=>{e.stopPropagation();setDs(trackDish.fEvId,trackDish.fIdx,{starts:{...(d2d.starts||{}),[sk]:Date.now()}});}} style={{padding:"6px 10px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",minHeight:32}}>▶ {Math.floor(step.tm/60)}m</button>}
                                      {!stS&&!stDone&&!step.tm&&prevD&&trackDish&&<button onClick={e=>{e.stopPropagation();setDs(trackDish.fEvId,trackDish.fIdx,{manual:{...(d2d.manual||{}),[sk]:true}});}} style={{padding:"6px 10px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:10,fontWeight:600,cursor:"pointer",minHeight:32}}>✓</button>}
                                      {!stS&&!stDone&&!prevD&&<div style={{padding:"6px 8px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,fontSize:11,color:C.faint,minHeight:32,display:"flex",alignItems:"center"}}>🔒</div>}
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Mark all done buttons — only for active view */}
                              <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                                {d1View!=="new"&&cDish&&!cDone&&<button onClick={e=>{e.stopPropagation();setDs(cDish.fEvId,cDish.fIdx,{mesaDone:true});}} style={{flex:1,padding:"8px",borderRadius:8,background:`linear-gradient(135deg,${C.amber},#8A5A10)`,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>✅ {tomorrowLabel} — {cDish.totalPax} pax</button>}
                                {d1View!=="cont"&&nDish&&!nDone&&<button onClick={e=>{e.stopPropagation();setDs(nDish.fEvId,nDish.fIdx,{mesaDone:true});}} style={{flex:1,padding:"8px",borderRadius:8,background:`linear-gradient(135deg,${C.gold},${C.wine})`,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer",minHeight:36}}>✅ {dayAfterLabel} — {nDish.totalPax} pax</button>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>}
                </div>
              );
            })}

            {allSecs.length===0&&<div style={{padding:"24px",textAlign:"center",borderRadius:10,border:`1px solid ${C.border}`,background:C.surface}}><div style={{fontSize:12,color:C.muted}}>{T2("No dishes to prep")}</div></div>}{allSecs.length===0&&<Card style={{padding:"24px",textAlign:"center"}}><div style={{fontSize:12,color:C.muted}}>{T2("No dishes to prep")}</div></Card>}
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

        const mode=scaleMode||"dish";
        const pkgNames=Object.keys(MENU_PACKAGES);
        const selPkg=scalePkg||pkgNames[0];
        const pkgDishes=(MENU_PACKAGES[selPkg]||[]).filter(d=>RECIPE_INGREDIENTS[d]);
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
            <div style={{fontSize:18,fontWeight:500,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>⚖️ {T2("Pax Scaling")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:6}}>{T2("Scale ingredient quantities to any function's pax count.")}</div>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,fontSize:11,color:C.amber,marginBottom:16}}>
              <span style={{fontWeight:600}}>{T2("Base SOP")}: 1,100 pax</span>
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
                          (MENU_PACKAGES[pkg]||[]).filter(d=>RECIPE_INGREDIENTS[d]&&d.toLowerCase().includes(q)&&!multiSel[d]).forEach(d=>{
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
                      {pkgNames.map(p=><option key={p} value={p}>{MENU_APPLICABILITY[p]?.code||p} — {p} · {MENU_APPLICABILITY[p]?.label} · {(MENU_PACKAGES[p]||[]).filter(d=>RECIPE_INGREDIENTS[d]).length} {T2("dishes")}</option>)}
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
                        const entry={percent:effectivePct,appliedAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),dishes:activeDishes,eventId:evId,eventName:linkedEv?.guest||"Manual"};
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
