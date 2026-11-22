import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { md } from '../src/utils/md.js';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

function extractExportFn(src, name) {
  const start = src.indexOf(`export function ${name}(`);
  if (start < 0) throw new Error(`export function ${name} not found`);
  const closeParen = src.indexOf(')', start);
  let depth = 0;
  let i = src.indexOf('{', closeParen);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start + 'export '.length, i + 1);
    }
  }
  throw new Error(`unclosed function ${name}`);
}

describe('审计 P0-5/P0-6 管理后台 XSS、存储与样式别名回归', () => {
  it('Admin.esc() 显式转义 & < > " \' 防止属性逃逸 XSS', () => {
    const coreSrc = read('../../backend/app/admin/core.js');
    const storage = new Map();
    const makeStore = () => ({
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    });
    const sandbox = {
      window: {},
      document: {
        addEventListener: () => {},
        querySelectorAll: () => [],
        getElementById: () => null,
      },
      localStorage: makeStore(),
      sessionStorage: makeStore(),
      location: { hash: '' },
      console,
    };
    vm.runInNewContext(coreSrc, sandbox);
    const esc = sandbox.window.Admin.esc;
    expect(typeof esc).toBe('function');
    expect(esc(`"><img src=x onerror='alert(1)'>&`)).toBe(
      '&quot;&gt;&lt;img src=x onerror=&#39;alert(1)&#39;&gt;&amp;'
    );
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('管理后台 token 迁移到 sessionStorage，index.html 无内联 Admin.boot() 脚本', () => {
    const coreSrc = read('../../backend/app/admin/core.js');
    const indexHtml = read('../../backend/app/admin/index.html');
    expect(coreSrc).toContain('sessionStorage.setItem');
    expect(coreSrc).toContain("localStorage.removeItem('admToken')");
    expect(coreSrc).toContain("addEventListener('DOMContentLoaded'");
    expect(indexHtml).not.toMatch(/<script>\s*Admin\.boot\(/);
  });

  it('admin.css 补齐 --brand / --line / .drawer-h/.drawer-b/.drawer-f / select.sel 与 toast pointer-events', () => {
    const css = read('../../backend/app/admin/admin.css');
    expect(css).toMatch(/--brand:\s*var\(--brand-500\)/);
    expect(css).toMatch(/--line:\s*var\(--border\)/);
    expect(css).toContain('.drawer-h');
    expect(css).toContain('.drawer-b');
    expect(css).toContain('.drawer-f');
    expect(css).toContain('select.sel');
    expect(css).toMatch(/\.toast\s*\{[^}]*pointer-events:\s*none/);
  });

  it('admin 页面不再裸插未转义的 k / c.code / b.batch', () => {
    const batches = read('../../backend/app/admin/pages/batches.js');
    const reports = read('../../backend/app/admin/pages/reports.js');
    const review = read('../../backend/app/admin/pages/review.js');
    expect(batches).toContain('data-open="${esc(b.batch)}"');
    expect(batches).toContain('<b>${esc(k)}.</b>');
    expect(reports).toContain('<b>${esc(k)}.</b>');
    expect(review).toContain('data-code="${esc(c.code)}"');
    expect(review).toContain('<b>${esc(k)}.</b>');
  });
});

describe('审计 P1 H5 API / SW / Capacitor / 路由 / 计时器 / 数据安全回归', () => {
  let prevUni;
  let prevWindow;

  beforeEach(() => {
    prevUni = globalThis.uni;
    prevWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.uni = prevUni;
    globalThis.window = prevWindow;
    vi.restoreAllMocks();
  });

  it('scanSheet 上传答题卡时携带 Authorization / X-Access-Code / X-Kg-Session 头，403 时清登录态', async () => {
    const aiSrc = read('../src/api/ai.js');
    const fnSrc = extractExportFn(aiSrc, 'scanSheet');
    let capturedOpts = null;
    let cleared = 0;
    const uploadMock = (opts) => {
      capturedOpts = opts;
      opts.success({ statusCode: 200, data: JSON.stringify({ ok: true }) });
    };
    const scanSheet = new Function(
      'uni', 'BASE_URL', 'getAccessCode', 'sessionId', 'authHeader', 'classifyHttpError', 'getToken', 'clearAuth', 'netFailMessage',
      `${fnSrc}; return scanSheet;`
    )(
      { uploadFile: uploadMock },
      'https://kaogong.zalize.com',
      () => 'code-xyz',
      () => 'sess-001',
      () => ({ Authorization: 'Bearer tok-abc' }),
      ({ status, detail }) => ({ authExpired: status === 403, message: detail || `HTTP ${status}` }),
      () => 'tok-abc',
      () => { cleared += 1; },
      (_, fb) => fb
    );

    const res = await scanSheet({ filePath: '/tmp/sheet.jpg', uid: 'u123' });
    expect(res).toEqual({ ok: true });
    expect(capturedOpts.header.Authorization).toBe('Bearer tok-abc');
    expect(capturedOpts.header['X-Access-Code']).toBe('code-xyz');
    expect(capturedOpts.header['X-Kg-Session']).toBe('sess-001');
    expect(cleared).toBe(0);
  });

  it('canonicalizeSharePath 保留 /app/ basePath 与 window.history.state', () => {
    const playSrc = read('../src/api/play.js');
    const fnSrc = extractExportFn(playSrc, 'canonicalizeSharePath');
    const calls = [];
    const listeners = {};
    const stateObj = { position: 3, current: '/pkgA/share/q' };
    const winStub = {
      location: { pathname: '/app/', hash: '#/pages/home/home' },
      history: {
        state: stateObj,
        replaceState: (st, title, url) => calls.push({ st, title, url }),
      },
      addEventListener: (ev, fn) => { listeners[ev] = fn; },
    };
    const canonicalizeSharePath = new Function('window', `${fnSrc}; return canonicalizeSharePath;`)(winStub);
    canonicalizeSharePath('/s/abc123');
    expect(calls[0]).toEqual({ st: stateObj, title: '', url: '/s/abc123' });
    expect(typeof listeners.hashchange).toBe('function');
    listeners.hashchange();
    expect(calls[1]).toEqual({ st: stateObj, title: '', url: '/app/#/pages/home/home' });
  });

  it('main.js staleShellHeal 不再硬编码 fetch(\'/\')，且 Capacitor 原生壳跳过 SW 注册', () => {
    const mainSrc = read('../src/main.js');
    expect(mainSrc).not.toMatch(/fetch\(['"]\/['"]/);
    expect(mainSrc).toContain('import.meta.env.BASE_URL');
    expect(mainSrc).toContain('Capacitor');
    expect(mainSrc).toContain('isNativePlatform');
  });

  it('sw.js 升级到 kg-app-v3 并按 registration.scope 动态推导 SHELL_PATH', () => {
    const swSrc = read('../src/static/sw.js');
    expect(swSrc).toContain("const CACHE = 'kg-app-v3'");
    expect(swSrc).toContain('self.registration');
  });

  it('capacitor.config.json 使用 https androidScheme，build:android 设置 KG_H5_BASE=/', () => {
    const cap = JSON.parse(read('../capacitor.config.json'));
    const pkg = JSON.parse(read('../package.json'));
    expect(cap.server.androidScheme).toBe('https');
    expect(pkg.scripts['build:android']).toContain('KG_H5_BASE=/');
  });

  it('pomo.vue 改用绝对截止时间戳 _endAt 并在 onHide 停表，避免后台双扣时间', () => {
    const pomoSrc = read('../src/pages/stats/pomo.vue');
    expect(pomoSrc).toContain('_endAt');
    expect(pomoSrc).toContain('Math.ceil((this._endAt - Date.now()) / 1000)');
    expect(pomoSrc).toMatch(/onHide\(\)\s*\{[^}]*_stopTick\(\)/);
  });

  it('practice.vue onUnload 清理 autoTimer / _loadTick / examTimer / stopQTimer / _actx', () => {
    const src = read('../src/pages/practice/practice.vue');
    const m = src.match(/onUnload\(\)\s*\{[\s\S]*?\n\s*\},/);
    expect(m).toBeTruthy();
    const body = m[0];
    expect(body).toContain('autoTimer');
    expect(body).toContain('_loadTick');
    expect(body).toContain('examTimer');
    expect(body).toContain('stopQTimer');
    expect(body).toContain('_actx');
  });

  it('profile.vue doRestore 使用 RESTORE_ALLOW 白名单，拒绝写入 authToken/anonUid 等敏感键', () => {
    const src = read('../src/pages/profile/profile.vue');
    expect(src).toContain('RESTORE_ALLOW');
    const allowMatch = src.match(/RESTORE_ALLOW\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    expect(allowMatch).toBeTruthy();
    expect(allowMatch[1]).not.toContain('authToken');
    expect(allowMatch[1]).not.toContain('admToken');
    expect(allowMatch[1]).not.toContain('anonUid');
  });

  it('md.js 使用 CSS 变量保证深色模式可读性，且表格带横向滚动容器', () => {
    const html = md('## 标题\n\n`code` **bold**\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('var(--');
    expect(html).toContain('overflow-x:auto');
    expect(html).not.toContain('color:#333');
    expect(html).not.toContain('background:#f0f2f8');
  });

  it('landing/index.html 口径统一为 16万+ / 600+ 且移除移动端 hero-visual order:-1', () => {
    const landing = read('../../landing/index.html');
    expect(landing).toContain('16万+');
    expect(landing).toContain('600+');
    expect(landing).not.toContain('语音输入作答');
    expect(landing).not.toContain('order: -1');
    expect(landing).toContain('aria-label="内测反馈内容"');
    expect(landing).toContain('aria-label="联系方式（选填）"');
  });
});
