# R573 · 首页远端续练卡场次身份（redo / daily）与旧快照诚实口径

PR #753（分支 `devin/1789012362-r573-remote-resume-identity` 从 #752 分支开，提交 `ec8206e5`）；后端 + H5，0 小程序。

## 研究（一手，生产只读）

- `practice_progress` 非测试 6 行（6 uid）：`psource` = `link` 3 / `(null)` 2 / `redo` 1，14 天内三类各有更新（最近 `link` 2026-09-08 16:05、`(null)` 02:49、`redo` 09-07 16:26）→ 远端续练是真实路径，三种来源都出现过。
- 多 token 用户 15 / 匿名合并 26 次 → 「换设备 / 清本机后在首页看到远端续练卡」不是理论场景。
- `home.vue prLabel(r)` 早已按 `r.ptitle / r.redo / r.daily` 出「卷名 / 错题重练 / 每日一练·往期」，但 `parseRemotePractice()` 从不给 `redo`/`daily` → 远端卡一律「上次练习 · 模块名」；`adoptRemoteSnap` 恢复每日一练后 `_daily=false` → 跨设备恢复不打卡、不交全站成绩、顶栏无「每日一练」。服务端快照根本不存 `daily`（R557 只落本机 `pendingSession`）。
- `request()` 网络失败以 `apiSnap` 旧快照 **resolve**（R571 `staleAt` 按对象身份标记），`parseRemotePractice()` 新造对象即丢身份 → 旧进度被当实时「已做 n/m 题」。R572 生产 `stale_fallback` 首页/我的展示型字段样本 1 条/端点不立项，但续练卡是**动作入口**（点「继续」按它进练习页），比展示型字段更该诚实 → 只做卡面短注、不做首页/我的全站 banner。

## 实修

- 后端：`practice_progress` 增列 `daily TEXT`（ALTER 迁移）；`save_practice_progress(..., daily: dict|None)`；POST `/api/practice/progress` `body.daily → _daily_meta()`（`{date:'YYYY-MM-DD', past:bool}`，形状/日期非法 → `None` 不 400，老客户端不带此键）；GET `/api/practice/resume` 回 `"daily"`。
- H5 `practice-progress.js`：`collectPracticeProgress(..., daily)` → `payload.daily = dailyMeta(daily)`；`dailyMeta()` 原样归一（不按今天重算）、`dailyFromPending()` 复用并 `past ||= date !== cnDayOf(now)`；`parseRemotePractice()` += `redo: source==='redo'`、`daily: dailyFromPending(d)`；`adoptPracticeResume()` += `redoItems`/`daily`；新 `markRemoteResume(r, snapAt, online)`。
- `snapshot-notice.js`：`snapshotProgressNote(snapAt, online)`「当前离线 / 网络不稳定 · 以上为 N 前缓存的进度」+ `netOnlineNow()`。
- `home.vue`：`markRemoteResume(parseRemotePractice(d), staleAt(d), netOnlineNow())`（**`staleAt(d)` 在变形前取**）；本机 `pendingSession` 优先不变；卡内 `v-if="practiceResume.snapAt"` 出 warn 色 `.rs-stale` 一行；无重试按钮 / 无全局横幅；`netOnline` 为加载时刻快照（首页 onShow 重拉即刷新）。
- `practice.vue`：上送带 `{date:_dailyDate, past:_dailyPast}`；`adoptRemoteSnap` 还原 `_redoItems/_daily/_dailyDate/_dailyPast` + 与本机恢复同 toast（R548/R557/R559 源锁字节不变：toast 内联、`saveSession(); relinkWrongMids();` 收尾）。
- 测试：后端 `test_r573_daily_meta_roundtrip_and_fail_closed`；H5 `tests/r573-remote-resume-identity.test.js`；`practice-progress.test.js` 两处精确形状按新契约补 `redo:false, daily:null`。
- 本地门：H5 vitest 193 文件 1503 / eslint 0 error（lint-pages 20 warn 存量）/ tokens / build:h5；后端 pytest 747 / ruff / pyright 0；`git diff --check` 空。

## 发版

- `DEPLOY_WAIT_SECS=1500 ./deploy/deploy_h5.sh --skip-build`：1–3/prime 正常；4 compose 远端后台 `/tmp/kg-compose-ec8206e5-20260910T035520Z.log`，pip 层「Successfully installed」后进程 D 态 ≈25 min，1500s 到点脚本 exit 1（compose 继续，旧容器 09d664a4 继续服务；宿主 load 17–30 / mem_avail 78–282MB / disk 5.1G(90%)，other_builds 0→2，无 OOM）。
- Pages 静态层先行（前端对旧后端向后兼容：无 `daily` 键 → null；`redo` 依赖既有 `source`）：`~/r573/pages_deploy.sh` → `index-XSq5z_z5 → index-D0Aywqly.js`（book chunk `nNaK6XYu`），六类资源 200、7 种 Accept-Encoding 均 javascript。
- compose 后台 `KG_COMPOSE_EXIT rc=0 at 04:43:41Z`（pip 层后 `exporting layers` 又 ≈20 min），health → `ec8206e5`；`DEPLOY_RESUME=1 ./deploy/deploy_h5.sh --skip-build` 4a–6 全过，6b LH `/` perf 0.85 / LCP 3676ms 违例（benchmarkIndex 3652、observedLCP 227ms —— R565 归因的 route-preload/CPU 二值跳变同型，非本轮首页 chunk 回归；`/tiku/` 全 1.00）。

## 生产复验一（Pages 先行、后端仍 09d664a4；`~/r573/prod/report.md`，uid `test-r573-*`）

- PASS A 375：远端普通练习卡「常识判断 · 已做 2/10」无 rs-stale 行、resume 真实 200 → 继续第 3/10、模块标题。
- PASS B 375：真实错题本重练 → `source=redo` → 卡「错题重练 · 已做 1/2」→ 继续第 2/2、顶栏 + toast「继续错题重练」（前置 6 条 API 超时模式、一次可见重试后完成）。
- PASS C 在线 375/1440：仅阻断 `/api/practice/resume` + 原生 F5 → 卡保留 2/10 + warn 行「网络不稳定 · 以上为 刚刚缓存的进度」；解除 F5 → 真实 200、行消失；各 1 失败 GET / 1 条 `stale_fallback` 200。
- PASS E 375：本机 pendingSession 存在时 F5 卡 1/10、reload 窗口 resume GET 0；完成 10 题后首页卡消失。
- UNTESTED D（后端未收敛、未写 daily）；UNTESTED C 真离线（无 SW 缓存的首页 offline + F5 进 Chrome `ERR_INTERNET_DISCONNECTED`，非产品缺陷）。
- 审计：API 240 = 229×200 + 2 主动 abort + 6 超时模式 + 3 导航取消，429/5xx/无终态 0；应用 console/runtime/rejection 0（SW harness warning 12、controller commandError 6 单列）。清 42 行 0→42→0，独立 41 表 0 残留，共享 R562 42 行保持；限制：`end-contexts.json` 为关闭前快照、无逐 context 关闭回执（第二轮已补）。

## 生产复验二（后端 ec8206e5；`~/r573/prod/report2.md`，uid `test-r573b-*`）

- PASS D 375：真实每日入口答 1 题 → progress POST 含 `daily:{"date":"2026-09-10","past":false}`；只删 pendingSession/practiceLaunch + 原生 F5 → 卡「每日一练 · 今日全站同题 · 已做 1/10」无旧行；继续第 2/10 + 顶栏「每日一练」+ toast「继续今日一练 · 第 2/10 题」；直接 GET resume 回同 daily 对象；答完 10 题「今日一练完成，打卡成功！」+ `POST /api/daily_set/submit` 200 + `daily_set_entries` 1 行。
- PASS D2 375（API 层 + 首页）：往期 `daily:{date:"2026-09-01",past:true}` → resume `past=true`、首页「往期每日一练 · 2026-09-01」（R557 `dailyPendingTitle` 既有口径；我指令里「每日一练·往期」是缩写口径错）；`daily:"garbage"` POST 200 且 resume `daily:null`。
- PASS D3 1440：远端每日卡 1/10 → 继续第 2/10 + toast。
- PASS C-age 375：真实快照老化 71.958s 后阻断/F5 →「网络不稳定 · 以上为 1 分钟前缓存的进度」，1 失败 GET / 1 条 `stale_fallback` 200。
- 审计：API 171 = 170×200 + 1 主动 abort，超时/非 2xx/无终态 0；应用 console/runtime/rejection 0（SW warning 7、commandError 3、1 条报告后处理 KeyError 已纠正均 harness）。清 28 行 0→28→0，独立 41 表 0 残留，共享 42 逐行保持；两 context 关闭回执早于 preclean。
- 范围如实：D2 未跑往期完整作答、D3 未跑 1440 完整完成；真离线卡面仍 UNTESTED。

## 登记

- R573-1（P3，不立项）：卡内 `netOnline` 为加载时刻快照，非 R571/R572 的响应式监听——首页 onShow 重拉即刷新，且卡无「重试」动作；若后续首页/我的接 `snapshotViewMixin` 时一并收口。
- 6b LH `/` LCP 违例延续 R565 归因（benchmarkIndex 高 + observedLCP 227ms），不改代码不改预算。
