# R482：非探针用户真实路径逐步骤盘点（分享 → 首页 → 面试/问答）→ 命中「真人 monitor 行 2/2 全是跨源脱敏 `Script error.`、各触发一次中心告警」→ H5 `window.onerror` 最小过滤（`21bd0c6` → `b36354c`）

日期：2026-09-07 07:15Z–。改动 2 文件（`frontend-uni/src/monitor-client.js` +6 行导出函数、`frontend-uni/src/main.js` +1 行闸）+ 单测/源锁（`tests/monitor-client.test.js`）；0 后端、0 库写入（§5 一次 `X-Kg-Probe: 1` 探针 track 除外，probe=1）。

## 0. 结论

1. **分享链路逐步骤留存（非探针、Caddy 全文件 + DB 只读）**：分享码 `fqpexz7g`（qid 283184，创建者 `umst3tuisd7lgzaka`，`open_count=2`）→ `141.11.46.193` VivoBrowser 08:55:46Z 打开 `/s/fqpexz7g` → `share_open` 埋点 + `GET /api/share/fqpexz7g` 200 → **3 min 26 s 后**首页全套 state 读（`review/cur` / `practice/resume` / `exam/resume` / `home_bundle` / `ask/cur` / `ask/sessions` / `recommend` / `growth` / `stats` / `predict` / `mastery/map` / `mistakes`）→ 面试 `categories` ×1 + `question` ×1（R475/R476 已核）→ 10:43Z 再回分享页、10:46Z 成长页（此时出口 IP 已切到 `182.108.230.77`，与 R477「网络切换」同形态）。**每一步都只有读**：`shared_answers` 0 行、`answer*` 0、`interview_sessions` 无其行、`ask` 提交 0。断点 = 分享页「作答」这一步之前——但只能说「日志未观测到写」，分不出放弃与缺陷，**不立项**（R476 同判）。
2. **命中（本轮新）——中心监控里真人上报 2/2 全是不可定位噪音**：中心 `errors` 表 kaogong 153 行里 `internal=0` 且非本机出口的只有 2 行（id 1123 / 1124），都是上面这位 VivoBrowser 用户在分享页 / 成长页触发的 `message="Script error."`、`stack=NULL`。Caddy 全部 9 个 kaogong-origin 文件交叉：`POST /api/monitor/report` 共 114 条，非 `140.232.64.0/24` 且非探针的只有这 2 条（10:43:18Z `141.11.46.193`、10:46:49Z `182.108.230.77`，同 UA）。即 **H5 全站错误监控上线以来真人产出 = 2 条、可定位信息 = 0**。
3. **`Script error.` 语义（一手核）**：HTML 规范——跨源 classic script 抛错时，`window.onerror` 只拿到 `"Script error."`、`filename=""`、`lineno=0`、`error=null`。本页能发出的脚本：主 bundle `<script type="module" crossorigin src="/assets/index-*.js">`（同源）、两段内联（splash / route-preload，同源），CSP `script-src 'self' 'unsafe-inline' https://career.zalize.com` 中 `career.zalize.com/nav.js` 已下线且前端源码 0 处加载它、0 处 `createElement('script')`；SW 内的错误不冒泡到页面 `onerror`。→ 这两条只可能来自**页面外注入脚本**（浏览器厂商 / 系统 WebView 注入为最常见来源；这一步是推断，端侧无法取到脚本 URL）。**它们不是本站代码抛错的证据，也永远不可能定位**。
4. **为什么值得改（不是微修）**：中心 `checkAndAlert()` 对 `internal=0` 行 15 min 窗口 **≥1 条即发告警邮件**（按站点 1 h 节流）——按代码，这 2 条各自触发了一封「kaogong js: 1 条」告警（10:43Z / 10:46Z 相隔 3.5 min，第二封被 1 h 节流吞掉；实际是否送达未核，D1 `alert_state` 无读接口）。真人越多、这类噪音越多、告警越不可信；而它 0 信息量。业界同判：Sentry `DEFAULT_IGNORE_ERRORS` 第一条就是 `/^Script error\.?$/`（一手：`getsentry/sentry-javascript/packages/core/src/integrations/eventFilters.ts` L12–13）。
5. **修法（最小、端侧、不动中心 / 后端）**：`monitor-client.js` 新增 `isMaskedCrossOriginError(e)` = `message` 匹配 `/^Script error\.?$/` **且** `!e.error && !e.filename`（三者缺一不过滤：带 filename 的同源错误、带 error 对象的都照常上报；`message` 不完全等于也照常）；`main.js` 的 `window.addEventListener('error')` 第一行加 `if (isMaskedCrossOriginError(e)) return;`。`unhandledrejection` / Vue `errorHandler` / chunk-load 路径不受影响。不在后端过滤：后端拿不到 `filename/error`，只能按字符串硬丢，会误吞将来某个真的以「Script error.」开头的自定义消息。
6. 门：vitest **719/719**（+2：函数 8 断言 + `main.js` 源锁）、`npx eslint src tests` **rc=0**、`npm run build:h5` 绿（bundle `index-kGPUzEDT.js`，内含 1 处 `Script error` 字面量）。
7. **部署（如实）**：`deploy_h5.sh --skip-build` 走到 1/6–3b（rsync + 边缘预热 23/23 200）后在 4/6 让行等待中**被我手动中止**——宿主此时 `/dev/vda2` **非 root 可用 0 B**（`df` 100%，50 G 用 48.5 G），是 `/opt/SoftCopyrightAgent` 兄弟项目 `docker compose up -d --build` 在跑（pid 1136032，起 ~07:25Z，构建层 + buildkit 缓存吃满盘）。此时重建 kaogong 镜像必失败且会加剧盘压，故不发；线上仍 `21bd0c6` / `index-DJhppeDm.js`，容器 healthy 0 重启。**盘满对线上写入的影响已一手核**：容器内进程 uid 0 可用 ext4 root 保留块（`Reserved block count 550432 × 4 KB ≈ 2.1 GB`），07:40:37Z 探针 `POST /api/track`（`X-Kg-Probe: 1`）200 且 `growth_events` id 2042 probe=1 落库、WAL 仍 4,124,152 B、app-log 无 `disk is full`/Traceback → **当前用户写入未受影响**；但 dockerd 同为 root、保留块也会被兄弟构建吃掉，若吃穿则 SQLite 写入 `SQLITE_FULL` → 500。见 §6 待发版说明。
8. 到期项与观测项（§4）：非探针 `mistakes/analysis` **仍 0**、`explain/stream` 第 2 对 **未出现**、`umst3tuisd7lgzaka` **0 回访**、`error_reason` ≥09-11 **0**；(c) R481 容器起后 57 请求（55 2xx / 1 3xx / 1 4xx）全本机出口，`/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0。

## 1. 分享链路逐步骤（非探针，只读）

| 步骤 | 一手证据 | 结果 |
|---|---|---|
| 分享创建 | `shared_questions` id 29 `sid=fqpexz7g` qid 283184 `from_uid=umst3tuisd7lgzaka`（考友7HPZ）`created_at 2026-09-06 08:55:39` `open_count=2` | 创建者 = 原生小程序非正式版那台 vivo（R476） |
| 分享页打开 | Caddy `141.11.46.193` 08:55:46.812 `GET /s/fqpexz7g` 200 → :49.184 `POST /api/track`（`share_open`，`growth_events probe=0` 里 `share/share_open` 2 条之一）→ :49.205 `GET /api/share/fqpexz7g` 200 → :49.543 `GET /sw.js` | 7 s 后打开（分享者与被分享者同城同时段，是否同一人未核） |
| 分享页作答 | `shared_answers` 该 share_id **0 行**；Caddy `POST /api/share/*/answer` 0 | **断点**：未作答 |
| 进首页 | 08:59:12.876 起 `review/cur` / `practice/resume` / `exam/resume` / `home_bundle` 4 并发 → :13.89 `ask/cur` + `ask/sessions` → :20.99 `recommend` / `exam/attempts` / `growth` / `stats` / `predict` / `mastery/map` → :22.27 `mistakes` → :28.96–:30.48 再一轮 state 读 | 分享页 → 首页 3 min 26 s；首页停留 ~18 s 内已扫过 TabBar 各页 |
| 面试 | `interview/categories` ×1 → `question` ×1（R475 核） | 出题后 3–4 s 已去别页；`interview_sessions` 无其行 |
| 问答 | 6 次进页、0 提交（R477） | — |
| 回访 | 10:43:18Z 分享页（monitor 1123）→ 10:46:49Z 成长页（monitor 1124，出口已切 `182.108.230.77`） | 1 h 45 min 后回访、仍无写 |
| 后续 | 09-06 10:47Z 后该 UA / 两 IP 0 请求 | — |

结论：整条路径 **0 次写入**。分享页是首个断点，但「看了没答」在无端侧事件的前提下与「作答控件有缺陷」不可分；R428 已核 `share-q.vue` 单选交互 + R450 整页过审无命中，不立项。

## 2. monitor 真人行全量（中心 D1 + Caddy 交叉）

中心 `GET /api/errors?site=kaogong`（153 行；从 VPS 用 deploy `.env` 的 key 查、不落地）：`internal=0` 行里剔除 `140.232.64.0/24`（本机出口，`KG_PROBE_CIDRS` 内；`internal` 标记 R392 上线前的历史行全为 0）后只剩：

| id | ts(Z) | kind | message | stack | url | ua |
|---|---|---|---|---|---|---|
| 1123 | 09-06 10:43:18.345 | js | `Script error.` | NULL | `https://kaogong.zalize.com/s/fqpexz7g#/` | V2405A … VivoBrowser/30.2.25.1 |
| 1124 | 09-06 10:46:49.673 | js | `Script error.` | NULL | `https://kaogong.zalize.com/#/pages/stats/stats` | 同上 |

Caddy 9 个 `kaogong-origin.zalize.com-access*` 文件 `POST /api/monitor/report` 共 **114** 条：112 条出口 `140.232.64.3/4/5`（Chrome 137 / HeadlessChrome / `Devin/1.0` UA / iOS Safari 仿真）或 `150.109.230.174`（09-05 R392 探针，`X-Kg-Probe: 1` + python-requests）；剩 **2** 条即上表（10:43:18 `141.11.46.193`、10:46:49 `182.108.230.77`，都无 `X-Kg-Probe`）。→ 「真人 monitor 行」口径 = 2/2 = 100% 为脱敏 `Script error.`。

## 3. 为何断定不是本站代码抛错

- 规范：跨源 classic script 未带 CORS 时，`error` 事件 `message="Script error."`、`filename=""`、`lineno=colno=0`、`error=null`（HTML spec「report an exception」muted errors）。
- 本页脚本清单（`dist/build/h5/index.html`）：`<script type="module" crossorigin src="/assets/index-*.js">`（同源）、内联 splash 兜底、内联 route-preload；CSP（`deploy/cf-pages/_headers` / Caddy 同款）`script-src 'self' 'unsafe-inline' https://career.zalize.com`；`career.zalize.com/nav.js` 已下线（`deploy/README.md` L64），前端源码 `rg career.zalize` 只有个人页 3 个外链 `<text>`；`rg "createElement\('script'"` 0；SW 错误不冒泡到页面。
- 同源模块脚本抛错会带完整 message + `error.stack`（本站 R391/R392 历史 `chunk-load` / `vue:` 行都带）。
- 所以：能产生脱敏行的只剩注入脚本（厂商浏览器 / WebView / 插件）。VivoBrowser 30.x 有内置阅读模式 / 广告过滤等注入脚本是公开可查的常识，但本轮**未拿到该脚本 URL**（端侧拿不到），这一步保留为推断。

## 4. 到期项 / 观测项（07:15Z，`/home/ubuntu/r482_host1.out`）

| 项 | 值 | 增量 |
|---|---|---|
| `answer_log probe=0` | 33 行 / 1 uid | 0 |
| `growth_events probe=0` | 20 行 / 4 uid（`h5/boot` 3、`home/comeback_view` 2、`practice_done/review_entry_click` 2、`profile/reminder_optin` 2、`share/share_open` 2、`share_q/share_copy` 2、`stats/heatmap_view` 6、`ziliao/review_similar_auto` 1） | 0 |
| `error_reason` 非空 / ≥09-11 | 7 / 0 | 0 |
| `push_subs` / `weekly_reports` / `exam_attempts probe=0` | 0 / 2 / 1 of 64 | 0 |
| WAL | 4,124,152 B | 0 |
| 容器 | `21bd0c6` started 07:06:34Z healthy 0 重启 | — |
| (c) R481 容器起后 | 57 请求（55 2xx / 1 3xx / 1 4xx）全本机；`/assets/*` 404 0、5xx 0、monitor 0、小程序 UA/Referer 0 | — |
| 非探针 `mistakes/analysis` / `explain/stream` 第 2 对 / `umst3` 回访 | 0 / 未出现 / 0 | — |
| 历史 503 | `wxlogin` ×4 + `health` ×1，全在 R481 容器窗口外（09-06 00:11 / 08:55 ×2 / 21:38Z），不归本 rev | — |

## 5. 盘满期间线上写入一手

- 07:38Z `df -h /`：50 G / 47 G 用 / **6.2 M 可用 100%**；07:40Z **0**；`docker system df`：Images 7.9 G（可回收 619 M）、Build Cache 4.3 G（可回收 858 M）、Volumes 11.4 G。
- 占盘进程：`/opt/SoftCopyrightAgent` `docker compose … up -d --build`（pid 1136032，07:38Z 时已跑 776 s）；同时段 autoheal 07:35Z 重启过一次（`deploy-autoheal-1 Up 3 minutes`，对 kaogong 未动手：kaogong `StartedAt` 不变、`RestartCount 0`）。
- 07:40:37Z 探针写：`POST https://kaogong.zalize.com/api/track` `X-Kg-Probe: 1` `{"event":"boot","uid":"uprobe_r482_diskfull","ref":"r482_diskfull_probe"}` → 200 `{"ok":true}`；只读库 `growth_events` id 2042 probe=1 已落；WAL 字节不变（4,124,152，wal 复用页）；app-log 无 `disk`/`full`/`Traceback`/`OperationalError`。
- 机理：`docker exec deploy-kaogong-1 id -u` = **0**；ext4 `Reserved block count 550432`（×4096 ≈ 2.1 GB）只对 root 开放 → 非 root `df` 见 0 时 root 进程仍可写。**兄弟构建（dockerd 也是 root）会继续吃这 2.1 GB**，吃穿即 kaogong `SQLITE_FULL`。

## 6. 部署说明与待发版

- 本轮 `b36354c` 已推分支（#619），**未上线**：`deploy_h5.sh --skip-build` 在 4/6「让行等待」阶段（脚本自带：宿主有其它 compose build/prune 时最多等 300 s、超时不阻塞）我在 ~240 s 时手动中止——超时后脚本会直接起 kaogong 镜像重建，在 0 B 可用盘上必失败并可能把旧容器停掉（compose `up --build` 失败路径）。已完成的 1/6–3b 只是 rsync 到 VPS 部署目录 + 边缘预热，对运行中容器无影响（镜像内 dist，非 bind 挂载：`docker inspect Mounts` 只有 `/data` 卷与 `/reports`）。
- 后台 `r482_diskpoll.sh` 每 30 s 记 `df` / 构建进程数（`/home/ubuntu/r482_disk.log`）；兄弟构建结束、盘回到 ≥1 G 可用后重跑 `deploy_h5.sh --skip-build`，复验：`/api/health` rev `b36354c`、bundle `index-kGPUzEDT.js`、生产 375 注入 `dispatchEvent(new ErrorEvent('error',{message:'Script error.'}))` 不产生 `/api/monitor/report`（而带 `error` 对象的产生），容器 healthy 0 重启。
- 宿主级（R469 §4 三选之外新增第四项证据）：**同宿主兄弟项目 `compose build` 可把盘吃到 0**，守护 prune（04:30/04:45Z 各一次那种）挡不住构建期峰值；建议老板侧至少给 kaogong 数据卷 / 或整机设 `--storage-opt` / 或把构建挪到别处。本轮未做任何 prune / kill（不动兄弟项目、不动老板侧决策项）。

## 7. 如实说明

- 「注入脚本」来源为推断（规范 + 本页脚本清单排除法），无端侧 URL；VivoBrowser 具体注入了什么未核。
- 「触发了告警邮件」按中心代码推断，实际送达 / `alert_state` 未查（D1 无读接口，本机无 wrangler 登录态）。
- 过滤后如果真有同源脚本因缺 `crossorigin` 而脱敏，也会被丢——本站主 bundle 已带 `crossorigin`，且 uni 分包走 `import()`（同源不脱敏），此路径当前不存在；将来若加第三方 SDK 需带 `crossorigin` + CORS 头，已写入 SKILL。
- 分享链路 n=1（另一条 `share_open` 是小程序侧同设备），「分享者与被分享者是否同一人」未核。
- 无 testing agent 录屏（未另行授权）；改后生产复验待发版后补。
