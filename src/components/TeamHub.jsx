// Ambria FnB — Team & Attendance Hub
import React, { useState, useRef, useEffect } from "react";
import { supabase } from '../lib/supabase.js';
import { C, ALL_DEPARTMENTS, SECTION_META, OUTSIDE_VENDORS, TEAM_DEPTS } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, CUR_YEAR, safeArr, safePct, calcHoursWorked, fmtHours, classifyDay, uploadStaffPhoto, transliterateName } from '../utils/helpers.js';
import { yrsOfService } from '../data/staffData.js';
import { Avatar, Card, Btn, Chip, STag, DonutChart } from './SharedUI.jsx';
import { dbUpsert } from '../lib/db.js';
import { hasPermission } from '../data/permissions.js';
import { RECIPE_DB } from '../data/recipeData.js';

function TeamHub({attendance,setAttendance,leaves,setLeaves,empDb,setEmpDb,events,lang="en",activeDept,currentUser=null,syncToServer=null}) {
  const [tab,setTab]             = useState("attendance");
  const T2 = s => T(s, lang);

  // Department-to-section mapping for filtering
  const DEPT_SECTIONS_MAP = React.useMemo(function(){
    var map={};
    (TEAM_DEPTS||[]).forEach(function(d){ map[d.id] = d.sections || []; });
    return map;
  }, [TEAM_DEPTS.length]);
  // Reverse lookup: section name → team_department id (for auto-deriving dept on add)
  const SECTION_TO_DEPT = React.useMemo(function(){
    var m={};
    (TEAM_DEPTS||[]).forEach(function(d){
      (d.sections||[]).forEach(function(sec){ m[sec] = d.id; });
    });
    return m;
  }, [TEAM_DEPTS.length]);
  const KITCHEN_SECTIONS = DEPT_SECTIONS_MAP.kitchen || [];
  // Admins are cross-dept — never scope their view by activeDept.
  // Section heads / dept managers stay scoped to their sidebar dept.
  const deptSections = (currentUser?.role === 'admin') ? null : (activeDept && DEPT_SECTIONS_MAP[activeDept] ? DEPT_SECTIONS_MAP[activeDept] : null);

  const [secFilter,setSecFilter] = useState("All");
  const [vendorOrders,setVendorOrders] = useState([]);
  const [vendorSubTab,setVendorSubTab] = useState("book");
  const [bookingForm,setBookingForm]   = useState({vendorId:"",vendorName:"",eventId:"",eventName:"",venue:"",date:"",time:"",endTime:"",pax:"",staffReqs:{},notes:""});
  const [editingOrderId,setEditingOrderId] = useState(null); // which order is vendor editing
  const [showAddStaff,setShowAddStaff] = useState(false);
  const [newStaffForm,setNewStaffForm] = useState({name:"",section:"Beverages",role:"staff"});
  const [dirSearch,setDirSearch] = useState("");
  const [dirFilter,setDirFilter] = useState("All");
  const [attDate,setAttDate] = useState(TODAY);
  const [attDateData,setAttDateData] = useState(null);
  const [attDateLoading,setAttDateLoading] = useState(false);
  const [attSearch,setAttSearch] = useState('');
  const [attStatusFilter,setAttStatusFilter] = useState('All');
  function fetchAttDate(d){
    if(!d||d===TODAY||!supabase){setAttDateData(null);return;}
    setAttDateLoading(true);
    supabase.from('attendance').select('*').eq('date',d).order('in_time',{ascending:true})
      .then(function(res){setAttDateData(res.data||[]);setAttDateLoading(false);})
      .catch(function(){setAttDateData([]);setAttDateLoading(false);});
  }
  const [monthStr,setMonthStr] = useState(TODAY.slice(0,7));
  const [monthData,setMonthData] = useState(null);
  const [monthLoading,setMonthLoading] = useState(false);
  const [monthSearch,setMonthSearch] = useState('');
  const [monthDeptFilter,setMonthDeptFilter] = useState('All');
  const [monthSort,setMonthSort] = useState({col:'daysWorked',dir:'desc'});
  const [monthDetailEmp,setMonthDetailEmp] = useState(null);
  function fetchMonthData(m){
    if(!m||!supabase){setMonthData(null);return;}
    setMonthLoading(true);
    var start=m+'-01';
    var y=+m.split('-')[0],mo=+m.split('-')[1];
    var lastDay=new Date(y,mo,0).getDate();
    var end=m+'-'+String(lastDay).padStart(2,'0');
    if(end>TODAY) end=TODAY;
    supabase.from('attendance').select('*').gte('date',start).lte('date',end)
      .order('date',{ascending:true})
      .then(function(res){setMonthData(res.data||[]);setMonthLoading(false);})
      .catch(function(){setMonthData([]);setMonthLoading(false);});
  }
  const [showAddEmp,setShowAddEmp] = useState(false);
  const [showPins,setShowPins] = useState(false);
  const [selEmp,setSelEmp]       = useState(null);
  const [editEmpForm,setEditEmpForm] = useState(null);
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [newEmpForm,setNewEmpForm] = useState({name:"",name_hi:"",section:"",section_hi:"",role:"staff",pin:"0000",joining:TODAY,active:true});
  const [editPhotoFile,setEditPhotoFile] = useState(null);
  const [editPhotoPreview,setEditPhotoPreview] = useState(null);
  const [addPhotoFile,setAddPhotoFile] = useState(null);
  const [addPhotoPreview,setAddPhotoPreview] = useState(null);
  const [photoUploading,setPhotoUploading] = useState(false);
  const [sectionHiMap,setSectionHiMap] = useState({});
  useEffect(function(){
    var mounted = true;
    (async function(){
      if (!supabase) return;
      var res = await supabase.from('team_sections').select('name, label_hi');
      if (res.error || !res.data || !mounted) return;
      var map = {};
      res.data.forEach(function(r){ if (r.name && r.label_hi) map[r.name] = r.label_hi; });
      setSectionHiMap(map);
    })();
    return function(){ mounted = false; };
  }, []);

  // Computed — filtered by active department. Supabase is the sole source of truth.
  const allEmpDb = safeArr(empDb).filter(function(s){
    return s.is_active !== false && s.role !== 'kiosk_gate' && !(s.role||'').startsWith('section_');
  });
  const deptStaffList = deptSections ? allEmpDb.filter(e=>deptSections.includes(e.section)) : allEmpDb;
  const deptEmpDb = deptStaffList;
  const deptStaffIds = new Set(deptStaffList.map(s=>String(s.staff_id||s.id||'')));
  const todayRecs  = (attendance||[]).filter(a=>a.date===TODAY && (!deptSections || deptSections.includes(a.section)));
  const deptLeaves = deptSections ? safeArr(leaves).filter(l=>deptSections.includes(l.staffSection)) : safeArr(leaves);
  const pending    = deptLeaves.filter(l=>l.status==="Pending");
  const approved   = deptLeaves.filter(l=>l.status==="Approved");
  const rejected   = deptLeaves.filter(l=>l.status==="Rejected");
  const allSecs    = deptSections ? ["All",...deptSections] : ["All",...ALL_DEPARTMENTS];
  const totalActive = safeArr(empDb).filter(function(s){return s.is_active!==false && s.role!=='kiosk_gate' && !s.role?.startsWith('section_');}).length;
  const punchedIn  = todayRecs.filter(function(a){return a.in_time && !a.is_vendor && a.dept!=='vendor';}).length;
  const present    = punchedIn;
  const dirFiltered = deptEmpDb.filter(e=>{
    const ms = dirFilter==="All"||e.section===dirFilter||e.role===dirFilter;
    const mt = !dirSearch.trim()||(e.name||'').toLowerCase().includes(dirSearch.toLowerCase())||(e.id||e.staff_id||e.staffListId||'').toLowerCase().includes(dirSearch.toLowerCase());
    return ms&&mt;
  });

  // Coverage alerts for approved leaves
  const coverageAlerts = approved.reduce((out,l)=>{
    if(!l.staffSection||out.some(x=>x.section===l.staffSection)) return out;
    const total = deptStaffList.filter(s=>s.section===l.staffSection).length;
    const onLeave = approved.filter(x=>x.staffSection===l.staffSection&&x.from<=TODAY&&x.to>=TODAY).length;
    const remaining = total - onLeave;
    const min = 2;
    if(remaining < min) {
      const shortage = min - remaining;
      out.push({section:l.staffSection, remaining, min, shortage,
        vendors: OUTSIDE_VENDORS.filter(v=>v.specialty===l.staffSection).slice(0,3)});
    }
    return out;
  },[]);

  

  // Employee helpers
  function openAddForm(){
    var defSec = (deptSections && deptSections.length>0 && deptSections.length===1) ? deptSections[0] : "";
    setNewEmpForm({name:"",name_hi:"",section:defSec,section_hi:(sectionHiMap[defSec]||""),role:"staff",pin:"0000",joining:TODAY,active:true});
    setAddPhotoFile(null);
    setAddPhotoPreview(null);
    setShowAddEmp(true);
  }
  async function addEmployee(){
    if(!newEmpForm.name.trim()) { alert("Please enter a name"); return; }
    if(!newEmpForm.section) { alert("Please pick a section"); return; }
    var dept = SECTION_TO_DEPT[newEmpForm.section] || null;
    if(!dept) { alert("Section '"+newEmpForm.section+"' is not mapped to any department. Check team_sections table."); return; }
    const newId="STF-"+Date.now();
    var photo_url = null;
    if (addPhotoFile) {
      setPhotoUploading(true);
      photo_url = await uploadStaffPhoto(supabase, newId, addPhotoFile);
      setPhotoUploading(false);
    }
    const record = {...newEmpForm, dept:dept, id:newId, staff_id:newId, staffListId:newId, is_active:true, active:true};
    if (photo_url) record.photo_url = photo_url;
    setEmpDb(p=>[...p,record]);
    if(syncToServer) syncToServer('upsert',record);
    setNewEmpForm({name:"",name_hi:"",section:"",section_hi:"",role:"staff",pin:"0000",joining:TODAY,active:true});
    setAddPhotoFile(null);
    setAddPhotoPreview(null);
    setShowAddEmp(false);
  }
  const [hiBackfillState, setHiBackfillState] = useState('idle');
  async function backfillHindiNames(){
    var toUpdate = safeArr(empDb).filter(function(e){
      return e.is_active !== false && e.name && (!e.name_hi || e.name_hi === '');
    });
    if (toUpdate.length === 0) { alert('All active staff already have Hindi names.'); return; }
    // Preflight: verify Sanscript is loaded (async import may not be ready)
    var probe = transliterateName('Ram');
    if (!probe) {
      await new Promise(function(r){ setTimeout(r, 800); });
      probe = transliterateName('Ram');
    }
    if (!probe) {
      alert('Hindi transliteration library not loaded yet. Please reload the page and try again in a few seconds.');
      return;
    }
    if (!window.confirm('Backfill Hindi names for ' + toUpdate.length + ' staff? This transliterates from English using Sanscript. You can edit any incorrect ones individually after.')) return;
    setHiBackfillState('running');
    var ok = 0, fail = 0;
    for (var i = 0; i < toUpdate.length; i++) {
      var s = toUpdate[i];
      var sid = s.staff_id || s.staffListId || s.id;
      var patch = {name_hi: transliterateName(s.name)};
      if (!s.section_hi && s.section && sectionHiMap[s.section]) patch.section_hi = sectionHiMap[s.section];
      try {
        setEmpDb(function(prev){ return prev.map(function(e){
          var eid = e.staff_id || e.staffListId || e.id;
          return eid === sid ? {...e, ...patch} : e;
        }); });
        if (syncToServer) syncToServer('upsert', {...s, ...patch});
        ok++;
      } catch(e) { fail++; }
    }
    setHiBackfillState('idle');
    alert('✅ Backfilled Hindi names for ' + ok + ' staff.' + (fail>0 ? ' Failed: '+fail : ''));
  }

  async function saveEmpEdit(){
    if(!editEmpForm||!selEmp) return;
    var sid = selEmp.staff_id||selEmp.staffListId||selEmp.id;
    var patch = {...editEmpForm};
    if (editPhotoFile) {
      setPhotoUploading(true);
      var url = await uploadStaffPhoto(supabase, sid, editPhotoFile);
      setPhotoUploading(false);
      if (url) patch.photo_url = url;
    }
    const updated = {...selEmp,...patch};
    setEmpDb(p=>p.map(e=>{
      var eid = e.id||e.staff_id||e.staffListId;
      return eid===sid?{...e,...patch}:e;
    }));
    if(syncToServer) syncToServer('upsert',updated);
    setSelEmp(null);setEditEmpForm(null);setEditPhotoFile(null);setEditPhotoPreview(null);
  }
  function deleteEmployee(){
    if(!deleteConfirm) return;
    var did = deleteConfirm.id||deleteConfirm.staff_id||deleteConfirm.staffListId;
    setEmpDb(p=>p.filter(e=>(e.id||e.staff_id||e.staffListId)!==did));
    if(syncToServer) syncToServer('delete',deleteConfirm);
    setDeleteConfirm(null);
  }

  const TABS = [
    {id:"attendance", l:"✅ Attendance"},
    {id:"monthly",    l:"📊 Monthly"},
    {id:"chefs",      l:"🤝 Outside Staff & Vendors"},
    {id:"directory",  l:"🪪 Team"},
  ];

  return (
    <div>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>👥 Team</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>{TODAY_LABEL} · {punchedIn}/{totalActive} present</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{background:C.greenBg,borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.green}}>{present}</div>
            <div style={{fontSize:11,color:C.green}}>{T2("Present")}</div>
          </div>
          <div style={{background:C.redBg,borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.red}}>{todayRecs.filter(a=>a.status==="Absent").length}</div>
            <div style={{fontSize:11,color:C.red}}>{T2("Absent")}</div>
          </div>
          <div style={{background:C.wineBg,borderRadius:9,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:700,color:C.gold}}>{pending.length}</div>
            <div style={{fontSize:11,color:C.gold}}>Pending</div>
          </div>
        </div>
      </div>

      {/* Coverage alerts */}
      {coverageAlerts.map((a,i)=>(
        <div key={i} style={{background:C.amberBg,border:`1.5px solid ${C.amberBorder}`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.amber}}>⚠ Coverage gap — {a.section}</div>
              <div style={{fontSize:11,color:C.amber,marginTop:2}}>{a.remaining} remaining · need {a.shortage} outside chef{a.shortage>1?"s":""}</div>
            </div>
            <STag name={a.section}/>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {a.vendors.map((v,vi)=>(
              <div key={vi} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 11px",flex:"1 0 130px"}}>
                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5}}>
                  <Avatar name={v.name} size={26} index={vi+6}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{v.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>★ {v.rating} · {v.specialty}</div>
                  </div>
                </div>
                <button onClick={()=>setTab("chefs")} style={{width:"100%",padding:"4px",borderRadius:8,fontSize:11,fontWeight:500,cursor:"pointer",background:C.gold,color:"#fff",border:"none"}}>Book via Vendor Tab →</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Tab bar */}
      <div style={{display:"flex",gap:6,marginBottom:16,borderBottom:`1px solid ${C.border}`,paddingBottom:10,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",flexShrink:0,
            background:tab===t.id?C.wine:"transparent",color:tab===t.id?"#fff":C.muted,
            border:`1.5px solid ${tab===t.id?C.wine:C.border}`
          }}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
        ))}
      </div>

      {/* ── ATTENDANCE ── */}
      {tab==="attendance" && (()=>{
        var allStaff = safeArr(empDb).filter(function(s){return s.is_active!==false && s.role!=='kiosk_gate' && !s.role?.startsWith('section_');});
        var viewDate = attDate||TODAY;
        var isToday = viewDate===TODAY;
        var viewLabel = isToday ? TODAY_LABEL : new Date(viewDate+'T12:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
        var todayAtt = isToday ? safeArr(attendance).filter(function(a){return a.date===TODAY;}) : safeArr(attDateData||[]);
        var staffAtt = todayAtt.filter(function(a){return !a.is_vendor && a.dept!=='vendor';});
        var vendorAtt = todayAtt.filter(function(a){return a.is_vendor || a.dept==='vendor';});
        // Build merged rows: every active staff member + their attendance record
        var merged = allStaff.map(function(s){
          var sid = String(s.staff_id||s.staffListId||s.id);
          var rec = staffAtt.find(function(a){return String(a.staff_id||a.staffId)===sid;});
          var status = 'Absent';
          var hrs = null;
          if(rec && rec.in_time){
            if(rec.out_time){
              var cl = classifyDay(rec.in_time, rec.out_time);
              status = cl.status;
              hrs = cl.hours;
            } else { status = 'Incomplete'; }
          }
          return {id:sid, code:s.staff_id||s.staffListId||'', name:s.name||'', dept:s.dept||'', section:s.section||'',
            inTime:rec?rec.in_time||'':'', outTime:rec?rec.out_time||'':'', status:status, hours:hrs,
            venue:rec?rec.venue||'':'', photo:rec?(rec.in_photo_url||rec.in_photo||rec.photo||null):null, rec:rec};
        });
        // Departments for filter
        var depts = ['All'].concat([...new Set(merged.map(function(r){return r.dept||r.section;}).filter(Boolean))].sort());
        // Counts
        var cPresent = merged.filter(function(r){return r.status==='Present';}).length;
        var cAbsent = merged.filter(function(r){return r.status==='Absent';}).length;
        var cIncomplete = merged.filter(function(r){return r.status==='Incomplete';}).length;
        var cHalf = merged.filter(function(r){return r.status==='Half Day';}).length;
        // Filters
        var fDept = secFilter==='All'?merged:merged.filter(function(r){return r.dept===secFilter||r.section===secFilter;});
        var attStatusColors = {Present:C.green, Absent:C.red, Incomplete:'#E67E22', 'Half Day':C.amber};
        var attStatuses = ['All','Present','Absent','Incomplete','Half Day'];
        var fStatus = attStatusFilter==='All'?fDept:fDept.filter(function(r){return r.status===attStatusFilter;});
        var fSearch = attSearch?fStatus.filter(function(r){return (r.name||'').toLowerCase().includes(attSearch.toLowerCase())||(r.code||'').toLowerCase().includes(attSearch.toLowerCase());}):fStatus;
        var rows = fSearch.sort(function(a,b){return a.name.localeCompare(b.name);});
        return (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4,flexWrap:'wrap',gap:8}}>
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:'var(--font-display)'}}>📋 Daily Attendance</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="date" value={viewDate} max={TODAY} onChange={function(e){var d=e.target.value;if(d){setAttDate(d);if(d!==TODAY)fetchAttDate(d);else setAttDateData(null);}}}
                style={{padding:'6px 10px',borderRadius:8,border:'1px solid '+C.border,fontSize:12,color:C.text,background:C.surface}}/>
              {!isToday&&<button onClick={function(){setAttDate(TODAY);setAttDateData(null);}}
                style={{padding:'6px 14px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',background:C.gold,color:'#fff',border:'none'}}>Today</button>}
            </div>
          </div>
          <div style={{fontSize:12,color:isToday?C.muted:C.amber,marginBottom:14,fontWeight:isToday?400:600}}>{viewLabel}{!isToday?' (historical)':''}{attDateLoading?' — loading…':''}</div>
          {/* Filters */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14,alignItems:'center'}}>
            <select value={secFilter} onChange={function(e){setSecFilter(e.target.value);}} style={{padding:'8px 12px',borderRadius:10,border:'1px solid '+C.border,fontSize:12,color:C.text,background:C.surface,minWidth:120}}>
              {depts.map(function(d){return <option key={d} value={d}>{d}</option>;})}
            </select>
            <div style={{display:'flex',gap:3}}>
              {attStatuses.map(function(st){
                var active = attStatusFilter===st;
                return <button key={st} onClick={function(){setAttStatusFilter(st);}} style={{padding:'6px 12px',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',border:'1px solid '+(active?attStatusColors[st]||C.gold:C.border),background:active?(attStatusColors[st]||C.gold):'transparent',color:active?'#fff':(attStatusColors[st]||C.muted)}}>{st}</button>;
              })}
            </div>
            <input value={attSearch} onChange={function(e){setAttSearch(e.target.value);}} placeholder="Search name or code…" style={{padding:'8px 12px',borderRadius:10,border:'1px solid '+C.border,fontSize:12,color:C.text,background:C.surface,flex:1,minWidth:140}}/>
          </div>
          {/* Summary cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:16}}>
            {[{l:'Total',v:merged.length,c:C.text},{l:'Present',v:cPresent,c:C.green},{l:'Absent',v:cAbsent,c:C.red},{l:'Incomplete',v:cIncomplete,c:'#E67E22'},{l:'Half Day',v:cHalf,c:C.amber}].map(function(card){
              return <div key={card.l} style={{background:C.surface,borderRadius:10,padding:'10px 12px',textAlign:'center',border:'1px solid '+C.border}}>
                <div style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:0.5}}>{card.l}</div>
                <div style={{fontSize:22,fontWeight:700,color:card.c,marginTop:2}}>{card.v}</div>
              </div>;
            })}
          </div>
          {/* Table header */}
          <div style={{display:'grid',gridTemplateColumns:'92px 40px 1fr 120px 70px 70px 80px 60px 100px',gap:4,padding:'8px 12px',background:C.surface,borderRadius:'10px 10px 0 0',border:'1px solid '+C.border,borderBottom:'none',fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:0.5}}>
            <div>Code</div><div></div><div>Name</div><div>Dept</div><div>IN</div><div>OUT</div><div>Status</div><div>Hrs</div><div>Venue</div>
          </div>
          {/* Table rows */}
          <div style={{border:'1px solid '+C.border,borderRadius:'0 0 10px 10px',overflow:'hidden'}}>
            {rows.length===0?<div style={{padding:20,textAlign:'center',color:C.muted,fontSize:12}}>No records match filters</div>
            :rows.map(function(r,ri){
              var sc = attStatusColors[r.status]||C.muted;
              return <div key={r.id} style={{display:'grid',gridTemplateColumns:'92px 40px 1fr 120px 70px 70px 80px 60px 100px',gap:4,padding:'10px 12px',alignItems:'center',background:ri%2===0?C.bg:C.surface,borderTop:ri>0?'1px solid '+C.border:'none',fontSize:12}}>
                <div title={r.code} style={{color:C.muted,fontSize:11,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{/^STF-\d{8,}$/.test(r.code)?'STF·'+r.code.slice(-4):r.code}</div>
                <div>{r.photo?<img src={r.photo} style={{width:28,height:28,borderRadius:'50%',objectFit:'cover'}}/>:<Avatar name={r.name} size={28} index={ri}/>}</div>
                <div style={{fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</div>
                <div style={{color:C.muted,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.dept||r.section}</div>
                <div style={{color:r.inTime?C.green:C.muted,fontWeight:600}}>{r.inTime||'—'}</div>
                <div style={{color:r.outTime?C.red:C.muted,fontWeight:600}}>{r.outTime||'—'}</div>
                <div><span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:6,background:sc+'18',color:sc}}>{r.status.toUpperCase()}</span></div>
                <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{r.hours!=null?fmtHours(r.hours):'—'}</div>
                <div style={{fontSize:10,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.venue||'—'}</div>
              </div>;
            })}
          </div>
          {/* Vendor section */}
          {vendorAtt.length>0&&<div style={{marginTop:16}}>
            <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:8}}>🏢 Outside Vendors ({vendorAtt.length})</div>
            {vendorAtt.map(function(a,i){
              return <div key={a.id||i} style={{display:'flex',gap:12,alignItems:'center',padding:'10px 14px',marginBottom:4,background:C.surface,borderRadius:10,border:'1px solid '+C.border}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{a.staff_name||'Unknown'}</div>
                  <div style={{fontSize:11,color:'#9060C8'}}>{a.vendor_company||''}{a.vendor_purpose?' · '+a.vendor_purpose:''}</div>
                </div>
                <div style={{fontSize:12,fontWeight:700,color:a.in_time?C.green:C.red}}>{a.in_time?'IN: '+a.in_time:a.out_time?'OUT: '+a.out_time:'—'}</div>
              </div>;
            })}
          </div>}
        
        </div>);
      })()}

      {/* ── MONTHLY ── */}
      {tab==="monthly" && (()=>{
        // Auto-fetch on first open
        if(!monthData&&!monthLoading){fetchMonthData(monthStr);return <div style={{padding:30,textAlign:'center',color:C.muted}}>Loading…</div>;}
        var allStaff = safeArr(empDb).filter(function(s){return s.is_active!==false && s.role!=='kiosk_gate' && !s.role?.startsWith('section_');});
        var recs = safeArr(monthData).filter(function(a){return !a.is_vendor && a.dept!=='vendor';});
        // Compute date range
        var y=+monthStr.split('-')[0],mo=+monthStr.split('-')[1];
        var lastDay=new Date(y,mo,0).getDate();
        var endDate=monthStr+'-'+String(lastDay).padStart(2,'0');
        if(endDate>TODAY) endDate=TODAY;
        var daysInRange=+endDate.split('-')[2];
        // Build per-employee stats
        var rows = allStaff.map(function(s){
          var sid=String(s.staff_id||s.staffListId||s.id);
          var myRecs=recs.filter(function(a){return String(a.staff_id||a.staffId)===sid;});
          var present=0,halfDay=0,incomplete=0,totalHrs=0;
          myRecs.forEach(function(r){
            if(!r.in_time) return;
            if(!r.out_time){incomplete++;return;}
            var cl=classifyDay(r.in_time,r.out_time);
            if(cl.status==='Present') present++;
            else if(cl.status==='Half Day') halfDay++;
            if(cl.hours) totalHrs+=cl.hours;
          });
          var daysWorked=present+halfDay+incomplete;
          var absent=Math.max(0,daysInRange-daysWorked);
          var avgHrs=daysWorked>0?totalHrs/daysWorked:0;
          return {id:sid,name:s.name||'',dept:s.dept||s.section||'',section:s.section||'',
            present:present,halfDay:halfDay,incomplete:incomplete,absent:absent,
            daysWorked:daysWorked,totalHrs:totalHrs,avgHrs:avgHrs};
        });
        // Sort by selected column
        rows.sort(function(a,b){
          var col=monthSort.col,dir=monthSort.dir==='asc'?1:-1;
          var av=a[col],bv=b[col];
          if(typeof av==='string') return av.localeCompare(bv)*dir;
          return ((av||0)-(bv||0))*dir;
        });
        // Totals
        var totPresent=rows.reduce(function(a,r){return a+r.present;},0);
        var totHalf=rows.reduce(function(a,r){return a+r.halfDay;},0);
        var totInc=rows.reduce(function(a,r){return a+r.incomplete;},0);
        var avgAtt=rows.length>0?(rows.reduce(function(a,r){return a+r.daysWorked;},0)/rows.length).toFixed(1):0;
        var monthLabel=new Date(y,mo-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
        var deptOpts=Array.from(new Set(rows.map(function(r){return r.dept;}).filter(Boolean))).sort();
        var q=monthSearch.trim().toLowerCase();
        var filteredRows=rows.filter(function(r){
          if(monthDeptFilter!=='All' && r.dept!==monthDeptFilter) return false;
          if(q && !r.name.toLowerCase().includes(q)) return false;
          return true;
        });
        var fPresent=filteredRows.reduce(function(a,r){return a+r.present;},0);
        var fHalf=filteredRows.reduce(function(a,r){return a+r.halfDay;},0);
        var fInc=filteredRows.reduce(function(a,r){return a+r.incomplete;},0);
        var fAvgAtt=filteredRows.length>0?(filteredRows.reduce(function(a,r){return a+r.daysWorked;},0)/filteredRows.length).toFixed(1):0;
        return (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:'var(--font-display)'}}>📊 Monthly Attendance</div>
              <div style={{fontSize:12,color:C.muted}}>{monthLabel} · {daysInRange} days · {filteredRows.length}/{rows.length} staff</div>
            </div>
            <input type="month" value={monthStr} max={TODAY.slice(0,7)}
              onChange={function(e){var m=e.target.value;if(m){setMonthStr(m);setMonthData(null);fetchMonthData(m);}}}
              style={{padding:'6px 10px',borderRadius:8,border:'1px solid '+C.border,fontSize:12,color:C.text,background:C.surface}}/>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <input type="text" placeholder="🔍 Search name…" value={monthSearch}
              onChange={function(e){setMonthSearch(e.target.value);}}
              style={{padding:'7px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:12,color:C.text,background:C.surface,minWidth:200,flex:'0 1 260px'}}/>
            <select value={monthDeptFilter} onChange={function(e){setMonthDeptFilter(e.target.value);}}
              style={{padding:'7px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:12,color:C.text,background:C.surface,cursor:'pointer'}}>
              <option value="All">All Depts</option>
              {deptOpts.map(function(d){return <option key={d} value={d}>{d}</option>;})}
            </select>
            {(monthSearch||monthDeptFilter!=='All')&&
              <button onClick={function(){setMonthSearch('');setMonthDeptFilter('All');}}
                style={{padding:'7px 12px',borderRadius:8,border:'1px solid '+C.border,background:'transparent',color:C.muted,fontSize:11,cursor:'pointer'}}>✕ Clear</button>}
            <div style={{flex:1}}></div>
            <button onClick={function(){
              var esc=function(v){var s=String(v==null?'':v);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
              var fmtHrs=function(h){var m=Math.round((h||0)*60);return Math.floor(m/60)+'h '+(m%60)+'m';};
              var lines=[];
              lines.push(['Monthly Attendance']);
              lines.push([monthLabel, daysInRange+' days', filteredRows.length+'/'+rows.length+' staff', 'Dept: '+monthDeptFilter]);
              lines.push([]);
              lines.push(['Summary']);
              lines.push(['Avg Days/Person', fAvgAtt]);
              lines.push(['Total Present Days', fPresent]);
              lines.push(['Half Days', fHalf]);
              lines.push(['Incomplete', fInc]);
              lines.push([]);
              lines.push(['Name','Dept','Section','Present','Half','Absent','Incomplete','Total Hrs','Avg Hrs/Day']);
              filteredRows.forEach(function(r){
                lines.push([r.name, r.dept, r.section||'', r.present, r.halfDay, r.absent, r.incomplete, fmtHrs(r.totalHrs), (r.avgHrs||0).toFixed(1)]);
              });
              lines.push([]);
              lines.push(['Totals', filteredRows.length+' staff', '', fPresent, fHalf, filteredRows.reduce(function(a,r){return a+r.absent;},0), fInc,
                fmtHrs(filteredRows.reduce(function(a,r){return a+(r.totalHrs||0);},0)), '']);
              var csv='\ufeff'+lines.map(function(row){return row.map(esc).join(',');}).join('\r\n');
              var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
              var url=URL.createObjectURL(blob);
              var a=document.createElement('a');
              var slug=monthStr+(monthDeptFilter!=='All'?'_'+monthDeptFilter.toLowerCase().replace(/\s+/g,'-'):'');
              a.href=url; a.download='attendance_'+slug+'.csv';
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              setTimeout(function(){URL.revokeObjectURL(url);},100);
            }}
              style={{padding:'7px 14px',borderRadius:8,border:'1px solid '+C.green,background:C.greenBg,color:C.green,fontSize:11,fontWeight:600,cursor:'pointer'}}>
              📥 Export Excel
            </button>
          </div>
          {monthLoading&&<div style={{padding:30,textAlign:'center',color:C.muted,fontSize:12}}>Loading…</div>}
          {!monthLoading&&monthData&&<div>
            {/* Summary */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
              {[{l:'Avg Days/Person',v:fAvgAtt,c:C.text},{l:'Total Present Days',v:fPresent,c:C.green},{l:'Half Days',v:fHalf,c:C.amber},{l:'Incomplete',v:fInc,c:'#E67E22'}].map(function(card){
                return <div key={card.l} style={{background:C.surface,borderRadius:10,padding:'10px 12px',textAlign:'center',border:'1px solid '+C.border}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:0.5}}>{card.l}</div>
                  <div style={{fontSize:22,fontWeight:700,color:card.c,marginTop:2}}>{card.v}</div>
                </div>;
              })}
            </div>
            {/* Table */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 100px 55px 55px 55px 55px 65px 60px',gap:4,padding:'8px 12px',background:C.surface,borderRadius:'10px 10px 0 0',border:'1px solid '+C.border,borderBottom:'none',fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:0.5}}>
              {[{k:'name',l:'Name',a:'left'},{k:'dept',l:'Dept',a:'left'},{k:'present',l:'Present',a:'center'},{k:'halfDay',l:'Half',a:'center'},{k:'absent',l:'Absent',a:'center'},{k:'incomplete',l:'Inc.',a:'center'},{k:'totalHrs',l:'Hrs',a:'center'},{k:'avgHrs',l:'Avg/d',a:'center'}].map(function(h){
                var active=monthSort.col===h.k;
                return <div key={h.k} onClick={function(){setMonthSort(function(p){return{col:h.k,dir:p.col===h.k&&p.dir==='desc'?'asc':'desc'};});}}
                  style={{textAlign:h.a,cursor:'pointer',userSelect:'none',color:active?C.text:C.muted,display:'flex',alignItems:'center',justifyContent:h.a==='center'?'center':'flex-start',gap:3}}>
                  <span>{h.l}</span>
                  <span style={{fontSize:9,opacity:active?1:0.3}}>{active?(monthSort.dir==='desc'?'▼':'▲'):'⇅'}</span>
                </div>;
              })}
            </div>
            <div style={{border:'1px solid '+C.border,borderRadius:'0 0 10px 10px',overflow:'hidden'}}>
              {filteredRows.length===0?<div style={{padding:20,textAlign:'center',color:C.muted,fontSize:12}}>{rows.length===0?'No data for this month':'No staff match your filters'}</div>
              :filteredRows.map(function(r,ri){
                var _rowBg = ri%2===0?C.bg:C.surface;
                return <div key={r.id} onClick={function(){setMonthDetailEmp(r);}} onMouseEnter={function(e){e.currentTarget.style.background=C.goldBg;}} onMouseLeave={function(e){e.currentTarget.style.background=_rowBg;}} style={{display:'grid',gridTemplateColumns:'1fr 100px 55px 55px 55px 55px 65px 60px',gap:4,padding:'10px 12px',alignItems:'center',background:_rowBg,borderTop:ri>0?'1px solid '+C.border:'none',fontSize:12,cursor:'pointer',transition:'background .15s'}}>
                  <div style={{fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</div>
                  <div style={{color:C.muted,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.dept}</div>
                  <div style={{color:C.green,fontWeight:700,textAlign:'center'}}>{r.present}</div>
                  <div style={{color:C.amber,fontWeight:700,textAlign:'center'}}>{r.halfDay||'—'}</div>
                  <div style={{color:C.red,fontWeight:700,textAlign:'center'}}>{r.absent}</div>
                  <div style={{color:'#E67E22',fontWeight:700,textAlign:'center'}}>{r.incomplete||'—'}</div>
                  <div style={{color:C.text,fontWeight:600,textAlign:'center'}}>{r.totalHrs>0?fmtHours(r.totalHrs):'—'}</div>
                  <div style={{color:r.avgHrs>=6?C.green:r.avgHrs>=4?C.amber:C.red,fontWeight:600,textAlign:'center',fontSize:11}}>{r.avgHrs>0?r.avgHrs.toFixed(1)+'h':'—'}</div>
                </div>;
              })}
            </div>
          </div>}
          {monthDetailEmp && (
            <div onClick={function(){setMonthDetailEmp(null);}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
              <div onClick={function(e){e.stopPropagation();}} style={{background:C.surface,borderRadius:14,padding:'20px 24px',maxWidth:560,width:'100%',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14,paddingBottom:12,borderBottom:'1px solid '+C.border}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:'var(--font-display)'}}>{monthDetailEmp.name}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{monthDetailEmp.dept} · {monthLabel}</div>
                  </div>
                  <button onClick={function(){setMonthDetailEmp(null);}} style={{background:'transparent',border:'1px solid '+C.border,borderRadius:8,width:28,height:28,cursor:'pointer',color:C.muted,fontSize:16,lineHeight:1,padding:0}}>×</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:14}}>
                  <div style={{background:C.greenBg,borderRadius:8,padding:'8px 6px',textAlign:'center'}}><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',fontWeight:600,letterSpacing:0.5}}>Present</div><div style={{fontSize:20,color:C.green,fontWeight:700}}>{monthDetailEmp.present}</div></div>
                  <div style={{background:C.amberBg,borderRadius:8,padding:'8px 6px',textAlign:'center'}}><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',fontWeight:600,letterSpacing:0.5}}>Half</div><div style={{fontSize:20,color:C.amber,fontWeight:700}}>{monthDetailEmp.halfDay}</div></div>
                  <div style={{background:'#F5E7DE',borderRadius:8,padding:'8px 6px',textAlign:'center'}}><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',fontWeight:600,letterSpacing:0.5}}>Inc.</div><div style={{fontSize:20,color:'#E67E22',fontWeight:700}}>{monthDetailEmp.incomplete}</div></div>
                  <div style={{background:C.redBg,borderRadius:8,padding:'8px 6px',textAlign:'center'}}><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',fontWeight:600,letterSpacing:0.5}}>Absent</div><div style={{fontSize:20,color:C.red,fontWeight:700}}>{monthDetailEmp.absent}</div></div>
                </div>
                <div style={{flex:1,overflow:'auto',border:'1px solid '+C.border,borderRadius:8}}>
                  <div style={{display:'grid',gridTemplateColumns:'90px 1fr 1fr 65px 90px',gap:4,padding:'8px 12px',background:C.bg,fontSize:9,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:0.5,borderBottom:'1px solid '+C.border,position:'sticky',top:0}}>
                    <div>Date</div><div>In</div><div>Out</div><div>Hrs</div><div>Status</div>
                  </div>
                  {(function(){
                    var myRecs = recs.filter(function(a){return String(a.staff_id||a.staffId)===monthDetailEmp.id;});
                    var days=[];
                    for(var d=1; d<=daysInRange; d++){
                      var ds = monthStr+'-'+String(d).padStart(2,'0');
                      var rec = myRecs.find(function(a){return a.date===ds;});
                      days.push({date:ds, rec:rec});
                    }
                    return days.map(function(dd,di){
                      var r=dd.rec;
                      var stColor=C.muted, stText='ABSENT', hrsStr='—';
                      if(r&&r.in_time){
                        if(!r.out_time){stText='INCOMPLETE'; stColor='#E67E22';}
                        else{
                          var cl=classifyDay(r.in_time,r.out_time);
                          stText=(cl.status||'—').toUpperCase();
                          stColor=cl.status==='Present'?C.green:cl.status==='Half Day'?C.amber:C.muted;
                          if(cl.hours) hrsStr=fmtHours(cl.hours);
                        }
                      }
                      var dow=new Date(dd.date+'T00:00').toLocaleDateString('en-IN',{weekday:'short'});
                      return <div key={dd.date} style={{display:'grid',gridTemplateColumns:'90px 1fr 1fr 65px 90px',gap:4,padding:'9px 12px',alignItems:'center',background:di%2===0?C.bg:C.surface,borderTop:di>0?'1px solid '+C.border:'none',fontSize:12}}>
                        <div style={{color:C.text,fontWeight:600}}><span style={{color:C.muted,fontSize:10,marginRight:4}}>{dow}</span>{dd.date.slice(-2)}</div>
                        <div style={{color:r&&r.in_time?C.green:C.muted,fontWeight:600,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace'}}>{r&&r.in_time?r.in_time.slice(0,5):'—'}</div>
                        <div style={{color:r&&r.out_time?C.red:C.muted,fontWeight:600,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace'}}>{r&&r.out_time?r.out_time.slice(0,5):'—'}</div>
                        <div style={{color:C.text,fontWeight:600}}>{hrsStr}</div>
                        <div><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:5,background:stColor+'22',color:stColor}}>{stText}</span></div>
                      </div>;
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>);
      })()}


      {/* ── OUTSIDE STAFF & VENDORS ── */}
      {tab==="chefs" && (
        <div>
          {/* Manager / Vendor toggle */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:6}}>
              {[{v:"book",l:"📋 Book Staff"},{v:"orders",l:"📦 Orders & Attendance"}].map(t=>(
                <button key={t.v} onClick={()=>setVendorSubTab(t.v)} disabled={vendorSubTab==="portal"}
                  style={{padding:"7px 16px",borderRadius:20,fontSize:12,fontWeight:500,cursor:vendorSubTab==="portal"?"not-allowed":"pointer",
                    background:vendorSubTab===t.v?C.wine:"transparent",color:vendorSubTab===t.v?"#fff":vendorSubTab==="portal"?C.faint:C.muted,
                    border:`1.5px solid ${vendorSubTab===t.v?C.wine:C.border}`,opacity:vendorSubTab==="portal"?.5:1}}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
              ))}
            </div>
            {/* Vendor Portal toggle */}
            <button onClick={()=>setVendorSubTab(vendorSubTab==="portal"?"book":"portal")}
              style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",borderRadius:10,cursor:"pointer",transition:"all .2s",
                background:vendorSubTab==="portal"?C.wine:C.wineBg,
                border:`1.5px solid ${C.gold}`,color:vendorSubTab==="portal"?"#fff":C.wine,fontWeight:600,fontSize:12}}>
              <span style={{fontSize:14}}>🏢</span>
              {vendorSubTab==="portal" ? "← Exit Vendor Portal" : "Open Vendor Portal"}
              {vendorSubTab!=="portal" && vendorOrders.filter(o=>o.status==="Pending").length > 0 &&
                <span style={{background:C.gold,color:"#fff",fontSize:12,fontWeight:700,padding:"1px 6px",borderRadius:10,marginLeft:2}}>
                  {vendorOrders.filter(o=>o.status==="Pending").length}
                </span>
              }
            </button>
          </div>
          {/* Vendor Portal banner */}
          {vendorSubTab==="portal" && (
            <div style={{background:`linear-gradient(155deg,#06060A 0%,#12100A 40%,#0A0908 100%)`,borderRadius:12,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>🏢</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:"var(--font-display)"}}>{T2("Vendor Portal View")}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.65)"}}>You are viewing as a vendor. Accept, edit or reject bookings sent from kitchen management.</div>
              </div>
            </div>
          )}

          {/* BOOK STAFF */}
          {vendorSubTab==="book" && (
            <div>
              {!bookingForm.vendorId ? (
                <div>
                  <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Select a vendor to place a booking request.</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                    {OUTSIDE_VENDORS.map(v=>(
                      <div key={v.id} onClick={()=>setBookingForm(p=>({...p,vendorId:v.id,vendorName:v.name}))} style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"16px",cursor:"pointer"}}>
                        <div style={{width:40,height:40,borderRadius:10,background:C.wineBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:10}}>🏢</div>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{v.name}</div>
                        <STag name={v.specialty}/>
                        <div style={{fontSize:11,color:C.muted,marginTop:6}}>{v.phone}</div>
                        <div style={{display:"flex",gap:1,marginTop:5}}>
                          {[1,2,3,4,5].map(s=><span key={s} style={{fontSize:11,color:s<=+(v.rating||0)?"#F59E0B":"#D1D5DB"}}>★</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {/* Vendor selected */}
                  <div style={{background:C.wineBg,border:`1.5px solid ${C.wineBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{width:36,height:36,borderRadius:9,background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff"}}>🏢</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:C.gold}}>{bookingForm.vendorName}</div>
                        <div style={{fontSize:11,color:C.gold,opacity:.7}}>Booking will be sent to this vendor</div>
                      </div>
                    </div>
                    <button onClick={()=>setBookingForm(p=>({...p,vendorId:"",vendorName:""}))} style={{fontSize:11,color:C.gold,background:"none",border:`1px solid ${C.wineBorder}`,borderRadius:8,padding:"6px 12px",cursor:"pointer"}}>Change ×</button>
                  </div>

                  {/* Event + logistics */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Event</div>
                      <select value={bookingForm.eventId} onChange={e=>{const ev=(events||[]).find(x=>x.id===e.target.value);setBookingForm(p=>({...p,eventId:e.target.value,eventName:ev?.guest||""}));}} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
                        <option value="">Select event…</option>
                        {(events||[]).map(ev=><option key={ev.id} value={ev.id}>{ev.guest} · {ev.date}</option>)}
                        <option value="none">No specific event</option>
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Venue</div>
                      <select value={bookingForm.venue} onChange={e=>setBookingForm(p=>({...p,venue:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
                        <option value="">Select…</option>
                        {["Ambria Pushpanjali","Ambria Exotica","Manaktala Farm","Ambria Restro","Outdoor Catering (ODC)"].map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Date</div>
                      <input type="date" value={bookingForm.date} onChange={e=>setBookingForm(p=>({...p,date:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Reporting Time</div>
                      <input value={bookingForm.time} onChange={e=>setBookingForm(p=>({...p,time:e.target.value}))} placeholder="e.g. 3:00 PM" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>End Time</div>
                      <input value={bookingForm.endTime} onChange={e=>setBookingForm(p=>({...p,endTime:e.target.value}))} placeholder="e.g. 11:00 PM" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Expected Pax</div>
                      <input type="number" value={bookingForm.pax} onChange={e=>setBookingForm(p=>({...p,pax:e.target.value}))} placeholder="e.g. 500" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    </div>
                  </div>

                  {/* Section qty table */}
                  <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>Staff Required by Section</div>
                  <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:14}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 110px 1fr",background:C.bg,padding:"8px 14px",borderBottom:`1px solid ${C.border}`}}>
                      {["Section","Qty",T2("Notes")].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase"}}>{h}</div>)}
                    </div>
                    {KITCHEN_SECTIONS.map(sec=>{
                      const m   = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                      const qty = bookingForm.staffReqs?.[sec]?.qty||0;
                      const note= bookingForm.staffReqs?.[sec]?.note||"";
                      function setQty(n){setBookingForm(p=>({...p,staffReqs:{...(p.staffReqs||{}),[sec]:{...(p.staffReqs?.[sec]||{}),qty:Math.max(0,n)}}}));}
                      function setNote(n){setBookingForm(p=>({...p,staffReqs:{...(p.staffReqs||{}),[sec]:{...(p.staffReqs?.[sec]||{}),note:n}}}));}
                      return (
                        <div key={sec} style={{display:"grid",gridTemplateColumns:"1fr 110px 1fr",padding:"12px 16px",borderBottom:`1px solid ${C.borderLight}`,alignItems:"center"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:14}}>{m.icon}</span>
                            <span style={{fontSize:12,fontWeight:500,color:C.text}}>{sec}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                            <button onClick={()=>setQty(qty-1)} style={{width:26,height:26,borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,color:C.text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                            <span style={{fontSize:14,fontWeight:600,color:qty>0?C.wine:C.muted,minWidth:18,textAlign:"center"}}>{qty}</span>
                            <button onClick={()=>setQty(qty+1)} style={{width:26,height:26,borderRadius:8,background:qty>0?C.wineBg:C.bg,border:`1px solid ${qty>0?C.wineBorder:C.border}`,color:qty>0?C.wine:C.text,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                          </div>
                          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Special requirements…" style={{padding:"5px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg,width:"100%",boxSizing:"border-box"}}/>
                        </div>
                      );
                    })}
                    <div style={{padding:"8px 14px",background:C.bg,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,color:C.muted}}>Total staff requested</span>
                      <span style={{fontSize:14,fontWeight:700,color:C.gold}}>{Object.values(bookingForm.staffReqs||{}).reduce((a,r)=>a+(r.qty||0),0)} people</span>
                    </div>
                  </div>

                  {/* Notes + send */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Additional Notes for Vendor</div>
                    <textarea value={bookingForm.notes||""} onChange={e=>setBookingForm(p=>({...p,notes:e.target.value}))} placeholder="Dress code, reporting point, special instructions…" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,resize:"none",height:60,fontFamily:"inherit",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                    <Btn onClick={()=>setBookingForm({vendorId:"",vendorName:"",eventId:"",eventName:"",venue:"",date:"",time:"",endTime:"",pax:"",staffReqs:{},notes:""})} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>{T2("Clear")}</Btn>
                    <Btn onClick={()=>{
                      const total=Object.values(bookingForm.staffReqs||{}).reduce((a,r)=>a+(r.qty||0),0);
                      if(!bookingForm.vendorId||!bookingForm.date||total===0) return;
                      setVendorOrders(p=>[...p,{id:"ORD-"+Date.now(),vendorId:bookingForm.vendorId,vendorName:bookingForm.vendorName,eventId:bookingForm.eventId,eventName:bookingForm.eventName,venue:bookingForm.venue,date:bookingForm.date,time:bookingForm.time,endTime:bookingForm.endTime,pax:bookingForm.pax,staffReqs:bookingForm.staffReqs,notes:bookingForm.notes,status:"Pending",vendorNote:"",confirmedStaff:[]}]);
                      setBookingForm({vendorId:"",vendorName:"",eventId:"",eventName:"",venue:"",date:"",time:"",endTime:"",pax:"",staffReqs:{},notes:""});
                      setVendorSubTab("orders");
                    }} style={{fontSize:12,padding:"9px 22px"}}>📤 Send to Vendor →</Btn>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ORDERS & ATTENDANCE */}
          {vendorSubTab==="orders" && (
            <div>
              {vendorOrders.length===0 ? (
                <div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,fontSize:13,color:C.muted}}>No orders placed yet. Use "Book Staff" to send your first request.</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[...vendorOrders].reverse().map(order=>{
                    const totalReq=Object.values(order.staffReqs||{}).reduce((a,r)=>a+(r.qty||0),0);
                    const scol=order.status==="Confirmed"?C.green:order.status==="Rejected"?C.red:order.status==="Edited"?C.amber:C.muted;
                    const sbg =order.status==="Confirmed"?C.greenBg:order.status==="Rejected"?C.redBg:order.status==="Edited"?C.amberBg:C.bg;
                    return (
                      <Card key={order.id} style={{padding:"14px 18px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                          <div>
                            <div style={{fontSize:14,fontWeight:700,color:C.text}}>{order.vendorName}</div>
                            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{order.date} · {order.time}{order.endTime?" – "+order.endTime:""} · {order.venue||"Venue TBD"}{order.pax?" · "+order.pax+" pax":""}</div>
                            {order.eventName&&<div style={{fontSize:11,color:C.gold,marginTop:1}}>📋 {order.eventName}</div>}
                          </div>
                          <span style={{fontSize:12,fontWeight:700,padding:"4px 11px",borderRadius:20,background:sbg,color:scol}}>{order.status}</span>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:order.vendorNote?8:0}}>
                          {Object.entries(order.staffReqs||{}).filter(([,r])=>r.qty>0).map(([sec,r])=>{
                            const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                            return <div key={sec} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,background:m.color+"15",border:"1px solid "+m.color+"30"}}><span style={{fontSize:11}}>{m.icon}</span><span style={{fontSize:12,fontWeight:600,color:m.color}}>{r.qty}× {sec}</span></div>;
                          })}
                          <div style={{padding:"6px 12px",borderRadius:20,background:C.bg,border:`1px solid ${C.border}`}}><span style={{fontSize:11,color:C.muted}}>{totalReq} total</span></div>
                        </div>
                        {order.vendorNote&&<div style={{background:C.amberBg,borderRadius:8,padding:"10px 14px",fontSize:11,color:C.amber,marginBottom:8}}>💬 {order.vendorNote}</div>}
                        {order.status==="Edited"&&order.editedReqs&&Object.keys(order.editedReqs).length>0&&(
                          <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:8,padding:"8px 12px",marginBottom:8}}>
                            <div style={{fontSize:10,fontWeight:600,color:C.amber,marginBottom:6}}>✏ VENDOR'S REVISED PROPOSAL — Awaiting your acceptance</div>
                            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                              {Object.entries(order.editedReqs).filter(([,r])=>(r.qty||0)>0).map(([sec,r])=>{
                                const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                                const orig=order.staffReqs?.[sec]?.qty||0;
                                return <div key={sec} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,background:m.color+"15",border:"1px solid "+m.color+"30"}}>
                                  <span style={{fontSize:10}}>{m.icon}</span>
                                  <span style={{fontSize:10,fontWeight:600,color:m.color}}>{r.qty}× {sec}</span>
                                  {r.qty!==orig&&<span style={{fontSize:11,color:C.amber}}>(was {orig})</span>}
                                </div>;
                              })}
                            </div>
                            <div style={{display:"flex",gap:6,marginTop:8}}>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Confirmed",staffReqs:{...(o.staffReqs||{}),...Object.fromEntries(Object.entries(o.editedReqs||{}).map(([k,v])=>[k,{...(o.staffReqs?.[k]||{}),qty:v.qty}]))},confirmedStaff:o.confirmedStaff||[]}))}
                                style={{padding:"5px 14px",borderRadius:7,background:C.green,color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>✓ Accept Revised</button>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Rejected"}))}
                                style={{padding:"5px 12px",borderRadius:7,background:C.redBg,color:C.red,border:`1px solid ${C.redBorder}`,fontSize:11,cursor:"pointer"}}>✕ Reject</button>
                            </div>
                          </div>
                        )}
                        {order.status==="Confirmed"&&(order.confirmedStaff||[]).length>0&&(
                          <div style={{marginTop:10,borderTop:`1px solid ${C.borderLight}`,paddingTop:10}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>Staff sent by vendor</div>
                            {order.confirmedStaff.map((staff,si)=>(
                              <div key={si} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                  <Avatar name={staff.name} size={26} index={si+5}/>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:500,color:C.text}}>{staff.name}</div>
                                    <STag name={staff.section||"—"}/>
                                  </div>
                                </div>
                                {staff.checkIn
                                  ? <Chip label={"✓ "+staff.checkIn} color={C.green} bg={C.greenBg} size={10}/>
                                  : <input type="time" onChange={e=>{if(e.target.value){setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.map((st,i)=>i!==si?st:{...st,checkIn:e.target.value})}));}}} style={{padding:"4px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}/>
                                }
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VENDOR PORTAL */}
          {vendorSubTab==="portal" && (
            <div>
              <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:11,color:C.amber,lineHeight:1.6}}>
                ℹ <strong>{T2("Vendor Portal")}</strong> — this is the view vendors use to accept/reject/edit booking orders placed by kitchen management.
              </div>
              {vendorOrders.length===0 ? (
                <div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,fontSize:13,color:C.muted}}>No orders from kitchen yet.</div>
              ) : (
                <div>
                  {Object.entries(vendorOrders.reduce((acc,o)=>{
                    if(!acc[o.vendorId]) acc[o.vendorId]={name:o.vendorName,orders:[]};
                    acc[o.vendorId].orders.push(o);
                    return acc;
                  },{})).map(([vid,grp])=>(
                    <div key={vid} style={{marginBottom:20}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"12px 16px",background:C.wineBg,borderRadius:10,border:`1px solid ${C.wineBorder}`}}>
                        <div style={{width:36,height:36,borderRadius:9,background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff"}}>🏢</div>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:C.gold}}>{grp.name}</div>
                          <div style={{fontSize:11,color:C.gold,opacity:.7}}>{grp.orders.length} order{grp.orders.length!==1?"s":""} · {grp.orders.filter(o=>o.status==="Pending").length} pending</div>
                        </div>
                      </div>
                      {grp.orders.map(order=>{
                        const totalReq=Object.values(order.staffReqs||{}).reduce((a,r)=>a+(r.qty||0),0);
                        const scol=order.status==="Confirmed"?C.green:order.status==="Rejected"?C.red:order.status==="Edited"?C.amber:C.muted;
                        const sbg =order.status==="Confirmed"?C.greenBg:order.status==="Rejected"?C.redBg:order.status==="Edited"?C.amberBg:C.bg;
                        return (
                          <Card key={order.id} style={{marginBottom:10,marginLeft:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                              <div>
                                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{order.date} · {order.time}{order.endTime?" – "+order.endTime:""}</div>
                                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{order.venue||"Venue TBD"}{order.pax?" · "+order.pax+" pax":""}{order.eventName?" · "+order.eventName:""}</div>
                                <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}>
                                  {Object.entries(order.staffReqs||{}).filter(([,r])=>r.qty>0).map(([sec,r])=>{
                                    const m=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                                    return <div key={sec} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:20,background:m.color+"15",border:"1px solid "+m.color+"30"}}><span style={{fontSize:10}}>{m.icon}</span><span style={{fontSize:10,fontWeight:600,color:m.color}}>{r.qty}× {sec}</span></div>;
                                  })}
                                  <span style={{fontSize:11,color:C.muted,padding:"6px 12px",background:C.bg,borderRadius:20,border:`1px solid ${C.border}`}}>{totalReq} total</span>
                                </div>
                                {order.notes&&<div style={{fontSize:11,color:C.muted,marginTop:5}}>📝 {order.notes}</div>}
                              </div>
                              <span style={{fontSize:12,fontWeight:700,padding:"4px 11px",borderRadius:20,background:sbg,color:scol}}>{order.status}</span>
                            </div>
                            <textarea value={order.vendorNote||""} onChange={e=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,vendorNote:e.target.value}))} placeholder="Add note for kitchen (e.g. sending 2 instead of 3 for Tandoor, different timing)…" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,resize:"none",height:50,fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}/>
                            {order.status==="Confirmed" && (
                              <div style={{marginBottom:10}}>
                                <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:6}}>Staff being sent</div>
                                {(order.confirmedStaff||[]).map((st,si)=>(
                                  <div key={si} style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                                    <input value={st.name||""} onChange={e=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.map((s2,i)=>i!==si?s2:{...s2,name:e.target.value})}))} placeholder="Chef name" style={{flex:1,padding:"5px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg}}/>
                                    <select value={st.section||""} onChange={e=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.map((s2,i)=>i!==si?s2:{...s2,section:e.target.value})}))} style={{padding:"5px 8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg}}>
                                      <option value="">Section</option>
                                      {KITCHEN_SECTIONS.map(s=><option key={s}>{s}</option>)}
                                    </select>
                                    <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:o.confirmedStaff.filter((_,i)=>i!==si)}))} style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:8,color:C.red,fontSize:11,padding:"4px 7px",cursor:"pointer"}}>×</button>
                                  </div>
                                ))}
                                <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,confirmedStaff:[...(o.confirmedStaff||[]),{name:"",section:""}]}))} style={{padding:"5px 12px",borderRadius:8,background:"none",border:`1px dashed ${C.border}`,fontSize:11,color:C.muted,cursor:"pointer"}}>+ Add staff member</button>
                              </div>
                            )}
                            {/* Vendor edits section - qty editing + reason */}
                            {editingOrderId===order.id && (
                              <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                                <div style={{fontSize:12,fontWeight:600,color:C.amber,marginBottom:10}}>✏ Edit Staff Requirements — send revised proposal to kitchen</div>
                                <div style={{border:`1px solid ${C.amberBorder}`,borderRadius:8,overflow:"hidden",marginBottom:8}}>
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 110px",background:"rgba(192,112,16,.1)",padding:"6px 12px",borderBottom:`1px solid ${C.amberBorder}`}}>
                                    <span style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase"}}>Section</span>
                                    <span style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:"uppercase",textAlign:"center"}}>Vendor Can Send</span>
                                  </div>
                                  {KITCHEN_SECTIONS.map(sec=>{
                                    const orig = order.staffReqs?.[sec]?.qty||0;
                                    const edited = (order.editedReqs?.[sec]?.qty !== undefined) ? order.editedReqs[sec].qty : orig;
                                    const m = SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                                    if(orig===0 && edited===0) return null;
                                    return (
                                      <div key={sec} style={{display:"grid",gridTemplateColumns:"1fr 110px",padding:"8px 12px",borderBottom:`1px solid ${C.amberBorder}`,alignItems:"center"}}>
                                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                                          <span style={{fontSize:13}}>{m.icon}</span>
                                          <div>
                                            <div style={{fontSize:12,color:C.text}}>{sec}</div>
                                            <div style={{fontSize:12,color:C.muted}}>Kitchen asked: {orig}</div>
                                          </div>
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                                          <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,editedReqs:{...(o.editedReqs||{}),[sec]:{qty:Math.max(0,(o.editedReqs?.[sec]?.qty!==undefined?o.editedReqs[sec].qty:orig)-1)}}}))}                                            style={{width:26,height:26,borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:14,cursor:"pointer",fontWeight:700}}>−</button>
                                          <span style={{fontSize:14,fontWeight:700,color:edited!==orig?C.amber:C.text,minWidth:20,textAlign:"center"}}>{edited}</span>
                                          <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,editedReqs:{...(o.editedReqs||{}),[sec]:{qty:(o.editedReqs?.[sec]?.qty!==undefined?o.editedReqs[sec].qty:orig)+1}}}))}
                                            style={{width:26,height:26,borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:14,cursor:"pointer",fontWeight:700}}>+</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                                  <button onClick={()=>setEditingOrderId(null)} style={{padding:"7px 14px",borderRadius:8,fontSize:11,cursor:"pointer",background:"transparent",border:`1px solid ${C.border}`,color:C.muted}}>Cancel</button>
                                  <button onClick={()=>{
                                    setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Edited",editedReqs:o.editedReqs||{}}));
                                    setEditingOrderId(null);
                                  }} style={{padding:"7px 16px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",background:C.amber,color:"#fff",border:"none"}}>
                                    📤 Send Revised Proposal
                                  </button>
                                </div>
                              </div>
                            )}
                            <div style={{display:"flex",gap:8}}>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Confirmed",confirmedStaff:o.confirmedStaff&&o.confirmedStaff.length?o.confirmedStaff:[]}))} style={{flex:1,padding:"8px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:order.status==="Confirmed"?C.green:C.greenBg,color:order.status==="Confirmed"?"#fff":C.green}}>✓ {order.status==="Confirmed"?"Confirmed":"Accept"}</button>
                              <button onClick={()=>setEditingOrderId(editingOrderId===order.id?null:order.id)} style={{flex:1,padding:"8px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:editingOrderId===order.id||order.status==="Edited"?C.amber:C.amberBg,color:editingOrderId===order.id||order.status==="Edited"?"#fff":C.amber}}>✏ {editingOrderId===order.id?"Close Edit":order.status==="Edited"?"Edited ✓":"Propose Edit"}</button>
                              <button onClick={()=>setVendorOrders(p=>p.map(o=>o.id!==order.id?o:{...o,status:"Rejected"}))} style={{flex:1,padding:"8px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:order.status==="Rejected"?C.red:C.redBg,color:order.status==="Rejected"?"#fff":C.red}}>✕ {order.status==="Rejected"?"Rejected":"Reject"}</button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TEAM DIRECTORY ── */}
      {tab==="directory" && (
        <div style={{position:"relative"}}>
          {deleteConfirm && (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{background:C.surface,borderRadius:16,padding:"28px 32px",maxWidth:380,width:"90%",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:12}}>🗑</div>
                <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>Remove {deleteConfirm.name}?</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:20}}>This will permanently remove the employee record.</div>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  <Btn onClick={deleteEmployee} color={C.red} style={{fontSize:12,padding:"8px 20px"}}>Yes, Remove</Btn>
                  <Btn onClick={()=>setDeleteConfirm(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12,padding:"8px 16px"}}>Cancel</Btn>
                </div>
              </div>
            </div>
          )}

          {/* Search + filter + add + PIN toggle */}
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
            <input value={dirSearch} onChange={e=>setDirSearch(e.target.value)} placeholder={T2("Search name or ID…")} style={{flex:1,minWidth:160,padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
            <button onClick={()=>setShowPins(!showPins)} style={{padding:"7px 12px",borderRadius:8,background:showPins?C.gold:C.surface,color:showPins?"#0A0A0F":C.muted,border:`1px solid ${showPins?C.gold:C.border}`,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>🔐 {showPins?T2("Hide PINs"):T2("Show PINs")}</button>
            <select value={dirFilter} onChange={e=>setDirFilter(e.target.value)} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}>
              <option value="All">{T2("All Sections")}</option>
              {ALL_DEPARTMENTS.map(s=><option key={s}>{s}</option>)}
              <option value="admin">Admin</option>
              <option value="headchef">{T2("Head Chefs")}</option>
            </select>
            <Btn onClick={()=>{ if(showAddEmp){setShowAddEmp(false);} else {openAddForm();} }} color={showAddEmp?"transparent":C.wine} textColor={showAddEmp?C.muted:"#fff"} border={showAddEmp?`1px solid ${C.border}`:"none"} style={{fontSize:12,padding:"7px 14px"}}>{showAddEmp?"× Cancel":"+ Add Employee"}</Btn>
                {(()=>{
                  var needBackfill = safeArr(empDb).filter(function(e){ return e.is_active!==false && e.name && (!e.name_hi || e.name_hi===''); }).length;
                  if (needBackfill === 0) return null;
                  return <Btn onClick={backfillHindiNames} color="transparent" textColor={C.gold} border={`1px solid ${C.gold}`} style={{fontSize:11,padding:"7px 12px",marginLeft:8,opacity:hiBackfillState==='running'?0.5:1,pointerEvents:hiBackfillState==='running'?"none":"auto"}}>{hiBackfillState==='running'?"Working…":`🌐 Backfill Hindi (${needBackfill})`}</Btn>;
                })()}
          </div>

          {showAddEmp && (
            <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:12,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:C.gold,marginBottom:10}}>{T2("New Employee")}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
                {[
                  {l:"Full Name",k:"name",ph:"Full name"},
                  {l:"Name (Hindi)",k:"name_hi",ph:"नाम",hint:"auto"},
                  {l:"Section",k:"section",type:"sel",opts:(deptSections&&deptSections.length>0)?deptSections:ALL_DEPARTMENTS,placeholder:"— Pick section —"},
                  {l:"Section (Hindi)",k:"section_hi",ph:"विभाग",hint:"auto"},
                  {l:"Role",k:"role",type:"sel",opts:["staff","headchef","admin"]},
                  {l:"PIN (4 digits)",k:"pin",max:4,ph:"0000"},
                  {l:"Joining Date",k:"joining",dt:"date"}
                ].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{f.l}{f.hint && <span style={{color:C.gold,marginLeft:4,fontSize:9}}>· {f.hint}</span>}</div>
                    {f.type==="sel"
                      ? <select value={newEmpForm[f.k]||""} onChange={e=>setNewEmpForm(p=>{var v=e.target.value;var next={...p,[f.k]:v};if(f.k==="section")next.section_hi=sectionHiMap[v]||v||"";return next;})} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                          {f.placeholder && <option value="">{f.placeholder}</option>}
                          {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      : <input type={f.dt||"text"} value={newEmpForm[f.k]||""} onChange={e=>setNewEmpForm(p=>{var v=e.target.value;var next={...p,[f.k]:v};if(f.k==="name")next.name_hi=transliterateName(v);return next;})} placeholder={f.ph} maxLength={f.max} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    }
                  </div>
                ))}
              </div>
              {newEmpForm.section && (
                <div style={{fontSize:10,color:C.faint,marginBottom:8}}>→ Will be assigned to Dept: <b style={{color:C.muted}}>{((TEAM_DEPTS||[]).find(d=>d.id===SECTION_TO_DEPT[newEmpForm.section])||{}).label||SECTION_TO_DEPT[newEmpForm.section]||"—"}</b></div>
              )}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"10px 12px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}>
                {addPhotoPreview
                  ? <img src={addPhotoPreview} style={{width:56,height:56,borderRadius:"50%",objectFit:"cover",border:`1px solid ${C.border}`}}/>
                  : <div style={{width:56,height:56,borderRadius:"50%",background:C.bg,border:`1px dashed ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:C.muted}}>📷</div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:3}}>Profile Photo <span style={{color:C.gold}}>· for Gate Kiosk face match</span></div>
                  <label style={{display:"inline-block",padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,fontSize:11,cursor:"pointer",color:C.text}}>
                    {addPhotoPreview?"Change photo":"Add photo"}
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){
                      var f = e.target.files && e.target.files[0];
                      if(!f) return;
                      setAddPhotoFile(f);
                      var r = new FileReader();
                      r.onload = function(ev){ setAddPhotoPreview(ev.target.result); };
                      r.readAsDataURL(f);
                    }}/>
                  </label>
                  {addPhotoPreview && <button onClick={()=>{setAddPhotoFile(null);setAddPhotoPreview(null);}} style={{marginLeft:6,padding:"6px 10px",borderRadius:8,background:"transparent",border:`1px solid ${C.border}`,fontSize:11,cursor:"pointer",color:C.muted}}>Remove</button>}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={addEmployee} color={C.wine} style={{fontSize:11,padding:"6px 16px",opacity:photoUploading?0.6:1,pointerEvents:photoUploading?"none":"auto"}}>{photoUploading?"Uploading…":T2("Add Employee")}</Btn>
                <Btn onClick={()=>{setShowAddEmp(false);setAddPhotoFile(null);setAddPhotoPreview(null);}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"6px 14px"}}>Cancel</Btn>
              </div>
            </div>
          )}

          {/* Employee cards */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {dirFiltered.map((emp,i)=>{
              const eid = emp.staff_id||emp.staffListId||emp.id;
              const sid = selEmp && (selEmp.staff_id||selEmp.staffListId||selEmp.id);
              const isEdit = !!sid && sid===eid;
              return (
                <div key={eid||i} style={{background:C.surface,border:`1px solid ${isEdit?C.wine:C.border}`,borderRadius:10,padding:"11px 13px",opacity:emp.active?1:.65}}>
                  {isEdit&&editEmpForm ? (
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>Edit — {emp.name}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:8}}>
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Name</div>
                          <input type="text" value={editEmpForm.name||""} onChange={e=>setEditEmpForm(p=>({...p,name:e.target.value,name_hi:transliterateName(e.target.value)}))} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Name (Hindi) <span style={{color:C.gold,fontSize:9}}>· auto</span></div>
                          <input type="text" value={editEmpForm.name_hi||""} onChange={e=>setEditEmpForm(p=>({...p,name_hi:e.target.value}))} placeholder="नाम" style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>PIN</div>
                          <input type="text" value={editEmpForm.pin||""} onChange={e=>setEditEmpForm(p=>({...p,pin:e.target.value}))} maxLength={4} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Joining</div>
                          <input type="date" value={editEmpForm.joining||""} onChange={e=>setEditEmpForm(p=>({...p,joining:e.target.value}))} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Section</div>
                          <select value={editEmpForm.section||""} onChange={e=>setEditEmpForm(p=>{var v=e.target.value;return{...p,section:v,section_hi:sectionHiMap[v]||v||""};})} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                            {ALL_DEPARTMENTS.map(s=><option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Section (Hindi) <span style={{color:C.gold,fontSize:9}}>· auto</span></div>
                          <input type="text" value={editEmpForm.section_hi||""} onChange={e=>setEditEmpForm(p=>({...p,section_hi:e.target.value}))} placeholder="विभाग" style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Role</div>
                          <select value={editEmpForm.role} onChange={e=>setEditEmpForm(p=>({...p,role:e.target.value}))} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                            {[{v:"staff",l:"Staff"},{v:"headchef",l:"HC"},{v:"admin",l:"Admin"}].map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{marginTop:8,marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                        {editPhotoPreview
                          ? <img src={editPhotoPreview} style={{width:48,height:48,borderRadius:"50%",objectFit:"cover",border:`1px solid ${C.border}`}}/>
                          : <div style={{width:48,height:48,borderRadius:"50%",background:C.bg,border:`1px dashed ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:C.muted}}>📷</div>}
                        <label style={{padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,fontSize:11,cursor:"pointer",color:C.text}}>
                          {editPhotoPreview?"Change photo":"Add photo"}
                          <input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){
                            var f = e.target.files && e.target.files[0];
                            if(!f) return;
                            setEditPhotoFile(f);
                            var r = new FileReader();
                            r.onload = function(ev){ setEditPhotoPreview(ev.target.result); };
                            r.readAsDataURL(f);
                          }}/>
                        </label>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <Btn onClick={saveEmpEdit} color={C.wine} style={{fontSize:11,padding:"5px 12px",opacity:photoUploading?0.6:1,pointerEvents:photoUploading?"none":"auto"}}>{photoUploading?"Uploading…":"Save"}</Btn>
                        <Btn onClick={()=>{setSelEmp(null);setEditEmpForm(null);setEditPhotoFile(null);setEditPhotoPreview(null);}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"5px 10px"}}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{display:"flex",gap:9,alignItems:"center"}}>
                          {emp.photo_url
                            ? <img src={emp.photo_url} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",border:`1px solid ${C.border}`}}/>
                            : <Avatar name={emp.name} size={34} index={i}/>}
                          <div>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{emp.name}</div>
                            <div style={{fontSize:10,color:C.gold,fontWeight:600}}>{emp.id}</div>
                            <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                              <STag name={emp.section}/>
                              <Chip label={emp.role==="admin"?"Admin":emp.role==="headchef"?"HC":"Staff"} color={emp.role!=="staff"?C.wine:C.muted} bg={emp.role!=="staff"?C.wineBg:"#F2F1EE"} size={9}/>
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button onClick={()=>{setSelEmp(emp);setEditEmpForm({name:emp.name,name_hi:emp.name_hi||transliterateName(emp.name||""),pin:emp.pin,joining:emp.joining,role:emp.role,section:emp.section,section_hi:emp.section_hi||sectionHiMap[emp.section]||""});setEditPhotoFile(null);setEditPhotoPreview(emp.photo_url||null);}} style={{padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,fontSize:10,cursor:"pointer",color:C.text}}>Edit</button>
                          <button onClick={()=>{var eid=emp.id||emp.staff_id||emp.staffListId;var toggled=!emp.active;setEmpDb(p=>p.map(e=>(e.id||e.staff_id||e.staffListId)!==eid?e:{...e,active:toggled,is_active:toggled}));if(syncToServer)syncToServer('upsert',{...emp,active:toggled,is_active:toggled});}} style={{padding:"6px 12px",borderRadius:8,fontSize:10,cursor:"pointer",border:"none",background:emp.active?C.greenBg:C.redBg,color:emp.active?C.green:C.red}}>{emp.active?T2("Active"):T2("Off")}</button>
                          <button onClick={()=>setDeleteConfirm(emp)} style={{padding:"6px 10px",borderRadius:8,fontSize:10,cursor:"pointer",border:`1px solid ${C.redBorder}`,background:C.redBg,color:C.red}}>🗑</button>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:8}}>
                        <div style={{background:C.bg,borderRadius:8,padding:"4px 7px"}}><div style={{fontSize:12,color:C.muted}}>JOINED</div><div style={{fontSize:10,fontWeight:500,color:C.text}}>{emp.joining}</div></div>
                        <div style={{background:C.bg,borderRadius:8,padding:"4px 7px"}}><div style={{fontSize:12,color:C.muted}}>SERVICE</div><div style={{fontSize:10,fontWeight:500,color:C.text}}>{yrsOfService(emp.joining)}</div></div>
                        <div style={{background:showPins?(emp.pin==="0000"?C.amberBg:C.greenBg):C.bg,borderRadius:8,padding:"4px 7px"}}><div style={{fontSize:10,color:showPins?(emp.pin==="0000"?C.amber:C.green):C.muted}}>{T2("PIN")}</div><div style={{fontSize:12,fontWeight:700,color:showPins?(emp.pin==="0000"?C.amber:C.green):C.muted}}>{showPins?(emp.pin==="0000"?"⚠ 0000":emp.pin):"••••"}</div></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



// ─── CALENDAR MODULE ──────────────────────────────────────────────


export { TeamHub };
