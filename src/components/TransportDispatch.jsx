// Ambria FnB — Transport & Dispatch
import React, { useState, useRef, useEffect } from "react";
import { C, VEHICLES, COLD_ITEMS, AMBRIA_VENUES } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, safeArr, safePct, calcDispatch } from '../utils/helpers.js';
import { Card, Btn, Chip } from './SharedUI.jsx';
import { dbUpsert, dbDelete } from '../lib/db.js';
import { getCatIdForDish, RECIPE_DB } from '../data/recipeData.js';
import { logActivity } from './ActivityLog.jsx';

function TransportDispatch({events, kitchenTracking={}, setKitchenTracking=null, lang="en", currentUser=null, transportQueue=[], setTransportQueue}) {
  const T2 = s => T(s, lang||"en");
  const safeEvs = Array.isArray(events) ? events : [];
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const VCOL = {dry:"#C07010", cold:"#185FA5", quick:"#2B8A50"};

  function buildChecklist(ev, vehicleId) {
    const v = VEHICLES.find(x=>x.id===vehicleId);
    const menuItems = (ev.menu||[]).map(name=>({
      id:`${name}-menu`.replace(/\s+/g,"-"), name, category:"🍽 Food",
      source: ["sweets","chaat","chaat_master"].includes(getCatIdForDish(name))?"AE Kitchen":"AP Kitchen",
      cold: COLD_ITEMS.some(ci=>name.toLowerCase().includes(ci.toLowerCase())), checked:false,
    }));
    if(v?.type==="cold") return [...menuItems.filter(i=>i.cold),{id:"dairy-cold",name:"Dairy & cold items",category:"❄ Cold",source:"AE Kitchen",cold:true,checked:false}];
    if(v?.type==="dry")  return [...menuItems.filter(i=>!i.cold),
      {id:"chafing",name:"Chafing dishes + stands",category:"🔧 Equipment",source:"AP Kitchen",cold:false,checked:false},
      {id:"fuel",   name:"Fuel cans / sterno",      category:"🔧 Equipment",source:"AP Kitchen",cold:false,checked:false},
      {id:"crockery",name:"Crockery & cutlery",     category:"🍽 Crockery", source:"AP Kitchen",cold:false,checked:false},
    ];
    return menuItems;
  }

  function autoVehicles(ev){
    const menu=safeArr(ev.menu);
    const hasCold=menu.some(d=>COLD_ITEMS.some(ci=>d.toLowerCase().includes(ci.toLowerCase())));
    const pax=+ev.pax||0;
    const vids=[];
    vids.push("DL1LAJ1250");
    if(hasCold) vids.push("DL1LAN2125");
    if(pax>400) vids.push("DL1LAN1814");
    return vids;
  }

  function makeManifest(ev,vid){
    const menu=safeArr(ev.menu);
    const v=VEHICLES.find(x=>x.id===vid);
    if(v?.type==="cold") return menu.filter(d=>COLD_ITEMS.some(ci=>d.toLowerCase().includes(ci.toLowerCase())));
    return menu.filter(d=>!COLD_ITEMS.some(ci=>d.toLowerCase().includes(ci.toLowerCase())));
  }

  const initDispatches = () => safeEvs.map(ev=>({
    evId:ev.id, evGuest:ev.guest, evDate:ev.date, evTime:ev.time, evVenue:ev.venue, menu:ev.menu||[],
    assignments: autoVehicles(ev).map(vid=>({
      vehicleId:vid, driver:"", dispatchTime:calcDispatch(ev.time), status:T2("Planning"),
      manifest:makeManifest(ev,vid), loadingList:buildChecklist(ev,vid),
      unloadingList:buildChecklist(ev,vid).map(i=>({...i,id:"u-"+i.id,checked:false})),
    })),
  }));

  const [dispatches, setDispatches] = useState(initDispatches);
  const [dishLU, setDishLU] = useState({});
  const [selFnId, setSelFnId] = useState(()=>{
    const td=new Date().toISOString().slice(0,10);
    const tm=new Date(Date.now()+864e5).toISOString().slice(0,10);
    const todayEv=safeEvs.find(e=>e.date===td);
    if(todayEv)return todayEv.id;
    const tmEv=safeEvs.find(e=>e.date===tm);
    if(tmEv)return tmEv.id;
    return safeEvs[0]?.id||null;
  });
  const [tdSearch, setTdSearch] = useState("");
  const [tdSecOpen, setTdSecOpen] = useState({});
  const [selEvId,    setSelEvId]    = useState(safeEvs[0]?.id||null);
  const [activeTab,  setActiveTab]  = useState("todayplan");
  const [selDate,    setSelDate]    = useState(safeEvs[0]?.date||"");
  const [expandedFn, setExpandedFn] = useState(null); // for load/unload function expand
  const [fleetList,   setFleetList]   = useState(VEHICLES.map(v=>({...v})));
  const [showAddVeh,  setShowAddVeh]  = useState(false);
  const [editVehId,   setEditVehId]   = useState(null);
  const [vehForm,     setVehForm]     = useState({id:"",name:"",icon:"🚛",type:"dry",note:"",base_location:"AP Kitchen"});
  const [delVehId,    setDelVehId]    = useState(null);
  const [clSrch,      setClSrch]      = useState("");

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

  const allDates  = [...new Set(safeEvs.map(e=>e.date).filter(Boolean))].sort();
  const dayEvs    = safeEvs.filter(e=>e.date===selDate);
  const selDispatch = dispatches.find(d=>d.evId===selEvId)||null;

  const PROP = {
    "Ambria Pushpanjali":{code:"AP",c:"#D4A843",bg:C.goldBg},
    "Ambria Exotica":    {code:"AE",c:"#854F0B",bg:C.goldBg},
    "Manaktala Farm":    {code:"AM",c:"#B05A10",bg:"#1A1610"},
    "Ambria Restro":     {code:"AR",c:"#0F6E56",bg:"#0E1E1A"},
  };
  const gp = v => PROP[v]||{code:"EV",c:C.wine,bg:C.wineBg};

  const TABS=[{v:"ready",l:"🍳 Kitchen Ready"},{v:"todayplan",l:`📋 ${T2("Today's Plan")}`},{v:"fleet",l:`🚛 ${T2("Fleet")}`}];

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

      {/* ── KITCHEN DISPATCH NOTIFICATIONS ── */}
      {(()=>{
        const notifications = safeEvs.filter(ev => ev.date===TODAY).map(ev => {
          const evKt = kt[ev.id] || {};
          const dispatched = !!evKt.__dispatch_ready;
          const dispatchTime = evKt.__dispatch_time || "";
          const menu = safeArr(ev.menu);
          let readyCount = 0;
          menu.forEach((name, idx) => {
            const dk = ev.id+"|"+idx;
            if(evKt[dk]?.ready) readyCount++;
          });
          return {ev, dispatched, dispatchTime, readyCount, total: menu.length};
        }).filter(n => n.readyCount > 0);
        if(notifications.length === 0) return null;
        return (
          <div style={{marginBottom:14}}>
            {notifications.map(n => (
              <div key={n.ev.id} style={{background:n.dispatched?C.greenBg:C.amberBg,border:`1.5px solid ${n.dispatched?C.greenBorder:C.amberBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{n.dispatched?"🚛":"🍳"}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:n.dispatched?C.green:C.amber}}>
                      {n.dispatched?`${n.ev.guest} — ${T2("Kitchen says: Ready for Dispatch!")}`:`${n.ev.guest} — ${n.readyCount}/${n.total} ${T2("dishes ready from kitchen")}`}
                    </div>
                    <div style={{fontSize:12,color:C.muted}}>{n.ev.venue} · {n.ev.time}{n.dispatchTime?` · ${T2("Notified at")} ${n.dispatchTime}`:""}</div>
                  </div>
                </div>
                <div style={{textAlign:"center",flexShrink:0}}>
                  <div style={{fontSize:18,fontWeight:700,color:n.dispatched?C.green:C.amber}}>{n.readyCount}/{n.total}</div>
                  <div style={{fontSize:12,color:C.muted}}>{T2("ready")}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── FROM KITCHEN — READY FOR PICKUP ── */}
      {(function(){
        var pending=(transportQueue||[]).filter(function(item){return item.status==='Pending Pickup'||item.status==='Ready';});
        var pickedUp=(transportQueue||[]).filter(function(item){return item.status==='Picked Up';});
        if(!pending.length&&!pickedUp.length) return null;
        return (
          <div style={{marginBottom:14,border:`1.5px solid ${C.wine}`,borderRadius:12,overflow:'hidden'}}>
            <div style={{background:C.wine+'20',padding:'10px 16px',display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:14}}>🍳</span>
              <span style={{fontSize:13,fontWeight:700,color:C.wine}}>From Kitchen — Ready for Pickup</span>
              {pending.length>0&&<span style={{fontSize:11,background:C.wine,color:'#fff',padding:'2px 8px',borderRadius:20,fontWeight:700}}>{pending.length}</span>}
            </div>
            {pending.map(function(item,i){return (
              <div key={item.id||i} style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{item.dishName}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{item.event} · 📍 {item.venue} · {item.pax} pax</div>
                  <div style={{fontSize:11,color:C.muted}}>{item.fromVenue?`🏠 From: ${item.fromVenue} → ${item.venue}`:`By ${item.preparedBy}`} · {item.markedAt}</div>
                </div>
                <button onClick={function(){setTransportQueue&&setTransportQueue(function(prev){return prev.map(function(q){return q.id===item.id?{...q,status:'Picked Up',pickedUpAt:new Date().getHours().toString().padStart(2,'0')+':'+new Date().getMinutes().toString().padStart(2,'0')}:q;});});}} style={{padding:'8px 14px',borderRadius:10,background:C.green,color:'#fff',border:'none',fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0,minHeight:38}}>📦 {T2("Mark Loaded")}</button>
              </div>
            );})}
            {pickedUp.length>0&&(
              <div style={{padding:'8px 16px',background:C.darkCard}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:'uppercase',letterSpacing:0.8}}>Already Picked Up ({pickedUp.length})</div>
                {pickedUp.map(function(item,i){return (
                  <div key={item.id||i} style={{fontSize:11,color:C.muted,padding:'4px 0',borderBottom:i<pickedUp.length-1?`1px solid ${C.borderLight}`:'none'}}>
                    {item.dishName} · {item.event} · By {item.preparedBy}{item.pickedUpAt?' · Picked up '+item.pickedUpAt:''}
                  </div>
                );})}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{display:"flex",gap:6,marginBottom:14,borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
        {TABS.map(t=>(
          <button key={t.v} onClick={()=>setActiveTab(t.v)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",background:activeTab===t.v?C.wine:"transparent",color:activeTab===t.v?"#fff":C.muted,border:`1.5px solid ${activeTab===t.v?C.wine:C.border}`}}>{t.l}</button>
        ))}
      </div>

      {activeTab==="ready"&&(function(){
        var readyDishes=[];
        var dispatchedDishes=[];
        var relevantEvs=safeEvs.filter(function(e){return e.date===TODAY||e.date===TOMORROW;});
        relevantEvs.forEach(function(ev){
          var menuArr=Array.isArray(ev.menu)?ev.menu:[];
          menuArr.forEach(function(dishName,idx){
            var evKt=kt[ev.id]||{};
            var pipeKey=ev.id+'|'+idx;
            var dishData=evKt[pipeKey]||evKt[ev.id+'_'+idx]||evKt['d_'+idx]||null;
            if(!dishData) return;
            if(dishData.readyForDispatch||dishData.dispatchReady){dispatchedDishes.push({name:dishName,ev:ev,data:dishData,idx:idx});}
            else if(dishData.completed||dishData.ready||dishData.mesaDone){readyDishes.push({name:dishName,ev:ev,data:dishData,idx:idx});}
          });
        });
        var totalDishes=relevantEvs.reduce(function(s,e){return s+(Array.isArray(e.menu)?e.menu.length:0);},0);
        return (
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>🍳 Dishes Ready for Dispatch</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Live feed from Kitchen Hub — dishes marked ready by chefs</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
              <div style={{background:C.amberBg,borderRadius:10,padding:12,textAlign:'center',border:`1px solid ${C.amberBorder}`}}>
                <div style={{fontSize:24,fontWeight:800,color:C.amber}}>{readyDishes.length}</div>
                <div style={{fontSize:10,color:C.amber,fontWeight:600}}>Ready to Load</div>
              </div>
              <div style={{background:C.greenBg,borderRadius:10,padding:12,textAlign:'center',border:`1px solid ${C.greenBorder}`}}>
                <div style={{fontSize:24,fontWeight:800,color:C.green}}>{dispatchedDishes.length}</div>
                <div style={{fontSize:10,color:C.green,fontWeight:600}}>Dispatch Marked</div>
              </div>
              <div style={{background:C.bg,borderRadius:10,padding:12,textAlign:'center',border:`1px solid ${C.border}`}}>
                <div style={{fontSize:24,fontWeight:800,color:C.muted}}>{Math.max(0,totalDishes-readyDishes.length-dispatchedDishes.length)}</div>
                <div style={{fontSize:10,color:C.muted,fontWeight:600}}>Still Cooking</div>
              </div>
            </div>
            {readyDishes.length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:700,color:C.amber,marginBottom:8,textTransform:'uppercase',letterSpacing:0.8}}>⏳ Ready — Waiting for Transport</div>
                {readyDishes.map(function(d,i){return(
                  <div key={i} style={{display:'flex',gap:12,alignItems:'center',padding:'12px 14px',marginBottom:6,background:C.amberBg,borderRadius:10,border:`1px solid ${C.amberBorder}`}}>
                    {d.data.selfie?<img src={d.data.selfie} style={{width:44,height:44,borderRadius:10,objectFit:'cover',border:`2px solid ${C.gold}`}}/>:<div style={{width:44,height:44,borderRadius:10,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🍽</div>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{d.name}</div>
                      <div style={{fontSize:11,color:C.muted}}>{d.ev.venue+' · '+d.ev.pax+' pax · By '+(d.data.completedBy||'Chef')+' at '+(d.data.completedAt||'')}</div>
                    </div>
                    <div style={{padding:'6px 12px',borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,fontSize:11,color:C.amber,fontWeight:700}}>Ready</div>
                  </div>
                );})}
              </div>
            )}
            {dispatchedDishes.length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:8,textTransform:'uppercase',letterSpacing:0.8}}>🚛 Dispatch Marked</div>
                {dispatchedDishes.map(function(d,i){return(
                  <div key={i} style={{display:'flex',gap:12,alignItems:'center',padding:'12px 14px',marginBottom:6,background:C.greenBg,borderRadius:10,border:`1px solid ${C.greenBorder}`}}>
                    {d.data.selfie?<img src={d.data.selfie} style={{width:44,height:44,borderRadius:10,objectFit:'cover',border:`2px solid ${C.green}`}}/>:<div style={{width:44,height:44,borderRadius:10,background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>✅</div>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{d.name}</div>
                      <div style={{fontSize:11,color:C.muted}}>{d.ev.venue+' · By '+(d.data.dispatchMarkedBy||'Chef')+' at '+(d.data.dispatchMarkedAt||'')}</div>
                    </div>
                    <div style={{padding:'6px 12px',borderRadius:8,background:C.greenBg,border:`1px solid ${C.greenBorder}`,fontSize:11,color:C.green,fontWeight:700}}>🚛 Dispatched</div>
                  </div>
                );})}
              </div>
            )}
            {readyDishes.length===0&&dispatchedDishes.length===0&&(
              <div style={{textAlign:'center',padding:'40px 20px',color:C.muted}}>
                <div style={{fontSize:36,marginBottom:8}}>🍳</div>
                <div style={{fontSize:14}}>No dishes ready for dispatch yet</div>
                <div style={{fontSize:12,marginTop:4}}>Dishes will appear here when chefs mark them as ready in Kitchen Hub</div>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab==="todayplan"&&(()=>{
        const todayEvs = safeEvs.filter(e=>e.date===TODAY).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        const tomorrowEvs = safeEvs.filter(e=>e.date===TOMORROW).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
        const laterEvs = safeEvs.filter(e=>e.date>TOMORROW).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
        const allEvs = [...todayEvs,...tomorrowEvs];

        function isDishReady(evId, dishName, dishIdx){
          const evKt = kt[evId]||{};
          const dId = evId+"|"+dishIdx;
          const d = evKt[dId];
          if(d?.ready || d?.completed || d?.mesaDone) return true;
          if(evKt["d_"+dishIdx]?.ready) return true;
          if(d && Array.isArray(d.steps) && d.steps.length > 0 && Array.isArray(d.done) && d.done.length >= d.steps.length) return true;
          return false;
        }
        function isDishDispatched(evId, dishIdx){
          const evKt = kt[evId]||{};
          const dId = evId+"|"+dishIdx;
          return !!(evKt[dId]?.readyForDispatch || evKt[dId]?.dispatchReady || evKt["d_"+dishIdx]?.dispatchReady);
        }
        function getDishReadyTime(evId, dishIdx){
          const evKt = kt[evId]||{};
          const dId = evId+"|"+dishIdx;
          const d = evKt[dId];
          if(d?.readyAt) return d.readyAt;
          if(d?.completedAt && typeof d.completedAt === "string") return d.completedAt;
          if(d?.dishCompletedAt) return new Date(d.dishCompletedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
          return evKt["d_"+dishIdx]?.readyAt || "";
        }
        function getDishDispatchTime(evId, dishIdx){
          const evKt = kt[evId]||{};
          const dId = evId+"|"+dishIdx;
          return evKt[dId]?.dispatchAt || evKt[`d_${dishIdx}`]?.dispatchAt || "";
        }
        function dishProgress(evId, dishName, dishIdx){
          const dId = evId+"|"+dishIdx;
          const d = (kt[evId]||{})[dId];
          if(!d||!Array.isArray(d.steps)||!d.steps.length) return 0;
          return safePct(Array.isArray(d.done)?d.done.length:0,safeArr(d.steps).length);
        }

        function renderCard(ev, showDate){
          const p = gp(ev.venue);
          const dispatch = dispatches.find(d=>d.evId===ev.id)||{assignments:[]};
          const bySec={};
          (ev.menu||[]).forEach((n,i)=>{const s=getCatIdForDish(n);if(!bySec[s])bySec[s]=[];bySec[s].push({name:n,idx:i});});
          const totalDishes = (ev.menu||[]).length;
          const readyDishes = (ev.menu||[]).filter((n,i)=>isDishReady(ev.id,n,i)).length;
          const readyPct = safePct(readyDishes,totalDishes);
          const allVehicles = dispatch.assignments.map(a=>fleetList.find(v=>v.id===a.vehicleId)||{name:a.vehicleId,icon:"🚛"});

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
                    <div style={{fontSize:11,color:C.muted}}>{ev.venue} · {ev.type}</div>
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
                    {icon:"📜",label:"Package",value:ev.menuPackage||"Custom"},
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
                  <button onClick={()=>addVehicle(ev.id)} style={{padding:"5px 12px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:32}}>+ {T2("Add Vehicle")}</button>
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

              {/* Menu by Section — kitchen progress */}
              <div style={{padding:"10px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>🍽 {T2("Menu — Kitchen Status")}</span>
                  <div style={{display:"flex",gap:16}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{T2("Status")}</span>
                    <span style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",minWidth:40,textAlign:"center"}}>📦 {T2("Load")}</span>
                    <span style={{fontSize:10,fontWeight:700,color:"#5B8FD0",textTransform:"uppercase",minWidth:40,textAlign:"center"}}>📤 {T2("Unload")}</span>
                  </div>
                </div>
                <div>
                  {Object.entries(bySec).map(([sec,dishes])=>{
                    const catObj=RECIPE_DB.cats.find(c=>c.id===sec);
                    const m={color:catObj?.color||C.muted,icon:catObj?.icon||"🍽"};
                    const secReady=dishes.filter(d=>isDishReady(ev.id,d.name,d.idx)).length;
                    return (
                      <div key={sec} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:700,color:m.color}}>{m.icon} {T2(catObj?.name||sec)}</span>
                          <span style={{fontSize:12,fontWeight:600,color:secReady===dishes.length?C.green:C.muted}}>{secReady}/{dishes.length}</span>
                        </div>
                        {dishes.map((d,di)=>{
                          const ready=isDishReady(ev.id,d.name,d.idx);
                          const dispatched=isDishDispatched(ev.id,d.idx);
                          const readyTime=getDishReadyTime(ev.id,d.idx);
                          const dispatchTime=getDishDispatchTime(ev.id,d.idx);
                          const luKey=ev.id+"_"+d.idx;
                          const lu=dishLU[luKey]||{};
                          const isLoaded=!!lu.loaded;
                          const isUnloaded=!!lu.unloaded;
                          return (
                            <div key={di} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 6px",borderBottom:`1px solid ${C.borderLight}`,background:isUnloaded?C.greenBg+"40":isLoaded?C.amberBg+"20":dispatched?C.greenBg+"60":ready?C.amberBg+"40":"transparent"}}>
                              {/* Kitchen status icon */}
                              <div style={{width:20,height:20,borderRadius:6,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                                background:dispatched?C.green:ready?C.amber:"transparent",
                                border:`2px solid ${dispatched?C.green:ready?C.amber:C.border}`}}>
                                {(ready||dispatched)&&<span style={{color:"#0A0A0F",fontSize:10,fontWeight:700}}>✓</span>}
                              </div>
                              {/* Dish name */}
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:500,color:C.text}}>{d.name}</div>
                              </div>
                              {/* Status badge */}
                              <div style={{flexShrink:0,minWidth:80}}>
                                {dispatched&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.green,color:"#0A0A0F",fontWeight:700}}>🚛 {dispatchTime}</span>}
                                {ready&&!dispatched&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.amber,color:"#0A0A0F",fontWeight:700}}>✅ {readyTime}</span>}
                                {!ready&&!dispatched&&<span style={{fontSize:10,color:C.muted}}>⏳</span>}
                              </div>
                              {/* LOAD checkbox */}
                              <div onClick={(e)=>{e.stopPropagation();setDishLU(p=>({...p,[luKey]:{...(p[luKey]||{}),loaded:!isLoaded}}));}}
                                style={{width:32,height:32,borderRadius:8,border:`2px solid ${isLoaded?C.amber:C.border}`,background:isLoaded?C.amber:"transparent",
                                  display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                                {isLoaded&&<span style={{color:"#0A0A0F",fontSize:14,fontWeight:700}}>✓</span>}
                              </div>
                              {/* UNLOAD checkbox */}
                              <div onClick={(e)=>{e.stopPropagation();if(isLoaded)setDishLU(p=>({...p,[luKey]:{...(p[luKey]||{}),unloaded:!isUnloaded}}));}}
                                style={{width:32,height:32,borderRadius:8,border:`2px solid ${isUnloaded?"#5B8FD0":C.border}`,background:isUnloaded?"#5B8FD0":"transparent",
                                  display:"flex",alignItems:"center",justifyContent:"center",cursor:isLoaded?"pointer":"default",opacity:isLoaded?1:.35,flexShrink:0}}>
                                {isUnloaded&&<span style={{color:"#fff",fontSize:14,fontWeight:700}}>✓</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
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
                                    {item.checked&&<span style={{color:"#0A0A0F",fontSize:8,fontWeight:700}}>✓</span>}
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
            {/* ── Function Dropdown Selector ── */}
            {allEvs.length===0&&<div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,color:C.muted,fontSize:13}}>{T2("No events loaded")}</div>}
            {allEvs.length>0&&(()=>{
              const selEv=allEvs.find(e=>e.id===selFnId)||allEvs[0];
              const p=gp(selEv.venue);
              const menu2r=[];(selEv.menu||[]).forEach((d,oi)=>{if(getCatIdForDish(d)!=="beverages")menu2r.push({name:d,origIdx:oi});});
              const lc=menu2r.filter(d=>dishLU[selEv.id+"_"+d.origIdx]?.loaded).length;
              const uc=menu2r.filter(d=>dishLU[selEv.id+"_"+d.origIdx]?.unloaded).length;
              return(
                <div style={{marginBottom:14}}>
                  {/* Dropdown */}
                  <select value={selFnId||""} onChange={e=>setSelFnId(e.target.value)}
                    style={{width:"100%",padding:"14px 16px",borderRadius:12,border:`2px solid ${p.c}`,fontSize:14,fontWeight:700,color:C.text,background:C.surface,appearance:"auto",cursor:"pointer",minHeight:48,marginBottom:10}}>
                    {allEvs.map(ev=>{
                      const isT=ev.date===TODAY;
                      return <option key={ev.id} value={ev.id}>{isT?"🟢 Today":"📅 "+ev.date} — {ev.guest} · {ev.venue} · {ev.time} · {ev.pax} pax</option>;
                    })}
                  </select>
                  {/* Summary bar */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:p.c+"10",borderRadius:12,border:`1px solid ${p.c}30`}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:700,color:C.text}}>{selEv.guest}</div>
                      <div style={{fontSize:12,color:C.muted}}>📍 {selEv.venue} · ⏰ {selEv.time} · 👥 {selEv.pax} {T2("pax")} · 🚛 {T2("Dispatch")}: {calcDispatch(selEv.time)}</div>
                      {selEv.special&&<div style={{fontSize:12,color:C.amber,marginTop:3}}>⚠ {selEv.special}</div>}
                    </div>
                    <div style={{display:"flex",gap:14,flexShrink:0}}>
                      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.amber}}>{lc}</div><div style={{fontSize:10,color:C.amber}}>📦 {T2("Loaded")}</div></div>
                      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:"#5B8FD0"}}>{uc}</div><div style={{fontSize:10,color:"#5B8FD0"}}>📤 {T2("Unloaded")}</div></div>
                      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.text}}>{menu2r.length}</div><div style={{fontSize:10,color:C.muted}}>{T2("dishes")}</div></div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Selected Function Detail ── */}
            {selFnId&&(()=>{
              const ev=allEvs.find(e=>e.id===selFnId);
              if(!ev) return null;
              const p=gp(ev.venue);
              const fullMenu=(ev.menu||[]);
              const menu=[];
              fullMenu.forEach((n,origIdx)=>{if(getCatIdForDish(n)!=="beverages")menu.push({name:n,origIdx});});
              const dispatch=dispatches.find(d=>d.evId===ev.id)||{assignments:[]};

              // Group by section
              const bySec2={};
              menu.forEach((item)=>{const s=getCatIdForDish(item.name);if(!bySec2[s])bySec2[s]=[];bySec2[s].push({name:item.name,idx:item.origIdx});});

              // Search filter
              const q=tdSearch.toLowerCase().trim();
              const secKeys2=Object.keys(bySec2).sort();

              return(
                <div>
                  {/* Search box */}
                  <div style={{marginBottom:12}}>
                    <input value={tdSearch} onChange={e=>setTdSearch(e.target.value)} placeholder={`🔍 ${T2("Search dishes…")}`}
                      style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:44}}/>
                  </div>

                  {/* Vehicle assignment */}
                  <Card style={{marginBottom:12,padding:"12px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.muted}}>🚛 {T2("Vehicles")}</span>
                      <button onClick={()=>addVehicle(ev.id)} style={{padding:"6px 14px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:36}}>+ {T2("Add Vehicle")}</button>
                    </div>
                    {dispatch.assignments.map((asgn,ai)=>{
                      const v=fleetList.find(x=>x.id===asgn.vehicleId)||{name:asgn.vehicleId,icon:"🚛"};
                      const sc2=asgn.status==="Dispatched"||asgn.status==="At Venue"||asgn.status==="Unloaded"?C.green:asgn.status==="Loaded"?C.amber:C.muted;
                      const loc2=getVehicleLocation(asgn.vehicleId);
                      return(
                        <div key={ai} style={{background:C.bg,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,marginBottom:6}}>
                          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            <span style={{fontSize:16}}>{v.icon}</span>
                            <select value={asgn.vehicleId} onChange={e=>setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,vehicleId:e.target.value})}))}
                              style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36,minWidth:140}}>
                              {fleetList.map(fv=><option key={fv.id} value={fv.id}>{fv.icon} {fv.name}</option>)}
                            </select>
                            <input value={asgn.driver} placeholder={T2("Driver")} onChange={e=>setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,driver:e.target.value})}))}
                              style={{width:120,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}/>
                            <input type="time" value={asgn.dispatchTime} onChange={e=>updAsgn(ev.id,ai,"dispatchTime",e.target.value)}
                              style={{width:90,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}/>
                            <button onClick={()=>setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.filter((_,i2)=>i2!==ai)}))}
                              style={{padding:"6px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,cursor:"pointer",minHeight:32}}>✕</button>
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:11,fontWeight:700,color:sc2,padding:"2px 8px",borderRadius:8,background:sc2+"15"}}>{asgn.status}</span>
                            <span style={{fontSize:11,color:C.muted}}>🏠 {loc2.at}</span>
                            {loc2.dest&&<><span style={{fontSize:11,color:C.faint}}>→</span><span style={{fontSize:11,color:C.muted}}>📍 {loc2.dest}</span></>}
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
                          {!canAdvance(asgn)&&asgn.status==="Planning"&&<div style={{fontSize:10,color:C.amber,marginTop:4}}>⚠ Check all loading items first</div>}
                          {!canAdvance(asgn)&&asgn.status==="Loaded"&&!asgn.driver&&<div style={{fontSize:10,color:C.amber,marginTop:4}}>⚠ Assign a driver first</div>}
                        </div>
                      );
                    })}
                    {dispatch.assignments.length===0&&<div style={{fontSize:12,color:C.faint,padding:"6px 0"}}>🚛 {T2("No vehicles assigned yet")}</div>}
                    <div style={{fontSize:10,color:C.muted,marginTop:6}}>✏ {T2("Editable by")} Pushpander / Raj Kumar</div>
                  </Card>

                  {/* Section-wise collapsible checklist */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>🍽 {T2("Dishes Checklist")}</span>
                    <div style={{display:"flex",gap:16}}>
                      <span style={{fontSize:10,fontWeight:700,color:C.muted}}>{T2("Status")}</span>
                      <span style={{fontSize:10,fontWeight:700,color:C.amber}}>📦</span>
                      <span style={{fontSize:10,fontWeight:700,color:"#5B8FD0"}}>📤</span>
                    </div>
                  </div>

                  {secKeys2.map(sec=>{
                    const items=bySec2[sec];
                    const catObj2=RECIPE_DB.cats.find(c=>c.id===sec);
                    const m={color:catObj2?.color||C.muted,icon:catObj2?.icon||"🍽"};
                    const filtered=q?items.filter(d=>d.name.toLowerCase().includes(q)):items;
                    if(filtered.length===0) return null;
                    const secLoaded=filtered.filter(d=>dishLU[ev.id+"_"+d.idx]?.loaded).length;
                    const secUnloaded=filtered.filter(d=>dishLU[ev.id+"_"+d.idx]?.unloaded).length;
                    const secKey="td_"+ev.id+"_"+sec;
                    const secOpen2=tdSecOpen[secKey]!==false;

                    return(
                      <Card key={sec} style={{marginBottom:8,padding:0,overflow:"hidden"}}>
                        <div onClick={()=>setTdSecOpen(p=>({...p,[secKey]:!secOpen2}))}
                          style={{padding:"12px 16px",background:m.color+"10",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",borderBottom:secOpen2?`1px solid ${C.border}`:"none"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:14,fontWeight:700,color:m.color}}>{m.icon} {T2(catObj2?.name||sec)}</span>
                            <span style={{fontSize:12,color:C.muted}}>{filtered.length} {T2("dishes")}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:12,color:secLoaded===filtered.length?C.green:C.amber}}>📦 {secLoaded}/{filtered.length}</span>
                            <span style={{fontSize:12,color:secUnloaded===filtered.length?C.green:C.muted}}>📤 {secUnloaded}/{filtered.length}</span>
                            <span style={{fontSize:14,color:C.muted,transform:secOpen2?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
                          </div>
                        </div>
                        {secOpen2&&<div style={{padding:"6px 12px"}}>
                          {filtered.map((d,di)=>{
                            const ready=isDishReady(ev.id,d.name,d.idx);
                            const dispatched2=isDishDispatched(ev.id,d.idx);
                            const readyTime=getDishReadyTime(ev.id,d.idx);
                            const dispatchTime=getDishDispatchTime(ev.id,d.idx);
                            const luKey=ev.id+"_"+d.idx;
                            const lu=dishLU[luKey]||{};
                            const isLoaded=!!lu.loaded;
                            const isUnloaded=!!lu.unloaded;
                            return(
                              <div key={di} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 4px",borderBottom:di<filtered.length-1?`1px solid ${C.borderLight}`:"none",background:isUnloaded?C.greenBg+"40":isLoaded?C.amberBg+"20":"transparent"}}>
                                <div style={{width:22,height:22,borderRadius:6,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                                  background:dispatched2?C.green:ready?C.amber:"transparent",border:`2px solid ${dispatched2?C.green:ready?C.amber:C.border}`}}>
                                  {(ready||dispatched2)&&<span style={{color:"#0A0A0F",fontSize:10,fontWeight:700}}>✓</span>}
                                </div>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:13,fontWeight:500,color:C.text}}>{d.name}</div>
                                </div>
                                <div style={{flexShrink:0,minWidth:70}}>
                                  {dispatched2&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.green,color:"#0A0A0F",fontWeight:700}}>🚛 {dispatchTime}</span>}
                                  {ready&&!dispatched2&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.amber,color:"#0A0A0F",fontWeight:700}}>✅ {readyTime}</span>}
                                  {!ready&&!dispatched2&&<span style={{fontSize:11,color:C.muted}}>⏳ Preparing</span>}
                                </div>
                                <div onClick={(e)=>{e.stopPropagation();setDishLU(p=>({...p,[luKey]:{...(p[luKey]||{}),loaded:!isLoaded}}));}}
                                  style={{width:32,height:32,borderRadius:8,border:`2px solid ${isLoaded?C.amber:C.border}`,background:isLoaded?C.amber:"transparent",
                                    display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                                  {isLoaded&&<span style={{color:"#0A0A0F",fontSize:14,fontWeight:700}}>✓</span>}
                                </div>
                                <div onClick={(e)=>{e.stopPropagation();if(isLoaded)setDishLU(p=>({...p,[luKey]:{...(p[luKey]||{}),unloaded:!isUnloaded}}));}}
                                  style={{width:32,height:32,borderRadius:8,border:`2px solid ${isUnloaded?"#5B8FD0":C.border}`,background:isUnloaded?"#5B8FD0":"transparent",
                                    display:"flex",alignItems:"center",justifyContent:"center",cursor:isLoaded?"pointer":"default",opacity:isLoaded?1:.35,flexShrink:0}}>
                                  {isUnloaded&&<span style={{color:"#fff",fontSize:14,fontWeight:700}}>✓</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>}
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
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
            {isAdmin&&<button onClick={()=>{setVehForm({id:"",name:"",icon:"🚛",type:"dry",note:"",base_location:"AP Kitchen"});setEditVehId(null);setShowAddVeh(true);}} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:36}}>+ {T2("Add Vehicle")}</button>}
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
