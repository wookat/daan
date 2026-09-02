import { describe, it, expect } from 'vitest';
import { isQFaved, toggleQFav, missingSnapIds } from '../src/shenlun-qfav.js';

const q = (id) => ({ id, qtype: '归纳概括', paper: 'P', exam_year: 2023, exam_region: '国考', question: '题' + id });

describe('shenlun-qfav', () => {
  it('收藏：头插快照并记 id', () => {
    const r = toggleQFav({ ids: [], snaps: [] }, q(1));
    expect(r.added).toBe(true);
    expect(r.ids).toEqual([1]);
    expect(r.snaps[0]).toMatchObject({ id: 1, qtype: '归纳概括', question: '题1' });
  });

  it('取消收藏：同时移除 id 与快照', () => {
    const s1 = toggleQFav({ ids: [], snaps: [] }, q(1));
    const s2 = toggleQFav(s1, q(2));
    const r = toggleQFav(s2, q(1));
    expect(r.added).toBe(false);
    expect(r.ids).toEqual([2]);
    expect(r.snaps.map((x) => x.id)).toEqual([2]);
  });

  it('无效 id 不改状态', () => {
    const r = toggleQFav({ ids: [1], snaps: [q(1)] }, { id: 'x' });
    expect(r.ids).toEqual([1]);
    expect(r.added).toBe(false);
  });

  it('不可变：不改原数组', () => {
    const ids = [1];
    const snaps = [q(1)];
    toggleQFav({ ids, snaps }, q(2));
    expect(ids).toEqual([1]);
    expect(snaps.length).toBe(1);
  });

  it('快照上限 200', () => {
    let s = { ids: [], snaps: [] };
    for (let i = 1; i <= 201; i++) s = toggleQFav(s, q(i));
    expect(s.snaps.length).toBe(200);
    expect(s.ids.length).toBe(201);
  });

  it('isQFaved 与 missingSnapIds', () => {
    expect(isQFaved([1, 2], 2)).toBe(true);
    expect(isQFaved([], 1)).toBe(false);
    expect(isQFaved(null, 1)).toBe(false);
    expect(missingSnapIds([1, 2, 3], [q(2)])).toEqual([1, 3]);
    expect(missingSnapIds(null, null)).toEqual([]);
  });
});
