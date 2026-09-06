# R429：每日一练成绩表无 probe 列——「N 人完成 / 今日排行榜 / 击败 X%」把探针成绩当真人展示 → 探针打标 + 库内证据回填；Lighthouse a11y 0.94 复现取证

rev `f71db28`（后端 `db.py` / `qbank_api.py` + 前端 `practice.vue` 1 行 + 回填脚本 + 单测 pytest 3 / vitest 1；bundle 变）。

## 起点（R428 汇报「下一步」）
① Lighthouse 首页 accessibility 0.94 一次 WARN 的失败项复现（R428 报告随 tmp 删除未取到）；② 登记的 P3 `daily_set_entries` 无 probe（当时 0 行）与 `daily_set_submit` 池口径一并看。

## ① Lighthouse accessibility 0.94：未复现，无失败项可取
- 本机对 `https://kaogong.zalize.com/` 完整 Lighthouse 5 次（`--headless=new`，与 `deploy/perf-budget.sh` 同参数），lhr 留存 `/home/ubuntu/r429_lh/home_{1..5}.json`：**accessibility 全 1.0**，`audits` 中 score<1 的 a11y 项 **0**；performance 0.98/0.93 ×4。
- 本轮部署 6b 预算回归：`/` accessibility **1.00**、`/tiku/` 1.00，LCP 2303 ms、CLS 0.07 全过。
- 结论：6 次采样无一失败项，R428 那次 0.94 无法复现、也没有 lhr 可归因。**不改首页、不下「偶发」以外的结论**；`perf-budget.sh` 已把 lhr 写到 tmp 后删除，若再出现需保留报告——本轮不改脚本（预算脚本口径不动，等再命中一次再定）。

## ② daily_set_entries 池口径：真问题，且已在用户可见面暴露
### 源码
| 位置 | 现状 |
|---|---|
| `db._ensure_daily_set` | `(day, uid, right, total, secs, created_at, nickname)`，**无 probe 列** |
| `db.daily_set_stats` | `COUNT(*) / AVG(right) WHERE day=?` 全表 → `GET /api/daily_set` `stats.participants`、SEO `/tiku/daily/` 「今天已有 N 人完成」 |
| `db.daily_set_submit` | 击败比例 / 名次池 `WHERE day=?` 全表 → 完成页「N 人完成 · 击败 X%」「我的名次」 |
| `db.daily_set_board` | `WHERE day=?` 全表 → 完成页「今日排行榜」、SEO 页「今日排行榜（前 N 名）」（昵称公开） |
| `POST /api/daily_set/submit` | 不接 `Request`、不判探针 |
| R375/R386/R418/R426/R427 | `answer_log`/`growth_events`/`exam_attempts`/`practice_results`/`pk_matches` 均已打标，这张表是遗漏 |

### 生产（容器 `/data/data.db` 只读 + caddy 日志，2026-09-06）
- 表 **1 行**：`2026-09-06 umtpnhrwbzwprmwhv 3/10 52 s 「考友CPV8」 created 1788690013`。
- 归因（库内）：同 uid `answer_log` **30 行全 probe=1**（09-06 11:37–11:44Z）、`growth_events heatmap_view` 4 行 probe=1、`mistakes` 15、无 probe=0 行；（日志）该 `POST /api/daily_set/submit` 出口 `140.232.64.5` ∈ `KG_PROBE_CIDRS`，UA iPhone 形态（复验 agent 的 375 仿真）。→ **探针成绩，无争议**。
- 用户可见：部署前 `GET /api/daily_set` `participants:1`、`/api/daily_set/board` 1 条「考友CPV8」、SEO `/tiku/daily/`「今天已有 1 人完成」+「今日排行榜（前 1 名）1. 考友CPV8 · 答对 3/10」——任何访客/爬虫可见。
- 历史：caddy 08-31 起 `/api/daily_set` GET 1274（200）、`/submit` 17 ×200 + 4 ×0 + 4 ×502 + 1 ×400 + 1 ×503，出口以 `140.232.64.x` 为主；表只剩 1 行说明历次走查行都被清理过。`growth_events daily_open` NULL 6 / probe=1 2；**没有 probe=0 的每日一练行为**。
- 表无 IP/UA，历史 NULL 行不能凭日志归因；本轮只有 1 行且库内证据完整。

### 结论
- 不是「0 行 P3」了：生产已有 1 条探针成绩以昵称公开出现在 SEO 页与完成页，且「击败 X%」「我的名次」对后续真人会以探针为分母——与 R418 卷库「N 人考过」、R427 PK 周榜同性质。**修，口径同 R418/R427，不加功能**。

## 修法（最小可逆、不删行）
- `_ensure_daily_set`：`add_column_if_missing(..., "probe", "INTEGER")`（幂等，容忍并发首请求）。
- `daily_set_stats`：`AND COALESCE(probe,0)=0`（`REAL_TRAFFIC` 兼容口径：NULL 历史行仍计入——该表现无 NULL 行，且每日一练每日重置、不存在 R426 那种走查残留长期污染分母的形态，故不用 `practice_results` 的严格口径）。
- `daily_set_submit(..., probe=)`：写 1/0；击败/名次池 `(REAL_TRAFFIC OR uid=?)`——本人成绩对本人始终计入（探针/走查会话看自己不会 `participants:0`，与 R418 排行榜 pool 同）。
- `daily_set_board(day, limit, uid=None)`：同池；`GET /api/daily_set/board?uid=` 可选，完成页带 `anonUid()`（board 不在边缘缓存白名单，`/api/daily_set` 精确匹配，不受影响）。SEO 页不带 uid → 纯真人。
- `POST /api/daily_set/submit` 接 `Request`，`probe_request()` 三路判定（显式头 / 网段 / 自动化 UA）。
- `scripts/r429_daily_set_probe_backfill.py`：NULL 行满足「uid 命中团队命名约定（`test-*`/`devin-test-*`/`r<N>-*`）」或「同 uid `answer_log` 有 probe=1 且 **无** probe=0」→ probe=1；其余不动；默认 dry-run，`--apply --record` 落 `(day, uid)`，`--restore` 只还原当前仍为 1 的行。

## 本地
pytest **489**（+3：submit 写 probe 且四处池排除探针/本人可见、SEO 页只算真人、回填脚本 5 形态 + restore）/ ruff / pyright 0；vitest **607**（+1 源锁：board 请求带 `encodeURIComponent(anonUid())`）/ eslint / build:h5 绿。

## 生产执行（先改库再部署）
1. dry-run：`probe IS NULL 1 行，命中 1 行 ← answer_log probe=1 ×30 / probe=0 ×0`。
2. 备份全字段 JSON `/data/r429-daily-set-before.json`（1 行）→ `--apply --record /data/r429-daily-set-probe-backfill.json`：`已标 probe=1 1/1`（脚本加列）→ 复查 `[('2026-09-06','umtpnhrwbzwprmwhv',1)]`，列已含 `probe`。
3. `deploy_h5.sh` 全构建 rc=0（宿主 92→94%/2.9 G、free ~330 MB、load 峰 4.2），rev `f71db28`，bundle `index-BgF7eoj8.js` 125 KB gz；6b Lighthouse 全过（见①）。
4. 部署后：`/api/daily_set` `participants:0`；`/api/daily_set/board` `[]`；`?uid=umtpnhrwbzwprmwhv` 回 1 条；`/tiku/daily/` 源站「来做今天第 1 位完成者」无榜（边缘 HIT age 190 的旧副本 5 min 内自然过期）。

## 复验（testing agent，uid `r429-ui-a` 375×812 / `r429-ui-b` 1440×900，探针网段）— (a)–(f) 全 PASS
- (a) A 深链 `?daily=1` 原生做完 10 题：`POST /api/daily_set/submit` → `{participants:1, beat_pct:null, my_rank:1, already:false, streak:1}`（**池不含 umtpn… 探针行，不是 2**）；页面拉 `GET /api/daily_set/board?uid=r429-ui-a` 只回本人；完成页「今日全站同题 · 你是今天第 1 位完成者」+「今日排行榜 · 我的名次：第 1 名」1 行；DB 新行 probe=1。
- (b) 匿名口径全程：`/api/daily_set` `participants:0` ×2、board `[]` ×2、`/tiku/daily/?x=`（cf DYNAMIC）「来做今天第 1 位完成者」、无榜、无任何昵称。
- (c) B 1440：同 `participants:1 / null / rank 1`，榜只含自己不含 A；`.dsboard` 在父卡内、`sw==cw`。
- (d) 幂等：B 再做一组（6 对）→ `already:true, my_right:5`，完成页「成绩已记录（首次 5 对） · 1 人完成」，DB 每 uid 1 行。**完成页 F5 不重发 submit**（从第 1 题重开），幂等靠二做触发。
- (e) `/api` non-2xx 0（185 条）、console/pageerror/rejection 0；healthy 0 重启（StartedAt 11:44:23Z）；60 min 日志 5xx/Traceback/locked 0。
- (f) 清理 6 表 60 行（含 `review_log` 1 行——每日一练也写它，清单外全库扫 uid 补到）→ LEFTOVER 0；`daily_set_entries` 回 **1 行 umtpn… probe=1**。并发外部探针 `umtpqwm7p0put2j5p`（probe=1）+1 answer_log/+1 mistakes 非本轮、未动。
- 录屏/报告见 PR #619 评论。

## 登记 / 不做
- 历史 NULL 行日志归因不可行（表无 IP/UA）、本轮无需（0 行 NULL）。
- `perf-budget.sh` 不保留 lhr：a11y 再次 <1 时无失败项可取——等再命中一次再定是否改脚本（本轮不改预算工具）。
- 小程序 `miniapp-native` 不调用任何 `/api/daily_set*`（rg 0 命中），本轮无小程序侧待办。
- `.trend-kn` 运行时字号需 4 周已掌握样本；`error_reason` ≥09-11 看 probe=0；R430 SOP-10 四维审计。
