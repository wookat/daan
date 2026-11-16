# R525 取证：错题本「导出所选」对 NULL-qid 时政行的 PDF 内容口径（本地真生成 → 命中答题卡串槽 → 实修上线）+ 复习答错后「同类题自动加练」对 `_sz` 行的池口径（fail-closed 成立，不改）

日期 2026-09-08（UTC 04:56–05:30Z）。生产 `77611f96` → `5d999920`（05:22:04Z）。代码 1 commit（后端 `pdf_export.py` + 前端 `export-confirm.vue` / `book.vue` + 源锁 2 文件）。生产 0 写入（非 GET 全 abort、库 `mode=ro`、`paper_exports` 发版后 0 新行、Caddy 09-08 `/api/export/pdf` 0 条）。**生产未生成过任何 PDF**——PDF 内容证据全部来自本地 `:8525` 服务真生成。

## 0. 结论

| # | 项 | 结论 | 证据等级 |
|---|---|---|---|
| 1 | 「导出所选」对 NULL-qid 时政行的请求形态 | `book.vue exportSelected()`：有 `question_id` 的进 `question_ids`，`!question_id && question_text` 的进 `items[{module,question,answer,analysis}]`（R520 起就如此）；后端 `/api/export/pdf` 用 `db.questions_by_ids(question_ids)` + 直接拼 `items` → 时政题**进正文 / 参考答案 / 解析**，来源标「时政」，`paper_exports.question_ids` 只存有 id 的题。本地 375 混选（普通 1 + 时政 1）与 1440 全时政 UI 真导出各 200、toast「PDF 已开始下载」、`paper_exports` 落 `[110]` / `[]`；生产 375 时政筛选态 3 题 / 1440 混选 6 题 / 1440 纯普通 4 题的 `POST export/pdf` 请求体（abort 前抓）与本地同形态 | 本地一手（真 PDF）+ 生产只读（请求体） |
| 2 | **命中**：机读答题卡把无 id 的内联题也占了槽位 | 改前本地 `mix.pdf`（3 页）答题卡第 2 槽 `2 [空条码] A B C D` 就是时政题，而 `paper_exports.question_ids=[110]` 只有 1 个 id → `scan_sheet`/`paper_answers` 按槽位对回时**槽 2 无题可对**（越界/串题）；改前全时政 `sz.pdf` 3 页里第 1 页是**只有 1 个空条码槽的空答题卡**，`question_ids=[]` → 任何涂写都对不回。根因：`build_paper_pdf()` 对 `questions` 全量出槽，不区分有无 `id` | 本地一手（改前 PDF） |
| 3 | 修法（最小、契约不变） | `pdf_export.sheet_questions(questions)` → `[(卷内题号, q) for q if q.get('id')]`：答题卡只放有 id 的题、槽位顺序与 `save_paper_export` 存的 `question_ids` 同序、**保留原卷内题号**（正文/答案页题号不变，机读槽标号 = 卷内题号，不重编）；全内联卷不出答题卡页；卷首 meta 注明「答题卡 N 题（时政/手录题 M 题不参与机读判分，请对照参考答案核对）」或「本卷均为时政/手录题，无机读答题卡…」；导出确认层 `sheetless` prop 同口径（「其中 M 题（时政/手录）不上机读答题卡…」/「所选均为时政/手录题，无机读答题卡…」，仅答案/关答题卡时不显示）。`question_ids`/`items` 请求契约、`paper_exports` 写入、`scan_sheet`/`paper_answers` 读取均未动 | 源码 + 源锁 |
| 4 | 改后本地 PDF | 混合 `post_mix.pdf` 3 页：答题卡只有 `1 CS-DLGQ-000110 A B C D`，正文「1. [CS-DLGQ-000110] …」「第二部分 时政 2. R522本地：…」，参考答案 `1. B 2. C` + 两条解析，卷首「共 2 题 … 答题卡 1 题（时政/手录题 1 题不参与机读判分…）」；全时政 `post_sz.pdf` **2 页**（无答题卡页）：卷首「本卷均为时政/手录题，无机读答题卡…」、正文 1 题、答案 `1. C` + 解析 | 本地一手（真 PDF） |
| 5 | 复习答错后「同类题自动加练」对 `_sz` 行 | `review-similar.js hasSimilarPool(m)` 只认 `MODULE_KEYS` 五模块；`appendSimilar()` 命不中就不请求。本地一手：时政 NULL-qid 到期项复习答错 → `SIMILAR_BTN False`（「看讲解」仍在）、`QUESTIONS_REQS []`、errs []；对照普通 `changshi` 到期项答错 → `SIMILAR_BTN True`、`GET /api/questions?limit=2&module=changshi&submodule=…` 200 有题。**R514/R515 的 fail-closed 已覆盖 `_sz`，不是 R524 那类死入口，不改** | 本地一手（两路对照） |
| 6 | 发版后 (c) / 到期项 | R525 容器窗（05:22:04Z→05:25Z，116 请求）5xx / assets 404 / monitor / mpUA / 非探针 POST / 401·403 / Traceback 全 0；R524 容器窗（04:52:15Z→05:03Z，234 请求）同全 0；WAL `4,173,592` 同字节；probe=0 各表同 R524；`reinforce_log` 2/2；`umst3` 四表 32/45/22/1 新增 0、`mistake 1953/2784/2914/2915` 不变；`paper_exports` 38 行、05:22Z 后 0 新行；发版后任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0 新行 | 生产只读 |
| 7 | 09-08 源站 503 = 75 条的归属（补账） | Caddy 09-08 全部 503 落在 `00:28`（34）/ `00:29`（38）/ `01:03`（3）三分钟，路径全是簇的 `/tiku/q/*`、时长 ≈26 s；对上宿主 `/tmp/kg-compose-94803e0b-20260908T001450Z.log`（`KG_COMPOSE_EXIT rc=0 at 00:29:15Z`，build 14.5 min）与 `/tmp/kg-compose-de94fde-20260908T010222Z.log`（`rc=0 at 01:03:49Z`）两次**R519 之前**的重建收尾窗——即 R469 §4 登记的「重建窗 5xx」形态，R519–R525 七次发版重建窗均 0。归属重建窗是时序对齐推断（无请求级 upstream 错误字段），非内核 OOM 证据（本轮未查 `journalctl -k`） | Caddy + compose 日志只读 + 推断 |
| 8 | 簇 | 09-07 终值 1445/1443；09-08 至 05:25Z 5074 行 / 5010 IP（15.6 行/分、峰 97、UA 14、每 IP ≤2、无 >120 s 间隙、其中 503 72 条即 §7）仍在跑；日报 05:23Z `humans.page 09-08 4925 / ips 4863` 基本全簇 | Caddy 只读 + 特征推断 |

## 1. 设计论证（先于改码）

- 事实链：`exam_api.api_export_pdf()` → `questions = db.questions_by_ids(question_ids) + items`（内联题无 `id`）→ `save_paper_export(code, title, [q['id'] for q in questions if q.get('id')])` → `build_paper_pdf(questions, …, answer_sheet=True)`；`scan_sheet` / `paper_answers` 读 `paper_exports.question_ids` 按**槽位 i → question_ids[i]** 对答案。改前 `_omr_sheet_pdf(questions, …)` 对全部 `questions` 出槽 → 含内联题时槽数 > `question_ids` 长度，第 k 个内联题之后的普通题槽位整体错位（本地 mix.pdf：槽 2 是时政题，`question_ids=[110]` 只有槽 1；若顺序是时政在前，普通题会落到槽 2 而 `question_ids[1]` 不存在）。这是**机读判分契约**层面的串槽，不是排版问题。
- 三选：(a) 给时政题造一个 `questions` 域 id 进 `question_ids`——`shizheng_questions.id` 与 `questions.id` 撞号（R483/R521 反复核过），否决；(b) 内联题不进 PDF——用户勾选导出的题消失，违背 R520「导出所选」语义，否决；(c) **内联题进正文/答案、不进机读答题卡**，槽位与 `question_ids` 同序、保留卷内题号、卷首与确认层明示 → 采纳。全内联卷不出答题卡页（改前会出一页只有空条码槽的答题卡，任何涂写都对不回）。
- 题号：不重编——正文/答案页题号是用户对照参考答案的锚点；机读槽的标号沿用卷内题号（混合卷答题卡会「跳号」，卷首 meta 已解释），`scan_sheet` 只看槽位不看标号，契约不受影响。
- 前端口径与 PDF 同源：`book.vue exportSheetless = exportList.slice(0,100).filter(!question_id && question_text).length`，与 `exportSelected()` 拼 `items` 的谓词逐字相同；`export-confirm.vue sheetlessNote`：`only || !withSheet || sheetless<=0` → 空；`count!=null && sheetless>=count` → 「所选均为…」；否则「其中 M 题…」。首页导出入口（`question_ids` 全有 id）不传 `sheetless` → 无提示、不变。
- 源锁：后端 `tests/test_r525_export_sheet_inline.py` 5 例（混合卷槽位只含有 id 题且顺序=`question_ids` / 全内联无答题卡页 / 全普通不变 / 关答题卡不变 / 保留卷内题号）；前端 `tests/book-r525-export-sheetless-note.test.js`（`sheetlessNote` 五分支 + `exportSheetless` 与 `items` 过滤谓词同串源锁）。

## 2. 改动

- `backend/app/pdf_export.py`：`sheet_questions()`；`build_paper_pdf()` meta 追加不参与机读判分题数、`answer_sheet and … and sheet_rows` 才追加答题卡页；`_omr_sheet_pdf(rows: list[tuple[int, dict]], …)` 槽标号取卷内题号。
- `frontend-uni/src/components/export-confirm/export-confirm.vue`：`sheetless` prop + `sheetlessNote` computed + `.opt-note.sheetless` 一行。
- `frontend-uni/src/pages/book/book.vue`：`exportSheetless` computed → `:sheetless`。
- 未改：`/api/export/pdf` 请求/响应契约、`paper_exports` 写入、`scan_sheet`/`paper_answers`、`review-similar.js`、小程序端（无导出入口，`grep export/pdf miniapp-native` 0）。

## 3. 本地一手（`DB_PATH=~/r525/app.db` uvicorn `:8525`，uid `r522local`：`mistakes` 2 行 = 时政 NULL-qid（id 2）+ 普通 `changshi` qid 110（id 3））

- 改前 PDF（直接 `curl POST /api/export/pdf`）：`~/r525/mix.pdf`（`question_ids:[110] + items:[时政 1]`，3 页，答题卡 `1 CS-DLGQ-000110 A B C D` / `2 A B C D`，卷码 `0A331F28`）；`~/r525/sz.pdf`（`question_ids:[] + items:[时政 1]`，3 页，第 1 页答题卡只有 `1 A B C D` 一槽，卷码 `14FA1B71`）。
- 改后 UI 导出（`~/r525/local_export_sel.py <W> [sz_only]`，本地放行 POST）：375 混选 `post_375.out`——批量条「已选 2」→ 确认层「题数 2 题 … 其中 1 题（时政/手录）不上机读答题卡」→ `POST export/pdf {"question_ids":[110],"items":[{"module":"时政","question":"R522本地：…\nA.甲 B.乙 C.丙 D.丁","answer":"C","analysis":"本地解析"}],"include_answers":true,"answer_sheet":true,"include_questions":true}` 200 → toast「PDF 已开始下载」→ `paper_exports (0A331F28, '[110]')`；1440 全时政 `post_1440_szonly2.out`——确认层「所选均为时政/手录题，无机读答题卡，请对照参考答案核对」（截图 `export_1440_szonly_confirm.png`）→ 200 → `paper_exports (14FA1B71, '[]')`；errs [] 两路。
- 改后 PDF 内容（同请求体 curl 落盘 + `pdftotext`）：`post_mix.pdf` 3 页——卷首「共 2 题 · … · 卷码 0A331F28 · 答题卡 1 题（时政/手录题 1 题不参与机读判分，请对照参考答案核对）」；正文「1. [CS-DLGQ-000110] 下列节气中…」「第二部分 时政 2. R522本地：…A.甲 B.乙 C.丙 D.丁」；答案页「1. B 2. C」+「1. 答案 B 夏至…」「2. 答案 C 本地解析」；答题卡仅 `1 CS-DLGQ-000110 A B C D`。`post_sz.pdf` 2 页——卷首「共 1 题 · … · 卷码 14FA1B71 · 本卷均为时政/手录题，无机读答题卡，请对照参考答案核对」、「第一部分 时政 1. …」、「1. C」+ 解析，无答题卡页。
- UI 侧 Playwright `response.body()` 对下载响应得 0 bytes（浏览器已消费），故 UI 只断 200/toast/落库，PDF 内容用 curl 同体落盘核。
- 复习加练对照（`~/r525/local_sz_review_wrong.py <W> <mid>`，把该 mid 置到期、其它推后 5 天）：`review_sz_375.out` mid 2（时政）——复习卡「复习 1/1 … R522本地：… A B C D」→ 选错 → `SIMILAR_BTN False | 看讲解 True`、`QUESTIONS_REQS []`、errs []；`review_cs_1440.out` mid 3（changshi）——`SIMILAR_BTN True`、`GET questions?limit=2&uid=r522local&module=changshi&submodule=地理国情…` 200 `items:[{id:2543,…}]`、errs []。截图 `review_wrong_2_375.png` / `review_wrong_3_1440.png`。

## 4. 生产只读复采（`~/r525/prod_export_sel.py <W> <sz|all> [maxpick]`，`umst3`，`X-Kg-Probe: 1`，非 GET 全 abort，硬加载新 bundle）

- 375 时政筛选态 `prod_375_sz.out`：bundle `index-DPwKQFih.js`（= 本机 dist）；chip「时政」→ 9 张卡全「时政 今日待复习」→ 批量勾 3 → 「全选本页 已选 3 …」→ 导出所选 → 确认层「题数 3 题 … 导出题目 + 答案解析 + 机读答题卡 **所选均为时政/手录题，无机读答题卡，请对照参考答案核对**」（`.opt-note.sheetless` 347×17 @ (14,659)，12px）；切「仅答案」提示消失（`NOTE_ONLY False`）；确认 → `POST export/pdf {"title":"错题重练卷 9月8日","question_ids":[],"items":[{"module":"时政","question":"关于中国队在米兰-科尔蒂纳冬奥会的参赛规模…\nA.… D.…","answer":"A","analysis":"…"},…×3]}` **abort** → toast「导出失败：网络错误，请检查网络后重试」（R520c 口径）；GET 非 200 []；errs []。截图 `prod_export_375_sz_confirm.png` / `_after.png`。
- 1440 全部筛选混选 6（普通 5 + 时政 1）`prod_1440_mix.out`：确认层「题数 6 题 … **其中 1 题（时政/手录）不上机读答题卡，请对照参考答案核对**」（1029×17，12px）；abort 体 `question_ids:[162861,166250,166248,166247,296322], items:[{"module":"时政",…}]`；errs []。截图 `prod_export_1440_mix_confirm.png`。
- 1440 纯普通 4 `prod_1440_all.out`：确认层无 sheetless 提示（`SHEETLESS_NOTE null`）；abort 体 `question_ids:[162861,166250,166248,166247], items:[]`（既有路径不变）；errs []。（该次 `_confirm.png` 被后一次 mix 复跑同名覆盖，文本读数在 `.out`。）
- 生产未真下载：abort 后 UI 失败态只证明「到达处理函数 + 请求体形态」；`paper_exports` 05:22Z 后 0 新行、Caddy 09-08 `/api/export/pdf` 0 条（含 probe）。

## 5. 发版（`~/r525_deploy.log`）

- 预检：`mem_avail=320MB disk_avail=5.5G(89%) load=0.77 other_builds=0 prunes=0`；谱系闸「线上 rev 77611f96 是本机 HEAD 的祖先」。
- compose：`poll rev=77611f96` ×5 → `rev=5d999920 started=05:22:04Z compose_rc=0`（`/tmp/kg-compose-5d999920-20260908T052044Z.log`，~1.5 min）；`4a` 线上后端 = 本机；5/6 线上 bundle 首轮 `index-B-fpyXVB.js`（传播窗）→ 5 s 后 `index-DPwKQFih.js` OK；5b 七种 Accept-Encoding 全 `application/javascript`；6/6 七路 200；6b `/` perf 0.99 / LCP 1405 / CLS 0.06、`/tiku/` 1.00 / 987 / 0.00 全 OK；`DEPLOY_RC=0`。发版后容器 healthy 0 重启、load 0.28、MemAvailable 319 MB。
- 门：vitest 135 文件 / 919、eslint、lint:tokens、lint-pages 0 error / 19 warn 存量、build:h5（`~/r525/fe_gates.out`）；pytest 573 / ruff / `npx -y pyright app` 0；`git diff --check` 空。GitHub Actions 按公司规则保持禁用。

## 6. 读数（`~/r525/r525_pre.out` 05:03Z / `~/r525/r525_post.out` 05:25Z）

| 项 | 前（R524 容器 04:52:15Z→05:03Z） | 后（R525 容器 05:22:04Z→05:25Z） |
|---|---|---|
| 请求 / 5xx / assets404 / monitor / mpUA / 非探针 POST / 401·403 / Traceback | 234 / 0 / 0 / 0 / 0 / 0 / 0 / 0 | 116 / 0 / 0 / 0 / 0 / 0 / 0 / 0 |
| 非探针非 bot（全簇） | 187 / 187 | 70 / 70 |
| WAL | 4,173,592 | 4,173,592 |
| probe=0 answer_log / growth / explain_cache qid / error_reason ≥09-11 / push_subs | 53,2 / 26,4 / 0,82 / 0 / 0 | 同 |
| reinforce_log 行 / uid | 2 / 2 | 2 / 2 |
| umst3 mistakes / answer_log / growth / review_log | 32 / 45 / 22 / 1 | 同 |
| paper_exports 总 / 05:22Z 后 | — | 38 / 0 |
| 簇 09-08 | 4734 / 4672 IP | 5074 / 5010 IP |
| 日报 humans.page / ips 09-08 | 3957 / 3903（04:23Z） | 4925 / 4863（05:23Z） |

（R524 容器窗 05:03Z→05:22Z 一段未单独统计，落在 09-08 日总量内；该段 5xx 由 §0-7 全日 503 分钟分布反证为 0。）

## 7. 登记 / 如实

- **R525-1（P3，不改）**：混合卷机读答题卡槽标号沿用卷内题号会「跳号」（如 1、3），卷首 meta 已说明；若 UX 要求连续编号需同时改 `scan_sheet` 槽→题映射，不点头不做。
- **R525-2（P3，登记）**：09-08 00:28–00:29 / 01:03 两段重建收尾窗 75 条 503（全簇 `/tiku/q/*`，≈26 s）属 R469 §4 已登记的「重建窗 5xx」形态，两次均在 R519 之前（compose `94803e0b` build 14.5 min、`de94fde`）；R519–R525 七次发版重建窗 0。宿主级方案仍待定。
- R524-1 / R521-1 仍待产品/UX 定。
- 如实：PDF 内容证据全部本地合成（uid `r522local`，`shizheng_questions` 种子撞 `questions.id 141` 的两域隔离沿 R522）；生产只抓请求体与确认层文案，**未生成生产 PDF、未写 `paper_exports`**；`scan_sheet` 对新答题卡的实拍回读未做（源锁按 `question_ids` 同序断言）；生产 1440 纯普通路径确认层截图被同名覆盖只剩文本读数；复习加练对照仅本地（生产未提交复习）；本机 CDP `X-Kg-Probe: 1` 非真机 RUM；0 LLM、0 写入；簇归因与 503 归属均为特征/时序推断；无 testing agent 录屏（未另行授权）；仍无可确认外部真人导出/复习/加练者。
