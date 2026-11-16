# R370 热修：按卷完成页「重练本卷错题」作答不落 answer_log

## 生产证据（R369 复验中发现，uid test-r369-f7qt，容器 StartedAt 03:55:36Z 未变，offlineQueue=0）
- 按卷不计时练完 38 题 → answer_log 38 行；点完成页 R366 CTA「重练本卷错题（4 题）」再答 4 题（1 对 3 错）→ answer_log 仍 38 行。
- `/api/exam/papers` 该卷 wrong 仍为 4；`/api/paper_questions` 仍把刚答对的 236208 标 `wrong:true`——重练结果对「最近一次作答」口径完全不可见，R367「只练错题」/R368 归卷/R369 直达全部读不到重练进步。
- 回溯：R366 复验时记作「容器重建窗口丢 ~8 条」的差额，与此根因一致（当时重练轮作答 = 丢失条数）。

## 根因（代码实证）
- `practice.vue logAttempts()`：`pending = qs.filter(q => q._picked && !q._logged)`，落库前先置 `_logged=true` 防并发重复。
- `paper-continue.js paperWrongItems()`：完成页重练就地复用本会话 items，删了 `_picked/_saved/_mid/_secs/done`，**没删 `_logged`** → 重练轮每题都被 `!q._logged` 过滤，永不 POST `/api/answer_log`。
- 同类复用点核查：`redoSet`/`_redoItems`（错题重练「再来一组」）保存的是作答前的原始拷贝，无 `_logged`，不受影响；R367/R369 按卷「只练错题」走 `/api/paper_questions` 新拉 items，不受影响。仅 R366 CTA 一处。

## 修复
```js
// paperWrongItems
delete c._logged;   // 让 logAttempts 重新落库
delete c._excl;     // 上一轮排除标记不带入重练
```
零后端改动、零新表/端点。

## 验证
- vitest 新增 1 例（`_logged/_excl` 被清除，输出仅 `{id, answer}`）；全量 vitest / eslint / build:h5 需全绿。
- 生产：按卷练完 → 完成页 CTA 重练 N 题 → answer_log 增 N 行；`/api/exam/papers` wrong 随重练答对减少；`/api/paper_questions` 刚答对题 `wrong` 变 false。
