// 构建后生成 precache.json：assets 下全部 js/css 的 URL 清单，
// 供运行期空闲预取温 HTTP 缓存（immutable 长缓存），离线可直入未访问路由。
// 运行期按清单顺序逐个 fetch，故把主循环路由（练习页 → 错题本 → 其余入口路由）的分包依赖排在最前，
// 其余资源按文件名排序跟在后面：首页停留几秒内点进练习时分包已在缓存，而不是等清单按字母序爬到 p。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRouteDeps, ENTRY_ROUTES } from './route-preload.mjs';

/** 预取优先级：主循环页优先，其余入口路由随后。 */
export const PRECACHE_FIRST_ROUTES = ['pages/practice/practice', 'pages/book/book', ...ENTRY_ROUTES];

/** 把入口路由依赖（按 PRECACHE_FIRST_ROUTES 顺序、去重）排到清单最前，其余保持原顺序。 */
export function orderPrecache(files, routeDeps, first = PRECACHE_FIRST_ROUTES) {
  const all = new Set(files);
  const out = [];
  const seen = new Set();
  for (const route of first) {
    for (const p of routeDeps[route] || []) {
      if (all.has(p) && !seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  for (const p of files) if (!seen.has(p)) out.push(p);
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('gen-precache-manifest.mjs')) {
  const dist = join(process.cwd(), 'dist/build/h5');
  const files = readdirSync(join(dist, 'assets'))
    .filter((f) => /\.(js|css)$/.test(f))
    .sort()
    .map((f) => `/assets/${f}`);
  const indexJs = files.find((f) => /\/index-[\w-]+\.js$/.test(f));
  if (!indexJs) throw new Error('gen-precache-manifest: 产物中未找到 /assets/index-*.js');
  const deps = parseRouteDeps(readFileSync(join(dist, indexJs.slice(1)), 'utf8'), PRECACHE_FIRST_ROUTES);
  const list = orderPrecache(files, deps);
  writeFileSync(join(dist, 'precache.json'), JSON.stringify(list));
  const firstSet = new Set(PRECACHE_FIRST_ROUTES.flatMap((r) => deps[r] || []));
  const nFirst = list.filter((p) => firstSet.has(p)).length;
  console.log(`gen-precache-manifest: ${list.length} 个资源写入 precache.json（入口路由依赖前置 ${nFirst} 个）`);
}
