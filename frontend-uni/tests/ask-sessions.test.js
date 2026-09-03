import { describe, it, expect } from 'vitest';
import { mergeAskSessions, upsertLocalSession } from '../src/ask-sessions.js';

const s = (id, ts = id) => ({ id, ts, title: 't' + id, n: 1, items: [{ q: 'x' }] });

describe('mergeAskSessions', () => {
  it('unions by id with local priority', () => {
    const local = [{ ...s(1), title: '本机版' }];
    const remote = [{ ...s(1), title: '远端版' }, s(2)];
    const out = mergeAskSessions(local, remote);
    expect(out.map((x) => x.id)).toEqual([2, 1]);
    expect(out.find((x) => x.id === 1).title).toBe('本机版');
  });

  it('sorts by ts desc then id desc', () => {
    const out = mergeAskSessions([s(1, 100), s(2, 300)], [s(3, 200), s(4, 300)]);
    expect(out.map((x) => x.id)).toEqual([4, 2, 3, 1]);
  });

  it('caps at 20', () => {
    const local = Array.from({ length: 15 }, (_, i) => s(i + 1));
    const remote = Array.from({ length: 15 }, (_, i) => s(i + 100));
    expect(mergeAskSessions(local, remote)).toHaveLength(20);
  });

  it('fails closed on invalid inputs', () => {
    expect(mergeAskSessions(null, undefined)).toEqual([]);
    expect(mergeAskSessions('x', 5)).toEqual([]);
    const out = mergeAskSessions(
      [s(1), { id: 0, ts: 1, items: [{}] }, { id: 2, ts: 2 }, { id: true, ts: 3, items: [{}] }],
      [{ id: 3, ts: 3, items: [] }, s(4)],
    );
    expect(out.map((x) => x.id)).toEqual([4, 1]);
  });
});

describe('upsertLocalSession', () => {
  it('dedupes same id and moves to front', () => {
    const list = [s(1, 100), s(2, 200)];
    const out = upsertLocalSession(list, { ...s(2, 300), n: 5 });
    expect(out.map((x) => x.id)).toEqual([2, 1]);
    expect(out[0].n).toBe(5);
    expect(list.map((x) => x.id)).toEqual([1, 2]); // 输入不可变
  });

  it('prepends new id and caps at 20', () => {
    const list = Array.from({ length: 20 }, (_, i) => s(i + 1));
    const out = upsertLocalSession(list, s(999));
    expect(out).toHaveLength(20);
    expect(out[0].id).toBe(999);
  });

  it('fails closed on invalid inputs', () => {
    expect(upsertLocalSession(null, s(1)).map((x) => x.id)).toEqual([1]);
    expect(upsertLocalSession([s(1)], { id: 0, ts: 1, items: [{}] }).map((x) => x.id)).toEqual([1]);
    expect(upsertLocalSession([s(1), { id: 2, ts: 2 }], null).map((x) => x.id)).toEqual([1]);
  });
});

import { addTombstone, removeTombstone, pruneTombstones, filterTombstoned, sanitizeCurItems } from '../src/ask-sessions.js';

describe('tombstones (R330)', () => {
  it('adds, removes, and normalizes invalid inputs', () => {
    const t1 = addTombstone(null, 5, 100);
    expect(t1).toEqual({ 5: 100 });
    expect(addTombstone(t1, -1, 100)).toEqual({ 5: 100 });
    expect(addTombstone([1, 2], 7, 50)).toEqual({ 7: 50 });
    expect(removeTombstone(t1, 5)).toEqual({});
    expect(t1).toEqual({ 5: 100 });
    expect(addTombstone({ bad: 'x', 3: -1, 4: 'y', 6: 60 }, 8, 80)).toEqual({ 6: 60, 8: 80 });
  });

  it('caps at 40 dropping oldest', () => {
    let t = {};
    for (let i = 1; i <= 41; i++) t = addTombstone(t, i, i);
    expect(Object.keys(t)).toHaveLength(40);
    expect(t[1]).toBeUndefined();
    expect(t[41]).toBe(41);
  });

  it('prunes entries older than 7 days', () => {
    const now = 10 * 24 * 3600 * 1000;
    const t = { 1: now - 8 * 24 * 3600 * 1000, 2: now - 3600 * 1000 };
    expect(pruneTombstones(t, now)).toEqual({ 2: now - 3600 * 1000 });
    expect(pruneTombstones('junk', now)).toEqual({});
  });

  it('filters tombstoned sessions fail-closed', () => {
    const list = [s(1, 100), s(2, 200)];
    expect(filterTombstoned(list, { 2: 50 }).map((x) => x.id)).toEqual([1]);
    expect(filterTombstoned(list, null).map((x) => x.id)).toEqual([1, 2]);
    expect(filterTombstoned('junk', { 1: 1 })).toEqual([]);
    expect(list).toHaveLength(2);
  });
});

describe('sanitizeCurItems (R331)', () => {
  it('keeps only items with non-empty explanation', () => {
    const items = [
      { explanation: '解析A', fu: [] },
      { explanation: '' },
      { explanation: 42 },
      null,
      'junk',
      [1],
      { explanation: '解析B', saved: true },
    ];
    expect(sanitizeCurItems(items).map((r) => r.explanation)).toEqual(['解析A', '解析B']);
    expect(items).toHaveLength(7);
  });

  it('fail-closed on invalid input', () => {
    expect(sanitizeCurItems(null)).toEqual([]);
    expect(sanitizeCurItems('junk')).toEqual([]);
    expect(sanitizeCurItems({ 0: { explanation: 'x' } })).toEqual([]);
  });
});
