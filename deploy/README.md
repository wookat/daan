# 部署说明

## 当前架构（2026-08 起）：Cloudflare Pages 静态层 + 服务器回源

- `kaogong.zalize.com` DNS = CNAME `kaogong-h5.pages.dev`（CF proxied）。
- 静态层（`/`、`/index.html`、`/assets/*`、`/static/*`）由 Pages CDN 直出，
  `/assets/*` 长缓存 immutable（`deploy/cf-pages/_headers`）。
- 其余全部路径（`/api/*`、`/admin`、`/tiku/*`、`/sw.js`、`/robots.txt`、`/sitemap.xml`、
  `/qimg/*`、`/s/*` …）由 Pages Functions 同源代理回源
  `https://kaogong-origin.zalize.com`（服务器 Caddy 上的 origin 域，
  A 记录 dns-only 指向服务器），见 `deploy/cf-pages/functions/[[path]].js`
  与 `deploy/cf-pages/_routes.json`。同源代理 ⇒ 无 CORS 问题。
- 安全头（CSP/HSTS 等）：静态层由 `_headers` 下发，动态层由 functions 注入，
  与原 Caddyfile 口径一致；`/tiku/*` 保持可收录，`/api/*`、`/admin` noindex。
- 部署：`deploy/deploy_h5.sh` 新增 4c 步（需 `CLOUDFLARE_API_TOKEN`），
  服务器 rsync + 容器重建照旧（origin 仍需完整 dist 供 SSR/兜底）。
- **回滚**：把 `kaogong.zalize.com` DNS 改回 `A 150.109.230.174 dns-only`，并把宿主 Caddyfile 的
  `kaogong.zalize.com` 站点块恢复（`/etc/caddy/Caddyfile.bak-r453` 里有原块；或按下面「旧方案」
  示例 + CSP/SSE 两节重写）后 reload。该块已于 R453 删除：迁移后 19 天 33,292 行日志边缘头 0 行，
  只剩直打 VPS IP 的扫描器（Palo Alto 配对无头浏览器等）经它拿到完整壳 + 实时 API 并写入 probe=0，
  而日报只读 origin 日志看不见；留块还会让 Caddy 为该域续签 LE 失败刷 journal。现在直打该 SNI 收到 TLS alert。
- **并行会话部署闸**（R378，2b 步）：部署前读 `/api/health` 的线上 rev，要求它是本机 HEAD 的祖先；
  线上 rev 不在本机仓库（对方部署了未推送提交）或不是祖先（会把别人的上线回退）都直接 FAIL。
  解决办法是 `git fetch` 后 merge origin/main 或对方分支再部署；确认要回滚时才 `DEPLOY_FORCE=1`。
  起因：2026-09-04 13:51Z R378 上线 5 分钟后被另一会话不含 R378 的树覆盖（`deploy-history.log`
  `rev=fef41da`），复验时才发现。
- **origin 访问日志**（R85）：全量真实流量经 `kaogong-origin.zalize.com` 回源，该
  Caddy 站点块须配置 access log（JSON、roll_size 50MiB、roll_keep 14、336h），
  输出 `/var/log/caddy/kaogong-origin.zalize.com-access.log`；functions 代理层会
  在回源请求上附加 `X-Kg-Ip`（真实客户端 IP）与 `X-Kg-Ua`（原始 UA），
  归因故障时以该日志为准（`kaogong.zalize.com` 块的日志自 CF Pages 迁移后不再有流量；
  周报 `cron_access_report.sh` 与小时级归档 crontab 条目已切到 origin 日志 glob，R184）。
- **origin 域收口**（R86）：functions 回源请求带共享密钥头 `X-Kg-Edge`
  （值在 Pages 项目环境变量 `KG_EDGE_KEY`，`npx wrangler pages secret put KG_EDGE_KEY
  --project-name kaogong-h5` 设置，不入仓库）；宿主 Caddy `kaogong-origin` 块对
  无/错该头的请求直接 403（拒绝绕过边缘缓存的直连爬虫），并在 access log 中
  filter 删除该头防泄漏。轮换密钥：先 `wrangler pages secret put` 新值并重新部署
  functions，再改 Caddyfile matcher 值 reload（顺序不可反，否则 403 自伤）。

## 旧方案（仍是回源层）：现有服务器 + Caddy/Nginx 反代 + kaogong.zalize.com

1. 服务器上准备 `deploy/.env`（勿提交）：
   ```
   LLM_API_KEY=...
   LLM_BASE_URL=...
   LLM_MODEL=gpt-5.5
   ACCESS_CODE=...
   ```
2. 启动：
   ```
   cd deploy && docker compose up -d --build
   ```
   服务监听 127.0.0.1:8300（含 H5 前端 + API）。
3. 反代 + HTTPS（Caddy 示例）：
   ```
   kaogong.zalize.com {
       reverse_proxy 127.0.0.1:8000
   }
   ```
   DNS：在 Cloudflare 添加 kaogong 子域 A 记录指向服务器。

### CSP 注意（服务器 /etc/caddy/Caddyfile 管理，不在本仓库）
本站响应头 Content-Security-Policy 由服务器 Caddyfile 下发。前端引用的跨域脚本
`https://career.zalize.com/nav.js`（Zalize 统一顶栏，已下线）要求 `script-src` 包含
`https://career.zalize.com`，否则顶栏被浏览器拦截不渲染。若重建服务器/重写 Caddyfile，
须保留：
```
script-src 'self' 'unsafe-inline' https://career.zalize.com
```

### SSE 讲解流不能过 gzip（服务器 Caddyfile，R422 一手复现）
Caddy `encode gzip` 默认对 `text/*` 生效且只在首个 flush ≥512 B 时才决定压缩，一旦压缩
就把整条 `text/event-stream` 攒到结束才落地：`/api/explain/stream` 的 meta 事件含题干，
题干 ≥ ~110 字（活跃题 23.8%，言语 78%、资料 96%）即触发，用户首字前 60–110 s 零信号、
`thinking` 心跳全部失效。`kaogong-origin.zalize.com` site 块（以及回滚时重建的 `kaogong.zalize.com` 块）须写成：
```
@nosse not path */stream
encode @nosse gzip
```
复验：`curl -N --compressed` 发一道长题干题，`event: thinking` 应逐秒到达且响应头无
`vary: Accept-Encoding`。SSE 端点：`/api/explain/stream`、`/api/interview/answer/stream`、
`/api/interview/sessions/{sid}/review/stream`。

## 微信小程序上线额外要求
- 小程序 request/uploadFile 合法域名需在微信后台配置为 `https://kaogong.zalize.com`
- 构建时设置 `VITE_API_BASE=https://kaogong.zalize.com` 后 `npm run build:mp-weixin`

## 数据
SQLite 存于 docker volume `kaogong-data`（/data/data.db）。备份：`docker compose cp kaogong:/data/data.db ./backup.db`

## 重建容器失败时怎么归因（deploy_h5.sh 第 4 步，R431）
宿主是 2 vCPU / 1.9 GiB、多产品共用一个 dockerd/buildkit（recruit / softcopyright / kaogong 同机
各自 `docker compose up -d --build`），部署互相挤是常态。第 4 步现在：
- 4-pre 打宿主快照（`deploy/host_probe.sh`：`mem_avail / disk_avail / load / other_builds`），
  别家 build/up 进程在跑就等（15 s 一看，最多 300 s，超时只 WARN 不阻塞）。
- compose 用 `setsid -f nohup bash -c 'docker compose up -d --build; echo KG_COMPOSE_EXIT rc=$?'`
  起，日志 `/tmp/kg-compose-<rev>-<utc>.log`（`/tmp/kg-compose.log` 为最新的软链），末行有退出码即
  「进程已退出」、没有即「仍在跑/被打断」；轮询读到 rc≠0 立即 FAIL，不再空等到 600 s。
  注意 bash 里 `cd X && nohup cmd > log & echo ok` 的 `&` 作用于整个 `cd && nohup` 列表：bash 会 fork
  一个子 shell 跑该列表并等 cmd 结束，而子 shell 的 stdout/stderr 仍是 ssh 管道 → 本地 ssh 被拖住到
  build 结束才返回（R431 首次部署实测 ~90 s；旧脚本一直如此，只是轮询首轮就收敛没人看出来），
  ssh 掉线（`ServerAliveCountMax` 60 s 无响应）时 sshd 会 SIGHUP 整个会话。`setsid -f` 总是 fork 并
  立即返回、compose 自成会话，不再有这个耦合。
- FAIL 时自动打印宿主快照、残留 compose 进程、日志尾 40 行、内核日志近 20 min 的 OOM 关键词。
- 归因口径：**OOM 只认 `journalctl -k`/`dmesg` 里的 `Out of memory`/`oom-kill`**（VPS 上 `sudo -n` 可用），
  free 很低 ≠ OOM；`dockerd` 日志 `Control/Solve ... context canceled` + `failed to send write:
  context canceled` = build 被 client 侧（compose 进程）取消/消失，不是 buildkit 自己失败；
  `session healthcheck failed fatally: only one connection allowed` 是每次 build 会话收尾的常见噪音，
  成功的 build 也会打，不能当失败原因。R430b 首次重建（09-06 21:00 CST）就是「exporting layers
  阶段 client 侧 cancel、整个 boot 周期 0 次内核 OOM」；本地 ssh 无任何 `Timeout`/`closed by remote`
  报错、且恰在 cancel 时刻返回（之后 39 轮空轮询 ≈ 8 min 到 21:08）→ 是 compose 进程先没了才放开
  ssh，不是 ssh 掉线牵连；谁发的信号无 auditd 不可考（同机另一产品的 build 2 min 后同样 client 侧
  cancel）。

## 旧容器应用日志归档（deploy/app_log_snapshot.sh，R437）
容器日志驱动是 json-file（宿主 daemon.json `max-size 20m × 3`），日志文件随容器一起删除：
`compose up --build` 每换一次容器 ID，上一个容器的 uvicorn stdout/stderr（启动、Traceback、access
行）就没了。生命周期审计 09-01 起 251 个容器 ID、09-06 单日 22 次重建 → `docker logs --since 24h`
实际只覆盖当前容器存活的几十分钟，「过去 24 h 应用层有没有异常」这个问题结构上答不了。
- 第 4 步 compose 起之前，`app_log_snapshot.sh <live_rev>` 在远端把旧容器 `docker logs --timestamps`
  gzip 到 `/home/ubuntu/kaogong-reports/app-log/kaogong-app-<rev>-<startedAt>-to-<now>.log.gz`
  （≈9 B/行，1205 行 → 11 KB），保留 14 天，`find -mtime +14 -delete`；无容器/失败只 WARN 不阻塞。
- autoheal `docker restart` 与 restart 策略拉起不换容器 ID，日志本来就在，不归档。
- 事后查：`zcat kaogong-reports/app-log/*.gz | grep -E 'Traceback|" 5[0-9]{2} '`；行首是 UTC，
  与 caddy access（RFC3339）/ ops 日志（UTC）可直接对时。

## 生产运营脚本（deploy/kaogong-ops.sh）
- 部署位置：VPS `/home/ubuntu/kaogong-ops.sh`，cron `40 3 * * *`。
- 每日 SQLite `.backup` → 本地 `~/kaogong-backups`（gz，保留 3 份；宿主 50G 盘紧张，30 天历史看 R2）→ rclone 上传
  `r2:zalize-backups/kaogong-sqlite/`（保留 30 天，远端字节数校验）→ 健康巡检
  （`/api/questions?limit=1` 非 200 时 `docker compose up -d` 自愈）。
- R2 凭证：VPS `/home/ubuntu/.env`（`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT`，不入库）。
- 该脚本也不走 `deploy_h5.sh` rsync：改完 `scp deploy/kaogong-ops.sh` 到 `/home/ubuntu/kaogong-ops.sh`、两端 md5 核对
  （R433 同步前发现生产副本有一处未入库改动——保留份数 7→3——已回收进仓库；改前先 `diff` 生产副本）。
- 卷内手工快照巡检（R433，`VOLUME-SNAPSHOT`）：`/data` 顶层只该有 `data.db`(+wal/shm)。脚本每日 `find` 出
  `*.db*`/`*.gz` 且非 `data.db*`、>1 MB 的文件，写一行 `VOLUME-SNAPSHOT N file(s) M MB: <paths>` 到 ops 日志
  （只报不删），管理台 ops_status 按告警外显。起因：`data.db.bak-w3.gz`（178 MB）+ `r418-before.db.gz`（179 MB）
  两份手工全库快照在卷里躺了数轮无人发现，卷 922 MB → 归档后 581 MB。处置口径：容器内 `gzip -t` →
  `docker exec cat | rclone rcat --size` 到 `r2:zalize-backups/kaogong-sqlite/archive/<name>` → 远端 `rclone size`
  字节数 + `rclone cat | md5sum` 真回读与本地一致 → 才 `rm` 本地副本；活跃 `data.db`/WAL/SHM/每日备份一律不动。
  以后手工快照直接落 R2 `archive/` 或宿主 `~/kaogong-backups/pre-*.db.gz`（3 天自动清理），勿留在卷内。
- R2 前缀布局与 30 天清理边界（R434）：`kaogong-sqlite/` 顶层 = 每日 `data-YYYY-MM-DD.db.gz`（脚本
  `rclone delete --min-age 30d --max-depth 1 --include "data-*.db.gz"` 只清这一层）；`kaogong-sqlite/archive/` =
  永久手工快照（R33/R96/R418/w3），**不受 30 天清理**。R434 前那行是 `rclone delete --min-age 30d "r2:$BUCKET_PREFIX/"`
  ——rclone delete 默认递归，会把 `archive/` 一并按 30 天删掉（08-10 归档的 `bak_r96_qa*.db` 到 09-09 就满 30 天，
  差 2.6 天被日常 cron 清掉，R191 归档的 5 份都会陆续消失）；`--dry-run --min-age 1s` 两版对照可复现。
  改 archive 布局/加新前缀时先 `rclone delete --dry-run --min-age 1s` 看清理范围。archive/ 内对象统一 gzip 存
  （`rclone cat x.db | gzip | rclone rcat x.db.gz`，`rclone cat x.db.gz | gunzip | md5sum` 与原对象 md5 一致后才
  `rclone deletefile` 原件）；bucket `zalize-backups` 由多产品共用（`d1/ honestcv-kv/ probe/ recruit-pg/`），只动
  `kaogong-sqlite/` 前缀。

## 镜像 Python 依赖钉版（backend/requirements.txt，R435）
- 两份 Dockerfile（根 `Dockerfile` 与 `deploy/Dockerfile.runtime`）只 `pip install --no-cache-dir -r backend/requirements.txt`，
  清单是生产容器 `pip freeze` 的全量 `==` 钉版（含传递依赖），单测 `tests/test_requirements_pinned.py` 锁格式与装法。
- 起因：原写法 `pip install fastapi uvicorn httpx … pypdf …` 无版本；同机多产品共用 buildkit 缓存，kaogong 的 pip 层
  每隔一两次部署就被挤出（R431 `ed9e69e`、R435 `190cf70` 两次缓存 miss 重装，`Downloading pypdf-6.17.0`——发布才 2 天），
  生产依赖版本由「别家什么时候 build」决定，与本地跑测试的那套包可能不同（本轮本机 6.16.2 vs 线上 6.17.0）。
- 升级：改 `requirements.txt` → 本地 `pip install -r` + pytest 全绿 → 部署；部署后
  `docker exec deploy-kaogong-1 pip freeze | sort | diff - <(grep -v '^#' backend/requirements.txt | grep . | sort)` 应为空。
- SQLite 连接同轮加 `PRAGMA journal_size_limit=64MiB`：`-wal` 文件在 checkpoint 后不截断，此前 114 MB 里只有 3.6 MB 活帧
  （历史一次性大写入的峰值永不回收）；限额只在 WAL 重置时截文件，热路径无影响。已有的大 WAL 要手工一次
  `PRAGMA wal_checkpoint(TRUNCATE)` 才会收回。

## 搜索引擎抓取日报（scripts/crawler_stats.py，R377）
- VPS cron `23 * * * *`：`python3 /home/ubuntu/kaogong-assistant/scripts/crawler_stats.py
  /home/ubuntu/kaogong-reports/access-archive /home/ubuntu/kaogong-reports/crawler-stats.json
  --exclude-ip-file /home/ubuntu/kaogong-reports/probe-ips.txt`（读小时级归档，探针网段剔除，
  含 `140.232.64.0/24`——开发会话伪装 Googlebot UA 的 SSR 自测不能算引擎来过）。
- 产物 `crawler-stats.json` 经 `/reports` 只读挂载由 `ops_status.parse_crawler_stats` 解析，
  管理台数据看板「搜索引擎抓取」面板外显（Google/Baidu/Bing 固定置顶，从未来过标红）。
- `scripts/` 不在 `deploy_h5.sh` rsync 范围内，改动该脚本需手工 `scp scripts/crawler_stats.py
  scripts/access_log_report.py` 到 VPS 同路径；`deploy/cron_access_report.sh` 同理（不重建容器时也要 scp，md5 核对）。
- 归档目录 `/home/ubuntu/kaogong-reports/access-archive/`：小时级 `archive_access_log.py` 写明文 `access-YYYYMMDD.jsonl`，
  周报 cron（周一 08:00）把 3 天前的文件 `gzip -c >>` 成 `.jsonl.gz`（多成员追加不覆盖）、保留 90 天（R432；
  之前全明文 415 MB → 86 MB）。`crawler_stats.py::iter_archive` 与周报的 `zcat -f` 都同时读 `.jsonl` 和 `.jsonl.gz`，
  改读侧时两种都要覆盖（否则 .gz 会被静默跳过、日报少算）。
- 候选真人口径（R382/R388/R393）：逐层剔除探针网段（`probe-ips.txt`，含 VPS 自身出口）、引擎与通用
  bot UA（`BOT_GENERIC` 含 `devin/`，与后端 `PROBE_UA_MARKERS` 单测锁同步）、test- uid、源站直连（无边缘头，
  单列 `humans.direct`）、显式 `X-Kg-Probe: 1`、非正式域名 `X-Forwarded-Host`（Pages 预览域名，单列
  `humans.offhost`；`--site-host` 可覆盖默认 `kaogong.zalize.com`）。
- 搜索引擎侧入口：Google Search Console 资源 `sc-domain:kaogong.zalize.com`（DNS 自动验证，
  2026-09-04 建立并提交 sitemap.xml）；Bing/Yandex 走 IndexNow（R89）；百度站长平台待账号。

## API 文档开关
生产默认关闭公网 API 文档：compose 注入 `DISABLE_API_DOCS=1`（`/docs`、`/redoc`、
`/openapi.json` 返回 404）。本地开发（uvicorn 直跑，不设该变量）不受影响。
