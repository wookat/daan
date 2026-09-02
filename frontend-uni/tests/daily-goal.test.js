import { describe, it, expect } from 'vitest';
import { DAILY_GOALS, normalizeDailyGoal, adoptServerDailyGoal } from '../src/daily-goal.js';

describe('normalizeDailyGoal', () => {
  it('只接受产品档位 20/50/100', () => {
    for (const g of DAILY_GOALS) expect(normalizeDailyGoal(g)).toBe(g);
    expect(DAILY_GOALS).toEqual([20, 50, 100]);
  });
  it('拒绝非法值（含数字字符串/浮点/布尔/越档整数）', () => {
    for (const bad of [5, 19, 21, 49, 51, 101, 500, 0, -1, 20.5, '50', '20', '', '  ', 'abc', true, false, null, undefined, {}, [], NaN]) {
      expect(normalizeDailyGoal(bad)).toBe(null);
    }
  });
});

describe('adoptServerDailyGoal', () => {
  it('服务端合法目标覆盖本地', () => {
    expect(adoptServerDailyGoal(20, { daily_goal: 100 })).toBe(100);
  });
  it('与本地一致时返回 null（无需变更）', () => {
    expect(adoptServerDailyGoal(50, { daily_goal: 50 })).toBe(null);
  });
  it('服务端缺失或非法时保留本地', () => {
    expect(adoptServerDailyGoal(20, null)).toBe(null);
    expect(adoptServerDailyGoal(20, {})).toBe(null);
    expect(adoptServerDailyGoal(20, { daily_goal: null })).toBe(null);
    expect(adoptServerDailyGoal(20, { daily_goal: 0 })).toBe(null);
    expect(adoptServerDailyGoal(20, { daily_goal: 'x' })).toBe(null);
  });
  it('不修改输入', () => {
    const p = { daily_goal: 100 };
    adoptServerDailyGoal(20, p);
    expect(p).toEqual({ daily_goal: 100 });
  });
});
