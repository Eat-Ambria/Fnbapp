// Ambria FnB — Sales Catalogue View (Sales Manager admin)
// V70 Phase 1: empty shell. Phase 8 wires the full enrichment UI over sales_items_meta.
// Place in: src/components/SalesCatalogueView.jsx

import React from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { hasPermission } from '../data/permissions.js';

export function SalesCatalogueView({ lang = "en", currentUser = null }) {
  var T2 = function(s) { return T(s, lang); };
  var canEdit = hasPermission(currentUser, 'sales_catalogue.edit');

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", letterSpacing: 0.3 }}>
          🏷️ {T2("Sales Catalogue")}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          {T2("Enrich the dish catalogue with sales copy, hero images, diet tags, and department routing.")}
        </div>
      </div>

      <div style={{ background: C.surface, borderRadius: 14, border: "1px dashed " + C.border, padding: "60px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>🎨</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", marginBottom: 6 }}>
          {T2("Catalogue admin — Phase 8")}
        </div>
        <div style={{ fontSize: 13, color: C.muted, maxWidth: 520, margin: "0 auto", lineHeight: 1.5 }}>
          {T2("In Phase 8, this view lists every dish from dishes_master joined with sales_items_meta. Inline-edit sales description, diet tag, and department. Upload hero images to Supabase Storage. Bulk-tag by category.")}
        </div>

        {!canEdit && (
          <div style={{ marginTop: 20, fontSize: 11, color: C.muted, fontStyle: "italic" }}>
            {T2("You have read-only access to this view.")}
          </div>
        )}

        <div style={{ marginTop: 22, display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: 11, padding: "5px 10px", borderRadius: 12, background: "#E5F5EA", color: "#2A7A48", fontWeight: 600, border: "1px solid #B8E0C6" }}>
            ✓ sales_items_meta {T2("table ready")}
          </span>
          <span style={{ fontSize: 11, padding: "5px 10px", borderRadius: 12, background: "#FFF4D9", color: "#8A6B00", fontWeight: 600, border: "1px solid #F2D98A" }}>
            ◷ {T2("Admin UI — Phase 8")}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SalesCatalogueView;