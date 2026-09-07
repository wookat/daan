# R430：SOP-10 四维审计（统计/报告次级屏簇）——日历 / 掌握度地图 / 练习历史 / 周报 29 处 18–23rpx 字号提到 24rpx 下限 + 热区 40×40；R430b 发版后旧壳 chunk 404 → errorHandler 即时触发陈旧壳自愈

rev `824a9e3`（R430，仅前端 4 页 CSS + 源锁单测；bundle 变）→ `e456a88`（R430b，`main.js` / `monitor-client.js` + 单测；bundle 变）。后端、DB、API 均不动。

## 审计口径（同 R376/R398/R410/R420）
- 四维：实体/操作台 · 核心用户功能 · 落地/分发面 · 系统架构与生产证据。
- 对标粉笔错题本：粉笔次级屏仍需账号登录，**本轮仍无一手竞品截图 → 零竞品陈述、不据二手加功能**，只审我方次级屏一手量测。
- 选簇：R398/R410 审了错题本次级屏，R420 审了模考大赛簇；本轮选**统计/报告簇**——成长页（`pages/stats/stats.vue`）、学习日历（`pages/stats/calendar.vue`）、掌握度地图（`pkgA/stats/mastery-map.vue`）、练习历史（`pkgA/stats/practice-history.vue`）、周报（`pkgA/stats/weekly-report.vue`），及其 API（`/api/growth`、`/api/mastery/map`、`/api/recommend`、`/api/practice/history`、`/api/profile`、`/api/exam/attempts`、`/api/report/weekly`）。R429 汇报里说「顺带把每日一练簇纳入」——每日一练的公开榜/池口径 R429 已修并复验，本轮只在 UI 量测里以「每日一练 `?daily=1` 一组」作为数据生成路径覆盖，不另起项。

## 一手取证
### 源码（字号/热区）
- R411/R420 已把「≥24rpx（375 下 12px）」定为全站字号下限口径并在 practice/contest/contest-report 源锁。本簇 4 页仍有 **29 处 18–23rpx** 声明：calendar 7（`.ms-best 21` `.ms-sub 22` `.ms-dot-d 20` `.cal-badge 21` `.cal-sub 23` `.cal-w 20` `.lg 21`）、mastery-map 9（`.cov-t` `.lg` `.tab-pct` `.grp-meta` `.tile-meta` `.sheet-s` `.dot` …）、practice-history 6（`.chip 20` `.meta 22` `.d-ansline 23` `.d-expl 23` `.d-ans 22` `.d-secs 22`）、weekly-report 7（`.hn-k` `.badge-s` `.cmp-p` `.ms-v` `.rs-k` `.rs-p` `.mk-line.sub`）。
- 热区：日历月份 `.cal-btn` ‹ › 只有 30rpx 字形无 min 尺寸；周报分享面 `.sheet-x` ✕ 同。掌握度地图 tile 右上角到期错题红角标 `.dot` 30rpx 圆内放 20rpx 数字。
- `stats.vue` 成长主页本身此前已在 R411 提到下限，本轮量测确认 375/1440 全页 <12px 元素 `[]`。

### 生产只读（容器 `/data/data.db` + caddy 日志，2026-09-06）
- `growth_events` 有 `heatmap_view`（probe NULL / 0 / 1 三态都有）；`weekly_reports` 表存在 **0 行**；无任何 `%checkin%` 表（打卡由 `answer_log` 按日推导）。
- 首个有量 `probe=0` 设备 `umst3tuisd7lgzaka`（R425 已定性为候选真人/内部走查）访问过成长页 ×7，未见日历/地图/周报请求；`answer_log ≥20` 行的 uid 12 个但无一可确认外部真人。`mistakes` 273 行、`mastered` 2。
- caddy：`/api/growth` `/api/mastery/map` `/api/recommend` `/api/profile` `/api/report/weekly` `/api/exam/attempts` 均有非探针网段请求，逐条看 UA/时序全为测试自动化或候选设备——**本簇无可确认外部真人使用**，属「结构事实」而非「已发生的真人受害」→ 只修不加。
- 实体/操作台：管理台无统计簇相关面（不需要，用户私有数据）；落地/分发面：SEO 页不链到这些私有页，合理。

## 修法（R430，最小、不改信息架构）
- 4 页全部 <24rpx 声明 → 24rpx；`.dot` 30→36rpx（承载 24rpx 数字与 `9+`）；`.cal-btn` / `.sheet-x` `min-width/min-height: 40px` + inline-flex 居中。
- 源锁 `frontend-uni/tests/stats-r430-secondary-fontfloor.test.js`：4 页 `<style>` 内无 `font-size: 1–23rpx` / `<12px`；`.dot` 36rpx；两热区 40×40。
- 本地 vitest 613（+6）/ eslint / build:h5 绿；部署 rc=0（首次 6b 预算全过：`/` perf 0.98 · a11y 1.00 · LCP 1003 · CLS 0.07；`/tiku/` 1.00/1.00/952/0.00）。

## 复验（testing agent，`r430-ui-a`，375×812 + 1440×900，原生做 30 题解锁地图）
- 地图非冷态 `n_total:30 cold:false`；`.cov-t/.lg/.tab-pct/.tile-meta` 实测 12px、全页 <12px `[]`、`.dot` 26×20 文本不溢出、点 tile 吸底条「练 10 题」可进练习；练习历史展开 + 题详情各类文本 12px、无横向溢出；日历 `.cal-btn` 40×40 ×2、‹ › 切月正确、7 列对齐；周报空态 `{"status":"empty"}` 如实渲染；1440 `.side-nav` 与 tab/URL 同步、日历双栏；成长页/错题本回归正常；`/api` 262 条 non-2xx 0；healthy 0 重启、60 min 5xx/Traceback/locked 0；清理 5 表 LEFTOVER 0。
- **未测**：`.sheet-x` 运行时 40×40（新 uid 无上周记录 → 空态无「生成分享图」，源锁覆盖）；`.sheet-s` computed 值未落盘（视觉通过、源 24rpx）。
- **抓到 1 FAIL（非本轮 CSS）**：首进「统计」tab 时浏览器仍持旧 SW 预缓存壳 `index-BgF7eoj8.js`，动态 import 旧 chunk `pages-stats-stats.DrCxpCf5.js` → 404，页面显示 uni 原生「连接服务器超时，点击屏幕重试」（误导：既不是超时也不是服务器问题），点重试整页 reload 后恢复。

## R430b：旧壳 chunk 404 自愈（rev `e456a88`）
### 现状
- `main.js` 已有陈旧壳自愈 `staleShellHeal`（R387/R391 期）：`load` 后 15 s 定时 + SW `kg-sw-updated` 消息触发，拉 `/` no-store 比对主 chunk hash，不一致 reload 一次（`sessionStorage.kg_sh_reload` 防重入），且 `visibilityState!=='visible'` 跳过。
- `monitor-client.installVueErrorHandler`（R391）把 `chunk-load`/`chunk-timeout` 上报 `/api/monitor/report`，但**只上报不自愈**——旧壳 import 旧 hash 404 是最明确的「有新版本」信号，却仍走原生超时文案等用户手点。
- 复验实录还证明后台 tab 收到 `kg-sw-updated` 时因 hidden 被守卫跳过、`kg_sh_reload` 全程 null，用户切回后首次导航就会撞 404。

### 修（fail-closed，不改文案不加轮询）
- `installVueErrorHandler(app, report, consoleError, onChunkLoadError)`：仅 `classifyVueError()==='chunk-load'` 回调（`chunk-timeout`/普通 vue 错误不触发）。
- `main.js`：模块级 `healOnChunkLoadError`，`load` 闭包内指向 `staleShellHeal`；createApp 传 `() => healOnChunkLoadError()`。语义：chunk 404 → 立刻拉 `/` 比 hash → **不一致才 reload 一次**；一致（真网络故障）不动，uni 原生文案与「点击重试」保留。
- 单测 `tests/monitor-r430-chunk-heal.test.js`：回调只在 chunk-load 触发 / 未传回调不抛 / main.js 接线与「hash 不一致才 reload、会话内一次」源锁。vitest 616（+3）/ eslint / build:h5 绿。

### 部署
- 第一次 `deploy_h5.sh` 远端 `docker compose up -d --build` 在「exporting layers」阶段进程消失（`/tmp/kg-compose.log` 21:00 停笔、无 buildkit 进程；宿主 free 68 MB，同一时段 `recruit-app`（32 min 前）/`softcopyright:prod`（15 min 前）也在同机重建镜像；无 sudo 读不到 dmesg，**疑 OOM、未证实**）；旧容器 824a9e3 全程 healthy 服务未中断。kill 本机轮询后重跑，第二次 13:11:39Z 重建成功 rev `e456a88`，6b 预算全过（`/` 0.98/1.00/1.00/1.00 · LCP 1403 · CLS 0.07；`/tiku/` 全 1.00 · 952 · 0.00），bundle `index-junWyPAm.js` gzip 125 KB。

### 复验（testing agent，375 + 1440，`r430b-ui-*`）
- 预置旧壳：发版前 375/1440 各一 tab 停首页（`index-dq-iqBPZ.js`），发版后 **旧壳自然导航未产生 404**——服务器 `assets/` 保留上一版分包（`pages-stats-stats.QZ0CcByq.js` 等 5 个 200）；R430 那次 404 是「隔两版」的 SW 预缓存壳。→ **(c) 自然旧壳路径 untested**，改用方案 B（CDP Fetch 拦截）覆盖三分支：
  - fail-closed：模拟分包 404 → 8–14 ms 内 `GET /` no-store → hash 一致 → 不 reload、`kg_sh_reload` null、原生文案保留、monitor 上报 200（两视口）。
  - heal：`/` 响应 hash 改写为假值 + 分包 404 → 13–21 ms `GET /` → ~100 ms `location.reload()` 一次 → 目标页（375 练习历史 / 1440 周报空态）正常渲染、`kg_sh_reload=1`、新文档 console/pageerror/rejection 0；`sendBeacon` 在 reload 瞬间 CDP 记 `ERR_ABORTED` 但 `docker logs -t` 证明服务端 200 实收（13:22:06.782 / 13:26:30.699）。
  - 会话内一次：`kg_sh_reload=1` 后第 3 次 404 → 只上报，不再 fetch `/`、不 reload、原生文案；用户点「点击屏幕重试」整页 reload 可恢复（已验证）。
  - 旧 bundle 824a9e3 对照 tab：同样 404 停在超时文案、无 `GET /`、无 reload。
- 新 bundle 4 页两视口回归正常；`/api` non-2xx 0（`/assets` 非 2xx 全为模拟 404）；容器 healthy 0 重启（StartedAt 13:11:39Z）、部署窗口 1377 行 5xx/Traceback/locked 0、monitor/report 8 条 200；清理 `growth_events` 6 行 → LEFTOVER 0，各表精确回基线 273/1146/287/696/34/1。
- 观察（设计内）：同一 document 内失败过的 chunk Chrome 模块表直接 reject 不再请求；后台 hidden tab 不会被 SW 消息刷新（既有 visibility 守卫，保护正在阅读的用户，不改）。

## 登记 / 不做
- P3：`.sheet-x` 运行时量测与周报正文（有上周记录的 uid）待有数据后补；`.trend-kn` 需 4 周已掌握样本（沿用）。
- P3：(c) 自然旧壳 404 路径——下次发版前保留一个「隔两版」旧壳 tab（或部署清理上一版 `assets/`）即可复用本轮 A/B 现场直接验。
- 不做：改「连接服务器超时」文案（uni 内置、hash 一致时它就是网络问题）；后台 tab 强制刷新；管理台加统计簇面（私有数据无运营面需求）；任何竞品对标结论。
- 宿主：部署首次疑 OOM 中断——与 recruit/softcopyright 同机同时重建镜像叠加；扩盘/迁出仍待老板决定（磁盘 94%/3.2 G、free 68–102 MB）。

## 文件
- R430：`frontend-uni/src/pages/stats/calendar.vue` `pkgA/stats/mastery-map.vue` `pkgA/stats/practice-history.vue` `pkgA/stats/weekly-report.vue`、`tests/stats-r430-secondary-fontfloor.test.js`
- R430b：`frontend-uni/src/main.js` `src/monitor-client.js`、`tests/monitor-r430-chunk-heal.test.js`
- 复验：`/home/ubuntu/r430_test_report.md` `/home/ubuntu/r430b_test_report.md`、录屏 `screencasts/r430-regress/` `screencasts/r430b-regress/`（会话机器）
