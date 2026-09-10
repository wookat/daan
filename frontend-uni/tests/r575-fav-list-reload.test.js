// R575：收藏页「取消收藏先本地收缩、再后台对账」+ 刷新不铺骨架 + 旧快照不覆盖手上的真实列表。
// 一手来源：R574 生产复验 375 DELETE 9.4s + GET 4.0s，取消后先整屏骨架、列表迟到收缩；且 fetchFavs 走 request()，
// GET 超时会以 apiSnap 旧快照 resolve（快照是 DELETE 之前的镜像），load() 全量覆盖会让刚取消的题复活。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dropFavItem } from '../src/fav-list.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('dropFavItem', () => {
  const folders = () => [
    { id: 0, name: '默认', n: 3 },
    { id: 7, name: '图推', n: 1 },
  ];
  const cloud = { id: 11, folder_id: 7, question: 'Q1' };
  const cloudDefault = { id: 12, folder_id: 0, question: 'Q2' };
  const local = { id: null, _lkey: 'L0', _local: true, folder_id: 0, question: 'Q3' };
  const items = () => [cloud, cloudDefault, local];

  it('按对象身份删云条目并把所属收藏夹计数减一，其余不动', () => {
    const r = dropFavItem(items(), folders(), cloud);
    expect(r.items).toEqual([cloudDefault, local]);
    expect(r.folders).toEqual([
      { id: 0, name: '默认', n: 3 },
      { id: 7, name: '图推', n: 0 },
    ]);
  });

  it('本机条目按 _lkey 匹配，归默认夹（folder_id 0）计数', () => {
    const r = dropFavItem(items(), folders(), { id: null, _lkey: 'L0' });
    expect(r.items).toEqual([cloud, cloudDefault]);
    expect(r.folders[0].n).toBe(2);
    expect(r.folders[1].n).toBe(1);
  });

  it('同题干本机+云端两条时只删被点的那条（不按 question 匹配）', () => {
    const twin = { id: null, _lkey: 'L1', _local: true, folder_id: 0, question: 'Q1' };
    const r = dropFavItem([cloud, twin], folders(), cloud);
    expect(r.items).toEqual([twin]);
  });

  it('不在列表里的条目：原样返回，计数不减；计数为 0 不减成负数', () => {
    const r = dropFavItem(items(), folders(), { id: 999 });
    expect(r.items).toHaveLength(3);
    expect(r.folders).toEqual(folders());
    const z = dropFavItem([cloud], [{ id: 7, n: 0 }], cloud);
    expect(z.folders).toEqual([{ id: 7, n: 0 }]);
  });

  it('入参为空不抛', () => {
    expect(dropFavItem(null, null, { id: 1 })).toEqual({ items: [], folders: [] });
  });
});

describe('favorites.vue 接线', () => {
  const VUE = read('../src/pkgA/social/favorites.vue');
  const method = (name) => {
    const m = VUE.match(new RegExp(`\\n {4}(?:async )?${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\},`));
    expect(m, name).toBeTruthy();
    return m[1];
  };

  it('挂 snapshotViewMixin（noun 收藏 / reload load）并在收藏 tab 顶部渲染横幅', () => {
    expect(VUE).toContain("import { snapshotViewMixin } from '../../snapshot-view.js';");
    expect(VUE).toContain("mixins: [segResizeMixin, snapshotViewMixin({ noun: '收藏', reload: 'load' })],");
    expect(VUE).toContain('<kg-banner v-if="offlineView" tone="warn" icon="plane" :text="offlineText" action-text="重试" :closable="false" class="offbar" @action="load" />');
  });

  it('load：已有列表时不铺骨架；两回包逐一登记；有旧快照且手上已有真实列表 → 不覆盖、只提示；全真实才 settle 并记 _liveAt', () => {
    const load = method('load');
    expect(load).toContain('this.loading = !this.items.length;');
    expect(load).toContain('this.beginSnapshotRound();');
    expect(load).toContain('const staleF = this.noteSnapshot(f);');
    expect(load).toContain('const staleV = this.noteSnapshot(v);');
    const guard = load.indexOf('if ((staleF || staleV) && this._liveAt) {');
    expect(guard).toBeGreaterThan(0);
    expect(load.indexOf('this.showSnapshot(this._liveAt);')).toBeGreaterThan(guard);
    // 守卫在写 folders/items 之前
    expect(guard).toBeLessThan(load.indexOf('this.folders = f.items;'));
    expect(load).toContain('if (!staleF && !staleV) {\n          this._liveAt = Date.now();\n          this.settleSnapshotRound();\n        }');
    // 首次加载（无 _liveAt）拿到旧快照仍照常铺屏（横幅由 noteSnapshot 进入快照态）
    expect(load).not.toContain('if (staleF || staleV) return');
  });

  it('模板：已有列表时刷新失败只 toast、列表保留（错误空态仅在无列表时出现）', () => {
    expect(VUE).toContain('v-else-if="favErr && !items.length"');
    expect(VUE).not.toContain('v-else-if="favErr"\n');
  });

  it('unfav：DELETE 成功 + 清本机之后先 dropFavItem 本地收缩，再 load() 后台对账；失败路径不收缩', () => {
    const unfav = method('unfav');
    expect(VUE).toContain("import { dropFavItem } from '../../fav-list.js';");
    const del = unfav.indexOf('await removeFav(it.id)');
    const loc = unfav.indexOf("uni.setStorageSync('favQuestions', locals)");
    const drop = unfav.indexOf('const next = dropFavItem(this.items, this.folders, it);');
    const reload = unfav.indexOf('this.load();');
    expect(del).toBeGreaterThan(0);
    expect(del).toBeLessThan(loc);
    expect(loc).toBeLessThan(drop);
    expect(drop).toBeLessThan(reload);
    expect(unfav).toContain('this.items = next.items;\n            this.folders = next.folders;');
    // 收缩在 try 块内、位于 await 之后：removeFav 抛错时不会执行
    expect(unfav.indexOf('try {')).toBeLessThan(del);
    expect(unfav.indexOf('} catch (e) {')).toBeGreaterThan(drop);
  });
});

describe('小程序同口径（源锁）', () => {
  const TS = read('../../miniapp-native/miniprogram/pkgSocial/favorites/favorites.ts');
  const WXML = read('../../miniapp-native/miniprogram/pkgSocial/favorites/favorites.wxml');
  it('load 已有列表不铺骨架；onUnfav 先 dropFavItem 再 render 再 load；错误空态仅在无列表时', () => {
    expect(TS).toContain("import { dropFavItem } from '../../utils/fav-list';");
    expect(TS).toContain('this.setData({ loading: !this.items.length, favErr: \'\' });');
    const del = TS.indexOf('await deleteFav(it.id as number)');
    const drop = TS.indexOf('const next = dropFavItem(this.items, this.data.folders, it);');
    expect(del).toBeGreaterThan(0);
    expect(del).toBeLessThan(drop);
    expect(TS.indexOf('this.render();', drop)).toBeLessThan(TS.indexOf('this.load();', drop));
    expect(WXML).toContain('wx:elif="{{favErr && !hasItems}}"');
  });
});
