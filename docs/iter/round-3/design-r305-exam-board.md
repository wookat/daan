# R305 设计：模考成绩报告「同卷排行榜 Top 10」

## SOP-10 取证（verified）

- 每日一练已有排行榜先例：`db.daily_set_board`（昵称优先、`uid[:6]+'***'` 脱敏兜底、top N）+ 完成页/SSR 榜单（R73/R74）。
- 模考侧只有百分位：`GET /api/exam/rank/{attempt_id}`（insights.py）返回 rank/total/beaten_pct/avg/distribution，rank-card 只画「已击败 X% + 排名 + 平均分 + 分布直方图」；**同卷排行榜（谁考了多少分）全站无处可看**——报告页、卷详情 SSR、卷库列表均无。
- 竞品：粉笔模考交卷后有成绩排行榜（昵称+分数+名次），是模考社会证明与传播的核心构件；R283–R285/R304 已把社会证明铺到卷详情/列表/海报，榜单是同线自然收口。
- 数据现成：rank 接口内已按同卷 per-user-best 聚合（`MAX(score) GROUP BY uid`），与 exam_paper_social/R285 口径一致；user_profile 有 nickname。

## 用户价值

交卷后不仅知道「击败 X%」，还能看到同卷高分段真实构成（第 1 名多少分、差距多少），强化「再刷一次冲榜」动机；昵称展示复用每日一练口径，不暴露完整 uid。

## 实现边界

- 后端：`api_exam_rank` 响应纯增量补 `board` 字段——同卷 per-user-best 前 10（score DESC、先参与时间 ASC），条目 `{rank, name, score, me}`；name = user_profile.nickname[:20]，无昵称回落 `uid[:6]+'***'`；me = 该行 uid 是本人。不新增端点、不改既有字段，uid 鉴权语义不变（仅本人可查）。
- 前端：`src/exam-board.js` 纯函数 `examBoardRows(rank)`——rank 或 board 缺失/长度 <2 返回 null 不渲染；本人不在前 10 时按既有 rank/score 追加「我」行（me=true，rank 取 rank 字段）。rank-card 分布图下新增「同卷排行榜」区块（top 行 name/score、me 行高亮 --brand），复用卡内既有 token 视觉。
- 不做：独立榜单页、SSR 榜单外显（卷详情公开页不放个人分数，保持只有人数/平均分）、时间维度筛选。
- fail-closed：样本 <2 不渲染；nickname 空白回落脱敏 uid；不伪造。

## 验证

- 本地：ruff/pytest（新增 board 断言：排序、脱敏、me 标记、昵称截断）、pyright、lint、vitest（examBoardRows 边界）、build。
- 生产：临时 uid 种子同卷多人成绩+一人设昵称，报告页 1440/375 实测榜单排序/脱敏/「我」行；低样本单人卷不渲染；验后全库清理 leftover 0。
