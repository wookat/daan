// 构建后处理：把入口路由（首页 / 外链深链落地页）的分包 + 依赖提升到 index.html <head> 预加载，
// 使其与 index-*.js 并行下载，省掉「下载并执行 index.js 后才发现分包」这一整个串行往返。
// 注入的是按 location.hash 选路由的内联脚本：JS 用 <link rel=modulepreload>（Vite 的 __vitePreload
// 见到同 href 的 link 会跳过重复请求），CSS 用 <link rel=preload as=style>（Vite 仍自行插 stylesheet，命中预加载缓存）。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 只预加载会被外部冷启动直达的路由，避免 HTML 膨胀（其余路由仍由 __vitePreload 按需加载）。 */
export const ENTRY_ROUTES = ['pages/home/home', 'pages/practice/practice', 'pages/book/book', 'pages/team/join'];
export const DEFAULT_ROUTE = 'pages/home/home';
export const MARK = 'data-kg-route-preload';

/** 从 index-*.js 解析 __vite__mapDeps 文件表与各路由分包的依赖索引，返回 { 'pages/a/b': ['/assets/x.js', ...] }。 */
export function parseRouteDeps(indexJs, routes = ENTRY_ROUTES) {
  const m = indexJs.match(/__vite__mapDeps\.viteFileDeps\s*=\s*(\[[^\]]*\])/);
  if (!m) throw new Error('route-preload: 未找到 __vite__mapDeps.viteFileDeps，Vite 产物结构可能已变化');
  const files = JSON.parse(m[1]);
  const out = {};
  const re = /import\("\.\/(pages(?:-[\w-]+?)+)\.[\w-]+\.js"\),__vite__mapDeps\(\[([\d,]*)\]\)/g;
  let hit;
  while ((hit = re.exec(indexJs))) {
    const route = hit[1].replace(/-/g, '/');
    if (!routes.includes(route)) continue;
    const idx = hit[2] ? hit[2].split(',').map(Number) : [];
    out[route] = idx.map((i) => {
      if (!files[i]) throw new Error(`route-preload: 依赖索引 ${i} 越界（${route}）`);
      return '/' + files[i];
    });
  }
  return out;
}

/** 生成注入 <head> 的内联脚本：按 hash 路由挑依赖并插入 link。 */
export function buildInlineScript(routeDeps, defaultRoute = DEFAULT_ROUTE) {
  const json = JSON.stringify(routeDeps).replace(/</g, '\\u003c');
  return (
    `<script ${MARK}>(function(){try{var M=${json};` +
    `var h=(location.hash||'').replace(/^#\\/?/,'').split('?')[0]||${JSON.stringify(defaultRoute)};` +
    `var d=M[h];if(!d)return;var f=document.createDocumentFragment();` +
    `for(var i=0;i<d.length;i++){var p=d[i],l=document.createElement('link');` +
    `if(/\\.css$/.test(p)){l.rel='preload';l.as='style';}else{l.rel='modulepreload';l.as='script';l.crossOrigin='';}` +
    `l.href=p;f.appendChild(l);}document.head.appendChild(f);}catch(e){}})();</script>`
  );
}

/** 把内联脚本插到入口 <script type="module"> 之前；重复运行幂等（先移除旧注入）。 */
export function injectIntoHtml(html, script) {
  const cleaned = html.replace(new RegExp(`<script ${MARK}>[\\s\\S]*?</script>`, 'g'), '');
  const entry = cleaned.match(/<script type="module"[^>]*src="\/assets\/index-[\w-]+\.js"[^>]*><\/script>/);
  if (!entry) throw new Error('route-preload: 未找到入口 <script type="module" src="/assets/index-*.js">');
  return cleaned.replace(entry[0], script + entry[0]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = resolve(root, 'dist/build/h5');
  const htmlPath = resolve(outDir, 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  const entry = html.match(/src="\/assets\/(index-[\w-]+\.js)"/);
  if (!entry) throw new Error('route-preload: index.html 未引用 /assets/index-*.js');
  const indexJs = readFileSync(resolve(outDir, 'assets', entry[1]), 'utf8');
  const deps = parseRouteDeps(indexJs);
  const missing = ENTRY_ROUTES.filter((r) => !deps[r]);
  if (missing.length) throw new Error(`route-preload: 入口路由分包未在 index.js 中找到：${missing.join(', ')}`);
  const assets = new Set(readdirSync(resolve(outDir, 'assets')).map((f) => '/assets/' + f));
  for (const [route, list] of Object.entries(deps)) {
    for (const p of list) if (!assets.has(p)) throw new Error(`route-preload: ${route} 依赖 ${p} 不在产物中`);
  }
  writeFileSync(htmlPath, injectIntoHtml(html, buildInlineScript(deps)));
  const n = Object.values(deps).reduce((s, l) => s + l.length, 0);
  console.log(`route-preload: 已注入 ${Object.keys(deps).length} 个入口路由 / ${n} 个预加载依赖到 index.html`);
}
