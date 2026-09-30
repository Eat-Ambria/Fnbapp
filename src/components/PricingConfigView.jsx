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

const TYPE_ICONS = {
  options: 'layers', radio: 'listCheck', ratio: 'users',
  count: 'box', multi_count: 'listCheck', tags: 'tag',
};

function PriceInput({ value, onSave, saving, disabled }) {
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
      <span style={{ fontSize: 11.5, color: K.textFaint }}>/pax</span>
    </span>
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
  var [activeDept, setActiveDept] = useState('kit');
  var [sections, setSections] = useState([]);
  var [loadingSections, setLoadingSections] = useState(false);
  var [savingKey, setSavingKey] = useState(null);
  var [toast, setToast] = useState(null);
  var [, forceTick] = useState(0);

  useEffect(function(){
    if (activeDept !== 'kit') return;
    var cancelled = false;
    setLoadingSections(true);
    fetchAllRows(function(){
      return supabase.from('dish_catalogue_sections')
        .select('id,name,parent_section_id,sort_order,addon_price_per_pax')
        .eq('dept', 'kitchen').order('sort_order', { ascending: true });
    }).then(function(rows){ if (!cancelled) setSections(rows || []); })
      .catch(function(e){ console.error('[PricingConfig] load sections failed:', e); if (!cancelled) setSections([]); })
      .finally(function(){ if (!cancelled) setLoadingSections(false); });
    return function(){ cancelled = true; };
  }, [activeDept]);

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

      {activeDept === 'kit' ? (
        loadingSections ? (
          <Placeholder icon="listCheck" title={T2('Loading…')} body={T2('Fetching kitchen catalogue sections.')} />
        ) : topSections.length === 0 ? (
          <Placeholder icon="listCheck" title={T2('No sections yet')}
            body={T2('Add sections in Dish Library → Sections first, then set add-on pricing here.')} />
        ) : (
          <CardShell icon="listCheck" label={T2('Kitchen — add-on price per section')}>
            <div style={{ fontSize: 12, color: K.hdrMeta, padding: '0 2px 10px' }}>
              {T2('Charged per pax when a dish from this section is added as an extra beyond the package.')}
            </div>
            {topSections.map(function(sec){
              var kids = childrenOf[sec.id] || [];
              return (
                <React.Fragment key={sec.id}>
                  <Row name={sec.name}>
                    <PriceInput value={sec.addon_price_per_pax} saving={savingKey === 'sec:' + sec.id}
                      onSave={function(v){ saveSectionPrice(sec.id, v); }} />
                  </Row>
                  {kids.map(function(k){
                    return (
                      <div key={k.id} style={{ paddingLeft: 24 }}>
                        <Row name={k.name}>
                          <PriceInput value={k.addon_price_per_pax} saving={savingKey === 'sec:' + k.id}
                            onSave={function(v){ saveSectionPrice(k.id, v); }} />
                        </Row>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </CardShell>
        )
      ) : (
        (function(){
          var configs = DEPT_CONFIGS[activeDept] || [];
          var deptMeta = SALES_DEPT_MAP[activeDept];
          if (configs.length === 0) {
            return <Placeholder icon="sliders" title={(deptMeta && T2(deptMeta.name)) + ' — ' + T2('no configs yet')}
              body={T2('This department has no configs set up to price.')} />;
          }
          return configs.map(function(cfg){
            var icon = TYPE_ICONS[cfg.type] || 'sliders';
            if (cfg.type === 'count') {
              return (
                <CardShell key={cfg.key} icon={icon} label={cfg.label}>
                  <Row name={T2('Per unit, per pax')} desc={T2('Extra charge for each unit above the base count.')}>
                    <PriceInput value={cfg.pricePerPax} saving={savingKey === 'def:' + activeDept + ':' + cfg.key}
                      onSave={function(v){ saveDefPrice(activeDept, cfg.key, v); }} />
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
                      <PriceInput value={opt.price_per_pax} saving={savingKey === 'opt:' + activeDept + ':' + cfg.key + ':' + opt.id}
                        onSave={function(v){ saveOptionPrice(activeDept, cfg.key, opt.id, v); }} />
                    </Row>
                  );
                })}
              </CardShell>
            );
          });
        })()
      )}

      <KToast open={!!toast} toneName={toast && toast.tone} title={toast && toast.title}
        body={toast && toast.body} onClose={function(){ setToast(null); }} />
    </div>
  );
}

export default PricingConfigView;
export { PricingConfigView };
