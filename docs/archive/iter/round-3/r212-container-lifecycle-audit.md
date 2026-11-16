# R212：容器生命周期审计 + 宿主内存压力观测（ops 工具链，无生产产物变更）

## 取证（生产一手证据，均已区分 verified / inference / unknown）

### verified
- origin 24h 非共享 NAT 日志存在 6 个 502（robots/sitemap/深分页等）与多个 10–104s 慢请求（sitemap、深分页、/api/questions），来源多为爬虫/扫描器 UA。
- 宿主内存长期高压：2GB 物理内存运行 13 个容器（kaogong + recruit + softcopyright 等多项目共享），实测 mem avail 224–291MiB、swap 已用 ~2.3GB、zram 近满。
- earlyoom 已多次向 kaogong 后端 uvicorn（badness ~944，VmRSS 270–462MiB，为宿主最大进程）发送 SIGTERM 并升级 SIGKILL（journalctl -u earlyoom，08-31 13:11/14:26 等），即 08-31 部分 502/重启窗口的直接成因。
- 09-01 晚 dockerd journal 中 deploy-kaogong-1 sbJoin（容器网络加入=启动）每 10–20 分钟出现一次，48h 计 171 次；当晚实查容器 Up 11 minutes、recruit 系容器同样为分钟级新鲜启动——容器在反复重启/重建。
- `docker events --since 48h` 在该宿主上返回空（连 die/start 都查不到），历史事件查询不可用；autoheal 日志仅零星「Restarting failed」，ops 日志仅 1 次 UNHEALTHY 重启——**现有观测手段无法解释绝大多数重启**，重启归因存在系统性盲区。

### inference
- 10–104s 慢请求与 502 大概率与「宿主内存压力（swap 抖动）+ 容器重启窗口」相关，而非应用层慢查询（同名端点常态亚秒，R196 预算持续全过）。

### unknown
- 09-01 每 10–20 分钟重启的具体发起者（earlyoom 当晚无 kill 记录、autoheal/ops 无对应日志、无内核 OOM）；是否有真实用户受影响。

## 方案（最小收口：先补齐观测，不做无证据的架构改动）
1. 新增 `deploy/kaogong-lifecycle-watch.sh`：cron 每分钟轮询比对 deploy-kaogong-1 的 ContainerID/StartedAt/健康态，变化即落一行审计（UTC、旧→新状态、mem avail/swap used、近 10 分钟 earlyoom kill 数）至 `/home/ubuntu/kaogong-reports/container-events.log`。轮询兜底的原因：该宿主 docker events 历史查询不可用（verified）。
2. `deploy/kaogong-ops.sh` 每日巡检追加一行内存压力记录（mem avail / swap used / 后端 pid1 VmRSS），与 R191 磁盘水位同处一个日志，供周期回看 RSS 增长与 earlyoom 风险。
3. 明确不做：给容器加内存 limit（会把 earlyoom 换成更糟的 cgroup OOM kill）、压缩应用缓存（RSS 峰值 460MiB 的构成未 profile，无证据先不动）、动 earlyoom 配置（宿主级共享组件）。独立主机/内存扩容继续挂资源申报，本轮新增硬证据。

## 验证
- 脚本 `bash -n` 通过；VPS 实装后手跑两次：首次落 1 行基线、二次幂等 0 新行；cron `* * * * *` 已装；ubuntu 属 adm 组可读 journalctl（earlyoom 计数有效）。
- ops MEM 行内联实测输出 `MEM mem_avail=267MiB swap_used=2326MiB uvicorn_rss=16968kB`（容器 pid1 即 uvicorn，重启后基线 RSS ~17MiB，为后续增长观测提供起点）。
- 纯 ops 工具链改动，无生产产物/行为变更，不部署前端后端。

## 后续
下一次容器重启即可从 container-events.log 取到「时间 + 内存水位 + earlyoom 关联」的第一手归因证据，再决定是否需要架构级收口。
