// Ambria FnB — Vendor Directory
import React, { useState } from "react";
import { C, VENDOR_CATEGORIES, SECTIONS } from '../data/constants.js';
import { T } from '../data/translations.js';
import { Card, Btn, Chip, Avatar, STag } from './SharedUI.jsx';
import { TODAY } from '../utils/helpers.js';

function VendorDirectory({lang="en"}) {
  const T2 = s => T(s, lang||"en");
  const [vendors,setVendors] = useState([
    {id:"VD001",name:"Ramesh Kumar",    cat:"Outside Chef",      section:"Indian Curries",phone:"98100-11111",email:"",address:"Dwarka Sec 7",rating:5,notes:"Reliable, 5+ yrs",addedBy:"Yatender",date:"2023-06-01",active:true},
    {id:"VD002",name:"Anil Yadav",      cat:"Outside Chef",      section:"Tandoor",       phone:"98200-22222",email:"",address:"Palam",         rating:5,notes:"Best tandoor",      addedBy:"Yatender",date:"2023-08-15",active:true},
    {id:"VD003",name:"Suresh Tiwari",   cat:"Outside Chef",      section:"Beverages",     phone:"98300-33333",email:"",address:"Dwarka Sec 10", rating:4,notes:"Good for beverages",addedBy:"Yatender",date:"2024-01-10",active:true},
    {id:"VD004",name:"Krishna Vegetables",cat:"Vegetable Supplier",section:"—",           phone:"98400-44444",email:"",address:"Azadpur Mandi", rating:4,notes:"Fresh, AM delivery",addedBy:"Abhi",   date:"2024-02-01",active:true},
    {id:"VD005",name:"Garg Dairy",      cat:"Dairy Supplier",    section:"—",             phone:"98500-55555",email:"",address:"Kapashera",      rating:4,notes:"Daily 5AM supply",  addedBy:"Abhi",   date:"2024-03-10",active:true},
  ]);
  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState("All");
  const [showAdd,     setShowAdd]     = useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [editId,      setEditId]      = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [form,        setForm]        = useState({name:"",cat:"Outside Chef",section:"—",phone:"",email:"",address:"",rating:5,notes:"",addedBy:"Yatender"});

  const cats     = ["All",...VENDOR_CATEGORIES];
  const filtered = vendors.filter(v=>(v.name.toLowerCase().includes(search.toLowerCase())||v.cat.includes(search))&&(catFilter==="All"||v.cat===catFilter));

  function nextId(){ const nums=vendors.map(v=>+(v.id.replace("VD",""))).filter(Boolean); return "VD"+String(Math.max(0,...nums)+1).padStart(3,"0"); }
  function addVendor(){ if(!form.name||!form.phone) return; setVendors(p=>[...p,{...form,id:nextId(),date:TODAY,active:true}]); setForm({name:"",cat:"Outside Chef",section:"—",phone:"",email:"",address:"",rating:5,notes:"",addedBy:"Yatender"}); setShowAdd(false); }

  const SECTION_OPTS = ["—",...SECTIONS];
  const fld = {width:"100%",padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:11,color:C.text,background:C.surface,boxSizing:"border-box"};

  return (
    <div>
      {/* Delete confirm */}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:14,padding:"28px 32px",maxWidth:340,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:5}}>Remove {deleteConfirm.name}?</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:14}}>
              <Btn onClick={()=>{setVendors(p=>p.filter(v=>v.id!==deleteConfirm.id));setDeleteConfirm(null);}} color={C.red} style={{fontSize:12,padding:"7px 18px"}}>Remove</Btn>
              <Btn onClick={()=>setDeleteConfirm(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>🤝 {T2("Vendor Directory")}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{vendors.length} vendors · Outside chefs, suppliers, service partners</div>
        </div>
        <Btn onClick={()=>setShowAdd(s=>!s)} color={showAdd?C.muted:C.wine} style={{fontSize:12,padding:"7px 16px"}}>{showAdd?"✕ Cancel":"+ Add Vendor"}</Btn>
      </div>

      {/* Add form */}
      {showAdd&&(
        <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:10}}>{T2("Add New Vendor")}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            {[
              {l:T2("Name *"),   k:"name",   ph:"Full name"},
              {l:T2("Phone *"),  k:"phone",  ph:"98100-XXXXX"},
              {l:T2("Email"),    k:"email",  ph:"email@example.com"},
              {l:T2("Address"),  k:"address",ph:"Area, Delhi"},
              {l:"Added By", k:"addedBy",ph:"Your name"},
              {l:T2("Notes"),    k:"notes",  ph:"Speciality, experience…"},
            ].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:11,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>{f.l}</div>
                <input value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={fld}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 60px",gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>Category</div>
              <select value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} style={fld}>
                {VENDOR_CATEGORIES.map(ct=><option key={ct}>{ct}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>Section Speciality</div>
              <select value={form.section} onChange={e=>setForm(p=>({...p,section:e.target.value}))} style={fld}>
                {SECTION_OPTS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:2,textTransform:"uppercase"}}>Rating</div>
              <select value={form.rating} onChange={e=>setForm(p=>({...p,rating:+e.target.value}))} style={fld}>
                {[5,4,3,2,1].map(r=><option key={r} value={r}>{"★".repeat(r)}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setShowAdd(false)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:12}}>Cancel</Btn>
            <Btn onClick={addVendor} color={C.wine} style={{fontSize:12,padding:"8px 20px"}}>✓ Add Vendor</Btn>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search vendors…"
          style={{flex:1,minWidth:160,padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface}}/>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
        {cats.map(ct=>(
          <button key={ct} onClick={()=>setCatFilter(ct)} style={{padding:"4px 12px",borderRadius:20,fontSize:11,cursor:"pointer",background:catFilter===ct?C.wine:"transparent",color:catFilter===ct?"#fff":C.muted,border:`1px solid ${catFilter===ct?C.wine:C.border}`}}>{ct}</button>
        ))}
      </div>

      {/* Vendor grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        {filtered.map((v,i)=>(
          <div key={v.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 14px",opacity:v.active?1:.6}}>
            {editId===v.id?(
              <div>
                <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>Edit — {v.name}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                  {[{l:"Phone",k:"phone"},{l:T2("Email"),k:"email"},{l:T2("Address"),k:"address"},{l:T2("Notes"),k:"notes"}].map(f=>(
                    <div key={f.k}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{f.l}</div>
                      <input value={editForm[f.k]||""} onChange={e=>setEditForm(p=>({...p,[f.k]:e.target.value}))} style={{...fld,padding:"5px 7px"}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:5}}>
                  <Btn onClick={()=>{setVendors(p=>p.map(x=>x.id!==v.id?x:{...x,...editForm}));setEditId(null);}} color={C.wine} style={{fontSize:11,padding:"5px 12px"}}>Save</Btn>
                  <Btn onClick={()=>setEditId(null)} color="transparent" textColor={C.muted} border={`1px solid ${C.border}`} style={{fontSize:11,padding:"5px 10px"}}>Cancel</Btn>
                </div>
              </div>
            ):(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{display:"flex",gap:9,alignItems:"center"}}>
                    <Avatar name={v.name} size={34} index={i+10}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{v.name}</div>
                      <div style={{fontSize:10,color:C.gold,fontWeight:600,marginTop:1}}>{v.id}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{setEditId(v.id);setEditForm({phone:v.phone,email:v.email,address:v.address,notes:v.notes});}} style={{padding:"6px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,fontSize:10,cursor:"pointer",color:C.text}}>Edit</button>
                    <button onClick={()=>setVendors(p=>p.map(x=>x.id!==v.id?x:{...x,active:!x.active}))} style={{padding:"6px 12px",borderRadius:8,fontSize:10,cursor:"pointer",border:"none",background:v.active?C.greenBg:C.redBg,color:v.active?C.green:C.red}}>{v.active?"Active":"Off"}</button>
                    <button onClick={()=>setDeleteConfirm(v)} style={{padding:"3px 7px",borderRadius:8,fontSize:10,cursor:"pointer",border:`1px solid ${C.redBorder}`,background:C.redBg,color:C.red}}>🗑</button>
                  </div>
                </div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                  <Chip label={v.cat} color={C.wine} bg={C.wineBg} size={9}/>
                  {v.section&&v.section!=="—"&&<STag name={v.section}/>}
                </div>
                <div style={{display:"flex",gap:2,marginBottom:5}}>
                  {[1,2,3,4,5].map(s=><span key={s} style={{fontSize:12,color:s<=v.rating?"#F59E0B":"#D1D5DB"}}>★</span>)}
                </div>
                <div style={{fontSize:11,color:C.muted}}>{v.phone}{v.email?" · "+v.email:""}</div>
                {v.address&&<div style={{fontSize:10,color:C.faint,marginTop:2}}>📍 {v.address}</div>}
                {v.notes&&<div style={{marginTop:6,fontSize:11,color:C.muted,lineHeight:1.5}}>{v.notes}</div>}
                <div style={{marginTop:6,fontSize:11,color:C.faint}}>Added by {v.addedBy} · {v.date}</div>
              </div>
            )}
          </div>
        ))}
        {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:32,background:C.bg,borderRadius:10,fontSize:12,color:C.muted}}>{T2("No vendors found.")}</div>}
      </div>
    </div>
  );
}



// ─── GRANULAR PERMISSION SYSTEM ─────────────────────────────────────────────

export { VendorDirectory };
