// W14-B2：个人页「错题本 N」与统计页「已掌握 N」改取 /api/growth 的 mistakes 聚合字段，
// 不再为一个数字各拉一次 /api/mistakes 全表（后端本就不接 limit、不回 total）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const profile = read('../src/pages/profile/profile.vue');
const stats = read('../src/pages/stats/stats.vue');

function methodBody(src, sig) {
  const m = src.match(new RegExp(`\\n {4}${sig} \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, `${sig} 应存在`).toBeTruthy();
  return m[1];
}

// 把 computed 函数体当纯函数跑：仅依赖 this.growth
function evalComputed(body, growth) {
  return new Function('growth', `return (function () {${body}\n}).call({ growth });`)(growth);
}

// 把 applyGrowth(g, uid) 当纯函数跑：this 为页面态，snapPeek 注入旧快照
function runApplyGrowth(body, growth, legacySnap) {
  const self = { growth: null, mistakeN: null };
  new Function('snapPeek', 'encodeURIComponent', 'self', 'g', `return (function (g, uid) {${body}\n}).call(self, g, 'u1');`)(
    () => legacySnap, encodeURIComponent, self, growth,
  );
  return self;
}

describe('profile.vue 错题数', () => {
  it('loadRemote 不再请求 /api/mistakes；growth 快照与响应统一经 applyGrowth 落 mistakeN', () => {
    expect(profile).not.toMatch(/request\((mp|['"`]\/api\/mistakes)/);
    expect(profile).not.toMatch(/const mp = /);
    // 旧快照只在 applyGrowth 里只读一轮兼容，不新增请求
    expect(profile.match(/\/api\/mistakes\?uid=/g)).toHaveLength(1);
    const lr = methodBody(profile, 'async loadRemote\\(\\)');
    expect(lr).toMatch(/if \(gSnap\) this\.applyGrowth\(gSnap, uid\);/);
    expect(lr).toMatch(/this\.applyGrowth\(await request\(gp\), uid\);/);
    expect(lr).not.toMatch(/this\.growth = /);
  });

  it('mistakeN = growth.mistakes.total；老后端无字段回退旧快照 items 数，再无则 0；退出登录清回 null 渲染「—」', () => {
    const body = methodBody(profile, 'applyGrowth\\(g, uid\\)');
    const g = { total: { n: 1, c: 1 } };
    expect(runApplyGrowth(body, { ...g, mistakes: { total: 3, mastered: 1, pending: 2 } }, { items: [{}] })).toEqual({
      growth: { ...g, mistakes: { total: 3, mastered: 1, pending: 2 } }, mistakeN: 3,
    });
    expect(runApplyGrowth(body, { ...g, mistakes: { total: 0, mastered: 0, pending: 0 } }, null).mistakeN).toBe(0);
    expect(runApplyGrowth(body, g, { items: [{}, {}] }).mistakeN).toBe(2);
    expect(runApplyGrowth(body, g, null).mistakeN).toBe(0);
    expect(methodBody(profile, 'resetAccountState\\(\\)')).toMatch(/this\.mistakeN = null;/);
    expect(profile).toMatch(/\{ label: '错题本', value: this\.mistakeN == null \? '—' : this\.mistakeN \}/);
  });
});

describe('stats.vue 已掌握数', () => {
  it('load() 只拉 /api/stats，不再请求 /api/mistakes；masteredCount 不再是 data 字段', () => {
    expect(stats).not.toMatch(/\/api\/mistakes/);
    expect(stats).not.toMatch(/masteredCount: 0/);
    expect(stats).not.toMatch(/this\.masteredCount =/);
    // growth 先铺快照再请求，computed 随之更新
    expect(methodBody(stats, 'async loadGrowth\\(\\)')).toMatch(/snapPeek\(p\)[\s\S]*?request\(p\)/);
  });

  it('masteredCount = growth.mistakes.mastered；growth 未到达或老后端无字段回 0', () => {
    const body = methodBody(stats, 'masteredCount\\(\\)');
    expect(evalComputed(body, null)).toBe(0);
    expect(evalComputed(body, { total: { n: 1, c: 1 } })).toBe(0);
    expect(evalComputed(body, { total: { n: 1, c: 1 }, mistakes: { total: 3, mastered: 1, pending: 2 } })).toBe(1);
    expect(stats).toMatch(/const zhan = this\.masteredCount;/);
  });
});
