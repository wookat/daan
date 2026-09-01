import { describe, it, expect } from 'vitest';
import { buildShenlunUrl, buildShenlunMatUrl, SHENLUN_PATH } from '../src/shenlun-url.js';

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
