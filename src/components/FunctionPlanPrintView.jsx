// Ambria FnB — Function Plan printable summary
// V91: redesigned onto the classic Ambria prospectus sheet layout — a bordered
// header grid (Date/Function/Guest/Address/Rate/...), two boxed columns
// (Customized Menu | F&B and Banquet Informations), and bottom sign-off boxes
// (Attn Chef / Prospectus checked-approved-circulated).
// Fields this app doesn't capture digitally (Contact No., Mode of Payment,
// Rate, Advance, sign-off) print as blank ruled boxes, same as the paper
// form — meant to be filled by hand. Direct/Repeat Guest was dropped
// (2026-10-26), Board to Read dropped (2026-10-29) — never filled in, just
// empty ruled boxes nobody used.
// Place in: src/components/FunctionPlanPrintView.jsx

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { C } from '../data/constants.js';
import { localDateStr } from '../utils/helpers.js';
import { SALES_DEPTS, DEPT_CONFIGS } from '../data/salesConfig.js';
import { TIME_FIELD_GROUPS, EQUIP_FIELDS, getLmsPlateInfo, calcDriversFoodTotal } from './FunctionPlanTab.jsx';
import { resolveDishVeg } from '../data/recipeData.js';

// Veg first, then unclassified, then non-veg. resolveDishVeg returns
// true/false/null (never guesses from the name), so an unclassified dish
// sits in its own middle bucket rather than being silently called veg or non-veg.
function dietRank(name) {
  var v = resolveDishVeg(name);
  return v === true ? 0 : v === false ? 2 : 1;
}
// Primary order is the dish's catalogue section (Snacks before Main Course,
// etc. — dishSectionOrder maps dish name -> that section's sort_order, built
// by EventMenuBuilderView from dish_catalogue_sections); veg/non-veg only
// breaks ties within the same section. A dish with no known section (map
// missing, or no section_id) sorts after everything that has one.
function sortedByVeg(names, dishSectionOrder) {
  return (names || []).slice().sort(function(a, b){
    var sa = (dishSectionOrder && dishSectionOrder[a] != null) ? dishSectionOrder[a] : Infinity;
    var sb = (dishSectionOrder && dishSectionOrder[b] != null) ? dishSectionOrder[b] : Infinity;
    if (sa !== sb) return sa - sb;
    return dietRank(a) - dietRank(b);
  });
}

var SPICE_LABELS = {
  mild:   'Mild',
  normal: 'Normal',
  spicy:  'Spicy',
};

var SWEETNESS_LABELS = {
  less_sweet:  'Less Sweet',
  normal:      'Normal',
  extra_sweet: 'Extra Sweet',
};

var OIL_LABELS = {
  less_oil:   'Less Oil',
  normal:     'Normal',
  extra_ghee: 'Extra Ghee',
};

var DIFF_KIND_META = {
  addon:     { label: 'Add-on',    color: '#2A7A48', bg: '#E5F5EA' },
  deduction: { label: 'Deduction', color: '#A52828', bg: '#FAE5E5' },
  swap:      { label: 'Swap',      color: '#1858A5', bg: '#E5F0FA' },
};

// LMS's own function-type code (fiscd_function_type) — no label travels with
// it in the synced data, so this is the LMS admin's own code list.
var LMS_FUNCTION_TYPES = {
  1: 'Ring Ceremony',       13: null,                   25: 'House Party',
  2: 'Birthday',            14: 'Haldi',                26: 'Lunch Function',
  3: 'Wedding',             15: 'Mehendi',               27: 'Breakfast Function',
  4: 'Reception',           16: 'Roka Ceremony',         28: 'Dinner Function',
  5: 'Kua Poojan',          17: 'Residential Wedding',   29: 'Breakfast',
  6: 'Anniversary',         18: 'Destination Wedding',   30: 'Lunch',
  7: 'Lagan',               19: 'Kothi Booking',         31: 'Kitty Party',
  8: 'Sagan',               20: 'Sangeet',               32: 'Restaurant Sale',
  9: 'Cocktail',            21: 'Baby Shower',           33: 'Lohri',
  10: 'Religious',          22: 'Engagement',            34: 'Diwali Party',
  11: 'Corporate',          23: 'Tender',                35: 'Get Together',
  12: 'Proposal Ceremony',  24: 'Barat Assembly',        36: 'Mata Ki Chowki',
};

// LMS staff id (fisc_entryby, who entered the contract) -> name.
var LMS_STAFF_NAMES = {
  3: 'Rajnish', 4: 'Aman Chibber', 5: 'Nivedita', 6: 'Harsh Sharma', 7: 'Kartik Atree',
  10: 'Tarun', 11: 'Krati Agarwal', 12: 'Himanshu Vats', 14: 'Tushita', 15: 'Dipesh',
  16: 'Medhavi', 17: 'Gaurav Arora', 18: 'Sahaj Kalra', 20: 'Ajay Chaudhary', 21: 'Ajay Chauhan',
  25: 'Anmol Oberoi', 29: 'Jitanshu Gulati', 30: 'Arjun Kumar', 34: 'Ompal Sharma', 36: 'Sudheer',
  40: 'Vindeep Kapoor', 48: 'Saloni', 49: 'Chaitanya Arora', 52: 'Pratik Agarwal', 54: 'Virendra',
  55: 'Umakant', 59: 'Rajshekhar', 60: 'Vipin Kumar', 61: 'Vinay', 63: 'Aditya Singh',
  66: 'Abhishek Srivastav',
};

// Renders one saved config value as a short human-readable line, using the
// same DEPT_CONFIGS schema ConfigsPanel edits it with (option ids -> names,
// ratio ids -> the num:den + live staff count, etc.) instead of dumping the
// raw { selected_id / items / ... } shape.
function formatConfigValue(cfg, value, pax) {
  if (value == null) return null;
  if (cfg.type === 'options' || cfg.type === 'radio') {
    var opt = (cfg.options || []).find(function(o){ return o.id === value.selected_id; });
    return opt ? opt.name : null;
  }
  if (cfg.type === 'count') {
    return value.count != null ? String(value.count) : null;
  }
  if (cfg.type === 'ratio') {
    var r = (cfg.ratios || []).find(function(x){ return x.id === value.ratio_id; });
    if (!r) return null;
    var extras = value.extras || 0;
    var count = pax ? Math.ceil(pax / r.den) * r.num + extras : null;
    return r.num + ':' + r.den + (extras ? ' +' + extras + ' extra' : '') + (count != null ? ' → ' + count + ' staff' : '');
  }
  if (cfg.type === 'multi_count') {
    var items = (value.items || []).filter(function(it){ return it.count > 0; });
    if (items.length === 0) return null;
    return items.map(function(it){
      var opt = (cfg.options || []).find(function(o){ return o.id === it.id; });
      return (opt ? opt.name : it.id) + ': ' + it.count;
    }).join(', ');
  }
  if (cfg.type === 'tags') {
    var ids = value.selected_ids || [];
    if (ids.length === 0) return null;
    return ids.map(function(id){
      var opt = (cfg.options || []).find(function(o){ return o.id === id; });
      return opt ? opt.name : id;
    }).join(', ');
  }
  return null;
}

function ordinalSuffix(n) {
  var v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  switch (n % 10) {
    case 1: return n + 'st';
    case 2: return n + 'nd';
    case 3: return n + 'rd';
    default: return n + 'th';
  }
}

// "9th Oct 2026" — used for every date printed on this sheet.
function prettyDate(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr + 'T00:00');
    if (isNaN(d.getTime())) return dateStr;
    return ordinalSuffix(d.getDate()) + ' ' + d.toLocaleDateString('en-US', { month: 'short' }) + ' ' + d.getFullYear();
  } catch (e) { return dateStr; }
}

// A boxed field: the filled-in value sits above a small uppercase label at
// the bottom edge of its own cell — same convention as the paper prospectus,
// where an empty cell is left as a ruled box to fill in by hand.
function FCell({ value, label, last, large, size }) {
  var valueSize = size != null ? size : (large ? 16 : 9);
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "4px 10px 3px", borderRight: last ? "none" : "1px solid #000",
      display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: valueSize, fontWeight: large ? 700 : 600, wordBreak: "break-word" }}>{value || ' '}</div>
      <div style={{ fontSize: 5, fontWeight: 700, letterSpacing: ".5px", color: "#555", marginTop: 1 }}>{label}</div>
    </div>
  );
}

function FRow({ children, thick }) {
  return <div style={{ display: "flex", borderBottom: thick ? "2px solid #000" : "1px solid #000" }}>{children}</div>;
}

function ColTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, textDecoration: "underline", marginBottom: 10 }}>{children}</div>;
}

function SubHead({ children }) {
  // breakAfter, not breakInside on the whole block below it: a department's
  // dish list can run to 20+ lines, easily taller than a full page's
  // remaining room, and forcing that entire block to stay together just
  // pushed it wholesale onto the next page — the exact "why is the menu on
  // page 2 while everything else sits on an almost-empty page 1" bug. This
  // only keeps the heading itself from being stranded alone at a page's
  // bottom edge; the list under it is free to split wherever it naturally
  // runs out of room.
  return <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 10, marginBottom: 4, breakAfter: "avoid" }}>{children}</div>;
}

// A catalogue section's name (Dish Library > Sections tab), printed as a
// lighter sub-heading under the department heading — e.g. "Pass Around
// Snacks" / "Indian Main Course" grouping the dishes under Kitchen. Only
// used on the no-package (custom menu) branch, where there's no package
// section name to group by instead.
function SectionSubHead({ children }) {
  return <div style={{ fontSize: 9, fontWeight: 700, fontStyle: "italic", color: "#555", marginTop: 8, marginBottom: 2, breakAfter: "avoid" }}>{children}</div>;
}

function Bullet({ children, dot }) {
  if (dot === false) {
    return <div style={{ fontSize: 10.5, padding: "2px 0" }}>{children}</div>;
  }
  return <div style={{ fontSize: 10.5, padding: "2px 0 2px 14px", position: "relative" }}>
    <span style={{ position: "absolute", left: 0 }}>•</span>{children}
  </div>;
}

export function FunctionPlanPrintView({ event, fp, itemsByDept, dishSectionOrder, dishSectionName, packageName, menuDiffByDept, configsByDept, currentUser, onAckChef, onClose, T2 }) {
  var [acking, setAcking] = useState(false);
  function handleAck() {
    if (!onAckChef || acking) return;
    setAcking(true);
    Promise.resolve(onAckChef()).finally(function(){ setAcking(false); });
  }
  // Browsers suggest document.title as the filename for "Print → Save as PDF",
  // so this is the one lever that controls what the chef/sales actually sees
  // in that Save dialog — set it for as long as this view is on screen, then
  // put the tab's real title back.
  useEffect(function(){
    var prevTitle = document.title;
    var parts = [event && event.guest, event && event.date, event && event.type,
      (event && event.pax != null) ? (event.pax + 'pax') : null, 'FP'].filter(Boolean);
    var name = parts.join('_').replace(/[\\/:*?"<>|]/g, '-').trim();
    if (name) document.title = name;
    return function(){ document.title = prevTitle; };
  // eslint-disable-next-line
  }, []);

  // ── Right-column bullets, grouped the same way FunctionPlanTab.jsx's own
  // panels group these fields (Food Preference, Timings, Room Info, Equipment
  // Add-ons, Drivers Food, Extra Plate Info, After Party) -- a flat list used
  // to read as one undifferentiated pile with no sense of which form section
  // a line actually came from.
  var bulletGroups = [];
  function pushGroup(heading, items) {
    if (items.length) bulletGroups.push({ heading: heading, items: items });
  }
  // getLmsPlateInfo only needs `event`, not `fp` -- computed up front so its
  // group can land between Drivers Food and After Party (the form's own
  // panel order) and still show even before any FP row exists.
  var lmsPlate = getLmsPlateInfo(event);
  if (fp) {
    var foodPrefItems = [];
    // Printers (and PDF export) drop background colors by default unless the
    // browser's own "Background graphics" print option is on — WebkitPrintColorAdjust
    // / printColorAdjust: "exact" forces this highlight to actually show up on
    // the printed page regardless of that checkbox, not just in the on-screen preview.
    if (fp.guest_preference) foodPrefItems.push(<span>Guest preference — <span style={{ background: "#CFE8FF", padding: "1px 3px", borderRadius: 2, whiteSpace: "pre-wrap", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{fp.guest_preference}</span></span>);
    if (fp.spice_tolerance && SPICE_LABELS[fp.spice_tolerance]) foodPrefItems.push('Spice level: ' + SPICE_LABELS[fp.spice_tolerance]);
    if (fp.sweetness_tolerance && SWEETNESS_LABELS[fp.sweetness_tolerance]) foodPrefItems.push('Sweetness level: ' + SWEETNESS_LABELS[fp.sweetness_tolerance]);
    if (fp.oil_preference && OIL_LABELS[fp.oil_preference]) foodPrefItems.push('Oil preference: ' + OIL_LABELS[fp.oil_preference]);
    if (fp.guest_community) foodPrefItems.push('Community: ' + fp.guest_community);
    if (fp.corkage_price != null) foodPrefItems.push('Corkage: ₹' + fp.corkage_price + (fp.corkage_details ? ' — ' + fp.corkage_details : '') + (fp.corkage_liquor ? ' (liquor being served)' : ''));
    else if (fp.corkage_liquor) foodPrefItems.push('Liquor being served');
    pushGroup('Food Preference', foodPrefItems);

    // Not every one of these is a START time -- "Wind-up"/"Chaat end"/
    // "Snacks end"/"Live end"/"Valet end" are all end-of-something times, so
    // a blanket " start time @ " suffix was wrong for them (and redundant
    // for "Function start"). Just the label and the time.
    // Grouped start/end pairs (Chaat, Snacks, Live, Valet) print as one
    // bullet — "Chaat @ 07:30 PM – 11:00 PM" — instead of two separate
    // lines, same pairing the Timings panel itself edits side by side.
    var timingItems = [];
    TIME_FIELD_GROUPS.forEach(function(g){
      var startVal = fp[g.start];
      var endVal = g.end ? fp[g.end] : null;
      if (!startVal && !endVal) return;
      if (startVal && endVal) timingItems.push(T2(g.label) + ' @ ' + startVal + ' – ' + endVal);
      else timingItems.push(T2(g.label) + ' @ ' + (startVal || endVal));
    });
    pushGroup('Timings', timingItems);

    var roomItems = [];
    if (fp.room_info_enabled) {
      var roomParts = [];
      if (fp.room_check_in) roomParts.push('check-in ' + fp.room_check_in);
      if (fp.room_check_out) roomParts.push('check-out ' + fp.room_check_out);
      if (fp.room_count != null) roomParts.push(fp.room_count + ' room(s)');
      if (roomParts.length) roomItems.push('Rooms — ' + roomParts.join(', '));
    }
    pushGroup('Room Info', roomItems);

    var equipItems = [];
    EQUIP_FIELDS.filter(function(f){ return fp[f.id + '_enabled']; }).forEach(function(f){
      var count = fp[f.id + '_count']; var price = fp[f.id + '_price'];
      equipItems.push(T2(f.label) + (count != null ? ': ' + count : '') + (price != null ? ' @ ₹' + price : ''));
    });
    pushGroup('Equipment Add-ons', equipItems);

    var driversItems = [];
    if (fp.drivers_food_required) {
      var dfParts = [];
      if (fp.drivers_food_count != null) dfParts.push(fp.drivers_food_count + ' pax');
      if (fp.drivers_food_foc) {
        dfParts.push('FOC');
      } else {
        var dfTotal = calcDriversFoodTotal(fp.drivers_food_count, fp.drivers_food_total_override);
        if (dfTotal != null) dfParts.push('total ₹' + dfTotal.toLocaleString('en-IN'));
      }
      driversItems.push('Drivers food' + (dfParts.length ? ' — ' + dfParts.join(', ') : ''));
    }
    pushGroup('Drivers Food', driversItems);
  }

  var lmsPlateItems = [];
  if (lmsPlate) {
    if (lmsPlate.comp != null) lmsPlateItems.push('Complimentary plates: ' + lmsPlate.comp);
    if (lmsPlate.rateFull != null) lmsPlateItems.push('Extra plate @ ₹' + lmsPlate.rateFull.toLocaleString('en-IN') + ' per plate');
  }
  pushGroup('Extra Plate Info', lmsPlateItems);

  if (fp && fp.after_party_enabled) {
    var apParts = [];
    if (fp.after_party_pax != null) apParts.push(fp.after_party_pax + ' pax');
    if (fp.after_party_start_time) apParts.push('start ' + fp.after_party_start_time);
    if (fp.after_party_windup_time) apParts.push('wind-up ' + fp.after_party_windup_time);
    pushGroup('After Party', ['After party' + (apParts.length ? ' — ' + apParts.join(', ') : '')]);
  }

  var lmsRaw = event.lms_raw || null;
  var functionTypeLabel = (lmsRaw && LMS_FUNCTION_TYPES[Number(lmsRaw.fiscd_function_type)]) || event.type || '';
  var mgrName = lmsRaw ? LMS_STAFF_NAMES[Number(lmsRaw.fisc_entryby)] : null;
  // address1 from LMS is the specific lawn/hall within the venue property
  // (e.g. "EMERALD LAWN + GLASS HOUSE" at "Manaktala Farm") — not captured
  // anywhere else in this app, so it only ever shows up on the FP print.
  var subVenue = (lmsRaw && lmsRaw.address1 && lmsRaw.address1.trim()) || '';
  // Session (Lunch/Dinner/Sundowner/...) — a venue contract's row names it
  // fiscd_session, a catering contract's chcd_session; never both on the
  // same row, so either lookup is safe.
  var sessionLabel = (lmsRaw && (lmsRaw.fiscd_session || lmsRaw.chcd_session)) || '';

  // Outdoor Catering functions carry their venue separately (events.odc_location
  // / odc_address, set by lms-sync's transformCateringContract) since event.venue
  // is just the literal "Outdoor Catering (ODC)" label for these — not the
  // actual place the function is happening, which the kitchen/ops team needs.
  // Goes in the header's own ADDRESS cell (full location + street address),
  // not a separate bullet — "where's the address" should be answered by the
  // field literally labelled ADDRESS, not a line buried in the F&B column.
  var addressValue = (event.odc_location || event.odc_address)
    ? [event.odc_location, event.odc_address].filter(Boolean).join(' — ')
    : (event.venue || '');
  var deptConfigItems = [];
  SALES_DEPTS.forEach(function(d){
    var deptDefs = DEPT_CONFIGS[d.id] || [];
    var deptValues = (configsByDept && configsByDept[d.id]) || {};
    deptDefs.forEach(function(cfg){
      var val = formatConfigValue(cfg, deptValues[cfg.key], event.pax);
      if (val) deptConfigItems.push(d.name + ' — ' + cfg.label + ': ' + val);
    });
  });
  pushGroup('Department Configs', deptConfigItems);

  var attnChefLines = [fp && fp.service_notes, fp && fp.general_notes]
    .filter(Boolean).join('\n').split('\n').map(function(s){ return s.trim(); }).filter(Boolean);

  // Dept block order on the printed menu used to be the fixed app-wide
  // SALES_DEPTS sequence (Kitchen, Beverage, Bakery, Fruits, ...) — but the
  // Dish Library's Sections tab is now one combined, freely-orderable list
  // (no more per-dept split there either), so a dept with its sections
  // dragged earlier in that list (e.g. Beverage before Kitchen) should print
  // first too. Rank each dept by the lowest sort_order among its own items'
  // sections — dishSectionOrder already carries that globally-meaningful
  // value for every dish actually on this menu — and order SALES_DEPTS by
  // that instead of its own declaration order. A dept with nothing on this
  // menu sorts last (nothing to rank it by).
  function minSectionOrderForDept(deptId) {
    var names = (itemsByDept && itemsByDept[deptId]) || [];
    var best = Infinity;
    names.forEach(function(n){
      var o = dishSectionOrder && dishSectionOrder[n];
      if (o != null && o < best) best = o;
    });
    return best;
  }
  var orderedDepts = SALES_DEPTS.slice().sort(function(a, b){
    return minSectionOrderForDept(a.id) - minSectionOrderForDept(b.id);
  });

  return createPortal(
    <div className="fp-print-root" style={{ position: "fixed", inset: 0, zIndex: 200, background: "#fff", overflowY: "auto" }}>
      {/* Browsers don't paginate a `position: fixed` overlay as the page to
          print — many fall back to printing whatever's in normal document
          flow underneath it (the app shell: sidebar, nav, user chip, shrunk
          to fit one page), which is the "tiny screenshot of the whole app"
          bug. This view is nested arbitrarily deep inside the app tree
          (wherever the screen that opened it put it), so hiding "everything
          but this" can't rely on a parent/child selector — hide the whole
          page's visibility, then restore it for just this subtree and pull
          it to the page origin, same as the standard "print this one modal"
          technique.
          Pulling it out of `position:fixed` wasn't enough on its own, though:
          the root's own inline style also sets `inset:0` (a fixed top+right+
          bottom+left, i.e. a box pinned to exactly one viewport tall) and
          `overflowY:"auto"` for its on-screen scrolling. Neither is cleared
          by just switching `position` to `absolute` — `bottom:0` still
          stretches the box to exactly one page's height with the rest
          scrollable-and-clipped, which is what printed as a single
          screenshot-like page instead of flowing a long FP across as many
          printed pages as it needs. `inset:auto` + an explicit `height:auto`
          and `overflow:visible` let the box grow to its real content height,
          which is what a browser's print engine actually paginates.
          Still not enough by itself, though: this view is mounted deep
          inside the app tree (BookedFunctions -> EventMenuBuilderView), and
          ANY ancestor with its own CSS `transform` (ripple effects, sidebar
          slide transitions — common in this app) becomes the containing
          block for every `position:fixed`/`absolute` descendant below it,
          not the real viewport. If that ancestor also clips overflow, the
          print engine genuinely has less content to paginate, no matter
          what this element's own height/overflow say — still "1 page" in
          the print preview even with the CSS above. Portalling straight to
          `document.body` (same fix as the notification bell / Used In
          popovers / Ingredients modal elsewhere this session) makes this a
          direct child of body, with no transformed/clipping ancestor
          between it and the real page. */}
      <style>{"@media print { body * { visibility: hidden !important; } .fp-print-root, .fp-print-root * { visibility: visible !important; } .fp-print-root { position: absolute !important; inset: auto !important; left: 0 !important; top: 0 !important; width: 100% !important; height: auto !important; overflow: visible !important; } .fp-no-print { display: none !important; } }"}</style>
      <div className="fp-no-print" style={{ position: "sticky", top: 0, zIndex: 1, background: C.surface, borderBottom: "1px solid " + C.border, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
        {fp && fp.chef_ack_by && (
          <span style={{ marginRight: "auto", fontSize: 10.5, fontWeight: 600, color: "#1C7A3D" }}>
            ✓ {T2("Seen by")} {fp.chef_ack_by}
          </span>
        )}
        {currentUser && currentUser.role === 'head_chef' && !(fp && fp.chef_ack_by) && onAckChef && (
          <button onClick={handleAck} disabled={acking}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#1C7A3D", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: acking ? "default" : "pointer", opacity: acking ? 0.7 : 1 }}>
            {acking ? T2("Saving…") : "✓ " + T2("Acknowledge")}
          </button>
        )}
        <button onClick={onClose}
          style={{ padding: "8px 16px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          {T2("Close")}
        </button>
        <button onClick={function(){ window.print(); }}
          style={{ padding: "8px 16px", borderRadius: 8, background: "#8A70C8", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          🖨 {T2("Print")}
        </button>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "30px 24px", color: "#000", fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Ambria Cuisines</div>
          <div style={{ fontSize: 8, color: "#555" }}>{T2("Function Plan")}</div>
          {fp && fp.locked && (
            <div style={{ display: "inline-block", marginTop: 6, padding: "3px 10px", borderRadius: 4, border: "1px solid #1C7A3D", color: "#1C7A3D", fontSize: 6.5, fontWeight: 700, letterSpacing: ".5px" }}>
              🔒 {T2("FINAL — SENT TO KITCHEN")}
            </div>
          )}
        </div>

        {/* ── Header grid — DATE/FUNCTION/SESSION/MIN GTD, GUEST/ADDRESS/SUB-VENUE/CONTACT, PACKAGE/MANAGER ── */}
        <div style={{ border: "2px solid #000" }}>
          <FRow>
            <FCell value={prettyDate(event.date)} label="DATE" />
            <FCell value={functionTypeLabel} label="FUNCTION" />
            <FCell value={sessionLabel} label="SESSION" />
            <FCell value={event.pax != null ? event.pax : ''} label="MIN GTD" last />
          </FRow>
          <FRow>
            <FCell value={event.guest || ''} label="GUEST NAME" />
            <FCell value={(event.lms_raw && event.lms_raw.fisc_client_mobile) || ''} label="CONTACT NO." />
            <FCell value={addressValue} label="ADDRESS" last={!subVenue} />
            {subVenue && <FCell value={subVenue} label="SUB-VENUE" size={7} last />}
          </FRow>
          <FRow thick>
            <FCell value={packageName || ''} label="PACKAGE" large size={8} />
            <FCell value={(fp && fp.ops_manager_name) || ''} label="OPERATION MANAGER" />
            <FCell value={(fp && fp.ops_manager_contact) || ''} label="MANAGER CONTACT" last />
          </FRow>
        </div>

        {/* ── Two boxed columns — Customized Menu | F&B and Banquet Informations ──
            These stay side by side for print too, matching the on-screen
            layout — the actual bug behind "why are the swaps coming from the
            second page" wasn't the two columns themselves, it was each
            department's long swap list having `breakInside:"avoid"`, which
            forces an unbreakable block (and the WHOLE grid row carrying it,
            since a grid row is as tall as its tallest cell) to jump wholesale
            to the next page rather than split — leaving most of the previous
            page blank under the shorter F&B column. Now that only the
            (short, one-line) SubHead headings get `breakAfter:"avoid"` and the
            long lists below them are free to split, the columns can run side
            by side and continue in the same left/right position on
            subsequent pages like a normal two-column print layout. */}
        <div className="fp-print-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "2px solid #000", borderTop: "none" }}>
          <div className="fp-print-col-left" style={{ padding: "14px 16px", borderRight: "2px solid #000" }}>
            <ColTitle>{T2("Customized Menu")} :</ColTitle>
            {packageName ? (
              <div>
                {Object.keys(menuDiffByDept || {}).length === 0 ? (
                  <div style={{ fontSize: 10.5, fontStyle: "italic", color: "#555" }}>{T2("Menu matches the package exactly — no swaps or add-ons.")}</div>
                ) : (
                  orderedDepts.map(function(d){
                    var diff = menuDiffByDept && menuDiffByDept[d.id];
                    if (!diff) return null;
                    var meta = diff.kind ? DIFF_KIND_META[diff.kind] : null;
                    return (
                      <div key={d.id}>
                        {meta && (function(){
                          // Grouped by catalogue section, same as the no-package
                          // branch below, instead of two flat +added/−removed
                          // lists — a swap list of any real length used to read
                          // as an unordered pile with no sense of where each
                          // dish actually sits on the menu.
                          var combined = []
                            .concat((diff.added || []).map(function(n){ return { name: n, sign: '+' }; }))
                            .concat((diff.removed || []).map(function(n){ return { name: n, sign: '-' }; }));
                          var signByName = {};
                          combined.forEach(function(x){ signByName[x.name] = x.sign; });
                          var sortedNames = sortedByVeg(combined.map(function(x){ return x.name; }), dishSectionOrder);
                          var lastSec;
                          return (
                            <>
                              <SubHead>{d.name} <span style={{ fontWeight: 400, fontStyle: "italic" }}>({T2(meta.label)})</span></SubHead>
                              {sortedNames.map(function(n){
                                var sec = (dishSectionName && dishSectionName[n]) || 'Extras';
                                var isNewSection = sec !== lastSec;
                                lastSec = sec;
                                var sign = signByName[n];
                                return (
                                  <React.Fragment key={n}>
                                    {isNewSection && <SectionSubHead>{sec === 'Extras' ? T2('Extras') : sec}</SectionSubHead>}
                                    <Bullet dot={false}>
                                      {sign === '+'
                                        ? <span style={{ color: "#1C7A3D", fontWeight: 700 }}>+ {n}</span>
                                        : <span style={{ color: "#B3281F", fontWeight: 700 }}>− {n}</span>}
                                    </Bullet>
                                  </React.Fragment>
                                );
                              })}
                            </>
                          );
                        })()}
                        {/* A whole catalogue section added just for this event — never
                            part of the package, so it's its own block, not a "Swap"/
                            "Add-on" diff line: the kitchen needs to know a NEW SECTION
                            exists, not just that some extra dishes got added somewhere. */}
                        {(diff.newSections || []).map(function(sec){
                          return (
                            <div key={sec.name}>
                              <SubHead>{d.name} <span style={{ fontWeight: 400, fontStyle: "italic" }}>({T2("New")} {sec.name})</span></SubHead>
                              {sortedByVeg(sec.dishes, dishSectionOrder).map(function(n){ return <Bullet key={'n' + n} dot={false}><span style={{ color: "#1C7A3D", fontWeight: 700 }}>+ {n}</span></Bullet>; })}
                            </div>
                          );
                        })}
                        {/* A whole package-default section with every one of its
                            dishes gone — one line, not a pile of individual
                            "− dish" bullets. */}
                        {(diff.removedSections || []).map(function(sec){
                          return (
                            <div key={'rs-' + sec.name}>
                              <SubHead>{d.name} <span style={{ fontWeight: 400, fontStyle: "italic", color: "#B3281F" }}>({T2("Section removed")}: {sec.name} — {sec.dishes.length} {T2("dishes")})</span></SubHead>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div>
                {orderedDepts.map(function(d){
                  var names = (itemsByDept && itemsByDept[d.id]) || [];
                  if (names.length === 0) return null;
                  var sorted = sortedByVeg(names, dishSectionOrder);
                  var lastSection; // undefined sentinel — first item always re-evaluates
                  return (
                    <div key={d.id}>
                      <SubHead>{d.name}</SubHead>
                      {sorted.map(function(n){
                        var sec = (dishSectionName && dishSectionName[n]) || 'Extras';
                        var isNewSection = sec !== lastSection;
                        lastSection = sec;
                        return (
                          <React.Fragment key={n}>
                            {isNewSection && <SectionSubHead>{sec === 'Extras' ? T2('Extras') : sec}</SectionSubHead>}
                            <Bullet>{n}</Bullet>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  );
                })}
                {SALES_DEPTS.every(function(d){ return !(itemsByDept && itemsByDept[d.id] && itemsByDept[d.id].length); }) && (
                  <div style={{ fontSize: 10.5, fontStyle: "italic", color: "#555" }}>{T2("No items selected yet.")}</div>
                )}
              </div>
            )}
          </div>

          <div className="fp-print-col-right" style={{ padding: "14px 16px" }}>
            <ColTitle>{T2("F&B and Banquet Informations")}</ColTitle>
            {bulletGroups.length === 0 ? (
              <div style={{ fontSize: 10.5, fontStyle: "italic", color: "#555" }}>{T2("Nothing recorded yet.")}</div>
            ) : (
              bulletGroups.map(function(g, gi){
                return (
                  <div key={gi}>
                    <SubHead>{T2(g.heading)}</SubHead>
                    {g.items.map(function(b, i){ return <Bullet key={i} dot={false}>{b}</Bullet>; })}
                  </div>
                );
              })
            )}
            {/* ── Layout information — stage/mandap placement, entry & exit,
                seating plan, decor zones, parking. Moved in next to the rest
                of the F&B/banquet info instead of its own full-width block
                at the very bottom, where it used to read as an afterthought
                disconnected from everything else about the function. ── */}
            {fp && ((fp.layout_info && fp.layout_info.trim()) || fp.layout_image_url) && (
              <div>
                <SubHead>{T2("Layout Information")}</SubHead>
                {fp.layout_info && fp.layout_info.trim() && <Bullet dot={false}><span style={{ whiteSpace: "pre-wrap" }}>{fp.layout_info}</span></Bullet>}
                {fp.layout_image_url && (
                  <img src={fp.layout_image_url} alt={T2("Layout reference")}
                    style={{ display: "block", marginTop: 6, maxWidth: "100%", maxHeight: 260, objectFit: "contain" }} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Guest signature, when captured — FunctionPlanTab.jsx's own
            closing-confirmation block, never shown on the print before. ── */}
        {fp.guest_signature && (
          <div style={{ border: "2px solid #000", borderTop: "none", padding: "10px 16px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".5px", color: "#555" }}>
              {T2("GUEST SIGNATURE")}{fp.guest_signature_name ? (' — ' + fp.guest_signature_name) : ''}
            </div>
            <img src={fp.guest_signature} alt={T2("Guest signature")}
              style={{ height: 50, maxWidth: 220, objectFit: "contain", border: "1px solid #ccc", background: "#fff" }} />
          </div>
        )}

        {/* ── Sign-off strip — Attn Chef / Checked-Approved-Circulated ── */}
        <div style={{ border: "2px solid #000", borderTop: "none" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #000", minHeight: 54 }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".5px", color: "#D2691E", marginBottom: 4 }}>{T2("ATTN CHEF")}</div>
            {attnChefLines.length > 1 ? (
              attnChefLines.map(function(line, i){ return <Bullet key={i}><span style={{ color: "#D2691E", fontWeight: 600 }}>{line}</span></Bullet>; })
            ) : attnChefLines.length === 1 ? (
              <div style={{ fontSize: 10.5, color: "#D2691E", fontWeight: 600 }}>{attnChefLines[0]}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", padding: "10px 16px", gap: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".5px", color: "#555", flex: "1 1 220px" }}>{T2("PROSPECTUS CHECKED / APPROVED / CIRCULATED")}</div>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".5px", color: "#555" }}>{T2("MGR")}: {mgrName || '_______________'}</div>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".5px", color: "#555" }}>{T2("Date")}: {prettyDate(localDateStr(new Date()))}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default FunctionPlanPrintView;
