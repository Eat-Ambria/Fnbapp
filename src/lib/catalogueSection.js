// Ambria FnB — resolves a menu-placement id to a real dish_catalogue_sections
// id, or null.
//
// The Add-dish modal's placement chips (ItemsTab's placementOptions, see
// MenuBuilderView.jsx) and MenuEditor's own section picker can hand back any
// of: a real catalogue section id, a package section's own (package-local)
// id, a package SUBSECTION id, an "<id>__unplaced" id, a SOP/recipe category
// id, or the sentinel '__extras__'. That raw value is exactly what gets
// stored in sectionOverrides/menu_section_overrides — but dishes_master.
// section_id is a real FK to dish_catalogue_sections(id), so writing one of
// those non-catalogue shapes into it would either violate the FK outright or
// (if it happened to collide with a real id) tag the dish into the wrong
// section. This function is the one safe translation from "whatever got
// picked" to "a verified catalogue id, or null".
//
// A package SUBSECTION resolves through its OWN catalogue_section_id link
// when it has one, else falls back to its PARENT top-level section's link —
// UNLESS the subsection's own effective sales_dept differs from its parent's
// (e.g. a bev-dept "Fresh Juice" subsection under an otherwise kit-dept
// parent section, same sec.sales_dept/sub.sales_dept precedence
// src/lib/eventItems.js's buildEventDeptContext already uses) — a subsection
// deliberately routed to a different department almost certainly belongs to
// a different catalogue section too, and this result gets written PERMANENTLY
// into dishes_master.section_id for a custom dish tagged to it (see
// EventMenuBuilderView.jsx/MenuBuilderView.jsx/MenuEditor.jsx's addCustomDish
// flows), so silently inheriting the wrong-department parent link would plant
// a wrong section into the shared dish library, not just mis-sort one print.
// A subsection's OWN link, once used, is taken as-is: if it points at a
// catalogue id that no longer exists, this resolves to null rather than
// falling back to the parent's link instead — an invalid link is a data
// problem to surface, not paper over.
//
// "<id>__unplaced" ids are built from a TOP-LEVEL id (a package section's own
// id, or a catalogue section id) OR a SUBSECTION's own id — see
// useMenuItemGrouping.js's resolveOwnDishes, called with either a top-level
// section or one of its subsections as `labelSec` (e.g. `labelSec.id +
// '__unplaced'`), and its other construction sites (`targetId+'__unplaced'`).
// Either way it means "doesn't belong to any more specific catalogue
// subsection", not "belongs to no section", so it resolves exactly like the
// bare id (top-level OR subsection) with the suffix stripped.
//
// This is now the ONLY implementation of this resolution — EventMenuBuilderView
// .jsx's effectiveSectionIdByDish calls buildOverrideResolver below directly
// instead of keeping its own separate copy, so there is nothing left to drift.
function stripUnplaced(id) {
  var i = (id || '').indexOf('__unplaced');
  return i >= 0 ? id.slice(0, i) : id;
}

// Flattens pkgSections (top-level package sections + their subsections) into
// one {id -> catalogue_section_id|null} map. Shared by buildOverrideResolver
// and packageCatalogueLinkFor so there is exactly one copy of the subsection
// fallback/dept-match rule below.
function buildPkgLink(pkgSections) {
  var pkgLink = {};
  (pkgSections || []).forEach(function(sec){
    if (!sec || !sec.id) return;
    if (!(sec.id in pkgLink)) pkgLink[sec.id] = sec.catalogue_section_id || null;
    var secDept = sec.sales_dept || 'kit';
    (sec.subsections || []).forEach(function(sub){
      if (!sub || !sub.id || (sub.id in pkgLink)) return;
      var subDept = sub.sales_dept || secDept;
      // Only inherit the parent's catalogue link when this subsection hasn't
      // been routed to a different department than its parent — see the
      // file header comment above for why.
      var parentLink = (subDept === secDept) ? (sec.catalogue_section_id || null) : null;
      pkgLink[sub.id] = sub.catalogue_section_id || parentLink;
    });
  });
  return pkgLink;
}

// One-time setup over a (catalogueSections, pkgSections) pair, returning a
// resolver function — use this when resolving many ids against the same
// pair (e.g. once per dish in a useMemo) instead of re-flattening pkgSections
// on every call.
export function buildOverrideResolver(catalogueSections, pkgSections) {
  var byId = {};
  (catalogueSections || []).forEach(function(s){ if (s && s.id) byId[s.id] = true; });
  var pkgLink = buildPkgLink(pkgSections);
  return function resolve(rawId) {
    if (!rawId || rawId === '__extras__') return null;
    if (byId[rawId]) return rawId;
    var id = stripUnplaced(rawId);
    if (byId[id]) return id;
    var link = pkgLink[id];
    return (link && byId[link]) ? link : null;
  };
}

export function resolveOverrideToCatalogueSectionId(rawId, catalogueSections, pkgSections) {
  return buildOverrideResolver(catalogueSections, pkgSections)(rawId);
}

// Same id resolution as above, but for callers (MenuEditor's own section
// picker) that only have pkgSections verified against a catalogue list
// SEPARATELY and want the raw package-link candidate back (verified or not)
// rather than a pre-verified catalogue id.
export function packageCatalogueLinkFor(rawId, pkgSections) {
  if (!rawId || rawId === '__extras__') return null;
  var id = stripUnplaced(rawId);
  return buildPkgLink(pkgSections)[id] || null;
}
