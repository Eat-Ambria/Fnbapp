// Ambria FnB — Function Plan printable summary
// V78: a clean one-pager for kitchen/service briefing — event info, food
// preference/spice/allergies/notes, and the full selected menu grouped by dept.
// Place in: src/components/FunctionPlanPrintView.jsx

import React from "react";
import { C } from '../data/constants.js';
import { SALES_DEPTS } from '../data/salesConfig.js';

var SPICE_LABELS = {
  mild:        '🌶️ Mild',
  medium:      '🌶️🌶️ Medium',
  spicy:       '🌶️🌶️🌶️ Spicy',
  extra_spicy: '🔥 Extra Spicy',
};

export function FunctionPlanPrintView({ event, fp, itemsByDept, onClose, T2 }) {
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

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "30px 24px", color: "#1A1A1A" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)" }}>{T2("Function Plan")}</div>
          <div style={{ fontSize: 12, color: "#666" }}>Ambria Cuisines</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24, fontSize: 13 }}>
          <div><b>{T2("Guest")}:</b> {event.guest || '—'}</div>
          <div><b>{T2("Event type")}:</b> {event.type || '—'}</div>
          <div><b>{T2("Venue")}:</b> {event.venue || '—'}</div>
          <div><b>{T2("Date")}:</b> {event.date || '—'}{event.time ? ' · ' + event.time : ''}</div>
          <div><b>{T2("Pax")}:</b> {event.pax != null ? event.pax : '—'}</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, borderBottom: "2px solid #333", paddingBottom: 4, marginBottom: 8 }}>{T2("Food Preference")}</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, marginBottom: 8 }}>
            <span>🟢 {T2("Veg")}: <b>{(fp && fp.veg_count != null) ? fp.veg_count : '—'}</b></span>
            <span>🔴 {T2("Non-veg")}: <b>{(fp && fp.nonveg_count != null) ? fp.nonveg_count : '—'}</b></span>
            <span>🟠 {T2("Jain")}: <b>{(fp && fp.jain_count != null) ? fp.jain_count : '—'}</b></span>
            <span>🟡 {T2("Egg")}: <b>{(fp && fp.egg_count != null) ? fp.egg_count : '—'}</b></span>
          </div>
          <div style={{ fontSize: 13 }}>
            <b>{T2("Spice tolerance")}:</b> {(fp && fp.spice_tolerance && SPICE_LABELS[fp.spice_tolerance]) || '—'}
          </div>
        </div>

        {fp && fp.allergies && <FPNoteBlock title={T2("Allergies / Dietary Restrictions")} text={fp.allergies} />}
        {fp && fp.service_notes && <FPNoteBlock title={T2("Service Style Notes")} text={fp.service_notes} />}
        {fp && fp.general_notes && <FPNoteBlock title={T2("General Notes")} text={fp.general_notes} />}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, borderBottom: "2px solid #333", paddingBottom: 4, marginBottom: 10 }}>{T2("Selected Menu")}</div>
          {SALES_DEPTS.map(function(d){
            var names = (itemsByDept && itemsByDept[d.id]) || [];
            if (names.length === 0) return null;
            return (
              <div key={d.id} style={{ marginBottom: 12, breakInside: "avoid" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                  {d.icon} {d.name} <span style={{ fontWeight: 400 }}>· {names.length}</span>
                </div>
                <div style={{ fontSize: 13, columns: 2, columnGap: 24 }}>
                  {names.map(function(n){ return <div key={n} style={{ breakInside: "avoid", padding: "2px 0" }}>• {n}</div>; })}
                </div>
              </div>
            );
          })}
          {SALES_DEPTS.every(function(d){ return !(itemsByDept && itemsByDept[d.id] && itemsByDept[d.id].length); }) && (
            <div style={{ fontSize: 13, color: "#888", fontStyle: "italic" }}>{T2("No items selected yet.")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FPNoteBlock({ title, text }) {
  return (
    <div style={{ marginBottom: 14, breakInside: "avoid" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "#333" }}>{text}</div>
    </div>
  );
}

export default FunctionPlanPrintView;
