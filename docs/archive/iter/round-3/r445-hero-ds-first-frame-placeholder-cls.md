# R445 · 首页「今日全站同题」行首帧占位——消除回包后 hero 按钮 / 今日任务卡下顶 26 px（CLS #2）

- 日期：2026-09-06 · 部署 `3dc59fa`（前端 1 行模板 + vitest 1 文件 2 用例；后端不动、无 DB 写入）
- 承接 R444 §3：首页 CLS 0.071 = #1 0.0608（uni-app TabBar 50 px 占位伪元素，启动屏遮盖下）+ #2 0.0102（`/api/daily_set` 回包后 `<text v-if="dsMeta" class="hero-ds">` 插入 26 px）。

## 1. 取证补齐（R444 留的两个未验证项）

### 1.1 `dsMeta` 是否每日必有 → 是，且与 uid 无关
- `backend/app/qbank_api.py` `GET /api/daily_set` → `db.daily_set_questions(cn_day())` → `db.daily_set_ids(day)`：每模块按 `md5(day:qid)` 排序取 2 题、5 模块共 10 题；池 = `module=? AND disabled=0 AND is_real=1`，不足 2 题回落到不限 `is_real`。题库 15.7 万行、任一模块都远超 2 题 → **题组是按日确定的纯函数，任何一天都存在且恒为 10 题**；`items` 为空只在题库为空时发生。
- 结论：「今日全站同题 10 题」这行文案不依赖回包即可成立，占位无「显示了不存在的东西」的副作用；只有 `· 已有 N 人完成 / 来做今天第 1 人` 这一段依赖 `stats.participants`。

### 1.2 taskcard「−26 px」是什么 → 视口裁剪伪象，不是内容重排
- Playwright 对生产 4 种态（全 `/api` 拦截 / 只拦 `daily_set` / 只拦 `home_bundle` / 正常）量 `.taskcard` 与三行 `getBoundingClientRect`：**卡高恒 246、三行 61/61/72 恒定**，只有 y 在 599 ↔ 625 之间差 26 —— 差值完全由 `.hero` 高 126 ↔ 152（`.hero-ds` 19 px + 边距）决定。
- R444 看到的 `[11,593,390,230] → [11,619,390,204]`：`LayoutShiftAttribution.previousRect/currentRect` 按视口（823）裁剪，593+230 = 619+204 = 823 = 视口底 → 「高 −26」是裁剪结果。**#2 的全部成因就是 `.hero-ds` 插入 26 px。**
- 顺带：先前误把「只拦 `home_bundle`」当成 `dsMeta` 的来源——`dsMeta` 来自 `loadDailySet()` 的 `/api/daily_set`，与 `home_bundle` 无关（拦 `home_bundle` 时 `.hero-ds` 照样出现）。

## 2. 设计论证（SOP-02）
- 样本：R444 12 次（8 lhr + trace + Playwright ×4）+ 本轮 4 态 rect 对照，位移元素、分值、26 px 数值全部一致。
- 为什么真人比量测更受影响：量测机 `daily_set` 回包 ~20–190 ms，位移落在 splash 0.15 s 淡出窗口边缘；真人在移动网络上回包更慢（边缘缓存 60 s 命中也要一个 RTT），启动屏早已消失，26 px 下顶会直接看到——这是推断，依据是时序关系，无真人录屏。
- 方案取舍：
  - (a) **采用**：`.hero-ds` 改 `v-else` 常驻，`dsMeta` 未回时只显示「今日全站同题 10 题」+「补练往期 ›」；回包后追加参与数片段（同一行内文字变长，不改高度）。1 行改动，最终态像素与改前完全一致。
  - (b) 用 `apiSnap` 快照/`dailySet` 缓存在首帧回填 `dsMeta`：首访仍会位移，且 `api.js` 已有快照兜底在接口失败时回填，与 (a) 叠加即可、不必单做。
  - (c) `min-height` 占空行：文案不出现但占位，首帧视觉是一块空白，比 (a) 差。
  - 不动 #1（0.0608）：框架 TabBar 占位伪元素、启动屏下、非本产品代码。
- 风险：接口彻底失败时行内只有「今日全站同题 10 题补练往期 ›」，「补练往期」链路（`openDailyArchive` → 近 7 天 actionSheet）不依赖 `dsMeta`，可用。

## 3. 改动
- `frontend-uni/src/pages/home/home.vue` L101：`v-else-if="dsMeta"` → `v-else`；文案 `今日全站同题 10 题{{ dsMeta ? ' · ' + (…人完成/第 1 人) : '' }}`。
- `frontend-uni/tests/home-r445-hero-ds-cls.test.js`：锁 `.hero-ds` 两分支（`dsMeta && dsDone` / `v-else`）+ 后端 `daily_set_ids` 哈希选题、10 题口径。
- 本地：vitest 621（+2）/ eslint 0 / `build:h5` 绿（deploy 内含）。

## 4. 生产复验
- 部署 `deploy_h5.sh` rc=0：compose 首轮收敛 rc=0、health rev `3dc59fa`、healthy 0 重启、容器日志 5xx/Traceback/locked 0、旧容器 app-log 归档 3132 行；6b 12 项全 OK —— **`/` CLS 0.06（改前恒 0.07）**、LCP 2297、perf 0.95；`/tiku/` 1.00 / 944 / CLS 0。
- Playwright `layout-shift` sources ×3：`CLS total=0.0632 shifts=2` —— #1 0.0608 不变；**#2 变为 0.0024**：`hero-acts`/`taskcard` 不再出现，剩下的是「补练往期 ›」链接随参与数片段追加在同一行内**水平**右移 108 px（`[159,514,71,43] → [267,514,71,43]`）。
- testing agent（375×812 + 1440×900，探针头只读，录屏 `/home/ubuntu/screencasts/r445-regress/r445-regress-edited.mp4`）：正常态两视口 `.hero-ds` 单行无溢出；CDP 拦截 `/api/daily_set` + 清 `apiSnap` 快照后行显示占位文案、`.hero-acts`/两按钮/今日任务卡 y 与正常态 **Δ 0.0**；rAF 逐帧：首个含 hero 帧（220 ms）即占位文案，回包后 251 ms 追加参与数，`.hero-acts.top` 不变；「补练往期 ›」弹 7 天 sheet 可取消；全页 `<12px` `[]`、console 0、`/api` 真实非 2xx 0；清理 probe 遥测 2 行 → LEFTOVER 0。
- WAL 523 KB（部署重建后未变形态）。

## 5. 登记（不动）
- P4：剩余 0.0024 是链接水平位移（同一行文字变长），修法是把「补练往期 ›」固定右对齐（`.hero-ds` 改 flex 两端）——会改视觉排版，需 UI 判断；CLS 0.06 已在「良好」区间且余量充足，本轮不动。
- testing agent 发现：`api.js` `apiSnap:` 快照兜底让单 abort 接口不等于错误态（会回填并上报 `stale_fallback`）；1440 下 uni actionSheet 为 popover 无「取消」键、点遮罩关闭 —— 既有行为，记录供走查参考。

## 6. 事实 / 推断 / 未验证
- 事实：§1 源码与 4 态 rect；§4 全部数字；最终态像素不变（Δ 0.0）。
- 推断：「真人比量测更受影响」（时序推断，无真人录屏）。
- 未验证：小程序端不适用（无 H5 壳/TabBar 伪元素）；`stale_fallback` 上报口径未核是否计入看板。
- 留存（devin-box）：`/home/ubuntu/r444/taskcard_probe.py`（4 态 rect 对照脚本）、`/home/ubuntu/r445_deploy.log`、`/home/ubuntu/r445_test_report.md`、`/home/ubuntu/r445_artifacts/`。
