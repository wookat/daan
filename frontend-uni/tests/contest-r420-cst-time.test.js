import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fmtWindow, fmtDay, fmtDayHour, cstParts } from '../src/contest-time.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const helper = read('../src/contest-time.js');
const contest = read('../src/pkgA/exam/contest.vue');
const report = read('../src/pkgA/exam/contest-report.vue');
const weekly = read('../src/pkgA/stats/weekly-report.vue');

// 生产 R419 后 4 场之一：2026-09-05（周六）09:00–24:00 东八区
const OPEN = 1788570000;
const CLOSE = 1788624000;

describe('R420 比赛窗口/日期固定东八区（与后端 mock_event.TZ 一致，不经设备时区）', () => {
  it(`当前进程 TZ=${process.env.TZ || '(系统)'} 下窗口仍显示 9月5日 09:00 - 24:00`, () => {
    expect(fmtWindow(OPEN, CLOSE)).toBe('9月5日 09:00 - 24:00');
    expect(cstParts(OPEN)).toEqual({ y: 2026, mo: 9, d: 5, h: 9, mi: 0 });
  });
  it('往期日期取 close_at-1（周六 23:59:59）：东八区设备旧实现得 2026-09-06，现为 2026-09-05', () => {
    expect(fmtDay(CLOSE - 1)).toBe('2026-09-05');
    expect(fmtDay(CLOSE)).toBe('2026-09-06');
  });
  it('周报「下一场」同一口径', () => {
    expect(fmtDayHour(OPEN)).toBe('9月5日 09:00');
  });
  it('截止不在 0 点时按实际时分显示', () => {
    expect(fmtWindow(OPEN, OPEN + 3 * 3600 + 30 * 60)).toBe('9月5日 09:00 - 12:30');
  });
  it('helper 只用 UTC getter；contest.vue / weekly-report.vue 不再自行按本地时区格式化场次', () => {
    expect(helper).not.toMatch(/\.get(?:FullYear|Month|Date|Hours|Minutes|TimezoneOffset)\(/);
    const script = (s) => s.slice(s.indexOf('<script'), s.indexOf('</script>'));
    expect(script(contest)).toContain("from '../../contest-time.js'");
    expect(script(contest)).not.toMatch(/new Date\(/);
    expect(contest).toMatch(/fmtDay\(p\.close_at - 1\)/);
    expect(script(weekly)).toContain("from '../../contest-time.js'");
    expect(script(weekly)).not.toMatch(/getTimezoneOffset/);
  });
});

describe('R420 contest / contest-report 字号下限（375 下 ≥12px）与榜单关闭热区', () => {
  const style = (s) => s.slice(s.indexOf('<style'));
  it('contest.vue 样式无 <24rpx 字号', () => {
    expect(style(contest).match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
  });
  it('contest-report.vue 样式无 <24rpx 字号', () => {
    expect(style(report).match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
  });
  it('榜单弹层 ✕ 热区 ≥40px', () => {
    expect(style(contest)).toMatch(/\.sheet-x\s*\{[^}]*min-width:\s*40px;[^}]*min-height:\s*40px;/);
  });
});
