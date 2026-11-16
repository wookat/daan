# R351：错题本复习会话中断可恢复——本机快照 + 「继续刚才的复习」

## SOP-10 四维审计（2026-08-29 窗口，取证摘要）

- 操作台：桌面双栏/快捷键/侧栏（R10–R42）就位，无新 P0。
- 功能深度：**选题命中**——复习会话（rItems/rIdx/picked/answered 等）纯内存态，整页刷新必丢；R350 生产实测中 testing agent 从复习流点「AI 详解本题」跳 ask 页再返回，复习会话丢失回列表态、本轮加练题作废（实景复现）。而 R326–R350 我们在复习流里铺了 AI 详解/回看/笔记讨论等多个跳出型入口，等于自建「中断源」却无恢复路径。粉笔错题本复习中跳 AI 讲题返回后上下文保留。对比：普通刷题有 R322 practice_progress、模考有 R298 exam_progress，唯独复习流零恢复。
- 落地页首页 UI：R122/R193 后 Lighthouse 全绿（R350 部署复验 / 0.97、/tiku/ 全过），无新 P0。
- 架构/移动 IA：无新 P0；本轮候选积压——R349 残余 saveExtraWrong res.id 校验（低优，顺手收口）。

## 取证事实（verified）

- book.vue `reviewing/rItems/rIdx/picked/answered/wasCorrect/nextDays` 全部为组件内存态，无任何持久化；`exitReview()` 是唯一置 false 点。
- 复习卡渲染只依赖条目原始字段（question_text/correct_answer/explanation/error_reason/_extra/_requeued/_saved/_mid/_appended），`curHtml` 由 explanation 现算——快照无需存渲染态。
- 已答条目 SRS 已落库（record() 即 POST /api/review/<id>），恢复会话不会重复计分；`_extra` 已入库条目有 `_saved/_mid` 防重复 POST。

## 方案（纯前端，零后端/零契约/零新埋点）

新增 `src/review-snap.js` fail-closed 纯函数：

```js
buildReviewSnap(state, uid, now) // → {v:1, uid, ts, rIdx, picked, answered, wasCorrect, nextDays, items:[裁剪 open/html]} ；items 空/序列化 >200k → null
parseReviewSnap(raw, uid, now)   // 非对象/uid 不符/超 TTL(2h)/items 非法/rIdx 越界/条目缺 question_text → null
```

book.vue 接入：

- 写点：startReview / record 判分后 / nextReview 换题后 / appendSimilar 追加后 / saveExtraWrong 记 _mid 后 / setReviewReason 打标后 → `saveReviewSnap()`（storage 键 `reviewSnap`）。
- 清点：exitReview()（含完成复习路径）→ `removeStorageSync('reviewSnap')`。
- 恢复：onShow 且非 reviewing 时 `parseReviewSnap` 命中 → 列表模式 duecard 上方显示「继续刚才的复习（第 x/n 题）」横幅，继续=整体恢复内存态进入复习卡；放弃=清快照。不自动跳入（防误触与陈旧态劫持）。

顺手收口 R349 残余：saveExtraWrong 改为 `const mid = reviewReasonMid({ id: res && res.id }); if (!mid) return;` 后再置 `_mid/_saved`（畸形响应不再误标已存）。

## 非目标

跨设备复习会话同步（本机快照先收口最高频中断；服务端化另立轮次）；不改 SRS/requeue/加练协议；不改 ask 页。

## 验证计划

- vitest：round-trip、uid 不符、TTL 过期、畸形 JSON/形状、rIdx 越界、超大 fail-closed、裁剪 open/html。
- 本地：lint / vitest / build:h5。
- 生产 testing agent：复习中作答 2 题→点 AI 详解跳 ask→返回→横幅出现→继续=第 3 题原位恢复（含加练条目与已答态）；整页硬刷同路径；放弃=横幅消失快照清除；完成复习后无横幅；R350/R349 回归；双视口、0 /api/explain、清理+保护 uid 快照。
