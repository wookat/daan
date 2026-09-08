# R520 / R520b / R520c：四维对标粉笔错题本/夸克后的首批 P0/P1 实修——错题本批量模式「重练所选 / 导出所选」+ 排序「最早」+ `/api/mistakes/redo mids=`（R520）；a11y 弹层栈 z-index 基准 99→`--z-overlay` 档、KgSheet 内打开的导出确认层不再被盖（R520b）；H5 原生 `fetch()`/SSE `reader.read()` 网络层失败落 R519 同一中文口径 + 问答页失败横幅双「请重试」收敛（R520c）；生产 `03f7d826` → `0bf2865b` → `e0b9c919` → `36ed9af1` → `c23ef35f`，375/1440 复采全部对上

日期：2026-09-08（UTC 02:0x–03:3x）。代码 PR：#652（R520，已合 main `35bdb32d`）、#654（R520b，已合 main `8ecbbbf3`）、#655（R520c + 复采命中的横幅修 `c23ef35f`，本文档同分支）。统筹者指令：只读走查已够，把登记项转为实修，回到按四维（操作台/核心功能/落地页首页 UI/架构）对标粉笔错题本/夸克的 P0/P1 高价值功能项。

## 0. 结论

1. **对标只用一手公开面，不臆造对方功能**：粉笔（App Store 公开描述）——多考试类目、真题/练习、详细解析、个性化出题、学习评估/预测分、直播课/课程下载；夸克（App Store 公开描述）——通义千问 AI 助手、AI 搜索、拍照搜题、OCR/扫描、文档摘要、结构化答案、多模态。**没有一手证据**说明对方错题本有「导出 PDF/打印」，本文不把它当竞品事实；拍照搜题/OCR 属夸克通用能力，超出本站考公 H5 范围且无用户诉求证据，**不立项**。对本站「错题本」现状（源码 + 生产 UI）逐项对照后，P0/P1 差距落在：勾选后**只能**「导出 / 恢复复习 / 删除」，**不能对所选直接重做**（粉笔错题本公开描述里「错题重做」是基础动作）；勾选后导出走的是「当前筛选」不是「已选」；排序只有「最新 / 待复习优先 / 错次多」没有「最早」（老错题先清）。三项均是「用户在本站完成不了的动作」，非视觉/文案项。
2. **R520（PR #652，生产 `0bf2865b` 02:32:46Z）**：批量条新增「重练所选」（`GET /api/mistakes/redo?limit=25&mids=2808,2784&uid=…` → 练习页「刷题 1/2」，`track book_redo_sel ref=2`）与「导出所选」（导出确认层「导出范围 错题本 · **已选** / 题数 2 题」）；排序 chip 新增「最早」（`?sort=old`，UI 前三张 `1952/1953/2784` = API 按 `created_at` 升序前三、reload 保持）。后端 `mistakes_redo_questions(..., mids: list[int] | None)`：`mids=` 逐个校验正整数、去重保序、空/非法/>25 → **400**、SQL 参数化、uid 隔离、仍只取 `mastered=0`（源锁 `test_r520_redo_mids.py` 5 例 + 前端 `book-r520-batch-redo-export-sort.test.js`）。**改后生产 375/1440**（`~/r520/post/{batch,done,sort}_{375,1440}.out`）全对上；非 GET 全 abort（`POST track` ×2 被 abort），`GET review/cur` 本地桩 `null`（避免生产复习态干扰），errs []。
3. **R520b（PR #654，生产 `e0b9c919` 02:55:49Z）——R520 复采命中的 P0**：从 KgSheet 底栏（错题本「导出当前筛选」/ 首页「导出为试卷 PDF」）打开的导出确认层，`maskZ=100 / popZ=1000`、`confirmHit = wd-button…`（点到底下 sheet 的按钮）、`confirmReachable=false` → **「确认导出」不可点**（375/1440 均命中，`~/r520/post/batch_375.out EXPORT-CUR-STACK`）。根因 `a11y-focus.js` 弹层栈 z-index 基准写死 99，低于 KgSheet 的 `--z-overlay=1000`。修：`modal-policy.js` `BASE_Z=1000` + `zIndexFor(depth, base)`；`a11y-focus.js` 运行时读 `--z-overlay`（与 KgSheet 同源，回退 `BASE_Z`）；SPEC 同步。**改后生产**：`maskZ=1001 / popZ=1000`，✕ / 确认 / 范围行命中盒全 `hitInside=true`，「仅答案」chip 切换 note「只导出参考答案页，不含题目」，`POST export/pdf` abort（`~/r520/post/stackpost_{book,home}_{375,1440}.out`）。
4. **R520c（PR #655，生产 `36ed9af1` 03:08:12Z → `c23ef35f` 03:22:34Z）——R520b 复采命中**：导出确认后 toast 为「导出失败：**Failed to fetch**」——R519 的中文映射只覆盖 `uni.request/uploadFile` 的 `fail` 回调，H5 原生 `fetch()`（导出 PDF / AI 讲解流 / 面试作答流 / 面试点评流）与 SSE `reader.read()` 中途断流抛的是浏览器英文 `TypeError`（Chrome「Failed to fetch」、Safari「Load failed」），不经 `fail` 回调。修：`api.js` H5 段 `fetchNet()`/`readNet()` 两个薄包装，在**边界**把网络层异常统一为 `new Error(netFailMessage(''))`（= 「网络错误，请检查网络后重试」）；四处 `await fetch(BASE_URL…)` → `fetchNet`、三处 SSE 循环 `reader.read()` → `readNet`；**HTTP 非 2xx / SSE `error` 事件 / 访问码重试 / `isNetMsg` 分类 / 非 H5 实现全部不动**（有意不把 `isNetMsg` 扩到英文串——分类口径只认中文/`request:fail`）。**改后生产 375/1440**：错题本/首页两条导出路径 toast「导出失败：网络错误，请检查网络后重试」、`maskZ=1001`（`~/r520c/post/{book,home}_{375,1440}.out`）。
5. **R520c 复采再命中 → `c23ef35f`**：问答页 `pages/ask` 贴题 → 「用花生十三方法讲解」→ `POST ask/cur` + `POST explain/stream` abort → 横幅「失败：网络错误，请检查网络后重试**，请重试**」（双「请重试」，375/1440 均命中，`~/r520c/post/ask_{375,1440}.out`）。根因 `ask.vue` 两处 `kg-banner` 内联 `error.includes('再试') ? '' : '，请重试'`——只认「再试」，网络文案以「重试」结尾。修：`api-policy.js` 新增 `failBannerText(error, prefix='失败：')`（`/再试|重试/` 命中即不追加），`ask.vue` 两处横幅改绑 `computed errorText`；源锁 7 例文案 + 2 例源结构。**改后生产 375/1440**（`~/r520c/post2/ask_{375,1440}.out`）：横幅/sheet 内文案均为「失败：网络错误，请检查网络后重试」（探针 `banners` 数组 4 项是 `.kg-banner, [class*=banner]` 选择器把同一横幅的嵌套节点各算一次，非 4 个横幅）、sheet 留存 `sheetOpen=true`、textarea 原文留存可重试、`aborted [POST ask/cur, POST explain/stream]`、errs []；四条导出路径复跑仍「导出失败：网络错误，请检查网络后重试」+ `maskZ=1001`（`~/r520c/post2/{book,home}_{375,1440}.out`）。
6. **(c) / 到期项 0 增量**（`~/r520c_post.out` 03:25Z，R520c2 容器窗 03:22:34Z→ 120 请求）：5xx 0、assets 404 0、monitor 0、mpUA 0、非探针 POST []、401/403 []、Traceback 0；WAL `4,173,592` 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 0、`push_subs` 0；公告「详情」/`home_bundle`/`mistakes_total` 非探针无样本；`questions?module=时政` 0；`umst3` 四表 32/45/22/1 自 R516 起新增 0、`mistake 1953/2784/2914` 不变；`question_notes` 5、`question_comments` 17/0、`question_reports` 6 不变。**`shared_questions` 17→18、`user_profile` 9→11**：新行 `shared_questions#42 from_uid=test-w12-mp created 03:11:42Z`、`user_profile test-w12-ux-a 03:02:18Z / test-w12-ux-b 03:11:49Z`，边缘同刻 `POST share/create` / `POST profile` 均 `probe=1` → **推断**为兄弟会话 W12 生产回归造数（按 uid 命名与探针标推断，未向兄弟求证）；同窗还有 `probe=1` `GET notes?uid=test-w12-vis01` 等只读访问。**无新的外部真人证据**。
7. **簇**：09-07 终值 1445 行 / 1443 IP 不变；09-08 至 03:25Z **3127 行 / 3077 IP**（15.2 行/分、峰 97 = R516 重建窗、无 >120 s 间断、UA 14、每 IP ≤2、200 ×3055 / 503 ×72——72 条 503 全是 R516 00:28–00:29Z 重建窗旧账，本轮四次发版重建窗 **0 条 5xx**）仍在跑；`crawler-stats.json` 03:23Z `humans.page 09-08 3025 / ips 2975` = 基本全簇。口径不改（无点头）。
8. **发版四次如实**（均 `DEPLOY_RC=0`、bundle 线上=本机、容器 healthy 0 重启、compose 未触 600 s）：R520 `index-ClOQ1ibX.js` 预检 mem 311 MB / load 0.54 / 兄弟 0，compose 02:31:17→02:32:46Z，6b `/` perf 1.00 / **a11y 0.94 WARN 一次**（R429 已知单次抖动形态；R520b/R520c/R520c2 三次均 1.00）；R520b `index-j7Esffmu.js` 预检 mem 262→473 MB / load 5.26→3.37 / **other_builds=1**（4-pre 让行等待 8 轮直至兄弟构建结束，compose 02:54:27→02:55:49Z 收敛），6b `/` 0.99 / a11y 1.00 / LCP 1421；R520c `index-CNyfZVn6.js` 预检 mem 284 MB / load 0.23，6b **`/` perf 0.85 / LCP 3576 FAIL→WARN 一次**（单次采样、不阻塞；R520c2 同页 0.99 / 1555 过）；R520c2 `index-BhqML2JL.js` 预检 mem 355 MB / load 0.37，6b `/` 0.99 / a11y 1.00 / LCP 1555 / CLS 0.06、`/tiku/` 1.00 / 947 / 0.00。本机无 brotli → 1b 跳过（线上回退 Caddy gzip，历轮同）。
9. **如实**：本机 CDP `X-Kg-Probe: 1`、`localStorage.anonUid=umst3…`；非 GET `/api/**` 全 abort（边缘非探针 POST `[]`）；**abort 掉 `POST export/pdf` 只证明 UI 到达处理函数、确认键可点、失败态可见，不证明生产真生成过 PDF**；`GET review/cur` 为本地桩 `null`；问答页失败是 abort 造的网络层失败，**未触发生产 LLM**、`explain_cache` 未变；「重练所选」落到练习页作答页但未提交（`POST answer_log` 会被 abort）；`explain/stream` 中途断流（`readNet`）与面试两条流只有源锁 + 本地单测覆盖、**生产未复现中途断流**；点了批量条/排序/导出/讲解——浏览器本地路径，**非真人证据**。

## 1. 对标与设计论证（改前）

| 维度 | 对方一手（App Store 公开描述） | 本站现状（源码 + 生产 UI，R516–R518 只读审） | 差距判定 | 取舍 |
|---|---|---|---|---|
| 核心功能 | 粉笔：真题练习 + 详细解析 + 错题重做（公开描述） | 错题本批量模式只有 导出 / 恢复复习 / 删除；「重练」只有整筛选 `redo?limit=` 与单题操作单 | **P0**：勾选后不能对所选重做 | 复用 `/api/mistakes/redo` 加 `mids=` 过滤（uid 隔离/mastered=0/≤25），前端批量条 +「重练所选」→ 既有 `practiceLaunch` 路径；不新建端点 |
| 操作台 | — | 勾选后「导出」仍导出「当前筛选」 | **P1**：所选与导出范围脱节 | 导出确认层范围行按 `picked.length` 切「已选」，`POST export/pdf` body 带 `mids` |
| 操作台 | — | 排序 最新 / 待复习优先 / 错次多 | **P1**：无「最早」（清旧账） | `sort=old` 复用 `book-url.js` 白名单 + 后端 `created_at ASC` |
| 落地页/首页 UI | 夸克：AI 助手/拍照搜题/OCR | 首页已有「导出为试卷 PDF」/ AI 问答入口 | 不立项：拍照/OCR 无本站用户诉求证据、超范围 | 登记 |
| 架构 | — | 弹层栈基准 99 vs `--z-overlay` 1000（R520 复采命中） | **P0**：底栏 sheet 内打开的确认层不可点 | 基准运行时读 `--z-overlay`，与 KgSheet 同源 |
| 架构 | — | R519 中文映射只覆盖 `uni.request fail`；H5 `fetch`/SSE 英文 TypeError 直显（R520b 复采命中） | **P1**：真人可见英文报错、且 `isNetMsg` 判不出网络类 | 边界包装 `fetchNet/readNet`，分类口径不扩英文串 |

## 2. 改动清单

- R520（#652 `35bdb32d`）：`backend/app/db.py`（`mistakes_redo_questions mids`）、`study_api.py`（`mids=` 解析/400）、`team.py`（类型收口）、`tests/test_r520_redo_mids.py`；`frontend-uni/src/book-url.js`（`sort=old`）、`pages/book/book.vue`（批量条两键 + 导出范围「已选」+ 排序 chip）、`tests/book-r520-batch-redo-export-sort.test.js`。
- R520b（#654 `8ecbbbf3`）：`frontend-uni/src/modal-policy.js`（`BASE_Z`/`zIndexFor`）、`a11y-focus.js`（读 `--z-overlay`）、`docs/design-system/SPEC.md`、`tests/modal-stack-r520b-overlay-tier.test.js`。
- R520c（#655 `36ed9af1` + `c23ef35f`）：`frontend-uni/src/api.js`（`fetchNet`/`readNet`，四处 fetch + 三处 read）、`api-policy.js`（`failBannerText`）、`pages/ask/ask.vue`（`errorText`）、`tests/api-r520c-h5-fetch-net-fail.test.js`。

## 3. 改后生产读数（375 / 1440，`umst3` 只读数据）

| 用例 | 375 | 1440 | 文件 |
|---|---|---|---|
| 批量条已选 2 → 重练所选 | `GET mistakes/redo?limit=25&mids=2808,2784` → 练习页「刷题 判断推理 1/2」 | 同 | `~/r520/post/batch_*.out` |
| 已选 2 → 导出所选 | 确认层「导出范围 错题本 · 已选 / 题数 2 题」、按钮 347×44 | 同（按钮 1029 起 838 宽） | `~/r520/post/done_*.out` |
| 排序「最早」 | `?sort=old`，前三 `1952/1953/2784` = API `created_at` 升序，reload 保持 | 同 | `~/r520/post/sort_*.out` |
| R520 命中：sheet 内确认层 | `maskZ 100 / popZ 1000 / confirmReachable=false` | 同 | `~/r520/post/batch_*.out EXPORT-CUR-STACK` |
| R520b 改后 | `maskZ 1001 / popZ 1000`，✕/确认/范围行 `hitInside=true`，`POST export/pdf` abort | 同 | `~/r520/post/stackpost_{book,home}_*.out` |
| R520b 命中：导出失败 toast | 「导出失败：Failed to fetch」 | 同 | R520b 复采（见 handoff R520c 节） |
| R520c 改后（书/首页导出） | 「导出失败：网络错误，请检查网络后重试」 `maskZ 1001` | 同 | `~/r520c/post/{book,home}_*.out` |
| R520c 命中：问答页横幅 | 「失败：网络错误，请检查网络后重试，请重试」 | 同 | `~/r520c/post/ask_*.out` |
| `c23ef35f` 改后 | 「失败：网络错误，请检查网络后重试」、sheet/textarea 留存 | 同 | `~/r520c/post2/ask_*.out`、`ask_*_fail.png` |
| `c23ef35f` 导出回归 | 四条路径文案/`maskZ` 不变 | 同 | `~/r520c/post2/{book,home}_*.out` |

全部用例 `pageerror []`；非 GET 全 abort。

## 4. 门

- 前端：vitest **133 文件 / 914**（R519 后 +5 文件 +29 例）、eslint、`lint:tokens`（116 tokens / 6 生成文件一致）、`lint-pages` 0 error（19 warn 存量）、`build:h5`、`git diff --check` 空。
- 后端（R520 有后端改动）：pytest **565**（本轮收口时在 `c23ef35f` 全量重跑）/ ruff / pyright 0。
- Actions 按公司规则保持禁用，本地全绿即门。

## 5. 登记（不改）

- R520-1：夸克拍照搜题/OCR、粉笔直播课/预测分——无本站用户诉求一手证据、超考公 H5 范围，不立项。
- R520-2：`redo mids=` 上限 25 与批量条「全选本页」页大小一致；跨页全选重做未做（无真人批量样本）。
- R520-3：`isNetMsg` 不认英文 `Failed to fetch`/`Load failed`——已在边界归一，若后续有第五处原生 `fetch` 必须走 `fetchNet`（源锁 `not.toMatch(/await fetch\(BASE_URL/)` 会拦）。
- R520-4：`explain/stream` 中途断流路径生产未复现（需真实网络中断），只有单测覆盖。
- R520-5：兄弟 W12 在生产造 `test-w12-*` profile/share 行（`shared_questions`/`user_profile` 无 probe 列），看板需人工剔；建议兄弟回归矩阵先本地。
- R520-6：Lighthouse `/` 单次抖动（a11y 0.94 一次、perf 0.85/LCP 3576 一次）——6b 取样策略仍待定（历轮登记）。
