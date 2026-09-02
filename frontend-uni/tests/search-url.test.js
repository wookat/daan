import { describe, it, expect } from 'vitest';
import { buildSearchUrl, buildTikuQPath, SEARCH_PATH } from '../src/search-url.js';

describe('buildTikuQPath', () => {
  it('合法正整数 id 生成 /tiku/q/{id}/', () => {
    expect(buildTikuQPath(118)).toBe('/tiku/q/118/');
    expect(buildTikuQPath('42')).toBe('/tiku/q/42/');
  });

  it('非法 id 回落题库首页', () => {
    expect(buildTikuQPath(0)).toBe('/tiku/');
    expect(buildTikuQPath(-3)).toBe('/tiku/');
    expect(buildTikuQPath(1.5)).toBe('/tiku/');
    expect(buildTikuQPath('abc')).toBe('/tiku/');
    expect(buildTikuQPath(null)).toBe('/tiku/');
    expect(buildTikuQPath(undefined)).toBe('/tiku/');
  });
});

describe('buildSearchUrl', () => {
  it('空关键词回到搜索页本身', () => {
    expect(buildSearchUrl('', 'all')).toBe(SEARCH_PATH);
    expect(buildSearchUrl('   ', 'question')).toBe(SEARCH_PATH);
    expect(buildSearchUrl(null, 'all')).toBe(SEARCH_PATH);
  });

  it('中文关键词编码进 q', () => {
    expect(buildSearchUrl('隧道', 'all')).toBe(SEARCH_PATH + '?q=%E9%9A%A7%E9%81%93');
  });

  it('首尾空白裁剪', () => {
    expect(buildSearchUrl('  隧道 ', 'all')).toBe(SEARCH_PATH + '?q=%E9%9A%A7%E9%81%93');
  });

  it('非 all tab 附加 tab 参数', () => {
    expect(buildSearchUrl('隧道', 'question')).toBe(SEARCH_PATH + '?q=%E9%9A%A7%E9%81%93&tab=question');
  });

  it('all tab 不附加 tab 参数', () => {
    expect(buildSearchUrl('隧道', 'all')).toBe(SEARCH_PATH + '?q=%E9%9A%A7%E9%81%93');
  });

  it('合法 qid 追加 &qid，非法/缺省不带；空关键词忽略 qid', () => {
    expect(buildSearchUrl('隧道', 'all', 118)).toBe(SEARCH_PATH + '?q=%E9%9A%A7%E9%81%93&qid=118');
    expect(buildSearchUrl('隧道', 'question', '42')).toBe(SEARCH_PATH + '?q=%E9%9A%A7%E9%81%93&tab=question&qid=42');
    expect(buildSearchUrl('隧道', 'all', 0)).toBe(SEARCH_PATH + '?q=%E9%9A%A7%E9%81%93');
    expect(buildSearchUrl('隧道', 'all', null)).toBe(SEARCH_PATH + '?q=%E9%9A%A7%E9%81%93');
    expect(buildSearchUrl('隧道', 'all', 'abc')).toBe(SEARCH_PATH + '?q=%E9%9A%A7%E9%81%93');
    expect(buildSearchUrl('', 'all', 118)).toBe(SEARCH_PATH);
  });

  it('关键词截断到 64 字', () => {
    const long = 'a'.repeat(80);
    expect(buildSearchUrl(long, 'all')).toBe(SEARCH_PATH + '?q=' + 'a'.repeat(64));
  });
});
