# R555：普通练习混入到期错题（`/api/questions?mix_due=1`）——研究 / 实修 / 生产复验

日期：2026-09-09。代码 PR #717（分支 `devin/1788916552-r555-due-mix`，自 main `fa1cb7f0`）。

## 1. 研究（先调查再发言）

### 1.1 R554 候选①：`practice.vue startPaper` 计时分支是否整体死码

源码一手核实（`frontend-uni/src`）：

- `startPaper(p, untimed=false)` 读 `practiceLaunch{kind:'paper'}`，`untimed = !!launch.untimed`。
- 全仓 `practiceLaunch` 写入方里 `kind:'paper'` 只有两处：`pages/book/book.vue`（`untimed: true, wrong: true`，错题本「按卷练习」）与 `pages/pkgA/exam/list.vue`（`untimed: true`，卷库「按卷练习（不计时）」）。
- 真实计时模考在独立 `pkgA/exam/exam.vue`（`/api/exam/start|progress|resume|submit|attempts|report`），生产 30 天 `exam_attempts` 30 行 / 17 uid 全走这条路。

**结论**：`examMode/examLeft/examTimer/finishExam/confirmFinishExam` + 模板与键盘/导航守卫是 UI 不可达分支（源码级证据），与 R554 删掉的 `startExam` 同性质。**本轮不清理**：它对用户 0 感知，且删除牵涉模板/键盘/`onBackPress` 多处，收益仅代码体积；按老板规则「避免连续审计-only 轮、优先把已确认差距转为用户可感知功能」，排到有顺手机会时再做（登记 R555-1，P4）。历史 `practiceLaunch` 无 `untimed` 字段的老 payload 理论上可进计时分支，但 storage 键在启动时一次性消费，生产不会残留老 payload；UNTESTED。

### 1.2 R554 候选②：小程序 `redoset` 完成态 `redoReport` vs H5

小程序 `practice.ts` `finish()` 在 `mode==='redo'|'redoset'` 时算 `redoReport{fixed, still, mastered}`，H5 `syncRedoReviews` 在 `_redoItems && !lastModule` 时算同三字段；文案两端均「重练效果：答对 n / 仍错 m / 已掌握 k」。差异只在小程序无 `fixReport`（普通练习答对曾错题的「本组答对 n 道曾错题」）——而本轮之前普通练习**根本抽不到曾错题**（见 1.3），该差异无触达面。不立项。

### 1.3 主项来源：普通练习结构性抽不到自己的错题

源码：`db.random_questions(uid=…)` 按 `answer_log` 排除本 uid 答过的题（`done`），只有题量不足时才回填；`save_answer_log_detail` 在 qid 命中本人未掌握错题时 `_advance_review(via='answer')`（R371）。两者叠加 = 普通练习里「答对曾错题推进复习」只有题库耗尽时才可能发生。R553「只重练本组错题」只覆盖**刚做错的当组**，隔天回来的用户仍只能主动去错题本复习。

生产只读（`~/r545/q555.py`/`q555b.py`/`q555c.py`，`file:/data/data.db?mode=ro`，`uid NOT LIKE 'test-%' AND coalesce(probe,0)=0`）：

| 指标 | 值 |
|---|---|
| 全时有未掌握错题的 uid | 71（全部有到期项；`next_review` NULL 288 行 / real 33 行） |
| 其中任何时候有过 `review_log` 的 uid | 8（6 个是隔天回来复习，2 个仅当天） |
| 隔天以后再回来的 uid | 9 / 71；其中 3 个回来后只刷普通练习、0 复习（如 `umsacie…` 31 道到期、后续 4 次 boot + 10 次作答、0 review） |
| 30 天 `review_log` | 35 行 / 8 uid，`via` 全 NULL（`via=answer` 0） |
| 30 天 `answer_log.source` | NULL 290 + direct 73（普通练习）/ redo 5 / reinforce 5 / exam 0 |
| 30 天新增错题 | 198 行 / 52 uid |

→ 用户不去错题本；日常刷题又碰不到错题；复习闭环只对 8/71 生效。竞品粉笔/夸克在日常刷题里把错题自然回流（「错题再现」）。

### 1.4 设计论证

- **样本**：71 uid 全部有到期错题，混入后每组 10 题至多出 2 道，对 62 个「再没回来」的用户无影响，对 9 个回来的用户直接补上闭环。
- **口径**：只混本人**未掌握且已到期**（`next_review` NULL 或 ≤ now）、`question_id` 非空且题库有效（`disabled=0`）的错题；手录/时政内联错题无题库行不混。最早到期优先；同题多条只取一条；`_HISTORY_SESSION_GAP`（30 min）内本 uid 答过的题不重出（避免同一练习会话里刚错又出）。
- **不动**：真题/年份/地区/考点（tag3）/自适应筛选下服务端忽略 `mix_due`（用户明确要「真题」「某考点」时不混别的）；`mode=reinforce`、`grouped`（资料 ziliao 成组）早返回不混；redo/redoset/复习/模考路径不经此分支。
- **配额**：`due_mix_slots(n)=min(2, n//5)`；`interleave_due` 不占首题、均匀插入（n=10/k=2 → 第 5、8 位），总量仍 ≤ limit。
- **可感知**：卡面 `kg-tag tone=info`「曾错题 · 到期复习」；答对 → 既有 `via=answer` 推进 + 完成页「本组答对 n 道曾错题」（`fixReport`，R553 已有）；答错 → 既有去重 `times+1`、streak 清零。
- **协议**：opt-in `mix_due=1`，老客户端 / 第三方调用行为 0 变化；返回项多两个字段 `due_mid`/`due_streak`。
- **验证方式**：后端隔离库 TestClient（`test_r555_due_mix.py`）+ 生产黑盒（新 uid 造错题 → 到期 → 普通练习看标签 / DB `review_log.via='answer'` / 到期池减一）。

## 2. 实修（#717，+341/-16）

- 后端 `db.due_mix_questions(uid, limit, module, submodule, exclude)`；`qbank_api` `DUE_MIX_MAX=2`、`due_mix_slots`、`interleave_due`，`api_questions(mix_due: int = 0)`。
- H5 `practice.vue`：`start()` 主请求/子模块回退/真题→题库回退 + `prefetchNextGroup` 有 uid 时 `&mix_due=1`；`qCard.dueMix`；`answer_log mid: q.mistake_id || q.due_mid`；`kg-question-card` 新 tag。
- 小程序：`LearnDrawParams.mixDue` → `&mix_due=1`；`practice.start` 非 reinforce 抽题带 `mixDue`、真题回退同带；`Question.due_mid/due_streak`；wxml tagrow 新 tag；`answer_log mid` 同口径。
- 测试：后端 +5（slots/interleave；plain 不混、`mix_due=1` 出、real/tag3/adaptive/无 uid 不出、module 过滤、mastered/未到期/近 30 min 已答排除、答对推进 `via=answer` 并离开到期池、答错去重 streak 清零）；H5 源锁 +5（`r555-due-mix.test.js`）；小程序源锁 +4（`scripts/due-mix.test.ts`）；`miniapp-r542-practice-review-advance.test.js` 的 `mid` 源锁同步。

本地门：pytest 735 / ruff / pyright 0（`cd backend && npx -y pyright --pythonpath ~/venv-kg/bin/python app`——不带 `--pythonpath` 会报 `pywebpush`/`jwt` 2 个假 import 错）；H5 vitest 1200 / eslint+tokens+edge 0 / build:h5；小程序 tsc / eslint 0 / vitest 51；`git diff --check` 空。

## 3. 生产

### 3.1 发版一：`695c4712 → 61b45662`（#717，从功能分支直发；`index-BcNCvlJc.js`）

黑盒复验（testing agent，375/1440 真实 UI + Playwright 网络/runtime 审计 + 生产 SQLite 只读核证；报告 `~/kaogong-reports/r555-prod-verify.md`，证据 `~/r555-verify/`）：

| 项 | 结果 |
|---|---|
| A 造数：两视口各 3 条题库错题（`next_review NULL`、streak 0、times 1、answer_log 0） | PASS |
| B 冷路径（直接进练习页 `start()`）：两视口 10 题含 2 道 `due_mid`，位于 index 4/7、首题不混，卡面「曾错题 · 到期复习」可见 | PASS |
| **B 热路径（首页→言语理解→全部随机）** | **FAIL**：命中首页 `prefetchModule` 写的 `prefetchPack`，该请求不带 `mix_due` → 10 题 `due_mid=0` |
| C 答对混入题：`answer_log mid=due_mid` → `reviewed` 回该记录；DB `review_log via=answer/correct 1/probe 1`、streak 0→1、`next_review` 推后；完成页 fixReport 计 1 | PASS |
| D 混入题再答错：同一 `mistakes` 行 `times 1→2`、streak 0，无新增 correct 0 的 review_log（既有行为如实记录） | PASS |
| E 下一组：第三条未答到期题出现、已推进的 3670 不再作为 due_mid | PASS（成员） |
| **E 下一组题量** | **FAIL**：第 8 题触发 `prefetchNextGroup`，当组未答的到期题尚无 answer_log 被服务端再次选中，客户端 `seen` 过滤后只缓存 9 题 → 「再来一组」实际 1/9 |
| F 抑制：real/tag3/adaptive/无 uid 0 due；扩展 year/region/reinforce/grouped 也 0；limit 5/9 混 1、10 混 2 | PASS（grouped 未造同模块到期候选，覆盖有限） |
| G 回归：错题本重练无 `mix_due`、完成页重练效果；R553 只重练本组错题 1 题 + storage 字段；物理 F5 恢复同一已答题 | PASS |
| H 回归：不计时按卷 1/75 且 loading 消失；独立模考路由/倒计时 | PASS |
| 浏览器审计：749 响应全 200（280 API），console error/warning/runtime 异常/rejection 0；本 context 付费 AI/OCR/explain 0 | PASS |
| 精确清理：41 表删本轮 74 行，`test-r555-%` 独立复核 0 残留；questions/taxonomy/paper_exports hash 一致 | PASS |
| **五类全局 hash 严格不变** | **FAIL（非本轮残留）**：`answer_log 1387→1484`、`explain_cache 82→83`；只读归属为同期 `test-w17-mp / test-w17-uj-newbie / test-w17-w16probe-01`（`probe=1`）其他会话探测写入；未删除其数据 |

UNTESTED：小程序（R536-1 累计）；`practice.vue` 内部计时分支（UI 不可达）；mastered/未到期/手录等负面 fixture 未在生产穷举（单测覆盖）。

### 3.2 热修 #718（+40/-7）

两条 FAIL 根因均为**预取路径**没进 R555 主链：
1. `home.vue prefetchModule()` 请求补 `&mix_due=1`（有 uid 时）；`prefetchPack` 全仓仅 home/practice 两处写入方，源锁计数 2。
2. 服务端 `/api/questions` 新增 `exclude=<qid,…>`（`parse_exclude`：只收纯数字、上限 100），**仅并入到期题选取的排除集**，不影响新题抽取与未传参调用方；`prefetchNextGroup` 带 `&exclude=<当组 qid>`，且 `items.length < limit` 时不再缓存预取包（改由「再来一组」时实时拉取，此时当组已全答、服务端 30 min 规则自然排除）。
- 有意不改：离线题包 `offline.js downloadPack` 与 PDF 导出的 `/api/questions` 不带 `mix_due`（离线包可能数天后才用，到期态会过期）；小程序无预取路径。
- 本地门：pytest 735 / ruff / pyright 0；H5 vitest 1201 / eslint 0 / build:h5；`git diff --check` 空。
- 测试：后端 `test_mix_due_skips_same_session_and_filters` 追加 `exclude` 断言（含非法 token 忽略）；H5 源锁 +1（首页预取）、改 1（中场预取 exclude + 不足一组不缓存）。

### 3.3 发版二：`61b45662 → 798c154f`（#718，从修复分支直发；`index-CPSBIGyW.js`）

发版过程：宿主同机 6 个其他 compose build + prune、`mem_avail 213–366 MB`、load 10–16；首跑 `DEPLOY_WAIT_SECS=900` 时 build context 传输 784s、900s 内 compose 未退出（脚本 FAIL 但 compose 在宿主 setsid 后台继续、旧容器照常服务）。按脚本提示轮询 `/tmp/kg-compose-798c154f-*.log` 到 `KG_COMPOSE_EXIT rc=0`（02:29:51Z，Recreate 一次），再 `DEPLOY_RESUME=1 ./deploy/deploy_h5.sh --skip-build` 续跑 Pages/bundle/回归：线上 bundle `index-BcNCvlJc.js → index-CPSBIGyW.js` 与本机一致、各 Accept-Encoding 变体正确、接口回归全 200、LH `/` 0.97/1.00/1.00/1.00、`/tiku/` 全 1.00；容器 healthy、RestartCount 0、20 min 日志 0 Traceback/5xx/locked。`/api/questions?limit=5&uid=…&mix_due=1&exclude=1,abc` 线上 200（非法 token 被忽略）。

修复后二次黑盒（testing agent，新 uid `test-r555-fix2-*`；报告 `~/kaogong-reports/r555-fix2-prod-verify.md`，证据 `~/r555-fix2-verify/`，录像 `~/screencasts/r555-fix2-798c154f-{mobile,desktop}/`）：

| 项 | 结果 |
|---|---|
| A 375 热路径（首页停到 `prefetchModule` 回包 → 言语理解 → 全部随机）：首页预取请求带 `mix_due=1`；首组消费同序 10 题缓存、启动时无新 questions 请求；due 位于第 5/8 题、首题不混、标签可见 | **PASS（修 3.1 FAIL B 热路径）** |
| B 375 中场预取：第 8 题且一道到期题**未答**时，`exclude` 覆盖当组全部 10 个 qid；回包 10 / 缓存 10 / 与当组 overlap 0 | PASS |
| B 下一组：真实「再来一组」显示 **1/10**，与上组 qid 无重复；第三条未答到期题进入，已推进的与当组到期题均不重复 | **PASS（修 3.1 FAIL E 题量）** |
| C 1440 热路径（新 uid 复跑）：同序缓存 10 题、due 第 5/8、标签可见 | PASS |
| D SRS 不回归：POST 带 `mid`、`reviewed` 回 streak 1；DB `via=answer/correct 1/probe 1`、streak 0→1、`next_review` 未来；完成页计 1 道曾错题 | PASS |
| D 回归：错题本 redo 请求无 `mix_due`、完成页重练效果 4；不计时按卷 1/75、loading 已消失、warning 0；独立模考入口、倒计时 69:59→69:56 | PASS |
| E 审计：501 请求 / 499 响应全 200（159 API 全带 probe）；2 条 tab 图片请求在响应前取消（无 API 取消）；console error/warning、runtime exception、rejection、付费 AI/OCR/explain 0 | PASS |
| F 清理：停录→关 context→41 表精确删 36 行；独立只读 exact uid 与 `test-r555-fix2-%` 0 残留；五类全局 hash/count 首尾一致（本轮无并发漂移） | PASS |
| 身份：起终 health/HTML/runtime bundle 均 798c154f / `index-CPSBIGyW.js`；容器起终 healthy、restarts 0 | PASS |
| **附带 UX 发现（非 #718 归因、既有）**：错题本 redo 完成页点「返回首页」实际回到 `#/pages/book/book` | FAIL（单列）— 源码 `practice.vue quit()` 页面栈 >1 时 `navigateBack`，文案与落点不一致；登记 R555-2（P3，R556 顺手修：改文案「返回」或改落首页） |

Harness 偏差（如实）：自动下一题 helper 固定 500ms 后读 `.pos` 撞转场，把上一题答案点到普通第 2 题上多造 1 条错题（已披露并随本轮 uid 清理；两条目标到期题按计划作答，不影响结论）；模块名同时出现在隐藏 SEO 导航造成定位冲突、完成页退出落点非首页造成定位超时，均已纠正后继续。

UNTESTED：小程序（R536-1 累计）；`practice.vue` 内部计时分支（UI 不可达）；「不足一组不缓存 → 再来一组实时重拉」分支（本轮两次预取均满包）；`exclude` 非法 token / 100 上限边界仅 curl + 单测；1440 仅热路径抽检。

## 4. 结论

- R555 主项（普通练习混入 ≤2 道本人到期错题 + 卡面标签 + `due_mid` 走既有 `via=answer` 推进）两版生产黑盒：冷/热路径、中场预取、下一组完整性、SRS 推进、抑制口径、回归项全 PASS；两条发版一 FAIL 均为预取路径漏接、#718 修后复验坐实。
- 教训：新增 opt-in 查询参数时，**所有**发同一接口的调用点（含预取/缓存写入方）要一次枚举（本轮 `home.vue prefetchModule` 漏接）；「客户端过滤重复」与「服务端排除」要在协议层对齐，否则缓存包会被过滤成短包。
- 登记：R555-1（P4）`practice.vue` 计时分支清理；R555-2（P3）redo 完成页「返回首页」落点。
