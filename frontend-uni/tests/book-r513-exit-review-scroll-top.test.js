// R513：375 视口复习卡 ~988px 高，作答要下滚 ≥400；「完成复习」→ 庆祝弹层 → 关闭后落在错题列表中段
// （head 卡 top −613），到期状态/统计卡不可见。锁：退出复习（完成/手动退出同一出口）回到页顶。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8')+readFileSync(new URL('../src/pages/book/review-ops.js', import.meta.url), 'utf8');

describe('R513 exitReview 回页顶', () => {
  it('exitReview() 退出复习后 pageScrollTo(0)', () => {
    const m = src.match(/exitReview\(\) \{([\s\S]*?)\n {4}\},/);
    expect(m).not.toBeNull();
    const body = m[1];
    expect(body).toMatch(/this\.reviewing = false/);
    expect(body).toMatch(/this\.clearReviewSnap\(\)/);
    expect(body).toMatch(/uni\.pageScrollTo\(\{ scrollTop: 0, duration: 0 \}\)/);
  });
  it('完成复习与手动退出都走 exitReview（单一出口）', () => {
    expect(src).toMatch(/this\.celebrateN = [\s\S]*?this\.exitReview\(\);\s*this\.celebrate = true/);
    expect(src).toMatch(/@click="exitReview"/);
  });
});
