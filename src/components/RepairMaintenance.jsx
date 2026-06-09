// Ambria FnB — Repair & Maintenance
import React, { useState, useEffect } from "react";
import { C, AMBRIA_VENUES } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr } from '../utils/helpers.js';
import { Card, Btn, Chip } from './SharedUI.jsx';
import { dbLoad, dbUpsert } from '../lib/db.js';

function RepairMaintenance({lang="en", currentUser=null, currentDept="kitchen"}) {
  const T2 = s => T(s, lang);

  // ─── Master config ───────────────────────────────────────────────
  const ASSIGN_POOL = [
    {id:"akhtar",     name:"Akhtar",        role:"Equipment Servicing", dept:"maintenance", icon:"🔧", color:"#185FA5", phone:"98100-10001"},
    {id:"rajender",   name:"Rajender Chef", role:"Equipment Purchasing",dept:"maintenance", icon:"🛒", color:"#B05A10", phone:"98100-10002"},
    {id:"gopal",      name:"Gopal",         role:"Quality / Operations",dept:"kitchen",     icon:"📋", color:"#1A7A42", phone:"98100-10003"},
    {id:"yatender",   name:"Yatender",      role:"AP Base Kitchen",     dept:"kitchen",     icon:"🏠", color:C.gold,    phone:"98100-10004"},
    {id:"lokesh",     name:"Lokesh",        role:"Chinese Section",     dept:"kitchen",     icon:"🥢", color:"#C084FC", phone:"98100-10005"},
    {id:"pushpander", name:"Pushpander",    role:"Transport",           dept:"transport",   icon:"🚛", color:C.teal,    phone:"98100-10006"},
    {id:"self",       name:"Self / Manager",role:"Self-assigned",       dept:"all",         icon:"👤", color:C.muted,   phone:""},
  ];
  const CATEGORIES = [
    {v:"Gas & Burner",         icon:"🔥"}, {v:"Refrigeration",    icon:"❄️"},
    {v:"Exhaust & Chimney",    icon:"💨"}, {v:"Tandoor",          icon:"🫓"},
    {v:"Electrical",           icon:"⚡"}, {v:"Plumbing",         icon:"🚿"},
    {v:"Utensils & Crockery",  icon:"🍽"}, {v:"Vehicle",          icon:"🚛"},
    {v:"Furniture & Civil",    icon:"🪑"}, {v:"IT / Software",    icon:"💻"},
    {v:"Other",                icon:"📦"},
  ];
  const DEPT_LABELS = {kitchen:"Kitchen",service:"Service",crockery:"Crockery",beverages:"Beverages",transport:"Transport",odc:"ODC",management:"Management"};
  const PRI = [{v:"Low",c:C.green},{v:"Medium",c:C.amber},{v:"High",c:C.red},{v:"Urgent",c:"#E05030"}];
  const STATUS_FLOW = ["Open","In Progress","Pending Approval","Resolved","Closed"];
  const STATUS_COLORS = {"Open":C.red,"In Progress":C.amber,"Pending Approval":"#8A70C8","Resolved":C.green,"Closed":C.faint};
  const VENUES_R = ["Ambria Pushpanjali","Ambria Exotica","Manaktala Farm","Ambria Restro","All Properties"];

  const TICKETS_INIT = [
    {id:"RM-001",title:"Tandoor #2 clay lining cracked",cat:"Tandoor",venue:"Ambria Pushpanjali",priority:"High",assignTo:"akhtar",status:"In Progress",dept:"kitchen",createdBy:"Lokesh",date:relDate(-2),notes:"Crack visible on inner wall. Not safe for use above 200°C.",updates:[{by:"Akhtar",date:relDate(-1),msg:"Ordered new clay lining. ETA 2 days."}]},
    {id:"RM-002",title:"Walk-in fridge compressor noise",cat:"Refrigeration",venue:"Ambria Pushpanjali",priority:"Urgent",assignTo:"akhtar",status:"Open",dept:"kitchen",createdBy:"Bipin",date:relDate(-1),notes:"Loud grinding noise from compressor. Temperature fluctuating.",updates:[]},
    {id:"RM-003",title:"Chinese wok burner low flame",cat:"Gas & Burner",venue:"Ambria Pushpanjali",priority:"Medium",assignTo:"akhtar",status:"Open",dept:"kitchen",createdBy:"Lokesh",date:TODAY,notes:"Wok station #3 flame too low for stir-fry. Gas pressure issue.",updates:[]},
    {id:"RM-004",title:"Need 20 new copper handi",cat:"Utensils & Crockery",venue:"All Properties",priority:"Low",assignTo:"rajender",status:"Pending Approval",dept:"crockery",createdBy:"Gopal",date:relDate(-3),notes:"Current copper handis dented and discolored. Need for luxury functions.",updates:[{by:"Rajender",date:relDate(-2),msg:"Got 3 vendor quotes. Best: ₹850/pc from Rewari supplier."}]},
    {id:"RM-005",title:"Fridge truck AC not cooling properly",cat:"Vehicle",venue:"All Properties",priority:"High",assignTo:"akhtar",status:"In Progress",dept:"transport",createdBy:"Abhi",date:relDate(-1),notes:"Temperature not holding below 4°C during transport.",updates:[{by:"Akhtar",date:TODAY,msg:"Mechanic visiting tomorrow morning. Gas refill needed."}]},
    {id:"RM-006",title:"Service station exhaust fan broken",cat:"Exhaust & Chimney",venue:"Ambria Exotica",priority:"Medium",assignTo:"akhtar",status:"Open",dept:"service",createdBy:"Raghvendra",date:TODAY,notes:"Fan not running. Kitchen getting smoky during service.",updates:[]},
  ];
  const [tickets, setTickets] = useState(TICKETS_INIT);
  useEffect(()=>{
    if(!supabase) return;
    supabase.from("repair_tickets").select("*").order("created_at",{ascending:false}).then(({data})=>{
      if(data && data.length > 0)
        setTickets(data.map(t=>({...t,assignTo:t.assign_to,createdBy:t.created_by,updates:t.updates||[]})));
    });
  },[]);

  function syncTicket(t){
    if(!supabase) return;
    supabase.from("repair_tickets").upsert({
      id:t.id, title:t.title, cat:t.cat, venue:t.venue, priority:t.priority,
      assign_to:t.assignTo, status:t.status, dept:t.dept,
      created_by:t.createdBy, date:t.date, notes:t.notes, updates:t.updates||[],
    },{onConflict:"id"}).catch(e=>console.error("ticket sync:",e));
  }

  const [showNew, setShowNew]   = useState(false);
  const [selId, setSelId]       = useState(null);
  const [updMsg, setUpdMsg]     = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDept, setFilterDept]     = useState("All");
  const [filterAssign, setFilterAssign] = useState("All");
  const [sortBy, setSortBy]     = useState("date"); // "date" | "priority"
  const [newT, setNewT] = useState({
    title:"", cat:"Gas & Burner", venue:"Ambria Pushpanjali",
    priority:"Medium", assignTo:"akhtar", dept:currentDept||"kitchen", notes:"",
  });

  function addTicket(){
    if(!newT.title.trim()) return;
    const id=`RM-${String(Date.now()).slice(-4)}`;
    const t={id,title:newT.title.trim(),cat:newT.cat,venue:newT.venue,priority:newT.priority,
      assignTo:newT.assignTo,status:"Open",dept:newT.dept,
      createdBy:currentUser?.name||"Staff",date:TODAY,notes:newT.notes,updates:[]};
    setTickets(p=>[t,...p]);
    syncTicket(t);
    setNewT({title:"",cat:"Gas & Burner",venue:"Ambria Pushpanjali",priority:"Medium",assignTo:"akhtar",dept:currentDept||"kitchen",notes:""});
    setShowNew(false);
  }
  function updStatus(id, st){
    setTickets(p=>p.map(t=>{if(t.id!==id)return t;const u={...t,status:st};syncTicket(u);return u;}));
  }
  function addUpdate(id){
    if(!updMsg.trim()) return;
    setTickets(p=>p.map(t=>{if(t.id!==id)return t;const u={...t,updates:[...t.updates,{by:currentUser?.name||"Staff",date:TODAY,msg:updMsg.trim()}]};syncTicket(u);return u;}));
    setUpdMsg("");
  }
  function reassign(id, assignTo){
    setTickets(p=>p.map(t=>{if(t.id!==id)return t;const u={...t,assignTo};syncTicket(u);return u;}));
  }

  // Filtering + sorting
  let visible = tickets.filter(t=>
    (filterStatus==="All"||t.status===filterStatus)&&
    (filterDept==="All"||t.dept===filterDept)&&
    (filterAssign==="All"||t.assignTo===filterAssign)
  );
  if(sortBy==="priority"){
    const pri_order={"Urgent":0,"High":1,"Medium":2,"Low":3};
    visible=[...visible].sort((a,b)=>(pri_order[a.priority]||3)-(pri_order[b.priority]||3));
  } else {
    visible=[...visible].sort((a,b)=>b.date.localeCompare(a.date));
  }

  const openCt   = tickets.filter(t=>t.status==="Open").length;
  const ipCt     = tickets.filter(t=>t.status==="In Progress").length;
  const urgCt    = tickets.filter(t=>t.priority==="Urgent"||t.priority==="High").length;
  const resolCt  = tickets.filter(t=>t.status==="Resolved"||t.status==="Closed").length;

  const fld={width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box",minHeight:40};

  return(
    <div>
      {/* ── Header ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.4}}>🔧 {T2("Repair & Maintenance")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{T2("Shared pool — all departments")}</div>
        </div>
        {hasPermission(currentUser,"repair.create")&&<button onClick={()=>setShowNew(!showNew)} style={{padding:"11px 18px",borderRadius:12,background:showNew?C.surface:`linear-gradient(135deg,${C.gold},#A8891E)`,color:showNew?C.muted:"#0A0908",border:showNew?`1px solid ${C.border}`:"none",fontSize:13,fontWeight:700,cursor:"pointer",minHeight:44}}>
          {showNew?"✕ Cancel":"+ "+T2("New Request")}
        </button>}
      </div>

      {/* ── Stats tiles ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[{l:T2("Open"),v:openCt,c:C.red,bg:C.redBg},{l:T2("In Progress"),v:ipCt,c:C.amber,bg:C.amberBg},{l:T2("High/Urgent"),v:urgCt,c:"#E05030",bg:C.redBg},{l:T2("Resolved"),v:resolCt,c:C.green,bg:C.greenBg}].map(s=>(
          <div key={s.l} onClick={()=>setFilterStatus(s.l===T2("Open")?"Open":s.l===T2("In Progress")?"In Progress":s.l===T2("High/Urgent")?"All":s.l===T2("Resolved")?"Resolved":"All")}
            style={{background:s.bg,borderRadius:12,padding:"12px 10px",textAlign:"center",border:`1px solid ${s.c}20`,cursor:"pointer"}}>
            <div style={{fontSize:22,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:10,color:s.c,fontWeight:600,marginTop:4}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── New Request Form ── */}
      {showNew&&(
        <Card style={{marginBottom:14,padding:"18px 20px",border:`2px solid ${C.goldBorder}`,background:C.goldBg+"80"}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:12}}>🔧 {T2("New Repair / Maintenance Request")}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Issue Title")} *</div>
              <input value={newT.title} onChange={e=>setNewT(p=>({...p,title:e.target.value}))} placeholder={lang==="hi"?"समस्या का विवरण लिखें…":"e.g. Tandoor #2 clay lining cracked"} style={{...fld,fontSize:13}} autoFocus/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Category")}</div>
              <select value={newT.cat} onChange={e=>setNewT(p=>({...p,cat:e.target.value}))} style={fld}>{CATEGORIES.map(c=><option key={c.v} value={c.v}>{c.icon} {T2(c.v)}</option>)}</select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Venue")}</div>
              <select value={newT.venue} onChange={e=>setNewT(p=>({...p,venue:e.target.value}))} style={fld}>{VENUES_R.map(v=><option key={v}>{v}</option>)}</select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Priority")}</div>
              <select value={newT.priority} onChange={e=>setNewT(p=>({...p,priority:e.target.value}))} style={fld}>{PRI.map(p=><option key={p.v}>{T2(p.v)}</option>)}</select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Raise From Dept")}</div>
              <select value={newT.dept} onChange={e=>setNewT(p=>({...p,dept:e.target.value}))} style={fld}>
                {Object.entries(DEPT_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Assign To")}</div>
              <select value={newT.assignTo} onChange={e=>setNewT(p=>({...p,assignTo:e.target.value}))} style={fld}>
                {ASSIGN_POOL.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name} — {a.role}</option>)}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{T2("Notes")}</div>
              <textarea value={newT.notes} onChange={e=>setNewT(p=>({...p,notes:e.target.value}))} placeholder={lang==="hi"?"विवरण लिखें…":"Describe the issue in detail…"} rows={2} style={{...fld,resize:"none",height:60}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button onClick={addTicket} disabled={!newT.title.trim()} style={{padding:"12px 24px",borderRadius:12,background:newT.title.trim()?`linear-gradient(135deg,${C.gold},#A8891E)`:"#333",color:newT.title.trim()?"#0A0908":C.faint,border:"none",fontSize:13,fontWeight:700,cursor:newT.title.trim()?"pointer":"not-allowed",minHeight:44}}>
              ✓ {T2("Submit Request")}
            </button>
            <div style={{fontSize:11,color:C.faint}}>{T2("Ticket will be visible to all departments")}</div>
          </div>
        </Card>
      )}

      {/* ── Filters + Sort ── */}
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        {/* Status filter */}
        <div style={{display:"flex",gap:4,overflowX:"auto"}}>
          {["All",...STATUS_FLOW].map(f=>(
            <button key={f} onClick={()=>setFilterStatus(f)} style={{padding:"7px 12px",borderRadius:10,fontSize:11,fontWeight:filterStatus===f?700:400,cursor:"pointer",whiteSpace:"nowrap",minHeight:36,background:filterStatus===f?C.gold+"20":"transparent",color:filterStatus===f?C.gold:C.muted,border:`1px solid ${filterStatus===f?C.gold+"60":C.border}`}}>{T2(f)}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          {/* Sort */}
          <button onClick={()=>setSortBy(s=>s==="date"?"priority":"date")} style={{padding:"7px 12px",borderRadius:10,fontSize:11,cursor:"pointer",background:C.surface,border:`1px solid ${C.border}`,color:C.muted,minHeight:36}}>
            {sortBy==="date"?"⏱ Date":"⚠ Priority"}
          </button>
        </div>
      </div>

      {/* Dept filter pills */}
      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {["All",...Object.keys(DEPT_LABELS)].map(d=>(
          <button key={d} onClick={()=>setFilterDept(d)} style={{padding:"5px 10px",borderRadius:8,fontSize:10,fontWeight:filterDept===d?700:400,cursor:"pointer",background:filterDept===d?C.purple+"20":"transparent",color:filterDept===d?C.purple:C.faint,border:`1px solid ${filterDept===d?C.purple+"50":C.borderLight}`}}>
            {d==="All"?T2("All Depts"):(DEPT_LABELS[d]||d)}
          </button>
        ))}
        <div style={{marginLeft:4,display:"flex",gap:4}}>
          {ASSIGN_POOL.slice(0,5).map(a=>(
            <button key={a.id} onClick={()=>setFilterAssign(filterAssign===a.id?"All":a.id)} style={{padding:"5px 10px",borderRadius:8,fontSize:10,fontWeight:filterAssign===a.id?700:400,cursor:"pointer",background:filterAssign===a.id?a.color+"20":"transparent",color:filterAssign===a.id?a.color:C.faint,border:`1px solid ${filterAssign===a.id?a.color+"50":C.borderLight}`}}>
              {a.icon} {a.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ticket list ── */}
      {visible.length===0&&<div style={{textAlign:"center",padding:28,background:C.surface,borderRadius:12,color:C.muted,fontSize:12}}>{T2("No tickets found")}</div>}
      {visible.map(tk=>{
        const isExp=selId===tk.id;
        const assign=ASSIGN_POOL.find(a=>a.id===tk.assignTo)||{name:tk.assignTo,icon:"👤",color:C.muted};
        const cat=CATEGORIES.find(c=>c.v===tk.cat)||{icon:"📦",v:tk.cat};
        const pri=PRI.find(p=>p.v===tk.priority)||{c:C.muted};
        const sc=STATUS_COLORS[tk.status]||C.muted;
        const daysSince=Math.round((new Date(TODAY+"T00:00")-new Date(tk.date+"T00:00"))/(864e5));
        return(
          <Card key={tk.id} style={{marginBottom:8,padding:0,overflow:"hidden",border:`1.5px solid ${isExp?pri.c+"40":C.border}`}}>
            {/* Card header */}
            <div onClick={()=>setSelId(isExp?null:tk.id)} style={{padding:"13px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:40,height:40,borderRadius:10,background:pri.c+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:C.faint,fontWeight:600}}>{tk.id}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,background:pri.c+"18",color:pri.c}}>{T2(tk.priority)}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:6,background:sc+"18",color:sc}}>{T2(tk.status)}</span>
                  <span style={{fontSize:10,padding:"2px 7px",borderRadius:6,background:C.purple+"18",color:C.purple}}>{DEPT_LABELS[tk.dept]||tk.dept}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>{tk.title}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11,color:C.muted}}>
                  <span>📍 {tk.venue}</span>
                  <span style={{color:assign.color,fontWeight:600}}>{assign.icon} {assign.name}</span>
                  <span>🧑 {tk.createdBy}</span>
                  <span>{daysSince===0?T2("Today"):daysSince===1?T2("Yesterday"):daysSince+"d ago"}</span>
                </div>
              </div>
              <span style={{fontSize:14,color:C.muted,transform:isExp?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▾</span>
            </div>

            {/* Expanded detail */}
            {isExp&&(
              <div style={{borderTop:`1px solid ${C.border}`,background:C.bg}}>
                {/* Notes */}
                {tk.notes&&<div style={{padding:"10px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>📋 {T2("Notes")}</div>
                  <div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{tk.notes}</div>
                </div>}

                {/* Reassign */}
                {hasPermission(currentUser,"repair.reassign")&&(
                <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>🔄 {T2("Reassign")}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {ASSIGN_POOL.map(a=>(
                      <button key={a.id} onClick={()=>reassign(tk.id,a.id)}
                        style={{padding:"7px 12px",borderRadius:10,fontSize:11,fontWeight:tk.assignTo===a.id?700:400,cursor:"pointer",
                          background:tk.assignTo===a.id?a.color+"20":"transparent",color:tk.assignTo===a.id?a.color:C.muted,
                          border:`1.5px solid ${tk.assignTo===a.id?a.color:C.border}`,minHeight:36}}>
                        {a.icon} {a.name.split(" ")[0]}
                        {tk.assignTo===a.id&&<span style={{fontSize:9,marginLeft:3}}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
                )}

                {/* Status change */}
                {hasPermission(currentUser,"repair.change_status")&&(
                <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>📊 {T2("Update Status")}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {STATUS_FLOW.map(st=>{
                      const stc=STATUS_COLORS[st]||C.muted;
                      return(
                        <button key={st} onClick={()=>updStatus(tk.id,st)}
                          style={{padding:"7px 14px",borderRadius:10,fontSize:11,fontWeight:tk.status===st?700:400,cursor:"pointer",
                            background:tk.status===st?stc+"20":"transparent",color:tk.status===st?stc:C.muted,
                            border:`1.5px solid ${tk.status===st?stc:C.border}`,minHeight:36}}>
                          {tk.status===st?"● ":""}{T2(st)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* Updates timeline */}
                {tk.updates.length>0&&(
                  <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.8}}>📅 {T2("Timeline")}</div>
                    {tk.updates.map((u,ui)=>(
                      <div key={ui} style={{display:"flex",gap:10,marginBottom:8,paddingLeft:10,borderLeft:`2px solid ${C.gold}`}}>
                        <div>
                          <div style={{fontSize:11,fontWeight:700,color:C.gold}}>{u.by} <span style={{color:C.faint,fontWeight:400}}>· {u.date}</span></div>
                          <div style={{fontSize:12,color:C.text,marginTop:2,lineHeight:1.5}}>{u.msg}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add update */}
                <div style={{padding:"10px 16px",display:"flex",gap:8}}>
                  <input value={updMsg} onChange={e=>setUpdMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addUpdate(tk.id)} placeholder={T2("Add update, comment or action taken…")}
                    style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:40}}/>
                  <button onClick={()=>addUpdate(tk.id)} disabled={!updMsg.trim()} style={{padding:"10px 16px",borderRadius:10,background:updMsg.trim()?`linear-gradient(135deg,${C.gold},#A8891E)`:"#333",color:updMsg.trim()?"#0A0908":C.faint,border:"none",fontSize:12,fontWeight:700,cursor:updMsg.trim()?"pointer":"not-allowed",minHeight:40}}>
                    {T2("Post")}
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}


export { RepairMaintenance };
