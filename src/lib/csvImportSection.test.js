// Tests for buildCsvImportSections/resolveCsvCatalogueSectionId — see the
// file header in csvImportSection.js for the bugs this exists to close
// (CSV re-import stranding section ids/depts/subsections; CSV-imported
// dishes never getting dishes_master.section_id set).

import { describe, it, expect } from 'vitest';
import { buildCsvImportSections, resolveCsvCatalogueSectionId } from './csvImportSection.js';

function row(pkg, section, dish, extra) {
  return Object.assign({ package: pkg, section: section, dish: dish, sop_category: '' }, extra || {});
}

describe('buildCsvImportSections', () => {
  it('a brand-new package gets fresh section ids defaulting to kit, same as a manually-added section', () => {
    const rows = [row('Pearl Veg', 'Beverages', 'Fresh Lime Soda')];
    const out = buildCsvImportSections(rows, () => []);
    expect(out['Pearl Veg']).toHaveLength(1);
    const sec = out['Pearl Veg'][0];
    expect(sec.name).toBe('Beverages');
    expect(sec.sales_dept).toBe('kit');
    expect(sec.dishes).toEqual(['Fresh Lime Soda']);
    expect(sec.id).toMatch(/^sec_/);
  });

  it('re-importing into an EXISTING package reuses the matching section\'s real id and sales_dept, not a fresh id defaulting to kit', () => {
    const existing = [{ id: 'sec_real_bev', name: 'Beverages', sales_dept: 'bev', dishes: ['Old Dish'] }];
    const rows = [row('Pearl Veg', 'Beverages', 'Fresh Lime Soda')];
    const out = buildCsvImportSections(rows, (pkg) => (pkg === 'Pearl Veg' ? existing : []));
    const sec = out['Pearl Veg'][0];
    expect(sec.id).toBe('sec_real_bev');
    expect(sec.sales_dept).toBe('bev');
    // the section's own dish LIST is rebuilt from the CSV, not merged —
    // this import format intentionally resyncs a section's direct dishes.
    expect(sec.dishes).toEqual(['Fresh Lime Soda']);
  });

  it('section name matching is case/whitespace insensitive', () => {
    const existing = [{ id: 'sec_real_bev', name: '  Beverages  ', sales_dept: 'bev', dishes: [] }];
    const rows = [row('Pearl Veg', 'BEVERAGES', 'Fresh Lime Soda')];
    const out = buildCsvImportSections(rows, () => existing);
    expect(out['Pearl Veg'][0].id).toBe('sec_real_bev');
  });

  it('an existing section\'s subsections and catalogue_section_id are carried over verbatim — the CSV schema has no column that could ever represent them', () => {
    const subs = [{ id: 'sub_1', name: 'Mocktails', sales_dept: 'bev', dishes: ['Virgin Mojito'] }];
    const existing = [{ id: 'sec_real_bev', name: 'Beverages', sales_dept: 'bev', catalogue_section_id: 'cat_bev_1', subsections: subs, dishes: [] }];
    const rows = [row('Pearl Veg', 'Beverages', 'Fresh Lime Soda')];
    const out = buildCsvImportSections(rows, () => existing);
    const sec = out['Pearl Veg'][0];
    expect(sec.subsections).toBe(subs);
    expect(sec.catalogue_section_id).toBe('cat_bev_1');
  });

  it('a CSV section name with NO existing match still gets a fresh kit-default section, even in an existing package', () => {
    const existing = [{ id: 'sec_real_bev', name: 'Beverages', sales_dept: 'bev', dishes: [] }];
    const rows = [row('Pearl Veg', 'Starters', 'Paneer Tikka')];
    const out = buildCsvImportSections(rows, () => existing);
    const sec = out['Pearl Veg'][0];
    expect(sec.name).toBe('Starters');
    expect(sec.sales_dept).toBe('kit');
    expect(sec.id).not.toBe('sec_real_bev');
  });

  it('multiple rows for the same section accumulate into one section object, in first-seen order, without duplicate dishes', () => {
    const rows = [
      row('Pearl Veg', 'Starters', 'Paneer Tikka'),
      row('Pearl Veg', 'Beverages', 'Fresh Lime Soda'),
      row('Pearl Veg', 'Starters', 'Veg Seekh Kebab'),
      row('Pearl Veg', 'Starters', 'Paneer Tikka'), // duplicate row, same dish
    ];
    const out = buildCsvImportSections(rows, () => []);
    expect(out['Pearl Veg']).toHaveLength(2);
    expect(out['Pearl Veg'][0].name).toBe('Starters');
    expect(out['Pearl Veg'][0].dishes).toEqual(['Paneer Tikka', 'Veg Seekh Kebab']);
    expect(out['Pearl Veg'][1].name).toBe('Beverages');
  });

  it('multiple packages are grouped independently, each resolved against its OWN existing sections', () => {
    const rows = [row('Pearl Veg', 'Beverages', 'Fresh Lime Soda'), row('Pearl Non-Veg', 'Beverages', 'Cold Coffee')];
    const existingByPkg = { 'Pearl Veg': [{ id: 'sec_veg_bev', name: 'Beverages', sales_dept: 'bev', dishes: [] }] };
    const out = buildCsvImportSections(rows, (pkg) => existingByPkg[pkg] || []);
    expect(out['Pearl Veg'][0].id).toBe('sec_veg_bev');
    expect(out['Pearl Non-Veg'][0].id).not.toBe('sec_veg_bev');
    expect(out['Pearl Non-Veg'][0].sales_dept).toBe('kit');
  });

  it('a row\'s own sop_category fills in a blank one on a matched existing section, but never overwrites one the section already has', () => {
    const existing = [{ id: 'sec_real', name: 'Beverages', sales_dept: 'bev', sop_category: 'Beverages', dishes: [] }];
    const rows = [row('Pearl Veg', 'Beverages', 'Fresh Lime Soda', { sop_category: 'Something Else' })];
    const out = buildCsvImportSections(rows, () => existing);
    expect(out['Pearl Veg'][0].sop_category).toBe('Beverages'); // kept, not overwritten
  });

  it('two rows spelling the same section with different case/whitespace ("Beverages" / "BEVERAGES") merge into ONE section object, not two sharing the same id', () => {
    // Caught by adversarial review: grouping was keyed by the raw CSV text,
    // while the existing-section match was already case/whitespace folded —
    // two differently-cased rows for one section both matched the same
    // existing section and were pushed as separate objects sharing its id,
    // a real id collision in the result.
    const existing = [{ id: 'sec_real_bev', name: 'Beverages', sales_dept: 'bev', dishes: [] }];
    const rows = [
      row('Pearl Veg', 'Beverages', 'Fresh Lime Soda'),
      row('Pearl Veg', '  BEVERAGES  ', 'Cold Coffee'),
    ];
    const out = buildCsvImportSections(rows, () => existing);
    expect(out['Pearl Veg']).toHaveLength(1);
    expect(out['Pearl Veg'][0].id).toBe('sec_real_bev');
    expect(out['Pearl Veg'][0].dishes).toEqual(['Fresh Lime Soda', 'Cold Coffee']);
  });

  it('the same merge-by-normalized-name also applies to a BRAND-NEW section name spelled two ways, not just an existing-match', () => {
    const rows = [
      row('Pearl Veg', 'Mocktails', 'Virgin Mojito'),
      row('Pearl Veg', 'MOCKTAILS', 'Blue Lagoon'),
    ];
    const out = buildCsvImportSections(rows, () => []);
    expect(out['Pearl Veg']).toHaveLength(1);
    expect(out['Pearl Veg'][0].dishes).toEqual(['Virgin Mojito', 'Blue Lagoon']);
  });

  it('empty csvRows / no existing sections never throws', () => {
    expect(buildCsvImportSections([], () => [])).toEqual({});
    expect(buildCsvImportSections(null, () => [])).toEqual({});
  });
});

describe('resolveCsvCatalogueSectionId', () => {
  const CATALOGUE = [
    { id: 'cat_bev', name: 'Beverages' },
    { id: 'cat_starters', name: 'Starters' },
    { id: 'cat_dup_a', name: 'Duplicate Name' },
    { id: 'cat_dup_b', name: 'Duplicate Name' },
  ];

  it('resolves by exact (case/space insensitive) sop_category match first', () => {
    const r = { section: 'Drinks', sop_category: '  beverages  ' };
    expect(resolveCsvCatalogueSectionId(r, CATALOGUE)).toBe('cat_bev');
  });

  it('falls back to the section name when sop_category is blank, or when sop_category matches nothing but the section name still does', () => {
    expect(resolveCsvCatalogueSectionId({ section: 'Starters', sop_category: '' }, CATALOGUE)).toBe('cat_starters');
    expect(resolveCsvCatalogueSectionId({ section: 'Starters', sop_category: 'No Such Category' }, CATALOGUE)).toBe('cat_starters');
  });

  it('resolves to null when NEITHER sop_category nor section name matches anything', () => {
    expect(resolveCsvCatalogueSectionId({ section: 'No Such Section Either', sop_category: 'No Such Category' }, CATALOGUE)).toBeNull();
  });

  it('never guesses — a name matching MORE THAN ONE catalogue section resolves to null, not an arbitrary pick', () => {
    expect(resolveCsvCatalogueSectionId({ section: 'Duplicate Name', sop_category: '' }, CATALOGUE)).toBeNull();
  });

  it('a name matching no catalogue section resolves to null, not a guess', () => {
    expect(resolveCsvCatalogueSectionId({ section: 'Nonexistent Section', sop_category: '' }, CATALOGUE)).toBeNull();
  });

  it('a missing row, missing catalogue list, or empty strings never throw', () => {
    expect(resolveCsvCatalogueSectionId(null, CATALOGUE)).toBeNull();
    expect(resolveCsvCatalogueSectionId({ section: '', sop_category: '' }, CATALOGUE)).toBeNull();
    expect(resolveCsvCatalogueSectionId({ section: 'Beverages', sop_category: '' }, null)).toBeNull();
    expect(resolveCsvCatalogueSectionId({ section: 'Beverages', sop_category: '' }, [])).toBeNull();
  });
});
