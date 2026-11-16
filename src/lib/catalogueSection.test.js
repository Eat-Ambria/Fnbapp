// Tests for resolveOverrideToCatalogueSectionId / buildOverrideResolver /
// packageCatalogueLinkFor — the translation from "whatever a placement chip
// handed back" (a real catalogue id, a package section id, a package
// SUBSECTION id, or an "<id>__unplaced" id) to "a verified dish_catalogue_
// sections id, or null". This is the ONLY implementation of this resolution
// — EventMenuBuilderView.jsx's effectiveSectionIdByDish calls
// buildOverrideResolver directly instead of keeping its own copy.

import { describe, it, expect } from 'vitest';
import { resolveOverrideToCatalogueSectionId, buildOverrideResolver, packageCatalogueLinkFor } from './catalogueSection.js';

const CATALOGUE = [
  { id: 'cat-chaat', name: 'Chaat Station' },
  { id: 'cat-tandoor', name: 'Tandoori Snacks' },
];

const PKG_SECTIONS = [
  { id: 'sec_1', name: 'Chatori Chaat', catalogue_section_id: 'cat-chaat' },
  { id: 'sec_2', name: 'Unlinked Section' }, // no catalogue_section_id
  { id: 'sec_3', name: 'Stale Link', catalogue_section_id: 'cat-does-not-exist' },
  // A section whose subsections exercise every fallback case:
  // sub_1 linked directly to a DIFFERENT catalogue section than its parent
  // (its own link wins); sub_2 unlinked (falls back to the parent's link).
  { id: 'sec_4', name: 'Has Subsections', catalogue_section_id: 'cat-chaat', subsections: [
    { id: 'sub_1', name: 'Own Link', catalogue_section_id: 'cat-tandoor' },
    { id: 'sub_2', name: 'No Own Link' },
  ] },
  // sub_4's parent (sec_2) is itself unlinked, so sub_4 has nothing to fall
  // back to either.
  { id: 'sec_2b', name: 'Unlinked Parent', subsections: [{ id: 'sub_4', name: 'Also Unlinked' }] },
  // sub_5 has no own link AND a sales_dept different from its kit-dept
  // parent — must NOT inherit the parent's link (a different-department
  // subsection almost certainly belongs to a different catalogue section).
  { id: 'sec_5', name: 'Kit Parent', sales_dept: 'kit', catalogue_section_id: 'cat-chaat', subsections: [
    { id: 'sub_5', name: 'Bev Subsection', sales_dept: 'bev' },
  ] },
  // sub_6 has its OWN link, but it's stale — must resolve null, never fall
  // back to its (validly-linked) parent.
  { id: 'sec_6', name: 'Linked Parent', catalogue_section_id: 'cat-chaat', subsections: [
    { id: 'sub_6', name: 'Stale Own Link', catalogue_section_id: 'cat-does-not-exist' },
  ] },
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

  it('a top-level section with subsections still resolves to its OWN link directly', () => {
    expect(resolveOverrideToCatalogueSectionId('sec_4', CATALOGUE, PKG_SECTIONS)).toBe('cat-chaat');
  });

  it('a subsection with its own catalogue link resolves through ITS link, not its parent\'s', () => {
    expect(resolveOverrideToCatalogueSectionId('sub_1', CATALOGUE, PKG_SECTIONS)).toBe('cat-tandoor');
  });

  it('a subsection with no link of its own falls back to its parent\'s link', () => {
    expect(resolveOverrideToCatalogueSectionId('sub_2', CATALOGUE, PKG_SECTIONS)).toBe('cat-chaat');
  });

  it('a subsection whose parent is ALSO unlinked resolves to null', () => {
    expect(resolveOverrideToCatalogueSectionId('sub_4', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('a subsection routed to a DIFFERENT department than its parent does not inherit the parent\'s link', () => {
    expect(resolveOverrideToCatalogueSectionId('sub_5', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('a subsection with its OWN stale link resolves to null, never falling back to a validly-linked parent', () => {
    expect(resolveOverrideToCatalogueSectionId('sub_6', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('a package section with no catalogue_section_id resolves to null (no name fallback here)', () => {
    expect(resolveOverrideToCatalogueSectionId('sec_2', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('a package section linked to an unknown/stale catalogue id resolves to null', () => {
    expect(resolveOverrideToCatalogueSectionId('sec_3', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('"<topLevelId>__unplaced" resolves exactly like the bare top-level id', () => {
    expect(resolveOverrideToCatalogueSectionId('sec_1__unplaced', CATALOGUE, PKG_SECTIONS)).toBe('cat-chaat');
    expect(resolveOverrideToCatalogueSectionId('cat-chaat__unplaced', CATALOGUE, PKG_SECTIONS)).toBe('cat-chaat');
  });

  it('"<subsectionId>__unplaced" resolves exactly like the bare subsection id — useMenuItemGrouping.js builds these too, not only from top-level ids', () => {
    expect(resolveOverrideToCatalogueSectionId('sub_1__unplaced', CATALOGUE, PKG_SECTIONS)).toBe('cat-tandoor');
    expect(resolveOverrideToCatalogueSectionId('sub_2__unplaced', CATALOGUE, PKG_SECTIONS)).toBe('cat-chaat');
  });

  it('"<id>__unplaced" for an unlinked or unknown id resolves to null', () => {
    expect(resolveOverrideToCatalogueSectionId('sec_2__unplaced', CATALOGUE, PKG_SECTIONS)).toBeNull();
    expect(resolveOverrideToCatalogueSectionId('nope__unplaced', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('an id matching neither catalogue nor package sections resolves to null (e.g. a SOP category id)', () => {
    expect(resolveOverrideToCatalogueSectionId('curry', CATALOGUE, PKG_SECTIONS)).toBeNull();
  });

  it('an empty catalogue list makes everything resolve to null, never garbage', () => {
    expect(resolveOverrideToCatalogueSectionId('cat-chaat', [], PKG_SECTIONS)).toBeNull();
    expect(resolveOverrideToCatalogueSectionId('sec_1', [], PKG_SECTIONS)).toBeNull();
    expect(resolveOverrideToCatalogueSectionId('sub_1', [], PKG_SECTIONS)).toBeNull();
  });
});

describe('buildOverrideResolver', () => {
  // resolveOverrideToCatalogueSectionId is DEFINED as buildOverrideResolver(...)
  // (rawId), so comparing them can only prove they're wired together, not that
  // either is correct — assert real expected values here instead.
  it('resolves a batch of ids against explicit expected values, built once and reused', () => {
    var resolve = buildOverrideResolver(CATALOGUE, PKG_SECTIONS);
    expect(resolve('cat-chaat')).toBe('cat-chaat');
    expect(resolve('sec_1')).toBe('cat-chaat');
    expect(resolve('sub_1')).toBe('cat-tandoor');
    expect(resolve('sub_2')).toBe('cat-chaat');
    expect(resolve('sub_4')).toBeNull();
    expect(resolve('sub_5')).toBeNull();
    expect(resolve('sec_2')).toBeNull();
    expect(resolve('sec_3')).toBeNull();
    expect(resolve('sec_1__unplaced')).toBe('cat-chaat');
    expect(resolve('curry')).toBeNull();
    expect(resolve('__extras__')).toBeNull();
    expect(resolve('')).toBeNull();
  });
});

describe('packageCatalogueLinkFor', () => {
  it('returns a subsection\'s own link', () => {
    expect(packageCatalogueLinkFor('sub_1', PKG_SECTIONS)).toBe('cat-tandoor');
  });

  it('falls back to the parent\'s link when the subsection has none', () => {
    expect(packageCatalogueLinkFor('sub_2', PKG_SECTIONS)).toBe('cat-chaat');
  });

  it('does not fall back to the parent\'s link when the subsection is routed to a different department', () => {
    expect(packageCatalogueLinkFor('sub_5', PKG_SECTIONS)).toBeNull();
  });

  it('returns the raw link even when it is stale/unverified — this helper does not check a catalogue list', () => {
    expect(packageCatalogueLinkFor('sec_3', PKG_SECTIONS)).toBe('cat-does-not-exist');
  });

  it('resolves "<id>__unplaced" the same as the bare id', () => {
    expect(packageCatalogueLinkFor('sec_1__unplaced', PKG_SECTIONS)).toBe('cat-chaat');
  });

  it('returns null for __extras__, empty input, and an id with no link', () => {
    expect(packageCatalogueLinkFor('__extras__', PKG_SECTIONS)).toBeNull();
    expect(packageCatalogueLinkFor('', PKG_SECTIONS)).toBeNull();
    expect(packageCatalogueLinkFor('sec_2', PKG_SECTIONS)).toBeNull();
  });
});
