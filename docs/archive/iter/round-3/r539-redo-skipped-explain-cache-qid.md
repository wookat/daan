# R539：实现轮——`/api/mistakes/redo` 回 `skipped`（错题本入口卡「开始重练」部分命中不再静默掉题，H5/小程序练习页开场 toast 带 R527 口径）+ AI 讲解缓存命中分支 `meta` 补 `qid`；生产 `8ede6eb7 → cc3d6de0`

日期：2026-09-08（UTC 11:5x–12:0x）。分支 `devin/1788868540-r539-redo-skipped-explain-cache-qid` 从合入 #675 后的 main（`368f27e7`）另开；#676 合入后 merge 进本分支（仅 R538 文档，无冲突）。统筹者指令：R537/R538 连续取证轮，回到实现轮，把已确认的用户可感知差距转代码上线并生产复验。

## 0. 立项依据（不是新取证，是 R536-2 / R537-1 两个已登记项）

| 项 | 用户可感知形态 | 一手来源 |
|---|---|---|
| R536-2 | 错题本入口卡「开始重练」= `GET /api/mistakes/redo?limit=10`（无 `mids`），服务端只回匹配上的 `items`，手录题 / 题已下线 / 题干对不回题库的行**静默掉**；H5 `redoAll()` 只在 `items` 为空时 toast，部分命中用户完全看不到少了几题（R527 只给了「重练所选」`mids=` 路径「已加载 N 题，另 M 题…」的说明，因为那条路径客户端知道选了几条） | R536 本地 `:8525` uid `r522local`：`redo?limit=10` 回 4 题、手录行 7 静默掉（`~/r539/pre_redo.out`：`['items'] 4`，回包无任何未匹配计数） |
| R537-1 | `POST /api/explain/stream` 原文 key 缓存命中分支 `meta0` 不回 `qid`（非缓存分支回、`save_explain_cache` 落 `qid`）；两端客户端靠「服务端缺失则保留本地」兜底，但服务端契约本身不一致，且缓存行已落的 qid 从未回给客户端 | `backend/app/ai_api.py` 缓存分支源码（R537 §②）；生产 `explain_cache.qid` 非空恒 0（间接观测） |

## 1. 设计论证

### 1.1 R536-2：服务端回未匹配数，前端沿用 R527 文案，不新增 toast 形态
- **契约**：`GET /api/mistakes/redo` 由 `{"items": [...]}` 变为 `{"items": [...], "skipped": N}`；`items` 不动（字段、顺序、`_sz` 形态、`mistake_id` 全同），旧客户端忽略新键无影响。
- **`skipped` 口径**：本次扫描（`limit*2` 候选行、取够 `limit` 题即停）里**遇到的、去重后的、未掌握错题行**中对不回题库原题（有 qid 但题已下线/不存在 → 回落题干匹配仍失败；无 qid 且时政等值查 + 题干三阶 LIKE 全落空；手录题）的行数。**不计**：同题干重复行（同一题只加载一次，重复行不是「少了一题」）、空题干行（不可重练也不可展示，历史上为 0）、扫描停止后未扫到的行（那不是「本次加载」少掉的）。所以 `skipped` 是「本次加载」口径，不是「全部待掌握里有几题永远练不到」——docstring 与文档同时写明，避免被当成后者。
- **为什么不改为「回全部未匹配数」**：那要对全部未掌握行做题干匹配（每行最多 3 阶 LIKE，R534 实测非命中 3.34 s/阶），入口卡一次点击会变成秒级；而用户此刻需要知道的只是「这次开始的重练为什么比错题本里的少」。
- **前端**：H5 `book.vue redoAll()` 把 `d.skipped` 折成 R527 已有的 `redoSkippedNote(selected, loaded)`（`selected = items.length + skipped`），写 `redoNote` storage → 练习页开场 toast「错题重练开始 · 已加载 N 题，另 M 题为手录/无题库原题，无法重练」——**与「重练所选」路径逐字同口径**，不新造第二种说明；`redoSel()` 不碰 `d.skipped`（它已知 `sel.length`，避免双重计入）；`items` 为空仍走旧 toast「错题未能匹配到题库原题」；老后端无 `skipped` → `Number(undefined)||0 = 0` → 无说明，行为同改前。小程序 `book.ts → practice.ts` 经路由 query `skipped=` 透传，`utils/redo-note.ts` 文案与 H5 逐字相同；`redoset`（storage 重放）分支显式 `skipped: 0`。
- **db 层**：新增 `mistakes_redo(...) -> dict`，原 `mistakes_redo_questions(...) -> list` 保留为 wrapper（其它调用点 0 改动）；`skipped += 1` 只在最终 fail-closed 处（`if not q`）——有 qid 但 `byid` 落空的行会**穿到**题干匹配再失败才计，无 qid 行时政落空同样穿到题干匹配，所以每个未匹配行恰好计一次、任何最终匹配上的行不计。

### 1.2 R537-1：缓存命中 `qid` 优先级 = 落库 qid > 请求深链 qid > None
- `_cached_qid(hit, question_id)`：`hit["qid"]` 为正整数即回；否则请求 `question_id` 为正整数即回；否则 `None`（两端客户端「服务端缺失保留本地」逻辑接住）。`0/负/字符串` 一律不当有效 qid（fail-closed，防把 `_sz`/同款题等非 `questions.id` 的东西混进 `qid`——它们在 `save_explain_cache` 侧本就落 NULL）。
- 非缓存分支、图片题、非流式 `/api/explain`、同款题/相似题语义 0 改动。
- 为什么落库 qid 优先：缓存行的 qid 是当初「深链 + 题库命中 + LLM 完成」写下的，比这次请求携带的更接近讲解正文所属题；两者不同属异常（同题干不同 qid），以落库为准可复现。

## 2. 实修（1 commit `cc3d6de0`，8 文件 + 3 测试）
- `backend/app/db.py`：`mistakes_redo()`（回 `{items, skipped}`）+ `mistakes_redo_questions()` wrapper。
- `backend/app/study_api.py`：`/api/mistakes/redo` 改调 `db.mistakes_redo(...)`，`clamp_limit / mids ≤ 25 / uid` 守卫不动。
- `backend/app/ai_api.py`：`_cached_qid()` + 缓存命中 `meta0["qid"]`。
- `frontend-uni/src/pages/book/book.vue`：`redoAll()` 写 `redoNote`（`redoSkippedNote` 复用）。
- `miniapp-native/miniprogram/api/learn.ts`（`{items, skipped?}`）/ `pages/book/book.ts`（透传）/ `pages/practice/practice.ts`（解析 + 开场 toast）/ `utils/redo-note.ts`（新）。
- 测试：`backend/tests/test_r539_redo_skipped_explain_cache_qid.py`（redo 部分命中 / 全命中 / 全空 / 手录 / qid 指向已下线题 / 重复题干不计 / uid 隔离 / `mids` / `limit` 截断 / wrapper 回 list；`_cached_qid` 优先级 + 非法值；缓存命中 SSE `meta.qid` + 不走抽取）、`frontend-uni/tests/book-r539-redo-all-skipped.test.js`（H5 `redoAll` 源锁 + 折算文案 + 老后端兼容 + 小程序三文件源锁与文案逐字同 H5）。

## 3. 本地门（全绿，`~/r539/gate_be.out` / `gate_fe.out` / `build_h5.out`）
- backend：pytest **598 passed**（+8）、ruff 通过、pyright（`npx -y pyright app`）0 errors。
- frontend-uni：vitest **143 文件 966**（+1 文件 +6）、eslint 0 error、design tokens 116、`build:h5` 成功（bundle `index-M9JnAcJA.js → index-B_AVZd0x.js`，book 分包改动）。
- miniapp：`tsc` 0、eslint 0 error（既有 warning 不变）。`git diff --check` 空。
- 本地运行时（`:8525`，`~/r539/local_redo_after.out`）：`redo?uid=r522local&limit=10` → `items 4 / skipped 1`（手录行 7 计 1）；`mids=7` → `items 0 / skipped 1`（前端仍走「未能匹配」toast）；`mids=7,2` → `items 1 / skipped 1`；`limit=2` → `items 2 / skipped 1`（手录行在扫描顺序内）；`module=shizheng` → `0/0`。

## 4. 发版（`~/r539/pre.out` / `deploy.log`）
- 预检 11:58Z：load 0.56 / `/` 3.8G(93%) / MemAvailable 186 MB / other_builds 0 / 容器 healthy 0 重启。
- `deploy_h5.sh --skip-build` 11:59:11Z：谱系闸 OK（线上 `8ede6eb7` 是 HEAD 祖先）→ rsync → 3b 预热 → 4/6 `host: load=0.52 other_builds=0 prunes=0`，compose 11:59:23Z 起、`KG_COMPOSE_EXIT rc=0 at 12:00:54Z`（**1.5 min**，8 次 poll）→ 4a 线上 rev `cc3d6de0` → 4b 预热 → 4c Pages → 5 bundle `index-B_AVZd0x.js` = 本机 → 5b 编码变体全 JS → 6/6 全 200 → 6b `/` perf 0.99 / **a11y 0.94（间歇项，6b 取样策略待定，历轮同）** / bp 0.96 / seo 1.00 / LCP 1912 / CLS 0.00，`/tiku/` 全 1.00 → `DEPLOY_RC=0`。
- Recreate 窗 11:59–12:03Z 源站 222 请求：`200×221 / 304×1`，**5xx 0**。

## 5. 生产复采（12:03–12:04Z，`~/r539/post.out` / `post2.out`，容器内只读 GET + 隔离临时库，探针头）
- 容器 `started 12:00:53Z restarts=0 healthy oom=false`；`/api/health` `{"ok":true,"rev":"cc3d6de0"}`；load 0.63 / `/` 3.3G(94%) / MemAvailable 316 MB。
- **A. redo 契约**（真 uid、`X-Kg-Probe`）：`umst3…` `limit=25` → keys `['items','skipped']`、`items 25 / skipped 0`、`mistake_id 25`、57 ms；`limit=3` → 3/0；`umtgoh…` 8/0；`umsagb…` 3/0；不存在 uid → 0/0。**A2**：R535 那条无 qid 非时政行 `2836`（uid `umtpnlge…`，该 uid 仅此 1 行未掌握）`redo?limit=25` → `items 1 / skipped 0`、`mids=2836` 同——即该行**现在能对回题库**（首行 LIKE + 归一化前缀比较命中 `1272810`；R535 的「未匹配」是与 `shizheng_questions` 首行恒等的口径，不是 redo 匹配口径，此处勘误说明）。**生产当前所有真 uid `skipped` 均为 0 = 生产尚无自然 `skipped>0` 样本**，`skipped>0` 路径的运行时证据只有本地 `:8525`（§3）+ pytest。
- **B. 缓存命中 qid**（**部署后的容器内代码** + `DB_PATH=/tmp/r539.db` 隔离新库 + `fastapi.testclient`，缓存命中 → 不触发 LLM、不碰 `/data/data.db`）：落库 qid 4321 无请求 qid → `meta.qid 4321`；落库 4321 + 请求 7 → `4321`；落库 NULL + 请求 7 → `7`；落库 NULL 无请求 → `None`；落库 NULL + 请求 0 → `None`；五次均 `cached: true` + `event: done`。临时库已删。
- DB（ro）`answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38 / explain_cache 82`、`explain_cache.qid` 非空 0、`hits` 合计 21（B 走隔离库不触及生产行；发版前未采 hits 基线，如实）、null qid 28、WAL `4,173,592` 同字节 → **0 写入 0 PDF 0 LLM**。新容器日志 5xx 0 / Traceback 0 / redo 行 0（自然样本仍 0）。
- 非探针非 GET（11:30Z 起）2 条：`POST /api/monitor/report` + `POST /api/track`，`Cf-Connecting-Ip 140.232.64.4`（探针网段，本机 6b Lighthouse 移动 UA）→ 后端按 R386 网段路判 probe，非真人。
- 簇：`/tiku/q/*` 非探针 per10 413/402/445/433/147（12:00 段进行中），最后一行 12:03:30Z **仍在跑**；09-09 日界未到。Caddy `zalize.com`/`www` renew/obtain 行自 reload（11:17Z）起 0（47 min，6 h 窗未满）。

## 6. 事实 / 推断 / 未知
- 事实：§2–§5 全部为本机实跑 + 生产容器内一手；`skipped` 契约在生产 5 个 uid 上成立、缓存命中 `qid` 五种优先级在**部署后代码**上成立。
- 推断：「入口卡少题用户看不到」为源码 + 本地复现推出，无真人投诉样本（真人错题本行手录/下线题 0）；缓存命中 qid 的真人受益路径（深链 + 题库命中 + 命中缓存）生产至今 0 行。
- 未知 / 如实：生产 `skipped>0` 自然样本 0；小程序改动（R536 + 本轮）**仍未上真机**（Linux 无微信开发者工具上传通道，R536-1 资源缺口不变）；H5 生产端到端（点入口卡 → 练习页 toast）未用 testing agent 录屏（未另行授权），只核了 bundle 一致 + 接口契约；a11y 0.94 为 6b 间歇项未归因。

## 7. 登记
- R539-1（P3）：`skipped` 是「本次加载」口径；若日后真人出现大量手录/下线行并反馈「每次都少 M 题」，再评是否加「全部待掌握里 K 题无法重练」的错题本级提示（需全表匹配或在写入侧落 `redoable` 标记）。
- R535-1 更新：行 `2836` 在 redo 匹配口径下可命中，`questions(substr(question,1,N))` 表达式索引的 P3 收益进一步降为 0 行。
