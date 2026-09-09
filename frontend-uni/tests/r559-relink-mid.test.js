// R559-fix-2：恢复的会话里「已答错但没 _mid」的题（POST /api/mistakes 回包前就 F5 / 退出保留）按本人错题本回填；
// 「退出并保留」后才回包则直接补进已存快照，「不保留」快照已清则不重建（生产 c8fabd0f 复验坐实的两个窗口）。
import { describe, expect, it } from 'vitest';
import { unlinkedWrongItems, relinkMistakeIds, patchPendingMistake } from '../src/practice-progress.js';

const q = (id, extra = {}) => ({ id, question: '题干' + id + '\nA.a B.b', options: { A: 'a', B: 'b' }, answer: 'A', ...extra });
const m = (id, extra = {}) => ({ id, question_id: null, question_text: '', error_reason: null, ...extra });

describe('unlinkedWrongItems', () => {
  it('只挑「已答且答错且无 _mid」的题；答对/未答/已有 _mid/非数组都不算', () => {
    const items = [
      q(1, { _picked: 'B' }),
      q(2, { _picked: 'A' }),
      q(3),
      q(4, { _picked: 'B', _mid: 77 }),
      q(5, { _picked: 'B', _mid: null }),
      null
    ];
    expect(unlinkedWrongItems(items).map((x) => x.id)).toEqual([1, 5]);
    expect(unlinkedWrongItems(null)).toEqual([]);
    expect(unlinkedWrongItems('x')).toEqual([]);
  });
});

describe('relinkMistakeIds', () => {
  it('题库题按 question_id 回填 _mid/_saved，并带回服务端已存错因（本地未选时）', () => {
    const a = q(11, { _picked: 'B' });
    const b = q(12, { _picked: 'B', _reason: '粗心大意' });
    const n = relinkMistakeIds([a, b, q(13, { _picked: 'A' })], [
      m(4038, { question_id: 11, error_reason: '概念不清' }),
      m(4039, { question_id: 12, error_reason: '方法不会' })
    ]);
    expect(n).toBe(2);
    expect(a).toMatchObject({ _mid: 4038, _saved: true, _reason: '概念不清' });
    // 本地已选的错因优先（relinkWrongMids 随后按本地值补发 PATCH）
    expect(b).toMatchObject({ _mid: 4039, _saved: true, _reason: '粗心大意' });
  });

  it('内联题（_sz / 无 question_id）按题干首行匹配 question_text 首行', () => {
    const sz = q(9, { _sz: true, _picked: 'B', question: '时政题干甲\nA.x B.y' });
    const n = relinkMistakeIds([sz], [
      m(5, { question_id: 9, question_text: '别的题库题 9' }),
      m(6, { question_id: null, question_text: '时政题干甲\nA.x B.y' })
    ]);
    expect(n).toBe(1);
    expect(sz._mid).toBe(6);
  });

  it('无匹配 / 非法 mistakes 不改题；同 question_id 多条取首条', () => {
    const a = q(21, { _picked: 'B' });
    expect(relinkMistakeIds([a], [m(0, { question_id: 21 }), m('x', { question_id: 21 }), m(3, { question_id: 22 })])).toBe(0);
    expect(a._mid).toBeUndefined();
    expect(a._saved).toBeUndefined();
    expect(relinkMistakeIds([a], null)).toBe(0);
    expect(relinkMistakeIds([], [m(1, { question_id: 21 })])).toBe(0);
    relinkMistakeIds([a], [m(31, { question_id: 21 }), m(32, { question_id: 21 })]);
    expect(a._mid).toBe(31);
  });
});

describe('patchPendingMistake', () => {
  const saved = () => ({
    t: 1,
    idx: 1,
    items: [q(1, { _picked: 'B', _saved: false }), q(2)]
  });

  it('快照里同题（按 id）无 _mid → 返回补了 _mid/_saved 的新快照，不改原对象', () => {
    const s = saved();
    const kept = patchPendingMistake(s, q(1, { _picked: 'B', _mid: 4040 }));
    expect(kept.items[0]).toMatchObject({ id: 1, _mid: 4040, _saved: true });
    expect(kept.items[1]).toEqual(s.items[1]);
    expect(kept.idx).toBe(1);
    expect(s.items[0]._mid).toBeUndefined();
  });

  it('内联题（id null）按题干匹配', () => {
    const s = { t: 1, items: [q(null, { _picked: 'B', question: '内联甲\nA B' })] };
    const kept = patchPendingMistake(s, { id: null, question: '内联甲\nA B', _mid: 8 });
    expect(kept.items[0]._mid).toBe(8);
  });

  it('「不保留」已清快照 / 快照不含该题 / 已有 _mid / 无 _mid → null（不重建、不覆盖）', () => {
    expect(patchPendingMistake('', q(1, { _mid: 4040 }))).toBeNull();
    expect(patchPendingMistake(null, q(1, { _mid: 4040 }))).toBeNull();
    expect(patchPendingMistake({ t: 1, items: [q(9)] }, q(1, { _mid: 4040 }))).toBeNull();
    expect(patchPendingMistake({ t: 1, items: [q(1, { _mid: 1 })] }, q(1, { _mid: 4040 }))).toBeNull();
    expect(patchPendingMistake(saved(), q(1, { _picked: 'B' }))).toBeNull();
    expect(patchPendingMistake(saved(), q(1, { _mid: 0 }))).toBeNull();
  });
});
