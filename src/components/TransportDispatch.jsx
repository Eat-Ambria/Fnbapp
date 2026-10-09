// Ambria FnB — Transport & Dispatch
import React, { useState, useRef, useEffect } from "react";
import { C, VEHICLES, COLD_ITEMS, AMBRIA_VENUES } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, safeArr, safePct, calcDispatch } from '../utils/helpers.js';
import { Card, Btn, Chip } from './SharedUI.jsx';
import { dbUpsert, dbDelete } from '../lib/db.js';
import { getCatIdForDish, isFruitSelectionDish, RECIPE_DB } from '../data/recipeData.js';
import { describeEventMenu } from '../data/menuPackages.js';
import { logActivity } from './ActivityLog.jsx';
import { K, type } from '../utils/theme.js';
import { Icon } from './Icons.jsx';

function TransportDispatch({events, kitchenTracking={}, setKitchenTracking=null, lang="en", currentUser=null, transportQueue=[], setTransportQueue}) {
  const T2 = s => T(s, lang||"en");
  // Only work with events in a rolling window (today - 2d to future). Past events don't need dispatch state — they froze the mount when the queue included all 179+ historical events.
  const DISPATCH_CUTOFF = new Date(Date.now() - 2*864e5).toISOString().slice(0,10);
  const allEventsRaw = Array.isArray(events) ? events : [];
  const safeEvs = allEventsRaw.filter(e => e && e.date && e.date >= DISPATCH_CUTOFF);
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const VCOL = {dry:"#C07010", cold:"#185FA5", quick:"#2B8A50"};

  // Outsourced (vendor-supplied) dishes never enter the kitchen's own cook
  // list (KitchenHub.jsx/EventDayTab.jsx already exclude them via their own
  // menuArr()), so they should never count toward a vehicle's manifest,
  // loading checklist, or this event's "dishes ready" totals either.
  function menuArr(ev) {
    const m = ev.menu;
    let arr;
    if (Array.isArray(m)) arr = m;
    else if (typeof m === 'string' && m) { try { arr = JSON.parse(m); } catch(e) { arr = []; } }
    else arr = [];
    const out = ev.outsourced_dishes;
    if (Array.isArray(out) && out.length > 0) {
      const skip = new Set(out);
      arr = arr.filter(n => !skip.has(n));
    }
    return arr;
  }

  function autoVehicles(ev){
    const menu=menuArr(ev);
    const hasCold=menu.some(d=>COLD_ITEMS.some(ci=>d.toLowerCase().includes(ci.toLowerCase())));
    const pax=+ev.pax||0;
    const vids=[];
    vids.push("DL1LAJ1250");
    if(hasCold) vids.push("DL1LAN2125");
    if(pax>400) vids.push("DL1LAN1814");
    return vids;
  }

  const initDispatches = () => safeEvs.map(ev=>({
    evId:ev.id, evGuest:ev.guest, evDate:ev.date, evTime:ev.time, evVenue:ev.venue, menu:menuArr(ev),
    assignments: autoVehicles(ev).map(vid=>({
      vehicleId:vid, driver:"", dispatchTime:calcDispatch(ev.time), status:T2("Planning"),
    })),
  }));

  const [dispatches, setDispatches] = useState(initDispatches);

  // One-shot cleanup: drop transport queue items older than 7 days on mount (prevents unbounded growth)
  useEffect(function(){
    if(!setTransportQueue || !Array.isArray(transportQueue) || transportQueue.length===0) return;
    var PRUNE_CUTOFF = new Date(Date.now() - 7*864e5).toISOString().slice(0,10);
    var kept = transportQueue.filter(function(item){return item.eventDate && item.eventDate >= PRUNE_CUTOFF;});
    if(kept.length !== transportQueue.length){
      setTransportQueue(kept);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const [tdSecOpen, setTdSecOpen] = useState({});
  const [activeTab,  setActiveTab]  = useState("todayplan");
  const [fleetList,   setFleetList]   = useState(VEHICLES.map(v=>({...v})));
  const [showAddVeh,  setShowAddVeh]  = useState(false);
  const [editVehId,   setEditVehId]   = useState(null);
  const [vehForm,     setVehForm]     = useState({id:"",name:"",icon:"🚛",type:"dry",note:"",base_location:"AP Kitchen"});
  const [delVehId,    setDelVehId]    = useState(null);
  const [challanFor,  setChallanFor]  = useState(null); // {evId, vehicleId}

  // Items currently tagged to this vehicle for this event that have been
  // picked off "Ready" (i.e. actually loaded), newest-loaded last.
  function loadedRowsFor(evId, vehicleId) {
    const ev = safeEvs.find(e=>e.id===evId);
    if(!ev) return [];
    return (transportQueue||[]).filter(r=>{
      const belongsToEv = r.evId ? r.evId===evId : (r.event===ev.guest && r.eventDate===ev.date);
      return belongsToEv && r.vehicleId===vehicleId && r.status!=="Ready";
    }).sort((a,b)=>(a.sec||"").localeCompare(b.sec||"")||(a.dish||"").localeCompare(b.dish||""));
  }

  function updAsgn(evId,ai,field,val){setDispatches(p=>p.map(d=>d.evId!==evId?d:{...d,assignments:d.assignments.map((a,i)=>i!==ai?a:{...a,[field]:val})}));}
  function addVehicle(evId){
    const ev=safeEvs.find(e=>e.id===evId);
    const used=new Set((dispatches.find(d=>d.evId===evId)?.assignments||[]).map(a=>a.vehicleId));
    const vid=(VEHICLES.find(v=>!used.has(v.id))||VEHICLES[0])?.id;
    if(!vid) return;
    setDispatches(p=>p.map(d=>d.evId!==evId?d:{...d,assignments:[...d.assignments,{vehicleId:vid,driver:"",dispatchTime:calcDispatch(ev?.time||""),status:T2("Planning")}]}));
  }

  // ── Dispatch status flow: Planning → Loaded → Dispatched → At Venue → Unloaded ──
  const STATUS_FLOW = ["Planning","Loaded","Dispatched","At Venue","Unloaded"];
  function advanceStatus(evId,ai){
    setDispatches(p=>p.map(d=>{
      if(d.evId!==evId)return d;
      return {...d,assignments:d.assignments.map((a,i)=>{
        if(i!==ai)return a;
        const ci=STATUS_FLOW.indexOf(a.status);
        if(ci<0||ci>=STATUS_FLOW.length-1)return a;
        const next=STATUS_FLOW[ci+1];
        const now=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
        const upd={...a,status:next};
        if(next==="Dispatched")upd.dispatchedAt=now;
        if(next==="At Venue")upd.arrivedAt=now;
        if(next==="Unloaded")upd.unloadedAt=now;
        logActivity('dispatch', 'Transport '+next+': '+(a.vehicle||'vehicle')+' for event '+evId, 'dispatch_'+next.toLowerCase().replace(/ /g,'_'), {evId:evId, vehicle:a.vehicle||'', driver:a.driver||'', from:next, to:next}, currentUser?.id);
        return upd;
      })};
    }));
  }
  function canAdvance(asgn){
    // Loading/unloading is now tracked per-dish on the "Ready for Transport"
    // chips (see renderCard below), not a separate vehicle checklist — this
    // flow is just the truck's own physical status, confirmed manually.
    if(asgn.status==="Planning"){return true;}
    if(asgn.status==="Loaded"){return !!asgn.driver;}
    if(asgn.status==="Dispatched"){return true;}
    if(asgn.status==="At Venue"){return true;}
    return false;
  }
  function nextLabel(status){
    if(status==="Planning")return "📦 Mark Loaded";
    if(status==="Loaded")return "🚛 Dispatch Now";
    if(status==="Dispatched")return "📍 Arrived at Venue";
    if(status==="At Venue")return "✅ All Unloaded";
    return null;
  }

  // ── Vehicle location derived from dispatch status ──
  function getVehicleLocation(vehicleId) {
    var todayDispatches = dispatches.filter(d => safeEvs.some(e => e.id === d.evId && e.date === TODAY));
    for (var i = 0; i < todayDispatches.length; i++) {
      var dd = todayDispatches[i];
      var ev = safeEvs.find(e => e.id === dd.evId);
      for (var j = 0; j < (dd.assignments || []).length; j++) {
        var a = dd.assignments[j];
        if (a.vehicleId !== vehicleId) continue;
        var src = (fleetList.find(v => v.id === vehicleId) || {}).base_location || "AP Kitchen";
        var dest = ev ? (ev.venue || "Venue") : "Venue";
        var guest = ev ? ev.guest : "";
        if (a.status === "Planning" || a.status === "Loaded") return { status: a.status, at: src, dest: dest + (guest ? " (" + guest + ")" : ""), driver: a.driver, time: a.status === "Loaded" ? "Loaded" : "", color: a.status === "Loaded" ? C.amber : C.muted };
        if (a.status === "Dispatched") return { status: "En Route", at: src, dest: dest + (guest ? " (" + guest + ")" : ""), driver: a.driver, time: a.dispatchedAt || "", color: "#1B5EAB" };
        if (a.status === "At Venue") return { status: "At Venue", at: dest + (guest ? " (" + guest + ")" : ""), dest: null, driver: a.driver, time: a.arrivedAt || "", color: "#2B8A50" };
        if (a.status === "Unloaded") return { status: "Completed", at: dest, dest: null, driver: a.driver, time: a.unloadedAt || "", color: C.green };
      }
    }
    var veh = fleetList.find(v => v.id === vehicleId);
    return { status: "At Base", at: veh?.base_location || "AP Kitchen", dest: null, driver: "", time: "", color: "#888" };
  }

  // ── Fleet CRUD ──
  var isAdmin = currentUser?.role === "admin";
  function saveVehicle() {
    if (!vehForm.name.trim()) return;
    var vid = editVehId || vehForm.name.replace(/\s+/g, "").toUpperCase();
    var rec = { id: vid, name: vehForm.name.trim(), icon: vehForm.icon || "🚛", type: vehForm.type || "dry", note: vehForm.note || "", base_location: vehForm.base_location || "AP Kitchen", is_active: true };
    setFleetList(p => { var exists = p.find(v => v.id === vid); if (exists) return p.map(v => v.id === vid ? { ...v, ...rec } : v); return [...p, rec]; });
    dbUpsert("vehicles", rec, "id").catch(e => console.error("vehicle save:", e));
    setShowAddVeh(false); setEditVehId(null); setVehForm({ id: "", name: "", icon: "🚛", type: "dry", note: "", base_location: "AP Kitchen" });
  }
  function deleteVehicle(vid) {
    setFleetList(p => p.filter(v => v.id !== vid));
    dbDelete("vehicles", "id", vid).catch(e => console.error("vehicle delete:", e));
    setDelVehId(null);
  }

  const PROP = {
    "Ambria Pushpanjali":{code:"AP",c:"#D4A843",bg:C.goldBg},
    "Ambria Exotica":    {code:"AE",c:"#854F0B",bg:C.goldBg},
    "Manaktala Farm":    {code:"AM",c:"#B05A10",bg:C.amberBg},
    "Ambria Restro":     {code:"AR",c:"#0F6E56",bg:C.tealBg},
  };
  const gp = v => PROP[v]||{code:"EV",c:C.wine,bg:C.wineBg};


  // ── Shared look (matches the Kitchen Hub warm-card theme) ──
  const cardS = {background:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,borderRadius:20,boxShadow:K.shadowCard};
  const eyebrow = {fontSize:12,fontWeight:700,color:K.hdrTitle,textTransform:"uppercase",letterSpacing:1.2};
  const tileIcon = (name,bg,fg,size=46) => (
    <span style={{width:size,height:size,borderRadius:Math.round(size*.3),flexShrink:0,background:bg,color:fg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Icon name={name} size={Math.round(size*.46)} strokeWidth={1.8}/>
    </span>
  );
  const todayEvsAll = safeEvs.filter(e=>e.date===TODAY);
  const todayDishTotal = todayEvsAll.reduce((n,ev)=>n+menuArr(ev).filter(d=>getCatIdForDish(d)!=="beverages"&&!isFruitSelectionDish(d)).length,0);
  const todayVehTotal = todayEvsAll.reduce((n,ev)=>n+((dispatches.find(d=>d.evId===ev.id)||{assignments:[]}).assignments.length),0);

  return (
    <div style={{fontFamily:K.fontBody}}>
      {/* ── ODC MENU NOT CONFIRMED WARNING ── */}
      {(()=>{
        const odcUnconfirmed = safeEvs.filter(ev=>ev.venue==="Outdoor Catering (ODC)"&&!ev.odc_menu_confirmed&&(ev.date===TODAY||ev.date===TOMORROW));
        if(odcUnconfirmed.length===0) return null;
        return(
          <div style={{marginBottom:12}}>
            {odcUnconfirmed.map(ev=>(
              <div key={"odc-t-"+ev.id} style={{marginBottom:6,padding:"10px 14px",borderRadius:14,background:K.warnBg,border:`1px solid ${K.warnBorder}`,display:"flex",alignItems:"center",gap:10}}>
                <span style={{color:K.warn,display:"flex"}}><Icon name="alert" size={16}/></span>
                <div>
                  <div style={{fontSize:12.5,fontWeight:700,color:K.warn}}>ODC menu not confirmed — {ev.guest}</div>
                  <div style={{fontSize:11.5,color:K.hdrMeta}}>{ev.odc_location||"Location TBD"} · {ev.date} · {ev.pax} pax — Dispatch manifest may be inaccurate</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Tabs ── */}
      <div style={{display:"flex",gap:10,marginBottom:16,paddingBottom:14,borderBottom:`1px solid ${K.cardWarmLine}`}}>
        {[{v:"todayplan",l:T2("Today's Plan"),i:"calendarDays"},{v:"fleet",l:T2("Fleet"),i:"truck"}].map(t=>{const on=activeTab===t.v;return(
          <button key={t.v} onClick={()=>setActiveTab(t.v)} className={on?undefined:"kh-calnav"}
            style={{display:"inline-flex",alignItems:"center",gap:10,padding:"11px 30px",borderRadius:12,fontSize:14,fontWeight:on?700:600,cursor:"pointer",fontFamily:K.fontBody,
              background:on?K.brand:K.cardWarm,color:on?"#FFFFFF":K.hdrTitle,border:`1px solid ${on?K.brand:K.cardWarmLine}`,boxShadow:K.shadowCard}}>
            <Icon name={t.i} size={17} strokeWidth={1.9}/>{t.l}
          </button>);})}
      </div>

      {activeTab==="todayplan"&&(()=>{
        const todayEvs = safeEvs.filter(e=>e.date===TODAY).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        const tomorrowEvs = safeEvs.filter(e=>e.date===TOMORROW).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        // Tap a dish chip to cycle its own status: Ready → Loaded → Delivered
        // → back to Ready. This IS the loading/unloading tracking now — chips
        // read/write the real transportQueue rows Kitchen Hub's "Send to
        // transport" grid already creates, so there's no separate vehicle-level
        // checklist duplicating the same dishes to keep in sync.
        const ROW_STATUS_FLOW = ["Ready","Loaded","Delivered"];
        function cycleRowStatus(rowId){
          if(!setTransportQueue) return;
          const now=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
          setTransportQueue(prev=>prev.map(r=>{
            if(r.id!==rowId) return r;
            const ci=ROW_STATUS_FLOW.indexOf(r.status);
            const next=ROW_STATUS_FLOW[(ci<0?0:ci+1)%ROW_STATUS_FLOW.length];
            return {...r, status:next, pickedUpAt:next!=="Ready"?now:undefined};
          }));
        }
        // Rows sharing the same dish + day but a DIFFERENT event — a batch
        // cooked once and split across functions shows up as one queue row
        // per function; this finds the others so a chip can show "×N" and
        // where the rest of the batch is going.
        function sharedRowsFor(row){
          return (transportQueue||[]).filter(r2=>r2.id!==row.id && r2.dish===row.dish && r2.eventDate===row.eventDate && (r2.evId||r2.event)!==(row.evId||row.event));
        }

        function renderCard(ev, dayLabel){
          const dispatch = dispatches.find(d=>d.evId===ev.id)||{assignments:[]};
          const menu = menuArr(ev);
          const allVehicles = dispatch.assignments.map(a=>fleetList.find(v=>v.id===a.vehicleId)||{name:a.vehicleId,icon:"🚛"});

          // Every station this event's menu actually touches (excluding
          // beverages/fruit-counter dishes, which never get a transport row).
          const menuBySec = {};
          menu.forEach(n=>{
            if(getCatIdForDish(n)==="beverages"||isFruitSelectionDish(n)) return;
            const s=getCatIdForDish(n);
            if(!menuBySec[s]) menuBySec[s]=[];
            menuBySec[s].push(n);
          });
          // This event's own transport-queue rows, grouped by station.
          const evRows = (transportQueue||[]).filter(r=>r.evId?r.evId===ev.id:(r.event===ev.guest&&r.eventDate===ev.date));
          const bySec = {};
          evRows.forEach(r=>{
            const sec = r.sec || getCatIdForDish(r.dish) || "other";
            if(!bySec[sec]) bySec[sec]=[];
            bySec[sec].push(r);
          });
          const stationsMeta = Object.keys(menuBySec).sort().map(sec=>{
            const catObj=RECIPE_DB.cats.find(c=>c.id===sec);
            const rows=bySec[sec]||[];
            const total=menuBySec[sec].length;
            const uniqDishes=[...new Set(rows.map(r=>r.dish))];
            const sent=uniqDishes.length;
            const deliveredAll = rows.length>0 && rows.every(r=>r.status==="Delivered");
            const allDone = sent>0 && sent>=total && deliveredAll;
            const vehIds=[...new Set(rows.map(r=>r.vehicleId).filter(Boolean))];
            const assignedVehicleId = vehIds.length===1?vehIds[0]:"";
            return {sec, color:catObj?.color||C.muted, icon:catObj?.icon||"🍽", name:T2(catObj?.name||sec), rows, total, sent, allDone, started: rows.length>0, assignedVehicleId};
          });
          const startedStations = stationsMeta.filter(s=>s.started);
          const notStartedStations = stationsMeta.filter(s=>!s.started);
          const totalDishes = stationsMeta.reduce((n,s)=>n+s.total,0);
          const readyDishes = stationsMeta.reduce((n,s)=>n+s.sent,0);
          const readyPct = safePct(readyDishes,totalDishes);
          function toggleSecOpen(secKey, currentOpen){ setTdSecOpen(p=>({...p,[secKey]:!currentOpen})); }
          // People load a station's dishes onto one truck together, so the
          // truck assignment lives at the station level, not per dish —
          // tags every transportQueue row for this event+station with the
          // chosen vehicleId.
          function setStationVehicle(sec, vehicleId){
            if(!setTransportQueue) return;
            setTransportQueue(prev=>prev.map(r=>{
              const belongsToEv = r.evId ? r.evId===ev.id : (r.event===ev.guest && r.eventDate===ev.date);
              if(!belongsToEv) return r;
              const rowSec = r.sec || getCatIdForDish(r.dish) || "other";
              if(rowSec!==sec) return r;
              return {...r, vehicleId};
            }));
          }
          // Local calendar parts (no UTC conversion — IST would shift the day).
          const [ey,em,ed] = String(ev.date||"").split("-").map(Number);
          const dObj = ey ? new Date(ey,(em||1)-1,ed||1) : null;
          const monShort = dObj ? dObj.toLocaleDateString("en-IN",{month:"short"}).toUpperCase() : "";
          const dayCap = dayLabel || (dObj ? dObj.toLocaleDateString("en-IN",{weekday:"short"}).toUpperCase() : "");
          const isLms = !!(ev.lms_source||ev.lms_contract);
          const divider = <span style={{width:1,alignSelf:"stretch",background:K.cardWarmLine}}/>;

          return (
            <div key={ev.id} style={{marginBottom:22}}>
              {/* ── Event summary ── */}
              <div style={{...cardS,display:"flex",alignItems:"center",gap:24,flexWrap:"wrap",padding:"16px 22px",marginBottom:14,borderLeft:`4px solid ${K.gold}`}}>
                <div style={{width:84,flexShrink:0,borderRadius:12,overflow:"hidden",textAlign:"center",background:"#FBF6EC",border:`1px solid ${K.goldSoft}`,boxShadow:K.shadowCard}}>
                  <div style={{background:"#B98A3E",color:"#FFFFFF",fontSize:12,fontWeight:700,letterSpacing:1,padding:"5px 0"}}>{monShort}</div>
                  <div style={{...type.pageTitle,fontSize:30,fontWeight:700,color:K.hdrTitle,lineHeight:1.2,paddingTop:4}}>{ed||""}</div>
                  <div style={{fontSize:11,fontWeight:700,color:K.hdrMeta,letterSpacing:.6,paddingBottom:8}}>{dayCap}</div>
                </div>
                <div style={{flex:"1 1 340px",minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <span style={{...type.pageTitle,fontSize:28,fontWeight:700,color:K.hdrTitle,lineHeight:1.15}}>{ev.guest}</span>
                    {isLms&&<span style={{padding:"3px 10px",borderRadius:7,background:"#E6EEFB",color:"#1B5EAB",fontSize:12,fontWeight:700}}>LMS</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,fontSize:14,color:K.textBody}}>
                    <Icon name="building" size={16} strokeWidth={1.8}/>
                    {ev.venue==="Outdoor Catering (ODC)"&&ev.odc_location?<span><b style={{color:C.purple}}>{ev.odc_location}</b>{ev.odc_address?" · "+ev.odc_address:""}</span>:ev.venue}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:18,marginTop:10,flexWrap:"wrap",fontSize:14,color:K.hdrTitle}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:8}}><Icon name="clock" size={17} strokeWidth={1.8}/><b>{ev.time||"TBD"}</b></span>
                    {divider}
                    <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
                      <Icon name="users" size={17} strokeWidth={1.8}/>
                      <span><b>{ev.pax} {T2("pax")}</b><br/><span style={{fontSize:11,color:K.hdrMeta}}>V-{ev.veg||ev.pax} NV:{ev.nonveg||0}</span></span>
                    </span>
                    {divider}
                    <span style={{display:"inline-flex",alignItems:"center",gap:8}}><Icon name="plate" size={17} strokeWidth={1.8}/><b>{describeEventMenu(ev)}</b></span>
                  </div>
                </div>
                <div style={{flex:"1 1 260px",display:"flex",alignItems:"center",gap:26,paddingLeft:24,borderLeft:`1px solid ${K.cardWarmLine}`,minHeight:64}}>
                  <div style={{flex:1,minWidth:180}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{color:"#B98A3E",display:"flex"}}><Icon name="utensils" size={22} strokeWidth={1.8}/></span>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6}}>{T2("Dishes")}</div>
                        <div style={{fontSize:15,fontWeight:700,color:K.hdrTitle}}>{readyDishes}/{totalDishes} {T2("ready")}</div>
                      </div>
                    </div>
                    <div style={{height:7,borderRadius:99,background:"#E9E6DE",marginTop:8,overflow:"hidden"}}>
                      <div style={{height:"100%",width:readyPct+"%",borderRadius:99,background:readyPct===100?K.ok:K.brand,transition:"width .4s"}}/>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,paddingLeft:24,borderLeft:`1px solid ${K.cardWarmLine}`}}>
                    <span style={{color:"#B98A3E",display:"flex"}}><Icon name="truck" size={22} strokeWidth={1.8}/></span>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:K.hdrMeta,textTransform:"uppercase",letterSpacing:.6}}>{T2("Vehicles")}</div>
                      <div style={{fontSize:15,fontWeight:700,color:K.hdrTitle}}>{allVehicles.length} {T2("assigned")}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Dispatch plan — editable by Pushpander / Raj Kumar. Loading
                  itself is tracked on the dish chips below; a tile is the
                  truck's own status (Planning → Loaded → Dispatched → At Venue
                  → Unloaded). ── */}
              <div style={{...cardS,padding:"16px 18px",marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:12,...eyebrow}}><Icon name="truck" size={20} strokeWidth={1.8}/>{T2("Dispatch Plan")}</span>
                  <button onClick={()=>addVehicle(ev.id)} className="kh-hovercard"
                    style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:12,background:K.brand,color:"#FFFFFF",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:K.shadowCard,fontFamily:K.fontBody}}>
                    <Icon name="plus" size={16} strokeWidth={2.2}/>{T2("Add Vehicle")}
                  </button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(380px, 1fr))",gap:16,maxWidth:dispatch.assignments.length<3?900:"none"}}>
                  {dispatch.assignments.map((asgn,ai)=>{
                    const loc=getVehicleLocation(asgn.vehicleId);
                    const loadedCount=loadedRowsFor(ev.id,asgn.vehicleId).length;
                    const done = asgn.status==="Dispatched"||asgn.status==="At Venue"||asgn.status==="Unloaded";
                    const label = nextLabel(asgn.status);
                    const can = canAdvance(asgn);
                    const lbl = {display:"block",fontSize:12,fontWeight:600,color:K.textBody,marginBottom:5};
                    const inp = {width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:`1px solid ${K.cardWarmLine}`,fontSize:13.5,color:K.hdrTitle,background:"#FFFFFF",fontFamily:K.fontBody,outline:"none"};
                    return (
                      <div key={ai} style={{borderRadius:14,background:"#FBFAF6",border:`1px solid ${K.cardWarmLine}`,padding:"14px 14px 12px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                          <span style={{width:32,height:32,borderRadius:"50%",flexShrink:0,background:"#EEF0EA",color:K.hdrTitle,fontSize:13.5,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{ai+1}</span>
                          <span style={{color:K.hdrTitle,display:"flex"}}><Icon name="truck" size={20} strokeWidth={1.8}/></span>
                          <select value={asgn.vehicleId} onChange={e=>{
                            setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,vehicleId:e.target.value})}));
                          }} style={{...inp,flex:1,minWidth:0,width:"auto",fontWeight:600,padding:"8px 10px"}}>
                            {fleetList.map(fv=><option key={fv.id} value={fv.id}>{fv.name}</option>)}
                          </select>
                          <span style={{padding:"7px 16px",borderRadius:8,fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",
                            background:done?K.okBg:asgn.status==="Loaded"?K.warnBg:"#E7EEE5",color:done?K.ok:asgn.status==="Loaded"?K.warn:K.brandText}}>{T2(asgn.status)}</span>
                          <button onClick={()=>{setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.filter((_,i2)=>i2!==ai)}));}} title={T2("Remove")}
                            style={{width:30,height:30,borderRadius:8,flexShrink:0,background:"#FBEDEA",border:"none",color:K.danger,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                            <Icon name="close" size={14} strokeWidth={2.2}/>
                          </button>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:10,marginBottom:10}}>
                          <label><span style={lbl}>{T2("Driver")}</span>
                            <input value={asgn.driver} placeholder={T2("Driver")} onChange={e=>{
                              setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,driver:e.target.value})}));
                            }} style={inp}/></label>
                          <label><span style={lbl}>{T2("Departure time")}</span>
                            <input type="time" value={asgn.dispatchTime} onChange={e=>{updAsgn(ev.id,ai,"dispatchTime",e.target.value);}} style={inp}/></label>
                        </div>
                        <div title={loc.at+(loc.dest?" → "+loc.dest:"")}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:9,background:"#F1EFE9",fontSize:12.5,color:K.textBody,marginBottom:10,overflow:"hidden",whiteSpace:"nowrap"}}>
                          <span style={{color:K.hdrMeta}}>{T2("Route")}</span>
                          <span style={{color:"#B98A3E",display:"flex"}}><Icon name="building" size={14} strokeWidth={1.9}/></span>
                          <span>{loc.at}</span>
                          {loc.dest&&<><span style={{color:K.hdrTitle,fontWeight:700}}>→</span><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{loc.dest}</span></>}
                        </div>
                        {label&&(
                          <button disabled={!can} onClick={()=>advanceStatus(ev.id,ai)} className={can?"kh-hovercard":undefined}
                            style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"11px",borderRadius:10,fontSize:14,fontWeight:700,border:"none",marginBottom:8,
                              cursor:can?"pointer":"not-allowed",background:can?K.brand:"#E9E6DE",color:can?"#FFFFFF":K.textFaint,fontFamily:K.fontBody}}>
                            <Icon name={asgn.status==="Planning"?"box":asgn.status==="Loaded"?"truck":asgn.status==="Dispatched"?"building":"check"} size={17} strokeWidth={1.9}/>
                            {label.replace(/^\S+\s/,"")}
                          </button>
                        )}
                        {asgn.status==="Unloaded"&&<div style={{textAlign:"center",fontSize:13,fontWeight:700,color:K.ok,padding:"8px 0"}}>✓ {T2("Complete")}</div>}
                        {!can&&asgn.status==="Loaded"&&!asgn.driver&&<div style={{fontSize:11.5,color:K.warn,marginBottom:8,fontWeight:600}}>⚠ {T2("Assign a driver first")}</div>}
                        <button onClick={()=>setChallanFor({evId:ev.id,vehicleId:asgn.vehicleId})} className="kh-calnav"
                          style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"10px",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",
                            background:"#FFFFFF",color:K.hdrTitle,border:`1px solid ${K.cardWarmLine}`,fontFamily:K.fontBody}}>
                          <Icon name="fileText" size={17} strokeWidth={1.8}/>{T2("Challan")} ({loadedCount})
                        </button>
                      </div>
                    );
                  })}
                </div>
                {dispatch.assignments.length===0&&<div style={{fontSize:13,color:K.hdrMeta,padding:"8px 0"}}>{T2("No vehicles assigned yet")} — {T2("Add vehicle to start dispatch plan")}</div>}
                <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:K.hdrMeta,marginTop:12}}>
                  <Icon name="note" size={14} strokeWidth={1.8}/>{T2("Editable by")} Pushpander / Raj Kumar
                </div>
              </div>

              {/* ── Ready for Transport — station chips, sourced from the real
                  transportQueue rows Kitchen Hub's "Send to transport" grid
                  writes. Stations auto-collapse once fully delivered. ── */}
              <div style={{...cardS,padding:"16px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:12,...eyebrow}}><Icon name="utensils" size={20} strokeWidth={1.8}/>{T2("Ready for Transport")}</span>
                  <span style={{fontSize:14,fontWeight:700,color:totalDishes>0&&readyDishes===totalDishes?K.ok:K.hdrTitle}}>{readyDishes}/{totalDishes} {T2("ready")}</span>
                </div>

                {stationsMeta.length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:12}}>
                    {stationsMeta.map(st=>{
                      const secKey=ev.id+"_"+st.sec;
                      const open = tdSecOpen[secKey]!==undefined?tdSecOpen[secKey]:!st.allDone;
                      return (
                        <button key={st.sec} onClick={()=>toggleSecOpen(secKey,open)} className="kh-calnav"
                          style={{display:"inline-flex",alignItems:"center",gap:9,padding:"7px 16px",borderRadius:999,cursor:"pointer",fontFamily:K.fontBody,
                            background:st.allDone?K.okBg:"#FFFFFF",border:`1px solid ${st.allDone?K.okBorder:st.sent>0?st.color:K.cardWarmLine}`,
                            fontSize:13,fontWeight:600,color:st.allDone?K.ok:K.textBody}}>
                          <span style={{fontSize:14}}>{st.icon}</span>{st.name} {st.allDone?"✓ ":""}{st.sent}/{st.total}
                        </button>
                      );
                    })}
                  </div>
                )}

                {startedStations.map(st=>{
                  const secKey=ev.id+"_"+st.sec;
                  const open = tdSecOpen[secKey]!==undefined?tdSecOpen[secKey]:!st.allDone;
                  const assignedVeh = st.assignedVehicleId ? (fleetList.find(v=>v.id===st.assignedVehicleId)||{name:st.assignedVehicleId,icon:"🚛"}) : null;
                  const truckPicker = dispatch.assignments.length>0 && (
                    <select value={st.assignedVehicleId} onClick={e=>e.stopPropagation()} onChange={e=>setStationVehicle(st.sec,e.target.value)}
                      style={{marginLeft:"auto",fontSize:12,fontWeight:600,padding:"5px 10px",borderRadius:999,border:`1px solid ${K.cardWarmLine}`,background:"#FFFFFF",color:st.assignedVehicleId?K.hdrTitle:K.hdrMeta,maxWidth:180,fontFamily:K.fontBody}}>
                      <option value="">🚛 {T2("Assign truck")}</option>
                      {dispatch.assignments.map(a=>{
                        const v=fleetList.find(x=>x.id===a.vehicleId)||{name:a.vehicleId,icon:"🚛"};
                        return <option key={a.vehicleId} value={a.vehicleId}>{v.icon} {v.name}</option>;
                      })}
                    </select>
                  );
                  if(!open){
                    return (
                      <div key={st.sec} onClick={()=>toggleSecOpen(secKey,open)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",background:K.okBg,border:`1px solid ${K.okBorder}`,borderRadius:12,marginBottom:8,cursor:"pointer"}}>
                        <span style={{fontSize:13,fontWeight:700,color:K.ok}}>{st.icon} {st.name}</span>
                        <span style={{fontSize:12,color:K.ok}}>{st.sent}/{st.total} {T2("delivered")}</span>
                        {assignedVeh&&<span style={{fontSize:12,color:K.ok,fontWeight:600}}>{assignedVeh.icon} {assignedVeh.name}</span>}
                        <span style={{marginLeft:"auto",fontSize:11.5,color:K.ok}}>▸ {T2("collapsed")}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={st.sec} style={{marginBottom:12,padding:"12px 14px",borderRadius:14,background:"#FBFAF6",border:`1px solid ${K.cardWarmLine}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <div onClick={()=>toggleSecOpen(secKey,open)} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:st.color,flexShrink:0}}/>
                          <span style={{fontSize:13.5,fontWeight:700,color:K.hdrTitle}}>{st.icon} {st.name}</span>
                          <span style={{fontSize:12,color:K.hdrMeta}}>{st.sent}/{st.total} {T2("ready")}</span>
                        </div>
                        {truckPicker}
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                        {st.rows.map(row=>{
                          const shared = sharedRowsFor(row);
                          const isLoaded = row.status==="Loaded";
                          const isDelivered = row.status==="Delivered";
                          const fg = isDelivered?K.ok:isLoaded?"#1B5EAB":K.hdrTitle;
                          const bd = isDelivered?K.okBorder:isLoaded?"#B9CEEC":K.cardWarmLine;
                          const bg = isDelivered?K.okBg:isLoaded?"#EAF1FB":"#FFFFFF";
                          return (
                            <div key={row.id} style={{display:"flex",flexDirection:"column",gap:5}}>
                              <div onClick={()=>cycleRowStatus(row.id)}
                                title={isDelivered?T2("Delivered — tap to reset"):isLoaded?T2("Loaded — tap to mark delivered"):T2("Ready — tap to mark loaded")}
                                style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",background:bg,border:`1px solid ${bd}`,borderRadius:999,padding:"7px 14px",opacity:isDelivered?.75:1}}>
                                {(isLoaded||isDelivered)&&<span style={{display:"flex",color:fg}}><Icon name={isDelivered?"check":"box"} size={13} strokeWidth={2.2}/></span>}
                                <span style={{fontSize:12.5,fontWeight:700,color:fg,textDecoration:isDelivered?"line-through":"none"}}>{row.dish}</span>
                                {row.qty!=null&&<span style={{fontSize:12,color:isDelivered||isLoaded?fg:K.hdrMeta}}>· {row.qty}{row.unit?" "+row.unit:""}</span>}
                                {shared.length>0&&<span style={{padding:"0 6px",borderRadius:999,background:st.color,color:"#fff",fontSize:10,fontWeight:700}}>×{shared.length+1}</span>}
                              </div>
                              {shared.length>0&&(
                                <div style={{marginLeft:10,paddingLeft:12,borderLeft:`2px dashed ${st.color}`}}>
                                  {shared.map(s2=>(
                                    <div key={s2.id} style={{fontSize:11,color:K.hdrMeta,padding:"2px 0"}}>
                                      ↳ {s2.qty!=null?`${s2.qty}${s2.unit||""} `:""}→ <b style={{color:K.hdrTitle}}>{s2.event}</b> · {s2.venue}{s2.status&&s2.status!=="Ready"?` · ${s2.status==="Delivered"?"✓":"📦"}`:""}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {(startedStations.length===0||notStartedStations.length>0)&&(
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",padding:"10px 14px",borderRadius:12,background:"#F1EFE9",fontSize:12.5,color:K.textBody}}>
                    {startedStations.length===0&&(
                      <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
                        <span style={{width:18,height:18,borderRadius:"50%",border:`1.5px solid ${K.hdrMeta}`,color:K.hdrMeta,fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>i</span>
                        {T2("Nothing sent from Kitchen Hub yet — dishes appear here once a station is sent to transport.")}
                      </span>
                    )}
                    {notStartedStations.length>0&&(
                      <span style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:8}}>
                        <span style={{letterSpacing:2}}>{notStartedStations.map(s=>s.icon).join("")}</span>
                        {T2("Still cooking")}: {notStartedStations.slice(0,3).map(s=>s.name).join(", ")}{notStartedStations.length>3?` +${notStartedStations.length-3} ${T2("more")}`:""}
                      </span>
                    )}
                  </div>
                )}

                {ev.special&&(
                  <div style={{marginTop:10,padding:"9px 14px",borderRadius:12,background:K.warnBg,border:`1px solid ${K.warnBorder}`,fontSize:12.5,fontWeight:600,color:K.warn}}>⚠ {ev.special}</div>
                )}
              </div>
            </div>
          );
        }

        return (
          <div>
            {/* ── KPI tiles ── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:18}}>
              {[{i:"truck",n:fleetList.length,l:T2("Vehicles in fleet"),bg:"#E7EEE9",fg:K.brand},
                {i:"calendar",n:safeEvs.length,l:T2("Total events"),bg:"#F6EADB",fg:"#B98A3E"},
                {i:"calendarDays",n:todayEvs.length,l:T2("Today's events"),bg:"#E7EEE9",fg:K.brand},
                {i:"utensils",n:todayDishTotal,l:todayEvs.length===1?T2("Total dishes (this event)"):T2("Total dishes (today)"),bg:"#F6EADB",fg:"#B98A3E"},
                {i:"truck",n:todayVehTotal,l:T2("Vehicles assigned"),bg:"#E7EEE9",fg:K.brand}].map(t=>(
                <div key={t.l} style={{...cardS,borderRadius:16,display:"flex",alignItems:"center",gap:14,padding:"14px 16px"}}>
                  {tileIcon(t.i,t.bg,t.fg,52)}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:22,fontWeight:700,color:K.hdrTitle,lineHeight:1.1,fontVariantNumeric:"tabular-nums"}}>{t.n}</div>
                    <div style={{fontSize:13.5,color:K.textBody,marginTop:2}}>{t.l}</div>
                  </div>
                </div>
              ))}
            </div>

            {safeEvs.length===0&&<div style={{...cardS,textAlign:"center",padding:40,color:K.hdrMeta,fontSize:13}}>{T2("No events loaded")}</div>}
            {todayEvs.map(ev=>renderCard(ev,T2("Today").toUpperCase()))}
            {tomorrowEvs.length>0&&(
              <div style={{display:"flex",alignItems:"center",gap:10,margin:"8px 0 12px"}}>
                <span style={{...eyebrow,color:K.warn}}>{T2("Tomorrow")}</span>
                <span style={{flex:1,height:1,background:K.cardWarmLine}}/>
              </div>
            )}
            {tomorrowEvs.map(ev=>renderCard(ev,T2("Tomorrow").toUpperCase()))}
          </div>
        );
      })()}

      {/* ── DELIVERY CHALLAN — builds itself from whatever's been tapped past
          "Ready" on this truck, so there's no separate manifest to keep in
          sync by hand. ── */}
      {challanFor&&(()=>{
        const ev=safeEvs.find(e=>e.id===challanFor.evId);
        if(!ev) return null;
        const veh=fleetList.find(v=>v.id===challanFor.vehicleId)||{name:challanFor.vehicleId,icon:"🚛"};
        const asgn=(dispatches.find(d=>d.evId===ev.id)?.assignments||[]).find(a=>a.vehicleId===challanFor.vehicleId)||{};
        const rows=loadedRowsFor(ev.id,challanFor.vehicleId);
        const now=new Date();
        const nowStr=now.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setChallanFor(null)}>
            <style>{"@media print { body * { visibility: hidden; } .td-challan, .td-challan * { visibility: visible; } .td-challan { position: fixed !important; inset: 0 !important; margin: 0 !important; max-height: none !important; box-shadow: none !important; } .td-challan-hide { display: none !important; } }"}</style>
            <div className="td-challan" onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,width:460,maxWidth:"100%",maxHeight:"90vh",overflow:"auto",padding:"22px 24px",color:"#1a1a1a"}}>
              <div className="td-challan-hide" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:15,fontWeight:700}}>📄 {T2("Delivery Challan")}</div>
                <button onClick={()=>setChallanFor(null)} style={{background:"none",border:"none",fontSize:18,color:"#888",cursor:"pointer"}}>✕</button>
              </div>

              <div style={{textAlign:"center",marginBottom:14,borderBottom:"2px solid #1a1a1a",paddingBottom:10}}>
                <div style={{fontSize:16,fontWeight:700}}>Ambria Cuisines</div>
                <div style={{fontSize:11,color:"#666"}}>Get Your Venue Events Pvt Ltd</div>
                <div style={{fontSize:13,fontWeight:700,marginTop:6,letterSpacing:1}}>DELIVERY CHALLAN</div>
              </div>

              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:12}}>
                <div>
                  <div><b>{T2("Event")}:</b> {ev.guest}</div>
                  <div><b>{T2("Venue")}:</b> {ev.venue}</div>
                  <div><b>{T2("Date")}:</b> {ev.date} · {ev.time}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div><b>{T2("Vehicle")}:</b> {veh.icon} {veh.name}</div>
                  <div><b>{T2("Driver")}:</b> {asgn.driver||"—"}</div>
                  <div><b>{T2("Printed")}:</b> {nowStr}</div>
                </div>
              </div>

              {rows.length===0?(
                <div style={{textAlign:"center",padding:"20px 0",color:"#888",fontSize:12}}>{T2("Nothing loaded onto this vehicle yet")}</div>
              ):(
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:10}}>
                  <thead>
                    <tr style={{borderBottom:"1.5px solid #1a1a1a"}}>
                      <th style={{textAlign:"left",padding:"5px 4px",width:26}}>#</th>
                      <th style={{textAlign:"left",padding:"5px 4px"}}>{T2("Dish")}</th>
                      <th style={{textAlign:"right",padding:"5px 4px"}}>{T2("Qty")}</th>
                      <th style={{textAlign:"right",padding:"5px 4px"}}>{T2("Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=>(
                      <tr key={r.id} style={{borderBottom:"1px solid #ddd"}}>
                        <td style={{padding:"5px 4px",color:"#888"}}>{i+1}</td>
                        <td style={{padding:"5px 4px",fontWeight:600}}>{r.dish}</td>
                        <td style={{padding:"5px 4px",textAlign:"right"}}>{r.qty!=null?`${r.qty}${r.unit?" "+r.unit:""}`:"—"}</td>
                        <td style={{padding:"5px 4px",textAlign:"right",color:r.status==="Delivered"?"#2B8A50":"#185FA5"}}>{r.status==="Delivered"?"✓ "+T2("Delivered"):"📦 "+T2("Loaded")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{fontSize:11,color:"#444",marginBottom:18}}>{T2("Total items")}: {rows.length}</div>

              <div style={{display:"flex",justifyContent:"space-between",gap:20,marginTop:30,fontSize:11}}>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{borderTop:"1px solid #888",paddingTop:4}}>{T2("Handed over by")}</div>
                </div>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{borderTop:"1px solid #888",paddingTop:4}}>{T2("Received by")}</div>
                </div>
              </div>

              <div className="td-challan-hide" style={{display:"flex",gap:8,marginTop:20}}>
                <button onClick={()=>window.print()} style={{flex:1,padding:"10px",borderRadius:8,background:C.wine,color:"#fff",border:"none",fontWeight:700,cursor:"pointer"}}>🖨 {T2("Print")}</button>
                <button onClick={()=>setChallanFor(null)} style={{flex:1,padding:"10px",borderRadius:8,background:"#eee",border:"none",fontWeight:700,cursor:"pointer",color:"#333"}}>{T2("Close")}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── FLEET MANAGEMENT TAB ── */}
      {activeTab==="fleet"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🚛 {T2("Fleet Management")}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{fleetList.length} {T2("vehicles")}, {fleetList.filter(v=>{var loc=getVehicleLocation(v.id);return loc.status!=="At Base";}).length} {T2("active today")}</div>
            </div>
            {isAdmin&&<button onClick={()=>{setVehForm({id:"",name:"",icon:"🚛",type:"dry",note:"",base_location:"AP Kitchen"});setEditVehId(null);setShowAddVeh(true);}} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:36}}>+ {T2("Add Vehicle")}</button>}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
            {fleetList.map(veh=>{
              var loc=getVehicleLocation(veh.id);
              var borderColor=loc.color||"#888";
              return(
                <div key={veh.id} style={{background:C.surface,borderRadius:10,padding:"12px 14px",borderLeft:`3px solid ${borderColor}`,border:`1px solid ${C.border}`,borderLeftWidth:3,borderLeftColor:borderColor}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{veh.icon} {veh.name}</div>
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:loc.status==="At Venue"?C.greenBg:loc.status==="En Route"?"#E6F1FB":loc.status==="Loaded"||loc.status==="Planning"?C.amberBg:C.bg,
                      color:loc.status==="At Venue"?C.green:loc.status==="En Route"?"#185FA5":loc.status==="Loaded"||loc.status==="Planning"?C.amber:C.muted,fontWeight:600}}>{loc.status}</span>
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>{veh.type==="cold"?"❄ Refrigerated":veh.type==="quick"?"⚡ Quick delivery":"📦 Dry goods"}{veh.note?" · "+veh.note:""}</div>
                  <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                    {loc.driver&&<span style={{fontSize:11,color:C.muted}}>👤 {loc.driver}</span>}
                    <span style={{fontSize:11,color:C.muted}}>📍 {loc.at}</span>
                    {loc.dest&&<><span style={{fontSize:11,color:C.faint}}>→</span><span style={{fontSize:11,color:C.muted}}>🎯 {loc.dest}</span></>}
                    {loc.time&&<span style={{fontSize:11,color:C.muted}}>🕐 {loc.time}</span>}
                  </div>
                  {isAdmin&&<div style={{display:"flex",gap:6,marginTop:8}}>
                    <button onClick={()=>{setVehForm({id:veh.id,name:veh.name,icon:veh.icon||"🚛",type:veh.type||"dry",note:veh.note||"",base_location:veh.base_location||"AP Kitchen"});setEditVehId(veh.id);setShowAddVeh(true);}}
                      style={{padding:"4px 10px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer"}}>✏ {T2("Edit")}</button>
                    <button onClick={()=>{if(confirm(T2("Delete")+' '+veh.name+'?'))deleteVehicle(veh.id);}}
                      style={{padding:"4px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,cursor:"pointer"}}>🗑</button>
                  </div>}
                </div>
              );
            })}
          </div>

          {/* ── Add/Edit Vehicle Modal ── */}
          {showAddVeh&&(
            <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setShowAddVeh(false)}>
              <div style={{background:C.surface,borderRadius:14,padding:"20px 24px",width:340,maxWidth:"90vw",border:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.text}}>{editVehId?T2("Edit Vehicle"):T2("Add Vehicle")}</div>
                  <button onClick={()=>setShowAddVeh(false)} style={{background:"none",border:"none",fontSize:18,color:C.muted,cursor:"pointer"}}>✕</button>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>{T2("Registration / Name")}</div>
                  <input value={vehForm.name} onChange={e=>setVehForm(p=>({...p,name:e.target.value}))} placeholder="DL1LAB 1234"
                    style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,boxSizing:"border-box"}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>{T2("Type")}</div>
                    <select value={vehForm.type} onChange={e=>setVehForm(p=>({...p,type:e.target.value}))}
                      style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg}}>
                      <option value="dry">📦 Dry goods</option>
                      <option value="cold">❄ Refrigerated</option>
                      <option value="quick">⚡ Quick delivery</option>
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>{T2("Base Location")}</div>
                    <select value={vehForm.base_location} onChange={e=>setVehForm(p=>({...p,base_location:e.target.value}))}
                      style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg}}>
                      <option value="AP Kitchen">AP Kitchen</option>
                      <option value="AE Kitchen">AE Kitchen</option>
                      <option value="Manaktala">Manaktala</option>
                      <option value="Restro">Restro</option>
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>{T2("Notes")}</div>
                  <input value={vehForm.note} onChange={e=>setVehForm(p=>({...p,note:e.target.value}))} placeholder="e.g. 500kg capacity, AC not working"
                    style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,boxSizing:"border-box"}}/>
                </div>
                <button onClick={saveVehicle} style={{width:"100%",padding:"12px",borderRadius:10,background:C.green,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>
                  {editVehId?"✏ "+T2("Update Vehicle"):"✅ "+T2("Save Vehicle")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}


export { TransportDispatch };
