import { describe, it, expect } from 'vitest';
import { reviewFilter, reviewStep } from '../src/exam-review.js';

const items = [
  { no: 1, picked: 'A', correct: true },
  { no: 2, picked: 'B', correct: false },
  { no: 3, picked: '', correct: false },
  { no: 4, picked: 'C', correct: true },
  { no: 5, picked: 'D', correct: false },
];

describe('reviewFilter', () => {
  it('全部模式返回原序列', () => {
    expect(reviewFilter(items, false).map((it) => it.no)).toEqual([1, 2, 3, 4, 5]);
  });

  it('只看错题模式收答错+未答', () => {
    expect(reviewFilter(items, true).map((it) => it.no)).toEqual([2, 3, 5]);
  });

  it('非数组容错为空', () => {
    expect(reviewFilter(null, false)).toEqual([]);
    expect(reviewFilter(undefined, true)).toEqual([]);
  });
});

describe('reviewStep', () => {
  it('全部模式正反向按卷面顺序步进', () => {
    expect(reviewStep(items, 2, 1, false).no).toBe(3);
    expect(reviewStep(items, 2, -1, false).no).toBe(1);
  });

  it('只看错题模式跳过答对题', () => {
    expect(reviewStep(items, 2, 1, true).no).toBe(3);
    expect(reviewStep(items, 3, 1, true).no).toBe(5);
    expect(reviewStep(items, 5, -1, true).no).toBe(3);
  });

  it('过滤态从非序列题进入：向后取首题、向前取末题', () => {
    expect(reviewStep(items, 4, 1, true).no).toBe(2);
    expect(reviewStep(items, 4, -1, true).no).toBe(5);
  });

  it('越界返回 null', () => {
    expect(reviewStep(items, 5, 1, false)).toBeNull();
    expect(reviewStep(items, 1, -1, false)).toBeNull();
    expect(reviewStep(items, 5, 1, true)).toBeNull();
    expect(reviewStep(items, 2, -1, true)).toBeNull();
  });

  it('空序列/非法输入返回 null', () => {
    expect(reviewStep([], 1, 1, false)).toBeNull();
    expect(reviewStep([{ no: 1, correct: true }], 1, 1, true)).toBeNull();
    expect(reviewStep(items, 2, 0, false)).toBeNull();
    expect(reviewStep(null, 2, 1, false)).toBeNull();
  });
});
