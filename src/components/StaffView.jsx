// Ambria FnB — Staff Self-Service View
import React, { useState } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, safeArr } from '../utils/helpers.js';
import { STAFF_LIST, GROOMING_CHECKS, yrsOfService } from '../data/staffData.js';
import { Avatar, Card, Btn, Chip, SectionHeader, SelfieCapture } from './SharedUI.jsx';

function StaffView({user, attendance, setAttendance, leaves, setLeaves, onLogout, lang="en"}) {
  const T2 = s => T(s, lang);
  if(!user || !(user.id||user.staffListId||user.staff_id)) return <div style={{padding:40,textAlign:"center",color:"#888"}}>No user session. Please log in.</div>;
  const [tab,setTab]       = useState("home");
  const [selfie,setSelfie] = useState(null);
  const [grooming,setGrooming] = useState({});
  const [note,setNote]     = useState("");
  const [attStep,setAttStep] = useState("check");  // check | capture | done
  const [leaveForm,setLeaveForm] = useState({from:"",to:"",reason:""});

  const todayRec = (attendance||[]).find(a=>a.staffId===user.staffListId&&a.date===TODAY);
  const myLeaves = (leaves||[]).filter(l=>l.staffName===user.name);
  const staffIdx = STAFF_LIST.findIndex(s=>s.id===user.staffListId);
  const allOk    = GROOMING_CHECKS.every(c=>grooming[c.id]);

  function submitAtt(status) {
    setAttendance(p=>[...p.filter(a=>!(a.staffId===user.staffListId&&a.date===TODAY)),
      {id:Date.now(),staffId:user.staffListId,staffName:user.name,section:user.section,date:TODAY,
       time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
       status,selfie,grooming,groomingFailed:!allOk,note,role:user.role}
    ]);
    setAttStep("done");
  }

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
          <Avatar name={user.name} size={36} index={staffIdx>=0?staffIdx:0}/>
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
              <div style={{background:todayRec?.status==="Present"?C.greenBg:C.redBg,borderRadius:12,padding:"14px 16px",border:`1px solid ${todayRec?.status==="Present"?C.greenBorder:C.redBorder}`}}>
                <div style={{fontSize:12,fontWeight:600,color:todayRec?.status==="Present"?C.green:C.red,marginBottom:4}}>Today's Attendance</div>
                <div style={{fontSize:18,fontWeight:700,color:todayRec?.status==="Present"?C.green:C.red}}>{todayRec?todayRec.status:"Not marked"}</div>
                {todayRec&&<div style={{fontSize:12,color:C.muted,marginTop:3}}>Marked at {todayRec.time}</div>}
                {!todayRec&&<button onClick={()=>setTab("attendance")} style={{marginTop:8,padding:"5px 12px",borderRadius:7,background:"linear-gradient(135deg,#C4A44A,#8B6914)",color:"#0A0A0F",border:"none",fontSize:11,cursor:"pointer"}}>Mark Now →</button>}
              </div>
              <div style={{background:C.blueBg,borderRadius:12,padding:"14px 16px",border:`1px solid ${C.blueBorder}`}}>
                <div style={{fontSize:12,fontWeight:600,color:C.blue,marginBottom:4}}>{T2("Leave Balance")}</div>
                <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{myLeaves.filter(l=>l.status==="Approved").length} taken</div>
                <div style={{fontSize:12,color:C.muted,marginTop:3}}>{myLeaves.filter(l=>l.status==="Pending").length} pending approval</div>
              </div>
            </div>
            <Card>
              <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>Today's Events at Ambria</div>
              {LIVE_EVENTS_INIT.slice(0,2).map((ev,i)=>(
                <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.text}}>{ev.guest}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ev.date} · {ev.time} · {ev.pax} pax · {ev.venue}</div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {tab==="attendance"&&(
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:14}}>Mark Attendance — {TODAY_LABEL}</div>

            {todayRec&&attStep==="check"&&(
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:"16px",marginBottom:14,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <div style={{fontSize:15,fontWeight:700,color:C.green}}>Already marked — {todayRec.status}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>Checked in at {todayRec.time}</div>
                {todayRec.selfie&&<img src={todayRec.selfie} alt="" style={{width:80,height:60,objectFit:"cover",borderRadius:8,border:`2px solid ${C.greenBorder}`,marginTop:10}}/>}
                <div style={{marginTop:12}}>
                  <button onClick={()=>setAttStep("capture")} style={{padding:"7px 16px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:12,cursor:"pointer"}}>Re-mark Attendance</button>
                </div>
              </div>
            )}

            {attStep==="done"&&(
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:"24px",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:10}}>✅</div>
                <div style={{fontSize:16,fontWeight:700,color:C.green}}>{T2("Attendance marked!")}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>{TODAY} · {new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                {!allOk&&<div style={{marginTop:10,padding:"8px 12px",background:C.amberBg,borderRadius:8,fontSize:12,color:C.amber}}>⚠ Some grooming checks were incomplete — supervisor notified</div>}
                <button onClick={()=>setAttStep("check")} style={{marginTop:14,padding:"8px 18px",borderRadius:8,background:C.gold,color:"#fff",border:"none",fontSize:12,cursor:"pointer"}}>Done</button>
              </div>
            )}

            {(attStep==="capture"||(!todayRec&&attStep==="check"))&&(
              <div>
                <Card style={{marginBottom:12}}>
                  <SectionHeader icon="📷" title="Take a Selfie"/>
                  <SelfieCapture captured={selfie} onCapture={setSelfie} onRetake={()=>setSelfie(null)} lang={lang}/>
                  {!selfie&&<div style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:8}}>{T2("Required to mark attendance")}</div>}
                </Card>
                <Card style={{marginBottom:12}}>
                  <SectionHeader icon="✓" title="Grooming Self-Check"/>
                  <div style={{fontSize:11,color:C.muted,marginBottom:10}}>{T2("Confirm your grooming before starting shift:")}</div>
                  {GROOMING_CHECKS.map(c=>(
                    <label key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}}>
                      <input type="checkbox" checked={!!grooming[c.id]} onChange={e=>setGrooming(p=>({...p,[c.id]:e.target.checked}))} style={{width:20,height:20,accentColor:C.wine,cursor:"pointer"}}/>
                      <span style={{fontSize:13,color:C.text}}>{c.label}</span>
                      {grooming[c.id]&&<span style={{marginLeft:"auto",fontSize:11,color:C.green,fontWeight:500}}>✓</span>}
                    </label>
                  ))}
                  {!allOk&&<div style={{marginTop:8,padding:"10px 14px",background:C.amberBg,borderRadius:7,fontSize:11,color:C.amber}}>{GROOMING_CHECKS.filter(c=>!grooming[c.id]).length} items pending — supervisor will be notified</div>}
                </Card>
                <div style={{display:"flex",gap:8}}>
                  <Btn onClick={()=>{if(!selfie){alert("Please capture selfie first");return;}submitAtt("Present");}} color={C.wine} style={{flex:1,padding:"12px",fontSize:14,fontWeight:600}}>✓ Mark Present</Btn>
                  <Btn onClick={()=>submitAtt(T2("Late"))} color={C.amberBg} textColor={C.amber} border={`1px solid ${C.amberBorder}`} style={{padding:"12px 16px",fontSize:13}}>Late</Btn>
                </div>
              </div>
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
                <Avatar name={user.name} size={64} index={staffIdx>=0?staffIdx:0}/>
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
