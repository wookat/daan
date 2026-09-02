import { describe, expect, it } from 'vitest';
import { FAVORITES_PATH, buildFavoritesUrl, parseFavoritesOpts } from '../src/favorites-url.js';

describe('buildFavoritesUrl', () => {
  it('默认态回落基础路径', () => {
    expect(buildFavoritesUrl({})).toBe(FAVORITES_PATH);
    expect(buildFavoritesUrl(null)).toBe(FAVORITES_PATH);
    expect(buildFavoritesUrl({ tab: '', mod: '', folder: null })).toBe(FAVORITES_PATH);
  });
  it('笔记 tab 不叠收藏侧参数', () => {
    expect(buildFavoritesUrl({ tab: 'note', mod: 'ziliao', folder: 3 })).toBe(FAVORITES_PATH + '?tab=note');
  });
  it('模块白名单 + 中文键编码', () => {
    expect(buildFavoritesUrl({ mod: 'ziliao' })).toBe(FAVORITES_PATH + '?mod=ziliao');
    expect(buildFavoritesUrl({ mod: '时政' })).toBe(FAVORITES_PATH + '?mod=' + encodeURIComponent('时政'));
    expect(buildFavoritesUrl({ mod: 'nope' })).toBe(FAVORITES_PATH);
  });
  it('folder 为 ≥0 整数才生效（0=默认夹合法）', () => {
    expect(buildFavoritesUrl({ folder: 0 })).toBe(FAVORITES_PATH + '?folder=0');
    expect(buildFavoritesUrl({ folder: 5, mod: 'yanyu' })).toBe(FAVORITES_PATH + '?mod=yanyu&folder=5');
    expect(buildFavoritesUrl({ folder: -1 })).toBe(FAVORITES_PATH);
    expect(buildFavoritesUrl({ folder: 1.5 })).toBe(FAVORITES_PATH);
    expect(buildFavoritesUrl({ folder: '' })).toBe(FAVORITES_PATH);
  });
});

describe('parseFavoritesOpts', () => {
  it('白名单恢复', () => {
    expect(parseFavoritesOpts({ tab: 'note' })).toEqual({ tab: 'note', mod: '', folder: null });
    expect(parseFavoritesOpts({ mod: 'panduan', folder: '2' })).toEqual({ tab: '', mod: 'panduan', folder: 2 });
    expect(parseFavoritesOpts({ mod: encodeURIComponent('时政') })).toEqual({ tab: '', mod: '时政', folder: null });
  });
  it('非法参数安全忽略', () => {
    expect(parseFavoritesOpts({ tab: 'x', mod: 'nope', folder: 'abc' })).toEqual({ tab: '', mod: '', folder: null });
    expect(parseFavoritesOpts({ folder: '-3' })).toEqual({ tab: '', mod: '', folder: null });
    expect(parseFavoritesOpts({ mod: '%zz' })).toEqual({ tab: '', mod: '', folder: null });
    expect(parseFavoritesOpts()).toEqual({ tab: '', mod: '', folder: null });
  });
});
