// Ambria FnB — Pricing Config (V90)
// Admin-only backend for setting per-pax add-on pricing:
//   - Kitchen: a price per pax on each catalogue section, charged when a dish
//     from that section is added as an "extra" beyond the package.
//   - Every other dept (Beverage/Bakery/Fruits/Service/Crockery/Transport):
//     a price per pax on each config option (glassware, bartender ratio, ...),
//     charged when that option is picked over the base/free choice.
// Nothing else in the app reads these numbers yet — no quotation/billing
// feature exists — this is purely the data-entry backend for one.
// Place in: src/components/PricingConfigView.jsx

import React, { useState, useEffect } from 'react';
import { T } from '../data/translations.js';
import { SALES_DEPTS, SALES_DEPT_MAP, DEPT_CONFIGS } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import { K, type } from '../utils/theme.js';
import { Icon, KToast } from './KitchenUI.jsx';
import PackageBudgetView from './PackageBudgetView.jsx';

const TYPE_ICONS = {
  options: 'layers', radio: 'listCheck', ratio: 'users',
  count: 'box', multi_count: 'listCheck', tags: 'tag',
};

// Dish/item depts (ITEM_HAVING_DEPTS in salesConfig.js) have their own dish
// catalogue sections to price per-add-on, same mechanism as Kitchen; the
// remaining depts (Service/Crockery/Transport) have no dish catalogue at all
// — only DEPT_CONFIGS options — so they stay on the config-option pricing UI.
var SECTION_DEPT_MAP = { kit: 'kitchen', bev: 'beverage', bak: 'bakery', frt: 'fruits' };

function PriceInput({ value, onSave, saving, disabled, mode }) {
  var [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(function(){ setDraft(value == null ? '' : String(value)); }, [value]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: K.hdrMeta }}>₹</span>
      <input type="number" min="0" step="1" value={draft} disabled={disabled}
        onChange={function(e){ setDraft(e.target.value); }}
        onBlur={function(){
          var n = draft === '' ? 0 : Number(draft);
          if (!isFinite(n) || n < 0) n = 0;
          if (n !== (value || 0)) onSave(n);
          else setDraft(String(value || 0));
        }}
        style={{ width: 84, padding: '8px 10px', borderRadius: 10, border: '1px solid ' + K.line,
          fontSize: 13.5, fontWeight: 700, color: K.text, background: disabled ? K.surfaceAlt : '#FFFFFF',
          boxSizing: 'border-box', fontFamily: K.fontBody, outline: 'none',
          opacity: saving ? 0.5 : 1 }} />
      <span style={{ fontSize: 11.5, color: K.textFaint }}>{mode === 'flat' ? 'flat' : '/pax'}</span>
    </span>
  );
}

// A priced row's pricing basis — tap to flip between "charged per guest" and
// "one flat amount regardless of headcount" (Vehicles, Special Pieces, a
// staffing ratio's own rate...). Every row defaults to per_pax; this is the
// one place that default gets overridden, per row, by whoever sets the price.
function ModeToggle({ mode, onChange, saving }) {
  var isFlat = mode === 'flat';
  return (
    <button type="button" onClick={function(){ onChange(isFlat ? 'per_pax' : 'flat'); }}
      disabled={saving}
      title={isFlat ? 'Flat charge, regardless of guest count — click to switch to per-pax' : 'Charged per guest — click to switch to a flat amount'}
      style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid ' + (isFlat ? K.warnBorder : K.line),
        background: isFlat ? K.warnBg : K.surfaceAlt, color: isFlat ? K.warn : K.textMuted,
        fontSize: 10, fontWeight: 700, letterSpacing: '.3px', cursor: saving ? 'wait' : 'pointer',
        whiteSpace: 'nowrap', flexShrink: 0, opacity: saving ? 0.6 : 1 }}>
      {isFlat ? 'FLAT' : '/PAX'}
    </button>
  );
}

// Config-only (never on a dish/catalogue section — food is never "free by
// default" the way standard crockery or a service setup is). Included means
// every package already covers it, so it should never be charged as an
// add-on regardless of which price is on file for it.
function IncludedToggle({ included, onChange, saving }) {
  return (
    <button type="button" onClick={function(){ onChange(!included); }}
      disabled={saving}
      title={included ? 'Included in every package — click to price it as an add-on instead' : 'Priced as an add-on — click to mark it included in every package'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
        border: '1px solid ' + (included ? K.okBorder : K.line),
        background: included ? K.okBg : K.surfaceAlt, color: included ? K.ok : K.textMuted,
        fontSize: 10, fontWeight: 700, letterSpacing: '.3px', cursor: saving ? 'wait' : 'pointer',
        whiteSpace: 'nowrap', flexShrink: 0, opacity: saving ? 0.6 : 1 }}>
      {included ? <Icon name="check" size={11} strokeWidth={2.4} /> : null}
      {included ? 'INCLUDED' : 'ADD-ON'}
    </button>
  );
}

// Edits a ratio tier's own "1 : N" value (e.g. 1 staff per 25 guests) — the
// definition itself, not its price. num stays fixed at 1 (every ratio here
// reads "1 : N"); only the guest count per unit is ever adjusted.
function RatioInput({ value, onSave, saving }) {
  var [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(function(){ setDraft(value == null ? '' : String(value)); }, [value]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: K.hdrMeta }}>1 :</span>
      <input type="number" min="1" step="1" value={draft}
        onChange={function(e){ setDraft(e.target.value); }}
        onBlur={function(){
          var n = draft === '' ? 1 : Number(draft);
          if (!isFinite(n) || n < 1) n = 1;
          if (n !== (value || 0)) onSave(n);
          else setDraft(String(value || 0));
        }}
        style={{ width: 54, padding: '8px 10px', borderRadius: 10, border: '1px solid ' + K.line,
          fontSize: 13.5, fontWeight: 700, color: K.text, background: '#FFFFFF',
          boxSizing: 'border-box', fontFamily: K.fontBody, outline: 'none', opacity: saving ? 0.5 : 1 }} />
      <span style={{ fontSize: 11.5, color: K.textFaint }}>{'guests'}</span>
    </span>
  );
}

function Chip({ name, sub, value, onSave, saving, mode, onModeChange, modeSaving }) {
  return (
    <div style={{ borderRadius: 14, border: '1px solid ' + K.line, background: '#FFFFFF',
      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={{ minWidth: 0 }}>
        {sub && <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: K.textFaint,
          textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 1 }}>{sub}</span>}
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: K.hdrTitle,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name}>{name}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <PriceInput value={value} saving={saving} onSave={onSave} mode={mode} />
        {onModeChange && <ModeToggle mode={mode} onChange={onModeChange} saving={modeSaving} />}
      </span>
    </div>
  );
}

function Row({ icon, name, desc, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px',
      borderTop: '1px solid ' + K.lineSoft }}>
      {icon && <span style={{ color: K.sage, display: 'flex', flexShrink: 0 }}>
        <Icon name={icon} size={16} strokeWidth={1.8} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: K.hdrTitle }}>{name}</span>
        {desc && <span style={{ display: 'block', fontSize: 12, color: K.hdrMeta, marginTop: 1 }}>{desc}</span>}
      </span>
      {children}
    </div>
  );
}

function CardShell({ icon, label, children }) {
  return (
    <section style={{ borderRadius: 20, backgroundColor: K.cardWarm,
      border: '1px solid ' + K.cardWarmLine, boxShadow: K.shadowCard, padding: '15px 16px 6px', marginBottom: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, padding: '0 2px' }}>
        <span style={{ color: K.sage, display: 'flex', flexShrink: 0 }}><Icon name={icon} size={19} strokeWidth={1.8} /></span>
        <span style={{ ...type.sectionHead, fontSize: 17, letterSpacing: '.4px', color: K.hdrTitle }}>{label}</span>
      </header>
      {children}
    </section>
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

function PricingConfigView({ lang = 'en', currentUser = null }) {
  var T2 = function(s) { return T(s, lang); };
  var isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'headchef');
  var [mode, setMode] = useState('addons'); // 'addons' | 'budgets'
  var [activeDept, setActiveDept] = useState('kit');
  var [sections, setSections] = useState([]);
  var [loadingSections, setLoadingSections] = useState(false);
  var [savingKey, setSavingKey] = useState(null);
  var [toast, setToast] = useState(null);
  var [, forceTick] = useState(0);
  var [collapsedGroups, setCollapsedGroups] = useState(function(){ return new Set(); });
  function toggleGroup(id) {
    setCollapsedGroups(function(prev){
      var next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  var sectionDept = SECTION_DEPT_MAP[activeDept];
  useEffect(function(){
    if (!sectionDept) return;
    var cancelled = false;
    setLoadingSections(true);
    fetchAllRows(function(){
      return supabase.from('dish_catalogue_sections')
        .select('id,name,parent_section_id,sort_order,addon_price_per_pax,pricing_mode')
        .eq('dept', sectionDept).order('sort_order', { ascending: true });
    }).then(function(rows){ if (!cancelled) setSections(rows || []); })
      .catch(function(e){ console.error('[PricingConfig] load sections failed:', e); if (!cancelled) setSections([]); })
      .finally(function(){ if (!cancelled) setLoadingSections(false); });
    return function(){ cancelled = true; };
  }, [sectionDept]);

  async function saveSectionPrice(sectionId, price) {
    var key = 'sec:' + sectionId;
    setSavingKey(key);
    try {
      var res = await supabase.from('dish_catalogue_sections').update({ addon_price_per_pax: price }).eq('id', sectionId);
      if (res.error) throw res.error;
      setSections(function(prev){ return prev.map(function(s){ return s.id === sectionId ? { ...s, addon_price_per_pax: price } : s; }); });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  async function saveSectionMode(sectionId, mode) {
    var key = 'secmode:' + sectionId;
    setSavingKey(key);
    try {
      var res = await supabase.from('dish_catalogue_sections').update({ pricing_mode: mode }).eq('id', sectionId);
      if (res.error) throw res.error;
      setSections(function(prev){ return prev.map(function(s){ return s.id === sectionId ? { ...s, pricing_mode: mode } : s; }); });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  async function saveRatioDen(deptId, configKey, optionId, den) {
    var key = 'ratioden:' + deptId + ':' + configKey + ':' + optionId;
    setSavingKey(key);
    try {
      var res = await supabase.from('sales_config_options').update({ ratio_den: den })
        .eq('dept_id', deptId).eq('config_key', configKey).eq('option_id', optionId);
      if (res.error) throw res.error;
      var cfg = (DEPT_CONFIGS[deptId] || []).find(function(c){ return c.key === configKey; });
      if (cfg && cfg.ratios) {
        var row = cfg.ratios.find(function(o){ return o.id === optionId; });
        if (row) row.den = den;
      }
      forceTick(function(t){ return t + 1; });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  async function saveOptionPrice(deptId, configKey, optionId, price) {
    var key = 'opt:' + deptId + ':' + configKey + ':' + optionId;
    setSavingKey(key);
    try {
      var res = await supabase.from('sales_config_options').update({ price_per_pax: price })
        .eq('dept_id', deptId).eq('config_key', configKey).eq('option_id', optionId);
      if (res.error) throw res.error;
      var cfg = (DEPT_CONFIGS[deptId] || []).find(function(c){ return c.key === configKey; });
      if (cfg) {
        var list = cfg.type === 'ratio' ? cfg.ratios : cfg.options;
        var row = (list || []).find(function(o){ return o.id === optionId; });
        if (row) row.price_per_pax = price;
      }
      forceTick(function(t){ return t + 1; });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  async function saveDefPrice(deptId, configKey, price) {
    var key = 'def:' + deptId + ':' + configKey;
    setSavingKey(key);
    try {
      var res = await supabase.from('sales_config_defs').update({ price_per_pax: price })
        .eq('dept_id', deptId).eq('config_key', configKey);
      if (res.error) throw res.error;
      var cfg = (DEPT_CONFIGS[deptId] || []).find(function(c){ return c.key === configKey; });
      if (cfg) cfg.pricePerPax = price;
      forceTick(function(t){ return t + 1; });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  // ── Pricing mode (V95): flat vs per-pax, per priced row ──
  async function saveOptionMode(deptId, configKey, optionId, mode) {
    var key = 'optmode:' + deptId + ':' + configKey + ':' + optionId;
    setSavingKey(key);
    try {
      var res = await supabase.from('sales_config_options').update({ pricing_mode: mode })
        .eq('dept_id', deptId).eq('config_key', configKey).eq('option_id', optionId);
      if (res.error) throw res.error;
      var cfg = (DEPT_CONFIGS[deptId] || []).find(function(c){ return c.key === configKey; });
      if (cfg) {
        var list = cfg.type === 'ratio' ? cfg.ratios : cfg.options;
        var row = (list || []).find(function(o){ return o.id === optionId; });
        if (row) row.pricing_mode = mode;
      }
      forceTick(function(t){ return t + 1; });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  async function saveDefMode(deptId, configKey, mode) {
    var key = 'defmode:' + deptId + ':' + configKey;
    setSavingKey(key);
    try {
      var res = await supabase.from('sales_config_defs').update({ pricing_mode: mode })
        .eq('dept_id', deptId).eq('config_key', configKey);
      if (res.error) throw res.error;
      var cfg = (DEPT_CONFIGS[deptId] || []).find(function(c){ return c.key === configKey; });
      if (cfg) cfg.pricingMode = mode;
      forceTick(function(t){ return t + 1; });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  // ── Included-in-every-package (V95 follow-up) — config items only ──
  async function saveOptionIncluded(deptId, configKey, optionId, included) {
    var key = 'optinc:' + deptId + ':' + configKey + ':' + optionId;
    setSavingKey(key);
    try {
      var res = await supabase.from('sales_config_options').update({ is_included: included })
        .eq('dept_id', deptId).eq('config_key', configKey).eq('option_id', optionId);
      if (res.error) throw res.error;
      var cfg = (DEPT_CONFIGS[deptId] || []).find(function(c){ return c.key === configKey; });
      if (cfg) {
        var list = cfg.type === 'ratio' ? cfg.ratios : cfg.options;
        var row = (list || []).find(function(o){ return o.id === optionId; });
        if (row) row.is_included = included;
      }
      forceTick(function(t){ return t + 1; });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  async function saveDefIncluded(deptId, configKey, included) {
    var key = 'definc:' + deptId + ':' + configKey;
    setSavingKey(key);
    try {
      var res = await supabase.from('sales_config_defs').update({ is_included: included })
        .eq('dept_id', deptId).eq('config_key', configKey);
      if (res.error) throw res.error;
      var cfg = (DEPT_CONFIGS[deptId] || []).find(function(c){ return c.key === configKey; });
      if (cfg) cfg.isIncluded = included;
      forceTick(function(t){ return t + 1; });
    } catch (e) {
      setToast({ tone: 'danger', title: T2('Could not save'), body: String((e && e.message) || e) });
    } finally { setSavingKey(null); }
  }

  if (!isAdmin) {
    return <Placeholder icon="lock" title={T2('Admin only')}
      body={T2('Pricing configuration is restricted to admins.')} />;
  }

  // ── Kitchen: section tree (top-level + one level of subsections) ──
  var topSections = sections.filter(function(s){ return !s.parent_section_id; });
  var childrenOf = {};
  sections.forEach(function(s){ if (s.parent_section_id) { (childrenOf[s.parent_section_id] = childrenOf[s.parent_section_id] || []).push(s); } });

  return (
    <div>
      <div style={{ display: 'inline-flex', borderRadius: 999, border: '1px solid ' + K.cardWarmLine, background: '#FFFFFF', padding: 3, gap: 2, marginBottom: 16 }}>
        {[['addons', 'Add-on pricing'], ['budgets', 'Package budgets']].map(function(m){
          var on = mode === m[0];
          return (
            <button key={m[0]} onClick={function(){ setMode(m[0]); }}
              style={{ padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: K.fontBody, fontSize: 13, fontWeight: on ? 700 : 600,
                background: on ? K.brand : 'transparent', color: on ? '#FFFFFF' : K.textBody }}>
              {T2(m[1])}
            </button>
          );
        })}
      </div>

      {mode === 'budgets' ? (
        <PackageBudgetView lang={lang} currentUser={currentUser} />
      ) : (<>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SALES_DEPTS.map(function(d){
          var on = activeDept === d.id;
          return (
            <button key={d.id} onClick={function(){ setActiveDept(d.id); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999,
                fontFamily: K.fontBody, fontSize: 13, fontWeight: on ? 700 : 600, cursor: 'pointer',
                background: on ? K.brand : '#FFFFFF', color: on ? '#FFFFFF' : K.textBody,
                border: '1px solid ' + (on ? K.brand : K.cardWarmLine) }}>
              <Icon name={d.glyph} size={14} strokeWidth={1.9} />{T2(d.name)}
            </button>
          );
        })}
      </div>

      {sectionDept && (
        loadingSections ? (
          <Placeholder icon="listCheck" title={T2('Loading…')} body={T2('Fetching catalogue sections.')} />
        ) : topSections.length === 0 ? (
          <Placeholder icon="listCheck" title={T2('No sections yet')}
            body={T2('Add sections in Dish Library → Sections first, then set add-on pricing here.')} />
        ) : (
          <CardShell icon="listCheck" label={T2(SALES_DEPT_MAP[activeDept].name) + ' — ' + T2('add-on price per section')}>
            <div style={{ fontSize: 12, color: K.hdrMeta, padding: '0 2px 12px' }}>
              {T2('Charged per pax when a dish from this section is added as an extra beyond the package.')}
            </div>
            {(function(){
              // Sections with subsections get their own row-block (header +
              // a mini-grid of just their children) so a group never shares a
              // row with an unrelated section — plain leaf sections still
              // pack 4-up together, but only with their own kind.
              var blocks = [];
              var leafBuffer = [];
              topSections.forEach(function(sec){
                var kids = childrenOf[sec.id] || [];
                if (kids.length === 0) { leafBuffer.push(sec); return; }
                if (leafBuffer.length) { blocks.push({ type: 'leaves', items: leafBuffer }); leafBuffer = []; }
                blocks.push({ type: 'group', parent: sec, kids: kids });
              });
              if (leafBuffer.length) blocks.push({ type: 'leaves', items: leafBuffer });

              return blocks.map(function(b, bi){
                if (b.type === 'leaves') {
                  return (
                    <div key={'l' + bi} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                      {b.items.map(function(sec){
                        return <Chip key={sec.id} name={sec.name} value={sec.addon_price_per_pax} mode={sec.pricing_mode}
                          saving={savingKey === 'sec:' + sec.id} onSave={function(v){ saveSectionPrice(sec.id, v); }}
                          modeSaving={savingKey === 'secmode:' + sec.id} onModeChange={function(m){ saveSectionMode(sec.id, m); }} />;
                      })}
                    </div>
                  );
                }
                var collapsed = collapsedGroups.has(b.parent.id);
                return (
                  <div key={'g' + bi} style={{ borderRadius: 14, border: '1px solid ' + K.line,
                    background: K.surfaceAlt, padding: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: collapsed ? 0 : 10 }}>
                      <button onClick={function(){ toggleGroup(b.parent.id); }} title={collapsed ? T2('Expand') : T2('Collapse')}
                        style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid ' + K.line, background: '#FFFFFF',
                          color: K.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
                        <Icon name={collapsed ? 'chevronR' : 'chevronD'} size={13} strokeWidth={2.2} />
                      </button>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: K.hdrTitle,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.parent.name}>
                        {b.parent.name}
                        <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 600, color: K.textFaint }}>({b.kids.length})</span>
                      </span>
                      <PriceInput value={b.parent.addon_price_per_pax} saving={savingKey === 'sec:' + b.parent.id}
                        onSave={function(v){ saveSectionPrice(b.parent.id, v); }} mode={b.parent.pricing_mode} />
                      <ModeToggle mode={b.parent.pricing_mode} saving={savingKey === 'secmode:' + b.parent.id}
                        onChange={function(m){ saveSectionMode(b.parent.id, m); }} />
                    </div>
                    {!collapsed && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {b.kids.map(function(k){
                          return <Chip key={k.id} name={k.name} value={k.addon_price_per_pax} mode={k.pricing_mode}
                            saving={savingKey === 'sec:' + k.id} onSave={function(v){ saveSectionPrice(k.id, v); }}
                            modeSaving={savingKey === 'secmode:' + k.id} onModeChange={function(m){ saveSectionMode(k.id, m); }} />;
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </CardShell>
        )
      )}

      {/* Every dept's own configs (Fruit Display, Glassware, Chef Ratio...)
          used to be hidden entirely for Kitchen/Beverage/Bakery/Fruits — this
          branch only ever ran for Service/Crockery/Transport, which have no
          dish catalogue of their own. They're real, already-populated configs,
          so show them alongside the catalogue-section pricing above rather
          than instead of it. */}
      {(function(){
        var configs = DEPT_CONFIGS[activeDept] || [];
        var deptMeta = SALES_DEPT_MAP[activeDept];
        if (configs.length === 0) {
          if (sectionDept) return null; // catalogue-section pricing above already covers this dept
          return <Placeholder icon="sliders" title={(deptMeta && T2(deptMeta.name)) + ' — ' + T2('no configs yet')}
            body={T2('This department has no configs set up to price.')} />;
        }
        return configs.map(function(cfg){
          var icon = TYPE_ICONS[cfg.type] || 'sliders';
          if (cfg.type === 'count') {
            return (
              <CardShell key={cfg.key} icon={icon} label={cfg.label}>
                <Row name={T2('Per unit')} desc={T2('Extra charge for each unit above the base count.')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <IncludedToggle included={!!cfg.isIncluded} saving={savingKey === 'definc:' + activeDept + ':' + cfg.key}
                      onChange={function(v){ saveDefIncluded(activeDept, cfg.key, v); }} />
                    <PriceInput value={cfg.pricePerPax} saving={savingKey === 'def:' + activeDept + ':' + cfg.key}
                      disabled={!!cfg.isIncluded}
                      onSave={function(v){ saveDefPrice(activeDept, cfg.key, v); }} mode={cfg.pricingMode} />
                    <ModeToggle mode={cfg.pricingMode} saving={savingKey === 'defmode:' + activeDept + ':' + cfg.key}
                      onChange={function(m){ saveDefMode(activeDept, cfg.key, m); }} />
                  </span>
                </Row>
              </CardShell>
            );
          }
          var list = cfg.type === 'ratio' ? (cfg.ratios || []) : (cfg.options || []);
          return (
            <CardShell key={cfg.key} icon={icon} label={cfg.label}>
              {list.length === 0 ? (
                <div style={{ fontSize: 12.5, color: K.textFaint, padding: '4px 2px 10px' }}>{T2('No options set up yet.')}</div>
              ) : list.map(function(opt){
                var name = cfg.type === 'ratio' ? opt.label : opt.name;
                var desc = cfg.type === 'ratio' ? null : opt.desc;
                return (
                  <Row key={opt.id} name={name} desc={desc}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <IncludedToggle included={!!opt.is_included} saving={savingKey === 'optinc:' + activeDept + ':' + cfg.key + ':' + opt.id}
                        onChange={function(v){ saveOptionIncluded(activeDept, cfg.key, opt.id, v); }} />
                      {cfg.type === 'ratio' && (
                        <RatioInput value={opt.den} saving={savingKey === 'ratioden:' + activeDept + ':' + cfg.key + ':' + opt.id}
                          onSave={function(v){ saveRatioDen(activeDept, cfg.key, opt.id, v); }} />
                      )}
                      <PriceInput value={opt.price_per_pax} saving={savingKey === 'opt:' + activeDept + ':' + cfg.key + ':' + opt.id}
                        disabled={!!opt.is_included}
                        onSave={function(v){ saveOptionPrice(activeDept, cfg.key, opt.id, v); }} mode={opt.pricing_mode} />
                      <ModeToggle mode={opt.pricing_mode} saving={savingKey === 'optmode:' + activeDept + ':' + cfg.key + ':' + opt.id}
                        onChange={function(m){ saveOptionMode(activeDept, cfg.key, opt.id, m); }} />
                    </span>
                  </Row>
                );
              })}
            </CardShell>
          );
        });
      })()}

      <KToast open={!!toast} toneName={toast && toast.tone} title={toast && toast.title}
        body={toast && toast.body} onClose={function(){ setToast(null); }} />
      </>)}
    </div>
  );
}

export default PricingConfigView;
export { PricingConfigView };
