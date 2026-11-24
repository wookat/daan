// Toast 规则层（COMPONENTS §1.10）小程序版：继续 wx.showToast；duration 固定 1500 成功 / 2000 提示 / 2500 错误，文案去句号。
// 网络失败→kg-banner（页面级）、表单校验→inline、需要选择→wx.showModal，不走这里。
export type ToastKind = 'ok' | 'info' | 'err';

export const TOAST_KINDS: Record<ToastKind, { icon: 'success' | 'none'; duration: number }> = {
  ok: { icon: 'success', duration: 1500 },
  info: { icon: 'none', duration: 2000 },
  err: { icon: 'none', duration: 2500 },
};

export function normalizeToastText(title: string): string {
  return String(title == null ? '' : title).trim().replace(/[。.!！]+$/, '');
}

export function toastOptions(kind: ToastKind, title: string): WechatMiniprogram.ShowToastOption {
  const rule = TOAST_KINDS[kind] || TOAST_KINDS.info;
  return { title: normalizeToastText(title), icon: rule.icon, duration: rule.duration, mask: false };
}

function show(kind: ToastKind, title: string): void {
  const opts = toastOptions(kind, title);
  if (!opts.title) return;
  wx.showToast(opts);
}

export const toastOk = (title: string): void => show('ok', title);
export const toastInfo = (title: string): void => show('info', title);
export const toastErr = (title: string): void => show('err', title);

export function humanErrorText(err: unknown, fallback = '操作失败，请稍后重试'): string {
  const raw = normalizeToastText(
    typeof err === 'string' ? err : ((err as { message?: string; errMsg?: string } | null)?.message || (err as { errMsg?: string } | null)?.errMsg || ''),
  );
  if (!raw) return fallback;
  if (/^(?:request:fail|failed to fetch|load failed|network)/i.test(raw) || /net::ERR_|ECONN|ENOTFOUND|network error/i.test(raw)) {
    return '网络不太稳定，请检查网络后重试';
  }
  if (/timeout|timed out|aborted|ETIMEDOUT/i.test(raw)) {
    return '请求超时了，请稍后重试';
  }
  const httpM = raw.match(/\bHTTP\s+(\d{3})\b/i);
  if (httpM) {
    const code = Number(httpM[1]);
    if (code === 401) return '登录状态已失效，请重新登录';
    if (code === 403) return '暂时无法执行该操作';
    if (code === 404) return '未找到对应内容，可能已更新或下线';
    if (code === 408) return '请求超时了，请稍后重试';
    if (code === 409) return '数据已有更新，请刷新后再试';
    if (code === 422) return '提交的内容格式有误，请检查后重试';
    if (code === 429) return '操作太快了，稍等几秒再试';
    if (code >= 500) return '服务暂时开小差，请稍后再试';
  }
  if (/缺少\s*uid|missing\s+uid/i.test(raw)) return '本机状态异常，请刷新后重试';
  if (/errcode|errmsg|SyntaxError|TypeError|Unexpected token/i.test(raw)) return fallback;
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw;
  return fallback;
}

export const toastErrFrom = (err: unknown, fallback = '操作失败，请稍后重试'): void => toastErr(humanErrorText(err, fallback));

export function confirmDanger(opts: {
  title: string;
  content?: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title: opts.title,
      content: opts.content || '',
      confirmText: opts.confirmText || '确认',
      cancelText: opts.cancelText || '取消',
      confirmColor: '#dc2626',
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    });
  });
}
