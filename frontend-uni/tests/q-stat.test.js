import { describe, it, expect } from 'vitest';
import { qStatLine } from '../src/q-stat.js';

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
