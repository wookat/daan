# R414：模考/卷库多选题作答与判分 + 导入/管理端 answer 字母归一 + 错题本/收藏页字号下限

## 1. 生产只读取证（容器内 `/data/data.db`，脚本 `~/r414_answers.sh`）

### 1.1 全库 answer 格式（导入侧是否需要归一）

```
total 156792  empty 0  ws 0  lower 0  unsorted/dup 0  oob 0
```

- 全库 156,792 行 answer：空 0 / 首尾空白 0 / 小写 0 / 字母未升序或重复 0 / 字母不在 options 键内 0。
- 结论：**现有数据全部已规范，不需要迁移**；R413 「多选结算依赖字母升序」的风险只在导入/管理端未来写入。本轮加约束是前瞻性加固，不改任何现有行。

### 1.2 含活跃多选题的卷（R413 说「卷库无可测卷」被修正）

```
exam_papers 203 with active multi [
  (29,  '2021年北京公务员考试《行测》真题（区级及以上）', [264342]),
  (31,  '2021年北京公务员考试《行测》真题（乡镇）',       [275876]),
  (116, '2015年北京公务员考试《行测》',                    [273027, 273028, 273030, 273031, 273032, 273036])]
paper_exports 38 with active multi []
```

- R413 复验时 testing agent 在卷库列表页翻到 200 张未见 2015 北京卷，据此记「未测」；本轮直接查 `exam_papers`：**三张卷共 8 道活跃多选题全在卷库**，`/api/exam/papers` 实际返回 id 29/31/116。R413 的「卷库无 2015 北京卷」表述不准确，已更正。
- 纸笔答题卡（`paper_exports`）38 张里没有多选题，OMR 路径只做代码层统一、没有生产可测样本（如实记未测）。

## 2. 代码取证：模考/卷库链路是单选假设

| 位置 | 原逻辑 | 后果 |
| --- | --- | --- |
| `exam_api._EXAM_ITEM_FIELDS` | 不带 answer 也不带多选标记 | 前端无法知道是多选题 |
| `exam.vue pick(k)` | `_picked = k`，点选 180 ms 后自动跳题 | 多选题点第一项即跳题，永远只能交一个字母 |
| `exam_api._clean_int_map(as_str)` / `api_paper_answers` | `str(v)[:1]` | 即使前端送 `BD` 也被截成 `B` |
| `_judge_paper` / `api_exam_report` / `mock_event` 周赛 | `correct_ans = answer[:1]`；`len(picked)>1 → multi` | 多选题正确答案被截成首字母，永远判错 |
| `api_exam_progress` | 只接受单字母 A–D | 多选进度存不下 |
| `report.vue` | `right: k === detail.answer` | 多选正确项一个都不标绿 |

触达：8 题 answer_log 1 行（probe NULL）、mistakes 0、exam_attempts 中含这 8 题的交卷记录 0（R413 已核），即线上此前没有人在模考里做到这些题。

## 3. 修法

### 3.1 后端（`db.py` / `exam_api.py` / `admin_api.py` / `mock_event.py`）

- `db.normalize_answer(raw, opts=None)`：去空白、大写、只留 A–Z、去重、升序（`'d b'→'BD'`）；传 `opts` 时任一字母不在选项键内返回 `''`。
  - `import_questions()`：answer 归一后写入；归一为空（含字母越界）→ skipped。
  - 治理扫描 `_governance_scan_uncached`：`answer[:1]` 改归一比较（多选题此前会被误报「答案不在选项内」）。
  - 管理端 `PATCH /api/admin/questions/{qid}`：answer 归一 + 对 options（body 里的或库里的）校验，非法 400。
- `exam_api._grade(picked, answer) → (picked, correct_ans, status, is_correct)` 统一三条判分路径（卷码作答 / 答题卡 OMR / 整卷模考）：字母集完全一致才对；单选题涂多个仍是 `status='multi'` 不记分不落库（与答题卡多涂同义），多选题多字母 `status='ok'` 正常判。报告 items 加 `status`，`answered` 口径 = `status=='ok'`（此前 `len(picked)==1`）。
- `_clean_int_map(as_str)` / `api_paper_answers` 截断 `[:1]→[:8]`；`api_exam_progress` 接受 1–4 个 A–D 字母并归一存储。
- 下发题面 `_exam_item()` 加 `multi: bool`（不带 answer，模考不泄题）。
- `mock_event` 周赛 per-tag 统计同法。PK 本就显式排除多选题，未动。

### 3.2 前端（`exam.vue` / `report.vue` / `exam-excl.js`）

- `togglePickLetter(picked, k)`：切换字母、去重、升序，与服务端同序。`toggleExcl` 排除已选中的某字母时只去掉该字母（原来只处理单字母相等）。
- `exam.vue`：`cur.multi` 时 `pick(k)` 只切换 `_picked` 字母串并保存进度、**不自动跳题**；题干下方「多选题：可选多项，已选 BD，选完点「下一题」」提示条；`.opt.sel` 按字母包含高亮。单选题行为不变（点选 180 ms 跳题）。进度保存/恢复本就存整串 `_picked`，`multi` 随 items 一起存本地/从 resume 拿。
- `report.vue`：正确项 `answer.indexOf(k)`、错选项 `picked 含 k && answer 不含 k`。

### 3.3 字号下限（R413 复验预存 P2）

- `book.vue` 42 处 / `favorites.vue` 4 处 `18–23rpx → 24rpx`（375 下 ≥12px），与 R411 stats / R412 社交栏同口径。含 `.anscmp` 23rpx、`.tag` 20–22rpx、`.mtime`、`.srcbadge/.pbadge/.rvbadge/.rzbadge` 20rpx 等。趟势图标签 `.trend-*`、`.recap-name`（flex 160rpx）等固定宽元素需复验溢出。

## 4. 本地验证

- 新增 `backend/tests/test_multi_answer_exam.py` 5 条：normalize 边界、`_grade` 单/多选矩阵、模考全流程（start 下发 `multi`、progress `DB→BD`、超 4 字母 400、submit 多选对/单选多涂 multi、report 标记、漏选进错题本 `('B','BD')`）、管理端 PATCH 归一/400/带 options、import 归一+拒绝。去掉 `exam_api` 改动时 import 即失败。
- 新增 `frontend-uni/tests/exam-r414-multi-answer.test.js` 3 组：`togglePickLetter` 行为与 fail-closed、`toggleExcl` 多字母、exam/report 源文件锁。
- pytest 434（+5）/ ruff / pyright 0；vitest 578（+5）/ eslint / build:h5 绿。

## 5. 生产部署与复验

见 handoff 与 PR #619 评论。
