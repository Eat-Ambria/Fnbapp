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

export default FunctionPlanTab;
