// R585：① 统计页冷加载不再漏错题本 tab 角标——loadReco 的 /api/review 真实回包同步 setBookBadge
//   （生产一手 375 同 uid 同时刻：首页/AI 问答冷加载 tab 有「8」、统计/我的冷加载没有；uni-h5 角标是内存态，
//    F5 / 移动端标签页被回收后原地重载即丢，直到用户再点首页/问答/错题本）；旧快照回包不刷角标（与 book R571 同口径）。
// ② AI 问答底部输入条 placeholder 按 360/375/390 实测可用宽度收短——原文案 130px/147px 在 13px 字号下
//    三档宽度（99/114/129px）全部被截成「先拍题或粘贴题目开」「对讲解有疑问？追问 A」。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stats = readFileSync(new URL('../src/pages/stats/stats.vue', import.meta.url), 'utf8');
const ask = readFileSync(new URL('../src/pages/ask/ask.vue', import.meta.url), 'utf8');

function methodBody(src, sig) {
  const m = src.match(new RegExp(`\\n {4}${sig} \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, `${sig} 应存在`).toBeTruthy();
  return m[1];
}

function makeLoadReco(lr, deps) {
  return new Function(
    'anonUid', 'encodeURIComponent', 'snapPeek', 'request', 'uni', 'setBookBadge',
    `return async function () {${lr}\n};`,
  )(() => 'u1', encodeURIComponent, deps.snapPeek || (() => null), deps.request, { getStorageSync: (k) => (k === 'anonUid' ? 'u1' : '') }, deps.setBookBadge);
}

describe('R585 统计页 loadReco 同步错题本 tab 角标', () => {
  const lr = methodBody(stats, 'async loadReco\\(\\)');

  it('引入 tabbar-badge.js 的 setBookBadge，且只在 review 真实回包分支调用', () => {
    expect(stats).toContain("import { setBookBadge } from '../../tabbar-badge.js';");
    expect(lr.match(/setBookBadge\(/g)).toHaveLength(1);
    const review = lr.slice(lr.indexOf('await request(vp)'));
    expect(review).toContain('} else {\n              this.dueSynced = false;\n            }\n            if (this.dueSynced) setBookBadge(this.dueN);');
  });

  it('运行时：review 真实回包 → 角标 = total；recommend 分支不碰角标', async () => {
    const calls = [];
    const request = (url) => Promise.resolve(url.startsWith('/api/review') ? { total: 8 } : { items: [] });
    const self = { reco: null, dueN: 0, dueSynced: false, noteSnapshot: () => false };
    await makeLoadReco(lr, { request, setBookBadge: (n) => calls.push(n) }).call(self);
    expect(self.dueN).toBe(8);
    expect(calls).toEqual([8]);
  });

  it('运行时：0 到期同样同步（清角标交给 setBookBadge 内部 removeTabBarBadge）', async () => {
    const calls = [];
    const request = (url) => Promise.resolve(url.startsWith('/api/review') ? { total: 0, items: [] } : {});
    const self = { reco: null, dueN: 3, dueSynced: false, noteSnapshot: () => false };
    await makeLoadReco(lr, { request, setBookBadge: (n) => calls.push(n) }).call(self);
    expect(calls).toEqual([0]);
  });

  it('运行时：review 回退旧快照 → 不刷角标、dueSynced=false；review 失败 → 不刷角标', async () => {
    const calls = [];
    const stale = (url) => Promise.resolve(url.startsWith('/api/review') ? { total: 5, __stale: true } : {});
    const self = { reco: null, dueN: 5, dueSynced: true, noteSnapshot: (d) => !!(d && d.__stale) };
    await makeLoadReco(lr, { request: stale, setBookBadge: (n) => calls.push(n) }).call(self);
    expect(self.dueSynced).toBe(false);
    expect(calls).toEqual([]);
    const fail = (url) => (url.startsWith('/api/review') ? Promise.reject(new Error('boom')) : Promise.resolve({}));
    await makeLoadReco(lr, { request: fail, setBookBadge: (n) => calls.push(n) }).call(self);
    expect(calls).toEqual([]);
  });
});

describe('R585 AI 问答底部输入条 placeholder 收短到 360px 可用宽度内', () => {
  // 生产实测：.ib-inp 内层 input 可用宽度 360→99px / 375→114px / 390→129px，字号 13px；
  // CJK 13px/字、「 AI」≈17px，两条文案 91px / 95px 均 ≤ 99px。
  const CJK_W = 13;
  const width = (s) => [...s].reduce((w, ch) => w + (/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? CJK_W : ch === ' ' ? 3 : 7), 0);

  it('两态 placeholder 为收短后的文案，且 13px 估算宽度都 ≤ 99px', () => {
    const m = ask.match(/:placeholder="results\.length \? '([^']+)' : '([^']+)'"/);
    expect(m, 'placeholder 三元应存在').toBeTruthy();
    expect(m[1]).toBe('有疑问？追问 AI');
    expect(m[2]).toBe('拍题或粘贴题目');
    expect(width(m[1])).toBeLessThanOrEqual(99);
    expect(width(m[2])).toBeLessThanOrEqual(99);
    expect(ask).not.toContain('先拍题或粘贴题目开始');
    expect(ask).not.toContain('对讲解有疑问？追问 AI…');
  });

  it('原文案按同一估算确实超出 375 的 114px 可用宽度（回归基线）', () => {
    expect(width('先拍题或粘贴题目开始')).toBeGreaterThan(114);
    expect(width('对讲解有疑问？追问 AI…')).toBeGreaterThan(114);
  });
});
