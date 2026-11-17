// Ambria FnB — resolves a menu-placement id to its sales department.
//
// A per-event/per-proposal placement tag (sectionOverrides/menu_section_
// overrides) can point at a package section's own id, a package SUBSECTION's
// own id, a catalogue section id, or an "<id>__unplaced" id. This was
// duplicated three times (two inside src/utils/useMenuItemGrouping.js, one
// in src/lib/eventItems.js) — two of the three copies only ever checked
// TOP-LEVEL package sections, so a tag on a subsection fell through to the
// catalogue-section branch (wrong result if the id happened to collide, null
// otherwise) instead of resolving through the subsection's own (or its
// parent's) sales_dept. The third copy, inside useMenuItemGrouping.js's
// groupedByPkgSection memo, already had the subsection loop below — this is
// that correct version, pulled out so there is exactly one copy left to stay
// correct.
//
// A subsection's own `sales_dept` wins when set, else its PARENT section's —
// the same precedence dishNameToPkgDept (useMenuItemGrouping.js) and
// buildEventDeptContext (eventItems.js) already use for a package's own
// static dish list.
export function resolveDeptForOverrideTarget(rawId, pkgSections, catalogueSections) {
  if (!rawId) return null;
  var i = rawId.indexOf('__unplaced');
  var id = i >= 0 ? rawId.slice(0, i) : rawId;
  var pkgSecs = pkgSections || [];
  var ps = pkgSecs.find(function(s){ return s && s.id === id; });
  if (ps) return ps.sales_dept || 'kit';
  for (var k = 0; k < pkgSecs.length; k++) {
    var sec = pkgSecs[k];
    var subMatch = (sec.subsections || []).find(function(sub){ return sub && sub.id === id; });
    if (subMatch) return subMatch.sales_dept || sec.sales_dept || 'kit';
  }
  var sectionsArr = catalogueSections || [];
  var cs = sectionsArr.find(function(s){ return s && s.id === id; });
  if (cs) {
    if (cs.sales_dept) return cs.sales_dept;
    var parent = cs.parent_section_id ? sectionsArr.find(function(s){ return s.id === cs.parent_section_id; }) : null;
    return (parent && parent.sales_dept) || 'kit';
  }
  return null;
}
