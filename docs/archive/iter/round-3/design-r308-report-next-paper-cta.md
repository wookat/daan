# R308 设计：模考报告「继续模考：下一卷推荐」CTA

## 取证（2026-08-29，生产 + 代码实查）
- 报告页尾部动作只有「返回卷库」「再考一次」（report.vue btns 区），复盘完成后的下一步只有「重复本卷」一条路；R307 薄弱模块 CTA 只覆盖「有明确薄弱模块」的场景。
- 粉笔模考报告尾部有「继续做卷」类推荐位，把复盘动能直接转化为下一次模考。
- 数据已齐备，零后端改动：
  - `GET /api/exam/papers?kind=zhenti&uid=`：卷列表（含 takers / avg_score 社会证明，n≥5 过滤）；
  - `GET /api/exam/attempts?uid=`（不带 paper_id）：本人已交卷 attempts（含 paper_id）；
  - report.paper 含 id / year / region。
- R286 已有卷库 `?pid=` 高亮定位深链；exam.vue `?paper_id=` 会即建 attempt 起倒计时（突袭），不作为落点。

## 问题
复盘结束后「考下一卷」需自行回卷库找卷，转化链路断点；同 region 未考过的卷（最相关）无任何推荐。

## 方案（纯前端，零 API/埋点/契约变化）
1. 纯函数 `frontend-uni/src/exam-next.js`：
   `nextPaper(papers, attempts, cur)`：
   - papers 非数组 / cur 无 id → null（fail-closed）；
   - 候选：id 为正整数、title 非空、非本卷、且不在 attempts 的 paper_id 集合中；
   - 排序：同 region 优先 → year 降序（缺 year 排后）→ takers 降序 → id 降序；
   - 返回 `{id, title, year, region, takers, avgScore}`，无候选返回 null。
2. report.vue：加载报告成功后并行拉 papers + attempts（任一失败静默、CTA 不渲染不伪造）；btns 区上方渲染单个 CTA「继续模考：{title}」，副文案 takers>0 时外显「已有 N 人模考 · 平均 X 分」真实社会证明，否则「换一卷继续练手感」；role=button/tabindex=0/Enter；点击 → `/pkgA/exam/list?pid={id}`（R286 高亮定位，不突袭开考）。

## 验证
- vitest：null/排序/去已考/同 region 优先/缺 year/社会证明字段透传/输入不可变。
- 生产：真实种子（同 region 未考卷存在）验证 CTA 文案与落点高亮；全卷考过时不渲染（如可构造）；1440/375 双视口、console、溢出、性能预算；测试数据清理 leftover 0。
