# R578 · 完成页内开下一场（练同考点等）不清领跑题横幅 / 不重算顶栏标题 —— 第三级 `module` 强化回退生产一手坐实

分支 `devin/1789034915-r578-session-switch-reset`（从 #756 分支开，链含 #742–#756）；**H5 only，0 后端，0 小程序**（小程序 `navTitleFor(args)` 每次启动重算、无领跑题横幅，不存在同型问题）。

## 结论（先讲）

1. **R577 挂账的两项 UNTESTED 一手升级**：
   - 「完成页 → 薄弱考点 → 练同考点」**完整 H5 用户路径**在 tag3 不足 5 题时端到端跑通（375，真实生产、新 uid）：完成页薄弱考点显示题库 `submodule` 列原值「现期计算」（R576 设计），点「练同考点」发 `mode=reinforce&limit=5&module=ziliao&submodule=现期计算&tag3=ZL-JQ-05` → 200，5 题落地。
   - **第三级 `module` 回退在生产真实触发并有据可查**：`ZL-JQ-05` 活跃 3 题（752 / 155121 / 795021，第 4 题 263539 `disabled=1`）被该 uid 在领跑包全部答过 → 第一级 0 题；`ziliao/现期计算` 活跃池只有 1 题（正是 795021，另 1 题 787557 `disabled=1`）也被答过 → 第二级 0 题；回包 5 题 `submodule` 分别为 `基期与现期 / 比重 / 综合分析 / 基期与现期 / 增长量`、全部 `module=ziliao` → 第三级按 `module` 补满，`reinforce_log` 写 1 行 `skill=ZL-JQ-05`（满额才写，既有设计）。
2. **同一次实拍坐实一条用户可感知既有缺陷（本轮实修）**：练同考点第 1 题顶着上一场的领跑题横幅「刚才那题在这里作答，之后 2 题同考点练习」（当前场根本不是 SEO 深链领跑场、也不是 3 题），且顶栏仍「资料分析 · 专项练习」（`practiceNavTitle` 对 `reinforce` 应给「资料分析 · 强化练习」）。R576 生产 375/1440 截图同型：每日一练 → 练同考点后顶栏仍「每日一练」。根因：`syncNavTitle()` 只挂在 `session` 翻转与启动器上，完成页内开下一场（`startReinforce` / `retryWrong` / `retryGroup` / 每日一练）`session` 始终 `true` 不触发；`leadHint` 只在 `start()` 与 `quit` 路径清，`startReinforce` 等不碰。
3. 自然样本：ec8206e5 后 `practice_progress`（daily/redo）/ `stale_fallback` / `question_favs` / `reinforce_log` 窗内 **0 新增**——只说「窗内无合格自然样本」。
4. **R577-1（`merge_anon` 前后 `answer_log` 计数）本轮未做**（未走登录链路），继续挂 R579。

## 研究（一手，生产只读；`~/r578/q578.sh`（修正 `psource` 列）/ `q578c.sh` / `journey.py`）

### 宿主 / health

- `load 19.98 / 21.36 / 19.51 → 16.44 / 17.70 / 18.43`，`mem_avail ≈ 199MB`（total 1935），`disk 42G/50G 89%`，health `200 1.41s → 2.03s`。未 kill、未叠 build。后端 rev 全程 `ec8206e5`，Pages `index-Cf9A4ts2`（R576）。
- 第一版探针查 `practice_progress.source` 报 `no such column`——生产列名是 `psource`；教训入 SKILL。

### 自然样本（剔 `test-%`）

`pp_since_ec8 []`、`stale_2d []`、`favs_2d [[0,0]]`、`rl_all [[非test, 2, 08-30]]`、`events_24h boot 38/38 · heatmap_view 1/1 · slow_load 1/1`、`answers_2d 09-09 2 行/2 uid（daily/redo/reinforce/seo_q 全 0）`、`test_residue 0`。

### 完整 H5 链路（375，`journey.py <uid> 375 795021 ZL-JQ-05`，新 uid `test-r578-j-1789034079`，`X-Kg-Probe: 1`，连既有 Chrome CDP）

- 深链 `#/pages/practice/practice?qid=795021&tag3=ZL-JQ-05&module=ziliao` → `GET /api/questions?limit=10&uid=…&mix_due=1&tag3=ZL-JQ-05&module=ziliao` 200，领跑包 **3 题** = `ZL-JQ-05` 全部活跃题（795021 领跑 + 155121 + 752）；第 1 题横幅「刚才那题在这里作答，之后 2 题同考点练习」、顶栏「资料分析 · 专项练习」（`q1.png`）。
- 三题全选 A（答案 D/D/C，全错）→ 完成页「本组完成 … 错题已自动加入错题本」，薄弱考点卡 `现期计算 | 本组错 3 题 | 练同考点`（`done-full.png`）——3 题 tag3 相同按 tag3 分桶、名字取首题 `question_type` 子名「现期计算」= 该题 `submodule` 列，`submodule` 传 795021 的列原值。
- 点「练同考点」→ `GET /api/questions?mode=reinforce&limit=5&uid=…&module=ziliao&submodule=现期计算&tag3=ZL-JQ-05` **200**，回包：
  `515101 ziliao/基期与现期 ZL-JQ-01`、`143632 ziliao/比重 ZL-BZ-01`、`227573 ziliao/综合分析 ZL-ZH-01`、`375366 ziliao/基期与现期 ZL-JQ-01`、`153957 ziliao/增长量 ZL-ZZLL-01`。
- 生产只读回查（`q578c.sh ro`）：`jq05 = [752 活跃, 155121 活跃, 795021 活跃, 263539 disabled]`；`pool_xqjs = [795021 活跃, 787557 disabled]`；`answer_log` 该 uid 3 行 `source=seo_q probe=1`；`reinforce_log` 该 uid 1 行 `ZL-JQ-05`。→ 第一级/第二级候选池在「剔 disabled + 剔本人已答」后均为 0，第三级 `module=ziliao` 补 5，与 `reinforce_questions` 源码顺序完全一致。
- 第 1 题页面（`reinforce-q1.png`）：进度 `1/5`、题卡子模块「基期与现期」，**但**横幅仍「刚才那题在这里作答，之后 2 题同考点练习」、顶栏仍「资料分析 · 专项练习」（`NAV TITLE` 文本快照）。
- 24 个 API 请求 0 非 2xx，console/pageerror 0。

### 清理

`q578c.sh clean`：41 张含 uid 列的表 `ro {mistakes 3, practice_results 1, answer_log 3, reinforce_log 1, growth_events 1} TOTAL 9` → 只删该 uid → `after {} TOTAL 0`，`reinforce_log` 总数 `3 → 2`（回到 R577 后基线）。

## 论证：为什么这次立项、改哪里

- 证据是一手的：生产 375 实拍（本轮）+ R576 两尺寸实拍同型；不是源码推断。
- 用户可感知：横幅说「之后 2 题同考点练习」而实际 5 题不同考点，是**误导性文案**；顶栏「专项练习」/「每日一练」与实际「强化练习」不一致（R566 刚把顶栏做成按来源给出，这条路径漏了）。
- 最小修法（`practice.vue`，2 处，不改数据形状、不改后端、不改标题文案策略）：
  - `watch.items` 改为数组：`{ handler(){ this.leadHint = '' }, flush: 'sync' }` + 原 `matOpen = {}` 后追加 `this.syncNavTitle()`。**任何整体重赋 `items` 的启动器**（`start / startReinforce / retryWrong / retryGroup / startDaily / resume …`）都同时获得「清上一场横幅 + 按当前 `_reinforce/_daily/_source/lastModule` 重算标题」，不必逐启动器补。
  - `start()` 的 `leadHint` 赋值移到 `this.items = …` **之后**（原来在之前，会被 sync 清空）；空题包早 return 已在前面，`items[0]` 不越界。
- 为什么 sync：领跑横幅是模板 `v-if="leadHint && idx === 0"`，若用 pre flush，`start()` 同步写的本场 `leadHint` 会被随后的 watcher 清掉；sync 让「清」严格发生在赋 items 那一刻、早于本场赋值。标题用默认 flush（`_navTitle` 去重，多次触发无副作用）。
- 不动 `syncNavTitle` 的 `practicePageOnTop` 守卫与 `_navTitle` 去重；小程序不改（`navTitleFor(args)` 每次启动重算，且无领跑横幅）。
- 单测 `tests/r578-session-switch-reset.test.js`：源锁 watcher 形态 + `start()` 顺序 + 全文件无 `items.push/splice`（watcher 依赖整体重赋）+ Vue 响应式机制复现「领跑场保留提示 / 同 session 下一场提示为空、标题重算」。

## 本地门

H5 `vitest` 196 文件 1530 全过、`npm run lint` 0、`build:h5` → `index-Cjpb2IwU.js`；`git diff --check` 空；小程序/后端 0 改动不跑。

## 发版 / 生产复验（回填）

- 发版：PR #757 分支 `devin/1789034915-r578-session-switch-reset`（commit `27e09ece`），只跑 `~/r578/pages_deploy.sh`（R576 同款 Pages 静态层，后端 0 改动不叠 build）：线上 bundle `index-Cf9A4ts2 → index-Cjpb2IwU` 与本机构建一致，六类资源 200，health 前后 `ec8206e5`，`PAGES_DEPLOY_OK`。宿主同刻 mem_avail 214–218MB / health 0.77–1.29s。
- 复验（`journey.py` 加长：练同考点首题读 `.lead-tag` + 顶栏，再答完 5 题 → 完成页「只重练本组错题」读顶栏/横幅），375 uid `test-r578-v-1789035046`、1440 uid `test-r578-v-1789035121-w`，同 fixture `qid=795021&tag3=ZL-JQ-05`：

| 项 | 375 | 1440 |
|---|---|---|
| 领跑首题横幅「刚才那题在这里作答，之后 2 题同考点练习」+ 顶栏「资料分析 · 专项练习」（本场应有） | PASS | PASS |
| 完成页薄弱考点「现期计算 / 本组错 3 题 / 练同考点」 | PASS | PASS |
| 练同考点回包 `mode=reinforce&…&submodule=现期计算&tag3=ZL-JQ-05` 200、5 题全 `ziliao` 异 submodule（第三级回退再现） | PASS | PASS |
| **练同考点首题 `.lead-tag` = null（横幅已清）** | PASS | PASS |
| **顶栏「资料分析 · 强化练习」**（修前实拍「资料分析 · 专项练习」） | PASS | PASS |
| 强化场答完 → 「只重练本组错题」→ 首题 `.lead-tag` = null | PASS | PASS |
| 「只重练本组错题」顶栏仍「资料分析 · 强化练习」 | 口径：源码 `retryWrong()` 只重赋 `items/idx/…`，不改 `_source/_reinforce`，顶栏沿用本场来源是既有行为（R553 起）；我复验指令初版写「错题重练」是口径错。是否应改显「错题重练」登记 **R578-1（P3 UX）** 待论证，本轮不改 | 同 |
| API 52 全 200、console/pageerror 0 | PASS | PASS |

- 截图：`~/r578/j375/{q1,done,reinforce-q1,reinforce-done,redo-q1}.png`、`~/r578/j1440/` 同名；修前对照 `~/r578/j375-pre/reinforce-q1.png`（横幅 + 「专项练习」）。
- 清理：两 uid 各 22 行（mistakes 8 / practice_results 2 / answer_log 8 / reinforce_log 1 / growth_events 2 / practice_progress 1）→ `after {} TOTAL 0`，`reinforce_log` 总数 `4 → 3 → 2` 回到基线。

## 验证过 / 未验证

- 验证过（一手）：完整 H5「深链领跑 → 完成页薄弱考点（submodule 原值）→ 练同考点 → 5 题落地」；第三级 `module` 回退在生产真实触发（候选池 0/0 → module 补 5，回查原字段）；`reinforce_log` 满额写 1 行与精确清理 0 残留；两处既有 UX 缺陷（横幅残留、标题不重算）实拍；本地门。
- 未验证：**R577-1** `merge_anon` 计数（未走登录链路）；子名 ≠ `submodule` 条目点「练同考点」（本例子名 = 列值）；`module|submodule` 分桶（仍仅单测）；`retryGroup / 每日一练 → 练同考点` 在生产的表现（复验覆盖了练同考点 + 只重练本组错题两条同页路径；每日一练 → 练同考点只有源码推断）；小程序真机（R536-1 累计）、真实 SW/offline、跨设备、其它浏览器。

## 下一轮候选（R579）

1. **R577-1**：走一次登录/合并链路，`merge_anon` 前后只读 `answer_log`（按 uid）计数定性 +1。
2. 375 生产截图走查每日一练完成页 → 练同考点（R576 实拍顶栏残留「每日一练」的同型，R578 修后应「… · 强化练习」）与「再来一组」路径，择一用户可感知小改。
3. 自然样本继续回看；宿主压力只登记。
