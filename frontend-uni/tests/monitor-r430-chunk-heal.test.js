import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installVueErrorHandler } from '../src/monitor-client.js';

const main = readFileSync(fileURLToPath(new URL('../src/main.js', import.meta.url)), 'utf8');

describe('R430 发版后旧壳 chunk 404 → 立即触发陈旧壳自愈', () => {
  it('errorHandler 只在 chunk-load 时回调 onChunkLoadError（timeout / 普通 vue 错误不触发）', () => {
    const app = { config: {} };
    const onChunk = vi.fn();
    installVueErrorHandler(app, vi.fn(), null, onChunk);
    app.config.errorHandler(new Error('Async component timed out after 20000ms.'), null, 'async component loader');
    app.config.errorHandler(new Error("Cannot read properties of undefined (reading 'x')"), null, '');
    expect(onChunk).not.toHaveBeenCalled();
    const err = new Error('Failed to fetch dynamically imported module: https://x/assets/pages-stats-stats.DrCxpCf5.js');
    app.config.errorHandler(err, null, 'async component loader');
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith(err);
  });

  it('未传回调时 chunk-load 仍只上报不抛错', () => {
    const app = { config: {} };
    const report = vi.fn();
    installVueErrorHandler(app, report);
    expect(() => app.config.errorHandler(new Error('Loading chunk 3 failed'), null, '')).not.toThrow();
    expect(report.mock.calls[0][0]).toMatch(/^vue:chunk-load/);
  });

  it('main.js：chunk-load 回调接到 staleShellHeal（hash 一致不 reload、会话内只一次）', () => {
    expect(main).toMatch(/installVueErrorHandler\(app, mReport, [^,]+, \(\) => healOnChunkLoadError\(\)\)/);
    expect(main).toMatch(/healOnChunkLoadError = staleShellHeal;/);
    expect(main).toMatch(/if \(sessionStorage\.getItem\('kg_sh_reload'\)\) return;[\s\S]*?if \(m && m\[1\] !== cur\) \{[\s\S]*?sessionStorage\.setItem\('kg_sh_reload', '1'\);[\s\S]*?location\.reload\(\);/);
  });
});
