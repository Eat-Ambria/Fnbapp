// Ambria FnB — Team & Attendance Hub
import React, { useState, useRef, useEffect } from "react";
import { supabase } from '../lib/supabase.js';
import { C, ALL_DEPARTMENTS, SECTION_META, OUTSIDE_VENDORS, resolveSection } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, CUR_YEAR, safeArr, safePct } from '../utils/helpers.js';
import { STAFF_LIST, yrsOfService } from '../data/staffData.js';
import { Avatar, Card, Btn, Chip, STag, DonutChart } from './SharedUI.jsx';
import { dbUpsert } from '../lib/db.js';
import { hasPermission } from '../data/permissions.js';
import { RECIPE_DB } from '../data/recipeData.js';

function TeamHub({attendance,setAttendance,leaves,setLeaves,empDb,setEmpDb,events,lang="en",activeDept,currentUser=null,syncToServer=null}) {
  const [tab,setTab]             = useState("attendance");
  const T2 = s => T(s, lang);

  // Department-to-section mapping for filtering
  const KITCHEN_SECTIONS = (RECIPE_DB.cats||[]).filter(c=>c.id!=='beverages').map(c=>c.name);
  const DEPT_SECTIONS_MAP = {kitchen:KITCHEN_SECTIONS,service:["Service"],crockery:["Crockery"],beverages:["Beverages"],transport:["Transportation"],odc:["ODC"]};
  const deptSections = activeDept && DEPT_SECTIONS_MAP[activeDept] ? DEPT_SECTIONS_MAP[activeDept] : null;

  const [secFilter,setSecFilter] = useState("All");
  const [leaveTab,setLeaveTab]   = useState("pending");
  const [leaveForm,setLeaveForm] = useState({staffId:"",from:"",to:"",reason:""});
  const [rejectId,setRejectId]   = useState(null);
  const [rejectReason,setRejectReason] = useState("");
  const [vendorOrders,setVendorOrders] = useState([]);
  const [vendorSubTab,setVendorSubTab] = useState("book");
  const [bookingForm,setBookingForm]   = useState({vendorId:"",vendorName:"",eventId:"",eventName:"",venue:"",date:"",time:"",endTime:"",pax:"",staffReqs:{},notes:""});
  const [editingOrderId,setEditingOrderId] = useState(null); // which order is vendor editing
  const [showAddStaff,setShowAddStaff] = useState(false);
  const [newStaffForm,setNewStaffForm] = useState({name:"",section:"Beverages",role:"staff"});
  const [dirSearch,setDirSearch] = useState("");
  const [dirFilter,setDirFilter] = useState("All");
  const [histDate,setHistDate]   = useState("");
  const [histData,setHistData]   = useState(null);
  const [histLoading,setHistLoading] = useState(false);
  function fetchHistory(date){
    if(!date||!supabase){setHistData(null);return;}
    setHistLoading(true);
    supabase.from('attendance').select('*').eq('date',date).order('in_time',{ascending:true})
      .then(function(res){setHistData(res.data||[]);setHistLoading(false);})
      .catch(function(){setHistData([]);setHistLoading(false);});
  }
  const [showAddEmp,setShowAddEmp] = useState(false);
  const [showPins,setShowPins] = useState(false);
  const [selEmp,setSelEmp]       = useState(null);
  const [editEmpForm,setEditEmpForm] = useState(null);
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [newEmpForm,setNewEmpForm] = useState({name:"",section:"",dept:"F&B Kitchen",role:"staff",pin:"0000",joining:TODAY,active:true});

  // Computed — filtered by active department
  const _resolvedStaff = STAFF_LIST.map(function(s){ return Object.assign({},s,{section:resolveSection(s.section)}); });
  const deptStaffList = deptSections ? _resolvedStaff.filter(s=>deptSections.includes(s.section)) : _resolvedStaff;
  // Merge empDb + STAFF_LIST so directory shows all staff the kiosk sees
  const allEmpDb = (function(){
    var db = safeArr(empDb);
    var dbNames = new Set(db.map(function(s){ return (s.name||'').toLowerCase(); }));
    var fromList = STAFF_LIST.filter(function(s){
      return !dbNames.has((s.name||'').toLowerCase());
    }).map(function(s){
      return {id:String(s.id),staff_id:String(s.id),staffListId:String(s.id),name:s.name,section:resolveSection(s.section),dept:resolveSection(s.section),role:s.role||'staff',is_active:true,pin:'0000',joining:'',source:'stafflist'};
    });
    return db.concat(fromList);
  })();
  const deptEmpDb = deptSections ? allEmpDb.filter(e=>deptSections.includes(resolveSection(e.section))) : allEmpDb;
  const deptStaffIds = new Set(deptStaffList.map(s=>String(s.id)));
  const todayRecs  = (attendance||[]).filter(a=>a.date===TODAY && (!deptSections || deptStaffIds.has(String(a.staffId))));
  const deptLeaves = deptSections ? safeArr(leaves).filter(l=>deptSections.includes(resolveSection(l.staffSection))) : safeArr(leaves);
  const pending    = deptLeaves.filter(l=>l.status==="Pending");
  const approved   = deptLeaves.filter(l=>l.status==="Approved");
  const rejected   = deptLeaves.filter(l=>l.status==="Rejected");
  const allSecs    = deptSections ? ["All",...deptSections] : ["All",...ALL_DEPARTMENTS];
  const filtered   = secFilter==="All" ? deptStaffList : deptStaffList.filter(s=>s.section===secFilter);
  const present    = todayRecs.filter(a=>a.status==="Present").length;
  const dirFiltered = deptEmpDb.filter(e=>{
    const ms = dirFilter==="All"||e.section===dirFilter||e.role===dirFilter;
    const mt = !dirSearch.trim()||e.name.toLowerCase().includes(dirSearch.toLowerCase())||e.id.toLowerCase().includes(dirSearch.toLowerCase());
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

  // Leave helpers
  function addLeave(){
    if(!leaveForm.staffId||!leaveForm.from||!leaveForm.to) return;
    const s = deptStaffList.find(x=>x.id===+leaveForm.staffId);
    if(!s) return;
    setLeaves(p=>[...p,{id:Date.now(),staffId:s.id,staffName:s.name,staffSection:s.section,from:leaveForm.from,to:leaveForm.to,reason:leaveForm.reason,status:"Pending"}]);
    setLeaveForm({staffId:"",from:"",to:"",reason:""});
  }
  function approveLeave(id){setLeaves(p=>p.map(l=>l.id!==id?l:{...l,status:"Approved"}));}
  function rejectLeave(id,reason){setLeaves(p=>p.map(l=>l.id!==id?l:{...l,status:"Rejected",rejectReason:reason}));setRejectId(null);setRejectReason("");}

  // Employee helpers
  function addEmployee(){
    if(!newEmpForm.name.trim()) return;
    const newId="STF-"+Date.now();
    const record = {...newEmpForm,id:newId,staff_id:newId,staffListId:newId,is_active:true,active:true};
    setEmpDb(p=>[...p,record]);
    if(syncToServer) syncToServer('upsert',record);
    setNewEmpForm({name:"",section:"",dept:"F&B Kitchen",role:"staff",pin:"0000",joining:TODAY,active:true});
    setShowAddEmp(false);
  }
  function saveEmpEdit(){
    if(!editEmpForm||!selEmp) return;
    const updated = {...selEmp,...editEmpForm};
    setEmpDb(p=>p.map(e=>{
      var eid = e.id||e.staff_id||e.staffListId;
      var sid = selEmp.id||selEmp.staff_id||selEmp.staffListId;
      return eid===sid?{...e,...editEmpForm}:e;
    }));
    if(syncToServer) syncToServer('upsert',updated);
    setSelEmp(null);setEditEmpForm(null);
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
    {id:"leaves",     l:"🌿 Leaves"},
    {id:"chefs",      l:"🤝 Outside Staff & Vendors"},
    {id:"directory",  l:"🪪 Team"},
  ];

  return (
    <div>

      {/* ── STAFF TODAY SUMMARY ── */}
      <Card style={{marginBottom:14,padding:"14px 18px"}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>👥 Staff today — {TODAY_LABEL}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 13px"}}>
            <div style={{fontSize:22,fontWeight:700,color:C.green}}>{present}</div>
            <div style={{fontSize:12,color:C.green,fontWeight:600}}>{T2("Present")}</div>
          </div>
          <div style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 13px"}}>
            <div style={{fontSize:22,fontWeight:700,color:C.red}}>{deptStaffList.length-present}</div>
            <div style={{fontSize:12,color:C.red,fontWeight:600}}>{T2("Absent")}</div>
            {deptStaffList.length-present===0&&<div style={{fontSize:12,color:C.green,marginTop:2}}>All present ✓</div>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"10px 13px"}}>
            <div style={{fontSize:22,fontWeight:700,color:C.amber}}>{deptLeaves.filter(l=>l.status==="Approved"&&l.from<=TODAY&&l.to>=TODAY).length}</div>
            <div style={{fontSize:12,color:C.amber,fontWeight:600}}>{T2("On Leave")}</div>
            {deptLeaves.filter(l=>l.status==="Approved"&&l.from<=TODAY&&l.to>=TODAY).map((l,i)=><div key={i} style={{fontSize:12,color:C.amber,marginTop:1}}>• {l.staffName}</div>)}
          </div>
          <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:10,padding:"10px 13px"}}>
            <div style={{fontSize:22,fontWeight:700,color:C.gold}}>{pending.length}</div>
            <div style={{fontSize:10,color:C.gold,fontWeight:600}}>{T2("Pending leave")}</div>
            {pending.map((l,i)=><div key={i} style={{fontSize:10,color:C.gold,marginTop:1}}>• {l.staffName}</div>)}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${(deptSections||ALL_DEPARTMENTS.filter(d=>d!=="Management")).length>5?5:Math.max((deptSections||[]).length,3)},1fr)`,gap:10}}>
          {(deptSections||ALL_DEPARTMENTS.filter(d=>d!=="Management")).map(s=>{
            const m=SECTION_META[s]||{color:C.muted,icon:"🍽"};
            const total=deptStaffList.filter(x=>x.section===s).length;
            const pres2=todayRecs.filter(a=>a.status==="Present"&&deptStaffList.find(x=>String(x.id)===String(a.staffId))?.section===s).length;
            const pct=safePct(pres2,total);
            return (
              <div key={s} style={{textAlign:"center",background:C.bg,borderRadius:9,padding:"8px 4px"}}>
                <DonutChart pct={pct} color={m.color} icon={m.icon} size={48}/>
                <div style={{fontSize:10,fontWeight:600,color:C.text,marginTop:4}}>{T2(s).split(" ")[0]}</div>
                <div style={{fontSize:12,color:C.muted}}>{pres2}/{total}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>👥 Team</div>
          <div style={{fontSize:13,color:C.muted,marginTop:3}}>{TODAY_LABEL} · {present}/{deptStaffList.length} present</div>
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
      {tab==="attendance" && (
        <div>
          {/* Section filter */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
            {allSecs.map(s=>(
              <button key={s} onClick={()=>setSecFilter(s)} style={{padding:"4px 11px",borderRadius:20,fontSize:11,cursor:"pointer",background:secFilter===s?C.wine:"transparent",color:secFilter===s?"#fff":C.muted,border:`1px solid ${secFilter===s?C.wine:C.border}`}}>{s}</button>
            ))}
          </div>

          {/* Present staff only */}
          {(()=>{
            const presentStaff = filtered.filter(s=>todayRecs.some(r=>r.staffId===String(s.id)&&r.status==="Present"));
            return presentStaff.length>0?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {presentStaff.map((s,i)=>{
                  const rec = todayRecs.find(r=>r.staffId===String(s.id)&&r.status==="Present");
                  const m = SECTION_META[s.section]||{color:C.muted};
                  return (
                    <div key={s.id} style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"11px 12px"}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                        {rec?.photo
                          ? <img src={rec.photo} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.green}`}}/>
                          : <Avatar name={s.name} size={32} index={i}/>
                        }
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                          <div style={{fontSize:11,color:m.color,fontWeight:500}}>{T2(s.section)}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:10,fontWeight:600,padding:"5px 10px",borderRadius:10,background:C.green,color:"#0A0A0F"}}>
                          ✓ {rec?.time}
                        </span>
                        {rec?.pinVerified&&<span style={{fontSize:12,color:C.green}}>🔐</span>}
                        {rec?.photo&&<span style={{fontSize:12,color:C.green}}>📸</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ):(
              <div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>
                {T2("No staff checked in yet. Attendance is marked at Property Gate Kiosk.")}
              </div>
            );
          })()}

          {/* ── TODAY'S ATTENDANCE DASHBOARD (admin / head_chef) ── */}
          {(currentUser?.role==='admin'||currentUser?.role==='head_chef') && (()=>{
            var todayAtt = safeArr(attendance)
              .filter(function(a){return a.date===TODAY;})
              .sort(function(a,b){return (a.in_time||'').localeCompare(b.in_time||'');});
            var staffAtt  = todayAtt.filter(function(a){return !a.is_vendor && a.dept!=='vendor';});
            var vendorAtt = todayAtt.filter(function(a){return a.is_vendor || a.dept==='vendor';});
            var currentlyIn = staffAtt.filter(function(a){return a.in_time&&!a.out_time;}).length;
            var punchedOut  = staffAtt.filter(function(a){return a.in_time&&a.out_time;}).length;
            var totalActive = safeArr(empDb).filter(function(s){
              return s.is_active!==false && s.role!=='kiosk_gate' && s.role!=='admin' && s.role!=='head_chef' && !s.role?.startsWith('section_');
            }).length;
            var notYetIn = Math.max(0, totalActive - staffAtt.length);
            if (todayAtt.length===0) return null;
            return (
              <div style={{marginTop:20}}>
                <div style={{fontSize:16,fontWeight:700,color:C.text,
                  fontFamily:'var(--font-display)',marginBottom:4}}>
                  📋 Today's Attendance
                </div>
                <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
                  {staffAtt.length} staff · {vendorAtt.length} vendor{vendorAtt.length!==1?'s':''} today
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
                  <div style={{background:C.greenBg,borderRadius:10,padding:'10px',textAlign:'center',border:`1px solid ${C.greenBorder}`}}>
                    <div style={{fontSize:20,fontWeight:700,color:C.green}}>{currentlyIn}</div>
                    <div style={{fontSize:10,color:C.green}}>Currently IN</div>
                  </div>
                  <div style={{background:C.redBg,borderRadius:10,padding:'10px',textAlign:'center',border:`1px solid ${C.redBorder}`}}>
                    <div style={{fontSize:20,fontWeight:700,color:C.red}}>{punchedOut}</div>
                    <div style={{fontSize:10,color:C.red}}>Punched OUT</div>
                  </div>
                  <div style={{background:C.surface,borderRadius:10,padding:'10px',textAlign:'center',border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:20,fontWeight:700,color:C.muted}}>{notYetIn}</div>
                    <div style={{fontSize:10,color:C.muted}}>Not yet IN</div>
                  </div>
                </div>
                {staffAtt.map(function(a,i){
                  return (
                    <div key={a.id||a.staff_id} style={{display:'flex',gap:12,alignItems:'center',
                      padding:'10px 14px',marginBottom:6,background:C.surface,
                      borderRadius:10,border:`1px solid ${C.border}`}}>
                      <div>
                        {(a.in_photo||a.out_photo||a.photo)
                          ? <img src={a.in_photo||a.out_photo||a.photo}
                              style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',border:`2px solid ${C.green}`}}/>
                          : <Avatar name={a.staff_name||'?'} size={36} index={i}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {a.staff_name||a.staff_id}
                        </div>
                        <div style={{fontSize:11,color:C.muted}}>
                          {a.section||''}{a.venue?' · '+a.venue:''}
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:12,color:C.green,fontWeight:700}}>
                          IN: {a.in_time||'—'}
                        </div>
                        {a.out_time
                          ? <><div style={{fontSize:12,color:C.red,fontWeight:700}}>OUT: {a.out_time}</div>
                            <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{fmtHours(calcHoursWorked(a.in_time,a.out_time))}</div></>
                          : <div style={{fontSize:11,color:C.amber}}>⏳ Still working</div>}
                      </div>
                    </div>
                  );
                })}
                {vendorAtt.length>0&&(
                  <div style={{marginTop:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.muted,
                      textTransform:'uppercase',letterSpacing:0.8,marginBottom:8}}>
                      🏢 Outside Vendors ({vendorAtt.length})
                    </div>
                    {vendorAtt.map(function(a,i){
                      var timeLabel = a.in_time ? 'IN: '+a.in_time : a.out_time ? 'OUT: '+a.out_time : '—';
                      var timeColor = a.in_time ? C.green : C.red;
                      return (
                        <div key={a.id||a.staff_id+i} style={{display:'flex',gap:12,alignItems:'flex-start',
                          padding:'10px 14px',marginBottom:6,background:C.purpleBg,
                          borderRadius:10,border:`1px solid ${C.purpleBorder}`}}>
                          <div style={{flexShrink:0}}>
                            {a.photo
                              ? <img src={a.photo} style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',border:`2px solid ${C.purple}`}}/>
                              : <div style={{width:36,height:36,borderRadius:'50%',background:C.purpleBg,
                                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🏢</div>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:C.text}}>
                              {a.staff_name||'Unknown'}
                            </div>
                            <div style={{fontSize:11,color:C.purple,fontWeight:600}}>
                              {a.vendor_company||''}
                              {a.vendor_purpose?' · '+a.vendor_purpose:''}
                            </div>
                            {(a.vendor_phone||a.vendor_vehicle)&&(
                              <div style={{fontSize:10,color:C.faint,marginTop:2}}>
                                {a.vendor_phone?'📞 '+a.vendor_phone:''}
                                {a.vendor_phone&&a.vendor_vehicle?' · ':''}
                                {a.vendor_vehicle?'🚗 '+a.vendor_vehicle:''}
                              </div>
                            )}
                            <div style={{fontSize:10,color:C.muted,marginTop:2}}>
                              {a.section||'General'}{a.venue?' · '+a.venue:''}
                            </div>
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontSize:12,color:timeColor,fontWeight:700}}>{timeLabel}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── ATTENDANCE HISTORY ── */}
          {(currentUser?.role==='admin'||currentUser?.role==='head_chef')&&(
            <div style={{marginTop:20}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:'var(--font-display)',marginBottom:8}}>📅 Attendance History</div>
              <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
                <input type="date" value={histDate} max={TODAY} onChange={function(e){setHistDate(e.target.value);fetchHistory(e.target.value);}}
                  style={{padding:'8px 12px',borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
                {histDate&&<button onClick={function(){setHistDate('');setHistData(null);}}
                  style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,color:C.muted,fontSize:11,cursor:'pointer'}}>Clear</button>}
              </div>
              {histLoading&&<div style={{padding:16,textAlign:'center',color:C.muted,fontSize:12}}>Loading…</div>}
              {histData&&!histLoading&&(
                histData.length===0
                  ?<div style={{padding:20,textAlign:'center',color:C.muted,fontSize:12,background:C.surface,borderRadius:10,border:`1px solid ${C.border}`}}>No attendance records for {histDate}</div>
                  :<div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{histData.filter(function(a){return !a.is_vendor&&a.dept!=='vendor';}).length} staff · {histData.filter(function(a){return a.is_vendor||a.dept==='vendor';}).length} vendors on {histDate}</div>
                    {histData.filter(function(a){return !a.is_vendor&&a.dept!=='vendor';}).map(function(a,i){
                      return(
                        <div key={a.id||i} style={{display:'flex',gap:12,alignItems:'center',padding:'10px 14px',marginBottom:4,background:C.surface,borderRadius:10,border:`1px solid ${C.border}`}}>
                          <Avatar name={a.staff_name||'?'} size={32} index={i}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:C.text}}>{a.staff_name||a.staff_id}</div>
                            <div style={{fontSize:11,color:C.muted}}>{a.section||''}{a.venue?' · '+a.venue:''}</div>
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontSize:12,color:C.green,fontWeight:700}}>IN: {a.in_time||'—'}</div>
                            {a.out_time?<div style={{fontSize:12,color:C.red,fontWeight:700}}>OUT: {a.out_time}</div>:<div style={{fontSize:11,color:C.amber}}>No OUT</div>}
                          </div>
                        </div>
                      );
                    })}
                    {histData.filter(function(a){return a.is_vendor||a.dept==='vendor';}).length>0&&(
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:'uppercase',marginBottom:6}}>🏢 Vendors ({histData.filter(function(a){return a.is_vendor||a.dept==='vendor';}).length})</div>
                        {histData.filter(function(a){return a.is_vendor||a.dept==='vendor';}).map(function(a,i){
                          return(
                            <div key={a.id||'v'+i} style={{display:'flex',gap:12,alignItems:'center',padding:'8px 14px',marginBottom:4,background:C.purpleBg,borderRadius:10,border:`1px solid ${C.purpleBorder}`}}>
                              <div style={{width:32,height:32,borderRadius:'50%',background:C.purpleBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🏢</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:600,color:C.text}}>{a.staff_name||'Unknown'}</div>
                                <div style={{fontSize:11,color:C.purple}}>{a.vendor_company||''}{a.vendor_purpose?' · '+a.vendor_purpose:''}</div>
                              </div>
                              <div style={{fontSize:12,color:a.in_time?C.green:C.red,fontWeight:700}}>{a.in_time?'IN: '+a.in_time:''}{a.out_time?' · OUT: '+a.out_time:''}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LEAVES ── */}
      {tab==="leaves" && (
        <div>
          {/* Apply leave form */}
          <Card style={{marginBottom:14,padding:"14px 16px"}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>{T2("Apply Leave")}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:3}}>Staff</div>
                <select value={leaveForm.staffId} onChange={e=>setLeaveForm(p=>({...p,staffId:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                  <option value="">Select staff…</option>
                  {deptStaffList.map(s=><option key={s.id} value={s.id}>{s.name} ({s.section})</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:3}}>From</div>
                <input type="date" value={leaveForm.from} onChange={e=>setLeaveForm(p=>({...p,from:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:3}}>To</div>
                <input type="date" value={leaveForm.to} onChange={e=>setLeaveForm(p=>({...p,to:e.target.value}))} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:3}}>Reason</div>
                <input value={leaveForm.reason} onChange={e=>setLeaveForm(p=>({...p,reason:e.target.value}))} placeholder={T2("Reason")} style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
              </div>
            </div>
            <Btn onClick={addLeave} color={C.wine} style={{fontSize:12,padding:"6px 16px"}}>{T2("Apply Leave")}</Btn>
          </Card>

          {/* Leave sub-tabs */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {[{v:"pending",l:"Pending",count:pending.length},{v:"approved",l:"Approved",count:approved.length},{v:"rejected",l:"Rejected",count:rejected.length}].map(t=>(
              <button key={t.v} onClick={()=>setLeaveTab(t.v)} style={{padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",background:leaveTab===t.v?C.wine:"transparent",color:leaveTab===t.v?"#fff":C.muted,border:`1.5px solid ${leaveTab===t.v?C.wine:C.border}`}}>
                {t.l} {t.count>0&&<span style={{fontSize:10,opacity:.8}}>({t.count})</span>}
              </button>
            ))}
          </div>

          {/* Leave list */}
          {(leaveTab==="pending"?pending:leaveTab==="approved"?approved:rejected).map((l,i)=>{
            const idx = deptStaffList.findIndex(s=>s.id===l.staffId||s.name===l.staffName);
            return (
              <div key={l.id} style={{padding:"10px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                <div style={{display:"flex",gap:9,alignItems:"flex-start"}}>
                  <Avatar name={l.staffName||"?"} size={32} index={idx>=0?idx:i}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>{l.staffName}</div>
                    <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                      <STag name={l.staffSection||"—"}/>
                      <Chip label={`${l.from} → ${l.to}`} color={C.muted} bg={C.bg} size={10}/>
                    </div>
                    {l.reason&&<div style={{fontSize:10,color:C.faint,marginTop:3}}>{l.reason}</div>}
                    {rejectId===l.id&&(
                      <div style={{marginTop:7,display:"flex",gap:6,alignItems:"center"}}>
                        <input value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Rejection reason…" style={{flex:1,padding:"5px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.bg}}/>
                        <Btn onClick={()=>rejectLeave(l.id,rejectReason)} color={C.red} style={{fontSize:11,padding:"5px 10px"}}>Confirm</Btn>
                        <Btn onClick={()=>{setRejectId(null);setRejectReason("");}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"5px 10px"}}>Cancel</Btn>
                      </div>
                    )}
                    {rejectId!==l.id&&(
                      <div style={{display:"flex",gap:5,flexShrink:0,marginTop:6}}>
                        {leaveTab==="pending"&&hasPermission(currentUser,"team.leave_approve")&&(
                          <>
                            <Btn onClick={()=>approveLeave(l.id)} color={C.green} style={{fontSize:10,padding:"6px 12px"}}>✓ Approve</Btn>
                            <Btn onClick={()=>setRejectId(l.id)} color={C.red} style={{fontSize:10,padding:"6px 12px"}}>✕ Reject</Btn>
                          </>
                        )}
                        {leaveTab==="rejected"&&l.rejectReason&&<div style={{fontSize:12,color:C.red}}>{l.rejectReason}</div>}
                      </div>
                    )}
                  </div>
                  <span style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:20,
                    background:l.status==="Approved"?C.greenBg:l.status==="Rejected"?C.redBg:C.amberBg,
                    color:l.status==="Approved"?C.green:l.status==="Rejected"?C.red:C.amber}}>
                    {l.status}
                  </span>
                </div>
              </div>
            );
          })}
          {(leaveTab==="pending"?pending:leaveTab==="approved"?approved:rejected).length===0&&(
            <div style={{textAlign:"center",padding:24,color:C.muted,fontSize:12}}>No {leaveTab} leaves.</div>
          )}
        </div>
      )}

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
            <Btn onClick={()=>setShowAddEmp(s=>!s)} color={showAddEmp?"transparent":C.wine} textColor={showAddEmp?C.muted:"#fff"} border={showAddEmp?`1px solid ${C.border}`:"none"} style={{fontSize:12,padding:"7px 14px"}}>{showAddEmp?"× Cancel":"+ Add Employee"}</Btn>
          </div>

          {showAddEmp && (
            <div style={{background:C.wineBg,border:`1px solid ${C.wineBorder}`,borderRadius:12,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:C.gold,marginBottom:10}}>{T2("New Employee")}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
                {[{l:"Full Name",k:"name",ph:"Full name"},{l:"Section",k:"section",type:"sel",opts:ALL_DEPARTMENTS},{l:"Role",k:"role",type:"sel",opts:["staff","headchef","admin"]},{l:"PIN (4 digits)",k:"pin",max:4,ph:"0000"},{l:"Joining Date",k:"joining",dt:"date"},{l:"Dept",k:"dept",ph:"F&B Kitchen"}].map(f=>(
                  <div key={f.k}>
                    <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{f.l}</div>
                    {f.type==="sel"
                      ? <select value={newEmpForm[f.k]} onChange={e=>setNewEmpForm(p=>({...p,[f.k]:e.target.value}))} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>
                      : <input type={f.dt||"text"} value={newEmpForm[f.k]} onChange={e=>setNewEmpForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} maxLength={f.max} style={{width:"100%",padding:"6px 8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                    }
                  </div>
                ))}
              </div>
              <Btn onClick={addEmployee} color={C.wine} style={{fontSize:11,padding:"6px 16px"}}>{T2("Add Employee")}</Btn>
            </div>
          )}

          {/* Employee cards */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {dirFiltered.map((emp,i)=>{
              const isEdit = selEmp?.id===emp.id;
              return (
                <div key={emp.id} style={{background:C.surface,border:`1px solid ${isEdit?C.wine:C.border}`,borderRadius:10,padding:"11px 13px",opacity:emp.active?1:.65}}>
                  {isEdit&&editEmpForm ? (
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>Edit — {emp.name}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:8}}>
                        {[{l:"Name",k:"name"},{l:"PIN",k:"pin",max:4},{l:"Joining",k:"joining",dt:"date"}].map(f=>(
                          <div key={f.k}>
                            <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{f.l}</div>
                            <input type={f.dt||"text"} value={editEmpForm[f.k]||""} onChange={e=>setEditEmpForm(p=>({...p,[f.k]:e.target.value}))} maxLength={f.max} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                          </div>
                        ))}
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Section</div>
                          <select value={editEmpForm.section||""} onChange={e=>setEditEmpForm(p=>({...p,section:e.target.value}))} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                            {ALL_DEPARTMENTS.map(s=><option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Role</div>
                          <select value={editEmpForm.role} onChange={e=>setEditEmpForm(p=>({...p,role:e.target.value}))} style={{width:"100%",padding:"5px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface}}>
                            {[{v:"staff",l:"Staff"},{v:"headchef",l:"HC"},{v:"admin",l:"Admin"}].map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <Btn onClick={saveEmpEdit} color={C.wine} style={{fontSize:11,padding:"5px 12px"}}>Save</Btn>
                        <Btn onClick={()=>{setSelEmp(null);setEditEmpForm(null);}} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"5px 10px"}}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{display:"flex",gap:9,alignItems:"center"}}>
                          <Avatar name={emp.name} size={34} index={i}/>
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
                          <button onClick={()=>{setSelEmp(emp);setEditEmpForm({name:emp.name,pin:emp.pin,joining:emp.joining,role:emp.role,section:emp.section});}} style={{padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,fontSize:10,cursor:"pointer",color:C.text}}>Edit</button>
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
