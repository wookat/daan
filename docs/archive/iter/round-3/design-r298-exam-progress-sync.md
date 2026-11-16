# R298 设计：模考未交卷进度服务端同步——跨设备续考

## 取证（源码 + 现状）

- `pkgA/exam/exam.vue` 的答题进度只写本机 `examProgress` storage（`saveProgress()`：attemptId/paper/items/picks/idx/endAt）。清缓存、换设备即丢，只能重新开考。
- 服务端 `exam_attempts` 在开考时已落 `started_at`（`start_exam_attempt`），但交卷前 `answers` 为空——服务端知道「有一场没交的模考」，却不知道答到哪。
- R287/R288 已把续考入口铺到卷库列表和首页，但仍依赖本机 storage：换设备打开卷库/首页看不到任何续考提示。
- 对照系列先例：申论收藏（R296）、申论草稿（R297）均已服务端化并接入匿名归并；模考进行中的作答是当前最后一类「纯本机、丢了重考 2 小时」的高价值瞬态资产。
- 竞品口径：粉笔模考中断后账号内跨端可继续。

## 问题定义

模考作答进度是纯本机资产：清缓存/换设备即永久丢失，且已有的续考横幅/续考卡在新设备上全部失明。

## 方案

### 后端

新表（对齐 shenlun_drafts 模式）：

```sql
CREATE TABLE IF NOT EXISTS exam_progress (
    attempt_id INTEGER PRIMARY KEY,
    uid TEXT NOT NULL,
    picks TEXT NOT NULL,      -- {qid: "A"} JSON
    idx INTEGER NOT NULL DEFAULT 0,
    updated_at REAL NOT NULL
)
-- CREATE INDEX idx_egp_uid ON exam_progress(uid)
```

- `POST /api/exam/progress`：body `{uid, attempt_id, picks, idx}`。校验 uid 非空、attempt 属于该 uid、未交卷、未超时（`started_at + duration_min*60` 未过）；picks 只收 `{int: 单字母A-D}`，超 300 键拒绝。upsert。
- `GET /api/exam/resume?uid=`：取该 uid 最近一场未交卷且未超时的 attempt（须有 progress 行），返回与 `/api/exam/start` 同构的 `paper` + `items`（抽取共享 helper `_paper_items(paper)`）+ `picks` + `idx` + `end_at_ms`；无则 `{}`。uid 相关，不进边缘缓存（allowlist 之外天然直通）。
- 交卷成功后删除 progress 行（`clear_exam_progress(attempt_id)`）。
- 匿名归并：`exam_progress` 加入 `_UID_TABLES`（uid 简单改写；attempt_id 主键全局唯一，无冲突），归并前 `_ensure_exam_progress(conn)`。

### 前端

- `exam.vue`：`saveProgress()` 保持本机即时写；追加 1.5s 去抖 `pushProgress()`（POST picks+idx，失败静默）。交卷成功路径服务端已删行，无需前端动作。
- 纯函数 `exam-progress-sync.js`：`adoptServerExamProgress(localSaved, server, now)`——本机快照仍有效（`parseExamProgress` 非 null）一律本机优先返回 null；服务端应答缺字段/已过期返回 null；否则组装 `examProgress` 同构快照（items 补 `_picked/_marked/_secs`）。
- 卷库列表 `list.vue` 与首页 `home.vue` 的 `loadResume/loadExamResume`：本机无有效进度时异步 GET `/api/exam/resume`，采用则写入本机 `examProgress` 并刷新横幅/续考卡——「继续」沿既有路径进 `exam.vue` 命中原恢复弹窗，恢复协议零改动。

### 不做

- 不同步 `_marked/_secs`（设备本地瞬态）；不改交卷/自动交卷/恢复弹窗协议；不为 uid 接口开边缘缓存。

## 验证

- 后端 pytest：roundtrip、他人 attempt 403、已交卷/超时拒收、picks 白名单与上限、resume 返回同构 payload、交卷后 resume 消失、空 uid 400。
- 前端 vitest：adoptServerExamProgress 本机优先/过期/缺字段/快照组装。
- 生产：临时 uid 开考作答→新 context 同 uid 首页/卷库看到续考卡→「继续」恢复弹窗→已答数与作答一致；交卷后服务端行删除；双视口溢出/console/性能预算；测试数据清理。
