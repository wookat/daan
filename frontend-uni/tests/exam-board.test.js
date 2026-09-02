import { describe, it, expect } from 'vitest';
import { examBoardRows } from '../src/exam-board.js';

const rank = (over = {}) => ({
  rank: 5,
  score: 42.5,
  total: 12,
  board: [
    { rank: 1, name: '小明', score: 88, me: false },
    { rank: 2, name: 'abcdef***', score: 70, me: false },
    { rank: 3, name: 'ghijkl***', score: 55, me: false }
  ],
  ...over
});

describe('examBoardRows', () => {
  it('缺 rank/board 返回 null', () => {
    expect(examBoardRows(null)).toBeNull();
    expect(examBoardRows({})).toBeNull();
    expect(examBoardRows(rank({ board: null }))).toBeNull();
  });

  it('样本 <2 返回 null（不伪造社会证明）', () => {
    expect(examBoardRows(rank({ board: [{ rank: 1, name: 'x', score: 9, me: true }] }))).toBeNull();
    expect(examBoardRows(rank({ board: [] }))).toBeNull();
  });

  it('保留后端顺序并归一化字段', () => {
    const rows = examBoardRows(rank());
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 5]);
    expect(rows[0]).toEqual({ rank: 1, name: '小明', score: 88, me: false });
  });

  it('本人不在前十时追加「我」行', () => {
    const rows = examBoardRows(rank());
    expect(rows[rows.length - 1]).toEqual({ rank: 5, name: '我', score: 42.5, me: true });
  });

  it('本人已在榜内不重复追加', () => {
    const r = rank();
    r.board[1].me = true;
    const rows = examBoardRows(r);
    expect(rows.filter((x) => x.me)).toHaveLength(1);
    expect(rows).toHaveLength(3);
  });

  it('本人 rank/score 非法时不追加「我」行', () => {
    expect(examBoardRows(rank({ rank: 0 }))).toHaveLength(3);
    expect(examBoardRows(rank({ score: null }))).toHaveLength(3);
  });

  it('过滤非法分数行；剩余 <2 则不渲染', () => {
    const r = rank();
    r.board[0].score = 'oops';
    expect(examBoardRows(r)).toHaveLength(3); // 2 榜内 + 我
    expect(
      examBoardRows(rank({ board: [{ rank: 1, name: 'a', score: NaN, me: false }, { rank: 2, name: 'b', score: 5, me: false }] }))
    ).toBeNull();
  });

  it('不修改输入对象', () => {
    const r = rank();
    const snapshot = JSON.stringify(r);
    examBoardRows(r);
    expect(JSON.stringify(r)).toBe(snapshot);
  });
});
