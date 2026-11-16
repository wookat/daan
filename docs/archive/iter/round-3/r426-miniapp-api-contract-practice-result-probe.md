# R426：小程序真机 API 集合契约核对 + `practice_results` 探针口径（「击败 X% 的刷题记录」）

日期：2026-09-06 · 分支 `devin/1788611745-r400-formula-dropped-snapshot`（PR #619）

## 0. 起点

R425 证实 `umst3tuisd7lgzaka` 是**已发布微信小程序**（`miniapp-native`）在真机上的走查，而小程序从未进入我的复验范围。本轮以该设备 09-06 实际调用的 API 集合为清单，只读核「小程序请求构造 ↔ 后端签名/校验 ↔ H5 口径 ↔ 探针/统计规则」。

## 1. 逐条核对（只读）

清单来源：caddy 全量 327 行（R425）+ `miniapp-native/miniprogram/api/index.ts` 全部 44 个导出函数。

| 端点 | 小程序 | 后端 | H5 | 结论 |
|---|---|---|---|---|
| `GET /api/questions?limit&uid&module` | query 带 `uid=anonUid()` | uid 用于排除已答/错题优先 | 同 | 一致 |
| `POST /api/answer_log {uid,items}` | uid+items | `save_answer_log(uid, items, probe=probe_request())` | 同 | 一致；probe 由请求判定，与客户端无关 |
| `POST /api/mistakes {uid,…}` / `PATCH /api/mistakes/{id} {uid,…}` | uid 在 body | uid 作用域校验 | 同 | 一致；`mistakes` 无 probe 列（R418 既定） |
| `GET /api/review?uid` / `POST /api/review/{mid} {uid,correct}` | 同 | `review_count`/`next_review` 推进 | 同 | 一致（R425 DB 已对账 1952 0→1） |
| `GET/POST /api/favs`、`/api/favs/folders` | uid | uid 作用域 | 同 | 一致 |
| `GET/POST /api/reminders` | uid | uid 作用域 | 同 | 一致 |
| `GET /api/growth?uid` / `GET /api/checkin/badges?uid` | uid | uid 作用域 | 同 | 一致 |
| `GET/POST /api/profile` | uid | uid 作用域 | 同 | 一致 |
| `POST /api/share/create` | 见 R375 | 「击败 X%」已接 `REAL_TRAFFIC` | 同 | 一致 |
| `POST /api/auth/wxlogin` | code | 无 `WX_MINIAPP_SECRET` → 503 `detail` | H5 无此入口 | 已登记资源缺口（R425） |
| **`POST /api/practice_result {module,n,correct,secs}`** | **不带 uid** | **`save_practice_result` 无 uid/probe，池 = 全表 `n>0`** | **同样不带 uid** | **命中：跨用户聚合未接探针口径** |

错误处理：小程序 `utils/request.ts` 与 H5 `api.js` 同样透传 FastAPI `detail`，401/403 登录过期逻辑等价；小程序 `timeout=180000` 比 H5 GET 20 s 宽（P3 不改：小程序无 chunk 加载问题，长 SSE 亦不在小程序内）。

## 2. 命中项一手取证：`practice_results`

**代码**：`db.save_practice_result` 建表只有 `created_at/module/n/correct/secs`，百分位 = 全表 `n>0` 中正确率低于本次的比例，≥10 样本即显示。用户可见文案：H5 `practice.vue` 与小程序 `practice.wxml` 同为「本组正确率击败了 {{percentile}}% 的刷题记录」。R375 接探针口径时只改了题目统计（answer_log）与分享页，**此表漏掉**；SKILL 第 798 行也早已登记「`practice_results` 表无 uid 列（全局聚合），测试产生的行无法归属、不清理」——即每一轮 testing agent 的练习完成都永久留在这个池里。

**生产只读扫描**（容器内 `/tmp/r426_pr_pool.py`，2026-09-06 09:47 UTC）：

```
practice_results total 286  n>0 286
cols ['id','created_at','module','n','correct','secs']
first/last 2026-07-31 19:54:51 → 2026-09-06 08:57:55
按日：08-14 18 · 08-31 31 · 09-03 13 · 09-04 35 · 09-05 13 · 09-06 2   （与走查日一致）
pool acc quantiles p10/p25/p50/p75/p90 = 0.10 / 0.24 / 0.68 / 1.00 / 1.00
n 分布：10×222, 25×13, 1×11, 5×8, 38×8 …
按时间 ±3 s 关联 answer_log：probe1(test-uid) 2 · probe0 2 · probeNULL 81 · 无法关联 201
```

解读（如实区分）：
- 286 行**没有一行可归因到具体 uid**（表无 uid）；按时间关联 answer_log 只匹配到 85 行（H5 先 POST practice_result 再 logAttempts，且 test uid 的 answer_log 早被清理脚本删除），所以「无法关联 201」主要是**已清理的走查会话残留**——与日期分布（08-14/08-31/09-04 都是密集走查日）、p25 已是 100% 正确（知道答案点对）+ p10 只有 10%（点过去）的双峰形态一致。
- 唯二 probe=0 的 2 行就是 R425 那台 vivo 小程序（08:56:09 / 08:57:55，各 10 题对 3/3）——它看到的「击败 X%」分母是 284 行走查残留。
- 结论：**该表的历史 NULL 行不能套 `REAL_TRAFFIC`（`COALESCE(probe,0)=0`）的兼容口径**——answer_log 的 NULL 行是「无法回填但清理过测试账号」的旧真人/匿名混合，而这张表从未被清理过、且形态证明主体是走查。

## 3. 修法（最小、可逆、不删行）

- `db._ensure_practice_results`：幂等加列 `uid TEXT`、`probe INTEGER`（复用 R374 `add_column_if_missing`，容忍并发首请求 duplicate column）。
- `save_practice_result(..., uid=None, probe=False)` 写 uid / probe（0/1）；**池谓词 `PRACTICE_POOL = "n>0 AND probe=0"`**（严格，不含 NULL；与 `REAL_TRAFFIC` 并列并注明原因）。≥10 个真人样本才出百分位——上线后「击败 X%」会**消失**，直到累计 10 次真人练习完成；这是如实展示而非回归。
- `/api/practice_result` 读 body 可选 `uid`（≤64）+ `auth.probe_request(request)` 三路判定；小程序旧包不带 uid 也能落 probe（判定在服务端）。
- H5 `practice.vue` payload 加 `uid: anonUid()`；小程序 `api/index.ts` 需下一次微信开发者工具发布时补（P3 登记，不在 H5 管线）。
- 管理台 `daily_usage`（14 日会话/答题/正确率）接 `REAL_TRAFFIC`；`_admin_stats_uncached` 先 ensure 列，避免部署后首次看板早于首次练习完成而 `no such column`。
- 历史 286 行：不删、不回填（无 uid 不可归因；R418 只对 `test-*` 命名行回填，这里没有 uid 可判）。回滚 = 把 `PRACTICE_POOL` 改回 `n>0`，加列无副作用。
- 单测 `backend/tests/test_r426_practice_result_probe.py` 4 条：探针 12 次全对 + 12 行无 probe 历史行都不进池（samples=0 → None）；真人第 10 次出 90%；uid 可选/截 64；daily_usage 只计真人；加列幂等。

## 4. 本地门禁

pytest 479（+4）/ ruff / pyright 0；vitest 603 / eslint 绿；build 由 `deploy_h5.sh` 执行。

## 5. 生产复验（rev `dc69266`，bundle `index-BMH9b7Gf.js`）

部署窗口：宿主 load 1.5 → 3.7、free ~98 MB、磁盘 91%/4.7 G → 4.4 G；rc=0，Lighthouse 全过（/ LCP 1675 ms）。

**探针一手**：`POST /api/practice_result` 带 `X-Kg-Probe: 1` 与不带头（出口网段命中）各 1 次 → 均 `{"percentile":null,"samples":0}`；容器内 `PRAGMA` 见 `uid/probe` 列，`by probe = [(NULL,286),(1,2)]`；`daily_usage` SQL 实跑 8 天正常；10 min 日志 Traceback/locked/500 0。

**testing agent**（uid `test-r426-ui-1`，375 ×2 组 + 1440 ×1 组，XHR 钩子抓 body）：三组完成页 `POST /api/practice_result` body `{uid:"test-r426-ui-1",module:"changshi",n:10,correct:9|8,secs}` 与「答对 X/10」一致（第一组 body 未抓到——初版钩子只克隆 fetch 而 H5 走 XHR，以 200 + DB 行 `n=10 correct=7 probe=1` 佐证），响应恒 `{null,0}`，`.beat` 0 不出「击败 …%」，正确率/用时/错题数/「再来一组」正常；DB 行 289/290/291 `probe=1`，`probe=0` 全程 0；错题本收 6 条（含多选 ABCD→ACD）、answer_log 30；`/api` non-2xx 0、console/pageerror/rejection 0；容器 healthy 0 重启、75 min 日志 Traceback/locked/5xx 0；管理台概览「近 14 天作答量趋势」正常、`/api/admin/stats.daily_usage` 09-06 `sessions 2`（当日 probe=1 5 行已排除，否则 7）。清理 `test-r426-ui-1` 4 表 + `test-r426-verify` 2 行 → LEFTOVER 0，practice_results 回 286（全 NULL）。

**复验附带发现**：`daily_usage` 字段**没有任何管理台页面渲染**（`core.js` 只在登录校验时调 `/api/admin/stats`；概览 14 天图来自 `dashboard.trend`/answer_log）——本轮接口径不产生用户可见变化，P3 登记「是否需要面板」不据此加功能。

## 6. 登记

- P3：小程序 `api/index.ts` `postPracticeResult` 补 `uid: anonUid()`，随下次微信开发者工具发布；服务端已能落 probe，旧包只缺 uid。
- P3：`daily_usage` 无前端展示；管理台若需「真人每日练习完成」面板再定。
- 「击败 X%」在累计 10 次 probe=0 练习完成前不显示——需有真人后回看首次出现的样本构成。
