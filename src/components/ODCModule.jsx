// Ambria FnB — ODC Module
import React, { useState } from "react";
import { C } from '../data/constants.js';
import { Card, Btn } from './SharedUI.jsx';

function ODCModule() {
  const [odcs]=useState([{id:`ODC-${CUR_YEAR}-01`,guest:"Malhotra Wedding",date:relDate(4),time:"7:30 PM",pax:800,distance:"12 km",special:"Generator required.",checks:{site:{},equipment:{},dispatch:{},onsite:{},teardown:{}},notes:"",inchargeAE:"Raghvendra"}]);
  const [sel]=useState(`ODC-${CUR_YEAR}-01`);
  const [phase,setPhase]=useState("site");
  const [checks,setChecks]=useState({});
  const [note,setNote]=useState("");
  const odc=odcs.find(o=>o.id===sel);
  const PC={site:C.green,equipment:C.amber,dispatch:C.blue,onsite:C.wine,teardown:C.purple};
  function toggle(ph,id){setChecks(p=>({...p,[`${ph}-${id}`]:!p[`${ph}-${id}`]}));}
  function pct(ph){const items=ODC_CL[ph];return Math.round(items.filter(c=>checks[`${ph}-${c.id}`]).length/items.length*100);}
  const overallPct=Math.round(Object.keys(ODC_CL).reduce((a,ph)=>a+(ODC_CL[ph].filter(c=>checks[`${ph}-${c.id}`]).length),0)/Object.keys(ODC_CL).reduce((a,ph)=>a+ODC_CL[ph].length,0)*100);
  if(!odc) return null;
  return (
    <div>
      <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:4,fontFamily:"var(--font-display)"}}>🏕 Outdoor Catering</div>
      <div style={{background:C.wineBg,border:`1.5px solid ${C.wineBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
        <Avatar name="Gopal" size={36} index={0}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.gold}}>Gopal — ODC Lead</div><div style={{fontSize:11,color:C.gold,opacity:.8}}>On ODC day venue rounds suspended.</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:12,color:C.muted}}>AP Anchor</div><div style={{fontSize:12,fontWeight:600,color:C.text}}>Yatender</div></div>
      </div>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{odc.guest}</div><div style={{fontSize:11,color:C.muted}}>{odc.date} · {odc.time} · {odc.pax} pax · {odc.distance}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:700,color:C.gold}}>{overallPct}%</div><div style={{fontSize:11,color:C.muted}}>overall</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{background:C.wineBg,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:11,color:C.gold,fontWeight:600}}>LEAD</div><div style={{fontSize:12,fontWeight:600,color:C.gold}}>Gopal</div></div>
          <div style={{background:C.amberBg,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:11,color:C.amber,fontWeight:600}}>AE IN-CHARGE</div><div style={{fontSize:12,fontWeight:600,color:C.amber}}>{odc.inchargeAE}</div></div>
        </div>
        <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
          {Object.keys(ODC_CL).map(p=>{const p2=pct(p);const col=PC[p];const active=phase===p;return(
            <button key={p} onClick={()=>setPhase(p)} style={{padding:"6px 12px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",background:active?col:"transparent",color:active?"#fff":C.muted,border:`1.5px solid ${active?col:C.border}`,display:"flex",alignItems:"center",gap:3}}>
              {ODC_PL[p]}<span style={{fontSize:11,padding:"1px 5px",borderRadius:10,background:active?"rgba(255,255,255,.25)":p2===100?C.greenBg:C.bg,color:active?"#fff":p2===100?C.green:C.muted}}>{p2}%</span>
            </button>
          );})}
        </div>
        <div style={{height:8,background:C.border,borderRadius:2,marginBottom:10,overflow:"hidden"}}><div style={{height:"100%",width:`${pct(phase)}%`,background:PC[phase],borderRadius:2,transition:"width .3s"}}/></div>
        {ODC_CL[phase].map(item=>{const done=!!checks[`${phase}-${item.id}`];return(
          <label key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}}>
            <input type="checkbox" checked={done} onChange={()=>toggle(phase,item.id)} style={{width:20,height:20,accentColor:PC[phase],cursor:"pointer"}}/>
            <span style={{fontSize:12,color:done?C.muted:C.text,textDecoration:done?"line-through":"none",flex:1}}>{item.label}</span>
            {done&&<Chip label="✓" color={C.green} bg={C.greenBg} size={10}/>}
          </label>
        );})}
        <div style={{marginTop:10}}><div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:4}}>Field notes</div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Site observations…" style={{width:"100%",padding:"8px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,resize:"none",height:60,fontFamily:"inherit",color:C.text,background:C.surface,boxSizing:"border-box"}}/></div>
      </Card>
    </div>
  );
}

// ─── EQUIPMENT & STORE ───────────────────────────────────────────



export { ODCModule };
