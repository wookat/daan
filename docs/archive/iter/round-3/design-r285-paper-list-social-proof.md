# R285：卷库列表（App + /tiku/papers/ SSR）外显「N 人模考 · 平均分」——与 R284 详情页口径统一

## 取证（一手证据）

- R284 已在 /tiku/papers/{pid} 详情页外显「已有 N 人模考 · 平均 X 分」（每人取最高分口径）。
- SSR 列表页 /tiku/papers/ 列表项 meta 只有「年份 地区 · N 题 · 限时」，零社会证明——同一页族内详情页与列表页口径不一致（源码 `backend/app/seo/pages.py` tiku_papers 实查）。
- App 卷库 list.vue 已外显「N 人考过」（takers，COUNT(DISTINCT uid)），但无平均分（源码实查 pmeta 行）。
- `db._list_exam_papers_base` 已有 takers 聚合（COUNT DISTINCT uid），但语义与 R284 exam_paper_social 的「每人取最高分再平均」不含 avg；粉笔卷列表公开外显「N 人已做 · 难度/平均分」。

## 方案（最小改动）

1. `db._list_exam_papers_base`：takers 聚合 SQL 改为对 per-user-best 子查询做 `COUNT(*) n, ROUND(AVG(s),1) avg`（n 与原 COUNT(DISTINCT uid) 等值，口径与 exam_paper_social 完全一致），每卷附加 `avg_score`（无数据 None）。既有 `_papers_cache` TTL 缓存不变，无新增查询轮次。
2. `/api/exam/papers`：avg_score 随 base 透出（向后兼容新增字段，无契约破坏）。
3. App list.vue pmeta：takers>0 时追加「 · 平均 {avg_score} 分」。
4. SSR /tiku/papers/ 列表项 meta：takers>0 时追加「 · 已有 {takers} 人模考 · 平均 {avg_score} 分」。
5. n=0 一律不渲染，不伪造社会证明；不暴露 UID/单次成绩/排名；mock/mini 卷仍被 kind='zhenti' 守卫。

## 验证

- 本地：ruff / pytest（新增列表页契约测试）/ pyright / lint / vitest / build:h5。
- 生产：有真实提交的卷（96、5）列表项外显且与 DB 聚合一致、无提交卷不外显；1440/375 溢出 0、console 0 error、性能预算。
