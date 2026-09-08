// R552：复习会话有界 + 分组口径。生产只读：到期错题 285 行/71 uid，单 uid 最多 30+ 道到期而 /api/review 一次只下发 20 道，
// 做完一组小结却宣称「今日复习已清零 / 全部复习完成」，回列表仍见「今日待复习 10」；答错还会无上限追加同类加练
// （20 道全错 → 20 requeue + 40 extra = 80 道）。本轮：① 小结按「本组 N 道完成 · 还有 M 道到期」+「继续复习下一组」CTA，
// 剩余为 0 才说清零；② 加练同类每轮总上限 6；③ 小程序 celebrateN 与 H5 同口径（不计 extra/requeue）。H5 与小程序同口径。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REVIEW_BATCH, REVIEW_EXTRA_MAX, similarRoom, reviewDueLeft, reviewDoneCopy } from '../src/review-summary.js';
import * as mp from '../../miniapp-native/miniprogram/utils/review-verdict.ts';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const BOOK = read('../src/pages/book/book.vue');
const MP_TS = read('../../miniapp-native/miniprogram/pages/book/book.ts');
const MP_WXML = read('../../miniapp-native/miniprogram/pages/book/book.wxml');

describe('R552 reviewDoneCopy / reviewDueLeft（H5）', () => {
  it('剩余到期 >0 → 本组完成口径 + 继续下一组 CTA（CTA 数量不超过一组 20）', () => {
    const c = reviewDoneCopy(20, 10);
    expect(c.cleared).toBe(false);
    expect(c.title).toBe('本组复习完成');
    expect(c.line).toBe('本组 20 道复习完成 · 还有 10 道到期待复习');
    expect(c.cta).toBe('继续复习下一组（10 道）›');
    expect(reviewDoneCopy(20, 45).cta).toBe('继续复习下一组（20 道）›');
    expect(REVIEW_BATCH).toBe(20);
  });

  it('剩余 0 / 负数 / 非法 → 清零口径不变，无 CTA', () => {
    for (const left of [0, -3, undefined, null, 'x']) {
      const c = reviewDoneCopy(7, left);
      expect(c.cleared).toBe(true);
      expect(c.title).toBe('今日复习已清零');
      expect(c.line).toBe('7 道到期错题全部复习完成，遗忘曲线稳住了');
      expect(c.cta).toBe('');
    }
  });

  it('reviewDueLeft = 到期总数 − 本组到期条目数，下限 0', () => {
    expect(reviewDueLeft(30, 20)).toBe(10);
    expect(reviewDueLeft(20, 20)).toBe(0);
    expect(reviewDueLeft(5, 20)).toBe(0);
    expect(reviewDueLeft(undefined, 3)).toBe(0);
    expect(reviewDueLeft('31', '20')).toBe(11);
  });
});

describe('R552 similarRoom 加练同类每轮上限（H5）', () => {
  it('每题最多 2 道、每轮最多 6 道；已有 5 道只能再补 1，6 道为 0', () => {
    expect(REVIEW_EXTRA_MAX).toBe(6);
    const ex = (n) => Array.from({ length: n }, () => ({ _extra: true }));
    expect(similarRoom([])).toBe(2);
    expect(similarRoom([{ id: 1 }, { id: 2, _requeued: true }])).toBe(2);
    expect(similarRoom(ex(4))).toBe(2);
    expect(similarRoom(ex(5))).toBe(1);
    expect(similarRoom(ex(6))).toBe(0);
    expect(similarRoom(ex(9))).toBe(0);
    expect(similarRoom(null)).toBe(2);
  });
});

describe('R552 小程序纯函数与 H5 同口径', () => {
  it('reviewDoneCopy / reviewDueLeft / similarRoom 结果一致（标题保留小程序原有「！」）', () => {
    expect(mp.REVIEW_BATCH).toBe(REVIEW_BATCH);
    expect(mp.REVIEW_EXTRA_MAX).toBe(REVIEW_EXTRA_MAX);
    const a = mp.reviewDoneCopy(20, 10);
    const b = reviewDoneCopy(20, 10);
    expect(a).toEqual(b);
    const c0 = mp.reviewDoneCopy(7, 0);
    expect(c0.cleared).toBe(true);
    expect(c0.title).toBe('今日复习已清零！');
    expect(c0.line).toBe(reviewDoneCopy(7, 0).line);
    expect(mp.reviewDueLeft(30, 20)).toBe(10);
    expect(mp.similarRoom([{ extra: true }, { extra: true }, { extra: true }, { extra: true }, { extra: true }])).toBe(1);
    expect(mp.similarRoom([{ extra: true }, { extra: true }, { extra: true }, { extra: true }, { extra: true }, { extra: true }])).toBe(0);
  });
});

describe('R552 源锁：H5 book.vue', () => {
  it('小结标题/正文/CTA 走 doneCopy；剩余到期 dueLeft 完成时估算、load 后以服务端 total 为准', () => {
    expect(BOOK).toContain(':title="doneCopy.title"');
    expect(BOOK).toContain("doneCopy.cleared ? '到期 ' + celebrateN + ' 道全部复习完成' : '本组 ' + celebrateN + ' 道复习完成'");
    expect(BOOK).toContain('<text v-if="!doneCopy.cleared" class="cb-s cb-left">还有 {{ dueLeft }} 道到期待复习</text>');
    expect(BOOK).toContain('<text v-else class="cb-s">{{ doneCopy.line }}</text>');
    expect(BOOK).toContain('this.dueLeft = reviewDueLeft(this.dueTotal, this.celebrateN);');
    expect(BOOK).toContain('if (this.celebrate) this.dueLeft = this.dueTotal;');
    expect(BOOK).toContain('return reviewDoneCopy(this.celebrateN, this.dueLeft);');
    expect(BOOK).not.toContain('title="今日复习已清零"');
  });

  it('剩余 >0 时主按钮「继续复习下一组」→ continueReview（重拉后 startReview），强化降为次按钮；清零分支原样', () => {
    const i = BOOK.indexOf('<template v-if="!doneCopy.cleared">');
    expect(i).toBeGreaterThan(0);
    const blk = BOOK.slice(i, BOOK.indexOf('</template>', i));
    expect(blk).toContain('class="cb-next-batch" @click="continueReview">{{ doneCopy.cta }}</kg-button>');
    expect(blk).toContain('<kg-button v-if="reinforce" variant="text" size="md" @click="startReinforce(reinforce)">强化 5 道新题</kg-button>');
    expect(blk).toContain('@click="closeCelebrate">回错题本</kg-button>');
    expect(BOOK).toContain('<template v-else-if="reinforce">');
    expect(BOOK).toContain('<kg-button v-else variant="primary" size="lg" block @click="closeCelebrate">回错题本 ›</kg-button>');
    const j = BOOK.indexOf('async continueReview() {');
    const fn = BOOK.slice(j, BOOK.indexOf('    },', j));
    expect(fn).toContain("trackEvent('review_entry_click', 'next_batch');");
    expect(fn).toContain('this.closeCelebrate();');
    expect(fn).toContain('await this.load();');
    expect(fn).toContain('if (this.due.length) this.startReview();');
  });

  it('appendSimilar 受 similarRoom 上限：limit/slice 随剩余额度，额度 0 直接返回且不置 _simFetched', () => {
    const i = BOOK.indexOf('async appendSimilar(m) {');
    const fn = BOOK.slice(i, BOOK.indexOf('    },', i));
    expect(fn).toContain('const room = similarRoom(this.rItems);');
    expect(fn.indexOf('if (!room) return;')).toBeLessThan(fn.indexOf('m._simFetched = true;'));
    expect(fn).toContain("'/api/questions?limit=' + room + '&uid='");
    expect(fn).toContain('.slice(0, room)');
    expect(fn).not.toContain('limit=2');
  });
});

describe('R552 源锁：小程序 book.ts / book.wxml', () => {
  it('celebrateN 不计 extra/requeue；dueLeft 完成时估算、load 后以 total 为准；onContinueReview 重拉后 startReview', () => {
    expect(MP_TS).toContain('const n = items.filter((x) => !x.extra && !x.requeued).length;');
    expect(MP_TS).toContain('const dueLeft = reviewDueLeft(this.data.dueTotal, n);');
    expect(MP_TS).toContain('celebrateCopy: reviewDoneCopy(n, dueLeft),');
    expect(MP_TS).toContain('this.setData({ dueLeft, celebrateCopy: reviewDoneCopy(this.data.celebrateN, dueLeft) });');
    const j = MP_TS.indexOf('async onContinueReview() {');
    const fn = MP_TS.slice(j, MP_TS.indexOf('  },', j));
    expect(fn).toContain("trackEvent('review_entry_click', 'next_batch');");
    expect(fn).toContain('await this.load();');
    expect(fn).toContain('if (this.data.due.length) this.startReview();');
    const k = MP_TS.indexOf('async appendSimilar(cur: RItem) {');
    const ap = MP_TS.slice(k, MP_TS.indexOf('  },', k));
    expect(ap).toContain('const room = similarRoom(this.data.rItems);');
    expect(ap).toContain('fetchQuestions({ limit: room, module: cur.module, submodule: sub })');
    expect(ap).toContain('.slice(0, room)');
  });

  it('WXML 标题/正文/CTA 走 celebrateCopy，剩余 >0 主按钮继续下一组', () => {
    expect(MP_WXML).toContain('<view class="cb-t">{{celebrateCopy.title}}</view>');
    expect(MP_WXML).toContain(`<view class="cb-s {{celebrateCopy.cleared ? '' : 'cb-left'}}">{{celebrateCopy.line}}</view>`);
    expect(MP_WXML).toContain('<block wx:if="{{!celebrateCopy.cleared}}">');
    expect(MP_WXML).toContain('bind:click="onContinueReview">{{celebrateCopy.cta}}</kg-button>');
    expect(MP_WXML).toContain('<block wx:elif="{{reinforce}}">');
    expect(MP_WXML).not.toContain('今日复习已清零！</view>');
  });
});
