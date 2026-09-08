// W12D-3：lint-pages 把 components/ 下非 kg-* 业务组件按页面层处理（box-shadow/渐变 warn），kg-*/l-icon 仍为共享层 error。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const LINT = path.join(here, '../../tools/design-tokens/lint-pages.mjs');
const REPO = path.join(here, '../..');

let root; // 仅业务组件
let sharedRoot; // 业务组件 + 共享层
const write = (base, rel, css) => {
  const abs = path.join(base, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `<template><view /></template>\n<style>\n${css}\n</style>\n`);
};
const run = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [LINT, ...args], { env: { ...process.env, KG_LINT_ROOT: cwd }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-lint-'));
  sharedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-lint-shared-'));
  for (const base of [root, sharedRoot]) {
    write(base, 'frontend-uni/src/components/foo-card/foo-card.vue', '.c { box-shadow: var(--sh-1); background: linear-gradient(#fff, #000); }');
    write(base, 'frontend-uni/src/components/bar-card/bar-card.vue', '.b { padding: var(--sp-12); border-radius: var(--r-md); }');
  }
  write(sharedRoot, 'frontend-uni/src/components/kg-sheet/kg-sheet.vue', '.s { box-shadow: var(--sh-2); }');
  write(sharedRoot, 'frontend-uni/src/components/kg-tag/kg-tag.vue', '.t { color: #ff0000; }');
  write(sharedRoot, 'frontend-uni/src/components/l-icon/l-icon.vue', '.i { color: rgb(1, 2, 3); }');
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(sharedRoot, { recursive: true, force: true });
});

describe('lint-pages components/ 扫描范围（W12D-3）', () => {
  it('非 kg-* 业务组件按页面层：阴影/渐变/裸色 warn，不阻断（exit 0）', () => {
    const { code, out } = run(root);
    expect(code).toBe(0);
    expect(out).toMatch(/warn frontend-uni\/src\/components\/foo-card\/foo-card\.vue:\d+ \[no-shadow\]/);
    expect(out).toMatch(/warn frontend-uni\/src\/components\/foo-card\/foo-card\.vue:\d+ \[no-gradient\]/);
    expect(out).toMatch(/warn frontend-uni\/src\/components\/foo-card\/foo-card\.vue:\d+ \[no-hex\]/);
    expect(out).not.toMatch(/bar-card/);
  });

  it('kg-*/l-icon 仍是共享层：裸色 error（exit 1），阴影不按页面规则报', () => {
    const { code, out } = run(sharedRoot);
    expect(code).toBe(1);
    expect(out).toMatch(/warn frontend-uni\/src\/components\/foo-card\/foo-card\.vue:\d+ \[no-shadow\]/);
    expect(out).toMatch(/ERR {2}frontend-uni\/src\/components\/kg-tag\/kg-tag\.vue:\d+ \[no-hex\]/);
    expect(out).toMatch(/ERR {2}frontend-uni\/src\/components\/l-icon\/l-icon\.vue:\d+ \[no-rgb\]/);
    expect(out).not.toMatch(/kg-sheet/);
    expect(out).toMatch(/lint-pages: 2 error/);
  });

  it('--strict 把业务组件 warn 转 error', () => {
    const { code, out } = run(root, '--strict');
    expect(code).toBe(1);
    expect(out).toMatch(/ERR {2}frontend-uni\/src\/components\/foo-card\/foo-card\.vue:\d+ \[no-shadow\]/);
  });

  it('真仓：rank-card / predict-card 已走 kg-card，0 命中', () => {
    const { out } = run(REPO, '--file=components/rank-card');
    expect(out).not.toMatch(/rank-card/);
    const p = run(REPO, '--file=components/predict-card');
    expect(p.out).not.toMatch(/predict-card/);
  });
});
