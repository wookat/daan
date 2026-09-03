import { describe, it, expect } from 'vitest';
import { mergeAskSessions } from '../src/ask-sessions.js';

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
