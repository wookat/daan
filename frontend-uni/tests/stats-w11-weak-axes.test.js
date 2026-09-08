import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const stats = read('../src/pages/stats/stats.vue');
const script = stats.slice(stats.indexOf('<script'), stats.indexOf('</script>'));
const fn = (name) => {
  const m = script.match(new RegExp(`\\n {4}${name}\\(\\) \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};

// 把 axes/weakAxes/hasRadar 三个 computed 按源码求值（与 stats.vue 同一份逻辑），避免只锁字符串
const MODS = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi'].map((key) => ({ key, name: key }));
const evalComputed = (state) => {
  const body = (name) => `(function(){${fn(name)}}).call(vm)`;
  const vm = { ...state };
  const run = (name) => new Function('vm', 'MODS', `return ${body(name)}`)(vm, MODS);
  vm.axes = run('axes');
  vm.weakAxes = run('weakAxes');
  vm.hasRadar = run('hasRadar');
  return vm;
};

describe('W11-B 统计页五维能力：「最薄弱」与 hasRadar 按作答数 n>0 判定（0% 全错模块不再被当「未答」隐藏）', () => {
  it('源锁：stats.vue 不再用 a.pct > 0 判「有数据」；weakAxes / hasRadar 均按 a.n > 0', () => {
    expect(stats).not.toMatch(/a\.pct > 0/);
    expect(fn('weakAxes')).toMatch(/\.filter\(\(a\) => a\.n > 0\)/);
    expect(fn('weakAxes')).toMatch(/\.sort\(\(a, b\) => a\.pct - b\.pct\)/);
    expect(fn('hasRadar')).toMatch(/\.some\(\(a\) => a\.n > 0\)/);
  });
  it('源锁：axes() 两条来源分支（growth.modules / pstats.byModule 回落）都产出 n', () => {
    const body = fn('axes');
    const svBranch = body.slice(body.indexOf('if (sv)'), body.indexOf('this.pstats.byModule'));
    const localBranch = body.slice(body.indexOf('this.pstats.byModule'));
    expect(svBranch).toMatch(/const n = s\.n \|\| 0;/);
    expect(svBranch).toMatch(/return \{ \.\.\.m, n, pct:/);
    expect(localBranch).toMatch(/const n = s\.done \|\| 0;/);
    expect(localBranch).toMatch(/return \{ \.\.\.m, n, pct:/);
  });
  it('growth.modules {数量 n3 c0, 言语 n10 c8}：最薄弱第一行为数量 0%，hasRadar 为 true 不出空态', () => {
    const vm = evalComputed({ growth: { modules: { shuliang: { n: 3, c: 0 }, yanyu: { n: 10, c: 8 } } }, pstats: { byModule: {} } });
    expect(vm.hasRadar).toBe(true);
    expect(vm.weakAxes.map((a) => [a.key, a.pct])).toEqual([
      ['shuliang', 0],
      ['yanyu', 80],
    ]);
    expect(vm.axes.find((a) => a.key === 'ziliao')).toMatchObject({ n: 0, pct: 0 });
  });
  it('growth.modules 全 n=0（或缺失）：仍出「还没有能力数据」空态、最薄弱为空', () => {
    for (const modules of [{}, { shuliang: { n: 0, c: 0 }, yanyu: { n: 0, c: 0 } }]) {
      const vm = evalComputed({ growth: { modules }, pstats: { byModule: {} } });
      expect(vm.hasRadar).toBe(false);
      expect(vm.weakAxes).toEqual([]);
    }
  });
  it('离线回落 pstats.byModule：done>0 correct=0 的模块同样进最薄弱', () => {
    const vm = evalComputed({ growth: null, pstats: { byModule: { changshi: { done: 4, correct: 0 }, ziliao: { done: 5, correct: 5 } } } });
    expect(vm.hasRadar).toBe(true);
    expect(vm.weakAxes.map((a) => [a.key, a.n, a.pct])).toEqual([
      ['changshi', 4, 0],
      ['ziliao', 5, 100],
    ]);
  });
  it('模板：最薄弱行仍直接显示 a.pct%（0% 正常显示），空态仍挂在 !hasRadar', () => {
    expect(stats).toMatch(/<text class="rs-pct num">\{\{ a\.pct \}\}%<\/text>/);
    expect(stats).toMatch(/<kg-empty-state v-if="!hasRadar" compact icon="chart-column" title="还没有能力数据"/);
  });
});
