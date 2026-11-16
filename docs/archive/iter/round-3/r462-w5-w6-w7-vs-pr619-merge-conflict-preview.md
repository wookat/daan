# R462：W5/W6/W7 分支线与 PR #619 的合并冲突面预判（只读模拟合并 + #619 源锁回归计数）+ 到期项（只取证登记，不改码不部署；生产仍 `fe57df3`）

时间：2026-09-06 22:40–23:20Z。生产 `/api/health` `{"ok":true,"rev":"fe57df3"}`，容器 `deploy-kaogong-1` running healthy、`RestartCount 0`、`StartedAt 2026-09-06T22:11:59Z`（R460b 重建，未变）。本轮**不改任何分支、不推任何合并**：全部模拟在临时 `git worktree`（detached）里做，结束即 `worktree remove`。

## 1. 结论先行

1. **冲突根不在 W6/W7，在它们共同的祖先 W5（PR #630 `devin/w5-integration` → main）**。四条活跃小程序分支（`w6-mp-parity` #634、`w6-exam`、`w6-social`、`w7-mp-flat-v3` #636）与 #619 的冲突文件集合**完全相同**（26 文件），且与「main + W5 再合 #619」的冲突集合一致 → 冲突全部由 W5 引入，W6/W7 自身对 H5 侧无新增冲突。
2. **W5 从 09-04 17:53Z 的 `bcf4662` 分出，之后再没 rebase**；而 `origin/main` 至今**仍停在 `bcf4662`**（#602–#619 共 150 提交全未合），生产实际跑的是 #619 分支代码（`fe57df3`）。即：W5 是在一个比生产落后 R383–R461 的 main 上重排了 23 个 H5 页面。
3. **冲突面 26 文件** = 23 个 `.vue` + `backend/app/db.py` + `docs/handoff-context.md` + `.agents/skills/testing-kaogong-assistant/SKILL.md`。23 个 vue 上 #619 侧 29 个提交 / **31 个轮次**（R391、R398、R400、R402、R409–R416、R420–R423、R426、R428–R430、R440、R445、R447–R450、R460/R460b）+461/−301 行；W5 侧 +4654/−5883 行（整页迁到 Kg* 组件与 token）。原定要看的 `checkin.js`：W5 **未动**，无冲突；`miniapp-native`：#619 **0 个文件**，无冲突。
4. **机械解冲突两个方向都会带回已修缺陷（#619 vitest 654 条为尺）**：
   - 「main + W5」再合 #619 取 **W5 侧**（`-X ours`）：**32 条源锁失败 / 16 文件**（622/654 通过）。失败项不是样式而是功能：R413/R414/R428 **多选题作答**（`togglePickLetter` 在 W5 的 `practice.vue`/`exam.vue`/`share-q.vue` 里 **0 命中** → 多字母答案题回到点一个字母即提交）、R415 `shouldPushProgress/_progPushed`（0 命中 → 一题未答也写续考进度）、R398 AI 分析失败态不缓存可重试（`aiLoading ||` 守卫 0 命中）、R421/R423 `thinkSecs` 推理计时（0 命中）、R410 错题本页内 sheet / 错因自评 PATCH、R445/R447–R449 首页 `.hero-ds` 占位与右对齐、R411/R412/R430/R440/R450/R460 字号下限与 40px 热区、R460 `cnWeekKey`「本周比上周」。
   - 取 **#619 侧**（`-X theirs`）：仍 **4 条失败**（650/654）——W5 在同文件的**非冲突 hunk** 照样并入：`book.vue` 模板 `k === it.answer`（多选正确项标记回退）、`stats.vue` 模板硬编码「本周比上周」、`book.vue` chip `min-height: 36px`（R410 定 40）、`home.vue` `.hero-ds` 条件渲染回来（R445）。
   - 结论：**没有任何自动策略可用**，必须逐文件人工合并，并以 #619 的 vitest（89 文件 / 654 条）+ eslint + `build:h5` 作为验收门。
5. **`backend/app/db.py` 冲突是小的、可两存的**：4 个冲突块全在 `get_mistakes` 两条联查 SQL 及其 hydrate 处——W5 加 `q.question AS q_question` + `_hydrate_mistake()`（有 options 时 `question_text` **无条件**取题库题干，去掉历史写入把选项拼进题干的重复）；#619（R400）加 `q.hs_explanation AS q_hs` + `explanation` **为空才**回落 hs。两边都是「多 SELECT 一列 + 多一步 hydrate」，人工合并把两列、两步都保留即可，无语义互斥。唯一要拍板的是 W5 的无条件覆写：R396/R400 隔离/修正过的题在联查到时会被**题库当前题干**替换（多数相同，隔离/下线题不同），建议改成只补空（§4）。
6. **合并顺序建议（如无异议按此执行）**：**先合 #619**（它 = 生产已跑 3 天的代码，main 落后生产才是异常态）→ W5 #630 在新 main 上 **rebase/merge 并逐文件人工解 26 处**，以 #619 的 654 条 vitest 全绿为门 → 再合 W6 #634 → W7 #636（W6/W7 只改 `miniapp-native` + docs，H5 侧无新增冲突）。反过来「先合 W5 再让 #619 解冲突」在数量上等价，但会让生产回退 R383–R461 的所有 H5 修复直到 #619 重新合入。
7. **到期项无增量**：`answer_log` probe=0 **33/1**（最后一条 09-06 21:39:44Z = R461 vivo 会话）、`growth_events` probe=0 20/4、`error_reason` 7（≥09-11 **0**）、`push_subs` 0、`weekly_reports` 2、`quick_check ok`、WAL 4,124,152 B（R461 同字节）、healthy 0 重启。(c)：22:30Z 后 81 请求 `/assets/*` 404 0、monitor 0、非 2xx 仅 1 条 403 `/api/health` = 本轮脚本第一版直打 `kaogong-origin` 无 CF 头（R388 规则），自归因。宿主盘 **93% / 3.4 G**（R461 92% / 3.9–4.2 G，再降）。

## 2. 方法（可复现）

```bash
# 冲突集合（git 2.34 无 merge-tree --write-tree，用 detached worktree 模拟）
git worktree add --detach /tmp/wt origin/main
cd /tmp/wt && git merge --no-ff -m t origin/devin/w5-integration      # main+W5：clean
git merge --no-commit <#619 HEAD>; git diff --name-only --diff-filter=U  # 26 文件
git merge --abort
# 机械解法回归计数（两方向）
git merge --no-ff -X ours   -m t <#619 HEAD>   # 取 W5 侧
cd frontend-uni && npx vitest run              # 32 failed | 622 passed
git merge --no-ff -X theirs -m t <#619 HEAD>   # 取 #619 侧
npx vitest run                                 # 4 failed | 650 passed
```

- 四条 W6/W7 分支各自「main + 分支 → 再合 #619」的冲突集合逐一跑过，均为同一 26 文件。`git merge-base origin/devin/w6-mp-parity origin/devin/w6-exam origin/devin/w6-social` = `694ca25`（W6 集成合并点），`main..694ca25` 的 H5 页面改动全部来自 W5 提交（`d68ec94`/`cf5926d`/`d661c10`/`cf9ffc9`/`0047443`/`f5ddaa9` 等）。
- 源锁命中核（`git grep -c` 于 `origin/devin/w5-integration` vs #619 HEAD，限 `frontend-uni/src/pages` + `pkgA`）：`togglePickLetter` 0 vs 4、`shouldPushProgress` 0 vs 2、`_progPushed` 0 vs 3、`aiLoading ||` 0 vs 1、`thinkSecs` 0 vs 9、`cnWeekKey` 0 vs 2。这些不是「同一行两边都改」的样式冲突，而是 W5 分出时功能尚不存在。

## 3. 冲突文件清单（26）

`frontend-uni/src/`：`components/predict-card/predict-card.vue`、`components/q-social-bar/q-social-bar.vue`、`pages/ask/ask.vue`、`pages/book/book.vue`、`pages/home/home.vue`、`pages/practice/practice.vue`、`pages/stats/calendar.vue`、`pages/stats/stats.vue`、`pkgA/exam/{contest-report,contest,exam,report}.vue`、`pkgA/interview/interview.vue`、`pkgA/pk/pk.vue`、`pkgA/search/search.vue`、`pkgA/settings/reminders.vue`、`pkgA/share/{pk-result,share-q}.vue`、`pkgA/social/favorites.vue`、`pkgA/stats/{mastery-map,practice-history,weekly-report}.vue`、`pkgA/team/team.vue`；`backend/app/db.py`；`docs/handoff-context.md`；`.agents/skills/testing-kaogong-assistant/SKILL.md`。

## 4. `db.py` 两存建议（供合并者参考，本轮不改）

合并形态（两存）：SELECT 同时带 `q.question AS q_question, q.hs_explanation AS q_hs`；hydrate 先做 #619 的 `d["explanation"] = d.get("explanation") or hs or ""`，再做 W5 的 `_hydrate_mistake`。W5 现行 `if stem and d["options"]: d["question_text"] = stem` 是无条件覆写；R396/R400 隔离/修正过的题在联查到题库题时会被题库当前题干替换（多数相同，隔离/下线题不同）。建议改为 `if stem and d["options"] and not (d.get("question_text") or "").strip()`——只补空，不覆写；或保留覆写但排除 `quarantine` 中的 qid。这是设计取舍，需 W5 负责人或合并者确认，本轮只登记。

## 5. 如实说明

- 「32 / 4 条失败」是**源锁文本匹配**的计数：源锁按正则匹配源文件，W5 若用不同写法实现了同一行为会被误报；但抽核的 6 个功能符号在 W5 分支里 **0 命中**（不是换写法，是没有），多选作答 / 续考进度 / AI 失败重试 / 推理计时四项可判定为真回退；字号/热区类未在 W5 上实际渲染量测。
- 「W5 未 rebase」按 merge-base 判定；W5 的 4 个子分组 PR（#626–#629）与 foundation #625 的内部关系未展开。
- 没有把「先合 #619」付诸行动：合并动作按既定口径仍留给老板；本文只给数量与顺序论证。
- 到期项快照 22:44Z；(c) 窗口只有 34 min、真人候选 0，无样本 ≠ 无问题。

## 6. 登记

- **P2（合并流程）**：#630 W5 需在 #619 合入后的 main 上重新合并，26 文件逐一人工解，以 #619 vitest 654 全绿 + eslint + build 为门；#634/#636 顺序在其后。已在 #619 与 #630 评论登记（见 handoff）。
- **P3（设计取舍）**：`_hydrate_mistake` 读出侧覆写 vs R400 写入侧回落，建议只补空。
- 不改 main、不动他人分支、不部署。
