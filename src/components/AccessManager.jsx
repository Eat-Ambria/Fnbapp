// Ambria FnB — Access Manager (RBAC) — Redesigned with modal forms
import React, { useState } from "react";
import { C, ALL_DEPARTMENTS, TEAM_DEPTS } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr } from '../utils/helpers.js';
import { SCREEN_PERMISSIONS, PRESET_ROLES, getEffectivePerms, hasPermission, canAccessScreen, getScreensForRole, permsFromScreens } from '../data/permissions.js';
import { VENUE_OPTIONS } from '../data/staffData.js';
import { RECIPE_DB } from '../data/recipeData.js';
import { Avatar, Card, Btn, Chip } from './SharedUI.jsx';
import { logActivity } from './ActivityLog.jsx';

// ── Shared modal backdrop ──
function Modal({open, onClose, wide, children}) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 16px",overflowY:"auto",backdropFilter:"blur(2px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:wide?640:480,border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,.25)",animation:"fadeInUp .25s ease both"}}>
        {children}
      </div>
    </div>
  );
}

// ── Toggle switch ──
function PToggle({on, onChange}) {
  return (
    <div onClick={e=>{e.stopPropagation();onChange();}} style={{width:36,height:20,borderRadius:10,cursor:"pointer",background:on?C.green:C.border,position:"relative",flexShrink:0,transition:"background .2s"}}>
      <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?19:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
    </div>
  );
}

function AccessManager({lang="en", empDb, setEmpDb, currentUser=null, syncToServer=null}) {
  const T2 = s => T(s, lang);
  const ROLE_OPTIONS = [
    {v:"admin",              l:"👑 Admin — Full Access"},
    {v:"head_chef",          l:"👨‍🍳 Head Chef — Kitchen + Store + Transport"},
    {v:"section_tablet",     l:"📱 Section Tablet — Pick SOP categories below"},
    {v:"service",            l:"🍽 F&B Dept"},
    {v:"crockery",           l:"🍶 Crockery Dept"},
    {v:"beverages",          l:"🥤 Beverages Dept"},
    {v:"transport",          l:"🚛 Transport"},
    {v:"kiosk_gate",         l:"🏛 Gate Kiosk"},
    {v:"staff",              l:"👤 Basic Staff — Attendance only"},
  ];
  const ROLE_MAP = Object.fromEntries(ROLE_OPTIONS.map(r=>[r.v,r.l]));
  // Auto-derive dept from selected section via team_sections mapping
  function deptForSection(secName){
    if(!secName) return null;
    for(var i=0;i<TEAM_DEPTS.length;i++){
      var d=TEAM_DEPTS[i];
      if(Array.isArray(d.sections) && d.sections.indexOf(secName)>=0) return d.id;
    }
    return null;
  }

  // ── State ──
  const blankForm = {staff_id:"",name:"",role:"section_tablet",section:"",dept:"kitchen",pin:"1111",is_active:true,venue:"",sop_categories:[]};
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [delId, setDelId]     = useState(null);
  const [search, setSearch]   = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [form, setForm]       = useState(blankForm);
  const [addMode, setAddMode] = useState("staff");
  const [showPin, setShowPin] = useState(null); // staff_id whose PIN is visible

  // Permission modal state
  const [permStaff, setPermStaff] = useState(null);
  const [editPerms, setEditPerms] = useState([]);
  const [copyFromId, setCopyFromId] = useState("");
  const [selected, setSelected]   = useState(new Set());

  const getSID = s => s.staffListId||s.staff_id||s.id;

  // ── Bulk actions ──
  function bulkRemoveAccess() {
    if (!window.confirm('Remove access for ' + selected.size + ' staff?')) return;
    setEmpDb(prev => prev.map(s =>
      selected.has(getSID(s)) ? {...s, role:'staff', custom_screens:null, permissions:null} : s
    ));
    selected.forEach(id => {
      const s = safeArr(empDb).find(x => getSID(x) === id);
      if (s && syncToServer) syncToServer('upsert', {...s, role:'staff', custom_screens:null, permissions:null});
    });
    setSelected(new Set());
  }
  function bulkDeactivate() {
    if (!window.confirm('Deactivate ' + selected.size + ' staff?')) return;
    setEmpDb(prev => prev.map(s =>
      selected.has(getSID(s)) ? {...s, is_active:false} : s
    ));
    selected.forEach(id => {
      const s = safeArr(empDb).find(x => getSID(x) === id);
      if (s && syncToServer) syncToServer('upsert', {...s, is_active:false});
    });
    setSelected(new Set());
  }
  function bulkDelete() {
    if (!window.confirm('PERMANENTLY DELETE ' + selected.size + ' staff?')) return;
    const ids = [...selected];
    setEmpDb(prev => prev.filter(s => !selected.has(getSID(s))));
    ids.forEach(id => { if (syncToServer) syncToServer('delete', {staff_id:id}); });
    setSelected(new Set());
  }

  // ── Access control ──
  const canAdd   = hasPermission(currentUser, "access.add");
  const canEdit  = hasPermission(currentUser, "access.edit");
  const canDel   = hasPermission(currentUser, "access.delete");
  const canPerms = hasPermission(currentUser, "access.perms");

  // ── Permission helpers ──
  function permCounts(s) {
    const ep = getEffectivePerms(s);
    const screenCount = Object.keys(SCREEN_PERMISSIONS).filter(sid => {
      const sp = SCREEN_PERMISSIONS[sid];
      return sp.perms.some(p => ep.includes(p.id));
    }).length;
    return { total: screenCount };
  }

  // ── Auto ID generation ──
  function autoGenerateId(section, dept) {
    const PREFIX_MAP = {
      "Management":"AM","Sweets":"SW","Chaat":"CT","Chinese":"CH","Tandoor":"TD",
      "Continental":"CN","Indian Curries":"IN","Bakery":"BK",
      "Service":"SV","Crockery":"CR","Beverages":"BV",
      "Transportation":"TR","ODC":"OD",
      "Main Course":"IN","Indian Main Course":"IN","Indian Tandoor":"TD",
      "Chinese & Pan Asian":"CH","Chinese & Pan-Asian":"CH",
      "Chaat Station":"CT","Indian Desserts":"SW","Savoury Halwai":"HW",
      "Soup Station":"SP","Salads":"SL","APC":"AP",
    };
    const DEPT_PREFIX_MAP = {
      "kitchen":"KT","service":"SV","crockery":"CR",
      "beverages":"BV","transport":"TR","odc":"OD",
      "management":"AM","maintenance":"MT"
    };
    var prefix;
    if (dept && DEPT_PREFIX_MAP[dept]) { prefix = DEPT_PREFIX_MAP[dept]; }
    else if (section && PREFIX_MAP[section]) { prefix = PREFIX_MAP[section]; }
    else { prefix = "ST"; }
    var existing = safeArr(empDb)
      .map(function(s) { return s.staffListId || s.staff_id || ''; })
      .filter(function(id) { return id.startsWith(prefix); })
      .map(function(id) { return parseInt(id.replace(prefix, '')) || 0; });
    var next = existing.length > 0 ? Math.max.apply(null, existing) + 1 : 1;
    return prefix + String(next).padStart(3, '0');
  }

  // ── CRUD ──
  function openAdd(){
    setAddMode("staff");
    var autoId = autoGenerateId('Management', 'management');
    setForm({...blankForm, staff_id:autoId});
    setEditId(null); setShowAdd(true);
  }
  function openEdit(s){
    const cats = Array.isArray(s.sop_categories)?s.sop_categories:[];
    setForm({staff_id:s.staffListId||s.staff_id||s.id||"",name:s.name||"",role:s.role==='section_tablet'?'section_tablet':(s.role?.startsWith('section_')?'section_tablet':s.role||"section_tablet"),section:s.section||"",dept:s.dept||"kitchen",pin:s.pin||"0000",is_active:s.is_active!==false,venue:s.venue||"",sop_categories:cats});
    setEditId(s.staffListId||s.staff_id||s.id); setShowAdd(true);
  }
  function saveForm(){
    if(!form.name.trim()||!form.staff_id.trim()) return;
    if(editId){
      const updated = safeArr(empDb).find(s=>(s.staffListId||s.staff_id||s.id)===editId);
      const cats = form.sop_categories||[];
      const derivedSection = cats.length>0 ? cats.map(c=>{const rc=(RECIPE_DB.cats||[]).find(x=>x.id===c);return rc?rc.name:c;}).join(' + ') : form.section;
      const entry = {...updated, name:form.name, role:form.role, section:derivedSection, dept:form.dept||"kitchen", pin:form.pin, is_active:form.is_active, venue:form.venue||null, sop_categories:cats.length>0?cats:null};
      setEmpDb(p=>safeArr(p).map(s=>(s.staffListId||s.staff_id||s.id)===editId?entry:s));
      if(syncToServer) syncToServer('upsert', entry);
      logActivity('system', 'Staff updated: '+form.name+' ('+editId+')', 'staff_edit', {staff_id:editId, name:form.name, role:form.role}, currentUser?.id);
    } else {
      const sid = form.staff_id.toUpperCase();
      const cats = form.sop_categories||[];
      const derivedSection = cats.length>0 ? cats.map(c=>{const rc=(RECIPE_DB.cats||[]).find(x=>x.id===c);return rc?rc.name:c;}).join(' + ') : form.section;
      const newStaff={staffListId:sid,staff_id:sid,name:form.name,role:form.role,section:derivedSection,dept:form.dept||"kitchen",pin:form.pin,is_active:true,joining:TODAY,venue:form.venue||null,sop_categories:cats.length>0?cats:null};
      setEmpDb(p=>[...safeArr(p),newStaff]);
      if(syncToServer) syncToServer('upsert', newStaff);
      logActivity('system', 'Staff added: '+form.name+' ('+sid+')', 'staff_add', {staff_id:sid, name:form.name, role:form.role, dept:form.dept}, currentUser?.id);
    }
    setShowAdd(false); setEditId(null);
  }
  function deleteStaff(id){
    const target = safeArr(empDb).find(s=>(s.staffListId||s.staff_id||s.id)===id);
    setEmpDb(p=>safeArr(p).filter(s=>(s.staffListId||s.staff_id||s.id)!==id));
    if(syncToServer) syncToServer('delete', {staff_id:id, staffListId:id});
    logActivity('system', 'Staff deleted: '+(target?.name||id)+' ('+id+')', 'staff_delete', {staff_id:id, name:target?.name||''}, currentUser?.id);
    setDelId(null);
  }
  function toggleActive(id){
    const target = safeArr(empDb).find(s=>(s.staffListId||s.staff_id||s.id)===id);
    setEmpDb(p=>safeArr(p).map(s=>(s.staffListId||s.staff_id||s.id)===id?{...s,is_active:!s.is_active}:s));
    if(syncToServer && target) syncToServer('upsert', {...target, is_active:!target.is_active});
  }

  // ── Permission functions ──
  function openPerms(s) {
    setPermStaff(s); setEditPerms(getEffectivePerms(s));
    setCopyFromId("");
  }
  function savePerms() {
    const sid = permStaff.staffListId||permStaff.staff_id||permStaff.id;
    setEmpDb(p=>safeArr(p).map(s=>(s.staffListId||s.staff_id||s.id)===sid?{...s,permissions:editPerms}:s));
    if(syncToServer) syncToServer('upsert', {...permStaff, permissions:editPerms});
    setPermStaff(null);
  }
  function handleCopyFrom(fromId) {
    if (!fromId) return;
    const from = safeArr(empDb).find(s=>(s.staffListId||s.staff_id||s.id)===fromId);
    if (from) setEditPerms(getEffectivePerms(from));
    setCopyFromId(fromId);
  }
  const fld={width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg,boxSizing:"border-box",minHeight:42};
  const staff = safeArr(empDb).filter(s=>{
    if(search && !s.name?.toLowerCase().includes(search.toLowerCase()) && !(s.staffListId||s.staff_id||s.id)?.toLowerCase().includes(search.toLowerCase())) return false;
    if(filterStatus==="active" && (s.is_active===false||s.active===false)) return false;
    if(filterStatus==="inactive" && s.is_active!==false&&s.active!==false) return false;
    if(filterRole==="admin" && s.role!=="admin") return false;
    if(filterRole==="head_chef" && s.role!=="head_chef") return false;
    if(filterRole==="tablet" && !s.role?.startsWith("section_")) return false;
    if(filterRole==="dept" && !["service","crockery","beverages","transport","kiosk_gate"].includes(s.role)) return false;
    if(filterRole==="staff" && s.role!=="staff") return false;
    if(filterDept!=="all" && (s.dept||"kitchen")!==filterDept) return false;
    return true;
  });
  const activeFilterCount = (filterRole!=="all"?1:0)+(filterStatus!=="all"?1:0)+(filterDept!=="all"?1:0);

  return(
    <div>
      {/* ══════ HEADER ══════ */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:20,fontWeight:600,color:C.text,fontFamily:"var(--font-display)"}}>🔐 {T2("Access Manager")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{T2("Staff accounts, roles & permissions")}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {staff.length>0&&(
            selected.size===staff.length
              ? <button onClick={()=>setSelected(new Set())} style={{padding:"8px 14px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer"}}>Deselect All</button>
              : <button onClick={()=>setSelected(new Set(staff.map(getSID)))} style={{padding:"8px 14px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer"}}>Select All</button>
          )}
          {canAdd&&<button onClick={openAdd} style={{padding:"10px 20px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ {T2("Add Staff")}</button>}
        </div>
      </div>

      {/* ══════ STATS ══════ */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[
          {l:T2("Total Staff"),v:safeArr(empDb).length,c:C.gold},
          {l:T2("Active"),v:safeArr(empDb).filter(s=>s.is_active!==false&&s.active!==false).length,c:C.green},
          {l:T2("Section Tablets"),v:safeArr(empDb).filter(s=>s.role?.startsWith("section_")).length,c:C.amber},
          {l:T2("Admin"),v:safeArr(empDb).filter(s=>s.role==="admin").length,c:C.purple||C.gold},
        ].map(s=>(
          <div key={s.l} style={{background:C.darkCard,borderRadius:12,padding:"12px 10px",textAlign:"center",border:`1px solid ${s.c}20`}}>
            <div style={{fontSize:22,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:10,color:s.c,fontWeight:600,marginTop:4}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ══════ SEARCH ══════ */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={T2("Search by name or ID…")}
        style={{...fld,marginBottom:10,fontSize:13}}/>

      {/* ══════ FILTERS ══════ */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
        <span style={{fontSize:11,color:C.faint,marginRight:2}}>🔍</span>
        {[{v:"all",l:T2("All roles")},{v:"admin",l:"👑 Admin"},{v:"head_chef",l:"👨‍🍳 Chef"},{v:"tablet",l:"📱 Tablets"},{v:"dept",l:"🏢 Depts"},{v:"staff",l:"👤 Staff"}].map(f=>(
          <button key={f.v} onClick={()=>setFilterRole(f.v)} style={{padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:filterRole===f.v?600:400,cursor:"pointer",background:filterRole===f.v?C.goldBg:"transparent",border:`1px solid ${filterRole===f.v?C.gold:C.border}`,color:filterRole===f.v?C.gold:C.muted,transition:"all .15s"}}>{f.l}</button>
        ))}
        <div style={{width:1,height:18,background:C.border,margin:"0 2px"}}/>
        {[{v:"all",l:T2("Any status")},{v:"active",l:"✅ Active"},{v:"inactive",l:"🔴 Inactive"}].map(f=>(
          <button key={f.v} onClick={()=>setFilterStatus(f.v)} style={{padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:filterStatus===f.v?600:400,cursor:"pointer",background:filterStatus===f.v?C.greenBg:"transparent",border:`1px solid ${filterStatus===f.v?C.green:C.border}`,color:filterStatus===f.v?C.green:C.muted,transition:"all .15s"}}>{f.l}</button>
        ))}
        <div style={{width:1,height:18,background:C.border,margin:"0 2px"}}/>
        <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{padding:"4px 10px",borderRadius:20,fontSize:11,border:`1px solid ${filterDept!=="all"?C.gold:C.border}`,color:filterDept!=="all"?C.gold:C.muted,background:filterDept!=="all"?C.goldBg:"transparent",cursor:"pointer"}}>
          <option value="all">{T2("All depts")}</option>
          <option value="kitchen">Kitchen</option>
          <option value="service">Service</option>
          <option value="crockery">Crockery</option>
          <option value="beverages">Beverages</option>
          <option value="transport">Transport</option>
          <option value="management">Management</option>
          <option value="maintenance">Maintenance</option>
          <option value="odc">ODC</option>
        </select>
        {activeFilterCount>0&&<button onClick={()=>{setFilterRole("all");setFilterStatus("all");setFilterDept("all");}} style={{padding:"4px 10px",borderRadius:20,fontSize:10,cursor:"pointer",background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red}}>✕ {T2("Clear")} ({activeFilterCount})</button>}
        <span style={{fontSize:11,color:C.faint,marginLeft:"auto"}}>{staff.length} {T2("shown")}</span>
      </div>

      {/* ══════ ADD / EDIT STAFF MODAL ══════ */}
      <Modal open={showAdd} onClose={()=>{setShowAdd(false);setEditId(null);}}>
        <div style={{padding:"24px 28px"}}>
          <div style={{fontSize:18,fontWeight:600,color:C.text,fontFamily:"var(--font-display)",marginBottom:18}}>
            {editId?"✏️ "+T2("Edit Staff"):addMode==="tablet"?"📱 "+T2("Add Dept Tablet"):"👤 "+T2("Add Staff")}
          </div>

          {/* Mode toggle — only when adding */}
          {!editId&&(
            <div style={{display:"flex",gap:0,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:18}}>
              <button onClick={()=>{
                setAddMode("staff");
                setForm(p=>({...p,staff_id:autoGenerateId(p.section,p.dept)}));
              }} style={{flex:1,padding:"12px",border:"none",cursor:"pointer",background:addMode==="staff"?C.goldBg:"transparent",borderRight:`1px solid ${C.border}`}}>
                <div style={{fontSize:13,fontWeight:addMode==="staff"?600:400,color:addMode==="staff"?C.gold:C.muted}}>👤 {T2("Staff Login")}</div>
                <div style={{fontSize:10,color:C.faint}}>{T2("Individual person access")}</div>
              </button>
              <button onClick={()=>{
                setAddMode("tablet");
                setForm(p=>{
                  return{...p,staff_id:autoGenerateId(p.section,p.dept),name:p.section?p.section+" Tablet":"Section Tablet",role:"section_tablet"};
                });
              }} style={{flex:1,padding:"12px",border:"none",cursor:"pointer",background:addMode==="tablet"?C.goldBg:"transparent"}}>
                <div style={{fontSize:13,fontWeight:addMode==="tablet"?600:400,color:addMode==="tablet"?C.gold:C.muted}}>📱 {T2("Dept Tablet")}</div>
                <div style={{fontSize:10,color:C.faint}}>{T2("Shared section login")}</div>
              </button>
            </div>
          )}

          {/* Tablet info */}
          {addMode==="tablet"&&!editId&&(
            <div style={{background:C.blueBg,border:`1px solid ${C.blueBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:11,color:C.blue}}>
              📱 {T2("Creates a shared login for a department tablet. Multiple staff in this section use the same PIN.")}
            </div>
          )}

          {/* Form fields */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Staff ID")} *</div>
              <input value={form.staff_id} onChange={e=>setForm(p=>({...p,staff_id:e.target.value.toUpperCase()}))} placeholder="Auto-generated" style={fld}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Full Name")} *</div>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder={addMode==="tablet"?"e.g. Indian Curries Tablet":"e.g. Ramesh Kumar"} style={fld}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Role / Access Level")}</div>
              <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={fld}>
                {ROLE_OPTIONS.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>
            {form.role!=='section_tablet'&&!form.role?.startsWith('section_')&&(
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Section")}</div>
              <select value={form.section||""} onChange={e=>{var s=e.target.value;var d=deptForSection(s);setForm(p=>({...p,section:s,dept:d||p.dept,staff_id:editId?p.staff_id:autoGenerateId(s,d||p.dept)}));}} style={fld}>
                <option value="">— Select section —</option>
                {ALL_DEPARTMENTS.map(s=><option key={s}>{s}</option>)}
              </select>
              {form.section && (
                <div style={{fontSize:10,color:C.faint,marginTop:4}}>→ Dept: <b style={{color:C.muted}}>{((TEAM_DEPTS||[]).find(d=>d.id===form.dept)||{}).label||form.dept||"—"}</b></div>
              )}
            </div>
            )}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("PIN (4 digits)")}</div>
              <input value={form.pin} onChange={e=>setForm(p=>({...p,pin:e.target.value.replace(/\D/g,"").slice(0,4)}))} placeholder="0000" maxLength={4} style={{...fld,letterSpacing:8,textAlign:"center",fontSize:18,fontWeight:700,fontFamily:"monospace"}} type="text" inputMode="numeric"/>
            </div>
          </div>

          {/* Venue (home location for tablets) */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Home Venue")} <span style={{fontWeight:400,fontSize:10,color:C.faint}}>({T2("for transport routing")})</span></div>
            <select value={form.venue||""} onChange={e=>setForm(p=>({...p,venue:e.target.value}))} style={fld}>
              <option value="">— {T2("Not set")} —</option>
              {VENUE_OPTIONS.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* SOP Categories (for section tablets) */}
          {form.role?.startsWith('section_')&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("SOP Categories")} <span style={{fontWeight:400,fontSize:10,color:C.faint}}>({T2("which recipe sections this tablet sees")})</span></div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {safeArr(RECIPE_DB.cats).map(cat=>{
                  const isOn=(form.sop_categories||[]).includes(cat.id);
                  return(
                    <button key={cat.id} type="button" onClick={()=>setForm(p=>{const cur=p.sop_categories||[];const next=isOn?cur.filter(c=>c!==cat.id):[...cur,cat.id];const names=next.map(c=>{const rc=(RECIPE_DB.cats||[]).find(x=>x.id===c);return rc?rc.name:c;});const sec=names.join(' + ');return{...p,sop_categories:next,section:sec,name:addMode==="tablet"&&next.length>0?sec+' Tablet':p.name};})}
                      style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:isOn?700:400,cursor:"pointer",
                        background:isOn?(cat.color||C.gold)+"18":"transparent",border:`1.5px solid ${isOn?(cat.color||C.gold):C.border}`,color:isOn?(cat.color||C.gold):C.muted,transition:"all .15s"}}>
                      {cat.icon||"📋"} {cat.name}{isOn?" ✓":""}
                    </button>
                  );
                })}
              </div>
              {(form.sop_categories||[]).length===0&&<div style={{fontSize:10,color:C.amber,marginTop:4}}>⚠ {T2("No categories selected — tablet won't see any SOPs or dishes")}</div>}
            </div>
          )}

          {/* Status toggle */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
            <span style={{fontSize:12,color:C.muted}}>{T2("Status")}:</span>
            <button onClick={()=>setForm(p=>({...p,is_active:!p.is_active}))}
              style={{padding:"6px 14px",borderRadius:8,background:form.is_active?C.greenBg:C.redBg,border:`1px solid ${form.is_active?C.greenBorder:C.redBorder}`,color:form.is_active?C.green:C.red,fontSize:12,fontWeight:600,cursor:"pointer"}}>
              {form.is_active?"✅ Active":"🔴 Inactive"}
            </button>
          </div>

          {/* Actions */}
          <div style={{display:"flex",gap:10}}>
            <button onClick={saveForm} disabled={!form.name.trim()||!form.staff_id.trim()}
              style={{flex:1,padding:"12px",borderRadius:10,background:form.name.trim()&&form.staff_id.trim()?C.gold:C.border,color:form.name.trim()&&form.staff_id.trim()?"#fff":C.faint,border:"none",fontSize:13,fontWeight:600,cursor:form.name.trim()&&form.staff_id.trim()?"pointer":"not-allowed"}}>
              {editId?"✓ "+T2("Save Changes"):addMode==="tablet"?"✓ "+T2("Add Tablet Login"):"✓ "+T2("Add Staff Member")}
            </button>
            <button onClick={()=>{setShowAdd(false);setEditId(null);}} style={{padding:"12px 20px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer"}}>
              {T2("Cancel")}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════ PERMISSIONS MODAL ══════ */}
      <Modal open={!!permStaff} onClose={()=>setPermStaff(null)} wide>
        {permStaff&&(()=>{
          const psid = permStaff.staffListId||permStaff.staff_id||permStaff.id;
          const roleLabel = ROLE_MAP[permStaff.role]||permStaff.role||"—";
          // Derive which screens are currently enabled from editPerms
          const enabledScreens = Object.keys(SCREEN_PERMISSIONS).filter(sid=>{
            const sp = SCREEN_PERMISSIONS[sid];
            return sp.perms.some(p=>editPerms.includes(p.id));
          });
          const allScreenIds = Object.keys(SCREEN_PERMISSIONS);
          // Toggle a whole screen on/off
          function toggleScreenAccess(sid) {
            const sp = SCREEN_PERMISSIONS[sid].perms.map(p=>p.id);
            const isOn = sp.some(p=>editPerms.includes(p));
            setEditPerms(prev => isOn ? prev.filter(id=>!sp.includes(id)) : [...new Set([...prev,...sp])]);
          }
          // Apply a role preset
          function applyRole(roleKey) {
            const screens = getScreensForRole(roleKey);
            setEditPerms(permsFromScreens(screens));
          }
          // Role tier labels for visual grouping
          const TIER_ROLES = [
            {tier:"System",roles:[{v:"admin",l:"👑 Admin",desc:"Full access to everything"}]},
            {tier:"Management",roles:[
              {v:"head_chef",l:"👨‍🍳 Head Chef",desc:"Kitchen + Store + Transport + Team"},
            ]},
            {tier:"Departments",roles:[
              {v:"service",l:"🍽 F&B"},{v:"crockery",l:"🍶 Crockery"},{v:"beverages",l:"🥤 Beverages"},{v:"transport",l:"🚛 Transport"},
            ]},
            {tier:"Section Tablets",roles:[
              {v:"section_tablet",l:"📱 Kitchen Tablet"},
            ]},
            {tier:"Special",roles:[
              {v:"kiosk_gate",l:"🏛 Gate Kiosk"},{v:"staff",l:"👤 Basic Staff"},
            ]},
          ];
          return (
            <div style={{maxHeight:"85vh",overflowY:"auto"}}>
              {/* ── Header ── */}
              <div style={{padding:"20px 24px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.surface,zIndex:1,borderRadius:"16px 16px 0 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:600,color:C.text,fontFamily:"var(--font-display)"}}>🔐 {permStaff.name}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{psid} · {roleLabel}</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:enabledScreens.length>0?C.gold:C.faint}}>
                    {enabledScreens.length}<span style={{fontWeight:400,color:C.muted}}>/{allScreenIds.length} tabs</span>
                  </div>
                </div>
              </div>

              {/* ── Role Presets ── */}
              <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.borderLight}`}}>
                <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:10,textTransform:"uppercase",letterSpacing:.6}}>{T2("Quick assign — pick a role")}</div>
                {TIER_ROLES.map(tier=>(
                  <div key={tier.tier} style={{marginBottom:10}}>
                    <div style={{fontSize:10,color:C.faint,marginBottom:5,fontWeight:600}}>{tier.tier}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {tier.roles.map(r=>{
                        const roleScreens = getScreensForRole(r.v);
                        const isMatch = roleScreens.length===enabledScreens.length && roleScreens.every(s=>enabledScreens.includes(s));
                        return(
                          <button key={r.v} onClick={()=>applyRole(r.v)}
                            style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:isMatch?600:400,cursor:"pointer",
                              background:isMatch?C.goldBg:C.bg,border:`1px solid ${isMatch?C.gold:C.borderLight}`,color:isMatch?C.gold:C.muted}}>
                            {r.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <button onClick={()=>setEditPerms(permsFromScreens(allScreenIds))} style={{padding:"5px 10px",borderRadius:8,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green,fontSize:10,fontWeight:600,cursor:"pointer"}}>✅ All On</button>
                  <button onClick={()=>setEditPerms([])} style={{padding:"5px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:10,fontWeight:600,cursor:"pointer"}}>🔒 All Off</button>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
                    <span style={{fontSize:10,color:C.faint}}>Copy from:</span>
                    <select value={copyFromId} onChange={e=>handleCopyFrom(e.target.value)} style={{padding:"4px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:10,color:C.text,background:C.bg,minWidth:100}}>
                      <option value="">— staff —</option>
                      {safeArr(empDb).filter(s=>getSID(s)!==psid).map(s=><option key={getSID(s)} value={getSID(s)}>{s.name} ({s.role})</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Screen Toggles (simple on/off per tab) ── */}
              <div style={{padding:"16px 24px"}}>
                <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:10,textTransform:"uppercase",letterSpacing:.6}}>{T2("Tab access")}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {allScreenIds.map(sid=>{
                    const screen = SCREEN_PERMISSIONS[sid];
                    const isOn = enabledScreens.includes(sid);
                    return(
                      <div key={sid} onClick={()=>toggleScreenAccess(sid)}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,
                          border:`1px solid ${isOn?C.green+"40":C.borderLight}`,background:isOn?C.greenBg+"20":"transparent",
                          cursor:"pointer",transition:"all .15s"}}>
                        <PToggle on={isOn} onChange={()=>toggleScreenAccess(sid)}/>
                        <span style={{fontSize:16}}>{screen.icon}</span>
                        <span style={{fontSize:12,fontWeight:isOn?600:400,color:isOn?C.green:C.faint}}>{screen.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Footer ── */}
              <div style={{padding:"16px 24px",borderTop:`1px solid ${C.border}`,position:"sticky",bottom:0,background:C.surface,display:"flex",gap:10,borderRadius:"0 0 16px 16px"}}>
                <button onClick={savePerms} style={{flex:1,padding:"12px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  ✓ {T2("Save Permissions")}
                </button>
                <button onClick={()=>setPermStaff(null)} style={{padding:"12px 20px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer"}}>
                  {T2("Cancel")}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ══════ DELETE CONFIRM MODAL ══════ */}
      <Modal open={!!delId} onClose={()=>setDelId(null)}>
        <div style={{padding:"28px 24px",textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:10}}>⚠️</div>
          <div style={{fontSize:16,fontWeight:600,color:C.text,marginBottom:6,fontFamily:"var(--font-display)"}}>{T2("Delete Staff Member?")}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:20}}>{T2("This removes their login access permanently. Attendance records are kept.")}</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>deleteStaff(delId)} style={{flex:1,padding:"12px",borderRadius:10,background:C.red,color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>🗑 {T2("Delete")}</button>
            <button onClick={()=>setDelId(null)} style={{flex:1,padding:"12px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer"}}>{T2("Cancel")}</button>
          </div>
        </div>
      </Modal>

      {/* ══════ STAFF LIST ══════ */}
      {staff.map(s=>{
        const roleLabel = ROLE_MAP[s.role||"section_tablet"] || s.role || "—";
        const isActive = s.is_active!==false&&s.active!==false;
        const sid = s.staffListId||s.staff_id||s.id;
        const pc = permCounts(s);
        const isSel = selected.has(sid);
        const pinVisible = showPin===sid;
        return(
          <Card key={sid} style={{marginBottom:8,padding:"14px 16px",opacity:isActive?1:.6,border:`1px solid ${isSel?C.gold:isActive?C.border:C.redBorder}`,background:isSel?C.gold+"08":undefined}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              {/* Checkbox */}
              <div onClick={()=>setSelected(p=>{const n=new Set(p);isSel?n.delete(sid):n.add(sid);return n;})}
                style={{width:20,height:20,borderRadius:5,border:`2px solid ${isSel?C.gold:C.border}`,background:isSel?C.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:11,color:"#fff",fontWeight:700}}>
                {isSel?"✓":""}
              </div>
              {/* Avatar */}
              <div style={{width:40,height:40,borderRadius:10,background:C.gold+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                {roleLabel.split(" ")[0]}
              </div>
              {/* Info */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:2}}>
                  <span style={{fontSize:14,fontWeight:600,color:C.text}}>{s.name||"—"}</span>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.gold+"12",color:C.gold,fontWeight:600}}>{sid}</span>
                  {!isActive&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.redBg,color:C.red}}>Inactive</span>}
                </div>
                <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{roleLabel}{Array.isArray(s.sop_categories)&&s.sop_categories.length>0?" · 🏷 "+s.sop_categories.map(c=>{const cc=(RECIPE_DB.cats||[]).find(x=>x.id===c);return cc?cc.name:c;}).join(', '):(s.section?" · 📍 "+s.section:"")}{s.venue?" · 🏠 "+s.venue:""}</div>
                {/* PIN — hidden by default */}
                <div style={{fontSize:11,color:C.faint}}>
                  PIN: <span onClick={()=>setShowPin(pinVisible?null:sid)} style={{cursor:"pointer",fontFamily:"monospace",fontSize:13,fontWeight:600,color:pinVisible?C.gold:C.faint,letterSpacing:pinVisible?3:0}}>
                    {pinVisible?(s.pin||"0000"):"••••"}
                  </span>
                  {pinVisible&&<span style={{fontSize:10,color:C.faint,marginLeft:6}}>(tap to hide)</span>}
                </div>
                {/* Permission pills */}
                <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                  {pc.total===0
                    ? <span style={{fontSize:10,padding:"2px 7px",borderRadius:6,background:C.redBg,color:C.red,fontWeight:600}}>🔒 No access</span>
                    : <span style={{fontSize:10,padding:"2px 7px",borderRadius:6,background:C.greenBg,color:C.green,fontWeight:600}}>{pc.total} tabs</span>
                  }
                </div>
              </div>
              {/* Action buttons — compact row */}
              <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end",maxWidth:180}}>
                {canEdit&&<button onClick={()=>openEdit(s)} style={{padding:"6px 12px",borderRadius:8,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,fontSize:11,fontWeight:600,cursor:"pointer"}}>✏️ Edit</button>}
                {canPerms&&<button onClick={()=>openPerms(s)} style={{padding:"6px 12px",borderRadius:8,background:C.blueBg,border:`1px solid ${C.blueBorder}`,color:C.blue,fontSize:11,fontWeight:600,cursor:"pointer"}}>🔐 Perms</button>}
                <button onClick={()=>toggleActive(sid)} style={{padding:"6px 12px",borderRadius:8,background:isActive?C.redBg:C.greenBg,border:`1px solid ${isActive?C.redBorder:C.greenBorder}`,color:isActive?C.red:C.green,fontSize:11,fontWeight:600,cursor:"pointer"}}>{isActive?"🔴":"✅"}</button>
                {canDel&&<button onClick={()=>setDelId(sid)} style={{padding:"6px 12px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.faint,fontSize:11,cursor:"pointer"}}>🗑</button>}
              </div>
            </div>
          </Card>
        );
      })}
      {staff.length===0&&<div style={{textAlign:"center",padding:28,color:C.faint,fontSize:12}}>{T2("No staff found")}</div>}

      {/* Bottom padding for bulk bar */}
      {selected.size>0&&<div style={{height:72}}/>}

      {/* ══════ BULK ACTION BAR ══════ */}
      {selected.size>0&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9000,background:C.surface,borderTop:`2px solid ${C.goldBorder}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 -4px 24px rgba(0,0,0,.15)"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.gold,marginRight:8}}>{selected.size} {T2("selected")}</span>
          <button onClick={bulkRemoveAccess} style={{padding:"8px 14px",borderRadius:10,background:C.amberBg,border:`1px solid ${C.amberBorder||C.amber}`,color:C.amber,fontSize:12,fontWeight:600,cursor:"pointer"}}>{T2("Remove Access")}</button>
          <button onClick={bulkDeactivate} style={{padding:"8px 14px",borderRadius:10,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:600,cursor:"pointer"}}>{T2("Deactivate")}</button>
          <button onClick={bulkDelete} style={{padding:"8px 14px",borderRadius:10,background:C.red,border:"none",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>🗑 {T2("Delete")}</button>
          <button onClick={()=>setSelected(new Set())} style={{padding:"8px 14px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",marginLeft:"auto"}}>{T2("Cancel")}</button>
        </div>
      )}
    </div>
  );
}

export { AccessManager };