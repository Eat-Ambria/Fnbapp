// Ambria FnB — Shared UI components
// Extracted from App.jsx

// useRef/useState/useEffect are used by SelfieCapture below — without them it
// throws ReferenceError the moment it renders.
import React, { useRef, useState, useEffect } from "react";
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
      const msg = this.state.error?.message || (isHi?"अप्रत्याशित त्रुटि।":"An unexpected error occurred.");
      return (
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",padding:24}}>
          <div style={{maxWidth:460,width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,
            boxShadow:"0 1px 3px rgba(17,28,51,.09), 0 6px 14px rgba(17,28,51,.07), 0 18px 40px rgba(17,28,51,.09)",
            padding:"28px 28px 24px",textAlign:"left"}}>

            <div style={{display:"flex",alignItems:"center",gap:13,marginBottom:14}}>
              <span style={{width:44,height:44,borderRadius:13,flexShrink:0,background:C.amberBg,color:C.amber,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>⚠</span>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:-.1}}>
                  {isHi?"कुछ गलत हो गया":"Something went wrong"}
                </div>
                <div style={{fontSize:12.5,color:C.muted,marginTop:2}}>
                  {isHi?"यह स्क्रीन लोड नहीं हो पाई। आपका डेटा सुरक्षित है।":"This screen failed to load. Your data is safe."}
                </div>
              </div>
            </div>

            {/* The actual message, monospaced — it is usually a developer string
                and wrapping it in prose makes it harder to report accurately. */}
            <div style={{background:C.bg,border:`1px solid ${C.borderLight}`,borderRadius:10,padding:"11px 13px",
              fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",fontSize:12,lineHeight:1.55,
              color:C.text,wordBreak:"break-word",maxHeight:140,overflowY:"auto"}}>{msg}</div>

            <div style={{display:"flex",gap:10,marginTop:18,justifyContent:"flex-end"}}>
              <button onClick={()=>{this.setState({hasError:false,error:null,errorInfo:null});try{window.location.reload();}catch(e){}}}
                style={{padding:"10px 18px",borderRadius:11,background:C.surface,color:C.muted,border:`1px solid ${C.border}`,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                {isHi?"ऐप रिफ्रेश":"Refresh app"}
              </button>
              <button onClick={()=>this.setState({hasError:false,error:null,errorInfo:null})}
                style={{padding:"10px 20px",borderRadius:11,background:C.gold,color:"#fff",border:"1px solid transparent",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                {isHi?"पुनः प्रयास":"Try again"}
              </button>
            </div>
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

// No backdrop-filter here on purpose. It used to blur whatever sat behind the
// card, which washed the card's own contents out now that the page has artwork
// behind it — that was the "can't read it" problem, not the text colour.
// backgroundColor rather than the background shorthand: the shorthand resets
// background-image, which would erase the .kh-cardart artwork layered on top.
function Card({children,style={},className="",art=true}) {
  return <div className={"fade-in-up "+(art?"kh-cardart ":"")+className} style={{
    backgroundColor:C.surface,
    border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 22px",
    boxShadow:`0 1px 3px rgba(17,28,51,.09), 0 6px 14px rgba(17,28,51,.07), 0 18px 40px rgba(17,28,51,.09)`,
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
