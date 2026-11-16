# R508：首页学习计划卡占位等高（生产 CLS 0.086 → 0.061）

日期：2026-09-08（UTC 2026-09-07 20:1x–20:4x）。分支 `devin/1788811123-r507-home-lcp-announce-contrast`（PR #639，与 R507 同 PR）。生产 `b0ed4c13` → `77bd47b5`。

## 0. 起点

R507 登记：生产 `/` 剩余 CLS 0.086 的主体是「学习计划卡 `cards` 骨架 288 px vs 实际卡 208/189 px」+ Tabbar `::after` 0.061。本轮先量再定是否等高。

## 1. (c) 补量 + 到期项（发版前，`~/r508_pre.sh` → `~/r508_pre.out`）

R507b 容器（20:08:19Z 起 180 请求）：5xx 0 / assets 404 0 / mpUA 0 / 非探针非 bot **0** / 非探针 POST 0 / 401·403 0 / Traceback 0；monitor 1 = 发版 6b Lighthouse（`140.232.64.4` moto g UA，`~/r508_mon.sh` 核）。WAL 4,124,152 B 同字节。DB（`mode=ro`）：probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、时政 qid 非空 0、harness uid 落库 0；`mistakes_total` 非探针触达 0；profile 已过/今天/未来 1/0/8。

公告「详情」非探针首次点击：非探针请求为 0，**无观察样本**（「详情」是纯前端展开、不发请求，只能从 `/api/announcement` 之后的非探针会话形态侧面看，本轮无会话）。无新的外部真人证据。

## 2. 量（改前生产 `b0ed4c13`，`~/r508_plan_skel.py` → `~/r508_plan_skel.out`；`~/r508_plan_geom.py`）

方法：CDP 接现有 Chrome，探针头 `X-Kg-Probe: 1`、注入 `anonUid`、非 GET `/api/**` 全 abort（0 写入）；`route` hold 住 `/api/home_bundle`，先量骨架（T0），放行后量真实卡（T1），读 `.kg-sec.sec-h`（下一节标题）top 作位移量。

| 态 | 视口 | T0 骨架高 / 下节 top | T1 卡高 / 下节 top | 位移 |
|---|---|---|---|---|
| 匿名新 uid（引导卡） | 375 | 288 / 660 | 207.69 / 580 | **−80** |
| 匿名新 uid | 1440 | 288 / 672 | 188.84 / 573 | **−99** |
| `umst3`（4 行任务卡）无快照 | 375 | 288 / 742 | 507.27 / 1044 | **+302**（含到期条 +83） |
| `umst3` 无快照 | 1440 | 288 / 754 | 507.27 / 1056 | **+302** |

引导卡子项（375）：`kg-sec` 32（margin-top 24）+ `plan-s` 37.7（两行）+ 按钮 44，card padding 16×2 + 边 1×2；1440 `plan-s` 单行 18.8。任务卡：`kg-sec` 44 + `plan-s` 18.8 + `plan-prog` 14.3 + `task` 61.5×4 + `focus` 30。

结论：高差是**态相关**的（引导 208/189、有计划 507+62×(n−4)），一个固定数对不上；且返回用户 24 h 内有 `apiSnap` 快照即显、根本不出骨架（本地 warm 复跑 T0 就已是 507 卡）。所以骨架真正出现的两种场景是：① 首次/无标记 → 必是引导卡；② `homePlanCard` 标记在、快照过期（>24 h）或被 LRU 淘汰 → 有计划卡。两者都可以在本地存储里提前知道。

## 3. 修（`77bd47b5`，前端 3 文件 + 源锁）

- `kg-skeleton.vue` 新预设 `plan`（`rows` prop）：`rows=0` → 68 + 38 + 44（引导卡三段），`rows=n` → 80 + 19 + 14 + 62×n + 30（头/副标/进度/任务/主攻），段间 `gap 12`（组件既有）。`cards` 预设不动（专项练习模块列表仍在用）。
- `home.vue` 骨架从裸 `kg-skeleton.sec` 改为 `<kg-card class="sec plan"><kg-skeleton preset="plan" :rows="planSkelRows" /></kg-card>`——与真实卡同 padding/边框/圆角；`planSkelRows = Number(getStorageSync('homePlanCard')) || 0`。
- `homePlanCard` 标记从 `'1'/''` 改为存任务行数（`plan-days-label.js` 新纯函数 `planCardMark(planToday)`：无画像 `''`、有画像 `String(tasks.length || 1)`）；旧标记 `'1'` 兼容（真值 → 仍占位，rows=1）。两处写入（`applyBundle`/`loadPlanToday`）同改。
- 源锁 `tests/home-r508-plan-skeleton-equal-height.test.js`（5 例：模板位置/预设高度表/`cards` 仍用于模块列表/`planCardMark` 真值表）；R507 源锁对预设数组的字面断言改为正则（只锁 `banner` 在列）。

## 4. 复验

本地 dist（`~/r508/distF` 经 `proxy.py :8826` 转发生产 GET，`~/r508/r508_plan_skel_F.py` → `F2.out`/`F3.out`）与改后生产（`~/r508/r508_plan_skel_prod.py` → `r508_plan_skel_prod.out`）读数逐值相同：

| 态 | 视口 | T0 骨架高 / 下节 top | T1 卡高 / 下节 top | 位移（改前→改后） |
|---|---|---|---|---|
| 匿名新 uid | 375 | 208 / 580 | 207.69 / 580 | −80 → **0** |
| 匿名新 uid | 1440 | 208 / 592 | 188.84 / 573 | −99 → **−19**（`plan-s` 宽屏单行） |
| `umst3` 标记 4 + 清 `apiSnap` | 375 | 509 / 963 | 507.27 / 1044 | +302 → **+81**（全部是到期条 `.due` 83 px，计划卡本体 +2） |
| `umst3` 同 | 1440 | 509 / 975 | 507.27 / 1056 | +302 → **+81** |

`docSW==cw`（375/1425）、`pageerror []`、非 GET 仅 `POST track`（abort）。

发版（`~/r508_deploy.log`）：预检 mem_avail 404 MB / 5.3 G / load 0.79 / 兄弟构建 0，`--skip-build` 一次 rc=0；容器 `20:27:52Z rev=77bd47b5` healthy 0 重启；bundle `index-C2Muma-_.js` 123 KB；7/7 200。脚本 6b：`/` perf 0.91 / a11y **0.94**（R429 间歇）/ LCP 3108 / **CLS 0.06**；`/tiku/` 1.00。本机对生产 ×3（`~/r508/lhr_prod_{1,2,3}.json`，lighthouse 13.4.1）：perf 0.98 / 0.94 / 0.85、a11y **1.00×3**、`color-contrast` 过×3、LCP 1874 / 2726 / 3695、**CLS 0.061×3**（唯一 shift 0.061 无 subItems = R507 已登记的 Tabbar `::after`）；FCP 1389 / 1854 / 2617 同步抬升、请求拓扑与 R507 完全相同（83 / 28 JS / 18 CSS / 24 img）→ LCP 波动是本机→生产网络本轮抖动，不是页面变化（R507 三次 LCP 1085–2319）。

发版后 (c)（`~/r508_post.sh` → `.out`）：R507b 容器总 354 请求 + 新容器 90 请求，5xx/404/mpUA/非探针非 bot/非探针 POST/401·403/Traceback 全 0；monitor 各 1 = 两次发版 Lighthouse；WAL 同字节；DB 到期项全部不变。

## 5. 登记（不改）

- 有计划 + 有到期用户在快照过期后仍有 +81 位移：来源是 `dueReview` 到期条（83 px，依赖 `plan.due_mistakes`）——可用同法（标记「上次有到期」）占位，但生产有到期的非探针 uid 只有 2 个且疑内部，等有量再做。
- 1440 引导卡 −19：`plan-s` 宽屏单行；骨架按 375 两行取 38 px，不为 19 px 加媒体查询。
- 旧 `'1'` 标记首个冷启动 rows=1（287 px ≈ 旧 `cards` 288），回包后即被行数覆盖。
- 本机 lighthouse 13.4.1 的 LHR 无 `largest-contentful-paint-element` 审计项（R507 生产三份同样没有），LCP 元素只能从本地 A/B 的 lhr2 读；本轮未核 LCP 元素。
- 均为本机 Lighthouse / CDP 采样，非真机 RUM。

## 6. 文件

`~/r508_plan_skel.py` / `~/r508_plan_skel.out`（改前生产）、`~/r508_plan_geom.py`、`~/r508/r508_plan_skel_F.py` → `r508_plan_skel_F{,2,3}.out`（本地 dist）、`~/r508/r508_plan_skel_prod.py` → `r508_plan_skel_prod.out`（改后生产）、`~/r508/lhr_prod_{1,2,3}.json`、`~/r508_pre.sh`/`.out`、`~/r508_mon.sh`、`~/r508_post.sh`/`.out`、`~/r508_deploy.log`。
