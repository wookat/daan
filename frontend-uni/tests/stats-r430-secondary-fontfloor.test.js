import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rule, BOX40, legacyHit, assertHitLayer } from './_w5-hit.js';

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
  it('mastery-map 到期错题角标：字号 --fs-caption（12px），内盒 16px + 2px 描边（content-box）容得下「9+」', () => {
    const dot = rule(style(pages.masteryMap), '.dot');
    expect(dot).toMatch(/font-size:\s*var\(--fs-caption\)/);
    expect(dot).toMatch(/min-width:\s*16px;[^}]*height:\s*16px;[^}]*line-height:\s*16px/);
    expect(dot).toMatch(/border:\s*2px solid var\(--card\);[^}]*box-sizing:\s*content-box/);
  });
  it('calendar 月份 ‹ › 自绘 --hit-min 方块；weekly-report 分享面换成 kg-sheet（✕ 由组件层保证）', () => {
    assertHitLayer(expect);
    expect(pages.calendar).toMatch(/<view class="cal-btn" role="button" aria-label="上个月"/);
    expect(rule(style(pages.calendar), '.cal-btn')).toMatch(BOX40);
    expect(pages.weeklyReport).toMatch(/<kg-sheet v-model="sharing" title="分享周报">/);
    expect(legacyHit(expect, pages.weeklyReport, '.sheet-x')).toBe('componentized');
  });
});
