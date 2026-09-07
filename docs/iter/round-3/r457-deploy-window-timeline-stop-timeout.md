# R457：部署重建窗口一手时序（停旧→新 listening 5.5 s，SIGTERM 0.58 s 退出、未触发 10 s SIGKILL）+ 到期项（只取证登记，不改码不部署）

- 生产应用仍 `460120f`；取证 2026-09-06 21:10–21:30Z，对象 = R450 部署（compose log `kg-compose-460120f-20260906T193915Z.log`）。
- 结论一句话：`docker compose up -d --build` 的 Recreate 阶段，旧容器收 SIGTERM 后 **0.58 s** 退出（远小于 compose 默认 10 s stop timeout，`stop_grace_period` 未配即默认），新容器 3.05 s 后启动、再 1.88 s uvicorn listening，源站不可达窗口 **≈5.5 s**；该窗口内 origin **0 个请求**落入，所以本次部署 0 个 5xx——「无 5xx」是流量恰好没打进窗口，不是窗口为零。登记不改。

## 1. 时序（dockerd journal + 容器日志 + compose log，均一手）

| 时刻（UTC） | 事件 | 来源 |
|---|---|---|
| 19:41:40.13 | dockerd `stopping restart-manager` container=dc15459b（旧容器，停止请求发出） | `journalctl -u docker` |
| 19:41:40.72 | dockerd `received task-delete event from containerd`（旧进程已退出）→ **停机耗时 0.58 s** | 同上 |
| 19:41:40.04 / 19:41:43.77 | 新容器 Created / StartedAt | `docker inspect` |
| 19:41:44 | compose `KG_COMPOSE_EXIT rc=0` | compose log |
| 19:41:45.65 | `Started server process [1]` → `Application startup complete` → `Uvicorn running`（同一毫秒内，无 lifespan 阻塞） | `docker logs --timestamps` |
| 19:41:45.89 | 首个容器内 `/api/health` 200（healthcheck） | 同上 |

- 源站不可达窗口 = 19:41:40.1 → 19:41:45.7 ≈ **5.5 s**（其中 SIGTERM→退出 0.6 s、docker 建/起容器 3.1 s、Python 进程到 listening 1.9 s）。
- origin access log 该窗口两侧最近请求：19:41:34.6 `/api/health` 200（部署轮询）与 19:41:47.7 `/api/health` 200 → 窗口内 **0 请求**；19:38–19:46Z 共 143 请求 200/304，0 个 ≥500、0 个 duration >5 s。
- 同秒 dockerd 一条 `healthcheck failed … only one connection allowed timeout=15s` 是 dockerd↔containerd 的 gRPC 健康探测告警（19:41:42.77，正好在旧任务删除后/新任务建立前），不是 kaogong 应用 healthcheck（推断：字段是 dockerd 内部 transport 错误，容器 health 状态全程 healthy）。

## 2. 10 s stop timeout 与 130 s keep-alive

- `Dockerfile.runtime` CMD 是 exec 形式 → SIGTERM 直达 uvicorn（PID 1）；R456 本地复现 + 本轮生产 0.58 s 都表明 uvicorn 收 SIGTERM 后立即关闭空闲 keep-alive 连接、只等在飞请求。`--timeout-keep-alive 130` 是**空闲**连接保活，与停机等待无关。
- 未验证的边界（登记）：若停机瞬间有在飞的长 SSE（`/api/explain/stream` 单次可 30–60 s），uvicorn 会等它到 10 s 被 SIGKILL，客户端看到流中断；7 天 origin 无此形态样本（部署都在探针窗口内做），不为此加 `stop_grace_period`。
- 若要把 5.5 s 窗口压到 0 需要双容器切换或 Caddy 侧 `lb_try_duration` 重试（Caddy 对 connection refused 默认不重试），改动面在宿主 Caddyfile / compose 拓扑，当前无真人流量、部署都在探针窗口 → **P4 登记**。

## 3. 7 天 origin ≥500 全部归因

| 时刻 | 状态 | 路径 | 归因 |
|---|---|---|---|
| 09-06 00:11:17 / 08:55:24 / 08:55:26 | 503 | `/api/auth/wxlogin` | `WX_MINIAPP_SECRET` 未配（R425 起已知） |
| 09-06 00:35:49 | 503（25.9 s） | `/api/health` | ~~handoff 已登记的「00:35 共宿负载 10 秒 503 抖动」同一事件，无 compose log（非部署窗口）~~ **R458 勘误**：`deploy-history.log 00:36:14Z rev=bf23e59` + `container-events.log` 证明它在 00:35Z 部署 Recreate 窗口内（旧容器 10 s 未退出被强杀、新容器 37 s 后才起），请求是部署脚本自身的轮询；`/tmp/kg-compose-*.log` 在 13:47Z 前不存在，「无 compose log」推不出「非部署」。见 r458 文档 §2 |

→ ~~7 天内**没有任何一条 5xx 落在部署窗口**（12 次部署 15:02–19:39Z 全部如此）。~~ **R458 勘误**：有 compose log 的 12 次无 5xx 落窗；全天 14 次部署里 00:35Z 那次落了 1 条（部署探针自身的 `/api/health` 503），无用户可见 5xx。

## 4. 到期项（21:26Z 实查）

probe=0 22/1、error_reason 6、push_subs 0、weekly_reports 1、growth probe=0 18/4、WAL 3,164,192 B（同字节）、healthy rc=0。无前端发版 (c) 无新窗口。

## 5. 如实说明

- 「0.58 s = SIGTERM 到退出」按 dockerd 两条日志相减；旧容器自身的 `Shutting down` 行随容器销毁不可得（`app_log_snapshot.sh` 在停机前归档）。
- 12 次部署只对 R450 一次拉了逐秒时序，「全部无 5xx」是 7 天 origin 5xx 反查（4 条都不在任何 compose log 时间段）。
- Caddy 对 connection refused 不重试是按其 reverse_proxy 默认 `lb_try_duration=0` 的既有知识，未翻源码、未在本站实测。
- dockerd `only one connection allowed` 归 dockerd 内部是推断。
