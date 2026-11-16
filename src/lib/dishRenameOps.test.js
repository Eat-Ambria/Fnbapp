import { describe, it, expect } from 'vitest';
import {
  stableStringify, isEmptyPlainObject, renameOverrideKeys, renameOutsourced,
  ktKeyFor, classifyKtMove, formatMergeWarnings,
} from './dishRenameOps.js';

describe('stableStringify', () => {
  it('ignores key insertion order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });
  it('still distinguishes different content', () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
  });
});

describe('isEmptyPlainObject', () => {
  it('true for {}', () => { expect(isEmptyPlainObject({})).toBe(true); });
  it('false for a non-empty object, an array, or null', () => {
    expect(isEmptyPlainObject({ a: 1 })).toBe(false);
    expect(isEmptyPlainObject([])).toBe(false);
    expect(isEmptyPlainObject(null)).toBe(false);
  });
});

describe('renameOverrideKeys', () => {
  it('no source key present — unchanged', () => {
    const r = renameOverrideKeys({ Other: 'x' }, ['Src'], 'Tgt');
    expect(r.changed).toBe(false);
  });

  it('source only, no target key — renames the key', () => {
    const r = renameOverrideKeys({ Src: 'sec1' }, ['Src'], 'Tgt');
    expect(r.changed).toBe(true);
    expect(r.next).toEqual({ Tgt: 'sec1' });
    expect(r.warning).toBeNull();
  });

  it('target already has the SAME tag — source dropped, no warning', () => {
    const r = renameOverrideKeys({ Src: 'sec1', Tgt: 'sec1' }, ['Src'], 'Tgt');
    expect(r.changed).toBe(true);
    expect(r.next).toEqual({ Tgt: 'sec1' });
    expect(r.warning).toBeNull();
  });

  it('target has a DIFFERENT tag — target wins, source dropped, warning raised', () => {
    const r = renameOverrideKeys({ Src: 'sec1', Tgt: 'sec2' }, ['Src'], 'Tgt');
    expect(r.changed).toBe(true);
    expect(r.next).toEqual({ Tgt: 'sec2' });
    expect(r.warning.kind).toBe('override-target-wins');
    expect(r.warning.dropped).toEqual([{ name: 'Src', tag: 'sec1' }]);
  });

  it('two sources, same tag, no target — merges to one key under target', () => {
    const r = renameOverrideKeys({ SrcA: 'sec1', SrcB: 'sec1' }, ['SrcA', 'SrcB'], 'Tgt');
    expect(r.changed).toBe(true);
    expect(r.next).toEqual({ Tgt: 'sec1' });
    expect(r.warning).toBeNull();
  });

  it('two sources, DIFFERENT tags, no target — ambiguous, unchanged, warning raised', () => {
    const r = renameOverrideKeys({ SrcA: 'sec1', SrcB: 'sec2' }, ['SrcA', 'SrcB'], 'Tgt');
    expect(r.changed).toBe(false);
    expect(r.next).toEqual({ SrcA: 'sec1', SrcB: 'sec2' });
    expect(r.warning.kind).toBe('override-conflict');
  });

  it('the target itself is listed in sources — ignored, never deletes its own key', () => {
    const r = renameOverrideKeys({ Tgt: 'sec1' }, ['Tgt'], 'Tgt');
    expect(r.changed).toBe(false);
  });

  it('non-object input is passed through unchanged', () => {
    expect(renameOverrideKeys(null, ['Src'], 'Tgt').changed).toBe(false);
    expect(renameOverrideKeys(undefined, ['Src'], 'Tgt').changed).toBe(false);
  });
});

describe('renameOutsourced', () => {
  it('no source present — unchanged', () => {
    const r = renameOutsourced(['Other'], ['Src'], 'Tgt', false);
    expect(r.changed).toBe(false);
  });

  it('source present, target not on event — renamed', () => {
    const r = renameOutsourced(['Src'], ['Src'], 'Tgt', false);
    expect(r.changed).toBe(true);
    expect(r.next).toEqual(['Tgt']);
  });

  it('source and target both already in the array — deduped to one entry', () => {
    const r = renameOutsourced(['Src', 'Tgt'], ['Src'], 'Tgt', false);
    expect(r.changed).toBe(true);
    expect(r.next).toEqual(['Tgt']);
  });

  it('target was already selected in-house on this event — source dropped, target not added, warning raised', () => {
    const r = renameOutsourced(['Src'], ['Src'], 'Tgt', true);
    expect(r.changed).toBe(true);
    expect(r.next).toEqual([]);
    expect(r.warning.kind).toBe('outsourced-target-wins');
    expect(r.warning.droppedSources).toEqual(['Src']);
  });

  it('target was already selected in-house, but the array ALSO already lists the target itself — leaves it, still drops source', () => {
    const r = renameOutsourced(['Src', 'Tgt'], ['Src'], 'Tgt', true);
    // target is already in arr, so the "target wins" branch doesn't apply — falls through to plain rename+dedupe
    expect(r.changed).toBe(true);
    expect(r.next).toEqual(['Tgt']);
  });

  it('non-array input is passed through unchanged', () => {
    expect(renameOutsourced(null, ['Src'], 'Tgt', false).changed).toBe(false);
    expect(renameOutsourced(undefined, ['Src'], 'Tgt', false).changed).toBe(false);
  });
});

describe('ktKeyFor', () => {
  it('per-event key', () => {
    expect(ktKeyFor('EVT-1', 'Paneer Tikka')).toBe('EVT-1|Paneer Tikka');
  });
  it('combined-day-bucket key', () => {
    expect(ktKeyFor('__combined_2026-11-16', 'Paneer Tikka')).toBe('dish|Paneer Tikka');
  });
});

describe('classifyKtMove', () => {
  it('no existing target row — move', () => {
    expect(classifyKtMove({ data: { a: 1 } }, null)).toBe('move');
  });
  it('source data is empty — drop-empty-source, even if a target row exists', () => {
    expect(classifyKtMove({ data: {} }, { data: { a: 1 } })).toBe('drop-empty-source');
  });
  it('source and target hold identical data and key_ts (differing only in key order) — already-moved', () => {
    const src = { data: { a: 1, b: 2 }, key_ts: { x: 1, y: 2 } };
    const tgt = { data: { b: 2, a: 1 }, key_ts: { y: 2, x: 1 } };
    expect(classifyKtMove(src, tgt)).toBe('already-moved');
  });
  it('source and target hold genuinely different data — conflict', () => {
    const src = { data: { a: 1 }, key_ts: {} };
    const tgt = { data: { a: 2 }, key_ts: {} };
    expect(classifyKtMove(src, tgt)).toBe('conflict');
  });
  it('missing key_ts on either side defaults to {} for comparison', () => {
    const src = { data: { a: 1 } };
    const tgt = { data: { a: 1 }, key_ts: {} };
    expect(classifyKtMove(src, tgt)).toBe('already-moved');
  });
});

describe('formatMergeWarnings', () => {
  it('empty input renders as empty string', () => {
    expect(formatMergeWarnings([])).toBe('');
    expect(formatMergeWarnings(null)).toBe('');
  });
  it('renders known warning kinds as readable lines', () => {
    const out = formatMergeWarnings([
      { kind: 'kt-conflict', ev_id: 'EVT-1' },
      { kind: 'override-conflict', tags: [] },
    ]);
    expect(out).toContain('EVT-1');
    expect(out.split('\n')).toHaveLength(2);
  });
  it('truncates past the cap with a "…and N more" tail', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ kind: 'kt-conflict', ev_id: 'EVT-' + i }));
    const out = formatMergeWarnings(many, 3);
    const lines = out.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('…and 7 more');
  });
});
