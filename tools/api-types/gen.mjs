// OpenAPI → 双端 TypeScript 类型层。
// 用法：node tools/api-types/gen.mjs [backend-url]
//   默认打本地 uvicorn http://127.0.0.1:8399；部署后对生产后端跑一次即可更新。
// 产物：
//   miniapp-native/miniprogram/api/openapi-types.ts（小程序端可直接 import type）
//   frontend-uni/src/api-openapi.d.ts（H5 端，同一份）
// 注意：文件头是 GENERATED 标记，不要手改；改了会被下一次生成覆盖。
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv[2] || 'http://127.0.0.1:8399';

const res = await fetch(base.replace(/\/$/, '') + '/openapi.json');
if (!res.ok) {
  console.error(`GET ${base}/openapi.json → ${res.status}`);
  process.exit(1);
}
const spec = await res.text();

// v7 CLI 不支持 stdin：写临时 spec，再 -o 出文件
const tmp = join(tmpdir(), 'kg-openapi');
mkdirSync(tmp, { recursive: true });
const specPath = join(tmp, 'openapi.json');
const outPath = join(tmp, 'openapi-types.ts');
writeFileSync(specPath, spec);
execFileSync('npx', ['-y', 'openapi-typescript@7', specPath, '-o', outPath], {
  shell: true,
  stdio: 'inherit',
});

const { readFileSync } = await import('node:fs');
const gen = readFileSync(outPath, 'utf-8');
const out1 = resolve(root, 'miniapp-native/miniprogram/api/openapi-types.ts');
const out2 = resolve(root, 'frontend-uni/src/api-openapi.d.ts');
writeFileSync(out1, gen);
writeFileSync(out2, gen);
rmSync(tmp, { recursive: true, force: true });
console.log(`✓ ${out1}`);
console.log(`✓ ${out2}`);
