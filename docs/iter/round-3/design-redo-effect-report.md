# 设计方案：错题重练效果报告 + 复习计划贯通（round-3 第 2 轮，P0-2）

日期：2026-08-29 ｜ 对应审计项：docs/iter/round-3/competitor-audit.md P0-2

## 1. 问题

竞品（粉笔错题本）重练结束后有明确的「效果反馈」：这组错题里纠正了几道、还有几道没掌握、对复习进度的影响。我们现状：

- `book.vue` 的「错题重练」→ `/api/mistakes/redo` 组题 → `practice.vue` 普通刷题流程；
- 完成页只有通用报告（正确率环/用时/模块分布/答题卡），**与错题本无任何回环**；
- 重练答对**不推进** SRS（`record_review` 只在错题本复习模式调用），答错会经自动存错题路径重置 streak——即重练做对了 10 道，错题本复习计划纹丝不动，用户感知不到重练价值。

## 2. 架构决策

- 复用既有 SRS 单一入口 `db.record_review`（review_log + streak/next_review/mastered），不新建表、不新建打分逻辑，重练答对 = 一次成功复习。
- 答错不需要新逻辑：练习页答错已走 `save_mistake` 去重更新（times+1、streak 清零、next_review=now），语义正确。
- 数据地基：重练产生的 review_log 行与普通复习同构，后续掌握度聚合（R3 外显）直接消费，无需迁移。

## 3. 接口变更

`GET /api/mistakes/redo`（`db.mistakes_redo_questions`）：每个返回的题目附带 `mistake_id`（匹配到的 mistakes 行 id，含题号直查与文本模糊两条匹配分支）。无 breaking change，旧客户端忽略新字段。

## 4. 前端交互规格（practice.vue）

- redoSet 启动的场次记录 `mistake_id` 随题传递；
- 完成结算（`submitResult`）时，若为错题重练场次：对每道已作答且带 `mistake_id` 的题，答对 → `POST /api/review/{mid} {correct:true, uid}`（推进复习计划，返回 mastered/next_review_days）；答错走既有自动存错题路径（已重置复习）；
- 完成页在正确率环下新增「错题重练效果」卡：已纠正 X ／ 仍错 Y ／ 达成掌握 Z，附一句话说明（答对的已推进复习计划、仍错的明天优先再练），点击可回错题本；
- 非重练场次不显示该卡；失败请求静默降级（非关键路径），不阻塞结算页。

## 5. 验收方式

- 本地 `npm run build:h5` 通过；后端如有 pytest 则通过。
- 生产（uid `umteojq4sltdhorhm`）：错题重练一组 → 完成页出现效果卡且数字与作答一致 → 返回错题本，答对题的「下次复习」被推后 / streak+1；1440 与 375 双视口无溢出、0 console error。
