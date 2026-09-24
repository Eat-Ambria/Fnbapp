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
  // Sage — a muted, greyed green beside the brand's deep forest one. For a
  // panel that should read as calm and secondary: it belongs to the same family
  // without competing with a brand-green primary button in the same dialog.
  // sageText, not sage, for anything carrying words: sage alone is about 3:1 on
  // sageBg, which is fine for an icon and not for a sentence.
  sage:      "#5E7355",  sageBg:    "#EDF2E8",  sageBorder:    "#D3DFC8",
  // A picked surface. Darker than sageBg, which is the panel wash - side by
  // side down a list the two were too close to tell apart.
  sageSel:   "#D7E4CB",
  sageText:  "#44543D",  sageBgHover: "#E3EBDB",
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
  // Warm ivory card face, for grids that are mostly card. The app's default
  // card is a cool white, and a wall of a dozen of them reads as blank paper;
  // this is the same ivory family as the header plate they sit under.
  cardWarm:    "#FBFAF5",
  cardWarmLine:"#E8E3D6",
  hdrBadge:    "#1C3D2B",
  hdrBadgeIcon:"#D9C08A",
  // Gold for hairline rules and the script tagline on the header plate.
  // NOT C.gold — that key is historical and actually holds the blue accent.
  // And not hdrBadgeIcon either: #D9C08A is sized for an icon on deep green,
  // and on ivory a 1px rule in it all but disappears. Same hue, taken down to
  // where it still reads at one pixel and as small italic text.
  gold:        "#A8852F",
  goldSoft:    "#DFD3B4",
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
  shadowCard: "0 1px 3px rgba(17,28,51,.16), 0 6px 14px rgba(17,28,51,.13), 0 20px 42px rgba(17,28,51,.17)",
  shadowLift: "0 2px 6px rgba(17,28,51,.22), 0 10px 22px rgba(17,28,51,.19), 0 28px 60px rgba(17,28,51,.28)",
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
/* The leaf photograph, laid UNDER the vector motifs as a texture rather than
   as a picture. The flat ivory layer on top of it is what keeps text legible:
   a background-image cannot take an opacity of its own, so the photo is faded
   by stacking a near-opaque wash above it in the same background list.
   .80, not .90: at 10% strength the photograph was there and invisible,
   which is the same as not applying it.
   Larger surfaces get more of it; a 210px dish card would only show one
   meaningless crop, so it keeps the vector motif alone.
   url() is relative to the stylesheet, and this sheet is injected into the
   page, so the path resolves against the document - which vite serves at
   base:/Fnbapp/. Hence the leading /Fnbapp/.
   One class, not two: .kh-leafwash and .kh-cardart-sm both set background-image,
   and the one declared later in this sheet would silently win. So the wash
   carries the vector motif itself and replaces cardart on the surfaces it is
   applied to. */
.kh-leafwash {
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><g fill='%231C3D2B' fill-opacity='0.045'><path d='M118 4C78 8 48 30 38 60c-5 14-2 27 7 33 12 8 30 1 42-16C99 60 110 34 118 4z'/><path d='M62 74c-27 2-47 17-54 37-3 9 0 17 6 20 9 4 21-2 29-15 8-12 15-26 19-42z'/></g></svg>"),
    linear-gradient(rgba(251,250,245,.80), rgba(251,250,245,.80)),
    url("/Fnbapp/leaf-bg.webp");
  background-repeat: no-repeat, no-repeat, no-repeat;
  background-position: right -20px top -24px, center, center;
  background-size: 108px auto, cover, cover;
}

/* The menu-builder header plate carries its own artwork. A separate class, not
   a change to .kh-leafwash: three surfaces on that screen share the wash, and
   editing it would repaint all of them.
   The photograph is 3:1 and this plate is roughly 14:1, so cover crops it to a
   thin horizontal band. Anchored to the bottom, that band is the one carrying
   the gold line and the foliage, which is what the artwork is for - centred,
   it lands on empty marble and the picture may as well not be there.
   The ivory gradient is not decoration. The photograph's leaf shadows fall
   exactly where the heading sits, and the heading has to win; it clears by 55%
   so the gold line still starts under the meta row rather than past it.
   No wash and no vector motif on top, unlike .kh-leafwash - this image already
   carries its own marble and foliage, and a second layer only muddies it.
   url() resolves against the document, which vite serves at base:/Fnbapp/. */
.kh-plateart { position: relative; overflow: hidden; }
.kh-plateart > * { position: relative; z-index: 1; }

/* The photograph sits on a pseudo-element rather than on the plate, because a
   filter on the plate would blur the heading along with it.
   inset is negative so the blur has material to pull from past every edge -
   blurred to the boundary and no further, the picture fades out in a band all
   the way round and reads as a smudge rather than a backdrop. The plate's own
   overflow:hidden clips the overspill back to the rounded corner.
   bottom 26px, not bottom: the box now ends 26px below the plate, so the band
   the artwork is cropped to has to be pushed back up by the same amount. */
.kh-plateart::before {
  content: ""; position: absolute; inset: -26px; z-index: 0; pointer-events: none;
  background-image: url("/Fnbapp/plate-bg.webp");
  background-repeat: no-repeat;
  background-position: center bottom 26px;
  background-size: cover;
  filter: blur(3px);
  opacity: .68;
}

/* The ivory fade has to sit above the photograph, so it gets its own layer
   rather than riding along as a second background on the one below. */
.kh-plateart::after {
  content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image: linear-gradient(90deg, rgba(251,250,245,.90) 0%, rgba(251,250,245,.58) 24%, rgba(251,250,245,0) 55%);
}

/* Calendar chrome: month arrows and the Today pill. !important because these
   carry their colours inline, and an inline style beats a plain selector. */
.kh-calnav:hover {
  background: ${K.brandBg} !important;
  border-color: ${K.brandBorder} !important;
  color: ${K.brand} !important;
}
/* A day cell is a click target with no border of its own, so hover is the only
   thing that says so before you press it. The selected and today tiles paint
   their own background on the child, which sits above this. */
.kh-calcell:hover { background: ${K.sageBg}; }

/* Production planning: the column heads and the dish rows under them share one
   grid template, so a column cannot drift away from the heading that names it.
   Below 720px the heads go and the row stacks - four columns in a phone's
   width leaves the dish name about eight characters. */
.kh-planhead, .kh-planrow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px 54px 126px;
  align-items: center;
  gap: 12px;
}
@media (max-width: 720px) {
  .kh-planhead { display: none; }
  .kh-planrow { grid-template-columns: 1fr; gap: 8px; }
}

/* The yield slider. accent-color alone gives Chrome the brand fill but leaves a
   2px hairline of a track and a small thumb; at the width this spans, that was
   a scrollbar with a dot on it rather than a control worth dragging. */
.kh-yieldrange {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 999px;
  background: ${K.cardWarmLine};
  accent-color: ${K.brand};
}
.kh-yieldrange::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: ${K.brand};
  border: 3px solid #FFFFFF;
  box-shadow: 0 1px 4px rgba(17,28,51,.32);
  cursor: pointer;
}
.kh-yieldrange::-moz-range-thumb {
  width: 14px; height: 14px;
  border-radius: 50%;
  background: ${K.brand};
  border: 3px solid #FFFFFF;
  box-shadow: 0 1px 4px rgba(17,28,51,.32);
  cursor: pointer;
}
.kh-yieldrange::-moz-range-track {
  height: 6px; border-radius: 999px; background: ${K.cardWarmLine};
}

/* The yield input in a planning row. An empty one shows the auto suggestion as
   a placeholder, so it has to read as editable BEFORE it is focused - a bare
   number on ivory looked like printed output nobody could change. */
.kh-planinput:hover:not(:disabled) { border-color: ${K.sageBorder} !important; }
.kh-planinput:focus {
  outline: none;
  border-color: ${K.brand} !important;
  box-shadow: 0 0 0 3px ${K.brandBg};
}

/* Today's events stay full-width rows: there are only ever a handful, they are
   the ones being cooked right now, and they expand in place for edit/delete.
   The columns give the middle something to hold - as a name at the left edge
   and a headcount at the right, most of the row was empty.
   Below 900px it drops to the date tile plus a stacked block, because five
   columns in a phone's width leaves each one a few characters. */
.kh-evrow {
  display: grid;
  grid-template-columns: 54px minmax(0, 1.5fr) minmax(0, 1.1fr) 108px 88px;
  align-items: center;
  gap: 16px;
}
@media (max-width: 900px) {
  .kh-evrow { grid-template-columns: 54px minmax(0, 1fr); gap: 12px; }
  .kh-evrow > .kh-evwide { grid-column: 2; }
}

/* Menus-needing-confirmation table. Heads and rows share one template so a
   column cannot drift from the heading that names it.
   Tablet (1250px) drops Type and Package - they are the two a confirmer does
   not need to see to decide, and the row is opened to fix them anyway. Below
   900px the table stops being a table: five columns in that width leaves the
   guest name about eight characters, so each row becomes a stacked block. */
.kh-mchead, .kh-mcrow {
  display: grid;
  grid-template-columns: 54px minmax(0, 1.4fr) minmax(0, 1.1fr) minmax(0, .8fr) minmax(0, 1.2fr) 74px 66px 132px;
  align-items: center;
  gap: 14px;
}
@media (max-width: 1250px) {
  .kh-mchead > :nth-child(4), .kh-mcrow > :nth-child(5),
  .kh-mchead > :nth-child(5), .kh-mcrow > :nth-child(6) { display: none; }
  .kh-mchead, .kh-mcrow {
    grid-template-columns: 54px minmax(0, 1.5fr) minmax(0, 1.2fr) 74px 66px 132px;
  }
}
@media (max-width: 900px) {
  .kh-mchead { display: none; }
  .kh-mcrow {
    grid-template-columns: 54px minmax(0, 1fr) auto;
    row-gap: 8px;
  }
  /* Venue, pax and days wrap under the name rather than each taking a column
     of their own; Actions keeps the right edge of the first row. */
  .kh-mcrow > :nth-child(3) { grid-column: 2 / -1; }
  .kh-mcrow > :nth-child(7) { grid-column: 2; text-align: left !important; }
  .kh-mcrow > :nth-child(8) { grid-column: 3; }
}

/* The day's totals in the shell header.
   The plate they sit in wraps, so at tablet widths all three dropped onto a
   second line inside it and the header grew a whole row taller — for three
   numbers. A width media query alone could not fix that: the breakpoint is not
   the viewport, it is whether they fit beside a page title of unknown length.
   So they shrink first and only then go away: full tiles on a desktop, then
   icon-and-number once the labels are what is costing the room, then nothing.
   nowrap on the strip itself, so the three never break amongst themselves. */
.kh-hdrkpi { display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; }
/* The short label is the tablet one, so it is off until the layout asks for it. */
.kh-hdrkpi-s { display: none; }
@media (max-width: 1400px) {
  .kh-hdrkpi { gap: 7px; }
  .kh-hdrkpi-tile { padding: 7px 11px !important; gap: 8px !important; border-radius: 12px !important; }
  .kh-hdrkpi-ic { width: 26px !important; height: 26px !important; border-radius: 8px !important; }
  .kh-hdrkpi-n { font-size: 16px !important; }
  /* Number and label go side by side instead of stacked. "25 functions" on one
     line is narrower than "25" over "Functions today", which is what made the
     stacked form too wide here in the first place - and dropping the label
     outright left three unexplained numbers, because a tablet cannot hover to
     reach the tooltip they fell back to. */
  .kh-hdrkpi-txt { display: flex; align-items: baseline; gap: 5px; }
  .kh-hdrkpi-l { display: none; }
  .kh-hdrkpi-s { display: block; }
}
@media (max-width: 1050px) { .kh-hdrkpi { display: none; } }

/* A sortable column head is a button, so it needs to say so before it is
   clicked - the caret alone is easy to miss at 10px. */
.kh-sorth:hover { color: ${K.brand} !important; }

/* The function form. Three columns, not two: eleven fields two-up ran past the
   bottom of the window and the dialog had to scroll, which on a form this short
   means half of it is always out of sight. Three fits the whole thing in one
   view on a laptop. */
.kh-formgrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 780px) { .kh-formgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 540px) { .kh-formgrid { grid-template-columns: 1fr; } }

/* The summary strip at the foot of the dashboard: equal halves divided by a
   hairline, stacking rather than squeezing once there is no room for two. */
.kh-statstrip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 760px) {
  .kh-statstrip { grid-template-columns: 1fr; }
  /* The divider has to move with the stack or it draws down the middle of
     nothing. :not(:first-child) rather than a nth-child guess. */
  .kh-statstrip > *:not(:first-child) {
    border-left: none !important;
    border-top: 1px solid ${K.cardWarmLine};
  }
}

/* Upcoming functions, four across. As full-width rows each one spent most of
   its width on nothing - a name at the left edge and a headcount at the right
   with a clear third of the screen between them. Four to a row, the card is
   about as wide as its longest line actually needs.
   It steps down rather than letting minmax squeeze four columns onto a phone. */
.kh-evgrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 1500px) { .kh-evgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 1100px) { .kh-evgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 680px)  { .kh-evgrid { grid-template-columns: 1fr; } }

/* An expandable section row. The whole row is the click target but nothing on
   it says so until the pointer is over it. */
.kh-secrow:hover { background: ${K.sageBg}; }

/* An upcoming-function card. The whole card opens the editor, so hovering it
   lifts rather than just tinting: a flat colour change says "selected", a lift
   says "press me", and these are buttons.
   background-COLOR, never the shorthand - the shorthand resets background-image
   and would wipe the .kh-cardart-sm leaf off mid-hover.
   The transition sits on the card, not the :hover rule, so it eases back out
   as well as in. */
.kh-evcard {
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease;
}
.kh-evcard:hover {
  transform: translateY(-3px);
  box-shadow: ${K.shadowLift};
  /* Brand, not sage: sage is this app's "picked" colour and these cards are not
     selectable, they are openable. */
  border-color: ${K.brandBorder} !important;
  background-color: #FFFDF8 !important;
}
.kh-evcard:active { transform: translateY(-1px); }

/* The divider inside the card. Short at rest, drawn out to the full width on
   hover - the one piece of movement that belongs to this app rather than to
   card hovers in general, since the gold rule is already its signature on the
   header plates. */
.kh-evrule {
  height: 1.5px;
  width: 38px;
  flex-shrink: 0;
  border-radius: 2px;
  background: ${K.gold};
  transition: width .24s cubic-bezier(.4,0,.2,1);
}
.kh-evcard:hover .kh-evrule { width: 100%; }

/* The date tile leans in very slightly, so the eye has something to land on
   besides the card edge. Its own class, not a positional selector - the card's
   children are a delete button, three blocks and a rule, and "first div" picked
   up three of them. */
.kh-evtile { transition: transform .18s ease; }
.kh-evcard:hover .kh-evtile { transform: scale(1.05); }

/* All of the above is motion. Someone who asked for less of it keeps the tint,
   the border and the shadow, which are what say the card is live. */
@media (prefers-reduced-motion: reduce) {
  .kh-evcard, .kh-evcard:hover, .kh-evcard:active,
  .kh-evtile, .kh-evcard:hover .kh-evtile { transform: none !important; }
  .kh-evrule, .kh-evcard:hover .kh-evrule { transition: none !important; }
}

/* The delete cross on a function card. Quiet until pointed at, so eight of
   them across a grid do not read as eight warnings; the card's own hover tints
   it sage, and this rule has to outrank that, hence !important.
   It stays visible rather than appearing on hover - most of this app's use is
   on a tablet, where there is no hover to reveal it with. */
.kh-cardx:hover {
  background: ${K.dangerBg} !important;
  border-color: ${K.dangerBorder} !important;
  color: ${K.danger} !important;
}

/* Function rows in the day rail. !important because the face colour is inline
   and carries the selected state, which a plain selector cannot outrank. */
/* background-COLOR, not the background shorthand: the shorthand resets
   background-image, so hovering a card that carries .kh-cardart-sm would wipe
   its artwork off and put it back on mouse-out. */
.kh-fncard:hover {
  background-color: ${K.sageBg} !important;
  border-color: ${K.sageBorder} !important;
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
/* Top-centre, where a browser alert appears - this is the thing replacing it,
   and a message that lands in the corner gets missed when the eye is on the
   middle of the screen. */
.kh-toast-wrap {
  position: fixed; top: 22px; left: 50%; transform: translateX(-50%); z-index: 10001;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  pointer-events: none;
}
@media (max-width: 640px) {
  .kh-toast-wrap { left: 14px; right: 14px; top: 14px; transform: none; align-items: stretch; }
}
@keyframes kh-toast-in { from { opacity: 0; transform: translateY(-14px) scale(.98); } to { opacity: 1; transform: none; } }
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

/* Any small panel that scrolls inside a rounded box - dropdown menus, picker
   lists. The default rail is a hard grey line that runs the full height and
   meets the rounded corner as a straight edge. This one is a floating pill
   with nothing behind it, inset by a transparent border so it never touches
   the corner. UNSCOPED: some of these panels are portalled out of .kh-scope. */
.kh-thinscroll { scrollbar-width: thin; scrollbar-color: ${K.lineStrong} transparent; }
.kh-thinscroll::-webkit-scrollbar { width: 10px; height: 10px; }
.kh-thinscroll::-webkit-scrollbar-track { background: transparent; }
.kh-thinscroll::-webkit-scrollbar-thumb {
  background: ${K.lineStrong};
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.kh-thinscroll::-webkit-scrollbar-thumb:hover { background: ${K.textFaint}; background-clip: padding-box; }
.kh-thinscroll::-webkit-scrollbar-corner { background: transparent; }

/* The shell's scrolling panes — the content area and the sidebar nav — were on
   the browser's default bar, which on Windows is a wide grey gutter sitting
   between the sidebar and the cards.
   Thin on a pointer device, because there the bar is also the only thing that
   says how far down the page goes. Gone entirely on a tablet, where scrolling
   is a swipe and the bar is a stripe of chrome across the artwork for nothing.
   overflow stays auto in both cases: this hides the bar, it does not stop the
   pane scrolling. */
.kh-shellscroll { scrollbar-width: thin; scrollbar-color: ${K.lineStrong} transparent; }
.kh-shellscroll::-webkit-scrollbar { width: 10px; height: 10px; }
.kh-shellscroll::-webkit-scrollbar-track { background: transparent; }
.kh-shellscroll::-webkit-scrollbar-thumb {
  background: ${K.lineStrong};
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
.kh-shellscroll::-webkit-scrollbar-thumb:hover { background: ${K.textFaint}; background-clip: padding-box; }
@media (max-width: 1150px) {
  .kh-shellscroll { scrollbar-width: none; }
  .kh-shellscroll::-webkit-scrollbar { width: 0; height: 0; }
}

/* Big clickable panels — the CSV dialog's download row, its file picker.
   They carry .kh-btn but no .kh-btn-<variant>, so none of the variant hover
   rules above ever matched them and a click produced no visible change at all.
   Unscoped: these live in dialogs, which are sometimes portalled out of
   .kh-scope. The ripple ink is currentColor at .17 opacity, so a panel that
   wants visible ink has to set a real colour of its own — a pale inherited grey
   on a pale panel is invisible, which is what made the row feel dead.
   NOTE: no backticks in this block — the stylesheet is a JS template literal
   and a stray backtick ends it. */
.kh-pressrow { transition: background .14s ease, border-color .14s ease, transform .08s ease; }
.kh-pressrow:hover { background: ${K.brandBg} !important; border-color: ${K.brand} !important; }
.kh-pressrow:active { transform: scale(.995); background: ${K.brandBgHover} !important; }
/* Amber variant for the upload panel, which is the destructive path. */
.kh-pressrow.is-warn:hover { background: ${K.warnBorder} !important; border-color: ${K.warn} !important; }
.kh-pressrow.is-warn:active { background: ${K.warnBg} !important; }
/* ── Motion ───────────────────────────────────────────────────────────────
   Three jobs only, all tied to something the user did or is waiting for:
   panels arriving, a pick registering, and a number changing. Nothing loops
   and nothing moves on its own: movement you notice while reading is what
   makes a screen tiring.
   Every rule here is switched off wholesale under prefers-reduced-motion,
   the same guard the ripple already honours. */
@keyframes kh-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes kh-pop  { 0% { transform: scale(.55); opacity: 0; } 62% { transform: scale(1.14); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes kh-tick { 0% { transform: translateY(-5px); opacity: 0; } 100% { transform: none; opacity: 1; } }

/* Panels arriving. The fill mode is both, so the element is already hidden
   before the first frame paints - otherwise it flashes at full opacity and
   then animates. NOTE: no backticks in this block, the stylesheet is a JS
   template literal and a stray backtick ends it. */
.kh-rise { animation: kh-rise .42s cubic-bezier(.22,1,.36,1) both; }

/* A pick registering. Overshoots slightly, because the whole point is to be
   felt at the edge of vision while the eye is still on the card. */
.kh-pop { animation: kh-pop .3s cubic-bezier(.34,1.56,.64,1) both; }

/* A number changing. Keyed on the value in JSX so React remounts the span and
   the animation replays - a CSS transition cannot animate a text swap. */
.kh-tick { animation: kh-tick .28s ease both; }

@media (prefers-reduced-motion: reduce) {
  .kh-rise, .kh-pop, .kh-tick { animation: none !important; }
}

/* ── Menu-builder controls ────────────────────────────────────────────────
   Every control on that screen is a bare .kh-btn - none of them carries a
   kh-btn-<variant>, so not one of the variant hovers above reaches them, and
   the global button:hover brightness(1.08) in styles.js does nothing at all to
   a white or transparent face. That is why the screen felt dead under the
   pointer. !important throughout, for the usual reason: the values these
   override are painted inline.
   The transition is declared here too - .kh-btn only gets one inside
   .kh-scope, and this screen is not wrapped in it. */
.kh-deptbtn, .kh-secpill, .kh-secx, .kh-dietchip, .kh-subtab, .kh-backbtn, .kh-pickchip {
  transition: background .16s ease, border-color .16s ease, color .16s ease, filter .16s ease;
}

.kh-deptbtn:hover { background: ${K.sageBg} !important; border-color: ${K.sageBorder} !important; }
.kh-deptbtn.is-on:hover { background: ${K.sageBorder} !important; border-color: ${K.sage} !important; }

.kh-backbtn:hover { background: ${K.brandBg} !important; border-color: ${K.brandBorder} !important; }

/* A selected pill is solid brand carrying white text, so its hover has to go
   darker. Tinting it the way the idle pill is tinted would put white text on a
   pale ground and make the label vanish at exactly the moment it is aimed at. */
.kh-secpill:hover { background: ${K.brandBg} !important; border-color: ${K.brandBorder} !important; }
.kh-secpill.is-on:hover { background: ${K.brandHover} !important; border-color: ${K.brandHover} !important; }
.kh-secx:hover { background: ${K.dangerBg} !important; border-color: ${K.danger} !important; color: ${K.danger} !important; }

/* Diet chips and pick chips take their on-state fill from data, not from a
   token, so their hover cannot name a colour - it darkens whatever is there.
   :not(.is-on) is load-bearing. The on-rule only sets filter, so without it the
   idle rule would still repaint the background and a selected red chip would
   turn pale green under the pointer - which is what it did. */
.kh-dietchip:not(.is-on):hover { background: ${K.brandBg} !important; border-color: ${K.brandBorder} !important; }
.kh-dietchip.is-on:hover { filter: brightness(.93) !important; }
.kh-pickchip:not(.is-on):hover { background: ${K.brandBg} !important; border-color: ${K.brandBorder} !important; }
.kh-pickchip.is-on:hover { filter: brightness(.93) !important; }

.kh-subtab:hover { background: ${K.brandBg} !important; }
.kh-subtab.is-on:hover { background: ${K.brandHover} !important; }

/* Config rows. No motif: repeated down a list of rows the leaf outline read
   as a pattern rather than as texture, and it sat right where the eye travels
   between a row name and its stepper. */
.kh-cfgrow { transition: background-color .16s ease, border-color .16s ease; }
.kh-cfgrow:hover { border-color: ${K.sage} !important; }
/* The stepper keys share one outline, so they highlight rather than repaint -
   a filled face here would break the segmented control into three buttons. */
.kh-stepkey { transition: background .14s ease; }
.kh-stepkey:hover:not(:disabled) { background: ${K.sageBgHover} !important; }

/* Menu-builder dish cards. Unscoped: that view takes over the window and is
   not wrapped in .kh-scope. Same translateY-flicker risk as .kh-sopcard
   (see its comment) — a cursor resting near the card's top edge moves out
   from under it the instant the lift applies, dropping :hover and looping.
   Shadow alone still reads as "lifted" without moving the box. */
.kh-dishcard { transition: box-shadow .12s ease; }
.kh-dishcard:hover { box-shadow: ${K.shadowLift} !important; }

/* Proposal rows. Unscoped: this screen is not inside .kh-scope. */
.kh-proprow { transition: background .14s ease; }
.kh-proprow:hover { background: ${K.surfaceAlt} !important; }

/* Bare icon buttons inside table rows. They had no rule at all, so like the
   panels above they looked clickable and produced nothing on hover or click. */
.kh-scope .kh-iconbtn { transition: background .14s ease, color .14s ease; }
.kh-scope .kh-iconbtn:hover { background: ${K.brandBg} !important; color: ${K.brandText} !important; }

/* Sage variant for the secondary panel, so hovering it does not borrow the
   brand green that the dialog's primary button already owns. */
.kh-pressrow.is-sage:hover { background: ${K.sageBgHover} !important; border-color: ${K.sage} !important; }
.kh-pressrow.is-sage:active { background: ${K.sageBorder} !important; }

/* Closing-tab dish cards — three up. Fixed tracks rather than auto-fill: the
   card holds two number fields side by side and a notes field under them, and
   below about 300px those stop fitting, so the column count steps down at
   widths we choose instead of wherever auto-fill happens to break. */
.kh-scope .kh-closegrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
  margin-top: 10px;
}
@media (max-width: 1240px) { .kh-scope .kh-closegrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px)  { .kh-scope .kh-closegrid { grid-template-columns: minmax(0, 1fr); } }

/* Closing-tab calendar. Only a clickable cell lights up — a future date has
   nothing to open, so hovering one must not suggest that it does. */
.kh-scope .kh-calcell { transition: background .14s ease; }
.kh-scope .kh-calcell:hover { background: ${K.surfaceAlt} !important; }

/* Selects inside the SOP editors. The native control draws an OS arrow in an
   OS font, which is exactly what made the unit column look foreign among our
   own fields. appearance:none strips it; the caret below is ours. The right
   padding is what keeps a long unit from running under the caret. */
.kh-scope .kh-select {
  -webkit-appearance: none; -moz-appearance: none; appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2361708C' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'><path d='M5.5 9.5l6.5 6 6.5-6'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 15px 15px;
  padding-right: 32px !important;
}
.kh-scope .kh-select::-ms-expand { display: none; }

/* ── Recipe SOPs — category cards ──────────────────────────────────────────
   auto-fill, NOT auto-fit: auto-fit collapses the empty tracks, so a filtered
   search that leaves one match would stretch that card across the whole row. */
.kh-scope .kh-sopgrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(188px, 1fr));
  gap: 14px;
  align-items: stretch;
}
@media (max-width: 700px) {
  .kh-scope .kh-sopgrid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
}
/* Recipe rows inside a category. Two up on a desktop, one up once a column can
   no longer hold a 74px tile plus a name plus the two right-hand controls. */
.kh-scope .kh-soprows {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 10px;
  align-items: start;
}
/* The card's own colours are inline, so every hover rule that repaints one
   needs !important to win. Not on transform - nothing sets that inline.
   translateY(-3px) used to be here too, but in this tightly-packed grid
   (10px gap) lifting the card moved it out from under a stationary cursor,
   dropping :hover, snapping it back down, and re-triggering :hover — an
   infinite flicker as long as the mouse stayed still over a card. The
   shadow/border change alone still reads as "lifted" without moving the box. */
.kh-scope .kh-sopcard { transition: box-shadow .16s ease, border-color .16s ease; }
.kh-scope .kh-sopcard:hover { border-color: ${K.brandBorder} !important; box-shadow: ${K.shadowLift} !important; }
.kh-scope .kh-sopcard:hover .kh-sopgo { background: ${K.brand} !important; border-color: ${K.brand} !important; color: #FFFFFF !important; }
/* The "..." button only appears on hover or focus, so 13 cards do not read as
   13 menus. Focus-within keeps it reachable from the keyboard. */
.kh-scope .kh-sopmenu { opacity: 0; transition: opacity .15s ease; }
.kh-scope .kh-sopcard:hover .kh-sopmenu,
.kh-scope .kh-sopcard:focus-within .kh-sopmenu,
.kh-scope .kh-sopmenu.is-open { opacity: 1; }
.kh-scope .kh-sopmenu:hover { background: ${K.brandBg} !important; border-color: ${K.brandBorder} !important; color: ${K.brandText} !important; }
.kh-scope .kh-sopadd:hover { background: ${K.brandBg} !important; border-color: ${K.brand} !important; }
/* Coarse pointers never hover, so the menu would be unreachable on a tablet. */
@media (hover: none) {
  .kh-scope .kh-sopmenu { opacity: 1; }
}

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

/* Cards that respond to the pointer. Add .kh-lift to any card. Same
   translateY-flicker risk as .kh-sopcard (see its comment above) — dropped
   the position shift, kept shadow/border as the "lifted" cue. */
.kh-scope .kh-lift { transition: box-shadow .18s var(--ease-luxury), border-color .18s ease; }
.kh-scope .kh-lift:hover { box-shadow: ${K.shadowLift} !important; border-color: ${K.lineStrong} !important; }

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
