import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGetCache, getTtl, isTrackPath, GET_TTL_DEFAULT } from '../src/api-get-cache.js';

const api = readdirSync(fileURLToPath(new URL('../src/api/', import.meta.url))).filter((f)=>f.endsWith('.js')).sort().map((f)=>readFileSync(fileURLToPath(new URL('../src/api/'+f, import.meta.url)),'utf8')).join('\n');
const reqBody = api.slice(api.indexOf('export function request('), api.indexOf('export function anonUid('));

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const U = 'test-w15-a';
const K = '/api/growth?uid=' + U;

describe('getTtl：只读白名单才有 TTL', () => {
  it('home_bundle/growth/plan/today/predict/checkin/summary/stats 及同类只读端点命中默认 3s', () => {
    for (const p of [
      '/api/home_bundle?uid=x',
      '/api/growth?uid=x',
      '/api/daily_plan?uid=x',
      '/api/plan/today?uid=x',
      '/api/predict?uid=x',
      '/api/checkin/summary?uid=x',
      '/api/checkin/badges?uid=x',
      '/api/stats?uid=x',
      '/api/stats',
      '/api/profile?uid=x',
      '/api/announcement',
      '/api/question_counts',
      '/api/daily_set',
      '/api/recommend?uid=x',
      '/api/mastery/map?uid=x',
      '/api/shenlun/stats?uid=x',
      '/api/exam/attempts?uid=x&limit=20',
    ]) {
      expect(getTtl(p), p).toBe(GET_TTL_DEFAULT);
    }
    expect(getTtl('/api/growth?uid=x', 1000)).toBe(1000);
  });

  it('非白名单 / 认证 / 后台 / 前缀相似路径 → 0（只合并不缓存）', () => {
    for (const p of [
      '/api/mistakes?uid=x',
      '/api/questions?n=5',
      '/api/statsx',
      '/api/auth/me',
      '/api/admin/stats',
      '/api/comments?question_id=1',
      '/api/review?uid=x',
      '/api/review/cur?uid=x',
      '/api/exam/resume?uid=x',
      '/api/practice/resume?uid=x',
      '/api/daily_set/board?uid=x',
      null,
    ]) {
      expect(getTtl(p), String(p)).toBe(0);
    }
  });
});

describe('isTrackPath：埋点 POST 不作废读缓存', () => {
  it('仅 /api/track 本身命中', () => {
    expect(isTrackPath('/api/track')).toBe(true);
    expect(isTrackPath('/api/track?x=1')).toBe(true);
    for (const p of ['/api/tracker', '/api/track/x', '/api/answer', '/api/checkin', null]) expect(isTrackPath(p), String(p)).toBe(false);
  });
});

describe('createGetCache', () => {
  it('并发同 GET 只发 1 次，全部调用方拿到同一结果', async () => {
    const c = createGetCache();
    const d = deferred();
    const fetch = vi.fn(() => d.promise);
    const p1 = c.run(K, U, 0, fetch);
    const p2 = c.run(K, U, 0, fetch);
    const p3 = c.run('/api/growth?uid=test-w15-b', 'test-w15-a', 0, fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(p1).toBe(p2);
    d.resolve({ ok: 1 });
    expect(await p1).toEqual({ ok: 1 });
    expect(await p2).toEqual({ ok: 1 });
    await p3.catch(() => {});
    expect(c.size()).toBe(0);
  });

  it('ttl=0：settle 后再调用重新发请求（无结果缓存）', async () => {
    const c = createGetCache();
    const fetch = vi.fn(() => Promise.resolve(1));
    await c.run(K, U, 0, fetch);
    await c.run(K, U, 0, fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('TTL 内命中不发请求，过期后重新发', async () => {
    let t = 1000;
    const c = createGetCache({ now: () => t });
    const fetch = vi.fn(() => Promise.resolve({ n: fetch.mock.calls.length }));
    expect(await c.run(K, U, 3000, fetch)).toEqual({ n: 1 });
    t += 2999;
    expect(await c.run(K, U, 3000, fetch)).toEqual({ n: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    t += 1;
    expect(await c.run(K, U, 3000, fetch)).toEqual({ n: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('失败不入缓存：reject 后下一次照常发', async () => {
    const c = createGetCache();
    const fetch = vi.fn().mockRejectedValueOnce(new Error('请求超时')).mockResolvedValueOnce('ok');
    await expect(c.run(K, U, 3000, fetch)).rejects.toThrow('请求超时');
    expect(await c.run(K, U, 3000, fetch)).toBe('ok');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('uid 变化：TTL 命中与在途 Promise 一并失效，旧身份在途结果不入新身份缓存', async () => {
    const c = createGetCache();
    const d = deferred();
    const fetch = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValue('new');
    const old = c.run(K, 'test-w15-old', 3000, fetch);
    const fresh = c.run(K, 'test-w15-new', 3000, fetch);
    expect(fresh).not.toBe(old);
    expect(fetch).toHaveBeenCalledTimes(2);
    d.resolve('old');
    expect(await old).toBe('old');
    expect(await fresh).toBe('new');
    expect(await c.run(K, 'test-w15-new', 3000, fetch)).toBe('new');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('clear（写请求后）：TTL 清空且 clear 前发起的在途结果不再入缓存', async () => {
    const c = createGetCache();
    const d = deferred();
    const fetch = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2').mockReturnValueOnce(d.promise).mockResolvedValueOnce('v3');
    expect(await c.run(K, U, 3000, fetch)).toBe('v1');
    c.clear();
    expect(await c.run(K, U, 3000, fetch)).toBe('v2');
    c.clear();
    const p = c.run(K, U, 3000, fetch);
    c.clear();
    d.resolve('stale');
    expect(await p).toBe('stale');
    expect(await c.run(K, U, 3000, fetch)).toBe('v3');
  });
});

describe('api.js request() 接线源锁', () => {
  it('非 GET 与带 opts.timeout 的 GET 不进合并层，且写请求发起时与落地后各清空缓存一次（埋点除外）', () => {
    expect(reqBody).toMatch(
      /if \(method !== 'GET'\) \{\s*if \(isTrackPath\(path\)\) return withAuthRetry\(\(\) => rawRequest\(path, opts\)\);\s*getCache\.clear\(\);\s*return withAuthRetry\(\(\) => rawRequest\(path, opts\)\)\.finally\(\(\) => getCache\.clear\(\)\);\s*\}/
    );
    expect(reqBody).toMatch(/if \(opts\.timeout != null\) return withAuthRetry\(\(\) => rawRequest\(path, opts\)\.then/);
  });

  it('默认 GET：getCache.run(key, anonUid, ttl) 包住 12s→20s 超时重试 + guardStaleUid + snapSave；key 含 opts.data', () => {
    expect(reqBody).toMatch(/const ttl = opts\.ttl != null \? opts\.ttl : getTtl\(path\)/);
    expect(reqBody).toMatch(/const key = opts\.data == null \? path : path \+ '#' \+ JSON\.stringify\(opts\.data\)/);
    expect(reqBody).toMatch(/getCache\s*\.run\(key, uni\.getStorageSync\('anonUid'\), ttl, \(\) =>\s*rawRequest\(path, \{ \.\.\.opts, timeout: 12000 \}\)/);
    const run = reqBody.indexOf('.run(');
    const retry = reqBody.indexOf('timeout: 20000');
    const guard = reqBody.indexOf('guardStaleUid(path, data)');
    const save = reqBody.indexOf('snapSave(path, data)');
    const fallback = reqBody.indexOf('snapLoad(path)');
    expect(run).toBeGreaterThan(0);
    expect(retry).toBeGreaterThan(run);
    expect(guard).toBeGreaterThan(retry);
    expect(save).toBeGreaterThan(guard);
    expect(fallback).toBeGreaterThan(save);
  });

  it('快照回退仍在合并层之外、仅网络错误触发', () => {
    expect(reqBody).toMatch(/\.catch\(\(e\) => \{\s*\/\/[^\n]*\n\s*if \(!isNetErr\(e\) \|\| !snapCacheable\(path\)\) throw e;\s*const snap = snapLoad\(path\);/);
    expect(api).toMatch(/import \{ createGetCache, getTtl, isTrackPath \} from '\.\.?\/api-get-cache'/);
  });
});
