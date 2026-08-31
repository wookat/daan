# R84：origin 假死自愈 watchdog（healthcheck + autoheal）

## 背景与取证（已验证事实）

共享 2GB 宿主的内存-IO 颠簸会把 kaogong origin 打成「进程在、请求全挂」的假死态，且已复发多次，每次都靠人工发现 + 人工 `docker restart` 恢复：

- R64（PR #240）：/api/checkin/summary 冷路径 125s→CF 524，宿主 load 12.3、recruit-postgres 154% CPU；
- R81（PR #257）：/api/questions 反复 125s/524 直至 origin 全挂，docker restart 恢复（该轮同时修了抽题池惊群，但宿主级颠簸仍在）；
- R83（PR #259）验证期实录：全端点 524/125s+，uvicorn 主进程 State D（disk sleep），宿主 swap ~3GB、vmstat si/so 数千、blocked 9–15，recruit-worker-heavy 常驻 99% CPU；`docker restart deploy-kaogong-1` 后 daily_set 2.0s 恢复。

无人值守时（夜间/无会话），一次假死意味着全站不可用直到下次人工介入。主机资源隔离根治（迁独立主机/限 recruit 资源）超出本仓权限、待老板决策（R64 起挂账）——本轮做仓内可落地的自愈兜底。

## 架构决策

用 Docker 原生 healthcheck + 成熟开源 [willfarrell/autoheal](https://github.com/willfarrell/docker-autoheal)（监听 docker.sock、重启 unhealthy 容器），不自造轮子、不加宿主 cron（宿主非本仓管理面）。

1. **后端新增 `GET /api/health`**：`SELECT 1` 走完整链路（uvicorn 事件循环→线程池→SQLite 读），能区分「进程活着但请求全挂」的假死态；不进边缘缓存清单，healthcheck 从容器内 127.0.0.1 直连不经 CF。
2. **compose healthcheck**：interval 60s / timeout 25s / retries 5 / start_period 180s——需连续 ≥5 分钟无法在 25s 内完成一次 SELECT 1 才判 unhealthy，远超正常长尾（R63 实测热路径 0.3s、冷路径个位秒），避免瞬时尖峰误杀；而真实假死事故均持续 30min+。
3. **autoheal sidecar**：`AUTOHEAL_CONTAINER_LABEL=autoheal` 只管理带标签的 kaogong 容器，30s 轮询，stop timeout 30s。镜像常驻内存占用极小（~MB 级），对 2GB 宿主无感。

## 风险与边界

- docker.sock 挂载等价 root：autoheal 为单一用途成熟镜像、仅本机 sock、不暴露端口，风险可接受；
- 若宿主颠簸到 docker daemon 本身无响应，autoheal 也无法自愈（此时任何仓内手段均无效，仍需主机级根治）；
- 重启会清进程内缓存（抽题池/预热），R81 已改为冷 miss 单线程构建，重启后首请求秒级恢复。

## 验收标准

1. 部署后 `docker inspect` kaogong 显示 healthcheck 配置生效、状态 healthy；autoheal 容器 Up；
2. `GET /api/health` 生产返回 `{"ok":true}`；
3. 故障演练：容器内使 health 探针失败（如临时挡住端口/暂停应用）持续 >5 分钟 → 容器被 autoheal 自动重启并恢复 healthy，全程无人工介入；
4. 正常流量下观察无误杀重启。

## 非目标

- 不解决宿主资源隔离（挂账待决策）；
- 不做多副本/负载均衡；
- 不引入外部监控 SaaS（MONITOR_URL 既有通道不动）。
