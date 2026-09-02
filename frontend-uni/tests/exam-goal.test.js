import { describe, it, expect } from 'vitest';
import { goalGap, prevScoreDelta } from '../src/exam-goal.js';

describe('goalGap', () => {
  it('缺目标/缺分数返回 null', () => {
    expect(goalGap(null, 70)).toBeNull();
    expect(goalGap(60, null)).toBeNull();
    expect(goalGap(undefined, undefined)).toBeNull();
  });
  it('目标非法（0/负/非数字）返回 null', () => {
    expect(goalGap(60, 0)).toBeNull();
    expect(goalGap(60, -5)).toBeNull();
    expect(goalGap(60, 'abc')).toBeNull();
  });
  it('未达标返回正 gap（1 位小数）', () => {
    expect(goalGap(61.3, 70)).toEqual({ target: 70, gap: 8.7 });
  });
  it('达标/超额返回 0 或负 gap', () => {
    expect(goalGap(70, 70)).toEqual({ target: 70, gap: 0 });
    expect(goalGap(75.5, 70)).toEqual({ target: 70, gap: -5.5 });
  });
  it('数字字符串目标可解析', () => {
    expect(goalGap(60, '70')).toEqual({ target: 70, gap: 10 });
  });
});

describe('prevScoreDelta', () => {
  const h = [
    { id: 1, score: 50 },
    { id: 2, score: 61.5 },
    { id: 3, score: 61.5 },
  ];
  it('非数组/空/未命中返回 null', () => {
    expect(prevScoreDelta(null, 2)).toBeNull();
    expect(prevScoreDelta([], 2)).toBeNull();
    expect(prevScoreDelta(h, 99)).toBeNull();
    expect(prevScoreDelta(h, null)).toBeNull();
  });
  it('首次 attempt 无前次返回 null', () => {
    expect(prevScoreDelta(h, 1)).toBeNull();
  });
  it('有前次返回 prev 与 delta（1 位小数）', () => {
    expect(prevScoreDelta(h, 2)).toEqual({ prev: 50, delta: 11.5 });
  });
  it('持平 delta 为 0', () => {
    expect(prevScoreDelta(h, 3)).toEqual({ prev: 61.5, delta: 0 });
  });
  it('前次 score 缺失返回 null', () => {
    expect(prevScoreDelta([{ id: 1 }, { id: 2, score: 60 }], 2)).toBeNull();
  });
});
