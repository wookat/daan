# R559：错因自评 chip 再点已选项取消（清为「未标注」）+ 恢复快照补写 `_mid`——研究 / 实修 / 生产复验

日期：2026-09-09。代码 PR #727（分支 `devin/1788932609-r559-reason-toggle`，自 main `3d432ede`＝#726），已合入 main `b26f9012`；热修 PR #728（分支 `devin/1788934027-r559-fix-resume-mid`，自 #727 合入后的 main），已合入 main `75911b52`。生产 `688d530c → 1479ebd6（#727）→ c8fabd0f（#728）`（bundle `index-DentoNH_.js` → `index-xA80XfKv.js`）。后端仅 `api_update_mistake` 归一/校验，PATCH 白名单 `{error_reason, mastered}` 不变。

## 1. 研究（先调查，再定项）

R558 登记的 R559 研究范围四项：① 错答后停留时长按 uid 分段（蒙题簇 vs 阅读）；② 练习页底部固定栏是否遮挡 `.after` 末端控件；③ 错因 chip 取消语义；④ 既有登记项 R541-1 / R555-1 一手核实。

### 1.1 生产只读证据（`~/r545/q559.py` / `q559b.py` / `q559c.py` / `q559d.py`，非测试 uid，`probe` 分账，30 天）

- 作答 310 行（40 uid；140 对 / 170 错）。`secs`：答对 p25/p50/p75 = 1/8/11s，答错 = 0/1/9s；**答错 170 行里 96 行 `secs ≤1`**（`secs=0` 大量存在，客户端计时口径）。
- 相邻作答推算「错答后停留」：n=98，p25/p50/p75 = 1.4/1.7/2.5s；答对后 n=100，1.5/1.6/2.0s。两者几乎重合于 1.2s 自动推进 + 网络往返的量级 → **推算值分辨不出「定时推进 / 手动下一题 / 阅读」**。
- 按 uid 分段（错答 ≥5 的 14 uid）：skip(<1s) 0 / glance(1–3s) 8 / read(≥3s) 6；快答（≤1s）140 行正确率 0.314、慢答 154 行 0.584；快答 100 行紧跟在答错之后，`fast_runs_ge3` 显示 5 个 uid 存在 ≥7 连快答（蒙题簇：`umst3tui` 18 连、`u26` 13 连、`u17` 9 连×3）。
- 首答 47 uid：16 对；「答错且快」8 uid 里 6 继续、「答错且慢」23 uid 里 14 继续、「答对且慢」13 里 7 继续 → 首答对错与是否继续无可判差异（样本小）。
- `practice_stay_here`（R558 埋点）自然行 0（688d530c 上线 <1 天，无样本）。`uid_with_mistakes_30d=52`、`uid_with_review_30d=8`（R553/R555 已登记的复习转化缺口，不变）。

### 1.2 源码一手核实

- ② 底部固定栏：`practice.vue` `.after` 末端（AI 详解 / 纠错按钮）之后有为移动端固定底栏预留的 padding（`safe-area` + 底栏高度），生产 R558 复验截图（375）末端控件完整可见 → **无遮挡一手证据，不立项**。
- ③ 错因 chip：H5 `practice.vue setReason(rz)` 直接 `q._reason = rz` 并 PATCH；`kg-chip-row` 点已选项再发同值；`book.vue` 复习区/模考 `report.vue` 同形态——**任何一端都不能取消已选错因**（只能改选）。R558 复验已如实记「重复点击不取消（既有）」；唯一可取消的是错题本「更多操作」层（R410 handler 级 `next = m.error_reason === rz ? '' : rz`），四处语义不一致。后端 `api_update_mistake` 对 `error_reason` 无校验（任意字符串入库）。
- ④ R541-1（完成弹层「已掌握」直达）：生产 `mastered=1` 非测试仍无经复习达阈值的自然样本 → 继续等；R555-1（`practice.vue` 计时分支 UI 不可达）：0 用户感知，继续 P4 登记不顺手改。

### 1.3 对标（如实区分一手/二手）

粉笔错题本官方页仅二手证「条目含错因归因」，未证「已选错因可否取消」；夸克无一手证据。**不据竞品推断**，本轮立项依据是自家四处语义不一致 + 更多操作层已存在可取消的既有约定。

### 1.4 研究结论与择一

- ① 停留时长：数据不能分辨定时/手动/阅读，蒙题簇是「刷题模式」而非「看不到解析」→ **不改 1200ms、不改默认**，继续等 `practice_stay_here` 自然样本。
- ② 底部栏：无遮挡证据 → 不立项。
- ③ 错因取消：确定性缺口且四处不一致 → **立项实修**（H5+小程序 练习页 / 复习页 / 模考报告 + 更多操作层同口径），后端空归一 NULL + 非四档 400。
- ④ R541-1 / R555-1：继续登记。

## 2. 实修 #727（H5+小程序+后端）

- 共享 chip：H5 `kg-chip-row` / 小程序 `kg-chip-row` 新增 `toggle`（默认 false，筛选行为不变），`toggle && 已选 → ''`。
- 练习页：H5 `setReason` / 小程序 `onSetReason` `next = _reason === rz ? '' : rz`，有 `_mid` 才 PATCH `{error_reason: next}`。
- 复习页（`book.vue` 复习区 / 小程序 book）：复习 chip 开 `toggle`，`''` 走 PATCH，`review_reason_tag` 空记 `未标注`；**更多操作层保持 R410 handler 级取消、不开组件级 `toggle`**（否则双重翻转，`tests/book-r410-audit.test.js` 源锁会红——实现中撞过一次，已改回）。
- 模考报告（H5 `pkgA/exam/report.vue` / 小程序 report）：`prev/next` 计算、PATCH 失败回滚到 `prev`、`aria-pressed` + 「已选中，再点取消」aria-label。
- 后端 `study_api.api_update_mistake`：`error_reason` trim 后须 ∈ `MANUAL_REASONS`（粗心大意/概念不清/方法不会/纯蒙的）或空；空/None → SQL `NULL`；否则 400「错因不在可选范围」；uid 隔离与 `mastered` 不变。
- 测试：`frontend-uni/tests/r559-reason-toggle.test.js`、`miniapp-native/scripts/reason-toggle.test.ts`（chip 默认/toggle、四处取消、R410 兼容、报告 a11y+回滚、后端归一源锁）。
- 本地门：H5 vitest 1281 / eslint+tokens 0 / build:h5；小程序 tsc / eslint 0 / vitest 62；后端 pytest / ruff / pyright 0（`--pythonpath venv-kg`）；diff --check 空。

## 3. 生产复验一（独立 testing agent，`1479ebd6` / `index-DentoNH_.js`）

报告 `~/kaogong-reports/r559-reason-toggle-1479ebd6-prod-verify.md`，证据 `~/r559v-1479ebd6/`（`events.jsonl` / `network-audit.json` / `backend-checks.json` / `row-*.json` / `clean.json` / `readonly-after-clean.json`），录像 `~/screencasts/r559-1479ebd6-{mobile,desktop,regression}/`，#727 评论附截图。uid `test-r559v-8ad06a2a`，冷隔离 context，全程 `X-Kg-Probe: 1`。

| 项 | 结果 | 核证 |
|---|---|---|
| A fresh 练习 375 | PASS | Q2 MID4031 答错 → 概念不清 `aria-pressed=true` → 同 chip 取消四项全灭 → 方法不会；PATCH 200 与 DB 三态一致（值 / NULL / 值）；Q3 不选可推进 |
| B 复习 375 | PASS | 队列 1/3 MID4030 答错 → 选 → 同项取消；PATCH `""` 200、DB NULL；`review_reason_tag=未标注` track 200 `probe=1` |
| C 更多操作 375（回归） | PASS | 精确 MID4030 选 / 取消 / 改选，卡面标签出现 → 消失 → 改选 |
| D 模考报告 375 | PASS | 真实 2025 四川 75 题计时模考答 2 交卷 → attempt397 → MID4033 `pressed true→false`、PATCH `""` 200、DB NULL |
| D 失败回滚 | PASS | 仅拦截本 MID 取消 PATCH → 错误 toast、UI 回到选中、DB 保持；解除后重试 200 NULL |
| E 后端 | PASS | `随便` 400；`null` 200 → NULL；`" 粗心大意 "` 200 trim；`mastered=1` 200 reason 不变 |
| F 1440 抽检 | PASS | 练习 MID4035 选/取消、更多操作选/取消/改选、卡面同步 |
| G R558 顺序 / 非 toggle 筛选 / 再来一组 1/10 / R555 到期标签 | PASS | 顶部错因筛选再点仍选中（默认非 toggle）；到期标签用 1 条披露的未答 API fixture（30 分钟已答排除） |
| **恢复路径** | **FAIL（既有，非 R559 回归）** | 答错 → 立刻「退出并保留」→ 首页续练恢复 → 快照该题 `_saved:false` 无 `_mid` → 点错因只改 UI 不发 PATCH、DB 停在旧值 |

审计：520 请求 / 518 响应全 200（209 API，probe 缺头 0）；2 次有意 abort（回滚用例）及其 resource error 分账；授权 curl 3×200 + 1 预期 400 另计；console/runtime/rejection/loading warning/付费 AI-OCR 0；harness 异常 5 次（定位超时 4、toast 双节点 1）已纠正单列；早期全量 hash 快照与 UI 变更交叉作废、改串行 UID/MID-only `mode=ro` 快照重做。清理：41 表精确删 38 行，exact/prefix 残留 0，五类 hash/count 起终一致。

### 3.1 恢复路径缺陷根因与热修 #728

- 根因（源码）：H5 `onPick` → `saveWrong()`（异步 POST `/api/mistakes`）→ 同 tick `saveSession()` 落 `pendingSession`；`_mid/_saved` 在回包后才赋到 `q` → 快照永远缺这两字段。R548 起启动即落快照、R557 起每日一练也走此路径，问题早于 R559；R559 只是让「恢复后点错因」第一次被独立复验盯到。小程序 `saveSession` 序列化 `data.items`，而 `_mid` 赋在 `q` 引用上，同样丢。
- 修法（#728，最小改动）：H5 `saveWrong()` 回包/入队后 `if (this.session && this.items.some((x) => !x._picked)) this.saveSession();`——守卫「退出不保留」（`leave()` 已置 `session=false` 时不重建快照）与「全答完」（走原 `saveSession` 清快照分支）；小程序 `saveWrong` 回包后 `setData(items[i]._mid/_saved)` 再 `saveSession()`，`finished` 时不写。源锁 `r559-reason-toggle.test.js` / `reason-toggle.test.ts` 各 +1。
- 本地门：H5 vitest 1282 / eslint+tokens 0 / build:h5；小程序 tsc / eslint 0 / vitest 64；diff --check 空。
- 生产：`deploy_h5.sh --skip-build` `1479ebd6 → c8fabd0f`（宿主 other_builds=0、disk 3.1G、mem_avail ~300MB，compose 单次 rc=0；LH `/tiku/` LCP 938ms / CLS 0，性能预算全过，回归全 200）。

## 4. 生产复验二（`c8fabd0f`，热修专项）→ 两条真实 FAIL → 二修 #729 → 复验三（`bf36ec10`）全 PASS

### 4.1 复验二（`c8fabd0f` / `index-xA80XfKv.js`，`~/kaogong-reports/r559-fix-c8fabd0f-prod-verify.md`、`~/r559f-c8fabd0f/`、录像 `~/screencasts/r559f-c8fabd0f-resume/`）

| 项 | 结果 |
|---|---|
| A 自然「退出并保留」（回包先于退出） | PASS：恢复 MID 4037，选/取消/改选 PATCH 200 与 DB 一致 |
| B **物理 F5**（答错后立刻） | **FAIL**：QID 321497 恢复后无 `_mid/_saved`，选「概念不清」只亮 chip 0 PATCH，MID 4038 `error_reason` 留 NULL |
| A-late **真实回包晚于「退出并保留」** | **FAIL**：QID 295266 同上，MID 4040 留 NULL |
| C 等回包再退出 | PASS（4039） |
| D 挂响应 → 「不保留（结束本组）」→ 放行 | PASS：不重建 `pendingSession`（MID 4041 服务端存在） |
| E fresh 取消 / 答完 10 题→「再来一组」 | PASS（4042；完成后快照清、新组 1/10） |
| 清理 | 41 表精确删 33 行，残留 0，五类 hash 一致 |

根因（源码 + 复验现场）：#728 只在 `this.session && 有未答` 时补写快照，覆盖的是「回包时页面仍在作答态」；① F5 让页面连同未回包的 POST 一起消失，快照只剩 `_picked`；② 「退出并保留」后 `session=false`，晚到的回包不再写快照。两种情况恢复后错因自评都没有 mid 可 PATCH。

### 4.2 二修 #729（H5+小程序，0 后端）

- 恢复时回填 `relinkWrongMids()`（本地 `adoptLocalPending` / 远端 `adoptRemoteSnap` 后）：items 里「答错且无 `_mid`」→ GET `/api/mistakes?uid=` → `relinkMistakeIds()` 题库题按 `question_id`、内联/时政题按题干首行匹配，命中回填 `_mid/_saved`，`_reason` 为空采服务端 `error_reason`；用户在回包前已本地选的错因优先并补发一次 PATCH；回包期间换组/退出/结算作废（H5 比 `items` 引用；小程序 `_adoptSeq` 计数，不依赖 `setData` 是否保引用）。
- 晚回包 `saveWrong()` 尾：作答态照旧 `saveSession()`；否则 `patchPendingMistake()` **只补已存在的快照里同题无 `_mid` 的项**，「不保留」已清快照 → `null` 不重建（保住 D 守卫）。小程序补 `_unloaded`（`onUnload` 置位）区分「已退」与「结算」；`toPQ()` 不再把 `_saved/_mid/_reason` 硬重置，改保留快照值；`cur` 与 `items[idx]` 在 `setData` 后可能不同引用（既有 `onPick` 就同时写两处），回填时先把 `cur._reason` 同步到 `items[idx]`，回填后再把 `_mid/_saved` 写回 `cur`。
- 边界（有意不做）：F5 打断的 POST 若服务端根本没收到，回填无源仍为本地态，不重发 POST（避免重复计 `times`）。
- 测试：纯函数 `tests/r559-relink-mid.test.js`（+8）/ `scripts/relink-mid.test.ts`（+3）；源锁 `r559-reason-toggle` 改为新尾部、`r548` import 精确串锁改正则。本地门：H5 vitest 1291 / eslint+tokens 0 / build:h5；小程序 tsc / eslint 0 / vitest 69；diff --check 空。
- 生产：`deploy_h5.sh --skip-build` `c8fabd0f → bf36ec10`（`index-rRBN2L-8.js`；宿主 other_builds=0、mem_avail 357MB、disk 2.8G(95%)，compose 单次 rc=0；LH `/` 0.98/1.00/1.00/1.00 LCP 1760ms、`/tiku/` LCP 902ms，预算全过，回归全 200）。#729 老板侧已合入 `7d3c783b`。

### 4.3 复验三（`bf36ec10`，独立 testing agent；`~/kaogong-reports/r559-fix-2-bf36ec10-prod-verify.md`、`~/r559f2-bf36ec10/`、录像 `~/screencasts/r559f2-bf36ec10-{mobile,desktop}/`；uid `test-r559f-9ac8bc41`，#729 评论附截图）

| 项 | 结果 |
|---|---|
| B 物理 F5 375（POST→新 Document 91.20ms） | PASS：弹窗阶段无 MID → 「继续」GET 回填 4043 `_saved=true` → 选/取消 PATCH 200，DB 值 → SQL NULL |
| A-late 真实响应挂 9.39s、退出保留后放行 | PASS：完整快照 diff **仅** item0 新增 `_mid 4044`、`_saved false→true`，题序/picked/idx/t 全同；恢复后选/取消 PATCH 200 |
| A-late-2 响应丢弃（服务端已存 4045） | PASS：续练 GET 回填 → PATCH 200/DB 一致；产品离线队列自然重试 1 次 POST 仍同 MID、无重复行（分账） |
| D 守卫（挂响应 → 「不保留」→ 放行） | PASS：放行后 2.3s 与首页复查均无 `pendingSession`/续练卡；MID 4046 服务端存在不代表重建 |
| E 自然路径 | PASS：选→取消→改选恰 3 次 PATCH 200，DB 值→NULL→新值；已有 MID 恢复 0 额外 GET/PATCH |
| F GET 回包前先选错因（GET 挂 8.72s） | PASS：放行前 0 PATCH/DB NULL → 放行 ~9ms 后自动 PATCH `粗心大意` 200，DB 一致 |
| B 1440（56.49ms 后 F5） | PASS：回填 4049，选/取消 PATCH 200，DevTools 只读核 MID 数字 |
| 小程序 | UNTESTED（无真机通道） |

审计：836 捕获请求 = 826 配对 200 + 10 取消（8 自然 F5 + 1 挂起后 F5 + 1 有意丢弃）；另 2 个 DevTools 同期孤立 200 无 request/ExtraInfo，头不可独立核证（如实）；4 次 relink GET、11 次 PATCH、8 次 POST（7 真实错答 + 1 离线重试）；probe 缺头 0；console/runtime/rejection/loading warning/付费 0；收尾 Python urllib 读 health 一次 403、curl 同 URL 200（与 R554 同形态，单列 harness 偏差）。清理：41 表精确删 25 行，exact/prefix 残留 0，五类 hash/count 起终一致、无并发漂移。

## 5. 如实 / UNTESTED

- 小程序四处（chip toggle / 练习 / 复习 / 报告）、`saveWrong` 写回与 `relinkWrongMids/_unloaded/_adoptSeq` 仅单测 + tsc/eslint，未上真机（R536-1 累计）；`cur` 与 `items[idx]` 在 `setData` 后是否同引用未实测，代码按「可能不同」防御。
- 复验三 UNTESTED：远端/跨设备快照回填、内联/时政题题干首行匹配（仅单测）、「挂响应 → 答完整组 → 放行」的守卫分支（两轮 D 均用「不保留」分支，整组完成后晚回包仅单测 `patchPendingMistake(null)→null`）、F5 打断且服务端未收到 POST 的无源分支（有意不重发）。
- 1440 仅练习/更多操作抽检，复习/报告未测；R555 完整 exclude 边界未测；后端四个合法 reason 未穷举（1 个 + trim）。
- 停留时长结论基于客户端时间戳推算，`secs=0` 口径与 1200ms 自动推进叠加，**不能反推阅读行为**；`practice_stay_here` 无自然样本。
- 底部栏「无遮挡」基于源码 padding + R558/R559 375 截图，未做逐机型 safe-area 实测。
- 仓库无环境蓝图且本会话无蓝图权限（本轮无新装依赖）。

## 6. 下一步（R560 候选）

1. `practice_stay_here` ≥3 天自然样本回看；错因填写率（基线 30 天 2.5%）在 R558 下移 + R559 可取消后 ≥7 天回看（probe 分账）。
2. 蒙题簇（≥7 连快答 5 uid）是否值得「刷题模式」产品化（如关掉解析直接下一题 / 完成页汇总）——需先看这些 uid 是否回访，不拍脑袋。
3. 自然 `via='answer'` / `source='daily'` 继续观察；R541-1 / R555-1 继续登记；小程序真机；probe 真人口径。
