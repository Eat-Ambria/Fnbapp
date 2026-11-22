// Ambria FnB — pure helpers for MenuPackagesView.jsx's CSV package import.
//
// Found by audit: `commitCsvImport` built every CSV-imported section as a
// brand-new object (`id: 'sec_' + Date.now() + ...`, no `sales_dept`, no
// `subsections`) even when re-importing into an EXISTING package whose
// `menu_packages.sections` column got wholesale-replaced by the import.
// That silently (a) assigned a NEW section id on every re-import, stranding
// any `menu_section_overrides` that already pointed at the OLD id (same
// failure mode as the already-fixed "switching an event's package stranded
// dish tags" bug — just triggered by a CSV re-import instead of a package
// switch), (b) reset every section's department back to the 'kit' default,
// silently undoing whatever the package editor's own department picker had
// set, and (c) dropped subsections entirely, since the CSV's flat
// package/section/dish schema has no column that could ever represent one.
//
// buildCsvImportSections fixes this by matching each CSV row's `section`
// text against the package's EXISTING sections (by name, case/space
// insensitive) and, on a match, carrying over that section's real `id`,
// `sales_dept`, `catalogue_section_id` and `subsections` verbatim — only the
// section's OWN direct `dishes` list is rebuilt from the CSV, which is the
// one thing the CSV actually describes. A brand-new section name (no
// existing match) still gets a fresh id and the same 'kit' default a
// manually-added section gets (MenuPackagesView.jsx's own `addSection`).
//
// `getExistingSections(pkgName)` is injected so this stays pure/testable —
// the caller passes `getSectionsForPackage` (recipeData.js) for a package
// that already exists, or a function returning `[]` for one that doesn't.
export function buildCsvImportSections(csvRows, getExistingSections) {
  var byPkg = {};
  (csvRows || []).forEach(function (r) {
    if (!byPkg[r.package]) {
      var existingByName = {};
      (getExistingSections(r.package) || []).forEach(function (s) {
        if (!s || !s.name) return;
        existingByName[s.name.trim().toLowerCase()] = s;
      });
      byPkg[r.package] = { sections: [], secIdx: {}, existingByName: existingByName };
    }
    var bag = byPkg[r.package];
    // Grouped by the NORMALIZED section name (same case/whitespace fold as
    // the existing-section match just above), not the raw CSV text — found
    // by adversarial review: two rows spelling the same section differently
    // ("Beverages" / "BEVERAGES", an easy manual-CSV-editing mistake) would
    // otherwise each independently match the same existing section by name
    // and get pushed as TWO separate objects sharing the identical `id`, a
    // real id collision downstream (sortable-list keys, section-settings
    // lookups, resolveDeptForOverrideTarget's own `find` only ever seeing
    // the first of the pair).
    var secKey = (r.section || '').trim().toLowerCase();
    if (bag.secIdx[secKey] == null) {
      bag.secIdx[secKey] = bag.sections.length;
      var existing = bag.existingByName[secKey];
      bag.sections.push(existing ? {
        id: existing.id,
        name: r.section,
        sop_category: existing.sop_category || r.sop_category || '',
        sales_dept: existing.sales_dept || 'kit',
        catalogue_section_id: existing.catalogue_section_id || null,
        subsections: existing.subsections || [],
        dishes: [],
      } : {
        id: 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '_' + bag.sections.length,
        name: r.section, sop_category: r.sop_category || '', sales_dept: 'kit', dishes: [],
      });
    }
    var sec = bag.sections[bag.secIdx[secKey]];
    if (r.sop_category && !sec.sop_category) sec.sop_category = r.sop_category;
    if (sec.dishes.indexOf(r.dish) === -1) sec.dishes.push(r.dish);
  });
  var out = {};
  Object.keys(byPkg).forEach(function (p) { out[p] = byPkg[p].sections; });
  return out;
}

// Found by the same audit: `commitCsvImport`'s dishes_master insert for a
// brand-new dish never set `section_id`, even though the CSV's own `section`
// (and optional `sop_category`) column names exactly the kind of thing
// `dishes_master.section_id` points at (a `dish_catalogue_sections` row) —
// every OTHER "add a new dish" entry point in the app
// (createCustomDishInLibrary, used by MenuEditor/EventMenuBuilderView/
// MenuBuilderView) resolves and writes this; CSV import alone skipped it.
//
// Resolves by exact name match (case/space insensitive) against the real
// catalogue section list, preferring `sop_category` (the column most
// clearly meant to name a catalogue/SOP grouping) and falling back to
// `section`. Never guesses: a name that matches zero or MORE THAN ONE
// catalogue section returns null (dish imports with no section_id, exactly
// as if nothing had matched before this fix — not a regression, just not
// improved for that one row).
export function resolveCsvCatalogueSectionId(row, catalogueSections) {
  if (!row) return null;
  var candidates = [row.sop_category, row.section]
    .filter(Boolean)
    .map(function (s) { return s.trim().toLowerCase(); });
  for (var i = 0; i < candidates.length; i++) {
    var matches = (catalogueSections || []).filter(function (s) {
      return s && (s.name || '').trim().toLowerCase() === candidates[i];
    });
    if (matches.length === 1) return matches[0].id;
  }
  return null;
}
