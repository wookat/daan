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
`https://career.zalize.com/nav.js`（上岸 Zalize 统一顶栏）要求 `script-src` 包含
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
