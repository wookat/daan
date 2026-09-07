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
