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
- **回滚**：把 `kaogong.zalize.com` DNS 改回 `A 150.109.230.174 dns-only` 即恢复纯服务器架构。
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

## 微信小程序上线额外要求
- 小程序 request/uploadFile 合法域名需在微信后台配置为 `https://kaogong.zalize.com`
- 构建时设置 `VITE_API_BASE=https://kaogong.zalize.com` 后 `npm run build:mp-weixin`

## 数据
SQLite 存于 docker volume `kaogong-data`（/data/data.db）。备份：`docker compose cp kaogong:/data/data.db ./backup.db`

## 生产运营脚本（deploy/kaogong-ops.sh）
- 部署位置：VPS `/home/ubuntu/kaogong-ops.sh`，cron `40 3 * * *`。
- 每日 SQLite `.backup` → 本地 `~/kaogong-backups`（gz，保留 7 份）→ rclone 上传
  `r2:zalize-backups/kaogong-sqlite/`（保留 30 天，远端字节数校验）→ 健康巡检
  （`/api/questions?limit=1` 非 200 时 `docker compose up -d` 自愈）。
- R2 凭证：VPS `/home/ubuntu/.env`（`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT`，不入库）。

## 搜索引擎抓取日报（scripts/crawler_stats.py，R377）
- VPS cron `23 * * * *`：`python3 /home/ubuntu/kaogong-assistant/scripts/crawler_stats.py
  /home/ubuntu/kaogong-reports/access-archive /home/ubuntu/kaogong-reports/crawler-stats.json
  --exclude-ip-file /home/ubuntu/kaogong-reports/probe-ips.txt`（读小时级归档，探针网段剔除，
  含 `140.232.64.0/24`——开发会话伪装 Googlebot UA 的 SSR 自测不能算引擎来过）。
- 产物 `crawler-stats.json` 经 `/reports` 只读挂载由 `ops_status.parse_crawler_stats` 解析，
  管理台数据看板「搜索引擎抓取」面板外显（Google/Baidu/Bing 固定置顶，从未来过标红）。
- `scripts/` 不在 `deploy_h5.sh` rsync 范围内，改动该脚本需手工 `scp scripts/crawler_stats.py
  scripts/access_log_report.py` 到 VPS 同路径。
- 候选真人口径（R382/R388/R393）：逐层剔除探针网段（`probe-ips.txt`，含 VPS 自身出口）、引擎与通用
  bot UA（`BOT_GENERIC` 含 `devin/`，与后端 `PROBE_UA_MARKERS` 单测锁同步）、test- uid、源站直连（无边缘头，
  单列 `humans.direct`）、显式 `X-Kg-Probe: 1`、非正式域名 `X-Forwarded-Host`（Pages 预览域名，单列
  `humans.offhost`；`--site-host` 可覆盖默认 `kaogong.zalize.com`）。
- 搜索引擎侧入口：Google Search Console 资源 `sc-domain:kaogong.zalize.com`（DNS 自动验证，
  2026-09-04 建立并提交 sitemap.xml）；Bing/Yandex 走 IndexNow（R89）；百度站长平台待账号。

## API 文档开关
生产默认关闭公网 API 文档：compose 注入 `DISABLE_API_DOCS=1`（`/docs`、`/redoc`、
`/openapi.json` 返回 404）。本地开发（uvicorn 直跑，不设该变量）不受影响。
