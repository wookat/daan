// R561：错题本「收藏」tab / 刷题页星星 / 我的·收藏数 读侧只看本机 favQuestions，小程序或其他设备（云 question_favs）收藏在 H5 不可见（R560 F1 的镜像面）。
// 修法：syncCloudFavs 拉 /api/favs 与本机对账（reconcileFavs），题库题以云端为准、无 id 条目保留、刚收藏 60s 内保留；云写失败降级本机独有；恢复码恢复的条目整体降级。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { favFromCloud, reconcileFavs, markFavLocalOnly, favsLocalOnly, FAV_GRACE_MS } from '../src/exam-fav.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const BOOK = read('../src/pages/book/book.vue');
const PRACTICE = read('../src/pages/practice/practice.vue');
const PROFILE = read('../src/pages/profile/profile.vue');
const REPORT = read('../src/pkgA/exam/report.vue');
const SYNC = read('../src/fav-sync.js');
const TAG = read('../src/components/kg-tag/kg-tag.vue');

const cloudItem = (id, question, faved_at = 1_700_000_000, extra = {}) => ({
  id,
  question,
  options: { A: '1', B: '2' },
  answer: 'A',
  explanation: '解析',
  hs_explanation: '',
  module: 'yanyu',
  submodule: '逻辑填空',
  is_real: 1,
  exam_year: 2023,
  exam_region: '国考',
  folder_id: 0,
  faved_at,
  note: null,
  ...extra,
});

describe('favFromCloud', () => {
  it('云条目 → 本机 schema：faved_at 秒转毫秒 t、带 id、保留卡面字段', () => {
    const f = favFromCloud(cloudItem(182003, '甲题干', 1_700_000_000, { xp_explanation: 'x', xp_school: '花生' }));
    expect(f.t).toBe(1_700_000_000_000);
    expect(f.id).toBe(182003);
    expect(f.question).toBe('甲题干');
    expect(f.options).toEqual({ A: '1', B: '2' });
    expect(f.submodule).toBe('逻辑填空');
    expect(f.xp_school).toBe('花生');
    expect(f.is_real).toBe(1);
    expect(f).not.toHaveProperty('folder_id');
    expect(f).not.toHaveProperty('note');
  });
  it('faved_at 缺失时 t 取当前时间', () => {
    const before = Date.now();
    expect(favFromCloud(cloudItem(1, '甲', 0)).t).toBeGreaterThanOrEqual(before);
  });
});

describe('reconcileFavs', () => {
  const NOW = 2_000_000_000_000;
  it('云独有条目补进本机（小程序/其他设备收藏在 H5 错题本可见）', () => {
    const out = reconcileFavs([], [cloudItem(1, '甲'), cloudItem(2, '乙', 1_700_000_100)], NOW);
    expect(out.map((f) => f.id)).toEqual([2, 1]);
    expect(out[0].t).toBe(1_700_000_100_000);
  });
  it('本机有 id 条目与云匹配：保留本机 t 与字段，不重复', () => {
    const local = [{ t: 1_800_000_000_000, id: 1, question: '甲', options: { A: 'a' } }];
    const out = reconcileFavs(local, [cloudItem(1, '甲')], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].t).toBe(1_800_000_000_000);
    expect(out[0].options).toEqual({ A: 'a' });
  });
  it('历史无 id 条目按题干认领云 id', () => {
    const out = reconcileFavs([{ t: 1, question: '甲题干' }], [cloudItem(182003, '甲题干')], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(182003);
  });
  it('无 id 且云无同题干（时政/内联题）保留为本机独有', () => {
    const out = reconcileFavs([{ t: 1, id: null, question: '时政题', module: '时政' }], [cloudItem(1, '甲')], NOW);
    expect(out.map((f) => f.question)).toEqual(['甲', '时政题']);
    expect(out[1].id).toBe(null);
  });
  it('有 id 但云端已无（别处取消）→ 从本机消失', () => {
    const out = reconcileFavs([{ t: 1, id: 9, question: '丙' }], [cloudItem(1, '甲')], NOW);
    expect(out.map((f) => f.id)).toEqual([1]);
  });
  it('刚收藏未满 FAV_GRACE_MS 的有 id 条目云端未落库也保留', () => {
    const fresh = { t: NOW - FAV_GRACE_MS + 1000, id: 9, question: '丙' };
    const stale = { t: NOW - FAV_GRACE_MS - 1000, id: 8, question: '丁' };
    const out = reconcileFavs([fresh, stale], [], NOW);
    expect(out.map((f) => f.id)).toEqual([9]);
  });
  it('两条本机条目指向同一云 id 只保留一条', () => {
    const out = reconcileFavs([{ t: 2, id: 1, question: '甲' }, { t: 1, question: '甲' }], [cloudItem(1, '甲')], NOW);
    expect(out).toHaveLength(1);
  });
  it('按 t 倒序并截断 200；云列表缺 id/题干的脏条目忽略；非法输入容错', () => {
    const local = Array.from({ length: 200 }, (_, i) => ({ t: 100_000 + i, question: 'q' + i }));
    const out = reconcileFavs(local, [cloudItem(1, '云题', 10)], NOW);
    expect(out).toHaveLength(200);
    expect(out[0].question).toBe('q199');
    expect(out.some((f) => f.question === '云题')).toBe(false);
    expect(reconcileFavs(null, [{ id: null, question: '无id' }, { id: 3 }], NOW)).toEqual([]);
    expect(reconcileFavs([{ t: 1 }], undefined, NOW)).toEqual([]);
  });
});

describe('markFavLocalOnly / favsLocalOnly', () => {
  it('云写失败：仅该题 id 置空，其余不动', () => {
    const out = markFavLocalOnly([{ id: 1, question: '甲' }, { id: 2, question: '乙' }], '甲');
    expect(out.map((f) => f.id)).toEqual([null, 2]);
  });
  it('恢复码恢复：全部 id 置空', () => {
    expect(favsLocalOnly([{ id: 1, question: '甲' }, { id: null, question: '乙' }]).map((f) => f.id)).toEqual([null, null]);
    expect(favsLocalOnly(null)).toEqual([]);
  });
});

describe('syncCloudFavs', () => {
  let store;
  beforeEach(() => {
    store = {};
    globalThis.uni = {
      getStorageSync: (k) => store[k],
      setStorageSync: (k, v) => {
        store[k] = v;
      },
    };
    vi.resetModules();
  });
  afterEach(() => {
    delete globalThis.uni;
    vi.doUnmock('../src/api.js');
  });

  it('并发调用只发一次 /api/favs，落盘对账结果并返回', async () => {
    let calls = 0;
    let resolve;
    vi.doMock('../src/api.js', () => ({
      fetchFavsLive: () => {
        calls++;
        return new Promise((r) => {
          resolve = r;
        });
      },
    }));
    const { syncCloudFavs } = await import('../src/fav-sync.js');
    store.favQuestions = [{ t: 1, question: '时政题', id: null }];
    const p1 = syncCloudFavs();
    const p2 = syncCloudFavs();
    expect(p1).toBe(p2);
    resolve({ items: [cloudItem(1, '甲')] });
    const list = await p1;
    expect(calls).toBe(1);
    expect(list.map((f) => f.question)).toEqual(['甲', '时政题']);
    expect(store.favQuestions).toEqual(list);
    // 结束后再次调用会重新请求
    syncCloudFavs();
    expect(calls).toBe(2);
  });

  it('请求失败返回 null 且不动本机存储', async () => {
    vi.doMock('../src/api.js', () => ({ fetchFavsLive: () => Promise.reject(new Error('net')) }));
    const { syncCloudFavs } = await import('../src/fav-sync.js');
    store.favQuestions = [{ t: 1, id: 5, question: '甲' }];
    expect(await syncCloudFavs()).toBe(null);
    expect(store.favQuestions).toEqual([{ t: 1, id: 5, question: '甲' }]);
  });

  it('回包无 items 数组（非真实列表）返回 null 且不动本机存储', async () => {
    vi.doMock('../src/api.js', () => ({ fetchFavsLive: () => Promise.resolve({}) }));
    const { syncCloudFavs } = await import('../src/fav-sync.js');
    store.favQuestions = [{ t: 1, id: 5, question: '甲' }];
    expect(await syncCloudFavs()).toBe(null);
    expect(store.favQuestions).toEqual([{ t: 1, id: 5, question: '甲' }]);
  });
});

describe('R561-fix 对账不吃 apiSnap 快照（生产 E3：POST 后阻断 GET，旧空快照被当云列表把刚收藏的题清掉）', () => {
  const API = readdirSync(fileURLToPath(new URL('../src/api/', import.meta.url))).filter((f)=>f.endsWith('.js')).sort().map((f)=>readFileSync(fileURLToPath(new URL('../src/api/'+f, import.meta.url)),'utf8')).join('\n');
  it('fetchFavsLive 显式 timeout 走 request 直连分支：不进 getCache、网络错误不回退 snapLoad', () => {
    expect(API).toContain("export function fetchFavsLive() {\n  return request(`/api/favs?uid=${encodeURIComponent(anonUid())}`, { timeout: 12000 });\n}");
    const req = API.slice(API.indexOf('export function request('), API.indexOf('export function anonUid('));
    const direct = req.indexOf('if (opts.timeout != null) return withAuthRetry(() => rawRequest(path, opts).then((d) => guardStaleUid(path, d)));');
    expect(direct).toBeGreaterThan(-1);
    expect(req.indexOf('const snap = snapLoad(path);')).toBeGreaterThan(direct);
    expect(req.indexOf('getCache\n      .run(')).toBeGreaterThan(direct);
  });
});

describe('R561 页面接线（源锁）', () => {
  it('fav-sync 只读 fetchFavsLive + reconcileFavs，失败吞掉返回 null', () => {
    expect(SYNC).toContain("import { fetchFavsLive } from './api.js';");
    expect(SYNC).not.toContain('fetchFavs()');
    expect(SYNC).toContain('if (!d || !Array.isArray(d.items)) return null;');
    expect(SYNC).toContain("import { reconcileFavs } from './exam-fav.js';");
    expect(SYNC).toContain('.catch(() => null)');
  });
  it('book.vue：onShow 先显本机再 syncFavs；等待期间本机取消过（_favSeq 变）不拿云列表覆盖；展开态按题干保留', () => {
    expect(BOOK).toContain("import { syncCloudFavs } from '../../fav-sync.js';");
    const onShow = BOOK.slice(BOOK.indexOf('  onShow() {'), BOOK.indexOf('  onHide() {'));
    expect(onShow.indexOf("this.favs = (uni.getStorageSync('favQuestions') || [])")).toBeLessThan(onShow.indexOf('this.syncFavs();'));
    const sync = BOOK.slice(BOOK.indexOf('    async syncFavs() {'), BOOK.indexOf('    unfav(i) {'));
    expect(sync).toContain('const list = await syncCloudFavs();');
    expect(sync).toContain('if ((this._favSeq || 0) !== seq) {');
    expect(sync).toContain('this.favs = list.map((f) => ({ ...f, _open: open.has(f.question) }));');
    const unfav = BOOK.slice(BOOK.indexOf('    unfav(i) {'), BOOK.indexOf('    isDue(m) {'));
    expect(unfav).toContain('this._favSeq = (this._favSeq || 0) + 1;');
    expect(BOOK).toContain(`:key="f.id ? 'q' + f.id : 't' + f.t"`);
  });
  it('book.vue 收藏空态文案不再限定「本机」', () => {
    expect(BOOK).not.toContain('还没有本机收藏');
    expect(BOOK).toContain('title="还没有收藏" desc="刷题时点顶栏星星收藏好题；小程序、其他设备的收藏也会同步到这里"');
  });
  it('practice.vue：onShow 同步；取消收藏计 _favSeq；setFav 失败降级本机独有', () => {
    expect(PRACTICE).toContain("import { markFavLocalOnly } from '../../exam-fav.js';");
    expect(PRACTICE).toContain("import { syncCloudFavs } from '../../fav-sync.js';");
    expect(PRACTICE).toContain("this.favs = uni.getStorageSync('favQuestions') || [];\n    this.syncFavs();");
    expect(PRACTICE).toContain('if (qid) setFav(qid).catch(() => this.favLocalOnly(favQ));');
    const toggle = PRACTICE.slice(PRACTICE.indexOf('    toggleFav() {'), PRACTICE.indexOf('    favLocalOnly(question) {'));
    expect(toggle).toContain('this._favSeq = (this._favSeq || 0) + 1;');
  });
  it('report.vue：setFav 失败降级本机独有，removeFav 失败不回滚', () => {
    expect(REPORT).toContain("import { isFaved, toggleFav, markFavLocalOnly } from '../../exam-fav.js';");
    expect(REPORT).toContain("this.favs = markFavLocalOnly(uni.getStorageSync('favQuestions') || [], d.question);");
    expect(REPORT).toContain('if (!added) return;');
  });
  it('profile.vue：收藏数先本机后云对账；恢复码恢复后 favQuestions 整体降级', () => {
    expect(PROFILE).toContain("import { syncCloudFavs } from '../../fav-sync.js';");
    expect(PROFILE).toContain("import { favsLocalOnly } from '../../exam-fav.js';");
    expect(PROFILE).toContain('syncCloudFavs().then((list) => {\n      if (list) this.favN = list.length;\n    });');
    expect(PROFILE).toContain("uni.setStorageSync('favQuestions', favsLocalOnly(uni.getStorageSync('favQuestions') || []));");
  });
});

describe('R560-2/3/4 小改（源锁）', () => {
  it('R560-3：kg-tag 文字 nowrap + 省略，容器 max-width 100%（uni-text 默认可换行 → 长试卷标签在 40vw 内折成两行被 20px 高纵裁）', () => {
    expect(TAG).toContain('.kg-tag__t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }');
    expect(TAG).toMatch(/\.kg-tag \{[^}]*max-width: 100%;/s);
  });
  it('R560-2：错题本空态说明 ≤ 42 字（KgEmptyState 规范 ≤2 行，375 宽 280px/13px 约 21 字每行）', () => {
    const descs = [...BOOK.matchAll(/<kg-empty-state[^>]*?\sdesc="([^"]+)"/g)].map((m) => m[1]);
    expect(descs.length).toBeGreaterThanOrEqual(4);
    descs.forEach((d) => expect(d.length).toBeLessThanOrEqual(42));
  });
  it('R560-4：单条删除确认给出不可恢复/不再复习说明与「删除」确认按钮，已掌握不提复习队列', () => {
    const del = BOOK.slice(BOOK.indexOf('    del(m) {'), BOOK.indexOf('    del(m) {') + 600);
    expect(del).toContain("title: '删除这道错题？',");
    expect(del).toContain("content: m.mastered ? '删除后不可恢复' : '删除后不可恢复，也不再进入复习队列；只是暂时不想复习可选「标为已掌握」',");
    expect(del).toContain("confirmText: '删除',");
    expect(del).not.toContain('confirmColor');
  });
});
