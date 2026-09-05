# R399：AI 生成类接口「正文被截断」根因 + rescue 优先的代价取证 → 主通道优先；「事后答对仍待掌握」21 条逐条归因（SRS 不改）

日期：2026-09-05 · 分支 `devin/*-r399-ai-truncated-main-first`（base=main）· 类型：后端 fail-closed 补强（1 处）+ 两个生成类路由通道顺序调整 + SRS 设计论证（零改动）

## 1. 起点（R398 遗留两条）

1. R398 生产复验 4 次 `POST /api/mistakes/analysis` 均 200，但其中一次正文只有 126 字、止于「## 薄弱点诊断\n1」（首次 309 字）。R398 handoff 写作「回落后正文偏短」——本轮先查这句话对不对。
2. 生产 `mistakes` 221 行、已掌握 0；21 道未掌握错题事后已在别处答对。「答对即掌握」与 R371 SRS 契约相反，先出论证再定是否改。

## 2. AI 正文截断：一手取证

### 2.1 R398 那次 126 字不是「回落后」的正文（修正 R398 表述）

R398 容器日志 `[llm] rescue kimi-k3 failed (EmptyReply…) fallback to deepseek` 恰 2 条，对应 4 次请求中耗时 ≈45 s 的两次（44.8 s/309 字、45.9 s/249 字）——回落 = rescue 耗满预算（≈25–30 s）+ 主通道（≈20–30 s）。另两次 23.0 s/316 字与 **34.0 s/126 字** 短于任何一次回落的下界，只能是 rescue（kimi-k3）直接返回的正文。126 字止于列表序号「1」，与 `finish_reason=length` 截断形态一致（推断：R398 没记录 finish_reason；本轮在容器内复采 11 次 rescue，结果全为「0 字」或「完整」，正好落在窄窗口里的截断样本没再抽到，见 2.2）。

### 2.2 容器内复采（`~/r397_llm_probe.py` 3 轮 + `~/r399_rescue_probe.py` 6 次，同 prompt/temperature 0.4，key 不打印）

rescue = kimi-k3（推理模型，`reasoning_tokens` 计入 `max_tokens`）：

| max_tokens | 次 | finish | content 字 | reasoning_tokens | 耗时 |
|---|---|---|---|---|---|
| 900 | ×3 | length / length / length | 0 / 0 / 0 | 897 / 897 / 897（reasoning 原文 1,374 / 2,316 / 2,717 字） | 30.6 / 27.2 / 25.7 s |
| 1200 | ×2 | length / length | 0 / 0 | 1,197 / — | 31.8 / 39.1 s |
| 1600 | ×2 | **stop** / length | **351** / 0 | 1,268 / 1,597 | 41.7 / 44.8 s |
| 2400 | ×2 | **stop** / length | **401** / 0 | ≈1,000 / 2,397 | 43.9 / 60.1 s |

主通道 = deepseek-v4-pro-0817（`max_tokens=900` 不变）：

| 次 | finish | content 字 | completion / reasoning tokens | 耗时 |
|---|---|---|---|---|
| 1 | stop | 336 | 1,461 / 1,232 | 25.9 s |
| 2 | stop | 354 | 1,092 / 850 | 18.5 s |
| 3 | stop | 345 | 1,976 / 1,735 | 31.3 s |

事实：
- kimi-k3 的 reasoning 长度不可控（同 prompt 897→2,397 token 都出现），`max_tokens` 提到 2,400 仍有一半概率全部耗在 reasoning 上，且失败一次要 60 s。**调 `max_tokens` 不能解决**，只会拉长失败耗时。
- 正文被截断（content 非空且 `finish=length`）发生在「reasoning 恰好在预算即将耗尽前结束」的窄窗口，`max_tokens=900` 的 8 次 rescue 样本（R397 探针 1 + R398 真实请求 4 + 本轮 3）里 1 次（R398 那 126 字，推断），本轮 11 次未再抽到——低频但一旦出现前端直接把半截文当成功渲染。
- 主通道 4/4（R397 1 + 本轮 3）`finish=stop`、正文 336–354 字、18–33 s；`completion_tokens` 1,092–1,976 均 **>900**——该网关对 deepseek 的 `max_tokens` 不含（或不约束）reasoning，正文从未被 900 截断。
- rescue 优先在本接口上的实际代价：生产 R397/R398 + 本轮共 14 次 rescue 样本（含不同 max_tokens），**900 下 1 次可用 / 1 次截断 / 6 次空**；每次空回落多付 ≈25–30 s，用户端总耗时 45–60 s（不回落时主通道单独 18–33 s）。

### 2.3 改动

`backend/app/llm.py`
- `TruncatedReply(EmptyReply)`；`_content(data, reject_truncated=False)`：正文空仍抛 `EmptyReply`；`finish_reason=length` 且正文非空时，`reject_truncated=True` 抛 `TruncatedReply`，否则打一行 warning 原样返回。
- `chat_fast()` 的 rescue 尝试改用 `_content(..., reject_truncated=True)`：截断 → 与空正文同路回落主通道（既有 `[llm] rescue … failed` warning 会写出 `TruncatedReply: AI 回复被截断（N 字）`）。主通道 `chat()` 不拒截断——4/4 样本无截断，且对可用正文制造 502 不是更好的产品行为，只留 warning 供日志观察。
- 所有 `chat_fast` 调用方（`/api/ai/coach`→已改走 chat、题目抽取 `chat_json(fast=True)`、申论 `chat_fast`）都因此不再把半截正文/半截 JSON 当成功。

`backend/app/ai_api.py`
- `/api/mistakes/analysis`、`/api/ai/coach` 从 `llm.chat_fast` 改为 `llm.chat`（主通道优先；主通道 5xx/额度码时 `chat()` 本就回落 rescue，可用性不降）。理由见 2.2：这两个是「生成 250–300 字中文 Markdown」，不是 `chat_fast` 文档里的「轻量分类/抽取」；rescue 推理模型在这类 prompt 上 900 token 预算基本只够 reasoning。`/api/ai/coach` 未单独采样，按同模型、同预算量级（800）、同类 prompt 的机制推断一并调整，标注为推断。
- `max_tokens` 不动（900/800）：主通道未被其约束，rescue 侧调大也无效（2.2）。

`backend/tests/test_llm_empty_reply.py` +3 用例 +1 断言：rescue 截断正文（复刻 126 字止于「1」）→ 回落主通道并取主通道正文；主通道截断正文原样返回；`TruncatedReply ⊂ EmptyReply`；错题分析路由 monkeypatch `chat_fast` 为断言失败、`chat` 抛空 → 502（证明不再走 chat_fast）。

### 2.4 不做 / 未验证
- 不换 rescue 模型、不给 rescue 单独设更短 timeout（R397 候选）：主通道优先后 rescue 只在主通道 5xx/额度码时才会被打到，此时任何正文都比没有强。
- 未验证：截断样本本轮未在生产自然抽到（低频窄窗口），修复依赖契约不依赖复现；`/api/ai/coach` 生产调用量与效果未单独采样。
- 前端「约需 30–60 秒」文案不动：主通道单独 18–33 s 在文案区间内；主通道故障回落 rescue 时仍可能 60 s+。

## 3. 「事后答对仍待掌握」21 条：逐条归因（`~/r399_srs_probe.py` / `~/r399_srs_probe2.py` / `~/r399_srs_probe3.py`，容器内只读；R371 分界点取 #580 合入 2026-09-04 05:51Z）

| 组 | 行数 | uid | 错题创建 | 事后答对时刻 | `review_count/streak` | 归因 |
|---|---|---|---|---|---|---|
| A | 12 | u26 | 08-29 17:55 | 08-29 19:01–19:09 | rc 1–2 / streak 1–2，`review_log` 1–2 行 | 事后答对**已推进** SRS（走的是显式复习 `/api/review`）；未掌握是因为阶梯只走到第 1–2 级，且两次复习间隔仅几分钟 |
| B | 1 | u27 | 08-30 13:03 | 08-30 14:15 | 0 / 0 | 答对发生在 **R371 之前**，当时普通作答的 `answer_log` 不推进 SRS——历史行 |
| C | 8 | umtg6to4yv | 08-30 19:15 | 08-30 19:18（同一练习内 3 分钟后重做） | 0 / 0 | 同 B，R371 之前的历史行 |

- 21 条全部在 R371 之前：12 条 SRS 已按当时契约（显式复习）推进，9 条是 R371 上线前的普通作答历史行。R371 之后真人「答对命中自己未掌握错题」的 `answer_log` **0 行**（`POST_R371_OK_HITS=0`）——契约未被违反，但也还没有真人样本能正向证明 R371 在生产起作用（R371 复验用的是测试 uid，已清理）。
- 已掌握 0 的算术：`REVIEW_INTERVALS_DAYS=[1,3,7,15,30]`，`mastered` 需 `streak > 5`，最短路径 1+3+7+15+30 = 56 天；生产最老错题 34.9 天，`review_log` 相邻两次复习间隔 8/9 对 <1 天、1 对 3 天——没有任何用户按阶梯回来过 6 次，0 掌握是站龄 + 阶梯的必然结果，不是缺陷。
- 「答对一次即掌握」不采纳：C 组 8 条是同一练习里 3 分钟后重做答对，间隔 3 分钟的正确率不能证明记住了——这正是 SRS 用间隔而不用次数的原因；把这类答对记为掌握会把 8 道题从复习队列里永久移走。
- 不做回填：B/C 9 条虽然历史上答对过，但按 R371 契约推进一次只是 streak 0→1、下次 1 天后复习，它们现在本就在到期队列里（`next_review` NULL 或已过期），用户下次复习答对即推进，回填收益≈0 且改历史数据。
- 若日后要让「掌握」更早可见，候选是**降低阶梯层数或加中间态展示**（如 streak ≥3「已巩固」标签），需要真人复习行为数据（当前 59 uid 中只有 5 个进过复习）——本轮不动。

## 4. 本地门禁
pytest 406（+3）/ ruff / pyright 0。
