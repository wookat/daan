import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PATHS from '../src/components/l-icon/paths.js';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

// 契约：模板里静态写死的 <l-icon name="x">，x 必须存在于 PATHS——
// 否则图标静默渲染成空白（profile「主题色」palette、ask「换一批」compass、
// pk「返回大厅」arrow-left、practice 登录提示 cloud 都曾因此隐形）。
// 动态 :name 绑定由调用方数据决定，不在本契约内。
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(vue|wxml)$/.test(name)) yield p;
  }
}

function staticIconNames() {
  const names = new Map();
  for (const f of walk(SRC)) {
    const s = readFileSync(f, 'utf8');
    for (const tag of s.matchAll(/<l-icon\b[^>]*>/g)) {
      const m = tag[0].match(/(?<!:)name="([a-z0-9-]+)"/) || tag[0].match(/(?<!:)name='([a-z0-9-]+)'/);
      if (m) names.set(m[1], f);
    }
  }
  return names;
}

describe('l-icon 图标名覆盖契约', () => {
  it('模板静态引用的每个图标名都在 PATHS 里（缺失=空白图标）', () => {
    const missing = [...staticIconNames()].filter(([n]) => !PATHS[n]);
    expect(missing.map(([n, f]) => `${n} @ ${f.split(/[\\/]/).slice(-2).join('/')}`)).toEqual([]);
  });

  it('回归：palette / compass / arrow-left / cloud 已入库', () => {
    for (const n of ['palette', 'compass', 'arrow-left', 'cloud']) expect(PATHS[n]).toBeTruthy();
  });
});
