import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  fixReportOf,
  fixReportText,
  redoReportOf,
  redoReportTip,
  reviewedMasteredCount,
} from '../../miniapp-native/miniprogram/utils/review-advance.ts';
import { fixReportText as h5FixReportText, reviewedMasteredCount as h5Count } from '../src/review-advance.js';

const mp = (p) => readFileSync(fileURLToPath(new URL('../../miniapp-native/miniprogram/' + p, import.meta.url)), 'utf8');

// R542：小程序练习页此前 (a) answer_log 不带 mid → 时政/手录等无 qid 的重练题答对后服务端找不到错题、SRS 不推进
// （H5 自 R371 起带 mid）；(b) 丢弃 /api/answer_log 回包 reviewed → 完成页没有 H5 已有的「错题重练效果」/
// 「本组答对 N 道曾错题，复习计划已推进（M 道达成掌握）」反馈。本轮补齐，文案与 H5 逐字同口径。
describe('R542 miniapp review-advance 纯函数', () => {
  it('reviewedMasteredCount：mastered 严判 true，脏值/非数组 fail-closed', () => {
    expect(reviewedMasteredCount([{ mastered: true }, { mastered: false }, { mastered: 1 }, null, { mastered: 'true' }])).toBe(1);
    expect(reviewedMasteredCount(undefined)).toBe(0);
    expect(reviewedMasteredCount({})).toBe(0);
    expect(reviewedMasteredCount([{ mastered: 1 }])).toBe(h5Count([{ mastered: 1 }]));
  });

  it('redoReportOf：只统计带 mistake_id 的已答题；无此类题回 null', () => {
    const items = [
      { _picked: 'A', answer: 'A', mistake_id: 1 },
      { _picked: 'B', answer: 'C', mistake_id: 2 },
      { _picked: 'A', answer: 'A' }, // 非曾错题不计
      { _picked: '', answer: 'A', mistake_id: 3 }, // 未答不计
    ];
    expect(redoReportOf(items, [{ mistake_id: 1, streak: 6, mastered: true }])).toEqual({ fixed: 1, still: 1, mastered: 1 });
    expect(redoReportOf([{ _picked: 'A', answer: 'A' }], [])).toBeNull();
    expect(redoReportOf([], [])).toBeNull();
  });

  it('redoReportTip：仍错 >0 才拼「已回到今日待复习」（R523 口径）', () => {
    expect(redoReportTip({ fixed: 2, still: 0, mastered: 0 })).toBe('答对的已推进复习计划');
    expect(redoReportTip({ fixed: 1, still: 1, mastered: 0 })).toBe('答对的已推进复习计划；仍错的已重置复习，已回到今日待复习');
    expect(redoReportTip(null)).toBe('');
  });

  it('fixReportOf/fixReportText：与 H5 review-advance.js 逐字同', () => {
    expect(fixReportOf([])).toBeNull();
    expect(fixReportOf(undefined)).toBeNull();
    const rep = fixReportOf([{ mastered: true }, { mastered: false }]);
    expect(rep).toEqual({ n: 2, mastered: 1 });
    expect(fixReportText(rep)).toBe(h5FixReportText(rep));
    expect(fixReportText(rep)).toBe('本组答对 2 道曾错题，复习计划已推进（1 道达成掌握）');
    expect(fixReportText({ n: 1, mastered: 0 })).toBe('本组答对 1 道曾错题，复习计划已推进');
    expect(fixReportText(null)).toBe('');
  });
});

describe('R542 小程序源锁', () => {
  const ts = mp('pages/practice/practice.ts');
  const wxml = mp('pages/practice/practice.wxml');
  const api = mp('api/index.ts');
  const types = mp('api/types.ts');

  it('answer_log 条目带 mid（无 qid 的重练题也能推进 SRS）', () => {
    expect(ts).toMatch(/mid: q\.mistake_id \|\| q\.due_mid \|\| undefined/);
    expect(types).toMatch(/interface AnswerLogItem \{[\s\S]*?mid\?: number;/);
    expect(types).toMatch(/interface Question \{[\s\S]*?mistake_id\?: number;/);
  });

  it('postAnswerLog 回包类型声明 reviewed，练习页累积并在 finish 汇总', () => {
    expect(api).toMatch(/postAnswerLog\(items: AnswerLogItem\[\]\): Promise<AnswerLogResp>/);
    expect(types).toMatch(/interface AnswerLogResp \{\s*saved: number;\s*reviewed\?: AnswerLogReviewed\[\];/);
    expect(ts).toMatch(/this\._reviewed = this\._reviewed\.concat\(r\.reviewed\)/);
    expect(ts).toMatch(/await this\.logAttempts\(items\);\s*await this\.syncRedoReviews\(items\);/);
    // 只有 redo / redoset 场次才出三格报告，普通练习走一行 fixReport
    expect(ts).toMatch(/mode === 'redo' \|\| mode === 'redoset' \? redoReportOf\(items, reviewed\) : null/);
    expect(ts).toMatch(/const fixReport = redoReport \? null : fixReportOf\(reviewed\)/);
    // 每次 start 清空累积，避免跨场次串报告
    expect(ts).toMatch(/this\._resultSent = false;\s*this\._reviewed = \[\];\s*this\._logPending = \[\];/);
  });

  it('完成页渲染两种报告，均可回错题本（与 H5 goReview 同口径 autoStartReview）', () => {
    expect(wxml).toMatch(/wx:if="\{\{redoReport\}\}"[\s\S]*?错题重练效果[\s\S]*?已纠正[\s\S]*?仍错[\s\S]*?达成掌握[\s\S]*?\{\{redoTip\}\}[\s\S]*?bind:click="onGoReview">回错题本查看/);
    expect(wxml).toMatch(/wx:elif="\{\{fixReport\}\}"[\s\S]*?bind:tap="onGoReview"[\s\S]*?\{\{fixText\}\}/);
  });
});
