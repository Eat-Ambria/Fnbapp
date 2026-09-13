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

// ── Roman → Devanagari transliteration for Indian names ──
// Uses ITRANS scheme, best fit for common English spellings ("Gopal" → गोपाल).
let _sanscript = null;
(async function _loadSanscript(){
  try {
    const mod = await import('@indic-transliteration/sanscript');
    _sanscript = mod.default || mod;
  } catch(e) {
    console.warn('Sanscript load failed:', e);
  }
})();

// Recipe display name — returns Hindi if lang=hi and available, else English.
function recipeNameOf(r, lang){
  if (!r) return '';
  if (lang === 'hi' && r.n_hi) return r.n_hi;
  return r.n || '';
}

// V71 — auto-detect a menu package's diet from its name
// "Bliss Non-Veg" → 'nonveg', "Bliss Veg" → 'veg', "Deluxe Feast" → null
function detectPackageDiet(name){
  const s = (name || "").toLowerCase();
  if (/non[\s-]?veg/.test(s)) return 'nonveg';
  if (/\bveg\b/.test(s)) return 'veg';
  return null;
}

function transliterateName(txt){
  if (!txt || typeof txt !== 'string' || !_sanscript) return '';
  try {
    return txt.trim().split(/\s+/).map(function(w){
      return _sanscript.t(w.toLowerCase(), 'itrans', 'devanagari');
    }).join(' ');
  } catch(e) { return ''; }
}

// V72 — normalize a {q, u} quantity for display. Case-insensitive on units.
// Weight family (g/kg/kilo/gram/…): downgrades <1kg → g, upgrades ≥1000g → kg.
// Volume family (ml/l/ltr/litre/…): downgrades <1L → ml, upgrades ≥1000ml → L.
// Never renders "0 <unit>" for a positive value — floors to "<1 g" / "<1 ml".
function fmtQty(input, maybeU) {
  const raw = Number(input && typeof input === 'object' ? input.q : input);
  const unitIn = String((input && typeof input === 'object' ? input.u : maybeU) || '').toLowerCase().trim();
  if (!isFinite(raw)) return "";
  const isG   = /^(g|gm|gms|gram|grams)$/.test(unitIn);
  const isKg  = /^(kg|kgs|kilo|kilos|kilogram|kilograms)$/.test(unitIn);
  const isMl  = /^(ml|mls|millilitre|milliliter|millilitres|milliliters)$/.test(unitIn);
  const isL   = /^(l|lt|ltr|litre|liter|litres|liters)$/.test(unitIn);
  const isPcs = /^(pcs|pc|nos|no|piece|pieces|count)$/.test(unitIn);
  if (isG || isKg) {
    const grams = isKg ? raw * 1000 : raw;
    if (grams === 0) return "0 g";
    if (grams < 0) return Math.round(grams) + " g";
    if (grams >= 1000) { const kg = grams / 1000; return (kg >= 10 ? Math.round(kg) : kg.toFixed(1).replace(/\.0$/, "")) + " kg"; }
    if (grams < 1) return "<1 g";
    return Math.round(grams) + " g";
  }
  if (isMl || isL) {
    const ml = isL ? raw * 1000 : raw;
    if (ml === 0) return "0 ml";
    if (ml < 0) return Math.round(ml) + " ml";
    if (ml >= 1000) { const L = ml / 1000; return (L >= 10 ? Math.round(L) : L.toFixed(1).replace(/\.0$/, "")) + " L"; }
    if (ml < 1) return "<1 ml";
    return Math.round(ml) + " ml";
  }
  if (isPcs) return Math.ceil(raw) + " pcs";
  return Math.round(raw) + " " + unitIn;
}

// V74 — Heuristic ingredient → category classifier for the Collect from store view.
// First-hit-wins: order matters. If nothing matches, returns 'Other'.
// Categories chosen to roughly map to store walking order.
const INGR_CAT_RULES = [
  { cat: 'Meat & seafood',        re: /\b(chicken|mutton|lamb|goat|fish|prawn|shrimp|crab|beef|pork|ham|bacon|sausage|kheema|keema|mince)\b/ },
  { cat: 'Dairy & eggs',          re: /\b(paneer|cream|butter|ghee|curd|dahi|yogurt|yoghurt|cheese|khoya|mawa|malai|egg|eggs|milk)\b/ },
  { cat: 'Grains & flour',        re: /\b(rice|basmati|atta|maida|flour|cornflour|semolina|suji|sooji|noodle|noodles|pasta|bread|pav|bun|papad|poha|oats|barley|wheat|besan|rava)\b/ },
  { cat: 'Spices & seasonings',   re: /\b(salt|pepper|chilli|chili|masala|turmeric|haldi|cumin|jeera|dhania|garam|kasuri|methi|hing|asafoetida|cardamom|elaichi|cinnamon|dalchini|clove|laung|nutmeg|jaifal|mace|bay leaf|tej patta|saffron|kesar|fennel|saunf|kalonji|ajwain|paprika|oregano|thyme|rosemary|dill|sesame|til|poppy|aromat|aromatic|seasoning|spice)\b/ },
  { cat: 'Oils, sauces & sweets', re: /\b(oil|sauce|soy|vinegar|ketchup|mayonnaise|dressing|syrup|honey|jaggery|gur|sugar|jam|marmalade|mustard|paste|chutney)\b/ },
  { cat: 'Vegetables & herbs',    re: /\b(onion|garlic|ginger|tomato|potato|carrot|cabbage|cauliflower|beetroot|beet|radish|mooli|capsicum|corn|beans|peas|matar|palak|spinach|okra|bhindi|lettuce|celery|coriander|dhaniya|mint|pudina|lemon|lime|cucumber|kheera|pumpkin|kaddu|brinjal|baingan|drumstick|leek|shallot|scallion|leaf|leaves|mushroom|kale|broccoli|asparagus|zucchini|banana|apple|fruit|vegetable|veg|avacado|avocado|basil|dill)\b/ },
  { cat: 'Liquids & stocks',      re: /\b(water|stock|broth|wine|beer|juice|soda|coconut milk)\b/ },
];
function categorizeIngredient(name) {
  const s = (name || '').toLowerCase();
  for (var i = 0; i < INGR_CAT_RULES.length; i++) if (INGR_CAT_RULES[i].re.test(s)) return INGR_CAT_RULES[i].cat;
  return 'Other';
}
// Display order (matches typical store walking order: produce → cold → dry → spices → liquid)
const INGR_CATEGORY_ORDER = ['Vegetables & herbs', 'Dairy & eggs', 'Meat & seafood', 'Grains & flour', 'Spices & seasonings', 'Oils, sauces & sweets', 'Liquids & stocks', 'Other'];

// ── Dish-tracking merge ────────────────────────────────────────────────────
// Step state lives in nested maps keyed by step: manual, manualAt, starts,
// doneElapsed, stepTm. Every "Done" handler builds its update by spreading the
// copy of that map it captured at render time:
//
//     setDs(..., { manual: { ...d2d.manual, [stepKey]: true } })
//
// A plain shallow merge then REPLACES the live map with that snapshot. Tap two
// steps in quick succession — or tap one while a Supabase sync re-render is in
// flight — and the second handler is still holding the pre-first-tap snapshot,
// so the first tap is erased. That is the "I press Done and it undoes itself"
// bug: nothing undid it, the write was overwritten by a stale copy.
//
// Merging these maps one level deep makes a stale snapshot harmless: the keys
// it does not know about survive, and the key it does carry still wins (so an
// explicit false from Undo still applies).
// items_done belongs here too: the collect-from-store list is the same shape
// (a map keyed by item) written the same way, and it had the same bug — tick an
// ingredient, and a slightly older snapshot from the next write or from a
// realtime echo put the tick straight back.
const DISH_STEP_MAPS = ['manual', 'manualAt', 'starts', 'doneElapsed', 'stepTm', 'items_done'];

function mergeDishState(prev, upd) {
  // Not every tracked value is a dish-state object. The same store also holds
  // booleans and strings (__dispatch_ready, __dispatch_time); spreading those
  // silently turns them into {}, so hand them straight back instead.
  const isPlain = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!isPlain(upd)) return upd;
  const base = isPlain(prev) ? prev : {};
  const next = { ...base, ...upd };
  for (var i = 0; i < DISH_STEP_MAPS.length; i++) {
    var k = DISH_STEP_MAPS[i];
    var incoming = upd ? upd[k] : undefined;
    if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
      var existing = base[k] && typeof base[k] === 'object' ? base[k] : {};
      next[k] = { ...existing, ...incoming };
    }
  }
  return next;
}

// Identifies one row of a collect-from-store list inside `items_done`.
// Keyed by (name, unit family) rather than by index or by the display unit, so a
// kg<->gm flip caused by rescaling does not orphan an already-collected tick.
// Shared because Event Day and Prep Day both write the same map — if the two
// ever key it differently, ticks made on one screen vanish on the other.
function storeItemKey(i) {
  return ((i && i.n) || "").toLowerCase().trim() + "|" + ((i && (i.fam || i.u)) || "");
}

// Every row of a collect list marked collected, as one delta for mergeDishState.
// Used by the "Done" button: finishing the collection run means everything in it
// was collected, so the list and the progress bar must say so.
function markAllCollected(items) {
  const delta = {};
  (items || []).forEach(function (it) { delta[storeItemKey(it)] = true; });
  return delta;
}

export { localDateStr, TODAY, TODAY_LABEL, CUR_YEAR, relDate, TOMORROW, DAY_AFTER, LIVE_EVENTS_INIT, safeArr, safeObj, safeStr, safeNum, safePct, safeDivide, safeJSON, safeStorage, safeStorageSet, calcDispatch, normalizeAtt, calcHoursWorked, fmtHours, classifyDay, genPunchId, fmtStamp, compressImage, uploadStaffPhoto, transliterateName, recipeNameOf, detectPackageDiet, fmtQty, categorizeIngredient, INGR_CATEGORY_ORDER, mergeDishState, storeItemKey, markAllCollected };
