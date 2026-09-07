import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const style = (src) => src.slice(src.indexOf('<style'));
const rule = (css, sel) => (css.match(new RegExp(`\\n\\s*${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';
const pages = {
  offline: style(read('../src/pkgA/user/offline.vue')),
  plaza: style(read('../src/pkgA/social/plaza.vue')),
  poster: style(read('../src/pkgA/social/poster.vue')),
  inbox: style(read('../src/pkgA/social/inbox.vue')),
  join: style(read('../src/pages/team/join.vue')),
  login: style(read('../src/pkgA/user/login.vue')),
  exportConfirm: style(read('../src/components/export-confirm/export-confirm.vue')),
};

describe('R481 R410 后从未整页过审的剩余页面：字号下限与可点元素热区（源文件锁）', () => {
  for (const [name, css] of Object.entries(pages)) {
    it(`${name} 样式无 <24rpx（375 下 12px）字号`, () => {
      expect(css.match(/font-size:\s*(?:[1-9]|1\d|2[0-3])rpx/g) || []).toEqual([]);
    });
  }

  it('导出弹层（卷库 / 首页 / 错题本共用）✕ 命中 ≥40px，负外边距不抬 sheet 头行', () => {
    const css = pages.exportConfirm;
    expect(rule(css, '.sheet-x')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.sheet-x')).toMatch(/min-width:\s*40px/);
    expect(rule(css, '.sheet-x')).toMatch(/margin:\s*-6px/);
  });

  it('离线题包页：每行「下载 / 更新 / 删除」命中高 ≥40px（flex 行内 inline-flex，行高不变）', () => {
    const css = pages.offline;
    expect(rule(css, '.act')).toMatch(/min-height:\s*40px/);
    expect(rule(css, '.act')).toMatch(/box-sizing:\s*border-box/);
    expect(rule(css, '.pkg')).toMatch(/display:\s*flex/);
  });

  it('海报页「保存图片 / 重新生成」与收件箱「去登录」uni button 高 ≥40px', () => {
    expect(rule(pages.poster, '.btn')).toMatch(/line-height:\s*40px/);
    expect(rule(pages.poster, '.btn')).toMatch(/min-height:\s*40px/);
    expect(rule(pages.inbox, '.login-btn')).toMatch(/line-height:\s*40px/);
    expect(rule(pages.inbox, '.login-btn')).toMatch(/min-height:\s*40px/);
  });

  it('小队邀请页「登录 / 注册 ›」整行与登录页「登录 / 注册」分段命中高 ≥40px', () => {
    expect(rule(pages.join, '.reg-tip')).toMatch(/min-height:\s*40px/);
    expect(rule(pages.join, '.reg-tip')).toMatch(/box-sizing:\s*border-box/);
    expect(pages.login).toMatch(/\.seg-item \{[^}]*min-height:\s*40px/);
    expect(pages.login).toMatch(/\.seg-item \{[^}]*box-sizing:\s*border-box/);
  });
});
