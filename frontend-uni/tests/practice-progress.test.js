import { describe, expect, it } from 'vitest';
import { adoptPracticeResume, collectPracticeProgress, parsePendingPractice, parseRemotePractice } from '../src/practice-progress.js';

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

describe('parsePendingPractice（R323 首页续练卡·本机快照）', () => {
  const now = 1700000000000;
  const items = [
    { id: 1, _picked: 'A' },
    { id: 2, _picked: '' },
    { id: 3 },
  ];

  it('有效快照返回 done/total/module', () => {
    const r = parsePendingPractice({ t: now - 1000, items, lastModule: 'yanyu' }, now);
    expect(r).toEqual({ done: 1, total: 3, module: 'yanyu' });
  });

  it('fail-closed：空/无 items/超 24h/全部已答返回 null', () => {
    expect(parsePendingPractice(null, now)).toBeNull();
    expect(parsePendingPractice({ t: now, items: [] }, now)).toBeNull();
    expect(parsePendingPractice({ t: now - 25 * 3600 * 1000, items }, now)).toBeNull();
    expect(parsePendingPractice({ t: 'bad', items }, now)).toBeNull();
    expect(parsePendingPractice({ t: now, items: [{ id: 1, _picked: 'A' }] }, now)).toBeNull();
  });

  it('lastModule 非字符串回落空串', () => {
    const r = parsePendingPractice({ t: now, items, lastModule: 7 }, now);
    expect(r.module).toBe('');
  });
});

describe('parseRemotePractice（R323 首页续练卡·服务端应答）', () => {
  it('有效应答返回 done/total/module（picks 字符串键兼容）', () => {
    const d = { items: [{ id: 1 }, { id: 2 }, { id: 3 }], picks: { 1: 'A', '3': 'B' }, module: 'ziliao' };
    expect(parseRemotePractice(d)).toEqual({ done: 2, total: 3, module: 'ziliao' });
  });

  it('fail-closed：空/无 items/全部已答返回 null', () => {
    expect(parseRemotePractice(null)).toBeNull();
    expect(parseRemotePractice({})).toBeNull();
    expect(parseRemotePractice({ items: [] })).toBeNull();
    expect(parseRemotePractice({ items: [{ id: 1 }], picks: { 1: 'A' } })).toBeNull();
  });

  it('picks 非对象按无作答处理、module 非字符串回落空串', () => {
    const d = { items: [{ id: 1 }], picks: 'x', module: null };
    expect(parseRemotePractice(d)).toEqual({ done: 0, total: 1, module: '' });
  });
});
