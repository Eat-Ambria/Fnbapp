// Ambria FnB — click ripple
//
// One shared handler for every tappable block (buttons, nav items, tabs, list
// rows, cards). Attach it as an onPointerDown/onClick alongside whatever the
// element already does; it never calls preventDefault or stopPropagation, so
// existing handlers are untouched.
//
//   import { ripple } from '../utils/ripple.js';
//   <button className="kh-rip" onPointerDown={ripple} onClick={…}>
//
// The `kh-rip` class is REQUIRED — it supplies `position:relative` and
// `overflow:hidden`, without which the ink escapes the element's bounds.
// Do not put it on anything that has to overflow (a row with a dropdown, a
// card with a floating badge): it would clip.
//
// The ink is painted in `currentColor`, so a dark-text row ripples dark and a
// white-on-green pill ripples white — no per-call colour wiring.

const MAX_INK = 520;   // px radius cap; a full-width row otherwise ripples for ages

function ripple(e) {
  const el = e?.currentTarget;
  if (!el || el.disabled || el.getAttribute?.("aria-disabled") === "true") return;
  if (typeof window === "undefined") return;

  // Respect the OS setting — this is decorative motion, same rule as the
  // dialog entrance and the segment fill-up. Optional chaining covers old
  // webviews where matchMedia is missing.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;

  // Keyboard activation reports clientX/Y of 0 (and detail 0). Centre the ink
  // in that case rather than firing it from the top-left corner.
  const viaKeyboard = e.detail === 0 || (!e.clientX && !e.clientY);
  const cx = viaKeyboard ? r.left + r.width / 2 : e.clientX;
  const cy = viaKeyboard ? r.top + r.height / 2 : e.clientY;

  // Radius that reaches the furthest corner, so the ink always covers the box.
  const rad = Math.min(MAX_INK, Math.max(
    Math.hypot(cx - r.left,  cy - r.top),
    Math.hypot(r.right - cx, cy - r.top),
    Math.hypot(cx - r.left,  r.bottom - cy),
    Math.hypot(r.right - cx, r.bottom - cy),
  ));

  const ink = document.createElement("span");
  ink.className = "kh-rip-ink";
  ink.style.width = ink.style.height = rad * 2 + "px";
  ink.style.left = (cx - r.left - rad) + "px";
  ink.style.top  = (cy - r.top  - rad) + "px";

  // Rapid taps must not stack up unbounded — keep at most two in flight.
  const live = el.getElementsByClassName("kh-rip-ink");
  while (live.length > 1) live[0].remove();

  el.appendChild(ink);
  ink.addEventListener("animationend", () => ink.remove(), { once: true });
  // animationend never fires if the element is hidden mid-animation; this is
  // the safety net so the span cannot leak into the DOM.
  setTimeout(() => ink.remove(), 900);
}

export { ripple };
