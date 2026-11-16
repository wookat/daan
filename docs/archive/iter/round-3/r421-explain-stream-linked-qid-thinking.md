# R421 / R421b：AI 讲解首字前 65 s 空白——题库题 question_id 直通跳识题 LLM + 推理模型 reasoning 阶段 thinking 心跳

- 生产 rev：`2573df1` → **`42f31aa`**（R421）→ **`adfdc17`**（R421b，ask 存入错题本带 qid）
- PR：#619（R400–R421 同分支）
- 一手取证：生产 caddy/容器日志、容器内直连上游 LLM 流探针（模型名与主机名可见、密钥不打印）、生产 `/api/explain/stream` 探针（X-Kg-Probe）、testing agent 真实 UI（375/1440）+ 容器 DB 对账

## 1. 现象与取证

| 项 | 一手证据 |
|---|---|
| 慢请求 | 生产 `/api/explain/stream`：正常浏览器 referer、HTTP 200、**duration ≈ 79 s**（多条）；本机探针复现：meta 12–13 s、正文首字 65 s、done 74 s |
| 上游拆段（容器内，真题 297481） | `extract_question` **14.75 s**；流：headers 2.36 s → reasoning 首包 2.42 s → **content 首字 44.16 s** → done 51.96 s；`n_reason_deltas 2754`，`n_content_deltas 665`，`finish=stop` |
| 配置（容器内读取，不打印 key） | `TEXT_MODEL deepseek-v4-pro-0817`（推理模型）、`MODEL/FALLBACK gpt-5.5`、`RESCUE kimi-k3`、`TIMEOUT read=180` |
| 代码 | `llm.chat_stream` 只取 `delta.content`，`reasoning_content` 丢弃 → 正文首字前客户端零事件；题库深链（`redoQid` 已在前端）仍走 `extract_question` |
| 真人 | 相关请求 `probe=NULL`（历史兼容口径），**不归因为可确认真人**；`WX_MINIAPP_SECRET` 未配的 `/api/auth/wxlogin 503` 为设计返回 |

结论：两段串行空白 = 识题 LLM（题库题本可跳）+ 推理阶段无信号（可透出进度、不透出推理文本）。不调大超时、不做假降级。

## 2. 修法（最小、fail-closed）

- 后端 `POST /api/explain/stream` 新增可选 `question_id`（Form）。`engine.extract_from_qbank(q, text)`：题库行存在 + 题干去空白前 40 字逐字出现在提交文本 + 模块合法 → 直接构造 extracted（模块/题型/`known_answer`/qid），disabled 行不取答案；任一不满足返回 `None` 回原识题路径。含图请求不走直通。
- `_explain_messages` 有 `known_answer` 时附「题库标准答案：X，讲解须以此为准；推导不同须按标准答案复核并在易错点说明分歧」。
- `llm.chat_stream(with_thinking=True)`：reasoning 增量产出 `llm.Thinking(chars)`；默认 `False` 行为不变（`@overload` 让旧调用方类型仍为 `str`，pyright 0）。
- `ai_api`：每 ≥`THINKING_TICK_SEC`（1 s）发 `event: thinking` `{"secs","chars"}`；meta 新增 `qid`。
- 前端 `api.js` 三端 `streamExplain({questionId,onThinking})`、`feedSse` 解析 `thinking`；`ask-link.js` `thinkingSecs/thinkingLabel`；`ask.vue` 传 `questionId: qid`、流式卡占位「AI 正在推理…（已 N 秒）」/ ≥30 s「AI 推理接近完成，讲解正文马上出现…」。
- R421b：`ask.vue save(r)` 带 `question_id: askQid(r.qid) || null`。

## 3. 生产探针（部署后，X-Kg-Probe）

| 场景 | headers/meta | thinking 首发 / 个数 | 正文首字 | done | meta |
|---|---|---|---|---|---|
| linked qid=297481（未缓存） | **0.28 s** | 3.18 s / 26 | 29.9 s | 36.3 s | `qid 297481, shuliang, 数量关系-星期日期问题, cached false` |
| 错 qid=243872（题干不匹配） | 7.9 s（回识题） | 10.1 s / 30 | 41.7 s | 47.9 s | `qid null` |
| 同题第二次（缓存） | 0.25 s | — / 0 | 0.25 s | 0.25 s | `cached true, qid null`（原文快路径，前端自回填） |

容器 healthy 0 重启、40 min 日志 5xx/Traceback/locked 0；磁盘部署前 90%/5.0 G、后 91%/4.3 G；free ~90–100 MB。

## 4. 复验（testing agent）

- R421（`test-r421-ui`，375 主 / 1440 补）：深链 `/tiku/q/709458` 选 B → 练习判错 → 「用花生十三方法详解」→ ask：FormData `question_id=709458`、meta 186 ms、thinking 27 个（键恰 `{secs,chars}`，间隔 1.0–1.16 s）、占位「生成中…」→「AI 正在推理…（已 N 秒）」→「接近完成…（已 30 秒）」、正文 30.4 s 首行【答案】A 无推理草稿、「查看原题」跳 709458；无 qid 手输：无 question_id、「AI 识题中…」→ meta 10.4 s、thinking 61、正文 75.9 s；缓存：161–169 ms、0 thinking；1440 深链 709452 同过；回归 存入/追问 34 s/同款题 54 s/历史；`/api` non-2xx 0、console/pageerror 0；清理 10 行 LEFTOVER 0。**FAIL（P1）**：ask「存入错题本」不带 qid → DB `question_id NULL` → 错题卡再问无 redoQid、无「查看原题」。
- R421b（`test-r421b-ui`）：同路径 DB 行 `2796 question_id 709458 times 2`（与练习自动存行按 qid 合并）、错题卡「AI 详解」再问 FormData 带 qid、「查看原题」可跳；纯 ask 路径（搜索 709452 →「AI 详解本题」→ 存入）POST body `question_id 709452`、新行 2797；`/api` 57 次 non-2xx 0；healthy 0 重启；清理 8 行 LEFTOVER 0。

## 5. 如实说明 / 遗留

- 推理阶段时长（30–65 s）是上游模型行为，本轮只让用户「看得见进度」，未缩短；无 qid（手输/拍照）路径识题 LLM 8–15 s 仍在。
- `known_answer` 对讲解正确性的影响本轮只核了两题正文首行答案与题库一致（A/C），未做批量比对。
- 缓存命中 meta.qid=null 属既定快路径，前端回填；含图请求不走直通。
- P2 遗留：practice 页 `uni.vibrateShort` 无 fail 回调 → 桌面 Chrome `unhandledrejection vibrateShort:fail`。
- 相关流量仍为 `probe=NULL`/探针，无可确认真人；不伪造 probe=0。
