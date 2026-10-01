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

  const TABS=[{v:"todayplan",l:`📋 ${T2("Today's Plan")}`},{v:"fleet",l:`🚛 ${T2("Fleet")}`}];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🚛 Transport & Dispatch</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>Fleet: {fleetList.length} vehicles · {safeEvs.length} events</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {[{c:"#1B5EAB",l:"En Route"},{c:"#2B8A50",l:T2("At Venue")},{c:"#888",l:"At Base"}].map(s=>(
            <div key={s.l} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"transparent",borderRadius:20,border:`1px solid ${s.c}40`}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:s.c}}/><span style={{fontSize:10,color:s.c,fontWeight:600}}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ODC MENU NOT CONFIRMED WARNING ── */}
      {(()=>{
        const odcUnconfirmed = safeEvs.filter(ev=>ev.venue==="Outdoor Catering (ODC)"&&!ev.odc_menu_confirmed&&(ev.date===TODAY||ev.date===TOMORROW));
        if(odcUnconfirmed.length===0) return null;
        return(
          <div style={{marginBottom:12}}>
            {odcUnconfirmed.map(ev=>(
              <div key={"odc-t-"+ev.id} style={{marginBottom:6,padding:"10px 14px",borderRadius:10,background:C.amberBg,border:`1.5px solid ${C.amberBorder}`,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16,flexShrink:0}}>🏕</span>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:C.amber}}>ODC menu not confirmed — {ev.guest}</div>
                  <div style={{fontSize:11,color:C.muted}}>{ev.odc_location||"Location TBD"} · {ev.date} · {ev.pax} pax — Dispatch manifest may be inaccurate</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{display:"flex",gap:6,marginBottom:14,borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
        {TABS.map(t=>(
          <button key={t.v} onClick={()=>setActiveTab(t.v)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",background:activeTab===t.v?C.wine:"transparent",color:activeTab===t.v?"#fff":C.muted,border:`1.5px solid ${activeTab===t.v?C.wine:C.border}`}}>{t.l}</button>
        ))}
      </div>

      {activeTab==="todayplan"&&(()=>{
        const todayEvs = safeEvs.filter(e=>e.date===TODAY).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        const tomorrowEvs = safeEvs.filter(e=>e.date===TOMORROW).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        const laterEvs = safeEvs.filter(e=>e.date>TOMORROW).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
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

        function renderCard(ev, showDate){
          const p = gp(ev.venue);
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
            return {sec, color:catObj?.color||C.muted, icon:catObj?.icon||"🍽", name:T2(catObj?.name||sec), rows, total, sent, allDone, started: rows.length>0};
          });
          const startedStations = stationsMeta.filter(s=>s.started);
          const notStartedStations = stationsMeta.filter(s=>!s.started);
          const totalDishes = stationsMeta.reduce((n,s)=>n+s.total,0);
          const readyDishes = stationsMeta.reduce((n,s)=>n+s.sent,0);
          const readyPct = safePct(readyDishes,totalDishes);
          function toggleSecOpen(secKey, currentOpen){ setTdSecOpen(p=>({...p,[secKey]:!currentOpen})); }

          return (
            <Card style={{marginBottom:14,padding:0,overflow:"hidden",border:`2px solid ${p.c}18`}}>
              {/* Header */}
              <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,background:p.bg}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:20,background:p.c,color:"#fff"}}>{p.code}</span>
                      <span style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{ev.guest}</span>
                    </div>
                    <div style={{fontSize:11,color:C.muted}}>{ev.venue==="Outdoor Catering (ODC)"&&ev.odc_location?<span><span style={{fontWeight:600,color:C.purple}}>🏕 {ev.odc_location}</span>{ev.odc_address?" · "+ev.odc_address:""}</span>:ev.venue} · {ev.type}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:700,color:p.c}}>{ev.time}</div>
                    {showDate&&<div style={{fontSize:12,color:C.muted}}>{ev.date}</div>}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
                  {[
                    {icon:"👥",label:"Pax",value:ev.pax,sub:`V:${ev.veg||ev.pax} NV:${ev.nonveg||0}`},
                    {icon:"📜",label:"Package",value:describeEventMenu(ev)},
                    {icon:"🍽",label:"Dishes",value:`${readyDishes}/${totalDishes} ready`,pct:readyPct},
                    {icon:"🚛",label:"Vehicles",value:`${allVehicles.length} assigned`},
                  ].map((s,i)=>(
                    <div key={i} style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"6px 10px",minWidth:100,flex:"1 1 100px"}}>
                      <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{s.icon} {s.label}</div>
                      <div style={{fontSize:12,fontWeight:700,color:C.text}}>{s.value}</div>
                      {s.sub&&<div style={{fontSize:11,color:C.muted}}>{s.sub}</div>}
                      {s.pct!==undefined&&(
                        <div style={{height:5,background:C.border,borderRadius:2,marginTop:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${s.pct}%`,background:s.pct===100?C.green:s.pct>50?C.amber:C.red,borderRadius:2,transition:"width .4s"}}/>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispatch Plan — editable by Pushpander / Raj Kumar. Compact
                  tiles, 3 to a row — loading/unloading itself is tracked on
                  the dish chips below, so a tile only needs the truck's own
                  status (Planning → Loaded → Dispatched → At Venue → Unloaded). */}
              <div style={{padding:"10px 18px",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>🚛 {T2("Dispatch Plan")}</div>
                  <button onClick={()=>addVehicle(ev.id)} style={{padding:"5px 12px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:32}}>+ {T2("Add Vehicle")}</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(230px, 1fr))",gap:8}}>
                  {dispatch.assignments.map((asgn,ai)=>{
                    const v=fleetList.find(x=>x.id===asgn.vehicleId)||{name:asgn.vehicleId,icon:"🚛",type:"dry"};
                    const sc=asgn.status==="Dispatched"||asgn.status==="At Venue"||asgn.status==="Unloaded"?C.green:asgn.status==="Loaded"?C.amber:C.muted;
                    const loc=getVehicleLocation(asgn.vehicleId);
                    return (
                      <div key={ai} style={{background:C.bg,borderRadius:10,padding:"8px 10px",border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:5}}>
                        <div style={{display:"flex",gap:5,alignItems:"center"}}>
                          <span style={{fontSize:13,flexShrink:0}}>{v.icon}</span>
                          <select value={asgn.vehicleId} onChange={e=>{
                            setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,vehicleId:e.target.value})}));
                          }} style={{flex:1,minWidth:0,padding:"4px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,background:C.surface,color:C.text,minHeight:26}}>
                            {fleetList.map(fv=><option key={fv.id} value={fv.id}>{fv.name}</option>)}
                          </select>
                          <span style={{fontSize:9.5,fontWeight:700,color:sc,padding:"2px 6px",borderRadius:6,background:sc+"15",whiteSpace:"nowrap",flexShrink:0}}>{asgn.status}</span>
                          <button onClick={()=>{setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.filter((_,i2)=>i2!==ai)}));}} style={{padding:"3px 6px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:10,cursor:"pointer",flexShrink:0}}>✕</button>
                        </div>
                        <div style={{display:"flex",gap:5}}>
                          <input value={asgn.driver} placeholder={T2("Driver")} onChange={e=>{
                            setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,driver:e.target.value})}));
                          }} style={{flex:1,minWidth:0,padding:"4px 6px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,background:C.surface,color:C.text,minHeight:26}}/>
                          <input type="time" value={asgn.dispatchTime} onChange={e=>{updAsgn(ev.id,ai,"dispatchTime",e.target.value);}} style={{width:70,padding:"4px 4px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,background:C.surface,color:C.text,minHeight:26}}/>
                        </div>
                        <div style={{fontSize:10,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={loc.at+(loc.dest?" → "+loc.dest:"")}>
                          🏠 {loc.at}{loc.dest?" → 📍 "+loc.dest:""}
                        </div>
                        {nextLabel(asgn.status)&&(
                          <button disabled={!canAdvance(asgn)} onClick={()=>advanceStatus(ev.id,ai)}
                            style={{padding:"5px 8px",borderRadius:6,fontSize:10.5,fontWeight:700,cursor:canAdvance(asgn)?"pointer":"not-allowed",border:"none",minHeight:28,
                              background:canAdvance(asgn)?(asgn.status==="Loaded"?C.green:asgn.status==="At Venue"?C.green:C.amber):(C.border),
                              color:canAdvance(asgn)?"#fff":C.faint}}>
                            {nextLabel(asgn.status)}
                          </button>
                        )}
                        {asgn.status==="Unloaded"&&<span style={{fontSize:11,fontWeight:700,color:C.green,textAlign:"center"}}>✅ {T2("Complete")}</span>}
                        {!canAdvance(asgn)&&asgn.status==="Loaded"&&!asgn.driver&&<div style={{fontSize:9.5,color:C.amber}}>⚠ {T2("Assign a driver first")}</div>}
                      </div>
                    );
                  })}
                </div>
                {dispatch.assignments.length===0&&<div style={{fontSize:12,color:C.faint,padding:"8px 0"}}>🚛 {T2("No vehicles assigned yet")} — {T2("Add vehicle to start dispatch plan")}</div>}
                <div style={{fontSize:10,color:C.muted,marginTop:4}}>✏ {T2("Editable by")} Pushpander / Raj Kumar</div>
              </div>

              {/* Ready for Transport — station chips, sourced from the real
                  transportQueue rows Kitchen Hub's "Send to transport" grid
                  writes (per-function qty split included), not a separate
                  local toggle. Stations auto-collapse once fully picked up,
                  and the index strip lets you jump straight to one, so a
                  200+ dish menu never shows more than a screenful at once. */}
              <div style={{padding:"10px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>🍳 {T2("Ready for Transport")}</span>
                  <span style={{fontSize:11,fontWeight:700,color:totalDishes>0&&readyDishes===totalDishes?C.green:C.muted}}>{readyDishes}/{totalDishes} {T2("ready")}</span>
                </div>

                {stationsMeta.length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                    {stationsMeta.map(st=>{
                      const secKey=ev.id+"_"+st.sec;
                      const open = tdSecOpen[secKey]!==undefined?tdSecOpen[secKey]:!st.allDone;
                      return (
                        <button key={st.sec} onClick={()=>toggleSecOpen(secKey,open)}
                          style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:14,cursor:"pointer",border:"none",
                            background:st.allDone?C.greenBg:st.sent>0?st.color+"18":C.bg,
                            outline:`1.5px solid ${st.allDone?C.greenBorder:st.sent>0?st.color:C.border}`,
                            fontSize:10.5,fontWeight:700,color:st.allDone?C.green:st.sent>0?st.color:C.faint}}>
                          {st.icon} {st.name} {st.allDone?"✓ ":""}{st.sent}/{st.total}
                        </button>
                      );
                    })}
                  </div>
                )}

                {startedStations.length===0&&(
                  <div style={{fontSize:12,color:C.faint,padding:"6px 0"}}>{T2("Nothing sent from Kitchen Hub yet — dishes appear here once a station is sent to transport")}</div>
                )}

                {startedStations.map(st=>{
                  const secKey=ev.id+"_"+st.sec;
                  const open = tdSecOpen[secKey]!==undefined?tdSecOpen[secKey]:!st.allDone;
                  if(!open){
                    return (
                      <div key={st.sec} onClick={()=>toggleSecOpen(secKey,open)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.greenBg,borderRadius:10,marginBottom:6,cursor:"pointer"}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:C.green,flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:C.green}}>{st.icon} {st.name}</span>
                        <span style={{fontSize:11,color:C.green}}>{st.sent}/{st.total} {T2("delivered")}</span>
                        <span style={{marginLeft:"auto",fontSize:10,color:C.green}}>▸ {T2("collapsed")}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={st.sec} style={{marginBottom:12}}>
                      <div onClick={()=>toggleSecOpen(secKey,open)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,cursor:"pointer"}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:st.color,flexShrink:0}}/>
                        <span style={{fontSize:12.5,fontWeight:700,color:st.color}}>{st.icon} {st.name}</span>
                        <span style={{fontSize:11,color:C.muted}}>{st.sent}/{st.total} {T2("ready")}</span>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:7,paddingLeft:16}}>
                        {st.rows.map(row=>{
                          const shared = sharedRowsFor(row);
                          const isLoaded = row.status==="Loaded";
                          const isDelivered = row.status==="Delivered";
                          const chipColor = isDelivered?C.green:isLoaded?"#5B8FD0":st.color;
                          const chipBg = isDelivered?C.greenBg:isLoaded?"#EAF1FB":"#fff";
                          return (
                            <div key={row.id} style={{display:"flex",flexDirection:"column",gap:5}}>
                              <div onClick={()=>cycleRowStatus(row.id)}
                                title={isDelivered?T2("Delivered — tap to reset"):isLoaded?T2("Loaded — tap to mark delivered"):T2("Ready — tap to mark loaded")}
                                style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                                  background:chipBg, border:`1.5px solid ${chipColor}`,
                                  borderRadius:20,padding:"7px 13px",opacity:isDelivered?.7:1}}>
                                {(isLoaded||isDelivered)&&<span style={{width:15,height:15,borderRadius:"50%",background:chipColor,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isDelivered?"✓":"📦"}</span>}
                                <span style={{fontSize:12,fontWeight:700,color:isDelivered?C.green:isLoaded?"#2A5D9E":C.text,textDecoration:isDelivered?"line-through":"none"}}>{row.dish}</span>
                                {row.qty!=null&&<span style={{fontSize:11,color:isDelivered?C.green:isLoaded?"#2A5D9E":C.muted}}>· {row.qty}{row.unit?" "+row.unit:""}</span>}
                                {shared.length>0&&<span style={{width:16,height:16,borderRadius:"50%",background:st.color,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×{shared.length+1}</span>}
                              </div>
                              {shared.length>0&&(
                                <div style={{marginLeft:10,paddingLeft:12,borderLeft:`2px dashed ${st.color}`}}>
                                  {shared.map(s2=>(
                                    <div key={s2.id} style={{fontSize:10.5,color:C.muted,padding:"2px 0"}}>
                                      ↳ {s2.qty!=null?`${s2.qty}${s2.unit||""} `:""}→ <b style={{color:st.color}}>{s2.event}</b> · {s2.venue}{s2.status&&s2.status!=="Ready"?` · ${s2.status==="Delivered"?"✓":"📦"}`:""}
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

                {notStartedStations.length>0&&(
                  <div style={{fontSize:11,color:C.faint,padding:"6px 2px"}}>
                    {notStartedStations.map(s=>s.icon).join(" ")} {T2("Still cooking")}: {notStartedStations.slice(0,3).map(s=>s.name).join(", ")}{notStartedStations.length>3?` +${notStartedStations.length-3} ${T2("more")}`:""}
                  </div>
                )}
              </div>

              {/* Special instructions */}
              {ev.special&&(
                <div style={{padding:"8px 18px 12px",borderTop:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.amber}}>⚠ {ev.special}</div>
                </div>
              )}

            </Card>
          );
        }

        return (
          <div>
            {safeEvs.length===0&&<div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,color:C.muted,fontSize:13}}>{T2("No events loaded")}</div>}
            {todayEvs.length>0&&(
              <div style={{marginBottom:8,fontSize:11,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:0.8}}>🔴 {T2("Today")}</div>
            )}
            {todayEvs.map(ev=>renderCard(ev,false))}
            {tomorrowEvs.length>0&&(
              <div style={{margin:"14px 0 8px",fontSize:11,fontWeight:700,color:C.amber,textTransform:"uppercase",letterSpacing:0.8}}>🟡 {T2("Tomorrow")}</div>
            )}
            {tomorrowEvs.map(ev=>renderCard(ev,false))}
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
