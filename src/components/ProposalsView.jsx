// Ambria FnB — Proposals View (Sales)
// V70 Phase 1: empty shell. Phase 2 wires the New Proposal wizard + list.
// Place in: src/components/ProposalsView.jsx

import React from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { hasPermission } from '../data/permissions.js';

export function ProposalsView({ lang = "en", currentUser = null, empDb = [] }) {
  var T2 = function(s) { return T(s, lang); };
  var canCreate = hasPermission(currentUser, 'proposals.create');
  var canViewAll = hasPermission(currentUser, 'proposals.view_all');
  var displayName = (currentUser && (currentUser.name || currentUser.staff_id)) || 'Sales';

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", letterSpacing: 0.3 }}>
            📝 {T2("Proposals")}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            {canViewAll
              ? T2("All reps' proposals — filter, view, convert to bookings.")
              : T2("Your proposals — create new, edit drafts, track status.")}
          </div>
        </div>
        {canCreate && (
          <button disabled
            title={T2("Wires up in Phase 2")}
            style={{ padding: "10px 18px", borderRadius: 8, background: C.green, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "not-allowed", opacity: 0.55, boxShadow: "0 1px 3px " + C.shadow }}>
            + {T2("New Proposal")}
          </button>
        )}
      </div>

      {/* Empty state card */}
      <div style={{ background: C.surface, borderRadius: 14, border: "1px dashed " + C.border, padding: "60px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>🗂️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", marginBottom: 6 }}>
          {T2("No proposals yet")}
        </div>
        <div style={{ fontSize: 13, color: C.muted, maxWidth: 480, margin: "0 auto", lineHeight: 1.5 }}>
          {T2("This is the Sales module Phase 1 shell — schema and role gating are live. In Phase 2, the New Proposal wizard captures guest details, event info, and picks a menu tier. In Phase 3+, the full Menu Builder opens for each proposal.")}
        </div>

        <div style={{ marginTop: 22, display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: 11, padding: "5px 10px", borderRadius: 12, background: "#E5F5EA", color: "#2A7A48", fontWeight: 600, border: "1px solid #B8E0C6" }}>
            ✓ {T2("Schema deployed")}
          </span>
          <span style={{ fontSize: 11, padding: "5px 10px", borderRadius: 12, background: "#E5F5EA", color: "#2A7A48", fontWeight: 600, border: "1px solid #B8E0C6" }}>
            ✓ {T2("Role gating active")}
          </span>
          <span style={{ fontSize: 11, padding: "5px 10px", borderRadius: 12, background: "#FFF4D9", color: "#8A6B00", fontWeight: 600, border: "1px solid #F2D98A" }}>
            ◷ {T2("Wizard — Phase 2")}
          </span>
          <span style={{ fontSize: 11, padding: "5px 10px", borderRadius: 12, background: "#FFF4D9", color: "#8A6B00", fontWeight: 600, border: "1px solid #F2D98A" }}>
            ◷ {T2("Menu Builder — Phase 3")}
          </span>
        </div>
      </div>

      {/* Signed-in-as footer (debug aid during rollout) */}
      <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: C.muted }}>
        {T2("Signed in as")} <b style={{ color: C.text }}>{displayName}</b> · {T2("role")}: <b style={{ color: C.text }}>{(currentUser && currentUser.role) || '—'}</b>
      </div>
    </div>
  );
}

export default ProposalsView;