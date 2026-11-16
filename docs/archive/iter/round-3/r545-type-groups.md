# R545 · 错题本题型二级聚合：以分类树题型组为主、来源题型为辅

## 1. 问题（R544 生产走查 #6 遗留）

错题本「题型」筛选与卡片标签取自 `mistakes.question_type`（来源站原始细题型，去「模块-」前缀），而掌握度地图 / 同考点强化 / 三级考点树都以 `questions.submodule → taxonomy.json 题型组` 为口径。两套口径并存导致「排列组合 ×1」「概率问题 ×2」「排列组合与概率 ×1」平级出现、互不包含，用户想集中补练一类题得知道多个近义标签。

## 2. 一手证据（生产只读 `/data/data.db`，2026-09-08，脚本 `~/r545/q1.py`、`q2.py`）

- 活跃题 109,371。细题型 vs 题型组的基数：数量关系 109 种 `question_type` → 18 种 `submodule`；判断推理 24 → 14；资料分析 60 → 25；言语 14 → 12；常识 197 → 196（常识两侧都碎，本轮不动）。
- 细题型 → 题型组多对一实例：`数量关系-排列组合`(1825) + `数量关系-概率问题`(2669) + `数量关系-排列组合与概率`(215) → 组「排列组合与概率」；`逻辑判断(结论与解释)/(加强削弱)/(翻译推理)/(真假话与分析推理)/翻译推理/削弱论证/加强论证/前提假设/…` 共 17 种 → 组「逻辑判断」；`实词填空/成语填空/混搭填空/逻辑填空` → 组「逻辑填空」。
- 错题表 297 行（待掌握 295）：`question_type` 无前缀 279 / 有前缀 5 / 空 13；空的 13 行全部能从题库 `submodule` 拿到题型组（当前 UI 显示为模块名「常识判断」等，无信息量）；手录/对不回题库 28 行没有 submodule。
- 待掌握 ≥5 的 17 个真实 uid：现行标签合计 139 个 vs 题型组 127 个；最重用户 `umsacie…` 31 道 → 24 个标签 vs 16 个组（其中 `排列组合 ×1 + 概率问题 ×2` 合为「排列组合与概率 ×3」）；`u26` 16 道中 12 道 `question_type` 空、现显「常识判断」。
- 重练接口 `/api/mistakes/redo?qtype=` 是 `question_type=?` 精确匹配，只能按细题型重练。

## 3. 方案（如无异议按此实现）

1. 后端 `_hydrate_mistake` 新增 `type_group`：`taxonomy.group_name(module, submodule)`（alias 命中回规范组名，未命中回 submodule 原文，无 submodule 为 `None`）。`/api/mistakes`、`/api/review/due` 同时受益。
2. 后端 `/api/mistakes/redo` 新增 `sub=`：按题型组过滤（`question_id IN (SELECT id FROM questions WHERE module=? AND submodule IN (<组名及其 aliases>))`），与既有 `qtype=`（细题型）、`module&noqt`（无题型）并存。
3. H5 错题本：
   - `groupKey(m) = type_group || tagName(m) || '其他'`：题型筛选 chips、模块折叠层级、卡片主标签都改用题型组；手录/无 submodule 行照旧用细题型 / 模块名。
   - 选中某题型组后，若组内细题型 ≥2 种，展示第二行「细分」chips（`qtFilter`，URL `qt=`），点选后只看该细题型；卡片上细题型与组名不同时以 neutral 小标签补充展示。
   - 「错题重练 · 当前筛选」：组 → `sub=`，细分 → `qtype=`。
4. 小程序错题本同口径：`typeName` 用 `type_group`，重练按 `sub=` / `qtype=` 判定；不做二级 chips（小程序筛选面积有限，先对齐主口径）。
5. 不改题库数据、不改 taxonomy.json、不合并常识碎标签（需内容侧别名设计，仍为后续轮）。

## 4. 验证方式

- 后端单测：`type_group` 取值三态；`redo?sub=` 命中组内两种细题型、不命中手录题；`sub`+`qtype` 组合。
- H5 Vitest：`groupKey/fineType` 语义、二级 chips 出现条件、URL `qt` 往返、redo 查询串。
- 生产黑盒：隔离 uid 造「排列组合 + 概率问题」各 1 错 → 题型 chips 只有「排列组合与概率 ×2」→ 点开出现细分 chips 2 个 → 重练 2 题命中；375/1440。

## 5. 结果

### 5.1 实现与本地门（`devin/*-r545-type-groups`）

- 后端：`taxonomy.group_name / group_submodules`；`_hydrate_mistake` 出 `type_group`；`mistakes_redo(sub=)` + `/api/mistakes/redo?sub=`（空/超 40 字 400）。`sub` 用 `group_submodules(module, sub)` 展开组名+aliases，未知组只匹配自身（回空集而非全集）。
- H5 `book.vue`：`groupKey` 题型组优先；`fineType / fineTypes / qtFilter`；细分行 `{{ kpFilter }} · 细分`（组内 ≥2 种细题型才出）；卡片主 tag 组名 + neutral 细题型；`redoTypeQuery()`：组 → `sub=`（叠 `module`/`qtype`），手录细题型 → `qtype=`，模块名 → `module&noqt`；`book-url.js` `qt=` 只随 `kp` 序列化/解析；`applyPendingKp` 校验 `qt` 属于该组才恢复。
- 小程序 `book.ts`：`typeName = type_group || tagName`；`onRedo` 命中组 → `sub=`（叠 module）；`RedoFilter.sub`、`Mistake.type_group`。
- 测试：`backend/tests/test_r545_type_group.py`（3）、`frontend-uni/tests/r545-type-groups.test.js`（11）；改 3 处源锁旧口径的既有断言（`book-url` 解析对象多 `qt`、r516 分组键、r530 清筛选多 `qtFilter`）。
- 本地门：pytest 609 passed / ruff / pyright 0（`npx -y pyright --pythonpath ~/venv-kg/bin/python app`；不带 pythonpath 会因 jwt/pywebpush 解析不到报 2 个 reportMissingImports，main 同样）/ vitest 1005 / eslint / tokens / build:h5 / miniapp tsc+eslint / `git diff --check`。

### 5.2 生产复验

- 发版：`deploy_h5.sh --skip-build` `cda7af0d → 42df6d14`（#683 首发；接口回归全 200；Lighthouse `/` a11y 部署时 0.94、独立重跑 1.00，首页非本轮改动，判瞬时）。设置期间老板侧把 main（W12 #682）合入分支并再发版 → 生产 `a707322a`（42df6d14 是其祖先，R545 涉及的 db/taxonomy/study_api/book.vue/book-url 两 rev 无差异；HEAD pytest 621 / vitest 1009）。#683 已合入 main `7566e0ba`。
- 黑盒复验（testing agent，rev `a707322a` / bundle `index-Dxu3v3c0.js`，uid `test-r545-verify-0d1e368ad7`，375×812 / 1440×900；报告 `~/r545-verify/R545-a707322a-production-verification.md`，录像 `~/screencasts/r545-a707322a-production/`）：
  - 选样（只读）：生产 `questions.submodule='排列组合'` 0 条、`'概率问题'` 1 条且 disabled；规范 `排列组合与概率` 6204 条 —— 生产碎片化来源是 `mistakes.question_type`（`数量关系-排列组合` / `数量关系-概率问题` 去前缀）而非 submodule。fixture 取 qid 63（排列组合）+ 64/381（概率问题）+ 8223（计算问题）+ 1 条手录，5 条错题 3284–3288。**alias→组名归一在生产无样本，UNTESTED（后端单测覆盖）**；未改题库。
  - 接口 PASS：`/api/mistakes` 与到期 `/api/review` 每条带 `type_group`，3 条为「排列组合与概率」、手录 null；`redo?sub=排列组合与概率` → `[63,64,381]`，`+qtype=概率问题` → `[64,381]`，`+module=shuliang` 同上叠加正确；未知组空；空串/空白/41 字 → 400。
  - UI PASS（双视口）：题型 chips 只有「排列组合与概率 ×3」（无「排列组合 ×1 / 概率问题 ×2」平级）；点组出「排列组合与概率 · 细分」行「概率问题 ×2 / 排列组合 ×1」；卡片 brand 组名 + neutral 细题型；细分后 2 条、当前筛选「排列组合与概率 · 概率问题」；重练请求 `sub=`（1/3）、细分 `sub=&qtype=概率问题`（1/2）；直达 `?kp=&qt=` 刷新恢复两级、细分再点取消、切模块/清组去 `qt`、外组 `qt` 丢弃；手录卡片 fallback 不变。
  - 回归 PASS：tab 切换 / 模块筛选 / 桌面按题型排序 / 复习 1/5 / 首页统计；1271 响应 = 1223×200 + 45×304 + 3×预期 400，应用 console/rejection 0；导航取消 22（18 图 4 XHR）分列；375 无横向溢出、焦点环可见；付费 AI 0；`explain_cache` 82 不变。
  - **P2 既有（非 R545 回归）**：选筛选（组+细分，或旧 `mod=shuliang` 对照）→ 重练 → 页内返回，UI 仍保留筛选但地址栏退回无 `kp/qt/mod`，此时刷新丢筛选。uni-app 返回时重写地址、`syncBookUrl` 只在 watch 里触发；下一轮 onShow 补同步。
  - 清理：关闭 context 后枚举 41 张 uid 表精确删 10 行（5 mistakes + 5 growth_events），`test-r545-%` LEFTOVER 0（只读复查一致）。
