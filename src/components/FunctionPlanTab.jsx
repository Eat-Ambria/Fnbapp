// Ambria FnB — Function Plan (FP) form
// V91: restyled onto the Kitchen Hub design system (K tokens, Icon set) with
// per-section on/off switches — Room Info, each equipment item and Drivers
// Food collapse to a bare header until switched on. Two fixed columns (Food
// Preference + Timings on the left; Room Info + Equipment + Drivers Food on
// the right), matching the approved mockup layout. Autosaves per field on
// blur, same pattern as production_plans elsewhere in the app.
// Place in: src/components/FunctionPlanTab.jsx

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { K } from '../utils/theme.js';
import { Icon, KButton, KBanner } from './KitchenUI.jsx';

var SPICE_LEVELS = [
  { id: 'mild',   label: 'Mild',   icon: '🌶️' },
  { id: 'normal', label: 'Normal', icon: '🌶️🌶️' },
  { id: 'spicy',  label: 'Spicy',  icon: '🌶️🌶️🌶️' },
];

var SWEETNESS_LEVELS = [
  { id: 'less_sweet', label: 'Less Sweet' },
  { id: 'normal',      label: 'Normal' },
];

var OIL_LEVELS = [
  { id: 'less_oil',   label: 'Less Oil' },
  { id: 'normal',      label: 'Normal' },
  { id: 'extra_ghee', label: 'Extra Ghee' },
];

// Free-text in practice, but kept as a fixed dropdown so Kitchen gets a
// consistent value to scan for rather than whatever spelling/language sales
// happens to type ("Marwari" vs "Marwadi" etc.).
var COMMUNITY_OPTIONS = [
  'Punjabi', 'Marwadi', 'Baniya', 'Jain', 'Sindhi', 'Bengali', 'Gujarati',
  'South Indian', 'Rajasthani', 'UP / Bihari', 'Himachali', 'Other',
];

// The flat list of every timing field — order here doesn't drive the
// Timings panel's layout (see TIME_FIELD_GROUPS below for that); this is
// what FunctionPlanPrintView's bullet summary and saveFPField's column
// lookup iterate.
var TIME_FIELDS = [
  { id: 'function_start_time', label: 'Function start' },
  { id: 'chaat_time',       label: 'Chaat' },
  { id: 'assembly_time',    label: 'Assembly' },
  { id: 'snacks_time',      label: 'Snacks' },
  { id: 'baarat_time',      label: 'Baarat' },
  { id: 'main_course_time', label: 'Main course' },
  { id: 'jaimala_time',     label: 'Jaimala' },
  { id: 'windup_time',      label: 'Wind-up' },
  { id: 'phera_time',       label: 'Phera' },
  { id: 'chaat_end_time',   label: 'Chaat end' },
  { id: 'snacks_end_time',  label: 'Snacks end' },
  { id: 'live_start_time',  label: 'Live start' },
  { id: 'live_end_time',    label: 'Live end' },
  { id: 'valet_start_time', label: 'Valet start' },
  { id: 'valet_end_time',   label: 'Valet end' },
];

// How the Timings panel actually lays its rows out: a start/end pair shares
// one row instead of landing on two separate, unrelated rows. Built by
// referencing TIME_FIELDS' ids rather than replacing that list, since
// FunctionPlanPrintView's bullet summary still reads the flat list.
//
// Order is deliberate, row-major into the 2-col grid below, pairing each
// kitchen/service milestone with the ceremony step it's timed around rather
// than two unrelated columns: function start bookends with wind-up, then
// assembly/chaat, snacks/baarat, main course/jaimala, live/phera — the
// actual sequence of a wedding function from start to finish. Every
// start/end range (Chaat, Snacks, Live) is kept in the LEFT slot of its row
// on purpose: a grid column's width is set by the widest row in that whole
// column, so ranges landing in both columns at once (rather than only the
// left) forces both columns wide and overflows the panel.
var TIME_FIELD_GROUPS = [
  { label: 'Function start', start: 'function_start_time' },
  { label: 'Wind-up',        start: 'windup_time' },
  { label: 'Chaat',          start: 'chaat_time',      end: 'chaat_end_time' },
  { label: 'Assembly',       start: 'assembly_time' },
  { label: 'Snacks',         start: 'snacks_time',     end: 'snacks_end_time' },
  { label: 'Baarat',         start: 'baarat_time' },
  { label: 'Main course',    start: 'main_course_time' },
  { label: 'Jaimala',        start: 'jaimala_time' },
  { label: 'Live',           start: 'live_start_time', end: 'live_end_time' },
  { label: 'Phera',          start: 'phera_time' },
  { label: 'Valet',          start: 'valet_start_time', end: 'valet_end_time' },
];

var EQUIP_FIELDS = [
  { id: 'fan',    label: 'Fan',    icon: '🌀', iconName: 'fan' },
  { id: 'cooler', label: 'Cooler', icon: '❄️', iconName: 'snowflake' },
  { id: 'heater', label: 'Heater', icon: '🔥', iconName: 'flame' },
];

// The value is stored as a plain "07:30 PM" string (same convention
// Dashboard's event Time field already uses). Native <input type="time">
// renders per browser/OS locale — often 24h, with no HTML attribute to force
// 12h — so it can't guarantee the 12h display this form needs; a custom pill
// is the only way to do that. This one is just a free-typed hour + free-typed
// minute (no forced step) with a single AM/PM tap, not three dropdown lists.
function parseTime12(v) {
  var m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((v || '').trim());
  if (!m) return { hour: '', min: '', ampm: '' };
  return { hour: String(parseInt(m[1], 10)), min: m[2], ampm: m[3].toUpperCase() };
}
function TimeInput12({ value, onCommit }) {
  var parsed = parseTime12(value);
  var [hour, setHour] = useState(parsed.hour);
  var [min, setMin] = useState(parsed.min);
  var [ampm, setAmpm] = useState(parsed.ampm || 'AM');
  useEffect(function(){
    var p = parseTime12(value);
    setHour(p.hour); setMin(p.min); setAmpm(p.ampm || 'AM');
  }, [value]);

  function commit(h, m, ap) {
    if (!h && !m) { onCommit(null); return; }
    if (!h || !m) return; // incomplete — wait for the other field
    onCommit(h.padStart(2, '0') + ':' + m.padStart(2, '0') + ' ' + ap);
  }
  function onHourBlur() {
    var h = hour === '' ? '' : String(Math.min(12, Math.max(1, parseInt(hour, 10) || 12)));
    setHour(h);
    commit(h, min, ampm);
  }
  function onMinBlur() {
    var m = min === '' ? '' : String(Math.min(59, Math.max(0, parseInt(min, 10) || 0))).padStart(2, '0');
    setMin(m);
    commit(hour, m, ampm);
  }
  var fieldStyle = { border: "none", background: "transparent", padding: "7px 2px", fontSize: 13.5, fontWeight: 600,
    color: K.text, width: 22, textAlign: "center", outline: "none", fontFamily: "inherit" };
  function ampmBtn(v) {
    var on = ampm === v;
    return (
      <button type="button" key={v}
        onClick={function(){ setAmpm(v); commit(hour, min, v); }}
        style={{ border: "none", background: on ? K.brand : "transparent", color: on ? "#fff" : K.textMuted,
          fontSize: 10.5, fontWeight: 700, padding: "4px 7px", borderRadius: K.rSm - 2, cursor: "pointer", lineHeight: 1 }}>
        {v}
      </button>
    );
  }
  return (
    <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid " + K.line, borderRadius: K.rSm,
      background: K.surfaceAlt, flexShrink: 0, paddingRight: 3 }}>
      <input value={hour} onChange={function(e){ setHour(e.target.value.replace(/\D/g, '').slice(0, 2)); }}
        onBlur={onHourBlur} placeholder="--" style={fieldStyle} />
      <span style={{ color: K.textFaint, fontSize: 12 }}>:</span>
      <input value={min} onChange={function(e){ setMin(e.target.value.replace(/\D/g, '').slice(0, 2)); }}
        onBlur={onMinBlur} placeholder="--" style={fieldStyle} />
      <span style={{ display: "inline-flex", gap: 1, marginLeft: 4, borderLeft: "1px solid " + K.line, paddingLeft: 3 }}>
        {['AM', 'PM'].map(ampmBtn)}
      </span>
    </div>
  );
}

// Small on/off switch — Room Info, each equipment item, and Drivers Food each
// collapse their body when off, rather than showing empty fields.
function Switch({ on, onChange, title }) {
  return (
    <button type="button" onClick={function(){ onChange(!on); }} title={title}
      style={{
        position: "relative", width: 38, height: 22, borderRadius: 999, border: "none", padding: 0, cursor: "pointer",
        background: on ? K.brand : K.lineStrong, transition: "background .18s ease", flexShrink: 0,
      }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(17,28,51,.3)", transition: "left .18s ease",
      }} />
    </button>
  );
}

// Card shell matching KPanel's chrome, but with a per-instance badge colour —
// this page uses a different tone per section (green food pref, blue timings,
// purple room, teal equipment, amber drivers) so they scan at a glance, which
// KPanel's fixed accent-blue badge does not support.
function Panel({ icon, badgeBg, badgeColor, title, right, children }) {
  return (
    <div style={{ backgroundColor: K.surface, border: "1px solid " + K.line, borderRadius: K.rLg, boxShadow: K.shadowCard, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 20px", borderBottom: "1px solid " + K.lineSoft, flexWrap: "wrap" }}>
        <span style={{ width: 30, height: 30, borderRadius: K.rSm, background: badgeBg, color: badgeColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={icon} size={16} strokeWidth={1.9} />
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: K.text, letterSpacing: "-.1px" }}>{title}</span>
        {right && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>{right}</div>}
      </div>
      <div style={{ padding: "18px 20px 20px" }}>{children}</div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 12.5, fontWeight: 700, color: K.text, marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>{children}</div>;
}

// Shared single-select pill row — Spice tolerance, Sweetness tolerance and
// Oil preference all pick one of a short fixed list the same way.
function PillGroup({ options, value, onSelect, style, t }) {
  var tr = t || function(s){ return s; };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", ...style }}>
      {options.map(function(o){
        var isActive = value === o.id;
        return (
          <button key={o.id} type="button" onClick={function(){ onSelect(isActive ? null : o.id); }}
            style={{ padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: isActive ? 700 : 600,
              background: isActive ? K.brand : K.surface, color: isActive ? "#fff" : K.textBody,
              border: "1px solid " + (isActive ? K.brand : K.line), cursor: "pointer",
              boxShadow: isActive ? "0 3px 10px rgba(28,61,43,.22)" : "none" }}>
            {o.icon ? o.icon + ' ' : ''}{tr(o.label)}
          </button>
        );
      })}
    </div>
  );
}

var inputStyle = { fontFamily: "inherit", fontSize: 13.5, color: K.text, border: "1px solid " + K.line, borderRadius: K.rSm, background: K.surfaceAlt, padding: "9px 11px", outline: "none" };

// Complimentary-plate count and extra-plate rate straight from the LMS
// contract, keyed by whichever detail-row schema this event came from
// (venue: fiscd_*, catering: chcd_*). LMS stores the extra-plate rate at
// half its real value — doubled here so this always shows the true rate.
function getLmsPlateInfo(event) {
  var raw = event && event.lms_raw;
  if (!raw || String((event && event.id) || '').indexOf('LMS-') !== 0) return null;
  var isCatering = event.lms_source === 'catering';
  var compRaw = isCatering ? raw.chcd_freepax : raw.fiscd_free_pax_no;
  var rateRaw = isCatering ? raw.chcd_extra_plate : raw.fiscd_extra_plate_charge;
  var comp = (compRaw !== null && compRaw !== undefined && compRaw !== '') ? Number(compRaw) : null;
  var rate = (rateRaw !== null && rateRaw !== undefined && rateRaw !== '') ? Number(rateRaw) : null;
  if ((comp == null || isNaN(comp)) && (rate == null || isNaN(rate))) return null;
  return {
    comp: (comp != null && !isNaN(comp)) ? comp : null,
    rateFull: (rate != null && !isNaN(rate)) ? rate * 2 : null,
  };
}

export function FunctionPlanTab({ T2, fp, event, onSaveField, onOpenPrint, locked, onRequestLock, onRequestUnlock }) {
  var [drafts, setDrafts] = useState({});
  useEffect(function(){ setDrafts({}); }, [fp && fp.event_id]);
  var [showHistory, setShowHistory] = useState(false);
  var fpHistory = (fp && Array.isArray(fp.fp_history)) ? fp.fp_history : [];

  function val(field) {
    if (drafts[field] !== undefined) return drafts[field];
    return (fp && fp[field] != null) ? fp[field] : '';
  }
  function onChangeField(field, v) {
    setDrafts(function(p){ return { ...p, [field]: v }; });
  }

  // ── Guest signature — canvas-drawn, same approach as KitchenHub's chef
  // completion signature: stroke to a <canvas>, capture it as a PNG data URL
  // once the guest is happy with it, store that string directly on the FP
  // row. Once saved it renders as a plain image (nothing left to draw on)
  // until "Re-sign" clears the saved value and swaps the image back out for
  // a blank canvas.
  var sigCanvasRef = useRef(null);
  var sigDrawingRef = useRef(false);
  var [sigHasStrokes, setSigHasStrokes] = useState(false);
  function sigCtx() {
    var c = sigCanvasRef.current; if (!c) return null;
    var ctx = c.getContext('2d');
    ctx.strokeStyle = K.text; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    return ctx;
  }
  function sigPos(e, c) {
    var r = c.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) };
  }
  function sigStart(e) {
    e.preventDefault();
    var c = sigCanvasRef.current; if (!c) return;
    sigDrawingRef.current = true;
    var ctx = sigCtx(); if (!ctx) return;
    var p = sigPos(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function sigMove(e) {
    if (!sigDrawingRef.current) return;
    e.preventDefault();
    var c = sigCanvasRef.current; if (!c) return;
    var ctx = sigCtx(); if (!ctx) return;
    var p = sigPos(e, c); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function sigEnd() {
    if (!sigDrawingRef.current) return;
    sigDrawingRef.current = false;
    setSigHasStrokes(true);
  }
  function sigClear() {
    var c = sigCanvasRef.current;
    if (c) { var ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); }
    setSigHasStrokes(false);
  }
  function saveSignature() {
    var c = sigCanvasRef.current; if (!c) return;
    onSaveField('guest_signature', c.toDataURL('image/png'));
    commitText('guest_signature_name');
  }
  function reSign() {
    onSaveField('guest_signature', null);
    setSigHasStrokes(false);
  }
  function commitText(field) {
    if (drafts[field] === undefined) return;
    var v = drafts[field];
    onSaveField(field, (v && v.trim && v.trim()) || null);
  }
  function commitNumber(field) {
    if (drafts[field] === undefined) return;
    var raw = drafts[field];
    var n = raw === '' ? null : parseInt(raw, 10);
    onSaveField(field, (n == null || isNaN(n)) ? null : n);
  }
  function commitDecimal(field) {
    if (drafts[field] === undefined) return;
    var raw = drafts[field];
    var n = raw === '' ? null : parseFloat(raw);
    onSaveField(field, (n == null || isNaN(n)) ? null : n);
  }

  var roomOn = !!(fp && fp.room_info_enabled);
  var driversOn = !!(fp && fp.drivers_food_required);
  var lmsPlate = getLmsPlateInfo(event);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: K.textMuted }}>{T2("Feeds the printable Function Plan, and dietary notes flow into Kitchen Hub's existing special-instructions flags.")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <KButton variant="ghost" icon="clock" onClick={function(){ setShowHistory(true); }}>{T2("History")}{fpHistory.length > 0 ? " (" + fpHistory.length + ")" : ""}</KButton>
          <KButton variant="brand" icon="fileText" onClick={onOpenPrint}>{T2("View / Print FP")}</KButton>
          {!locked && <KButton variant="accent" icon="lock" onClick={onRequestLock}>{T2("Mark as Final")}</KButton>}
        </div>
      </div>

      {/* ── Change history — every FP field save, lock/unlock, and menu
          add/remove appends a timestamped entry here (see saveFPField /
          writeFpLockState / logFpHistory in EventMenuBuilderView.jsx). This
          exists because the "last-minute change" notification Kitchen gets
          on an unlock is transient — once it's dismissed there was nowhere
          to go back and see exactly what changed, or who changed it. */}
      {showHistory && createPortal(
        // Portalled to document.body — this tab is mounted deep inside
        // BookedFunctionsView -> EventMenuBuilderView, and this app has more
        // than one ancestor along that path with its own CSS transform
        // (ripple effects, slide-in panels), any of which becomes the
        // containing block for a plain position:fixed modal and can clip or
        // mis-stack it regardless of z-index — same root cause already fixed
        // this session for the FP print view and the Reset PIN modal.
        <div onClick={function(){ setShowHistory(false); }} style={{ position: "fixed", inset: 0, zIndex: 10050, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={function(e){ e.stopPropagation(); }} style={{ background: K.surface, borderRadius: 16, padding: "20px 22px", maxWidth: 540, width: "100%", maxHeight: "78vh", display: "flex", flexDirection: "column", boxShadow: K.shadowLift, border: "1px solid " + K.line }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: K.text }}>{T2("Change History")}</div>
              <button type="button" onClick={function(){ setShowHistory(false); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: K.textMuted, display: "flex", padding: 4 }}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {fpHistory.length === 0 ? (
                <div style={{ fontSize: 13, color: K.textFaint, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>{T2("No changes recorded yet.")}</div>
              ) : fpHistory.slice().reverse().map(function(h, i){
                return (
                  <div key={i} style={{ padding: "10px 13px", borderRadius: 10, background: K.surfaceAlt, border: "1px solid " + K.lineSoft }}>
                    <div style={{ fontSize: 13, color: K.text, fontWeight: 600 }}>{h.summary}</div>
                    <div style={{ fontSize: 11, color: K.textFaint, marginTop: 4 }}>
                      {h.at ? new Date(h.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ""}{h.by ? " · " + h.by : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {locked && (
        <KBanner toneName="brand" icon="lock" style={{ marginBottom: 16 }}
          title={T2("Locked — sent to Kitchen")}
          sub={(fp && fp.locked_by ? (fp.locked_by + ' · ') : '') + (fp && fp.locked_at ? new Date(fp.locked_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '')}
          right={<KButton variant="ghost" icon="lock" onClick={onRequestUnlock}>{T2("Unlock to edit")}</KButton>} />
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", pointerEvents: locked ? "none" : "auto", opacity: locked ? 0.55 : 1 }}>
      <div style={{ flex: "1.2 1 480px", display: "flex", flexDirection: "column", gap: 16, minWidth: 360 }}>

        {/* ── Food Preference (+ Corkage) ── */}
        <Panel icon="plate" badgeBg={K.okBg} badgeColor={K.ok} title={T2("Food Preference")}>
          <div style={{ marginBottom: 20 }}>
            <FPTextArea label={T2("Guest Preference")} rows={3}
              placeholder={T2("e.g. mostly non-veg, 2 Jain plates, no beef/pork…")}
              value={val('guest_preference')} onChange={function(v){ onChangeField('guest_preference', v); }} onBlur={function(){ commitText('guest_preference'); }} />
          </div>

          <FieldLabel>{T2("Spice tolerance")}</FieldLabel>
          <PillGroup t={T2} options={SPICE_LEVELS} value={fp && fp.spice_tolerance}
            onSelect={function(id){ onSaveField('spice_tolerance', id); }} style={{ marginBottom: 18 }} />

          <FieldLabel>{T2("Sweetness tolerance")}</FieldLabel>
          <PillGroup t={T2} options={SWEETNESS_LEVELS} value={fp && fp.sweetness_tolerance}
            onSelect={function(id){ onSaveField('sweetness_tolerance', id); }} style={{ marginBottom: 18 }} />

          <FieldLabel>{T2("Oil preference")}</FieldLabel>
          <PillGroup t={T2} options={OIL_LEVELS} value={fp && fp.oil_preference}
            onSelect={function(id){ onSaveField('oil_preference', id); }} style={{ marginBottom: 18 }} />

          <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, maxWidth: 260 }}>
            <FieldLabel>{T2("Community")}</FieldLabel>
            <select value={val('guest_community') || ''}
              onChange={function(e){ onSaveField('guest_community', e.target.value || null); }}
              style={{ ...inputStyle, width: "100%" }}>
              <option value="">{T2("— Select —")}</option>
              {COMMUNITY_OPTIONS.map(function(c){ return <option key={c} value={c}>{T2(c)}</option>; })}
            </select>
          </label>

          <div style={{ paddingTop: 16, borderTop: "1px solid " + K.lineSoft }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ color: K.brand, display: "flex" }}><Icon name="cup" size={15} strokeWidth={1.9} /></span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: K.text }}>{T2("Corkage")}</span>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: K.textMuted }}>{T2("Cost agreed")}</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={val('corkage_price')}
                  onChange={function(e){ onChangeField('corkage_price', e.target.value); }}
                  onBlur={function(){ commitDecimal('corkage_price'); }}
                  style={{ ...inputStyle, width: 110 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 200 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: K.textMuted }}>{T2("Details")}</span>
                <input type="text" value={val('corkage_details')}
                  placeholder={T2("e.g. 2 bottles whisky, client-supplied wine, no beer…")}
                  onChange={function(e){ onChangeField('corkage_details', e.target.value); }}
                  onBlur={function(){ commitText('corkage_details'); }}
                  style={{ ...inputStyle, width: "100%" }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 7, paddingBottom: 9, cursor: "pointer" }}>
                <input type="checkbox" checked={!!(fp && fp.corkage_liquor)}
                  onChange={function(e){ onSaveField('corkage_liquor', e.target.checked); }}
                  style={{ width: 16, height: 16, cursor: "pointer" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: K.textBody }}>{T2("Liquor being served")}</span>
              </label>
            </div>
          </div>
        </Panel>

        {/* ── Timings ── */}
        <Panel icon="clock" badgeBg={K.accentSoft} badgeColor={K.accent} title={T2("Timings")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 28px" }}>
            {TIME_FIELD_GROUPS.map(function(g, i){
              var isLastRow = i >= TIME_FIELD_GROUPS.length - (TIME_FIELD_GROUPS.length % 2 === 0 ? 2 : 1);
              return (
                <div key={g.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: isLastRow ? "none" : "1px solid " + K.lineSoft }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: K.textBody }}>{T2(g.label)}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <TimeInput12 value={val(g.start)} onCommit={function(v){ onSaveField(g.start, v); }} />
                    {g.end && (<>
                      <span style={{ fontSize: 11, color: K.textFaint }}>–</span>
                      <TimeInput12 value={val(g.end)} onCommit={function(v){ onSaveField(g.end, v); }} />
                    </>)}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

      </div>
      <div style={{ flex: "1 1 400px", display: "flex", flexDirection: "column", gap: 16, minWidth: 320 }}>

        {/* ── Room Info ── */}
        <Panel icon="home" badgeBg={K.idleBg} badgeColor={K.idle} title={T2("Room Info")}
          right={<>
            <span style={{ fontSize: 12, color: K.textFaint, fontWeight: 600 }}>{roomOn ? T2("On") : T2("Off")}</span>
            <Switch on={roomOn} onChange={function(v){ onSaveField('room_info_enabled', v); }} title={T2("Room info needed for this function?")} />
          </>}>
          {roomOn ? (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, marginBottom: 6 }}>{T2("Check-in")}</div>
                <TimeInput12 value={val('room_check_in')} onCommit={function(v){ onSaveField('room_check_in', v); }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, marginBottom: 6 }}>{T2("Check-out")}</div>
                <TimeInput12 value={val('room_check_out')} onCommit={function(v){ onSaveField('room_check_out', v); }} />
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: K.textMuted }}>{T2("Room count")}</span>
                <input type="number" min="0" inputMode="numeric" value={val('room_count')}
                  onChange={function(e){ onChangeField('room_count', e.target.value); }}
                  onBlur={function(){ commitNumber('room_count'); }}
                  style={{ ...inputStyle, width: 90 }} />
              </label>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: K.textFaint, fontStyle: "italic" }}>{T2("No rooms needed for this function.")}</div>
          )}
        </Panel>

        {/* ── Equipment Add-ons ── */}
        {(function(){
          var total = EQUIP_FIELDS.reduce(function(sum, f){
            var on = fp && fp[f.id + '_enabled'];
            var count = Number(fp && fp[f.id + '_count']) || 0;
            var price = Number(fp && fp[f.id + '_price']) || 0;
            return sum + (on ? count * price : 0);
          }, 0);
          return (
            <Panel icon="settings" badgeBg={K.tealBg} badgeColor={K.teal} title={T2("Equipment Add-ons")}
              right={total > 0 ? <span style={{ fontSize: 12, color: K.textFaint, fontWeight: 600 }}>₹{total.toLocaleString('en-IN')} {T2("total")}</span> : null}>
              {EQUIP_FIELDS.map(function(f, i){
                var on = !!(fp && fp[f.id + '_enabled']);
                var count = fp && fp[f.id + '_count'];
                var price = fp && fp[f.id + '_price'];
                var subtotal = on && count > 0 && price > 0 ? Number(count) * Number(price) : null;
                return (
                  <div key={f.id} style={{ borderTop: i > 0 ? "1px solid " + K.lineSoft : "none", marginTop: i > 0 ? 4 : 0, paddingTop: i > 0 ? 4 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
                      <span style={{ width: 32, height: 32, borderRadius: K.rSm, background: K.surfaceAlt, color: K.textMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon name={f.iconName} size={16} strokeWidth={1.8} />
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: K.text, flex: 1 }}>{T2(f.label)}</span>
                      <Switch on={on} onChange={function(v){ onSaveField(f.id + '_enabled', v); }} title={T2(f.label) + ' ' + T2('needed?')} />
                    </div>
                    {on && (
                      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 0 14px 44px" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: 9.5, color: K.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{T2("Count")}</span>
                          <input type="number" min="0" inputMode="numeric" value={val(f.id + '_count')}
                            onChange={function(e){ onChangeField(f.id + '_count', e.target.value); }}
                            onBlur={function(){ commitNumber(f.id + '_count'); }}
                            style={{ ...inputStyle, width: 64, padding: "7px 9px", fontSize: 13 }} />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: 9.5, color: K.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{T2("Price")}</span>
                          <input type="number" min="0" step="0.01" inputMode="decimal" value={val(f.id + '_price')}
                            onChange={function(e){ onChangeField(f.id + '_price', e.target.value); }}
                            onBlur={function(){ commitDecimal(f.id + '_price'); }}
                            style={{ ...inputStyle, width: 88, padding: "7px 9px", fontSize: 13 }} />
                        </label>
                        <div style={{ marginLeft: "auto", textAlign: "right" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: subtotal ? K.text : K.textFaint, fontVariantNumeric: "tabular-nums" }}>
                            {subtotal ? "₹" + subtotal.toLocaleString('en-IN') : "—"}
                          </div>
                          <div style={{ fontSize: 9.5, color: K.textFaint, fontWeight: 600 }}>{T2("subtotal")}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Panel>
          );
        })()}

        {/* ── Drivers Food ── */}
        <Panel icon="truck" badgeBg={K.warnBg} badgeColor={K.warn} title={T2("Drivers Food")}
          right={<>
            <span style={{ fontSize: 12, color: K.textFaint, fontWeight: 600 }}>{driversOn ? T2("On") : T2("Off")}</span>
            <Switch on={driversOn} onChange={function(v){ onSaveField('drivers_food_required', v); }} title={T2("Drivers food required?")} />
          </>}>
          {driversOn ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: K.textMuted }}>{T2("Count of people")}</span>
                <input type="number" min="0" inputMode="numeric" value={val('drivers_food_count')}
                  onChange={function(e){ onChangeField('drivers_food_count', e.target.value); }}
                  onBlur={function(){ commitNumber('drivers_food_count'); }}
                  style={{ ...inputStyle, width: 90 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: K.textMuted }}>{T2("Rate per plate")}</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={val('drivers_food_rate')}
                  onChange={function(e){ onChangeField('drivers_food_rate', e.target.value); }}
                  onBlur={function(){ commitDecimal('drivers_food_rate'); }}
                  style={{ ...inputStyle, width: 90 }} />
              </label>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, marginBottom: 6 }}>{T2("Coupon")}</div>
                <Switch on={!!(fp && fp.drivers_food_coupon)} onChange={function(v){ onSaveField('drivers_food_coupon', v); }} title={T2("Coupon issued?")} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: K.textFaint, fontStyle: "italic" }}>{T2("Not required for this function.")}</div>
          )}
        </Panel>

        {/* ── Operation Info ── */}
        <Panel icon="contact" badgeBg={K.accentSoft} badgeColor={K.accent} title={T2("Operation Info")}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 180px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: K.textMuted }}>{T2("Operation Manager Name")}</span>
              <input type="text" value={val('ops_manager_name')}
                onChange={function(e){ onChangeField('ops_manager_name', e.target.value); }}
                onBlur={function(){ commitText('ops_manager_name'); }}
                style={{ ...inputStyle, width: "100%" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 160px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: K.textMuted }}>{T2("Contact Number")}</span>
              <input type="tel" value={val('ops_manager_contact')}
                onChange={function(e){ onChangeField('ops_manager_contact', e.target.value); }}
                onBlur={function(){ commitText('ops_manager_contact'); }}
                style={{ ...inputStyle, width: "100%" }} />
            </label>
          </div>
        </Panel>

        {/* ── Extra Plate Info (from LMS) ── */}
        {lmsPlate && (
          <Panel icon="tag" badgeBg={K.infoBg} badgeColor={K.info} title={T2("Extra Plate Info")}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, marginBottom: 4 }}>{T2("Complimentary plates")}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: K.text, fontVariantNumeric: "tabular-nums" }}>
                  {lmsPlate.comp != null ? lmsPlate.comp : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, marginBottom: 4 }}>{T2("Extra plate rate")}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: K.text, fontVariantNumeric: "tabular-nums" }}>
                  {lmsPlate.rateFull != null ? "₹" + lmsPlate.rateFull.toLocaleString('en-IN') : "—"}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: K.textFaint }}>{T2("From the LMS contract. Extra-plate rate is doubled from LMS's stored value.")}</div>
          </Panel>
        )}

      </div>
      </div>

      {/* ── Notes — full width ── */}
      <div style={{ marginTop: 16 }}>
        <Panel icon="fileText" badgeBg={K.surfaceAlt} badgeColor={K.textMuted} title={T2("Notes")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            <FPTextArea label={T2("Allergies / dietary restrictions")}
              placeholder={T2("e.g. nut allergy for 2 guests, no onion-garlic for the bride's family, gluten-free option needed…")}
              value={val('allergies')} onChange={function(v){ onChangeField('allergies', v); }} onBlur={function(){ commitText('allergies'); }} />
            <FPTextArea label={T2("Service style notes")}
              placeholder={T2("e.g. plated starters, live chaat counter, cake cutting at 9pm…")}
              value={val('service_notes')} onChange={function(v){ onChangeField('service_notes', v); }} onBlur={function(){ commitText('service_notes'); }} />
            <FPTextArea label={T2("General notes")}
              placeholder={T2("Anything else the kitchen/service team should know…")}
              value={val('general_notes')} onChange={function(v){ onChangeField('general_notes', v); }} onBlur={function(){ commitText('general_notes'); }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <FPTextArea label={T2("Layout information")} rows={6}
              placeholder={T2("e.g. stage/mandap placement, entry & exit points, seating plan, decor zones, parking instructions…")}
              value={val('layout_info')} onChange={function(v){ onChangeField('layout_info', v); }} onBlur={function(){ commitText('layout_info'); }} />
          </div>
        </Panel>
      </div>

      {/* ── Guest Signature — full width, closing confirmation. Locked the
          same way as everything else above: once the FP is marked final,
          re-signing is blocked too, so a saved signature stays a record of
          what was actually agreed instead of something that can be redrawn
          after the fact. */}
      <div style={{ marginTop: 16, pointerEvents: locked ? "none" : "auto", opacity: locked ? 0.55 : 1 }}>
        <Panel icon="contact" badgeBg={K.okBg} badgeColor={K.ok} title={T2("Guest Signature")}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 240px", minWidth: 220 }}>
              <FieldLabel>{T2("Signed by")}</FieldLabel>
              <input type="text" value={val('guest_signature_name')}
                placeholder={T2("Guest's name")}
                onChange={function(e){ onChangeField('guest_signature_name', e.target.value); }}
                onBlur={function(){ commitText('guest_signature_name'); }}
                style={{ ...inputStyle, width: "100%", marginBottom: 12, boxSizing: "border-box" }} />
              <div style={{ fontSize: 11.5, color: K.textFaint, lineHeight: 1.5 }}>
                {T2("Confirms the details on this plan are correct as agreed with the guest.")}
              </div>
            </div>
            <div style={{ flex: "1 1 320px", minWidth: 300 }}>
              {fp && fp.guest_signature ? (
                <div>
                  <div style={{ border: "2px solid " + K.okBorder, borderRadius: K.rSm, overflow: "hidden", background: "#fff" }}>
                    <img src={fp.guest_signature} alt={T2("Guest signature")}
                      style={{ display: "block", width: "100%", height: 120, objectFit: "contain" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 11.5, color: K.ok, fontWeight: 700 }}>✓ {T2("Signed")}</span>
                    <button type="button" onClick={reSign}
                      style={{ padding: "5px 13px", borderRadius: K.rSm, background: K.surfaceAlt, border: "1px solid " + K.line, color: K.textMuted, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                      {T2("Re-sign")}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ border: "2px solid " + (sigHasStrokes ? K.okBorder : K.line), borderRadius: K.rSm, overflow: "hidden", background: "#fff", touchAction: "none" }}>
                    <canvas ref={sigCanvasRef} width={380} height={120}
                      style={{ display: "block", width: "100%", height: 120, cursor: "crosshair", touchAction: "none" }}
                      onMouseDown={sigStart} onMouseMove={sigMove} onMouseUp={sigEnd} onMouseLeave={sigEnd}
                      onTouchStart={sigStart} onTouchMove={sigMove} onTouchEnd={sigEnd} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 11.5, color: K.textFaint }}>{sigHasStrokes ? T2("Ready to save") : T2("Sign above")}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={sigClear}
                        style={{ padding: "5px 13px", borderRadius: K.rSm, background: K.surfaceAlt, border: "1px solid " + K.line, color: K.textMuted, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                        {T2("Clear")}
                      </button>
                      <button type="button" disabled={!sigHasStrokes} onClick={saveSignature}
                        style={{ padding: "5px 15px", borderRadius: K.rSm, background: sigHasStrokes ? K.brand : K.lineStrong, border: "none", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: sigHasStrokes ? "pointer" : "not-allowed" }}>
                        {T2("Save signature")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FPTextArea({ label, placeholder, value, onChange, onBlur, rows }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea value={value} placeholder={placeholder}
        onChange={function(e){ onChange(e.target.value); }}
        onBlur={onBlur}
        rows={rows || 4}
        style={{ ...inputStyle, width: "100%", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", minHeight: rows ? rows * 24 : 96, lineHeight: 1.5 }} />
    </div>
  );
}

export { TIME_FIELDS, EQUIP_FIELDS, getLmsPlateInfo, SPICE_LEVELS, SWEETNESS_LEVELS, OIL_LEVELS, COMMUNITY_OPTIONS };
export default FunctionPlanTab;
