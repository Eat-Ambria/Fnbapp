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

// Convert "08:46:09 am" / "05:58 PM" / "17:30" → minutes since 00:00
function _toMins(t) {
  if (!t) return null;
  var s = String(t).trim();
  var ampm = null;
  var m = s.match(/\b(am|pm|AM|PM)\b/);
  if (m) { ampm = m[1].toLowerCase(); s = s.replace(m[0],'').trim(); }
  var p = s.split(':');
  var h = parseInt(p[0],10); var mn = parseInt(p[1],10)||0;
  if (isNaN(h)) return null;
  if (ampm) {
    if (h === 12) h = 0;          // 12 am = 0, 12 pm = 12
    if (ampm === 'pm') h += 12;
  }
  return h*60 + mn;
}

// Cross-midnight-safe hours calculation: "20:00" → "02:30" = 6.5h
// Handles both 12h ("08:46 am") and 24h ("20:00") formats.
function calcHoursWorked(inTime, outTime) {
  var inMin = _toMins(inTime), outMin = _toMins(outTime);
  if (inMin==null || outMin==null) return null;
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

// Client-side JPEG compression via canvas. maxDim caps largest side; quality 0-1.
function compressImage(file, maxDim, quality) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        var ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(function(blob) { resolve(blob); }, 'image/jpeg', quality);
    };
    img.onerror = function() { resolve(null); };
    img.src = URL.createObjectURL(file);
  });
}

// Upload staff profile photo to Supabase Storage. Returns public URL or null on error.
async function uploadStaffPhoto(supabase, staffId, file) {
  if (!supabase || !file || !staffId) return null;
  try {
    var blob = await compressImage(file, 400, 0.8);
    if (!blob) return null;
    var path = String(staffId) + '.jpg';
    var { error: upErr } = await supabase.storage
      .from('staff-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (upErr) { console.error('staff photo upload:', upErr); return null; }
    var { data } = supabase.storage.from('staff-photos').getPublicUrl(path);
    return data && data.publicUrl ? data.publicUrl + '?v=' + Date.now() : null;
  } catch (e) {
    console.error('staff photo upload:', e);
    return null;
  }
}

export { localDateStr, TODAY, TODAY_LABEL, CUR_YEAR, relDate, TOMORROW, DAY_AFTER, LIVE_EVENTS_INIT, safeArr, safeObj, safeStr, safeNum, safePct, safeDivide, safeJSON, safeStorage, safeStorageSet, calcDispatch, normalizeAtt, calcHoursWorked, fmtHours, classifyDay, genPunchId, fmtStamp, compressImage, uploadStaffPhoto };
