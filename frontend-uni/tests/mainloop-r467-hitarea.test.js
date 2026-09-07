import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// R467 源锁：错题本 / 首页两个主循环页的可点元素 ≥40px 命中带（生产 375 一手读数曾为 15–33px）。
// 只锁源码规则，不替代生产 DOM 量测。
const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const style = (src) => src.slice(src.indexOf('<style'));
const rule = (css, sel) => (css.match(new RegExp(`\\n${sel.replace(/[.:-]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';

const book = read('../src/pages/book/book.vue');
const home = read('../src/pages/home/home.vue');
const bookCss = style(book);
const homeCss = style(home);

describe('R467 错题本 book.vue 可点元素 40px', () => {
  it('待掌握/已掌握/收藏 分段页签 .seg-i 40px，.seg 内边距收到 4rpx 保持工具行 44 不变', () => {
    expect(rule(bookCss, '.seg-i')).toMatch(/min-height:\s*40px/);
    expect(rule(bookCss, '.seg')).toMatch(/padding:\s*4rpx/);
  });
  it('卷源徽标 .pbadge 外包 .pbadge-hit 40px 负外边距（徽标视觉 20px 药丸不变、保留 ellipsis）', () => {
    expect(book).toMatch(/<view v-if="mistakePaper\(m\)" class="pbadge-hit" @click\.stop=[^>]*><text class="pbadge">/);
    expect(rule(bookCss, '.pbadge-hit')).toMatch(/min-height:\s*40px;\s*margin:\s*-10px 0/);
    expect(rule(bookCss, '.pbadge')).toMatch(/text-overflow:\s*ellipsis/);
  });
  it('模块分组「查看 ›」.mg-go / 月复盘头 .recap-h / 错因行 .recap-link / 桌面快捷键 .kbd-more 40px', () => {
    expect(rule(bookCss, '.mg-go')).toMatch(/min-height:\s*40px/);
    expect(rule(bookCss, '.recap-h')).toMatch(/min-height:\s*40px;\s*margin:\s*-11px 0/);
    expect(rule(bookCss, '.recap-link')).toMatch(/min-height:\s*40px/);
    expect(rule(bookCss, '.kbd-more')).toMatch(/min-height:\s*40px/);
  });
  it('弹层 ✕ .sheet-x 40×40、强化卡 .rf-alt、续练「放弃」.resume-drop、「换一份试卷」.manual-back、重试 .retry、复习页 .sim-row 40px', () => {
    expect(rule(bookCss, '.sheet-x')).toMatch(/min-width:\s*40px;\s*min-height:\s*40px/);
    for (const s of ['.rf-alt', '.resume-drop', '.manual-back', '.retry', '.sim-row']) {
      expect(rule(bookCss, s), s).toMatch(/min-height:\s*40px/);
    }
  });
});

describe('R467 首页 home.vue 可点元素 40px', () => {
  it('新访客首屏 ✕ .ld-x 40×40、公告 ✕ .ann-x 40×40（负外边距不抬公告条）', () => {
    expect(rule(homeCss, '.ld-x')).toMatch(/width:\s*40px;\s*height:\s*40px/);
    expect(rule(homeCss, '.ann-x')).toMatch(/min-width:\s*40px;\s*min-height:\s*40px;\s*margin:\s*-10px/);
  });
  it('续练/续考横幅 「去继续 ›」.cb-go 40px、✕ .cb-x 40×40', () => {
    expect(rule(homeCss, '.cb-go')).toMatch(/min-height:\s*40px/);
    expect(rule(homeCss, '.cb-x')).toMatch(/min-width:\s*40px;\s*min-height:\s*40px/);
  });
  it('今日任务行 .tk-row 整行可点（内层 .tk-go 16px 由外层 52px 覆盖，不单独撑高）', () => {
    expect(home).toMatch(/<view class="tk-row" @click="taskGo\('practice'\)">/);
    expect(rule(homeCss, '.tk-go')).not.toMatch(/min-height/);
  });
});
