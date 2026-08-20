// Ambria FnB — Total Panel (Sales)
// V70 Phase 5C: read-only per-dept summary of picked items + configured values.
// Place in: src/components/TotalPanel.jsx

import React, { useState, useEffect, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { getCatIdForDish, RECIPE_DB } from '../data/recipeData.js';
import { DEPT_CONFIGS, SALES_DEPT_MAP, ITEM_HAVING_DEPTS, DIET_TAGS, DEFAULT_DIET, DEFAULT_DEPT } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';

export function TotalPanel({ proposal, activeDept, dishItems, salesMeta, templateInfo, lang = "en" }) {
  var T2 = function(s){ return T(s, lang); };

  var [configs, setConfigs] = useState({}); // { [config_key]: config_value }
  var [loading, setLoading] = useState(true);

  var deptMeta   = SALES_DEPT_MAP[activeDept];
  var configDefs = DEPT_CONFIGS[activeDept] || [];
  var hasItems   = ITEM_HAVING_DEPTS.indexOf(activeDept) >= 0;
  var hasConfigs = configDefs.length > 0;

  // ── Dept-scoped items (from parent's dishItems, filtered by sales_dept meta) ──
  var deptItems = useMemo(function(){
    return (dishItems || []).filter(function(i){
      var meta = salesMeta[i.dish_name];
      var d = (meta && meta.sales_dept) || DEFAULT_DEPT;
      return d === activeDept;
    });
  }, [dishItems, salesMeta, activeDept]);

  // ── Group items by recipe category ──
  var groupedItems = useMemo(function(){
    var groups = {};
    deptItems.forEach(function(item){
      var catId  = getCatIdForDish(item.dish_name) || 'other';
      var catObj = (RECIPE_DB.cats || []).find(function(c){ return c.id === catId; });
      if (!groups[catId]) {
        groups[catId] = {
          id: catId,
          name: catObj ? catObj.name : 'Other',
          icon: catObj ? (catObj.icon || '🍽') : '🍽',
          items: [],
        };
      }
      groups[catId].items.push(item);
    });
    var order = (RECIPE_DB.cats || []).map(function(c){ return c.id; });
    var sorted = order.filter(function(id){ return !!groups[id]; }).map(function(id){ return groups[id]; });
    Object.keys(groups).forEach(function(id){ if (order.indexOf(id) < 0) sorted.push(groups[id]); });
    return sorted;
  }, [deptItems]);

  var addonCount = useMemo(function(){
    return deptItems.filter(function(i){ return i.is_addon; }).length;
  }, [deptItems]);

  var configsSetCount = useMemo(function(){
    return configDefs.filter(function(cfg){ return configs[cfg.key] != null; }).length;
  }, [configDefs, configs]);

  // ── Load proposal_configs for THIS dept ──
  async function loadConfigs() {
    if (!proposal || !proposal.id) return;
    setLoading(true);
    try {
      var res = await supabase.from('proposal_configs')
        .select('*')
        .eq('proposal_id', proposal.id)
        .eq('dept_id', activeDept);
      if (res.error) throw res.error;
      var m = {};
      (res.data || []).forEach(function(r){ m[r.config_key] = r.config_value; });
      setConfigs(m);
    } catch (e) {
      console.error('[TotalPanel] loadConfigs failed:', e);
      setConfigs({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(function(){ loadConfigs(); /* eslint-disable-next-line */ }, [proposal && proposal.id, activeDept]);

  // ── Realtime for configs on this proposal + dept ──
  useEffect(function(){
    if (!proposal || !proposal.id) return;
    var chan = supabase.channel('total_rt_' + proposal.id + '_' + activeDept)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'proposal_configs', filter: 'proposal_id=eq.' + proposal.id },
        function(payload){
          var row = payload.new || payload.old;
          if (!row || row.dept_id !== activeDept) return;
          setConfigs(function(prev){
            var next = { ...prev };
            if (payload.eventType === 'DELETE') delete next[row.config_key];
            else                                next[row.config_key] = payload.new.config_value;
            return next;
          });
        })
      .subscribe();
    return function(){ supabase.removeChannel(chan); };
  }, [proposal && proposal.id, activeDept]);

  // ── RENDER ──
  if (loading) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
        <div style={{ fontSize: 13 }}>{T2("Loading summary…")}</div>
      </div>
    );
  }

  var showEmpty = deptItems.length === 0 && configsSetCount === 0;

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {hasItems && (
          <SummaryPill
            icon="🍛"
            label={deptItems.length + " " + T2(deptItems.length === 1 ? "item" : "items")}
            sub={addonCount > 0 ? (addonCount + " " + T2("add-ons")) : ((groupedItems.length || 0) + " " + T2("categories"))}
            accent={deptItems.length > 0 ? "#2A7A48" : C.muted}
          />
        )}
        {hasConfigs && (
          <SummaryPill
            icon="⚙"
            label={configsSetCount + " / " + configDefs.length + " " + T2("configs set")}
            sub={configsSetCount === configDefs.length ? T2("Complete") : T2("In progress")}
            accent={configsSetCount === configDefs.length ? "#2A7A48" : (C.gold || "#D4A843")}
          />
        )}
        {templateInfo && templateInfo.name && (
          <SummaryPill
            icon="📋"
            label={templateInfo.name}
            sub={(templateInfo.tier || '').toUpperCase() + " " + T2("template")}
            accent={templateInfo.tier === 'magnum' ? '#8A70C8' : '#D4A843'}
          />
        )}
      </div>

      {showEmpty && (
        <div style={{ padding: "60px 24px", textAlign: "center", background: C.surface, borderRadius: 14, border: "1px dashed " + C.border }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{(deptMeta && deptMeta.icon) || '📊'}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6, fontFamily: "var(--font-display)" }}>
            {T2("Nothing here yet")}
          </div>
          <div style={{ fontSize: 12, color: C.muted, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
            {hasItems && hasConfigs
              ? T2("Pick items in the Items tab or set configs in the Configs tab to see them summarized here.")
              : hasItems
                ? T2("Pick items in the Items tab to see them summarized here.")
                : T2("Configure options in the Configs tab to see them summarized here.")}
          </div>
        </div>
      )}

      {/* Items section */}
      {hasItems && deptItems.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader T2={T2} icon="🍛" label={T2("Selected items")} count={deptItems.length} />
          {groupedItems.map(function(grp){
            return (
              <div key={grp.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, padding: "0 2px" }}>
                  {grp.icon} {grp.name} <span style={{ color: C.muted, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· {grp.items.length}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {grp.items.map(function(item){
                    var meta = salesMeta[item.dish_name];
                    var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
                    var dietMeta = DIET_TAGS.find(function(x){ return x.id === diet; });
                    var isAddon = !!item.is_addon;
                    return (
                      <span key={item.dish_name}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "6px 10px", borderRadius: 16,
                          background: isAddon ? "#F8F4FC" : "#F0F9F3",
                          border: (isAddon ? "1.5px dashed " : "1px solid ") + (isAddon ? "#8A70C8" : "#B8E0C6"),
                          fontSize: 12, color: C.text,
                        }}>
                        {dietMeta && <span style={{ fontSize: 10, color: dietMeta.color }} title={dietMeta.label}>{dietMeta.icon}</span>}
                        <span style={{ fontWeight: 600 }}>{item.dish_name}</span>
                        {isAddon && <span style={{ marginLeft: 2, padding: "1px 5px", borderRadius: 3, background: "#8A70C8", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 0.4 }}>ADD-ON</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Configs section */}
      {hasConfigs && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader T2={T2} icon="⚙" label={T2("Configurations")} count={configsSetCount + " / " + configDefs.length} />
          <div style={{ background: C.surface, borderRadius: 12, border: "1px solid " + C.border, overflow: "hidden" }}>
            {configDefs.map(function(cfg, idx){
              var val = configs[cfg.key];
              var fmt = formatConfigValue(cfg, val, (proposal && proposal.pax) || 0, T2);
              return (
                <div key={cfg.key}
                  style={{
                    display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12,
                    padding: "12px 16px", alignItems: "center",
                    borderBottom: idx < configDefs.length - 1 ? "1px solid " + C.border : "none",
                    background: fmt.muted ? "transparent" : "transparent",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 140 }}>
                    <span style={{ fontSize: 15 }}>{cfg.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{cfg.label}</span>
                  </div>
                  <div style={{ opacity: fmt.muted ? 0.55 : 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: fmt.muted ? C.muted : C.text }}>{fmt.text}</div>
                    {fmt.desc && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{fmt.desc}</div>}
                  </div>
                  <div style={{ fontSize: 10, color: fmt.muted ? C.muted : "#2A7A48", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {fmt.muted ? T2("○ NOT SET") : "✓ SET"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// formatConfigValue — turn stored value into human-readable text
// ═══════════════════════════════════════════════════════════════
function formatConfigValue(cfg, value, pax, T2) {
  if (value == null || value === undefined) return { text: T2("Not set"), muted: true };

  if (cfg.type === 'options' || cfg.type === 'radio') {
    var opt = (cfg.options || []).find(function(o){ return o.id === value.selected_id; });
    if (!opt) return { text: T2("Not set"), muted: true };
    return { text: opt.name, desc: opt.desc || null };
  }

  if (cfg.type === 'ratio') {
    var ratio = (cfg.ratios || []).find(function(r){ return r.id === value.ratio_id; });
    if (!ratio) return { text: T2("Not set"), muted: true };
    var extras = value.extras || 0;
    var count = pax ? Math.ceil(pax / ratio.den) * ratio.num + extras : null;
    var desc = count != null
      ? count + " " + T2("staff for") + " " + pax + " " + T2("pax") + (extras > 0 ? " (+" + extras + " " + T2("extra") + ")" : "")
      : (extras > 0 ? "+" + extras + " " + T2("extra") : null);
    return {
      text: ratio.num + ":" + ratio.den + " " + (ratio.label || ""),
      desc: desc,
    };
  }

  if (cfg.type === 'count') {
    var n = value.count || 0;
    if (n === 0) return { text: T2("None"), muted: true };
    return { text: String(n) };
  }

  if (cfg.type === 'multi_count') {
    var items = (value.items || []).filter(function(i){ return i.count > 0; });
    if (items.length === 0) return { text: T2("None selected"), muted: true };
    var lookup = (cfg.options || []).reduce(function(m, o){ m[o.id] = o.name; return m; }, {});
    var total = items.reduce(function(s, i){ return s + i.count; }, 0);
    return {
      text: items.map(function(i){ return (lookup[i.id] || i.id) + " ×" + i.count; }).join(', '),
      desc: total + " " + T2("total"),
    };
  }

  if (cfg.type === 'tags') {
    var ids = value.selected_ids || [];
    if (ids.length === 0) return { text: T2("None selected"), muted: true };
    var lookupT = (cfg.options || []).reduce(function(m, o){ m[o.id] = o.name; return m; }, {});
    return { text: ids.map(function(id){ return lookupT[id] || id; }).join(' · '), desc: ids.length + " " + T2("selected") };
  }

  return { text: JSON.stringify(value), muted: true };
}

// ═══════════════════════════════════════════════════════════════
// Small UI bits
// ═══════════════════════════════════════════════════════════════
function SummaryPill({ icon, label, sub, accent }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 12,
      background: C.surface, border: "1px solid " + C.border,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: accent || C.text }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.5 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ T2, icon, label, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 2px" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</span>
      {count != null && <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>· {count}</span>}
    </div>
  );
}

export default TotalPanel;