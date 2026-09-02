import { describe, it, expect } from 'vitest';
import { nextPaper } from '../src/exam-next.js';

const p = (id, extra = {}) => ({ id, title: '卷' + id, year: 2024, region: '四川', takers: 0, ...extra });
const cur = { id: 1, region: '四川' };

describe('nextPaper（R308 下一卷推荐 fail-closed）', () => {
  it('非数组/无 cur.id/无候选 → null', () => {
    expect(nextPaper(null, [], cur)).toBe(null);
    expect(nextPaper([p(2)], [], null)).toBe(null);
    expect(nextPaper([p(2)], [], { id: 0 })).toBe(null);
    expect(nextPaper([], [], cur)).toBe(null);
    expect(nextPaper([p(1)], [], cur)).toBe(null);
  });

  it('排除已考过的卷（attempts.paper_id），非法 attempts 行忽略', () => {
    expect(nextPaper([p(2)], [{ paper_id: 2 }], cur)).toBe(null);
    const r = nextPaper([p(2), p(3)], [{ paper_id: 2 }, null, { paper_id: 'x' }], cur);
    expect(r.id).toBe(3);
  });

  it('非法卷行过滤：id 非正整数 / title 空', () => {
    expect(nextPaper([p(2.5), { id: 3, title: '  ' }, p(-1)], [], cur)).toBe(null);
  });

  it('同 region 优先于年份', () => {
    const r = nextPaper([p(2, { region: '国考', year: 2025 }), p(3, { region: '四川', year: 2022 })], [], cur);
    expect(r.id).toBe(3);
  });

  it('同 region 内 year 降序，缺 year 排后；再按 takers、id 降序', () => {
    expect(nextPaper([p(2, { year: 2023 }), p(3, { year: 2025 })], [], cur).id).toBe(3);
    expect(nextPaper([p(2, { year: null }), p(3, { year: 2020 })], [], cur).id).toBe(3);
    expect(nextPaper([p(2, { takers: 1 }), p(3, { takers: 9 })], [], cur).id).toBe(3);
    expect(nextPaper([p(2), p(3)], [], cur).id).toBe(3);
  });

  it('cur.region 缺失时不做 region 加权', () => {
    const r = nextPaper([p(2, { region: '国考', year: 2025 }), p(3, { region: '四川', year: 2022 })], [], { id: 1 });
    expect(r.id).toBe(2);
  });

  it('社会证明字段透传：takers/avg_score 合法透传，非法归零/null', () => {
    const r = nextPaper([p(2, { takers: 7, avg_score: 61.5 })], [], cur);
    expect(r).toEqual({ id: 2, title: '卷2', year: 2024, region: '四川', takers: 7, avgScore: 61.5 });
    const r2 = nextPaper([p(3, { takers: NaN, avg_score: 'x' })], [], cur);
    expect(r2.takers).toBe(0);
    expect(r2.avgScore).toBe(null);
  });

  it('输入不可变', () => {
    const papers = [p(2, { year: 2020 }), p(3, { year: 2025 })];
    const snap = JSON.stringify(papers);
    nextPaper(papers, [], cur);
    expect(JSON.stringify(papers)).toBe(snap);
  });
});
