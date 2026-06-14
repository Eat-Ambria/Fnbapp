// Ambria FnB — Utility functions & date helpers
// Extracted from App.jsx

function localDateStr(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${dd}`;}
const TODAY = localDateStr(new Date());
const TODAY_LABEL = new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const CUR_YEAR = new Date().getFullYear();
function relDate(daysFromToday){
  const d=new Date(); d.setDate(d.getDate()+daysFromToday);
  return localDateStr(d);
}
const TOMORROW = relDate(1);
const DAY_AFTER = relDate(2);

const LIVE_EVENTS_INIT = [];

function safeArr(v) { return Array.isArray(v) ? v : []; }
function safeObj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function safeStr(v) { return typeof v === "string" ? v : String(v || ""); }
function safeNum(v, fallback=0) { const n = Number(v); return isNaN(n) ? fallback : n; }
function safePct(num, den) { return den > 0 ? Math.round((num / den) * 100) : 0; }
function safeDivide(a, b, fallback=0) { return b !== 0 ? a / b : fallback; }
function safeJSON(str, fallback=null) { try { return JSON.parse(str); } catch(e) { return fallback; } }
function safeStorage(key, fallback=null) { return fallback; }
function safeStorageSet(key, val) { /* no-op in artifact */ }

function calcDispatch(time){
  if(!time) return "TBD";
  const parts=time.split(":");const h=parseInt(parts[0])||0;const m=parseInt(parts[1])||0;
  const dH=h-2;
  return `${String(dH<0?dH+24:dH).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function normalizeAtt(a) {
  var sid   = String(a.staff_id  || a.staffId  || '');
  var sname = a.staff_name || a.staffName || '';
  var inT   = a.in_time   || a.time      || '';
  var outT  = a.out_time  || a.punchOut  || '';
  var sec   = a.section   || a.staffSection || '';
  return {
    ...a,
    staff_id: sid,   staffId: sid,
    staff_name: sname, staffName: sname,
    in_time: inT,    time: inT,
    out_time: outT,  punchOut: outT,
    section: sec,    staffSection: sec,
    dept: a.dept || '',
    date: a.date || TODAY,
    status: a.status || 'Present',
  };
}

export { localDateStr, TODAY, TODAY_LABEL, CUR_YEAR, relDate, TOMORROW, DAY_AFTER, LIVE_EVENTS_INIT, safeArr, safeObj, safeStr, safeNum, safePct, safeDivide, safeJSON, safeStorage, safeStorageSet, calcDispatch, normalizeAtt };
