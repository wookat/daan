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

  it('W9-B 已答口径：整模块未答（answered=0）永不判薄弱，即使 pct=0 且 n≥3', () => {
    expect(weakModule([{ key: 'shuliang', name: '数量', n: 20, answered: 0, correct: 0, pct: 0, avgPct: null }])).toBe(null);
    expect(weakModule([{ key: 'shuliang', name: '数量', n: 20, answered: 0, correct: 0, pct: 0, avgPct: 60 }])).toBe(null);
    expect(weakModule([{ key: 'shuliang', name: '数量', n: 20, answered: 0, correct: 0, pct: 0, ansPct: 0, avgPct: 60 }])).toBe(null);
  });

  it('W9-B 已答口径：部分作答按 correct/answered 判定（3/3 全对不判薄弱，全卷 pct 15 不参与）', () => {
    expect(weakModule([{ key: 'yanyu', name: '言语', n: 20, answered: 3, correct: 3, pct: 15, avgPct: 70 }])).toBe(null);
    expect(weakModule([{ key: 'yanyu', name: '言语', n: 20, answered: 3, correct: 3, pct: 15, avgPct: null }])).toBe(null);
    // report.vue 传入 ansPct 时优先用 ansPct
    expect(weakModule([{ key: 'yanyu', name: '言语', n: 20, answered: 3, correct: 3, pct: 15, ansPct: 100, avgPct: 70 }])).toBe(null);
  });

  it('W9-B 已答口径：answered<MIN_N 不判；兜底文案按已答口径并附折算说明（与 paceRows refNote 同写法）', () => {
    expect(weakModule([{ key: 'ziliao', name: '资料', n: 20, answered: 2, correct: 0, pct: 0, avgPct: null }])).toBe(null);
    const r = weakModule([{ key: 'ziliao', name: '资料', n: 20, answered: 5, correct: 1, pct: 5, avgPct: null }]);
    expect(r).toEqual({ key: 'ziliao', name: '资料', reason: '本卷正确率 20%，全卷最低（按已答 5/20 题折算）' });
    // 全部作答（answered==n）不附折算说明
    const full = weakModule([{ key: 'ziliao', name: '资料', n: 5, answered: 5, correct: 1, pct: 20, avgPct: null }]);
    expect(full.reason).toBe('本卷正确率 20%，全卷最低');
    // 主判 gap 也按已答口径：3/10 已答 30% vs 全站 60 → 差 30，而非全卷 pct 15 的 45
    const gap = weakModule([{ key: 'panduan', name: '判断', n: 20, answered: 10, correct: 3, pct: 15, avgPct: 60 }]);
    expect(gap.reason).toBe('低于全站均值 30 个百分点');
  });

  it('W9-B answered 缺省（旧 attempt）时与旧行为一致：按 n / pct 判定', () => {
    expect(weakModule([row('yanyu', 50, 60), row('panduan', 40, 70)]).key).toBe('panduan');
    expect(weakModule([row('yanyu', 10, 80, 2)])).toBe(null);
    const r = weakModule([{ key: 'ziliao', n: 4, correct: 4, pct: 0, avgPct: null }]);
    expect(r.reason).toBe('本卷正确率 0%，全卷最低');
  });

  it('name 缺失回落 key；不修改入参', () => {
    const input = [{ key: 'ziliao', n: 4, correct: 0, pct: 0, avgPct: 50 }];
    const snapshot = JSON.stringify(input);
    const r = weakModule(input);
    expect(r.name).toBe('ziliao');
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
