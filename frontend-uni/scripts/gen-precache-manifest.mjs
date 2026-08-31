// 构建后生成 precache.json：assets 下全部 js/css 的 URL 清单，
// 供运行期空闲预取温 HTTP 缓存（immutable 长缓存），离线可直入未访问路由。
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist/build/h5');
const files = readdirSync(join(dist, 'assets'))
  .filter((f) => /\.(js|css)$/.test(f))
  .sort()
  .map((f) => `/assets/${f}`);
writeFileSync(join(dist, 'precache.json'), JSON.stringify(files));
console.log(`gen-precache-manifest: ${files.length} 个资源写入 precache.json`);
