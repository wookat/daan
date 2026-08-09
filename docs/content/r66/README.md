# 轮66：发现线例行 + 其他模块 <50 专项诊断

日期：2026-08-09 ｜ 分支：devin/1786312304-r62（PR#115）｜ 生产库：/data/data.db（active 112,962）

## 0. 结论速览

- H5/SEO 全路径快回归全过，JS 报错 0；年份页爬虫持续到访（Yandex 58 次 + Bing 1 次，全 200）；Bing site: 仍未确认破零。
- **专项诊断核心发现：2,211 条"其他模块 <50"是过期打分假队列，不是内容质量问题。** 逐条按现行 `quality.py` 口径复算，2,211/2,211 条全部 ≥50（分布 50-79）；每模块抽 10 条共 40 条人工通读，题干/选项/答案/解析均完整正确，无一条需要内容改写或下架。
- 根因：这批题的 hs_explanation 等字段在历史轮次补齐后，`quality_score` 列未重新跑分（存量打分早于补齐动作）。全库扫描另发现 47,482 条同类过期分（复算后均仍 ≥50，只升不降）。
- 处置：备份后仅刷新派生列 `quality_score`（守卫事务 2,211 条逐条断言 ≥50 后写回），随后跑官方 `score_all` 全库刷分归一。**未触碰任何题干/选项/答案/解析/考点/disabled 内容字段。**
- 终局：全库 active `quality_score<50` = 0。四模块低分队列不需要另立批量重写专项。
- 健康快扫全绿；空缺仅 2 条台账题（panduan:334296、changshi:655861）。

## 1. QA 例行

### 1.1 H5 全路径快走（Playwright 390px）

首页 / 练习 / 错题本 / 统计 / 打卡日历 / 我的 / 问答 7 页面全部正常渲染，页面错误与 console 错误 0；SEO 直链 `/#/pages/practice/practice?tag3=CS-LS-01&module=changshi&source=seo` 自动开练正常。

### 1.2 SEO 路由回归

`/`、`/tiku/`、`/tiku/q/618800`、`/tiku/t/CS-LS-01/`、`/tiku/y/2024/changshi/`、`/sitemap.xml`、`/sitemap-topics.xml`、`/sitemap-years.xml`、`/robots.txt` 全 200；越界页 `/tiku/t/CS-LS-01/?page=999` 与无效年份 `/tiku/y/1999/changshi/` 均正确 404。

### 1.3 爬虫观测（access 归档 access-20260809.jsonl，共 1,537 行）

| 项 | 数值 |
|---|---|
| 爬虫请求总数 | 59（全部 200） |
| YandexBot | 58 |
| bingbot | 1 |
| 命中 /tiku/y（年份页） | 57 |
| robots.txt / indexnow-key.txt | 各 1 |

年份页对 Yandex 的吸引持续成立；Bing 到访仍为个位数。**Bing `site:kaogong.zalize.com` 未确认到任何收录结果**（照实报：抓取≠收录，提交≠收录）。

## 2. 其他模块 <50 专项诊断（2,211 条）

### 2.1 存量分布（诊断起点，按存量 quality_score）

| 模块 | 条数 | 存量分范围 |
|---|---|---|
| ziliao | 1,110 | 42-48 |
| yanyu | 1,003 | 43-48 |
| panduan | 87 | 46-48 |
| shuliang | 11 | 48 |
| 合计 | 2,211 | 全部 40-49 段（无 <40） |

来源构成：除 panduan 含 26 条 2024 省考真题外，其余 2,185 条均为 original 原创题；2,211 条全部同时具备 explanation 与 hs_explanation（yanyu 1,003 条双解析齐全率 100%）。

### 2.2 每模块抽 10 条人工判定（seed=66 固定随机，共 40 条）

- **panduan（10 条）**：定义判断 2 + 类比推理 5 + 逻辑判断 3。题干规范、选项四项均衡、答案与解析一致；类比推理题 explanation 为空但 hs 解析完整（83-97 字），属该题型常规形态。问题类型判定：**无内容缺陷**。
- **shuliang（10 条）**：工程/最值/行程/方阵/数列。数值选项 + 完整两解析（hs 74-208 字，含步骤），逐题验算答案正确。判定：**无内容缺陷**。
- **yanyu（10 条）**：中心理解/语句排序/细节理解/逻辑填空。题干自然、干扰项设计合理、双解析齐全（80-190 字）。判定：**无内容缺陷**。
- **ziliao（10 条）**：材料+计算题，材料给足基期数据、答案验算正确、双解析在位。判定：**无内容缺陷**（约 52/1,110 条 explanation <80 字，但 hs 补足，不构成缺陷）。

40/40 条均无需改写、无需下架、无事实/答案问题。

### 2.3 根因判定：过期打分

将 2,211 条逐条按现行 `backend/app/quality.py::score_question` 复算：**2,211/2,211 条复算分与存量分不一致，且复算后全部 ≥50**（still<50 = 0）。即存量 40-49 分是历史打分快照，晚于打分的 hs 补齐/内容治理动作未回写分数。全库扫描确认 active 112,962 条中另有 47,482 条同类过期分，复算后均仍 ≥50（无一条会跌破 50）。

### 2.4 处置（仅刷新派生列，零内容变更）

1. 备份 `/data/bak_r66_rescore2211.db`；
2. 守卫事务逐条复算写回 2,211 条 `quality_score`（逐条断言复算 ≥50、rowcount=1，总数断言 2211）——刷新后分布：50-59 段 6 条、60-69 段 1,024 条、70-79 段 1,181 条；
3. 跑官方 `score_all` 全库刷分归一（156,792 行含下架题，14 秒），消除全部过期分；
4. 复验：active `quality_score<50` = 0。

红线遵守：未修改任何 question/options/answer/explanation/hs_explanation/tag/module/submodule/disabled 字段；quality_score 为可随时重算的派生列。

### 2.5 各模块治理口径（结论）

- **四模块（ziliao/yanyu/panduan/shuliang）均不需要批量内容重写专项**：低分队列系打分过期假象，抽样 40/40 无内容缺陷，复算清零。
- 后续口径：每轮内容治理/hs 补齐落地后**同轮跑 `score_all` 回写**，避免再积累过期分（建议纳入落地流程 checklist）；低分队列启动前先做"复算是否仍 <50"预检，防止再对假队列立项。
- 真正的内容治理残余仅剩存疑台账 2 条空 hs（panduan:334296、changshi:655861），维持台账不伪造。

## 3. 健康快扫 + 数据例行

- active 112,962；options 非 JSON 0；`(cid:` 乱码 0；hs 答案一致性（末次匹配+多选口径）0 不一致；空 hs 仅 2 条台账题；active `<50` = 0。
- 近 7 天作答 39 次 / 14 uid；近 14 天 source=seo 归因作答 0。
- 近 14 天 growth_events：share_open 5、team_join_open 5、heatmap_view 4、share_answer 3、comeback_view 1、task_card_click 1、share_copy 1、share_team_join 1、team_report_copy 1。

## 4. 下一轮建议

1. 站长平台验证仍是 P0（Yandex 已高频自然到访年份页，验证后 Bing/其他引擎破零概率大增，需老板资源）。
2. 打分回写纳入治理落地流程（本轮口径 §2.5），可加轻量周期任务定期 `score_all`。
3. 内容线大盘已清：低分队列四模块归零、一致性 0、乱码 0，仅剩 2 条台账题待人工事实核实；发现线可转向流量/收录复盘与增长实验。
