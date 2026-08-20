// Ambria FnB — Menu Builder Preview (Sales)
// V70 Phase 6: client-facing menu card + Print/Save-as-PDF via window.print().
// Place in: src/components/MenuBuilderPreview.jsx

import React, { useState, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { getCatIdForDish, RECIPE_DB } from '../data/recipeData.js';
import { SALES_DEPTS, ITEM_HAVING_DEPTS, DIET_TAGS, DEFAULT_DIET, DEFAULT_DEPT } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';

// Print stylesheet — injected inline so Preview is self-contained (no global CSS changes).
// Hides everything except the print card + resets margins/backgrounds for clean PDF output.
const PRINT_CSS = `
@media print {
  @page { margin: 12mm; size: A4; }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body * { visibility: hidden; }
  .ambria-print-card, .ambria-print-card * { visibility: visible; }
  .ambria-print-card { position: absolute !important; top: 0; left: 0; right: 0; padding: 0 !important; box-shadow: none !important; border: none !important; max-width: 100% !important; margin: 0 !important; background: #fff !important; }
  .ambria-print-hide { display: none !important; }
  .ambria-print-dept { page-break-inside: avoid; break-inside: avoid; }
  .ambria-print-cat  { page-break-inside: avoid; break-inside: avoid; }
}
`;

export function MenuBuilderPreview({ proposal, dishItems, salesMeta, templateInfo, onClose, lang = "en", currentUser = null }) {
  var T2 = function(s){ return T(s, lang); };
  var [markingSent, setMarkingSent] = useState(false);
  var [sentJust, setSentJust]       = useState(false);
  var currentStatus = proposal.status || 'draft';

  // ── Group items by (dept, category) ──
  var byDeptByCat = useMemo(function(){
    var deptMap = {};
    (dishItems || []).forEach(function(item){
      var meta = salesMeta[item.dish_name];
      var dept = (meta && meta.sales_dept) || DEFAULT_DEPT;
      var catId  = getCatIdForDish(item.dish_name) || 'other';
      var catObj = (RECIPE_DB.cats || []).find(function(c){ return c.id === catId; });
      if (!deptMap[dept]) deptMap[dept] = {};
      if (!deptMap[dept][catId]) {
        deptMap[dept][catId] = {
          id: catId,
          name: catObj ? catObj.name : 'Other',
          icon: catObj ? (catObj.icon || '') : '',
          items: [],
        };
      }
      deptMap[dept][catId].items.push(item);
    });

    // Sort each dept's categories using RECIPE_DB order
    var order = (RECIPE_DB.cats || []).map(function(c){ return c.id; });
    var deptsWithSortedCats = {};
    Object.keys(deptMap).forEach(function(deptId){
      var cats = deptMap[deptId];
      var sorted = order.filter(function(id){ return !!cats[id]; }).map(function(id){ return cats[id]; });
      Object.keys(cats).forEach(function(id){ if (order.indexOf(id) < 0) sorted.push(cats[id]); });
      // Sort items alphabetically within each category for a clean read
      sorted.forEach(function(cat){ cat.items.sort(function(a,b){ return a.dish_name.localeCompare(b.dish_name); }); });
      deptsWithSortedCats[deptId] = sorted;
    });
    return deptsWithSortedCats;
  }, [dishItems, salesMeta]);

  // Sort depts in the sidebar order, filter to only those with items
  var deptSections = useMemo(function(){
    return SALES_DEPTS.filter(function(d){
      return ITEM_HAVING_DEPTS.indexOf(d.id) >= 0 && byDeptByCat[d.id] && byDeptByCat[d.id].length > 0;
    });
  }, [byDeptByCat]);

  var totalItems = (dishItems || []).length;

  // ── Formatted event details line ──
  var eventLine = useMemo(function(){
    var parts = [];
    if (proposal.event_type) parts.push(proposal.event_type);
    if (proposal.venue)      parts.push(proposal.venue);
    if (proposal.event_date) parts.push(formatDate(proposal.event_date));
    if (proposal.pax)        parts.push(proposal.pax + " " + T2("guests"));
    return parts.join(" · ");
  }, [proposal, lang]);

  // ── Mark as Sent ──
  async function markAsSent() {
    if (markingSent) return;
    setMarkingSent(true);
    try {
      var res = await supabase.from('proposals')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', proposal.id);
      if (res.error) throw res.error;
      setSentJust(true);
    } catch (e) {
      console.error('[Preview] markAsSent failed:', e);
      alert(T2('Failed to mark as sent:') + ' ' + (e.message || e));
    } finally {
      setMarkingSent(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  var showMarkSent = currentStatus === 'draft' && !sentJust;
  var statusPill = sentJust
    ? { label: T2('Marked as sent'), bg: '#E5F5EA', fg: '#2A7A48' }
    : currentStatus === 'sent' ? { label: T2('Sent'), bg: '#E5F0FA', fg: '#1858A5' }
    : currentStatus === 'won'  ? { label: T2('Won'),  bg: '#E5F5EA', fg: '#2A7A48' }
    : currentStatus === 'lost' ? { label: T2('Lost'), bg: '#FAE5E5', fg: '#A52828' }
    : null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, background: "#F5F1E8", overflowY: "auto" }}>
      {/* Print stylesheet (self-contained) */}
      <style>{PRINT_CSS}</style>

      {/* ── Top bar (hidden in print) ── */}
      <div className="ambria-print-hide"
        style={{ position: "sticky", top: 0, zIndex: 10, background: C.surface, borderBottom: "1px solid " + C.border, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", boxShadow: "0 1px 3px " + C.shadow }}>
        <button onClick={onClose}
          style={{ padding: "8px 14px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ← {T2("Back to menu")}
        </button>
        <div style={{ flex: 1, fontSize: 12, color: C.muted }}>
          👁 {T2("Client-facing preview")} · {totalItems} {T2(totalItems === 1 ? "item" : "items")}
          {statusPill && (
            <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 10, background: statusPill.bg, color: statusPill.fg, fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>{statusPill.label}</span>
          )}
        </div>
        {showMarkSent && (
          <button onClick={markAsSent} disabled={markingSent}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#1858A5", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: markingSent ? "wait" : "pointer", opacity: markingSent ? 0.7 : 1 }}>
            {markingSent ? T2("Saving…") : "✉ " + T2("Mark as Sent")}
          </button>
        )}
        <button onClick={handlePrint}
          style={{ padding: "8px 16px", borderRadius: 8, background: C.gold || "#D4A843", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          🖨 {T2("Print / Save PDF")}
        </button>
      </div>

      {/* ── Print card ── */}
      <div className="ambria-print-card"
        style={{
          maxWidth: 780, margin: "24px auto 60px", background: "#fff",
          borderRadius: 8, boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          padding: "48px 56px",
          fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
          color: "#2a2622",
        }}>

        {/* Wordmark header */}
        <div style={{ textAlign: "center", paddingBottom: 22, borderBottom: "2px solid " + (C.gold || "#D4A843"), marginBottom: 28 }}>
          <div style={{
            fontSize: 36, fontWeight: 700, letterSpacing: 6, color: C.gold || "#B8862D",
            fontFamily: 'var(--font-display), "Playfair Display", ui-serif, Georgia, serif',
            textTransform: "uppercase",
          }}>
            AMBRIA
          </div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#8a7a5d", marginTop: 4, textTransform: "uppercase" }}>
            {T2("Catering & Banquets")}
          </div>
        </div>

        {/* Guest title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: "#8a7a5d", marginBottom: 6, textTransform: "uppercase", letterSpacing: 3 }}>
            {T2("Menu curated for")}
          </div>
          <div style={{
            fontSize: 32, fontWeight: 700, color: "#2a2622",
            fontFamily: 'var(--font-display), "Playfair Display", ui-serif, Georgia, serif',
            fontStyle: "italic",
          }}>
            {proposal.guest_name || T2("Guest")}
          </div>
          {eventLine && (
            <div style={{ fontSize: 13, color: "#5a5148", marginTop: 10, letterSpacing: 0.5 }}>
              {eventLine}
            </div>
          )}
          {templateInfo && templateInfo.name && (
            <div style={{ fontSize: 11, color: "#8a7a5d", marginTop: 6, letterSpacing: 1, textTransform: "uppercase" }}>
              {templateInfo.tier === 'magnum' ? '✦ ' : ''}{templateInfo.name}{templateInfo.tier === 'magnum' ? ' ✦' : ''}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: "linear-gradient(to right, transparent, #d4a843, transparent)", marginBottom: 28 }}></div>

        {/* Empty state */}
        {deptSections.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#8a7a5d" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🍽</div>
            <div style={{ fontSize: 14, fontStyle: "italic" }}>
              {T2("No dishes selected yet. Go back to the Menu Builder to pick items.")}
            </div>
          </div>
        )}

        {/* Dept sections */}
        {deptSections.map(function(dept){
          var cats = byDeptByCat[dept.id] || [];
          return (
            <div key={dept.id} className="ambria-print-dept" style={{ marginBottom: 32 }}>
              {/* Dept header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 8, borderBottom: "1px dashed " + (dept.color || "#d4a843") }}>
                <span style={{ fontSize: 20 }}>{dept.icon}</span>
                <span style={{
                  fontSize: 18, fontWeight: 700, color: dept.color || "#2a2622",
                  fontFamily: 'var(--font-display), "Playfair Display", ui-serif, Georgia, serif',
                  letterSpacing: 1,
                }}>
                  {dept.name}
                </span>
              </div>

              {/* Categories in this dept */}
              {cats.map(function(cat){
                return (
                  <div key={cat.id} className="ambria-print-cat" style={{ marginBottom: 20 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: "#8a7a5d",
                      textTransform: "uppercase", letterSpacing: 2,
                      marginBottom: 8, paddingLeft: 4,
                    }}>
                      {cat.icon} {cat.name}
                    </div>
                    <div style={{ paddingLeft: 20 }}>
                      {cat.items.map(function(item, ii){
                        var meta = salesMeta[item.dish_name];
                        var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
                        var dietMeta = DIET_TAGS.find(function(x){ return x.id === diet; });
                        var desc = (meta && meta.sales_description) || '';
                        return (
                          <div key={ii} style={{ marginBottom: desc ? 10 : 4, display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <span style={{ color: "#d4a843", marginTop: 2, flexShrink: 0 }}>◆</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 14, color: "#2a2622", fontWeight: 500 }}>{item.dish_name}</span>
                                {dietMeta && dietMeta.id !== 'veg' && (
                                  <span style={{ fontSize: 10, color: dietMeta.color }} title={dietMeta.label}>{dietMeta.icon}</span>
                                )}
                              </div>
                              {desc && (
                                <div style={{ fontSize: 11, color: "#7a6f5e", fontStyle: "italic", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Footer */}
        <div style={{
          marginTop: 40, paddingTop: 20, borderTop: "1px solid #e8dfc9",
          textAlign: "center", fontSize: 11, color: "#8a7a5d", letterSpacing: 1.5,
        }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>{T2("With warm regards from the Ambria team")}</div>
          <div style={{ fontSize: 10, opacity: 0.75 }}>
            {T2("This menu is a proposal and may be tailored further to your preferences.")}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return iso;
  }
}

export default MenuBuilderPreview;