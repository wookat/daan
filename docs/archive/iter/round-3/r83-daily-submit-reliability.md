# R83：每日一练成绩提交可靠投递（防丢单）

## 取证结论（一手证据）

**事实（生产实查 2026-08-31）**：
- `daily_set_entries` 全表仅 1 行（本轮测试 uid），真实用户 0 行。
- 三个真实匿名 uid（umtgjstqae1ujg0ej / umtgilncbwph5fdqh / umtgiks35cyk6k38n）当日 `answer_log` 各 10 条，
  question_id 与当日全站同题题组（262031, 241842, 283162, 1272482, 273075, 376428, 284246, 241911, 234796, 1272499）
  **逐一相同且顺序一致** —— 他们确实完整做完了每日一练，但成绩全部丢失。
- 浏览器实测（新 uid 走完 10 题）：`POST /api/daily_set/submit` 确实发出；origin 日志
  `[slow-req] 95.7s POST /api/daily_set/submit`，且**无对应 200 访问行**、DB 无该行 ——
  请求在共享宿主拥塞下挂 95.7s，客户端断开后 handler 被取消，成绩未落库。
- 同刻宿主：load 23.6 / swap 2.6GB / recruit-worker-heavy 99% CPU；全端点 14–95s（机器级挤占，非本服务）。
- 对照：宿主较空闲时同一流程提交成功即落库（幂等、榜单、streak 均正常）。

**根因**：完成页触发的 submit 是一次性 fire-and-forget POST；共享宿主长尾（几十秒级）下用户早已
离开/关页，请求被取消或超时，且 POST 无任何重试（R63 只重试 GET），成绩永久丢失。
做题过程中的 answer_log 能落库是因为用户还留在页面，慢请求有充足时间完成。

## 方案（前端可靠投递队列，零后端改动）

服务端 `(day, uid)` 主键幂等，重试天然安全。

1. **先落地后发送**：`markDailyDone` 里先把 payload（uid/nickname/date/right/total/secs）写入
   `dailyPendingSubmit` 本地存储，再发 POST；成功后清除并落 `dailyDone:<uid>`（现状逻辑不变）。
2. **失败保留、择机补投**：失败/超时不清除 pending；首页 `onShow` 调用 `flushDailySubmit()`：
   - pending.date ≠ 今天（中国时区）→ 直接丢弃（服务端也只收当日）；
   - 否则重发（幂等），成功后清除 pending 并补写 `dailyDone:<uid>`（right/rank/streak 来自响应），
     首页 hero 完成态即恢复。
3. 补投静默进行，不 toast 不阻塞首屏（fire-and-forget + catch）。

## 验收标准

- 正常链路回归：新 uid 走完 10 题 → submit 成功 → entries 1 行、完成页统计/榜单正常、pending 已清。
- 丢单链路：拦截 submit 使其失败 → pending 保留 → 回首页 onShow 自动补投 → entries 落库、
  hero 显示完成态。
- 跨日 pending 不误投（date 非今日直接丢弃）。
- 重复提交幂等（成绩不被覆盖）。
- 保护 uid 零 mutation；测试数据清理。

## 非目标

- 不动后端接口/表结构；不做 answer_log 服务端聚合推导成绩（往期语义、耗时/昵称缺失，复杂度不划算）。
- 宿主级资源挤占根治（迁机/限额）仍是老板决策项（R64 已挂账）。
