// R588：练习页换题 / 进完成页不回页首。生产 375 一手（test-r588-scroll，每日一练 10 题）：答错后 revealAfter 把页面下滚 37–532px，
// 点「下一题」后 idx++ 只换数据不动滚动，新题落地 scrollY 只被新页高夹住（q2 落地 y=56 顶栏进度条被藏、q7 y=66）；
// 末题答错后点「查看结果」完成页落地 y=148 → 「本组完成 / 20% / 答对 2/10」成绩头图整块滚出首屏（R582/R588 走查截图同态）。
// 修法：H5 watch idx → uni.pageScrollTo({scrollTop:0,duration:0})（uni-shared scrollTo duration 0 同步置 documentElement.scrollTop，
// 与 book.vue 既有用法同口径）；小程序主体是 scroll-view，wx.pageScrollTo 无效，绑 scroll-top 并 1→0 触发（shenlun 同法），goto/finish 各调一次。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const h5 = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');
const mpTs = readFileSync(new URL('../../miniapp-native/miniprogram/pages/practice/practice.ts', import.meta.url), 'utf8');
const mpWxml = readFileSync(new URL('../../miniapp-native/miniprogram/pages/practice/practice.wxml', import.meta.url), 'utf8');

const method = (src, name) => {
  const i = src.indexOf(`\n    ${name}(`);
  expect(i, name).toBeGreaterThan(-1);
  return src.slice(i, src.indexOf('\n    },', i));
};

describe('R588 练习页换题 / 完成页回页首', () => {
  it('H5：idx 变化即回页首（下一题 / 答题卡跳题 / 完成 idx=items.length / 同页新一场 idx=0）', () => {
    const w = h5.slice(h5.indexOf('  watch: {'), h5.indexOf('  methods: {'));
    expect(w).toMatch(/idx\(\)\s*\{[^}]*this\.scrollToTop\(\);/);
    const m = method(h5, 'scrollToTop');
    expect(m).toMatch(/uni\.pageScrollTo\(\{\s*scrollTop:\s*0,\s*duration:\s*0\s*\}\)/);
    expect(m).toContain('try {');
  });

  it('H5：next() 仍只推进 idx（回顶由 watch 承担，不重复调 pageScrollTo）', () => {
    const m = method(h5, 'next');
    expect(m).toContain('this.idx++');
    expect(m).not.toContain('pageScrollTo');
    expect(m).not.toContain('scrollToTop');
  });

  it('H5：revealAfter 仍在答错时下滚到解析（不被回顶抵消——回顶只挂 idx 变化）', () => {
    const m = method(h5, 'revealAfter');
    expect(m).toMatch(/uni\.pageScrollTo\(\{\s*scrollTop:\s*Math\.max\(0,/);
    expect(h5).toMatch(/this\.\$nextTick\(\(\) => this\.revealAfter\(\)\)/);
  });

  it('小程序：scroll-view 绑 scroll-top，goto/finish 调 scrollToTop（1→0 触发）', () => {
    expect(mpWxml).toMatch(/<scroll-view class="page-scroll" scroll-y[^>]*scroll-top="\{\{scrollTop\}\}"/);
    expect(mpTs).toMatch(/^\s+scrollTop: 0,/m);
    expect(mpTs).toMatch(/scrollToTop\(\)\s*\{\s*this\.setData\(\{ scrollTop: 1 \}, \(\) => this\.setData\(\{ scrollTop: 0 \}\)\);/);
    expect(mpTs).not.toMatch(/wx\.pageScrollTo\(/);
    const goto = mpTs.slice(mpTs.indexOf('\n  goto(next: number)'), mpTs.indexOf('\n  onNext()'));
    expect(goto).toContain('this.scrollToTop();');
    const finish = mpTs.slice(mpTs.indexOf('\n  async finish()'), mpTs.indexOf('wx.removeStorageSync(PENDING_KEY)', mpTs.indexOf('\n  async finish()')));
    expect(finish).toContain('finished: true');
    expect(finish).toContain('this.scrollToTop();');
  });
});
