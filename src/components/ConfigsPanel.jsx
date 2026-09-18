// Ambria FnB — Configs Panel (Sales)
// V70 Phase 5A: 6 reusable config panel types + orchestrator over proposal_configs table.
// Place in: src/components/ConfigsPanel.jsx
//
// The data layer here is untouched from Phase 5A — load, realtime, optimistic
// save and rollback all behave exactly as before. What changed is the surface:
// this panel was built from the C palette (cool grey on a wine accent) while the
// screen it renders inside is warm ivory and deep green, so it read as a page
// from a different application. Everything below now draws from K and the type
// scale, the same as the dish grid it sits beside.

import { useState, useEffect } from "react";
import { T } from '../data/translations.js';
import { DEPT_CONFIGS, SALES_DEPT_MAP } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';
import { K, type } from '../utils/theme.js';
import { Icon, KToast } from './KitchenUI.jsx';
import { ripple } from '../utils/ripple.js';

// ── Presentation lookups ──────────────────────────────────────────────────
// The catalogue ships an emoji per config and per option, straight from
// Supabase. Rather than render those, each one is matched to a line icon from
// the set the rest of the screen uses. Matching is on the key first because that
// is the stable field, then the label, then the control type — so a config added
// to the catalogue later still resolves to something sensible.
//
// The subtitle and the tagline are NOT in the catalogue; they are copy that
// lives here. If they should be editable they belong in sales_config_defs
// beside label, and this map becomes the fallback. Anything unmatched simply
// renders without them rather than showing a placeholder.
const CFG_COPY = [
  [/vehicle|transport|truck|van/, "truck", "Reliable transport for a seamless event", "On-site. On time. Every time."],
  [/cold|chill|ice|thermal|freez/, "box", "Keep it fresh, from kitchen to celebration", "Fresh moments. Always."],
  [/crew|staff|ratio|manpower|steward/, "users", "Choose the right team for a flawless setup", "A well-prepared team makes all the difference."],
  [/bever|drink|bar|juice/, "cup", "", ""],
  [/crocker|plate|cutler|glass/, "plate", "", ""],
  [/bak|cake|dessert/, "cake", "", ""],
  [/fruit/, "apple", "", ""],
  [/tent|setup|venue|layout/, "tent", "", ""],
  [/time|shift|hour/, "clock", "", ""],
];
const TYPE_ICONS = {
  options: "layers", radio: "listCheck", ratio: "users",
  count: "box", multi_count: "listCheck", tags: "tag",
};
function cfgCopy(cfg) {
  const hay = String((cfg.key || "") + " " + (cfg.label || "")).toLowerCase();
  for (const [re, icon, sub, tag] of CFG_COPY) if (re.test(hay)) return { icon, sub, tag };
  return { icon: TYPE_ICONS[cfg.type] || "sliders", sub: "", tag: "" };
}

const OPT_ICONS = [
  [/van|truck|tempo|traveller|lorry|vehicle|carrier/, "truck"],
  [/thermal|insulat|bag|hamper/,                      "box"],
  [/ice|chill|cold|freez|cooler/,                     "box"],
  [/staff|crew|team|steward|waiter/,                  "users"],
  [/plate|crocker|cutler/,                            "plate"],
  [/glass|cup|mug|drink|bever/,                       "cup"],
  [/burner|flame|stove|tandoor/,                      "flame"],
  [/tent|canop|gazebo|stall|counter/,                 "tent"],
];
function optIcon(opt, fallback) {
  const hay = String((opt.id || "") + " " + (opt.name || "") + " " + (opt.desc || "")).toLowerCase();
  for (const [re, name] of OPT_ICONS) if (re.test(hay)) return name;
  return fallback;
}

export function ConfigsPanel({ proposal, activeDept, lang = "en" }) {
  var T2 = function(s) { return T(s, lang); };
  var configs = DEPT_CONFIGS[activeDept] || [];
  var deptMeta = SALES_DEPT_MAP[activeDept];

  var [values, setValues]   = useState({}); // { [dept_id]: { [config_key]: config_value } }
  var [loading, setLoading] = useState(true);
  var [toast, setToast]     = useState(null);

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
      // A browser alert stops the page dead and looks nothing like the rest of
      // this screen; the change is rolled back below either way, so the toast
      // is doing the whole job.
      setToast({ tone: 'danger', title: T2('Failed to save config:'), body: (e && e.message) || String(e) });
      // Rollback via reload
      loadConfigs();
    }
  }

  // ── RENDER ──
  var deptValues = values[activeDept] || {};

  if (loading) return <Placeholder icon="sliders" body={T2("Loading configurations…")} />;

  if (configs.length === 0) {
    return (
      <Placeholder icon="sliders" dashed
        title={(deptMeta && deptMeta.name) + ' — ' + T2("Phase 5B")}
        body={T2("Config options for this department ship in Phase 5B.")} />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {configs.map(function(cfg){
        var val = deptValues[cfg.key];
        var isSet = val !== undefined && val !== null;
        var copy = cfgCopy(cfg);
        return (
          // Each config is a card. They used to be bare headings stacked
          // straight on the page artwork, which left the rows sitting on a
          // photograph with nothing holding them together — the same failure the
          // station rows had in the Closing tab.
          <section key={cfg.key} style={{ borderRadius: 20, backgroundColor: K.cardWarm,
            border: "1px solid " + K.cardWarmLine, boxShadow: K.shadowCard, padding: "15px 16px 16px" }}>
            <SectionHead label={cfg.label} icon={copy.icon} sub={copy.sub && T2(copy.sub)}
              tag={copy.tag && T2(copy.tag)} isSet={isSet} T2={T2} />
            {cfg.type === 'options'     && <OptionsPicker    cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} copy={copy} T2={T2} />}
            {cfg.type === 'radio'       && <RadioCards       cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} copy={copy} T2={T2} />}
            {cfg.type === 'ratio'       && <RatioSelector    cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} proposal={proposal} T2={T2} />}
            {cfg.type === 'count'       && <CountSelector    cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} T2={T2} />}
            {cfg.type === 'multi_count' && <MultiSelectCount cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} copy={copy} T2={T2} />}
            {cfg.type === 'tags'        && <TagToggles       cfg={cfg} value={val} onChange={function(v){ saveConfig(cfg.key, v); }} T2={T2} />}
          </section>
        );
      })}

      <KToast open={!!toast} toneName={toast && toast.tone} title={toast && toast.title}
        body={toast && toast.body} onClose={function(){ setToast(null); }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED PIECES
// ═══════════════════════════════════════════════════════════════

function Placeholder({ icon, title, body, dashed }) {
  return (
    <div style={{ padding: "56px 24px", textAlign: "center", borderRadius: 20, backgroundColor: K.cardWarm,
      border: (dashed ? "1px dashed " : "1px solid ") + K.cardWarmLine, boxShadow: K.shadowCard }}>
      <span style={{ width: 54, height: 54, borderRadius: 17, margin: "0 auto 14px", background: K.sageBg,
        border: "1px solid " + K.sageBorder, color: K.sage,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={23} strokeWidth={1.7} />
      </span>
      {title && <div style={{ ...type.cardTitle, fontSize: 16, color: K.hdrTitle, marginBottom: 5 }}>{title}</div>}
      <div style={{ ...type.meta, color: K.hdrMeta }}>{body}</div>
    </div>
  );
}

// Icon, display-face title, plain subtitle, then a gold rule and the tagline
// pushed to the far edge. The rule is what stops the tagline reading as one more
// column of data — it marks it as an aside.
function SectionHead({ label, icon, sub, tag, isSet, T2 }) {
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap", marginBottom: 12, padding: "0 2px" }}>
      <span style={{ color: K.sage, display: "flex", flexShrink: 0 }}>
        <Icon name={icon} size={21} strokeWidth={1.8} />
      </span>
      <span style={{ ...type.sectionHead, fontSize: 19, letterSpacing: ".6px", color: K.hdrTitle }}>{label}</span>
      {sub && <span style={{ ...type.meta, color: K.hdrMeta }}>{sub}</span>}
      {isSet && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
          padding: "3px 9px", borderRadius: K.rPill, background: K.sageBg, border: "1px solid " + K.sageBorder,
          color: K.sageText, fontSize: 11, fontWeight: 700, letterSpacing: ".3px" }}>
          <Icon name="check" size={11} strokeWidth={2.6} />{T2("Set")}
        </span>
      )}
      {tag && (
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: 34, height: 1, background: K.sbGold, opacity: .7, flexShrink: 0 }} />
          <span style={{ fontFamily: K.fontDisplay, fontStyle: "italic", fontSize: 15,
            color: K.hdrMetaStrong, whiteSpace: "nowrap" }}>{tag}</span>
        </span>
      )}
    </header>
  );
}

// The glyph tile that opens every row and every option card. Selected fills
// solid so the tile itself carries the state, not just the border around it.
function Tile({ name, on, size }) {
  var s = size || 46;
  return (
    <span style={{ width: s, height: s, borderRadius: Math.round(s * 0.3), flexShrink: 0,
      background: on ? K.sage : K.sageBg, border: "1px solid " + (on ? K.sage : K.sageBorder),
      color: on ? "#FFFFFF" : K.sage, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name={name} size={Math.round(s * 0.46)} strokeWidth={1.7} />
    </span>
  );
}

// A segmented stepper: the two keys share one outline with the value between
// them, so it reads as a single control rather than three loose buttons.
function Stepper({ value, onDec, onInc, canDec, canInc }) {
  var key = function(enabled){ return {
    width: 36, height: 34, flexShrink: 0, border: "none", background: "transparent",
    color: enabled ? K.sageText : K.textFaint, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : .4, padding: 0,
  }; };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, borderRadius: 11,
      background: K.sageBg, border: "1px solid " + K.sageBorder, overflow: "hidden" }}>
      <button type="button" className="kh-btn kh-stepkey" onClick={onDec} disabled={!canDec}
        style={key(canDec)} aria-label="decrease">
        <span style={{ width: 11, height: 2, borderRadius: 1, background: "currentColor" }} />
      </button>
      {/* Zero is deliberately faint. Down a list of twenty rows the eye should
          land on the ones that actually carry a number. */}
      <span style={{ minWidth: 40, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
        background: "#FFFFFF", borderLeft: "1px solid " + K.sageBorder, borderRight: "1px solid " + K.sageBorder,
        ...type.num, fontSize: 15, color: value > 0 ? K.hdrTitle : K.textFaint }}>{value}</span>
      <button type="button" className="kh-btn kh-stepkey" onClick={onInc} disabled={!canInc}
        style={key(canInc)} aria-label="increase">
        <Icon name="plus" size={13} strokeWidth={2.8} />
      </button>
    </div>
  );
}

// A real control instead of the browser checkbox, which rendered as a small
// blue-grey square and was the last cool-toned thing left on this screen.
function Check({ on, onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={label}
      style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer", padding: 0,
        background: on ? K.sage : "#FFFFFF", border: "1.5px solid " + (on ? K.sage : K.lineStrong),
        color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {on && <Icon name="check" size={13} strokeWidth={2.8} />}
    </button>
  );
}

function Radio({ on }) {
  return (
    <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
      border: "2px solid " + (on ? K.sage : K.lineStrong),
      background: on ? K.sage : "transparent",
      boxShadow: on ? "inset 0 0 0 3px #FFFFFF" : "none" }} />
  );
}

// A selected surface, everywhere on this panel. Sage rather than the brand
// green: at full strength the brand reads as near-black on a pale face, which is
// a hard edge to put around something that is merely picked. Sage is already
// this codebase's second selection colour — it is what an add-on dish wears.
// Both states carry a 1.5px border so nothing shifts when a row is chosen.
function pick(isSel) {
  return {
    backgroundColor: isSel ? K.sageSel : "#FFFFFF",
    border: "1.5px solid " + (isSel ? K.sage : K.cardWarmLine),
  };
}

// ═══════════════════════════════════════════════════════════════
// OPTIONS PICKER — single-select card grid
// ═══════════════════════════════════════════════════════════════
function OptionsPicker({ cfg, value, onChange, copy }) {
  var selId = value && value.selected_id;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 10 }}>
      {(cfg.options || []).map(function(opt){
        var isSel = selId === opt.id;
        return (
          <button key={opt.id} type="button" className={"kh-btn kh-cfgrow kh-rip" + (isSel ? " is-on" : "")}
            onPointerDown={ripple} onClick={function(){ onChange({ selected_id: opt.id }); }}
            style={{ ...pick(isSel), padding: "12px 13px", borderRadius: 14, textAlign: "left",
              cursor: "pointer", fontFamily: K.fontBody, display: "flex", alignItems: "center", gap: 12 }}>
            <Tile name={optIcon(opt, copy.icon)} on={isSel} size={40} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ ...type.rowTitle, display: "block", color: isSel ? K.sageText : K.hdrTitle }}>{opt.name}</span>
              {opt.desc && <span style={{ ...type.meta, display: "block", color: K.hdrMeta, marginTop: 1 }}>{opt.desc}</span>}
            </span>
            {isSel && <span style={{ color: K.sage, display: "flex", flexShrink: 0 }}>
              <Icon name="check" size={16} strokeWidth={2.6} /></span>}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RADIO CARDS — semantically same as options but with radio visual
// ═══════════════════════════════════════════════════════════════
function RadioCards({ cfg, value, onChange, copy }) {
  var selId = value && value.selected_id;
  return (
    // Tiles, not a stack. These are a handful of mutually exclusive choices
    // being compared against each other, and a full-width row per option put
    // each one on its own line with the whole window of empty space beside it.
    // Same grid as the ratio cards, which are the same kind of decision.
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
      {(cfg.options || []).map(function(opt){
        var isSel = selId === opt.id;
        return (
          <button key={opt.id} type="button" className={"kh-btn kh-cfgrow kh-rip" + (isSel ? " is-on" : "")}
            onPointerDown={ripple} onClick={function(){ onChange({ selected_id: opt.id }); }}
            style={{ ...pick(isSel), padding: "14px 16px 13px", borderRadius: 16, textAlign: "left",
              cursor: "pointer", fontFamily: K.fontBody }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Radio on={isSel} />
              <span style={{ marginLeft: "auto" }}><Tile name={optIcon(opt, copy.icon)} on={isSel} size={40} /></span>
            </span>
            <span style={{ ...type.cardTitle, display: "block", color: isSel ? K.sageText : K.hdrTitle }}>{opt.name}</span>
            {opt.desc && (
              <span style={{ ...type.meta, display: "block", color: K.hdrMeta, marginTop: 8, paddingTop: 8,
                borderTop: "1px solid " + (isSel ? K.sageBorder : K.cardWarmLine) }}>{opt.desc}</span>
            )}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 12 }}>
        {(cfg.ratios || []).map(function(r){
          var isSel = selId === r.id;
          var cnt = computeCount(r);
          return (
            <button key={r.id} type="button" className={"kh-btn kh-cfgrow kh-rip" + (isSel ? " is-on" : "")}
              onPointerDown={ripple} onClick={function(){ onChange({ ratio_id: r.id, extras: extras }); }}
              style={{ ...pick(isSel), padding: "14px 16px 13px", borderRadius: 16, textAlign: "left",
                cursor: "pointer", fontFamily: K.fontBody }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Radio on={isSel} />
                <span style={{ ...type.label, color: isSel ? K.sageText : K.hdrMetaStrong }}>{r.label}</span>
                <span style={{ marginLeft: "auto", color: isSel ? K.sage : K.sbGold, display: "flex", opacity: isSel ? 1 : .55 }}>
                  <Icon name="users" size={24} strokeWidth={1.6} />
                </span>
              </span>
              {/* The ratio is the number being chosen, so it takes the display
                  face and the size to go with it. Before, it sat at the same
                  weight as its own label. */}
              <span style={{ ...type.pageTitle, display: "block", fontSize: 30, color: K.hdrTitle, marginTop: 6 }}>
                {r.num} : {r.den}
              </span>
              {pax > 0 && (
                <span style={{ ...type.meta, display: "block", color: K.hdrMeta, marginTop: 3 }}>
                  <b style={{ ...type.num, color: isSel ? K.sageText : K.hdrTitle }}>{cnt}</b> {T2("staff for")} {pax} {T2("pax")}
                </span>
              )}
              {r.desc && (
                <span style={{ ...type.meta, display: "block", color: K.hdrMeta, marginTop: 10, paddingTop: 9,
                  borderTop: "1px solid " + (isSel ? K.sageBorder : K.cardWarmLine) }}>{r.desc}</span>
              )}
            </button>
          );
        })}
      </div>

      {cfg.allowExtras && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "11px 15px",
          borderRadius: 14, backgroundColor: K.sageBg, border: "1px solid " + K.sageBorder }}>
          <span style={{ ...type.rowTitle, color: K.sageText }}>{T2("Extra staff")}</span>
          <Stepper value={extras}
            onDec={function(){ onChange({ ratio_id: selId, extras: Math.max(0, extras - 1) }); }}
            onInc={function(){ onChange({ ratio_id: selId, extras: (extras || 0) + 1 }); }}
            canDec={!!selId && extras > 0} canInc={!!selId} />
          {selRatio && (
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ ...type.meta, color: K.sage }}>{T2("Total")}</span>
              <span style={{ ...type.num, fontSize: 19, color: K.sageText }}>{liveCount}</span>
              <span style={{ ...type.meta, color: K.sage }}>{T2("staff")}</span>
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
    <Stepper value={count}
      onDec={function(){ onChange({ count: Math.max(min, count - step) }); }}
      onInc={function(){ onChange({ count: Math.min(max, count + step) }); }}
      canDec={count > min} canInc={count < max} />
  );
}

// ═══════════════════════════════════════════════════════════════
// MULTI-SELECT WITH COUNT — rows of {checkbox + count spinner}
// ═══════════════════════════════════════════════════════════════
function MultiSelectCount({ cfg, value, onChange, copy }) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(cfg.options || []).map(function(opt){
        var count = itemsMap[opt.id] || 0;
        var isSel = count > 0;
        return (
          <div key={opt.id} className="kh-cfgrow" style={{ ...pick(isSel),
            display: "flex", alignItems: "center", gap: 13, padding: "9px 13px", borderRadius: 14 }}>
            <Check on={isSel} label={opt.name} onClick={function(){ update(opt.id, isSel ? 0 : 1); }} />
            <Tile name={optIcon(opt, copy.icon)} on={isSel} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...type.rowTitle, color: isSel ? K.sageText : K.hdrTitle }}>{opt.name}</div>
              {opt.desc && <div style={{ ...type.meta, color: K.hdrMeta, marginTop: 1 }}>{opt.desc}</div>}
            </div>
            <Stepper value={count}
              onDec={function(){ update(opt.id, Math.max(0, count - 1)); }}
              onInc={function(){ update(opt.id, count + 1); }}
              canDec={isSel} canInc={true} />
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
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {(cfg.options || []).map(function(opt){
        var isSel = !!selSet[opt.id];
        return (
          <button key={opt.id} type="button" className={"kh-btn kh-pickchip kh-rip" + (isSel ? " is-on" : "")}
            onPointerDown={ripple} onClick={function(){ toggle(opt.id); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: K.rPill,
              background: isSel ? K.sage : "#FFFFFF", border: "1px solid " + (isSel ? K.sage : K.cardWarmLine),
              color: isSel ? "#FFFFFF" : K.textBody, fontSize: 13, fontWeight: isSel ? 700 : 600,
              cursor: "pointer", fontFamily: K.fontBody }}>
            {isSel && <Icon name="check" size={13} strokeWidth={2.6} />}
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}

export default ConfigsPanel;
