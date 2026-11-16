# R284 设计：真题卷 SSR 详情页补「已考人数 · 平均分」社会证明

## 取证（一手证据）

- R283 上线后，模考报告的「邀考友挑战本卷」分享文案落点是 `/tiku/papers/{pid}`（生产实测剪贴板落点 `/tiku/papers/5`）。
- 生产实查 `backend/app/seo/pages.py::tiku_paper_detail`：页面 meta 行只有 `年份 地区 · 共 N 题 · 限时 M 分钟`，零社会证明；被挑战者点开链接看不到「多少人考过、平均多少分」，与分享文案里的「答对 x/y 题，敢来挑战吗」无法形成对比锚点。
- 数据已存在：`insights.py::api_exam_rank` 已用 `exam_attempts` 按 `paper_id` 聚合每人最高分算 `total/avg`（App 内 rank-card 已外显），SSR 侧未复用。
- 竞品对照：粉笔真题卷列表/详情外显「N 人已做 · 平均 x 分/难度」作为核心转化元素。

## 方案（最小改动）

- `db.py` 新增 `exam_paper_social(pid)`：同卷每人取最高分（与 rank 口径一致），返回 `{"n", "avg"}`；无人考过 n=0。
- `seo/pages.py::tiku_paper_detail`：meta 行在题数后追加 ` · 已有 {n} 人模考 · 平均 {avg} 分`（仅 n>0 时；不显示假数据）；JSON-LD description 同步该口径。
- 不改 App 前端、不改 API 契约、不新增路由/页面；SSR 页族已有 300s 边缘缓存，聚合查询频率无忧。

## 边界

- mock/mini 卷本就 404，不涉及。
- n=0 不渲染（不伪造社会证明）。
- 分数为百分制 score 字段，与 App rank-card 口径一致。

## 验证

- 本地 ruff/pytest/pyright 全绿，新增 pytest 覆盖 n=0 不渲染与 n>0 渲染。
- 生产部署后 `/tiku/papers/5` 实测出现真实人数/平均分；无人考过的卷不出现该段；1440/375 双视口 + 性能预算复验。
