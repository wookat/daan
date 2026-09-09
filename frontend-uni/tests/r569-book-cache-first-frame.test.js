// R569：错题本 cache-first 首帧口径（R568 生产复验登记的既有 P2 R568-1）
// 现象（生产 1440 带 ?kp=法律&qt=法律-个税 F5，慢 origin）：快照先铺屏但 kp/qt 深链要等真实回包才落地 → 先看到 5 张未筛选卡；
// 头卡「今日待复习 0 题 / 今天没有到期错题」是 /api/review 未回包时的假陈述；离线兜底分支从不应用深链筛选。
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue');
const tpl = book.slice(0, book.indexOf('<script'));
const script = book.slice(book.indexOf('<script'), book.indexOf('</script>'));
const method = (name) => {
  const m = script.match(new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};

const fnOf = (name, args) => new Function(...args, `return function(${args.length ? '' : ''}){${method(name)}}`)();

function makeVm(items, pending) {
  const vm = {
    items, filterMod: '', kpFilter: '', qtFilter: '', kp3Filter: '',
    _pendingKp: pending.kp || '', _pendingQt: pending.qt || '', _pendingKp3: pending.kp3 || '', _pendingKpFix: !!pending.fix,
    groupKey: (m) => m.type_group || m.module,
    tagName: (m) => m.question_type,
    syncBookUrl: vi.fn(),
  };
  const src = method('applyPendingKp');
  const sig = script.match(/\n {4}applyPendingKp\(([^)]*)\) \{/)[1];
  vm.applyPendingKp = new Function(sig, src).bind(vm);
  return vm;
}

const legal = { type_group: '法律', question_type: '法律-个税', module: 'changshi' };
const civil = { type_group: '法律', question_type: '法律-民法', module: 'changshi' };
const logic = { type_group: '逻辑判断', question_type: '逻辑判断(加强削弱)', module: 'panduan' };

describe('R569 applyPendingKp(provisional)：快照先落地筛选、真实回包终判', () => {
  it('provisional 命中：kp/qt 立即生效但不消费 pending，不动 URL', () => {
    const vm = makeVm([legal, civil, logic], { kp: '法律', qt: '法律-个税' });
    vm.applyPendingKp(true);
    expect(vm.kpFilter).toBe('法律');
    expect(vm.qtFilter).toBe('法律-个税');
    expect(vm._pendingKp).toBe('法律');
    expect(vm._pendingQt).toBe('法律-个税');
    expect(vm.syncBookUrl).not.toHaveBeenCalled();
    // 真实回包终判：同样命中 → 保持并清空 pending
    vm.applyPendingKp();
    expect(vm.kpFilter).toBe('法律');
    expect(vm.qtFilter).toBe('法律-个税');
    expect(vm._pendingKp).toBe('');
    expect(vm._pendingQt).toBe('');
    expect(vm.syncBookUrl).not.toHaveBeenCalled(); // watcher 负责同步
  });

  it('provisional 无命中（快照陈旧）：不改筛选、不纠正 URL、pending 保留给真实回包', () => {
    const vm = makeVm([logic], { kp: '法律', qt: '法律-个税' });
    vm.applyPendingKp(true);
    expect(vm.kpFilter).toBe('');
    expect(vm.qtFilter).toBe('');
    expect(vm._pendingKp).toBe('法律');
    expect(vm.syncBookUrl).not.toHaveBeenCalled();
    // 真实回包命中 → 落地
    vm.items = [legal, logic];
    vm.applyPendingKp();
    expect(vm.kpFilter).toBe('法律');
    expect(vm.qtFilter).toBe('法律-个税');
  });

  it('快照命中但真实回包无命中（题已删）：终判回收 provisional 筛选并纠正 URL（fail-closed 不变）', () => {
    const vm = makeVm([legal], { kp: '法律', qt: '法律-个税' });
    vm.applyPendingKp(true);
    expect(vm.kpFilter).toBe('法律');
    vm.items = [logic];
    vm.applyPendingKp();
    expect(vm.kpFilter).toBe('');
    expect(vm.qtFilter).toBe('');
    expect(vm.kp3Filter).toBe('');
    expect(vm._pendingKp).toBe('');
    expect(vm.syncBookUrl).toHaveBeenCalledTimes(1);
  });

  it('provisional 不触发 _pendingKpFix 的 URL 修正（留给终判）', () => {
    const vm = makeVm([legal], { fix: true });
    vm.applyPendingKp(true);
    expect(vm._pendingKpFix).toBe(true);
    expect(vm.syncBookUrl).not.toHaveBeenCalled();
    vm.applyPendingKp();
    expect(vm._pendingKpFix).toBe(false);
    expect(vm.syncBookUrl).toHaveBeenCalledTimes(1);
  });

  it('kp3 深链 provisional 同样生效且不消费', () => {
    const vm = makeVm([{ ...legal, tag3_name: '个人所得税' }], { kp: '法律', kp3: '个人所得税' });
    vm.applyPendingKp(true);
    expect(vm.kp3Filter).toBe('个人所得税');
    expect(vm.filterMod).toBe('changshi');
    expect(vm._pendingKp3).toBe('个人所得税');
  });
});

describe('R569 load()：快照铺屏后即 provisional 落地；离线兜底也应用深链', () => {
  const load = method('load');
  it('快照/屏上有列表时 loading=false 后立刻 applyPendingKp(true)，真实回包后仍终判 applyPendingKp()', () => {
    expect(load).toContain('if (this.items.length) {\n        this.loading = false;\n        this.applyPendingKp(true);\n      }');
    const real = load.indexOf('this.items = d.items.map');
    expect(load.indexOf('this.applyPendingKp();', real)).toBeGreaterThan(real);
  });
  it('离线兜底分支（缓存有错题）应用深链筛选', () => {
    const off = load.slice(load.indexOf('const c = getCachedMistakes'), load.indexOf("uni.showToast({ title: '当前无网络"));
    expect(off).toContain('this.offlineView = true;\n          this.applyPendingKp();');
  });
  it('dueSynced 只在真实 /api/review 回包后置真，换账号重置', () => {
    expect(load).toContain('this.dueTotal = r.total || r.items.length;\n        this.dueSynced = true;');
    expect(method('resetAccountState')).toContain('this.dueSynced = false;');
    expect(script).toContain('dueSynced: false,');
  });
});

describe('R569 头卡：到期数未同步显「—」而非 0，不再假陈述「今天没有到期错题」', () => {
  const headStats = fnOf('headStats', []);
  it('未同步：待复习/预计 —，累计仍为快照条数', () => {
    const s = headStats.call({ dueSynced: false, due: [], dueTotal: 0, items: [1, 2, 3, 4, 5] });
    expect(s.map((x) => x.value)).toEqual(['—', '—', 5]);
    expect(s[0].tone).toBeUndefined();
  });
  it('已同步：数值与旧口径一致（5 到期 → 5 题 / 4 分钟 / brand）', () => {
    const s = headStats.call({ dueSynced: true, due: [1, 2, 3, 4, 5], dueTotal: 5, items: [1, 2, 3, 4, 5] });
    expect(s.map((x) => x.value)).toEqual([5, 4, 5]);
    expect(s[0].tone).toBe('brand');
  });
  it('已同步 0 到期：0 题 / 0 分钟（不是 —）', () => {
    const s = headStats.call({ dueSynced: true, due: [], dueTotal: 0, items: [1] });
    expect(s.map((x) => x.value)).toEqual([0, 0, 1]);
  });
  it('模板：未同步提示在「今天没有到期错题」之前，离线/在线两句文案', () => {
    expect(tpl).toContain('<kg-stat-row :items="headStats" />');
    const wait = tpl.indexOf('v-else-if="items.length && !dueSynced"');
    const none = tpl.indexOf('今天没有到期错题，待掌握');
    expect(wait).toBeGreaterThan(-1);
    expect(wait).toBeLessThan(none);
    expect(tpl).toContain('正在同步今日待复习…');
    expect(tpl).toContain('离线中 · 今日待复习需联网后同步');
    // 「开始复习」CTA 仍以真实 due 为条件
    expect(tpl).toContain('<kg-button v-if="due.length" variant="primary" size="lg" block class="head-cta"');
  });
});
