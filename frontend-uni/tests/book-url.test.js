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
      kp: '',
      kp3: '',
      src: 'practice',
      pid: 0,
      rz: '',
      sort: 'reason',
      review: false,
    });
    expect(parseBookOpts({ tab: 'nope', mod: '<x>', src: '1', sort: 'DESC' })).toEqual({
      tab: '',
      mod: '',
      kp: '',
      kp3: '',
      src: '',
      pid: 0,
      rz: '',
      sort: '',
      review: false,
    });
    expect(parseBookOpts()).toEqual({ tab: '', mod: '', kp: '', kp3: '', src: '', pid: 0, rz: '', sort: '', review: false });
  });

  it('pid 归卷筛选：正整数入链，非法 fail-closed（R368）', () => {
    expect(buildBookUrl({ pid: 42 })).toBe(BOOK_PATH + '?pid=42');
    expect(buildBookUrl({ pid: '17' })).toBe(BOOK_PATH + '?pid=17');
    expect(buildBookUrl({ pid: 0 })).toBe(BOOK_PATH);
    expect(buildBookUrl({ pid: -3 })).toBe(BOOK_PATH);
    expect(buildBookUrl({ pid: 'abc' })).toBe(BOOK_PATH);
    expect(buildBookUrl({ pid: '1e3' })).toBe(BOOK_PATH);
    expect(buildBookUrl({ tab: 'fav', pid: 42 })).toBe(BOOK_PATH + '?tab=fav');
    expect(parseBookOpts({ pid: '42' }).pid).toBe(42);
    expect(parseBookOpts({ pid: 42 }).pid).toBe(42);
    expect(parseBookOpts({ pid: '0' }).pid).toBe(0);
    expect(parseBookOpts({ pid: '-1' }).pid).toBe(0);
    expect(parseBookOpts({ pid: '1.5' }).pid).toBe(0);
    expect(parseBookOpts({ pid: 'x' }).pid).toBe(0);
    expect(parseBookOpts({ pid: ['1'] }).pid).toBe(0);
  });

  it('rz 错因白名单，非法 fail-closed，支持 URL 编码', () => {
    expect(parseBookOpts({ rz: '概念不清' }).rz).toBe('概念不清');
    expect(parseBookOpts({ rz: '未标注' }).rz).toBe('未标注');
    expect(parseBookOpts({ rz: encodeURIComponent('粗心大意') }).rz).toBe('粗心大意');
    expect(parseBookOpts({ rz: '不存在错因' }).rz).toBe('');
    expect(parseBookOpts({ rz: '%E0%A4%A' }).rz).toBe('');
    expect(parseBookOpts({ rz: 1 }).rz).toBe('');
  });

  it('rz 拼接与 fav 不叠加', () => {
    expect(buildBookUrl({ rz: '方法不会' })).toBe(BOOK_PATH + '?rz=' + encodeURIComponent('方法不会'));
    expect(buildBookUrl({ tab: 'fav', rz: '方法不会' })).toBe(BOOK_PATH + '?tab=fav');
    expect(buildBookUrl({ rz: '不存在' })).toBe(BOOK_PATH);
  });

  it('kp/kp3 形状校验：非空且 ≤40 字符，支持编码，畸形 fail-closed', () => {
    expect(parseBookOpts({ kp: encodeURIComponent('语句填空') }).kp).toBe('语句填空');
    expect(parseBookOpts({ kp3: encodeURIComponent('中国古代史') }).kp3).toBe('中国古代史');
    expect(parseBookOpts({ kp: '' }).kp).toBe('');
    expect(parseBookOpts({ kp: 'x'.repeat(41) }).kp).toBe('');
    expect(parseBookOpts({ kp3: '%E0%A4%A' }).kp3).toBe('');
    expect(parseBookOpts({ kp: 1, kp3: {} })).toMatchObject({ kp: '', kp3: '' });
  });

  it('kp/kp3 拼接：编码输出、fav 不叠加、超长/空不输出', () => {
    expect(buildBookUrl({ kp: '语句填空' })).toBe(BOOK_PATH + '?kp=' + encodeURIComponent('语句填空'));
    expect(buildBookUrl({ mod: 'changshi', kp3: '中国古代史' })).toBe(BOOK_PATH + '?mod=changshi&kp3=' + encodeURIComponent('中国古代史'));
    expect(buildBookUrl({ tab: 'fav', kp: '语句填空', kp3: '中国古代史' })).toBe(BOOK_PATH + '?tab=fav');
    expect(buildBookUrl({ kp: '' })).toBe(BOOK_PATH);
    expect(buildBookUrl({ kp3: 'x'.repeat(41) })).toBe(BOOK_PATH);
  });

  it('review 仅 "1" 生效', () => {
    expect(parseBookOpts({ review: '1' }).review).toBe(true);
    expect(parseBookOpts({ review: '0' }).review).toBe(false);
    expect(parseBookOpts({ review: 'true' }).review).toBe(false);
    expect(parseBookOpts({ review: 1 }).review).toBe(false);
  });
});
