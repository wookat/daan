// R520b：a11y 弹层栈把 .mask 内联 z-index 写成 BASE_Z(99)+栈深=100，而 W5 起 .mask 与 KgSheet/wd-popup 都落在
// --z-overlay(1000) 档 → 从 KgSheet 底栏打开的导出确认层（错题本「导出当前筛选」/ 首页「导出为试卷 PDF」）被 sheet 盖住，
// 生产 375/1440 elementFromPoint 命中 sheet 内按钮、确认层不可点。基准改为 --z-overlay 档并运行时与 KgSheet 同源读取。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BASE_Z, zIndexFor } from '../src/modal-policy.js';

const TOKENS = readFileSync(new URL('../src/styles/tokens.generated.css', import.meta.url), 'utf8');
const A11Y = readFileSync(new URL('../src/a11y-focus.js', import.meta.url), 'utf8');
const SHEET = readFileSync(new URL('../src/components/kg-sheet/kg-sheet.vue', import.meta.url), 'utf8');
const EXPORT = readFileSync(new URL('../src/components/export-confirm/export-confirm.vue', import.meta.url), 'utf8');

const tokenOverlay = parseInt(/--z-overlay:\s*(\d+)/.exec(TOKENS)[1], 10);

describe('弹层栈基准 = --z-overlay 档', () => {
  it('BASE_Z 与 tokens --z-overlay 同值，且 KgSheet 兜底同值', () => {
    expect(BASE_Z).toBe(tokenOverlay);
    expect(SHEET).toContain(`const Z_OVERLAY_FALLBACK = ${tokenOverlay};`);
  });

  it('栈深 1 即压过同档 KgSheet（wd-popup 内联 z-index = --z-overlay）', () => {
    expect(zIndexFor(1)).toBeGreaterThan(tokenOverlay);
    expect(zIndexFor(1, tokenOverlay)).toBe(tokenOverlay + 1);
  });

  it('运行时读到的 --z-overlay 为基准；读不到（NaN/0）回落 BASE_Z 而非 0+depth', () => {
    expect(zIndexFor(2, 1200)).toBe(1202);
    expect(zIndexFor(2, NaN)).toBe(BASE_Z + 2);
    expect(zIndexFor(2, 0)).toBe(BASE_Z + 2);
  });

  it('a11y-focus 入栈时以 --z-overlay 为基准写内联 z-index（与 KgSheet 同源）', () => {
    expect(A11Y).toContain("getPropertyValue('--z-overlay')");
    expect(A11Y).toContain('m.style.zIndex = String(zIndexFor(stack.length, overlayBase()))');
  });

  it('export-confirm .mask 样式层级仍走 --z-overlay，与栈基准同档', () => {
    expect(EXPORT).toMatch(/\.mask\s*\{[^}]*z-index:\s*var\(--z-overlay\)/);
  });
});
