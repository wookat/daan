import { describe, it, expect } from 'vitest';
import { weakModule } from '../src/exam-weak.js';

const row = (key, pct, avgPct, n = 10, name = key + '名') => ({ key, name, n, correct: 0, pct, avgPct });

describe('weakModule（R307 薄弱模块判定 fail-closed）', () => {
  it('非数组/空/全不合格 → null', () => {
    expect(weakModule(null)).toBe(null);
    expect(weakModule([])).toBe(null);
    expect(weakModule([row('xingce_unknown', 10, 80)])).toBe(null);
    expect(weakModule([row('yanyu', 10, 80, 2)])).toBe(null);
    expect(weakModule([{ key: 'yanyu', name: 'x', n: 'a', pct: 10, avgPct: 80 }])).toBe(null);
    expect(weakModule([row('yanyu', NaN, 80)])).toBe(null);
    expect(weakModule([row('yanyu', 101, 80)])).toBe(null);
  });

  it('主判：低于全站 ≥5pt 且差距最大者', () => {
    const r = weakModule([row('yanyu', 50, 60), row('panduan', 40, 70), row('ziliao', 80, 82)]);
    expect(r).toEqual({ key: 'panduan', name: 'panduan名', reason: '低于全站均值 30 个百分点' });
  });

  it('差距 5pt 边界：恰好 5 命中、4.9 不命中主判', () => {
    expect(weakModule([row('yanyu', 55, 60)]).reason).toBe('低于全站均值 5 个百分点');
    expect(weakModule([row('yanyu', 70, 74.9)])).toBe(null);
  });

  it('avgPct 非法时走兜底：最低 pct 且 <60', () => {
    const r = weakModule([row('yanyu', 55, null), row('shuliang', 30, NaN), row('changshi', 90, undefined)]);
    expect(r).toEqual({ key: 'shuliang', name: 'shuliang名', reason: '本卷正确率 30%，全卷最低' });
  });

  it('兜底 60% 边界：最低 60 不渲染', () => {
    expect(weakModule([row('yanyu', 60, null), row('panduan', 95, null)])).toBe(null);
  });

  it('name 缺失回落 key；不修改入参', () => {
    const input = [{ key: 'ziliao', n: 4, correct: 0, pct: 0, avgPct: 50 }];
    const snapshot = JSON.stringify(input);
    const r = weakModule(input);
    expect(r.name).toBe('ziliao');
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
