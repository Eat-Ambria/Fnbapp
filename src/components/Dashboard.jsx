// Ambria FnB — Dashboard (light mode redesign)
import React, { useState } from "react";
import { C, SECTION_META, AMBRIA_VENUES } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, TODAY_LABEL, CUR_YEAR, safeArr, safePct } from '../utils/helpers.js';
import { Avatar, DonutChart, Card, Btn, Chip } from './SharedUI.jsx';
import { MenuEditor } from './MenuEditor.jsx';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { guessSectionForDish } from '../data/recipeData.js';
import { logActivity } from './ActivityLog.jsx';

function Dashboard({attendance,events,setEvents,leaves,setScreen,kitchenTracking,repairs=[],lang="en",currentUser=null,empDb=[]}) {
  const T2 = s => T(s, lang);
  const [lmsSyncing, setLmsSyncing] = useState(false);
  const [lmsResult, setLmsResult] = useState(null); // {status,events_upserted,...} or {status:'error',message}
  const [lmsLastSync, setLmsLastSync] = useState(null); // timestamp string

  // Check last sync time on mount
  React.useEffect(()=>{
    try{const t=localStorage.getItem('ambria_lms_last_sync');if(t)setLmsLastSync(t);}catch(e){}
  },[]);

  async function syncLms(){
    if(lmsSyncing)return;
    setLmsSyncing(true);setLmsResult(null);
    try{
      const { supabase } = await import('../lib/supabase.js');
      if(!supabase){setLmsResult({status:'error',message:'Supabase not connected'});setLmsSyncing(false);return;}
      const { data, error } = await supabase.functions.invoke('lms-sync',{
        body:{triggered_by:currentUser?.id||currentUser?.staff_id||'admin'}
      });
      if(error) throw new Error(error.message||'Edge function error');
      setLmsResult(data);
      const now=new Date().toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'});
      setLmsLastSync(now);
      try{localStorage.setItem('ambria_lms_last_sync',now);}catch(e){}
    }catch(err){
      setLmsResult({status:'error',message:err.message||String(err)});
    }
    setLmsSyncing(false);
  }
  const safeEvs = Array.isArray(events)?events.filter(e=>e&&typeof e.date==="string"&&e.date.length===10):[];
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = TODAY;
  const MO_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const VENUES = ["Ambria Pushpanjali","Ambria Exotica","Manaktala Farm","Outdoor Catering (ODC)"];
  const pad = n => String(n).padStart(2,"0");

  const VP = {
    "Ambria Pushpanjali":{code:"AP",c:"#D85A30",bg:"#FAECE7"},
    "Ambria Exotica":{code:"AE",c:"#BA7517",bg:"#FAEEDA"},
    "Manaktala Farm":{code:"MKT",c:"#8B5E2F",bg:"#FDF6EE"},
    "Ambria Restro":{code:"AR",c:"#1D9E75",bg:"#E1F5EE"},
    "Outdoor Catering (ODC)":{code:"ODC",c:"#7F77DD",bg:"#EEEDFE"},
    "Ambria Manaktala":{code:"AM",c:"#BA7517",bg:"#FAEEDA"},
    "Ambria Cuisine":{code:"AC",c:"#378ADD",bg:"#E6F1FB"},
  };
  const gp = v => VP[v]||{code:"EV",c:"#8B5E2F",bg:"#FDF6EE"};

  // State
  const [yr, setYr] = useState(today.getFullYear());
  const [mo, setMo] = useState(today.getMonth());
  const [venFil, setVenFil] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [openEv, setOpenEv] = useState(null);
  const [sel, setSel] = useState(todayStr);
  const [closureEv, setClosureEv] = useState(null);
  const [closureRemark, setClosureRemark] = useState("");
  const [closureRating, setClosureRating] = useState("");
  const [form, setForm] = useState({guest:"",venue:"Ambria Pushpanjali",date:"",time:"7:30 PM",type:"Wedding",pax:"",veg:"",nonveg:"",menuPackage:"",menu:"",special:""});

  // Computed
  const filtered = venFil==="All"?safeEvs:safeEvs.filter(e=>e.venue===venFil);
  const todayEvs = safeEvs.filter(e=>e.date===todayStr);
  const upcoming = filtered.filter(e=>e.date>todayStr).sort((a,b)=>a.date.localeCompare(b.date));
  const monthEvs = filtered.filter(e=>(e.date||"").startsWith(`${yr}-${pad(mo+1)}`));
  const monthPax = monthEvs.reduce((s,e)=>s+(+e.pax||0),0);
  const FY_START=`${today.getFullYear()}-04-01`, FY_END=`${today.getFullYear()+1}-03-31`;
  const fyEvs=safeEvs.filter(ev=>ev.date>=FY_START&&ev.date<=FY_END);

  // Kitchen stats
  const kt = kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
  const allDishCount = todayEvs.reduce((s,ev)=>{
    const menu = Array.isArray(ev.menu)?ev.menu:[];
    return s + menu.filter(d=>guessSectionForDish(d)!=="Beverages").length;
  },0);
  const readyDishes = Object.values(kt).reduce((s,ev)=>s+Object.values(ev||{}).filter(d=>d&&d.ready).length,0);
  let dispatchReady=0;
  safeEvs.forEach(ev=>{Object.keys(kt[ev.id]||{}).forEach(k=>{const d=(kt[ev.id]||{})[k];if(d&&(d.completed||d.ready)&&!d.readyForDispatch)dispatchReady++;});});

  // Staff stats
  const attArr = safeArr(attendance).filter(r=>r.date===TODAY);
  const staffPresent = attArr.filter(r=>r.status==="Present").length;
  const staffAbsent = attArr.filter(r=>r.status==="Absent").length;
  const onLeave = safeArr(leaves).filter(l=>l.status==="Approved"&&l.from<=todayStr&&l.to>=todayStr).length;
  const totalActive = safeArr(empDb).filter(s=>s.is_active!==false&&s.role!=='kiosk_gate'&&s.role!=='admin'&&!s.role?.startsWith('section_')).length;
  const totalStaff = totalActive || Math.max(staffPresent+staffAbsent, 1);
  const openRepairs = safeArr(repairs).filter(t=>t.status==="Open"||t.status==="In Progress").length;

  // Helpers
  function genId(){const ns=safeEvs.map(e=>+(e.id||"").replace(/\D/g,"")).filter(Boolean);return `FP-${new Date().getFullYear()}-${String(Math.max(0,...ns)+1).padStart(3,"0")}`;}
  function openAdd(dt){setForm({guest:"",venue:"Ambria Pushpanjali",date:dt||"",time:"7:30 PM",type:"Wedding",pax:"",veg:"",nonveg:"",menuPackage:"",menu:"",special:""});setEditId(null);setShowForm(true);}
  function openEdit(ev){const mp=ev.menuPackage||"";const resolvedPkg=MENU_PACKAGES[mp]?mp:"(Custom)";setForm({guest:ev.guest||"",venue:ev.venue||"Ambria Pushpanjali",date:ev.date||"",time:ev.time||"7:30 PM",type:ev.type||"Wedding",pax:String(ev.pax||""),veg:String(ev.veg||""),nonveg:String(ev.nonveg||""),menuPackage:mp&&MENU_PACKAGES[mp]?mp:"",menu:resolvedPkg==="(Custom)"?(ev.menu||[]).join(", "):"",special:ev.special||""});setEditId(ev.id);setShowForm(true);}
  function saveForm(){
    if(!form.guest||!form.date||!form.pax)return;
    const mi=form.menuPackage&&MENU_PACKAGES[form.menuPackage]?MENU_PACKAGES[form.menuPackage]:(form.menu||"").split(",").map(s=>s.trim()).filter(Boolean);
    const d={...form,pax:+form.pax,veg:+form.veg||0,nonveg:+form.nonveg||0,menu:mi};
    if(editId){setEvents(p=>(p||[]).map(e=>e.id!==editId?e:{...e,...d}));logActivity('system','Event updated: '+form.guest+' ('+editId+')','event_edit',{evId:editId,guest:form.guest,venue:form.venue,date:form.date},currentUser?.id);}else{const nid=genId();setEvents(p=>[...(p||[]),{id:nid,...d,extras:[]}]);logActivity('system','Event created: '+form.guest+' ('+nid+')','event_create',{evId:nid,guest:form.guest,venue:form.venue,date:form.date,pax:+form.pax},currentUser?.id);}
    setShowForm(false);setEditId(null);setSel(form.date);
  }
  function delEv(id){const ev=(events||[]).find(e=>e.id===id);setEvents(p=>(p||[]).filter(e=>e.id!==id));logActivity('system','Event deleted: '+(ev?.guest||id)+' ('+id+')','event_delete',{evId:id,guest:ev?.guest||''},currentUser?.id);setDeleteId(null);setOpenEv(null);}

  const fld={width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,boxSizing:"border-box"};
  const daysDiff = (d) => Math.round((new Date(d+"T00:00")-new Date(TODAY+"T00:00"))/(864e5));
  const daysLabel = (n) => n===0?"Today":n===1?"Tomorrow":n+"d";

  // Calendar
  const first = new Date(yr,mo,1).getDay();
  const dim = new Date(yr,mo+1,0).getDate();
  const prevDim = new Date(yr,mo,0).getDate();
  const cells=[];
  for(let i=first-1;i>=0;i--) cells.push({d:prevDim-i,c:false});
  for(let i=1;i<=dim;i++) cells.push({d:i,c:true});
  while(cells.length<42) cells.push({d:cells.length-first-dim+1,c:false});
  const cd = cell=>cell.c?`${yr}-${pad(mo+1)}-${pad(cell.d)}`:null;
  const eod = d=>filtered.filter(e=>e.date===d);
  const selEvs = sel?eod(sel):[];
  const prev = ()=>{if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1);};
  const next = ()=>{if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1);};
  const DY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div>
      {/* ── Delete modal ── */}
      {deleteId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:14,padding:"22px 26px",maxWidth:320,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
            <div style={{fontSize:16,fontWeight:500,color:C.text,marginBottom:14}}>Delete this function?</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:16}}>{(safeEvs.find(e=>e.id===deleteId)||{}).guest}</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>delEv(deleteId)} style={{padding:"8px 20px",borderRadius:8,background:"#D64040",color:"#fff",border:"none",fontSize:13,fontWeight:500,cursor:"pointer"}}>Delete</button>
              <button onClick={()=>setDeleteId(null)} style={{padding:"8px 20px",borderRadius:8,background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit modal ── */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:520,maxHeight:"88vh",overflow:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"#fff",zIndex:1}}>
              <span style={{fontSize:15,fontWeight:500,color:C.text}}>{editId?"Edit function":"New function"}</span>
              <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.muted}}>×</button>
            </div>
            <div style={{padding:"14px 18px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:10}}>
                <div style={{gridColumn:"1/-1"}}><div style={{fontSize:12,color:C.muted,marginBottom:2,fontWeight:500}}>Guest name *</div><input value={form.guest} onChange={e=>setForm(p=>({...p,guest:e.target.value}))} placeholder="e.g. Sharma Wedding" style={fld} autoFocus/></div>
                {[{l:"Venue",k:"venue",t:"sel",o:VENUES},{l:"Type",k:"type",t:"sel",o:["Wedding","Reception","Corporate","Birthday","Other"]},{l:"Date *",k:"date",t:"date"},{l:"Time",k:"time",ph:"7:30 PM"},{l:"Total pax *",k:"pax",t:"number",ph:"500"},{l:"Veg",k:"veg",t:"number",ph:"300"},{l:"Non-veg",k:"nonveg",t:"number",ph:"200"},{l:"Menu package",k:"menuPackage",t:"sel",o:["(Custom)",...Object.keys(MENU_PACKAGES)]}].map(f=>(
                  <div key={f.k}><div style={{fontSize:12,color:C.muted,marginBottom:2,fontWeight:500}}>{f.l}</div>
                    {f.t==="sel"?<select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={fld}>{f.o.map(o=><option key={o}>{o}</option>)}</select>
                    :<input type={f.t||"text"} value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>}
                  </div>
                ))}
                {form.menuPackage&&form.menuPackage!=="(Custom)"&&<div style={{gridColumn:"1/-1",background:C.amberBg,borderRadius:8,padding:"6px 10px",fontSize:12,color:C.amber}}>{(MENU_PACKAGES[form.menuPackage]||[]).length} dishes — {form.menuPackage}</div>}
                {(!form.menuPackage||form.menuPackage==="(Custom)")&&<div style={{gridColumn:"1/-1"}}><div style={{fontSize:12,color:C.muted,marginBottom:2,fontWeight:500}}>Custom menu</div><textarea value={form.menu} onChange={e=>setForm(p=>({...p,menu:e.target.value}))} placeholder="Dal Makhni, Paneer Tikka…" style={{...fld,height:44,resize:"none"}}/></div>}
                <div style={{gridColumn:"1/-1"}}><div style={{fontSize:12,color:C.muted,marginBottom:2,fontWeight:500}}>Special instructions</div><input value={form.special} onChange={e=>setForm(p=>({...p,special:e.target.value}))} placeholder="Jain, no onion-garlic…" style={fld}/></div>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{padding:"8px 18px",borderRadius:8,background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveForm} disabled={!form.guest||!form.date||!form.pax} style={{padding:"8px 18px",borderRadius:8,background:C.text,color:"#fff",border:"none",fontSize:13,fontWeight:500,cursor:"pointer",opacity:(!form.guest||!form.date||!form.pax)?.5:1}}>{editId?"Save changes":"Add function"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ STAT CARDS ══ */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[
          {label:"Today",value:todayEvs.length,sub:todayEvs.length>0?todayEvs.reduce((s,e)=>s+(+e.pax||0),0).toLocaleString()+" pax":"No events",color:"#D64040",borderColor:"#D64040",live:todayEvs.length>0,action:()=>setScreen&&setScreen("kitchen")},
          {label:"Staff on duty",value:staffPresent,sub:totalActive?`of ${totalActive} · ${onLeave} on leave`:`${staffAbsent} absent · ${onLeave} on leave`,color:"#378ADD",borderColor:"#378ADD",action:()=>setScreen&&setScreen("team")},
          {label:"Kitchen",value:`${readyDishes}/${allDishCount||"—"}`,sub:"dishes ready",color:"#1D9E75",borderColor:"#1D9E75",action:()=>setScreen&&setScreen("kitchen")},
          {label:"Dispatch",value:dispatchReady,sub:"awaiting pickup",color:"#BA7517",borderColor:"#BA7517",action:()=>setScreen&&setScreen("transport")},
        ].map(s=>(
          <div key={s.label} onClick={s.action||null} style={{background:"#fff",border:`0.5px solid ${C.border}`,borderLeft:`3px solid ${s.borderColor}`,borderRadius:12,padding:"14px 18px",cursor:s.action?"pointer":"default"}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:28,fontWeight:500,color:s.color,lineHeight:1.1}}>{s.value}</div>
            <div style={{fontSize:12,color:s.color=="#D64040"&&s.live?s.color:C.muted,marginTop:4}}>
              {s.live&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:12,background:"#FCEBEB",color:"#A32D2D",marginRight:6}}><span style={{width:6,height:6,borderRadius:"50%",background:"#D64040",animation:"pulse 1.5s infinite"}}></span>Live</span>}
              {s.sub}
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* ══ TODAY'S EVENTS ══ */}
      {todayEvs.length>0&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:16,fontWeight:500,color:C.text,marginBottom:12}}>Today's events <span style={{fontSize:13,color:C.muted,fontWeight:400}}>{todayEvs.length} functions · {todayEvs.reduce((s,e)=>s+(+e.pax||0),0).toLocaleString()} pax</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {todayEvs.map(ev=>{
              const p=gp(ev.venue);
              const evMenu = Array.isArray(ev.menu)?ev.menu.filter(d=>guessSectionForDish(d)!=="Beverages"):[];
              const evReady = evMenu.filter((_,i)=>{const d=kt[ev.id]?.[ev.id+"|"+i];return d?.ready;}).length;
              return(
                <div key={ev.id} onClick={()=>setOpenEv(openEv===ev.id?null:ev.id)} style={{background:"#fff",border:`0.5px solid ${C.border}`,borderLeft:`3px solid ${p.c}`,borderRadius:12,padding:"14px 18px",cursor:"pointer"}}>
                  <div style={{display:"flex",gap:14,alignItems:"center"}}>
                    <div style={{width:44,height:44,borderRadius:8,background:p.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <div style={{fontSize:18,fontWeight:500,color:p.c,lineHeight:1}}>{new Date(ev.date+"T00:00").getDate()}</div>
                      <div style={{fontSize:9,fontWeight:500,color:p.c,textTransform:"uppercase"}}>{new Date(ev.date+"T00:00").toLocaleString("en",{month:"short"})}</div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:500,color:C.text}}>{ev.guest}</div>
                      <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                        {ev.venue} · {ev.time} · {ev.menuPackage||"Custom"}
                        {ev.lms_source&&<span style={{marginLeft:6,fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:4,background:"#EEF4FD",color:"#378ADD",border:"1px solid #C8DDF4"}}>LMS</span>}
                      </div>
                      {evMenu.length>0&&<div style={{marginTop:4}}><span style={{fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:4,background:evReady>=evMenu.length?C.greenBg:C.amberBg,color:evReady>=evMenu.length?"#0F6E56":"#854F0B"}}>{evReady}/{evMenu.length} dishes ready</span></div>}
                      
                      {ev.special&&<div style={{fontSize:12,color:"#D64040",marginTop:3}}>{ev.special}</div>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:22,fontWeight:500,color:p.c}}>{ev.pax}</div>
                      <div style={{fontSize:11,color:C.muted}}>pax</div>
                    </div>
                  </div>
                  {openEv===ev.id&&(
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,display:"flex",gap:8}}>
                      <button onClick={e=>{e.stopPropagation();openEdit(ev);}} style={{flex:1,padding:"10px",borderRadius:8,background:C.text,color:"#fff",border:"none",fontSize:12,fontWeight:500,cursor:"pointer"}}>Edit</button>
                      <button onClick={e=>{e.stopPropagation();setDeleteId(ev.id);}} style={{padding:"10px 14px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:500,cursor:"pointer"}}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ UPCOMING EVENTS ══ */}
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:16,fontWeight:500,color:C.text}}>Upcoming <span style={{fontSize:13,color:C.muted,fontWeight:400}}>{upcoming.length} functions</span></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {currentUser?.role==='admin'&&(
              <button onClick={syncLms} disabled={lmsSyncing}
                style={{padding:"7px 14px",borderRadius:8,background:lmsSyncing?C.border:C.goldBg,border:`1px solid ${lmsSyncing?C.border:C.goldBorder}`,color:lmsSyncing?C.muted:C.gold,fontSize:12,fontWeight:500,cursor:lmsSyncing?"wait":"pointer",display:"flex",alignItems:"center",gap:6}}>
                {lmsSyncing?<span style={{display:"inline-block",width:12,height:12,border:`2px solid ${C.gold}`,borderTopColor:"transparent",borderRadius:"50%",animation:"lms-spin .8s linear infinite"}}/>:null}
                {lmsSyncing?"Syncing…":"↻ Sync LMS"}
              </button>
            )}
            <button onClick={()=>openAdd(todayStr)} style={{padding:"7px 16px",borderRadius:8,background:C.text,color:"#fff",border:"none",fontSize:12,fontWeight:500,cursor:"pointer"}}>+ Add function</button>
          </div>
        </div>
        {/* LMS sync status */}
        {lmsResult&&(
          <div style={{marginBottom:10,padding:"8px 14px",borderRadius:8,fontSize:12,
            background:lmsResult.status==='success'?C.greenBg:C.redBg,
            border:`1px solid ${lmsResult.status==='success'?C.greenBorder:C.redBorder}`,
            color:lmsResult.status==='success'?C.green:C.red,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>{lmsResult.status==='success'
              ?`✅ Synced ${lmsResult.events_upserted||0} events from LMS (${lmsResult.venue_rows||0} venue + ${lmsResult.catering_rows||0} catering contracts)`
              :`❌ Sync failed: ${lmsResult.message||'Unknown error'}`}</span>
            <button onClick={()=>setLmsResult(null)} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"inherit",padding:"0 4px"}}>×</button>
          </div>
        )}
        {lmsLastSync&&!lmsResult&&(
          <div style={{fontSize:11,color:C.faint,marginBottom:8}}>Last LMS sync: {lmsLastSync}</div>
        )}
        <style>{`@keyframes lms-spin{to{transform:rotate(360deg)}}`}</style>
        {/* Venue filter */}
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          {["All",...VENUES].map(v=>{
            const p=v==="All"?{c:C.text}:gp(v);const on=venFil===v;
            return <button key={v} onClick={()=>setVenFil(v)} style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:on?500:400,cursor:"pointer",background:on?"#F4F0E4":"transparent",color:on?C.text:C.muted,border:`0.5px solid ${on?C.text:C.border}`}}>{v==="All"?"All":(VP[v]||{}).code||v.slice(0,3)}</button>;
          })}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {upcoming.slice(0,6).map(ev=>{
            const p=gp(ev.venue);const dd=daysDiff(ev.date);
            // D-1 status for tomorrow's events
            const isD1 = dd===1;
            const evMenu = Array.isArray(ev.menu)?ev.menu.filter(d=>guessSectionForDish(d)!=="Beverages"):[];
            const d1Done = isD1?evMenu.filter((_,i)=>{const d=kt[ev.id]?.[ev.id+"|"+i];return d?.mesaDone;}).length:0;
            return(
              <div key={ev.id} onClick={()=>setOpenEv(openEv===ev.id?null:ev.id)} style={{background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:12,padding:"14px 18px",cursor:"pointer",display:"flex",gap:14,alignItems:"center"}}>
                <div style={{width:44,height:44,borderRadius:8,background:p.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontSize:18,fontWeight:500,color:p.c,lineHeight:1}}>{new Date(ev.date+"T00:00").getDate()}</div>
                  <div style={{fontSize:9,fontWeight:500,color:p.c,textTransform:"uppercase"}}>{new Date(ev.date+"T00:00").toLocaleString("en",{month:"short"})}</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:500,color:C.text}}>{ev.guest}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                    {(VP[ev.venue]||{}).code||"EV"} · {ev.time} · {ev.menuPackage||"Custom"}
                    {ev.lms_source&&<span style={{marginLeft:6,fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:4,background:"#EEF4FD",color:"#378ADD",border:"1px solid #C8DDF4"}}>LMS</span>}
                  </div>
                  {isD1&&evMenu.length>0&&<div style={{marginTop:4}}><span style={{fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:4,background:d1Done>0?C.greenBg:C.amberBg,color:d1Done>0?"#0F6E56":"#854F0B"}}>D-1 prep: {d1Done}/{evMenu.length} done</span></div>}
                  
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:20,fontWeight:500,color:p.c}}>{ev.pax}</div>
                  <div style={{fontSize:11,color:dd===1?"#BA7517":C.muted,fontWeight:dd===1?500:400}}>pax · {daysLabel(dd)}</div>
                </div>
              </div>
            );
          })}
          {upcoming.length>6&&<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:"8px 0"}}>+{upcoming.length-6} more</div>}
        </div>
      </div>

      {/* ══ CALENDAR ══ */}
      <div style={{background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={prev} style={{width:36,height:36,borderRadius:8,border:`0.5px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:16,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <div style={{fontSize:16,fontWeight:500,color:C.text,minWidth:160,textAlign:"center"}}>{MO_FULL[mo]} {yr}</div>
            <button onClick={next} style={{width:36,height:36,borderRadius:8,border:`0.5px solid ${C.border}`,background:"transparent",cursor:"pointer",fontSize:16,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
          </div>
          <button onClick={()=>{setYr(today.getFullYear());setMo(today.getMonth());setSel(todayStr);}} style={{padding:"7px 14px",borderRadius:8,background:C.bg,border:`0.5px solid ${C.border}`,color:C.text,fontSize:12,fontWeight:500,cursor:"pointer"}}>Today</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {DY.map(d=><div key={d} style={{textAlign:"center",fontSize:12,fontWeight:500,color:C.muted,padding:"8px 0",background:C.bg}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {cells.map((cell,i)=>{
            const dt=cd(cell);const evs2=dt?eod(dt):[];const isT=dt===todayStr;const isS=dt===sel;
            const vCols=[...new Set(evs2.map(e=>gp(e.venue).c))];
            return(
              <div key={i} onClick={()=>{if(!dt)return;setSel(isS?null:dt);setOpenEv(null);}} onDoubleClick={()=>{if(dt)openAdd(dt);}}
                style={{height:56,padding:"6px 8px",cursor:dt?"pointer":"default",
                  borderBottom:`1px solid ${C.borderLight}`,borderRight:(i%7)<6?`1px solid ${C.borderLight}`:"none",
                  background:isS?C.blueBg:isT?"#FAEEDA":"transparent",opacity:cell.c?1:.2}}>
                <div style={{fontSize:13,fontWeight:isT||isS?500:400,color:isS?"#378ADD":isT?"#BA7517":C.text}}>{cell.d}</div>
                {vCols.length>0&&<div style={{display:"flex",gap:3,marginTop:3}}>{vCols.slice(0,4).map((col,ci)=><div key={ci} style={{width:7,height:7,borderRadius:"50%",background:col}}/>)}</div>}
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:12,padding:"8px 18px",borderTop:`1px solid ${C.border}`}}>
          {Object.entries(VP).filter(([k])=>VENUES.includes(k)).map(([v,p])=>(
            <div key={v} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:7,height:7,borderRadius:"50%",background:p.c}}/><span style={{fontSize:11,color:C.muted}}>{p.code}</span></div>
          ))}
        </div>
      </div>

      {/* ══ SELECTED DATE ══ */}
      {sel&&selEvs.length>0&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:14,fontWeight:500,color:C.text,marginBottom:10}}>{new Date(sel+"T00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>
          <div style={{display:"grid",gridTemplateColumns:selEvs.length===1?"1fr":"1fr 1fr",gap:10}}>
            {selEvs.map(ev=>{
              const p=gp(ev.venue);
              return(
                <div key={ev.id} style={{background:"#fff",border:`0.5px solid ${C.border}`,borderLeft:`3px solid ${p.c}`,borderRadius:12,padding:"14px 18px"}}>
                  <div style={{fontSize:14,fontWeight:500,color:C.text}}>{ev.guest}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:3}}>{ev.time} · {ev.pax} pax · {ev.venue}</div>
                  {ev.menuPackage&&<div style={{fontSize:12,color:C.amber,marginTop:3}}>{ev.menuPackage}</div>}
                  {ev.special&&<div style={{fontSize:12,color:C.red,marginTop:3}}>{ev.special}</div>}
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={()=>openEdit(ev)} style={{flex:1,padding:"8px",borderRadius:8,background:C.text,color:"#fff",border:"none",fontSize:12,fontWeight:500,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>setDeleteId(ev.id)} style={{padding:"8px 12px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:500,cursor:"pointer"}}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ STAFF ON DUTY ══ */}
      <div style={{marginBottom:24}}>
        <div style={{fontSize:16,fontWeight:500,color:C.text,marginBottom:12}}>Staff on duty <span style={{fontSize:13,color:C.muted,fontWeight:400}}>{staffPresent} present · {staffAbsent} absent · {onLeave} on leave</span></div>
        {attArr.length>0?(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",gap:8}}>
            {attArr.filter(r=>r.status==="Present").slice(0,12).map((r,i)=>(
              <div key={r.staff_id||r.staffId||i} style={{background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:r.in_time&&!r.out_time?"#1D9E75":"#BA7517"}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:C.text}}>{r.staff_name||r.staffName||"Staff"}</div>
                  <div style={{fontSize:11,color:C.muted}}>{r.section||r.dept||"—"}{r.in_time?" · IN "+r.in_time:""}{r.out_time?" · OUT "+r.out_time:""}</div>
                </div>
              </div>
            ))}
          </div>
        ):(
          <div style={{background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:10,padding:"20px",textAlign:"center"}}>
            <div style={{fontSize:13,color:C.muted}}>No attendance records yet today</div>
          </div>
        )}
        {attArr.filter(r=>r.status==="Present").length>12&&<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:"8px 0",marginTop:4}}>+{attArr.filter(r=>r.status==="Present").length-12} more — view all in Team Hub</div>}
      </div>

      {/* ══ QUICK STATS ROW ══ */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        <div style={{background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:12,padding:"14px 18px"}}>
          <div style={{fontSize:12,color:C.muted,marginBottom:4}}>This month</div>
          <div style={{fontSize:22,fontWeight:500,color:C.text}}>{monthEvs.length} <span style={{fontSize:13,fontWeight:400,color:C.muted}}>events</span></div>
          <div style={{fontSize:12,color:C.muted}}>{monthPax.toLocaleString()} pax</div>
        </div>
        <div style={{background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:12,padding:"14px 18px"}}>
          <div style={{fontSize:12,color:C.muted,marginBottom:4}}>FY total</div>
          <div style={{fontSize:22,fontWeight:500,color:C.text}}>{fyEvs.length} <span style={{fontSize:13,fontWeight:400,color:C.muted}}>events</span></div>
          <div style={{fontSize:12,color:C.muted}}>{fyEvs.reduce((s,e)=>s+(+e.pax||0),0).toLocaleString()} pax</div>
        </div>
        <div style={{background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:12,padding:"14px 18px",cursor:"pointer"}} onClick={()=>setScreen&&setScreen("repair")}>
          <div style={{fontSize:12,color:C.muted,marginBottom:4}}>Open issues</div>
          <div style={{fontSize:22,fontWeight:500,color:openRepairs>0?"#D64040":"#1D9E75"}}>{openRepairs}</div>
          <div style={{fontSize:12,color:C.muted}}>repair tickets</div>
        </div>
      </div>
    </div>
  );
}

export { Dashboard };
