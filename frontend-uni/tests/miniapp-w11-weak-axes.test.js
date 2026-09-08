// W11-C：小程序统计页 weakAxes/hasRadar 与 H5 W11-B 同口径——按已答题数 n>0 判，0% 全错模块不再被当未答隐藏。
// 位置：miniapp-native/.gitignore 忽略 miniprogram/**/*.js（tsc 产物），故与 miniapp-w9/r506 同放本目录由 frontend-uni vitest 门禁运行。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ts = readFileSync(fileURLToPath(new URL('../../miniapp-native/miniprogram/pages/stats/stats.ts', import.meta.url)), 'utf8');

describe('W11-C stats.ts 雷达轴口径（源文件锁）', () => {
  it('轴类型在 RadarAxis 上补 n（已答题数），axes/weakAxes 均按该类型声明', () => {
    expect(ts).toMatch(/interface StatAxis extends RadarAxis \{\s*n: number;\s*\}/);
    expect(ts).toMatch(/axes: \[\] as StatAxis\[\],\s*hasRadar: false,\s*weakAxes: \[\] as StatAxis\[\],/);
    expect(ts).toMatch(/const axes: StatAxis\[\] = MODS\.map/);
  });
  it('两条数据源都写入 n：服务端 growth 用 s.n，本机 pstats 用 s.done', () => {
    expect(ts).toMatch(/return \{ \.\.\.m, n: s\.n, pct: s\.n \? Math\.round\(\(s\.c \/ s\.n\) \* 100\) : 0 \};/);
    expect(ts).toMatch(/return \{ \.\.\.m, n: s\.done, pct: s\.done \? Math\.round\(\(s\.correct \/ s\.done\) \* 100\) : 0 \};/);
  });
  it('weakAxes 过滤与 hasRadar 判有数据都用 a.n > 0，不再有 a.pct > 0', () => {
    expect(ts).toMatch(/const weakAxes = axes\.filter\(\(a\) => a\.n > 0\)\.sort\(\(a, b\) => a\.pct - b\.pct\)\.slice\(0, 2\);/);
    expect(ts).toMatch(/hasRadar: axes\.some\(\(a\) => a\.n > 0\),/);
    expect(ts).not.toMatch(/a\.pct > 0/);
  });
  it('口径演算：数量 n=3 c=0 → 进「最薄弱」显示 0%，且 hasRadar 为真不出空态', () => {
    const MODS = ['ziliao', 'shuliang', 'yanyu'];
    const modules = { shuliang: { n: 3, c: 0 }, yanyu: { n: 5, c: 4 } };
    const axes = MODS.map((key) => {
      const s = modules[key] || { n: 0, c: 0 };
      return { key, n: s.n, pct: s.n ? Math.round((s.c / s.n) * 100) : 0 };
    });
    const weakAxes = axes.filter((a) => a.n > 0).sort((a, b) => a.pct - b.pct).slice(0, 2);
    expect(weakAxes.map((a) => [a.key, a.pct])).toEqual([['shuliang', 0], ['yanyu', 80]]);
    expect(axes.some((a) => a.n > 0)).toBe(true);
    expect(MODS.map((key) => ({ n: 0, pct: 0 })).some((a) => a.n > 0)).toBe(false);
  });
});
