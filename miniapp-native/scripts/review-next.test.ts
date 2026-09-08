// R549：复习清零小结「下次复习：明天 n 道 · k 天后 m 道」（与 H5 review-summary.js nextReviewText 同口径）+ CTA「回错题本」。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { nextReviewText } from '../miniprogram/utils/review-verdict';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('nextReviewText', () => {
  const due = (id: number, nextDays: number, extra: Record<string, unknown> = {}) => ({ id, nextDays, ...extra });
  it('按天数聚合、升序、1 天显示「明天」', () => {
    expect(nextReviewText([due(1, 1), due(2, 3), due(3, 1)])).toBe('下次复习：明天 2 道 · 3 天后 1 道');
    expect(nextReviewText([due(1, 7)])).toBe('下次复习：7 天后 1 道');
  });
  it('加练不计；未回天数/0 不计；重出以最后一条为准；达成掌握不再排期；无样本 ""', () => {
    expect(nextReviewText([due(1, 3, { extra: true }), { id: 2 }, due(4, 0)])).toBe('');
    expect(nextReviewText([due(1, 1), due(1, 1, { requeued: true })])).toBe('下次复习：明天 1 道');
    expect(nextReviewText([due(1, 30, { masteredNow: true }), due(2, 3)])).toBe('下次复习：3 天后 1 道');
    expect(nextReviewText(null)).toBe('');
  });
});

describe('book 页接入', () => {
  it('POST /api/review 回包 next_review_days 落 item.nextDays；清零时 celebrateNext 下发；CTA「回错题本」', () => {
    const ts = read('../miniprogram/pages/book/book.ts');
    const wxml = read('../miniprogram/pages/book/book.wxml');
    expect(ts).toContain("import { nextReviewText, reviewVerdict, streakProgressText, similarRoom, reviewDueLeft, reviewDoneCopy } from '../../utils/review-verdict';");
    expect(ts).toContain('item.nextDays = res.next_review_days;');
    expect(ts).toContain('const celebrateNext = nextReviewText(items);');
    expect(ts).toContain('celebrateNext,\n        dueLeft,\n        celebrateCopy: reviewDoneCopy(n, dueLeft),\n        reinforce: null,\n        reinforceItems: [],');
    expect(wxml).toContain('<view wx:if="{{celebrateNext}}" class="cb-s cb-next">{{celebrateNext}}</view>');
    expect(wxml).toContain('bind:click="onCloseCelebrate">回错题本</kg-button>');
    expect(wxml).not.toContain('太棒了，继续');
  });
});
