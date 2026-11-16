# R437 取证：24h 非 2xx 逐条归因 + 「应用日志随容器重建丢失」

日期 2026-09-06（UTC 15:1x–15:4x）。改动：`deploy/app_log_snapshot.sh`（新）+ `deploy/deploy_h5.sh` 3 行 + README；
后端/前端不动，bundle `index-junWyPAm.js` 不变。部署 `83c7522`。

## 1. 起点：过去 24 h 容器/应用日志 WARN + 非 2xx 逐条归因

### 1a 应用日志（容器 stdout/stderr）
`docker logs --since 24h deploy-kaogong-1` 非 access 行含 `warn|error|exception|fail`：**0**；uvicorn access 非 2xx：
`404 GET /api/export/pdf` ×1（curl/8.5.0，150.109.230.174，无该路由 → 扫描/探测，正确 404）。

**但这个「24 h」是假的**：当时容器 `StartedAt=15:11:31Z`（R435 `3c451c9` 重建），`docker logs` 只有 16 min、1053 行。
见 §2。

### 1b caddy 源站 access（`/var/log/caddy/kaogong-origin.zalize.com-access.log`，24 h 9975 请求）
按 status+method+归一路径分组，代表 UA / `X-Kg-Probe` / `Cf-Connecting-Ip`，全部可归因，无未登记产品问题：

| 组 | 次 | 归因 |
|---|---|---|
| 404 POST `/api/team/join`、GET `/api/mock/events/6/report`、`/api/paper/ZZZZ9999`、`/api/interview/sessions/{21,23}`、`/api/exam/progress`、`/api/questions/<n>`、`/api/exam/rank`、`/api/version`、`/api/announce`、`/api/weekly_report`、`/api/pk/result/nonexist`、`/api/share/nonexist`、`/tiku/paper/5/`、`/tiku/papers/<n>` | 27 | 全部出口 140.232.64.4/.5（`KG_PROBE_CIDRS`），R425–R436 各轮 testing agent / 我的 curl 负向用例 |
| 401 POST `/api/auth/sso` ×4、400 POST `/api/interview/sessions/{20,24}/review/stream` ×3、403 GET `/api/exam/rank/13`、503 GET `/api/health` ×1 | 9 | 同上探针网段；503 health 落在 R435 重建窗口 |
| 503 POST `/api/auth/wxlogin` ×3 | 3 | R425 那台 vivo V2405A 小程序（39.158.40.85），`WX_MINIAPP_SECRET` 未配的既定 503 |
| 403 GET `/` ×3、`/robots.txt` ×1 | 4 | 无边缘头直连源站（`Cf-Connecting-Ip` 空），R388 口径的源站扫描器，Caddy 403 正确 |
| 404 GET `/.well-known/security.txt` ×2 | 2 | Palo Alto 扫描器自报 UA |
| 404 GET `/sitemap-questions-12.xml` ×2 | 2 | 52.167.144.170（Bing）。`sitemap.xml` 索引现列 1–11 分片（活跃 109,371 / `SITEMAP_SHARD`），12 从未在当前索引里 → Bing 记住的历史分片（活跃题更多时曾有 12）；分片按 `OFFSET` 切、越界即 404 是设计内，引擎会自行淘汰。不改 |

顺带核 R396/R400/R405 隔离解析（`explanation_quarantine` 874 行）在 SEO 页的呈现：`/tiku/q/234961` 200，正文与 JSON-LD
`acceptedAnswer` 回落到花生十三方法解析（非空、答案 B 与题库一致），无「解析为空」态。不改。

## 2. 命中：应用日志随容器重建丢失（一手）

- 宿主 `/etc/docker/daemon.json`：`log-driver json-file, max-size 20m, max-file 3`；容器 `LogPath=/var/lib/docker/containers/<id>/<id>-json.log`。
  json-file 日志属于容器，`compose up --build` 换容器 ID 即随旧容器删除（`/var/lib/docker/containers` 15 个目录 = `docker ps -aq` 15 个，无残留）。
- `kaogong-reports/container-events.log`（R-lifecycle 每分钟审计）：09-01 起 **251 个不同容器 ID**，按日 36/81/49/35/27/23；
  `deploy-history.log` 09-06 单日 **22 次部署**（00:36 → 15:11）。→ 任何时刻 `docker logs` 只覆盖当前容器存活期
  （今天最长 ~80 min），R372 假死 / R397 空 200 / R421 首字 65 s 这类要靠 Traceback、请求耗时行归因的问题，
  一旦跨过一次部署就无第一手应用日志；历轮「60 min 日志 5xx/Traceback/locked 0」都只是当前容器窗口内的陈述。
- autoheal `docker restart` / restart 策略拉起不换 ID，日志不丢；只有重建丢。

### 修（最小、不改日志驱动、不动共享 dockerd 配置）
`deploy/app_log_snapshot.sh`：远端 `docker logs --timestamps deploy-kaogong-1 | gzip` →
`/home/ubuntu/kaogong-reports/app-log/kaogong-app-<live_rev>-<StartedAt>-to-<now>.log.gz`，`find -mtime +14 -delete`；
无容器 / docker logs 失败 / ssh 失败均只打一行 `snapshot=skipped reason=…` 不阻塞。`deploy_h5.sh` 第 4 步在
`PREV_STARTED` 之后、compose 起之前调用（`bash -s "$LIVE_REV" < deploy/app_log_snapshot.sh`，与 `host_probe.sh` 同注入方式）。
没选 journald 驱动：要改宿主 daemon.json / compose logging（共享 dockerd、磁盘 91%），且 journald 配额是宿主级共享；
没选 max-size 调大：不解决「随容器删除」。

### 验证
- 预演（不部署）：`bash -s 3c451c9 < deploy/app_log_snapshot.sh` → `lines=1205 bytes=11182`（≈9 B/行），`gzip -t` ok，首行
  `2026-09-06T15:11:33.80Z INFO: Started server process [1]`、末行为当刻 health 行；`Traceback|ERROR|WARN` 0。
- 真实部署 `83c7522`（`--skip-build`，bundle 不变）：第 4 步打印
  `old-container-log: snapshot=…/kaogong-app-3c451c9-20260906T151131Z-to-20260906T153126Z.log.gz lines=1283 bytes=12113`；
  compose rc=0、第 7 轮收敛、`/api/health` rev `83c7522`、healthy 0 重启、新容器日志 5xx/Traceback/locked 0；
  6/6 接口回归 200；5b 七种 Accept-Encoding 变体全 `application/javascript`；`app-log/` 现 2 个文件（预演 + 部署）。
- 6b Lighthouse `/` performance 0.84 / LCP 2793 一次 WARN（bundle 不变，`/tiku/` 通过）——同 R424/R427/R431/R435 形态。
- 本地 `bash -n` 两脚本过；后端/前端无改动不跑 pytest/vitest；无 UI/DB 写入不派 testing agent。

## 3. 顺带登记（不改）
- 本机（devin-box）无 `brotli` 可执行文件：R367 起 60 次部署全部打 `WARN: 本机无 brotli，跳过预压缩`，dist 无 `.br`；
  线上 `Accept-Encoding: br` 仍回 `content-encoding: br`（边缘/Caddy 动态压缩），5b 校验从未失败——是预压缩优化缺位、
  不是功能缺口；要补则在部署机装 brotli 即可，本轮不动。
- `sitemap-questions-<n>` 分片按 `OFFSET` 切：题目 disable/启用会让同一题在分片间漂移（引擎看到分片内容整体变动），
  非错误；如日后引擎侧出现分片重抓放大再评估按 id 段切。

## 4. 事实 / 推断 / 未验证
- 事实：容器 json-file 日志随重建删除；09-06 22 次重建；24 h caddy 非 2xx 全部归因到探针/扫描/既定 503/历史分片；
  快照脚本预演与真实部署各产出 1 份可读 gz。
- 推断：Bing 请求分片 12 是历史索引记忆（未查 Bing 端记录）；`.br` 由边缘生成（未看 Caddy 配置里是否也开了 br）。
- 未验证：14 天 `-mtime` 清理还没到期样本；快照在容器已 `exited` 状态下 `docker logs` 同样可读（未演练）。
