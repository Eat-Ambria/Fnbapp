// Ambria FnB — Kitchen Hub UI primitives
//
// Presentational only. No app state, no data fetching, no side effects — every
// component here takes props and returns markup, so it can be dropped into any
// screen without changing behaviour.
//
// Pair with utils/theme.js: colours come from `K` / `tone()`, never hardcoded.

import React from "react";
import { createPortal } from "react-dom";
import { K, type, tone } from '../utils/theme.js';
import { ripple } from '../utils/ripple.js';
import { Icon } from './Icons.jsx';

// Icons live in Icons.jsx so the app shell and the screens share one set.
// Re-exported at the bottom for existing importers.

// ── Tab strip ──────────────────────────────────────────────────────────────
// items: [{ v, l, icon }]  ·  `right` renders flush-right on the same rule.
// Tabs live inside an ivory tray; the active one is a solid deep-green pill.
// The strip does NOT position itself. Every attempt to pin it from here failed:
// a sticky card narrower than the column lets the page slide past in the
// margins beside it, and covering that needs either a filled band or a
// full-bleed bar, both of which were rejected. A host that wants the strip to
// stay put keeps it OUTSIDE its scroll box instead (see KitchenHub), so there
// is no overlap to hide.
function KTabs({ items, value, onChange, right = null }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
      background: K.tabBarBg, border: `1px solid ${K.tabBarLine}`,
      borderRadius: 16, padding: 8, boxShadow: K.shadowCard, marginBottom: 14,
    }}>
      {items.map(t => {
        const on = value === t.v;
        return (
          <button key={t.v} className={"kh-tab kh-btn kh-rip" + (on ? " is-active" : "")}
            onPointerDown={ripple} onClick={() => onChange(t.v)}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "11px 18px", borderRadius: 12, border: "none",
              background: on ? K.tabActiveBg : "transparent",
              color: on ? K.tabActiveText : K.tabIdleText,
              fontSize: 14, fontWeight: on ? 700 : 500,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
            {t.icon && <Icon name={t.icon} size={17} strokeWidth={on ? 2 : 1.7} />}
            {t.l}
          </button>
        );
      })}
      {right && <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>{right}</div>}
    </div>
  );
}

// ── Button ─────────────────────────────────────────────────────────────────
function KButton({ children, onClick, variant = "ghost", icon, size = "md", style, title, disabled, className = "" }) {
  const pad = size === "sm" ? "7px 12px" : "10px 16px";
  const fs  = size === "sm" ? 12 : 13;
  const VARIANTS = {
    accent: { background: K.accent, color: K.accentText, border: "1px solid transparent", boxShadow: K.shadowAccent },
    ghost:  { background: K.surface, color: K.textBody, border: `1px solid ${K.line}`, boxShadow: "0 1px 2px rgba(17,28,51,.04)" },
    soft:   { background: K.accentSoft, color: K.accent, border: `1px solid ${K.accentBorder}`, boxShadow: "none" },
    danger: { background: K.surface, color: K.danger, border: `1px solid ${K.dangerBorder}`, boxShadow: "none" },
    // Primary action on the brand plate — dialogs, the header band, anything
    // that belongs to the deep-green chrome rather than the blue data accent.
    brand:  { background: K.brand, color: "#FFFFFF", border: "1px solid transparent", boxShadow: "0 4px 14px rgba(28,61,43,.26)" },
    // Solid red. `danger` above is the OUTLINE treatment; this is for the one
    // destructive confirm in a dialog, which must not go pale on hover.
    dangerSolid: { background: K.danger, color: "#FFFFFF", border: "1px solid transparent", boxShadow: "0 4px 14px rgba(217,70,63,.28)" },
  };
  // Unknown variant falls back to ghost so the hover class always has a match.
  const vName = VARIANTS[variant] ? variant : "ghost";
  const v = VARIANTS[vName];
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      onPointerDown={disabled ? undefined : ripple}
      className={"kh-btn kh-rip kh-btn-" + vName + (className ? " " + className : "")}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: pad,
        borderRadius: K.rMd, fontSize: fs, fontWeight: 600, lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .55 : 1,
        whiteSpace: "nowrap", fontFamily: K.fontBody, ...v, ...style,
      }}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 15} />}
      {children}
    </button>
  );
}

// ── Panel (white card with optional header) ────────────────────────────────
function KPanel({ title, icon, right, children, bodyPad = 0, style, art = true }) {
  return (
    // backgroundColor, not the background shorthand — the shorthand resets
    // background-image and would erase the .kh-cardart artwork.
    <div className={art ? "kh-cardart" : undefined} style={{
      backgroundColor: K.surface, border: `1px solid ${K.line}`, borderRadius: K.rLg,
      boxShadow: K.shadowCard, overflow: "hidden", ...style,
    }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${K.lineSoft}`, flexWrap: "wrap" }}>
          {icon && (
            <span style={{ width: 28, height: 28, borderRadius: K.rSm, background: K.accentSoft, color: K.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={icon} size={15} strokeWidth={1.9} />
            </span>
          )}
          {title && <div style={{ ...type.cardTitle, color: K.text }}>{title}</div>}
          {right && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>{right}</div>}
        </div>
      )}
      <div style={{ padding: bodyPad }}>{children}</div>
    </div>
  );
}

// ── Stat tile ──────────────────────────────────────────────────────────────
// `large` bumps type/target sizes for the section-tablet layout.
function KStat({ icon, value, label, toneName = "idle", large = false }) {
  const t = tone(toneName);
  const box = large ? 46 : 40;
  return (
    <div className="kh-lift kh-stat kh-cardart-sm" style={{
      display: "flex", alignItems: "center", gap: 14,
      backgroundColor: K.surface, border: `1px solid ${K.line}`, borderRadius: K.rLg,
      padding: large ? "18px 20px" : "16px 18px", boxShadow: K.shadowCard, minWidth: 0,
    }}>
      <span style={{ width: box, height: box, borderRadius: K.rMd, background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={large ? 22 : 19} strokeWidth={1.9} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...type.statValue, fontSize: large ? 29 : 26, color: K.text }}>{value}</div>
        <div style={{ ...type.label, fontSize: large ? 11.5 : 11, color: K.textMuted, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      </div>
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────
function KPill({ children, toneName = "idle", icon, size = "md" }) {
  const t = tone(toneName);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: size === "sm" ? "3px 8px" : "5px 11px",
      borderRadius: K.rPill, background: t.bg, color: t.fg,
      border: `1px solid ${t.border}`,
      fontSize: size === "sm" ? 10.5 : 11.5, fontWeight: 600, whiteSpace: "nowrap", lineHeight: 1.4,
    }}>
      {icon && <Icon name={icon} size={size === "sm" ? 11 : 12} strokeWidth={2} />}
      {children}
    </span>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────
function KProgress({ pct = 0, toneName = "accent", h = 6, track }) {
  const t = tone(toneName);
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div style={{ height: h, background: track || K.lineSoft, borderRadius: h / 2, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: v + "%", background: t.fg, borderRadius: h / 2, transition: "width .4s cubic-bezier(.23,1,.32,1)" }} />
    </div>
  );
}

// ── Banner (context notices / warnings) ────────────────────────────────────
// `compact` puts title and sub on one line with tighter padding — for standing
// status notices that shouldn't take a whole block of vertical space.
function KBanner({ toneName = "warn", icon = "alert", title, sub, right, onClick, onDismiss, compact = false, style }) {
  const t = tone(toneName);
  return (
    // The tint fades out to the right. As a flat slab a compact banner on a wide
    // screen was a metre of colour with a few words stranded at one end; the
    // gradient gives it a direction and keeps the weight where the text is.
    <div onClick={onClick} className={onClick ? "kh-lift" : undefined} style={{
      position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", gap: compact ? 11 : 12,
      background: `linear-gradient(90deg, ${t.bg} 0%, ${t.bg} 34%, ${K.surface} 100%)`,
      border: `1px solid ${t.border}`, borderRadius: compact ? K.rMd : K.rLg,
      padding: compact ? "9px 13px 9px 15px" : "14px 16px 14px 18px",
      cursor: onClick ? "pointer" : "default", ...style,
    }}>
      {/* Tone rail — the same device as the mapping rows, so a status strip
          reads the same wherever it appears. */}
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: t.fg }}/>
      <span style={{ width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius: compact ? 8 : K.rSm, background: K.surface, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${t.border}` }}>
        <Icon name={icon} size={compact ? 14 : 17} strokeWidth={1.9} />
      </span>
      <div style={compact
        ? { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }
        : { flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: compact ? 12.5 : 13, fontWeight: 700, color: t.fg, lineHeight: 1.4 }}>{title}</div>}
        {/* Hairline divider only in the one-line layout, where title and sub
            otherwise run together as a single sentence. */}
        {compact && title && sub && <span style={{ width: 1, height: 12, background: t.border, flexShrink: 0 }}/>}
        {sub && <div style={{ fontSize: 12, color: K.textBody, marginTop: compact ? 0 : 2, lineHeight: 1.45 }}>{sub}</div>}
      </div>
      {right && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>{right}</div>}
      {onClick && !right && !onDismiss && <Icon name="chevronR" size={16} color={t.fg} />}
      {onDismiss && (
        <button type="button" className="kh-ingcheck" aria-label="Dismiss"
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          style={{
            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            width: compact ? 24 : 28, height: compact ? 24 : 28, borderRadius: 7,
            background: "transparent", border: "1px solid transparent",
            color: t.fg, cursor: "pointer", padding: 0, marginLeft: 2,
          }}>
          <Icon name="close" size={compact ? 14 : 16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// ── Context bar (the "Event Day — <date>" band) ────────────────────────────
function KContextBar({ icon = "calendar", toneName = "accent", title, meta, right, large = false, style }) {
  const t = tone(toneName);
  const box = large ? 48 : 42;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      background: K.surface, border: `1px solid ${K.line}`, borderRadius: K.rLg,
      padding: large ? "18px 22px" : "16px 20px", boxShadow: K.shadowCard, ...style,
    }}>
      <span style={{ width: box, height: box, borderRadius: K.rMd, background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={large ? 23 : 20} strokeWidth={1.9} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: large ? 19 : 16, fontWeight: 700, color: K.text, letterSpacing: -.1 }}>{title}</div>
        {meta && <div style={{ fontSize: large ? 14 : 12.5, color: K.textMuted, marginTop: 3, lineHeight: 1.5 }}>{meta}</div>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

// ── Confirm / notice modal ─────────────────────────────────────────────────
// Replaces window.confirm/alert so destructive actions get the app's own
// framing. Portalled to <body>: rendered in place it would be trapped by the
// stacking contexts the topbar and sidebar create.
// `body` may be a string with newlines, or JSX.
// Faint brand watermark inside the dialog — the chef's toque bottom-left and a
// couple of leaves top-right, echoing the page artwork. Painted at very low
// opacity BEHIND the content (never a backdrop-filter: the dialog stays opaque
// so nothing behind it can wash the text out).
function ModalWatermark() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden",
      pointerEvents: "none", zIndex: 0 }}>
      {/* Toque, bottom-left. Reuses the shared chefHat glyph rather than a
          bespoke path so it stays consistent if the icon set is redrawn. */}
      <span style={{ position: "absolute", left: -14, bottom: -26, color: K.sbGold, opacity: .12 }}>
        <Icon name="chefHat" size={168} strokeWidth={0.85} />
      </span>
      {/* Two leaf blades, top-right. */}
      <svg viewBox="0 0 120 120" width="190" height="190" fill={K.brand}
        style={{ position: "absolute", right: -34, top: -46, opacity: .06 }}>
        <path d="M118 4C78 8 48 30 38 60c-5 14-2 27 7 33 12 8 30 1 42-16C99 60 110 34 118 4z" />
        <path d="M62 74c-27 2-47 17-54 37-3 9 0 17 6 20 9 4 21-2 29-15 8-12 15-26 19-42z" />
      </svg>
    </div>
  );
}

// iconTone lets a modal keep a red confirm button while the header chip stays
// on-brand — a picker is a normal choice, only the final action is destructive.
// `subhead` renders between the title and the body (the picker uses it for the
// "n selected" label + day chip row).
function KModal({ open, toneName = "danger", icon = "alert", iconTone, title, subhead, body,
                  confirmLabel, confirmIcon, cancelLabel = "Cancel",
                  onConfirm, confirmDisabled, onClose, width = 500 }) {
  const t = tone(iconTone || toneName);
  React.useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Enter" && onConfirm && !confirmDisabled) onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onConfirm, confirmDisabled, onClose]);
  if (!open) return null;

  const isDanger = onConfirm && toneName === "danger";

  return createPortal(
    <div onClick={onClose} role="presentation" className="kh-modal-scrim"
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: K.modalScrim,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()} className="kh-modal-card"
        style={{ position: "relative", background: K.modalBg, border: `1px solid ${K.modalLine}`,
          borderRadius: K.modalRadius, boxShadow: K.shadowLift,
          maxWidth: width, width: "100%", overflow: "hidden" }}>

        <ModalWatermark />

        {/* Everything above the watermark. */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <button type="button" onClick={onClose} onPointerDown={ripple} aria-label={cancelLabel} className="kh-modal-x kh-rip"
            style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: K.rPill,
              background: K.surface, border: `1px solid ${K.modalLine}`, color: K.textMuted,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <Icon name="close" size={16} strokeWidth={2.1} />
          </button>

          <div style={{ display: "flex", gap: 16, padding: "26px 28px 0" }}>
            <span style={{ width: 52, height: 52, borderRadius: 17, flexShrink: 0, background: t.bg, color: t.fg,
              border: `1px solid ${t.border}`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={icon} size={25} strokeWidth={1.85} />
            </span>
            {/* paddingRight clears the close button so a long title cannot slide under it. */}
            <div style={{ minWidth: 0, flex: 1, paddingRight: 34 }}>
              <div style={{ ...type.sectionHead, fontSize: 23, color: K.hdrTitle }}>{title}</div>
              {subhead && <div style={{ marginTop: 7 }}>{subhead}</div>}
            </div>
          </div>

          {body && (
            <div style={{ padding: "16px 28px 0", fontSize: 13.5, color: K.textBody,
              lineHeight: 1.6, whiteSpace: "pre-line" }}>
              {body}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "20px 28px 24px" }}>
            {onConfirm && (
              <KButton variant="ghost" onClick={onClose}
                style={{ padding: "11px 22px", borderRadius: 14 }}>{cancelLabel}</KButton>
            )}
            {/* Brand green, not the blue data accent — a dialog is part of the
                brand plate. Only a destructive confirm goes red. */}
            <KButton
              variant={isDanger ? "dangerSolid" : "brand"}
              icon={confirmIcon}
              disabled={!!confirmDisabled}
              onClick={confirmDisabled ? undefined : (onConfirm || onClose)}
              style={{ padding: "11px 22px", borderRadius: 14 }}>
              {confirmLabel || "OK"}
            </KButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
// For results, not questions. A dialog that only offers "Done" interrupts the
// screen and demands a click to say something the user already knows happened;
// a toast reports it and gets out of the way. Anything that asks a question
// stays a KModal.
//
// Portalled for the same reason KModal is: rendered in place it would be
// trapped by the sidebar/topbar stacking contexts.
function KToast({ open, toneName = "ok", icon, title, body, onClose, duration }) {
  const t = tone(toneName);

  // onClose is almost always an inline arrow, so it is a NEW function on every
  // render of the parent. Depending on it directly meant the effect re-ran, the
  // cleanup cleared the pending timer and a fresh one started — and because
  // this screen re-renders every second to drive the step timers, the toast
  // never survived long enough to dismiss itself. Hold it in a ref instead and
  // key the timer on the message, so it restarts for a new toast and only then.
  const closeRef = React.useRef(onClose);
  React.useEffect(() => { closeRef.current = onClose; }, [onClose]);

  const key = open ? String(title || "") + "|" + String(body || "") : "";
  React.useEffect(() => {
    if (!open) return;
    // Errors stay longer — they are usually worth reading twice.
    const ms = duration || (toneName === "danger" ? 7000 : 4500);
    const id = setTimeout(() => closeRef.current?.(), ms);
    return () => clearTimeout(id);
  }, [open, key, toneName, duration]);

  if (!open) return null;

  return createPortal(
    <div className="kh-toast-wrap" role="status" aria-live="polite">
      <div className="kh-toast" style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        background: K.surface, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.fg}`,
        borderRadius: 14, boxShadow: K.shadowLift, padding: "13px 14px 13px 15px",
        maxWidth: 420, minWidth: 280, pointerEvents: "auto",
      }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: t.bg, color: t.fg,
          border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon || (toneName === "danger" ? "alert" : toneName === "warn" ? "alert" : "check")} size={16} strokeWidth={2.2} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {title && <div style={{ fontSize: 13.5, fontWeight: 700, color: K.hdrTitle, lineHeight: 1.35 }}>{title}</div>}
          {body && <div style={{ fontSize: 12.5, color: K.hdrMeta, marginTop: 2, lineHeight: 1.5, whiteSpace: "pre-line" }}>{body}</div>}
        </div>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="kh-modal-x"
          style={{ width: 24, height: 24, borderRadius: K.rPill, flexShrink: 0, background: "transparent",
            border: "1px solid transparent", color: K.textFaint, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", padding: 0 }}>
          <Icon name="close" size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Table column head (pairs with the .kh-strow grid in theme.js) ─────────
function KColHead({ children, align = "left", className }) {
  return (
    <div className={className} style={{
      ...type.label, color: K.textFaint, textAlign: align,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    }}>{children}</div>
  );
}

// Components only — keeps React Fast Refresh working for this file.
// Import tokens straight from '../utils/theme.js' (K, tone).
export { Icon, KTabs, KButton, KPanel, KStat, KPill, KProgress, KBanner, KContextBar, KColHead, KModal, KToast };
