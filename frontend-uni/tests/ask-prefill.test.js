import { describe, it, expect } from 'vitest';
import { askPrefill, askAnswerLetter } from '../src/ask-prefill.js';

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

describe('askAnswerLetter', () => {
  it('extracts single letter', () => {
    expect(askAnswerLetter('A')).toBe('A');
    expect(askAnswerLetter(' b ')).toBe('B');
    expect(askAnswerLetter('C.选项文字')).toBe('C');
  });
  it('fails closed on multi-select', () => {
    expect(askAnswerLetter('AC')).toBe('');
    expect(askAnswerLetter('ABD')).toBe('');
  });
  it('fails closed on invalid or empty', () => {
    expect(askAnswerLetter('')).toBe('');
    expect(askAnswerLetter(null)).toBe('');
    expect(askAnswerLetter(undefined)).toBe('');
    expect(askAnswerLetter('E')).toBe('');
    expect(askAnswerLetter(5)).toBe('');
    expect(askAnswerLetter('正确')).toBe('');
  });
});
