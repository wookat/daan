// R547：带筛选进入错题本（深链/刷新）后，底部 tab 切到统计再切回 → 页面重建、筛选与地址一起清零（R546 生产复验发现的既有 P3）
// 机理（node_modules/@dcloudio/uni-h5 switchTab → getTabBarPageId → isSamePage）：tabBar 页复用按
// `url === $page.fullPath` 全等匹配，而 $page.fullPath = 进入时 route.fullPath（含 query）；tabBar 点击的 url 是纯路径
// `/pages/book/book`，匹配不到就分配新 __id__ → KeepAlive key 变 → 新实例 onLoad({})。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeTabPageFullPath } from '../src/book-url.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue')+read('../src/pages/book/review-ops.js');
const script = book.slice(book.indexOf('<script'), book.length);
const uniH5 = read('../node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js');

// 与 uni-h5 同口径的复用判定（源码 isSamePage/getTabBarPageId 摘录），用于验证归一后能命中
function isSamePage(url, $page) {
  return url === $page.fullPath || (url === '/' && $page.meta.isEntry);
}

describe('R547 normalizeTabPageFullPath', () => {
  it('带 query 的 fullPath 归一为纯路径并返回 true', () => {
    const page = { path: '/pages/book/book', fullPath: '/pages/book/book?mod=shuliang&kp=%E6%8E%92%E5%88%97', meta: {} };
    expect(normalizeTabPageFullPath(page)).toBe(true);
    expect(page.fullPath).toBe('/pages/book/book');
    expect(isSamePage('/pages/book/book', page)).toBe(true);
  });

  it('已是纯路径 / 缺字段 / 空入参 → 不动并返回 false', () => {
    const plain = { path: '/pages/book/book', fullPath: '/pages/book/book', meta: {} };
    expect(normalizeTabPageFullPath(plain)).toBe(false);
    expect(plain.fullPath).toBe('/pages/book/book');
    expect(normalizeTabPageFullPath(undefined)).toBe(false);
    expect(normalizeTabPageFullPath(null)).toBe(false);
    expect(normalizeTabPageFullPath({ fullPath: '/pages/book/book?mod=x' })).toBe(false);
    expect(normalizeTabPageFullPath({ path: '', fullPath: '/x?y' })).toBe(false);
    const noFull = { path: '/pages/book/book' };
    expect(normalizeTabPageFullPath(noFull)).toBe(false);
    expect(noFull.fullPath).toBeUndefined();
  });

  it('归一前 uni-h5 口径匹配不到（这就是页面重建的原因）', () => {
    const page = { path: '/pages/book/book', fullPath: '/pages/book/book?mod=shuliang', meta: {} };
    expect(isSamePage('/pages/book/book', page)).toBe(false);
  });
});

describe('R547 book.vue 接线', () => {
  it('onLoad 首行在 H5 条件编译内归一 this.$page.fullPath（早于 parseBookOpts）', () => {
    const m = script.match(/\n {2}onLoad\(opts\) \{([\s\S]*?)\n {2}\},/);
    expect(m).toBeTruthy();
    const onLoad = m[1];
    const h5 = onLoad.slice(onLoad.indexOf('// #ifdef H5'), onLoad.indexOf('// #endif'));
    expect(h5).toContain('normalizeTabPageFullPath(this.$page);');
    expect(onLoad.indexOf('normalizeTabPageFullPath')).toBeLessThan(onLoad.indexOf('parseBookOpts(opts)'));
    expect(script).toMatch(/import \{ buildBookUrl, normalizeTabPageFullPath, parseBookOpts \} from '\.\.\/\.\.\/book-url\.js';/);
  });

  it('依赖的 uni-h5 内部口径仍成立：$page.fullPath 取 route.fullPath、tabBar 复用按 url === fullPath', () => {
    expect(uniH5).toContain('let fullPath = route.fullPath;');
    expect(uniH5).toMatch(/function isSamePage\(url, \$page\) \{\s*return url === \$page\.fullPath \|\| url === "\/" && \$page\.meta\.isEntry;/);
    expect(uniH5).toMatch(/function initPageVm\(pageVm, page\) \{[\s\S]*?pageVm\.\$page = page;/);
    // switchTab 用当前 tab 页匹配到的 id 作为新路由 state 的 __id__（命中即复用 KeepAlive 实例）
    expect(uniH5).toMatch(/removeNonTabBarPages\(\), navigate\(\s*\{ type: API_SWITCH_TAB[\s\S]*?getTabBarPageId\(url\)/);
  });
});
