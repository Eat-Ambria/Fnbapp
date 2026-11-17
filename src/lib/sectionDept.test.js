// Tests for resolveDeptForOverrideTarget — see the file header in
// sectionDept.js for why this exists (three duplicated copies, two with the
// same top-level-only gap that catalogueSection.js's resolver had).

import { describe, it, expect } from 'vitest';
import { resolveDeptForOverrideTarget } from './sectionDept.js';

const PKG_SECTIONS = [
  { id: 'sec_1', name: 'Bev Section', sales_dept: 'bev' },
  { id: 'sec_2', name: 'No Dept Section' }, // no sales_dept — defaults to kit
  { id: 'sec_3', name: 'Has Subsections', sales_dept: 'kit', subsections: [
    { id: 'sub_1', name: 'Own Dept', sales_dept: 'bev' },
    { id: 'sub_2', name: 'No Own Dept' },
  ] },
  { id: 'sec_4', name: 'Undept Parent', subsections: [{ id: 'sub_3', name: 'No Own Dept Either' }] },
];

const CATALOGUE = [
  { id: 'cat_1', name: 'Catalogue With Dept', sales_dept: 'frt' },
  { id: 'cat_2', name: 'Catalogue No Dept, Has Parent', parent_section_id: 'cat_1' },
  { id: 'cat_3', name: 'Catalogue No Dept, No Parent' },
];

describe('resolveDeptForOverrideTarget', () => {
  it('resolves empty/falsy input to null', () => {
    expect(resolveDeptForOverrideTarget('', PKG_SECTIONS, CATALOGUE)).toBeNull();
    expect(resolveDeptForOverrideTarget(null, PKG_SECTIONS, CATALOGUE)).toBeNull();
    expect(resolveDeptForOverrideTarget(undefined, PKG_SECTIONS, CATALOGUE)).toBeNull();
  });

  it('a top-level package section resolves to its own sales_dept', () => {
    expect(resolveDeptForOverrideTarget('sec_1', PKG_SECTIONS, CATALOGUE)).toBe('bev');
  });

  it('a top-level package section with no sales_dept defaults to kit', () => {
    expect(resolveDeptForOverrideTarget('sec_2', PKG_SECTIONS, CATALOGUE)).toBe('kit');
  });

  it('a subsection with its own sales_dept resolves through IT, not its parent\'s', () => {
    expect(resolveDeptForOverrideTarget('sub_1', PKG_SECTIONS, CATALOGUE)).toBe('bev');
  });

  it('a subsection with no own sales_dept falls back to its parent\'s', () => {
    expect(resolveDeptForOverrideTarget('sub_2', PKG_SECTIONS, CATALOGUE)).toBe('kit');
  });

  it('a subsection AND its parent both lacking sales_dept defaults to kit', () => {
    expect(resolveDeptForOverrideTarget('sub_3', PKG_SECTIONS, CATALOGUE)).toBe('kit');
  });

  it('a catalogue section with its own sales_dept resolves to it', () => {
    expect(resolveDeptForOverrideTarget('cat_1', PKG_SECTIONS, CATALOGUE)).toBe('frt');
  });

  it('a catalogue section with no dept falls back to its parent catalogue section\'s dept', () => {
    expect(resolveDeptForOverrideTarget('cat_2', PKG_SECTIONS, CATALOGUE)).toBe('frt');
  });

  it('a catalogue section with no dept and no parent defaults to kit', () => {
    expect(resolveDeptForOverrideTarget('cat_3', PKG_SECTIONS, CATALOGUE)).toBe('kit');
  });

  it('"<id>__unplaced" resolves exactly like the bare id, for a package section, a subsection, and a catalogue section', () => {
    expect(resolveDeptForOverrideTarget('sec_1__unplaced', PKG_SECTIONS, CATALOGUE)).toBe('bev');
    expect(resolveDeptForOverrideTarget('sub_1__unplaced', PKG_SECTIONS, CATALOGUE)).toBe('bev');
    expect(resolveDeptForOverrideTarget('cat_2__unplaced', PKG_SECTIONS, CATALOGUE)).toBe('frt');
  });

  it('an id matching nothing resolves to null', () => {
    expect(resolveDeptForOverrideTarget('nope', PKG_SECTIONS, CATALOGUE)).toBeNull();
  });

  it('missing pkgSections/catalogueSections (null/undefined) never throws', () => {
    expect(resolveDeptForOverrideTarget('sec_1', null, null)).toBeNull();
    expect(resolveDeptForOverrideTarget('cat_1', undefined, undefined)).toBeNull();
  });

  it('package sections are checked before catalogue sections — if an id matched both, the package dept would win', () => {
    // Package ids (genSecId/genSubId, MenuPackagesView.jsx) and catalogue ids
    // (DB-generated, DishSectionsEditor.jsx) are disjoint in practice, so this
    // is a defensive check on the function's own precedence order, not a
    // real-world scenario.
    var collidingCatalogue = CATALOGUE.concat([{ id: 'sec_1', name: 'Same id, different space', sales_dept: 'frt' }]);
    expect(resolveDeptForOverrideTarget('sec_1', PKG_SECTIONS, collidingCatalogue)).toBe('bev');
  });
});
