// R514：复习答错后「同类题自动加练」/「练 3 道同类题」的子模块口径 + 加练条目作答卡铺选项
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { similarSubmodule, similarItemFromQuestion } from '../src/review-similar.js';
import { reviewOptions, reviewOptionsFull } from '../src/review-opts.js';
import { askPrefill } from '../src/ask-prefill.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8')+readFileSync(new URL('../src/pages/book/review-ops.js', import.meta.url), 'utf8');

describe('similarSubmodule（题库联查 submodule，不再从 question_type 反推）', () => {
  it('有联查 submodule 用之', () => {
    expect(similarSubmodule({ module: 'ziliao', question_type: '增长率', submodule: '综合分析' })).toBe('综合分析');
    expect(similarSubmodule({ submodule: ' 定义判断 ' })).toBe('定义判断');
  });
  it('无 submodule 回 null（只按模块抽），不用 question_type 拆「-」', () => {
    expect(similarSubmodule({ module: 'panduan', question_type: '定义判断' })).toBe(null);
    expect(similarSubmodule({ module: 'yanyu', question_type: '言语理解-逻辑填空', submodule: null })).toBe(null);
    expect(similarSubmodule({ submodule: '' })).toBe(null);
    expect(similarSubmodule({ submodule: 12 })).toBe(null);
    expect(similarSubmodule(null)).toBe(null);
  });
});

describe('similarItemFromQuestion 加练条目 → 作答卡/AI 预填', () => {
  const Q = {
    id: 264167,
    module: 'panduan',
    submodule: '逻辑判断',
    question_type: '判断推理-逻辑判断',
    question: '一项心理学研究认为……',
    options: { A: '仅Ⅰ', B: '仅Ⅱ', C: '仅Ⅰ和Ⅱ', D: 'Ⅰ、Ⅱ和Ⅲ' },
    answer: 'D',
  };
  it('结构化选项有效 → 作答卡整行铺选项文本、题干不重复选项', () => {
    const it_ = similarItemFromQuestion(Q);
    const opts = reviewOptions(it_);
    expect(reviewOptionsFull(opts)).toBe(true);
    expect(opts.map((o) => o.k + '.' + o.t)).toEqual(['A.仅Ⅰ', 'B.仅Ⅱ', 'C.仅Ⅰ和Ⅱ', 'D.Ⅰ、Ⅱ和Ⅲ']);
    expect(it_.question_text).toBe('一项心理学研究认为……');
    expect(it_.submodule).toBe('逻辑判断');
    expect(askPrefill(it_.question_text, it_.options)).toBe('一项心理学研究认为……\nA.仅Ⅰ B.仅Ⅱ C.仅Ⅰ和Ⅱ D.Ⅰ、Ⅱ和Ⅲ');
  });
  it('结构化选项无效（<2 项/空值）→ 回退拼进题干、options null、作答卡裸字母', () => {
    const it_ = similarItemFromQuestion({ ...Q, options: { A: '仅Ⅰ' } });
    expect(it_.options).toBe(null);
    expect(it_.question_text).toBe('一项心理学研究认为……\nA.仅Ⅰ');
    expect(reviewOptionsFull(reviewOptions(it_))).toBe(false);
    expect(similarItemFromQuestion({ ...Q, options: null }).question_text).toBe('一项心理学研究认为……\n');
    expect(similarItemFromQuestion({ ...Q, submodule: '' }).submodule).toBe(null);
  });
});

describe('book.vue 源锁', () => {
  it('appendSimilar / practiceSimilar 走 similarSubmodule（不再从 question_type split("-") 取 null）；reinforceFromMistake 优先题库 submodule', () => {
    expect(BOOK).toMatch(/import \{[^}]*\bsimilarSubmodule\b[^}]*\} from '\.\.\/\.\.\/review-similar\.js'/);
    expect(BOOK).toContain('const sub = similarSubmodule(m);');
    expect(BOOK).toContain("uni.setStorageSync('practicePreset', { module: m.module, submodule: similarSubmodule(m), count: 3 });");
    expect(BOOK).toContain('submodule: similarSubmodule(m) || sub, tag3: m.tag3');
    expect(BOOK).not.toMatch(/qt\.split\('-'\)\.slice\(1\)\.join\('-'\) : null/);
  });
});
