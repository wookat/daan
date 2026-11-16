# R505 · 首页「编辑」→ 学习计划设置表单 375/1440 只读整页审：已过考试日期的落点 / 校验 / 引导

日期：2026-09-08（CST）。分支 `devin/1788611745-r400-formula-dropped-snapshot`（PR #619，base=main）。
生产：`65580c6` → `40e5ee0f`（R505a，本地日期判定）→ `bf1807a6`（R505b，东八区日期判定）。

## 0. 结论

1. **(c) / 到期项 0 增量**；`mistakes_total` 非探针首次触达仍 **0**；R504 容器窗口 817 条「非探针非 bot」全部是 `34.186.44.79` 直打源站 `kaogong-origin.zalize.com` 的 `.env`/`.git/config` 扫描（403/404，0 条 <400），不是产品流量。
2. **命中（生产 runtime-confirmed，改前 375/1440）**：R504 让计划卡头显示「考试日期已过 · 点「编辑」更新」，但点「编辑」后的表单第 1 步把 `2026-09-07` 原样显示、无任何提示，「下一步」放行，第 3 步摘要仍是「国考 · 2026-09-07 · …」，「生成我的学习计划」会把已过日期原样 `POST /api/profile` 存回 → 首页提示与表单校验之间是**闭环死路**。
3. **最小修（前端 2 文件）**：日期框对已过日期显示「YYYY-MM-DD · 已过，请重选」+ 错误色/边框；第 1 步「下一步」拦截并 toast「考试日期已过，请重新选择」；「今天」取东八区日期 `cnTodayStr()`（与服务端 `plan.days_left` 同口径）。不改后端 `_days_left`/阶段/`/api/profile` 契约、不动生产库。
4. **R505a → R505b 的教训**：R505a 用浏览器本地日期 `fmtDateStr(Date.now())` 判「今天」，改后生产复验（harness 浏览器 UTC，17:2x Z 仍是 09-07）**未触发**——同屏计划卡头（服务端东八区）说「已过」、表单（浏览器本地）说没过。改为东八区日期后 375/1440 复验通过。

## 1. (c) 补量 + 到期项（VPS 上只读，`~/r505_post.sh` → `~/r505_post.out` / `~/r505_post2.out`）

| 项 | R504 容器（17:02:40Z→17:21:00Z） | R505b 容器（17:25:27Z→，56 请求） |
|---|---|---|
| 5xx / assets404 / mpUA | 0 / 0 / 0 | 0 / 0 / 0 |
| monitor | 1（17:21:31Z，`140.232.64.4` 探针网段、Lighthouse moto g UA，R505a 发版 6b 期间，internal=1；内容在中心侧无权限）| 0 |
| 非探针非 bot | 817 → 全部 `34.186.44.79` 源站扫描（`GET/POST /` 403、`/.env*`/`/.git/config` 403/404），0 条 <400 | 0 |
| 非探针 POST | 4 条 `POST / 403`（同一扫描器） | 0 |
| WAL | 4,124,152 B 同字节 | 同 |
| probe=0 `answer_log` / growth | 53/2 · 26/4 | 同 |
| `explain_cache qid` / `error_reason ≥09-11` / `*_ask_click` / nudge / `push_subs` | 0/82 · 0 · 0 · [] · 0 | 同 |
| `mistakes_total` 非探针触达 | 0（非探针 `home_bundle` 仅 R503 前 35 次） | 0 |
| harness uid 落库 | 0 | 0 |

生产 profile 分布（`mode=ro`）：`user_profile` 9 行，`exam_date` 全非空；已过 / 今天 / 未来 = **1 / 0 / 8**，唯一已过行 `umst3tui · 2026-09-07 · 国考`（R502 判疑内部设备）。

## 2. 表单只读整页审（`~/r505_setup_sheet.py <375|1440> umst3tuisd7lgzaka`）

harness：CDP 连既有 Chrome、`X-Kg-Probe: 1`、`anonUid` 注入 storage、非 GET `/api/**` 全 abort（本轮只拦到预期的 `POST track`）、不点第 3 步 CTA → 0 账号 0 库写入 0 LLM。

### 2.1 改前（生产 `65580c6`，`~/r505_setup_{375,1440}.out`）

| 读数 | 375 | 1440 |
|---|---|---|
| 计划卡头 | 考试日期已过 · 点「编辑」更新 | 同 |
| sheet 位置 | top 438 / bottom 812（贴底） | 287 / 613 |
| `docSW == cw` | 360 == 360 | 1425 == 1425 |
| 第 1 步标题 / 日期框 | 制定学习计划 · 考试信息（1/3） / **`2026-09-07`**（无提示，正文色，w 97.5×44） | 同 / w 101.6×44 |
| picker 初值列 | 2026 / 09 / 07（toolbar 取消 完成） | 同 |
| 点「下一步」 | **放行 → 目标（2/3）** | 同 |
| 第 3 步摘要 | **国考 · 2026-09-07 · 目标 70+ · 零基础 · 每天 60 分钟** / CTA「生成我的学习计划」 | 同 |
| pageerror / API GET | [] / 8×200 | 同 |

源码：`openSetup()` 只把 picker 时间戳夹到 `[dateStartTs, dateEndTs]`，`pf.exam_date` 字串不动；`setupNext()` 第 1 步只校验「非空」；`finishSetup()` 直接 `POST /api/profile` 带 `pf`。

### 2.2 R505a（生产 `40e5ee0f`，浏览器本地日期判「今天」）→ 未触发

`~/r505_setup_post_375.out`（首跑）：第 1 步仍 `2026-09-07` 无提示、放行到 3/3。原因：harness 浏览器 UTC，`fmtDateStr(Date.now())` = `2026-09-07` = `exam_date` → 不算已过；服务端 `days_left` 按东八区已是 09-08 → 卡头「已过」。**同屏两个「今天」**。

### 2.3 R505b（生产 `bf1807a6`，`cnTodayStr()` 东八区，`~/r505_setup_post_{375,1440}.out`）

| 读数 | 375 | 1440 |
|---|---|---|
| 第 1 步日期框 | **`2026-09-07 · 已过，请重选`**，class `pf-date past`，`rgb(185,28,28)`，w 184.2×44，fs 12.48px | 同，w 192×44，fs 13px |
| 点「下一步」 | **仍停 考试信息（1/3）**，toast **「考试日期已过，请重新选择」** | 同 |
| 第 3 步 | 未到达（harness 无 `step3` 键） | 同 |
| `docSW == cw` / pageerror / 非 GET | 360 == 360 / [] / 仅 `POST track`（abort） | 1425 == 1425 / [] / 同 |
| picker 初值列 | 2026 / 09 / 07（可重选；min 为当天） | 同 |

`over.bad` 在 picker 取消后出现 6 个 `left ≈ -99640/-360` 的 `DIV`：逐个核为 `uni-resize-sensor` 内部子元素（`visibility: hidden`，父 `uni-picker-view` 在已收起的 `wd-popup`，popup `y=812` 即视口下方），`docSW` 仍 == `cw` → 不是可见溢出（`~/r505_bad_probe.py`）。

## 3. 改动（`40e5ee0f` + `bf1807a6`）

- `frontend-uni/src/plan-days-label.js`：新增 `cnTodayStr(nowMs)`（`Date.now()+8h` ISO 日期）、`isExamDatePast(dateStr, todayStr)`（`YYYY-MM-DD` 字典序；空/非法 → false 交给「请先选择」）、`examDateFieldText(dateStr, todayStr)`。
- `frontend-uni/src/pages/home/home.vue`：日期框 `{{ pfDateText }}` + `:class="{ past: pfDatePast }"`；computed `pfDatePast`/`pfDateText` 以 `cnTodayStr()` 为今天；`setupNext()` 第 1 步 `pfDatePast` → toast 并 return；`.pf-date.past { color/border-color: var(--bad-strong) }`。
- 测试：`frontend-uni/tests/home-r505-setup-exam-date-past.test.js`（纯函数 + 东八区边界 15:59Z/16:00Z + 源锁）；`home-r504-plan-days-label.test.js` import 正则放宽为 `planDaysLabel[^}]*`。
- 门：vitest 811 / lint-pages 0 error / build 绿；pytest 516 / ruff / pyright 0（后端未改）。

## 4. 发版

| | R505a | R505b |
|---|---|---|
| 预检 | avail 5.1G / load 0.29 / 兄弟构建 0 | 4.6G / 0.38 / 0 |
| 容器 | `17:21:00Z rev=40e5ee0f` healthy | `17:25:27Z rev=bf1807a6` healthy restarts=0 |
| 7/7 200 | 是 | 是 |
| perf | `/` 0.96 LCP 2468 **a11y 0.94**（R429 已知间歇）/ `/tiku/` 1.00 | `/` 0.98 LCP 1562 a11y 1.00 / `/tiku/` 1.00 LCP 1004 |

## 5. 登记不改

- 后端 `/api/profile` 仍接受已过 `exam_date`（小程序端 / 直接调 API 可存回）；本轮只堵 H5 表单路径。是否服务端 400 拒绝待有非 H5 写入证据再定。
- 小程序端学习计划表单是否有同形态放行未核（W7 合 main 顺带）。
- 日期 picker `dateStart` 用浏览器本地日期（`new Date().toISOString()` 实为 UTC 日期），与 `cnTodayStr()` 可能差一天（UTC 16:00–24:00 窗口）；影响只是最早可选日期差 1 天，不影响已过判定。
- R505a 6b Lighthouse 期间 1 条 internal monitor 上报，中心侧内容无权限。

## 6. 文件

- 脚本/输出：`~/r505_post.sh` → `~/r505_post.out` / `~/r505_post2.out`；`~/r505_scan.sh` → `~/r505_scan.out`；`~/r505_setup_sheet.py` → `~/r505_setup_{375,1440}.out`（改前）/ `~/r505_setup_post_{375,1440}.out`（R505b）+ `r505_setup_{step1,picker}_{375,1440}.png`；`~/r505_bad_probe.py`；`~/r505_fe_gate.out` / `~/r505_fe_gate2.out` / `~/r505_be_gate.out`；`~/r505_deploy.log` / `~/r505b_deploy.log`。
