# 相似度引擎 · 索引构建性能报告

## 方案

- **算法**：字符 3-gram → 64-bit simhash（blake2b 逐 gram 哈希，按位投票）；候选检索用 4×16bit 分带倒排（SQLite 索引列 b0..b3），命中候选后用 n-gram Jaccard 精排/验证。纯本地计算，无外部 API。
- **存储**：SQLite 辅助表 `question_simhash`（qid, simhash, b0..b3）、`dup_clusters`（cluster_id, qid, similarity, status）、`sim_meta`。
- **定簇**：band 桶内两两比较（桶上限 500 防倾斜），simhash 先粗滤，Jaccard ≥ 0.72 判定近重复，并查集合并成簇；跨模块不设限制。
- **质量分**：0–100 规则综合（题干/选项完整性 40 + 解析长度与结构 40 + 来源可信度与用户反馈 20），写回 `questions.quality_score`。

## 性能实测（13.6 万题合成库，单核 Python，本地 SQLite）

| 管线 | 规模 | 耗时 |
|---|---|---|
| 质量打分 `scripts/score_quality.py` | 136,000 题 | **2.2 s** |
| simhash 索引构建 `scripts/build_similarity_index.py` | 136,000 题 | **86 s**（约 1,580 题/s） |
| 重复簇构建（同脚本） | 136,000 题 → 13,747 簇 / 227,119 近重对 | **9.8 s**（256,431 次精排比较） |
| `/api/admin/similar_questions` 单次查询 | top-10 | < 100 ms |

> 合成库由本地 9,217 题真实种子扰动扩增（30% 轻扰动近重复 + 70% 重扰动），近重复密度显著高于生产库，簇构建耗时为悲观上界。全库全量重建（打分+索引+定簇）合计 **< 2 分钟**，可在生产容器内直接跑或加定时任务。

真实 9,217 题库：索引 5.1 s，定簇 0.3 s，产出 33 簇 / 74 题（含选项字母被打乱、答案标注不一致的真重复，已被「答案数 > 1 种」标红提示）。

## 运行方式

```bash
DB_PATH=/data/data.db python3 scripts/score_quality.py
DB_PATH=/data/data.db python3 scripts/build_similarity_index.py   # 可加 --index-only / --clusters-only
```

增量说明：索引为全量重建（分钟级，无需增量）；`dup_clusters` 重建时保留已处理（resolved/ignored）簇的状态，包含已处理题的新簇不再重复产出。
