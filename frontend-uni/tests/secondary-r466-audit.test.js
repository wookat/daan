import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const style = (src) => src.slice(src.indexOf('<style'));
const rule = (css, sel) => (css.match(new RegExp(`\\n${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';
const pages = {
  search: style(read('../src/pkgA/search/search.vue')),
  discuss: style(read('../src/pkgA/social/discuss.vue')),
  profile: style(read('../src/pages/profile/profile.vue')),
  interview: style(read('../src/pkgA/interview/interview.vue')),
};

describe('R466 搜索 / 讨论 / 个人 / 面试页字号下限与可点元素热区（源文件锁）', () => {
  for (const [name, css] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      expect(css.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
    });
  }

  it('搜索页：范围页签 / 取消 / 清空输入 / 清空历史 / 历史 chip / AI 详解 / 重试 命中高 ≥40px', () => {
    const css = pages.search;
    for (const sel of ['.tab', '.scancel', '.sclear', '.hist-clear', '.d-copy', '.retry']) {
      expect(rule(css, sel), sel).toMatch(/min-height:\s*40px/);
    }
    expect(rule(css, '.hist-chip')).toMatch(/line-height:\s*40px/);
    expect(rule(css, '.hist-chip')).toMatch(/text-overflow:\s*ellipsis/);
    // 搜索框行 / 历史标题行不被撑高
    expect(rule(css, '.sclear')).toMatch(/margin:\s*-12px 0/);
    expect(rule(css, '.scancel')).toMatch(/margin:\s*-4px 0/);
    expect(rule(css, '.hist-clear')).toMatch(/margin:\s*-8px 0/);
  });

  it('讨论页：排序 chip / 消息 / 赞 / 回复·举报·删除 / 取消回复 ✕ / 发布 / 去广场 / 重试 命中高 ≥40px', () => {
    const css = pages.discuss;
    for (const sel of ['.chip', '.msg', '.up', '.op', '.rx', '.plaza-btn', '.retry']) {
      expect(rule(css, sel), sel).toMatch(/min-height:\s*40px/);
    }
    expect(rule(css, '.send')).toMatch(/height:\s*40px/);
    expect(rule(css, '.rx')).toMatch(/min-width:\s*40px/);
    // 评论/回复操作行用负外边距，不把每条评论撑高
    expect(rule(css, '.up')).toMatch(/margin:\s*-12px 0/);
    expect(rule(css, '.op')).toMatch(/margin:\s*-12px 0/);
    expect(css).not.toMatch(/\.up\.sm, \.op\.sm/);
  });

  it('个人页：底部 Zalize 产品 / 隐私 / 条款文字链 命中高 40px，行距拉开到命中带恰好相接', () => {
    const css = pages.profile;
    expect(rule(css, '.zl-link')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.zl-link')).toMatch(/margin:\s*-4px 0/);
    expect(rule(css, '.zl-links')).toMatch(/gap:\s*16rpx 28rpx/);
  });

  it('面试页：练习记录 › / 换一题 命中高 ≥40px', () => {
    const css = pages.interview;
    expect(rule(css, '.hist-link')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.swap')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.swap')).toMatch(/margin:\s*-10px 0/);
  });
});
