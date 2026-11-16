# R52 设计方案：练习历史——按次回看做题记录 + 错题就地重练

## 一手证据

1. **竞品**：粉笔「练习历史」是我的页一级入口（历次练习按时间倒序：类型/题数/正确率，点进可回看每题作答与解析、错题可重练）；夸克刷题「做题记录」同样提供按次回看。这是刷题产品的标配留存功能。
2. **我方生产现状**：统计页已有「练习记录」卡，但仅读本地 storage `practiceHistory`（practice.vue 完成时写入的摘要行：时间/模块/对错数），**换设备/清缓存即丢失，且无逐题回看、无错题重练**——与竞品「点进历史逐题回看+重练」差距明确。数据侧：
   - `practice_results` 表无 uid（仅全局正确率分位用），不能做个人历史；
   - `answer_log` 表有 uid/created_at/question_id/module/submodule/correct/secs/picked/source 全字段，`idx_al_uid(uid, created_at)` 索引已建；
   - 生产实测（2026-08-29，1257 行/562 批）：落库以单题为主（批大小 1 占 480/562，practice.vue L1537 每题作答即 logAttempts），同会话相邻间隔 p50≈4.6s、p90≈445s——**不能按 created_at 相等分组，须按时间间隔切分会话**。

## 架构决策

1. **会话切分**：服务端按 uid 拉 answer_log（desc，cap 2000 行），相邻间隔 >30min 即切新会话（业界通用 sessionization 阈值，p90 445s 远小于阈值，误切风险低）。零 schema 变更、零新表。
2. **接口**（backend/app/study_api.py）：
   - `GET /api/practice/history?uid=` → `{items:[{start,end,n,correct,secs,modules:[..],source}]}` 最多 50 次会话；
   - `GET /api/practice/history/detail?uid=&start=&end=` → 该会话逐题（JOIN questions 取题干/选项/答案/解析），含 picked/correct/secs。detail 返回完整题目字段，前端可直接组 redoSet。
3. **前端**：新分包页 `pkgA/stats/practice-history`（pages.json 注册）；入口两处——「我的」页学习分组行 +「统计」页既有「练习记录」卡头部「逐题回看 ›」链接（本地摘要卡保留不动，避免回归）。列表行=时间/模块 chips/题数/正确率环形色（复用 --ok/--bad 语义），点击展开逐题（✓/✗、我的答案 vs 正解、题干两行截断），底部「重练本次错题」按钮复用既有 `redoSet` storage 通道直入 practice 页（零练习页改动）。
4. **响应式**：<768 单列；≥1024 列表限宽 880 居中，行 hover 反馈；深色全用既有 token。

## 交互规格

- 空态：无记录显示引导「去刷一组题」跳 practice。
- 会话行：`08-29 14:32 · 判断+言语 · 10 题 · 对 7`；正确率 ≥80% 绿 / <60% 红（--ok-strong/--bad-strong）。
- 展开逐题：题干截断两行，✗ 行显示「我的答案 A · 正解 C」；无错题时不显示重练按钮。
- 背题模式不落 answer_log（既有行为），天然不出现在历史里。

## 验收标准

- 生产新 uid 真实作答 2 组（跨模块、含错题）→ 历史页出现 2 次会话、字段准确；
- 「重练本次错题」直入 practice 错题重练流（既有 toast「错题重练开始」）；
- 1440/375 双视口无溢出、console 0 error、深色可读；
- 我的页/统计页入口可达；空态引导正常；
- 保护 uid 零 mutation，测试数据清理。

## 风险与未覆盖

- 30min 阈值对「挂机后继续做」会切成两次会话——展示语义可接受；
- 旧数据（无 picked 列的历史行）picked 为 NULL，逐题展示降级为只显示 ✓/✗；
- detail JOIN questions 单会话 ≤50 题，无性能风险。
