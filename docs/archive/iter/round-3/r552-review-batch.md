# R552：复习小结分组口径「本组 N 道完成 · 还有 M 道到期」+「继续复习下一组」CTA + 加练同类每轮上限 6 + 小程序 celebrateN 与 H5 同口径

日期 2026-09-08 · 前序 R551（`docs/iter/round-3/r551-card-reason-probe.md`）· 分支 `devin/1788906738-r552-review-batch`（从合入 #703 后 main `ac98c0b8` 开）· 代码 #705（已合入 main `74eb19aa`）· 本文档 = 研究 + 实修 + 生产复验回填

## 1. 研究（一手证据，先调查再立项）

### 1.1 R551 留下的四候选核实

生产只读 `file:/data/data.db?mode=ro`（`~/r545/q552*.py`，容器内执行，2026-09-08）+ 源码：

| 候选 | 一手数据 | 结论 |
|---|---|---|
| ① 复习页/复盘卡是否缺错因直显（`review.vue`） | H5 **没有** `review.vue`——复习模式是 `book.vue` 内 `reviewing` 分支；答错后已有「错因自评」chip-row（`v-if="!wasCorrect && reviewReasonMid(cur)"`），小程序同有 | 不存在缺口，**不立项** |
| ② 卡面错因标签 × 顶部错因筛选联动 | 生产 `growth_events` 无「筛选发现」类信号；错因标注仅 7/287 行，联动收益无法用数据支撑 | UX 论证不足，**不立项** |
| ③ 小程序卡面错因可点对齐 H5 | 小程序 `m-meta-warn` 只读；小程序真机通道仍缺（R536-1），无法复验 | 暂缓（真机通道恢复后小改） |
| ④ ≥3 天后按 `probe` 真人口径重跑错因覆盖率 | `mistakes.probe` 非测试 287 行**全 NULL**（R551 起才打标，历史不回填）；`answer_log` 近两日 probe=0 行 33/20、probe=1 行 67/8——真人样本刚开始积累 | 口径尚不可用，**不立项**（继续等） |

### 1.2 研究过程中发现的用户可感知矛盾（→ 主项）

- 后端 `api_review_due` 返回 `{"items": db.due_reviews(uid=u), "total": db.due_review_count(uid=u)}`，而 `due_reviews(limit=20)` **一次只下发 20 道**，`total` 是全量到期数。
- 生产到期错题 **285 行 / 71 uid**，单 uid 最多 30+ 道到期（`due_review_count` 与 `LIMIT 20` 之差 > 0 的 uid 真实存在）；`next_review IS NULL`（从未复习过）257 行——新用户一旦积累 >20 道错题必然踩到。
- H5 `book.vue` 与小程序 `book.wxml` 小结层都**写死**「今日复习已清零 / N 道到期错题全部复习完成」，做完一组回到列表却仍见「今日待复习 10」——文案与状态自相矛盾，用户无法得知还要不要继续，也没有「继续」入口（只能再点一次「开始复习」）。
- 两处既有口径问题一并暴露：
  - 答错自动加练同类题每题 ≤2 道、但每轮**无总上限**——20 道全错 → 20 requeue + 40 extra = 80 道会话，`复习 x/80` 让人放弃；
  - 小程序 `celebrateN = rItems.length`（含 extra/requeue），H5 是 `filter(!_extra && !_requeued).length`，两端「完成 N 道」数字不一致。

### 1.3 设计论证

- **一组 = 一次 `/api/review` 下发**（`REVIEW_BATCH = 20` 镜像服务端 `due_reviews` 默认 limit；改档位需同步两处，与 `MASTER_STREAK=6` 同类约定）。不改后端分页协议：`total` 已足够算剩余。
- 剩余到期 `dueLeft = max(0, total − 本组到期条目数)` 先本地估算（小结瞬间可见），`exitReview → load()` 回包后以服务端 `total` 覆盖（`if (celebrate) dueLeft = dueTotal`）——重出题在同一组内已复习，服务端 `next_review` 已推到明天，不会重复计入。
- 文案分两态：`dueLeft>0` →「本组复习完成 / 本组 N 道复习完成 / 还有 M 道到期待复习」+ 主按钮「继续复习下一组（min(M,20) 道）›」，强化建议降为次按钮；`dueLeft=0` → 原「今日复习已清零」+ 原强化/回错题本分支**原样**（R550 合层不动）。
- 「继续复习下一组」= 关层 → `await load()`（**必须重拉**：`exitReview` 里的 `load()` 可能仍 in-flight，直接用 `this.due` 会拿到刚做完的旧 20 道）→ `startReview()`；重拉后 due 为空 toast「到期错题已复习完」。埋点复用 `review_entry_click` + label `next_batch`。
- 加练总上限 `REVIEW_EXTRA_MAX = 6`：`similarRoom(rItems) = min(2, 6 − 已有 extra 数)`，为 0 直接返回且**不置 `_simFetched`**（额度只在本轮内耗尽，不污染条目状态）；`/api/questions?limit=room` 少拉少算。上限 = 3 道错题各 2 道，覆盖「一组里错 3 道」的常见情况，会话最长 20+20+6=46。
- 小程序 WXML 不能调函数，`celebrateCopy` 在 `setData` 时算好；标题保留小程序原有「！」。

## 2. 实修（H5 +67/-9、小程序 +80/-11、测试 +150/-8，0 后端/协议改动）

共享纯函数（H5 `frontend-uni/src/review-summary.js` / 小程序 `miniapp-native/miniprogram/utils/review-verdict.ts` 同口径）：

```js
REVIEW_BATCH = 20; REVIEW_EXTRA_MAX = 6;
similarRoom(rItems)            // min(2, 6 − extra 数)，0 = 不再加练
reviewDueLeft(dueTotal, done)  // max(0, total − done)
reviewDoneCopy(done, left)     // left>0 → {cleared:false, title:'本组复习完成', line, cta:'继续复习下一组（min(left,20) 道）›'}
                               // left=0 → {cleared:true, title:'今日复习已清零', line:原文案, cta:''}
```

页面：H5 `book.vue`（`dueTotal/dueLeft` 状态、`doneCopy` computed、sheet 标题/正文/CTA 走 `doneCopy`、`continueReview()`、`appendSimilar` 受 `similarRoom`、`.cb-left` warn-strong）；小程序 `book.ts`（`celebrateN` 改 `filter(!extra && !requeued)`、`dueLeft/celebrateCopy` setData、`onContinueReview()`、`appendSimilar` 受 `similarRoom`）+ `book.wxml`（`celebrateCopy.title/line/cta`，`!cleared` 分支主按钮继续下一组）+ `book.wxss`。

测试：新增 `frontend-uni/tests/r552-review-batch-left.test.js`（纯函数边界 / 两端同口径 / H5+小程序源锁）；R541/R549/R550 与小程序 `review-next.test.ts` 四处源锁仅 import 行与 `setData` 锚点随本轮变化而更新，断言语义不变。

本地门：pytest 726 / ruff / pyright 0；vitest 全量 1087（+10）/ eslint+tokens+edge 0 / build:h5 `index-DGKBsjUz.js`；小程序 tsc+eslint 0 / vitest 29；`git diff --check` 空。

## 3. 生产部署

`deploy_h5.sh --skip-build` `f8fd391d → a952a1cb`（宿主空闲 compose ~110s；bundle `index-DGKBsjUz.js` 7 变体 JS；回归全 200；LH `/` perf 0.99 / a11y 1.00 / LCP 1436 / CLS 0.06，`/tiku/` 全 1.00）。#705 合入 main `74eb19aa`（与 a952a1cb 仅 merge commit 差，文件一致）。

## 4. 生产黑盒复验（testing agent，a952a1cb）

生产 `https://kaogong.zalize.com`，开始/结束三证（health / HTML / runtime）均 `a952a1cb / index-DGKBsjUz.js`。Playwright 接既有 Chromium CDP `localhost:29229` 独立 context、全部 API 带 `X-Kg-Probe: 1`；fixture 用页面上下文 POST `/api/mistakes`（null-qid 手录题保证答案确定，不直写库），作答/下一题/下一组/恢复/强化/FAB 全走可见 UI；375×812 与 1440×900 各自独立 fixture mid 集（同 uid 第二视口用新 mid，前一视口已复习到明天）。隔离 uid：`test-r552-group-c8d67cab` / `test-r552-count-574418a2` / `test-r552-cap-7a105f56`。报告 `~/kaogong-reports/r552-prod-verify.md`，录像 `~/screencasts/r552-a952a1cb-production/r552-a952a1cb-production-edited.mp4`，截图/审计 `~/r552-verify/`。

### 4.1 逐项结果

| 项 | 375 | 1440 | 观察 |
|---|---|---|---|
| A 起始到期 / 每组限额 | PASS | PASS | 顶部 23；`GET /api/review` `total=23 / items=20`；「复习 1/20」 |
| A 首组小结 | PASS | PASS | 「本组复习完成」「本组 20 道复习完成 · 首答对 20」「还有 3 道到期待复习」「继续复习下一组（3 道）›」+「回错题本」；**无**「今日复习已清零/全部复习完成」措辞 |
| B 单击下一组 | PASS | PASS | 新 `GET mistakes + review` 均 200，直接「复习 1/3」；`review_entry_click` 埋点 200（`source=next_batch`，3 行 probe=1） |
| B 第二组完成 | PASS | PASS | 「今日复习已清零」「到期 3 道全部复习完成」；无「还有」/ 下一组按钮 |
| B 返回与 DB | PASS | PASS | 一次回列表、今日待复习 0；每宽 23 条 `review_log` 全 `correct=1 / probe=1`（group uid 累计 46，按 mid 分别核） |
| C 原题/重出/加练计数 | PASS | PASS | 4 原题 + 1 重出 + 2 加练共 7 项；小结仍「到期 4」、错 1 已重出、加练 2 |
| D 六道加练上限 | PASS | PASS | 8 题首四错后 `reviewSnap` 总条目 11/14/17/18，加练 2/4/6/6；最终到期 8、错 4、加练 6 |
| D 不再请求 / 不置标记 | PASS | PASS | 各宽仅 3 次 `/api/questions?limit=2`（各回 2）；第四错无新增请求且第四项无 `_simFetched` |
| E 进度快照恢复 | PASS | — | 重载后「上次复习中断在第 1/7 题」→ 继续 → 同一已答项及反馈恢复；核心 4 题共 5 条 review 无重复写 |
| E 错因 PATCH + 卡面 badge（R551） | PASS | — | `PATCH /api/mistakes/3589 error_reason=概念不清` 200，回列表 badge 可见 |
| E 连对 / 下次天数（R546/R549） | PASS | — | 「连对 1 次」「下次 1 天后」；小结「明天 N 道」与回包一致 |
| E 强化建议与跳转（R550） | PASS 功能 / **FAIL 严格无 warn** | — | 小结内嵌建议 → 真实新题练习 1/5，`mode=reinforce&limit=5` 回 5 题；console 1 条 uni-h5 warn 见 4.2 |
| E 手录入口（R550） | PASS 入口 | — | FAB「手录错题」表单打开可编辑；未提交，不声称全流程复验 |
| 边界：服务端剩余覆盖估算 | PASS | — | 21 题组中途新增 1 道到期，完成 20 后小结从估算「还 1」更新为真实「还有 2」 |
| 边界：下一组刷新为空 | PASS | — | 以授权页面 fetch 模拟另一客户端完成余下 2 题，再点 CTA → 真实空回包 + toast「到期错题已复习完」，未进入空卡 |
| F HTTP 与付费 | PASS | PASS | 2278 请求 / 2266 响应**全部 200**（304/4xx/5xx 0）；`/api/*` 429/429 均 200 且全带 probe；`ask`/`mistake_analysis`/OCR/explain 付费 0；30 次 `GET mistakes` items 无 `probe` 键 |
| F console/runtime | **FAIL 严格零 warn** | 汇总 | console error / Runtime exception / unhandled rejection / browser-log error 均 0、无 `[Vue warn]`；**warning 1**（4.2）。取消 13 次全为 tab 图标图片 `ERR_ABORTED`（1 次已收 200 后取消），API 取消 0 |
| 清理与不变量 | PASS | 共用 | 停录像 → 关 context → 41 表精确删 231 行（mistakes 92 / review_log 102 / growth_events 36 / reinforce_log 1）→ 新 SSH 只读核 3 uid + `test-r552-%` 前缀 0 残留；questions 156792 / answer_log 1386 / taxonomy / explain_cache 82 / paper_exports 38 前后 SHA-256 全同，未导出 PDF |

### 4.2 差异与如实

- **FAIL（严格无 warning 口径）**：375 小结点「强化 5 道新题」后 console 出现 1 条 `请注意 showLoading 与 hideLoading 必须配对使用`，堆栈 `startReinforce`（`pages-practice-practice.DOKhcI1Q.js`）。功能正常进入 1/5。核源码：**既有 P3、非 R552 回归**（R552 未改 `practice.vue`）——`startReinforce` 在 `try` 内 `showToast('同考点强化开始…')`（uni-h5 toast 顶掉 loading）后 `finally { hideLoading() }` 无 loading 可隐藏。**已修** #706（回包后先 `hideLoading` 再 toast，catch 同；+源锁 `r552-fix-reinforce-loading.test.js`；vitest 全量 1088 / lint / build:h5 绿），待合入后随下轮发版回归。
- 埋点字段：测试指令写的「`label=next_batch`」实际协议是 `{"event":"review_entry_click","source":"next_batch"}`（`trackEvent(event, source)` 一贯口径），来源值/200/DB 均通过，非缺陷。
- UNTESTED：剩余额度恰为 1 的 `limit=1` 加练分支（生产每次足额回 2）、显式「退出复习」按钮后重进的独立断言、完整手录保存/PDF 与 R545/R546 回归（本轮未重跑）、小程序真机/DevTools（R536-1 累计）。恢复 PASS 仅指离开/重载后恢复卡→继续。

### 4.3 结论

R552 主项（分组口径 + 剩余数 + 下一组 CTA + 加练上限 6 + 计数口径）双视口 A–D 全 PASS、边界两项 PASS、R546–R551 回归抽检 PASS、数据 0 残留；唯一非 PASS 项为既有 loading 配对 warn，已单独热修 #706。
