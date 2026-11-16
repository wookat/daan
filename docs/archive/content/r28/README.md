# 轮28：全库剩余 hs 讲解空缺收口（存疑/跳过题人工复核补写）

轮27 完成图形推理 216 题后，全库在架题剩余 hs 空缺 1,766 条（ziliao 520 / yanyu 465 / panduan 328 / changshi 262 / shuliang 191），多为此前批次跳过的存疑、缺材料或格式不达标题。本轮逐题人工复核：核验答案与解析一致后补写 hs；确属答案存疑或缺材料的记台账处理。

约束：仅写 hs_explanation/has_hs；answer/question/options/explanation/disabled 零变更；UPDATE 带 id+空值+answer 守卫；每批快照 dry-run→生产备份→事务→回归。

进度：批次1-3 共 518 题补写完成（资料分析无图题全部收口，另 2 题存疑（282576、321450）核实为数据不自洽坏题已下架）已应用生产，/api/stats、/api/questions 回归 200。批次3 为模板生成题，逐题程序化解析数值验算（比重/基期/增长量/增长率等）通过后生成讲解，验算不通过者一律人工逐题处理。

## 终局统计（四模块收口完成）

| 模块 | 队列 | write_hs | skip_suspect | disable | 生产剩余空缺 |
|---|---|---|---|---|---|
| shuliang | 191 | 180 | 11 | 0 | 11 |
| changshi | 262 | 155 | 107 | 0 | 107 |
| panduan | 328 | 288 | 40 | 0 | 40 |
| yanyu | 465 | 448 | 17 | 0 | 17 |
| 合计 | 1246 | 1071 | 175 | 0 | 175 |

四模块生产剩余空缺 ID 集合与本台账 skip_suspect 集合逐一比对完全一致（空缺清零或仅剩存疑台账题）。全部 write_hs 均经快照 dry-run 行数核对后按批（24-50 题）备份（VACUUM INTO /data/bak_r28_*）+守卫事务应用，/api/stats 与各模块 /api/questions 回归 200。存疑主因：存档答案与解析/文意矛盾、答案不唯一、缺图缺材料、串题乱码、法条时效冲突等，逐条已在台账 reason 注明。

后续：上表 175 条 skip_suspect 已在轮29 纠错专项逐题终局裁定（fix_answer 73 / disable 100 / 保留 2），见 docs/content/r29/。裁定后四模块生产剩余空缺仅 2 条（changshi 655861、panduan 334296）。
