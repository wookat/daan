// 网络层纯决策函数：错误分类 / 登录态失效判定 / GET 快照兜底策略 / SSE 解析。
// 无 uni/window 依赖，api.js 委托调用；单测见 __tests__/api-policy.test.js。

export const isTimeoutMsg = (msg) => /timeout|超时/i.test(String(msg));
export const isNetMsg = (msg) => isTimeoutMsg(msg) || /网络错误|request:fail/i.test(String(msg));

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

// ---------- 埋点失败离线队列（R176）----------

// 可重试判定：网络失败/超时/HTTP 5xx（瞬时窗口）可重放；4xx 属确定性拒绝不重试。
export const trackRetryable = (msg) => isNetMsg(msg) || /^HTTP 5\d\d$/.test(String(msg));

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
