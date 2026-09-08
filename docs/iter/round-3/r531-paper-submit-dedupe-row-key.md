# R531（实现轮）：扫描答题卡 / 手动录入「同卷同页完全相同的作答」只落库一次（`paper_submits` 按 `uid+code+page+作答指纹` `INSERT OR IGNORE` 判重；重扫同一张卡 / 重复交卷不再翻倍 `answer_log`、不递增 `mistakes.times`、不打回 `review_streak/next_review`）+ 回包 `saved/dup/dup_at` + 结果 sheet「已于…判分并记入做题记录；本次答案完全相同，未重复记录」+ dup 时「看错题 ›」仍可跳；R531b 结果行 v-for key 带可跳态（生产一手：同题号行可跳→不可跳复用 DOM 残留 `tabindex=0`）

日期：2026-09-08（UTC 08:1x–09:2x）。上游：R530/R530b（#667 已合入、#668 已合入 main `61f3d1d3`）。统筹者指令：实现轮口径，命中即论证→实修→发版→复采。

## 0. 结论表（四维下一候选三项一手核 + 到期项）

| 项 | 设计论证（样本 / 现状 / 目标 / 契约 / 失败闭合 / 否决） | 结论 |
|---|---|---|
| B. 已全部判分卷再次扫描是否需提示 | **样本**：本地 `:8525` 真 `POST /api/export/pdf` 60 题卷 `5A43BB84`（答题卡 2 页），p1 合成涂卡 `{0:B,1:A(错),2:B,3:AB}` 真 `POST /api/scan_sheet` 两次。**现状（改前一手，`local_dup.out`）**：第二次同图同卡 → 又一次 200 `saved:true`、`answer_log` 3→6、同一错题 `mistakes.times` 1→2、**已复习推进的 `review_streak 1 / next_review 明日` 被打回 `0 / 现在`**；手动录入 `POST /api/paper_answers` 同 picks 重交同形态。即「重扫一张卡」不是提示缺失，而是**把一次作答记成两次并回退复习计划**（R371 SRS 契约被绕过）。**目标**：同一用户对同卷同页**完全相同**的有效作答只持久化一次；第二次仍回同样判分（用户要的是「看结果」）但 `saved:false, dup:true, dup_at`，结果 sheet 说明「这一页已于 今天 HH:MM 判分并记入做题记录；本次答案完全相同，未重复记录，复习进度不受影响」。**契约**：判重键 = `uid[:64] + code + page + sha1(sorted(qid:normalize_answer(picked)))`（只算 `status=='ok'` 的 `log_items`，blank/multi 不进指纹——与写库集合一致）；`paper_submits(uid,code,page,picks_hash,created_at) PRIMARY KEY(uid,code,page,picks_hash)` + `INSERT OR IGNORE`，`rowcount==1` 才 claim 成功 → 并发双发只一方写库（不靠应用层 SELECT-then-INSERT）。**边界**：答案有一题不同 → 新指纹 → 正常写库（重考同卷是合法场景）；不同页独立；匿名（无 uid）本来就不写库，不 claim、不标 dup；整卷模考 `/api/exam/submit` 传 `code=None` 不去重（多次 attempt 是模考语义）；dup 时不 `save_mistake`、不 `save_answer_log`。**失败闭合**：表幂等 `CREATE IF NOT EXISTS`、历史库无表首次 claim 建表；claim 后写库异常不回滚 claim（宁少写不多写——与「不翻倍」目标一致，且下次改答案即可再写）。**否决**：前端按卷码/页号会话内拦截（刷新即失效、跨设备无效、绕不过 API）；按「整卷是否全部判分」提示（R530 已定合计不落存储、无跨请求「哪页扫过」状态；且真实缺陷在写库层不在提示层）；用 `answer_log` 反查判重（`answer_log` 无卷码/页号，且模考路径共用）。 | **实现**：`db.paper_picks_hash/claim_paper_submit` + `exam_api._persist_graded` + `paper-scan-pages.js scanDupNote` |
| A. 「看错题 ›」落点后是否需回结果 sheet | **一手**：R530 落点是「关 sheet → 重拉 → 展开该题错题卡 `#mc-<id>` 滚到导航下」；结果 sheet 内容（`scanResult`）仍在内存，但入口是「扫描答题卡」重新上传。**判断**：用户从结果行进错题卡的目的就是看这道题（历次作答 / AI 详解 / 笔记），回结果 sheet 的诉求只在「一页多道错题逐个看」场景；R531 起 dup 语义成立后，用户重扫同一张卡即可零成本回到同一结果 sheet（不写库、不打回复习），等价于「返回」而无需新造状态/路由。**否决**：结果 sheet 加「返回结果」浮层（引入 sheet↔错题卡双向态、与 R529 `closeScan()→load()` 刷新语义冲突）。 | **不改**（R531 dup 即返回路径；有一手诉求再议） |
| C. 扫描结果直达该卷「按卷筛选」 | **一手**：错题本已有按卷筛选（R368 `paper=` 卷源徽标 + 筛选态「重练本卷错题」R369）；扫描结果行是**逐题**入口（R530），整卷错题本视图 = 关 sheet 后列表本身按卷筛（`kw`/筛选层可选该卷）。加「查看本卷全部错题」等于在结果 sheet 再放一个入口指向既有筛选，属对标候选而非缺陷一手（R520 口径：无缺陷一手不加功能）。 | **不改**，不登记 |
| 到期：簇隔日是否再起 | 见 §5：09-08 终值 6575/6499、last 07:06:37Z；至 09:08Z 仍无新簇行（08h 28 行/4 IP、09h 1 行/1 IP 为零散非簇形态）。**隔日**（09-09 00:00Z）尚未到 → 无法回答，R532 复查。 | 未到期，续查 |
| 到期：pytest 偶发 1 例 | R531 全量 `pytest -q -x` 584 过；R531b 不带 cache 再跑一次全过（`pytest_r531b.out`）。**未复现、无法归因**（R530b 首次失败被 `-x` 截断未捞到测试名）。 | 未复现，记账不改码 |

## 1. 改动（代码 2 commit：R531 `3c38f238` + R531b `47dc7b0a`）

- `backend/app/db.py`：`paper_picks_hash(items)`（`sorted(f"{qid}:{normalize_answer(picked)}")` → sha1）；`claim_paper_submit(uid, code, page, picks_hash) -> float|None`（幂等建表 `paper_submits`；`INSERT OR IGNORE` `rowcount==1` → 返回 `None` 表示首次；否则 `SELECT created_at` 返回既有 `dup_at`）。
- `backend/app/exam_api.py`：`_mistake_rec()` 抽出错题记录构造；`_persist_graded(uid, code, page, log_items, wrong, probe) -> (saved, dup_at)` 统一「claim → save_mistake × wrong → save_answer_log」；`scan_sheet` 传实际 `page`、`paper_answers` 传 `page=1`（手动录入整卷一次交，页恒 1）、`/api/exam/submit` 传 `code=None`（不去重）；三回包加 `dup: bool` / `dup_at: float|None`（`saved` 语义不变 = 本次是否写库）。
- `frontend-uni/src/paper-scan-pages.js`：`scanDupNote(r, now)`：`r.dup && r.dup_at` 才出；有 `page` 用「这一页」、无 `page`（手动录入）用「这份答案」；同日「今天 HH:MM」、跨日「M月D日 HH:MM」。
- `frontend-uni/src/paper-scan-jump.js`：`scanRowJumpable` 谓词 `res.saved` → `(res.saved || res.dup)`（dup 时错题已在库、可定位）；**R531b** 新增 `scanRowKey(res, r) = String(r.no) + (jumpable ? ':jump' : '')`。
- `frontend-uni/src/pages/book/book.vue`：结果 sheet 汇总行下、页数说明行上 `<text v-if="scanDupNote(scanResult)" class="scan-note scan-dup">`（警告色 `--warn` 字 + `--warn-bg` 底，343×58 / 433×58）；汇总行「已记入做题记录」只在 `saved` 时出；**R531b** 结果行 `:key="r.no"` → `:key="scanRowKey(scanResult, r)"`，import / methods 暴露 `scanRowKey`。
- `backend/tests/test_r531_paper_submit_dedupe.py`（新，9 例）：同扫描两次只存一次、第二次 `saved False / dup True / dup_at == 首次 created_at`、`answer_log` 计数不变、`mistakes.times/review_streak/next_review` 不变（先模拟复习推进再重扫）、改一题答案 → 新写库、手动录入幂等、不同页独立、匿名不标 dup、指纹排序/归一化（`'a'`/`' A '` 同、顺序无关）。
- `frontend-uni/tests/book-r531-scan-dup-note.test.js`（新）：`scanDupNote` 非 dup 空、手动/扫描措辞、同日/跨日、dup 行可跳、结果 sheet 源锁、`.scan-dup` 用 `--warn`/`--warn-bg`；**R531b** +2 例：`scanRowKey` 同 no 可跳/不可跳 key 不同（`'2:jump'` vs `'2'`）、模板 `:key="scanRowKey(scanResult, r)"` 且 `not.toContain(':key="r.no" class="scan-row"')`。
- `frontend-uni/tests/book-r528-paper-inline-note.test.js` / `book-r530-scan-jump-all-pages.test.js`：只按 R531/R531b 有意改动更新源锁（汇总行 `v-if="scanResult.saved"`、行 `:key`、import 串），未放宽。

## 2. 本地一手（`:8525`，DB `~/r525/app.db`，uid `r522local`，`~/r531/local_r531.py` → `local_{375,1440}.out` + 截图 `local_{W}_scan1.png / _scan2_dup.png / _scan3_changed.png / _jumped.png`）

- 真导出 60 题 `5A43BB84`（PDF 11 页、答题卡 `[1,2]`）；p1 合成涂卡 `{0:B,1:A(错 qid 12),2:B,3:AB}`，p1b 只改第 1 题 `A`。
- **scan1**（首扫）：`{page 1, pages 2, total 50, answered 3, correct 2, saved True, dup False, dup_at None}`；DB `answer_log 0→3`、`mistakes(times 1, streak 0, next None)`、`paper_submits 1`；结果 sheet「第 1/2 页 · 已作答 3/50 · 答对 2 题 · 已记入做题记录」+ R529 页数行，仅 no2 可跳、`NONJUMP_WITH_ROLE 0`。
- 模拟复习推进（`review_streak 1 / next_review 明日 00:00 CST`）后 **scan2**（同图重扫）：`{…, saved False, dup True, dup_at 1788856656.39}`；DB **`answer_log 3` 不变、`(1, 1, 1788883200.0, 0)` 不变、`paper_submits 1`**；结果 sheet 汇总行**无**「已记入做题记录」+ 警告色说明行「这一页已于 今天 08:37 判分并记入做题记录；本次答案完全相同，未重复记录，复习进度不受影响」（375 343×58 / 1440 433×58，`rgb(180,83,9)` on `rgb(255,251,235)`）+ R529 页数行；no2 仍可跳 → 点「看错题 ›」：`GET /api/mistakes` +1、`#mc-14`（`mistakes.id 14 ↔ qid 12`）展开 `top 52`。
- **scan3**（p1b 改第 1 题）：`saved True, dup False, correct 1`；DB `answer_log 6`、`mistakes(times 2, streak 0, next 现在)`（这次是真的新作答且再错，回退合法）、`paper_submits 2`；no1/no2 两行可跳。
- 375/1440 `NON2XX []`、`ERRS []`。
- 门：pytest **584**（R530 580 + 4 净增；`-x` 全过）/ ruff；vitest R531 139 文件 / 940→ R531b **140 / 946**、eslint 0 error / 19 warn（既有）、`lint:tokens`、`build:h5`（R531 `index-D4VJZUr-.js` → R531b `index-DyXegtPT.js`）；`git diff --check` 空。R531b 后端 0 改动，不带 cache 再跑 pytest 全过（`~/r531/pytest_r531b.out`）——R530b 偶发例**未复现、无法归因**。

## 3. 发版（两次，`./deploy/deploy_h5.sh --skip-build`）

- **R531 `3c38f238`**（`r531_deploy.log`）：预检 `r531_pre.out`（08:10Z）healthy 0 重启 / load 2.01 / disk 5.0G / MemAvailable 390 MB / 兄弟 0 / WAL `4,173,592`；2b 谱系 OK（线上 `f0527f0e` 是本机祖先）。4/6 重建期间宿主 **`other_builds=1`、disk 2.4G(96%) → 1.1G(98%)** 六次采样（兄弟构建再起），随后回落 5.0G / 兄弟 0；compose `KG_COMPOSE_EXIT rc=0 08:44:42Z`、新容器 `08:44:42Z`；线上 rev `3c38f238` = 本机、bundle `index-D4VJZUr-.js` = 本机；6b `/` perf 0.93 / a11y 1.00 / LCP 2812 / CLS 0.06、`/tiku/` 1.00 / LCP 888；`DEPLOY_RC=0`。
- **R531b `47dc7b0a`**（`r531b_deploy.log` + `r531b_deploy_resume.log`）：预检 load 1.91 / disk 5.0G(90%) / MemAvailable 297 MB / 兄弟 0 / healthy。4/6 起步 `other_builds=0`，但 build 期间 `/opt/SoftCopyrightAgent` 兄弟 `compose -f docker-compose.prod.yml up -d --build` 再起 → load 11.19、disk 3.8G、`other_builds=3`；**600 s 触顶 `FAIL`（R468 已知形态）**，脚本按设计退出、compose 留宿主后台。按脚本提示 1) 等 `KG_COMPOSE_EXIT rc=0 at 09:06:54Z`（镜像 `#10 DONE 116.3s` 后 Recreate 段被挤 ~13 min），2) `DEPLOY_RESUME=1 --skip-build` 续跑 4a–6：线上 rev `47dc7b0a` = 本机、bundle `index-DyXegtPT.js` = 本机、5b 变体 OK；6b `/` perf 0.90 / a11y 1.00 / LCP 2813 / CLS 0.06（宿主 load 10+ 下采样，均在预算内）、`/tiku/` 1.00 / LCP 875；`DEPLOY_RC=0`。新容器 `09:06:48Z` healthy 0 重启。
- **Recreate 窗一手**（`r531b_post.out`，源站 Caddy 08:52–09:10Z 155 请求）：`200 151 / 304 1 / 403 1 / 503 2`，2 条 503 均 `GET /api/health` **带 `X-Kg-Probe`**（= 本会话 / 部署脚本探针），时间 `09:06:30Z–09:06:56Z` = 旧容器停 → 新容器 healthy 的 ~25 s 窗；**非探针 5xx 0**。脚本提示「旧容器继续对外服务」只对「compose 仍在 build」阶段成立，进入 Recreate 后旧容器已停（09:06:36Z 采样 `docker ps` 无 kaogong-1）——即 600 s 触顶后、compose 自行完成 Recreate 的那一刻仍有一个不可控的秒级窗（R457 已登记形态，本轮一手 ~25 s、0 真人命中）。

## 4. 生产只读复采（`prod_r531.py`，uid `umst3`，`X-Kg-Probe: 1`，非 GET 全 abort；`paper_answers`/`scan_sheet` 被 abort 后 fulfill 为本地真回包**形态**——生产不上传答题卡、不写库）

**服务端一手（真 GET）**：`GET /api/health` `3c38f238` → `47dc7b0a`；`GET /api/paper/9D29E4AB` `{n 12, pages 1, inline_n 0}`；bundle `index-D4VJZUr-.js` → `index-DyXegtPT.js`；`GET /api/mistakes` 真列表定位 `#mc-2934`（`mistakes.id 2934 ↔ qid 162861`）。**生产 `paper_submits` 表不存在**（首次 claim 才建）→ 本轮生产 0 次 dedupe 写入、0 次 scan/paper_answers 落库，与 WAL 同字节互证。

**显示层（`3c38f238` / `index-D4VJZUr-.js`，`prod_375.out` / `prod_1440.out`）**，375 / 1440 同：
- D0 首次 `saved:true`：「已记入做题记录」、12 行仅 no1 `role=button + tabindex=0 + 看错题 ›`、`NOTES []`。
- S0 legacy 回包（无 `dup/dup_at`、`saved:false`）：12 行 0 可跳、`NOTES []`（旧 bundle/旧回包兼容）。
- D2 跨日 dup：「这份答案已于 9月5日 08:46 判分并记入做题记录；本次答案完全相同，未重复记录，复习进度不受影响」（343×58 / 433×58，`rgb(180,83,9)` on `rgb(255,251,235)`），no1 可跳。
- D1 同日 dup：「…已于 今天 08:36 …」；点 no1「看错题 ›」→ `sheet_visible False`（`getBoundingClientRect` 可见性，非 innerText）、真 `GET /api/mistakes` +1、`#mc-2934` 展开 `top 52`（375 h 667 / 1440 h 534）、`POST track book_scan_jump {"source":"9D29E4AB","ref":"162861"}` 发出被 abort。
- D3 扫描 dup（`page 1`）：「第 1 页 …」+「这一页已于 今天 08:44 …」（343×58 / 433×58）。
- abort 清单仅 `track boot` / `paper_answers`×4 / `track book_scan_jump` / `scan_sheet`；GET 非 2xx `[]`；`ERRS []`。

**R531b 命中（同一轮 `3c38f238` 首采）**：S0 段 `NONJUMP_WITH_ROLE [{'no':'1','role':None,'tab':'0','jump':False}]` 两视口同——no1 行 `role` 已正确为 `None`（R530b 生效），但 **`tabindex=0` 残留**。根因：D0 段 no1 可跳时 `a11y-focus.js` 在 click 监听挂上时补了 `tabindex=0`（monkey patch 只在 `addEventListener('click')` 时补，监听移除不回收）；S0 段同题号行变不可跳，`:key="r.no"` 不变 → Vue 复用同一 DOM 节点，只更新 `role`/`class`/监听，`tabindex` 属性不归 Vue 管故残留 → 无 `role` 的无动作键盘落点（比 R530b 轻：读屏不报「按钮」，Tab 仍会停）。生产真实触发路径 = 同一进页内两次结果（首次 `saved` → 再次 `saved:false`/别卷同题号），同 R530b 一样属 a11y 缺陷而非业务缺陷。修：`scanRowKey(res, r)` 把可跳态编进 key（`'1:jump'` ≠ `'1'`）→ 状态变化即重建节点，无 `tabindex` 遗留；不动 `a11y-focus.js`（全站补丁，改回收逻辑影响面大、无其它一手）。**复采（`47dc7b0a` / `index-DyXegtPT.js`，`prod_375_b.out` / `prod_1440_b.out`）**：D0/S0/D2/D1/D3 全段 `NONJUMP_WITH_ROLE []`，可跳行仍 `role=button tab=0`，dup 跳转 `#mc-2934 top 52` / `GET +1` / `sheet_visible False` 不变；GET 非 2xx `[]`、`ERRS []`。

## 5. (c) / 到期项 / 簇

- `r531_pre.out`（08:10Z，`f0527f0e` 容器窗）：healthy 0 重启；5xx / assets 404 / monitor / mpUA / 非探针 POST / 401·403 / Traceback 全 0；WAL `4,173,592`；probe=0 `answer_log 53/2`；`umst3` 32/45/22/1 同 R530；任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0、`paper_exports` 05:22Z 后 0（仍 4 列，`inline_n` 首次导出才加）；`scan_sheet/paper_answers/paper/{code}` 全历史仍全探针（`140.232.64.x`）；09-08 503 仍 75（R525-2）。
- `r531b_post.out`（09:10Z，`47dc7b0a` 容器窗）：healthy 0 重启；WAL **`4,173,592` 同字节**；`answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38`（与 R530 计数一致，`paper_exports` 仍 38）；`paper_submits` **表不存在**；Recreate 窗 503 ×2 全探针 `/api/health`（§3）。
- **簇**：09-08 终值 **6575 / 6499，last 07:06:37Z**；07:00–09:08Z 非探针 `/tiku*`/`/` 行 07h 54/39 IP（= 07:00–07:06 簇尾）、08h 28/4 IP、09h 1/1 → 簇形态（每 IP ≤2、匀速 15 行/分）已停 2 h；**隔日（09-09 00:00Z）是否再起尚未到期**，R532 复查。无新的外部真人证据。
- **宿主级再命中（第三轮连续）**：R531 4/6 期间兄弟构建把 `/` 压到 1.1G(98%)；R531b 期间兄弟 `SoftCopyrightAgent compose prod --build` 再起 → load 11–15、disk 3.8G → **555M(99%)**（09:1xZ 采样，`other_builds=2`）、MemAvailable 257 MB；kaogong 容器 healthy、无磁盘错误日志。未动任何非 kaogong 资源；`docker system df` Images 7.5G / Volumes 12.2G / Build Cache 3.4G。

## 6. 登记 / 未做

- 小程序 `pages/book` 结果 sheet 未接 `dup/dup_at` 说明行（回包多字段向后兼容，纯显示层）→ 并入 **R528-1（P3）**。
- 生产 `scan_sheet`/`paper_answers` 真提交不做（会写库）；生产段证明的是 bundle 显示层 + 真 GET（health/paper/mistakes）；服务端 dedupe 只有本地一手（9 例 pytest + `local_r531.py` DB 前后对账）。
- 涂卡图为按 `bubble_rect()` 合成、非实拍。
- **R531-1（P3，教训入 SKILL）**：`a11y-focus.js` 补的 `tabindex` 不随 Vue 复用节点回收；凡 `v-for` 行的「可点态」会随数据变化，key 必须带该态（或走 `v-if` 两套节点）；走查须在**同一进页内**先出可点结果、再出不可点结果，读 `tabindex` 而非只读 `role`（R530b 只读 `role` 未见）。
- **R468/R457 形态再现**：600 s 触顶 + Recreate 秒级窗（本轮 ~25 s、仅探针 503 ×2）；宿主级三选（R469 §4）仍待老板定。
- 跨日 dup 文案「M月D日」不带年（跨年同月日会歧义，`paper_submits` 保留完整 `created_at`，显示层可随时改）；`paper_submits` 无清理策略（每行 ~100 B，按当前流量可忽略；若有诉求按 `created_at` 保留 N 天）。
