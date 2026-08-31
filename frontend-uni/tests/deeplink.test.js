import { describe, expect, it } from 'vitest';

import { normalizeDailyDeepLink } from '../src/deeplink.js';

describe('normalizeDailyDeepLink', () => {
  it('基础深链 /?daily=1 归一化为练习页 hash 路由', () => {
    expect(normalizeDailyDeepLink('?daily=1', '')).toBe('#/pages/practice/practice?daily=1');
  });

  it('date/src 透传且 URL 编码', () => {
    expect(normalizeDailyDeepLink('?daily=1&date=2026-08-30&src=push', '')).toBe(
      '#/pages/practice/practice?daily=1&date=2026-08-30&src=push'
    );
    expect(normalizeDailyDeepLink('?daily=1&date=a b', '')).toBe(
      '#/pages/practice/practice?daily=1&date=a%20b'
    );
  });

  it('空 hash / #/ / # 均允许归一化', () => {
    for (const h of ['', '#', '#/']) {
      expect(normalizeDailyDeepLink('?daily=1', h)).toBeTruthy();
    }
  });

  it('已有站内 hash 路由不改写', () => {
    expect(normalizeDailyDeepLink('?daily=1', '#/pages/book/book')).toBeNull();
  });

  it('无 daily 参数返回 null', () => {
    expect(normalizeDailyDeepLink('', '')).toBeNull();
    expect(normalizeDailyDeepLink('?src=push', '')).toBeNull();
  });
});
