import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { qSourceText, qStatLine } from '../src/q-stat.js';

describe('qStatLine', () => {
  it('样本不足 5 人次不产出', () => {
    expect(qStatLine({ attempt_count: 4, correct_ratio: 50 })).toBe('');
    expect(qStatLine({ attempt_count: 0, correct_ratio: 50 })).toBe('');
  });

  it('correct_ratio 为 null 不产出', () => {
    expect(qStatLine({ attempt_count: 10, correct_ratio: null })).toBe('');
  });

  it('空/缺字段容错', () => {
    expect(qStatLine(null)).toBe('');
    expect(qStatLine(undefined)).toBe('');
    expect(qStatLine({})).toBe('');
  });

  it('基础行：正确率与人次外显', () => {
    expect(qStatLine({ attempt_count: 12, correct_ratio: 90 })).toBe('难度★ · 全站正确率 90%（12 人次）');
  });

  it('星级分档边界', () => {
    expect(qStatLine({ attempt_count: 5, correct_ratio: 86 })).toContain('难度★ ·');
    expect(qStatLine({ attempt_count: 5, correct_ratio: 85 })).toContain('难度★★ ·');
    expect(qStatLine({ attempt_count: 5, correct_ratio: 71 })).toContain('难度★★ ·');
    expect(qStatLine({ attempt_count: 5, correct_ratio: 70 })).toContain('难度★★★ ·');
    expect(qStatLine({ attempt_count: 5, correct_ratio: 56 })).toContain('难度★★★ ·');
    expect(qStatLine({ attempt_count: 5, correct_ratio: 55 })).toContain('难度★★★★ ·');
    expect(qStatLine({ attempt_count: 5, correct_ratio: 41 })).toContain('难度★★★★ ·');
    expect(qStatLine({ attempt_count: 5, correct_ratio: 40 })).toContain('难度★★★★★ ·');
    expect(qStatLine({ attempt_count: 5, correct_ratio: 0 })).toContain('难度★★★★★ ·');
  });

  it('易错项 ≠ 正确答案才追加', () => {
    expect(qStatLine({ attempt_count: 8, correct_ratio: 60, most_wrong: 'B', answer: 'A' })).toContain('易错项 B');
    expect(qStatLine({ attempt_count: 8, correct_ratio: 60, most_wrong: 'A', answer: 'A' })).not.toContain('易错项');
    expect(qStatLine({ attempt_count: 8, correct_ratio: 60, most_wrong: '', answer: 'A' })).not.toContain('易错项');
  });
});

describe('qSourceText（与小程序 utils/q-stat.ts sourceLabel 同口径）', () => {
  it('库内占位值 original/unknown/ai 回空串', () => {
    expect(qSourceText('original')).toBe('');
    expect(qSourceText('unknown')).toBe('');
    expect(qSourceText('ai')).toBe('');
  });

  it('占位值大小写/首尾空白不敏感', () => {
    expect(qSourceText('Original')).toBe('');
    expect(qSourceText('UNKNOWN')).toBe('');
    expect(qSourceText(' AI ')).toBe('');
  });

  it('空/缺值容错', () => {
    expect(qSourceText('')).toBe('');
    expect(qSourceText('   ')).toBe('');
    expect(qSourceText(null)).toBe('');
    expect(qSourceText(undefined)).toBe('');
  });

  it('真实来源原样透出（仅 trim）', () => {
    expect(qSourceText('2025年河北省考行测真题')).toBe('2025年河北省考行测真题');
    expect(qSourceText(' 2024 国考·行测 ')).toBe('2024 国考·行测');
    expect(qSourceText('original-2024')).toBe('original-2024');
  });

  it('kg-analysis-card 来源行走 sourceText（v-if 与插值均不直用 source 原串）', () => {
    const vue = readFileSync(new URL('../src/components/kg-analysis-card/kg-analysis-card.vue', import.meta.url), 'utf8');
    expect(vue).toContain('<text v-if="sourceText" class="kg-ana__src">来源：{{ sourceText }}</text>');
    expect(vue).not.toMatch(/来源：\{\{\s*source\s*\}\}/);
    expect(vue).toMatch(/sourceText\(\)\s*\{\s*return qSourceText\(this\.source\)/);
  });

  it('App.vue H5 壳层 body 声明 font-family token（uni-modal/toast 在 page 外）', () => {
    const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
    const h5 = app.slice(app.indexOf('/* #ifdef H5 */'), app.indexOf('/* #endif */'));
    expect(h5).toMatch(/\nbody \{[^}]*font-family: var\(--font-sans\);[^}]*\}/);
  });
});
