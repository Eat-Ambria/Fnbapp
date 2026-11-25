// Ambria FnB — cleans a stale menu_section_overrides entry after an event's
// package is switched.
//
// A per-event sectionOverrides tag (events.menu_section_overrides, {dishName
// -> targetId}) can point at a real catalogue section/subsection id, a
// package section's/subsection's own (package-local) id, an "<id>__unplaced"
// id (see src/lib/catalogueSection.js — stripped the same way here before
// matching), or '__extras__'. A package-local id that belonged ONLY to the
// OLD package — never the new one too — becomes meaningless once the
// package changes: nothing in the new package, and no real catalogue
// section, can ever match it, so the dish silently strands as a mislabeled
// "Extras" pill with no indication why.
//
// Package-local ids are NOT always unique ACROSS packages, despite being
// randomly generated on creation — confirmed by adversarial review:
// duplicating a package (MenuPackagesView.jsx's duplicatePackage) keeps
// every SUBSECTION's original id (only top-level section ids are
// regenerated), and a package whose sections were never edited away from
// their derived default (getSectionsForPackage, recipeData.js) gets
// deterministic ids like "sec_0_main_course" that a second, similarly-
// never-edited package can independently end up with too. So an id must
// only be dropped when it belonged to the OLD package and does NOT also
// exist in the NEW one — a tag that happens to still be valid in the new
// package (because the two packages share that id) must survive.
//
// A tag pointing at anything else — a real catalogue id, or '__extras__'
// — is a deliberate, catalogue-level placement independent of which
// package is active, and must survive a package switch untouched.
function stripUnplaced(id) {
  const i = (id || '').indexOf('__unplaced');
  return i >= 0 ? id.slice(0, i) : id;
}

function collectSectionIds(pkgSections) {
  const ids = new Set();
  (pkgSections || []).forEach(function (sec) {
    if (!sec) return;
    if (sec.id) ids.add(sec.id);
    (sec.subsections || []).forEach(function (sub) { if (sub && sub.id) ids.add(sub.id); });
  });
  return ids;
}

export function overridesWithoutOldPackageLocalIds(overrides, oldPkgSections, newPkgSections) {
  const oldIds = collectSectionIds(oldPkgSections);
  const newIds = collectSectionIds(newPkgSections);
  const cleaned = {};
  let changed = false;
  Object.keys(overrides || {}).forEach(function (dishName) {
    const rawVal = overrides[dishName];
    // A multi-section tag (array) drops only the ids that went stale, keeping
    // whichever still resolve — a scalar tag behaves exactly as before
    // (the dish's one tag either survives whole or is dropped whole).
    const isArr = Array.isArray(rawVal);
    const ids = isArr ? rawVal : [rawVal];
    const kept = ids.filter(function (rawId) {
      const id = stripUnplaced(rawId);
      return !(oldIds.has(id) && !newIds.has(id));
    });
    if (kept.length === 0) { changed = true; return; }
    if (kept.length !== ids.length) changed = true;
    cleaned[dishName] = isArr ? kept : kept[0];
  });
  return { overrides: cleaned, changed: changed };
}
