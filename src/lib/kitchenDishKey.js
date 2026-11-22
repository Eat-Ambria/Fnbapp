import { getCatIdForDish, isFruitSelectionDish } from '../data/recipeData.js';
import { pinnedDeptForDish } from '../data/salesConfig.js';
import { mergeDishState, DISH_STEP_MAPS } from '../utils/helpers.js';
import { MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';
import { resolveDeptForOverrideTarget } from './sectionDept.js';

// Ambria FnB — the one place that knows kitchen_tracking's per-dish key shape.
//
// Every live WRITE to a dish's kitchen_tracking row uses this exact shape
// (EventDayTab.jsx's and KitchenHub.jsx's own dk(), both evId+"|"+dishName)
// once a dish name is known — which it always is on every live write path:
// every dish object built for the UI (EventDayTab.jsx's byDish/bySec,
// KitchenHub.jsx's equivalents) carries its own .name, and setDs() keys by
// that name whenever dishInfo.name is present. Several READERS across
// Dashboard.jsx and DeptView.jsx independently reinvented this lookup and
// got it wrong in different ways: an index-based "evId|idx" legacy shape
// nothing writes any more, a completely invented "d_<idx>" shape nothing
// ever wrote, and/or an index computed against an already-FILTERED dish
// array (Beverages/Fruits dropped) instead of the real per-dish identity —
// all of them silently stuck reading "nothing is ever ready" regardless of
// real kitchen progress. This is now the only implementation of the lookup;
// EventDayTab.jsx/KitchenHub.jsx's own dk() delegates here too so there is
// nothing left for a future change to accidentally re-diverge from.
export function kitchenDishKey(evId, dishName) {
  return evId + '|' + dishName;
}

// A dish's kitchen_tracking row, or {} if none exists yet — never throws on
// a missing event/dish/null kt.
export function kitchenDishState(kt, evId, dishName) {
  return (kt && kt[evId] && kt[evId][kitchenDishKey(evId, dishName)]) || {};
}

export function isKitchenDishReady(kt, evId, dishName) {
  return !!kitchenDishState(kt, evId, dishName).ready;
}

// `ev.menu` (array or JSON-string), with a third-party caterer's whole menu,
// outsourced dishes, and non-kitchen-pinned dishes (ice cream/tea/coffee →
// bev, see pinnedDeptForDish) dropped — exactly EventDayTab.jsx's own
// original `menuArr`, moved here so EventDayTab.jsx's `menuArr` can delegate
// to it instead of keeping its own copy. Deliberately does NOT also drop
// dishes isExcludedFromKitchenTracking() (below) would exclude —
// EventDayTab.jsx's `byDish` loop applies that filter itself, AFTER
// indexing this array (its `idx` feeds a legacy per-position
// kitchen_tracking fallback for rows written before the name-keyed `dk()`
// existed — see `ds()` — so the two filters must stay in this exact order
// and NOT be pre-merged, or an old legacy row could resolve to the wrong
// dish once an excluded dish ahead of it in the menu disappears from the
// array and shifts every later index down). Use kitchenTrackableDishes()
// below for anything that isn't EventDayTab.jsx itself.
export function kitchenMenuArr(ev) {
  if (!ev || ev.external_caterer) return [];
  const m = ev.menu;
  let arr;
  if (Array.isArray(m)) arr = m;
  else if (typeof m === 'string' && m) { try { arr = JSON.parse(m); } catch (e) { arr = []; } }
  else arr = [];
  const out = ev.outsourced_dishes;
  if (Array.isArray(out) && out.length > 0) {
    const skip = new Set(out);
    arr = arr.filter(n => !skip.has(n));
  }
  arr = arr.filter(n => !pinnedDeptForDish(n));
  return arr;
}

// Is `name` a dish Kitchen never tracks on `ev` — the one correct condition
// every "which dishes does Kitchen cook/sign off" reader should gate on.
//
// A dish has TWO independent classifications that can disagree: its real
// DEPARTMENT (kit/bev/frt/..., resolved via the precedence chain in
// src/lib/eventItems.js's resolveDeptForDish/buildEventDeptContext — the
// mechanism DeptView.jsx's Beverages/Fruits Ops screens actually use), and
// its SOP/RECIPE category (RECIPE_DB.cats, via getCatIdForDish/
// getSectionForDish — which SOP binder its cooking instructions live
// under, nothing to do with which department serves it). A dish can be
// dept-routed to 'kit' while its SOP category happens to be "beverages"
// (a kitchen-prepared drink base, or just a mis-filed SOP tag) — checking
// the SOP category here instead of the real department wrongly excludes
// such a dish from Kitchen, and since it's genuinely NOT a bev-dept dish,
// Beverages Ops (correctly, via the real department) doesn't show it
// either: the dish vanishes from every screen, with nothing to explain why.
//
// `syncAllKitchenMenuMirrors` (eventItems.js) writes `events.menu`
// pre-filtered by the REAL department (dropping bev/frt) once an event's
// Items tab has ever been opened (`event_items_initialized`) — but caught
// by adversarial review: that is NOT a reliable invariant to trust blindly.
// Several paths set `event_items_initialized:true` while leaving
// `events.menu` as the raw, every-department package list a while longer
// (a "Quick start from package"/package-switch write that hasn't been
// re-mirrored yet; an event whose real kit-dept menu happens to be empty,
// where the UI's own package-list fallback — see App.jsx — keeps re-
// appearing in `ev.menu` even though the mirror sync keeps trying to
// write `[]`). Blindly trusting `event_items_initialized` in those states
// would let a genuine bev/frt dish leak into Kitchen tracking — trading
// the original bug for a real regression in the other direction.
//
// So this ALWAYS tries to resolve the dish's REAL department first,
// synchronously, from data that's already in memory (no async fetch): a
// name-pinned dept (ice cream/tea/coffee → bev), the package's own
// section/subsection `sales_dept` for this dish, and a per-event
// placement-tag override. This mirrors resolveDeptForDish's own precedence
// (eventItems.js, and the equivalent in useMenuItemGrouping.js/
// sectionDept.js) MINUS the two layers that genuinely need an async fetch
// (a catalogue section's own `sales_dept`, and `sales_items_meta`) — not
// available to a pure function given only a dish name and an event object.
// Only when NONE of these synchronous signals say anything (truly no
// information either way) does it fall back to: trust the mirror if this
// event is initialized, else fall back to the legacy SOP-category
// heuristic as a last resort.
//
// PRECEDENCE MATTERS, caught by adversarial review: a per-event override is
// checked BEFORE the package's own placement, matching resolveDeptForDish
// exactly — an override exists specifically to OVERRIDE the package's
// default placement, so checking the package first (as an earlier version
// of this function did) could (a) wrongly exclude a dish a staff member
// deliberately re-tagged OUT of a bev/frt package section and into kit —
// the exact "vanishes from every screen" bug this whole fix exists to
// close, just reached a different way — or (b) wrongly KEEP a dish
// deliberately re-tagged INTO bev/frt from a kit package section, since
// the package lookup would already have returned before the override was
// ever consulted.
// Returns a TRI-STATE, not a boolean: `true` (definitely bev/frt, exclude),
// `false` (definitely kit or another non-bev/frt dept, keep), or `null`
// ("no synchronous signal either way" — the caller must fall back to the
// mirror/SOP-category heuristic, NOT treat this as "keep"). Caught by a
// THIRD adversarial review round: an earlier boolean-returning version
// conflated "definitively resolved to kit" with "no signal at all" (both
// `false`), so isExcludedFromKitchenTracking's own fallback chain could
// still run the legacy SOP-category heuristic on top of an ALREADY
// definitive "kit" answer on an uninitialized event — e.g. a dish placed in
// a sales_dept:'kit' package section (or override) whose RECIPE_DB SOP
// category happens to be "beverages" would be wrongly excluded by that
// heuristic, exactly the double-filing bug this whole fix exists to close,
// just reached via the fallback path instead of the mirror-trusting one.
function realDeptExcludesDish(name, ev) {
  if (pinnedDeptForDish(name)) return true; // always resolves to 'bev' today — any pin is non-kit
  if (!ev) return null;
  const pkgName = ev.menuPackage || ev.menu_package;
  const pkgSecs = pkgName ? (MENU_PACKAGE_SECTIONS[pkgName] || []) : [];
  const overrides = ev.menu_section_overrides || {};
  const targetId = overrides[name];
  if (targetId) {
    const dept = resolveDeptForOverrideTarget(targetId, pkgSecs, null);
    // A target that resolves to nothing synchronously (most often a real
    // catalogue section id, which needs an async fetch this pure function
    // doesn't have) is genuinely ambiguous — treated as "no signal from
    // this override", NOT as "fall back to the package's own placement
    // instead". An override exists to override the package placement, so
    // silently falling back to the package's dept here could get this
    // exactly backwards for a dish deliberately re-tagged away from it.
    if (dept) return dept === 'bev' || dept === 'frt';
  }
  // Last match wins when the same dish name is (incorrectly) listed in more
  // than one section/subsection — matches buildEventDeptContext's own
  // forEach-overwrite precedence (eventItems.js), not "first match wins".
  // Entries are defensively guarded (`sec &&`/`sub &&`) the same way
  // resolveDeptForOverrideTarget guards its own array scan, even though
  // MENU_PACKAGE_SECTIONS is static in-memory data that shouldn't normally
  // contain a falsy entry.
  let lastMatch = null;
  for (let i = 0; i < pkgSecs.length; i++) {
    const sec = pkgSecs[i];
    if (!sec) continue;
    const secDept = sec.sales_dept || 'kit';
    if ((sec.dishes || []).indexOf(name) !== -1) lastMatch = secDept;
    const subs = sec.subsections || [];
    for (let j = 0; j < subs.length; j++) {
      const sub = subs[j];
      if (!sub) continue;
      if ((sub.dishes || []).indexOf(name) !== -1) lastMatch = sub.sales_dept || secDept;
    }
  }
  if (lastMatch) return lastMatch === 'bev' || lastMatch === 'frt';
  return null; // no synchronous signal either way
}

// isFruitSelectionDish (a "pick N of these fruits" counter placeholder,
// detected by NAME PATTERN, not any category/department tag) is excluded
// unconditionally — it was never meant to reach Kitchen at all.
export function isExcludedFromKitchenTracking(name, ev) {
  if (isFruitSelectionDish(name)) return true;
  const realDept = realDeptExcludesDish(name, ev);
  if (realDept !== null) return realDept; // definitive true/false — never fall through past a real answer
  if (ev && ev.event_items_initialized) return false;
  return getCatIdForDish(name) === 'beverages';
}

// The dishes of `ev` that Kitchen's own "Final Cooking" sign-off screen
// (EventDayTab.jsx's menuArr + its byDish loop's own exclusion check) can
// EVER mark `ready` — the one correct denominator for every "how many
// dishes are ready" reader OUTSIDE EventDayTab.jsx itself (EventDayTab.jsx
// keeps applying this same exclusion check inline, see kitchenMenuArr's own
// comment on why it can't be pre-merged there).
//
// Found 2026-11-22 via adversarial review: every "ready" reader before this
// used its own simpler Beverages-only or Beverages+Fruits-only filter, so
// an event with an outsourced dish, an ice-cream/tea/coffee dish, or an
// external caterer could never reach "all ready" no matter how much the
// kitchen had actually finished — the fixed key-shape readers (above) were
// correct but still counted against the wrong total.
export function kitchenTrackableDishes(ev) {
  return kitchenMenuArr(ev).filter(n => !isExcludedFromKitchenTracking(n, ev));
}

// Rebuilds `freshEntry` (the fresh fold of whatever CURRENTLY survives for a
// dish) against `oldEntry` (what the combined bucket had before), writing an
// explicit `null` for every field `oldEntry` had that `freshEntry` doesn't —
// both top-level and inside each per-step map (DISH_STEP_MAPS, same list
// mergeDishState itself merges one level deep). An explicit null, not an
// omitted key, is what lets diffDishState (and the kt_set_paths patch it
// feeds) actually detect and clear a stale field through the ordinary sync
// effect — simply omitting a key from the next value never gets diffed or
// uploaded at all (helpers.js's diffDishState only ever iterates `next`'s
// own keys).
function tombstoneAgainst(oldEntry, freshEntry) {
  const result = Object.assign({}, freshEntry);
  const oe = oldEntry || {};
  Object.keys(oe).forEach(function (k) {
    if (k === 'mesaDone') return; // handled by the caller, never tombstoned here
    if (DISH_STEP_MAPS.indexOf(k) !== -1) {
      const oldMap = (oe[k] && typeof oe[k] === 'object') ? oe[k] : {};
      const freshMap = (result[k] && typeof result[k] === 'object') ? result[k] : {};
      const mergedMap = Object.assign({}, freshMap);
      Object.keys(oldMap).forEach(function (sk) { if (!(sk in freshMap)) mergedMap[sk] = null; });
      if (Object.keys(mergedMap).length > 0) result[k] = mergedMap;
    } else if (!(k in result)) {
      result[k] = null;
    }
  });
  return result;
}

// Resetting one (but not all) of a day's functions deletes that function's
// own kitchen_tracking row, but the shared "__combined_<day>" bucket is
// deliberately left alone (wiping it on a PARTIAL reset would also erase the
// OTHER, non-reset functions' combined progress — see runReset in
// KitchenHub.jsx). The problem: setDs() mirrors every write into BOTH the
// writing function's own row AND the combined bucket's per-dish-NAME entry
// via mergeDishState (a deep, additive merge, never a replace) — so once a
// function is reset, the combined bucket keeps showing whatever that
// function had contributed before, forever, with no way to tell which
// fields came from the now-gone function and which came from a still-live
// one (a merge has no provenance). Combined view's own read (EventDayTab.jsx
// ds()) only ever folds CONTRIBUTING functions' rows ON TOP of the combined
// row — it never subtracts a function that's gone, so the stale data just
// sits there being folded with an empty {} forever.
//
// Finds which dish names a reset event's EXISTING row names, BEFORE that
// row gets deleted — call this first, synchronously, from the state update
// that's about to delete resetEvIds' own rows (runReset's first
// setKitchenTracking call). Deliberately never looks at an event's
// .menu/menuArr: a dish renamed, removed, or reclassified (pinned dept,
// outsourced, Prep Day vs. Final Cooking's own separate dish-filtering)
// since it was last tracked could otherwise make this miss or wrongly
// include a dish — it only asks "what did this event's OWN row actually
// have". A legacy index-keyed row ("evId|<n>", from before dishes were
// tracked by name) is skipped rather than guessed at, for the same reason —
// it's already rare and low-impact (see MEMORY.md).
export function dishesTrackedByEvents(kt, evIds) {
  const names = {};
  (evIds || []).forEach(function (evId) {
    const evRow = (kt && kt[evId]) || {};
    const prefix = evId + '|';
    Object.keys(evRow).forEach(function (k) {
      if (k.indexOf(prefix) !== 0) return;
      const rest = k.slice(prefix.length);
      if (!rest || /^\d+$/.test(rest)) return; // legacy index-keyed row — no dish name to resolve it to here, skip
      names[rest] = true;
    });
  });
  return Object.keys(names);
}

// Rebuilds the combined bucket's entries for exactly `touchedNames` (from
// dishesTrackedByEvents, called EARLIER against the reset events' own rows
// — before they were deleted), using whatever the surviving functions
// CURRENTLY have. `kt` here should be the LATEST state, read AFTER the
// reset events' rows are actually confirmed deleted — calling this against
// a snapshot taken before that confirmation, then writing its `row` back
// wholesale, would silently revert anything that changed in the meantime
// (another tablet's realtime echo, a local tap on an untouched dish, a
// survivor starting a touched dish) — caught by adversarial review
// 2026-11-22; see runReset in KitchenHub.jsx for the two-phase call
// sequence this is built for. `nextRow` starts from a COPY of the CURRENT
// combined row (not just its non-dish keys), so anything not in
// `touchedNames` — including anything that arrived after `touchedNames`
// was computed — survives completely untouched by construction.
//
// Returns the combined bucket's REPLACEMENT row (write this back as
// kt[combinedId]) plus `orphanKeys` — "dish|<name>" keys that no longer
// belong in the bucket at all (nothing survives to show for them) and must
// also be deleted server-side, since the ordinary sync effect only ever
// uploads keys present in the new state, never a key's disappearance.
export function combinedBucketAfterPartialReset(kt, combinedId, touchedNames, survivingEvIds) {
  const oldRow = (kt && kt[combinedId]) || {};
  const nextRow = Object.assign({}, oldRow);

  const orphanKeys = [];
  (touchedNames || []).forEach(function (name) {
    const combKey = 'dish|' + name;
    const oldEntry = oldRow[combKey];
    // Nothing to correct if the combined bucket has no entry for this dish
    // right now — manufacturing a brand-new entry here (purely from a
    // surviving function's data) would be worse than leaving it absent: a
    // reset function's OWN per-event view falls back to the combined entry
    // whenever its own row is empty, so creating one out of thin air would
    // make the just-reset function's view show a DIFFERENT function's
    // progress, which it never did before this fix existed. Caught by
    // adversarial review 2026-11-22.
    if (!oldEntry) return;
    let folded = {};
    (survivingEvIds || []).forEach(function (evId) {
      const row = kt && kt[evId] && kt[evId][evId + '|' + name];
      if (row && Object.keys(row).length > 0) folded = mergeDishState(folded, row);
    });
    delete folded.mesaDone; // mesaDone never mirrors to/from a per-event row — see setDs's own comments
    const hasRealFoldedData = Object.keys(folded).length > 0;
    // mesaDone is preserved ONLY alongside real surviving per-event data for
    // this dish, never on its own. mesaDone has no per-event echo at all
    // (see above), so it's the one field with no way to tell "a survivor
    // still legitimately has this dish" from "nobody does any more" except
    // by checking whether anyone has real, fresh per-event data for it —
    // if nobody does, the whole dish (mesaDone included) is orphaned, not
    // kept alive by a stale whole-day marker alone. Caught by adversarial
    // review 2026-11-22: the original version kept a combined-only mesaDone
    // forever even after the one function that ever had this dish was reset.
    if (!hasRealFoldedData) { orphanKeys.push(combKey); delete nextRow[combKey]; return; }
    if (oldEntry.mesaDone !== undefined) folded.mesaDone = oldEntry.mesaDone;
    nextRow[combKey] = tombstoneAgainst(oldEntry, folded);
  });

  return { row: nextRow, orphanKeys: orphanKeys };
}
