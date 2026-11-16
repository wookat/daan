# R530（实现轮）：扫描答题卡结果 sheet「✗」行「看错题 ›」直达该题错题卡（`saved` + 普通涂卡 + 错 + 有题库 id 才可点；关 sheet → 重拉 → 定位展开，不新造路由）+ 多页卷全部页扫完后「本卷答题卡 P 页已全部判分 · 合计…」（前端按卷码/页号累计，页内契约不动）+ track 白名单 `book_scan_jump`；录入层多页卷分页核成立不改

日期：2026-09-08（UTC 07:2x–）。上游：R529（#666，已合入 main `1df42d7d`）。统筹者指令：实现轮口径，命中即论证→实修→发版→复采。

## 0. 结论表（四维下一候选三项一手核）

| 项 | 设计论证（样本 / 现状 / 目标 / 契约 / 失败闭合 / 否决） | 结论 |
|---|---|---|
| A. 结果 sheet「✗」行直达该题错题详情/讲解 | **样本**：本地 `:8525` 真 `POST /api/export/pdf` 60 题普通卷 `5A43BB84`（答题卡 2 页），按 `omr.bubble_rect()` 合成涂卡 p1 `{0:B,1:A(错),2:B,3:AB(多涂)}`、p2 `{0:C,1:A(错),2:C,3:AB}` → 真 `POST /api/scan_sheet` 200 `saved:true`（`answer_log` +3 / `mistakes` +1 每页）。**现状（改前一手）**：结果 sheet 每行只是静态 `题号 / 涂选 / 答案 / ✓✗—` 文本，用户看到 `2 A 答案 C ✗` 后要自己关 sheet、在错题本列表里翻找这道题（列表默认按时间、有筛选/分页，60 题卷第 52 题在第 2 页）；粉笔/夸克扫描结果页错题行可点进详情——但对标只是候选来源，命中依据是本站自身「已写库却无入口」的一手。**目标**：`✗` 行加「看错题 ›」，点后定位到该题**既有**错题卡并展开（既有卡已带历次作答 `/api/attempts`、「AI 详解」预填、纠错/笔记/讨论），不新造详情路由。**契约**：`scan_sheet` 只对 `status=='ok'` 的 `answered` 行写 `answer_log`/`mistakes`（`blank`/`multi` 不计分不写库），且 `saved = bool(uid and log_items)`；错题卡 DOM `id="mc-<mistakes.id>"`、按 `question_id` 可唯一对回当前 uid 的错题（多条取未掌握优先）。→ 可点谓词 `scanRowJumpable(res, r) = res.saved && r.status==='ok' && !r.correct && r.question_id`：四条缺一不给入口（`multi`/`blank` 行没写库、`saved:false`（匿名 uid 缺失）没写库、`question_id` 缺失无法对回）。**定位方式**：不把 `question_id` 当 mistake id、不猜 `mistakes.id`——`scanRowJump(r)` 只记 `_pendingScanQid` + 埋点，走 R529 `closeScan()`（关 sheet → `load()` 重拉当前 uid 列表），回包后 `applyPendingScanJump()` 在 `this.items` 里 `findScanMistake(items, qid)` → 切 todo/done tab、清关键词、当前筛选看不到则清筛选、`pageNFor` 扩分页覆盖到该卡、`kbId=m.id` + `toggleCard(m)` 展开 + 滚到 `#mc-<id>`。**失败闭合**：列表里找不到（重拉失败 / 别账号 / 已删）→ toast「错题本里未找到这道题」；`resetAccountState()`（账号切换）与 `load()` 失败路径清 `_pendingScanQid`（R499 `seq`→`isStaleUidErr` 守卫相邻顺序不动）。**否决**：新建 `/pages/book/detail?qid=` 路由（既有卡片已是详情态，新路由要复制 attempts/AI/纠错/笔记全部入口）；回包里加 `mistake_id`（`scan_sheet` 写库在 `save_mistake` 之后要再查一次，且 `question_id` 已足够对回当前 uid）；给 `blank`/`multi` 行也加入口（没写库、点了无处可去）。 | **实现**：`src/paper-scan-jump.js` + `book.vue` 行/`scanRowJump`/`applyPendingScanJump` + `.mcard scroll-margin-top` + 后端 track 白名单 |
| B. 多页卷全部页扫完后的汇总 | **现状（改前一手）**：p2 扫完结果 sheet 仍是 R529「本卷答题卡共 2 页，本页只判第 51–60 题；其余页请分别扫描」——用户已经把两页都扫了，却仍被提示「其余页请分别扫描」，也看不到整卷合计。**目标**：同一进页内两页都判过 → 说明行改「本卷答题卡 2 页已全部判分 · 合计已作答 6/60 · 答对 4 题」；缺任一页保持 R529 文案。**契约不动**：后端 `scan_sheet` 仍逐页判、`total/answered/correct/items` 页内口径、R525 内联题不占槽、R528 `inline_n` 照旧；聚合只在前端 `scanAcc[code][page] = {answered, correct, total}`（`recordScanPage`），`scanAllPagesSummary` 要求 `1..pages` 每页都在才返回合计（缺页 `null`）；单页卷（`pages<=1`）/手动录入回包（无 `page`）不记、不出合计行；同页重扫覆盖前值。**失败闭合**：`code`/`page`/`pages` 缺失 → 不记；账号切换 `resetAccountState()` 清 `scanAcc`；刷新页面即清（不落存储——合计只对「这次坐下来扫」有意义，跨天累计会把旧成绩混进来）。**否决**：后端跨请求聚合（要新表/新状态记「哪页扫过」、还要定过期规则，无用户诉求一手）；把整卷 `n` 塞进 `total`（R529 已否决）。 | **实现**：`paper-scan-pages.js recordScanPage/scanAllPagesSummary/scanPagesNote(r, acc)` + `book.vue scanAcc` |
| C. 录入层对多页卷是否需分页 | **一手**：手动录入层 `manualPaper.n` 行可滚列表 + 一次 `POST /api/paper_answers {code, picks}` 整卷提交（后端按 `picks` 键对 `question_ids` 逐题判、与 OMR「页」无关）；60 题卷录入层就是 60 行 + 「交卷判分（k 题）」。分页会引入「跨页保留 picks / 分页提交还是整卷提交 / 第 2 页未填就交」三个新状态与契约选择，且**不存在**「页」概念（那是答题卡纸面的分页）；对标粉笔/夸克本身不构成缺陷证据（R520 口径）。 | **不改**，不登记（无缺陷一手） |

## 1. 改动（代码 1 commit `bbf978fb`，PR #667）

- `frontend-uni/src/paper-scan-jump.js`（新）：`scanRowJumpable(res, r)`、`findScanMistake(items, qid)`（`Number(qid)` 对 `Number(m.question_id)`，多条优先 `!mastered`）、`pageNFor(idx, pageN, step=20)`（目标在 `pageN` 外则扩到 `ceil((idx+1)/20)*20`）。
- `frontend-uni/src/paper-scan-pages.js`：`recordScanPage(acc, r)` / `scanAllPagesSummary(acc, r)`；`scanPagesNote(r, acc)` 全齐时改文案（R529 单页/缺页文案原样保留）。
- `frontend-uni/src/pages/book/book.vue`：结果 sheet 行 `:class="{ jump: scanRowJumpable(scanResult, r) }"` / `:role="… ? 'button' : null"` / `@click="scanRowJump(r)"` + 末列 `<text class="scan-jump">看错题 ›</text>`；`data.scanAcc`；`scanUpload` 成功后 `scanAcc = recordScanPage(scanAcc, d)`；`scanRowJump(r)` / `applyPendingScanJump()`；`load()` 成功回包末尾 `await applyPendingScanJump()`、失败路径与 `resetAccountState()` 清 `_pendingScanQid`/`scanAcc`；`.mcard { scroll-margin-top: calc(var(--window-top, 0px) + var(--sp-8)) }`（H5 固定导航 44px，`scrollIntoView(block:'start')` 否则把卡头顶进导航下——改前一手 375 `top: 0`，改后 `top: 52`）；`.scan-row.jump` / `.scan-jump` 样式（行 `min-height` 保 ≥44）。
- `backend/app/team.py`：`/api/track` 白名单 + `book_scan_jump`（`source`=卷码、`ref`=question_id）。
- `backend/tests/test_track.py`：+1 例白名单 200 落库。
- `frontend-uni/tests/book-r530-scan-jump-all-pages.test.js`（新，8 例）：谓词四条件（blank/multi/✓/无 id/`saved:false` 均 false）；`findScanMistake` 未掌握优先 / 无命中 null；`pageNFor`；`recordScanPage` 按卷码/页号、同页覆盖、单页/手动回包不记；`scanAllPagesSummary` 缺页 null、全齐合计；`scanPagesNote` 两种文案；`book.vue` 源锁（import / 行三属性 / `scanRowJump` 走 `closeScan` / `applyPendingScanJump` 在 `load` 成功尾 / `resetAccountState` 清两态 / `.mcard scroll-margin-top`）。
- `frontend-uni/tests/book-r528-paper-inline-note.test.js` / `book-r529-scan-pages-close.test.js`：只按 R530 有意改动的两处更新源锁（`scanPagesNote(scanResult, scanAcc)`；行结构含 `scan-jump`），未放宽。

## 2. 本地一手（`:8525`，DB `~/r525/app.db`，uid `r522local`，`~/r530/local_r530.py`，`local_{375,1440}.out` + 截图 `local_{W}_p1.png / local_{W}_p2_all.png / local_{W}_jumped.png`）

- 真 `POST /api/export/pdf` 60 题 → `5A43BB84`，PDF 11 页，答题卡页 `[1, 2]`；p1/p2 合成涂卡（`sheet{1,2}_filled.png`）→ 真 `POST /api/scan_sheet` 各 200 `saved:true`；p1 错题 qid 12（第 2 题）、p2 错题 qid 17（第 52 题）。
- p1 结果 sheet（两视口同）：「卷码 5A43BB84 · 第 1/2 页 · 已作答 3/50 · 答对 2 题 · 已记入做题记录」+ R529 文案「本卷答题卡共 2 页，本页只判第 1–50 题；其余页请分别扫描」（375 343×42 / 1440 433×21）；`ROWS 50`；**仅** `2 A 答案 C ✗ 看错题 ›` 一行 `role=button`、高 45px；`1 ✓ / 3 ✓ / 4 多涂 AB — / 5 未涂 —` 均无入口。
- p2 结果 sheet：「第 2/2 页 · 已作答 3/10 · 答对 2 题」+ **「本卷答题卡 2 页已全部判分 · 合计已作答 6/60 · 答对 4 题」**（375 343×21 / 1440 448×21）；`ROWS 10`；仅 `52 A 答案 B ✗ 看错题 ›` 可点。
- 点 `52` 行「看错题 ›」：sheet 视觉关闭（`wd-popup` 关后内容仍留 DOM，脚本的 innerText 探针为 True 不代表可见，以截图为准）；`GET /api/mistakes` **+1**；`.mcard.kbf` = `#mc-9`（`mistakes.id 9 ↔ qid 17`）已展开（选项 + 历次作答 4/5 次 + AI 详解/纠错/笔记/讨论条），卡顶 `top: 52`（导航 44 + 8）两视口同；tab 停在待复习；`POST /api/track {"event":"book_scan_jump","source":"5A43BB84","ref":"17"}` **200**；`NON2XX []`、`ERRS []`。
- 门：pytest 580（R529 579 + 1）/ ruff；vitest 139 文件 / 940 例（R529 138/932，+1 文件 +8 例）、eslint 0 error / 19 warn（既有）、`lint:tokens`、`build:h5`（`index-Diqff7wW.js`）；`git diff --check` 空。

## 3. 发版（两次）

- **R530 `bbf978fb`**：08:05Z 起宿主 `/` 100% + 兄弟构建在跑 → 暂缓；回落后预检 `r530_pre2.out`：load 2.85 / disk 4.3G（92%）/ 兄弟 0 / MemAvailable 331 MB / 容器 healthy 0 重启 → `./deploy/deploy_h5.sh --skip-build`（`r530_deploy.log`）：2b 谱系 OK（线上 `74d56fef` 是本机祖先）、compose `rc=0`、新容器 `07:59:24Z`、线上 rev `bbf978fb` = 本机、bundle `index-Diqff7wW.js` = 本机；6b `/` perf 0.91 / a11y 1.00 / LCP 2867 / CLS 0.08、`/tiku/` 全 1.00 / LCP 942；`DEPLOY_RC=0`。WARN 本机无 brotli（回退 Caddy gzip，历轮同）。
- **R530b `f0527f0e`**（见 §4 命中）：预检 `r530b_pre.out` load 0.37 / disk 5.3G（89%）/ 兄弟 0 / MemAvailable 236 MB / healthy 0 重启 → `--skip-build`（`r530b_deploy.log`）：compose `rc=0`、新容器 `08:09:48Z`、rev `f0527f0e` = 本机、bundle 首轮读旧 `index-Diqff7wW.js`（传播窗）→ 重试 `index-CyDxXuU_.js` = 本机；6b `/` 0.99 / 1.00 / LCP 1027 / CLS 0.06、`/tiku/` 1.00 / LCP 953；`DEPLOY_RC=0`。

## 4. 生产只读复采（`prod_r530.py`，uid `umst3`，`X-Kg-Probe: 1`，非 GET 全 abort；`paper_answers`/`scan_sheet` 被 abort 后 fulfill 为本地真 `scan_sheet` 回包**形态**——生产不上传答题卡、不写库）

**服务端一手（真 GET）**：`GET /api/paper/71F09991` → `{n:93, pages:2, inline_n:0}`（历史卷，R529 `pages` 单源）；`GET /api/health` `bbf978fb` → 发版后 `f0527f0e`；bundle `index-Diqff7wW.js` → `index-CyDxXuU_.js`。

**显示层 + 定位（`umst3` 真错题列表）**，375 / 1440 同：
- A0 `saved:false` 同体：12 行 **0 可跳**、无「看错题 ›」。
- A1 `saved:true`（no1 ✗ `qid 162861` / no2 ✓ / no3 多涂 / 4–12 未涂）：**仅 no1** `jump + role=button + 「看错题 ›」`（行高 45 ≥ 44）；点 → sheet 关、真 `GET /api/mistakes` **+1**、`.mcard.kbf = #mc-2934`（生产 `mistakes.id 2934 ↔ question_id 162861`，综合分析 · 今日待复习）已展开（选项 `opts:true`），卡顶 `top 52` 两视口同；`POST /api/track {"event":"book_scan_jump","source":"9D29E4AB","ref":"162861"}` 发出（被 abort）。
- B 扫描路径（H5 `chooseImage` 走 `<input type=file>`，Playwright filechooser 喂 `sheet1_filled.png`，`POST scan_sheet` 被 abort→fulfill）：p1（`pages 2 / page 1 / total 50`）→「第 1/2 页 · 已作答 2/50」+ R529 文案「本卷答题卡共 2 页，本页只判第 1–50 题；其余页请分别扫描」（375 343×42 / 1440 433×21）ROWS 50、no1 可跳；p2（`page 2 / total 43`，items 51–93）→「第 2/2 页 · 已作答 2/43」+ **「本卷答题卡 2 页已全部判分 · 合计已作答 4/93 · 答对 2 题」**（375 343×21 / 1440 433×21）ROWS 43、no51 可跳；「完成」→ `GET /api/mistakes` +1。
- abort 清单仅 `track boot` / `paper_answers`×2 / `track book_scan_jump` / `scan_sheet`×2；GET 非 2xx `[]`；`ERRS []`。

**R530b 命中（`bbf978fb` 首轮 375，`prod_375_prefix_bbf978fb.out`）**：A0/A1 的**非可跳行也 `role=button`**（未涂/多涂/✓/`saved:false` 全部 12 行；多页卷即 49 行）。根因：`a11y-focus.js` 在 Vue runtime 挂 click 监听时给宿主补 `tabindex` + rAF 后对 ≤40 字叶子元素补 `role=button`，而 R530 把 `@click="scanRowJump(r)"` 绑在**全部** `.scan-row` 上（方法内再判 `scanRowJumpable`）→ 无动作行成为键盘落点/读屏「按钮」。本地 R530 走查只断言了 `link`/`jump`，**没读 `role`**，故漏到生产才见（走查经验入 SKILL）。修：`v-on="scanRowJumpable(scanResult, r) ? { click: () => scanRowJump(r) } : {}"` 只给可跳行挂监听（`:role` 显式保留），源锁改为断言新串 + `not.toContain` 旧 `@click=`。本地 `:8525` 新 bundle `localb_375.out`：非可跳行 `role: None`、可跳行 `role: button` + 定位 `#mc-9` `top 52` 不变；门：vitest 139/940、eslint 0 error、tokens、build:h5（`index-CyDxXuU_.js`）、`diff --check` 空；后端 0 改动，pytest 首次 `-x` 跑到 560 过后 **1 例失败（-x 截断、失败名未捞到）**，随后不带 cache 连跑 9 次全 580 过（`~/r530/pytest_flake_hunt.out`）→ 按偶发记账、不据此改码，R531 再跑 `-x` 时若复现按名归因；ruff 过。生产复采（`prod_375.out` / `prod_1440.out`，`f0527f0e`）：A0 12 行 `role: None`；A1 仅 no1 `role: button`，其余 `None`；定位/合计/刷新全部同上。

## 5. (c) / 到期项 / 簇

发版后 `r530b_pre.out`（08:07Z，`bbf978fb` 容器窗 62 请求）/ `r530b_post.out`（08:12Z，`f0527f0e` 容器窗 80 请求）：5xx 0 / assets 404 0 / monitor 0 / mpUA 0 / 非探针 POST 0 / Traceback 0；重建窗源站 5xx 0；WAL `4,173,592` 同字节；`umst3` 32/45/22/1 新增 0（本轮生产复采 0 写入）；任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0、`paper_exports` 05:22Z 后 0（仍 4 列）；`scan_sheet/paper_answers/paper/{code}` 全历史 29 条仍全探针（含本轮 `paper/71F09991`×3）；09-08 503 仍 75（R525-2）；容器窗非探针 non-bot 仅 2 条 `GET /api/health 403 curl`（= 本会话直打源站无头的 curl，R388 口径正常拒绝）。**簇**：09-08 终值仍 **6575 / 6499，last 07:06:37Z**，至 08:12Z **66 min 无新行**（09-07 为 01:11Z–23:59Z 全天、09-08 00:00Z 起接续 → 「本日已停」只在观测窗内成立，隔日是否再起 R531 复查）；日报 `crawler-stats.json` 07:23Z humans.page 09-08 6575 = 簇量。无新的外部真人证据。

改前 `r530_pre2.out`（07:52Z）：容器 `07:12:10Z` healthy 0 重启；容器窗 5xx 0 / 非探针 POST 0 / Traceback 0；WAL `4,173,592` 同字节；probe=0 `answer_log 53/2`；`umst3` 32/45/22/1 同 R529；任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0、`paper_exports` 05:22Z 后 0；`scan_sheet/paper_answers/paper/{code}` 今日 55 条全探针（本轮 A 段 + 历轮）；09-08 503 仍 75（R525-2）。**簇**：09-08 终值 **6575 行 / 6499 IP，last 07:06:37Z**，至 07:52Z **46 min 无新行** → 本日簇已停（是否隔日再起下轮复查）；09-07 1445 行 / 1443 IP。**宿主级再命中**（同 R529 形态）：`/` 50G **100%（0 可用）**、`/opt/SoftCopyrightAgent` 兄弟 `compose up -d --build`（root）在跑、load 8.95、`apport` 崩溃收集在触发；kaogong 容器 healthy、近 45 min 日志 0 磁盘错误、`GET /api/health` `74d56fef` 200 → 预检不满足暂缓发版（已即时上报，未动任何非 kaogong 资源）。

## 6. 登记 / 未做

- 小程序 `pages/book` 结果 sheet 未接「看错题」/整卷合计（回包字段无变化，纯显示层）→ 并入 **R528-1（P3）**。
- 生产 `scan_sheet` 真上传不做（会写 `answer_log/mistakes`）；生产只读复采只能证 bundle 显示层（route 注入本地真回包形态）+ `umst3` 既有错题按 `question_id` 定位展开。
- 涂卡图为按 `bubble_rect()` 合成、非实拍。
- **R530-1（P3，教训入 SKILL）**：R530 本地走查未读非可跳行 `role`/`tabindex`，a11y 回归漏到生产首轮复采才见（当轮 R530b 已修，生产 `f0527f0e`）；后续凡给列表行加 `@click`，走查必读非动作行的 `role`/`tabindex`。
- 整卷合计只在本次进页内（不落存储）；跨天分次扫同一卷不出合计 —— 有意为之（见 §0-B），若有用户诉求再议持久化。
