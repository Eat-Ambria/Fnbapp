// Ambria FnB — Department View / Selector
import React, { useState, useRef, useEffect } from "react";
import { C, SECTIONS, ALL_DEPARTMENTS, SECTION_META, AMBRIA_VENUES, VEHICLES, COLD_ITEMS } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, safeArr, safeNum, safePct, safeObj, TOMORROW } from '../utils/helpers.js';
import { STAFF_LIST, GROOMING_CHECKS } from '../data/staffData.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { Avatar, DonutChart, Card, Btn, Chip, STag } from './SharedUI.jsx';
import { canAccessScreen } from '../data/permissions.js';
import { dbUpsert } from '../lib/db.js';
import { KioskAttendance } from './KioskAttendance.jsx';
import { guessSectionForDish, fmtT, getFullSteps, getStepsForDish } from '../data/recipeData.js';

function calcDispatch(time){
  if(!time) return "TBD";
  const parts=time.split(":");const h=parseInt(parts[0])||0;const m=parseInt(parts[1])||0;
  const dH=h-2;
  return `${String(dH<0?dH+24:dH).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function DeptView({attendance, setAttendance, events, kitchenTracking, setKitchenTracking, lang="en", setLang, onSelectDept, onLogout, currentUser, forceDept, leaves, setLeaves, empDb, setEmpDb}) {
  const T2 = s => T(s, lang);
  const [selDept, setSelDept] = useState(forceDept||null);
  const [deptTab, setDeptTab] = useState(null); // null = auto-pick first tab
  const [kioskMode, setKioskMode] = useState(false);
  const [time, setTime] = useState(new Date());
  const [svcChecks, setSvcChecks] = useState({});
  const [crockChecks, setCrockChecks] = useState({});
  const [bevChecks, setBevChecks] = useState({});
  const [expandedDish, setExpandedDish] = useState(null);
  const [bevTick, setBevTick] = useState(0);
  const [vehStatus, setVehStatus] = useState({});
  const [loadChecks, setLoadChecks] = useState({});
  const [selOdcId, setSelOdcId] = useState(null);
  useEffect(()=>{const t2=setInterval(()=>setBevTick(k=>k+1),1000);return()=>clearInterval(t2);},[]);
  const [odcChecks, setOdcChecks] = useState({});
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),30000);return()=>clearInterval(t);},[]);
  useEffect(()=>{if(forceDept){setSelDept(forceDept);setDeptTab(null);}},[forceDept]);

  const todayAtts = safeArr(attendance).filter(a=>a.date===TODAY);
  const todayEvs = safeArr(events).filter(e=>e.date===TODAY);
  const tomorrowEvs = safeArr(events).filter(e=>e.date===TOMORROW);

  // 6 Departments
  const DEPTS = [
    {id:"kitchen",name:"Kitchen",icon:"👨‍🍳",color:"#D4A843",bg:"#1E1A10",
      desc:"Food preparation across all sections",descHi:"सभी विभागों में भोजन तैयारी",
      sections:SECTIONS, staffFilter:s=>SECTIONS.includes(s.section)},
    {id:"service",name:"Service",icon:"🍽️",color:"#5B8FD0",bg:"#EEF4FD",
      desc:"Guest service, table setup, event coordination",descHi:"अतिथि सेवा, टेबल सेटअप, इवेंट समन्वय",
      sections:["Service"], staffFilter:s=>s.section==="Service"},
    {id:"crockery",name:"Crockery",icon:"🍶",color:"#8A70C8",bg:"#14101E",
      desc:"Plates, glasses, cutlery, chafing dishes",descHi:"प्लेट, ग्लास, कटलरी, चेफ़िंग डिश",
      sections:["Crockery"], staffFilter:s=>s.section==="Crockery"},
    {id:"beverages",name:"Beverages",icon:"🥤",color:"#50B0A0",bg:"#0E1E1A",
      desc:"Mocktails, juices, tea/coffee, water service",descHi:"मॉकटेल, जूस, चाय/कॉफी, पानी सेवा",
      sections:[], staffFilter:s=>s.section==="Beverages"},
    {id:"transport",name:"Transportation",icon:"🚛",color:"#D4A843",bg:"#1A1610",
      desc:"Vehicle dispatch, loading, route management",descHi:"वाहन रवानगी, लोडिंग, मार्ग प्रबंधन",
      sections:["Transportation"], staffFilter:s=>s.section==="Transportation"},
    {id:"odc",name:"ODC - Outdoor Catering",icon:"🏕️",color:C.gold,bg:C.redBg,
      desc:"Full event execution at external venues",descHi:"बाहरी वेन्यू पर पूर्ण इवेंट निष्पादन",
      sections:["ODC"], staffFilter:s=>s.section==="ODC"},
  ];

  // Crockery items per pax
  const CROCKERY_ITEMS = [
    {name:"Dinner Plate 10\"",h:"डिनर प्लेट 10\"",perPax:1.2,icon:"🍽"},
    {name:"Quarter Plate 7\"",h:"क्वार्टर प्लेट 7\"",perPax:1,icon:"🍽"},
    {name:"Soup Bowl",h:"सूप बाउल",perPax:0.8,icon:"🥣"},
    {name:"Sweet Bowl",h:"मिठाई कटोरी",perPax:1,icon:"🍮"},
    {name:"Water Glass",h:"पानी ग्लास",perPax:1.5,icon:"🥛"},
    {name:"Juice Glass",h:"जूस ग्लास",perPax:0.8,icon:"🧃"},
    {name:"Mocktail Glass",h:"मॉकटेल ग्लास",perPax:0.5,icon:"🍹"},
    {name:"Tea Cup & Saucer",h:"चाय कप और सॉसर",perPax:0.6,icon:"☕"},
    {name:"Serving Spoon Large",h:"सर्विंग चम्मच बड़ा",perPax:0.05,icon:"🥄"},
    {name:"Serving Spoon Small",h:"सर्विंग चम्मच छोटा",perPax:0.08,icon:"🥄"},
    {name:"Chafing Dish Full",h:"चेफ़िंग डिश फुल",perPax:0.02,icon:"🍲"},
    {name:"Chafing Dish Half",h:"चेफ़िंग डिश हाफ",perPax:0.03,icon:"🍲"},
    {name:"Fork",h:"काँटा",perPax:1.2,icon:"🍴"},
    {name:"Spoon",h:"चम्मच",perPax:1.5,icon:"🥄"},
    {name:"Knife",h:"छुरी",perPax:0.5,icon:"🔪"},
    {name:"Napkin (Cloth)",h:"नैपकिन (कपड़ा)",perPax:1,icon:"🧻"},
    {name:"Table Cloth",h:"टेबल कवर",perPax:0.02,icon:"🧵"},
    {name:"Tray Round",h:"ट्रे गोल",perPax:0.03,icon:"🫕"},
    {name:"Water Jug",h:"पानी जग",perPax:0.05,icon:"🫗"},
  ];

  // Service checklist template
  const SERVICE_CHECKLIST = [
    {id:"briefing",label:"Event Briefing Done",h:"इवेंट ब्रीफिंग पूर्ण",icon:"📋"},
    {id:"table_setup",label:"Tables & Chairs Setup",h:"टेबल और कुर्सी सेटअप",icon:"🪑"},
    {id:"linen",label:"Linen & Table Covers",h:"लिनन और टेबल कवर",icon:"🧵"},
    {id:"buffet_setup",label:"Buffet Counter Setup",h:"बुफ़े काउंटर सेटअप",icon:"🍽"},
    {id:"live_counter",label:"Live Counters Ready",h:"लाइव काउंटर तैयार",icon:"🔥"},
    {id:"water_station",label:"Water Station Placed",h:"पानी स्टेशन लगा",icon:"💧"},
    {id:"napkins",label:"Napkins & Cutlery Set",h:"नैपकिन और कटलरी सेट",icon:"🍴"},
    {id:"dustbins",label:"Dustbins Placed",h:"डस्टबिन लगाए",icon:"🗑"},
    {id:"staff_uniform",label:"Staff Uniform Check",h:"स्टाफ यूनिफ़ॉर्म चेक",icon:"👔"},
    {id:"vip_table",label:"VIP / Host Table Ready",h:"VIP / होस्ट टेबल तैयार",icon:"⭐"},
    {id:"final_walkthrough",label:"Final Walkthrough Done",h:"अंतिम निरीक्षण पूर्ण",icon:"✅"},
  ];

  // ── KIOSK OVERLAY ──
  if(kioskMode) return (
    <KioskAttendance staffList={STAFF_LIST} attendance={attendance} setAttendance={setAttendance} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} onClose={()=>setKioskMode(false)} lang={lang} currentUser={currentUser}/>
  );

  // ── DEPARTMENT SELECTOR ──
  if(!selDept && !forceDept) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(145deg,#0A0A0F 0%,#161514 50%,#0E0D0B 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px"}}>
      {/* Top bar */}
      <div style={{position:"absolute",top:16,left:24,right:24,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:700}}>A</div>
          <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>Ambria Cuisines</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{if(setLang)setLang(l=>l==="en"?"hi":"en");}} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,color:C.gold,fontSize:12,padding:"8px 14px",cursor:"pointer",fontWeight:600,minHeight:44}}>
            {lang==="en"?"🇮🇳 हिंदी":"🇬🇧 English"}
          </button>
          {onLogout&&<button onClick={onLogout} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:12,padding:"8px 14px",cursor:"pointer",minHeight:44}}>{T2("Sign out")}</button>}
        </div>
      </div>

      {currentUser&&<div style={{fontSize:14,color:C.muted,marginBottom:4}}>{T2("Welcome")}, <strong>{currentUser.name}</strong></div>}
      <div style={{fontSize:26,fontWeight:800,color:C.text,fontFamily:"var(--font-display)",marginBottom:6}}>{T2("Select Your Department")}</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:32}}>{T2("Each tablet is locked to its department")}</div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,maxWidth:780,width:"100%"}}>
        {DEPTS.map(dept=>{
          const odcCount = todayEvs.filter(e=>(e.venue||"").includes("ODC")).length;
          const DEPT_SCREEN = {kitchen:"kitchen",service:"dept_service",crockery:"dept_crockery",beverages:"dept_beverages",transport:"transport",odc:"dept_odc"};
          const hasAccess = canAccessScreen(currentUser, DEPT_SCREEN[dept.id]||dept.id);
          return (
            <button key={dept.id}
              onClick={hasAccess?()=>{if(onSelectDept) onSelectDept(dept.id); else setSelDept(dept.id);}:undefined}
              style={{background:C.darkCard,border:`1px solid ${hasAccess?dept.color+"30":C.border}`,borderRadius:20,padding:"28px 18px",cursor:hasAccess?"pointer":"not-allowed",textAlign:"center",boxShadow:"0 4px 20px rgba(0,0,0,.4)",transition:"all .15s",minHeight:180,opacity:hasAccess?1:0.35,position:"relative"}}>
              <div style={{fontSize:44,marginBottom:10}}>{dept.icon}{!hasAccess&&<span style={{fontSize:18,position:"absolute",top:10,right:10}}>🔒</span>}</div>
              <div style={{fontSize:17,fontWeight:700,color:C.text}}>{T2(dept.name)}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:6,lineHeight:1.5}}>{lang==="hi"?dept.descHi:dept.desc}</div>
              <div style={{fontSize:12,color:dept.color,fontWeight:600,marginTop:10}}>
                {dept.id==="odc"?`${odcCount} ODC ${T2("Today")}`:
                 `${todayEvs.length} ${T2("events")} ${T2("Today")}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Management card — admin only */}
      {currentUser?.role==="admin"&&(
        <div style={{maxWidth:780,width:"100%",marginTop:16}}>
          <div onClick={()=>{if(onSelectDept)onSelectDept("access");}}
            style={{background:C.darkCard,border:`2px solid ${C.purple}`,borderRadius:20,padding:"24px 20px",cursor:"pointer",textAlign:"center",minHeight:120,boxShadow:"0 4px 20px rgba(0,0,0,.4)",transition:"all .15s"}}>
            <div style={{fontSize:36,marginBottom:8}}>🔐</div>
            <div style={{fontSize:16,fontWeight:700,color:C.purple,fontFamily:"var(--font-display)"}}>Management</div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>Access Manager & Staff Control</div>
          </div>
        </div>
      )}

      {/* Gate Kiosk — admin and kiosk_gate role only */}
      {(currentUser?.role==="admin"||currentUser?.role==="kiosk_gate")&&(
        <div style={{marginTop:28,maxWidth:780,width:"100%"}}>
          <div style={{background:`linear-gradient(155deg,#06060A 0%,#12100A 40%,#0A0908 100%)`,borderRadius:16,padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:"#fff"}}> 🖥 {T2("Property Gate Kiosk")}</div>
              <div style={{fontSize:11,color:"rgba(196,164,74,.6)",marginTop:3}}>{T2("Guard records attendance for ALL staff at property entrance")}</div>
            </div>
            <button onClick={()=>setKioskMode(true)} style={{padding:"12px 28px",borderRadius:12,background:C.gold,color:"#0A0A0F",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0,minHeight:48}}>
              {T2("Launch Kiosk")} →
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── DEPARTMENT DATA ──
  const dept = DEPTS.find(d=>d.id===selDept)||DEPTS[0];

  // Kitchen section staff
  const kitchenStaff = STAFF_LIST.filter(s=>SECTIONS.includes(s.section));
  const bevStaff = STAFF_LIST.filter(s=>s.section==="Beverages");
  const odcEvs = todayEvs.filter(e=>(e.venue||"").includes("ODC"));
  const tomorrowOdc = tomorrowEvs.filter(e=>(e.venue||"").includes("ODC"));

  // Tabs per department
  const DEPT_TABS = {
    kitchen:  [{v:"attendance",l:`✅ ${T2("Attendance")}`},{v:"kitchen",l:`👨‍🍳 ${T2("Kitchen Tasks")}`},{v:"menu",l:`📜 ${T2("Menu")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    service:  [{v:"attendance",l:`✅ ${T2("Attendance")}`},{v:"staffing",l:`👥 ${T2("Staff Allocation")}`},{v:"checklist",l:`📋 ${T2("Service Checklist")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    crockery: [{v:"attendance",l:`✅ ${T2("Attendance")}`},{v:"requirements",l:`📦 ${T2("Requirements")}`},{v:"dispatch",l:`🚛 ${T2("Dispatch")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    beverages:[{v:"store_req",l:`📦 ${T2("D-1 Store Req")}`},{v:"live_prep",l:`🥤 ${T2("Live Prep")}`},{v:"menu",l:`📜 ${T2("Menu")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    transport:[{v:"live",l:`📍 ${T2("Live Transport")}`},{v:"pickup",l:`🔔 ${T2("Kitchen Pickup")}`},{v:"checklist",l:`📋 ${T2("Loading Checklist")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
    odc:      [{v:"bookings",l:`🏕️ ${T2("ODC Bookings")}`},{v:"kitchen",l:`👨‍🍳 ${T2("Kitchen Tasks")}`},{v:"checklist",l:`📋 ${T2("Site Checklist")}`},{v:"repair",l:`🔧 ${T2("Repair")}`}],
  };
  const tabs = DEPT_TABS[selDept]||DEPT_TABS.kitchen;
  const activeTab = (deptTab && tabs.some(t=>t.v===deptTab)) ? deptTab : (tabs[0]?.v || "attendance");

  return (
    <div style={{padding:"4px 0"}}>
      {/* ── DEPT HEADER ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:48,height:48,borderRadius:14,background:dept.color+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{dept.icon}</div>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{T2(dept.name)}</div>
            <div style={{fontSize:12,color:C.muted}}>{lang==="hi"?dept.descHi:dept.desc}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{textAlign:"right",marginRight:8}}>
            <div style={{fontSize:16,fontWeight:700,color:C.text}}>{time.toLocaleTimeString(lang==="hi"?"hi-IN":"en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
            <div style={{fontSize:12,color:C.muted}}>{TODAY_LABEL}</div>
          </div>
          <button onClick={()=>{setSelDept(null);setDeptTab(null);}} style={{padding:"10px 16px",borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:44}}>🔄 {T2("Change Dept")}</button>
        </div>
      </div>

      {/* ── TABS (tablet: large touch targets) ── */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {tabs.map(t=>(
          <button key={t.v} onClick={()=>setDeptTab(t.v)} style={{padding:"10px 18px",borderRadius:24,fontSize:13,fontWeight:600,cursor:"pointer",background:activeTab===t.v?dept.color:"transparent",color:activeTab===t.v?"#fff":C.muted,border:`2px solid ${activeTab===t.v?dept.color:C.border}`,minHeight:44,transition:"all .15s"}}>{t.l}</button>
        ))}
      </div>

      {/* ══════ ATTENDANCE TAB (shared across all depts) ══════ */}
      {activeTab==="attendance"&&(()=>{
        const curDeptConfig = DEPTS.find(d=>d.id===selDept);
        const deptStaff = curDeptConfig ? STAFF_LIST.filter(curDeptConfig.staffFilter) : [];
        const deptPresent = todayAtts.filter(a=>a.status==="Present"&&deptStaff.some(s=>String(s.staffListId||s.staff_id||s.id)===String(a.staffId||a.staff_id)));
        return (
          <div>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 18px",display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontSize:24,fontWeight:700,color:C.green}}>{deptPresent.length}</div>
                <div style={{fontSize:11,color:C.green,fontWeight:600}}>/ {deptStaff.length} {T2("Present")}</div>
              </div>
            </div>
            {deptPresent.length>0?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {deptPresent.map((att,i)=>{
                  const staff = deptStaff.find(s=>String(s.id)===String(att.staffId));
                  return (
                    <div key={i} style={{background:att.punchOut?C.surface:C.greenBg,border:`1px solid ${att.punchOut?C.border:C.greenBorder}`,borderRadius:12,padding:"12px",display:"flex",gap:10,alignItems:"center"}}>
                      {att.photo?<img src={att.photo} style={{width:40,height:40,borderRadius:10,objectFit:"cover"}}/>
                        :<div style={{width:40,height:40,borderRadius:10,background:C.green+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:C.green}}>✓</div>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{att.staffName||staff?.name}</div>
                        <div style={{fontSize:11,color:C.green}}>✅ {T2("In")}: {att.time}</div>
                        {att.punchOut&&<div style={{fontSize:11,color:"#D06040"}}>👋 {T2("Out")}: {att.punchOut}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ):(
              <div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>
                {deptStaff.length>0?T2("No staff checked in yet. Attendance is marked at Property Gate Kiosk."):T2("Staff roster for this department will be configured")+". "+T2("Use Kiosk for attendance")+"."}
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════ KITCHEN: Kitchen Tasks ══════ */}
      {selDept==="kitchen"&&activeTab==="kitchen"&&(()=>{
        const secDishes = {};
        todayEvs.forEach(ev=>{
          (ev.menu||[]).forEach((name,idx)=>{
            if(guessSectionForDish(name)==="Beverages") return; // beverages handled by Beverages dept
            const sec = guessSectionForDish(name);
            if(!secDishes[sec]) secDishes[sec]=[];
            const dId = ev.id+"|"+idx;
            const kt = safeObj(kitchenTracking);
            const tracked = safeObj(kt[ev.id])?.[dId];
            const steps = tracked?.steps || getStepsForDish(name);
            const done = safeArr(tracked?.done);
            secDishes[sec].push({name,ev:ev.guest,evTime:ev.time,pct:safePct(done.length,steps.length)});
          });
        });
        return (
          <div>
            {Object.entries(secDishes).map(([sec,dishes])=>{
              const m = SECTION_META[sec]||{icon:"🍽",color:C.muted};
              const ready = dishes.filter(d=>d.pct===100).length;
              return (
                <Card key={sec} style={{marginBottom:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:m.color}}>{m.icon} {T2(sec)}</span>
                    <span style={{fontSize:10,fontWeight:600,color:ready===dishes.length?C.green:C.amber}}>{ready}/{dishes.length} ✓</span>
                  </div>
                  {dishes.map((d,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:i<dishes.length-1?`1px solid ${C.borderLight}`:"none"}}>
                      <div style={{width:20,height:20,borderRadius:3,background:d.pct===100?C.green:d.pct>0?C.amber+"30":"transparent",border:`1.5px solid ${d.pct===100?C.green:d.pct>0?C.amber:C.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {d.pct===100&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:d.pct===100?C.green:C.text}}>{d.name}</div>
                        <div style={{fontSize:11,color:C.muted}}>{d.ev} · {d.evTime}</div>
                      </div>
                      <span style={{fontSize:10,color:d.pct===100?C.green:d.pct>0?C.amber:C.muted}}>{d.pct}%</span>
                    </div>
                  ))}
                </Card>
              );
            })}
            {Object.keys(secDishes).length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No dishes for today")}</div>}
          </div>
        );
      })()}

      {/* ══════ KITCHEN: Menu ══════ */}
      {selDept==="kitchen"&&activeTab==="menu"&&(
        <div>
          {todayEvs.map(ev=>(
            <Card key={ev.id} style={{marginBottom:10,padding:"12px 14px"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{ev.guest} — {ev.menuPackage||"Custom"}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{ev.time} · {ev.pax} {T2("pax")} · {(ev.menu||[]).filter(d=>guessSectionForDish(d)!=="Beverages").length} {T2("dishes")}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {(ev.menu||[]).filter(d=>guessSectionForDish(d)!=="Beverages").map((d,i)=>{const sec=guessSectionForDish(d);const m=SECTION_META[sec]||{color:C.muted};return <span key={i} style={{fontSize:10,padding:"5px 10px",borderRadius:8,background:m.color+"10",border:`1px solid ${m.color}25`,color:m.color}}>{d}</span>;})}
              </div>
            </Card>
          ))}
          {todayEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No events today")}</div>}
        </div>
      )}

      {/* ══════ SERVICE: Staff Allocation ══════ */}
      {selDept==="service"&&activeTab==="staffing"&&(()=>{
        // Staff allocation reference table
        const ALLOC_BASE = {
          "Magnum Veg":        {ref:[{pax:100,staff:17},{pax:200,staff:26}],per100:6,per50:3},
          "Magnum Non-Veg":    {ref:[{pax:100,staff:18},{pax:200,staff:28}],per100:6,per50:3},
          "Double Magnum Veg": {ref:[{pax:100,staff:20},{pax:200,staff:29}],per100:6,per50:3},
          "Double Magnum Non-Veg":{ref:[{pax:100,staff:21},{pax:200,staff:29}],per100:6,per50:3},
          "Multi-Cuisine Veg": {ref:[{pax:300,staff:36},{pax:400,staff:42},{pax:500,staff:49}],per100:6,per50:3},
          "Multi-Cuisine Non-Veg":{ref:[{pax:300,staff:37},{pax:400,staff:43},{pax:500,staff:49}],per100:6,per50:3},
          "Luxury Veg":        {ref:[{pax:300,staff:46},{pax:400,staff:53},{pax:500,staff:60}],per100:7,per50:4},
          "Luxury Non-Veg":    {ref:[{pax:300,staff:47},{pax:400,staff:54},{pax:500,staff:61}],per100:7,per50:4},
        };
        function calcStaff(pkg,pax){
          const ab=ALLOC_BASE[pkg];if(!ab)return{staff:null,note:T2("No allocation data for this menu")};
          const refs=ab.ref.sort((a,b)=>a.pax-b.pax);
          // Find closest reference point
          let base=refs[0];
          for(const r of refs){if(pax>=r.pax)base=r;else break;}
          const diff=pax-base.pax;
          const extra100=Math.floor(diff/100)*ab.per100;
          const remainder=diff%100;
          const extra50=remainder>=50?ab.per50:Math.round(remainder/100*ab.per100);
          const total=base.staff+extra100+extra50;
          return{staff:total,base:base.staff,basePax:base.pax,extraPax:diff,extraStaff:extra100+extra50,per100:ab.per100,per50:ab.per50};
        }
        const allEvs=[...todayEvs,...tomorrowEvs];
        let grandTotal=0;
        return(
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{T2("Service Staff Allocation")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Auto-calculated based on menu package and guest count")}</div>
            {allEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No events today or tomorrow")}</div>}
            {allEvs.map(ev=>{
              const pkg=ev.menuPackage||"";
              const pax=+ev.pax||0;
              const result=calcStaff(pkg,pax);
              if(result.staff)grandTotal+=result.staff;
              const isToday=ev.date===TODAY;
              return(
                <Card key={ev.id} style={{marginBottom:10,padding:0,overflow:"hidden"}}>
                  <div style={{padding:"14px 16px",background:C.bg,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:12,fontWeight:700,color:isToday?C.gold:C.amber}}>{isToday?T2("Today"):T2("Tomorrow")}</span>
                        <span style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</span>
                      </div>
                      <div style={{fontSize:12,color:C.muted,marginTop:2}}>{ev.venue} · {ev.time} · {pax} {T2("pax")} · 📜 {pkg||T2("Custom")}</div>
                      {ev.special&&<div style={{fontSize:11,color:C.amber,marginTop:2}}>⚠ {ev.special}</div>}
                    </div>
                    <div style={{textAlign:"center",flexShrink:0}}>
                      <div style={{fontSize:28,fontWeight:800,color:result.staff?C.gold:C.muted}}>{result.staff||"—"}</div>
                      <div style={{fontSize:10,color:C.muted}}>{T2("staff needed")}</div>
                    </div>
                  </div>
                  {result.staff&&(
                    <div style={{padding:"12px 16px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
                        <div style={{background:C.bg,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                          <div style={{fontSize:10,color:C.muted}}>{T2("Base")}</div>
                          <div style={{fontSize:16,fontWeight:700,color:C.text}}>{result.base}</div>
                          <div style={{fontSize:10,color:C.muted}}>@ {result.basePax} {T2("pax")}</div>
                        </div>
                        <div style={{background:C.bg,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                          <div style={{fontSize:10,color:C.muted}}>{T2("Extra")}</div>
                          <div style={{fontSize:16,fontWeight:700,color:C.amber}}>+{result.extraStaff}</div>
                          <div style={{fontSize:10,color:C.muted}}>+{result.extraPax} {T2("pax")}</div>
                        </div>
                        <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                          <div style={{fontSize:10,color:C.gold}}>{T2("Total")}</div>
                          <div style={{fontSize:20,fontWeight:800,color:C.gold}}>{result.staff}</div>
                          <div style={{fontSize:10,color:C.gold}}>{T2("staff")}</div>
                        </div>
                      </div>
                      <div style={{fontSize:11,color:C.muted,background:C.bg,borderRadius:8,padding:"8px 12px"}}>
                        📊 {T2("Scale")}: +{result.per100} {T2("staff per")} 100 {T2("pax")} · +{result.per50} {T2("staff per")} 50 {T2("pax")}
                        {/luxury/i.test(pkg)&&<span style={{color:C.gold,marginLeft:6}}>★ {T2("Luxury rate")}</span>}
                      </div>
                    </div>
                  )}
                  {!result.staff&&<div style={{padding:"12px 16px",fontSize:12,color:C.muted}}>{result.note}</div>}
                </Card>
              );
            })}
            {allEvs.length>1&&grandTotal>0&&(
              <Card style={{padding:"14px 18px",background:C.goldBg,border:`2px solid ${C.gold}40`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:14,fontWeight:700,color:C.gold}}>{T2("Grand Total Service Staff")}</span>
                  <span style={{fontSize:24,fontWeight:800,color:C.gold}}>{grandTotal}</span>
                </div>
              </Card>
            )}
          </div>
        );
      })()}

      {/* ══════ SERVICE: Checklist ══════ */}
      {selDept==="service"&&activeTab==="checklist"&&(
        <div>
          {todayEvs.map(ev=>{
            const checks = svcChecks[ev.id]||{};
            const doneCt = SERVICE_CHECKLIST.filter(c=>checks[c.id]).length;
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:0,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:C.bg,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{ev.guest}</div><div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")}</div></div>
                  <span style={{fontSize:12,fontWeight:700,color:doneCt===SERVICE_CHECKLIST.length?C.green:C.amber}}>{doneCt}/{SERVICE_CHECKLIST.length}</span>
                </div>
                <div style={{padding:"12px 16px"}}>
                  {SERVICE_CHECKLIST.map(item=>{
                    const done = !!checks[item.id];
                    return (
                      <div key={item.id} onClick={()=>setSvcChecks(p=>({...p,[ev.id]:{...(p[ev.id]||{}),[item.id]:!done}}))}
                        style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer"}}>
                        <div style={{width:24,height:24,borderRadius:4,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {done&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                        </div>
                        <span style={{fontSize:14,flexShrink:0}}>{item.icon}</span>
                        <span style={{fontSize:12,color:done?C.green:C.text,textDecoration:done?"line-through":"none"}}>{lang==="hi"?item.h:item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          {todayEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No events today")}</div>}
        </div>
      )}

      {/* ══════ CROCKERY: Requirements ══════ */}
      {selDept==="crockery"&&activeTab==="requirements"&&(
        <div>
          {todayEvs.map(ev=>{
            const checks = crockChecks[ev.id]||{};
            const packed = CROCKERY_ITEMS.filter(c=>checks[c.name]).length;
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:0,overflow:"hidden"}}>
                <div style={{padding:"12px 16px",background:C.bg,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{ev.guest}</div><div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.pax} {T2("pax")}</div></div>
                  <span style={{fontSize:12,fontWeight:700,color:packed===CROCKERY_ITEMS.length?C.green:C.amber}}>{packed}/{CROCKERY_ITEMS.length} {T2("packed")}</span>
                </div>
                <div style={{padding:"12px 16px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {CROCKERY_ITEMS.map(item=>{
                      const qty = Math.ceil(ev.pax * item.perPax);
                      const done = !!checks[item.name];
                      return (
                        <div key={item.name} onClick={()=>setCrockChecks(p=>({...p,[ev.id]:{...(p[ev.id]||{}),[item.name]:!done}}))}
                          style={{display:"flex",gap:8,alignItems:"center",padding:"6px 8px",borderRadius:8,cursor:"pointer",background:done?C.greenBg:"transparent",border:`1px solid ${done?C.greenBorder:C.borderLight}`}}>
                          <div style={{width:20,height:20,borderRadius:3,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {done&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                          </div>
                          <span style={{fontSize:12,flexShrink:0}}>{item.icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:done?C.green:C.text}}>{lang==="hi"?item.h:item.name}</div>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:dept.color,flexShrink:0}}>{qty}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
          {todayEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No events today")}</div>}
        </div>
      )}

      {/* ══════ CROCKERY: Dispatch ══════ */}
      {selDept==="crockery"&&activeTab==="dispatch"&&(
        <div>
          {todayEvs.map(ev=>{
            const checks = crockChecks[ev.id]||{};
            const packed = CROCKERY_ITEMS.filter(c=>checks[c.name]).length;
            const pct = safePct(packed, CROCKERY_ITEMS.length);
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{ev.guest}</div><div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time}</div></div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:700,color:pct===100?C.green:C.amber}}>{pct}%</div>
                    <div style={{fontSize:11,color:C.muted}}>{T2("packed")}</div>
                  </div>
                </div>
                <div style={{height:8,background:C.border,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:pct===100?C.green:C.amber,borderRadius:3,transition:"width .4s"}}/>
                </div>
                {pct===100&&<div style={{marginTop:8,fontSize:11,color:C.green,fontWeight:600}}>✅ {T2("All packed — ready to load")}</div>}
                {pct<100&&<div style={{marginTop:8,fontSize:11,color:C.amber}}>⏳ {CROCKERY_ITEMS.length-packed} {T2("items remaining")}</div>}
              </Card>
            );
          })}
        </div>
      )}

      {/* ══════ BEVERAGES: Counters ══════ */}
      {/* ══════ BEVERAGES: D-1 Store Requirements ══════ */}
      {selDept==="beverages"&&activeTab==="store_req"&&(
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{T2("D-1 Store Requirements")}</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:14}}>{T2("Collect these from store today for tomorrow's functions")}</div>
          {tomorrowEvs.map(ev=>{
            const bevItems = safeArr(ev.menu).filter(d=>guessSectionForDish(d)==="Beverages");
            if(bevItems.length===0) return null;
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:"14px 16px"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>{ev.guest}</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:10}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")} · {bevItems.length} {T2("beverages")}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {bevItems.map((d,i)=>{
                    const ck = bevChecks[ev.id+"_bev"]||{};
                    const done = !!ck[d];
                    return (
                      <div key={i} onClick={()=>setBevChecks(p=>({...p,[ev.id+"_bev"]:{...(p[ev.id+"_bev"]||{}),[d]:!done}}))}
                        style={{display:"flex",gap:8,padding:"8px 10px",borderRadius:8,cursor:"pointer",background:done?C.greenBg:C.surface,border:`1px solid ${done?C.greenBorder:C.border}`,alignItems:"center",minHeight:40}}>
                        <div style={{width:22,height:22,borderRadius:4,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {done&&<span style={{color:"#0A0A0F",fontSize:12,fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{fontSize:11,color:done?C.green:C.text}}>🥤 {d}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          {tomorrowEvs.filter(ev=>safeArr(ev.menu).some(d=>guessSectionForDish(d)==="Beverages")).length===0&&(
            <div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No beverage requirements for tomorrow")}</div>
          )}
        </div>
      )}

      {/* ══════ BEVERAGES: Live Prep (Today — with timers) ══════ */}
      {selDept==="beverages"&&activeTab==="live_prep"&&(
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>🥤 {T2("Live Beverage Prep")}</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:14}}>{T2("Tap any beverage to start prep. Timers run until complete.")}</div>
          {todayEvs.map(ev=>{
            const menu = safeArr(ev.menu);
            const bevItems = menu.map((d,i)=>({name:d,idx:i})).filter(x=>guessSectionForDish(x.name)==="Beverages");
            if(bevItems.length===0) return null;
            const bevReady = bevItems.filter(b=>{const bk=`bev_${ev.id}_${b.idx}`;return bevChecks[bk]?.ready;}).length;
            return (
              <div key={ev.id} style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"12px 16px",background:C.surface,borderRadius:12,border:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</div>
                    <div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:700,color:bevReady===bevItems.length?C.green:C.amber}}>{bevReady}/{bevItems.length}</div>
                </div>
                {bevItems.map(b=>{
                  const bk = `bev_${ev.id}_${b.idx}`;
                  const bd = bevChecks[bk]||{};
                  const steps = getFullSteps(b.name);
                  const isExp = expandedDish===bk;
                  const runSi = steps.findIndex((_,si)=>bd.starts?.[si]&&!(bd.manual?.[si])&&!(bd.starts?.[si]&&steps[si].tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=steps[si].tm));
                  const doneSi = steps.filter((_,si)=>{return !!(bd.manual?.[si])||(bd.starts?.[si]&&steps[si].tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=steps[si].tm);}).length;

                  return (
                    <div key={bk} style={{marginBottom:6,background:C.surface,border:`1.5px solid ${bd.ready?C.greenBorder:runSi>=0?C.amberBorder:C.border}`,borderRadius:12,overflow:"hidden"}}>
                      <div onClick={()=>setExpandedDish(isExp?null:bk)} style={{padding:"12px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"center"}}>
                        <div style={{width:32,height:32,borderRadius:8,background:bd.ready?C.green:runSi>=0?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:bd.ready||runSi>=0?"#0A0A0F":C.muted,flexShrink:0}}>
                          {bd.ready?"✓":runSi>=0?"⏱":"🥤"}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:bd.ready?C.green:C.text}}>{b.name}</div>
                          <div style={{fontSize:12,color:C.muted}}>{doneSi}/{steps.length} {T2("steps")} {bd.readyAt?"· ✅ "+bd.readyAt:""}</div>
                        </div>
                        {runSi>=0&&(()=>{const el3=Math.floor((Date.now()-(bd.starts?.[runSi]||Date.now()))/1000);const tm3=steps[runSi]?.tm||0;const rem3=Math.max(0,tm3-el3);return <div style={{fontSize:14,fontWeight:700,color:C.amber,flexShrink:0}}>{fmtT(rem3)}</div>;})()}
                        <span style={{fontSize:16,color:C.muted,transform:isExp?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▾</span>
                      </div>
                      {isExp&&(
                        <div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`}}>
                          {steps.map((step,si)=>{
                            const sRunning = !!(bd.starts?.[si])&&!(bd.manual?.[si])&&!(bd.starts?.[si]&&step.tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=step.tm);
                            const sDone = !!(bd.manual?.[si])||(bd.starts?.[si]&&step.tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=step.tm);
                            const sEl = sRunning?Math.floor((Date.now()-bd.starts[si])/1000):0;
                            const sTm = step.tm||0;
                            const sRem = Math.max(0,sTm-sEl);
                            const sPct = sTm>0?Math.min(100,Math.round(sEl/sTm*100)):(sDone?100:0);
                            const prevOk2 = si===0||!!(bd.manual?.[(si-1)])||(bd.starts?.[(si-1)]&&steps[si-1].tm&&Math.floor((Date.now()-(bd.starts[si-1]||0))/1000)>=steps[si-1].tm);
                            return (
                              <div key={si} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:si<steps.length-1?`1px solid ${C.borderLight}`:"none",alignItems:"flex-start"}}>
                                <div style={{width:32,height:32,borderRadius:8,background:sDone?C.green:sRunning?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:sDone||sRunning?"#0A0A0F":C.muted,flexShrink:0}}>{sDone?"✓":si+1}</div>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:12,fontWeight:700,color:sDone?C.green:C.text}}>{step.t}{step.store?" 🏪":""}{step.live?" 🔴":""}</div>
                                  {step.i&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{step.i}</div>}
                                  {sTm>0&&<div style={{marginTop:6}}>
                                    <div style={{height:8,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:3}}>
                                      <div style={{height:"100%",width:sPct+"%",background:sDone?C.green:C.amber,borderRadius:3,transition:"width .5s"}}/>
                                    </div>
                                    <div style={{fontSize:11,color:sRunning?C.amber:sDone?C.green:C.muted}}>
                                      {sRunning?`⏱ ${fmtT(sEl)} / ${fmtT(sTm)} — ${fmtT(sRem)} ${T2("left")}`:sDone?`✓ ${fmtT(sTm)}`:`⏱ ${fmtT(sTm)}`}
                                    </div>
                                  </div>}
                                  {!sRunning&&!sDone&&sTm>0&&prevOk2&&<button onClick={(e)=>{e.stopPropagation();setBevChecks(p=>({...p,[bk]:{...(p[bk]||{}),starts:{...((p[bk]||{}).starts||{}),[si]:Date.now()}}}));}} style={{marginTop:6,padding:"8px 16px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>▶ {T2("Start")} — {fmtT(sTm)}</button>}
                                  {!sRunning&&!sDone&&!sTm&&prevOk2&&!step.live&&<button onClick={(e)=>{e.stopPropagation();setBevChecks(p=>({...p,[bk]:{...(p[bk]||{}),manual:{...((p[bk]||{}).manual||{}),[si]:true}}}));}} style={{marginTop:6,padding:"8px 16px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>✓ {T2("Mark Done")}</button>}
                                  {!sRunning&&!sDone&&!prevOk2&&<div style={{marginTop:4,fontSize:11,color:C.faint}}>⏸ {T2("Previous step must finish first")}</div>}
                                </div>
                              </div>
                            );
                          })}
                          {steps.every((_,si)=>{return !!(bd.manual?.[si])||(bd.starts?.[si]&&steps[si].tm&&Math.floor((Date.now()-bd.starts[si])/1000)>=steps[si].tm);})&&!bd.ready&&(
                            <button onClick={(e)=>{e.stopPropagation();setBevChecks(p=>({...p,[bk]:{...(p[bk]||{}),ready:true,readyAt:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}}));}}
                              style={{width:"100%",padding:"14px",borderRadius:12,background:`linear-gradient(135deg,${C.green},#2A7A4A)`,color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:8,minHeight:48}}>
                              ✅ {T2("Mark as Ready")} — {b.name}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {todayEvs.every(ev=>!safeArr(ev.menu).some(d=>guessSectionForDish(d)==="Beverages"))&&(
            <div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No beverages in today's functions")}</div>
          )}
        </div>
      )}

      {/* ══════ BEVERAGES: Menu ══════ */}
      {selDept==="beverages"&&activeTab==="menu"&&(
        <div>
          {todayEvs.map(ev=>{
            const bevItems = safeArr(ev.menu).filter(d=>guessSectionForDish(d)==="Beverages");
            if(bevItems.length===0) return null;
            return (
              <Card key={ev.id} style={{marginBottom:10,padding:"14px 16px"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>{ev.guest}</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")} · {bevItems.length} {T2("beverages")}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {bevItems.map((d,i)=><span key={i} style={{fontSize:11,padding:"6px 12px",borderRadius:8,background:C.teal+"15",border:`1px solid ${C.teal}30`,color:C.teal}}>🥤 {d}</span>)}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ══════ TRANSPORT: Live Transport View ══════ */}
      {selDept==="transport"&&activeTab==="live"&&(()=>{
        const STATUSES=["🏠 At Base","📦 Loading","🚛 En Route","📍 At Venue","↩ Returning"];
        const STATUS_COLORS={"🏠 At Base":C.muted,"📦 Loading":C.amber,"🚛 En Route":C.gold,"📍 At Venue":C.green,"↩ Returning":"#5B8FD0"};
        function setVeh(vId,data){setVehStatus(p=>({...p,[vId]:{...(p[vId]||{status:"🏠 At Base",event:"",driver:"",trips:[]}),...data}}));}
        function logTrip(vId,action){setVehStatus(p=>{const v=p[vId]||{trips:[]};return{...p,[vId]:{...v,trips:[...safeArr(v.trips),{action,time:new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}]}};});}

        const activeVeh = VEHICLES.filter(v=>(vehStatus[v.id]?.status||"🏠 At Base")!=="🏠 At Base").length;
        return(
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>📍 {T2("Live Transport View")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Track all vehicles in real-time")}</div>

            {/* Fleet summary */}
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px"}}><div style={{fontSize:20,fontWeight:700,color:C.text}}>{VEHICLES.length}</div><div style={{fontSize:11,color:C.muted}}>{T2("Total Fleet")}</div></div>
              <div style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"10px 16px"}}><div style={{fontSize:20,fontWeight:700,color:C.green}}>{activeVeh}</div><div style={{fontSize:11,color:C.green}}>{T2("Active")}</div></div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px"}}><div style={{fontSize:20,fontWeight:700,color:C.muted}}>{VEHICLES.length-activeVeh}</div><div style={{fontSize:11,color:C.muted}}>{T2("At Base")}</div></div>
              <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"10px 16px"}}><div style={{fontSize:20,fontWeight:700,color:C.gold}}>{todayEvs.length}</div><div style={{fontSize:11,color:C.gold}}>{T2("Events Today")}</div></div>
            </div>

            {/* Vehicle cards */}
            {VEHICLES.map(v=>{
              const vs=vehStatus[v.id]||{status:"🏠 At Base",event:"",driver:"",trips:[]};
              const stColor=STATUS_COLORS[vs.status]||C.muted;
              const isActive=vs.status!=="🏠 At Base";
              
              return(
                <Card key={v.id} style={{marginBottom:8,padding:0,overflow:"hidden",border:`1.5px solid ${isActive?stColor+"60":C.border}`}}>
                  <div style={{padding:"14px 16px",display:"flex",gap:12,alignItems:"center"}}>
                    <div style={{fontSize:28,flexShrink:0}}>{v.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:14,fontWeight:700,color:C.text}}>{v.name}</span>
                        <span style={{fontSize:11,padding:"3px 10px",borderRadius:8,background:stColor+"15",color:stColor,fontWeight:600}}>{vs.status}</span>
                      </div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>{v.note}</div>
                      {vs.event&&<div style={{fontSize:12,color:C.gold,marginTop:3}}>📋 {vs.event}</div>}
                      {vs.driver&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>🧑 {T2("Driver")}: {vs.driver}</div>}
                    </div>
                    {/* Status buttons */}
                    <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                      {vs.status==="🏠 At Base"&&<button onClick={()=>{setVeh(v.id,{status:"📦 Loading"});logTrip(v.id,"Loading started");}} style={{padding:"8px 14px",borderRadius:8,background:C.amber,color:"#0A0A0F",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>📦 {T2("Start Loading")}</button>}
                      {vs.status==="📦 Loading"&&<button onClick={()=>{setVeh(v.id,{status:"🚛 En Route"});logTrip(v.id,"Departed for venue");}} style={{padding:"8px 14px",borderRadius:8,background:C.gold,color:"#0A0A0F",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>🚛 {T2("Dispatch")}</button>}
                      {vs.status==="🚛 En Route"&&<button onClick={()=>{setVeh(v.id,{status:"📍 At Venue"});logTrip(v.id,"Arrived at venue");}} style={{padding:"8px 14px",borderRadius:8,background:C.green,color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>📍 {T2("Arrived")}</button>}
                      {vs.status==="📍 At Venue"&&<button onClick={()=>{setVeh(v.id,{status:"↩ Returning"});logTrip(v.id,"Returning to base");}} style={{padding:"8px 14px",borderRadius:8,background:"#5B8FD0",color:"#fff",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>↩ {T2("Return")}</button>}
                      {vs.status==="↩ Returning"&&<button onClick={()=>{setVeh(v.id,{status:"🏠 At Base",event:"",driver:""});logTrip(v.id,"Back at base");}} style={{padding:"8px 14px",borderRadius:8,background:C.surface,color:C.text,border:`1px solid ${C.border}`,fontSize:11,fontWeight:600,cursor:"pointer",minHeight:36}}>🏠 {T2("At Base")}</button>}
                    </div>
                  </div>

                  {/* Assign event & driver (when loading) */}
                  {(vs.status==="📦 Loading"||vs.status==="🏠 At Base")&&!vs.event&&todayEvs.length>0&&(
                    <div style={{padding:"8px 16px",borderTop:`1px solid ${C.border}`,background:C.bg,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <select value={vs.event||""} onChange={e=>setVeh(v.id,{event:e.target.value})} style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:36}}>
                        <option value="">{T2("Assign to event…")}</option>
                        {todayEvs.map(ev=><option key={ev.id} value={ev.guest+" · "+ev.venue}>{ev.guest} — {ev.venue}</option>)}
                      </select>
                      <input placeholder={T2("Driver name")} value={vs.driver||""} onChange={e=>setVeh(v.id,{driver:e.target.value})} style={{width:140,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,minHeight:36}}/>
                    </div>
                  )}

                  {/* Trip log */}
                  {safeArr(vs.trips).length>0&&(
                    <div style={{padding:"8px 16px",borderTop:`1px solid ${C.border}`,background:C.bg}}>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {safeArr(vs.trips).map((trip,ti)=>(
                          <span key={ti} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,color:C.muted}}>
                            {trip.time} — {trip.action}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ══════ TRANSPORT: Kitchen Pickup (synced with Kitchen) ══════ */}
      {selDept==="transport"&&activeTab==="pickup"&&(()=>{
        const kt=kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        // Only show events at venues needing dispatch (not base kitchens)
        const dispatchEvs=todayEvs.filter(ev=>!/pushpanjali|exotica/i.test(ev.venue));
        const allEvs=todayEvs;
        return(
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>🔔 {T2("Kitchen Pickup Status")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Real-time sync with Kitchen. Dishes marked ready by chefs appear here.")}</div>

            {allEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No events today")}</div>}

            {allEvs.map(ev=>{
              const menu=safeArr(ev.menu).filter(d=>guessSectionForDish(d)!=="Beverages");
              const needsDispatch=!/pushpanjali|exotica/i.test(ev.venue);
              const readyItems=menu.filter((_,idx)=>{const d=kt[ev.id]?.[`d_${idx}`];return d?.ready;});
              const dispatchedItems=menu.filter((_,idx)=>{const d=kt[ev.id]?.[`d_${idx}`];return d?.dispatchReady;});
              const allReady=readyItems.length===menu.length&&menu.length>0;
              const fullDispatched=!!(kt[ev.id]?.__dispatch_ready);

              return(
                <Card key={ev.id} style={{marginBottom:12,padding:0,overflow:"hidden",border:`1.5px solid ${fullDispatched?C.greenBorder:allReady?C.gold+"60":C.border}`}}>
                  <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</div>
                      <div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")} · {T2("Dispatch")}: {calcDispatch(ev.time)}</div>
                      {!needsDispatch&&<div style={{fontSize:11,color:C.green,marginTop:2}}>✅ {T2("In-house venue — no transport needed")}</div>}
                    </div>
                    <div style={{textAlign:"center",flexShrink:0}}>
                      <div style={{fontSize:20,fontWeight:700,color:allReady?C.green:readyItems.length>0?C.amber:C.muted}}>{readyItems.length}/{menu.length}</div>
                      <div style={{fontSize:10,color:C.muted}}>{T2("ready")}</div>
                    </div>
                  </div>

                  {needsDispatch&&<div style={{padding:"10px 16px"}}>
                    {menu.map((name,idx)=>{
                      const d=kt[ev.id]?.[`d_${idx}`]||{};
                      const isReady=!!d.ready;
                      const isDispatched=!!d.dispatchReady;
                      const sec=guessSectionForDish(name);
                      const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                      return(
                        <div key={idx} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:idx<menu.length-1?`1px solid ${C.borderLight}`:"none"}}>
                          <div style={{width:28,height:28,borderRadius:8,background:isDispatched?C.green:isReady?C.amber:C.darkCard,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:isDispatched||isReady?"#0A0A0F":C.muted,flexShrink:0}}>
                            {isDispatched?"🚛":isReady?"✓":"⏳"}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:600,color:isDispatched?C.green:isReady?C.amber:C.text}}>{name}</div>
                            <div style={{fontSize:11,color:C.muted}}>{m2.icon} {sec} {isReady&&d.readyAt?`· ✅ ${T2("Ready")} ${d.readyAt}`:""} {isDispatched&&d.dispatchAt?`· 🚛 ${d.dispatchAt}`:""}</div>
                          </div>
                          {isReady&&!isDispatched&&<span style={{fontSize:11,padding:"4px 12px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontWeight:600,animation:"pulse 1.5s infinite"}}>🔔 {T2("Ready for Pickup")}</span>}
                          {isDispatched&&<span style={{fontSize:11,padding:"4px 12px",borderRadius:8,background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.green,fontWeight:600}}>🚛 {T2("Picked Up")}</span>}
                          {!isReady&&<span style={{fontSize:11,color:C.muted}}>⏳ {T2("Cooking")}</span>}
                        </div>
                      );
                    })}

                    {allReady&&!fullDispatched&&(
                      <div style={{marginTop:10,padding:"10px 14px",background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.amber}}>🔔 {T2("All dishes ready! Coordinate pickup with Kitchen.")}</div>
                      </div>
                    )}
                    {fullDispatched&&(
                      <div style={{marginTop:10,padding:"10px 14px",background:C.greenBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.green}}>🚛 {T2("Dispatched at")} {kt[ev.id]?.__dispatch_time||""}</div>
                      </div>
                    )}
                  </div>}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ══════ TRANSPORT: Loading Checklist (per function menu) ══════ */}
      {selDept==="transport"&&activeTab==="checklist"&&(()=>{
        const kt=kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        const dispatchEvs=todayEvs.filter(ev=>!/pushpanjali|exotica/i.test(ev.venue));
        return(
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>📋 {T2("Loading Checklist")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{T2("Check off items as they are loaded into vehicles")}</div>

            {dispatchEvs.length===0&&<div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,color:C.muted,fontSize:12}}>{T2("No venues need dispatch today")}</div>}

            {dispatchEvs.map(ev=>{
              const menu=safeArr(ev.menu).filter(d=>guessSectionForDish(d)!=="Beverages");
              const ck=loadChecks[ev.id]||{};
              const loaded=Object.values(ck).filter(Boolean).length;
              const hasCold=menu.some(d=>COLD_ITEMS.some(ci=>d.toLowerCase().includes(ci.toLowerCase())));
              const extras=[
                {id:"chafing",name:T2("Chafing dishes & stands"),cat:"🔧"},
                {id:"fuel",name:T2("Fuel / Sterno cans"),cat:"🔧"},
                {id:"crockery",name:T2("Crockery & Cutlery"),cat:"🍽"},
                {id:"napkins",name:T2("Napkins & dustbins"),cat:"🧹"},
                {id:"gas",name:T2("Gas cylinders"),cat:"🔥"},
              ];
              if(hasCold) extras.push({id:"ice",name:T2("Ice & cold packs"),cat:"❄"});
              const allItems=[...menu.map((d,i)=>({id:"food_"+i,name:d,cat:"🍽",isFood:true})),...extras];
              const totalLoaded=allItems.filter(item=>ck[item.id]).length;

              return(
                <Card key={ev.id} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
                  <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bg,borderBottom:`1px solid ${C.border}`}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.text}}>{ev.guest}</div>
                      <div style={{fontSize:12,color:C.muted}}>{ev.venue} · {ev.time} · {ev.pax} {T2("pax")}</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:totalLoaded===allItems.length?C.green:C.amber}}>{totalLoaded}/{allItems.length}</div>
                      <div style={{fontSize:10,color:C.muted}}>{T2("loaded")}</div>
                    </div>
                  </div>
                  <div style={{padding:"10px 16px"}}>
                    {allItems.map(item=>{
                      const checked=!!ck[item.id];
                      const foodReady=item.isFood?!!(kt[ev.id]?.[`d_${item.id.replace("food_","")}`]?.ready):true;
                      return(
                        <div key={item.id} onClick={()=>{if(!item.isFood||foodReady)setLoadChecks(p=>({...p,[ev.id]:{...(p[ev.id]||{}),[item.id]:!checked}}));}}
                          style={{display:"flex",gap:10,alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:(!item.isFood||foodReady)?"pointer":"default",opacity:item.isFood&&!foodReady?.4:1}}>
                          <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${checked?C.green:C.border}`,background:checked?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {checked&&<span style={{color:"#0A0A0F",fontSize:10,fontWeight:700}}>✓</span>}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:checked?400:600,color:checked?C.green:C.text,textDecoration:checked?"line-through":"none"}}>{item.cat} {item.name}</div>
                            {item.isFood&&!foodReady&&<div style={{fontSize:10,color:C.amber}}>⏳ {T2("Waiting — Kitchen preparing")}</div>}
                            {item.isFood&&foodReady&&!checked&&<div style={{fontSize:10,color:C.green}}>✅ {T2("Ready from Kitchen")}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalLoaded===allItems.length&&(
                    <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,background:C.greenBg,textAlign:"center"}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.green}}>✅ {T2("All items loaded — vehicle ready to depart")}</div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ══════ ODC: Events ══════ */}
      {selDept==="odc"&&activeTab==="bookings"&&(()=>{
        const allOdcEvs = safeArr(events).filter(e=>/outdoor|odc/i.test(e.venue));
        const todayOdc2 = allOdcEvs.filter(e=>e.date===TODAY);
        const tomorrowOdc2 = allOdcEvs.filter(e=>e.date===TOMORROW);
        const upcomingOdc = allOdcEvs.filter(e=>e.date>TOMORROW).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
        const kt=kitchenTracking&&typeof kitchenTracking==="object"?kitchenTracking:{};
        const selOdcEv = allOdcEvs.find(e=>e.id===selOdcId)||(selOdcId?null:todayOdc2[0]||tomorrowOdc2[0]||upcomingOdc[0]||null);
        const activeOdcId = selOdcEv?.id||null;

        return(
          <div>
            {/* Gopal status */}
            <Card style={{marginBottom:12,padding:"12px 14px",background:C.darkCard,border:"1px solid #E8D5A3"}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:40,height:40,borderRadius:10,background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:700}}>G</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>Gopal — {T2("ODC Lead")}</div>
                  <div style={{fontSize:10,color:todayOdc2.length>0?C.red:C.green}}>{todayOdc2.length>0?`🔴 ${T2("Committed to ODC today")} — ${T2("in-house venues lose oversight")}`:`✅ ${T2("Available for in-house venues")}`}</div>
                </div>
                <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:700,color:C.gold}}>{allOdcEvs.length}</div><div style={{fontSize:10,color:C.muted}}>{T2("Total ODC")}</div></div>
              </div>
            </Card>

            {/* Summary tiles */}
            <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:80,background:todayOdc2.length>0?C.redBg:C.surface,border:`1px solid ${todayOdc2.length>0?C.redBorder:C.border}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:todayOdc2.length>0?C.red:C.text}}>{todayOdc2.length}</div>
                <div style={{fontSize:10,color:C.muted}}>{T2("Today")}</div>
              </div>
              <div style={{flex:1,minWidth:80,background:C.amberBg,border:`1px solid ${C.amberBorder}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:C.amber}}>{tomorrowOdc2.length}</div>
                <div style={{fontSize:10,color:C.muted}}>{T2("Tomorrow")}</div>
              </div>
              <div style={{flex:1,minWidth:80,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:C.text}}>{upcomingOdc.length}</div>
                <div style={{fontSize:10,color:C.muted}}>{T2("Upcoming")}</div>
              </div>
              <div style={{flex:1,minWidth:80,background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:C.gold}}>{allOdcEvs.reduce((s,e)=>s+(+e.pax||0),0)}</div>
                <div style={{fontSize:10,color:C.muted}}>{T2("Total Pax")}</div>
              </div>
            </div>

            {allOdcEvs.length===0&&<div style={{textAlign:"center",padding:40,background:C.bg,borderRadius:12,color:C.muted,fontSize:13}}>{T2("No ODC events scheduled")}</div>}

            {/* Booking list */}
            {[{label:T2("Today"),evs:todayOdc2,color:C.red},{label:T2("Tomorrow"),evs:tomorrowOdc2,color:C.amber},{label:T2("Upcoming"),evs:upcomingOdc,color:C.muted}].map(group=>{
              if(group.evs.length===0) return null;
              return(
                <div key={group.label} style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:group.color,marginBottom:8,textTransform:"uppercase"}}>{group.label} ({group.evs.length})</div>
                  {group.evs.map(ev=>{
                    const isSel=activeOdcId===ev.id;
                    const menu=safeArr(ev.menu).filter(d=>guessSectionForDish(d)!=="Beverages");
                    const readyCount=menu.filter((_,i)=>{const d=kt[ev.id]?.[`d_${i}`];return d?.ready||d?.dispatchReady;}).length;
                    return(
                      <Card key={ev.id} onClick={()=>setSelOdcId(isSel?null:ev.id)} style={{marginBottom:8,padding:0,overflow:"hidden",cursor:"pointer",border:`2px solid ${isSel?C.gold:C.border}`}}>
                        <div style={{padding:"14px 16px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div>
                              <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{ev.guest}</div>
                              <div style={{fontSize:12,color:C.muted,marginTop:3}}>📍 {ev.venue} · ⏰ {ev.time} · 👥 {ev.pax} {T2("pax")}</div>
                              <div style={{fontSize:12,color:C.muted}}>{ev.menuPackage||"Custom"} · {menu.length} {T2("dishes")} · 🚛 {T2("Dispatch")}: {calcDispatch(ev.time)}</div>
                              {ev.date>TODAY&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>📅 {ev.date}</div>}
                            </div>
                            <div style={{textAlign:"center",flexShrink:0}}>
                              <div style={{fontSize:18,fontWeight:700,color:readyCount===menu.length&&menu.length>0?C.green:readyCount>0?C.amber:C.muted}}>{readyCount}/{menu.length}</div>
                              <div style={{fontSize:10,color:C.muted}}>{T2("ready")}</div>
                            </div>
                          </div>
                          {ev.special&&<div style={{background:C.redBg,border:`1px solid ${C.redBorder}`,borderRadius:8,padding:"6px 10px",fontSize:11,color:C.red,marginTop:8}}>⚠ {ev.special}</div>}
                        </div>

                        {/* Expanded detail */}
                        {isSel&&(
                          <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 16px",background:C.bg}}>
                            {/* Menu breakdown by section */}
                            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>🍽 {T2("Menu Breakdown")}</div>
                            {(()=>{
                              const bySec={};
                              menu.forEach((n,i)=>{const s=guessSectionForDish(n);if(!bySec[s])bySec[s]=[];bySec[s].push({name:n,idx:i});});
                              return Object.entries(bySec).map(([sec,items])=>{
                                const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
                                const rd=items.filter(d=>{const dk=kt[ev.id]?.[`d_${d.idx}`];return dk?.ready||dk?.dispatchReady;}).length;
                                return(
                                  <div key={sec} style={{marginBottom:6}}>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                                      <span style={{fontSize:12,fontWeight:600,color:m2.color}}>{m2.icon} {sec}</span>
                                      <span style={{fontSize:11,color:rd===items.length?C.green:C.muted}}>{rd}/{items.length}</span>
                                    </div>
                                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                      {items.map((d,di)=>{
                                        const rdy=!!(kt[ev.id]?.[`d_${d.idx}`]?.ready||kt[ev.id]?.[`d_${d.idx}`]?.dispatchReady);
                                        return <span key={di} style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:rdy?C.greenBg:C.surface,border:`1px solid ${rdy?C.greenBorder:C.border}`,color:rdy?C.green:C.text}}>{rdy?"✓ ":""}{d.name}</span>;
                                      })}
                                    </div>
                                  </div>
                                );
                              });
                            })()}

                            {/* Key info grid */}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
                              <div style={{background:C.surface,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                                <div style={{fontSize:11,color:C.muted}}>{T2("Venue")}</div>
                                <div style={{fontSize:12,fontWeight:600,color:C.text}}>{ev.venue}</div>
                              </div>
                              <div style={{background:C.surface,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                                <div style={{fontSize:11,color:C.muted}}>{T2("Lead")}</div>
                                <div style={{fontSize:12,fontWeight:600,color:C.gold}}>Gopal</div>
                              </div>
                              <div style={{background:C.surface,borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                                <div style={{fontSize:11,color:C.muted}}>{T2("Dispatch")}</div>
                                <div style={{fontSize:12,fontWeight:600,color:C.gold}}>{calcDispatch(ev.time)}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ══════ ODC: Kitchen Tasks (full KitchenHub for ODC events) ══════ */}
      {selDept==="odc"&&activeTab==="kitchen"&&(
        <KitchenHub events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} odcOnly={true}/>
      )}

      {/* ══════ ODC: Site Checklist ══════ */}
      {selDept==="odc"&&activeTab==="checklist"&&(()=>{
        const ODC_PHASES = [
          {phase:"site",label:T2("Site Recce"),icon:"📍",checks:[
            {id:"venue_confirm",l:T2("Venue confirmed & keys received")},{id:"power",l:T2("Power supply checked")},{id:"water",l:T2("Water supply available")},{id:"parking",l:T2("Vehicle parking identified")},{id:"kitchen_area",l:T2("Kitchen setup area marked")},{id:"guest_flow",l:T2("Guest entry/exit flow planned")}]},
          {phase:"equipment",label:T2("Equipment"),icon:"🔧",checks:[
            {id:"generators",l:T2("Generators positioned & tested")},{id:"gas_cylinders",l:T2("Gas cylinders loaded")},{id:"tandoors",l:T2("Tandoors & burners setup")},{id:"fridge",l:T2("Fridge truck at site")},{id:"tables",l:T2("Tables & counters placed")},{id:"tent",l:T2("Kitchen tent / shade ready")}]},
          {phase:"food",label:T2("Food Dispatch"),icon:"🍛",checks:[
            {id:"dry_load",l:T2("Dry items loaded & checked")},{id:"cold_load",l:T2("Cold items in fridge truck")},{id:"crockery",l:T2("Crockery loaded per checklist")},{id:"consumables",l:T2("Gas, coal, napkins, dustbins")},{id:"staff_food",l:T2("Staff meals packed")}]},
          {phase:"service",label:T2("On-Site Service"),icon:"🍽️",checks:[
            {id:"buffet_ready",l:T2("Buffet counters dressed")},{id:"live_counters",l:T2("Live counters operational")},{id:"water_station",l:T2("Water & welcome drink ready")},{id:"staff_uniform",l:T2("All staff in uniform")},{id:"gopal_walkthrough",l:T2("Gopal final walkthrough done")}]},
          {phase:"teardown",label:T2("Teardown"),icon:"📦",checks:[
            {id:"food_packed",l:T2("Leftover food packed")},{id:"equipment_count",l:T2("Equipment count verified")},{id:"crockery_count",l:T2("Crockery count — breakage noted")},{id:"site_clean",l:T2("Site cleaned")},{id:"vehicles_loaded",l:T2("All vehicles loaded & departed")}]},
        ];
        const allOdc = [...odcEvs,...tomorrowOdc];
        return (
          <div>
            {allOdc.map(ev=>{
              const evChecks = odcChecks[ev.id]||{};
              return (
                <Card key={ev.id} style={{marginBottom:12,padding:0,overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",background:C.wineBg,borderBottom:`1px solid ${C.wineBorder}`}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.gold}}>{ev.guest}</div>
                    <div style={{fontSize:12,color:C.muted}}>{ev.date===TODAY?T2("Today"):T2("Tomorrow")} · {ev.time} · {ev.pax} {T2("pax")}</div>
                  </div>
                  {ODC_PHASES.map(phase=>{
                    const doneCt = phase.checks.filter(c=>evChecks[phase.phase+"_"+c.id]).length;
                    return (
                      <div key={phase.phase} style={{padding:"12px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                          <span style={{fontSize:12,fontWeight:700,color:C.text}}>{phase.icon} {phase.label}</span>
                          <span style={{fontSize:10,fontWeight:600,color:doneCt===phase.checks.length?C.green:C.muted}}>{doneCt}/{phase.checks.length}</span>
                        </div>
                        {phase.checks.map(c=>{
                          const key = phase.phase+"_"+c.id;
                          const done = !!evChecks[key];
                          return (
                            <div key={c.id} onClick={()=>setOdcChecks(p=>({...p,[ev.id]:{...(p[ev.id]||{}),[key]:!done}}))}
                              style={{display:"flex",gap:8,alignItems:"center",padding:"4px 0",cursor:"pointer"}}>
                              <div style={{width:20,height:20,borderRadius:3,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                {done&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                              </div>
                              <span style={{fontSize:11,color:done?C.green:C.text,textDecoration:done?"line-through":"none"}}>{c.l}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </Card>
              );
            })}
            {allOdc.length===0&&<div style={{textAlign:"center",padding:24,background:C.bg,borderRadius:10,color:C.muted,fontSize:12}}>{T2("No ODC events scheduled")}</div>}
          </div>
        );
      })()}

      {/* ══════ REPAIR & MAINTENANCE TAB (all depts) ══════ */}
      {activeTab==="repair"&&<RepairMaintenance lang={lang} currentDept={selDept||forceDept||"kitchen"}/>}

    </div>
  );
}

export { DeptView };
