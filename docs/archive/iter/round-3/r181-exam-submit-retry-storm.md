# R181：真题做卷时间到自动交卷失败重试风暴收口

## 一手取证（2026-09-01，origin 访问日志）

排查 origin 404 分布时发现单客户端重试风暴：

```
/var/log/caddy/kaogong-origin.zalize.com-access.log（08:11–09:54，1.7h）
total 21047  404s 20009
POST /api/exam/submit      10029 次（全部 404「答题记录不存在」）
GET  /api/exam/report/75    4294 次
GET  /api/exam/report/73    2873 次
GET  /api/exam/report/72    2868 次
同一 IP / 同一 UA（Linux Chrome），持续 ~3.3 req/s
```

来源确认：本机遗留的 3 个做卷测试页签（attempt 已被 R106 测试数据清理删除）。
真实用户同样可触发：attempt 被清理/过期、或换 uid 后恢复本地进度，交卷即 404。

## 根因（exam.vue 交卷失败路径闭环）

1. 计时 `setInterval` 每秒检查 `leftSecs <= 0` → 到点自动 `submit()`；
2. `submit()` 失败 → 先探报告（也 404）→ `catch` 里 `submitting = false; startClock()`；
3. 时钟重启后 `_endAt` 已过期，下一秒 tick 再次 `leftSecs<=0` → 再次 `submit()`；
4. 404 属确定性业务错误（「答题记录不存在」），永远不会成功 → 每 tab ~1.1 req/s 无限打 origin（submit POST + report GET 各一次/循环）。

即：**时间到 + 交卷失败（无论何种错误）= 每秒无限重试**，且确定性 4xx 也在重试。

## 方案

新增纯函数 `src/exam-policy.js`（沿 api-policy/edge-policy 模式，vitest 覆盖）：

```js
submitFailPlan({ message, timeUp, tries })
  → { action: 'terminal' }                    // 确定性错误（非网络/超时/5xx）：会话已失效，重试无意义
  → { action: 'manual' }                      // 时间未到，或自动重试已达上限（5 次）：回到可手动重交状态
  → { action: 'retry', delayMs }              // 时间到 + 可重试错误：指数退避 5s→10s→20s→40s→60s（封顶）
```

可重试判定与 R176 `trackRetryable` 同口径：`isNetMsg(message) || /^HTTP 5\d\d$/`。

exam.vue：

- 到点自动交卷前先 `stopClock()`（时钟只触发一次，重试由退避计划驱动）；
- `submit()` catch（报告探测也失败后）按 `submitFailPlan` 分流：
  - `terminal`：清 `PROG_KEY`，`showModal`「试卷会话已失效，本次作答无法判分」→ 返回卷库（不再保留必然失败的进度）；
  - `retry`：toast 告知 N 秒后自动重试，`setTimeout` 退避重试；
  - `manual`：现状语义——时间未到重启时钟 + toast「作答已保留，可再次交卷」；
- 手动点「交卷」重置重试计数；`onUnload` 清退避定时器。

## 验证

- vitest：terminal/manual/retry 三分支 + 退避序列 + 上限；
- 本地 ESLint/vitest/build 全绿；
- 生产：复现原路径（旧 attempt 交卷 404）确认弹终止 modal、不再循环打 origin；正常交卷/超时交卷回归不变。

## 影响面

仅 `frontend-uni`（exam.vue + 新 exam-policy.js + 测试），零后端、零契约变化。
