# 轮28：全库剩余 hs 讲解空缺收口（存疑/跳过题人工复核补写）

轮27 完成图形推理 216 题后，全库在架题剩余 hs 空缺 1,766 条（ziliao 520 / yanyu 465 / panduan 328 / changshi 262 / shuliang 191），多为此前批次跳过的存疑、缺材料或格式不达标题。本轮逐题人工复核：核验答案与解析一致后补写 hs；确属答案存疑或缺材料的记台账处理。

约束：仅写 hs_explanation/has_hs；answer/question/options/explanation/disabled 零变更；UPDATE 带 id+空值+answer 守卫；每批快照 dry-run→生产备份→事务→回归。

进度：批次1-3 共 518 题补写完成（资料分析无图题全部收口，另 2 题存疑记台账：282576、321450）已应用生产，/api/stats、/api/questions 回归 200。批次3 为模板生成题，逐题程序化解析数值验算（比重/基期/增长量/增长率等）通过后生成讲解，验算不通过者一律人工逐题处理。
