# R87：sitemap 题目分片冷路径收敛——覆盖索引 + SQL 切片 + 边缘缓存

## 取证（2026-09-01）

- 生产实测 `/sitemap-questions-8.xml` 冷请求 **71.9s**（此前 origin 日志另录得 51.7s，两次独立复现）；同轮紧随其后的 shard 1 仅 4.2s（页缓存已被前一请求拉热）。
- 代码根因（`seo.py sitemap_questions`）：每次请求 `SELECT id, updated_at FROM questions WHERE disabled=0 ORDER BY id` **全量拉 15 万+行再在 Python 切片**；R55 的 `idx_q_disabled_id(disabled,id)` 不含 `updated_at`，每行都要回主表随机读——2GB 共享宿主页缓存冷时即为灾难路径。
- 该路由不在 CF 边缘缓存清单（R45/R56/R68 只覆盖 /tiku*、/s/*、API 白名单），搜索引擎每次抓取都穿透 origin。

## 方案（三处小改）

1. **覆盖索引**：`db.py` 增 `idx_q_sitemap ON questions(disabled, id, updated_at)`——查询仅走索引零回表。
2. **SQL 切片**：`sitemap_questions` 改 `LIMIT ? OFFSET ?` 只取本分片 1 万行；分片越界判定用 `COUNT(*)`（走同索引）。响应内容逐字节不变。
3. **边缘缓存**：`[[path]].js` `isEdgeCacheable` 放行 `/sitemap` 前缀与 `/robots.txt`（GET、TTL 300s，与 /tiku 一致）。

## 非目标
- 不改 sitemap 结构/分片大小/URL；不动其他 sitemap 路由（pages/topics/years 数据量小）。

## 验收
- 分片响应与改前逐字节一致（本地对比）；
- 生产冷请求显著收敛（索引扫描零回表）+ 第二次请求 X-Edge-Cache: HIT；
- 越界分片仍 404；/robots.txt 内容不变且可缓存；主域回归正常。
