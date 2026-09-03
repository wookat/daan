import { describe, it, expect } from 'vitest';
import { buildReviewSnap, parseReviewSnap } from '../src/review-snap.js';

const NOW = 1_700_000_000;
const item = (over = {}) => ({
  id: 1,
  question_id: 10,
  module: 'yanyu',
  question_text: '题干 A.x B.y',
  correct_answer: 'A',
  explanation: '解析',
  open: true,
  html: '<p>解析</p>',
  ...over,
});
const state = (over = {}) => ({
  rItems: [item(), item({ id: 2, _extra: true, _mid: 33 })],
  rIdx: 1,
  picked: 'B',
  answered: true,
  wasCorrect: false,
  nextDays: 3,
  ...over,
});

describe('buildReviewSnap', () => {
  it('生成快照并裁剪 open/html', () => {
    const s = buildReviewSnap(state(), 'u1', NOW);
    expect(s.uid).toBe('u1');
    expect(s.rIdx).toBe(1);
    expect(s.items).toHaveLength(2);
    expect(s.items[0].open).toBeUndefined();
    expect(s.items[0].html).toBeUndefined();
    expect(s.items[1]._mid).toBe(33);
    expect(s.picked).toBe('B');
    expect(s.answered).toBe(true);
  });

  it('空条目/rIdx 越界/非对象/无 uid fail-closed null', () => {
    expect(buildReviewSnap(state({ rItems: [] }), 'u1', NOW)).toBeNull();
    expect(buildReviewSnap(state({ rIdx: 2 }), 'u1', NOW)).toBeNull();
    expect(buildReviewSnap(state({ rIdx: -1 }), 'u1', NOW)).toBeNull();
    expect(buildReviewSnap(null, 'u1', NOW)).toBeNull();
    expect(buildReviewSnap(state(), '', NOW)).toBeNull();
  });

  it('条目缺 question_text / 超大 fail-closed null', () => {
    expect(buildReviewSnap(state({ rItems: [item({ question_text: '' })], rIdx: 0 }), 'u1', NOW)).toBeNull();
    const big = state({ rItems: [item({ explanation: 'x'.repeat(250 * 1024) })], rIdx: 0 });
    expect(buildReviewSnap(big, 'u1', NOW)).toBeNull();
  });
});

describe('parseReviewSnap', () => {
  const snap = () => buildReviewSnap(state(), 'u1', NOW);

  it('round-trip 恢复内存态（对象与 JSON 字符串均可）', () => {
    const r = parseReviewSnap(snap(), 'u1', NOW + 60);
    expect(r.rIdx).toBe(1);
    expect(r.items[1]._extra).toBe(true);
    expect(r.picked).toBe('B');
    expect(r.answered).toBe(true);
    expect(r.wasCorrect).toBe(false);
    expect(r.nextDays).toBe(3);
    expect(parseReviewSnap(JSON.stringify(snap()), 'u1', NOW + 60)).not.toBeNull();
  });

  it('uid 不符/TTL 过期/未来时间戳 fail-closed null', () => {
    expect(parseReviewSnap(snap(), 'u2', NOW + 60)).toBeNull();
    expect(parseReviewSnap(snap(), 'u1', NOW + 2 * 3600 + 1)).toBeNull();
    expect(parseReviewSnap(snap(), 'u1', NOW - 3600)).toBeNull();
  });

  it('畸形 JSON/形状/版本/rIdx 越界 fail-closed null', () => {
    expect(parseReviewSnap('{bad json', 'u1', NOW)).toBeNull();
    expect(parseReviewSnap(null, 'u1', NOW)).toBeNull();
    expect(parseReviewSnap({ v: 2, uid: 'u1', ts: NOW, rIdx: 0, items: [item()] }, 'u1', NOW)).toBeNull();
    expect(parseReviewSnap({ v: 1, uid: 'u1', ts: NOW, rIdx: 5, items: [item()] }, 'u1', NOW)).toBeNull();
    expect(parseReviewSnap({ v: 1, uid: 'u1', ts: NOW, rIdx: 0, items: ['x'] }, 'u1', NOW)).toBeNull();
    expect(parseReviewSnap({ v: 1, uid: 'u1', ts: NOW, rIdx: 0, items: [] }, 'u1', NOW)).toBeNull();
  });
});
