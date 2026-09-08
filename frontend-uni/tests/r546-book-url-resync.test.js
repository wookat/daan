// R546：错题本 筛选→重练→返回 后地址栏丢 mod/kp/qt（R545 生产复验发现的既有 P2）
// 机理（node_modules/vue-router push()）：离开本页时 router 先用自己记的 currentLocation（不含我们 replaceState 进去的筛选 query）
// replaceState 覆写当前历史条目，返回后浏览器恢复的就是这条旧地址；页面实例（tabbar 常驻）里筛选仍在，刷新即丢。
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue');
const script = book.slice(book.indexOf('<script'), book.indexOf('</script>'));
const block = (name) => {
  const m = script.match(new RegExp(`\\n {2}${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {2}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};
const method = (name) => {
  const m = script.match(new RegExp(`\\n {4}${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};

describe('R546 重练返回后地址栏筛选同步', () => {
  it('onShow：H5 下按当前筛选重写地址栏，但深链 kp/kp3 尚未落地时不动（留给 applyPendingKp）', () => {
    const onShow = block('onShow');
    expect(onShow).toContain("if (!this._pendingKp && !this._pendingKp3) this.syncBookUrl();");
    // 同步发生在 load() 之后、H5 条件编译块内
    const h5 = onShow.slice(onShow.indexOf('// #ifdef H5'), onShow.indexOf('// #endif'));
    expect(h5).toContain('this.syncBookUrl()');
    expect(onShow.indexOf('this.load();')).toBeLessThan(onShow.indexOf('this.syncBookUrl()'));
  });

  it('applyPendingKp 落地/丢弃深链后仍各自 syncBookUrl（首帧被跳过的同步由此补上）', () => {
    const apply = method('applyPendingKp');
    // 三条出口：无 pending 且需修正、kp 命中（watcher 触发）、kp 不命中兜底
    expect(apply).toContain('this._pendingKpFix = false;\n          this.syncBookUrl();');
    expect(apply.trim().endsWith('this.syncBookUrl();')).toBe(true);
  });

  it('syncBookUrl：replaceState 保留 history.state（vue-router/uni 的 position/__id__ 不被抹成 null）', () => {
    const sync = method('syncBookUrl');
    expect(sync).toContain("window.history.replaceState(window.history.state, '', buildBookUrl(");
    expect(sync).not.toContain("replaceState(null");
  });

  it('模拟：重练返回（onShow）后地址栏恢复 mod/kp/qt，且 state 原样保留', async () => {
    const { buildBookUrl } = await import('../src/book-url.js');
    const state = { __id__: 3, position: 2, current: '/pages/book/book' };
    const replaceState = vi.fn();
    const vm = {
      tab: 'todo', filterMod: 'shuliang', kpFilter: '排列组合与概率', qtFilter: '概率问题', kp3Filter: '', srcFilter: '', pidFilter: '', rzFilter: '', sortBy: '',
      _pendingKp: '', _pendingKp3: '',
    };
    const g = { window: { history: { state, replaceState } } };
    const sync = new Function('window', 'buildBookUrl', `return function(){${method('syncBookUrl').replace(/[ \t]*\/\/ #(ifdef H5|endif)[^\n]*/g, '')}}`)(g.window, buildBookUrl).bind(vm);
    vm.syncBookUrl = sync;
    // 重练返回：无 pending 深链 → 同步
    if (!vm._pendingKp && !vm._pendingKp3) vm.syncBookUrl();
    expect(replaceState).toHaveBeenCalledTimes(1);
    const [st, , url] = replaceState.mock.calls[0];
    expect(st).toBe(state);
    expect(url).toBe(buildBookUrl({ tab: 'todo', mod: 'shuliang', kp: '排列组合与概率', qt: '概率问题', kp3: '', src: '', pid: '', rz: '', sort: '' }));
    expect(url).toContain('mod=shuliang');
    expect(url).toContain('kp=');
    expect(url).toContain('qt=');
    // 深链首帧：kp 尚未落地 → 不同步
    vm._pendingKp = '排列组合与概率';
    if (!vm._pendingKp && !vm._pendingKp3) vm.syncBookUrl();
    expect(replaceState).toHaveBeenCalledTimes(1);
  });
});
