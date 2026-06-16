// Ambria FnB — Transport & Dispatch
import React, { useState, useRef, useEffect } from "react";
import { C, VEHICLES, COLD_ITEMS, AMBRIA_VENUES, SECTION_META } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, safeArr, safePct, calcDispatch } from '../utils/helpers.js';
import { Card, Btn, Chip } from './SharedUI.jsx';
import { guessSectionForDish } from '../data/recipeData.js';

function TransportDispatch({events, kitchenTracking={}, setKitchenTracking=null, lang="en", currentUser=null, transportQueue=[], setTransportQueue}) {
  const T2 = s => T(s, lang||"en");
  const safeEvs = Array.isArray(events) ? events : [];
  const kt = kitchenTracking && typeof kitchenTracking === "object" ? kitchenTracking : {};
  const VCOL = {dry:"#C07010", cold:"#185FA5", quick:"#2B8A50"};

  function buildChecklist(ev, vehicleId) {
    const v = VEHICLES.find(x=>x.id===vehicleId);
    const menuItems = (ev.menu||[]).map(name=>({
      id:`${name}-menu`.replace(/\s+/g,"-"), name, category:"🍽 Food",
      source: ["Sweets","Chaat"].includes(guessSectionForDish(name))?"AE Kitchen":"AP Kitchen",
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
  const [gps,        setGps]        = useState({
    "DL1LAJ1250":{lat:28.5921,lng:77.0460,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL1LAN1814":{lat:28.5910,lng:77.0465,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL1LAN2125":{lat:28.5900,lng:77.0490,status:"En Route", speed:28,lastUpdate:"Just now"},
    "DL1LW5357": {lat:28.5895,lng:77.0480,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL9CBD3260":{lat:28.5880,lng:77.0520,status:"At Venue", speed:0, lastUpdate:"Just now"},
    "DL9CAR4073":{lat:28.5885,lng:77.0510,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL4ERB3958":{lat:28.5870,lng:77.0500,status:"At Base",  speed:0, lastUpdate:"Just now"},
    "DL4ERB4678":{lat:28.5875,lng:77.0505,status:"At Base",  speed:0, lastUpdate:"Just now"},
  });
  const [fleetList,   setFleetList]   = useState(VEHICLES.map(v=>({...v})));
  const [showAddVeh,  setShowAddVeh]  = useState(false);
  const [editVehId,   setEditVehId]   = useState(null);
  const [vehForm,     setVehForm]     = useState({id:"",name:"",icon:"🚛",type:"dry",note:""});
  const [delVehId,    setDelVehId]    = useState(null);
  const [clSrch,      setClSrch]      = useState("");
  const mapIframeRef = useRef(null);

  useEffect(()=>{
    const t=setInterval(()=>{
      setGps(p=>{
        const n={};
        Object.keys(p).forEach(id=>{
          const v=p[id];
          n[id]={...v,
            lat:v.status==="En Route"?v.lat+(Math.random()-.4)*.003:v.lat+(Math.random()-.5)*.0003,
            lng:v.status==="En Route"?v.lng+(Math.random()-.3)*.003:v.lng+(Math.random()-.5)*.0003,
            speed:v.status==="En Route"?Math.round(18+Math.random()*20):0,
            lastUpdate:"Just now",
          };
        });
        return n;
      });
    },4000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    if(!mapIframeRef.current) return;
    const veh=VEHICLES.map(v=>{const p=gps[v.id]||{lat:28.592,lng:77.047,status:"At Base",speed:0};return{id:v.id,name:v.name,icon:v.icon,lat:p.lat,lng:p.lng,status:p.status,speed:p.speed};});
    try{mapIframeRef.current.contentWindow?.postMessage({type:"vehicles",vehicles:veh},"*");}catch(e){}
  },[gps]);

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

  const venues=[{name:"AP",lat:28.5921,lng:77.0460,color:C.gold},{name:"AE",lat:28.5890,lng:77.0495,color:"#854F0B"},{name:"MKT",lat:28.5960,lng:77.0520,color:"#B05A10"},{name:"AR",lat:28.5902,lng:77.0440,color:"#0F6E56"}];
  const vehForMap=VEHICLES.map(v=>{const p=gps[v.id]||{lat:28.592,lng:77.047,status:"At Base",speed:0};return{id:v.id,name:v.name,icon:v.icon,lat:p.lat,lng:p.lng,status:p.status,speed:p.speed};});
  const mapHtml=`<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"><script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script><style>*{margin:0;padding:0;}html,body,#map{width:100%;height:100%;}</style></head><body><div id="map"></div><script>var map=L.map("map",{center:[28.592,77.047],zoom:15});L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap",maxZoom:19}).addTo(map);var venues=${JSON.stringify(venues)};venues.forEach(function(v){L.marker([v.lat,v.lng],{icon:L.divIcon({className:"",html:'<div style="background:'+v.color+';color:#fff;padding:4px 9px;border-radius:7px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid #fff">'+v.name+'<\/div>',iconAnchor:[18,14]})}).addTo(map).bindPopup(v.name);});var SC={"En Route":"#1B5EAB",T2("At Venue"):"#2B8A50","At Base":"#888"};var mk={};function render(vl){vl.forEach(function(v){var col=SC[v.status]||"#888";var lbl=v.icon+" "+v.id.slice(-6)+(v.speed>0?" · "+v.speed+"km/h":"");var html='<div style="background:'+col+';color:#fff;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4);border:1.5px solid #fff">'+lbl+'<\/div>';var ic=L.divIcon({className:"",html:html,iconAnchor:[30,12]});if(mk[v.id]){mk[v.id].setLatLng([v.lat,v.lng]);mk[v.id].setIcon(ic);}else{mk[v.id]=L.marker([v.lat,v.lng],{icon:ic}).addTo(map).bindPopup(v.name+"<br>"+v.status);}});}render(${JSON.stringify(vehForMap)});window.addEventListener("message",function(e){if(e.data&&e.data.type==="vehicles")render(e.data.vehicles);});<\/script></body></html>`;

  const TABS=[{v:"ready",l:"🍳 Kitchen Ready"},{v:"todayplan",l:`📋 ${T2("Today's Plan")}`},{v:"gps",l:`🗺 ${T2("Live Map")}`}];

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
            else if(dishData.completed||dishData.ready){readyDishes.push({name:dishName,ev:ev,data:dishData,idx:idx});}
          });
        });
        var totalDishes=relevantEvs.reduce(function(s,e){return s+(Array.isArray(e.menu)?e.menu.length:0);},0);
        return (
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>🍳 Dishes Ready for Dispatch</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Live feed from Kitchen Hub — dishes marked ready by chefs</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
              <div style={{background:'#28150840',borderRadius:10,padding:12,textAlign:'center',border:'1px solid #4A281040'}}>
                <div style={{fontSize:24,fontWeight:800,color:'#D4914A'}}>{readyDishes.length}</div>
                <div style={{fontSize:10,color:'#D4914A',fontWeight:600}}>Ready to Load</div>
              </div>
              <div style={{background:'#0A201040',borderRadius:10,padding:12,textAlign:'center',border:'1px solid #1A482840'}}>
                <div style={{fontSize:24,fontWeight:800,color:'#3EAA68'}}>{dispatchedDishes.length}</div>
                <div style={{fontSize:10,color:'#3EAA68',fontWeight:600}}>Dispatch Marked</div>
              </div>
              <div style={{background:'#1A171440',borderRadius:10,padding:12,textAlign:'center',border:'1px solid #2A252040'}}>
                <div style={{fontSize:24,fontWeight:800,color:'#7A6F62'}}>{Math.max(0,totalDishes-readyDishes.length-dispatchedDishes.length)}</div>
                <div style={{fontSize:10,color:'#7A6F62',fontWeight:600}}>Still Cooking</div>
              </div>
            </div>
            {readyDishes.length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:700,color:'#D4914A',marginBottom:8,textTransform:'uppercase',letterSpacing:0.8}}>⏳ Ready — Waiting for Transport</div>
                {readyDishes.map(function(d,i){return(
                  <div key={i} style={{display:'flex',gap:12,alignItems:'center',padding:'12px 14px',marginBottom:6,background:'#28150820',borderRadius:10,border:'1px solid #4A281040'}}>
                    {d.data.selfie?<img src={d.data.selfie} style={{width:44,height:44,borderRadius:10,objectFit:'cover',border:'2px solid #D4B44A'}}/>:<div style={{width:44,height:44,borderRadius:10,background:'#2A2520',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🍽</div>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#F5F0E8'}}>{d.name}</div>
                      <div style={{fontSize:11,color:'#7A6F62'}}>{d.ev.venue+' · '+d.ev.pax+' pax · By '+(d.data.completedBy||'Chef')+' at '+(d.data.completedAt||'')}</div>
                    </div>
                    <div style={{padding:'6px 12px',borderRadius:8,background:'#D4914A20',border:'1px solid #D4914A40',fontSize:11,color:'#D4914A',fontWeight:700}}>Ready</div>
                  </div>
                );})}
              </div>
            )}
            {dispatchedDishes.length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:700,color:'#3EAA68',marginBottom:8,textTransform:'uppercase',letterSpacing:0.8}}>🚛 Dispatch Marked</div>
                {dispatchedDishes.map(function(d,i){return(
                  <div key={i} style={{display:'flex',gap:12,alignItems:'center',padding:'12px 14px',marginBottom:6,background:'#0A201040',borderRadius:10,border:'1px solid #1A482840'}}>
                    {d.data.selfie?<img src={d.data.selfie} style={{width:44,height:44,borderRadius:10,objectFit:'cover',border:'2px solid #3EAA68'}}/>:<div style={{width:44,height:44,borderRadius:10,background:'#0A2010',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>✅</div>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#F5F0E8'}}>{d.name}</div>
                      <div style={{fontSize:11,color:'#7A6F62'}}>{d.ev.venue+' · By '+(d.data.dispatchMarkedBy||'Chef')+' at '+(d.data.dispatchMarkedAt||'')}</div>
                    </div>
                    <div style={{padding:'6px 12px',borderRadius:8,background:'#3EAA6820',border:'1px solid #3EAA6840',fontSize:11,color:'#3EAA68',fontWeight:700}}>🚛 Dispatched</div>
                  </div>
                );})}
              </div>
            )}
            {readyDishes.length===0&&dispatchedDishes.length===0&&(
              <div style={{textAlign:'center',padding:'40px 20px',color:'#7A6F62'}}>
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
        const allEvs = [...todayEvs,...tomorrowEvs,...laterEvs];

        function isDishReady(evId, dishName, dishIdx){
          const evKt = kt[evId]||{};
          // Format 1: KitchenHub writes to "evId|idx" key with .ready flag
          const dId = evId+"|"+dishIdx;
          const d = evKt[dId];
          if(d?.ready || d?.completed) return true;
          // Format 2: legacy "d_idx" key
          if(evKt[`d_${dishIdx}`]?.ready) return true;
          // Format 3: all steps done (steps[] + done[] arrays)
          if(d && Array.isArray(d.steps) && d.steps.length > 0 && Array.isArray(d.done) && d.done.length >= d.steps.length) return true;
          return false;
        }
        function isDishDispatched(evId, dishIdx){
          const evKt = kt[evId]||{};
          const dId = evId+"|"+dishIdx;
          return !!(evKt[dId]?.readyForDispatch || evKt[dId]?.dispatchReady || evKt[`d_${dishIdx}`]?.dispatchReady);
        }
        function getDishReadyTime(evId, dishIdx){
          const evKt = kt[evId]||{};
          const dId = evId+"|"+dishIdx;
          return evKt[dId]?.readyAt || evKt[dId]?.completedAt || evKt[`d_${dishIdx}`]?.readyAt || "";
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
          (ev.menu||[]).forEach((n,i)=>{const s=guessSectionForDish(n);if(!bySec[s])bySec[s]=[];bySec[s].push({name:n,idx:i});});
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
                  return (
                    <div key={ai} style={{background:C.bg,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.border}`,marginBottom:6}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:16}}>{v.icon}</span>
                        <select value={asgn.vehicleId} onChange={e=>{
                          setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,vehicleId:e.target.value})}));
                        }} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}>
                          {fleetList.map(fv=><option key={fv.id} value={fv.id}>{fv.icon} {fv.name}</option>)}
                        </select>
                        <input value={asgn.driver} placeholder={T2("Driver name")} onChange={e=>{
                          setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,driver:e.target.value})}));
                        }} style={{flex:1,minWidth:120,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}/>
                        <span style={{fontSize:12,fontWeight:700,color:C.gold}}>{asgn.dispatchTime}</span>
                        <button onClick={()=>{setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.filter((_,i2)=>i2!==ai)}));}} style={{padding:"6px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,cursor:"pointer",minHeight:32}}>✕</button>
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,fontWeight:700,color:sc,padding:"2px 8px",borderRadius:8,background:sc+"15"}}>{asgn.status}</span>
                        <span style={{fontSize:11,color:C.muted}}>{loadDone}/{loadTot} {T2("loaded")}</span>
                        {asgn.dispatchedAt&&<span style={{fontSize:10,color:C.muted}}>🚛 {asgn.dispatchedAt}</span>}
                        {asgn.arrivedAt&&<span style={{fontSize:10,color:C.muted}}>📍 {asgn.arrivedAt}</span>}
                        {asgn.unloadedAt&&<span style={{fontSize:10,color:C.green}}>✅ {asgn.unloadedAt}</span>}
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
                    const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                    const secReady=dishes.filter(d=>isDishReady(ev.id,d.name,d.idx)).length;
                    return (
                      <div key={sec} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:700,color:m.color}}>{m.icon} {T2(sec)}</span>
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
              const menu2r=[];(selEv.menu||[]).forEach((d,oi)=>{if(guessSectionForDish(d)!=="Beverages")menu2r.push({name:d,origIdx:oi});});
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
              fullMenu.forEach((n,origIdx)=>{if(guessSectionForDish(n)!=="Beverages")menu.push({name:n,origIdx});});
              const dispatch=dispatches.find(d=>d.evId===ev.id)||{assignments:[]};

              // Group by section
              const bySec2={};
              menu.forEach((item)=>{const s=guessSectionForDish(item.name);if(!bySec2[s])bySec2[s]=[];bySec2[s].push({name:item.name,idx:item.origIdx});});

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
                      return(
                        <div key={ai} style={{padding:"10px 0",borderBottom:ai<dispatch.assignments.length-1?`1px solid ${C.borderLight}`:"none"}}>
                          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            <span style={{fontSize:18}}>{v.icon}</span>
                            <select value={asgn.vehicleId} onChange={e=>setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,vehicleId:e.target.value})}))}
                              style={{padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}>
                              {fleetList.map(fv=><option key={fv.id} value={fv.id}>{fv.icon} {fv.name}</option>)}
                            </select>
                            <input value={asgn.driver} placeholder={T2("Driver name")} onChange={e=>setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.map((a2,a2i)=>a2i!==ai?a2:{...a2,driver:e.target.value})}))}
                              style={{flex:1,minWidth:100,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,color:C.text,minHeight:36}}/>
                            <span style={{fontSize:12,fontWeight:700,color:C.gold}}>{asgn.dispatchTime}</span>
                            <button onClick={()=>setDispatches(p=>p.map(dd=>dd.evId!==ev.id?dd:{...dd,assignments:dd.assignments.filter((_,i2)=>i2!==ai)}))}
                              style={{padding:"6px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,cursor:"pointer",minHeight:36}}>✕</button>
                          </div>
                          <div style={{display:"flex",gap:10,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:11,fontWeight:700,color:sc2,padding:"2px 8px",borderRadius:8,background:sc2+"15"}}>{asgn.status}</span>
                            {asgn.dispatchedAt&&<span style={{fontSize:10,color:C.muted}}>🚛 {asgn.dispatchedAt}</span>}
                            {asgn.arrivedAt&&<span style={{fontSize:10,color:C.muted}}>📍 {asgn.arrivedAt}</span>}
                            {asgn.unloadedAt&&<span style={{fontSize:10,color:C.green}}>✅ {asgn.unloadedAt}</span>}
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
                    const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
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
                            <span style={{fontSize:14,fontWeight:700,color:m.color}}>{m.icon} {T2(sec)}</span>
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

      {activeTab==="gps"&&(
        <div>
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>🗺 {T2("Live Fleet Map")} — Dwarka, Delhi</div>
              <span style={{fontSize:12,color:C.muted}}>{T2("Real-time tracking")}</span>
            </div>
            <div style={{position:"relative",width:"100%",height:380,background:"#0E1218",overflow:"hidden"}}>
              <svg width="100%" height="100%" style={{position:"absolute",inset:0}}>
                {[0,1,2,3,4,5,6,7,8].map(i=><line key={"h"+i} x1="0" y1={i*47.5} x2="100%" y2={i*47.5} stroke="#1A2030" strokeWidth="1"/>)}
                {[0,1,2,3,4,5,6,7,8,9,10].map(i=><line key={"v"+i} x1={i*10+"%"} y1="0" x2={i*10+"%"} y2="100%" stroke="#1A2030" strokeWidth="1"/>)}
                <path d="M 35% 40% L 20% 65%" stroke="#333" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
                <path d="M 35% 40% L 65% 35%" stroke="#333" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
                <path d="M 65% 35% L 75% 70%" stroke="#333" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
                <path d="M 35% 40% L 75% 70%" stroke="#333" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
              </svg>
              {[{name:"AP",x:35,y:40,color:"#D06040"},{name:"AE",x:65,y:35,color:"#5B8FD0"},{name:"MKT",x:20,y:65,color:"#2B8A50"},{name:"Restro",x:75,y:70,color:"#8A70C8"}].map(v=>(
                <div key={v.name} style={{position:"absolute",left:v.x+"%",top:v.y+"%",transform:"translate(-50%,-50%)"}}>
                  <div style={{width:14,height:14,borderRadius:"50%",background:v.color,border:"3px solid #fff",boxShadow:`0 0 12px ${v.color}80`}}/>
                  <div style={{position:"absolute",top:18,left:"50%",transform:"translateX(-50%)",whiteSpace:"nowrap",fontSize:11,fontWeight:700,color:v.color,textShadow:"0 1px 4px #000"}}>{v.name}</div>
                </div>
              ))}
              {VEHICLES.map((v,vi)=>{
                const g=gps[v.id]||{status:"At Base",speed:0};
                const sc=g.status==="En Route"?"#D4B44A":g.status==="At Venue"?"#2B8A50":"#555";
                const px=g.status==="En Route"?(20+vi*8)%80+10:g.status==="At Venue"?([20,65,75,20][vi%4]):35+vi*4;
                const py=g.status==="En Route"?(30+vi*6)%60+15:g.status==="At Venue"?([65,35,70,65][vi%4]):40+vi*3;
                return(
                  <div key={v.id} style={{position:"absolute",left:px+"%",top:py+"%",transform:"translate(-50%,-100%)",transition:"all 1s ease",zIndex:10}}>
                    <div style={{background:sc,color:"#fff",padding:"4px 8px",borderRadius:12,fontSize:10,fontWeight:700,whiteSpace:"nowrap",boxShadow:`0 2px 8px ${sc}60`,border:"1.5px solid #fff",display:"flex",gap:4,alignItems:"center"}}>
                      <span>{v.icon}</span><span>{v.name.slice(-4)}</span>{g.speed>0&&<span style={{opacity:.8}}>{g.speed}km/h</span>}
                    </div>
                    <div style={{width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:`6px solid ${sc}`,margin:"0 auto"}}/>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:12,padding:"10px 16px",borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
              {[{c:"#D4B44A",l:"En Route"},{c:"#2B8A50",l:"At Venue"},{c:"#555",l:"At Base"}].map(s=>(
                <div key={s.l} style={{display:"flex",gap:4,alignItems:"center"}}><div style={{width:10,height:10,borderRadius:"50%",background:s.c}}/><span style={{fontSize:11,color:C.muted}}>{T2(s.l)}</span></div>
              ))}
              {[{c:"#D06040",l:"AP"},{c:"#5B8FD0",l:"AE"},{c:"#2B8A50",l:"MKT"},{c:"#8A70C8",l:"Restro"}].map(s=>(
                <div key={s.l} style={{display:"flex",gap:4,alignItems:"center"}}><div style={{width:8,height:8,borderRadius:"50%",background:s.c,border:"1.5px solid #fff"}}/><span style={{fontSize:11,color:C.muted}}>{s.l}</span></div>
              ))}
            </div>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:12}}>
            {VEHICLES.map(v=>{
              const p2=gps[v.id]||{status:"Unknown",speed:0};
              const sc2=p2.status==="En Route"?C.gold:p2.status==="At Venue"?C.green:C.muted;
              return (
                <div key={v.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:18}}>{v.icon}</span>
                    <div style={{fontSize:11,fontWeight:700,color:C.text}}>{v.name}</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:sc2}}>{p2.status}</div>
                  {p2.speed>0&&<div style={{fontSize:11,color:C.muted}}>{p2.speed} km/h</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}


    </div>
  );
}


export { TransportDispatch };
