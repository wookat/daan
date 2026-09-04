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
    // 部分作答：参考用时按已答 8/10 折算
    expect(zl.refSecs).toBe(480);
    expect(zl.answered).toBe(8);
    expect(zl.status).toBe('over');
  });

  it('整模块未作答标 skip，不判偏快', () => {
    const rows = buildPaceRows(
      { changshi: { n: 10, answered: 10, correct: 7, secs: 600 }, shuliang: { n: 10, answered: 0, correct: 0, secs: 0 } },
      20,
      20
    );
    const sl = rows.find((r) => r.key === 'shuliang');
    expect(sl.status).toBe('skip');
    expect(sl.answered).toBe(0);
    expect(sl.refSecs).toBe(600);
    expect(rows.find((r) => r.key === 'changshi').status).toBe('ok');
  });

  it('部分作答按已答题数折算后判定（答 5/10 用 300s 为合理而非偏快）', () => {
    const rows = buildPaceRows({ yanyu: { n: 10, answered: 5, correct: 3, secs: 300 } }, 10, 10);
    expect(rows[0].refSecs).toBe(300);
    expect(rows[0].status).toBe('ok');
    expect(rows[0].n).toBe(10);
  });

  it('answered 缺失（旧 attempt）视为全部作答', () => {
    const rows = buildPaceRows({ yanyu: { n: 10, correct: 6, secs: 200 } }, 10, 10);
    expect(rows[0].answered).toBe(10);
    expect(rows[0].refSecs).toBe(600);
    expect(rows[0].status).toBe('fast');
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
