// Ambria FnB — Staff Self-Service View
import React, { useState } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, safeArr } from '../utils/helpers.js';
import { yrsOfService } from '../data/staffData.js';
import { Avatar, Card, Btn, Chip } from './SharedUI.jsx';

function StaffView({user, attendance, leaves, setLeaves, onLogout, lang="en"}) {
  const T2 = s => T(s, lang);
  if(!user || !(user.id||user.staffListId||user.staff_id)) return <div style={{padding:40,textAlign:"center",color:"#888"}}>No user session. Please log in.</div>;
  const [tab,setTab]       = useState("home");
  const [leaveForm,setLeaveForm] = useState({from:"",to:"",reason:""});

  const sid = String(user.staffListId||user.staff_id||user.id||'');
  const todayRec = safeArr(attendance).find(a=>(String(a.staff_id)===sid||String(a.staffId)===sid)&&a.date===TODAY);
  const myLeaves = (leaves||[]).filter(l=>l.staffName===user.name);
  const staffIdx = (function(){
    var s = String(user.staffListId||user.staff_id||user.id||user.name||'');
    var h = 0; for (var i=0;i<s.length;i++) h = ((h<<5)-h+s.charCodeAt(i))|0;
    return Math.abs(h) % 32;
  })();

  function submitLeave() {
    if(!leaveForm.from||!leaveForm.to)return;
    setLeaves(p=>[...p,{...leaveForm,id:Date.now(),staffName:user.name,staffSection:user.section,staffId:user.id,status:"Pending"}]);
    setLeaveForm({from:"",to:"",reason:""});
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif"}}>
      {/* Top bar */}
      <div style={{background:C.gold,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Avatar name={user.name} size={36} index={staffIdx}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{user.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.7)"}}>{user.id} · {user.section} · {user.dept}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{background:"rgba(196,164,74,.2)",border:"1px solid rgba(255,255,255,.3)",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 14px",cursor:"pointer"}}>{T2("Sign Out")}</button>
      </div>

      {/* Tab bar */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",gap:6}}>
        {[{id:"home",l:"🏠 Home"},{id:"attendance",l:"✅ Attendance"},{id:"leaves",l:"🌿 My Leaves"},{id:"profile",l:"👤 Profile"}].map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);if(t.id==="attendance")setAttStep("check");}} style={{
            padding:"12px 16px",border:"none",borderBottom:`2.5px solid ${tab===t.id?C.wine:"transparent"}`,
            background:"transparent",fontSize:12,fontWeight:tab===t.id?600:400,
            color:tab===t.id?C.wine:C.muted,cursor:"pointer",
          }}>{lang==="hi"&&t.hi?t.hi:t.l}</button>
        ))}
      </div>

      <div style={{padding:"20px",maxWidth:640,margin:"0 auto"}}>

        {/* ── HOME ── */}
        {tab==="home"&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:14}}>Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, {(user.name||"").split(" ")[0]} 👋</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:todayRec?C.greenBg:C.redBg,borderRadius:12,padding:"14px 16px",border:`1px solid ${todayRec?C.greenBorder:C.redBorder}`}}>
                <div style={{fontSize:12,fontWeight:600,color:todayRec?C.green:C.red,marginBottom:4}}>Today's Attendance</div>
                <div style={{fontSize:18,fontWeight:700,color:todayRec?C.green:C.red}}>{todayRec?"Present":"Not yet marked"}</div>
                {todayRec&&<div style={{fontSize:12,color:C.muted,marginTop:3}}>IN {todayRec.in_time||todayRec.time||"—"}{todayRec.out_time?" · OUT "+todayRec.out_time:""}</div>}
                {!todayRec&&<div style={{fontSize:11,color:C.muted,marginTop:6}}>Attendance is marked at the property gate kiosk</div>}
              </div>
              <div style={{background:C.blueBg,borderRadius:12,padding:"14px 16px",border:`1px solid ${C.blueBorder}`}}>
                <div style={{fontSize:12,fontWeight:600,color:C.blue,marginBottom:4}}>{T2("Leave Balance")}</div>
                <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{myLeaves.filter(l=>l.status==="Approved").length} taken</div>
                <div style={{fontSize:12,color:C.muted,marginTop:3}}>{myLeaves.filter(l=>l.status==="Pending").length} pending approval</div>
              </div>
            </div>
            <Card>
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>Today's Events at Ambria</div>
              <div style={{padding:"12px 0",fontSize:12,color:C.muted}}>Event details available on the Dashboard.</div>
            </Card>
          </div>
        )}

        {/* ── ATTENDANCE (read-only — marked at gate kiosk) ── */}
        {tab==="attendance"&&(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:14}}>My Attendance — {TODAY_LABEL}</div>

            {todayRec?(
              <Card style={{textAlign:"center",padding:"24px 16px"}}>
                <div style={{fontSize:48,marginBottom:10}}>{todayRec.out_time?"🏁":"✅"}</div>
                <div style={{fontSize:18,fontWeight:700,color:C.green,marginBottom:6}}>Present</div>
                <div style={{display:"flex",justifyContent:"center",gap:20,marginBottom:12}}>
                  <div style={{background:C.greenBg,borderRadius:10,padding:"10px 18px",border:`1px solid ${C.greenBorder}`}}>
                    <div style={{fontSize:11,color:C.green,fontWeight:600}}>PUNCH IN</div>
                    <div style={{fontSize:18,fontWeight:700,color:C.green,marginTop:2}}>{todayRec.in_time||todayRec.time||"—"}</div>
                  </div>
                  <div style={{background:todayRec.out_time?C.redBg:C.bg,borderRadius:10,padding:"10px 18px",border:`1px solid ${todayRec.out_time?C.redBorder:C.border}`}}>
                    <div style={{fontSize:11,color:todayRec.out_time?C.red:C.muted,fontWeight:600}}>PUNCH OUT</div>
                    <div style={{fontSize:18,fontWeight:700,color:todayRec.out_time?C.red:C.muted,marginTop:2}}>{todayRec.out_time||"—"}</div>
                  </div>
                </div>
                {todayRec.venue&&<div style={{fontSize:12,color:C.muted}}>Venue: {todayRec.venue}</div>}
              </Card>
            ):(
              <Card style={{textAlign:"center",padding:"24px 16px"}}>
                <div style={{fontSize:48,marginBottom:10}}>⏳</div>
                <div style={{fontSize:16,fontWeight:700,color:C.muted,marginBottom:6}}>Not yet marked</div>
                <div style={{fontSize:13,color:C.muted}}>Attendance is recorded at the property gate kiosk when you arrive.</div>
              </Card>
            )}
          </div>
        )}

        {/* ── LEAVES ── */}
        {tab==="leaves"&&(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:14}}>{T2("My Leave Requests")}</div>
            <Card style={{marginBottom:14}}>
              <SectionHeader icon="+" title="Request Leave"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:4}}>From</div>
                  <input type="date" value={leaveForm.from} onChange={e=>setLeaveForm(p=>({...p,from:e.target.value}))} style={{width:"100%",padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:4}}>To</div>
                  <input type="date" value={leaveForm.to} onChange={e=>setLeaveForm(p=>({...p,to:e.target.value}))} style={{width:"100%",padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
                </div>
              </div>
              <input value={leaveForm.reason} onChange={e=>setLeaveForm(p=>({...p,reason:e.target.value}))} placeholder={T2("Reason (optional)")}
                style={{width:"100%",padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,marginBottom:10,boxSizing:"border-box"}}/>
              <Btn onClick={submitLeave} style={{width:"100%",padding:"10px",fontSize:13}}>{T2("Submit Request")}</Btn>
              <div style={{marginTop:8,fontSize:11,color:C.muted}}>Requests go to Yatender for approval.</div>
            </Card>
            {myLeaves.length===0&&<div style={{fontSize:13,color:C.muted,textAlign:"center",padding:20}}>No leave requests yet.</div>}
            {myLeaves.map((l,i)=>(
              <div key={l.id||i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>{l.from} → {l.to}</div>
                    {l.reason&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{l.reason}</div>}
                    {l.rejectReason&&<div style={{fontSize:11,color:C.red,marginTop:2}}>Reason: {l.rejectReason}</div>}
                  </div>
                  <Chip label={l.status==="Approved"?"✓ Approved":l.status==="Rejected"?"✗ Rejected":"⏳ Pending"}
                    color={l.status==="Approved"?C.green:l.status==="Rejected"?C.red:C.amber}
                    bg={l.status==="Approved"?C.greenBg:l.status==="Rejected"?C.redBg:C.amberBg}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab==="profile"&&(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:14}}>{T2("My Profile")}</div>
            <Card style={{marginBottom:12}}>
              <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:16}}>
                <Avatar name={user.name} size={64} index={staffIdx}/>
                <div>
                  <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{user.name}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:3}}>{user.section} · {user.dept}</div>
                  <Chip label={user.role==="headchef"?"Head Chef":user.role==="admin"?"Admin":"Kitchen Staff"} color={C.wine} bg={C.wineBg} size={11}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {l:"Employee ID",v:user.id},
                  {l:"Section",v:user.section},
                  {l:"Department",v:user.dept},
                  {l:"Joining Date",v:user.joining},
                  {l:"Service",v:yrsOfService(user.joining)},
                  {l:"Venue",v:"Ambria Pushpanjali / Exotica"},
                ].map(f=>(
                  <div key={f.l} style={{background:C.bg,borderRadius:8,padding:"9px 12px"}}>
                    <div style={{fontSize:12,color:C.muted}}>{f.l}</div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,marginTop:2}}>{f.v}</div>
                  </div>
                ))}
              </div>
            </Card>
            <div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"10px 0"}}>
              To update PIN or profile details, contact Efficiency Manager (Abhi) · ID: AM001
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EMPLOYEE MANAGEMENT (admin only) ─────────────────────────────





export { StaffView };
