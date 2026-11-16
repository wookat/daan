# R550：错题本「手录错题」自由录入（免 AI / 不对回题库，`source='manual'`）+ 复习清零小结与强化建议合层、「回错题本」直达（后端+H5+小程序）

日期 2026-09-08 · 前序 R549（`docs/iter/round-3/r549-export-notes-review-next.md`）· 分支 `devin/*-r550-manual-entry`（从合入 #699 后 main 开，rebase 到 `96d73db7`）· 代码 #701 · 本文档 = 研究 + 实修 + 生产复验回填

## 1. 研究（一手证据，先调查再立项）

### 1.1 R549 留下的三候选核实

生产只读 `file:/data/data.db?mode=ro`（`~/r545/q550.py` → `q550.out.txt`，容器内执行，2026-09-08）+ 源码：

| 候选 | 一手数据 | 结论 |
|---|---|---|
| 清零 CTA「回错题本」× 强化推荐层错配 | 源码 H5 `closeCelebrate(){ this.celebrate=false; this.fetchReinforce(); }`、小程序 `onCloseCelebrate → fetchReinforce`，即 CTA 点下去才拉 `/api/reinforce/suggest`，有 `picked` 弹第二层、无 `picked` 弹 success toast「本轮复习完成！」；生产 `reinforce_log` 非测试仅 2 行 / 2 uid（2026-08-09、08-31），`answer_log.source='reinforce'` 5 行 / 1 uid，`growth_events.review_done_celebrate` 3 行 / 3 uid、`review_days` 9 个 uid-日会话中 4 个有错 | 推荐层在真实用户里几乎不转化（3 次清零 / 2 次 reinforce_log），且 CTA 文案与去向不一致——**立项**，作为与 G1 同页的小改一起落 |
| G1 免 AI 自由手录表单 | 源码：H5 FAB「手动录入答案」`manualOpen` → `manualLookup → /api/paper/<code>` → `/api/paper_answers` 判分，小程序工具格「录入答案」同路径；`mistakes` 表列 `id, created_at, module, question_type, question_text, user_answer, correct_answer, methods, error_reason, explanation, review_count, review_streak, next_review, mastered, times, uid, question_id, source, mastered_at`（**无 options 列**）；`question_id IS NULL` 非测试行 28 = 时政 27（每日一练内联）+ 言语 1，`source` 全 NULL，**没有任何行来自自由手录** | 竞品粉笔/夸克均支持手动整理错题；本产品「手动录入」名实不符（R549 UX 走查 G1 P2 坐实）——**立项**，本轮主项 |
| G3 游客首页错题本价值前置 | 71 uid 有作答 / 71 uid 有错题，`uids_answer_no_mistake=0`——所有作答用户都产生了错题，首页叙事「刷题」与「错题」并不排斥 | 属落地页 UI 维度需 UX/UI 出稿，本轮不做（保留候选） |

### 1.2 设计论证（G1）

- **不新增 schema**：`mistakes` 无 options 列，且列表卡/复习卡/PDF 三条既有路径都以 `question_text` 为主体（时政内联题就是「题干 + 换行 + A. … B. …」形态，28 行生产样本），手录选项沿同一形态让用户「连题干一起粘贴，选项一行一个」即可复用全部展示链路；单独建 options 列会引入第四种题源形态，收益低。
- **`question_id=NULL` 全链路口径**（沿用 R5xx 已上线机制，本轮只锁语义）：
  - 复习：`/api/review` 以 `mistakes` 行为单位，内联字段够用；复习卡无 options 时只显 A–D 字母格（既有）。
  - 重练：`/api/mistakes/redo` 对无 `question_id` 且题干对不回时政库的行 **fail-closed 跳过并回 `skipped`**（R5xx 已有），前端 `redoSkippedNote` 已有可见说明——手录题**不参与重练**，表单里明示。
  - PDF：R549 `items[].picked/reason` 内联路径已覆盖 `question_id=null`。
- **服务端校验边界**：`POST /api/mistakes` 是所有题源共用入口（练习自动存 / ask 保存 / 时政内联），只对 `source=='manual'` 加 `manual_mistake.normalize`，其它来源零改动；`question_id` 强制 NULL 防手录体挂到任意题库 id。
- **免 AI**：表单不触发 `/api/ask`、`/api/mistake_analysis`、OCR；埋点 `manual_entry_open/save` 进 `team.py` 白名单（R5xx 教训：新事件名不在白名单静默 400）。

### 1.3 设计论证（清零 CTA）

- 竞品复习完成页都是「小结 + 下一步建议」同一屏；本产品拆成两层且第二层由「回错题本」触发，文案承诺失真。
- 改为：最后一题判定 → 开小结同时预取 `/api/reinforce/suggest`；有 `picked` 时建议卡内嵌小结、主按钮改「强化 5 道新题（未做过）›」、「回错题本」降为次级但**始终一步到列表**；无 `picked` 单一「回错题本 ›」。回包晚于用户关小结则丢弃（`if (!celebrate) return`）。删独立强化 sheet、「下次再说」、关小结误发的 success toast。

## 2. 实修（后端 +~120 / H5 +~330 / 小程序 +~300，含测试；协议向后兼容）

### 2.1 后端

- 新增 `backend/app/manual_mistake.py`：`MANUAL_SOURCE='manual'`、`MANUAL_MODULES={ziliao,shuliang,yanyu,panduan,changshi,时政}`、`MANUAL_REASONS` 复用既有 4 档；`is_manual(rec)` / `normalize(rec)`：uid 必填、模块受限、题干 ≥2 字、正确答案含 A–D（大写去重升序，允许多选）、我的答案选填且 ≠ 正确答案、错因受限、`question_id=None` / `source='manual'` 强制、题干/解析 `\r` 去除 + 逐行 trim + 折叠 ≥3 空行 + 截 2000。
- `study_api.api_save_mistake`：`if manual_mistake.is_manual(rec): rec = normalize(rec)`，`ValueError → HTTPException(400, 中文原因)`。落 `db.save_mistake` 既有去重（同 uid 同题干 → 同 id、`times+1`）。
- `team.py` 打点白名单 + `manual_entry_open`、`manual_entry_save`。
- 测试 `tests/test_r550_manual_mistake.py` 14 例：normalize 各分支 / 截断 / 模块集合 / API 落库 `question_id NULL source manual` / 400 / 同 uid 去重 times / uid 隔离 / 非 manual 来源兼容 / `POST /api/review/{mid}` 可用 / `redo` 回空 + `skipped==1`。

### 2.2 H5

- `src/book-manual-entry.js`：`MANUAL_MODULES / MANUAL_LETTERS / emptyManualEntry / toggleLetter / manualEntryError / manualEntryBody / manualSavedToast`。
- `pages/book/book.vue`：FAB 首项「手录错题」（原卷码功能改名「按卷码录入答案」保留第三项）；`kg-sheet` 表单 = 模块 chips（wrap）/ 题干 textarea（占位示例含选项）/ 正确答案 + 我的答案 A–D 格（我的答案红色点亮）/ 错因 chips / 解析 textarea / 行内 `entryErr` / 「加入错题本」+ 说明「手录题参与复习计划与 PDF 导出，不参与错题重练」；`entrySubmit` → `POST /api/mistakes` → toast（首存 / 再错一次）→ `load()`；列表卡 `source==='manual'` 显「手录」；键盘快捷键守卫 + `entryOpen`。
- 清零合层：见 §1.3；`fetchReinforce` 回包晚于关闭即丢弃；`startReinforce` 同时关小结。
- 测试 `tests/r550-manual-entry-celebrate.test.js`；R519 wrap 源锁更新为「纠错弹层 + 手录模块行」两处 wrap。

### 2.3 小程序

- `utils/manual-entry.ts` 与 H5 同口径 + `letterRow()` 供 wxml 渲染；`api.postManualMistake()`；`Mistake.source?` 类型。
- `pages/book`：工具格 `manual` 改「手录错题」开 `entryOpen` sheet（卷码录入作 sheet 内次级链接「有纸质试卷？按卷码录入答题卡 ›」）；表单/校验/提交/toast/埋点与 H5 一致；列表卡「手录」。
- 清零合层：`celebrate` 弹层内嵌 `.rf-inline` 建议卡 + 三按钮；删独立 `kg-sheet` 强化层与 `onReinforceClose`、success toast。
- 测试 `scripts/manual-entry.test.ts` 12 例；R549 `review-next.test.ts` 源锁按新 `setData` 行更新。

## 3. 本地门（公司规则不启用 Actions）

- 后端 pytest **722**（+14）/ ruff 0 / pyright 0
- H5 vitest **1073**（157 文件，含全量复跑——R549 教训）/ eslint + tokens + edge 0 / build:h5（`index-BPibKz__.js`）
- 小程序 tsc 0 / eslint + tokens 0（20 存量 warning）/ vitest 4 文件 **29**（+12）
- `git diff --check` 空

## 4. 生产发版与黑盒复验

### 4.1 发版 `34bb5207 → 3c3a582d`（#701 代码）

`deploy_h5.sh --skip-build`：谱系闸 OK（线上 `34bb5207` 是本机祖先）；宿主 `other_builds=0` mem_avail 331MB load 1.15，compose 约 90s 收敛 rc=0；线上后端 rev `3c3a582d`、bundle `index-BPibKz__.js` 与本机一致（传播窗口重试 1 次）、7 种 Accept-Encoding 变体均 JS、接口回归全 200；Lighthouse `/` perf 0.93 / a11y 1.00 / LCP 2802ms、`/tiku/` 全 1.00 / LCP 913ms，预算全过。复验期间 #701 由老板侧合入 main `f193a69f`。

### 4.2 黑盒复验（testing agent，rev `3c3a582d` / bundle `index-BPibKz__.js` 开始/结束一致，375×812 + 1440×900，uid `test-r550-4418e8d625` / `test-r550-990e16b2e9`，`~/r550-verify/R550-3c3a582d-production-verification.md` + 录像 `~/screencasts/r550-3c3a582d-production/r550-3c3a582d-production-edited.mp4`）

功能项全部 PASS；testing agent 报的 2 项「FAIL」均为**测试指令写错口径**（把小程序 URL 与「卡片显示错因」当成 H5 规格），核源码后判为既有 H5 约定、非产品缺陷，如实单列：

| 项 | 结果 | 一手证据 |
|---|---|---|
| FAB 首项「手录错题」/ 第三项「按卷码录入答案」 | PASS | `fab-375.png` |
| 客户端校验 4 步文案顺序（模块 → 题干 → 正确答案 → 我的答案=正确答案） | PASS | `validation-{module,question,answer,same}-375.png` |
| 真实表单保存（多行含 A./B./C./D.、正确 B、我的 A、错因「概念不清」、解析）→ 200 id 3530，DB `source='manual'`、`question_id NULL`、题干逐行 trim；首存 toast「已加入错题本…」 | PASS | `manual-first.json`、`manual-details-375.png`、`manual-saved-toast-375.png` |
| 列表卡「手录」标签 + 我的/正确答案 + 展开解析 | PASS | `manual-details-375.png` |
| 卡片本体显示错因 badge | **口径差异（非缺陷）**：H5 列表卡从来不在卡面显示 `error_reason`（错因在「更多操作」chip、错因筛选与本月复盘里，`book.vue` 无卡面 reason 渲染），小程序卡面有 `m-meta-warn`——两端既有差异，本轮未改 | `manual-card-reason-375.png` / `manual-reason-more-375.png` |
| 1440 同题干再存 → 同 id 3530、`times=2`、toast「该题已在错题本，已记为再错一次」 | PASS | `manual-duplicate-toast-1440.png`、`boundary.json` |
| 服务端校验：`module='xx'` / `correct='E'` / 我的=正确 → 3×400 中文 detail | PASS | `server-validation.json` |
| 2500 字题干 → 存 2000 字；答案大小写/重复归一；qid 强制 NULL | PASS | `boundary.json` |
| 埋点 `manual_entry_open`×5 / `manual_entry_save`×4 全 200，`growth_events` 回读 9 行 | PASS | `before-clean.json` |
| uid 隔离（第二 uid 列表/API 无第一 uid 手录题） | PASS | `uid2-isolation-1440.png/json` |
| 手录题**自然到期**复习（未改 DB）：3530/3532 复习卡 A–D 字母格、`POST /api/review/{mid}` 200、`next_review_days=1` | PASS | `manual-review-375.png`、`manual-review-first-1440.png` |
| 手录-only 重练：`items=[]`、`skipped=2`、UI 提示未匹配题库原题，无造题/崩溃 | PASS | `manual-only-redo-toast-1440.png/json` |
| 混合重练（题库 2 + 手录 1）：加载 2 / `skipped=1`，「另 1 题为手录/无题库原题，无法重练」 | PASS | `mixed-redo-375.png/json` |
| 手录-only PDF 实下载：`question_ids=[]`、`items[0].picked='A'/reason='概念不清'`；`pdftotext` 核题干、答案 B、解析、「我的错答 A · 错因：概念不清」 | PASS | `manual-pdf.txt`、`pdf-answer-page.png` |
| 375 sheet 内滚动可达提交、A–D 双列不溢出；1440 表单可用 | PASS | `manual-ready-{375,1440}.png` |
| sheet 打开时 J/K 不切卡（kbf 不变） | PASS（仅 J/K，Playwright 键） | `keyboard-before/after.json` |
| 无建议小结：2 次 review 回包 1 天 → 「明天 2 道」，仅「回错题本 ›」 | PASS | `summary-none-{375,1440}.png` |
| 有建议小结：3 次 review → 「明天 3 道」+ 内嵌考点卡 + 「强化 5 道新题（未做过）›」/「换个考点」/「回错题本」 | PASS | `summary-picked-{375,1440}.png` |
| 换个考点：items 2，基础行程 → 基础排列组合 | PASS | `summary-swap-1440.png` |
| 「回错题本」两分支均一次点击到列表；无旧独立强化层 / 「下次再说」/ success toast | PASS | `summary-{none,picked}-return-1440.png/json` |
| suggest 触发时机：3 次均在复习完成时发出（非点返回后）；request 比标题 DOM 观测早 ≈45ms | PASS（生命周期）/ UNTESTED（严格「先渲染再请求」像素时序，属 Vue 同 tick 状态更新与下一次 patch 的正常差） | `feature-evidence.json` |
| 「强化 5 道新题」：跳 practice 并取 `/api/questions?mode=reinforce&limit=5&module=shuliang&submodule=行程问题&tag3=SL-XC-01`，5 题同考点、与该 uid 已答集合交集 0、UI 1/5 | PASS；「URL 无 `count/source/adaptive` query」为**口径差异（非缺陷）**——H5 `startReinforce` 一贯经 `practiceLaunch` storage 启动，URL query 是小程序写法，测试指令误引 | `feature-evidence.reinforce`、`reinforce-launched-{375,1440}.png` |
| 回归：R549 内联批注/「下次复习」；`rz=` 筛选重练返回保留；未答重练前进/F5 恢复 `redo=1/source=redo` | PASS（抽检） | `regression-*.png/json` |
| 审计 | PASS | 685 请求 / 682 响应 = 679×200 + **3×预期 400**（即上面服务端校验项）；304 0；canceled 3 均图片；console/runtime/rejection 0；browser-log error 3 = 该 3 个 400；146 API 全带 probe；付费 AI/OCR/ask/mistake_analysis 0 |
| 清理与不变量 | PASS | 停录屏→关 context→41 表精确删 31 行（mistakes 5 / answer_log 2 / review_log 6 / reinforce_log 1 / growth_events 16 / practice_progress 1）；独立只读核两 uid + `test-r550-%` 0 残留；全局 `paper_exports` 38→39→38 按 code `37F9AFF8` + created_at + question_ids 精确删；`questions` 156792 / taxonomy / `explain_cache` 82 / `paper_exports` 四类 SHA-256 与 baseline 相等 |

UNTESTED（如实）：1440 独立 PDF 下载（1440 只验确认层，实下载在 375）；完整物理键盘/其它快捷键；mastered、多天间隔、加练去重深分支；混合题库+手录 PDF（本轮 PDF 为手录-only 卷）；小程序/真机/读屏/打印。两宽小结截图来自同一完成链。

## 5. 如实边界

- 手录题**不参与「错题重练」**（redo fail-closed skipped），表单已明示；参与复习计划与 PDF 导出。
- 选项无独立存储，依赖用户按「一行一个」粘贴进题干；复习卡只显 A–D 字母格不显选项文本（与时政内联题一致）。
- 多选答案（如 `AB`）服务端允许、前端 A–D 格可多点亮，但 UI 未特别标注「多选」。
- 小程序改动仍属 R536-1 累计待真机上传范围，仅代码对齐 + 源锁。
- 仓库无环境蓝图且本会话无蓝图权限。

## 6. 证据索引

- 研究：`~/r545/q550.py` + `q550.out.txt`
- 代码：#701
- 发版：本会话 `deploy_h5.sh` 输出（rev `3c3a582d`，bundle `index-BPibKz__.js`）
