import { describe, it, expect } from 'vitest';
import { reviewedMasteredCount, fixReportText } from '../src/review-advance.js';

describe('R371 reviewedMasteredCount', () => {
  it('只统计 mastered === true 的条目', () => {
    expect(reviewedMasteredCount([
      { mistake_id: 1, streak: 6, mastered: true },
      { mistake_id: 2, streak: 1, mastered: false },
      { mistake_id: 3, streak: 2, mastered: 1 },
      null,
    ])).toBe(1);
  });
  it('非数组/空 → 0', () => {
    expect(reviewedMasteredCount(undefined)).toBe(0);
    expect(reviewedMasteredCount([])).toBe(0);
    expect(reviewedMasteredCount('x')).toBe(0);
  });
});

describe('R371 fixReportText', () => {
  it('有推进无掌握', () => {
    expect(fixReportText({ n: 3, mastered: 0 })).toBe('本组答对 3 道曾错题，复习计划已推进');
  });
  it('有掌握追加括注', () => {
    expect(fixReportText({ n: 2, mastered: 1 })).toBe('本组答对 2 道曾错题，复习计划已推进（1 道达成掌握）');
  });
  it('无推进 → 空串（模板不渲染）', () => {
    expect(fixReportText(null)).toBe('');
    expect(fixReportText({ n: 0, mastered: 0 })).toBe('');
  });
});
