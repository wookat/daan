import { describe, it, expect } from 'vitest';
import { BOOK_PATH, buildBookUrl, parseBookOpts } from '../src/book-url.js';

describe('buildBookUrl', () => {
  it('全默认回落基础路径', () => {
    expect(buildBookUrl()).toBe(BOOK_PATH);
    expect(buildBookUrl({ tab: 'todo', mod: '', src: '', sort: 'time' })).toBe(BOOK_PATH);
  });

  it('tab/mod/src/sort 组合拼接', () => {
    expect(buildBookUrl({ tab: 'done' })).toBe(BOOK_PATH + '?tab=done');
    expect(buildBookUrl({ mod: 'shuliang', src: 'exam', sort: 'times' })).toBe(
      BOOK_PATH + '?mod=shuliang&src=exam&sort=times'
    );
    expect(buildBookUrl({ tab: 'done', mod: 'ziliao' })).toBe(BOOK_PATH + '?tab=done&mod=ziliao');
  });

  it('fav tab 不叠筛选/排序参数', () => {
    expect(buildBookUrl({ tab: 'fav', mod: 'ziliao', src: 'exam', sort: 'due' })).toBe(BOOK_PATH + '?tab=fav');
  });

  it('非法值忽略', () => {
    expect(buildBookUrl({ tab: 'x', mod: 'nope', src: 'y', sort: 'z' })).toBe(BOOK_PATH);
    expect(buildBookUrl({ mod: 'ziliao', sort: 'time' })).toBe(BOOK_PATH + '?mod=ziliao');
  });
});

describe('parseBookOpts', () => {
  it('白名单收参，非法回空', () => {
    expect(parseBookOpts({ tab: 'done', mod: 'yanyu', src: 'practice', sort: 'reason' })).toEqual({
      tab: 'done',
      mod: 'yanyu',
      src: 'practice',
      sort: 'reason',
      review: false,
    });
    expect(parseBookOpts({ tab: 'nope', mod: '<x>', src: '1', sort: 'DESC' })).toEqual({
      tab: '',
      mod: '',
      src: '',
      sort: '',
      review: false,
    });
    expect(parseBookOpts()).toEqual({ tab: '', mod: '', src: '', sort: '', review: false });
  });

  it('review 仅 "1" 生效', () => {
    expect(parseBookOpts({ review: '1' }).review).toBe(true);
    expect(parseBookOpts({ review: '0' }).review).toBe(false);
    expect(parseBookOpts({ review: 'true' }).review).toBe(false);
    expect(parseBookOpts({ review: 1 }).review).toBe(false);
  });
});
