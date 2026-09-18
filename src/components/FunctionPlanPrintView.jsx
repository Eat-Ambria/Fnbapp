// Ambria FnB — Function Plan printable summary
// V78: a clean one-pager for kitchen/service briefing — event info, food
// preference/spice/allergies/notes, and the full selected menu grouped by dept.
// Place in: src/components/FunctionPlanPrintView.jsx

import React from "react";
import { C } from '../data/constants.js';
import { SALES_DEPTS, DEPT_CONFIGS } from '../data/salesConfig.js';
import { TIME_FIELDS, EQUIP_FIELDS } from './FunctionPlanTab.jsx';

var SPICE_LABELS = {
  mild:        '🌶️ Mild',
  medium:      '🌶️🌶️ Medium',
  spicy:       '🌶️🌶️🌶️ Spicy',
  extra_spicy: '🔥 Extra Spicy',
};

var DIFF_KIND_META = {
  addon:     { label: 'Add-on',    color: '#2A7A48', bg: '#E5F5EA' },
  deduction: { label: 'Deduction', color: '#A52828', bg: '#FAE5E5' },
  swap:      { label: 'Swap',      color: '#1858A5', bg: '#E5F0FA' },
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

export function FunctionPlanPrintView({ event, fp, itemsByDept, packageName, menuDiffByDept, configsByDept, onClose, T2 }) {
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

        {fp && TIME_FIELDS.some(function(f){ return fp[f.id]; }) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, borderBottom: "2px solid #333", paddingBottom: 4, marginBottom: 8 }}>{T2("Timings")}</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
              {TIME_FIELDS.filter(function(f){ return fp[f.id]; }).map(function(f){
                return <span key={f.id}>{T2(f.label)}: <b>{fp[f.id]}</b></span>;
              })}
            </div>
          </div>
        )}

        {fp && (fp.room_check_in || fp.room_check_out || fp.room_count != null) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, borderBottom: "2px solid #333", paddingBottom: 4, marginBottom: 8 }}>{T2("Room Info")}</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
              {fp.room_check_in && <span>{T2("Check-in")}: <b>{fp.room_check_in}</b></span>}
              {fp.room_check_out && <span>{T2("Check-out")}: <b>{fp.room_check_out}</b></span>}
              {fp.room_count != null && <span>{T2("Room count")}: <b>{fp.room_count}</b></span>}
            </div>
          </div>
        )}

        {fp && (EQUIP_FIELDS.some(function(f){ return fp[f.id + '_count'] > 0; }) || fp.corkage_price != null) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, borderBottom: "2px solid #333", paddingBottom: 4, marginBottom: 8 }}>{T2("Equipment Add-ons")}</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
              {EQUIP_FIELDS.filter(function(f){ return fp[f.id + '_count'] > 0; }).map(function(f){
                var count = fp[f.id + '_count'];
                var price = fp[f.id + '_price'];
                return <span key={f.id}>{f.icon} {T2(f.label)}: <b>{count}</b>{price != null ? ' @ ₹' + price : ''}</span>;
              })}
              {fp.corkage_price != null && <span>🍷 {T2("Corkage")}: <b>₹{fp.corkage_price}</b></span>}
            </div>
          </div>
        )}

        {fp && fp.allergies && <FPNoteBlock title={T2("Allergies / Dietary Restrictions")} text={fp.allergies} />}
        {fp && fp.service_notes && <FPNoteBlock title={T2("Service Style Notes")} text={fp.service_notes} />}
        {fp && fp.general_notes && <FPNoteBlock title={T2("General Notes")} text={fp.general_notes} />}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, borderBottom: "2px solid #333", paddingBottom: 4, marginBottom: 10 }}>{T2("Selected Menu")}</div>
          {packageName ? (
            <div>
              <div style={{ fontSize: 13, marginBottom: 10 }}><b>{T2("Package")}:</b> {packageName}</div>
              {Object.keys(menuDiffByDept || {}).length === 0 ? (
                <div style={{ fontSize: 13, color: "#888", fontStyle: "italic" }}>{T2("Menu matches the package exactly — no swaps or add-ons.")}</div>
              ) : (
                SALES_DEPTS.map(function(d){
                  var diff = menuDiffByDept && menuDiffByDept[d.id];
                  if (!diff) return null;
                  var meta = DIFF_KIND_META[diff.kind];
                  return (
                    <div key={d.id} style={{ marginBottom: 10, breakInside: "avoid" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                        {d.icon} {d.name}
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, padding: "1px 6px", borderRadius: 4 }}>{T2(meta.label)}</span>
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {diff.added.map(function(n){ return <div key={'a' + n} style={{ color: meta.color, padding: "1px 0" }}>+ {n}</div>; })}
                        {diff.removed.map(function(n){ return <div key={'r' + n} style={{ color: meta.color, padding: "1px 0" }}>− {n}</div>; })}
                      </div>
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
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, borderBottom: "2px solid #333", paddingBottom: 4, marginBottom: 10 }}>{T2("Department Configurations")}</div>
          {(function(){
            var deptRows = SALES_DEPTS.map(function(d){
              var deptDefs = DEPT_CONFIGS[d.id] || [];
              var deptValues = (configsByDept && configsByDept[d.id]) || {};
              var rows = deptDefs.map(function(cfg){
                var val = formatConfigValue(cfg, deptValues[cfg.key], event.pax);
                return val ? { cfg: cfg, val: val } : null;
              }).filter(Boolean);
              return { dept: d, rows: rows };
            }).filter(function(x){ return x.rows.length > 0; });

            if (deptRows.length === 0) {
              return <div style={{ fontSize: 13, color: "#888", fontStyle: "italic" }}>{T2("No department configurations set.")}</div>;
            }
            return deptRows.map(function(x){
              return (
                <div key={x.dept.id} style={{ marginBottom: 12, breakInside: "avoid" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4 }}>
                    {x.dept.icon} {x.dept.name}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {x.rows.map(function(r){
                      return (
                        <div key={r.cfg.key} style={{ padding: "2px 0" }}>
                          {r.cfg.icon} <b>{r.cfg.label}:</b> {r.val}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
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
