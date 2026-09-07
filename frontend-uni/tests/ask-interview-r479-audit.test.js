import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const style = (src) => src.slice(src.indexOf('<style'));
const rule = (css, sel) => (css.match(new RegExp(`\\n\\s*${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';
const pages = {
  ask: style(read('../src/pages/ask/ask.vue')),
  interview: style(read('../src/pkgA/interview/interview.vue')),
  history: style(read('../src/pkgA/interview/history.vue')),
};

describe('R479 问答页 / 面试簇（出题 / 练习记录）字号下限与可点元素热区（源文件锁）', () => {
  for (const [name, css] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      expect(css.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
    });
  }

  it('问答页：三个 sheet 的 ✕ 命中 ≥40px，用负外边距不抬 sheet 头行', () => {
    const css = pages.ask;
    expect(rule(css, '.sheet-x')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.sheet-x')).toMatch(/min-width:\s*40px/);
    expect(rule(css, '.sheet-x')).toMatch(/margin:\s*-6px/);
  });

  it('问答页：解析评价「有用 / 有误」命中高 ≥40px（flex 父容器内 inline-flex，不改流）', () => {
    const css = pages.ask;
    expect(rule(css, '.rate-btn')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.rate-btn')).toMatch(/box-sizing:\s*border-box/);
    expect(rule(css, '.rate-btns')).toMatch(/display:\s*flex/);
  });

  it('问答页：原有 44px 可点元素保留（顶栏按钮 / 取景屏快捷·模式·侧键 / chips / 输入栏 / 答案 chip / 会话删除）', () => {
    const css = pages.ask;
    for (const sel of ['.top-btn', '.cam-quick', '.cam-mode', '.cam-side', '.chip', '.ib-send', '.ans-chip', '.rec-del']) {
      expect(rule(css, sel), sel).toMatch(/min-height:\s*44px/);
    }
    expect(rule(css, '.ib-cam, .ib-txt')).toMatch(/height:\s*44px/);
  });

  it('面试簇：分类行 ≥52px、换一题 / 练习记录 ≥40px、按钮 ≥44px、记录页失败态重试 ≥40px', () => {
    expect(rule(pages.interview, '.cat')).toMatch(/min-height:\s*52px/);
    expect(rule(pages.interview, '.swap')).toMatch(/min-height:\s*40px/);
    expect(rule(pages.interview, '.hist-link')).toMatch(/min-height:\s*40px/);
    expect(rule(pages.interview, '.btn-ghost')).toMatch(/min-height:\s*44px/);
    expect(pages.interview).toMatch(/\.btn-primary\s*\{[^}]*min-height:\s*44px/);
    expect(pages.history).toMatch(/\.retry\s*\{[^}]*min-height:\s*40px/);
    expect(rule(pages.history, '.btn-primary')).toMatch(/min-height:\s*44px/);
  });
});
