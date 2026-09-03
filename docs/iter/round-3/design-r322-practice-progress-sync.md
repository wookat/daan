# R322 设计论证：普通刷题「未完成练习」跨设备同步

## 现状取证（一手证据）

- `frontend-uni/src/pages/practice/practice.vue` `saveSession()`（L1817）：未完成练习组仅写本机 `uni.setStorageSync('pendingSession', {t, items, idx, right, streak, bestStreak, lastModule, lastSubmodule})`；`tryResume()`（L1834）只读本机存储，24h 过期。
- 后端全局搜索：不存在任何普通练习进度服务端协议（`practice_progress`/`/api/practice/progress` 均无）。R298/R317/R318/R320 已为「未交卷模考」建立完整的 exam_progress 服务端同步（picks/idx/marks/secs/excl），普通刷题是唯一仍纯本机的做题过程态。
- 用户可感知缺口：手机上刷到一半的一组题，换电脑（或清缓存/换浏览器）后「继续上次练习」完全丢失。粉笔练习进度按账号云同步；本站画像/每日目标/练习偏好（R299/R300）、申论草稿（R297）均已服务端化，普通练习快照是最后一块。

## 方案（复用 R298 模式，最小增量）

### 后端（backend/app/study_api.py + db.py）

- 新表 `practice_progress`（uid 单行 UPSERT）：`uid TEXT PRIMARY KEY, qids TEXT(JSON int 数组), picks TEXT(JSON {qid:字母}), excl TEXT(JSON {qid:[字母]}), idx INT, right INT, streak INT, best_streak INT, module TEXT, submodule TEXT, updated_at REAL`。幂等 `CREATE TABLE IF NOT EXISTS`，与 `_ensure_exam_progress` 同构。
- `POST /api/practice/progress`：uid 必填（≤64）；`rl(request,"ppro",120,3600,uid)`（对齐 R189 匿名可写端点全接限速）；`qids` 为空数组 → 删除该 uid 行（完成/放弃清理）；否则 `qids` 严格校验（list ≤100、逐项正 int 拒 bool）；`picks`/`excl` 校验与 exam_progress 同款（字母白名单 A–D、excl 去重保序 ≤4）、且 key 必须 ∈ qids；idx 0..len-1；right/streak/best_streak 0..len 界内 int；module/submodule str ≤64。任何非法 → 400 fail-closed。
- `GET /api/practice/resume?uid=`：无行或 `updated_at` 超 24h → `{}`（与本机口径一致）；否则 `db.questions_by_ids(qids)` 重建题目全量 payload 并按 qids 原序回排（`questions_by_ids` 会按 module 重排，API 层用 dict 回排；下架题跳过），全部下架 → `{}`。应答 `{items, picks, excl, idx, right, streak, best_streak, module, submodule, t}`。仅本人 uid 可查自己进度，不进公开 SSR/边缘缓存（带 uid 不在缓存白名单）。

### 前端（practice.vue）

- `saveSession()` 末尾去抖 1.5s `pushPracticeProgress()`（同 exam.vue `_progTimer` 模式）：上送 `{uid: anonUid(), qids, picks, excl, idx, right, streak, best_streak, module, submodule}`；失败静默。
- 完成/放弃路径（`submitResult()`、`quit()`、全部作答时的 saveSession 清理分支）：在 `removeStorageSync('pendingSession')` 处同步 POST `qids: []` 清服务端行（失败静默，24h TTL 兜底）。
- `tryResume()`：本机快照优先（不变）；本机无/过期时异步拉 `/api/practice/resume`，有效则走同一「继续上次练习？」弹窗——items 应用 `_picked`/`_excl`、`_logged=true`（已作答题设备 A 已落 answer_log，防重复记账）、恢复 idx/right/streak/bestStreak/lastModule/lastSubmodule。确认「不用了」时同时清服务端行。

### 明确不做

- 不同步普通练习逐题用时 `_secs`（练习判分/统计在作答瞬间已按题落 answer_log，跨设备恢复无判分意义；如实挂观察项）。
- 不改模考 exam_progress 协议、不改交卷 payload、不改判分/计时/错题/统计语义。
- `beiMode`/`examMode`/时政组不入同步（saveSession 原有守卫已排除）。

## 验证计划

- pytest：progress 保存/roundtrip/清空/24h 过期/非法输入（qids 非 list、bool、越界 idx、picks 非白名单字母、excl 超长、key 不在 qids）逐项 400；resume 下架题跳过与原序回排。
- vitest：前端收集函数（items→qids/picks/excl）纯函数化测试。
- 生产：临时 uid 设备 A（1440）作答 2 题+排除，实抓去抖 POST；设备 B（375 全新隔离 context 同 uid）无本机快照 → 弹「继续上次练习」→ 恢复 picks/excl/idx/right 一致；完成一组后 resume={}；保护 uid 不触碰，测试数据验后清理。
