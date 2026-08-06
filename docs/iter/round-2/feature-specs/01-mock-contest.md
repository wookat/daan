# Spec 01 · 定期模考大赛（同场模考）

对应轮 1 P0-1。竞品参照：粉笔模考大赛（考季系列化、错过 1 小时后转普通卷无排名、报告中心按季聚合）、华图万人模考（秒出分、百分位、用时分析、与目标分差）。

## 1. 产品定义

- 每周六 9:00–24:00（东八区）开放一场「同场模考」，全站同卷。
- 流程：**报名（可选）→ 开赛提醒 → 窗口内作答交卷 → 秒出分 + 实时暂列 → 窗口关闭后冻结定榜 → 赛后报告**。
- 窗口外（次日起）该卷转入普通真题卷库可自由作答，但不计排名（粉笔同口径，页面明示）。
- 用户量小阶段的排名口径：榜单只含本场窗口内交卷者；报告的分布对比额外叠加「历史同卷成绩池」作参考线并明示口径，避免「全场 3 人」尴尬（复用 `api_exam_rank` 的同卷聚合思路）。

## 2. 页面结构（H5 `frontend-uni/`）

### 2.1 模考大赛首页 `pkgA/exam/contest.vue`（新）

```
┌ 顶部：本期场次卡 ───────────────────┐
│ 第 N 期 · 2026 国考季               │
│ 状态机：未开赛(倒计时+报名按钮)      │
│        进行中(剩余时间+进入考试)     │
│        已交卷(分数+查看报告)         │
│        已结束(查看定榜/试卷回顾)     │
│ 已报名 xx 人 / 已交卷 xx 人          │
├ 我的往期：历次成绩列表(分数/排名/报告链)┤
├ 规则说明(折叠)：窗口口径/排名口径     │
└ 入口：首页「更多练习」新增「模考大赛」┘
```

### 2.2 作答页

复用现有整卷作答页（倒计时/答题卡/中途恢复/交卷），launch 参数加 `event_id`；交卷调现有 exam submit 后追加 event 归档。

### 2.3 赛后报告页 `pkgA/exam/contest-report.vue`（新，含轮 2 报告深化要点）

区块自上而下：
1. 总分卡：得分、暂列/定榜名次与百分位、全场平均、分布直方图（复用 rank-card 组件扩展）。
2. **分差卡**：与画像 `target_score` 差 X 分；与全场前 25% 分差 Y 分（可行动分差，华图口径）。
3. 模块表：每模块 正确率 / **用时 vs 建议用时 vs 全场均值**（`answer_log.secs` 与交卷答案的 per_module 已有数据）。
4. 强弱项：本场错题按 tag3 聚合 Top5 薄弱考点，每项一键深链定向练习（`/pages/practice/practice?tag3=...`）。
5. 历次曲线：我的历场模考总分折线（同系列聚合）。
6. 行动区：「错题已入错题本」「同考点强化 5 题」（衔接 spec-03）。

## 3. 数据模型（`db.py` 惯例，`_ensure_mock_event_tables()`）

```sql
CREATE TABLE IF NOT EXISTS mock_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,              -- 「第 12 期 · 2026 国考季」
    series TEXT,                      -- 考季/系列 key，报告中心聚合用
    paper_id INTEGER NOT NULL,        -- 关联 exam_papers
    open_at REAL NOT NULL,            -- 窗口开始
    close_at REAL NOT NULL,           -- 窗口结束（冻结定榜时刻）
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS mock_event_entries (
    event_id INTEGER NOT NULL,
    uid TEXT NOT NULL,
    registered_at REAL,               -- 报名时间（可空：未报名直接参赛）
    attempt_id INTEGER,               -- 关联 exam_attempts（交卷后回填）
    score REAL,                       -- 冗余，定榜排序用
    rank INTEGER,                     -- 冻结定榜后写入；窗口内为 NULL（实时算暂列）
    PRIMARY KEY (event_id, uid)
);
CREATE INDEX IF NOT EXISTS idx_mee_event ON mock_event_entries(event_id, score);
```

- 复用 `exam_papers` / `exam_attempts`，不改其 schema；event 只是「场次 + 榜单」薄层。
- 场次创建：管理后台新增「模考场次」管理（选卷/定窗口）；另加每周定时兜底（现有后台任务线程）自动从真题卷库按轮换规则建下一场，保证无人运营也每周有场次。
- 定榜：`close_at` 后首次访问榜单接口时惰性冻结（一次事务按 score DESC 写 rank，无需 cron）。

## 4. API 草案（新文件 `backend/app/mock_event.py`，独立 router）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/mock/events?uid=` | 场次列表：当前/下一场 + 我的往期（含我的分数/名次） |
| GET | `/api/mock/events/{event_id}?uid=` | 场次详情 + 我的状态（未报名/已报名/已交卷）+ 报名与交卷人数 |
| POST | `/api/mock/events/{event_id}/register` | body `{uid}`；报名（幂等 upsert entry） |
| POST | `/api/mock/events/{event_id}/enter` | body `{uid}`；窗口内校验后返回 `paper_id`，前端走现有整卷作答；交卷后前端回调 attach |
| POST | `/api/mock/events/{event_id}/attach` | body `{uid, attempt_id}`；把已交卷 attempt 归档进场次（校验 attempt 属于本人、paper 匹配、submitted_at 在窗口内；每 uid 只记首次交卷） |
| GET | `/api/mock/events/{event_id}/rank?uid=` | 窗口内：实时暂列（COUNT 比我高的 +1）；窗口后：触发惰性定榜并返回冻结名次、百分位、分布、平均分、历史成绩池参考线 |
| GET | `/api/mock/events/{event_id}/report?uid=` | 赛后报告聚合（§2.3 全部区块的数据） |
| 管理 | `POST/DELETE /api/admin/mock/events` | 建/删场次（复用 admin 鉴权） |

提醒：报名成功后复用现有学习提醒（H5 Notification / Flutter 本地通知）预约开赛前 30 分钟提醒；小程序订阅消息仍受模板 ID 缺口限制（见 parity-matrix §10），入口按现状隐藏。

## 5. 验收标准

1. 周六窗口内：报名→进入→交卷→立即看到分数与「实时暂列第 x」；窗口结束后名次冻结不再变动，页面标注「定榜」。
2. 窗口外访问场次：显示「已结束」，可看定榜与试卷回顾；此时作答该卷走普通模考路径，不进入榜单。
3. 同一 uid 窗口内重复交卷只计首次；attach 传他人 attempt / 窗口外 attempt 一律 4xx。
4. 报告页 6 个区块齐全；无画像 `target_score` 时分差卡降级隐藏目标分行；每个薄弱考点深链能正确带 tag3 进入练习页。
5. 无管理员建场时，定时兜底保证下周六自动有场次（标题含期数自增）。
6. 参赛 <10 人时榜单页明示「本场样本较小，参考历史成绩池」且直方图叠加历史池。
7. `docs/parity-matrix.md` 增补三端行；小程序条件编译通过 `npm run build:mp-weixin`。
