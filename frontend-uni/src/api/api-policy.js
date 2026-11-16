// 网络层纯决策函数：错误分类 / 登录态失效判定 / GET 快照兜底策略 / SSE 解析。
// 无 uni/window 依赖，api.js 委托调用；单测见 __tests__/api-policy.test.js。

export const isTimeoutMsg = (msg) => /timeout|超时/i.test(String(msg));
export const isNetMsg = (msg) => isTimeoutMsg(msg) || /网络错误|request:fail/i.test(String(msg));

// uni fail 回调的 errMsg（request:fail / request:fail timeout / uploadFile:fail …）是平台内部文案，
// 对外统一为中文；产出仍落在 isTimeoutMsg / isNetMsg 的判定集合内（超时 / 网络错误），上层分类与重试口径不变。
export const NET_FAIL_TEXT = '网络错误，请检查网络后重试';
export const NET_TIMEOUT_TEXT = '请求超时，请稍后重试';
export function netFailMessage(errMsg, fallback = NET_FAIL_TEXT) {
  const m = String(errMsg || '');
  if (isTimeoutMsg(m)) return NET_TIMEOUT_TEXT;
  if (!m || /:fail/.test(m)) return fallback;
  return m;
}

// 失败横幅文案：自带「再试 / 重试」结尾的错误（含上面两条网络文案）不再追加「，请重试」。
export function failBannerText(error, prefix = '失败：') {
  const e = String(error || '');
  return prefix + e + (/再试|重试/.test(e) ? '' : '，请重试');
}

// 非 2xx 响应的统一判定：detail 提取（对象数组回落状态码防 [object Object]）、
// 登录态本身失效判定（访问码/管理令牌 401 不踢登录）、对外错误文案。
export function classifyHttpError({ status, detail, path }) {
  const d = typeof detail === 'string' ? detail : '';
  const authExpired =
    (status === 401 && !path.startsWith('/api/auth/') && (d.includes('未登录') || d.includes('登录已过期'))) ||
    (status === 403 && d.includes('无权访问该账号数据'));
  return {
    detail: d,
    authExpired,
    message: authExpired ? '登录已过期，请重新登录' : d || `HTTP ${status}`,
  };
}

// ---------- GET 最近成功快照兜底（R90）----------

export function snapCacheable(path) {
  return !path.startsWith('/api/auth/') && !path.startsWith('/api/admin');
}

export function snapFresh(snap, now, ttl) {
  return !!snap && now - snap.t <= ttl;
}

// LRU 索引：path 移到队尾，超上限时从队头淘汰；返回新索引与待删列表。
export function snapPushIndex(idx, path, max) {
  const next = idx.filter((p) => p !== path);
  next.push(path);
  const evict = [];
  while (next.length > max) evict.push(next.shift());
  return { idx: next, evict };
}

// ---------- 账号切换飞行竞态（R499）----------

export function pathUid(path) {
  const m = /[?&]uid=([^&#]*)/.exec(String(path));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch (e) {
    return m[1];
  }
}

// 带 uid 的 GET 回包到达时本机身份已变（退出/换号/401 清态）→ 回包属旧身份，不得落到页面态与 storage。
export function isStaleUidResponse(path, curUid) {
  const sent = pathUid(path);
  return !!sent && sent !== (curUid || '');
}

export const isStaleUidErr = (e) => !!(e && e.staleUid);

// ---------- 埋点失败离线队列（R176）----------

// 可重试判定：网络失败/超时/HTTP 5xx（瞬时窗口）/429 限流可重放；其余 4xx 属确定性拒绝不重试。
export const trackRetryable = (msg) =>
  isNetMsg(msg) || /^HTTP (5\d\d|429)$/.test(String(msg)) || /请求过于频繁/.test(String(msg));

// 入队：追加一条，超上限丢最旧（最近事件分析价值更高）。
export function trackQueuePush(q, item, max = 30) {
  const next = (Array.isArray(q) ? q : []).concat([item]);
  return next.length > max ? next.slice(next.length - max) : next;
}

// 重放载荷：携带 ago_ms 让服务端还原真实发生时刻；缺 t/时钟回拨按 0 处理。
export function trackReplayPayload(item, now) {
  const t = item && typeof item.t === 'number' ? item.t : now;
  return {
    uid: item.uid,
    event: item.event,
    source: item.source || null,
    ref: item.ref || null,
    ago_ms: Math.max(0, Math.round(now - t)),
  };
}

// ---------- SSE 解析 ----------

// 按空行切分事件，尾部不完整片段留在 rest 供下一 chunk 续接；无 data 行的事件忽略。
export function parseSseEvents(buf) {
  const parts = buf.split('\n\n');
  const rest = parts.pop();
  const events = [];
  for (const ev of parts) {
    const typeM = ev.match(/^event: (\w+)/m);
    const dataM = ev.match(/^data: (.*)$/m);
    if (!dataM) continue;
    events.push({ type: typeM ? typeM[1] : 'message', data: JSON.parse(dataM[1]) });
  }
  return { rest, events };
}
