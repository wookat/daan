import { describe, it, expect } from 'vitest';
import { qNavState } from '../src/shenlun-qnav.js';

describe('shenlun-qnav', () => {
  it('中间题：前后皆有', () => {
    expect(qNavState([1, 2, 3], 2)).toEqual({ idx: 1, total: 3, prevId: 1, nextId: 3 });
  });
  it('首题无上一题，末题无下一题', () => {
    expect(qNavState([1, 2, 3], 1)).toEqual({ idx: 0, total: 3, prevId: 0, nextId: 2 });
    expect(qNavState([1, 2, 3], 3)).toEqual({ idx: 2, total: 3, prevId: 2, nextId: 0 });
  });
  it('不在列表（深链直达）：idx=-1 不渲染导航', () => {
    expect(qNavState([1, 2], 9).idx).toBe(-1);
    expect(qNavState([], 1).idx).toBe(-1);
    expect(qNavState(null, 1)).toEqual({ idx: -1, total: 0, prevId: 0, nextId: 0 });
  });
  it('单题列表：前后皆无', () => {
    expect(qNavState([7], 7)).toEqual({ idx: 0, total: 1, prevId: 0, nextId: 0 });
  });
});
