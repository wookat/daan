// R315：成绩报告逐题用时锚点纯函数
import { describe, it, expect } from 'vitest';
import { fmtSecs, paperAvgSecs, qTimeLine } from '../src/exam-time.js';

describe('fmtSecs', () => {
  it('秒级', () => expect(fmtSecs(45)).toBe('45 秒'));
  it('分+秒', () => expect(fmtSecs(80)).toBe('1 分 20 秒'));
  it('整分', () => expect(fmtSecs(120)).toBe('2 分'));
  it('四舍五入', () => expect(fmtSecs(59.6)).toBe('1 分'));
  it('非正数/非法 fail-closed', () => {
    expect(fmtSecs(0)).toBeNull();
    expect(fmtSecs(-5)).toBeNull();
    expect(fmtSecs(null)).toBeNull();
    expect(fmtSecs(undefined)).toBeNull();
    expect(fmtSecs('45')).toBeNull();
    expect(fmtSecs(NaN)).toBeNull();
    expect(fmtSecs(Infinity)).toBeNull();
  });
});

describe('paperAvgSecs', () => {
  it('仅统计 secs>0 的题并取整', () => {
    const items = [{ secs: 30 }, { secs: 40 }, { secs: 50 }, { secs: null }, {}];
    expect(paperAvgSecs(items)).toBe(40);
  });
  it('有效题 <3 返回 null', () => {
    expect(paperAvgSecs([{ secs: 30 }, { secs: 40 }])).toBeNull();
    expect(paperAvgSecs([])).toBeNull();
  });
  it('非数组 fail-closed', () => {
    expect(paperAvgSecs(null)).toBeNull();
    expect(paperAvgSecs(undefined)).toBeNull();
  });
  it('过滤非法值', () => {
    expect(paperAvgSecs([{ secs: '30' }, { secs: -1 }, { secs: 0 }])).toBeNull();
  });
});

describe('qTimeLine', () => {
  it('本题 + 全卷平均', () => {
    expect(qTimeLine(45, 38)).toBe('本题用时 45 秒 · 全卷平均 38 秒/题');
  });
  it('无均值只出本题', () => {
    expect(qTimeLine(45, null)).toBe('本题用时 45 秒');
  });
  it('本题无有效用时整行不渲染', () => {
    expect(qTimeLine(null, 38)).toBeNull();
    expect(qTimeLine(0, 38)).toBeNull();
  });
});
