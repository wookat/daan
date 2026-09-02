import { describe, it, expect } from 'vitest';
import { toggleExcl, pickWithExcl } from '../src/exam-excl.js';

describe('toggleExcl（R319 排除干扰项）', () => {
  it('长按未排除项加入排除，不改已选', () => {
    expect(toggleExcl([], 'B', 'A')).toEqual({ excl: ['B'], picked: 'A' });
  });

  it('再次长按已排除项恢复', () => {
    expect(toggleExcl(['B', 'C'], 'B', '')).toEqual({ excl: ['C'], picked: '' });
  });

  it('排除当前已选项时同时清除选择', () => {
    expect(toggleExcl([], 'A', 'A')).toEqual({ excl: ['A'], picked: '' });
  });

  it('非法入参 fail-closed：excl 非数组按空处理、k 非法原样返回', () => {
    expect(toggleExcl(undefined, 'A', 'B')).toEqual({ excl: ['A'], picked: 'B' });
    expect(toggleExcl('bad', 'A', '')).toEqual({ excl: ['A'], picked: '' });
    expect(toggleExcl([1, 'B'], '', 'A')).toEqual({ excl: ['B'], picked: 'A' });
    expect(toggleExcl(['B'], null, 'A')).toEqual({ excl: ['B'], picked: 'A' });
  });

  it('输入不可变', () => {
    const src = ['B'];
    toggleExcl(src, 'C', '');
    expect(src).toEqual(['B']);
  });
});

describe('pickWithExcl（R319 选择即恢复）', () => {
  it('选中被排除项时从排除数组移除', () => {
    expect(pickWithExcl(['A', 'B'], 'A')).toEqual(['B']);
  });

  it('选中未排除项不影响排除数组', () => {
    expect(pickWithExcl(['B'], 'A')).toEqual(['B']);
  });

  it('非法入参 fail-closed', () => {
    expect(pickWithExcl(undefined, 'A')).toEqual([]);
    expect(pickWithExcl([2, 'B'], '')).toEqual(['B']);
  });
});
