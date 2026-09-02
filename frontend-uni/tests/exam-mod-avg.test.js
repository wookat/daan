import { describe, it, expect } from 'vitest';
import { modAvgPct } from '../src/exam-mod-avg.js';

describe('modAvgPct（R306 模块全站均值 fail-closed）', () => {
  it('rank/module_avg 缺失 → null', () => {
    expect(modAvgPct(null, 'yanyu')).toBe(null);
    expect(modAvgPct({}, 'yanyu')).toBe(null);
    expect(modAvgPct({ module_avg: null }, 'yanyu')).toBe(null);
    expect(modAvgPct({ module_avg: 'x' }, 'yanyu')).toBe(null);
  });

  it('该模块缺失或非对象 → null', () => {
    expect(modAvgPct({ module_avg: {} }, 'yanyu')).toBe(null);
    expect(modAvgPct({ module_avg: { yanyu: 5 } }, 'yanyu')).toBe(null);
  });

  it('n_users < 2 或非法 → null', () => {
    expect(modAvgPct({ module_avg: { yanyu: { pct: 60, n_users: 1 } } }, 'yanyu')).toBe(null);
    expect(modAvgPct({ module_avg: { yanyu: { pct: 60 } } }, 'yanyu')).toBe(null);
    expect(modAvgPct({ module_avg: { yanyu: { pct: 60, n_users: 'x' } } }, 'yanyu')).toBe(null);
  });

  it('pct 非有限数或越界 → null', () => {
    expect(modAvgPct({ module_avg: { yanyu: { pct: NaN, n_users: 3 } } }, 'yanyu')).toBe(null);
    expect(modAvgPct({ module_avg: { yanyu: { pct: 'a', n_users: 3 } } }, 'yanyu')).toBe(null);
    expect(modAvgPct({ module_avg: { yanyu: { pct: -1, n_users: 3 } } }, 'yanyu')).toBe(null);
    expect(modAvgPct({ module_avg: { yanyu: { pct: 101, n_users: 3 } } }, 'yanyu')).toBe(null);
  });

  it('合法数据返回取整百分比', () => {
    expect(modAvgPct({ module_avg: { yanyu: { pct: 62, n_users: 5 } } }, 'yanyu')).toBe(62);
    expect(modAvgPct({ module_avg: { yanyu: { pct: 61.6, n_users: 2 } } }, 'yanyu')).toBe(62);
    expect(modAvgPct({ module_avg: { yanyu: { pct: 0, n_users: 2 } } }, 'yanyu')).toBe(0);
  });

  it('不修改入参对象', () => {
    const rank = { module_avg: { yanyu: { pct: 62, n_users: 5 } } };
    const snapshot = JSON.stringify(rank);
    modAvgPct(rank, 'yanyu');
    expect(JSON.stringify(rank)).toBe(snapshot);
  });
});
