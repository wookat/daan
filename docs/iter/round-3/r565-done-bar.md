# R565：练习完成页主出路改固定底栏（H5 对齐小程序 `doneBarPlan`）+ R564-1 LCP 违例 Lantern 归因 + 小程序两处恢复确认 cancel 语义核实

日期：2026-09-10。范围：H5（`frontend-uni`）+ 小程序两处文案/`fail` 分支（`miniapp-native`），0 后端 / 协议改动。分支 `devin/1788971802-r565-done-bar`（从 #744 分支开，含线上 `27e52f96` 谱系）。

## 1. 研究（一手证据）

### 1.1 R564-1：`/` LCP 四次两违例、benchmarkIndex 均高 → Lantern 关键链敏感，不是首页回归

`deploy/perf-budget.sh` 默认 Lighthouse **simulated** 节流（`MAX_LCP_MS=3000`、`MIN_BENCH=1800`，LCP 违例非阻断除非 `PERF_BUDGET_STRICT=1`）。本轮对生产 `27e52f96`（`index-Cz_UU7OO.js`）独立跑 4 次默认 + 2 次 `--throttling-method=devtools`，JSON 落盘 `~/r565/lh{1..4}.json`、`lhdt{1,2}.json`：

| 样本 | benchmarkIndex | Perf | 模拟 FCP / LCP | **观测** FCP / LCP（`observedFirstContentfulPaint` / `observedLargestContentfulPaint`） | TTFB | 观测 FCP 前完成的 High/VeryHigh 请求数 / 字节 |
|---|---:|---:|---:|---:|---:|---:|
| lh1（过） | 3321 | 0.98 | 1697 / 1997 ms | 185 / 185 ms | 76 ms | **3 / ≈148 KB** |
| lh2（违例） | 3486 | 0.85 | 2622 / 3748 ms | 216 / 216 ms | 71 ms | **47 / ≈256 KB** |
| lh3（违例） | 3607 | 0.84 | 2637 / 3724 ms | 187 / 187 ms | 77 ms | 48 / ≈258 KB |
| lh4（过） | 3569 | 0.97 | 1835 / 2135 ms | 196 / 196 ms | 68 ms | 3 / ≈148 KB |

- 四次 **观测** FCP/LCP 全部 185–216 ms、TTFB 68–77 ms，服务端与真实首屏没有变化；**模拟** LCP 在 2.0 s 与 3.7 s 之间二值跳变。
- 差异全在 Lantern 关键链输入：违例样本里 `route-preload` 注入的 modulepreload 依赖（home / 组件 / `kg-sheet` / `wd-popup` / `wd-datetime-picker` / `export-confirm` / `exam-resume` / `practice-prefs` / `review-snap` 等 44 个 chunk）在**观测 FCP 之前**就以 High 优先级完成，Lantern 把它们全部算进 FCP/LCP 关键链（模拟 FCP 1.7 s → 2.6 s）；通过样本里同一批 chunk 在观测 FCP 之后才到，不进链。这与 R443（`r443-lcp-budget-lantern-calibration.md`：模拟 2.7 s vs 观测 0.1–0.2 s，微小时序差改变 Lantern 高优先级资源图）同一机制。
- benchmarkIndex 3321–3607 全部高于 1800 阈值，R562「本机 CPU 漂移」解释确实不覆盖这组，但也不需要：CPU 只决定模拟倍率，二值跳变来自「哪些请求赶在观测 FCP 前」。
- 真实 devtools 节流两次（`lhdt1/2`）：FCP=LCP 734–752 ms、TBT 258–283 ms、TTI ≈3.6 s，但 Lighthouse 同时报 `The page loaded too slowly to finish within the time limit. Results may be incomplete.`——**只能作方向性证据，不是完整基准**。

结论：**不改产品代码、不改预算**。证据支持「Lantern 关键链 / 观测 FCP 前 preload 资源集合的敏感性」，不支持「首页加载回归」；同时如实登记：这不等于证明真实弱网/低端机无问题（devtools 节流样本不完整，且没有真机 RUM）。可选后续（不立项）：把 `route-preload` 注入的 modulepreload 数量作为 perf-budget 诊断打印，或让 perf-budget 同时打印观测 FCP/LCP 供人工分辨。

### 1.2 375 完成页信息层级截图走查（一手：本机 dist + 生产 API 只读代理，R560/R548/R559 生产截图复看）
- 普通练习完成页（375×667，`b-complete-full-375.png` 整页高 ≈1050 逻辑 px）：蓝色完成卡 → 三指标 → 薄弱考点卡 → 逐题回顾 → 到期/每日提醒 →「只重练本组错题（N 题）」→「再来一组」→「分享成绩」→「返回…」。**主 CTA 位于页面 ≈850 px 处，首屏 667 之下**，用户看完成绩后必须滚过两张卡才见下一步。
- 对照同产品其它「结算态」：小程序练习结算态（R554 起 `doneBarPlan` + `<kg-action-bar wx:if="{{finished}}">` 固定底栏）、H5/小程序模考报告（固定「返回卷库 / 再考一次」）都已经是「报告在页内、下一步固定在视口底」。**H5 练习完成页是全产品唯一把主出路放在页内滚动流末端的结算态。**
- 粉笔对标如实：本轮没有粉笔 App 完成页的一手截图（无账号/真机），仅 SOP-10 二手描述「练习报告底部固定操作栏」，不据此推断细节；本轮设计依据是**自家两处已上线结算态的一致性 + 375 首屏一手测量**，不复制任何竞品素材/文案。

### 1.3 小程序三处恢复确认 cancel 语义（源码一手核实，`rg 'showModal' miniapp-native/miniprogram`）
| 调用方 | 标题 | cancelText | cancel 分支 | `fail` 分支 | 分类 |
|---|---|---|---|---|---|
| `pages/practice/practice.ts tryResume` | 继续上次练习？ | 不用了 | `removeStorageSync(PENDING_KEY)` + `clearServerProgress()` + `startFallback()` | 无（默认不处理） | **破坏**（显式点按） |
| `pkgExam/exam/exam.ts onLoad` | 继续上次模考？ | 重新开始 | `clearSnap()` + `start()` | `resolve(false)` → **同 cancel，丢快照重开** | **破坏**（且 fail 也破坏） |
| `pages/home/home.ts` ×3 / `pkgExam/list/list.ts` / `pages/exam/exam.ts` | 放弃未完成练习/复习/未交卷进度？ | 再想想 | `if (!res.confirm) return` | — | 非破坏 |

与 H5 R564 的差异边界：`wx.showModal` **没有** Esc / 遮罩 / Back 隐式关闭路径（原生弹窗必须点按其一），所以 R564「隐式关层 = 丢进度」在小程序不成立，不需要换自绘层；剩余两点是真实缺口——① `exam.ts` 的 `fail`（弹窗本身失败，非用户选择）等于丢进度；② 两处 content 都没说明「不用了 / 重新开始」的代价，而 H5 `resume-ask.js` 已写明「会清掉这组进度（已答记录仍进错题本）」/「会丢弃这些作答，从第 1 题重新计时」。`cancelText` 微信限 4 字，保持「不用了 / 重新开始」。

### 1.4 设计论证与择项
- 主项 **H5 练习完成页固定底栏**：用户可感知（每次做完一组都到）、与小程序/模考报告已上线口径一致（不是新交互）、改动小（复用 `kg-action-bar layout="actions"` 与既有 `retryWrong/retryGroup/goExamList/quit`）、0 后端。层级沿用 R553/R554：有错题 → 主「只重练本组错题（N 题）」/ 次「再来一组」（按卷：「重练本卷错题（N 题）」/「回卷库」）；全对或背题 → 主「再来一组 / 回卷库」/ 次「返回…」（R556 三态落点文案）。「分享成绩」留在页内（低频、非出路）。
- 备选「只把 CTA 上移到指标之下」不选：仍要滚过完成卡，且把出路插进报告中段会打断「先看结果再决定」的阅读顺序；固定底栏两者兼得。
- 备选「完成页也走 `kg-sheet` 结算弹层」不选：报告需要滚动阅读，弹层会遮报告。
- 顺手位（小程序）：`exam.ts fail → resolve(true)`（不丢快照）+ 两处 content 写明后果，与 H5 `resume-ask.js` 同口径。不改按钮、不换自绘层（原生无隐式关闭路径）。

## 2. 实修

### 2.1 H5
- `src/paper-continue.js` 新增 `doneBarPlan(items, ptitle, beiMode, back) → {primary, primaryAct, secondary, secondaryAct}`（`redo | retry | list | quit`），复用 `paperFinishState` / `wrongRetryPlan`，`back` 非字符串/空回落「返回」。
- `pages/practice/practice.vue`：结算段末尾渲染 `<kg-action-bar layout="actions" class="done-bar">`，文案/动作全部取模板方法 `doneBar()`（`_ptitle` 非响应式，与 `wrongRetry()` 同手法），`doneAct(act)` 映射到既有 `retryWrong / retryGroup / goExamList / quit`；行内 `done-acts` 只剩「分享成绩」+（底栏次位不是「返回」时的）文字「返回…」；`.page.has-bar` 条件从 `session && cur` 放宽到 `session`，结算态底部同样留 88 px 不被底栏遮住；主位文案带题数时 `.done-bar--long` 让主按钮 `flex:1.7`（375 一行放下「只重练本组错题（10 题）」）。
- 测试：新 `tests/r565-done-bar.test.js`（`doneBarPlan` 五态 + fail-closed + 与小程序 `done-bar.ts` 文案同口径源锁 + 接线源锁）；`r553-retry-wrong.test.js` 两条行内按钮断言改为底栏断言。

### 2.2 小程序
- `pkgExam/exam/exam.ts`：恢复确认 `fail: () => resolve(true)`；content 追加「重新开始会丢弃这些作答，从第 1 题重新计时。」
- `pages/practice/practice.ts`：content 改为「…上次还有一组未做完（n/N 题）。选「不用了」会清掉这组进度并开新一组（已答记录仍进错题本）。」（每题答错即 `postMistake`，事实成立）。
- 测试：新 `scripts/r565-resume-modal.test.ts` 源锁。

### 2.3 本地门
- H5：`npm run lint`（tokens 116 / eslint 0 / lint-pages 20 warn 存量）、`vitest run` **184 文件 1426 通过**（+1 文件 +10）、`build:h5` 成功；`git diff --check` 空。
- 小程序：`tsc --noEmit` 0、`lint` 0、vitest **14 文件 71 通过**（+1 文件 +2）。
- 本机 dist（`python3 -m http.server 8566`）+ 生产 API 只读代理（GET 转发带 `X-Kg-Probe: 1`，写请求本地 200/abort，0 生产写入）CDP 走查：375×667 结算态底栏 `position:fixed` top 598 / bottom 667，两键 136 + 195 px 各一行，「只重练本组错题（7 题）」不换行，页内「分享成绩 / 返回首页」位于底栏之上不被遮；1440 底栏 `sticky`，391 + 629 px。截图 `~/r565/shots/done-{375,1440}-*.png`。

## 3. 生产复验（`27e52f96 → 4e9137b3`，bundle `index-DZIsT9KZ.js`；发版 6b LH `/` 0.98/1.00/1.00/1.00 LCP 1977 ms、`/tiku/` 全 1.00）
375 主流程 + 1440 A/C 抽检，真实 UI 作答、物理 F5、DOM/存储/请求审计，6 个 `test-r565-4e9137b3-*` uid，**A–F 全 PASS、无 P0/P1**（PR #745 评论附截图；报告 `~/r565/prod/report.md`、53 张截图索引 `verification-ledger.json`、录像 `~/screencasts/r565-production-completion/`）：
- A 普通错 2/10：主「只重练本组错题（2 题）」/ 次「再来一组」；375 `fixed` bottom=667、1440 `sticky` top 807；两键 44 px 单行、主 flex 1.7；`.has-bar` 88 px，滚到底「分享成绩」bottom 531 / 文字返回 579 ≤ 底栏 top 598。点主位就地重开恰原 2 个错 qid（588512/634004，题干一致）；物理 F5 → 恢复层 → 继续仍 1/2、pending 整对象不变；重练全对后「再来一组 / 返回首页」；「再来一组」两次分别走无缓存 1 GET 与 prefetchPack 0 GET，均 1/10、十 qid 与前组零交集。
- B 全对 10/10：主「再来一组」/ 次「返回首页」→ `#/`，页内无重复返回。
- C 真实 75 题不计时卷（卷库卡「按卷练习（不计时）」→ `paper_questions?pid=5`、0 `exam/start`）：完成页卷名 +「重练本卷错题（1 题）/ 回卷库」+ 页内文字返回；回卷库 → `#/pkgA/exam/list`；几何同 A。
- D 背题：无重练、无分享，主「再来一组」。E 分享 → 「成绩已复制」toast；完成态 F5 回普通 1/10（既有行为，不声称结算态跨刷新保留）。F 练习中「下一题/完成」正常；R564 恢复层（答 2 F5 → 继续 3/10，0 questions GET / 0 progress POST，1 条 `practice_resume_cont` 200）正常。
- 分账：2777 CDP 事件 = 2402 HTTPS 全 200 + 375 `data:` 图标；API 824 条非 2xx 0、`/api/track` 400 0（13 条全 200）；console error / runtime / uni warning / 付费 0；9 条 console warning 为 Playwright 阻止 Service Worker 注册（harness）。清理精确删 245 行、41 表残留 0、共享 R562 42 行与保护 hash 保持。
- 我的测试指令两处口径修正（非缺陷）：同模块重练 `pendingSession.redo=0` 是 R553 设计（`retryWrong` 保留 `lastModule`，`redo` 只标错题本重练）；「再来一组」命中 R555 中场预取 0 GET 合法。4 次 harness 定位偏差（`.mod-tile`→`.kg-mod`、卷库入口文案「模考」非「真题卷库」等）已修正披露。
- 登记 **R565-1 既有 UX**：按卷练习页面标题仍静态「刷题」、内容头为当前题模块（`practice.vue` 无 `setNavigationBarTitle`），完成页归卷态正确；候选小改「按卷会话 nav 标题显卷名」。

## 4. 边界与登记
- 1.1 的 devtools 节流样本不完整（Lighthouse 超时告警），真实低端机/弱网表现未验证；无 RUM。
- 1.2 粉笔无一手截图，只作方向对照；未复制任何竞品素材。
- 小程序两处改动仅 tsc/eslint/源锁，未上真机（R536-1 累计）。
- 生产未覆盖：按卷全对分支与按卷主位实际重练、`redo`/`daily`/`remote` 来源完成页（次位「返回错题本 / 返回」两态）、跨设备恢复、SW/offline、IME、其它浏览器。
