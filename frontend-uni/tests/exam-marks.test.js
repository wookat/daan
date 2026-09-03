import { describe, it, expect } from 'vitest';
import { markedNos, nextNavMode } from '../src/exam-marks.js';
import { reviewFilter, reviewStep } from '../src/exam-review.js';

const items = [
  { no: 1, picked: 'A', correct: true, marked: true },
  { no: 2, picked: 'B', correct: false, marked: false },
  { no: 3, picked: '', correct: false, marked: true },
  { no: 4, picked: 'C', correct: true },
];

describe('markedNos', () => {
  it('返回标记题号（含答对但标记的题）', () => {
    expect(markedNos(items)).toEqual([1, 3]);
  });

  it('旧报告无 marked 字段/非法输入返回空', () => {
    expect(markedNos([{ no: 1, correct: true }])).toEqual([]);
    expect(markedNos(null)).toEqual([]);
    expect(markedNos('x')).toEqual([]);
    expect(markedNos([null, { marked: true }])).toEqual([]);
  });

  it('不修改输入', () => {
    const src = [{ no: 1, marked: true }];
    const copy = JSON.parse(JSON.stringify(src));
    markedNos(src);
    expect(src).toEqual(copy);
  });
});

describe('nextNavMode', () => {
  it('有标记时三态循环 all→wrong→marked→all', () => {
    expect(nextNavMode('all', true)).toBe('wrong');
    expect(nextNavMode('wrong', true)).toBe('marked');
    expect(nextNavMode('marked', true)).toBe('all');
  });

  it('无标记时跳过 marked 档', () => {
    expect(nextNavMode('all', false)).toBe('wrong');
    expect(nextNavMode('wrong', false)).toBe('all');
  });

  it('非法模式回落 all', () => {
    expect(nextNavMode('bogus', true)).toBe('all');
  });
});

describe('reviewFilter/reviewStep marked 模式', () => {
  it('只看标记模式仅保留 marked 题（不要求答错）', () => {
    expect(reviewFilter(items, 'marked').map((it) => it.no)).toEqual([1, 3]);
  });

  it('marked 模式步进', () => {
    expect(reviewStep(items, 1, 1, 'marked').no).toBe(3);
    expect(reviewStep(items, 3, -1, 'marked').no).toBe(1);
    expect(reviewStep(items, 3, 1, 'marked')).toBeNull();
  });

  it('字符串三态与旧布尔调用兼容', () => {
    expect(reviewFilter(items, 'wrong').map((it) => it.no)).toEqual([2, 3]);
    expect(reviewFilter(items, true).map((it) => it.no)).toEqual([2, 3]);
    expect(reviewFilter(items, 'all').map((it) => it.no)).toEqual([1, 2, 3, 4]);
    expect(reviewFilter(items, false).map((it) => it.no)).toEqual([1, 2, 3, 4]);
  });
});
