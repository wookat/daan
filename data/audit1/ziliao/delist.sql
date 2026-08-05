-- 资料分析不可作答/重复/错混模块题下架（audit1）。disabled=1 即下架。
BEGIN TRANSACTION;
-- id=241908: 题干仅 0 个数据，无完整统计材料，不可作答；待复核：解析结果等于答案但中间算式存疑
UPDATE questions SET disabled=1 WHERE id=241908;
-- id=242507: 逻辑评价题（判断推理），非资料分析
UPDATE questions SET disabled=1 WHERE id=242507;
-- id=242508: 逻辑评价题（判断推理），非资料分析
UPDATE questions SET disabled=1 WHERE id=242508;
-- id=253396: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=253396;
-- id=253398: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=253398;
-- id=259874: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=259874;
-- id=259875: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=259875;
-- id=263530: 题干仅 1 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=263530;
-- id=263536: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（JS→分类器判JQ）
UPDATE questions SET disabled=1 WHERE id=263536;
-- id=263537: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=263537;
-- id=263538: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=263538;
-- id=263539: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（JQ→分类器判ZZL）
UPDATE questions SET disabled=1 WHERE id=263539;
-- id=263540: 题干仅 1 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=263540;
-- id=265975: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（JS→分类器判PJ）
UPDATE questions SET disabled=1 WHERE id=265975;
-- id=282732: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=282732;
-- id=283272: 题干仅 1 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=283272;
-- id=283274: 题干仅 1 个数据，无完整统计材料，不可作答；tag3 归档待复核（PJ→分类器判ZZL）
UPDATE questions SET disabled=1 WHERE id=283274;
-- id=283774: 题干仅 1 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=283774;
-- id=283775: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=283775;
-- id=283776: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（ZZL→分类器判ZH）
UPDATE questions SET disabled=1 WHERE id=283776;
-- id=283777: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（PJ→分类器判JQ）
UPDATE questions SET disabled=1 WHERE id=283777;
-- id=286873: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（PJ→分类器判JQ）
UPDATE questions SET disabled=1 WHERE id=286873;
-- id=286874: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（BZ→分类器判JQ）
UPDATE questions SET disabled=1 WHERE id=286874;
-- id=286888: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=286888;
-- id=286889: 题干仅 0 个数据，无完整统计材料，不可作答；解析缺失或过短
UPDATE questions SET disabled=1 WHERE id=286889;
-- id=295614: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=295614;
-- id=295616: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=295616;
-- id=295617: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=295617;
-- id=296203: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=296203;
-- id=297083: 调研方法常识题（tag3=UNKNOWN），非资料分析
UPDATE questions SET disabled=1 WHERE id=297083;
-- id=306218: 与 id=240366 完全重复
UPDATE questions SET disabled=1 WHERE id=306218;
-- id=319101: 题干仅 0 个数据，无完整统计材料，不可作答；解析缺失或过短
UPDATE questions SET disabled=1 WHERE id=319101;
-- id=319102: 题干仅 0 个数据，无完整统计材料，不可作答；解析缺失或过短
UPDATE questions SET disabled=1 WHERE id=319102;
-- id=319103: 题干仅 0 个数据，无完整统计材料，不可作答；解析缺失或过短
UPDATE questions SET disabled=1 WHERE id=319103;
-- id=319104: 题干仅 0 个数据，无完整统计材料，不可作答；解析缺失或过短
UPDATE questions SET disabled=1 WHERE id=319104;
-- id=319237: 与 id=253397 完全重复
UPDATE questions SET disabled=1 WHERE id=319237;
-- id=319238: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=319238;
-- id=319337: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=319337;
-- id=319338: 与 id=259874 完全重复
UPDATE questions SET disabled=1 WHERE id=319338;
-- id=319339: 与 id=259875 完全重复
UPDATE questions SET disabled=1 WHERE id=319339;
-- id=319806: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（BZ→分类器判JQ）
UPDATE questions SET disabled=1 WHERE id=319806;
-- id=319807: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=319807;
-- id=320010: 题干仅 0 个数据，无完整统计材料，不可作答
UPDATE questions SET disabled=1 WHERE id=320010;
-- id=320011: 题干仅 1 个数据，无完整统计材料，不可作答；答案疑错：重算值命中 ['A', 'B']，标注 C 未命中
UPDATE questions SET disabled=1 WHERE id=320011;
-- id=320041: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（JS→分类器判BZ）
UPDATE questions SET disabled=1 WHERE id=320041;
-- id=320267: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（PJ→分类器判JS）
UPDATE questions SET disabled=1 WHERE id=320267;
-- id=320268: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（JS→分类器判BZ）
UPDATE questions SET disabled=1 WHERE id=320268;
-- id=320709: 与 id=295346 完全重复
UPDATE questions SET disabled=1 WHERE id=320709;
-- id=321030: 题干仅 0 个数据，无完整统计材料，不可作答；tag3 归档待复核（ZZL→分类器判PJ）
UPDATE questions SET disabled=1 WHERE id=321030;
-- id=321764: 数量关系趣味题（tag3=UNKNOWN），非资料分析
UPDATE questions SET disabled=1 WHERE id=321764;
-- id=334975: 题干仅 0 个数据，无完整统计材料，不可作答；解析缺失或过短
UPDATE questions SET disabled=1 WHERE id=334975;
COMMIT;
