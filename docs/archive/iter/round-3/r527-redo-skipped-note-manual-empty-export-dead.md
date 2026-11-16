# R527（实现轮）：错题本「重练所选」部分命中时练习页开场 toast 带「另 M 题为手录/无题库原题，无法重练」（R521-1）+ 手动录入层 `n=0` 全内联卷解释文案替代空题号行、交卷按钮不渲染（R526-1）+ 删练习页 v3 后无入口的 `exportPaper()` 残留副本（漂移面归零）；R524-1 时政加练池论证后仍 fail-closed 不立项；生产 `5d999920` → `b0d3c3e6`

日期：2026-09-08（UTC 06:0x–06:2x）。上游：R526（#663，已合入 main `3e3846d3`）。统筹者指令：R526 属审计-only 轮，避免连续纯取证轮，把已确认的差距项转为实现并部署。

## 0. 结论表

| 项 | 设计论证（样本 / 现状 / 目标 / 契约 / 失败闭合 / 验证） | 结论 |
|---|---|---|
| A. R521-1「N 题无法重练」提示 | 样本：错题本勾 `[手录 NULL-qid ×1, 普通 ×2, 时政 ×1]` → `GET /api/mistakes/redo?mids=` 回 3 条（手录题按 R521 设计跳过、不造题、不把时政 id 塞进 `questions` 域）。现状：`book.vue redoSel()` 只在 0 条时 toast「选中的错题未能匹配到题库原题」，部分命中静默进练习页「1/3」，用户不知道为什么少题。目标：部分命中时一句中文说明少了几题、为何少。契约不动（后端 fail-closed 照旧）。失败闭合：`redoSkippedNote(sel, got)` 只在 `0 < got < sel` 返回文案，其余空串；练习页读后即 `removeStorageSync` 不留给下一次。验证：源锁 5 例 + 本地 375/1440 + 生产 375/1440 | **实现**：`book-redo-skipped.js` + `book.vue` 写 `redoNote` + `practice.vue` 并入开场 toast「错题重练开始 · 已加载 N 题，另 M 题为手录/无题库原题，无法重练」（3.5 s）。**为什么不在错题本页 toast**：本地一手命中——`book.vue` 先 toast 再 `navigateTo`，练习页 `onLoad` 立即 `showToast('错题重练开始')` 把它盖掉（uni toast 单例），所以说明必须交给练习页 |
| B. R526-1 `n=0` 手动录入层 | 样本：`paper_exports.question_ids='[]'` 全内联卷（本地 `14FA1B71`；生产 08-03 探针造的 `259CBA70` 等 4 张）。现状：`GET /api/paper/{code}` 回 `n:0` → 「共 0 题 · 已选 0」+ 空列表 + 禁用「交卷判分（0 题）」，无解释。目标：解释「均为时政/手录题，不参与机读判分，无需在此录入」，不出可操作的 0 题交卷按钮，保留「换一份试卷」。契约不动（后端 `sheet_questions()` 照旧只给有 id 的题出槽）。验证：源锁 + 本地/生产 375/1440 对照 `n=12` 卷 | **实现**：`<text v-if="!manualPaper.n" class="manual-empty">…</text>` 替代 `v-for` 题号行；交卷按钮 `v-if="manualPaper.n"`；「换一份试卷」不变 |
| C. `home.vue`/`practice.vue exportPaper()` 复制两份漂移 | 逐字比对：签名 `exportPaper(opts)` vs `exportPaper()`；参数拼装 `...opts` vs 硬编 `include_answers: expOnly||expAns` 三行；首页收尾 `exportConfirm=false` 练习页无。**关键一手**：练习页 v3 5-tab 后模板里没有任何 `exportPaper`/`exportConfirm` 调用点（`grep` 模板段 0 命中），`exporting/expSheet/expAns/expOnly` 四个 data 字段与 `exportPdf` import 都只被这个死方法引用 | **删除练习页副本**（−36 行），导出只剩首页一份，漂移面归零；不抽共享函数（只有一个活调用点，抽象无对象）。源锁：`PRACTICE` 不含 `exportPaper/exportPdf/exp(Sheet|Ans|Only)`，`HOME` 仍含 `async exportPaper(opts) {` |
| D. R524-1 时政组「加练」出口 | 要实现时政加练池必须先定：池范围（`shizheng_questions` 全表？按日期/来源？）、已做排除依据（时政作答 `answer_log.question_id` 为 NULL，无法按 qid 排除）、与 `reinforce_log` 的口径、`_sz` 形态回包与练习页守卫。现有一手（R522/R524）只证明「`questions` 池对时政恒空」和「用户在完成页有两条有效出口」，**没有任何用户诉求/行为数据**支撑造一个新池 | **不立项、保持 fail-closed**（R524 已隐藏死入口）。四个未知项写进本表，待产品/UX 一手后再论证 |
| E. R520 对标清单未落地 P0/P1 | 复核 R520 文档 §表：P0「勾选后重做」/ P1「导出所选」/ P1「最早」排序 / P0 弹层栈 / P1 fetch 中文映射 —— 五项均已在 R520/R520b/R520c 上线 | **无遗留 P0/P1**；R521–R526 新登记项即本轮 A/B/C |

未做（如实）：R526 预告的「错题本『扫描答题卡』结果 sheet 对混合卷的题号/时政题提示口径（本地扫描结果 375/1440）」本轮未采（实现轮优先），转 R528。

## 1. 改动

- `frontend-uni/src/book-redo-skipped.js`（新）：`redoSkippedNote(selected, loaded)` → `0 < loaded < selected` 时返回「已加载 N 题，另 M 题为手录/无题库原题，无法重练」，否则 `''`。
- `frontend-uni/src/pages/book/book.vue`：`redoSel()` 在 `setStorageSync('redoSet')` 之后、`navigateTo` 之前 `setStorageSync('redoNote', redoSkippedNote(ids.length, d.items.length))`；0 条仍 toast「选中的错题未能匹配到题库原题」并 return。手动录入层：`manual-empty` 文案 / `v-else` 题号行 / 交卷按钮 `v-if="manualPaper.n"`；样式 `.manual-empty { display: block; font-size: var(--fs-sub); color: var(--ink-3); line-height: 1.6; padding: var(--sp-8) 0 var(--sp-12) }`。
- `frontend-uni/src/pages/practice/practice.vue`：`onLoad` 读 `redoNote` 后立即 `removeStorageSync`（放在 `if (redoSet && redoSet.length)` 之前，任何路径都不留）；有说明 → `showToast('错题重练开始 · ' + note, 3500ms)`，无 → 原「错题重练开始」。删 `exportPdf` import、`exporting/expSheet/expAns/expOnly`、`async exportPaper()`。
- `frontend-uni/tests/book-r527-redo-skipped-manual-empty.test.js`（新，5 例）：`redoSkippedNote` 边界（0/全命中/部分命中/NaN）；`redoSel` 写 `redoNote` 顺序与不在本页 toast；练习页读后即清 + 两条 toast 文案；手动录入层三处模板；练习页无 `exportPaper` 残留、首页仍有。

后端 0 改动。

## 2. 本地一手（`:8525`，`~/r527/local_r527.py`，uid `r522local`）

种子：`mistakes` 增 1 条手录行 `question_id NULL / module changshi`（`id 7`，题干「R527本地手录：…」，`shizheng_questions` 无匹配）。既有：`2`（时政 NULL-qid，撞号 141）、`3`（qid 110）、`4`（qid 112）。

- 手动录入层：`14FA1B71`（`'[]'`）→ `EMPTY_NOTE 1 / ROWS 0 / SUBMIT_BTN 0 / SWITCH_BTN 1`；`340F4B53`（`'[111,112,110]'`）→ `EMPTY_NOTE 0 / ROWS 3 / SUBMIT_BTN 1 / SWITCH_BTN 1`（375/1440 同值）。
- 批量勾 4 → `GET redo?limit=25&uid=r522local&mids=7,4,3,2` 200 `ITEMS [(112,4,∅),(110,3,∅),(141,2,_sz)]`（手录 7 跳过）→ 练习页 toast「错题重练开始 · 已加载 3 题，另 1 题为手录/无题库原题，无法重练」，`3` 题渲染，`errs []`（375/1440）。
- 改前对照（本地首版把说明 toast 放 `book.vue`）：截图只剩「错题重练开始」，说明被盖 → 改为交给练习页。

门：vitest 136 文件 / 924 例（R526 基线 135 / 919，+1 文件 +5 例即本文件），eslint 0 error / 19 warning（既有），`lint:tokens` 通过，`build:h5` 通过；pytest 573 / ruff 通过（后端未改，回归性跑）；`git diff --check` 空。

## 3. 发版

预检 `~/r527/r527_pre.out`：healthy 0 重启（`05:22:04Z`）、WAL `4,173,592`、Traceback 0、兄弟 build 0、disk 5.4 G、MemAvailable 223 MB（`free -m` 325 MB）、load 0.60；容器窗 785 请求 5xx/assets 404/monitor/非探针 POST/401·403 全 0。

`./deploy/deploy_h5.sh --skip-build`（`~/r527_deploy.log`）：compose `KG_COMPOSE_EXIT rc=0 at 06:12:38Z`（约 1 min）；线上 bundle 首轮读到旧 `index-DPwKQFih.js`（传播窗口）→ 5 s 重试 `index-DXKcHBUS.js` = 本机；5b 变体校验 OK；6a 回归全 200；6b `/` perf 0.99 / a11y 1.00 / LCP 1405 / CLS 0.06，`/tiku/` perf 1.00 / LCP 955 / CLS 0；`DEPLOY_RC=0`。

## 4. 生产只读复采（`~/r527/prod_r527.py`，uid `umst3`，`X-Kg-Probe: 1`，非 GET 全 abort）

`~/r527/prod_{375,1440}.out` + 截图 `prod_{W}_manual_{259CBA70,9D29E4AB}.png / prod_{W}_redo_toast.png / prod_{W}_practice.png`。

- bundle `index-DXKcHBUS.js`（两视口）。
- 手动录入层：`259CBA70`（08-03 探针造的 `'[]'` 卷）→ `GET /api/paper/259CBA70` 200 `n:0` → sheet 文本「错题重练卷 8月3日 · 卷码 259CBA70 · 共 0 题 · 已选 0 / 这张卷的题目均为时政/手录题，不参与机读判分，无需在此录入；请对照卷末参考答案核对 / ‹ 换一份试卷」，`EMPTY_NOTE 1 / ROWS 0 / SUBMIT_BTN 0 / SWITCH_BTN 1`；对照 `9D29E4AB` `n:12` → 12 行 + 「交卷判分（0 题）」（禁用）+ 换一份，`EMPTY_NOTE 0`。
- 重练所选：生产 `umst3` **没有**「无法回题库」的手录行（9 条 NULL-qid 全为时政且 `shizheng_questions` 首行命中），故用「一个不属于本 uid 的 mid」触发同一个「回包少于勾选数」前端路径：`GET redo?mids=2934,2914,999999999` 200 `ITEMS [(118,2914,_sz),(162861,2934,∅)]`（2 of 3）→ 按 `book.vue` 同契约写 `redoSet/redoNote` → 练习页 toast「错题重练开始 · 已加载 2 题，另 1 题为手录/无题库原题，无法重练」、「时政 1/2」渲染、`redoNote` 读后为 `null`，`errs []`（375/1440）。**如实**：生产这条证明的是前端文案/清理路径，「手录题被跳过」的服务端行为只有本地一手（§2）；文案里的「手录/无题库原题」对「别 uid 的 mid」同样成立（后端按 uid 过滤后无此题）。
- abort：仅 `POST /api/track {event:boot}` ×1（每视口）；GET 非 2xx 0；页面错误 0；0 PDF、0 LLM。

## 5. (c) / 到期项 / 簇（`~/r527/r527_post.sh` → `r527_post.out`，SSH 只读）

- 新容器 `06:12:37Z` healthy 0 重启；容器窗 82 请求 5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0；**重建窗源站 5xx 0**；WAL `4,173,592` 同字节；disk 4.2 G（发版后镜像层占用，较预检 5.4 G 少 1.2 G，4-pre prune 下次让行）；MemAvailable 388 MB；load 2.12（发版后瞬时）。
- probe=0 各表同 R526（`answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、nudge 0、`reinforce_log` 2/2、`push_subs` 0）；`umst3` 四表 32/45/22/1 新增 0；`mistake 1953/2784/2914/2915/2934` 不变；任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0 新行；`paper_exports` 38 行、05:22Z 后 0 新行、空卷仍 4 张；`paper/{code}` 全历史 11 条全探针（本轮 4 条为 `umst3` 只读 GET 200）。
- 09-08 503 仍 75 条（00:28/00:29/01:03，R525-2）无新增。
- 簇：09-08 至 06:14Z 5819 行 / 5751 IP（15.5 行/分、UA 14、每 IP ≤2、200:5747 / 503:72）仍在跑；日报 humans 4925（05:23Z 生成）基本全簇；容器窗非探针非 bot 34 里 33 簇 + 1 `40.77.188.132 GET /sw.js`（bingbot 网段形态，UA 无 bot 字样）。无新的外部真人证据。

## 6. 登记 / 未做

- **R524-1**（P2，不立项）：时政加练池四个未知（池范围 / 已做排除依据 / `reinforce_log` 口径 / `_sz` 回包守卫）见 §0-D；保持 fail-closed。
- **R527-1**（P3）：生产 `umst3` 无真手录行，重练部分命中的服务端跳过只有本地一手；如需生产同形态需一条手录 NULL-qid 行（写入），本轮不造。
- **R528 候选**：错题本「扫描答题卡」结果 sheet 对混合卷的题号/时政题提示口径（本地 `scan_sheet` 结果 375/1440，R526 预告未采）；练习页 `redoNote` 3.5 s toast 对 375 长文案两行显示的可读性走查（本轮截图肉眼可读，未量字号/行数）。
