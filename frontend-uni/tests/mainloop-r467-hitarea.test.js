import { describe, it, expect } from 'vitest';
import { read, styleOf, templateOf, rule, legacyHit, assertHitLayer, HIT40, BOX40 } from './_w5-hit.js';

// R467 源锁：错题本 / 首页两个主循环页的可点元素 ≥40px 命中带（生产 375 一手读数曾为 15–33px）。
// W5 起 ✕ / 文字链 / 重试 / 弹层关闭换成 kg-* 组件（命中区在组件层）；页面仍自绘的元素逐条锁规则。
const book = read('pages/book/book.vue');
const home = read('pages/home/home.vue');
const bookCss = styleOf(book);
const homeCss = styleOf(home);

describe('R467 组件层命中规则', () => {
  it('tokens / kg-button / kg-sheet / kg-chip-row / kg-section-header / kg-banner 命中 44', () => assertHitLayer(expect));
});

describe('R467 错题本 book.vue 可点元素 40px', () => {
  it('待掌握/已掌握/收藏 分段页签 .seg-i 40px，.seg 内边距 4px 保持工具行不撑高', () => {
    expect(rule(bookCss, '.seg-i')).toMatch(/min-height:\s*40px/);
    expect(rule(bookCss, '.seg')).toMatch(/padding:\s*var\(--sp-4\)/);
  });
  it('卷源徽标 kg-tag.pbadge 外包 .pbadge-hit 40px 负外边距（徽标视觉不变、保留 ellipsis）', () => {
    expect(book).toMatch(/<view v-if="mistakePaper\(m\)" class="pbadge-hit" role="button" @click\.stop=[^>]*><kg-tag tone="neutral" class="pbadge">/);
    expect(rule(bookCss, '.pbadge-hit')).toMatch(/min-height:\s*40px;\s*margin:\s*-10px 0/);
    expect(rule(bookCss, '.pbadge')).toMatch(/text-overflow:\s*ellipsis/);
  });
  it('月复盘头 / 错因行 / 桌面快捷键「查看全部」/ 模块分组「查看 ›」：自绘的 ≥40px，其余走 kg-section-header / kg-button', () => {
    expect(rule(bookCss, '.recap-link')).toMatch(HIT40);
    expect(book).toMatch(/<kg-section-header :title="'本月错题复盘 · 新增 ' \+ monthRecap\.total \+ ' 道'" :more="recapOpen \? '收起' : '展开'"/);
    expect(book).toMatch(/<kg-button variant="text" size="sm" @click="kbdHelp = true">按 \? 查看全部 ›<\/kg-button>/);
    for (const s of ['.mg-go', '.recap-h', '.kbd-more']) expect(legacyHit(expect, book, s), s).toBe('componentized');
  });
  it('弹层 ✕ / 强化卡备选 / 续练「放弃」/「换一份试卷」/ 重试 / 复习页同类题行：全部由 kg-sheet / kg-button / kg-empty-state 承担', () => {
    for (const s of ['.sheet-x', '.rf-alt', '.resume-drop', '.manual-back', '.retry', '.sim-row']) {
      expect(legacyHit(expect, book, s), s).toBe('componentized');
    }
    expect(book).toMatch(/<kg-button variant="text" size="md" role="button" aria-label="放弃本轮复习进度" @click\.stop="discardResume">放弃<\/kg-button>/);
    expect(book).toMatch(/<kg-button variant="text" size="md" block @click="manualPaper = null">‹ 换一份试卷<\/kg-button>/);
    expect(book).toMatch(/<kg-empty-state v-else-if="tab !== 'fav' && loadErr && !items\.length" icon="wifi-off" title="加载失败" :desc="loadErr" cta-text="重试" @cta="load" \/>/);
    expect(templateOf(book).match(/<kg-button v-if="[^"]*" variant="text" size="md" block[^>]*@click="(?:similarFromReview|askFromReview|openSeenAsk)"/g) || []).toHaveLength(3);
  });
});

describe('R467 首页 home.vue 可点元素 40px', () => {
  it('新访客首屏 ✕ .hero-x 44×44；公告 ✕ 走 kg-banner（负外边距不抬横幅）', () => {
    expect(rule(homeCss, '.hero-x')).toMatch(BOX40);
    expect(legacyHit(expect, home, '.ld-x')).toBe('componentized');
    expect(legacyHit(expect, home, '.ann-x')).toBe('componentized');
    expect(home).toMatch(/<kg-banner tone="info" icon="megaphone" :text="announce\.title[^"]*"[^>]*@close="dismissAnn" \/>/);
  });
  it('续练/续考/续复习 「去继续 ›」走 kg-button sm、✕ .rs-x 44×44', () => {
    expect(templateOf(home).match(/<kg-button variant="text" size="sm" aria-label="继续[^"]*" @click="(?:er|pr|rv)Continue">去继续 ›<\/kg-button>/g) || []).toHaveLength(3);
    expect(rule(homeCss, '.rs-x')).toMatch(BOX40);
    expect(legacyHit(expect, home, '.cb-go')).toBe('componentized');
    expect(legacyHit(expect, home, '.cb-x')).toBe('componentized');
  });
  it('今日任务行 .task 整行可点（role=button、min-height 44），内层「去练 ›」文字不单独撑高', () => {
    expect(home).toMatch(/class="task"\s+:class="\{ 'is-done': t\.done \}"\s+role="button"\s+hover-class="task--hover"\s+@click="goTask\(t\)"/);
    expect(rule(homeCss, '.task')).toMatch(/min-height:\s*var\(--hit-min\)/);
    expect(rule(homeCss, '.task-go')).not.toMatch(/min-height/);
    expect(legacyHit(expect, home, '.tk-go')).toBe('componentized');
  });
});
