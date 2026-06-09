// Ambria FnB — Dashboard
import React, { useState } from "react";
import { C, SECTION_META, AMBRIA_VENUES } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, TODAY_LABEL, CUR_YEAR, safeArr, safePct } from '../utils/helpers.js';
import { Avatar, DonutChart, Card, Btn, Chip } from './SharedUI.jsx';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { guessSectionForDish } from '../data/recipeData.js';

function Dashboard({attendance,events,setEvents,leaves,setScreen,kitchenTracking,repairs=[],lang="en",currentUser=null}) {
  const T2 = s => T(s, lang);
  const safeEvs = Array.isArray(events)?events.filter(e=>e&&typeof e.date==="string"&&e.date.length===10):[];
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = TODAY; // use the app-level TODAY constant (local date, not UTC-shifted)
  const MO_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const VENUES = ["Ambria Pushpanjali","Ambria Exotica","Manaktala Farm","Outdoor Catering (ODC)"];
  const pad = n => String(n).padStart(2,"0");

  const VP = {
    "Ambria Pushpanjali":{code:"AP",c:"#D06040",bg:C.redBg},
    "Ambria Exotica":{code:"AE",c:"#C08A15",bg:C.goldBg},
    "Manaktala Farm":{code:"MKT",c:"#D4A843",bg:"#1A1610"},
    "Ambria Restro":{code:"AR",c:"#50B0A0",bg:"#0E1E1A"},
    "Outdoor Catering (ODC)":{code:"ODC",c:"#8A70C8",bg:"#14101E"},
    "Ambria Manaktala":{code:"AM",c:"#B05A10",bg:"#1A1610"},
    "Ambria Cuisine":{code:"AC",c:"#185FA5",bg:"#EEF4FD"},
  };
  const gp = v => VP[v]||{code:"EV",c:C.wine,bg:C.wineBg};
  const TYPE_ICONS={"Wedding":"💍","Reception":"🥂","Corporate":"💼","Outdoor":"🌿","Birthday":"🎂","Other":"🎉"};

  // State
  const [yr, setYr] = useState(today.getFullYear());
  const [mo, setMo] = useState(today.getMonth());
  const [sel, setSel] = useState(todayStr);
  const [openEv, setOpenEv] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [venFil, setVenFil] = useState("All");
  const [form, setForm] = useState({guest:"",venue:"Ambria Pushpanjali",date:"",time:"7:30 PM",type:"Wedding",pax:"",veg:"",nonveg:"",menuPackage:"",menu:"",special:""});
  const [closureEv, setClosureEv] = useState(null);
  const [closureRemark, setClosureRemark] = useState("");
  const [closureRating, setClosureRating] = useState("");

  // FY
  const FY_START=`${today.getFullYear()}-04-01`, FY_END=`${today.getFullYear()+1}-03-31`;
  const fyEvs=safeEvs.filter(ev=>ev.date>=FY_START&&ev.date<=FY_END);
  const fyUpcoming=fyEvs.filter(ev=>ev.date>=todayStr);
  const fyPast=fyEvs.filter(ev=>ev.date<todayStr);

  // Calendar
  const filtered = venFil==="All"?safeEvs:safeEvs.filter(e=>e.venue===venFil);
  const first = new Date(yr,mo,1).getDay();
  const dim = new Date(yr,mo+1,0).getDate();
  const prevDim = new Date(yr,mo,0).getDate();
  const cells=[];
  for(let i=first-1;i>=0;i--) cells.push({d:prevDim-i,c:false});
  for(let i=1;i<=dim;i++) cells.push({d:i,c:true});
  while(cells.length<42) cells.push({d:cells.length-first-dim+1,c:false});
  const cd = cell=>cell.c?`${yr}-${pad(mo+1)}-${pad(cell.d)}`:null;
  const eod = d=>filtered.filter(e=>e.date===d);
  const prev = ()=>{if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1);};
  const next = ()=>{if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1);};

  const selEvs = sel?eod(sel):[];
  const todayEvs = eod(todayStr);
  const upcoming = filtered.filter(e=>e.date>todayStr).sort((a,b)=>a.date.localeCompare(b.date));
  const monthEvs = filtered.filter(e=>(e.date||"").startsWith(`${yr}-${pad(mo+1)}`));
  const monthPax = monthEvs.reduce((s,e)=>s+(+e.pax||0),0);

  function genId(){const ns=safeEvs.map(e=>+(e.id||"").replace(/\D/g,"")).filter(Boolean);return `FP-${new Date().getFullYear()}-${String(Math.max(0,...ns)+1).padStart(3,"0")}`;}
  function openAdd(dt){setForm({guest:"",venue:"Ambria Pushpanjali",date:dt||"",time:"7:30 PM",type:"Wedding",pax:"",veg:"",nonveg:"",menuPackage:"",menu:"",special:""});setEditId(null);setShowForm(true);}
  function openEdit(ev){setForm({guest:ev.guest||"",venue:ev.venue||"Ambria Pushpanjali",date:ev.date||"",time:ev.time||"7:30 PM",type:ev.type||"Wedding",pax:String(ev.pax||""),veg:String(ev.veg||""),nonveg:String(ev.nonveg||""),menuPackage:ev.menuPackage||"",menu:(ev.menu||[]).join(", "),special:ev.special||""});setEditId(ev.id);setShowForm(true);}
  function saveForm(){
    if(!form.guest||!form.date||!form.pax)return;
    const mi=form.menuPackage&&MENU_PACKAGES[form.menuPackage]?MENU_PACKAGES[form.menuPackage]:(form.menu||"").split(",").map(s=>s.trim()).filter(Boolean);
    const d={...form,pax:+form.pax,veg:+form.veg||0,nonveg:+form.nonveg||0,menu:mi};
    if(editId){setEvents(p=>(p||[]).map(e=>e.id!==editId?e:{...e,...d}));}else{setEvents(p=>[...(p||[]),{id:genId(),...d,extras:[]}]);}
    setShowForm(false);setEditId(null);setSel(form.date);
  }
  function delEv(id){setEvents(p=>(p||[]).filter(e=>e.id!==id));setDeleteId(null);setOpenEv(null);}
  const fld={width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"};

  return (
    <div>
      {/* ── Delete modal ── */}
      {deleteId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:14,padding:"22px 26px",maxWidth:320,textAlign:"center"}}>
            <div style={{fontSize:26,marginBottom:6}}>🗑</div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14}}>{T2("Delete this function?")} {(safeEvs.find(e=>e.id===deleteId)||{}).guest}</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn onClick={()=>delEv(deleteId)} color={C.red} style={{fontSize:12,padding:"7px 18px"}}>{T2("Delete")}</Btn>
              <Btn onClick={()=>setDeleteId(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>{T2("Cancel")}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit modal ── */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.surface,borderRadius:14,width:"100%",maxWidth:520,maxHeight:"88vh",overflow:"auto"}}>
            <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.surface,zIndex:1}}>
              <span style={{fontSize:14,fontWeight:700,color:C.text}}>{editId?`✏️ ${T2("Edit Function")}`:`➕ ${T2("New Function")}`}</span>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.muted}}>×</button>
            </div>
            <div style={{padding:"14px 18px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:10}}>
                <div style={{gridColumn:"1/-1"}}><div style={{fontSize:11,color:C.muted,marginBottom:2,fontWeight:600}}>{T2("GUEST NAME *")}</div><input value={form.guest} onChange={e=>setForm(p=>({...p,guest:e.target.value}))} placeholder="e.g. Sharma Wedding" style={fld} autoFocus/></div>
                {[{l:T2("VENUE"),k:"venue",t:"sel",o:VENUES},{l:T2("TYPE"),k:"type",t:"sel",o:["Wedding","Reception","Corporate","Birthday","Other"]},{l:T2("DATE *"),k:"date",t:"date"},{l:T2("TIME"),k:"time",ph:"7:30 PM"},{l:T2("TOTAL PAX *"),k:"pax",t:"number",ph:"500"},{l:T2("VEG"),k:"veg",t:"number",ph:"300"},{l:T2("NON-VEG"),k:"nonveg",t:"number",ph:"200"},{l:T2("MENU PACKAGE"),k:"menuPackage",t:"sel",o:["(Custom)",...Object.keys(MENU_PACKAGES)]}].map(f=>(
                  <div key={f.k}><div style={{fontSize:11,color:C.muted,marginBottom:2,fontWeight:600}}>{f.l}</div>
                    {f.t==="sel"?<select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={fld}>{f.o.map(o=><option key={o}>{o}</option>)}</select>
                    :<input type={f.t||"text"} value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>}
                  </div>
                ))}
                {form.menuPackage&&form.menuPackage!=="(Custom)"&&<div style={{gridColumn:"1/-1",background:C.wineBg,borderRadius:8,padding:"6px 10px",fontSize:11,color:C.gold}}>📋 {(MENU_PACKAGES[form.menuPackage]||[]).length} {T2("dishes")} — {form.menuPackage}</div>}
                {(!form.menuPackage||form.menuPackage==="(Custom)")&&<div style={{gridColumn:"1/-1"}}><div style={{fontSize:11,color:C.muted,marginBottom:2,fontWeight:600}}>{T2("CUSTOM MENU")}</div><textarea value={form.menu} onChange={e=>setForm(p=>({...p,menu:e.target.value}))} placeholder="Dal Makhni, Paneer Tikka…" style={{...fld,height:44,resize:"none"}}/></div>}
                <div style={{gridColumn:"1/-1"}}><div style={{fontSize:11,color:C.muted,marginBottom:2,fontWeight:600}}>{T2("SPECIAL INSTRUCTIONS")}</div><input value={form.special} onChange={e=>setForm(p=>({...p,special:e.target.value}))} placeholder="Jain, no onion-garlic…" style={fld}/></div>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <Btn onClick={()=>{setShowForm(false);setEditId(null);}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>{T2("Cancel")}</Btn>
                <Btn onClick={saveForm} color={C.wine} style={{fontSize:12,padding:"8px 20px"}} disabled={!form.guest||!form.date||!form.pax}>{editId?T2("Save Changes"):T2("Add Function ✓")}</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ OPERATIONAL KPI TILES ══ */}
      {(()=>{
        const staffToday = Object.values(attendance||{}).filter(r=>r.date===TODAY&&r.status==="Present").length;
        const allStaff = Object.keys(attendance||{}).length||1;
        const lowStockCount = (typeof INIT!=="undefined"?INIT:[]).filter(i=>i.inStock<=i.minStock&&i.inStock>=0).length;
        const todayPax = todayEvs.reduce((s,e)=>s+(+e.pax||0),0);
        const kitchenKt = kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        const readyDishes = Object.values(kitchenKt).reduce((s,ev)=>s+Object.values(ev||{}).filter(d=>d&&d.ready).length,0);
        const openRepairs = safeArr(repairs).filter(t=>t.status==="Open"||t.status==="In Progress").length;
        var dispatchReady=0;
        safeArr(events).forEach(function(ev){Object.keys(kitchenKt[ev.id]||{}).forEach(function(k){var d=(kitchenKt[ev.id]||{})[k];if(d&&(d.completed||d.ready)&&!d.readyForDispatch)dispatchReady++;});});
        return(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
            {[
              {icon:"🎉",l:T2("Today"),v:todayEvs.length,sub:todayPax?`${todayPax.toLocaleString()} pax`:`${upcoming.slice(0,1).map(e=>e.guest).join("")||T2("No events")}`,c:C.gold,bg:C.goldBg,bdr:C.goldBorder,action:()=>setScreen&&setScreen("kitchen")},
              {icon:"📋",l:T2("This Month"),v:monthEvs.length,sub:`${monthPax.toLocaleString()} pax`,c:C.blue,bg:C.blueBg,bdr:C.blueBorder},
              {icon:"📅",l:T2("FY Total"),v:fyEvs.length,sub:`${fyUpcoming.length} ${T2("upcoming")}`,c:C.purple,bg:C.purpleBg,bdr:C.purpleBorder},
              {icon:"👨‍🍳",l:T2("Staff Today"),v:staffToday,sub:`${T2("of")} ${allStaff} ${T2("total")}`,c:staffToday>0?C.green:C.red,bg:staffToday>0?C.greenBg:C.redBg,bdr:staffToday>0?C.greenBorder:C.redBorder,action:()=>setScreen&&setScreen("team")},
              {icon:"📦",l:T2("Low Stock"),v:lowStockCount,sub:T2("items need reorder"),c:lowStockCount>0?C.amber:C.green,bg:lowStockCount>0?C.amberBg:C.greenBg,bdr:lowStockCount>0?C.amberBorder:C.greenBorder,action:()=>setScreen&&setScreen("store")},
              {icon:"🔧",l:T2("Open Issues"),v:openRepairs,sub:T2("repair tickets"),c:openRepairs>0?C.red:C.green,bg:openRepairs>0?C.redBg:C.greenBg,bdr:openRepairs>0?C.redBorder:C.greenBorder,action:()=>setScreen&&setScreen("repair")},
              {icon:"🚛",l:T2("Ready to Load"),v:dispatchReady,sub:T2("dishes awaiting transport"),c:dispatchReady>0?"#D4914A":C.green,bg:dispatchReady>0?"#28150820":C.greenBg,bdr:dispatchReady>0?"#4A281040":C.greenBorder,action:()=>setScreen&&setScreen("transport")},
            ].map(s=>(
              <div key={s.l} onClick={s.action||null} style={{background:s.bg,borderRadius:14,padding:"16px 14px",border:`1px solid ${s.bdr}`,cursor:s.action?"pointer":"default",transition:"all .2s"}}>
                <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                <div style={{fontSize:26,fontWeight:800,color:s.c,lineHeight:1,letterSpacing:-1}}>{s.v}</div>
                <div style={{fontSize:12,fontWeight:600,color:C.muted,marginTop:5}}>{s.l}</div>
                {s.sub&&<div style={{fontSize:11,color:s.c,marginTop:2}}>{s.sub}</div>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ══ UPCOMING EVENTS STRIP ══ */}
      {upcoming.length>0&&(
        <Card style={{marginBottom:16,padding:"14px 18px"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10,fontFamily:"var(--font-display)",letterSpacing:.4}}>📅 {T2("Upcoming Functions")} <span style={{fontSize:11,color:C.muted,fontWeight:400}}>({upcoming.length})</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {upcoming.slice(0,4).map(ev=>{
              const vp=gp(ev.venue);const daysDiff=Math.round((new Date(ev.date+"T00:00")-new Date(TODAY+"T00:00"))/(864e5));
              return(
                <div key={ev.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",background:C.darkCard,borderRadius:10,border:`1px solid ${C.border}`}}>
                  <div style={{width:38,height:38,borderRadius:10,background:vp.c+"15",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:800,color:vp.c,lineHeight:1}}>{new Date(ev.date+"T00:00").getDate()}</div>
                    <div style={{fontSize:9,color:vp.c}}>{new Date(ev.date+"T00:00").toLocaleString("en",{month:"short"})}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.guest}</div>
                    <div style={{fontSize:11,color:C.muted}}>{vp.code} · {ev.time} · {ev.pax} pax</div>
                  </div>
                  <div style={{textAlign:"center",flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:daysDiff===1?C.amber:vp.c}}>{daysDiff===1?"Tomorrow":daysDiff+"d"}</div>
                    <div style={{fontSize:10,color:C.muted}}>{ev.menuPackage?.split(" ").slice(0,2).join(" ")||"Custom"}</div>
                  </div>
                </div>
              );
            })}
            {upcoming.length>4&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"6px 0"}}>+{upcoming.length-4} {T2("more")}</div>}
          </div>
        </Card>
      )}

      {/* ══ CALENDAR ══ */}
      <Card style={{marginBottom:20,padding:0,overflow:"hidden"}}>
        {/* Month nav */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={prev} style={{background:C.darkCard,border:`1px solid ${C.border}`,borderRadius:10,width:40,height:40,cursor:"pointer",fontSize:16,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:"var(--font-display)",minWidth:180,textAlign:"center"}}>{MO_FULL[mo]} {yr}</div>
            <button onClick={next} style={{background:C.darkCard,border:`1px solid ${C.border}`,borderRadius:10,width:40,height:40,cursor:"pointer",fontSize:16,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>{setYr(today.getFullYear());setMo(today.getMonth());setSel(todayStr);}} style={{padding:"8px 14px",borderRadius:10,background:C.wineBg,border:`1px solid ${C.wineBorder}`,color:C.gold,fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>{T2("Today")}</button>
            <button onClick={()=>openAdd(sel||todayStr)} style={{padding:"8px 16px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>+ {T2("Add")}</button>
          </div>
        </div>
        {/* Venue filter */}
        <div style={{display:"flex",gap:6,padding:"10px 18px",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
          {["All",...VENUES].map(v=>{
            const p=v==="All"?{c:C.text}:gp(v);const on=venFil===v;
            return <button key={v} onClick={()=>setVenFil(v)} style={{padding:"6px 14px",borderRadius:10,fontSize:12,fontWeight:on?700:400,cursor:"pointer",background:on?p.c+"20":"transparent",color:on?p.c:C.muted,border:`1.5px solid ${on?p.c:C.border}`,minHeight:36}}>{v==="All"?"All":(VP[v]||{}).code||v.slice(0,3)}</button>;
          })}
        </div>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {DY.map(d=><div key={d} style={{textAlign:"center",fontSize:13,fontWeight:700,color:C.muted,padding:"8px 0",background:C.bg}}>{d}</div>)}
        </div>
        {/* Cells */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {cells.map((cell,i)=>{
            const dt=cd(cell);const evs2=dt?eod(dt):[];const isT=dt===todayStr;const isS=dt===sel;
            const row=Math.floor(i/7);
            const vCols=[...new Set(evs2.map(e=>gp(e.venue).c))];
            return (
              <div key={i} onClick={()=>{if(!dt)return;setSel(isS?null:dt);setOpenEv(null);}} onDoubleClick={()=>{if(dt)openAdd(dt);}}
                style={{height:64,padding:"6px 8px",cursor:dt?"pointer":"default",
                  borderBottom:row<5?`1px solid ${C.borderLight}`:"none",borderRight:(i%7)<6?`1px solid ${C.borderLight}`:"none",
                  background:isS?C.wine+"20":isT?C.wine+"08":"transparent",opacity:cell.c?1:.15}}>
                <div style={{fontSize:14,fontWeight:isT||isS?800:500,color:isS?C.wine:isT?C.gold:C.text}}>{cell.d}</div>
                {vCols.length>0&&<div style={{display:"flex",gap:3,marginTop:4}}>{vCols.slice(0,4).map((col,ci)=><div key={ci} style={{width:8,height:8,borderRadius:"50%",background:col}}/>)}</div>}
                {evs2.length>1&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{evs2.length} fn</div>}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{display:"flex",gap:10,padding:"8px 18px",borderTop:`1px solid ${C.border}`}}>
          {Object.entries(VP).filter(([k])=>VENUES.includes(k)).map(([v,p])=>(
            <div key={v} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:p.c}}/><span style={{fontSize:11,color:C.muted}}>{p.code}</span></div>
          ))}
        </div>
      </Card>

      {/* ══ SELECTED DATE EVENTS (below calendar, full width) ══ */}
      {sel&&(
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:16,fontWeight:800,color:C.text}}>{new Date(sel+"T00:00").toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>
              {sel===todayStr&&<span style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:C.gold,color:"#fff",fontWeight:700}}>{T2("Today")}</span>}
            </div>
            <button onClick={()=>openAdd(sel)} style={{padding:"10px 18px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>+ {T2("Add Function")}</button>
          </div>
          {selEvs.length===0?(
            <div style={{background:C.surface,borderRadius:12,padding:20,textAlign:"center",fontSize:13,color:C.muted,border:`1px solid ${C.border}`}}>{T2("No functions on this date")}</div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:selEvs.length===1?"1fr":"1fr 1fr",gap:10}}>
              {selEvs.map(ev=>{
                const p=gp(ev.venue);const isO=openEv===ev.id;
                return (
                  <div key={ev.id} style={{background:C.surface,border:`2px solid ${isO?p.c:C.border}`,borderRadius:14,overflow:"hidden"}}>
                    <div onClick={()=>setOpenEv(isO?null:ev.id)} style={{padding:"14px 16px",cursor:"pointer",borderLeft:`4px solid ${p.c}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:15,fontWeight:700,color:C.text}}>{ev.guest}</div>
                          <div style={{fontSize:12,color:C.muted,marginTop:3}}>⏰ {ev.time} · 👥 {ev.pax} {T2("pax")} · 📍 {ev.venue}</div>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,padding:"4px 10px",borderRadius:8,background:p.bg,color:p.c}}>{p.code}</span>
                      </div>
                      {ev.menuPackage&&<div style={{fontSize:12,color:C.gold,marginTop:4}}>📜 {ev.menuPackage}</div>}
                      {ev.special&&<div style={{fontSize:12,color:C.amber,marginTop:3}}>⚠ {ev.special}</div>}
                    </div>
                    {isO&&(
                      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,background:C.bg}}>
                        <div style={{fontSize:12,color:C.text,marginBottom:8}}>📍 {ev.venue} · {TYPE_ICONS[ev.type]||"🎉"} {T2(ev.type)} · {T2("VEG")}:{ev.veg||ev.pax} / {T2("NON-VEG")}:{ev.nonveg||0} · ID: {ev.id}</div>
                        {ev.menuPackage&&<div style={{fontSize:12,color:C.muted,marginBottom:8}}>🍽 {(ev.menu||[]).filter(d=>guessSectionForDish(d)!=="Beverages").length} {T2("dishes")}</div>}
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>openEdit(ev)} style={{flex:1,padding:"10px",borderRadius:10,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>✏ {T2("Edit")}</button>
                          <button onClick={()=>setDeleteId(ev.id)} style={{padding:"10px 14px",borderRadius:10,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>🗑</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TODAY'S LIVE EVENTS ══ */}
      {todayEvs.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:800,color:C.text,fontFamily:"var(--font-display)",marginBottom:12}}>🔴 {T2("Live today")} — {todayEvs.length} {T2("functions")}</div>
          <div style={{display:"grid",gridTemplateColumns:todayEvs.length===1?"1fr":"1fr 1fr",gap:12}}>
            {todayEvs.map(ev=>{
              const p=gp(ev.venue);
              return (
                <div key={ev.id} style={{background:C.surface,border:`2px solid ${p.c}40`,borderRadius:14,overflow:"hidden"}}>
                  <div style={{height:4,background:p.c}}/>
                  <div style={{padding:"16px 18px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <span style={{fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:8,background:p.bg,color:p.c}}>{p.code}</span>
                        <div style={{fontSize:16,fontWeight:800,color:C.text,marginTop:6}}>{ev.guest}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:20,fontWeight:700,color:p.c}}>{ev.pax}</div>
                        <div style={{fontSize:12,color:C.muted}}>{T2("pax")}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:12,color:C.muted}}>
                      <span>⏰ {ev.time}</span>
                      <span>📍 {ev.venue}</span>
                      {ev.menuPackage&&<span style={{color:C.gold}}>📜 {ev.menuPackage}</span>}
                    </div>
                    {ev.special&&<div style={{marginTop:6,fontSize:12,color:C.amber}}>⚠ {ev.special}</div>}
                    {/* Event Closure Report button */}
                    <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                      <button onClick={()=>setClosureEv(closureEv?.id===ev.id?null:ev)} style={{width:"100%",padding:"10px",borderRadius:10,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>
                        📊 {T2("Event Closure Report")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ EVENT CLOSURE REPORT MODAL ══ */}
      {closureEv&&(()=>{
        const ev=closureEv;
        const kt=kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        const menu=(ev.menu||[]).filter(d=>{const sec=guessSectionForDish?.(d)||"";return sec!=="Beverages";});
        const readyDishes=menu.filter((_,i)=>{const d=kt[ev.id]?.[`d_${i}`];return d?.ready;});
        const dispatchDishes=menu.filter((_,i)=>{const d=kt[ev.id]?.[`d_${i}`];return d?.dispatchReady;});
        const notReady=menu.filter((_,i)=>{const d=kt[ev.id]?.[`d_${i}`];return !d?.ready;});
        const allStaffToday=Object.values(attendance||{}).filter(r=>r.date===TODAY&&r.status==="Present");
        const issues=["RM-001","RM-002","RM-003"].length; // open tickets
        return(
          <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
            <div style={{background:C.surface,borderRadius:20,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",border:`1px solid ${C.goldBorder}`,boxShadow:"0 32px 80px rgba(0,0,0,.7)"}}>
              {/* Header */}
              <div style={{position:"sticky",top:0,background:C.surface,padding:"18px 22px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:1}}>
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>📊 {T2("Event Closure Report")}</div>
                  <div style={{fontSize:12,color:C.gold,marginTop:2}}>{ev.guest} · {ev.date} · {ev.pax} pax</div>
                </div>
                <button onClick={()=>setClosureEv(null)} style={{background:"none",border:"none",fontSize:22,color:C.muted,cursor:"pointer",padding:4}}>✕</button>
              </div>

              <div style={{padding:"18px 22px"}}>
                {/* Summary tiles */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
                  {[
                    {l:T2("Dishes Ready"),v:readyDishes.length,t:menu.length,c:readyDishes.length===menu.length?C.green:C.amber},
                    {l:T2("Dispatched"),v:dispatchDishes.length,t:menu.length,c:C.blue},
                    {l:T2("Staff Present"),v:allStaffToday.length,t:"",c:C.teal},
                  ].map(s=>(
                    <div key={s.l} style={{background:C.darkCard,borderRadius:12,padding:"12px 10px",textAlign:"center",border:`1px solid ${s.c}20`}}>
                      <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}{s.t?"/"+s.t:""}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:3}}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Event details */}
                <Card style={{marginBottom:12,padding:"14px 16px",background:C.darkCard}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>📋 {T2("Event Details")}</div>
                  {[
                    {l:T2("Venue"),v:ev.venue},
                    {l:T2("Time"),v:ev.time},
                    {l:T2("Total Pax"),v:ev.pax+" pax ("+T2("Veg")+": "+(ev.veg||0)+", "+T2("Non-Veg")+": "+(ev.nonveg||0)+")"},
                    {l:T2("Menu Package"),v:ev.menuPackage||"Custom"},
                    {l:T2("Total Dishes"),v:menu.length+" dishes"},
                  ].map(r=>(
                    <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.borderLight}`,fontSize:12}}>
                      <span style={{color:C.muted}}>{r.l}</span>
                      <span style={{color:C.text,fontWeight:600,textAlign:"right",maxWidth:"60%"}}>{r.v}</span>
                    </div>
                  ))}
                </Card>

                {/* Kitchen status */}
                <Card style={{marginBottom:12,padding:"14px 16px",background:C.darkCard}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>👨‍🍳 {T2("Kitchen Summary")}</div>
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <div style={{flex:1,background:C.greenBg,borderRadius:8,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.green}}>{readyDishes.length}</div>
                      <div style={{fontSize:10,color:C.green}}>✅ {T2("Ready")}</div>
                    </div>
                    <div style={{flex:1,background:C.blueBg,borderRadius:8,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{dispatchDishes.length}</div>
                      <div style={{fontSize:10,color:C.blue}}>🚛 {T2("Dispatched")}</div>
                    </div>
                    <div style={{flex:1,background:C.redBg,borderRadius:8,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.red}}>{notReady.length}</div>
                      <div style={{fontSize:10,color:C.red}}>⏳ {T2("Pending")}</div>
                    </div>
                  </div>
                  {notReady.length>0&&<div style={{fontSize:11,color:C.amber,background:C.amberBg,borderRadius:8,padding:"6px 10px"}}>⚠ {T2("Pending")}: {notReady.slice(0,3).join(", ")}{notReady.length>3?` +${notReady.length-3} more`:""}</div>}
                </Card>

                {/* Staff summary */}
                <Card style={{marginBottom:12,padding:"14px 16px",background:C.darkCard}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>👥 {T2("Staff on Duty")}</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>{allStaffToday.length} {T2("staff present today")}</div>
                  {allStaffToday.length>0?(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {allStaffToday.slice(0,8).map((s,i)=>(
                        <span key={i} style={{fontSize:11,padding:"3px 10px",borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.text}}>{s.name||s.staffName||"Staff"}</span>
                      ))}
                      {allStaffToday.length>8&&<span style={{fontSize:11,color:C.muted}}>+{allStaffToday.length-8} {T2("more")}</span>}
                    </div>
                  ):<div style={{fontSize:11,color:C.muted}}>{T2("Attendance not marked yet")}</div>}
                </Card>

                {/* Special instructions outcome */}
                {ev.special&&(
                  <Card style={{marginBottom:12,padding:"14px 16px",background:C.amberBg,border:`1px solid ${C.amberBorder}`}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:4}}>⚠ {T2("Special Instructions")}</div>
                    <div style={{fontSize:12,color:C.text}}>{ev.special}</div>
                  </Card>
                )}

                {/* Closure remarks */}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>📝 {T2("Head Chef Remarks")}</div>
                  <textarea value={closureRemark} onChange={e=>setClosureRemark(e.target.value)} placeholder={T2("Overall quality, timing, issues, improvements needed…")} rows={3}
                    style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.bg,resize:"none",boxSizing:"border-box"}}/>
                </div>

                {/* Rating */}
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>⭐ {T2("Overall Rating")}</div>
                  <div style={{display:"flex",gap:8}}>
                    {[{v:"excellent",l:"🌟 "+T2("Excellent")},{v:"good",l:"✅ "+T2("Good")},{v:"average",l:"🟡 "+T2("Average")},{v:"needswork",l:"🔴 "+T2("Needs Work")}].map(r=>(
                      <button key={r.v} onClick={()=>setClosureRating(closureRating===r.v?"":r.v)}
                        style={{flex:1,padding:"10px 6px",borderRadius:10,border:`2px solid ${closureRating===r.v?C.gold:C.border}`,background:closureRating===r.v?C.goldBg:"transparent",color:closureRating===r.v?C.gold:C.muted,fontSize:11,fontWeight:closureRating===r.v?700:400,cursor:"pointer",minHeight:44}}>
                        {r.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>{
                    const report=`EVENT CLOSURE REPORT\n${"=".repeat(40)}\nEvent: ${ev.guest}\nDate: ${ev.date} · Time: ${ev.time}\nVenue: ${ev.venue}\nPax: ${ev.pax}\nMenu: ${ev.menuPackage||"Custom"}\n\nKITCHEN\nDishes Ready: ${readyDishes.length}/${menu.length}\nDispatched: ${dispatchDishes.length}/${menu.length}\n${notReady.length>0?"Pending: "+notReady.join(", ")+"\n":""}\nSTAFF\nPresent Today: ${allStaffToday.length}\n\nRATING: ${closureRating?.toUpperCase()||"Not rated"}\nREMARKS: ${closureRemark||"None"}\n\nGenerated: ${new Date().toLocaleString("en-IN")}`;
                    const blob=new Blob([report],{type:"text/plain"});
                    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Closure_${ev.guest.replace(/\s/g,"_")}_${ev.date}.txt`;a.click();
                  }} style={{flex:1,padding:"14px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:48,fontFamily:"var(--font-display)"}}>
                    ⬇ {T2("Download Report")}
                  </button>
                  <button onClick={()=>{setClosureEv(null);setClosureRemark("");setClosureRating("");}}
                    style={{padding:"14px 18px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:48}}>✕</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


    </div>
  );
}



// ─── TEAM, ATTENDANCE & DIRECTORY ────────────────────────────────

// ─── KIOSK ATTENDANCE ─────────────────────────────────────────────

export { Dashboard };
