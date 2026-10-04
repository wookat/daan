// SW 离线壳导航分支回归：仅 2xx 回写壳缓存（R207）。
// sw.js 是 classic script（无 export），以源码 + 注入桩全局的方式在沙箱内执行。
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/static/sw.js', import.meta.url)), 'utf8');

const ORIGIN = 'https://kaogong.zalize.com';

function boot({ fetchImpl }) {
  const handlers = {};
  const store = new Map();
  const cache = {
    put: async (key, resp) => store.set(typeof key === 'string' ? key : key.url, resp),
    match: async (key) => store.get(typeof key === 'string' ? key : key.url),
    add: async () => {},
  };
  const caches = {
    open: async () => cache,
    match: async (key) => cache.match(key),
    keys: async () => [],
    delete: async () => true,
  };
  const self = {
    location: new URL(ORIGIN + '/'),
    addEventListener: (type, fn) => (handlers[type] = fn),
    skipWaiting: () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: { showNotification: async () => {} },
  };
  new Function('self', 'caches', 'fetch', src)(self, caches, fetchImpl);
  return { handlers, store };
}

function navEvent(url) {
  let responded;
  const pending = [];
  return {
    event: {
      request: { method: 'GET', url, mode: 'navigate' },
      respondWith: (p) => (responded = Promise.resolve(p)),
      waitUntil: (p) => pending.push(p),
    },
    result: () => responded,
  };
}

describe('sw.js 导航分支壳缓存回写', () => {
  let realResponse;
  beforeEach(() => {
    realResponse = (body, init) => new Response(body, init);
  });

  it('200 导航响应回写壳缓存', async () => {
    const { handlers, store } = boot({
      fetchImpl: async () => realResponse('<html>ok</html>', { status: 200 }),
    });
    const { event, result } = navEvent(ORIGIN + '/app/');
    handlers.fetch(event);
    const res = await result();
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    expect(store.has('/app/')).toBe(true);
  });

  it('502 导航响应直出但不污染壳缓存', async () => {
    const { handlers, store } = boot({
      fetchImpl: async () => realResponse('bad gateway', { status: 502 }),
    });
    const { event, result } = navEvent(ORIGIN + '/app/');
    handlers.fetch(event);
    const res = await result();
    expect(res.status).toBe(502);
    await new Promise((r) => setTimeout(r, 0));
    expect(store.has('/app/')).toBe(false);
  });

  it('fetch 异常时回退既有壳缓存副本', async () => {
    const { handlers, store } = boot({
      fetchImpl: async () => {
        throw new Error('offline');
      },
    });
    store.set('/app/', realResponse('<html>shell</html>', { status: 200 }));
    const { event, result } = navEvent(ORIGIN + '/app/');
    handlers.fetch(event);
    const res = await result();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>shell</html>');
  });

  it('/tiku 与 /api 路径不拦截', () => {
    const { handlers } = boot({ fetchImpl: async () => realResponse('', { status: 200 }) });
    for (const p of ['/tiku/', '/api/health', '/admin', '/s/x', '/p/1']) {
      const { event, result } = navEvent(ORIGIN + p);
      handlers.fetch(event);
      expect(result()).toBeUndefined();
    }
  });
});
