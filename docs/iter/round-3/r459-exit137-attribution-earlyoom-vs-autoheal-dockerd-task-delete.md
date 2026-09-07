# R459 取证：09-03/09-04 两次 exit 137 归属（earlyoom vs autoheal）+「task-delete 已到仍等满超时」dockerd 相邻行 + R458 勘误（只取证不改码不部署）

- 生产应用仍 `460120f`；取证 2026-09-07 01:30Z–05:35Z，全部只读：`/var/log/syslog{,.1,.2-4.gz}`（rsyslog，08-30 起完整、gz 追溯到 08-09）、`journalctl`（**只剩 09-05 14:43:34Z 起**，见 §4 勘误）、`docker logs deploy-autoheal-1`、`docker inspect`、`systemctl show earlyoom`、`crontab -l`、`deploy-history.log`、`container-events.log`、容器内 `mode=ro` SQLite。
- 结论一句话：R458 悬着的两条推断都**坐实**——① 09-03 03:47Z / 09-04 01:57Z 两次 `exit 137` **不是 earlyoom**（08-30 起 earlyoom 全部动作只落在 08-31 05:07–06:27Z，09-01 起 0 行；内核 OOM 0 行），dockerd 同秒行 `Container failed to exit within 30s of signal 15 - using the force` 直接对上 autoheal 发出时刻 → **autoheal 30 s 超时吃满后 SIGKILL**；且不止 2 次：autoheal 22 次动手里 **21 次**在 dockerd 有 30 s 强杀行（容器 ID 精确匹配，宿主 14 天 30 s 强杀 21/21 全是 kaogong），第 22 次（09-04 01:37:00Z）落在上一次重启尚未完成的 90 s 内、无独立停止。② 「task-delete 已到仍等满超时」在 30 s 路径上同样出现，并伴随 `failed to exit within 10s of kill - trying direct SIGKILL`（连 SIGKILL 都再等 10 s）；09-06 00:35Z 那次 stop 后 0.8 s / 5.8 s dockerd↔containerd 会话两次 `healthcheck failed (fatally)`，09-06/07 全宿主 19 条 10 s 强杀里 10 条前 12 s 内有 fatal 行（3 天 202 条 fatal、基率 ≈1/16 min，12 s 窗口随机命中 ≈1%）→ **强相关**，推断是 dockerd 丢/迟处理 containerd 退出通知、等满超时后对已退出 task「补一刀」，无害但把不可达窗口拉长 8–30 s；08:53Z 那次窗口内无 fatal 行，机理**未完全解释**。③ 顺带一手：earlyoom 08-31 06:27:06Z 曾 SIGKILL 击杀 kaogong（`uvicorn` RSS 709 MiB，前 12 次 SIGTERM 全部 `kill failed: Timer expired`），restart policy 43 s 后拉起——这是 14 天里唯一一次 earlyoom 动到 kaogong；R372 前 kaogong 停机吃满 10 s 的比例 45–63 次/天，R372/R373（09-03）后掉到 8–11/天 → 1–2/天 → 09-07 0（部署量 27–81 次/天不减）。全部登记不改码。

## 1. 两次 137 的归属（一手，ID 精确匹配）

| 137 事件（R458） | autoheal 发出（UTC） | dockerd 相邻行（syslog，CST=UTC+8） | 归属 |
|---|---|---|---|
| 09-03 03:47:19Z `dea4dbd7387a` | 03:47:19.9 | `11:47:20 stopping restart-manager` → **`11:47:51 failed to exit within 30s of signal 15 - using the force`** → `11:47:54 received task-delete` → **`11:48:02 failed to exit within 10s of kill - trying direct SIGKILL`** → 新 StartedAt 03:48:28Z | autoheal 30 s 吃满 → SIGKILL 再等 10 s → 直接 SIGKILL |
| 09-04 01:57:25Z `56d67abc2b9a` | 01:57:25.7 | `09:57:27 stopping restart-manager` → **`09:57:58 failed to exit within 30s`** → `09:57:59 task-delete` → `09:58:06 connecting to shim`（同 ID 原地重启） | autoheal 30 s 吃满 → SIGKILL |

- earlyoom 排除：`zgrep earlyoom /var/log/syslog*`（08-30 00:00 CST 起完整）共 33 行动作，**全部在 08-31 13:07–14:27 CST**（05:07–06:27Z），09-01 起 0 行；`zgrep -iE "out of memory|oom-kill|Killed process" /var/log/kern.log*` 0 行；两容器 `oom=false`（R458）。`journalctl -u earlyoom` 为空是因为 journal 已无 09-05 前档（§4），不是 earlyoom 没动。
- 22 次 autoheal ↔ 21 条 30 s 强杀逐 ID 多重集：ccd0 1/1、bf22 3/3、2810 1/1、da5f 1/1、de5d 1/1、bbb4 5/5、4efd 2/2、dea4 1/1、0cb8 1/1、**56d6 4/3**、ebaf 1/1、fe4b 1/1。56d6 缺的那次 = 09-04 01:37:00Z：上一次 01:35:57Z 发出 → 01:36:31 30 s 强杀 → 01:36:34 task-delete → 01:36:42 `trying direct SIGKILL` → **01:37:27** shim 才重连；autoheal 30 s 巡检在 01:37:00 又看到 unhealthy 再发一次 `docker restart`，此时容器正在重启中、dockerd 没有再走一次 stop。→ R458「其余 20 次退出码未观测、SIGKILL 是推断」**升级为一手**：21/22 都是 30 s 吃满强杀。
- 宿主 14 天 `within 30s` 强杀共 21 条、**全部**是 kaogong 容器（30 s 只有 autoheal 会用，autoheal 标签容器也只有 `deploy-kaogong-1`）→ 「30 s 强杀」= autoheal 动作的 dockerd 侧唯一签名，以后可直接 `grep "within 30s"` 计数。

## 2. earlyoom 14 天全部动作 = 08-31 一天两段，唯一一次击杀 kaogong（一手）

| CST | earlyoom | dockerd/containerd（同 ID） |
|---|---|---|
| 13:07:59–13:09:25 | `sending SIGTERM to process 1075533 uid 0 "uvicorn": badness 973, VmRSS 709 MiB` ×6，每次 10 s 后 `kill failed: Timer expired` | —（容器 `9ddf5576f440` 11:55 起） |
| 13:10:50–13:11:42 | 同 PID 再 ×6 SIGTERM 失败（RSS 461–483 MiB） | `13:11:42 stopping restart-manager 9ddf` → `13:11:52 failed to exit within 10s` → `13:11:55 connecting to shim 9ddf`（同 ID **10 s** 原地重启：不是 autoheal（30 s）、不是 Recreate（ID 不变）→ 当时操作者的手工 `docker restart`，**推断**） |
| 13:26:19 | — | `9ddf` 再次 10 s 强杀 → 13:26:40 新容器 → 13:43:45 `3e9744d246ac` 起（部署 Recreate） |
| 14:26:14–14:27:05 | `sending SIGTERM to process 1164813 "uvicorn"` ×6 失败 | — |
| **14:27:06** | **`escalating to SIGKILL after 1.5 seconds` → `process exited after 1.6 seconds`** | `14:27:10 shim disconnected 3e97 / task-delete` → `14:27:40 failed to delete container from containerd` → **`14:27:49 restarting container`**（restart policy）→ 14:27:55 sbJoin |
| 15:32:49 | — | `ccd0053cd7be` `failed to exit within **30s**`（= autoheal 07:32:49Z 第 1 次） |

- earlyoom 配置 `EARLYOOM_ARGS="-r 3600"`（默认阈值 mem 10% / swap 10%，SIGTERM 后 ≥1.5 s 未退再 SIGKILL 的行为是 earlyoom 既有逻辑，未翻源码）。12 次 SIGTERM 被无视、只有 SIGKILL 才生效——与 autoheal/compose 路径「假死态 SIGTERM 无人应答」是**同一个现象的第三个观察点**，全部在 R372 前。
- 08-31 06:27Z 这次是 14 天里 earlyoom **唯一**动到 kaogong 的记录；SIGKILL 后 restart policy（`unless-stopped`）43 s 拉起，其中 30 s 是 `failed to delete container from containerd`（dockerd↔containerd 又一次迟滞）。

## 3. 「task-delete 已到仍等满超时」：dockerd↔containerd 会话断连相关（一手 + 推断）

- 09-06 00:35Z（CST 08:35）逐行：`17.534 stopping restart-manager` → **`18.335 healthcheck failed`** → `19.945 received task-delete` → **`23.352 healthcheck failed fatally`**（`session healthcheck failed fatally: Unavailable: … transport: Error while dialing: only one connection allowed`）→ `27.825 failed to exit within 10s of signal 15 - using the force`。08:53Z（CST 16:53）逐行：`13 stopping` → `15 task-delete` → `23 force`，窗口内**无** healthcheck 行。
- 全宿主统计（syslog）：`healthcheck failed fatally` 09-05 124 / 09-06 156 / 09-07 46 条（≈每 16 min 一次，全天候，与 kaogong 无关的 dockerd 自身告警）；09-06/07 共 19 条 10 s 强杀里 **10 条**前 12 s 内有 fatal 行。12 s 窗口随机命中概率 ≈ 12/960 ≈ 1.3%，10/19 远超随机 → 会话断连与「等满超时」**强相关**。
- 30 s 路径同款：§1 两例 task-delete 到达后 dockerd 仍继续等待 → `failed to exit within 10s of kill - trying direct SIGKILL`（SIGKILL 已发、进程已死、dockerd 不知道，再等 10 s 自己再补一刀）。
- 机理（**推断**，未翻 dockerd 源码）：dockerd 等待容器退出走的是它对 containerd 的事件流；会话 fatal 后重连，期间的 exit 事件丢失或迟到，dockerd 只能等到超时再强杀一个已经不存在的进程。对应用无害（进程早已退出），代价是每次部署/重启的源站不可达窗口多 8–10 s（30 s 路径再多 10 s）。为什么 dockerd 与 containerd 之间会「only one connection allowed」（宿主 dockerd 1565 / containerd 版本、swap 2.5 GB 压力下的 gRPC keepalive）**未查**，属宿主级、跨产品，不在本仓库可动范围。
- 08:53Z 那次窗口无 fatal 行仍等满 10 s → 会话断连不是唯一路径，**未完全解释**，不下断言。

## 4. R458 勘误 + 停机形态 14 天全景（一手，启发式归属）

- **勘误 ①**：R458 §2「journal 14 天共 12 条 10 s 强杀」——journal 实际**只从 09-05 22:43:34 CST（14:43:34Z）起**，`journalctl --list-boots` 只剩这一段而宿主自 08-10 未重启 → 09-05 盘满那一秒 journald 把旧档全清了（推断：盘满触发 journald vacuum/丢档），R458 所谓「14 天」是 **1.6 天**。完整历史在 rsyslog `/var/log/syslog*`（08-30 起明文、gz 到 08-09）。12 条中 2 条 kaogong 的结论本身不变。
- **勘误 ②**：R458 §1「20 次退出码未观测」→ §1 已升级为 21/22 一手（dockerd 30 s 强杀行）。
- **勘误 ③**：R458 §6「137 也可能来自 earlyoom、未核」→ §1/§2 已排除。
- 14 天全景（syslog，CST 日；kaogong 归属用「`connecting to shim <id>` 后 ≤3 s 内 `sbJoin … ep=deploy-kaogong-1`」启发式，与 `deploy-history.log` 每日部署数 39/81/49/34/27/32 及 `container-events.log` 每日变更数 44/100/88/69/32/39 量级一致）：

| CST 日 | kaogong 10 s 强杀 | 兄弟产品 10 s | kaogong 30 s（autoheal） | kaogong 容器起动次数 | 备注 |
|---|---|---|---|---|---|
| 08-30 | **45** | 104 | 0 | 52 | R372 前；无 cron 重启器（`crontab -l` 只有 ops/备份/日报），52 次全是部署 Recreate（ID 全不同） |
| 08-31 | **63** | 125 | 4 | 79 | earlyoom 12 SIGTERM + 1 SIGKILL |
| 09-01 | **57** | 38 | 0 | 94 | deploy-history 39 次（只记完成的） |
| 09-02 | 8 | 3 | 1 | 105 | deploy 81 次 |
| 09-03 | 10 | 7 | 11 | 65 | R372/R373 上线日；autoheal 最忙 |
| 09-04 | 11 | 21 | 5 | 59 | autoheal 05:56Z 后 0 |
| 09-05 | 1 | 18 | 0 | 32 | |
| 09-06 | 2 | 10 | 0 | 41 | = R458 那 2 次 |
| 09-07（至 05:31） | 0 | 8 | 0 | 7 | |

- 读法：部署量没有减少（27–81 次/天），**停机时 SIGTERM 无人应答的比例**从 08-30–09-01 的每天 45–63 次掉到 09-02–09-04 的 8–11、09-05 后 1–2、09-07 0。与 R372/R373 时间相关（R372 上线前一天 09-02 已经在掉，所以不只是 R372 一项；同期宿主 swap 仍 2.3–2.9 GB），**不是受控对照**。
- 启发式局限：3 s 内兄弟容器同时起会误归、autoheal 原地重启也算一次「起动」，所以「起动次数」偏高；10 s/30 s 强杀的 kaogong 归属另用 autoheal 日志 ID 校过 21/21，10 s 部分未逐条校。

## 5. 到期项（09-07 05:29Z 实查）

probe=0 22/1（严格口径）、growth probe=0 18/4、error_reason 6 且关联 probe=0 uid 为 0、push_subs 0、weekly_reports 1、next_review 29/29 CST 00:00、`quick_check ok`、WAL 未变、healthy rc=0 `StartedAt 19:41:43Z` 未变。宿主 `free`：mem 1935 MiB / avail 377 MiB、swap 2522/5487 MiB；`df /` **92% / 3.9 G**（R458 时 90% / 4.8 G，一夜掉 0.9 G）。无前端发版 (c) 无新窗口。

## 6. 处置：全部登记，不改码不部署

- 不改 `AUTOHEAL_DEFAULT_STOP_TIMEOUT`、不加 `stop_grace_period`、不动 earlyoom：三条路径的强杀全是假死态 SIGTERM 无人应答的后果，且 09-04 05:56Z 后 autoheal 0 次、09-07 10 s 强杀 0 次；earlyoom 只在 08-31 动过一次、是最后一道保险不该拆。
- 不在部署脚本里处理 dockerd↔containerd 会话断连：宿主级、跨产品、机理未完全解释；代价只是部署窗口多 8–10 s 且窗口内至今无真人请求（R457/R458）。
- SKILL 增补（见 SKILL R459 节）：宿主历史日志优先 `syslog*`（journal 09-05 盘满后只剩 1.6 天）；`within 30s` 强杀 = autoheal 唯一签名；`within 10s of kill - trying direct SIGKILL` / `failed to delete container from containerd` / `healthcheck failed fatally` 是 dockerd↔containerd 迟滞不是应用问题；earlyoom 查 `zgrep earlyoom /var/log/syslog*` 不查 journal。
- 升级给老板的决定项不变：宿主盘扩容 / 迁出 recruit·softcopyright（92% / 3.9 G）；`www.zalize.com` 证书 10-04 到期。

## 7. 如实说明

- 「journald 盘满清档」是按 `--list-boots` 首条 = 盘满首秒的推断，未查 journald 配置里 `SystemKeepFree` 的实际取值与当时 `/var/log/journal` 目录变化。
- 08-31 13:11 / 13:26 两次 10 s 同 ID 重启归「当时操作者手工 `docker restart`」是排除法推断（非 autoheal 30 s、非 Recreate 换 ID、无 cron），无 shell 历史佐证。
- dockerd↔containerd 会话断连与等满超时的因果是相关性推断（10/19 vs 1.3% 基率），08:53Z 反例存在；dockerd 源码未翻，`only one connection allowed` 根因未查。
- §4 表 10 s 强杀的 kaogong 归属是启发式（未逐条对 ID），容器起动次数含 autoheal 原地重启且可能被兄弟容器误归；30 s 部分 21/21 已逐 ID 校过。
- 09-02 起 10 s 强杀骤降与 R372/R373 是时间相关；09-02 就已下降说明还有别的因素（部署节奏/宿主负载），未分离。
- 到期项仍无可确认外部真人作答者、`WX_MINIAPP_SECRET` 未配、R385 第二冷样本未达标。
