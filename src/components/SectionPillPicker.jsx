// Ambria FnB — two-level section picker (pill chips)
// Place in: src/components/SectionPillPicker.jsx
//
// Replaces a single flat row of pills (including breadcrumb-style labels like
// "Beverages › Aerated Drinks" for every subsection) with: top-level sections
// only, and a second row of that section's subsections once it's picked.
//
// multiSelect (for tagging a dish to show under MORE THAN ONE section, e.g.
// one that's already selected/native to a section and also needs to show
// under a different, extra pill): `value` is an array of ids instead of a
// single id, every click TOGGLES that one id's membership (never replaces
// or collapses the rest), and there's no "Clear" pill — removing a tag is
// just un-ticking it.
import React, { useState, useEffect } from "react";
import { C } from '../data/constants.js';

// groups: [{ id, name, count?, subs: [{ id, name, count? }] }]
export function SectionPillPicker({ groups, value, onChange, T2, accent, allowClear = true, clearLabel, multiSelect = false }) {
  var color = accent || C.wine;
  var ownerOf = {};
  (groups || []).forEach(function (g) {
    (g.subs || []).forEach(function (s) { ownerOf[s.id] = g.id; });
  });

  var initialOwner = multiSelect
    ? ((value || []).map(function (id) { return ownerOf[id]; }).filter(Boolean)[0] || null)
    : (ownerOf[value] || null);
  var [openId, setOpenId] = useState(function () { return initialOwner; });
  useEffect(function () {
    var owner = multiSelect
      ? ((value || []).map(function (id) { return ownerOf[id]; }).filter(Boolean)[0] || null)
      : ownerOf[value];
    if (owner && owner !== openId) setOpenId(owner);
  // eslint-disable-next-line
  }, [value]);

  var openGroup = (groups || []).find(function (g) { return g.id === openId; });

  function pillStyle(active) {
    return {
      padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
      background: active ? color : "transparent", color: active ? "#fff" : C.text,
      border: "1px solid " + (active ? color : C.border),
    };
  }

  if (multiSelect) {
    var selectedIds = value || [];
    var isChecked = function (id) { return selectedIds.indexOf(id) !== -1; };
    return (
      <div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: openGroup ? 8 : 18 }}>
          {(groups || []).map(function (g) {
            var hasSubs = g.subs && g.subs.length > 0;
            var isOpen = openId === g.id;
            var checked = isChecked(g.id);
            return (
              <button key={g.id} type="button"
                onClick={function () { onChange(g.id); if (hasSubs) setOpenId(isOpen ? null : g.id); }}
                style={{ ...pillStyle(checked), display: "inline-flex", alignItems: "center", gap: 5 }}>
                {checked ? '✓ ' : ''}{g.name}{g.count != null ? ' (' + g.count + ')' : ''}
                {hasSubs && (
                  <span style={{ fontSize: 9, opacity: 0.8, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
                )}
              </button>
            );
          })}
        </div>
        {openGroup && openGroup.subs && openGroup.subs.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, paddingLeft: 10, borderLeft: "2px solid " + C.borderLight }}>
            {openGroup.subs.map(function (s) {
              var checked = isChecked(s.id);
              return (
                <button key={s.id} type="button" onClick={function () { onChange(s.id); }}
                  style={pillStyle(checked)}>
                  {checked ? '✓ ' : ''}{s.name}{s.count != null ? ' (' + s.count + ')' : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function clickTop(g) {
    var hasSubs = g.subs && g.subs.length > 0;
    if (hasSubs) {
      if (openId === g.id && value === g.id) { setOpenId(null); return; }
      setOpenId(g.id);
      onChange(g.id);
    } else {
      setOpenId(null);
      onChange(g.id);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: openGroup ? 8 : 18 }}>
        {(groups || []).map(function (g) {
          var hasSubs = g.subs && g.subs.length > 0;
          var isOpen = openId === g.id;
          var isActive = value === g.id || isOpen;
          return (
            <button key={g.id} type="button" onClick={function () { clickTop(g); }}
              style={{ ...pillStyle(isActive), display: "inline-flex", alignItems: "center", gap: 5 }}>
              {g.name}{g.count != null ? ' (' + g.count + ')' : ''}
              {hasSubs && (
                <span style={{ fontSize: 9, opacity: 0.8, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
              )}
            </button>
          );
        })}
        {allowClear && value && (
          <button type="button" onClick={function () { onChange(''); setOpenId(null); }}
            style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
              background: "transparent", color: C.muted, border: "1px solid " + C.borderLight }}>
            ✕ {clearLabel || T2('Clear')}
          </button>
        )}
      </div>
      {openGroup && openGroup.subs && openGroup.subs.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, paddingLeft: 10, borderLeft: "2px solid " + C.borderLight }}>
          {openGroup.subs.map(function (s) {
            var active = value === s.id;
            return (
              <button key={s.id} type="button"
                onClick={function () { onChange(active ? openGroup.id : s.id); }}
                style={pillStyle(active)}>
                {s.name}{s.count != null ? ' (' + s.count + ')' : ''}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
