# R588：练习页换题 / 进完成页不回页首（H5 + 小程序小修）+ R586-1 窄 digest 有命中实战转正

日期 2026-09-11 · 分支 `devin/1789059399-r588-practice-scroll-top`（从 #765 分支开，链含 #742–#765）→ PR 见 handoff · 0 后端 · Pages `index-k16i1KRf → COAMONvv` · health 全程 `ec8206e5`

## 1. 研究（只读）

- 宿主（`~/r588/q588a.out`）：load 12.2–15.1 / mem_avail 201MB / disk 90.1% / health 2.74s `ec8206e5`；未 kill 未改配置。
- 自然样本 168.0h（POST 6553，剔 probe/harness）：`POST /api/practice_result` 自然 `200×4`、非 2xx / status 0 **0**（500×1/400×2/503×7/502×1 全 harness）；`answer_log 200×53`、`practice/progress 200×29`（p90 ≤0.06s）；`daily_set/submit`/`merge_anon`/`favs` 自然 0 → **R580-1 继续不实施**。
- 375 走「首页 → 免注册立即开练（每日一练）→ 答 10 题 → 完成页」链路（`~/r588/shots588.py` uid `test-r588-shots`，`/api/track` stub）：API 全 2xx、console/pageerror 0；截图 `~/r588/shots/375-daily-{q1,feedback1,feedback2,lastq-feedback,done}.png`。完成页截图 `375-daily-done.png` 首屏顶部不是「本组完成 / 20%」成绩头图而是头图下半段——与 R582 每日一练完成页走查截图同态，当时未量测被当成截图时机差异。

## 2. 缺陷量测（生产 `index-k16i1KRf`，`~/r588/scroll588.py`，uid `test-r588-scroll`，375×812）

每题一律点 A（多数答错 → `revealAfter()` 下滚到解析），记录 feedback 态与点「下一题」后新题落地的 `window.scrollY`：

| 步 | y | 页高 | 题干 top | 说明 |
|:--|---:|---:|---:|:--|
| q1 落地 | 0 | 813 | 165 | |
| q1 反馈 | 238 | 2046 | −73 | `revealAfter` 下滚 |
| **q2 落地** | **56** | 868 | 109 | 只被新页高夹住（868−812），顶栏进度 `2/10` 被滚出导航栏下 |
| q2 反馈 | 404 | 1921 | −239 | |
| q3–q6 落地 | 1 | 813 | 164 | 新页高 ≈ 视口，夹到 1 → 看起来正常 |
| q6 反馈 | 66 | 1498 | 99 | |
| **q7 落地** | **66** | 971 | 99 | 同 q2 |
| q7 反馈 | 532 | 1840 | −367 | |
| q10 反馈 | 148 | 1790 | 17 | 末题答错 |
| **完成页落地 / 数据落地后** | **148 / 148** | 1502 | — | 「本组完成 / 20% / 答对 2/10」头图整块滚出首屏（`375-sc-done-land.png`） |

结论（一手）：`next()` 只 `idx++` 换数据，不动文档滚动；新题落地 `scrollY` = 上一题反馈态滚动量被新页高夹住后的残余。短题页高 ≈ 视口时夹到 0/1 掩盖了问题，长题（带材料 / 长选项）和完成页（页高 1502）必现。完成页首屏丢的是成绩头图 = 一场练习的核心反馈。

## 3. 设计论证

- 用户可感知：每日一练是首页主 CTA 路径；末题多为答错（反馈态滚过解析），进完成页第一眼看不到成绩；长题落地看不到顶栏进度条与题干开头。
- 架构一手核实：H5 页面滚动由 document 承担，`uni.pageScrollTo({scrollTop, duration:0})` 在 `@dcloudio/uni-shared` `scrollTo` 中 `duration === 0` 直接同步置 `documentElement.scrollTop` / `body.scrollTop`（`book.vue` 既有同用法）；小程序练习页主体是 `<scroll-view class="page-scroll" scroll-y type="list">`，`wx.pageScrollTo` 不作用于它（`scripts/page-scroll-lock.test.ts` 已锁此规则），既有安全做法是绑 `scroll-top` 并 `1 → 0` 触发（`pkgExam/shenlun/shenlun.ts`）。
- 挂点选择：H5 挂 `watch.idx`（下一题 / 答题卡跳题 / 完成 `idx = items.length` / 同页新一场 `idx = 0` 一处覆盖），`next()` 不重复调；`revealAfter()` 只在答错 `$nextTick` 后触发、不改 `idx`，不被回顶抵消（复验 8/10 答错题反馈态 y>0 仍成立）。小程序 `goto()` 与 `finish()` 各调一次 `scrollToTop()`。
- 候选 (a) 在 `next()` 里调 —— 漏答题卡跳题 / 同页新一场；(b) `watch.idx` —— 选 (b)；(c) 平滑滚动 —— 换题应即时落地，选 `duration: 0`。

## 4. 实修

- `frontend-uni/src/pages/practice/practice.vue`：`watch.idx` 追加 `this.scrollToTop()`；新方法 `scrollToTop()` → `uni.pageScrollTo({ scrollTop: 0, duration: 0 })`（try/catch）。
- `miniapp-native/miniprogram/pages/practice/practice.ts`：`data.scrollTop: 0`；`scrollToTop()` = `setData({scrollTop:1}, () => setData({scrollTop:0}))`；`goto()` 置题态后、`finish()` 置 `finished:true` 后各调一次。`practice.wxml` `scroll-view` 绑 `scroll-top="{{scrollTop}}"`。
- 测试 `frontend-uni/tests/r588-practice-scroll-top.test.js`（4 例源锁：H5 `watch.idx` 调回顶 + `pageScrollTo(0,0)`；`next()` 不重复；`revealAfter` 仍下滚；小程序绑 `scroll-top` + `goto/finish` 调 + 无 `wx.pageScrollTo`）。
- 本地门：H5 `npm run lint` 0 error（lint-pages 存量 20 warn）/ vitest 205 文件 1582 / `build:h5` `index-COAMONvv`；小程序 tsc 0 / lint 0 error / vitest 17 文件 82；`git diff --check` 空。

## 5. 发版 + 生产复验

- Pages only（`~/r588/pages_deploy.sh`）：线上 bundle `index-COAMONvv` 与本机一致、7 种 Accept-Encoding 全 javascript、7 条回归 URL 200、health 前后 `ec8206e5`。
- 复验（`~/r588/verify588.py`，375 两场 uid `test-r588-verify-375{,b}` + 1440 `test-r588-verify-1440`，`about:blank` 冷进首页 → 点「免注册立即开练」→ 每题点 A → 答错后再手动 wheel 300 → 下一题；完成页下滑 600 后点「只重练本组错题」）：

| 项 | 375 | 375b | 1440 |
|:--|:--|:--|:--|
| bundle `index-COAMONvv` | PASS | PASS | PASS |
| 答错反馈 `revealAfter` 仍下滚（y>0） | 8/10 PASS | 8/10 PASS | 6/10 PASS |
| 每次换题落地 `scrollY == 0`（含手动下滑 337–832 后） | 9/9 PASS | 9/9 PASS | 9/9 PASS |
| 每次换题落地顶栏进度 `n/10` 在导航栏下 | PASS | PASS | PASS |
| 完成页落地 / 数据落地后 `scrollY == 0`（页高 1502 / 1414） | PASS | PASS | PASS |
| 「本组完成」top 84 / 大数字 `20` 111..146 在首屏 | PASS（数字项第一场为选择器写错，第二场 `.kg-hero__num` PASS） | PASS | PASS |
| 完成页下滑 600/514 后同页开下一场首题 y==0、`1/10` 可见 | PASS | PASS | PASS |
| API / 非 2xx / console / pageerror | 67 / 0 / 0 / 0 | 64 / 0 / 0 / 0 | 69 / 0 / 0 / 0 |

- 375b 一条 `requestfailed /api/home_bundle`：紧接 `api.js` 内建重试 200，位于首页 → 练习页切换时刻，推断为离开首页时在途请求被取消（未一手核实原因，用户不可感知、不计自然失败）。
- 截图 `~/r588/shots/{375,1440}-v-{q3-land,done-land,done-settled,next-session-q1}.png`（修前 `375-sc-done-land.png` / `375-sc-q2-land.png`）。

## 6. R586-1 窄 digest 有命中实战（`~/r588/clean588.py` = `clean587.py`，`run_clean588.sh`）

| 批 | uid | before hits | clean 回执 | after | 独立 ro | 共享 42 | 41 表窄聚合 | clean 用时 |
|:--|:--|:--|:--|:--|:--|:--|:--|---:|
| a | `test-r588-shots` / `-scroll` | mistakes 16 / practice_results 2 / answer_log 20 / daily_set_entries 2 = 40 | 逐表相等 40 | `{}` | `{}` | 同 | before==after | 0.2s |
| b | `test-r588-verify-{375,375b,1440}` | mistakes 24 / practice_results 3 / answer_log 30 / daily_set_entries 3 / practice_progress 3 = 63 | 逐表相等 63 | `{}` | `{}` | 同 | before==after | 0.2s |

五 uid 合并再独立 `ro` `{}`。`EXIT 0`、stderr 逐阶段、stdout 非空回执，全程 <1s（R586 旧口径两趟 125s）。**窄 digest 转正为模板**（`~/r588/clean588.py` / `run_clean588.sh`）；边界不变：脚本无 UPDATE，若加 UPDATE 回 `--full`。`growth_events` 0 命中 = 走查/复验全程 track stub 生效（stub 计数 4/场）。

## 7. 如实登记

- UNTESTED：小程序端 `scroll-top` 1→0 运行时（仅源锁 + tsc；R536-1 累计）；答题卡跳题回顶（`idx` 同 watch，未在生产点答题卡）；按卷 / 强化 / 错题重练场的换题回顶（同 `watch.idx`，复验只走每日一练 + 同页「只重练本组错题」首题）；真机 375；其它浏览器。
- 推断（未证）：R582 每日一练完成页走查截图「头图下半段」同态即本缺陷；`home_bundle` 一次 requestfailed 为页面切换取消。
- 登记 **R588-1（P3 观测）**：完成页数据落地（排行榜 / 薄弱考点）后页高从 1502 不变，回顶后无二次跳动。
