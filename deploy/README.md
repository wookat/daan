# 部署说明

## 方案：现有服务器 + Caddy/Nginx 反代 + kaogong.zalize.com

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
