# R324 设计：每日推送个性化——补「今日到期错题」复习提醒

## 一手取证（生产代码/数据实查）

1. 推送现状（backend/app/push_api.py）：R98 起每日 08:00（中国时区）向所有订阅者发**同一份**「每日一练已更新」payload；唯一个性化是「当天已完成每日一练的 uid 跳过」。verified：`_send_daily()` 中 payload 在循环外构造一次，所有人相同。
2. 错题复习提醒缺口：错题本按遗忘曲线排复习（`mistakes.next_review`），首页有 duebar/任务清单外显「今日到期 N 题」（home.vue L133），但**离开 App 后无任何到期提醒**。粉笔错题本有错题复习推送提醒；本站推送通道已建成却只覆盖每日一练。
3. 数据可得性：`db.due_review_count(uid)`（db.py L3048）已存在且被 daily_plan 使用，单 uid 查询开销小；push_subs 订阅量小（生产实查为个位数），循环内逐 uid 查询无性能问题。
4. 深链可达性：错题本自动开始复习已有机制——home.vue `goReview()` 写 `autoStartReview` 后 switchTab；book.vue `onShow` 读到该 storage 即自动进入复习流。book URL 深链由 `book-url.js parseBookOpts` 白名单解析（R276），当前不含 review 参数。
5. 推送点击路由：sw.js `notificationclick` 打开 payload.url；R102 已归一化 hash 路由，`/#/pages/practice/practice?daily=1&src=push` 生产可用，同构 `/#/pages/book/book?review=1&src=push` 可行。

## 差距结论

推送通道（获客/留存资产）只服务每日一练；错题到期这一最强「回流理由」（个性化、有截止感）完全没接上。对标粉笔错题本的复习提醒，属产品级用户可感知缺口。

## 方案

### 后端（push_api.py，纯增量）

- 抽纯函数 `build_push_payload(day, daily_done, due_n) -> dict | None`（可单测）：
  - 未完成每日 + due_n=0：现状文案（每日一练）；
  - 未完成每日 + due_n>0：title「今日学习提醒」，body「{day} 全站同题 10 题；另有 {n} 道错题今日到期」，url 仍指每日一练深链；
  - 已完成每日 + due_n>0：title「错题复习提醒」，body「你有 {n} 道错题今日到期，趁热复习巩固」，url `/#/pages/book/book?review=1&src=push`；
  - 已完成每日 + due_n=0：返回 None（跳过，与现状语义一致）。
- `_send_daily(only_endpoint=None)`：循环内逐 uid 调 `db.due_review_count(uid)`（异常 fail-closed 视为 0）；`only_endpoint` 为生产安全验证钩子——指定时只向该订阅发送，绝不给全量订阅者发计划外推送。

### 前端（book-url.js + book.vue，纯增量）

- `parseBookOpts` 白名单补 `review`（仅 '1' 有效）；`buildBookUrl` 不输出 review（入向深链专用，不参与状态同步，避免刷新循环自动开复习）。
- book.vue `onLoad`：`p.review` 为真时走既有 `autoStartReview` 机制（设 storage，由 onShow 消费），复用 R276 之前就存在的自动复习流，行为零新增分支。

### 不做

- 不新增推送时段/推送表结构；不改订阅协议；不做推送频控（沿用每日一次 08:00）；到期为 0 且已完成每日者继续不打扰。

## 验证

- 本地：pytest 覆盖 build_push_payload 四分支 + due 边界；vitest 覆盖 parseBookOpts review 白名单（'1'/非法值/缺省）；ruff/pyright/lint/build 全绿。
- 生产：临时 uid 浏览器真实订阅推送 → 造 1 条到期错题 → 容器内 `_send_daily(only_endpoint=测试端点)` 定向触发 → 验证通知文案/点击深链直达错题本自动进入复习流；每日未完成分支同法验证；验后清理测试数据并比对保护 uid。
