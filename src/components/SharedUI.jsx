// Ambria FnB — Shared UI components
// Extracted from App.jsx

import React from "react";
import { C, AVATAR_COLORS, SECTION_META } from '../data/constants.js';
import { T } from '../data/translations.js';

class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={hasError:false,error:null,errorInfo:null}; }
  static getDerivedStateFromError(e){ return {hasError:true,error:e}; }
  componentDidCatch(e,info){
    console.error("Ambria App Error:",e,info);
    this.setState({errorInfo:info});
    // Log to crash report (future: send to server)
    // crash logged to console
  }
  render(){
    if(this.state.hasError){
      const lang = this.props.lang||"en";
      const isHi = lang==="hi";
      return (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",padding:40,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
          <div style={{fontSize:18,fontWeight:700,color:C.gold,marginBottom:8}}>{isHi?"कुछ गलत हो गया":"Something went wrong"}</div>
          <div style={{fontSize:12,color:"#888",marginBottom:8,maxWidth:400}}>{this.state.error?.message||"An unexpected error occurred."}</div>
          <div style={{fontSize:10,color:"#aaa",marginBottom:20}}>{isHi?"चिंता न करें, आपका डेटा सुरक्षित है।":"Don't worry, your data is safe."}</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>this.setState({hasError:false,error:null,errorInfo:null})} style={{padding:"10px 24px",borderRadius:9,background:"#6B1818",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>↺ {isHi?"पुनः प्रयास":"Retry"}</button>
            <button onClick={()=>{this.setState({hasError:false,error:null,errorInfo:null});try{window.location.reload();}catch(e){}}} style={{padding:"10px 24px",borderRadius:9,background:"#F2F1EE",color:"#444",border:"1px solid #ddd",fontSize:13,cursor:"pointer"}}>{isHi?"ऐप रिफ्रेश":"Refresh App"}</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Avatar({name,size=34,index=0}) {
  const bg=AVATAR_COLORS[index%AVATAR_COLORS.length];
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.38,fontWeight:700,color:"#fff",flexShrink:0,fontFamily:"var(--font-display)"}}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function DonutChart({pct=0,color="#2B8A50",size=80,icon="🍽️"}) {
  const r=30, circ=2*Math.PI*r;
  const dash=circ*(pct/100), gap=circ-dash;
  return (
    <div style={{position:"relative",width:size,height:size,margin:"0 auto"}}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#2A2824" strokeWidth="7"/>
        {pct>0&&<circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
          transform="rotate(-90 40 40)" style={{transition:"stroke-dasharray .5s"}}/>}
        <circle cx="40" cy="40" r="3" fill={color} opacity={pct>0?1:0}
          transform={`rotate(${(pct/100)*360-90} 40 40) translate(30 0)`}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
        <span style={{fontSize:14}}>{icon}</span>
        <span style={{fontSize:12,fontWeight:700,color:pct>0?color:C.muted}}>{pct}%</span>
      </div>
    </div>
  );
}

function Chip({label,color=C.muted,bg=C.darkCard,size=11}) {
  return <span style={{display:"inline-block",fontSize:size,fontWeight:500,padding:"2px 9px",borderRadius:20,background:bg,color,whiteSpace:"nowrap"}}>{label}</span>;
}

function STag({name}) {
  const m=SECTION_META[name]||{bg:C.darkCard,color:C.muted,icon:""};
  return <span style={{fontSize:11,fontWeight:500,padding:"2px 9px",borderRadius:20,background:m.bg,color:m.color,border:`1px solid ${m.color}20`}}>{m.icon} {name}</span>;
}

function Card({children,style={},className=""}) {
  return <div className={"fade-in-up "+className} style={{
    background:`linear-gradient(145deg, ${C.surface} 0%, ${C.darkCard} 100%)`,
    border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 22px",
    boxShadow:`0 8px 32px ${C.shadow}, 0 0 1px ${C.glow}, inset 0 1px 0 rgba(255,255,255,.03)`,
    backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",
    transition:"all .3s cubic-bezier(.23,1,.32,1)",
    ...style
  }}>{children}</div>;
}

function Btn({children,onClick,color=C.gold,textColor="#0E0D0B",border="none",style={}}) {
  return <button onClick={onClick} style={{
    padding:"9px 18px",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",
    background:color,color:textColor,border,letterSpacing:.4,
    boxShadow:`0 2px 8px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.15)`,
    transition:"all .25s cubic-bezier(.23,1,.32,1)",
    minHeight:40,
    ...style
  }}>{children}</button>;
}

function SectionHeader({icon,title}) {
  return <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14,display:"flex",alignItems:"center",gap:8,fontFamily:"var(--font-display)",letterSpacing:.5}}>{icon} {title}</div>;
}

// ─── SELFIE CAPTURE ────────────────────────────────────────────

function SelfieCapture({onCapture,onRetake,captured,lang="en"}) {
  const T2 = s => T(s, lang);
  const vRef=useRef(null), cRef=useRef(null);
  const [streaming,setStreaming]=useState(false);
  const [err,setErr]=useState(null);
  const [loading,setLoading]=useState(false);
  useEffect(()=>()=>{vRef.current?.srcObject?.getTracks().forEach(t=>t.stop());},[]);
  async function start(){
    setLoading(true);setErr(null);
    try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"}});vRef.current.srcObject=s;await vRef.current.play();setStreaming(true);}
    catch{setErr("Camera access denied.");}
    setLoading(false);
  }
  function snap(){
    const cv=cRef.current,vd=vRef.current;
    cv.width=vd.videoWidth;cv.height=vd.videoHeight;
    cv.getContext("2d").drawImage(vd,0,0);
    vd.srcObject?.getTracks().forEach(t=>t.stop());setStreaming(false);
    onCapture(cv.toDataURL("image/jpeg",.8));
  }
  if(captured) return (
    <div style={{textAlign:"center"}}>
      <img src={captured} alt="selfie" style={{width:160,height:120,objectFit:"cover",borderRadius:10,border:`2px solid ${C.greenBorder}`,marginBottom:8}}/>
      <div><Chip label="✓ Photo captured" color={C.green} bg={C.greenBg}/></div>
      <button onClick={()=>{onRetake();start();}} style={{marginTop:8,fontSize:11,background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.muted}}>{T2("Retake")}</button>
    </div>
  );
  return (
    <div style={{textAlign:"center"}}>
      <div style={{width:160,height:120,borderRadius:10,overflow:"hidden",background:C.bg,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
        <video ref={vRef} style={{width:"100%",height:"100%",objectFit:"cover",display:streaming?"block":"none"}}/>
        {!streaming&&<div style={{color:C.muted,fontSize:13}}>📷<br/>{T2("Camera")}</div>}
      </div>
      <canvas ref={cRef} style={{display:"none"}}/>
      {err&&<div style={{fontSize:11,color:C.red,marginBottom:6}}>{err}</div>}
      {!streaming
        ?<Btn onClick={start} style={{fontSize:12}}>{loading?"Starting…":"Open Camera"}</Btn>
        :<Btn onClick={snap} color={C.green} style={{fontSize:12}}>📸 Capture</Btn>
      }
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────
// ─── LOGIN SCREEN ─────────────────────────────────────────────────
// ─── LOGIN SCREEN ─────────────────────────────────────────────────

export { ErrorBoundary, Avatar, DonutChart, Chip, STag, Card, Btn, SectionHeader, SelfieCapture };
