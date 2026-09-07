// R499：「403 先到、旧 uid 回包后到」飞行竞态——账号态页面并发发出多条带 uid 的 GET，其中一条撞
// 401/403 → api.js clearAuth()（anonUid 恢复为本机匿名 uid、$emit('authChanged')），R496–R498 的监听
// 只能清字段 + 重拉，管不住仍在飞行中的旧 uid 请求：其回包稍后到达时 .then/await 之后照样落到
// 页面态（个人页 180 累计做题）甚至 storage（问答页 askCurSession/askSessions 被旧账号内容覆盖，
// 再被 pushCurSession() 以匿名 uid 回推到远端）。生产 bundle CDP 运行时已复现（r499_race.py）。
// 修法：request() 层统一比对「发出时 path 里的 uid」与「回包时 storage anonUid」，不等即作废并以
// staleUid 标记 reject；tab 页 catch 对该标记静默（不 toast、不置 loadErr、不走兜底重拉）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pathUid, isStaleUidResponse, isStaleUidErr } from '../src/api-policy';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const api = read('../src/api.js');
const home = read('../src/pages/home/home.vue');
const book = read('../src/pages/book/book.vue');
const stats = read('../src/pages/stats/stats.vue');

describe('api-policy 旧身份回包判定（纯函数）', () => {
  it('pathUid 取 query 里的 uid（含 encode / 首参 / 非首参 / 无 uid）', () => {
    expect(pathUid('/api/growth?uid=u123')).toBe('u123');
    expect(pathUid('/api/mistakes?uid=u123&limit=1')).toBe('u123');
    expect(pathUid('/api/exam/attempts?limit=20&uid=' + encodeURIComponent('u a'))).toBe('u a');
    expect(pathUid('/api/ask/cur?uid=' + encodeURIComponent('umr499d1'))).toBe('umr499d1');
    expect(pathUid('/api/announcement')).toBeNull();
    expect(pathUid('/api/questions?limit=10&guid=x')).toBeNull();
  });

  it('发出 uid ≠ 当前 uid 才算旧身份；无 uid 的请求永不判旧', () => {
    expect(isStaleUidResponse('/api/growth?uid=u123', 'umr499d1')).toBe(true);
    expect(isStaleUidResponse('/api/growth?uid=u123', '')).toBe(true);
    expect(isStaleUidResponse('/api/growth?uid=u123', 'u123')).toBe(false);
    expect(isStaleUidResponse('/api/home_bundle?uid=umr499d1', 'umr499d1')).toBe(false);
    expect(isStaleUidResponse('/api/announcement', 'u123')).toBe(false);
  });

  it('isStaleUidErr 只认 staleUid 标记', () => {
    const e = new Error('账号已切换');
    e.staleUid = true;
    expect(isStaleUidErr(e)).toBe(true);
    expect(isStaleUidErr(new Error('网络错误'))).toBe(false);
    expect(isStaleUidErr(null)).toBe(false);
  });
});

describe('api.js request() GET 回包统一过旧身份守卫', () => {
  it('guardStaleUid 用回包时刻 storage anonUid 比对 path uid，不等则 reject 且带 staleUid', () => {
    const m = api.match(/function guardStaleUid\(path, data\) \{([\s\S]*?)\n\}/);
    expect(m).not.toBeNull();
    expect(m[1]).toMatch(/isStaleUidResponse\(path, uni\.getStorageSync\('anonUid'\)\)/);
    expect(m[1]).toMatch(/e\.staleUid = true;/);
    expect(m[1]).toMatch(/throw e;/);
  });

  it('默认 GET 链路在写快照之前先过守卫（旧身份回包不得进 snap 缓存）；显式 timeout 的 GET 亦过守卫', () => {
    const req = api.match(/\nexport function request\(path, opts = \{\}\) \{([\s\S]*?)\n\}/);
    expect(req).not.toBeNull();
    const body = req[1];
    const g = body.indexOf('guardStaleUid(path, data);');
    const s = body.indexOf('if (snapCacheable(path)) snapSave(path, data);');
    expect(g).toBeGreaterThan(-1);
    expect(s).toBeGreaterThan(g);
    expect(body).toMatch(/if \(opts\.timeout != null\) return withAuthRetry\(\(\) => rawRequest\(path, opts\)\.then\(\(d\) => guardStaleUid\(path, d\)\)\);/);
    expect(body).toMatch(/if \(method !== 'GET'\) return withAuthRetry\(\(\) => rawRequest\(path, opts\)\);/);
  });

  it('旧身份错误不是网络错误 → 不会触发 stale_fallback 快照回退', () => {
    // 守卫在 snapSave 之前 throw，紧随的 catch 只对 isNetErr 走快照；消息不含 timeout/超时/网络错误/request:fail
    expect(api).toMatch(/new Error\('账号已切换，已忽略旧身份数据'\)/);
    expect('账号已切换，已忽略旧身份数据').not.toMatch(/timeout|超时|网络错误|request:fail/i);
  });
});

describe('tab 页 catch 对旧身份回包静默（不 toast / 不置 loadErr / 不走兜底重拉）', () => {
  it('home.vue loadHome() catch 首行 isStaleUidErr 直接 return，不再散调 loadPlan/loadBadges/loadProfile', () => {
    const m = home.match(/async loadHome\(\) \{[\s\S]*?\} catch \(e\) \{\n([\s\S]*?)\n {6}\}/);
    expect(m).not.toBeNull();
    expect(m[1].trim().split('\n')[0]).toMatch(/if \(isStaleUidErr\(e\)\) return;/);
    expect(home).toMatch(/import \{[^}]*isStaleUidErr[^}]*\} from '\.\.\/\.\.\/api\.js';/);
  });

  it('book.vue load() catch 在 seq 判定后对旧身份 return（复位 loading），不落缓存/不 toast', () => {
    const m = book.match(/if \(seq !== this\._loadSeq\) return;\n {8}if \(isStaleUidErr\(e\)\) \{\n {10}this\.loading = false;\n {10}return;\n {8}\}\n {8}const c = getCachedMistakes\(anonUid\(\)\);/);
    expect(m).not.toBeNull();
    expect(book).toMatch(/import \{[^}]*isStaleUidErr[^}]*\} from '\.\.\/\.\.\/api\.js';/);
  });

  it('stats.vue load() catch 对旧身份 return，不置 loadErr / 不 toast', () => {
    const m = stats.match(/this\.masteredCount = \(mk\.items \|\| \[\]\)\.filter\(\(m\) => m\.mastered\)\.length;\n {6}\} catch \(e\) \{\n {8}if \(isStaleUidErr\(e\)\) return;\n {8}this\.loadErr = /);
    expect(m).not.toBeNull();
    expect(stats).toMatch(/import \{[^}]*isStaleUidErr[^}]*\} from '\.\.\/\.\.\/api\.js';/);
  });
});
