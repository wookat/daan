# R354：复习完成小结——庆祝卡升级为本轮复习效果小结

## 取证（生产 + 代码实查，2026-08-29）

- 生产复习流跑通一轮后，庆祝卡只有一句「N 道到期错题全部复习完成，遗忘曲线稳住了」（book.vue celebrateN，仅计到期题数）。
- 本轮**首答对/首答错、答错重出后是否纠正、加练同类题成绩**全部有数据语义（record() 已判分、_requeued 重出、_extra 加练、R348 起加练答错入库），但一概不外显——用户复习完不知道这轮效果如何，「复习→反馈」闭环缺最后一块（粉笔复习完成有正确率小结）。
- 代码证据：nextReview() else 分支 `celebrateN = rItems.filter(q => !q._extra && !q._requeued).length` 后直接 exitReview()，逐题判分结果（record 的 correct）未在 item 上留痕，轮末不可回算。

## 方案（纯前端，零后端/零契约/零新埋点）

1. 新增 fail-closed 纯函数 `review-summary.js`：
   - `reviewSummary(rItems)`：非数组/空 → null；否则统计
     `due/dueRight/dueWrong`（!_extra && !_requeued，按 `_res===true/false` 首答判分）、
     `corrected/uncorrected`（_requeued 且 _res===true/false）、
     `extra/extraRight/extraWrong`（_extra）、`pct`（due>0 时 round(dueRight/due*100)，未答题不计入分母分子）。
2. book.vue `record(correct)` 开头补 `this.cur._res = correct`（answered 守卫保证每 item 实例只写一次）；requeue 复制时剥离 `_res`（否则复制体继承首答 false 会污染「纠正」统计）。`_res` 随 reviewSnap 逐 item 字段自然持久化（buildReviewSnap 只剥 open/html），中断恢复后小结口径不丢。
3. nextReview() 轮末 `this.rSummary = reviewSummary(this.rItems)`；庆祝卡 subtitle 升级：
   - 到期行：「到期 N 道 · 首答对 X 道（P%）」；
   - dueWrong>0 补「答错 Y 道已重出巩固 · 纠正 Z 道」；
   - extra>0 补「加练同类题 M 道 · 答对 K 道」；
   - rSummary 为 null 时 fail-closed 回退原单句文案。
4. R351/R352/R353 快照/恢复/首页卡语义零改动；celebrate 埋点 review_done_celebrate 不变。

## 边界

- 中断恢复跨版本旧快照无 _res：对应题不计入分子分母（统计口径如实缩小），不报错。
- 自评题（selfJudge）同口径计入。

## 验证

- vitest：reviewSummary 空/非法/混合（due 对错、requeue 纠正/未纠正、extra 对错、无 _res 旧条目）。
- 本地 lint/vitest/build 全绿；部署后 testing agent 生产实测：一轮 2 对期 + 1 错（触发 requeue+加练）跑完，庆祝卡出小结逐行核对；旧路径（全对）单行退化正确；R353 首页卡回归。
