-- 常识判断专项质检 delist（生成于 audit1，父会话统一执行）
-- id=150762: 重复题，保留 152618
UPDATE questions SET disabled=1 WHERE id=150762 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=160419: 重复题，保留 155534
UPDATE questions SET disabled=1 WHERE id=160419 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=166224: 重复题，保留 329449
UPDATE questions SET disabled=1 WHERE id=166224 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=166457: 重复题，保留 151815
UPDATE questions SET disabled=1 WHERE id=166457 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=167924: 重复题，保留 151620
UPDATE questions SET disabled=1 WHERE id=167924 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=168961: 重复题，保留 8391
UPDATE questions SET disabled=1 WHERE id=168961 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=172126: 重复题，保留 163281
UPDATE questions SET disabled=1 WHERE id=172126 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=176718: 重复题，保留 4698
UPDATE questions SET disabled=1 WHERE id=176718 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=185086: 重复题，保留 178644
UPDATE questions SET disabled=1 WHERE id=185086 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=234297: 人工判定：交通标志题依赖图片而 image 为空，无法作答，下架
UPDATE questions SET disabled=1 WHERE id=234297 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=234538: 重复题，保留 234450
UPDATE questions SET disabled=1 WHERE id=234538 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=234539: 重复题，保留 234453
UPDATE questions SET disabled=1 WHERE id=234539 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=234540: 重复题，保留 234449
UPDATE questions SET disabled=1 WHERE id=234540 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=234715: 重复题，保留 234634
UPDATE questions SET disabled=1 WHERE id=234715 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=234874: tag3 定标 None->CS-LS-04；重复题，保留 234787
UPDATE questions SET disabled=1 WHERE id=234874 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=234876: 重复题，保留 234788
UPDATE questions SET disabled=1 WHERE id=234876 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235280: 清理广告/页码噪声；重复题，保留 235202
UPDATE questions SET disabled=1 WHERE id=235280 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235286: 人工复核：题干引用表格但无表格数据，无法作答
UPDATE questions SET disabled=1 WHERE id=235286 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235289: 清理广告/页码噪声；重复题，保留 235207
UPDATE questions SET disabled=1 WHERE id=235289 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235365: 清理广告/页码噪声；重复题，保留 235446
UPDATE questions SET disabled=1 WHERE id=235365 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235444: 重复题，保留 235358
UPDATE questions SET disabled=1 WHERE id=235444 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235448: 重复题，保留 235366
UPDATE questions SET disabled=1 WHERE id=235448 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235536: 清理广告/页码噪声；重复题，保留 1272303
UPDATE questions SET disabled=1 WHERE id=235536 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235612: 重复簇答案冲突人工裁定：首贷政策：优先支持征信无贷款记录企业贷款最有助于新增融资流向小微企业，正确答案 D；重复题，保留 235527
UPDATE questions SET disabled=1 WHERE id=235612 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235618: 清理广告/页码噪声；重复题，保留 1272303
UPDATE questions SET disabled=1 WHERE id=235618 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235626: 重复题，保留 235541
UPDATE questions SET disabled=1 WHERE id=235626 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235790: 重复题，保留 235701
UPDATE questions SET disabled=1 WHERE id=235790 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235876: 重复题，保留 235702
UPDATE questions SET disabled=1 WHERE id=235876 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235881: 重复题，保留 235792
UPDATE questions SET disabled=1 WHERE id=235881 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235886: 重复题，保留 235798
UPDATE questions SET disabled=1 WHERE id=235886 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235957: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 246005
UPDATE questions SET disabled=1 WHERE id=235957 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235958: 人工判定：题干被解析文本污染（题面缺失，仅有'B【解析】…'），无法作答，下架
UPDATE questions SET disabled=1 WHERE id=235958 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235963: 重复题，保留 246012
UPDATE questions SET disabled=1 WHERE id=235963 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235966: 重复题，保留 246015
UPDATE questions SET disabled=1 WHERE id=235966 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=235969: 重复题，保留 246020
UPDATE questions SET disabled=1 WHERE id=235969 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236101: 重复题，保留 260238
UPDATE questions SET disabled=1 WHERE id=236101 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236102: 重复题，保留 260232
UPDATE questions SET disabled=1 WHERE id=236102 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236104: 重复题，保留 260244
UPDATE questions SET disabled=1 WHERE id=236104 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236108: 重复题，保留 286008
UPDATE questions SET disabled=1 WHERE id=236108 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236111: 清理广告/页码噪声；重复题，保留 260240
UPDATE questions SET disabled=1 WHERE id=236111 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236112: 重复题，保留 260246
UPDATE questions SET disabled=1 WHERE id=236112 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236117: 重复题，保留 260229
UPDATE questions SET disabled=1 WHERE id=236117 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236217: 清理广告/页码噪声；人工复核：甲先亡由乙继承，乙亡由其妹丁继承，B 正确，维持；重复题，保留 259975
UPDATE questions SET disabled=1 WHERE id=236217 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236274: 重复题，保留 260229
UPDATE questions SET disabled=1 WHERE id=236274 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236278: 重复题，保留 260143
UPDATE questions SET disabled=1 WHERE id=236278 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236279: 清理广告/页码噪声；重复题，保留 260234
UPDATE questions SET disabled=1 WHERE id=236279 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236284: tag3 定标 None->CS-ZZ-02；清理广告/页码噪声；重复题，保留 236100
UPDATE questions SET disabled=1 WHERE id=236284 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236286: 重复题，保留 260241
UPDATE questions SET disabled=1 WHERE id=236286 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236288: 清理广告/页码噪声；人工判定：题目要求'阅读表格'但无表格数据（image 为空），无法作答，下架
UPDATE questions SET disabled=1 WHERE id=236288 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236290: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 260245
UPDATE questions SET disabled=1 WHERE id=236290 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236291: 重复题，保留 260246
UPDATE questions SET disabled=1 WHERE id=236291 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236359: 重复题，保留 261184
UPDATE questions SET disabled=1 WHERE id=236359 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236421: 重复题，保留 261167
UPDATE questions SET disabled=1 WHERE id=236421 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236435: 重复题，保留 260840
UPDATE questions SET disabled=1 WHERE id=236435 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236529: 人工复核：申请日以商标局收到日为准（同日），同日申请以使用在先者公告，A 正确，维持；重复题，保留 260935
UPDATE questions SET disabled=1 WHERE id=236529 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236597: 重复题，保留 261006
UPDATE questions SET disabled=1 WHERE id=236597 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236598: 重复题，保留 261007
UPDATE questions SET disabled=1 WHERE id=236598 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236601: 人工复核：听证会属民主监督形式，D 正确，维持；重复题，保留 261010
UPDATE questions SET disabled=1 WHERE id=236601 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236602: 人工复核：考试答案 A（解析注明本题有争议），维持；重复题，保留 261011
UPDATE questions SET disabled=1 WHERE id=236602 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236604: 人工判定：题目依赖地球公转示意图（C 点位置）而 image 为空，无法作答，下架
UPDATE questions SET disabled=1 WHERE id=236604 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236605: 重复题，保留 261014
UPDATE questions SET disabled=1 WHERE id=236605 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236609: 重复题，保留 261016
UPDATE questions SET disabled=1 WHERE id=236609 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236612: 重复题，保留 261018
UPDATE questions SET disabled=1 WHERE id=236612 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236613: 人工判定：题目依赖乐器图片①-④而 image 为空，无法作答，下架
UPDATE questions SET disabled=1 WHERE id=236613 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236724: 重复题，保留 261079
UPDATE questions SET disabled=1 WHERE id=236724 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236725: 重复题，保留 261080
UPDATE questions SET disabled=1 WHERE id=236725 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236729: 重复题，保留 261084
UPDATE questions SET disabled=1 WHERE id=236729 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236736: 重复题，保留 261091
UPDATE questions SET disabled=1 WHERE id=236736 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236737: 重复题，保留 261092
UPDATE questions SET disabled=1 WHERE id=236737 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236738: 重复题，保留 261093
UPDATE questions SET disabled=1 WHERE id=236738 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236831: 重复题，保留 261435
UPDATE questions SET disabled=1 WHERE id=236831 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236966: 清理广告/页码噪声；重复题，保留 288249
UPDATE questions SET disabled=1 WHERE id=236966 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=236972: 清理广告/页码噪声；重复题，保留 261694
UPDATE questions SET disabled=1 WHERE id=236972 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237049: 重复题，保留 261988
UPDATE questions SET disabled=1 WHERE id=237049 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237050: 人工复核：机/衡均为北斗星名互为辅助，A 为并列式，维持 D；重复题，保留 261989
UPDATE questions SET disabled=1 WHERE id=237050 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237053: 重复题，保留 261992
UPDATE questions SET disabled=1 WHERE id=237053 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237054: 清理广告/页码噪声；重复题，保留 332286
UPDATE questions SET disabled=1 WHERE id=237054 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237055: 重复题，保留 261994
UPDATE questions SET disabled=1 WHERE id=237055 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237066: 重复题，保留 262004
UPDATE questions SET disabled=1 WHERE id=237066 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237154: 清理广告/页码噪声；重复题，保留 262332
UPDATE questions SET disabled=1 WHERE id=237154 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237225: 重复题，保留 262324
UPDATE questions SET disabled=1 WHERE id=237225 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237226: 重复题，保留 262325
UPDATE questions SET disabled=1 WHERE id=237226 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237227: 重复题，保留 262420
UPDATE questions SET disabled=1 WHERE id=237227 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237235: 重复题，保留 262334
UPDATE questions SET disabled=1 WHERE id=237235 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237238: 盲解分歧(B vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：维生素 K 主要促进凝血，维持视力/免疫力的是维生素 A，错误项 B，正确答案 B（237238 库答案 A 与题意矛盾：A 项表述本身正确）（本题库内答案 A 有误）；重复题，保留 296125
UPDATE questions SET disabled=1 WHERE id=237238 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237300: 重复题，保留 262548
UPDATE questions SET disabled=1 WHERE id=237300 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237370: 清理广告/页码噪声；重复题，保留 296650
UPDATE questions SET disabled=1 WHERE id=237370 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237372: 重复题，保留 262672
UPDATE questions SET disabled=1 WHERE id=237372 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237374: 清理广告/页码噪声；重复题，保留 296652
UPDATE questions SET disabled=1 WHERE id=237374 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237376: 清理广告/页码噪声；重复题，保留 262669
UPDATE questions SET disabled=1 WHERE id=237376 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237378: 盲解分歧(B vs C)，复核模型未定论，保守保留并降分；重复题，保留 262677
UPDATE questions SET disabled=1 WHERE id=237378 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237379: 清理广告/页码噪声；重复题，保留 296661
UPDATE questions SET disabled=1 WHERE id=237379 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237380: 重复题，保留 262871
UPDATE questions SET disabled=1 WHERE id=237380 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237381: 清理广告/页码噪声；重复题，保留 262845
UPDATE questions SET disabled=1 WHERE id=237381 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237382: 重复题，保留 262873
UPDATE questions SET disabled=1 WHERE id=237382 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237456: 重复题，保留 262665
UPDATE questions SET disabled=1 WHERE id=237456 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237457: 清理广告/页码噪声；重复题，保留 262849
UPDATE questions SET disabled=1 WHERE id=237457 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237464: 重复题，保留 262954
UPDATE questions SET disabled=1 WHERE id=237464 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237471: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：3D 偏振放映需两台摄影机/放映机与两个偏振方向相互垂直（正交）的偏振片，正确答案 C（237471 解析称“无正交偏振片”有误）（本题库内答案 A 有误）；重复题，保留 262681
UPDATE questions SET disabled=1 WHERE id=237471 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237543: 重复题，保留 263036
UPDATE questions SET disabled=1 WHERE id=237543 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237552: 重复题，保留 263045
UPDATE questions SET disabled=1 WHERE id=237552 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237559: 盲解分歧(B vs A)，复核模型未定论，保守保留并降分；重复题，保留 263052
UPDATE questions SET disabled=1 WHERE id=237559 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237560: 重复题，保留 263053
UPDATE questions SET disabled=1 WHERE id=237560 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237561: 清理广告/页码噪声；重复题，保留 263716
UPDATE questions SET disabled=1 WHERE id=237561 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237617: 重复题，保留 263113
UPDATE questions SET disabled=1 WHERE id=237617 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237729: 清理广告/页码噪声；重复题，保留 263709
UPDATE questions SET disabled=1 WHERE id=237729 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237737: 盲解分歧(B vs A)，复核模型未定论，保守保留并降分；重复题，保留 263052
UPDATE questions SET disabled=1 WHERE id=237737 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=237919: 清理广告/页码噪声；重复题，保留 263113
UPDATE questions SET disabled=1 WHERE id=237919 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=238353: 清理广告/页码噪声；重复题，保留 263113
UPDATE questions SET disabled=1 WHERE id=238353 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=238673: 重复题，保留 237544
UPDATE questions SET disabled=1 WHERE id=238673 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=238924: 重复题，保留 264229
UPDATE questions SET disabled=1 WHERE id=238924 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=238997: 重复题，保留 334733
UPDATE questions SET disabled=1 WHERE id=238997 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239006: 重复题，保留 334741
UPDATE questions SET disabled=1 WHERE id=239006 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239008: 重复题，保留 334743
UPDATE questions SET disabled=1 WHERE id=239008 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239016: 人工复核：多选题（解析结论 BC），单选前端不支持，answer 字段仅存 1 位
UPDATE questions SET disabled=1 WHERE id=239016 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239017: 人工复核：多选题（解析结论 ABD）
UPDATE questions SET disabled=1 WHERE id=239017 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239018: 人工复核：多选题（解析结论 AB）
UPDATE questions SET disabled=1 WHERE id=239018 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239019: 人工复核：多选题（解析结论 ABCD）
UPDATE questions SET disabled=1 WHERE id=239019 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239020: 人工复核：多选题（解析结论 ABD），单选前端不支持
UPDATE questions SET disabled=1 WHERE id=239020 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239021: 人工复核：多选题（解析结论 AC）
UPDATE questions SET disabled=1 WHERE id=239021 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239023: 人工复核：多选题（解析结论 AD）
UPDATE questions SET disabled=1 WHERE id=239023 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=239024: 人工复核：多选题（解析结论 AC）
UPDATE questions SET disabled=1 WHERE id=239024 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=245939: 重复题，保留 245960
UPDATE questions SET disabled=1 WHERE id=245939 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=245964: 重复题，保留 245945
UPDATE questions SET disabled=1 WHERE id=245964 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=245965: 盲解分歧(D vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：二十大报告：分配制度是促进共同富裕的基础性制度，正确答案 D（245965 答案/解析串题）（本题库内答案 A 有误）；重复题，保留 245946
UPDATE questions SET disabled=1 WHERE id=245965 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=245977: 重复题，保留 245937
UPDATE questions SET disabled=1 WHERE id=245977 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=245981: 重复题，保留 245960
UPDATE questions SET disabled=1 WHERE id=245981 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246004: 重复题，保留 245987
UPDATE questions SET disabled=1 WHERE id=246004 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246009: 重复题，保留 235960
UPDATE questions SET disabled=1 WHERE id=246009 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246011: 重复题，保留 245991
UPDATE questions SET disabled=1 WHERE id=246011 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246017: 重复题，保留 245996
UPDATE questions SET disabled=1 WHERE id=246017 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246026: 重复题，保留 246007
UPDATE questions SET disabled=1 WHERE id=246026 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246032: 人工复核：同 245990，D 为不符合项，维持 D；重复题，保留 245990
UPDATE questions SET disabled=1 WHERE id=246032 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246038: 重复题，保留 245996
UPDATE questions SET disabled=1 WHERE id=246038 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246056: 重复题，保留 246091
UPDATE questions SET disabled=1 WHERE id=246056 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246078: 重复题，保留 246043
UPDATE questions SET disabled=1 WHERE id=246078 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246084: 重复题，保留 246049
UPDATE questions SET disabled=1 WHERE id=246084 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246093: 重复题，保留 246058
UPDATE questions SET disabled=1 WHERE id=246093 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246094: 重复题，保留 246128
UPDATE questions SET disabled=1 WHERE id=246094 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246095: 重复题，保留 246060
UPDATE questions SET disabled=1 WHERE id=246095 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246101: 重复题，保留 246133
UPDATE questions SET disabled=1 WHERE id=246101 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246112: 重复题，保留 246043
UPDATE questions SET disabled=1 WHERE id=246112 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246113: 重复题，保留 246079
UPDATE questions SET disabled=1 WHERE id=246113 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246127: 重复题，保留 246058
UPDATE questions SET disabled=1 WHERE id=246127 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=246129: 重复题，保留 246060
UPDATE questions SET disabled=1 WHERE id=246129 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=253346: 重复题，保留 319187
UPDATE questions SET disabled=1 WHERE id=253346 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=259776: 重复题，保留 236114
UPDATE questions SET disabled=1 WHERE id=259776 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=259964: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯；重复簇答案冲突人工裁定：2015 年吐鲁番撤地设市为新疆首个，正确答案 B（259964 答案/解析串题）（本题库内答案 C 有误）
UPDATE questions SET disabled=1 WHERE id=259964 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=259965: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯；重复簇答案冲突人工裁定：新疆公路零公里标志图标为“和谐的雪莲花”，正确答案 A（259965 答案/解析串题）（本题库内答案 C 有误）
UPDATE questions SET disabled=1 WHERE id=259965 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=259967: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯；重复簇答案冲突人工裁定：新疆维吾尔自治区 1955 年成立，2015 年为 60 周年，正确答案 A（259967 答案/解析串题）（本题库内答案 D 有误）
UPDATE questions SET disabled=1 WHERE id=259967 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=259971: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯；重复簇答案冲突人工裁定：加气站为节能减排政策配套措施，体现配套措施完善程度是政策实施重要条件，正确答案 B（259971 答案/解析串题）（本题库内答案 C 有误）
UPDATE questions SET disabled=1 WHERE id=259971 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=259973: 一题多解且解析串题：8周岁限制民事行为能力人，B（与年龄相适应）与 D（纯获利益）均属他人不得主张无效，答案不唯一；解析内容为'技术优化/生物医学'完全串题。建议下架；重复簇答案冲突人工裁定：8 岁无民事行为能力人接受赠与属纯获利行为有效，正确答案 D（259973 答案/解析串题）（本题库内答案 B 有误）
UPDATE questions SET disabled=1 WHERE id=259973 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=259974: 答案错误+解析串题：李某为躲避不法侵害夺车逃离致第三人受伤，属紧急避险，应选 A；库中 D（故意伤害罪）错误（无伤害故意）。解析内容为云计算题串题，需重写；重复簇答案冲突人工裁定：为躲避危险不得已侵犯他人财产权属紧急避险，正确答案 A（259974 答案/解析串题）（本题库内答案 D 有误）；重复题，保留 236216
UPDATE questions SET disabled=1 WHERE id=259974 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=259976: 清理广告/页码噪声；人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=259976 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=259982: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯；重复簇答案冲突人工裁定：设立“快速通过”标识不能降噪且有安全隐患，正确答案 A（259982 答案/解析串题）（本题库内答案 C 有误）
UPDATE questions SET disabled=1 WHERE id=259982 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260032: 重复题，保留 272740
UPDATE questions SET disabled=1 WHERE id=260032 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260042: 重复题，保留 272750
UPDATE questions SET disabled=1 WHERE id=260042 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260046: 重复题，保留 272755
UPDATE questions SET disabled=1 WHERE id=260046 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260050: 重复题，保留 272759
UPDATE questions SET disabled=1 WHERE id=260050 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260125: 重复题，保留 260140
UPDATE questions SET disabled=1 WHERE id=260125 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260128: 重复题，保留 260143
UPDATE questions SET disabled=1 WHERE id=260128 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260129: 答案错误+解析污染：无氧呼吸典型现象为剧烈运动产生乳酸（A）；酿米酒先有氧后无氧（同族完整解析题 260242 判定 A）。库答案 B 错误，改 A；解析'常识解析：蛋白质'与题无关；重复簇答案冲突人工裁定：剧烈运动后乳酸堆积致肌肉酸痛属无氧呼吸，正确答案 A（酿米酒为先有氧后无氧发酵）（本题库内答案 B 有误）；重复题，保留 236103
UPDATE questions SET disabled=1 WHERE id=260129 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260130: 重复题，保留 260145
UPDATE questions SET disabled=1 WHERE id=260130 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260131: 答案错误：桃月为农历三月（季春）、荷月为六月（季夏）、菊月为九月；仲秋八月即桂月，正确为 C。残存解析'…都是农历八月'亦指向 C。库答案 A 错误；重复簇答案冲突人工裁定：仲秋为农历八月、桂月即八月对应正确，正确答案 C（孟春为一月而桃月为三月，A 错；多份影印版答案错录为 A 且其解析同样指向 C）（本题库内答案 A 有误）；重复题，保留 236275
UPDATE questions SET disabled=1 WHERE id=260131 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260138: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=260138 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260144: 同 260129：答案 B 改为 A，解析串题需重写；重复簇答案冲突人工裁定：剧烈运动后乳酸堆积致肌肉酸痛属无氧呼吸，正确答案 A（酿米酒为先有氧后无氧发酵）（本题库内答案 B 有误）；重复题，保留 236103
UPDATE questions SET disabled=1 WHERE id=260144 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260146: 同 260131：答案 A 改为 C，解析首部截断；重复簇答案冲突人工裁定：仲秋为农历八月、桂月即八月对应正确，正确答案 C（孟春为一月而桃月为三月，A 错；多份影印版答案错录为 A 且其解析同样指向 C）（本题库内答案 A 有误）；重复题，保留 236275
UPDATE questions SET disabled=1 WHERE id=260146 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260153: 题干严重残缺：仅剩'张飞 2、程咬金 3、李逵 4、牛皋'，缺题干与①，解析为红水河/柳江发源地完全串题，无法作答
UPDATE questions SET disabled=1 WHERE id=260153 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260154: 重复题，保留 260140
UPDATE questions SET disabled=1 WHERE id=260154 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260156: 重复题，保留 260143
UPDATE questions SET disabled=1 WHERE id=260156 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260157: 同 260129：答案 B 改为 A，解析串题需重写；重复簇答案冲突人工裁定：剧烈运动后乳酸堆积致肌肉酸痛属无氧呼吸，正确答案 A（酿米酒为先有氧后无氧发酵）（本题库内答案 B 有误）；重复题，保留 236103
UPDATE questions SET disabled=1 WHERE id=260157 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260159: 同 260131：答案 A 改为 C，解析首部截断；重复簇答案冲突人工裁定：仲秋为农历八月、桂月即八月对应正确，正确答案 C（孟春为一月而桃月为三月，A 错；多份影印版答案错录为 A 且其解析同样指向 C）（本题库内答案 A 有误）；重复题，保留 236275
UPDATE questions SET disabled=1 WHERE id=260159 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260169: 清理广告/页码噪声；重复题，保留 260145
UPDATE questions SET disabled=1 WHERE id=260169 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260171: 同 260129：答案 B 改为 A，解析串题需重写；重复簇答案冲突人工裁定：剧烈运动后乳酸堆积致肌肉酸痛属无氧呼吸，正确答案 A（酿米酒为先有氧后无氧发酵）（本题库内答案 B 有误）；重复题，保留 236103
UPDATE questions SET disabled=1 WHERE id=260171 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260177: 同 260129：答案 B 改为 A，解析串题需重写；重复簇答案冲突人工裁定：剧烈运动后乳酸堆积致肌肉酸痛属无氧呼吸，正确答案 A（酿米酒为先有氧后无氧发酵）（本题库内答案 B 有误）；重复题，保留 236103
UPDATE questions SET disabled=1 WHERE id=260177 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260212: 重复题，保留 260140
UPDATE questions SET disabled=1 WHERE id=260212 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260214: 重复题，保留 260143
UPDATE questions SET disabled=1 WHERE id=260214 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260215: 同 260129：答案 B 改为 A，解析串题需重写；重复簇答案冲突人工裁定：剧烈运动后乳酸堆积致肌肉酸痛属无氧呼吸，正确答案 A（酿米酒为先有氧后无氧发酵）（本题库内答案 B 有误）；重复题，保留 236103
UPDATE questions SET disabled=1 WHERE id=260215 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260216: 重复题，保留 260145
UPDATE questions SET disabled=1 WHERE id=260216 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260217: 同 260131：答案 A 改为 C，解析首部截断；重复簇答案冲突人工裁定：仲秋为农历八月、桂月即八月对应正确，正确答案 C（孟春为一月而桃月为三月，A 错；多份影印版答案错录为 A 且其解析同样指向 C）（本题库内答案 A 有误）；重复题，保留 236275
UPDATE questions SET disabled=1 WHERE id=260217 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260233: 重复题，保留 260143
UPDATE questions SET disabled=1 WHERE id=260233 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260239: 清理广告/页码噪声；重复题，保留 236100
UPDATE questions SET disabled=1 WHERE id=260239 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260242: 人工复核：完整解析判定 A（剧烈运动乳酸），并说明 B 存在出题不严谨争议，维持 A；重复簇答案冲突人工裁定：剧烈运动后乳酸堆积致肌肉酸痛属无氧呼吸，正确答案 A（酿米酒为先有氧后无氧发酵）；重复题，保留 236103
UPDATE questions SET disabled=1 WHERE id=260242 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260243: 清理广告/页码噪声；题干要求'阅读表格'但表格缺失且 image 为空，无法独立判断，建议下架
UPDATE questions SET disabled=1 WHERE id=260243 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260325: 重复题，保留 260145
UPDATE questions SET disabled=1 WHERE id=260325 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260338: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 285204
UPDATE questions SET disabled=1 WHERE id=260338 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260348: 清理广告/页码噪声；重复题，保留 260357
UPDATE questions SET disabled=1 WHERE id=260348 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260350: 清理广告/页码噪声；人工复核：括号替换词与划线格式在导入时丢失，选项中无替换词，无法作答
UPDATE questions SET disabled=1 WHERE id=260350 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260370: 题干依赖'右侧战役形势图'而 image 为空，无法作答；且库答案 A 与解析（判定 B 正确，巨鹿之战以少胜多）矛盾。建议下架
UPDATE questions SET disabled=1 WHERE id=260370 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260372: 清理广告/页码噪声；人工解题：C《忆秦娥·娄山关》从头越最宜鼓励受挫者；B 为赠别诗有劝离职之嫌；解析结论 C，原 answer=A 为导入默认值错误；重复题，保留 260451
UPDATE questions SET disabled=1 WHERE id=260372 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260442: 重复题，保留 260366
UPDATE questions SET disabled=1 WHERE id=260442 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260445: 重复题，保留 260368
UPDATE questions SET disabled=1 WHERE id=260445 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260446: 清理广告/页码噪声；人工复核：题干依赖战役形势图但 image 为空，缺图无法作答
UPDATE questions SET disabled=1 WHERE id=260446 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260467: 重复题，保留 273004
UPDATE questions SET disabled=1 WHERE id=260467 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260468: 重复题，保留 273005
UPDATE questions SET disabled=1 WHERE id=260468 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260474: 重复题，保留 273012
UPDATE questions SET disabled=1 WHERE id=260474 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260483: 重复题，保留 273022
UPDATE questions SET disabled=1 WHERE id=260483 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260485: 重复题，保留 273024
UPDATE questions SET disabled=1 WHERE id=260485 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260601: tag3 定标 UNKNOWN->CS-LS-05；人工复核：题干依赖邮票图案但 image 为空，缺图无法作答
UPDATE questions SET disabled=1 WHERE id=260601 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260657: 重复题，保留 236351
UPDATE questions SET disabled=1 WHERE id=260657 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260665: 重复题，保留 261184
UPDATE questions SET disabled=1 WHERE id=260665 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260727: 人工复核：商标法第31条同日申请以使用在先，甲使用在先，维持 A；重复题，保留 260935
UPDATE questions SET disabled=1 WHERE id=260727 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=260743: 重复题，保留 236351
UPDATE questions SET disabled=1 WHERE id=260743 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261009: 清理广告/页码噪声；重复题，保留 236600
UPDATE questions SET disabled=1 WHERE id=261009 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261013: 清理广告/页码噪声；题干依赖地球公转示意图'C点'但 image 为空，无法独立作答；题干还混入'获取试卷更新…公众号'广告残留。建议下架
UPDATE questions SET disabled=1 WHERE id=261013 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261085: 清理广告/页码噪声；重复题，保留 236730
UPDATE questions SET disabled=1 WHERE id=261085 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261171: 清理广告/页码噪声；重复题，保留 261184
UPDATE questions SET disabled=1 WHERE id=261171 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261228: 重复题，保留 261184
UPDATE questions SET disabled=1 WHERE id=261228 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261330: 清理广告/页码噪声；盲解分歧(D vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：早中晚稻按播种/收获期划分而非淀粉含量，错误项 D，正确答案 D（261330 答案错录且题干带广告噪声）（本题库内答案 A 有误）；重复题，保留 236356
UPDATE questions SET disabled=1 WHERE id=261330 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261341: 清理广告/页码噪声；重复题，保留 286901
UPDATE questions SET disabled=1 WHERE id=261341 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261426: 清理广告/页码噪声；重复题，保留 236822
UPDATE questions SET disabled=1 WHERE id=261426 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261436: 清理广告/页码噪声；重复题，保留 236832
UPDATE questions SET disabled=1 WHERE id=261436 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261511: 重复题，保留 261184
UPDATE questions SET disabled=1 WHERE id=261511 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261579: 清理广告/页码噪声；重复题，保留 273594
UPDATE questions SET disabled=1 WHERE id=261579 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261670: 答案错误：题问'表述错误的'，解析明确 A/B/D 为正确的家庭/机构/社区养老模式、C 错误（宅基地上房屋不得抵押，农村不适用以房养老）。库答案 A 与解析矛盾，改为 C；重复簇答案冲突人工裁定：农村宅基地房屋依法不得抵押，李大爷“以房养老”做法错误，正确答案 C（多份影印版答案错录为 A，其解析同样指向 C 错误）（本题库内答案 A 有误）；重复题，保留 262239
UPDATE questions SET disabled=1 WHERE id=261670 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261688: 清理广告/页码噪声；盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：农村宅基地房屋依法不得抵押，李大爷“以房养老”做法错误，正确答案 C（多份影印版答案错录为 A，其解析同样指向 C 错误）（本题库内答案 A 有误）；重复题，保留 262239
UPDATE questions SET disabled=1 WHERE id=261688 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261689: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 261669
UPDATE questions SET disabled=1 WHERE id=261689 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261693: 答案错误：解析逐项排除 A（瓷器与中国同名指江西非陕西）、B、C，明确 D 当选。库答案 A 改为 D；重复簇答案冲突人工裁定：洞庭岳阳对湖南、赤壁黄鹤对湖北且对仗工整，正确答案 B（261693/261808 解析残缺且答案错录）（本题库内答案 A 有误）；重复题，保留 236970
UPDATE questions SET disabled=1 WHERE id=261693 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261705: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：农村宅基地房屋依法不得抵押，李大爷“以房养老”做法错误，正确答案 C（多份影印版答案错录为 A，其解析同样指向 C 错误）（本题库内答案 A 有误）；重复题，保留 262239
UPDATE questions SET disabled=1 WHERE id=261705 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261706: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 261669
UPDATE questions SET disabled=1 WHERE id=261706 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261708: 重复题，保留 261835
UPDATE questions SET disabled=1 WHERE id=261708 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261713: 重复题，保留 236968
UPDATE questions SET disabled=1 WHERE id=261713 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261720: 清理广告/页码噪声；重复题，保留 261767
UPDATE questions SET disabled=1 WHERE id=261720 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261756: 重复题，保留 261835
UPDATE questions SET disabled=1 WHERE id=261756 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261773: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 261687
UPDATE questions SET disabled=1 WHERE id=261773 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261776: 盲解分歧(D vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：农村宅基地房屋依法不得抵押，李大爷“以房养老”做法错误，正确答案 C（多份影印版答案错录为 A，其解析同样指向 C 错误）（本题库内答案 A 有误）；重复题，保留 262239
UPDATE questions SET disabled=1 WHERE id=261776 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261788: 重复题，保留 261835
UPDATE questions SET disabled=1 WHERE id=261788 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261791: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 261687
UPDATE questions SET disabled=1 WHERE id=261791 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261808: 同 261693：解析明确 D 当选，库答案 A 改为 D；重复簇答案冲突人工裁定：洞庭岳阳对湖南、赤壁黄鹤对湖北且对仗工整，正确答案 B（261693/261808 解析残缺且答案错录）（本题库内答案 A 有误）；重复题，保留 236970
UPDATE questions SET disabled=1 WHERE id=261808 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261810: 重复题，保留 261694
UPDATE questions SET disabled=1 WHERE id=261810 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261837: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 261687
UPDATE questions SET disabled=1 WHERE id=261837 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261838: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 261669
UPDATE questions SET disabled=1 WHERE id=261838 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261974: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：农村宅基地房屋依法不得抵押，李大爷“以房养老”做法错误，正确答案 C（多份影印版答案错录为 A，其解析同样指向 C 错误）（本题库内答案 A 有误）；重复题，保留 262239
UPDATE questions SET disabled=1 WHERE id=261974 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261986: 清理广告/页码噪声；答案存疑：库内 A/解析 D/盲解 A 不能相互印证
UPDATE questions SET disabled=1 WHERE id=261986 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=261993: 清理广告/页码噪声；重复题，保留 332286
UPDATE questions SET disabled=1 WHERE id=261993 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262234: 重复题，保留 288283
UPDATE questions SET disabled=1 WHERE id=262234 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262243: 重复题，保留 330100
UPDATE questions SET disabled=1 WHERE id=262243 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262263: 重复题，保留 262288
UPDATE questions SET disabled=1 WHERE id=262263 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262326: 清理广告/页码噪声；重复题，保留 262420
UPDATE questions SET disabled=1 WHERE id=262326 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262329: 清理广告/页码噪声；重复题，保留 237151
UPDATE questions SET disabled=1 WHERE id=262329 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262335: 清理广告/页码噪声；重复题，保留 237156
UPDATE questions SET disabled=1 WHERE id=262335 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262336: 重复题，保留 333743
UPDATE questions SET disabled=1 WHERE id=262336 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262418: 重复题，保留 262324
UPDATE questions SET disabled=1 WHERE id=262418 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262419: 重复题，保留 262325
UPDATE questions SET disabled=1 WHERE id=262419 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262423: 重复题，保留 237151
UPDATE questions SET disabled=1 WHERE id=262423 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262426: 清理广告/页码噪声；重复题，保留 262332
UPDATE questions SET disabled=1 WHERE id=262426 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262428: 重复题，保留 262334
UPDATE questions SET disabled=1 WHERE id=262428 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262519: 人工复核：串题——题干为民事借款，解析为资料分析题内容
UPDATE questions SET disabled=1 WHERE id=262519 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262547: 重复题，保留 237299
UPDATE questions SET disabled=1 WHERE id=262547 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262555: 重复题，保留 237307
UPDATE questions SET disabled=1 WHERE id=262555 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262561: 清理广告/页码噪声；重复题，保留 237312
UPDATE questions SET disabled=1 WHERE id=262561 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262667: 重复题，保留 237368
UPDATE questions SET disabled=1 WHERE id=262667 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262670: 人工复核：解析明确 D 错误（应为'一半以上国家'），维持 D；重复题，保留 274101
UPDATE questions SET disabled=1 WHERE id=262670 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262671: 清理广告/页码噪声；人工复核：自然人间借款未约定利息视为不支付利息，A 正确，维持 A；重复题，保留 296652
UPDATE questions SET disabled=1 WHERE id=262671 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262675: 清理广告/页码噪声；重复题，保留 237371
UPDATE questions SET disabled=1 WHERE id=262675 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262679: 清理广告/页码噪声；重复题，保留 262871
UPDATE questions SET disabled=1 WHERE id=262679 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262682: 清理广告/页码噪声；重复题，保留 296650
UPDATE questions SET disabled=1 WHERE id=262682 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262846: 重复题，保留 262672
UPDATE questions SET disabled=1 WHERE id=262846 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262850: 清理广告/页码噪声；重复题，保留 237373
UPDATE questions SET disabled=1 WHERE id=262850 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262851: 重复题，保留 262665
UPDATE questions SET disabled=1 WHERE id=262851 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262856: 清理广告/页码噪声；重复题，保留 262871
UPDATE questions SET disabled=1 WHERE id=262856 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262860: 重复题，保留 237369
UPDATE questions SET disabled=1 WHERE id=262860 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262861: 清理广告/页码噪声；重复题，保留 296650
UPDATE questions SET disabled=1 WHERE id=262861 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262862: 重复题，保留 237371
UPDATE questions SET disabled=1 WHERE id=262862 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262865: 清理广告/页码噪声；同 262671，维持 A；重复题，保留 296652
UPDATE questions SET disabled=1 WHERE id=262865 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262867: 清理广告/页码噪声；重复题，保留 262669
UPDATE questions SET disabled=1 WHERE id=262867 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262869: 盲解分歧(B vs C)，复核模型未定论，保守保留并降分；重复题，保留 262677
UPDATE questions SET disabled=1 WHERE id=262869 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262872: 清理广告/页码噪声；重复题，保留 262845
UPDATE questions SET disabled=1 WHERE id=262872 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=262944: 重复题，保留 237454
UPDATE questions SET disabled=1 WHERE id=262944 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263037: 重复题，保留 237544
UPDATE questions SET disabled=1 WHERE id=263037 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263038: 重复题，保留 237545
UPDATE questions SET disabled=1 WHERE id=263038 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263039: 清理广告/页码噪声；重复题，保留 237546
UPDATE questions SET disabled=1 WHERE id=263039 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263054: 清理广告/页码噪声；重复题，保留 263716
UPDATE questions SET disabled=1 WHERE id=263054 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263116: 重复题，保留 237545
UPDATE questions SET disabled=1 WHERE id=263116 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263119: 重复题，保留 263036
UPDATE questions SET disabled=1 WHERE id=263119 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263228: 清理广告/页码噪声；重复题，保留 263709
UPDATE questions SET disabled=1 WHERE id=263228 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263236: 盲解分歧(B vs A)，复核模型未定论，保守保留并降分；重复题，保留 263052
UPDATE questions SET disabled=1 WHERE id=263236 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263344: 清理广告/页码噪声；重复题，保留 263113
UPDATE questions SET disabled=1 WHERE id=263344 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263700: 清理广告/页码噪声；重复题，保留 238241
UPDATE questions SET disabled=1 WHERE id=263700 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263714: 重复题，保留 263053
UPDATE questions SET disabled=1 WHERE id=263714 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263812: 清理广告/页码噪声；重复题，保留 263113
UPDATE questions SET disabled=1 WHERE id=263812 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263982: 清理广告/页码噪声；重复题，保留 263709
UPDATE questions SET disabled=1 WHERE id=263982 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=263995: 清理广告/页码噪声；重复题，保留 263716
UPDATE questions SET disabled=1 WHERE id=263995 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264094: 清理广告/页码噪声；重复题，保留 263113
UPDATE questions SET disabled=1 WHERE id=264094 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264232: 重复题，保留 238927
UPDATE questions SET disabled=1 WHERE id=264232 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264326: 清理广告/页码噪声；重复题，保留 275868
UPDATE questions SET disabled=1 WHERE id=264326 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264330: 清理广告/页码噪声；重复题，保留 275872
UPDATE questions SET disabled=1 WHERE id=264330 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264437: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264437 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264438: 解析完全串题（内容为'秦汉文化'言语理解题），无法核实答案；A/B/C/D 四项均与团章原文一致，找不到'不正确'项，库答案 B 无依据。建议下架待重出
UPDATE questions SET disabled=1 WHERE id=264438 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264442: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264442 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264443: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264443 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264448: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264448 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264451: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264451 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264452: 人工复核：串题——解析为『中微子』言语理解题内容
UPDATE questions SET disabled=1 WHERE id=264452 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264453: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264453 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264454: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264454 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264526: 重复题，保留 319705
UPDATE questions SET disabled=1 WHERE id=264526 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264528: 重复题，保留 319707
UPDATE questions SET disabled=1 WHERE id=264528 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264606: 盲解分歧(C vs B)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：脱脂奶去除的是脂肪，乳糖酶用于低乳糖奶，对应错误项 C，正确答案 C（264606 答案错录且解析为无关噪声）（本题库内答案 B 有误）；重复题，保留 241424
UPDATE questions SET disabled=1 WHERE id=264606 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264624: 多重缺陷：本题为言语理解'可以推出'题被误归常识判断模块；题干末尾截断（'无法有效利用水分和营'）；解析为'常识解析：蛋白质'完全串题。库答案 B（夜间酶活性最低）文段无据，A 更可推出。建议下架
UPDATE questions SET disabled=1 WHERE id=264624 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264632: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264632 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264664: 盲解分歧(D vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：元宇宙不是独立于物质世界的精神世界，不正确项 D，正确答案 D（264664 答案/解析串题）（本题库内答案 A 有误）；重复题，保留 240119
UPDATE questions SET disabled=1 WHERE id=264664 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264669: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264669 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264670: 人工复核：言语理解题混入常识模块，解析为数学题（等距离平均速度）串题
UPDATE questions SET disabled=1 WHERE id=264670 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264671: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264671 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264673: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264673 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264675: tag3 定标 UNKNOWN->CS-KJ-05；人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264675 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264677: 题干残缺（语句排序题只给出①-⑤，选项却引用⑥）+ 解析为概率题完全串题 + 语句排序属言语理解误归常识模块。建议下架
UPDATE questions SET disabled=1 WHERE id=264677 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264713: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯；重复簇答案冲突人工裁定：①应为负面清单、④应为有序放宽服务业准入，正确 3 项（②③⑤），正确答案 B（264713 答案/解析串题）（本题库内答案 C 有误）
UPDATE questions SET disabled=1 WHERE id=264713 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264714: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264714 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264742: 人工复核：同 264670 串题族
UPDATE questions SET disabled=1 WHERE id=264742 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264743: 题干截断（'这为台风的生成提供了充足的'戛然而止）+ 解析为工程问题串题 + 属言语理解接语题误归常识模块。建议下架
UPDATE questions SET disabled=1 WHERE id=264743 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264788: 人工复核：同 264670 串题族
UPDATE questions SET disabled=1 WHERE id=264788 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264789: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264789 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264790: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264790 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264791: tag3 定标 UNKNOWN->CS-KJ-02；人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264791 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264793: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264793 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264804: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264804 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264909: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=264909 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264985: 语句排序题误归常识判断模块 + 解析为'和差倍比'数量题完全串题，无法核验；库答案 B（④①②⑥③⑤）割裂了④与其例证⑥的衔接，存疑。建议下架
UPDATE questions SET disabled=1 WHERE id=264985 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=264986: 人工复核：同 264670 串题族
UPDATE questions SET disabled=1 WHERE id=264986 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265014: 题干截断 + 属言语理解主旨题误归常识模块 + 解析为排列组合题串题。建议下架
UPDATE questions SET disabled=1 WHERE id=265014 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265062: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=265062 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265119: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=265119 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265121: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=265121 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265122: tag3 定标 UNKNOWN->CS-KJ-03；人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=265122 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265146: tag3 定标 UNKNOWN->CS-DL-03；属言语理解'由此可推知'题误归常识模块 + 题干含页码残留 + 解析为'和差倍比'数量题完全串题，答案无法核验。建议下架
UPDATE questions SET disabled=1 WHERE id=265146 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265168: 人工复核：同 264670 串题族
UPDATE questions SET disabled=1 WHERE id=265168 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265169: 同 265146（重复题），题干截断且解析串题，建议下架
UPDATE questions SET disabled=1 WHERE id=265169 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265212: 盲解分歧(D vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：“约法三章”是汉高祖刘邦而非明太祖朱元璋，不正确项 D，正确答案 D（265212 答案/解析串题）（本题库内答案 A 有误）；重复题，保留 240121
UPDATE questions SET disabled=1 WHERE id=265212 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265213: 盲解分歧(D vs A)，复核模型未定论，保守保留并降分；重复簇答案冲突人工裁定：北京中轴线积淀为元明清及近现代（非宋），不正确项 D，正确答案 D（265213 答案/解析串题且“昀长”OCR 错字）（本题库内答案 A 有误）；重复题，保留 240122
UPDATE questions SET disabled=1 WHERE id=265213 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265217: 人工复核：同 264670 串题族
UPDATE questions SET disabled=1 WHERE id=265217 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265218: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=265218 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265221: tag3 定标 UNKNOWN->CS-LS-05；属言语理解'可以推出'题误归常识模块 + 题干截断 + 解析为方程法数量题完全串题；且'昀'系'最'的 OCR 错字。建议下架
UPDATE questions SET disabled=1 WHERE id=265221 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265222: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=265222 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=265987: 重复题，保留 320178
UPDATE questions SET disabled=1 WHERE id=265987 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272594: 重复题，保留 259881
UPDATE questions SET disabled=1 WHERE id=272594 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272595: 重复题，保留 259882
UPDATE questions SET disabled=1 WHERE id=272595 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272599: 重复题，保留 259886
UPDATE questions SET disabled=1 WHERE id=272599 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272600: 清理广告/页码噪声；重复题，保留 259887
UPDATE questions SET disabled=1 WHERE id=272600 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272603: 清理广告/页码噪声；重复题，保留 259889
UPDATE questions SET disabled=1 WHERE id=272603 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272604: 重复题，保留 259890
UPDATE questions SET disabled=1 WHERE id=272604 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272606: 重复题，保留 259892
UPDATE questions SET disabled=1 WHERE id=272606 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272607: 清理广告/页码噪声；重复题，保留 259893
UPDATE questions SET disabled=1 WHERE id=272607 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272610: 重复题，保留 259896
UPDATE questions SET disabled=1 WHERE id=272610 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272611: 清理广告/页码噪声；重复题，保留 259897
UPDATE questions SET disabled=1 WHERE id=272611 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272612: 重复题，保留 259898
UPDATE questions SET disabled=1 WHERE id=272612 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272684: tag3 定标 None->CS-GL-02；重复簇答案冲突人工裁定：加气站为节能减排政策配套措施，体现配套措施完善程度是政策实施重要条件，正确答案 B（259971 答案/解析串题）；重复题，保留 236213
UPDATE questions SET disabled=1 WHERE id=272684 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272741: 重复题，保留 260033
UPDATE questions SET disabled=1 WHERE id=272741 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272742: 清理广告/页码噪声；重复题，保留 260034
UPDATE questions SET disabled=1 WHERE id=272742 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272746: 重复题，保留 260038
UPDATE questions SET disabled=1 WHERE id=272746 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272747: 重复题，保留 260039
UPDATE questions SET disabled=1 WHERE id=272747 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272748: 清理广告/页码噪声；重复题，保留 260040
UPDATE questions SET disabled=1 WHERE id=272748 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272749: 重复题，保留 260041
UPDATE questions SET disabled=1 WHERE id=272749 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272751: 重复题，保留 260043
UPDATE questions SET disabled=1 WHERE id=272751 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272752: 清理广告/页码噪声；重复题，保留 260044
UPDATE questions SET disabled=1 WHERE id=272752 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272753: 重复题，保留 260045
UPDATE questions SET disabled=1 WHERE id=272753 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272756: 重复题，保留 260047
UPDATE questions SET disabled=1 WHERE id=272756 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=272758: 重复题，保留 260049
UPDATE questions SET disabled=1 WHERE id=272758 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273003: 重复题，保留 260466
UPDATE questions SET disabled=1 WHERE id=273003 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273006: 重复题，保留 260469
UPDATE questions SET disabled=1 WHERE id=273006 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273007: 清理广告/页码噪声；重复题，保留 260470
UPDATE questions SET disabled=1 WHERE id=273007 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273008: 重复题，保留 260471
UPDATE questions SET disabled=1 WHERE id=273008 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273013: 重复题，保留 260475
UPDATE questions SET disabled=1 WHERE id=273013 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273014: 清理广告/页码噪声；重复题，保留 260476
UPDATE questions SET disabled=1 WHERE id=273014 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273016: 重复题，保留 260478
UPDATE questions SET disabled=1 WHERE id=273016 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273021: 重复题，保留 260482
UPDATE questions SET disabled=1 WHERE id=273021 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273025: 清理广告/页码噪声；重复题，保留 260486
UPDATE questions SET disabled=1 WHERE id=273025 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273026: 重复题，保留 260487
UPDATE questions SET disabled=1 WHERE id=273026 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273027: 人工复核：多选题（解析结论 ABCD）
UPDATE questions SET disabled=1 WHERE id=273027 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273031: 人工复核：多选题（解析结论 ACD）
UPDATE questions SET disabled=1 WHERE id=273031 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273032: 人工复核：多选题（解析结论 BCD）
UPDATE questions SET disabled=1 WHERE id=273032 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273036: 人工复核：多选题（解析结论 BD）
UPDATE questions SET disabled=1 WHERE id=273036 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273592: 重复题，保留 261577
UPDATE questions SET disabled=1 WHERE id=273592 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273593: 重复题，保留 261578
UPDATE questions SET disabled=1 WHERE id=273593 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=273842: 重复题，保留 333743
UPDATE questions SET disabled=1 WHERE id=273842 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=274099: 清理广告/页码噪声；重复题，保留 262668
UPDATE questions SET disabled=1 WHERE id=274099 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=274209: 重复题，保留 262844
UPDATE questions SET disabled=1 WHERE id=274209 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=274210: 重复题，保留 262845
UPDATE questions SET disabled=1 WHERE id=274210 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275851: 重复题，保留 264309
UPDATE questions SET disabled=1 WHERE id=275851 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275854: 重复题，保留 264310
UPDATE questions SET disabled=1 WHERE id=275854 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275856: 清理广告/页码噪声；重复题，保留 264312
UPDATE questions SET disabled=1 WHERE id=275856 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275858: 重复题，保留 264314
UPDATE questions SET disabled=1 WHERE id=275858 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275862: 重复题，保留 264316
UPDATE questions SET disabled=1 WHERE id=275862 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275864: 重复题，保留 264318
UPDATE questions SET disabled=1 WHERE id=275864 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275867: 重复题，保留 264325
UPDATE questions SET disabled=1 WHERE id=275867 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275869: 清理广告/页码噪声；重复题，保留 264327
UPDATE questions SET disabled=1 WHERE id=275869 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275871: 重复题，保留 264329
UPDATE questions SET disabled=1 WHERE id=275871 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275874: tag3 定标 UNKNOWN->CS-KJ-05；盲解分歧(D vs A)，复核模型未定论，保守保留并降分；重复题，保留 264332
UPDATE questions SET disabled=1 WHERE id=275874 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275875: 人工复核：多选题（解析结论 BCD），单选前端不支持
UPDATE questions SET disabled=1 WHERE id=275875 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275878: 清理广告/页码噪声；人工复核：多选题（解析结论 ABC）
UPDATE questions SET disabled=1 WHERE id=275878 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275879: 人工复核：多选题（解析结论 ABD）
UPDATE questions SET disabled=1 WHERE id=275879 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275880: 清理广告/页码噪声；人工复核：多选题（解析结论 AD）
UPDATE questions SET disabled=1 WHERE id=275880 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275881: 盲解分歧(ABC vs A)，复核模型未定论，保守保留并降分；重复题，保留 264342
UPDATE questions SET disabled=1 WHERE id=275881 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275956: 清理广告/页码噪声；重复题，保留 264313
UPDATE questions SET disabled=1 WHERE id=275956 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275957: tag3 定标 None->CS-ZZ-01；重复题，保留 264314
UPDATE questions SET disabled=1 WHERE id=275957 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275965: 重复题，保留 264322
UPDATE questions SET disabled=1 WHERE id=275965 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275967: 重复题，保留 264324
UPDATE questions SET disabled=1 WHERE id=275967 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=275978: 人工复核：多选题（解析结论 ABC）
UPDATE questions SET disabled=1 WHERE id=275978 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=276076: 重复题，保留 334743
UPDATE questions SET disabled=1 WHERE id=276076 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=282642: 重复题，保留 162316
UPDATE questions SET disabled=1 WHERE id=282642 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=282644: 重复题，保留 150703
UPDATE questions SET disabled=1 WHERE id=282644 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=282655: 人工复核：解析以'冒用其兄身份'为由认定不构成非法用工，B 为不正确项，维持 B（注：该解析口径存在学理争议，但与答案自洽）；重复题，保留 1275121
UPDATE questions SET disabled=1 WHERE id=282655 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=282656: 重复题，保留 1275122
UPDATE questions SET disabled=1 WHERE id=282656 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=283439: 重复题，保留 144485
UPDATE questions SET disabled=1 WHERE id=283439 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=283533: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 333277
UPDATE questions SET disabled=1 WHERE id=283533 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=283535: 重复题，保留 333280
UPDATE questions SET disabled=1 WHERE id=283535 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=283538: 重复题，保留 333283
UPDATE questions SET disabled=1 WHERE id=283538 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=283542: 重复题，保留 333287
UPDATE questions SET disabled=1 WHERE id=283542 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=283543: 重复题，保留 333288
UPDATE questions SET disabled=1 WHERE id=283543 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=284082: 重复题，保留 260145
UPDATE questions SET disabled=1 WHERE id=284082 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=284084: 重复题，保留 260143
UPDATE questions SET disabled=1 WHERE id=284084 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=284085: 重复簇答案冲突人工裁定：剧烈运动后乳酸堆积致肌肉酸痛属无氧呼吸，正确答案 A（酿米酒为先有氧后无氧发酵）；重复题，保留 236103
UPDATE questions SET disabled=1 WHERE id=284085 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=284087: 重复题，保留 285543
UPDATE questions SET disabled=1 WHERE id=284087 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=284088: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 285204
UPDATE questions SET disabled=1 WHERE id=284088 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=284089: 重复题，保留 285206
UPDATE questions SET disabled=1 WHERE id=284089 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=284091: 重复题，保留 285124
UPDATE questions SET disabled=1 WHERE id=284091 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=284092: 重复题，保留 260229
UPDATE questions SET disabled=1 WHERE id=284092 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285048: 人工复核：解析逐项论证③④符合节约集约用地，答案 C 正确；但题干④'某开发区的工业用地综合容积率'处被截断，需补全题干（不影响本题作答，暂不下架）；重复题，保留 286449
UPDATE questions SET disabled=1 WHERE id=285048 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285108: 重复题，保留 236099
UPDATE questions SET disabled=1 WHERE id=285108 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285109: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 284080
UPDATE questions SET disabled=1 WHERE id=285109 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285114: 人工复核：成年子女须同时满足'不能独立生活'与父母有能力两条件方可主张抚养费，本案王晓为完全民事行为能力人且无客观障碍，维持 C；重复题，保留 285607
UPDATE questions SET disabled=1 WHERE id=285114 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285118: 清理广告/页码噪声；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 260229
UPDATE questions SET disabled=1 WHERE id=285118 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285121: 缺表格：同 298239（旅行者1号题），题干依赖缺失的探测资料表格，虽库答案 C 与常识相符（土卫二有冰下海洋）但题目不完整。建议下架
UPDATE questions SET disabled=1 WHERE id=285121 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285193: 重复题，保留 285607
UPDATE questions SET disabled=1 WHERE id=285193 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285197: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 260229
UPDATE questions SET disabled=1 WHERE id=285197 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285200: 缺表格：同 285121 重复题，依赖缺失表格。建议下架
UPDATE questions SET disabled=1 WHERE id=285200 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285203: 重复题，保留 285543
UPDATE questions SET disabled=1 WHERE id=285203 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285205: 重复题，保留 285124
UPDATE questions SET disabled=1 WHERE id=285205 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285286: 重复题，保留 285543
UPDATE questions SET disabled=1 WHERE id=285286 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285287: 清理广告/页码噪声；答案 C 正确（同 285114），但解析中混入页码与'获取试卷更新，请关注公众号：gwyeasy…'广告残留，清洗后回写；重复题，保留 285607
UPDATE questions SET disabled=1 WHERE id=285287 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285291: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 260229
UPDATE questions SET disabled=1 WHERE id=285291 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285299: 重复题，保留 285124
UPDATE questions SET disabled=1 WHERE id=285299 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285375: 缺表格：同 285121 重复题，依赖缺失表格。建议下架
UPDATE questions SET disabled=1 WHERE id=285375 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285379: 重复题，保留 285543
UPDATE questions SET disabled=1 WHERE id=285379 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285381: 清理广告/页码噪声；重复题，保留 260229
UPDATE questions SET disabled=1 WHERE id=285381 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285383: 重复题，保留 285124
UPDATE questions SET disabled=1 WHERE id=285383 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285600: 清理广告/页码噪声；重复题，保留 285124
UPDATE questions SET disabled=1 WHERE id=285600 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285610: 重复题，保留 260229
UPDATE questions SET disabled=1 WHERE id=285610 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285739: 重复题，保留 285282
UPDATE questions SET disabled=1 WHERE id=285739 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285742: 重复题，保留 285543
UPDATE questions SET disabled=1 WHERE id=285742 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285753: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 285204
UPDATE questions SET disabled=1 WHERE id=285753 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285755: 重复题，保留 285124
UPDATE questions SET disabled=1 WHERE id=285755 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=285998: 清理广告/页码噪声；重复题，保留 260143
UPDATE questions SET disabled=1 WHERE id=285998 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286094: 清理广告/页码噪声；补写解析（盲解一致后生成，人工抽检族）；人工复核：划线格式丢失且解析为空、选项混入广告文本
UPDATE questions SET disabled=1 WHERE id=286094 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286103: tag3 定标 UNKNOWN->CS-LS-05；清理广告/页码噪声；重复题，保留 286184
UPDATE questions SET disabled=1 WHERE id=286103 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286113: 清理广告/页码噪声；重复题，保留 286170
UPDATE questions SET disabled=1 WHERE id=286113 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286151: 重复题，保留 286081
UPDATE questions SET disabled=1 WHERE id=286151 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286180: 盲解分歧(C vs D)，复核模型未定论，保守保留并降分；重复题，保留 286089
UPDATE questions SET disabled=1 WHERE id=286180 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286181: 盲解分歧(C vs D)，复核模型未定论，保守保留并降分；重复题，保留 286104
UPDATE questions SET disabled=1 WHERE id=286181 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286182: 清理广告/页码噪声；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 286101
UPDATE questions SET disabled=1 WHERE id=286182 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286183: 重复题，保留 286100
UPDATE questions SET disabled=1 WHERE id=286183 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286335: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 286256
UPDATE questions SET disabled=1 WHERE id=286335 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286339: 清理广告/页码噪声；重复题，保留 286241
UPDATE questions SET disabled=1 WHERE id=286339 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286344: 清理广告/页码噪声；重复题，保留 286255
UPDATE questions SET disabled=1 WHERE id=286344 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286345: 重复题，保留 286253
UPDATE questions SET disabled=1 WHERE id=286345 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286448: 重复题，保留 283705
UPDATE questions SET disabled=1 WHERE id=286448 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286450: 人工复核：OCR 乱码严重（『和于树万树梨花开』『故正确答案为&』），题面与解析均不可靠
UPDATE questions SET disabled=1 WHERE id=286450 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286683: 题干关键数据丢失（'有 的家庭订阅某种日报，有 的家庭有电视机'两处分数缺失），解析亦缺公式，本题无法作答；且属数量关系题误归常识判断模块。建议下架
UPDATE questions SET disabled=1 WHERE id=286683 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286684: 属数量关系题误归常识判断模块；解析文字乱序且依赖缺失的示意图（'如图所示'无图），无法自证。建议下架
UPDATE questions SET disabled=1 WHERE id=286684 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=286967: 重复题，保留 286901
UPDATE questions SET disabled=1 WHERE id=286967 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=287089: 重复题，保留 286901
UPDATE questions SET disabled=1 WHERE id=287089 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=287211: 重复题，保留 286901
UPDATE questions SET disabled=1 WHERE id=287211 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=287278: 重复题，保留 286901
UPDATE questions SET disabled=1 WHERE id=287278 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=287350: 清理广告/页码噪声；重复题，保留 286901
UPDATE questions SET disabled=1 WHERE id=287350 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=287403: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=287403 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=287485: 清理广告/页码噪声；重复题，保留 286901
UPDATE questions SET disabled=1 WHERE id=287485 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=287556: 重复题，保留 286901
UPDATE questions SET disabled=1 WHERE id=287556 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=287707: 清理广告/页码噪声；选项 C 尾部混入广告残留'获取试卷更新，请关注公众号：gwyeasy（公务员考试挺简单）…'，清洗后回写；答案 A 正确（同日申请则使用在先者获准）；重复题，保留 286901
UPDATE questions SET disabled=1 WHERE id=287707 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=287764: 清理广告/页码噪声；人工复核：串题——题干为热胀冷缩，解析为图形推理题内容
UPDATE questions SET disabled=1 WHERE id=287764 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=288242: 重复题，保留 236969
UPDATE questions SET disabled=1 WHERE id=288242 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=288289: 清理广告/页码噪声；重复题，保留 330100
UPDATE questions SET disabled=1 WHERE id=288289 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=288290: 重复题，保留 288404
UPDATE questions SET disabled=1 WHERE id=288290 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=288405: 重复题，保留 288276
UPDATE questions SET disabled=1 WHERE id=288405 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=288410: 重复簇答案冲突人工裁定：定作人王某选任无资质承揽人有过失应担责，张某为受害雇员无责，正确答案 D（329862 答案错录且解析 OCR 严重）；重复题，保留 288282
UPDATE questions SET disabled=1 WHERE id=288410 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=288444: 重复题，保留 236969
UPDATE questions SET disabled=1 WHERE id=288444 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=288536: 重复簇答案冲突人工裁定：定作人王某选任无资质承揽人有过失应担责，张某为受害雇员无责，正确答案 D（329862 答案错录且解析 OCR 严重）；重复题，保留 288282
UPDATE questions SET disabled=1 WHERE id=288536 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=288550: 重复题，保留 288404
UPDATE questions SET disabled=1 WHERE id=288550 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=295519: 重复题，保留 236969
UPDATE questions SET disabled=1 WHERE id=295519 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=295537: 重复题，保留 288249
UPDATE questions SET disabled=1 WHERE id=295537 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=295816: 重复题，保留 332059
UPDATE questions SET disabled=1 WHERE id=295816 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=295817: 重复题，保留 332185
UPDATE questions SET disabled=1 WHERE id=295817 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=295825: 重复题，保留 332060
UPDATE questions SET disabled=1 WHERE id=295825 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=295830: 重复题，保留 332127
UPDATE questions SET disabled=1 WHERE id=295830 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=296106: 重复题，保留 262420
UPDATE questions SET disabled=1 WHERE id=296106 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=296116: 重复题，保留 334002
UPDATE questions SET disabled=1 WHERE id=296116 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=296122: 重复题，保留 332783
UPDATE questions SET disabled=1 WHERE id=296122 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=296651: 重复题，保留 262845
UPDATE questions SET disabled=1 WHERE id=296651 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=296653: 重复题，保留 262672
UPDATE questions SET disabled=1 WHERE id=296653 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=296657: 重复题，保留 237371
UPDATE questions SET disabled=1 WHERE id=296657 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=296660: 重复题，保留 262871
UPDATE questions SET disabled=1 WHERE id=296660 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=296662: 重复题，保留 262873
UPDATE questions SET disabled=1 WHERE id=296662 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297005: 重复题，保留 155534
UPDATE questions SET disabled=1 WHERE id=297005 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297035: 重复题，保留 321497
UPDATE questions SET disabled=1 WHERE id=297035 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297065: 重复题，保留 321454
UPDATE questions SET disabled=1 WHERE id=297065 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297071: 重复题，保留 321459
UPDATE questions SET disabled=1 WHERE id=297071 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297277: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321526
UPDATE questions SET disabled=1 WHERE id=297277 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297304: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321566
UPDATE questions SET disabled=1 WHERE id=297304 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297305: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321570
UPDATE questions SET disabled=1 WHERE id=297305 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297306: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321567
UPDATE questions SET disabled=1 WHERE id=297306 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297641: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321772
UPDATE questions SET disabled=1 WHERE id=297641 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297643: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321773
UPDATE questions SET disabled=1 WHERE id=297643 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297647: tag3 定标 UNKNOWN->CS-FL-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321774
UPDATE questions SET disabled=1 WHERE id=297647 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297651: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321780
UPDATE questions SET disabled=1 WHERE id=297651 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297652: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321782
UPDATE questions SET disabled=1 WHERE id=297652 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297654: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321781
UPDATE questions SET disabled=1 WHERE id=297654 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297656: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321787
UPDATE questions SET disabled=1 WHERE id=297656 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297661: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321788
UPDATE questions SET disabled=1 WHERE id=297661 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297670: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321796
UPDATE questions SET disabled=1 WHERE id=297670 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297677: tag3 定标 UNKNOWN->CS-GL-02；材料依赖题：题干'材料中提到…'但库中未收录对应材料，且解析为空，无法作答与核验。建议下架
UPDATE questions SET disabled=1 WHERE id=297677 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297678: 材料依赖题：同 297677，缺材料且解析为空。建议下架
UPDATE questions SET disabled=1 WHERE id=297678 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297680: 材料依赖题：'上面公文标题不规范'但库中无该公文原文，解析为空，无法独立核验。建议下架
UPDATE questions SET disabled=1 WHERE id=297680 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297681: 材料依赖题：'下列关于公文主送机关的修改意见'依赖缺失的公文原文，解析为空。建议下架
UPDATE questions SET disabled=1 WHERE id=297681 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297683: 材料依赖题：'上面公文需补充的内容'依赖缺失的公文原文，解析为空。建议下架
UPDATE questions SET disabled=1 WHERE id=297683 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297764: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321836
UPDATE questions SET disabled=1 WHERE id=297764 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297765: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321834
UPDATE questions SET disabled=1 WHERE id=297765 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297767: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321835
UPDATE questions SET disabled=1 WHERE id=297767 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297768: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321837
UPDATE questions SET disabled=1 WHERE id=297768 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297769: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321839
UPDATE questions SET disabled=1 WHERE id=297769 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297771: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321840
UPDATE questions SET disabled=1 WHERE id=297771 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297772: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321842
UPDATE questions SET disabled=1 WHERE id=297772 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297775: tag3 定标 UNKNOWN->CS-ZZ-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321843
UPDATE questions SET disabled=1 WHERE id=297775 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297777: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321847
UPDATE questions SET disabled=1 WHERE id=297777 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297780: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321850
UPDATE questions SET disabled=1 WHERE id=297780 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297782: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321851
UPDATE questions SET disabled=1 WHERE id=297782 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297783: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321853
UPDATE questions SET disabled=1 WHERE id=297783 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297792: 材料依赖题：'根据材料'但库中未收录材料（H区/D市案情仅零散出现），解析为空；且复议维持情形应以原机关和复议机关为共同被告，库答案 A 未含被告表述、存疑。建议下架
UPDATE questions SET disabled=1 WHERE id=297792 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297815: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321957
UPDATE questions SET disabled=1 WHERE id=297815 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297828: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321977
UPDATE questions SET disabled=1 WHERE id=297828 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297831: 盲解分歧(D vs B)，复核模型未定论，保守保留并降分；重复题，保留 321980
UPDATE questions SET disabled=1 WHERE id=297831 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297832: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321983
UPDATE questions SET disabled=1 WHERE id=297832 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297834: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321985
UPDATE questions SET disabled=1 WHERE id=297834 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297836: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321978
UPDATE questions SET disabled=1 WHERE id=297836 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297837: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321987
UPDATE questions SET disabled=1 WHERE id=297837 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297840: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321986
UPDATE questions SET disabled=1 WHERE id=297840 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297841: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321992
UPDATE questions SET disabled=1 WHERE id=297841 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297842: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321993
UPDATE questions SET disabled=1 WHERE id=297842 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297843: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321990
UPDATE questions SET disabled=1 WHERE id=297843 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297846: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321997
UPDATE questions SET disabled=1 WHERE id=297846 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297847: tag3 定标 None->CS-KJ-01；重复题，保留 321995
UPDATE questions SET disabled=1 WHERE id=297847 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297899: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321998
UPDATE questions SET disabled=1 WHERE id=297899 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297902: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 322002
UPDATE questions SET disabled=1 WHERE id=297902 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297903: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 322003
UPDATE questions SET disabled=1 WHERE id=297903 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297910: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 322006
UPDATE questions SET disabled=1 WHERE id=297910 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297911: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 322007
UPDATE questions SET disabled=1 WHERE id=297911 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297912: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 322008
UPDATE questions SET disabled=1 WHERE id=297912 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=297956: 题目自身缺陷：四个选项（溴化银淡黄色、银为银白色金属、溴单质红棕色、氯气黄绿色）均非'无色透明'，库答案 A（溴化银）与化学事实不符，解析为空无从考证，疑题干残缺。建议下架
UPDATE questions SET disabled=1 WHERE id=297956 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298192: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319187
UPDATE questions SET disabled=1 WHERE id=298192 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298194: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253347
UPDATE questions SET disabled=1 WHERE id=298194 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298195: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253348
UPDATE questions SET disabled=1 WHERE id=298195 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298196: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253349
UPDATE questions SET disabled=1 WHERE id=298196 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298197: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253350
UPDATE questions SET disabled=1 WHERE id=298197 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298199: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253358
UPDATE questions SET disabled=1 WHERE id=298199 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298200: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253351
UPDATE questions SET disabled=1 WHERE id=298200 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298201: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319196
UPDATE questions SET disabled=1 WHERE id=298201 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298202: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319197
UPDATE questions SET disabled=1 WHERE id=298202 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298203: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253355
UPDATE questions SET disabled=1 WHERE id=298203 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298204: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253354
UPDATE questions SET disabled=1 WHERE id=298204 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298205: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319200
UPDATE questions SET disabled=1 WHERE id=298205 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298206: tag3 定标 UNKNOWN->CS-JJ-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253353
UPDATE questions SET disabled=1 WHERE id=298206 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298208: tag3 定标 UNKNOWN->CS-ZZ-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 253357
UPDATE questions SET disabled=1 WHERE id=298208 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298209: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319204
UPDATE questions SET disabled=1 WHERE id=298209 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298210: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319205
UPDATE questions SET disabled=1 WHERE id=298210 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298222: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319231
UPDATE questions SET disabled=1 WHERE id=298222 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298226: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319235
UPDATE questions SET disabled=1 WHERE id=298226 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298236: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 260143
UPDATE questions SET disabled=1 WHERE id=298236 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298237: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 260229
UPDATE questions SET disabled=1 WHERE id=298237 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298239: tag3 定标 UNKNOWN->CS-KJ-04；缺表格：题干'阅读表格，依据探测资料判断'但库中无表格数据，无法作答。建议下架
UPDATE questions SET disabled=1 WHERE id=298239 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298243: 盲解分歧(C vs A)，复核模型未定论，保守保留并降分；重复题，保留 260245
UPDATE questions SET disabled=1 WHERE id=298243 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298244: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 260246
UPDATE questions SET disabled=1 WHERE id=298244 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298245: 补写解析（盲解一致后生成，人工抽检族）；重复簇答案冲突人工裁定：剧烈运动后乳酸堆积致肌肉酸痛属无氧呼吸，正确答案 A（酿米酒为先有氧后无氧发酵）；重复题，保留 236103
UPDATE questions SET disabled=1 WHERE id=298245 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298303: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 260935
UPDATE questions SET disabled=1 WHERE id=298303 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298379: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 288276
UPDATE questions SET disabled=1 WHERE id=298379 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298381: 补写解析（盲解一致后生成，人工抽检族）；重复簇答案冲突人工裁定：定作人王某选任无资质承揽人有过失应担责，张某为受害雇员无责，正确答案 D（329862 答案错录且解析 OCR 严重）；重复题，保留 288282
UPDATE questions SET disabled=1 WHERE id=298381 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298416: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 264525
UPDATE questions SET disabled=1 WHERE id=298416 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298417: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319705
UPDATE questions SET disabled=1 WHERE id=298417 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298419: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 319707
UPDATE questions SET disabled=1 WHERE id=298419 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298422: 人工复核：冬季气温低、空气中悬浮水滴少，不易出现彩虹，A 正确；主虹红光在外侧上方故 C 错，水滴越大彩虹越鲜明故 B 错，维持 A；解析为空；重复题，保留 264532
UPDATE questions SET disabled=1 WHERE id=298422 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298426: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 264536
UPDATE questions SET disabled=1 WHERE id=298426 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298507: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 265340
UPDATE questions SET disabled=1 WHERE id=298507 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298509: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 265342
UPDATE questions SET disabled=1 WHERE id=298509 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298524: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 265358
UPDATE questions SET disabled=1 WHERE id=298524 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298525: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 265359
UPDATE questions SET disabled=1 WHERE id=298525 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298602: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 265784
UPDATE questions SET disabled=1 WHERE id=298602 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298603: 人工复核：需读取日历图内容（年份/日期/节气），缺图无法作答
UPDATE questions SET disabled=1 WHERE id=298603 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298609: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 265790
UPDATE questions SET disabled=1 WHERE id=298609 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298611: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 265792
UPDATE questions SET disabled=1 WHERE id=298611 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298662: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 265979
UPDATE questions SET disabled=1 WHERE id=298662 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298663: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320171
UPDATE questions SET disabled=1 WHERE id=298663 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298664: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320172
UPDATE questions SET disabled=1 WHERE id=298664 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298666: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320174
UPDATE questions SET disabled=1 WHERE id=298666 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298669: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320177
UPDATE questions SET disabled=1 WHERE id=298669 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298678: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320186
UPDATE questions SET disabled=1 WHERE id=298678 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298679: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320187
UPDATE questions SET disabled=1 WHERE id=298679 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298680: 人工复核：当场处罚决定书由执法人员签名或盖章即可，无须加盖公安机关印章，C 为错误项，维持 C（治安案件当场罚款上限200元，本案150元程序合法）；解析为空；重复题，保留 320188
UPDATE questions SET disabled=1 WHERE id=298680 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298742: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 274858
UPDATE questions SET disabled=1 WHERE id=298742 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298743: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 274860
UPDATE questions SET disabled=1 WHERE id=298743 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298744: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 274861
UPDATE questions SET disabled=1 WHERE id=298744 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298745: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 274862
UPDATE questions SET disabled=1 WHERE id=298745 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298748: tag3 定标 UNKNOWN->CS-JJ-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 274863
UPDATE questions SET disabled=1 WHERE id=298748 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298749: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 274864
UPDATE questions SET disabled=1 WHERE id=298749 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298751: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320496
UPDATE questions SET disabled=1 WHERE id=298751 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298753: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 274865
UPDATE questions SET disabled=1 WHERE id=298753 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298814: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 295258
UPDATE questions SET disabled=1 WHERE id=298814 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298816: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 295260
UPDATE questions SET disabled=1 WHERE id=298816 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298817: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 295261
UPDATE questions SET disabled=1 WHERE id=298817 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298818: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 295262
UPDATE questions SET disabled=1 WHERE id=298818 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298819: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321164
UPDATE questions SET disabled=1 WHERE id=298819 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298821: tag3 定标 UNKNOWN->CS-FL-05；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321165
UPDATE questions SET disabled=1 WHERE id=298821 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298822: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282473
UPDATE questions SET disabled=1 WHERE id=298822 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298823: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320712
UPDATE questions SET disabled=1 WHERE id=298823 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298824: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282476
UPDATE questions SET disabled=1 WHERE id=298824 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298825: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320715
UPDATE questions SET disabled=1 WHERE id=298825 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298826: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282479
UPDATE questions SET disabled=1 WHERE id=298826 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298827: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282480
UPDATE questions SET disabled=1 WHERE id=298827 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298828: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282481
UPDATE questions SET disabled=1 WHERE id=298828 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298830: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320720
UPDATE questions SET disabled=1 WHERE id=298830 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298831: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320721
UPDATE questions SET disabled=1 WHERE id=298831 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298832: tag3 定标 UNKNOWN->CS-FL-05；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320722
UPDATE questions SET disabled=1 WHERE id=298832 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298833: 人工复核：A 错在查封整个商店（含居住房屋）超出必要范围，仅可查封扣押涉案假冒商品；市场监管部门可依《产品质量法》责令停止销售即暂停营业，维持 D；解析为空；重复题，保留 320723
UPDATE questions SET disabled=1 WHERE id=298833 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298834: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282484
UPDATE questions SET disabled=1 WHERE id=298834 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298887: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282646
UPDATE questions SET disabled=1 WHERE id=298887 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298889: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282650
UPDATE questions SET disabled=1 WHERE id=298889 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298890: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282649
UPDATE questions SET disabled=1 WHERE id=298890 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298891: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282648
UPDATE questions SET disabled=1 WHERE id=298891 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298892: tag3 定标 UNKNOWN->CS-JJ-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320810
UPDATE questions SET disabled=1 WHERE id=298892 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298893: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282652
UPDATE questions SET disabled=1 WHERE id=298893 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298894: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 282654
UPDATE questions SET disabled=1 WHERE id=298894 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298895: 人工复核：确权争议主体为村集体与村民小组，甲为承包合同相对人可被追加参与程序（A 正确）但对权属确认无独立请求权、不能径行复议，维持 A；解析为空；重复题，保留 320813
UPDATE questions SET disabled=1 WHERE id=298895 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298899: 人工复核：注销与吊销不同，注销资质证书系行政确认/登记行为而非行政处罚，A 说法不正确，维持 A；B 项表述亦有瑕疵（注销资质不消灭法人资格）但本题单选取 A，建议补写解析时说明；重复题，保留 320817
UPDATE questions SET disabled=1 WHERE id=298899 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298900: 更正前判：库答案 D 正确。官方解析（同题320818）引《行政复议法》第30条：认为具体行政行为侵犯其依法取得的土地、森林等自然资源使用权的应当先申请复议、复议前置，本案责令恢复原状涉及承包林地使用权，故应先向县政府申请复议。撤回此前 fixed A 的判定，维持 D；重复题，保留 320818
UPDATE questions SET disabled=1 WHERE id=298900 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298901: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 320819
UPDATE questions SET disabled=1 WHERE id=298901 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298956: tag3 定标 UNKNOWN->CS-JJ-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 295259
UPDATE questions SET disabled=1 WHERE id=298956 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=298962: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321167
UPDATE questions SET disabled=1 WHERE id=298962 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299018: tag3 定标 UNKNOWN->CS-ZZ-02；盲解分歧(AD vs A)，复核模型未定论，保守保留并降分；重复题，保留 321373
UPDATE questions SET disabled=1 WHERE id=299018 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299019: tag3 定标 UNKNOWN->CS-ZZ-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321374
UPDATE questions SET disabled=1 WHERE id=299019 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299020: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321375
UPDATE questions SET disabled=1 WHERE id=299020 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299022: tag3 定标 UNKNOWN->CS-DL-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321377
UPDATE questions SET disabled=1 WHERE id=299022 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299023: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321378
UPDATE questions SET disabled=1 WHERE id=299023 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299024: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321379
UPDATE questions SET disabled=1 WHERE id=299024 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299026: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321381
UPDATE questions SET disabled=1 WHERE id=299026 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299027: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321382
UPDATE questions SET disabled=1 WHERE id=299027 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299028: tag3 定标 UNKNOWN->CS-ZZ-03；答案错误：乡村建设行动明确'规划先行、不照搬城市模式'，D'按照城市住宅标准改造全村住房'违背政策精神，不能体现该要求；C 邀请专业部门制定村庄建设规划正是'统筹县域城镇和村庄建设'的体现，库答案 D 改为 C。解析为空；重复题，保留 321383
UPDATE questions SET disabled=1 WHERE id=299028 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299092: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321464
UPDATE questions SET disabled=1 WHERE id=299092 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299097: 盲解分歧(D vs C)，复核模型未定论，保守保留并降分；重复题，保留 321470
UPDATE questions SET disabled=1 WHERE id=299097 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299098: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321471
UPDATE questions SET disabled=1 WHERE id=299098 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299147: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321521
UPDATE questions SET disabled=1 WHERE id=299147 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299149: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321523
UPDATE questions SET disabled=1 WHERE id=299149 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299151: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321526
UPDATE questions SET disabled=1 WHERE id=299151 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299178: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321567
UPDATE questions SET disabled=1 WHERE id=299178 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299179: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321569
UPDATE questions SET disabled=1 WHERE id=299179 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299180: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321570
UPDATE questions SET disabled=1 WHERE id=299180 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299231: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321770
UPDATE questions SET disabled=1 WHERE id=299231 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299232: tag3 定标 UNKNOWN->CS-JJ-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321771
UPDATE questions SET disabled=1 WHERE id=299232 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299233: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321772
UPDATE questions SET disabled=1 WHERE id=299233 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299234: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321774
UPDATE questions SET disabled=1 WHERE id=299234 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299235: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321775
UPDATE questions SET disabled=1 WHERE id=299235 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299236: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321776
UPDATE questions SET disabled=1 WHERE id=299236 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299237: tag3 定标 UNKNOWN->CS-GL-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321777
UPDATE questions SET disabled=1 WHERE id=299237 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299238: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321778
UPDATE questions SET disabled=1 WHERE id=299238 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299239: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321779
UPDATE questions SET disabled=1 WHERE id=299239 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299240: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321781
UPDATE questions SET disabled=1 WHERE id=299240 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299241: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321782
UPDATE questions SET disabled=1 WHERE id=299241 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299242: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321783
UPDATE questions SET disabled=1 WHERE id=299242 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299243: tag3 定标 UNKNOWN->CS-GL-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321784
UPDATE questions SET disabled=1 WHERE id=299243 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299244: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321785
UPDATE questions SET disabled=1 WHERE id=299244 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299245: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321786
UPDATE questions SET disabled=1 WHERE id=299245 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299246: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321787
UPDATE questions SET disabled=1 WHERE id=299246 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299247: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321788
UPDATE questions SET disabled=1 WHERE id=299247 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299248: 答案错误：'问鼎之心'典出楚庄王问鼎中原，属春秋诸侯争霸；'否极泰来'出自《周易》与争霸无关，'草木皆兵'为东晋淝水之战、'纸上谈兵'为战国长平之战。库答案 A 改为 B。解析为空；重复题，保留 321789
UPDATE questions SET disabled=1 WHERE id=299248 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299249: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321790
UPDATE questions SET disabled=1 WHERE id=299249 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299250: 人工复核：被监控室越亮反射越强、单向透视效果越明显，C 正确；监控室应保持黑暗故 D 错、涂层未破坏光路可逆性故 A 错，维持 C；重复题，保留 321791
UPDATE questions SET disabled=1 WHERE id=299250 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299251: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321792
UPDATE questions SET disabled=1 WHERE id=299251 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299252: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321793
UPDATE questions SET disabled=1 WHERE id=299252 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299254: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321795
UPDATE questions SET disabled=1 WHERE id=299254 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299255: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321796
UPDATE questions SET disabled=1 WHERE id=299255 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299256: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321797
UPDATE questions SET disabled=1 WHERE id=299256 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299259: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321799
UPDATE questions SET disabled=1 WHERE id=299259 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299297: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321832
UPDATE questions SET disabled=1 WHERE id=299297 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299298: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321833
UPDATE questions SET disabled=1 WHERE id=299298 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299299: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321834
UPDATE questions SET disabled=1 WHERE id=299299 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299302: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321837
UPDATE questions SET disabled=1 WHERE id=299302 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299303: tag3 定标 UNKNOWN->CS-FL-08；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321838
UPDATE questions SET disabled=1 WHERE id=299303 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299304: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321839
UPDATE questions SET disabled=1 WHERE id=299304 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299306: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321841
UPDATE questions SET disabled=1 WHERE id=299306 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299310: 人工复核：地理南极点与地磁极不重合，磁场仍有水平分量，水平放置的指南针可稳定指向（且在南极点任何水平方向均为北），C 可成立，维持 C；重复题，保留 321848
UPDATE questions SET disabled=1 WHERE id=299310 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299311: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321849
UPDATE questions SET disabled=1 WHERE id=299311 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299313: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321850
UPDATE questions SET disabled=1 WHERE id=299313 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299315: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321852
UPDATE questions SET disabled=1 WHERE id=299315 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299318: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321856
UPDATE questions SET disabled=1 WHERE id=299318 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299320: tag3 定标 UNKNOWN->CS-ZZ-02；盲解分歧(ACD vs A)，复核模型未定论，保守保留并降分；重复题，保留 321860
UPDATE questions SET disabled=1 WHERE id=299320 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299340: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321950
UPDATE questions SET disabled=1 WHERE id=299340 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299341: 人工复核：反应可逆不完全，室内弱光下镜片中仍存少量 Ag，D'无 Ag'错误，为选非项，维持 D；题干'发生下列反应：'后化学方程式缺失，需补全；重复题，保留 321951
UPDATE questions SET disabled=1 WHERE id=299341 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299359: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321978
UPDATE questions SET disabled=1 WHERE id=299359 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299360: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321979
UPDATE questions SET disabled=1 WHERE id=299360 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299363: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321982
UPDATE questions SET disabled=1 WHERE id=299363 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299364: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321983
UPDATE questions SET disabled=1 WHERE id=299364 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299365: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321984
UPDATE questions SET disabled=1 WHERE id=299365 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299366: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321985
UPDATE questions SET disabled=1 WHERE id=299366 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299369: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321988
UPDATE questions SET disabled=1 WHERE id=299369 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299372: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321991
UPDATE questions SET disabled=1 WHERE id=299372 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299375: tag3 定标 UNKNOWN->CS-KJ-03；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321994
UPDATE questions SET disabled=1 WHERE id=299375 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299377: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321996
UPDATE questions SET disabled=1 WHERE id=299377 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299380: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 321999
UPDATE questions SET disabled=1 WHERE id=299380 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299381: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 322000
UPDATE questions SET disabled=1 WHERE id=299381 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=299452: 重复题，保留 151626
UPDATE questions SET disabled=1 WHERE id=299452 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=306207: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 240365
UPDATE questions SET disabled=1 WHERE id=306207 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=318780: tag3 定标 UNKNOWN->CS-JJ-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243951
UPDATE questions SET disabled=1 WHERE id=318780 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=318781: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243952
UPDATE questions SET disabled=1 WHERE id=318781 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=318782: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243953
UPDATE questions SET disabled=1 WHERE id=318782 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=318783: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243954
UPDATE questions SET disabled=1 WHERE id=318783 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=318784: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243955
UPDATE questions SET disabled=1 WHERE id=318784 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=318785: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243956
UPDATE questions SET disabled=1 WHERE id=318785 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=318842: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 246809
UPDATE questions SET disabled=1 WHERE id=318842 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=318850: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 246812
UPDATE questions SET disabled=1 WHERE id=318850 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=318854: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 246810
UPDATE questions SET disabled=1 WHERE id=318854 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=319092: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 295252
UPDATE questions SET disabled=1 WHERE id=319092 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=319096: 缺图：题干'如图所示'，①-④水缸的差异（口径/是否加盖等）只能由图判断，库中无图无法作答；解析为空。建议下架
UPDATE questions SET disabled=1 WHERE id=319096 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=319097: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 295254
UPDATE questions SET disabled=1 WHERE id=319097 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=319098: tag3 定标 UNKNOWN->CS-KJ-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 295253
UPDATE questions SET disabled=1 WHERE id=319098 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=319519: 重复题，保留 288276
UPDATE questions SET disabled=1 WHERE id=319519 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=319523: 重复簇答案冲突人工裁定：定作人王某选任无资质承揽人有过失应担责，张某为受害雇员无责，正确答案 D（329862 答案错录且解析 OCR 严重）；重复题，保留 288282
UPDATE questions SET disabled=1 WHERE id=319523 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=320342: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 272844
UPDATE questions SET disabled=1 WHERE id=320342 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=320489: 重复题，保留 274861
UPDATE questions SET disabled=1 WHERE id=320489 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=320493: 重复题，保留 274863
UPDATE questions SET disabled=1 WHERE id=320493 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=320498: 重复题，保留 274865
UPDATE questions SET disabled=1 WHERE id=320498 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=320711: 重复题，保留 282473
UPDATE questions SET disabled=1 WHERE id=320711 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=320714: 重复题，保留 282476
UPDATE questions SET disabled=1 WHERE id=320714 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=320724: 重复题，保留 282484
UPDATE questions SET disabled=1 WHERE id=320724 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=321955: 人工复核：作答依赖图中小球运动轨迹曲线方向，缺图无法作答
UPDATE questions SET disabled=1 WHERE id=321955 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=328828: 重复题，保留 150702
UPDATE questions SET disabled=1 WHERE id=328828 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=329855: 重复题，保留 288276
UPDATE questions SET disabled=1 WHERE id=329855 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=329857: 清理广告/页码噪声；重复题，保留 288404
UPDATE questions SET disabled=1 WHERE id=329857 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=329862: 答案错误：解析结论明确'故正确答案为 D'（王某选任无资质承包人有过失应担责，李某作为接受帮工方担责，张某无重大过失不担责），库答案 B 与解析矛盾，改为 D；解析后半段混入婚姻法收养题内容（串题）且 OCR 错字多，需清理重写；重复簇答案冲突人工裁定：定作人王某选任无资质承揽人有过失应担责，张某为受害雇员无责，正确答案 D（329862 答案错录且解析 OCR 严重）（本题库内答案 B 有误）；重复题，保留 288282
UPDATE questions SET disabled=1 WHERE id=329862 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330106: 重复题，保留 288249
UPDATE questions SET disabled=1 WHERE id=330106 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330111: 重复题，保留 236969
UPDATE questions SET disabled=1 WHERE id=330111 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330152: 重复题，保留 288276
UPDATE questions SET disabled=1 WHERE id=330152 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330160: 重复簇答案冲突人工裁定：定作人王某选任无资质承揽人有过失应担责，张某为受害雇员无责，正确答案 D（329862 答案错录且解析 OCR 严重）；重复题，保留 288282
UPDATE questions SET disabled=1 WHERE id=330160 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330161: 重复题，保留 330100
UPDATE questions SET disabled=1 WHERE id=330161 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330265: 重复簇答案冲突人工裁定：定作人王某选任无资质承揽人有过失应担责，张某为受害雇员无责，正确答案 D（329862 答案错录且解析 OCR 严重）；重复题，保留 288282
UPDATE questions SET disabled=1 WHERE id=330265 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330324: 重复题，保留 236969
UPDATE questions SET disabled=1 WHERE id=330324 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330394: 重复题，保留 288249
UPDATE questions SET disabled=1 WHERE id=330394 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330649: 重复簇答案冲突人工裁定：定作人王某选任无资质承揽人有过失应担责，张某为受害雇员无责，正确答案 D（329862 答案错录且解析 OCR 严重）；重复题，保留 288282
UPDATE questions SET disabled=1 WHERE id=330649 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330826: 模块错置：本题为言语理解逻辑填空题（选填诗句），不属常识判断；答案 D 经核可靠但应移出本模块。建议下架（或迁移至言语模块）
UPDATE questions SET disabled=1 WHERE id=330826 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330834: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=330834 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=330916: 重复簇答案冲突人工裁定：定作人王某选任无资质承揽人有过失应担责，张某为受害雇员无责，正确答案 D（329862 答案错录且解析 OCR 严重）；重复题，保留 288282
UPDATE questions SET disabled=1 WHERE id=330916 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331165: 重复题，保留 331575
UPDATE questions SET disabled=1 WHERE id=331165 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331170: 重复题，保留 332286
UPDATE questions SET disabled=1 WHERE id=331170 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331174: 重复题，保留 262004
UPDATE questions SET disabled=1 WHERE id=331174 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331177: 人工复核：陆机字士衡，机（天玑）衡（玉衡）均北斗星名、意义相近互为辅助，D 正确；孟轲字子舆为同义反复，维持 D；重复题，保留 261989
UPDATE questions SET disabled=1 WHERE id=331177 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331178: 人工复核：选项文本截断错乱（A/B/D 仅剩片段），无法可靠重建
UPDATE questions SET disabled=1 WHERE id=331178 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331181: 重复题，保留 332281
UPDATE questions SET disabled=1 WHERE id=331181 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331237: 清理广告/页码噪声；重复题，保留 331297
UPDATE questions SET disabled=1 WHERE id=331237 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331493: 清理广告/页码噪声；重复题，保留 331123
UPDATE questions SET disabled=1 WHERE id=331493 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331496: 清理广告/页码噪声；重复题，保留 332185
UPDATE questions SET disabled=1 WHERE id=331496 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331497: 重复题，保留 332059
UPDATE questions SET disabled=1 WHERE id=331497 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331642: 人工复核：同 331177，维持 D；解析 OCR 损坏严重（'名霜，字子全''刀热'等错字连篇），需以 331177 的干净解析替换；重复题，保留 261989
UPDATE questions SET disabled=1 WHERE id=331642 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331667: 清理广告/页码噪声；重复题，保留 332281
UPDATE questions SET disabled=1 WHERE id=331667 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331680: 重复题，保留 262004
UPDATE questions SET disabled=1 WHERE id=331680 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331886: 重复题，保留 331123
UPDATE questions SET disabled=1 WHERE id=331886 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=331889: 清理广告/页码噪声；人工复核：晏殊婉约派、'无可奈何花落去'仍是婉约风格，不能体现反差，B 为选非项，维持 B；重复题，保留 332059
UPDATE questions SET disabled=1 WHERE id=331889 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332062: 重复题，保留 331123
UPDATE questions SET disabled=1 WHERE id=332062 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332117: 重复题，保留 332059
UPDATE questions SET disabled=1 WHERE id=332117 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332118: 清理广告/页码噪声；重复题，保留 332185
UPDATE questions SET disabled=1 WHERE id=332118 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332290: 重复题，保留 262004
UPDATE questions SET disabled=1 WHERE id=332290 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332291: 清理广告/页码噪声；人工复核：同 331177，维持 D；解析中混入页码与公众号广告文本（'获取试卷更新，请关注公众号：gwyeasy…'），需清理；重复题，保留 261989
UPDATE questions SET disabled=1 WHERE id=332291 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332356: 人工复核：多选题（解析结论 AD）
UPDATE questions SET disabled=1 WHERE id=332356 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332357: 人工复核：多选题（解析结论 BCD）
UPDATE questions SET disabled=1 WHERE id=332357 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332368: 重复题，保留 332281
UPDATE questions SET disabled=1 WHERE id=332368 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332371: 重复题，保留 331575
UPDATE questions SET disabled=1 WHERE id=332371 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332378: 重复题，保留 262004
UPDATE questions SET disabled=1 WHERE id=332378 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332529: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=332529 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332779: 人工复核：法治国家、法治政府、法治社会基本建成属 2035 年目标，共同富裕基本实现/治理现代化实现/综合国力领先均为本世纪中叶目标，维持 D；重复题，保留 333380
UPDATE questions SET disabled=1 WHERE id=332779 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332781: 重复题，保留 296111
UPDATE questions SET disabled=1 WHERE id=332781 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332831: 重复题，保留 333329
UPDATE questions SET disabled=1 WHERE id=332831 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332835: 重复题，保留 237160
UPDATE questions SET disabled=1 WHERE id=332835 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332969: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=332969 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332971: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 332898
UPDATE questions SET disabled=1 WHERE id=332971 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=332973: 重复题，保留 332901
UPDATE questions SET disabled=1 WHERE id=332973 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333147: 重复题，保留 333329
UPDATE questions SET disabled=1 WHERE id=333147 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333148: 重复题，保留 332832
UPDATE questions SET disabled=1 WHERE id=333148 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333149: 重复题，保留 332833
UPDATE questions SET disabled=1 WHERE id=333149 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333189: 重复题，保留 333329
UPDATE questions SET disabled=1 WHERE id=333189 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333197: 重复题，保留 333156
UPDATE questions SET disabled=1 WHERE id=333197 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333284: 清理广告/页码噪声；重复题，保留 283539
UPDATE questions SET disabled=1 WHERE id=333284 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333382: 重复题，保留 237148
UPDATE questions SET disabled=1 WHERE id=333382 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333446: 重复题，保留 237160
UPDATE questions SET disabled=1 WHERE id=333446 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333514: 清理广告/页码噪声；重复题，保留 333199
UPDATE questions SET disabled=1 WHERE id=333514 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333731: 重复题，保留 237148
UPDATE questions SET disabled=1 WHERE id=333731 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333737: 重复题，保留 334002
UPDATE questions SET disabled=1 WHERE id=333737 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333741: 重复题，保留 332783
UPDATE questions SET disabled=1 WHERE id=333741 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333882: 重复题，保留 333199
UPDATE questions SET disabled=1 WHERE id=333882 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333889: 清理广告/页码噪声；重复题，保留 296112
UPDATE questions SET disabled=1 WHERE id=333889 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333891: 重复题，保留 334002
UPDATE questions SET disabled=1 WHERE id=333891 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=333996: 重复题，保留 237148
UPDATE questions SET disabled=1 WHERE id=333996 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334005: 重复题，保留 332783
UPDATE questions SET disabled=1 WHERE id=334005 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334020: 重复题，保留 333199
UPDATE questions SET disabled=1 WHERE id=334020 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334302: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=334302 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334487: 人工复核：解析串题（解析内容属于另一道题），答案可靠性无法追溯
UPDATE questions SET disabled=1 WHERE id=334487 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334495: 清理广告/页码噪声；重复题，保留 263113
UPDATE questions SET disabled=1 WHERE id=334495 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334499: 重复题，保留 237627
UPDATE questions SET disabled=1 WHERE id=334499 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334503: 重复题，保留 263716
UPDATE questions SET disabled=1 WHERE id=334503 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334505: tag3 定标 UNKNOWN->CS-ZZ-03；清理广告/页码噪声；人工复核：非洲猪瘟有奖举报特别重大贡献奖励不超过3万元，C '10万元'不正确为选非项，维持 C；重复题，保留 237547
UPDATE questions SET disabled=1 WHERE id=334505 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334728: 重复题，保留 238992
UPDATE questions SET disabled=1 WHERE id=334728 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334729: 重复题，保留 238993
UPDATE questions SET disabled=1 WHERE id=334729 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334731: 重复题，保留 238995
UPDATE questions SET disabled=1 WHERE id=334731 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334732: 重复题，保留 238996
UPDATE questions SET disabled=1 WHERE id=334732 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334735: 重复题，保留 238999
UPDATE questions SET disabled=1 WHERE id=334735 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334736: 重复题，保留 239000
UPDATE questions SET disabled=1 WHERE id=334736 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334745: 重复题，保留 239010
UPDATE questions SET disabled=1 WHERE id=334745 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334748: 重复题，保留 239013
UPDATE questions SET disabled=1 WHERE id=334748 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334749: 重复题，保留 239014
UPDATE questions SET disabled=1 WHERE id=334749 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334750: 人工复核：立法意义在制度保障、明确职责、示范作用（①②④），③属法律本身对公众权利的保障，维持 B；重复题，保留 239015
UPDATE questions SET disabled=1 WHERE id=334750 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334835: 人工复核：题干中部被 (cid:) 乱码吞没关键案情（处罚决定情节缺失），无法作答
UPDATE questions SET disabled=1 WHERE id=334835 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334844: 题干损坏：'为检验新黏合剂的效'后为 (cid:7716) 乱码、实验结果段缺失，无法完整作答（D 项依赖缺失的实验结果）；且本题为言语理解细节判断题误入常识模块。建议下架
UPDATE questions SET disabled=1 WHERE id=334844 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334849: 题干损坏：'极尽所能地去'后为 (cid:7716) 乱码、文段后半缺失，无法作答；且为言语理解题误入常识模块。建议下架
UPDATE questions SET disabled=1 WHERE id=334849 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=334898: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 334650
UPDATE questions SET disabled=1 WHERE id=334898 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=341347: 重复题，保留 162840
UPDATE questions SET disabled=1 WHERE id=341347 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=341351: 重复题，保留 178039
UPDATE questions SET disabled=1 WHERE id=341351 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=361405: 重复题，保留 154945
UPDATE questions SET disabled=1 WHERE id=361405 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=361646: 重复题，保留 167923
UPDATE questions SET disabled=1 WHERE id=361646 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=376354: 清理广告/页码噪声；答案错误：锂离子电池优势为重量轻、绿色环保（无镉铅）、高低温适应性强（①③④），其安全性（易燃易爆风险）劣于镍氢电池，②不成立，应选 B（同题 334504 库答案即为 B）；库答案 A 含②错误。题干混入公众号广告文本需清理，解析为空；重复题，保留 263052
UPDATE questions SET disabled=1 WHERE id=376354 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=376357: tag3 定标 UNKNOWN->CS-LS-05；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 263045
UPDATE questions SET disabled=1 WHERE id=376357 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=376361: 清理广告/页码噪声；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 263113
UPDATE questions SET disabled=1 WHERE id=376361 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=376363: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 237548
UPDATE questions SET disabled=1 WHERE id=376363 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=376366: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 237546
UPDATE questions SET disabled=1 WHERE id=376366 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=376489: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 334897
UPDATE questions SET disabled=1 WHERE id=376489 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=376492: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 334900
UPDATE questions SET disabled=1 WHERE id=376492 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=376493: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 334901
UPDATE questions SET disabled=1 WHERE id=376493 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=376642: 重复题，保留 157014
UPDATE questions SET disabled=1 WHERE id=376642 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=378719: 重复题，保留 162249
UPDATE questions SET disabled=1 WHERE id=378719 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=378721: 重复题，保留 18085
UPDATE questions SET disabled=1 WHERE id=378721 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=379044: 重复题，保留 178044
UPDATE questions SET disabled=1 WHERE id=379044 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=385864: 重复题，保留 305871
UPDATE questions SET disabled=1 WHERE id=385864 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=388333: 重复题，保留 192954
UPDATE questions SET disabled=1 WHERE id=388333 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=567010: 重复题，保留 322259
UPDATE questions SET disabled=1 WHERE id=567010 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=567014: 重复题，保留 165285
UPDATE questions SET disabled=1 WHERE id=567014 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=896367: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243388
UPDATE questions SET disabled=1 WHERE id=896367 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=896371: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241833
UPDATE questions SET disabled=1 WHERE id=896371 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=896372: 人工复核：新疆八大产业集群为油气、煤炭煤电煤化工、绿色矿业、粮油、棉花棉纺、果蔬、畜产品、新能源新材料；B 霍尔果斯汽车出口口岸属口岸/开放经济成果，不属八大产业集群，B 正确；我误选A(天然气制乙二醇属油气化工集群成果)，库答案 B 无误；重复题，保留 243084
UPDATE questions SET disabled=1 WHERE id=896372 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=896417: tag3 定标 UNKNOWN->CS-DL-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241423
UPDATE questions SET disabled=1 WHERE id=896417 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=896419: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241496
UPDATE questions SET disabled=1 WHERE id=896419 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046520: tag3 定标 None->CS-ZZ-03；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241409
UPDATE questions SET disabled=1 WHERE id=1046520 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046521: tag3 定标 None->CS-ZZ-03；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241410
UPDATE questions SET disabled=1 WHERE id=1046521 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046522: tag3 定标 None->CS-FL-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241411
UPDATE questions SET disabled=1 WHERE id=1046522 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046523: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241413
UPDATE questions SET disabled=1 WHERE id=1046523 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046524: tag3 定标 None->CS-ZZ-02；人工复核：D 所述“变群众上访为领导下访”是浦江经验的主要内容，非枫桥经验(枫桥经验为发动和依靠群众就地化解矛盾)，故 D 表述不正确，本题选 D；我误选C，经核对官方表述确认库答案 D 无误；重复题，保留 241414
UPDATE questions SET disabled=1 WHERE id=1046524 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046526: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241417
UPDATE questions SET disabled=1 WHERE id=1046526 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046527: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241418
UPDATE questions SET disabled=1 WHERE id=1046527 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046531: tag3 定标 None->CS-KJ-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241422
UPDATE questions SET disabled=1 WHERE id=1046531 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046532: tag3 定标 None->CS-KJ-02；补写解析（盲解一致后生成，人工抽检族）；重复簇答案冲突人工裁定：脱脂奶去除的是脂肪，乳糖酶用于低乳糖奶，对应错误项 C，正确答案 C（264606 答案错录且解析为无关噪声）；重复题，保留 241424
UPDATE questions SET disabled=1 WHERE id=1046532 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046533: tag3 定标 None->CS-KJ-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241425
UPDATE questions SET disabled=1 WHERE id=1046533 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046535: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241919
UPDATE questions SET disabled=1 WHERE id=1046535 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046536: tag3 定标 None->CS-FL-09；人工复核：①应为国家网信部门统筹(非教育部门)、⑤条例明确禁止引导未成年人应援集资打榜刷量，均错误；②③④正确，共3项，B 正确；我截断阅读未见⑤误判4项，库答案 B 无误；重复题，保留 241823
UPDATE questions SET disabled=1 WHERE id=1046536 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046540: tag3 定标 None->CS-ZZ-02；人工复核：完整题干共⑤条，①-⑤均为习近平关于中国式现代化与中华文明关系的原文表述，5项全对选 D；我截断阅读只见4条误选C，库答案 D 无误；重复题，保留 241491
UPDATE questions SET disabled=1 WHERE id=1046540 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046541: tag3 定标 None->CS-ZZ-03；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241734
UPDATE questions SET disabled=1 WHERE id=1046541 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046542: tag3 定标 None->CS-ZZ-03；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 242080
UPDATE questions SET disabled=1 WHERE id=1046542 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046543: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 242721
UPDATE questions SET disabled=1 WHERE id=1046543 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046544: tag3 定标 None->CS-ZZ-04；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241495
UPDATE questions SET disabled=1 WHERE id=1046544 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046546: tag3 定标 None->CS-FL-08；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241656
UPDATE questions SET disabled=1 WHERE id=1046546 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046547: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241499
UPDATE questions SET disabled=1 WHERE id=1046547 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046552: 人工复核：①种业②农资保供稳价③高标准农田⑤耕地红线均属提升粮食产能举措共4项，④光盘行动属节约消费不属产能，选 C；我误将②农资保供排除选B(3项)，经核中央农村工作会议表述确认库答案 C 无误；重复题，保留 241493
UPDATE questions SET disabled=1 WHERE id=1046552 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046553: tag3 定标 None->CS-ZZ-02；人工复核：完整题干共⑤条，①-⑤均为习近平法治思想原文表述(⑤加强重点领域新兴领域涉外领域立法亦正确)，5项全对选 D；我截断阅读只见4条误选C，库答案 D 无误；重复题，保留 241494
UPDATE questions SET disabled=1 WHERE id=1046553 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046555: tag3 定标 None->CS-KJ-01；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241504
UPDATE questions SET disabled=1 WHERE id=1046555 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046556: tag3 定标 None->CS-KJ-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241505
UPDATE questions SET disabled=1 WHERE id=1046556 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046557: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241506
UPDATE questions SET disabled=1 WHERE id=1046557 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046565: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 241816
UPDATE questions SET disabled=1 WHERE id=1046565 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046570: tag3 定标 None->CS-LS-05；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 242173
UPDATE questions SET disabled=1 WHERE id=1046570 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046572: tag3 定标 None->CS-LS-05；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 242085
UPDATE questions SET disabled=1 WHERE id=1046572 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046580: tag3 定标 None->CS-ZZ-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 242519
UPDATE questions SET disabled=1 WHERE id=1046580 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046629: tag3 定标 None->CS-ZZ-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243387
UPDATE questions SET disabled=1 WHERE id=1046629 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046630: tag3 定标 None->CS-ZZ-03；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243389
UPDATE questions SET disabled=1 WHERE id=1046630 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046631: tag3 定标 None->CS-ZZ-03；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243390
UPDATE questions SET disabled=1 WHERE id=1046631 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046632: tag3 定标 None->CS-ZZ-02；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243391
UPDATE questions SET disabled=1 WHERE id=1046632 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046634: 补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243393
UPDATE questions SET disabled=1 WHERE id=1046634 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1046635: tag3 定标 None->CS-ZZ-04；补写解析（盲解一致后生成，人工抽检族）；重复题，保留 243394
UPDATE questions SET disabled=1 WHERE id=1046635 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272246: 重复题，保留 234109
UPDATE questions SET disabled=1 WHERE id=1272246 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272276: 人工复核：A“请保管好随身物品”属善意提醒不构成免责格式条款，合法；B 衣物丢失行业规定最高可获洗衣费20倍赔偿，仅赔二倍属限制消费者权利，不合法；我误判B合法，库答案 A 无误；重复题，保留 234535
UPDATE questions SET disabled=1 WHERE id=1272276 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272287: 重复题，保留 234703
UPDATE questions SET disabled=1 WHERE id=1272287 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272294: 重复题，保留 235282
UPDATE questions SET disabled=1 WHERE id=1272294 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272299: 人工复核：A 深化LPR改革引导贷款利率下行直接降低小微融资成本，最有助于新增融资流向中小微；D 对无贷款记录企业优先放贷并非针对小微且不审慎；我误选D，库答案 A 无误；重复簇答案冲突人工裁定：首贷政策：优先支持征信无贷款记录企业贷款最有助于新增融资流向小微企业，正确答案 D（本题库内答案 A 有误）；重复题，保留 235527
UPDATE questions SET disabled=1 WHERE id=1272299 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272300: 重复题，保留 235530
UPDATE questions SET disabled=1 WHERE id=1272300 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272301: 重复题，保留 235532
UPDATE questions SET disabled=1 WHERE id=1272301 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272306: 重复题，保留 235621
UPDATE questions SET disabled=1 WHERE id=1272306 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272307: 重复题，保留 235538
UPDATE questions SET disabled=1 WHERE id=1272307 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272309: 重复题，保留 235541
UPDATE questions SET disabled=1 WHERE id=1272309 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272333: 重复题，保留 235786
UPDATE questions SET disabled=1 WHERE id=1272333 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272373: 人工复核：普惠金融意见基本原则五条(党的领导/人民至上/政策引领/改革创新/安全发展)与①-⑤逐一对应，5项全属，选 D；我误排除③(政策引领原则原文即含③表述)，库答案 D 无误；重复题，保留 246008
UPDATE questions SET disabled=1 WHERE id=1272373 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272398: 重复题，保留 245990
UPDATE questions SET disabled=1 WHERE id=1272398 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272411: 重复题，保留 246029
UPDATE questions SET disabled=1 WHERE id=1272411 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272412: 重复题，保留 246030
UPDATE questions SET disabled=1 WHERE id=1272412 AND module='changshi' AND (disabled IS NULL OR disabled=0);
-- id=1272413: 重复题，保留 246034
UPDATE questions SET disabled=1 WHERE id=1272413 AND module='changshi' AND (disabled IS NULL OR disabled=0);
