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
2. **进程内 TTL 缓存**（300s）：`list_exam_papers` 的 uid 无关部分（卷行 + 活跃题数 n + takers）与
   `exam_paper_filters()` 按 (kind,year,region) 键缓存；per-uid best/attempt 仍每请求实查（走 idx_ea_uid，31 行级）。
   卷/禁用状态低频变化，300s 陈旧可接受；容器重启后首击也只走覆盖索引冷路径。

## 验收

- 部署后 origin 闲置 ≥90s 冷请求 <2s（原 20.5s）；CF 路径首击 <2s。
- 响应 JSON 与改前逐字段一致（本地对比）；uid 维度 best_score/attempt_count 实时不缓存。
- 前端零改动、页面行为零变化。
