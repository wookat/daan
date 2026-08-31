# R69 设计：全站同题每日一练 + 完成对比

## 取证（先调查再动手）

1. **生产全路由体检（1440/375 × 24 路由）**：console error 0、HTTP≥400 0、横向溢出 0——表面卫生无 P0/P1，本轮转向功能深度。
2. **RUM 版本戳（R67）尚无新数据**：生产 `slow_load` 最新 25 条仍全为旧格式（最新一条早于 R67 部署），60/90s 聚簇归因继续等数据，不具备本轮立项条件。
3. **现状「每日一练」是伪每日一练**：`practice.vue startDaily()` 只是 `start(dailyModule)` 随机抽题 + 本地 `dailyPlan` 打卡，**每人题目不同、无全站对比**。
4. **竞品**：粉笔「每日一练」是其签名功能——全站同一套题、交卷后给全站正确率/击败百分比排名，是核心日活留存钩子。（竞品机制描述基于公开常识，属推断非本轮逐屏取证。）
5. **既有可复用地基**：
   - `mock_event.py`（模考大赛）已验证「全站同题+榜单」模式可行；
   - `/api/shizheng/daily` 已有按日期确定性出题先例；
   - practice.vue 固定题组通道（redoSet / 重练）已验证：注入固定 items 即可走完整作答/错题/answer_log 流程；
   - R56 边缘缓存清单：uid 无关确定性 GET 可加 60s TTL。

## 方案

### A. 后端（db.py + qbank_api.py）

- `db.daily_set_questions(day)`：按日期确定性选题——5 模块各 2 题共 10 题，候选池 = 该模块启用真题（不足回退全部启用题），排序键 = `md5(day + ':' + qid)` 取最小 2 个。**哈希选择对题库中途增删稳定**（新增题最多顶掉一题，不会整组重排），进程内按日缓存，重启重算结果一致。
- 表 `daily_set_entries(day, uid, right, total, secs, created_at, PRIMARY KEY(day,uid))`，懒建（对齐 `_ensure_answer_log` 模式）。
- `GET /api/daily_set`（uid 无关、当日确定）→ `{date, items, stats:{participants, avg_right}}`。
- `POST /api/daily_set/submit` `{uid, date, right, total, secs}` → `INSERT OR IGNORE`（首次成绩为准，重复提交不覆盖）→ 返回 `{participants, beat_pct, my_right, already}`；`beat_pct = 100*count(right<我)/max(1,participants-1)`，仅接受当日提交。

### B. 边缘缓存

- `[[path]].js` `API_CACHE_ALLOWLIST` 追加 `/api/daily_set`（uid 无关确定性，60s TTL，与 R56 同通道；跨日误差 ≤60s 可接受）。

### C. 前端（practice.vue）

- `startDaily()` 改为先取 `/api/daily_set`：有题则按固定题组通道载入（`_daily=true`、`_dailyDate`），toast「今日全站同题」；**API 失败回退原随机抽题**（每日一练不因后端故障不可用）。
- `markDailyDone()`：保留本地打卡逻辑，追加 POST submit，响应存 `dailyStats`。
- 完成卡（percentile 行下方）新增：`今日全站同题 · N 人完成 · 击败 X%`（首位完成者显示「你是今天第 1 位完成者」；重复完成显示已记录成绩）。

## 不做

- 不做每日榜单页（参与量未验证，先上完成对比，榜单进候选）；
- 不动模考大赛/时政每日一练；
- 不改 home 入口交互（startDaily 语义自动升级）。

## 验收

- 本地：lint/build 绿；确定性（同日两次请求同题）、跨 uid 同题、submit 幂等。
- 生产：/api/daily_set MISS→HIT 且体一致；双新 uid 实测同题；完成后对比条出现且 beat_pct 正确；A 完成后 B 完成显示参与数=2；375/1440 无溢出 console 0 error；普通刷题/重练/时政回归。
