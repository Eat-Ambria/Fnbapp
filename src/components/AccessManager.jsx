// Ambria FnB — Access Manager (RBAC) — Redesigned with modal forms
import React, { useState } from "react";
import { C, ALL_DEPARTMENTS, TEAM_DEPTS } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr } from '../utils/helpers.js';
import { SCREEN_PERMISSIONS, PRESET_ROLES, PRESET_ROLES_DEFAULT, setRoleDefinition, deleteRoleDefinition, getEffectivePerms, hasPermission, canAccessScreen, getScreensForRole, permsFromScreens } from '../data/permissions.js';
import { VENUE_OPTIONS, HOME_VENUES } from '../data/staffData.js';
import { RECIPE_DB } from '../data/recipeData.js';
import { Avatar, Card, Btn, Chip } from './SharedUI.jsx';
import { logActivity } from './ActivityLog.jsx';
import { supabase } from '../lib/supabase.js';
import { APP_SETTINGS, setAppSetting } from '../data/appSettings.js';

// ── Shared modal backdrop ──
function Modal({open, onClose, wide, children}) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(12,20,16,.5)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 16px",overflowY:"auto"}}>
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

function AccessManager({lang="en", empDb, setEmpDb, currentUser=null, syncToServer=null, checklistsCfg={}, setChecklistsCfg=null}) {
  const T2 = s => T(s, lang);
  // Curated order/wording for the roles with special routing elsewhere in the
  // app (tablet shell, gate kiosk, admin bypass...) — kept as a fixed list so
  // their position/wording in the dropdown doesn't shuffle as roles are
  // edited. Anything else in PRESET_ROLES (sales, sales_manager, and any role
  // created via Manage Roles) is appended after, live — see masterTick.
  const CURATED_ROLE_ORDER = [
    {v:"admin",              l:"👑 Admin — Full Access"},
    {v:"head_chef",          l:"👨‍🍳 Head Chef — Kitchen + Store + Transport"},
    {v:"section_tablet",     l:"📱 Section Tablet — Pick SOP categories below"},
    {v:"service",            l:"🍽 F&B Dept"},
    {v:"crockery",           l:"🍶 Crockery Dept"},
    {v:"beverages",          l:"🥤 Beverages Dept"},
    {v:"fruits",             l:"🍓 Fruits Dept"},
    {v:"transport",          l:"🚛 Transport"},
    {v:"kiosk_gate",         l:"🏛 Gate Kiosk"},
    {v:"staff",              l:"👤 Basic Staff — Attendance only"},
  ];
  const curatedKeys = CURATED_ROLE_ORDER.map(r=>r.v);
  const extraRoleOptions = Object.keys(PRESET_ROLES)
    .filter(k=>!curatedKeys.includes(k) && !k.startsWith('section_'))
    .map(k=>({v:k, l:(PRESET_ROLES[k].icon||'🧩')+' '+PRESET_ROLES[k].label}));
  const ROLE_OPTIONS = CURATED_ROLE_ORDER.concat(extraRoleOptions);
  const ROLE_MAP = Object.fromEntries(Object.keys(PRESET_ROLES).map(k=>[k,(PRESET_ROLES[k].icon||'')+' '+PRESET_ROLES[k].label]));

  // ── Master data: departments/sections (team_departments + team_sections) and home venues ──
  const [showMasterData, setShowMasterData] = useState(false);
  const [masterTick, setMasterTick] = useState(0); // bump to force a re-render after mutating the module-level arrays below
  const bump = () => setMasterTick(t => t + 1);
  const [newDeptLabel, setNewDeptLabel] = useState("");
  const [newDeptIcon, setNewDeptIcon] = useState("");
  const [newSectionBuf, setNewSectionBuf] = useState({}); // { [deptId]: string }
  const [newVenueName, setNewVenueName] = useState("");

  // ── Role Manager (V93) ──
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [roleEditKey, setRoleEditKey] = useState(null); // null = list view, "" = creating, else editing that key
  const [roleForm, setRoleForm] = useState({label:"",icon:"🧩",tier:2,screens:[]});
  function slugifyRoleKey(s){ return (s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }
  function openRoleCreate(){ setRoleForm({label:"",icon:"🧩",tier:2,screens:[]}); setRoleEditKey(""); }
  function openRoleEdit(key){
    var r = PRESET_ROLES[key]||{};
    setRoleForm({label:r.label||"",icon:r.icon||"🧩",tier:r.tier||2,screens:[...(r.screens||[])]});
    setRoleEditKey(key);
  }
  function saveRole(){
    var label = (roleForm.label||'').trim();
    if(!label){ window.alert('Role name is required.'); return; }
    var key = roleEditKey;
    if(key===""){
      key = slugifyRoleKey(label);
      if(!key){ window.alert('Role name must contain at least one letter or number.'); return; }
      if(PRESET_ROLES[key]){ window.alert('A role with key "'+key+'" already exists (from the name "'+(PRESET_ROLES[key].label)+'"). Pick a different name.'); return; }
    }
    var prevElevated = (PRESET_ROLES[key]&&PRESET_ROLES[key].elevated)||[];
    var isBuiltin = !!PRESET_ROLES_DEFAULT[key] || !!(PRESET_ROLES[key]&&PRESET_ROLES[key].isBuiltin);
    var def = {label:label, icon:(roleForm.icon||'🧩').trim()||'🧩', tier:Number(roleForm.tier)||2, screens:roleForm.screens||[], elevated:prevElevated, isBuiltin:isBuiltin};
    supabase.from('role_definitions').upsert({role_key:key,label:def.label,icon:def.icon,tier:def.tier,screens:def.screens,elevated:def.elevated,is_builtin:isBuiltin,updated_at:new Date().toISOString()},{onConflict:'role_key'})
      .then(r=>{if(r.error){console.error('Role save err:',r.error);window.alert('Failed to save role: '+r.error.message);}});
    setRoleDefinition(key, def);
    logActivity('access',(roleEditKey===""?'Role created: ':'Role updated: ')+label,roleEditKey===""?'role_add':'role_update',{roleKey:key},currentUser?.id);
    setRoleEditKey(null);
    bump();
  }
  function confirmDeleteRole(key){
    var r = PRESET_ROLES[key];
    if(!r) return;
    if(PRESET_ROLES_DEFAULT[key] || r.isBuiltin){ window.alert('"'+r.label+'" is a system role and can\'t be deleted — but you can still edit which tabs it includes.'); return; }
    var inUse = safeArr(empDb).filter(s=>s.role===key).length;
    if(inUse>0){ window.alert('Cannot delete "'+r.label+'" — '+inUse+' staff member(s) still have this role. Reassign them first.'); return; }
    if(!window.confirm('Delete role "'+r.label+'"? This cannot be undone.')) return;
    supabase.from('role_definitions').delete().eq('role_key',key).then(res=>{if(res.error)console.error('Role delete err:',res.error);});
    deleteRoleDefinition(key);
    logActivity('access','Role deleted: '+r.label,'role_delete',{roleKey:key},currentUser?.id);
    bump();
  }

  // ── Service Checklist Manager — master control for Service Ops' checklist
  // tab. Same `checklists` table (type='service') ODCModule.jsx already uses
  // for its own phase checklists: delete-all-then-insert on save, same as
  // ODCModule's saveEditPhase. ──
  const CHECKLIST_FALLBACK = [
    {item_key:"briefing",label_en:"Event Briefing Done",label_hi:"इवेंट ब्रीफिंग पूर्ण",icon:"📋"},
    {item_key:"table_setup",label_en:"Tables & Chairs Setup",label_hi:"टेबल और कुर्सी सेटअप",icon:"🪑"},
    {item_key:"linen",label_en:"Linen & Table Covers",label_hi:"लिनन और टेबल कवर",icon:"🧵"},
    {item_key:"buffet_setup",label_en:"Buffet Counter Setup",label_hi:"बुफ़े काउंटर सेटअप",icon:"🍽"},
    {item_key:"live_counter",label_en:"Live Counters Ready",label_hi:"लाइव काउंटर तैयार",icon:"🔥"},
    {item_key:"water_station",label_en:"Water Station Placed",label_hi:"पानी स्टेशन लगा",icon:"💧"},
    {item_key:"napkins",label_en:"Napkins & Cutlery Set",label_hi:"नैपकिन और कटलरी सेट",icon:"🍴"},
    {item_key:"dustbins",label_en:"Dustbins Placed",label_hi:"डस्टबिन लगाए",icon:"🗑"},
    {item_key:"staff_uniform",label_en:"Staff Uniform Check",label_hi:"स्टाफ यूनिफ़ॉर्म चेक",icon:"👔"},
    {item_key:"vip_table",label_en:"VIP / Host Table Ready",label_hi:"VIP / होस्ट टेबल तैयार",icon:"⭐"},
    {item_key:"final_walkthrough",label_en:"Final Walkthrough Done",label_hi:"अंतिम निरीक्षण पूर्ण",icon:"✅"},
  ];
  const [showChecklistManager, setShowChecklistManager] = useState(false);
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [newCkLabel, setNewCkLabel] = useState("");
  const [newCkHindi, setNewCkHindi] = useState("");
  const [newCkIcon, setNewCkIcon] = useState("📋");
  function slugifyItemKey(s){ return (s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }
  function openChecklistManager(){
    var rows = safeArr(checklistsCfg && checklistsCfg.service);
    var src = rows.length>0 ? rows : CHECKLIST_FALLBACK;
    setChecklistItems(src.map(function(r,i){return {item_key:r.item_key,label_en:r.label_en,label_hi:r.label_hi||"",icon:r.icon||"📋",sort_order:i+1};}));
    setNewCkLabel(""); setNewCkHindi(""); setNewCkIcon("📋");
    setShowChecklistManager(true);
  }
  function addChecklistItem(){
    var label = newCkLabel.trim();
    if(!label) return;
    var key = slugifyItemKey(label);
    if(!key){ window.alert('Item name must contain at least one letter or number.'); return; }
    if(checklistItems.some(function(it){return it.item_key===key;})){ window.alert('An item with key "'+key+'" already exists. Pick a different name.'); return; }
    setChecklistItems(function(p){return p.concat([{item_key:key,label_en:label,label_hi:newCkHindi.trim(),icon:(newCkIcon||'📋').trim()||'📋',sort_order:p.length+1}]);});
    setNewCkLabel(""); setNewCkHindi(""); setNewCkIcon("📋");
  }
  function removeChecklistItem(idx){
    setChecklistItems(function(p){return p.filter(function(_,i){return i!==idx;}).map(function(it,i){return {...it,sort_order:i+1};});});
  }
  function moveChecklistItem(idx,dir){
    setChecklistItems(function(p){
      var arr=[...p]; var swap=idx+dir;
      if(swap<0||swap>=arr.length) return arr;
      var t=arr[idx]; arr[idx]=arr[swap]; arr[swap]=t;
      return arr.map(function(it,i){return {...it,sort_order:i+1};});
    });
  }
  async function saveChecklistItems(){
    if(checklistItems.length===0){ window.alert('Add at least one checklist item before saving.'); return; }
    setChecklistSaving(true);
    try{
      await supabase.from('checklists').delete().eq('type','service');
      var rows = checklistItems.map(function(it){return {type:'service',item_key:it.item_key,label_en:it.label_en,label_hi:it.label_hi||null,icon:it.icon||'📋',sort_order:it.sort_order,is_active:true};});
      var {error} = await supabase.from('checklists').insert(rows);
      if(error) throw error;
      if(setChecklistsCfg) setChecklistsCfg(function(p){return {...p,service:rows};});
      logActivity('access','Service checklist updated ('+rows.length+' items)','checklist_update',{},currentUser?.id);
      setShowChecklistManager(false);
    }catch(e){ window.alert('Save failed: '+e.message); }
    setChecklistSaving(false);
  }

  // ── FP re-open code — a shared code staff must enter to unlock a Function
  // Plan that's been marked final, so re-opening a locked FP takes more than
  // just typing a reason into the existing prompt. Single global value
  // (app_settings table), not per-staff — admin-only to set. ──
  const [fpCodeDraft, setFpCodeDraft] = useState(APP_SETTINGS.fp_unlock_code || "");
  const [fpCodeSaving, setFpCodeSaving] = useState(false);
  async function saveFpCode(){
    var code = fpCodeDraft.trim();
    setFpCodeSaving(true);
    try{
      var {error} = await supabase.from('app_settings').upsert({key:'fp_unlock_code', value:code||null, updated_at:new Date().toISOString()}, {onConflict:'key'});
      if(error) throw error;
      setAppSetting('fp_unlock_code', code);
      logActivity('access', code?'FP re-open code updated':'FP re-open code cleared','fp_code_update',{},currentUser?.id);
    }catch(e){ window.alert('Save failed: '+e.message); }
    setFpCodeSaving(false);
  }

  function updateDept(deptId, patch){
    var d = TEAM_DEPTS.find(x=>x.id===deptId);
    if(!d) return;
    var newLabel = (patch.label!=null ? patch.label.trim() : d.label) || d.label;
    var newIcon  = (patch.icon!=null ? patch.icon.trim() : d.icon) || d.icon;
    if(newLabel===d.label && newIcon===d.icon) return;
    var oldLabel = d.label;
    d.label = newLabel; d.icon = newIcon;
    supabase.from('team_departments').update({label:newLabel,icon:newIcon}).eq('id',deptId).then(r=>{if(r.error)console.error('Dept update err:',r.error);});
    logActivity('access','Department updated: '+oldLabel+' → '+newLabel,'dept_update',{deptId:deptId},currentUser?.id);
    bump();
  }
  function addDept(label, icon){
    var trimmed = (label||'').trim();
    if(!trimmed) return;
    var slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'dept';
    var existing = {}; TEAM_DEPTS.forEach(d=>{existing[d.id]=true;});
    var id = slug; if(existing[id]) id = slug+'_'+Date.now().toString(36);
    var row = {id:id, label:trimmed, icon:icon||'🏢', sort_order:TEAM_DEPTS.length, is_active:true};
    supabase.from('team_departments').insert(row).then(r=>{if(r.error){console.error('Dept add err:',r.error);window.alert('Failed to add department: '+r.error.message);}});
    TEAM_DEPTS.push({id:id, label:trimmed, icon:icon||'🏢', sections:[]});
    logActivity('access','Department added: '+trimmed,'dept_add',{deptId:id,name:trimmed},currentUser?.id);
    setNewDeptLabel(""); setNewDeptIcon("");
    bump();
  }
  function deleteDept(deptId){
    var d = TEAM_DEPTS.find(x=>x.id===deptId);
    if(!d) return;
    if((d.sections||[]).length>0){ window.alert('Cannot delete "'+d.label+'" — it still has sections. Delete or move them first.'); return; }
    if(!window.confirm('Delete department "'+d.label+'"? This cannot be undone.')) return;
    var idx = TEAM_DEPTS.findIndex(x=>x.id===deptId);
    if(idx>=0) TEAM_DEPTS.splice(idx,1);
    supabase.from('team_departments').delete().eq('id',deptId).then(r=>{if(r.error)console.error('Dept delete err:',r.error);});
    logActivity('access','Department deleted: '+d.label,'dept_delete',{deptId:deptId},currentUser?.id);
    bump();
  }
  function addSection(deptId, name){
    var trimmed = (name||'').trim();
    if(!trimmed) return;
    if(ALL_DEPARTMENTS.includes(trimmed)){ window.alert('A section named "'+trimmed+'" already exists.'); return; }
    var d = TEAM_DEPTS.find(x=>x.id===deptId);
    if(!d) return;
    var row = {name:trimmed, dept_id:deptId, sort_order:(d.sections||[]).length, is_active:true};
    supabase.from('team_sections').insert(row).then(r=>{if(r.error){console.error('Section add err:',r.error);window.alert('Failed to add section: '+r.error.message);}});
    d.sections = [...(d.sections||[]), trimmed];
    ALL_DEPARTMENTS.push(trimmed);
    logActivity('access','Section added: '+trimmed+' → '+d.label,'section_add',{deptId:deptId,name:trimmed},currentUser?.id);
    setNewSectionBuf(p=>({...p,[deptId]:""}));
    bump();
  }
  function renameSection(deptId, oldName, newName){
    var trimmed = (newName||'').trim();
    if(!trimmed || trimmed===oldName) return;
    if(ALL_DEPARTMENTS.includes(trimmed)){ window.alert('A section named "'+trimmed+'" already exists.'); bump(); return; }
    var d = TEAM_DEPTS.find(x=>x.id===deptId);
    if(!d) return;
    var idx = (d.sections||[]).indexOf(oldName);
    if(idx<0) return;
    d.sections[idx] = trimmed;
    var gi = ALL_DEPARTMENTS.indexOf(oldName);
    if(gi>=0) ALL_DEPARTMENTS[gi] = trimmed;
    supabase.from('team_sections').update({name:trimmed}).eq('dept_id',deptId).eq('name',oldName).then(r=>{if(r.error)console.error('Section rename err:',r.error);});
    logActivity('access','Section renamed: '+oldName+' → '+trimmed,'section_rename',{deptId:deptId,from:oldName,to:trimmed},currentUser?.id);
    bump();
  }
  function deleteSection(deptId, name){
    var usedBy = safeArr(empDb).filter(s=>s.section===name).length;
    var msg = usedBy>0 ? ('⚠ '+usedBy+' staff member(s) are set to "'+name+'". Delete anyway? Their record keeps the name but it will vanish from this dropdown.') : ('Delete section "'+name+'"?');
    if(!window.confirm(msg)) return;
    var d = TEAM_DEPTS.find(x=>x.id===deptId);
    if(!d) return;
    d.sections = (d.sections||[]).filter(s=>s!==name);
    var gi = ALL_DEPARTMENTS.indexOf(name);
    if(gi>=0) ALL_DEPARTMENTS.splice(gi,1);
    supabase.from('team_sections').delete().eq('dept_id',deptId).eq('name',name).then(r=>{if(r.error)console.error('Section delete err:',r.error);});
    logActivity('access','Section deleted: '+name,'section_delete',{deptId:deptId,name:name},currentUser?.id);
    bump();
  }
  function addVenue(name){
    var trimmed = (name||'').trim();
    if(!trimmed) return;
    if(VENUE_OPTIONS.includes(trimmed)){ window.alert('A venue named "'+trimmed+'" already exists.'); return; }
    var slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'venue';
    var existing = {}; HOME_VENUES.forEach(v=>{existing[v.id]=true;});
    var id = slug; if(existing[id]) id = slug+'_'+Date.now().toString(36);
    var row = {id:id, name:trimmed, sort_order:HOME_VENUES.length*10+10, is_active:true};
    supabase.from('home_venues').insert(row).then(r=>{if(r.error){console.error('Venue add err:',r.error);window.alert('Failed to add venue: '+r.error.message);}});
    HOME_VENUES.push({id:id, name:trimmed, sort_order:row.sort_order});
    VENUE_OPTIONS.push(trimmed);
    logActivity('access','Home venue added: '+trimmed,'venue_add',{venueId:id,name:trimmed},currentUser?.id);
    setNewVenueName("");
    bump();
  }
  function renameVenue(venueId, newName){
    var trimmed = (newName||'').trim();
    var v = HOME_VENUES.find(x=>x.id===venueId);
    if(!v || !trimmed || trimmed===v.name) return;
    if(VENUE_OPTIONS.includes(trimmed)){ window.alert('A venue named "'+trimmed+'" already exists.'); bump(); return; }
    var oldName = v.name;
    var gi = VENUE_OPTIONS.indexOf(oldName);
    v.name = trimmed;
    if(gi>=0) VENUE_OPTIONS[gi] = trimmed;
    supabase.from('home_venues').update({name:trimmed}).eq('id',venueId).then(r=>{if(r.error)console.error('Venue rename err:',r.error);});
    logActivity('access','Home venue renamed: '+oldName+' → '+trimmed,'venue_rename',{venueId:venueId,from:oldName,to:trimmed},currentUser?.id);
    bump();
  }
  function deleteVenue(venueId){
    var v = HOME_VENUES.find(x=>x.id===venueId);
    if(!v) return;
    var usedBy = safeArr(empDb).filter(s=>s.venue===v.name).length;
    var msg = usedBy>0 ? ('⚠ '+usedBy+' staff member(s) have "'+v.name+'" set as home venue. Delete anyway? Their record keeps it but it will vanish from this dropdown.') : ('Delete venue "'+v.name+'"?');
    if(!window.confirm(msg)) return;
    var idx = HOME_VENUES.findIndex(x=>x.id===venueId);
    if(idx>=0) HOME_VENUES.splice(idx,1);
    var gi = VENUE_OPTIONS.indexOf(v.name);
    if(gi>=0) VENUE_OPTIONS.splice(gi,1);
    supabase.from('home_venues').delete().eq('id',venueId).then(r=>{if(r.error)console.error('Venue delete err:',r.error);});
    logActivity('access','Home venue deleted: '+v.name,'venue_delete',{venueId:venueId},currentUser?.id);
    bump();
  }

  // ── State ──
  const blankForm = {staff_id:"",name:"",role:"staff",section:"",dept:"kitchen",pin:"1111",is_active:true,venue:"",sop_categories:[]};
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [delId, setDelId]     = useState(null);
  const [search, setSearch]   = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [showBasicStaff, setShowBasicStaff] = useState(false);
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
  function exportCSV() {
    const rows = staff;
    const headers = ["Staff ID","Name","Role","Section","Department","Home Venue","Status","SOP Categories","Joining Date"];
    const esc = v => { const s = (v==null?"":String(v)); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
    const lines = [headers.join(",")];
    rows.forEach(s=>{
      const sid = s.staffListId||s.staff_id||s.id;
      const roleLabel = ROLE_MAP[s.role]||s.role||"";
      const isActive = s.is_active!==false&&s.active!==false;
      const deptLabel = ((TEAM_DEPTS||[]).find(d=>d.id===(s.dept||"kitchen"))||{}).label||s.dept||"";
      const cats = Array.isArray(s.sop_categories)?s.sop_categories.map(c=>{const rc=(RECIPE_DB.cats||[]).find(x=>x.id===c);return rc?rc.name:c;}).join(" + "):"";
      lines.push([sid,s.name||"",roleLabel,s.section||"",deptLabel,s.venue||"",isActive?"Active":"Inactive",cats,s.joining||""].map(esc).join(","));
    });
    const csv = lines.join("\r\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ambria_staff_export_"+TODAY+".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logActivity('access','Exported staff list CSV ('+rows.length+' rows)','staff_export',{count:rows.length},currentUser?.id);
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
    // SOP categories & tablet-style section derivation apply ONLY to section_tablet roles.
    // For any other role, section is exactly what the user picked in the Section dropdown.
    const isTablet = form.role==='section_tablet' || (form.role||'').startsWith('section_');
    if(editId){
      const updated = safeArr(empDb).find(s=>(s.staffListId||s.staff_id||s.id)===editId);
      const cats = isTablet ? (form.sop_categories||[]) : [];
      const derivedSection = (isTablet && cats.length>0) ? cats.map(c=>{const rc=(RECIPE_DB.cats||[]).find(x=>x.id===c);return rc?rc.name:c;}).join(' + ') : form.section;
      const entry = {...updated, name:form.name, role:form.role, section:derivedSection, dept:form.dept||"kitchen", pin:form.pin, is_active:form.is_active, venue:form.venue||null, sop_categories:cats.length>0?cats:null};
      setEmpDb(p=>safeArr(p).map(s=>(s.staffListId||s.staff_id||s.id)===editId?entry:s));
      if(syncToServer) syncToServer('upsert', entry);
      logActivity('system', 'Staff updated: '+form.name+' ('+editId+')', 'staff_edit', {staff_id:editId, name:form.name, role:form.role}, currentUser?.id);
    } else {
      const sid = form.staff_id.toUpperCase();
      const cats = isTablet ? (form.sop_categories||[]) : [];
      const derivedSection = (isTablet && cats.length>0) ? cats.map(c=>{const rc=(RECIPE_DB.cats||[]).find(x=>x.id===c);return rc?rc.name:c;}).join(' + ') : form.section;
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
    if(filterRole==="tablet" && !s.role?.startsWith("section_")) return false;
    if(filterRole==="dept" && !["service","crockery","beverages","fruits","transport","kiosk_gate"].includes(s.role)) return false;
    // Any other non-"all" value is an exact role key — covers every role in
    // ROLE_OPTIONS (admin, head_chef, staff, sales, sales_manager, any
    // custom role from Manage Roles...), not just the handful that used to
    // get their own hardcoded pill.
    if(filterRole!=="all" && filterRole!=="tablet" && filterRole!=="dept" && s.role!==filterRole) return false;
    if(filterDept!=="all" && (s.dept||"kitchen")!==filterDept) return false;
    if(!showBasicStaff && filterRole!=="staff" && s.role==="staff") return false;
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
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:C.muted,padding:"8px 12px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`}}>
              <input type="checkbox" checked={selected.size===staff.length&&staff.length>0}
                onChange={()=>setSelected(selected.size===staff.length?new Set():new Set(staff.map(getSID)))}
                style={{width:15,height:15,cursor:"pointer"}}/>
              {T2("Select All")} ({staff.length})
            </label>
          )}
          <button onClick={exportCSV} disabled={staff.length===0} style={{padding:"10px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:staff.length===0?C.faint:C.muted,fontSize:13,fontWeight:600,cursor:staff.length===0?"not-allowed":"pointer"}}>⬇ {T2("Export CSV")}</button>
          {canAdd&&<button onClick={()=>setShowMasterData(true)} style={{padding:"10px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,fontWeight:600,cursor:"pointer"}}>🗂 {T2("Manage Sections & Venues")}</button>}
          {canAdd&&<button onClick={()=>{setShowRoleManager(true);setRoleEditKey(null);}} style={{padding:"10px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,fontWeight:600,cursor:"pointer"}}>🧩 {T2("Manage Roles")}</button>}
          {canAdd&&<button onClick={openChecklistManager} style={{padding:"10px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,fontWeight:600,cursor:"pointer"}}>📋 {T2("Manage Service Checklist")}</button>}
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

      {/* ══════ SECURITY — FP re-open code ══════ */}
      {canAdd&&(
        <div style={{background:C.darkCard,borderRadius:12,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",border:`1px solid ${C.border}`}}>
          <div style={{flex:"1 1 220px",minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>🔑 {T2("FP Re-open Code")}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{T2("Staff must enter this to unlock a Function Plan that's been marked final. Leave blank to allow unlocking with just a reason, same as before.")}</div>
          </div>
          <input value={fpCodeDraft} onChange={e=>setFpCodeDraft(e.target.value)} placeholder={T2("e.g. 4821")}
            style={{width:140,padding:"9px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,color:C.text,background:C.bg}}/>
          <button onClick={saveFpCode} disabled={fpCodeSaving||fpCodeDraft.trim()===(APP_SETTINGS.fp_unlock_code||"")}
            style={{padding:"9px 16px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",opacity:(fpCodeSaving||fpCodeDraft.trim()===(APP_SETTINGS.fp_unlock_code||""))?.5:1}}>
            {fpCodeSaving?T2("Saving…"):T2("Save")}
          </button>
        </div>
      )}

      {/* ══════ SEARCH ══════ */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={T2("Search by name or ID…")}
        style={{...fld,marginBottom:10,fontSize:13}}/>

      {/* ══════ FILTERS ══════ */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
        <span style={{fontSize:11,color:C.faint,marginRight:2}}>🔍</span>
        <select value={filterRole} onChange={e=>setFilterRole(e.target.value)}
          style={{padding:"4px 10px",borderRadius:20,fontSize:11,border:`1px solid ${filterRole!=="all"?C.gold:C.border}`,color:filterRole!=="all"?C.gold:C.muted,background:filterRole!=="all"?C.goldBg:"transparent",cursor:"pointer"}}>
          <option value="all">{T2("All roles")}</option>
          <option value="tablet">📱 {T2("Section Tablets (grouped)")}</option>
          <option value="dept">🏢 {T2("Dept Roles (grouped)")}</option>
          {ROLE_OPTIONS.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
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
        <button onClick={()=>setShowBasicStaff(v=>!v)} title={T2("Basic Staff — Attendance only are hidden by default")} style={{padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:showBasicStaff?600:400,cursor:"pointer",background:showBasicStaff?C.goldBg:"transparent",border:`1px solid ${showBasicStaff?C.gold:C.border}`,color:showBasicStaff?C.gold:C.muted,transition:"all .15s"}}>{showBasicStaff?"👤 "+T2("Basic staff shown"):"👤 "+T2("Show basic staff")}</button>
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
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Department")}</div>
              <select value={form.dept||""} onChange={e=>{var d=e.target.value;setForm(p=>({...p,dept:d,section:""}));}} style={fld}>
                <option value="">— {T2("Select department")} —</option>
                {(TEAM_DEPTS||[]).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            )}
            {form.role!=='section_tablet'&&!form.role?.startsWith('section_')&&(
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Section")}</div>
              <select value={form.section||""} disabled={!form.dept}
                onChange={e=>{var s=e.target.value;setForm(p=>({...p,section:s,staff_id:editId?p.staff_id:autoGenerateId(s,p.dept)}));}}
                style={{...fld,...(!form.dept?{opacity:.55,cursor:"not-allowed"}:{})}}>
                <option value="">{form.dept?("— "+T2("Select section")+" —"):("— "+T2("Pick a department first")+" —")}</option>
                {((TEAM_DEPTS||[]).find(d=>d.id===form.dept)||{}).sections?.map(s=><option key={s}>{s}</option>)}
              </select>
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

      {/* ══════ MASTER DATA: DEPARTMENTS / SECTIONS / HOME VENUES ══════ */}
      <Modal open={showMasterData} onClose={()=>setShowMasterData(false)} wide>
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:17,fontWeight:600,color:C.text,fontFamily:"var(--font-display)"}}>🗂 {T2("Manage Sections & Venues")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{T2("Controls the Section and Home Venue dropdowns above — add, rename or remove without touching code.")}</div>
        </div>
        <div style={{padding:"20px 24px",maxHeight:"70vh",overflowY:"auto"}}>

          {/* ── Departments & Sections ── */}
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.4,marginBottom:10}}>{T2("Departments & Sections")}</div>
          {TEAM_DEPTS.map(d=>(
            <div key={d.id+'_'+masterTick} style={{border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:10,background:C.bg}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                <input defaultValue={d.icon} onBlur={e=>updateDept(d.id,{icon:e.target.value})} style={{width:42,textAlign:"center",padding:"8px 4px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:16,background:C.surface}}/>
                <input defaultValue={d.label} onBlur={e=>updateDept(d.id,{label:e.target.value})} style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13,fontWeight:600,color:C.text,background:C.surface}}/>
                <button onClick={()=>deleteDept(d.id)} title={T2("Delete department")} style={{padding:"7px 11px",borderRadius:8,border:`1px solid ${C.redBorder}`,background:C.redBg,color:C.red,cursor:"pointer",fontSize:12}}>🗑</button>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                {(d.sections||[]).map(sec=>(
                  <div key={sec} style={{display:"flex",alignItems:"center",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,paddingLeft:10}}>
                    <input defaultValue={sec} onBlur={e=>{if(e.target.value.trim()!==sec) renameSection(d.id,sec,e.target.value);}} size={Math.max(6,sec.length)} style={{border:"none",background:"transparent",fontSize:12,color:C.text,padding:"6px 2px"}}/>
                    <button onClick={()=>deleteSection(d.id,sec)} title={T2("Delete section")} style={{border:"none",background:"transparent",color:C.faint,cursor:"pointer",fontSize:12,padding:"6px 8px"}}>✕</button>
                  </div>
                ))}
                {(d.sections||[]).length===0&&<span style={{fontSize:11,color:C.faint,fontStyle:"italic"}}>{T2("No sections yet")}</span>}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input value={newSectionBuf[d.id]||""} onChange={e=>setNewSectionBuf(p=>({...p,[d.id]:e.target.value}))}
                  onKeyDown={e=>{if(e.key==='Enter') addSection(d.id,newSectionBuf[d.id]);}}
                  placeholder={T2("+ Add section")+"…"} style={{flex:1,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface}}/>
                <button onClick={()=>addSection(d.id,newSectionBuf[d.id])} style={{padding:"7px 14px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ {T2("Add")}</button>
              </div>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginBottom:24}}>
            <input value={newDeptIcon} onChange={e=>setNewDeptIcon(e.target.value)} placeholder="🏢" style={{width:52,textAlign:"center",padding:"9px 4px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface}}/>
            <input value={newDeptLabel} onChange={e=>setNewDeptLabel(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter') addDept(newDeptLabel,newDeptIcon);}}
              placeholder={T2("New department name")+"…"} style={{flex:1,padding:"9px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface}}/>
            <button onClick={()=>addDept(newDeptLabel,newDeptIcon)} style={{padding:"9px 16px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ {T2("Add Department")}</button>
          </div>

          {/* ── Home Venues ── */}
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.4,marginBottom:10}}>{T2("Home Venues")}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
            {HOME_VENUES.map(v=>(
              <div key={v.id+'_'+masterTick} style={{display:"flex",alignItems:"center",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,paddingLeft:10}}>
                <input defaultValue={v.name} onBlur={e=>renameVenue(v.id,e.target.value)} size={Math.max(6,v.name.length)} style={{border:"none",background:"transparent",fontSize:12,color:C.text,padding:"7px 2px"}}/>
                <button onClick={()=>deleteVenue(v.id)} title={T2("Delete venue")} style={{border:"none",background:"transparent",color:C.faint,cursor:"pointer",fontSize:12,padding:"7px 8px"}}>✕</button>
              </div>
            ))}
            {HOME_VENUES.length===0&&<span style={{fontSize:11,color:C.faint,fontStyle:"italic"}}>{T2("No venues yet")}</span>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={newVenueName} onChange={e=>setNewVenueName(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter') addVenue(newVenueName);}}
              placeholder={T2("New venue name")+"…"} style={{flex:1,padding:"9px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface}}/>
            <button onClick={()=>addVenue(newVenueName)} style={{padding:"9px 16px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ {T2("Add Venue")}</button>
          </div>
        </div>
        <div style={{padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end"}}>
          <button onClick={()=>setShowMasterData(false)} style={{padding:"9px 18px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer"}}>{T2("Close")}</button>
        </div>
      </Modal>

      {/* ══════ ROLE MANAGER (V93) ══════ */}
      <Modal open={showRoleManager} onClose={()=>{setShowRoleManager(false);setRoleEditKey(null);}} wide>
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div>
            <div style={{fontSize:17,fontWeight:600,color:C.text,fontFamily:"var(--font-display)"}}>🧩 {T2("Manage Roles")}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{T2("Each role is a bundle of tabs. Create a new role or edit what an existing one includes — changes apply to everyone with that role.")}</div>
          </div>
          {roleEditKey===null&&<button onClick={openRoleCreate} style={{padding:"9px 16px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ {T2("New Role")}</button>}
        </div>
        <div style={{padding:"18px 24px",maxHeight:"70vh",overflowY:"auto"}}>
          {roleEditKey===null ? (
            /* ── List view ── */
            <div style={{display:"flex",flexDirection:"column",gap:8}} key={masterTick}>
              {Object.keys(PRESET_ROLES).sort((a,b)=>(PRESET_ROLES[b].tier||0)-(PRESET_ROLES[a].tier||0)||a.localeCompare(b)).map(function(key){
                var r = PRESET_ROLES[key];
                var count = safeArr(empDb).filter(function(s){return s.role===key;}).length;
                var isBuiltin = !!PRESET_ROLES_DEFAULT[key] || !!r.isBuiltin;
                var isAdmin = key==='admin';
                return (
                  <div key={key} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:C.bg}}>
                    <span style={{fontSize:20}}>{r.icon||'🧩'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,fontWeight:700,color:C.text}}>{r.label}</span>
                        {isBuiltin&&<span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:C.darkCard,color:C.muted}}>{T2("SYSTEM")}</span>}
                      </div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                        {isAdmin?T2("Always full access"):((r.screens||[]).length+' '+T2("tabs"))} · {count} {count===1?T2("staff member"):T2("staff members")}
                      </div>
                    </div>
                    {!isAdmin&&<button onClick={function(){openRoleEdit(key);}} style={{padding:"7px 14px",borderRadius:8,background:C.darkCard,border:`1px solid ${C.border}`,color:C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>✏️ {T2("Edit")}</button>}
                    {!isBuiltin&&<button onClick={function(){confirmDeleteRole(key);}} title={T2("Delete role")} style={{padding:"7px 10px",borderRadius:8,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,fontWeight:600,cursor:"pointer"}}>🗑</button>}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Create/Edit form ── */
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 90px",gap:12,marginBottom:16}}>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Role name")} *</div>
                  <input value={roleForm.label} onChange={function(e){setRoleForm(function(p){return {...p,label:e.target.value};});}} placeholder="e.g. Sales Rep" style={fld}/>
                  {roleEditKey===""&&roleForm.label.trim()&&<div style={{fontSize:10,color:C.faint,marginTop:4}}>{T2("Key")}: {slugifyRoleKey(roleForm.label)||'—'}</div>}
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:5}}>{T2("Icon")}</div>
                  <input value={roleForm.icon} onChange={function(e){setRoleForm(function(p){return {...p,icon:e.target.value};});}} maxLength={4} style={{...fld,textAlign:"center",fontSize:18}}/>
                </div>
              </div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:10,textTransform:"uppercase",letterSpacing:.6}}>{T2("Tab access")}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
                {Object.keys(SCREEN_PERMISSIONS).map(function(sid){
                  var screen = SCREEN_PERMISSIONS[sid];
                  var isOn = (roleForm.screens||[]).includes(sid);
                  return (
                    <div key={sid} onClick={function(){setRoleForm(function(p){var cur=p.screens||[];return {...p,screens:isOn?cur.filter(function(s){return s!==sid;}):cur.concat([sid])};});}}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:`1px solid ${isOn?C.green+"40":C.borderLight}`,background:isOn?C.greenBg+"20":"transparent",cursor:"pointer",transition:"all .15s"}}>
                      <PToggle on={isOn} onChange={function(){}}/>
                      <span style={{fontSize:16}}>{screen.icon}</span>
                      <span style={{fontSize:12,fontWeight:isOn?600:400,color:isOn?C.green:C.faint}}>{screen.label}</span>
                    </div>
                  );
                })}
              </div>
              {roleEditKey!==""&&safeArr(empDb).some(function(s){return s.role===roleEditKey;})&&
                <div style={{fontSize:11,color:C.amber,marginBottom:14}}>⚠ {T2("Changes apply immediately to everyone currently assigned this role.")}</div>}
              <div style={{display:"flex",gap:10}}>
                <button onClick={saveRole} style={{flex:1,padding:"12px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ {T2("Save Role")}</button>
                <button onClick={function(){setRoleEditKey(null);}} style={{padding:"12px 20px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer"}}>{T2("Cancel")}</button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════ SERVICE CHECKLIST MANAGER ══════ */}
      <Modal open={showChecklistManager} onClose={()=>setShowChecklistManager(false)} wide>
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:17,fontWeight:600,color:C.text,fontFamily:"var(--font-display)"}}>📋 {T2("Manage Service Checklist")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{T2("These items show for every function on Service Ops' Checklist tab. Reorder, add, or remove — changes apply everywhere immediately on save.")}</div>
        </div>
        <div style={{padding:"18px 24px",maxHeight:"70vh",overflowY:"auto"}}>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
            {checklistItems.map(function(it,idx){
              return (
                <div key={it.item_key} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,background:C.bg}}>
                  <span style={{fontSize:18,flexShrink:0}}>{it.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>{it.label_en}</div>
                    {it.label_hi&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{it.label_hi}</div>}
                  </div>
                  <button onClick={function(){moveChecklistItem(idx,-1);}} disabled={idx===0} style={{padding:"6px 9px",borderRadius:7,background:C.darkCard,border:`1px solid ${C.border}`,color:idx===0?C.faint:C.muted,fontSize:12,cursor:idx===0?"not-allowed":"pointer"}}>↑</button>
                  <button onClick={function(){moveChecklistItem(idx,1);}} disabled={idx===checklistItems.length-1} style={{padding:"6px 9px",borderRadius:7,background:C.darkCard,border:`1px solid ${C.border}`,color:idx===checklistItems.length-1?C.faint:C.muted,fontSize:12,cursor:idx===checklistItems.length-1?"not-allowed":"pointer"}}>↓</button>
                  <button onClick={function(){removeChecklistItem(idx);}} title={T2("Remove")} style={{padding:"6px 10px",borderRadius:7,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:11,fontWeight:600,cursor:"pointer"}}>🗑</button>
                </div>
              );
            })}
            {checklistItems.length===0&&<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12,fontStyle:"italic"}}>{T2("No items yet — add one below.")}</div>}
          </div>

          <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>{T2("Add item")}</div>
          <div style={{display:"grid",gridTemplateColumns:"56px 1fr 1fr",gap:8,marginBottom:14}}>
            <input value={newCkIcon} onChange={function(e){setNewCkIcon(e.target.value);}} maxLength={4} style={{...fld,textAlign:"center",fontSize:18}}/>
            <input value={newCkLabel} onChange={function(e){setNewCkLabel(e.target.value);}} placeholder={T2("English label")} style={fld}/>
            <input value={newCkHindi} onChange={function(e){setNewCkHindi(e.target.value);}} placeholder={T2("Hindi label (optional)")} style={fld}/>
          </div>
          <button onClick={addChecklistItem} style={{padding:"9px 16px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.text,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:16}}>+ {T2("Add to list")}</button>

          <div style={{display:"flex",gap:10}}>
            <button onClick={saveChecklistItems} disabled={checklistSaving} style={{flex:1,padding:"12px",borderRadius:10,background:C.gold,color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",opacity:checklistSaving?.6:1}}>{checklistSaving?T2("Saving…"):"✓ "+T2("Save Checklist")}</button>
            <button onClick={function(){setShowChecklistManager(false);}} style={{padding:"12px 20px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:13,cursor:"pointer"}}>{T2("Cancel")}</button>
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