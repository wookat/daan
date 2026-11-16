# R395：边缘 SWR「部署后首访旧副本」取证——否决 purge 与预热挪位，修正 R96/R394 的因果表述

日期：2026-09-05 · 分支 `devin/*-r395-edge-swr-evidence`（base=main）· 类型：取证 + 注释/文档修正，零功能改动

## 1. 起点（R394 复验实录）

部署 8 min 后 1440 首次原生导航 `/tiku/`、`/tiku/q/234080` 仍拿到旧 head（`age: 16203`、`max-age=300`），R394 归因为「`[[path]].js` SWR 先回旧副本 + deploy 3b 预热在容器重建前刷入旧版本副本 → 每个 URL 部署后首访必见一次旧 head」，候选处置：部署后 purge 入口页/sitemap，或把 3b 预热挪到重建后。本轮先取证再决定。

## 2. 一手取证（09-05 05:00–05:40Z，生产 VPS 源站归档 14 天 + 容器内 SQL + Cloudflare 官方文档）

### 2.1 引擎回源模式（按 `X-Kg-Ua` 引擎 UA，剔探针网段/`X-Kg-Probe`；`none` = 无 `X-Kg-Fetch` 头）
| 引擎 | miss | swr | retry | none |
|---|---|---|---|---|
| Yandex | 176 | 12 | 1 | 971 |
| Bing | 53 | 17 | 3 | 30 |
| Google | 21 | 3 | 0 | 0 |
| Apple | 1 | 0 | 0 | 0 |

- `none` 1,001 条**全部落在 08-31 08:23Z–09-01 12:00Z**（带 `Cf-Worker: kaogong-h5.pages.dev`、`X-Kg-Ip/Ua`，但无 `X-Kg-Fetch`/`X-Kg-Edge`），是当时上线的旧版 Functions，09-01 起 100% 带头；R394 归因的 08-31 29 条 502 正落在这段。历史事实，不再计入本轮分母。
- 09-01 起 14 天引擎经边缘回源 **287 次：miss 251 / swr 32 / retry 4**。swr 按路径族：robots 15、sitemap 13、`/tiku/q/*` 3、`/tiku/*` 其他 1、`/tiku/` 0。
- swr 副本年龄（同 URL 上一次回源到本次的间隔）：sitemap n13 p50 **19.3 h** / p90 23.6 h；robots n15 p50 0.3 h；`/tiku/q/*` n3 10.1/20.2 h（Bing `/tiku/q/296845` 两次、`/tiku/q/175977`）。
- 「swr 且期间跨过至少一次部署」（= 引擎拿到部署前副本的**上界**，不证明 body 真变了）：sitemap 13 / robots 5 / tiku-q 3 / tiku-other 1，合计 **22 / 287 = 7.7%**；`/tiku*` 页面族 **4 / 199 = 2.0%**。14 天内 208 次部署（日 34–81 次），任何 >1 h 的间隔几乎必跨部署，故该上界偏高。

### 2.2 全流量 swr（剔探针）：对真人的影响为 0
14 天 swr 共 8,678 次，**非探针只有 145 次**：robots 72 / sitemap 68 / tiku-other 1 / tiku-q 3 / tiku-root 1；其中 UA 非 bot 且副本 >10 min 的只有 robots.txt 3 条。API 允许清单（`/api/daily_set`、`/api/papers`…）swr 全部来自探针网段（部署预热/走查），真人 API 带 uid 本就绕过边缘缓存。**没有任何一条真人页面请求命中过 swr 旧副本**——真人访问稀疏且分散在不同机房，走的是 miss。

### 2.3 决定性事实：`caches.default` 按机房独立，部署预热只落在 ICN
- Cloudflare 官方文档（developers.cloudflare.com/workers/runtime-apis/cache）：「The Cache API is available globally but **the contents of the cache do not replicate outside of the originating data center**」。
- 源站归档 `Cf-Ray` 机房后缀（14 天）：探针/Devin 走查 **PDX** 116,847（另 YVR/ICN/SYD/DFW 少量）；Yandex **FRA 531 / AMS 249 / MXP 223 / LHR 102**；Bing **IAD 62 / SEA 11 / EWR 8**…；Google **DFW 23**；VPS 自身 curl（cron/部署脚本）**ICN 57**。生产 VPS（150.109.230.174）实测 `curl https://kaogong.zalize.com/robots.txt` → `cf-ray: …-ICN`、`x-edge-cache: MISS`。
- 含义：
  1. deploy 3b「边缘预热」23 条 URL 只刷 **ICN** 机房副本，**引擎和真人所在机房 0 覆盖**——R96 写的「容器重建窗口内 stale-if-error 必有副本可退」只对 VPS 自身的 cron 请求成立；引擎在重建窗口拿到的 STALE 副本来自它自己上次在同机房的抓取（09-02–09-04 `/sitemap.xml`/`robots.txt` swr→503×25 s 共 12 条样本即此路径生效）。
  2. R394 复验看到的旧 head 是 **PDX 机房里 Devin 自己 4.5 h 前走查留下的副本**，与 3b 预热无关（3b 在 ICN）。
  3. 「把 3b 挪到重建后」对引擎/真人**零效果**；从 VPS 发 Cache API purge 同样只清 ICN。全网即时生效只剩 zone 级 purge API（需带 purge 权限的 CF token，Cache API 条目是否随 zone purge 清除**未验证**），而其能改善的上界是 14 天 22 次引擎抓取（`/tiku*` 4 次）。

### 2.4 顺带核实：sitemap 回源慢不是 SQL
- 源站 MISS 200 耗时：sitemap n47 p50 0.71 s / **p90 7.5 s / p99 24.4 s**，`/tiku/q/*` n52 p50 8 ms / p90 93 ms。
- 容器内实测：`SELECT id, updated_at … LIMIT 10000 OFFSET lo` 已走 `COVERING INDEX idx_q_sitemap(disabled,id,updated_at)`，分片 1/6/11 各 **0.03–0.04 s / 0.4–1.0 MB**；`_question_ids()` 109,371 行 0.044 s / 0 MB。
- 慢样本与部署窗口（±10 min）强相关（miss 47 条中 near_deploy 占 8/10 pages、3/5 q-11…），并伴 25 s 503（Caddy 上游超时）；取证时宿主 `MemAvailable` 214–268 MiB / 1,935 MiB、load 5、同宿主新增 recruit-*/softcopyright-* 8 个容器。属宿主资源争用（第 14 次上报），不做应用侧改动。

## 3. 决定（如无异议按此执行）
- **不做** 部署后 purge、**不做** 3b 预热挪位、**不改** SWR 语义：影响上界 14 天引擎 22 次（页面 4 次）、真人 0 次，且 24 h 长存副本在部署/宿主抖动窗口给引擎兜住了 12 次 503。
- **只改表述**：`deploy_h5.sh` 3b 注释改为「只刷本机所在机房（ICN）副本，覆盖 VPS 自身 cron/脚本；引擎/真人机房不受影响」；`[[path]].js` 顶部注释补「副本按机房独立」；`docs/handoff-context.md` R394 段落的因果表述在 R395 段落修正。
- 3b 保留：成本 23 次 GET，仍能让 VPS 上 `cron_access_report.sh`/`perf-budget.sh` 等本机请求在重建窗口拿 STALE 而非 502。

## 4. 验证
- 本地：`bash -n deploy/deploy_h5.sh`；`frontend-uni` vitest（edge-policy 用例）+ eslint；后端 pytest/ruff/pyright 基线不受影响（无后端改动）。
- 生产：本轮不部署（无运行时改动），下轮部署一并带上。

## 5. 未验证 / 边界
- zone 级 purge 是否清除 Cache API 条目未实测（无 purge 权限 token，也无需求）。
- 「跨部署」只是时间关系上界；未逐条比对副本 body 是否与新版不同。
- Google/Bing 对 R394 sitemap `mobile:` 扩展的接受情况仍以 09-06 后面板为准。
