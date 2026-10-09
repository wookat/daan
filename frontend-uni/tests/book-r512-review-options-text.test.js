// R512：/api/review 联查题库后 question_text 只剩规范题干（W5 4aa576d5 _hydrate_mistake），
// H5 复习作答卡曾只画 A/B/C/D 裸字母 → 题目不可作答。锁：选项文本铺出 + AI 详解预填带选项。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { reviewOptions, reviewOptionsFull } from '../src/review-opts.js';
import { askPrefill } from '../src/ask-prefill.js';

const src = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8')+readFileSync(new URL('../src/pages/book/review-ops.js', import.meta.url), 'utf8');

describe('R512 reviewOptions', () => {
  it('结构化 options → 按字母排序铺出文本', () => {
    const r = reviewOptions({ options: { B: ' 乙 ', A: '甲', D: '丁', C: '丙' } });
    expect(r).toEqual([
      { k: 'A', t: '甲' },
      { k: 'B', t: '乙' },
      { k: 'C', t: '丙' },
      { k: 'D', t: '丁' },
    ]);
    expect(reviewOptionsFull(r)).toBe(true);
  });
  it('无 options / 空 / 非法键 / 不足 2 项 → 退回 A–D 裸字母', () => {
    const bare = ['A', 'B', 'C', 'D'].map((k) => ({ k, t: '' }));
    expect(reviewOptions({})).toEqual(bare);
    expect(reviewOptions(null)).toEqual(bare);
    expect(reviewOptions({ options: {} })).toEqual(bare);
    expect(reviewOptions({ options: [] })).toEqual(bare);
    expect(reviewOptions({ options: { A: '甲' } })).toEqual(bare);
    expect(reviewOptions({ options: { a: '甲', b: '乙' } })).toEqual(bare);
    expect(reviewOptions({ options: { A: 1, B: 2 } })).toEqual(bare);
    expect(reviewOptionsFull(bare)).toBe(false);
  });
  it('加练同类题（选项已拼进题干、无 options）保持裸字母', () => {
    expect(reviewOptionsFull(reviewOptions({ _extra: true, question_text: '题干\nA.甲 B.乙' }))).toBe(false);
  });
});

describe('R512 book.vue 复习作答卡源锁', () => {
  it('选项循环走 curOpts 且渲染 opt-t 文本', () => {
    expect(src).toMatch(/v-for="o in curOpts"/);
    expect(src).toMatch(/<text v-if="o\.t" class="opt-t"/);
    expect(src).toMatch(/:class="\[curOptFull \? 'full' : 'num', optClass\(o\.k\)\]"/);
    expect(src).toMatch(/@click="pick\(o\.k\)"/);
    expect(src).not.toMatch(/v-for="o in \['A', 'B', 'C', 'D'\]"/);
  });
  it('整行选项样式存在', () => {
    expect(src).toMatch(/\.opts\.full \{ flex-direction: column; \}/);
    expect(src).toMatch(/\.opt\.full \{[^}]*justify-content: flex-start/);
  });
  it('AI 详解预填不再丢选项（复习卡 / 列表「问 AI」）', () => {
    expect(src).toMatch(/askPrefill\(this\.cur\.question_text, this\.cur\.options\)/);
    expect(src).toMatch(/askPrefill\(m\.question_text, m\.options\)/);
    expect(src).not.toMatch(/askPrefill\([^)]*, null\)/);
    expect(askPrefill('题干', { A: '甲', B: '乙' })).toBe('题干\nA.甲 B.乙');
  });
});
