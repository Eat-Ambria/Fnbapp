// Ambria FnB — Kitchen Hub design tokens
//
// PURPOSE
// -------
// Single source of truth for the "Kitchen Hub" visual language (the clean
// white-card + blue-accent system). It is ADDITIVE: nothing here overrides
// `C` in data/constants.js, so every screen that has not been migrated keeps
// rendering exactly as before.
//
// HOW TO RETHEME
// --------------
// Change the values in `K` below — every migrated surface follows. The same
// values are also published as CSS custom properties (--k-*) so future CSS /
// className-based components can read them without importing anything.
//
// HOW TO MIGRATE A NEW SCREEN
// ---------------------------
//   import { K, tone } from '../utils/theme.js';
//   import { KPanel, KStat, KPill } from './KitchenUI.jsx';
//   ...wrap the screen root in <div className="kh-scope"> to pick up the
//   hover / focus / responsive-grid helpers defined at the bottom of this file.

const K = {
  // ── Surfaces ──
  canvas:      "#F6F8FC",   // page background behind cards
  surface:     "#FFFFFF",   // card / panel background
  surfaceAlt:  "#FAFBFE",   // table header, zebra, inset blocks
  surfaceHover:"#F1F5FD",   // row hover

  // ── Lines ──
  line:        "#E5EAF3",   // default border
  lineSoft:    "#F0F3F9",   // internal dividers
  lineStrong:  "#D4DCEA",   // emphasised border

  // ── Text ──
  text:        "#111C33",   // headings, primary values
  textBody:    "#374867",   // body copy
  textMuted:   "#61708C",   // labels, secondary
  textFaint:   "#96A2B8",   // column heads, hints

  // ── Accent (blue) ──
  accent:       "#2563EB",
  accentHover:  "#1D4FD8",
  accentSoft:   "#EAF1FE",
  accentBorder: "#C5D8FB",
  accentText:   "#FFFFFF",
  accentGrad:   "linear-gradient(135deg, #3B82F6 0%, #1D4FD8 100%)",

  // ── Status tones ──
  ok:        "#129A6C",  okBg:      "#E6F7F0",  okBorder:      "#B4E8D3",
  warn:      "#C4790C",  warnBg:    "#FDF3E2",  warnBorder:    "#F5DBA6",
  danger:    "#D9463F",  dangerBg:  "#FDECEB",  dangerBorder:  "#F6C6C3",
  info:      "#0EA5E9",  infoBg:    "#E4F5FE",  infoBorder:    "#B6E5FB",
  idle:      "#61708C",  idleBg:    "#F1F4F9",  idleBorder:    "#E1E7F1",
  // Teal exists so a neutral-but-coloured tile does not collide with the
  // blue accent or the green "ok" tone.
  teal:      "#0E9488",  tealBg:    "#E3F6F4",  tealBorder:    "#B2E5E0",

  // ── Brand deep-green ──
  // The same green as the sidebar pill, header badge and active tab. Use this
  // (not `accent`) for chrome that belongs to the brand plate rather than to
  // the blue data accent — modals, brand chips, selection states in dialogs.
  brand:     "#1C3D2B",  brandBg:   "#E7F1EA",  brandBorder:   "#C9DFD1",
  brandSoft: "#F1F7F3",  brandText: "#24503A",
  // Hover shades. Tokens rather than literals buried in the stylesheet, so a
  // palette change cannot leave the hover states behind on the old colour.
  brandHover:   "#14301F",   // solid brand button, pressed-darker
  brandBgHover: "#DFEDE4",   // selected picker row on hover
  dangerHover:  "#C13B35",   // solid destructive button

  // ── Sidebar chrome ──
  // A pale blue wash, lightest at the top so the brand reads first and the colour
  // settles towards the footer. Kept low-saturation on purpose: the solid blue
  // active pill has to stay the loudest thing in the sidebar.
  sidebarGrad:   "linear-gradient(180deg, #FFFFFF 0%, #F7FAFE 42%, #EAF1FB 100%)",
  sidebarLine:   "#DDE6F4",
  sidebarDiv:    "#EAF0F9",
  // Active nav is a SOLID blue pill with white text — pair with navActiveText.
  navActiveGrad: "linear-gradient(135deg, #3B82F6 0%, #1D4FD8 100%)",
  navActiveText: "#FFFFFF",
  navHover:      "rgba(255,255,255,.82)",

  // ── Sidebar: ivory + deep green + gold (same family as the header plate) ──
  // 272, not 312. On a 1366-wide laptop the wider panel ate a fifth of the
  // window and pushed table columns into truncation; the nav labels still fit
  // comfortably at this width.
  sbWidth:      272,          // expanded
  sbWidthMin:   84,           // collapsed icon rail
  // Sampled from the artwork PNGs: sidebar-bg ivory is #FBF9F4, sidebar-footer
  // ivory is #FBFBF7. The base has to sit in that range or the footer image's
  // opaque ivory meets a darker panel and you get a visible seam across the
  // sidebar. (The old #F8F6F0 was ~4 levels darker — that was the band.)
  sbBg:         "#FBFBF7",
  sbEdge:       "#1C3D2B",   // narrow strip down the far-left window edge
  sbLine:       "#E9E4D6",
  sbLabel:      "#8C8C83",
  sbTagline:    "#3E5246",   // muted deep green — readable without competing with the title
  sbText:       "#1F2A24",
  sbChipBg:     "#FFFFFF",
  sbChipLine:   "#E7E2D6",
  sbActiveBg:   "#1C3D2B",
  sbActiveText: "#FFFFFF",
  sbGold:       "#C69A3E",
  sbGoldSoft:   "#D9A93C",
  sbBadgeBg:    "#F0EBDD",
  sbBadgeText:  "#6B5626",
  sbFooterBg:   "#1C3D2B",
  // Sits behind the floating sidebar. Must be a touch deeper than sbBg or the
  // rounded corners have nothing to read against; and warm, or the gap around
  // the ivory panel looks like a white hole.
  shellBg:      "#EFEDE4",
  // Footer artwork is 1151x1367 — at full width it renders ~371px tall. Cropped
  // from the top (bottom-anchored) only as far as the wave's HIGHEST point, so
  // the artwork's own curve stays whole and just the blank white above it is
  // trimmed. Going lower than this cuts into the wave and leaves a broken notch.
  sbFooterH:    288,
  // Two layers: a tight one for the edge definition, a wide soft one for depth.
  // A single large blur alone just looks like grey haze.
  sidebarShadow: "3px 0 6px rgba(17,28,51,.06), 10px 0 30px rgba(17,28,51,.11)",

  // ── Page header band ──
  // Deliberately its own warm ivory + deep-green + gold set rather than the app
  // accent: it is the brand plate at the top of every screen. Retint here.
  hdrBg:       "linear-gradient(135deg, #FCFBF8 0%, #F8F7F2 58%, #F4F2EA 100%)",
  hdrLine:     "#EBE8DE",
  hdrBadge:    "#1C3D2B",
  hdrBadgeIcon:"#D9C08A",
  hdrEyebrow:  "#8C8C83",
  hdrTitle:    "#14171A",
  hdrMeta:     "#4A5560",
  hdrMetaStrong:"#1A2430",
  hdrChipBg:   "#FFFFFF",
  hdrChipLine: "#E6E4DC",
  hdrLiveBg:   "#E4F3E8",
  hdrLiveDot:  "#2FA35C",
  hdrLiveText: "#1E6B3C",

  // ── Tab bar + function selector ──
  // Shares the header plate's deep-green/ivory family so the top of the screen
  // reads as one band rather than two unrelated systems.
  tabBarBg:      "#F7F6F1",
  tabBarLine:    "#EDEAE0",
  tabActiveBg:   "#1C3D2B",
  tabActiveText: "#FFFFFF",
  tabIdleText:   "#1A2430",
  segSelBg:      "#E8F1EA",
  segSelBar:     "#1C3D2B",
  segChipBg:     "#F1EFE9",
  segChipSelBg:  "#D6E7DB",

  // Page background artwork strength. Full — the artwork is already a soft,
  // low-contrast wash, and cards sit on it opaquely, so nothing behind text
  // needs dimming. Dial down here if a busier image ever replaces it.
  pageBgOpacity: 1,

  // ── Dialogs ──
  // Modals belong to the brand plate, not the blue data surface: warm ivory
  // washed with a hint of the deep green, and a heavier radius than a card so
  // a dialog reads as a distinct layer. Kept OPAQUE on purpose — a translucent
  // panel over the page artwork was what made earlier dialogs unreadable.
  modalBg:      "linear-gradient(150deg, #FDFDFA 0%, #F8FBF8 52%, #F1F7F2 100%)",
  modalLine:    "#E5E9E1",
  modalRadius:  26,
  modalScrim:   "rgba(20,34,26,.52)",

  // ── Radii ──
  rSm: 8, rMd: 12, rLg: 16, rXl: 20, rPill: 999,

  // ── Elevation ──
  // Deeper than a flat-canvas app would need: cards now sit over the page
  // artwork, and a faint shadow leaves them looking pasted onto the image
  // rather than lifted off it.
  shadowCard: "0 1px 3px rgba(17,28,51,.09), 0 6px 14px rgba(17,28,51,.07), 0 18px 40px rgba(17,28,51,.09)",
  shadowLift: "0 2px 6px rgba(17,28,51,.12), 0 10px 22px rgba(17,28,51,.10), 0 26px 56px rgba(17,28,51,.14)",
  shadowAccent: "0 4px 14px rgba(37,99,235,.28)",

  // ── Type ──
  fontDisplay: "var(--font-display)",
  fontBody:    "var(--font-body)",
};

// Type scale. Sizes were ad-hoc numbers (13.5, 12.5, 11.5…) scattered across
// files; these are the canonical steps. Tracking follows the usual rule —
// tighter as display type gets bigger, looser for small caps labels.
const type = {
  // Cormorant display
  pageTitle:  { fontFamily: K.fontDisplay, fontSize: 34,   fontWeight: 600, letterSpacing: "-0.5px", lineHeight: 1.12 },
  sectionHead:{ fontFamily: K.fontDisplay, fontSize: 22,   fontWeight: 600, letterSpacing: "-0.2px", lineHeight: 1.2 },
  // DM Sans UI
  cardTitle:  { fontSize: 15,   fontWeight: 700, letterSpacing: "-0.1px", lineHeight: 1.3 },
  rowTitle:   { fontSize: 13.5, fontWeight: 600, letterSpacing: 0,        lineHeight: 1.4 },
  body:       { fontSize: 13,   fontWeight: 400, letterSpacing: 0,        lineHeight: 1.55 },
  meta:       { fontSize: 12.5, fontWeight: 400, letterSpacing: "0.1px",  lineHeight: 1.5 },
  // Small caps column heads / eyebrow labels
  label:      { fontSize: 11,   fontWeight: 600, letterSpacing: "0.7px",  lineHeight: 1.4, textTransform: "uppercase" },
  // Numerals — always pair with tabular figures so columns line up
  statValue:  { fontSize: 26,   fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" },
  num:        { fontWeight: 600, fontVariantNumeric: "tabular-nums" },
};

// Named status tone → {fg, bg, border}. Use this instead of hand-picking
// colours so a future palette swap stays a one-file change.
const TONES = {
  ok:      { fg: K.ok,      bg: K.okBg,      border: K.okBorder },
  warn:    { fg: K.warn,    bg: K.warnBg,    border: K.warnBorder },
  danger:  { fg: K.danger,  bg: K.dangerBg,  border: K.dangerBorder },
  info:    { fg: K.info,    bg: K.infoBg,    border: K.infoBorder },
  idle:    { fg: K.idle,    bg: K.idleBg,    border: K.idleBorder },
  teal:    { fg: K.teal,    bg: K.tealBg,    border: K.tealBorder },
  accent:  { fg: K.accent,  bg: K.accentSoft, border: K.accentBorder },
  brand:   { fg: K.brand,   bg: K.brandBg,   border: K.brandBorder },
};
function tone(name) { return TONES[name] || TONES.idle; }

// ── CSS custom properties + scoped helpers ─────────────────────────────────
// Everything is namespaced under .kh-scope so it can never leak into a screen
// that has not opted in.
const KITCHEN_CSS = `
:root {
  --k-canvas:${K.canvas}; --k-surface:${K.surface}; --k-surface-alt:${K.surfaceAlt};
  --k-line:${K.line}; --k-line-soft:${K.lineSoft};
  --k-text:${K.text}; --k-text-muted:${K.textMuted}; --k-text-faint:${K.textFaint};
  --k-accent:${K.accent}; --k-accent-soft:${K.accentSoft}; --k-accent-border:${K.accentBorder};
  --k-ok:${K.ok}; --k-warn:${K.warn}; --k-danger:${K.danger}; --k-info:${K.info};
  --k-r-sm:${K.rSm}px; --k-r-md:${K.rMd}px; --k-r-lg:${K.rLg}px;
  --k-shadow-card:${K.shadowCard};
}

/* ══ TYPOGRAPHY ══
   Applied at container level so every child benefits without per-element edits.
   - Antialiasing: the single biggest perceived-quality win on light UIs; without
     it Cormorant's thin strokes look chunky on Windows.
   - tabular-nums: fixed-width digits, so quantities, counts, percentages and
     timers stop jittering as values change and line up down a column. */
.kh-scope, .ash-shell {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-variant-numeric: tabular-nums;
  font-optical-sizing: auto;
}
/* Cormorant is a high-contrast serif — it needs negative tracking at display
   sizes or the letters drift apart. */
.kh-scope .kh-display, .ash-shell .kh-display { letter-spacing: -0.4px; }

/* Opt a single element out of tabular figures (prose, names). */
.kh-scope .kh-prose { font-variant-numeric: normal; }

/* ══ HOVER STATES ══
   IMPORTANT: this app styles everything with inline style={{…}}, and inline
   styles beat any CSS selector. So every hover declaration that overrides a
   painted value MUST carry !important or it silently does nothing. Keep that
   in mind when adding rules below. */

/* Station rows in the Kitchen Stations table */
.kh-scope .kh-row { transition: background .16s ease, box-shadow .16s ease; }
.kh-scope .kh-row:hover { background: ${K.surfaceHover} !important; }

/* Buttons inside the scope should not inherit the global brightness filter,
   which washes out white/ghost buttons. */
.kh-scope .kh-btn:hover { filter: none; }
.kh-scope .kh-btn { transition: background .16s ease, border-color .16s ease, color .16s ease, box-shadow .16s ease !important; }
/* Variant hovers are UNSCOPED — kh-btn-* is only ever emitted by KButton, so
   there is nothing to leak onto, and KModal portals its buttons to <body>
   where a .kh-scope-prefixed rule could never reach them. */
.kh-btn-ghost:hover { background: ${K.surfaceHover} !important; border-color: ${K.lineStrong} !important; }
/* The reset chip is neutral until you reach for it, then it reads destructive.
   Keyed on a CLASS, not on the title text — the title is translated, so an
   attribute selector matching English would silently stop working in Hindi. */
.kh-btn-ghost.kh-btn-quietdanger:hover { background: ${K.dangerBg} !important; border-color: ${K.dangerBorder} !important; color: ${K.danger} !important; }
.kh-btn-accent:hover { background: ${K.accentHover} !important; box-shadow: 0 6px 18px rgba(37,99,235,.34) !important; }
.kh-btn-brand:hover { background: ${K.brandHover} !important; box-shadow: 0 6px 18px rgba(28,61,43,.32) !important; }
.kh-btn-soft:hover { background: ${K.accentBorder} !important; }
.kh-btn-danger:hover { background: ${K.dangerBg} !important; border-color: ${K.danger} !important; }
.kh-btn-dangerSolid:hover { background: ${K.dangerHover} !important; box-shadow: 0 6px 18px rgba(217,70,63,.34) !important; }
.kh-btn:disabled:hover { filter: none !important; }

/* Tabs — hover paints a full rounded block behind the label; the active tab
   keeps a stronger block plus its own underline element (see KTabs). The tint
   must be clearly darker than the page canvas (${K.canvas}) or it reads as no
   hover at all.
   NOTE: no backticks in this block — the whole stylesheet is a JS template
   literal, so a stray backtick ends it and breaks the build. */
.kh-scope .kh-tab { border-radius: 12px; }
.kh-scope .kh-tab:hover {
  filter: none;
  color: ${K.tabIdleText} !important;
  background: rgba(28,61,43,.07) !important;
}
/* Active is a solid deep-green pill — lift it slightly, keep the label white. */
.kh-scope .kh-tab.is-active:hover { color: ${K.tabActiveText} !important; background: #25523A !important; }

/* Segmented control (function selector) */
.kh-scope .kh-seg { position: relative; overflow: hidden; -webkit-tap-highlight-color: transparent; }
.kh-scope .kh-seg:hover { filter: none; background: rgba(28,61,43,.05) !important; }
.kh-scope .kh-seg.is-active:hover { background: #DFEBE3 !important; }
/* Press feedback — settles back rather than snapping. */
.kh-scope .kh-seg:active { transform: scale(.985); }
.kh-scope .kh-seg { transition: background .22s ease, box-shadow .28s var(--ease-luxury), transform .12s ease !important; }
/* Icon chip lifts as its segment becomes the selected one. */
.kh-scope .kh-seg .kh-seg-chip { transition: background .22s ease, color .22s ease, transform .28s var(--ease-luxury); }
.kh-scope .kh-seg.is-active .kh-seg-chip { transform: scale(1.08); }

/* Colour sweeps up from the bottom edge on click. scaleY from a bottom origin,
   not an animated height — transforms run on the compositor, height forces
   layout on every frame. Spans are removed on animationend so none accumulate.
   Sits behind the label: .kh-seg children carry z-index 1. */
@keyframes kh-fillup {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
.kh-fillup {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  transform-origin: bottom;
  background: ${K.segSelBg};
  animation: kh-fillup .42s cubic-bezier(.22,1,.36,1) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .kh-fillup { display: none; }
  .kh-scope .kh-seg:active { transform: none; }
  .kh-scope .kh-seg.is-active .kh-seg-chip { transform: none; }
}

/* Dish cards — three across, dropping to 2 then 1 as the card narrows. This is
   a CONTAINER query, not a viewport one: the grid sits inside a station panel
   whose width depends on the sidebar and the tablet layout, so viewport
   breakpoints put 3 cramped columns in a half-width panel. */
/* Dispatch-by-function cards: two across, one when the panel gets narrow.
   Same wrapper/grid split as the dish grid — a container cannot query itself. */
.kh-scope .kh-dispatchwrap { container-type: inline-size; }
.kh-scope .kh-dispatchgrid {
  display: grid; gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
}
@container (max-width: 620px) {
  .kh-scope .kh-dispatchgrid { grid-template-columns: minmax(0, 1fr); }
}

.kh-scope .kh-dishwrap { container-type: inline-size; }
.kh-scope .kh-dishgrid {
  display: grid; gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
}
@container (max-width: 1020px) {
  .kh-scope .kh-dishgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 660px) {
  .kh-scope .kh-dishgrid { grid-template-columns: minmax(0, 1fr); }
}
/* An open dish takes the whole row — its step list, timers and sub-steps need
   the full width. */
.kh-scope .kh-dishcard.is-open { grid-column: 1 / -1; }

/* Generic clickable list row — dish rows, ingredient rows, collapse strips:
   anything tappable that is not part of the stations grid. */
.kh-scope .kh-listrow { transition: background .16s ease, border-color .16s ease; }
.kh-scope .kh-listrow:hover { background: ${K.surfaceHover} !important; border-color: ${K.lineStrong} !important; }

/* Picker rows inside KModal. They need their OWN unscoped rule: KModal renders
   through a portal onto document.body, so it sits outside .kh-scope and the
   rule above can never reach it. Selected rows deepen instead of going grey. */
.kh-pickrow:hover { background: ${K.brandSoft} !important; border-color: ${K.brandBorder} !important; }
.kh-pickrow.is-on:hover { background: ${K.brandBgHover} !important; border-color: ${K.brand} !important; }

/* ── Click ripple ─────────────────────────────────────────────────────────
   Pairs with utils/ripple.js. Unscoped on purpose: ripples are used by the
   app shell and inside portalled dialogs, both of which sit outside .kh-scope.

   .kh-rip supplies the containment the ink needs. overflow is !important
   because hosts set it inline; position deliberately is NOT. An absolutely
   positioned host (a modal's close button) is already its own containing
   block, and forcing relative on it dropped it out of its corner and back
   into normal flow — that is how the dialog X ended up at the top left.
   A host with no inline position still picks up relative from this rule.
   NOTE: no backticks in this block — the whole stylesheet is a JS template
   literal, so a stray backtick ends it and breaks the build. */
.kh-rip { position: relative; overflow: hidden !important; }
.kh-rip-ink {
  position: absolute; border-radius: 50%; pointer-events: none;
  background: currentColor; opacity: .17; transform: scale(0);
  animation: kh-rip-out .58s cubic-bezier(.22,1,.36,1) forwards;
}
@keyframes kh-rip-out { to { transform: scale(1); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .kh-rip-ink { display: none !important; } }

/* ── Decorative card background ───────────────────────────────────────────
   A faint herb sprig in the bottom-right plus a soft corner wash, in the brand
   green. Purely background-image + gradients, so it costs no DOM and cannot be
   selected or read by a screen reader.

   The host must set backgroundColor, NOT the background shorthand — the
   shorthand resets background-image and would wipe this out.

   The SVG is a data URI: single quotes only, and %23 for the colour's hash.
   NOTE: no backticks anywhere in this block — the whole stylesheet is a JS
   template literal and a stray backtick ends it. */
.kh-cardart {
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><g fill='none' stroke='%23C69A3E' stroke-opacity='0.20' stroke-width='0.75' stroke-linecap='round' stroke-linejoin='round'><path d='M6.5 20.5h11'/><path d='M6.5 17.5h11v-4a4.5 4.5 0 1 0-2.6-8.2a4 4 0 0 0-5.8 0A4.5 4.5 0 1 0 6.5 13.5z'/></g></svg>"),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><g fill='%231C3D2B' fill-opacity='0.055'><path d='M118 4C78 8 48 30 38 60c-5 14-2 27 7 33 12 8 30 1 42-16C99 60 110 34 118 4z'/><path d='M62 74c-27 2-47 17-54 37-3 9 0 17 6 20 9 4 21-2 29-15 8-12 15-26 19-42z'/></g></svg>"),
    radial-gradient(130% 100% at 100% 0%, rgba(28,61,43,.05) 0%, rgba(28,61,43,0) 62%),
    radial-gradient(90% 120% at 0% 100%, rgba(198,154,62,.045) 0%, rgba(198,154,62,0) 58%);
  background-repeat: no-repeat, no-repeat, no-repeat, no-repeat;
  background-position: left -16px bottom -24px, right -26px top -34px, center, center;
  background-size: 150px auto, 165px auto, cover, cover;
}
/* Smaller cards get one motif at a smaller size — the full pair reads as
   clutter once the card is only a few hundred pixels wide. */
.kh-cardart-sm {
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><g fill='%231C3D2B' fill-opacity='0.045'><path d='M118 4C78 8 48 30 38 60c-5 14-2 27 7 33 12 8 30 1 42-16C99 60 110 34 118 4z'/><path d='M62 74c-27 2-47 17-54 37-3 9 0 17 6 20 9 4 21-2 29-15 8-12 15-26 19-42z'/></g></svg>"),
    radial-gradient(120% 90% at 100% 0%, rgba(28,61,43,.04) 0%, rgba(28,61,43,0) 60%);
  background-repeat: no-repeat, no-repeat;
  background-position: right -20px top -24px, center;
  background-size: 108px auto, cover;
}
/* No position rule on the children. An element's background-image paints
   beneath all of its descendants by definition, so the content is already on
   top; forcing position:relative on every direct child of every Card in the
   app only risked re-anchoring somebody's absolutely-positioned descendant.
   NOTE: no backticks in this block — the stylesheet is a JS template literal
   and a stray backtick ends it. */

/* ── Sidebar footer plate ────────────────────────────────────────────────
   On a short window this plate left almost no room for the nav list, so opening
   a group pushed items behind it and they read as truncated.

   The height is all-or-nothing, NOT scaled. The artwork is bottom-anchored and
   cropped with object-fit:cover, so trimming the height eats into the wave from
   the top and leaves a sliver — shrinking it was exactly the broken notch the
   sbFooterH comment warns about. On a short screen it is dropped entirely
   instead, which frees the same space without mangling the image. The nav list
   then owns that space and scrolls on its own. */
.ash-sb-footer { height: 288px; }
@media (max-height: 820px) { .ash-sb-footer { display: none !important; } }

/* Dish-name-mapping list. Unscoped — it lives in a portalled dialog.
   Four fixed tracks so the SOP controls form a real column: status marker,
   dish name, the select, the action slot. The action slot is always present
   (empty where there is no action) so nothing shifts row to row. */
.kh-mapbody { container-type: inline-size; }
.kh-maprow {
  display: grid; align-items: center; gap: 12px;
  grid-template-columns: 24px minmax(0, 1fr) 226px 30px;
  transition: background .16s ease;
}
@container (max-width: 620px) {
  /* Too narrow for a side-by-side column — the select drops under the name and
     spans the text and action tracks. */
  .kh-maprow { grid-template-columns: 24px minmax(0, 1fr) 30px; row-gap: 9px; }
  .kh-maprow > *:nth-child(3) { grid-column: 2 / 3; grid-row: 2; }
  .kh-maprow > *:nth-child(4) { grid-column: 3 / 4; grid-row: 2; }
}
.kh-maprow:hover { background: ${K.brandSoft} !important; }
.kh-mapsel { transition: border-color .16s ease, background .16s ease; }
.kh-mapsel:hover { border-color: ${K.brand} !important; }
.kh-maprow-del { transition: background .16s ease, border-color .16s ease, color .16s ease; }
.kh-maprow-del:hover { background: ${K.dangerBg} !important; border-color: ${K.dangerBorder} !important; color: ${K.danger} !important; }
.kh-chipfilter { transition: filter .16s ease, box-shadow .16s ease; }
.kh-chipfilter:hover { filter: brightness(.96); }

/* Yield entry — brand focus ring instead of the browser default blue. */
.kh-yieldinput { transition: border-color .16s ease, box-shadow .16s ease; }
.kh-yieldinput:focus { border-color: ${K.brand} !important; box-shadow: 0 0 0 3px rgba(28,61,43,.13) !important; }
/* Step undo — ghost until hovered. */
.kh-undobtn { transition: background .16s ease, border-color .16s ease, color .16s ease; }
.kh-undobtn:hover { background: ${K.warnBg} !important; border-color: ${K.warnBorder} !important; color: ${K.warn} !important; }
/* Sign-off is the one irreversible button on the screen — it lifts on hover. */
.kh-signoff { transition: filter .16s ease, box-shadow .16s ease; }
.kh-signoff:hover { filter: brightness(.94); }

/* Toasts. Bottom-right on desktop, full width along the bottom on a phone so
   the message is not squeezed into a corner. The wrapper ignores pointer
   events; only the toast itself accepts them, so it never blocks the UI. */
.kh-toast-wrap {
  position: fixed; right: 22px; bottom: 22px; z-index: 10001;
  display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
  pointer-events: none;
}
@media (max-width: 640px) {
  .kh-toast-wrap { left: 14px; right: 14px; bottom: 14px; align-items: stretch; }
}
@keyframes kh-toast-in { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
.kh-toast { animation: kh-toast-in .24s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .kh-toast { animation: none !important; } }

/* Modal close button — same portal caveat as above, so it is unscoped too. */
.kh-modal-x { transition: background .16s ease, color .16s ease, border-color .16s ease; }
.kh-modal-x:hover { background: ${K.brandBg} !important; color: ${K.brand} !important; border-color: ${K.brandBorder} !important; }

/* Dialog entrance — a short rise, not a bounce. Disabled for reduced motion. */
@keyframes kh-modal-in { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes kh-scrim-in { from { opacity: 0; } to { opacity: 1; } }
.kh-modal-card { animation: kh-modal-in .22s cubic-bezier(.22,1,.36,1) both; }
.kh-modal-scrim { animation: kh-scrim-in .18s ease both; }
@media (prefers-reduced-motion: reduce) {
  .kh-modal-card, .kh-modal-scrim { animation: none !important; }
}

/* Inputs inside the scope get the accent focus ring instead of the gold one */
.kh-scope input:focus, .kh-scope select:focus, .kh-scope textarea:focus {
  border-color: ${K.accent} !important;
  box-shadow: 0 0 0 3px rgba(37,99,235,.14) !important;
}

/* ── Kitchen Stations grid ──
   Header and rows share this template so columns always line up.
   Narrow screens progressively drop the numeric columns. */
.kh-scope .kh-strow {
  display: grid;
  grid-template-columns: 34px minmax(0,1fr) 76px 76px minmax(120px,1fr) 116px 26px;
  align-items: center;
  gap: 12px;
}
@media (max-width: 1100px) {
  .kh-scope .kh-strow { grid-template-columns: 34px minmax(0,1fr) 76px minmax(90px,1fr) 116px 26px; }
  .kh-scope .kh-col-ready { display: none; }
}
@media (max-width: 780px) {
  .kh-scope .kh-strow { grid-template-columns: 28px minmax(0,1fr) 100px 26px; gap: 10px; }
  .kh-scope .kh-col-dishes, .kh-scope .kh-col-progress { display: none; }
}

/* ── Collect-from-store ingredient list ──
   Category cards pack into columns; each card collapses on its own, which is
   what keeps a 28-item aisle from stretching the grid. align-items:start so a
   short card never stretches to match a tall neighbour. */
.kh-scope .kh-catgrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 14px;
  align-items: stretch;   /* every card in a row is the same height */
}
/* Card is a column so the header stays put and the body takes the slack. */
.kh-scope .kh-catcard { display: flex; flex-direction: column; }
/* A 28-item aisle would otherwise make its whole row enormous — cap the body
   and let just that card scroll. */
.kh-scope .kh-catbody { flex: 1; overflow-y: auto; max-height: 360px; }
.kh-scope .kh-catbody::-webkit-scrollbar { width: 4px; }

/* The hub's own scroll box (everything under the fixed tab strip). Its
   scrollbar ran the full height of the page as a visible grey rail beside the
   content, so it is hidden. Scrolling itself is untouched - wheel, trackpad,
   touch, keyboard and scrollIntoView all still work. */
.kh-scope .kh-hubscroll { scrollbar-width: none; -ms-overflow-style: none; }
.kh-scope .kh-hubscroll::-webkit-scrollbar { width: 0; height: 0; }

/* One ingredient row: emoji · name · qty · unit · collect toggle.
   The row is inert; only .kh-ingcheck at the end is interactive.
   The name column is a free 1fr so long names wrap instead of truncating. */
.kh-scope .kh-ingrow {
  display: grid;
  grid-template-columns: 26px minmax(0,1fr) auto 34px auto;
  align-items: center;
  gap: 12px;
}
.kh-scope .kh-ingcheck { transition: background .16s ease, border-color .16s ease !important; }
.kh-scope .kh-ingcheck:hover { filter: none; background: ${K.accentSoft} !important; border-color: ${K.accentBorder} !important; }
.kh-scope .kh-ingcheck:focus-visible { outline: none; background: ${K.accentSoft} !important; border-color: ${K.accent} !important; }

/* Rows size to their CARD, not the viewport — two cards side by side on a wide
   screen are still narrow. Container queries are the only way to get that
   right; where they are unsupported the viewport fallback below still fires. */
.kh-scope .kh-catcard { container-type: inline-size; }
/* Container queries need a containment context that is not also the flex column
   above, so the body carries its own. */
.kh-scope .kh-catbody { container-type: inline-size; }
@container (max-width: 520px) {
  .kh-scope .kh-ing-marklabel { display: none; }
  .kh-scope .kh-ingrow { grid-template-columns: 26px minmax(0,1fr) auto 30px auto; gap: 10px; }
}
@container (max-width: 400px) {
  .kh-scope .kh-ing-unit { display: none; }
  .kh-scope .kh-ingrow { grid-template-columns: 24px minmax(0,1fr) auto auto; gap: 9px; }
}
@media (max-width: 620px) {
  .kh-scope .kh-ingrow { grid-template-columns: 24px minmax(0,1fr) auto auto; gap: 8px; }
  .kh-scope .kh-ing-unit { display: none; }
  .kh-scope .kh-ing-marklabel { display: none; }
}

/* Stat tiles wrap into a responsive grid rather than a rigid flex row */
.kh-scope .kh-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
  gap: 12px;
}

/* Cards that respond to the pointer. Add .kh-lift to any card. */
.kh-scope .kh-lift { transition: transform .18s var(--ease-luxury), box-shadow .18s var(--ease-luxury), border-color .18s ease; }
.kh-scope .kh-lift:hover { transform: translateY(-2px); box-shadow: ${K.shadowLift} !important; border-color: ${K.lineStrong} !important; }

/* Stat tiles: a plain grey border change is invisible on a white card, so the
   hover picks up the accent border + an accent-tinted shadow. */
.kh-scope .kh-stat:hover {
  border-color: ${K.accentBorder} !important;
  box-shadow: 0 6px 22px rgba(37,99,235,.16) !important;
}

/* ══ APP SHELL ══
   Sidebar / topbar chrome. Global (not under .kh-scope) because the shell
   wraps every screen. All names are prefixed .ash- so they cannot collide. */

/* The global stylesheet applies a brightness filter to every button hover,
   which washes out white/ghost chrome. Opt these out and give them real states. */
.ash-nav, .ash-iconbtn, .ash-btn, .ash-menu-item, .ash-result, .ash-userchip { transition: background .16s ease, color .16s ease, border-color .16s ease, box-shadow .16s ease !important; }
.ash-nav:hover, .ash-iconbtn:hover, .ash-btn:hover, .ash-menu-item:hover, .ash-result:hover, .ash-userchip:hover { filter: none; }

/* ── Sidebar logo ──
   Settles in once on mount, then a gold sheen sweeps the lettering every few
   seconds. The sheen is masked BY the logo art, so the highlight rides the
   letterforms instead of a rectangle passing over them — that masking is the
   whole difference between "premium" and "banner ad". */
@keyframes ash-logo-in {
  from { opacity: 0; transform: translateY(7px); }
  to   { opacity: 1; transform: none; }
}
@keyframes ash-logo-sheen {
  0%        { background-position: -150% 0; }
  55%, 100% { background-position:  250% 0; }
}
.ash-logo-wrap { position: relative; display: block; }
.ash-logo { animation: ash-logo-in .75s var(--ease-luxury) both; }
.ash-logo-sheen {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 40%, rgba(216,172,62,.9) 50%, transparent 60%);
  background-size: 220% 100%;
  animation: ash-logo-sheen 7s ease-in-out 1.4s infinite;
  -webkit-mask-image: var(--logo-mask); mask-image: var(--logo-mask);
  -webkit-mask-size: contain;          mask-size: contain;
  -webkit-mask-repeat: no-repeat;      mask-repeat: no-repeat;
  -webkit-mask-position: center;       mask-position: center;
}
/* Without mask support the sheen would be a plain rectangle sliding over the
   logo, which looks broken — drop it rather than show that. */
@supports not ((mask-image: url(#m)) or (-webkit-mask-image: url(#m))) {
  .ash-logo-sheen { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .ash-logo { animation: none; }
  .ash-logo-sheen { display: none; }
}

/* ── Boot screen ──
   Indeterminate bar: the app cannot report real progress (several Supabase
   loads run in parallel), so a sweeping bar is honest where a filling one
   would not be. */
@keyframes ash-boot-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}
@keyframes ash-boot-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(320%); }
}
.ash-boot      { animation: ash-boot-in .55s var(--ease-luxury) both; }
.ash-boot-mark { animation: ash-boot-in .55s var(--ease-luxury) both; }
.ash-boot-bar  { animation: ash-boot-sweep 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ash-boot, .ash-boot-mark { animation: none; }
  .ash-boot-bar { animation: none; transform: none; width: 100% !important; }
}

/* Collapsible section header */
.ash-navgroup { transition: background .16s ease !important; }
.ash-navgroup:hover { filter: none; background: rgba(28,61,43,.05) !important; }

/* Sidebar nav item — hover is a warm tint off the ivory panel. */
.ash-nav:hover { background: rgba(28,61,43,.055) !important; color: ${K.sbText} !important; }
/* Active row is a solid deep-green plate — keep the label white, just lift it. */
.ash-nav.is-active:hover { background: #24523A !important; color: ${K.sbActiveText} !important; }

/* Round icon buttons in the topbar / sidebar */
.ash-iconbtn:hover { background: ${K.surfaceHover} !important; border-color: ${K.lineStrong} !important; color: ${K.text} !important; }

/* Header buttons */
.ash-btn-ghost:hover { background: ${K.surfaceHover} !important; border-color: ${K.lineStrong} !important; color: ${K.text} !important; }
.ash-btn-accent:hover { background: ${K.accentHover} !important; box-shadow: 0 6px 18px rgba(37,99,235,.34) !important; }

/* Avatar / user chip + its dropdown */
.ash-userchip:hover { background: ${K.surfaceHover} !important; border-color: ${K.lineStrong} !important; }
.ash-menu-item:hover { background: ${K.surfaceHover} !important; }
.ash-menu-item.is-danger:hover { background: ${K.dangerBg} !important; color: ${K.danger} !important; }

/* Search field — still used by the collect-from-store ingredient search.
   (.ash-result and .ash-search-wrap went with the topbar search box.) */
.ash-search { transition: border-color .16s ease, box-shadow .16s ease, background .16s ease; }
.ash-search:hover { border-color: ${K.lineStrong} !important; }
.ash-search:focus-within { border-color: ${K.accent} !important; box-shadow: 0 0 0 3px rgba(37,99,235,.14) !important; }
.ash-search input:focus { box-shadow: none !important; border-color: transparent !important; }
`;

// Inject (or refresh) the stylesheet. Rewriting textContent when the tag
// already exists means an edit to KITCHEN_CSS shows up on hot reload instead of
// silently keeping the stale rules until a hard refresh.
if (typeof document !== "undefined") {
  let s = document.getElementById("ambria-kitchen-css");
  if (!s) {
    s = document.createElement("style");
    s.id = "ambria-kitchen-css";
    document.head.appendChild(s);
  }
  if (s.textContent !== KITCHEN_CSS) s.textContent = KITCHEN_CSS;
}

export { K, type, tone, TONES, KITCHEN_CSS };
