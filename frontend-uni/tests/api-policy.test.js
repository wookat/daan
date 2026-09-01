import { describe, it, expect } from 'vitest';
import {
  isTimeoutMsg,
  isNetMsg,
  classifyHttpError,
  snapCacheable,
  snapFresh,
  snapPushIndex,
  parseSseEvents,
} from '../src/api-policy';

describe('错误消息分类', () => {
  it('timeout/超时 判为超时', () => {
    expect(isTimeoutMsg('request:fail timeout')).toBe(true);
    expect(isTimeoutMsg('请求超时')).toBe(true);
    expect(isTimeoutMsg('HTTP 500')).toBe(false);
  });

  it('网络错误/request:fail 判为网络错误，超时也是网络错误', () => {
    expect(isNetMsg('网络错误')).toBe(true);
    expect(isNetMsg('request:fail abort')).toBe(true);
    expect(isNetMsg('timeout of 12000ms')).toBe(true);
  });

  it('HTTP 业务错误不是网络错误（R137 失败态分流依据）', () => {
    expect(isNetMsg('成绩报告不存在')).toBe(false);
    expect(isNetMsg('HTTP 404')).toBe(false);
    expect(isNetMsg(undefined)).toBe(false);
  });
});

describe('classifyHttpError', () => {
  it('detail 为对象/数组时回落 HTTP 状态码，防 [object Object]', () => {
    const r = classifyHttpError({ status: 422, detail: [{ loc: ['body'] }], path: '/api/x' });
    expect(r.detail).toBe('');
    expect(r.message).toBe('HTTP 422');
    expect(r.authExpired).toBe(false);
  });

  it('401 + 登录已过期 文案判登录失效并统一文案', () => {
    const r = classifyHttpError({ status: 401, detail: '登录已过期', path: '/api/stats' });
    expect(r.authExpired).toBe(true);
    expect(r.message).toBe('登录已过期，请重新登录');
  });

  it('/api/auth/ 路径的 401 不判登录失效（登录/注册自身报错）', () => {
    const r = classifyHttpError({ status: 401, detail: '未登录', path: '/api/auth/login' });
    expect(r.authExpired).toBe(false);
    expect(r.message).toBe('未登录');
  });

  it('访问码等其他 401 文案不踢登录', () => {
    const r = classifyHttpError({ status: 401, detail: '需要访问码', path: '/api/explain' });
    expect(r.authExpired).toBe(false);
  });

  it('403 无权访问该账号数据 判登录失效（R39 全站 403 脱困）', () => {
    const r = classifyHttpError({ status: 403, detail: '无权访问该账号数据', path: '/api/mistakes' });
    expect(r.authExpired).toBe(true);
  });

  it('其他 403 业务错误照常透出', () => {
    const r = classifyHttpError({ status: 403, detail: '仅限管理员', path: '/api/admin/x' });
    expect(r.authExpired).toBe(false);
    expect(r.message).toBe('仅限管理员');
  });
});

describe('GET 快照兜底策略', () => {
  it('auth/admin 路径不进快照', () => {
    expect(snapCacheable('/api/auth/me')).toBe(false);
    expect(snapCacheable('/api/admin/reports')).toBe(false);
    expect(snapCacheable('/api/stats?uid=u1')).toBe(true);
  });

  it('snapFresh 按 TTL 判新鲜度', () => {
    const now = 1000000;
    expect(snapFresh({ t: now - 10 }, now, 100)).toBe(true);
    expect(snapFresh({ t: now - 200 }, now, 100)).toBe(false);
    expect(snapFresh(null, now, 100)).toBe(false);
  });

  it('snapPushIndex：已有 path 移到队尾，不重复', () => {
    const { idx, evict } = snapPushIndex(['/a', '/b', '/c'], '/a', 5);
    expect(idx).toEqual(['/b', '/c', '/a']);
    expect(evict).toEqual([]);
  });

  it('snapPushIndex：超上限从队头淘汰', () => {
    const { idx, evict } = snapPushIndex(['/a', '/b', '/c'], '/d', 3);
    expect(idx).toEqual(['/b', '/c', '/d']);
    expect(evict).toEqual(['/a']);
  });
});

describe('parseSseEvents', () => {
  it('完整事件解析 type 与 JSON data，尾部片段留 rest', () => {
    const { rest, events } = parseSseEvents('event: meta\ndata: {"n":1}\n\ndata: {"d":"你好"}\n\nevent: mes');
    expect(events).toEqual([
      { type: 'meta', data: { n: 1 } },
      { type: 'message', data: { d: '你好' } },
    ]);
    expect(rest).toBe('event: mes');
  });

  it('跨 chunk 截断：rest 续接后完整解析', () => {
    const first = parseSseEvents('data: {"d":"a');
    expect(first.events).toEqual([]);
    const second = parseSseEvents(first.rest + 'b"}\n\n');
    expect(second.events).toEqual([{ type: 'message', data: { d: 'ab' } }]);
    expect(second.rest).toBe('');
  });

  it('无 data 行的事件忽略；done/error 事件类型透出', () => {
    const { events } = parseSseEvents(': ping\n\nevent: done\ndata: {"session_id":7}\n\nevent: error\ndata: {"message":"x"}\n\n');
    expect(events).toEqual([
      { type: 'done', data: { session_id: 7 } },
      { type: 'error', data: { message: 'x' } },
    ]);
  });
});
