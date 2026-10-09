// R546：错题本列表卡「连对 n/6」进度（生产只读：未掌握错题 review_streak 1→15 道 / 2→6 道，此前只在复习判定弹层一闪而过）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MASTER_STREAK, streakProgressText } from '../src/review-summary.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue')+read('../src/pages/book/review-ops.js');

describe('R546 streakProgressText', () => {
  it('1..5 → 连对 n/6；0 / 达阈值（已掌握另有标签）/ 非数 → 空', () => {
    expect(MASTER_STREAK).toBe(6);
    expect(streakProgressText(1)).toBe('连对 1/6');
    expect(streakProgressText(5)).toBe('连对 5/6');
    expect(streakProgressText(0)).toBe('');
    expect(streakProgressText(6)).toBe('');
    expect(streakProgressText(undefined)).toBe('');
    expect(streakProgressText('x')).toBe('');
  });
});

describe('R546 列表卡接线', () => {
  it('H5：mhead 在「错 N 次」之后、「已掌握/下次复习」之前挂 ok 色连对标签，已掌握不重复显示', () => {
    expect(book).toContain('<kg-tag v-if="!m.mastered && streakText(m)" tone="ok">{{ streakText(m) }}</kg-tag>');
    const head = book.slice(book.indexOf('<view class="mhead">'), book.indexOf('<view class="q" :class="{ clamp: !m.open }">'));
    expect(head.indexOf('错 {{ m.times }} 次')).toBeLessThan(head.indexOf('streakText(m)'));
    expect(head.indexOf('streakText(m)')).toBeLessThan(head.indexOf('已掌握</kg-tag>'));
    expect(book).toMatch(/streakText\(m\) \{\s*return streakProgressText\(m\.review_streak\);/);
  });
  it('小程序：页面层算好 streakText 下发，wxml m-meta 显示（同口径 6 档）', () => {
    const ts = read('../../miniapp-native/miniprogram/pages/book/book.ts');
    const wxml = read('../../miniapp-native/miniprogram/pages/book/book.wxml');
    const util = read('../../miniapp-native/miniprogram/utils/review-verdict.ts');
    expect(util).toContain('export const MASTER_STREAK = 6;');
    expect(ts).toContain("streakText: x.mastered ? '' : streakProgressText(x.review_streak),");
    expect(wxml).toContain('<text wx:if="{{item.streakText}}" class="m-meta-ok">{{item.streakText}}</text>');
  });
});
