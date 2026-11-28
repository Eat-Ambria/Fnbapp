// Ambria FnB — dish ↔ catalogue section membership (true many-to-many)
//
// dishes_master.section_id used to be a single scalar FK: one dish, one
// dish_catalogue_sections row. dish_section_links replaces that with a real
// join table — a dish can belong to zero, one, or many sections, with NO
// stored "primary" column.
//
// A handful of things in this app are still fundamentally single-valued —
// not by data-model choice, but by what they ARE: a dish's kitchen/Store
// department (prep, ordering, cost all key off ONE department), and the
// printed Function Plan's one heading/one sort position per dish on one
// sheet. primarySectionFor below is a deterministic PICK (earliest-created
// membership) for exactly those consumers — it is not a stored primary, and
// nothing persists it; recomputing it from the same rows always gives the
// same answer. Every catalogue-browsing consumer (Sections tab, "Add
// section from library", the whole-catalogue search, the client-facing
// proposal preview) should use sectionIdsFor instead and show a dish under
// every section it belongs to — that's the actual point of this table.
import { supabase } from './supabase.js';

// Raw dish_section_links rows -> { [dishName]: [{section_id, sort_order,
// created_at}, ...] }, each dish's own list sorted by created_at ascending
// (index 0 is always the earliest/tie-break membership).
export function buildDishSectionsMap(linkRows) {
  var map = {};
  (linkRows || []).forEach(function(r) {
    if (!r || !r.dish_name || !r.section_id) return;
    (map[r.dish_name] = map[r.dish_name] || []).push({
      section_id: r.section_id,
      sort_order: r.sort_order || 0,
      created_at: r.created_at || null,
    });
  });
  Object.keys(map).forEach(function(name) {
    map[name].sort(function(a, b) {
      var ta = a.created_at ? Date.parse(a.created_at) : 0;
      var tb = b.created_at ? Date.parse(b.created_at) : 0;
      return ta - tb;
    });
  });
  return map;
}

// The deterministic tie-break for consumers that must resolve to ONE
// section — department routing, the printed Function Plan's heading/sort,
// no-auto-select suppression. Never use this for anything the user browses
// a catalogue through; use sectionIdsFor there instead.
export function primarySectionFor(dishName, map) {
  var rows = (map && map[dishName]) || [];
  return rows.length > 0 ? rows[0].section_id : null;
}

// Every section a dish belongs to, in tie-break order. Empty array, never
// null, when the dish has no memberships.
export function sectionIdsFor(dishName, map) {
  var rows = (map && map[dishName]) || [];
  return rows.map(function(r) { return r.section_id; });
}

// Every dish belonging to any of `sectionIds` (deduplicated), replacing the
// old `.in('section_id', ids)` scalar-column query. Mirrors
// menuItemOps.js's existing error-handling convention (throw on a real
// Supabase error, let the caller decide how to surface it).
export async function fetchDishNamesInSections(sectionIds) {
  var ids = (sectionIds || []).filter(Boolean);
  if (ids.length === 0) return [];
  var res = await supabase.from('dish_section_links').select('dish_name').in('section_id', ids);
  if (res.error) throw res.error;
  var seen = {};
  var out = [];
  (res.data || []).forEach(function(r) {
    if (r.dish_name && !seen[r.dish_name]) { seen[r.dish_name] = true; out.push(r.dish_name); }
  });
  return out;
}
