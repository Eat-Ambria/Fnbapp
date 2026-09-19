// Ambria FnB — Function Plan (FP) form
// V91: restyled onto the Kitchen Hub design system (K tokens, Icon set) with
// per-section on/off switches — Room Info, each equipment item and Drivers
// Food collapse to a bare header until switched on. Two fixed columns (Food
// Preference + Timings on the left; Room Info + Equipment + Drivers Food on
// the right), matching the approved mockup layout. Autosaves per field on
// blur, same pattern as production_plans elsewhere in the app.
// Place in: src/components/FunctionPlanTab.jsx

import React, { useState, useEffect } from "react";
import { K } from '../utils/theme.js';
import { Icon, KButton } from './KitchenUI.jsx';

var SPICE_LEVELS = [
  { id: 'mild',        label: 'Mild',        icon: '🌶️' },
  { id: 'medium',       label: 'Medium',      icon: '🌶️🌶️' },
  { id: 'spicy',        label: 'Spicy',       icon: '🌶️🌶️🌶️' },
  { id: 'extra_spicy',  label: 'Extra Spicy', icon: '🔥' },
];

var TIME_FIELDS = [
  { id: 'snacks_time',   label: 'Snacks' },
  { id: 'baarat_time',   label: 'Baarat' },
  { id: 'assembly_time', label: 'Assembly' },
  { id: 'phera_time',    label: 'Phera' },
  { id: 'chaat_time',    label: 'Chaat' },
  { id: 'windup_time',   label: 'Wind-up' },
];

var EQUIP_FIELDS = [
  { id: 'fan',    label: 'Fan',    icon: '🌀', iconName: 'fan' },
  { id: 'cooler', label: 'Cooler', icon: '❄️', iconName: 'snowflake' },
  { id: 'heater', label: 'Heater', icon: '🔥', iconName: 'flame' },
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

// One bordered pill instead of three separately-boxed selects — the old
// layout of 6 of those side by side read as a wall of broken-up boxes.
function TimeInput12({ value, onCommit }) {
  var t = parseTime12(value);
  function update(part, v) {
    var next = { hour: t.hour, min: t.min, ampm: t.ampm };
    next[part] = v;
    onCommit(next.hour && next.min && next.ampm ? (next.hour + ':' + next.min + ' ' + next.ampm) : null);
  }
  var selStyle = { border: "none", background: "transparent", padding: "7px 2px", fontSize: 13, color: K.text, width: 30, textAlign: "center", outline: "none" };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid " + K.line, borderRadius: K.rSm, background: K.surfaceAlt, flexShrink: 0 }}>
      <select value={t.hour} onChange={function(e){ update('hour', e.target.value); }} style={selStyle}>
        <option value="">--</option>
        {TIME12_HOURS.map(function(h){ return <option key={h} value={h}>{h}</option>; })}
      </select>
      <span style={{ color: K.textFaint, fontSize: 12 }}>:</span>
      <select value={t.min} onChange={function(e){ update('min', e.target.value); }} style={selStyle}>
        <option value="">--</option>
        {TIME12_MINS.map(function(m){ return <option key={m} value={m}>{m}</option>; })}
      </select>
      <select value={t.ampm} onChange={function(e){ update('ampm', e.target.value); }}
        style={{ ...selStyle, width: 44, borderLeft: "1px solid " + K.line, marginLeft: 3, paddingLeft: 6, fontWeight: 600, color: K.textMuted }}>
        <option value="">--</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
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

var inputStyle = { fontFamily: "inherit", fontSize: 13.5, color: K.text, border: "1px solid " + K.line, borderRadius: K.rSm, background: K.surfaceAlt, padding: "9px 11px", outline: "none" };

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
    { id: 'veg_count',    label: T2('Veg'),     swatch: '#2FA35C' },
    { id: 'nonveg_count', label: T2('Non-veg'), swatch: '#D9463F' },
    { id: 'jain_count',   label: T2('Jain'),    swatch: '#C4790C' },
    { id: 'egg_count',    label: T2('Egg'),     swatch: '#D9B31C' },
  ];

  var roomOn = !!(fp && fp.room_info_enabled);
  var driversOn = !!(fp && fp.drivers_food_required);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: K.textMuted }}>{T2("Feeds the printable Function Plan, and dietary notes flow into Kitchen Hub's existing special-instructions flags.")}</div>
        <KButton variant="brand" icon="fileText" onClick={onOpenPrint}>{T2("View / Print FP")}</KButton>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1.2 1 480px", display: "flex", flexDirection: "column", gap: 16, minWidth: 360 }}>

        {/* ── Food Preference (+ Corkage) ── */}
        <Panel icon="plate" badgeBg={K.okBg} badgeColor={K.ok} title={T2("Food Preference")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(70px,1fr))", gap: 12, marginBottom: 20 }}>
            {countFields.map(function(f){
              return (
                <label key={f.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: f.swatch, flexShrink: 0 }} />
                    {f.label}
                  </span>
                  <input type="number" min="0" inputMode="numeric"
                    value={val(f.id)}
                    onChange={function(e){ onChangeField(f.id, e.target.value); }}
                    onBlur={function(){ commitNumber(f.id); }}
                    onKeyDown={function(e){ if (e.key === 'Enter') e.currentTarget.blur(); }}
                    style={{ ...inputStyle, width: 90 }} />
                </label>
              );
            })}
          </div>

          <FieldLabel>{T2("Spice tolerance")}</FieldLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
            {SPICE_LEVELS.map(function(s){
              var isActive = fp && fp.spice_tolerance === s.id;
              return (
                <button key={s.id} onClick={function(){ onSaveField('spice_tolerance', isActive ? null : s.id); }}
                  style={{ padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: isActive ? 700 : 600,
                    background: isActive ? K.brand : K.surface, color: isActive ? "#fff" : K.textBody,
                    border: "1px solid " + (isActive ? K.brand : K.line), cursor: "pointer",
                    boxShadow: isActive ? "0 3px 10px rgba(28,61,43,.22)" : "none" }}>
                  {s.icon} {T2(s.label)}
                </button>
              );
            })}
          </div>

          <div style={{ paddingTop: 16, borderTop: "1px solid " + K.lineSoft }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ color: K.brand, display: "flex" }}><Icon name="cup" size={15} strokeWidth={1.9} /></span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: K.text }}>{T2("Corkage")}</span>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
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
            </div>
          </div>
        </Panel>

        {/* ── Timings ── */}
        <Panel icon="clock" badgeBg={K.accentSoft} badgeColor={K.accent} title={T2("Timings")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 28px" }}>
            {TIME_FIELDS.map(function(f, i){
              var isLastRow = i >= TIME_FIELDS.length - 2;
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: isLastRow ? "none" : "1px solid " + K.lineSoft }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: K.textBody }}>{T2(f.label)}</label>
                  <TimeInput12 value={val(f.id)} onCommit={function(v){ onSaveField(f.id, v); }} />
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
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: K.textMuted, marginBottom: 6 }}>{T2("Coupon")}</div>
                <Switch on={!!(fp && fp.drivers_food_coupon)} onChange={function(v){ onSaveField('drivers_food_coupon', v); }} title={T2("Coupon issued?")} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: K.textFaint, fontStyle: "italic" }}>{T2("Not required for this function.")}</div>
          )}
        </Panel>

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
        </Panel>
      </div>
    </div>
  );
}

function FPTextArea({ label, placeholder, value, onChange, onBlur }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea value={value} placeholder={placeholder}
        onChange={function(e){ onChange(e.target.value); }}
        onBlur={onBlur}
        rows={4}
        style={{ ...inputStyle, width: "100%", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", minHeight: 96, lineHeight: 1.5 }} />
    </div>
  );
}

export { TIME_FIELDS, EQUIP_FIELDS };
export default FunctionPlanTab;
