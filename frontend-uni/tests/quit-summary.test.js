import { describe, expect, it } from 'vitest';
import { quitSummary } from '../src/quit-summary.js';

const q = (id, answer, picked) => ({ id, answer, _picked: picked || '' });

describe('quitSummary', () => {
  it('中途退出：已答有对有错、仍有未答 → 摘要含错题数', () => {
    const items = [q(1, 'A', 'A'), q(2, 'B', 'C'), q(3, 'C', 'C'), q(4, 'D'), q(5, 'A')];
    expect(quitSummary(items, true)).toEqual({
      done: 3, right: 2, wrong: 1, left: 2, title: '已做 3 题 · 答对 2 · 1 道进错题本',
    });
  });
  it('全对时不带「进错题本」尾句', () => {
    expect(quitSummary([q(1, 'A', 'A'), q(2, 'B')], true).title).toBe('已做 1 题 · 答对 1');
  });
  it('一题未答 → 无需询问', () => {
    expect(quitSummary([q(1, 'A'), q(2, 'B')], true)).toBeNull();
  });
  it('全部已答（完成态）→ 无需询问', () => {
    expect(quitSummary([q(1, 'A', 'A'), q(2, 'B', 'B')], true)).toBeNull();
  });
  it('模考/背题/时政等不适用场景 → null', () => {
    expect(quitSummary([q(1, 'A', 'A'), q(2, 'B')], false)).toBeNull();
  });
  it('空/非数组 → null', () => {
    expect(quitSummary([], true)).toBeNull();
    expect(quitSummary(null, true)).toBeNull();
    expect(quitSummary(undefined, true)).toBeNull();
  });
});
