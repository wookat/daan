import { describe, it, expect } from 'vitest';
import { parseExamProgress, fmtLeftSecs } from '../src/exam-resume.js';

const NOW = 1_700_000_000_000;

function saved(over = {}) {
  return {
    attemptId: 9,
    paperId: 5,
    mini: false,
    paper: { id: 5, title: '2025年四川真题卷' },
    items: [{ _picked: 'A' }, { _picked: '' }, {}],
    idx: 1,
    endAt: NOW + 90_000,
    ...over,
  };
}

describe('parseExamProgress', () => {
  it('有效进度产出续考数据', () => {
    expect(parseExamProgress(saved(), NOW)).toEqual({
      paperId: 5,
      mini: false,
      title: '2025年四川真题卷',
      answered: 1,
      total: 3,
      leftSecs: 90,
    });
  });

  it('mini 进度 paperId 归零并回落标题', () => {
    const r = parseExamProgress(saved({ mini: true, paper: null, paperId: null }), NOW);
    expect(r.mini).toBe(true);
    expect(r.paperId).toBe(0);
    expect(r.title).toBe('迷你模考');
  });

  it('无效/过期返回 null', () => {
    expect(parseExamProgress(null, NOW)).toBeNull();
    expect(parseExamProgress('', NOW)).toBeNull();
    expect(parseExamProgress(saved({ attemptId: 0 }), NOW)).toBeNull();
    expect(parseExamProgress(saved({ items: [] }), NOW)).toBeNull();
    expect(parseExamProgress(saved({ items: null }), NOW)).toBeNull();
    expect(parseExamProgress(saved({ endAt: NOW }), NOW)).toBeNull();
    expect(parseExamProgress(saved({ endAt: 'x' }), NOW)).toBeNull();
  });
});

describe('fmtLeftSecs', () => {
  it('格式化剩余时间', () => {
    expect(fmtLeftSecs(90)).toBe('1:30');
    expect(fmtLeftSecs(5)).toBe('0:05');
    expect(fmtLeftSecs(-3)).toBe('0:00');
    expect(fmtLeftSecs('x')).toBe('0:00');
  });
});
