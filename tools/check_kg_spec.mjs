#!/usr/bin/env node
// kg-* 双端组件契约断言：shared/kg-spec.json 里每对组件，两端都必须暴露声明的 props，
// 事件按各自一侧的实际事件名存在（允许登记过的漂移名）。任何一端漏同步都会让本检查失败。
// 用法：node tools/check_kg_spec.mjs  （frontend-uni vitest 也调用本文件，单一事实源）
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(readFileSync(join(ROOT, 'shared/kg-spec.json'), 'utf-8'));

const SKIP = new Set(['default', 'type', 'validator', 'required']);

function mpSurface(name) {
  const f = join(ROOT, 'miniapp-native/miniprogram/components', name, 'index.ts');
  if (!existsSync(f)) return null;
  const src = readFileSync(f, 'utf-8');
  const m = src.match(/properties\s*:\s*\{([\s\S]*?)\n\s{2}\}/);
  const props = m ? [...m[1].matchAll(/(\w+)\s*:\s*\{/g)].map(x => x[1]) : [];
  const events = [...src.matchAll(/triggerEvent\(\s*['"]([\w-]+)/g)].map(x => x[1]);
  return { props: new Set(props.filter(p => !SKIP.has(p))), events: new Set(events) };
}

function h5Surface(name) {
  const dir = join(ROOT, 'frontend-uni/src/components', name);
  if (!existsSync(dir)) return null;
  const vue = readdirSync(dir).find(x => x.endsWith('.vue'));
  if (!vue) return null;
  const src = readFileSync(join(dir, vue), 'utf-8');
  const props = new Set();
  const m = src.match(/props\s*:\s*\{([\s\S]*?)\n\s{2}\}/);
  if (m) for (const x of m[1].matchAll(/(\w+)\s*:/g)) if (!SKIP.has(x[1])) props.add(x[1]);
  const events = new Set([...src.matchAll(/emit\(\s*['"]([\w-]+)/g)].map(x => x[1]));
  const de = src.match(/defineEmits\(\s*\[([^\]]*)\]/);
  if (de) for (const x of de[1].matchAll(/['"]([\w-]+)/g)) events.add(x[1]);
  return { props, events };
}

const fails = [];
for (const [mpName, pair] of Object.entries(spec.pairs)) {
  const mp = mpSurface(mpName);
  const h5 = h5Surface(pair.h5);
  if (!mp) { fails.push(`${mpName}: mp component missing`); continue; }
  if (!h5) { fails.push(`${mpName}: h5 component ${pair.h5} missing`); continue; }
  for (const p of pair.props) {
    if (!mp.props.has(p)) fails.push(`${mpName}: mp missing prop '${p}'`);
    if (!h5.props.has(p)) fails.push(`${mpName}: h5 missing prop '${p}'`);
  }
  for (const [sem, ev] of Object.entries(pair.events)) {
    if (!mp.events.has(ev.mp)) fails.push(`${mpName}: mp missing event '${ev.mp}' (semantic '${sem}')`);
    if (!h5.events.has(ev.h5)) fails.push(`${mpName}: h5 missing event '${ev.h5}' (semantic '${sem}')`);
  }
}

if (fails.length) {
  console.error('kg-spec contract FAIL:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log(`kg-spec contract OK (${Object.keys(spec.pairs).length} pairs)`);
