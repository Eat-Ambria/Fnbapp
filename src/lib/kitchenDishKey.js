import { getCatIdForDish, isFruitSelectionDish } from '../data/recipeData.js';
import { pinnedDeptForDish } from '../data/salesConfig.js';

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
