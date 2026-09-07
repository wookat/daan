import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const style = (src) => src.slice(src.indexOf('<style'));
const pages = {
  home: read('../src/pages/home/home.vue'),
  reminders: read('../src/pkgA/settings/reminders.vue'),
};

describe('R440 首页 / 提醒设置字号下限与热区（源文件锁）', () => {
  for (const [name, src] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      const css = style(src);
      expect(css.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
      expect(css).not.toMatch(/font-size:\s*(?:[1-9]|1[01])(?:\.\d+)?px/);
    });
  }
  it('首页「补练往期 ›」「往期 ›」文字链纵向热区 ≥40px（负外边距不改布局）', () => {
    const tpl = pages.home.slice(0, pages.home.indexOf('<script'));
    const css = style(pages.home);
    // W5 起「补练往期 ›」独占 .hero-lnk-row（flex 子项）；「往期 ›」仍是模块行副标题内的行内链
    expect(tpl).toMatch(/<text class="hero-lnk" role="button" @click\.stop="openDailyArchive">补练往期 ›<\/text>/);
    expect(tpl).toMatch(/<text class="modrow-lnk" @click\.stop="openSzArchive"> · 往期 ›<\/text>/);
    const lnk = css.match(/\.hero-lnk \{([^}]*)\}/);
    expect(lnk).toBeTruthy();
    expect(lnk[1]).toMatch(/display:\s*inline-flex/);
    expect(lnk[1]).toMatch(/min-height:\s*40px/);
    expect(lnk[1]).toMatch(/margin:\s*-3px 0/);
    const sz = css.match(/\.modrow-lnk \{([^}]*)\}/);
    expect(sz).toBeTruthy();
    expect(sz[1]).toMatch(/display:\s*inline-block/);
    expect(sz[1]).toMatch(/padding:\s*11px 0 11px 4px/);
    expect(sz[1]).toMatch(/margin:\s*-11px 0 -11px -4px/);
  });
});
