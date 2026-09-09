# R553：练习完成页「只重练本组错题（N 题）」——普通练习与按卷统一错题重练入口（与小程序对齐）

日期 2026-09-09 · 前序 R552（`docs/iter/round-3/r552-review-batch.md`）· 分支 `devin/1788910151-r553-retry-wrong`（从合入 #706 后 main `6c4759d2` 开，后 merge #707 `e11573b9`）· 代码 #708 · 本文档 = 研究 + 实修 + 生产复验回填

## 0. R552 收尾：#706 发版

#706 合入 main `6c4759d2` 后 `deploy_h5.sh --skip-build` `a952a1cb → 6c4759d2`（bundle `index-DGKBsjUz.js → index-CwcPucPz.js`，回归全 200，LH `/` 全过预算）。生产 `/api/health` `rev=6c4759d2`。「强化 5 道新题」loading warn 归零的生产复验并入 §4（同一 testing agent 轮次）。

## 1. 研究（一手证据，先调查再立项）

### 1.1 R552 留下的候选核实

生产只读 `file:/data/data.db?mode=ro`（`~/r545/q553*.py`，容器内执行，2026-09-08）+ 源码：

| 候选 | 一手数据 | 结论 |
|---|---|---|
| ① 到期 >20 入口「今日待复习 N」是否提示分组 | 非测试到期 >20 的 uid 仅 2 个（31 / 30 道），11–20 道 5 个，≤10 道 64 个；H5 `book.vue` 首屏已显全量 `dueTotal`，R552 小结层已有「还有 M 道 · 继续下一组」 | 受众 2 uid、R552 已覆盖分组语义，**不立项**（若 >20 uid 增长再议「本组 20 道」CTA 文案） |
| ② 复习小结信息层级 UX 对标粉笔 | 无一手竞品操作台可走查；R549/R550/R552 已三轮改小结层 | 缺一手证据，**不立项**（避免审计-only） |
| ③ 小程序卡面错因可点 | 真机/DevTools 通道仍缺（R536-1 累计） | 暂缓 |
| ④ probe 真人口径错因覆盖率 | `mistakes.probe` 非测试历史全 NULL，R551 起打标样本仍少 | 继续等 |
| ⑤ 推送/提醒 | `push_subs` 0 行、VAPID 未配置、小程序订阅模板 ID 空 | 外部资源缺口，不立项 |

### 1.2 研究过程中发现的用户可感知差距（→ 主项）

- 近 30 天非测试 `answer_log` 309 行：`source` NULL 241 / `direct` 51 / `session-report` 10 / `reinforce` 5 / `search` 1 / `redo` 1 → **302/309 来自普通练习**；答错 169 行、新增 `mistakes` 198 行。39 个作答 uid 中 26 个有错题、仅 6 个有 `review_log`——错题「进本子」到「被再练」之间流失最大。
- H5 `practice.vue` 完成页 `done-acts`：**仅按卷**（`paperFinish().isPaper`，即 `_ptitle` 非空）有「重练本卷错题（N 题）」；普通练习只有「再来一组」= `start(lastModule)` 换新题，答错的题当场没有重练入口。
- 小程序 `practice.wxml` 结算态对**任何**场次都有「只重练本组错题（wrongCount）」（`onRedoWrong` → `redoSet` + `mode='redoset'`），两端不一致；粉笔/夸克报告页「错题重做」为标配。
- 服务端 `save_answer_log_detail`：答对 → `_find_open_mistake(conn, uid, mid, qid)` 按 qid 也能命中本 uid 未掌握错题并 `_advance_review(via="answer")`（R542 起「任何场次答对曾错题都算」）；因此当场重练答对即推进复习、完成页走既有 `fixReport`「答对 N 道曾错题已推进复习」，**0 后端改动**即可闭环。

### 1.3 设计论证

- 复用已上线的按卷路径（R366 `paperWrongItems` + `retryPaperWrong` 就地重开会话），把显隐条件从 `isPaper && wrong>0` 放宽为 `wrong>0`，文案按归卷态区分：普通「只重练本组错题（N 题）」（与小程序同词）/ 按卷保留「重练本卷错题（N 题）」。
- 按钮层级：有错题时重练为主按钮，「再来一组」/「回卷库」降 ghost（与按卷既有 `:variant="wrong>0 ? 'ghost' : 'primary'"` 同规则），避免双主按钮。
- 重练启动 `saveSession()`：R548 口径「重练启动即落 `pendingSession`」，刷新/后退前进走既有恢复；`lastModule/_source/_ptitle` 不动，完成后「再来一组」仍按原模块抽新题。
- 边界核实：每日一练 / 时政首次完成即 `markDailyDone/markShizhengDone`（置 `_daily/_shizheng=false`），重练不会二次打卡/提交；模考交卷 `examMode=false`；背题模式无 `_picked` 且显式 `!beiMode`；错题本重练场次（`_redoItems`）重练错题保留 `mistake_id`，完成页 `redoReport` 口径不变。
- 不做：不新增 `redoset` 存储/URL 协议（H5 就地重开更简单且已有按卷先例）；不改 `practice_result`/`practiceHistory` 记账口径（与按卷重练一致，各记一场）。

## 2. 实修（H5 `paper-continue.js` +12、`practice.vue` +8/-8、测试 +81，0 后端/小程序改动）

```js
// paper-continue.js
wrongRetryPlan(items, ptitle) // 无答错 → null；{ n, label, toast } 文案随 paperFinishState(ptitle).isPaper
```

`practice.vue`：`paperWrongN()/retryPaperWrong` → `wrongRetry()/retryWrong()`（模板方法调用规避非响应式 `_ptitle`）；`done-acts` 一个重练按钮 `v-if="!beiMode && wrongRetry()"` `icon="rotate-ccw"`，「回卷库」「再来一组」`variant` 随之；`retryWrong` 末尾 `saveSession()` + `plan.toast`。

测试：`frontend-uni/tests/r553-retry-wrong.test.js`（纯函数 4 例 + 源锁 4 例）。

本地门：vitest 全量 1096（+8）/ eslint+tokens+edge 0 / build:h5 `index-DdbZnRB6.js`；`git diff --check` 空。后端/小程序未改，不重跑。

## 3. 生产部署

- 第一次：`deploy_h5.sh` `6c4759d2 → 8e5322af`（#708 分支 HEAD；bundle `index-CwcPucPz.js → index-DdbZnRB6.js`；6/6 回归全 200；LH `/` perf 0.99 / a11y 1.00 / LCP 1398 / CLS 0.06，`/tiku/` 全 1.00）。
- 复验期间老板侧把 main W15（#709）merge 进 #708 分支（`7c80ef29`）并发版；本地 `git pull --ff-only` 后全量 vitest 1179 绿。
- 第二次（§5 热修）：发版分支 `devin/1788912168-r553-deploy` = `7c80ef29` merge #711 `f90d4cac` → `db847006`（2b 谱系闸 OK：线上 `7c80ef29` 为 HEAD 祖先；compose ~14 min，宿主 mem_avail 278 MB / disk 93%；bundle `index-MGGo0gNb.js`；6/6 全 200；LH `/` 0.99 / 1.00 / 1.00 / 1.00 / LCP 1398 / CLS 0.06，`/tiku/` 全 1.00）。#708 → main `d10ed355`、#711 → main `303369a1`（老板侧合入）。

## 4. 生产黑盒复验（testing agent，`8e5322af` / `index-DdbZnRB6.js`）

报告 `~/kaogong-reports/r553-prod-verify.md`，录像 `~/screencasts/r553-8e5322af-production/`，截图/审计 `~/r553-verify/`。独立 CDP context，全部 439 个 API 请求带 `X-Kg-Probe: 1`，隔离 uid `test-r553-{mobile,desktop,review}-*`，答案取自拦截回包、UI 真点，SQLite 只读回读。

| 项 | 结果 | 一手观察 |
|---|---|---|
| A 375 普通练习错 2 | PASS | 「只重练本组错题（2 题）」primary + rotate-ccw，「再来一组」ghost；toast「只重练本组错题」→ 1/2，原错题 qid `[243632,235233]` 顺序不变、选项重置；`pendingSession` items=2 / `redo=0` / `ptitle=''` / `lastModule=yanyu` |
| B 恢复 | PASS（口径更正） | 未答 F5 / 后退→前进恢复同两题；已答未点下一题 F5 恢复同一已答题 + 反馈（R548 既有口径，我最初指令写「直接到第 2 题」为口径差异）；点下一题后 F5 恢复 2/2 |
| C 重练全对 → SRS | PASS | 无重练按钮、「再来一组」primary；两次 `answer_log` 各回 1 项 `reviewed`（mid 3635/3636），`review_log` 两行 `via=answer/correct=1/probe=1`、`review_streak=1`、明天复习，`mistakes` 无重复 |
| **C 跨 F5 fixReport 计数** | **FAIL（既有 P3）** | 两题实际都推进，但中途 F5 后完成页「本组答对 1 道曾错题」（应 2）：`_reviewed` 只在内存、`pendingSession` 不存、`adoptLocalPending` 还原不出 → **#711 修** |
| D 1440 同题再错 / 再对 / 全对 | PASS | 同 mid 3637 再错 `times 1→2` 不建新行、CTA 仍 1 题；再对 fixReport 1；另组 10 题全对无重练 CTA |
| E 按卷不计时回归 | PASS（CTA 像素 UNTESTED） | 广东 60 题 59/60 → DOM「重练本卷错题（1 题）」primary /「回卷库」ghost → 点击 toast「只重练本卷错题」→ 1/1、`ptitle` 保留卷名；完成截图未滚到按钮，缺完整按钮截图 |
| F #706 回归 | PASS | 真实 2 题复习 → 清零小结 → 「强化 5 道新题」→ 1/5，`startReinforce` 路径 warning 0 |
| **G 严格零 warning** | **FAIL** | 1 条 `showLoading 与 hideLoading 必须配对使用`，堆栈 **`startPaper`**（`pages-practice-practice.9peo4qDb.js`），与 #706 同形态 → **#711 修** |
| G HTTP / 付费 / 错误 | PASS | 1561 响应全 200（6 次 API 取消为测试器切 uid 立即 reload 所致、2 图片取消）；ask/mistake_analysis/OCR/explain 0；console error / runtime exception / rejection 0 |
| G 清理 | PASS | 41 表精确删 126 行（含误入计时模考 1 行 `exam_attempts`）、`test-r553-%` 0 残留、五类全局哈希不变 |

限制：录像最大化的是背景 Chrome，测试 context 窗口偏窄，1440 内容在录像中裁切（Playwright 截图完整）；小程序/真机不在范围。

## 5. 热修 #711（`devin/1788911838-r553-fix-loading-reviewed`，从 main `d07e01d5` 开）

§4 两条既有 P3 当轮实修，仅 H5 `practice.vue` + `review-advance.js`：

- **① 5 处启动器 loading 配对**：源码扫 `uni.showLoading` 共 6 处，#706 只修了 `startReinforce`；`startPaper / startExam / startDaily / startShizheng / reviewShizheng` 同形态（`try` 内 toast/actionSheet/modal 顶掉 loading 后 `finally hideLoading`）统一改「回包后立即 `hideLoading`，再出交互；catch 先 hide 再 toast；finally 只复位 `_starting`」。
- **② `startDaily` 死回退**：catch 内 `this.start(this.dailyModule)` 早于 `finally` 复位 `_starting`，被 `start()` 首行互斥挡掉 → 「接口异常回退随机抽题」从未生效；改 catch 置 `fallback=true`，finally 复位后 `if (fallback) this.start(...)`。
- **③ `pendingSession` 持久 `reviewed`**：快照加 `reviewed: this._reviewed || []`；`adoptLocalPending` → `reviewedFromPending(s)`（新纯函数：非法项丢弃、按 `mistake_id` 去重、`mastered === true`）；`logAttempts` 回包 concat 后若 `session && items.some(!_picked)` 再 `saveSession()` 补写（作答时的快照早于回包）；`start()` 首部 `_reviewed = []`。`syncRedoReviews` 口径不变；服务端跨设备恢复 `adoptRemoteSnap` 不含 reviewed（原行为）。
- 测试 `tests/r553-fix-loading-reviewed.test.js` +11（5 启动器源锁 + startReinforce 回归锁 + 纯函数 + 持久链路源锁）。本地门：vitest 全量 1182（发版树 1190）/ eslint 0 error / build:h5 / diff --check 空。`merge-tree` 与 #708 无冲突。

### 5.1 生产黑盒复验（`db847006` / `index-MGGo0gNb.js`）

报告 `~/kaogong-reports/r553-fix-prod-verify.md`，录像 `~/screencasts/r553fix-db847006-production/`，截图/审计 `~/r553fix-verify/`；uid `test-r553fix-*`，288 API 请求全带 probe。

| 项 | 结果 | 一手观察 |
|---|---|---|
| A ③ 375 跨 F5 | **PASS** | 错 2 → 重练；首题答对后 `pendingSession.reviewed` 含 `mistake_id=3649` 1 项 → F5 恢复仍 1 → 答对第 2 题 → 完成页「**本组答对 2 道曾错题**，复习计划已推进」（修前 1）；默认自动下一题已使 idx=1 再 F5（停留首题反馈再手动 Next 的变体未另测） |
| A 1440 不刷新对照 | PASS | 连续答对 2 → fixReport 2（口径不变） |
| A DB | PASS | 两宽各 2 行 `review_log` `via=answer/correct=1/probe=1`，qid 唯一、`times=1`、`review_streak=1`，无重复 mistakes |
| B ① 按卷不计时 | **PASS** | 首题 toast 出现时 loading 已隐藏、无遮罩；`startPaper` warning 0 |
| B ① 每日一练 / 时政 / 时政回顾 | PASS | 真实 UI 触发 `startDaily / startShizheng / reviewShizheng`，warning 各 0 |
| B `startExam` | **UNTESTED** | 生产原生 UI 无入口；核源码 `startExam` 在 `frontend-uni/src` **无任何调用方（死码）**，改动仅为形态统一 |
| B #706 回归 | PASS | 清零小结 → 强化 5 道 → 1/5，`startReinforce` warning 0 |
| C ② 死回退 | **PASS** | CDP 合成 `/api/daily_set` 500 → 回退普通数量关系 10 题，loading 消失、无「每日一练」toast、warning 0（首次命中 `dailySet` 缓存未走网络，清缓存后重验） |
| D 回归 | PASS | #708 重练 primary + 再来一组 ghost，点击进入同序 2 题 |
| E 审计 | PASS | 1324 响应 = 1322×200 + 2×预期合成 500；付费 0；console error / warning / rejection 0；API 取消 0、图片取消 2；5 条 runtime 异常全为测试器 MutationObserver 过早观察 `documentElement`（应用归属 0） |
| E 清理 / 三证 | PASS | 41 表精确删 70 行、`test-r553fix-%` 0 残留、五类哈希一致；起终 health / HTML / runtime = `db847006` / `index-MGGo0gNb.js` |

## 6. 遗留

- `startExam` 死码（无调用方）：下轮顺手删或确认保留。
- 非法/重复 `reviewed` 快照、`mastered` 变体仅单测；服务端跨设备恢复不带 reviewed。
- E 完成页 CTA 完整像素截图（8e5322af 轮）未补；小程序真机（R536-1 累计）。
