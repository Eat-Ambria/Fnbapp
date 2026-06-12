// Ambria FnB — Access Manager (RBAC)
import React, { useState } from "react";
import { C, SECTIONS, ALL_DEPARTMENTS } from '../data/constants.js';
import { T } from '../data/translations.js';
import { safeArr, TODAY } from '../utils/helpers.js';
import { SCREEN_PERMISSIONS, PRESET_ROLES, getEffectivePerms, hasPermission } from '../data/permissions.js';
import { Avatar, Card, Btn, Chip } from './SharedUI.jsx';

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

  const blankForm = {staff_id:"",name:"",role:"section_indian",section:"Indian Curries",dept:"kitchen",pin:"1111",is_active:true};
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [delId, setDelId]     = useState(null);
  const [search, setSearch]   = useState("");
  const [form, setForm]       = useState(blankForm);
  const [addMode, setAddMode] = useState("staff");
  // Permission panel state
  const [view, setView]           = useState("list");
  const [permStaff, setPermStaff] = useState(null);
  const [editPerms, setEditPerms] = useState([]);
  const [expandedScreens, setExpandedScreens] = useState({});
  const [copyFromId, setCopyFromId] = useState("");
  const [selected, setSelected]   = useState(new Set());

  const getSID = s => s.staffListId||s.staff_id||s.id;

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
    ids.forEach(id => {
      if (syncToServer) syncToServer('delete', {staff_id:id});
    });
    setSelected(new Set());
  }

  // Access control
  const canAdd   = hasPermission(currentUser, "access.add");
  const canEdit  = hasPermission(currentUser, "access.edit");
  const canDel   = hasPermission(currentUser, "access.delete");
  const canPerms = hasPermission(currentUser, "access.perms");

  // All perms lists
  const ALL_PERMS_LIST = Object.values(SCREEN_PERMISSIONS).flatMap(s => s.perms);
  const ALL_PERM_IDS   = ALL_PERMS_LIST.map(p => p.id);
  const ALL_VIEW_IDS   = ALL_PERMS_LIST.filter(p => p.type === "view").map(p => p.id);
  const TYPE_C  = {view:C.blue, action:C.amber, approval:C.red, request:C.gold};
  const TYPE_BG = {view:C.blueBg, action:C.amberBg, approval:C.redBg, request:C.goldBg};

  function permCounts(s) {
    const ep = getEffectivePerms(s);
    const ct = {view:0, action:0, approval:0, request:0};
    ep.forEach(pid => { const p = ALL_PERMS_LIST.find(x=>x.id===pid); if(p) ct[p.type]++; });
    return {...ct, total: ep.length};
  }

  const PToggle = ({on, onChange}) => (
    <div onClick={e=>{e.stopPropagation();onChange();}} style={{width:38,height:21,borderRadius:11,cursor:"pointer",background:on?C.green:C.border,position:"relative",flexShrink:0,transition:"background .2s"}}>
      <div style={{width:15,height:15,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?20:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.4)"}}/>
    </div>
  );

  const staff = safeArr(empDb).filter(s=>!search || s.name?.toLowerCase().includes(search.toLowerCase()) || (s.staffListId||s.staff_id||s.id)?.toLowerCase().includes(search.toLowerCase()));

  function autoGenerateId(section, dept) {
    const PREFIX_MAP = {
      "Management":"AM",
      "Sweets":"SW","Chaat":"CT","Chinese":"CH","Tandoor":"TD",
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
    if (dept && DEPT_PREFIX_MAP[dept]) {
      prefix = DEPT_PREFIX_MAP[dept];
    } else if (section && PREFIX_MAP[section]) {
      prefix = PREFIX_MAP[section];
    } else {
      prefix = "ST";
    }
    var existing = safeArr(empDb)
      .map(function(s) { return s.staffListId || s.staff_id || ''; })
      .filter(function(id) { return id.startsWith(prefix); })
      .map(function(id) { return parseInt(id.replace(prefix, '')) || 0; });
    var next = existing.length > 0 ? Math.max.apply(null, existing) + 1 : 1;
    return prefix + String(next).padStart(3, '0');
  }

  function openAdd(){
    setAddMode("staff");
    var autoId = autoGenerateId('Management', 'management');
    setForm({...blankForm, staff_id:autoId});
    setEditId(null); setShowAdd(true);
  }
  function openEdit(s){
    setForm({staff_id:s.staffListId||s.staff_id||s.id||"",name:s.name||"",role:s.role||"section_indian",section:s.section||"Indian Curries",dept:s.dept||"kitchen",pin:s.pin||"0000",is_active:s.is_active!==false});
    setEditId(s.staffListId||s.staff_id||s.id); setShowAdd(true);
  }
  function saveForm(){
    if(!form.name.trim()||!form.staff_id.trim()) return;
    if(editId){
      const updated = safeArr(empDb).find(s=>(s.staffListId||s.staff_id||s.id)===editId);
      const entry = {...updated, name:form.name, role:form.role, section:form.section, dept:form.dept||"kitchen", pin:form.pin, is_active:form.is_active};
      setEmpDb(p=>safeArr(p).map(s=>(s.staffListId||s.staff_id||s.id)===editId?entry:s));
      if(syncToServer) syncToServer('upsert', entry);
    } else {
      const sid = form.staff_id.toUpperCase();
      const newStaff={staffListId:sid,staff_id:sid,name:form.name,role:form.role,section:form.section,dept:form.dept||"kitchen",pin:form.pin,is_active:true,joining:TODAY};
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
  // Permission panel functions
  function openPerms(s) {
    setPermStaff(s); setEditPerms(getEffectivePerms(s));
    setExpandedScreens({}); setCopyFromId(""); setView("perms");
  }
  function savePerms() {
    const sid = permStaff.staffListId||permStaff.staff_id||permStaff.id;
    setEmpDb(p=>safeArr(p).map(s=>(s.staffListId||s.staff_id||s.id)===sid?{...s,permissions:editPerms}:s));
    if(syncToServer) syncToServer('upsert', {...permStaff, permissions:editPerms});
    setView("list"); setPermStaff(null);
  }
  function applyRoleTemplate(roleKey) {
    setEditPerms(getEffectivePerms({role:roleKey, permissions:null}));
  }
  function handleCopyFrom(fromId) {
    if (!fromId) return;
    const from = safeArr(empDb).find(s=>(s.staffListId||s.staff_id||s.id)===fromId);
    if (from) setEditPerms(getEffectivePerms(from));
    setCopyFromId(fromId);
  }
  function toggleScreen(screenId) {
    const sp = SCREEN_PERMISSIONS[screenId].perms.map(p=>p.id);
    const allOn = sp.every(p=>editPerms.includes(p));
    setEditPerms(prev => allOn ? prev.filter(id=>!sp.includes(id)) : [...new Set([...prev,...sp])]);
  }
  function togglePerm(permId) {
    setEditPerms(prev => prev.includes(permId) ? prev.filter(x=>x!==permId) : [...prev, permId]);
  }

  const ROLE_MAP = Object.fromEntries(ROLE_OPTIONS.map(r=>[r.v,r.l]));
  const fld={width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:40};

  // ─── PERMISSIONS PANEL ───────────────────────────────────────────────────────
  if (view==="perms" && permStaff) {
    const psid = permStaff.staffListId||permStaff.staff_id||permStaff.id;
    const roleLabel = ROLE_MAP[permStaff.role]||permStaff.role||"—";
    const totalAll = ALL_PERM_IDS.length;
    const totalEnabled = editPerms.length;
    const sumByType = {view:0,action:0,approval:0,request:0};
    editPerms.forEach(pid => { const p=ALL_PERMS_LIST.find(x=>x.id===pid); if(p) sumByType[p.type]++; });
    const emptyScreenLabels = Object.entries(SCREEN_PERMISSIONS)
      .filter(([,sc])=>sc.perms.every(p=>!editPerms.includes(p.id)))
      .map(([,sc])=>sc.label);
    return (
      <div style={{animation:"fadeInUp .3s ease both"}}>
        {/* Back + staff header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <button onClick={()=>{setView("list");setPermStaff(null);}} style={{padding:"9px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:40,fontWeight:600}}>← Back</button>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🔐 {permStaff.name}</div>
            <div style={{fontSize:11,color:C.muted}}>{psid} · {roleLabel} · PIN: {permStaff.pin||"—"}</div>
          </div>
        </div>
        {/* Quick Actions */}
        <Card style={{marginBottom:10,padding:"12px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.8}}>Quick Actions</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={()=>setEditPerms(ALL_VIEW_IDS)} style={{padding:"7px 13px",borderRadius:9,background:C.blueBg,border:`1px solid ${C.blueBorder}`,color:C.blue,fontSize:11,fontWeight:700,cursor:"pointer",minHeight:34}}>👁 All Views</button>
            <button onClick={()=>setEditPerms(ALL_PERM_IDS)} style={{padding:"7px 13px",borderRadius:9,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green,fontSize:11,fontWeight:700,cursor:"pointer",minHeight:34}}>✅ Enable All</button>
            <button onClick={()=>setEditPerms([])} style={{padding:"7px 13px",borderRadius:9,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,fontWeight:700,cursor:"pointer",minHeight:34}}>🔒 Disable All</button>
            <div style={{display:"flex",alignItems:"center",gap:7,marginLeft:"auto"}}>
              <span style={{fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>Copy from:</span>
              <select value={copyFromId} onChange={e=>handleCopyFrom(e.target.value)} style={{...fld,minWidth:130,minHeight:34,fontSize:11,padding:"5px 9px"}}>
                <option value="">— select staff —</option>
                {safeArr(empDb).filter(s=>(s.staffListId||s.staff_id||s.id)!==psid).map(s=>{
                  const s2=s.staffListId||s.staff_id||s.id;
                  return <option key={s2} value={s2}>{s.name} ({s.role})</option>;
                })}
              </select>
            </div>
          </div>
        </Card>
        {/* Role Template Bar */}
        <Card style={{marginBottom:10,padding:"12px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.8}}>Apply Role Template</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {ROLE_OPTIONS.map(r=>(
              <button key={r.v} onClick={()=>applyRoleTemplate(r.v)} style={{padding:"5px 11px",borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>
                {r.l}
              </button>
            ))}
          </div>
        </Card>
        {/* ─── Quick Screen Visibility Toggles ─── */}
        <Card style={{marginBottom:14,padding:"14px 18px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Screen Visibility</div>
          <div style={{fontSize:11,color:C.faint,marginBottom:12}}>Toggle which screens this person can see. Use the detailed cards below for granular permissions.</div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {Object.entries(SCREEN_PERMISSIONS).map(([screenId,screen])=>{
              const sp = screen.perms.map(p=>p.id);
              const enabledCt = sp.filter(p=>editPerms.includes(p)).length;
              const allOn = enabledCt===sp.length;
              const someOn = enabledCt>0&&!allOn;
              return (
                <div key={screenId} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,cursor:"pointer",background:allOn?C.greenBg+"30":someOn?C.amberBg+"20":"transparent"}} onClick={()=>toggleScreen(screenId)}>
                  <PToggle on={allOn||someOn} onChange={()=>toggleScreen(screenId)}/>
                  <span style={{fontSize:15}}>{screen.icon}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:600,color:allOn?C.green:someOn?C.amber:C.faint}}>{screen.label}</span>
                  <span style={{fontSize:11,color:allOn?C.green:someOn?C.amber:C.faint,fontWeight:600,minWidth:30,textAlign:"right"}}>{allOn?"ON":someOn?"Partial":"OFF"}</span>
                </div>
              );
            })}
          </div>
        </Card>
        {/* Screen Permission Cards (detailed) */}
        {Object.entries(SCREEN_PERMISSIONS).map(([screenId,screen])=>{
          const sp = screen.perms.map(p=>p.id);
          const enabledCt = sp.filter(p=>editPerms.includes(p)).length;
          const allOn = enabledCt===sp.length;
          const someOn = enabledCt>0&&!allOn;
          const isExp = expandedScreens[screenId]!==false;
          return (
            <Card key={screenId} style={{marginBottom:8,padding:0,overflow:"hidden",border:`1px solid ${allOn?C.green+"50":someOn?C.amber+"40":C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",background:allOn?C.greenBg+"40":someOn?C.amberBg+"30":"transparent",cursor:"pointer"}}
                onClick={()=>setExpandedScreens(p=>({...p,[screenId]:!isExp}))}>
                <PToggle on={allOn||someOn} onChange={()=>toggleScreen(screenId)}/>
                <span style={{fontSize:16}}>{screen.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:allOn?C.green:someOn?C.amber:C.faint}}>{screen.label}</div>
                  <div style={{fontSize:11,color:C.muted}}>{enabledCt}/{sp.length} enabled</div>
                </div>
                <span style={{fontSize:12,color:C.faint,transform:isExp?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
              </div>
              {isExp&&(
                <div style={{borderTop:`1px solid ${C.borderLight}`,background:C.bg}}>
                  {screen.perms.map((perm,pi)=>{
                    const on = editPerms.includes(perm.id);
                    return (
                      <div key={perm.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 16px",borderTop:pi>0?`1px solid ${C.borderLight}`:"none",opacity:on?1:.55}}>
                        <PToggle on={on} onChange={()=>togglePerm(perm.id)}/>
                        <span style={{flex:1,fontSize:12,color:on?C.text:C.muted}}>{perm.label}</span>
                        <span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:TYPE_BG[perm.type]||C.surface,color:TYPE_C[perm.type]||C.muted,fontWeight:600,whiteSpace:"nowrap"}}>{perm.type}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
        {/* Summary Card */}
        <Card style={{marginBottom:12,padding:"14px 18px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.8}}>Permission Summary</div>
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
            <div style={{fontSize:24,fontWeight:800,color:totalEnabled>0?C.gold:C.faint}}>{totalEnabled}<span style={{fontSize:13,fontWeight:400,color:C.muted}}>/{totalAll}</span></div>
            {[{t:"view",l:"views"},{t:"action",l:"actions"},{t:"approval",l:"approvals"},{t:"request",l:"requests"}].map(x=>sumByType[x.t]>0&&(
              <span key={x.t} style={{fontSize:11,padding:"3px 9px",borderRadius:8,background:TYPE_BG[x.t],color:TYPE_C[x.t],fontWeight:600}}>{sumByType[x.t]} {x.l}</span>
            ))}
          </div>
          {emptyScreenLabels.length>0&&<div style={{fontSize:11,color:C.faint}}>🔒 No access: {emptyScreenLabels.join(", ")}</div>}
        </Card>
        {/* Save / Cancel */}
        <button onClick={savePerms} style={{width:"100%",padding:"14px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",minHeight:48,marginBottom:8}}>
          ✓ Save Permissions
        </button>
        <button onClick={()=>{setView("list");setPermStaff(null);}} style={{width:"100%",padding:"12px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:42}}>
          Cancel
        </button>
      </div>
    );
  }

  return(
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🔐 Access Manager</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>Manage staff accounts, roles & permissions — Admin only</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {staff.length>0&&(
            selected.size===staff.length
              ? <button onClick={()=>setSelected(new Set())} style={{padding:"9px 14px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:40}}>Deselect All</button>
              : <button onClick={()=>setSelected(new Set(staff.map(getSID)))} style={{padding:"9px 14px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:40}}>Select All</button>
          )}
          {canAdd&&<button onClick={openAdd} style={{padding:"11px 20px",borderRadius:12,background:`linear-gradient(135deg,${C.gold},#A8891E)`,color:"#0A0908",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>+ Add Staff</button>}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[
          {l:"Total Staff",v:safeArr(empDb).length,c:C.gold},
          {l:"Active",v:safeArr(empDb).filter(s=>s.is_active!==false&&s.active!==false).length,c:C.green},
          {l:"Section Tablets",v:safeArr(empDb).filter(s=>s.role?.startsWith("section_")).length,c:C.amber},
          {l:"Admin",v:safeArr(empDb).filter(s=>s.role==="admin").length,c:C.purple},
        ].map(s=>(
          <div key={s.l} style={{background:C.darkCard,borderRadius:12,padding:"12px 10px",textAlign:"center",border:`1px solid ${s.c}20`}}>
            <div style={{fontSize:22,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:10,color:s.c,fontWeight:600,marginTop:4}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or ID…"
        style={{...fld,marginBottom:12,fontSize:13}}/>

      {/* Add / Edit Form */}
      {showAdd&&(
        <Card style={{marginBottom:14,padding:"18px 20px",border:`2px solid ${C.goldBorder}`,background:C.goldBg+"60"}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:12}}>{editId?"✏️ Edit Staff":"➕ Add New Staff"}</div>
          {/* Mode toggle — only shown when adding, not editing */}
          {!editId&&(
            <div style={{display:"flex",gap:0,borderRadius:12,overflow:"hidden",border:"1px solid "+C.border,marginBottom:16}}>
              <button onClick={function(){
                setAddMode("staff");
                setForm(function(p){return{...p,staff_id:autoGenerateId(p.section,p.dept)};});
              }} style={{flex:1,padding:"12px",border:"none",cursor:"pointer",background:addMode==="staff"?C.goldBg:"transparent",borderRight:"1px solid "+C.border}}>
                <div style={{fontSize:13,fontWeight:addMode==="staff"?700:400,color:addMode==="staff"?C.gold:C.muted}}>👤 Staff Login</div>
                <div style={{fontSize:10,color:C.faint}}>Individual person access</div>
              </button>
              <button onClick={function(){
                setAddMode("tablet");
                setForm(function(p){
                  var roleMap={"Indian Curries":"section_indian","Chinese":"section_chinese","Tandoor":"section_tandoor","Chaat":"section_chaat","Sweets":"section_sweets","Continental":"section_continental","Bakery":"section_bakery"};
                  return{...p,staff_id:autoGenerateId(p.section,p.dept),name:p.section+" Tablet",role:roleMap[p.section]||p.role};
                });
              }} style={{flex:1,padding:"12px",border:"none",cursor:"pointer",background:addMode==="tablet"?C.goldBg:"transparent"}}>
                <div style={{fontSize:13,fontWeight:addMode==="tablet"?700:400,color:addMode==="tablet"?C.gold:C.muted}}>📱 Dept Tablet</div>
                <div style={{fontSize:10,color:C.faint}}>Shared dept login for 3-4 people</div>
              </button>
            </div>
          )}
          {/* Tablet info banner */}
          {addMode==="tablet"&&!editId&&(
            <div style={{background:C.blueBg,border:"1px solid "+C.blueBorder,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
              <div style={{fontSize:12,color:C.blue,fontWeight:700}}>📱 Dept Tablet Login</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>
                This creates a shared login for a department tablet.
                Multiple staff (3-4 people) in this section will use
                the same PIN to log in and work on dishes simultaneously.
                The tablet shows ONLY this section's dishes.
              </div>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Staff ID *</div>
              <input value={form.staff_id} onChange={e=>setForm(p=>({...p,staff_id:e.target.value.toUpperCase()}))} placeholder="Auto-generated or type custom" style={fld}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Full Name *</div>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder={addMode==="tablet"?"e.g. Indian Curries Tablet":"e.g. Ramesh Kumar"} style={fld}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Role / Access Level</div>
              <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={fld}>
                {ROLE_OPTIONS.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Section</div>
              <select value={form.section} onChange={function(e){
                var sec=e.target.value;
                var roleMap={"Indian Curries":"section_indian","Chinese":"section_chinese","Tandoor":"section_tandoor","Chaat":"section_chaat","Sweets":"section_sweets","Continental":"section_continental","Bakery":"section_bakery"};
                setForm(function(p){return{...p,
                  section:sec,
                  name:addMode==="tablet" ? sec+" Tablet" : p.name,
                  role:addMode==="tablet" ? (roleMap[sec]||p.role) : p.role,
                  staff_id:editId ? p.staff_id : autoGenerateId(sec,p.dept)
                };});
              }} style={fld}>
                {SECTION_OPTIONS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Department</div>
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
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>PIN (4 digits)</div>
              <input value={form.pin} onChange={e=>setForm(p=>({...p,pin:e.target.value.replace(/\D/g,"").slice(0,4)}))} placeholder="0000" maxLength={4} style={{...fld,letterSpacing:6,textAlign:"center",fontSize:18,fontWeight:700}} type="text" inputMode="numeric"/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:20}}>
              <div style={{fontSize:12,color:C.muted}}>Status:</div>
              <button onClick={()=>setForm(p=>({...p,is_active:!p.is_active}))}
                style={{padding:"8px 16px",borderRadius:10,background:form.is_active?C.greenBg:C.redBg,border:`1px solid ${form.is_active?C.greenBorder:C.redBorder}`,color:form.is_active?C.green:C.red,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                {form.is_active?"✅ Active":"🔴 Inactive"}
              </button>
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={saveForm} disabled={!form.name.trim()||!form.staff_id.trim()}
              style={{flex:1,padding:"12px",borderRadius:12,background:form.name.trim()&&form.staff_id.trim()?`linear-gradient(135deg,${C.gold},#A8891E)`:"#333",color:form.name.trim()&&form.staff_id.trim()?"#0A0908":C.faint,border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>
              {editId?"✓ Save Changes":addMode==="tablet"?"✓ Add Tablet Login":"✓ Add Staff Member"}
            </button>
            <button onClick={()=>{setShowAdd(false);setEditId(null);}} style={{padding:"12px 20px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:44}}>Cancel</button>
          </div>
        </Card>
      )}

      {/* Delete confirm */}
      {delId&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <Card style={{padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center",border:`2px solid ${C.redBorder}`}}>
            <div style={{fontSize:28,marginBottom:10}}>⚠️</div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6,fontFamily:"var(--font-display)"}}>Delete Staff Member?</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:18}}>This will remove their login access permanently. Their attendance records will not be deleted.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>deleteStaff(delId)} style={{flex:1,padding:"12px",borderRadius:12,background:`linear-gradient(135deg,${C.red},#8A1010)`,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>🗑 Delete</button>
              <button onClick={()=>setDelId(null)} style={{flex:1,padding:"12px",borderRadius:12,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer",minHeight:44}}>Cancel</button>
            </div>
          </Card>
        </div>
      )}

      {/* Staff list */}
      {staff.map(s=>{
        const roleLabel = ROLE_MAP[s.role||"section_indian"] || s.role || "—";
        const isActive = s.is_active!==false&&s.active!==false;
        const sid = s.staffListId||s.staff_id||s.id;
        const pc = permCounts(s);
        const isSel = selected.has(sid);
        return(
          <Card key={sid} style={{marginBottom:8,padding:"14px 16px",opacity:isActive?1:.65,border:`1px solid ${isSel?C.gold:isActive?C.border:C.redBorder}`,background:isSel?C.gold+"08":undefined}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              {/* Checkbox */}
              <div onClick={()=>setSelected(p=>{const n=new Set(p);isSel?n.delete(sid):n.add(sid);return n;})}
                style={{width:20,height:20,borderRadius:5,border:`2px solid ${isSel?C.gold:C.border}`,background:isSel?C.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,marginTop:10,fontSize:12,color:"#0A0A0F"}}>
                {isSel?"✓":""}
              </div>
              <div style={{width:40,height:40,borderRadius:12,background:C.gold+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                {roleLabel.split(" ")[0]}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:2}}>
                  <span style={{fontSize:13,fontWeight:700,color:C.text}}>{s.name||"—"}</span>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.gold+"15",color:C.gold,fontWeight:700}}>{sid}</span>
                  {!isActive&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red}}>Inactive</span>}
                </div>
                <div style={{fontSize:11,color:C.muted}}>{roleLabel}</div>
                {s.section&&<div style={{fontSize:11,color:C.faint}}>📍 {s.section}</div>}
                <div style={{fontSize:10,color:C.faint,marginTop:2}}>PIN: <span style={{fontSize:14,fontWeight:700,color:"#D4B44A",letterSpacing:4}}>{s.pin||"0000"}</span> · Joined: {s.joining||"—"}</div>
                {/* Permission summary pills */}
                <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
                  {pc.total===0
                    ? <span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.redBg,color:C.red,fontWeight:700}}>🔒 No access</span>
                    : <>
                        {pc.view>0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.blueBg,color:C.blue,fontWeight:600}}>{pc.view} views</span>}
                        {pc.action>0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.amberBg,color:C.amber,fontWeight:600}}>{pc.action} actions</span>}
                        {pc.approval>0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.redBg,color:C.red,fontWeight:600}}>{pc.approval} approvals</span>}
                        {pc.request>0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:C.goldBg,color:C.gold,fontWeight:600}}>{pc.request} requests</span>}
                      </>
                  }
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                {canEdit&&<button onClick={()=>openEdit(s)} style={{padding:"6px 14px",borderRadius:8,background:C.goldBg,border:`1px solid ${C.goldBorder}`,color:C.gold,fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>✏️ Edit</button>}
                {canPerms&&<button onClick={()=>openPerms(s)} style={{padding:"6px 14px",borderRadius:8,background:C.blueBg,border:`1px solid ${C.blueBorder}`,color:C.blue,fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>🔐 Perms</button>}
                <button onClick={()=>toggleActive(sid)} style={{padding:"6px 14px",borderRadius:8,background:isActive?C.redBg:C.greenBg,border:`1px solid ${isActive?C.redBorder:C.greenBorder}`,color:isActive?C.red:C.green,fontSize:11,fontWeight:700,cursor:"pointer",minHeight:32}}>{isActive?"🔴 Deactivate":"✅ Activate"}</button>
                {canDel&&<button onClick={()=>setDelId(sid)} style={{padding:"6px 14px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.faint,fontSize:11,cursor:"pointer",minHeight:32}}>🗑 Delete</button>}
              </div>
            </div>
          </Card>
        );
      })}
      {staff.length===0&&<div style={{textAlign:"center",padding:28,color:C.faint,fontSize:12}}>No staff found</div>}

      {/* Bottom padding when bulk bar is visible */}
      {selected.size>0&&<div style={{height:72}}/>}

      {/* Fixed bulk action bar */}
      {selected.size>0&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9000,background:C.surface,borderTop:`2px solid ${C.goldBorder}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 -4px 24px rgba(0,0,0,.5)"}}>
          <span style={{fontSize:13,fontWeight:700,color:C.gold,marginRight:8}}>{selected.size} selected</span>
          <button onClick={bulkRemoveAccess} style={{padding:"9px 14px",borderRadius:10,background:C.amberBg,border:`1px solid ${C.amberBorder||C.amber}`,color:C.amber,fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>Remove Access</button>
          <button onClick={bulkDeactivate} style={{padding:"9px 14px",borderRadius:10,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>Deactivate</button>
          <button onClick={bulkDelete} style={{padding:"9px 14px",borderRadius:10,background:`linear-gradient(135deg,${C.red},#8A1010)`,border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:40}}>🗑 Delete</button>
          <button onClick={()=>setSelected(new Set())} style={{padding:"9px 14px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:40,marginLeft:"auto"}}>Cancel</button>
        </div>
      )}
    </div>
  );
}


export { AccessManager };
