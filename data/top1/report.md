# TOP1 绿色题源全量抓取 → 清洗去重 → 交付报告

## 1. 来源与合规

- 来源（调研报告 TOP1，公开 GitHub 仓库，匿名 `git clone --depth 1`，无 robots 限制、无登录墙、无反爬，未绕过任何防护）：
  - https://github.com/SGHCN0762/civil-country-exam-xingce-json （国考行测 2000–2026）
  - https://github.com/SGHCN0762/civil-provice-exam-xingce-json （省考行测 2004–2025）
- 字段统一为：`module/submodule/question/options/answer/explanation/source/year/region`。
- 脚本：`scripts/top1/fetch_top1.py`（抓取+初筛）、`scripts/top1/clean_top1.py`（清洗+去重+归一）、`scripts/top1/sample_check.py`（分层抽样+审计汇总）。

## 2. 漏斗：原始量 → 逐道门禁淘汰 → 成品量

### 2.1 抓取阶段（71,779 → 12,665）

| 门禁 | 淘汰量 |
|---|---|
| 无答案/答案非 A-D（源 PDF 转 JSON 大量题目未附答案） | 42,554 |
| 解析与题目错位/缺失 | 10,255 |
| 无法判定模块 | 3,342 |
| 资料分析缺图表/材料（保守全弃） | 1,690 |
| 选项不全 | 705 |
| 依赖图片（图形推理等） | 425 |
| 题干为空 | 136 |
| 乱码 | 7 |
| **保留（top1_raw.jsonl）** | **12,665** |

### 2.2 清洗阶段（12,665 → 2,963）

参照库题干数 127,776（tag3 全库 untagged_*.jsonl + knowledge/questions_bank.jsonl）。

| 门禁 | 淘汰量 |
|---|---|
| 与现有题库题干重复（dup_vs_existing） | 3,871 |
| 解析截位/开头结尾截断（truncated_explanation） | 198 |
| 公式图片抹空残留（lost_formula_exp / lost_formula / fill_blank_marker_lost） | 937 |
| 答案-解析语义不一致（explanation_semantic_mismatch） | 621 |
| 模块标注错误（module_mismatch，如常识卷混入言语阅读题） | 679 |
| 按内容重归模块后仍不合格（module_reassigned_by_content / math_leak_reassigned） | 343 |
| 资料分析泄漏（ziliao_leak*，缺材料，全弃） | 322 |
| 选项畸形/OCR 叠字/嵌入大段文字（bad_option） | 418 |
| 缺前置材料/文段/公文/图表（missing_passage / missing_table_exp / missing_conditions） | 512 |
| 页码碎片/水印（stray_page_number / mojibake_cid / low_cjk_ratio） | 574 |
| 解析过短/套话截断（stub_explanation / too_short） | 452 |
| 题干截断（truncated_question） | 27 |
| 同源精确重复（dup_exact_in_source） | 503 |
| 改数字克隆/SimHash 高相似（clone_simhash；数字掩码聚类 0 命中另有精确重复吸收） | 1 |
| 争议题（disputed） | 5 |
| 无法归入二级题型（unclassified_submodule，宁缺勿滥） | 565 |
| 答案与解析冲突（answer_exp_conflict） | 17 |
| **成品（knowledge/imported/top1_xingce.jsonl）** | **2,963** |

完整逐项统计见 `data/top1/clean_stats.txt`。

## 3. 成品分布

模块（taxonomy 五模块 key）：panduan 1,240 / changshi 700 / yanyu 756 / shuliang 267 / ziliao 0。

> ziliao=0 为有意为之：源为 PDF 转 JSON，资料分析的图表与大段材料未随题保留，无法独立作答，全部保守剔除，不补造材料。

二级分布（全部为 `backend/app/data/taxonomy.json` 合法二级）：

- 判断推理：逻辑判断 430、类比推理 413、定义判断 341、分析推理 56
- 常识判断：法律 194、政治 181、科技 106、历史人文 71、管理与公文 57、经济 47、地理国情 44
- 言语理解：逻辑填空 401、中心理解 207、语句表达 75、细节理解 64、标题填入 9
- 数量关系：计算问题 122、最值问题 39、几何问题 22、经济利润 18、行程问题 19、工程问题 16、周期与日期 8、容斥原理 8、浓度问题 4、年龄问题 4、排列组合与概率 5、植树与方阵 2、数字推理 1

地区覆盖：江苏 573、上海 356、浙江 311、河北 230、国考 227、深圳 221、安徽 161 等 23 个地区，年份 2003–2023。

## 4. 抽样人工核对（n=120，seed=20250804）

- 抽样：`sample_check.py`，按模块分层（每模块 30），模块内按 md5(seed+题干) 确定性排序取样，样本清单 `data/top1/sample_check.md`。
- 审计：逐题人工核对答案与解析一致性、题面自洽完整性，逐条结论见 `data/top1/audit_top1.jsonl`，汇总见 `data/top1/audit_summary.json`。
- 审计过程中发现 3 处缺陷（1 题解析依赖缺失表格的资料分析混入、2 题解析公式图片抹空），已针对缺陷类别为清洗器新增门禁并全量重跑（各类别全量命中即样本命中的记录，共剔除 10 条），替换样本复核通过。
- **最终结果：120/120 PASS，通过率 100%（≥98% 门禁通过）**。所有 source 批次抽样通过率 100%，无 <98% 批次。

## 5. 验证

- schema：2,963 条全部含且仅含 9 个规定字段；answer∈A-D；A-D 选项全非空；explanation ≥20 字；source/year/region 全非空。
- taxonomy：module/submodule 全部为 taxonomy.json 合法一二级组合。
- `scripts/merge_bank.py` 沙箱合入验证：incoming=2963 bad=0 dup=0（未改动真实题库，生产导入由父会话执行）。
- 抓取可复现：重跑 fetch_top1.py 输出与交付 raw 文件 md5 一致。
