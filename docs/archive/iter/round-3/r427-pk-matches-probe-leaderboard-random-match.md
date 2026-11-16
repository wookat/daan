# R427：`share/create` 与 PK 跨用户口径复核 → `pk_matches.probe`（周榜只算真人 + 随机匹配同类配对）

rev `7464985`（仅后端 `backend/app/pk.py` + `scripts/r427_pk_probe_backfill.py` + 4 单测；bundle 不变）。

## 起点（R426 汇报「下一步」）
复核 `share/create` 与 `/api/pk/result` 两处「击败/对比」跨用户口径是否与 R375 同谓词、有无漏掉无 `probe` 列的表。

## 取证（一手，生产只读 + 源码）
| 路径 | 跨用户读取 | 源表 / 谓词 | 结论 |
|---|---|---|---|
| `POST /api/share/create` | 无（只创建/复用 `shared_questions`，返回 sid） | — | 不涉及 |
| `POST /api/share/{sid}/answer` → `q_stats` | 题目正确率/人次/易错项 | `answer_log` + `db.REAL_TRAFFIC`（R375 已接） | 一致 |
| 分享页「N 人作答」列表 | 仅该 sid 的 `shared_answers`（作答者可见） | 分享作用域，非全站 | 不涉及（生产 15 分享 / 4 作答，全为内部 uid） |
| `GET /api/pk/result/{code}` | 单局双方公开比分 | `pk_matches` 按 code | 无跨用户池，不涉及 |
| `GET /api/pk/mine` | 本人对局 | uid 作用域 | 不涉及 |
| **`GET /api/pk/leaderboard`** | **本周胜场榜（全站）** | **`pk_matches` 无 `probe` 列、无谓词** | **命中** |
| **`POST /api/pk/random_match`** | **从全站等待池配对手** | **同上** | **命中（真人会被配给走查幽灵局）** |
| `daily_set_submit` beat_pct/board | 当日打卡池 | `daily_set_entries` 无 `probe` | 结构同类但**生产 0 行**，本轮不动（P3 登记） |

生产 `pk_matches` 26 行（部署前）：
- 已结束 9 局里 8 局双方都是走查 uid（`test-w1/w3/w4-mp*`、`devin-test-p3-*`、`r7-sh-*`、`r8-sh-*`、`r10b-pk-*`、`r13-pk-*`）+ 1 局 `umsfewv3… vs opponentuid12345`；仅 `OG433F umtfgf4… vs umtfgmb…`（08-30）双方为普通匿名 uid。
- **匿名 `GET /api/pk/leaderboard` 实测返回 3 个胜者 `test-w***`（考友VY3F/W3/W4b）——本周榜全是 R418 走查对局**，任何真实访客打开 PK 页都会看到。
- 等待池（`status='waiting' AND opponent_uid IS NULL`）：`r8b-check` ×3、`r9-pk-a` ×2、`r10-pk-a` ×3、`r10b-verify`、`r19r-*` ×2、`opponentuid12345`，仅 `ums…` 5 局是匿名真人；真人随机匹配大概率配到 08-14 走查留下的幽灵局。
- caddy 08-29 起 `/api/pk/*` 命中全部为 Linux Chrome（Devin 走查）/ curl，无可确认外部真人 PK 流量——**污染是「用户可见」的结构事实，不是「已发生的真人受害」**，如实区分。

## 修法（最小、可逆、与 R418 同口径）
- `init_pk_db`：`add_column_if_missing(pk_matches, probe INTEGER)`（幂等）。
- `create` 写 `probe = probe_request(request)`；`join` 时 `probe = MAX(COALESCE(probe,0), 加入者)`——任一方探针即 1（探针加入真人局也不外泄）。
- `random_match` 等待池加 `COALESCE(probe,0) = 请求方 probe`：真人只配真人、探针只配探针。
- `leaderboard`：`WHERE … AND (COALESCE(probe,0)=0 OR creator_uid=? OR opponent_uid=?)`——榜只算真人，但本人参与的对局始终可见（探针/走查看自己不会空榜，同 R418 排行榜「真人 OR 本人」）。
- `result/{code}`、`mine` 不改。
- 历史回填脚本 `scripts/r427_pk_probe_backfill.py`：只标团队命名约定 uid（`^(test-|devin-test-|r\d+[a-z]?-|opponentuid12345$)`），dry-run 不加列、`--apply` 记录 id 列表、`--restore` 只把仍为 1 的行改回 NULL；普通 `ums…` 匿名行不动、不删行。

## 生产执行
1. dry-run（改前）：`probe IS NULL 26，命中 21，未命中 5（全 ums…）`。
2. 部署 `--skip-build` rc=0（宿主 load 0.38、free 96 MB、磁盘 91%/4.6 G；Lighthouse 首页 LCP 2745 一次 WARN，bundle 不变同 R424）。启动即加列；部署窗口另一会话（wechatdevtools UA，`test-w6-social-mp` 10:28 UTC）新建 PK 行**写入侧直接落 probe=1**。
3. `--apply --record /data/r427-pk-probe-backfill.json` → `已标 21/21`；re-dry-run 命中 0；表 `NULL 5 / probe=1 22`（含 w6 新行）。
4. 匿名 `GET /api/pk/leaderboard` → `{"items":[]}`；`?uid=test-w1-mp` → 只看到自己那局的胜者（`my_rank null`，因胜者是对手 w1-mp2）。

## 复验（testing agent，生产 375×812 + 1440×900，uid `r427-ui-a/b/c/d`，全 PASS）
- A 首进 PK 页空态；发起常识判断挑战 `G2JIGD` 569 分 → DB `probe=1 waiting`。
- B 经分享链接 `#/pkgA/pk/pk?code=G2JIGD` 自动 join → 惜败 566:569 → DB `finished / winner creator / probe=1`（join 未把 1 改回 0）。
- **关键**：A 看「我的排名 #1 · 1 胜」、B 看到胜者 `r427-u***`；第三方 C 与匿名 curl 始终 `items:[]`。
- D 选「数量关系」随机匹配（该模块等待局仅真人 `ZBFS14`）→ `matched:false` 新开 `0MOJES` probe=1，toast「暂无对手，已为你开局等待匹配」；`ZBFS14/NH68MA/EP6F1H/O5VK5T` opponent_uid 仍 NULL。
- 1440 双栏同口径、无横向溢出。`/api` non-2xx 0、console/pageerror/rejection 0；容器 healthy 0 重启；60 min 日志 5xx/Traceback/locked 0（唯一 404 `GET /api/pk/result/nonexist` 来自 172.23.0.1 = 部署脚本 smoke）。
- 清理 3 行（含 agent 一次 curl 误留 `H066AU`）→ LEFTOVER 0；`pk_matches` 回 27（NULL 5 / probe=1 22）。
- 观察（非本轮改动）：chip 切换后 ~1 s 内立刻点「发起好友挑战」出现一次 XHR status 0（未到服务端，重点即成功）；建议真机复现，登记 P3。

## 本地门禁
pytest 483（+4）/ ruff / `npx -y pyright app` 0 errors；前端未改（bundle `index-BMH9b7Gf.js` 不变），vitest/eslint/build 未重跑。

## 顺带登记（不改）
- **P2** 分享作答页 `share-q.vue` 只能点单个字母即提交，`api_share_answer` 也 `picked[:2]`：多选题被分享后作答者必判错。生产 15 分享 / 4 作答全为内部 uid，无真人受影响样本；待有分享真人流量再做（需前端多选交互 + 后端 `normalize_answer`，同 R417 口径）。
- **P3** `daily_set_entries` 无 `probe` 列（结构同类），生产 0 行、有 uid 可按 uid 清理，暂不加列。
- **P3** `test-w6-social-mp` 行是另一会话走查产物（probe=1），不属本轮清理范围。

## 回滚
- 代码：revert `7464985`（旧代码不读 `probe` 列，加列无副作用）。
- 数据：`python3 scripts/r427_pk_probe_backfill.py --restore /data/r427-pk-probe-backfill.json`（21 行 probe→NULL）。
