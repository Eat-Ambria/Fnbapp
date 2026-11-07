// Ambria FnB Operations — Root App Component
// Decomposed: all screens, data, and utilities are in separate modules

import React, { useState, useRef, useEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import { supabase } from './lib/supabase.js';
import { staffAuthEmail, staffAuthPassword, classifyAuthError } from './lib/staffAuth.js';
import { dbLoad, dbUpsert, dbUpdate, dbDelete, dbSubscribe, dbRpc } from './lib/db.js';
import { getQueueSize, replayQueue, getLostWriteCount, clearLostWriteCount } from './lib/offlineQueue.js';

// Data
import { C, hydrateConstants } from './data/constants.js';
import { MENU_PACKAGES, hydrateMenuPackages, hydrateMenuPackageSections, refreshMenuPackages } from './data/menuPackages.js';
import { hydrateSalesConfigs } from './data/salesConfig.js';
import { EMPLOYEE_DB_INIT, hydrateStaffData } from './data/staffData.js';
import { hydrateRecipeData, subscribeRecipeRealtime, subscribeDishMetaRealtime, RECIPE_DB } from './data/recipeData.js';
import { T } from './data/translations.js';
import { canAccessScreen, hydratePermissions, hydrateScreenDefinitions, NAV_ITEMS } from './data/permissions.js';
import { hydrateAppSettings } from './data/appSettings.js';
import { loadAllConfig } from './lib/dbConfig.js';

// Utils
import './utils/styles.js';
import { TODAY, TODAY_LABEL, safeArr, safeObj, localDateStr, mergeDishState, diffDishState, ktPatchPaths, isHiddenSmallRestroBooking } from './utils/helpers.js';
import { syncAllKitchenMenuMirrors } from './lib/eventItems.js';

// Components
import { K, type } from './utils/theme.js';
import { ripple } from './utils/ripple.js';
import { Icon } from './components/Icons.jsx';
import { ErrorBoundary, Avatar } from './components/SharedUI.jsx';
import { LoginScreen } from './components/LoginScreen.jsx';
import { PublicFPHub } from './components/PublicFPHub.jsx';
import { Dashboard } from './components/Dashboard.jsx';
import { DeptView } from './components/DeptView.jsx';
import { StaffView } from './components/StaffView.jsx';
import { ActivityLog } from './components/ActivityLog.jsx';
import { NotificationCenter, isKitchenRole } from './components/NotificationCenter.jsx';

// Heavier, not-needed-on-first-paint screens — code-split so the initial bundle
// (login + dashboard) doesn't have to parse every admin/kitchen screen up front.
// Suspense fallbacks are wired at the two render call sites (tabletContent /
// renderScreen) below.
const KitchenHub          = React.lazy(() => import('./components/KitchenHub.jsx').then(m => ({ default: m.KitchenHub })));
const FunctionPlansHub    = React.lazy(() => import('./components/FunctionPlansHub.jsx').then(m => ({ default: m.FunctionPlansHub })));
const TeamHub             = React.lazy(() => import('./components/TeamHub.jsx').then(m => ({ default: m.TeamHub })));
const TransportDispatch   = React.lazy(() => import('./components/TransportDispatch.jsx').then(m => ({ default: m.TransportDispatch })));
const StoreModule         = React.lazy(() => import('./components/StoreModule.jsx').then(m => ({ default: m.StoreModule })));
const MenuPackagesView    = React.lazy(() => import('./components/MenuPackagesView.jsx').then(m => ({ default: m.MenuPackagesView })));
const AccessManager       = React.lazy(() => import('./components/AccessManager.jsx').then(m => ({ default: m.AccessManager })));
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

// Screen id → line-icon name (glyphs live in components/Icons.jsx). A purely
// presentational concern (which SVG glyph a screen gets in THIS app's
// sidebar), kept separate from permissions.js's SCREEN_PERMISSIONS — that
// file is the registry of what screens exist, their order/grouping and who
// can see them; this is just how one of them is drawn here.
const NAV_ICON = {
  dashboard:"home",        kitchen:"chefHat",       store:"box",
  function_plans:"fileText",
  team:"users",            menus:"fileText",        transport:"truck",
  dept_service:"plate",    dept_crockery:"cup",
  dept_beverages:"drink",  dept_fruits:"apple",     dept_odc:"tent",         proposals:"note",
  booked_functions:"calendarDays", sales_catalogue:"tag",
  access:"lock",           logs:"listCheck",
};

// The notification bell is parked, not deleted — the toggle behaviour and the
// pending-leave badge are worth keeping if it comes back. This is the flag its
// own comment already referred to; it gates the bell AND the row that exists
// only to hold it.
const SHOW_BELL = false;

// Applies ONE kt_set_paths-style path (e.g. "manual.s1", or the "__whole"
// sentinel for a scalar meta row) onto a dish-state object, returning a new
// object. Used by the kitchen_tracking realtime handler and the sync
// effect's own-write reconciliation to update exactly the path(s) a given
// server read/echo actually concerns, rather than overwriting a dish's
// whole local (or last-known-synced) value — which would silently discard
// a sibling path's change made locally in the same window.
function ktApplyPathToDish(base, pathKey, data) {
  if (pathKey === '__whole') return data;
  const next = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {};
  const dot = pathKey.indexOf('.');
  if (dot < 0) { next[pathKey] = data ? data[pathKey] : undefined; return next; }
  const top = pathKey.slice(0, dot), sub = pathKey.slice(dot + 1);
  next[top] = { ...(next[top] || {}), [sub]: data ? (data[top] ? data[top][sub] : undefined) : undefined };
  return next;
}

export default function App() {
  const [activeDept, setActiveDept]   = useState(null); // null = dept selector
  const [screen,setScreen]           = useState("dashboard");
  // Set by a notification click (NotificationCenter's onOpenEvent) — jumps to
  // Menu Packages' Build Menu tab and tells it which event's FP to auto-open.
  // Consumed once then cleared, same one-shot pattern as fpViewEvId itself.
  const [pendingFpEventId, setPendingFpEventId] = useState(null);
  function openEventFP(eventId) {
    setScreen('menus');
    setPendingFpEventId(eventId);
  }
  const [lang,setLang]               = useState("en");
  // Lazy init: on a phone the sidebar is a slide-in overlay (see .ash-sidebar
  // mobile CSS in theme.js), so starting it open would cover the whole screen
  // on first load. Desktop keeps the old always-open default.
  const [sideOpen,setSideOpen]       = useState(()=>typeof window==='undefined'||window.innerWidth>768);
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
  const [showPinReset,setShowPinReset] = useState(false);
  const [pinResetForm,setPinResetForm] = useState({current:"",next:"",confirm:"",error:""});
  const userMenuRef = useRef(null);
  useEffect(()=>{
    if(!userMenuOpen) return;
    const onDown = e => { if(userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); };
    const onEsc  = e => { if(e.key==="Escape") setUserMenuOpen(false); };
    document.addEventListener("mousedown",onDown);
    document.addEventListener("keydown",onEsc);
    return ()=>{ document.removeEventListener("mousedown",onDown); document.removeEventListener("keydown",onEsc); };
  },[userMenuOpen]);
  // ── Events ──
  // Full candidate DB record for one event row — same construction for both
  // the previous and next local copy, so the diff below (setEvents) compares
  // like with like, including the LMS "auto-resolved menu stores as []" rule.
  function buildEventRecord(e) {
    const isLms = !!(e.lms_source);
    const pkgDishes = e.menuPackage && MENU_PACKAGES[e.menuPackage] ? MENU_PACKAGES[e.menuPackage] : null;
    const isAutoResolved = isLms && pkgDishes && Array.isArray(e.menu) && e.menu.length === pkgDishes.length && e.menu.every(function(d,i){ return d === pkgDishes[i]; });
    const menuToStore = isAutoResolved ? [] : (e.menu||[]);
    return {id:e.id,guest:e.guest,venue:e.venue,date:e.date,time:e.time,type:e.type,pax:+e.pax||0,veg:+e.veg||0,nonveg:+e.nonveg||0,menu_package:e.menuPackage||null,menu:menuToStore,menu_section_overrides:e.menu_section_overrides||{},special:e.special||null,extras:e.extras||[],odc_location:e.odc_location||null,odc_address:e.odc_address||null,odc_contact_phone:e.odc_contact_phone||null,odc_transport_cost:e.odc_transport_cost||null,odc_lead:e.odc_lead||null,site_recce:e.site_recce||null,odc_menu_confirmed:e.odc_menu_confirmed??null,outsourced_dishes:e.outsourced_dishes||[],external_caterer:!!e.external_caterer,external_caterer_name:e.external_caterer_name||null};
  }
  const [events,setEvents_raw]       = useState([]);
  const setEvents = (updater) => {
    setEvents_raw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const prevMap = new Map(safeArr(prev).map(e=>[e.id, e]));
      const nextMap = new Map(safeArr(next).map(e=>[e.id, e]));
      nextMap.forEach((ev, id) => {
        if(prevMap.has(id) && prevMap.get(id) === ev) return;
        const prevEv = prevMap.get(id);
        const full = buildEventRecord(ev);
        if(!prevEv) {
          // Same failure mode the comment below already documents for the
          // existing-event patch path (events.guest/venue/date are NOT NULL,
          // and PostgREST's upsert validates the full proposed INSERT row
          // before ON CONFLICT even applies) — but here on the INSERT side:
          // if whatever called setEvents() built `ev` from a narrower local
          // snapshot than the real event (e.g. a menu-package auto-resolve
          // racing ahead of this tab's own events state actually having the
          // row yet), this looked "new" to prevMap even though it already
          // exists server-side, and the resulting insert attempt — missing
          // required columns — failed and retried identically forever on
          // every re-render, with no data ever actually at risk (the real
          // row was untouched throughout). Refuse to even attempt it instead.
          if(!full.guest || !full.venue || !full.date) {
            console.warn("[App] setEvents: refusing to create event with missing required fields (likely a stale/partial local copy racing a real one in):", full);
            return;
          }
          dbUpsert("events", full, "id").catch(e=>{
            // A genuinely failed insert (not offline) means this event was
            // never actually created server-side -- leaving it sitting in
            // local state would show it as a real booking that doesn't exist
            // anywhere else (Booked Functions, Kitchen Hub, etc. never see
            // it via realtime). Remove it and say why instead of a silent lie.
            console.error("ev create failed:", e);
            alert('Could not create "'+(ev.guest||id)+'": '+(e?.message||e)+'\nIt has been removed.');
            setEvents_raw(p => p.filter(x => x.id!==id));
          });
          return;
        }
        // Only send columns that actually changed vs this tab's OWN previous
        // copy. Several columns here (menu, menu_section_overrides,
        // outsourced_dishes) are also written directly and independently by
        // other tools (EventMenuBuilderView's mirrorKitchenMenu, Build Menu's
        // syncEventItemsFromKitchenMenu) that bypass this local `events`
        // state entirely. Sending the FULL row on every unrelated edit (e.g.
        // updating pax from Dashboard) used to re-send whatever stale copy
        // of those columns this tab still had cached — silently undoing the
        // other tool's fresher write the moment it landed before this tab's
        // own realtime echo caught up. Omitting an unchanged column from the
        // upsert leaves the DB's existing value alone instead.
        const prevFull = buildEventRecord(prevEv);
        const patch = { id: full.id };
        let changed = false;
        Object.keys(full).forEach(function(k){
          if(k === 'id') return;
          if(JSON.stringify(full[k]) !== JSON.stringify(prevFull[k])) { patch[k] = full[k]; changed = true; }
        });
        // dbUpdate, not dbUpsert: this is a PARTIAL patch on a row we already
        // know exists (prevEv above). PostgREST's upsert() validates NOT NULL
        // constraints against the full proposed INSERT row before it even
        // considers ON CONFLICT, so a partial patch 400s on any NOT NULL
        // column it doesn't happen to include (found live: a {id,menu_package}
        // patch failed on events.guest being null) and silently queues offline
        // forever. A real UPDATE only touches the named columns.
        if(changed) dbUpdate("events", patch, "id").catch(e=>{
          // A genuinely failed update (not offline) -- revert this one event
          // back to its last-known-saved copy instead of leaving the UI
          // showing an edit that never actually reached the database. This is
          // the exact bug class a menu-package edit hit earlier: save looked
          // fine, survived a refresh check, never actually landed.
          console.error("ev sync failed:", e);
          alert('Could not save changes to "'+(ev.guest||id)+'": '+(e?.message||e)+'\nReverted to the last saved version.');
          setEvents_raw(p => p.map(x => x.id===id ? prevEv : x));
        });
      });
      prevMap.forEach((_,id) => {
        if(!nextMap.has(id)) {
          // V72 soft-delete: mark tombstone instead of hard delete so LMS sync
          // (which upserts by id) can't resurrect the row on the next pull.
          const deletedEv = prevMap.get(id);
          const restoreAndWarn = (e) => {
            // Local state already dropped this event optimistically (it's
            // excluded from `next` above). If the tombstone write genuinely
            // failed, the event is still live in Supabase and would otherwise
            // reappear later via realtime/reload with zero explanation —
            // restore it now and say why instead of leaving a silent lie.
            console.error("ev soft-del failed:", e);
            alert('Could not delete "'+(deletedEv?.guest||id)+'": '+(e?.message||e)+'\nIt has been restored.');
            setEvents_raw(p => p.some(ev=>ev.id===id) ? p : [...p, deletedEv]);
          };
          supabase.from("events").update({is_deleted:true}).eq("id",id)
            .then(({error})=>{ if(error) restoreAndWarn(error); })
            .catch(restoreAndWarn);
        }
      });
      // TEMP: a manually-created/edited event that now matches the hidden
      // criteria (see isHiddenSmallRestroBooking) still gets synced to
      // Supabase above — just not kept in local state, same as the initial
      // load and realtime paths.
      return next.filter(function(e){ return !isHiddenSmallRestroBooking(e); });
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
  // NOT "ambria_kitchen_tracking" — that's the exact key lib/db.js's dbLoad
  // uses internally to cache kitchen_tracking's RAW SNAKE_CASE rows (its
  // cacheKey() is 'ambria_'+table). Every successful dbLoad('kitchen_tracking')
  // unconditionally overwrites that key with its own raw-row array, stomping
  // this file's app-shaped {evId:{dishKey:data}} cache underneath it. A
  // reload that then falls back to reading this key (device offline, or
  // simply before the first successful boot load lands) could silently load
  // db.js's raw rows as though they were already app-shaped — the likely
  // source of the "poisoned rows" KT_RESERVED_KEYS exists to filter out.
  const KT_LS_KEY = "ambria_kt_state_v2";
  // The kitchen_tracking table's own columns — some pre-existing rows in this
  // table have a dish_key literally equal to one of these (likely seed/test
  // data from before this table's schema settled, e.g. dish_key: "updated_at"
  // with the row's own timestamp as its "data"). Loaded as though it were real
  // per-dish state, that key's value keeps drifting every read/write cycle,
  // which looks "changed" to the diff below and gets re-uploaded forever —
  // thousands of pointless requests a session. Never load or re-upload one.
  const KT_RESERVED_KEYS = new Set(["id", "ev_id", "dish_key", "data", "created_at", "updated_at", "client_id", "client_write_ts", "key_ts"]);
  const [kitchenTracking, setKitchenTracking] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KT_LS_KEY) || "{}");
      // Defend against ever reading db.js's raw-row array cache (the old key
      // collision above) as though it were this file's app-shaped object.
      return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
    } catch { return {}; }
  });
  // Seeded from the SAME initial value kitchenTracking just loaded (not {}):
  // the sync effect below diffs kitchenTracking against this ref's last-known
  // value and re-uploads whatever's changed with a FRESH timestamp. Starting
  // this at {} made every cached dish look "changed" on every single app
  // boot, re-uploading this tablet's possibly-hours-stale local cache over
  // whatever a different tablet had written more recently in the meantime —
  // confirmed real: tablet A idle since 6pm, opened the next morning,
  // overwrote tablet B's 11pm work dish-by-dish with A's stale 6pm view.
  const ktSyncedRef = useRef(kitchenTracking);
  // One id per tab/session, stamped on every kitchen_tracking write below and
  // compared against incoming realtime echoes — a tap's own write always
  // echoes straight back to the SAME tab a moment later, and if a second tap
  // (Done, Undo...) on the same step lands locally before that echo arrives,
  // the echo is now a STALE snapshot of a state this tab has already moved
  // past. mergeDishState's key-wise merge (see its own comment) only
  // protects a key the stale echo never mentions; a key the echo DOES carry
  // (e.g. an Undo's explicit manual:false, starts:null, overwritten locally
  // moments later by a redo) still wins and reverts what the tap after it
  // did — the "row flips back on its own" bug. A tab never needs to replay
  // its own past writes onto itself, so this just skips them outright;
  // echoes from OTHER tabs/devices are untouched and still merge as before.
  const ktClientIdRef = useRef(null);
  if (!ktClientIdRef.current) ktClientIdRef.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
  // client_id above only protects a tab from ITS OWN past echoes. Two
  // DIFFERENT devices tapping the same step around the same moment used to
  // hit a real gap here, closed by a per-row client_write_ts comparison
  // (confirmed live: 1M+ writes in minutes, jumping between whichever dish
  // staff were actually cooking) — that comparison moved server-side, per
  // JSON PATH rather than per row, once writes switched to kt_set_paths (see
  // the sync effect and kt_set_paths' own migration comment for why a
  // row-level timestamp stopped being safe once more than one path on the
  // same row can be written independently). The server resolves WHICH write
  // wins before ever broadcasting — but realtime delivery itself can still
  // deliver an older echo after a newer one, so the kitchen_tracking
  // subscription below keeps its own per-path "last applied" timestamp
  // (ktPathTsRef) sourced from the server's key_ts, purely to reject
  // out-of-order DELIVERY, not to resolve who wins (that's already decided).
  const ktPathTsRef = useRef({}); // "evId|dishKey|path" -> last-applied key_ts seen from the server
  const ktSyncWarnedRef = useRef(false); // one alert per session, not one per failed tick
  // The account menu is anchored with position:fixed rather than absolute. The
  // sidebar panel sets overflow:hidden for its rounded corners and artwork, so
  // an absolutely positioned menu opening downward was clipped at the panel
  // edge. Fixed positioning escapes that, and the coordinates are taken from
  // the button itself so it lands in the same place on every screen size.
  const userChipRef = useRef(null);
  const [userMenuPos, setUserMenuPos] = useState(null);
  function openUserMenu() {
    const el = userChipRef.current;
    if (!el) { setUserMenuOpen(o => !o); return; }
    const r = el.getBoundingClientRect();
    const MENU_H = 150;
    // Prefer below; flip above only when there genuinely is not room.
    const below = window.innerHeight - r.bottom > MENU_H + 12;
    setUserMenuPos({
      left: r.left,
      width: Math.max(r.width, 210),
      ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }),
    });
    setUserMenuOpen(o => !o);
  }

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
          // Only the keys that actually changed go out, not this tablet's
          // whole local value for the dish — see diffDishState's own comment
          // for why sending the whole thing was the root cause of a tap on
          // one step reverting another tablet's genuine change to a
          // different step made moments earlier. kt_set_paths (the matching
          // server-side RPC) applies each changed path with jsonb_set, which
          // is race-free by construction since it only ever touches the
          // exact paths named here.
          const patch = diffDishState(prevEv[dishKey], val);
          if (patch.__whole === undefined && Object.keys(patch).length === 0) return;
          // This moment-of-the-tap timestamp is what kt_set_paths compares
          // against each path's own key_ts server-side — not used for
          // anything client-side anymore (see the comment above this effect).
          const writeTs = Date.now();
          const patchPaths = ktPatchPaths(patch);
          dbRpc("kt_set_paths", { p_ev_id: evId, p_dish_key: dishKey, p_patch: patch, p_client_id: ktClientIdRef.current, p_ts: writeTs })
            .then(result => {
              // kt_set_paths can REJECT one or more of the paths in this
              // patch if a genuinely newer write already landed for that
              // exact path while this call was in flight — and a rejected
              // path now runs no UPDATE at all, so no realtime broadcast
              // will ever tell this tab its own optimistic guess for that
              // path is wrong. Reconcile straight from the RPC's own
              // returned (server-authoritative) data instead of trusting
              // the local value is already correct. dbRpc returns null
              // (not {}) when the call was offline-queued rather than
              // executed — nothing to reconcile yet in that case.
              if (!result) return;
              const serverData = result.data, serverKeyTs = result.key_ts || {};
              // This response travels over plain HTTP, separately from the
              // websocket realtime echoes — the two channels give no
              // ordering guarantee between them. A FOREIGN tablet's broadcast
              // for a write genuinely newer than this call's own can arrive
              // and get correctly applied by the realtime handler below
              // BEFORE this response does. Blindly applying this response's
              // (now-stale) value afterwards would silently revert that
              // newer value with nothing left to correct it. So the decision
              // of which paths this response may still apply is made here,
              // per path, against ktPathTsRef's CURRENT value — exactly the
              // same guard the realtime handler uses — before touching any
              // state. `>=` (not `>`): ts and knownTs are equal whenever
              // nothing newer has landed since this call itself committed,
              // and that case must still apply (this call's commit IS the
              // write ktPathTsRef is comparing against for its own path).
              const applyPaths = [];
              patchPaths.forEach(pk => {
                const tk = evId + '|' + dishKey + '|' + pk;
                const ts = Number(serverKeyTs[pk]) || 0;
                const knownTs = ktPathTsRef.current[tk] || 0;
                if (ts < knownTs) return; // a foreign echo already applied something newer for this exact path — leave it
                ktPathTsRef.current[tk] = ts; // never lowers knownTs, since ts >= knownTs here
                applyPaths.push(pk);
              });
              if (!applyPaths.length) return;
              setKitchenTracking(p => {
                // Reconcile ONLY the paths THIS call sent (and that just
                // passed the check above) — never the whole dish — so a
                // sibling path tapped locally while this RPC was in flight
                // (and already folded into p[evId][dishKey] by a
                // later-queued update) is not clobbered by this call's own
                // snapshot. Same reasoning for ktSyncedRef: build it from
                // ktSyncedRef's OWN prior value for this dish, not from the
                // live (possibly newer, not-yet-pushed) p — spreading p here
                // would wrongly mark any not-yet-synced local edit (to this
                // dish or, worse, to an unrelated dish in the same event) as
                // already sent to the server.
                const prevDish = p[evId]?.[dishKey];
                const prevSyncedEv = ktSyncedRef.current[evId] || {};
                const prevSyncedDish = prevSyncedEv[dishKey];
                let liveDish = prevDish, syncedDish = prevSyncedDish;
                applyPaths.forEach(pk => {
                  liveDish = ktApplyPathToDish(liveDish, pk, serverData);
                  syncedDish = ktApplyPathToDish(syncedDish, pk, serverData);
                });
                const nextForEv = { ...(p[evId] || {}), [dishKey]: liveDish };
                ktSyncedRef.current = { ...ktSyncedRef.current, [evId]: { ...prevSyncedEv, [dishKey]: syncedDish } };
                return { ...p, [evId]: nextForEv };
              });
            })
            .catch(e => {
              console.error("KT sync failed:", dishKey, e);
              // Ticks happen dozens of times per shift, so an alert per failure
              // would be its own kind of disruption the original comment above
              // was right to avoid. But a GENUINE (non-offline) failure now
              // throws instead of silently queuing forever (db.js), and that
              // really does mean this tick never reached other kitchen
              // stations watching the same event live — worth one clear
              // warning per session rather than zero, ever.
              if (!ktSyncWarnedRef.current) {
                ktSyncWarnedRef.current = true;
                alert('A kitchen update failed to save and other stations may not see it: '+(e?.message||e)+'\n\nThis dish/step is still ticked on THIS screen, but please double-check it on another tablet, or re-tap it, if this keeps happening.');
              }
            });
        });
      });
    } catch (e) {
      // A sync failure must never blank the screen — the state is already set
      // and the offline queue will retry.
      console.error("KT sync error:", e);
    }
  }, [kitchenTracking]);

  // ── Transport Queue ──
  // NOT "ambria_transport_queue" — that's the exact key lib/db.js's dbLoad
  // uses internally to cache this table's RAW SNAKE_CASE rows (ev_id,
  // dish_name, event_date...), and it unconditionally overwrites that key on
  // every successful load. This file's own cache below is APP-SHAPED (evId,
  // dish, eventDate...) — the two sharing one key meant the fallback read a
  // few lines down (when a boot fetch comes back empty) could silently load
  // db.js's raw rows as if they were app-shaped, mapping every field to
  // undefined. The mount-time prune further down then saw a queue full of
  // "dishes" with no eventDate and deleted every single one.
  const TQ_LS_KEY = "ambria_tq_state_v2";
  const tqSyncWarnedRef = useRef(false); // one alert per session, not one per failed write
  const [transportQueue, setTransportQueue_raw] = useState([]);
  const setTransportQueue = (updater) => {
    setTransportQueue_raw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(TQ_LS_KEY, JSON.stringify(next)); } catch(e) {}
      const prevMap = new Map(safeArr(prev).map(q=>[q.id, q]));
      const nextMap = new Map(safeArr(next).map(q=>[q.id, q]));
      nextMap.forEach((q, id) => {
        if(!prevMap.has(id) || prevMap.get(id).status !== q.status || prevMap.get(id).vehicleId !== q.vehicleId) {
          dbUpsert("transport_queue",{id:q.id,dish_name:q.dish||q.dishName||"",ev_id:q.evId||null,sec:q.sec||null,station:q.station||null,qty:q.qty??null,unit:q.unit||null,event_guest:q.event,pax:+q.pax||0,venue:q.venue,event_date:q.eventDate,prepared_by:q.preparedBy,marked_at:q.markedAt,status:q.status,picked_up_at:q.pickedUpAt||null,from_venue:q.fromVenue||null,vehicle_id:q.vehicleId||null},"id").catch(e=>{
            console.error("tq sync:",e);
            if(!tqSyncWarnedRef.current){ tqSyncWarnedRef.current=true; alert('A transport queue update failed to save: '+(e?.message||e)+'\n\nOther screens may not see this change — please re-check it there.'); }
          });
        }
      });
      prevMap.forEach((_,id) => {
        if(!nextMap.has(id)) dbDelete("transport_queue","id",id).catch(e=>{
          console.error("tq del:",e);
          if(!tqSyncWarnedRef.current){ tqSyncWarnedRef.current=true; alert('Removing a transport queue item failed to save: '+(e?.message||e)+'\n\nIt may reappear elsewhere — please re-check.'); }
        });
      });
      return next;
    });
  };

  // Public FP hub flag — read once; this never changes within a page's lifetime
  // (reaching it with a different ?fp means a fresh navigation/reload anyway).
  const [isPublicFP] = useState(function(){
    try { return new URLSearchParams(window.location.search).get('fp') != null; } catch(e) { return false; }
  });
  const [outsideChefAtt,setOutsideChefAtt] = useState([]);
  const [currentUser,setCurrentUser] = useState(null);
  const [forceLogoutMsg,setForceLogoutMsg] = useState(null);
  const [empDb, setEmpDb]             = useState(EMPLOYEE_DB_INIT);
  const [appReady, setAppReady]       = useState(false);
  const [supaLive, setSupaLive]       = useState(null); // null=checking, true=live, false=offline
  const [dateDrift, setDateDrift]     = useState(false);
  // Bumped by handleLogin to re-run the master load effect below. Needed
  // once RLS actually restricts anon (stage 2 of the RLS rollout): the
  // FIRST run of that effect, at mount, fires before anyone's logged in --
  // under stage 2 that's an anon-context fetch that comes back empty for
  // every RLS-protected table, not an error, so nothing catches it on its
  // own. A session established AFTER that initial load (LoginScreen's
  // onLogin -> handleLogin) needs the exact same load run again, now
  // authenticated, or the app stays empty (no events, no menus, nothing)
  // until a manual reload. Harmless to also fire on an already-logged-in
  // boot (every step in that effect is either idempotent, a merge, or
  // gated by its own cooldown -- see the effect's own comments).
  const [dataReloadTick, setDataReloadTick] = useState(0);
  // subscribeRecipeRealtime/subscribeDishMetaRealtime open a channel keyed by
  // a fixed topic name and call .on(...) before .subscribe() -- calling them
  // again on the post-login re-run (dataReloadTick) hands back the SAME
  // already-joined channel (realtime-js matches by topic) and throws on the
  // second .on() call, which aborts the whole config-hydration try/catch
  // block before allocRules/dbChecklists get set. These two calls are a
  // true one-time boot step, not part of what dataReloadTick should repeat.
  const realtimeSubscribedRef = useRef(false);

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

  // ── Auto-reload an already-open tab onto a new deploy ──
  // V96 removed the service-worker-based caching this used to detect updates
  // through (see sw.js's own header) -- with no caching left anywhere, a
  // reload or fresh open already always gets the latest build for free, but
  // nothing was left to notice a new deploy for a tab that's just sitting
  // open (a kitchen tablet on the login screen all shift, say). This checks
  // the live index.html's own script tag -- the one thing that changes on
  // every deploy, since Vite content-hashes it -- against this tab's own,
  // with a `cache: 'no-store'` fetch so it can never read a cached copy of
  // the very thing it's trying to detect a change in. Reuses the same
  // "only when it's actually safe" idle check this app already had for the
  // old SW-update banner: no focused input/textarea/select/contentEditable
  // (every text field here only saves on blur, so nothing typed is lost by
  // waiting) and no live camera stream (the selfie-capture flow).
  useEffect(() => {
    let currentSrc = null;
    try {
      const tag = document.querySelector('script[type="module"][src*="/assets/"]');
      currentSrc = tag && tag.getAttribute('src');
    } catch(e) {}
    if (!currentSrc) return; // dev server / no hashed bundle to compare against
    let newBuildSeen = false;
    let lastActivity = Date.now();
    const markActivity = () => { lastActivity = Date.now(); };
    const activityEvents = ['pointerdown','touchstart','keydown'];
    activityEvents.forEach(ev => document.addEventListener(ev, markActivity));
    function isSafeToReload(){
      const ae = document.activeElement;
      const tag = ae && ae.tagName;
      if(tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || (ae && ae.isContentEditable)) return false;
      const videos = document.querySelectorAll('video');
      for(let i=0;i<videos.length;i++){ if(videos[i].srcObject) return false; }
      return (Date.now() - lastActivity) >= 2*60*1000;
    }
    async function checkForNewBuild(){
      if (newBuildSeen) { if (isSafeToReload()) window.location.reload(); return; }
      try {
        const res = await fetch(window.location.pathname, { cache: 'no-store' });
        const html = await res.text();
        const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]+\/assets\/[^"]+)"/);
        if (m && m[1] && m[1] !== currentSrc) newBuildSeen = true;
      } catch(e) {} // offline / request failed — try again next tick, never block on it
    }
    checkForNewBuild();
    const iv = setInterval(checkForNewBuild, 60*1000);
    const onVisible = () => { if (document.visibilityState === 'visible') checkForNewBuild(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', checkForNewBuild);
    return () => {
      clearInterval(iv);
      activityEvents.forEach(ev => document.removeEventListener(ev, markActivity));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', checkForNewBuild);
    };
  }, []);

  // ── Master load: session + all data ──
  useEffect(() => {
    // A public FP hub visit (?fp=1) fetches everything it needs itself via
    // the public-fp-view edge function and never reaches the screens this
    // feeds -- running it anyway would still mean every such visit
    // anonymously writes to events.menu (syncAllKitchenMenuMirrors below),
    // upserts the AM001 boot-seed, and fires an lms-sync invoke, none of
    // which a no-identity visitor should ever trigger.
    if (isPublicFP) return;
    async function loadAll() {
      // Clear any legacy localStorage kitchen tracking keys
      try { localStorage.removeItem('ambria_kt'); localStorage.removeItem('ambria_kitchen_tracking'); } catch(e) {}
      // Restore a cached profile purely for a fast initial paint while the
      // real session/staff data load below -- this is never the thing that
      // decides whether the device is actually logged in (GoTrue's own
      // session, restored automatically by the Supabase client, is that
      // authority), just a UI head start so the screen isn't blank for the
      // length of the data load.
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
        hydratePermissions(cfg.roleDefinitions);
        hydrateScreenDefinitions(cfg.screenDefinitions);
        hydrateAppSettings(cfg.appSettings);
        hydrateRecipeData(cfg);
        if (!realtimeSubscribedRef.current) {
          realtimeSubscribedRef.current = true;
          subscribeRecipeRealtime(supabase);
          subscribeDishMetaRealtime(supabase);
        }
        if(cfg.allocRules) setAllocRules(cfg.allocRules);
        if(cfg.checklists) setDbChecklists(cfg.checklists);
      } catch(e) { console.warn('Config hydration failed, using fallbacks:', e); }

      const [staffData, eventsData, ktData, tqData] = await Promise.all([
        dbLoad('staff', EMPLOYEE_DB_INIT),
        dbLoad('events', []),
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
      // GoTrue's own session is the actual authority on whether this device
      // is logged in -- not the ambria_session_user cache restored above,
      // which was only ever a fast-paint preview. A PIN reset elsewhere
      // (admin-staff-auth's admin_revoke_user_sessions RPC) already
      // invalidates this device's session server-side, so there's no custom
      // "did the pin change" comparison needed here at all anymore -- if the
      // session was revoked, getSession() simply won't return a usable one.
      try {
        if(!supabase){
          // Offline/unconfigured mode -- nothing to confirm against, trust
          // whatever the fast-paint cache already set.
        } else {
          const { data: { session }, error: sessErr } = await supabase.auth.getSession();
          if(sessErr){
            // getSession() tries to refresh an expired session and, on a
            // network/offline failure, returns an error WITHOUT destroying
            // the session already in storage (it's left for a later retry).
            // Treating this the same as "no session" would log out a device
            // that's simply offline right now, regressing this app's
            // offline-first design. Leave the fast-paint cache as-is and let
            // a later boot/reconnect confirm properly.
            console.warn('[App] getSession() failed (offline?) — keeping cached session for now:', sessErr);
          } else if(!session){
            setCurrentUser(null);
            try{ localStorage.removeItem("ambria_session_user"); }catch(e){}
          } else {
            const fresh = mergedStaff.find(s => s.auth_user_id === session.user.id);
            // Only treat "no matching/inactive row" as authoritative when
            // the staff list actually looks like it came from the server --
            // an offline boot that fell back to an empty/stale local cache
            // (dbLoad's own fallback) must not read as "this account was
            // removed," which would wrongly sign out a perfectly valid
            // session with no way to log back in until reconnecting.
            const staffDataLooksLive = mergedStaff.length > 0;
            if(staffDataLooksLive && (!fresh || fresh.is_active===false)){
              // No matching/active staff row for an otherwise-valid session
              // (deactivated while this device was away, or a session for a
              // row that no longer exists) -- sign out of the stale session.
              // scope:'local' -- this only ends THIS device's session, never
              // revokes the account's other sessions (that's
              // admin_revoke_user_sessions, a deliberate separate action).
              setCurrentUser(null);
              await supabase.auth.signOut({ scope: 'local' }).catch(()=>{});
              try{ localStorage.removeItem("ambria_session_user"); }catch(e){}
            } else if(fresh){
              let cached = null;
              try { const suRaw2 = localStorage.getItem("ambria_session_user"); cached = suRaw2 ? JSON.parse(suRaw2) : null; } catch(e) {}
              // This DB refresh used to blindly overwrite venue with the
              // static Home Venue configured in Access Manager, silently
              // discarding whatever the tablet's own login screen asked for
              // that day ("Where is this tablet located today?" — see
              // LoginScreen.jsx). A section tablet answers that prompt on
              // every login precisely because it moves between venues, so
              // that answer — persisted to ambria_venue_override, most
              // recent wins — is the current location, not the seed default.
              let venueOverride = null;
              try { venueOverride = localStorage.getItem("ambria_venue_override"); } catch(e) {}
              const cid = fresh.staff_id;
              const refreshed = {...fresh, id:cid, staffListId:fresh.staffListId||cid, venue: venueOverride || cached?.venue || fresh.venue};
              setCurrentUser(refreshed);
              try{ localStorage.setItem("ambria_session_user", JSON.stringify(refreshed)); }catch(e){}
            }
          }
        }
      } catch(e) {}

      // Use whatever Supabase returns (empty is fine — LMS sync will populate)
      // V72 soft-delete: filter tombstones on hydration so deleted events don't
      // flash back into the UI on refresh.
      const finalEvents = (eventsData || []).filter(function(e){ return !e.is_deleted && !isHiddenSmallRestroBooking(e); });
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
        return {...e, menuPackage:pkg, menu, extras, outsourced_dishes:Array.isArray(e.outsourced_dishes)?e.outsourced_dishes:[], odc_location:e.odc_location||null, odc_address:e.odc_address||null, odc_contact_phone:e.odc_contact_phone||null, odc_transport_cost:e.odc_transport_cost||null, odc_lead:e.odc_lead||null, site_recce:e.site_recce||null, odc_menu_confirmed:e.odc_menu_confirmed??false, custom_menu_confirmed:e.custom_menu_confirmed??false, yield_multiplier:Number(e.yield_multiplier)||1.0};
      }));
      // Self-heal events.menu (the Kitchen-only mirror of event_items) for
      // every upcoming event right at boot — a menu changed anywhere
      // (Items tab, Build Menu, anywhere else) then shows up correctly in
      // Kitchen Hub (Planning, Event Day, Prep Day, Analytics...) from the
      // moment the app loads, with nothing extra to click. Uses the RAW
      // stored menu (not the package-default display fallback above) so the
      // drift check compares against what's actually in the DB. Fire-and-
      // forget — never blocks the rest of boot.
      syncAllKitchenMenuMirrors(
        finalEvents
          .filter(e => e.date && e.date >= TODAY)
          .map(e => {
            let m = e.menu;
            if (!Array.isArray(m)) { if (typeof m === 'string' && m) { try { m = JSON.parse(m); } catch(err) { m = []; } } else { m = []; } }
            return { ...e, menu: m };
          })
      ).then(updates => {
        // This only wrote the DB — without also patching the local copy, this
        // tab keeps rendering the pre-heal menu (Planning, Event Day...) until
        // a full reload re-fetches the now-corrected rows. setEvents_raw, not
        // setEvents — this is reflecting what the DB already has, not a new
        // edit to push back out.
        if (updates && updates.length) {
          const byId = new Map(updates.map(u => [u.id, u.menu]));
          setEvents_raw(prev => prev.map(e => byId.has(e.id) ? {...e, menu: byId.get(e.id)} : e));
        }
      }).catch(e => console.error('[App] syncAllKitchenMenuMirrors failed:', e));
      if(ktData.length>0){
        const ktObj={};
        // `?? {}`, not `|| {}` — the meta keys now sync too, and a stored
        // `false` (an un-dispatched function) would otherwise come back as an
        // empty object, which is truthy and would read as dispatched.
        ktData.forEach(row=>{
          if(KT_RESERVED_KEYS.has(row.dish_key))return;
          if(!ktObj[row.ev_id])ktObj[row.ev_id]={};
          ktObj[row.ev_id][row.dish_key]=row.data ?? {};
          // Seed the per-path echo-ordering ref from what's already on the
          // server at boot — without this, every path on an already-loaded
          // dish starts at an implicit 0, so the realtime handler's "only a
          // genuinely newer write may overwrite this path" guard (above)
          // would treat literally any echo as newer and reapply it, even
          // one carrying a now-stale value for a path this tab already has.
          const rowKts=row.key_ts;
          if(rowKts&&typeof rowKts==='object'){
            Object.keys(rowKts).forEach(pathKey=>{
              const tk=row.ev_id+'|'+row.dish_key+'|'+pathKey;
              const ts=Number(rowKts[pathKey])||0;
              if(ts>(ktPathTsRef.current[tk]||0)) ktPathTsRef.current[tk]=ts;
            });
          }
        });
        // MERGE over whatever the local seed already holds — do not replace.
        // A straight replace would wipe anything ticked off while the row had
        // not reached Supabase yet. Server wins per key; local-only keys stay.
        setKitchenTracking(prev => {
          const merged = { ...(prev || {}) };
          Object.keys(ktObj).forEach(evId => {
            merged[evId] = { ...(merged[evId] || {}), ...ktObj[evId] };
          });
          // The synced ref must reflect the FULL merged result (server data
          // PLUS whatever local-only keys survived the merge above), not just
          // the server's own ktObj — setting it to ktObj alone made every
          // local-only key look "changed" against this ref on the very next
          // sync-effect run, re-uploading it with a brand-new timestamp even
          // though nothing about it actually changed just now.
          ktSyncedRef.current = merged;
          return merged;
        });
      }
      if(tqData.length>0){
        setTransportQueue_raw(tqData.map(q=>({id:q.id,dish:q.dish_name,evId:q.ev_id||null,sec:q.sec||null,station:q.station||null,qty:q.qty??null,unit:q.unit||null,event:q.event_guest,pax:q.pax,venue:q.venue,eventDate:q.event_date,preparedBy:q.prepared_by,markedAt:q.marked_at,status:q.status,pickedUpAt:q.picked_up_at||undefined,fromVenue:q.from_venue||"",vehicleId:q.vehicle_id||""})));
      } else {
        try{const c=JSON.parse(localStorage.getItem(TQ_LS_KEY)||"[]");if(Array.isArray(c)&&c.length)setTransportQueue_raw(c);}catch(e){}
      }
      // Seed AM001 to Supabase on every load (idempotent)
      const am001=EMPLOYEE_DB_INIT.find(e=>e.staff_id==='AM001'||e.staffListId==='AM001');
      // No pin field -- that column is gone (or going, see the auth+RLS
      // migrations); a re-seeded AM001 gets its login provisioned the same
      // way any other new staff member does (AccessManager/TeamHub's "Add"
      // flow, via admin-staff-auth), not through this boot-seed.
      if(am001) dbUpsert('staff',{staff_id:am001.staff_id||am001.staffListId,name:am001.name,section:am001.section||null,dept:am001.dept||null,role:'admin',is_admin:true,is_active:true,joining:am001.joining||null,phone:am001.phone||null},'staff_id').catch(e=>console.warn('AM001 boot-seed failed (non-fatal, idempotent — will retry next boot):',e));

      // Auto-sync from LMS (15-min cooldown)
      try{
        const lastSync=localStorage.getItem('ambria_lms_last_sync_ts');
        const cooldown=15*60*1000; // 15 minutes
        if(supabase&&(!lastSync||Date.now()-parseInt(lastSync)>cooldown)){
          // Claim the cooldown before the call resolves, not after -- the
          // anon boot run and a login-triggered reload (dataReloadTick) can
          // both reach this check before either's invoke() has returned,
          // and writing the timestamp only on success let both fire lms-sync
          // concurrently.
          try{localStorage.setItem('ambria_lms_last_sync_ts',String(Date.now()));}catch(e){}
          supabase.functions.invoke('lms-sync',{body:{triggered_by:'auto-boot'}})
            .then(({data})=>{
              if(data?.status==='success') console.log(`✅ LMS auto-sync: ${data.events_upserted} events`);
              else console.warn('LMS auto-sync returned:',data);
              const now=new Date().toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
              try{localStorage.setItem('ambria_lms_last_sync',now);}catch(e){}
            })
            .catch(e=>console.warn('LMS auto-sync failed:',e));
        }
      }catch(e){}

      setAppReady(true);
    }
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReloadTick]);

  // Catches a session GoTrue itself has invalidated -- the main case is an
  // admin's PIN reset (admin-staff-auth's admin_revoke_user_sessions RPC),
  // which revokes this device's refresh token server-side immediately. This
  // device's current access token keeps working until it naturally expires
  // (the SDK auto-refreshes shortly before that), at which point the refresh
  // fails and supabase-js fires SIGNED_OUT here -- this is what actually ends
  // the session on this device, not any client-side comparison. The `appReady`
  // guard skips the SIGNED_OUT this itself fires when loadAll() finds no
  // session / signs out a deactivated or stale one at boot, so that doesn't
  // show a spurious "please log in again" the very first time the app opens
  // with nobody logged in yet.
  const currentUserRef = useRef(null);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  const appReadyRef = useRef(false);
  useEffect(() => { appReadyRef.current = appReady; }, [appReady]);
  useEffect(() => {
    if (!supabase) return;
    // Mount-once: reads the latest currentUser/appReady via refs rather than
    // closing over the state values from whenever this effect last ran, since
    // the event this reacts to can fire at any arbitrary future point (hours
    // or days later), long after any closure captured at setup time would be
    // stale.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && appReadyRef.current && currentUserRef.current) {
        setCurrentUser(null);
        setActiveDept(null);
        try{ localStorage.removeItem("ambria_session_user"); }catch(e){}
        setForceLogoutMsg(T2("Your PIN was reset. Please log in again with your new PIN."));
      }
    });
    return () => { sub?.subscription?.unsubscribe(); };
  }, []);

  // Role/screen registry edits (Access Manager's Manage Roles/Manage Screens)
  // only ever patched the editing device's own in-memory PRESET_ROLES/
  // SCREEN_PERMISSIONS (permissions.js) after writing to Supabase — any other
  // already-open session kept serving its stale registry until a full reload,
  // so revoking a screen from a role (or hiding a screen app-wide) did not
  // take effect for anyone already logged in. canAccessScreen/NAV_ITEMS read
  // that module state fresh on every render, so the only thing missing was a
  // reason for an already-open session to actually re-render when it changes —
  // this tick forces one.
  const [permsTick, setPermsTick] = useState(0);

  // ── Realtime subscriptions (after data loaded) ──
  useEffect(() => {
    if (!appReady) return;
    const u1 = dbSubscribe('staff', (payload) => {
      const newRow = payload.new;
      if(payload.eventType==='INSERT') setEmpDb(p=>{if(p.some(s=>(s.staffListId||s.staff_id)===newRow.staff_id))return p;return[...p,{...newRow,staffListId:newRow.staff_id}];});
      if(payload.eventType==='UPDATE'){
        setEmpDb(p=>p.map(s=>(s.staffListId||s.staff_id)===newRow.staff_id?{...s,...newRow,staffListId:newRow.staff_id}:s));
        // An admin granting/changing a tab permission on their own device only
        // ever updated empDb above — the logged-in tablet it was actually
        // meant for keeps its own currentUser as a separate snapshot taken at
        // login (canAccessScreen reads THAT, not empDb), so the change stayed
        // invisible there until someone reloaded or logged out and back in.
        // A PIN reset no longer touches this table at all (the PIN lives in
        // auth.users now) and is enforced via admin-staff-auth's
        // admin_revoke_user_sessions RPC instead — this handler only needs to
        // keep currentUser live-synced with ordinary profile/role edits, not
        // security-enforce anything itself.
        setCurrentUser(prev=>{
          if(!prev) return prev;
          const pid=prev.staffListId||prev.staff_id||prev.id;
          if(pid!==newRow.staff_id) return prev;
          // Deactivating the currently-open session's own account DOES need
          // to actually end it here -- a role change alone just updates what
          // this device can see (handled by the merge below), but staying
          // signed in past is_active:false would let it keep working with a
          // still-valid GoTrue session regardless of what the UI now hides.
          if(newRow.is_active===false){
            try{ localStorage.removeItem("ambria_session_user"); }catch(e){}
            // scope:'local' -- ends only THIS device's session; a bare
            // signOut() defaults to 'global' and would revoke this person's
            // OTHER devices too, which is a much bigger action than "this
            // one device noticed its own row went inactive."
            if(supabase) supabase.auth.signOut({ scope: 'local' }).catch(()=>{});
            setActiveDept(null);
            setForceLogoutMsg(T2("Your access was updated. Please log in again."));
            return null;
          }
          // Keep this device's own venue answer, same precedent as the
          // boot-time refresh above — a section tablet's "where is this
          // tablet today" answer must not get silently overwritten by
          // whatever Access Manager has saved as the static Home Venue.
          let venueOverride=null; try{venueOverride=localStorage.getItem("ambria_venue_override");}catch(e){}
          const updated={...prev,...newRow,id:pid,staffListId:newRow.staff_id,venue:venueOverride||prev.venue};
          try{localStorage.setItem("ambria_session_user",JSON.stringify(updated));}catch(e){}
          return updated;
        });
      }
      if(payload.eventType==='DELETE') setEmpDb(p=>p.filter(s=>(s.staffListId||s.staff_id)!==payload.old.staff_id));
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
        return {...raw,menuPackage:pkg,menu,extras:raw.extras||[],outsourced_dishes:Array.isArray(raw.outsourced_dishes)?raw.outsourced_dishes:[],odc_location:raw.odc_location||null,odc_address:raw.odc_address||null,odc_contact_phone:raw.odc_contact_phone||null,odc_transport_cost:raw.odc_transport_cost||null,odc_lead:raw.odc_lead||null,site_recce:raw.site_recce||null,odc_menu_confirmed:raw.odc_menu_confirmed??false,custom_menu_confirmed:raw.custom_menu_confirmed??false,yield_multiplier:Number(raw.yield_multiplier)||1.0};
      }
      // V72 soft-delete: is_deleted=true on INSERT/UPDATE must remove row from local state.
      // TEMP: a small Ambria Restro booking (or one edited down below the pax
      // threshold) is dropped from local state the same way a tombstone is —
      // see isHiddenSmallRestroBooking.
      if(payload.eventType==='INSERT'&&payload.new){
        setEvents_raw(p=>{
          const existing=p.find(e=>e.id===payload.new.id);
          const ev=buildEv(existing);
          if(ev.is_deleted||isHiddenSmallRestroBooking(ev)) return p.filter(e=>e.id!==ev.id);
          return existing?p.map(e=>e.id===ev.id?ev:e):[...p,ev];
        });
      }
      if(payload.eventType==='UPDATE'&&payload.new){
        setEvents_raw(p=>{
          const existing=p.find(e=>e.id===payload.new.id);
          const ev=buildEv(existing);
          if(ev.is_deleted||isHiddenSmallRestroBooking(ev)) return p.filter(e=>e.id!==ev.id);
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
      //
      // This tab's OWN writes are skipped entirely, not merged — merging only
      // protects a key an echo omits; a key it DOES carry (e.g. an Undo's
      // explicit manual:false) still overwrites whatever this tab has done
      // since, and a second rapid tap on the same step reliably outruns its
      // own first tap's echo. A tab replaying its own past write onto itself
      // only loses, never gains, information, so it's just skipped.
      //
      // The same problem also happens ACROSS devices (two tablets tapping the
      // same step around the same moment) — this used to be guarded here via
      // client_write_ts (a single per-ROW timestamp), dropping any echo
      // older than the newest write already known for this row. That worked
      // when every write replaced the whole row, but now that kt_set_paths
      // (the write side, above) writes one JSON PATH at a time, a row-level
      // timestamp is the wrong granularity: a fresh write to step_3 bumps
      // the row's timestamp past an in-flight, perfectly valid write to
      // step_2, making step_2's own echo look "stale" by comparison even
      // though nothing actually raced it. kt_set_paths resolves THAT race —
      // whether its OWN write applies — per path, server-side, before ever
      // broadcasting. But realtime delivery itself is not guaranteed to
      // arrive in commit order, so an OLDER echo can still be DELIVERED to
      // this tab after a NEWER one for the very same path — unconditionally
      // merging every echo as it arrives could let that stale, out-of-order
      // echo overwrite something newer this tab already has. kt_set_paths now
      // broadcasts its row's key_ts alongside data, so this handler compares
      // each path's incoming key_ts against the newest it's already applied
      // for that EXACT path (ktPathTsRef) and skips the ones that aren't
      // strictly newer — never a blanket row-level check, since that was the
      // original bug (an unrelated path's fresh write looking like it raced
      // a path it never touched).
      //
      // STRICT greater-than, not >=: every broadcast carries the row's
      // WHOLE key_ts object (Postgres/Supabase realtime has no concept of
      // "only the columns this statement changed"), not just the one path
      // that changed in that particular UPDATE — so a broadcast for path Y
      // also re-presents every OTHER path's unchanged, already-known
      // timestamp for X. With >=, that would re-apply X's (old, correct but
      // already-superseded-locally) echoed value on top of an in-flight
      // optimistic local tap on X whose own RPC hasn't resolved yet, purely
      // because X's old timestamp still matched. Strict > means only a
      // GENUINELY newer value for a path ever overwrites what's known.
      // ktPathTsRef is seeded from each row's key_ts at boot (see the
      // boot-merge below) precisely so a dish's PRE-existing paths aren't
      // sitting at a default of 0 (which would make any first echo "newer"
      // regardless of this reasoning).
      //
      // This also writes the merged result into ktSyncedRef (not just
      // kitchenTracking) in the same update — without that, the sync effect
      // above sees an externally-arrived echo as "new local state" on its
      // next run and re-uploads it right back under THIS tab's own id,
      // which is how two tabs end up ping-ponging a value back and forth
      // forever. Built from ktSyncedRef's OWN prior per-dish value, not from
      // the live kitchenTracking state `p` — spreading `p` here would wrongly
      // mark any not-yet-synced local edit (to this dish, or to an unrelated
      // dish in the same event already folded into `p` by an earlier-queued
      // local update) as already sent to the server, and the sync effect
      // would then never push it.
      // Supabase always sets payload.new to {} (truthy) on a DELETE, not
      // undefined — so this branch must explicitly exclude DELETE too, or it
      // fires alongside the DELETE branch below and writes a stray
      // kitchenTracking[undefined][undefined] entry every time a row is removed.
      if(payload.eventType!=='DELETE'&&payload.new){
        const {ev_id,dish_key,data,client_id,key_ts}=payload.new;
        if(KT_RESERVED_KEYS.has(dish_key))return;
        const kts=(key_ts&&typeof key_ts==='object')?key_ts:{};
        if(client_id&&client_id===ktClientIdRef.current){
          // Our own echo. Nothing to merge (we already have this value
          // locally, confirmed via the sync effect's own RPC-return
          // reconciliation), but still record its timestamps so a LATER,
          // genuinely stale echo from another device doesn't look "newer
          // than anything this tab has seen" against a still-zeroed ref.
          Object.keys(kts).forEach(pathKey=>{
            const tk=ev_id+'|'+dish_key+'|'+pathKey;
            const ts=Number(kts[pathKey])||0;
            if(ts>(ktPathTsRef.current[tk]||0)) ktPathTsRef.current[tk]=ts;
          });
          return;
        }
        const hasPathInfo=Object.keys(kts).length>0;
        setKitchenTracking(p=>{
          const prevDish=p[ev_id]?.[dish_key];
          const prevSyncedEv=ktSyncedRef.current[ev_id]||{};
          const prevSyncedDish=prevSyncedEv[dish_key];
          let nextDish=prevDish, nextSyncedDish=prevSyncedDish;
          if(!hasPathInfo){
            // Row never touched by kt_set_paths (pre-migration data, or a
            // stale client still on the old whole-row write path) — no
            // per-path info to compare against, so fall back to the same
            // plain merge used before this change.
            nextDish=mergeDishState(prevDish,data||{});
            nextSyncedDish=mergeDishState(prevSyncedDish,data||{});
          } else {
            Object.keys(kts).forEach(pathKey=>{
              const tk=ev_id+'|'+dish_key+'|'+pathKey;
              const incomingTs=Number(kts[pathKey])||0;
              const knownTs=ktPathTsRef.current[tk]||0;
              if(incomingTs<=knownTs)return; // not strictly newer — stale or already-applied, skip
              ktPathTsRef.current[tk]=incomingTs;
              nextDish=ktApplyPathToDish(nextDish,pathKey,data);
              nextSyncedDish=ktApplyPathToDish(nextSyncedDish,pathKey,data);
            });
          }
          if(nextDish===prevDish) return p; // nothing actually applied — avoid a pointless re-render/sync-effect run
          const nextForEv={...(p[ev_id]||{}),[dish_key]:nextDish};
          ktSyncedRef.current={...ktSyncedRef.current,[ev_id]:{...prevSyncedEv,[dish_key]:nextSyncedDish}};
          return {...p,[ev_id]:nextForEv};
        });
      }
      // (ev_id, dish_key) is this table's actual primary key (no surrogate id
      // column), so a DELETE's payload.old reliably carries both — without
      // this, a row removed server-side (manual dashboard cleanup has
      // happened before, see KT_RESERVED_KEYS above) left every already-open
      // tablet showing that dish/step ticked forever, surviving even a reload
      // since the boot-time merge only ever adds/overwrites keys, never drops one.
      if(payload.eventType==='DELETE'&&payload.old){
        const {ev_id,dish_key}=payload.old;
        if(!ev_id||!dish_key)return;
        // Clear this dish's entries out of the per-path echo-ordering ref
        // too — otherwise a stale timestamp survives the row's deletion, and
        // if the same dish_key is ever reused (e.g. the row gets recreated),
        // a tablet whose clock legitimately runs behind the deleted row's
        // last timestamp would have its first genuine write rejected.
        const tkPrefix=ev_id+'|'+dish_key+'|';
        Object.keys(ktPathTsRef.current).forEach(tk=>{ if(tk.indexOf(tkPrefix)===0) delete ktPathTsRef.current[tk]; });
        setKitchenTracking(p=>{if(!p[ev_id]||!(dish_key in p[ev_id]))return p;const evState={...p[ev_id]};delete evState[dish_key];return {...p,[ev_id]:evState};});
      }
    });
    const u7 = dbSubscribe('transport_queue', (payload) => {
      const nq=payload.new?{id:payload.new.id,dish:payload.new.dish_name,evId:payload.new.ev_id||null,sec:payload.new.sec||null,station:payload.new.station||null,qty:payload.new.qty??null,unit:payload.new.unit||null,event:payload.new.event_guest,pax:payload.new.pax,venue:payload.new.venue,eventDate:payload.new.event_date,preparedBy:payload.new.prepared_by,markedAt:payload.new.marked_at,status:payload.new.status,pickedUpAt:payload.new.picked_up_at||undefined,fromVenue:payload.new.from_venue||"",vehicleId:payload.new.vehicle_id||""}:null;
      if(payload.eventType==='INSERT'&&nq) setTransportQueue_raw(p=>{if(p.some(i=>i.id===nq.id))return p;return[...p,nq];});
      if(payload.eventType==='UPDATE'&&nq) setTransportQueue_raw(p=>p.map(i=>i.id===nq.id?nq:i));
      if(payload.eventType==='DELETE') setTransportQueue_raw(p=>p.filter(i=>i.id!==payload.old.id));
    });
    // V74: menu_packages had no realtime — Packages/Sections tab only refreshed on local save.
    // Full re-fetch is cheap (small table) and reuses the existing hydrate + event-dispatch plumbing.
    const u8 = dbSubscribe('menu_packages', () => { refreshMenuPackages(); });
    // Same "full re-fetch is cheap, small table" approach as menu_packages above.
    const u9 = dbSubscribe('role_definitions', () => {
      supabase.from('role_definitions').select('*').then(({data,error}) => {
        if(error){ console.warn('[role_definitions] refresh failed:', error); return; }
        hydratePermissions(data||[]);
        setPermsTick(t=>t+1);
      });
    });
    const u10 = dbSubscribe('screen_definitions', () => {
      supabase.from('screen_definitions').select('*').then(({data,error}) => {
        if(error){ console.warn('[screen_definitions] refresh failed:', error); return; }
        hydrateScreenDefinitions(data||[]);
        setPermsTick(t=>t+1);
      });
    });
    return () => { u1(); u4(); u5(); u7(); u8(); u9(); u10(); };
  }, [appReady]);

  // ── Supabase connectivity indicator + offline queue replay ──
  // offlineQueueCount used to only update on this effect's own 2-minute
  // poll (or on reconnect) — nothing on screen ever showed a queued write at
  // all in between, so a tablet could go offline, have every tap correctly
  // queued, and the person using it could close the tab or hand it to
  // someone else believing it had all saved. The 'ambria-offq-change' event
  // (fired by offlineQueue.js the moment anything is queued or replayed)
  // updates this immediately instead of waiting on the next poll.
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [lostWriteCount, setLostWriteCount] = useState(0);
  useEffect(() => {
    if(!supabase){setSupaLive(false);return;}
    const checkQueue=()=>{ getQueueSize().then(n=>setOfflineQueueCount(n)).catch(()=>{}); setLostWriteCount(getLostWriteCount()); };
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
    const onQueueChange=()=>checkQueue();
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOffline);
    window.addEventListener('ambria-offq-change',onQueueChange);
    const interval=setInterval(()=>{if(navigator.onLine)ping();checkQueue();},120000);
    return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);window.removeEventListener('ambria-offq-change',onQueueChange);clearInterval(interval);};
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
    // The PIN itself never lives in this table anymore -- it's the password
    // on the linked auth.users row (see the auth+RLS migration). This
    // function only ever touches ordinary profile/role fields; PIN changes
    // go through admin-staff-auth (admin reset) or supabase.auth.updateUser
    // (self-service, see savePinReset) instead, never through here.
    //
    // auth_user_id is deliberately OMITTED from this record, same reasoning
    // as the old `pin` column's omission: every AccessManager/TeamHub call
    // site spreads a snapshot of the row (`{...s, ...}`), and that snapshot
    // can be stale or simply missing auth_user_id (a brand-new hire whose
    // link hasn't arrived via realtime yet on this device, a row replayed
    // from the offline queue, a permissions-only snapshot taken before the
    // link existed). Including it here would let any ordinary, unrelated
    // edit silently null out the link and lock that person out of login
    // entirely -- upsert only touches columns present in the record, so
    // omitting it leaves whatever's already there alone. Only the edge
    // functions (service role) ever write this column.
    const record = {
      staff_id: data.staffListId||data.staff_id, name: data.name||'',
      name_hi: data.name_hi||null,
      section: data.section||null, section_hi: data.section_hi||null,
      dept: data.dept||null, role: data.role||'staff',
      is_admin: data.role==='admin',
      is_active: data.is_active!==false, joining: data.joining||null,
      phone: data.phone||null, custom_screens: data.custom_screens||null,
      permissions: data.permissions||null,
      venue: data.venue||null,
      sop_categories: data.sop_categories||null,
    };
    // dbUpsert/dbDelete already console.error + throw on a non-retryable
    // failure (lib/db.js) — this function must keep passing that rejection
    // straight through, unaltered: App.jsx's own savePinReset awaits this
    // call inside its own try/catch to roll back an optimistic update on
    // failure, and swallowing the error here (as an earlier version of this
    // fix did) silently broke that rollback. The real gap — AccessManager.jsx
    // /TeamHub.jsx's fire-and-forget call sites with no .catch of their
    // own — is fixed at each of those call sites instead, not here.
    if(action==='upsert') await dbUpsert('staff', record, 'staff_id');
    if(action==='delete') await dbDelete('staff', 'staff_id', record.staff_id);
  }

  // Self-service PIN reset from the account menu — anyone can change their
  // own PIN here without going through Access Manager (admin-only screen).
  // The PIN is the password on this person's linked auth.users row now, not
  // a staff table column at all -- this is an ordinary Supabase Auth
  // self-service password change, not a custom RPC.
  async function savePinReset(){
    const cur = pinResetForm.current.trim();
    const next = pinResetForm.next.trim();
    const confirmPin = pinResetForm.confirm.trim();
    if(!supabase){ setPinResetForm(f=>({...f,error:"Can't reach server — check connection and try again."})); return; }
    const myId = currentUser.staffListId||currentUser.staff_id||currentUser.id;
    // "Confirm your current PIN" has no built-in GoTrue check (updateUser()
    // doesn't ask for the old password) -- re-authenticating with it IS the
    // check: wrong current PIN fails here with the same invalid_credentials
    // error a fresh login would get.
    const confirmResp = await supabase.auth.signInWithPassword({ email: staffAuthEmail(myId), password: staffAuthPassword(myId, cur) });
    if(confirmResp.error){
      const kind = classifyAuthError(confirmResp.error);
      setPinResetForm(f=>({...f,error: kind==='network' ? "Can't reach server — check connection and try again." : kind==='rate_limited' ? "Too many attempts — wait a minute and try again." : "Current PIN is incorrect."}));
      return;
    }
    // Exactly 4, matching the login input itself (LoginScreen.jsx caps entry
    // at 4 digits) -- allowing a longer PIN to be SET here while login could
    // never send more than 4 characters would silently lock that person out
    // on their very next login.
    if(!/^\d{4}$/.test(next)){ setPinResetForm(f=>({...f,error:"New PIN must be 4 digits."})); return; }
    if(next!==confirmPin){ setPinResetForm(f=>({...f,error:"New PINs don't match."})); return; }
    const { error: updErr } = await supabase.auth.updateUser({ password: staffAuthPassword(myId, next) });
    if(updErr){
      console.error('[savePinReset] updateUser failed:', updErr);
      setPinResetForm(f=>({...f,error:"Could not save your new PIN: "+(updErr.message||updErr)}));
      return;
    }
    // Matches the app's existing intent (documented since before this
    // rework): a PIN change must kick every OTHER already-open session for
    // this user, not just this device. Best-effort -- the PIN itself is
    // already changed and saved regardless of whether this succeeds.
    supabase.rpc('revoke_my_other_sessions').then(({error})=>{ if(error) console.error('[savePinReset] revoke_my_other_sessions failed:', error); });
    setShowPinReset(false);
    setPinResetForm({current:"",next:"",confirm:"",error:""});
  }

  function handleLogin(emp){
    setCurrentUser(emp);
    setForceLogoutMsg(null);
    try{ localStorage.setItem("ambria_session_user",JSON.stringify(emp)); }catch(e){}
    // Re-run the master load now that a real session exists -- see
    // dataReloadTick's own comment for why this is necessary once RLS
    // actually restricts anon (the boot-time load ran before this login
    // completed, as anon).
    setDataReloadTick(t => t + 1);
  }
  function handleLogout(){
    setCurrentUser(null); setActiveDept(null);
    // scope:'local' -- logging out THIS shared tablet must never revoke the
    // same person's session on a different device; a bare signOut() call
    // defaults to 'global' and would do exactly that.
    if(supabase) supabase.auth.signOut({ scope: 'local' }).catch(e=>console.error('[handleLogout] signOut failed:',e));
    try{
      localStorage.removeItem("ambria_session_user");
      // ambria_emp_id deliberately kept -- LoginScreen pre-fills the last-
      // used staff ID as a typing convenience; nothing PIN-related is ever
      // stored anymore (GoTrue's own session persistence is what keeps an
      // ORDINARY reload logged in, with no credential cached client-side at
      // all for that).
    }catch(e){}
  }

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

  const curNav = activeDept ? NAV_ITEMS : [];
  const curDeptMeta = DEPT_META[activeDept]||{name:"",icon:"",color:C.gold};

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
  // Topbar search = quick-nav over the screens this user can actually reach.
  const showStaffView = currentUser&&currentUser.role==="staff";

  // Nothing anywhere in the app ever showed that a write had been queued
  // offline — a tablet could go dark, have every tap correctly queued, and
  // whoever was using it would have no on-screen sign that it hadn't
  // actually reached the server yet. position:fixed so it drops into either
  // shell below without touching their flex/grid layouts (see MEMORY.md on
  // inline-style precedence traps in this app before changing how this is
  // placed).
  const offlineBannerNode = (supaLive===false || offlineQueueCount>0 || lostWriteCount>0) ? (
    <div style={{position:"fixed",bottom:14,left:"50%",transform:"translateX(-50%)",zIndex:9999,display:"flex",alignItems:"center",gap:8,
      padding:"7px 16px",borderRadius:999,fontSize:12,fontWeight:700,fontFamily:K.fontBody,boxShadow:"0 6px 18px rgba(0,0,0,.18)",
      background:lostWriteCount>0?"#FBEAEA":(supaLive===false?"#FBF2DD":"#FFFFFF"),
      color:lostWriteCount>0?"#C0392B":(supaLive===false?"#8A6416":K.textBody),
      border:`1px solid ${lostWriteCount>0?"#C0392B55":(supaLive===false?"#D4A84355":K.cardWarmLine)}`}}>
      <span>{lostWriteCount>0?"⚠":(supaLive===false?"📴":"⏳")}</span>
      <span>
        {lostWriteCount>0
          ? (lostWriteCount+" change(s) could not be saved anywhere on this device — please redo them")
          : (supaLive===false
            ? ("Offline"+(offlineQueueCount>0?(" — "+offlineQueueCount+" change(s) waiting to sync"):""))
            : (offlineQueueCount+" change(s) syncing…"))}
      </span>
      {lostWriteCount>0 && <button onClick={()=>{clearLostWriteCount();setLostWriteCount(0);}} style={{border:"none",background:"transparent",color:"#C0392B",fontWeight:700,cursor:"pointer",fontSize:12,textDecoration:"underline"}}>Dismiss</button>}
    </div>
  ) : null;

  // Public Function Plan hub — a no-login, link-shareable page (?fp=1) for
  // people with no app account. Checked BEFORE the loading screen/login gate
  // on purpose: this page fetches everything it needs itself via the
  // public-fp-view edge function (see PublicFPHub.jsx's own header), so it
  // has no reason to wait on -- or trigger -- the main app's authenticated
  // boot load (staff directory, full events list, kitchen tracking...) at
  // all, let alone need it to succeed.
  if(isPublicFP) return <PublicFPHub lang={lang}/>;
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
  if(!currentUser) return <LoginScreen empDb={empDb} onLogin={handleLogin} lang={lang} forceLogoutMsg={forceLogoutMsg}/>;  // Staff self-service
  if(showStaffView) return <StaffView user={currentUser} onLogout={handleLogout} lang={lang}/>;
  // ── SECTION TABLET INTERCEPT ──
  if(currentUser && currentUser.role && (currentUser.role === 'section_tablet' || currentUser.role.startsWith('section_'))) {
    // Same NAV_ITEMS + canAccessScreen every other login path uses, just
    // without dividers (this sidebar is a short flat list, not grouped
    // sections) — whatever's granted in Access Manager shows up here too,
    // not only whatever someone remembered to also type into a tablet-only list.
    const TABLET_NAV = NAV_ITEMS.filter(n=>!n.divider && canAccessScreen(currentUser, n.id));
    const _cats = Array.isArray(currentUser.sop_categories) ? currentUser.sop_categories : [];
    const _catObjs = _cats.map(function(c){ return (RECIPE_DB.cats||[]).find(function(x){ return x.id===c; }); }).filter(Boolean);
    const _firstCat = _catObjs[0]||null;
    const _catNames = _catObjs.length>0?_catObjs.map(function(c){ return c.name; }).join(' + '):'';
    // The per-category accent is gone: the tablet shell now uses the brand
    // plate like the admin app, so the chrome no longer changes colour with
    // whichever station happens to be assigned to the tablet.
    const _title = currentUser.name || _catNames || currentUser.section || 'Kitchen';
    // Every screen beyond Dashboard renders identically to the main app, so
    // it's the SAME renderScreen (defined below) doing the actual mapping —
    // one switch statement for every login path, not a second hand-kept copy
    // that quietly drifts out of sync with it (which is exactly how Menu
    // Packages went missing here even after it was granted). Dashboard is
    // the one exception: its "jump to screen" callback has to drive this
    // tablet's own tabletScreen state, not the admin shell's.
    function tabletContent(scr){
      if(scr==="dashboard") return <Dashboard events={events} setEvents={setEvents} setScreen={setTabletScreen} kitchenTracking={kitchenTracking} lang={lang} currentUser={currentUser} empDb={empDb}/>;
      return renderScreen(scr);
    }
    return (
      // Same shell language as the admin app: ivory ground, a floating sidebar
      // panel with a deep-green active pill and gold rail, and the brand plate
      // across the top. The tablet had its own older styling, so the two halves
      // of the same product looked like different apps.
      <div className="kh-scope" style={{position:"relative",display:"flex",height:"100vh",background:K.shellBg,overflow:"hidden"}}>
        {offlineBannerNode}
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
            <img src={`${import.meta.env.BASE_URL}leaf-bg.webp`} alt="" aria-hidden="true" draggable="false"
              onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
              style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top",
                opacity:.5,pointerEvents:"none",userSelect:"none",zIndex:0}}/>

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
            {/* minHeight:0 is what makes overflowY work here. Without it a flex
                child refuses to shrink below its content, so a long nav pushes
                past the panel instead of scrolling inside it — which is how
                items ended up hidden behind the footer plate. */}
            <nav className="kh-shellscroll" style={{position:"relative",zIndex:1,flex:1,minHeight:0,padding:"16px 8px 10px",overflowY:"auto"}}>
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
                    borderRadius:14,marginBottom:5,cursor:"pointer",textAlign:"left",minHeight:50,border:"none",
                    background:active?K.sbActiveBg:"transparent",
                    color:active?K.sbActiveText:K.sbText,
                    boxShadow:active?"0 6px 16px rgba(28,61,43,.26)":"none"}}>
                    {active&&<span style={{position:"absolute",left:0,top:8,bottom:8,width:4,borderRadius:"0 3px 3px 0",background:K.sbGoldSoft}}/>}
                    <span style={{width:36,height:36,borderRadius:11,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                      background:active?"rgba(255,255,255,.12)":K.sbChipBg,
                      border:`1px solid ${active?"rgba(255,255,255,.18)":K.sbChipLine}`,
                      color:active?K.sbActiveText:K.sbText}}>
                      <Icon name={NAV_ICON[item.id]||"layers"} size={19} strokeWidth={active?1.9:1.6}/>
                    </span>
                    <span style={{fontFamily:"var(--font-display)",fontSize:15.5,fontWeight:active?700:600,letterSpacing:-.1,
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{T2(item.label)}</span>
                  </button>
                );
              })}
            </nav>
            {/* Account — in the panel with the navigation rather than floating
                over the content in the top bar, the same place the admin shell
                keeps it. The menu is position:fixed and measured from the chip:
                the sidebar sets overflow:hidden, so an absolutely-placed one
                would be clipped by the panel it lives in. */}
            <div ref={userMenuRef} style={{position:"relative",zIndex:4,flexShrink:0,marginTop:"auto",padding:"10px 12px 12px",borderTop:`1px solid ${K.sbLine}`}}>
              <button ref={userChipRef} className="ash-userchip ash-btn kh-rip" onPointerDown={ripple} onClick={openUserMenu}
                style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 10px",borderRadius:12,background:K.sbChipBg,border:`1px solid ${K.sbChipLine}`,cursor:"pointer",textAlign:"left"}}>
                <Avatar name={currentUser?.name||"T"} size={30} index={0}/>
                <span style={{minWidth:0,flex:1}}>
                  <span style={{display:"block",fontSize:13.5,fontWeight:700,color:K.sbText,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentUser?.name}</span>
                  <span style={{display:"block",fontSize:11,color:K.sbLabel,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{_catObjs.length} {_catObjs.length===1?T2("station"):T2("stations")}</span>
                </span>
                <Icon name="chevronD" size={14} color={K.sbLabel} style={{flexShrink:0,transform:userMenuOpen?"rotate(180deg)":"none",transition:"transform .18s"}}/>
              </button>
              {userMenuOpen&&userMenuPos&&(
                <div style={{position:"fixed",...userMenuPos,zIndex:10002,background:K.surface,border:`1px solid ${K.line}`,borderRadius:14,boxShadow:K.shadowLift,overflow:"hidden",padding:4}}>
                  <div style={{padding:"10px 12px 8px",borderBottom:`1px solid ${K.lineSoft}`,marginBottom:4}}>
                    <div style={{fontSize:13,fontWeight:700,color:K.text,overflowWrap:"anywhere"}}>{currentUser?.name}</div>
                    <div style={{fontSize:11.5,color:K.textMuted,marginTop:2}}>{_catObjs.length} {_catObjs.length===1?T2("station"):T2("stations")}{currentUser?.venue?` · ${currentUser.venue}`:""}</div>
                  </div>
                  <button className="ash-menu-item kh-rip" onPointerDown={ripple} onClick={()=>{setLang(l=>l==="en"?"hi":"en");setUserMenuOpen(false);}}
                    style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                    <Icon name="globe" size={15}/>{lang==="en"?"हिंदी में बदलें":"Switch to English"}
                  </button>
                  <button className="ash-menu-item kh-rip" onPointerDown={ripple} onClick={()=>{setUserMenuOpen(false);setPinResetForm({current:"",next:"",confirm:"",error:""});setShowPinReset(true);}}
                    style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                    <Icon name="lock" size={15}/>{T2("Reset PIN")}
                  </button>
                  <button className="ash-menu-item is-danger kh-rip" onPointerDown={ripple} onClick={()=>{setUserMenuOpen(false);handleLogout();}}
                    style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                    <Icon name="logout" size={15}/>{T("Sign out",lang)}
                  </button>
                </div>
              )}
            </div>

            {showPinReset && createPortal(
              // Portalled to document.body: .ash-sidebar is position:fixed
              // with its own z-index (3 desktop / 50 mobile), which makes it
              // a stacking context of its own — a descendant's z-index, no
              // matter how high, only ever competes against other things
              // INSIDE that context. A screen's own full-page overlay (e.g.
              // StoreModule's Ingredient Map, z-index 9999) lives outside the
              // sidebar entirely, so it was stacking above the whole sidebar
              // subtree — Reset PIN included — regardless of this div's own
              // z-index:10050. Same fix as the FP print view / notification
              // bell / Used-In popovers elsewhere in this app.
              <div onClick={()=>setShowPinReset(false)} style={{position:"fixed",inset:0,zIndex:10050,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
                <div onClick={e=>e.stopPropagation()} style={{background:K.surface,borderRadius:16,padding:"22px 22px 20px",maxWidth:360,width:"100%",boxShadow:K.shadowLift,border:`1px solid ${K.line}`}}>
                  <div style={{fontSize:16,fontWeight:700,color:K.text,marginBottom:4}}>{T2("Reset PIN")}</div>
                  <div style={{fontSize:12,color:K.textMuted,marginBottom:16}}>{T2("Change the PIN you use to sign in.")}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                    <input type="password" inputMode="numeric" maxLength={4} placeholder={T2("Current PIN")} value={pinResetForm.current}
                      onChange={e=>setPinResetForm(f=>({...f,current:e.target.value.replace(/\D/g,""),error:""}))}
                      style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:14,letterSpacing:2,boxSizing:"border-box"}}/>
                    <input type="password" inputMode="numeric" maxLength={4} placeholder={T2("New PIN (4 digits)")} value={pinResetForm.next}
                      onChange={e=>setPinResetForm(f=>({...f,next:e.target.value.replace(/\D/g,""),error:""}))}
                      style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:14,letterSpacing:2,boxSizing:"border-box"}}/>
                    <input type="password" inputMode="numeric" maxLength={4} placeholder={T2("Confirm new PIN")} value={pinResetForm.confirm}
                      onChange={e=>setPinResetForm(f=>({...f,confirm:e.target.value.replace(/\D/g,""),error:""}))}
                      style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:14,letterSpacing:2,boxSizing:"border-box"}}/>
                  </div>
                  {pinResetForm.error&&<div style={{fontSize:12,color:"#C0392B",marginBottom:12}}>{pinResetForm.error}</div>}
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={savePinReset} style={{flex:1,padding:"11px",borderRadius:10,background:K.gold,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>{T2("Save")}</button>
                    <button onClick={()=>setShowPinReset(false)} style={{padding:"11px 18px",borderRadius:10,background:"transparent",border:`1px solid ${K.line}`,color:K.textMuted,fontSize:13,cursor:"pointer"}}>{T2("Cancel")}</button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* Footer plate — the wave, the artwork and the strapline are all
                baked into the image, same as the admin sidebar. */}
            <div style={{position:"relative",zIndex:1,flexShrink:0,lineHeight:0}}>
              <img src={`${import.meta.env.BASE_URL}sidebar-footer.webp`} alt="" aria-hidden="true" draggable="false"
                onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
                className="ash-sb-footer" style={{display:"block",width:"100%",
                  objectFit:"cover",objectPosition:"center bottom",
                  pointerEvents:"none",userSelect:"none"}}/>
            </div>
          </div>
        )}
        <div style={{position:"relative",zIndex:1,flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

          {/* Brand plate — static, outside the scroll container, exactly as in
              the admin shell so both look and behave the same. The mask that
              used to fade content under the top bar is gone with it: the plate
              is opaque, so it hides whatever scrolls beneath it. */}
          {/* Expand sits beside the plate, not inside it and not on a strip of
              its own above it — a row for one 38px button cost a whole band of
              a tablet screen. The plate takes the rest of the width. */}
          <div style={{position:"relative",zIndex:2,flexShrink:0,padding:"10px 32px 0",display:"flex",alignItems:"center",gap:12}}>
              {!tabletSidebarOpen&&(
                <button onClick={function(){setTabletSidebarOpen(true);}} onPointerDown={ripple}
                  className="ash-iconbtn kh-rip" title={T2("Expand")} aria-label={T2("Expand")}
                  style={{width:42,height:42,borderRadius:13,border:`1px solid ${K.line}`,background:K.surface,
                    boxShadow:K.shadowCard,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                    color:K.textMuted,flexShrink:0,padding:0}}>
                  <Icon name="panelLeft" size={18} strokeWidth={2}/>
                </button>
              )}
              <div style={{flex:1,minWidth:0,position:"relative",overflow:"hidden",background:K.hdrBg,border:`1px solid ${K.hdrLine}`,borderRadius:22,boxShadow:K.shadowCard,
                padding:"15px 24px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                <svg width="230" height="200" viewBox="0 0 230 200" aria-hidden="true"
                  style={{position:"absolute",top:-26,right:-18,pointerEvents:"none",opacity:.5}}>
                  <g fill="none" stroke="#D9C08A" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M188 6c-34 22-58 56-66 96-4 22-3 44 4 66"/>
                    <path d="M182 34c-22 2-40 14-50 32M186 62c-24 0-44 10-56 28M188 92c-24-2-45 6-58 24M186 122c-22-4-42 0-55 16"/>
                    <path d="M214 44c-20 26-30 58-28 92"/>
                    <path d="M212 70c-14 4-25 13-30 26M214 98c-15 1-27 8-33 20"/>
                  </g>
                </svg>

                <div style={{width:50,height:50,borderRadius:16,background:K.hdrBadge,color:K.hdrBadgeIcon,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                  <Icon name={NAV_ICON[tabletScreen]||"layers"} size={25} strokeWidth={1.6}/>
                </div>

                <div style={{flex:"1 1 320px",minWidth:0,position:"relative"}}>
                  {/* The tablet's own name is the heading, as it was before —
                      a device is identified by which tablet it is, not by which
                      screen happens to be open. The screen name moves to the
                      meta line beside the date. */}
                  <div style={{...type.pageTitle,fontSize:30,color:K.hdrTitle}}>{_title}</div>
                  <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px 14px",marginTop:6,fontSize:13,color:K.hdrMeta}}>
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
              <NotificationCenter currentUser={currentUser} T2={T2} />
              {/* Screen-level header actions. A screen that needs one control up
                 here - Kitchen Hub puts "Back to Recipes" in it - portals into
                 this slot, which keeps that screen's state where it lives instead
                 of lifting it into the shell. Empty and invisible otherwise. */}
              <div id="kh-hdr-slot" style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:"auto"}}/>
              </div>
          </div>

          {/* Only the screen scrolls. */}
          <div className="kh-shellscroll" style={{position:"relative",flex:1,minHeight:0,overflowY:"auto",padding:"18px 32px 32px",scrollBehavior:"smooth"}}>
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
        events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking}
        lang={lang} setLang={setLang} empDb={empDb} setEmpDb={setEmpDb}
        onSelectDept={(deptId)=>{if(deptId==="access"){setActiveDept("management");setScreen("access");}else{setActiveDept(deptId);setScreen("dashboard");}}}
        onLogout={handleLogout}
        currentUser={currentUser}
        allocRules={allocRules} setAllocRules={setAllocRules}
        checklistsCfg={dbChecklists}
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
      case "dashboard":      return <Dashboard events={events} setEvents={setEvents} setScreen={setScreen} kitchenTracking={kitchenTracking} lang={lang} currentUser={currentUser} empDb={empDb}/>;
      case "team":           return <TeamHub empDb={empDb} setEmpDb={setEmpDb} events={events} lang={lang} activeDept={activeDept} currentUser={currentUser} syncToServer={syncStaff}/>;
      case "kitchen":        return <KitchenHub events={events} setEvents={setEvents_raw} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} currentUser={currentUser} transportQueue={transportQueue} setTransportQueue={setTransportQueue}/>;
      case "function_plans": return <FunctionPlansHub events={events} lang={lang} currentUser={currentUser}/>;
      case "menus":          return <MenuPackagesView lang={lang} currentUser={currentUser} events={events} setEvents={setEvents}
                                       openFPEventId={pendingFpEventId} onOpenedFP={()=>setPendingFpEventId(null)}/>;
      case "transport":      return <TransportDispatch events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} currentUser={currentUser} transportQueue={transportQueue} setTransportQueue={setTransportQueue}/>;
      case "store":          return <StoreModule events={events} lang={lang} currentUser={currentUser}/>;
      case "access":         return <AccessManager lang={lang} empDb={empDb} setEmpDb={setEmpDb} currentUser={currentUser} syncToServer={syncStaff} checklistsCfg={dbChecklists} setChecklistsCfg={setDbChecklists}/>;
      case "logs":           return <ActivityLog lang={lang} currentUser={currentUser} empDb={empDb} kitchenTracking={kitchenTracking} events={events}/>;
      case "dept_service":   return <DeptView events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} empDb={empDb} setEmpDb={setEmpDb} forceDept="service" allocRules={allocRules} setAllocRules={setAllocRules} currentUser={currentUser} checklistsCfg={dbChecklists}/>;
      case "dept_crockery":  return <DeptView events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} empDb={empDb} setEmpDb={setEmpDb} forceDept="crockery"/>;
      case "dept_beverages": return <DeptView events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} empDb={empDb} setEmpDb={setEmpDb} forceDept="beverages"/>;
      case "dept_fruits":    return <DeptView events={events} kitchenTracking={kitchenTracking} setKitchenTracking={setKitchenTracking} lang={lang} empDb={empDb} setEmpDb={setEmpDb} forceDept="fruits"/>;
      case "dept_odc":       return <ODCModule events={events} lang={lang} currentUser={currentUser} checklistsCfg={dbChecklists}/>;
      case "proposals":         return <ProposalsView lang={lang} currentUser={currentUser} empDb={empDb}/>;
      case "sales_catalogue":   return <SalesCatalogueView lang={lang} currentUser={currentUser}/>;
      case "booked_functions":  return <BookedFunctionsView lang={lang} currentUser={currentUser}/>;
      default: return <div style={{padding:40,textAlign:"center",color:C.muted}}><div style={{fontSize:32,marginBottom:8}}>🔍</div><div style={{fontSize:14}}>Screen not found</div><button onClick={()=>setScreen("dashboard")} style={{marginTop:12,padding:"8px 20px",borderRadius:8,background:C.red,color:"#fff",border:"none",cursor:"pointer"}}>Go to Dashboard</button></div>;
    }
  }

  return (
    <div className="ash-shell" style={{display:"flex",height:"100vh",fontFamily:"var(--font-body)",background:K.shellBg,overflow:"hidden",flexDirection:"column",position:"relative"}}>
      {offlineBannerNode}

      {/* Page artwork spans the WHOLE window, not just the content column, so the
          floating sidebar sits on it. Behind the sidebar's rounded corners you
          then see the image rather than a flat gap.
          File: Fnbapp/public/page-bg.webp (a .png there works too). */}
      <img src={`${import.meta.env.BASE_URL}page-bg.webp`} alt="" aria-hidden="true" draggable="false"
        onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
        style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",
          opacity:K.pageBgOpacity,pointerEvents:"none",userSelect:"none",zIndex:0}}/>
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
      <>
      {/* Phone only (see .ash-sidebar-backdrop in theme.js) — the sidebar
          becomes a slide-in overlay below 768px, so tapping outside it
          should close it like any drawer. Invisible/inert on desktop. */}
      <div className="ash-sidebar-backdrop" onClick={()=>setSideOpen(false)}/>
      <div className="ash-sidebar" style={{width:K.sbWidth,margin:"10px 0 10px 10px",background:K.sbBg,border:`1px solid ${K.sbLine}`,borderRadius:22,boxShadow:K.sidebarShadow,zIndex:3,display:"flex",flexDirection:"column",flexShrink:0,position:"relative",overflow:"hidden"}}>

        {/* Decorative background art.
            Drop the artwork at Fnbapp/public/leaf-bg.webp — BASE_URL is used
            (not a bare "/") because vite.config.js sets base:'/Fnbapp/', so an
            absolute path would 404 on GitHub Pages. If the file is missing the
            image hides itself and the plain ivory panel shows through. */}
        {sideOpen&&(
          <img src={`${import.meta.env.BASE_URL}leaf-bg.webp`} alt="" aria-hidden="true" draggable="false"
            onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
            style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top",
              opacity:.5,pointerEvents:"none",userSelect:"none",zIndex:0}}/>
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
        <nav className="kh-shellscroll" style={{position:"relative",zIndex:1,flex:1,minHeight:0,padding:sideOpen?"4px 14px 10px":"4px 10px 10px",overflowY:"auto"}}>
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
              const badge=0;
              return(
                <button key={item.id} className={"ash-nav kh-rip"+(active?" is-active":"")} onPointerDown={ripple} onClick={()=>setScreen(item.id)}
                  title={!sideOpen?T(item.label,lang):undefined}
                  style={{
                    position:"relative",overflow:"hidden",
                    display:"flex",alignItems:"center",justifyContent:sideOpen?"space-between":"center",
                    width:"100%",padding:sideOpen?"8px 10px":"8px 0",borderRadius:14,marginBottom:4,
                    cursor:"pointer",textAlign:"left",minHeight:50,border:"none",
                    background:active?K.sbActiveBg:"transparent",
                    color:active?K.sbActiveText:K.sbText,
                    boxShadow:active?"0 6px 16px rgba(28,61,43,.26)":"none",
                  }}>
                  {/* Gold rail on the active row */}
                  {active&&<span style={{position:"absolute",left:0,top:8,bottom:8,width:4,borderRadius:"0 3px 3px 0",background:K.sbGoldSoft}}/>}
                  <span style={{display:"flex",alignItems:"center",gap:sideOpen?13:0,minWidth:0}}>
                    <span style={{width:36,height:36,borderRadius:11,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                      background:active?"rgba(255,255,255,.12)":K.sbChipBg,
                      border:`1px solid ${active?"rgba(255,255,255,.18)":K.sbChipLine}`,
                      color:active?K.sbActiveText:K.sbText}}>
                      <Icon name={NAV_ICON[item.id]||"layers"} size={19} strokeWidth={active?1.9:1.6}/>
                    </span>
                    {sideOpen&&<span style={{fontFamily:"var(--font-display)",fontSize:15.5,fontWeight:active?700:600,letterSpacing:-.1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{T(item.label,lang)}</span>}
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
              const badgeSum  = 0;
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

        {/* Account — moved out of the top bar and into the panel, where the
            person's identity sits with the navigation rather than floating over
            the content. The menu opens UPWARD because this sits at the bottom. */}
        <div ref={userMenuRef} style={{position:"relative",zIndex:4,flexShrink:0,marginTop:"auto",padding:"10px 12px 12px",borderTop:`1px solid ${K.sbLine}`,display:"flex",alignItems:"center",gap:8}}>
          <button ref={userChipRef} className="ash-userchip ash-btn kh-rip" onPointerDown={ripple} onClick={openUserMenu}
            style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0,padding:"8px 10px",borderRadius:12,background:K.sbChipBg,border:`1px solid ${K.sbChipLine}`,cursor:"pointer",textAlign:"left"}}>
            <Avatar name={currentUser?.name||"A"} size={30} index={0}/>
            <span style={{minWidth:0,flex:1}}>
              <span style={{display:"block",fontSize:13.5,fontWeight:700,color:K.sbText,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentUser?.name}</span>
              <span style={{display:"block",fontSize:11,color:K.sbLabel,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentUser?.role==="admin"?T2("Admin"):currentUser?.role}</span>
            </span>
            <Icon name="chevronD" size={14} color={K.sbLabel} style={{flexShrink:0,transform:userMenuOpen?"rotate(180deg)":"none",transition:"transform .18s"}}/>
          </button>
          {(SHOW_BELL||isKitchenRole(currentUser))&&<NotificationCenter currentUser={currentUser} T2={T2} onOpenEvent={openEventFP}/>}
          {userMenuOpen&&userMenuPos&&(
            <div style={{position:"fixed",...userMenuPos,zIndex:10002,background:K.surface,border:`1px solid ${K.line}`,borderRadius:14,boxShadow:K.shadowLift,overflow:"hidden",padding:4}}>
              <div style={{padding:"10px 12px 8px",borderBottom:`1px solid ${K.lineSoft}`,marginBottom:4}}>
                <div style={{fontSize:13,fontWeight:700,color:K.text,overflowWrap:"anywhere"}}>{currentUser?.name}</div>
                <div style={{fontSize:11.5,color:K.textMuted,marginTop:2}}>{currentUser?.id}</div>
              </div>
              <button className="ash-menu-item kh-rip" onPointerDown={ripple} onClick={()=>{setLang(l=>l==="en"?"hi":"en");setUserMenuOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                <Icon name="globe" size={15}/>{lang==="en"?"हिंदी में बदलें":"Switch to English"}
              </button>
              <button className="ash-menu-item kh-rip" onPointerDown={ripple} onClick={()=>{setUserMenuOpen(false);setPinResetForm({current:"",next:"",confirm:"",error:""});setShowPinReset(true);}}
                style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                <Icon name="lock" size={15}/>{T2("Reset PIN")}
              </button>
              <button className="ash-menu-item is-danger kh-rip" onPointerDown={ripple} onClick={()=>{setUserMenuOpen(false);handleLogout();}}
                style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",borderRadius:8,border:"none",background:"transparent",color:K.textBody,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                <Icon name="logout" size={15}/>{T("Sign out",lang)}
              </button>
            </div>
          )}
        </div>

        {showPinReset && createPortal(
          // Portalled for the same reason as the other Reset PIN modal above —
          // .ash-sidebar is its own stacking context, so a full-page overlay
          // from elsewhere (e.g. StoreModule's Ingredient Map) was rendering
          // above this entire sidebar subtree regardless of this div's own
          // z-index.
          <div onClick={()=>setShowPinReset(false)} style={{position:"fixed",inset:0,zIndex:10050,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div onClick={e=>e.stopPropagation()} style={{background:K.surface,borderRadius:16,padding:"22px 22px 20px",maxWidth:360,width:"100%",boxShadow:K.shadowLift,border:`1px solid ${K.line}`}}>
              <div style={{fontSize:16,fontWeight:700,color:K.text,marginBottom:4}}>{T2("Reset PIN")}</div>
              <div style={{fontSize:12,color:K.textMuted,marginBottom:16}}>{T2("Change the PIN you use to sign in.")}</div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                <input type="password" inputMode="numeric" maxLength={4} placeholder={T2("Current PIN")} value={pinResetForm.current}
                  onChange={e=>setPinResetForm(f=>({...f,current:e.target.value.replace(/\D/g,""),error:""}))}
                  style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:14,letterSpacing:2,boxSizing:"border-box"}}/>
                <input type="password" inputMode="numeric" maxLength={4} placeholder={T2("New PIN (4 digits)")} value={pinResetForm.next}
                  onChange={e=>setPinResetForm(f=>({...f,next:e.target.value.replace(/\D/g,""),error:""}))}
                  style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:14,letterSpacing:2,boxSizing:"border-box"}}/>
                <input type="password" inputMode="numeric" maxLength={4} placeholder={T2("Confirm new PIN")} value={pinResetForm.confirm}
                  onChange={e=>setPinResetForm(f=>({...f,confirm:e.target.value.replace(/\D/g,""),error:""}))}
                  style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${K.line}`,fontSize:14,letterSpacing:2,boxSizing:"border-box"}}/>
              </div>
              {pinResetForm.error&&<div style={{fontSize:12,color:"#C0392B",marginBottom:12}}>{pinResetForm.error}</div>}
              <div style={{display:"flex",gap:10}}>
                <button onClick={savePinReset} style={{flex:1,padding:"11px",borderRadius:10,background:K.gold,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>{T2("Save")}</button>
                <button onClick={()=>setShowPinReset(false)} style={{padding:"11px 18px",borderRadius:10,background:"transparent",border:`1px solid ${K.line}`,color:K.textMuted,fontSize:13,cursor:"pointer"}}>{T2("Cancel")}</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Footer artwork ──
            Drop it at Fnbapp/public/sidebar-footer.webp. The wave, the plate art
            and the "From our kitchen…" line are all baked into the image, so
            nothing is drawn here — the ivory top of the artwork blends into the
            panel. Missing file hides itself rather than showing a broken icon. */}
        {sideOpen&&(
          <div style={{position:"relative",zIndex:1,flexShrink:0,lineHeight:0}}>
            <img src={`${import.meta.env.BASE_URL}sidebar-footer.webp`} alt="" aria-hidden="true" draggable="false"
              onError={e=>{ const el=e.currentTarget; if(!el.dataset.pngFallback){ el.dataset.pngFallback="1"; el.src=el.src.replace(/\.webp$/,".png"); } else { el.style.display="none"; } }}
              className="ash-sb-footer" style={{display:"block",width:"100%",
                objectFit:"cover",objectPosition:"center bottom",
                pointerEvents:"none",userSelect:"none"}}/>
          </div>
        )}
      </div>
      </>
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
        {/* The notification bell used to float here as its own slim bar above the
            page header; moved into the sidebar footer next to the user chip
            (see the account block above) so it's not a lone floating icon. */}

        {/* ── PAGE HEADER — brand plate ──
            Outside the scroll container on purpose: it names the screen you are
            on and carries the live event details, which stay useful while you
            work down a long list. Top padding matches the sidebar's 10px margin
            so the plate and the sidebar panel start on the same line. */}
        {/* Expand sits beside the plate, not on a strip of its own above it —
            a whole row of the screen for one button, and only while the
            sidebar was shut. Same as the tablet shell. */}
        <div style={{position:"relative",zIndex:2,flexShrink:0,padding:"10px 32px 0",display:"flex",alignItems:"center",gap:12}}>
          {!sideOpen&&(
            <button className="ash-iconbtn kh-rip" onPointerDown={ripple} onClick={()=>setSideOpen(true)}
              title={T2("Expand")} aria-label={T2("Expand")}
              style={{width:42,height:42,borderRadius:13,background:K.surface,border:`1px solid ${K.line}`,
                boxShadow:K.shadowCard,color:K.textMuted,display:"flex",alignItems:"center",justifyContent:"center",
                cursor:"pointer",padding:0,flexShrink:0}}>
              <Icon name="panelLeft" size={18} strokeWidth={2}/>
            </button>
          )}
          {/* No plate on the Dashboard — its content already says what and when. */}
          {/* Kitchen Hub has no plate either, but its SOPs tab portals "Back to Recipes" /
              "All Categories" into #kh-hdr-slot, so the bare slot stays. */}
          {/* The Dashboard portals its title/totals/actions in here, so with the sidebar
              shut they sit on the Expand button's row instead of under it. */}
          {screen==="dashboard"&&<div id="dash-top-slot" style={{flex:1,minWidth:0}}/>}
          {screen==="kitchen"&&<div id="kh-hdr-slot" style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}/>}
          {/* Menu Packages has no plate either — its own "Menu" heading + tab
              strip sits right below and already names the screen, so the
              brand plate above it was pure repetition (same icon, "Menu
              Packages" vs "Menu", same date) costing a whole band of height
              on every one of its tabs, worst on a phone. Proposals, Booked
              Functions and Sales Catalogue each have their own filter/tab
              row immediately below that already names the screen, so the
              same plate was pure repetition there too. Store & Inventory's
              own header card (icon, "Store & Inventory", item count + last
              synced time, Inventory/Requirements/Order Lists/Ingredient Map
              tabs) right below made this one the same repetition again. */}
          {screen!=="dashboard"&&screen!=="kitchen"&&screen!=="menus"&&screen!=="proposals"&&screen!=="sales_catalogue"&&screen!=="booked_functions"&&screen!=="store"&&(
          <div style={{flex:1,minWidth:0,position:"relative",overflow:"hidden",background:K.hdrBg,border:`1px solid ${K.hdrLine}`,borderRadius:22,boxShadow:K.shadowCard,padding:"15px 24px",display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>

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
            <div style={{width:50,height:50,borderRadius:16,background:K.hdrBadge,color:K.hdrBadgeIcon,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 6px 18px rgba(28,61,43,.28)"}}>
              <Icon name={NAV_ICON[screen]||"layers"} size={25} strokeWidth={1.6}/>
            </div>

            {/* Eyebrow · title · meta */}
            <div style={{flex:"1 1 320px",minWidth:0,position:"relative"}}>
              <div style={{...type.pageTitle,fontSize:30,color:K.hdrTitle}}>{T(curNav.find(n=>n.id===screen)?.label||"Dashboard",lang)}</div>
              <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px 14px",marginTop:6,fontSize:13,color:K.hdrMeta}}>
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

            {/* Screen-level header actions. A screen that needs one control up
               here - Kitchen Hub puts "Back to Recipes" in it - portals into
               this slot, which keeps that screen's state where it lives instead
               of lifting it into the shell. Empty and invisible otherwise. */}
            <div id="kh-hdr-slot" style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:"auto"}}/>
          </div>
          )}
        </div>

        {/* Only the screen scrolls. minHeight:0 lets this flex child shrink so
            overflowY actually scrolls instead of pushing past the window.
            NO z-index here. It carried zIndex:1 from when the header scrolled
            with the content; now that the header is a fixed sibling above it,
            that z-index made this box a stacking context and every screen modal
            inside it (position:fixed, zIndex:9999) was capped at level 1 — so
            the scrim dimmed the screen but stopped short of the header plate and
            the tab bar, which kept painting on top of the dialog. */}
        <div className="kh-shellscroll" style={{position:"relative",flex:1,minHeight:0,overflowY:"auto",padding:"18px 32px 32px",scrollBehavior:"smooth"}}>
          <ErrorBoundary key={screen} lang={lang}><Suspense fallback={SCREEN_LOADING}>{renderScreen(screen)}</Suspense></ErrorBoundary>
        </div>
      </div>
      </div>
    </div>
  );
}


