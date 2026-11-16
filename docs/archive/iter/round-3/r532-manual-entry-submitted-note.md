# R532（实现轮）：手动录入层对「已判过分的同卷」进层即提示——`GET /api/paper/{code}?uid=` 回包 `submitted_pages`（该账号对该卷已判过分的记录：手动录入整卷 `page 0` / 答题卡页 `1..P`，含首次/最近时刻与不同作答次数）+ 录入层「这份卷你已判过分：…；再次交卷时作答完全相同不会重复记录，有改动会记为新的作答」；不预填答案；「查看本卷错题」不立项；小程序 parity 成本论证登记

日期：2026-09-08（UTC 09:2x–10:xx）。上游：R531（#669 已合入 main `06ab1981`）。统筹者指令：实现轮口径，命中即论证→实修→发版→复采。

## 0. 结论表（四维下一候选三项一手核 + 到期项）

| 项 | 设计论证（样本 / 现状 / 目标 / 契约 / 失败闭合 / 否决） | 结论 |
|---|---|---|
| A. 手动录入层对已判过的同卷再进是否需预填/提示 | **样本**：本地 `:8525` uid `r531ui375/1440` 在 R531 已对 `5A43BB84`（60 题、答题卡 2 页）第 1 页扫描判分 2 次（不同作答）。**现状（改前一手）**：录入层只回 `{code,title,n,pages,inline_n,created_at}`，60 行全空，用户录完 60 题点「交卷判分」才被 R531 的 dup 说明行告知「已判过、未重复记录」——一次白录。**目标**：进层即知。**契约**：`paper_submits` 只存 `picks_hash`（sha1 指纹）+ `created_at`，**没有原始 picks**，预填在数据上不可能；要预填就得新增答案回显存储 = 扩隐私面（匿名 uid 可被猜到）+ 新表 + 交互（预填后「改一题再交」语义与 dup 判重纠缠）。故只做提示：后端 `db.paper_submitted_pages(uid, code)` 对 `paper_submits` 按 `page` 聚合 `MIN/MAX(created_at)`、`COUNT(*)`（= 不同作答指纹数，同答案重交被 `INSERT OR IGNORE` 挡在表外故不计）；`/api/paper/{code}` 加可选 `uid`（截 64），无 uid / 表未建（`OperationalError`）/ 无行 → `[]`，只读不建表；前端 `manualLookup` 带 `anonUid()`，`paperSubmittedNote(p)` 在 `n>0` 且有记录时出一行（复用 dup 说明行样式 `.scan-note.scan-dup`），`page 0` 标「手动录入」、`page>0` 标「答题卡第 N 页」，时刻用与 dup 行同一 `scanWhen()`（同日「今天 HH:MM」/ 跨日「M月D日 HH:MM」），`n>1` 追加「（n 次不同作答）」。**失败闭合**：回包缺 `submitted_pages`（旧后端）/ 非数组 → 不出行；`n=0` 全内联卷仍走 R527 文案。**否决**：预填（无数据、扩隐私）/ 前端 localStorage 记「我交过」（换设备不知、与服务端 dup 口径两套）/ 阻止再进（有改动本就该记为新作答）。 | **命中，实修**（8 文件 +172/−15） |
| B. dup 说明行之外「查看本卷错题」诉求 | **一手**：错题本「按卷筛选」（R368/R369）的卷 = 题目来源真题卷 `mistakePaper(m)`（`questions.paper_id`），**不是导出卷码**；导出卷 `paper_exports.question_ids` 是任意勾选题集合，错题行不存卷码，`paper/{code}` 也不回 `question_ids` → 「本卷（卷码）错题」是新维度，要么回包加 `question_ids` 前端 ∩ `mistakes.question_id`，要么后端新查询。**诉求侧**：生产 `scan_sheet/paper_answers/paper/{code}` 全历史仍全探针（§5），无一个真人扫描/录入者，更无「看本卷错题」的行为/反馈；R530 已给逐题「看错题 ›」，dup 场景下仍可点。**判断**：无用户一手、需新契约，不做；登记 R532-2（P3）等真人扫描者出现后按其行为再议。 | 不立项，登记 |
| C. 小程序 `pages/book` 接 R528–R531 回包字段成本 | **一手**（源码）：`miniapp-native/miniprogram/pages/book/book.ts` 1084 行 / `book.wxml` 366 行；`api/exam-types.ts` `PaperAnswersResp` 无 `inline_n/pages/page/saved/dup/dup_at`（TS 严格模式下要加 7 个可选字段）；错题卡有 `question_id` + `open` 展开态（`onToggle` → `fetchAttempts`），可做「看错题」定位（按 `question_id` 找 `shown[idx]` → `setData open` → `pageScrollTo`）但无 `scroll-margin-top` 等价、需 `createSelectorQuery` 量位置。**成本估算**：类型 +7 字段、wxml 说明行 ×3（inline / pages / dup）+ 页标 + 多页合计（要把 `paper-scan-pages.js` 的会话内累计逻辑移植为 TS，含单测 0 → 需新建）+ 逐行 jump（谓词 + 定位 + a11y）≈ 150–250 行 TS/WXML + `typecheck/lint` + 真机跑（`WX_MINIAPP_SECRET` 未配、小程序未上线、无真机通道）。**触达侧**：小程序端 `scan_sheet/paper_answers` 生产 0 调用（全历史全探针且 UA 无 mpUA）。**判断**：显示层 parity 成本中等、收益当前为 0 且无法真机验证；回包全部为**新增字段向后兼容**，小程序不接不会坏。保持 **R528-1（P3）**，把本轮成本估算入档，待小程序有真机通道 / 上线计划时按估算排期。 | 不做，成本入档 |
| 到期：簇隔日是否再起 | 09-09 00:00Z 日界未到（宿主 09:31Z），预检时仍无新簇行；**但 09:34Z 起簇同日再起**（350 行 / 332 IP / 8 min，同 UA 对、同请求头集合、每 IP 1，§5）→ 「07:06Z 已停」是观测窗内结论，实为暂停 ~2.5 h。 | 到期项改写：同日再起，不改码；隔日 R533 仍查 |

## 1. 改动（代码 2 commit：`8ccc3937` + 注释对齐 `5869b401`）

- `backend/app/db.py`：`paper_submitted_pages(uid, code) -> list[{page, first_at, last_at, n}]`，`GROUP BY page ORDER BY page`，`OperationalError`（表未建）→ `[]`，不建表。
- `backend/app/exam_api.py`：`api_paper_info(code, uid="")` 回包加 `submitted_pages`（无 uid → `[]`）；`paper_answers/scan_sheet/_persist_graded` 不动。
- `frontend-uni/src/paper-scan-pages.js`：抽 `scanWhen(t, now, fallback)`（原 dup 行内联时间格式），`scanDupNote` 复用；新增 `paperSubmittedNote(p, now)`。
- `frontend-uni/src/pages/book/book.vue`：`manualLookup` 请求 `/api/paper/{code}?uid=<anonUid()>`；录入层 `n>0` 时先出 `paperSubmittedNote`（`.scan-note.scan-dup`）、再出 R528 `inlineSkipNote`；`n=0` R527 文案不动；不预填、不改交卷。
- 测试：`backend/tests/test_r532_paper_submitted_pages.py`（2 例：未判 `[]` / 无 uid `[]` / 手动整卷 `page 0` / 同答案重交 n 不增 / 改一题 n=2 / uid 隔离 / 卷隔离 / 60 题卷扫第 2 页 `page 2` 与手动 `page 0` 并存 / 时刻单调）；`frontend-uni/tests/book-r532-paper-submitted-note.test.js`（5 例：空态三形态 / `scanWhen` 同日·跨日·无效 / `page 0` 手动·`n>1` 次数·扫描页·并存 / book.vue 源锁 `?uid=` + 渲染 `paperSubmittedNote` + `n=0` 分支保留）；R530/R531 源锁 import 同步。
- 门：pytest 586（+2）/ ruff；vitest 141/951（+1 文件 +5 例）、eslint 0 error、tokens、build:h5；`diff --check` 空。

## 2. 本地一手（`:8525`，DB `~/r525/app.db`，uid `r531ui{375,1440}`，`~/r532/local_r532.py` → `local_{375,1440}.out` + 截图 `local_{W}_m1_scanned_before.png / _m2_fresh.png / _m3_after_manual.png`）

- 服务端：真 `GET paper/5A43BB84?uid=r531ui375` → `submitted_pages [{page 1, first_at 1788856656, last_at 1788856670, n 2}]`（R531 两次不同作答）；同卷无 uid / `uid=nobody` → `[]`。
- m1（已扫过第 1 页）：录入层出「这份卷你已判过分：答题卡第 1 页 今天 08:37（2 次不同作答）；再次交卷时作答完全相同不会重复记录，有改动会记为新的作答」——375 343×78（3 行）/ 1440 433×58（2 行），13px 警告色 `rgb(180,83,9)`；**60 行 `picked 0`（不预填）**、汇总「共 60 题 · 已选 0」。
- m2（新导出 5 题卷 `8B5C73B5`）：`submitted_pages []` → **无提示行**，5 行。
- 真交卷 60 题全 A → `paper_answers {saved true, dup false, answered 60, correct 13}`，DB `paper_submits` `[(0,1),(1,2)]`；再进同卷 → 「手动录入 今天 09:34 · 答题卡第 1 页 今天 08:37（2 次不同作答）」375 343×78 / 1440 433×78。
- 两视口 `NON2XX []`、`ERRS []`。

## 3. 发版（`./deploy/deploy_h5.sh --skip-build`，`~/r532/r532_deploy.log`）

- 预检（`r532_pre.out`，09:31Z，`47dc7b0a` 容器窗）：load 2.66 / disk 4.5G(91%) / MemAvailable 320 MB / **兄弟构建 0** / healthy 0 重启 → 满足发版条件（无需等待，本轮未再命中宿主级）。
- 09:37Z `--skip-build`（dist 09:30 与 `5869b401` 前端同源；`5869b401` 只改后端注释）：compose `rc=0`，新容器 **09:38:43Z** healthy 0 重启（约 1.4 min 收敛，无 600 s 触顶）；rev `47dc7b0a → 5869b401`；线上 bundle `index-M9JnAcJA.js` = 本机、gzip 124 KB ≤ 160 KB、各 Accept-Encoding 变体 OK；回归全部 200；`DEPLOY_RC=0`。
- 6b：`/` perf 0.93 / bp 0.96 / seo 1.00 / LCP 2814 / CLS 0.00、**a11y 0.94 WARN**；`/tiku/` 全 1.00、LCP 874。首页本轮 0 改动 → 按 SKILL（R429 间歇形态）本机 `npx lighthouse --only-categories=accessibility` 对生产复采 ×3 → **1 / 1 / 1、0 失败审计**（`~/r532/lh_a11y_{1,2,3}.json`）→ 单次抖动，不改。
- Recreate 窗（`r532_post.out`，源站 Caddy 09:17–09:45Z 395 请求）：`200 393 / 304 2`，**5xx 0**（含探针；R457/R468 秒级窗本轮未命中）。

## 4. 生产只读复采（`~/r532/prod_r532.py`，uid `umst3`，`X-Kg-Probe: 1`，非 GET 全 abort）

- 服务端一手（真 GET）：health `{"ok":true,"rev":"5869b401"}`；`GET /api/paper/9D29E4AB?uid=umst3…` → `{code, title "错题重练卷 9月5日", n 12, pages 1, inline_n 0, created_at, submitted_pages: []}`；无 uid → `submitted_pages []`。生产 `paper_submits` 表**仍不存在**（§5）→ `[]` 走的是 `OperationalError` 分支，与本地「表存在但无行」同形态。
- 显示层（两视口相同，`prod_{375,1440}.out` + 截图 `prod_{W}_{p0_real_empty,p1_manual_today,p2_two_records,p3_legacy_absent}.png`）：
  - **P0 真实态**（真回包 `[]`）：录入层 0 提示行、12 行 `picked 0`、「共 12 题 · 已选 0」、按钮「交卷判分（0 题）」（不点）。
  - P1（route 把**同一真 GET 回包**的 `submitted_pages` 改为 `[{page 0, n 1, 15 min 前}]`，其余字段原样）：「这份卷你已判过分：手动录入 今天 09:25；再次交卷时作答完全相同不会重复记录，有改动会记为新的作答」——375 343×58 / 1440 433×58，13px `rgb(180,83,9)` 于 `rgb(255,251,235)`（与 R531 dup 行同样式）；仍 `picked 0`（**不预填**）。
  - P2（`[{page 0, n 2, 3 天前}, {page 1, n 1, 5 min 前}]`）：「…手动录入 9月5日 09:40（2 次不同作答） · 答题卡第 1 页 今天 09:35；…」——375 343×78（3 行）/ 1440 433×78；`picked 0`。
  - P3（回包**删掉** `submitted_pages` 字段 = 旧后端形态）：0 提示行、12 行正常 → 向后兼容。
  - `REAL_GET_UNDER_ROUTE` 三次真 GET 均 `submitted_pages []`（route 改的是客户端拿到的副本；服务端未变）。
- 非 GET 全 abort：仅 `POST track boot` ×1（每视口）；`GET_NON2XX []`；`ERRS []`；0 PDF / 0 LLM / 0 写入。
- **边界明示**：P1/P2 证明的是 bundle 显示层 + 真回包的字段位置；服务端「有记录 → 非空 `submitted_pages`」只有本地一手（§2 + pytest 2 例），生产不造 `paper_answers/scan_sheet` 写入。

## 5. (c) / 到期项 / 簇

- `r532_pre.out`（09:31Z，`47dc7b0a` 容器窗）：healthy 0 重启；5xx / assets 404 / monitor / mpUA / 非探针 POST / 401·403 / Traceback 全 0；WAL `4,173,592`；`answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38`（仍 4 列）；`paper_submits` 不存在；`umst3` 32/45/22/1 新增 0。
- `r532_post.out` + `r532_db{,2}.out`（09:42–09:44Z，`5869b401` 容器窗 302 请求）：healthy 0 重启；load 0.29 / disk 4.0G(92%) / MemAvailable 301 MB / 兄弟 0；5xx 0 / 401·403 0 / assets 404 0 / mpUA 0 / Traceback 0；非探针 POST 2 条（`monitor/report` + `track`）均来自 **本机出口 `140.232.64.4`**（deploy 6b Lighthouse 的 moto g UA、无显式头但网段在 `KG_PROBE_CIDRS`，R386 三路判定归探针）；**WAL `4,173,592` 同字节**；四表计数与 pre 完全一致；`paper_submits` 仍不存在 = 本轮 0 dedupe 写入；`umst3` 32/45/22/1 新增 0；任意 uid `answer_log` 04:52Z 起 0；`paper_exports` 05:22Z 后 0。
- **簇（到期项，结论改写）**：09-09 日界未到，但**簇在 09-08 09:34Z 同日再起**（`r532_cluster{,2}.out`）：09:34–09:42Z 8 min 350 行 / 332 IP（每 IP 1、322 个不同 /16、~40 行/分，比上午 15 行/分快）、UA 仅两枚（Win Chrome 169 / Mac Chrome 160，与 00:00–07:06Z 段 1942/2025 同一对）、10 个请求头集合完全一致、`Accept-Language en-US` / 无 Referer / `Cf-Ipcountry` 缺、全经边缘、全 200、路径 `/tiku/q/*` 逐题各 1。→ 「07:06Z 停、隔日再起」判断作废：是**同日暂停 ~2.5 h 后再起**，形态不变；R531 曾据此说「已停」属观测窗内结论。仍为推断归因（分布式爬取），日报 humans.page 会继续被灌；`classify()` 口径仍待老板定（第 N 次提）。
- 无新的外部真人证据。

## 6. 登记 / 未做

- **R532-1（不做）**：预填答案——`paper_submits` 只有指纹，预填需新增答案回显存储；有真人诉求再论证隐私面。
- **R532-2（P3）**：「查看本卷（卷码）错题」——错题本按卷筛选是真题卷维度，导出卷码维度需新契约（`paper/{code}` 回 `question_ids` 或后端 JOIN）；生产 0 真人扫描/录入者，无诉求一手。
- **R528-1（P3，成本入档）**：小程序 `pages/book` 接 `inline_n/pages/page/saved/dup/dup_at/submitted_pages` + 逐行 jump + 多页合计 ≈ 150–250 行 TS/WXML + 新建单测，无真机通道（`WX_MINIAPP_SECRET` 未配）；回包字段全为新增向后兼容，不接不坏。
- 提示行 375 三行 78px（比 dup 行 58px 多一行）：信息量（手动 + 答题卡页 + 次数）决定；若真人反馈过长再收「（n 次不同作答）」。
- 生产不造 `paper_answers/scan_sheet` 写入 → 生产 `submitted_pages` 恒 `[]`（表不存在）；有记录形态的显示层用 route 把真 GET 回包 `submitted_pages` 改为本地真形态（§4 明示）。
- 簇：同日 09:34Z 再起（§5），隔日 00:00Z 后是否接续 R533 查；归因仍为推断。
- `local_r532.py` 375 跑到最后一步 `close_sheet()` 对已自动关闭的 sheet 再点一次 → Playwright 30 s timeout（`local_375.out` 尾），发生在全部验证输出之后、属脚本收尾冗余，不影响任何读数；1440 未触发（sheet 尚开）。
