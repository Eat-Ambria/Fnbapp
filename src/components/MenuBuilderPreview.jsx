// Ambria FnB — Menu Builder Preview (Sales)
// V70 Phase 6: client-facing menu card + Print/Save-as-PDF via window.print().
// V89: rebuilt to match the printed Ambria menu (the 28-page "Luxury" PDF) —
//      A4 pages, a photo/cream split per section, Nova Quinta for the section
//      titles. Only the presentation changed; the grouping logic below is
//      untouched from V73.
// Place in: src/components/MenuBuilderPreview.jsx

import { useState, useMemo, useEffect } from "react";
import { T } from '../data/translations.js';
import { getCatIdForDish, RECIPE_DB, getAllDishes } from '../data/recipeData.js';
import { SALES_DEPTS, ITEM_HAVING_DEPTS, DEFAULT_DEPT } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import { K } from '../utils/theme.js';
import { Icon } from './KitchenUI.jsx';

// ── Palette ───────────────────────────────────────────────────────────────
// Sampled from the printed menu rather than matched by eye: the cream is the
// dominant colour of the text panel on pages 3/5/7, and the two browns are the
// darkest pixels inside a dish name and a dish description.
const M = {
  cream:    "#F1EDE2",
  ink:      "#000000",   // section title, and the all-caps diet line under it
  dish:     "#3B1110",   // dish name
  dishDesc: "#3C1211",   // description — same hue, carried lighter by weight
  gold:     "#E0A82E",   // the dot on the i in the wordmark
  dark:     "#1A1008",   // cover fallback when no photograph is supplied
};

const BASE = import.meta.env.BASE_URL;

// Optional artwork. Every one of these is allowed to be missing — the page
// falls back to a tinted panel rather than a broken image, so the preview is
// usable before the photography lands.
const ART = {
  back:      BASE + "menu/back.webp",
  qr:        BASE + "menu/qr.png",
  logoLight: BASE + "menu/ambria-logo-white.webp",
  logoDark:  BASE + "ambria-logo.webp",
};

// Section name → section photograph. The catalogue's sections are created by
// the sales team and change per package, so they cannot be enumerated here;
// matching on what the section is called is what lets a new one still get a
// picture. An unmatched section falls through to the tinted panel.
//
// The names on the left are the ones the printed menu actually uses — they were
// read out of the PDF's own text layer, not invented — with the generic words a
// sales user is likely to type kept alongside them. Order matters: the first
// match wins, so the specific names sit above the generic ones.
const SECTION_ART = [
  [/chatoori|chaat|golgapp|tikki/,                      "chaat"],
  [/snack\s*soiree|tandoor|kebab|seekh|grill|snack/,    "tandoor"],
  [/epicurean|chinese|asian|wok|noodle|momo|sushi/,     "asian"],
  [/mocktail/,                                          "mocktails"],
  [/pour\s*atelier|infusion\s*lounge|tea|coffee/,       "atelier"],
  [/shake|beverage|juice|drink/,                        "beverages"],
  [/international\s*main/,                              "international"],
  // Above maincourse on purpose: "bread" appears in both, and a section called
  // Accompaniments should take its own picture rather than the mains one.
  [/accompaniment|bread|roti|naan|raita|chutney|papad|pickle/, "accompaniments"],
  [/signature\s*main|main|curry|dal|paneer|biryani|rice|bread/, "maincourse"],
  [/botanical|salad|souperie|soup|starter/,             "salads"],
  [/dessert|sweet|mithai|halwa|ice/,                    "desserts"],
  [/assembly|thera|live|counter|station/,               "live"],
];
// The cover follows the guest's diet, which is the difference a guest actually
// notices; the tier is already set in full across the cover in the script face.
function coverPhoto(diet) {
  return BASE + "menu/" + (diet === 'veg' ? "cover-veg" : "cover-nonveg") + ".webp";
}
function sectionPhoto(name) {
  const hay = String(name || "").toLowerCase();
  for (const [re, slug] of SECTION_ART) if (re.test(hay)) return BASE + "menu/" + slug + ".webp";
  return null;
}

// ── Ornament ──────────────────────────────────────────────────────────────
// Drawn rather than typed, so every piece scales with the sheet and prints at
// whatever resolution the printer has, instead of blurring like a bitmap.
const GOLD = "%23B08A3E";   // the gold, url-encoded for use inside a data URI

// One corner, placed four times by rotating it inside its own SVG: CSS cannot
// rotate a background image, and four separately drawn corners would drift
// apart the first time one of them was adjusted.
const CORNER_PATH = "M3 33 C3 16 16 3 33 3 M3 21 C3 11 11 3 21 3 M3 33 L3 26 M33 3 L26 3";
const corner = (deg) =>
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'>" +
  "<g transform='rotate(" + deg + " 18 18)' fill='none' stroke='" + GOLD + "' stroke-width='1.9' stroke-linecap='round'>" +
  "<path d='" + CORNER_PATH + "'/><circle cx='11' cy='11' r='2.6' fill='" + GOLD + "' stroke='none'/></g></svg>\")";

// A symmetric scroll on a rule — the divider that sits under every heading.
const FILIGREE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='16' viewBox='0 0 260 16'>" +
  "<g stroke='" + GOLD + "' fill='none' stroke-width='1.9' stroke-linecap='round'>" +
  "<path d='M6 8 H102'/><path d='M158 8 H254'/>" +
  "<path d='M102 8 C 110 8, 114 3, 122 3 C 129 3, 131 8, 124 8'/>" +
  "<path d='M158 8 C 150 8, 146 13, 138 13 C 131 13, 129 8, 136 8'/>" +
  "<circle cx='130' cy='8' r='3' fill='" + GOLD + "' stroke='none'/>" +
  "</g></svg>\")";

// A medallion for the foot of the panel: a botanical sprig inside a broken
// ring. This is what fills a section that has only two dishes on it.
const MEDALLION =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>" +
  "<g fill='none' stroke='%233C1211' stroke-width='2.4' stroke-linecap='round'>" +
  "<path d='M80 12 A68 68 0 0 1 148 80 A68 68 0 0 1 80 148 A68 68 0 0 1 12 80 A68 68 0 0 1 80 12' stroke-dasharray='60 14'/>" +
  "<path d='M80 128 V54'/>" +
  "<path d='M80 108 C 62 104, 50 92, 45 77 C 62 79, 74 91, 80 108z'/>" +
  "<path d='M80 108 C 98 104, 110 92, 115 77 C 98 79, 86 91, 80 108z'/>" +
  "<path d='M80 82 C 66 78, 57 68, 53 56 C 67 59, 76 69, 80 82z'/>" +
  "<path d='M80 82 C 94 78, 103 68, 107 56 C 93 59, 84 69, 80 82z'/>" +
  "<circle cx='80' cy='44' r='5.5'/></g></svg>\")";

// A trace of paper grain. Without it the cream is a flat digital fill; with it
// the panel reads as stock. Kept below 4% so it never becomes visible texture.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
  "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter>" +
  "<rect width='160' height='160' filter='url(%23g)' opacity='0.35'/></svg>\")";
// Nova Quinta is a personal-use licence (public/fonts/NovaQuinta-LICENCE.txt);
// a client menu is commercial use, so a licence has to be bought before this
// ships to guests. The stack falls back to the display serif if it is pulled.
const MENU_CSS = `
/* Josefin Sans comes from the app-wide Google Fonts import in styles.js. It is
   not imported here: an @import is only valid at the very top of a stylesheet,
   and this sheet opens with the @font-face below, so one placed here would be
   dropped without an error. */
:root { --font-menu: 'Josefin Sans', var(--font-body), sans-serif; }
@font-face {
  font-family: 'NovaQuinta';
  src: url('${BASE}fonts/NovaQuinta.otf') format('opentype');
  font-weight: 400; font-style: normal; font-display: swap;
}
.amb-page {
  position: relative; width: 100%; aspect-ratio: 1 / 1.4142;
  display: flex; overflow: hidden;
  background-color: ${M.cream};
  background-image: ${GRAIN};
  background-size: 160px 160px;
}
.amb-photo { flex: 0 0 50%; background-size: cover; background-position: center; position: relative; }
/* No photograph yet: a warm panel that says so, rather than a broken image or
   a white hole that reads as a bug. */
.amb-photo.is-empty {
  background: linear-gradient(160deg, #2A1B10 0%, #140C06 100%);
  display: flex; align-items: center; justify-content: center; text-align: center;
}
.amb-panel {
  flex: 1 1 50%; min-width: 0; padding: 5% 6% 4%;
  display: flex; flex-direction: column; position: relative;
}
/* A hairline frame and a sprig at the foot. On a section with twenty dishes
   neither is noticed; on one with two, they are the difference between a
   designed page and a blank one. Both are decoration, so they stay behind the
   text and out of the accessibility tree. */
.amb-panel::before {
  content: ""; position: absolute; inset: 3.4%; pointer-events: none; z-index: 0;
  border: 1.2px solid rgba(60,18,17,.26);
  background-image: ${corner(0)}, ${corner(90)}, ${corner(180)}, ${corner(270)};
  background-repeat: no-repeat;
  background-position: left 6px top 6px, right 6px top 6px, right 6px bottom 6px, left 6px bottom 6px;
  background-size: clamp(26px, 5.8cqw, 54px);
}
/* The medallion only appears on a section short enough to leave room for it.
   On a full page the list runs down to the foot, and the medallion ended up
   sitting behind the last dish's description — decoration competing with the
   thing it is meant to frame. */
.amb-panel.is-sparse::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 9%; height: 17%;
  pointer-events: none; z-index: 0; opacity: .24;
  background: ${MEDALLION} no-repeat center bottom;
  background-size: auto 100%;
}
.amb-panel > * { position: relative; z-index: 1; }
.amb-title {
  font-family: 'NovaQuinta', var(--font-display), Georgia, serif;
  color: ${M.ink}; text-align: center; line-height: 1.05;
  font-size: clamp(26px, 6.2cqw, 58px); margin: 0 0 2% 0;
}
.amb-sub {
  text-align: center; color: ${M.ink}; letter-spacing: .14em;
  font-size: clamp(9px, 1.9cqw, 17px); margin: 0 0 4% 0;
  font-family: var(--font-menu); font-weight: 400;
}
/* The rule under the heading. A line with a lozenge on it, drawn rather than
   typed, so it scales with the sheet like everything else here. */
.amb-rule {
  display: block; margin: 0 auto 5%; width: 62%; height: clamp(9px, 2.1cqw, 19px);
  background: ${FILIGREE} no-repeat center;
  background-size: 100% 100%;
}
.amb-list { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 3.2%; }
/* A short list is not centred. Centring two dishes on a full page splits the
   emptiness into a gap above and a gap below, and the page reads as unfinished;
   sitting them under the heading puts all the space in one block at the foot,
   where the sprig is, and that reads as margin. */
.amb-list.is-sparse { justify-content: flex-start; padding-top: 6%; gap: 5%; }
.amb-dish { text-align: center; }
.amb-dish-name {
  font-family: var(--font-menu); color: ${M.dish};
  font-size: clamp(12px, 2.7cqw, 25px); line-height: 1.2; font-weight: 400;
}
.amb-dish-desc {
  font-family: var(--font-menu); font-weight: 300; color: ${M.dishDesc}; opacity: .85;
  font-size: clamp(9px, 1.8cqw, 16px); line-height: 1.35; margin: .3em auto 0;
  max-width: 82%;
}
.amb-foot { display: flex; justify-content: flex-end; padding-top: 3%; }
.amb-foot img { height: clamp(14px, 3cqw, 30px); width: auto; }

/* Cover + back cover */
.amb-cover {
  position: relative; width: 100%; aspect-ratio: 1 / 1.4142; overflow: hidden;
  background-size: cover; background-position: center; background-color: ${M.dark};
  display: flex; flex-direction: column; align-items: center;
  padding: 7% 8%; text-align: center; color: #FFFFFF;
}
.amb-cover::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.18) 38%, rgba(0,0,0,.62) 100%);
}
.amb-cover > * { position: relative; z-index: 1; }
.amb-cover-mark { height: clamp(26px, 6cqw, 58px); width: auto; }
.amb-cover-tag {
  font-family: var(--font-display), Georgia, serif; letter-spacing: .06em;
  font-size: clamp(10px, 2.2cqw, 21px); margin-top: 3%;
}
.amb-cover-title {
  font-family: 'NovaQuinta', var(--font-display), Georgia, serif;
  font-size: clamp(40px, 11cqw, 104px); line-height: .95; margin: auto 0 0;
}
.amb-cover-kind {
  letter-spacing: .34em; font-size: clamp(8px, 1.8cqw, 16px);
  font-family: var(--font-menu); font-weight: 400; margin-top: 1%;
}
.amb-cover-foot { margin-top: auto; font-size: clamp(8px, 1.6cqw, 14px); line-height: 1.7;
  font-family: var(--font-menu); font-weight: 300; letter-spacing: .04em; }
.amb-cover-foot img { width: clamp(46px, 11cqw, 104px); height: auto; margin-bottom: 3%; }

@media print {
  @page { margin: 0; size: A4 portrait; }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body * { visibility: hidden; }
  .ambria-print-card, .ambria-print-card * { visibility: visible; }
  .ambria-print-card { position: absolute !important; inset: 0 auto auto 0;
    width: 100% !important; max-width: none !important; margin: 0 !important;
    padding: 0 !important; box-shadow: none !important; background: #fff !important; }
  .ambria-print-hide { display: none !important; }
  /* One sheet per page, and never split a section across two. */
  .amb-sheet { width: 100%; margin: 0 !important; box-shadow: none !important;
    break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid; }
  .amb-sheet:last-child { break-after: auto; page-break-after: auto; }
}
`;

export function MenuBuilderPreview({ proposal, dishItems, salesMeta, templateInfo, onClose, lang = "en", currentUser = null }) {
  var T2 = function(s){ return T(s, lang); };
  var [markingSent, setMarkingSent] = useState(false);
  var [sentJust, setSentJust]       = useState(false);
  var currentStatus = proposal.status || 'draft';

  // ── Group items by (dept, category) ──
  var byDeptByCat = useMemo(function(){
    var deptMap = {};
    (dishItems || []).forEach(function(item){
      var meta = salesMeta[item.dish_name];
      var dept = (meta && meta.sales_dept) || DEFAULT_DEPT;
      var catId  = getCatIdForDish(item.dish_name) || 'other';
      var catObj = (RECIPE_DB.cats || []).find(function(c){ return c.id === catId; });
      if (!deptMap[dept]) deptMap[dept] = {};
      if (!deptMap[dept][catId]) {
        deptMap[dept][catId] = {
          id: catId,
          name: catObj ? catObj.name : 'Other',
          icon: catObj ? (catObj.icon || '') : '',
          items: [],
        };
      }
      deptMap[dept][catId].items.push(item);
    });

    // Sort each dept's categories using RECIPE_DB order
    var order = (RECIPE_DB.cats || []).map(function(c){ return c.id; });
    var deptsWithSortedCats = {};
    Object.keys(deptMap).forEach(function(deptId){
      var cats = deptMap[deptId];
      var sorted = order.filter(function(id){ return !!cats[id]; }).map(function(id){ return cats[id]; });
      Object.keys(cats).forEach(function(id){ if (order.indexOf(id) < 0) sorted.push(cats[id]); });
      // Sort items alphabetically within each category for a clean read
      sorted.forEach(function(cat){ cat.items.sort(function(a,b){ return a.dish_name.localeCompare(b.dish_name); }); });
      deptsWithSortedCats[deptId] = sorted;
    });
    return deptsWithSortedCats;
  }, [dishItems, salesMeta]);

  // ── V72/V73: dish_catalogue_sections (all depts) ──
  // Each section may carry a sales_dept override that routes it to a specific
  // sidebar tab. Null override defaults to 'kit'.
  var [sections, setSections] = useState([]);
  useEffect(function(){
    var cancelled = false;
    (async function(){
      try {
        var rows = await fetchAllRows(function(){
          return supabase.from('dish_catalogue_sections')
            .select('id, name, sort_order, sop_category_hint, sales_dept, dept')
            .order('sort_order', { ascending: true });
        });
        if (!cancelled) setSections(rows || []);
      } catch (e) {
        console.warn('[Preview] sections load failed, falling back to cat grouping:', e);
      }
    })();
    return function(){ cancelled = true; };
  }, []);

  // V73: sectionId → effective sales_dept (override or 'kit' default)
  var sectionSalesDeptMap = useMemo(function(){
    var m = {};
    sections.forEach(function(s){ m[s.id] = s.sales_dept || 'kit'; });
    return m;
  }, [sections]);

  // Dish → { section_id, sort_in_section } lookup, built once from hydrated master.
  var dishSectionMap = useMemo(function(){
    var m = {};
    (getAllDishes ? getAllDishes({ includeInactive: true }) : []).forEach(function(d){
      m[d.dish_name] = {
        section_id:      d.section_id || null,
        sort_in_section: (d.sort_in_section == null ? null : d.sort_in_section),
      };
    });
    return m;
  }, []);

  // ── V73: section groups for any dept ──
  // { deptId: [ { id, name, icon, items }, ..., { id: '__extras__', ..., items } ] }
  // A section belongs to the dept given by its sales_dept override (or 'kit' default).
  // A dish's effective dept = section override (if section-assigned) or dish meta sales_dept.
  // Extras bucket collects: (a) items whose effective dept matches but section_id is unset
  // /orphaned, (b) phantoms (dish_name not in catalogue). Rendered unlabeled per V72 lock.
  var sectionGroupsByDept = useMemo(function(){
    var byDept = {};
    if (!sections || sections.length === 0 || !dishItems || dishItems.length === 0) return byDept;

    var pkgOrder = {};
    ((templateInfo && templateInfo.dishes) || []).forEach(function(d, i){ pkgOrder[d] = i; });

    function iconFor(s) {
      if (!s.sop_category_hint) return '';
      var cat = (RECIPE_DB.cats || []).find(function(c){
        return c.name === s.sop_category_hint || c.id === s.sop_category_hint;
      });
      return (cat && cat.icon) ? cat.icon : '';
    }

    function sortWithin(list) {
      var pinned = [];
      var rest = [];
      list.forEach(function(it){
        if (it.dish_name in pkgOrder) pinned.push(it);
        else rest.push(it);
      });
      pinned.sort(function(a, b){ return pkgOrder[a.dish_name] - pkgOrder[b.dish_name]; });
      rest.sort(function(a, b){
        var ma = dishSectionMap[a.dish_name];
        var mb = dishSectionMap[b.dish_name];
        var sa = (ma && ma.sort_in_section != null) ? ma.sort_in_section : 999999;
        var sb = (mb && mb.sort_in_section != null) ? mb.sort_in_section : 999999;
        if (sa !== sb) return sa - sb;
        return a.dish_name.localeCompare(b.dish_name);
      });
      return pinned.concat(rest);
    }

    // Compute effective dept per item once
    var itemDept = {};
    dishItems.forEach(function(it){
      var map = dishSectionMap[it.dish_name];
      var sid = map ? map.section_id : null;
      var override = sid ? sectionSalesDeptMap[sid] : null;
      var meta = salesMeta[it.dish_name];
      itemDept[it.dish_name] = override || (meta && meta.sales_dept) || DEFAULT_DEPT;
    });

    // For each dept, bucket into sections + extras
    var deptIds = {};
    dishItems.forEach(function(it){ deptIds[itemDept[it.dish_name]] = true; });

    Object.keys(deptIds).forEach(function(deptId){
      var deptSections = sections.filter(function(s){ return (s.sales_dept || 'kit') === deptId; });
      var validSectionIds = {};
      deptSections.forEach(function(s){ validSectionIds[s.id] = true; });

      var bySection = {};
      var extras = [];
      dishItems.forEach(function(it){
        if (itemDept[it.dish_name] !== deptId) return;
        var map = dishSectionMap[it.dish_name];
        var sid = map ? map.section_id : null;
        if (sid && validSectionIds[sid]) {
          if (!bySection[sid]) bySection[sid] = [];
          bySection[sid].push(it);
        } else {
          extras.push(it);
        }
      });

      var out = [];
      deptSections.forEach(function(s){
        var list = bySection[s.id] || [];
        if (list.length === 0) return;
        out.push({ id: s.id, name: s.name, icon: iconFor(s), items: sortWithin(list) });
      });
      if (extras.length > 0) {
        out.push({ id: '__extras__', name: '', icon: '', items: sortWithin(extras) });
      }
      if (out.length > 0) byDept[deptId] = out;
    });

    return byDept;
  }, [sections, dishItems, salesMeta, templateInfo, dishSectionMap, sectionSalesDeptMap]);

  // Sort depts in the sidebar order, filter to only those with items.
  // V73: check both byDeptByCat and sectionGroupsByDept — a dept may have items
  // only via section routing during initial load or if all its items are routed.
  var deptSections = useMemo(function(){
    return SALES_DEPTS.filter(function(d){
      if (ITEM_HAVING_DEPTS.indexOf(d.id) < 0) return false;
      var hasCat = byDeptByCat[d.id] && byDeptByCat[d.id].length > 0;
      var hasSec = sectionGroupsByDept[d.id] && sectionGroupsByDept[d.id].length > 0;
      return hasCat || hasSec;
    });
  }, [byDeptByCat, sectionGroupsByDept]);

  var totalItems = (dishItems || []).length;

  // ── V89: one printed page per section ──
  // The printed menu has no notion of departments; it is a run of sections, each
  // on its own sheet. Section routing is still what produces them, so the dept
  // order above decides the order they appear in.
  var pages = useMemo(function(){
    var out = [];
    deptSections.forEach(function(d){
      var groups = sectionGroupsByDept[d.id];
      if (groups && groups.length) {
        groups.forEach(function(g){
          out.push({ key: d.id + ':' + g.id, title: g.name || d.name, items: g.items });
        });
        return;
      }
      // No section routing for this dept yet — fall back to the category
      // buckets so the dept still prints rather than silently vanishing.
      (byDeptByCat[d.id] || []).forEach(function(c){
        out.push({ key: d.id + ':cat:' + c.id, title: c.name, items: c.items });
      });
    });
    return out;
  }, [deptSections, sectionGroupsByDept, byDeptByCat]);

  var dietLine = proposal.menu_diet === 'veg' ? T2("VEGETARIAN")
               : proposal.menu_diet === 'nonveg' ? T2("NON-VEGETARIAN") : "";
  var tierName = (templateInfo && templateInfo.name) || T2("Curated Menu");

  // ── Mark as Sent ──
  async function markAsSent() {
    if (markingSent) return;
    setMarkingSent(true);
    try {
      var res = await supabase.from('proposals')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', proposal.id);
      if (res.error) throw res.error;
      setSentJust(true);
    } catch (e) {
      console.error('[Preview] mark as sent failed:', e);
    } finally {
      setMarkingSent(false);
    }
  }
  var showMarkSent = currentStatus === 'draft' && !sentJust;

  function handlePrint() { window.print(); }

  var barBtn = {
    display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px",
    borderRadius: K.rPill, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
    fontFamily: K.fontBody, background: "#FFFFFF", border: "1px solid " + K.cardWarmLine,
    color: K.textBody,
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#2C2A26", overflowY: "auto" }}>
      <style>{MENU_CSS}</style>

      {/* ── Top bar (hidden in print) ── */}
      <div className="ambria-print-hide"
        style={{ position: "sticky", top: 0, zIndex: 10, background: K.cardWarm,
          borderBottom: "1px solid " + K.cardWarmLine, padding: "10px 18px", display: "flex",
          alignItems: "center", gap: 10, flexWrap: "wrap", boxShadow: K.shadowCard }}>
        <button onClick={onClose} style={barBtn}>
          <Icon name="chevronL" size={14} strokeWidth={2.1} />{T2("Back to menu")}
        </button>
        <span style={{ flex: 1, fontSize: 13, color: K.hdrMeta }}>
          {T2("Client-facing preview")} · {totalItems} {T2(totalItems === 1 ? "item" : "items")} · {pages.length} {T2("pages")}
        </span>
        {showMarkSent && (
          <button onClick={markAsSent} disabled={markingSent}
            style={{ ...barBtn, background: K.sageSel, borderColor: K.sage, color: K.sageText,
              cursor: markingSent ? "wait" : "pointer", opacity: markingSent ? .7 : 1 }}>
            <Icon name="check" size={14} strokeWidth={2.3} />
            {markingSent ? T2("Saving…") : T2("Mark as Sent")}
          </button>
        )}
        <button onClick={handlePrint}
          style={{ ...barBtn, background: K.brand, borderColor: K.brand, color: "#FFFFFF" }}>
          <Icon name="fileText" size={14} strokeWidth={2} />{T2("Print / Save PDF")}
        </button>
      </div>

      {/* ── The menu itself ── */}
      <div className="ambria-print-card" style={{ maxWidth: 820, margin: "22px auto 60px" }}>
        <Sheet><Cover tier={tierName} diet={dietLine} proposal={proposal} T2={T2} /></Sheet>

        {pages.map(function(pg, i){
          return (
            <Sheet key={pg.key}>
              <SectionPage page={pg} diet={dietLine} flip={i % 2 === 1} salesMeta={salesMeta} T2={T2} />
            </Sheet>
          );
        })}

        <Sheet><BackCover /></Sheet>
      </div>
    </div>
  );
}

// A single A4 sheet. containerType so the clamp()s inside scale with the sheet
// rather than the viewport — the same page then prints and previews identically.
function Sheet({ children }) {
  return (
    <div className="amb-sheet"
      style={{ containerType: "inline-size", background: "#FFF", marginBottom: 18,
        boxShadow: "0 6px 26px rgba(0,0,0,.35)" }}>
      {children}
    </div>
  );
}

// An <img> that removes itself if the file is not there, so a missing asset
// leaves the layout intact instead of showing a broken-image glyph.
function Art({ src, alt, className, style }) {
  return (
    <img src={src} alt={alt || ""} className={className} style={style} draggable="false"
      onError={function(e){ e.currentTarget.style.display = "none"; }} />
  );
}

function Cover({ tier, diet, proposal, T2 }) {
  return (
    <div className="amb-cover" style={{ backgroundImage: "url(" + coverPhoto(proposal.menu_diet) + ")" }}>
      <Art src={ART.logoLight} alt="Ambria Cuisines" className="amb-cover-mark" />
      <div className="amb-cover-tag">{T2("Curated to indulge, crafted to impress!")}</div>
      <div className="amb-cover-title">{tier}</div>
      {diet && <div className="amb-cover-kind">{diet}</div>}
      <div className="amb-cover-foot">
        <Art src={ART.qr} alt="" />
        <div>{proposal.guest_name}</div>
        <div>{T2("TO HOST YOU, CALL US")} : +91-8826399444 | +91-8800163444</div>
        <div>F-20, DWARKA LINK ROAD, SAMALKA, NEW DELHI, 110061</div>
      </div>
    </div>
  );
}

function BackCover() {
  return (
    <div className="amb-cover" style={{ backgroundImage: "url(" + ART.back + ")", justifyContent: "flex-start" }}>
      <Art src={ART.logoLight} alt="Ambria Cuisines" className="amb-cover-mark" />
      <div className="amb-cover-foot" style={{ width: "100%", display: "flex",
        justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span>CATERING@AMBRIA.IN</span>
        <span>8826399444 | +91- 8800163444</span>
      </div>
    </div>
  );
}

function SectionPage({ page, diet, flip, salesMeta, T2 }) {
  var photo = sectionPhoto(page.title);
  var sparse = page.items.length <= 4;
  var panel = (
    <div className={"amb-panel" + (sparse ? " is-sparse" : "")}>
      <h2 className="amb-title">{page.title}</h2>
      {diet && <div className="amb-sub">{diet}</div>}
      <span className="amb-rule" aria-hidden="true" />
      <div className={"amb-list" + (sparse ? " is-sparse" : "")}>
        {page.items.map(function(it){
          var meta = salesMeta[it.dish_name];
          var desc = (meta && meta.sales_description) || "";
          return (
            <div className="amb-dish" key={it.dish_name}>
              <div className="amb-dish-name">{it.dish_name}</div>
              {desc && <div className="amb-dish-desc">{desc}</div>}
            </div>
          );
        })}
      </div>
      <div className="amb-foot"><Art src={ART.logoDark} alt="Ambria Cuisines" /></div>
    </div>
  );

  var art = (
    <div className={"amb-photo" + (photo ? "" : " is-empty")}
      style={photo ? { backgroundImage: "url(" + photo + ")" } : undefined}>
      {!photo && (
        <span style={{ color: "rgba(255,255,255,.45)", fontFamily: "var(--font-body), sans-serif",
          fontSize: "clamp(8px, 1.5cqw, 13px)", letterSpacing: ".12em", padding: "0 10%" }}>
          {T2("PHOTOGRAPH")}
        </span>
      )}
    </div>
  );

  // The printed menu alternates which side carries the photograph, so facing
  // pages do not mirror each other.
  return <div className="amb-page">{flip ? <>{panel}{art}</> : <>{art}{panel}</>}</div>;
}

export default MenuBuilderPreview;
