// Ambria FnB Operations — Root App Component
// Decomposed: all screens, data, and utilities are in separate modules

import React, { useState, useRef, useEffect, Suspense } from "react";
import { supabase } from './lib/supabase.js';
import { dbLoad, dbUpsert, dbDelete, dbSubscribe } from './lib/db.js';
import { getQueueSize, replayQueue } from './lib/offlineQueue.js';

// Data
import { C, hydrateConstants } from './data/constants.js';
import { MENU_PACKAGES, hydrateMenuPackages, hydrateMenuPackageSections, refreshMenuPackages } from './data/menuPackages.js';
import { hydrateSalesConfigs } from './data/salesConfig.js';
import { EMPLOYEE_DB_INIT, hydrateStaffData } from './data/staffData.js';
import { hydrateRecipeData, RECIPE_DB } from './data/recipeData.js';
import { T } from './data/translations.js';
import { canAccessScreen } from './data/permissions.js';
import { loadAllConfig } from './lib/dbConfig.js';

// Utils
import './utils/styles.js';
import { TODAY, TODAY_LABEL, safeArr, safeObj, normalizeAtt, classifyDay, localDateStr, mergeDishState } from './utils/helpers.js';

// Components
import { K, type } from './utils/theme.js';
import { ripple } from './utils/ripple.js';
import { Icon } from './components/Icons.jsx';
import { ErrorBoundary, Avatar } from './components/SharedUI.jsx';
import { LoginScreen } from './components/LoginScreen.jsx';
import { Dashboard } from './components/Dashboard.jsx';
import { DeptView } from './components/DeptView.jsx';
import { StaffView } from './components/StaffView.jsx';
import { KioskAttendance } from './components/KioskAttendance.jsx';
import { ActivityLog } from './components/ActivityLog.jsx';

// Heavier, not-needed-on-first-paint screens — code-split so the initial bundle
// (login + dashboard) doesn't have to parse every admin/kitchen screen up front.
// Suspense fallbacks are wired at the two render call sites (tabletContent /
// renderScreen) below.
const KitchenHub          = React.lazy(() => import('./components/KitchenHub.jsx').then(m => ({ default: m.KitchenHub })));
const TeamHub             = React.lazy(() => import('./components/TeamHub.jsx').then(m => ({ default: m.TeamHub })));
const TransportDispatch   = React.lazy(() => import('./components/TransportDispatch.jsx').then(m => ({ default: m.TransportDispatch })));
const StoreModule         = React.lazy(() => import('./components/StoreModule.jsx').then(m => ({ default: m.StoreModule })));
const MenuPackagesView    = React.lazy(() => import('./components/MenuPackagesView.jsx').then(m => ({ default: m.MenuPackagesView })));
const VendorDirectory     = React.lazy(() => import('./components/VendorDirectory.jsx').then(m => ({ default: m.VendorDirectory })));
const AccessManager       = React.lazy(() => import('./components/AccessManager.jsx').then(m => ({ default: m.AccessManager })));
const GateKiosk           = React.lazy(() => import('./components/GateKiosk.jsx').then(m => ({ default: m.GateKiosk })));
const ODCModule           = React.lazy(() => import('./components/ODCModule.jsx').then(m => ({ default: m.ODCModule })));
const ProposalsView       = React.lazy(() => import('./components/ProposalsView.jsx').then(m => ({ default: m.ProposalsView })));
const SalesCatalogueView  = React.lazy(() => import('./components/SalesCatalogueView.jsx').then(m => ({ default: m.SalesCatalogueView })));
const BookedFunctionsView = React.lazy(() => import('./components/BookedFunctionsView.jsx').then(m => ({ default: m.BookedFunctionsView })));

// ── LMS menu name normalization ──
// LMS sends names like "Double Magnum - Veg", our keys are "Double Magnum Veg".
// V80: this only stripped dashes — any OTHER punctuation quirk (apostrophes,
// ampersands, extra spaces...) silently failed the match, leaving menu:[] for
// that event with no fallback. Since events.menu is only synced back to Kitchen
// Hub for kit-dept items and Build Menu (MenuPackagesView) treats an unresolved
// package as "0 dishes selected", any edit there (e.g. adding a custom dish)
// then saved just that one dish, wiping the rest of the package's menu. Strip
// ALL non-alphanumeric chars, same as EventMenuBuilderView's normalizePkgName.
function matchMenuPackage(rawName) {
  if (!rawName) return "";
  if (MENU_PACKAGES[rawName]) return rawName; // exact match
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+menu\s*$/, "").trim();
  const target = norm(rawName);
  const match = Object.keys(MENU_PACKAGES).find(k => norm(k) === target);
  return match || rawName; // return matched key or original (will fall through as custom)
}

// Screen id → line-icon name (glyphs live in components/Icons.jsx).
// Kept as a lookup rather than a field on DEPT_NAV so the nav arrays stay
// data-only and a screen added in one place picks up an icon here.
const NAV_ICON = {
  dashboard:"home",        kitchen:"chefHat",       store:"box",
  team:"users",            menus:"fileText",        transport:"truck",
  vendors:"contact",       dept_service:"plate",    dept_crockery:"cup",
  dept_beverages:"drink",  dept_fruits:"apple",     dept_odc:"tent",         proposals:"note",
  booked_functions:"calendarDays", sales_catalogue:"tag",
  access:"lock",           logs:"listCheck",
};

export default function App() {
  const [activeDept, setActiveDept]   = useState(null); // null = dept selector
  const [screen,setScreen]           = useState("dashboard");
  const [lang,setLang]               = useState("en");
  const [sideOpen,setSideOpen]       = useState(true);
  const [allocRules,setAllocRules]   = useState({});
  const [dbChecklists,setDbChecklists] = useState({});
  const [tabletScreen,setTabletScreen] = useState("kitchen");
  // Open by default, like the admin sidebar. It started closed back when it was
  // an overlay that covered the screen; it is a docked panel now, so hiding it
  // on every load just meant reaching for the toggle first thing.
  const [tabletSidebarOpen,setTabletSidebarOpen] = useState(true);
  const T2 = s => T(s, lang);
  // Shown for the moment a code-split screen's chunk is still downloading
  // (React.lazy below) — first visit to a given tab only, cached after. Declared
  // this early so it's in scope for both the section-tablet and desktop render paths.
  const SCREEN_LOADING = (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"80px 20px",color:C.muted,fontSize:13}}>
      {T2("Loading…")}
    </div>
  );

  // Collapsed sidebar nav groups, keyed by the divider id. Absent = open.
  // Declared up here with the other state: the nav itself renders after several
  // early returns, so a hook down there would be conditional.
  const [navClosed,setNavClosed]       = useState({});
  const [userMenuOpen,setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  useEffect(()=>{
    if(!userMenuOpen) return;
    const onDown = e => { if(userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); };
    const onEsc  = e => { if(e.key==="Escape") setUserMenuOpen(false); };
    document.addEventListener("mousedown",onDown);
    document.addEventListener("keydown",onEsc);
    return ()=>{ document.removeEventListener("mousedown",onDown); document.removeEventListener("keydown",onEsc); };
  },[userMenuOpen]);
  // Fades content out at the top edge once scrolled, so the tab strip dissolves
  // instead of being hard-clipped mid-row. Off at rest or the strip looks faded
  // when nothing has moved.
  const [scrolled,setScrolled]   = useState(false);
  function onContentScroll(e){
    // React bails out when the value is unchanged, so this does not re-render
    // on every scroll event — only on the two crossings of the threshold.
    setScrolled(e.currentTarget.scrollTop > 8);
  }

  // ── PWA auto-update ──
  // V81: vite.config.js's workbox skipWaiting+clientsClaim used to let a newly
  // deployed SW take over THIS already-open tab silently in the background —
  // no reload, no user action. The old JS kept running but the new SW's cache
  // only has the new deploy's asset hashes, so any dynamic import() the old
  // bundle made for its own (now-deleted) chunk files 404'd with
  // "Failed to fetch dynamically imported module", and — worse — the tab kept
  // silently running stale application code indefinitely (any bugfix just
  // pushed live never actually reached it) until a manual hard refresh.
  // Fix: vite.config.js no longer auto-skips waiting, so a new SW sits
  // "waiting" until the user clicks Update Now (postMessage below); once it
  // takes over, controllerchange fires exactly once and we reload immediately —
  // so the old bundle is never left running against new-hash assets.
  const [updateReady, setUpdateReady] = useState(false);
  const waitingWorkerRef = useRef(null);
  useEffect(function(){
    if(!('serviceWorker' in navigator)) return;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if(reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker.ready.then(function(reg){
      function armIfWaiting(){
        if(reg.waiting && navigator.serviceWorker.controller){
          waitingWorkerRef.current = reg.waiting;
          setUpdateReady(true);
        }
      }
      armIfWaiting(); // an update may already be waiting from before this mounted
      reg.addEventListener('updatefound', function(){
        var nw = reg.installing;
        if(!nw) return;
        nw.addEventListener('statechange', function(){
          if(nw.state === 'installed') armIfWaiting();
        });
      });
      // SPA rarely does a full navigation, so also poll for updates directly —
      // otherwise the browser may not check again for a long time.
      var poll = setInterval(function(){ reg.update().catch(function(){}); }, 15*60*1000);
      return function(){ clearInterval(poll); };
    });
  },[]);
  function applyPwaUpdate(){
    if(waitingWorkerRef.current){ waitingWorkerRef.current.postMessage({type:'SKIP_WAITING'}); }
    else { window.location.reload(); }
  }

  // ── Attendance ──
  const [attendance,setAttendance_raw] = useState([]);
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
          // For LMS events: only keep menu:[] if it was auto-resolved from package (no manual edit).
          // If admin has customized the menu (menuPackage cleared or menu differs from package), persist it.
          const isLms = !!(ev.lms_source);
          const pkgDishes = ev.menuPackage && MENU_PACKAGES[ev.menuPackage] ? MENU_PACKAGES[ev.menuPackage] : null;
          const isAutoResolved = isLms && pkgDishes && Array.isArray(ev.menu) && ev.menu.length === pkgDishes.length && ev.menu.every(function(d,i){ return d === pkgDishes[i]; });
          const menuToStore = isAutoResolved ? [] : (ev.menu||[]);
          dbUpsert("events",{id:ev.id,guest:ev.guest,venue:ev.venue,date:ev.date,time:ev.time,type:ev.type,pax:+ev.pax||0,veg:+ev.veg||0,nonveg:+ev.nonveg||0,menu_package:ev.menuPackage||null,menu:menuToStore,menu_section_overrides:ev.menu_section_overrides||{},special:ev.special||null,extras:ev.extras||[],odc_location:ev.odc_location||null,odc_address:ev.odc_address||null,odc_contact_phone:ev.odc_contact_phone||null,odc_transport_cost:ev.odc_transport_cost||null,odc_lead:ev.odc_lead||null,site_recce:ev.site_recce||null,odc_menu_confirmed:ev.odc_menu_confirmed??null},"id").catch(e=>console.error("ev sync:",e));
        }
      });
      prevMap.forEach((_,id) => {
        if(!nextMap.has(id)) {
          // V72 soft-delete: mark tombstone instead of hard delete so LMS sync
          // (which upserts by id) can't resurrect the row on the next pull.
          supabase.from("events").update({is_deleted:true}).eq("id",id)
            .then(({error})=>{ if(error) console.error("ev soft-del:",error); })
            .catch(e=>console.error("ev soft-del:",e));
        }
      });
      return next;
    });
  };

  // ── Kitchen Tracking ──
  // The Supabase sync used to run INSIDE the state updater. A state updater is
  // called during render — and may be called more than once for a single
  // update — so that fired duplicate writes and, worse, put a network call on
  // the render path where any throw escapes the screen's ErrorBoundary and
  // takes the whole app down (the blank page). It belongs in an effect.
  // Seeded from localStorage. This state had NO local copy at all — it lived
  // only in memory and in Supabase, so if the write failed, the table was not
  // reachable, or the row simply had not landed yet, a refresh threw away
  // everything the kitchen had ticked off. transportQueue right below already
  // mirrors to localStorage; this now does the same.
  const KT_LS_KEY = "ambria_kitchen_tracking";
  // The kitchen_tracking table's own columns — some pre-existing rows in this
  // table have a dish_key literally equal to one of these (likely seed/test
  // data from before this table's schema settled, e.g. dish_key: "updated_at"
  // with the row's own timestamp as its "data"). Loaded as though it were real
  // per-dish state, that key's value keeps drifting every read/write cycle,
  // which looks "changed" to the diff below and gets re-uploaded forever —
  // thousands of pointless requests a session. Never load or re-upload one.
  const KT_RESERVED_KEYS = new Set(["id", "ev_id", "dish_key", "data", "created_at", "updated_at"]);
  const [kitchenTracking, setKitchenTracking] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KT_LS_KEY) || "{}") || {}; }
    catch { return {}; }
  });
  const ktSyncedRef = useRef({});
  // Where the bell should send you back to. A ref, not state — nothing renders
  // from it, so it must not cause a re-render when it changes.
  const bellReturnRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(KT_LS_KEY, JSON.stringify(kitchenTracking || {})); }
    catch { /* private mode or quota — Supabase is still the system of record */ }
  }, [kitchenTracking]);
  useEffect(() => {
    const prev = ktSyncedRef.current;
    const next = kitchenTracking;
    if (prev === next) return;
    ktSyncedRef.current = next;
    try {
      Object.keys(next || {}).forEach(evId => {
        const prevEv = (prev && prev[evId]) || {};
        const nextEv = (next && next[evId]) || {};
        Object.entries(nextEv).forEach(([dishKey, val]) => {
          // This used to skip every key starting with "__" as a "meta key", but
          // those keys hold real, hard-won state:
          //   __sec_<catId>     the collect-from-store list (items_done)
          //   __dispatch_ready  whether a function has gone out
          //   __dispatch_time   when it went out
          // None of it was ever written to Supabase, so ticking off 39
          // ingredients and refreshing threw the lot away. The data column is
          // JSON and holds objects, booleans and strings alike, so there is
          // nothing here that needs excluding.
          if (KT_RESERVED_KEYS.has(dishKey)) return; // poisoned row — see KT_RESERVED_KEYS
          if (val === undefined || JSON.stringify(val) === JSON.stringify(prevEv[dishKey])) return;
          dbUpsert("kitchen_tracking", { ev_id: evId, dish_key: dishKey, data: JSON.parse(JSON.stringify(val)) }, "ev_id,dish_key")
            .catch(e => console.error("KT sync failed:", dishKey, e));
        });
      });
    } catch (e) {
      // A sync failure must never blank the screen — the state is already set
      // and the offline queue will retry.
      console.error("KT sync error:", e);
    }
  }, [kitchenTracking]);

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
  const [dateDrift, setDateDrift]     = useState(false);

  // ── Stale-session detector: TODAY is module-load frozen, so a tab open across midnight
  //    silently reads/writes/deletes rows keyed to yesterday. Poll every 5 min and surface a banner.
  useEffect(() => {
    const check = () => {
      try {
        if (localDateStr(new Date()) !== TODAY) setDateDrift(true);
      } catch(e) {}
    };
    check();
    const iv = setInterval(check, 5*60*1000);
    return () => clearInterval(iv);
  }, []);

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
        hydrateMenuPackages(cfg.menuPackages, cfg.dishGroups, cfg.menuPackageMeta);
        hydrateMenuPackageSections(cfg.menuSections);
        hydrateSalesConfigs(cfg.salesConfigs);
        hydrateStaffData({ groomingChecks: (cfg.checklists || {}).grooming || [], homeVenues: cfg.homeVenues });
        hydrateRecipeData(cfg);
        if(cfg.allocRules) setAllocRules(cfg.allocRules);
        if(cfg.checklists) setDbChecklists(cfg.checklists);
      } catch(e) { console.warn('Config hydration failed, using fallbacks:', e); }

      const [staffData, eventsData, attData, lvData, ktData, tqData] = await Promise.all([
        dbLoad('staff', EMPLOYEE_DB_INIT),
        dbLoad('events', []),
        dbLoad('attendance', []),
        dbLoad('leaves', []),
        dbLoad('kitchen_tracking', []),
        dbLoad('transport_queue', []),
      ]);

      // Merge: Supabase is authoritative; fill any missing entries from EMPLOYEE_DB_INIT
      // (ensures device/role accounts — gate kiosks, section tablets, HC — always exist
      //  even if Supabase DB was not re-seeded after adding them)
      const supaIds = new Set(staffData.map(s => s.staff_id || s.staffListId || s.id).filter(Boolean));
      const initOnly = EMPLOYEE_DB_INIT.filter(e => !supaIds.has(e.staff_id) && !supaIds.has(e.staffListId));
      const mergedStaff = [...staffData, ...initOnly].map(s=>({...s,staffListId:s.staff_id||s.staffListId,is_active:s.is_active!==false}));
      setEmpDb(mergedStaff);
      // Refresh currentUser with latest DB data (picks up sop_categories, venue, etc.)
      try {
        const suRaw2 = localStorage.getItem("ambria_session_user");
        if(suRaw2) {
          const cached = JSON.parse(suRaw2);
          const cid = cached?.id || cached?.staffListId || cached?.staff_id;
          if(cid) {
            const fresh = mergedStaff.find(s => (s.staff_id||s.staffListId||s.id) === cid);
            if(fresh) {
              const refreshed = {...fresh, id:cid, staffListId:fresh.staffListId||cid};
              setCurrentUser(refreshed);
              localStorage.setItem("ambria_session_user", JSON.stringify(refreshed));
            }
          }
        }
      } catch(e) {}

      // Use whatever Supabase returns (empty is fine — LMS sync will populate)
      // V72 soft-delete: filter tombstones on hydration so deleted events don't
      // flash back into the UI on refresh.
      const finalEvents = (eventsData || []).filter(function(e){ return !e.is_deleted; });
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
        return {...e, menuPackage:pkg, menu, extras, odc_location:e.odc_location||null, odc_address:e.odc_address||null, odc_contact_phone:e.odc_contact_phone||null, odc_transport_cost:e.odc_transport_cost||null, odc_lead:e.odc_lead||null, site_recce:e.site_recce||null, odc_menu_confirmed:e.odc_menu_confirmed??false, custom_menu_confirmed:e.custom_menu_confirmed??false, yield_multiplier:Number(e.yield_multiplier)||1.0};
      }));
      // ── Auto-close stale attendance: in_time set but no out_time, older than 16 hours ──
      var MAX_SHIFT_HOURS = 16;
      var nowMs = Date.now();
      var staleRecs = attData.filter(function(a){
        if(!a.in_time || a.out_time) return false;
        try {
          var inMs = new Date(a.date+'T'+a.in_time).getTime();
          return (nowMs - inMs) / 36e5 >= MAX_SHIFT_HOURS;
        } catch(e){ return false; }
      });
      if(staleRecs.length > 0){
        console.log('⏰ Auto-closing '+staleRecs.length+' stale attendance records (>'+MAX_SHIFT_HOURS+'h)');
        staleRecs.forEach(function(rec){
          try {
            var inMs2 = new Date(rec.date+'T'+rec.in_time).getTime();
            // Auto out_time = in_time + 16h (no midnight cap — staff can work past midnight)
            var autoOutMs = inMs2 + MAX_SHIFT_HOURS * 36e5;
            var outDt = new Date(autoOutMs);
            var outTimeStr = outDt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
            var dayClass = classifyDay(rec.in_time, outTimeStr);
            var autoStatus = dayClass.status;
            rec.out_time = outTimeStr;
            rec.status = autoStatus;
            rec.auto_closed = true;
            if(supabase){
              supabase.from('attendance').update({out_time:outTimeStr, status:autoStatus})
                .eq('staff_id',rec.staff_id).eq('date',rec.date)
                .then(function(r){if(r.error)console.error('Auto-close err:',rec.staff_name,r.error);});
            }
          } catch(e){ console.warn('Auto-close skip:',rec.staff_name,e); }
        });
      }
      const todayAtt = attData.filter(a=>a.date===TODAY);
      setAttendance_raw(todayAtt.map(normalizeAtt));
      setLeaves_raw(lvData.map(l=>({id:l.id,staffId:l.staff_id||l.staffId,staffName:l.staff_name||l.staffName,staffSection:l.section||l.staffSection||"",from:l.from_date||l.from,to:l.to_date||l.to,reason:l.reason,status:l.status})));
      if(ktData.length>0){
        const ktObj={};
        // `?? {}`, not `|| {}` — the meta keys now sync too, and a stored
        // `false` (an un-dispatched function) would otherwise come back as an
        // empty object, which is truthy and would read as dispatched.
        ktData.forEach(row=>{if(KT_RESERVED_KEYS.has(row.dish_key))return;if(!ktObj[row.ev_id])ktObj[row.ev_id]={};ktObj[row.ev_id][row.dish_key]=row.data ?? {};});
        // MERGE over whatever the local seed already holds — do not replace.
        // A straight replace would wipe anything ticked off while the row had
        // not reached Supabase yet. Server wins per key; local-only keys stay,
        // and because the synced ref is set to the SERVER object those keys
        // read as a diff and get pushed up on the next tick.
        ktSyncedRef.current = ktObj;
        setKitchenTracking(prev => {
          const merged = { ...(prev || {}) };
          Object.keys(ktObj).forEach(evId => {
            merged[evId] = { ...(merged[evId] || {}), ...ktObj[evId] };
          });
          return merged;
        });
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
    const u4 = dbSubscribe('events', (payload) => {
      // V84 — Postgres logical replication omits an unchanged TOASTed column
      // (e.g. a large `menu` jsonb array) from a partial-column UPDATE's `new`
      // payload when that update doesn't touch it — e.g. syncEventItemsFromKitchenMenu's
      // trailing `{event_items_initialized:true}` write, which fires seconds
      // after every Build Menu edit. payload.new.menu then comes back
      // `undefined`, not the real value, and building `ev` straight from
      // payload.new — then fully REPLACING the local event with it — silently
      // wiped a menu that had just been correctly saved moments earlier, with
      // no error, self-correcting only on a full reload (a real SELECT, not a
      // partial-column echo). Fix: merge payload.new over the existing local
      // copy of this event first, so any column this specific payload doesn't
      // actually carry falls back to what's already known instead of blanking.
      function buildEv(existing){
        if(!payload.new) return null;
        const raw={...(existing||{}),...payload.new};
        let menu=raw.menu||[];
        if(!Array.isArray(menu)){try{menu=JSON.parse(menu);}catch(e){menu=[];}}
        const pkg=matchMenuPackage(raw.menu_package||"");
        if(menu.length===0 && pkg && MENU_PACKAGES[pkg]) menu=MENU_PACKAGES[pkg];
        return {...raw,menuPackage:pkg,menu,extras:raw.extras||[],odc_location:raw.odc_location||null,odc_address:raw.odc_address||null,odc_contact_phone:raw.odc_contact_phone||null,odc_transport_cost:raw.odc_transport_cost||null,odc_lead:raw.odc_lead||null,site_recce:raw.site_recce||null,odc_menu_confirmed:raw.odc_menu_confirmed??false,custom_menu_confirmed:raw.custom_menu_confirmed??false,yield_multiplier:Number(raw.yield_multiplier)||1.0};
      }
      // V72 soft-delete: is_deleted=true on INSERT/UPDATE must remove row from local state
      if(payload.eventType==='INSERT'&&payload.new){
        setEvents_raw(p=>{
          const existing=p.find(e=>e.id===payload.new.id);
          const ev=buildEv(existing);
          if(ev.is_deleted) return p.filter(e=>e.id!==ev.id);
          return existing?p.map(e=>e.id===ev.id?ev:e):[...p,ev];
        });
      }
      if(payload.eventType==='UPDATE'&&payload.new){
        setEvents_raw(p=>{
          const existing=p.find(e=>e.id===payload.new.id);
          const ev=buildEv(existing);
          if(ev.is_deleted) return p.filter(e=>e.id!==ev.id);
          return existing?p.map(e=>e.id===ev.id?ev:e):[...p,ev];
        });
      }
      if(payload.eventType==='DELETE') setEvents_raw(p=>p.filter(e=>e.id!==payload.old.id));
    });
    const u5 = dbSubscribe('kitchen_tracking', (payload) => {
      // MERGE the incoming row, never replace it. A realtime echo can arrive
      // carrying a snapshot older than what the chef just tapped on this very
      // tablet; replacing wholesale then wiped that tap, which is the other
      // half of "I press Done and it undoes itself". Merging keeps keys the
      // echo doesn't mention while still applying the ones it does — so a real
      // undo from another tablet (an explicit false) still comes through.
      if(payload.new){const {ev_id,dish_key,data}=payload.new;if(KT_RESERVED_KEYS.has(dish_key))return;setKitchenTracking(p=>({...p,[ev_id]:{...(p[ev_id]||{}),[dish_key]:mergeDishState(p[ev_id]?.[dish_key],data||{})}}));}
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
    // V74: menu_packages had no realtime — Packages/Sections tab only refreshed on local save.
    // Full re-fetch is cheap (small table) and reuses the existing hydrate + event-dispatch plumbing.
    const u8 = dbSubscribe('menu_packages', () => { refreshMenuPackages(); });
    return () => { u1(); u2(); u4(); u5(); u6(); u7(); u8(); };
  }, [appReady]);

  // ── Supabase connectivity indicator + offline queue replay ──
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  useEffect(() => {
    if(!supabase){setSupaLive(false);return;}
    const checkQueue=()=>getQueueSize().then(n=>setOfflineQueueCount(n)).catch(()=>{});
    const ping=()=>supabase.from('staff').select('count',{count:'exact',head:true}).then(({error})=>{
      const live=!error;
      setSupaLive(live);
      if(live){
        replayQueue(supabase).then(n=>{
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
    const interval=setInterval(()=>{if(navigator.onLine)ping();checkQueue();},120000);
    return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);clearInterval(interval);};
  },[]);

  // Admin skips dept selector — go straight to Management Dashboard
  // Sales roles skip to Sales dept — go straight to Proposals list
  useEffect(function(){
    if (!currentUser || activeDept) return;
    if (currentUser.role === 'admin') {
      setActiveDept('management');
      setScreen('dashboard');
    } else if (currentUser.role === 'sales' || currentUser.role === 'sales_manager') {
      setActiveDept('sales');
      setScreen('proposals');
    }
  }, [currentUser]);

  async function syncStaff(action, data) {
    const record = {
      staff_id: data.staffListId||data.staff_id, name: data.name||'',
      name_hi: data.name_hi||null,
      section: data.section||null, section_hi: data.section_hi||null,
      dept: data.dept||null, role: data.role||'staff',
      pin: String(data.pin||'0000'), is_admin: data.role==='admin',
      is_active: data.is_active!==false, joining: data.joining||null,
      phone: data.phone||null, custom_screens: data.custom_screens||null,
      permissions: data.permissions||null,
      venue: data.venue||null,
      sop_categories: data.sop_categories||null,
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
    try{
      localStorage.removeItem("ambria_session_user");
      localStorage.removeItem("ambria_emp_id");
      localStorage.removeItem("ambria_pin");
      localStorage.removeItem("ambria_remember");
    }catch(e){}
  }

  // ── NAV per department ──
  const DEPT_NAV = {
    kitchen: [
      {id:"_divider_k1",label:"KITCHEN",icon:"",divider:true},
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"kitchen",label:"Kitchen",icon:"👨‍🍳"},
      {id:"_divider_k2",label:"OPERATIONS",icon:"",divider:true},
      {id:"store",label:"Store & Inventory",icon:"📦"},
      {id:"_divider_k3",label:"MANAGEMENT",icon:"",divider:true},
      {id:"team",label:"Team & Attendance",icon:"👥"},
    ],
    service: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_service",label:"Service Operations",icon:"🍽️"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"vendors",label:"Vendor Directory",icon:"📇"},
    ],
    crockery: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_crockery",label:"Crockery Operations",icon:"🍶"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
    ],
    beverages: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_beverages",label:"Beverage Operations",icon:"🥤"},
      {id:"menus",label:"Menu",icon:"📜"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
    ],
    fruits: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_fruits",label:"Fruit Operations",icon:"🍓"},
      {id:"menus",label:"Menu",icon:"📜"},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
    ],
    transport: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"transport",label:"Transport & Dispatch",icon:"🚛"},
    ],
    odc: [
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"dept_odc",label:"ODC Operations",icon:"🏕️"},
    ],
    management: [
      {id:"_divider_kitchen",label:"KITCHEN",icon:"",divider:true},
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"kitchen",label:"Kitchen Hub",icon:"👨‍🍳"},
      {id:"menus",label:"Menu Packages",icon:"📜"},
      {id:"_divider_ops",label:"OPERATIONS",icon:"",divider:true},
      {id:"transport",label:"Transport & Dispatch",icon:"🚛"},
      {id:"store",label:"Store & Inventory",icon:"📦"},
      {id:"vendors",label:"Vendor Directory",icon:"📇"},
      {id:"dept_service",label:"Service Ops",icon:"🍽"},
      {id:"dept_crockery",label:"Crockery Ops",icon:"🍶"},
      {id:"dept_beverages",label:"Beverages Ops",icon:"🥤"},
      {id:"dept_fruits",label:"Fruits Ops",icon:"🍓"},
      {id:"dept_odc",label:"ODC Operations",icon:"🏕"},
      {id:"_divider_sales",label:"SALES",icon:"",divider:true},
      {id:"proposals",label:"Proposals",icon:"📝"},
      {id:"booked_functions",label:"Booked Functions",icon:"📅"},
      {id:"sales_catalogue",label:"Sales Catalogue",icon:"🏷️"},
      {id:"_divider_mgmt",label:"MANAGEMENT",icon:"",divider:true},
      {id:"team",label:"Team & Attendance",icon:"👥"},
      {id:"access",label:"Access Manager",icon:"🔐"},
      {id:"logs",label:"Activity Log",icon:"📋"},
    ],
    sales: [
      {id:"_divider_s1",label:"SALES",icon:"",divider:true},
      {id:"proposals",label:"Proposals",icon:"📝"},
      {id:"booked_functions",label:"Booked Functions",icon:"📅"},
      {id:"sales_catalogue",label:"Sales Catalogue",icon:"🏷️"},
    ],
  };

  // Department accent colours — kept distinguishable from each other, but all
  // pulled into the cool/indigo family so the sidebar matches the app palette
  // in data/constants.js.
  const DEPT_META = {
    kitchen:{name:"Kitchen",icon:"👨‍🍳",color:"#2563EB"},
    service:{name:"Service",icon:"🍽️",color:"#0EA5E9"},
    crockery:{name:"Crockery",icon:"🍶",color:"#7C5CE0"},
    beverages:{name:"Beverages",icon:"🥤",color:"#129A6C"},
    fruits:{name:"Fruits",icon:"🍓",color:"#D97A3E"},
    transport:{name:"Transportation",icon:"🚛",color:"#C4790C"},
    odc:{name:"ODC",icon:"🏕️",color:"#0E8F9E"},
    management:{name:"Management",icon:"🔐",color:"#2563EB"},
    sales:{name:"Sales",icon:"📝",color:"#D9463F"},
  };

  const curNav = activeDept ? (DEPT_NAV[activeDept]||DEPT_NAV.kitchen) : [];
  const curDeptMeta = DEPT_META[activeDept]||{name:"",icon:"",color:C.gold};

  const pendingLv = (leaves||[]).filter(l=>l.status==="Pending").length;
  // Today's function(s) shown in the page header, so no screen has to repeat
  // the date/pax/time line in its own body.
  const todayEvsHdr = safeArr(events)
    .filter(e=>e.date===TODAY)
    .sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  // Event details ride in the header ONLY when the day has a single function.
  // With two or more, one time and a summed pax describe neither of them, so
  // the whole block is dropped rather than shown misleadingly — the Event Day
  // tab's function selector is where multi-function days get broken down.
  const singleEvToday = todayEvsHdr.length === 1 ? todayEvsHdr[0] : null;
  const headerEvents  = singleEvToday
    ? `${singleEvToday.guest||"Function"} (${singleEvToday.pax} pax · ${singleEvToday.time||"TBD"})`
    : "";
  const nextEvToday = singleEvToday;
  const paxToday    = singleEvToday ? (+singleEvToday.pax||0) : 0;
  // Topbar search = quick-nav over the screens this user can actually reach.
  const showStaffView = currentUser&&currentUser.role==="staff";

  // Loading
  if(!appReady) return (
    <div style={{minHeight:"100vh",background:K.shellBg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
      {/* Same artwork as the app itself, so the boot screen is the app arriving
          rather than a separate holding page. */}
      <img src={`${import.meta.env.BASE_URL}page-bg.webp`} alt="" aria-hidden="true" draggable="false"
        onError={e=>{ e.currentTarget.style.display="none"; }}
        style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:K.pageBgOpacity,pointerEvents:"none"}}/>

      <div className="ash-boot" style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"}}>
        {/* The real app icon. drop-shadow, not box-shadow: the PNG has rounded
            corners with transparency, so a box shadow would render as a square
            behind it. Falls back to the chef-hat tile if the file is missing. */}
        <img className="ash-boot-mark" src={`${import.meta.env.BASE_URL}icons/icon-192x192.png`}
          alt="Ambria Cuisines" draggable="false"
          onError={e=>{ const el=e.currentTarget; el.style.display="none"; if(el.nextSibling) el.nextSibling.style.display="flex"; }}
          style={{width:96,height:96,display:"block",filter:"drop-shadow(0 14px 30px rgba(28,61,43,.34))"}}/>
        <div style={{display:"none",width:96,height:96,borderRadius:28,background:K.hdrBadge,color:K.hdrBadgeIcon,alignItems:"center",justifyContent:"center",boxShadow:"0 14px 34px rgba(28,61,43,.32)"}}>
          <Icon name="chefHat" size={46} strokeWidth={1.5}/>
        </div>

        <div style={{fontSize:10.5,fontWeight:700,color:K.hdrEyebrow,textTransform:"uppercase",letterSpacing:2.4,marginTop:26}}>
          {T2("Kitchen Operations")}
        </div>
        <div style={{...type.pageTitle,fontSize:30,color:K.hdrTitle,marginTop:6}}>Ambria Cuisines</div>

        {/* Indeterminate: several Supabase loads run in parallel, so there is no
            honest percentage to show. */}
        <div style={{width:190,height:3,borderRadius:2,background:K.hdrChipLine,overflow:"hidden",marginTop:22}}>
          <div className="ash-boot-bar" style={{width:"38%",height:"100%",borderRadius:2,background:`linear-gradient(90deg,${K.sbGoldSoft},${K.hdrBadge})`}}/>
        </div>
        <div style={{fontSize:12.5,color:K.hdrMeta,marginTop:14,letterSpacing:.2}}>{T2("Loading your kitchen…")}</div>
      </div>
    </div>
  );
  // Login
  if(!currentUser) return <LoginScreen empDb={empDb} onLogin={handleLogin} lang={lang}/>;  // Staff self-service
  if(showStaffView) return <StaffView user={currentUser} attendance={attendance} leaves={leaves} setLeaves={setLeaves} onLogout={handleLogout} lang={lang}/>;
  // ── GATE KIOSK INTERCEPT ──
  if(currentUser && currentUser.role === 'kiosk_gate') {
    return (
      <div style={{minHeight:'100vh',background:C.bg,padding:20}}>
        <Suspense fallback={SCREEN_LOADING}>
          <GateKiosk empDb={empDb} attendance={attendance}
            setAttendance={setAttendance} currentUser={currentUser}
            setCurrentUser={setCurrentUser} onLogout={handleLogout} lang={lang} setLang={setLang}/>
        </Suspense>
      </div>
    );
  }
  // ── SECTION TABLET INTERCEPT ──
  if(currentUser && currentUser.role && (currentUser.role === 'section_tablet' || currentUser.role.startsWith('section_'))) {
    const TABLET_NAV=[
      {id:"dashboard",label:"Dashboard"},
      {id:"kitchen",label:"Kitchen Hub"},
      {id:"store",label:"Store & Inventory"},
    ].filter(function(n){ return canAccessScreen(currentUser, n.id); });
    const _cats = Array.isArray(currentUser.sop_categories) ? currentUser.sop_categories : [];
    const _catObjs = _cats.map(function(c){ return (RECIPE_DB.cats||[]).find(function(x){ return x.id===c; }); }).filter(Boolean);
    const _firstCat = _catObjs[0]||null;
    const _catNames = _catObjs.length>0?_catObjs.map(function(c){ return c.name; }).join(' + '):'';
    // The per-category accent is gone: the tablet shell now uses the brand
    // plate like the admin app, so the chrome no longer changes colour with
    // whichever station happens to be assigned to the tablet.
    const _title = currentUser.name || _catNames || currentUser.section || 'Kitchen';
    function tabletContent(scr){
      switch(scr){
        case "dashboard": return <Dashboard attendance={attendance} events={events} setEvents={setEvents} leaves={leaves} setScreen={setTabletScreen} kitchenTracking={kitchenTracking} lang={lang} currentUser={currentUser} empDb={empDb}/>;
        case "kitchen": return <KitchenHub events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} currentUser={currentUser} transportQueue={transportQueue} setTransportQueue={setTransportQueue}/>;
        case "store": return <StoreModule events={events} lang={lang} currentUser={currentUser}/>;
        default: return <KitchenHub events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} currentUser={currentUser} transportQueue={transportQueue} setTransportQueue={setTransportQueue}/>;
      }
    }
    return (
      // Same shell language as the admin app: ivory ground, a floating sidebar
      // panel with a deep-green active pill and gold rail, and the brand plate
      // across the top. The tablet had its own older styling, so the two halves
      // of the same product looked like different apps.
      <div className="kh-scope" style={{position:"relative",display:"flex",height:"100vh",background:K.shellBg,overflow:"hidden"}}>
        {/* Same page artwork as the admin shell, spanning the whole window so it
            shows behind the floating sidebar's rounded corners rather than a
            flat gap. BASE_URL, not a bare "/", because vite sets base:'/Fnbapp/'. */}
        <img src={`${import.meta.env.BASE_URL}page-bg.webp`} alt="" aria-hidden="true" draggable="false"
          onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",
            opacity:K.pageBgOpacity,pointerEvents:"none",userSelect:"none",zIndex:0}}/>

        {tabletSidebarOpen&&(
          <div style={{position:"relative",zIndex:1,width:K.sbWidth,margin:"10px 0 10px 10px",borderRadius:22,background:K.sbBg,border:`1px solid ${K.sbLine}`,
            boxShadow:K.sidebarShadow,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
            {/* Sidebar artwork — hides itself if the file is missing. */}
            <img src={`${import.meta.env.BASE_URL}sidebar-bg.webp`} alt="" aria-hidden="true" draggable="false"
              onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
              style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top",
                opacity:.65,pointerEvents:"none",userSelect:"none",zIndex:0}}/>

            {/* Brand — the Ambria wordmark, same treatment (and same sheen) as
                the admin sidebar. Falls back to .png, then to the chef-hat mark
                if neither file is present. */}
            <div style={{position:"relative",zIndex:1,padding:"22px 16px 20px",flexShrink:0}}>
              {/* Collapse sits INSIDE the panel, like the admin sidebar. The
                  tablet hides its sidebar completely rather than shrinking to an
                  icon rail, so the button to bring it back has to live in the
                  header band — see the topbar below. */}
              <button className="ash-iconbtn kh-rip" onPointerDown={ripple} onClick={()=>setTabletSidebarOpen(false)}
                title={T2("Collapse")} aria-label={T2("Collapse")}
                style={{position:"absolute",top:14,right:14,zIndex:2,width:30,height:30,borderRadius:9,
                  background:K.sbChipBg,border:`1px solid ${K.sbChipLine}`,color:K.sbText,
                  display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0}}>
                <Icon name="chevronL" size={15}/>
              </button>
              <span className="ash-logo-wrap" style={{width:194,maxWidth:"100%",margin:"0 auto",["--logo-mask"]:`url(${import.meta.env.BASE_URL}ambria-logo.webp)`}}>
                <img className="ash-logo" src={`${import.meta.env.BASE_URL}ambria-logo.webp`} alt="Ambria Cuisines" draggable="false"
                  onError={e=>{ const el=e.currentTarget;
                    const wrap = el.closest(".ash-logo-wrap");
                    if(!el.dataset.pngFallback){
                      el.dataset.pngFallback="1";
                      const png = el.src.replace(/\.webp$/,".png");
                      el.src = png;
                      if(wrap) wrap.style.setProperty("--logo-mask",`url(${png})`);
                    } else {
                      el.style.display="none";
                      if(wrap) wrap.querySelectorAll(".ash-logo-sheen").forEach(s=>s.remove());
                      if(el.parentElement?.nextSibling) el.parentElement.nextSibling.style.display="flex";
                    } }}
                  style={{display:"block",width:"100%",height:"auto",userSelect:"none"}}/>
                <span className="ash-logo-sheen" aria-hidden="true"/>
              </span>
              {/* Shown only if the logo file is missing */}
              <div style={{display:"none",alignItems:"center",gap:10}}>
                <Icon name="chefHat" size={22} strokeWidth={1.6} color={K.sbText}/>
                <span style={{fontFamily:"var(--font-display)",fontSize:18,fontWeight:700,color:K.sbText}}>Ambria Cuisines</span>
              </div>
            </div>

            {/* Which tablet this is. The station list lives in the banner on the
                page, not here — it ran to eleven names and could not fit. */}
            <div style={{position:"relative",zIndex:1,padding:"0 16px 20px",flexShrink:0,borderBottom:`1px solid ${K.sbLine}`}}>
              <div style={{display:"flex",alignItems:"center",gap:11,padding:"12px 13px",borderRadius:14,
                background:K.sbChipBg,border:`1px solid ${K.sbChipLine}`}}>
                <span style={{width:34,height:34,borderRadius:11,flexShrink:0,background:K.hdrBadge,color:K.hdrBadgeIcon,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Icon name="chefHat" size={18} strokeWidth={1.8}/>
                </span>
                <div style={{minWidth:0}}>
                  <div style={{...type.label,fontSize:9.5,color:K.sbLabel}}>{T2("Tablet")}</div>
                  <div style={{fontFamily:"var(--font-display)",fontSize:16,fontWeight:700,letterSpacing:-.1,color:K.sbText,
                    marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{_title}</div>
                </div>
              </div>
            </div>
            <nav style={{position:"relative",zIndex:1,flex:1,padding:"16px 8px 10px",overflowY:"auto"}}>
              {TABLET_NAV.map(function(item){
                var active=tabletScreen===item.id;
                return(
                  <button key={item.id} className={"ash-nav kh-rip"+(active?" is-active":"")} onPointerDown={ripple}
                    // Navigating does NOT close the sidebar. That was a holdover
                    // from when it was an overlay with no collapse control of
                    // its own; now it has one, so switching screens should leave
                    // it exactly where the user put it — as in the admin app.
                    onClick={function(){setTabletScreen(item.id);}} style={{
                    position:"relative",overflow:"hidden",
                    display:"flex",alignItems:"center",gap:12,width:"100%",padding:"8px 10px",
                    borderRadius:14,marginBottom:7,cursor:"pointer",textAlign:"left",minHeight:56,border:"none",
                    background:active?K.sbActiveBg:"transparent",
                    color:active?K.sbActiveText:K.sbText,
                    boxShadow:active?"0 6px 16px rgba(28,61,43,.26)":"none"}}>
                    {active&&<span style={{position:"absolute",left:0,top:8,bottom:8,width:4,borderRadius:"0 3px 3px 0",background:K.sbGoldSoft}}/>}
                    <span style={{width:40,height:40,borderRadius:12,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                      background:active?"rgba(255,255,255,.12)":K.sbChipBg,
                      border:`1px solid ${active?"rgba(255,255,255,.18)":K.sbChipLine}`,
                      color:active?K.sbActiveText:K.sbText}}>
                      <Icon name={NAV_ICON[item.id]||"layers"} size={19} strokeWidth={active?1.9:1.6}/>
                    </span>
                    <span style={{fontFamily:"var(--font-display)",fontSize:17,fontWeight:active?700:600,letterSpacing:-.1,
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{T2(item.label)}</span>
                  </button>
                );
              })}
            </nav>
            {/* No Exit button here. Signing out lives in the user chip in the
                top bar, exactly as it does in the admin app — one place for
                "who am I / get me out", not two. */}

            {/* Footer plate — the wave, the artwork and the strapline are all
                baked into the image, same as the admin sidebar. */}
            <div style={{position:"relative",zIndex:1,flexShrink:0,lineHeight:0}}>
              <img src={`${import.meta.env.BASE_URL}sidebar-footer.webp`} alt="" aria-hidden="true" draggable="false"
                onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
                style={{display:"block",width:"100%",height:K.sbFooterH,
                  objectFit:"cover",objectPosition:"center bottom",
                  pointerEvents:"none",userSelect:"none"}}/>
            </div>
          </div>
        )}
        <div style={{position:"relative",zIndex:1,flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          {/* Top bar — expand control on the left, identity on the right, the
              same pair the admin shell carries above its header plate. */}
          <div style={{position:"relative",zIndex:20,flexShrink:0,padding:"10px 32px 0",display:"flex",alignItems:"center",gap:10}}>
            {!tabletSidebarOpen&&(
              <button onClick={function(){setTabletSidebarOpen(true);}} onPointerDown={ripple}
                className="ash-iconbtn kh-rip" title={T2("Expand")} aria-label={T2("Expand")}
                style={{width:38,height:38,borderRadius:10,border:`1px solid ${K.line}`,background:K.surface,
                  cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:K.textMuted,flexShrink:0,padding:0}}>
                <Icon name="panelLeft" size={17} strokeWidth={2}/>
              </button>
            )}
            {/* Identity + sign out, exactly as in admin — Exit no longer sits in
                the sidebar, so there is one place for "who am I / get me out". */}
            <div ref={userMenuRef} style={{position:"relative",flexShrink:0,marginLeft:"auto"}}>
              <button className="ash-userchip ash-btn kh-rip" onPointerDown={ripple} onClick={()=>setUserMenuOpen(o=>!o)}
                style={{display:"flex",alignItems:"center",gap:9,padding:"4px 10px 4px 4px",height:38,borderRadius:10,background:K.surface,border:`1px solid ${K.line}`,cursor:"pointer"}}>
                <Avatar name={currentUser?.name||"T"} size={28} index={0}/>
                <span style={{fontSize:13,fontWeight:600,color:K.text,whiteSpace:"nowrap"}}>{currentUser?.name}</span>
                <Icon name="chevronD" size={14} color={K.textFaint} style={{transform:userMenuOpen?"rotate(180deg)":"none",transition:"transform .18s"}}/>
              </button>
              {userMenuOpen&&(
                <div style={{position:"absolute",top:44,right:0,zIndex:60,minWidth:230,background:K.surface,border:`1px solid ${K.line}`,borderRadius:14,boxShadow:K.shadowLift,overflow:"hidden",padding:4}}>
                  <div style={{padding:"10px 12px 8px",borderBottom:`1px solid ${K.lineSoft}`,marginBottom:4}}>
                    <div style={{fontSize:13,fontWeight:700,color:K.text}}>{currentUser?.name}</div>
                    <div style={{fontSize:11.5,color:K.textMuted,marginTop:2}}>{_catObjs.length} {_catObjs.length===1?T2("station"):T2("stations")}{currentUser?.venue?` · ${currentUser.venue}`:""}</div>
                  </div>
                  <button className="ash-menu-item kh-rip" onPointerDown={ripple} onClick={()=>{setLang(l=>l==="en"?"hi":"en");setUserMenuOpen(false);}}
                    style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                    <Icon name="globe" size={15}/>{lang==="en"?"हिंदी में बदलें":"Switch to English"}
                  </button>
                  <button className="ash-menu-item is-danger kh-rip" onPointerDown={ripple} onClick={()=>{setUserMenuOpen(false);handleLogout();}}
                    style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                    <Icon name="logout" size={15}/>{T("Sign out",lang)}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Same padding and the same top fade as the admin content column.
              Without it, rows scrolled up to a hard edge under the user chip
              and the whole band read as clipped. 10px top so the brand plate
              lines up with the sidebar panel. */}
          <div onScroll={onContentScroll} style={{position:"relative",zIndex:1,flex:1,overflowY:"auto",padding:"10px 32px 32px",scrollBehavior:"smooth"}}>
            {/* Fade replaces a CSS mask that used to sit on this same scrolling
                div. mask-image also turns its element into a containing block
                for any position:fixed descendant — so a modal opened from
                anywhere inside here (arbitrarily deep) got faded/clipped at the
                top along with the scrolled content. A plain sticky overlay
                achieves the same look without trapping fixed children. */}
            {scrolled&&<div style={{position:"sticky",top:0,zIndex:2,height:34,marginBottom:-34,pointerEvents:"none",background:`linear-gradient(to bottom, ${K.shellBg} 0%, transparent 100%)`}}/>}
            {/* Brand plate — the same construction as the admin page header:
                decorative leaf, screen badge, eyebrow, serif title, meta line,
                and the at-a-glance chips on the right. */}
            <div style={{paddingBottom:18}}>
              <div style={{position:"relative",overflow:"hidden",background:K.hdrBg,border:`1px solid ${K.hdrLine}`,borderRadius:22,boxShadow:K.shadowCard,
                padding:"22px 26px",display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
                <svg width="230" height="200" viewBox="0 0 230 200" aria-hidden="true"
                  style={{position:"absolute",top:-26,right:-18,pointerEvents:"none",opacity:.5}}>
                  <g fill="none" stroke="#D9C08A" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M188 6c-34 22-58 56-66 96-4 22-3 44 4 66"/>
                    <path d="M182 34c-22 2-40 14-50 32M186 62c-24 0-44 10-56 28M188 92c-24-2-45 6-58 24M186 122c-22-4-42 0-55 16"/>
                    <path d="M214 44c-20 26-30 58-28 92"/>
                    <path d="M212 70c-14 4-25 13-30 26M214 98c-15 1-27 8-33 20"/>
                  </g>
                </svg>

                <div style={{width:64,height:64,borderRadius:20,background:K.hdrBadge,color:K.hdrBadgeIcon,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                  <Icon name={NAV_ICON[tabletScreen]||"layers"} size={32} strokeWidth={1.6}/>
                </div>

                <div style={{flex:"1 1 320px",minWidth:0,position:"relative"}}>
                  {/* The tablet's own name is the heading, as it was before —
                      a device is identified by which tablet it is, not by which
                      screen happens to be open. The screen name moves to the
                      meta line beside the date. */}
                  <div style={{fontSize:11.5,fontWeight:700,color:K.hdrEyebrow,textTransform:"uppercase",letterSpacing:2.2}}>{T2("Kitchen Operations")}</div>
                  <div style={{...type.pageTitle,fontSize:38,color:K.hdrTitle,marginTop:2}}>{_title}</div>
                  <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px 14px",marginTop:10,fontSize:13,color:K.hdrMeta}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:7}}><Icon name="calendar" size={15}/>{TODAY_LABEL}</span>
                    <span style={{color:K.hdrEyebrow}}>·</span>
                    <span style={{display:"inline-flex",alignItems:"center",gap:7}}>
                      <Icon name={NAV_ICON[tabletScreen]||"layers"} size={15}/>
                      <span style={{color:K.hdrMetaStrong}}>{T(TABLET_NAV.find(n=>n.id===tabletScreen)?.label||"Kitchen Hub",lang)}</span>
                    </span>
                  </div>
                </div>

                {_catObjs.length>0&&(
                  <div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0,position:"relative",flexWrap:"wrap"}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:9,padding:"11px 18px",borderRadius:12,background:K.hdrLiveBg,color:K.hdrLiveText,fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>
                      <span style={{width:9,height:9,borderRadius:"50%",background:K.hdrLiveDot}}/>{T2("On duty")}
                    </span>
                    <span style={{width:1,height:34,background:K.hdrChipLine}}/>
                    <span style={{display:"inline-flex",alignItems:"center",gap:9,padding:"11px 18px",borderRadius:12,background:K.hdrChipBg,border:`1px solid ${K.hdrChipLine}`,color:K.hdrMetaStrong,fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>
                      <Icon name="layers" size={17}/>{_catObjs.length} {_catObjs.length===1?T2("station"):T2("stations")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Suspense fallback={SCREEN_LOADING}>{tabletContent(tabletScreen)}</Suspense>
          </div>
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
        allocRules={allocRules} setAllocRules={setAllocRules}
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
      case "dashboard":      return <Dashboard attendance={attendance} events={events} setEvents={setEvents} leaves={leaves} setScreen={setScreen} kitchenTracking={kitchenTracking} lang={lang} currentUser={currentUser} empDb={empDb}/>;
      case "team":           return <TeamHub attendance={attendance} setAttendance={setAttendance} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} events={events} lang={lang} activeDept={activeDept} currentUser={currentUser} syncToServer={syncStaff}/>;
      case "kitchen":        return <KitchenHub events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} currentUser={currentUser} transportQueue={transportQueue} setTransportQueue={setTransportQueue}/>;
      case "menus":          return <MenuPackagesView lang={lang} currentUser={currentUser} events={events} setEvents={setEvents}/>;
      case "transport":      return <TransportDispatch events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} currentUser={currentUser} transportQueue={transportQueue} setTransportQueue={setTransportQueue}/>;
      case "store":          return <StoreModule events={events} lang={lang} currentUser={currentUser}/>;
      case "vendors":        return <VendorDirectory lang={lang}/>;
      case "access":         return <AccessManager lang={lang} empDb={empDb} setEmpDb={setEmpDb} currentUser={currentUser} syncToServer={syncStaff}/>;
      case "logs":           return <ActivityLog lang={lang} currentUser={currentUser} empDb={empDb} attendance={attendance} kitchenTracking={kitchenTracking} events={events}/>;
      case "dept_service":   return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="service" allocRules={allocRules} setAllocRules={setAllocRules} currentUser={currentUser}/>;
      case "dept_crockery":  return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="crockery"/>;
      case "dept_beverages": return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="beverages"/>;
      case "dept_fruits":    return <DeptView attendance={attendance} setAttendance={setAttendance} events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} leaves={leaves} setLeaves={setLeaves} empDb={empDb} setEmpDb={setEmpDb} forceDept="fruits"/>;
      case "dept_odc":       return <ODCModule events={events} lang={lang} currentUser={currentUser} checklistsCfg={dbChecklists}/>;
      case "proposals":         return <ProposalsView lang={lang} currentUser={currentUser} empDb={empDb}/>;
      case "sales_catalogue":   return <SalesCatalogueView lang={lang} currentUser={currentUser}/>;
      case "booked_functions":  return <BookedFunctionsView lang={lang} currentUser={currentUser}/>;
      default: return <div style={{padding:40,textAlign:"center",color:C.muted}}><div style={{fontSize:32,marginBottom:8}}>🔍</div><div style={{fontSize:14}}>Screen not found</div><button onClick={()=>setScreen("dashboard")} style={{marginTop:12,padding:"8px 20px",borderRadius:8,background:C.red,color:"#fff",border:"none",cursor:"pointer"}}>Go to Dashboard</button></div>;
    }
  }

  return (
    <div className="ash-shell" style={{display:"flex",height:"100vh",fontFamily:"var(--font-body)",background:K.shellBg,overflow:"hidden",flexDirection:"column",position:"relative"}}>

      {/* Page artwork spans the WHOLE window, not just the content column, so the
          floating sidebar sits on it. Behind the sidebar's rounded corners you
          then see the image rather than a flat gap.
          File: Fnbapp/public/page-bg.webp (a .png there works too). */}
      <img src={`${import.meta.env.BASE_URL}page-bg.webp`} alt="" aria-hidden="true" draggable="false"
        onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
        style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",
          opacity:K.pageBgOpacity,pointerEvents:"none",userSelect:"none",zIndex:0}}/>
      {/* ── PWA update banner ── */}
      {updateReady&&(
        <div style={{flexShrink:0,background:C.green,color:"#fff",padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,fontWeight:600,boxShadow:`0 2px 8px ${C.shadow}`,zIndex:9999}}>
          <span>🔄 New version available</span>
          <button onClick={applyPwaUpdate} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:6,color:"#fff",padding:"4px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>Update Now</button>
        </div>
      )}
      {/* ── Stale-session banner: tab crossed midnight, module-load TODAY is stale ── */}
      {dateDrift&&(
        <div style={{flexShrink:0,background:C.red||"#B12A2A",color:"#fff",padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,fontWeight:600,boxShadow:`0 2px 8px ${C.shadow}`,zIndex:9999}}>
          <span>⚠ This tab was opened on {TODAY} — the date has changed. Reload to prevent data going to the wrong day.</span>
          <button onClick={()=>window.location.reload()} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:6,color:"#fff",padding:"4px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>Reload Now</button>
        </div>
      )}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {/* ── SIDEBAR ──
          Ivory panel with a deep-green strip down the window edge and a green
          footer plate. Every decorative layer is pointer-events:none and hidden
          when collapsed, so the 72px rail stays a clean icon strip. */}
      {/* Floating panel: inset from the window on all sides so every corner can
          round. Rounding only the inner corners left the flush edge square,
          which read as a bug rather than a choice. */}
      {/* Collapsed means GONE, not a narrow icon rail. A rail still occupies a
          column and shows the whole nav, so collapsing bought almost no room and
          left a strip of ambiguous icons. The panel is hidden outright and a
          single expand control lives in the top bar — the same pattern the
          section-tablet shell uses. */}
      {sideOpen&&(
      <div style={{width:K.sbWidth,margin:"10px 0 10px 10px",background:K.sbBg,border:`1px solid ${K.sbLine}`,borderRadius:22,boxShadow:K.sidebarShadow,zIndex:3,display:"flex",flexDirection:"column",flexShrink:0,position:"relative",overflow:"hidden"}}>

        {/* Decorative background art.
            Drop the artwork at Fnbapp/public/sidebar-bg.webp — BASE_URL is used
            (not a bare "/") because vite.config.js sets base:'/Fnbapp/', so an
            absolute path would 404 on GitHub Pages. If the file is missing the
            image hides itself and the plain ivory panel shows through. */}
        {sideOpen&&(
          <img src={`${import.meta.env.BASE_URL}sidebar-bg.webp`} alt="" aria-hidden="true" draggable="false"
            onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
            style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top",
              opacity:.65,pointerEvents:"none",userSelect:"none",zIndex:0}}/>
        )}

        {/* ── Brand ── */}
        <div style={{position:"relative",zIndex:1,padding:sideOpen?"18px 16px 14px":"18px 10px 14px",flexShrink:0}}>
          {/* Expanded: the Ambria wordmark. Collapsed: the chef-hat mark, since a
              wordmark cannot read at 84px. Drop the logo at
              Fnbapp/public/ambria-logo.webp (a .png there works too — the error
              handler falls back to it, then to the chef-hat mark if neither exists). */}
          <div style={{display:"flex",alignItems:"flex-start",gap:13}}>
            {sideOpen ? (
              <div style={{minWidth:0,flex:1}}>
                {/* ambria-logo.webp is the dark-on-light version (the white
                    lettering was repainted deep green). The original white mark is
                    kept as ambria-logo-onDark.webp for any dark surface. */}
                <span className="ash-logo-wrap" style={{width:194,maxWidth:"100%",margin:"0 auto",["--logo-mask"]:`url(${import.meta.env.BASE_URL}ambria-logo.webp)`}}>
                  <img className="ash-logo" src={`${import.meta.env.BASE_URL}ambria-logo.webp`} alt="Ambria Cuisines" draggable="false"
                    onError={e=>{ const el=e.currentTarget;
                      const wrap = el.closest(".ash-logo-wrap");
                      if(!el.dataset.pngFallback){
                        el.dataset.pngFallback="1";
                        const png = el.src.replace(/\.webp$/,".png");
                        el.src = png;
                        if(wrap) wrap.style.setProperty("--logo-mask",`url(${png})`);
                      } else {
                        el.style.display="none";
                        if(wrap) wrap.querySelectorAll(".ash-logo-sheen").forEach(s=>s.remove());
                        if(el.parentElement?.nextSibling) el.parentElement.nextSibling.style.display="flex";
                      } }}
                    style={{display:"block",width:"100%",height:"auto",userSelect:"none"}}/>
                  <span className="ash-logo-sheen" aria-hidden="true"/>
                </span>
                {/* Shown only if the logo file is missing */}
                <div style={{display:"none",alignItems:"center",gap:10}}>
                  <Icon name="chefHat" size={22} strokeWidth={1.6} color={K.sbText}/>
                  <span style={{fontFamily:"var(--font-display)",fontSize:18,fontWeight:700,color:K.sbText}}>Ambria Cuisines</span>
                </div>
              </div>
            ) : (
              <div style={{width:44,height:44,borderRadius:14,background:K.hdrBadge,color:K.hdrBadgeIcon,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 6px 16px rgba(28,61,43,.28)"}}>
                <Icon name="chefHat" size={23} strokeWidth={1.6}/>
              </div>
            )}
            {/* Collapse. There is no matching expand button down here any more,
                because the whole panel goes away when collapsed — the control to
                bring it back lives in the top bar. */}
            <button className="ash-iconbtn kh-rip" onPointerDown={ripple} onClick={()=>setSideOpen(false)} title={T2("Collapse")}
              style={{width:30,height:30,borderRadius:9,background:K.sbChipBg,border:`1px solid ${K.sbChipLine}`,color:K.sbText,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0,flexShrink:0}}>
              <Icon name="chevronL" size={15}/>
            </button>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav style={{position:"relative",zIndex:1,flex:1,minHeight:0,padding:sideOpen?"4px 14px 10px":"4px 10px 10px",overflowY:"auto"}}>
          {screen==="access"&&sideOpen&&(
            <button className="ash-btn ash-btn-ghost" onClick={()=>{setActiveDept(null);setScreen("dashboard");}}
              style={{width:"100%",padding:"10px 14px",borderRadius:12,marginBottom:10,cursor:"pointer",background:K.sbChipBg,border:`1px solid ${K.sbChipLine}`,color:K.sbText,fontSize:12.5,fontWeight:600,display:"flex",alignItems:"center",gap:8,minHeight:42}}>
              <Icon name="chevronL" size={14}/> Back to Departments
            </button>
          )}
          {(()=>{
            // Fold the flat nav array (items + divider markers) into groups so each
            // section header can collapse the rows beneath it. One shared row
            // renderer keeps grouped and icon-rail rendering identical.
            const visible = curNav.filter(item=>item.divider||canAccessScreen(currentUser, item.id));
            const groups = [];
            let cur = {id:"_ungrouped", label:"", items:[]};
            visible.forEach(item=>{
              if(item.divider){
                if(cur.items.length) groups.push(cur);
                cur = {id:item.id, label:item.label.replace(/──/g,'').trim(), items:[]};
              } else cur.items.push(item);
            });
            if(cur.items.length) groups.push(cur);

            const navRow = item => {
              const active=screen===item.id;
              const badge=item.id==="team"&&pendingLv>0?pendingLv:0;
              return(
                <button key={item.id} className={"ash-nav kh-rip"+(active?" is-active":"")} onPointerDown={ripple} onClick={()=>setScreen(item.id)}
                  title={!sideOpen?T(item.label,lang):undefined}
                  style={{
                    position:"relative",overflow:"hidden",
                    display:"flex",alignItems:"center",justifyContent:sideOpen?"space-between":"center",
                    width:"100%",padding:sideOpen?"8px 10px":"8px 0",borderRadius:14,marginBottom:4,
                    cursor:"pointer",textAlign:"left",minHeight:56,border:"none",
                    background:active?K.sbActiveBg:"transparent",
                    color:active?K.sbActiveText:K.sbText,
                    boxShadow:active?"0 6px 16px rgba(28,61,43,.26)":"none",
                  }}>
                  {/* Gold rail on the active row */}
                  {active&&<span style={{position:"absolute",left:0,top:8,bottom:8,width:4,borderRadius:"0 3px 3px 0",background:K.sbGoldSoft}}/>}
                  <span style={{display:"flex",alignItems:"center",gap:sideOpen?13:0,minWidth:0}}>
                    <span style={{width:40,height:40,borderRadius:12,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                      background:active?"rgba(255,255,255,.12)":K.sbChipBg,
                      border:`1px solid ${active?"rgba(255,255,255,.18)":K.sbChipLine}`,
                      color:active?K.sbActiveText:K.sbText}}>
                      <Icon name={NAV_ICON[item.id]||"layers"} size={19} strokeWidth={active?1.9:1.6}/>
                    </span>
                    {sideOpen&&<span style={{fontFamily:"var(--font-display)",fontSize:17,fontWeight:active?700:600,letterSpacing:-.1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{T(item.label,lang)}</span>}
                  </span>
                  {sideOpen&&(badge>0
                    ? <span style={{background:active?"rgba(255,255,255,.16)":K.sbBadgeBg,color:active?K.sbActiveText:K.sbBadgeText,fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:9,flexShrink:0}}>{badge}</span>
                    : active ? <Icon name="chevronR" size={16}/> : null)}
                </button>
              );
            };

            // Is this group showing? Groups start closed; the one holding the
            // current screen opens so you can always see where you are.
            const isGroupOpen = g => {
              const explicit = navClosed[g.id];
              return explicit !== undefined ? !explicit : g.items.some(i=>i.id===screen);
            };

            // The collapsed rail follows the SAME open/closed state. It used to
            // force every group open, so collapsing the sidebar to save space
            // produced a taller strip than the expanded one. Ungrouped items
            // (no label) always show — that is the primary nav.
            if(!sideOpen){
              const shown = groups.filter(g=>!g.label || isGroupOpen(g));
              return shown.map((g,gi)=>(
                <div key={g.id}>
                  {gi>0&&<div style={{height:1,background:K.sbLine,margin:"10px 6px"}}/>}
                  {g.items.map(navRow)}
                </div>
              ));
            }

            return groups.map(g=>{
              const hasActive = g.items.some(i=>i.id===screen);
              const closed    = !isGroupOpen(g);
              const badgeSum  = g.items.reduce((n,i)=>n+(i.id==="team"?pendingLv:0),0);
              if(!g.label) return <div key={g.id}>{g.items.map(navRow)}</div>;
              return(
                <div key={g.id}>
                  <button className="ash-navgroup kh-rip" onPointerDown={ripple} onClick={()=>setNavClosed(p=>({...p,[g.id]:!closed}))}
                    aria-expanded={!closed}
                    style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:"transparent",border:"none",
                      padding:"16px 6px 8px",cursor:"pointer",textAlign:"left",borderRadius:8}}>
                    <span style={{fontSize:11.5,fontWeight:700,color:K.sbTagline,textTransform:"uppercase",letterSpacing:1.7}}>{g.label}</span>
                    {/* When a section is folded away, show that something inside it
                        still wants attention — otherwise it silently disappears. */}
                    {closed&&hasActive&&<span title={T2("Current screen is in here")} style={{width:6,height:6,borderRadius:"50%",background:K.sbGoldSoft,flexShrink:0}}/>}
                    {closed&&badgeSum>0&&<span style={{background:K.sbBadgeBg,color:K.sbBadgeText,fontSize:10.5,fontWeight:700,padding:"2px 7px",borderRadius:7}}>{badgeSum}</span>}
                    {/* Hairline carries the eye from the label to the chevron and
                        makes each section read as a real divider, not stray text. */}
                    <span style={{flex:1,height:1,background:K.sbLine,minWidth:8}}/>
                    <span style={{display:"flex",color:K.sbLabel,transition:"transform .18s",transform:closed?"rotate(-90deg)":"none"}}>
                      <Icon name="chevronD" size={15}/>
                    </span>
                  </button>
                  {!closed&&g.items.map(navRow)}
                </div>
              );
            });
          })()}
        </nav>

        {/* User block lives in the topbar next to the bell, not here. */}

        {/* ── Footer artwork ──
            Drop it at Fnbapp/public/sidebar-footer.webp. The wave, the plate art
            and the "From our kitchen…" line are all baked into the image, so
            nothing is drawn here — the ivory top of the artwork blends into the
            panel. Missing file hides itself rather than showing a broken icon. */}
        {sideOpen&&(
          <div style={{position:"relative",zIndex:1,flexShrink:0,marginTop:"auto",lineHeight:0}}>
            <img src={`${import.meta.env.BASE_URL}sidebar-footer.webp`} alt="" aria-hidden="true" draggable="false"
              onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
              style={{display:"block",width:"100%",height:K.sbFooterH,
                objectFit:"cover",objectPosition:"center bottom",
                pointerEvents:"none",userSelect:"none"}}/>
          </div>
        )}
      </div>
      )}

      {/* ── MAIN CONTENT ── */}
      {/* zIndex must be >= the sidebar's (3) — position:relative alone puts this
          at the "auto" paint layer, which always renders BEHIND a sibling with
          an explicit positive z-index regardless of DOM order. Without this, any
          fixed-position modal a screen renders (nested arbitrarily deep inside
          here) painted UNDER the sidebar panel instead of over it. */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"transparent",position:"relative",zIndex:3}}>


        {/* Header + screen share one scroll container, so the brand plate scrolls
            away with the content instead of pinning and clipping it. */}
        {/* ── ALERTS BAR ──
            Slim row holding just the notification bell. Transform + opacity only
            when hiding: collapsing its height changed the scroll container's size,
            which moved scrollTop, which fired another scroll event with the
            opposite direction — the bar flapped open and shut. */}
        <div style={{position:"relative",zIndex:20,flexShrink:0,padding:"10px 32px 0",display:"flex",alignItems:"center",gap:10}}>

          {/* The only way back once the sidebar is collapsed, so it sits on the
              left where the panel used to be rather than among the account
              controls on the right. */}
          {!sideOpen&&(
            <button className="ash-iconbtn kh-rip" onPointerDown={ripple} onClick={()=>setSideOpen(true)}
              title={T2("Expand")} aria-label={T2("Expand")}
              style={{width:38,height:38,borderRadius:10,background:K.surface,border:`1px solid ${K.line}`,color:K.textMuted,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0,flexShrink:0}}>
              <Icon name="panelLeft" size={17} strokeWidth={2}/>
            </button>
          )}
          <span style={{marginLeft:"auto"}}/>


          {/* Bell hidden for now — set SHOW_BELL back to true to restore it.
              Kept rather than deleted: the toggle behaviour and the pending-leave
              badge below are worth keeping if it comes back. Clicking it when
              Team is already open returns you to the screen you came from. */}
          {false&&canAccessScreen(currentUser,"team")&&(
            <button className="ash-iconbtn kh-rip" onPointerDown={ripple}
              onClick={()=>{
                if(screen==="team"){ setScreen(bellReturnRef.current || "kitchen"); }
                else { bellReturnRef.current = screen; setScreen("team"); }
              }}
              title={pendingLv>0?`${pendingLv} ${T2("pending leave request(s)")}`:T2("No pending approvals")}
              style={{position:"relative",width:38,height:38,borderRadius:10,background:K.surface,border:`1px solid ${K.line}`,color:K.textMuted,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0,flexShrink:0}}>
              <Icon name="bell" size={17}/>
              {pendingLv>0&&<span style={{position:"absolute",top:8,right:8,width:8,height:8,borderRadius:"50%",background:K.danger,border:`2px solid ${K.surface}`}}/>}
            </button>
          )}

          {/* User chip + menu — the only home for sign out and the language toggle */}
          <div ref={userMenuRef} style={{position:"relative",flexShrink:0}}>
            <button className="ash-userchip ash-btn kh-rip" onPointerDown={ripple} onClick={()=>setUserMenuOpen(o=>!o)}
              style={{display:"flex",alignItems:"center",gap:9,padding:"4px 10px 4px 4px",height:38,borderRadius:10,background:K.surface,border:`1px solid ${K.line}`,cursor:"pointer"}}>
              <Avatar name={currentUser?.name||"A"} size={28} index={0}/>
              <span style={{fontSize:13,fontWeight:600,color:K.text,whiteSpace:"nowrap"}}>{currentUser?.name}</span>
              <Icon name="chevronD" size={14} color={K.textFaint} style={{transform:userMenuOpen?"rotate(180deg)":"none",transition:"transform .18s"}}/>
            </button>
            {userMenuOpen&&(
              <div style={{position:"absolute",top:44,right:0,zIndex:60,minWidth:210,background:K.surface,border:`1px solid ${K.line}`,borderRadius:14,boxShadow:K.shadowLift,overflow:"hidden",padding:4}}>
                <div style={{padding:"10px 12px 8px",borderBottom:`1px solid ${K.lineSoft}`,marginBottom:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:K.text}}>{currentUser?.name}</div>
                  <div style={{fontSize:11.5,color:K.textMuted,marginTop:2}}>{currentUser?.id} · {currentUser?.role==="admin"?"Admin":currentUser?.role}</div>
                </div>
                <button className="ash-menu-item kh-rip" onPointerDown={ripple} onClick={()=>{setLang(l=>l==="en"?"hi":"en");setUserMenuOpen(false);}}
                  style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                  <Icon name="globe" size={15}/>{lang==="en"?"हिंदी में बदलें":"Switch to English"}
                </button>
                {/* No Access Manager shortcut here — it is already a nav item. */}
                <button className="ash-menu-item is-danger kh-rip" onPointerDown={ripple} onClick={()=>{setUserMenuOpen(false);handleLogout();}}
                  style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                  <Icon name="logout" size={15}/>{T("Sign out",lang)}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top padding matches the sidebar's 10px margin so the brand plate and
            the sidebar panel start on the same line. */}
        <div onScroll={onContentScroll} style={{position:"relative",zIndex:1,flex:1,overflowY:"auto",padding:"10px 32px 32px",scrollBehavior:"smooth"}}>

        {/* Fade replaces a CSS mask that used to sit on this same scrolling
            div. mask-image also turns its element into a containing block for
            any position:fixed descendant — so a modal opened from anywhere
            inside here (arbitrarily deep) got faded/clipped at the top along
            with the scrolled content. A plain sticky overlay achieves the same
            look without trapping fixed children. */}
        {scrolled&&<div style={{position:"sticky",top:0,zIndex:2,height:34,marginBottom:-34,pointerEvents:"none",background:`linear-gradient(to bottom, ${K.shellBg} 0%, transparent 100%)`}}/>}

        {/* ── PAGE HEADER — brand plate ── */}
        <div style={{paddingBottom:18}}>
          <div style={{position:"relative",overflow:"hidden",background:K.hdrBg,border:`1px solid ${K.hdrLine}`,borderRadius:22,boxShadow:K.shadowCard,padding:"22px 26px",display:"flex",alignItems:"center",gap:22,flexWrap:"wrap"}}>

            {/* Decorative leaf, top-right */}
            <svg width="230" height="200" viewBox="0 0 230 200" aria-hidden="true"
              style={{position:"absolute",top:-26,right:-18,pointerEvents:"none",opacity:.5}}>
              <g fill="none" stroke="#D9C08A" strokeWidth="1.6" strokeLinecap="round">
                <path d="M188 6c-34 22-58 56-66 96-4 22-3 44 4 66"/>
                <path d="M182 34c-22 2-40 14-50 32M186 62c-24 0-44 10-56 28M188 92c-24-2-45 6-58 24M186 122c-22-4-42 0-55 16"/>
                <path d="M214 44c-20 26-30 58-28 92"/>
                <path d="M212 70c-14 4-25 13-30 26M214 98c-15 1-27 8-33 20"/>
              </g>
            </svg>

            {/* Screen badge — icon follows the current screen (same map the sidebar
                uses), so the chef hat only ever appears on Kitchen Hub. */}
            <div style={{width:64,height:64,borderRadius:20,background:K.hdrBadge,color:K.hdrBadgeIcon,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 6px 18px rgba(28,61,43,.28)"}}>
              <Icon name={NAV_ICON[screen]||"layers"} size={32} strokeWidth={1.6}/>
            </div>

            {/* Eyebrow · title · meta */}
            <div style={{flex:"1 1 320px",minWidth:0,position:"relative"}}>
              <div style={{fontSize:11.5,fontWeight:700,color:K.hdrEyebrow,textTransform:"uppercase",letterSpacing:2.2}}>{T2("Kitchen Operations")}</div>
              <div style={{...type.pageTitle,fontSize:38,color:K.hdrTitle,marginTop:2}}>{T(curNav.find(n=>n.id===screen)?.label||"Dashboard",lang)}</div>
              <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px 14px",marginTop:10,fontSize:13,color:K.hdrMeta}}>
                {/* No department chip. For an admin it always read "Management",
                    which is already stated by the user chip in the top bar and
                    by the sidebar they are looking at. */}
                <span style={{display:"inline-flex",alignItems:"center",gap:7}}><Icon name="calendar" size={15}/>{TODAY_LABEL}</span>
                {headerEvents&&<>
                  <span style={{color:K.hdrEyebrow}}>·</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:7}}><Icon name="users" size={15}/><span style={{color:K.hdrMetaStrong}}>{headerEvents}</span></span>
                </>}
              </div>
            </div>

            {/* Live status + at-a-glance chips */}
            {nextEvToday&&(
              <div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0,position:"relative",flexWrap:"wrap"}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:9,padding:"11px 18px",borderRadius:12,background:K.hdrLiveBg,color:K.hdrLiveText,fontSize:14,fontWeight:600,whiteSpace:"nowrap"}}>
                  <span style={{width:9,height:9,borderRadius:"50%",background:K.hdrLiveDot}}/>{T2("Active Event")}
                </span>
                <span style={{width:1,height:34,background:K.hdrChipLine}}/>
                <span style={{display:"inline-flex",alignItems:"center",gap:9,padding:"11px 18px",borderRadius:12,background:K.hdrChipBg,border:`1px solid ${K.hdrChipLine}`,color:K.hdrMetaStrong,fontSize:14,fontWeight:600,whiteSpace:"nowrap"}}>
                  <Icon name="clock" size={17}/>{nextEvToday.time||"TBD"}
                </span>
                <span style={{display:"inline-flex",alignItems:"center",gap:9,padding:"11px 18px",borderRadius:12,background:K.hdrChipBg,border:`1px solid ${K.hdrChipLine}`,color:K.hdrMetaStrong,fontSize:14,fontWeight:600,whiteSpace:"nowrap"}}>
                  <Icon name="users" size={17}/>{paxToday} {T2("pax")}
                </span>
              </div>
            )}
          </div>
        </div>

          <ErrorBoundary key={screen} lang={lang}><Suspense fallback={SCREEN_LOADING}>{renderScreen(screen)}</Suspense></ErrorBoundary>
        </div>
      </div>
      </div>
    </div>
  );
}


