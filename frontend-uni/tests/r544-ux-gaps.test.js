// R544：生产 UX 走查（2026-09-08，kaogong.zalize.com rev 74a5d62a）四项用户可感知差距的源锁与口径测试
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue');
const stats = read('../src/pages/stats/stats.vue');
const script = stats.slice(stats.indexOf('<script'), stats.indexOf('</script>'));
const fn = (name) => {
  const m = script.match(new RegExp(`\\n {4}${name}\\(\\) \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};
const MODS = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi'].map((key) => ({ key, name: key }));
const evalComputed = (state) => {
  const vm = { ...state };
  const run = (name) => new Function('vm', 'MODS', `return (function(){${fn(name)}}).call(vm)`)(vm, MODS);
  vm.axes = run('axes');
  vm.weakAxes = run('weakAxes');
  vm.weakTitle = run('weakTitle');
  return vm;
};

describe('R544-1 「我的 → 我的收藏 0题」落收藏 tab（生产实测：落到待掌握，需再点一次「收藏」才见空态）', () => {
  it('bookShowFavs 意图无条件切 fav；只有非意图进入且 0 收藏时才回落 todo', () => {
    expect(book).toMatch(
      /if \(uni\.getStorageSync\('bookShowFavs'\)\) \{\s*uni\.removeStorageSync\('bookShowFavs'\);\s*this\.tab = 'fav';\s*\} else if \(this\.tab === 'fav' && !this\.favs\.length\) \{\s*this\.tab = 'todo';\s*\}/,
    );
    expect(book).not.toMatch(/if \(this\.favs\.length\) this\.tab = 'fav'/);
  });
  it('收藏空态仍存在（0 收藏进入 fav tab 有引导而非空白）', () => {
    expect(book).toMatch(/<kg-empty-state\s+v-if="!favs\.length"\s+compact\s+icon="star"\s+title="还没有本机收藏"/);
  });
});

describe('R544-3 错题卡「点开看答案与详解」对比度（生产实测 --ink-4 #b0b4c0 白底 2.07:1 < AA 4.5:1）', () => {
  it('.hint 用 --ink-3（#6b7280，白底 4.83:1）', () => {
    expect(book).toMatch(/\n\.hint \{ font-size: var\(--fs-caption\); color: var\(--ink-3\); \}/);
  });
});

describe('R544-4 统计五维：未练模块显「未练」而非 0%；仅 1 模块有样本不判「最薄弱」', () => {
  it('模板：雷达轴标签按 a.n 判「未练」，最薄弱标题走 weakTitle，按钮文案随样本数', () => {
    expect(stats).toMatch(/<text class="al-val num" :class="\{ none: !a\.n \}">\{\{ a\.n \? a\.pct \+ '%' : '未练' \}\}<\/text>/);
    expect(stats).toMatch(/<text v-if="weakAxes\.length" class="rs-t">\{\{ weakTitle \}\}<\/text>/);
    expect(stats).toMatch(/\{\{ weakAxes\.length >= 2 \? '去补弱' : '继续练' \}\}<\/kg-button>/);
  });
  it('只有数量有作答（n=13 c=10）：标题「已练模块」而非「最薄弱」，其余模块 n=0', () => {
    const vm = evalComputed({ growth: { modules: { shuliang: { n: 13, c: 10 } } }, pstats: { byModule: {} } });
    expect(vm.weakAxes.map((a) => [a.key, a.pct])).toEqual([['shuliang', 77]]);
    expect(vm.weakTitle).toBe('已练模块');
    expect(vm.axes.filter((a) => !a.n).length).toBe(4);
  });
  it('两个及以上模块有作答：仍是「最薄弱」', () => {
    const vm = evalComputed({ growth: { modules: { shuliang: { n: 3, c: 0 }, yanyu: { n: 10, c: 8 } } }, pstats: { byModule: {} } });
    expect(vm.weakTitle).toBe('最薄弱');
    expect(vm.weakAxes[0].key).toBe('shuliang');
  });
});

describe('R544-5 历次作答合并复习记录（/api/attempts source=practice|review）', () => {
  it('复习作答上送 picked；历次作答行显示「练习/复习」来源', () => {
    expect(book).toMatch(/data: \{ correct, uid: anonUid\(\), picked: this\.picked \|\| undefined \}/);
    expect(book).toMatch(/<text class="att-src">\{\{ a\.source === 'review' \? '复习' : '练习' \}\}<\/text>/);
  });
});

describe('R544 小程序同口径', () => {
  const radarTs = read('../../miniapp-native/miniprogram/components/kg-chart-radar/index.ts');
  const radarWxml = read('../../miniapp-native/miniprogram/components/kg-chart-radar/index.wxml');
  const statsWxml = read('../../miniapp-native/miniprogram/pages/stats/stats.wxml');
  const bookTs = read('../../miniapp-native/miniprogram/pages/book/book.ts');
  const apiTs = read('../../miniapp-native/miniprogram/api/index.ts');
  it('雷达标签 n===0 → 未练；最薄弱/去补弱文案按 weakAxes.length>=2', () => {
    expect(radarTs).toMatch(/val: a\.n === 0 \? '未练' : `\$\{a\.pct\}%`/);
    expect(radarWxml).toMatch(/\{\{item\.val\}\}<\/text>/);
    expect(statsWxml).toMatch(/\{\{weakAxes\.length >= 2 \? '最薄弱' : '已练模块'\}\}/);
    expect(statsWxml).toMatch(/\{\{weakAxes\.length >= 2 \? '去补弱' : '继续练'\}\} ›/);
  });
  it('复习上送 picked；历次作答行带来源', () => {
    expect(apiTs).toMatch(/postReviewRecord\(mid: number, correct: boolean, picked\?: string\)/);
    expect(bookTs).toMatch(/postReviewRecord\(cur\.id, correct, picked\)/);
    expect(bookTs).toMatch(/\(a\.source === 'review' \? '复习' : '练习'\)/);
  });
});
