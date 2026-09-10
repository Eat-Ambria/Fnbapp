// Ambria FnB — Inline SVG icon set
//
// Stroke-based 24×24 glyphs. No icon library, no CDN, nothing to fail offline.
// Add a glyph by adding one entry to PATHS; it is then available everywhere as
// <Icon name="…" />.

import React from "react";

const PATHS = {
  // ── generic / chrome ──
  calendar:  <><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/></>,
  calendarDays: <><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18M7.5 13.5h3M13.5 13.5h3M7.5 17h3"/></>,
  clipboard: <><path d="M9 3.5h6a1 1 0 0 1 1 1v1H8v-1a1 1 0 0 1 1-1z"/><path d="M16 5.5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h2"/></>,
  book:      <><path d="M4 4.5A2 2 0 0 1 6 2.5h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 19.5a2 2 0 0 1 2-2h13v4H6a2 2 0 0 1-2-2z"/></>,
  chart:     <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  check:     <><circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></>,
  clock:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 1.9"/></>,
  flame:     <><path d="M12 2.5s5.5 4.4 5.5 9.4a5.5 5.5 0 0 1-11 0c0-2 1-3.6 1.9-4.7.3 1.3 1.1 2.1 2 2.1 1.3 0 1.9-1.3 1.6-3.1-.2-1.4 0-2.6 0-3.7z"/></>,
  utensils:  <><path d="M6 2.5v8a2.5 2.5 0 0 0 5 0v-8M8.5 10.5V21.5"/><path d="M17.5 2.5c-1.4 1-2.2 2.8-2.2 5 0 1.8.7 3 1.8 3.4V21.5"/></>,
  users:     <><circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M16.5 5a3.4 3.4 0 0 1 0 6.6M17.5 14.6a6.2 6.2 0 0 1 3.7 5.4"/></>,
  layers:    <><path d="M12 2.8l9 4.6-9 4.6-9-4.6z"/><path d="M3 12.4l9 4.6 9-4.6"/><path d="M3 17l9 4.6 9-4.6"/></>,
  alert:     <><path d="M12 3.5L22 20H2z"/><path d="M12 9.5v4.2M12 16.8v.1"/></>,
  chevronR:  <><path d="M9.5 5.5l6 6.5-6 6.5"/></>,
  chevronD:  <><path d="M5.5 9.5l6.5 6 6.5-6"/></>,
  chevronL:  <><path d="M14.5 5.5l-6 6.5 6 6.5"/></>,
  refresh:   <><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4v5h-5"/></>,
  plus:      <><path d="M12 5v14M5 12h14"/></>,
  close:     <><path d="M6 6l12 12M18 6L6 18"/></>,
  link:      <><path d="M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.3-1.3"/></>,
  undo:      <><path d="M3.5 8.5h11a5.5 5.5 0 0 1 0 11H8"/><path d="M7 4.5l-3.5 4L7 12.5"/></>,
  store:     <><path d="M3.5 9.5h17v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3 9.5L5 3.5h14l2 6"/><path d="M9.5 20.5v-6h5v6"/></>,
  search:    <><circle cx="11" cy="11" r="7"/><path d="M16.2 16.2L21 21"/></>,
  bell:      <><path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></>,
  settings:  <><circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z"/></>,
  logout:    <><path d="M9.5 20.5h-4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4"/><path d="M16 16.5l4.5-4.5L16 7.5"/><path d="M20.5 12h-11"/></>,
  globe:     <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/></>,
  panelLeft: <><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.5 4v16"/></>,
  note:      <><path d="M4 5.5a2 2 0 0 1 2-2h8.5L20 9v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3.5V9h5.5"/><path d="M8 13.5h7M8 17h5"/></>,

  // ── navigation ──
  home:      <><path d="M3.5 10.5L12 3.5l8.5 7"/><path d="M5.5 9.5v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-10"/><path d="M9.5 20.5v-6h5v6"/></>,
  chefHat:   <><path d="M6.5 20.5h11"/><path d="M6.5 17.5h11v-4a4.5 4.5 0 1 0-2.6-8.2a4 4 0 0 0-5.8 0A4.5 4.5 0 1 0 6.5 13.5z"/></>,
  box:       <><path d="M20.5 8.5l-8.5-4.5-8.5 4.5v7l8.5 4.5 8.5-4.5z"/><path d="M3.5 8.5l8.5 4.5 8.5-4.5"/><path d="M12 13v7.5"/></>,
  truck:     <><path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 10h4l3 3.2v3.3h-7z"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17" cy="18.5" r="2"/></>,
  contact:   <><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><circle cx="12" cy="10" r="2.6"/><path d="M7.5 17.5a4.8 4.8 0 0 1 9 0"/></>,
  plate:     <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></>,
  cup:       <><path d="M5.5 4.5h11l-1 13a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8z"/><path d="M16.2 8.5h1.8a2.5 2.5 0 0 1 0 5h-1.4"/></>,
  drink:     <><path d="M4.5 4.5h15l-7.5 8.5z"/><path d="M12 13v6.5M8.5 19.5h7"/></>,
  tent:      <><path d="M12 3.5L3 20.5h18z"/><path d="M12 3.5v17"/><path d="M8 20.5l4-6 4 6"/></>,
  fileText:  <><path d="M5 4.5a2 2 0 0 1 2-2h6.5L19 8v11.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M13 2.5V8h5.5"/><path d="M8.5 12.5h7M8.5 16h5"/></>,
  tag:       <><path d="M2.8 12.4V4.5a1.7 1.7 0 0 1 1.7-1.7h7.9a1.7 1.7 0 0 1 1.2.5l7 7a1.7 1.7 0 0 1 0 2.4l-7.4 7.4a1.7 1.7 0 0 1-2.4 0l-7-7a1.7 1.7 0 0 1-.5-1.2z"/><path d="M7.3 7.3v.01"/></>,
  lock:      <><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></>,
  listCheck: <><path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h11"/><path d="M3.5 6.4l1.3 1.3 2.2-2.4M3.5 11.9l1.3 1.3 2.2-2.4M3.5 17.4l1.3 1.3 2.2-2.4"/></>,
  trash:     <><path d="M3.8 6.3h16.4"/><path d="M8.8 6.3V4.6a1.6 1.6 0 0 1 1.6-1.6h3.2a1.6 1.6 0 0 1 1.6 1.6v1.7"/><path d="M6.2 6.3l.9 12.6a2 2 0 0 0 2 1.9h5.8a2 2 0 0 0 2-1.9l.9-12.6"/><path d="M10.3 10.4v6M13.7 10.4v6"/></>,
  building:  <><path d="M3.5 20.5h17"/><path d="M5.5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 13.5 5v15.5"/><path d="M13.5 10h4A1.5 1.5 0 0 1 19 11.5v9"/><path d="M8.5 7h2M8.5 10.5h2M8.5 14h2M16 13.5h.01M16 17h.01"/></>,
};

function Icon({ name, size = 16, color = "currentColor", strokeWidth = 1.7, style }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
         style={{ flexShrink: 0, display: "block", ...style }} aria-hidden="true">
      {d}
    </svg>
  );
}

export { Icon, PATHS };
