import { describe, it, expect } from 'vitest';
import { todayShown } from '../src/home-today.js';

describe('todayShown(svTodayN, svLocalAtSync, localNow)', () => {
  it('无服务端值 → 本地数（离线降级）', () => {
    expect(todayShown(null, 0, 4)).toBe(4);
    expect(todayShown(undefined, 0, 0)).toBe(0);
    expect(todayShown('7', 0, 3)).toBe(3);
    expect(todayShown(NaN, 0, 3)).toBe(3);
    expect(todayShown(null, 0, undefined)).toBe(0);
  });
  it('有服务端值且本地无增量 → 服务端值（跨设备/多身份以服务端为准）', () => {
    expect(todayShown(12, 5, 5)).toBe(12);
    expect(todayShown(0, 0, 0)).toBe(0);
  });
  it('有服务端值 + 本地增量 → 相加（从练习返回首页首帧即为准确值）', () => {
    expect(todayShown(12, 5, 8)).toBe(15);
    expect(todayShown(0, 0, 3)).toBe(3);
  });
  it('同步后增量归零：新 summary 到达时以当时本地数为基线', () => {
    const local = 8;
    expect(todayShown(12, 5, local)).toBe(15);
    expect(todayShown(15, local, local)).toBe(15);
    expect(todayShown(15, local, local + 2)).toBe(17);
  });
  it('本地数比同步基线小（清缓存/换日）不倒扣', () => {
    expect(todayShown(12, 5, 2)).toBe(12);
    expect(todayShown(12, 5, 0)).toBe(12);
  });
  it('基线缺失/非法按 0 记', () => {
    expect(todayShown(12, undefined, 3)).toBe(15);
    expect(todayShown(12, -4, 3)).toBe(15);
    expect(todayShown(12, 'x', 3)).toBe(15);
  });
});
