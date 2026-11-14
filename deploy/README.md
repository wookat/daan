# 部署说明

## 当前架构（2026-09-19 迁移后）：Cloudflare Pages 静态层 + Pages Functions 回源 + Cloudflare Tunnel + 新 VPS

### 边缘层（Cloudflare 新账号）

- 账号 `583090ace6fb9a02db3f2625487ed865`（2026-09-10 由旧账号迁入；zone `zalize.com`
  id `d510abee5fa2986b76c8bb181477afb3`）。
- `kaogong.zalize.com` DNS = CNAME `kaogong-h5-zalize.pages.dev`（proxied）。
  Pages 项目 `kaogong-h5-zalize` 建于新账号（旧账号项目 `kaogong-h5` 已弃用未删）。
- 静态层（`/`、`/index.html`、`/app/*`、`/lp-assets/*`、`/assets/*`、`/static/*` 等
  `_routes.json` exclude 的路径）由 Pages CDN 直出；`/app/assets/*` 长缓存 immutable，
  跨部署 hash 资产叠加保留（deploy_h5.sh 4c 步），`_headers` 下发安全头。
- 其余全部路径（`/api/*`、`/admin`、`/tiku/*`、`/sw.js`、`/robots.txt`、`/sitemap.xml`、
  `/qimg/*`、`/s/*` …）由 Pages Functions 同源代理回源 `https://kaogong-origin.zalize.com`
  （`deploy/cf-pages/functions/[[path]].js` + `_routes.json`）。边缘缓存：TTL 内 HIT /
  过期 SWR 回陈旧副本后台刷新 / stale-if-error 兜底；条件请求 304、ETag/Last-Modified
  指纹、bot UA 403、安全头注入（`SECURITY_HEADERS`）、`X-Kg-Ip`/`X-Kg-Ua` 透传真实
  客户端 IP/UA、`X-Kg-Edge` 共享密钥头。同源代理 ⇒ 无 CORS 问题。
- 安全头（CSP/HSTS 等）：静态层由 `deploy/cf-pages/_headers` 下发，动态层由 functions
  `SECURITY_HEADERS` 注入——**不再由源站 Caddy 下发**（新 Caddyfile 无安全头配置）。
  `/tiku/*` 保持可收录，`/api/*`、`/admin` noindex。
- Pages 部署凭证：新账号 Global API Key + 邮箱（org secrets `CLOUDFLARE_NEW_GLOBAL_API_KEY` /
  `CLOUDFLARE_NEW_ACCOUNT_EMAIL`，脚本内映射为 wrangler 的 `CLOUDFLARE_API_KEY`/`CLOUDFLARE_EMAIL`；
  旧 `CLOUDFLARE_API_TOKEN` 对新账号无权限，脚本已 `unset`）。

### 回源层：Cloudflare Tunnel（2026-09-19 起，替代原 A 记录直连）

- `kaogong-origin.zalize.com` DNS = CNAME
  `5d0dc2a0-2525-4f81-be69-9faee1002030.cfargotunnel.com`（proxied）。
- Tunnel `kaogong-origin`（id `5d0dc2a0-…`）ingress 远程托管：
  `kaogong-origin.zalize.com` → `https://localhost:443`（originServerName 同域名）。
  由源站机容器 `cloudflared-kaogong`（`cloudflare/cloudflared`，token 注入）外连建立，
  **源站无需公网入站**；配置查询：CF API `GET /accounts/{id}/cfd_tunnel/{id}/configurations`。
- 宿主 Caddy `/etc/caddy/Caddyfile`（单站点块 `kaogong-origin.zalize.com`）：
  - 无/错 `X-Kg-Edge` 头 → 403（matcher 值与 Pages secret `KG_EDGE_KEY` 一致；
    access log `format filter` 删除该头防泄漏）；
  - `reverse_proxy 127.0.0.1:8300`（`lb_try_duration 25s`、`health_uri /api/health`）；
  - `@nosse not path */stream` + `encode @nosse gzip`（SSE 不压缩，见下文）；
  - access log JSON → `/var/log/caddy/kaogong-origin.zalize.com-access.log`
    （roll_size 50MiB、roll_keep 14、roll_keep_for 336h）。

### 源站服务器（2026-09-19 迁移后）

- **新机 `101.42.17.195`**（腾讯云 VM-24-13-opencloudos，**4 vCPU / 3.7 GiB / 60G 盘，
  kaogong 独享**——不再有多产品共用宿主的资源争抢）。
  SSH：`ubuntu@101.42.17.195`（docker 组，可跑 docker/compose）或 `root@`；
  密钥 `~/.ssh/wookat.pem`（`~/.ssh/config` 的 `Host *` 兜底自动尝试）。
- 应用目录 `/home/ubuntu/kaogong-assistant`（`deploy_h5.sh` 的 `REMOTE_DIR` 不变）；
  compose 项目目录 `deploy/`，compose 项目名 `deploy`。
- 容器：`deploy-kaogong-1`（FastAPI/uvicorn，`127.0.0.1:8300→8000`，镜像 `deploy-kaogong:latest`，
  healthcheck `/api/health`）、`deploy-autoheal-1`（willfarrell/autoheal，`autoheal=true` 标签）、
  `cloudflared-kaogong`（tunnel 客户端）。
- 数据：SQLite docker volume **`deploy_kaogong-data`** → `/data/data.db`
  （compose 项目名 `deploy` → 卷名带 `deploy_` 前缀；卷名与老机相同，
  但迁移后是新机上的新卷实例，数据已随迁移灌入）。
  容器内手工快照/大文件留在 `/data` 顶层会触发 ops 脚本 VOLUME-SNAPSHOT 告警；
  手工备份请放 `~/kaogong-backups` 或直接传 `r2:zalize-backups/kaogong-sqlite/archive/`。
- 运维脚本与 cron（ubuntu 用户 crontab，脚本在 `/home/ubuntu/`）：
  - `kaogong-ops.sh` 每日 03:40：sqlite `.backup` → `~/kaogong-backups`（留 3 份）→
    rclone 上传 `r2:zalize-backups/kaogong-sqlite/`（30 天清理）→ 健康巡检自愈；
    R2 凭证读 `/home/ubuntu/.env`（`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`）；
  - `kaogong-lifecycle-watch.sh` 每分钟；
  - `deploy/cron_access_report.sh` 每周一 08:00 周报；
  - `scripts/archive_access_log.py` 每小时 :17 → `kaogong-reports/access-archive/`；
  - `scripts/crawler_stats.py` 每小时 :23 → `kaogong-reports/crawler-stats.json`。
- 审计/报表目录 `/home/ubuntu/kaogong-reports/`（`deploy-history.log`、`access-archive/`、
  `app-log/`、`kaogong-ops.log`、`crawler-stats.json`、`probe-ips.txt` 等），
  容器只读挂载 `/reports` 供 `/api/admin/ops_status` 外显。
- **老机 `150.109.230.174`（VM-0-8-ubuntu）已不再承载 kaogong**：compose 项目已拆除、
  ubuntu crontab 无 kaogong 条目；`/home/ubuntu/kaogong-assistant`、`kaogong-reports`、
  `kaogong-ops.sh` 等残留文件仍在但不再生效（未清理）。旧「A 记录直连 + 独立 Caddy 站点块」
  回滚路径已不存在。

### 已知问题（2026-11-14 更新）

- ~~R2 每日备份上传失败~~ **已于 2026-11-14 修复**。根因：迁移后 `/home/ubuntu`
  属 root:root 755，ubuntu 用户 `mkdir -p kaogong-backups` Permission denied；
  脚本仅 `set -u` 无 `set -e`，本地备份链静默断裂 → `docker cp` 无文件 →
  rclone 无文件可传（报 FAILED）→ `gunzip` 验证失败 → `daily.db` 残留卷内
  （VOLUME-SNAPSHOT 告警）。R2 凭证本身一直有效。处置：`chown ubuntu:ubuntu
  /home/ubuntu` + 手动跑一次 `kaogong-ops.sh` 验证：`r2 upload ok`（345 MB）、
  `RESTORE-VERIFY ok questions=210857`。**教训：该脚本无 set -e，单点失败会
  级联成「备份全挂」假象，排查先看本地环节再怀疑 R2。**
- **边缘预热机房变化**：新机出口打 `kaogong.zalize.com` 落 CF **AMS**（欧洲）机房
  （老机是 ICN）；deploy_h5.sh 3b 预热只刷新发起方机房副本，用户主体在亚洲机房的
  副本靠各自历史访问自然建立，预热收益较迁移前下降。
- `deploy-history.log` 自 2026-09-10 后无新行（迁移后部署未再写入，待核是否路径变更）。

### 部署

`deploy/deploy_h5.sh`（用法不变）：本机构建 H5 → brotli 预压缩 → 线上 rev 谱系闸 →
rsync `backend deploy knowledge frontend-uni/dist` 到 `REMOTE_DIR=/home/ubuntu/kaogong-assistant` →
远端 `docker compose up -d --build` 重建 → 线上 rev 校验 → CF Pages 部署（wrangler@3）→
`/app/` 前缀边缘缓存 purge → bundle hash + 接口回归 + Lighthouse 预算。
SSH 凭证走 `TICKETS_VPS_SSH_{USER,HOST,CREDENTIAL}`（HOST 现为 `101.42.17.195`）。

- **回滚**：后端 = 服务器 rsync 旧代码 + compose 重建（或指定旧镜像 tag）；
  前端 = CF Pages previous deployment（dashboard 或 `wrangler pages deployment list`）。
  **无「DNS 改回 A 记录」路径**（老机 Caddy 站点块已删、机器已腾空）。

## CSP 注意
`script-src` 须包含 `https://career.zalize.com`（Zalize 统一顶栏）与
`https://static.cloudflareinsights.com`（CF Web Analytics beacon），否则顶栏/统计脚本被
浏览器拦截。口径在 `deploy/cf-pages/_headers`（静态层）与
`deploy/cf-pages/functions/[[path]].js` 的 `SECURITY_HEADERS`（动态层）两处，改一处必改另一处。

## SSE 讲解流不能过 gzip（源站 Caddyfile，R422 一手复现）
Caddy `encode gzip` 默认对 `text/*` 生效且只在首个 flush ≥512 B 时才决定压缩，一旦压缩
就把整条 `text/event-stream` 攒到结束才落地：`/api/explain/stream` 的 meta 事件含题干，
题干 ≥ ~110 字（活跃题 23.8%，言语 78%、资料 96%）即触发，用户首字前 60–110 s 零信号、
`thinking` 心跳全部失效。新机 `/etc/caddy/Caddyfile` 的 `kaogong-origin` 块已配置：
```
@nosse not path */stream
encode @nosse gzip
```
（老机同规则；重建 Caddyfile 时必须保留）。复验：`curl -N --compressed` 发一道长题干题，
`event: thinking` 应逐秒到达且响应头无 `vary: Accept-Encoding`。
SSE 端点：`/api/explain/stream`、`/api/interview/answer/stream`、
`/api/interview/sessions/{sid}/review/stream`。

## 微信小程序上线额外要求
- 小程序 request/uploadFile 合法域名需在微信后台配置为 `https://kaogong.zalize.com`
- 构建时设置 `VITE_API_BASE=https://kaogong.zalize.com` 后 `npm run build:mp-weixin`

## 数据
SQLite 存于 docker volume `deploy_kaogong-data`（`/data/data.db`，当前 ≈900 MB）。
备份链路见「运维脚本」（2026-11-14 已恢复：本地 3 份 + R2 每日 + 周日 R2 回读校验）。
手工只读查询：`ssh ubuntu@101.42.17.195 "docker exec deploy-kaogong-1 python -c \"import sqlite3; …\""`，
库文件用 `file:/data/data.db?mode=ro` URI 只读打开。

## 部署并行会话闸（deploy_h5.sh 2b 步，R378）
部署前读 `/api/health` 的线上 rev，要求它是本机 HEAD 的祖先；线上 rev 不在本机仓库
（对方部署了未推送提交）或不是祖先（会把别人的上线回退）都直接 FAIL。
解决办法是 `git fetch` 后 merge origin/main 或对方分支再部署；确认要回滚时才 `DEPLOY_FORCE=1`。
起因：2026-09-04 13:51Z R378 上线 5 分钟后被另一会话不含 R378 的树覆盖
（`deploy-history.log` `rev=fef41da`），复验时才发现。

## origin 访问日志与周报（R85/R184）
全量真实流量经 `kaogong-origin.zalize.com` 回源，Caddy access log 为归因准绳
（`/var/log/caddy/kaogong-origin.zalize.com-access.log`，JSON、roll 50MiB×14、336h）；
functions 代理层在回源请求上附加 `X-Kg-Ip`（真实客户端 IP）与 `X-Kg-Ua`（原始 UA）。
小时级归档 cron `archive_access_log.py`（每小时 :17）→ `kaogong-reports/access-archive/`；
周报 `cron_access_report.sh`（周一 08:00）读归档；小时级 `crawler_stats.py`（:23）产出
`crawler-stats.json` 供管理台数据看板。探针剔除口径含 `probe-ips.txt` 与
`KG_PROBE_CIDRS`（Devin 会话共享 NAT 网段）。

## 旧容器应用日志归档（deploy/app_log_snapshot.sh，R437）
容器日志驱动是 json-file（宿主 daemon.json `max-size 20m × 3`），日志文件随容器一起删除：
`compose up --build` 每换一次容器 ID，上一个容器的 uvicorn stdout/stderr 就没了。
`deploy_h5.sh` 第 4 步 compose 起之前，`app_log_snapshot.sh <live_rev>` 在远端把旧容器
`docker logs --timestamps` gzip 到 `/home/ubuntu/kaogong-reports/app-log/kaogong-app-<rev>-<startedAt>-to-<now>.log.gz`，
保留 14 天。autoheal `docker restart` 与 restart 策略拉起不换容器 ID，不归档。
事后查：`zcat kaogong-reports/app-log/*.gz | grep -E 'Traceback|" 5[0-9]{2} '`；
行首是 UTC，与 caddy access（RFC3339）/ ops 日志（UTC）可直接对时。

## 生产运营脚本（deploy/kaogong-ops.sh）
- 部署位置：新机 `/home/ubuntu/kaogong-ops.sh`，cron `40 3 * * *`（ubuntu 用户）。
- 每日 SQLite `.backup` → 本地 `~/kaogong-backups`（gz，保留 3 份）→ rclone 上传
  `r2:zalize-backups/kaogong-sqlite/`（保留 30 天，远端字节数校验）→ 健康巡检
  （`/api/questions?limit=1` 非 200 时 `docker compose up -d` 自愈）→ VOLUME-SNAPSHOT 巡检
  （`/data` 顶层非 `data.db*` 的 >1MB 文件只报不删）→ MEM 记录。
- R2 凭证：`/home/ubuntu/.env`（`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT`，不入库）。
  2026-09-19～11-13 曾因 `/home/ubuntu` 属主错误致本地备份链断裂（见已知问题，已修复）；
  改前仍先核 `kaogong-ops.log` 尾部 + `ls ~/kaogong-backups`。
- 该脚本不走 `deploy_h5.sh` rsync：改完 `scp deploy/kaogong-ops.sh` 到
  `/home/ubuntu/kaogong-ops.sh`、两端 md5 核对（改前先 `diff` 生产副本）。
- R2 前缀布局与 30 天清理边界（R434）：`kaogong-sqlite/` 顶层 = 每日 `data-YYYY-MM-DD.db.gz`
  （`rclone delete --min-age 30d --max-depth 1 --include "data-*.db.gz"` 只清这一层）；
  `kaogong-sqlite/archive/` = 永久手工快照，**不受 30 天清理**。bucket `zalize-backups`
  由多产品共用（`d1/ honestcv-kv/ probe/ recruit-pg/`），只动 `kaogong-sqlite/` 前缀。
  改 archive 布局/加新前缀时先 `rclone delete --dry-run --min-age 1s` 看清理范围。
  archive/ 内对象统一 gzip 存，真回读校验后才删原件。

## 镜像 Python 依赖钉版（backend/requirements.txt，R435）
- 两份 Dockerfile（根 `Dockerfile` 与 `deploy/Dockerfile.runtime`）只
  `pip install --no-cache-dir -r backend/requirements.txt`，清单是生产容器 `pip freeze`
  的全量 `==` 钉版（含传递依赖），单测 `tests/test_requirements_pinned.py` 锁格式与装法。
- 升级：改 `requirements.txt` → 本地 `pip install -r` + pytest 全绿 → 部署；部署后
  `docker exec deploy-kaogong-1 pip freeze | sort | diff - <(grep -v '^#' backend/requirements.txt | grep . | sort)` 应为空。
- SQLite 连接 `PRAGMA journal_size_limit=64MiB`：`-wal` 文件在 checkpoint 后不截断，
  限额只在 WAL 重置时截文件，热路径无影响。已有的大 WAL 要手工一次
  `PRAGMA wal_checkpoint(TRUNCATE)` 才会收回。

## 搜索引擎抓取日报（scripts/crawler_stats.py，R377）
- 新机 ubuntu cron `23 * * * *`：`python3 /home/ubuntu/kaogong-assistant/scripts/crawler_stats.py
  /home/ubuntu/kaogong-reports/access-archive /home/ubuntu/kaogong-reports/crawler-stats.json
  --exclude-ip-file /home/ubuntu/kaogong-reports/probe-ips.txt`。
- 产物 `crawler-stats.json` 经 `/reports` 只读挂载由 `ops_status.parse_crawler_stats` 解析，
  管理台数据看板「搜索引擎抓取」面板外显（Google/Baidu/Bing 固定置顶，从未来过标红）。
- `scripts/` 不在 `deploy_h5.sh` rsync 范围内，改动该脚本需手工
  `scp scripts/crawler_stats.py scripts/access_log_report.py` 到新机同路径；
  `deploy/cron_access_report.sh` 同理（不重建容器时也要 scp，md5 核对）。
- 候选真人口径（R382/R388/R393）：逐层剔除探针网段（`probe-ips.txt`，含 VPS 自身出口——
  **新机出口 IP 101.42.17.195 需确认已加入**）、引擎与通用 bot UA（`BOT_GENERIC` 含
  `devin/`）、test- uid、源站直连（无边缘头，单列 `humans.direct`）、显式
  `X-Kg-Probe: 1`、非正式域名 `X-Forwarded-Host`（Pages 预览域名，单列 `humans.offhost`）。
- 搜索引擎侧入口：Google Search Console 资源 `sc-domain:kaogong.zalize.com`（DNS 自动验证）；
  Bing/Yandex 走 IndexNow（R89）；百度站长平台待账号。

## LLM 模型通道（backend/app/llm.py，env 驱动，key 只在服务端 .env）

| env 组 | 用途 | 生产当前值（2026-11-14 起） |
|---|---|---|
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 主通道；**凡含图片的请求必走此通道**（识题/拍照讲解） | `api.999555999.com` / `grok-4.7`（多模态） |
| `LLM_TEXT_BASE_URL` / `LLM_TEXT_API_KEY` / `LLM_TEXT_MODEL` | 纯文本请求专用；任一留空即回落主通道对应值 | 已置空 → 与主通道相同 |
| `LLM_FALLBACK_MODEL` | 主模型 5xx 时同中继换模型重试 | compose 未透传 → 恒为代码默认 `gpt-5.5`（Grok 网关无此模型，5xx 时该次兜底必失败，属已知小冗余） |
| `LLM_RESCUE_BASE_URL` / `LLM_RESCUE_API_KEY` / `LLM_RESCUE_MODEL` | 独立备用端点：主通道 402/403/429 或持续 5xx 时纯文本回落；`chat_fast` 轻量任务**优先**走它 | 已置空 → 禁用（`_rescue_ok` 要求 base+key 同时非空，且拒绝含图请求） |

- 路由：`llm._endpoint()` 按消息是否含 `image_url` 分流；请求固定打
  `{BASE}/v1/chat/completions`（**BASE 不带 /v1 后缀**）。
- `think=False` 附加 `{"thinking":{"type":"disabled"}`（网关不识别则无副作用）；
  `chat_stream` 消费 OpenAI SSE `data:` 行，`reasoning_content`/`reasoning` 透传为
  Thinking 进度。
- 历史：2026-09-19～11-14 生产用 `api.aicdks.com`（`swe-2-max`/`swe-2-high`），
  该网关上游账号池耗尽（503 `no healthy upstream account` → 429），AI 功能全挂
  约 6 天（`explain_cache` 自 11-07 零新增、`shenlun/grade` 28×502）。
  2026-11-14 切换 `api.999555999.com` `grok-4.7`，文/图/流式实测通过；
  旧配置备份在服务器 `deploy/.env.bak-20261114`。

## API 文档开关
生产默认关闭公网 API 文档：compose 注入 `DISABLE_API_DOCS=1`（`/docs`、`/redoc`、
`/openapi.json` 返回 404）。本地开发（uvicorn 直跑，不设该变量）不受影响。
