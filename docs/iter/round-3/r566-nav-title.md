# R566：H5 练习页顶栏标题按会话来源给出（与小程序 `navTitleFor` 同口径）+ 按卷启动即落 `pendingSession` + 卷库来源按卷全对完成页单键「回卷库」；热修：标题只在练习页仍为栈顶时同步 + 逐题上送端点限速 120→600/h

日期：2026-09-10～11。范围：H5（`frontend-uni`）+ 后端 `study_api.py` 三行限速常量（热修），0 协议 / 小程序改动。分支 `devin/1788975417-r566-nav-title`（从 #745 分支开，含线上 `4e9137b3` 谱系），PR #746。

## 1. 研究（一手证据）

### 1.1 R565-1：按卷练习顶栏静态「刷题」
- 生产 375 截图（R565 复验 `paper-complete`）：顶栏「刷题」+ 内容头「本卷练完 · <卷名>」；小程序 `pages/practice/practice.ts navTitleFor(a)` 早已 `if (a.ptitle) return a.ptitle;`，H5 `practice.vue` 全文无 `setNavigationBarTitle`（`rg` 0 命中）。同一会话来源两端标题语义不一致，H5 用户在按卷 / 错题重练 / 每日一练 / 强化练习里顶栏一律「刷题」。
- `uni.setNavigationBarTitle` 在 uni-h5 运行时是否可用：本机 dist（`python3 -m http.server 8566`）+ 生产 API 只读代理 CDP 实测，`document.title` 与 `.uni-page-head__title` 同步变化（`{"doc":"言语理解 · 专项练习","bar":"言语理解 · 专项练习","barW":235,"barH":30}`），按卷 `2025年四川省考/选调公务员录用考试《行测》` 两处一致，返回卷库后顶栏回「真题卷库」。
- 卷名长度：已装 `node_modules/@dcloudio/uni-h5/style/framework/pageHead.css` `.uni-page-head__title { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }` → **不硬截**，375 宽由 CSS 省略（生产复验实测 client 220 / scroll 338 px 省略、1440 宽 1285 全显），只对异常长串做 40 字兑底。
- 来源枚举（`practice.vue` 启动器）：`ptitle`（按卷）/ `_shizheng`+`_szPast` / `_daily`+`_dailyPast` / `_source==='redo'` / `_reinforce` / `lastModule`+`lastSubmodule`；非会话态回落 `pages.json` 静态「刷题」。

### 1.2 顺手核出两处（同文件、同路径）
- 按卷（不计时）启动只 `startQTimer()` 不 `saveSession()`：0 答就 F5 → `pendingSession` 不存在 → 回默认组、丢卷上下文（普通 / 每日一练 / 重练启动都已落快照，R548/R557）。
- 卷库来源按卷全对完成页：R565 `doneBarPlan` 主「回卷库」= `goExamList()`（`navigateTo` 再压一层卷库）、次「返回卷库」= `quit()`（`navigateBack` 回原卷库条目）——两键实际同落点，且主位多压一层。

### 1.3 375 生产截图走查复习页 / 错题本卡面
本轮复看 R560/R561 生产 375 截图：复习页信息层级（题干→选项→解析→错因）与错题本卡面（标签行→题干两行→错因 chip→操作）无 P0/P1 层级问题；未新立项。

### 1.4 择项
主项 = 1.1 标题（每次进练习都到、H5/小程序对齐、0 后端）；顺手位 = 1.2 两处（同文件、复验路径重叠）。不做：全局替换剩余原生 modal（无新一手证据）。

## 2. 实修（`876a7f46`）
- 新 `src/practice-title.js`：`practiceNavTitle(ctx, modName)`（ptitle trim/40 字兑底 → 时政 → 每日一练/往期 → 错题重练 → 模块 · 强化练习 / 模块 · 子模块 / 模块 · 专项练习；无 module 回「综合」；非会话「刷题」）。
- `practice.vue`：`syncNavTitle()`（同值不重复调）在 `onLoad`（`backLabel` 之后）、`watch session`、`onShow` 触发；各启动 / 恢复路径显式 `this._reinforce = null`（6 处）；按卷不计时启动补 `this.saveSession()`；`pendingSession` 已带 `ptitle`（R553 起），恢复即还原卷名。
- `src/paper-continue.js doneBarPlan(items, ptitle, beiMode, back)`：`back === '返回卷库'` 时「回卷库」走 `quit`（回原卷库条目），全对 → 只剩一键；其它来源保持 `list`。
- 测试：新 `tests/r566-nav-title.test.js`（策略 + uni-h5 CSS 依据源锁 + 小程序 `navTitleFor` 同口径源锁 + 接线源锁）；`r565-done-bar.test.js` 区分卷库 / 非卷库来源。
- 本地门：`npm run lint` 0 error（20 warn 存量）/ vitest 185 文件 1436 / `build:h5` / `git diff --check` 空。

## 3. 生产复验一（`4e9137b3 → 876a7f46`，`index-DUSGEbci.js`；报告 `~/r566/report-prod.md`、82 张截图 `verification-ledger.json`、录像 `~/screencasts/r566-title-transitions/`、`r566-supplement-recovery-fallback/`）
375 主流程 + 1440 抽检，真实 UI 作答、物理 F5、DOM/存储/请求审计，6 个 `test-r566-*` uid。
- **PASS**：A 按卷双标题（375 省略 / 1440 全显、1440 箭头回「真题卷库」）；B 0 答与 1 答物理 F5 保留同卷 75 qid、1/75、`pendingSession.ptitle`；C 模块 / 子模块、「再来一组」仍模块口径；D 错题本重练「错题重练」+ F5 保持；E 每日一练 / hero 继续 / 往期 / 时政 / 历史时政；F 强化 1/5 完成 →「再来一组」→「言语理解 · 细节理解」；G 冷直达先「刷题」后「综合 · 专项练习」；H 375/1440 全对恰一键回原卷库条目 + Back 到首页、有错双键、错题本来源两键；I R564 恢复层 / R565 底栏回归。
- **FAIL 1（真实，runtime）**：完成页「返回首页」后 2 次 `setNavigationBarTitle:fail page not found` 未处理 rejection，栈 `syncNavTitle ← session watcher`。根因：`leave()` 先 `navigateBack/switchTab` 再 `this.session = false`，watcher 在练习页已出栈后调 `setNavigationBarTitle`（无回调 → uni promisify 返回 rejected promise）。路由落点 `#/` 正确，不夸大为导航错误。
- **FAIL 2（真实，限速）**：连续 75 题按卷 + 1 题重练共 257 条 `POST /api/answer_log`，226×200 + **31×429**（`rl(request,"alog",120,3600,uid)`），DB 恰 226 行。测试节奏高于常人，但一张 130 题行测卷 1h 内答完也会越过 120/h；429 走 `enqueueAnswers` 离线队列（本机保留、下次 flush 重试），不是静默丢失，但「答题记录全部持久化」不能宣称。
- 分账：3363 请求 = 2943 HTTPS 200 + 31 HTTPS 429 + 389 data URL；track 22 全 200；console error 0、runtime/rejection 各 2、browser Log 31（对应 429）、uni/loading warning 0、付费 0；12 条 Playwright SW warning + 9 次 harness 定位偏差已披露。精确清六 uid 273 行、41 表 `test-r566-%` 残留 0、五类 count/hash、taxonomy、共享 R562 42 行不变。
- 发版 6b：`/` a11y 0.94 一次（独立重跑 1.00，与 R564 同形态，不作回归结论）。

## 4. 热修（`09d664a4`）
- `practice-title.js practicePageOnTop(pages)`：栈顶 route 归一后 === `pages/practice/practice`；`syncNavTitle()` 在 title 变化后先查栈顶，不在顶则不改（离场态标题由上一页自己的静态配置接管），`setNavigationBarTitle({ title, fail: () => {} })` 改回调式不再产生 promise。
- `backend/app/study_api.py`：`alog` / `ppro`（practice_progress）/ `rcur`（review cursor）三个逐题上送端点 120→**600/h**（uid 桶；IP 桶随之 3×600）。依据：逐题 1 次上送，行测真题卷 120–135 题、按卷不计时 1h 内答完是正常用户行为；`rl` 语义（`test_rate_sweep`）不变；其它写端点（注册/登录/AI/纠错等）不动。`test_rate_limit.py` IP 桶用例同步 360→1800。
- 本地门：后端 pytest 746 / ruff / pyright 0；H5 lint 0 error / vitest 185 文件 1438 / `build:h5`（`index-Dy4_Z6uC.js`）/ `git diff --check` 空。发版 `deploy_h5.sh --skip-build` rc=0，health `{"ok":true,"rev":"09d664a4"}`，6b LH `/` 全过（a11y 1.00、LCP 1701 ms）、`/tiku/` 全 1.00。

## 5. 生产复验二（`09d664a4`，`index-Dy4_Z6uC.js`；报告 `~/r566/report-prod-2.md`、截图 `~/r566/prod-shots-2/`）
（testing agent 窄复验 R1–R5 进行中；结果回填见 PR #746 评论与 `docs/handoff-context.md` R566 段。口径修正：我的复验指令写首页标题应为「首页」，实为 `pages.json` 首页静态「刷题」——既有配置非覆盖，PASS。）

## 6. 边界与登记
- 标题 40 字兑底、同值不重复调的调用次数仅单测；自然 >40 字卷名生产未见。
- 小程序无改动；无真机（R536-1 累计）。
- 429 复验二只做同节奏 75 题一次，未做常速长卷；600/h 是否被自然用户触达需 ≥7 天回看 Caddy 429 行（探针分账）。
- 「回卷库」`quit` 语义只在 `back === '返回卷库'`（上一页是卷库）成立；从首页 / 深链进按卷仍 `list`。
- 环境蓝图无需更新（本轮无新装依赖）。
