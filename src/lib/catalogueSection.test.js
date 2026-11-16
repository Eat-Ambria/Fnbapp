// Tests for resolveOverrideToCatalogueSectionId — the translation from
// "whatever a placement chip handed back" to "a verified dish_catalogue_
// sections id, or null". Must agree with EventMenuBuilderView.jsx's
// effectiveSectionIdByDish override branch; see that file's comment.

import { describe, it, expect } from 'vitest';
import { resolveOverrideToCatalogueSectionId } from './catalogueSection.js';

const CATALOGUE = [
  { id: 'cat-chaat', name: 'Chaat Station' },
  { id: 'cat-tandoor', name: 'Tandoori Snacks' },
];

const PKG_SECTIONS = [
  { id: 'sec_1', name: 'Chatori Chaat', catalogue_section_id: 'cat-chaat' },
  { id: 'sec_2', name: 'Unlinked Section' }, // no catalogue_section_id
  { id: 'sec_3', name: 'Stale Link', catalogue_section_id: 'cat-does-not-exist' },
  // A section with a NESTED subsection (recipeData.js's real shape, e.g.
  // MENU_PACKAGE_SECTIONS[pkg][i].subsections[j]) — kept unflattened on
  // purpose: every real caller passes pkgSections as the flat, top-level
  // MENU_PACKAGE_SECTIONS[pkg] array, never with subsections pulled out to
  // the top level, so this is what resolveOverrideToCatalogueSectionId
  // actually sees in practice.
  { id: 'sec_4', name: 'Has A Subsection', subsections: [{ id: 'sub_1', name: 'A Subsection', catalogue_section_id: 'cat-tandoor' }] },
];

describe('resolveOverrideToCatalogueSectionId', () => {
  it('resolves __extras__ to null', () => {
    expect(resolveOverrideToCatalogueSectionId('__extras__', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('resolves empty/falsy input to null', () => {
    expect(resolveOverrideToCatalogueSectionId('', CATALOGUE, PKG_SECTIONS)).toBeNull();
    expect(resolveOverrideToCatalogueSectionId(null, CATALOGUE, PKG_SECTIONS)).toBeNull();
    expect(resolveOverrideToCatalogueSectionId(undefined, CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('a real catalogue id resolves to itself', () => {
    expect(resolveOverrideToCatalogueSectionId('cat-chaat', CATALOGUE, PKG_SECTIONS)).toBe('cat-chaat');
  });

  it('a package section linked to a known catalogue id resolves through the link', () => {
    expect(resolveOverrideToCatalogueSectionId('sec_1', CATALOGUE, PKG_SECTIONS)).toBe('cat-chaat');
  });

  it('a NESTED package subsection id is NOT resolved — a known, consistent gap, not a bug to silently fix here', () => {
    // sub_1 only exists inside sec_4.subsections, never flattened to the top
    // level of PKG_SECTIONS, so the plain .find(s => s.id === rawId) below
    // can't see it — matching effectiveSectionIdByDish's own real behavior
    // today (it searches only top-level MENU_PACKAGE_SECTIONS entries too).
    expect(resolveOverrideToCatalogueSectionId('sub_1', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('a package section with no catalogue_section_id resolves to null (no name fallback here)', () => {
    expect(resolveOverrideToCatalogueSectionId('sec_2', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('a package section linked to an unknown/stale catalogue id resolves to null', () => {
    expect(resolveOverrideToCatalogueSectionId('sec_3', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('an id matching neither catalogue nor package sections resolves to null (e.g. "<id>__unplaced" or a SOP category id)', () => {
    expect(resolveOverrideToCatalogueSectionId('sec_1__unplaced', CATALOGUE, PKG_SECTIONS)).toBeNull();
    expect(resolveOverrideToCatalogueSectionId('curry', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('an empty catalogue list makes everything resolve to null, never garbage', () => {
    expect(resolveOverrideToCatalogueSectionId('cat-chaat', [], PKG_SECTIONS)).toBeNull();
    expect(resolveOverrideToCatalogueSectionId('sec_1', [], PKG_SECTIONS)).toBeNull();
  });
});
