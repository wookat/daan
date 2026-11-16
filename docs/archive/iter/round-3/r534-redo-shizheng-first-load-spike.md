# R534：错题重练无 `question_id` 行先走 `shizheng_questions` 索引等值查（0.9 ms），未命中才回落 `questions` LIKE 前缀扫（3.3 s × 1–3）+ (c)/到期项/簇 + load 3.84 尖峰归因 + 三候选一手核

日期 2026-09-08（UTC 10:0x–10:3x）。生产 `5869b401`（R532）→ 本轮发版见 §3。

## 0 结论

| 项 | 一手 | 结论 |
|---|---|---|
| **A 命中：`/api/mistakes/redo` 对无 qid 行的查找顺序** | 生产 `mode=ro` DB：`mistakes` 360 行，`question_id IS NULL` 28 行（全部未掌握、9 个 uid），其中 **27 行题干首行精确匹配 `shizheng_questions.question`**（`~/r534/r534_db.out`）；`questions` 156,792 行 / 活跃 109,371 行；生产容器内实测 `SELECT * FROM questions WHERE question LIKE ? ESCAPE '\\' … LIMIT 80`（非命中前缀）**3.34 s**，`SELECT * FROM shizheng_questions WHERE question=?` **0.9 ms**（`~/r534/redo_scan.out`）。源码（R521 前）：无 qid 行先 LIKE 全文前缀 → 次行 → 首行三阶梯（每阶扫全部活跃行），**全部落空**后才试 `_shizheng_redo_item()` | **实修**：`db.py` 无 qid 行**先** `_shizheng_redo_item(conn, head)`，命中即追加 `_sz` 题（保留 `mistake_id`）并 `continue`；未命中才进原 LIKE 阶梯（手录题语义不变）。有 qid 行仍 `questions.id` 直查、不碰 `shizheng_questions`。效果：时政错题每题少扫 1–3 遍 10.9 万行（生产上界 3.3 s × 3 ≈ 10 s/题） |
| B 扫描结果 sheet dup 行直达 R532 录入层历史 | 源码 `book.vue`：结果 sheet 汇总行已含卷码，dup 说明行（R531 `scanDupNote`）已给出「已于 时刻 判分」；R532 历史（`submitted_pages`）挂在录入层查卷回包上，从 sheet 直达需 `closeScan()` → 开录入层 → 以 `scanResult.code` 自动 `manualLookup` | **不立项**：dup 行与 R532 提示行同源同时刻（R533 已锁），差异只剩「N 次不同作答 / 其它页」两项信息；生产 `paper_submits` 表**仍不存在**（0 真人判分），无诉求；要做也是 3 行（关 sheet → `manualOpenSheet()` → `manualLookup(code)`），等真人扫描出现再评（并入 R532-1） |
| C 「最近导出的试卷」chip 对已判过分卷标记 | 源码 `api.js rememberPaper()`：chips 来源是**客户端 `uni.getStorageSync('recentPapers')`**（`{code,title,ts}` ≤10 条），不查服务端；标「已判过」需对每个 code 发 `paper/{code}?uid=` 或新增批量接口 | **不立项**：选中 chip 后 `manualLookup` 已走 R532 提示行；预标记要 ≤10 次 GET 或新接口，生产 0 真人判分（`paper_submits` 不存在）无诉求 |
| D 重导刷新 `paper_exports.created_at` 对「最近导出」排序影响 | 源码：排序完全由客户端 `rememberPaper` 决定——`filter(code≠)` + `unshift` + `slice(0,10)`，按**本机导出时刻**排；服务端 `created_at` 前端**无任何引用**（`grep created_at` 只在后端 `paper/{code}` 回包） | **成立无影响、不登记**：同码重导 → chip 移到最前（预期）；服务端刷新 `created_at` 不进排序 |

## 1 (c) 补量 / 到期项 / 簇（`~/r534/r534_cluster.sh` → `r534_cluster.out` 10:20:46Z；`r534_restart.sh` → `r534_restart.out`；`r534_spike.sh` → `r534_spike.out` 10:23:37Z；`r534_db.py` → `r534_db.out`；`r534_pre.out` 10:25:31Z）

- 容器 `deploy-kaogong-1`（R532 09:38:43Z）Up 42 → 47 min healthy，`Restarts=0 OOM=false FailingStreak=0`；6 h 容器日志 5xx 0 / Traceback 0 / assets 404 0；`mistakes/redo` 6 h 0 次（无真人重练）。
- DB 只读（`file:/data/data.db?mode=ro`）：`answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38`（仍 4 列）；`paper_submits` 表不存在；`answer_log` 04:52Z 起 0；`umst3` 45/32/1 不变；WAL `4,173,592` 同字节；`data.db.r483-before` 449 MB 仍在（待老板确认清理）。
- 宿主：load `0.86/1.65/1.70` → `0.79/1.05/1.42`；`/` 3.0G(94%)（R533 3.9G → 又少 0.9G：`recruit`/`softcopyright` 两个兄弟栈 09:58Z / 10:10Z 重建）；MemAvailable 344 → **194 MB**；Swap 5.6G 总 / 3.5G 空；`compose build` 进程 0。
- **簇**：09:34Z 再起段至 **10:20:46Z 仍在跑**（47 个连续有流量分钟、1,822 行、~39 行/分，UA 仍是同一 Mac 2952 / Win 2837 Chrome 对，`/tiku/q/*` 逐题）；**「何时停」本轮观测窗内仍未停**；**09-09 00:00Z 日界未到**（采样时 10:25Z），两项再转 R535。归因仍推断。
- 非探针头非 GET 自 00:00Z 80 条（与 R533 同数、无新增）→ 外部真人写 0。
- **load 3.84（R533 09:52:58Z 一次读数）归因**：`sar -q` 17:50 CST `0.33` → 18:00 `3.26`（blocked 2）→ 18:10 `1.87`，尖峰确在 17:50–18:00 窗；同窗 `sar -u %iowait 14–33%`、`sar -B majflt 1731–3159/s、pgscank 8.9k–17k/s`、`sar -W pswpin 1588–2976/s`（**宿主 swap 换入/换出 + I/O wait 持续**，与 R533 §1 MemAvailable 300 MB 级一致）；Docker：`recruit-app/worker/worker-heavy` **09:58:46Z** 重建、`softcopyright-api/worker` 10:10:40Z 重建（`docker inspect StartedAt`），`docker events` 对该窗回空（事件缓冲不可考）；journal 17:52:42 兄弟 `sh[483000]`「出口自检 1 个入口全部不可用」；kaogong 侧：09:50–09:56Z Caddy 240 请求（29–52/分，簇 SSR）**`duration>1s` 0 条**、容器日志 426 行全 200/304。**事实**：尖峰窗宿主处于 swap 抖动 + iowait 高位，且 6 min 后兄弟 `recruit` 栈重建；kaogong 无慢请求、无重启、无 OOM。**推断**：尖峰由宿主级内存/I/O 争用（很可能是兄弟栈重建前的镜像拉取/构建）贡献，不是 kaogong 应用或簇流量所致。**未知**：`docker events` 回空，无法给出 09:50–09:58Z 内兄弟栈的精确进程时序。
- 顺带一手：Caddy journal 17:48:10 CST `tls.cache.maintenance certificate expires soon; queuing for renewal identifiers=[zalize.com] / [www.zalize.com] remaining≈2,271,043 s（26.3 天）` → **Caddy 已自动排队续期**（10-04 到期项），续期是否成功 R535 复查 journal `obtaining/renewed`。
- 脚本教训：`docker exec -i … curl` 在容器无 `curl` 时 `exec` 失败**且 `-i` 已吞掉脚本剩余 stdin**（`r534_cluster.sh` DB 段整段未跑）→ 拆成 `r534_db.py` 用 `docker cp` + `docker exec python3`（不带 `-i`）；宿主 `127.0.0.1:8000/api/health` 回 Not Found 是端口映射不同，健康以 `docker inspect Health` 为准。

## 2 本地门（`~/r534/gate_be.out` / `fe_gate.out`）

pytest **590**（+4：`tests/test_r534_redo_shizheng_first.py`——时政 null-qid 行 0 次 `questions LIKE`；传统 null-qid 行仍走原阶梯（2 次时政等值查 + 4 次 LIKE：首扫即中 1 + 全落空 3）；有 qid 行 0 次 `shizheng_questions`；等值查 `EXPLAIN QUERY PLAN` 走 UNIQUE 自动索引）/ ruff All checks passed；vitest 141 文件 / **952**、eslint 0 error（19 存量 warn）、design-tokens ok、build:h5 `index-M9JnAcJA.js` = 线上（前端 0 改动）；`git diff --check` 空。

测试 SQL trace 只挂**测试线程**创建的连接（`threading.get_ident()`），否则 `_warmup` 等后台线程的 SQL 混入计数（首版不稳）。首版对传统行断言 3 次 LIKE 失败：实际 4 次（`m_legacy` 首扫即中 1 + `m_gone` 三阶全落空 3）→ 改断言，不动生产回落阶梯。

## 3 发版 / 生产（`~/r534/r534_pre.out` 10:25:31Z / `r534_deploy.log` / `r534_post.out` 10:28:36Z / `r534_redo_timing2.out`）

- 预检：load `0.79/1.05/1.42`、`/` 3.0G(94%)、MemAvailable 194 MB、Swap 空 3.5G、`compose build` 0、容器 healthy 0 重启 → 盘/兄弟两项满足、内存偏紧（R531 触顶形态是兄弟构建中途再起，预检时不在）→ 发。
- `./deploy/deploy_h5.sh --skip-build`：4/6 `host: mem_avail=246MB disk=3.0G load=0.56 other_builds=0`，轮询 6 次旧 `5869b401` → **10:27:15Z** 新容器 `8ede6eb7 compose_rc=0`（~1.9 min，未触 600 s）；4a rev = 本机；Pages `70c0cc60`；5 线上 bundle `index-M9JnAcJA.js` = 本机（前端 0 改动）、5b 7 种 `Accept-Encoding` 全 `application/javascript`；6 回归 7 项 200；6b `/` perf 0.98 / a11y 1.00 / bp 1.00 / seo 1.00 / LCP 1678 / CLS 0.06、`/tiku/` 全 1.00 / LCP 869 / CLS 0；`DEPLOY_RC=0`。
- 后检 10:28:36Z：容器 `started 10:27:15Z restarts=0 healthy oom=false`；load 0.86、`/` 2.4G(95%)（又少 0.6G——非 kaogong：本机 `--skip-build` 只拉 `docker compose up -d`）、MemAvailable 338 MB；**Recreate 窗 10:25–10:32Z 源站 204 请求全 200、5xx 0**；新容器日志 5xx 0 / Traceback 0；DB `1324/360/37/38`、`paper_submits` 表不存在、`explain_cache 82`、WAL `4,173,592` 同字节 → 0 写入 / 0 PDF / 0 LLM。
- **A 生产一手（容器内 `127.0.0.1:8000` 只读 GET，`X-Kg-Probe: 1`，各 uid 2 次）**：`umst3`（9 条无 qid 全时政）`redo?limit=25` **19 ms / 7 ms**，25 项含 `_sz` 9、全带 `mistake_id`；`umtgohmz…`（8 条无 qid）**4 ms / 4 ms** 8 项全 `_sz`；`umsagbor…`（3 条）4 ms 3 项全 `_sz`。改前同 uid 端到端未在改前实测（6 h 内 0 真人重练、不造对比请求），只有单条 SQL 一手：非命中 LIKE 前缀 3.34 s/次；改前（`origin/main`）时政行必先走全文前缀 + 首行%次行%（有次行时）+ 首行% 共 2–3 次全落空才试 `_shizheng_redo_item` → `umst3` 9 行改前估 ≈ 60–90 s（推算，非实测），改后 19 ms。28 条无 qid 里 1 条未匹配时政的行仍走原 LIKE 阶梯（属手录/改写题，预期）。
- 簇：10:20–10:28Z 每分 24–49 行仍在跑，last 10:28:37Z。

## 4 登记

- R532-1（P3）「查看本卷错题」：并入本轮 B（dup 行直达 R532 历史，3 行实现路径已核）。
- R534-1（到期项）：簇 09:34Z 段何时停 / 09-09 00:00Z 后是否接续 → R535；Caddy 证书自动续期结果 → R535。
- R534-2（信息项）：`paper_exports.created_at` 前端无引用；「最近导出」为客户端 localStorage 排序。

## 5 如实

A 的收益量化来自生产容器内只读实测（单条 SQL 计时），不是真人请求时延对比（6 h 内 `mistakes/redo` 0 次，本轮部署后也不造生产重练请求）；B/C/D「不立项」依据是源码 + 生产 `paper_submits` 不存在（0 真人判分），不是用户访谈；load 3.84 归因为「宿主级争用 + 兄弟栈重建」的推断，`docker events` 不可考；簇归因推断；生产段只读 GET/日志/`mode=ro` DB，0 POST / 0 PDF / 0 LLM / 0 写入；无 testing agent 录屏（未另行授权）。
