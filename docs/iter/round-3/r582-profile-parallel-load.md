# R582 · 我的页 `loadRemote` 三端点并发（生产实测串行 5.4s 才发 growth）+ 1440 R580 C/D 补测 + 自然样本回看

分支 `devin/1789048590-r582-profile-parallel-load`（从 #760 分支开，链含 #742–#760）。本轮改动：`frontend-uni/src/pages/profile/profile.vue`（仅 `loadRemote()` 请求编排）+ 新测试 `frontend-uni/tests/r582-profile-parallel-load.test.js`。0 后端；Pages `index-eO1hqVT6 → B90Wn8n0`，health 全程 `ec8206e5`。

## 结论（先讲）

1. **我的页三条互不依赖的请求原来是串行 `await`**（`/api/profile` → `/api/growth` → `/api/announcement`）。375 生产冷加载实测（修前 bundle `eO1hqVT6`，`~/r582/timing1.log`）：`profile` 与 `favs`/`badges` 同 tick 发出，`growth` 要等 `profile` 5.32s 回包后 **5.4s 才发**、8.29s 才回，`announcement` 8.29s 才发；期间「错题本」格子一直是 `—`（`mistakeN == null`）。宿主慢是外因，但串行把一次长尾放大成三次，是本产品代码可控的部分。
2. **实修**：`loadRemote()` 快照即显不变，三请求改为 `Promise.all` 内三个各自 `try/catch` 的 async 分支（任一失败只影响自身，不短路其余）；`adoptServerDailyGoal` / `applyGrowth` / `announce` 各分支体逐字不变，不改任何 payload / 端点语义。统计页 `stats.vue` 早已对 `exam/attempts` + `profile` 用 `Promise.all`，本轮与之同口径。
3. **修后生产实测**（`B90Wn8n0`，同 uid 冷加载）：375 `profile/growth/announcement/favs/badges` **同 tick 1.94s 发出**（`timing2-375.log`）；1440 同 tick 0.0s 发出、宿主慢窗下 `profile` 4.55s / `growth` 5.68s 回（`timing2-1440.log`）——growth 不再等 profile 回包，落 `8 错题本` 的时刻从「profile 回包 + growth 往返」缩到「growth 一次往返」。两次 `STATS_TEXT 10 累计做题 | 8 错题本 | 1 天 连续打卡` 与修前一致（语义不变）。
4. **1440 R580 C/D 补测 17/17 PASS**（`~/r580/walk580b.py test-r582-cd 1440 cd`，`~/r582/cd1440.log`）：C 中途退出层语义不变（1/10 退出层 → 保留进度 → 续练卡 1/10 → 答完停末题 → 自然完成 `practice_result` 恰 1×200 → 完成页顶栏返回不重复上报）；D 往期每日一练全答完顶栏返回直接离页、`practice_result` 恰 1×200、`daily_set/submit` 0 次、首页 hero 未完成态 / 本机 `pendingSession` 已清；API 145 全 2xx、requestfailed 0、console/pageerror 0。R580 挂账的「1440 C/D」UNTESTED 清账。
5. **自然样本回看：R580-1 触发条件未满足**（`q582a.sh` / `q582b.sh` 只读）：24h Caddy `/api/practice_result` 全为 harness（200×27 + 502×1，`X11; Linux x86_64` + `X-Kg-Probe`），自然非 2xx/status 0 **0 例**；3 天自然 `practice_results` 0 行、`merged_anon` 0、`question_favs` 0、`daily_set_entries` 09-06 1 行；`practice_progress` 3 天 3 行自然（`link` / 无 source / `redo`，均 `daily=NULL`）。自然 IP 18 个：`.env`/GraphQL 类扫描器 1 个、真人形态浏览（`home_bundle`/`review/cur`/`daily_set` 首屏簇，iPhone/Android/Windows）若干，无人进入 `practice_result` 写路径 → 只能说「窗内无合格自然样本」，R580-1 继续登记不实施。
6. 375 每日一练完成页 / 我的页截图走查（`~/r582/shots.py`，91 API 全 2xx、console 0）：完成页信息层级与 R576/R578 一致无 P0/P1；我的页首屏唯一可感知问题即上面的 `—` 长尾 → 本轮只做这一项。

## 一手证据

### 修前 / 修后请求时序（同 uid `test-r582-shots`、`about:blank` 冷加载、`X-Kg-Probe: 1`）

| 时刻(s) | 修前 375（`eO1hqVT6`） | 修后 375（`B90Wn8n0`） | 修后 1440（`B90Wn8n0`） |
| --- | --- | --- | --- |
| 发出 | 0.0 favs / profile / badges | 1.94 favs / **profile / growth / announcement** / badges | 0.0 favs / **profile / growth / announcement** / badges |
| profile 回 | 5.32 | 2.31 | 4.55 |
| growth 发 | **5.4**（等 profile） | 1.94（同 tick） | 0.0（同 tick） |
| growth 回 | **8.29** | 2.41 | 5.68 |
| announcement 发 / 回 | 8.29 / 8.32 | 1.94 / 1.99 | 0.0 / 0.03 |

修前 `growth` 从「可发」到「实发」白等 5.4s；修后 0。宿主快慢两窗都覆盖到（修后 375 窗宿主 2.3s、1440 窗 4.5s），改善来自编排而非宿主恰好变快。

### 源码（修前）

```js
try { const d = await request(pp); … } catch (e) {}
try { this.applyGrowth(await request(gp), uid); } catch (e) {}
try { const d = await request('/api/announcement'); … } catch (e) {}
```

`profile.vue` `statItems` 中 `{ label: '错题本', value: this.mistakeN == null ? '—' : this.mistakeN }`，`mistakeN` 只由 `applyGrowth` 落（W14 口径，不再直请 `/api/mistakes`）。

### 测试

`tests/r582-profile-parallel-load.test.js`：① 源锁——`loadRemote` 内 `await Promise.all([` 之前无 `await request(`、快照 `snapPeek(pp/gp)` 仍在前、三请求都在聚合内；② 三个 `(async () => { try … catch (e) {…} })()` 分支各自兜底；③ 运行时——用 `new Function` 装载 `loadRemote` 方法体注入 fake `request`：三请求**同 tick**登记为 `[profile, growth, announcement]`，先 resolve growth → `mistakeN=8` 而 `profile` 仍 `null`，再 reject profile + resolve announcement → `announce` 落地、`mistakeN` 不变。既有 `w14-growth-mistakes.test.js` / `logout-r496-account-state-refresh.test.js` 通过。

### 本地门

H5 eslint 0（`lint.log` RC=0）、vitest **200 文件 / 1561**、`build:h5` 产物 `index-B90Wn8n0.js`、`git diff --check` 空。小程序 / 后端 0 改动不跑。

### 发版与回归

`~/r580/pages_deploy.sh`（复用）：线上 bundle `eO1hqVT6 → B90Wn8n0`（两次 5s 重试后一致），7 条编码探测全 javascript，`/api/stats` `/api/questions×2` `/tiku/` `/robots.txt` `/indexnow-key.txt` `/admin` 全 200，health 前后 `ec8206e5`。

### 清理

`~/r582/clean582.py`（`clean580.py` 前缀改 `test-r582-%`）经 SSH stdin 宿主执行 ro → clean → ro：命中 `mistakes 28 / answer_log 30 / growth_events 13 / practice_results 3 / daily_set_entries 1` = 75 行、uid 三个（`test-r582-shots` / `test-r582-cd-c` / `test-r582-cd-d`），删除回执逐表相等，独立只读 41 表 0 残留，共享 `test-r562-modal-%` 42 行不动，10 张保护表 digest 前后一致。

### 宿主（只读）

load 16.75–18.07 / mem_avail 206–263MB / disk 88.2% / health 2.75s；未 kill 他家进程、未叠 build。

## 如实登记

- 改善的是「growth/announcement 的发出时刻」，不是任何单次往返；宿主慢窗内 growth 仍要一次往返（1440 窗 5.68s）。
- 修后 375 实测宿主刚好较快（2.3s），单看该次不能证明改善；改善的论证依赖「发出时刻同 tick」这一结构事实 + 1440 慢窗对照。
- UNTESTED：登录态我的页（`accountReady` 分支 `loadRemote` 同一函数，未单独实测）、`snapPeek` 命中时快照与真实回包覆盖顺序（源码不变、仅既有单测）、小程序我的页（`loadGrowth` 本就独立发，未改）。
- R580-1 触发条件（自然 `practice_result` 非 2xx/status 0 首例）本窗仍未满足，继续登记。
