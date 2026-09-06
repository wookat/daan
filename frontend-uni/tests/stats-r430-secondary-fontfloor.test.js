import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const style = (src) => src.slice(src.indexOf('<style'));
const pages = {
  calendar: read('../src/pages/stats/calendar.vue'),
  masteryMap: read('../src/pkgA/stats/mastery-map.vue'),
  practiceHistory: read('../src/pkgA/stats/practice-history.vue'),
  weeklyReport: read('../src/pkgA/stats/weekly-report.vue'),
};

describe('R430 统计次级屏字号下限 / 热区（源文件锁）', () => {
  for (const [name, src] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      const css = style(src);
      expect(css.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
      expect(css).not.toMatch(/font-size:\s*(?:[1-9]|1[01])(?:\.\d+)?px/);
    });
  }
  it('mastery-map 到期错题角标随 24rpx 字号放大到 36rpx', () => {
    expect(style(pages.masteryMap)).toMatch(/\.dot\s*\{[^}]*min-width:\s*36rpx;[^}]*height:\s*36rpx;/);
  });
  it('calendar 月份 ‹ › 与 weekly-report 分享面 ✕ 热区 ≥40×40px', () => {
    expect(style(pages.calendar)).toMatch(/\.cal-btn\s*\{[^}]*min-width:\s*40px;[^}]*min-height:\s*40px;/);
    expect(style(pages.weeklyReport)).toMatch(/\.sheet-x\s*\{[^}]*min-width:\s*40px;[^}]*min-height:\s*40px;/);
  });
});
