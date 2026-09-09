// @vitest-environment jsdom
// R568：生产实测（09d664a4/CLSTMI1s）错题本更多操作层 Esc 关后、地址栏改 hash 到 #/pages/stats/stats → 页面被弹回错题本。
// 根因：从哑条目上离开且落地无标记时一律视为「Back 落到本页真条目」补 history.back()，把地址栏/书签这类前向 hash 导航也撤销了。
// 修后：落到别页、或历史长度增加（新建条目）都不算 Back；Back 落回本页真条目仍补跳一次离页。
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sheetOpened, sheetClosed, noteRouteChange, noteHistoryPop, installSheetHistory, popAction, _resetSheetHistory } from '../src/sheet-history.js';

const flush = () => new Promise((r) => setTimeout(r, 20));

function pageState(pos, extra = {}) {
  return { position: pos, __id__: pos + 1, ...extra };
}

// vue-router 4 对无 state 的 popstate（地址栏改 hash）：先 replace 出同 position 的 state，再同步回调 history.listen 订阅者、跑 afterEach
function mockRouterOnPop() {
  const onPop = () => {
    if (!window.history.state) {
      window.history.replaceState({ position: 1, replaced: true, current: window.location.hash.slice(1) }, '');
    }
    noteHistoryPop();
    noteRouteChange();
  };
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}

async function hashNav(hash) {
  window.location.hash = hash;
  await flush();
}

let detach;
beforeEach(() => {
  _resetSheetHistory();
  window.history.replaceState(pageState(0), '', '/#/pages/home/home');
  window.history.pushState(pageState(1), '', '/#/pages/book/book');
  detach = mockRouterOnPop();
  installSheetHistory();
});

afterEach(() => {
  detach();
  _resetSheetHistory();
});

describe('sheet-history：哑条目上的前向 hash 导航不被撤销（R568）', () => {
  it('决策表：prev 为已关哑条目、落地无标记且 away → none（不补 back）；非 away 仍 back', () => {
    const closed = () => false;
    expect(popAction(1, null, closed, false, true)).toEqual({ type: 'none', skipping: false });
    expect(popAction(1, null, closed, false, false)).toEqual({ type: 'back', skipping: false });
    expect(popAction(1, null, closed, false)).toEqual({ type: 'back', skipping: false });
    // 层仍开着时 away 不影响关层
    expect(popAction(1, null, () => true, false, true)).toEqual({ type: 'close', token: 1, skipping: false });
  });

  it('Esc 关层（停在哑条目）→ 地址栏改 hash 到统计页 → 停在统计页，不弹回错题本', async () => {
    const t = sheetOpened(() => {});
    sheetClosed(t);
    expect(window.history.state.__kgSheet.t).toBe(t);
    const len = window.history.length;
    await hashNav('#/pages/stats/stats');
    await flush();
    expect(window.location.hash).toBe('#/pages/stats/stats');
    expect(window.history.length).toBe(len + 1);
    // 之后正常 Back：回到哑条目（已关）→ 自动补跳到本页真条目
    window.history.back();
    await flush();
    await flush();
    expect(window.location.hash).toBe('#/pages/book/book');
    expect(window.history.state.__kgSheet).toBeUndefined();
  });

  it('层仍开着时地址栏改 hash → 关层并停在新页', async () => {
    let open = true;
    sheetOpened(() => { open = false; });
    await hashNav('#/pages/stats/stats');
    await flush();
    expect(open).toBe(false);
    expect(window.location.hash).toBe('#/pages/stats/stats');
  });

  it('护栏：Esc 关层后真正 Back（同页真条目、历史长度不变）仍一次离页', async () => {
    const t = sheetOpened(() => {});
    sheetClosed(t);
    window.history.back();
    await flush();
    await flush();
    expect(window.location.hash).toBe('#/pages/home/home');
  });

  it('护栏：R563-fix-2 三条哑条目链仍一路补跳离页', async () => {
    for (let i = 0; i < 3; i++) sheetClosed(sheetOpened(() => {}));
    window.history.back();
    for (let i = 0; i < 5; i++) await flush();
    expect(window.location.hash).toBe('#/pages/home/home');
  });
});
