import { describe, it, expect } from 'vitest';
import { isExplanationCovered } from '../src/exp-dup.js';

const EXPL = '第一步，本题考查增长率计算。第二步，根据材料 2019 年同比增长 12.5%，故选 A。';

describe('isExplanationCovered', () => {
  it('hs 全文包含 ≥20 字解析 → true（含首尾空白）', () => {
    expect(isExplanationCovered('【方法】' + EXPL + '【总结】速算即可。', EXPL)).toBe(true);
    expect(isExplanationCovered('前言 ' + EXPL, '  ' + EXPL + '\n')).toBe(true);
  });

  it('hs 不包含 → false', () => {
    expect(isExplanationCovered('花生十三：直接看选项差值即可。', EXPL)).toBe(false);
    expect(isExplanationCovered('', EXPL)).toBe(false);
  });

  it('短文本边界：trim 后 <20 字一律 false，恰 20 字 true', () => {
    const s19 = '一二三四五六七八九十一二三四五六七八九';
    const s20 = s19 + '十';
    expect(isExplanationCovered('前缀' + s19 + '后缀', s19)).toBe(false);
    expect(isExplanationCovered('前缀' + s20 + '后缀', s20)).toBe(true);
    expect(isExplanationCovered('前缀' + s20 + '后缀', '   ')).toBe(false);
  });

  it('非字符串入参 fail-closed', () => {
    expect(isExplanationCovered(null, EXPL)).toBe(false);
    expect(isExplanationCovered(EXPL, undefined)).toBe(false);
    expect(isExplanationCovered(EXPL, 123)).toBe(false);
  });
});
