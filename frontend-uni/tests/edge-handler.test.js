import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onRequest } from '../../deploy/cf-pages/functions/[[path]].js';

// onRequest 集成级回归：桩 caches.default / fetch / waitUntil，
// 覆盖 HIT / SWR / stale-if-error / 无副本重试 / 边缘 304 / 爬虫拦截 / 安全头。

const EDGE = 'https://kaogong.zalize.com';

function makeCaches() {
  const store = new Map();
  return {
    store,
    default: {
      match: async (key) => {
        const hit = store.get(typeof key === 'string' ? key : key.url);
        return hit ? hit.clone() : undefined;
      },
      put: async (key, resp) => {
        store.set(typeof key === 'string' ? key : key.url, resp);
      },
      delete: async (key) => store.delete(typeof key === 'string' ? key : key.url),
    },
  };
}

function ctx(request, env = {}) {
  const pending = [];
  return {
    args: { request, env, waitUntil: (p) => pending.push(p) },
    flush: () => Promise.all(pending),
  };
}

function originOk(body = '<html>ok</html>', headers = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

function queueFetch(...results) {
  const calls = [];
  const fn = vi.fn(async (req) => {
    calls.push(req);
    const r = results.shift();
    if (r instanceof Error) throw r;
    return r;
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

let cachesStub;

beforeEach(() => {
  vi.useFakeTimers();
  cachesStub = makeCaches();
  vi.stubGlobal('caches', cachesStub);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// 重试路径含 1200ms 退避：假时钟推进 + 等待 handler 完成
async function run(promise) {
  await vi.runAllTimersAsync();
  return promise;
}

describe('onRequest 爬虫拦截与安全头', () => {
  it('禁抓 UA 直接 403，不回源', async () => {
    const { fn } = queueFetch();
    const { args } = ctx(
      new Request(`${EDGE}/tiku/q/1`, { headers: { 'User-Agent': 'SemrushBot/7' } })
    );
    const resp = await onRequest(args);
    expect(resp.status).toBe(403);
    expect(fn).not.toHaveBeenCalled();
  });

  it('MISS 直出带安全头；/api 路由带 X-Robots-Tag noindex', async () => {
    queueFetch(originOk(), new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    const a = ctx(new Request(`${EDGE}/tiku/`));
    const r1 = await run(onRequest(a.args));
    expect(r1.headers.get('Strict-Transport-Security')).toBeTruthy();
    expect(r1.headers.get('X-Robots-Tag')).toBeNull();
    const b = ctx(new Request(`${EDGE}/api/question_counts`));
    const r2 = await run(onRequest(b.args));
    expect(r2.headers.get('X-Robots-Tag')).toContain('noindex');
  });
});

describe('onRequest 缓存生命周期', () => {
  it('MISS 200 入缓存：副本带 X-Kg-Cached-At、剥 Set-Cookie；对外 Cache-Control=TTL', async () => {
    queueFetch(originOk('<html>v1</html>', { 'Set-Cookie': 'sid=1' }));
    const a = ctx(new Request(`${EDGE}/tiku/`));
    const resp = await run(onRequest(a.args));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('X-Edge-Cache')).toBe('MISS');
    expect(resp.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(await resp.text()).toBe('<html>v1</html>');
    await a.flush();
    const copy = cachesStub.store.get(`${EDGE}/tiku/`);
    expect(copy.headers.get('X-Kg-Cached-At')).toBeTruthy();
    expect(copy.headers.get('Set-Cookie')).toBeNull();
  });

  it('TTL 内二访 HIT 不回源', async () => {
    const { fn } = queueFetch(originOk('<html>v1</html>'));
    const a = ctx(new Request(`${EDGE}/tiku/`));
    await run(onRequest(a.args));
    await a.flush();
    const b = ctx(new Request(`${EDGE}/tiku/`));
    const resp = await run(onRequest(b.args));
    expect(resp.headers.get('X-Edge-Cache')).toBe('HIT');
    expect(await resp.text()).toBe('<html>v1</html>');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('TTL 过期 SWR：立即回旧副本 + 后台刷新覆盖', async () => {
    queueFetch(originOk('<html>v1</html>'), originOk('<html>v2</html>'));
    const a = ctx(new Request(`${EDGE}/tiku/`));
    await run(onRequest(a.args));
    await a.flush();
    vi.setSystemTime(Date.now() + 301 * 1000);
    const b = ctx(new Request(`${EDGE}/tiku/`));
    const resp = await run(onRequest(b.args));
    expect(resp.headers.get('X-Edge-Cache')).toBe('REVALIDATE');
    expect(await resp.text()).toBe('<html>v1</html>');
    await b.flush();
    const copy = cachesStub.store.get(`${EDGE}/tiku/`);
    expect(await copy.clone().text()).toBe('<html>v2</html>');
  });

  it('后台刷新遇 5xx 不覆盖旧副本（stale-if-error）', async () => {
    queueFetch(originOk('<html>v1</html>'), new Response('bad', { status: 502 }));
    const a = ctx(new Request(`${EDGE}/tiku/`));
    await run(onRequest(a.args));
    await a.flush();
    vi.setSystemTime(Date.now() + 301 * 1000);
    const b = ctx(new Request(`${EDGE}/tiku/`));
    await run(onRequest(b.args));
    await b.flush();
    const copy = cachesStub.store.get(`${EDGE}/tiku/`);
    expect(await copy.clone().text()).toBe('<html>v1</html>');
  });

  it('后台刷新遇 404 清除旧副本：下架内容不再以陈旧 200 外泄（R232）', async () => {
    queueFetch(
      originOk('<html>v1</html>'),
      new Response('gone', { status: 404, headers: { 'content-type': 'text/html' } }),
      new Response('gone', { status: 404, headers: { 'content-type': 'text/html' } })
    );
    const a = ctx(new Request(`${EDGE}/tiku/shenlun/`));
    await run(onRequest(a.args));
    await a.flush();
    vi.setSystemTime(Date.now() + 301 * 1000);
    const b = ctx(new Request(`${EDGE}/tiku/shenlun/`));
    const resp = await run(onRequest(b.args));
    expect(resp.headers.get('X-Edge-Cache')).toBe('REVALIDATE'); // 本次仍回旧副本
    await b.flush();
    expect(cachesStub.store.has(`${EDGE}/tiku/shenlun/`)).toBe(false); // 副本已清除
    const c = ctx(new Request(`${EDGE}/tiku/shenlun/`));
    expect((await run(onRequest(c.args))).status).toBe(404); // 下一请求同步回源拿到 404
  });
});

describe('onRequest 无副本回源重试（R205）', () => {
  it('fetch 异常后重试一次成功 200', async () => {
    const { fn } = queueFetch(new Error('connect refused'), originOk('<html>up</html>'));
    const a = ctx(new Request(`${EDGE}/tiku/panduan/?page=201`));
    const resp = await run(onRequest(a.args));
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('<html>up</html>');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('页面请求连续两次 fetch 异常 → 品牌 503 + Retry-After（R218）', async () => {
    queueFetch(new Error('down'), new Error('down'));
    const a = ctx(new Request(`${EDGE}/tiku/`));
    const resp = await run(onRequest(a.args));
    expect(resp.status).toBe(503);
    expect(resp.headers.get('Retry-After')).toBe('30');
    expect(resp.headers.get('Cache-Control')).toBe('no-store');
    expect(resp.headers.get('Strict-Transport-Security')).toBeTruthy();
    expect(await resp.text()).toContain('服务暂时不可用');
  });

  it('POST fetch 异常仍向上抛出（不出 503 页）', async () => {
    queueFetch(new Error('down'));
    const a = ctx(new Request(`${EDGE}/tiku/export`, { method: 'POST', body: '{}' }));
    const p = onRequest(a.args);
    p.catch(() => {}); // 立即挂接，避免假时钟推进期间成为未处理拒绝
    await vi.runAllTimersAsync();
    await expect(p).rejects.toThrow('down');
  });

  it('页面 502 重试耗尽 → 品牌 503；/api 502 仍原样透传（R218）', async () => {
    let q = queueFetch(new Response('bad', { status: 502 }), new Response('bad', { status: 502 }));
    let a = ctx(new Request(`${EDGE}/tiku/panduan/?page=254`));
    let resp = await run(onRequest(a.args));
    expect(resp.status).toBe(503);
    expect(resp.headers.get('Retry-After')).toBe('30');
    expect(q.fn).toHaveBeenCalledTimes(2);

    q = queueFetch(new Response('bad', { status: 502 }), new Response('bad', { status: 502 }));
    a = ctx(new Request(`${EDGE}/api/question_counts?x=1`));
    resp = await run(onRequest(a.args));
    expect(resp.status).toBe(502);
    expect(await resp.text()).toBe('bad');
  });

  it('502 重试成功；500 不重试原样透传；POST 不重试', async () => {
    let q = queueFetch(new Response('bad', { status: 502 }), originOk('<html>ok</html>'));
    let a = ctx(new Request(`${EDGE}/tiku/a/`));
    expect((await run(onRequest(a.args))).status).toBe(200);
    expect(q.fn).toHaveBeenCalledTimes(2);

    q = queueFetch(new Response('err', { status: 500 }));
    a = ctx(new Request(`${EDGE}/tiku/b/`));
    expect((await run(onRequest(a.args))).status).toBe(500);
    expect(q.fn).toHaveBeenCalledTimes(1);

    q = queueFetch(new Response('bad', { status: 502 }));
    a = ctx(new Request(`${EDGE}/api/track`, { method: 'POST', body: '{}' }));
    expect((await run(onRequest(a.args))).status).toBe(502);
    expect(q.fn).toHaveBeenCalledTimes(1);
  });

  it('SWR 后台回源 fetch 异常不覆盖旧副本，前台仍即时回旧副本', async () => {
    const { fn } = queueFetch(originOk('<html>v1</html>'), new Error('down'));
    const a = ctx(new Request(`${EDGE}/tiku/`));
    await run(onRequest(a.args));
    await a.flush();
    vi.setSystemTime(Date.now() + 301 * 1000);
    const b = ctx(new Request(`${EDGE}/tiku/`));
    const resp = await run(onRequest(b.args));
    expect(resp.headers.get('X-Edge-Cache')).toBe('REVALIDATE');
    await b.flush();
    expect(await cachesStub.store.get(`${EDGE}/tiku/`).clone().text()).toBe('<html>v1</html>');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('onRequest 回源模式头 X-Kg-Fetch（R226）', () => {
  it('可缓存路径无副本同步回源 → miss；不可缓存 /api → pass', async () => {
    const a = ctx(new Request(`${EDGE}/tiku/`));
    let q = queueFetch(originOk());
    await run(onRequest(a.args));
    expect(q.calls[0].headers.get('X-Kg-Fetch')).toBe('miss');

    q = queueFetch(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    const b = ctx(new Request(`${EDGE}/api/stats`));
    await run(onRequest(b.args));
    expect(q.calls[0].headers.get('X-Kg-Fetch')).toBe('pass');
  });

  it('TTL 过期后台刷新 → swr', async () => {
    const q = queueFetch(originOk('<html>v1</html>'), originOk('<html>v2</html>'));
    const a = ctx(new Request(`${EDGE}/tiku/`));
    await run(onRequest(a.args));
    await a.flush();
    vi.setSystemTime(Date.now() + 301 * 1000);
    const b = ctx(new Request(`${EDGE}/tiku/`));
    await run(onRequest(b.args));
    await b.flush();
    expect(q.calls[1].headers.get('X-Kg-Fetch')).toBe('swr');
  });

  it('无副本 502 重试第二跳 → retry（首跳仍为 miss）', async () => {
    const q = queueFetch(new Response('bad', { status: 502 }), originOk('<html>ok</html>'));
    const a = ctx(new Request(`${EDGE}/tiku/c/`));
    await run(onRequest(a.args));
    expect(q.calls[0].headers.get('X-Kg-Fetch')).toBe('miss');
    expect(q.calls[1].headers.get('X-Kg-Fetch')).toBe('retry');
  });
});

describe('onRequest shell 静态件边缘缓存（R273）', () => {
  const js = (body) =>
    new Response(body, { status: 200, headers: { 'content-type': 'application/javascript' } });
  const json = (body) =>
    new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });

  it('/sw.js MISS 200 js 入缓存、对外 max-age=60；TTL 内二访 HIT 不回源', async () => {
    const { fn } = queueFetch(js('self.x=1'));
    const a = ctx(new Request(`${EDGE}/sw.js`));
    const resp = await run(onRequest(a.args));
    expect(resp.headers.get('X-Edge-Cache')).toBe('MISS');
    expect(resp.headers.get('Cache-Control')).toBe('public, max-age=60');
    await a.flush();
    expect(cachesStub.store.has(`${EDGE}/sw.js`)).toBe(true);
    const b = ctx(new Request(`${EDGE}/sw.js`));
    const hit = await run(onRequest(b.args));
    expect(hit.headers.get('X-Edge-Cache')).toBe('HIT');
    expect(await hit.text()).toBe('self.x=1');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('/sw.js origin 回 HTML → 直出但不写副本（content-type 守卫防投毒）', async () => {
    queueFetch(originOk('<html>fallback</html>'));
    const a = ctx(new Request(`${EDGE}/sw.js`));
    const resp = await run(onRequest(a.args));
    expect(resp.status).toBe(200);
    await a.flush();
    expect(cachesStub.store.has(`${EDGE}/sw.js`)).toBe(false);
  });

  it('/precache.json HTML 不写副本；JSON 200 正常入缓存', async () => {
    queueFetch(originOk('<html>oops</html>'));
    const a = ctx(new Request(`${EDGE}/precache.json`));
    await run(onRequest(a.args));
    await a.flush();
    expect(cachesStub.store.has(`${EDGE}/precache.json`)).toBe(false);

    queueFetch(json('["/static/a.js"]'));
    const b = ctx(new Request(`${EDGE}/precache.json`));
    const resp = await run(onRequest(b.args));
    expect(resp.headers.get('Cache-Control')).toBe('public, max-age=60');
    await b.flush();
    expect(cachesStub.store.has(`${EDGE}/precache.json`)).toBe(true);
  });

  it('/sw.js TTL 过期 + origin 5xx → SWR 回旧副本且不被覆盖（stale-if-error）', async () => {
    queueFetch(js('self.v=1'), new Response('bad', { status: 503 }));
    const a = ctx(new Request(`${EDGE}/sw.js`));
    await run(onRequest(a.args));
    await a.flush();
    vi.setSystemTime(Date.now() + 61 * 1000);
    const b = ctx(new Request(`${EDGE}/sw.js`));
    const resp = await run(onRequest(b.args));
    expect(resp.headers.get('X-Edge-Cache')).toBe('REVALIDATE');
    expect(await resp.text()).toBe('self.v=1');
    await b.flush();
    expect(await cachesStub.store.get(`${EDGE}/sw.js`).clone().text()).toBe('self.v=1');
  });
});

describe('onRequest 边缘条件请求 304', () => {
  it('HIT 命中 If-Modified-Since → 304 空 body', async () => {
    const lm = new Date(Date.now() - 1000).toUTCString();
    queueFetch(originOk('<html>v1</html>', { 'Last-Modified': lm }));
    const a = ctx(new Request(`${EDGE}/tiku/`));
    await run(onRequest(a.args));
    await a.flush();
    const b = ctx(new Request(`${EDGE}/tiku/`, { headers: { 'If-Modified-Since': lm } }));
    const resp = await run(onRequest(b.args));
    expect(resp.status).toBe(304);
    expect(resp.headers.get('Last-Modified')).toBe(lm);
    expect(await resp.text()).toBe('');
  });

  it('MISS 命中 If-None-Match → 304 且副本仍入缓存', async () => {
    queueFetch(originOk('<html>v1</html>', { ETag: '"abc"' }));
    const a = ctx(new Request(`${EDGE}/tiku/`, { headers: { 'If-None-Match': '"abc"' } }));
    const resp = await run(onRequest(a.args));
    expect(resp.status).toBe(304);
    await a.flush();
    const copy = cachesStub.store.get(`${EDGE}/tiku/`);
    expect(await copy.clone().text()).toBe('<html>v1</html>');
  });
});
