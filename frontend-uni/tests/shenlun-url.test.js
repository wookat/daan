import { describe, it, expect } from 'vitest';
import { buildShenlunUrl, SHENLUN_PATH } from '../src/shenlun-url.js';

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
