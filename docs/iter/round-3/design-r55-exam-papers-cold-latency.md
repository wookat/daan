# R55：/api/exam/papers 冷路径 5–20s 长尾收敛

## 生产取证（2026-08）

- `for i in 1..5: curl /api/exam/papers` → 首次 8.48s，后续 0.26–0.42s；闲置 60s 后复测首次 5.3s。
- 绕过 CF 直打 origin，闲置 90s 后冷请求 **20.5s**、紧随其后的热请求 0.78s → 长尾在 origin 侧，与边缘无关。
- 生产库实查：`questions` 156,792 行、`exam_papers` 162 卷、卷内 qids 合计 **12,629**；宿主机 2GB 共享（load 12.5、free 106MB），SQLite 页缓存被其他容器持续挤出。
- 根因：`list_exam_papers` 对全部卷的 qids 做 `SELECT id FROM questions WHERE disabled=0 AND id IN (...)`，
  `EXPLAIN QUERY PLAN` 显示走 `SEARCH questions USING INTEGER PRIMARY KEY (rowid=?)`——每个 id 一次主表随机页读，
  15.6 万行主表（含题干/解析长文本）页分散，冷缓存下 1.2 万次随机 IO ≈ 5–20s。
- 关联既有观察：R13 走查记录的「年份 chip 首次点击偶发 /api/exam/papers ERR_FAILED、重试即成功」与此同源（首击超时）。

## 方案（零 schema 变更主表、零接口形状变更）

1. **覆盖索引**：`CREATE INDEX IF NOT EXISTS idx_q_disabled_id ON questions(disabled, id)`。
   本地实证计划变为 `SEARCH questions USING COVERING INDEX idx_q_disabled_id`——只读紧凑索引页（几百 KB 级），
   不再触碰主表大页，冷缓存下 IO 降 2–3 个数量级。
2. **进程内 TTL 缓存 + stale-while-revalidate**（300s）：`list_exam_papers` 的 uid 无关部分
   （卷行 + 活跃题数 n + takers）按 (kind,year,region) 键缓存；过期后返回旧值并起后台线程刷新，
   请求路径永不同步重算；建卷（upsert/迷你模考）时主动 clear 缓存。per-uid best/attempt 仍每请求实查。
   卷/禁用状态低频变化，300s 陈旧可接受；容器重启后首击由部署脚本预热覆盖。
   （`exam_paper_filters()` 实测两条 162 行 GROUP BY，非瓶颈，不缓存。）

## 验收（2026-08-31 实测）

- 生产查询计划：`SEARCH questions USING COVERING INDEX idx_q_disabled_id`，容器内实跑全量活跃题查询 **0.051s**（原冷路径 5–20s 的主成本）。
- 缓存命中/SWR 后 `/api/exam/papers` origin 0.6–0.8s、CF 0.7–1.1s；TTL 过期首击返回旧值+后台刷新，后续 0.8s。
- 响应 JSON 逐字段一致（本地 seed 对比 + 生产 keys 校验，162 卷、uid 维度 best_score/attempt_count 实时）。
- 真题卷库页生产走查：卡片/年份/地区筛选全渲染、console 0 error、无水平溢出；前端零改动。
- **边界如实记录**：origin 闲置 ≥60s 后任意端点首击仍有 6–14s 通用长尾（/api/stats 13.9s、/tiku/ 6.2s 同样出现，
  与本端点计算无关）——为 2GB 共享宿主 load 9–14、free ~90MB 的机器级 IO/内存竞争，属既有「主机资源隔离」架构待办，非本轮范围。
