# R514：复习答错后「同类题自动加练」+「看讲解 / AI 详解」375/1440 只读整页审 → 命中「加练卡裸字母 + 同类题只按 module 抽」→ 加练卡保留结构化 `options` + 同类题按题库 `submodule`

日期：2026-09-08（UTC 09-07 22:3x–23:1x）。分支 `devin/1788816465-r510-precache-practice-first`（已合 `origin/main` W9 #641，`cd8c734a`），PR #640 追加。
生产 `10e2eb82` → `2d75ba53`。

## 0. 结论

1. **(c) / 到期项 0 增量**：R513 容器整窗（22:24:01Z–23:02:39Z，1240 请求）+ R514 容器（23:02:39Z 起 262 请求）5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0、WAL `4,173,592` 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；公告「详情」/`home_bundle`/`mistakes_total` 非探针触达 **无样本**；复习真人证据全史仍只 09-06 那 1 条 `POST /api/review/1952`，`review_log` 自 09-07 起 0 行；`user_profile` 9→**10** 行：新行 uid `test-w10-a1`（国考 / 2026-11-01 / 零基础，`created_at` 1788822219 = 09-06 23:03Z 早于本轮），而 R513 发版起边缘 **0 条 `/api/profile` POST**（探针/非探针都没有）→ **推断**兄弟 W10 会话绕过边缘（容器内/直连 DB）写的测试行，与 R512 那次 11→9 同类，无 `probe` 列不可标；登记请知会。无新的外部真人证据。
2. **48 IP 簇再现且仍在进行**：R513 发版后 2 分钟看到的 48 行只是开头——同形态（`GET /tiku/q/<id>` 200、`Accept-Language: en-US,en;q=0.9`、无 Referer、桌面 Chrome UA 14 种轮换、每 IP 恰 1 次、无任何后续 assets/API）从 **22:24:51Z 持续到本轮取证末 23:06:18Z 仍未停**，≈**15 行/分钟匀速**、累计 **604 行 = 604 个不同 IP**（全史按小时 09-07 22h 508 / 23h 99）。604 个 IP 在容器窗内没有任何其它请求；同窗其余非探针行 8 条 = 5 条同形态打 `/tiku/t/*`·`/tiku/papers/*`·`/tiku/panduan/*` + 3 条 WordPress 扫描 404。**推断**（只有请求头/节奏特征，无 IP 情报）：分布式代理抓取 SSR 题目页；R514 发版（23:02:48Z）没有触发新一簇（簇在发版前已在跑、发版后节奏不变）→ 「发版触发」假设本轮不成立。`access_log_report.classify()` 仍会把这 604 行计为「候选真人」，口径登记不改（见 §7）。
3. **命中（改前生产一手，`umst3` 真到期题 2784「尾矿库闭库治理」定义判断，`/api/review` 桩为 1 道）**：答错 → 判词「又错了，看讲解（稍后本轮会再出现）（下次复习：3 天后）」+ 讲解卡 + 提示「已为你在本轮末尾加练 2 道同类题」+「还不稳？练 3 道同类题巩固 ›」/「看不懂？AI 详解本题 ›」+ 进度 1/1→1/4 —— 链路本身正常；两处断点：
   - **加练卡裸字母**：加练题经 `similarItemFromQuestion()` 把选项拼进题干一行（`A.仅Ⅰ B.仅Ⅱ C.仅Ⅰ和Ⅱ D.Ⅰ、Ⅱ和Ⅲ`，`white-space: normal` 下连排、不分行）、`options` 不透出 → R512 铺文本的 `reviewOptions()` 回退到 A–D 裸字母（375 `71.3×46`×4 横排 / 1440 `175.5×46`），选项文本与作答键分离；答错后 `mistakeRecFromExtra()` 落库的 `question_text` 也只有这一行连排。
   - **同类题只按 module 抽**：`appendSimilar()` 从 `mistakes.question_type` `split('-')` 反推 submodule，生产 `question_type` 是「定义判断」这种展示值（无 `-`）→ `sub=null` → `GET /api/questions?limit=2&module=panduan`，「定义判断」错题加练到「逻辑判断」（心理学代谢综合征 / 食堂满意度 / 扶贫必扶智）——同 module 不同题型。`/api/review`·`/api/mistakes` 联查题库时**没有透出 `q.submodule`**，前端无从取到。
4. **修**（`2d75ba53`，后端 1 文件 + 前端 2 文件 + 源锁 3 文件）：
   - `db.py` `list_mistakes()` / `due_reviews()` SQL 加 `q.submodule AS q_submodule`，`_hydrate_mistake()` 透出 `submodule`（空→`null`）。
   - `review-similar.js` `similarItemFromQuestion()`：选项经 `reviewOptions()`+`reviewOptionsFull()` 校验通过才保留结构化 `options`（题干不再拼选项）；不通过则 fail-closed 回退旧形态（题干 + 选项行），**不臆造选项**；新增 `similarSubmodule(m)` 只读题库回包的 `submodule`；`mistakeRecFromExtra()` 落库快照 `question_text` 仍拼选项行（错题本列表/搜索可读）。
   - `book.vue` `appendSimilar()` / `practiceSimilar()` 改 `similarSubmodule(m)`（不再 `split('-')` 反推）；`reinforceFromMistake()` 优先 `similarSubmodule(m)`，保留旧 `question_type` 回退（手录/时政题）。
   - 门：pytest 532 / ruff / pyright 0；vitest 860（122 文件）/ eslint / lint:tokens / lint-pages 0 error / build:h5 绿；`git diff --check` 空。native 未动。
5. **复采（改后生产，同桩同题）**：`GET /api/questions?limit=2&module=panduan&submodule=定义判断`；加练 2 题 + 重排题全为定义判断（道德情绪 / 类别化 / 甜柠檬效应 / 霍桑效应 / 投射作用 / 伪装型反侦查）；加练卡选项 375 **`309×61.4`×4 竖排**（两行文本）/ 1440 **`726×44`**，答后 `bad/ok/dim` 与判词同 Q1；「看不懂？AI 详解本题 ›」→ 问答页 textarea 预填 **4 行选项**（`optLines 4`）、答案 chip 预选（`ansChipOn ["A"]` = 本次所选）、toast「题目已填入，先自己做一遍再点讲解」；`POST /api/ask/cur` abort、**无 explain/stream 请求**；`docSW==cw`、`errs []`。前置数据：生产到期联查 268/268 题库 `submodule` 非空且 `(module, submodule)` 活跃池 ≥3。
6. **如实**：harness 用 Playwright `page.route` 拦 `/api/**`（本轮不量时序，缓存被禁无影响）：`GET /api/review` 桩为 1 道真数据、`GET /api/review/cur` 桩 `null`；`POST review/<id>`·`review/cur`·`track`·`mistakes` 本地 200 桩（返回假 id）、其余非 GET abort（`ask/cur`）；点了选项/下一题/AI 入口。事后核 `umst3` 自 R513 发版起 `mistakes/answer_log/growth_events/review_log` 新增 0、`mistake 1953` 未变、harness uid 落库 0。全部读数为本机 CDP 采样，不是真人复习证据。

## 1. 边界与方法

- 本机 Chrome（CDP `localhost:29229`）对生产 `https://kaogong.zalize.com/#/pages/book/book`，`X-Kg-Probe: 1`，uid `umst3tuisd7lgzaka`（只读）。
- `~/r514/wrong_path.py <375|1440> <wrong|ask|askx> [item_index]`：
  - `wrong`：桩 1 道到期题 → 答错（选 A，正确 C）→ 量判词/讲解/加练提示/同类题·AI 入口/进度 → 下一题（重排 Q1，量 `Q2-EXTRA`）→ 答错 → 下一题（加练 1，`Q3-EXTRA`/`Q3-QTEXT`）→ 答对 → 下一题（加练 2，`Q4-REQUEUED`）→ 答对 → 完成复习（`COMPLETE` 庆祝弹层）。
  - `ask`：Q1 答错后点「看不懂？AI 详解本题 ›」→ 问答页量 textarea 文本/选项行数/答案 chip/`redo*` 存储/toast/网络。
  - `askx`：走到第 3 题（首个加练题）答完再点 AI 入口——专核**加练题**的预填。
- `redoQuestion/redoQid/redoAnswer` 被 `ask.vue` `onShow` 消费后即 `removeStorageSync` → 落地页 `ls` 三值为空是**预期**，判据看 textarea 内容 + `optLines` + `ansChipOn`，不看存储残留。
- 局部本地对照：`~/r514/serve.py`（本机 dist 8514）跑同脚本 `R514_BASE=http://localhost:8514`，结果与改后生产逐值相同（`~/r514/local_*.out`）。

## 2. 改前生产读数（`~/r514/wrong_{375,1440}.out`，dist `10e2eb82`）

| 项 | 375 | 1440 |
|---|---|---|
| Q1 到期题（定义判断 2784）选项 | 4 × `309×61.4` 竖排文本 | 4 × `726×44` |
| Q1 答错后 | 判词 `309×43.4`「又错了，看讲解（稍后本轮会再出现）（下次复习：3 天后）」；讲解卡 `309×74.3`；提示「已为你在本轮末尾加练 2 道同类题」`309×35` 13px；「还不稳？练 3 道同类题巩固 ›」/「看不懂？AI 详解本题 ›」`309×36` 14px；进度 1/1→1/4 | 同（`726` 宽） |
| 同类题请求 | `questions?limit=2&uid=…&module=panduan`（**无 submodule**） | 同 |
| Q3 加练卡 | 题干「一项心理学研究…代谢综合征」（逻辑判断）；`.q` `white-space: normal`，选项 `A.仅Ⅰ B.仅Ⅱ…` 与题干连排一行；作答键 **4 × `71.3×46` 裸字母横排** | 「食堂满意度」（逻辑判断）；**4 × `175.5×46` 裸字母** |
| Q4 加练卡 | 「（2018国考）扶贫必扶智…」裸字母；答对后判词「还没稳，仔细看讲解」+「已加入错题本」 | 同形态 |
| 完成态 | 庆祝「到期 1 道全部复习完成 · 首答对 0 道 · 答错 1 道已重出巩固 · 加练同类题 2 道」 | 同 |
| `pageerror` / `docSW==cw` | `[]` / 375=375 | `[]` / 1425=1425 |

## 3. 前置数据核（`~/r514_pre.out`）

- 到期错题 296，联查题库且有 `options` 268；268/268 题库 `submodule` 非空、`(module, submodule)` 活跃池 ≥3 → 按 submodule 抽题不会抽空。
- `mistakes.question_type` vs 题库 `submodule`（到期联查 distinct 对）：多数同名（定义判断/科技/类比推理/语句表达…），但存在「盈亏问题→计算问题」「概率问题→排列组合与概率」「历史→历史人文」「增长率→其他」这类不等值 → `question_type` 不是题库筛选键，必须用题库自己的 `submodule`。
- 题库多选 13/156792；到期多选 0（R513 同）。

## 4. 修

- `backend/app/db.py`：`list_mistakes()` / `due_reviews()` `LEFT JOIN questions q` 增 `q.submodule AS q_submodule`；`_hydrate_mistake()` 末尾 `d["submodule"] = (d.pop("q_submodule") or "").strip() or None`。
- `frontend-uni/src/review-similar.js`：
  - `similarItemFromQuestion(x)`：`full = reviewOptionsFull(reviewOptions({options: x.options}))`；`full` → `question_text: x.question`、`options: x.options`、`submodule: x.submodule`；否则 `question_text: x.question + '\n' + optLine(x.options)`、`options: null`（旧形态，fail-closed）。
  - `mistakeRecFromExtra()`：有 `options` 时 `question_text` 拼 `optLine`（落库快照仍自含选项）。
  - `similarSubmodule(m)`：`m.submodule` 非空字符串才返回，否则 `null`。
- `frontend-uni/src/pages/book/book.vue`：`appendSimilar()` `const sub = similarSubmodule(m)`；`practiceSimilar()` preset `submodule: similarSubmodule(m)`；`reinforceFromMistake()` `submodule: similarSubmodule(m) || sub`。
- 源锁：`backend/tests/test_r514_review_submodule.py`（`/api/review`·`/api/mistakes` 透出 `submodule`、无联查为 `null`）；`frontend-uni/tests/review-similar.test.js`（结构化保留 / 非法回退 / 快照拼选项）；`frontend-uni/tests/book-r514-review-similar-submodule.test.js`（`book.vue` 三处改 `similarSubmodule`、自动加练路径不再 `split('-')`）。
- **不动**：作答状态机、`reviewOptions()` 判据、加练数量（2）、`explain_cache`/LLM 路径、小程序端。

## 5. 门 / 发版

- 后端 `pytest 532 passed` / `ruff` / `pyright 0`；前端 `vitest 860/860（122 文件）` / eslint / `lint:tokens` / `lint-pages 0 error（19 存量 warn）` / `build:h5` 绿；`git diff --check` 空。
- 宿主 mem_avail 348 MB / 5.0 G（90%）/ load 1.36 / 兄弟构建 0；`--skip-build` 一次 rc=0；compose 重建 23:00:50Z→23:02:39Z（≈1 min 49 s，层缓存在）；容器 `23:02:39Z rev=2d75ba53` healthy 0 重启；bundle 线上=本机 `index-Ct4Sl8pu.js`；7/7 200；6b `/` perf 0.91 / a11y 1.00 / **LCP 3057 FAIL（预算 3000，WARN 不阻塞）** / CLS 0.06，`/tiku/` 1.00×3 —— dist 首页部分与 R513 相同，LCP 3057 属 R511 已定性的 Lantern 双峰高侧（R511 §4），非本轮回归。

## 6. 改后生产复采（`~/r514/post/{wrong,askx}_{375,1440}.out`，dist `2d75ba53`）

| 项 | 375 | 1440 |
|---|---|---|
| 同类题请求 | `questions?limit=2&uid=…&module=panduan&submodule=%E5%AE%9A%E4%B9%89%E5%88%A4%E6%96%AD` | 同 |
| Q3 加练卡 | 「道德情绪…」（定义判断）；`.q` `309×162.8`；选项 4 × **`309×61.4` 竖排文本**（A 小齐很怕老鼠… / B 小沫得知… / C 肖先生… / D 小菲…） | 「类别化…」（定义判断）；`.q` `726×116.3`；4 × **`726×44`** |
| Q4 加练卡 | 「甜柠檬效应…」`309×83.1`×4（三行文本）；答对 `ok/dim`、判词「答对了，这个考法稳了 ✓」 | 「霍桑效应…」`726×44`×4；判词「还没稳，仔细看讲解」+「已加入错题本」 |
| askx：加练题（投射作用 / 伪装型反侦查）答后点 AI | 问答页 textarea `317×200`，正文 205 字，`optLines 4`，`ansChipOn ["A"]`，toast「题目已填入，先自己做一遍再点讲解」 | textarea `422×260`，355 字，`optLines 4`，`ansChipOn ["A"]` |
| 网络 | `aborted ['POST ask/cur']`；无 `explain`/`stream`；`errs []` | 同 |
| 完成态 / `docSW==cw` | 庆祝文案同改前；375=375 | 1425=1425 |

本地 dist（`~/r514/local_{ask,askx}_{375,1440}.out`）同值；普通到期题的 AI 预填（`ask` 模式）`optLines 4`、`ansChipOn ["D"]`（= `user_answer`）。

## 7. 发版后 (c) / 簇（`~/r514_post.out`）

- R514 容器 262 请求：5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 0；非探针非 bot 51 = 全部簇行。
- 簇：R513 容器窗 604 行/604 IP，22:24:51Z→23:06:18Z（41 min，仍在进行）；R514 容器窗 53 行/53 IP 23:02:42Z→23:06:18Z；UA 14 种；`status` 全 200；每 IP 1 次；簇 IP 与其它请求交集 0；公告/`home_bundle`/`mistakes_total` 非探针 0。
- **登记不改口径**：`access_log_report.classify()` 会把 604 行记为「候选真人」（日报 humans.ips 将被灌水）；剔除需要「同 UA 集合 + 无 Referer + `en-US` + 单 IP 单请求」这类组合特征，属口径设计（R388/R393 同类改动都先出论证），本轮只登记；下一轮先核簇何时停、日报是否已被灌。

## 8. 登记 / 未做

- 加练题数量 2 与「练 3 道同类题」preset 3 的口径差（既有）；加练题答错落库 `POST /api/mistakes` 用 `question_type: x.question_type || x.submodule`，与到期题的 `question_type` 展示口径一致，未动。
- 手录/时政题（`options` 非法）加练走 fail-closed 旧形态；生产到期项里此类 28 道（296−268）本轮未量其加练卡。
- `ask` 模式普通到期题预填 `redoQid` 为题库 id、加练题为题库 id（`x.id`），`explain/stream` 路径按 R421 带 qid 走服务端直通——**未触发**，只核预填。
- 小程序端 `book.ts` 自动加练是否同样按 module 抽、加练卡 `rOpts` 是否带文本：未核（W7）。
- 604 IP 簇归因只有请求特征；日报口径见 §7。

## 9. 产物

`~/r514/wrong_path.py`、`~/r514/{wrong_375,wrong_1440}.out`（改前）、`~/r514/post/*.out|png`（改后）、`~/r514/local_*.out`、`~/r514/serve.py`、`~/r514_pre.sh|out`、`~/r514_pre2.sh|out`、`~/r514_post.sh|r514_post2.sh|out`、`~/r514_deploy.log`、`~/r514/review_umst3_pre.json`（改前回包，无 `submodule`）/ `review_umst3.json`（改后回包）。
