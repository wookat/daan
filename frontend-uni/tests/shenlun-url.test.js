import { describe, it, expect } from 'vitest';
import { buildShenlunUrl, buildShenlunPaperUrl, buildShenlunFilterUrl, buildShenlunMatUrl, SHENLUN_PATH } from '../src/shenlun-url.js';

describe('buildShenlunPaperUrl', () => {
  it('encodes paper name into ?paper deeplink', () => {
    expect(buildShenlunPaperUrl('2026广东省考·省市卷')).toBe(SHENLUN_PATH + '?paper=' + encodeURIComponent('2026广东省考·省市卷'));
  });
  it('falls back to base path for empty/non-string/overlong', () => {
    expect(buildShenlunPaperUrl('')).toBe(SHENLUN_PATH);
    expect(buildShenlunPaperUrl(null)).toBe(SHENLUN_PATH);
    expect(buildShenlunPaperUrl(123)).toBe(SHENLUN_PATH);
    expect(buildShenlunPaperUrl('x'.repeat(101))).toBe(SHENLUN_PATH);
  });
});

describe('buildShenlunFilterUrl', () => {
  it('组合多维筛选为深链，值编码', () => {
    expect(buildShenlunFilterUrl({ paper: '2026广东省考·省市卷' })).toBe(SHENLUN_PATH + '?paper=' + encodeURIComponent('2026广东省考·省市卷'));
    expect(buildShenlunFilterUrl({ qtype: '归纳概括', year: 2023, region: '江苏' })).toBe(
      SHENLUN_PATH + '?qtype=' + encodeURIComponent('归纳概括') + '&year=2023&region=' + encodeURIComponent('江苏'),
    );
  });
  it('缺省/非法维度不带参，全缺省回落基础路径', () => {
    expect(buildShenlunFilterUrl()).toBe(SHENLUN_PATH);
    expect(buildShenlunFilterUrl({ paper: '', qtype: '全部', year: 0, region: '' })).toBe(SHENLUN_PATH);
    expect(buildShenlunFilterUrl({ paper: 'x'.repeat(101), qtype: null, year: 'abc', region: 0 })).toBe(SHENLUN_PATH);
    expect(buildShenlunFilterUrl({ year: 2023 })).toBe(SHENLUN_PATH + '?year=2023');
  });
});

describe('buildShenlunUrl', () => {
  it('合法 id 生成 ?id 深链', () => {
    expect(buildShenlunUrl(118)).toBe(SHENLUN_PATH + '?id=118');
    expect(buildShenlunUrl('42')).toBe(SHENLUN_PATH + '?id=42');
  });
  it('无/非法 id 回落专区路径', () => {
    expect(buildShenlunUrl(null)).toBe(SHENLUN_PATH);
    expect(buildShenlunUrl(0)).toBe(SHENLUN_PATH);
    expect(buildShenlunUrl(-3)).toBe(SHENLUN_PATH);
    expect(buildShenlunUrl('abc')).toBe(SHENLUN_PATH);
    expect(buildShenlunUrl(1.5)).toBe(SHENLUN_PATH);
  });
});

describe('buildShenlunMatUrl', () => {
  it('合法 id 生成 tab=m&mid 深链，type 编码追加', () => {
    expect(buildShenlunMatUrl(35, '政策理论')).toBe(SHENLUN_PATH + '?tab=m&mid=35&mtype=' + encodeURIComponent('政策理论'));
    expect(buildShenlunMatUrl('12')).toBe(SHENLUN_PATH + '?tab=m&mid=12');
    expect(buildShenlunMatUrl(7, '')).toBe(SHENLUN_PATH + '?tab=m&mid=7');
  });
  it('无/非法 id 回落素材 tab 路径', () => {
    expect(buildShenlunMatUrl(null, '金句')).toBe(SHENLUN_PATH + '?tab=m');
    expect(buildShenlunMatUrl(0)).toBe(SHENLUN_PATH + '?tab=m');
    expect(buildShenlunMatUrl('abc', '案例')).toBe(SHENLUN_PATH + '?tab=m');
    expect(buildShenlunMatUrl(2.5)).toBe(SHENLUN_PATH + '?tab=m');
  });
});
