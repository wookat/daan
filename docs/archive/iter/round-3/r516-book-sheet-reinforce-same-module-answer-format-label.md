# R516：错题本列表「···」错题操作单 + 「同考点强化 5 道新题」`reinforceFromMistake` 落点 375/1440 只读整页审 → 命中 ① 时政/手录错题操作单标题显「单选 · 更多操作」（纯作答形式被当题型标签）② 后端 `reinforce_questions()` submodule 回退不限 module（同名二级题型跨模块 15 个、`submodule=?` 全索引扫描）→ 两处最小修；1109 IP 簇仍在跑、09-07 日报 humans 终值 1444/1446、09-08 已 250；发版 compose 重建超 600 s（宿主 load 12–15 + 兄弟构建 2 + 层缓存再丢）→ `DEPLOY_RESUME=1` 收口，重建窗 72 条 503 全为簇

日期：2026-09-08（UTC 09-08 00:0x–00:4x）。代码 `94803e0b` 随 PR #640 合入 main（`bd6514f6`）；本文档/handoff/SKILL 在新分支。
生产 `22a38390` → `94803e0b`。

## 0. 结论

1. **(c) / 到期项**：R515 容器整窗（23:33:44Z–00:29:12Z，1177 请求）assets 404 / mpUA / monitor / 非探针 POST / 401·403 / Traceback 全 0、WAL `4,173,592` 同字节；**5xx 53 + R516 容器 19 = 72 条 503**，全部落在 00:28:10Z–00:29:25Z **compose 重建窗**（旧容器 Recreate → 新容器 00:29:12Z 起、首个 healthy 00:29:25Z），全是簇的 `GET /tiku/q/*`（非探针，Caddy 上游等待 ~25.1 s 后 503），无一条真人/探针；发版后 00:29:25Z 起 5xx 0。probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；公告「详情」/`home_bundle`/`mistakes_total` 非探针触达 **无样本**；`questions?module=时政` 两容器窗 0 条（R515 门控生效后自动加练不再发）。两容器窗非探针非 bot 995 行里 **992 行是簇**、其余 3 行同 UA/`en-US`/无 Referer 形态（`/tiku/t/*`）。无新的外部真人证据。
2. **簇**：09-07 UTC 日终值 **1437 行 / 1435 IP**（22:24:51Z → 23:59:58Z，96 分钟无 >120 s 间断，15.0 行/分，峰 34，UA 14 种，全 200，每 IP ≤2）；09-08 UTC 00:00:00Z → 取证末 00:32:13Z 又 **572 行 / 527 IP**（17.3 行/分，峰 97 = 重建窗排队重试，503 72 条全在此），仍在跑。`crawler-stats.json`（00:23:03Z cron）：`humans.page {09-06: 7, 09-07: 1444, 09-08: 250}`、`humans.ips {…, 09-07: 1446, 09-08: 250}`；复算：09-07 page 1455 行里簇 1437、真人 IP 1448 里只在簇里的 1435；09-08 page 573/572、ips 528/527。**管理台「候选真人」09-07/09-08 数字基本全是这一簇**。归因仍只有请求头/节奏特征、无 IP 情报；剔除属口径设计变更，登记不改（R515 §7 同）。
3. **W10**：`user_profile` `test-w10-*` 行 **0**（R515 时 2 行，`user_profile` 10→**9**）、边缘 09-07 全日 `POST /api/profile` 4 条全 probe=1 `140.232.64.5`——**推断** W10 事后清了自己的两行（与 R512 11→9 形态相同，未求证）。
4. **改前一手（`umst3` 真数据，dist `22a38390`）**：
   - 错题本列表 20 卡、tabs「待掌握 30 / 已掌握 2 / 收藏」、`docSW==cw`。操作单（`kg-sheet` 底部弹层，375 面板 375 宽、`panelBottom 800` 贴底、动作 343×49 / `min-height 48px` / 14 px）：**时政 2914 标题「单选 · 更多操作」**，动作只「标为已掌握 / 删除 / 取消」（R515 门控生效：无「练3道同类」；「同考点强化」本就要 `tag3`，时政无）；行测 2808 比重 / 2784 定义判断 / 1952 综合分析 标题正确（「比重 · 更多操作」…），动作 7 项「同考点强化 5 道新题 / 练3道同类 / 题目纠错 / 分享给队友 / 标为已掌握 / 删除 / 取消」。1440 同形态（面板 448 宽居中）。
   - 「单选」根因：`book.vue` `tagName(m)` 优先取 `m.question_type`，时政 27 行 `question_type='单选'`（`/api/shizheng/daily` 来源写的是**作答形式**而非题型），分组键 `groupKey()` 同源 → 列表分组也叫「单选」。生产 `mistakes.question_type` 里 `单选` 只出现在时政；行测题的 `question_type` 是真题型（定义判断/类比推理/科技/…，含 `法律-民法典` 这类带 `-` 的复合值）。
   - 「同考点强化 5 道新题」（2808 比重）：`practiceLaunch {kind:'reinforce', module:'ziliao', submodule:'比重', tag3:'ZL-JQ-04', count:5}` → 练习页 `GET /api/questions?mode=reinforce&limit=5&module=ziliao&submodule=比重&tag3=ZL-JQ-04` → 首题「资料分析 / 比重 / 真题」`1/2`（harness 用同参无副作用 GET 替代；`reinforce` 端点会 INSERT `reinforce_log`，本轮不落库，`reinforce_log` 保持 2 行）→ 作答后态正常。路径正常。
   - **后端回退隐患（生产 DB 只读复算，`~/r516_db3.out`）**：`reinforce_questions()` tag3 池不足时回退 `submodule=?` **不带 module**——活跃题库里**同名 submodule 跨模块 15 个**（逻辑判断 changshi/panduan/yanyu、历史人文 changshi/yanyu、定义判断 changshi/panduan、细节理解 yanyu/ziliao、行程问题 / 经济利润 / 周期与日期 / 浓度问题 panduan/shuliang …），未掌握错题里 **143 条**的 submodule 属此类；全库 260 条带 tag3 的未掌握错题里 5 条 tag3 池 <5 会走到 submodule 回退（`umst3` 比重 tag3 池 1 → 回退取 4）。`EXPLAIN`：`submodule=?` = `SCAN questions USING COVERING INDEX idx_q_pick`（生产实测 **5099 ms**，宿主 load 13），`module=? AND submodule=?` = `SEARCH … (module=? AND submodule=?)`（**2.6 ms**）。
5. **修**（`94803e0b`，后端 1 + 前端 1 + 源锁 2，native 未动）：
   - `backend/app/db.py` `reinforce_questions()`：`sub_cond = ("module=? AND submodule=?", [module, submodule]) if module else ("submodule=?", [submodule])`——有 module 时同名二级题型限同模块并走 `idx_q_pick` 前缀；无 module 保留旧兼容路径。
   - `frontend-uni/src/pages/book/book.vue`：`ANSWER_FORMATS = ['单选','多选','判断','不定项']`；`tagName(m)`：`question_type` 为空或 ∈ `ANSWER_FORMATS` → `modName(m.module)`（时政 → 「时政」）；其余保持原逻辑（`-` 取后段）。操作单标题 / 列表分组键同源受益。
   - 源锁：`backend/tests/test_r516_reinforce_same_module.py`（同名 submodule 多模块种子：有 module 只回同模块、无 module 兼容、`EXPLAIN` 必须 `SEARCH idx_q_pick` 非 `SCAN`；对旧逻辑跑过一次确认 FAIL）；`frontend-uni/tests/book-r516-tagname-answer-format.test.js`（源锁抽 `tagName()` 执行：时政 `单选` → 时政、行测题型不变、空 → 模块名、标题/分组语义）。
   - 门：pytest 535 / ruff / pyright 0；vitest 124 文件 867 / eslint / lint:tokens / lint-pages 0 error / build:h5；`git diff --check` 空。
6. **发版（如实，`~/r516_deploy.log`）**：预检 mem_avail 281 MB / 4.5 G（91%）/ **load 10.78** / 兄弟构建 0 → `compose-started 00:14:50Z`；轮询 600 s 未收敛 `FAIL`（`DEPLOY_RC=1`，脚本按设计留 compose 在宿主后台）。宿主现场 load 14.80 / **other_builds=2**（兄弟会话同机 build）；BuildKit **层缓存再丢**（pip 全量 126 s、`COPY backend` 106 s、导出层 178.8 s、解包 33 s；R469 同形态）。`KG_COMPOSE_EXIT rc=0 at 00:29:15Z`、容器 `00:29:12Z rev=94803e0b` healthy 0 重启 → `DEPLOY_RESUME=1 --skip-build` 接续 4a–6：Pages 部署、「线上 bundle 与本机构建一致」、7 种编码变体 JS、回归 7/7 200、6b `/` **0.99** / a11y 1.00 / LCP 1567 / CLS 0.06、`/tiku/` 1.00 / 985、`RESUME_RC=0`。重建窗 ~75 s（00:28:10Z 首个 503 → 00:29:25Z healthy）内 72 条 503 全是簇（§0.1）；无 OOM（内核 20 min 无 OOM 行）。
7. **改后生产复采（dist `94803e0b`，`~/r516/post/`）**：375/1440 时政 2914 操作单标题 **「时政 · 更多操作」**、动作仍「标为已掌握 / 删除 / 取消」（不给时政造同考点强化）；比重 2808 「比重 · 更多操作」7 项不变；`docSW==cw`、errs []。`reinf` 375：`practiceLaunch` 同改前、首题「资料分析 / 比重 / 真题」`1/2`、答后态正常、`aborted ['POST answer_log','POST track']`。后端：容器内 `db.py:5270` 含 `module=? AND submodule=?`；生产 DB `EXPLAIN` 走 `SEARCH idx_q_pick (module=? AND submodule=?)`；`reinforce_log` 仍 2 行；`umst3` 自 R515 发版起四表新增 0、`mistake 1953/2784/2914` 未变。
8. **如实**：本机 CDP（`X-Kg-Probe: 1`）；`GET questions?mode=reinforce` 在网络层拦下记 URL 后改由同参无副作用 GET 回包（真端点会写 `reinforce_log`）；`GET review/cur` 桩 null；非 GET `/api/**` 全 abort；点了操作单动作「同考点强化」与练习页选项。**浏览器本地路径，不是真人证据**；后端回退修正在生产只以 `EXPLAIN` + 容器源码核，没有触发真 `reinforce`（要触发得落库）。

## 1. 边界与方法

- `~/r516/sheet_path.py <375|1440> <sheet|reinf> <id,…>`：`sheet` 逐 id 打开「···」→ 量 `kg-sheet` 面板/标题/动作几何/错因 chip 行/`docSW`，点「取消」；`reinf` 打开 → 点「同考点强化 5 道新题」→ 记 `practiceLaunch` + 拦截的 `reinforce` URL → 练习页首题 → 选 A → 量答后态。
- 生产只读：`~/r516_pre.sh`（(c) + 簇 + humans 复算 + W10 + DB 到期项）、`~/r516/r516_db{2,3,4}.sh`（reinforce 回退复算 / 同名 submodule / `question_type` 分布 / EXPLAIN）、`~/r516_post.sh`（发版后全项 + 容器源码 + EXPLAIN + `reinforce_log`）、`~/r516_5xx.sh`（503 时序 vs 重建窗）。

## 2. 改前生产读数（dist `22a38390`，`~/r516/sheet_{375,1440}.out` / `reinf_375.out`）

| 项 | 375 时政 2914 | 375 比重 2808 | 1440 时政 | 1440 比重 |
|---|---|---|---|---|
| 标题 | **单选 · 更多操作** | 比重 · 更多操作 | **单选 · 更多操作** | 比重 · 更多操作 |
| 面板 | 375×331 @469，底 800 | 375×527 @273 | 448 宽居中 | 同 |
| 动作 | 标为已掌握 / 删除 / 取消（343×49） | 同考点强化 5 道新题 / 练3道同类 / 题目纠错 / 分享给队友 / 标为已掌握 / 删除 / 取消 | 同（448×49） | 同 |
| `docSW/cw` / errs | 375/375 / [] | 同 | 1425/1425 / [] | 同 |

`reinf` 2808：`practiceLaunch {reinforce, ziliao, 比重, ZL-JQ-04, 5}` → `questions?mode=reinforce&limit=5&module=ziliao&submodule=比重&tag3=ZL-JQ-04`（拦） → 「资料分析 1/2」→ 答后「看解析/展开解析/有用/有误/写笔记/讨论」。

## 3. 前置数据核（`~/r516_db{3,4}.out`）

- 活跃题库 module：changshi 30907 / panduan 22916 / shuliang 32556 / yanyu 18294 / ziliao 4698。
- 同名 submodule 跨模块 15 个（活跃题数）：历史人文 13129、逻辑判断 10327、定义判断 6400、逻辑填空 6261、类比推理 5863、中心理解 5729、语句表达 3625、行程问题 3067、经济利润 2593、细节理解 2542、政治 2031、周期与日期 1174、浓度问题 1036、其他 167、数学运算 43。`逻辑判断` 池：panduan 10320 / changshi 3 / yanyu 4。
- 未掌握错题 submodule 属跨模块同名的 143 条；带 tag3 未掌握 260 条里需 submodule 回退 5 条、需 module 回退 0。
- `mistakes.question_type`：时政全部 `单选`；行测为真题型（含 `法律-民法典`、`逻辑判断(结论与解释)` 等）；`None` 少量。
- `reinforce_log` 2 行（08-09 `u14`、08-31 `umtg4sot…`），本轮前后不变。

## 4. 修

- `backend/app/db.py` `reinforce_questions()` submodule 回退条件按 module 限定（见 §0.5）。
- `frontend-uni/src/pages/book/book.vue` `ANSWER_FORMATS` + `tagName()`。
- 不改：时政题不造同考点强化/同类池（无池，R515 口径）；`reinforce_log` 写入；小程序 `book.ts`（同名 `tagName` 逻辑是否同形态未核，登记 W7）。

## 5. 门 / 发版（`~/r516_gates_{be,fe}.out`、`~/r516_deploy.log`）

- 见 §0.5 / §0.6。首跑 `DEPLOY_RC=1` 是 600 s 轮询上限（R468 登记的形态），不是构建/应用失败；`DEPLOY_RESUME=1` 收口 `RESUME_RC=0`。
- 宿主级：load 10–15、mem_avail 255–363 MB、兄弟构建 0→2、层缓存丢（pip 全量）——三项叠加把 build+recreate 拉到 ~14.5 min（00:14:50Z → 00:29:15Z），重建窗 ~75 s 出 72 条 503（全簇）。与 R469/R494 同一宿主级问题，登记不改脚本。

## 6. 改后生产复采（dist `94803e0b`，`~/r516/post/`、`~/r516_post.out`）

| 项 | 375 时政 2914 | 375 比重 2808 | 1440 时政 | 1440 比重 | 375 reinf 2808 |
|---|---|---|---|---|---|
| 标题 | **时政 · 更多操作** | 比重 · 更多操作 | **时政 · 更多操作** | 比重 · 更多操作 | — |
| 动作 | 标为已掌握 / 删除 / 取消 | 7 项不变 | 同 | 同 | 点「同考点强化」 |
| 落点 | — | — | — | — | `practiceLaunch` 同改前、「资料分析 1/2」、答后态正常、aborted `POST answer_log/track` |
| `docSW/cw` / errs | 375/375 / [] | 同 | 1425/1425 / [] | 同 | [] |

后端：容器 `db.py:5270` 新条件在；生产 DB `EXPLAIN` `module=? AND submodule=?` → `SEARCH idx_q_pick` 2.6 ms（`submodule=?` SCAN 5099 ms）；`reinforce_log` 2 行不变。

## 7. 簇 / humans / 503（`~/r516_post.out`、`~/r516_5xx.out`）

- 09-07 终值 1437/1435；09-08 00:00–00:32Z 572/527，仍在跑；`crawler-stats.json` 00:23Z：humans.page 09-07 1444 / 09-08 250。
- 503 72 条：00:28:10Z–00:29:25Z，全 `/tiku/q/*`、全非探针（簇）、duration 25.03–26.10 s；compose 日志 `Recreate → Recreated → Starting → Started`、`KG_COMPOSE_EXIT rc=0 00:29:15Z`、新容器 healthy 首检 00:29:25Z。→ 部署重建窗 5xx（R457 形态），宿主 load 13 使停旧/起新拉到 ~75 s。

## 8. 登记 / 未做

- 日报 humans 剔簇口径（需点头）；`user_profile`/`mistakes` 无 `probe` 列；W10 两行疑自清（推断）。
- 宿主级：兄弟构建并发 + 层缓存丢 + load >10 → 发版 600 s 上限触发 / 重建窗 >1 min 5xx；R469 §4 三选 + R482 建议仍待定。
- 小程序 `book.ts` 错题标签/操作单标题是否同样把 `单选` 当题型、`appendSimilar()` 判池（R515 登记）→ W7。
- 时政/手录题「同考点强化」不做（无 tag3/池）。
- 真 `reinforce` 端点（写 `reinforce_log`）改后未在生产触发，只核源码 + EXPLAIN。

## 9. 产物

- 脚本：`~/r516/sheet_path.py`、`~/r516_pre.sh`、`~/r516/r516_db{2,3,4}.sh`、`~/r516_post.sh`、`~/r516_5xx.sh`。
- 改前：`~/r516/sheet_{375,1440}.out`、`~/r516/reinf_375.out` + png。
- 改后：`~/r516/post/{sheet_375,sheet_1440,reinf_375}.out` + png。
- 生产：`~/r516_pre.out`、`~/r516_db{2,3,4}.out`、`~/r516_post.out`、`~/r516_5xx.out`、`~/r516_deploy.log`、`~/r516_gates_{be,fe}.out`。
