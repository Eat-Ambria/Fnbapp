// Ambria FnB — Package Budget (V90)
// Admin-only backend for setting a per-head (per-pax) budget on each menu
// package, split across the 7 F&B sub-departments. Nothing else in the app
// reads these numbers yet — pure data-entry backend, same as
// PricingConfigView.jsx / MIGRATION_package_budgets.sql.
// Place in: src/components/PackageBudgetView.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { T } from '../data/translations.js';
import { SALES_DEPTS } from '../data/salesConfig.js';

// GYV is a budget-only bucket (company overhead/margin, not a real
// operational department) — local to this screen, not added to the shared
// SALES_DEPTS list, so it never shows up as a dept tab in the Menu Builder
// (proposal or booked-function) or anywhere else SALES_DEPTS drives real
// dish/config selection.
var BUDGET_DEPTS = SALES_DEPTS.concat([
  { id: 'gyv', name: 'GYV', icon: '🏢', glyph: 'building', color: '#5B6472', bg: '#E7E9EC' },
]);
import { supabase } from '../lib/supabase.js';
import { K, type } from '../utils/theme.js';
import { Icon, KToast } from './KitchenUI.jsx';

// Package names are "<Tier> Veg" / "<Tier> Non Veg" / "<Tier> Non-Veg" / "<Tier> Non - Veg"
// (no separate tier/diet columns exist in menu_packages — the name carries both),
// so the tier + diet picker is derived from the name string, not stored separately.
function splitPkgName(name) {
  var s = (name || '').trim();
  var m = s.match(/^(.*?)\s*non[\s-]*veg\s*$/i);
  if (m) return { tier: m[1].trim(), diet: 'nonveg' };
  m = s.match(/^(.*?)\s*\bveg\b\s*$/i);
  if (m) return { tier: m[1].trim(), diet: 'veg' };
  return { tier: s, diet: null };
}

function DeptPriceInput({ value, onSave, saving }) {
  var [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(function(){ setDraft(value == null ? '' : String(value)); }, [value]);
  return (
    <input type="number" min="0" step="1" value={draft}
      onChange={function(e){ setDraft(e.target.value); }}
      onBlur={function(){
        var n = draft === '' ? 0 : Number(draft);
        if (!isFinite(n) || n < 0) n = 0;
        if (n !== (value || 0)) onSave(n);
        else setDraft(String(value || 0));
      }}
      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + K.line,
        fontSize: 17, fontWeight: 700, color: K.text, background: '#FFFFFF', textAlign: 'right',
        boxSizing: 'border-box', fontFamily: K.fontBody, outline: 'none', opacity: saving ? 0.5 : 1 }} />
  );
}

function PackageBudgetView({ lang = 'en', currentUser = null }) {
  var T2 = function(s) { return T(s, lang); };
  var isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'headchef');

  // Fetched directly from menu_packages rather than the in-memory
  // MENU_PACKAGE_META cache — that cache only gets its `id` field populated
  // after refreshMenuPackages() runs (any package edit), and stays empty on a
  // cold app boot, which would silently break this screen until someone
  // happened to save a package first.
  var [pkgRows, setPkgRows] = useState([]);
  var [pkgLoaded, setPkgLoaded] = useState(false);
  useEffect(function(){
    var cancelled = false;
    supabase.from('menu_packages').select('id,name').eq('is_active', true).then(function(res){
      if (res.error) { console.error('[PackageBudget] load packages failed:', res.error); return; }
      if (!cancelled) { setPkgRows(res.data || []); setPkgLoaded(true); }
    });
    return function(){ cancelled = true; };
  }, []);

  var pkgIndex = useMemo(function(){
    var byTier = {};
    var order = [];
    pkgRows.forEach(function(row){
      var sd = splitPkgName(row.name);
      if (!byTier[sd.tier]) { byTier[sd.tier] = {}; order.push(sd.tier); }
      if (sd.diet) byTier[sd.tier][sd.diet] = row;
      else byTier[sd.tier].unknown = row;
    });
    return { byTier: byTier, tiers: order };
  }, [pkgRows]);

  var [selTier, setSelTier] = useState(null);
  var [selDiet, setSelDiet] = useState('veg');
  var [budgets, setBudgets] = useState({});
  var [savingKey, setSavingKey] = useState(null);
  var [toast, setToast] = useState(null);

  useEffect(function(){
    if (selTier == null && pkgIndex.tiers.length > 0) setSelTier(pkgIndex.tiers[0]);
  }, [pkgIndex.tiers, selTier]);

  useEffect(function(){
    var cancelled = false;
    supabase.from('menu_package_budgets').select('*').then(function(res){
      if (res.error) { console.error('[PackageBudget] load failed:', res.error); return; }
      var m = {};
      (res.data || []).forEach(function(r){
        m[String(r.package_id)] = { per_head_total: Number(r.per_head_total) || 0, dept_allocation: r.dept_allocation || {} };
      });
      if (!cancelled) setBudgets(m);
    });
    return function(){ cancelled = true; };
  }, []);

  if (!isAdmin) {
    return <Placeholder icon="lock" title={T2('Admin only')} body={T2('Package budgets are restricted to admins.')} />;
  }
  if (pkgLoaded && pkgIndex.tiers.length === 0) {
    return <Placeholder icon="box" title={T2('No packages yet')} body={T2('Create menu packages first, then set their budgets here.')} />;
  }
  if (!pkgLoaded || selTier == null) {
    return <Placeholder icon="box" title={T2('Loading…')} body={T2('Fetching menu packages.')} />;
  }

  var tierEntry = pkgIndex.byTier[selTier] || {};
  var dietsAvailable = ['veg', 'nonveg'].filter(function(d){ return !!tierEntry[d]; });
  var effDiet = tierEntry[selDiet] ? selDiet : (dietsAvailable[0] || null);
  var pkgRow = (effDiet && tierEntry[effDiet]) || tierEntry.unknown || null;
  var pkgId = pkgRow && pkgRow.id != null ? String(pkgRow.id) : null;
  var budget = (pkgId && budgets[pkgId]) || { per_head_total: 0, dept_allocation: {} };
  var alloc = budget.dept_allocation || {};

  // Per-head total is the SUM of the 7 dept amounts below, not its own typed
  // field — it used to be a separate manually-entered number (per_head_total)
  // that never moved when a dept amount changed, so admins filled in Kitchen/
  // Beverage/etc. and the total kept reading 0. It's still persisted as its
  // own column (other code may read menu_package_budgets.per_head_total
  // later), just always written as the computed sum rather than edited directly.
  async function saveDeptAmount(deptId, v) {
    if (!pkgId) return;
    var key = 'dept:' + deptId;
    setSavingKey(key);
    try {
      var nextAlloc = { ...alloc, [deptId]: v };
      var nextTotal = BUDGET_DEPTS.reduce(function(sum, d){ return sum + (Number(nextAlloc[d.id]) || 0); }, 0);
      var res = await supabase.from('menu_package_budgets')
        .upsert({ package_id: pkgId, per_head_total: nextTotal, dept_allocation: nextAlloc }, { onConflict: 'package_id' });
      if (res.error) throw res.error;
      setBudgets(function(prev){
        var next = { ...prev };
        next[pkgId] = { per_head_total: nextTotal, dept_allocation: nextAlloc };
        return next;
      });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  var allocatedSum = BUDGET_DEPTS.reduce(function(sum, d){ return sum + (Number(alloc[d.id]) || 0); }, 0);
  var total = allocatedSum;

  var dietLabel = { veg: T2('Veg'), nonveg: T2('Non-Veg') };

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <span style={{ ...type.pageTitle, fontSize: 22, color: K.hdrTitle }}>{T2('F&B Department Budget')}</span>
      </div>
      <div style={{ fontSize: 13, color: K.hdrMeta, marginBottom: 16 }}>
        {T2('Allocate per-head cost across 7 sub-departments for each menu package.')}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid ' + K.cardWarmLine, background: '#FFFFFF', padding: 3, gap: 2 }}>
          {pkgIndex.tiers.map(function(t){
            var on = t === selTier;
            return (
              <button key={t} onClick={function(){ setSelTier(t); }}
                style={{ padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontFamily: K.fontBody, fontSize: 13, fontWeight: on ? 700 : 600,
                  background: on ? K.hdrTitle : 'transparent', color: on ? '#FFFFFF' : K.textBody }}>
                {t}
              </button>
            );
          })}
        </div>
        {dietsAvailable.length > 0 && (
          <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid ' + K.cardWarmLine, background: '#FFFFFF', padding: 3, gap: 2 }}>
            {['veg', 'nonveg'].map(function(d){
              var available = !!tierEntry[d];
              var on = d === effDiet;
              return (
                <button key={d} onClick={function(){ if (available) setSelDiet(d); }} disabled={!available}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999, border: 'none',
                    cursor: available ? 'pointer' : 'not-allowed', opacity: available ? 1 : 0.35,
                    fontFamily: K.fontBody, fontSize: 13, fontWeight: on ? 700 : 600,
                    background: on ? (d === 'veg' ? '#1D9E75' : '#D64040') : 'transparent',
                    color: on ? '#FFFFFF' : K.textBody }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#FFFFFF' : (d === 'veg' ? '#1D9E75' : '#D64040') }} />
                  {dietLabel[d]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ borderRadius: 20, backgroundColor: K.cardWarm, border: '1px solid ' + K.cardWarmLine,
        boxShadow: K.shadowCard, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: K.textFaint }}>{T2('Per head total')}</div>
            <div style={{ fontSize: 13, color: K.hdrMeta, marginTop: 2 }}>{selTier} · {effDiet ? dietLabel[effDiet] : T2('Unclassified')}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: K.hdrMeta }}>₹</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: K.hdrTitle, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          </span>
        </div>

        {/* Stacked bar — proportional segments per dept */}
        <div style={{ display: 'flex', height: 34, borderRadius: 10, overflow: 'hidden', background: K.surfaceAlt, marginBottom: 12 }}>
          {total > 0 && BUDGET_DEPTS.filter(function(d){ return (Number(alloc[d.id]) || 0) > 0; }).map(function(d){
            var amt = Number(alloc[d.id]) || 0;
            var pct = (amt / total) * 100;
            return (
              <div key={d.id} title={T2(d.name) + ': ₹' + amt + '/pax'} style={{ width: pct + '%', background: d.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: pct > 6 ? undefined : 0 }}>
                {pct > 6 && <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>{d.name.slice(0, 3)}</span>}
              </div>
            );
          })}
        </div>

        {total === 0 && (
          <div style={{ fontSize: 12.5, color: K.textFaint, fontStyle: 'italic' }}>
            {T2('Set an amount in any department below — the total fills in on its own.')}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {BUDGET_DEPTS.map(function(d){
          var amt = Number(alloc[d.id]) || 0;
          var pct = total > 0 ? (amt / total) * 100 : 0;
          return (
            <div key={d.id} style={{ borderRadius: 16, backgroundColor: '#FFFFFF', border: '1px solid ' + K.cardWarmLine,
              boxShadow: K.shadowCard, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: d.bg, color: d.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={d.glyph} size={17} strokeWidth={1.8} />
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: K.hdrTitle }}>{T2(d.name)}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: K.textFaint, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
                </span>
              </div>
              <DeptPriceInput value={alloc[d.id]} saving={savingKey === 'dept:' + d.id}
                onSave={function(v){ saveDeptAmount(d.id, v); }} />
              <div style={{ height: 6, borderRadius: 3, background: K.surfaceAlt, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ width: Math.min(pct, 100) + '%', height: '100%', background: d.color, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>

      <KToast open={!!toast} toneName={toast && toast.tone} title={toast && toast.title}
        body={toast && toast.body} onClose={function(){ setToast(null); }} />
    </div>
  );
}

function Placeholder({ icon, title, body }) {
  return (
    <div style={{ padding: '56px 24px', textAlign: 'center', borderRadius: 20, backgroundColor: K.cardWarm,
      border: '1px solid ' + K.cardWarmLine, boxShadow: K.shadowCard }}>
      <span style={{ width: 54, height: 54, borderRadius: 17, margin: '0 auto 14px', background: K.sageBg,
        border: '1px solid ' + K.sageBorder, color: K.sage,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={23} strokeWidth={1.7} />
      </span>
      {title && <div style={{ ...type.cardTitle, fontSize: 16, color: K.hdrTitle, marginBottom: 5 }}>{title}</div>}
      <div style={{ ...type.meta, color: K.hdrMeta }}>{body}</div>
    </div>
  );
}

export default PackageBudgetView;
export { PackageBudgetView };
