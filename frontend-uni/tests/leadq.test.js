import { describe, expect, it } from 'vitest';

import { leadHintText, leadPickOf, leadQidOf, mergeLead } from '../src/leadq.js';

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

describe('leadPickOf', () => {
  it('只接单个大写选项字母', () => {
    expect(leadPickOf({ pick: 'A' })).toBe('A');
    expect(leadPickOf({ pick: 'D' })).toBe('D');
  });

  it('缺失/小写/多字符/非字母返回 null', () => {
    expect(leadPickOf(undefined)).toBeNull();
    expect(leadPickOf({})).toBeNull();
    expect(leadPickOf({ pick: '' })).toBeNull();
    expect(leadPickOf({ pick: 'a' })).toBeNull();
    expect(leadPickOf({ pick: 'AB' })).toBeNull();
    expect(leadPickOf({ pick: '1' })).toBeNull();
    expect(leadPickOf({ pick: ['A'] })).toBeNull();
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

describe('leadHintText', () => {
  it('有考点标签说同考点，无标签只能说同模块', () => {
    expect(leadHintText('ZL-BZ-01', 11)).toBe('刚才那题在这里作答，之后 10 题同考点练习');
    expect(leadHintText(null, 11)).toBe('刚才那题在这里作答，之后 10 题同模块练习');
  });

  it('只剩领跑题一题时不承诺后续练习', () => {
    expect(leadHintText('ZL-BZ-01', 1)).toBe('刚才那题在这里作答');
    expect(leadHintText(null, 0)).toBe('刚才那题在这里作答');
  });
});
