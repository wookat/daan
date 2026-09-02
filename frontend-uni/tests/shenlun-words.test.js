import { describe, it, expect } from 'vitest';
import { parseWordLimit, wordState } from '../src/shenlun-words.js';

describe('shenlun-words parseWordLimit', () => {
  it('不超过N字', () => {
    expect(parseWordLimit('要求：不超过 300 字。')).toEqual({ label: '≤300字', max: 300 });
  });
  it('区间：全角～/半角-/至', () => {
    expect(parseWordLimit('字数1000～1200字')).toEqual({ label: '1000–1200字', max: 1200 });
    expect(parseWordLimit('800-1000字')).toEqual({ label: '800–1000字', max: 1000 });
    expect(parseWordLimit('500至600字')).toEqual({ label: '500–600字', max: 600 });
  });
  it('N字左右：只展示不判色', () => {
    expect(parseWordLimit('200字左右')).toEqual({ label: '200字左右', max: 0 });
  });
  it('不少于N字：只展示不判色', () => {
    expect(parseWordLimit('不少于800字')).toEqual({ label: '≥800字', max: 0 });
  });
  it('无字数要求返回 null', () => {
    expect(parseWordLimit('谈谈你的理解。')).toBeNull();
    expect(parseWordLimit('')).toBeNull();
    expect(parseWordLimit(null)).toBeNull();
  });
});

describe('shenlun-words wordState', () => {
  const lim = { label: '≤300字', max: 300 };
  it('over/near/空 边界', () => {
    expect(wordState(301, lim)).toBe('over');
    expect(wordState(300, lim)).toBe('near');
    expect(wordState(270, lim)).toBe('near');
    expect(wordState(269, lim)).toBe('');
  });
  it('无显式上限不判色', () => {
    expect(wordState(9999, { label: '200字左右', max: 0 })).toBe('');
    expect(wordState(10, null)).toBe('');
  });
});
