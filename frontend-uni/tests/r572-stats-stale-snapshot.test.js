// R572：统计页旧快照兜底的诚实口径（R571-1 登记项，生产 stale_fallback 自然样本之一即统计页冷开 10 端点全回退）
// 现状：stats.vue 六个并发加载器都是 snapPeek + request，request() 网络失败以旧快照 resolve，页面无任何提示，
// 「今日待办 · N 题今日待复习」也拿旧 /api/review 快照当已同步陈述。
// 修法：抽 snapshot-view mixin（noteSnapshot 登记回包 / 主回包真实且本轮无旧快照才清横幅），统计页横幅与错题本同文案模型
// （「当前离线 / 网络不稳定 · 展示 n 前缓存的统计」+ 重试 + online 自动重拉），到期数旧快照保持 dueSynced=false。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { snapshotNotice } from '../src/snapshot-notice.js';

const marks = new WeakMap();
vi.mock('../src/api.js', () => ({ staleAt: (d) => (d && typeof d === 'object' && marks.get(d)) || 0 }));
const { snapshotViewMixin } = await import('../src/snapshot-view.js');

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const stats = read('../src/pages/stats/stats.vue');
const tpl = stats.slice(0, stats.indexOf('<script'));
const script = stats.slice(stats.indexOf('<script'), stats.indexOf('</script>'));
const method = (name) => {
  const m = script.match(new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};

const NOW = 1_800_000_000_000;
const stale = (d, t) => {
  marks.set(d, t);
  return d;
};

describe('snapshotNotice 名词参数', () => {
  it('默认仍是「错题」（错题本文案不变）；统计页传「统计」', () => {
    expect(snapshotNotice(NOW - 5 * 60_000, false, NOW)).toBe('当前离线 · 展示5 分钟前缓存的错题，联网后自动更新');
    expect(snapshotNotice(NOW - 5 * 60_000, false, NOW, '统计')).toBe('当前离线 · 展示5 分钟前缓存的统计，联网后自动更新');
    expect(snapshotNotice(NOW - 3_600_000, true, NOW, '统计')).toBe('网络不稳定 · 展示1 小时前缓存的统计，可稍后重试');
    expect(snapshotNotice(0, null, NOW, '统计')).toBe('网络不稳定 · 展示已缓存的统计，可稍后重试');
  });
});

describe('snapshot-view mixin', () => {
  let vm, add, remove, nav, navDesc;
  beforeEach(() => {
    const mx = snapshotViewMixin({ noun: '统计', reload: 'refreshAccountData' });
    add = vi.fn();
    remove = vi.fn();
    globalThis.window = { addEventListener: add, removeEventListener: remove };
    nav = { onLine: true };
    navDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
    vm = { ...mx.data(), ...mx.methods, refreshAccountData: vi.fn() };
    Object.defineProperty(vm, 'offlineText', { get: mx.computed.offlineText });
  });
  const restore = () => {
    delete globalThis.window;
    if (navDesc) Object.defineProperty(globalThis, 'navigator', navDesc);
    else delete globalThis.navigator;
  };

  it('data 初值；真实回包 noteSnapshot=0 不进快照态；主回包真实且本轮无旧快照 → 清横幅', () => {
    expect(vm).toMatchObject({ offlineView: false, snapAt: 0, netOnline: null });
    vm.beginSnapshotRound();
    expect(vm.noteSnapshot({ a: 1 })).toBe(0);
    expect(vm.noteSnapshot(null)).toBe(0);
    expect(vm.offlineView).toBe(false);
    vm.offlineView = true;
    vm.snapAt = 5;
    vm.settleSnapshotRound();
    expect(vm).toMatchObject({ offlineView: false, snapAt: 0 });
    expect(add).not.toHaveBeenCalled();
    restore();
  });

  it('任一旧快照 → 快照态取最旧时刻、采样 onLine 落 data、online/offline 各挂一次；本轮见过旧快照时 settle 不清横幅', () => {
    vm.beginSnapshotRound();
    expect(vm.noteSnapshot(stale({ total: 5 }, NOW - 1000))).toBe(NOW - 1000);
    expect(vm).toMatchObject({ offlineView: true, snapAt: NOW - 1000, netOnline: true });
    nav.onLine = false;
    vm.noteSnapshot(stale({ items: [] }, NOW - 9000));
    expect(vm.snapAt).toBe(NOW - 9000);
    expect(vm.netOnline).toBe(false);
    expect(vm.offlineText).toContain('当前离线 · 展示');
    expect(vm.offlineText).toContain('缓存的统计');
    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls.map((c) => c[0]).sort()).toEqual(['offline', 'online']);
    vm.settleSnapshotRound();
    expect(vm.offlineView).toBe(true);
    // 联网事件：改文案并调用页面 reload 方法；断网事件只改文案
    const handler = add.mock.calls[0][1];
    handler({ type: 'offline' });
    expect(vm.netOnline).toBe(false);
    expect(vm.refreshAccountData).not.toHaveBeenCalled();
    handler({ type: 'online' });
    expect(vm.netOnline).toBe(true);
    expect(vm.refreshAccountData).toHaveBeenCalledTimes(1);
    // 新一轮全真实 → 清横幅并摘监听
    vm.beginSnapshotRound();
    vm.noteSnapshot({ ok: 1 });
    vm.settleSnapshotRound();
    expect(vm).toMatchObject({ offlineView: false, snapAt: 0 });
    expect(remove).toHaveBeenCalledTimes(2);
    expect(vm._onNet).toBeNull();
    restore();
  });

  it('未调用 beginSnapshotRound 也能登记（onShow 之外的单独加载）', () => {
    vm.noteSnapshot(stale({}, NOW - 100));
    expect(vm.offlineView).toBe(true);
    vm.unbindNet();
    restore();
  });
});

describe('stats.vue 接线', () => {
  it('mixin 注入名词「统计」+ 重拉 refreshAccountData；onUnload 摘监听；每轮刷新先 beginSnapshotRound', () => {
    expect(script).toContain("import { snapshotViewMixin } from '../../snapshot-view.js';");
    expect(script).toContain("mixins: [snapshotViewMixin({ noun: '统计', reload: 'refreshAccountData' })],");
    const unload = script.slice(script.indexOf('\n  onUnload() {'), script.indexOf('\n  onShow() {'));
    expect(unload).toContain('this.unbindNet();');
    expect(method('refreshAccountData').trim().startsWith('this.beginSnapshotRound();')).toBe(true);
  });
  it('模板：顶部横幅走 offlineText + 「重试」= 整页重拉；到期行三态文案', () => {
    expect(tpl).toContain(
      '<kg-banner v-if="offlineView" tone="warn" icon="plane" :text="offlineText" action-text="重试" :closable="false" class="offbar" @action="refreshAccountData" />'
    );
    expect(tpl).toContain("{{ dueSynced ? dueN + ' 题今日待复习' : offlineView ? '到期数需网络恢复后同步' : '正在同步到期数…' }}");
    expect(tpl).not.toContain('{{ dueN }} 题今日待复习');
  });
  it('/api/review：旧快照不置 dueSynced（snapPeek 值只撑行）且清上一轮的已同步态；真实回包才写 dueN + dueSynced', () => {
    const reco = method('loadReco');
    expect(reco).toContain("if (vSnap) this.dueN = vSnap.total || 0;");
    // 同一 Document 内切 tab 回来（onShow → refreshAccountData）review 回退旧快照：上一轮 dueSynced=true 不能沿用（生产 F FAIL）
    expect(reco).toContain('if (!this.noteSnapshot(d)) {\n              this.dueN = d.total || 0;\n              this.dueSynced = true;\n            } else {\n              this.dueSynced = false;\n            }');
    // 错题本同形：load() 暖轮 review 旧快照同样清 dueSynced（due 列表保留，headStats 显 —）
    const book = read('../src/pages/book/book.vue')+read('../src/pages/book/review-ops.js');
    expect(book).toContain('if (this.due.length && !this.reviewing) this.startReview();\n          }\n        }\n        if (staleR) this.dueSynced = false;\n        this.setSnapshotView(staleD, staleR);');
    expect(script).toContain('dueN: 0, dueSynced: false,');
    expect(method('resetAccountState')).toContain('this.dueN = 0;\n      this.dueSynced = false;');
  });
  it('六个加载器全部登记回包；主回包 /api/stats 真实才 settle', () => {
    // snapPeek 铺屏走 paintStats（快照对象未被 staleAt 打标，若登记会误 settle 清横幅）；真实回包走 applyStats
    expect(method('load')).toContain('if (sSnap) this.paintStats(sSnap);');
    expect(method('load')).toContain('this.applyStats(await request(sp));');
    expect(method('applyStats')).toBe('\n      this.paintStats(d);\n      if (!this.noteSnapshot(d)) this.settleSnapshotRound();');
    for (const name of ['loadGrowth', 'loadSlStats', 'loadMastery', 'loadHeatmap']) {
      expect(method(name), name).toContain('this.noteSnapshot(d);');
    }
    expect(method('loadReco')).toContain('this.noteSnapshot(d);\n            this.reco = d;');
    expect(method('loadExamTrend')).toContain('this.noteSnapshot(att);\n        this.noteSnapshot(prof);');
  });
});
