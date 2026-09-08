// utils/request.ts netFailMessage + pages/login/login.ts 合并失败反馈 单测（W12D-2）：
// mock wx / Page / api，验证 request:fail 中文映射仍落在 kg-exam-progress 可重试集合内，
// 以及 merge_anon 失败时出失败 toast 且仍完成登录跳转。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ReqOpt = {
  url: string;
  success: (r: { statusCode: number; data: unknown }) => void;
  fail: (e: { errMsg: string }) => void;
};
type Toast = { title: string; icon?: string; duration?: number };

const store = new Map<string, unknown>();
const toasts: Toast[] = [];
const navs: string[] = [];
let requestImpl: (o: ReqOpt) => void = () => undefined;
let pageCfg: Record<string, (...a: unknown[]) => unknown> = {};

(globalThis as Record<string, unknown>).wx = {
  getStorageSync: (k: string) => (store.has(k) ? store.get(k) : ''),
  setStorageSync: (k: string, v: unknown) => store.set(k, v),
  removeStorageSync: (k: string) => store.delete(k),
  showToast: (t: Toast) => toasts.push(t),
  showModal: () => undefined,
  navigateBack: () => navs.push('back'),
  switchTab: (o: { url: string }) => navs.push(o.url),
  login: () => Promise.resolve({ code: 'wxcode' }),
  request: (o: ReqOpt) => requestImpl(o),
};
(globalThis as Record<string, unknown>).Page = (cfg: Record<string, (...a: unknown[]) => unknown>) => {
  pageCfg = cfg;
};

const req = await import('../miniprogram/utils/request');
const { NET_FAIL_TEXT, NET_TIMEOUT_TEXT, netFailMessage, request } = req;
const { submitRetryable } = await import('../miniprogram/utils/kg-exam-progress');
const { streamPost } = await import('../miniprogram/utils/sse');

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  store.clear();
  toasts.length = 0;
  navs.length = 0;
  requestImpl = () => undefined;
  vi.useRealTimers();
});

describe('netFailMessage（对齐 H5 api-policy）', () => {
  it('request:fail 系列映射为中文，非 fail 前缀原文透出', () => {
    expect(netFailMessage('request:fail')).toBe(NET_FAIL_TEXT);
    expect(netFailMessage('request:fail -2:net::ERR_INTERNET_DISCONNECTED')).toBe(NET_FAIL_TEXT);
    expect(netFailMessage('request:fail timeout')).toBe(NET_TIMEOUT_TEXT);
    expect(netFailMessage('request:fail socket time out timeout:180000')).toBe(NET_TIMEOUT_TEXT);
    expect(netFailMessage('')).toBe(NET_FAIL_TEXT);
    expect(netFailMessage(undefined)).toBe(NET_FAIL_TEXT);
    expect(netFailMessage('自定义说明')).toBe('自定义说明');
    expect(netFailMessage('uploadFile:fail', '上传失败')).toBe('上传失败');
  });

  it('映射后的文案仍被交卷重试分流判为可重试', () => {
    expect(submitRetryable(NET_FAIL_TEXT)).toBe(true);
    expect(submitRetryable(NET_TIMEOUT_TEXT)).toBe(true);
    expect(submitRetryable('HTTP 404')).toBe(false);
  });

  it('request() fail 回调不再透出 request:fail 原文', async () => {
    requestImpl = (o) => o.fail({ errMsg: 'request:fail -105:net::ERR_NAME_NOT_RESOLVED' });
    await expect(request('/api/exam/papers')).rejects.toThrow(NET_FAIL_TEXT);
    requestImpl = (o) => o.fail({ errMsg: 'request:fail timeout' });
    await expect(request('/api/exam/papers')).rejects.toThrow(NET_TIMEOUT_TEXT);
  });

  it('streamPost fail 回调同口径', async () => {
    requestImpl = (o) => {
      o.fail({ errMsg: 'request:fail' });
    };
    await expect(streamPost({ path: '/api/explain/stream', header: {}, data: {} })).rejects.toThrow(NET_FAIL_TEXT);
  });
});

describe('login 合并失败反馈', () => {
  const MERGE_FAIL_TIP = '已登录，但本机记录合并失败；退出后重新登录会再次合并';
  const account = { uid: 'u42', phone: '13800000000' };

  const withApi = (mergeStatus: number) => {
    requestImpl = (o) => {
      if (o.url.endsWith('/api/auth/login')) return o.success({ statusCode: 200, data: { token: 't', user: account } });
      if (o.url.endsWith('/api/auth/merge_anon')) {
        if (mergeStatus === 200) return o.success({ statusCode: 200, data: { ok: true } });
        return o.success({ statusCode: mergeStatus, data: { detail: 'boom' } });
      }
      return o.success({ statusCode: 200, data: {} });
    };
  };

  const login = async () => {
    vi.useFakeTimers();
    await import('../miniprogram/pages/login/login');
    const page = { data: { ...(pageCfg.data as object), mode: 'login', phone: '13800000000', password: '123456' } } as {
      data: Record<string, unknown>;
      setData: (d: Record<string, unknown>) => void;
      onSubmit: () => Promise<void>;
    };
    page.setData = (d) => Object.assign(page.data, d);
    page.onSubmit = pageCfg.onSubmit as () => Promise<void>;
    await page.onSubmit();
    await vi.advanceTimersByTimeAsync(1300);
    return page;
  };

  it('merge_anon 500：出失败 toast、登录态已写、仍跳转、anonUid 留待下次合并', async () => {
    store.set('anonUid', 'test-w12-anon');
    withApi(500);
    const page = await login();
    expect(page.data.err).toBe('');
    expect(toasts.map((t) => t.title)).toEqual([MERGE_FAIL_TIP]);
    expect(toasts[0]).toMatchObject({ icon: 'none', duration: 2500 });
    expect(store.get('authToken')).toBe('t');
    expect(store.get('anonUid')).toBe('u42');
    expect(store.get('deviceAnonUid')).toBe('test-w12-anon');
    expect(navs).toEqual(['back']);
  });

  it('merge_anon 200：成功 toast', async () => {
    store.set('anonUid', 'test-w12-anon');
    withApi(200);
    await login();
    expect(toasts.map((t) => t.title)).toEqual(['本机记录已合并到账号']);
    expect(navs).toEqual(['back']);
  });

  it('无匿名记录：登录成功 toast', async () => {
    withApi(200);
    await login();
    expect(toasts.map((t) => t.title)).toEqual(['登录成功']);
  });
});
