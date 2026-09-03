import { describe, it, expect } from 'vitest';
import { askPrefill } from '../src/ask-prefill.js';

describe('askPrefill', () => {
  it('joins stem and options', () => {
    expect(askPrefill('题干', { A: '甲', B: '乙' })).toBe('题干\nA.甲 B.乙');
  });
  it('stem only when options missing or empty', () => {
    expect(askPrefill('题干', null)).toBe('题干');
    expect(askPrefill('题干', {})).toBe('题干');
    expect(askPrefill('题干', [])).toBe('题干');
  });
  it('skips non-string or blank option values', () => {
    expect(askPrefill('题干', { A: '甲', B: '', C: 3 })).toBe('题干\nA.甲');
  });
  it('fails closed on invalid stem', () => {
    expect(askPrefill('', { A: 'x' })).toBe('');
    expect(askPrefill('   ', { A: 'x' })).toBe('');
    expect(askPrefill(null, { A: 'x' })).toBe('');
    expect(askPrefill(5, { A: 'x' })).toBe('');
  });
  it('trims stem', () => {
    expect(askPrefill('  题干  ', null)).toBe('题干');
  });
});
