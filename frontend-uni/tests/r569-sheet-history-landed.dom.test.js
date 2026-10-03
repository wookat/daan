// @vitest-environment jsdom
// R569 生产实测（同序列在 R568 bundle 复现，既有）：错题本 ?mod=changshi 开筛选层选 kp/qt → 关层 → 更多操作层重练 → 页头返回，
// UI 仍是「法律 · 个税」筛选，地址栏只剩 ?mod=changshi。哑条目在筛选层打开那一刻的 URL 上 push，层内改筛选只 replaceState 了哑条目，
// 本页真条目的 query 停在开层前；Back 逐条跳过哑条目落到真条目后，页面得到 onSheetHistoryLanded 回调按当前筛选重写 URL。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sheetOpened, sheetClosed, noteRouteChange, noteHistoryPop, installSheetHistory, onSheetHistoryLanded, _resetSheetHistory } from '../src/sheet-history.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isBookHref } from '../src/book-url.js';

const flush = () => new Promise((r) => setTimeout(r, 20));
const BOOK = '/#/pages/book/book';
const FULL = BOOK + '?mod=changshi&kp=%E6%B3%95%E5%BE%8B&qt=%E6%B3%95%E5%BE%8B-%E4%B8%AA%E7%A8%8E';

function pageState(pos, extra = {}) {
  return { position: pos, __id__: pos + 1, ...extra };
}

function mockRouterOnPop() {
  const onPop = () => {
    noteHistoryPop();
    noteRouteChange();
  };
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}

// 页面自己的 syncBookUrl：就地 replaceState 改 query
function syncUrl(url) {
  window.history.replaceState(window.history.state, '', url);
}

let detach;
beforeEach(() => {
  _resetSheetHistory();
  window.history.replaceState(pageState(0), '', '/#/pages/home/home');
  window.history.pushState(pageState(1), '', BOOK + '?mod=changshi');
  detach = mockRouterOnPop();
  installSheetHistory();
});

afterEach(() => {
  detach();
  _resetSheetHistory();
});

async function deepAndBack() {
  // 更多操作层 → 重练：vue-router push 练习页；afterEach 同步当前条目
  window.history.pushState(pageState(3), '', '/#/pages/practice/practice');
  noteRouteChange();
  window.history.back();
  for (let i = 0; i < 6; i++) await flush();
}

describe('sheet-history：跳过哑条目落回本页真条目时回调（R569）', () => {
  it('筛选层内改筛选 → 关层 → 重练 → 返回：落地真条目 query 是开层前的，回调让页面重写', async () => {
    const t = sheetOpened(() => {});
    syncUrl(FULL); // 层内选 kp/qt：只改了哑条目
    sheetClosed(t);
    expect(window.location.hash).toBe(FULL.slice(1));
    const landed = vi.fn((href) => {
      if (isBookHref(href)) syncUrl(FULL);
    });
    onSheetHistoryLanded(landed);
    await deepAndBack();
    expect(landed).toHaveBeenCalledTimes(1);
    expect(landed.mock.calls[0][0]).toContain('#/pages/book/book?mod=changshi');
    expect(window.location.hash).toBe(FULL.slice(1));
    expect(window.history.state.__kgSheet).toBeUndefined();
    expect(window.history.state.position).toBe(1);
  });

  it('两条哑条目（筛选层 + 更多操作层）链跳过后也只回调一次', async () => {
    const t1 = sheetOpened(() => {});
    syncUrl(FULL);
    sheetClosed(t1);
    const t2 = sheetOpened(() => {});
    sheetClosed(t2);
    const landed = vi.fn();
    onSheetHistoryLanded(landed);
    await deepAndBack();
    expect(landed).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/pages/book/book?mod=changshi');
  });

  it('无哑条目的普通返回不回调；取消订阅后不再回调', async () => {
    const landed = vi.fn();
    const off = onSheetHistoryLanded(landed);
    await deepAndBack();
    expect(landed).not.toHaveBeenCalled();
    off();
    sheetClosed(sheetOpened(() => {}));
    await deepAndBack();
    expect(landed).not.toHaveBeenCalled();
  });

  it('护栏：Esc 关层后直接 Back（从哑条目离开）仍一次离页，不回调', async () => {
    const landed = vi.fn();
    onSheetHistoryLanded(landed);
    sheetClosed(sheetOpened(() => {}));
    window.history.back();
    await flush();
    await flush();
    expect(window.location.hash).toBe('#/pages/home/home');
    expect(landed).not.toHaveBeenCalled();
  });

  it('护栏：层仍开着时从深页返回不回调（层保持打开）', async () => {
    const landed = vi.fn();
    onSheetHistoryLanded(landed);
    sheetOpened(() => {});
    await deepAndBack();
    expect(landed).not.toHaveBeenCalled();
    expect(window.history.state.__kgSheet).toBeTruthy();
  });

  it('book.vue：onLoad 订阅、只在本页且深链 kp 未落地前不重写、onUnload 取消', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/book/book.vue'), 'utf8');
    expect(src).toMatch(/import \{ onSheetHistoryLanded \} from '\.\.\/\.\.\/sheet-history\.js'/);
    expect(src).toMatch(/this\._offLanded = onSheetHistoryLanded\(\(href\) => \{\s*if \(isBookHref\(href\) && !this\._pendingKp && !this\._pendingKp3\) this\.syncBookUrl\(\);/);
    expect(src).toMatch(/onUnload\(\) \{[\s\S]*?if \(this\._offLanded\) \{\s*this\._offLanded\(\);/);
  });

  it('isBookHref：只认错题本 hash 路径，忽略 query', () => {
    expect(isBookHref('https://kaogong.zalize.com/#/pages/book/book?mod=changshi')).toBe(true);
    expect(isBookHref('https://kaogong.zalize.com/#/pages/book/book')).toBe(true);
    expect(isBookHref('https://kaogong.zalize.com/#/pages/practice/practice')).toBe(false);
    expect(isBookHref('https://kaogong.zalize.com/')).toBe(false);
    expect(isBookHref('')).toBe(false);
  });
});
