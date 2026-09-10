// R571：错题本旧快照兜底的诚实口径（R569-1 登记项）
// 现状：request() 网络失败时以 apiSnap 旧快照 resolve，book.vue 与真实回包无法区分 → 到期数拿旧值置 dueSynced=true、
// 顶部无任何「网络异常/旧数据」提示、旧列表还回写 mistakesCache 刷新时间戳；只有 request 真 reject 才走「当前离线」横幅。
// 修法：api.js 以对象身份给兜底返回值打标（staleAt），book.vue 据此保持到期数未同步、横幅按 navigator.onLine 区分
// 「当前离线 / 网络不稳定」并给出快照时刻 + 「重试」，H5 监听 online 一次自动重拉。
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { snapshotNotice, snapshotAgeText } from '../src/snapshot-notice.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const book = read('../src/pages/book/book.vue');
const tpl = book.slice(0, book.indexOf('<script'));
const script = book.slice(book.indexOf('<script'), book.indexOf('</script>'));
const method = (name) => {
  const m = script.match(new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};

const NOW = 1_800_000_000_000;

describe('snapshot-notice 纯函数', () => {
  it('snapshotAgeText：<1 分钟「刚刚」，分钟 / 小时 / 天分级', () => {
    expect(snapshotAgeText(NOW - 30_000, NOW)).toBe('刚刚');
    expect(snapshotAgeText(NOW - 5 * 60_000, NOW)).toBe('5 分钟前');
    expect(snapshotAgeText(NOW - 3 * 3_600_000, NOW)).toBe('3 小时前');
    expect(snapshotAgeText(NOW - 2 * 86_400_000, NOW)).toBe('2 天前');
    expect(snapshotAgeText(0, NOW)).toBe('刚刚');
    expect(snapshotAgeText(NOW + 10_000, NOW)).toBe('刚刚');
  });
  it('真离线（onLine=false）：「当前离线 · 展示 n 前缓存的错题，联网后自动更新」', () => {
    expect(snapshotNotice(NOW - 5 * 60_000, false, NOW)).toBe('当前离线 · 展示5 分钟前缓存的错题，联网后自动更新');
  });
  it('有网但请求失败（onLine=true/未知）：「网络不稳定 … 可稍后重试」，不再假称离线', () => {
    expect(snapshotNotice(NOW - 3_600_000, true, NOW)).toBe('网络不稳定 · 展示1 小时前缓存的错题，可稍后重试');
    expect(snapshotNotice(NOW - 3_600_000, null, NOW)).toBe('网络不稳定 · 展示1 小时前缓存的错题，可稍后重试');
  });
  it('快照时刻未知（旧 mistakesCache 无 ts）：不编造时间', () => {
    expect(snapshotNotice(0, false, NOW)).toBe('当前离线 · 展示已缓存的错题，联网后自动更新');
  });
});

describe('api.js 旧快照兜底返回值可被 staleAt 识别', () => {
  // api.js 含 #ifdef 双定义导出不能整模块导入，抓打标工具片段求值
  const src = read('../src/api.js');
  const seg = src.slice(src.indexOf('const staleMarks = new WeakMap();'), src.indexOf('// 快照即显（客户端 stale-while-revalidate）'));
  const { markStale, staleAt } = new Function(seg.replace(/^export /gm, '') + '\nreturn { markStale, staleAt };')();

  it('markStale 按对象身份打标不改数据；staleAt = 快照时刻；非对象/未打标返回 0', () => {
    const t = NOW - 120_000;
    const d = { items: [{ id: 1 }], total: 1 };
    expect(markStale(d, t)).toBe(d);
    expect(Object.keys(d)).toEqual(['items', 'total']);
    expect(staleAt(d)).toBe(t);
    expect(staleAt({ items: [{ id: 1 }], total: 1 })).toBe(0);
    expect(staleAt(null)).toBe(0);
    expect(staleAt('x')).toBe(0);
    expect(markStale('x', t)).toBe('x');
    expect(staleAt(markStale({}, 0))).toBeGreaterThan(0);
  });

  it('request 源码：兜底分支 markStale(snap.d, snap.t)，真实回包路径不打标', () => {
    const req = src.slice(src.indexOf('export function request('), src.indexOf('export function anonUid('));
    expect(req).toContain("trackEvent('stale_fallback', 'h5', path.slice(0, 120));\n        return markStale(snap.d, snap.t);");
    expect((req.match(/markStale\(/g) || []).length).toBe(1);
    expect(src).toContain('const staleMarks = new WeakMap();');
  });
});

describe('book.vue load()：旧快照不当已同步、不回写 mistakesCache、横幅明示', () => {
  const load = method('load');
  it('/api/review 旧快照 → 到期数/dueSynced/autoReview/角标全部跳过（保持「—」或上次真实值）', () => {
    expect(load).toContain('const staleD = staleAt(d);\n        const staleR = staleAt(r);');
    expect(load).toContain(
      'if (!staleR) {\n          this.due = r.items;\n          this.dueTotal = r.total || r.items.length;\n          this.dueSynced = true;'
    );
    expect(load).toContain('if (!staleR) setBookBadge(this.dueTotal);');
    expect(load).toContain('if (!staleD) cacheMistakes(d.items, anonUid());');
    expect(load).toContain('this.setSnapshotView(staleD, staleR);');
  });
  it('真 reject 的离线兜底分支带 mistakesCache.ts 进横幅，toast 文案与横幅同源', () => {
    const off = load.slice(load.indexOf('const c = getCachedMistakes'), load.indexOf('} else {'));
    expect(off).toContain('this.setSnapshotView(c.ts || 0);\n          this.offlineView = true;\n          this.applyPendingKp();');
    expect(off).toContain('uni.showToast({ title: this.offlineText, icon: \'none\' });');
  });
  it('setSnapshotView：全真实 → 清横幅；任一旧快照 → 取最旧时刻并只挂一次 online 监听', () => {
    const src = method('setSnapshotView');
    const fn = new Function('...ats', src.replace(/\/\/ #(ifdef|endif)[^\n]*/g, ''));
    const add = vi.fn();
    globalThis.window = { addEventListener: add };
    const vm = { offlineView: true, snapAt: 5, load: vi.fn(), setSnapshotView: fn };
    vm.setSnapshotView(0, 0);
    expect(vm).toMatchObject({ offlineView: false, snapAt: 0 });
    expect(add).not.toHaveBeenCalled();
    vm.setSnapshotView(0, NOW - 1000);
    expect(vm).toMatchObject({ offlineView: true, snapAt: NOW - 1000 });
    vm.setSnapshotView(NOW - 9000, NOW - 1000);
    expect(vm.snapAt).toBe(NOW - 9000);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0]).toBe('online');
    expect(add.mock.calls[0][2]).toEqual({ once: true });
    add.mock.calls[0][1]();
    expect(vm.load).toHaveBeenCalledTimes(1);
    expect(vm._onOnline).toBeNull();
    delete globalThis.window;
  });
  it('模板：横幅文案走 offlineText、带「重试」动作重拉；head-tip 不再断言「离线中」', () => {
    expect(tpl).toContain('<kg-banner v-if="offlineView" tone="warn" icon="plane" :text="offlineText" action-text="重试" :closable="false" class="offbar" @action="load" />');
    expect(tpl).toContain("{{ offlineView ? '今日待复习需网络恢复后同步' : '正在同步今日待复习…' }}");
    expect(tpl).not.toContain('离线中 ·');
  });
  it('offlineText 计算：navigator 不可用时传 null；onUnload 摘掉 online 监听', () => {
    expect(script).toContain("import { staleAt } from '../../api.js';");
    expect(script).toContain("import { snapshotNotice } from '../../snapshot-notice.js';");
    expect(script).toContain('snapAt: 0,');
    const m = script.match(/\n {4}offlineText\(\) \{([\s\S]*?)\n {4}\},/);
    expect(m).toBeTruthy();
    expect(m[1]).toContain("typeof navigator.onLine === 'boolean' ? navigator.onLine : null");
    expect(m[1]).toContain('return snapshotNotice(this.snapAt, online);');
    const unload = script.slice(script.indexOf('\n  onUnload() {'), script.indexOf('\n  methods: {'));
    expect(unload).toContain("window.removeEventListener('online', this._onOnline);");
  });
});
