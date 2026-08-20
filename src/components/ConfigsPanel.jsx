// Ambria FnB — Configs Panel (Sales)
// V70 Phase 5A: 6 reusable config panel types + orchestrator over proposal_configs table.
// Place in: src/components/ConfigsPanel.jsx

import React, { useState, useEffect, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { DEPT_CONFIGS, SALES_DEPT_MAP } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';

export function ConfigsPanel({ proposal, activeDept, lang = "en" }) {
  var T2 = function(s) { return T(s, lang); };
  var configs = DEPT_CONFIGS[activeDept] || [];
  var deptMeta = SALES_DEPT_MAP[activeDept];

  var [values, setValues]   = useState({}); // { [dept_id]: { [config_key]: config_value } }
  var [loading, setLoading] = useState(true);

  // ── Load all proposal_configs on mount ──
  async function loadConfigs() {
    if (!proposal || !proposal.id) return;
    setLoading(true);
    try {
      var res = await supabase.from('proposal_configs').select('*').eq('proposal_id', proposal.id);
      if (res.error) throw res.error;
      var next = {};
      (res.data || []).forEach(function(r){
        if (!next[r.dept_id]) next[r.dept_id] = {};
        next[r.dept_id][r.config_key] = r.config_value;
      });
      setValues(next);
    } catch (e) {
      console.error('[ConfigsPanel] load failed:', e);
      setValues({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(function(){ loadConfigs(); /* eslint-disable-next-line */ }, [proposal && proposal.id]);

  // ── Realtime for proposal_configs on this proposal ──
  useEffect(function(){
    if (!proposal || !proposal.id) return;
    var chan = supabase.channel('pconfigs_rt_' + proposal.id)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'proposal_configs', filter: 'proposal_id=eq.' + proposal.id },
        function(payload){
          var row = payload.new || payload.old;
          if (!row) return;
          setValues(function(prev){
            var next = {}; Object.keys(prev).forEach(function(k){ next[k] = { ...prev[k] }; });
            if (payload.eventType === 'DELETE') {
              if (next[row.dept_id]) delete next[row.dept_id][row.config_key];
            } else {
              if (!next[row.dept_id]) next[row.dept_id] = {};
              next[row.dept_id][row.config_key] = payload.new.config_value;
            }
            return next;
          });
        })
      .subscribe();
    return function(){ supabase.removeChannel(chan); };
  }, [proposal && proposal.id]);

  // ── Save one config (optimistic + upsert) ──
  async function saveConfig(configKey, newValue) {
    // Optimistic local update
    setValues(function(prev){
      var next = {}; Object.keys(prev).forEach(function(k){ next[k] = { ...prev[k] }; });
      if (!next[activeDept]) next[activeDept] = {};
      next[activeDept][configKey] = newValue;
      return next;
    });
    try {
      var res = await supabase.from('proposal_configs').upsert(
        { proposal_id: proposal.id, dept_id: activeDept, config_key: configKey, config_value: newValue },
        { onConflict: 'proposal_id,dept_id,config_key' }
      );
      if (res.error) throw res.error;
    } catch (e) {
      console.error('[ConfigsPanel] save failed:', e);
      alert(T2('Failed to save config:') + ' ' + (e.message || e));
      // Rollback via reload
      loadConfigs();
    }
  }

  // ── RENDER ──
  var deptValues = values[activeDept] || {};

  if (loading) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚙</div>
        <div style={{ fontSize: 13 }}>{T2("Loading configurations…")}</div>
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted, background: C.surface, borderRadius: 12, border: "1px dashed " + C.border }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{deptMeta && deptMeta.icon}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          {(deptMeta && deptMeta.name) + ' — ' + T2("Phase 5B")}
        </div>
        <div style={{ fontSize: 12 }}>
          {T2("Config options for this department ship in Phase 5B.")}
        </div>
      </div>
    );
  }

  return (
    <div>
      {configs.map(function(cfg){
        var val = deptValues[cfg.key];
        return (
          <div key={cfg.key} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 2px" }}>
              <span style={{ fontSize: 16 }}>{cfg.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.6 }}>{cfg.label}</span>
              {val !== undefined && val !== null && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#E5F5EA", color: "#2A7A48", fontWeight: 700, letterSpacing: 0.3 }}>✓ SET</span>}
            </div>
            {cfg.type === 'options'     && <OptionsPicker    cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} T2={T2} />}
            {cfg.type === 'radio'       && <RadioCards       cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} T2={T2} />}
            {cfg.type === 'ratio'       && <RatioSelector    cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} proposal={proposal} T2={T2} />}
            {cfg.type === 'count'       && <CountSelector    cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} T2={T2} />}
            {cfg.type === 'multi_count' && <MultiSelectCount cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} T2={T2} />}
            {cfg.type === 'tags'        && <TagToggles       cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} T2={T2} />}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OPTIONS PICKER — single-select card grid
// ═══════════════════════════════════════════════════════════════
function OptionsPicker({ cfg, value, onChange }) {
  var selId = value && value.selected_id;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
      {(cfg.options || []).map(function(opt){
        var isSel = selId === opt.id;
        return (
          <button key={opt.id} type="button" onClick={function(){ onChange({ selected_id: opt.id }); }}
            style={{
              padding: "14px 14px", borderRadius: 10,
              background: isSel ? "#F5F0E8" : C.surface,
              border: isSel ? ("1.5px solid " + (C.gold || "#D4A843")) : ("1px solid " + C.border),
              textAlign: "left", cursor: "pointer",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              {opt.icon && <span style={{ fontSize: 14 }}>{opt.icon}</span>}
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{opt.name}</span>
              {isSel && <span style={{ marginLeft: "auto", fontSize: 12, color: C.gold || "#D4A843", fontWeight: 700 }}>✓</span>}
            </div>
            {opt.desc && <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{opt.desc}</div>}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RADIO CARDS — semantically same as options but with radio visual
// ═══════════════════════════════════════════════════════════════
function RadioCards({ cfg, value, onChange }) {
  var selId = value && value.selected_id;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(cfg.options || []).map(function(opt){
        var isSel = selId === opt.id;
        return (
          <button key={opt.id} type="button" onClick={function(){ onChange({ selected_id: opt.id }); }}
            style={{
              padding: "12px 14px", borderRadius: 10,
              background: isSel ? "#F5F0E8" : C.surface,
              border: isSel ? ("1.5px solid " + (C.gold || "#D4A843")) : ("1px solid " + C.border),
              textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
            }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
              border: "2px solid " + (isSel ? (C.gold || "#D4A843") : "#BBB"),
              background: isSel ? (C.gold || "#D4A843") : "transparent",
              boxShadow: isSel ? "inset 0 0 0 3px #fff" : "none",
            }}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{opt.name}</div>
              {opt.desc && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{opt.desc}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RATIO SELECTOR — 3 ratio cards + extras spinner + live count
// ═══════════════════════════════════════════════════════════════
function RatioSelector({ cfg, value, onChange, proposal, T2 }) {
  var selId  = value && value.ratio_id;
  var extras = (value && value.extras) || 0;
  var pax    = (proposal && proposal.pax) || 0;

  function computeCount(ratio) {
    if (!pax || !ratio) return 0;
    return Math.ceil(pax / ratio.den) * ratio.num + (extras || 0);
  }
  var selRatio = (cfg.ratios || []).find(function(r){ return r.id === selId; });
  var liveCount = selRatio ? computeCount(selRatio) : 0;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
        {(cfg.ratios || []).map(function(r){
          var isSel = selId === r.id;
          var cnt = computeCount(r);
          return (
            <button key={r.id} type="button"
              onClick={function(){ onChange({ ratio_id: r.id, extras: extras }); }}
              style={{
                padding: "14px 14px", borderRadius: 10,
                background: isSel ? "#F5F0E8" : C.surface,
                border: isSel ? ("1.5px solid " + (C.gold || "#D4A843")) : ("1px solid " + C.border),
                textAlign: "left", cursor: "pointer",
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{r.label}</span>
                {isSel && <span style={{ fontSize: 12, color: C.gold || "#D4A843", fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>
                {r.num}:{r.den}
              </div>
              {pax > 0 && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  → <b style={{ color: isSel ? (C.gold || "#D4A843") : C.text }}>{cnt}</b> {T2("staff for")} {pax} {T2("pax")}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {cfg.allowExtras && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: C.bg, border: "1px solid " + C.border }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{T2("Extra staff")}:</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button type="button" onClick={function(){ onChange({ ratio_id: selId, extras: Math.max(0, extras - 1) }); }}
              disabled={!selId || extras <= 0}
              style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid " + C.border, background: C.surface, fontSize: 14, fontWeight: 700, color: C.text, cursor: selId && extras > 0 ? "pointer" : "not-allowed", opacity: selId && extras > 0 ? 1 : 0.4 }}>−</button>
            <input type="number" value={extras} readOnly
              style={{ width: 50, textAlign: "center", padding: "5px 6px", borderRadius: 6, border: "1px solid " + C.border, background: C.surface, fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }} />
            <button type="button" onClick={function(){ onChange({ ratio_id: selId, extras: (extras || 0) + 1 }); }}
              disabled={!selId}
              style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid " + C.border, background: C.surface, fontSize: 14, fontWeight: 700, color: C.text, cursor: selId ? "pointer" : "not-allowed", opacity: selId ? 1 : 0.4 }}>+</button>
          </div>
          {selRatio && (
            <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: C.gold || "#D4A843" }}>
              {T2("Total")}: {liveCount} {T2("staff")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COUNT SELECTOR — simple number stepper
// ═══════════════════════════════════════════════════════════════
function CountSelector({ cfg, value, onChange }) {
  var count = (value && value.count) || 0;
  var min = cfg.min != null ? cfg.min : 0;
  var max = cfg.max != null ? cfg.max : 999;
  var step = cfg.step || 1;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 10, background: C.bg, border: "1px solid " + C.border }}>
      <button type="button" onClick={function(){ onChange({ count: Math.max(min, count - step) }); }}
        disabled={count <= min}
        style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 16, fontWeight: 700, color: C.text, cursor: count > min ? "pointer" : "not-allowed", opacity: count > min ? 1 : 0.4 }}>−</button>
      <input type="number" value={count} min={min} max={max} step={step}
        onChange={function(e){
          var v = parseInt(e.target.value, 10);
          if (isNaN(v)) v = 0;
          v = Math.max(min, Math.min(max, v));
          onChange({ count: v });
        }}
        style={{ width: 80, textAlign: "center", padding: "8px 10px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 15, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }} />
      <button type="button" onClick={function(){ onChange({ count: Math.min(max, count + step) }); }}
        disabled={count >= max}
        style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 16, fontWeight: 700, color: C.text, cursor: count < max ? "pointer" : "not-allowed", opacity: count < max ? 1 : 0.4 }}>+</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MULTI-SELECT WITH COUNT — rows of {checkbox + count spinner}
// ═══════════════════════════════════════════════════════════════
function MultiSelectCount({ cfg, value, onChange }) {
  var items = (value && value.items) || [];
  var itemsMap = items.reduce(function(m, it){ m[it.id] = it.count; return m; }, {});

  function update(id, newCount) {
    var next = (cfg.options || []).map(function(opt){
      var c = opt.id === id ? newCount : (itemsMap[opt.id] || 0);
      return { id: opt.id, count: c };
    }).filter(function(x){ return x.count > 0; });
    onChange({ items: next });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {(cfg.options || []).map(function(opt){
        var count = itemsMap[opt.id] || 0;
        var isSel = count > 0;
        return (
          <div key={opt.id}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: 10,
              background: isSel ? "#F5F0E8" : C.surface,
              border: isSel ? ("1.5px solid " + (C.gold || "#D4A843")) : ("1px solid " + C.border),
            }}>
            <input type="checkbox" checked={isSel} onChange={function(e){ update(opt.id, e.target.checked ? 1 : 0); }}
              style={{ width: 18, height: 18, cursor: "pointer" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{opt.name}</div>
              {opt.desc && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{opt.desc}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button type="button" onClick={function(){ update(opt.id, Math.max(0, count - 1)); }}
                disabled={!isSel}
                style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid " + C.border, background: C.surface, fontSize: 13, fontWeight: 700, cursor: isSel ? "pointer" : "not-allowed", opacity: isSel ? 1 : 0.4 }}>−</button>
              <span style={{ width: 32, textAlign: "center", fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{count}</span>
              <button type="button" onClick={function(){ update(opt.id, count + 1); }}
                style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid " + C.border, background: C.surface, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAG TOGGLES — multi-select pill buttons
// ═══════════════════════════════════════════════════════════════
function TagToggles({ cfg, value, onChange }) {
  var selIds = (value && value.selected_ids) || [];
  var selSet = selIds.reduce(function(m, id){ m[id] = true; return m; }, {});

  function toggle(id) {
    var next;
    if (selSet[id]) next = selIds.filter(function(x){ return x !== id; });
    else            next = selIds.concat([id]);
    onChange({ selected_ids: next });
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {(cfg.options || []).map(function(opt){
        var isSel = !!selSet[opt.id];
        return (
          <button key={opt.id} type="button" onClick={function(){ toggle(opt.id); }}
            style={{
              padding: "8px 14px", borderRadius: 18,
              background: isSel ? (C.gold || "#D4A843") : C.surface,
              border: "1.5px solid " + (isSel ? (C.gold || "#D4A843") : C.border),
              color: isSel ? "#fff" : C.text,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
            {opt.icon && <span style={{ marginRight: 4 }}>{opt.icon}</span>}
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}

export default ConfigsPanel;