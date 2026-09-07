// R422：练习页所有 uni.vibrateShort 调用都带 fail 回调——H5 桌面端不支持震动时 uni 以 Promise reject 返回，
// 无 fail 回调会产生 unhandledrejection「vibrateShort:fail」（R421b 复验实录，桌面 Chrome 每次答错一条）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(new URL('../src/pages/practice/practice.vue', import.meta.url), 'utf8');

describe('practice.vue vibrateShort', () => {
  it('每处调用都带 fail 回调', () => {
    const calls = SRC.match(/uni\.vibrateShort\(\{.*?\}\s*\);/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) expect(c).toMatch(/fail:\s*\(\)\s*=>\s*\{\}/);
  });
});
