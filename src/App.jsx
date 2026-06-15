// Ambria FnB Operations — Root App Component
// Decomposed: all screens, data, and utilities are in separate modules

import React, { useState, useRef, useEffect } from "react";
import { supabase } from './lib/supabase.js';
import { dbLoad, dbUpsert, dbDelete, dbSubscribe } from './lib/db.js';

// Data
import { C, hydrateConstants } from './data/constants.js';
import { MENU_PACKAGES, hydrateMenuPackages } from './data/menuPackages.js';
import { EMPLOYEE_DB_INIT, hydrateStaffData } from './data/staffData.js';
import { hydrateRecipeData } from './data/recipeData.js';
import { T } from './data/translations.js';
import { canAccessScreen } from './data/permissions.js';
import { loadAllConfig } from './lib/dbConfig.js';

// Utils
import './utils/styles.js';
import { TODAY, TODAY_LABEL, safeArr, safeObj, normalizeAtt } from './utils/helpers.js';

// Components
import { ErrorBoundary, Avatar } from './components/SharedUI.jsx';
import { LoginScreen } from './components/LoginScreen.jsx';
import { Dashboard } from './components/Dashboard.jsx';
import { DeptView } from './components/DeptView.jsx';
import { StaffView } from './components/StaffView.jsx';
import { KitchenHub } from './components/KitchenHub.jsx';
import { KioskAttendance } from './components/KioskAttendance.jsx';
import { TeamHub } from './components/TeamHub.jsx';
import { TransportDispatch } from './components/TransportDispatch.jsx';
import { StoreModule } from './components/StoreModule.jsx';
import { MenuPackagesView } from './components/MenuPackagesView.jsx';
import { RepairMaintenance } from './components/RepairMaintenance.jsx';
import { VendorDirectory } from './components/VendorDirectory.jsx';
import { AccessManager } from './components/AccessManager.jsx';
import { GateKiosk } from './components/GateKiosk.jsx';
import { ActivityLog } from './components/ActivityLog.jsx';

// ── LMS menu name normalization ──
// LMS sends names like "Double Magnum - Veg", our keys are "Double Magnum Veg"
function matchMenuPackage(rawName) {
  if (!rawName) return "";
  if (MENU_PACKAGES[rawName]) return rawName; // exact match
  // Normalize: strip dashes, collapse spaces, lowercase compare
  const norm = s => s.replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const target = norm(rawName);
  const match = Object.keys(MENU_PACKAGES).find(k => norm(k) === target);
  return match || rawName; // return matched key or original (will fall through as custom)
}

export default function App() {
  const [activeDept, setActiveDept]   = useState(null); // null = dept selector
  const [screen,setScreen]           = useState("dashboard");
  const [lang,setLang]               = useState("en");
  const [repairs,setRepairs]         = useState([]);
  const T2 = s => T(s, lang);

  // ── PWA auto-update ──
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(function(){
    if(!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(function(reg){
      reg.addEventListener('updatefound', function(){
        var nw = reg.installing;
        if(!nw) return;
        nw.addEventListener('statechange', function(){
          if(nw.state === 'activated' && navigator.serviceWorker.controller){
            setUpdateReady(true);
          }
        });
      });
    });
  },[]);

  // ── Attendance ──
  const [attendance,setAttendance_raw] = useState(function() {
    try { var s=localStorage.getItem('ambria_attendance'); return s?JSON.parse(s).map(normalizeAtt):[]; } catch(e){return [];}
  });
  useEffect(function() {
    try { localStorage.setItem('ambria_attendance', JSON.stringify(attendance)); } catch(e){}
  }, [attendance]);
  const setAttendance = (updater) => {
    setAttendance_raw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Normalize every record to unified schema on the way in
      const normalized = safeArr(next).map(normalizeAtt);
      const prevByKey = new Map(safeArr(prev).map(a=>[(a.staff_id||a.staffId)+"_"+a.date, a]));
      normalized.forEach(a => {
        const key = (a.staff_id||a.staffId)+"_"+a.date;
        const old = prevByKey.get(key);
        if(!old || old.status!==a.status || old.in_time!==a.in_time || old.out_time!==a.out_time) {
          dbUpsert("attendance",{staff_id:a.staff_id,staff_name:a.staff_name,section:a.section,
            date:a.date,status:a.status||"Present",in_time:a.in_time||null,out_time:a.out_time||null},
            "staff_id,date").catch(e=>console.error("att sync:",e));
        }
      });
      return normalized;
    });
  };

  // ── Leaves ──
  const [leaves,setLeaves_raw]       = useState([]);
  const setLeaves = (updater) => {
    setLeaves_raw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const prevMap = new Map(safeArr(prev).map(l=>[String(l.id), l]));
      safeArr(next).forEach(l => {
        const idStr = String(l.id);
        const old = prevMap.get(idStr);
        if(!old || old.status!==l.status) {
          dbUpsert("leaves",{id:idStr,staff_id:String(l.staffId||l.staff_id||""),staff_name:l.staffName,section:l.staffSection||l.section||"",from_date:l.from,to_date:l.to,reason:l.reason,status:l.status||"Pending"},"id").catch(e=>console.error("leaves sync:",e));
        }
      });
      return next;
    });
  };

  // ── Events ──
  const [events,setEvents_raw]       = useState([]);
  const setEvents = (updater) => {
    setEvents_raw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const prevMap = new Map(safeArr(prev).map(e=>[e.id, e]));
      const nextMap = new Map(safeArr(next).map(e=>[e.id, e]));
      nextMap.forEach((ev, id) => {
        if(!prevMap.has(id) || prevMap.get(id) !== ev) {
          // For LMS events, don't write the resolved dish array back — keep menu:[] in DB
          const isLms = !!(ev.lms_source);
          const menuToStore = isLms ? [] : (ev.menu||[]);
          dbUpsert("events",{id:ev.id,guest:ev.guest,venue:ev.venue,date:ev.date,time:ev.time,type:ev.type,pax:+ev.pax||0,veg:+ev.veg||0,nonveg:+ev.nonveg||0,menu_package:ev.menuPackage||null,menu:menuToStore,special:ev.special||null,extras:ev.extras||[]},"id").catch(e=>console.error("ev sync:",e));
        }
      });
      prevMap.forEach((_,id) => {
        if(!nextMap.has(id)) dbDelete("events","id",id).catch(e=>console.error("ev del:",e));
      });
      return next;
    });
  };

  // ── Kitchen Tracking ──
  const [kitchenTracking_raw, setKitchenTracking_raw] = useState({});
  const setKitchenTracking = (updater) => {
    setKitchenTracking_raw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      Object.keys(next||{}).forEach(evId => {
        const prevEv = prev[evId]||{};
        const nextEv = next[evId]||{};
        Object.entries(nextEv).forEach(([dishKey, val]) => {
          if(dishKey.startsWith("__")) return; // skip meta keys
          const prevVal = prevEv[dishKey];
          if(val && JSON.stringify(val) !== JSON.stringify(prevVal)) {
            const safeData = JSON.parse(JSON.stringify(val));
            dbUpsert("kitchen_tracking",{ev_id:evId,dish_key:dishKey,data:safeData},"ev_id,dish_key")
              .then(()=>console.log("✅ KT synced:",dishKey))
              .catch(e=>console.error("❌ KT sync fail:",dishKey,e));
          }
        });
      });
      return next;
    });
  };
  const kitchenTracking = kitchenTracking_raw;

  // ── Transport Queue ──
  const [transportQueue, setTransportQueue_raw] = useState([]);
  const setTransportQueue = (updater) => {
    setTransportQueue_raw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("ambria_transport_queue", JSON.stringify(next)); } catch(e) {}
      const prevMap = new Map(safeArr(prev).map(q=>[q.id, q]));
      const nextMap = new Map(safeArr(next).map(q=>[q.id, q]));
      nextMap.forEach((q, id) => {
        if(!prevMap.has(id) || prevMap.get(id).status !== q.status) {
          dbUpsert("transport_queue",{id:q.id,dish_name:q.dishName,event_guest:q.event,pax:+q.pax||0,venue:q.venue,event_date:q.eventDate,prepared_by:q.preparedBy,marked_at:q.markedAt,status:q.status,picked_up_at:q.pickedUpAt||null},"id").catch(e=>console.error("tq sync:",e));
        }
      });
      prevMap.forEach((_,id) => {
        if(!nextMap.has(id)) dbDelete("transport_queue","id",id).catch(e=>console.error("tq del:",e));
      });
      return next;
    });
  };

  const [outsideChefAtt,setOutsideChefAtt] = useState([]);
  const [currentUser,setCurrentUser] = useState(null);
  const [empDb, setEmpDb]             = useState(EMPLOYEE_DB_INIT);
  const [appReady, setAppReady]       = useState(false);
  const [supaLive, setSupaLive]       = useState(null); // null=checking, true=live, false=offline

  // ── Master load: session + all data ──
  useEffect(() => {
    async function loadAll() {
      // Clear any legacy localStorage kitchen tracking keys
      try { localStorage.removeItem('ambria_kt'); localStorage.removeItem('ambria_kitchen_tracking'); } catch(e) {}
      // Restore session (always localStorage — device-specific)
      try {
        const suRaw = localStorage.getItem("ambria_session_user");
        if(suRaw){ const emp=JSON.parse(suRaw); if(emp&&(emp.id||emp.staffListId||emp.staff_id)){ const rid=emp.id||emp.staffListId||emp.staff_id; setCurrentUser({...emp,id:rid,staffListId:emp.staffListId||rid}); } }
      } catch(e) {}

      // ── Hydrate config data from Supabase (replaces hardcoded constants) ──
      try {
        const cfg = await loadAllConfig();
        hydrateConstants(cfg);
        hydrateMenuPackages(cfg.menuPackages);
        hydrateStaffData({ groomingChecks: (cfg.checklists || {}).grooming || [] });
        hydrateRecipeData(cfg);
      } catch(e) { console.warn('Config hydration failed, using fallbacks:', e); }

      const [staffData, eventsData, attData, lvData, repairData, ktData, tqData] = await Promise.all([
        dbLoad('staff', EMPLOYEE_DB_INIT),
        dbLoad('events', []),
        dbLoad('attendance', []),
        dbLoad('leaves', []),
        dbLoad('repair_tickets', []),
        dbLoad('kitchen_tracking', []),
        dbLoad('transport_queue', []),
      ]);

      // Merge: Supabase is authoritative; fill any missing entries from EMPLOYEE_DB_INIT
      // (ensures device/role accounts — gate kiosks, section tablets, HC — always exist
      //  even if Supabase DB was not re-seeded after adding them)
      const supaIds = new Set(staffData.map(s => s.staff_id || s.staffListId || s.id).filter(Boolean));
      const initOnly = EMPLOYEE_DB_INIT.filter(e => !supaIds.has(e.staff_id) && !supaIds.has(e.staffListId));
      setEmpDb([...staffData, ...initOnly].map(s=>({...s,staffListId:s.staff_id||s.staffListId,is_active:s.is_active!==false})));
      // Use whatever Supabase returns (empty is fine — LMS sync will populate)
      const finalEvents = eventsData;
      setEvents_raw(finalEvents.map(e=>{
        let menu = e.menu;
        if (!Array.isArray(menu)) {
          if (typeof menu === 'string' && menu) { try { menu = JSON.parse(menu); } catch(err) { menu = []; } }
          else { menu = []; }
        }
        // LMS events arrive with menu:[] — resolve from menu_package
        const rawPkg = e.menu_package||e.menuPackage||"";
        const pkg = matchMenuPackage(rawPkg);
        if(menu.length===0 && pkg && MENU_PACKAGES[pkg]) menu = MENU_PACKAGES[pkg];
        let extras = e.extras;
        if (!Array.isArray(extras)) extras = [];
        return {...e, menuPackage:pkg, menu, extras};
      }));
      const todayAtt = attData.filter(a=>a.date===TODAY);
      setAttendance_raw(todayAtt.map(normalizeAtt));
      setLeaves_raw(lvData.map(l=>({id:l.id,staffId:l.staff_id||l.staffId,staffName:l.staff_name||l.staffName,staffSection:l.section||l.staffSection||"",from:l.from_date||l.from,to:l.to_date||l.to,reason:l.reason,status:l.status})));
      setRepairs(repairData.map(t=>({...t,assignTo:t.assign_to||t.assignTo,createdBy:t.created_by||t.createdBy,updates:t.updates||[]})));
      if(ktData.length>0){
        const ktObj={};
        ktData.forEach(row=>{if(!ktObj[row.ev_id])ktObj[row.ev_id]={};ktObj[row.ev_id][row.dish_key]=row.data||{};});
        setKitchenTracking_raw(ktObj);
      }
      if(tqData.length>0){
        setTransportQueue_raw(tqData.map(q=>({id:q.id,dishName:q.dish_name,event:q.event_guest,pax:q.pax,venue:q.venue,eventDate:q.event_date,preparedBy:q.prepared_by,markedAt:q.marked_at,status:q.status,pickedUpAt:q.picked_up_at||undefined})));
      } else {
        try{const c=JSON.parse(localStorage.getItem("ambria_transport_queue")||"[]");if(c.length)setTransportQueue_raw(c);}catch(e){}
      }
      // Seed AM001 to Supabase on every load (idempotent)
      const am001=EMPLOYEE_DB_INIT.find(e=>e.staff_id==='AM001'||e.staffListId==='AM001');
      if(am001) dbUpsert('staff',{staff_id:am001.staff_id||am001.staffListId,name:am001.name,section:am001.section||null,dept:am001.dept||null,role:'admin',pin:String(am001.pin||'0000'),is_admin:true,is_active:true,joining:am001.joining||null,phone:am001.phone||null},'staff_id').catch(()=>{});

      // Auto-sync from LMS (15-min cooldown)
      try{
        const lastSync=localStorage.getItem('ambria_lms_last_sync_ts');
        const cooldown=15*60*1000; // 15 minutes
        if(supabase&&(!lastSync||Date.now()-parseInt(lastSync)>cooldown)){
          supabase.functions.invoke('lms-sync',{body:{triggered_by:'auto-boot'}})
            .then(({data})=>{
              if(data?.status==='success') console.log(`✅ LMS auto-sync: ${data.events_upserted} events`);
              else console.warn('LMS auto-sync returned:',data);
              try{localStorage.setItem('ambria_lms_last_sync_ts',String(Date.now()));}catch(e){}
              const now=new Date().toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'});
              try{localStorage.setItem('ambria_lms_last_sync',now);}catch(e){}
            })
            .catch(e=>console.warn('LMS auto-sync failed:',e));
        }
      }catch(e){}

      setAppReady(true);
    }
    loadAll();
  }, []);

  // ── Realtime subscriptions (after data loaded) ──
  useEffect(() => {
    if (!appReady) return;
    const u1 = dbSubscribe('staff', (payload) => {
      if(payload.eventType==='INSERT') setEmpDb(p=>{if(p.some(s=>(s.staffListId||s.staff_id)===payload.new.staff_id))return p;return[...p,{...payload.new,staffListId:payload.new.staff_id}];});
      if(payload.eventType==='UPDATE') setEmpDb(p=>p.map(s=>(s.staffListId||s.staff_id)===payload.new.staff_id?{...s,...payload.new,staffListId:payload.new.staff_id}:s));
      if(payload.eventType==='DELETE') setEmpDb(p=>p.filter(s=>(s.staffListId||s.staff_id)!==payload.old.staff_id));
    });
    const u2 = dbSubscribe('attendance', (payload) => {
      if(payload.eventType==='INSERT'||payload.eventType==='UPDATE'){
        if(payload.new?.date!==TODAY)return;
        const r=normalizeAtt(payload.new);
        setAttendance_raw(p=>{const key=r.staff_id;const ex=p.some(a=>(a.staff_id||a.staffId)===key&&a.date===r.date);return ex?p.map(a=>(a.staff_id||a.staffId)===key&&a.date===r.date?r:a):[...p,r];});
      }
      if(payload.eventType==='DELETE') setAttendance_raw(p=>p.filter(a=>(a.staff_id||a.staffId)!==payload.old.staff_id||a.date!==payload.old.date));
    });
    const u3 = dbSubscribe('repair_tickets', (payload) => {
      const t=payload.new?{...payload.new,assignTo:payload.new.assign_to,createdBy:payload.new.created_by,updates:payload.new.updates||[]}:null;
      if(payload.eventType==='INSERT'&&t) setRepairs(p=>{if(p.some(x=>x.id===t.id))return p;return[t,...p];});
      if(payload.eventType==='UPDATE'&&t) setRepairs(p=>p.map(x=>x.id===t.id?t:x));
      if(payload.eventType==='DELETE') setRepairs(p=>p.filter(x=>x.id!==payload.old.id));
    });
    const u4 = dbSubscribe('events', (payload) => {
      let ev=null;
      if(payload.new){
        let menu=payload.new.menu||[];
        if(!Array.isArray(menu)){try{menu=JSON.parse(menu);}catch(e){menu=[];}}
        const pkg=matchMenuPackage(payload.new.menu_package||"");
        if(menu.length===0 && pkg && MENU_PACKAGES[pkg]) menu=MENU_PACKAGES[pkg];
        ev={...payload.new,menuPackage:pkg,menu,extras:payload.new.extras||[]};
      }
      if(payload.eventType==='INSERT'&&ev) setEvents_raw(p=>[...p,ev]);
      if(payload.eventType==='UPDATE'&&ev) setEvents_raw(p=>p.map(e=>e.id===ev.id?ev:e));
      if(payload.eventType==='DELETE') setEvents_raw(p=>p.filter(e=>e.id!==payload.old.id));
    });
    const u5 = dbSubscribe('kitchen_tracking', (payload) => {
      if(payload.new){const {ev_id,dish_key,data}=payload.new;setKitchenTracking_raw(p=>({...p,[ev_id]:{...(p[ev_id]||{}),[dish_key]:data||{}}}));}
    });
    const u6 = dbSubscribe('leaves', (payload) => {
      const nl=payload.new?{id:payload.new.id,staffId:payload.new.staff_id,staffName:payload.new.staff_name,staffSection:payload.new.section||"",from:payload.new.from_date,to:payload.new.to_date,reason:payload.new.reason,status:payload.new.status}:null;
      if(payload.eventType==='INSERT'&&nl) setLeaves_raw(p=>{if(p.some(x=>x.id===nl.id))return p;return[...p,nl];});
      if(payload.eventType==='UPDATE'&&nl) setLeaves_raw(p=>p.map(x=>x.id===nl.id?nl:x));
      if(payload.eventType==='DELETE') setLeaves_raw(p=>p.filter(x=>x.id!==payload.old.id));
    });
    const u7 = dbSubscribe('transport_queue', (payload) => {
      const nq=payload.new?{id:payload.new.id,dishName:payload.new.dish_name,event:payload.new.event_guest,pax:payload.new.pax,venue:payload.new.venue,eventDate:payload.new.event_date,preparedBy:payload.new.prepared_by,markedAt:payload.new.marked_at,status:payload.new.status,pickedUpAt:payload.new.picked_up_at||undefined}:null;
      if(payload.eventType==='INSERT'&&nq) setTransportQueue_raw(p=>{if(p.some(i=>i.id===nq.id))return p;return[...p,nq];});
      if(payload.eventType==='UPDATE'&&nq) setTransportQueue_raw(p=>p.map(i=>i.id===nq.id?nq:i));
      if(payload.eventType==='DELETE') setTransportQueue_raw(p=>p.filter(i=>i.id!==payload.old.id));
    });
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, [appReady]);

  // ── Supabase connectivity indicator + offline queue replay ──
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  useEffect(() => {
    if(!supabase){setSupaLive(false);return;}
    const checkQueue=()=>import('./lib/offlineQueue.js').then(m=>m.getQueueSize()).then(n=>setOfflineQueueCount(n)).catch(()=>{});
    const ping=()=>supabase.from('staff').select('count',{count:'exact',head:true}).then(({error})=>{
      const live=!error;
      setSupaLive(live);
      if(live){
        import('./lib/offlineQueue.js').then(m=>m.replayQueue(supabase)).then(n=>{
          if(n>0)console.log('✅ Replayed',n,'offline writes');
          checkQueue();
        }).catch(()=>{});
      }
    }).catch(()=>setSupaLive(false));
    ping();
    checkQueue();
    const onOnline=()=>ping();
    const onOffline=()=>{setSupaLive(false);checkQueue();};
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOffline);
    const interval=setInterval(()=>{if(navigator.onLine)ping();checkQueue();},30000);
    return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);clearInterval(interval);};
  },[]);

  // Admin skips dept selector — go straight to Management Dashboard
  useEffect(function(){
    if (currentUser && currentUser.role === 'admin' && !activeDept) {
      setActiveDept('management');
      setScreen('dashboard');
    }
  }, [currentUser]);

  async function syncStaff(action, data) {
    const record = {
      staff_id: data.staffListId||data.staff_id, name: data.name||'',
      section: data.section||null, dept: data.dept||null, role: data.role||'staff',
      pin: String(data.pin||'0000'), is_admin: data.role==='admin',
      is_active: data.is_active!==false, joining: data.joining||null,
      phone: data.phone||null, custom_screens: data.custom_screens||null,
      permissions: data.permissions||null,
    };
    if(action==='upsert') await dbUpsert('staff', record, 'staff_id');
    if(action==='delete') await dbDelete('staff', 'staff_id', record.staff_id);
  }

  function handleLogin(emp){
    setCurrentUser(emp);
    try{ localStorage.setItem("ambria_session_user",JSON.stringify(emp)); }catch(e){}
  }
  function handleLogout(){
    setCurrentUser(null); setActiveDept(null);
    try{ localStorage.removeItem("ambria_session_user"); }catch(e){}
  }

  // ── NAV per department ──
  const DEPT_NAV = {
    kitchen: [
      {id:"_divider_k1",label:"KITCHEN",icon:"",divider:true},
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"kitchen",label:"Kitchen",icon:"👨‍🍳"},
      {id:"_divider_k2",label:"OPERATIONS",icon:"",divider:true},
      {id:"store",label:"Store & Inventory",icon:"📦"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
      {id:"_divider_k3",label:"MANAGEMENT",icon:"",divider:true},
      {id:"team",label:"Team & Attendance",icon:"👥"},
    ],
    service: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_service",label:"Service Operations",icon:"🍽️"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"vendors",label:"Vendor Directory",icon:"📇"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    crockery: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_crockery",label:"Crockery Operations",icon:"🍶"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    beverages: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_beverages",label:"Beverage Operations",icon:"🥤"},
      {id:"menus",label:"Menu",icon:"📜"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    transport: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"transport",label:"Transport & Dispatch",icon:"🚛"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    odc: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_odc",label:"ODC Operations",icon:"🏕️"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
    ],
    management: [
      {id:"_divider_kitchen",label:"KITCHEN",icon:"",divider:true},
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"kitchen",label:"Kitchen Hub",icon:"👨‍🍳"},
      {id:"_divider_ops",label:"OPERATIONS",icon:"",divider:true},
      {id:"menus",label:"Menu Packages",icon:"📜"},
      {id:"transport",label:"Transport & Dispatch",icon:"🚛"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
      {id:"vendors",label:"Vendor Directory",icon:"📇"},
      {id:"repair",label:"Repair & Maintenance",icon:"🔧"},
      {id:"dept_service",label:"Service Ops",icon:"🍽"},
      {id:"dept_crockery",label:"Crockery Ops",icon:"🍶"},
      {id:"dept_beverages",label:"Beverages Ops",icon:"🥤"},
      {id:"dept_odc",label:"ODC Operations",icon:"🏕"},
      {id:"_divider_mgmt",label:"MANAGEMENT",icon:"",divider:true},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"access",label:"Access Manager",icon:"🔐"},
      {id:"logs",label:"Activity Log",icon:"📋"},
    ],
  };

  const DEPT_META = {
    kitchen:{name:"Kitchen",icon:"👨‍🍳",color:"#D4A843"},
    service:{name:"Service",icon:"🍽️",color:"#5B8FD0"},
    crockery:{name:"Crockery",icon:"🍶",color:"#8A70C8"},
    beverages:{name:"Beverages",icon:"🥤",color:"#50B0A0"},
    transport:{name:"Transportation",icon:"🚛",color:"#D4A843"},
    odc:{name:"ODC",icon:"🏕️",color:C.gold},
    management:{name:"Management",icon:"🔐",color:"#9060C8"},
  };

  const curNav = activeDept ? (DEPT_NAV[activeDept]||DEPT_NAV.kitchen) : [];
  const curDeptMeta = DEPT_META[activeDept]||{name:"",icon:"",color:C.gold};

  const pendingLv = (leaves||[]).filter(l=>l.status==="Pending").length;
  const showStaffView = currentUser&&currentUser.role==="staff";

  // Loading
  if(!appReady) return (
    <div style={{minHeight:"100vh",background:"#F7F5F0",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{fontSize:32,marginBottom:4}}>🔥</div>
      <div style={{color:"#8B5E2F",fontSize:14,fontFamily:"var(--font-display)"}}>Loading Ambria FnB Operations…</div>
    </div>
  );
  // Login
  if(!currentUser) return <LoginScreen empDb={empDb} onLogin={handleLogin} lang={lang}/>;  // Staff self-service
  if(showStaffView) return <StaffView user={currentUser} attendance={attendance} leaves={leaves} setLeaves={setLeaves} onLogout={handleLogout} lang={lang}/>;
  // ── GATE KIOSK INTERCEPT ──
  if(currentUser && currentUser.role === 'kiosk_gate') {
    return (
      <div style={{minHeight:'100vh',background:'#F7F5F0',padding:20}}>
        <GateKiosk empDb={empDb} attendance={attendance}
          setAttendance={setAttendance} currentUser={currentUser}
          setCurrentUser={setCurrentUser} lang={lang}/>
      </div>
    );
  }
  // ── SECTION TABLET INTERCEPT ──
  if(currentUser && currentUser.role && currentUser.role.startsWith('section_')) {
    return (
      <div style={{minHeight:'100vh',background:C.bg}}>
        <div style={{padding:'12px 20px',background:C.surface,
          borderBottom:`1px solid ${C.border}`,display:'flex',
          justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>
              {currentUser.section==='Chinese'?'🥢':currentUser.section==='Tandoor'?'🔥':
               currentUser.section==='Indian Curries'?'🍛':currentUser.section==='Chaat'?'🥗':
               currentUser.section==='Sweets'?'🍮':currentUser.section==='Continental'?'🍝':'🍽'}
            </span>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.gold,
                fontFamily:'var(--font-display)'}}>{currentUser.section} Section</div>
              <div style={{fontSize:11,color:C.muted}}>Kitchen Tablet · {TODAY_LABEL}</div>
            </div>
          </div>
          <button onClick={function(){setCurrentUser(null);}}
            style={{padding:'8px 16px',borderRadius:10,background:C.surface,
              border:`1px solid ${C.border}`,color:C.muted,fontSize:11,
              cursor:'pointer'}}>
            ← Exit
          </button>
        </div>
        <div style={{padding:'20px'}}>
          <KitchenHub events={events} kitchenTracking={kitchenTracking}
            setKitchenTracking={setKitchenTracking} lang={lang}
            currentUser={currentUser} transportQueue={transportQueue} setTransportQueue={setTransportQueue}/>
        </div>
      </div>
    );
  }
  // ── DEPT SELECTOR (first screen for everyone) ──
  if(!activeDept) {
    if(currentUser?.role === 'admin') return null; // useEffect redirects to management dashboard
    return (
      <DeptView
        attendance={attendance} setAttendance={setAttendance}
        events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking}
        lang={lang} setLang={setLang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb}
        onSelectDept={(deptId)=>{if(deptId==="access"){setActiveDept("management");setScreen("access");}else{setActiveDept(deptId);setScreen("dashboard");}}}
        onLogout={handleLogout}
        currentUser={currentUser}
      />
    );
  }

  const LOCK_SCREEN = (
    <div style={{textAlign:"center",padding:"60px 20px"}}>
      <div style={{fontSize:48,marginBottom:16}}>🔒</div>
      <div style={{fontSize:18,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:8}}>Access Restricted</div>
      <div style={{fontSize:13,color:C.muted}}>You don't have permission to view this section. Contact admin (Abhi) to get access.</div>
    </div>
  );

  function renderScreen(s){
    if (!canAccessScreen(currentUser, s)) return LOCK_SCREEN;
    switch(s){
      case "dashboard":      return <Dashboard attendance={attendance} events={events} setEvents={setEvents} leaves={leaves} setScreen={setScreen} kitchenTracking={kitchenTracking} repairs={repairs} lang={lang} currentUser={currentUser} empDb={empDb}/>;
      case "team":           return <TeamHub attendance={attendance} setAttendance={setAttendance} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} events={events} lang={lang} activeDept={activeDept} currentUser={currentUser} syncToServer={syncStaff}/>;
      case "kitchen":        return <KitchenHub events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} currentUser={currentUser} transportQueue={transportQueue} setTransportQueue={setTransportQueue}/>;
      case "menus":          return <MenuPackagesView lang={lang}/>;
      case "transport":      return <TransportDispatch events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} currentUser={currentUser} transportQueue={transportQueue} setTransportQueue={setTransportQueue}/>;
      case "store":          return <StoreModule events={events} lang={lang} currentUser={currentUser}/>;
      case "repair":         return <RepairMaintenance lang={lang} currentDept="management" currentUser={currentUser}/>;
      case "vendors":        return <VendorDirectory lang={lang}/>;
      case "access":         return <AccessManager lang={lang} empDb={empDb} setEmpDb={setEmpDb} currentUser={currentUser} syncToServer={syncStaff}/>;
      case "logs":           return <ActivityLog lang={lang} currentUser={currentUser} empDb={empDb} attendance={attendance} kitchenTracking={kitchenTracking} events={events}/>;
      case "dept_service":   return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="service"/>;
      case "dept_crockery":  return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="crockery"/>;
      case "dept_beverages": return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="beverages"/>;
      case "dept_odc":       return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="odc"/>;
      default: return <div style={{padding:40,textAlign:"center",color:"#888"}}><div style={{fontSize:32,marginBottom:8}}>🔍</div><div style={{fontSize:14}}>Screen not found</div><button onClick={()=>setScreen("dashboard")} style={{marginTop:12,padding:"8px 20px",borderRadius:8,background:C.red,color:"#fff",border:"none",cursor:"pointer"}}>Go to Dashboard</button></div>;
    }
  }

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"var(--font-body)",background:C.bg,overflow:"hidden",flexDirection:"column"}}>
      {/* ── PWA update banner ── */}
      {updateReady&&(
        <div style={{flexShrink:0,background:"#2B8A50",color:"#fff",padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,fontWeight:600,boxShadow:"0 2px 8px rgba(0,0,0,0.3)",zIndex:9999}}>
          <span>🔄 New version available</span>
          <button onClick={()=>window.location.reload()} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:6,color:"#fff",padding:"4px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>Update Now</button>
        </div>
      )}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {/* ── SIDEBAR (tablet: 260px, glass effect) ── */}
      <div style={{width:260,background:"#FFFFFF",borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"relative"}}>

        {/* Dept badge + branding */}
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{width:42,height:42,borderRadius:12,background:`linear-gradient(135deg, ${curDeptMeta.color}, ${curDeptMeta.color}90)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",boxShadow:`0 4px 12px ${curDeptMeta.color}30`}}>{curDeptMeta.icon}</div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>{T2(curDeptMeta.name)}</div>
              <div style={{fontSize:11,color:C.muted,letterSpacing:.3}}>Ambria Cuisines</div>
            </div>
          </div>
        </div>

        {/* Nav items (tablet: larger touch targets) */}
        <nav style={{flex:1,padding:"10px 12px",overflowY:"auto"}}>
          {screen==="access"&&(
            <button onClick={()=>{setActiveDept(null);setScreen("dashboard");}} style={{width:"100%",padding:"12px 14px",borderRadius:10,marginBottom:8,cursor:"pointer",background:C.purpleBg,border:`1px solid ${C.purpleBorder}`,color:C.purple,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:8,minHeight:42}}>
              ← Back to Departments
            </button>
          )}
          {curNav.filter(item=>item.divider||canAccessScreen(currentUser, item.id)).map(item=>{
            if(item.divider){
              return(
                <div key={item.id} style={{fontSize:9,fontWeight:700,color:C.faint,textTransform:'uppercase',letterSpacing:1.2,padding:'10px 11px 4px',marginTop:4}}>
                  {item.label.replace(/──/g,'').trim()}
                </div>
              );
            }
            const active=screen===item.id;
            const badge=item.id==="team"&&pendingLv>0?pendingLv:0;
            return(
              <button key={item.id} onClick={()=>setScreen(item.id)} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                width:"100%",padding:"13px 16px",borderRadius:12,marginBottom:5,
                cursor:"pointer",textAlign:"left",minHeight:48,
                background:active?curDeptMeta.color+"12":"transparent",
                border:active?`1.5px solid ${curDeptMeta.color}25`:"1.5px solid transparent",
                borderLeft:active?`3px solid ${curDeptMeta.color}`:"3px solid transparent",
                color:active?curDeptMeta.color:C.muted,
                fontSize:13,fontWeight:active?600:400,letterSpacing:.3,
                boxShadow:active?`0 2px 12px ${curDeptMeta.color}10`:"none",
              }}>
                <span style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:17,opacity:active?1:.7}}>{item.icon}</span>{T(item.label,lang)}
                </span>
                {badge>0&&<span style={{background:`linear-gradient(135deg, ${curDeptMeta.color}, ${curDeptMeta.color}80)`,color:"#fff",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:10,boxShadow:`0 2px 6px ${curDeptMeta.color}30`}}>{badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* Supabase connection indicator */}
        {supabase&&<div style={{padding:"0 16px 8px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:supaLive===false?C.redBg:supaLive===true?C.greenBg:C.surfaceHover,border:`1px solid ${supaLive===false?C.redBorder:supaLive===true?C.greenBorder:C.border}`}}>
            <span style={{width:6,height:6,borderRadius:"50%",flexShrink:0,background:supaLive===null?C.muted:supaLive?C.green:C.red,boxShadow:supaLive?`0 0 4px ${C.green}`:"none"}}/>
            <span style={{fontSize:10,fontWeight:600,color:supaLive===null?C.muted:supaLive?C.green:C.red,letterSpacing:.3}}>{supaLive===null?"Connecting…":supaLive?"Live Sync":"Offline"}</span>
          </div>
        </div>}
        {/* User + lang + logout */}
        <div style={{padding:"16px 16px",borderTop:`1px solid ${C.borderLight}`}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <Avatar name={currentUser?.name||"A"} size={34} index={0}/>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:C.text,letterSpacing:.3}}>{currentUser?.name}</div>
              <div style={{fontSize:11,color:C.muted}}>{currentUser?.id}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setLang(l=>l==="en"?"hi":"en")} style={{flex:1,background:"none",border:`1px solid ${C.border}`,borderRadius:10,color:curDeptMeta.color,fontSize:11,padding:"10px 10px",cursor:"pointer",fontWeight:600,minHeight:42}}>
              {lang==="en"?"🇮🇳 हिंदी":"🇬🇧 English"}
            </button>
            <button onClick={handleLogout} style={{flex:1,background:"none",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontSize:11,padding:"10px 10px",cursor:"pointer",minHeight:42,fontWeight:500}}>{T("Sign out",lang)}</button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:"#FFFFFF",borderBottom:`1px solid ${C.border}`,padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",letterSpacing:.5}}>{T(curNav.find(n=>n.id===screen)?.label||"Dashboard",lang)}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:3,letterSpacing:.3}}>{T2(curDeptMeta.name)} · {TODAY_LABEL}</div>
          </div>
          <button onClick={()=>setLang(l=>l==="en"?"hi":"en")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:10,color:curDeptMeta.color,fontSize:12,padding:"10px 16px",cursor:"pointer",fontWeight:600,minHeight:42,letterSpacing:.3}}>
            {lang==="en"?"🇮🇳 हिंदी":"🇬🇧 English"}
          </button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"28px 32px",scrollBehavior:"smooth"}}>
          <ErrorBoundary key={screen} lang={lang}>{renderScreen(screen)}</ErrorBoundary>
        </div>
      </div>
      </div>
    </div>
  );
}
