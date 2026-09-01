# R176：埋点失败离线队列 + 重放（ago_ms 还原真实时刻）

## 取证（一手证据）

- R175 Lighthouse 审计窗口内生产实测 `/api/track` 一次 502（best-practices 0.96 的唯一扣分项），复测三连 200——属瞬时失败窗口。
- 每轮部署都会重启 origin 容器（deploy_h5.sh step 4），重建窗口约 10–20s；边缘对 POST 无 stale-if-error 兜底，窗口内所有 `/api/track` 上报直接失败。
- 前端 `trackEvent()`（api.js）对失败 `.catch(() => {})` 静默吞掉，事件永久丢失。受影响的恰是分析最依赖的低频事件：`boot` 版本心跳（每客户端每日 1 条，丢了当日不再补）、`slow_load`（慢网络用户本就更易撞上失败窗口——幸存者偏差，越慢越丢）。
- 全仓 40 处 `trackEvent(` 调用零重试/零缓冲（grep 实证）。

## 方案

复用「本地队列 + 下次机会重放」模式（与 R83 每日一练 pending 补投同思路），零新依赖：

- **入队**：`trackEvent` 失败且可重试（网络失败/超时/HTTP 5xx）时，把 `{uid,event,source,ref,t:Date.now()}` 存入 localStorage `kgTrackQ`（上限 30 条，超限丢最旧）；4xx（如事件名被下线）不入队不重试。
- **重放**：下一次 `trackEvent` 成功后触发 `flushTrackQueue()`（模块级 flag 防并发重放）；逐条 POST，携带 `ago_ms = now - t`，服务端以 `created_at = time.time() - ago_ms/1000` 还原真实发生时刻，保证 slow_load/boot 的时间序分析不失真。重放中途再失败：剩余留队下次再试。
- **后端**：`/api/track` 新增可选 `ago_ms`（钳制 0–7 天），契约向后兼容（不传=0=现行为）。
- **纯函数**（api-policy.js，vitest 覆盖）：`trackRetryable(msg)` 可重试判定、`trackQueuePush(q,item,max)` 上限淘汰、`trackReplayPayload(item,now)` 重放载荷（时钟回拨按 0 处理）。

## 边界

- 不改 40 处调用点；`trackEvent` 签名与返回语义不变。
- 服务端 rate_limit（60 次/300s per uid)对重放同样生效，队列上限 30 条远低于阈值。
- 不引入周期性定时器：重放只挂在「下一次成功上报」时机，无新常驻开销；长期不再上报的静默客户端队列自然滞留（可接受，数据本就无法送达）。
