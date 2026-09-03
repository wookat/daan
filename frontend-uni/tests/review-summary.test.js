import { describe, it, expect } from 'vitest';
import { reviewSummary } from '../src/review-summary.js';

describe('reviewSummary', () => {
  it('非数组/空 fail-closed 返回 null', () => {
    expect(reviewSummary(null)).toBeNull();
    expect(reviewSummary(undefined)).toBeNull();
    expect(reviewSummary({})).toBeNull();
    expect(reviewSummary([])).toBeNull();
  });

  it('到期题按 _res 首答统计并计算正确率', () => {
    const s = reviewSummary([
      { question_text: 'a', _res: true },
      { question_text: 'b', _res: false },
      { question_text: 'c', _res: true },
    ]);
    expect(s.due).toBe(3);
    expect(s.dueRight).toBe(2);
    expect(s.dueWrong).toBe(1);
    expect(s.pct).toBe(67);
    expect(s.extra).toBe(0);
    expect(s.corrected).toBe(0);
  });

  it('requeue 复制体计入纠正/未纠正，不进 due 口径', () => {
    const s = reviewSummary([
      { question_text: 'a', _res: false },
      { question_text: 'a', _requeued: true, _res: true },
      { question_text: 'b', _res: false },
      { question_text: 'b', _requeued: true, _res: false },
    ]);
    expect(s.due).toBe(2);
    expect(s.dueWrong).toBe(2);
    expect(s.corrected).toBe(1);
    expect(s.uncorrected).toBe(1);
    expect(s.pct).toBe(0);
  });

  it('加练 _extra 独立统计', () => {
    const s = reviewSummary([
      { question_text: 'a', _res: true },
      { question_text: 'x', _extra: true, _res: true },
      { question_text: 'y', _extra: true, _res: false },
    ]);
    expect(s.due).toBe(1);
    expect(s.extra).toBe(2);
    expect(s.extraRight).toBe(1);
    expect(s.extraWrong).toBe(1);
    expect(s.pct).toBe(100);
  });

  it('无 _res 的旧快照条目不计入分子分母', () => {
    const s = reviewSummary([
      { question_text: 'a' },
      { question_text: 'b', _res: true },
      { question_text: 'x', _extra: true },
      null,
    ]);
    expect(s.due).toBe(2);
    expect(s.dueRight).toBe(1);
    expect(s.dueWrong).toBe(0);
    expect(s.pct).toBe(100);
    expect(s.extra).toBe(1);
    expect(s.extraRight).toBe(0);
  });
});
