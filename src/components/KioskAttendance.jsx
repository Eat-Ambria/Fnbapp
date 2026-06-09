// Ambria FnB — Kiosk Attendance (used inside DeptView and GateKiosk)
import React, { useState, useRef, useEffect } from "react";
import { C, SECTION_META } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, safeArr } from '../utils/helpers.js';
import { STAFF_LIST, GROOMING_CHECKS } from '../data/staffData.js';
import { Avatar, SelfieCapture } from './SharedUI.jsx';
import { dbUpsert } from '../lib/db.js';

function KioskAttendance({ staffList, attendance, setAttendance, onClose, leaves, setLeaves, empDb, setEmpDb, lang="en", currentUser=null }) {
  const T2 = s => T(s, lang);
  const allStaff = safeArr(staffList);
  const todayAtt = safeArr(attendance).filter(a=>a.date===TODAY);

  const [phase, setPhase] = useState("dept");   // dept | select | verify | create_pin | photo | done | leave | outdoor
  const [lockedSection, setLockedSection] = useState(null);
  const [picked, setPicked] = useState(null);
  const [punchAction, setPunchAction] = useState("in"); // "in" or "out"
  const [pinInput, setPinInput] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [photo, setPhoto] = useState(null);
  const [search, setSearch] = useState("");
  const [outdoorForm, setOutdoorForm] = useState({name:"",phone:"",role:"Helper",vendor:""});

  // New dept-first kiosk flow
  const [kioskStep, setKioskStep] = useState("dept");
  const [kioskDept, setKioskDept] = useState(null);
  const [kioskStaff, setKioskStaff] = useState(null);
  const [kioskSuccess, setKioskSuccess] = useState(null);

  const KIOSK_DEPTS = [
    {id:"kitchen",    label:"Kitchen",        icon:"👨‍🍳", sections:["Indian Curries","Tandoor","Chinese","Chaat","Sweets","Continental","Bakery"]},
    {id:"service",    label:"Service",        icon:"🍽"},
    {id:"crockery",   label:"Crockery",       icon:"🍶"},
    {id:"beverages",  label:"Beverages",      icon:"🥤"},
    {id:"transport",  label:"Transportation", icon:"🚛"},
    {id:"odc",        label:"ODC",            icon:"🏕"},
    {id:"management", label:"Management",     icon:"🔐"},
    {id:"maintenance",label:"Maintenance",    icon:"🔧"},
  ];

  // Leave form
  const [leaveForm, setLeaveForm] = useState({from:"",to:"",reason:"Personal"});

  // Camera refs
  const vRef = useRef(null);
  const cRef = useRef(null);
  const [camReady, setCamReady] = useState(false);
  const [camErr, setCamErr] = useState(false);

  function startCam(){
    setCamErr(false); setCamReady(false);
    navigator.mediaDevices?.getUserMedia({video:{facingMode:"user",width:320,height:240}})
      .then(stream=>{if(vRef.current){vRef.current.srcObject=stream;vRef.current.onloadedmetadata=()=>{vRef.current.play();setCamReady(true);};}})
      .catch(()=>setCamErr(true));
  }
  function stopCam(){try{vRef.current?.srcObject?.getTracks().forEach(t=>t.stop());}catch(e){}}
  function capturePhoto(){
    if(!vRef.current||!cRef.current)return null;
    const c=cRef.current;c.width=320;c.height=240;
    c.getContext("2d").drawImage(vRef.current,0,0,320,240);
    return c.toDataURL("image/jpeg",0.7);
  }

  // Staff for current section
  const sectionStaff = lockedSection ? allStaff.filter(s=>s.section===lockedSection) : allStaff;
  const filteredStaff = search ? sectionStaff.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())) : sectionStaff;
  const presentToday = todayAtt.filter(a=>a.status==="Present");

  function getStaffAtt(staff){ return todayAtt.find(a=>String(a.staffId||a.staff_id)===String(staff.staffListId||staff.staff_id||staff.id)&&a.status==="Present"); }

  function handlePickStaff(staff){
    const att = getStaffAtt(staff);
    if(att && att.punchOut){
      // Already punched in AND out — show done (shift complete)
      setPicked(staff); setPunchAction("done_shift"); setPhase("done"); return;
    }
    if(att && !att.punchOut){
      // Punched in but NOT out — offer punch out
      setPicked(staff); setPunchAction("out"); setPinInput(""); setPinError(""); setPhase("verify"); return;
    }
    // Not punched in — punch in
    setPicked(staff); setPunchAction("in"); setPinInput(""); setPinError(""); setPhase("verify");
  }

  function verifyPin(){
    if(!picked) return;
    const emp = safeArr(empDb).find(e=>e.name===picked.name || String(e.id)===String(picked.id));
    if(!emp){ setPinError(T2("Employee not found in database")); return; }
    if(String(emp.pin)==="0000" && pinInput.trim()==="0000"){
      // First login — force PIN creation
      setNewPin(""); setConfirmPin(""); setPinError("");
      setPhase("create_pin");
      return;
    }
    if(String(emp.pin)!==pinInput.trim()){ setPinError(T2("Wrong PIN. Try again.")); return; }
    // PIN verified — go to photo
    setPhase("photo");
    setTimeout(startCam, 300);
  }

  function saveNewPin(){
    if(newPin.length<4){ setPinError(T2("PIN must be 4 digits")); return; }
    if(newPin!==confirmPin){ setPinError(T2("PINs do not match")); return; }
    if(newPin==="0000"){ setPinError(T2("Cannot use 0000. Choose a unique PIN.")); return; }
    // Update PIN in empDb
    if(setEmpDb) setEmpDb(prev=>safeArr(prev).map(e=>(e.name===picked.name||String(e.id)===String(picked.id))?{...e,pin:newPin}:e));
    setPinError("");
    setPhase("photo");
    setTimeout(startCam, 300);
  }

  function confirmAttendance(){
    const snap = capturePhoto();
    stopCam();
    setPhoto(snap);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});

    if(punchAction==="out"){
      // Punch OUT — update existing record (match by staffId OR staffName for outdoor)
      setAttendance(prev=>safeArr(prev).map(a=>
        (String(a.staffId)===String(picked.id)||a.staffName===picked.name)&&a.date===TODAY&&a.status==="Present"&&!a.punchOut
          ? {...a, punchOut:timeStr, punchOutPhoto:snap}
          : a
      ));
    } else {
      // Punch IN — create new record
      const isOutdoor = picked.section==="Outdoor Staff";
      const rec = {
        staffId: String(picked.id), staffName: picked.name, staffSection: picked.section,
        date: TODAY, time: timeStr, status: "Present", photo: snap,
        pinVerified: !isOutdoor, isOutdoor,
        role: picked.role||"", phone: picked.phone||"", vendor: picked.vendor||"",
        punchOut: null, punchOutPhoto: null
      };
      setAttendance(prev=>[...safeArr(prev), rec]);
    }
    setPhase("done");
  }

  function submitLeave(){
    if(!picked||!leaveForm.from||!leaveForm.to) return;
    const newLeave = {
      id: Date.now(), staffId: String(picked.id), staffName: picked.name, staffSection: picked.section,
      from: leaveForm.from, to: leaveForm.to, reason: leaveForm.reason, status: "Pending"
    };
    if(setLeaves) setLeaves(prev=>[...safeArr(prev), newLeave]);
    setLeaveForm({from:"",to:"",reason:"Personal"});
    setPhase("done");
  }

  function reset(){ setPicked(null);setPunchAction("in");setPinInput("");setPinError("");setPhoto(null);setSearch("");setOutdoorForm({name:"",phone:"",role:"Helper",vendor:""});stopCam();setPhase("dept");setKioskStep("dept");setKioskDept(null);setKioskStaff(null);setKioskSuccess(null); }

  // Auto-reset after done
  useEffect(()=>{if(phase==="done"){const t=setTimeout(reset,4000);return()=>clearTimeout(t);}});

  function markKioskAttendance(type) {
    var now = new Date();
    var timeStr = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    var sid = kioskStaff.staffListId || kioskStaff.staff_id;
    if (typeof setAttendance === 'function') {
      setAttendance(function(prev) {
        var existing = safeArr(prev).find(function(a){return a.staff_id===sid && a.date===TODAY;});
        if (existing) {
          return safeArr(prev).map(function(a){
            return a.staff_id===sid && a.date===TODAY
              ? {...a, status:'Present', out_time:type==='OUT'?timeStr:a.out_time, in_time:type==='IN'?timeStr:a.in_time}
              : a;
          });
        }
        return [...safeArr(prev), {id:'att-'+Date.now(), staff_id:sid, staff_name:kioskStaff.name,
          section:kioskStaff.section, dept:kioskStaff.dept, date:TODAY,
          status:'Present', in_time:type==='IN'?timeStr:'', out_time:type==='OUT'?timeStr:''}];
      });
    }
    setKioskSuccess({name:kioskStaff.name, type:type, time:timeStr});
    setKioskStep("success");
    setTimeout(function(){
      setKioskStep("dept");
      setKioskDept(null);
      setKioskStaff(null);
      setKioskSuccess(null);
    }, 4000);
  }

  const bg = {minHeight:"100vh",background:"#0A0A0F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",color:"#F0ECE0"};
  const cardStyle = {background:"#161514",borderRadius:20,border:`1px solid #2A2824`,padding:"28px 32px",maxWidth:600,width:"100%",boxShadow:"0 8px 40px rgba(0,0,0,.5)"};
  const inputStyle = {width:"100%",padding:"14px 16px",borderRadius:12,border:`1px solid #2A2824`,fontSize:14,color:"#F0ECE0",background:"#1A1918",boxSizing:"border-box",minHeight:48};
  const goldBtn = {padding:"14px 28px",borderRadius:12,background:`linear-gradient(135deg,#C4A44A,#8B6914)`,color:"#0A0A0F",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:52,width:"100%"};

  return (
    <div style={bg}>
      {/* Close button */}
      <button onClick={()=>{stopCam();onClose();}} style={{position:"absolute",top:20,right:24,background:"rgba(255,255,255,.06)",border:"1px solid #2A2824",borderRadius:10,color:"#8A8476",fontSize:13,padding:"10px 18px",cursor:"pointer",minHeight:44}}>✕ {T2("Close")}</button>

      {/* Venue header */}
      {currentUser&&currentUser.venue&&(
        <div style={{textAlign:"center",padding:"12px",marginBottom:16,background:"#1A1714",borderRadius:12,border:"1px solid #2A2520",width:"100%",maxWidth:500,boxSizing:"border-box"}}>
          <div style={{fontSize:18,fontWeight:700,color:"#D4B44A",fontFamily:"var(--font-display)"}}>{currentUser.venue}</div>
          <div style={{fontSize:11,color:"#7A6F62"}}>Gate Kiosk</div>
        </div>
      )}

      {/* ═══ SCREEN 1: DEPT SELECTOR ═══ */}
      {kioskStep==="dept"&&(
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,textAlign:"center",fontFamily:"var(--font-display)",marginBottom:20}}>
            Select Your Department
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {KIOSK_DEPTS.map(function(d) {
              var count = safeArr(empDb).filter(function(s) {
                return s.is_active!==false && (s.dept===d.id ||
                  (d.sections && d.sections.includes(s.section)));
              }).length;
              return (
                <button key={d.id} onClick={function(){setKioskDept(d);setKioskStep("name");}}
                  style={{background:"#1A1918",border:"2px solid #2A2824",borderRadius:16,padding:"24px 16px",cursor:"pointer",textAlign:"center",minHeight:120}}>
                  <div style={{fontSize:36,marginBottom:8}}>{d.icon}</div>
                  <div style={{fontSize:15,fontWeight:700,color:"#F0ECE0"}}>{d.label}</div>
                  <div style={{fontSize:12,color:"#5A5750",marginTop:4}}>{count} staff</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ SCREEN 2: NAME SELECTION ═══ */}
      {kioskStep==="name"&&kioskDept&&(
        <div style={{maxWidth:640,width:"100%"}}>
          <button onClick={function(){setKioskStep("dept");setKioskDept(null);}}
            style={{padding:"10px 18px",borderRadius:10,background:"#1A1918",border:"1px solid #2A2824",color:"#8A8476",fontSize:13,cursor:"pointer",marginBottom:16,minHeight:44}}>
            ← Back to Departments
          </button>
          <div style={{fontSize:18,fontWeight:700,color:"#F0ECE0",fontFamily:"var(--font-display)",marginBottom:4}}>
            {kioskDept.icon} {kioskDept.label}
          </div>
          <div style={{fontSize:12,color:"#5A5750",marginBottom:16}}>
            Select your name to mark attendance
          </div>
          {kioskDept.sections ? (
            kioskDept.sections.map(function(sec) {
              var secStaff = safeArr(empDb).filter(function(s) {
                return s.is_active!==false && s.section===sec;
              });
              if (secStaff.length===0) return null;
              return (
                <div key={sec} style={{marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#C4A44A",marginBottom:6,textTransform:"uppercase",letterSpacing:0.8}}>{sec}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                    {secStaff.map(function(s) {
                      var sid = s.staffListId||s.staff_id;
                      var todayRec = safeArr(todayAtt).find(function(a){return a.staff_id===sid&&a.date===TODAY;});
                      return (
                        <button key={sid} onClick={function(){setKioskStaff(s);setKioskStep("action");}}
                          style={{padding:"14px 16px",borderRadius:12,background:todayRec?"#12201A":"#1A1918",
                            border:"1.5px solid "+(todayRec?C.greenBorder:"#2A2824"),cursor:"pointer",textAlign:"left",minHeight:56}}>
                          <div style={{fontSize:14,fontWeight:700,color:todayRec?C.green:"#F0ECE0"}}>{s.name}</div>
                          <div style={{fontSize:11,color:"#5A5750"}}>{s.section} · {sid}
                            {todayRec&&<span style={{color:C.green,marginLeft:6}}>✓ {todayRec.in_time||todayRec.time}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {safeArr(empDb).filter(function(s) {
                return s.is_active!==false && s.dept===kioskDept.id;
              }).map(function(s) {
                var sid = s.staffListId||s.staff_id;
                var todayRec = safeArr(todayAtt).find(function(a){return a.staff_id===sid&&a.date===TODAY;});
                return (
                  <button key={sid} onClick={function(){setKioskStaff(s);setKioskStep("action");}}
                    style={{padding:"14px 16px",borderRadius:12,background:todayRec?"#12201A":"#1A1918",
                      border:"1.5px solid "+(todayRec?C.greenBorder:"#2A2824"),cursor:"pointer",textAlign:"left",minHeight:56}}>
                    <div style={{fontSize:14,fontWeight:700,color:todayRec?C.green:"#F0ECE0"}}>{s.name}</div>
                    <div style={{fontSize:11,color:"#5A5750"}}>{s.section||s.dept} · {sid}
                      {todayRec&&<span style={{color:C.green,marginLeft:6}}>✓ {todayRec.in_time||todayRec.time}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ SCREEN 3: PUNCH IN / OUT ═══ */}
      {kioskStep==="action"&&kioskStaff&&(
        <div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:48,marginBottom:12}}>👤</div>
          <div style={{fontSize:22,fontWeight:700,color:"#F0ECE0",fontFamily:"var(--font-display)",marginBottom:4}}>
            {kioskStaff.name}
          </div>
          <div style={{fontSize:13,color:"#5A5750",marginBottom:24}}>
            {kioskStaff.section||kioskStaff.dept} · {kioskStaff.staffListId||kioskStaff.staff_id}
          </div>
          <div style={{display:"flex",gap:16,justifyContent:"center"}}>
            <button onClick={function(){markKioskAttendance("IN");}}
              style={{padding:"20px 40px",borderRadius:16,fontSize:18,fontWeight:700,cursor:"pointer",minHeight:70,minWidth:150,background:"linear-gradient(135deg,#3EAA68,#1A5030)",color:"#fff",border:"none"}}>
              ✅ PUNCH IN
            </button>
            <button onClick={function(){markKioskAttendance("OUT");}}
              style={{padding:"20px 40px",borderRadius:16,fontSize:18,fontWeight:700,cursor:"pointer",minHeight:70,minWidth:150,background:"linear-gradient(135deg,#D04040,#8A1010)",color:"#fff",border:"none"}}>
              🚪 PUNCH OUT
            </button>
          </div>
          <button onClick={function(){setKioskStep("name");setKioskStaff(null);}}
            style={{marginTop:16,padding:"10px 24px",borderRadius:10,background:"#1A1918",border:"1px solid #2A2824",color:"#8A8476",fontSize:12,cursor:"pointer"}}>
            ← Wrong person? Go back
          </button>
        </div>
      )}

      {/* ═══ SCREEN 4: SUCCESS ═══ */}
      {kioskStep==="success"&&kioskSuccess&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:64,marginBottom:16}}>
            {kioskSuccess.type==="IN"?"✅":"🚪"}
          </div>
          <div style={{fontSize:24,fontWeight:700,color:"#F0ECE0",fontFamily:"var(--font-display)",marginBottom:8}}>
            {kioskSuccess.name}
          </div>
          <div style={{fontSize:18,color:kioskSuccess.type==="IN"?C.green:C.amber,fontWeight:700,marginBottom:4}}>
            {kioskSuccess.type==="IN"?"PUNCHED IN":"PUNCHED OUT"} at {kioskSuccess.time}
          </div>
          <div style={{fontSize:14,color:"#5A5750",marginTop:20}}>
            Returning in 4 seconds...
          </div>
        </div>
      )}

      {/* ═══ PHASE: OUTDOOR / DAILY WAGES STAFF ═══ */}
      {phase==="outdoor"&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:36,marginBottom:8}}>👷</div>
            <div style={{fontSize:20,fontWeight:700,color:"#E8A040",fontFamily:"var(--font-display)"}}>{T2("Outdoor / Daily Wages Staff")}</div>
            <div style={{fontSize:12,color:"#5A5750",marginTop:4}}>{T2("Enter details for attendance")}</div>
          </div>

          {/* Show already registered outdoor staff for today - for punch out */}
          {(()=>{
            const outdoorAtt = todayAtt.filter(a=>a.staffSection==="Outdoor Staff"&&a.status==="Present");
            if(outdoorAtt.length===0) return null;
            return(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#E8A040",marginBottom:8}}>{T2("Already Checked In")} ({outdoorAtt.length})</div>
                <div style={{maxHeight:200,overflowY:"auto"}}>
                  {outdoorAtt.map((att,i)=>{
                    const done=!!att.punchOut;
                    return(
                      <div key={i} onClick={()=>{
                        if(done) return;
                        setPicked({id:"OUT_"+att.staffName,name:att.staffName,section:"Outdoor Staff",role:att.role||"Helper"});
                        setPunchAction("out");
                        setPhase("photo");setTimeout(startCam,300);
                      }} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:10,marginBottom:4,cursor:done?"default":"pointer",
                        background:done?"#181716":"#1E1810",border:`1px solid ${done?C.border:"#E8A04040"}`,opacity:done?.5:1}}>
                        {att.photo?<img src={att.photo} style={{width:36,height:36,borderRadius:8,objectFit:"cover"}}/>
                          :<div style={{width:36,height:36,borderRadius:8,background:"#E8A04020",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👷</div>}
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:C.text}}>{att.staffName}</div>
                          <div style={{fontSize:11,color:"#5A5750"}}>{att.role||"Helper"} {att.vendor?`· ${att.vendor}`:""}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          {done?<div style={{fontSize:10,color:C.muted}}>🏁 {att.time}→{att.punchOut}</div>
                            :<div><div style={{fontSize:10,color:"#4DAA6A"}}>✅ {att.time}</div><div style={{fontSize:10,color:"#D06040",fontWeight:600}}>👋 {T2("Tap to Punch Out")}</div></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{height:1,background:C.border,margin:"12px 0"}}/>
              </div>
            );
          })()}

          {/* New outdoor staff form */}
          <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>{T2("New Staff Entry")}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <div style={{fontSize:11,color:"#5A5750",marginBottom:3}}>{T2("Full Name")} *</div>
              <input value={outdoorForm.name} onChange={e=>setOutdoorForm(p=>({...p,name:e.target.value}))} placeholder={T2("Enter full name")}
                style={{...inputStyle,fontSize:14}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:"#5A5750",marginBottom:3}}>{T2("Phone")}</div>
              <input value={outdoorForm.phone} onChange={e=>setOutdoorForm(p=>({...p,phone:e.target.value}))} placeholder="98100-XXXXX"
                style={inputStyle}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div>
              <div style={{fontSize:11,color:"#5A5750",marginBottom:3}}>{T2("Role")}</div>
              <select value={outdoorForm.role} onChange={e=>setOutdoorForm(p=>({...p,role:e.target.value}))}
                style={{...inputStyle,appearance:"auto"}}>
                {["Helper","Cook","Tandoor","Service Staff","Cleaner","Loader","Driver","Electrician","Plumber","Decorator","Other"].map(r=>
                  <option key={r} value={r}>{T2(r)}</option>
                )}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:"#5A5750",marginBottom:3}}>{T2("Vendor / Agency")}</div>
              <input value={outdoorForm.vendor} onChange={e=>setOutdoorForm(p=>({...p,vendor:e.target.value}))} placeholder={T2("Optional")}
                style={inputStyle}/>
            </div>
          </div>
          <button onClick={()=>{
            if(!outdoorForm.name.trim()) return;
            setPicked({id:"OUT_"+Date.now(),name:outdoorForm.name.trim(),section:"Outdoor Staff",role:outdoorForm.role,phone:outdoorForm.phone,vendor:outdoorForm.vendor});
            setPunchAction("in");
            setPhase("photo");setTimeout(startCam,300);
          }} disabled={!outdoorForm.name.trim()}
            style={{...goldBtn,background:"linear-gradient(135deg,#E8A040,#8B6014)",opacity:outdoorForm.name.trim()?1:.4,cursor:outdoorForm.name.trim()?"pointer":"not-allowed"}}>
            📸 {T2("Continue to Photo")} →
          </button>
          <button onClick={reset} style={{width:"100%",padding:"12px",borderRadius:10,background:"transparent",border:`1px solid ${C.border}`,color:"#8A8476",fontSize:12,cursor:"pointer",marginTop:8,minHeight:44}}>{T2("Back")}</button>
        </div>
      )}

      {/* ═══ PHASE: VERIFY PIN ═══ */}
      {phase==="verify"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:8}}>{punchAction==="out"?"👋":"🔐"}</div>
            <div style={{fontSize:18,fontWeight:700,color:C.text}}>{picked.name}</div>
            <div style={{fontSize:12,color:"#5A5750"}}>{T2(picked.section)} · {picked.role}</div>
            {punchAction==="out"&&(()=>{
              const att=getStaffAtt(picked);
              return att?<div style={{marginTop:8,padding:"6px 14px",borderRadius:10,background:C.greenBg,border:`1px solid ${C.greenBorder}`,display:"inline-block"}}>
                <span style={{fontSize:12,color:C.green}}>✅ {T2("Punched In at")} {att.time}</span>
              </div>:null;
            })()}
          </div>
          <div style={{fontSize:13,fontWeight:600,color:punchAction==="out"?"#D06040":C.gold,marginBottom:8,textAlign:"center"}}>
            {punchAction==="out"?T2("Enter PIN to Punch Out"):T2("Enter your unique PIN to verify identity")}
          </div>
          <input type="password" value={pinInput} onChange={e=>setPinInput(e.target.value.replace(/\D/g,"").slice(0,4))}
            onKeyDown={e=>e.key==="Enter"&&verifyPin()} placeholder="• • • •" autoFocus maxLength={4}
            style={{...inputStyle,textAlign:"center",fontSize:28,letterSpacing:16,marginBottom:12}}/>
          {pinError&&<div style={{background:"#201212",border:"1px solid #3A1E1E",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#D64545",marginBottom:12,textAlign:"center"}}>{pinError}</div>}
          <button onClick={verifyPin} disabled={pinInput.length<4} style={{...goldBtn,opacity:pinInput.length<4?.4:1,cursor:pinInput.length<4?"not-allowed":"pointer",background:punchAction==="out"?"linear-gradient(135deg,#D06040,#8B3020)":"linear-gradient(135deg,#D4B44A,#8B6914)"}}>
            {punchAction==="out"?`👋 ${T2("Verify & Punch Out")}`:`${T2("Verify & Continue")} →`}
          </button>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            {punchAction==="in"&&<button onClick={()=>{setPhase("leave");}} style={{flex:1,padding:"12px",borderRadius:10,background:"#181716",border:"1px solid #272420",color:"#D4A843",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>📋 {T2("Apply for Leave")}</button>}
            <button onClick={reset} style={{flex:1,padding:"12px",borderRadius:10,background:"#181716",border:"1px solid #272420",color:"#8A8476",fontSize:12,cursor:"pointer",minHeight:44}}>{T2("Cancel")}</button>
          </div>
        </div>
      )}

      {/* ═══ PHASE: PHOTO CAPTURE ═══ */}
      {phase==="photo"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:punchAction==="out"?"#D06040":C.green}}>
              {punchAction==="out"?`👋 ${T2("Punch Out")} — ${picked.name}`:`✅ ${T2("PIN Verified")} — ${picked.name}`}
            </div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginTop:6}}>
              {punchAction==="out"?T2("Photo for punch-out verification"):T2("Look at the camera for attendance photo")}
            </div>
          </div>
          <div style={{position:"relative",width:280,height:210,margin:"0 auto 16px",borderRadius:16,overflow:"hidden",background:"#0A0A0F",border:"3px solid #C4A44A"}}>
            <video ref={vRef} style={{width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)"}} playsInline muted/>
            <canvas ref={cRef} style={{display:"none"}}/>
            {!camReady&&!camErr&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#C4A44A",fontSize:13}}>{T2("Starting camera…")}</div>}
            {camErr&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#D64545",fontSize:12,textAlign:"center",padding:20}}>{T2("Camera not available. Tap below to mark without photo.")}</div>}
            {/* Face guide overlay */}
            {camReady&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
              <div style={{width:140,height:180,border:"2px dashed rgba(196,164,74,.4)",borderRadius:"50%"}}/>
            </div>}
          </div>
          <button onClick={confirmAttendance} style={goldBtn}>
            {punchAction==="out"
              ?`👋 ${camReady?T2("Capture & Punch Out"):T2("Punch Out")}`
              :`📸 ${camReady?T2("Capture & Mark Attendance"):T2("Mark Attendance")}`}
          </button>
          <button onClick={()=>{stopCam();reset();}} style={{width:"100%",padding:"10px",borderRadius:10,background:"transparent",border:"1px solid #2A2824",color:"#8A8476",fontSize:12,cursor:"pointer",marginTop:8,minHeight:40}}>{T2("Cancel")}</button>
        </div>
      )}

      {/* ═══ PHASE: DONE ═══ */}
      {phase==="done"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>{punchAction==="out"?"👋":punchAction==="done_shift"?"🏁":"✅"}</div>
            <div style={{fontSize:22,fontWeight:700,color:punchAction==="out"?"#D06040":C.green,fontFamily:"var(--font-display)"}}>
              {punchAction==="out"?T2("Punch Out Recorded"):punchAction==="done_shift"?T2("Shift Complete"):T2("Punch In Recorded")}
            </div>
            <div style={{fontSize:16,color:C.text,marginTop:8,fontWeight:600}}>{picked.name}</div>
            <div style={{fontSize:12,color:"#5A5750",marginTop:4}}>{T2(picked.section)}</div>
            {/* Show punch-in and punch-out times */}
            {(()=>{
              const att=getStaffAtt(picked);
              return (
                <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:14}}>
                  {att&&<div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.green}}>{T2("Punch In")}</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.green}}>{att.time}</div>
                  </div>}
                  {(punchAction==="out"||att?.punchOut)&&<div style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:"#D06040"}}>{T2("Punch Out")}</div>
                    <div style={{fontSize:16,fontWeight:700,color:"#D06040"}}>{att?.punchOut||new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
                  </div>}
                  {punchAction==="done_shift"&&att&&att.punchOut&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.muted}}>{T2("Total Hours")}</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.text}}>{(()=>{
                      try{const [h1,m1]=att.time.split(":").map(Number);const [h2,m2]=(att.punchOut||"").split(":").map(Number);const diff=((h2*60+m2)-(h1*60+m1));return Math.floor(diff/60)+"h "+String(diff%60).padStart(2,"0")+"m";}catch(e){return"—";}
                    })()}</div>
                  </div>}
                </div>
              );
            })()}
            {photo&&<img src={photo} style={{width:120,height:90,borderRadius:12,objectFit:"cover",marginTop:14,border:`2px solid ${punchAction==="out"?"#D06040":C.green}`}}/>}
            <div style={{marginTop:16,fontSize:12,color:"#5A5750"}}>{T2("Returning in 4 seconds…")}</div>
          </div>
        </div>
      )}

      {/* ═══ PHASE: CREATE PIN (first login) ═══ */}
      {phase==="create_pin"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:36,marginBottom:8}}>🔑</div>
            <div style={{fontSize:18,fontWeight:700,color:C.gold}}>{T2("Create Your PIN")}</div>
            <div style={{fontSize:12,color:"#5A5750",marginTop:4}}>{picked.name} — {T2("First time login")}</div>
            <div style={{fontSize:11,color:"#8A8476",marginTop:8}}>{T2("Create a unique 4-digit PIN that only you know")}</div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("New PIN")} *</div>
            <input type="password" value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,"").slice(0,4))}
              placeholder="• • • •" autoFocus maxLength={4}
              style={{...inputStyle,textAlign:"center",fontSize:28,letterSpacing:16}}/>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("Confirm PIN")} *</div>
            <input type="password" value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,"").slice(0,4))}
              onKeyDown={e=>e.key==="Enter"&&saveNewPin()} placeholder="• • • •" maxLength={4}
              style={{...inputStyle,textAlign:"center",fontSize:28,letterSpacing:16}}/>
          </div>
          {pinError&&<div style={{background:"#201212",border:"1px solid #3A1E1E",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#D64545",marginBottom:12,textAlign:"center"}}>{pinError}</div>}
          <button onClick={saveNewPin} disabled={newPin.length<4||confirmPin.length<4}
            style={{...goldBtn,opacity:(newPin.length<4||confirmPin.length<4)?.4:1,cursor:(newPin.length<4||confirmPin.length<4)?"not-allowed":"pointer"}}>
            🔑 {T2("Save PIN & Continue")}
          </button>
          <button onClick={reset} style={{width:"100%",padding:"10px",borderRadius:10,background:"transparent",border:"1px solid #2A2824",color:"#8A8476",fontSize:12,cursor:"pointer",marginTop:8,minHeight:40}}>{T2("Cancel")}</button>
        </div>
      )}

      {/* ═══ PHASE: LEAVE APPLICATION ═══ */}
      {phase==="leave"&&picked&&(
        <div style={cardStyle}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:32,marginBottom:6}}>📋</div>
            <div style={{fontSize:18,fontWeight:700,color:"#F0ECE0"}}>{T2("Apply for Leave")}</div>
            <div style={{fontSize:12,color:"#5A5750"}}>{picked.name} · {T2(picked.section)}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("From")} *</div>
              <input type="date" value={leaveForm.from} onChange={e=>setLeaveForm(p=>({...p,from:e.target.value}))} style={inputStyle}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("To")} *</div>
              <input type="date" value={leaveForm.to} onChange={e=>setLeaveForm(p=>({...p,to:e.target.value}))} style={inputStyle}/>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#8A8476",marginBottom:4,fontWeight:600}}>{T2("Reason")}</div>
            <select value={leaveForm.reason} onChange={e=>setLeaveForm(p=>({...p,reason:e.target.value}))} style={inputStyle}>
              {["Personal","Medical","Family emergency","Casual"].map(r=><option key={r} value={r}>{T2(r)}</option>)}
            </select>
          </div>
          <button onClick={submitLeave} disabled={!leaveForm.from||!leaveForm.to}
            style={{...goldBtn,opacity:(!leaveForm.from||!leaveForm.to)?.4:1,cursor:(!leaveForm.from||!leaveForm.to)?"not-allowed":"pointer"}}>
            📋 {T2("Submit Leave Request")}
          </button>
          <div style={{fontSize:10,color:"#5A5750",textAlign:"center",marginTop:8}}>{T2("Requests go to Yatender for approval.")}</div>
          <button onClick={()=>setPhase("verify")} style={{width:"100%",padding:"10px",borderRadius:10,background:"transparent",border:"1px solid #2A2824",color:"#8A8476",fontSize:12,cursor:"pointer",marginTop:8,minHeight:40}}>← {T2("Back")}</button>
        </div>
      )}

      {/* ── Present today strip ── */}
      {(kioskStep==="dept"||kioskStep==="name")&&presentToday.length>0&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#12201A",borderTop:"1px solid #1E3A28",padding:"10px 24px",display:"flex",gap:12,alignItems:"center",overflowX:"auto"}}>
          <div style={{fontSize:11,color:"#4DAA6A",fontWeight:700,flexShrink:0}}>✅ {presentToday.length} {T2("Present")}:</div>
          {presentToday.slice(0,15).map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              {a.photo?<img src={a.photo} style={{width:24,height:24,borderRadius:8,objectFit:"cover"}}/>
                :<div style={{width:24,height:24,borderRadius:8,background:"#4DAA6A20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#4DAA6A"}}>✓</div>}
              <span style={{fontSize:10,color:"#4DAA6A"}}>{a.staffName}</span>
            </div>
          ))}
          {presentToday.length>15&&<span style={{fontSize:10,color:"#5A5750"}}>+{presentToday.length-15}</span>}
        </div>
      )}
    </div>
  );
}
function AutoReset({delay, onReset}){
  const [count,setCount] = useState(Math.round(delay/1000));
  useEffect(()=>{
    const t = setInterval(()=>setCount(c=>{ if(c<=1){clearInterval(t);onReset();return 0;} return c-1; }),1000);
    return()=>clearInterval(t);
  },[]);
  return <div style={{fontSize:13,color:"rgba(255,255,255,.3)",marginTop:4}}>Returning in {count}s…</div>;
}


export { KioskAttendance, AutoReset };
