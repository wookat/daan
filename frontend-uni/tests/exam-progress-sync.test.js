import { describe, it, expect } from 'vitest';
import { adoptServerExamProgress } from '../src/exam-progress-sync.js';

const NOW = 1_700_000_000_000;

function server(over = {}) {
  return {
    attempt_id: 42,
    paper: { id: 5, title: '测试卷', kind: 'zhenti', year: 2023, region: '江苏', duration_min: 120, n: 2 },
    items: [
      { id: 101, question: 'Q1', options: { A: 'a', B: 'b' }, module: 'yanyu' },
      { id: 102, question: 'Q2', options: { A: 'a', B: 'b' }, module: 'ziliao' },
    ],
    picks: { 101: 'A' },
    idx: 1,
    end_at_ms: NOW + 60 * 60 * 1000,
    ...over,
  };
}

function localValid() {
  return {
    attemptId: 9,
    paperId: 3,
    items: [{ id: 1, _picked: 'A' }],
    endAt: NOW + 1000,
  };
}

describe('adoptServerExamProgress', () => {
  it('本机快照仍有效时一律本机优先', () => {
    expect(adoptServerExamProgress(localValid(), server(), NOW)).toBeNull();
  });

  it('本机无效 + 服务端有效：组装 examProgress 同构快照', () => {
    const snap = adoptServerExamProgress(null, server(), NOW);
    expect(snap.attemptId).toBe(42);
    expect(snap.paperId).toBe(5);
    expect(snap.mini).toBe(false);
    expect(snap.idx).toBe(1);
    expect(snap.endAt).toBe(NOW + 60 * 60 * 1000);
    expect(snap.items).toHaveLength(2);
    expect(snap.items[0]).toMatchObject({ id: 101, _picked: 'A', _marked: false, _secs: 0 });
    expect(snap.items[1]._picked).toBe('');
  });

  it('服务端应答缺字段/为空不采用', () => {
    expect(adoptServerExamProgress(null, {}, NOW)).toBeNull();
    expect(adoptServerExamProgress(null, null, NOW)).toBeNull();
    expect(adoptServerExamProgress(null, server({ items: [] }), NOW)).toBeNull();
    expect(adoptServerExamProgress(null, server({ paper: null }), NOW)).toBeNull();
    expect(adoptServerExamProgress(null, server({ attempt_id: 0 }), NOW)).toBeNull();
  });

  it('服务端进度已过期不采用', () => {
    expect(adoptServerExamProgress(null, server({ end_at_ms: NOW }), NOW)).toBeNull();
    expect(adoptServerExamProgress(null, server({ end_at_ms: 'x' }), NOW)).toBeNull();
  });

  it('非法 picks/idx 容错：picks 非对象回落全空、越界 idx 收敛', () => {
    const snap = adoptServerExamProgress(null, server({ picks: 'bad', idx: 99 }), NOW);
    expect(snap.items.every((q) => q._picked === '')).toBe(true);
    expect(snap.idx).toBe(1); // min(99, items.length-1)
    const snap2 = adoptServerExamProgress(null, server({ idx: -2 }), NOW);
    expect(snap2.idx).toBe(0);
  });

  it('本机过期快照不阻止采用服务端', () => {
    const stale = { ...localValid(), endAt: NOW - 1 };
    const snap = adoptServerExamProgress(stale, server(), NOW);
    expect(snap && snap.attemptId).toBe(42);
  });
});

describe('adoptServerExamProgress marks（R317）', () => {
  it('server.marks 按 question_id 命中恢复 _marked', () => {
    const snap = adoptServerExamProgress(null, server({ marks: [102] }), NOW);
    expect(snap.items[0]._marked).toBe(false);
    expect(snap.items[1]._marked).toBe(true);
  });

  it('字符串 id 归一命中，非法项忽略', () => {
    const snap = adoptServerExamProgress(null, server({ marks: ['101', 'x', null] }), NOW);
    expect(snap.items[0]._marked).toBe(true);
    expect(snap.items[1]._marked).toBe(false);
  });

  it('marks 缺省/非数组 fail-closed 全 false', () => {
    expect(adoptServerExamProgress(null, server(), NOW).items.every((q) => q._marked === false)).toBe(true);
    expect(adoptServerExamProgress(null, server({ marks: 'bad' }), NOW).items.every((q) => q._marked === false)).toBe(true);
  });
});
