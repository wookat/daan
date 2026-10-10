// R586：学习日历月份标题在 360/375 折成两行——「2026 年 9 / 月」+ 44px 箭头热区被挤到 39.6/43.1px。
// 生产一手（375，16px/600，line-height 20.8）：.cal-head 294px 里 kg-tag「本月打卡 1 天」91.3px 不可压，
// .cal-title 只剩 194.7px，箭头 44+44 + gap 8 后 .cal-ym 只有 ~100px，文案「2026 年 9 月」需 104.4px、
// 「2026 年 12 月」需 115.5px（390 下 102.8px 也容不下 12 月）→ 两行。
// 修法：标题行只放「‹ 年月 ›」，「本月打卡 N 天」下移到「本月共练 N 题」同一行两端对齐（都是本月口径），
// 月份文案 nowrap、箭头 flex-shrink:0 保 44px 热区；小程序同结构同口径。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rule, BOX40 } from './_w5-hit.js';

const h5 = readFileSync(new URL('../src/pages/stats/calendar.vue', import.meta.url), 'utf8');
const wxml = readFileSync(new URL('../../miniapp-native/miniprogram/pkgGrow/calendar/calendar.wxml', import.meta.url), 'utf8');
const wxss = readFileSync(new URL('../../miniapp-native/miniprogram/pkgGrow/calendar/calendar.wxss', import.meta.url), 'utf8');
const css = h5.slice(h5.indexOf('<style'));

// 生产 375 实测（canvas measureText，同字体）
const YM_W = { '2026 年 9 月': 104.4, '2026 年 12 月': 115.5 };
const TITLE_W_375 = 194.7; // .cal-title 在旧结构下拿到的宽度
const BTN = 44; const GAP = 4;

describe('R586 学习日历标题行不再被打卡 tag 挤折行', () => {
  it('旧结构在 375 下 .cal-ym 可用宽 < 文案宽（论证前提）', () => {
    const avail = TITLE_W_375 - BTN * 2 - GAP * 2;
    expect(avail).toBeLessThan(YM_W['2026 年 9 月']);
    expect(avail).toBeLessThan(YM_W['2026 年 12 月']);
  });

  it('H5：标题行只含 ‹ 年月 ›，打卡 tag 与「本月共练」同行', () => {
    const head = h5.match(/<view class="cal-head">([\s\S]*?)\n {10}<\/view>/);
    expect(head).toBeTruthy();
    expect(head[1]).not.toContain('kg-tag');
    expect(h5).toMatch(/<view class="cal-sub">\s*<text class="cal-sub-t">本月共练 \{\{ monthCount \}\} 题<\/text>\s*<kg-tag tone="ok">本月打卡 \{\{ monthDays \}\} 天<\/kg-tag>\s*<\/view>/);
  });

  it('H5：年月 nowrap、箭头 flex-shrink:0 且仍是 --hit-min 方块、副标题行两端对齐', () => {
    expect(rule(css, '.cal-ym')).toMatch(/white-space:\s*nowrap/);
    const btn = rule(css, '.cal-btn');
    expect(btn).toMatch(/flex-shrink:\s*0/);
    expect(btn).toMatch(BOX40);
    const sub = rule(css, '.cal-sub');
    expect(sub).toMatch(/display:\s*flex/);
    expect(sub).toMatch(/justify-content:\s*space-between/);
    expect(rule(css, '.cal-sub-t')).toMatch(/font-size:\s*var\(--fs-sub\)/);
    expect(rule(css, '.cal-head')).not.toMatch(/space-between/);
  });

  it('小程序：同结构同口径', () => {
    const head = wxml.match(/<view class="cal-head">([\s\S]*?)\n {6}<\/view>/);
    expect(head).toBeTruthy();
    expect(head[1]).not.toContain('kg-tag');
    expect(wxml).toMatch(/<view class="cal-sub">\s*<text class="cal-sub-t">本月共练 \{\{monthCount\}\} 题<\/text>\s*<kg-tag tone="ok">本月打卡 \{\{monthDays\}\} 天<\/kg-tag>\s*<\/view>/);
    expect(rule(wxss, '.cal-ym')).toMatch(/white-space:\s*nowrap/);
    expect(rule(wxss, '.cal-btn')).toMatch(/flex-shrink:\s*0/);
    expect(rule(wxss, '.cal-sub')).toMatch(/justify-content:\s*space-between/);
    expect(rule(wxss, '.cal-sub-t')).toMatch(/font-size:\s*var\(--fs-sub\)/);
  });
});
