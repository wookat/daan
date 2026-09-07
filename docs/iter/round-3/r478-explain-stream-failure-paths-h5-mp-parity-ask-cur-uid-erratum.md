# R478：`explain/stream` 三条失败路径 H5/小程序对照（源码）+ 生产 `[llm] stream` 告警 0 + R477 `ask_cur` 归类勘误

日期：2026-09-07 06:19Z–06:36Z（只读；0 产品代码；生产仍 `2bad8bc`）。

## 0. 结论

1. **R477 勘误**：`ask_cur` 5 行里 R477 写「另 4 行全是探针 uid」——错 1 行。`umsacie728f4ghcv8` 的那条（09-05 17:06:00Z，qid 234494 深链、`user_answer:B`、1188 字讲解、`saved:false`、`fu:[]`）落在 R446 登记的 **09-05 16:42–17:05 Windows Chrome 双代理出口会话**，该 uid 当时**探针三路都不命中**（`growth_events` probe=0 ×3），R446 判「身份不可考（内部经代理 / 外部老用户二者都解释得通）」；它变成「探针 uid」是 **R475（09-07 05:36Z）我拿它带 `X-Kg-Probe: 1` 做 single-flight 探针**之后的事。修正后的非探针口径：**AI 问答留存 = 2 uid / 2 条 / 0 后续动作**（`umst3tuisd7lgzaka` 小程序 + `umsacie728f4ghcv8` 身份不可考），两条都是 `saved:false / fu:[] / 未归档 / 0 回访`。n=2 仍不支持留存/召回立项，结论方向不变。
2. **H5 `pages/ask/ask.vue` 与 W7 `pkgSocial/ask/ask.ts` 的讲解提交路径同构**（W7 由 H5 移植）：`ensureAccess()`→`doExplain()`→`streamExplain()`；R477 判定的「流失败→`catch` 重开文本面板保留原文→用户手动重点」在 H5 上完全相同；**三条失败路径两端都一样、都未处理**（§2）——但生产 **0 次出现证据**（§3）→ 只登记不改。
3. **生产 `[llm] stream` 告警 0**：当前容器 + `kaogong-reports/app-log/` 全部 20 个归档（覆盖 09-06 15:11Z 起，非「14 天」——R437 起才归档）`[llm] stream … finish=… content=0` / `finish=length` / `[llm] main|rescue` **全 0**，Traceback 0；`explain_cache` 82 行 `explanation` 最短 50 字、空 0。→ 「空正文 / 截断」的 explain 流在有日志的窗口内**没发生过**。
4. 自然 `mistakes/analysis` 合并命中仍不可观测：R475 容器起（05:32:03Z）后 229 请求全部 `140.232.64.x`（本机），非探针 AI/ask/interview 0 条；`umst3tuisd7lgzaka` 未回访。到期项无增量。

## 1. R477 勘误：`ask_cur` 5 行逐 uid 归类（含 probe 列表交叉）

| uid | `ask_cur` 时间 | 归类依据（含 probe 列的表：`answer_log`/`exam_attempts`/`growth_events`） | 归类 |
|---|---|---|---|
| `umsacie728f4ghcv8` | 09-05 17:06:00Z（qid 234494） | `answer_log` 60 行 probe **NULL**（08-01 老 uid、R374 前历史）；`growth_events` 7 = p1 4（**全在 R475 09-07 05:36Z 我做探针之后**）+ **p0 3（09-05 16:42–17:05，R446 会话）** | **非探针·身份不可考**（R446 原判） |
| `umtpnlge4mrl9kyxq` | 09-06 10:18Z | 无 probe 列表行；R477 已按 140.232.64.x 出口 + 自动化 UA 归探针（`ask_sessions` 唯一行也是它） | 探针 |
| `umtppgte7u8emh2vs` | 09-06 11:28Z | `answer_log` 30 / `exam_attempts` 6 / `growth` 13 **全 p1** | 探针 |
| `umtpqwm7p0put2j5p` | 09-06 11:45Z | `answer_log` 1 / `growth` 1 全 p1；item `explain_key` 空（图片路径 `uploadExplain` 回包无 key） | 探针 |
| `umst3tuisd7lgzaka` | 09-06 21:40:07Z | `answer_log` 35 = p0 33 + p1 0（+NULL 2）；`exam_attempts` p0 1；R477 主样本 | 非探针 |

`umsacie728f4ghcv8` 那条的字段：`qid:234494`（言语·细节判断，2015 国考副省级）、`module:yanyu`、`question_text` 272 字、`userText` 280 字、`user_answer:B`、讲解 1188 字（首行 `【答案】D｜【方法】细节判断·选项比对`）、`explain_key` 对应 `explain_cache` 行 `created_at` 17:07:18Z、hits/up/down 0/0/0、`qid` 列 NULL（R421 前无该列回填）；`ask_cur.updated_at` 17:07:22Z（讲解结束 +1.5 s 防抖 +网络，吻合）。这是 R378/R421 **qid 深链直通抽取路径**在非探针口径下的**首条落库样本**（Caddy 当前文件 09-05 18:44Z 起，该会话请求不在其中，只能靠 DB）。

为什么 R477 归错：R477 §2 用「140.232.64.x 出口 / 自动化 UA」按 **Caddy 当前文件** 归类，`umsacie728f4ghcv8` 在文件内只出现在 R475 探针（带头）——文件起点之前的 09-05 会话不可见，且我在 R475 复用了一个**本就身份不可考的老 uid 当探针**，把两种身份混在同一 uid 下。教训入 SKILL：探针必须用专用新 uid，不得复用任何在 R446/R452 身份表里出现过的 uid；`ask_cur`/`ask_sessions` 归类要和 R446/R452 的 uid 身份表交叉，不能只看当前 Caddy 文件。

## 2. `explain/stream` 三条失败路径：H5 / W7 源码对照（只读）

| 路径 | 服务端（`backend/app/ai_api.py` `gen()`） | H5 `api.js streamExplain` + `pages/ask/ask.vue doExplain` | W7 `utils/sse.ts` + `pkgSocial/ask/ask.ts` | 用户看到 |
|---|---|---|---|---|
| A. **meta 前失败**（HTTP 非 2xx / 网络断 / 抽取 LLM 抛错→`event: error`） | `except` → `event: error` | `feedSse` 见 `error` 抛 / `!resp.ok` 抛 / `!state.meta` 抛「生成失败：无响应」→ `catch`：`error=e.message`，`if (txt) textOpen=true`，`qtext` 未清空 | 同（R477 §3 已核） | 错误条 + 文本面板重开、原文保留 → 可手动重点（**R477 那对就是这条**） |
| B. **meta 后、done 前失败**（LLM 流中途 `httpx` 异常→`event: error`；或边缘断开无 error 事件） | 有异常→`event: error`；边缘断开→服务端不知情继续跑满（R477 §3.3 推断） | `error` 事件→`catch`；但 `onMeta` 已 `results.unshift(rec)` 且 `rec.streaming=true`，`catch` **不改 `live.streaming`** → 卡片永久「思考中/生成中」spinner（`html` 空）或半截正文无评分/追问 chips；`persistSession()` 未调用→不落库；`qtext` 未清空但 `textOpen` 只在 `txt` 时重开。边缘断开无 error：`reader.read()` done→**按成功返回**（`{...meta, explanation: state.full}`，不核 `state.done`）→ 半截正文当完整、落 `ask_cur`、清空输入 | 同构：`onMeta` 时 `loading=false`、`rec.streaming` 仍 true（R477 §3.4 已登记）；`wx.request` 断开走 `fail`→reject→`catch` 同 H5 | 卡死 spinner / 半截当完整 |
| C. **空正文**（模型 `content=0` → 服务端 `[llm] stream … content=0` WARN，`full.strip()` 空只是不写缓存，仍 `event: done`） | 不抛、不缓存、正常 `done` | `state.full=''` → 按成功 resolve → `applyExplain(live,'')` → `html=''`、`streaming=false` → **空卡片**带评分行 + chips；`persistSession()` 落空 `explanation`；输入清空 | `finish()` 同样按 meta 有就 resolve | 空卡片、题目文字丢 |

R397/R399 只给 `mistakes/analysis`（非流式 `chat`）补了 `EmptyReply`/截断回落；`explain/stream`（`chat_stream`）三条路径未覆盖。**修法形态（备查，本轮不做）**：C 在服务端 `full.strip()` 空时改 `yield event: error`（复用 R397 文案，与 R398 失败不缓存一致）；B 在两端 `catch` 里 `live.streaming=false` + 把 `rec` 从 `results` 移除或标错误、H5 `!state.done` 视为中断；均 ≤10 行。**不做的理由**：§3 生产 0 出现证据，按 SOP 无一手不改；改动落在 `frontend-uni/api.js`（H5）+ W7 `sse.ts`（不在 #619）+ 后端 `gen()`，一半在别人分支。

## 3. 生产证据：三条路径出现频次

| 数据源 | 覆盖 | 结果 |
|---|---|---|
| `docker logs deploy-kaogong-1`（当前容器 05:32Z 起） | 47 min | `[llm] stream|main|rescue` **0**，`POST /api/explain/stream` 0 |
| `kaogong-reports/app-log/*.log.gz` 20 个归档 | **09-06 15:11Z → 09-07 05:30Z**（R437 起每次重建前归档；不是 14 天） | `[llm] stream` **0**、`[llm] main|rescue` 0、`Traceback` 0；`POST /api/explain/stream` 2 条（= R477 那对，`460120f` 归档）且均 200 |
| `explain_cache` 82 行 | 全量 | `explanation` 空 0、<50 字 0、min 50 |
| `ask_cur` 5 + `ask_sessions` 1 | 全量 | items 内 `explanation` 空 **0**（C 路径若发生过且被 `persistSession` 落库会留下空 explanation；7 天口径内没有） |

→ A 发生 1 次（R477 对，已闭合为「网络切换手动重点」）；B、C **0 观测**。B 里「边缘断开服务端跑满」仍是 R477 §3.3 推断。

## 4. 自然 single-flight / 回访 / 到期项（06:19Z）

- R475 容器起后 Caddy **229** 请求：`140.232.64.4` 227 + `.2` 2（全本机）；2xx 227 / 3xx 2；`/assets/*` 404 0、5xx 0、monitor 0、小程序 UA/Referer 0；非探针 `explain*|mistakes/analysis|ask/*|interview*` **0**；`umst3tuisd7lgzaka` 0 出现（09-13 21:41Z 前继续挂）。
- `answer_log probe=0` 33/1、`growth_events probe=0` 20/4、`error_reason` 7 / ≥09-11 **0**、`push_subs` 0、`weekly_reports` 2、`exam_attempts probe=0/total` 1/64、WAL 4,124,152 B（同字节）、healthy / RestartCount 0。

## 5. 限制（如实）

- app-log 归档只从 09-06 15:11Z 起（约 14.3 h 有日志），「B/C 0 发生」只对这段成立；09-05 及之前无应用日志；Caddy 分不出 `event: error`（HTTP 仍 200）。
- `chat_stream` 中途 `httpx` 异常与 `gen()` 的 `except` 都**不写日志**，B 路径即便发生也只在 SSE 里可见——这是可观测性缺口，登记（若后续要核 B，需先给 `gen()` except 加一行 `log.warning`；本轮不加，避免「为取证而改产品」与 0 证据下改码相冲）。
- `umsacie728f4ghcv8` 09-05 会话身份仍按 R446「不可考」；本轮只纠正「它不是探针」，不升格为「外部真人」。
- W7 侧按 `origin/devin/w7-mp-flat-v3` 源码对照，未真机；H5 侧按源码 + R477 行为链，本轮未在生产制造失败态（不发探针流）。
- 0 代码无新门，沿用 R475 门（pytest 504 / ruff / pyright 0）。

## 6. 后续

- 非探针 `mistakes/analysis` 一出现即核三条件；`explain/stream` 第 2 对同 R477 法。
- `umst3tuisd7lgzaka` 09-13 21:41Z 前回访观察。
- B/C 路径：等自然出现（`ask_cur` 空 explanation / 半截 + `streaming` 卡死无法从服务端看，只能靠用户反馈或加日志）；若后续任一路径有一手，按 §2 修法形态最小修，H5+后端在 #619、W7 交 W7 分支。
- 探针改用专用 uid（SKILL 已加）。
