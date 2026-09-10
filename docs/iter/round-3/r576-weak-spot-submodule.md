# R576 · 完成页薄弱考点缺 question_type 时退到题库 submodule（不再显模块名）+ 强化入口传题库 submodule 列原值 + 收藏删到 0 卡不铺骨架（R575-1）

分支 `devin/1789031058-r576-weak-spot-submodule` 从 #755 分支开；H5 + 小程序（收藏页），0 后端。

## 研究（一手，生产只读；`~/r576/cf.sh` `cf2.sh` `q576*.sh` `shots.py` `clean576.py`）

### Cloudflare 新账号 Web Analytics / beacon 注入（R566-1）

- API 读证（`X-Auth-Email/Key`，zone `d510abee…`）：RUM `site_tag 3023ecd7…`、`auto_install = true`、`ruleset.enabled = false`（`zone_name zalize.com`）；`rocket_loader off / mirage off / server_side_exclude on / automatic_https_rewrites on`；Pages 项目 `kaogong-h5-zalize` deployment configuration 的 analytics 字段为空。
- 生产 HTML：多次 `curl` + 本轮 375 走查全程（匿名 + 登录两模式，113 API 全 2xx）**均未见** `cloudflareinsights` / `data-cf-beacon`，console 0（含 CSP 违规 0）。
- 结论（如实）：本窗口无注入观测；`auto_install=true` 与 `ruleset.enabled=false` 并存的官方语义**尚未一手核实**（未查到能直接对照的文档条目），不能宣称「已永久关闭」。方向不变：若再观测到注入，优先在 Cloudflare 侧关 Web Analytics 自动注入，**不放宽本站 CSP**。本轮不改代码、不改 CF 配置。

### 宿主与自然样本

- 宿主：`load 2.89 → 25.7`（跨本轮两次读，波动大）、`mem_avail 361MB`、`disk 42G/50G 89%`、health `0.75s`；一次 SSH `kex_exchange_identification: Connection reset by peer`，等待后重试成功；清理写事务的 SSH 回执 250s 超时（见下）。未 kill 他家进程、未叠 build。
- ec8206e5 后自然样本（剔 `test-%` 与本轮 uid）：24h 事件 `boot 45/42 · daily_open 4/1 · heatmap_view 3/2 · push_nudge_show 2/1 · slow_load 1/1`；`answer_log` 2 天 `09-09 2 行 / 09-10 11 行`，其中 `daily` 11（本轮走查即占 11）、**自然 `redo` 0**；`stale_fallback` 2 天 **0**；`question_favs` 2 天 0 新增；`practice_results` 7 天 1 行。只能说「窗内无合格自然 redo/stale/favs 样本」。

### 题库字段覆盖（完成页薄弱考点的输入）

- `questions`（`disabled=0`）：总 109,371，`question_type` 空 **11,585（10.6%）**，`tag3` 空/UNKNOWN 50；分模块 `question_type` 空：常识 3,843 / 判断 3,656 / 数量 644 / 言语 3,260 / 资料 182。`submodule` 空 **0**；「两者都空」0。
- `question_type` 子名（`-` 后缀）与 `submodule` 列**多数不同值**：常识 20,797 / 判断 9,442 / 数量 14,014 / 言语 8,908 / 资料 1,278 条不一致；样例 `常识判断-历史 ↔ 历史人文 9,615`、`数量关系-概率问题 ↔ 排列组合与概率 2,669`、`言语理解-主旨概括 ↔ 中心理解 2,471`、`判断推理-逻辑判断(结论与解释) ↔ 逻辑判断 2,137`。
- 每日一练当日题组中就有 `question_type = None`（`yanyu / 中心理解 / YY-ZX-05`）。

### 375 生产截图走查（`~/r576/shots/`，375×812@2x，匿名 + 注册登录两模式）

- 覆盖：匿名首页 → hero「免注册立即开练」进每日一练 → 题 1/题 4/答错反馈；我的（游客）→「登录 / 注册」→ 登录页 / 注册页（segmented）→ 注册「注册并合并本机记录」toast → 落地；登录后我的 / 首页（含「继续今日一练」续练卡）/ 续练 → 反馈 → 完成页（整页 1502px）/ 统计 / 完成后首页（「今日全站同题 · 答对 3/10 · 第 1 名」）。API 113 条全 2xx、console / page error 0。
- **完成页薄弱考点卡（生产实拍 `375-daily-done-full.png`）三条：「言语理解 · 本组错 1 题」「混搭填空 · 本组错 1 题」「判断推理 · 本组错 1 题」**——两条显示的是**模块名**（`weakSpots()` 在 `question_type` 缺失时 `name = modName(module)`），与同卡第二条「混搭填空」层级不一致；用户点「练同考点」时前端传 `submodule: null`（`subName(question_type)` 为空）→ 后端 `reinforce_questions` 只按 `tag3` 再按 `module` 回退，等于「练同模块」而非「练同考点」。
- 其余页面（登录/注册/我的/首页/统计/完成后首页）无 P0/P1、无溢出/遮挡。

### R575-1 独立评估（删到 0 卡一帧骨架）

- 机制：`favorites.vue load()` `loading = !items.length`——取消最后一条后 `dropFavItem` 使 `items=[]`，紧随的后台对账 `load()` 判成「首次加载」铺骨架 ≈175ms（R575 复验实测），随后真实回包空态。有剩余卡时无骨架。
- 判断：违背 R575 自己立的「已有列表在手时刷新不铺骨架」精神（此刻列表状态已由云端 DELETE 回执确认，不是未知）；用户可感知为「删完闪一下」，P3。最小修法一行：`load({ known: true })` 时不因空列表铺骨架，其它入口（onShow / 重试 / 新建夹 / 横幅重试）语义不变；小程序同口径。**值得顺手修、不值得单独一轮**——并入本轮。

## 论证

- 问题真实性：完成页薄弱考点显示模块名 + 强化入口丢子模块，是**生产实拍 + 题库 10.6% 覆盖缺口 + 每日一练当日题组命中**三证坐实的用户可感知问题；每日一练是全站同题，同一天所有做错该题的用户都看到「言语理解 · 练同考点」。
- 为什么用 `submodule` 列：① 覆盖 100%（0 空）；② 题页考点链（`practice.vue` 顶栏/考点行）同一来源；③ 后端 `reinforce_questions(uid, tag3, module, submodule)` 的第二级回退是 `module=? AND submodule=?` **按题库 `submodule` 列过滤**——现状即使有 `question_type`，前端传的 `-` 子名（如「主旨概括」）也与库内 `submodule`（「中心理解」）不同值，`tag3` 不足 5 题时子模块回退**必然落空**再回到模块。所以强化入口应始终传 `q.submodule` 原值，展示名维持 `question_type` 子名（更细）、缺失时退 `submodule`。
- 分桶键：`tag3 → question_type → module|submodule → module`。无 tag3 无 question_type 时按 `module|submodule` 分桶，避免不同二级题型被并成一条模块名。合并同展示名 / 多 tag3 置 null 的 R5xx 语义不变。
- 否决：
  - 「后端补齐 `question_type`」：11,585 行数据治理，非本轮；且 `submodule` 已是规范列，前端直接消费即可。
  - 「展示名也统一改用 `submodule`」：会把「主旨概括/意图判断」粗化为「中心理解」，损失信息，否。
  - 「小程序同改」：小程序练习结算态无薄弱考点卡（R554 核实），无对应代码，H5-only。

## 实修

- H5 `src/weak-spots.js`：`sub = subName(question_type) || q.submodule`；`key = tag3 || question_type || (submodule ? module|submodule : module)`；条目 `submodule: q.submodule || sub`（强化入口传题库列原值）。
- H5 `pkgA/social/favorites.vue` `load(opts)`：`known = opts?.known === true` → `loading = !known && !items.length`；`unfav` 收缩后 `load({ known: true })`。小程序 `favorites.ts` 同口径（`load(opts?: { known?: boolean })`；wxml `bind:cta="load"` 传入事件对象，`known` 不为 true，语义不变）。
- 测试：`tests/weak-spots.test.js` +3（无 question_type 退 submodule / 有 question_type 展示子名但入口传 submodule 列 / 无 tag3 无 question_type 按 module|submodule 分桶）；`tests/r575-fav-list-reload.test.js` 源锁改为 `known` 口径（H5 + 小程序）。
- 顺手：`tests/r549-seg-resize.test.js` 正则 `\n  mixins` → `\n {2}mixins`（R575 引入的 `no-regex-spaces` eslint error，R575 本地门「eslint 0」记录有误，如实更正）。
- 本地门：H5 `npm run lint` 0 / vitest 195 文件 1526 / build:h5 `index-Cf9A4ts2`；小程序 tsc / lint 0 error / vitest 17 文件 82；`git diff --check` 空；0 后端。

## 测试数据清理（本轮研究阶段）

- 对象：匿名 `test-r576-shots`（`merged_anon` 1 行）+ 注册账号 `19900000576` → `users.id=33` / uid `u33`（`mistakes 8 / practice_results 1 / answer_log 11 / growth_events 12 / daily_set_entries 1` + `auth_tokens.user_id 2` + `merged_anon.user_id 1`）。
- 先只读拿权威 uid → `BEGIN IMMEDIATE` 精确删（含 `users` 该行）→ SSH 回执 **250s 超时（删除回执缺失，未重发 DELETE）** → 独立只读复核：`users` phone 行 0、`u33`/`33` 在 41 张 uid 表 **0 残留**、`test-r576-shots` 0、共享 `test-r562-modal-%` **42 行不变**、8 张保护表（剔本轮 uid）SHA-256 与清理前**一致**。
- 每日一练排行榜第 1 名「R576走查」随 `daily_set_entries` 删除消失（全站同题榜为真实用户保留）。

## 证据分类

- 已核实：CF RUM 字段值与本窗口无注入；题库覆盖数字；完成页实拍模块名；`reinforce_questions` 回退按 `submodule` 列（源码）；R575-1 机制与 175ms；清理 0 残留。
- 推断：「用户把模块名当考点/点了练同考点得到同模块题会困惑」是 UX 推断；`auto_install=true` + `ruleset.enabled=false` 的语义。
- UNTESTED（发版前）：生产 UI 完成页新展示名 / 「练同考点」请求带 `submodule` 原值 / 强化回包属同子模块；收藏删到 0 卡 `.kg-skel` 0；小程序真机（R536-1 累计）；真 offline/SW；跨设备；自然 `redo`/`stale_fallback` 样本。
