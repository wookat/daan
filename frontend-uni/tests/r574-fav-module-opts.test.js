// R574：收藏页模块筛选 chips 只列本人有收藏的模块（此前静态 6 个 chip，生产样本 8/8 用户只有 1 个模块 → 5 个死选项）。
// 深链 ?mod= 合法但当前 0 条 → 仍保留在选项里（可切回全部）；只剩 1 个模块且筛选未排除任何收藏 → 整行隐藏。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { favModulePlan } from '../src/fav-module-opts.js';

const KEYS = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi', '时政'];
const label = (k) => 'L:' + k;
const vals = (p) => p.opts.map((o) => o.value);
const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('favModulePlan', () => {
  it('只列有收藏的模块，按 keys 既定顺序而非出现顺序', () => {
    const items = [{ module: 'changshi' }, { module: 'ziliao' }, { module: 'changshi' }, { module: '时政' }];
    const p = favModulePlan(items, '', KEYS, label);
    expect(vals(p)).toEqual(['', 'ziliao', 'changshi', '时政']);
    expect(p.opts[0]).toEqual({ label: '全部模块', value: '' });
    expect(p.opts[1]).toEqual({ label: 'L:ziliao', value: 'ziliao' });
    expect(p.visible).toBe(true);
  });
  it('单模块用户：只有「全部模块」+ 1 个模块 → 行隐藏（生产 8/8 样本形态）', () => {
    const p = favModulePlan([{ module: 'panduan' }, { module: 'panduan' }], '', KEYS, label);
    expect(vals(p)).toEqual(['', 'panduan']);
    expect(p.visible).toBe(false);
  });
  it('单模块 + 深链选中同一模块：筛选未排除任何收藏，仍隐藏', () => {
    const p = favModulePlan([{ module: 'panduan' }], 'panduan', KEYS, label);
    expect(vals(p)).toEqual(['', 'panduan']);
    expect(p.visible).toBe(false);
  });
  it('深链选中的合法模块当前 0 条：保留在选项里且行可见（否则空态无从切回全部）', () => {
    const p = favModulePlan([{ module: 'panduan' }], 'yanyu', KEYS, label);
    expect(vals(p)).toEqual(['', 'yanyu', 'panduan']);
    expect(p.visible).toBe(true);
  });
  it('深链模块不在 keys 白名单：不伪造选项，但行可见以便切回全部', () => {
    const p = favModulePlan([{ module: 'panduan' }], 'nope', KEYS, label);
    expect(vals(p)).toEqual(['', 'panduan']);
    expect(p.visible).toBe(true);
  });
  it('空列表 / 无 module 字段 / null 元素：只剩「全部模块」，隐藏', () => {
    expect(favModulePlan([], '', KEYS, label)).toEqual({ opts: [{ label: '全部模块', value: '' }], visible: false });
    expect(favModulePlan(null, '', KEYS, label).visible).toBe(false);
    expect(vals(favModulePlan([{ module: '' }, null, { module: 'unknown' }], '', KEYS, label))).toEqual(['']);
  });
});

describe('favorites.vue 接线', () => {
  const VUE = read('../src/pkgA/social/favorites.vue');
  it('modOpts/modChipsVisible 由 favModulePlan(items, modFilter, MOD_KEYS) 派生（按全部 items 而非当前夹）', () => {
    expect(VUE).toContain("import { favModulePlan } from '../../fav-module-opts.js';");
    expect(VUE).toContain('return favModulePlan(this.items, this.modFilter, MOD_KEYS, (m) => this.modName(m));');
    expect(VUE).toContain('return this.modPlan.opts;');
    expect(VUE).toContain('return this.modPlan.visible;');
  });
  it('chip 行 v-if 隐藏；shownItems 筛选口径不变', () => {
    expect(VUE).toContain('<kg-chip-row v-if="modChipsVisible" v-model="modFilter" :options="modOpts" class="chips" />');
    expect(VUE).toContain("if (this.modFilter) list = list.filter((it) => it.module === this.modFilter);");
  });
});

// 生产复验 F 坐实的两条既有（非 R574 引入，源码早于本轮）：
// 1) 云条目取消收藏只 DELETE 云端，题页 toggleFav / syncCloudFavs 写进 favQuestions 的同题本机条目在 load() 合并时复活（卡仍在、chip 不收缩）；
// 2) 进练习页再返回后地址栏回到旧 ?tab=/?mod=（R546 book.vue 同型：replaceState(null) 抹 router state + onShow 不重写）。
describe('favorites.vue 取消收藏与 URL 回写（R574 生产 F 既有缺陷修）', () => {
  const VUE = read('../src/pkgA/social/favorites.vue');
  const method = (name) => {
    const m = VUE.match(new RegExp(`\\n {4}${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\},`));
    expect(m, name).toBeTruthy();
    return m[1];
  };
  it('unfav：云条目先 removeFav 再清本机同题（按 question，有 id 时也按 id），本机条目只清本机；removeFav 失败不动本机', () => {
    const unfav = method('unfav');
    expect(unfav).toContain('if (!it._local) await removeFav(it.id);');
    expect(unfav).toContain("filter((x) => x.question !== it.question && !(it.id != null && x.id === it.id))");
    expect(unfav.indexOf('await removeFav(it.id)')).toBeLessThan(unfav.indexOf("uni.setStorageSync('favQuestions', locals)"));
    expect(unfav).not.toContain('} else {\n              await removeFav(it.id);');
  });
  it('syncUrl 保留 history.state；onShow 在 load() 后重写地址栏，深链 ?folder= 尚未落地时让位', () => {
    expect(method('syncUrl')).toContain("window.history.replaceState(window.history.state, '', buildFavoritesUrl(");
    const m = VUE.match(/\n {2}onShow\(\) \{([\s\S]*?)\n {2}\},/);
    expect(m).toBeTruthy();
    const onShow = m[1];
    expect(onShow).toContain('if (this._pendingFolder == null) this.syncUrl();');
    expect(onShow.indexOf('this.load();')).toBeLessThan(onShow.indexOf('this.syncUrl()'));
  });
});
