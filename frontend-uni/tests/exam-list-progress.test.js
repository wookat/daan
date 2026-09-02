import { describe, it, expect } from 'vitest';
import { paperProgress } from '../src/exam-list-progress.js';

describe('paperProgress', () => {
  it('非数组/空数组 fail-closed', () => {
    expect(paperProgress(null)).toEqual({ done: 0, total: 0, pct: 0 });
    expect(paperProgress(undefined)).toEqual({ done: 0, total: 0, pct: 0 });
    expect(paperProgress({})).toEqual({ done: 0, total: 0, pct: 0 });
    expect(paperProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it('混合计数：0 分算考过，null/缺失算没考', () => {
    const rows = [
      { id: 1, best_score: 12.5 },
      { id: 2, best_score: null },
      { id: 3, best_score: 0 },
      { id: 4 },
      null,
    ];
    expect(paperProgress(rows)).toEqual({ done: 2, total: 5, pct: 40 });
  });

  it('全没考 / 全考过', () => {
    expect(paperProgress([{ best_score: null }, {}])).toEqual({ done: 0, total: 2, pct: 0 });
    expect(paperProgress([{ best_score: 1 }, { best_score: 0 }])).toEqual({ done: 2, total: 2, pct: 100 });
  });

  it('pct 四舍五入', () => {
    const rows = [{ best_score: 1 }, {}, {}];
    expect(paperProgress(rows).pct).toBe(33);
  });

  it('输入不可变', () => {
    const rows = [{ id: 1, best_score: 5 }, { id: 2, best_score: null }];
    const snap = JSON.stringify(rows);
    paperProgress(rows);
    expect(JSON.stringify(rows)).toBe(snap);
  });
});
