# 题库内容治理第二轮 — 5,569 条 UNKNOWN tag3 治理报告

日期：2026-08-05　输入：生产导出 unknown_questions.json（tag3='UNKNOWN' 且未下架，共 5,569 条）

## 1. 输入集合与历史差异

- 生产当前 UNKNOWN：**5,569** 条（本轮治理对象，逐条覆盖，无遗漏无重复）。
- 上一轮（2026-08-04）存档 unknown_kept_20260804.jsonl：5,638 条。
- 差异：历史独有 69 条、生产独有 0 条。即这 69 条在存档之后已在生产侧被处理（重新定标或下架），不在本轮范围内；生产没有新增 UNKNOWN。

## 2. UNKNOWN 构成分析（按模块）

| 模块 | UNKNOWN 数 | 主要构成 |
|---|---|---|
| changshi | 3,939 | 绝大多数为可定标的常识题（上一轮规则未覆盖的细分知识点）；少量公文/管理学题、误入的言语题 |
| panduan | 806 | 大量实为数量关系的应用题（跨模块错放）；事件排序题；少量图形/定义题 |
| shuliang | 424 | 数字推理（部分无解析）；误入的判断/言语题；串题脏数据 |
| yanyu | 261 | 选项混入解析文本的串题；解析错位题；少量可定标题 |
| ziliao | 139 | 配套统计材料缺失的资料分析题（占该模块 delist 建议主体） |

脏数据类型（详见 final/final_delist.jsonl 逐题判定）：
- 资料分析材料缺失（22）：题干仅有提问句，无配套图表/文字材料，无法作答。
- 串题/解析错位（55）：解析来自另一道题（填空解析配主旨题干、排序解析配常识题干等），或选项混入解析文本，答案可靠性无法验证。
- 图形缺失（4→复核后 2 条保留下架，2 条题干文字已完整描述图示、移回定标）。
- 复核回收 3 条（306202/318773/330856）：可作答或第一轮误判，已移入定标集。

## 3. 治理流程

1. **规则轮**（scripts/retag_round2.py，基于第一轮五模块规则脚本）：脏数据检测（串题/材料缺失/图缺失/乱码）、跨模块识别（判断→数量应用题等）、常识严格定标、事件排序保留。
2. **LLM 辅助轮**（scripts/llm_retag.py，DeepSeek，考点树约束、严格 JSON、不足即 UNKNOWN）：对规则未定标的 5,355 条逐题分类；code 合法性硬校验。
3. **合并**（scripts/merge_and_sql.py）：优先级 脏数据 > 规则 > LLM(confidence≥0.9) > 保留 UNKNOWN。
4. **人工抽检与纠偏**（scripts/fix_retag.py + final/manual_corrections.jsonl）：
   - 撤回 rule_cs_stem_strict 整族（抽检错误率过高）；
   - 平行结构题（论证方式相似比较）考点树无对应 code，撤回维持 UNKNOWN（建议增补考点）；
   - 和差/归一化应用题按题型正则强制归位（SL-JS-06/SL-JS-01，纠正 14 条立体几何等误判）；
   - 论证问法（削弱/加强/前提）覆盖定义误判 4 条；
   - 针对高风险 code（CS-ZZ-04/CS-KJ-04/CS-GL-01/02）162 条逐题审核，纠正 41 条（外交/国际组织→CS-ZZ-03、一国两制→CS-ZZ-02、深海船舶核电高铁→CS-KJ-03、万隆→CS-LS-02、入世→CS-JJ-03 等）；
   - llm_shuliang/llm_yanyu/llm_ziliao 三个小族 32 条 100% 全量人工复核，纠正 6 条叶级 code、2 条撤回维持 UNKNOWN。
5. **随机抽检验收**（见 report_sampling_gov2.md）：各放行家族准确率均 ≥95%。

## 4. 最终结果

| 处置 | 数量 | 产物 |
|---|---|---|
| 重新定标 | **4,567** | final/final_retag.jsonl + final/02_unknown_retag.sql |
| 确认脏数据，建议下架 | **78** | final/final_delist.jsonl + final/03_unknown_delist.sql |
| 维持 UNKNOWN | **924** | final/final_keep_unknown.jsonl（含逐条保留原因） |
| 合计 | 5,569 | 与生产集合逐 ID 核对一致 |

定标家族分布：llm_changshi 3,895（含人工纠偏 41）、llm_panduan 475、rule_cross_module 163（含纠偏 1）、llm_shuliang 21（含纠偏 5）、llm_yanyu 8、manual_review 3、llm_ziliao 2。

维持 UNKNOWN 的主因：LLM/规则置信度不足（低置信度 675）、事件排序等考点树空缺（94，建议后续为判断模块增补「事件排序」、为逻辑判断增补「平行结构」考点）、人工复核撤回（cs_stem 族 9、平行结构 36、其他 12）、LLM 判定 UNKNOWN（171）等。

## 5. 校验

- 三个集合互斥且并集 = 生产 5,569 集合（逐 ID 断言通过）。
- 4,567 个 tag3 code 全部存在于 backend/app/data/taxonomy.json，且 code 前缀与目标 module 一致。
- SQL 全部为按 id 逐条 UPDATE，带 `AND tag3='UNKNOWN'`（定标）/`AND (disabled IS NULL OR disabled=0)`（下架）保护条件，可重复执行、幂等。
- 跨模块定标同时更新 module 并清空 submodule；同模块仅更新 tag3。

## 6. 执行说明（父会话）

```bash
docker exec deploy-kaogong-1 sh -c 'cp /data/data.db /data/data.db.bak.gov2'
docker cp data/gov2/final/02_unknown_retag.sql deploy-kaogong-1:/tmp/
docker cp data/gov2/final/03_unknown_delist.sql deploy-kaogong-1:/tmp/
docker exec deploy-kaogong-1 sh -c 'sqlite3 /data/data.db < /tmp/02_unknown_retag.sql'
# 03 为下架建议清单，确认后再执行：
docker exec deploy-kaogong-1 sh -c 'sqlite3 /data/data.db < /tmp/03_unknown_delist.sql'
# 验收：UNKNOWN 未下架应剩 924+78=1002（若 03 已执行则 924）
docker exec deploy-kaogong-1 sqlite3 /data/data.db "SELECT count(*) FROM questions WHERE tag3='UNKNOWN' AND (disabled IS NULL OR disabled=0)"
```
