// Toast 规则层（COMPONENTS §1.10）：继续 uni.showToast，不引 wd-toast（每页要放占位组件）。
// 只管「成功且无后续 / 短提示 / 错误文案 / 轻量 Undo 总线」；网络失败长驻用 KgBanner、表单校验 inline、危险确认用 KgConfirmSheet。
export const TOAST_KINDS = {
  ok: { icon: 'success', duration: 1500 },
  info: { icon: 'none', duration: 2000 },
  err: { icon: 'none', duration: 2500 },
};

/** 规范：文案不带句号；成功文案 ≤10 字（超出只在 dev 提示，不截断） */
export function normalizeToastText(title) {
  return String(title == null ? '' : title).trim().replace(/[。.!！]+$/, '');
}

/** 将内部 HTTP 状态码/网络异常/英文 traceback 转成考生看得懂的自然中文。 */
export function humanErrorText(err, fallback = '操作失败，请稍后重试') {
  const raw = normalizeToastText(typeof err === 'string' ? err : (err && (err.message || err.errMsg)) || '');
  if (!raw) return fallback;
  if (/timeout|timed out|aborted|ETIMEDOUT/i.test(raw)) {
    return '请求超时了，请稍后重试';
  }
  if (/^(?:request:fail|failed to fetch|load failed|network)/i.test(raw) || /net::ERR_|ECONN|ENOTFOUND|network error/i.test(raw)) {
    return '网络不太稳定，请检查网络后重试';
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
  if (/缺少\s*uid|missing\s+uid/i.test(raw)) return '本机状态异常，请刷新页面后重试';
  if (/errcode|errmsg|SyntaxError|TypeError|Unexpected token/i.test(raw)) return fallback;
  // 若文本已含中文且不含 HTTP 报错前缀，保留业务提示本身
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw;
  return fallback;
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
export const toastErrFrom = (err, fallback) => toastErr(humanErrorText(err, fallback));

// 全局非阻塞 Undo 总线：同一时间仅保留一条可撤销操作，新的顶掉旧的（自动提交旧操作）。
let _seq = 0;
let _active = null;
let _timer = null;
const _listeners = new Set();

function _notify() {
  const snap = _active
    ? { id: _active.id, text: _active.text, actionText: _active.actionText, duration: _active.duration, createdAt: _active.createdAt }
    : null;
  _listeners.forEach((fn) => {
    try { fn(snap); } catch (e) { /* 订阅方异常不影响总线 */ }
  });
}

function _clearTimer() {
  if (_timer != null) {
    clearTimeout(_timer);
    _timer = null;
  }
}

export function dismissUndoToast(triggerCommit = true) {
  _clearTimer();
  const prev = _active;
  _active = null;
  _notify();
  if (triggerCommit && prev && typeof prev.onCommit === 'function') {
    try { prev.onCommit(); } catch (e) { /* 静默 */ }
  }
}

export function triggerUndoToast(id) {
  if (!_active || (id != null && _active.id !== id)) return false;
  _clearTimer();
  const cur = _active;
  _active = null;
  _notify();
  if (typeof cur.onUndo === 'function') cur.onUndo();
  return true;
}

export function showUndoToast(arg, onUndoArg, extraOpts) {
  const opts = typeof arg === 'string'
    ? { ...(extraOpts && typeof extraOpts === 'object' ? extraOpts : {}), text: arg, ...(typeof onUndoArg === 'function' ? { onUndo: onUndoArg } : {}) }
    : (arg || {});
  const { text, actionText = '撤销', duration = 4500, onUndo, onCommit } = opts;
  dismissUndoToast(true);
  const cleanText = normalizeToastText(text);
  if (!cleanText) return null;
  const id = ++_seq;
  _active = { id, text: cleanText, actionText: actionText || '撤销', duration, createdAt: Date.now(), onUndo, onCommit };
  _notify();
  if (duration > 0) {
    _timer = setTimeout(() => {
      if (_active && _active.id === id) dismissUndoToast(true);
    }, duration);
  }
  return id;
}

export function subscribeUndoToast(fn) {
  if (typeof fn !== 'function') return () => {};
  _listeners.add(fn);
  fn(
    _active
      ? { id: _active.id, text: _active.text, actionText: _active.actionText, duration: _active.duration, createdAt: _active.createdAt }
      : null,
  );
  return () => { _listeners.delete(fn); };
}

export default { ok: toastOk, info: toastInfo, err: toastErr, errFrom: toastErrFrom, human: humanErrorText };
