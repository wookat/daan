import { describe, expect, it } from 'vitest';

import { leadQidOf, mergeLead } from '../src/leadq.js';

describe('leadQidOf', () => {
  it('正整数字符串解析为数字', () => {
    expect(leadQidOf({ qid: '4640' })).toBe(4640);
    expect(leadQidOf({ qid: 12 })).toBe(12);
  });

  it('缺失/非法/非正数返回 null', () => {
    expect(leadQidOf(undefined)).toBeNull();
    expect(leadQidOf({})).toBeNull();
    expect(leadQidOf({ qid: '' })).toBeNull();
    expect(leadQidOf({ qid: 'abc' })).toBeNull();
    expect(leadQidOf({ qid: '0' })).toBeNull();
    expect(leadQidOf({ qid: '-3' })).toBeNull();
    expect(leadQidOf({ qid: '1.5' })).toBeNull();
  });
});

describe('mergeLead', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('领跑题置顶，题包中同题去重', () => {
    expect(mergeLead({ id: 2 }, items).map((q) => q.id)).toEqual([2, 1, 3]);
    expect(mergeLead({ id: 9 }, items).map((q) => q.id)).toEqual([9, 1, 2, 3]);
  });

  it('无领跑题 / 已下线题 原题包透传', () => {
    expect(mergeLead(null, items)).toBe(items);
    expect(mergeLead({ id: 5, disabled: 1 }, items)).toBe(items);
    expect(mergeLead({}, items)).toBe(items);
  });

  it('题包为空时只剩领跑题', () => {
    expect(mergeLead({ id: 7 }, [])).toEqual([{ id: 7 }]);
    expect(mergeLead({ id: 7 }, null)).toEqual([{ id: 7 }]);
  });
});
