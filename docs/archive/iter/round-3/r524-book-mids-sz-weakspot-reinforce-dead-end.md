# R524 取证：错题本时政筛选态「重练所选」`mids=` 对 NULL-qid 行 + 完成页「强化 5 道新题」对时政组的池口径（命中死入口 → 实修上线）

日期 2026-09-08（UTC 04:33–04:56Z）。生产 `6d568b6c` → `77611f96`（04:52:15Z）。代码 1 commit（`weak-spots.js` 1 行 + 源锁 1 例）。生产 0 写入（非 GET 全 abort、库 `mode=ro`、`reinforce_log` 前后同 2 行）。

## 0. 结论

| # | 项 | 结论 | 证据等级 |
|---|---|---|---|
| 1 | 错题本时政筛选态批量条「重练所选」→ `GET /api/mistakes/redo?mids=` 对 NULL-qid 行 | 生产只读 `umst3` `mids=2914,2915` → 200 回 2 条，全 `_sz:true`、`mistake_id` 2914/2915 逐条保留、`id` 为 `shizheng_questions.id`（118/69）不落 `questions` 域、`module:时政 / question_type:单选 / tag3:null`；`mids=2915,2914,2916` → 3 条 2914/2915/2916。练习页「刷题 时政 1/2 · 1/3」题干 + A–D 渲染，errs []。**R521 恢复契约在 `mids=` 路径成立，不改** | 生产只读一手 |
| 2 | `mids=` 回包顺序 | 回包按 `ORDER BY COALESCE(next_review, created_at), created_at DESC`（`db.py mistakes_redo_questions()`，与不带 `mids` 同一排序），**不是勾选顺序**；R520「去重保序」指 `_parse_redo_mids()` 对参数去重保序。三条 `next_review` 全 NULL → 按 `created_at` 出 2914→2915→2916。行为一致、无用户可见矛盾 → **登记 R524-2（P3，不改）** | 源码 + 生产只读 |
| 3 | 完成页「薄弱考点 · 趁热打铁」→「强化 5 道新题」对时政组（`_sz`）的池口径 | **改前生产一手（375）**：时政 2 题全错 → 完成页出卡「单选 · 本组错 2 题 · 强化 5 道新题」→ 点击 → `GET /api/questions?mode=reinforce&limit=5&uid=…&module=时政&submodule=单选` 200 `items:[]`、`counts` 只含题库模块 → toast「该考点暂无新题，换个考点试试」→ 停在完成页。后端 `qbank_api.api_questions(mode=reinforce)` → `db.reinforce_questions()` 三段 `_pick` 全查 `questions`（`tag3→module+submodule→module`），`shizheng_questions` 无分支、`module='时政'` 在 `questions` 里 0 行 → **恒空，死入口**。**实修**：`weakSpots()` 跳过 `_sz` 项（1 行）；改后生产 375/1440 完成页无该卡（`CTA_ABSENT`、`REINFORCE_REQ []`），普通题路径不变 | 源码 + 生产一手（改前/改后） |
| 4 | 发版后 (c) / 到期项 | 新容器窗（04:52:15Z→04:55Z，89 请求）5xx / assets 404 / monitor / mpUA / 非探针 POST / 401·403 / Traceback 全 0；重建窗源站 5xx 0（簇 503 仍 72 旧账）；WAL `4,173,592` 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、nudge/push 0；`reinforce_log` 2 行/2 uid 前后不变；`umst3` 四表 32/45/22/1 新增 0、`mistake 1953/2784/2914/2915 (mastered 0, next_review NULL, streak 0)` 不变；`user_profile` 9 / `shared_questions` 18 | 生产只读 |
| 5 | 簇 | 09-07 终值 1445/1443；09-08 至 04:55Z 4589 行 / 4529 IP（15.6 行/分、峰 97、UA 14、每 IP ≤2）仍在跑，无 >120 s 间隙；日报 04:23Z `humans.page 09-08 3957` 基本全簇 | Caddy 只读 + 特征推断 |

## 1. 设计论证（先于改码）

- 事实：`frontend-uni/src/weak-spots.js weakSpots()` 对每个答错项按 `tag3 || question_type || module` 分组；时政题 `tag3:null / question_type:'单选' / module:'时政'` → 生成 `{name:'单选', module:'时政', submodule:'单选', tag3:null}` 一组；`practice.vue reinforceWeak(w)` → `GET /api/questions?mode=reinforce&module=时政&submodule=单选`。
- 后端 `reinforce_questions()` 只从 `questions` 取「该 uid 未做过」的题，排除条件用 `answer_log.question_id`；时政题的 `answer_log.question_id` 恒 NULL、`shizheng_questions` 不在池内，`module='时政'` 在 `questions` 0 行 → 生产实测 `items:[]`（§0-3）。这不是数据稀缺，是**域不匹配**：任何时政错题组都会出这张卡且必空。
- 备选：(a) 后端 `mode=reinforce` 增 `module=时政` 分支从 `shizheng_questions` 出题——需定义「时政新题」池口径（日期/来源/该 uid 未做过要靠 `mistakes.question_text` 或另建作答表，`answer_log.qid` 为 NULL 无法排除已做），且 `_sz` 题回到普通练习页 `reinforce` 落点还要把 `id` 置空守卫贯穿（R521-3 小程序同题），超出本轮证据；(b) 前端把 `_sz` 项排除出薄弱考点——1 行、fail-closed，用户不再看到一个必失败按钮，时政组完成页仍有「错题重练效果」块 + 「今日还有 N 题到期待复习」两条有效出口；(c) 保留卡但把按钮换成「再练一组时政」（`startShizheng`）——需 UX 定文案与落点，且日练题是「今日一组」不是「同考点新题」，语义不同。采纳 (b)，(a)/(c) 登记 R524-1 待 UX/产品定。
- 副作用核：`weakSpots()` 另一调用方 = 每日一练/时政日练同一完成页（`items` 全 `_sz`）→ 卡同样隐藏（同函数，改前同样是死入口，未单独生产采样、按源码推断）；普通题混时政组只留普通题（源锁）。
- 源锁：`frontend-uni/tests/weak-spots.test.js` 新增「纯时政组返回空 / 混合组只留普通题」；改前源码跑该用例 1 failed（`~/r524` 本地对照），改后 6/6。

## 2. 改动

- `frontend-uni/src/weak-spots.js`：`if (!q || q._sz || !q._picked || q._picked === q.answer) continue;`（+1 行注释）。
- `frontend-uni/tests/weak-spots.test.js`：+1 例。
- 后端 / 小程序无改动（小程序端完成页无「薄弱考点」卡，`grep weakSpots miniapp-native` 0）。

## 3. 生产一手（`~/r524/prod_sz_weakspot.py <W> <mids> <pre|post>`）

- 路径：`umst3` 只读 `GET /api/mistakes/redo?limit=25&uid=…&mids=…` → 写 `localStorage.redoSet` → `#/pages/practice/practice` → 每题选一个错项 → 完成页 → 找 `.wr-row` 的「强化 5 道新题」并点击 → 抓 `mode=reinforce` 回包 + toast；非 GET 全 abort、`X-Kg-Probe: 1`。
- 改前 375（`~/r524/prod_pre_375.out`，`prod_pre_done_375.png` / `prod_pre_cta_375.png`）：`REDO n 2`；`weak: "薄弱考点 · 趁热打铁 单选 本组错 2 题 强化 5 道新题"`；`CTA_CLICKED toast ["该考点暂无新题，换个考点试试"]`；`REINFORCE_REQ [{url:…mode=reinforce&limit=5&uid=umst3tuisd7lgzaka&module=时政&submodule=单选, status:200, n_items:0, modules:[]}]`；abort `track / answer_log {qid:null,mid:2914} / mistakes {question_id:null} / practice/progress`；bundle `index-BCpYYxJh.js`；errs []。
- 改后 375（`prod_post_375.out`，`prod_post_done_375.png`）`mids=2914,2915`：`weak: null`、`secs ["错题重练效果","逐题回顾"]`、`CTA_ABSENT`、`REINFORCE_REQ []`；hero「答对 0/2 · 错题已自动加入错题本」+「0 已纠正 2 仍错 0 达成掌握 / …已回到今日待复习」+「今日还有 30 题到期待复习」；abort 集同改前；bundle `index-B-fpyXVB.js`（= 本机 dist）；errs []。
- 改后 1440（`prod_post_1440.out`，`prod_post_done_1440.png`）`mids=2915,2914,2916`：`REDO n 3`（2914/2915/2916，§0-2）、「时政 1/3」、`weak: null`、`CTA_ABSENT`、`REINFORCE_REQ []`、errs []。
- 直打源站 `GET …mode=reinforce`（无浏览器 UA）04:37:42/43Z 两次 403 是本机 curl 探针被边缘拒（R519 已知口径），改用页内 fetch 后 200；均 `probe=1`。

## 4. 发版

- 预检：`MemAvailable 380 MB` / disk 5.6 G / load 0.90 / `other_builds=0`。
- compose：`poll rev=6d568b6c` ×12 → `rev=77611f96 started=04:52:15Z compose_rc=0`（~3 min）；`4a` rev 校验过；5/6 线上 bundle `index-B-fpyXVB.js` = 本机；6b `/` perf 0.93 / a11y 1.00 / LCP 2797 / CLS 0.06、`/tiku/` 1.00 / 944 / 0.00 全 OK；`DEPLOY_RC=0`。`~/r524_deploy.log`。发版后 1 min 宿主 load 6.08（Lighthouse + 重建余波，healthy 0 重启）。
- 门（改后）：vitest 134 文件 / 917、eslint、lint:tokens、lint-pages 0 error / 19 warn 存量、build:h5；后端未改（pytest 568 / ruff 沿用 R523）；`git diff --check` 空。GitHub Actions 按公司规则保持禁用。

## 5. 读数（`~/r524_pre.out` 发版前 / `~/r524_post.out` 发版后）

| 项 | 前（R523 容器 04:25:52Z→04:48Z） | 后（R524 容器 04:52:15Z→04:55Z） |
|---|---|---|
| 请求 / 5xx / assets404 / monitor / mpUA / 非探针 POST / Traceback | 449 / 0 / 0 / 0 / 0 / 0 / 0 | 89 / 0 / 0 / 0 / 0 / 0 / 0 |
| 非探针非 bot（全簇） | 386 / 386 | 42 / 42 |
| 401/403 | 2（本机 curl 直打 reinforce，probe） | 0 |
| WAL | 4,173,592 | 4,173,592 |
| probe=0 answer_log / growth / explain_cache qid / error_reason ≥09-11 / push_subs | 53,2 / 26,4 / 0,82 / 0 / 0 | 同 |
| reinforce_log 行 / uid | 2 / 2 | 2 / 2 |
| umst3 mistakes / answer_log / growth / review_log | 32 / 45 / 22 / 1 | 同 |
| 簇 09-08 | 4488 / 4428 IP | 4589 / 4529 IP |

## 6. 登记 / 如实

- **R524-1（P2，待产品/UX 定）**：时政组完成页现无「加练」出口；若要补，需先定「时政新题」池口径与已做排除方式（`answer_log.qid` 为 NULL 无法排除），并贯穿 `_sz` id 置空守卫；不点头不做。
- **R524-2（P3，不改）**：`mids=` 回包按到期优先排序而非勾选顺序（与不带 `mids` 一致）。
- 如实：改前死入口只在 375 采样（1440 未采改前，源码同一函数）；日练完成页同函数隐藏按源码推断未采样；完成页读数是 abort 后客户端状态、与落库无关；本机 CDP `X-Kg-Probe: 1` 非真机 RUM；`reinforce_log` 不变是因为回包 0 条未触发 `_reinforce_log_add`（非 abort 之功）；簇归因是特征推断；0 LLM；无 testing agent 录屏（未另行授权）；仍无可确认外部真人走过时政重练/加练。
