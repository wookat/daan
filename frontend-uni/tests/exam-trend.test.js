import { describe, it, expect } from 'vitest';
import { examTrend } from '../src/exam-trend.js';

const a = (id, score, t = '2026-01-0' + id) => ({ id, score, submitted_at: t, kind: 'zhenti' });

describe('examTrend', () => {
  it('非数组/空/单点返回 null', () => {
    expect(examTrend(null, 70)).toBeNull();
    expect(examTrend([], 70)).toBeNull();
    expect(examTrend([a(1, 50)], 70)).toBeNull();
  });

  it('score 缺失/未交卷条目被过滤', () => {
    const items = [a(3, 60), { id: 2, score: null, submitted_at: 'x' }, { id: 9, score: 50 }, a(1, 40)];
    const r = examTrend(items, null);
    expect(r.points.map((p) => p.id)).toEqual([1, 3]);
  });

  it('DESC 输入反转为正序，best/latest 正确', () => {
    const r = examTrend([a(3, 61.5), a(2, 70), a(1, 50)], null);
    expect(r.points.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(r.best).toBe(70);
    expect(r.latest).toBe(61.5);
  });

  it('cap 截断只取最近 N 条', () => {
    const items = [a(4, 40), a(3, 30), a(2, 20), a(1, 10)];
    const r = examTrend(items, null, 2);
    expect(r.points.map((p) => p.id)).toEqual([3, 4]);
  });

  it('scaleMax 向上取整到 10 且封顶 100', () => {
    expect(examTrend([a(1, 43), a(2, 57)], null).scaleMax).toBe(60);
    expect(examTrend([a(1, 95), a(2, 99)], null).scaleMax).toBe(100);
    expect(examTrend([a(1, 3), a(2, 5)], null).scaleMax).toBe(10);
  });

  it('目标分合法时计入 scaleMax 并给 targetPct', () => {
    const r = examTrend([a(1, 30), a(2, 40)], 70);
    expect(r.scaleMax).toBe(70);
    expect(r.target).toBe(70);
    expect(r.targetPct).toBe(100);
  });

  it('目标非法（0/负/非数字/未设）不画参考线', () => {
    for (const t of [null, undefined, 0, -5, 'abc']) {
      const r = examTrend([a(1, 30), a(2, 40)], t);
      expect(r.target).toBeNull();
      expect(r.targetPct).toBeNull();
    }
  });
});
