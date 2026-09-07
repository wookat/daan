# R494：完成页登录 / 推送两条 nudge 首次对非探针显示 → 触达/关闭/订阅漏斗只读盘点 + 375/1440 叠加形态一手——几何/交互无缺陷；命中「关闭与开启失败在生产完全不可观测」→ 最小修补 3 个埋点（`7100b51`）

日期：2026-09-07（UTC）。改动：`frontend-uni/src/pages/practice/practice.vue`（`dismissLoginNudge()` +`login_nudge_dismiss`；`dismissPushNudge()` +`push_nudge_dismiss`；`pushNudgeGo()` 权限非 granted → `push_nudge_fail/denied`、subscribe/上报异常 → `push_nudge_fail/error`）、`backend/app/team.py`（`/api/track` 白名单 +3）、源锁 `frontend-uni/tests/practice-r494-nudge-funnel.test.js`（4 用例，含「前端所有 `*_nudge_*` 事件名 ⊆ 后端白名单」）、`backend/tests/test_track.py` +1。**不改**展示条件（`loginNudgeN ≥ 30` / `pushNudge` 五条件）、不改本地关闭语义（`loginNudgeDismissed` / `pushNudgeOff` storage）、不改订阅 payload、不碰任何学习接口。

## 0. 结论

1. **(c) 补量 / 到期项（§1）**：R493 容器（12:05:52Z 起）165 请求，5xx / assets404 / monitor / Traceback 0；非探针非 bot 5 条全是 `umst3…` 12:08Z 小程序 GET（reminders/badges/pk/growth/mistakes），非探针 POST 0；`*_ask_click` 真人仍 0（探针 4 行：search 1 / practice 2 / book 1）→ `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；`时政且 qid 非空` 0/0；`error_reason` ≥09-11 0；非探针 `mistakes/analysis` / `explain/stream` 0；`daily_set_entries` 1/1 探针；probe=0 `answer_log` 53/2、growth 26/4（与 R493 改后一致）；WAL 4,124,152 B 同字节。
2. **两个非探针 uid 回访 / 再作答（§1.2）**：`umsacie7…` 12:00Z 后 **0** 请求；`umst3…` 12:00Z 后 84 请求（12:00:08–12:00:27Z 小程序 grouped 资料 10 题 19 s = R493 已登记那一段，12:08Z 起只读 GET 回访、**再无作答**）。节奏复核：`umsacie7` 10 题 22 s（间隔 2–7 s，4 错）；`umst3` 后 5 题 1 s/题全选 B（同材料 5 题，4 对 1 错）——**口径不变**：非探针写入 ≠ 真人在学，1–2 s/题是点过；两端同城同时段推断为同一人点测，身份不确定。
3. **完成页 nudge 首次对非探针显示（verified DB）**：`umsacie7…` 11:57:57Z `login_nudge_show`、11:57:58Z `push_nudge_show`（`growth_events` probe=0 各 1 行、同 uid；此前 `push_nudge_show` 仅 probe=NULL 2 行 / 1 uid 历史探针）。其后**0** `login_nudge_click`、**0** `push_nudge_ok`、`push_subs` 0 行、`/api/push/subscribe` / `/pkgA/user/login` 相关请求 0 → 该 uid 在两条 nudge 上什么都没留下。
4. **漏斗为何断在这里（源码 verified）**：两条 nudge 的漏斗此前只有 `show → click`（登录）/ `show → ok`（推送）；「✕ 关闭」只写本地 storage（`loginNudgeDismissed` / `pushNudgeOff`）**不打点**，「开启」失败的两条路（`Notification.permission !== 'granted'` → toast「需要通知权限」；`subscribe`/上报异常 → toast「开启失败」）**也不打点**。所以 §3 的 0 无法区分「没看见/忽略」「关掉了」「点了开启但被浏览器拒了」「点了开启但订阅失败」四种完全不同的产品结论——这是**可观测性缺口**（R487/R490 同性质），不是功能缺陷。
5. **375/1440 叠加形态一手（改前生产 bundle `index-DetvGgWg.js`，CDP 探针头，`/api/**` 全 mock、学习类非 GET abort → 0 库写入 0 LLM，§2）**：到期复习 / 登录 / 推送三卡同时出现时竖向顺序固定、卡间 11.5 px（375）/ 12 px（1440）、最后一卡到首个完成按钮 11.5 / 12 px、无重叠、无横向溢出（`docSW 360 / 1425`）；`去登录 ›` 73.9×40、`开启 ›` 61.9×40、两个 `✕` 40×40（1440 同）；登录标题 375 折两行（96.9 px 卡）不溢出；两 `✕` 各自独立关闭、写各自 storage、二次完成不复活；`去登录 ›` → `#/pkgA/user/login` 渲染、返回 nudge 仍在、`login_nudge_click` 1 条；推送成功态卡变「已开启每日一练提醒 ✓」去 CTA/✕、`push/subscribe` 1 次 + `push_nudge_ok` 1 条；权限 default→拒绝：toast「需要通知权限才能推送」、`subscribe` 0 次、nudge 保留可重试；`subscribe` 抛错：toast「开启失败，请稍后再试」、nudge 保留可重试、0 `push_nudge_ok`。**全部通过**，没有几何/交互缺陷可修。
6. **修法（最小，§3）**：三处各加一行 `trackEvent(...)`；`push_nudge_fail` 用 `ref` 区分 `denied` / `error`；白名单 +3。漏斗改后 = `show → {click | dismiss | (无)}`（登录）、`show → {ok | fail/denied | fail/error | dismiss | (无)}`（推送），`(无)` 才能解释为「没看见/忽略」。门 pytest 511 / ruff / pyright 0；vitest 740 / eslint rc=0 / build 绿。
7. **改后一手（本地 dist `index-JtJc6eiv.js` 375，同脚本，§4）**：`both` → 点登录 ✕ → `POST /api/track login_nudge_dismiss`、点推送 ✕ → `push_nudge_dismiss`；`pushdeny` → 两次点「开启」各 1 条 `push_nudge_fail ref=denied`、`subscribe` 0；`pushfail` → 两次各 1 条 `push_nudge_fail ref=error`；几何与改前生产逐项一致（卡 top/bot/h、gaps、按钮尺寸），`errs(non ERR_FAILED) 0`。生产三点对照与发版见 §4.2。
8. **发版被宿主盘 100% 卡住（§4.2，如实）**：12:37Z 宿主 `/` 50 G 用 48 G **avail 0**、load 3.7→6.65，兄弟项目 `/opt/SoftCopyrightAgent` 在跑 `DOCKER_BUILDKIT=0 docker build`（`pnpm install`）；`deploy_h5.sh` 第 4 步 `compose up --build` 需要新镜像层落盘，0 字节可用时必失败。kaogong 容器此刻 healthy 0 重启、探针 `POST /api/track` 200 落库、WAL 同字节（WAL 页复用不需要新盘）——**生产写入暂未受影响但已无余量**。处置：只读轮询（`~/r494_hostwait.sh`：兄弟构建退出且 avail ≥ 1.5 G 才发），不删任何东西（`/data/data.db.r483-before` 449 MB 仍等老板确认）。

## 1. (c) 补量 / 到期项

### 1.1 `~/r494_post.sh`（远端 payload，只读 `mode=ro`）→ `~/r494_post.out`

```
healthy restarts=0 started=2026-09-07T12:05:52.498Z（R493 容器）  disk 3.9G（12:2xZ 时）  WAL 4,124,152 B  Traceback 0  load 0.77
caddy since start 165  5xx 0  assets404 0  monitor 0  mpUA 5  non-probe non-bot 5（全 umst3 12:08Z GET）  non-probe POST []
*_ask_click rows: search 1 / practice 2 / book 1 —— 全 probe=1
probe=0 answer_log (53, 2)   growth probe=0 (26, 4)   explain_cache qid nonnull/total (0, 82)
shizheng qid nonnull (0,) (0,)   error_reason >=09-11 (0,)   daily_set_entries (1, 1)
nudge events by probe:
  login_nudge_show  probe=0    count=1 uid=1
  push_nudge_show   probe=NULL count=2 uid=1
  push_nudge_show   probe=0    count=1 uid=1
  login_nudge_click / push_nudge_ok：0 行     push_subs：0 行
non-probe nudge rows: umsacie728f4ghcv8 login_nudge_show 11:57:57 / push_nudge_show 11:57:58
```

### 1.2 两个非探针 uid 回访（`~/r494_who.sh` → `~/r494_who.out`，Caddy `Cf-Connecting-Ip` + DB）

| uid | 12:00Z 后请求 | 再作答 | 节奏（本轮复核） |
|---|---|---|---|
| `umsacie7…` H5 `141.11.46.189` | 0 | 无 | 11:57:34–57:56Z 10 题 22 s：间隔 7/2/2/2/2/2/2/1/2 s，选项 A B B C B C D B B B，6 对 4 错 |
| `umst3…` W7 小程序 | 84（12:00:08–27Z 作答段 + 12:08Z 起只读 GET） | 12:00Z 段即 R493 登记那 10 题，之后无 | 12:00:08–00:27Z 10 题 19 s：前 5 题 5/3/1/3 s 间隔（C D B C D），后 5 题 1 s/题全 B |

判：两 uid 都没有第二段作答；`umst3` 后 5 题同材料 1 s/题全 B 与自动点过或极快点选相容，不能据此定自动化也不能定真人。两 uid 都没进每日一练、没点任何 `*_ask_click`。

## 2. 完成页 nudge 叠加形态一手（改前生产 bundle）

脚本 `~/r494_nudge.py <vw> <scen>`（`R494_BASE` 可指本地 dist）：连既有 Chrome CDP → 探针头 → mock `/api/questions|submodules|practice_result|review|push/pubkey|push/subscribe|track`，abort `/api/answer_log|mistakes|practice/progress` 等非 GET；seed uni H5 storage（**必须** `{type:'object',data:{...}}` 包裹格式，裸 JSON 会让 `recordStat` 读 `byModule` 抛 `TypeError`——首版因此只见到两卡，是脚本缺陷不是产品缺陷）`pstats.byModule` 合计 52 题使 `loginNudgeN` 生效；`pushok/pushdeny/pushfail` 分别 stub `Notification.requestPermission` / `PushManager.subscribe`。输出 `~/r494_nudge_{375,1440}_<scen>.out`，截图 `~/r494_nudge_{view,done,after_x,after_go}_*.png`，汇总 `python3 ~/r494_sum.py <out>`。

| 项 | 375×812 | 1440×900 | 判 |
|---|---|---|---|
| 三卡顺序 / 位置 | duenudge 581.8–644.8（63）→ loginnudge 656.3–753.3（96.9，标题折两行）→ push 764.8–842.7（77.9） | 557–621 / 633–699 / 711–777（各 650 宽居中） | 顺序固定、无重叠 |
| 卡间 / 到首个完成按钮 | 11.5 / 11.5 / 11.5 px | 12 / 12 / 12 px | `margin 24rpx` 折叠 ✓ |
| 横向溢出 | `docSW 360`（= vw−15 滚动条） | `docSW 1425` | 无 |
| 文本溢出 | 三卡 `t/s` 均 `sw>cw false` | 同 | 无 |
| `去复习 ›` / `去登录 ›` / `开启 ›` | 73.9×40 / 73.9×40 / 61.9×40 | 77×40 / 77×40 / 65×40 | ≥40 ✓ |
| 两个 `✕` | 40×40 / 40×40 | 同 | ≥40 ✓（`margin -6px` 不影响命中框） |
| 独立关闭 | 点登录 ✕ → 仅登录卡消失、`loginNudgeDismissed=1`、推送卡保留；再点推送 ✕ → `pushNudgeOff=1`；二次完成两卡都不复活、duenudge 保留 | 同 | ✓ |
| `去登录 ›` | → `#/pkgA/user/login` 登录页渲染、返回 nudge 仍在、`login_nudge_click` 1 条 | — | ✓ |
| 推送成功态 | 卡 → 「已开启每日一练提醒 ✓ / 明早 8 点推送今日全站同题」，CTA/✕ 去掉，与下方按钮 12 px；`POST push/subscribe` 1 + `push_nudge_ok` 1 | 65 px 成功卡，其余不变 | ✓ |
| 权限 default→拒绝 | `requestPermission` 2 次（两次点）、`subscribe` 0、toast「需要通知权限才能推送」、nudge 保留 | — | ✓ 可重试 |
| `subscribe` 抛错 | `subscribe` 2 次、toast「开启失败，请稍后再试」、nudge 保留、0 `push_nudge_ok` | — | ✓ 可重试 |
| 应用错误 | `errs(non ERR_FAILED) 0`（ERR_FAILED 全是脚本 abort 的学习写入） | 同 | — |

**结论：几何与交互无缺陷可修**；两卡复用 `.loginnudge` 样式是刻意的（同族），量出来的间距/命中都成立。

## 3. 命中与修法

### 3.1 改前漏斗可观测面（源码 `practice.vue` + `team.py` 白名单）

| 动作 | 登录 nudge | 推送 nudge |
|---|---|---|
| 显示 | `login_nudge_show` | `push_nudge_show` |
| 主 CTA 成功 | `login_nudge_click`（跳登录页，登录与否另有 `login` 事件） | `push_nudge_ok` |
| 主 CTA 失败 | n/a | **无**（denied / error 两路都只 toast） |
| ✕ 关闭 | **无**（只写 storage） | **无**（只写 storage） |

生产：`umsacie7` show 后 0 click / 0 ok / 0 subs，四种解释无法区分（§0.4）。

### 3.2 改后

```js
dismissLoginNudge() { …setStorageSync('loginNudgeDismissed','1'); trackEvent('login_nudge_dismiss'); }
pushNudgeGo():  permission !== 'granted' → toast + trackEvent('push_nudge_fail', null, 'denied'); return
                catch (e) → toast + trackEvent('push_nudge_fail', null, 'error')
dismissPushNudge() { …setStorageSync('pushNudgeOff','1'); trackEvent('push_nudge_dismiss'); }
team.py TRACK 白名单 += push_nudge_fail / push_nudge_dismiss / login_nudge_dismiss
```

不做的：① 不把「关闭」改成 7 天后再现（当前一次关闭永久，产品取舍，有数据再议）；② 不在权限 `denied` 时隐藏卡（`initPushNudge` 已在初始 `denied` 时不显示，运行中拒绝保留可重试是既有语义）；③ 不改 `loginNudgeN ≥ 30` 阈值。

源锁 `tests/practice-r494-nudge-funnel.test.js`：`dismissLoginNudge` / `dismissPushNudge` 写 storage 后紧跟对应 track；`pushNudgeGo` 三分支各自事件；**全文件 `trackEvent('(login|push)_nudge_*')` 集合 == 7 个且每个都在 `team.py` 白名单**（R380 白名单热修教训）。`test_track.py` +`test_track_nudge_funnel_events_whitelisted`（三事件 200 + `ref` 落库）。

## 4. 改后一手

### 4.1 本地 dist（`python3 -m http.server 8765` 起 `dist/build/h5`，`R494_BASE=http://localhost:8765`，375）

注意：`/sw.js` 由后端 `main.py` 路由提供、不在 dist 根 → 本地静态服务下 SW 注册 404、`navigator.serviceWorker.ready` 永不 resolve、推送 nudge 不出现（首跑只见两卡 + `console.error: A bad HTTP response code (404) was received when fetching the script`）；`ln -sf static/sw.js dist/build/h5/sw.js` 后正常（dist 不入库）。

| scen | 事件（`/api/track` mock 捕获） | 几何 |
|---|---|---|
| `both` | done：`boot` `login_nudge_show` `push_nudge_show`；点登录 ✕ → **`login_nudge_dismiss`**；点推送 ✕ → **`push_nudge_dismiss`**；二次完成 0 nudge 事件 | 三卡 581.8/656.3/764.8、gaps 11.5、`btn0_top 854.3` 与改前生产一致 |
| `pushdeny` | 两次「开启」→ 各 1 条 **`push_nudge_fail ref=denied`**、`subscribe` 0 | 同 |
| `pushfail` | 两次「开启」→ 各 1 条 **`push_nudge_fail ref=error`**、`subscribe` 2 | 同 |

`errs(non ERR_FAILED)` 三跑均 0。输出 `~/r494_nudge_local_375_{both,pushdeny,pushfail}.out`。

### 4.2 发版 + 生产三点对照

**发版**（第三次起跑，`~/r494_deploy.log`，`--skip-build`）：4-pre 让行时兄弟构建已退出、avail 4.95 G；远端 `compose up` 后台轮询收敛 `started=2026-09-07T12:47:52Z rev=7100b51 compose_rc=0`；Pages `d8dea039.kaogong-h5.pages.dev`；5/6 线上 bundle 首查仍 `index-hIYH9yMp.js`（传播窗口）→ 5 s 重试 `index-JtJc6eiv.js` 与本机一致；Accept-Encoding 变体校验过；6/6 7/7 200；6b `/` perf 0.97 · a11y 1.00 · LCP 1679 · CLS 0.06，`/tiku/` 1.00 · 1.00 · LCP 939；「性能预算全部通过 / 部署完成，回归全部 200」。

**探针直打（`X-Kg-Probe: 1`）**：走源站直连 `kaogong-origin` 4 条全 **403**（无边缘头，R388 口径，属预期）；改走 `kaogong.zalize.com`：`login_nudge_dismiss` / `push_nudge_dismiss` / `push_nudge_fail ref=denied` → **200 `{"ok":true}`**，`not_in_whitelist_r494` → **400 `无效事件`**；DB `growth_events` 三行 probe=1 落库（12:49:11–12）。`/sw.js` 200 `application/javascript`。

**生产 375 三点对照（生产 bundle `index-JtJc6eiv.js` CDP，探针头，`/api/**` mock/abort，0 库写入 0 LLM，`~/r494_nudge_prod_375_{both,pushdeny,pushfail}.out`）**：

| 场景 | 结果 | 与改前生产（§2）几何 |
|---|---|---|
| `both` | 三卡 581.8/656.3/764.8 顶、间距 11.5/11.5、末卡→按钮 11.6；点两个 ✕ → `login_nudge_dismiss` + `push_nudge_dismiss` 各 1 条 `POST /api/track`，storage `loginNudgeDismissed=1` / `pushNudgeOff=1`，两卡独立消失 | 逐值一致 |
| `pushdeny` | 「开启」×2 → `push_nudge_fail ref=denied` ×2、toast「需要通知权限才能推送」、`subscribe` 0 | 一致 |
| `pushfail` | 「开启」×2 → `push_nudge_fail ref=error` ×2、toast「开启失败，请稍后再试」、`subscribe` 2 | 一致 |

`done_calls` 仍为 `boot → login_nudge_show → practice_result → review → push/pubkey → push_nudge_show`（展示条件/顺序未变）；`errs(non ERR_FAILED)` 三跑 0；六个可点元素 h 40 / ✕ 40×40 命中检查全 true。

**改后一手 `~/r494_post2.out`（远端 `mode=ro`）**：新容器 healthy 0 重启；起后 140 请求 5xx / assets404 / monitor / mpUA 0，非探针非 bot **0**、非探针 POST 0；Traceback 0；WAL 4,124,152 B 同字节；盘 4.5 G；load 3.73（兄弟构建余波，容器自身正常）。`umsacie7` 12:00Z 后 0 请求；`umst3` 84 请求 = 12:00:08–12:00:27Z 那 10 题 + 只读 GET，无第二段作答；push api 非探针全历史 2、auth api 4、登录分包非探针 0；`push_subs` 0 行；probe=0 nudge 行仍只 `umsacie7` 两条 show；`*_ask_click` 真人 0、`explain_cache qid` 0/82、时政 qid 非空 0/0、`error_reason` ≥09-11 0、probe=0 `answer_log` 53/2、growth 26/4——与发版前一致，发版本身 0 增量。

## 5. 如实 / 未验证

- 生产真人对两条 nudge 的 click/ok/dismiss/fail 全部 **0 样本**；埋点已上线（探针 200 落库 probe=1、生产 bundle CDP 发出），但首个非探针 dismiss/fail 行尚未出现——发版后 140 请求里非探针 0。
- 探针直打源站 `kaogong-origin` 403 是 R388 无边缘头拒绝、不是新回归；生产核验以边缘域为准。
- 1440 视口改后未复跑（改动不涉样式/模板几何，改前 1440 一手见 §2；本地 dist 与生产 375 逐值一致）。
- CDP 仿真非真机：H5 TabBar 在此 context 高 0，「最后一卡不被 TabBar 盖」按 `btn0_top < vh` 判；真机通知权限弹窗形态未测。
- 推送成功/失败均为 stub（`PushManager.subscribe` 被替换），未向真实推送服务订阅、未发生产 LLM 请求、未写任何学习接口。
- `umsacie7` / `umst3` 是否外部真人仍不确定；`push_nudge_show` probe=NULL 2 行为 R374 打标前历史探针（推断）。
