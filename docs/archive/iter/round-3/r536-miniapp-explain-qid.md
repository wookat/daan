# R536：小程序问答页深链 qid 不随 `/api/explain/stream` 上送（实修，小程序端 2 文件）+ 无 qid 非时政行「重练」用户可见态核 + redo 自然样本仍 0 + 簇 11:01Z 仍在跑

> 2026-09-08。分支从 #673 合入后的 `origin/main`（`3e31054c`）另开。**服务端 / H5 0 改动 → 本轮无 VPS 发版**（生产仍 `8ede6eb7`，H5 bundle `index-M9JnAcJA.js` = 线上）；小程序改动要经微信开发者工具上传才到真机（Linux 无此通道，见 §5）。

## §0 结论一览

| 候选 | 一手 | 结论 |
|---|---|---|
| A 小程序问答页「加入错题本」是否带 `question_id` | 源码：`pkgSocial/ask/ask.ts` `save()` 早已 `question_id: r.qid \|\| null`；但 `api/social.ts streamExplain()` 请求体只有 `text/user_answer`，**深链 qid 从未发给服务端**；`applyMeta()` 用 `m.qid` 无条件覆盖本地 qid（服务端缓存命中 / 未命中题库时不回 `qid` → 本地 qid 被清空）。Node 打桩跑真实 TS（`~/r536/probe_a.out`）：改前 wire body 无 `question_id`；改后 `…&question_id=9`，本地 `:8525` 回 `meta.qid: 9` 13 ms | **命中 → 实修**：`ExplainArgs.questionId` + 流式表单带 `question_id`（`questionId > 0` 才带，与 H5 `api.js:570` 同口径）；`applyMeta` 改 `askQid(m.qid) \|\| r.qid`；`ask.ts` 调用带 `questionId: qid \|\| null`。图片题 / 非流式降级 `uploadExplain` **不带**（服务端 `/api/explain` 无该参数，H5 降级同样不带；本地 qid 由 `applyMeta` 保留） |
| B 错题本无 qid 非时政行「重练」回落链路用户可见态 | 本地 `:8525` uid `r522local`（`id 7` 手录非时政无 qid + `id 2` 时政无 qid）：`redo?mids=7` → `items []` 17 ms → H5 toast「错题未能匹配到题库原题」；`mids=7,2` → 1 条 `_sz`（`mistake_id 2`）→ R527 说明「已加载 1 题，另 1 题为手录/无题库原题，无法重练」；入口卡 `redoAll`（`limit=10` 无 `mids`）→ 4 条，`id 7` **静默掉**（该路径不知道应加载几题，无说明行） | **成立不改**：全落空 fail-closed、批量部分命中有说明；入口卡静默掉是 R527 有意边界（服务端不回「未匹配数」）。生产该形态仅 1 行且为探针产物（R535 `2836`）→ 登记 R536-2（P3，条件：真人非时政无 qid 行出现；修法 = redo 回包加 `unmatched` 计数） |
| C R534 后 redo 生产自然请求首个耗时样本 | `~/r536/r536_c2b.out` 11:01:29Z：全部日志文件 `/api/mistakes/redo` 15 行全 `probe`（`umst3…` + 探针网段/头），R534 发版（10:27Z）后新增 0 | **未知（无样本）**；不以探针行代替 |

## §1 A：源码 + 运行时一手

- 深链 qid 入口链（源码）：`utils/ask-prefill.ts:28` / `pkgSocial/favorites/favorites.ts:291` 写 `redoQid` → `ask.ts:195 pendingQid = askQid(redoQid)` → `:385 qid = txt ? pendingQid : 0` → `rec.qid = qid`。**断点**在 `streamExplain()`：改前 `data: { text, user_answer? }`，`ExplainArgs` 没有 qid 字段。
- 服务端契约（`backend/app/ai_api.py`）：`/api/explain/stream` `question_id: int | None = Form(None)`，`_linked()` 命中即跳过识题 LLM、以题库答案为准、`meta.qid` 回题号；`/api/explain`（非流式）**无** `question_id` 参数。
- 后果（推断，与 R535 `2836` 形态一致）：小程序深链讲解每题都走识题 LLM（题干被 LLM 改写）；缓存命中时回包无 `qid` → `applyMeta` 把本地 qid 覆盖成 0 → 「加入错题本」落 `question_id NULL` → 该行重练/复习只能靠 LIKE 前缀（R534 阶梯）。`2836` 是否由深链进入未知（Caddy 不记 body）。
- 运行时（`~/r536/probe_social.js` + `tsconfig.probe.json`，tsc 编出 `api/social.ts` 真码，`wx.request` 打桩打印 wire body，打本地 `:8525`）：
  - 改后 qid 9：`WIRE_BODY …&user_answer=B&question_id=9`，`META_AT_MS 9 … "cached":false,"qid":9`（`probe_a_full.out`）；
  - qid 0：body 无 `question_id`，服务端 `meta_seen false` 直接 `AI 服务未配置`（本地无 LLM key，`probe_b.out`）→ 只验证请求构造与 meta，**未验证完整讲解生成**。
- 生产侧只读：`explain_cache 82 行 qid 非空 0`（历轮恒 0）；非探针 `/api/explain/stream` 全日志 3 条（09-05 H5 1 条 78.7 s；09-06 21:40Z 真 appid `wx01f2f29cfe51baba` vivo V2405A 2 条 41.5/41.7 s = R475/R477 已归因的「网络切换→手动重点」对），是否带 qid **未知**（不记 body）。

## §2 改动与测试

- `miniapp-native/miniprogram/api/social.ts`：`ExplainMeta.qid?`、`ExplainArgs.questionId?`；`streamExplain` 表单 `...(questionId && questionId > 0 ? { question_id } : {})`。
- `miniapp-native/miniprogram/pkgSocial/ask/ask.ts`：`applyMeta` `r.qid = askQid(m.qid) || r.qid`；`streamExplain({... questionId: qid || null})`。同款题保存 `question_id: null` 不动（LLM 生成题非题库题）。
- `frontend-uni/tests/miniapp-r536-explain-qid.test.js`（8 例，`wx.request/uploadFile` 打桩真跑 TS）：qid 9 → 表单三键 + `meta.qid` 透传；0/null/-3/undefined → 无 `question_id` 键；图片题走 `wx.uploadFile` `formData {user_answer}` 无 qid；源锁 `ask.ts` 调用/`applyMeta`/两处 `postMistake`；`askQid` 边界；契约字段。
- 门：pytest 590 / ruff；vitest 142 文件 960（+8）/ eslint 0 error / tokens / build:h5（bundle 同线上）；miniapp `tsc --noEmit` 0 / eslint 0；`git diff --check` 空（`~/r536/gate_*.out`）。

## §3 (c) / 簇 / 宿主（`~/r536/r536_c1b.out` 10:55Z / `r536_c1c.out` 11:01Z / `r536_c2b.out`）

- 簇 `/tiku/q/*` 非探针 per10：10:30 398 / 10:40 372 / 10:50 422 / 11:00（4 min）53；10h 1192 行 372 IP；**last 11:01:14Z 仍在跑**（09:34Z 段已 87 min）；09-09 00:00Z 日界未到 → 转 R537。
- 非探针非 GET（排 `140.232.64.x`）10:38Z 起 0；容器 healthy 0 重启；R534 发版后容器日志 5xx/Traceback 0；load 0.52 / `/` 3.8G(92%)。
- DB `mode=ro`：`answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38 / explain_cache 82`、`mistakes null qid 28`、`paper_submits` 表不存在、`umst3 (32,45,1)`、`answer_log/mistakes max created` 同前；WAL `4,173,592` 同字节 → 0 写入 / 0 PDF / 0 LLM。

## §4 登记

- R536-1（P2，资源缺口）：小程序改动需 macOS/Windows 微信开发者工具上传体验版/提审才到真机；本会话 Linux 无通道，代码已合入待发。并入 R528-1 小程序整包节奏。
- R536-2（P3）：入口卡「错题重练」对未匹配行静默掉；条件 = 真人非时政无 qid 行出现；修法 = redo 回包 `unmatched` + 前端复用 `redoSkippedNote`。
- R535-3 关闭（本轮实修）。

## §5 如实

- 小程序端只有 Node 打桩 + tsc 真码一手，**无真机 / DevTools 运行时**；完整讲解生成未跑（本地无 LLM key）。
- 「深链讲解每题走识题 LLM」「2836 由此产生」为推断；生产不记请求体，无法回溯历史小程序请求是否带 qid。
- 生产段只读 GET / 日志 / `mode=ro`，0 POST；簇归因推断；无 testing agent 录屏（未另行授权）。
