# R235：部署容器重建窗口 origin 502 收口（Caddy lb_try_duration 等待重连）

## 取证（verified）

- 今日每轮部署（rev a3f4b1a 21:05、d5c80ac 21:24 等）容器 Recreate 窗口内，origin 日志均出现无副本深页 502：如 21:04:32 `/tiku/yanyu/?page=193` X-Kg-Fetch=miss 502 → 21:04:34 retry 502（爬虫最终收边缘品牌 503）；21:26:37 `/api/track` pass 502（真实 Android 用户，13.2s）。
- 失败形态为 dial 拒绝（容器端口未发布，duration 0.01–0.08s 即 502）——正是 Caddy `lb_try_duration` 设计覆盖的场景：连接失败时在窗口内按间隔重试拨号，后端起来即转发，不向客户端漏 502。
- 同机 Caddyfile 中 jobs.zalize.com 已用 `lb_try_duration 20s / lb_try_interval 500ms`（成熟先例）；kaogong 两个站点块（kaogong.zalize.com 与 kaogong-origin.zalize.com → 127.0.0.1:8300）均为裸 `reverse_proxy`，无重试。

## 推断（inference）

- Caddy 对「请求尚未发出（拨号失败）」的重试对 POST 也安全（请求体未发送不会重复副作用）；容器 Started 后 uvicorn 数秒内可服务，25s 窗口足够覆盖实测 10–20s 重建期。

## 方案（最小、可逆、零代码）

VPS `/etc/caddy/Caddyfile` 两个 kaogong 块的 `reverse_proxy 127.0.0.1:8300` 增加：

```caddy
reverse_proxy 127.0.0.1:8300 {
    lb_try_duration 25s
    lb_try_interval 1s
}
```

`caddy validate` 通过后 reload；仓库侧仅落文档（Caddyfile 为多产品共享服务器配置，不在本仓库管理，与 R85/R86 同口径）。

## 明确不做

- 不做双容器蓝绿/零停机部署（2GB 高压宿主不加常驻负载）；不动边缘 R205 重试 / R218 品牌 503 兜底语义（lb 重试失败后仍走该链路）；不动其他产品站点块。

## 验证

- 受控演练：`docker stop` 后延迟 8s `docker compose up -d`，停机窗口内请求未缓存深页与 /api/health——预期不再即时 502，而是等待至容器起后返回 200。
- 部署（本轮无产物变更不跑 deploy_h5）；生产 1440/375 双视口回归照常。
