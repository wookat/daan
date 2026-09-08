# R529（实现轮）：扫描答题卡多页卷（`PER_PAGE=50`）结果 sheet 标「第 N/P 页」+「本页只判第 a–b 题；其余页请分别扫描」；结果 sheet 右上 ✕ / 遮罩关闭与「完成」同走 `closeScan()`（已记入做题记录后错题本即时刷新）；导出确认层 / 录入层 M 题口径同源锁

日期：2026-09-08（UTC 06:5x–）。上游：R528（#665，已合入 main `78335068`）。统筹者指令：实现轮口径，命中即论证→实修→发版→复采。

## 0. 结论表（四维下一候选三项一手核）

| 项 | 设计论证（样本 / 现状 / 目标 / 契约 / 失败闭合 / 否决） | 结论 |
|---|---|---|
| A. 多页答题卡逐页提示 | **样本**：本地 `:8525` 真 `POST /api/export/pdf` 60 题普通卷 `5A43BB84`（`n=60, inline_n=0`），PDF 11 页，答题卡在第 1、2 页（`omr.ROWS 25 × COLS 2 = PER_PAGE 50`），卡面页眉本来就印「第 1/2 页」。**现状（改前一手 `local_375_pre.out`）**：按 `omr.bubble_rect()` 合成涂卡第 1 页 → `omr.recognize` `{code, page 1, picks {0:B,1:A,2:B}}` → 真 `POST /api/scan_sheet` 200 `{page 1, total 50, answered 3, correct 2, saved}` items 50 行题号 1–50；结果 sheet 总结行「卷码 5A43BB84 · 第 1 页 · 已作答 3/50 · 答对 2 题 · 已记入做题记录」。`GET /api/paper/{code}` 只回 `n:60`。用户在 H5 端**看不到**整卷答题卡共几页、本页覆盖哪段题号、第 2 页要另扫——「3/50」会被当整卷（同 R528 `3/3` 形态，但这次是页范围而非内联题范围）。**目标**：回包透出整卷答题卡页数 `pages`，结果 sheet 标题「第 1/2 页」，总结行下一句「本卷答题卡共 2 页，本页只判第 1–50 题；其余页请分别扫描」；单页卷（`pages=1`）保持「第 1 页」、不出说明。**契约不动**：`scan_sheet` 仍只判上传那一页（`page_ids = qids[(page-1)*PER_PAGE : page*PER_PAGE]`），`total/answered/correct/items` 仍是本页普通题；OMR 槽 `i ↔ question_ids[i]`、R525 内联题不占槽、R528 `inline_n` 全部照旧。**页数公式单源**：新 `omr.sheet_pages(n_slots) = max(1, ceil(n/PER_PAGE))`，`pdf_export._omr_sheet_pdf` 出卡页数改用同函数（原地 `math.ceil(n / omr.PER_PAGE)`），`paper/{code}` 与 `scan_sheet` 回包也用它 → 卡面「第 1/2 页」与 H5「第 1/2 页」不可能漂。**失败闭合**：`pages` 缺失/0/非法 → `scanPageLabel()` 退回「第 N 页」、`scanPagesNote()` 返回 `''`；`page<=0` 不标页；范围 `a` 取 `items[0].no`（缺则 1）、`b=a+total-1`。**否决**：让 `scan_sheet` 一次接受多张图（改上传协议 + OMR 多图合并，无用户诉求一手）；前端按 `n/50` 自算页数（把 `PER_PAGE` 复制到前端，会漂）；把整卷 `n` 塞进 `total`（`已作答 3/60` 与 50 行 items 对不上） | **实现**：后端 `omr.sheet_pages()` + `pdf_export` 改用 + 两回包 `pages`；前端 `paper-scan-pages.js scanPageLabel()/scanPagesNote()` + `book.vue` 结果 sheet |
| B. 「已记入做题记录」后错题本即时刷新 | **现状（改前一手）**：结果 sheet 底部「完成」按钮 `@click="scanOpen = false; load()"` 会刷新；但 `kg-sheet` 右上 ✕ / 点遮罩走 `@update:model-value="scanOpen = $event"` **不刷新** —— 改前 375：`CLOSE_X mistakes GET delta 0` / `CLOSE_DONE delta 1`。扫描 `saved:true` 已写 `answer_log/mistakes`，用户按 ✕ 关掉后错题本列表仍是旧的（新错题不出现），要等下次 onShow/下拉。**目标**：两条关闭路径同一出口。**修**：`closeScan() { if (!scanOpen) return; scanOpen=false; load(); }`，✕/遮罩 `@update:model-value="(v) => { if (!v) closeScan(); }"`，「完成」`@click="closeScan"`。**否决**：只在 `saved` 时刷新（`load()` 是只读 GET、代价一次列表请求，按状态分支反而多一个未覆盖路径） | **实现**：`book.vue closeScan()`（源锁：两路径同函数 + 旧 `scanOpen = false; load()` 内联不再出现） |
| C. 导出确认层 vs 录入层 M 题口径同串源锁 | **一手**：确认层 `export-confirm.vue sheetlessNote()`「其中 M 题（时政/手录）不上机读答题卡，请对照参考答案核对」/「所选均为时政/手录题，无机读答题卡…」（R525）；录入层/结果 sheet `inlineSkipNote(m)`「另 M 题为时政/手录题，不参与机读判分，请对照卷末参考答案核对」（R528）。**M 的来源**：前端 `exportSheetless = exportList.slice(0,100).filter(!question_id && question_text.trim()).length` 与拼 `items[]` 的谓词逐字同串（R525 源锁）；后端 `inline_n = sum(1 for q in questions if not q.get("id"))`（R528 测试 `inline_n=1/2` 已锁）→ **同一计数**。**措辞不同是有意的**：导出前说的是「不上答题卡」（卡还没打），扫描后说的是「不参与判分」（已判）；两处共享锚点「时政/手录」+「请对照参考答案核对」。**否决**：把两处合成一个函数加 mode 参数（两句语义不同、合并只是为了合并） | **不改文案**，加 1 例源锁：`exportSheetless` 谓词与 `items` 谓词在 `book.vue` 恰出现 2 次且逐字同串；三句文案都含 `时政/手录` 且以 `参考答案核对` 收尾；确认层两句逐字锁 |

## 1. 改动（1 commit `74d56fef`）

- `backend/app/omr.py`：`sheet_pages(n_slots) -> int`：`max(1, -(-int(n_slots or 0) // PER_PAGE))`（0/None → 1）。
- `backend/app/pdf_export.py`：`_omr_sheet_pdf` `pages = omr.sheet_pages(n)`（删 `import math`）。
- `backend/app/exam_api.py`：`GET /api/paper/{code}` 回包加 `"pages": omr.sheet_pages(len(question_ids))`；`POST /api/scan_sheet` 回包加 `"pages": omr.sheet_pages(len(qids))`（`page/total/items` 不变）。
- `frontend-uni/src/paper-scan-pages.js`（新）：`scanPageLabel(r)`（`pages>1` → `第 N/P 页`，否则 `第 N 页`，`page<=0` → `''`）；`scanPagesNote(r)`（`page<=0 || pages<=1 || total<=0` → `''`，否则「本卷答题卡共 P 页，本页只判第 a–b 题；其余页请分别扫描」，`a=items[0].no||1`，`b=a+total-1`）。
- `frontend-uni/src/pages/book/book.vue`：import + `methods.scanPageLabel/scanPagesNote/closeScan`；结果 sheet 标题行 `' · ' + scanPageLabel(scanResult)` 替代原 `' · 第 ' + scanResult.page + ' 页'`；总结行下先 `scanPagesNote` 再 R528 `inlineSkipNote`（各一行 `.scan-note`）；✕/遮罩 `@update:model-value="(v) => { if (!v) closeScan(); }"`、「完成」`@click="closeScan"`。
- `backend/tests/test_r529_scan_sheet_pages.py`（新，2 例）：`sheet_pages` 0/1/50→1、51/60/100→2、101→3；60 题卷 `paper/{code}` `pages:2`，`scan_sheet` page 1 `{pages 2, total 50, no 1..50}`、page 2 `{pages 2, total 10, no 51..60, items[0].question_id == qids[50]}`；3 题卷 `pages:1 / total 3`。
- `frontend-uni/tests/book-r529-scan-pages-close.test.js`（新，5 例）：两个 helper 边界；`book.vue` 源锁（import/methods、标题用 `scanPageLabel`、`scanPagesNote` 行在 `inlineSkipNote` 行之前、旧 `第 ' + scanResult.page` 不再出现）；§0-C 口径源锁；`closeScan` 两路径 + 函数体 + 旧内联不再出现。
- `frontend-uni/tests/book-r528-paper-inline-note.test.js`：结果 sheet 相邻断言更新为「总结行 → `scanPagesNote` 行 → `inlineSkipNote` 行」（R529 有意插入，非放宽）。

## 2. 本地一手（`:8525`，DB `~/r525/app.db`，uid `r522local`，`~/r529/local_r529.py`，改后 `local_{375,1440}_post.out` + 截图 `local_{W}_post_scan_result{,_p2}.png`）

- 真 `POST /api/export/pdf` 60 题 → `5A43BB84`，PDF 11 页，答题卡页 `[1, 2]`，第 1 页页眉「R529六十题卷 · 卷码 5A43BB84 · 第 1/2 页 · …」（出卡页数 = `sheet_pages(60)=2`）。
- `GET /api/paper/5A43BB84` 200 `{n:60, pages:2, inline_n:0}`。
- 第 1 页合成涂卡 `{0:B,1:A(错),2:B}` → `omr.recognize` 同值 → 真 `POST /api/scan_sheet` 200 `{page 1, pages 2, total 50, answered 3, correct 2, saved}` items 50 行 `no 1..50`。
- 第 2 页合成涂卡（槽 0/1/2 = 卷内第 51/52/53 题）`{0:C,1:A(错),2:C}` → `recognize {page 2}` → `scan_sheet` 200 `{page 2, pages 2, total 10, answered 3, correct 2, saved}` items 10 行 `no 51..60`，`answered_rows [(51,C,C,✓),(52,A,B,✗),(53,C,C,✓)]` —— 第 2 页槽位对回 `question_ids[50:60]`，契约成立。
- 结果 sheet（route 把 `paper_answers` 回包替换为上述真 `scan_sheet` 回包）：
  - 第 1 页：「对答案结果 · R529六十题卷 / 卷码 5A43BB84 · **第 1/2 页** · 已作答 3/50 · 答对 2 题 · 已记入做题记录 / **本卷答题卡共 2 页，本页只判第 1–50 题；其余页请分别扫描** / 1 B ✓ 2 A ✗ 3 B ✓ 4 未涂 …」`ROWS 50`；说明行 375 343×42（两行）/ 1440 433×21。
  - 第 2 页：「… **第 2/2 页** · 已作答 3/10 · 答对 2 题 · 已记入做题记录 / **本卷答题卡共 2 页，本页只判第 51–60 题；其余页请分别扫描** / 51 C ✓ 52 A ✗ 53 C ✓ 54 未涂 … 60 未涂 / 完成」`ROWS 10`；说明行 375 343×42 / 1440 448×21。
  - 关闭刷新：改前 `CLOSE_X delta 0 / CLOSE_DONE delta 1`（`local_375_pre.out`）→ 改后 375/1440 `CLOSE_X delta 1 / CLOSE_DONE delta 1`（`GET /api/mistakes` 增量各 1）。
  - 两视口 `ERRS []`。
- 门：pytest 579（R528 577 + 2）/ ruff；vitest 138 文件 / 932 例（R528 137/927，+1 文件 +5 例）、eslint 0 error / 19 warn（既有）、`lint:tokens`、`build:h5`（`index-pYlODHuD.js`）；`git diff --check` 空。

## 3. 发版（`a52c3d92` → `74d56fef`，`~/r529/r529_deploy.log`）

- 等待：兄弟 `/opt/SoftCopyrightAgent` 构建结束后盘量回落 `/` 44G/50G（**3.5G 可用，93%**）、`other_builds=0`、load 回落、kaogong 近日志 0 disk/OperationalError/Traceback → 满足预检后发（未清理任何非 kaogong Docker 资源）。
- `./deploy/deploy_h5.sh --skip-build`：compose `Built / Recreate / Started`，`KG_COMPOSE_EXIT rc=0`；后端 `/api/health` 版本 `74d56fef`；CF Pages 上传成功；bundle 首轮读旧 `index-tS3hWG0W.js`（传播窗）→ 重试后 `index-pYlODHuD.js` = 本机 `dist/build/h5`；identity / gzip / br / 组合 Accept-Encoding 四路一致；`/api/stats` / questions / `/tiku/` / robots / indexnow / admin 回归全 200。
- 6b Lighthouse 全 OK：`/` perf 0.99 / a11y 1.00 / bp 1.00 / seo 1.00 / LCP 1396 / CLS 0.06；`/tiku/` 1.00 / 1.00 / 1.00 / 1.00 / LCP 960 / CLS 0。`DEPLOY_RC=0`。

## 4. 生产只读复采（`~/r529/prod_r529.py`，uid `umst3`，`X-Kg-Probe: 1`，非 GET 全 abort；`prod_{375,1440}.out` + 截图 `prod_{W}_scan_result_p{1,2}.png`）

| 段 | 证明对象 | 375 | 1440 |
|---|---|---|---|
| A 真 GET `paper/71F09991`（生产历史卷 n=93） | **服务端** `omr.sheet_pages` | 200 `{n:93, pages:2, inline_n:0}` | 同 |
| A 真 GET `paper/9D29E4AB`（n=12） | 服务端单页 | 200 `{n:12, pages:1, inline_n:0}` | 同 |
| B p1（`paper_answers` 被 abort → fulfill 本地真 `scan_sheet` p1 回包形态） | bundle 显示层 | 「卷码 9D29E4AB · **第 1/2 页** · 已作答 3/50 · 答对 2 题 · 已记入做题记录」+ 提示行「本卷答题卡共 2 页，本页只判第 **1–50** 题；其余页请分别扫描」343×42 / 13px；ROWS 50（`1 B ✓` … `50 未涂 —`） | 同文案，433×21；ROWS 50 |
| B p2（p2 回包形态） | 同 | 「**第 2/2 页** · 已作答 3/10 · 答对 2 题」+「本页只判第 **51–60** 题」343×42；ROWS 10（`51 C ✓` … `60 未涂 —`） | 同，448×21；ROWS 10 |
| C 右上 ✕ 关闭 | `closeScan()` → `load()` | `GET /api/mistakes` **+1**、sheet 已关 | +1 |
| C 底部「完成」关闭 | 同一 `closeScan()` | `GET /api/mistakes` **+1**、sheet 已关 | +1 |
| 守卫 | — | ABORTED 仅 `POST track boot` + `POST paper_answers {picks:{1:A}}`×2；GET 非 2xx []；errs [] | 同 |

bundle `index-pYlODHuD.js` = 本机。**如实**：A 段是服务端一手（`pages` 由生产 `omr.sheet_pages(len(question_ids))` 算出）；B/C 段证明的是生产 bundle 的前端路径——`paper_answers` 回包为本地 R529 真 `scan_sheet` 回包形态的客户端替换（生产不上传答题卡、不写 `answer_log/mistakes`）；`umst3` 本身 `paper/9D29E4AB` 是单页卷，故录入层「共 12 题」与结果 sheet「1/2 页」不同源属预期（回包替换所致）。

## 5. (c) / 到期项 / 簇

改前 `r529_pre.out`（06:5xZ）：容器 `06:40:03Z` healthy 0 重启；容器窗 406 请求 5xx 0 / 非探针 POST 0 / Traceback 0；WAL `4,173,592` 同字节；probe=0 `answer_log 53/2`；`umst3` 32/45/22/1 同 R528。**宿主级命中**：`/` 50G 可用 **1.1G → 799M → 263M → 647M（99–100%）**，同时 `/opt/SoftCopyrightAgent` 兄弟 `compose up -d --build`（root，15:01 CST 起）在跑、load 4.2–5.3；kaogong 容器日志近 10 min 0 磁盘错误、`/api/health` 正常。→ 发版预检「兄弟 0 / disk」不满足，**暂缓发版等回落**（已即时上报）。

改后 `r529_post.out`（07:15Z）：新容器 `07:12:10Z` healthy 0 重启；容器窗 63 请求 **5xx 0 / assets 404 0 / monitor 0 / mpUA 0 / 非探针 POST 0 / 401·403 0 / Traceback 0**；**重建窗（07:10–07:12Z）源站 5xx 0**（09-08 503 仍 75 条全在 00:28/00:29/01:03 = R525-2，无新增）；`/` 4.7G 可用；load 1.26 / MemAvailable 368 MB / `other_builds=0`；WAL `4,173,592` 同字节；probe=0 `answer_log 53/2`、`growth 26/4`、`explain_cache qid nonnull 0/82`、`error_reason ≥09-11 0`、`*_ask_click 0`、`push_subs 0`、`reinforce_log 2/2` 全同 R528；`umst3` 32/45/22/1 **新增 0**、`mistake 1953/2784/2914/2915` 不变；任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0、`paper_exports` 05:22Z 后 0（38 行 / 4 空卷，仍 4 列——`inline_n` 首次导出才加列）；`scan_sheet/paper_answers/paper/{code}` 全历史仍全探针（今日新增 6 条 `GET paper/71F09991|9D29E4AB` 全 `probe=1 140.232.64.4` = 本轮 A 段）。**0 PDF / 0 LLM / 0 写入。**

簇：09-08 至 07:06:37Z **6575 行 / 6499 IP**（15.4 行/分、UA 14、每 IP ≤2、200 6503 + 503 72），**07:06Z 后至 07:15Z 无新行（9 min 空窗，是否停下下轮复查）**；日报 humans 5849 基本全簇。无新的外部真人证据。

## 6. 登记 / 未做

- 小程序 `pages/book` 结果 sheet 未接 `pages`（与 R528-1 同性质，回包字段向后兼容）→ 并入 **R528-1（P3）**。
- 生产 `scan_sheet` 真上传不做（会写 `answer_log/mistakes`）；生产只读复采只能证 `paper/{code}` 回包 `pages` + 前端显示层（route 注入本地真回包形态）。
- 涂卡图为按 `bubble_rect()` 合成、非实拍，只证槽位/页范围契约不证识别鲁棒性。
