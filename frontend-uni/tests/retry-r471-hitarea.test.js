import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.vue') ? [p] : [];
  });
const rule = (css, sel) =>
  (css.match(new RegExp(`\\n\\s*${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';

const withRetry = walk(SRC).filter((p) => /class="retry"/.test(readFileSync(p, 'utf8')));

describe('R471 全仓「加载失败 → 重试 ›」文字链热区（源文件锁）', () => {
  it('挂 .retry 的页面 ≥17（漏扫即失败）', () => {
    expect(withRetry.length).toBeGreaterThanOrEqual(17);
  });

  for (const p of withRetry) {
    it(`${p.slice(SRC.length + 1)}：.retry 命中高 ≥40px`, () => {
      const src = readFileSync(p, 'utf8');
      const css = src.slice(src.indexOf('<style'));
      const r = rule(css, '.retry');
      expect(r, 'has .retry rule').not.toBe('');
      expect(r).toMatch(/min-height:\s*40px/);
      expect(r).not.toMatch(/min-height:\s*\d+rpx/);
    });
  }
});
