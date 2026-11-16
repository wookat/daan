// Toast 规则层（COMPONENTS §1.10）：继续 uni.showToast，不引 wd-toast（每页要放占位组件）。
// 只管「成功且无后续 / 短提示 / 错误文案」三类；网络失败用 KgBanner、表单校验 inline、需要选择用 showModal——这些不在此文件里，避免 toast 被误用。
export const TOAST_KINDS = {
  ok: { icon: 'success', duration: 1500 },
  info: { icon: 'none', duration: 2000 },
  err: { icon: 'none', duration: 2500 },
};

/** 规范：文案不带句号；成功文案 ≤10 字（超出只在 dev 提示，不截断） */
export function normalizeToastText(title) {
  return String(title == null ? '' : title).trim().replace(/[。.!！]+$/, '');
}

export function toastOptions(kind, title) {
  const rule = TOAST_KINDS[kind] || TOAST_KINDS.info;
  return { title: normalizeToastText(title), icon: rule.icon, duration: rule.duration, mask: false };
}

function show(kind, title) {
  const opts = toastOptions(kind, title);
  if (!opts.title) return opts;
  uni.showToast(opts);
  return opts;
}

export const toastOk = (title) => show('ok', title);
export const toastInfo = (title) => show('info', title);
export const toastErr = (title) => show('err', title);
export default { ok: toastOk, info: toastInfo, err: toastErr };
