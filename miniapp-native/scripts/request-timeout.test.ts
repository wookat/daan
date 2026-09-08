// utils/request.ts GET 超时/重试口径（W15-M1，对齐 H5 api.js request()）：
// GET 默认 12s，超时以 20s 重试一次；非 GET / 显式 timeout 原样透传且不重试；非超时错误不重试。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { beforeEach, describe, expect, it } from 'vitest';

type ReqOpt = {
  url: string;
  method?: string;
  timeout?: number;
  success: (r: { statusCode: number; data: unknown }) => void;
  fail: (e: { errMsg: string }) => void;
};

const calls: ReqOpt[] = [];
let requestImpl: (o: ReqOpt) => void = () => undefined;

(globalThis as Record<string, unknown>).wx = {
  getStorageSync: () => '',
  setStorageSync: () => undefined,
  removeStorageSync: () => undefined,
  showToast: () => undefined,
  showModal: () => undefined,
  request: (o: ReqOpt) => {
    calls.push(o);
    requestImpl(o);
  },
};

const { request, GET_TIMEOUT, GET_RETRY_TIMEOUT, DEFAULT_TIMEOUT, NET_TIMEOUT_TEXT } = await import('../miniprogram/utils/request');

beforeEach(() => {
  calls.length = 0;
  requestImpl = (o) => o.success({ statusCode: 200, data: { ok: 1 } });
});

describe('request() GET 超时与重试', () => {
  it('GET 默认 12s（不再是 180s）', async () => {
    await request('/api/stats');
    expect(calls).toHaveLength(1);
    expect(calls[0].timeout).toBe(GET_TIMEOUT);
    expect(GET_TIMEOUT).toBe(12000);
  });

  it('GET 超时后以 20s 重试一次，成功则返回重试结果', async () => {
    requestImpl = (o) => (calls.length === 1 ? o.fail({ errMsg: 'request:fail timeout' }) : o.success({ statusCode: 200, data: { n: 2 } }));
    const r = await request<{ n: number }>('/api/growth?uid=u1');
    expect(r.n).toBe(2);
    expect(calls.map((c) => c.timeout)).toEqual([GET_TIMEOUT, GET_RETRY_TIMEOUT]);
  });

  it('两次都超时只重试一次并透出中文超时文案', async () => {
    requestImpl = (o) => o.fail({ errMsg: 'request:fail timeout' });
    await expect(request('/api/stats')).rejects.toThrow(NET_TIMEOUT_TEXT);
    expect(calls).toHaveLength(2);
  });

  it('GET 非超时错误（网络断开 / HTTP 4xx）不重试', async () => {
    requestImpl = (o) => o.fail({ errMsg: 'request:fail -2:net::ERR_INTERNET_DISCONNECTED' });
    await expect(request('/api/stats')).rejects.toThrow();
    expect(calls).toHaveLength(1);
    calls.length = 0;
    requestImpl = (o) => o.success({ statusCode: 404, data: { detail: '不存在' } });
    await expect(request('/api/stats')).rejects.toThrow('不存在');
    expect(calls).toHaveLength(1);
  });

  it('POST 保持默认 180s 且超时不重试（非幂等）', async () => {
    requestImpl = (o) => o.fail({ errMsg: 'request:fail timeout' });
    await expect(request('/api/answer_log', { method: 'POST', data: { uid: 'u1' } })).rejects.toThrow(NET_TIMEOUT_TEXT);
    expect(calls).toHaveLength(1);
    expect(calls[0].timeout).toBe(DEFAULT_TIMEOUT);
  });

  it('显式 timeout 原样透传且不重试（如模考报告 quick 8s / 抽题 20s）', async () => {
    requestImpl = (o) => o.fail({ errMsg: 'request:fail timeout' });
    await expect(request('/api/exam/report/1', { timeout: 8000 })).rejects.toThrow(NET_TIMEOUT_TEXT);
    expect(calls).toHaveLength(1);
    expect(calls[0].timeout).toBe(8000);
  });
});
