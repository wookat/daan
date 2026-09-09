import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reviewVerdict, reviewSummary } from '../src/review-summary.js';
import { buildReviewSnap, parseReviewSnap } from '../src/review-snap.js';
import { reviewVerdict as mpReviewVerdict } from '../../miniapp-native/miniprogram/utils/review-verdict.ts';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

// R541：/api/review/{mid} 自 SRS 上线起就回 mastered（连对 > 间隔表长度即移出到期队列），
// 但 H5/小程序复习卡只消费 streak/next_review_days，达成掌握那一答仍显示「下次复习：30 天后」——
// 而服务端 due_reviews 已把该行排除，用户既得不到「已掌握」反馈，又被告知一个不会发生的复习日。
describe('R541 复习卡「已掌握」判定文案（H5）', () => {
  it('答对且服务端 mastered=true → 明示已掌握、不再带「下次复习」', () => {
    const t = reviewVerdict({ wasCorrect: true, streak: 6, nextDays: 30, mastered: true });
    expect(t).toBe('答对了！连对 6 次 · 已掌握，移出复习计划 ✓');
    expect(t).not.toContain('下次复习');
  });

  it('答对未掌握 → 连对 + 下次复习（原口径不变）', () => {
    expect(reviewVerdict({ wasCorrect: true, streak: 2, nextDays: 3, mastered: false })).toBe('答对了！连对 2 次（下次复习：3 天后）');
    expect(reviewVerdict({ wasCorrect: true, streak: 2, nextDays: 3 })).toBe('答对了！连对 2 次（下次复习：3 天后）');
  });

  it('requeue 复制体答对 → 本轮已纠正；答错 → 稍后再出现（原口径不变）', () => {
    expect(reviewVerdict({ requeued: true, wasCorrect: true, streak: 1, nextDays: 1 })).toBe('这次答对了，本轮已纠正 ✓（下次复习：1 天后）');
    expect(reviewVerdict({ wasCorrect: false, streak: 0, nextDays: 1 })).toBe('又错了，看讲解，稍后本轮会再出现（下次复习：1 天后）');
  });

  it('extra 加练题不写 SRS：文案不带下次复习，也不受 mastered 影响', () => {
    expect(reviewVerdict({ extra: true, wasCorrect: true, mastered: true })).toBe('答对了，这个考法稳了 ✓');
    expect(reviewVerdict({ extra: true, wasCorrect: false })).toBe('还没稳，仔细看讲解');
  });

  it('mastered 只认 true（字符串/1/undefined 一律按未掌握 fail-closed）', () => {
    for (const m of ['true', 1, undefined, null]) {
      expect(reviewVerdict({ wasCorrect: true, streak: 6, nextDays: 30, mastered: m })).toContain('下次复习');
    }
  });

  it('streak/nextDays 非法值归 0，不抛', () => {
    expect(reviewVerdict({ wasCorrect: true, streak: 'x', nextDays: undefined })).toBe('答对了！连对 0 次（下次复习：0 天后）');
  });
});

describe('R541 轮末小结计达成掌握数', () => {
  it('非 extra 且 _mastered===true 才计，requeue 复制体也计（同一行只会出现一次 mastered）', () => {
    const s = reviewSummary([
      { question_text: 'a', _res: true, _mastered: true },
      { question_text: 'b', _res: true, _mastered: false },
      { question_text: 'c', _res: true },
      { question_text: 'd', _extra: true, _res: true, _mastered: true },
      { question_text: 'e', _res: false },
      { question_text: 'e', _requeued: true, _res: true, _mastered: true },
    ]);
    expect(s.mastered).toBe(2);
    expect(s.due).toBe(4);
    expect(s.extra).toBe(1);
  });

  it('无 _mastered 留痕时为 0（老快照/老回包兼容）', () => {
    expect(reviewSummary([{ question_text: 'a', _res: true }]).mastered).toBe(0);
  });
});

describe('R541 快照恢复带回 _streak/_mastered（条目字段透传，快照 schema 不变）', () => {
  it('buildReviewSnap 保留条目上的 _streak/_mastered，parse 后可还原连对数与掌握态', () => {
    const state = {
      rItems: [{ question_text: 'q1', _res: true, _streak: 6, _mastered: true }],
      rIdx: 0,
      picked: 'A',
      answered: true,
      wasCorrect: true,
      nextDays: 30,
    };
    const snap = buildReviewSnap(state, 'u1', 1000);
    expect(snap.v).toBe(1);
    expect(snap.items[0]._streak).toBe(6);
    expect(snap.items[0]._mastered).toBe(true);
    const r = parseReviewSnap(JSON.stringify(snap), 'u1', 1010);
    expect(r.items[0]._streak).toBe(6);
    expect(r.items[0]._mastered).toBe(true);
    expect(reviewVerdict({ wasCorrect: r.wasCorrect, streak: r.items[r.rIdx]._streak, nextDays: r.nextDays, mastered: r.items[r.rIdx]._mastered })).toContain('已掌握');
  });
});

describe('R541 源锁', () => {
  const vue = read('../src/pages/book/book.vue');
  it('H5 复习卡 verdict 走 reviewVerdict（record 写回 _streak/_mastered、恢复态回填 streak、庆祝态含达成掌握行）', () => {
    expect(vue).toContain("import { nextReviewText, reviewSummary, reviewVerdict, streakProgressText, similarRoom, reviewDueLeft, reviewDoneCopy } from '../../review-summary.js'");
    expect(vue).toContain('>{{ verdictText }}</view>');
    expect(vue).toContain('this.cur._streak = res.streak;');
    expect(vue).toContain('this.cur._mastered = res.mastered === true;');
    expect(vue).toContain('this.streak = Number(this.rItems[this.rIdx]?._streak) || 0;');
    expect(vue).toContain('达成掌握 {{ rSummary.mastered }} 道');
    expect(vue).not.toContain("'答对了！连对 ' + streak + ' 次'");
  });

  it('小程序复习卡同口径：类型含 mastered、wxml 只渲染 rVerdict、record 写回条目 streak/masteredNow（Mistake.mastered 是服务端 0/1 列，另起字段避免类型冲突）', () => {
    const types = read('../../miniapp-native/miniprogram/api/types.ts');
    const ts = read('../../miniapp-native/miniprogram/pages/book/book.ts');
    const wxml = read('../../miniapp-native/miniprogram/pages/book/book.wxml');
    expect(types).toMatch(/interface ReviewRecordResp \{[^}]*mastered: boolean;/s);
    expect(wxml).toContain('<text>{{rVerdict}}</text>');
    expect(wxml).not.toContain('下次复习：{{nextDays}}');
    expect(ts).toContain("import { nextReviewText, reviewVerdict, streakProgressText, similarRoom, reviewDueLeft, reviewDoneCopy } from '../../utils/review-verdict'");
    expect(ts).toContain("'rCur.masteredNow': mastered");
    expect(ts).toContain('const celebrateMastered = items.filter((x) => !x.extra && x.masteredNow === true).length;');
    expect(wxml).toContain('达成掌握 {{celebrateMastered}} 道');
    expect(ts).toContain('rVerdict: this.verdictFor({ ...cur, masteredNow: mastered }, correct, res.streak, res.next_review_days)');
  });
});

describe('R541 小程序 reviewVerdict 与 H5 同结构（小程序用「解析」且不带 ✓，历史口径）', () => {
  it('掌握态 / 未掌握态 / requeue / 答错 / extra', () => {
    expect(mpReviewVerdict({ wasCorrect: true, streak: 6, nextDays: 30, mastered: true })).toBe('答对了！连对 6 次 · 已掌握，移出复习计划');
    expect(mpReviewVerdict({ wasCorrect: true, streak: 2, nextDays: 3, mastered: false })).toBe('答对了！连对 2 次（下次复习：3 天后）');
    expect(mpReviewVerdict({ requeued: true, wasCorrect: true, streak: 1, nextDays: 1 })).toBe('这次答对了，本轮已纠正（下次复习：1 天后）');
    expect(mpReviewVerdict({ wasCorrect: false, nextDays: 1 })).toBe('又错了，看解析，稍后本轮会再出现（下次复习：1 天后）');
    expect(mpReviewVerdict({ extra: true, wasCorrect: true, mastered: true })).toBe('答对了，这个考法稳了');
    expect(mpReviewVerdict({ extra: true, wasCorrect: false })).toBe('还没稳，仔细看解析');
  });
});
