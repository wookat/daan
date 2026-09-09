// R559-fix-2：utils/practice-progress 回填/补快照纯函数，与 frontend-uni/src/practice-progress.js 同口径（H5 tests/r559-relink-mid.test.js）。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { describe, expect, it } from 'vitest';
import { patchPendingMistake, relinkMistakeIds, unlinkedWrongItems } from '../miniprogram/utils/practice-progress';
import type { PendingSession, ProgressQuestion } from '../miniprogram/utils/practice-progress';
import type { Mistake } from '../miniprogram/api/types';

const q = (id: number | null, extra: Partial<ProgressQuestion> = {}): ProgressQuestion =>
  ({ id, module: 'yanyu', question: '题干' + id + '\nA.a B.b', options: { A: 'a', B: 'b' }, answer: 'A', ...extra }) as ProgressQuestion;
const m = (id: number, extra: Partial<Mistake> = {}): Mistake =>
  ({ id, question_id: null, module: 'yanyu', question_text: '', user_answer: 'B', correct_answer: 'A', error_reason: null, ...extra }) as Mistake;
const snap = (items: ProgressQuestion[]): PendingSession =>
  ({ t: 1, items, idx: 0, right: 0, streak: 0, bestStreak: 0, lastModule: 'yanyu', lastSubmodule: '', source: '', ptitle: '' });

describe('R559-fix-2 小程序 _mid 回填', () => {
  it('unlinkedWrongItems：只挑已答错且无 _mid 的题', () => {
    const items = [q(1, { _picked: 'B' }), q(2, { _picked: 'A' }), q(3), q(4, { _picked: 'B', _mid: 7 }), q(5, { _picked: 'B', _mid: null })];
    expect(unlinkedWrongItems(items).map((x) => x.id)).toEqual([1, 5]);
  });

  it('relinkMistakeIds：题库题按 question_id、内联题按题干首行；本地已选错因优先，无匹配不改题', () => {
    const a = q(11, { _picked: 'B' });
    const b = q(12, { _picked: 'B', _reason: '粗心大意' });
    const sz = q(null, { _sz: true, _picked: 'B', question: '时政甲\nA.x' } as Partial<ProgressQuestion>);
    const none = q(13, { _picked: 'B' });
    const n = relinkMistakeIds([a, b, sz, none], [
      m(4038, { question_id: 11, error_reason: '概念不清' }),
      m(4039, { question_id: 12, error_reason: '方法不会' }),
      m(6, { question_text: '时政甲\nA.x' }),
      m(0, { question_id: 13 }),
    ]);
    expect(n).toBe(3);
    expect(a).toMatchObject({ _mid: 4038, _saved: true, _reason: '概念不清' });
    expect(b).toMatchObject({ _mid: 4039, _saved: true, _reason: '粗心大意' });
    expect(sz._mid).toBe(6);
    expect(none._mid).toBeUndefined();
    expect(relinkMistakeIds([none], null)).toBe(0);
  });

  it('patchPendingMistake：同题无 _mid 才补，返回新快照；已清/不含/已有 _mid/无 _mid → null', () => {
    const s = snap([q(1, { _picked: 'B' }), q(2)]);
    const kept = patchPendingMistake(s, q(1, { _picked: 'B', _mid: 4040 }));
    expect(kept && kept.items[0]).toMatchObject({ id: 1, _mid: 4040, _saved: true });
    expect(kept && kept.items[1]).toBe(s.items[1]);
    expect(s.items[0]._mid).toBeUndefined();
    expect(patchPendingMistake(null, q(1, { _mid: 4040 }))).toBeNull();
    expect(patchPendingMistake(snap([q(9)]), q(1, { _mid: 4040 }))).toBeNull();
    expect(patchPendingMistake(snap([q(1, { _mid: 1 })]), q(1, { _mid: 4040 }))).toBeNull();
    expect(patchPendingMistake(s, q(1, { _picked: 'B' }))).toBeNull();
    const inline = snap([q(null, { _picked: 'B', question: '内联甲\nA B' })]);
    expect(patchPendingMistake(inline, q(null, { question: '内联甲\nA B', _mid: 8 }))?.items[0]._mid).toBe(8);
  });
});
