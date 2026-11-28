// Tests for dishSections.js — the shared dish <-> catalogue section
// membership helpers (true many-to-many, no stored "primary" column).

import { describe, it, expect, vi } from 'vitest';

var inRows = [];
vi.mock('./supabase.js', () => ({
  supabase: {
    from() {
      return {
        select() {
          return {
            in() { return Promise.resolve({ data: inRows, error: null }); },
          };
        },
      };
    },
  },
}));

const { buildDishSectionsMap, primarySectionFor, sectionIdsFor, fetchDishNamesInSections } = await import('./dishSections.js');

describe('buildDishSectionsMap', () => {
  it('groups rows by dish name', () => {
    const rows = [
      { dish_name: 'Steam Rice', section_id: 'sec-rice', sort_order: 10, created_at: '2026-01-01T00:00:00Z' },
      { dish_name: 'Papad', section_id: 'sec-main', sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
      { dish_name: 'Papad', section_id: 'sec-apc', sort_order: 0, created_at: '2026-01-02T00:00:00Z' },
    ];
    const map = buildDishSectionsMap(rows);
    expect(Object.keys(map).sort()).toEqual(['Papad', 'Steam Rice']);
    expect(map['Papad'].length).toBe(2);
    expect(map['Steam Rice'].length).toBe(1);
  });

  it('sorts each dish\'s own rows by created_at ascending', () => {
    const rows = [
      { dish_name: 'Papad', section_id: 'sec-later', sort_order: 0, created_at: '2026-02-01T00:00:00Z' },
      { dish_name: 'Papad', section_id: 'sec-earlier', sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
    ];
    const map = buildDishSectionsMap(rows);
    expect(map['Papad'][0].section_id).toBe('sec-earlier');
    expect(map['Papad'][1].section_id).toBe('sec-later');
  });

  it('ignores a row missing dish_name or section_id', () => {
    const rows = [{ dish_name: '', section_id: 'x' }, { dish_name: 'Y', section_id: '' }, null];
    expect(buildDishSectionsMap(rows)).toEqual({});
  });

  it('returns {} for empty/undefined input', () => {
    expect(buildDishSectionsMap([])).toEqual({});
    expect(buildDishSectionsMap(undefined)).toEqual({});
  });
});

describe('primarySectionFor', () => {
  it('returns the earliest-created membership\'s section id', () => {
    const map = buildDishSectionsMap([
      { dish_name: 'Papad', section_id: 'sec-apc', sort_order: 0, created_at: '2026-01-02T00:00:00Z' },
      { dish_name: 'Papad', section_id: 'sec-main', sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(primarySectionFor('Papad', map)).toBe('sec-main');
  });

  it('returns null for a dish with no memberships', () => {
    expect(primarySectionFor('Unmapped Dish', {})).toBeNull();
  });
});

describe('sectionIdsFor', () => {
  it('returns every section id a dish belongs to, tie-break order first', () => {
    const map = buildDishSectionsMap([
      { dish_name: 'Papad', section_id: 'sec-apc', sort_order: 0, created_at: '2026-01-02T00:00:00Z' },
      { dish_name: 'Papad', section_id: 'sec-main', sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(sectionIdsFor('Papad', map)).toEqual(['sec-main', 'sec-apc']);
  });

  it('returns an empty array, never null, for a dish with no memberships', () => {
    expect(sectionIdsFor('Unmapped Dish', {})).toEqual([]);
  });
});

describe('fetchDishNamesInSections', () => {
  it('returns [] without querying when given no ids', async () => {
    inRows = [{ dish_name: 'Should not appear' }];
    expect(await fetchDishNamesInSections([])).toEqual([]);
    expect(await fetchDishNamesInSections(null)).toEqual([]);
  });

  it('dedupes dish names appearing under more than one matched section', async () => {
    inRows = [{ dish_name: 'Papad' }, { dish_name: 'Papad' }, { dish_name: 'Steam Rice' }];
    const names = await fetchDishNamesInSections(['sec-main', 'sec-apc']);
    expect(names).toEqual(['Papad', 'Steam Rice']);
  });

  it('filters out falsy ids before deciding whether there is anything to query', async () => {
    inRows = [];
    expect(await fetchDishNamesInSections([null, undefined, ''])).toEqual([]);
  });
});
