// @vitest-environment jsdom
// R562：sheet-history 在真实 History API 上的序列（jsdom 的 pushState/back/popstate 与浏览器同语义）。
// 真机实测基线：错题本更多操作层打开 → 浏览器 Back → 直接回首页（R560-1）。这里锁定修后序列：
// Back 只关层；X/Esc 关后 Back 一次离页；从更深页面返回落到哑条目自动跳过；跨页残留标记不生效。
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sheetOpened, sheetClosed, noteRouteChange, noteHistoryPop, installSheetHistory, _resetSheetHistory } from '../src/sheet-history.js';

// 模拟 vue-router 4 的 popstate 链：其 history 监听先于本模块（createRouter 时就 addEventListener），同步回调
// history.listen 订阅者，之后对同 URL / 跨 URL pop 都会跑到 afterEach（同 URL 为 NAVIGATION_DUPLICATED，仍触发 afterEach）
function mockRouter() {
  const after = [];
  const listeners = [];
  const onPop = () => {
    listeners.forEach((l) => l());
    after.forEach((fn) => fn());
  };
  window.addEventListener('popstate', onPop);
  return {
    afterEach: (fn) => after.push(fn),
    options: { history: { listen: (fn) => listeners.push(fn) } },
    push(pos, hash) {
      window.history.replaceState({ ...window.history.state, forward: hash }, '');
      window.history.pushState(pageState(pos), '', '/#' + hash);
      after.forEach((fn) => fn());
    },
    detach: () => window.removeEventListener('popstate', onPop),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 60));

// jsdom 的 traversal 走任务队列；全量跑 CPU 竞争时固定延时不可靠，等 popstate 事件更稳
async function back() {
  const popped = new Promise((r) => window.addEventListener('popstate', r, { once: true }));
  window.history.back();
  await Promise.race([popped, flush()]);
  await flush();
}

// jsdom 的 history.back() 会派发 popstate；但同 URL 条目间 traversal 不触发 hashchange，与浏览器一致
function pageState(pos, extra = {}) {
  return { position: pos, __id__: pos + 1, ...extra };
}

beforeEach(() => {
  _resetSheetHistory();
  window.history.replaceState(pageState(0), '', '/#/pages/home/home');
  window.history.pushState(pageState(1), '', '/#/pages/book/book');
});

afterEach(() => {
  _resetSheetHistory();
});

describe('sheet-history：Back 先关层', () => {
  it('打开 → pushState 同 URL 条目（保留 position/__id__，加 __kgSheet:{t,u}）；Back → 关层回调、留在本页', async () => {
    let open = true;
    const t = sheetOpened(() => { open = false; });
    expect(window.location.hash).toBe('#/pages/book/book');
    expect(window.history.state).toMatchObject({ position: 1, __id__: 2, __kgSheet: { t, u: window.location.href } });
    await back();
    expect(open).toBe(false);
    expect(window.location.hash).toBe('#/pages/book/book');
    expect(window.history.state).toEqual(pageState(1));
    sheetClosed(t);
    await back();
    expect(window.location.hash).toBe('#/pages/home/home');
  });

  it('实测时序：vue-router 对同 URL pop 的 afterEach（NAVIGATION_DUPLICATED）先于本模块 popstate 触发 → 仍关层不离页；跨 URL 返回仍按落地条目判', async () => {
    const routerPop = () => noteRouteChange();
    window.addEventListener('popstate', routerPop);
    installSheetHistory();
    let open = true;
    const t = sheetOpened(() => { open = false; });
    await back();
    expect(open).toBe(false);
    expect(window.location.hash).toBe('#/pages/book/book');
    expect(window.history.state).toEqual(pageState(1));
    sheetClosed(t);
    // 关层后进更深页面再返回：afterEach 先跑（href 变了 → 同步 prev），落到本页原条目不跳过
    window.history.pushState(pageState(2), '', '/#/pages/practice/practice');
    noteRouteChange();
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/book/book');
    await back();
    expect(window.location.hash).toBe('#/pages/home/home');
    window.removeEventListener('popstate', routerPop);
  });

  it('X/Esc 关层（sheetClosed，不动历史）→ 一次 Back 仍离页（哑条目被自动补跳）', async () => {
    const t = sheetOpened(() => {});
    sheetClosed(t);
    expect(window.history.state.__kgSheet.t).toBe(t);
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/home/home');
  });

  it('关层后 navigateTo 更深页面（vue-router push 复制旧 state 再 push 新条目）→ Back 一次回到本页而非首页', async () => {
    const t = sheetOpened(() => {});
    sheetClosed(t);
    // 模拟 vue-router push：replace 当前条目（合并 state）后 push 新页，afterEach → noteRouteChange
    window.history.replaceState({ ...window.history.state, forward: '/pages/practice/practice' }, '');
    window.history.pushState(pageState(2), '', '/#/pages/practice/practice');
    noteRouteChange();
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/book/book');
    expect(window.history.state).toEqual(pageState(1));
    await back();
    expect(window.location.hash).toBe('#/pages/home/home');
  });

  it('层未关就 navigateTo（KeepAlive 页保留 moreSheet）→ Back 回来层仍开、历史一致；再 Back 关层', async () => {
    let open = true;
    const t = sheetOpened(() => { open = false; });
    window.history.replaceState({ ...window.history.state, forward: '/pages/practice/practice' }, '');
    window.history.pushState(pageState(2), '', '/#/pages/practice/practice');
    noteRouteChange();
    await back();
    expect(window.location.hash).toBe('#/pages/book/book');
    expect(open).toBe(true);
    expect(window.history.state.__kgSheet.t).toBe(t);
    await back();
    expect(open).toBe(false);
    expect(window.location.hash).toBe('#/pages/book/book');
  });

  it('switchTab（vue-router replace 把带标记的 state 拷到新 URL）→ 标记对新 URL 无效，Back 正常回上一 tab 不跳过', async () => {
    const t = sheetOpened(() => {});
    sheetClosed(t);
    window.history.replaceState({ ...window.history.state, position: 1 }, '', '/#/pages/home/home');
    expect(window.history.state.__kgSheet.t).toBe(t);
    noteRouteChange();
    expect(window.history.state.__kgSheet).toBeUndefined();
    expect(window.history.state.position).toBe(1);
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/book/book');
  });

  it('叠层：sheet A 上再开 sheet B → Back 关 B（A 仍开）→ Back 关 A → Back 离页', async () => {
    let a = true;
    let b = true;
    const ta = sheetOpened(() => { a = false; });
    const tb = sheetOpened(() => { b = false; });
    await back();
    expect(b).toBe(false);
    expect(a).toBe(true);
    sheetClosed(tb);
    await back();
    expect(a).toBe(false);
    sheetClosed(ta);
    await back();
    expect(window.location.hash).toBe('#/pages/home/home');
  });

  it('页面刷新后落在哑条目上（state 随历史保存，弹层已不存在）→ 一次 Back 离页', async () => {
    const t = sheetOpened(() => {});
    sheetClosed(t);
    // 刷新：模块状态清零但 history.state 保留；App.vue onLaunch 重新 install（不需任何弹层打开）
    _resetSheetHistory();
    expect(window.history.state.__kgSheet.t).toBe(t);
    const afterEach = [];
    installSheetHistory({ afterEach: (fn) => afterEach.push(fn) });
    expect(afterEach).toHaveLength(1);
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/home/home');
  });

  // 生产 FAIL（a5164498 D1）：首页 → 错题本 tab（uni 在 afterEach 之后再 replaceState 改 URL）/ 错题本自身 syncBookUrl 写 ?mod=
  // → curHref 与真实地址错位 → 开层后 Back：afterEach 先跑、href 与 curHref 不同而被当成新路由 → prev 被落地 state（无标记）覆写 → 层关不掉
  it('D1：页面不经 router 改写 URL 后开层 → Back 仍关层不离页（popstate 引发的 afterEach 不动 prev）', async () => {
    const r = mockRouter();
    installSheetHistory(r);
    window.history.replaceState(window.history.state, '', '/#/pages/book/book?mod=yanyu');
    let open = true;
    const t = sheetOpened(() => { open = false; });
    expect(window.history.state.__kgSheet).toEqual({ t, u: window.location.href });
    await back();
    expect(open).toBe(false);
    expect(window.location.hash).toBe('#/pages/book/book?mod=yanyu');
    expect(window.history.state.__kgSheet).toBeUndefined();
    sheetClosed(t);
    await back();
    expect(window.location.hash).toBe('#/pages/home/home');
    r.detach();
  });

  it('D1 ?mod 变体（生产 27f5508a FAIL）：开层 → Esc 关 → 页面就地 replaceState 写 ?mod= 到哑条目 → 重开 → Back 关层 → Back 离页（哑条目 URL 只差 query 仍视为本页）', async () => {
    const r = mockRouter();
    installSheetHistory(r);
    const t1 = sheetOpened(() => {});
    sheetClosed(t1);
    // book.vue syncBookUrl：选筛选 chip 后 replaceState(history.state, '', '?mod=shuliang')，标记 u 仍是无 query 的旧 href
    window.history.replaceState(window.history.state, '', '/#/pages/book/book?mod=shuliang');
    expect(window.history.state.__kgSheet).toEqual({ t: t1, u: 'http://localhost:3000/#/pages/book/book' });
    let open = true;
    const t2 = sheetOpened(() => { open = false; });
    await back();
    expect(open).toBe(false);
    expect(window.location.hash).toBe('#/pages/book/book?mod=shuliang');
    sheetClosed(t2);
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/home/home');
    r.detach();
  });

  it('D2：同库序列下 Esc/X 关层后一次 Back 离页；关层后 router push 更深页面仍正常同步 prev', async () => {
    const r = mockRouter();
    installSheetHistory(r);
    window.history.replaceState(window.history.state, '', '/#/pages/book/book?mod=yanyu');
    const t = sheetOpened(() => {});
    sheetClosed(t);
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/home/home');
    // 回到错题本再来一轮：关层后 push 更深页（非 pop 的 afterEach 照常同步），Back 一次回错题本不跳过
    const fwd = new Promise((r) => window.addEventListener('popstate', r, { once: true }));
    window.history.forward();
    await Promise.race([fwd, flush()]);
    await flush();
    expect(window.location.hash).toBe('#/pages/book/book?mod=yanyu');
    const t2 = sheetOpened(() => {});
    sheetClosed(t2);
    r.push(2, '/pages/practice/practice');
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/book/book?mod=yanyu');
    expect(window.history.state.__kgSheet).toBeUndefined();
    await back();
    expect(window.location.hash).toBe('#/pages/home/home');
    r.detach();
  });

  it('D3：筛选层上叠导出确认层（两层都登记）→ Back 关顶层 → Back 关下层 → Back 离页（带 router 链）', async () => {
    const r = mockRouter();
    installSheetHistory(r);
    let a = true;
    let b = true;
    const ta = sheetOpened(() => { a = false; });
    const tb = sheetOpened(() => { b = false; });
    await back();
    expect([a, b]).toEqual([true, false]);
    sheetClosed(tb);
    await back();
    expect(a).toBe(false);
    expect(window.location.hash).toBe('#/pages/book/book');
    sheetClosed(ta);
    await back();
    expect(window.location.hash).toBe('#/pages/home/home');
    r.detach();
  });

  it('history.listen 标记后 afterEach 未触发（导航被取消）→ 标记由 popstate 清掉，不影响下一次 router push 同步', async () => {
    installSheetHistory({ afterEach: () => {}, options: { history: { listen: () => {} } } });
    noteHistoryPop();
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: window.history.state }));
    window.history.pushState(pageState(2), '', '/#/pages/practice/practice');
    noteRouteChange();
    const t = sheetOpened(() => {});
    expect(window.history.state.__kgSheet.t).toBe(t);
    sheetClosed(t);
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/book/book');
  });

  // R564 本地复现：F5 恢复层 Esc 关掉（哑条目留为当前条目）→ 再 F5 → 恢复层再开 → Back 不关层。
  // 刷新后 seq 归零，新 token 与哑条目的 t 相同，落回哑条目被判成「层仍开着」。
  it('刷新落在哑条目上再开层：新 token 不与哑条目重合，Back 关层并留在本页，再 Back 跳过哑条目离页', async () => {
    const t0 = sheetOpened(() => {});
    sheetClosed(t0); // Esc 关：哑条目仍是当前条目
    expect(window.history.state.__kgSheet.t).toBe(t0);
    _resetSheetHistory(); // 模拟 F5：模块状态归零，history 保留
    installSheetHistory();
    let open = true;
    const t = sheetOpened(() => { open = false; });
    expect(t).not.toBe(t0);
    await back();
    expect(open).toBe(false);
    expect(window.location.hash).toBe('#/pages/book/book');
    sheetClosed(t);
    await back();
    await flush();
    expect(window.location.hash).toBe('#/pages/home/home');
  });

  // 生产 c0e05ed5 E375 FAIL：练习退出层 Esc/Back/继续/X/遮罩 各关一次再重开（每次开都 pushState）→ 「结束本组并退出」
  // leave() 的 navigateBack 落到上一条已关哑条目 → 补跳链把 skipping 置真，落到本页真条目就停 → URL 仍是练习页、界面空壳。
  // 同形态的 R562 既有缺陷：X 关 → 重开 → X 关 → Back 也停在本页（需再按一次）。
  // 修法：skipping 只在「从更深页面返回」的链上为真；从本页哑条目离开的链一路补 back 到真正离页。
  it('R563-fix-2：连开关三次留下三条哑条目 → 关后一次 Back / navigateBack 直接离页（不停在本页真条目）', async () => {
    const r = mockRouter();
    installSheetHistory(r);
    const t1 = sheetOpened(() => {});
    sheetClosed(t1);
    const t2 = sheetOpened(() => {});
    sheetClosed(t2);
    let open3 = true;
    const t3 = sheetOpened(() => { open3 = false; });
    // Back 关层不离页（落到 t2 哑条目）
    await back();
    expect(open3).toBe(false);
    expect(window.location.hash).toBe('#/pages/book/book');
    sheetClosed(t3);
    // 再开一次并用按钮关（不动历史）→ 页面 navigateBack（history.back）一次 → 链式补跳到离页
    const t4 = sheetOpened(() => {});
    sheetClosed(t4);
    await back();
    await flush();
    await flush();
    expect(window.location.hash).toBe('#/pages/home/home');
    r.detach();
  });

  it('R563-fix-2 反向护栏：两条哑条目后 navigateTo 更深页 → Back 一次跳过整串哑条目回到本页（不越过去离页）', async () => {
    const r = mockRouter();
    installSheetHistory(r);
    const t1 = sheetOpened(() => {});
    sheetClosed(t1);
    const t2 = sheetOpened(() => {});
    sheetClosed(t2);
    r.push(2, '/pages/practice/practice');
    await back();
    await flush();
    await flush();
    expect(window.location.hash).toBe('#/pages/book/book');
    expect(window.history.state.__kgSheet).toBeUndefined();
    await back();
    expect(window.location.hash).toBe('#/pages/home/home');
    r.detach();
  });

  it('无 vue-router state（position 缺失）不叠条目，Back 行为与修前一致', async () => {
    window.history.replaceState(null, '', '/#/pages/book/book');
    let open = true;
    const t = sheetOpened(() => { open = false; });
    expect(window.history.state).toBeNull();
    await back();
    expect(open).toBe(true);
    expect(window.location.hash).toBe('#/pages/home/home');
    sheetClosed(t);
  });
});
