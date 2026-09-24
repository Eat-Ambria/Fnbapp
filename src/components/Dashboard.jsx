// Ambria FnB — Dashboard (light mode redesign)
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { C, SECTION_META, AMBRIA_VENUES } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, DAY_AFTER, TODAY_LABEL, CUR_YEAR, safeArr, safePct } from '../utils/helpers.js';
import { Avatar, DonutChart, Card, Btn, Chip } from './SharedUI.jsx';
import { K, type } from '../utils/theme.js';
import { Icon, KToast, ModalWatermark } from './KitchenUI.jsx';
import { ripple } from '../utils/ripple.js';
import { MenuEditor } from './MenuEditor.jsx';
import { MENU_PACKAGES, describeEventMenu } from '../data/menuPackages.js';
import { guessSectionForDish } from '../data/recipeData.js';
import { logActivity } from './ActivityLog.jsx';
import { supabase } from '../lib/supabase.js';

const FIELD_LABEL = {...type.label,fontSize:10.5,letterSpacing:.7,color:K.hdrMeta,marginBottom:5};

// Every form field sits in its own panel with an icon naming it. A bare stack
// of label-over-input gave the eye no way to find one field among eleven; the
// icon is what you actually scan for.
//
// Declared at module scope, NOT inside Dashboard. Defined in the render body it
// is a brand-new component type on every render, so React unmounts and remounts
// the input inside it each time — which drops focus after a single keystroke
// and makes the form impossible to type into.
function FieldCard({icon,label,required,full,children}) {
  return (
    <div style={{gridColumn:full?"1/-1":undefined,display:"flex",alignItems:"flex-start",gap:13,
      padding:"11px 13px",borderRadius:14,backgroundColor:"#FFFDF8",
      border:`1px solid ${K.cardWarmLine}`}}>
      <span style={{width:34,height:34,borderRadius:11,flexShrink:0,background:"#F6F0E3",
        border:`1px solid ${K.goldSoft}`,color:K.gold,
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Icon name={icon} size={16} strokeWidth={1.8}/>
      </span>
      <div style={{minWidth:0,flex:1}}>
        <div style={FIELD_LABEL}>{label}{required&&<span style={{color:K.danger,marginLeft:3}}>*</span>}</div>
        {children}
      </div>
    </div>
  );
}

function Dashboard({attendance,events,setEvents,kitchenTracking,lang="en",currentUser=null,empDb=[]}) {
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
  const VENUES = ["Ambria Pushpanjali","Ambria Exotica","Manaktala Farm","Outdoor Catering (ODC)"];
  const pad = n => String(n).padStart(2,"0");

  const VP = {
    "Ambria Pushpanjali":{code:"AP",c:"#D85A30",bg:"#FAECE7"},
    "Ambria Exotica":{code:"AE",c:"#BA7517",bg:"#FAEEDA"},
    "Manaktala Farm":{code:"MKT",c:"#2563EB",bg:"#EAF1FE"},
    "Ambria Restro":{code:"AR",c:"#1D9E75",bg:"#E1F5EE"},
    "Outdoor Catering (ODC)":{code:"ODC",c:"#7F77DD",bg:"#EEEDFE"},
    "Ambria Manaktala":{code:"AM",c:"#BA7517",bg:"#FAEEDA"},
    "Ambria Cuisine":{code:"AC",c:"#378ADD",bg:"#E6F1FB"},
  };
  const gp = v => VP[v]||{code:"EV",c:"#2563EB",bg:"#EAF1FE"};

  // One badge shape for every pill on this screen. They used to be declared
  // inline at each site with their own radius, padding and weight, so LMS,
  // "dishes ready" and the caterer flag were three different objects.
  const badgeStyle = (fg,bg,border) => ({
    display:"inline-block", padding:"3px 9px", borderRadius:999,
    fontFamily:K.fontBody, fontSize:11, fontWeight:700, whiteSpace:"nowrap",
    background:bg, color:fg, border:`1px solid ${border}`,
  });
  // The date tile. Tinted by venue, which is the only place the venue's colour
  // appears in a row other than its spine.
  const evDateTile = (dateStr,p) => {
    const d = new Date(dateStr+"T00:00");
    return(
      <div style={{width:54,height:54,borderRadius:14,background:p.bg,flexShrink:0,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontFamily:K.fontBody,fontSize:19,fontWeight:700,color:p.c,lineHeight:1,
          fontVariantNumeric:"tabular-nums"}}>{d.getDate()}</div>
        <div style={{fontFamily:K.fontBody,fontSize:9.5,fontWeight:700,color:p.c,
          textTransform:"uppercase",letterSpacing:.5,marginTop:2}}>{d.toLocaleString("en",{month:"short"})}</div>
      </div>
    );
  };

  // The month shown by "This month" in the stats row. Plain constants, not
  // state: the calendar that used to page through months is gone, so there is
  // nothing left that can move them off the current month.
  const yr = today.getFullYear();
  const mo = today.getMonth();

  // State
  const [venFil, setVenFil] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [closureEv, setClosureEv] = useState(null);
  const [closureRemark, setClosureRemark] = useState("");
  const [closureRating, setClosureRating] = useState("");
  const [form, setForm] = useState({guest:"",venue:"Ambria Pushpanjali",date:"",time:"7:30 PM",type:"Wedding",pax:"",veg:"",nonveg:"",menuPackage:"",menu:"",special:"",odc_location:"",odc_address:"",odc_contact_phone:"",odc_lead:"Gopal",site_recce:"Not done",external_caterer:false,external_caterer_name:""});
  const [showMenuEditor, setShowMenuEditor] = useState(false);
  const [menuEditorDishes, setMenuEditorDishes] = useState([]);
  // The unconfirmed-menu list is a sortable, filterable, paged table now, so it
  // carries the state a table needs. Timeframe replaces the three collapsible
  // buckets: they hid most of the list behind two closed headers.
  const [mcSort, setMcSort] = useState({k:"date", dir:1});
  const [mcFrame, setMcFrame] = useState("all");   // all | week | month | later
  const [mcVenue, setMcVenue] = useState("All");
  const [mcQuery, setMcQuery] = useState("");
  const [mcPage, setMcPage] = useState(1);
  const MC_PER_PAGE = 7;
  // Clicking the column you are already sorting by flips the direction;
  // clicking a different one starts that column ascending.
  const setSortKey = k => setMcSort(p=>p.k===k?{k,dir:-p.dir}:{k,dir:1});
  // The shell's header slot, where the day's totals sit. Looked up after mount
  // because the shell has not committed the node on our first render.
  // The set-state-in-effect rule exempts reading from an external system, which
  // a DOM node owned by another component is; this is the same lookup
  // KitchenHub and ProposalsView use for the same slot.
  const [hdrSlot, setHdrSlot] = useState(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(()=>{ setHdrSlot(document.getElementById("kh-hdr-slot")); }, []);
  // "+237 more" used to be plain grey text that did nothing. Eight is two full
  // rows of the four-up grid, which is the right amount for a glance; this is
  // what makes the rest reachable.
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const isODC = form.venue === "Outdoor Catering (ODC)";

  // Computed
  const filtered = venFil==="All"?safeEvs:safeEvs.filter(e=>e.venue===venFil);
  const todayEvs = safeEvs.filter(e=>e.date===todayStr);
  const upcoming = filtered.filter(e=>e.date>todayStr).sort((a,b)=>a.date.localeCompare(b.date));
  const upcomingShown = showAllUpcoming?upcoming:upcoming.slice(0,8);
  // Largest headcount currently on screen, so each card's bar has a scale to be
  // read against. Max with 1 so a list of zero-pax rows cannot divide by nothing.
  const upcomingPeakPax = Math.max(1,...upcomingShown.map(e=>+e.pax||0));
  // The summary strip reads safeEvs, not `filtered`. "This month" used to be
  // venue-filtered while "FY total" was not, so picking AE moved one number and
  // left the other — two figures side by side counting different things.
  const monthEvs = safeEvs.filter(e=>(e.date||"").startsWith(`${yr}-${pad(mo+1)}`));

  // The financial year runs April–March, so between January and March it began
  // in the PREVIOUS April. This used to hardcode the current calendar year as
  // the start, which put FY_START in the future for those three months and left
  // the FY total reading 0 every January.
  const fyStartYr = mo>=3 ? yr : yr-1;
  const FY_START=`${fyStartYr}-04-01`, FY_END=`${fyStartYr+1}-03-31`;
  const fyEvs=safeEvs.filter(ev=>ev.date>=FY_START&&ev.date<=FY_END);


  // Kitchen stats
  const kt = kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};

  // Staff stats
  const attArr = safeArr(attendance).filter(r=>r.date===TODAY);
  const staffPresent = attArr.filter(r=>r.status==="Present").length;
  const staffAbsent = attArr.filter(r=>r.status==="Absent").length;
  const totalActive = safeArr(empDb).filter(s=>s.is_active!==false&&s.role!=='kiosk_gate'&&s.role!=='admin'&&!s.role?.startsWith('section_')).length;
  const totalStaff = totalActive || Math.max(staffPresent+staffAbsent, 1);

  // Helpers
  // V80 fix: used to derive the next id from the max numeric suffix seen in
  // locally-loaded events — but soft-deleted (tombstoned) events are excluded
  // from local state (see App.jsx boot load), so a freshly generated id could
  // collide with an existing, possibly-tombstoned row. The upsert would then
  // silently merge into that row, leaving its is_deleted:true untouched, and
  // the very event just created would vanish the moment its realtime echo
  // arrived. A timestamp+random id needs no knowledge of existing ids at all.
  function genId(){ return `FP-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
  function openAdd(dt){setForm({guest:"",venue:"Ambria Pushpanjali",date:dt||"",time:"7:30 PM",type:"Wedding",pax:"",veg:"",nonveg:"",menuPackage:"",menu:"",special:"",odc_location:"",odc_address:"",odc_contact_phone:"",odc_lead:"Gopal",site_recce:"Not done",external_caterer:false,external_caterer_name:""});setEditId(null);setShowMenuEditor(false);setMenuEditorDishes([]);setShowForm(true);}
  function openEdit(ev){const mp=ev.menuPackage||"";const resolvedPkg=MENU_PACKAGES[mp]?mp:"(Custom)";const evIsODC=ev.venue==="Outdoor Catering (ODC)";setForm({guest:ev.guest||"",venue:ev.venue||"Ambria Pushpanjali",date:ev.date||"",time:ev.time||"7:30 PM",type:ev.type||"Wedding",pax:String(ev.pax||""),veg:String(ev.veg||""),nonveg:String(ev.nonveg||""),menuPackage:mp&&MENU_PACKAGES[mp]?mp:"",menu:resolvedPkg==="(Custom)"?(ev.menu||[]).join(", "):"",special:ev.special||"",odc_location:ev.odc_location||"",odc_address:ev.odc_address||"",odc_contact_phone:ev.odc_contact_phone||"",odc_lead:ev.odc_lead||"Gopal",site_recce:ev.site_recce||"Not done",external_caterer:!!ev.external_caterer,external_caterer_name:ev.external_caterer_name||""});setEditId(ev.id);setShowMenuEditor(evIsODC);setMenuEditorDishes(Array.isArray(ev.menu)?[...ev.menu]:[]);setShowForm(true);}
  function saveForm(){
    if(!form.guest||!form.date||!form.pax)return;
    const formIsODC = form.venue==="Outdoor Catering (ODC)";
    // For ODC with MenuEditor open, use menuEditorDishes; otherwise standard logic
    const mi = formIsODC && showMenuEditor && menuEditorDishes.length > 0
      ? menuEditorDishes
      : (form.menuPackage && MENU_PACKAGES[form.menuPackage] ? MENU_PACKAGES[form.menuPackage] : (form.menu||"").split(",").map(s=>s.trim()).filter(Boolean));
    const d = {...form, pax:+form.pax, veg:+form.veg||0, nonveg:+form.nonveg||0, menu:mi,
      external_caterer_name: form.external_caterer ? (form.external_caterer_name||null) : null,
      ...(formIsODC ? {odc_location:form.odc_location, odc_address:form.odc_address, odc_contact_phone:form.odc_contact_phone, odc_lead:form.odc_lead, site_recce:form.site_recce, odc_menu_confirmed:mi.length>0} : {})
    };
    if(editId){setEvents(p=>(p||[]).map(e=>e.id!==editId?e:{...e,...d}));logActivity('system','Event updated: '+form.guest+' ('+editId+')','event_edit',{evId:editId,guest:form.guest,venue:form.venue,date:form.date},currentUser?.id);}else{const nid=genId();setEvents(p=>[...(p||[]),{id:nid,...d,extras:[]}]);logActivity('system','Event created: '+form.guest+' ('+nid+')','event_create',{evId:nid,guest:form.guest,venue:form.venue,date:form.date,pax:+form.pax},currentUser?.id);}
    setShowForm(false);setShowMenuEditor(false);setMenuEditorDishes([]);setEditId(null);
  }
  function delEv(id){const ev=(events||[]).find(e=>e.id===id);setEvents(p=>(p||[]).filter(e=>e.id!==id));logActivity('system','Event deleted: '+(ev?.guest||id)+' ('+id+')','event_delete',{evId:id,guest:ev?.guest||''},currentUser?.id);setDeleteId(null);}

  // The shared field. White on the modal's ivory rather than the old grey-on-
  // grey, so an input reads as somewhere you type. .kh-planinput carries the
  // hover and the brand focus ring.
  const fld={width:"100%",padding:"10px 13px",borderRadius:10,border:`1px solid ${K.cardWarmLine}`,
    fontFamily:K.fontBody,fontSize:13.5,color:K.hdrTitle,background:"#FFFFFF",boxSizing:"border-box"};
  const lbl=FIELD_LABEL;
  const daysDiff = (d) => Math.round((new Date(d+"T00:00")-new Date(TODAY+"T00:00"))/(864e5));
  const daysLabel = (n) => n===0?"Today":n===1?"Tomorrow":n+"d";


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
        <div style={{position:"fixed",inset:0,background:K.modalScrim,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{position:"relative",background:K.modalBg,borderRadius:K.modalRadius,border:`1px solid ${K.modalLine}`,
            width:"100%",maxWidth:showMenuEditor?980:880,maxHeight:"94vh",overflow:"auto",
            boxShadow:K.shadowLift,transition:"max-width .2s"}}>
            <ModalWatermark/>
            {/* The header sticks while the form scrolls, so it has to be opaque
                — the modal's own face is a gradient, and a transparent bar let
                the fields slide up underneath the title. */}
            <div style={{position:"relative",zIndex:1,padding:"18px 22px 14px",display:"flex",
              justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:15,minWidth:0}}>
                <span style={{width:52,height:52,borderRadius:16,flexShrink:0,background:K.sageBg,
                  border:`1px solid ${K.sageBorder}`,color:K.brand,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon name="utensils" size={24} strokeWidth={1.8}/>
                </span>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    <span style={{...type.sectionHead,fontSize:27,fontWeight:700,color:K.hdrTitle}}>
                      {editId?T2("Edit Function"):T2("New Function")}
                    </span>
                    {isODC&&<span style={badgeStyle(K.brandText,K.brandBg,K.brandBorder)}>ODC</span>}
                  </div>
                  <div style={{...type.body,fontSize:13,color:K.hdrMeta,marginTop:3}}>
                    {T2("Update the event details and preferences.")}
                  </div>
                </div>
              </div>
              <button onClick={()=>{setShowForm(false);setShowMenuEditor(false);setEditId(null);}}
                aria-label={T2("Close")} className="kh-calnav"
                style={{background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,borderRadius:999,
                  cursor:"pointer",color:K.hdrMeta,padding:9,display:"flex",flexShrink:0}}>
                <Icon name="close" size={16} strokeWidth={2.2}/>
              </button>
            </div>
            <div style={{position:"relative",zIndex:1,padding:"0 22px 18px"}}>
              <div className="kh-formgrid" style={{marginBottom:10}}>
                <FieldCard icon="contact" label={T2("Guest name")} required full>
                  <input value={form.guest} onChange={e=>setForm(p=>({...p,guest:e.target.value}))} placeholder="e.g. Sharma Wedding" style={fld} className="kh-planinput" autoFocus/>
                </FieldCard>
                {[{l:"Venue",k:"venue",t:"sel",o:VENUES,ic:"building"},
                  {l:"Type",k:"type",t:"sel",o:["Wedding","Reception","Corporate","Birthday","Other"],ic:"tag"},
                  {l:"Date",k:"date",t:"date",req:true,ic:"calendar"},
                  {l:"Time",k:"time",ph:"7:30 PM",ic:"clock"},
                  {l:"Total pax",k:"pax",t:"number",ph:"500",req:true,ic:"users"},
                  {l:"Veg",k:"veg",t:"number",ph:"300",ic:"apple"},
                  {l:"Non-veg",k:"nonveg",t:"number",ph:"200",ic:"flame"},
                  {l:"Menu package",k:"menuPackage",t:"sel",o:["(Custom)",...Object.keys(MENU_PACKAGES)],ic:"plate"}].map(f=>(
                  <FieldCard key={f.k} icon={f.ic} label={T2(f.l)} required={f.req}>
                    {f.t==="sel"?<select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={fld} className="kh-planinput">{f.o.map(o=><option key={o}>{o}</option>)}</select>
                    :<input type={f.t||"text"} value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld} className="kh-planinput"/>}
                  </FieldCard>
                ))}
                {form.menuPackage&&form.menuPackage!=="(Custom)"&&<div style={{gridColumn:"1/-1",backgroundColor:K.sageBg,border:`1px solid ${K.sageBorder}`,borderRadius:12,padding:"11px 15px",fontFamily:K.fontBody,fontSize:12.5,color:K.sageText,fontWeight:600}}>{(MENU_PACKAGES[form.menuPackage]||[]).length} {T2("dishes")} — {form.menuPackage}</div>}
                {(!form.menuPackage||form.menuPackage==="(Custom)")&&!showMenuEditor&&(
                  <FieldCard icon="book" label={T2("Custom menu")} full>
                    <textarea value={form.menu} onChange={e=>setForm(p=>({...p,menu:e.target.value}))} placeholder="Dal Makhni, Paneer Tikka…" style={{...fld,height:44,resize:"none"}} className="kh-planinput"/>
                  </FieldCard>
                )}
                <FieldCard icon="note" label={T2("Special instructions")} full>
                  <input value={form.special} onChange={e=>setForm(p=>({...p,special:e.target.value}))} placeholder="Jain, no onion-garlic…" style={fld} className="kh-planinput"/>
                </FieldCard>
              </div>

              {/* ── External caterer (third party catering AT our venue — the reverse
                   of ODC) so kitchen knows to be present and observe, not cook ── */}
              <div style={{marginBottom:12,padding:"14px 16px",borderRadius:15,backgroundColor:form.external_caterer?K.warnBg:"#FFFDF8",border:`1px solid ${form.external_caterer?K.warnBorder:K.cardWarmLine}`}}>
                <label style={{display:"flex",alignItems:"center",gap:13,cursor:"pointer",fontFamily:K.fontBody,fontSize:13,fontWeight:600,color:K.hdrTitle}}>
                  <input type="checkbox" checked={form.external_caterer} onChange={e=>setForm(p=>({...p,external_caterer:e.target.checked}))} style={{width:19,height:19,cursor:"pointer",accentColor:K.brand,flexShrink:0}}/>
                  <span style={{display:"inline-flex",alignItems:"center",gap:9}}>
                    <span style={{color:K.gold,display:"flex"}}><Icon name="eye" size={17} strokeWidth={1.9}/></span>
                    {T2("Third-party caterer on-site (kitchen to observe only, not cook)")}
                  </span>
                </label>
                {form.external_caterer&&<div style={{marginTop:11}}><div style={lbl}>{T2("Caterer name")}</div><input value={form.external_caterer_name} onChange={e=>setForm(p=>({...p,external_caterer_name:e.target.value}))} placeholder="e.g. Spice Route Catering" style={fld} className="kh-planinput"/></div>}
              </div>

              {/* ── ODC-specific fields ── */}
              {isODC&&(
                <div style={{marginBottom:14,padding:"16px",borderRadius:14,backgroundColor:K.brandBg,border:`1px solid ${K.brandBorder}`}}>
                  <div style={{...type.label,fontSize:10.5,letterSpacing:.7,color:K.brandText,marginBottom:11}}>{T2("ODC details")}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    <div style={{gridColumn:"1/-1"}}><div style={lbl}>Client location *</div><input value={form.odc_location} onChange={e=>setForm(p=>({...p,odc_location:e.target.value}))} placeholder="e.g. GNH Convention Centre" style={fld} className="kh-planinput"/></div>
                    <div style={{gridColumn:"1/-1"}}><div style={lbl}>Client address</div><input value={form.odc_address} onChange={e=>setForm(p=>({...p,odc_address:e.target.value}))} placeholder="Sector 48, Gurgaon" style={fld} className="kh-planinput"/></div>
                    <div><div style={lbl}>Client contact phone</div><input value={form.odc_contact_phone} onChange={e=>setForm(p=>({...p,odc_contact_phone:e.target.value}))} placeholder="98XXXXXXXX" style={fld} className="kh-planinput"/></div>
                    <div><div style={lbl}>ODC lead</div><select value={form.odc_lead} onChange={e=>setForm(p=>({...p,odc_lead:e.target.value}))} style={fld} className="kh-planinput"><option>Gopal</option><option>Yatender</option><option>Other</option></select></div>
                    <div><div style={lbl}>Site recce</div><select value={form.site_recce} onChange={e=>setForm(p=>({...p,site_recce:e.target.value}))} style={fld} className="kh-planinput"><option>Not done</option><option>Scheduled</option><option>Done</option></select></div>
                  </div>
                </div>
              )}

              {/* ── ODC Menu Editor toggle ── */}
              {isODC&&(
                <div style={{marginBottom:12}}>
                  <button onClick={()=>{if(!showMenuEditor){const existing=form.menuPackage&&MENU_PACKAGES[form.menuPackage]?[...MENU_PACKAGES[form.menuPackage]]:menuEditorDishes.length>0?menuEditorDishes:(form.menu||"").split(",").map(s=>s.trim()).filter(Boolean);setMenuEditorDishes(existing);setShowMenuEditor(true);}else{setShowMenuEditor(false);}}} style={{padding:"8px 16px",borderRadius:8,background:showMenuEditor?C.surface:C.purple,color:showMenuEditor?C.purple:"#fff",border:`1px solid ${showMenuEditor?C.purpleBorder:"transparent"}`,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    {showMenuEditor?"▲ Close menu editor":"🍽 Open menu editor — confirm dishes for ODC"}
                  </button>
                  {showMenuEditor&&<div style={{marginTop:2,fontSize:11,color:menuEditorDishes.length>0?C.green:C.red,fontWeight:600}}>{menuEditorDishes.length>0?`✓ ${menuEditorDishes.length} dishes selected`:"⚠ No dishes — menu must be confirmed before kitchen can prep"}</div>}
                </div>
              )}
              {showMenuEditor&&(
                <div style={{marginBottom:14}}>
                  <MenuEditor selected={menuEditorDishes} onChange={setMenuEditorDishes} lang={lang}/>
                </div>
              )}

              {/* Saving needs a guest, a date and a headcount. The button used
                  to go half-opaque and keep its pointer cursor, so a click that
                  did nothing looked like a broken save — now it is painted as
                  disabled and says which field is still missing. */}
              {(()=>{
                const missing=[!form.guest&&T2("guest name"),!form.date&&T2("date"),!form.pax&&T2("total pax")].filter(Boolean);
                const blocked=missing.length>0;
                return(
                <div style={{display:"flex",gap:12,justifyContent:"flex-end",alignItems:"center",
                  flexWrap:"wrap",paddingTop:16,borderTop:`1px solid ${K.modalLine}`}}>
                  {blocked&&(
                    <span style={{marginRight:"auto",display:"inline-flex",alignItems:"center",gap:7,
                      fontFamily:K.fontBody,fontSize:12.5,color:K.hdrMeta}}>
                      <Icon name="alert" size={14} strokeWidth={1.9}/>
                      {T2("Still needed")}: {missing.join(", ")}
                    </span>
                  )}
                  <button onClick={()=>{setShowForm(false);setShowMenuEditor(false);setEditId(null);}}
                    className="kh-calnav"
                    style={{padding:"11px 22px",borderRadius:999,background:"#FFFFFF",
                      border:`1px solid ${K.cardWarmLine}`,color:K.textBody,fontFamily:K.fontBody,
                      fontSize:13,fontWeight:600,cursor:"pointer"}}>{T2("Cancel")}</button>
                  <button onClick={saveForm} disabled={blocked}
                    className={blocked?undefined:"kh-rip"} onPointerDown={ripple}
                    style={{display:"inline-flex",alignItems:"center",gap:8,padding:"11px 24px",borderRadius:999,
                      background:blocked?"#F0EEE7":K.brand,color:blocked?K.textFaint:"#FFFFFF",
                      border:`1px solid ${blocked?K.cardWarmLine:K.brand}`,
                      fontFamily:K.fontBody,fontSize:13,fontWeight:600,
                      cursor:blocked?"not-allowed":"pointer"}}>
                    <Icon name="check" size={15} strokeWidth={2.2}/>
                    {editId?T2("Save changes"):T2("Add function")}
                  </button>
                </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── The day's totals, in the shell's header plate ──
          Portalled into #kh-hdr-slot, the same slot Kitchen Hub uses for its
          back button, so the figures sit on the title row rather than taking a
          band of their own above the work. These are TODAY, unlike the strip
          below which is the month and the financial year. */}
      {hdrSlot&&createPortal((
        <div className="kh-hdrkpi">
          {[{n:todayEvs.length,l:T2("Functions today"),icon:"plate"},
            {n:todayEvs.reduce((s,e)=>s+(+e.pax||0),0),l:T2("Total pax (today)"),icon:"users"},
            {n:todayEvs.reduce((s,e)=>s+(Array.isArray(e.menu)?e.menu.length:0),0),l:T2("Total dishes (today)"),icon:"utensils"}
           ].map(s=>(
            <div key={s.l} style={{display:"flex",alignItems:"center",gap:11,padding:"9px 15px",
              borderRadius:14,background:"#FFFFFF",border:`1px solid ${K.hdrChipLine}`,boxShadow:K.shadowCard}}>
              <span style={{width:34,height:34,borderRadius:11,flexShrink:0,background:K.sageBg,
                border:`1px solid ${K.sageBorder}`,color:K.brand,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon name={s.icon} size={16} strokeWidth={1.8}/>
              </span>
              <div>
                <div style={{fontFamily:K.fontBody,fontSize:19,fontWeight:700,color:K.hdrTitle,
                  lineHeight:1,letterSpacing:"-0.5px",fontVariantNumeric:"tabular-nums"}}>{s.n.toLocaleString()}</div>
                <div style={{fontFamily:K.fontBody,fontSize:11,color:K.hdrMeta,marginTop:2,whiteSpace:"nowrap"}}>{s.l}</div>
              </div>
            </div>
          ))}
        </div>
      ), hdrSlot)}

      {/* ══ QUICK STATS ══
          First thing on the page: it is the context everything under it is
          read against, and at the foot nobody scrolled to it.
          One strip, not two cards — as separate cards each was about 780px
          wide holding 200px of content, so most of both sat empty.
          backgroundColor, not the background shorthand: the shorthand resets
          background-image and would wipe the .kh-cardart-sm artwork off. */}
      <div className="kh-statstrip kh-cardart-sm" style={{position:"relative",backgroundColor:K.cardWarm,
        border:`1px solid ${K.cardWarmLine}`,borderRadius:16,boxShadow:K.shadowCard,overflow:"hidden",
        marginBottom:18}}>
        {[{label:T2("This month"),icon:"calendar",n:monthEvs.length},
          {label:`${T2("FY total")} ${String(fyStartYr).slice(2)}–${String(fyStartYr+1).slice(2)}`,icon:"chart",n:fyEvs.length}
         ].map((s,i)=>(
          // One figure each, so the label and the number sit on one line
          // rather than stacking — half the height for the same information.
          <div key={s.label} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 20px",
            borderLeft:i>0?`1px solid ${K.cardWarmLine}`:"none"}}>
            <span style={{width:38,height:38,borderRadius:12,flexShrink:0,background:K.sageBg,
              border:`1px solid ${K.sageBorder}`,color:K.brand,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Icon name={s.icon} size={18} strokeWidth={1.8}/>
            </span>
            <span style={{...type.label,fontSize:10,color:K.hdrMeta,letterSpacing:.8,whiteSpace:"nowrap"}}>{s.label}</span>
            <span style={{marginLeft:"auto",display:"flex",alignItems:"baseline",gap:6}}>
              {/* Body face: Cormorant sets 1 as a serifed I and 0 as a narrow
                  O, so a figure like 103,823 was unreadable in it. */}
              <span style={{fontFamily:K.fontBody,fontSize:23,fontWeight:700,color:K.hdrTitle,
                lineHeight:1,letterSpacing:"-0.6px",fontVariantNumeric:"tabular-nums"}}>{s.n.toLocaleString()}</span>
              <span style={{fontFamily:K.fontBody,fontSize:12.5,color:K.hdrMeta}}>{T2("events")}</span>
            </span>
          </div>
        ))}
      </div>

      {/* ══ UNCONFIRMED MENU ALERTS (grouped by timeframe) ══ */}
      {(()=>{
        const isCustom=ev=>!ev.custom_menu_confirmed&&(!ev.menuPackage||ev.menuPackage==="(Custom)"||ev.menuPackage==="Custom");
        const isODCUnconfirmed=ev=>ev.venue==="Outdoor Catering (ODC)"&&!ev.odc_menu_confirmed;
        // ODC functions never carry a menuPackage — they're bespoke by design —
        // so isCustom(ev) was permanently true for every one of them regardless
        // of odc_menu_confirmed. Saving "Edit function" correctly set the flag,
        // but the isCustom branch kept re-flagging the event anyway, so it
        // could never actually leave this list. ODC events are judged solely by
        // odc_menu_confirmed; only non-ODC events are judged by isCustom, which
        // also respects custom_menu_confirmed (set via KitchenHub's "Mark menu
        // as built" action) so a confirmed custom menu drops off this list too.
        const candidates = safeEvs.filter(ev=>ev.date>=todayStr && (ev.venue==="Outdoor Catering (ODC)" ? isODCUnconfirmed(ev) : isCustom(ev)));
        // Dedup by id (guard LMS sync duplicates); fallback to guest+date+venue for id-less rows
        const seen=new Set();
        const unconfirmed = candidates.filter(ev=>{
          const k=ev.id?String(ev.id):`${ev.guest}|${ev.date}|${ev.venue}`;
          if(seen.has(k)) return false;
          seen.add(k);
          return true;
        }).sort((a,b)=>a.date.localeCompare(b.date));
        if(unconfirmed.length===0) return null;

        // ── filter → sort → page ──────────────────────────────────────────
        // The three collapsible urgency buckets are gone. Two of them were
        // closed by default, so most of the list was invisible and the counts
        // in the headers were the only thing anyone read.
        const q=mcQuery.trim().toLowerCase();
        const rows=unconfirmed.filter(ev=>{
          const dd=daysDiff(ev.date);
          if(mcFrame==="week"&&dd>7) return false;
          if(mcFrame==="month"&&(dd<=7||dd>21)) return false;
          if(mcFrame==="later"&&dd<=21) return false;
          if(mcVenue!=="All"&&ev.venue!==mcVenue) return false;
          if(q&&!(`${ev.guest||""} ${ev.venue||""} ${ev.odc_location||""}`.toLowerCase().includes(q))) return false;
          return true;
        });
        const val=(ev,k)=>k==="guest"?String(ev.guest||"").toLowerCase()
          :k==="venue"?String(ev.venue||"").toLowerCase()
          :k==="pax"?(+ev.pax||0)
          // "in" and "date" order identically — days-away is a function of the
          // date — so both sort on the date and stay consistent with each other.
          :String(ev.date||"");
        const sorted=[...rows].sort((a,b)=>{
          const x=val(a,mcSort.k), y=val(b,mcSort.k);
          return (x<y?-1:x>y?1:0)*mcSort.dir;
        });
        const pages=Math.max(1,Math.ceil(sorted.length/MC_PER_PAGE));
        // Filtering can strand the viewer past the end of a shorter list, so
        // the page is clamped on read rather than reset by an effect.
        const page=Math.min(mcPage,pages);
        const from=(page-1)*MC_PER_PAGE;
        const pageRows=sorted.slice(from,from+MC_PER_PAGE);
        const sortBtn=(k,label,align)=>(
          <button onClick={()=>setSortKey(k)} className="kh-sorth"
            style={{display:"inline-flex",alignItems:"center",gap:5,background:"none",border:"none",padding:0,
              cursor:"pointer",font:"inherit",color:"inherit",letterSpacing:"inherit",
              textTransform:"inherit",justifyContent:align==="right"?"flex-end":"flex-start",width:"100%"}}>
            {label}
            <span style={{display:"flex",opacity:mcSort.k===k?1:.32,
              transform:mcSort.k===k&&mcSort.dir<0?"rotate(180deg)":"none"}}>
              <Icon name="chevronD" size={11} strokeWidth={2.6}/>
            </span>
          </button>
        );
        const FRAMES=[{k:"all",l:T2("All dates")},{k:"week",l:T2("This week")},{k:"month",l:T2("Next 2 weeks")},{k:"later",l:T2("Later")}];
        return(
          <div style={{marginBottom:18,backgroundColor:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,
            borderRadius:18,boxShadow:K.shadowCard,overflow:"hidden"}}>
            {/* ── Section header: what it is, and the controls over it ── */}
            <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",padding:"15px 18px"}}>
              <span style={{width:36,height:36,borderRadius:11,flexShrink:0,background:K.dangerBg,
                border:`1px solid ${K.dangerBorder}`,color:K.danger,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon name="alert" size={17} strokeWidth={2}/>
              </span>
              <span style={{...type.label,fontSize:11.5,letterSpacing:.7,color:K.hdrTitle,whiteSpace:"nowrap"}}>
                {unconfirmed.length} {unconfirmed.length===1?T2("menu needs confirmation"):T2("menus need confirmation")}
              </span>
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
                <select value={mcFrame} onChange={e=>{setMcFrame(e.target.value);setMcPage(1);}}
                  className="kh-planinput"
                  style={{padding:"8px 12px",borderRadius:999,border:`1px solid ${K.cardWarmLine}`,
                    background:"#FFFFFF",fontFamily:K.fontBody,fontSize:12.5,fontWeight:600,
                    color:K.textBody,cursor:"pointer"}}>
                  {FRAMES.map(f=><option key={f.k} value={f.k}>{f.l}</option>)}
                </select>
                {["All",...VENUES].map(v=>{
                  const on=mcVenue===v, c=v==="All"?null:gp(v).c;
                  return(
                    <button key={v} onClick={()=>{setMcVenue(v);setMcPage(1);}} className={on?undefined:"kh-calnav"}
                      style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:999,
                        fontFamily:K.fontBody,fontSize:12.5,fontWeight:on?700:600,cursor:"pointer",
                        background:on?K.brand:"#FFFFFF",color:on?"#FFFFFF":K.textBody,
                        border:`1px solid ${on?K.brand:K.cardWarmLine}`,whiteSpace:"nowrap"}}>
                      {c&&<span style={{width:7,height:7,borderRadius:"50%",background:c,flexShrink:0}}/>}
                      {v==="All"?T2("All"):(VP[v]||{}).code||v.slice(0,3)}
                    </button>
                  );
                })}
                <span style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
                  <span style={{position:"absolute",left:13,display:"flex",color:K.textFaint,pointerEvents:"none"}}>
                    <Icon name="search" size={14} strokeWidth={1.9}/>
                  </span>
                  <input value={mcQuery} onChange={e=>{setMcQuery(e.target.value);setMcPage(1);}}
                    placeholder={T2("Search guest or venue…")} className="kh-planinput"
                    style={{width:210,padding:"8px 13px 8px 34px",borderRadius:999,
                      border:`1px solid ${K.cardWarmLine}`,background:"#FFFFFF",
                      fontFamily:K.fontBody,fontSize:12.5,color:K.hdrTitle}}/>
                </span>
              </div>
            </div>

            {/* ── Column heads ── */}
            <div className="kh-mchead" style={{background:"#F4F2EC",
              borderTop:`1px solid ${K.cardWarmLine}`,borderBottom:`1px solid ${K.cardWarmLine}`,
              padding:"10px 18px 10px 22px",...type.label,fontSize:10,color:K.hdrMeta}}>
              {sortBtn("date",T2("Date"))}
              {sortBtn("guest",T2("Guest name"))}
              {sortBtn("venue",T2("Venue"))}
              <span>{T2("Type")}</span>
              <span>{T2("Package")}</span>
              {sortBtn("pax",T2("Pax"),"right")}
              {sortBtn("in",T2("In"),"right")}
              <span style={{textAlign:"right"}}>{T2("Actions")}</span>
            </div>

            {/* ── Rows ── */}
            {pageRows.length===0&&(
              <div style={{padding:"28px 18px",textAlign:"center",fontFamily:K.fontBody,
                fontSize:13,color:K.hdrMeta,background:"#FFFFFF"}}>
                {T2("No menus match these filters.")}
              </div>
            )}
            {pageRows.map(ev=>{
              const isODC=ev.venue==="Outdoor Catering (ODC)";
              const dd=daysDiff(ev.date);
              const p=gp(ev.venue);
              // The urgency that used to be a bucket heading is now a spine on
              // the row itself, so it travels with the function instead of
              // living in a header two rows up.
              const spine=dd<=7?K.danger:dd<=21?K.warn:K.ok;
              return(
                <div key={ev.id||`${ev.guest}-${ev.date}`} className="kh-mcrow"
                  style={{borderTop:`1px solid ${K.lineSoft}`,background:"#FFFFFF",
                    padding:"11px 18px 11px 22px",position:"relative"}}>
                  <span style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:spine}}/>
                  {evDateTile(ev.date,p)}
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:K.fontBody,fontSize:13.5,fontWeight:700,color:K.hdrTitle,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.guest}</div>
                    <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:3,
                      fontFamily:K.fontBody,fontSize:11.5,color:K.hdrMeta}}>
                      <Icon name="clock" size={12} strokeWidth={1.9}/>{(VP[ev.venue]||{}).code||"EV"} · {ev.time}
                    </div>
                  </div>
                  <div style={{minWidth:0,display:"inline-flex",alignItems:"center",gap:6,
                    fontFamily:K.fontBody,fontSize:12.5,color:K.textBody}}>
                    <span style={{color:p.c,display:"flex",flexShrink:0}}><Icon name="building" size={13} strokeWidth={1.9}/></span>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {isODC?(ev.odc_location||T2("Location TBD")):ev.venue}
                    </span>
                  </div>
                  <div style={{fontFamily:K.fontBody,fontSize:12.5,color:K.textBody,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.type||"—"}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:K.fontBody,fontSize:12.5,color:K.textBody,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{describeEventMenu(ev)}</div>
                    {ev.lms_source&&<span style={{...badgeStyle(K.hdrMeta,"#FFFFFF",K.cardWarmLine),marginTop:5}}>LMS</span>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:K.fontBody,fontSize:18,fontWeight:700,color:K.hdrTitle,
                      lineHeight:1.1,letterSpacing:"-0.4px",fontVariantNumeric:"tabular-nums"}}>{ev.pax}</div>
                    <div style={{fontFamily:K.fontBody,fontSize:11,color:K.hdrMeta}}>{T2("pax")}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={dd<=1
                      ? badgeStyle(K.danger,K.dangerBg,K.dangerBorder)
                      : {fontFamily:K.fontBody,fontSize:12.5,fontWeight:600,color:K.hdrMeta,fontVariantNumeric:"tabular-nums"}}>
                      {daysLabel(dd)}
                    </span>
                  </div>
                  <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                    <button onClick={()=>openEdit(ev)} className="kh-calnav"
                      style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 15px",borderRadius:999,
                        background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,color:K.textBody,
                        fontFamily:K.fontBody,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                      {T2("Confirm")}<Icon name="chevronR" size={13} strokeWidth={2.2}/>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* ── Pagination ── */}
            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",
              padding:"12px 18px",borderTop:`1px solid ${K.cardWarmLine}`}}>
              <span style={{fontFamily:K.fontBody,fontSize:12.5,color:K.hdrMeta,fontVariantNumeric:"tabular-nums"}}>
                {sorted.length===0
                  ? T2("Nothing to show")
                  : `${T2("Showing")} ${from+1}–${Math.min(from+MC_PER_PAGE,sorted.length)} ${T2("of")} ${sorted.length}`}
              </span>
              {pages>1&&(
                <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>setMcPage(Math.max(1,page-1))} disabled={page===1}
                    aria-label={T2("Previous page")} className={page===1?undefined:"kh-calnav"}
                    style={{width:30,height:30,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",
                      background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,
                      color:page===1?K.textFaint:K.textBody,cursor:page===1?"not-allowed":"pointer"}}>
                    <Icon name="chevronL" size={14} strokeWidth={2.2}/>
                  </button>
                  {Array.from({length:pages},(_,i)=>i+1).map(n=>(
                    <button key={n} onClick={()=>setMcPage(n)} className={n===page?undefined:"kh-calnav"}
                      style={{minWidth:30,height:30,padding:"0 9px",borderRadius:999,
                        fontFamily:K.fontBody,fontSize:12.5,fontWeight:n===page?700:600,cursor:"pointer",
                        background:n===page?K.brand:"#FFFFFF",color:n===page?"#FFFFFF":K.textBody,
                        border:`1px solid ${n===page?K.brand:K.cardWarmLine}`,fontVariantNumeric:"tabular-nums"}}>
                      {n}
                    </button>
                  ))}
                  <button onClick={()=>setMcPage(Math.min(pages,page+1))} disabled={page===pages}
                    aria-label={T2("Next page")} className={page===pages?undefined:"kh-calnav"}
                    style={{width:30,height:30,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",
                      background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,
                      color:page===pages?K.textFaint:K.textBody,cursor:page===pages?"not-allowed":"pointer"}}>
                    <Icon name="chevronR" size={14} strokeWidth={2.2}/>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ══ TODAY'S EVENTS ══ */}
      {todayEvs.length>0&&(
        <div style={{marginBottom:26}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:12}}>
            <span style={{...type.sectionHead,fontSize:26,fontWeight:700,color:K.hdrTitle}}>{T2("Today's events")}</span>
            <span style={{padding:"4px 12px",borderRadius:999,fontFamily:K.fontBody,fontSize:12.5,
              fontWeight:700,fontVariantNumeric:"tabular-nums",background:K.sageBg,
              color:K.sageText,border:`1px solid ${K.sageBorder}`,whiteSpace:"nowrap"}}>
              {todayEvs.length} {todayEvs.length===1?T2("function"):T2("functions")} · {todayEvs.reduce((s,e)=>s+(+e.pax||0),0).toLocaleString()} {T2("pax")}
            </span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {todayEvs.map(ev=>{
              const p=gp(ev.venue);
              const evMenu = Array.isArray(ev.menu)?ev.menu.filter(d=>guessSectionForDish(d)!=="Beverages"):[];
              const evReady = evMenu.filter((_,i)=>{const d=kt[ev.id]?.[ev.id+"|"+i];return d?.ready;}).length;
              const allReady = evMenu.length>0&&evReady>=evMenu.length;
              return(
                // Not a click target itself — Edit and Delete sit on the card.
                <div key={ev.id}
                  className="kh-cardart-sm"
                  style={{position:"relative",backgroundColor:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,
                    borderRadius:18,overflow:"hidden",boxShadow:K.shadowCard,padding:"16px 20px",
                    display:"flex",alignItems:"center",gap:22,flexWrap:"wrap"}}>
                  {evDateTile(ev.date,p)}
                  <div style={{minWidth:0,flex:"1 1 220px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                      <span style={{fontFamily:K.fontBody,fontSize:16,fontWeight:700,color:K.hdrTitle,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.guest}</span>
                      <span style={badgeStyle(K.danger,K.dangerBg,K.dangerBorder)}>{T2("Today")}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginTop:4,
                      fontFamily:K.fontBody,fontSize:12.5,color:K.hdrMeta,minWidth:0}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:p.c,flexShrink:0}}/>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {/* ODC events all share the same generic venue value
                            ("Outdoor Catering (ODC)") — the actual site name
                            lives in odc_location (the field ODCModule labels
                            "Location"), so show that too or this line reads
                            identically for every outdoor function. */}
                        {ev.venue}{ev.venue==="Outdoor Catering (ODC)"?" — "+(ev.odc_location||"Location TBD"):""} · {ev.time} · {describeEventMenu(ev)}
                      </span>
                    </div>
                    {(ev.lms_source||ev.external_caterer||ev.special)&&(
                      <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",marginTop:7}}>
                        {ev.lms_source&&<span style={badgeStyle(K.hdrMeta,"#FFFFFF",K.cardWarmLine)}>LMS</span>}
                        {ev.external_caterer&&<span style={badgeStyle(K.warn,K.warnBg,K.warnBorder)}>{ev.external_caterer_name||T2("External caterer")}</span>}
                        {ev.special&&<span style={{display:"inline-flex",alignItems:"center",gap:6,
                          fontFamily:K.fontBody,fontSize:12,color:K.danger}}>
                          <Icon name="alert" size={13} strokeWidth={2}/>{ev.special}</span>}
                      </div>
                    )}
                  </div>
                  {/* Readiness as a bar, not a chip. "12/40 ready" is the one
                      thing about a function being cooked right now that you
                      want to read across the room, and a proportion is a
                      length before it is a pair of numbers. */}
                  {evMenu.length>0&&(
                    <div style={{flex:"0 1 200px",minWidth:150}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
                        marginBottom:6,fontFamily:K.fontBody,fontSize:12}}>
                        <span style={{color:K.hdrMeta}}>{T2("Dishes ready")}</span>
                        <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums",
                          color:allReady?K.ok:K.hdrTitle}}>{evReady}/{evMenu.length}</span>
                      </div>
                      <div style={{height:8,background:K.lineSoft,borderRadius:999,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:999,
                          width:Math.round(evReady/evMenu.length*100)+"%",
                          background:allReady?K.ok:K.warn}}/>
                      </div>
                    </div>
                  )}
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:K.fontBody,fontSize:24,fontWeight:700,color:K.hdrTitle,
                      lineHeight:1.1,letterSpacing:"-0.6px",fontVariantNumeric:"tabular-nums"}}>{ev.pax}</div>
                    <div style={{fontFamily:K.fontBody,fontSize:11.5,color:K.hdrMeta,marginTop:1}}>{T2("pax")}</div>
                  </div>
                  {/* Inline, not behind a click. There are only ever a handful
                      of these and they are the ones being cooked, so hiding
                      Edit and Delete behind an expand cost a click for nothing. */}
                  <div style={{display:"flex",gap:9,flexShrink:0}}>
                    <button onClick={()=>openEdit(ev)} className="kh-rip" onPointerDown={ripple}
                      style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 18px",borderRadius:999,
                        background:K.brand,color:"#FFFFFF",border:"none",fontFamily:K.fontBody,
                        fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
                      <Icon name="settings" size={14} strokeWidth={1.9}/>{T2("Edit")}
                    </button>
                    <button onClick={()=>setDeleteId(ev.id)} aria-label={T2("Delete")} className="kh-calnav"
                      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:10,
                        borderRadius:999,background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,
                        color:K.hdrMeta,cursor:"pointer"}}>
                      <Icon name="trash" size={15} strokeWidth={1.9}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ UPCOMING EVENTS ══ */}
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            {/* 700 and a size up: Cormorant is a light face, and at the scale's
                600 on ivory the heading was fainter than the rows under it. */}
            <span style={{...type.sectionHead,fontSize:26,fontWeight:700,color:K.hdrTitle}}>{T2("Upcoming")}</span>
            {/* The count was grey body text floating beside the title. As a
                chip it reads as a value belonging to the heading. */}
            <span style={{padding:"4px 12px",borderRadius:999,fontFamily:K.fontBody,fontSize:12.5,
              fontWeight:700,fontVariantNumeric:"tabular-nums",background:K.sageBg,
              color:K.sageText,border:`1px solid ${K.sageBorder}`,whiteSpace:"nowrap"}}>
              {upcoming.length} {upcoming.length===1?T2("function"):T2("functions")}
            </span>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            {currentUser?.role==='admin'&&(
              <button onClick={syncLms} disabled={lmsSyncing} className={lmsSyncing?undefined:"kh-calnav"}
                style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:999,
                  background:"#FFFFFF",border:`1px solid ${K.cardWarmLine}`,
                  color:lmsSyncing?K.textFaint:K.textBody,fontFamily:K.fontBody,fontSize:12.5,fontWeight:600,
                  cursor:lmsSyncing?"wait":"pointer"}}>
                {lmsSyncing
                  ? <span style={{display:"inline-block",width:13,height:13,border:`2px solid ${K.textFaint}`,borderTopColor:"transparent",borderRadius:"50%",animation:"lms-spin .8s linear infinite"}}/>
                  : <Icon name="refresh" size={14} strokeWidth={1.9}/>}
                {lmsSyncing?T2("Syncing…"):T2("Sync LMS")}
              </button>
            )}
            <button onClick={()=>openAdd(todayStr)} className="kh-rip" onPointerDown={ripple}
              style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:999,
                background:K.brand,color:"#FFFFFF",border:"none",fontFamily:K.fontBody,
                fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
              <Icon name="plus" size={14} strokeWidth={2.2}/>{T2("Add function")}
            </button>
          </div>
        </div>
        {/* The sync result is a toast, not a panel — see the KToast near the
            foot of this component. It used to be a full-width bar wedged
            between the heading and the filters, which pushed the whole list
            down for a message that is over in a moment and is only ever read
            once. */}
        {/* No longer gated on !lmsResult: the toast is a portal now, so the two
            cannot collide, and hiding this line while it showed made the sync
            time blink out at the exact moment a sync had refreshed it. */}
        {lmsLastSync&&(
          // textFaint on ivory is the tone for a hint nobody needs to read.
          // When the last sync ran is how you decide whether the list in front
          // of you is current, so it gets the body tone and a clock.
          <div style={{display:"inline-flex",alignItems:"center",gap:7,marginBottom:12,
            fontFamily:K.fontBody,fontSize:12.5,color:K.hdrMeta}}>
            <Icon name="clock" size={14} strokeWidth={1.9}/>
            {T2("Last LMS sync")}: <b style={{color:K.hdrTitle,fontWeight:600}}>{lmsLastSync}</b>
          </div>
        )}
        <style>{`@keyframes lms-spin{to{transform:rotate(360deg)}}`}</style>
        {/* Venue filter — each pill carries its venue's colour as a dot, the
            same key the rows' spines and date tiles use. Reading "AE" told you
            nothing about which rows it would leave behind. */}
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {["All",...VENUES].map(v=>{
            const on=venFil===v;
            const c=v==="All"?null:gp(v).c;
            return(
              <button key={v} onClick={()=>setVenFil(v)} className={on?undefined:"kh-calnav"}
                style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:999,
                  fontFamily:K.fontBody,fontSize:12.5,fontWeight:on?700:600,cursor:"pointer",
                  background:on?K.brand:"#FFFFFF",color:on?"#FFFFFF":K.textBody,
                  border:`1px solid ${on?K.brand:K.cardWarmLine}`}}>
                {c&&<span style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>}
                {v==="All"?T2("All"):(VP[v]||{}).code||v.slice(0,3)}
              </button>
            );
          })}
        </div>
        <div className="kh-evgrid">
          {upcomingShown.map(ev=>{
            const p=gp(ev.venue);const dd=daysDiff(ev.date);
            // D-1 status for tomorrow's events
            const isD1 = dd===1;
            const evMenu = Array.isArray(ev.menu)?ev.menu.filter(d=>guessSectionForDish(d)!=="Beverages"):[];
            const d1Done = isD1?evMenu.filter((_,i)=>{const d=kt[ev.id]?.[ev.id+"|"+i];return d?.mesaDone;}).length:0;
            const soon = dd<=1;
            return(
              // backgroundColor, never the `background` shorthand: the
              // shorthand resets background-image and would wipe the
              // .kh-cardart-sm artwork off the card.
              // This used to toggle an expanded block that no longer exists, so
              // clicking a card did nothing at all. Editing is where that
              // expand led, so the card goes straight there.
              <div key={ev.id} onClick={()=>openEdit(ev)} title={T2("Edit function")}
                className="kh-fncard kh-cardart-sm"
                style={{position:"relative",backgroundColor:K.cardWarm,border:`1px solid ${K.cardWarmLine}`,
                  borderRadius:16,cursor:"pointer",overflow:"hidden",boxShadow:K.shadowCard,
                  padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                  {evDateTile(ev.date,p)}
                  <div style={{minWidth:0,flex:1}}>
                    {/* Body face, matching the guest name in Today's events.
                        Cormorant was tried here and is wrong: it left the same
                        field in two different fonts on one screen, and being a
                        light face it made an all-caps name like SURINDER read
                        weaker than a lowercase one. The display face stays on
                        section headings, which is what it separates. */}
                    <div style={{fontFamily:K.fontBody,fontSize:15,fontWeight:700,color:K.hdrTitle,
                      lineHeight:1.25,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.guest}</div>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginTop:4,
                      fontFamily:K.fontBody,fontSize:12,color:K.hdrMeta,minWidth:0}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:p.c,flexShrink:0}}/>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {(VP[ev.venue]||{}).code||"EV"} · {ev.time}
                      </span>
                    </div>
                  </div>
                </div>
                {/* A short gold rule, the app's own divider on the header
                    plates — it separates the name from the detail without
                    spending a full-width line on it. */}
                <div style={{height:1.5,width:38,background:K.gold,borderRadius:2,flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0,color:K.textBody}}>
                    <Icon name="plate" size={14} strokeWidth={1.9}/>
                    <span style={{fontFamily:K.fontBody,fontSize:12.5,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{describeEventMenu(ev)}</span>
                  </div>
                  {(ev.lms_source||ev.external_caterer||(isD1&&evMenu.length>0))&&(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                      {ev.lms_source&&<span style={badgeStyle(K.hdrMeta,"#FFFFFF",K.cardWarmLine)}>LMS</span>}
                      {ev.external_caterer&&<span style={badgeStyle(K.warn,K.warnBg,K.warnBorder)}>{ev.external_caterer_name||T2("External caterer")}</span>}
                      {isD1&&evMenu.length>0&&<span style={badgeStyle(d1Done>0?K.ok:K.warn,d1Done>0?K.okBg:K.warnBg,d1Done>0?K.okBorder:K.warnBorder)}>D-1 {d1Done}/{evMenu.length}</span>}
                    </div>
                  )}
                </div>
                {/* Headcount and countdown share the card's foot, split left
                    and right — the two numbers you compare across cards, in
                    the same place on every one of them. marginTop:auto so a
                    one-line name and a two-line one still foot at the same
                    height across a row. */}
                <div style={{marginTop:"auto",paddingTop:11,borderTop:`1px solid ${K.cardWarmLine}`,
                  display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:10}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:5}}>
                    <span style={{fontFamily:K.fontBody,fontSize:21,fontWeight:700,color:K.hdrTitle,
                      lineHeight:1,letterSpacing:"-0.5px",fontVariantNumeric:"tabular-nums"}}>{ev.pax}</span>
                    <span style={{fontFamily:K.fontBody,fontSize:11.5,color:K.hdrMeta}}>{T2("pax")}</span>
                  </div>
                  {/* Tomorrow is the one countdown worth colouring — it is the
                      day D-1 prep has to be done. Everything further out is
                      just a number of days. */}
                  <span style={soon
                    ? badgeStyle(K.warn,K.warnBg,K.warnBorder)
                    : {fontFamily:K.fontBody,fontSize:12.5,fontWeight:600,color:K.hdrMeta,fontVariantNumeric:"tabular-nums"}}>
                    {daysLabel(dd)}
                  </span>
                </div>
                {/* Headcount against the largest on screen. The number alone
                    tells you 325 is bigger than 60 but not by how much at a
                    glance; scanning a row of cards for the big ones is the
                    reason to look at this list at all. */}
                <div style={{height:5,background:K.lineSoft,borderRadius:999,overflow:"hidden",marginTop:-4}}
                  title={`${ev.pax} ${T2("pax")}`}>
                  <div style={{height:"100%",borderRadius:999,background:p.c,
                    width:Math.max(4,Math.round((+ev.pax||0)/upcomingPeakPax*100))+"%"}}/>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",flexDirection:"column"}}>
          {upcoming.length>8&&(
            <button onClick={()=>setShowAllUpcoming(v=>!v)} className="kh-calnav"
              style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,alignSelf:"center",
                marginTop:4,padding:"10px 22px",borderRadius:999,background:"#FFFFFF",
                border:`1px solid ${K.cardWarmLine}`,color:K.textBody,fontFamily:K.fontBody,
                fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
              {showAllUpcoming?T2("Show less"):`${T2("Show all")} ${upcoming.length}`}
              <span style={{display:"flex",transform:showAllUpcoming?"rotate(180deg)":"none",transition:"transform .15s ease"}}>
                <Icon name="chevronD" size={14} strokeWidth={2.1}/>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Sync result. Kept short on purpose — the counts are the whole message,
          and KToast clears itself (4.5s, 7s for a failure so it can be read). */}
      <KToast
        open={!!lmsResult}
        toneName={lmsResult&&lmsResult.status==='success'?"ok":"danger"}
        title={lmsResult&&lmsResult.status==='success'
          ? `${T2("Synced")} ${(lmsResult.events_upserted||0).toLocaleString()} ${T2("events")}`
          : T2("Sync failed")}
        body={lmsResult&&lmsResult.status==='success'
          ? `${lmsResult.venue_rows||0} ${T2("venue")} · ${lmsResult.catering_rows||0} ${T2("catering")}`
          : (lmsResult&&lmsResult.message)||T2("Unknown error")}
        onClose={()=>setLmsResult(null)}
      />
    </div>
  );
}

export { Dashboard };

