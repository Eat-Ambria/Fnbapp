// Ambria FnB — pure, side-effect-free decision helpers for DishLibrary.jsx's
// rename/merge feature. Kept separate from applyRenameToBookings (which does
// all the actual Supabase reads/writes) so these decisions are unit-testable
// without a Supabase client.
//
// The guiding rule throughout: never silently resolve a genuine ambiguity —
// when two dishes being merged BOTH have independent state for the same
// event (a section tag, an outsourced flag, kitchen_tracking progress) with
// no clear "this one is right", leave both alone and report it for a human
// to review, rather than guessing. Same philosophy as this repo's LMS sync
// safety rules (LMS_SYNC_SAFETY_PATTERNS.md, "never guess on ambiguity").

// JSON.stringify with object keys sorted recursively, so two objects that
// differ only in key insertion order compare as equal content.
export function stableStringify(v) {
  function sortKeys(x) {
    if (Array.isArray(x)) return x.map(sortKeys);
    if (x && typeof x === 'object') {
      var out = {};
      Object.keys(x).sort().forEach(function(k){ out[k] = sortKeys(x[k]); });
      return out;
    }
    return x;
  }
  return JSON.stringify(sortKeys(v));
}

export function isEmptyPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0;
}

// menu_section_overrides (events.menu_section_overrides / proposals.menu_section_overrides)
// is a flat { [dishName]: sectionIdOrSentinel } object. Renaming source keys
// to the target key, when the target already has its own tag, follows the
// SAME precedent applyRenameToBookings already uses for event_items/
// proposal_items (hasTarget): the row/tag already on the target wins, the
// source's is dropped as a redundant duplicate — not compared or merged.
export function renameOverrideKeys(overrides, sources, target) {
  var srcs = (sources || []).filter(function(s){ return s !== target; });
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return { changed: false, next: overrides, warning: null };
  var present = srcs.filter(function(s){ return Object.prototype.hasOwnProperty.call(overrides, s); });
  if (present.length === 0) return { changed: false, next: overrides, warning: null };
  var next = Object.assign({}, overrides);
  if (Object.prototype.hasOwnProperty.call(overrides, target)) {
    var dropped = present
      .filter(function(s){ return stableStringify(overrides[s]) !== stableStringify(overrides[target]); })
      .map(function(s){ return { name: s, tag: overrides[s] }; });
    present.forEach(function(s){ delete next[s]; });
    var warning = dropped.length > 0 ? { kind: 'override-target-wins', keptTag: overrides[target], dropped: dropped } : null;
    return { changed: true, next: next, warning: warning };
  }
  var distinctTags = Array.from(new Set(present.map(function(s){ return stableStringify(overrides[s]); })));
  if (distinctTags.length > 1) {
    // Sources disagree with each other and there's no target tag to defer
    // to — genuinely ambiguous which one should win. Change nothing.
    return {
      changed: false, next: overrides,
      warning: { kind: 'override-conflict', tags: present.map(function(s){ return { name: s, tag: overrides[s] }; }) },
    };
  }
  next[target] = overrides[present[0]];
  present.forEach(function(s){ delete next[s]; });
  return { changed: true, next: next, warning: null };
}

// events.outsourced_dishes is a plain array of dish-name strings (vendor-
// supplied dishes, excluded from kitchen prep). `targetWasOnEvent` is true
// when the target dish was ALREADY selected on this event (event_items)
// before this merge — in that case event_items' own precedent already kept
// the target's row and dropped the source's as a duplicate, so the target's
// in-house/outsourced status should win here too, for the same reason.
export function renameOutsourced(arr, sources, target, targetWasOnEvent) {
  var srcs = (sources || []).filter(function(s){ return s !== target; });
  if (!Array.isArray(arr)) return { changed: false, next: arr, warning: null };
  var presentSources = srcs.filter(function(s){ return arr.indexOf(s) !== -1; });
  if (presentSources.length === 0) return { changed: false, next: arr, warning: null };
  if (targetWasOnEvent && arr.indexOf(target) === -1) {
    var next = arr.filter(function(n){ return srcs.indexOf(n) === -1; });
    return { changed: true, next: next, warning: { kind: 'outsourced-target-wins', droppedSources: presentSources } };
  }
  var seen = {};
  var renamed = arr.map(function(n){ return srcs.indexOf(n) !== -1 ? target : n; });
  var deduped = renamed.filter(function(n){ if (seen[n]) return false; seen[n] = true; return true; });
  return { changed: true, next: deduped, warning: null };
}

// kitchen_tracking rows are keyed (ev_id, dish_key). Three dish_key shapes
// exist in this table (see MEMORY.md): per-event "<evId>|<dishName>",
// combined-day-bucket "dish|<dishName>", and legacy position-based
// "<evId>|<index>" (name-independent, never touched by a rename). This
// builds the first two; legacy keys are never passed through here.
export function ktKeyFor(evId, dishName) {
  if (typeof evId === 'string' && evId.indexOf('__combined_') === 0) return 'dish|' + dishName;
  return evId + '|' + dishName;
}

// Decides what to do when a kitchen_tracking row is being moved from a
// source dish_key to a target dish_key for the same ev_id.
//   'move'              — no row exists yet under the target key; safe to copy and delete the source.
//   'drop-empty-source' — the source row holds no real data; nothing to lose, just delete it.
//   'already-moved'     — source and target already hold identical data/key_ts (a prior partial run of this same merge); delete the now-redundant source.
//   'conflict'          — BOTH rows hold independent, different progress — genuinely ambiguous which should win. Touch neither.
export function classifyKtMove(srcRow, tgtRow) {
  if (!tgtRow) return 'move';
  if (isEmptyPlainObject(srcRow.data)) return 'drop-empty-source';
  var sameData = stableStringify(srcRow.data) === stableStringify(tgtRow.data);
  var sameKeyTs = stableStringify(srcRow.key_ts || {}) === stableStringify(tgtRow.key_ts || {});
  if (sameData && sameKeyTs) return 'already-moved';
  return 'conflict';
}

// Renders a short, human-readable list of merge warnings for an alert/toast
// — never more than `max` lines, with a "…and N more" tail if truncated.
export function formatMergeWarnings(warnings, max) {
  var cap = max == null ? 8 : max;
  var list = warnings || [];
  if (list.length === 0) return '';
  var lines = list.slice(0, cap).map(function(w){
    switch (w.kind) {
      case 'override-target-wins': return 'Section tag kept from target dish; ' + w.dropped.length + ' source tag(s) dropped' + (w.table ? ' (' + w.table + (w.id ? ' ' + w.id : '') + ')' : '');
      case 'override-conflict': return 'Section tags disagree between sources with no target tag — left unchanged' + (w.table ? ' (' + w.table + (w.id ? ' ' + w.id : '') + ')' : '');
      case 'outsourced-target-wins': return 'Outsourced flag dropped — target dish was already in-house' + (w.id ? ' (event ' + w.id + ')' : '');
      case 'kt-conflict': return 'Kitchen tracking progress exists under both names for event ' + w.ev_id + ' — left unchanged, review manually';
      case 'kt-conflict-race': return 'Kitchen tracking progress appeared under the target name during the merge for event ' + w.ev_id + ' — left unchanged, review manually';
      case 'kt-source-changed': return 'Kitchen tracking progress changed during the merge for event ' + w.ev_id + ' — both copies kept, review manually';
      case 'kt-skipped-name': return 'Skipped kitchen tracking for "' + w.name + '" — name looks like an internal key, review manually';
      default: return w.kind;
    }
  });
  if (list.length > cap) lines.push('…and ' + (list.length - cap) + ' more');
  return lines.join('\n');
}
