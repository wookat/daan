// R549：① 错题本 PDF 导出可附「我的错答/错因」（默认开、需含答案；题库题走 `mistakes[question_id]`、手录/时政内联题随 items 自带，
// 服务端归一后落参考答案页）；② 复习清零小结加「下次复习：明天 n 道 · 3 天后 m 道」，CTA「太棒了，继续」→「回错题本」。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { exportNote, exportNotesMap } from '../src/book-export.js';
import { nextReviewText } from '../src/review-summary.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const BOOK = read('../src/pages/book/book.vue');
const CONFIRM = read('../src/components/export-confirm/export-confirm.vue');

function evalComputed(name, ctx) {
  const m = new RegExp(name + '\\(\\) \\{\\n([\\s\\S]*?)\\n {4}\\},').exec(CONFIRM);
  if (!m) throw new Error(name + ' not found');
  return new Function('return (function(){' + m[1] + '}).call(this)').call(ctx);
}

describe('exportNote / exportNotesMap', () => {
  it('错选字母去重升序；与标准答案相同不算错答；错因 trim；都空返回 {}', () => {
    expect(exportNote({ user_answer: 'b', correct_answer: 'A', error_reason: ' 粗心大意 ' })).toEqual({ picked: 'B', reason: '粗心大意' });
    expect(exportNote({ user_answer: '我选 DB', correct_answer: 'A' })).toEqual({ picked: 'BD' });
    expect(exportNote({ user_answer: 'A', correct_answer: 'A' })).toEqual({});
    expect(exportNote({ user_answer: 'A', correct_answer: 'A', error_reason: '概念不清' })).toEqual({ reason: '概念不清' });
    expect(exportNote({ user_answer: null, correct_answer: null, error_reason: '' })).toEqual({});
    expect(exportNote(null)).toEqual({});
  });

  it('exportNotesMap 只收题库题（有 question_id）且有批注的；关闭或全空返回 null', () => {
    const list = [
      { question_id: 11, user_answer: 'B', correct_answer: 'A' },
      { question_id: 12, user_answer: 'A', correct_answer: 'A' },
      { question_id: null, question_text: '手录题', user_answer: 'C', correct_answer: 'A', error_reason: '蒙的' },
      { question_id: 13, error_reason: '看错题' },
    ];
    expect(exportNotesMap(list, true)).toEqual({ 11: { picked: 'B' }, 13: { reason: '看错题' } });
    expect(exportNotesMap(list, false)).toBeNull();
    expect(exportNotesMap([{ question_id: 12, user_answer: 'A', correct_answer: 'A' }], true)).toBeNull();
    expect(exportNotesMap(null, true)).toBeNull();
  });
});

describe('export-confirm 「含我的错答/错因」', () => {
  it('仅 reviewable 时显示；默认开；需含答案（含解析或仅答案）才生效；口径文案随之变化', () => {
    expect(CONFIRM).toContain('reviewable: { type: Boolean, default: false },');
    expect(CONFIRM).toContain('return { withAns: true, withSheet: true, only: false, withMine: true };');
    expect(CONFIRM).toContain('<text v-if="reviewable" class="expchip" :class="{ on: withMine && (only || withAns) }" @click="toggleMine">含我的错答/错因</text>');
    expect(CONFIRM).toContain('with_notes: this.withNotes,');
    expect(evalComputed('withNotes', { reviewable: true, withMine: true, only: false, withAns: true })).toBe(true);
    expect(evalComputed('withNotes', { reviewable: true, withMine: true, only: true, withAns: false })).toBe(true);
    expect(evalComputed('withNotes', { reviewable: true, withMine: true, only: false, withAns: false })).toBe(false);
    expect(evalComputed('withNotes', { reviewable: true, withMine: false, only: false, withAns: true })).toBe(false);
    expect(evalComputed('withNotes', { reviewable: false, withMine: true, only: false, withAns: true })).toBe(false);
    expect(evalComputed('optNote', { withNotes: true, only: false, withAns: true, withSheet: true })).toBe('导出题目 + 答案解析 + 我的错答/错因 + 机读答题卡');
    expect(evalComputed('optNote', { withNotes: true, only: true })).toBe('只导出参考答案页，不含题目 + 我的错答/错因');
    expect(evalComputed('optNote', { withNotes: false, only: false, withAns: false, withSheet: true })).toBe('导出题目 + 机读答题卡');
  });

  // 组件状态机：chip 的「亮/灭」= withNotes（含 reviewable / only / withAns 联动），toggleMine 按亮灭翻转，而非只翻 withMine。
  function confirmState(init) {
    const m = /toggleMine\(\) \{\n([\s\S]*?)\n {4}\},/.exec(CONFIRM);
    const fn = new Function('(function(){' + m[1] + '}).call(this)');
    const st = { reviewable: true, withAns: true, withSheet: true, only: false, withMine: true, ...init };
    Object.defineProperty(st, 'withNotes', { get: () => evalComputed('withNotes', st) });
    st.toggleMine = () => fn.call(st);
    return st;
  }

  it('toggleMine 打开时若非「仅答案」则顺带打开「含解析」（批注只能落在参考答案页）', () => {
    const st = confirmState({ withMine: false, withAns: false });
    st.toggleMine();
    expect([st.withMine, st.withAns, st.withNotes]).toEqual([true, true, true]);
    st.toggleMine();
    expect([st.withMine, st.withAns, st.withNotes]).toEqual([false, true, false]);
    const only = confirmState({ withMine: false, only: true, withAns: false });
    only.toggleMine();
    expect([only.withMine, only.withAns, only.withNotes]).toEqual([true, false, true]);
  });

  it('默认开 → 关「含解析」使 chip 灭 → 单击 chip 一次即亮并勾回含解析（R549 生产复验 A① 单击边界）', () => {
    const st = confirmState();
    expect(st.withNotes).toBe(true);
    st.only = false;
    st.withAns = false; // 模板 「含解析」 chip：only = false; withAns = !withAns
    expect(st.withNotes).toBe(false);
    expect(st.withMine).toBe(true); // 内部仍 true，旧实现单击只翻成 false → 仍灭
    st.toggleMine();
    expect([st.withMine, st.withAns, st.withNotes]).toEqual([true, true, true]);
    st.toggleMine();
    expect([st.withMine, st.withAns, st.withNotes]).toEqual([false, true, false]);
  });
});

describe('错题本接入', () => {
  it('确认层标 reviewable；exportMistakes 剥 with_notes、题库题走 mistakes、内联题带 picked/reason', () => {
    expect(BOOK).toContain("import { exportNote, exportNotesMap } from '../../book-export.js';");
    expect(BOOK).toMatch(/:busy="exporting"\n\s+reviewable\n/);
    expect(BOOK).toContain('const { with_notes: withNotes, ...pdfOpts } = opts || {};');
    expect(BOOK).toContain('const note = (m) => (withNotes ? exportNote(m) : {});');
    expect(BOOK).toContain('const mistakes = exportNotesMap(list, withNotes);');
    expect(BOOK).toContain("analysis: m.explanation || '',\n            ...note(m),");
    expect(BOOK).toContain('...(mistakes ? { mistakes } : {}),\n          ...pdfOpts,');
    expect(BOOK).not.toContain('...opts,\n        });');
  });
});

describe('nextReviewText', () => {
  const due = (id, d, extra = {}) => ({ id, _nextDays: d, _res: true, ...extra });
  it('按天数聚合、升序、1 天显示「明天」', () => {
    expect(nextReviewText([due(1, 1), due(2, 3), due(3, 1)])).toBe('下次复习：明天 2 道 · 3 天后 1 道');
    expect(nextReviewText([due(1, 7)])).toBe('下次复习：7 天后 1 道');
  });
  it('加练（_extra）不计；未回天数/非数字/0 不计；无样本返回 ""', () => {
    expect(nextReviewText([due(1, 3, { _extra: true }), { id: 2 }, due(3, 'x'), due(4, 0)])).toBe('');
    expect(nextReviewText([])).toBe('');
    expect(nextReviewText(null)).toBe('');
  });
  it('同一错题重出（_requeued）以最后一条为准；达成掌握（_mastered）不再排期', () => {
    expect(nextReviewText([due(1, 1, { _res: false }), due(1, 1, { _requeued: true })])).toBe('下次复习：明天 1 道');
    expect(nextReviewText([due(1, 30, { _mastered: true }), due(2, 3)])).toBe('下次复习：3 天后 1 道');
    expect(nextReviewText([due(1, 30, { _mastered: true })])).toBe('');
  });
});

describe('复习清零小结接入', () => {
  it('每题 POST /api/review 回的 next_review_days 落 cur._nextDays；清零时算 nextText；CTA 改「回错题本」', () => {
    expect(BOOK).toContain("import { nextReviewText, reviewSummary, reviewVerdict, streakProgressText, similarRoom, reviewDueLeft, reviewDoneCopy } from '../../review-summary.js';");
    expect(BOOK).toContain('this.cur._nextDays = res.next_review_days;\n        this.cur._streak = res.streak;');
    expect(BOOK).toContain('this.rSummary = reviewSummary(this.rItems);\n        this.nextText = nextReviewText(this.rItems);');
    expect(BOOK).toContain('<text v-if="nextText" class="cb-s cb-next">{{ nextText }}</text>');
    expect(BOOK).toContain('@click="closeCelebrate">回错题本 ›</kg-button>');
    expect(BOOK).not.toContain('太棒了，继续');
  });
});
