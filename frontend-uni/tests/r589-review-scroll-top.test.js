// R589：错题本页内复习模式换题不回页首（R588 练习页同型）。生产 375 一手（test-r589-review-b/-c，8 道到期 + 加练/重排到 22 题）：
// 复习卡解析在首屏之下（答后页高 934–1748 vs 视口 812），用户下滑读完解析再点 sticky「下一题」，nextReview 只 rIdx++ 不动滚动，
// 新题落地 scrollY 只被新页高夹住：短题夹到 0–4 掩盖问题；长题（资料分析材料，页高 934）落地 y=122 →「复习 6/19」tag、「退出复习」
// 与题干前两行整块滚出首屏（qTop=-1）。修法：H5 startReview/nextReview（换题分支）调 scrollToTop()
//（uni.pageScrollTo({scrollTop:0,duration:0})；exitReview 自 R513 起已直接 pageScrollTo(0)，不动、R513 源锁不改）；小程序主体是 scroll-view，绑 scroll-top 1→0（practice R588 同法）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const h5 = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');
const mpTs = readFileSync(new URL('../../miniapp-native/miniprogram/pages/book/book.ts', import.meta.url), 'utf8');
const mpWxml = readFileSync(new URL('../../miniapp-native/miniprogram/pages/book/book.wxml', import.meta.url), 'utf8');

const h5Method = (name) => {
  const i = h5.indexOf(`\n    ${name}(`);
  expect(i, name).toBeGreaterThan(-1);
  return h5.slice(i, h5.indexOf('\n    },', i));
};
const mpMethod = (name) => {
  const i = mpTs.indexOf(`\n  ${name}(`);
  expect(i, name).toBeGreaterThan(-1);
  return mpTs.slice(i, mpTs.indexOf('\n  },', i));
};

describe('R589 复习模式换题 / 开始复习 / 退出复习回页首', () => {
  it('H5：scrollToTop 同 R588 口径（pageScrollTo 0/0，try 包裹）', () => {
    const m = h5Method('scrollToTop');
    expect(m).toMatch(/uni\.pageScrollTo\(\{\s*scrollTop:\s*0,\s*duration:\s*0\s*\}\)/);
    expect(m).toContain('try {');
  });

  it('H5：nextReview 换题分支 rIdx++ 后回顶；完成分支经 exitReview 回顶（不重复调）', () => {
    const m = h5Method('nextReview');
    const next = m.slice(0, m.indexOf('} else {'));
    const done = m.slice(m.indexOf('} else {'));
    expect(next).toContain('this.rIdx++;');
    expect(next).toContain('this.scrollToTop();');
    expect(done).toContain('this.exitReview();');
    expect(done).not.toContain('scrollToTop');
    expect(h5Method('exitReview')).toMatch(/uni\.pageScrollTo\(\{ scrollTop: 0, duration: 0 \}\)/);
  });

  it('H5：startReview（列表可能已下滑）落地回顶；resumeReview 冷加载不另滚', () => {
    expect(h5Method('startReview')).toContain('this.scrollToTop();');
    expect(h5Method('resumeReview')).not.toContain('scrollToTop');
  });

  it('H5：「下一题」仍是 sticky 底部按钮（用户读解析下滑后不必再上滑找按钮——回顶只挂换题）', () => {
    expect(h5).toMatch(/\.next-btn \{[^}]*position: sticky;[^}]*bottom: calc\(50px \+ env\(safe-area-inset-bottom\)/);
  });

  it('小程序：page-scroll 绑 scroll-top，startReview/onNextReview 换题分支/exitReview 调 scrollToTop（1→0）', () => {
    expect(mpWxml).toMatch(/<scroll-view class="page-scroll" scroll-y type="list" scroll-top="\{\{scrollTop\}\}"/);
    expect(mpTs).toMatch(/^\s+scrollTop: 0,/m);
    expect(mpMethod('scrollToTop')).toMatch(/this\.setData\(\{ scrollTop: 1 \}, \(\) => this\.setData\(\{ scrollTop: 0 \}\)\);/);
    expect(mpTs).not.toMatch(/wx\.pageScrollTo\(/);
    expect(mpMethod('startReview')).toContain('this.scrollToTop();');
    const nr = mpMethod('onNextReview');
    expect(nr.slice(0, nr.indexOf('} else {'))).toContain('this.scrollToTop();');
    expect(nr.slice(nr.indexOf('} else {'))).not.toContain('scrollToTop');
    expect(mpMethod('exitReview')).toContain('this.scrollToTop();');
  });
});
