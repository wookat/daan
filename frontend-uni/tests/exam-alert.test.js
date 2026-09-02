import { describe, it, expect } from 'vitest';
import { crossedTimeAlert, TIME_ALERTS } from '../src/exam-alert.js';

describe('crossedTimeAlert', () => {
  it('向下穿越 300s 触发 5 分钟提醒', () => {
    const a = crossedTimeAlert(301, 300);
    expect(a).toBeTruthy();
    expect(a.secs).toBe(300);
  });

  it('向下穿越 60s 触发 1 分钟提醒', () => {
    const a = crossedTimeAlert(61, 59);
    expect(a).toBeTruthy();
    expect(a.secs).toBe(60);
  });

  it('未穿越阈值不触发', () => {
    expect(crossedTimeAlert(299, 298)).toBeNull();
    expect(crossedTimeAlert(302, 301)).toBeNull();
    expect(crossedTimeAlert(59, 58)).toBeNull();
  });

  it('恢复进度 prev 等于 cur 时不补触发', () => {
    expect(crossedTimeAlert(240, 240)).toBeNull();
  });

  it('时间到（cur<=0）不触发（自动交卷 toast 已覆盖）', () => {
    expect(crossedTimeAlert(1, 0)).toBeNull();
    expect(crossedTimeAlert(90, 0)).toBeNull();
  });

  it('一次大跳跃跨过两个阈值只报最先命中的更高阈值', () => {
    const a = crossedTimeAlert(400, 50);
    expect(a.secs).toBe(300);
  });

  it('非法输入不触发', () => {
    expect(crossedTimeAlert(NaN, 100)).toBeNull();
    expect(crossedTimeAlert(400, NaN)).toBeNull();
    expect(crossedTimeAlert(undefined, 100)).toBeNull();
  });

  it('阈值表为 300/60 两档', () => {
    expect(TIME_ALERTS.map((a) => a.secs)).toEqual([300, 60]);
  });
});
