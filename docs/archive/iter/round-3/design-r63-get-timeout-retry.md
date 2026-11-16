# R63：GET 请求超时收敛 + 超时自动重试——把 45–90s 挂起压到 ~12s 内自愈

## 背景与取证（2026-08-29 生产实测）

R61 RUM 阶段字段已上线（等待新数据），但既有 66 条 slow_load 已实证：真实用户会话中
存在**单请求级** API 长尾——`daily_plan:45484`、`categories:21017`、`events:14818`、
`questions:13564`、`history:8732`（growth_events ref 实录，均为 uid/GET 请求）。

当前前端 `rawRequest` 默认 timeout=180000（3 分钟）：一旦某个 GET 抽中长尾，
用户对着空白/骨架屏干等 45–90s 甚至 3 分钟，无任何自愈。

关键证据——长尾是「单请求级」而非「窗口级」：
- 同一时刻其他请求正常（RUM 记录 nav:136 + daily_plan:45484 同屏共存，导航本身 136ms）；
- 部署预热实测同端点热路径 0.27–0.66s；
- 因此超时后**立即重试大概率命中热路径**，把最坏体验从 45–180s 压到 ~12s。

排除项：全后端 GET 端点均无 LLM/长计算（LLM 全部为 POST /api/coach、
/api/mistakes/analysis、stream 类）；显式传 timeout 的调用点（pk/submit 20s、
exam/report 8s、mistakes/analysis 420s 等）全部保留原值不受影响。

## 方案（api.js，仅动 request() 一处）

```js
const isTimeout = (e) => /timeout|超时/i.test(String(e && e.message));
export function request(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  if (method !== 'GET' || opts.timeout != null) return withAuthRetry(() => rawRequest(path, opts));
  // GET 默认 12s 超时；超时自动重试一次（20s）——长尾为单请求级，重试大概率命中热路径
  return withAuthRetry(() =>
    rawRequest(path, { ...opts, timeout: 12000 }).catch((e) => {
      if (!isTimeout(e)) throw e;
      return rawRequest(path, { ...opts, timeout: 20000 });
    })
  );
}
```

- 仅 GET 且未显式传 timeout 的调用受影响（幂等，重试安全）；
- POST/PUT/DELETE 一律不重试（防重复 mutation）；
- HTTP 错误（4xx/5xx）不重试，仅传输层超时重试；
- 最坏情况 12+20=32s 后报错（原 180s）。

## 验收标准

1. 本地拦截实测：GET 首次挂起 >12s → 自动重试 → 第二次正常返回，页面数据正常；
2. GET 两次均超时 → 32s 内报错（不再 180s）；
3. POST 挂起不重试（保持原超时语义）；
4. 显式 timeout 调用点行为不变；
5. 生产 1440/375 全页走查 console 0 error、功能无回归；
6. build:h5 全绿、部署 hash 一致。

## 验收结果（2026-08-29 生产实测）

1. 生产拦截实测（1440）：home_bundle 首次挂起 14s → 客户端 12s 超时自动重试 →
   第二次正常返回，20.3s 内页面数据完整渲染，console 0 error；
2. 双超时路径（375）：两次均挂起 → 2 次尝试后走 R62 fallback 独立端点，页面正常渲染，
   console 0 error、无溢出（不再 180s 干等）；
3. POST 不重试、显式 timeout 调用点不受影响（代码路径静态确认：仅 GET 且未传 timeout 才走新逻辑）；
4. 正常路径回归：home/practice/book/stats 四页 1440 console 0 error、无水平溢出；
5. build:h5 全绿；生产 bundle index-BfohsEFb.js 与本机构建一致。
