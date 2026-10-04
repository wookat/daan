import { describe, it, expect } from 'vitest';
import { parseRouteDeps, buildInlineScript, injectIntoHtml, MARK, ENTRY_ROUTES, H5_BASE } from '../scripts/route-preload.mjs';
const A = H5_BASE + 'assets/';

// 仿 Vite 5 产物：文件表 + 各路由分包 import() 与依赖索引
const INDEX_JS = `function __vite__mapDeps(indexes) {
  if (!__vite__mapDeps.viteFileDeps) {
    __vite__mapDeps.viteFileDeps = ["assets/pages-home-home.B422Y6dP.js","assets/l-icon.DL6Ooo0O.js","assets/home-DJtSE6Fm.css","assets/pages-practice-practice.EYAwWWBe.js","assets/practice-Cxyz.css","assets/pages-stats-stats.ZXTNl5fn.js"]
  }
  return indexes.map((i) => __vite__mapDeps.viteFileDeps[i])
}
const Mb=()=>t(()=>import("./pages-home-home.B422Y6dP.js"),__vite__mapDeps([0,1,2])).then(e=>Kg(e.default||e)),
Pb=()=>t(()=>import("./pages-practice-practice.EYAwWWBe.js"),__vite__mapDeps([3,1,4])).then(e=>Kg(e.default||e)),
Nb=()=>t(()=>import("./pages-stats-stats.ZXTNl5fn.js"),__vite__mapDeps([5,1])).then(e=>Kg(e.default||e));`;

const HTML = `<html><head><style>x</style><script type="module" crossorigin src="${A}index-Bctw4Xpu.js"></script></head><body></body></html>`;

describe('route-preload: 解析路由分包依赖', () => {
  it('只取入口白名单路由，依赖按文件表映射成 ${H5_BASE}assets 绝对路径且保持 Vite 顺序', () => {
    const deps = parseRouteDeps(INDEX_JS);
    expect(Object.keys(deps).sort()).toEqual(['pages/home/home', 'pages/practice/practice']);
    expect(deps['pages/home/home']).toEqual([
      `${A}pages-home-home.B422Y6dP.js`,
      `${A}l-icon.DL6Ooo0O.js`,
      `${A}home-DJtSE6Fm.css`,
    ]);
    expect(deps['pages/practice/practice'][0]).toBe(`${A}pages-practice-practice.EYAwWWBe.js`);
    expect(deps['pages/stats/stats']).toBeUndefined();
  });

  it('白名单可覆盖；文件表缺失或索引越界直接抛错（产物结构变化不得静默通过）', () => {
    expect(Object.keys(parseRouteDeps(INDEX_JS, ['pages/stats/stats']))).toEqual(['pages/stats/stats']);
    expect(() => parseRouteDeps('const x = 1;')).toThrow(/viteFileDeps/);
    const broken = INDEX_JS.replace('__vite__mapDeps([0,1,2])', '__vite__mapDeps([0,99])');
    expect(() => parseRouteDeps(broken)).toThrow(/越界/);
  });

  it('入口白名单含首页与外链深链落地页', () => {
    expect(ENTRY_ROUTES).toContain('pages/home/home');
    expect(ENTRY_ROUTES).toContain('pages/practice/practice');
  });
});

describe('route-preload: 内联脚本与注入', () => {
  const deps = parseRouteDeps(INDEX_JS);
  const script = buildInlineScript(deps);

  it('脚本按 hash 选路由：空 hash 走首页，深链走对应路由，未知路由不注入；JS 用 modulepreload、CSS 用 preload as=style', () => {
    const run = (hash) => {
      const links = [];
      const el = () => ({ set rel(v) { this._rel = v; }, get rel() { return this._rel; }, as: '', crossOrigin: null, href: '' });
      const document = {
        createDocumentFragment: () => ({ appendChild: (l) => links.push(l) }),
        createElement: () => el(),
        head: { appendChild: () => {} },
      };
      const location = { hash };
      new Function('document', 'location', script.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''))(document, location);
      return links.map((l) => `${l.rel}${l.as ? ':' + l.as : ''} ${l.href}`);
    };
    expect(run('')).toEqual([
      `modulepreload:script ${A}pages-home-home.B422Y6dP.js`,
      `modulepreload:script ${A}l-icon.DL6Ooo0O.js`,
      `preload:style ${A}home-DJtSE6Fm.css`,
    ]);
    expect(run('#/')).toHaveLength(3);
    expect(run('#/pages/practice/practice?module=yanyu&src=seo')[0]).toBe(`modulepreload:script ${A}pages-practice-practice.EYAwWWBe.js`);
    expect(run('#/pages/stats/stats')).toEqual([]);
  });

  it('注入到入口 module script 之前，重复注入幂等，且不含可提前闭合的 </script>', () => {
    const once = injectIntoHtml(HTML, script);
    expect(once.indexOf(`<script ${MARK}>`)).toBeLessThan(once.indexOf('<script type="module"'));
    expect(once.match(new RegExp(MARK, 'g'))).toHaveLength(1);
    const twice = injectIntoHtml(once, script);
    expect(twice).toBe(once);
    expect(script.slice(0, -'</script>'.length)).not.toMatch(/<\/script>/);
    expect(() => injectIntoHtml('<html></html>', script)).toThrow(/入口/);
  });
});
