# R477：自然 `mistakes/analysis` 仍 0 + AI 问答 `explain/stream` 真实触达后的会话留存（`ask_cur` / `ask_sessions` / `explain_cache` 只读）+ R475「explain ×2」那对重复的形态坐实（只取证登记，0 代码不发版）

日期：2026-09-07 06:02Z → 06:2xZ。生产仍 `2bad8bc`（R475 容器 05:32:03Z 起，healthy、RestartCount 0）。全部只读：宿主 Caddy 全文件（09-05 18:44Z 起）+ SQLite `mode=ro` + 源码（main `backend/app/ai_api.py`、W7 分支 `origin/devin/w7-mp-flat-v3` 的 `pkgSocial/ask/ask.ts` / `api/social.ts` / `utils/sse.ts`；事发 21:40Z 时 `ask.ts` 自 10:33Z `156677a` 起未再改，所读即事发代码）。

## 0. 结论先行

1. **自然 `mistakes/analysis` 合并命中：仍不可观测**——R475 容器起后非探针 `POST /api/mistakes/analysis` **0 条**（部署后总请求 228，全部本机/探针）。三条件核法继续挂着。
2. **AI 问答真实触达后的会话留存 = 1 uid / 1 条 / 无后续动作**：非探针只有 `umst3tuisd7lgzaka`（原生小程序非正式版、vivo）真的发过讲解请求；`ask_cur` 里留下 **1 条**问答（1007 字讲解、`saved:false`、追问 `fu` 0、评分 0、未归档进 `ask_sessions`），之后 21:43:08Z 起该 uid 再未出现，`ask_cur` 服务端 7 天口径（`api_ask_cur_get`：`updated_at` 超 7×24 h 返 `{}`）到 **09-13 21:41Z** 过期。`ask_sessions` 全表 1 行、`ask_cur` 另 4 行、`explain_cache` 82 行 / 21 hits 全部是探针 uid（140.232.64.x 出口 / 自动化 UA）。另一非探针 uid（`umsagboriz4qyurnd`，H5 VivoBrowser 分享链路）打开问答页 **6 次**（`GET ask/cur` + `ask/sessions` 成对、回包 `{}` / `{"items":[]}`）**0 次提交** → 与 R476 一致的浏览形态。→ **不改**：n=1 不支持任何「留存/召回」立项。
3. **R475 登记的 `explain/stream` ×2 那对重复，本轮用三方证据坐实为「网络切换 → 端侧首条流失败 → 用户手动重点」，不是自动重发也不是服务端问题**：
   - Caddy：第 1 条 `POST explain/stream` 起点 21:40:02.775Z 出口 `223.83.2.220`，其前 1.6 s 有 `GET /api/access_info`（= `submitText → ensureAccess()` 的固定前置请求）；第 2 条起点 21:40:08.976Z 出口 **`39.158.40.85`**，其前 1.4 s **又一次** `GET /api/access_info`（同新 IP）→ 第 2 条是走完 `submitText()` 的**手动提交**（代码里没有任何自动重试路径）；此后该设备全部请求都在新 IP，旧 IP 最后一条新请求就是第 1 条流。
   - `ask_cur.items`：**只有 1 条** rec，`ts`（端侧 `Date.now()`）= 21:40:07.553Z，落在两次起点之间、与第 2 次 `access_info` 21:40:07.556Z 同毫秒级 → 留下的是**第 2 次**提交；第 1 次的 rec 从未进入 `results`（源码：rec 只在 `onMeta` 或成功返回后 `unshift`，`catch` 路径不插入、只 `setError` + 重新展开文本面板并保留题目原文/所选答案）。
   - `explain_cache`：两行（`key` = 抽取题干 hash、`raw_key` = 原文 hash，同一条流末尾 3 ms 内先后写入）`created_at` 21:40:50.631 / .634Z = 第 2 条流的结束（Caddy 21:40:50.645Z），`hits` 0、`up/down` 0；两 key 均无 21:40:44Z（第 1 条流结束）版本残留，与 `INSERT OR REPLACE` 语义一致、无法（也不需要）区分第 1 条是否曾落库。
   - 服务端两条都 200、时长 41.51 / 41.67 s、SSE 体 12831 / 14843 B = **两次完整生成**：端侧放弃的第 1 条流在源站跑满 41.5 s；「客户端断了但源站不知道」的机制推断见 §3.3。
   → 结论：**端侧一手成因是网络切换（旧接口 socket 失效）**，与 R475 推断一致且现在有 `access_info` 双发 + `ask_cur` 单 rec 的实证；「服务端 single-flight/流回放」的收益 = 省 1 次 LLM + 用户少等 ≈6 s（第 1 条 21:40:44 vs 第 2 条 21:40:50 结束），全文件仍只此 1 对 → **继续登记不做**。
4. 到期项无增量：`error_reason` 7 / ≥09-11 **0**、probe=0 33/1、growth 20/4、push_subs 0、weekly 2、exam_attempts probe=0 1/64、WAL 4,124,152 B 同字节；(c) 新容器后 228 请求 `/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0。

## 1. R475 发版后 (c) 补量 + 自然 single-flight 观测（06:02Z）

filter `ts ≥ 1788759123`（05:32:03Z，与 `docker inspect StartedAt` 同秒）。

| 项 | 值 |
|---|---|
| 部署后请求总数 | 228 |
| 非探针 `POST /api/mistakes/analysis` | **0** |
| `/assets/*` 404 / 5xx / `/api/monitor/report` / 小程序 UA | 0 / 0 / 0 / 0 |
| 容器 | `2026-09-07T05:32:03.100Z` 起，healthy，restarts=0 |

## 2. AI 问答留存（非探针口径）

归类：`probe = ip ∈ 140.232.64.x ∨ X-Kg-Probe ∨ 自动化 UA`。

### 2.1 表侧
| 表 | 行 | 非探针行 |
|---|---|---|
| `ask_sessions`（归档会话） | 1（`umtpnlge4mrl9kyxq`，09-06 10:22Z，n=1） | **0**（该 uid 全部 10 请求出口 140.232.64.5） |
| `ask_cur`（当前会话） | 5 | **1**：`umst3tuisd7lgzaka` sid 0、ts 21:41:01.653Z、1 item、1535 B |
| `explain_cache` | 82 / hits 21 / down 1 | 事发两行 hits 0、up/down 0 |

`ask_cur` 那 1 条 item 的字段（只列长度）：`qid 0`、`module` 8 字、`module_name` 4 字、`question_type` 9 字、`question_text` 83 字、`explanation` **1007 字**（首段「【答案】C｜【方法】独立事件乘法｜…」，与 `explain_cache` 该 key 的 1007 字同长）、`explain_key` 64、`user_answer` 1（A）、`userText` 83、`saved` **false**、`fu` **[]**。

### 2.2 请求侧（Caddy 全文件，非探针 AI 相关 21 条）
| 路径 | 次数 | uid |
|---|---|---|
| `GET /api/ask/cur` + `GET /api/ask/sessions` | 7 + 7 | `umsagboriz4qyurnd` 6 对（08:59:13 / :19、10:43:27 / :35 / :40 / :44Z，回包 2 B / 12 B）+ `umst3tuisd7lgzaka` 1 对（21:39:58Z） |
| `POST /api/explain/stream` | 2 | `umst3tuisd7lgzaka`（§3） |
| `POST /api/ask/cur` | 1 | 同上，21:41:02.038Z，Content-Length 2631 |
| `POST /api/mistakes/analysis` | 4 | 同上（R474/R475 那 4 条） |
| `followup` / `similar` / `rate` / `ask/sessions` POST / `DELETE` | **0** | — |

漏斗（非探针）：打开问答页 2 uid → 提交讲解 1 uid → 拿到讲解 1 条 → 追问 0 / 评分 0 / 存错题本 0 / 归档 0 / 之后再回问答页 0。

## 3. `explain/stream` ×2 逐秒时间线（UTC，Caddy 起点 = ts − duration）

| 起点 | 结束 | 出口 IP | 请求 | 备注 |
|---|---|---|---|---|
| 21:39:58.647 | | 223.83.2.220 | `GET ask/cur`、`GET ask/sessions` | 问答页 onLoad（回包 `{}` / 空列表） |
| 21:40:01.194 | | 223.83.2.220 | `GET /api/access_info` | `ensureAccess()` ①（`submitText` 前置） |
| **21:40:02.775** | 21:40:44.281 | 223.83.2.220 | `POST explain/stream` 446 B | 200 · 41.51 s · 12831 B |
| 21:40:07.556 | | **39.158.40.85** | `GET /api/access_info` | `ensureAccess()` ②（新 IP） |
| （端侧 rec.ts 21:40:07.553） | | | | `ask_cur` 里唯一 rec 的 `Date.now()` |
| **21:40:08.976** | 21:40:50.645 | 39.158.40.85 | `POST explain/stream` 446 B | 200 · 41.67 s · 14843 B |
| 21:40:10.13–21:40:13.0 | | 39.158.40.85 | 首页 / 成长页 9 连 / 卷库 / 首页 | 第 2 条流发出 ~1 s 后已切走（TabBar switchTab 会 unload 问答页；流在 JS 运行时里继续） |
| 21:40:50.631 / .634 | | （源站） | `explain_cache` 写 `key` / `raw_key` | 第 2 条流末尾 |
| 21:41:00.73 | | 39.158.40.85 | 首页 onShow 5 请求 | 47 s 无请求后回到前台/首页 |
| 21:41:02.038 | | 39.158.40.85 | `POST ask/cur` 2631 B | `persistSession()` → 1.5 s 防抖后的 `saveAskCur` |
| 21:41:04 起 | | 39.158.40.85 | 错题本 → analysis ×4 → … → 21:43:08 最后一条 | R474/R475 段 |

### 3.1 判定链
- 第 2 次 `access_info` 只会由 `submitText()/submitImage()` 的 `ensureAccess()` 发出，且 `doExplain` 无自动重试、`streamPost` 失败降级的是**非流式** `/api/explain`（全文件该路径非探针 0 条，说明降级请求要么没发、要么在网络切换空窗内没到边缘）→ 第 2 条流是**用户手动重点「开始讲解」**。
- 第 1 次 `doExplain` 的 rec 不在 `ask_cur`（唯一 rec.ts 对应第 2 次）→ 第 1 次走了 `catch`：`setError(...)` + `textOpen:true` 保留原文与所选答案 → 用户看到失败文案后 ~4.8 s 内重点，两次请求体同 446 B（题目原文 + `user_answer=A` 原样保留）。
- 两条流之间出口 IP 从 `223.83.2.220` 永久切到 `39.158.40.85`（旧 IP 此后 0 新请求）→ 端侧失败原因 = 网络切换使旧连接失效（`wx.request fail` / 分块解码中断二者之一，端侧无日志不细分）。

### 3.2 与 R475 的关系
R475 §1 表「更像网络切换后端侧流中断 → 用户重点」= 推断；本轮 `access_info` 双发 + `ask_cur` 单 rec + IP 永久切换三条一手把它从推断升为**判定**。R475 文档已加指针。

### 3.3 服务端为何跑满 41.5 s（推断，未验证）
第 1 条流在源站 200 / 41.51 s / 12831 B 完整结束，说明 uvicorn 没收到 `http.disconnect`（Starlette `StreamingResponse` 收到即取消生成器）。最可能：手机侧旧接口 socket 失效时**没有 FIN/RST 到达边缘**，Cloudflare 边缘对眼球的 TCP 连接仍「活着」直到自身超时，于是继续从源站拉流；Caddy/uvicorn 看不到任何断开信号。这意味着**此形态下服务端不可能靠「检测断开」省掉第 1 次 LLM**，只能靠合并/回放；但全文件 1 对、收益 ≈ 1 次 LLM + 6 s，不立项。此推断未在生产复现（复现需制造真机网络切换，本机无微信开发者工具/真机）。

### 3.4 顺带确认（不改）
- `doExplain` 在 `onMeta` 就把 `loading` 置回 false（按钮解锁）而 `rec.streaming` 仍 true——理论上允许流未完成时再提交；但本对重复不是这条路径（第 2 次在第 1 次 meta 之前的 6 s 内、且第 1 次 rec 未落）。登记给 W7，不在 #619 动 W7 文件。
- `ask_cur` 的 `POST` Content-Length 2631 vs 落库 1535 B（服务端 `json.dumps(items, ensure_ascii=False)` 重序列化）差值未逐字节核；字段集与 `toItems()` 一致，不影响结论。

## 4. 到期项（06:02Z）
| 项 | 值 |
|---|---|
| `answer_log` probe=0 | 33 条 / 1 uid |
| `growth_events` probe=0 | 20 / 4 |
| `mistakes.error_reason` 非空 / ≥09-11 | 7 / **0** |
| `push_subs` | 0 |
| `weekly_reports` | 2 |
| `exam_attempts` probe=0 / total | 1 / 64 |
| WAL | 4,124,152 B（同字节） |

## 5. 如实说明
- 「网络切换」是出口 IP 永久切换 + 端侧代码路径反推，无端侧日志 / 真机复现；两个 IP 段均为运营商 NAT 池，`39.158.40.85` 全文件 401 请求自 09-06 00:10Z 起、是否全部同一设备未核。
- `ask_cur.items[0].ts`（21:40:07.553）比源站处理 `access_info` ②（21:40:07.556）还早 3 ms，而代码里 `doExplain` 在 `await fetchAccessInfo()` 返回之后才建 rec → 端侧时钟比源站慢至少一个往返（百毫秒级），偏差量级正常；「rec 属于第 2 次」假设端侧时钟偏差 <5 s（两次起点相隔 6.2 s），若端侧时钟快 ≥5 s 则归属反转，但「只有 1 条 rec = 只有 1 次端侧成功」的结论不变。`fetchAccessInfo` 全小程序只在 `ask.ts ensureAccess()` 调用（`git grep` 核过）。
- §3.3 服务端跑满的机制为推断；Caddy 对客户端中途断开的记账形态（R475 §6 已登记）本轮也未另做实验。
- `explain_cache` 无法区分第 1 条流是否曾落库（`INSERT OR REPLACE`）；不影响任何结论。
- 留存漏斗 n=1，「不立项」是样本不足的判断，不是「留存功能没问题」。
- 0 代码，无新门；沿用 R475 门（pytest 504 / ruff / pyright 0）。

## 6. 后续
- 挂：非探针 `mistakes/analysis` 一出现即核三条件（R476 §1）。
- 挂：`explain/stream` 同 uid 同 `raw_key` 第 2 对出现时再评「合并/回放」；同时记 `ask_cur` 是否单 rec、是否有第 2 次 `access_info`。
- 挂：`umst3tuisd7lgzaka` 的 `ask_cur` 09-13 21:41Z 服务端过期；若该 uid 在此前回问答页会 `GET ask/cur` 命中 —— 作为「留存被用到」的第一个可观测点。
- 挂（W7 合 main 时）：`onMeta` 即解锁按钮 vs `rec.streaming`；成长页 ≤8 请求（R476 §4.3）；`aiLoading` 守卫（R475）。
- 挂（老板侧）：宿主盘/守护 prune 参数、`www.zalize.com` 证书 10-04、`WX_MINIAPP_SECRET`、R385 第二冷样本、#619 人工合并。
