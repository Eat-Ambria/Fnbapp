// Ambria FnB — Function Plan printable summary
// V91: redesigned onto the classic Ambria prospectus sheet layout — a bordered
// header grid (Date/Function/Guest/Address/Rate/...), two boxed columns
// (Customized Menu | F&B and Banquet Informations), and bottom sign-off boxes
// (Board to Read / Attn Chef / Prospectus checked-approved-circulated).
// Fields this app doesn't capture digitally (Contact No., Mode of Payment,
// Rate, Advance, Direct/Repeat Guest, Board to Read, sign-off) print as blank
// ruled boxes, same as the paper form — meant to be filled by hand.
// Place in: src/components/FunctionPlanPrintView.jsx

import React, { useEffect } from "react";
import { C } from '../data/constants.js';
import { localDateStr } from '../utils/helpers.js';
import { SALES_DEPTS, DEPT_CONFIGS } from '../data/salesConfig.js';
import { TIME_FIELDS, EQUIP_FIELDS, getLmsPlateInfo } from './FunctionPlanTab.jsx';

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
  return <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 10, marginBottom: 4 }}>{children}</div>;
}

function Bullet({ children }) {
  return <div style={{ fontSize: 12.5, padding: "2px 0 2px 14px", position: "relative" }}>
    <span style={{ position: "absolute", left: 0 }}>•</span>{children}
  </div>;
}

export function FunctionPlanPrintView({ event, fp, itemsByDept, packageName, menuDiffByDept, configsByDept, onClose, T2 }) {
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
    var foodPrefParts = [];
    if (fp.veg_count != null) foodPrefParts.push('Veg ' + fp.veg_count);
    if (fp.nonveg_count != null) foodPrefParts.push('Non-veg ' + fp.nonveg_count);
    if (fp.jain_count != null) foodPrefParts.push('Jain ' + fp.jain_count);
    if (fp.egg_count != null) foodPrefParts.push('Egg ' + fp.egg_count);
    if (foodPrefParts.length) bullets.push('Food preference — ' + foodPrefParts.join(', '));
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

  var attnChefText = [fp && fp.allergies, fp && fp.service_notes, fp && fp.general_notes].filter(Boolean).join('\n');

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#fff", overflowY: "auto" }}>
      <style>{"@media print { .fp-no-print { display: none !important; } }"}</style>
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
            <FCell value={event.date || ''} label="DATE" />
            <FCell value={dayNameFor(event.date)} label="DAY" />
            <FCell value={functionTypeLabel} label="FUNCTION" last />
          </FRow>
          <FRow>
            <FCell value={event.guest || ''} label="GUEST NAME" />
            <FCell value={event.venue || ''} label="ADDRESS" />
            <FCell value={(event.lms_raw && event.lms_raw.fisc_client_mobile) || ''} label="CONTACT NO." last />
          </FRow>
          <FRow>
            <FCell value={event.pax != null ? event.pax : ''} label="MIN GTD" />
            <FCell value="" label="MAX GTD" />
            <FCell value="" label="MODE OF PAYMENT" />
            <FCell value="" label="RATE" />
            <FCell value="" label="ADV & ANY" last />
          </FRow>
          <FRow thick>
            <FCell value="" label="DIRECT" />
            <FCell value="" label="REPEAT GUEST" last />
          </FRow>
        </div>

        {/* ── Two boxed columns — Customized Menu | F&B and Banquet Informations ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "2px solid #000", borderTop: "none" }}>
          <div style={{ padding: "14px 16px", borderRight: "2px solid #000" }}>
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
                    var meta = DIFF_KIND_META[diff.kind];
                    return (
                      <div key={d.id} style={{ breakInside: "avoid" }}>
                        <SubHead>{d.name} <span style={{ fontWeight: 400, fontStyle: "italic" }}>({T2(meta.label)})</span></SubHead>
                        {diff.added.map(function(n){ return <Bullet key={'a' + n}><span style={{ color: "#1C7A3D", fontWeight: 700 }}>+</span> {n}</Bullet>; })}
                        {diff.removed.map(function(n){ return <Bullet key={'r' + n}><span style={{ color: "#B3281F", fontWeight: 700 }}>−</span> {n}</Bullet>; })}
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
                  return (
                    <div key={d.id} style={{ breakInside: "avoid" }}>
                      <SubHead>{d.name}</SubHead>
                      {names.map(function(n){ return <Bullet key={n}>{n}</Bullet>; })}
                    </div>
                  );
                })}
                {SALES_DEPTS.every(function(d){ return !(itemsByDept && itemsByDept[d.id] && itemsByDept[d.id].length); }) && (
                  <div style={{ fontSize: 12.5, fontStyle: "italic", color: "#555" }}>{T2("No items selected yet.")}</div>
                )}
              </div>
            )}
          </div>

          <div style={{ padding: "14px 16px" }}>
            <ColTitle>{T2("F&B and Banquet Informations")}</ColTitle>
            {bullets.length === 0 ? (
              <div style={{ fontSize: 12.5, fontStyle: "italic", color: "#555" }}>{T2("Nothing recorded yet.")}</div>
            ) : (
              bullets.map(function(b, i){ return <Bullet key={i}>{b}</Bullet>; })
            )}
          </div>
        </div>

        {/* ── Sign-off strip — Board to Read / Attn Chef / Checked-Approved-Circulated ── */}
        <div style={{ border: "2px solid #000", borderTop: "none" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #000", minHeight: 54 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555", marginBottom: 4 }}>{T2("BOARD TO READ")}</div>
          </div>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #000", minHeight: 54 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555", marginBottom: 4 }}>{T2("ATTN CHEF")}</div>
            {attnChefText && <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{attnChefText}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", padding: "10px 16px", gap: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555", flex: "1 1 220px" }}>{T2("PROSPECTUS CHECKED / APPROVED / CIRCULATED")}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555" }}>{T2("MGR")}: {mgrName || '_______________'}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "#555" }}>{T2("Date")}: {localDateStr(new Date())}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FunctionPlanPrintView;
