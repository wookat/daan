# R403：专题/年份列表页进程内缓存接版本键 + sitemap lastmod 被早期 ISO 文本 updated_at 盖住（50/157 在架考点停在 2026-08-09）

日期 2026-09-05/06（UTC）。分支续 R400–R402b（base=main）。生产 rev 上线前 `dd13df6`。

## 1. 起点

R402b 只修了 `/tiku/q/{id}`。R402 汇报「下一步」第一条：其他带 `lru_cache` 的 SSR 渲染器（专题/年份/卷页）是否同样读会被脚本改写的字段。

## 2. 代码事实（`backend/app/seo/pages.py`）

| 渲染器 | 缓存键 | 读的会变的字段 | 谁会在活进程期间改它 |
|---|---|---|---|
| `_render_question(qid, version)` | R402b 已接 `updated_at` | question/options/answer/explanation/hs… | 隔离/还原/清洗脚本、管理台编辑 |
| `_render_topic(code, page)` | **只有 code+page** | 该考点在架题的 id 集合与顺序、题干前 80 字、年份/地区/真题标签、`total`、同类考点计数 | 管理台一键下架（`resolve_dup_cluster` 历史 9,262 簇）、隔离脚本把行置 `disabled=1`、题干清洗 |
| `_render_year(year, module, page)` | **只有 year+module+page** | 同上按年份 | 同上 |
| shenlun 三个渲染器 | 无 `lru_cache` | — | — |

两个列表页的 `total` 来自 `db.tag3_counts()` / `db.year_module_counts()`（5 分钟 TTL），但页面 HTML 一旦进 `lru_cache` 就与 TTL 无关——进程不重启就不会重渲染，最大 1024 + 512 页。

## 3. 生产取证（只读 `file:/data/data.db?mode=ro`，脚本 `~/r403_vps.sh`、`~/r403_vps2.sh`）

- 容器 `deploy-kaogong-1` 自 09-05 16:28:01Z 启动，0 重启；启动后日志 5xx / Traceback / slow-req 0；`quick_check ok`；磁盘 89%（5.6 G 空闲）。
- **容器启动后 questions 真实写入 0 行**（`updated_at > 启动时刻` 命中的 1,255 行全是 TEXT 类型的 2026-08-09 ISO 字串，SQLite 里 TEXT 恒大于 REAL 才被比出来）→ **当前生产没有陈旧的专题/年份页**，本轮是前瞻修复，不是事故修复。
- 但活进程期间写库是常态：09-03 18Z 5,977 行（w3c hs 元句剥离，含 3,736 行 disabled）、09-04 10Z 4,438 行、09-04 17Z 7,949 行、09-05 四批 = R400/R401/R402 隔离（每批都含 disabled 行 17–252）。下一轮隔离/下架只写库不重启时，列表页就会继续列出已下架题（点进去 404）并显示旧 `total`。
- `updated_at` 类型分布：NULL 130,716 / REAL 24,821 / **TEXT 1,255**（`2026-08-09T17:38:50` … `2026-08-09T18:23:19Z`，其中在架 1,246）。
- **副产物（比缓存更实的问题）**：`tag3_lastmod()` / `year_module_counts()` 用 `MAX(updated_at)` 给 sitemap 出 `<lastmod>`；TEXT 恒大于 REAL → **157 个在架考点里 50 个（32%）的 sitemap lastmod 一直停在 2026-08-09**，而这 50 个考点用归一化 MAX 实算最新写入全部落在 09-04/09-05（例：SL-GC-01 2,443 题、SL-JH-01 1,945 题、CS-DL-02 1,200 题——正是 R400–R402 隔离集中的数量关系考点）。也就是说过去一周 sitemap 一直在告诉引擎「这些专题没变」。年份维度 102 组无 TEXT 问题（6 组 MAX 为 NULL）。
- `strftime('%s','2026-08-09T18:23:19Z')` SQLite 可解析（带 Z 与不带 Z 均返回 epoch）。归一化 MAX 在生产库实测：考点聚合 0.019 s（原 0.014 s）、年份聚合 0.003 s（不变），成本可忽略。

## 4. 改动

1. `pages.py`：`_render_topic(code, page, version)` / `_render_year(year, module, page, version)`，`version` 分别 = `(tag3_counts[code], tag3_lastmod[code])` / `year_module_counts[(year, module)]`（后者本就是 `(n, max_updated_at)`）。两者都取自已有的 5 分钟 TTL 缓存，**不加任何查询**；陈旧上界从「进程生命周期」降到 5 分钟，与 sitemap lastmod 同源、与边缘 `max-age=300` 同量级。不做每请求 `MAX(updated_at)` 实查（大考点几千行、无覆盖索引）。
2. `db.py`：`_UPDATED_AT_EPOCH = CASE WHEN typeof(updated_at)='text' THEN CAST(strftime('%s', updated_at) AS REAL) ELSE updated_at END`，`tag3_lastmod()` 与 `year_module_counts()` 的 MAX 改用它。**不改写生产数据**（1,255 行 TEXT 原样保留），只在聚合时归一。
3. 单测 `tests/test_seo_list_cache_version.py` 5 条：专题页/年份页下架题在 TTL 缓存刷新后消失（并断言 TTL 内仍旧页——如实锁住上界）、未变时命中缓存、TEXT+REAL 混存取到今天、仅 TEXT 取到 2026-08-09。

## 5. 不做

- 不给每个 `UPDATE questions` 路径补 `updated_at`（`quality_score` 重算、UNKNOWN 分类 `disabled=2` 等不影响列表页字段或只对新导入行生效）；`_topic_version` 同时带 `count`，`disabled` 翻转即使不刷 `updated_at` 也会换键。
- 不清 `lru_cache`、不加 admin 清缓存接口（TTL 上界 5 分钟已够，且与 sitemap 一致）。
- 不把 1,255 行 TEXT `updated_at` 迁成 REAL（要写生产库，本轮无需求；归一化聚合已覆盖读侧）。
- 不在生产为验证而写库；活进程内失效仍待下次真实数据治理后补「访问→写库→再访问」。

## 6. 验证

- 本地：pytest 424（+5，`test_answer_log_uses_client_ts_and_falls_back` 既有时区边界失败与本轮无关）/ ruff / pyright 0。
- 生产：见 handoff R403 段与 PR #619 评论。
