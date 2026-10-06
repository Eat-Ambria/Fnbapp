// Ambria FnB — shared menu-item mutation ops, used by both MenuBuilderView.jsx
// (Proposals, writes proposal_items/proposals) and EventMenuBuilderView.jsx
// (Booked Functions, writes event_items/events). Each op computes the next
// state and performs exactly one DB write; it never touches React state
// directly — callers pass their own setter as `onOptimistic`.
//
// This module owns none of the FP-lock gating or kitchen-mirror sync that
// EventMenuBuilderView.jsx wraps around these — that stays there (it depends
// on Event-local dept-resolution state with no Proposal-side equivalent, and
// src/lib/eventItems.js already maintains a second, hand-kept-in-sync copy of
// that same precedence for KitchenHub.jsx/MenuPackagesView.jsx/App-boot; a
// third partial copy in here would only make that worse). Callers check
// blockIfMenuLocked() and call mirrorKitchenMenu(...) themselves, around
// these ops, not inside them.
//
// `config` identifies the two tables a caller's mutations touch — the item
// rows themselves, and the parent row that holds menu_section_overrides /
// the "already seeded" flag:
//   { itemsTable, itemsFk, itemsFkValue, parentTable, parentIdValue, initializedColumn }
// e.g. for Proposals: { itemsTable:'proposal_items', itemsFk:'proposal_id', itemsFkValue:proposal.id,
//                        parentTable:'proposals', parentIdValue:proposal.id, initializedColumn:'menu_initialized' }
//
// Each op preserves its own handler's existing optimistic-vs-not timing and
// throw-vs-swallow error policy exactly as both files had it before this
// module existed — see the per-function notes below before changing either.

import { supabase } from './supabase.js';

// OPTIMISTIC (state applied before the DB call resolves) — matches both
// files' existing toggleDish. Throws on DB error; caller catches, refetches
// via its own loadItems(), and shows its own message.
export async function toggleDishItem(config, dishItems, dishName, isTemplate, onOptimistic) {
  var isSelected = dishItems.some(function(x){ return x.dish_name === dishName; });
  if (isSelected) {
    var nextItems = dishItems.filter(function(x){ return x.dish_name !== dishName; });
    onOptimistic(nextItems);
    var del = await supabase.from(config.itemsTable).delete()
      .eq(config.itemsFk, config.itemsFkValue).eq('dish_name', dishName);
    if (del.error) throw del.error;
    return { action: 'removed', nextItems: nextItems };
  }
  var row = {};
  row[config.itemsFk] = config.itemsFkValue;
  row.dish_name = dishName;
  row.is_addon = !isTemplate;
  row.ordering = dishItems.length;
  var optimisticNext = dishItems.concat([row]);
  onOptimistic(optimisticNext);
  var ins = await supabase.from(config.itemsTable).insert(row).select().single();
  if (ins.error) throw ins.error;
  var finalItems = optimisticNext.map(function(x){ return x.dish_name === dishName ? ins.data : x; });
  onOptimistic(finalItems);
  return { action: 'added', nextItems: finalItems };
}

// NON-optimistic (insert succeeds first, onOptimistic called once after) —
// matches both files' existing addCustomDish/addExistingDish, which are
// otherwise identical bodies collapsed to this one op; each caller keeps its
// own 2-line prefix (createCustomDishInLibrary + bumping its dish-library
// re-read counter) before calling this. Throws on error — neither file
// catches around its add call today, so this doesn't either.
export async function addDishItem(config, dishItems, dishName, onOptimistic) {
  var row = {};
  row[config.itemsFk] = config.itemsFkValue;
  row.dish_name = dishName;
  row.is_addon = true;
  row.ordering = dishItems.length;
  var ins = await supabase.from(config.itemsTable).insert(row).select().single();
  if (ins.error) throw ins.error;
  var nextItems = dishItems.concat([ins.data]);
  onOptimistic(nextItems);
  return { nextItems: nextItems, row: ins.data };
}

// NON-optimistic bulk add of whatever template dishes aren't already
// selected; also marks config.initializedColumn = true on the parent row.
// Throws on error. Returns { added: [...] } — an empty array means "nothing
// to add", which the caller turns into its OWN existing message (copy and
// mechanism differ per file today — a styled toast vs. a bare alert, with
// different wording — preserved here, not merged).
export async function loadPackageDefaultItems(config, dishItems, templateDishes, onOptimistic) {
  var have = {};
  dishItems.forEach(function(x){ have[x.dish_name] = true; });
  var toAdd = (templateDishes || []).filter(function(d){ return !have[d]; });
  if (toAdd.length === 0) return { added: [] };
  var rows = toAdd.map(function(d, i){
    var row = {};
    row[config.itemsFk] = config.itemsFkValue;
    row.dish_name = d;
    row.is_addon = false;
    row.ordering = dishItems.length + i;
    return row;
  });
  var ins = await supabase.from(config.itemsTable).insert(rows).select();
  if (ins.error) throw ins.error;
  var added = ins.data || [];
  var nextItems = dishItems.concat(added);
  onOptimistic(nextItems);
  var flag = {};
  flag[config.initializedColumn] = true;
  await supabase.from(config.parentTable).update(flag).eq('id', config.parentIdValue);
  return { added: added, nextItems: nextItems };
}

// FULLY self-contained: optimistic flip, swallow + rollback + console.error
// internally on failure — never throws, matches both files' identical
// existing behavior exactly (neither shows the user a message for this one).
export async function toggleFocItem(config, dishItems, dishName, onOptimistic) {
  var cur = dishItems.find(function(x){ return x.dish_name === dishName; });
  if (!cur) return;
  var next = !cur.foc;
  onOptimistic(dishItems.map(function(x){ return x.dish_name === dishName ? { ...x, foc: next } : x; }));
  try {
    var res = await supabase.from(config.itemsTable).update({ foc: next })
      .eq(config.itemsFk, config.itemsFkValue).eq('dish_name', dishName);
    if (res.error) throw res.error;
  } catch (e) {
    console.error('[menuItemOps] toggleFoc failed:', e);
    onOptimistic(dishItems.map(function(x){ return x.dish_name === dishName ? { ...x, foc: !next } : x; }));
  }
}

// onOptimistic called immediately (sync); write failure swallowed +
// console.error'd, never throws — matches existing fire-and-forget behavior
// in both files (the chef/sales person sees the tag applied either way;
// a lost persistence write here was already a silent risk before this
// module existed, not something introduced by unifying it).
export async function saveSectionOverride(config, sectionOverrides, dishName, sectionId, onOptimistic) {
  var next = { ...sectionOverrides };
  if (sectionId) next[dishName] = sectionId; else delete next[dishName];
  onOptimistic(next);
  try {
    var res = await supabase.from(config.parentTable).update({ menu_section_overrides: next }).eq('id', config.parentIdValue);
    if (res.error) throw res.error;
  } catch (e) {
    console.error('[menuItemOps] saveSectionOverride failed:', e);
  }
  return next;
}

// Two-stage error policy preserved exactly: the dishes_master select THROWS
// on error (nothing persisted yet, safe to propagate); the parentTable
// overrides-write is swallowed + console.error'd (matches both files —
// addCustomDish/addExistingDish call this right after a successful dish
// insert, and must not report "could not add that dish" just because its
// section tag failed to save).
export async function addSectionFromLibrary(config, sectionOverrides, catSectionId, targetId, subIds, onOptimistic) {
  if (!targetId) return; // nothing to browse under without a target pill
  var ids = [catSectionId].concat(subIds || []);
  var res = await supabase.from('dishes_master').select('dish_name').in('section_id', ids).eq('is_active', true);
  if (res.error) throw res.error;
  var names = (res.data || []).map(function(r){ return r.dish_name; });
  if (names.length === 0) return;
  var next = { ...sectionOverrides };
  names.forEach(function(n){ next[n] = targetId; });
  onOptimistic(next);
  var updRes = await supabase.from(config.parentTable).update({ menu_section_overrides: next }).eq('id', config.parentIdValue);
  if (updRes.error) console.error('[menuItemOps] saveSectionOverride (bulk) failed:', updRes.error);
}

// Swallowed write error, matches both files — removing an ad-hoc pill only
// clears tags (metadata), nothing is deselected/deleted.
export async function removeAdHocSection(config, sectionOverrides, grp, onOptimistic) {
  var ids = [grp.id].concat((grp.subGroups || []).map(function(sg){ return sg.id; }));
  var next = { ...sectionOverrides };
  var changed = false;
  Object.keys(next).forEach(function(name){ if (ids.indexOf(next[name]) >= 0) { delete next[name]; changed = true; } });
  if (!changed) return;
  onOptimistic(next);
  var res = await supabase.from(config.parentTable).update({ menu_section_overrides: next }).eq('id', config.parentIdValue);
  if (res.error) console.error('[menuItemOps] removeAdHocSection failed:', res.error);
}
