import { describe, it, expect } from 'vitest';
import { askQid, askViewUrl, findAskSid } from '../src/ask-link.js';

describe('askViewUrl', () => {
  it('合法 qid 返回搜索深链', () => {
    expect(askViewUrl(914)).toBe('/pkgA/search/search?q=914&qid=914');
    expect(askViewUrl('914')).toBe('/pkgA/search/search?q=914&qid=914');
  });
  it('非法/缺失 qid 一律 fail-closed 返回 null', () => {
    expect(askViewUrl(0)).toBeNull();
    expect(askViewUrl(-1)).toBeNull();
    expect(askViewUrl('abc')).toBeNull();
    expect(askViewUrl(null)).toBeNull();
    expect(askViewUrl(undefined)).toBeNull();
    expect(askViewUrl(1.5)).toBeNull();
  });
});

describe('askQid', () => {
  it('接受正整数 number', () => {
    expect(askQid(123)).toBe(123);
    expect(askQid(1)).toBe(1);
  });
  it('接受纯数字字符串', () => {
    expect(askQid('42')).toBe(42);
    expect(askQid(' 42 ')).toBe(42);
  });
  it('非法值 fail-closed 为 0', () => {
    expect(askQid(0)).toBe(0);
    expect(askQid(-3)).toBe(0);
    expect(askQid(1.5)).toBe(0);
    expect(askQid('12a')).toBe(0);
    expect(askQid('')).toBe(0);
    expect(askQid(null)).toBe(0);
    expect(askQid(undefined)).toBe(0);
    expect(askQid(true)).toBe(0);
    expect(askQid({})).toBe(0);
    expect(askQid([7])).toBe(0);
    expect(askQid(NaN)).toBe(0);
    expect(askQid(Infinity)).toBe(0);
  });
});

describe('findAskSid', () => {
  const sess = (id, qids) => ({ id, ts: id, title: 't', n: qids.length, items: qids.map((q) => ({ qid: q })) });

  it('进行中会话命中返回 sid 0', () => {
    expect(findAskSid([sess(9, [5])], [{ qid: 7 }], 7)).toEqual({ sid: 0 });
  });
  it('归档会话命中返回其 sid（按列表顺序取首个）', () => {
    expect(findAskSid([sess(11, [3]), sess(9, [3])], [], 3)).toEqual({ sid: 11 });
  });
  it('进行中优先于归档', () => {
    expect(findAskSid([sess(11, [3])], [{ qid: 3 }], 3)).toEqual({ sid: 0 });
  });
  it('qid 字符串口径归一后可命中', () => {
    expect(findAskSid([sess(11, [3])], [], '3')).toEqual({ sid: 11 });
    expect(findAskSid([{ id: 11, items: [{ qid: '3' }] }], [], 3)).toEqual({ sid: 11 });
  });
  it('无命中返回 null', () => {
    expect(findAskSid([sess(11, [3])], [{ qid: 5 }], 8)).toBeNull();
  });
  it('无 qid 的存量 item 不误命中', () => {
    expect(findAskSid([{ id: 11, items: [{ question_text: 'x' }] }], [], 1)).toBeNull();
  });
  it('非法输入一律 fail-closed', () => {
    expect(findAskSid(null, null, 3)).toBeNull();
    expect(findAskSid('x', 'y', 3)).toBeNull();
    expect(findAskSid([null, 'x', { id: 2, items: 'bad' }], [null, 'x'], 3)).toBeNull();
    expect(findAskSid([sess(1, [3])], [], 0)).toBeNull();
    expect(findAskSid([sess(1, [3])], [], 'abc')).toBeNull();
  });
  it('命中会话但 sid 非法则跳过继续找', () => {
    expect(findAskSid([{ id: 'bad', items: [{ qid: 3 }] }, sess(9, [3])], [], 3)).toEqual({ sid: 9 });
    expect(findAskSid([{ id: 0, items: [{ qid: 3 }] }], [], 3)).toBeNull();
  });
});
