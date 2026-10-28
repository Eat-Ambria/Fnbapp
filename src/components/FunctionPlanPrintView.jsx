// Ambria FnB — Function Plan printable summary
// V91: redesigned onto the classic Ambria prospectus sheet layout — a bordered
// header grid (Date/Function/Guest/Address/Rate/...), two boxed columns
// (Customized Menu | F&B and Banquet Informations), and bottom sign-off boxes
// (Board to Read / Attn Chef / Prospectus checked-approved-circulated).
// Fields this app doesn't capture digitally (Contact No., Mode of Payment,
// Rate, Advance, Board to Read, sign-off) print as blank ruled boxes, same
// as the paper form — meant to be filled by hand. Direct/Repeat Guest was
// dropped (2026-10-26) — never filled in, just two empty ruled boxes.
// Place in: src/components/FunctionPlanPrintView.jsx

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { C } from '../data/constants.js';
import { localDateStr } from '../utils/helpers.js';
import { SALES_DEPTS, DEPT_CONFIGS } from '../data/salesConfig.js';
import { TIME_FIELDS, EQUIP_FIELDS, getLmsPlateInfo } from './FunctionPlanTab.jsx';
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
  mild:        'Mild',
  medium:      'Medium',
  spicy:       'Spicy',
  extra_spicy: 'Extra Spicy',
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

function dayNameFor(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr + 'T00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  } catch (e) { return ''; }
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
function FCell({ value, label, last }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "8px 10px 6px", borderRight: last ? "none" : "1px solid #000",
      display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 46 }}>
      <div style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>{value || ' '}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".5px", color: "#555", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function FRow({ children, thick }) {
  return <div style={{ display: "flex", borderBottom: thick ? "2px solid #000" : "1px solid #000" }}>{children}</div>;
}

function ColTitle({ children }) {
  return <div style={{ fontSize: 14, fontWeight: 700, textDecoration: "underline", marginBottom: 10 }}>{children}</div>;
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
  return <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 10, marginBottom: 4, breakAfter: "avoid" }}>{children}</div>;
}

// A catalogue section's name (Dish Library > Sections tab), printed as a
// lighter sub-heading under the department heading — e.g. "Pass Around
// Snacks" / "Indian Main Course" grouping the dishes under Kitchen. Only
// used on the no-package (custom menu) branch, where there's no package
// section name to group by instead.
function SectionSubHead({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, fontStyle: "italic", color: "#555", marginTop: 8, marginBottom: 2, breakAfter: "avoid" }}>{children}</div>;
}

function Bullet({ children, dot }) {
  if (dot === false) {
    return <div style={{ fontSize: 12.5, padding: "2px 0" }}>{children}</div>;
  }
  return <div style={{ fontSize: 12.5, padding: "2px 0 2px 14px", position: "relative" }}>
    <span style={{ position: "absolute", left: 0 }}>•</span>{children}
  </div>;
}

export function FunctionPlanPrintView({ event, fp, itemsByDept, dishSectionOrder, dishSectionName, packageName, menuDiffByDept, configsByDept, onClose, T2 }) {
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

  // ── Right-column bullets: every bit of F&B/banquet service info this app
  // tracks, flattened into one list — mirrors the paper form's own mix of
  // set-up, staffing and timing notes under one heading. ──
  var bullets = [];
  if (fp) {
    // Printers (and PDF export) drop background colors by default unless the
    // browser's own "Background graphics" print option is on — WebkitPrintColorAdjust
    // / printColorAdjust: "exact" forces this highlight to actually show up on
    // the printed page regardless of that checkbox, not just in the on-screen preview.
    if (fp.guest_preference) bullets.push(<span>Guest preference — <span style={{ background: "#CFE8FF", padding: "1px 3px", borderRadius: 2, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{fp.guest_preference}</span></span>);
    if (fp.spice_tolerance && SPICE_LABELS[fp.spice_tolerance]) bullets.push('Spice tolerance: ' + SPICE_LABELS[fp.spice_tolerance]);
    if (fp.corkage_price != null) bullets.push('Corkage: ₹' + fp.corkage_price + (fp.corkage_details ? ' — ' + fp.corkage_details : ''));
    TIME_FIELDS.filter(function(f){ return fp[f.id]; }).forEach(function(f){ bullets.push(T2(f.label) + ' start time @ ' + fp[f.id]); });
    if (fp.room_info_enabled) {
      var roomParts = [];
      if (fp.room_check_in) roomParts.push('check-in ' + fp.room_check_in);
      if (fp.room_check_out) roomParts.push('check-out ' + fp.room_check_out);
      if (fp.room_count != null) roomParts.push(fp.room_count + ' room(s)');
      if (roomParts.length) bullets.push('Rooms — ' + roomParts.join(', '));
    }
    EQUIP_FIELDS.filter(function(f){ return fp[f.id + '_enabled']; }).forEach(function(f){
      var count = fp[f.id + '_count']; var price = fp[f.id + '_price'];
      bullets.push(T2(f.label) + (count != null ? ': ' + count : '') + (price != null ? ' @ ₹' + price : ''));
    });
    if (fp.drivers_food_required) {
      var dfParts = [];
      if (fp.drivers_food_count != null) dfParts.push(fp.drivers_food_count + ' people');
      if (fp.drivers_food_rate != null) dfParts.push('@ ₹' + fp.drivers_food_rate + '/plate');
      if (fp.drivers_food_coupon) dfParts.push('coupon issued');
      bullets.push('Drivers food' + (dfParts.length ? ' — ' + dfParts.join(', ') : ''));
    }
  }
  var lmsRaw = event.lms_raw || null;
  var functionTypeLabel = (lmsRaw && LMS_FUNCTION_TYPES[Number(lmsRaw.fiscd_function_type)]) || event.type || '';
  var mgrName = lmsRaw ? LMS_STAFF_NAMES[Number(lmsRaw.fisc_entryby)] : null;
  // address1 from LMS is the specific lawn/hall within the venue property
  // (e.g. "EMERALD LAWN + GLASS HOUSE" at "Manaktala Farm") — not captured
  // anywhere else in this app, so it only ever shows up on the FP print.
  var subVenue = (lmsRaw && lmsRaw.address1 && lmsRaw.address1.trim()) || '';

  var lmsPlate = getLmsPlateInfo(event);
  if (lmsPlate) {
    if (lmsPlate.comp != null) bullets.push('Complimentary plates: ' + lmsPlate.comp);
    if (lmsPlate.rateFull != null) bullets.push('Extra plate @ ₹' + lmsPlate.rateFull.toLocaleString('en-IN') + ' per plate');
  }
  SALES_DEPTS.forEach(function(d){
    var deptDefs = DEPT_CONFIGS[d.id] || [];
    var deptValues = (configsByDept && configsByDept[d.id]) || {};
    deptDefs.forEach(function(cfg){
      var val = formatConfigValue(cfg, deptValues[cfg.key], event.pax);
      if (val) bullets.push(d.name + ' — ' + cfg.label + ': ' + val);
    });
  });

  var attnChefLines = [fp && fp.allergies, fp && fp.service_notes, fp && fp.general_notes]
    .filter(Boolean).join('\n').split('\n').map(function(s){ return s.trim(); }).filter(Boolean);

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
      <div className="fp-no-print" style={{ position: "sticky", top: 0, zIndex: 1, background: C.surface, borderBottom: "1px solid " + C.border, padding: "12px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose}
          style={{ padding: "8px 16px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {T2("Close")}
        </button>
        <button onClick={function(){ window.print(); }}
          style={{ padding: "8px 16px", borderRadius: 8, background: "#8A70C8", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          🖨 {T2("Print")}
        </button>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "30px 24px", color: "#000", fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Ambria Cuisines</div>
          <div style={{ fontSize: 12, color: "#555" }}>{T2("Function Plan")}</div>
          {fp && fp.locked && (
            <div style={{ display: "inline-block", marginTop: 6, padding: "3px 10px", borderRadius: 4, border: "1px solid #1C7A3D", color: "#1C7A3D", fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px" }}>
              🔒 {T2("FINAL — SENT TO KITCHEN")}
            </div>
          )}
        </div>

        {/* ── Header grid — DATE/DAY/FUNCTION, GUEST/ADDRESS/CONTACT, GTD/PAYMENT/RATE, DIRECT/REPEAT ── */}
        <div style={{ border: "2px solid #000" }}>
          <FRow>
            <FCell value={prettyDate(event.date)} label="DATE" />
            <FCell value={dayNameFor(event.date)} label="DAY" />
            <FCell value={functionTypeLabel} label="FUNCTION" last />
          </FRow>
          <FRow>
            <FCell value={event.guest || ''} label="GUEST NAME" />
            <FCell value={event.venue || ''} label="ADDRESS" />
            {subVenue && <FCell value={subVenue} label="SUB-VENUE" />}
            <FCell value={(event.lms_raw && event.lms_raw.fisc_client_mobile) || ''} label="CONTACT NO." last />
          </FRow>
          <FRow thick>
            <FCell value={event.pax != null ? event.pax : ''} label="MIN GTD" />
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
                <div style={{ fontSize: 12.5, marginBottom: 8 }}><b>{T2("Package")}:</b> {packageName}</div>
                {Object.keys(menuDiffByDept || {}).length === 0 ? (
                  <div style={{ fontSize: 12.5, fontStyle: "italic", color: "#555" }}>{T2("Menu matches the package exactly — no swaps or add-ons.")}</div>
                ) : (
                  SALES_DEPTS.map(function(d){
                    var diff = menuDiffByDept && menuDiffByDept[d.id];
                    if (!diff) return null;
                    var meta = diff.kind ? DIFF_KIND_META[diff.kind] : null;
                    return (
                      <div key={d.id}>
                        {meta && (
                          <>
                            <SubHead>{d.name} <span style={{ fontWeight: 400, fontStyle: "italic" }}>({T2(meta.label)})</span></SubHead>
                            {sortedByVeg(diff.added, dishSectionOrder).map(function(n){ return <Bullet key={'a' + n} dot={false}><span style={{ color: "#1C7A3D", fontWeight: 700 }}>+ {n}</span></Bullet>; })}
                            {sortedByVeg(diff.removed, dishSectionOrder).map(function(n){ return <Bullet key={'r' + n} dot={false}><span style={{ color: "#B3281F", fontWeight: 700 }}>− {n}</span></Bullet>; })}
                          </>
                        )}
                        {/* A whole catalogue section added just for this event — never
                            part of the package, so it's its own block, not a "Swap"/
                            "Add-on" diff line: the kitchen needs to know a NEW SECTION
                            exists, not just that some extra dishes got added somewhere. */}
                        {(diff.newSections || []).map(function(sec){
                          return (
                            <div key={sec.name}>
                              <SubHead>{d.name} <span style={{ fontWeight: 400, fontStyle: "italic" }}>({T2("New section")}: {sec.name})</span></SubHead>
                              {sortedByVeg(sec.dishes, dishSectionOrder).map(function(n){ return <Bullet key={'n' + n} dot={false}><span style={{ color: "#1C7A3D", fontWeight: 700 }}>+ {n}</span></Bullet>; })}
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
                {SALES_DEPTS.map(function(d){
                  var names = (itemsByDept && itemsByDept[d.id]) || [];
                  if (names.length === 0) return null;
                  var sorted = sortedByVeg(names, dishSectionOrder);
                  var lastSection; // undefined sentinel — first item always re-evaluates
                  return (
                    <div key={d.id}>
                      <SubHead>{d.name}</SubHead>
                      {sorted.map(function(n){
                        var sec = (dishSectionName && dishSectionName[n]) || null;
                        var isNewSection = sec !== lastSection;
                        lastSection = sec;
                        return (
                          <React.Fragment key={n}>
                            {isNewSection && sec && <SectionSubHead>{sec}</SectionSubHead>}
                            <Bullet>{n}</Bullet>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  );
                })}
                {SALES_DEPTS.every(function(d){ return !(itemsByDept && itemsByDept[d.id] && itemsByDept[d.id].length); }) && (
                  <div style={{ fontSize: 12.5, fontStyle: "italic", color: "#555" }}>{T2("No items selected yet.")}</div>
                )}
              </div>
            )}
          </div>

          <div className="fp-print-col-right" style={{ padding: "14px 16px" }}>
            <ColTitle>{T2("F&B and Banquet Informations")}</ColTitle>
            {bullets.length === 0 ? (
              <div style={{ fontSize: 12.5, fontStyle: "italic", color: "#555" }}>{T2("Nothing recorded yet.")}</div>
            ) : (
              bullets.map(function(b, i){ return <Bullet key={i}>{b}</Bullet>; })
            )}
          </div>
        </div>

        {/* ── Layout information — stage/mandap placement, entry & exit, seating
            plan, decor zones, parking. Free text, can run long (the Notes tab
            gives it a 6-row box), so it gets its own full-width section rather
            than being squeezed into a one-line bullet. ── */}
        {fp && fp.layout_info && fp.layout_info.trim() && (
          <div style={{ border: "2px solid #000", borderTop: "none", padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "#555", marginBottom: 6 }}>{T2("LAYOUT INFORMATION")}</div>
            <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{fp.layout_info}</div>
          </div>
        )}

        {/* ── Sign-off strip — Board to Read / Attn Chef / Checked-Approved-Circulated ── */}
        <div style={{ border: "2px solid #000", borderTop: "none" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #000", minHeight: 54 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555", marginBottom: 4 }}>{T2("BOARD TO READ")}</div>
          </div>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #000", minHeight: 54 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555", marginBottom: 4 }}>{T2("ATTN CHEF")}</div>
            {attnChefLines.length > 1 ? (
              attnChefLines.map(function(line, i){ return <Bullet key={i}><span style={{ color: "#B3281F", fontWeight: 600 }}>{line}</span></Bullet>; })
            ) : attnChefLines.length === 1 ? (
              <div style={{ fontSize: 12.5, color: "#B3281F", fontWeight: 600 }}>{attnChefLines[0]}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", padding: "10px 16px", gap: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555", flex: "1 1 220px" }}>{T2("PROSPECTUS CHECKED / APPROVED / CIRCULATED")}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555" }}>{T2("MGR")}: {mgrName || '_______________'}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555" }}>{T2("Date")}: {prettyDate(localDateStr(new Date()))}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default FunctionPlanPrintView;
