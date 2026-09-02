import { describe, it, expect } from 'vitest';
import { EXAM_LIST_PATH, buildExamListUrl, parseExamListOpts } from '../src/exam-list-url.js';

describe('buildExamListUrl', () => {
  it('全默认回落基础路径', () => {
    expect(buildExamListUrl()).toBe(EXAM_LIST_PATH);
    expect(buildExamListUrl({ year: null, region: null })).toBe(EXAM_LIST_PATH);
    expect(buildExamListUrl({ year: 0, region: '' })).toBe(EXAM_LIST_PATH);
  });

  it('year/region 组合拼接（region 编码）', () => {
    expect(buildExamListUrl({ year: 2023 })).toBe(EXAM_LIST_PATH + '?year=2023');
    expect(buildExamListUrl({ region: '江苏' })).toBe(EXAM_LIST_PATH + '?region=' + encodeURIComponent('江苏'));
    expect(buildExamListUrl({ year: 2024, region: '上海' })).toBe(
      EXAM_LIST_PATH + '?year=2024&region=' + encodeURIComponent('上海')
    );
  });

  it('非法 year 忽略', () => {
    expect(buildExamListUrl({ year: 1980 })).toBe(EXAM_LIST_PATH);
    expect(buildExamListUrl({ year: 'abc' })).toBe(EXAM_LIST_PATH);
    expect(buildExamListUrl({ year: 2023.5 })).toBe(EXAM_LIST_PATH);
  });
});

describe('parseExamListOpts', () => {
  it('合法收参', () => {
    expect(parseExamListOpts({ year: '2023', region: encodeURIComponent('江苏') })).toEqual({
      year: 2023,
      region: '江苏',
    });
  });

  it('非法回空', () => {
    expect(parseExamListOpts({ year: 'x', region: 3 })).toEqual({ year: 0, region: '' });
    expect(parseExamListOpts({ year: '1899' })).toEqual({ year: 0, region: '' });
    expect(parseExamListOpts()).toEqual({ year: 0, region: '' });
    expect(parseExamListOpts({ region: '%E4%B8%8A%E6%B5%B7' })).toEqual({ year: 0, region: '上海' });
    expect(parseExamListOpts({ region: '%zz' })).toEqual({ year: 0, region: '' });
  });
});
