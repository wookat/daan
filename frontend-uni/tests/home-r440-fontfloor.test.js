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
  it('首页「补练往期 ›」「往期 ›」行内文字链纵向热区 ≥40px（负外边距不改布局）', () => {
    const css = style(pages.home);
    for (const sel of ['.hero-ds-arc', '.sz-arc']) {
      const m = css.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`));
      expect(m, sel).toBeTruthy();
      // 纵向 padding 要生效须为块级盒：inline-block / float / absolute（R448 .hero-ds-arc 绝对定位贴右）
      expect(m[1]).toMatch(/display:\s*inline-block|float:\s*right|position:\s*absolute/);
      // 行内盒靠负外边距不撑大父行；绝对定位盒脱离文档流本就不占位
      if (!/position:\s*absolute/.test(m[1])) expect(m[1]).toMatch(/margin:\s*-12px (?:0|-8rpx) -12px/);
      expect(m[1]).toMatch(/padding:\s*12px/);
    }
  });
});
