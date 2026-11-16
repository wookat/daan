# R549：错题本 PDF 导出附「我的错答/错因」+ 复习清零小结「下次复习」排期与「回错题本」CTA（H5+小程序）+ `wd-segmented` H5 resize 重测滑块

日期 2026-09-08 · 前序 R548（`docs/iter/round-3/r548-redo-pending-resume.md`）· 分支 `devin/*-r549-export-mistake-notes-review-next`（从合入 #694 后 main `4e8cdf3c` 开）· 代码 #695 · 本文档 = 研究 + 实修 + 生产复验回填

## 1. 研究（一手证据，先调查再立项）

### 1.1 R548 留下的三候选：核实结论均「不立项」

生产只读 `file:/data/data.db?mode=ro`（`~/r545/q549*.py`，容器内执行，2026-09-08）：

| 候选 | 一手数据 | 结论 |
|---|---|---|
| 复习页/历次作答消费 `secs` | `review_log` 38 行，R546 上线后仅 1 行 `secs>0`（29s）；`answer_log` 近 644 行中 547 行 `secs>0`、均值 18.76s；历次作答 R544 起已展示「用时」 | 复习 secs 生产样本不足以支撑新 UI（1 行），已有展示链路够用；不立项 |
| 常识 taxonomy 别名内容侧 | 非测试常识错题 63 行 / 30 uid，`submodule` 分布：历史人文 17、科技 16、政治 11、法律 9、地理国情 6、经济 3、管理文档 1，**全部**落在现有 taxonomy 规范名 | 生产无别名漏网样本；不立项 |
| 每日一练 `source` 打点 → 再核 `mid` | `answer_log.source`：NULL 1249 / direct 85 / exam 16 / session-report 10 / share 8 / **redo 6** / reinforce 5 / link 4 / seo 2 / search 1；每日一练无独立 source 值可区分 | R548 `source='redo'` 首批 6 条真实样本已落地（可作后续分析基线）；每日一练 mid 仍无证据面，不立项 |

### 1.2 生产 UX 走查（testing agent，rev `9b4a511c`，375/1440，uid `test-r549-ux-*`，`~/r549-ux/R549-UX-report.md`）

对标粉笔错题本/夸克公开口径逐项走：游客首页、练习出错入本、到期复习→小结、手动录入、PDF 导出、讨论、时政每日练。无 P1。

| # | 级别 | 差距 | 一手证据 |
|---|---|---|---|
| G1 | P2 | 「手动录入答案」实为卷码答题卡关联（`manualLookup → /api/paper/<code>`），没有免 AI 的「题干+选项+答案+错因 → 入本」自由手录表单 | `manual-validation.json` toast「请输入卷码」、无 `/api/paper/` 请求；AI 页保存动作是「用花生十三方法讲解」 |
| G2 | P2 | PDF 导出参考答案页只有标准答案/解析，用户已归因的 `error_reason`（「粗心大意」）与自己的错选 `user_answer` 不进纸面 | `PATCH /api/mistakes/3459 {error_reason:"粗心大意"}` 200 → `POST /api/export/pdf {question_ids:[…]}` 200，`pdftotext` 全文无「粗心大意」；`request-evidence.json` |
| G3 | P3 | 游客首页主叙事「10万+ 行测题免费刷」，错题闭环只在副文案/底 tab | `pages-home-home.*.js` `value:"10万+"`、主按钮 `startDaily`；1440 已是多栏非拉宽手机页 |
| G4 | P3 | 复习 3/3 清零小结统计完整（3 次 `POST /api/review/:id` 均 `{streak:1,next_review_days:1}`），但 CTA「太棒了，继续 ›」只是 `closeCelebrate`，不说去哪、小结不呈现下次时间 | `review-summary-*.png`；`/api/reinforce/suggest` 200 `{items:[],picked:null}` 无推荐，不是推荐坏了 |
| G5 | P3 候选 | 讨论页排序 `wd-segmented` 375→1440 resize 后白底滑块偏左，同宽 F5 对齐；只观察一组差分，**不声称所有桌面首访复现** | `discussion-1440.png` vs `discussion-fresh-1440.png`；部署 `wd-segmented.*.js` 只在 mounted/value 变化测量，无 resize 订阅 |

### 1.3 本轮取舍

- **做**：G2（P2，纯数据带出，H5+后端小改，闭环价值最高）、G4（P3，服务端已返 `next_review_days`，前端消费即可，H5+小程序同口径）、G5（P3，`wd-segmented` `defineExpose({updateActiveStyle})` 已暴露，接 `uni.onWindowResize` 即可，仅 H5）。
- **不做（留 R550+）**：G1 自由手录表单需要 authoring UX + `question_id=null` 卡片全链路（重练/复习/导出）设计论证，单轮塞不下且不该草率；G3 首页叙事属落地页 UI 维度，需 UX/UI 协作出稿。
- 竞品口径核：粉笔错题本导出支持带「我的答案」；夸克强调提取后编辑整理。G2 对齐前者、G1 对齐后者。

## 2. 实修（后端 +72 / H5 +~330 / 小程序 +~60，含测试；协议向后兼容）

### 2.1 PDF 个人批注（G2）

```
POST /api/export/pdf  body +=
  mistakes?: { [question_id]: { picked?: "A"|"AB"…, reason?: str } }   # 题库题
  items[].picked? / items[].reason?                                     # 手录/时政无 question_id 的内联题
```

- `pdf_export.mistake_note(raw)`：`picked` 取 `[A-F]+` 去重升序、`reason` 折叠空白截 `NOTE_REASON_MAX=24`、都空 `{}`；`parse_mistake_notes` 丢非法键/非 dict/空批注、最多 140；`note_text(q)` → `我的错答 A · 错因：粗心大意`。
- 参考答案页：`<b>n. 答案 X</b>　<font #C0392B>批注</font>　解析`；无解析但有批注也进解析段；卷首 meta `· n 题附我的错答/错因`（仅 `include_answers`）。**不带 `mistakes` 时输出与修前逐字一致**（测试锁）。
- 信任模型：批注来自请求方自己错题本的 `user_answer/error_reason`（与既有 `items` 内联题干同模型），服务端**不按 uid 查他人数据**，`paper_exports` 不落批注；恶意体最多让自己的 PDF 多一行红字。
- H5：`export-confirm.vue` 新 prop `reviewable` → chip「含我的错答/错因」（默认开；依赖含解析或仅答案，打开时自动勾上含解析）→ emit `with_notes`；`book-export.js exportNote(m)`（错选 == 标准答案不算错答）/ `exportNotesMap(list)`；`book.vue exportMistakes` 剥 `with_notes` 后分别落 `mistakes` 与 `items[].picked/reason`。首页/试卷导出不传 `reviewable`，行为不变。

### 2.2 清零小结排期 + CTA（G4）

- H5 `review-summary.js nextReviewText(rItems)`：每题 `POST /api/review/:id` 回的 `next_review_days` 落 `cur._nextDays`；聚合 → `下次复习：明天 2 道 · 3 天后 1 道`；同题重出（`_requeued`）以最后一条为准、`_mastered` 不排期、加练 `_extra` 不计、无样本 `''` 不渲染。CTA `太棒了，继续 ›` → `回错题本 ›`。
- 小程序 `utils/review-verdict.ts nextReviewText` 同口径；`RItem.nextDays`、`celebrateNext`、`book.wxml` CTA「回错题本」。

### 2.3 `wd-segmented` resize（G5）

- `seg-resize.js segResizeMixin`（`#ifdef H5`）：`uni.onWindowResize` 防抖 120ms → `$refs.seg.updateActiveStyle(false)`，`beforeUnmount` `offWindowResize`。
- 接入仓库内全部 6 个 `wd-segmented` 页面（discuss / favorites / shenlun / login / exam list / mastery-map，`ref="seg"`；`pkgA/dev/design` 设计稿页除外），测试用 `git ls-files` 枚举防漏网。生产只在讨论页复现，其余同组件同机制预防性接入。

## 3. 本地门（公司规则不启用 Actions）

- 后端 pytest 692（+14 `tests/test_r549_export_mistake_notes.py`）/ ruff 0 / pyright 0
- H5 vitest：#695 提交时只跑了专项（`r549-export-notes-review-next` 9 + `r549-seg-resize` 5）与两个改过的源锁，**全量未复跑**——事后全量发现 `book-r541-review-mastered-verdict` 小程序 `book.ts` import 锁未随 `nextReviewText` 更新（1 红），#696 补齐后 155 文件 1058 全绿；eslint + tokens + edge 0 / build:h5（`index-BfI_81xM.js`）
- 小程序 tsc 0 / eslint + tokens 0（20 存量 warning）/ vitest 3 文件 17（+`scripts/review-next.test.ts`）
- `git diff --check` 空

## 4. 生产发版与黑盒复验

### 4.1 发版 `9b4a511c → 8dc0c4b0`（#695 代码，`~/r549/deploy.log` + `deploy-resume.log`）

- 宿主同时有 3 个其他产品的 compose build（`other_builds=3`，mem_avail 215–418MB，load 8–17），本项目 compose 600s 内未收敛 → 脚本按设计 FAIL 退出但 setsid 的 compose 继续；约 20 min 后 `KG_COMPOSE_EXIT rc=0`、`/api/health rev=8dc0c4b0`；`DEPLOY_RESUME=1` 续跑 4a–6：CF Pages 上线、线上 bundle `index-BfI_81xM.js` 与本机一致、7 种 Accept-Encoding 变体均 `application/javascript`、接口回归全 200。
- Lighthouse：部署时 `/` perf 0.83 / LCP 3700ms 违例（WARN 不阻塞），容器刚重建 + 宿主 load 9；独立重跑 `~/r549/lh-home-rerun.log` `/` perf 0.92 / LCP 2693ms / a11y 1.00，`/tiku/` 全 1.00 —— 判瞬时，与 R545/R546 同形态。
- 复验中途 #695 由老板侧合入 main `39e92b63`。

### 4.2 黑盒复验中途坐实 1 处交互 bug → #696

375 导出确认弹层：默认「含我的错答/错因」亮 → 关「含解析」→ chip 灭（`withNotes` 依赖 `withAns`）→ **单击 chip 仍灭**（旧 `toggleMine` 只翻 `withMine`，内部 `true→false`），需点两次。修为 `this.withMine = !this.withNotes`（按亮灭翻转）；测试改用真实 `withNotes` getter 驱动的状态机并新增该用例（旧组件红、新组件绿）。复验按「点两次」workaround 继续，避免中途换 rev 证据漂移。

### 4.3 复验结果（testing agent，rev `8dc0c4b0` / bundle `index-BfI_81xM.js` 开始/结束一致，375/1440，uid `test-r549-verify-*`，`~/r549-verify/R549-8dc0c4b0-production-verification.md` + 录像 `~/screencasts/r549-8dc0c4b0-production/`）

| 项 | 结果 | 一手证据 |
|---|---|---|
| A① 导出确认 chip：默认亮、关含解析后灭、文案联动 | PASS | `export-default-375-viewport.png` |
| A① 灰态**单击**恢复 | **FAIL**（→ #696） | `export-chip-oneclick-fail-375-viewport.png`；第二次点击才亮（`export-chip-secondclick-375-viewport.png`，workaround 非修复） |
| A② 真实错题（UI 练习错选 B / A，标准 D；mistake 3462 UI 设「粗心大意」、3463 无错因）→ 导出请求含 `mistakes` → `notes-375.pdf` `pdftotext` | PASS | 机读卡 + 两题题干/标准答案/解析仍在；`我的错答 B · 错因：粗心大意`、无错因题仅 `我的错答 A`、卷首「2 题附我的错答/错因」；`request-evidence.json` |
| A③ 关 chip 对照 | PASS | 请求无 `mistakes`，`no-notes-375.pdf` 全文无「我的错答」，其余内容保留 |
| A④ 1440 确认层 + 下载 | PASS | `notes-1440.pdf` 同两题批注 + 卷首计数 |
| A⑤ `question_id=null` 内联题（真实时政每日一练 UI 错答 → mistake 3464，UI 设错因） | PASS | 请求 `items[0].picked="B"/reason="粗心大意"`，`inline-1440.pdf` 批注在参考答案页 |
| B 清零小结：3 题到期（1 题先错重出再对）+ 2 题加练，4 次 `POST /api/review/:id` 均 `next_review_days=1` | PASS | 「下次复习：明天 3 道」（按 mid 去重、加练不计）、双宽同一完成链截图 `review-summary-{375,1440}-viewport.png`；`review-posts.json` |
| B CTA 文案「回错题本 ›」 | PASS | — |
| B CTA 一步直达列表 | **FAIL（既有 UX 边界，非本轮回归）** | 本轮复习有 1 错 → 点 CTA 先弹既有「本轮复习完成！趁热打铁强化一下？」强化推荐层（R5xx 早期功能），点「下次再说」才见列表；`review-cta-followup-375-viewport.png` |
| C 讨论页 / 收藏页 375↔1440 正反 resize（CDP 同页 viewport）+ 同宽 F5 对照 | PASS | 滑块与选中项矩形误差 0px；另做 OS 真实拖动 568→655→1004→1352 宽最终对齐；`discuss-resize-1440-viewport.png` |
| D 回归：首页/试卷导出无 chip、请求无 `mistakes`；`?mod=yanyu` F5→切统计→回 2→2；未答重练后退/前进/F5 恢复同两题 `redo=1/source=redo` | PASS | `home-regression-1440.pdf` / `paper-regression-1440.pdf` |
| E 审计（关 context 后最终计数） | PASS | 1023 响应 = 1004×200 + 19×304；4xx/5xx 0、canceled 2（均图片）、console/runtime/rejection 0；198 API 全带 probe；付费 AI/OCR 0 |
| F 清理与不变性 | PASS | 41 表精确删 16 行（mistakes 3 / answer_log 3 / review_log 4 / growth_events 6），独立只读 uid + `test-r549-verify-%` 0 残留；全局 `paper_exports` 38→42→38 按 code/created_at/question_ids 精确删 4（`paper-allowed.json`）；`explain_cache` 82 行 / latest `1788730850.6344447` / SHA-256 `6f65d129…3039f9973` 不变；未改 questions/taxonomy |

### 4.4 #696 发版与 A① 抽检

- `deploy_h5.sh --skip-build` `8dc0c4b0 → cdbdf8b0`（bundle `index-xk9SI9P3.js`，`~/r549/deploy-696.log`，回归全 200，Lighthouse `/` 0.97 / LCP 1771ms、`/tiku/` 全 1.00）。
- 抽检开始前老板侧 W14 #697 再发版 `34bb5207`（bundle `index-DcRpFrOn.js`）；`git diff cdbdf8b0 34bb5207` 核 R549 全部文件无差（仅 `exam_api.api_scan_sheet` OMR 路径 threadpool 化，与本轮无关）→ 抽检改在 `34bb5207` 上进行，结果见 §4.5。

### 4.5 A① 抽检结果（testing agent，rev `34bb5207` / bundle `index-DcRpFrOn.js` 开始/结束一致，uid `test-r549-fix-a7902d9354`，`~/r549-verify/R549-34bb5207-spot-A1.md` + 录像 `~/screencasts/r549-34bb5207-spot-A1/`）

| 项 | 结果 | 一手证据 |
|---|---|---|
| 真实练习 UI 错选 B → 自动生成 1 道错题 | PASS | — |
| 375 / 1440：默认两 chip 亮 → 关「含解析」→ 两 chip 灭 | PASS | — |
| 375 / 1440：灰态**单击一次**个人 chip → 立即亮且「含解析」同时亮，说明 `+ 答案解析 + 我的错答/错因` | **PASS（#696 修复生效）** | `spot-34bb5207/oneclick-{375,1440}-viewport.png` |
| 375 / 1440：再单击 → 个人 chip 灭、「含解析」保持开 | PASS | `spot-34bb5207/mineoff-{375,1440}-viewport.png` |
| 375「仅答案」：分别以 `withAns=true/false` 进入，个人 chip 亮/灭切换不改 `withAns` 原值，退出后交叉确认 | PASS | `spot-34bb5207/only-false-{on,off}-viewport.png` |
| 审计 | PASS | 359 响应 = 352×200 + 7×304；4xx/5xx/canceled/console/runtime/rejection 0；36 API 全带 probe；付费 AI/OCR 0 |
| 清理 | PASS | 41 表精确删 4 行，独立只读 uid + `test-r549-fix-%` 0 残留；全局 `paper_exports` 38→38 集合不变（未下载 PDF）；`explain_cache` 82 / latest / SHA-256 不变 |

抽检范围如实：仅 A①（未重跑全量、未下载 PDF）；「仅答案」不变性仅 375；PDF 内容/复习/resize 以 §4.3 `8dc0c4b0` 结论为准（两 rev 间 R549 文件无差）。

## 5. 如实边界

- **UNTESTED**（复验如实单列）：错选恰等于标准答案只带错因的分支、24 字截断/多选去重升序边界、「仅答案页」模式下的批注；已掌握不排期 / 无样本隐藏排期行 / 多天混合桶（生产重出前后服务端均返 1 天，只证明了去重与最终一致，未实测不同间隔覆盖）；resize 其余四页与「所有首访」；真实手机/小程序（R536-1 累计真机缺口继续）。以上均有单测覆盖，但「有单测」≠「生产验证过」。
- 375↔1440 精确 resize 用 CDP 同页 viewport 变化触发，另用 OS 真实拖动 568→1352 补证；不冒充物理 375→1440 拖动。
- PDF 批注信任模型：批注文本由客户端从自己错题本视图带上，服务端不查 uid 归属——与既有 `items` 内联题干同模型；恶意体只能污染自己的 PDF（不入库、不影响他人），不属于跨用户泄露面。若未来 PDF 要作为可分享/可信凭证，需改为服务端按 uid 取 `user_answer/error_reason`。
- 复习 CTA「回错题本 ›」在「本轮有错」时先弹既有强化推荐层：这是 R5xx 早期功能的既有行为、非本轮引入；文案承诺与实际一步不到位存在轻微错配，列为 R550 候选（推荐层内加「回错题本」直达或 CTA 文案按是否有推荐切换）。
- #695 提交时 H5 全量 vitest 未复跑（专项 + 两个改过的锁绿即提交），漏了小程序 import 源锁 1 红，#696 补齐；教训：源锁类测试改动后必须全量跑一次再提交。
- 发版在宿主被同机 3 个 build 挤占时 600s 未收敛、脚本按设计退出后 compose 后台收敛，`DEPLOY_RESUME=1` 续跑通过；部署时 Lighthouse `/` 0.83 为瞬时（独立重跑 0.92、#696 发版 0.97）。
- 仓库无环境蓝图且本会话无蓝图权限，未沉淀 venv/npm/pdftotext 等依赖安装步骤。

## 6. 证据索引

- 研究：`~/r545/q549.py / q549b.py / q549c.py`（+ `.out.txt`）、`~/r549-ux/R549-UX-report.md` + 截图/录像 `~/screencasts/r549-ux-9b4a511c/`
- 代码：#695
- 发版：`~/r549/deploy.log`
