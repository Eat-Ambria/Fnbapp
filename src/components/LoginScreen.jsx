// Ambria FnB — Login Screen
import React, { useState, useEffect } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { safeArr } from '../utils/helpers.js';
import { STAFF_LIST } from '../data/staffData.js';

function LoginScreen({ empDb, onLogin, lang="en" }) {
  const T2 = s => T(s, lang);
  const safeDb = safeArr(empDb);
  const [empId,  setEmpId]  = useState("");
  const [pin,    setPin]    = useState("");
  const [error,  setError]  = useState("");
  const [loading,setLoading]= useState(false);
  const [remember,setRemember]=useState(false);

  useEffect(()=>{
    try{
      const rid  = localStorage.getItem("ambria_emp_id");
      const rpin = localStorage.getItem("ambria_pin");
      const rrem = localStorage.getItem("ambria_remember");
      if(rrem==="true" && rid && rpin){
        const id   = rid.trim().toUpperCase();
        const pin2 = rpin.trim();
        const emp  = (empDb||[]).find(e=>(String(e.id||e.staffListId||e.staff_id||"")).toUpperCase()===id);
        if(emp && emp.active!==false && emp.is_active!==false && String(emp.pin)===pin2){
          const sl = STAFF_LIST.find(s=>s.name===emp.name);
          const rid = emp.id||emp.staffListId||emp.staff_id;
          onLogin({...emp, id:rid, staffListId:emp.staffListId||sl?.id||rid});
          return;
        }
        setEmpId(id); setPin(pin2); setRemember(true);
      }
    }catch(e){}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function handleLogin(){
    setError(""); setLoading(true);
    const id  = empId.trim().toUpperCase();
    const emp = safeDb.find(e=>(String(e.id||e.staffListId||e.staff_id||"")).toUpperCase()===id);
    if(!emp){setError("Employee ID not found.");setLoading(false);return;}
    if(emp.active===false||emp.is_active===false){setError("Account inactive. Contact manager.");setLoading(false);return;}
    if(String(emp.pin)!==pin.trim()){setError("Incorrect PIN.");setLoading(false);return;}
    try{
      if(remember){
        localStorage.setItem("ambria_emp_id",id);
        localStorage.setItem("ambria_pin",pin.trim());
        localStorage.setItem("ambria_remember","true");
      } else {
        localStorage.removeItem("ambria_emp_id");
        localStorage.removeItem("ambria_pin");
        localStorage.removeItem("ambria_remember");
      }
    }catch(e){}
    const sl = STAFF_LIST.find(s=>s.name===emp.name);
    const resolvedId = emp.id || emp.staffListId || emp.staff_id;
    onLogin({...emp, id: resolvedId, staffListId: emp.staffListId || sl?.id || resolvedId});
    setLoading(false);
  }

  return (
    <div style={{minHeight:"100vh",background:`radial-gradient(ellipse at 30% 20%, #FDFCF9 0%, ${C.bg} 50%, #F0EDE6 100%)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      {/* Background decorative elements */}
      <div style={{position:"absolute",top:"-20%",right:"-10%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle, rgba(212,180,74,.06) 0%, transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"-15%",left:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle, rgba(212,180,74,.05) 0%, transparent 70%)",pointerEvents:"none"}}/>

      <div className="fade-in-up" style={{background:`linear-gradient(160deg, #FFFFFF 0%, ${C.bg} 100%)`,borderRadius:24,padding:"48px 44px",width:400,boxShadow:`0 32px 80px rgba(0,0,0,.08), 0 0 1px ${C.glow}, inset 0 1px 0 rgba(255,255,255,.5)`,border:`1px solid ${C.border}`,position:"relative"}}>
        {/* Subtle top gold line */}
        <div style={{position:"absolute",top:0,left:"15%",right:"15%",height:1,background:`linear-gradient(90deg, transparent, ${C.gold}60, transparent)`}}/>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:64,height:64,borderRadius:16,background:`linear-gradient(135deg, ${C.gold}, #8B6A14)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:700,color:"#fff",margin:"0 auto 16px",boxShadow:`0 8px 24px rgba(212,180,74,.25)`,letterSpacing:1,fontFamily:"var(--font-display)"}}>A</div>
          <div style={{fontSize:26,fontWeight:600,color:C.text,fontFamily:"var(--font-display)",letterSpacing:2}}>{T2("Ambria FnB Operations")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:6,letterSpacing:1.5,textTransform:"uppercase",fontWeight:500}}>{T2("F&B Kitchen Operations")}</div>
        </div>

        {/* Form */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:1.2}}>{T2("Employee ID")}</div>
          <input
            value={empId}
            onChange={e=>setEmpId(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            placeholder={T2("e.g. AM001")}
            style={{width:"100%",padding:"13px 16px",borderRadius:12,border:`1.5px solid ${error?C.red:C.border}`,fontSize:15,color:C.text,background:C.bg,outline:"none",boxSizing:"border-box"}}
            autoFocus
          />
        </div>
        <div style={{marginBottom:22}}>
          <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:1.2}}>4-Digit PIN</div>
          <input
            type="password"
            value={pin}
            onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,4))}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            placeholder={T2("••••")}
            maxLength={4}
            style={{width:"100%",padding:"13px 16px",borderRadius:12,border:`1.5px solid ${error?C.red:C.border}`,fontSize:20,color:C.text,background:C.bg,outline:"none",boxSizing:"border-box",letterSpacing:8}}
          />
        </div>

        {error&&<div className="fade-in" style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.red,marginBottom:16}}>{error}</div>}

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24,cursor:"pointer"}} onClick={()=>setRemember(r=>!r)}>
          <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${remember?C.gold:C.border}`,background:remember?C.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {remember&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}
          </div>
          <span style={{fontSize:12,color:C.muted}}>{T2("Remember me on this device")}</span>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading||!empId||pin.length<4}
          style={{width:"100%",padding:"14px",borderRadius:14,background:(!empId||pin.length<4)?C.border:`linear-gradient(135deg, ${C.gold}, #A8891E)`,color:(!empId||pin.length<4)?C.muted:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:(!empId||pin.length<4)?"not-allowed":"pointer",fontFamily:"var(--font-display)",letterSpacing:1.5,boxShadow:(!empId||pin.length<4)?"none":`0 4px 16px rgba(212,180,74,.3)`}}>
          {loading?T2("Signing in…"):T2("Sign In →")}
        </button>

        <div style={{textAlign:"center",marginTop:20,fontSize:11,color:C.faint,letterSpacing:.5}}>
          Ambria Cuisines · Get Your Venue Events Pvt Ltd
        </div>

      </div>
    </div>
  );
}

export { LoginScreen };
