# R533：(c) 补量 + 到期项/簇 + 四维三候选一手核（录入层提示行直达 R369 / 结果 sheet 与录入层时间同源锁 / 导出确认层「此卷已判过」）——0 产品代码、+2 源锁、0 部署

日期 2026-09-08（UTC 09:5x）。生产保持 `5869b401`（R532），本轮不发版。

## 0 结论

| 候选 | 一手 | 结论 |
|---|---|---|
| A 录入层提示行直达 R369「按卷筛选」 | 源码：R369 按卷筛选键是 `m.paper.pid`（`db._paper_by_psource()`，只覆盖 `kind=zhenti` 真题卷 `psource`），录入层/扫描的卷是 `paper_exports.code`（导出卷 md5 卷码），两者**不同源、无映射列**；本地 `:8525` 一手：`GET /api/mistakes?uid=r531ui375`（该 uid 全部错题来自导出卷 `5A43BB84` 判分）47 条 **0 条带 `paper`**（`~/r533/a_pid_vs_code.out`） | **不可直达、不立项**。要做只能新增「按导出卷码筛错题」（服务端按 `paper_exports.question_ids` ∩ `mistakes.question_id`），等价于 R532-1「查看本卷错题」（P3，等真人扫描/录入出现再评）；本轮把「pid ≠ code」这条事实并入 R532-1 |
| B 结果 sheet dup 说明行与录入层提示行时间口径同源 | 源码：`dup_at` = `claim_paper_submit()` 返回的 `paper_submits.created_at`；`submitted_pages[].first_at/last_at` = 同表同列 `MIN/MAX(created_at)`；前端两行都经 `scanWhen(ts, now)`（`paper-scan-pages.js`），`uid` 均取 `anonUid()`、服务端均 `[:64]` 截断 | **成立、已同源，只加源锁**：pytest `test_r532_paper_submitted_pages` 加 `dup["dup_at"] == first_at`；vitest `book-r532-paper-submitted-note` 加同一 `created_at` 下两行时刻文案逐字相同（同日 / 跨日 / 12-31 三例） |
| C 导出确认层提示「此卷已判过」 | 源码：卷码 = `md5(",".join(id 序))[:8]`（`exam_api.api_export_pdf`），**同一题集重复导出得同一卷码**，`save_paper_export` `INSERT OR REPLACE` 只刷 `created_at/title`；本地一手（`~/r533/c_reexport.out`）：对 `5A43BB84` 同 60 题再导出 → `X-Paper-Code 5A43BB84`、`created_at 1788856694 → 1788861491`、`paper_submits 6 → 6` 不动、`GET paper/5A43BB84?uid=r531ui375` 仍回 `submitted_pages [{page 0,n 1},{page 1,n 2}]` | **不立项**：确认层在 POST 前**没有卷码**（服务端才算 md5），要提示需前端复刻 md5 或新增预览接口；而「已判过」在真正要紧的时刻——再进录入层 / 再扫描——已由 R532 提示行 + R531 dup 行覆盖（本地一手：重复导出后提示行仍出）。导出时用户要的是一张纸，此处提示无一手诉求（生产导出/判分全历史仍全探针） |

## 1 (c) 补量 / 到期项 / 簇（`~/r533/r533_cluster.sh` → `r533_cluster.out` 09:52:57Z、`r533_cluster2.out` 09:59:02Z；`r533_posts.sh` → `r533_posts.out`）

- 容器 `deploy-kaogong-1` Up 14 → 20 min healthy（R532 09:38:43Z 容器）；load `0.22/0.39/1.57` → `3.84/1.62/1.64`（1 min 尖峰，`compose build` 进程 0，非兄弟构建；未归因）；`/` 4.5G(91%) → 3.9G(92%)；MemAvailable 330 → 368 MB。
- DB 只读（`file:...?mode=ro`）：`answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38`（仍 4 列 `code,created_at,title,question_ids`，无 `inline_n`）；`sqlite_master` 中 **`paper_submits` 表不存在**（R532 一手同：首次 claim 才建；R532 小结里的「paper_submits 0」即此计数，不是行数）；`answer_log` 04:52Z 起 0；`umst3` `answer_log 45 / mistakes 32 / review_log 1` 与 R532 同；WAL `data.db-wal 4,173,592` 同字节；`data.db` 与 `data.db.r483-before` 均 449,310,720（后者仍待老板确认清理）。
- 非探针头非 GET 自 00:00Z 80 条：`140.232.64.4` 53 + `140.232.64.3` 23（本机出口 /16，在 `KG_PROBE_CIDRS`：`track 24 / answer_log 20 / mistakes 14 / practice/progress 9 / practice_result 2`，均为本机走查/deploy Lighthouse）+ `34.186.26.24` 4 条 `POST /` 403（源站直连扫描，R388 口径）。**外部真人写请求 0**。
- **簇**：09-08 逐小时 rows/ips `02h 160/160 · 03h 906/900 · 04h 1010/1009 · 05h 924/924 · 06h 932/932 · 07h 35/35 · 09h 966/965`；09:34Z 再起段至 **09:59:01Z 仍在跑**（逐分钟 22–56 行，09:58 15 / 09:59 3 为采样截断），UA 仍是同一 Mac/Win Chrome 对（2498/2435）。**「09:34Z 再起段何时停」本轮观测窗内未停**；**09-09 00:00Z 日界未到**，两项转 R534。归因仍推断（每 IP 1、同请求头集合，见 R532）。
- 脚本修正：`utcfromtimestamp` → `fromtimestamp(ts, timezone.utc)`（R533 首采有 DeprecationWarning，读数不受影响）；补 `sqlite_master` 表存在判定 + WAL `ls -l`（R533 首采 WAL 行未打出：`ls` 对 docker volume 目录需 `sudo`）。

## 2 本地门（`~/r533/gate.out`）

vitest 141 文件 / **952**（+1 例）、eslint 0 error（19 存量 warn）、design-tokens ok、build:h5 通过；pytest **586**（同数，1 例内加断言）/ ruff All checks passed；`git diff --check` 空。pytest 偶发例（R530b/R531）本轮未复现。

## 3 发版 / 生产

不发版：0 产品代码改动，生产 `5869b401` / `index-M9JnAcJA.js` 不变。生产段仅 §1 只读 GET/日志/`mode=ro` DB，0 POST / 0 PDF / 0 LLM / 0 写入。

## 4 登记

- R532-1（P3）「查看本卷错题」：并入本轮事实——R369 按 `pid` 筛选无法覆盖导出卷 `code`（0 映射），若立项需服务端按 `paper_exports.question_ids` 反查；等真人录入/扫描出现再评。
- R533-1（信息项，不立项）：同题集重复导出卷码相同且 `created_at` 被刷新——`paper_submits`/R532 提示行按 `code` 持续有效（预期）；`paper/{code}.created_at` 前端无引用。
- 到期项：簇 09-09 00:00Z 后是否接续 / 09:34Z 段何时停 → R534；load 3.84 单次尖峰未归因（无兄弟 build 进程）。

## 5 如实

A/C 的「不立项」依据是源码 + 本地 `:8525` 一手 + 生产判分/导出全历史全探针（无真人诉求），不是用户访谈；B 只加锁不改行为；本轮无 testing agent 录屏（未另行授权）；簇归因为推断。
