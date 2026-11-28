// Tests for buildDishMasterMap — specifically the linkRows contract that
// PublicFPHub.jsx silently broke (2026-11-28): calling it with only ONE
// argument (dish_section_links omitted) makes every dish resolve to no
// catalogue section at all, no error anywhere, so the Public FP Hub quietly
// drifted out of step with the authenticated in-app FP view. A guard in the
// function now console.errors when linkRows is specifically `undefined`
// (the caller forgot it) but stays silent for an explicitly-passed `[]`
// (the dataset genuinely has no memberships yet) — these tests pin both the
// warning and the actual section_id/section_ids behavior in each case.

import { describe, it, expect, vi } from 'vitest';
import { buildDishMasterMap } from './dbConfig.js';

const ROWS = [{ dish_name: 'Paneer Tikka', is_active: true }];
const LINKS = [{ dish_name: 'Paneer Tikka', section_id: 'sec-starters', sort_order: 0, created_at: '2026-01-01T00:00:00Z' }];

describe('buildDishMasterMap', () => {
  it('bakes in section_id/section_ids from linkRows when passed', () => {
    const map = buildDishMasterMap(ROWS, LINKS);
    expect(map['Paneer Tikka'].section_id).toBe('sec-starters');
    expect(map['Paneer Tikka'].section_ids).toEqual(['sec-starters']);
  });

  it('an explicit empty array (genuinely no memberships) resolves to no section, silently', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const map = buildDishMasterMap(ROWS, []);
    expect(map['Paneer Tikka'].section_id).toBe(null);
    expect(map['Paneer Tikka'].section_ids).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('omitting linkRows entirely warns loudly — the exact mistake PublicFPHub.jsx made', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const map = buildDishMasterMap(ROWS);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatch(/buildDishMasterMap.*linkRows/i);
    // Still produces a result (never throws) -- just a silently-wrong one
    // without the warning, which is exactly the point of the guard.
    expect(map['Paneer Tikka'].section_id).toBe(null);
    expect(map['Paneer Tikka'].section_ids).toEqual([]);
    spy.mockRestore();
  });
});
