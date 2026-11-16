# R583 · 统计页 `loadReco` 两端点并发（recommend → review 串行让「今日待办」到期行多等一个长尾）+ 宿主慢的三段分账 + 首页 `loadHome` 回退串行论证不立项 + 自然样本回看

分支 `devin/1789050787-r583-stats-reco-parallel`（从 #761 分支开，链含 #742–#761）。本轮改动：`frontend-uni/src/pages/stats/stats.vue`（仅 `loadReco()` 请求编排）+ 新测试 `frontend-uni/tests/r583-stats-reco-parallel-load.test.js` + `r572-stats-stale-snapshot.test.js` 两处源锁缩进跟随（断言内容逐字不变，只是 `Promise.all` 分支多缩 4 格）。0 后端；Pages `index-B90Wn8n0 → DEX103Q0`，health 全程 `ec8206e5`。

## 结论（先讲）

1. **统计页 `loadReco()` 是统计页 8 个加载器里仅剩的一条内部串行链**：`await request('/api/recommend')` 落地后才 `await request('/api/review')`。375 生产一手（修前 bundle `B90Wn8n0`，`~/r583/stats-timing-375*.log`）：`checkin/summary / growth / recommend / shenlun/stats / mastery/map / exam/attempts / profile / stats` 八条同 tick 0.0 发出，`review` **恰在 recommend 回包那一刻（0.75s）才发**、0.93s 回；慢窗那次八条全部挂到 12s 内建重试再发一轮，`review` 在 ≥12s 内根本没发出——期间「今日待办 · 错题到期复习」行一直是「正在同步到期数…」。R582 走查留下的 375 统计页截图（`~/r582/shots/375-stats-full.txt`，networkidle + 4.4s）也正是这个状态：其余区块全部落地、唯独到期行「正在同步到期数…」，`reqs-375.json` 里 recommend 是倒数第二个回包、`/api/review?uid=` 尚未发出。
2. **两端点体量不对等**：7d Caddy 自然样本 `recommend` p50/p90 0.04/0.04、`review` 0.01/0.06；本轮 8 并发探针里 recommend Caddy 时长 0.64–1.33s、review 0.03s。让轻的 review 排在重的 recommend 后面，是本产品代码可控部分；与 R582 我的页同型。
3. **实修**：`loadReco()` 快照即显（`snapPeek(rp/vp)`）不变，两请求改为 `Promise.all` 内两个各自 `try/catch` 的 async 分支，分支体逐字不变（recommend 分支 `noteSnapshot + reco`；review 分支保留 R572 口径「旧快照不置 `dueSynced`、真实回包才写 `dueN/dueSynced=true`」）。不改端点、payload、`snapshotViewMixin` 登记语义。
4. **首页 `loadHome()` 失败回退串行——论证不立项**：回退分支只在 `home_bundle` 失败时走（`loadPlan()` / `loadBadges()` 不 await 并发起跑，`await loadProfile()` 内部 profile → `plan/today` 是真依赖：要 `profile` 才知道有没有计划）。7d Caddy 自然 `/api/home_bundle` **48/48 全 200**（p50/p90 0.03/0.64s），非 2xx/status 0 全为 harness（400×3 / 503×2 / 0×1 / 422×3 / 403×7）→ 回退分支 7 天自然流量 0 次进入，`loadBadges` 内 badges → summary 的串行即便存在也无用户可感知面。不改。
5. **宿主慢的三段分账（只读，未改任何配置、未 kill）**：8 并发 × 10 轮 × 2 次读端点探针（`burst583.sh`），把每条请求拆成「客户端发出 → Caddy 开始计时（pre）」「Caddy 时长（dur）」「Caddy 结束 → 客户端收完（post）」：
   - 慢窗（load 11–13）：80 条 24 条 >2s、最长 8.26s；慢条 pre 0.9–7.05s、dur 0.1–4.3s、post 0.06–5.55s。同一轮 8 条并发里 pre 5.3s 与 0.9s 并存。
   - 快窗（load 4.1）：80 条全 <1s，平均 total 0.41 = pre 0.31（本机→CF→香港 RTT）+ dur 0.03 + post 0.07。
   - 内核计数（`netstat -s` / `/proc/net/netstat`）探针前后 `ListenDrops 564 / ListenOverflows 4 / LostRetransmit 159777` **不变**，`TCPTimeouts +164 / TCPSynRetrans +140`（1 分钟窗），`SyncookiesSent=3`；`:443` SYN-RECV 30–49 个，来源 `91.92.42.x`（扫描器）/ `39.109.100.175`；`somaxconn 4096 / tcp_max_syn_backlog 128`。
   - **推断**（未一手证）：慢窗 pre 段大不是 accept 队列丢包（计数不涨），更像 2 核 load 12–17 下 Caddy TLS/HTTP2 接入与 uvicorn（RSS 843MB / 42.5% 内存、`MemAvailable` 224–276MB、`kswapd0` 在 top 榜）争 CPU 导致请求被读入 Caddy 前排队；Caddy `duration` 从读完请求起算，故 dur 小不等于用户等得少。这是老板/运维侧扩容或限流他家（宿主同跑 recruit-* / softcopyright / linkshopproxyhub / web-store 共 10 容器 + postgres + celery）的事，不是本产品代码问题。
6. **自然样本回看：R580-1 触发条件仍未满足**（`q583e.sh` 只读 7d Caddy POST）：`/api/practice_result` 自然 **200×4、非 2xx/status 0 = 0**（500×2 / 400×2 / 503×7 / 502×1 全 harness）；`/api/answer_log` 自然 200×53、0 非 2xx（503×96 / 0×13 / 429×31 全 harness）；`/api/daily_set/submit` 自然 0 条。→ R580-1 幂等键继续登记不实施。（探针把进度端点写成 `/api/practice_progress` 是错的，实际是 `POST /api/practice/progress`，该行 0 条不作结论。）
7. 375 统计页 / 错题本首屏走查：新 uid 统计页锁卡「再答 10 题解锁学习统计 0/10 题」+ 两 CTA 层级正常（`~/r583/shots/stats-timing-375.png`）；R582 有数据 uid 的 375 统计/错题本全页文本（`~/r582/shots/375-stats-full.txt` / `375-book-full.txt`）无 P0/P1，唯一可感知问题即第 1 条 → 本轮只做这一项。雷达「数量 0% / 言语 0% / 常识 0%」是该 uid 10 题 8 错的真实 0%，非 R544-4「未练」口径问题。

## 一手证据

### 修前请求时序（375、`about:blank` 冷加载、`X-Kg-Probe: 1`、uid `test-r583-shots`）

| 时刻(s) | 快窗 run2 | 慢窗 run1 |
| --- | --- | --- |
| 0.0 | summary / growth / **recommend** / shenlun/stats / mastery/map / exam/attempts / profile / stats 八条同 tick 发出 | 同 |
| 0.74–0.76 | stats 回 / **recommend 回 → review 才发** / shenlun 回 | —（八条无回包） |
| 0.93 | review 回 | — |
| 12.0 | — | 八条 12s 超时 → 内建重试再发一轮，`review` 仍未发 |

### 修前源码

```js
try { const d = await request(rp); this.noteSnapshot(d); this.reco = d; } catch (e) {}
try { const d = await request(vp); if (!this.noteSnapshot(d)) { this.dueN = d.total || 0; this.dueSynced = true; } else { this.dueSynced = false; } } catch (e) {}
```

模板到期行三态：`dueSynced ? dueN + ' 题今日待复习' : offlineView ? '到期数需网络恢复后同步' : '正在同步到期数…'`——`dueSynced` 只由 review 真实回包置位，recommend 回包前 review 不发，于是「正在同步到期数…」的时长 = recommend 往返 + review 往返。

### 7d Caddy 自然/harness 分账（`q583a.sh` / `q583d.sh` / `q583e.sh`，窗 167h）

| 端点 | 自然 status | p50/p90 | harness status |
| --- | --- | --- | --- |
| GET home_bundle | 200×48 | 0.03/0.64 | 200×3098, 400×3, 503×2, 0×1, 422×3, 403×7 |
| GET recommend | 200×6 | 0.04/0.04 | 200×402, 403×3 |
| GET review | 200×63 | 0.01/0.06 | 200×2303, 403×4, 503×24 |
| GET stats | 200×14 | 0.02/0.04 | 200×933, 403×5 |
| POST practice_result | 200×4 | 0.02/0.04 | 200×220, 500×2, 400×2, 503×7, 502×1 |
| POST answer_log | 200×53 | 0.01/0.06 | 200×3264, 503×96, 0×13, 502×1, 500×1, 429×31 |

### 8 并发探针三段分账（`burst583.sh`，`burst-run1-slow.txt` / `burst-run2-report.txt`）

慢窗 round 2（8 条同发）：total 6.79–8.26s；pre 0.89 / 1.13 / 3.57 / 3.61 / 4.36 / 4.94 / 5.31 / 7.05；dur 0.35–4.32；post 0.1–5.55。快窗 80 条均值 total 0.4125 / dur 0.0337 / pre 0.3106 / post 0.0684。run1 完整表被 run2 覆盖，只保留 tail（如实登记）。

### 测试

`tests/r583-stats-reco-parallel-load.test.js`：① 源锁——`loadReco` 内 `await Promise.all([` 之前无 `await request(`、`snapPeek(rp)…snapPeek(vp)` 仍在前、两请求都在聚合内；② 两分支各自 `try/catch`，review 分支保留 R572 旧快照口径；③ 运行时（`new Function` 装载方法体 + 手控 promise）：两请求同 tick 登记 `[recommend, review]`，先 resolve review → `dueN=2 / dueSynced=true` 而 `reco` 仍 `null`，再 reject recommend → `reco` 仍 `null`、`dueSynced` 不变；④ review 回退旧快照 → `dueSynced=false`、`dueN` 保留 snapPeek 值，recommend 真实回包照常落 `reco`。`r572-stats-stale-snapshot.test.js` 两处源锁缩进跟随（`if (!this.noteSnapshot(d)) {…}` / `this.noteSnapshot(d); this.reco = d;` 内容不变）。

## 本地门

H5 `npm run lint` 0 error（存量 20 warn 不变）/ `npx vitest run` 201 文件 1565 通过 / `npm run build:h5` 产物 `index-DEX103Q0.js` / `git diff --check` 空。小程序 / 后端未改不重跑。

## 生产复验（`DEX103Q0`，`~/r583/verify583.py <uid> <width> [seed]`，`about:blank` 冷加载 + `X-Kg-Probe`）

发版 `~/r583/pages_deploy.sh`：线上 bundle `index-DEX103Q0.js` 与本机一致、7 种 `Accept-Encoding` 均 `application/javascript`、7 条回归 URL 200、health 前后 `ec8206e5`。

| 用例 | 结果 |
| --- | --- |
| 375 空 uid `test-r583-shots`（锁卡态） | `recommend / review / stats` **同 tick 0.0 发出**（修前 review 0.75 才发）；回 0.29 / 0.37 / 0.29 |
| 1440 空 uid | 同 tick 0.0 / 0.0 / 0.01 发出；回 0.2 / 0.25 / 0.27 |
| 375 有数据 uid `test-r583-v`（首页 CTA 每日一练答 10 → 8 错） | 同 tick 0.0 发出；`recommend 0.34 / stats 0.35 / review 0.38` 回；到期行 `0.13s「正在同步到期数…」→ 0.63s「8 题今日待复习」`（250ms 轮询粒度）；截图 `shots/375-verify-stats*.png`；API 81 全 2xx、console/pageerror 0 |
| 1440 有数据 uid（宿主慢窗） | 同 tick 0.0 发出；`recommend 1.87 / stats 2.61 / review 3.9` 回；到期行 4.09s 落「8 题今日待复习」；API 12 全 2xx、console 0 |

如实：1440 那窗 review 自身往返 3.9s > recommend 1.87s，本轮改动在该窗**不缩短**到期行落地时刻（串行下会是 1.87 + 3.9 ≈ 5.8s，并发下 3.9s——省的是 recommend 那一段），改善论证依赖「同 tick 发出」结构事实 + 单测，不拿总耗时当证据（R582 同口径）。

清理 `~/r583/clean583.py` SSH stdin 宿主 ro → clean → ro：两 uid 34 行（`mistakes 8 / practice_results 1 / answer_log 10 / growth_events 14 / daily_set_entries 1`）删除回执逐表相等、41 表 0 残留、`test-r583-%` uid 列表空、共享 `test-r562-modal-%` 42 保持、10 张保护表 digest 三次一致。

## 登记

- R583-1（P3，推断未证）：宿主慢窗 pre-Caddy 段 0.9–7s 的具体排队点（Caddy accept/TLS vs uvicorn 单 worker）未一手定位，需宿主侧 `perf`/`ss -ti` 或 Caddy 加 `{http.request.tls.*}`/`start` 字段才能分账；本产品代码无可改处。
- R580-1 幂等键：自然非 2xx 首例仍未出现，继续登记。

## UNTESTED

- 修后「八条全挂 12s」那种极慢窗的对照（复验只拿到 1440 中等慢窗 review 3.9s）。
- 登录态统计页 `loadReco`（同函数未单独实测）。
- 首页 `loadHome` 回退分支的真实进入（7d 自然 0 次，未做注入）。
- 小程序统计页（未改）；真机 / 真 SW / 其它浏览器 / 跨设备（R536-1 累计）。
