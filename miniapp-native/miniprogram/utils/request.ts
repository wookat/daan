// 请求封装：与 frontend-uni/src/api.js 的 request 行为对齐
// - X-Access-Code / Authorization 头
// - 401 登录过期 / 403 账号 uid 无 token（api-policy.classifyHttpError 同口径）清登录态回退匿名 uid
// - 「访问码」错误弹窗输入后自动重试一次

import { clearAccessCode, clearAuth, getAccessCode, getToken, setAccessCode } from './auth';

export const BASE_URL = 'https://kaogong.zalize.com';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: WechatMiniprogram.IAnyObject | string;
  header?: Record<string, string>;
  timeout?: number;
}

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

function askCode(): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title: '需要访问码（内测功能）',
      editable: true,
      placeholderText: '请输入访问码，可联系管理员获取',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm && res.content) {
          setAccessCode(res.content);
          resolve(true);
        } else resolve(false);
      },
      fail: () => resolve(false),
    });
  });
}

export function promptAccessCode(): Promise<boolean> {
  return askCode();
}

function rawRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', data, header = {}, timeout = 180000 } = opts;
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      // 类型库暂未声明 PATCH，运行时基础库可透传
      method: method as WechatMiniprogram.RequestOption['method'],
      data,
      header: { 'X-Access-Code': getAccessCode(), ...authHeader(), ...header },
      timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
          return;
        }
        const body = res.data as { detail?: string } | undefined;
        const detail = (body && body.detail) || '';
        // 仅登录态本身失效才清登录（访问码等 401 不应踢登录）
        const authExpired =
          (res.statusCode === 401 &&
            !path.startsWith('/api/auth/') &&
            (detail.includes('未登录') || detail.includes('登录已过期'))) ||
          (res.statusCode === 403 && detail.includes('重新登录'));
        // 403 场景 token 通常已丢失而 anonUid 仍为 u<id>，不以 token 为前提
        if (authExpired && (getToken() || res.statusCode === 403)) {
          clearAuth();
          wx.showToast({ title: '登录已过期，请重新登录', icon: 'none', duration: 2500 });
        }
        reject(new Error(authExpired ? '登录已过期，请重新登录' : detail || `HTTP ${res.statusCode}`));
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
  });
}

export async function request<T>(path: string, opts?: RequestOptions): Promise<T> {
  try {
    return await rawRequest<T>(path, opts);
  } catch (e) {
    if (String((e as Error).message).includes('访问码')) {
      clearAccessCode();
      const ok = await askCode();
      if (ok) return rawRequest<T>(path, opts);
      throw new Error('该功能需访问码，已取消');
    }
    throw e;
  }
}
