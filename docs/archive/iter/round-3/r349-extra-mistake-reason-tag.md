# R349：加练同类题答错入库后支持错因自评

## 取证（代码一手证据）

- R348 起加练同类题（`_extra`）答错会经 `saveExtraWrong()` 复用 `POST /api/mistakes` 入错题本，但入库后 `error_reason` 恒为 NULL。
- `book.vue` 复习流错因自评 chips 行的渲染条件是 `v-if="!wasCorrect && !cur._extra"`——加练题答错后没有任何打标入口。
- 后果：R348 新沉淀的错题全部落入「未标注」桶，稀释 R340 错因筛选、R341 本卷错因画像、R342 重练遵循错因这条已闭环的错因体系；用户对刚暴露的薄弱点记忆最新鲜，此刻却无法打标，事后只能去列表逐条补标（粉笔错题本收录即可标错因）。
- 契约已就位：`POST /api/mistakes` 返回 `{id}`；`PATCH /api/mistakes/{mid}` 支持 `error_reason`（uid 隔离）；`review_reason_tag` 埋点已在白名单（R347）。零后端改动。

## 方案（纯前端零后端/零契约/零新埋点）

1. `review-similar.js` 新增 fail-closed 纯函数 `reviewReasonMid(cur)`：
   - 非 `_extra` 条目 → 返回 `cur.id`（既有语义不变）；
   - `_extra` 条目 → `_mid` 为正整数时返回 `_mid`，否则返回 `null`（未入库/入库失败不可打标）。
2. `saveExtraWrong()` 入库成功后记录 `item._mid = res.id`。
3. chips 行渲染条件改为 `!wasCorrect && reasonMid`（computed 包一层）——非加练行为零变化；加练题仅在入库成功后出现 chips。
4. `setReviewReason(rz)` 的 PATCH 目标改用 `reviewReasonMid(this.cur)`，为 null 时 no-op。

## 明确不做

- 不做加练题答对时的打标（无错题实体）；
- 不改 SRS/requeue/埋点语义；
- 不做列表批量补标。

## 验证计划

- vitest：`reviewReasonMid` 全分支（普通条目、_extra+_mid、_extra 无 _mid、非法 _mid fail-closed）。
- 本地 lint/vitest/build 全绿。
- 生产（testing agent，隔离 uid）：加练题答错入库后 chips 出现→点击 PATCH 200 + `review_reason_tag` 200→错题列表该题错因已标；入库前/答对反例无 chips；普通复习题打标回归；0 次 /api/explain；测试数据全清、保护 uid 快照一致。
