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

// Module-level caches — persist across component remounts (tab switching), reduce first-open latency dramatically
const _DISH_META_CACHE = new Map();
const _COLD_LOWER = COLD_ITEMS.map(function(ci){return ci.toLowerCase();});
function _getDishMeta(name){
  if(!name) return {catId:null, cold:false};
  if(_DISH_META_CACHE.has(name)) return _DISH_META_CACHE.get(name);
  const nl = String(name).toLowerCase();
  const meta = {
    catId: getCatIdForDish(name),
    cold: _COLD_LOWER.some(function(ci){return nl.includes(ci);}),
  };
  _DISH_META_CACHE.set(name, meta);
  return meta;
}

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

  function buildChecklist(ev, vehicleId) {
    const v = VEHICLES.find(x=>x.id===vehicleId);
    const menuItems = menuArr(ev).map(name=>{
      const meta = _getDishMeta(name);
      return {
        id:`${name}-menu`.replace(/\s+/g,"-"), name, category:"🍽 Food",
        source: ["sweets","chaat","chaat_master"].includes(meta.catId)?"AE Kitchen":"AP Kitchen",
        cold: meta.cold, checked:false,
      };
    });
    if(v?.type==="cold") return [...menuItems.filter(i=>i.cold),{id:"dairy-cold",name:"Dairy & cold items",category:"❄ Cold",source:"AE Kitchen",cold:true,checked:false}];
    if(v?.type==="dry")  return [...menuItems.filter(i=>!i.cold),
      {id:"chafing",name:"Chafing dishes + stands",category:"🔧 Equipment",source:"AP Kitchen",cold:false,checked:false},
      {id:"fuel",   name:"Fuel cans / sterno",      category:"🔧 Equipment",source:"AP Kitchen",cold:false,checked:false},
      {id:"crockery",name:"Crockery & cutlery",     category:"🍽 Crockery", source:"AP Kitchen",cold:false,checked:false},
    ];
    return menuItems;
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

  function makeManifest(ev,vid){
    const menu=menuArr(ev);
    const v=VEHICLES.find(x=>x.id===vid);
    if(v?.type==="cold") return menu.filter(d=>_getDishMeta(d).cold);
    return menu.filter(d=>!_getDishMeta(d).cold);
  }

  const initDispatches = () => safeEvs.map(ev=>({
    evId:ev.id, evGuest:ev.guest, evDate:ev.date, evTime:ev.time, evVenue:ev.venue, menu:menuArr(ev),
    assignments: autoVehicles(ev).map(vid=>{
      // Build checklist ONCE per (ev,vid), clone for unloading — the previous code called buildChecklist twice, doubling the fuzzy-match cost
      const loading = buildChecklist(ev,vid);
      return {
        vehicleId:vid, driver:"", dispatchTime:calcDispatch(ev.time), status:T2("Planning"),
        manifest:makeManifest(ev,vid), loadingList:loading,
        unloadingList:loading.map(i=>({...i,id:"u-"+i.id,checked:false})),
      };
    }),
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
  function toggleCheck(evId,ai,key,idx){setDispatches(p=>p.map(d=>d.evId!==evId?d:{...d,assignments:d.assignments.map((a,i)=>i!==ai?a:{...a,[key]:a[key].map((item,j)=>j!==idx?item:{...item,checked:!item.checked})})}));}
  function addVehicle(evId){
    const ev=safeEvs.find(e=>e.id===evId);
    const used=new Set((dispatches.find(d=>d.evId===evId)?.assignments||[]).map(a=>a.vehicleId));
    const vid=(VEHICLES.find(v=>!used.has(v.id))||VEHICLES[0])?.id;
    if(!vid) return;
    setDispatches(p=>p.map(d=>d.evId!==evId?d:{...d,assignments:[...d.assignments,{vehicleId:vid,driver:"",dispatchTime:calcDispatch(ev?.time||""),status:T2("Planning"),manifest:makeManifest(ev||{},vid),loadingList:buildChecklist(ev||{},vid),unloadingList:buildChecklist(ev||{},vid).map(i=>({...i,id:"u-"+i.id,checked:false}))}]}));
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
    if(asgn.status==="Planning"){return asgn.loadingList.length>0&&asgn.loadingList.every(i=>i.checked);}
    if(asgn.status==="Loaded"){return !!asgn.driver;}
    if(asgn.status==="Dispatched"){return true;}
    if(asgn.status==="At Venue"){return asgn.unloadingList.length>0&&asgn.unloadingList.every(i=>i.checked);}
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
        var src = (a.loadingList || []).find(l => l.source)?.source || "AP Kitchen";
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
    "Manaktala Farm":    {code:"AM",c:"#B05A10",bg:"#1A1610"},
    "Ambria Restro":     {code:"AR",c:"#0F6E56",bg:"#0E1E1A"},
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
        // Toggle a dish's pickup status. Chips read/write the real
        // transportQueue rows Kitchen Hub's "Send to transport" grid already
        // creates — the single source of truth for "is this dish ready and
        // has it been picked up", instead of a separate never-saved toggle.
        function togglePickedUp(rowId){
          if(!setTransportQueue) return;
          const now=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
          setTransportQueue(prev=>prev.map(r=>{
            if(r.id!==rowId) return r;
            const nowPicked = r.status!=="Picked Up";
            return {...r, status:nowPicked?"Picked Up":"Ready", pickedUpAt:nowPicked?now:undefined};
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
            const pickedUpAll = rows.length>0 && rows.every(r=>r.status==="Picked Up");
            const allDone = sent>0 && sent>=total && pickedUpAll;
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

              {/* Dispatch Plan — editable by Pushpander / Raj Kumar */}
              <div style={{padding:"10px 18px",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>🚛 {T2("Dispatch Plan")}</div>
                  <button onClick={()=>addVehicle(ev.id)} style={{padding:"5px 12px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:32}}>+ {T2("Add Vehicle")}</button>
                </div>
                {dispatch.assignments.map((asgn,ai)=>{
                  const v=fleetList.find(x=>x.id===asgn.vehicleId)||{name:asgn.vehicleId,icon:"🚛",type:"dry"};
                  const loadDone=asgn.loadingList.filter(i=>i.checked).length;
                  const loadTot=asgn.loadingList.length;
                  const sc=asgn.status==="Dispatched"||asgn.status==="At Venue"?C.green:asgn.status==="Loaded"?C.amber:C.muted;
                  const loc=getVehicleLocation(asgn.vehicleId);
                  return (
                    <div key={ai} style={{background:C.bg,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,marginBottom:6}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:16}}>{v.icon}</span>
                        <select value={asgn.vehicleId} onChange={e=>{
                          setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,vehicleId:e.target.value})}));
                        }} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36,minWidth:140}}>
                          {fleetList.map(fv=><option key={fv.id} value={fv.id}>{fv.icon} {fv.name}</option>)}
                        </select>
                        <input value={asgn.driver} placeholder={T2("Driver")} onChange={e=>{
                          setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,driver:e.target.value})}));
                        }} style={{width:120,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}/>
                        <input type="time" value={asgn.dispatchTime} onChange={e=>{updAsgn(ev.id,ai,"dispatchTime",e.target.value);}} style={{width:90,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}/>
                        <button onClick={()=>{setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.filter((_,i2)=>i2!==ai)}));}} style={{padding:"6px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,cursor:"pointer",minHeight:32}}>✕</button>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,fontWeight:700,color:sc,padding:"2px 8px",borderRadius:8,background:sc+"15"}}>{asgn.status}</span>
                        <span style={{fontSize:11,color:C.muted}}>🏠 {loc.at}</span>
                        {loc.dest&&<><span style={{fontSize:11,color:C.faint}}>→</span><span style={{fontSize:11,color:C.muted}}>📍 {loc.dest}</span></>}
                        <span style={{fontSize:11,color:C.muted,marginLeft:"auto"}}>{loadDone}/{loadTot} {T2("loaded")}</span>
                        {asgn.dispatchedAt&&<span style={{fontSize:10,color:C.muted}}>🚛 {asgn.dispatchedAt}</span>}
                        {asgn.arrivedAt&&<span style={{fontSize:10,color:C.muted}}>📍 {asgn.arrivedAt}</span>}
                        {asgn.unloadedAt&&<span style={{fontSize:10,color:C.green}}>✅ {asgn.unloadedAt}</span>}
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6}}>
                        {nextLabel(asgn.status)&&(
                          <button disabled={!canAdvance(asgn)} onClick={()=>advanceStatus(ev.id,ai)}
                            style={{marginLeft:"auto",padding:"6px 14px",borderRadius:8,fontSize:11,fontWeight:700,cursor:canAdvance(asgn)?"pointer":"not-allowed",border:"none",minHeight:32,
                              background:canAdvance(asgn)?(asgn.status==="Loaded"?C.green:asgn.status==="At Venue"?C.green:C.amber):(C.border),
                              color:canAdvance(asgn)?"#fff":C.faint}}>
                            {nextLabel(asgn.status)}
                          </button>
                        )}
                        {asgn.status==="Unloaded"&&<span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:C.green}}>✅ Complete</span>}
                      </div>
                      {!canAdvance(asgn)&&asgn.status==="Planning"&&<div style={{fontSize:10,color:C.amber,marginTop:4}}>⚠ Check all loading items to enable "Mark Loaded"</div>}
                      {!canAdvance(asgn)&&asgn.status==="Loaded"&&!asgn.driver&&<div style={{fontSize:10,color:C.amber,marginTop:4}}>⚠ Assign a driver to enable dispatch</div>}
                    </div>
                  );
                })}
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
                        <span style={{fontSize:11,color:C.green}}>{st.sent}/{st.total} {T2("picked up")}</span>
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
                          const isPicked = row.status==="Picked Up";
                          return (
                            <div key={row.id} style={{display:"flex",flexDirection:"column",gap:5}}>
                              <div onClick={()=>togglePickedUp(row.id)}
                                style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                                  background:isPicked?C.greenBg:"#fff",
                                  border:`1.5px solid ${isPicked?C.greenBorder:st.color}`,
                                  borderRadius:20,padding:"7px 13px",opacity:isPicked?.7:1}}>
                                {isPicked&&<span style={{width:15,height:15,borderRadius:"50%",background:C.green,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✓</span>}
                                <span style={{fontSize:12,fontWeight:700,color:isPicked?C.green:C.text,textDecoration:isPicked?"line-through":"none"}}>{row.dish}</span>
                                {row.qty!=null&&<span style={{fontSize:11,color:isPicked?C.green:C.muted}}>· {row.qty}{row.unit?" "+row.unit:""}</span>}
                                {shared.length>0&&<span style={{width:16,height:16,borderRadius:"50%",background:st.color,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×{shared.length+1}</span>}
                              </div>
                              {shared.length>0&&(
                                <div style={{marginLeft:10,paddingLeft:12,borderLeft:`2px dashed ${st.color}`}}>
                                  {shared.map(s2=>(
                                    <div key={s2.id} style={{fontSize:10.5,color:C.muted,padding:"2px 0"}}>
                                      ↳ {s2.qty!=null?`${s2.qty}${s2.unit||""} `:""}→ <b style={{color:st.color}}>{s2.event}</b> · {s2.venue}{s2.status==="Picked Up"?" · ✓":""}
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

              {/* Loading / Unloading Checklist */}
              {(()=>{
                const loadKey="load_"+ev.id;
                const ld=dispatches.find(d2=>d2.evId===ev.id);
                if(!ld||ld.assignments.length===0) return null;
                return(
                  <div style={{padding:"10px 18px 14px",borderTop:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>📦 {T2("Loading / Unloading Checklist")}</div>
                    {ld.assignments.map((asgn,ai)=>{
                      const v2=fleetList.find(x=>x.id===asgn.vehicleId)||{name:asgn.vehicleId,icon:"🚛"};
                      const loadDone=asgn.loadingList.filter(i=>i.checked).length;
                      const unloadDone=asgn.unloadingList.filter(i=>i.checked).length;
                      return(
                        <div key={ai} style={{marginBottom:10,background:C.bg,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}>
                          <div style={{padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              <span style={{fontSize:16}}>{v2.icon}</span>
                              <span style={{fontSize:12,fontWeight:700,color:C.text}}>{v2.name}</span>
                              <span style={{fontSize:11,color:C.gold,fontWeight:600}}>{asgn.dispatchTime}</span>
                            </div>
                            <div style={{display:"flex",gap:8}}>
                              <span style={{fontSize:11,color:loadDone===asgn.loadingList.length?C.green:C.amber}}>📦 {loadDone}/{asgn.loadingList.length}</span>
                              <span style={{fontSize:11,color:unloadDone===asgn.unloadingList.length?C.green:C.muted}}>📤 {unloadDone}/{asgn.unloadingList.length}</span>
                            </div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:40}}>
                            {/* Loading */}
                            <div style={{padding:"8px 10px",borderRight:`1px solid ${C.border}`}}>
                              <div style={{fontSize:10,fontWeight:700,color:C.amber,marginBottom:6}}>📦 {T2("LOADING")}</div>
                              {asgn.loadingList.map((item,li)=>(
                                <div key={li} onClick={()=>{
                                  setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,loadingList:a2.loadingList.map((ll,lli)=>lli!==li?ll:{...ll,checked:!ll.checked})})}));
                                }} style={{display:"flex",gap:6,alignItems:"center",padding:"4px 0",cursor:"pointer"}}>
                                  <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${item.checked?C.green:C.border}`,background:item.checked?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                    {item.checked&&<span style={{color:"#fff",fontSize:8,fontWeight:700}}>✓</span>}
                                  </div>
                                  <span style={{fontSize:11,color:item.checked?C.green:C.text,textDecoration:item.checked?"line-through":"none"}}>{item.name}</span>
                                </div>
                              ))}
                            </div>
                            {/* Unloading */}
                            <div style={{padding:"8px 10px"}}>
                              <div style={{fontSize:10,fontWeight:700,color:C.blue||"#5B8FD0",marginBottom:6}}>📤 {T2("UNLOADING")}</div>
                              {asgn.unloadingList.map((item,li)=>(
                                <div key={li} onClick={()=>{
                                  setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,unloadingList:a2.unloadingList.map((ll,lli)=>lli!==li?ll:{...ll,checked:!ll.checked})})}));
                                }} style={{display:"flex",gap:6,alignItems:"center",padding:"4px 0",cursor:"pointer"}}>
                                  <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${item.checked?"#5B8FD0":C.border}`,background:item.checked?"#5B8FD0":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                    {item.checked&&<span style={{color:"#fff",fontSize:8,fontWeight:700}}>✓</span>}
                                  </div>
                                  <span style={{fontSize:11,color:item.checked?"#5B8FD0":C.text,textDecoration:item.checked?"line-through":"none"}}>{item.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
