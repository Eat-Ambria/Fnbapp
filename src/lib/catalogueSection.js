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
// MUST stay identical to the override-resolution branch of
// EventMenuBuilderView.jsx's effectiveSectionIdByDish (its ~973-979) — that
// function is the one driving what a dish's section already LOOKS like
// everywhere else in the app (prints, the Items tab). Change both together.
// Package subsections are deliberately NOT resolved here, matching
// effectiveSectionIdByDish today — extending that is a separate decision.
export function resolveOverrideToCatalogueSectionId(rawId, catalogueSections, pkgSections) {
  if (!rawId || rawId === '__extras__') return null;
  var byId = {};
  (catalogueSections || []).forEach(function(s){ if (s && s.id) byId[s.id] = true; });
  if (byId[rawId]) return rawId;
  var pkgSec = (pkgSections || []).find(function(s){ return s && s.id === rawId; });
  if (pkgSec && pkgSec.catalogue_section_id && byId[pkgSec.catalogue_section_id]) return pkgSec.catalogue_section_id;
  return null;
}
