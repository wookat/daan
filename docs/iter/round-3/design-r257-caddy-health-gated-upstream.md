# R257 设计：容器 app-boot 窗口即时 502 收口——Caddy 主动健康检查门控上游

## 取证（verified，origin 日志 + container-events 逐条对时）

- R235 的 `lb_try_duration 25s` 已消除「旧容器已停、端口无人监听」窗口的即时 502（dial 拒绝会在 25s 内重试，受控 stop 演练实测请求等待 12.4s 后 200）。
- 但 09-01 18:19–21:26 origin 日志仍有 9 条即时 502（duration 0.01–0.08s），逐条与 container-events.log 对时：**全部落在新容器 StartedAt 后 ~1s 内**（如 18:19:39 的 502 vs 新容器 18:19:38 Started）。
- 机制推断（与样本一致）：容器 Started 后 docker-proxy 立即监听宿主 8300 并接受 TCP 连接，但容器内 uvicorn 尚未就绪（app-boot 需 5–15s），连接被重置——这不是 dial 失败，`lb_try_duration` 不触发重试，Caddy 即时回 502。边缘侧 X-Kg-Fetch 证实 miss→retry 双双 502（R205 单次重试 2s 间隔 < 10–20s boot 窗口）。
- 影响面：每轮部署的 app-boot 窗口内，无边缘副本的深分页页/sitemap/robots 请求（多为爬虫）拿到 502→边缘品牌 503。

## 方案（VPS Caddy 配置，仓库仅 docs + README 运维步骤）

两个 kaogong 站点块的 `reverse_proxy` 增加主动健康检查，让 app-boot 窗口内上游被标记 unhealthy，请求进入既有 `lb_try_duration 25s` 等待循环，待 `/api/health` 通过后放行：

```caddyfile
reverse_proxy 127.0.0.1:8300 {
    lb_try_duration 25s
    lb_try_interval 1s
    health_uri /api/health
    health_interval 2s
    health_timeout 10s
}
```

- `health_timeout 10s`（而非默认 5s）：共享宿主争用窗口实测静态/health 亦可慢至 14s 级，过紧的超时会把「慢但活着」误判为 unhealthy 反而放大故障——取 10s 平衡 boot 窗口检出速度与争用窗口误伤风险，且 `/api/health` 常态亚秒（docker healthcheck 同端点）。
- app-boot 的连接重置对健康检查是确定性失败，2s 间隔可在窗口开始后 ≤2s 标记 unhealthy。
- 与 R235 同手法：备份 Caddyfile → `caddy validate` → reload；回滚 = 恢复备份 reload。

## 验收

1. `caddy validate` 通过、reload 后既有流量 200。
2. 演练：`docker restart deploy-kaogong-1` 期间并发 curl /tiku/、/robots.txt——期望请求等待数秒后 200，不再出现即时 502。
3. 回归：部署窗口外全端点 200、admin 端点行为不变。

## 明确不做

- 不改 docker userland-proxy 全局配置（共享宿主多产品风险）。
- 不动边缘 R205 重试/R218 品牌 503 语义（保底层不变）。
- 不引入被动健康检查 fail_duration（单上游下无路由意义，且争用窗口误伤风险高）。
