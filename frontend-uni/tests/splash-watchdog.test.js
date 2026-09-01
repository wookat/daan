// 启动屏内联 watchdog 回归（R194 失败态+重试、R195 role=alert/焦点直达）。
// index.html 内联 IIFE 无 export，以源码 + 注入桩 window/document 的方式在沙箱内执行。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const m = html.match(/<script>\s*(\(function \(\) \{[\s\S]*?__kgSplashOk[\s\S]*?\}\)\(\))\s*<\/script>/);
if (!m) throw new Error('index.html 中未找到 watchdog 内联脚本');
const src = m[1];

function el(tag) {
  const classes = new Set();
  return {
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    type: '',
    src: '',
    onclick: null,
    children: [],
    attrs: {},
    focused: false,
    classList: {
      add: (c) => classes.add(c),
      contains: (c) => classes.has(c),
    },
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    appendChild(c) {
      this.children.push(c);
    },
    focus() {
      this.focused = true;
    },
  };
}

function boot({ splash = el('div') } = {}) {
  const listeners = {};
  const win = {
    addEventListener: (type, fn) => (listeners[type] = fn),
  };
  const doc = {
    getElementById: (id) => (id === 'kg-splash' ? splash : null),
    createElement: (tag) => el(tag),
  };
  new Function('window', 'document', 'location', 'setTimeout', 'clearTimeout', src)(
    win,
    doc,
    { reload: () => {} },
    setTimeout,
    clearTimeout
  );
  return { win, listeners, splash };
}

const failParts = (splash) => ({
  alert: splash.children.find((c) => c.attrs.role === 'alert'),
  btn: splash.children.find((c) => c.tagName === 'BUTTON'),
});

describe('index.html 启动屏 watchdog', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('20s 超时触发失败态：kg-splash-fail + role=alert + 重试按钮获焦', () => {
    const { splash } = boot();
    vi.advanceTimersByTime(20000);
    expect(splash.classList.contains('kg-splash-fail')).toBe(true);
    const { alert, btn } = failParts(splash);
    expect(alert.textContent).toContain('加载失败');
    expect(btn.textContent).toBe('重新加载');
    expect(btn.focused).toBe(true);
  });

  it('__kgSplashOk 后超时不再触发失败态', () => {
    const { win, splash } = boot();
    win.__kgSplashOk();
    vi.advanceTimersByTime(30000);
    expect(splash.classList.contains('kg-splash-fail')).toBe(false);
    expect(splash.children.length).toBe(0);
  });

  it('/assets/ script 加载失败立即触发失败态，不等 20s', () => {
    const { listeners, splash } = boot();
    const bad = el('script');
    bad.src = 'https://kaogong.zalize.com/assets/index-abc.js';
    listeners.error({ target: bad });
    expect(splash.classList.contains('kg-splash-fail')).toBe(true);
  });

  it('失败态幂等：script error + 超时双触发只注入一次提示/按钮', () => {
    const { listeners, splash } = boot();
    const bad = el('script');
    bad.src = '/assets/index-abc.js';
    listeners.error({ target: bad });
    vi.advanceTimersByTime(20000);
    expect(splash.children.length).toBe(2);
  });

  it('非 assets script 的 error 不触发失败态', () => {
    const { listeners, splash } = boot();
    const img = el('img');
    img.src = '/static/logo.png';
    listeners.error({ target: img });
    const other = el('script');
    other.src = 'https://career.zalize.com/x.js';
    listeners.error({ target: other });
    expect(splash.classList.contains('kg-splash-fail')).toBe(false);
  });

  it('启动屏已 kg-splash-done 时超时不注入失败态', () => {
    const splash = el('div');
    splash.classList.add('kg-splash-done');
    boot({ splash });
    vi.advanceTimersByTime(20000);
    expect(splash.classList.contains('kg-splash-fail')).toBe(false);
    expect(splash.children.length).toBe(0);
  });
});
