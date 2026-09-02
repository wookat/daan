import { describe, it, expect } from 'vitest';
import { buildPaceRows, fmtMin } from '../src/exam-pace.js';

describe('buildPaceRows', () => {
  const pm = {
    changshi: { n: 10, answered: 10, correct: 7, secs: 300 },
    ziliao: { n: 10, answered: 8, correct: 5, secs: 900 },
  };

  it('按题量占比折算参考用时并判定配速', () => {
    const rows = buildPaceRows(pm, 20, 20);
    const cs = rows.find((r) => r.key === 'changshi');
    const zl = rows.find((r) => r.key === 'ziliao');
    expect(cs.refSecs).toBe(600);
    expect(cs.status).toBe('fast');
    expect(zl.refSecs).toBe(600);
    expect(zl.status).toBe('over');
  });

  it('用时落在 0.6–1.2 倍参考区间判定合理', () => {
    const rows = buildPaceRows({ yanyu: { n: 10, correct: 6, secs: 600 } }, 10, 10);
    expect(rows[0].status).toBe('ok');
  });

  it('durationMin/total 非法返回空', () => {
    expect(buildPaceRows(pm, 0, 20)).toEqual([]);
    expect(buildPaceRows(pm, 20, 0)).toEqual([]);
    expect(buildPaceRows(pm, undefined, null)).toEqual([]);
  });

  it('历史 attempt 全模块 secs 为 0 返回空（不伪造配速）', () => {
    expect(buildPaceRows({ changshi: { n: 10, correct: 7, secs: 0 }, ziliao: { n: 10, correct: 5 } }, 20, 20)).toEqual([]);
  });

  it('空 perModule 返回空', () => {
    expect(buildPaceRows({}, 20, 20)).toEqual([]);
    expect(buildPaceRows(null, 20, 20)).toEqual([]);
  });
});

describe('fmtMin', () => {
  it('分秒短格式', () => {
    expect(fmtMin(0)).toBe('0秒');
    expect(fmtMin(45)).toBe('45秒');
    expect(fmtMin(60)).toBe('1分');
    expect(fmtMin(605)).toBe('10分5秒');
    expect(fmtMin(-3)).toBe('0秒');
  });
});
