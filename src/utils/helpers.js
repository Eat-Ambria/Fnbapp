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

// Cross-midnight-safe hours calculation: "20:00" → "02:30" = 6.5h
function calcHoursWorked(inTime, outTime) {
  if (!inTime || !outTime) return null;
  var pIn = inTime.split(':'), pOut = outTime.split(':');
  var inMin = (parseInt(pIn[0])||0)*60 + (parseInt(pIn[1])||0);
  var outMin = (parseInt(pOut[0])||0)*60 + (parseInt(pOut[1])||0);
  if (outMin < inMin) outMin += 1440; // crossed midnight
  var hrs = (outMin - inMin) / 60;
  return Math.round(hrs * 100) / 100; // 2 decimal places
}

function fmtHours(hrs) {
  if (hrs == null) return '—';
  var h = Math.floor(hrs), m = Math.round((hrs - h) * 60);
  return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
}

function classifyDay(inTime, outTime) {
  var hrs = calcHoursWorked(inTime, outTime);
  if (hrs == null) return {status:'Incomplete', hours:null};
  if (hrs >= 6) return {status:'Present', hours:hrs};
  if (hrs >= 4) return {status:'Half Day', hours:hrs};
  return {status:'Absent', hours:hrs};
}

function genPunchId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + '_' + Math.random().toString(36).slice(2);
}

function fmtStamp(ts) {
  var d = ts ? new Date(ts) : new Date();
  return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}) + ' ' +
         d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
}

export { localDateStr, TODAY, TODAY_LABEL, CUR_YEAR, relDate, TOMORROW, DAY_AFTER, LIVE_EVENTS_INIT, safeArr, safeObj, safeStr, safeNum, safePct, safeDivide, safeJSON, safeStorage, safeStorageSet, calcDispatch, normalizeAtt, calcHoursWorked, fmtHours, classifyDay, genPunchId, fmtStamp };
