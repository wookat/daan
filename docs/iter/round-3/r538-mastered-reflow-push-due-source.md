# R538：取证轮——H5「已掌握」后再答错回流 / 「恢复复习」批量对 `_sz` 行 / 到期推送数与首页到期数同源 三候选一手核均成立不改码；Caddy `zalize.com` 续期行 reload 后确认 0；簇 09:34Z 段仍在跑、09-09 日界未到；0 产品代码 0 部署（生产仍 `8ede6eb7`）

日期：2026-09-08（UTC 11:3x）。本文档分支从 R537 分支（PR #675）续开、base main；#674 已合入。生产应用未动。

## 1. 三候选（四维对标粉笔错题本 P0/P1 下一批）源码一手

### A. 「已掌握」后再答错的回流形态 —— 成立，不改
- 写入侧 `backend/app/db.py save_mistake()`：按 `question_id`（或题干全文）查到既有行即
  `UPDATE mistakes SET times=+1, mastered=0, mastered_at=NULL, review_streak=0, next_review=now(), user_answer=COALESCE(new, old), question_id=COALESCE(old, new)`。
  → 已掌握行再答错：**回到「待复习」且今日即到期、streak 归零、错次 +1、掌握时刻清空**（R523 完成页文案「已回到今日待复习」与之同口径）。
- 读取侧 `frontend-uni/src/pages/book/book.vue`：`todo = items.filter(!m.mastered)` / `done = items.filter(m.mastered)`；行内 `错 N 次`（`times ≥ 2`）与 `已掌握` 标签互斥；「掌握」统计（近 7 天/窗口）按 `mastered && mastered_at`，`mastered_at` 已被写入侧清空 → 不会把回流行仍计为「已掌握」。
- 手动 PATCH `mastered=1`（`db.py 3479–3492`）只写 `mastered/mastered_at`，不动 `review_streak/next_review`；再「恢复复习」（`mastered=0`）后 `next_review` 保持原值（多为过去）→ 立即到期，与「恢复」语义一致。R371 答对推进路径（`db.py 2616/2622`）只取 `mastered=0` 行，已掌握行答对不再推进（有意）。
- 结论：写/读两侧口径一致，无「已掌握行再错仍留在已掌握」或「回流后不出现在到期队列」的形态。不立项。

### B. 「恢复复习」批量对 `_sz`（`question_id NULL`）行 —— 成立，不改
- 批量条走 `PATCH /api/mistakes/{id}`（`book.vue 1823`，逐 id `mastered:0`），主键为 `mistakes.id`，与 `question_id` 无关；R526 已核批量「标已掌握/删除」同路径。`_sz` 行恢复后进入 `due_reviews`（`LEFT JOIN questions` 允许 NULL qid，`_hydrate_mistake` 走快照字段）。不立项。

### C. 到期推送数与首页到期数是否同源 —— 同源、口径差异有意，不改
- 推送 `push_api.py:120` `due_n = db.due_review_count(uid)`（全部到期）；首页计划 `plan.py:87–88` `due = due_review_count(uid, created_before=cn_day_start())`、`new_today = 总到期 − due`，卡片 `sub` 由 `_review_sub(due, new_today)` 把「今日新错题」单列（R438/R440 设计：当天新错题不计入今日计划，避免计划刚完成又被打回）。
- 二者都出自同一 `due_review_count()`（`mastered=0 AND (next_review IS NULL OR next_review <= now)`），差异只在 `created_before` 切分；推送在定时时刻发出、当日新错题通常为 0，数值可对上；即便不同，首页也把 `new_today` 显示在说明里。不立项；不加第三个口径。

## 2. 到期项 / (c)（`~/r537/r538_c1.out`，11:33:41Z，VPS 只读）
- **Caddy**：reload（11:17Z）后 `zalize.com`/`www` renew/queue journal 行 **0**（跨两个 10-min 维护 tick）；`kaogong-origin` 错误 0；源站 reload 后 704 请求 5xx 0。R537「续期噪音消失」成立（6 h 窗尚未满，当前 16 min；下一轮再确认一次即关闭）。
- **簇**：09:34Z 段至 **11:33:40Z 仍在跑**（per10 389/391/413/166，11h 1359 行/390 IP）；**09-09 00:00Z 日界未到**（约 12.5 h 后）。
- 非探针非 GET 0；R534 后 `/api/mistakes/redo` 自然样本 0；容器 healthy 0 重启、5xx/Traceback 0；load 1.09 / `/` 3.8G(93%) / MemAvailable 283 MB / SwapFree 3.45 GB；DB `answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38 / explain_cache 82`，`explain_cache.qid` 非空 0，`mistakes` null qid 28，WAL `4,173,592` 同字节 → 0 写入 0 PDF 0 LLM。

## 3. 事实 / 推断 / 未知
- 事实：§1 三候选全部由源码一手 + 既有本地/生产走查（R371/R438/R440/R523/R526）支撑；§2 数值为 SSH 只读采样。
- 推断：簇归因（同 UA 对、每 IP 1 次、无 Referer）沿用 R532 起结论，未变。
- 未知：09-09 日界后簇是否接续；Caddy 6 h 窗满前是否再出该两域行（当前 0）；仍无可确认外部真人作答/复习/推送订阅样本，推送数与首页数的「同源」只有源码 + 单测，无真人对账。

## 4. 四维对标 P0/P1 存量判断
- R520 列出的 P0/P1（勾选重做 / 所选导出 / 最早排序 / 弹层栈 / fetch 网络口径）已于 R520–R534 全部上线并复采；R521–R537 每轮候选核完的结果是「成立不改」或 P3 登记（R524-1 / R528-1 / R532-1 / R535-1 / R536-1 / R536-2 / R537-1）。
- 当前**没有**新的、有一手证据的 H5 P0/P1 功能缺口可立项；剩余缺口集中在（a）小程序端整包 + 上传通道（R528-1/R536-1，资源缺口非代码）、（b）需要真人数据才能判断的 P3 项。继续按轮次「找候选→核成立」的产出在递减，建议后续轮次降频为：日界/簇/Caddy 到期项复查 + 真人首条出现即回到实修（R536-2 / R537-1 均以「真人无 qid 行 / 深链缓存命中行出现」为触发）。

## 5. 登记
- R537-1（P3）不变；R538 无新增登记。环境蓝图无需更新（本轮无安装/配置）。
