# 测试计划 v13（刷题功能，H5 400px 视口）

Evidence: pages.json L8/L26（practice 页为第 2 个 tabBar「刷题」）；practice.vue L4-21（模块卡片 grid：中文名+N 题，另有渐变「混合刷题」卡）、L24-52（答题：tag 模块·i/N、选项 optClass right/wrong/dim、判定"✓ 答对了/✗ 答错了，正确答案 X"+解析+答错显示存入按钮）、L120-138（saveWrong：question_text=题干+`A.xx B.xx ...`选项文本、user_answer/correct_answer/explanation 入库）、L55-61（完成页"🎉 本组完成 答对 N/M"+再来一组/返回选模块）；main.py L113-115（GET /api/questions 随机 items+counts，无需访问码）；db.py L57-77（jsonl 种子 12 题 INSERT OR IGNORE）。API 实测 counts = ziliao3/shuliang3/yanyu2/panduan2/changshi2。服务进程 20179（21:00 启动，晚于代码），H5 构建 21:00 新鲜，DB 仅 id=6。

## T1 刷题 Tab 与模块卡片
- 断言 A：tabBar 第 2 项为「刷题」；刷题页显示 5 张模块卡（资料分析 3 题/数量关系 3 题/言语理解 2 题/判断推理 2 题/常识判断 2 题）+ 渐变「混合刷题·全部模块」卡（截图）。

## T2 完整刷完一组（选「言语理解」2 题，快速完整）
点「言语理解」卡开始。
- 断言 B：头部 tag "言语理解 · 1/2"；第 1 题故意答错（选非正确项）→ 所选红、正确项绿、其余淡，判定"✗ 答错了，正确答案 X"+解析文本显示，出现「存入错题本」。
- 断言 C：点存入 → 按钮变"✓ 已存入错题本"；稍后错题本页确认该条：题干含选项文本（A.xx B.xx…），API 校验 user_answer=所选、correct_answer=题库 answer。
- 断言 D：第 2 题答对（对照 API 预取答案）→ 仅正确项绿，判定"✓ 答对了"，无存入按钮。
- 断言 E：点「完成」→ 完成页"🎉 本组完成 答对 1/2"，统计正确。
- 断言 F：点「再来一组」→ 重新进入言语理解 1/2 新一组。

## T3 混合刷题入口
返回选模块 → 点「混合刷题」。
- 断言 G：进入答题，头部 tag 显示某模块名 · 1/10（全库 12 题 limit10）。退出。

## T4 拍题讲解流式回归（Regression）
- 断言 H：拍题讲解页粘贴基期题提交 → 识题后卡片立即出现且讲解逐步增长，最终含答案（快速冒烟即可）。

清理：DELETE 刷题存入的错题，DB 恢复仅剩 id=6。更新 test-report.md（v13 置顶）。
注：言语题需先通过 API 查看该模块 2 题的正确答案以便"故意答错/答对"（不进 UI 前预取，不影响录屏操作）。
