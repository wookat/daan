# R589：错题本页内复习模式换题 / 开始复习不回页首（H5 + 小程序小修，R588 同型）

日期 2026-09-11 · 分支 `devin/1789060288-r589-review-scroll-top`（从 #766 分支开，链含 #742–#766）→ PR · 0 后端 · Pages `index-COAMONvv → nZ7Il9bc` · health 全程 `ec8206e5`

## 1. 研究（只读）

- 宿主（`~/r589/q589a.out`）：load 16.16 / 15.96 / 13.91、mem_avail 218MB / disk 89.7% / health 1.62s `ec8206e5`；未 kill 未改配置。
- 自然样本 168.0h（POST 6629，剔 probe/harness）：`POST /api/practice_result` 自然 `200×4`（p50/p90 0.02/0.04s）、非 2xx / status 0 **0**（500×1/400×2/503×7/502×1 全 harness）；`answer_log 200×53`、`practice/progress 200×29`；`daily_set/submit`/`merge_anon`/`favs` 自然 0 → **R580-1 继续不实施**。
- 生产没有 `/pages/review/review`，复习 = `pages/book/book` 页内 `reviewing` 模式；脚本用 `#/pages/book/book?review=1`（`onLoad` 读 `review` 参数自动 `startReview`）冷进。

## 2. 缺陷量测（生产 `index-COAMONvv`，`~/r589/walk589.py 375 <uid> read`，375×812，`/api/track` stub 命中 7–8/场）

先用每日一练每题点 A 造 8 道到期错题（答对 2/10），冷进错题本自动开复习；每题点 A（多数答错 → 加练同类 / 重排，列表 8 → 22 题），模拟用户**下滑读完解析**（`scrollTo(0, scrollHeight)`）再点 sticky「下一题」，记录每步 `{scrollY, scrollHeight, .rhead top, .q top}`。三场（`test-r589-review{,-b,-c}`）逐题数值一致：

| 步 | y | 页高 | rhead top | 题干 top | 说明 |
|:--|---:|---:|---:|---:|:--|
| r1 落地 | 0 | 813 | 73 | 121 | |
| r1 答后读完解析 | 918 | 1730 | −845 | −797 | 解析在首屏之下，读解析下滑是用户正常行为 |
| r2–r5 落地 | 4 / 1 / 1 / 1 | 813–816 | 69–72 | 117–120 | 新页高 ≈ 视口 → 残余被夹到 0–4，看起来正常 |
| r5 答后读完解析 | 298 | 1110 | −225 | −177 | |
| **r6 落地（资料分析材料题）** | **122** | 934 | **−49** | **−1** | 「复习 6/19」tag、「退出复习」与题干前两行滚出首屏（`~/r589/shots/375-r6-land.png`） |
| r7–r15 落地 | 1 / 1 / … / 4 | 813–816 | | | 同 r2–r5 |

结论（一手）：`nextReview()` 只 `rIdx++` + `resetQ()` 不动文档滚动，新题落地 `scrollY` = 上一题读解析的滚动量被新页高夹住后的残余；R588 练习页同型。短题（页高 ≈ 视口）掩盖问题，**新题比视口高（长材料 / 长选项）时必现**，本样本 14 次换题中 1 次（资料分析）。API 117/125 全 2xx、requestfailed 0、console/pageerror 0 → 不是后端 / 运行时异常。

## 3. 设计论证

- 用户可感知：复习模式的标准动作就是「答 → 下滑读解析 → 下一题」，复习题里资料分析 / 长材料题占比不低；落地看不到 `复习 n/N` 进度与题干开头，用户需手动上滑。
- 机制与 R588 同：H5 文档滚动 → `uni.pageScrollTo({scrollTop:0,duration:0})`（`exitReview` 自 R513 起已用同一调用）；小程序 `book.wxml` 主体 `<scroll-view class="page-scroll">`，`wx.pageScrollTo` 无效 → 绑 `scroll-top` 并 `1 → 0`（practice R588 / shenlun 同法）。
- 挂点：H5 不挂 `watch.rIdx`——`startReview()` 置 `rIdx = 0` 时若原值已是 0 不触发（列表下滑后点「开始复习」同样需要回顶），故显式在 `startReview()` 与 `nextReview()` 换题分支调 `scrollToTop()`；完成分支经 `exitReview()` 已回顶不重复；`resumeReview()` 冷加载态 y 本就 0 不另调。小程序 `startReview` / `onNextReview` 换题分支 / `exitReview`（原无任何回顶，与 H5 `exitReview` 对齐）各调一次。
- 不改：sticky「下一题」按钮位置、`saveReviewSnap` 时序、复习列表内容。`exitReview` 保留原 `uni.pageScrollTo` 直调（R513 源锁 `tests/book-r513-exit-review-scroll-top.test.js` 锁字面量，不为通过而改测试）。

## 4. 实修

- `frontend-uni/src/pages/book/book.vue`：新方法 `scrollToTop()`（try 包裹 `uni.pageScrollTo({scrollTop:0,duration:0})`）；`startReview()` 末、`nextReview()` 换题分支 `saveReviewSnap()` 后各调一次。
- `miniapp-native/miniprogram/pages/book/book.ts`：`data.scrollTop: 0`；`scrollToTop()` = `setData({scrollTop:1}, () => setData({scrollTop:0}))`；`startReview` / `onNextReview` 换题分支 / `exitReview` 调用。`book.wxml` `page-scroll` 绑 `scroll-top="{{scrollTop}}"`。
- 测试 `frontend-uni/tests/r589-review-scroll-top.test.js`（5 例源锁：H5 `scrollToTop` 口径、`nextReview` 换题分支调 / 完成分支不重复 + `exitReview` 直调保留、`startReview` 调 / `resumeReview` 不调、`.next-btn` 仍 sticky、小程序绑 `scroll-top` + 三处调 + 无 `wx.pageScrollTo`）。
- 本地门：H5 `eslint` 0 error / vitest **206 文件 1587**（含既有 R513 源锁）/ `build:h5` `index-nZ7Il9bc`；小程序 tsc 0 / `npm run lint` 0 error（存量 20 warn）/ vitest 17 文件 82；`git diff --check` 空。

## 5. 发版 + 生产复验

- Pages only（`~/r589/pages_deploy.sh`）：线上 bundle `index-nZ7Il9bc` 与本机一致、7 种 Accept-Encoding 全 javascript、7 条回归 URL 200、health 前后 `ec8206e5`。
- 复验（`~/r589/walk589v.py` 375 uid `test-r589-v375` / `walk589v2.py` 1440 uid `test-r589-v1440`，同 fixture：每日一练造 8 道到期 → 冷进错题本列表 → 点「开始复习」→ 每题点 A → `scrollTo` 页底读完解析 → 「下一题」直到小结，`/api/track` stub 命中 9/场）：

| 项 | 375 | 1440 |
|:--|:--|:--|
| bundle `index-nZ7Il9bc` | PASS | PASS |
| 列表下滑后点「开始复习」首题落地 y==0 | （脚本 scrollIntoView 把列表滚回 0，未有效触发）| PASS（列表 y=400 → JS click → r1 落地 y=0） |
| 答后读解析仍下滑（y>0） | 22/22（189–936） | 22/22（≤340） |
| 每次换题落地 `scrollY == 0`、rhead top 73 / 题干 top 121 在导航栏下 | **21/21 PASS**（含 r6 / r20 页高 934 修前必现项） | 21/21 PASS |
| 小结落地 y==0 | PASS（页高 3735） | PASS（页高 2808） |
| API / 非 2xx / requestfailed / console / pageerror | 147 / 0 / 0 / 0 / 0 | 147 / 0 / 0 / 0 / 0 |

- 截图 `~/r589/shots-after/{375,1440}-{list-before-start,r1..r4-land,r1..r2-scrolled-read,review-done,review-done-full}.png`（修前 `~/r589/shots/375-r6-land.png`）。

## 6. 清账（`~/r589/clean589.py` = clean588 模板，`run_clean589.sh`）

5 uid（`test-r589-review{,-b,-c,-v375,-v1440}`）ro→clean→ro：before `mistakes 59 / practice_results 5 / answer_log 50 / review_log 62 / daily_set_entries 5 / review_cur 3` = 184 → clean 回执逐表相等 184 → after `{}` → 独立 ro `{}`；共享 `test-r562-modal-%` 42 保持、41 表窄聚合 before==after；`growth_events` 0 命中 = track stub 生效。

## 7. 如实登记

- UNTESTED：小程序 `book` 页 `scroll-top` 1→0 运行时（仅源锁 + tsc；R536-1 累计）；H5 375 列表下滑后「开始复习」回顶（脚本 scrollIntoView 抵消，仅 1440 一次实测 + 源锁）；`resumeReview` 断点续做落地（未走）；真机；其它浏览器。
- 观测：复习页高按题不同 813–1748，只有 > 视口的题才暴露残余滚动——复验必须让每题「读完解析」再换题，且断言要看 `rhead top`，不能只看 y。
