# R458：autoheal 路径重启形态（30 s 超时被吃满→SIGKILL 137）+ 近 14 天 22 次对 kaogong 动手全在 09-04 05:56Z 前 + compose 路径 2 次 10 s 强杀 + 09-05 宿主盘满 53 s + R457 勘误（只取证登记，不改码不部署）

- 生产应用仍 `460120f`；取证 2026-09-06 21:20Z–2026-09-07 01:30Z，全部只读：`docker logs deploy-autoheal-1`、`docker inspect`、`journalctl -u docker`、`/home/ubuntu/kaogong-reports/container-events.log`（60 s 轮询的容器状态变更日志）、`deploy-history.log`、caddy origin access log、容器内 `mode=ro` SQLite。
- 结论一句话：autoheal 近 14 天对 `deploy-kaogong-1` **动过 22 次手**（08-31 4 / 09-02 2 / 09-03 10 / 09-04 6），全部集中在 R372/R373 之前的假死期，**09-04 05:56:49Z 之后 0 次**；它的重启形态是 `docker restart t=30` **原地重启**（容器 ID 不变、`StartedAt` 变、`RestartCount` **不加**），至少 2 次一手观测到 **exit 137 = 30 s 超时被吃满后 SIGKILL**——与 R457 compose 路径健康态 0.58 s 优雅退出形成对照；顺带发现 compose 路径在 09-06 也有 **2 次**触发「10 s 内未退出 → 强杀」（00:35Z / 08:53Z 两次部署，源站不可达窗口 31–37 s 而非 5.5 s），其中 00:35 那次正是 R457 表 3 误归「非部署窗口」的 25.9 s `/api/health` 503（**勘误**）；另发现 **09-05 14:44:19–14:45:12Z 宿主盘曾真满 53 s**（journal 12,542 条 `No space left on device`，caddy 写不进 kaogong origin 日志、rsyslog 写不进 syslog），kaogong 该窗口无 DB 写入、`quick_check ok`，肇因按同秒 journal 归兄弟产品 recruit-app 重建（推断）。全部登记不改码。

## 1. autoheal 路径重启形态（一手）

| 项 | 值 | 来源 |
|---|---|---|
| sidecar | `willfarrell/autoheal:latest`（digest `e17705ca…`），`AUTOHEAL_CONTAINER_LABEL=autoheal / INTERVAL=30 / DEFAULT_STOP_TIMEOUT=30 / START_PERIOD=0 / ONLY_MONITOR_RUNNING=false` | `docker logs` 启动回显 + compose |
| 动作日志形态 | `Container /deploy-kaogong-1 (<id12>) found to be unhealthy - Restarting container now with 30s timeout` | `docker logs deploy-autoheal-1` |
| 近 14 天对 kaogong 动手 | **22 次**：08-31 ×4、09-02 ×2、09-03 ×10（03:04:49 / 03:31:12 / 03:47:19 / 06:56:16 …）、09-04 ×6（01:35:57 / 01:37:00 / 01:46:52 / 01:57:25 / 05:36:54 / 05:56:49） | 同上（174 行中 22 行含 kaogong） |
| 09-04 05:56:49Z 之后 | **0 次**（`docker logs --since 2026-09-04T06:00Z | grep -c kaogong` = 0，到 09-06 21:15Z 共 2.6 天） | 同上 |
| 重启形态 | 同一容器 ID `StartedAt` 变化、`RestartCount` 保持 0（例：`4efd5937…` 02:40:35 → 03:05:31 → 03:31:54，rc 恒 0；`56d67abc…` 01:19:21 → 01:37:25 → 01:47:38 → 01:58:05，rc 恒 0） | `container-events.log` |
| 30 s 超时是否吃满 | autoheal 03:47:19.9 发出 → 03:48:26 观测到 `exited unhealthy **137**` → 03:48:28.0 新 `StartedAt`（68 s）；01:57:25.7 发出 → 01:58:04 观测 `exited unhealthy 137` → 01:58:05.3 新 `StartedAt`（40 s）。137 = SIGKILL → uvicorn 在 unhealthy 态 30 s 内**没有**退出，autoheal 的 30 s 超时被吃满后强杀 | `container-events.log` + autoheal 日志相减 |
| 其余 20 次 | 发出→新 `StartedAt` 间隔 40–88 s（42 / 42 / 55 / 88 / 46 / 40 …），与「30 s 等待 + SIGKILL + 起容器」形态一致，但 60 s 轮询没抓到 exited 瞬间，退出码**未观测**（不下断言） | 同上 |

- `RestartCount=0` **不能**当「没被 autoheal 重启过」的证据：`docker restart` 不计入 RestartCount（只有 restart policy 自动拉起才加）。历轮 SOP-04「healthy 0 重启」应读作「未被 restart policy 拉起」，autoheal 动手要看 autoheal 日志 / `container-events.log` 的 `StartedAt` 变化。
- 与 compose 路径对照（R457）：健康态 SIGTERM → 0.58 s 退出；autoheal 只在 unhealthy 态动手（5 次 healthcheck 25 s 超时 = 进程已经被换出/假死，R372 已定性），此时 SIGTERM 无人响应 → 必然等满 30 s 强杀。形态差异是**状态**差异不是**路径**差异；30 s 与 10 s 的取值在假死态下都只是「多等多久再杀」，不改。
- 09-04 05:56Z 后清零与 R372（#582，内存驻留加固）/ R373（#584）上线时间一致（deploy-history 09-03 12:17–16:42Z 连续发版），是**旁证**不是因果证明（同期宿主 swap 仍 2.3–2.9 GB）。

## 2. compose 路径也有 10 s 强杀：09-06 两次部署（一手，R457 未见）

journal `Container failed to exit within 10s of signal 15 - using the force` ~~14 天~~共 12 条（**R459 勘误**：journal 只从 09-05 14:43:34Z 盘满那一秒起有档，实为 **1.6 天**；14 天完整历史在 rsyslog `/var/log/syslog*`，kaogong 10 s 强杀 08-30–09-07 CST 逐日 45/63/57/8/10/11/1/2/0，见 r459 文档 §4），逐 ID 对 `container-events.log`：**2 条是 kaogong**（其余 10 条 0 命中，属兄弟产品），都发生在部署 Recreate：

| 部署 | dockerd 停止请求 | task-delete | 强杀日志 | 新容器 StartedAt | 不可达窗口 | 宿主 |
|---|---|---|---|---|---|---|
| 09-06 00:35Z（rev `bf23e59`） | 00:35:17.52 | 00:35:19.90 | 00:35:27.82 | 00:35:54.55 | **≈37 s** | mem_avail 341 MiB / swap 2576 MiB |
| 09-06 08:53Z（rev `1085031`） | 08:53:13.25 | 08:53:15.07 | 08:53:23.44 | 08:53:44.82 | **≈32 s** | mem_avail 369 MiB / swap 2958 MiB |

- 两次都是「task-delete 已到（+2.4 s）却仍在 +10 s 打出强杀」——dockerd 等待退出的路径没有被 containerd 的 task-delete 事件唤醒，随后新容器建/起又花 20–27 s（R450 健康态 3.1 s）。**机理未解**（不排除是 dockerd 自身在 swap 压力下的调度延迟），登记不下断言。
- 窗口内 origin 流量：00:35 窗口只有部署脚本自己的轮询 `/api/health`（curl）—— 00:35:24.0 发出、**25.94 s 后 503**（00:35:49.97，Caddy 等上游超时）、随后 00:36:02 200（11.1 s，新容器预热中）；08:53 窗口 **0 请求**（首个请求 08:54:00.8 200，真人 Android uid 08:54:21 起全 200）。→ **仍无用户可见 5xx**。
- **R457 勘误**：R457 表 3 把 `09-06 00:35:49 /api/health 503 25.9 s` 归为「共宿负载抖动、非部署窗口」是错的——当时 `/tmp/kg-compose-*.log` 命名从 13:47Z 起才有，R457 用「无 compose log」推「非部署」不成立；`deploy-history.log 00:36:14Z rev=bf23e59` + `container-events.log` 证明它就在部署 Recreate 窗口里、且是本轮才看见的 10 s 强杀那次。R457 文档已加勘误指针；「12 次部署无 5xx 落窗」改为「有 compose log 的 12 次无；全天 14 次里 00:35 那次落了 1 条（部署探针自身）」。handoff 早前登记的「00:35 共宿负载 10 秒 503 抖动」同此勘误。

## 3. 09-05 14:44Z 宿主盘满 53 s（一手，跨产品）

- journal 全单元 `no space left` **12,542 行**，首行 14:44:19Z（rsyslog 写 `/var/log/syslog` 失败），末行 14:45:12Z（caddy 写 `/var/log/caddy/kaogong-origin.zalize.com-access.log` 失败）→ 满盘持续 **≈53 s**。
- 同秒 journal：容器 `a987b2dbc0fb…` 从 14:44:19 起 crash-loop（exit 1/3，restartCount 19→23，`restartPolicy unless-stopped`）、`sbJoin … ep=recruit-app net=recruit_app_default`；14:43:34–14:44:11 有 4 个 Devin 出口（`140.232.64.2/.4`）SSH 会话断开/连入 → **推断**是兄弟会话对 recruit 的构建/备份把盘写满又很快释放；`a987b2dbc0fb` 在 `container-events.log`（kaogong 专属）0 命中、当前已不存在，**不是 kaogong 容器**。
- kaogong 影响：该窗口 origin 日志**盲区**（caddy 写不进去，不是没流量）；DB 只读核 14:30–15:00Z `answer_log` / `growth_events` **0 行写入**（周六 22:44 CST，探针也没在跑）、`pragma quick_check = ok`；SQLite 若在满盘时写会 `SQLITE_FULL` 报 500 → 本次没发生。kaogong 自己的日志有 `roll_size 50MiB / roll_keep 14`（09-05 18:44Z 刚滚过一次），`/var/log/caddy` 共 174 MB，不是肇因。
- 现状：`df /` **90% / 4.8 G**（`kaogong-ops.log` 09-07 03:40 CST 曾报 **94%**），`/var/lib/docker` 12 G。R454 起报的「按此速率不到一周进 95%」已经以「瞬时 100%」形态兑现过一次；再满一次若恰逢作答写入 = 用户可见 500 + 日志盲区。仓库内无可动项（kaogong 备份/日志都已限量，R433/R434），**扩盘或迁出 recruit·softcopyright 仍待老板定**。

## 4. 到期项（09-07 01:2xZ 实查）

probe=0 22/1（`WHERE probe=0` 严格口径；`COALESCE(probe,0)=0` 会把 R374 前 1001 行 NULL 历史算进去成 1023/57，到期项一律用严格口径）、error_reason 6 且关联 `probe=0` uid 为 0（最新一条 09-03）、push_subs 0、weekly_reports 1、growth probe=0 18/4、next_review 29/29 CST 00:00、WAL 3,164,192 B（同字节，R455 口径 768 帧未到 1000）、healthy rc=0 `StartedAt 19:41:43Z` 未变、autoheal `Up 8 h (healthy)` rc=25（sidecar 自身在 09-05 22:44 盘满段与 09-06 12:45Z 各有 containerd 层报错重启，对 kaogong 无动作）。无前端发版 (c) 无新窗口。

## 5. 处置：全部登记，不改码不部署

- 不改 `AUTOHEAL_DEFAULT_STOP_TIMEOUT` / 不加 `stop_grace_period`：两条路径的强杀都只出现在进程假死或宿主 swap 压力下，超时取值只决定「多等多久」，不影响结果；R372 后 autoheal 2.6 天 0 动作。
- 不在部署脚本里加「swap 压力预检」：09-06 两次强杀窗口 31–37 s 内无真人请求（部署都在探针窗口），且 `deploy_h5.sh` 已有 600 s 收敛轮询 + 健康校验；加预检会让部署在共宿高压期永远排不上。
- SKILL 增补：`RestartCount=0 ≠ 未被 autoheal 重启`；部署窗口归因必须用 `deploy-history.log` + `container-events.log`，不能只看 `/tmp/kg-compose-*.log`（13:47Z 09-06 之前没有）；origin 日志「空窗」先查 journal `no space left`/caddy write error 再下「无流量」结论。
- 升级给老板的决定项不变：宿主盘扩容 / 迁出 recruit·softcopyright。

## 6. 如实说明

- ~~22 次里只有 2 次一手看到 exit 137，其余 20 次退出码没抓到（60 s 轮询），「都被 SIGKILL」是按 40–88 s 间隔的推断。~~ **R459 已坐实**：syslog 里 dockerd `failed to exit within 30s of signal 15 - using the force` 21 条逐 ID 对上 22 次里的 21 次（第 22 次 09-04 01:37:00Z 落在上一次重启未完成的 90 s 内、无独立停止）。
- ~~137 也可能来自 earlyoom（同样 SIGKILL）：两次 137 前 1–2 min 都有 autoheal 发出记录、`oom=false`，归 autoheal 是时序推断，未核 earlyoom 日志。~~ **R459 已排除**：earlyoom 08-30 起全部动作只在 08-31 05:07–06:27Z（其中 06:27:06Z SIGKILL 击杀过一次 kaogong），09-01 起 0 行；两次 137 同秒 dockerd 30 s 强杀行直接对上 autoheal 发出时刻。
- 「task-delete 已到仍等满 10 s」~~机理未解~~ **R459**：与 dockerd↔containerd 会话 `healthcheck failed fatally` 强相关（09-06/07 10/19 前 12 s 内有 fatal，基率 ≈1%），30 s 路径上同款且再多一次 `within 10s of kill - trying direct SIGKILL`；08:53Z 一例无 fatal 行，未完全解释，dockerd 源码未翻。
- 盘满肇因归 recruit-app/兄弟会话是同秒 journal 的推断，未查那 53 s 内具体哪个文件在增长（当时没有 `du` 采样）。
- 09-04 后 autoheal 清零归 R372/R373 是时间相关，不是受控对照。
