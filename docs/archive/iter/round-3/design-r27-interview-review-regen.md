# R27 设计方案：中断面试 session 的点评状态外显 + 重新生成点评

日期：2026-08-30 ｜ 轮次：round-3 R27 ｜ 范围：`backend/app/interview.py`、`frontend-uni/src/api.js`、`frontend-uni/src/pkgA/interview/interview.vue` + 本文档

## 1. 取证（生产现状）

R25 引入评分即落库后，中断 session（review=""）会出现在 history，但从 history 打开详情时 `interview.vue` 的点评卡走 `v-else` 分支，永远显示「考官正在撰写点评…」——用户无法区分「生成中」与「已中断」，也无法补救。竞品（粉笔/夸克 AI 类反馈）对失败态均有明确提示与重试入口。

## 2. 方案

### 后端（interview.py）
新增 `POST /api/interview/sessions/{sid}/review/stream`，body `{uid}`：
- 按 sid+uid 查 session，404 兜底；`rate_limit(f"itv_regen:{uid}", 10, 600)`。
- 仅当 `review` 为空才允许（非空返回 400「点评已存在」），防重复刷 LLM。
- 用存量 `question_id`（`question_by_id` 复原题目）、`answer_text`、`scores` 重建 `_review_prompt`（summary 传空），`chat_stream` SSE：data 增量 → 完成 `_update_review(sid, full)` → `event: done`；异常 `event: error`（`_friendly_ai_err`）。

### 前端
- `api.js`：H5 新增 `streamInterviewReviewRegen({ sessionId, onDelta })`（带 X-Access-Code + authHeader，SSE 解析复用 streamInterview 模式）；非 H5 不提供（小程序走非流式 /answer 不产生中断态）。
- `interview.vue`：`loadSession` 置 `reviewMissing = !s.review`；点评卡三分支——有 review 渲染、`reviewMissing` 显示「点评生成被中断」+「重新生成点评」按钮（点击→streaming 置真→SSE 增量渲染→完成后 reviewMissing 置假）、否则原「考官正在撰写点评…」。

## 3. 不做

- 不做增量 review 持久化（正常流仍整段回填）；不改评分；不改小程序端。

## 4. 验收

- 生产：制造中断 session → history 进详情显示中断提示与按钮 → 点击真实重新生成 → 点评完整渲染且强刷后持久（DB 已回填）。
- 重复点击/已有点评的 session 调接口返回 400。
- 1440/375 视觉正常、console 0 error。
