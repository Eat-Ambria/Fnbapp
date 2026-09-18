// Ambria FnB — Function Plan (FP) form
// V78: captures food preference counts, spice tolerance, allergies, service style
// notes, and general notes for a booked function. Autosaves per field on blur,
// same pattern as production_plans elsewhere in the app.
// Place in: src/components/FunctionPlanTab.jsx

import React, { useState, useEffect } from "react";
import { C } from '../data/constants.js';

var SPICE_LEVELS = [
  { id: 'mild',        label: 'Mild',        icon: '🌶️' },
  { id: 'medium',       label: 'Medium',      icon: '🌶️🌶️' },
  { id: 'spicy',        label: 'Spicy',       icon: '🌶️🌶️🌶️' },
  { id: 'extra_spicy',  label: 'Extra Spicy', icon: '🔥' },
];

var TIME_FIELDS = [
  { id: 'snacks_time',   label: '🍟 Snacks' },
  { id: 'baarat_time',   label: '🎺 Baarat' },
  { id: 'assembly_time', label: '👥 Assembly' },
  { id: 'phera_time',    label: '🔥 Phera' },
  { id: 'chaat_time',    label: '🌮 Chaat' },
  { id: 'windup_time',   label: '🧹 Wind-up' },
];

var EQUIP_FIELDS = [
  { id: 'fan',    label: 'Fan',    icon: '🌀' },
  { id: 'cooler', label: 'Cooler', icon: '❄️' },
  { id: 'heater', label: 'Heater', icon: '🔥' },
];

// Native <input type="time"> renders per browser/OS locale (often 24h, with
// no HTML attribute to force 12h) — a custom hour/minute/AM-PM picker is the
// only way to guarantee 12h display, and it stores the value as a plain
// "07:30 PM" string, same convention Dashboard's event Time field already
// uses.
function parseTime12(v) {
  var m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((v || '').trim());
  if (!m) return { hour: '', min: '', ampm: '' };
  return { hour: m[1].padStart(2, '0'), min: m[2], ampm: m[3].toUpperCase() };
}
var TIME12_HOURS = Array.from({ length: 12 }, function(_, i){ return String(i + 1).padStart(2, '0'); });
var TIME12_MINS = Array.from({ length: 12 }, function(_, i){ return String(i * 5).padStart(2, '0'); });
function YesNoToggle({ value, onChange, T2 }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(function(o){
        var isActive = value === o.v;
        return (
          <button key={o.l} type="button" onClick={function(){ onChange(o.v); }}
            style={{ padding: "6px 14px", borderRadius: 16, fontSize: 12, fontWeight: isActive ? 700 : 500,
              background: isActive ? C.wine : C.surface, color: isActive ? "#fff" : C.text,
              border: "1px solid " + (isActive ? C.wine : C.border), cursor: "pointer" }}>
            {T2(o.l)}
          </button>
        );
      })}
    </div>
  );
}

function TimeInput12({ value, onCommit }) {
  var t = parseTime12(value);
  function update(part, v) {
    var next = { hour: t.hour, min: t.min, ampm: t.ampm };
    next[part] = v;
    onCommit(next.hour && next.min && next.ampm ? (next.hour + ':' + next.min + ' ' + next.ampm) : null);
  }
  var selStyle = { padding: "7px 6px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text };
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <select value={t.hour} onChange={function(e){ update('hour', e.target.value); }} style={selStyle}>
        <option value="">--</option>
        {TIME12_HOURS.map(function(h){ return <option key={h} value={h}>{h}</option>; })}
      </select>
      <select value={t.min} onChange={function(e){ update('min', e.target.value); }} style={selStyle}>
        <option value="">--</option>
        {TIME12_MINS.map(function(m){ return <option key={m} value={m}>{m}</option>; })}
      </select>
      <select value={t.ampm} onChange={function(e){ update('ampm', e.target.value); }} style={selStyle}>
        <option value="">--</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export function FunctionPlanTab({ T2, fp, onSaveField, onOpenPrint }) {
  var [drafts, setDrafts] = useState({});
  useEffect(function(){ setDrafts({}); }, [fp && fp.event_id]);

  function val(field) {
    if (drafts[field] !== undefined) return drafts[field];
    return (fp && fp[field] != null) ? fp[field] : '';
  }
  function onChangeField(field, v) {
    setDrafts(function(p){ return { ...p, [field]: v }; });
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

  var countFields = [
    { id: 'veg_count',    label: '🟢 ' + T2('Veg') },
    { id: 'nonveg_count', label: '🔴 ' + T2('Non-veg') },
    { id: 'jain_count',   label: '🟠 ' + T2('Jain') },
    { id: 'egg_count',    label: '🟡 ' + T2('Egg') },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: C.muted }}>{T2("Feeds the printable Function Plan, and dietary notes flow into Kitchen Hub's existing special-instructions flags.")}</div>
        <button onClick={onOpenPrint}
          style={{ padding: "8px 16px", borderRadius: 8, background: "#8A70C8", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          🖨 {T2("View / Print FP")}
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>{T2("Guest count by food preference")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {countFields.map(function(f){
            return (
              <label key={f.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: C.muted }}>{f.label}</span>
                <input type="number" min="0" inputMode="numeric"
                  value={val(f.id)}
                  onChange={function(e){ onChangeField(f.id, e.target.value); }}
                  onBlur={function(){ commitNumber(f.id); }}
                  onKeyDown={function(e){ if (e.key === 'Enter') e.currentTarget.blur(); }}
                  style={{ width: 90, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>{T2("Spice tolerance")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SPICE_LEVELS.map(function(s){
            var isActive = fp && fp.spice_tolerance === s.id;
            return (
              <button key={s.id} onClick={function(){ onSaveField('spice_tolerance', isActive ? null : s.id); }}
                style={{ padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: isActive ? 700 : 500,
                  background: isActive ? C.wine : C.surface, color: isActive ? "#fff" : C.text,
                  border: "1px solid " + (isActive ? C.wine : C.border), cursor: "pointer" }}>
                {s.icon} {T2(s.label)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>{T2("Timings")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {TIME_FIELDS.map(function(f){
            return (
              <label key={f.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: C.muted }}>{T2(f.label)}</span>
                <TimeInput12 value={val(f.id)} onCommit={function(v){ onSaveField(f.id, v); }} />
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>{T2("Room info")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: C.muted }}>{T2("Check-in")}</span>
            <TimeInput12 value={val('room_check_in')} onCommit={function(v){ onSaveField('room_check_in', v); }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: C.muted }}>{T2("Check-out")}</span>
            <TimeInput12 value={val('room_check_out')} onCommit={function(v){ onSaveField('room_check_out', v); }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: C.muted }}>{T2("Room count")}</span>
            <input type="number" min="0" inputMode="numeric" value={val('room_count')}
              onChange={function(e){ onChangeField('room_count', e.target.value); }}
              onBlur={function(){ commitNumber('room_count'); }}
              style={{ width: 90, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />
          </label>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>{T2("Equipment add-ons")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EQUIP_FIELDS.map(function(f){
            return (
              <div key={f.id} style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                <span style={{ width: 80, fontSize: 12, fontWeight: 600, color: C.text }}>{f.icon} {T2(f.label)}</span>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: C.muted }}>{T2("Count")}</span>
                  <input type="number" min="0" inputMode="numeric" value={val(f.id + '_count')}
                    onChange={function(e){ onChangeField(f.id + '_count', e.target.value); }}
                    onBlur={function(){ commitNumber(f.id + '_count'); }}
                    style={{ width: 70, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: C.muted }}>{T2("Price")}</span>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={val(f.id + '_price')}
                    onChange={function(e){ onChangeField(f.id + '_price', e.target.value); }}
                    onBlur={function(){ commitDecimal(f.id + '_price'); }}
                    style={{ width: 100, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />
                </label>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 4, paddingTop: 8, borderTop: "1px solid " + C.border }}>
            <span style={{ width: 80, fontSize: 12, fontWeight: 600, color: C.text }}>🍷 {T2("Corkage")}</span>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, color: C.muted }}>{T2("Cost agreed")}</span>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={val('corkage_price')}
                onChange={function(e){ onChangeField('corkage_price', e.target.value); }}
                onBlur={function(){ commitDecimal('corkage_price'); }}
                style={{ width: 100, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />
            </label>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>🚗 {T2("Drivers food")}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, color: C.muted }}>{T2("Required")}</span>
            <YesNoToggle T2={T2} value={fp && fp.drivers_food_required != null ? fp.drivers_food_required : false}
              onChange={function(v){ onSaveField('drivers_food_required', v); }} />
          </label>
          {fp && fp.drivers_food_required && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, color: C.muted }}>{T2("Count of people")}</span>
                <input type="number" min="0" inputMode="numeric" value={val('drivers_food_count')}
                  onChange={function(e){ onChangeField('drivers_food_count', e.target.value); }}
                  onBlur={function(){ commitNumber('drivers_food_count'); }}
                  style={{ width: 90, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, color: C.muted }}>{T2("Coupon")}</span>
                <YesNoToggle T2={T2} value={fp && fp.drivers_food_coupon != null ? fp.drivers_food_coupon : null}
                  onChange={function(v){ onSaveField('drivers_food_coupon', v); }} />
              </label>
            </>
          )}
        </div>
      </div>

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
  );
}

function FPTextArea({ label, placeholder, value, onChange, onBlur }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>{label}</div>
      <textarea value={value} placeholder={placeholder}
        onChange={function(e){ onChange(e.target.value); }}
        onBlur={onBlur}
        rows={3}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
    </div>
  );
}

export { TIME_FIELDS, EQUIP_FIELDS };
export default FunctionPlanTab;
