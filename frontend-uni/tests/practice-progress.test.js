import { describe, expect, it } from 'vitest';
import { adoptPracticeResume, collectPracticeProgress } from '../src/practice-progress.js';

const q = (id, extra = {}) => ({ id, stem: 's' + id, options: { A: 'a', B: 'b' }, answer: 'A', ...extra });

describe('collectPracticeProgress', () => {
  it('collects qids/picks/excl and clamps counters', () => {
    const items = [q(1, { _picked: 'A' }), q(2, { _excl: ['B', 'D'] }), q(3)];
    const p = collectPracticeProgress(items, 1, 1, 1, 12000, 'yanyu', '逻辑填空');
    expect(p.qids).toEqual([1, 2, 3]);
    expect(p.picks).toEqual({ 1: 'A' });
    expect(p.excl).toEqual({ 2: ['B', 'D'] });
    expect(p.idx).toBe(1);
    expect(p.right).toBe(1);
    expect(p.best_streak).toBe(10000);
    expect(p.module).toBe('yanyu');
  });

  it('drops invalid picked/excl letters, fail-closed on bad items', () => {
    const p = collectPracticeProgress([q(1, { _picked: 'E', _excl: ['A', 'x', 3] })], 0, 0, 0, 0, '', '');
    expect(p.picks).toEqual({});
    expect(p.excl).toEqual({ 1: ['A'] });
    expect(collectPracticeProgress([], 0, 0, 0, 0, '', '')).toBeNull();
    expect(collectPracticeProgress([{ id: 0 }], 0, 0, 0, 0, '', '')).toBeNull();
    expect(collectPracticeProgress([{ stem: 'x' }], 0, 0, 0, 0, '', '')).toBeNull();
    expect(collectPracticeProgress('nope', 0, 0, 0, 0, '', '')).toBeNull();
  });

  it('clamps idx/right/streak into group bounds and rejects negatives', () => {
    const items = [q(1), q(2)];
    const p = collectPracticeProgress(items, 99, -1, 'x', null, 'a', 'b');
    expect(p.idx).toBe(1);
    expect(p.right).toBe(0);
    expect(p.streak).toBe(0);
    expect(p.best_streak).toBe(0);
  });
});

describe('adoptPracticeResume', () => {
  it('applies picks/excl onto items and marks answered as logged', () => {
    const d = {
      items: [q(1), q(2), q(3)],
      picks: { 1: 'A' },
      excl: { '2': ['B', 'D'] },
      idx: 2, right: 1, streak: 1, best_streak: 5,
      module: 'yanyu', submodule: '逻辑填空',
    };
    const s = adoptPracticeResume(d);
    expect(s.items[0]._picked).toBe('A');
    expect(s.items[0]._logged).toBe(true);
    expect(s.items[1]._excl).toEqual(['B', 'D']);
    expect(s.items[1]._logged).toBe(false);
    expect(s.idx).toBe(2);
    expect(s.bestStreak).toBe(5);
    expect(s.module).toBe('yanyu');
  });

  it('fail-closed: empty/malformed payload returns null, bad fields normalized', () => {
    expect(adoptPracticeResume({})).toBeNull();
    expect(adoptPracticeResume(null)).toBeNull();
    expect(adoptPracticeResume({ items: [] })).toBeNull();
    const s = adoptPracticeResume({ items: [q(1)], picks: 'x', excl: 7, idx: 9, right: -1, best_streak: 'z' });
    expect(s.items[0]._picked).toBe('');
    expect(s.items[0]._excl).toEqual([]);
    expect(s.idx).toBe(0);
    expect(s.right).toBe(0);
    expect(s.bestStreak).toBe(0);
  });
});
