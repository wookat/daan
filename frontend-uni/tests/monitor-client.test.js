import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { classifyVueError, createErrorReporter, installVueErrorHandler } from '../src/monitor-client.js';

describe('createErrorReporter', () => {
  it('同 message 只上报一次，单页最多 10 条', () => {
    const send = vi.fn();
    const report = createErrorReporter(send);
    expect(report('a', 's1')).toBe(true);
    expect(report('a', 's2')).toBe(false);
    for (let i = 0; i < 20; i++) report(`m${i}`);
    expect(send).toHaveBeenCalledTimes(10);
    expect(send.mock.calls[0][0]).toEqual({ message: 'a', stack: 's1' });
  });

  it('send 抛错不冒泡', () => {
    const report = createErrorReporter(() => {
      throw new Error('boom');
    });
    expect(() => report('x')).not.toThrow();
  });
});

describe('installVueErrorHandler', () => {
  it('async 页面 chunk 超时（uni h5 每页 defineAsyncComponent）归类 chunk-timeout 并上报 + 保留 console 输出', () => {
    const app = { config: {} };
    const report = vi.fn();
    const consoleError = vi.fn();
    installVueErrorHandler(app, report, consoleError);
    const err = new Error('Async component timed out after 20000ms.');
    app.config.errorHandler(err, null, 'async component loader');
    expect(report).toHaveBeenCalledWith('vue:chunk-timeout:async component loader: Async component timed out after 20000ms.', err.stack);
    expect(consoleError).toHaveBeenCalledWith(err);
  });

  it('chunk 拉取失败（发版后旧 hash 404）归类 chunk-load；其余归 vue；非 Error 值包装', () => {
    expect(classifyVueError('Failed to fetch dynamically imported module: https://x/assets/a.js')).toBe('chunk-load');
    expect(classifyVueError('Unable to preload CSS for /assets/a.css')).toBe('chunk-load');
    expect(classifyVueError("Cannot read properties of undefined (reading 'x')")).toBe('vue');
    const app = { config: {} };
    const report = vi.fn();
    installVueErrorHandler(app, report);
    app.config.errorHandler('plain string', null, '');
    expect(report.mock.calls[0][0]).toBe('vue:vue: plain string');
  });

  it('保留既有 errorHandler 链式调用', () => {
    const prev = vi.fn();
    const app = { config: { errorHandler: prev } };
    installVueErrorHandler(app, vi.fn());
    const err = new Error('e');
    app.config.errorHandler(err, 'inst', 'info');
    expect(prev).toHaveBeenCalledWith(err, 'inst', 'info');
  });
});

describe('manifest h5.async.timeout', () => {
  it('页面 chunk 超时阈值 20s（与 API GET 二次重试超时对齐），不再用 uni 默认 60s', () => {
    const raw = readFileSync(fileURLToPath(new URL('../src/manifest.json', import.meta.url)), 'utf8');
    const json = JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
    expect(json.h5.async.timeout).toBe(20000);
  });
});
