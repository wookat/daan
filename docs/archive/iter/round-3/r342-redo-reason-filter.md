# R342：错题重练遵循错因筛选——redo 接口补 rz 维度 + CTA 文案对齐

## 一手取证（2026-08-29，代码实查）

- R340 错题本已有 `rzFilter`（四正式错因 + 未标注），列表、chips、`?rz=` URL 全部就位；R341 模考报告错因画像可直达该筛选。
- 但「错题重练」CTA `redoAll()`（book.vue）只透传 `kpFilter`/`filterMod`，`rzFilter` 与 `srcFilter` 均被无声忽略：
  - 用户按「概念不清」筛出 3 道错题 → 点「错题重练」→ 实际拉取的是全量待掌握错题（最多 10 题），与所见列表不一致；
  - 卡片文案只在 `kpFilter` 时说「只重练当前筛选题型」，错因筛选态下文案与行为双重误导。
- 后端 `GET /api/mistakes/redo`（study_api.py）与 `db.mistakes_redo_questions` 无错因维度。
- 竞品：粉笔错题本按错因筛选后重练遵循当前筛选。

## 用户问题

「报告错因画像 → 错题本按错因筛选 → 重练该错因」是 R340/R341 建立的核心行动链路，最后一跳（重练）不遵循筛选，链路断在临门一脚。

## 方案

最小收口，一处后端参数 + 一处前端透传 + 文案对齐：

### 后端

- `api_mistakes_redo` 增加 `rz: str | None = None`：
  - 白名单 `{粗心大意, 概念不清, 方法不会, 纯蒙的, 未标注}`，非法值 400（fail-closed，不允许静默重练错误集合）；
  - 透传 `db.mistakes_redo_questions(reason=...)`。
- `mistakes_redo_questions` 增加 `reason` 参数：
  - `reason == '未标注'` → `AND (error_reason IS NULL OR error_reason='')`；
  - 其他合法值 → `AND error_reason=?`；
  - 缺省 None 行为零变化。

### 前端（book.vue redoAll）

- `rzFilter` 非空时追加 `&rz=` + encodeURIComponent(rzFilter)（与既有 kpFilter/module 参数正交叠加）；
- 卡片标题后缀与说明文案覆盖错因筛选态（如「错题重练 · 概念不清」/「只重练当前筛选错因的待掌握错题（最多 10 题）」）。

### 明确不做

- srcFilter（练习/模考来源）透传不在本轮（redo 接口无 source 维度，单独取证后再定，如实披露）；
- 不改 redoSet 协议、刷题页消费逻辑、排序语义；
- 不新增表/埋点。

## 验收

- pytest：rz 四正式错因过滤、未标注桶（NULL 与 ''）、非法 rz 400、缺省行为不变；
- 前端 lint/vitest/build 全绿；
- 生产：一次性 uid 造 2 种错因错题 → 按错因筛选 → 重练集合只含该错因题；未标注桶重练；非法 rz curl 400；文案对齐；375/1440；console 0 error；0 次 /api/explain；测试 uid 全库清理 + 保护 uid 快照一致。
