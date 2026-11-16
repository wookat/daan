# R521：SOP-10 四维审计（R490–R520 复盘 + 四次发版后 (c) 补量）→ 命中 P1 实修——时政错题「错题重练」回源失败：`mistakes.question_id IS NULL`（时政题写入侧有意置空防撞号）在 `/api/mistakes/redo` 被静默跳过 → 按题干首行回 `shizheng_questions`（fail-closed，不臆造）+ 小程序练习页 `_sz` 题 id 置空守卫

日期：2026-09-08（UTC 03:3x–04:0x）。分支 `r521-deploy`（基于已合 main 的 R520c `c23ef35f`），代码 commit `2e608c0c`（后端）+ 小程序守卫 commit（本文档同分支）。生产 `c23ef35f` → `2e608c0c`（03:45:59Z，`DEPLOY_RC=0`）。统筹者指令：只读走查已够，把登记项转为实修，按四维对标粉笔/夸克 P0/P1。

## 0. 结论

1. **四维复盘（R490–R520）后本轮不再重复做已完成项**：聚合视图（错题本已有模块/题型/卷/知识点筛选 + `sort=old`）、批量导出/重练（R520 已上线）、练习页「加入错题本」反馈态（完成页 `autoSaved` 已有「错题已自动加入错题本」文案）三条候选经源码一手核均**已存在**，不立项；转而在「练习 → 错题 → 重练」主循环里找真实断点。
2. **一手命中（生产库只读）**：`mistakes` 中 `question_id IS NULL` 共 28 行，其中 **27 行题干首行能精确命中 `shizheng_questions.question`**（1 行为手录题，`questions` 表也命不中）；真人候选 uid 60 个、`时政` 错题 22 行；`shizheng_questions` 140 题。写入侧 `practice.vue`/`daily.ts` 对时政题**有意** `question_id: q._sz ? null : q.id`（时政 id 属 `shizheng_questions`，与题库 `questions.id` 数值撞号），但 `mistakes_redo_questions()` 只按 `question_id` 回 `questions`，回不到就 `continue` → **时政错题在「错题重练」（整筛选 `module=时政` 与 R520 勾选 `mids=`）里全部静默丢失**：用户勾了 3 题点「重练所选」可能得到「暂无可重练的题」或少题。这是 R517-3「时政无纠错落点」同源的更上游断点，属 P1（核心功能主循环缺口，真人可见）。
3. **修法（最小、fail-closed）**：`question_id` 为 NULL 且 `questions` 命不中时，用 `question_text` 首行 `SELECT * FROM shizheng_questions WHERE question=?` 精确匹配；命中则返回与 `shizheng_daily` 同形态对象（`id/date/question/options/answer/explanation(+「\n【出处】source_note」)/source_note/module='时政'/question_type='单选'/_sz=True`）并保留 `mistake_id`；命不中（手录题）仍跳过，不臆造。普通题路径、`mastered=0`、uid 隔离、`mids` 去重保序/≤25/400、全部筛选参数**零变化**。不回填历史 `question_id`（会把两个 id 域混起来），不给时政题挂题库社交/纠错/统计。
4. **顺带守卫（小程序）**：`miniapp-native` 练习页 `toPQ()` 此前无 `_sz` 分支，`saveWrong/logAttempts/收藏/笔记/讨论/纠错/分享` 一律用 `q.id` —— 本轮后端开始返回 `_sz` 题后，小程序「错题重练」`redoSet` 首次会拿到时政题，若不守卫会以 `shizheng_questions.id` 当题库 id 写 `mistakes.question_id` / `answer_log.qid` 并挂社交（W7 清单里的「`_sz` 守卫」项）。修法一行：`toPQ()` 里 `id: q._sz ? null : q.id`，让所有 `cur.id` 门（wxml 与 ts）自然 fail-closed，与 H5 `practice.vue` 同口径；`Question` 类型补 `_sz?: boolean`。小程序不在本轮发版范围（仅代码，`tsc`/eslint/lint-pages 绿）。
5. **改后生产一手（375/1440，`umst3` 只读数据）**：错题本 → 点可见 chip「时政」→「错题重练」→ `GET /api/mistakes/redo?limit=10&uid=umst3…&module=时政` **200，9 条全 `_sz:true`**（如 `{id:118, mistake_id:2914, module:'时政', answer:'C', nopt:4, q:'关于嫦娥七号任务突破的关键技术…'}`）→ 练习页「刷题 时政 1/9」、题干 + 4 选项、`docSW==cw`、errs []，仅 `POST track` 被 abort。两视口同形态。
6. **(c) / 到期项 0 增量**（`~/r521_post.out` 03:48Z，新容器窗 03:45:59Z→ 79 请求）：5xx 0（重建窗 0 条）、assets 404 0、monitor 0、mpUA 0、非探针 POST []、401/403 仅 1 条探针网段 `GET /api/health` 403（源站直打健康路径，非用户）、Traceback 0；WAL `4,173,592` 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click` 0、nudge []、`push_subs` 0；公告「详情」/`home_bundle`/`mistakes_total` 非探针无样本；`umst3` 四表 32/45/22/1 新增 0、`mistake 1953/2784/2914` 不变；`shared_questions` 18 / `user_profile` 11 与 R520c 同。无新的外部真人证据。
7. **簇**：09-07 终值 1445 行 / 1443 IP；09-08 至 03:48Z **3487 行 / 3437 IP**（15.2 行/分、峰 97 = R516 重建窗、无 >120 s 间断、UA 14、每 IP ≤2、200 ×3415 / 503 ×72 旧账）仍在跑；日报仍 03:23Z 版 `humans.page 09-08 3025 / ips 2975` 基本全簇。口径不改（待老板定）。
8. **发版如实**：预检 mem 296 MB / disk 5.1 G / load 0.38 / 兄弟构建 0；compose 03:44:40→03:45:59Z（79 s）收敛、容器 healthy 0 重启；线上 bundle `index-BhqML2JL.js` = 本机（前端本轮未改，hash 与 R520c2 同）；4c Pages 部署、5/5b 校验过；`DEPLOY_RC=0`。门：后端 pytest **568**（+3 R521 源锁）/ ruff / `npx -y pyright app` 0；前端 vitest / eslint / lint:tokens / lint-pages 0 error / build:h5 绿（前端本轮无改动，在 R521 工作树上重跑）；小程序 `tsc --noEmit` / eslint / lint-pages 0 error；`diff --check` 空。
9. **如实**：生产库访问**只读**（`mode=ro`），0 写入、0 迁移、0 回填；本机 CDP `X-Kg-Probe: 1` + `localStorage.anonUid=umst3…`，非 GET `/api/**` 全 abort（边缘非探针 POST []）；**改前**的 UI 探针只截到错题本「时政」筛选态（脚本首版未接 `expect_response`），改前「返回 0 条」由生产库只读查询（27/28 可命中 + 原代码 `continue`）与旧基线 worktree（`c23ef35f` + 新用例 3 failed）证明，不是改前 UI 抓包；混合 `mids`（普通 + 时政）与手录题跳过只有源锁，生产 UI 未再跑一遍混合勾选；练习页到时政题后**未提交作答**，`mistake_id` 回写、`answer_log qid null` 落库路径只有源锁；小程序改动未在微信开发者工具跑。点了 chip/重练——浏览器本地路径，非真人证据。

## 1. 一手证据（改前）

| 项 | 读数 | 来源 |
|---|---|---|
| 真人候选 uid（`mistakes` uid ∉ probe=1 且非 `test-%`） | 60 | 生产库只读 `~/r521_db4.sh` |
| `时政` 错题行 | 22 | 同上 |
| `shizheng_questions` 总数 | 140 | 同上 |
| `question_id IS NULL` 行 | 28 | 同上 |
| 其中题干首行 = `shizheng_questions.question` | **27** | 同上 |
| 其中题干首行 ∈ `questions.question` | 0 | 同上（唯一剩余 1 行为手录题） |
| 原 `mistakes_redo_questions()` 对 `q is None` 的处理 | `continue`（静默跳过） | `backend/app/db.py` 改前 |
| 写入侧时政题 `question_id` | `q._sz ? null : q.id` | `frontend-uni/src/pages/practice/practice.vue` ×2、`miniapp-native/.../daily.ts` |
| 旧基线 + 新用例 | `c23ef35f` worktree 跑 `test_r521_redo_shizheng.py` → **3 failed**（redo_by_head / mixed / module 筛选） | 本机 |

为什么不能把 `shizheng_questions.id` 当题库 id：两表独立自增（时政 `id=118` 与 `questions.id=118` 是两道题），R483/R484 已核过 `shared_answers/pk/explain_cache/question_report/review_log` 全按 `question_id` JOIN `questions`，回填会污染社交/统计/纠错域。因此保留 NULL，重练侧按题干回源。

## 2. 改动清单

- `backend/app/db.py`：`mistakes_redo_questions()` 内 `if not q:` 分支 → `question_id` 为空时 `_shizheng_redo_item(conn, head)`；新增 `_shizheng_redo_item()`（精确题干匹配、`options` JSON 解码失败回 `{}`、`explanation` 追加「\n【出处】」、`_sz=True`）。
- `backend/tests/test_r521_redo_shizheng.py`（源锁 3 例）：时政 NULL-qid 单题回源字段逐项；普通 + 时政混合 `mids` 两种都在且保序；手录题（无匹配）仍跳过；`module=时政` 筛选。
- `miniapp-native/miniprogram/pages/practice/practice.ts`：`toPQ()` `id: q._sz ? null : q.id`；`miniapp-native/miniprogram/api/types.ts`：`Question._sz?: boolean`。
- 文档：本文、`docs/handoff-context.md` R521 节、`.agents/skills/testing-kaogong-assistant/SKILL.md` R521 经验。

## 3. 改后读数（生产 `2e608c0c`）

| 视口 | 路径 | 请求 | 响应 | 页面 |
|---|---|---|---|---|
| 375 | 错题本 → chip「时政」→「错题重练」 | `GET mistakes/redo?limit=10&uid=umst3…&module=时政` | 200，9 items，全 `_sz:true`、`module:'时政'`、`mistake_id` 各不同、`nopt 4` | `#/pages/practice/practice`「刷题 时政 1/9 ✓0 ✗0」题干「关于嫦娥七号任务突破的关键技术…」+ A–D；errs []；abort 仅 `POST track` |
| 1440 | 同上 | 同上 | 同上 9 items | 同形态；errs [] |

截图 `~/r521/redo_sz_post_375.png` / `~/r521/redo_sz_post_1440.png`；改前筛选态 `~/r521/redo_sz_pre_375.png`；脚本 `~/r521/redo_sz.py`。

## 4. 登记（不改 / 待定）

- R521-1 手录题（`question_id` NULL 且两表都命不中）重练仍跳过——正确 fail-closed，但用户侧无提示「有 N 题无法重练」；是否加计数提示交 UX 定。
- R521-2 时政题 `answer_log qid=null`、`mistakes` 回写 `mistake_id`（`_sz` 题练习页答错再存一份？）路径只有源锁，待真人/复采用例提交作答后核（本轮不提交）。
- R521-3 小程序 `_sz` 守卫仅 typecheck/lint，未在微信开发者工具跑（W7 清单同项归并）。
- R521-4 簇/日报口径、宿主级 600 s、证书 10-04、6b 取样策略照旧待老板定。
- 四维下一候选（一手核后再定）：错题本按「错因」聚合（`error_reason` 真人 ≥09-11 仍 0 行，无数据不立项）、导出所选真下载真人首条（仍 0）、复习完成态回错题本刷新。
