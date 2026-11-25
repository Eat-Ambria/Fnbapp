// Tests for overridesWithoutOldPackageLocalIds — see the file header for why
// this exists (a package switch leaving a stale per-event section tag
// pointing at the OLD package's own, now-meaningless local id) and why an
// id is only dropped when the NEW package doesn't also happen to share it.

import { describe, it, expect } from 'vitest';
import { overridesWithoutOldPackageLocalIds } from './menuSectionOverrides.js';

const OLD_PKG_SECTIONS = [
  { id: 'sec_1', name: 'Rice Factory', dishes: [] },
  { id: 'sec_2', name: 'Main Course', dishes: [], subsections: [
    { id: 'sub_1', name: 'Hyderabadi Cuisine', dishes: [] },
  ] },
];

// Deliberately shares NO ids with OLD_PKG_SECTIONS, so the existing "drop"
// tests below are genuinely testing "old-only, not also in new".
const NEW_PKG_SECTIONS = [
  { id: 'sec_9', name: 'Totally Different Package', dishes: [] },
];

describe('overridesWithoutOldPackageLocalIds', () => {
  it('drops an override pointing at an old TOP-LEVEL package section id not also in the new package', () => {
    const r = overridesWithoutOldPackageLocalIds({ 'Pulao': 'sec_1' }, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({});
    expect(r.changed).toBe(true);
  });

  it('drops an override pointing at an old SUBSECTION id not also in the new package', () => {
    const r = overridesWithoutOldPackageLocalIds({ 'Biryani': 'sub_1' }, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({});
    expect(r.changed).toBe(true);
  });

  it('keeps an override pointing at a real catalogue section id untouched', () => {
    const r = overridesWithoutOldPackageLocalIds({ 'Paneer Tikka': 'cat-tandoor' }, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({ 'Paneer Tikka': 'cat-tandoor' });
    expect(r.changed).toBe(false);
  });

  it('keeps an explicit __extras__ override untouched', () => {
    const r = overridesWithoutOldPackageLocalIds({ 'Custom Dish': '__extras__' }, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({ 'Custom Dish': '__extras__' });
    expect(r.changed).toBe(false);
  });

  it('a mix: drops only the stale old-package-local ones, keeps the rest', () => {
    const overrides = { 'Pulao': 'sec_1', 'Biryani': 'sub_1', 'Paneer Tikka': 'cat-tandoor', 'Custom Dish': '__extras__' };
    const r = overridesWithoutOldPackageLocalIds(overrides, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({ 'Paneer Tikka': 'cat-tandoor', 'Custom Dish': '__extras__' });
    expect(r.changed).toBe(true);
  });

  it('no overrides at all is a no-op', () => {
    const r = overridesWithoutOldPackageLocalIds({}, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({});
    expect(r.changed).toBe(false);
  });

  it('null/undefined overrides or package section lists never throw', () => {
    expect(overridesWithoutOldPackageLocalIds(null, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS).overrides).toEqual({});
    expect(overridesWithoutOldPackageLocalIds(undefined, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS).overrides).toEqual({});
    expect(overridesWithoutOldPackageLocalIds({ 'Pulao': 'sec_1' }, null, NEW_PKG_SECTIONS).overrides).toEqual({ 'Pulao': 'sec_1' });
    expect(overridesWithoutOldPackageLocalIds({ 'Pulao': 'sec_1' }, undefined, undefined).changed).toBe(false);
  });

  it('never mutates the input overrides object', () => {
    const overrides = { 'Pulao': 'sec_1', 'Paneer Tikka': 'cat-tandoor' };
    const before = JSON.stringify(overrides);
    overridesWithoutOldPackageLocalIds(overrides, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(JSON.stringify(overrides)).toBe(before);
  });

  // --- Caught by adversarial review ---

  it('keeps a tag whose id is in BOTH the old and the new package — package-local ids are not always unique across packages (duplicatePackage keeps subsection ids; derived default sections can independently collide between two never-edited packages)', () => {
    const sharedNew = [{ id: 'sec_9', name: 'New Package', dishes: [], subsections: [{ id: 'sub_1', name: 'Shared Subsection' }] }];
    const r = overridesWithoutOldPackageLocalIds({ 'Biryani': 'sub_1' }, OLD_PKG_SECTIONS, sharedNew);
    expect(r.overrides).toEqual({ 'Biryani': 'sub_1' });
    expect(r.changed).toBe(false);
  });

  it('a stale "<id>__unplaced" tag is dropped the same as the bare id, by stripping the suffix before matching', () => {
    const r = overridesWithoutOldPackageLocalIds({ 'Pulao': 'sec_1__unplaced' }, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({});
    expect(r.changed).toBe(true);
  });

  it('a "<id>__unplaced" tag whose id is shared with the new package is kept, suffix included', () => {
    const sharedNew = [{ id: 'sec_1', name: 'New Package', dishes: [] }];
    const r = overridesWithoutOldPackageLocalIds({ 'Pulao': 'sec_1__unplaced' }, OLD_PKG_SECTIONS, sharedNew);
    expect(r.overrides).toEqual({ 'Pulao': 'sec_1__unplaced' });
    expect(r.changed).toBe(false);
  });

  it('a null/undefined entry inside either package sections array never throws', () => {
    const withNulls = [null, undefined, { id: 'sec_1', name: 'Rice Factory', dishes: [] }];
    expect(() => overridesWithoutOldPackageLocalIds({ 'Pulao': 'sec_1' }, withNulls, NEW_PKG_SECTIONS)).not.toThrow();
    const r = overridesWithoutOldPackageLocalIds({ 'Pulao': 'sec_1' }, withNulls, NEW_PKG_SECTIONS);
    expect(r.changed).toBe(true);
  });

  it('an empty old-package section list (or the old package no longer existing) is a no-op — nothing to drop', () => {
    const r = overridesWithoutOldPackageLocalIds({ 'Pulao': 'sec_1', 'Paneer Tikka': 'cat-tandoor' }, [], NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({ 'Pulao': 'sec_1', 'Paneer Tikka': 'cat-tandoor' });
    expect(r.changed).toBe(false);
  });

  // --- Multi-section tags (array-valued overrides) ---

  it('a multi-section tag keeps only the ids that survive, as an array, dropping just the stale one', () => {
    const r = overridesWithoutOldPackageLocalIds({ 'Steam Rice': ['sec_1', 'cat-driver-food'] }, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({ 'Steam Rice': ['cat-driver-food'] });
    expect(r.changed).toBe(true);
  });

  it('a multi-section tag with every id still valid is kept as the same array, unchanged', () => {
    const r = overridesWithoutOldPackageLocalIds({ 'Steam Rice': ['cat-driver-food', 'cat-tandoor'] }, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({ 'Steam Rice': ['cat-driver-food', 'cat-tandoor'] });
    expect(r.changed).toBe(false);
  });

  it('a multi-section tag where every id goes stale drops the whole dish, same as a scalar tag going stale', () => {
    const r = overridesWithoutOldPackageLocalIds({ 'Steam Rice': ['sec_1', 'sub_1'] }, OLD_PKG_SECTIONS, NEW_PKG_SECTIONS);
    expect(r.overrides).toEqual({});
    expect(r.changed).toBe(true);
  });
});
