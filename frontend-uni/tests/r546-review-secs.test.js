// R546：复习作答上送 secs（生产只读：近 30 天 review_log 35 行 with_secs=0；历次作答里「复习」行无用时、「练习」行有）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reviewElapsedSecs, REVIEW_SECS_MAX } from '../src/review-snap.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue')+read('../src/pages/book/review-ops.js');
const script = book.slice(book.indexOf('<script'), book.length);
const method = (name) => {
  const m = script.match(new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};

describe('R546 reviewElapsedSecs', () => {
  it('从展示到判定取整秒，最少 1s，上限 1h', () => {
    expect(reviewElapsedSecs(1000, 1000 + 7400)).toBe(7);
    expect(reviewElapsedSecs(1000, 1200)).toBe(1);
    expect(reviewElapsedSecs(1000, 1000 + 5 * 3600 * 1000)).toBe(REVIEW_SECS_MAX);
    expect(REVIEW_SECS_MAX).toBe(3600);
  });
  it('无起点 / 时钟回拨 → undefined（不上送，JSON 序列化后字段缺省）', () => {
    expect(reviewElapsedSecs(undefined, 5000)).toBeUndefined();
    expect(reviewElapsedSecs(0, 5000)).toBeUndefined();
    expect(reviewElapsedSecs(9000, 5000)).toBeUndefined();
    expect(JSON.stringify({ correct: true, secs: reviewElapsedSecs(0, 1) })).toBe('{"correct":true}');
  });
});

describe('R546 book.vue 复习计时接线', () => {
  it('每题起点：resetQ（开始/下一题）与 resumeReview（断点续做）都重置 _qStart', () => {
    expect(method('resetQ')).toContain('this._qStart = Date.now();');
    expect(method('resumeReview')).toContain('this._qStart = Date.now();');
    expect(method('nextReview')).toContain('this.resetQ();');
    expect(method('startReview')).toContain('this.resetQ();');
  });
  it('record：POST /api/review/{mid} 带 secs（与 picked 同一请求）', () => {
    const rec = method('record');
    expect(rec).toMatch(/request\('\/api\/review\/' \+ this\.cur\.id, \{\s*method: 'POST',\s*data: \{ correct, uid: anonUid\(\), picked: this\.picked \|\| undefined, secs: this\.reviewSecs\(\) \},/);
    expect(method('reviewSecs')).toContain('reviewElapsedSecs(this._qStart, Date.now())');
    expect(script).toContain("import { buildReviewSnap, parseReviewSnap, reviewElapsedSecs } from '../../review-snap.js';");
  });
});
