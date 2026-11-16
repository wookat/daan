# R554：删除 `practice.vue` 死码 `startExam` + 小程序练习结算态底栏与 H5 R553 同层级 + 修重练后「再来一组」只出 N 题

日期 2026-09-09 · 前序 R553（`docs/iter/round-3/r553-retry-wrong.md`）· 分支 `devin/1788914025-r554-dead-exam-mp-done-bar`（从合入 #712 后 main `616a7e99` 之前的 `303369a1` 开）· 代码 #714 · 本文档 = 研究 + 实修 + 生产复验回填

## 1. 研究（一手证据，先调查再立项）

### 1.1 R553 候选核实

| 候选 | 一手证据 | 结论 |
|---|---|---|
| ① `startExam` 死码清理 | `git log -S"startExam("`：60402715（2026-08-03 全真模考 v1）把首页四宫格 `@click="startExam(false|true)"` 改为 `goMini → /pkgA/exam/exam?mini=1` / `goExamList → /pkgA/exam/list`；此后 `frontend-uni/src` 全树 0 调用方；R553 生产复验亦确认无 UI 路由可达 | **立项（顺手，-69 行）**；不因「有函数」推断功能存在，删除不产生用户可见差异 |
| ① 附：完成页「再来一组」在重练后是否应回原题组规模 | H5 `retryGroup()`：`_redoItems` 场景复用 redo 母本，否则 `start(lastModule, lastSubmodule)` → `limit = count || groupSize || 10`，**H5 正确**；小程序 `onRetry()` 沿用 `_args`（`onRedoWrong` 已把 `_args` 改成 `{mode:'redoset', count: wrong.length, ptitle:'本组错题重练'}`）只清 `mode` → 新一组 `limit = wrong.length`、`navTitle` 仍「本组错题重练」 | **小程序侧坐实，立项（③）**。生产 `practice_results` 近 30 天非测试仅 1 行（n=10），无法给出 groupSize 分布，不以数据论证规模、只修语义 |
| ② 小程序完成态层级 vs H5 R553 | `practice.wxml`：重练是完成卡内 `kg-button variant="secondary" size="md"`「只重练本组错题（N）」；底栏 `kg-action-bar` primary 仍「再来一组」/ secondary「返回」——与 H5 R553「重练 primary / 再来一组 ghost」**层级相反** | **立项（②）**：H5/小程序同口径 |
| ③ R553 上线后自然样本回看 | 生产只读 `~/r545/q554b.py`（36h 窗口，非测试）：`answer_log` 5 行 / 4 uid（source NULL 3 · direct 1 · link 1，答错 4）；`review_log` **0 行**（含 `via='answer'`）；新增 `mistakes` 3 行 / 3 uid | 样本过小（自然流量低），**无法判定** R553 主项是否被自然用户触发；继续观察，不作为立项依据。首轮 `q554.py` 查 `practice_result` 表名错（实为 `practice_results`，列 `id, created_at, module, n, correct, secs, uid, probe`），已改正 |
| ④ 复习小结 UX / probe 真人口径 | 同 R553：无一手竞品操作台；probe 样本仍少 | 继续等 |

### 1.2 设计论证

- ②：小程序引入纯函数 `utils/done-bar.ts` `doneBarPlan(wrongCount, beiMode)`，与 H5 `paper-continue.js wrongRetryPlan` 同口径——`!beiMode && n>0` → `{primary:'只重练本组错题（n 题）', primaryAct:'redo', secondary:'再来一组', secondaryAct:'retry'}`，否则 `{primary:'再来一组', primaryAct:'retry', secondary:'返回', secondaryAct:'quit'}`。底栏 `kg-action-bar` 文案与事件全部走 `doneBar`，删除卡内独立小按钮；`onRedoWrong / onRetry / onQuit` 逻辑本身不动。有错题时「返回」不再出现在底栏（小程序有原生返回；H5 完成页此时为 重练 / 再来一组 / 分享 / 返回首页）。
- ③：`start()` 记 `_groupArgs`（`mode !== 'redoset'` 时覆盖），`onRetry` 取 `_groupArgs || _args`。直接以 `?mode=redoset` 进页（历史页重练）时 `_groupArgs` 为空 → 回落 `_args`，与修前一致。
- 三项均 0 后端/协议改动；小程序无真机通道 → 仅单测 + tsc/eslint，如实标 UNTESTED。

## 2. 实修（#714）

- H5 `practice.vue`：删 `startExam(full)` 本体；`examMode/examLeft/examTimer/finishExam/confirmFinishExam` 仍由 `startPaper` 引用。`tests/r553-fix-loading-reviewed.test.js` 五处启动器源锁去掉 startExam 项（`startPaper` 切片终点改 `confirmFinishExam() {`）；新增 `tests/r554-dead-start-exam.test.js`（src 全树无 `startExam(` / 模考入口仍走 exam 分包 / `startPaper` 计时分支保留）。
- 小程序：`utils/done-bar.ts` 新增；`practice.wxml` 底栏改 `doneBar.*` + `onDonePrimary/onDoneSecondary`；`practice.ts` `finish()` 里 `wrongN` 与 `wrongCount/doneBar` 同源 `setData`，`runDoneAct(act)` 分派；`_groupArgs` + `onRetry` 改取（commit 93acc3b6）。新增 `scripts/done-bar.test.ts`（纯函数 + wxml/ts 接线源锁，8 例）。

## 3. 本地门

- H5：`npx vitest run` 166 files / 1192 tests ✅ · `npm run lint` 0 error ✅ · `npm run build:h5` ✅
- 小程序：`tsc --noEmit` ✅ · eslint + design-tokens 0 error（存量 20 warn）✅ · `vitest --config scripts/vitest.config.mts` 8 files / 47 tests ✅
- `git diff --check` ✅；后端未改不重跑

## 4. 发版与生产复验

- 发版分支 `devin/1788914360-r554-deploy`（R553 发版基线 + `origin/main` + #714 首提交 `ec5a7322`，merge `695c4712`）`DEPLOY_WAIT_SECS=900 ./deploy/deploy_h5.sh`：`db847006 → 695c4712`（bundle `index-C0q6uHnI.js` gzip 124KB），回归全 200，LH `/` perf 0.92 / a11y 1.00 / BP 1.00 / SEO 1.00 / LCP 1181 / CLS 0.06，`/tiku/` 全 1.00。宿主 mem_avail 259MB / disk 93%。commit 93acc3b6（③，仅小程序）在发版之后，H5 产物不受影响，不重发。
- 复验期间一手核实（testing agent 规划阶段）：`practice.vue startPaper` 的**计时分支**（`untimed=false` → `examMode/examTimer/confirmFinishExam`）全仓 `practiceLaunch{kind:'paper'}` 写入方仅 `book.vue:1836` 与 `pkgA/exam/list.vue:364`，均 `untimed:true`；真实计时模考走 `pkgA/exam/exam.vue`。→ 该分支与 `startExam` 同属「源码存在、UI 不可达」，本轮只删 `startExam`，计时分支列 R555 候选（删除前需再核 `openPapers`/深链参数无写入方）。

### 4.1 生产黑盒复验（`695c4712`，`~/kaogong-reports/r554-prod-verify.md`、`~/r554-verify/`、录像 `~/screencasts/r554-695c4712-production/`）

独立 Playwright context 接现有 CDP，全请求 `X-Kg-Probe: 1`，测试 uid `test-r554-mobile-fa257f52` / `test-r554-desktop-d5cd6265`，两段录屏前物理最大化并存 `Browser.getWindowBounds`（R553 教训）。本轮 H5 仅死码删除，所有项均为**回归**：

| 项 | 结果 | 观察 |
|---|---|---|
| A 375 错 2 → 完成页 | PASS | 「只重练本组错题（2 题）」primary（rotate 图标）、「再来一组」ghost；点重练 → 1/2、qid 顺序 `[261357,145185]` 与原错题一致、未选、`pendingSession.items=2/redo=0/ptitle` 空；重练全对 fixReport 2 → 「再来一组」→ **1/10 普通模块标题**（H5 `retryGroup` 回 groupSize 口径坐实） |
| A 1440 抽检 | PASS | 同 375（qid `[237179,241246]`，下一组 1/10） |
| B 375 全对 | PASS | 无重练按钮，「再来一组」primary |
| C 真实卷库计时模考（`pkgA/exam/exam`） | PASS | 2025 四川 75 题，倒计时 69:59→69:54，答 2 题 → 答题卡交卷 → 确认弹窗先取消再确认 → 成绩报告 `attempt_id=370`；全程无 `startExam`/ReferenceError |
| C `practice.vue` 计时分支 | UNTESTED | 无真实 UI 入口（见上），不以独立 exam 页冒充 |
| C′ 更多→按卷练习（不计时，真实 `startPaper`） | PASS | 1/75；首题 toast 时 loading 已隐藏、无遮罩 |
| D 首页模考入口 | PASS | 落 `#/pkgA/exam/list` |
| E 已答 1 题物理 F5 恢复 / `startPaper`+`startDaily` warning | PASS | Document 重载 + 原生恢复同一已答题与反馈；两启动器 warning 0 |
| 审计 | PASS | 浏览器 1100 请求 / 1100 响应全 200（221 API 全带 probe）；console error/warning、app/harness runtime 异常、取消、付费 AI/OCR/explain 全 0 |
| DB | PASS | 两 uid 各 2 行 `review_log` `via=answer/correct=1/probe=1`，`mistakes` 无重复 |
| 清理 | PASS | 关 context 后 41 表精确删 58 行，独立只读复核 `test-r554-%` 0 残留，五类保护对象哈希/计数一致 |

- 单列异常（非浏览器口径）：清理后额外一次系统 Python `urllib` health GET 返回 403，同 URL `curl` 立刻 200、HTML 200——疑为边缘对无 UA/无 probe 头的探测拦截，未证实，不计入产品缺陷。
- Harness 已纠正问题：strict locator 冲突；Playwright `keyboard.press('F5')` 未真正触发 reload（改用前台物理 F5，以 Document 请求为证）。页面侧 harness runtime 异常 0（observer 改观察 document）。
- 既有产品缺陷：本轮未复现；跨 F5 fixReport 累计（R553-fix 项）未专项重跑。
- SKILL 追加 R554 段：真实路由归属（独立 exam 页 ≠ practice 内部计时分支）、物理 F5 核实、切视口后再最大化、封账窗口边界。

## 5. 如实 / UNTESTED

- 小程序 ②③ 未上真机/DevTools（R536-1 累计通道缺口），仅单测 + 类型/lint。
- `startExam` 删除本身无可观测差异；`practice.vue` 计时分支（examMode/confirmFinishExam）无 UI 可达，UNTESTED。
- R553 主项自然样本 36h 窗口 0 `review_log`，不能判定「普通重练答对 → via=answer」是否被自然用户触发。
- 仓库无环境蓝图且本会话无蓝图权限。

## 6. 下一步 R555（候选，一手核实后择一）

1. `practice.vue startPaper` 计时分支是否死码（`untimed=false` 无 UI 写入方）→ 若坐实则连同 `examMode/examLeft/examTimer/finishExam/confirmFinishExam` 及模板一起清理，练习页体积/复杂度再降。
2. 小程序 `redoset` 完成态 `redoReport`（重练效果卡）与 H5 完成页字段/文案逐项比对。
3. 自然样本继续回看（`via='answer'` / `source='redo'`）；probe 真人口径。
