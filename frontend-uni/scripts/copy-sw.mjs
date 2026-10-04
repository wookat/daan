// 构建后处理：把 static/sw.js 提升到产物根目录。
// SW 的作用域以其所在路径为上限——/app/ 子路径部署下 sw.js 必须位于 /app/sw.js 才能覆盖整个应用。
import { copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'dist/build/h5');
copyFileSync(resolve(outDir, 'static', 'sw.js'), resolve(outDir, 'sw.js'));
console.log('copy-sw: static/sw.js → dist/build/h5/sw.js');
