import { getCatIdForDish, isFruitSelectionDish } from '../data/recipeData.js';
import { pinnedDeptForDish } from '../data/salesConfig.js';
import { mergeDishState, DISH_STEP_MAPS } from '../utils/helpers.js';

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
// Beverages-category/fruit-selection dishes — EventDayTab.jsx's `byDish`
// loop applies that filter itself, AFTER indexing this array (its `idx`
// feeds a legacy per-position kitchen_tracking fallback for rows written
// before the name-keyed `dk()` existed — see `ds()` — so the two filters
// must stay in this exact order and NOT be pre-merged, or an old legacy row
// could resolve to the wrong dish once a Beverages/fruit dish ahead of it in
// the menu disappears from the array and shifts every later index down).
// Use kitchenTrackableDishes() below for anything that isn't EventDayTab.jsx
// itself.
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

// The dishes of `ev` that Kitchen's own "Final Cooking" sign-off screen
// (EventDayTab.jsx's menuArr + its byDish loop's own Beverages/fruit-
// selection filter) can EVER mark `ready` — the one correct denominator for
// every "how many dishes are ready" reader OUTSIDE EventDayTab.jsx itself
// (EventDayTab.jsx keeps applying this same beverages/fruit filter inline,
// see kitchenMenuArr's own comment on why it can't be pre-merged there).
//
// Found 2026-11-22 via adversarial review: every "ready" reader before this
// used its own simpler Beverages-only or Beverages+Fruits-only filter, so
// an event with an outsourced dish, an ice-cream/tea/coffee dish, or an
// external caterer could never reach "all ready" no matter how much the
// kitchen had actually finished — the fixed key-shape readers (above) were
// correct but still counted against the wrong total.
export function kitchenTrackableDishes(ev) {
  return kitchenMenuArr(ev).filter(n => getCatIdForDish(n) !== 'beverages' && !isFruitSelectionDish(n));
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
