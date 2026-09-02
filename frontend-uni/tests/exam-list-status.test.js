import { describe, it, expect } from 'vitest';
import { filterPapersByStatus } from '../src/exam-list-status.js';

const rows = [
  { id: 1, best_score: 12.5 },
  { id: 2, best_score: null },
  { id: 3, best_score: 0 },
  { id: 4 },
];

describe('filterPapersByStatus', () => {
  it('非数组回空数组', () => {
    expect(filterPapersByStatus(null, 'todo')).toEqual([]);
    expect(filterPapersByStatus(undefined, 'done')).toEqual([]);
    expect(filterPapersByStatus({}, 'todo')).toEqual([]);
  });

  it('非法 st 原样返回全部', () => {
    expect(filterPapersByStatus(rows, '')).toBe(rows);
    expect(filterPapersByStatus(rows, 'x')).toBe(rows);
    expect(filterPapersByStatus(rows, null)).toBe(rows);
  });

  it('todo 只留 best_score 为空的卷（0 分算考过）', () => {
    expect(filterPapersByStatus(rows, 'todo').map((p) => p.id)).toEqual([2, 4]);
  });

  it('done 只留考过的卷', () => {
    expect(filterPapersByStatus(rows, 'done').map((p) => p.id)).toEqual([1, 3]);
  });

  it('输入不可变', () => {
    const snap = JSON.stringify(rows);
    filterPapersByStatus(rows, 'todo');
    filterPapersByStatus(rows, 'done');
    expect(JSON.stringify(rows)).toBe(snap);
  });
});
