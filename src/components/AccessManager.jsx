// Ambria FnB — Access Manager (RBAC) — Redesigned with modal forms
import React, { useState } from "react";
import { C, SECTIONS, ALL_DEPARTMENTS } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr } from '../utils/helpers.js';
import { SCREEN_PERMISSIONS, PRESET_ROLES, getEffectivePerms, hasPermission, canAccessScreen, getScreensForRole, permsFromScreens } from '../data/permissions.js';
import { VENUE_OPTIONS } from '../data/staffData.js';
import { RECIPE_DB } from '../data/recipeData.js';
import { Avatar, Card, Btn, Chip } from './SharedUI.jsx';

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
    {v:"section_chinese",    l:"🥢 Chinese Section Tablet"},
    {v:"section_indian",     l:"🍛 Indian Curries Section Tablet"},
    {v:"section_tandoor",    l:"🔥 Tandoor Section Tablet"},
    {v:"section_continental",l:"🍝 Continental Section Tablet"},
    {v:"section_sweets",     l:"🍮 Sweets Section Tablet"},
    {v:"section_chaat",      l:"🥗 Chaat Section Tablet"},
    {v:"service",            l:"🍽 Service Dept"},
    {v:"crockery",           l:"🍶 Crockery Dept"},
    {v:"beverages",          l:"🥤 Beverages Dept"},
    {v:"transport",          l:"🚛 Transport"},
    {v:"kiosk_gate",         l:"🏛 Gate Kiosk"},
  ];
  const SECTION_OPTIONS = ["Management","Indian Curries","Tandoor","Chinese","Chaat","Sweets","Bakery","Service","Crockery","Beverages","Transportation","ODC","Continental"];
  const ROLE_MAP = Object.fromEntries(ROLE_OPTIONS.map(r=>[r.v,r.l]));

  // ── State ──
  const blankForm = {staff_id:"",name:"",role:"section_indian",section:"Indian Curries",dept:"kitchen",pin:"1111",is_active:true,venue:"",sop_categories:[]};
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [delId, setDelId]     = useState(null);
  const [search, setSearch]   = useState("");
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
      "Transportation":"TR","ODC":"OD"
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
    setForm({staff_id:s.staffListId||s.staff_id||s.id||"",name:s.name||"",role:s.role||"section_indian",section:s.section||"Indian Curries",dept:s.dept||"kitchen",pin:s.pin||"0000",is_active:s.is_active!==false,venue:s.venue||"",sop_categories:Array.isArray(s.sop_categories)?s.sop_categories:[]});
    setEditId(s.staffListId||s.staff_id||s.id); setShowAdd(true);
  }
  function saveForm(){
    if(!form.name.trim()||!form.staff_id.trim()) return;
    if(editId){
      const updated = safeArr(empDb).find(s=>(s.staffListId||s.staff_id||s.id)===editId);
      const entry = {...updated, name:form.name, role:form.role, section:form.section, dept:form.dept||"kitchen", pin:form.pin, is_active:form.is_active, venue:form.venue||null, sop_categories:form.sop_categories?.length>0?form.sop_categories:null};
      setEmpDb(p=>safeArr(p).map(s=>(s.staffListId||s.staff_id||s.id)===editId?entry:s));
      if(syncToServer) syncToServer('upsert', entry);
    } else {
      const sid = form.staff_id.toUpperCase();
      const newStaff={staffListId:sid,staff_id:sid,name:form.name,role:form.role,section:form.section,dept:form.dept||"kitchen",pin:form.pin,is_active:true,joining:TODAY,venue:form.venue||null,sop_categories:form.sop_categories?.length>0?form.sop_categories:null};
      setEmpDb(p=>[...safeArr(p),newStaff]);
      if(syncToServer) syncToServer('upsert', newStaff);
    }
    setShowAdd(false); setEditId(null);
  }
  function deleteStaff(id){
    setEmpDb(p=>safeArr(p).filter(s=>(s.staffListId||s.staff_id||s.id)!==id));
    if(syncToServer) syncToServer('delete', {staff_id:id, staffListId:id});
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
  const staff = safeArr(empDb).filter(s=>!search || s.name?.toLowerCase().includes(search.toLowerCase()) || (s.staffListId||s.staff_id||s.id)?.toLowerCase().includes(search.toLowerCase()));

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
        style={{...fld,marginBottom:14,fontSize:13}}/>

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
                  var roleMap={"Indian Curries":"section_indian","Chinese":"section_chinese","Tandoor":"section_tandoor","Chaat":"section_chaat","Sweets":"section_sweets","Continental":"section_continental","Bakery":"section_bakery"};
                  return{...p,staff_id:autoGenerateId(p.section,p.dept),name:p.section+" Tablet",role:roleMap[p.section]||p.role};
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
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Section")}</div>
              <select value={form.section} onChange={e=>{
                var sec=e.target.value;
                var roleMap={"Indian Curries":"section_indian","Chinese":"section_chinese","Tandoor":"section_tandoor","Chaat":"section_chaat","Sweets":"section_sweets","Continental":"section_continental","Bakery":"section_bakery"};
                setForm(p=>({...p,
                  section:sec,
                  name:addMode==="tablet"?sec+" Tablet":p.name,
                  role:addMode==="tablet"?(roleMap[sec]||p.role):p.role,
                  staff_id:editId?p.staff_id:autoGenerateId(sec,p.dept)
                }));
              }} style={fld}>
                {SECTION_OPTIONS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Department")}</div>
              <select value={form.dept||"kitchen"} onChange={e=>{var d=e.target.value;setForm(p=>({...p,dept:d,staff_id:editId?p.staff_id:autoGenerateId(p.section,d)}));}} style={fld}>
                <option value="kitchen">Kitchen</option>
                <option value="service">Service</option>
                <option value="crockery">Crockery</option>
                <option value="beverages">Beverages</option>
                <option value="transport">Transportation</option>
                <option value="odc">ODC</option>
                <option value="management">Management</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
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
                    <button key={cat.id} type="button" onClick={()=>setForm(p=>{const cur=p.sop_categories||[];return{...p,sop_categories:isOn?cur.filter(c=>c!==cat.id):[...cur,cat.id]};;})}
                      style={{padding:"6px 12px",borderRadius:8,fontSize:11,fontWeight:isOn?700:400,cursor:"pointer",
                        background:isOn?C.goldBg:"transparent",border:`1.5px solid ${isOn?C.gold:C.border}`,color:isOn?C.gold:C.muted,transition:"all .15s"}}>
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
              {v:"service",l:"🍽 Service"},{v:"crockery",l:"🍶 Crockery"},{v:"beverages",l:"🥤 Beverages"},{v:"transport",l:"🚛 Transport"},
            ]},
            {tier:"Section Tablets",roles:[
              {v:"section_indian",l:"🍛 Indian"},{v:"section_chinese",l:"🥢 Chinese"},{v:"section_tandoor",l:"🔥 Tandoor"},
              {v:"section_chaat",l:"🥗 Chaat"},{v:"section_sweets",l:"🍮 Sweets"},{v:"section_continental",l:"🍝 Continental"},
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
        const roleLabel = ROLE_MAP[s.role||"section_indian"] || s.role || "—";
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
                <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{roleLabel}{s.section?" · 📍 "+s.section:""}{s.venue?" · 🏠 "+s.venue:""}{s.sop_categories?.length?" · 📖 "+s.sop_categories.length+" SOPs":""}</div>
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